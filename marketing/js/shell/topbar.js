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

import { api, el, clear, avatar, timeAgo, initials, copyText } from '../api.js?v=202608061655';
import * as store from './store.js?v=202608061655';
import { openSheet, pickFrom } from './sheet.js?v=202608061655';
import { toast } from './toast.js?v=202608061655';
import { icon } from './icons.js?v=202608061655';
import { openClientSwitcher } from './clientswitcher.js?v=202608061655';
import { T, isEN, setLang } from './i18n.js?v=202608061655';
import { getTheme, setTheme } from './theme.js?v=202608061655';
import * as version from './version.js?v=202608061655';

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
  // El cliente solo ve las vistas de calendario (+ Métricas si su marca está
  // en la lista aprobada). MISMA lista que shell.js — cámbialas juntas.
  const CLIENT_METRICS_IDS = [
    '6ae5dd2381faa430d9e6966470b29602', // IVAE STUDIOS
    'demo-regeneris',                    // REGENERIS THERAPY (pedido 2026-07-29)
    '67322bb3c5f64991a9178b1d1784231a',  // DEMO (revisores de App Store / Play)
  ];
  const clientSeesMetrics = isClient && CLIENT_METRICS_IDS.includes((store.getState().me || {}).client_id);
  const visibleTabs = isClient
    ? DESKTOP_TABS.filter((t) => t.id === 'meses' || t.id === 'calendario' || t.id === 'entregables' || (t.id === 'metricas' && clientSeesMetrics))
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

  // Botón VISIBLE de tema en la esquina (además del que está en el menú de
  // cuenta): muestra el ícono del tema al que CAMBIA (sol en oscuro, luna en
  // claro). Conmuta EN VIVO, sin recargar.
  const themeBtn = el('button', {
    class: 'tb-iconbtn tb-theme', type: 'button',
    onclick: () => { setTheme(getTheme() === 'light' ? 'dark' : 'light'); patchThemeBtn(); },
  });
  function patchThemeBtn() {
    const light = getTheme() === 'light';
    clear(themeBtn).append(icon(light ? 'moon' : 'sun', 20));
    const lbl = light ? T('Cambiar a tema oscuro', 'Switch to dark theme') : T('Cambiar a tema claro', 'Switch to light theme');
    themeBtn.setAttribute('aria-label', lbl);
    themeBtn.title = lbl;
  }
  patchThemeBtn();

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
    themeBtn,
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

  // Selector de tema Oscuro/Claro (dos pastillas). Cambia EN VIVO, sin recargar.
  function themeRow() {
    const cur = () => getTheme();
    const mk = (code, label) => el('button', {
      class: 'lang-pill' + (cur() === code ? ' is-active' : ''),
      type: 'button', 'aria-pressed': String(cur() === code),
      onclick: (e) => {
        if (cur() === code) return;
        setTheme(code);
        patchThemeBtn(); // el botón de la esquina refleja el tema nuevo
        // Refresca el estado activo de ambas pastillas sin cerrar el sheet.
        const wrap = e.currentTarget.parentElement;
        for (const b of wrap.querySelectorAll('.lang-pill')) {
          const active = b.dataset.theme === code;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        }
      },
      dataset: { theme: code },
    }, [el('span', { text: label })]);
    return el('div', { class: 'acct-lang' }, [
      el('span', { class: 'acct-lang__label' }, [icon('moon', 18), el('span', { text: T('Tema', 'Theme') })]),
      el('div', { class: 'acct-lang__pills' }, [mk('dark', T('Oscuro', 'Dark')), mk('light', T('Claro', 'Light'))]),
    ]);
  }

  // Indicador de versión: qué código tiene cargado ESTA pantalla ahora mismo,
  // en fecha legible, y si coincide con lo publicado en el servidor. Consulta
  // al ABRIR el menú (no cada 5 min), así siempre es una comprobación en vivo:
  // es la respuesta a "¿cómo sé que de verdad se publicó?".
  function versionRow() {
    const line = el('div', { class: 'acct-ver__line', text: version.currentLabel() });
    const status = el('div', { class: 'acct-ver__status', role: 'status', 'aria-live': 'polite' });
    const actions = el('div', { class: 'acct-ver__actions' });

    const updateBtn = () => {
      // Se captura el nodo, no e.currentTarget: tras el primer await ya es null.
      const b = el('button', {
        class: 'btn btn-primary btn-sm', type: 'button',
        text: T('Actualizar ahora', 'Update now'),
        onclick: async () => {
          b.disabled = true;
          b.textContent = T('Actualizando…', 'Updating…');
          // false = no había servidor del otro lado y no se tocó nada.
          const ok = await version.applyUpdate().catch(() => false);
          if (!ok) {
            b.disabled = false;
            b.textContent = T('Actualizar ahora', 'Update now');
            toast(T(
              'Sin conexión con el servidor. Inténtalo cuando vuelva la señal.',
              'No connection to the server. Try again when your signal is back.',
            ), 'warn');
          }
        },
      });
      return b;
    };

    const paint = (res) => {
      clear(status); clear(actions);
      if (!res) {
        status.className = 'acct-ver__status is-checking';
        status.textContent = T('Comprobando con el servidor…', 'Checking with the server…');
        return;
      }
      if (res.state === 'same') {
        status.className = 'acct-ver__status is-ok';
        status.textContent = T('Actualizada ✓', 'Up to date ✓');
      } else if (res.state === 'new') {
        status.className = 'acct-ver__status is-new';
        status.textContent = T(
          `Hay una versión más nueva (${version.formatStamp(res.server)})`,
          `A newer version is available (${version.formatStamp(res.server)})`,
        );
        actions.appendChild(updateBtn());
      } else {
        status.className = 'acct-ver__status is-unknown';
        if (!version.CURRENT) {
          // Aquí el servidor pudo haber contestado perfecto: el que no se sabe
          // identificar es ESTE código. Pedirle revisar su conexión sería
          // mentirle, y "Reintentar" no lo va a arreglar nunca.
          status.textContent = T(
            'No se pudo identificar esta versión.',
            'Could not identify this version.',
          );
        } else {
          status.textContent = T('No se pudo comprobar. Revisa tu conexión.', 'Could not check. Check your connection.');
          actions.appendChild(el('button', {
            class: 'btn btn-sm', type: 'button', text: T('Reintentar', 'Retry'),
            onclick: run,
          }));
        }
      }
    };

    function run() {
      paint(null);
      version.check({ force: true }).then(paint).catch(() => paint({ state: 'unknown' }));
    }
    run();

    return el('div', { class: 'acct-ver' }, [
      el('span', { class: 'acct-ver__ico' }, [icon('refresh', 18)]),
      el('div', { class: 'acct-ver__main' }, [line, status, actions]),
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
          themeRow(),
          versionRow(),
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
          // Aviso de Privacidad accesible desde la app (regla 5.1.1(i) de
          // Apple: el link debe estar "easily accessible", no solo en el
          // registro). URL sin .html: la variante .html responde 308.
          accountRow('link', T('Aviso de Privacidad', 'Privacy Policy'), () => {
            close();
            window.open('/privacy-policy', '_blank', 'noopener');
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
        body.appendChild(el('p', { class: 'acct-intro', text: T('Cada cliente entra a su portal y ve solo el calendario de su empresa. Aquí ves y cambias su usuario, su correo y su contraseña.', "Each client signs in to their portal and sees only their company's calendar. Here you view and change their username, email and password.") }));
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
            // Sin correo de verdad el cliente NO puede pedir "olvidé mi
            // contraseña": se avisa aquí para que se note de un vistazo.
            const hasEmail = !!(login && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(login.email || ''));
            const sub = login
              ? [login.username, hasEmail ? login.email : null].filter(Boolean).join(' · ') || login.email
              : T('Sin acceso aún', 'No access yet');
            list.appendChild(el('div', { class: 'acct-user' }, [
              el('span', { class: 'acct-user__dot', style: { background: c.brand_color || 'var(--brand)' } }),
              el('div', { class: 'acct-user__main' }, [
                el('div', { class: 'acct-user__name', text: c.name }),
                el('div', { class: 'acct-user__sub', text: sub }),
                login && !hasEmail
                  ? el('div', { class: 'acct-user__warn', text: T('Falta su correo — no puede restablecer su contraseña', 'Email missing — they cannot reset their password') })
                  : null,
              ].filter(Boolean)),
              login
                ? el('div', { class: 'acct-user__actions' }, [
                    el('button', { class: 'btn btn-sm', type: 'button', text: T('Ver acceso', 'View access'), onclick: () => openEditClientLogin(login, c) }),
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

  const EMAILISH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // Ver el acceso del cliente: su usuario, su correo, y la contraseña guardada.
  // La contraseña se guarda cifrada aparte del hash (bóveda con llave en R2),
  // así que aquí SÍ se puede mostrar — Vianey la necesita para dictársela al
  // cliente cuando la olvida, y se mantiene al día aunque el cliente la cambie.
  function openEditClientLogin(login, brand) {
    openSheet({
      title: `${T('Acceso de', 'Access for')} ${brand.name}`,
      mode: 'form',
      build(body, close) {
        // Las cuentas viejas guardaban el nombre de usuario en el campo de
        // correo; se reparte cada dato en su casilla correcta.
        const emailValue = EMAILISH.test(login.email || '') ? login.email : '';
        const userValue = login.username || (EMAILISH.test(login.email || '') ? '' : (login.email || ''));

        const userIn = el('input', { class: 'input', type: 'text', value: userValue, maxlength: '120', autocapitalize: 'off', spellcheck: 'false', 'aria-label': T('Usuario', 'Username') });
        const emailIn = el('input', { class: 'input', type: 'email', value: emailValue, placeholder: 'correo@cliente.com', maxlength: '120', autocapitalize: 'off', spellcheck: 'false', 'aria-label': T('Correo', 'Email') });

        // ── Contraseña actual (se revela bajo demanda) ──
        const pwShow = el('div', { class: 'acct-pwshow', text: '••••••••' });
        const pwHint = el('div', { class: 'acct-pwhint', text: '' });
        let revealed = null;
        const copyBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Copiar', 'Copy'), hidden: true,
          onclick: async () => { await copyText(revealed); toast(T('Copiada.', 'Copied.'), { type: 'success' }); },
        });
        const revealBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Ver', 'Show'),
          onclick: async () => {
            if (revealed !== null) { // segundo clic: ocultar
              revealed = null; pwShow.textContent = '••••••••';
              revealBtn.textContent = T('Ver', 'Show'); copyBtn.hidden = true;
              return;
            }
            revealBtn.disabled = true;
            try {
              const r = await api.get(`/users/${login.id}/password`);
              if (r && r.password) {
                revealed = r.password;
                pwShow.textContent = r.password;
                revealBtn.textContent = T('Ocultar', 'Hide');
                copyBtn.hidden = false;
              } else {
                pwShow.textContent = T('Todavía no guardada', 'Not saved yet');
                pwHint.textContent = T(
                  'Aparecerá sola la próxima vez que el cliente entre. Si te la sabes, escríbela aquí y la guardo — no se la cambio ni lo saco de su sesión.',
                  "It will appear on its own the next time the client signs in. If you know it, type it here and I'll save it — it does not change their password or sign them out.",
                );
                recallRow.hidden = false;
                recallIn.focus();
              }
            } catch (e) {
              toast(e.message || T('No se pudo mostrar la contraseña.', 'Could not show the password.'), { type: 'error' });
            }
            revealBtn.disabled = false;
          },
        });

        // Rescate: guardar la contraseña que el cliente YA usa. Se comprueba
        // contra el hash en el servidor, así que si te equivocas no pasa nada.
        const recallIn = el('input', { class: 'input', type: 'text', placeholder: T('La contraseña que ya usa', 'The password they already use'), maxlength: '120', 'aria-label': T('Contraseña actual del cliente', "Client's current password") });
        const recallBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Guardar', 'Save'),
          onclick: async () => {
            const v = recallIn.value.trim();
            if (!v) { recallIn.focus(); return; }
            recallBtn.disabled = true;
            try {
              await api.post(`/users/${login.id}/remember-password`, { password: v });
              revealed = v;
              pwShow.textContent = v;
              revealBtn.textContent = T('Ocultar', 'Hide');
              copyBtn.hidden = false;
              recallRow.hidden = true;
              recallIn.value = '';
              pwHint.textContent = T('Guardada. Ya no se te vuelve a perder.', 'Saved. You will not lose it again.');
              store.invalidateUsers();
            } catch (e) {
              toast(e.message || T('No se pudo guardar.', 'Could not save.'), { type: 'error' });
              recallIn.focus();
            }
            recallBtn.disabled = false;
          },
        });
        const recallRow = el('div', { class: 'acct-pwrow', hidden: true, style: { marginTop: '8px' } }, [recallIn, recallBtn]);

        const pwIn = el('input', { class: 'input', type: 'text', placeholder: T('Déjala en blanco para no cambiarla', 'Leave blank to keep it unchanged'), maxlength: '120', 'aria-label': T('Nueva contraseña', 'New password') });
        const genBtn = el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Generar', 'Generate'),
          title: T('Generar una contraseña al azar', 'Generate a random password'),
          onclick: () => { pwIn.value = 'ivae-' + Math.random().toString(36).slice(2, 7); },
        });

        const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar acceso', 'Save access') });
        saveBtn.addEventListener('click', async () => {
          const user = userIn.value.trim();
          const mail = emailIn.value.trim();
          const pw = pwIn.value.trim();
          if (!user && !mail) { toast(T('Deja al menos un usuario o un correo para entrar.', 'Leave at least a username or an email to sign in.'), { type: 'error' }); userIn.focus(); return; }
          if (mail && !EMAILISH.test(mail)) { toast(T('Ese correo no parece válido.', 'That email does not look valid.'), { type: 'error' }); emailIn.focus(); return; }
          if (user.includes('@')) { toast(T('El usuario no lleva @. Ese dato va en el campo de correo.', 'The username has no @. That goes in the email field.'), { type: 'error' }); userIn.focus(); return; }
          if (pw && pw.length < 6) { toast(T('La contraseña debe tener al menos 6 caracteres.', 'The password must be at least 6 characters.'), { type: 'error' }); pwIn.focus(); return; }
          const payload = {};
          if (user !== userValue) payload.username = user;
          if (mail && mail !== emailValue) payload.email = mail;
          if (pw) payload.password = pw;
          if (!Object.keys(payload).length) { close({ source: 'nochange' }); return; }
          saveBtn.disabled = true;
          try {
            await api.patch(`/users/${login.id}`, payload);
            store.invalidateUsers();
            close({ source: 'saved' });
            toast(T('Acceso actualizado.', 'Access updated.'), { type: 'success' });
            if (pw || payload.username || payload.email) {
              showClientCredentials({ brand, email: user || mail, password: pw || revealed || T('(la misma de antes)', '(same as before)') });
            }
          } catch (e) {
            toast(e.message || T('No se pudo guardar el acceso.', 'Could not save the access.'), { type: 'error' });
            saveBtn.disabled = false;
          }
        });

        body.append(
          el('p', { class: 'acct-intro', text: T('Tu cliente puede entrar con su usuario o con su correo, lo que recuerde. El correo además le sirve para restablecer su contraseña solo.', 'Your client can sign in with their username or their email, whichever they remember. The email also lets them reset their password on their own.') }),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Usuario', 'Username') }),
            userIn,
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Correo', 'Email') }),
            emailIn,
            el('div', { class: 'acct-pwhint', text: emailValue
              ? T('A este correo le llega el enlace para restablecer.', 'The reset link goes to this address.')
              : T('Sin correo no puede restablecer su contraseña solo. Ponlo aquí.', 'Without an email they cannot reset their password on their own. Add it here.') }),
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Contraseña actual', 'Current password') }),
            el('div', { class: 'acct-pwrow' }, [pwShow, revealBtn, copyBtn]),
            pwHint,
            recallRow,
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Cambiar la contraseña', 'Change the password') }),
            el('div', { class: 'acct-pwrow' }, [pwIn, genBtn]),
          ]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            saveBtn,
          ]),
        );
        setTimeout(() => (emailValue ? userIn : emailIn).focus(), 50);
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
    // Paso 2: la CONTRASEÑA es la confirmación (el backend la exige desde la
    // auditoría 2026-07-31). Un "sí" de más no basta para arrasar la marca.
    openSheet({
      title: T('Confirma con tu contraseña', 'Confirm with your password'),
      mode: 'form',
      build(body, close) {
        const pass = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: T('Tu contraseña', 'Your password') });
        const btn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Eliminar definitivamente', 'Delete permanently') });
        btn.addEventListener('click', async () => {
          if (!pass.value) {
            toast(T('Escribe tu contraseña para confirmar.', 'Type your password to confirm.'), 'error');
            return;
          }
          btn.disabled = true;
          try {
            await api.del('/auth/account', { current: pass.value });
            location.replace('/marketing/');
          } catch (e) {
            toast(e.message || T('No se pudo eliminar la cuenta. Escríbenos por WhatsApp.', 'Could not delete the account. Message us on WhatsApp.'), 'error');
            btn.disabled = false;
          }
        });
        body.append(
          el('p', { class: 'muted', text: T('Esta acción no se puede deshacer: se borran tu marca, tu calendario y tus entregables.', 'This cannot be undone: your brand, calendar and deliverables will be deleted.') }),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Contraseña', 'Password') }), pass]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            btn,
          ]),
        );
        setTimeout(() => pass.focus(), 50);
      },
    });
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
