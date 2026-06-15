// ============================================================================
// IVAE Marketing v2 — Campana + panel de Avisos.
//
// - Badge alimentado por GET /notifications/unread-count cada 60s con
//   setTimeout ENCADENADO (no setInterval), refetch inmediato en
//   visibilitychange visible y tras cada mutacion propia (evento 'mutated').
// - Panel: overlay full-screen en movil / popover 380px anclado en desktop.
//   Tabs Todas / No leidas / Menciones / Asignadas (?filter=).
// - Marcar leida: optimista (el dot desaparece al instante, rollback si falla).
//   En el tab 'No leidas' la fila recien leida permanece atenuada hasta cerrar
//   el panel (patron Monday: permite revertir).
// - Tap en fila: deep-link #/post/<id> (con ?comment= si aplica).
// - DEGRADACION LIMPIA: si el endpoint devuelve 404 (migracion 004 sin
//   aplicar) se ocultan campana y tab Avisos y el polling se detiene.
// ============================================================================

import { api, el, clear, timeAgo, initials } from '../api.js?v=202606142255';
import * as store from './store.js?v=202606142255';
import { pushLayer } from './router.js?v=202606142255';
import { openSheet } from './sheet.js?v=202606142255';
import { toast } from './toast.js?v=202606142255';
import { icon } from './icons.js?v=202606142255';

