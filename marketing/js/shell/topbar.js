// ============================================================================
// IVAE Marketing v2 — Topbar (56px fija, blur).
//
// MOVIL:  [switcher de cliente truncado] [lupa 44] [campana 44 + badge] [avatar 32]
// DESKTOP >=1024px: ademas tabs de vista inline (Inicio Calendario Tablero
// Tabla Timeline Carga) con subrayado gradiente y busqueda inline de 280px.
//
// Chrome montado UNA sola vez; despues solo parches quirurgicos via
// store.subscribe (badge, nombre del cliente, tab activa). Nada de re-render
// total: jamas se pierde el foco.
// ============================================================================

import { api, el, clear, avatar, timeAgo, initials } from '../api.js';
import * as store from './store.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { icon } from './icons.js';
import { openClientSwitcher } from './clientswitcher.js';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

const DESKTOP_TABS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'meses', label: 'Calendario' },
  { id: 'calendario', label: 'Cuadrícula' },
  { id: 'tablero', label: 'Tablero' },
  { id: 'tabla', label: 'Tabla' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'carga', label: 'Carga' },
];

export function createTopbar({ root, router, selectClient, openSearch, openNotifications }) {
  let notifAvailable = true;

  // ── Nodos persistentes ─────────────────────────────────────────────────────
  const clientDot = el('span', { class: 'tb-client__dot' });
  const clientName = el('span', { class: 'tb-client__name', text: 'Cargando' });
  const clientBtn = el('button', {
    class: 'tb-client', type: 'button',
    'aria-label': 'Cambiar de cliente', 'aria-haspopup': 'dialog',
    onclick: () => openClientSwitcher({ anchor: clientBtn, selectClient }),
  }, [clientDot, clientName, icon('down', 16)]);

  const tabsWrap = el('nav', { class: 'tb-tabs', 'aria-label': 'Vistas' });
  const tabBtns = new Map();
  for (const t of DESKTOP_TABS) {
    const b = el('button', {
      class: 'tb-tab', type: 'button', text: t.label,
      onclick: () => {
        const { activeClientId } = store.getState();
        router.navigate(t.id, activeClientId ? { cliente: activeClientId } : {});
      },
    });
    tabBtns.set(t.id, b);
    tabsWrap.appendChild(b);
  }

  const searchBtn = el('button', {
    class: 'tb-iconbtn', type: 'button', 'aria-label': 'Buscar',
    onclick: () => openSearch(),
  }, [icon('search', 22)]);

  const deskSearch = el('input', {
    class: 'input tb-search', type: 'search', placeholder: 'Buscar contenido o clientes',
    'aria-label': 'Buscar', readonly: true,
    onfocus: () => { deskSearch.blur(); openSearch(deskSearch); },
    onclick: () => openSearch(deskSearch),
  });

  const bellBadge = el('span', { class: 'tb-badge', hidden: true });
  const bellBtn = el('button', {
    class: 'tb-iconbtn tb-bell', type: 'button', 'aria-label': 'Avisos',
    onclick: () => openNotifications(bellBtn),
  }, [icon('bell', 22), bellBadge]);

  const avatarBtn = el('button', {
    class: 'tb-avatar', type: 'button', 'aria-label': 'Tu cuenta',
    onclick: () => openAccountSheet(),
  });

  const bar = el('div', { class: 'tb-inner' }, [
    clientBtn,
    tabsWrap,
    el('div', { class: 'tb-spacer' }),
    deskSearch,
    searchBtn,
    bellBtn,
    avatarBtn,
  ]);
  const accent = el('div', { class: 'tb-accent' });
  clear(root).append(bar, accent);

  // ── Parches quirurgicos ────────────────────────────────────────────────────
  function patchClient() {
    const { clients, activeClientId } = store.getState();
    if (activeClientId === 'todos') {
      clientDot.style.background = 'var(--brand)';
      clientName.textContent = 'Todos los clientes';
      document.body.style.setProperty('--client-accent', 'var(--brand)');
      return;
    }
    const c = clients.find((x) => x.id === activeClientId);
    clientDot.style.background = c ? safeColor(c.brand_color) : 'var(--brand)';
    clientName.textContent = c ? c.name : 'Elige un cliente';
    document.body.style.setProperty('--client-accent', c ? safeColor(c.brand_color) : 'var(--brand)');
  }

  function patchUnread() {
    const { unreadCount } = store.getState();
    const n = Number(unreadCount) || 0;
    bellBadge.hidden = n <= 0;
    bellBadge.textContent = n > 9 ? '9+' : String(n);
    bellBtn.setAttribute('aria-label', n > 0 ? `Avisos, ${n} sin leer` : 'Avisos');
    const base = 'Panel · IVAE Marketing';
    document.title = n > 0 ? `(${n}) ${base}` : base;
  }

  function patchView() {
    const { view } = store.getState();
    for (const [id, b] of tabBtns) {
      const is = id === view;
      b.classList.toggle('is-active', is);
      if (is) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
  }

  function patchMe() {
    const { me } = store.getState();
    clear(avatarBtn).appendChild(avatar(me ? me.name : ''));
  }

  store.subscribe(['clients', 'activeClientId'], patchClient);
  store.subscribe(['unreadCount'], patchUnread);
  store.subscribe(['view'], patchView);
  store.subscribe(['me'], patchMe);
  patchClient(); patchUnread(); patchView(); patchMe();

  // ── Sheet de cuenta ────────────────────────────────────────────────────────
  function accountRow(ic, label, onTap, danger = false) {
    return el('button', {
      class: 'acct-row' + (danger ? ' acct-row--danger' : ''), type: 'button', onclick: onTap,
    }, [icon(ic, 20), el('span', { class: 'acct-row__label', text: label }), icon('right', 16)]);
  }

  function openAccountSheet() {
    const { me } = store.getState();
    openSheet({
      title: 'Tu cuenta',
      mode: 'menu',
      anchor: avatarBtn,
      build(body, close) {
        body.append(
          el('div', { class: 'acct-head' }, [
            avatar(me ? me.name : ''),
            el('div', { class: 'acct-head__main' }, [
              el('div', { class: 'acct-head__name', text: me ? me.name : '' }),
              el('div', { class: 'acct-head__sub', text: me ? `${me.email} · ${me.role === 'admin' ? 'Administradora' : 'Equipo'}` : '' }),
            ]),
          ]),
          accountRow('users', 'Equipo', () => { close(); openTeamSheet(); }),
          accountRow('activity', 'Actividad', () => { close(); openActivitySheet(); }),
          accountRow('bell', 'Ajustes de avisos', () => { close(); openNotifications(bellBtn, { tab: 'all' }); }),
          accountRow('key', 'Cambiar contraseña', () => { close(); openChangePassword(); }),
          accountRow('logout', 'Salir', async () => {
            close();
            try { await api.post('/auth/logout'); } catch { /* la cookie muere igual */ }
            location.replace('/marketing/');
          }, true),
        );
      },
    });
  }

  // ── Equipo (lista de usuarios staff) ───────────────────────────────────────
  function openTeamSheet() {
    openSheet({
      title: 'Equipo',
      mode: 'menu',
      build(body) {
        const list = el('div', { class: 'acct-list', text: '' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: 'Cargando equipo' }));
        body.appendChild(list);
        store.loadUsers().then((users) => {
          clear(list);
          if (!users || !users.length) {
            list.appendChild(el('div', { class: 'muted', text: 'Sin usuarios.' }));
            return;
          }
          for (const u of users) {
            list.appendChild(el('div', { class: 'acct-user' }, [
              avatar(u.name),
              el('div', { class: 'acct-user__main' }, [
                el('div', { class: 'acct-user__name', text: u.name || u.email }),
                el('div', { class: 'acct-user__sub', text: u.email || '' }),
              ]),
              el('span', {
                class: 'tag role-tag',
                text: u.role === 'admin' ? 'Admin' : (u.role === 'client' ? 'Cliente' : 'Equipo'),
              }),
            ]));
          }
        });
      },
    });
  }

  // ── Actividad reciente ─────────────────────────────────────────────────────
  function openActivitySheet() {
    openSheet({
      title: 'Actividad reciente',
      mode: 'menu',
      build(body) {
        const list = el('div', { class: 'acct-list' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: 'Cargando actividad' }));
        body.appendChild(list);
        api.get('/activity?limit=50').then((rows) => {
          clear(list);
          if (!Array.isArray(rows) || !rows.length) {
            list.appendChild(el('div', { class: 'muted', text: 'Sin actividad todavía.' }));
            return;
          }
          for (const a of rows) {
            list.appendChild(el('div', { class: 'acct-act' }, [
              el('span', { class: 'acct-act__avatar', text: initials(a.actor_name || '') }),
              el('div', { class: 'acct-act__main' }, [
                el('div', { class: 'acct-act__line', text: `${a.actor_name || 'Alguien'} · ${a.action || ''}` }),
                a.detail ? el('div', { class: 'acct-act__detail', text: a.detail }) : null,
              ]),
              el('span', { class: 'acct-act__time', text: timeAgo(a.created_at) }),
            ]));
          }
        }).catch((e) => {
          clear(list);
          list.appendChild(el('div', { class: 'muted', text: e.message || 'No se pudo cargar la actividad.' }));
        });
      },
    });
  }

  // ── Cambiar contraseña ─────────────────────────────────────────────────────
  function openChangePassword() {
    openSheet({
      title: 'Cambiar contraseña',
      mode: 'form',
      build(body, close) {
        const cur = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña actual' });
        const next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'Nueva contraseña (mínimo 6)' });
        const btn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar' });
        btn.addEventListener('click', async () => {
          if (!cur.value || next.value.length < 6) {
            toast('Revisa las contraseñas: la nueva necesita al menos 6 caracteres.', { type: 'error' });
            return;
          }
          btn.disabled = true;
          try {
            await api.post('/auth/change-password', { current: cur.value, next: next.value });
            toast('Contraseña actualizada.', { type: 'success' });
            close({ source: 'saved' });
          } catch (e) {
            toast(e.message || 'No se pudo cambiar la contraseña.', { type: 'error' });
            btn.disabled = false;
          }
        });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Contraseña actual' }), cur]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Nueva contraseña' }), next]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            btn,
          ]),
        );
        setTimeout(() => cur.focus(), 50);
      },
    });
  }

  return {
    el: root,
    /** Oculta la campana si /notifications devuelve 404 (004 sin aplicar). */
    setNotifAvailable(ok) {
      notifAvailable = !!ok;
      bellBtn.hidden = !notifAvailable;
    },
    get notifAvailable() { return notifAvailable; },
  };
}
