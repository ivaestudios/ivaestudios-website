// ============================================================================
// IVAE Marketing v2 — Bottom-nav movil (4 tabs) + FAB configurable.
//
// Tabs del EQUIPO (22-nov-2026): Bandeja · Feed · Calendario · Resultados · Más
//       (Más abre una hoja con el resto; los avisos viven en la campana de arriba).
// Tabs del CLIENTE: Feed · Contenido · Avisos (sin cambios).
// - fixed bottom 56px + env(safe-area-inset-bottom), blur, iconos 24 + label
//   10px, target completo >=44px, aria-current=page.
// - Badges: Avisos = no leidas (store.unreadCount); Mi trabajo = vencidos
//   (lo setea el modulo mi-trabajo via shell.setTabBadge('mi-trabajo', n)).
// - Re-tap en el tab activo: scroll suave al tope del contenedor de la vista.
// - FAB: setFab({label, onTap}) | null. Gradiente 56px sobre la nav.
// ============================================================================

import { el, clear } from '../api.js?v=202611251430';
import * as store from './store.js?v=202611251430';
import * as prefs from './prefs.js?v=202611251430';
import { icon } from './icons.js?v=202611251430';
import { T } from './i18n.js?v=202611251430';
import { openSheet } from './sheet.js?v=202611251430';

// Lista canonica (prefs.js): calendario/tablero/tabla/timeline/carga.
const CONTENT_VIEWS = prefs.CONTENT_VIEWS;

