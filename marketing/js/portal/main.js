// ============================================================================
// Portal cliente v2 — Entry (unico script de client.html).
//
// App AISLADA del shell de equipo: importa solo api.js + js/shell/sheet.js +
// js/shell/toast.js (regla de la arquitectura) + los modulos de js/portal/*.
//
// Responsabilidades:
//   1) Gate de auth: 401 -> login; rol != client -> app de equipo; error de
//      red -> pantalla bootFailed con Reintentar.
//   2) Carga paralela GET /clients (degradable) + GET /posts (server-scoped:
//      el frontend JAMAS envia client_id).
//   3) applyAccent portado de v1 (tinte de marca; la accion sigue siendo el
//      gradiente IVAE).
//   4) Shell estatico: header, badge de progreso, tabs persistentes
//      (localStorage 'mkt.portal.tab'), secciones inbox/agenda.
//   5) Ruta #post=<id>: el detalle es una RUTA, el boton atras del telefono
//      cierra (popstate/hashchange); deep-link directo soportado.
//   6) Sheets del shell + boton atras: pushLayer del router apila un history
//      state; aqui un popstate con sheet abierto la cierra sin navegar.
//   7) Refresco sin polling: re-GET /posts en visibilitychange/focus si la
//      ultima carga tiene mas de 60s.
// ============================================================================

import { api, el, clear, initials } from '../api.js?v=202607071310';
import { toast } from '../shell/toast.js?v=202607071310';
import { closeAll as closeAllSheets, openCount as openSheetCount } from '../shell/sheet.js?v=202607071310';
import * as store from './store.js?v=202607071310';
import * as inbox from './inbox.js?v=202607071310';
import * as progress from './progress.js?v=202607071310';
import * as agenda from './agenda.js?v=202607071310';
import * as detail from './detail.js?v=202607071310';
import { ICONS } from './igcard.js?v=202607071310';

const bootEl = document.getElementById('boot');
const appEl = document.getElementById('app');
const headerEl = document.getElementById('pheader');
const progressEl = document.getElementById('progress');
const tabsEl = document.getElementById('tabs');
const inboxEl = document.getElementById('inbox');
const agendaEl = document.getElementById('agenda');
const detailEl = document.getElementById('detail');

let detailPushed = false; // true si ESTA app empujo la entrada #post= al history

init();

async function init() {
  // 1) ¿Quien soy? 401 -> login; staff -> app de equipo.
  let me;
  try {
    me = await api.get('/auth/me');
  } catch (err) {
    if (err && err.status === 401) { location.replace('/marketing/'); return; }
    bootFailed('No pudimos verificar tu sesión. Inténtalo de nuevo.');
    return;
  }
  if (!me || !me.role) { location.replace('/marketing/'); return; }
  if (me.role !== 'client') { location.replace('/marketing/app.html'); return; }
  store.init(me);

  // 2) Perfil propio + posts en paralelo (clients degradable).
  try {
    await store.loadInitial();
  } catch (err) {
    if (err && err.status === 401) { location.replace('/marketing/'); return; }
    bootFailed('No pudimos cargar tu contenido. Inténtalo de nuevo.');
    return;
  }

  // 3) Render del shell.
  applyAccent();
  renderHeader();
  renderTabs();
  progress.mount(progressEl, { onGoToTab: setTab });
  inbox.mount(inboxEl, { onOpenDetail: openDetailRoute });
  agenda.mount(agendaEl, { onOpenDetail: openDetailRoute });
  detail.init(detailEl, { onRequestClose: closeDetailRoute });
  applyTab(store.state.tab);

  bootEl.classList.add('hidden');
  bootEl.hidden = true;
  appEl.hidden = false;

  // 4) Ruteo + ciclo de vida.
  window.addEventListener('hashchange', syncFromHash);
  window.addEventListener('popstate', onPopState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') store.refreshIfStale();
  });
  window.addEventListener('focus', () => store.refreshIfStale());

  store.on('tab', ({ tab }) => applyTab(tab));
  store.on('approval', () => updateTabCount());
  store.on('posts', () => updateTabCount());

  // Deep-link #post=<id> directo (futuro email/WhatsApp): abrir tras el gate.
  syncFromHash();
}

function bootFailed(msg) {
  clear(bootEl);
  bootEl.hidden = false;
  bootEl.append(el('div', { class: 'empty' }, [
    el('div', { class: 'empty__icon', html: ICONS.sparkle }),
    el('h3', { text: 'Algo salió mal' }),
    el('p', { text: msg }),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, ['Reintentar']),
  ]));
}

