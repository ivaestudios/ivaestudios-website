// ============================================================================
// IVAE Marketing v2 — Vista Timeline (Gantt ligero). Ruta: #/timeline
//
// - Proyeccion de store.posts (cliente activo o 'todos'): cero fetch extra.
// - Barra por post: rango [work_start || publish_date, publish_date],
//   coloreada por status (var --st-*). Sin publish_date el post vive en el
//   chip "Sin fecha" (nunca invisible).
// - Carriles agrupados por responsable (trim + case-insensitive), "Sin
//   asignar" al final; colapso persistido en prefs tlCollapsed.<clientId>.
// - DESKTOP (>=720px): rejilla de dias CSS Grid con columna izquierda sticky,
//   linea de hoy, fines de semana tintados. Drag (mover rango) y resize
//   (handles en bordes) via el motor unico ui/dnd.js, SOLO pointer:fine.
//   Dblclick en celda vacia = quick-create. Panel lateral "Sin fecha" con
//   cards arrastrables + boton Programar (fallback universal sin drag).
// - MOVIL (390px primero): NO es un Gantt apretado. Escala semana = tira de
//   7 dias + lista agrupada con pista de 7 celdas; escala mes = secciones por
//   semana con filas compactas. Tap = sheet de edicion rapida con inputs
//   type=date nativos (sin drag en touch, honesto).
// - Mutaciones SIEMPRE via store.patchPost / createPost (optimista +
//   rollback + toast, patron oficial del store).
//
// Contrato de vista: export default { id, mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import {
  el, clear,
  STATUSES, STATUS_ORDER,
  chip, statusBadge, avatar,
} from '../api.js?v=202606142216';
import { icon } from '../shell/icons.js?v=202606142216';
import {
  toISO, parseISO, todayISO, addDays, addDaysISO, addMonths,
  diffDays, startOfWeek, monthRangeISO, listDays,
  fmtShort, fmtMonthYear,
  MESES, MESES_CORTOS, DIAS_INICIAL, DIAS_CORTOS,
} from '../lib/dates.js?v=202606142216';

const DESKTOP_MQ = '(min-width: 720px)';
const FINE_MQ = '(pointer: fine)';
const SIN_ASIGNAR = '__sin_asignar__';

// ── Estado del modulo ────────────────────────────────────────────────────────
let ctx = null;
let rootEl = null;
let bodyEl = null;
let toolbarEl = null;
let rangeLabelEl = null;
let undatedChip = null;
let segSemana = null;
let segMes = null;

let scale = 'semana';        // 'semana' | 'mes' (pref tlScale)
let refISO = todayISO();     // fecha ancla (NO se persiste)
let showAside = false;       // panel "Sin fecha" desktop

let unsubs = [];
let dndDisposers = [];
let mql = null;
let onMqChange = null;
let renderQueued = false;
let dragActive = false;      // durante drag se SUPRIME todo re-render
let pendingRender = false;
let suppressClickUntil = 0;

// ── Helpers de datos ─────────────────────────────────────────────────────────

function clientKey() {
  const { activeClientId } = ctx.store.getState();
  return activeClientId || 'todos';
}

function getCollapsed() {
  const list = ctx.prefs.get(`tlCollapsed.${clientKey()}`, []);
  return Array.isArray(list) ? list : [];
}

function setCollapsed(personKey, collapsed) {
  const cur = new Set(getCollapsed());
  if (collapsed) cur.add(personKey); else cur.delete(personKey);
  ctx.prefs.set(`tlCollapsed.${clientKey()}`, [...cur]);
}

function isDesktop() { return window.matchMedia(DESKTOP_MQ).matches; }
function isFine() { return window.matchMedia(FINE_MQ).matches; }
function canDrag() { return isDesktop() && isFine(); }

/** Rango visible {from, to} segun escala y fecha ancla. */
function visibleRange() {
  if (scale === 'mes') {
    const r = monthRangeISO(refISO) || monthRangeISO(todayISO());
    return { from: r.desde, to: r.hasta };
  }
  const s = startOfWeek(refISO) || startOfWeek(todayISO());
  return { from: toISO(s), to: toISO(addDays(s, 6)) };
}

/** Rango de la barra de un post CON fecha: [start, end] ISO (start <= end). */
function barRange(p) {
  const end = String(p.publish_date).slice(0, 10);
  let start = p.work_start ? String(p.work_start).slice(0, 10) : end;
  const d = diffDays(start, end);
  if (d === null || d < 0) start = end; // datos sucios: clamp a 1 dia
  return { start, end };
}

function personKeyOf(p) {
  const name = String(p.assignee || '').trim();
  return name ? name.toLowerCase() : SIN_ASIGNAR;
}

/**
 * Agrupa los posts con fecha que INTERSECTAN el rango, por responsable.
 * Devuelve [{key, name, items:[{post,start,end}], statusCounts}] con
 * "Sin asignar" al final.
 */
