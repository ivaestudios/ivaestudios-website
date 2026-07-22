// ============================================================================
// IVAE Marketing v2 — Vista Carga (workload por responsable). Ruta: #/carga
//
// - Cross-cliente y solo staff: GET /workload?from&to (4 semanas ISO desde la
//   semana actual; nav de 4 en 4; "Esta semana" regresa). Estado LOCAL
//   {from, to, posts, undated, capacities, expanded}: NO contamina
//   store.posts. Si el backend v2 aun no esta desplegado (404) degrada a un
//   fetch por cliente + GET /capacities best-effort.
// - REGLA DE REPARTO v1 (documentada en la UI): todos los puntos de un post
//   cuentan en la semana ISO de su publish_date. Puntos = effort_points o
//   default por tipo (fuente unica js/lib/effort.js + mapa de tipos IVAE).
// - Semaforo SIEMPRE con numero visible (AA: color + texto, nunca solo
//   color): verde <80%, ambar 80-100%, rojo >100% de la capacidad semanal.
//   Persona sin capacidad: barra gris + "Define su capacidad".
// - Drill-down accionable por semana: Mover fecha / Reasignar / Abrir
//   (selectClient + openEditor). Mutacion local optimista + rollback + toast
//   con Deshacer + refetch best-effort. Tras el PATCH sincroniza el store
//   global como mywork.js: upsertPost SOLO si el post ya vive en store.posts
//   (sin contaminar cross-cliente) + emit 'posts:changed'/'mutated' +
//   refreshClientCounts, para que Calendario/Tablero/Tabla y los counts del
//   switcher no queden stale.
// - Capacidades: sheet con upsert POST /capacities {assignee, weekly_points}.
// - Movil primero (390px): lista vertical de personas con barras apiladas y
//   accordion. Desktop (>=720px): mismo DOM, layout de tabla por CSS
//   (columna persona sticky + una columna por semana).
//
// Contrato de vista: export default { id, mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import {
  api, el, clear,
  chip, statusBadge, avatar,
} from '../api.js?v=202607220205';
import { icon } from '../shell/icons.js?v=202607220205';
import {
  toISO, parseISO, todayISO, addDays, addDaysISO, startOfWeek,
  fmtShort, MESES_CORTOS,
} from '../lib/dates.js?v=202607220205';
import { effortOf, DEFAULT_EFFORT } from '../lib/effort.js?v=202607220205';
import { T } from '../shell/i18n.js?v=202607220205';

const WEEKS_VISIBLE = 4;
const SIN_KEY = '__sin_asignar__';
const ERR_SAVE = T('No se pudo guardar, intenta de nuevo.', "Couldn't save, try again.");

// Tipos IVAE que el mapa generico de lib/effort.js no trae (espejo del spec:
// reel 3, tiktok 3, carrusel 2, pauta 2, experiencia 2, tratamientos 2,
// informativo 1, historia 1, foto 1).
const EFFORT_MAP = {
  ...DEFAULT_EFFORT,
  tiktok: 3,
  pauta: 2,
  experiencia: 2,
  tratamientos: 2,
  informativo: 1,
};

// ── Estado del modulo ────────────────────────────────────────────────────────
let ctx = null;
let rootEl = null;
let bodyEl = null;
let rangeLabelEl = null;
let undatedChip = null;
let clientSelect = null;
let chipsEl = null;

let data = { from: '', to: '', posts: [], undated: [], capacities: [], fallback: false };
let loading = false;
let errorMsg = '';
let expanded = '';            // 'personKey|weekKey' (un accordion a la vez)
let clientFilter = '';        // client_id o '' = todos
let personFilter = new Set(); // keys de persona; vacio = todas
let renderQueued = false;
let refetchTimer = 0;
let fetchSeq = 0;
let unsubs = [];

// ── Puntos y personas ────────────────────────────────────────────────────────

