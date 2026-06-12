// ============================================================================
// IVAE Marketing v2 — Shell orquestador (host de toda la app enterprise).
//
// boot(): auth gate -> prefs -> carga paralela (clients + unread best-effort)
//         -> chrome montado UNA sola vez -> router con hash inicial -> fade
//         del splash #boot.
//
// API publica (CONGELADA, la consumen los 10 paquetes):
//   registerView({id,label,icon,mount,unmount?,onParams?})
//   boot(), setFab(cfg|null), setViewControls(nodes|null),
//   setTabBadge(tabId, n), openEditor(id,{tab,commentId}), selectClient(id)
//
// ctx entregado a cada vista en mount(el, ctx):
//   { store, prefs, router:{navigate,current}, sheet:{openSheet,pickFrom,
//     closeAll}, pickers, dnd, toast, setFab, setViewControls, setTabBadge,
//     openEditor, selectClient, icons }
//
// Degradacion limpia: si /notifications devuelve 404 (migracion 004 sin
// aplicar) se ocultan campana y tab Avisos y todo lo demas funciona.
// ============================================================================

import { api, el } from '../api.js?v=202606121357';
import * as store from './store.js?v=202606121357';
import * as prefs from './prefs.js?v=202606121357';
import * as router from './router.js?v=202606121357';
import { openSheet, pickFrom, closeAll } from './sheet.js?v=202606121357';
import { toast } from './toast.js?v=202606121357';
import { icon } from './icons.js?v=202606121357';
import * as iconsMod from './icons.js?v=202606121357';
import { createTopbar } from './topbar.js?v=202606121357';
import { createBottomNav } from './bottomnav.js?v=202606121357';
import { createSearch } from './search.js?v=202606121357';
import { createNotifications } from './notifications.js?v=202606121357';
import * as pickers from '../ui/pickers.js?v=202606121357';
import * as dnd from '../ui/dnd.js?v=202606121357';

// Lista canonica (prefs.js): calendario/tablero/tabla/timeline/carga.
const CONTENT_VIEWS = prefs.CONTENT_VIEWS;
// El cliente solo ve las vistas de calendario (Calendario = meses,
// Cuadrícula = calendario). Nada de Inicio/Tablero/Tabla/Timeline/Carga.
const CLIENT_VIEWS = ['meses', 'calendario'];
const isClientRole = () => ((store.getState().me || {}).role === 'client');
const CONTENT_LABELS = {
  meses: 'Calendario',
  calendario: 'Cuadrícula',
  tablero: 'Tablero',
  tabla: 'Tabla',
  timeline: 'Timeline',
  carga: 'Carga',
};
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

let topbar = null;
let bottomnav = null;
let search = null;
let notifications = null;
let subheadEl = null;
let subheadSeg = null;
let subheadSlot = null;
let offlineBar = null;
let viewScrollEl = null;
let redirected = false;

// ── Registro de vistas (delegado al router) ──────────────────────────────────
export const registerView = router.registerView;

// ── Acciones publicas ────────────────────────────────────────────────────────
export function setFab(cfg) { bottomnav?.setFab(cfg); }

export function setTabBadge(tabId, n) { bottomnav?.setTabBadge(tabId, n); }

export function setViewControls(nodes) {
  if (!subheadSlot) return;
  while (subheadSlot.firstChild) subheadSlot.removeChild(subheadSlot.firstChild);
  if (nodes) {
    const list = Array.isArray(nodes) ? nodes : [nodes];
    for (const n of list) if (n) subheadSlot.appendChild(n);
  }
  updateSubhead();
}

export function openEditor(id, { tab, commentId } = {}) {
  const { activeClientId } = store.getState();
  const params = { id };
  if (activeClientId && activeClientId !== 'todos') params.cliente = activeClientId;
  if (tab) params.tab = tab;
  if (commentId) params.comment = commentId;
  router.navigate('post', params);
}

/**
 * Cambia el cliente activo: set optimista + pref lastClient + ?cliente= con
 * replace + evento client:changed + recarga de posts (centralizada).
 */
export function selectClient(id) {
  const st = store.getState();
  if (id === st.activeClientId) return;
  store.set({ activeClientId: id, search: '' });
  prefs.set('lastClient', id);
  applyAccent(id);

  const cur = router.current();
  if (cur.view && cur.view !== 'post') {
    const params = { ...cur.params, cliente: id };
    delete params.q;
    router.navigate(cur.view, params, { replace: true });
  } else {
    router.navigate(prefs.lastContentView(id), { cliente: id });
  }
  store.emit('client:changed', { id });
  store.loadPosts(id);
}