// ── Acento de marca (portado de v1: SOLO tinte) ──────────────────────────────
function accentHex() {
  const c = store.state.client && store.state.client.brand_color;
  if (!c) return null;
  const v = c[0] === '#' ? c : '#' + c;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? v : null;
}
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function applyAccent() {
  const acc = accentHex();
  if (!acc) return;
  const rgb = hexToRgb(acc);
  appEl.style.setProperty('--accent', acc);
  detailEl.style.setProperty('--accent', acc);
  if (rgb) {
    appEl.style.setProperty('--accent-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},.16)`);
    appEl.style.setProperty('--accent-shadow', `rgba(${rgb.r},${rgb.g},${rgb.b},.40)`);
  }
}

// ── Header ───────────────────────────────────────────────────────────────────
function renderHeader() {
  clear(headerEl);
  const name = (store.state.client && store.state.client.name) || 'tu marca';
  const logoUrl = store.state.client && store.state.client.logo_url;

  const logo = el('div', { class: 'portal__logo', 'aria-hidden': 'true' });
  let safeLogo = null;
  if (logoUrl) {
    try {
      const u = new URL(String(logoUrl), location.origin);
      if (u.protocol === 'http:' || u.protocol === 'https:') safeLogo = u.href;
    } catch { safeLogo = null; }
  }
  if (safeLogo) {
    logo.append(el('img', {
      src: safeLogo, alt: '', loading: 'eager',
      onerror() { this.remove(); logo.textContent = initials(name); },
    }));
  } else {
    logo.textContent = initials(name);
  }

  headerEl.append(
    el('span', { class: 'portal__brandline', 'aria-hidden': 'true' }),
    logo,
    el('div', { class: 'portal__id' }, [
      el('div', { class: 'portal__name', text: name }),
      el('div', { class: 'portal__by' }, ['con ', el('span', { class: 'grad-text', text: 'IVAE Marketing' })]),
    ]),
    el('button', { class: 'btn btn-sm', type: 'button', onclick: logout }, [
      el('span', { class: 'ico', html: ICONS.logout, 'aria-hidden': 'true' }),
      el('span', { text: 'Salir' }),
    ]),
  );
}

async function logout() {
  try { await api.post('/auth/logout', {}); } catch { /* la sesion ya murio: igual salimos */ }
  location.replace('/marketing/');
}

// ── Tabs (2 botones 44px, contador pending+changes, persistencia) ────────────
function renderTabs() {
  clear(tabsEl);
  tabsEl.setAttribute('role', 'tablist');

  const count = store.awaitingCount();
  const inboxBtn = el('button', {
    class: 'ptab', type: 'button', role: 'tab', id: 'ptabInbox',
    'aria-selected': 'false', 'aria-controls': 'inbox',
    onclick: () => setTab('inbox'),
  }, [
    el('span', { text: 'Por aprobar' }),
    el('span', { class: 'ptab__count', dataset: { tabcount: '1' }, text: String(count), 'aria-label': `${count} pendientes` }),
  ]);
  const agendaBtn = el('button', {
    class: 'ptab', type: 'button', role: 'tab', id: 'ptabAgenda',
    'aria-selected': 'false', 'aria-controls': 'agenda',
    onclick: () => setTab('agenda'),
  }, [el('span', { text: 'Calendario' })]);

  tabsEl.append(inboxBtn, agendaBtn);
}

function setTab(tab) {
  store.setTab(tab);
}

function applyTab(tab) {
  const inboxBtn = document.getElementById('ptabInbox');
  const agendaBtn = document.getElementById('ptabAgenda');
  if (inboxBtn) inboxBtn.setAttribute('aria-selected', tab === 'inbox' ? 'true' : 'false');
  if (agendaBtn) agendaBtn.setAttribute('aria-selected', tab === 'agenda' ? 'true' : 'false');
  inboxEl.hidden = tab !== 'inbox';
  agendaEl.hidden = tab !== 'agenda';
  // Cambiar de tab te deja arriba: un pulgar, cero desorientacion.
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function updateTabCount() {
  const pill = tabsEl.querySelector('[data-tabcount]');
  if (!pill) return;
  const count = store.awaitingCount();
  pill.textContent = String(count);
  pill.setAttribute('aria-label', `${count} pendientes`);
  pill.style.display = count ? '' : 'none';
}

// ── Ruta #post=<id> (deep-link canonico: /marketing/client#post=<id>) ────────
function parseHash() {
  const m = /^#post=(.+)$/.exec(location.hash || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function openDetailRoute(id) {
  if (parseHash() === id) { detail.open(id); return; }
  detailPushed = true;
  location.hash = '#post=' + encodeURIComponent(id); // dispara hashchange
}

function closeDetailRoute() {
  if (!parseHash()) { detail.close(); return; }
  if (detailPushed) {
    history.back(); // popstate -> hashchange -> syncFromHash cierra
  } else {
    // Deep-link directo: no hay entrada previa nuestra en el history.
    history.replaceState(null, '', location.pathname + location.search);
    syncFromHash();
  }
}

function syncFromHash() {
  const id = parseHash();
  if (id) {
    detail.open(id);
  } else {
    detailPushed = false;
    detail.close();
  }
}

// El boton atras del telefono con un sheet abierto cierra el sheet, no navega:
// openSheet apilo un history state (pushLayer); ese pop ya consumio la capa,
// asi que cerrar aqui NO dispara otro history.back() (release() ve la capa
// fuera de la pila y no toca el history).
function onPopState() {
  if (openSheetCount() > 0) closeAllSheets();
  // Si no habia sheets, el hashchange (si lo hubo) resuelve la ruta del detalle.
}