function pointsOf(p) {
  const ep = Number(p && p.effort_points);
  if (p && p.effort_points !== null && p.effort_points !== undefined && Number.isFinite(ep) && ep >= 0) {
    return ep;
  }
  return effortOf(p, EFFORT_MAP);
}

function personKeyOf(p) {
  const name = String((p && p.assignee) || '').trim();
  return name ? name.toLowerCase() : SIN_KEY;
}

function capacityFor(name) {
  const key = String(name || '').trim().toLowerCase();
  const row = (data.capacities || []).find(
    (c) => String(c.assignee || '').trim().toLowerCase() === key
  );
  const n = row ? Number(row.weekly_points) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nivel del semaforo 80/100. 'none' = sin capacidad definida. */
function levelOf(points, capacity) {
  if (!capacity) return 'none';
  const r = points / capacity;
  if (r > 1) return 'over';
  if (r >= 0.8) return 'warn';
  return 'ok';
}

/** Etiqueta '9 - 15 jun' de una semana ISO. */
function weekLabel(fromIso) {
  const a = parseISO(fromIso);
  const b = addDays(a, 6);
  if (!a || !b) return '';
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} - ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`;
  return `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} - ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`;
}

/** Las 4 semanas visibles: [{from, to, key, label}]. */
function visibleWeeks() {
  const out = [];
  for (let i = 0; i < WEEKS_VISIBLE; i++) {
    const from = addDaysISO(data.from, i * 7);
    out.push({ from, to: addDaysISO(from, 6), key: from, label: weekLabel(from) });
  }
  return out;
}

function filteredPosts() {
  let list = data.posts || [];
  if (clientFilter) list = list.filter((p) => p.client_id === clientFilter);
  if (personFilter.size) list = list.filter((p) => personFilter.has(personKeyOf(p)));
  return list;
}

/**
 * Agregacion persona x semana (la regla vive SOLO aqui en el frontend):
 * [{key, name, total, count, anyOver, weeks: Map<weekKey, {points, count, posts[]}>}]
 * con "Sin asignar" primero y el resto alfabetico.
 */
function aggregate(weeks) {
  const byPerson = new Map();
  const wkIndex = new Map(weeks.map((w) => [w.key, w]));
  for (const p of filteredPosts()) {
    if (!p.publish_date) continue;
    const monday = startOfWeek(String(p.publish_date).slice(0, 10));
    if (!monday) continue;
    const wkKey = toISO(monday);
    if (!wkIndex.has(wkKey)) continue;
    const key = personKeyOf(p);
    if (!byPerson.has(key)) {
      byPerson.set(key, {
        key,
        name: key === SIN_KEY ? T('Sin asignar', 'Unassigned') : String(p.assignee).trim(),
        total: 0,
        count: 0,
        weeks: new Map(),
      });
    }
    const person = byPerson.get(key);
    if (!person.weeks.has(wkKey)) person.weeks.set(wkKey, { points: 0, count: 0, posts: [] });
    const bucket = person.weeks.get(wkKey);
    const pts = pointsOf(p);
    bucket.points += pts;
    bucket.count += 1;
    bucket.posts.push(p);
    person.total += pts;
    person.count += 1;
  }
  const rows = [...byPerson.values()];
  for (const person of rows) {
    const cap = person.key === SIN_KEY ? null : capacityFor(person.name);
    person.capacity = cap;
    person.anyOver = false;
    if (cap) {
      for (const [, b] of person.weeks) {
        if (b.points > cap) { person.anyOver = true; break; }
      }
    }
  }
  rows.sort((a, b) => {
    if (a.key === SIN_KEY) return -1;
    if (b.key === SIN_KEY) return 1;
    return a.name.localeCompare(b.name, 'es');
  });
  return rows;
}

/** Personas conocidas (posts + capacidades guardadas) para filtros y sheet. */
function knownPersons() {
  const map = new Map(); // key -> nombre visible
  for (const p of data.posts || []) {
    const name = String(p.assignee || '').trim();
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
  }
  for (const c of data.capacities || []) {
    const name = String(c.assignee || '').trim();
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
  }
  return [...map.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ── Datos ────────────────────────────────────────────────────────────────────

function defaultRange() {
  const monday = startOfWeek(todayISO());
  const from = toISO(monday);
  return { from, to: addDaysISO(from, WEEKS_VISIBLE * 7 - 1) };
}

async function fetchData({ silent = false } = {}) {
  const seq = ++fetchSeq;
  if (!silent) { loading = true; errorMsg = ''; scheduleRender(); }
  try {
    let res = null;
    try {
      res = await api.get(`/workload?from=${encodeURIComponent(data.from)}&to=${encodeURIComponent(data.to)}`);
      if (seq !== fetchSeq) return;
      data.fallback = false;
    } catch (e) {
      // Backend v2 sin desplegar: degradacion con endpoints existentes.
      if (e && (e.status === 404 || e.status === 405)) {
        res = await fallbackFetch();
        if (seq !== fetchSeq) return;
        data.fallback = true;
      } else {
        throw e;
      }
    }
    data.posts = Array.isArray(res && res.posts) ? res.posts : [];
    data.undated = Array.isArray(res && res.undated) ? res.undated : [];
    data.capacities = Array.isArray(res && res.capacities) ? res.capacities : [];
    loading = false;
    errorMsg = '';
  } catch (e) {
    if (seq !== fetchSeq) return;
    loading = false;
    errorMsg = (e && e.message) || T('No se pudo cargar la carga de trabajo.', "Couldn't load the workload.");
    if (!silent) ctx.toast(errorMsg, { type: 'error' });
  }
  scheduleRender();
}

/** Sin GET /workload: un fetch por cliente + capacities best-effort. */
async function fallbackFetch() {
  const clients = (ctx.store.getState().clients || []).filter((c) => !c.archived);
  const lists = await Promise.all(clients.map((c) =>
    api.get(`/posts?client_id=${encodeURIComponent(c.id)}`)
      .then((r) => (Array.isArray(r) ? r : (r && r.posts) || []).map((p) => ({
        ...p, client_name: c.name, brand_color: c.brand_color,
      })))
      .catch(() => [])
  ));
  const all = lists.flat();
  const inRange = (p) => {
    const d = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
    return d && d >= data.from && d <= data.to;
  };
  let capacities = [];
  try {
    const r = await api.get('/capacities');
    capacities = Array.isArray(r) ? r : (r && r.capacities) || [];
  } catch { capacities = []; }
  return {
    posts: all.filter(inRange),
    undated: all.filter((p) => !p.publish_date).slice(0, 100),
    capacities,
  };
}

function scheduleRefetch() {
  clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => { fetchData({ silent: true }); }, 900);
}

// ── Mutaciones locales (optimista + rollback + toast + refetch) ──────────────

async function patchLocal(postId, fields, { undoable = true } = {}) {
  // Snapshot del ctx: la vista puede desmontarse mientras el PATCH vuela.
  const c = ctx;
  const idx = (data.posts || []).findIndex((p) => String(p.id) === String(postId));
  if (idx === -1) return false;
  const prevPost = data.posts[idx];
  const prevFields = {};
  for (const k of Object.keys(fields)) prevFields[k] = prevPost[k] === undefined ? null : prevPost[k];

  // Optimista: arreglo NUEVO, recalcula barras en vivo.
  data.posts = data.posts.map((p, i) => (i === idx ? { ...p, ...fields } : p));
  scheduleRender();

  try {
    const res = await api.patch(`/posts/${postId}`, fields);
    // Reconcilia el estado local con la respuesta del servidor (spread sobre
    // el post local para conservar client_name/brand_color, que el PATCH no
    // siempre devuelve).
    const updated = (res && res.post) || res;
    const full = updated && updated.id ? updated : null;
    if (full) {
      data.posts = data.posts.map((p) => (String(p.id) === String(full.id) ? { ...p, ...full } : p));
      scheduleRender();
    }

    // Sincroniza el store global (mismo patron que mywork.js): Calendario/
    // Tablero/Tabla leen store.posts y NO recargan al volver si ?cliente= no
    // cambia, asi que sin esto verian la fecha/responsable ANTERIORES.
    // upsertPost SOLO si el post ya vive en store.posts: evita hacer push de
    // posts cross-cliente (store.posts es solo del cliente activo). NO usar
    // store.patchPost por la misma razon (su replacePost hace push si falta).
    if (c && c.store) {
      const st = c.store.getState();
      const inStore = (st.posts || []).find((p) => String(p.id) === String(postId));
      if (inStore) c.store.upsertPost(full || { ...inStore, ...fields });
      c.store.emit('posts:changed');
      c.store.emit('mutated');
      c.store.refreshClientCounts();
    }

    if (c) {
      c.toast(T('Guardado.', 'Saved.'), {
        type: 'success',
        action: undoable ? {
          label: T('Deshacer', 'Undo'),
          onAction: () => { patchLocal(postId, prevFields, { undoable: false }); },
        } : null,
      });
    }
    scheduleRefetch();
    return true;
  } catch (e) {
    data.posts = data.posts.map((p) => (String(p.id) === String(postId) ? { ...p, ...prevFields } : p));
    scheduleRender();
    if (c) c.toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return false;
  }
}

// ── Acciones del drill-down ──────────────────────────────────────────────────

async function actionMoveDate(post) {
  const v = await ctx.pickers.pickDate({
    current: post.publish_date ? String(post.publish_date).slice(0, 10) : null,
    title: T('Mover fecha', 'Move date'),
    allowClear: false,
  });
  if (v === null || v === '' || v === post.publish_date) return;
  patchLocal(post.id, { publish_date: v });
}

async function actionReassign(post) {
  const users = await ctx.store.loadUsers();
  const r = await ctx.pickers.pickPerson({
    current: String(post.assignee || '').trim(),
    users: users || [],
    title: T('Reasignar', 'Reassign'),
  });
  if (r === null) return;
  patchLocal(post.id, { assignee: r.name || null, assignee_user_id: r.user_id || null });
}

function actionOpen(post) {
  const { activeClientId } = ctx.store.getState();
  if (post.client_id && post.client_id !== activeClientId && activeClientId !== 'todos') {
    ctx.selectClient(post.client_id);
  }
  ctx.openEditor(post.id);
}

// ── Sheets ───────────────────────────────────────────────────────────────────

function openUndatedSheet() {
  const items = data.undated || [];
  ctx.sheet.openSheet({
    title: `${T('Sin fecha', 'No date')} (${items.length})`,
    mode: 'menu',
    build(body) {
      body.appendChild(el('p', {
        class: 'help wl-undated-note',
        text: T('Estos contenidos no tienen fecha de publicacion, asi que no se reparten en ninguna semana.', "These items have no publish date, so they don't count toward any week."),
      }));
      if (!items.length) {
        body.appendChild(el('p', { class: 'help', text: T('Todo el contenido tiene fecha.', 'All content has a date.') }));
        return;
      }
      const list = el('div', { class: 'wl-ulist' });
      for (const p of items) {
        list.appendChild(el('button', {
          class: 'wl-uitem', type: 'button',
          onclick: () => actionOpen(p),
        }, [
          el('span', { class: 'wl-uitem__main' }, [
            el('span', { class: 'wl-uitem__title', text: p.title || T('Sin titulo', 'Untitled') }),
            el('span', { class: 'wl-uitem__meta' }, [
              p.client_name ? el('span', { class: 'wl-uitem__client', text: p.client_name }) : null,
              chip(p.content_type),
              statusBadge(p.status),
            ]),
          ]),
          icon('right', 16),
        ]));
      }
      body.appendChild(list);
    },
  });
}

function openCapacitiesSheet() {
  const persons = knownPersons();
  ctx.sheet.openSheet({
    title: T('Capacidades semanales', 'Weekly capacities'),
    mode: 'form',
    build(body, close) {
      body.appendChild(el('p', {
        class: 'help wl-cap-help',
        text: T('1 punto = pieza simple. Reel 3, carrusel 2, historia 1. Sugerido: 10 puntos por semana.', '1 point = simple piece. Reel 3, carousel 2, story 1. Suggested: 10 points per week.'),
      }));

      if (!persons.length) {
        body.appendChild(el('p', { class: 'help', text: T('Aun no hay responsables detectados. Asigna contenidos primero.', 'No assignees detected yet. Assign content first.') }));
        return;
      }

      const inputs = new Map(); // name visible -> input
      const list = el('div', { class: 'wl-cap-list' });
      for (const person of persons) {
        const cap = capacityFor(person.name);
        const input = el('input', {
          class: 'input wl-cap-input', type: 'number',
          inputmode: 'numeric', min: '0', max: '100', step: '1',
          placeholder: '10',
          'aria-label': T(`Puntos por semana de ${person.name}`, `Weekly points for ${person.name}`),
        });
        if (cap !== null) input.value = String(cap);
        inputs.set(person.name, { input, before: cap });
        list.appendChild(el('div', { class: 'wl-cap-row' }, [
          avatar(person.name, true),
          el('span', { class: 'wl-cap-row__name', text: person.name }),
          input,
          el('span', { class: 'wl-cap-row__unit', text: T('pts/sem', 'pts/wk') }),
        ]));
      }
      body.appendChild(list);

      const saveBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
        onclick: async () => {
          const changes = [];
          for (const [name, { input, before } ] of inputs) {
            const raw = input.value.trim();
            if (raw === '') continue;
            const n = Math.round(Number(raw));
            if (!Number.isFinite(n) || n < 0 || n > 100) {
              ctx.toast(T(`Capacidad de ${name}: usa un numero entre 0 y 100.`, `Capacity for ${name}: use a number between 0 and 100.`), { type: 'error' });
              try { input.focus(); } catch { /* noop */ }
              return;
            }
            if (n !== before) changes.push({ assignee: name, weekly_points: n });
          }
          if (!changes.length) { close({ source: 'noop' }); return; }
          saveBtn.dataset.loading = 'true';
          try {
            for (const c of changes) {
              await api.post('/capacities', c);
            }
            // Refleja en local sin esperar al refetch.
            const byKey = new Map((data.capacities || []).map((c) => [String(c.assignee || '').trim().toLowerCase(), c]));
            for (const c of changes) byKey.set(c.assignee.trim().toLowerCase(), c);
            data.capacities = [...byKey.values()];
            ctx.toast(T('Capacidades guardadas.', 'Capacities saved.'), { type: 'success' });
            close({ source: 'save' });
            scheduleRender();
            scheduleRefetch();
          } catch (e) {
            ctx.toast((e && e.message) || ERR_SAVE, { type: 'error' });
          } finally {
            delete saveBtn.dataset.loading;
          }
        },
      });
      body.appendChild(el('div', { class: 'sheet__footer' }, [
        el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
        saveBtn,
      ]));
    },
  });
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function shiftWeeks(dir) {
  data.from = addDaysISO(data.from, dir * WEEKS_VISIBLE * 7);
  data.to = addDaysISO(data.from, WEEKS_VISIBLE * 7 - 1);
  expanded = '';
  fetchData();
}

function buildToolbar() {
  const prevBtn = el('button', {
    class: 'wl-ctl', type: 'button', 'aria-label': T('4 semanas anteriores', 'Previous 4 weeks'),
    onclick: () => shiftWeeks(-1),
  }, [icon('left', 18)]);
  const nextBtn = el('button', {
    class: 'wl-ctl', type: 'button', 'aria-label': T('4 semanas siguientes', 'Next 4 weeks'),
    onclick: () => shiftWeeks(1),
  }, [icon('right', 18)]);
  const nowBtn = el('button', {
    class: 'btn btn-sm', type: 'button', text: T('Esta semana', 'This week'),
    onclick: () => {
      const r = defaultRange();
      data.from = r.from;
      data.to = r.to;
      expanded = '';
      fetchData();
    },
  });

  rangeLabelEl = el('span', { class: 'wl-range', 'aria-live': 'polite' });

  undatedChip = el('button', {
    class: 'wl-chip-btn', type: 'button', hidden: true, 'aria-haspopup': 'dialog',
    onclick: () => openUndatedSheet(),
  });

  const capBtn = el('button', {
    class: 'wl-ctl', type: 'button', 'aria-label': T('Capacidades', 'Capacities'), 'aria-haspopup': 'dialog',
    onclick: () => openCapacitiesSheet(),
  }, [icon('settings', 18)]);

  clientSelect = el('select', { class: 'select wl-client', 'aria-label': T('Filtrar por cliente', 'Filter by client') });
  clientSelect.addEventListener('change', () => {
    clientFilter = clientSelect.value;
    expanded = '';
    scheduleRender();
  });

  chipsEl = el('div', { class: 'wl-chips', role: 'group', 'aria-label': T('Filtrar por persona', 'Filter by person') });

  return el('div', { class: 'wl-toolbar' }, [
    el('div', { class: 'wl-toolbar__row' }, [
      el('div', { class: 'wl-toolbar__nav' }, [prevBtn, nowBtn, nextBtn]),
      rangeLabelEl,
      el('div', { class: 'wl-toolbar__spacer' }),
      undatedChip,
      capBtn,
    ]),
    el('div', { class: 'wl-toolbar__row wl-toolbar__row--filters' }, [clientSelect, chipsEl]),
  ]);
}

function updateToolbar() {
  rangeLabelEl.textContent = `${fmtShort(data.from)} ${T('al', 'to')} ${fmtShort(data.to)}`;

  const n = (data.undated || []).length;
  undatedChip.hidden = n === 0;
  undatedChip.textContent = `${T('Sin fecha', 'No date')} (${n})`;

  // Select de clientes (rebuild barato, conserva el valor).
  const clients = (ctx.store.getState().clients || []).filter((c) => !c.archived);
  clear(clientSelect);
  clientSelect.appendChild(el('option', { value: '', text: T('Todos los clientes', 'All clients') }));
  for (const c of clients) clientSelect.appendChild(el('option', { value: c.id, text: c.name }));
  clientSelect.value = clientFilter && clients.some((c) => c.id === clientFilter) ? clientFilter : '';
  if (clientSelect.value !== clientFilter) clientFilter = clientSelect.value;

  // Chips de persona.
  clear(chipsEl);
  const persons = knownPersons();
  if (persons.length > 1) {
    const allChip = el('button', {
      class: 'wl-pchip' + (personFilter.size === 0 ? ' is-active' : ''),
      type: 'button', text: T('Todas', 'All'),
      'aria-pressed': personFilter.size === 0 ? 'true' : 'false',
      onclick: () => { personFilter.clear(); scheduleRender(); },
    });
    chipsEl.appendChild(allChip);
    for (const person of persons) {
      const active = personFilter.has(person.key);
      chipsEl.appendChild(el('button', {
        class: 'wl-pchip' + (active ? ' is-active' : ''),
        type: 'button', text: person.name,
        'aria-pressed': active ? 'true' : 'false',
        onclick: () => {
          if (personFilter.has(person.key)) personFilter.delete(person.key);
          else personFilter.add(person.key);
          scheduleRender();
        },
      }));
    }
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

function buildWeekRow(person, week, bucket, index) {
  const pts = bucket ? bucket.points : 0;
  const count = bucket ? bucket.count : 0;
  const cap = person.capacity;
  const level = person.key === SIN_KEY ? 'none' : levelOf(pts, cap);
  const pct = cap ? Math.min(100, Math.round((pts / cap) * 100)) : (pts > 0 ? 100 : 0);
  const isOpen = expanded === `${person.key}|${week.key}`;

  const valueTxt = cap ? `${pts}/${cap} pts` : `${pts} pts`;
  const stateTxt =
    level === 'over' ? T('Sobrecarga', 'Overloaded') :
    level === 'warn' ? T('Casi llena', 'Almost full') :
    level === 'ok' ? T('Con espacio', 'Has room') :
    (person.key === SIN_KEY ? '' : T('Define su capacidad', 'Set their capacity'));

  const row = el('button', {
    class: 'wl-week' + (isOpen ? ' is-open' : ''),
    type: 'button',
    dataset: { level },
    'aria-expanded': isOpen ? 'true' : 'false',
    'aria-label': `${person.name}, ${T('semana', 'week')} ${week.label}: ${valueTxt}${stateTxt ? `, ${stateTxt}` : ''}. ${count} ${T('contenidos', 'items')}`,
    onclick: () => {
      expanded = isOpen ? '' : `${person.key}|${week.key}`;
      scheduleRender();
    },
  }, [
    el('span', { class: 'wl-week__label', text: week.label }),
    el('span', { class: 'wl-week__bar', 'aria-hidden': 'true' }, [
      el('span', { class: 'wl-week__fill', style: { width: `${pct}%` } }),
    ]),
    el('span', { class: 'wl-week__value', text: valueTxt }),
    stateTxt && level !== 'ok' ? el('span', { class: 'wl-week__state', text: stateTxt }) : null,
  ]);
  row.style.gridColumn = String(index + 2);
  row.style.gridRow = '1';
  return row;
}

function buildExpand(person, week, bucket) {
  const panel = el('div', { class: 'wl-expand' });
  const posts = (bucket ? bucket.posts : []).slice()
    .sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date)));

  if (!posts.length) {
    panel.appendChild(el('p', { class: 'help', text: T('Sin contenidos esa semana.', 'No content that week.') }));
    return panel;
  }

  for (const p of posts) {
    const dot = el('span', {
      class: 'wl-post__dot', 'aria-hidden': 'true',
      style: { background: p.brand_color || 'var(--brand)' },
    });
    panel.appendChild(el('div', { class: 'wl-post' }, [
      el('div', { class: 'wl-post__main' }, [
        el('div', { class: 'wl-post__head' }, [
          dot,
          p.client_name ? el('span', { class: 'wl-post__client', text: p.client_name }) : null,
          el('span', { class: 'wl-post__pts', text: `${pointsOf(p)} pts` }),
        ]),
        el('div', { class: 'wl-post__title', text: p.title || T('Sin titulo', 'Untitled') }),
        el('div', { class: 'wl-post__meta' }, [
          statusBadge(p.status),
          el('span', { class: 'wl-post__date', text: fmtShort(p.publish_date) }),
        ]),
      ]),
      el('div', { class: 'wl-post__actions' }, [
        el('button', { class: 'wl-act', type: 'button', onclick: () => actionMoveDate(p) }, [icon('calendar', 16), T('Mover fecha', 'Move date')]),
        el('button', { class: 'wl-act', type: 'button', onclick: () => actionReassign(p) }, [icon('user', 16), T('Reasignar', 'Reassign')]),
        el('button', { class: 'wl-act', type: 'button', onclick: () => actionOpen(p) }, [icon('edit', 16), T('Abrir', 'Open')]),
      ]),
    ]));
  }
  return panel;
}

function buildPerson(person, weeks) {
  const head = el('div', { class: 'wl-person__head' }, [
    avatar(person.key === SIN_KEY ? '?' : person.name, true),
    el('span', { class: 'wl-person__name', text: person.name }),
    el('span', { class: 'wl-person__total', text: `${person.total} pts` }),
    person.anyOver ? el('span', { class: 'wl-badge', text: T('Sobrecarga', 'Overloaded') }) : null,
  ]);

  const card = el('section', {
    class: 'wl-person' + (person.anyOver ? ' is-over' : ''),
    'aria-label': `${person.name}, ${person.total} ${T('puntos en el periodo', 'points in the period')}`,
  });
  card.appendChild(head);

  weeks.forEach((week, i) => {
    const bucket = person.weeks.get(week.key) || null;
    card.appendChild(buildWeekRow(person, week, bucket, i));
    if (expanded === `${person.key}|${week.key}`) {
      card.appendChild(buildExpand(person, week, bucket));
    }
  });
  return card;
}

function render() {
  if (!rootEl || !rootEl.isConnected) return;
  updateToolbar();
  clear(bodyEl);

  if (loading) {
    const skel = el('div', { class: 'wl-skel-wrap', 'aria-hidden': 'true' });
    for (let i = 0; i < 3; i++) skel.appendChild(el('div', { class: 'wl-skel' }));
    bodyEl.appendChild(skel);
    return;
  }

  if (errorMsg) {
    bodyEl.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon' }, [icon('warning', 30)]),
      el('h3', { text: T('No se pudo cargar', "Couldn't load") }),
      el('p', { text: errorMsg }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'),
        onclick: () => fetchData(),
      }),
    ]));
    return;
  }

  const weeks = visibleWeeks();
  const rows = aggregate(weeks);

  if (!rows.length) {
    bodyEl.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon' }, [icon('gauge', 30)]),
      el('h3', { text: T('Sin contenidos en estas semanas.', 'No content in these weeks.') }),
      el('p', { text: T('Mueve el rango o programa contenido con fecha de publicacion.', 'Shift the range or schedule content with a publish date.') }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: T('Esta semana', 'This week'),
        onclick: () => {
          const r = defaultRange();
          data.from = r.from;
          data.to = r.to;
          fetchData();
        },
      }),
    ]));
    return;
  }

  // Cabecera de semanas (solo visible en el layout tabla de desktop).
  const headRow = el('div', { class: 'wl-headrow', 'aria-hidden': 'true' });
  headRow.appendChild(el('span', { class: 'wl-headrow__person', text: T('Persona', 'Person') }));
  weeks.forEach((w, i) => {
    const cell = el('span', { class: 'wl-headrow__week', text: w.label });
    cell.style.gridColumn = String(i + 2);
    headRow.appendChild(cell);
  });
  bodyEl.appendChild(headRow);

  for (const person of rows) bodyEl.appendChild(buildPerson(person, weeks));

  bodyEl.appendChild(el('p', {
    class: 'help wl-rule-note',
    text: T('Regla de reparto: los puntos de cada contenido cuentan completos en la semana de su fecha de publicacion.', "Distribution rule: each item's points count fully in the week of its publish date."),
  }));
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'carga',

  mount(host, c) {
    ctx = c;
    const r = defaultRange();
    data = { from: r.from, to: r.to, posts: [], undated: [], capacities: [], fallback: false };
    loading = true;
    errorMsg = '';
    expanded = '';
    clientFilter = '';
    personFilter = new Set();

    bodyEl = el('div', { class: 'wl-body' });
    rootEl = el('div', { class: 'wl-root' }, [buildToolbar(), bodyEl]);
    host.appendChild(rootEl);

    unsubs.push(ctx.store.subscribe(['clients'], scheduleRender));

    render();
    fetchData();
  },

  onParams() {
    scheduleRender();
  },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    clearTimeout(refetchTimer);
    refetchTimer = 0;
    fetchSeq++;
    rootEl = null;
    bodyEl = null;
    rangeLabelEl = null;
    undatedChip = null;
    clientSelect = null;
    chipsEl = null;
    ctx = null;
  },
};