// ── Helpers internos ─────────────────────────────────────────────────────────
function applyAccent(clientId) {
  const { clients } = store.getState();
  const c = clients.find((x) => x.id === clientId);
  const color = c && HEX_RE.test(String(c.brand_color || '')) ? c.brand_color : null;
  document.body.style.setProperty('--client-accent', color || 'var(--brand)');
}

function paramsToFilters(params) {
  const f = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (['cliente', 'id', 'tab', 'comment'].includes(k)) continue;
    f[k] = v;
  }
  return f;
}

function updateSubhead() {
  if (!subheadEl) return;
  const { view } = store.getState();
  const isContent = CONTENT_VIEWS.includes(view);
  subheadSeg.hidden = !isContent;
  const hasSlot = subheadSlot.children.length > 0;
  const show = isContent || hasSlot;
  subheadEl.hidden = !show;
  document.body.classList.toggle('has-subhead', show);
  if (isContent) {
    for (const b of subheadSeg.querySelectorAll('button')) {
      const is = b.dataset.view === view;
      b.classList.toggle('is-active', is);
      b.setAttribute('aria-selected', is ? 'true' : 'false');
    }
  }
}

function buildSubhead(root) {
  subheadSeg = el('div', { class: 'seg subhead-seg', role: 'tablist', 'aria-label': 'Vista de contenido' });
  // Vianey pidio quitar Tablero/Tabla/Timeline/Carga de su admin: tanto admin
  // como cliente solo ven las dos vistas de calendario (Calendario = meses,
  // Cuadricula = calendario).
  const VISIBLE_CONTENT_VIEWS = ['meses', 'calendario'];
  const segViews = CONTENT_VIEWS.filter((v) => VISIBLE_CONTENT_VIEWS.includes(v));
  for (const v of segViews) {
    const label = CONTENT_LABELS[v] || v;
    subheadSeg.appendChild(el('button', {
      type: 'button', role: 'tab', dataset: { view: v }, text: label,
      onclick: () => {
        const { activeClientId } = store.getState();
        router.navigate(v, activeClientId ? { cliente: activeClientId } : {});
      },
    }));
  }
  subheadSlot = el('div', { class: 'subhead-slot' });
  subheadEl = root;
  root.append(subheadSeg, subheadSlot);
  root.hidden = true;
}

// Interceptor global 401: guarda returnTo y manda al login (una sola vez).
function installAuthInterceptor() {
  for (const method of ['get', 'post', 'patch', 'put', 'del']) {
    const original = api[method].bind(api);
    api[method] = async (...args) => {
      try {
        return await original(...args);
      } catch (err) {
        if (err && err.status === 401 && store.getState().booted && !redirected) {
          redirected = true;
          prefs.set('returnTo', location.hash || '');
          toast('Tu sesión expiró. Vuelve a iniciar sesión.', { type: 'info' });
          setTimeout(() => location.replace('/marketing/'), 900);
        }
        throw err;
      }
    };
  }
}

