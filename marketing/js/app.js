// ============================================================================
// IVAE Marketing — TEAM dashboard (app.html).
// Vanilla ES module. Reuses everything from api.js (api, el, clear, toast,
// copyText, date utils, ENUM maps, chip/statusBadge/approvalBadge/avatar).
//
// Structure:
//   1. Imports + module state
//   2. Tiny helpers (icons, skeletons, empties, overlays)
//   3. Boot / auth-gate
//   4. Shell: sidebar + topbar
//   5. Views: Calendar · Board · List
//   6. Post editor (drawer) + comments
//   7. Modals: New client · Client edit · Team · Activity · Confirm
//   8. Data loading + search + view routing
// ============================================================================

import {
  api, el, clear, toast, copyText,
  parseDate, ymd, fmtDate, fmtDateTime, timeAgo, initials,
  CONTENT_TYPES, CONTENT_TYPE_ORDER, contentTypeLabel,
  STATUSES, STATUS_ORDER, statusLabel,
  APPROVALS, approvalLabel,
  PLATFORMS, GRABACION_LEVELS,
  chip, statusBadge, approvalBadge, avatar,
} from '/marketing/js/api.js';

// ── 1. STATE ────────────────────────────────────────────────────────────────
const state = {
  me: null,                // current user {id,email,name,role,client_id}
  clients: [],             // [{id,name,brand_color,...,counts:{posts,pending}}]
  users: [],               // team mgmt cache (loaded on demand)
  activeClientId: null,    // currently selected client
  view: 'calendar',        // 'calendar' | 'board' | 'list'
  posts: [],               // posts for the active client
  search: '',              // search query (title/caption)
  calMonth: startOfMonth(new Date()),
  sort: { key: 'publish_date', dir: 'asc' },
  loading: false,
};

const LS_VIEW   = 'mkt.view';
const LS_CLIENT = 'mkt.client';

// DOM handles
const $boot     = document.getElementById('boot');
const $app      = document.getElementById('app');
const $sidebar  = document.getElementById('sidebar');
const $sideOv   = document.getElementById('sidebarOverlay');
const $topbar   = document.getElementById('topbar');
const $view     = document.getElementById('view');
const $edOv     = document.getElementById('editorOverlay');
const $edDrawer = document.getElementById('editorDrawer');
const $mOv      = document.getElementById('modalOverlay');
const $modal    = document.getElementById('modal');

// ── 2. HELPERS ───────────────────────────────────────────────────────────────

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const esc = (s) => String(s == null ? '' : s);
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// SVG icon factory (stroke icons, 24-grid). Returns a <span class="ico">.
const ICONS = {
  menu:     'M4 7h16M4 12h16M4 17h16',
  close:    'M6 6l12 12M18 6L6 18',
  plus:     'M12 5v14M5 12h14',
  search:   'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  calendar: 'M3 9h18M7 3v3M17 3v3M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  board:    'M4 4h6v16H4zM14 4h6v9h-6z',
  list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  users:    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  logout:   'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  trash:    'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  copy:     'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  left:     'M15 18l-6-6 6-6',
  right:    'M9 18l6-6-6-6',
  edit:     'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  archive:  'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  link:     'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  send:     'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  key:      'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7-7 5 5 0 0 1 7 7zM15 7l3 3M18 4l3 3',
  spark:    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};
function icon(name, cls = 'ico') {
  const path = ICONS[name] || '';
  const span = el('span', { class: cls });
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
    path.split('M').filter(Boolean).map((p) => `<path d="M${p.trim()}"/>`).join('')
  }</svg>`;
  return span;
}

function logoLockup() {
  const mark = el('span', { class: 'logo__mark', 'aria-hidden': 'true' });
  mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.2"/></svg>`;
  return el('span', { class: 'logo' }, [
    mark,
    el('span', { class: 'logo__word' }, [
      el('b', { text: 'IVAE' }),
      el('span', { class: 'grad-text', text: 'Marketing' }),
    ]),
  ]);
}

function emptyState(title, msg, action) {
  const sp = icon('spark', 'ico'); sp.firstChild.setAttribute('width', '28'); sp.firstChild.setAttribute('height', '28');
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty__icon' }, [sp]),
    el('h3', { text: title }),
    msg ? el('p', { text: msg }) : null,
    action || null,
  ]);
}

function skeletonLines(n = 5) {
  const wrap = el('div', { class: 'card card--pad' });
  for (let i = 0; i < n; i++) {
    wrap.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: (60 + (i * 7) % 40) + '%' } }));
  }
  return wrap;
}

// ── Overlay open/close (drawer + modal) ──
const _clearTimers = new WeakMap();
function openOverlay(ov, panel) {
  // Cancel any pending post-close clear so re-opening within the close window
  // doesn't wipe freshly rendered content.
  const t = _clearTimers.get(panel); if (t) { clearTimeout(t); _clearTimers.delete(panel); }
  ov.classList.add('is-open'); requestAnimationFrame(() => panel.classList.add('is-open')); document.body.style.overflow = 'hidden';
}
function closeOverlay(ov, panel) {
  panel.classList.remove('is-open'); ov.classList.remove('is-open'); document.body.style.overflow = '';
  const t = setTimeout(() => { if (!panel.classList.contains('is-open')) clear(panel); _clearTimers.delete(panel); }, 220);
  _clearTimers.set(panel, t);
}

function openEditor()  { openOverlay($edOv, $edDrawer); }
function closeEditor() { closeOverlay($edOv, $edDrawer); }
function openModal()   { openOverlay($mOv, $modal); }
function closeModal()  { closeOverlay($mOv, $modal); }

$edOv.addEventListener('click', closeEditor);
$mOv.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($edDrawer.classList.contains('is-open')) closeEditor();
  else if ($modal.classList.contains('is-open')) closeModal();
  else if ($sidebar.classList.contains('is-open')) toggleSidebar(false);
});

// Field builders (return a .field) ─────────────────────────────────────────────
function field(labelText, control, { req = false, help } = {}) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'label' }, [labelText, req ? el('span', { class: 'req', text: ' *' }) : null]),
    control,
    help ? el('div', { class: 'help', text: help }) : null,
  ]);
}
function selectFrom(options, value, attrs = {}) {
  const sel = el('select', { class: 'select', ...attrs });
  for (const o of options) {
    const val = typeof o === 'object' ? o.value : o;
    const lab = typeof o === 'object' ? o.label : o;
    sel.appendChild(el('option', { value: val, selected: String(val) === String(value) }, [lab]));
  }
  return sel;
}

// ── 3. BOOT / AUTH GATE ──────────────────────────────────────────────────────
async function boot() {
  let me;
  try {
    me = await api.get('/auth/me');
  } catch (err) {
    // 401 or any auth failure → login
    location.replace('/marketing/');
    return;
  }
  if (!me || !me.role) { location.replace('/marketing/'); return; }
  if (me.role === 'client') { location.replace('/marketing/client.html'); return; }

  state.me = me;
  // Restore last view/client preference.
  const savedView = localStorage.getItem(LS_VIEW);
  if (savedView && ['calendar', 'board', 'list'].includes(savedView)) state.view = savedView;

  renderShellChrome();
  $boot.classList.add('is-hidden');
  $app.hidden = false;
  setTimeout(() => $boot.remove(), 350);

  await loadClients();
}

// ── 4. SHELL ─────────────────────────────────────────────────────────────────
function renderShellChrome() {
  renderSidebar();
  renderTopbar();
}

