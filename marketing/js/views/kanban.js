// ============================================================================
// IVAE Marketing v2 — Vista Tablero (kanban estilo Monday). Ruta: #/tablero
//
// - Columnas desde STATUS_ORDER + bucket "Otros" para posts con status
//   desconocido (NUNCA invisibles). Otros no es destino valido de drop.
// - Position sparse en pasos de 1000 con renormalizacion de columna en el
//   mismo batch (kanban/move-sheet.js tiene la matematica; store.reorder es
//   optimista con rollback + toast).
// - Movil primero (390px): columnas de ~84vw con scroll-snap horizontal,
//   long-press para arrastrar (motor ui/dnd.js) y SIEMPRE el fallback
//   "Mover a" (bottom sheet) desde el menu de la tarjeta.
// - Bateria de estados (kanban/battery.js) + alta rapida por columna y por
//   FAB (kanban/quick-add.js).
// - Prefs: boardCols (columnas colapsadas por cliente), cardFields (campos
//   visibles en la tarjeta). Filtros espejados en la URL (estado, tipo,
//   persona, desde, hasta, q) via store.filters.
//
// Contrato de vista: export default { mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import {
  el, clear,
  STATUSES, STATUS_ORDER,
  CONTENT_TYPES, CONTENT_TYPE_ORDER,
  fmtDate,
} from '../api.js?v=202606200700';
import { icon } from '../shell/icons.js?v=202606200700';
import { createCard, DEFAULT_CARD_FIELDS, CARD_FIELD_LABELS } from '../kanban/card.js?v=202606200700';
import { createBattery } from '../kanban/battery.js?v=202606200700';
import { createColumnComposer, openQuickAddSheet } from '../kanban/quick-add.js?v=202606200700';
import {
  openMoveSheet, buildInsertUpdates, snapshotFor, sortColumn, columnKeyOf,
  OTHERS_KEY, OTHERS_LABEL, OTHERS_COLOR, STEP,
} from '../kanban/move-sheet.js?v=202606200700';

const FILTER_KEYS = ['estado', 'tipo', 'persona', 'desde', 'hasta', 'q'];

let ctx = null;
let rootEl = null;
let boardEl = null;
let noticeEl = null;
let battery = null;
let unsubs = [];
let dndDispose = null;
let placeholderEl = null;
let filterBadge = null;
let renderQueued = false;

// ── Helpers de estado ────────────────────────────────────────────────────────

function clientKey() {
  const { activeClientId } = ctx.store.getState();
  return activeClientId || 'todos';
}

function getCollapsed() {
  const all = ctx.prefs.get('boardCols', {});
  const list = all && all[clientKey()];
  return Array.isArray(list) ? list : [];
}

function setCollapsed(colKey, collapsed) {
  const all = ctx.prefs.get('boardCols', {}) || {};
  const cur = new Set(Array.isArray(all[clientKey()]) ? all[clientKey()] : []);
  if (collapsed) cur.add(colKey); else cur.delete(colKey);
  all[clientKey()] = [...cur];
  ctx.prefs.set('boardCols', all);
}

function getCardFields() {
  return { ...DEFAULT_CARD_FIELDS, ...(ctx.prefs.get('cardFields', {}) || {}) };
}

/** Definiciones de columna: STATUS_ORDER + Otros solo si tiene posts. */
function columnDefs(posts) {
  const defs = STATUS_ORDER.map((s) => ({
    key: s,
    label: (STATUSES[s] && STATUSES[s].label) || s,
    color: (STATUSES[s] && STATUSES[s].color) || 'var(--text-mute)',
  }));
  if ((posts || []).some((p) => columnKeyOf(p) === OTHERS_KEY)) {
    defs.push({ key: OTHERS_KEY, label: OTHERS_LABEL, color: OTHERS_COLOR });
  }
  return defs;
}