function groupedInRange(posts, from, to) {
  const groups = new Map();
  for (const p of posts || []) {
    if (!p.publish_date) continue;
    const { start, end } = barRange(p);
    if (diffDays(start, to) === null) continue;
    if (diffDays(start, to) < 0 || diffDays(from, end) < 0) continue; // sin overlap
    const key = personKeyOf(p);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: key === SIN_ASIGNAR ? 'Sin asignar' : String(p.assignee).trim(),
        items: [],
        statusCounts: {},
      });
    }
    const g = groups.get(key);
    g.items.push({ post: p, start, end });
    g.statusCounts[p.status] = (g.statusCounts[p.status] || 0) + 1;
  }
  const list = [...groups.values()];
  for (const g of list) {
    g.items.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.end < b.end ? -1 : 1)));
  }
  list.sort((a, b) => {
    if (a.key === SIN_ASIGNAR) return 1;
    if (b.key === SIN_ASIGNAR) return -1;
    return a.name.localeCompare(b.name, 'es');
  });
  return list;
}

function undatedPosts() {
  const { posts } = ctx.store.getState();
  return (posts || []).filter((p) => !p.publish_date);
}

function postById(id) {
  return (ctx.store.getState().posts || []).find((p) => String(p.id) === String(id)) || null;
}

function clientName(clientId) {
  const c = (ctx.store.getState().clients || []).find((x) => x.id === clientId);
  return c ? c.name : '';
}