function toggleSidebar(open) {
  const willOpen = open == null ? !$sidebar.classList.contains('is-open') : open;
  $sidebar.classList.toggle('is-open', willOpen);
  $sideOv.hidden = false;
  $sideOv.classList.toggle('is-open', willOpen);
  if (!willOpen) setTimeout(() => { if (!$sidebar.classList.contains('is-open')) $sideOv.hidden = true; }, 220);
}
$sideOv.addEventListener('click', () => toggleSidebar(false));

function renderSidebar() {
  clear($sidebar);

  // Head: logo + mobile close
  const closeBtn = el('button', { class: 'drawer__close', 'aria-label': 'Cerrar menú', onclick: () => toggleSidebar(false) }, [icon('close')]);
  $sidebar.appendChild(el('div', { class: 'sidebar__head' }, [logoLockup(), closeBtn]));

  // Body: clients
  const body = el('div', { class: 'sidebar__body' });
  body.appendChild(el('div', { class: 'sidebar__section-label', text: 'Clientes' }));

  const list = el('div', { id: 'clientList' });
  body.appendChild(list);
  renderClientList(list);

  body.appendChild(el('button', {
    class: 'nav-item', style: { marginTop: 'var(--s-2)' },
    onclick: () => openClientModal(),
  }, [icon('plus'), 'Nuevo cliente']));

  $sidebar.appendChild(body);

  // Foot: team / activity / user + logout
  const foot = el('div', { class: 'sidebar__foot' });
  foot.appendChild(el('button', { class: 'nav-item', onclick: () => openTeamModal() }, [icon('users'), 'Equipo']));
  foot.appendChild(el('button', { class: 'nav-item', onclick: () => openActivityModal() }, [icon('activity'), 'Actividad']));

  const userRow = el('div', { class: 'nav-item', style: { cursor: 'default', marginTop: 'var(--s-2)' } }, [
    avatar(state.me.name),
    el('span', { class: 'grow truncate' }, [
      el('div', { class: 'truncate', style: { fontWeight: '600', color: 'var(--text)' }, text: state.me.name }),
      el('div', { class: 'truncate', style: { fontSize: '11.5px', color: 'var(--text-mute)' }, text: cap(state.me.role) }),
    ]),
    el('button', { class: 'btn-ghost btn btn-icon', title: 'Salir', 'aria-label': 'Salir', onclick: doLogout }, [icon('logout')]),
  ]);
  foot.appendChild(userRow);

  $sidebar.appendChild(foot);
}

function renderClientList(container) {
  clear(container);
  const active = state.clients.filter((c) => !c.archived);
  if (!active.length) {
    container.appendChild(el('div', { class: 'help', style: { padding: '8px 10px' }, text: 'Aún no hay clientes. Crea el primero.' }));
    return;
  }
  for (const c of active) {
    const pending = c.counts && c.counts.pending ? c.counts.pending : 0;
    const itm = el('button', {
      class: 'nav-item' + (c.id === state.activeClientId ? ' is-active' : ''),
      onclick: () => selectClient(c.id),
    }, [
      el('span', { class: 'dot', 'data-brand': '', style: { background: c.brand_color || 'var(--brand)', boxShadow: '0 0 0 3px ' + hexA(c.brand_color || '#8b5cf6', .18) } }),
      el('span', { class: 'grow truncate', text: c.name }),
      pending ? el('span', { class: 'count', title: pending + ' por aprobar', text: String(pending) }) : null,
    ]);
    container.appendChild(itm);
  }
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(139,92,246,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function renderTopbar() {
  clear($topbar);
  const client = activeClient();

  const menuBtn = el('button', { class: 'menu-btn btn btn-icon btn-ghost', 'aria-label': 'Abrir menú', onclick: () => toggleSidebar(true) }, [icon('menu')]);

  const title = el('div', { class: 'topbar__client topbar__title' }, [
    client ? el('span', { class: 'dot', style: { background: client.brand_color || 'var(--brand)' } }) : null,
    el('span', { class: 'truncate', text: client ? client.name : 'IVAE Marketing' }),
  ]);

  // View switcher
  const seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Vista' }, [
    segBtn('calendar', 'Calendario'),
    segBtn('board', 'Tablero'),
    segBtn('list', 'Lista'),
  ]);

  // Search
  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'Buscar por título o caption',
    value: state.search, 'aria-label': 'Buscar contenido',
    oninput: debounce((e) => { state.search = e.target.value.trim().toLowerCase(); renderView(); }, 180),
  });
  const search = el('div', { class: 'input-wrap search' }, [icon('search'), searchInput]);

  const newBtn = el('button', { class: 'btn btn-primary', onclick: () => openEditorFor(null) }, [icon('plus'), el('span', { text: 'Nuevo contenido' })]);

  $topbar.append(
    menuBtn,
    title,
    el('span', { class: 'topbar__spacer' }),
    seg,
    search,
    newBtn,
  );

  // Disable the content actions if there's no client yet.
  if (!client) { newBtn.setAttribute('aria-disabled', 'true'); searchInput.disabled = true; }
}

function segBtn(view, label) {
  return el('button', {
    role: 'tab', 'aria-selected': String(state.view === view),
    class: state.view === view ? 'is-active' : '',
    onclick: () => setView(view),
    text: label,
  });
}

function setView(view) {
  if (state.view === view) return;
  state.view = view;
  localStorage.setItem(LS_VIEW, view);
  renderTopbar();
  renderView();
}

function activeClient() { return state.clients.find((c) => c.id === state.activeClientId) || null; }

async function doLogout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  location.replace('/marketing/');
}

// ── 8a. DATA LOADING ─────────────────────────────────────────────────────────
async function loadClients() {
  try {
    const clients = await api.get('/clients');
    state.clients = Array.isArray(clients) ? clients : [];
  } catch (err) {
    toast(err.message || 'No pudimos cargar los clientes.', 'error');
    state.clients = [];
  }
  renderSidebar();

  const active = state.clients.filter((c) => !c.archived);
  if (!active.length) {
    state.activeClientId = null;
    renderTopbar();
    $view.replaceChildren(emptyState(
      'Bienvenido a IVAE Marketing',
      'Aún no hay clientes. Crea el primero para empezar a planear contenido.',
      el('button', { class: 'btn btn-primary', onclick: () => openClientModal() }, [icon('plus'), el('span', { text: 'Nuevo cliente' })]),
    ));
    return;
  }

  // Choose active client: saved → first.
  const saved = localStorage.getItem(LS_CLIENT);
  const pick = active.find((c) => c.id === saved) || active[0];
  await selectClient(pick.id, /*silent*/ true);
}

async function selectClient(id, silent = false) {
  state.activeClientId = id;
  localStorage.setItem(LS_CLIENT, id);
  state.search = '';
  renderSidebar();
  renderTopbar();
  await loadPosts();
}

async function loadPosts() {
  const cid = state.activeClientId;
  if (!cid) return;
  state.loading = true;
  $view.replaceChildren(skeletonLines(7));
  try {
    const posts = await api.get('/posts?client_id=' + encodeURIComponent(cid));
    state.posts = Array.isArray(posts) ? posts : [];
  } catch (err) {
    toast(err.message || 'No pudimos cargar el contenido.', 'error');
    state.posts = [];
  }
  state.loading = false;
  renderView();
}

// Refresh counts for the active client after a mutation (best-effort).
async function refreshClientCounts() {
  try {
    const clients = await api.get('/clients');
    if (Array.isArray(clients)) { state.clients = clients; renderSidebar(); renderTopbar(); }
  } catch { /* non-fatal */ }
}