/** Mapa key -> posts ORDENADOS de esa columna. */
function groupByColumn(posts) {
  const map = new Map();
  for (const p of posts || []) {
    const k = columnKeyOf(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  for (const [k, list] of map) map.set(k, sortColumn(list));
  return map;
}

function activeFilters() {
  const { filters, search } = ctx.store.getState();
  const f = { ...(filters || {}) };
  if (!f.q && search) f.q = search;
  return f;
}

function filterCount() {
  const f = activeFilters();
  return FILTER_KEYS.filter((k) => f[k]).length;
}

function matchFilters(p) {
  const f = activeFilters();
  if (f.estado && p.status !== f.estado) return false;
  if (f.tipo && p.content_type !== f.tipo) return false;
  if (f.persona && String(p.assignee || '').toLowerCase() !== String(f.persona).toLowerCase()) return false;
  if (f.desde && (!p.publish_date || String(p.publish_date).slice(0, 10) < f.desde)) return false;
  if (f.hasta && (!p.publish_date || String(p.publish_date).slice(0, 10) > f.hasta)) return false;
  if (f.q) {
    const q = String(f.q).toLowerCase();
    const hit = [p.title, p.caption, p.hook, p.assignee]
      .some((v) => v && String(v).toLowerCase().includes(q));
    if (!hit) return false;
  }
  return true;
}

function postById(id) {
  return (ctx.store.getState().posts || []).find((p) => String(p.id) === String(id)) || null;
}

/** Columna completa (sin filtros) ordenada. Para matematica de posiciones. */
function fullColumn(key) {
  const { posts } = ctx.store.getState();
  return sortColumn((posts || []).filter((p) => columnKeyOf(p) === key));
}

function nextPositionFor(key) {
  const full = fullColumn(key);
  const last = full[full.length - 1];
  if (last && last.position != null && !Number.isNaN(Number(last.position))) {
    return Number(last.position) + STEP;
  }
  return (full.length + 1) * STEP;
}

// ── Mutaciones (optimista + rollback en el store; aqui exito + Deshacer) ─────

async function applyMove(updates, destLabel) {
  const snap = snapshotFor(updates, ctx.store.getState().posts);
  const ok = await ctx.store.reorder(updates);
  if (!ok) return; // el store ya hizo rollback + toast de error
  const canUndo = snap.length && snap.every((s) => s.position != null);
  ctx.toast(destLabel ? `Movido a ${destLabel}.` : 'Tarjeta reordenada.', {
    type: 'success',
    action: canUndo ? { label: 'Deshacer', onAction: () => { ctx.store.reorder(snap); } } : null,
  });
}

function openCardMenu(post) {
  const colKey = columnKeyOf(post);
  ctx.sheet.openSheet({
    title: post.title || 'Contenido',
    mode: 'menu',
    build(body, close) {
      const row = (ic, label, onTap, danger = false) => el('button', {
        class: 'kb-menu-row' + (danger ? ' kb-menu-row--danger' : ''),
        type: 'button',
        onclick: () => { close({ source: 'pick' }); onTap(); },
      }, [icon(ic, 20), el('span', { class: 'kb-menu-row__label', text: label }), icon('right', 16)]);

      body.appendChild(el('div', { class: 'kb-menu' }, [
        row('edit', 'Abrir contenido', () => ctx.openEditor(post.id)),
        row('board', 'Mover a', () => openMoveFor(post)),
        row('refresh', 'Cambiar estado', async () => {
          const v = await ctx.pickers.pickStatus({ current: post.status });
          if (v == null || v === post.status) return;
          const prev = post.status;
          const res = await ctx.store.patchPost(post.id, { status: v });
          if (res) {
            ctx.toast(`Estado: ${(STATUSES[v] && STATUSES[v].label) || v}.`, {
              type: 'success',
              action: { label: 'Deshacer', onAction: () => { ctx.store.patchPost(post.id, { status: prev }); } },
            });
          }
        }),
        row('calendar', 'Cambiar fecha', async () => {
          const v = await ctx.pickers.pickDate({ current: post.publish_date || null });
          if (v === null) return;
          const prev = post.publish_date || null;
          const res = await ctx.store.patchPost(post.id, { publish_date: v || null });
          if (res) {
            ctx.toast(v ? `Fecha: ${fmtDate(v)}.` : 'Fecha quitada.', {
              type: 'success',
              action: { label: 'Deshacer', onAction: () => { ctx.store.patchPost(post.id, { publish_date: prev }); } },
            });
          }
        }),
        row('trash', 'Eliminar', () => confirmDelete(post), true),
      ]));
    },
  });
}

function confirmDelete(post) {
  ctx.sheet.openSheet({
    title: 'Eliminar contenido',
    mode: 'form',
    build(body, close) {
      body.append(
        el('p', { class: 'kb-confirm__txt', text: `Se eliminara "${post.title || 'Sin titulo'}". Esta accion no se puede deshacer.` }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          el('button', {
            class: 'btn btn-danger sheet-cta', type: 'button', text: 'Eliminar',
            onclick: async () => {
              close({ source: 'confirm' });
              const ok = await ctx.store.removePost(post.id);
              if (ok) ctx.toast('Contenido eliminado.', { type: 'success' });
            },
          }),
        ]),
      );
    },
  });
}

function openMoveFor(post) {
  const { posts } = ctx.store.getState();
  const grouped = groupByColumn(posts);
  openMoveSheet({
    ctx,
    post,
    getColumns: () => columnDefs(posts).map((d) => ({
      ...d,
      count: (grouped.get(d.key) || []).length,
    })),
    getFullColumn: (key) => fullColumn(key),
    onMoved: (updates, col) => {
      applyMove(updates, col.key === OTHERS_KEY ? null : col.label);
    },
  });
}

// ── Drag and drop ────────────────────────────────────────────────────────────

function clearDropUI() {
  if (placeholderEl && placeholderEl.parentNode) placeholderEl.remove();
  for (const c of boardEl.querySelectorAll('.kb-col.is-drop-target, .kb-col.is-drop-denied')) {
    c.classList.remove('is-drop-target', 'is-drop-denied');
  }
}

function ensurePlaceholder(height) {
  if (!placeholderEl) placeholderEl = el('div', { class: 'kb-placeholder', 'aria-hidden': 'true' });
  placeholderEl.style.height = `${Math.max(48, height || 64)}px`;
  return placeholderEl;
}

function dropInfo(c) {
  // Devuelve { colEl, colKey, denied } del punto actual del drag.
  const colEl = c.over;
  if (!colEl) return null;
  const colKey = colEl.dataset.col;
  if (!colKey) return null;
  const post = postById(c.data.id);
  if (!post) return null;
  const fromKey = columnKeyOf(post);
  const denied = colKey === OTHERS_KEY && fromKey !== OTHERS_KEY;
  return { colEl, colKey, fromKey, post, denied };
}

function onDragMove(c) {
  clearDropUI();
  const info = dropInfo(c);
  if (!info) return;
  if (info.denied) {
    info.colEl.classList.add('is-drop-denied');
    return;
  }
  info.colEl.classList.add('is-drop-target');
  if (info.colEl.classList.contains('is-collapsed')) return; // drop = al final

  const listEl = info.colEl.querySelector('.kb-col__list');
  if (!listEl) return;
  const ph = ensurePlaceholder(c.ghostEl ? c.ghostEl.getBoundingClientRect().height : 64);
  const cards = [...listEl.querySelectorAll('.kb-card:not(.dnd-origin)')];
  let before = null;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    if (c.y < r.top + r.height / 2) { before = card; break; }
  }
  if (before) listEl.insertBefore(ph, before);
  else listEl.appendChild(ph);
}