const POLL_MS = 60000;
const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
  { id: 'mentions', label: 'Menciones' },
  { id: 'assigned', label: 'Asignadas' },
];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function createNotifications({ router, onUnavailable }) {
  let available = true;
  let pollTimer = 0;
  let overlay = null;
  let release = null;
  let activeFilter = 'all';
  let items = [];
  let justRead = new Set(); // ids leidos con el panel abierto (tab No leidas)

  // ── Polling de no leidas ───────────────────────────────────────────────────
  async function refreshUnread() {
    if (!available) return;
    try {
      const res = await api.get('/notifications/unread-count');
      const n = (res && (res.unread ?? res.count)) || 0;
      store.set({ unreadCount: Number(n) || 0 });
    } catch (e) {
      if (e && e.status === 404) markUnavailable();
      // Otros errores (red, 500): se reintenta en el siguiente ciclo.
    }
  }

  function schedule() {
    clearTimeout(pollTimer);
    if (!available) return;
    pollTimer = setTimeout(async () => { await refreshUnread(); schedule(); }, POLL_MS);
  }

  function markUnavailable() {
    if (!available) return;
    available = false;
    clearTimeout(pollTimer);
    store.set({ unreadCount: 0 });
    onUnavailable?.();
  }

  function start() {
    refreshUnread().then(schedule);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { refreshUnread(); schedule(); }
    });
    store.on('mutated', () => refreshUnread());
    store.on('notifications:read', () => refreshUnread());
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  function closePanel(info = {}) {
    if (!overlay) return;
    const o = overlay;
    overlay = null;
    justRead = new Set();
    o.classList.remove('is-open');
    setTimeout(() => o.remove(), 220);
    if (!info.fromHistory && !info.fromRouter && release) release();
    release = null;
  }

  function openPanel(anchor = null, { tab } = {}) {
    if (!available) { toast('Los avisos estarán disponibles cuando se aplique la migración 004.', { type: 'info' }); return; }
    if (overlay) { closePanel({ source: 'retap' }); return; }
    activeFilter = tab && FILTERS.some((f) => f.id === tab) ? tab : 'all';

    const desktop = window.matchMedia('(min-width: 1024px)').matches && anchor;
    const listEl = el('div', { class: 'nf-list', role: 'list' });
    const tabsEl = el('div', { class: 'nf-tabs seg', role: 'tablist' });

    const markAllBtn = el('button', {
      class: 'nf-markall', type: 'button', text: 'Marcar todas como leídas',
      onclick: () => markAll(),
    });

    overlay = el('div', {
      class: 'nf-overlay' + (desktop ? ' nf-overlay--desktop' : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Avisos',
    }, [
      el('div', { class: 'nf-panel' }, [
        el('div', { class: 'nf-head' }, [
          el('h2', { class: 'nf-title', text: 'Avisos' }),
          markAllBtn,
          el('button', {
            class: 'nf-close', type: 'button', 'aria-label': 'Cerrar',
            onclick: () => closePanel({ source: 'x' }),
          }, [icon('close', 18)]),
        ]),
        tabsEl,
        listEl,
      ]),
    ]);

    if (desktop) {
      const r = anchor.getBoundingClientRect();
      const panel = overlay.querySelector('.nf-panel');
      panel.style.top = `${r.bottom + 6}px`;
      panel.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel({ source: 'backdrop' }); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel({ source: 'esc' }); });

    function renderTabs() {
      clear(tabsEl);
      for (const f of FILTERS) {
        tabsEl.appendChild(el('button', {
          class: f.id === activeFilter ? 'is-active' : '', type: 'button',
          role: 'tab', 'aria-selected': f.id === activeFilter ? 'true' : 'false',
          text: f.label,
          onclick: () => { activeFilter = f.id; justRead = new Set(); renderTabs(); load(); },
        }));
      }
    }

    async function load() {
      clear(listEl);
      listEl.appendChild(el('div', { class: 'muted nf-loading', text: 'Cargando avisos' }));
      try {
        const res = await api.get(`/notifications?filter=${activeFilter}&limit=50`);
        items = Array.isArray(res) ? res : (res && res.notifications) || [];
        if (res && typeof res.unread === 'number') store.set({ unreadCount: res.unread });
        renderList();
      } catch (e) {
        clear(listEl);
        if (e && e.status === 404) {
          markUnavailable();
          closePanel({ source: 'unavailable' });
          return;
        }
        listEl.appendChild(el('div', { class: 'muted', text: e.message || 'No se pudieron cargar los avisos.' }));
      }
    }

    function renderList() {
      clear(listEl);
      const visible = activeFilter === 'unread'
        ? items.filter((n) => !n.read_at || justRead.has(n.id))
        : items;
      if (!visible.length) {
        listEl.appendChild(el('div', { class: 'nf-empty' }, [
          icon('check', 28),
          el('p', { text: 'Estás al día.' }),
        ]));
        return;
      }
      for (const n of visible) listEl.appendChild(row(n));
    }

    function row(n) {
      const unread = !n.read_at;
      const clientColor = clientDotColor(n.client_id);
      const node = el('div', {
        class: 'nf-row' + (unread ? ' is-unread' : '') + (justRead.has(n.id) ? ' is-justread' : ''),
        role: 'listitem',
      }, [
        el('span', { class: 'nf-row__avatar', text: initials(n.actor_name || 'IV') }),
        el('button', {
          class: 'nf-row__main', type: 'button',
          onclick: () => openItem(n),
        }, [
          el('span', { class: 'nf-row__body', text: n.body || '' }),
          el('span', { class: 'nf-row__meta' }, [
            clientColor ? el('span', { class: 'nf-row__client', style: { background: clientColor } }) : null,
            el('span', { class: 'nf-row__time', text: timeAgo(n.created_at) }),
          ]),
        ]),
        unread && !justRead.has(n.id) ? el('span', { class: 'nf-row__dot', 'aria-label': 'Sin leer' }) : null,
        el('button', {
          class: 'nf-row__more', type: 'button', 'aria-label': 'Más opciones',
          onclick: (e) => { e.stopPropagation(); rowMenu(n); },
        }, [icon('dots', 18)]),
      ]);
      return node;
    }

    function rowMenu(n) {
      const unread = !n.read_at;
      openSheet({
        title: 'Aviso',
        mode: 'menu',
        build(body, close) {
          body.append(
            el('button', {
              class: 'acct-row', type: 'button',
              onclick: () => { close(); setRead([n.id], unread); },
            }, [icon(unread ? 'check' : 'refresh', 20), el('span', { class: 'acct-row__label', text: unread ? 'Marcar como leída' : 'Marcar como no leída' })]),
            el('button', {
              class: 'acct-row acct-row--danger', type: 'button',
              onclick: () => { close(); removeItems([n.id]); },
            }, [icon('trash', 20), el('span', { class: 'acct-row__label', text: 'Eliminar' })]),
          );
        },
      });
    }

    async function openItem(n) {
      if (!n.read_at) setRead([n.id], true);
      if (n.post_id) {
        closePanel({ source: 'deeplink' });
        const params = { id: n.post_id };
        if (n.client_id) params.cliente = n.client_id;
        if (n.comment_id) params.comment = n.comment_id;
        router.navigate('post', params);
      }
    }

    async function setRead(ids, read) {
      // Optimista sobre la lista local + contador global.
      const prevItems = items;
      const prevUnread = store.getState().unreadCount;
      const now = new Date().toISOString();
      items = items.map((n) => (ids.includes(n.id) ? { ...n, read_at: read ? now : null } : n));
      if (read) ids.forEach((id) => justRead.add(id));
      else ids.forEach((id) => justRead.delete(id));
      store.set({ unreadCount: Math.max(0, prevUnread + (read ? -ids.length : ids.length)) });
      renderList();
      try {
        await api.post('/notifications/read', read ? { ids } : { ids, unread: true });
        store.emit('notifications:read', { ids, read });
      } catch (e) {
        items = prevItems;
        ids.forEach((id) => justRead.delete(id));
        store.set({ unreadCount: prevUnread });
        renderList();
        toast(e.message || 'No se pudo actualizar el aviso.', { type: 'error' });
      }
    }

    async function markAll() {
      const prevItems = items;
      const prevUnread = store.getState().unreadCount;
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      const now = new Date().toISOString();
      items = items.map((n) => (n.read_at ? n : { ...n, read_at: now }));
      unreadIds.forEach((id) => justRead.add(id));
      store.set({ unreadCount: 0 });
      renderList();
      try {
        await api.post('/notifications/read', { all: true });
        store.emit('notifications:read', { all: true });
      } catch (e) {
        items = prevItems;
        unreadIds.forEach((id) => justRead.delete(id));
        store.set({ unreadCount: prevUnread });
        renderList();
        toast(e.message || 'No se pudo marcar todo como leído.', { type: 'error' });
      }
    }

    async function removeItems(ids) {
      const prevItems = items;
      const removedUnread = items.filter((n) => ids.includes(n.id) && !n.read_at).length;
      const prevUnread = store.getState().unreadCount;
      items = items.filter((n) => !ids.includes(n.id));
      if (removedUnread) store.set({ unreadCount: Math.max(0, prevUnread - removedUnread) });
      renderList();
      try {
        await api.post('/notifications/delete', { ids });
      } catch (e) {
        items = prevItems;
        store.set({ unreadCount: prevUnread });
        renderList();
        toast(e.message || 'No se pudo eliminar el aviso.', { type: 'error' });
      }
    }

    function clientDotColor(clientId) {
      if (!clientId) return null;
      const c = store.getState().clients.find((x) => x.id === clientId);
      const col = c && c.brand_color;
      return HEX_RE.test(String(col || '')) ? col : null;
    }

    document.body.appendChild(overlay);
    release = pushLayer((info) => closePanel(info));
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    renderTabs();
    load();
  }

  return {
    start,
    openPanel,
    refreshNow: refreshUnread,
    get available() { return available; },
  };
}