function filteredPosts() {
  const q = state.search;
  if (!q) return state.posts;
  return state.posts.filter((p) =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.caption || '').toLowerCase().includes(q));
}

// ── 8b. VIEW ROUTER ──────────────────────────────────────────────────────────
// Mobile-only controls (seg + search) injected at the top of the scroll area,
// since the phone topbar is a single compact row. CSS (.view-controls) shows
// this only at <=720px and hides the topbar's seg/search there.
function mobileViewControls() {
  const seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Vista' }, [
    segBtn('calendar', 'Calendario'),
    segBtn('board', 'Tablero'),
    segBtn('list', 'Lista'),
  ]);
  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'Buscar por título o caption',
    value: state.search, 'aria-label': 'Buscar contenido',
    oninput: debounce((e) => { state.search = e.target.value.trim().toLowerCase(); renderViewBody(); }, 180),
  });
  return el('div', { class: 'view-controls' }, [seg, el('div', { class: 'input-wrap search' }, [icon('search'), searchInput])]);
}

// A persistent body node; only its contents change on search so input focus is
// preserved. The mobile .view-controls sub-header is a stable sibling above it.
let $viewBody = null;

function renderView() {
  if (!state.activeClientId) return;
  $viewBody = el('div', { id: 'viewBody' });
  $view.replaceChildren(mobileViewControls(), $viewBody);
  renderViewBody();
}

function renderViewBody() {
  if (!state.activeClientId || !$viewBody) return;
  if (state.loading) { $viewBody.replaceChildren(skeletonLines(7)); return; }
  if (state.view === 'calendar') renderCalendar();
  else if (state.view === 'board') renderBoard();
  else renderList();
}

// ── 5a. CALENDAR ─────────────────────────────────────────────────────────────
function renderCalendar() {
  const posts = filteredPosts();
  const wrap = el('div', { class: 'cal' });

  // Head: month nav
  const monthLabel = state.calMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  wrap.appendChild(el('div', { class: 'cal__head' }, [
    el('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'Mes anterior', onclick: () => { state.calMonth = addMonths(state.calMonth, -1); renderCalendar(); } }, [icon('left')]),
    el('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'Mes siguiente', onclick: () => { state.calMonth = addMonths(state.calMonth, 1); renderCalendar(); } }, [icon('right')]),
    el('div', { class: 'cal__month', text: cap(monthLabel) }),
    el('span', { class: 'topbar__spacer' }),
    el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { state.calMonth = startOfMonth(new Date()); renderCalendar(); }, text: 'Hoy' }),
  ]));

  // Group posts by publish_date
  const byDate = new Map();
  for (const p of posts) {
    if (!p.publish_date) continue;
    const k = String(p.publish_date).slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k).push(p);
  }

  // ── Desktop grid ──
  const grid = el('div', { class: 'cal-grid' });
  const dows = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  for (const d of dows) grid.appendChild(el('div', { class: 'cal-grid__dow', text: d }));

  const first = startOfMonth(state.calMonth);
  // Monday-first offset
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - offset);
  const todayStr = ymd(new Date());
  const month = state.calMonth.getMonth();

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    const ds = ymd(d);
    const isOther = d.getMonth() !== month;
    const cell = el('div', { class: 'cal-day' + (isOther ? ' is-other' : '') + (ds === todayStr ? ' is-today' : ''), 'data-date': ds });
    cell.appendChild(el('div', { class: 'cal-day__num', text: String(d.getDate()) }));

    const chips = el('div', { class: 'cal-day__chips' });
    const dayPosts = byDate.get(ds) || [];
    const shown = dayPosts.slice(0, 4);
    for (const p of shown) chips.appendChild(calChip(p));
    if (dayPosts.length > shown.length) {
      chips.appendChild(el('div', { class: 'cal-day__more', text: '+' + (dayPosts.length - shown.length) + ' más', onclick: () => setView('list') }));
    }
    cell.appendChild(chips);

    // Drop target wiring
    makeCalDropTarget(cell, ds);
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);

  // ── Mobile agenda (CSS toggles between grid/agenda at <=720px) ──
  const agenda = el('div', { class: 'agenda' });
  const dates = [...byDate.keys()].sort();
  if (!dates.length) {
    agenda.appendChild(el('div', { class: 'help', text: 'No hay contenido programado este mes.' }));
  }
  for (const ds of dates) {
    const d = parseDate(ds);
    if (!d || d.getMonth() !== month || d.getFullYear() !== state.calMonth.getFullYear()) continue;
    agenda.appendChild(el('div', { class: 'agenda__day-label', text: cap(d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })) }));
    const items = el('div', { class: 'agenda__items' });
    for (const p of byDate.get(ds)) items.appendChild(agendaItem(p));
    agenda.appendChild(items);
  }
  wrap.appendChild(agenda);

  // Empty state if literally no posts at all (any date)
  if (!posts.length) {
    $viewBody.replaceChildren(emptyState(
      'Aún no hay contenido',
      'Crea el primero para empezar a planear el calendario.',
      el('button', { class: 'btn btn-primary', onclick: () => openEditorFor(null) }, [icon('plus'), el('span', { text: 'Nuevo contenido' })]),
    ));
    return;
  }
  $viewBody.replaceChildren(wrap);
}

function calChip(p) {
  const c = el('div', {
    class: 'cal-chip', 'data-type': p.content_type, 'data-id': p.id, draggable: 'true',
    title: p.title, onclick: () => openEditorFor(p.id),
  }, [el('span', { class: 'cal-chip__txt', text: p.title })]);
  c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('is-dragging'); window.__drag = { id: p.id, kind: 'cal' }; });
  c.addEventListener('dragend', () => { c.classList.remove('is-dragging'); window.__drag = null; });
  return c;
}

function agendaItem(p) {
  return el('div', { class: 'agenda-item', onclick: () => openEditorFor(p.id) }, [
    el('div', { class: 'agenda-item__main' }, [
      el('div', { class: 'agenda-item__title truncate', text: p.title }),
      el('div', { class: 'agenda-item__meta' }, [
        chip(p.content_type),
        statusBadge(p.status),
        p.platform ? el('span', { class: 'help', text: p.platform }) : null,
      ]),
    ]),
    approvalBadge(p.approval_state),
  ]);
}

function makeCalDropTarget(cell, ds) {
  cell.addEventListener('dragover', (e) => { if (window.__drag && window.__drag.kind === 'cal') { e.preventDefault(); cell.classList.add('is-drop-target'); } });
  cell.addEventListener('dragleave', () => cell.classList.remove('is-drop-target'));
  cell.addEventListener('drop', async (e) => {
    e.preventDefault();
    cell.classList.remove('is-drop-target');
    const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || (window.__drag && window.__drag.id);
    if (!id) return;
    const post = state.posts.find((p) => p.id === id);
    if (!post || String(post.publish_date).slice(0, 10) === ds) return;
    const prev = post.publish_date;
    post.publish_date = ds; // optimistic
    renderCalendar();
    try {
      await api.post('/posts/reorder', { updates: [{ id, publish_date: ds, position: post.position || 0 }] });
      toast('Fecha actualizada.', 'success', 1800);
      refreshClientCounts();
    } catch (err) {
      post.publish_date = prev; // rollback
      renderCalendar();
      toast(err.message || 'No se pudo mover el contenido.', 'error');
    }
  });
}