function onDragDrop(c) {
  const info = dropInfo(c);
  // Lee el placeholder ANTES de limpiarlo.
  let beforeId = null;
  let afterId = null;
  if (placeholderEl && placeholderEl.parentNode) {
    let n = placeholderEl.nextElementSibling;
    while (n && !(n.classList && n.classList.contains('kb-card') && !n.classList.contains('dnd-origin'))) n = n.nextElementSibling;
    if (n) beforeId = n.dataset.id;
    let pv = placeholderEl.previousElementSibling;
    while (pv && !(pv.classList && pv.classList.contains('kb-card') && !pv.classList.contains('dnd-origin'))) pv = pv.previousElementSibling;
    if (pv) afterId = pv.dataset.id;
  }
  clearDropUI();
  if (!info) return;
  if (info.denied) {
    ctx.toast('Otros agrupa estados desconocidos. Elige una columna con estado.', { type: 'info' });
    return;
  }

  const full = fullColumn(info.colKey).filter((p) => p.id !== info.post.id);
  let idx = full.length;
  if (beforeId != null) {
    const i = full.findIndex((p) => String(p.id) === String(beforeId));
    if (i !== -1) idx = i;
  } else if (afterId != null) {
    const i = full.findIndex((p) => String(p.id) === String(afterId));
    if (i !== -1) idx = i + 1;
  }
  // Sin vecinos visibles (columna vacia o colapsada): idx queda al final.

  const sameSpot = info.fromKey === info.colKey && (() => {
    // Si el placeholder quedo junto a la misma tarjeta, no hay nada que hacer.
    const cur = fullColumn(info.colKey);
    const curIdx = cur.findIndex((p) => p.id === info.post.id);
    return curIdx === idx;
  })();
  if (sameSpot) return;

  const newStatus = (info.colKey !== OTHERS_KEY && info.colKey !== info.fromKey) ? info.colKey : null;
  const updates = buildInsertUpdates(full, idx, info.post, newStatus);
  const def = columnDefs(ctx.store.getState().posts).find((d) => d.key === info.colKey);
  applyMove(updates, newStatus ? (def && def.label) : null);
}