/** Etiqueta de rango: '9 - 15 jun' o '30 jun - 6 jul' (semana) / 'Junio 2026' (mes). */
function weekLabel(fromIso, toIso) {
  const a = parseISO(fromIso);
  const b = parseISO(toIso);
  if (!a || !b) return '';
  const year = b.getFullYear() !== new Date().getFullYear() ? ` ${b.getFullYear()}` : '';
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} - ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}${year}`;
  }
  return `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} - ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}${year}`;
}

// ── Mutaciones (delegan en el store: optimista + rollback + toast) ───────────

/**
 * PATCH de fechas con clamp work_start <= publish_date.
 * Devuelve la promesa de store.patchPost.
 */
function patchDates(id, fields) {
  const cur = postById(id);
  if (!cur) return Promise.resolve(null);
  const out = { ...fields };
  const pub = 'publish_date' in out ? out.publish_date : (cur.publish_date || null);
  const ws = 'work_start' in out ? out.work_start : (cur.work_start || null);
  if (pub && ws && diffDays(ws, pub) !== null && diffDays(ws, pub) < 0) {
    out.work_start = pub; // inicio nunca despues de la publicacion
  }
  if (!pub && 'publish_date' in out) {
    // Sin fecha de publicacion la barra no existe: el inicio se conserva.
    out.publish_date = null;
  }
  return ctx.store.patchPost(id, out);
}

async function quickCreate(dayIso, assigneeName) {
  const { activeClientId } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') {
    ctx.toast('Elige un cliente para crear contenido.', { type: 'info' });
    return;
  }
  const data = {
    client_id: activeClientId,
    title: 'Nuevo contenido',
    content_type: 'reel',
    status: 'idea',
    publish_date: dayIso || todayISO(),
  };
  if (assigneeName) data.assignee = assigneeName;
  const post = await ctx.store.createPost(data);
  if (post && post.id) ctx.openEditor(post.id);
}

// ── Sheets ───────────────────────────────────────────────────────────────────

function openLegend() {
  ctx.sheet.openSheet({
    title: 'Leyenda de estados',
    mode: 'menu',
    build(body) {
      const list = el('div', { class: 'pick-list' });
      for (const s of STATUS_ORDER) {
        list.appendChild(el('div', { class: 'pick-row tl-legend-row' }, [
          el('span', { class: 'pick-row__dot', style: { background: STATUSES[s].color } }),
          el('span', { class: 'pick-row__main' }, [
            el('span', { class: 'pick-row__label', text: STATUSES[s].label }),
          ]),
        ]));
      }
      body.append(
        list,
        el('p', { class: 'help tl-legend-note', text: 'Cada barra va del inicio de trabajo a la fecha de publicacion. Sin inicio de trabajo, la barra dura 1 dia.' }),
      );
    },
  });
}

/** Sheet "Sin fecha": lista con boton Programar (input date inline). */
function openUndatedSheet() {
  const items = undatedPosts();
  ctx.sheet.openSheet({
    title: `Sin fecha (${items.length})`,
    mode: 'menu',
    build(body) {
      if (!items.length) {
        body.appendChild(el('p', { class: 'help', text: 'Todo el contenido tiene fecha de publicacion.' }));
        return;
      }
      const list = el('div', { class: 'tl-ulist' });
      const showAll = ctx.store.getState().activeClientId === 'todos';
      for (const p of items) {
        const row = el('div', { class: 'tl-uitem' });
        const dateWrap = el('div', { class: 'tl-uitem__date', hidden: true });
        const input = el('input', { class: 'input', type: 'date', 'aria-label': `Fecha para ${p.title || 'contenido'}` });
        input.addEventListener('change', async () => {
          if (!input.value) return;
          const res = await patchDates(p.id, { publish_date: input.value });
          if (res) {
            ctx.toast(`Programado para el ${fmtShort(input.value)}.`, { type: 'success' });
            row.remove();
            if (!list.children.length) {
              list.replaceWith(el('p', { class: 'help', text: 'Todo el contenido tiene fecha de publicacion.' }));
            }
          }
        });
        dateWrap.appendChild(input);
        row.append(
          el('div', { class: 'tl-uitem__main' }, [
            el('div', { class: 'tl-uitem__title', text: p.title || 'Sin titulo' }),
            el('div', { class: 'tl-uitem__meta' }, [
              chip(p.content_type),
              statusBadge(p.status),
              showAll && p.client_id ? el('span', { class: 'tl-uitem__client', text: clientName(p.client_id) }) : null,
            ]),
          ]),
          el('button', {
            class: 'btn btn-sm', type: 'button', text: 'Programar',
            onclick: () => {
              dateWrap.hidden = !dateWrap.hidden;
              if (!dateWrap.hidden) { try { input.focus(); } catch { /* noop */ } }
            },
          }),
          dateWrap,
        );
        list.appendChild(row);
      }
      body.appendChild(list);
    },
  });
}

/**
 * Sheet de edicion rapida (movil y universal): fechas con input date nativo,
 * estado en filas de 44px, responsable y acceso al editor completo.
 * Cada cambio es un PATCH por campo, optimista, sin boton Guardar.
 */
function openQuickEdit(postId) {
  const initial = postById(postId);
  if (!initial) return;
  const cur = () => postById(postId) || initial;

  ctx.sheet.openSheet({
    title: initial.title || 'Contenido',
    mode: 'form',
    build(body, close) {
      // Publicacion
      const pubInput = el('input', { class: 'input', type: 'date', 'aria-label': 'Fecha de publicacion' });
      if (cur().publish_date) pubInput.value = String(cur().publish_date).slice(0, 10);
      pubInput.addEventListener('change', () => {
        const v = pubInput.value || null;
        // El inicio nunca queda despues de la publicacion: refleja el clamp.
        if (v && wsInput.value && diffDays(wsInput.value, v) !== null && diffDays(wsInput.value, v) < 0) {
          wsInput.value = v;
        }
        patchDates(postId, { publish_date: v });
      });

      // Inicio de trabajo
      const wsInput = el('input', { class: 'input', type: 'date', 'aria-label': 'Inicio de trabajo' });
      if (cur().work_start) wsInput.value = String(cur().work_start).slice(0, 10);
      wsInput.addEventListener('change', () => {
        const v = wsInput.value || null;
        const pub = pubInput.value || null;
        if (v && pub && diffDays(v, pub) !== null && diffDays(v, pub) < 0) {
          wsInput.value = pub;
          ctx.toast('El inicio no puede ser despues de la publicacion.', { type: 'info' });
          patchDates(postId, { work_start: pub });
          return;
        }
        patchDates(postId, { work_start: v });
      });

      // Estado: 8 filas de 44px, un tap aplica y guarda
      const states = el('div', { class: 'tl-qstates', role: 'group', 'aria-label': 'Estado' });
      const paintStates = () => {
        const st = cur().status;
        for (const b of states.querySelectorAll('.tl-qstate')) {
          const is = b.dataset.status === st;
          b.classList.toggle('is-current', is);
          b.setAttribute('aria-pressed', is ? 'true' : 'false');
        }
      };
      for (const s of STATUS_ORDER) {
        states.appendChild(el('button', {
          class: 'tl-qstate', type: 'button', dataset: { status: s },
          onclick: async () => {
            if (cur().status === s) return;
            const res = await ctx.store.patchPost(postId, { status: s });
            if (res) paintStates();
          },
        }, [
          el('span', { class: 'tl-qstate__dot' }),
          el('span', { class: 'tl-qstate__label', text: STATUSES[s].label }),
          el('span', { class: 'tl-qstate__check', text: '✓' }),
        ]));
      }
      paintStates();

      // Responsable
      const personValue = el('span', {
        class: 'tl-qperson__value',
        text: String(cur().assignee || '').trim() || 'Sin responsable',
      });
      const personBtn = el('button', {
        class: 'tl-qperson', type: 'button', 'aria-haspopup': 'dialog',
        onclick: async () => {
          const users = await ctx.store.loadUsers();
          const r = await ctx.pickers.pickPerson({
            current: String(cur().assignee || '').trim(),
            users: users || [],
          });
          if (r === null) return;
          const fields = { assignee: r.name || null, assignee_user_id: r.user_id || null };
          const res = await ctx.store.patchPost(postId, fields);
          if (res) personValue.textContent = r.name || 'Sin responsable';
        },
      }, [
        icon('user', 18),
        el('span', { class: 'tl-qperson__label', text: 'Responsable' }),
        personValue,
        icon('right', 16),
      ]);

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Publicacion' }), pubInput]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: 'Inicio de trabajo' }),
          wsInput,
          el('span', { class: 'help', text: 'Dejalo vacio si el trabajo es del mismo dia.' }),
        ]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Estado' }), states]),
        personBtn,
        el('button', {
          class: 'btn btn-primary tl-qopen', type: 'button', text: 'Abrir editor completo',
          onclick: () => { close({ source: 'open-editor' }); ctx.openEditor(postId); },
        }),
      );
    },
  });
}

// ── Render: toolbar ──────────────────────────────────────────────────────────

function buildToolbar() {
  segSemana = el('button', {
    type: 'button', role: 'tab', text: 'Semana',
    onclick: () => { if (scale !== 'semana') { scale = 'semana'; ctx.prefs.set('tlScale', scale); scheduleRender(); } },
  });
  segMes = el('button', {
    type: 'button', role: 'tab', text: 'Mes',
    onclick: () => { if (scale !== 'mes') { scale = 'mes'; ctx.prefs.set('tlScale', scale); scheduleRender(); } },
  });
  const seg = el('div', { class: 'seg tl-seg', role: 'tablist', 'aria-label': 'Escala del timeline' }, [segSemana, segMes]);

  const prevBtn = el('button', {
    class: 'tl-ctl', type: 'button', 'aria-label': 'Rango anterior',
    onclick: () => { shiftRange(-1); },
  }, [icon('left', 18)]);
  const nextBtn = el('button', {
    class: 'tl-ctl', type: 'button', 'aria-label': 'Rango siguiente',
    onclick: () => { shiftRange(1); },
  }, [icon('right', 18)]);
  const todayBtn = el('button', {
    class: 'btn btn-sm tl-today-btn', type: 'button', text: 'Hoy',
    onclick: () => { refISO = todayISO(); scheduleRender(); },
  });

  rangeLabelEl = el('span', { class: 'tl-range', 'aria-live': 'polite' });

  undatedChip = el('button', {
    class: 'tl-chip', type: 'button', hidden: true, 'aria-haspopup': 'dialog',
    onclick: () => {
      if (isDesktop()) { showAside = !showAside; scheduleRender(); }
      else openUndatedSheet();
    },
  });

  const legendBtn = el('button', {
    class: 'tl-ctl tl-ctl--legend', type: 'button', text: '?',
    'aria-label': 'Leyenda de estados', 'aria-haspopup': 'dialog',
    onclick: () => openLegend(),
  });

  toolbarEl = el('div', { class: 'tl-toolbar' }, [
    seg,
    el('div', { class: 'tl-toolbar__nav' }, [prevBtn, todayBtn, nextBtn]),
    rangeLabelEl,
    el('div', { class: 'tl-toolbar__spacer' }),
    undatedChip,
    legendBtn,
  ]);
  return toolbarEl;
}

function shiftRange(dir) {
  if (scale === 'mes') {
    const d = addMonths(refISO, dir);
    refISO = d ? toISO(d) : refISO;
  } else {
    refISO = addDaysISO(refISO, dir * 7) || refISO;
  }
  scheduleRender();
}

function updateToolbar() {
  const { from, to } = visibleRange();
  rangeLabelEl.textContent = scale === 'mes' ? fmtMonthYear(from) : weekLabel(from, to);
  const isSem = scale === 'semana';
  segSemana.classList.toggle('is-active', isSem);
  segSemana.setAttribute('aria-selected', isSem ? 'true' : 'false');
  segMes.classList.toggle('is-active', !isSem);
  segMes.setAttribute('aria-selected', !isSem ? 'true' : 'false');

  const n = undatedPosts().length;
  undatedChip.hidden = n === 0;
  undatedChip.textContent = `Sin fecha (${n})`;
  undatedChip.setAttribute('aria-expanded', isDesktop() && showAside ? 'true' : 'false');
}

// ── Render: desktop (Gantt CSS Grid) ─────────────────────────────────────────

/** Asigna pista (sub-fila) a cada item para que las barras no se encimen. */
function assignTracks(items) {
  const ends = []; // ultimo indice de dia ocupado por pista
  for (const it of items) {
    let t = ends.findIndex((e) => e < it.a);
    if (t === -1) { t = ends.length; ends.push(it.b); } else { ends[t] = it.b; }
    it.track = t;
  }
  return Math.max(1, ends.length);
}

function buildBattery(statusCounts, total) {
  const bar = el('span', { class: 'tl-battery', 'aria-hidden': 'true' });
  for (const s of STATUS_ORDER) {
    const n = statusCounts[s] || 0;
    if (!n) continue;
    bar.appendChild(el('span', {
      class: 'tl-battery__seg',
      style: { flexGrow: String(n), background: STATUSES[s].color },
    }));
  }
  const other = total - STATUS_ORDER.reduce((acc, s) => acc + (statusCounts[s] || 0), 0);
  if (other > 0) {
    bar.appendChild(el('span', { class: 'tl-battery__seg', style: { flexGrow: String(other), background: 'var(--text-mute)' } }));
  }
  return bar;
}

function buildGroupHead(g, collapsed, asButton = true) {
  const kids = [
    avatar(g.key === SIN_ASIGNAR ? '?' : g.name, true),
    el('span', { class: 'tl-ghead__name', text: g.name }),
    el('span', { class: 'tl-ghead__count', text: String(g.items.length) }),
    buildBattery(g.statusCounts, g.items.length),
    el('span', { class: 'tl-ghead__chev' }, [icon(collapsed ? 'right' : 'down', 16)]),
  ];
  if (!asButton) return el('div', { class: 'tl-ghead' }, kids);
  return el('button', {
    class: 'tl-ghead', type: 'button',
    'aria-expanded': collapsed ? 'false' : 'true',
    'aria-label': `${g.name}, ${g.items.length} contenidos, ${collapsed ? 'expandir' : 'colapsar'}`,
    onclick: () => { setCollapsed(g.key, !collapsed); scheduleRender(); },
  }, kids);
}

function buildBar(item, a, b, days, group) {
  const p = item.post;
  const len = b - a + 1;
  const clipL = item.start < days[0];
  const clipR = item.end > days[days.length - 1];
  const showAll = ctx.store.getState().activeClientId === 'todos';
  const tip = (showAll && p.client_id ? `${clientName(p.client_id)} · ` : '') +
    (p.title || 'Sin titulo') + ` · ${STATUSES[p.status] ? STATUSES[p.status].label : p.status}`;

  const bar = el('div', {
    class: 'tl-bar' +
      (p.work_start ? '' : ' tl-bar--pill') +
      (clipL ? ' is-clip-l' : '') +
      (clipR ? ' is-clip-r' : ''),
    dataset: { id: String(p.id), status: p.status || '' },
    title: tip,
    role: 'button',
    tabindex: '0',
    'aria-label': tip,
  });
  bar.style.gridColumn = `${a + 2} / span ${len}`;
  bar.style.gridRow = String(item.track + 1);

  const showLabel = scale === 'semana' || len >= 3;
  if (showLabel) bar.appendChild(el('span', { class: 'tl-bar__label', text: p.title || 'Sin titulo' }));

  if (canDrag()) {
    // Sin handles en bordes recortados por el rango: el dato real vive fuera.
    if (!clipL) {
      const hL = el('span', { class: 'tl-bar__h tl-bar__h--l', 'aria-hidden': 'true' });
      hL.addEventListener('pointerdown', (e) => e.stopPropagation());
      hL.addEventListener('click', (e) => e.stopPropagation());
      bar.appendChild(hL);
    }
    if (p.work_start && !clipR) {
      const hR = el('span', { class: 'tl-bar__h tl-bar__h--r', 'aria-hidden': 'true' });
      hR.addEventListener('pointerdown', (e) => e.stopPropagation());
      hR.addEventListener('click', (e) => e.stopPropagation());
      bar.appendChild(hR);
    }
  }

  bar.addEventListener('click', () => {
    if (Date.now() < suppressClickUntil) return;
    ctx.openEditor(p.id);
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.openEditor(p.id); }
  });
  return bar;
}

function dayWidthOf(gridEl) {
  const cell = gridEl.querySelector('.tl-cell');
  return cell ? Math.max(8, cell.getBoundingClientRect().width) : 36;
}

/** Drag (mover) + resize (bordes) de una barra. Solo desktop + pointer fine. */
function wireBarDnd(bar, item, a, b, N, gridEl) {
  const p = item.post;
  const len = b - a + 1;
  let dayW = 36;
  let origW = 0;

  const resetStyles = () => {
    bar.style.transform = '';
    bar.style.width = '';
    bar.classList.remove('is-dragging');
  };
  const endDrag = () => {
    dragActive = false;
    suppressClickUntil = Date.now() + 400;
    resetStyles();
    flushPendingRender();
  };

  // Mover el rango completo (snap a dia).
  const clampMove = (snap) => Math.max(-a, Math.min(N - 1 - b, snap));
  dndDisposers.push(ctx.dnd.draggable(bar, {
    mode: 'resize',
    handle: bar,
    moveThreshold: 6,
    onStart() {
      dragActive = true;
      dayW = dayWidthOf(gridEl);
      bar.classList.add('is-dragging');
    },
    onMove(c) {
      const snap = clampMove(Math.round(c.dx / dayW));
      bar.style.transform = `translateX(${snap * dayW}px)`;
    },
    onDrop(c) {
      const snap = clampMove(Math.round(c.dx / dayW));
      endDrag();
      if (!snap) return;
      const fields = { publish_date: addDaysISO(item.end, snap) };
      if (p.work_start) fields.work_start = addDaysISO(item.start, snap);
      patchDates(p.id, fields);
    },
    onCancel() { endDrag(); },
  }));

  // Borde izquierdo: escribe work_start (clamp <= publish_date).
  const hL = bar.querySelector('.tl-bar__h--l');
  if (hL) {
    const clampL = (snap) => Math.max(-a, Math.min(len - 1, snap));
    dndDisposers.push(ctx.dnd.draggable(hL, {
      mode: 'resize',
      handle: hL,
      moveThreshold: 2,
      onStart() {
        dragActive = true;
        dayW = dayWidthOf(gridEl);
        origW = bar.getBoundingClientRect().width;
        bar.classList.add('is-dragging');
      },
      onMove(c) {
        const snap = clampL(Math.round(c.dx / dayW));
        bar.style.transform = `translateX(${snap * dayW}px)`;
        bar.style.width = `${origW - snap * dayW}px`;
      },
      onDrop(c) {
        const snap = clampL(Math.round(c.dx / dayW));
        endDrag();
        if (!snap) return;
        patchDates(p.id, { work_start: addDaysISO(item.start, snap) });
      },
      onCancel() { endDrag(); },
    }));
  }

  // Borde derecho: escribe publish_date (clamp >= work_start).
  const hR = bar.querySelector('.tl-bar__h--r');
  if (hR) {
    const clampR = (snap) => Math.max(-(len - 1), Math.min(N - 1 - b, snap));
    dndDisposers.push(ctx.dnd.draggable(hR, {
      mode: 'resize',
      handle: hR,
      moveThreshold: 2,
      onStart() {
        dragActive = true;
        dayW = dayWidthOf(gridEl);
        origW = bar.getBoundingClientRect().width;
        bar.classList.add('is-dragging');
      },
      onMove(c) {
        const snap = clampR(Math.round(c.dx / dayW));
        bar.style.width = `${origW + snap * dayW}px`;
      },
      onDrop(c) {
        const snap = clampR(Math.round(c.dx / dayW));
        endDrag();
        if (!snap) return;
        patchDates(p.id, { publish_date: addDaysISO(item.end, snap) });
      },
      onCancel() { endDrag(); },
    }));
  }
}

function renderDesktop(groups, days, from, to) {
  const N = days.length;
  const today = todayISO();
  const collapsedSet = new Set(getCollapsed());
  const cols = `var(--tl-side) repeat(${N}, minmax(var(--tl-day-w), 1fr))`;
  const scroll = el('div', { class: 'tl-scroll', role: 'grid', 'aria-label': 'Linea de tiempo por responsable' });

  // Cabecera de dias (sticky top dentro del scroll).
  const head = el('div', { class: 'tl-grid tl-grid--head', role: 'row' });
  head.style.gridTemplateColumns = cols;
  head.appendChild(el('div', { class: 'tl-corner', text: 'Responsable' }));
  days.forEach((iso, i) => {
    const d = parseISO(iso);
    const dow = (d.getDay() + 6) % 7;
    const cell = el('div', {
      class: 'tl-dayhead' + (dow >= 5 ? ' is-weekend' : '') + (iso === today ? ' is-today' : ''),
      role: 'columnheader',
    }, [
      el('span', { class: 'tl-dayhead__dow', text: DIAS_INICIAL[dow] }),
      el('span', { class: 'tl-dayhead__num', text: String(d.getDate()) }),
    ]);
    cell.style.gridColumn = String(i + 2);
    head.appendChild(cell);
  });
  scroll.appendChild(head);

  if (!groups.length) {
    const note = el('div', { class: 'tl-empty-range' }, [
      el('span', { text: 'Sin contenidos en este rango.' }),
      el('button', {
        class: 'btn btn-sm', type: 'button', text: 'Ir a hoy',
        onclick: () => { refISO = todayISO(); scheduleRender(); },
      }),
    ]);
    scroll.appendChild(note);
  }

  const barsToWire = [];
  for (const g of groups) {
    const collapsed = collapsedSet.has(g.key);
    let tracks = 1;
    let items = [];
    if (!collapsed) {
      items = g.items.map((it) => ({
        ...it,
        a: Math.max(0, diffDays(from, it.start < from ? from : it.start) || 0),
        b: Math.min(N - 1, diffDays(from, it.end > to ? to : it.end) || 0),
      }));
      tracks = assignTracks(items);
    }

    const row = el('div', {
      class: 'tl-grid tl-grouprow' + (collapsed ? ' is-collapsed' : ''),
      role: 'row',
    });
    row.style.gridTemplateColumns = cols;

    const headCell = el('div', { class: 'tl-rowhead' }, [buildGroupHead(g, collapsed)]);
    headCell.style.gridRow = `1 / ${tracks + 1}`;
    row.appendChild(headCell);

    // Celdas de fondo (weekend, hoy, dblclick quick-create).
    days.forEach((iso, i) => {
      const d = parseISO(iso);
      const dow = (d.getDay() + 6) % 7;
      const cell = el('div', {
        class: 'tl-cell' + (dow >= 5 ? ' is-weekend' : '') + (iso === today ? ' is-today' : ''),
        dataset: { day: iso, person: g.key },
      });
      cell.style.gridColumn = String(i + 2);
      cell.style.gridRow = `1 / ${tracks + 1}`;
      if (!collapsed) {
        cell.addEventListener('dblclick', () => {
          quickCreate(iso, g.key === SIN_ASIGNAR ? null : g.name);
        });
      }
      row.appendChild(cell);
    });

    if (!collapsed) {
      for (const it of items) {
        const bar = buildBar(it, it.a, it.b, days, g);
        row.appendChild(bar);
        if (canDrag()) barsToWire.push([bar, it, it.a, it.b]);
      }
    }
    scroll.appendChild(row);
  }

  const wrap = el('div', { class: 'tl-desk' + (showAside ? ' has-aside' : '') }, [scroll]);
  if (showAside) wrap.appendChild(renderAside());
  bodyEl.appendChild(wrap);

  for (const [bar, it, a, b] of barsToWire) wireBarDnd(bar, it, a, b, N, scroll);
}

/** Panel lateral desktop "Sin fecha": cards arrastrables + Programar. */
function renderAside() {
  const items = undatedPosts();
  const aside = el('aside', { class: 'tl-aside', 'aria-label': 'Contenido sin fecha' });
  aside.appendChild(el('div', { class: 'tl-aside__head' }, [
    el('h3', { text: `Sin fecha (${items.length})` }),
    el('button', {
      class: 'tl-ctl', type: 'button', 'aria-label': 'Cerrar panel',
      onclick: () => { showAside = false; scheduleRender(); },
    }, [icon('close', 16)]),
  ]));

  if (!items.length) {
    aside.appendChild(el('p', { class: 'help', text: 'Todo el contenido tiene fecha. Arrastra una card a la rejilla cuando exista.' }));
    return aside;
  }

  const list = el('div', { class: 'tl-aside__list' });
  let lastOver = null;
  const clearOver = () => { if (lastOver) { lastOver.classList.remove('is-drop'); lastOver = null; } };

  for (const p of items) {
    const card = el('div', { class: 'tl-ucard', dataset: { id: String(p.id) } }, [
      el('div', { class: 'tl-ucard__title', text: p.title || 'Sin titulo' }),
      el('div', { class: 'tl-ucard__meta' }, [chip(p.content_type), statusBadge(p.status)]),
      el('button', {
        class: 'btn btn-sm', type: 'button', text: 'Programar',
        onclick: async (e) => {
          const v = await ctx.pickers.pickDate({ current: null, anchor: e.currentTarget, allowClear: false });
          if (v) {
            const res = await patchDates(p.id, { publish_date: v });
            if (res) ctx.toast(`Programado para el ${fmtShort(v)}.`, { type: 'success' });
          }
        },
      }),
    ]);
    list.appendChild(card);

    if (canDrag()) {
      dndDisposers.push(ctx.dnd.draggable(card, {
        mode: 'move',
        data: { id: p.id },
        moveThreshold: 6,
        dropSelector: '.tl-cell',
        onStart() { dragActive = true; },
        onMove(c) {
          if (c.over !== lastOver) {
            clearOver();
            if (c.over) { lastOver = c.over; lastOver.classList.add('is-drop'); }
          }
        },
        onDrop(c) {
          const day = c.over ? c.over.dataset.day : null;
          const person = c.over ? c.over.dataset.person : null;
          clearOver();
          dragActive = false;
          flushPendingRender();
          if (!day) return;
          const fields = { publish_date: day };
          if (person && person !== SIN_ASIGNAR && !String(p.assignee || '').trim()) {
            // Soltar en el carril de alguien asigna tambien al responsable
            // SOLO si el post no tenia uno (no pisamos datos).
            const sample = (ctx.store.getState().posts || [])
              .find((x) => personKeyOf(x) === person && String(x.assignee || '').trim());
            if (sample) fields.assignee = String(sample.assignee).trim();
          }
          patchDates(p.id, fields).then((res) => {
            if (res) ctx.toast(`Programado para el ${fmtShort(day)}.`, { type: 'success' });
          });
        },
        onCancel() { clearOver(); dragActive = false; flushPendingRender(); },
      }));
    }
  }
  aside.appendChild(list);
  return aside;
}

// ── Render: movil ────────────────────────────────────────────────────────────

function renderMobileWeek(groups, days, from, to) {
  const today = todayISO();
  const collapsedSet = new Set(getCollapsed());

  // Tira sticky de 7 dias.
  const strip = el('div', { class: 'tl-strip', 'aria-hidden': 'true' });
  days.forEach((iso) => {
    const d = parseISO(iso);
    const dow = (d.getDay() + 6) % 7;
    strip.appendChild(el('div', {
      class: 'tl-strip__day' + (dow >= 5 ? ' is-weekend' : '') + (iso === today ? ' is-today' : ''),
    }, [
      el('span', { class: 'tl-strip__dow', text: DIAS_INICIAL[dow] }),
      el('span', { class: 'tl-strip__num', text: String(d.getDate()) }),
    ]));
  });
  bodyEl.appendChild(strip);

  if (!groups.length) {
    bodyEl.appendChild(el('div', { class: 'tl-empty-range' }, [
      el('span', { text: 'Sin contenidos en esta semana.' }),
      el('button', {
        class: 'btn btn-sm', type: 'button', text: 'Ir a hoy',
        onclick: () => { refISO = todayISO(); scheduleRender(); },
      }),
    ]));
    return;
  }

  const N = days.length;
  for (const g of groups) {
    const collapsed = collapsedSet.has(g.key);
    const sec = el('section', { class: 'tl-group' + (collapsed ? ' is-collapsed' : '') });
    sec.appendChild(buildGroupHead(g, collapsed));
    if (!collapsed) {
      const list = el('div', { class: 'tl-group__list' });
      for (const it of g.items) {
        const p = it.post;
        const a = Math.max(0, diffDays(from, it.start < from ? from : it.start) || 0);
        const b = Math.min(N - 1, diffDays(from, it.end > to ? to : it.end) || 0);
        const track = el('div', { class: 'tl-mtrack', 'aria-hidden': 'true' });
        for (let i = 0; i < N; i++) {
          const d = parseISO(days[i]);
          const dow = (d.getDay() + 6) % 7;
          track.appendChild(el('span', {
            class: 'tl-mtrack__cell' + (dow >= 5 ? ' is-weekend' : '') + (days[i] === today ? ' is-today' : ''),
          }));
        }
        const mbar = el('span', { class: 'tl-mtrack__bar', dataset: { status: p.status || '' } });
        mbar.style.gridColumn = `${a + 1} / span ${b - a + 1}`;
        track.appendChild(mbar);

        list.appendChild(el('button', {
          class: 'tl-mrow', type: 'button',
          'aria-label': `${p.title || 'Sin titulo'}, ${STATUSES[p.status] ? STATUSES[p.status].label : p.status}. Editar`,
          onclick: () => openQuickEdit(p.id),
        }, [
          el('span', { class: 'tl-mrow__top' }, [
            el('span', { class: 'tl-mrow__title', text: p.title || 'Sin titulo' }),
            statusBadge(p.status),
          ]),
          track,
        ]));
      }
      sec.appendChild(list);
    }
    bodyEl.appendChild(sec);
  }
}

function renderMobileMonth(groups, from, to) {
  // Secciones por semana con filas compactas (el mes completo en columnas
  // no se intenta en movil: honesto, como Monday).
  const items = [];
  for (const g of groups) for (const it of g.items) items.push(it);
  items.sort((x, y) => (x.end < y.end ? -1 : 1));

  if (!items.length) {
    bodyEl.appendChild(el('div', { class: 'tl-empty-range' }, [
      el('span', { text: 'Sin contenidos en este mes.' }),
      el('button', {
        class: 'btn btn-sm', type: 'button', text: 'Ir a hoy',
        onclick: () => { refISO = todayISO(); scheduleRender(); },
      }),
    ]));
    return;
  }

  // Semanas (lunes) que cruzan el mes visible.
  let cursor = startOfWeek(from);
  const endDate = parseISO(to);
  while (cursor && cursor.getTime() <= endDate.getTime()) {
    const wFrom = toISO(cursor);
    const wTo = toISO(addDays(cursor, 6));
    const inWeek = items.filter((it) => it.end >= wFrom && it.end <= wTo);
    if (inWeek.length) {
      const a = parseISO(wFrom);
      const b = parseISO(wTo);
      const title = a.getMonth() === b.getMonth()
        ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
        : `Semana del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
      const sec = el('section', { class: 'tl-wsec' });
      sec.appendChild(el('h3', { class: 'tl-wsec__title', text: title }));
      for (const it of inWeek) {
        const p = it.post;
        const d = parseISO(it.end);
        const dow = (d.getDay() + 6) % 7;
        const dur = (diffDays(it.start, it.end) || 0) + 1;
        const who = String(p.assignee || '').trim();
        sec.appendChild(el('button', {
          class: 'tl-mitem', type: 'button',
          onclick: () => openQuickEdit(p.id),
        }, [
          el('span', { class: 'tl-mitem__dot', dataset: { status: p.status || '' }, 'aria-hidden': 'true' }),
          el('span', { class: 'tl-mitem__main' }, [
            el('span', { class: 'tl-mitem__title', text: p.title || 'Sin titulo' }),
            el('span', { class: 'tl-mitem__meta' }, [
              el('span', { text: `${DIAS_CORTOS[dow]} ${d.getDate()}` }),
              dur > 1 ? el('span', { text: ` · ${dur} dias` }) : null,
              who ? el('span', { text: ` · ${who}` }) : null,
            ]),
          ]),
          statusBadge(p.status),
        ]));
      }
      bodyEl.appendChild(sec);
    }
    cursor = addDays(cursor, 7);
  }
}