function installOnlineOffline() {
  const update = () => {
    const online = navigator.onLine !== false;
    store.set({ online });
    if (offlineBar) offlineBar.hidden = online;
    // body.is-offline desplaza #subhead y #viewScroll (shell.css): la barra
    // no tapa el seg ni roba taps.
    document.body.classList.toggle('is-offline', !online);
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ── ctx por vista ────────────────────────────────────────────────────────────
function ctxFactory(view, params) {
  return {
    store,
    prefs,
    router: { navigate: router.navigate, current: router.current },
    sheet: { openSheet, pickFrom, closeAll },
    pickers,
    dnd,
    toast,
    setFab,
    setViewControls,
    setTabBadge,
    openEditor,
    selectClient,
    icons: iconsMod.icon,
    params,
  };
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
export async function boot() {
  const bootEl = document.getElementById('boot');

  // 1) Auth gate.
  let me;
  try {
    me = await api.get('/auth/me');
  } catch {
    location.replace('/marketing/');
    return;
  }
  if (!me || !me.role) { location.replace('/marketing/'); return; }
  // El cliente ahora usa la MISMA app (calendario compartido editable), no el
  // portal de solo lectura. Marca el body para ocultar el chrome de agencia
  // (Equipo, Accesos de cliente, etc.). El backend limita todo a SU marca.
  if (me.role === 'client') document.body.classList.add('is-client');

  prefs.init(me.id);
  prefs.migrate();
  store.set({ me }, { silent: true });

  // 2) Carga paralela: clients (critica) + unread (best-effort via notifications).
  let clients = [];
  try {
    clients = await api.get('/clients');
    if (!Array.isArray(clients)) clients = [];
  } catch (e) {
    // Sin clients no hay app: muestra error en el splash con reintento.
    if (bootEl) {
      const msg = bootEl.querySelector('.muted');
      if (msg) msg.textContent = e.message || 'No se pudo cargar. Revisa tu conexión.';
      bootEl.appendChild(el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Reintentar',
        style: { marginTop: '14px' },
        onclick: () => location.reload(),
      }));
    }
    return;
  }
  store.set({ clients }, { silent: true });

  // 3) Cliente activo: deep link > pref > primer cliente.
  const initialRoute = router.parse();
  const fromUrl = initialRoute.params.cliente;
  const fromPref = prefs.get('lastClient');
  const firstId = (clients.find((c) => !c.archived) || clients[0] || {}).id || null;
  const validIds = new Set(clients.map((c) => c.id));
  validIds.add('todos');
  const activeClientId =
    (fromUrl && validIds.has(fromUrl) && fromUrl) ||
    (fromPref && validIds.has(fromPref) && fromPref) ||
    firstId;
  store.set({ activeClientId }, { silent: true });

  // 4) Chrome (una sola vez).
  const topbarRoot = document.getElementById('topbar');
  const subheadRoot = document.getElementById('subhead');
  const bottomnavRoot = document.getElementById('bottomnav');
  const fabHost = document.getElementById('fabHost');
  const viewHost = document.getElementById('view');
  viewScrollEl = document.getElementById('viewScroll');

  notifications = createNotifications({
    router,
    onUnavailable: () => {
      topbar?.setNotifAvailable(false);
      bottomnav?.setNotifAvailable(false);
    },
  });
  search = createSearch({ router, selectClient });
  topbar = createTopbar({
    root: topbarRoot,
    router,
    selectClient,
    openSearch: (anchor) => search.open(anchor),
    openNotifications: (anchor, opts) => notifications.openPanel(anchor, opts),
  });
  buildSubhead(subheadRoot);
  bottomnav = createBottomNav({
    root: bottomnavRoot,
    fabHost,
    scrollEl: viewScrollEl,
    router,
    openNotifications: (anchor, opts) => notifications.openPanel(anchor, opts),
  });

  offlineBar = el('div', { class: 'offline-bar', hidden: true, text: 'Sin conexión' });
  topbarRoot.insertAdjacentElement('afterend', offlineBar);

  applyAccent(activeClientId);
  installAuthInterceptor();
  installOnlineOffline();
  notifications.start();

  // 5) Router.
  router.init({
    host: viewHost,
    ctxFactory,
    fallback: 'tablero',
    onUnknownView: () => toast('Esa vista no existe. Te llevamos al tablero.', { type: 'info' }),
    onBeforeMount(view, params, { paramsOnly }) {
      // El cliente solo entra a las vistas de calendario (+ editor de post via
      // deep-link). Cualquier otra vista lo regresa a su Calendario.
      if (isClientRole() && !CLIENT_VIEWS.includes(view) && view !== 'post') {
        router.navigate('meses', params.cliente ? { cliente: params.cliente } : {});
        return;
      }
      // Coherencia de cliente: la URL manda. La validez se calcula con el
      // estado VIVO (store.clients), no con el Set del boot: clientes creados
      // despues (switcher u otra sesion) tambien cuentan para deep-links.
      const st = store.getState();
      const clienteValido = params.cliente === 'todos' ||
        st.clients.some((c) => c.id === params.cliente);
      if (params.cliente && params.cliente !== st.activeClientId && clienteValido) {
        store.set({ activeClientId: params.cliente });
        prefs.set('lastClient', params.cliente);
        applyAccent(params.cliente);
        store.emit('client:changed', { id: params.cliente });
        store.loadPosts(params.cliente);
      }
      if (CONTENT_VIEWS.includes(view)) {
        prefs.setLastContentView(store.getState().activeClientId, view);
      }
      store.set({ view, params, filters: paramsToFilters(params) });
      if (!paramsOnly) {
        setFab(null);
        setViewControls(null);
      }
    },
    onAfterMount(view, params, { paramsOnly }) {
      updateSubhead();
      if (!paramsOnly) viewScrollEl?.scrollTo({ top: 0 });
    },
  });

  // Primera carga de posts del cliente activo (las vistas leen store.posts).
  store.loadPosts(activeClientId);

  const defaultView = prefs.lastContentView(activeClientId);
  router.start({ view: defaultView, params: activeClientId ? { cliente: activeClientId } : {} });

  store.set({ booted: true });

  // 6) Fade del splash.
  if (bootEl) {
    bootEl.classList.add('is-hidden');
    setTimeout(() => bootEl.remove(), 350);
  }
  const appEl = document.getElementById('app');
  if (appEl) appEl.hidden = false;
}

// Re-exports utiles para los paquetes de vistas.
export { store, prefs, router, openSheet, pickFrom, closeAll, toast, icon };