function wireDnd() {
  dndDispose = ctx.dnd.draggableList(boardEl, '.kb-card', (item) => ({
    mode: 'move',
    data: { id: item.dataset.id },
    longPressMs: 350,
    scrollEl: boardEl,
    dropSelector: '.kb-col',
    onMove: onDragMove,
    onDrop: onDragDrop,
    onCancel: clearDropUI,
  }));
}

// ── Filtros (sheet propio; los params viajan en la URL) ──────────────────────

function navigateFilters(patch) {
  const cur = ctx.router.current();
  const params = { ...cur.params };
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v == null) delete params[k]; else params[k] = v;
  }
  ctx.router.navigate(cur.view || 'tablero', params, { replace: true });
}

function openFilterSheet() {
  ctx.sheet.openSheet({
    title: 'Filtros',
    mode: 'menu',
    build(body, close) {
      const rows = el('div', { class: 'kb-menu' });

      const mkRow = (ic, label, getValue, onTap) => {
        const valueEl = el('span', { class: 'kb-menu-row__value', text: getValue() });
        const btn = el('button', {
          class: 'kb-menu-row', type: 'button',
          onclick: async () => { await onTap(); valueEl.textContent = getValue(); paintClear(); },
        }, [icon(ic, 20), el('span', { class: 'kb-menu-row__label', text: label }), valueEl, icon('right', 16)]);
        return btn;
      };

      const f = () => activeFilters();

      rows.append(
        mkRow('refresh', 'Estado',
          () => (f().estado && STATUSES[f().estado] && STATUSES[f().estado].label) || (f().estado || 'Todos'),
          async () => {
            const v = await ctx.sheet.pickFrom({
              title: 'Estado',
              options: [
                { value: '', label: 'Todos los estados', current: !f().estado },
                ...STATUS_ORDER.map((s) => ({
                  value: s, label: STATUSES[s].label, color: STATUSES[s].color, current: f().estado === s,
                })),
              ],
            });
            if (v !== null) navigateFilters({ estado: v });
          }),
        mkRow('copy', 'Tipo',
          () => (f().tipo && CONTENT_TYPES[f().tipo] && CONTENT_TYPES[f().tipo].label) || (f().tipo || 'Todos'),
          async () => {
            const v = await ctx.sheet.pickFrom({
              title: 'Tipo de contenido',
              options: [
                { value: '', label: 'Todos los tipos', current: !f().tipo },
                ...CONTENT_TYPE_ORDER.map((t) => ({
                  value: t, label: CONTENT_TYPES[t].label, color: CONTENT_TYPES[t].color, current: f().tipo === t,
                })),
              ],
            });
            if (v !== null) navigateFilters({ tipo: v });
          }),
        mkRow('user', 'Responsable',
          () => f().persona || 'Todas',
          async () => {
            const users = await ctx.store.loadUsers();
            const names = new Set();
            for (const u of users || []) { if (u.role !== 'client' && u.name) names.add(u.name); }
            for (const p of ctx.store.getState().posts || []) { if (p.assignee) names.add(p.assignee); }
            const v = await ctx.sheet.pickFrom({
              title: 'Responsable',
              options: [
                { value: '', label: 'Todas las personas', current: !f().persona },
                ...[...names].sort((a, b) => a.localeCompare(b)).map((n) => ({
                  value: n, label: n, current: f().persona === n,
                })),
              ],
            });
            if (v !== null) navigateFilters({ persona: v });
          }),
        mkRow('calendar', 'Desde',
          () => (f().desde ? fmtDate(f().desde) : 'Siempre'),
          async () => {
            const v = await ctx.pickers.pickDate({ current: f().desde || null, title: 'Desde' });
            if (v !== null) navigateFilters({ desde: v });
          }),
        mkRow('calendar', 'Hasta',
          () => (f().hasta ? fmtDate(f().hasta) : 'Siempre'),
          async () => {
            const v = await ctx.pickers.pickDate({ current: f().hasta || null, title: 'Hasta' });
            if (v !== null) navigateFilters({ hasta: v });
          }),
      );

      const clearBtn = el('button', {
        class: 'btn kb-filter-clear', type: 'button', text: 'Quitar todos los filtros',
        onclick: () => {
          navigateFilters({ estado: '', tipo: '', persona: '', desde: '', hasta: '', q: '' });
          close({ source: 'clear' });
        },
      });
      function paintClear() { clearBtn.hidden = filterCount() === 0; }
      paintClear();

      body.append(rows, clearBtn);
    },
  });
}