export function createBottomNav({ root, fabHost, scrollEl, router, openNotifications, openSearch, openAccount }) {
  const badges = new Map(); // tabId -> badge element
  let notifAvailable = true;

  function makeTab({ id, label, ic, onTap }) {
    const badge = el('span', { class: 'bn-badge', hidden: true });
    badges.set(id, badge);
    const btn = el('button', {
      class: 'bn-tab', type: 'button', dataset: { tab: id },
      'aria-label': label,
      onclick: onTap,
    }, [
      el('span', { class: 'bn-tab__icowrap' }, [icon(ic, 24), badge]),
      el('span', { class: 'bn-tab__label', text: label }),
    ]);
    return btn;
  }

  function goOrTop(viewId) {
    const { view, activeClientId } = store.getState();
    if (view === viewId) {
      scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const params = {};
    if (activeClientId && viewId !== 'mi-trabajo') params.cliente = activeClientId;
    router.navigate(viewId, params);
  }

  const tabInicio = makeTab({
    id: 'inicio', label: T('Inicio', 'Home'), ic: 'home',
    onTap: () => goOrTop('inicio'),
  });
  const tabContenido = makeTab({
    id: 'contenido', label: T('Contenido', 'Content'), ic: 'calendar',
    onTap: () => {
      const { view, activeClientId } = store.getState();
      if (CONTENT_VIEWS.includes(view)) { goOrTop(view); return; }
      goOrTop(prefs.lastContentView(activeClientId));
    },
  });
  const tabTrabajo = makeTab({
    id: 'mi-trabajo', label: T('Mi trabajo', 'My work'), ic: 'briefcase',
    onTap: () => goOrTop('mi-trabajo'),
  });
  const tabAvisos = makeTab({
    id: 'avisos', label: T('Avisos', 'Alerts'), ic: 'bell',
    onTap: () => openNotifications(tabAvisos),
  });

  // El CLIENTE (17-nov-2026, Vianey): abajo van Feed · Contenido · Avisos.
  // Feed = sus publicaciones como Instagram; Contenido = los meses con sus
  // piezas en barritas (Video 1, Carrusel 1…). Las dos viven en views/contenido.js.
  function irCliente(tab) {
    const { view, activeClientId } = store.getState();
    if (view === 'contenido' && document.body.dataset.cntTab === tab) {
      router.navigate('contenido', { ...(activeClientId ? { cliente: activeClientId } : {}), tab });
      scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    router.navigate('contenido', { ...(activeClientId ? { cliente: activeClientId } : {}), tab });
  }
  const tabFeedCli = makeTab({ id: 'feed-cli', label: T('Feed', 'Feed'), ic: 'home', onTap: () => irCliente('feed') });
  const tabListaCli = makeTab({ id: 'lista-cli', label: T('Contenido', 'Content'), ic: 'calendar', onTap: () => irCliente('lista') });

  const esAdminBn = ((store.getState().me || {}).role === 'admin');
  const tabFeedAg = makeTab({ id: 'agencia', label: 'Feed', ic: 'home', onTap: () => goOrTop('agencia') });
  const tabCalendario = makeTab({ id: 'plan', label: T('Calendario', 'Calendar'), ic: 'calendar', onTap: () => goOrTop('plan') });
  const tabResultados = makeTab({ id: 'metricas', label: T('Resultados', 'Results'), ic: 'activity', onTap: () => goOrTop('metricas') });
  // Las que empiezan con "_" no son vistas: Buscar y Tu cuenta (en el celular
  // del equipo ya no están arriba, como en el diseño aprobado).
  const ACCIONES_MAS = { _buscar: () => openSearch?.(), _cuenta: () => openAccount?.() };
  const MAS = [
    ...(openSearch ? [['_buscar', T('Buscar', 'Search'), 'search']] : []),
    ['contenido', T('Vista cliente', 'Client view'), 'eye'],
    ['inicio', T('Inicio', 'Home'), 'home'],
    ['mi-trabajo', T('Mi trabajo', 'My work'), 'briefcase'],
    ['meses', T('Hoja del mes', 'Month sheet'), 'table'],
    ['calendario', T('Cuadrícula', 'Grid'), 'board'],
    ['entregables', T('Entregables', 'Deliverables'), 'archive'],
    ['marca', T('Marca', 'Brand'), 'book'],
    ['carrusel', T('Carrusel', 'Carousel'), 'copy'],
    ['video-ia', T('Video IA', 'AI video'), 'play'],
    ['descargar', T('Descargar', 'Download'), 'download'],
    ['conexiones', T('Conexiones', 'Connections'), 'link'],
    ['asistente', T('Asistente', 'Assistant'), 'sparkles'],
    ['feed', T('Simulador de Instagram', 'Instagram preview'), 'camera'],
  ].concat(esAdminBn ? [['administracion', T('Administración', 'Administration'), 'gauge'], ['pauta', T('Pauta', 'Ads'), 'zap']] : [])
    .concat(openAccount ? [['_cuenta', T('Tu cuenta', 'Your account'), 'user']] : []);
  const MAS_VIEWS = MAS.map(([id]) => id).filter((id) => !id.startsWith('_'));
  const tabMas = makeTab({
    id: 'mas', label: T('Más', 'More'), ic: 'dots',
    onTap: () => openSheet({
      title: T('Más', 'More'), mode: 'menu',
      build(body, close) {
        const { view } = store.getState();
        body.appendChild(el('div', { class: 'bn-mas' }, MAS.map(([id, label, ic]) => el('button', {
          type: 'button', class: id === view ? 'is-on' : '',
          onclick: () => { close({ source: 'mas' }); if (ACCIONES_MAS[id]) ACCIONES_MAS[id](); else goOrTop(id); },
        }, [icon(ic, 20), el('span', { text: label })]))));
      },
    }),
  });

  // Bandeja con equipo (migración 040): el agente de la marca solo trabaja en
  // la Bandeja; el supervisor ve su Contenido y la Bandeja.
  const tabBandeja = makeTab({
    id: 'bandeja', label: T('Bandeja', 'Inbox'), ic: 'inbox',
    onTap: () => goOrTop('bandeja'),
  });
  const meBn = store.getState().me || {};
  // El cliente solo ve Contenido (su calendario) + Avisos. Sin Inicio ni Mi trabajo.
  if (meBn.role === 'client' && (meBn.bandeja_rol === 'agente' || (meBn.bandeja_rol && meBn.solo_crm))) {
    clear(root).append(tabBandeja, tabAvisos);
  } else if (meBn.role === 'client' && meBn.bandeja_rol === 'supervisor') {
    clear(root).append(tabContenido, tabBandeja, tabAvisos);
  } else if (meBn.role === 'client') {
    clear(root).append(tabFeedCli, tabListaCli, tabAvisos);
  } else {
    // EQUIPO (22-nov-2026, rediseño de agencias aprobado por Vianey): igual que
    // en la compu, Bandeja · Feed · Calendario · Resultados · Más. Los avisos
    // siguen en la campana de arriba; lo demás vive en Más.
    clear(root).append(tabBandeja, tabFeedAg, tabCalendario, tabResultados, tabMas);
  }

  // ── Parches quirurgicos ────────────────────────────────────────────────────
  function patchActive() {
    const { view } = store.getState();
    const cli = (store.getState().me || {}).role === 'client' && root.querySelector('[data-tab="feed-cli"]');
    const equipo = (store.getState().me || {}).role !== 'client';
    const activeTab = equipo ? (
      view === 'agencia' ? 'agencia' :
      view === 'bandeja' ? 'bandeja' :
      view === 'metricas' ? 'metricas' :
      view === 'plan' ? 'plan' :
      MAS_VIEWS.includes(view) ? 'mas' :
      CONTENT_VIEWS.includes(view) ? 'plan' : null
    ) :
      (cli && view === 'contenido') ? (document.body.dataset.cntTab === 'lista' ? 'lista-cli' : (document.body.dataset.cntTab === 'feed' ? 'feed-cli' : null)) :
      view === 'inicio' ? 'inicio' :
      CONTENT_VIEWS.includes(view) ? 'contenido' :
      view === 'mi-trabajo' ? 'mi-trabajo' :
      view === 'bandeja' ? 'bandeja' : null;
    for (const btn of root.querySelectorAll('.bn-tab')) {
      const is = btn.dataset.tab === activeTab;
      btn.classList.toggle('is-active', is);
      if (is) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    }
  }

  function patchUnread() {
    const n = Number(store.getState().unreadCount) || 0;
    setBadge('avisos', n);
  }

  function setBadge(tabId, n) {
    const b = badges.get(tabId);
    if (!b) return;
    const num = Number(n) || 0;
    b.hidden = num <= 0;
    b.textContent = num > 9 ? '9+' : String(num);
  }

  store.subscribe(['view'], patchActive);
  window.addEventListener('cnt:tab', patchActive);
  store.subscribe(['unreadCount'], patchUnread);
  patchActive(); patchUnread();

  // ── FAB ────────────────────────────────────────────────────────────────────
  let fabBtn = null;
  function setFab(cfg) {
    if (fabHost) clear(fabHost);
    fabBtn = null;
    if (!cfg || typeof cfg.onTap !== 'function') return;
    fabBtn = el('button', {
      class: 'fab', type: 'button', 'aria-label': cfg.label || T('Nuevo', 'New'),
      onclick: cfg.onTap,
    }, [icon('plus', 24), el('span', { class: 'fab__label', text: cfg.label || T('Nuevo', 'New') })]);
    fabHost.appendChild(fabBtn);
  }

  return {
    setFab,
    setTabBadge: setBadge,
    /** 404 de /notifications: el tab Avisos se oculta (quedan 3 tabs). */
    setNotifAvailable(ok) {
      notifAvailable = !!ok;
      tabAvisos.hidden = !notifAvailable;
      root.classList.toggle('bn--three', !notifAvailable);
    },
  };
}
