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

import { api, el, clear, avatar, timeAgo, initials, copyText } from '../api.js?v=202606200700';
import * as store from './store.js?v=202606200700';
import { openSheet } from './sheet.js?v=202606200700';
import { toast } from './toast.js?v=202606200700';
import { icon } from './icons.js?v=202606200700';
import { openClientSwitcher } from './clientswitcher.js?v=202606200700';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

// Vianey solo usa Calendario (meses) + Cuadricula. Tablero/Tabla/Timeline/Carga
// se quitaron del admin por pedido suyo (sus vistas siguen en el repo, solo no
// se muestran como pestanas).
const DESKTOP_TABS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'meses', label: 'Calendario' },
  { id: 'calendario', label: 'Cuadrícula' },
  { id: 'metricas', label: 'Métricas' },
];

export function createTopbar({ root, router, selectClient, openSearch, openNotifications }) {
  let notifAvailable = true;
  // El cliente tiene UNA sola marca: el selector "Tus clientes" es de agencia
  // (solo staff). Para el cliente, la marca se muestra como etiqueta fija.
  const isClient = ((store.getState().me || {}).role === 'client');

  // ── Nodos persistentes ─────────────────────────────────────────────────────
  const clientDot = el('span', { class: 'tb-client__dot' });
  const clientName = el('span', { class: 'tb-client__name', text: 'Cargando' });
  const clientBtn = isClient
    ? el('div', { class: 'tb-client tb-client--static' }, [clientDot, clientName])
    : el('button', {
        class: 'tb-client', type: 'button',
        'aria-label': 'Cambiar de cliente', 'aria-haspopup': 'dialog',
        onclick: () => openClientSwitcher({ anchor: clientBtn, selectClient }),
      }, [clientDot, clientName, icon('down', 16)]);

  const tabsWrap = el('nav', { class: 'tb-tabs', 'aria-label': 'Vistas' });
  const tabBtns = new Map();
  // El cliente solo ve las dos vistas de calendario.
  const visibleTabs = isClient ? DESKTOP_TABS.filter((t) => t.id === 'meses' || t.id === 'calendario') : DESKTOP_TABS;
  for (const t of visibleTabs) {
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

  // Logo de marca "iv ESTUDIOS" (diseño Sistema IVA). Aditivo: no cambia el
  // resto del topbar. En el cliente no se muestra (su portal es de su marca).
  const brand = isClient ? null : el('div', { class: 'tb-brand', 'aria-hidden': 'true' }, [
    el('span', { class: 'tb-brand__mark', text: 'iv' }),
    el('span', { class: 'tb-brand__word', text: 'Estudios' }),
  ]);
  const bar = el('div', { class: 'tb-inner' }, [
    ...(brand ? [brand] : []),
    clientBtn,
    tabsWrap,
    el('div', { class: 'tb-spacer' }),
    // La busqueda (contenido o clientes) es de agencia: no para el cliente.
    ...(isClient ? [] : [deskSearch, searchBtn]),
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
          // Herramientas de agencia: SOLO staff (el cliente no las ve).
          ...(me && me.role !== 'client' ? [
            accountRow('users', 'Equipo', () => { close(); openTeamSheet(); }),
            accountRow('link', 'Accesos de cliente', () => { close(); openClientAccessSheet(); }),
            accountRow('activity', 'Actividad', () => { close(); openActivitySheet(); }),
          ] : []),
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

  // ── Accesos de cliente (login por empresa: el cliente ve SOLO su calendario) ─
  function openClientAccessSheet() {
    openSheet({
      title: 'Accesos de cliente',
      mode: 'menu',
      build(body) {
        body.appendChild(el('p', { class: 'acct-intro', text: 'Cada cliente entra a su portal y ve solo el calendario de su empresa. Aquí creas su acceso (su correo es el usuario y tú le pasas la contraseña).' }));
        const list = el('div', { class: 'acct-list' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: 'Cargando' }));
        body.appendChild(list);
        store.loadUsers().catch(() => []).then((users) => {
          clear(list);
          const clients = (store.getState().clients || []).filter((c) => !c.archived);
          if (!clients.length) {
            list.appendChild(el('div', { class: 'muted', text: 'Primero crea una marca/cliente.' }));
            return;
          }
          for (const c of clients) {
            const login = (users || []).find((u) => u.role === 'client' && u.client_id === c.id);
            list.appendChild(el('div', { class: 'acct-user' }, [
              el('span', { class: 'acct-user__dot', style: { background: c.brand_color || 'var(--brand)' } }),
              el('div', { class: 'acct-user__main' }, [
                el('div', { class: 'acct-user__name', text: c.name }),
                el('div', { class: 'acct-user__sub', text: login ? login.email : 'Sin acceso aún' }),
              ]),
              login
                ? el('div', { class: 'acct-user__actions' }, [
                    el('button', { class: 'btn btn-sm', type: 'button', text: 'Editar', onclick: () => openEditClientLogin(login, c) }),
                  ])
                : el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Crear acceso', onclick: () => openCreateClientLogin(c) }),
            ]));
          }
        });
      },
    });
  }

  function openCreateClientLogin(brand) {
    openSheet({
      title: `Acceso para ${brand.name}`,
      mode: 'form',
      build(body, close) {
        const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Nombre del contacto', maxlength: '80' });
        const emailIn = el('input', { class: 'input', type: 'email', placeholder: 'correo@cliente.com', maxlength: '120' });
        const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear acceso' });
        saveBtn.addEventListener('click', async () => {
          const name = nameIn.value.trim();
          const email = emailIn.value.trim();
          if (!name) { toast('Escribe el nombre del contacto.', { type: 'error' }); nameIn.focus(); return; }
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Escribe un correo válido.', { type: 'error' }); emailIn.focus(); return; }
          saveBtn.disabled = true;
          try {
            const u = await api.post('/users', { name, email, role: 'client', client_id: brand.id });
            store.invalidateUsers();
            close({ source: 'saved' });
            showClientCredentials({ brand, email, password: u && u.password });
          } catch (e) {
            toast(e.message || 'No se pudo crear el acceso.', { type: 'error' });
            saveBtn.disabled = false;
          }
        });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Nombre del contacto' }), nameIn]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Correo (será su usuario)' }), emailIn]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            saveBtn,
          ]),
        );
        setTimeout(() => nameIn.focus(), 50);
      },
    });
  }

  // Editar el acceso del cliente: cambiar usuario y/o contraseña a tu gusto.
  function openEditClientLogin(login, brand) {
    openSheet({
      title: `Acceso de ${brand.name}`,
      mode: 'form',
      build(body, close) {
        const userIn = el('input', { class: 'input', type: 'text', value: login.email || '', maxlength: '120', 'aria-label': 'Usuario' });
        const pwIn = el('input', { class: 'input', type: 'text', placeholder: 'Déjala en blanco para no cambiarla', maxlength: '120', 'aria-label': 'Nueva contraseña' });
        const genBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: 'Generar',
          title: 'Generar una contraseña al azar',
          onclick: () => { pwIn.value = 'ivae-' + Math.random().toString(36).slice(2, 7); },
        });
        const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar acceso' });
        saveBtn.addEventListener('click', async () => {
          const user = userIn.value.trim();
          const pw = pwIn.value.trim();
          if (!user) { toast('El usuario no puede quedar vacío.', { type: 'error' }); userIn.focus(); return; }
          if (pw && pw.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', { type: 'error' }); pwIn.focus(); return; }
          const payload = {};
          if (user !== login.email) payload.email = user;
          if (pw) payload.password = pw;
          if (!Object.keys(payload).length) { close({ source: 'nochange' }); return; }
          saveBtn.disabled = true;
          try {
            await api.patch(`/users/${login.id}`, payload);
            store.invalidateUsers();
            close({ source: 'saved' });
            toast('Acceso actualizado.', { type: 'success' });
            // Si cambió algo, ofrece copiar los datos nuevos para enviar.
            showClientCredentials({ brand, email: user, password: pw || '(la misma de antes)' });
          } catch (e) {
            toast(e.message || 'No se pudo guardar el acceso.', { type: 'error' });
            saveBtn.disabled = false;
          }
        });
        body.append(
          el('p', { class: 'acct-intro', text: 'Cambia el usuario y/o la contraseña con los que tu cliente entra a su portal.' }),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Usuario' }), userIn]),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: 'Contraseña nueva' }),
            el('div', { class: 'acct-pwrow' }, [pwIn, genBtn]),
          ]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            saveBtn,
          ]),
        );
        setTimeout(() => userIn.focus(), 50);
      },
    });
  }

  async function resetClientPw(login, brand) {
    try {
      const r = await api.post(`/users/${login.id}/reset-password`);
      showClientCredentials({ brand, email: login.email, password: r && r.password });
    } catch (e) {
      toast(e.message || 'No se pudo restablecer la contraseña.', { type: 'error' });
    }
  }

  function credRow(label, value) {
    return el('div', { class: 'cred-row' }, [
      el('div', { class: 'cred-row__main' }, [
        el('div', { class: 'cred-row__label', text: label }),
        el('div', { class: 'cred-row__value', text: value }),
      ]),
      el('button', { class: 'btn btn-sm', type: 'button', text: 'Copiar', onclick: async () => { await copyText(value); toast('Copiado.', { type: 'success' }); } }),
    ]);
  }

  function showClientCredentials({ brand, email, password }) {
    const url = 'https://ivaestudios.com/marketing/client';
    const msg = `Hola! Ya está listo tu calendario de contenido de ${brand.name}.\n\nEntra aquí para verlo y aprobarlo: ${url}\nUsuario: ${email}\nContraseña: ${password}\n\nVas a ver tu calendario por meses y puedes aprobar o pedir cambios en cada publicación.`;
    openSheet({
      title: 'Acceso listo',
      mode: 'menu',
      build(body, close) {
        body.append(
          el('p', { class: 'acct-intro', text: `Comparte estos datos con ${brand.name}. La contraseña se muestra una sola vez.` }),
          credRow('Portal', url),
          credRow('Usuario', email),
          credRow('Contraseña', password || '—'),
          el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Copiar mensaje para enviar', onclick: async () => { await copyText(msg); toast('Mensaje copiado. Pégalo en WhatsApp.', { type: 'success' }); } }),
          el('button', { class: 'btn', type: 'button', text: 'Listo', onclick: () => close({ source: 'done' }) }),
        );
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