// ── 5b. BOARD (kanban) ───────────────────────────────────────────────────────
function renderBoard() {
  const posts = filteredPosts();
  if (!posts.length) {
    $viewBody.replaceChildren(emptyState(
      'Aún no hay contenido',
      'Crea el primero para empezar a moverlo por el flujo.',
      el('button', { class: 'btn btn-primary', onclick: () => openEditorFor(null) }, [icon('plus'), el('span', { text: 'Nuevo contenido' })]),
    ));
    return;
  }

  const byStatus = {};
  for (const s of STATUS_ORDER) byStatus[s] = [];
  for (const p of posts) (byStatus[p.status] || (byStatus[p.status] = [])).push(p);
  for (const s of STATUS_ORDER) byStatus[s].sort((a, b) => (a.position || 0) - (b.position || 0));

  const board = el('div', { class: 'board' });
  for (const s of STATUS_ORDER) {
    const col = el('div', { class: 'board-col', 'data-status': s });
    col.appendChild(el('div', { class: 'board-col__head' }, [
      el('span', { class: 'swatch', style: { background: STATUSES[s].color } }),
      el('span', { class: 'board-col__title', text: statusLabel(s) }),
      el('span', { class: 'board-col__count', text: String(byStatus[s].length) }),
    ]));
    const body = el('div', { class: 'board-col__body' });
    for (const p of byStatus[s]) body.appendChild(boardCard(p));
    makeColDropTarget(col, body, s);
    col.appendChild(body);
    board.appendChild(col);
  }
  $viewBody.replaceChildren(board);
}

function boardCard(p) {
  const card = el('div', { class: 'board-card', 'data-id': p.id, draggable: 'true', onclick: () => openEditorFor(p.id) }, [
    el('div', { class: 'board-card__title', text: p.title }),
    el('div', { class: 'board-card__meta' }, [
      chip(p.content_type),
      p.grabacion ? el('span', { class: 'board-card__grab', title: 'Prioridad de grabación', text: 'G' + p.grabacion }) : null,
    ]),
    el('div', { class: 'board-card__foot' }, [
      p.assignee ? avatar(p.assignee, true) : null,
      p.assignee ? el('span', { class: 'help truncate', text: p.assignee }) : null,
      el('span', { class: 'spacer' }),
      approvalBadge(p.approval_state),
    ]),
  ]);
  card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('is-dragging'); window.__drag = { id: p.id, kind: 'board', from: p.status }; });
  card.addEventListener('dragend', () => { card.classList.remove('is-dragging'); window.__drag = null; document.querySelectorAll('.board-col.is-drop-target').forEach((c) => c.classList.remove('is-drop-target')); });
  return card;
}

function makeColDropTarget(col, body, status) {
  col.addEventListener('dragover', (e) => {
    if (!window.__drag || window.__drag.kind !== 'board') return;
    e.preventDefault();
    col.classList.add('is-drop-target');
    // figure out insertion index from pointer Y
    const after = cardAfterPoint(body, e.clientY);
    const dragging = body.parentElement.querySelector('.is-dragging') || document.querySelector('.board-card.is-dragging');
    if (dragging) {
      if (after == null) body.appendChild(dragging);
      else body.insertBefore(dragging, after);
    }
  });
  col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop-target'); });
  col.addEventListener('drop', async (e) => {
    e.preventDefault();
    col.classList.remove('is-drop-target');
    const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || (window.__drag && window.__drag.id);
    if (!id) return;
    const post = state.posts.find((p) => p.id === id);
    if (!post) return;

    // Compute new order for THIS column from DOM order.
    const ids = [...body.querySelectorAll('.board-card')].map((c) => c.dataset.id);
    const prevStatus = post.status;
    const prevPositions = state.posts.map((p) => ({ id: p.id, status: p.status, position: p.position }));

    // optimistic update
    post.status = status;
    ids.forEach((pid, i) => { const pp = state.posts.find((x) => x.id === pid); if (pp) { pp.status = status; pp.position = i; } });

    const updates = ids.map((pid, i) => ({ id: pid, status, position: i }));
    try {
      await api.post('/posts/reorder', { updates });
      if (prevStatus !== status) toast('Movido a ' + statusLabel(status) + '.', 'success', 1800);
      refreshClientCounts();
      renderBoard();
    } catch (err) {
      // rollback
      for (const pp of prevPositions) { const x = state.posts.find((p) => p.id === pp.id); if (x) { x.status = pp.status; x.position = pp.position; } }
      renderBoard();
      toast(err.message || 'No se pudo mover la tarjeta.', 'error');
    }
  });
}

function cardAfterPoint(body, y) {
  const cards = [...body.querySelectorAll('.board-card:not(.is-dragging)')];
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (y < r.top + r.height / 2) return c;
  }
  return null;
}

// ── 5c. LIST (table) ─────────────────────────────────────────────────────────
const LIST_COLS = [
  { key: 'grabacion',     label: 'Grabación', sortable: true,  cls: 'cell-num' },
  { key: 'content_type',  label: 'Tipo',      sortable: true },
  { key: 'title',         label: 'Tarea',     sortable: true,  cls: 'cell-title' },
  { key: 'caption',       label: 'Caption',   sortable: false },
  { key: 'publish_date',  label: 'Fecha',     sortable: true },
  { key: 'assignee',      label: 'Hecho por', sortable: true },
  { key: 'status',        label: 'Estado',    sortable: true },
  { key: 'platform',      label: 'Plataforma',sortable: true },
  { key: 'inspo_url',     label: 'Inspo',     sortable: false },
  { key: 'video_url',     label: 'Videos',    sortable: false },
  { key: 'notes_people',  label: 'Notas',     sortable: false },
  { key: 'approval_state',label: 'Aprobación',sortable: true },
];

// Person names that have a non-empty note on a post, e.g. "Jairo, Meli".
function notesPeopleNames(p) {
  const np = p && p.notes_people;
  if (!np || typeof np !== 'object') return [];
  return Object.keys(np).filter((k) => np[k] != null && String(np[k]).trim());
}

// A small "open link" cell that doesn't trigger the row's editor click.
function linkCell(url, label) {
  if (!url) return el('span', { class: 'muted', text: '—' });
  return el('a', {
    class: 'tbl-link', href: url, target: '_blank', rel: 'noopener noreferrer',
    title: url, text: label,
    onclick: (e) => { e.stopPropagation(); },
  });
}

