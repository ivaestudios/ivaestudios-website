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

import { api, el, clear, avatar, timeAgo, initials, copyText } from '../api.js?v=202607220117';
import * as store from './store.js?v=202607220117';
import { openSheet, pickFrom } from './sheet.js?v=202607220117';
import { toast } from './toast.js?v=202607220117';
import { icon } from './icons.js?v=202607220117';
import { openClientSwitcher } from './clientswitcher.js?v=202607220117';
import { T, isEN, setLang } from './i18n.js?v=202607220117';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

// Vianey solo usa Calendario (meses) + Cuadricula. Tablero/Tabla/Timeline/Carga
// se quitaron del admin por pedido suyo (sus vistas siguen en el repo, solo no
// se muestran como pestanas).
const DESKTOP_TABS = [
  { id: 'inicio', label: T('Inicio', 'Home') },
  { id: 'meses', label: T('Calendario', 'Calendar') },
  { id: 'calendario', label: T('Cuadrícula', 'Grid') },
  { id: 'entregables', label: T('Entregables', 'Deliverables') },
  { id: 'carrusel', label: T('Carrusel', 'Carousel') },
  { id: 'descargar', label: T('Descargar', 'Download') },
  { id: 'metricas', label: T('Métricas', 'Metrics') },
];

export function createTopbar({ root, router, selectClient, openSearch, openNotifications }) {
  let notifAvailable = true;
  // El cliente tiene UNA sola marca: el selector "Tus clientes" es de agencia
  // (solo staff). Para el cliente, la marca se muestra como etiqueta fija.
  const isClient = ((store.getState().me || {}).role === 'client');

  // ── Nodos persistentes ─────────────────────────────────────────────────────
  const clientDot = el('span', { class: 'tb-client__dot' });
  const clientName = el('span', { class: 'tb-client__name', text: T('Cargando', 'Loading') });
  const clientBtn = isClient
    ? el('div', { class: 'tb-client tb-client--static' }, [clientDot, clientName])
    : el('button', {
        class: 'tb-client', type: 'button',
        'aria-label': T('Cambiar de cliente', 'Switch client'), 'aria-haspopup': 'dialog',
        onclick: () => openClientSwitcher({ anchor: clientBtn, selectClient }),
      }, [clientDot, clientName, icon('down', 16)]);

  const tabsWrap = el('nav', { class: 'tb-tabs', 'aria-label': T('Vistas', 'Views') });
  const tabBtns = new Map();
  // El cliente solo ve las vistas de calendario (+ Métricas si es IVAE STUDIOS).
  const IVAE_STUDIOS_CLIENT_ID = '6ae5dd2381faa430d9e6966470b29602';
  const isIvaeStudiosClient = isClient && ((store.getState().me || {}).client_id === IVAE_STUDIOS_CLIENT_ID);
  const visibleTabs = isClient
    ? DESKTOP_TABS.filter((t) => t.id === 'meses' || t.id === 'calendario' || t.id === 'entregables' || (t.id === 'metricas' && isIvaeStudiosClient))
    : DESKTOP_TABS;
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
    class: 'tb-iconbtn', type: 'button', 'aria-label': T('Buscar', 'Search'),
    onclick: () => openSearch(),
  }, [icon('search', 22)]);

  const deskSearch = el('input', {
    class: 'input tb-search', type: 'search', placeholder: T('Buscar contenido o clientes', 'Search content or clients'),
    'aria-label': T('Buscar', 'Search'), readonly: true,
    onfocus: () => { deskSearch.blur(); openSearch(deskSearch); },
    onclick: () => openSearch(deskSearch),
  });

  const bellBadge = el('span', { class: 'tb-badge', hidden: true });
  const bellBtn = el('button', {
    class: 'tb-iconbtn tb-bell', type: 'button', 'aria-label': T('Avisos', 'Alerts'),
    onclick: () => openNotifications(bellBtn),
  }, [icon('bell', 22), bellBadge]);

  const avatarBtn = el('button', {
    class: 'tb-avatar', type: 'button', 'aria-label': T('Tu cuenta', 'Your account'),
    onclick: () => openAccountSheet(),
  });

  // Toggle de idioma VISIBLE en la esquina (además del que está en el menú de
  // cuenta): pastillas ES|EN. Cambia TODO el sistema y recarga.
  const langToggle = el('div', { class: 'tb-lang', role: 'group', 'aria-label': T('Idioma', 'Language') }, [
    el('button', {
      class: 'tb-lang__btn' + (isEN ? '' : ' is-active'), type: 'button',
      'aria-pressed': String(!isEN), title: 'Español', text: 'ES',
      onclick: () => { if (isEN) setLang('es'); },
    }),
    el('button', {
      class: 'tb-lang__btn' + (isEN ? ' is-active' : ''), type: 'button',
      'aria-pressed': String(isEN), title: 'English', text: 'EN',
      onclick: () => { if (!isEN) setLang('en'); },
    }),
  ]);

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
    langToggle,
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
      clientName.textContent = T('Todos los clientes', 'All clients');
      document.body.style.setProperty('--client-accent', 'var(--brand)');
      return;
    }
    const c = clients.find((x) => x.id === activeClientId);
    clientDot.style.background = c ? safeColor(c.brand_color) : 'var(--brand)';
    clientName.textContent = c ? c.name : T('Elige un cliente', 'Choose a client');
    document.body.style.setProperty('--client-accent', c ? safeColor(c.brand_color) : 'var(--brand)');
  }

  function patchUnread() {
    const { unreadCount } = store.getState();
    const n = Number(unreadCount) || 0;
    bellBadge.hidden = n <= 0;
    bellBadge.textContent = n > 9 ? '9+' : String(n);
    bellBtn.setAttribute('aria-label', n > 0 ? T(`Avisos, ${n} sin leer`, `Alerts, ${n} unread`) : T('Avisos', 'Alerts'));
    const base = T('Panel · IVAE Marketing', 'Dashboard · IVAE Marketing');
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

  // Selector de idioma ES/EN (dos pastillas). Cambia TODO el sistema y recarga.
  function langRow() {
    const mk = (code, label) => el('button', {
      class: 'lang-pill' + ((isEN ? 'en' : 'es') === code ? ' is-active' : ''),
      type: 'button', 'aria-pressed': String((isEN ? 'en' : 'es') === code),
      onclick: () => { if ((isEN ? 'en' : 'es') !== code) setLang(code); },
    }, [el('span', { text: label })]);
    return el('div', { class: 'acct-lang' }, [
      el('span', { class: 'acct-lang__label' }, [icon('globe', 18), el('span', { text: T('Idioma', 'Language') })]),
      el('div', { class: 'acct-lang__pills' }, [mk('es', 'ES'), mk('en', 'EN')]),
    ]);
  }

  function openAccountSheet() {
    const { me } = store.getState();
    openSheet({
      title: T('Tu cuenta', 'Your account'),
      mode: 'menu',
      anchor: avatarBtn,
      build(body, close) {
        body.append(
          el('div', { class: 'acct-head' }, [
            avatar(me ? me.name : ''),
            el('div', { class: 'acct-head__main' }, [
              el('div', { class: 'acct-head__name', text: me ? me.name : '' }),
              el('div', { class: 'acct-head__sub', text: me ? `${me.email} · ${me.role === 'admin' ? T('Administradora', 'Admin') : (me.role === 'client' ? T('Cliente', 'Client') : T('Equipo', 'Team'))}` : '' }),
            ]),
          ]),
          langRow(),
          // Herramientas de agencia: SOLO staff (el cliente no las ve).
          ...(me && me.role !== 'client' ? [
            accountRow('users', T('Equipo', 'Team'), () => { close(); openTeamSheet(); }),
            accountRow('link', T('Accesos de cliente', 'Client access'), () => { close(); openClientAccessSheet(); }),
            accountRow('activity', T('Actividad', 'Activity'), () => { close(); openActivitySheet(); }),
          ] : []),
          accountRow('bell', T('Ajustes de avisos', 'Notification settings'), () => { close(); openNotifications(bellBtn, { tab: 'all' }); }),
          accountRow('key', T('Cambiar contraseña', 'Change password'), () => { close(); openChangePassword(); }),
          // Ayuda: abre el WhatsApp de IVAE en una pestaña nueva.
          accountRow('send', T('Ayuda', 'Help'), () => {
            close();
            window.open('https://wa.me/5219902046514', '_blank', 'noopener');
          }),
          // Eliminar cuenta: SOLO el cliente (requisito Apple 5.1.1 — toda app
          // con registro debe dejar borrar la cuenta desde la propia app).
          ...(me && me.role === 'client' ? [
            accountRow('trash', T('Eliminar mi cuenta', 'Delete my account'), () => { close(); confirmDeleteAccount(); }, true),
          ] : []),
          accountRow('logout', T('Salir', 'Sign out'), async () => {
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
      title: T('Equipo', 'Team'),
      mode: 'menu',
      build(body) {
        const list = el('div', { class: 'acct-list', text: '' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: T('Cargando equipo', 'Loading team') }));
        body.appendChild(list);
        store.loadUsers().then((users) => {
          clear(list);
          if (!users || !users.length) {
            list.appendChild(el('div', { class: 'muted', text: T('Sin usuarios.', 'No users.') }));
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
                text: u.role === 'admin' ? 'Admin' : (u.role === 'client' ? T('Cliente', 'Client') : T('Equipo', 'Team')),
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
      title: T('Accesos de cliente', 'Client access'),
      mode: 'menu',
      build(body) {
        body.appendChild(el('p', { class: 'acct-intro', text: T('Cada cliente entra a su portal y ve solo el calendario de su empresa. Aquí creas su acceso (su correo es el usuario y tú le pasas la contraseña).', "Each client signs in to their portal and sees only their company's calendar. Here you create their access (their email is the username and you share the password with them).") }));
        const list = el('div', { class: 'acct-list' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: T('Cargando', 'Loading') }));
        body.appendChild(list);
        store.loadUsers().catch(() => []).then((users) => {
          clear(list);
          const clients = (store.getState().clients || []).filter((c) => !c.archived);
          if (!clients.length) {
            list.appendChild(el('div', { class: 'muted', text: T('Primero crea una marca/cliente.', 'Create a brand/client first.') }));
            return;
          }
          for (const c of clients) {
            const login = (users || []).find((u) => u.role === 'client' && u.client_id === c.id);
            list.appendChild(el('div', { class: 'acct-user' }, [
              el('span', { class: 'acct-user__dot', style: { background: c.brand_color || 'var(--brand)' } }),
              el('div', { class: 'acct-user__main' }, [
                el('div', { class: 'acct-user__name', text: c.name }),
                el('div', { class: 'acct-user__sub', text: login ? login.email : T('Sin acceso aún', 'No access yet') }),
              ]),
              login
                ? el('div', { class: 'acct-user__actions' }, [
                    el('button', { class: 'btn btn-sm', type: 'button', text: T('Editar', 'Edit'), onclick: () => openEditClientLogin(login, c) }),
                  ])
                : el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: T('Crear acceso', 'Create access'), onclick: () => openCreateClientLogin(c) }),
            ]));
          }
        });
      },
    });
  }

  function openCreateClientLogin(brand) {
    openSheet({
      title: `${T('Acceso para', 'Access for')} ${brand.name}`,
      mode: 'form',
      build(body, close) {
        const nameIn = el('input', { class: 'input', type: 'text', placeholder: T('Nombre del contacto', 'Contact name'), maxlength: '80' });
        const emailIn = el('input', { class: 'input', type: 'email', placeholder: T('correo@cliente.com', 'email@client.com'), maxlength: '120' });
        const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Crear acceso', 'Create access') });
        saveBtn.addEventListener('click', async () => {
          const name = nameIn.value.trim();
          const email = emailIn.value.trim();
          if (!name) { toast(T('Escribe el nombre del contacto.', 'Enter the contact name.'), { type: 'error' }); nameIn.focus(); return; }
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast(T('Escribe un correo válido.', 'Enter a valid email.'), { type: 'error' }); emailIn.focus(); return; }
          saveBtn.disabled = true;
          try {
            const u = await api.post('/users', { name, email, role: 'client', client_id: brand.id });
            store.invalidateUsers();
            close({ source: 'saved' });
            showClientCredentials({ brand, email, password: u && u.password });
          } catch (e) {
            toast(e.message || T('No se pudo crear el acceso.', 'Could not create the access.'), { type: 'error' });
            saveBtn.disabled = false;
          }
        });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Nombre del contacto', 'Contact name') }), nameIn]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Correo (será su usuario)', 'Email (will be their username)') }), emailIn]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
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
      title: `${T('Acceso de', 'Access for')} ${brand.name}`,
      mode: 'form',
      build(body, close) {
        const userIn = el('input', { class: 'input', type: 'text', value: login.email || '', maxlength: '120', 'aria-label': T('Usuario', 'Username') });
        const pwIn = el('input', { class: 'input', type: 'text', placeholder: T('Déjala en blanco para no cambiarla', 'Leave blank to keep it unchanged'), maxlength: '120', 'aria-label': T('Nueva contraseña', 'New password') });
        const genBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Generar', 'Generate'),
          title: T('Generar una contraseña al azar', 'Generate a random password'),
          onclick: () => { pwIn.value = 'ivae-' + Math.random().toString(36).slice(2, 7); },
        });
        const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar acceso', 'Save access') });
        saveBtn.addEventListener('click', async () => {
          const user = userIn.value.trim();
          const pw = pwIn.value.trim();
          if (!user) { toast(T('El usuario no puede quedar vacío.', 'The username cannot be empty.'), { type: 'error' }); userIn.focus(); return; }
          if (pw && pw.length < 6) { toast(T('La contraseña debe tener al menos 6 caracteres.', 'The password must be at least 6 characters.'), { type: 'error' }); pwIn.focus(); return; }
          const payload = {};
          if (user !== login.email) payload.email = user;
          if (pw) payload.password = pw;
          if (!Object.keys(payload).length) { close({ source: 'nochange' }); return; }
          saveBtn.disabled = true;
          try {
            await api.patch(`/users/${login.id}`, payload);
            store.invalidateUsers();
            close({ source: 'saved' });
            toast(T('Acceso actualizado.', 'Access updated.'), { type: 'success' });
            // Si cambió algo, ofrece copiar los datos nuevos para enviar.
            showClientCredentials({ brand, email: user, password: pw || T('(la misma de antes)', '(same as before)') });
          } catch (e) {
            toast(e.message || T('No se pudo guardar el acceso.', 'Could not save the access.'), { type: 'error' });
            saveBtn.disabled = false;
          }
        });
        body.append(
          el('p', { class: 'acct-intro', text: T('Cambia el usuario y/o la contraseña con los que tu cliente entra a su portal.', 'Change the username and/or password your client uses to sign in to their portal.') }),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Usuario', 'Username') }), userIn]),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Contraseña nueva', 'New password') }),
            el('div', { class: 'acct-pwrow' }, [pwIn, genBtn]),
          ]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
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
      toast(e.message || T('No se pudo restablecer la contraseña.', 'Could not reset the password.'), { type: 'error' });
    }
  }

  function credRow(label, value) {
    return el('div', { class: 'cred-row' }, [
      el('div', { class: 'cred-row__main' }, [
        el('div', { class: 'cred-row__label', text: label }),
        el('div', { class: 'cred-row__value', text: value }),
      ]),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Copiar', 'Copy'), onclick: async () => { await copyText(value); toast(T('Copiado.', 'Copied.'), { type: 'success' }); } }),
    ]);
  }

  function showClientCredentials({ brand, email, password }) {
    const url = 'https://ivaestudios.com/marketing/client';
    const msg = T(
      `Hola! Ya está listo tu calendario de contenido de ${brand.name}.\n\nEntra aquí para verlo y aprobarlo: ${url}\nUsuario: ${email}\nContraseña: ${password}\n\nVas a ver tu calendario por meses y puedes aprobar o pedir cambios en cada publicación.`,
      `Hi! Your ${brand.name} content calendar is ready.\n\nSign in here to view and approve it: ${url}\nUsername: ${email}\nPassword: ${password}\n\nYou'll see your calendar by month and you can approve or request changes on each post.`,
    );
    openSheet({
      title: T('Acceso listo', 'Access ready'),
      mode: 'menu',
      build(body, close) {
        body.append(
          el('p', { class: 'acct-intro', text: T(`Comparte estos datos con ${brand.name}. La contraseña se muestra una sola vez.`, `Share these details with ${brand.name}. The password is shown only once.`) }),
          credRow('Portal', url),
          credRow(T('Usuario', 'Username'), email),
          credRow(T('Contraseña', 'Password'), password || '—'),
          el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Copiar mensaje para enviar', 'Copy message to send'), onclick: async () => { await copyText(msg); toast(T('Mensaje copiado. Pégalo en WhatsApp.', 'Message copied. Paste it into WhatsApp.'), { type: 'success' }); } }),
          el('button', { class: 'btn', type: 'button', text: T('Listo', 'Done'), onclick: () => close({ source: 'done' }) }),
        );
      },
    });
  }

  // ── Actividad reciente ─────────────────────────────────────────────────────
  function openActivitySheet() {
    openSheet({
      title: T('Actividad reciente', 'Recent activity'),
      mode: 'menu',
      build(body) {
        const list = el('div', { class: 'acct-list' });
        list.appendChild(el('div', { class: 'muted acct-loading', text: T('Cargando actividad', 'Loading activity') }));
        body.appendChild(list);
        api.get('/activity?limit=50').then((rows) => {
          clear(list);
          if (!Array.isArray(rows) || !rows.length) {
            list.appendChild(el('div', { class: 'muted', text: T('Sin actividad todavía.', 'No activity yet.') }));
            return;
          }
          for (const a of rows) {
            list.appendChild(el('div', { class: 'acct-act' }, [
              el('span', { class: 'acct-act__avatar', text: initials(a.actor_name || '') }),
              el('div', { class: 'acct-act__main' }, [
                el('div', { class: 'acct-act__line', text: `${a.actor_name || T('Alguien', 'Someone')} · ${a.action || ''}` }),
                a.detail ? el('div', { class: 'acct-act__detail', text: a.detail }) : null,
              ]),
              el('span', { class: 'acct-act__time', text: timeAgo(a.created_at) }),
            ]));
          }
        }).catch((e) => {
          clear(list);
          list.appendChild(el('div', { class: 'muted', text: e.message || T('No se pudo cargar la actividad.', 'Could not load the activity.') }));
        });
      },
    });
  }

  // ── Eliminar mi cuenta (solo cliente; Apple 5.1.1) ────────────────────────
  // Confirmación fuerte en DOS pasos antes de borrar de verdad. Cancelar en
  // cualquiera de los dos (o cerrar el sheet) no toca nada.
  async function confirmDeleteAccount() {
    const primero = await pickFrom({
      title: T('¿Seguro? Se borra tu marca y contenido', 'Are you sure? Your brand and content will be deleted'),
      options: [
        { value: 'no', label: T('No, conservar mi cuenta', 'No, keep my account') },
        { value: 'si', label: T('Sí, quiero eliminarla', 'Yes, I want to delete it') },
      ],
    });
    if (primero !== 'si') return;
    const segundo = await pickFrom({
      title: T('Esta acción no se puede deshacer', 'This action cannot be undone'),
      options: [
        { value: 'no', label: T('Cancelar', 'Cancel') },
        { value: 'si', label: T('Sí, eliminar definitivamente', 'Yes, delete permanently') },
      ],
    });
    if (segundo !== 'si') return;
    try {
      await api.del('/auth/account');
      location.replace('/marketing/');
    } catch (e) {
      toast(e.message || T('No se pudo eliminar la cuenta. Escríbenos por WhatsApp.', 'Could not delete the account. Message us on WhatsApp.'), { type: 'error' });
    }
  }

  // ── Cambiar contraseña ─────────────────────────────────────────────────────
  function openChangePassword() {
    openSheet({
      title: T('Cambiar contraseña', 'Change password'),
      mode: 'form',
      build(body, close) {
        const cur = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: T('Contraseña actual', 'Current password') });
        const next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: T('Nueva contraseña (mínimo 6)', 'New password (min 6)') });
        const btn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save') });
        btn.addEventListener('click', async () => {
          if (!cur.value || next.value.length < 6) {
            toast(T('Revisa las contraseñas: la nueva necesita al menos 6 caracteres.', 'Check the passwords: the new one needs at least 6 characters.'), { type: 'error' });
            return;
          }
          btn.disabled = true;
          try {
            await api.post('/auth/change-password', { current: cur.value, next: next.value });
            toast(T('Contraseña actualizada.', 'Password updated.'), { type: 'success' });
            close({ source: 'saved' });
          } catch (e) {
            toast(e.message || T('No se pudo cambiar la contraseña.', 'Could not change the password.'), { type: 'error' });
            btn.disabled = false;
          }
        });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Contraseña actual', 'Current password') }), cur]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Nueva contraseña', 'New password') }), next]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
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