// ── Render raiz ──────────────────────────────────────────────────────────────

function disposeDnd() {
  for (const d of dndDisposers) { try { d(); } catch { /* noop */ } }
  dndDisposers = [];
}

function render() {
  if (!rootEl || !rootEl.isConnected) return;
  if (dragActive) { pendingRender = true; return; }
  disposeDnd();
  updateToolbar();
  clear(bodyEl);

  const { posts, loading } = ctx.store.getState();

  if (loading && (!posts || !posts.length)) {
    const skel = el('div', { class: 'tl-skel-wrap', 'aria-hidden': 'true' });
    for (let i = 0; i < 4; i++) skel.appendChild(el('div', { class: 'tl-skel' }));
    bodyEl.appendChild(skel);
    return;
  }

  if (!posts || !posts.length) {
    bodyEl.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon' }, [icon('gantt', 30)]),
      el('h3', { text: 'Todavia no hay contenidos' }),
      el('p', { text: 'Crea el primero y miralo en la linea de tiempo.' }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Nuevo contenido',
        onclick: () => quickCreate(todayISO(), null),
      }),
    ]));
    return;
  }

  const { from, to } = visibleRange();
  const groups = groupedInRange(posts, from, to);

  if (isDesktop()) {
    const days = listDays(from, to);
    renderDesktop(groups, days, from, to);
  } else if (scale === 'mes') {
    renderMobileMonth(groups, from, to);
  } else {
    const days = listDays(from, to);
    renderMobileWeek(groups, days, from, to);
  }
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function flushPendingRender() {
  if (pendingRender) {
    pendingRender = false;
    scheduleRender();
  }
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'timeline',

  mount(host, c) {
    ctx = c;
    scale = ctx.prefs.get('tlScale', 'semana') === 'mes' ? 'mes' : 'semana';
    refISO = todayISO();
    showAside = false;
    suppressClickUntil = 0;

    bodyEl = el('div', { class: 'tl-body' });
    rootEl = el('div', { class: 'tl-root' }, [buildToolbar(), bodyEl]);
    host.appendChild(rootEl);

    ctx.setFab({
      label: 'Nuevo',
      onTap: () => quickCreate(todayISO(), null),
    });

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'activeClientId', 'clients'], scheduleRender),
    );

    mql = window.matchMedia(DESKTOP_MQ);
    onMqChange = () => scheduleRender();
    try { mql.addEventListener('change', onMqChange); } catch { mql.addListener(onMqChange); }

    render();
  },

  onParams() {
    scheduleRender();
  },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    disposeDnd();
    if (mql && onMqChange) {
      try { mql.removeEventListener('change', onMqChange); } catch { try { mql.removeListener(onMqChange); } catch { /* noop */ } }
    }
    mql = null;
    onMqChange = null;
    dragActive = false;
    pendingRender = false;
    rootEl = null;
    bodyEl = null;
    toolbarEl = null;
    rangeLabelEl = null;
    undatedChip = null;
    segSemana = null;
    segMes = null;
    ctx = null;
  },
};