function renderList() {
  const posts = filteredPosts();
  if (!posts.length) {
    $viewBody.replaceChildren(emptyState(
      'Aún no hay contenido',
      'Crea el primero para verlo en la lista.',
      el('button', { class: 'btn btn-primary', onclick: () => openEditorFor(null) }, [icon('plus'), el('span', { text: 'Nuevo contenido' })]),
    ));
    return;
  }

  const { key, dir } = state.sort;
  const sorted = [...posts].sort((a, b) => {
    let va = a[key], vb = b[key];
    if (key === 'content_type') { va = contentTypeLabel(va); vb = contentTypeLabel(vb); }
    if (key === 'status') { va = STATUSES[va] ? STATUSES[va].order : 99; vb = STATUSES[vb] ? STATUSES[vb].order : 99; }
    if (key === 'grabacion') { va = va || 0; vb = vb || 0; }
    if (va == null) va = ''; if (vb == null) vb = '';
    if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase();
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });

  const table = el('table', { class: 'tbl' });
  const thead = el('thead');
  const tr = el('tr');
  for (const col of LIST_COLS) {
    const th = el('th', {
      class: col.sortable ? 'is-sortable' : '',
      onclick: col.sortable ? () => {
        if (state.sort.key === col.key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else { state.sort.key = col.key; state.sort.dir = 'asc'; }
        renderList();
      } : null,
    }, [col.label]);
    if (state.sort.key === col.key) {
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
      th.appendChild(el('span', { class: 'sort-arrow', text: dir === 'asc' ? '▲' : '▼' }));
    }
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const p of sorted) {
    const capFull = p.caption || '';
    const capPreview = capFull.length > 40 ? capFull.slice(0, 40).trimEnd() + '…' : capFull;
    const noteNames = notesPeopleNames(p);
    const row = el('tr', { onclick: () => openEditorFor(p.id) }, [
      el('td', { class: 'cell-num' }, [p.grabacion ? el('span', { class: 'board-card__grab', text: 'G' + p.grabacion }) : el('span', { class: 'muted', text: '—' })]),
      el('td', {}, [chip(p.content_type)]),
      el('td', { class: 'cell-title' }, [el('span', { class: 'truncate', style: { maxWidth: '280px', display: 'inline-block' }, text: p.title })]),
      el('td', {}, [capFull ? el('span', { class: 'truncate', style: { maxWidth: '220px', display: 'inline-block' }, title: capFull, text: capPreview }) : el('span', { class: 'muted', text: '—' })]),
      el('td', {}, [p.publish_date ? el('span', { text: fmtDate(p.publish_date, { day: 'numeric', month: 'short', year: 'numeric' }) }) : el('span', { class: 'muted', text: 'Sin fecha' })]),
      el('td', {}, [p.assignee ? el('span', { class: 'flex items-center gap-2' }, [avatar(p.assignee, true), el('span', { text: p.assignee })]) : el('span', { class: 'muted', text: '—' })]),
      el('td', {}, [statusBadge(p.status)]),
      el('td', {}, [p.platform ? el('span', { class: 'tag', text: p.platform }) : el('span', { class: 'muted', text: '—' })]),
      el('td', {}, [linkCell(p.inspo_url, 'Inspo')]),
      el('td', {}, [linkCell(p.video_url, 'Video')]),
      el('td', {}, [noteNames.length ? el('span', { class: 'tag', title: 'Notas de: ' + noteNames.join(', '), text: noteNames.join(', ') }) : el('span', { class: 'muted', text: '—' })]),
      el('td', {}, [approvalBadge(p.approval_state)]),
    ]);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  $viewBody.replaceChildren(el('div', { class: 'tbl-wrap' }, [table]));
}

// ── 6. POST EDITOR (drawer) ──────────────────────────────────────────────────
async function openEditorFor(id) {
  const isNew = !id;
  clear($edDrawer);

  // Head
  const head = el('div', { class: 'drawer__head' }, [
    el('div', { class: 'drawer__title', id: 'editorTitle', text: isNew ? 'Nuevo contenido' : 'Editar contenido' }),
    el('button', { class: 'drawer__close', 'aria-label': 'Cerrar', onclick: closeEditor }, [icon('close')]),
  ]);
  $edDrawer.appendChild(head);

  const bodyWrap = el('div', { class: 'drawer__body' });
  $edDrawer.appendChild(bodyWrap);
  openEditor();

  // Default post for "new"
  let post = {
    id: null, client_id: state.activeClientId, title: '', content_type: 'reel',
    grabacion: '', publish_date: '', assignee: '', platform: 'Instagram', status: 'idea',
    caption: '', inspo_url: '', video_url: '', hook: '', body: '', cta: '', hashtags: '',
    notes_team: '', notes_people: {}, client_visible: 1, approval_state: 'pending', position: 0,
  };
  let comments = [];

  if (!isNew) {
    bodyWrap.appendChild(skeletonLines(6));
    try {
      const res = await api.get('/posts/' + encodeURIComponent(id));
      post = Object.assign(post, res.post || res);
      comments = (res.comments || []);
    } catch (err) {
      toast(err.message || 'No pudimos cargar el contenido.', 'error');
      closeEditor();
      return;
    }
    clear(bodyWrap);
  }

  // Tabs
  const tabs = el('div', { class: 'tabs' });
  const tabDetails = el('button', { class: 'is-active', onclick: () => switchTab('details') }, ['Detalles']);
  const tabScript  = el('button', { onclick: () => switchTab('script') }, ['Guion & Caption']);
  tabs.append(tabDetails, tabScript);
  bodyWrap.appendChild(tabs);

  // ── Tab: Details ──
  const titleInput = el('input', { class: 'input', value: post.title, placeholder: 'Título del contenido', maxlength: '200' });

  const ctSel    = selectFrom(CONTENT_TYPE_ORDER.map((k) => ({ value: k, label: contentTypeLabel(k) })), post.content_type);
  const grabSel  = selectFrom([{ value: '', label: 'Sin prioridad' }, ...GRABACION_LEVELS.map((n) => ({ value: n, label: 'G' + n }))], post.grabacion || '');
  const dateInput = el('input', { class: 'input', type: 'date', value: post.publish_date ? String(post.publish_date).slice(0, 10) : '' });
  const assigneeInput = el('input', { class: 'input', value: post.assignee || '', placeholder: 'Nombre del responsable' });
  const platSel  = selectFrom(PLATFORMS, post.platform || 'Instagram');
  const statusSel = selectFrom(STATUS_ORDER.map((k) => ({ value: k, label: statusLabel(k) })), post.status);
  const apprSel  = selectFrom(Object.keys(APPROVALS).map((k) => ({ value: k, label: approvalLabel(k) })), post.approval_state);
  const inspoInput = el('input', { class: 'input', type: 'url', value: post.inspo_url || '', placeholder: 'https://...' });
  const videoInput = el('input', { class: 'input', type: 'url', value: post.video_url || '', placeholder: 'https://...' });
  const notesInput = el('textarea', { class: 'textarea', placeholder: 'Notas internas (no visibles para el cliente)' }); notesInput.value = post.notes_team || '';

  const visibleSwitch = el('input', { type: 'checkbox' }); visibleSwitch.checked = !!post.client_visible;
  const visibleField = el('label', { class: 'switch' }, [
    visibleSwitch,
    el('span', { class: 'switch__track' }),
    el('span', { class: 'switch__label', text: 'Visible para el cliente' }),
  ]);

  // ── Per-person notes (one textarea per person configured on this client) ──
  // note_labels comes from the active client (configurable in the client modal).
  const cl = activeClient();
  const noteLabels = (cl && Array.isArray(cl.note_labels)) ? cl.note_labels : [];
  const existingNotes = (post.notes_people && typeof post.notes_people === 'object') ? post.notes_people : {};
  const personNoteInputs = {}; // person → textarea
  const personNotesNodes = [];
  if (noteLabels.length) {
    for (const person of noteLabels) {
      const ta = el('textarea', { class: 'textarea', placeholder: 'Notas para ' + person }); ta.value = existingNotes[person] || '';
      personNoteInputs[person] = ta;
      personNotesNodes.push(field('Notas ' + person, ta));
    }
  } else {
    personNotesNodes.push(el('div', { class: 'help', text: 'Configura las personas que dejan notas en "Editar cliente" para tener una nota por persona.' }));
  }

  const detailsPane = el('div', {}, [
    field('Título', titleInput, { req: true }),
    el('div', { class: 'field-grid' }, [field('Tipo', ctSel), field('Grabación (prioridad)', grabSel)]),
    el('div', { class: 'field-grid' }, [field('Fecha de publicación', dateInput), field('Plataforma', platSel)]),
    el('div', { class: 'field-grid' }, [field('Estado', statusSel), field('Aprobación', apprSel)]),
    field('Hecho por', assigneeInput),
    el('div', { class: 'field-grid' }, [field('Inspiración (URL)', inspoInput), field('Video / asset (URL)', videoInput)]),
    el('div', { class: 'field' }, [visibleField]),
    field('Notas internas', notesInput, { help: 'Solo el equipo ve estas notas.' }),
    ...personNotesNodes,
  ]);

  // ── Tab: Script & Caption ──
  const hookInput = el('textarea', { class: 'textarea', placeholder: 'Gancho inicial' }); hookInput.value = post.hook || ''; hookInput.style.minHeight = '70px';
  const bodyInput = el('textarea', { class: 'textarea', placeholder: 'Cuerpo del guion' }); bodyInput.value = post.body || '';
  const ctaInput  = el('textarea', { class: 'textarea', placeholder: 'Llamado a la acción' }); ctaInput.value = post.cta || ''; ctaInput.style.minHeight = '70px';
  const hashInput = el('textarea', { class: 'textarea', placeholder: '#hashtags' }); hashInput.value = post.hashtags || ''; hashInput.style.minHeight = '70px';
  const capInput  = el('textarea', { class: 'textarea', placeholder: 'Caption final' }); capInput.value = post.caption || '';

  const copyCapBtn = el('button', { class: 'btn btn-sm', onclick: async () => {
    const ok = await copyText(capInput.value || '');
    toast(ok ? 'Caption copiado.' : 'No se pudo copiar.', ok ? 'success' : 'error', 1600);
  } }, [icon('copy'), el('span', { text: 'Copiar caption' })]);

  const scriptPane = el('div', { hidden: true }, [
    field('HOOK', hookInput),
    field('BODY', bodyInput),
    field('CTA', ctaInput),
    field('Hashtags', hashInput),
    el('div', { class: 'field' }, [
      el('label', { class: 'label flex items-center justify-between' }, [el('span', { text: 'Caption' }), copyCapBtn]),
      capInput,
    ]),
  ]);

  bodyWrap.append(detailsPane, scriptPane);

  function switchTab(t) {
    const isDetails = t === 'details';
    tabDetails.classList.toggle('is-active', isDetails);
    tabScript.classList.toggle('is-active', !isDetails);
    detailsPane.hidden = !isDetails;
    scriptPane.hidden = isDetails;
  }

  // ── Comments thread (only for existing posts) ──
  if (!isNew) {
    bodyWrap.appendChild(el('hr', { class: 'hr' }));
    bodyWrap.appendChild(el('div', { class: 'section-head' }, [el('h2', { style: { fontSize: '15px' }, text: 'Comentarios' })]));
    const thread = el('div', { class: 'thread', id: 'edThread' });
    renderThread(thread, comments);
    bodyWrap.appendChild(thread);
    bodyWrap.appendChild(commentComposer(post.id, thread));
  }

  // ── Footer: save / delete ──
  const foot = el('div', { class: 'drawer__foot' });
  if (!isNew) {
    foot.appendChild(el('button', { class: 'btn btn-danger', onclick: () => confirmDelete(post.id) }, [icon('trash'), el('span', { text: 'Eliminar' })]));
  }
  foot.appendChild(el('span', { class: 'spacer' }));
  foot.appendChild(el('button', { class: 'btn btn-ghost', onclick: closeEditor, text: 'Cancelar' }));
  const saveBtn = el('button', { class: 'btn btn-primary', text: isNew ? 'Crear' : 'Guardar' });
  foot.appendChild(saveBtn);
  $edDrawer.appendChild(foot);

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { toast('Escribe un título.', 'error'); titleInput.focus(); return; }
    // Collect per-person notes into a {person: text} object (only non-empty kept).
    const notesPeople = {};
    for (const [person, ta] of Object.entries(personNoteInputs)) {
      const v = ta.value.trim();
      if (v) notesPeople[person] = v;
    }
    const payload = {
      client_id: state.activeClientId,
      title,
      content_type: ctSel.value,
      grabacion: grabSel.value ? Number(grabSel.value) : null,
      publish_date: dateInput.value || null,
      assignee: assigneeInput.value.trim() || null,
      platform: platSel.value,
      status: statusSel.value,
      approval_state: apprSel.value,
      inspo_url: inspoInput.value.trim() || null,
      video_url: videoInput.value.trim() || null,
      notes_team: notesInput.value.trim() || null,
      notes_people: notesPeople,
      client_visible: visibleSwitch.checked ? 1 : 0,
      hook: hookInput.value.trim() || null,
      body: bodyInput.value.trim() || null,
      cta: ctaInput.value.trim() || null,
      hashtags: hashInput.value.trim() || null,
      caption: capInput.value.trim() || null,
    };
    saveBtn.dataset.loading = 'true';
    try {
      if (isNew) {
        await api.post('/posts', payload);
        toast('Contenido creado.', 'success');
      } else {
        await api.patch('/posts/' + encodeURIComponent(post.id), payload);
        toast('Cambios guardados.', 'success');
      }
      closeEditor();
      await loadPosts();
      refreshClientCounts();
    } catch (err) {
      toast(err.message || 'No se pudo guardar.', 'error');
    } finally {
      delete saveBtn.dataset.loading;
    }
  });

  setTimeout(() => titleInput.focus(), 60);
}