function openOptionsSheet() {
  ctx.sheet.openSheet({
    title: 'Opciones del tablero',
    mode: 'menu',
    build(body, close) {
      body.appendChild(el('div', { class: 'kb-menu__sectitle', text: 'Campos de la tarjeta' }));
      const fields = getCardFields();
      const list = el('div', { class: 'kb-menu' });
      for (const key of Object.keys(DEFAULT_CARD_FIELDS)) {
        const check = el('span', { class: 'kb-menu-row__check', text: fields[key] ? '✓' : '' });
        list.appendChild(el('button', {
          class: 'kb-menu-row', type: 'button',
          'aria-pressed': fields[key] ? 'true' : 'false',
          onclick: (e) => {
            const cur = getCardFields();
            cur[key] = !cur[key];
            ctx.prefs.set('cardFields', cur);
            check.textContent = cur[key] ? '✓' : '';
            e.currentTarget.setAttribute('aria-pressed', cur[key] ? 'true' : 'false');
            scheduleRender();
          },
        }, [el('span', { class: 'kb-menu-row__label', text: CARD_FIELD_LABELS[key] || key }), check]));
      }
      body.appendChild(list);

      body.appendChild(el('button', {
        class: 'btn kb-filter-clear', type: 'button', text: 'Expandir todas las columnas',
        onclick: () => {
          const all = ctx.prefs.get('boardCols', {}) || {};
          all[clientKey()] = [];
          ctx.prefs.set('boardCols', all);
          close({ source: 'pick' });
          scheduleRender();
        },
      }));
    },
  });
}

// ── Render ───────────────────────────────────────────────────────────────────

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (rootEl && rootEl.isConnected) render();
  });
}

