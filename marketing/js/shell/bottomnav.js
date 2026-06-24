// ============================================================================
// IVAE Marketing v2 — Bottom-nav movil (4 tabs) + FAB configurable.
//
// Tabs: Inicio (dashboard), Contenido (ultima vista de contenido usada),
//       Mi trabajo, Avisos (abre el panel de avisos, no navega).
// - fixed bottom 56px + env(safe-area-inset-bottom), blur, iconos 24 + label
//   10px, target completo >=44px, aria-current=page.
// - Badges: Avisos = no leidas (store.unreadCount); Mi trabajo = vencidos
//   (lo setea el modulo mi-trabajo via shell.setTabBadge('mi-trabajo', n)).
// - Re-tap en el tab activo: scroll suave al tope del contenedor de la vista.
// - FAB: setFab({label, onTap}) | null. Gradiente 56px sobre la nav.
// ============================================================================

import { el, clear } from '../api.js?v=202606240800';
import * as store from './store.js?v=202606240800';
import * as prefs from './prefs.js?v=202606240800';
import { icon } from './icons.js?v=202606240800';

// Lista canonica (prefs.js): calendario/tablero/tabla/timeline/carga.
const CONTENT_VIEWS = prefs.CONTENT_VIEWS;

export function createBottomNav({ root, fabHost, scrollEl, router, openNotifications }) {
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
    id: 'inicio', label: 'Inicio', ic: 'home',
    onTap: () => goOrTop('inicio'),
  });
  const tabContenido = makeTab({
    id: 'contenido', label: 'Contenido', ic: 'calendar',
    onTap: () => {
      const { view, activeClientId } = store.getState();
      if (CONTENT_VIEWS.includes(view)) { goOrTop(view); return; }
      goOrTop(prefs.lastContentView(activeClientId));
    },
  });
  const tabTrabajo = makeTab({
    id: 'mi-trabajo', label: 'Mi trabajo', ic: 'briefcase',
    onTap: () => goOrTop('mi-trabajo'),
  });
  const tabAvisos = makeTab({
    id: 'avisos', label: 'Avisos', ic: 'bell',
    onTap: () => openNotifications(tabAvisos),
  });

  // El cliente solo ve Contenido (su calendario) + Avisos. Sin Inicio ni Mi trabajo.
  if ((store.getState().me || {}).role === 'client') {
    clear(root).append(tabContenido, tabAvisos);
  } else {
    clear(root).append(tabInicio, tabContenido, tabTrabajo, tabAvisos);
  }

  // ── Parches quirurgicos ────────────────────────────────────────────────────
  function patchActive() {
    const { view } = store.getState();
    const activeTab =
      view === 'inicio' ? 'inicio' :
      CONTENT_VIEWS.includes(view) ? 'contenido' :
      view === 'mi-trabajo' ? 'mi-trabajo' : null;
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
  store.subscribe(['unreadCount'], patchUnread);
  patchActive(); patchUnread();

  // ── FAB ────────────────────────────────────────────────────────────────────
  let fabBtn = null;
  function setFab(cfg) {
    if (fabHost) clear(fabHost);
    fabBtn = null;
    if (!cfg || typeof cfg.onTap !== 'function') return;
    fabBtn = el('button', {
      class: 'fab', type: 'button', 'aria-label': cfg.label || 'Nuevo',
      onclick: cfg.onTap,
    }, [icon('plus', 24), el('span', { class: 'fab__label', text: cfg.label || 'Nuevo' })]);
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