function renderThread(container, comments) {
  clear(container);
  if (!comments || !comments.length) {
    container.appendChild(el('div', { class: 'help', text: 'Aún no hay comentarios.' }));
    return;
  }
  for (const c of comments) {
    container.appendChild(el('div', { class: 'comment' + (c.internal ? ' is-internal' : '') }, [
      avatar(c.author_name),
      el('div', { class: 'comment__body' }, [
        el('div', { class: 'comment__meta' }, [
          el('span', { class: 'comment__author', text: c.author_name }),
          c.internal ? el('span', { class: 'comment__internal-tag', text: 'Interno' }) : null,
          el('span', { class: 'comment__time', text: timeAgo(c.created_at) }),
        ]),
        el('div', { class: 'comment__bubble', text: c.body }),
      ]),
    ]));
  }
}

function commentComposer(postId, thread) {
  const ta = el('textarea', { class: 'textarea', placeholder: 'Escribe un comentario', style: { minHeight: '70px' } });
  const internalCb = el('input', { type: 'checkbox' });
  const internalSwitch = el('label', { class: 'switch' }, [internalCb, el('span', { class: 'switch__track' }), el('span', { class: 'switch__label', text: 'Interno (solo equipo)' })]);
  const sendBtn = el('button', { class: 'btn btn-primary btn-sm' }, [icon('send'), el('span', { text: 'Comentar' })]);

  sendBtn.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    sendBtn.dataset.loading = 'true';
    try {
      await api.post('/posts/' + encodeURIComponent(postId) + '/comments', { body, internal: internalCb.checked ? 1 : 0 });
      // refetch thread
      const res = await api.get('/posts/' + encodeURIComponent(postId));
      renderThread(thread, res.comments || []);
      ta.value = ''; internalCb.checked = false;
      toast('Comentario agregado.', 'success', 1600);
    } catch (err) {
      toast(err.message || 'No se pudo comentar.', 'error');
    } finally {
      delete sendBtn.dataset.loading;
    }
  });

  return el('div', { class: 'composer' }, [
    ta,
    el('div', { class: 'composer__row' }, [internalSwitch, el('span', { class: 'spacer' }), sendBtn]),
  ]);
}