function renderColumn(def, visiblePosts, fields, clientsById, collapsed) {
  const isOthers = def.key === OTHERS_KEY;
  const { activeClientId } = ctx.store.getState();
  const showClient = activeClientId === 'todos';

  if (collapsed) {
    return el('section', {
      class: 'kb-col is-collapsed',
      dataset: { col: def.key },
      'aria-label': `${def.label}, ${visiblePosts.length} tarjetas, colapsada`,
    }, [
      el('button', {
        class: 'kb-col__expand', type: 'button',
        'aria-label': `Expandir ${def.label}`,
        onclick: () => { setCollapsed(def.key, false); scheduleRender(); },
      }, [
        el('span', { class: 'kb-col__dot', style: { background: def.color } }),
        el('span', { class: 'kb-col__count', text: String(visiblePosts.length) }),
        el('span', { class: 'kb-col__vlabel', text: def.label }),
      ]),
    ]);
  }

  const listEl = el('div', { class: 'kb-col__list' });
  if (!visiblePosts.length) {
    listEl.appendChild(el('div', { class: 'kb-col__empty', text: isOthers ? 'Sin contenidos.' : 'Suelta una tarjeta aqui.' }));
  } else {
    for (const p of visiblePosts) {
      const cl = showClient ? clientsById.get(p.client_id) : null;
      listEl.appendChild(createCard({
        post: p,
        color: def.color,
        fields,
        client: cl ? { name: cl.name, color: cl.brand_color } : null,
        onOpen: (post) => ctx.openEditor(post.id),
        onMenu: (post) => openCardMenu(post),
      }));
    }
  }

  const kids = [
    el('header', { class: 'kb-col__head' }, [
      el('span', { class: 'kb-col__dot', style: { background: def.color } }),
      el('h2', { class: 'kb-col__title', text: def.label }),
      el('span', { class: 'kb-col__count', text: String(visiblePosts.length) }),
      el('button', {
        class: 'kb-col__collapse', type: 'button',
        'aria-label': `Colapsar ${def.label}`,
        onclick: () => { setCollapsed(def.key, true); scheduleRender(); },
      }, [icon('left', 16)]),
    ]),
    listEl,
  ];

  if (!isOthers) {
    kids.push(createColumnComposer({
      ctx,
      getStatus: () => def.key,
      getClientId: () => ctx.store.getState().activeClientId,
      getNextPosition: (s) => nextPositionFor(s),
      onCreated: () => { /* el store emite posts -> re-render */ },
    }));
  } else {
    kids.push(el('div', { class: 'kb-col__note', text: 'Estados que ya no existen. Mueve estas tarjetas a una columna.' }));
  }

  return el('section', {
    class: 'kb-col' + (isOthers ? ' kb-col--others' : ''),
    dataset: { col: def.key },
    'aria-label': `${def.label}, ${visiblePosts.length} tarjetas`,
  }, kids);
}

function render() {
  const { posts, loading } = ctx.store.getState();

  // Cargando sin datos: skeleton.
  if (loading && (!posts || !posts.length)) {
    battery.update([]);
    noticeEl.hidden = true;
    clear(boardEl);
    for (let i = 0; i < 3; i++) {
      boardEl.appendChild(el('section', { class: 'kb-col kb-col--skel', 'aria-hidden': 'true' }, [
        el('div', { class: 'kb-skel kb-skel--head' }),
        el('div', { class: 'kb-skel kb-skel--card' }),
        el('div', { class: 'kb-skel kb-skel--card' }),
        el('div', { class: 'kb-skel kb-skel--card' }),
      ]));
    }
    return;
  }

  // Vacio total: empty state con CTA.
  if (!posts || !posts.length) {
    battery.update([]);
    noticeEl.hidden = true;
    clear(boardEl);
    boardEl.appendChild(el('div', { class: 'kb-empty' }, [
      el('div', { class: 'kb-empty__icon' }, [icon('board', 30)]),
      el('h3', { text: 'Todavia no hay contenidos' }),
      el('p', { text: 'Crea el primero y empieza a mover el tablero.' }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Nuevo contenido',
        onclick: () => openQuickAddSheet({ ctx, getNextPosition: nextPositionFor }),
      }),
    ]));
    return;
  }

  const defs = columnDefs(posts);
  const filtered = posts.filter(matchFilters);
  const visibleByCol = groupByColumn(filtered);
  const collapsedSet = new Set(getCollapsed());
  const fields = getCardFields();
  const clientsById = new Map((ctx.store.getState().clients || []).map((c) => [c.id, c]));

  // Bateria con lo VISIBLE (refleja los filtros).
  battery.update(defs.map((d) => ({
    key: d.key, label: d.label, color: d.color,
    count: (visibleByCol.get(d.key) || []).length,
  })));

  // Aviso de filtros sin resultados.
  const nFilters = filterCount();
  if (nFilters > 0 && !filtered.length) {
    clear(noticeEl).append(
      el('span', { text: 'Nada coincide con los filtros.' }),
      el('button', {
        class: 'kb-notice__clear', type: 'button', text: 'Quitar filtros',
        onclick: () => navigateFilters({ estado: '', tipo: '', persona: '', desde: '', hasta: '', q: '' }),
      }),
    );
    noticeEl.hidden = false;
  } else {
    noticeEl.hidden = true;
  }
  if (filterBadge) {
    filterBadge.hidden = nFilters === 0;
    filterBadge.textContent = String(nFilters);
  }

  // Conserva el scroll (horizontal del board y vertical por columna).
  const prevLeft = boardEl.scrollLeft;
  const prevTops = new Map();
  for (const colEl of boardEl.querySelectorAll('.kb-col')) {
    const l = colEl.querySelector('.kb-col__list');
    if (l) prevTops.set(colEl.dataset.col, l.scrollTop);
  }

  clear(boardEl);
  for (const def of defs) {
    boardEl.appendChild(renderColumn(
      def,
      visibleByCol.get(def.key) || [],
      fields,
      clientsById,
      collapsedSet.has(def.key),
    ));
  }

  boardEl.scrollLeft = prevLeft;
  for (const colEl of boardEl.querySelectorAll('.kb-col')) {
    const l = colEl.querySelector('.kb-col__list');
    const t = prevTops.get(colEl.dataset.col);
    if (l && t) l.scrollTop = t;
  }
}

function scrollToColumn(key) {
  const colEl = boardEl && boardEl.querySelector(`.kb-col[data-col="${CSS.escape(key)}"]`);
  if (colEl) colEl.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
}

function openBatterySummary() {
  const { posts } = ctx.store.getState();
  const filtered = posts.filter(matchFilters);
  const grouped = groupByColumn(filtered);
  const defs = columnDefs(posts);
  const total = filtered.length || 1;
  ctx.sheet.pickFrom({
    title: 'Resumen por estado',
    options: defs.map((d) => {
      const n = (grouped.get(d.key) || []).length;
      return {
        value: d.key,
        label: d.label,
        color: d.color,
        sub: `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'} · ${Math.round((n / total) * 100)}%`,
      };
    }),
  }).then((key) => { if (key) scrollToColumn(key); });
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'tablero',

  mount(host, c) {
    ctx = c;
    battery = createBattery({ onOpen: openBatterySummary });
    noticeEl = el('div', { class: 'kb-notice', hidden: true });
    boardEl = el('div', { class: 'kb-board', role: 'list', 'aria-label': 'Tablero por estado' });
    rootEl = el('div', { class: 'kb-root' }, [battery.el, noticeEl, boardEl]);
    host.appendChild(rootEl);

    // FAB global: nuevo contenido (primera columna por defecto).
    ctx.setFab({
      label: 'Nuevo',
      onTap: () => openQuickAddSheet({
        ctx,
        status: STATUS_ORDER[0],
        getNextPosition: nextPositionFor,
        onCreated: (post) => scrollToColumn(columnKeyOf(post)),
      }),
    });

    // Controles de vista en el subhead: filtros + opciones.
    filterBadge = el('span', { class: 'kb-ctl__badge', hidden: true });
    const filterBtn = el('button', {
      class: 'kb-ctl', type: 'button', 'aria-label': 'Filtros', 'aria-haspopup': 'dialog',
      onclick: () => openFilterSheet(),
    }, [icon('filter', 18), filterBadge]);
    const optsBtn = el('button', {
      class: 'kb-ctl', type: 'button', 'aria-label': 'Opciones del tablero', 'aria-haspopup': 'dialog',
      onclick: () => openOptionsSheet(),
    }, [icon('settings', 18)]);
    ctx.setViewControls([filterBtn, optsBtn]);

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'filters', 'search', 'activeClientId', 'clients'], scheduleRender),
    );
    wireDnd();
    render();
  },

  onParams() {
    // El shell ya espejo los params en store.filters; solo repintamos.
    scheduleRender();
  },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    if (dndDispose) { try { dndDispose(); } catch { /* noop */ } dndDispose = null; }
    placeholderEl = null;
    filterBadge = null;
    battery = null;
    boardEl = null;
    noticeEl = null;
    rootEl = null;
    ctx = null;
  },
};