function confirmDelete(postId) {
  openConfirm({
    title: 'Eliminar contenido',
    message: 'Esta acción no se puede deshacer. ¿Eliminar este contenido?',
    confirmLabel: 'Eliminar',
    danger: true,
    onConfirm: async () => {
      await api.del('/posts/' + encodeURIComponent(postId));
      toast('Contenido eliminado.', 'success');
      closeEditor();
      await loadPosts();
      refreshClientCounts();
    },
  });
}

// ── 7. MODALS ────────────────────────────────────────────────────────────────
function modalShell(titleText, bodyNode, footNodes = []) {
  clear($modal);
  $modal.appendChild(el('div', { class: 'modal__head' }, [
    el('div', { class: 'modal__title', id: 'modalTitle', text: titleText }),
    el('button', { class: 'modal__close', 'aria-label': 'Cerrar', onclick: closeModal }, [icon('close')]),
  ]));
  $modal.appendChild(el('div', { class: 'modal__body' }, [bodyNode]));
  if (footNodes.length) $modal.appendChild(el('div', { class: 'modal__foot' }, footNodes));
  openModal();
}

// ── Confirm dialog ──
function openConfirm({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
  const confirmBtn = el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: confirmLabel });
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.dataset.loading = 'true';
    try {
      // onConfirm may return truthy to keep the modal open (e.g. it swaps the
      // modal content in place to reveal a generated password). Otherwise close.
      const keepOpen = await onConfirm();
      if (!keepOpen) closeModal();
    }
    catch (err) { toast(err.message || 'No se pudo completar la acción.', 'error'); }
    finally { delete confirmBtn.dataset.loading; }
  });
  modalShell(title, el('p', { class: 'dim', text: message }), [
    el('button', { class: 'btn btn-ghost', onclick: closeModal, text: 'Cancelar' }),
    confirmBtn,
  ]);
}

// ── New / edit client ──
const BRAND_PRESETS = ['#7c3aed', '#d946ef', '#ec4899', '#2563eb', '#0ea5e9', '#16a34a', '#f59e0b', '#dc2626', '#475569'];

function openClientModal(existing = null) {
  const isNew = !existing;
  const nameInput = el('input', { class: 'input', value: existing ? existing.name : '', placeholder: 'Nombre del cliente' });
  const igInput = el('input', { class: 'input', value: existing ? (existing.instagram_handle || '') : '', placeholder: '@usuario' });
  const existingLabels = (existing && Array.isArray(existing.note_labels)) ? existing.note_labels : [];
  const notePeopleInput = el('input', { class: 'input', value: existingLabels.join(', '), placeholder: 'Jairo, Natalia' });
  let color = existing && existing.brand_color ? existing.brand_color : '#7c3aed';

  const colorInput = el('input', { type: 'color', value: color });
  const presets = el('div', { class: 'swatch-presets' });
  function paintPresets() {
    clear(presets);
    for (const c of BRAND_PRESETS) {
      presets.appendChild(el('button', { type: 'button', class: 'swatch-preset' + (c.toLowerCase() === color.toLowerCase() ? ' is-active' : ''), style: { background: c }, 'aria-label': c, onclick: () => { color = c; colorInput.value = c; paintPresets(); } }));
    }
  }
  paintPresets();
  colorInput.addEventListener('input', () => { color = colorInput.value; paintPresets(); });

  const body = el('div', {}, [
    field('Nombre', nameInput, { req: true }),
    field('Instagram', igInput),
    field('Color de marca', el('div', { class: 'swatch-row' }, [colorInput, presets])),
    field('Personas que dejan notas (separadas por coma)', notePeopleInput, { help: 'Una nota por persona en cada contenido. Ej: Jairo, Natalia' }),
  ]);

  const saveBtn = el('button', { class: 'btn btn-primary', text: isNew ? 'Crear cliente' : 'Guardar' });
  const footNodes = [];
  if (!isNew) footNodes.push(el('button', { class: 'btn btn-danger', onclick: () => confirmArchiveClient(existing) }, [icon('archive'), el('span', { text: 'Archivar' })]));
  footNodes.push(el('span', { class: 'spacer' }));
  footNodes.push(el('button', { class: 'btn btn-ghost', onclick: closeModal, text: 'Cancelar' }));
  footNodes.push(saveBtn);

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { toast('Escribe un nombre.', 'error'); nameInput.focus(); return; }
    // Parse comma-separated people into a deduped array of short names.
    const noteLabels = [...new Set(
      notePeopleInput.value.split(',').map((s) => s.trim()).filter(Boolean)
    )].slice(0, 12);
    const payload = { name, brand_color: color, instagram_handle: igInput.value.trim() || null, note_labels: noteLabels };
    saveBtn.dataset.loading = 'true';
    try {
      if (isNew) {
        const created = await api.post('/clients', payload);
        toast('Cliente creado.', 'success');
        closeModal();
        await loadClients();
        if (created && created.id) selectClient(created.id);
      } else {
        await api.patch('/clients/' + encodeURIComponent(existing.id), payload);
        toast('Cliente actualizado.', 'success');
        closeModal();
        await refreshClientCounts();
        renderTopbar();
      }
    } catch (err) {
      toast(err.message || 'No se pudo guardar el cliente.', 'error');
    } finally { delete saveBtn.dataset.loading; }
  });

  modalShell(isNew ? 'Nuevo cliente' : 'Editar cliente', body, footNodes);
  setTimeout(() => nameInput.focus(), 60);
}

function confirmArchiveClient(client) {
  openConfirm({
    title: 'Archivar cliente',
    message: 'El cliente "' + client.name + '" se archivará y dejará de aparecer en la lista. ¿Continuar?',
    confirmLabel: 'Archivar',
    danger: true,
    onConfirm: async () => {
      await api.del('/clients/' + encodeURIComponent(client.id));
      toast('Cliente archivado.', 'success');
      if (state.activeClientId === client.id) state.activeClientId = null;
      await loadClients();
    },
  });
}

// ── Team management ──
async function openTeamModal() {
  const listWrap = el('div', { id: 'teamList' }, [skeletonLines(4)]);

  const inviteTeamBtn = el('button', { class: 'btn btn-sm', onclick: () => openInviteForm('team', listWrap) }, [icon('plus'), el('span', { text: 'Invitar miembro' })]);
  const inviteClientBtn = el('button', { class: 'btn btn-sm', onclick: () => openInviteForm('client', listWrap) }, [icon('plus'), el('span', { text: 'Crear acceso de cliente' })]);

  const body = el('div', {}, [
    el('div', { class: 'btn-row', style: { marginBottom: 'var(--s-4)' } }, [inviteTeamBtn, inviteClientBtn]),
    el('div', { id: 'inviteSlot' }),
    listWrap,
  ]);

  modalShell('Equipo y accesos', body, []);
  await refreshTeamList(listWrap);
}

async function refreshTeamList(listWrap) {
  try {
    const users = await api.get('/users');
    state.users = Array.isArray(users) ? users : [];
  } catch (err) {
    listWrap.replaceChildren(el('div', { class: 'alert alert--error' }, [el('span', { text: err.message || 'No se pudieron cargar los usuarios.' })]));
    return;
  }
  renderTeamList(listWrap);
}

function clientName(id) { const c = state.clients.find((x) => x.id === id); return c ? c.name : '—'; }

function renderTeamList(listWrap) {
  clear(listWrap);
  if (!state.users.length) { listWrap.appendChild(el('div', { class: 'help', text: 'No hay usuarios todavía.' })); return; }
  for (const u of state.users) {
    const activeSwitch = el('input', { type: 'checkbox' }); activeSwitch.checked = !!u.active;
    activeSwitch.addEventListener('change', async () => {
      try { await api.patch('/users/' + encodeURIComponent(u.id), { active: activeSwitch.checked ? 1 : 0 }); u.active = activeSwitch.checked ? 1 : 0; toast('Estado actualizado.', 'success', 1500); }
      catch (err) { activeSwitch.checked = !activeSwitch.checked; toast(err.message || 'No se pudo actualizar.', 'error'); }
    });

    const resetBtn = el('button', { class: 'btn btn-sm btn-ghost', title: 'Restablecer contraseña', onclick: () => confirmResetPassword(u) }, [icon('key')]);

    const sub = u.role === 'client'
      ? 'Cliente · ' + clientName(u.client_id)
      : cap(u.role);

    listWrap.appendChild(el('div', { class: 'user-row' }, [
      avatar(u.name),
      el('div', { class: 'user-row__main' }, [
        el('div', { class: 'user-row__name truncate' }, [u.name, ' ', el('span', { class: 'tag role-tag', text: u.role })]),
        el('div', { class: 'user-row__sub truncate', text: u.email + ' · ' + sub }),
      ]),
      el('div', { class: 'user-row__actions' }, [
        resetBtn,
        el('label', { class: 'switch', title: 'Activo' }, [activeSwitch, el('span', { class: 'switch__track' })]),
      ]),
    ]));
  }
}

function openInviteForm(role, listWrap) {
  const slot = document.getElementById('inviteSlot');
  if (!slot) return;
  clear(slot);

  const nameInput = el('input', { class: 'input', placeholder: 'Nombre completo' });
  const emailInput = el('input', { class: 'input', type: 'email', placeholder: 'correo@ejemplo.com' });
  const clientSel = role === 'client'
    ? selectFrom([{ value: '', label: 'Selecciona un cliente' }, ...state.clients.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }))], state.activeClientId || '')
    : null;

  const fields = el('div', {}, [
    el('div', { class: 'field-grid' }, [field('Nombre', nameInput, { req: true }), field('Correo', emailInput, { req: true })]),
    clientSel ? field('Cliente', clientSel, { req: true }) : null,
  ]);

  const createBtn = el('button', { class: 'btn btn-primary btn-sm', text: role === 'team' ? 'Invitar' : 'Crear acceso' });
  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name || !email) { toast('Completa nombre y correo.', 'error'); return; }
    if (role === 'client' && !clientSel.value) { toast('Selecciona un cliente.', 'error'); return; }
    const payload = { name, email, role };
    if (role === 'client') payload.client_id = clientSel.value;
    createBtn.dataset.loading = 'true';
    try {
      const created = await api.post('/users', payload);
      toast('Acceso creado.', 'success');
      clear(slot);
      if (created && created.password) showGeneratedPassword(slot, email, created.password);
      await refreshTeamList(listWrap);
    } catch (err) {
      toast(err.message || 'No se pudo crear el acceso.', 'error');
    } finally { delete createBtn.dataset.loading; }
  });

  slot.appendChild(el('div', { class: 'card card--pad', style: { marginBottom: 'var(--s-4)' } }, [
    el('div', { class: 'section-head' }, [el('h2', { style: { fontSize: '15px' }, text: role === 'team' ? 'Invitar miembro del equipo' : 'Crear acceso de cliente' })]),
    fields,
    el('div', { class: 'composer__row' }, [el('span', { class: 'spacer' }), el('button', { class: 'btn btn-ghost btn-sm', onclick: () => clear(slot), text: 'Cancelar' }), createBtn]),
  ]));
  setTimeout(() => nameInput.focus(), 60);
}

function showGeneratedPassword(slot, email, password) {
  const input = el('input', { value: password, readonly: true, 'aria-label': 'Contraseña generada' });
  const copyBtn = el('button', { onclick: async () => { const ok = await copyText(password); toast(ok ? 'Contraseña copiada.' : 'No se pudo copiar.', ok ? 'success' : 'error', 1500); }, text: 'Copiar' });
  slot.appendChild(el('div', { class: 'alert alert--success secret-note' }, [
    el('div', {}, [
      el('div', { style: { fontWeight: '700', marginBottom: '6px' }, text: 'Acceso creado para ' + email }),
      el('div', { class: 'copy-field' }, [input, copyBtn]),
      el('div', { class: 'help', style: { marginTop: '6px' }, text: 'Guárdala, no se vuelve a mostrar.' }),
    ]),
  ]));
}

function confirmResetPassword(user) {
  openConfirm({
    title: 'Restablecer contraseña',
    message: 'Se generará una contraseña temporal nueva para ' + user.name + '. ¿Continuar?',
    confirmLabel: 'Restablecer',
    onConfirm: async () => {
      const res = await api.post('/users/' + encodeURIComponent(user.id) + '/reset-password');
      // Swap the modal content in place to reveal the new password once.
      // Returning true tells openConfirm NOT to auto-close (keep this modal).
      const slot = el('div', {});
      modalShell('Contraseña restablecida', slot, [el('button', { class: 'btn btn-primary', onclick: closeModal, text: 'Listo' })]);
      showGeneratedPassword(slot, user.email, res.password);
      return true;
    },
  });
}

// ── Activity feed ──
async function openActivityModal() {
  const feedWrap = el('div', { id: 'activityFeed' }, [skeletonLines(5)]);
  const clientLabel = activeClient() ? activeClient().name : 'todos los clientes';
  modalShell('Actividad reciente', el('div', {}, [
    el('p', { class: 'help', style: { marginBottom: 'var(--s-4)' }, text: 'Cliente: ' + clientLabel }),
    feedWrap,
  ]), []);

  try {
    const cid = state.activeClientId;
    const items = await api.get('/activity?limit=40' + (cid ? '&client_id=' + encodeURIComponent(cid) : ''));
    renderFeed(feedWrap, Array.isArray(items) ? items : []);
  } catch (err) {
    feedWrap.replaceChildren(el('div', { class: 'alert alert--error' }, [el('span', { text: err.message || 'No se pudo cargar la actividad.' })]));
  }
}

const ACTION_LABELS = {
  'post.create': 'creó contenido',
  'post.update': 'actualizó contenido',
  'post.delete': 'eliminó contenido',
  'status.change': 'cambió el estado',
  'post.approve': 'aprobó',
  'post.changes': 'pidió cambios',
  'comment.create': 'comentó',
  'client.create': 'creó un cliente',
  'client.update': 'actualizó un cliente',
  'user.create': 'creó un acceso',
};

function renderFeed(wrap, items) {
  clear(wrap);
  if (!items.length) { wrap.appendChild(el('div', { class: 'help', text: 'Aún no hay actividad.' })); return; }
  const feed = el('div', { class: 'feed' });
  for (const a of items) {
    const verb = ACTION_LABELS[a.action] || a.action;
    feed.appendChild(el('div', { class: 'feed__item' }, [
      el('div', { class: 'feed__icon' }, [icon('activity')]),
      el('div', { class: 'feed__text grow' }, [
        el('div', {}, [el('strong', { text: a.actor_name || 'Alguien' }), ' ', verb, a.detail ? el('span', { class: 'dim', text: ' · ' + a.detail }) : null]),
        el('div', { class: 'feed__time', text: timeAgo(a.created_at) }),
      ]),
    ]));
  }
  wrap.appendChild(feed);
}

// ── Double-click client name in topbar opens edit (small power-user affordance)
$topbar.addEventListener('dblclick', (e) => {
  if (e.target.closest('.topbar__client') && activeClient()) openClientModal(activeClient());
});

// ── GO ───────────────────────────────────────────────────────────────────────
boot();
