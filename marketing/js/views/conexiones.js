// ============================================================================
// IVAE Marketing — Vista "Conexiones" (solo staff).
//
// Pedido de la dueña (2026-08-27, "que las empresas sean más fáciles de
// conectar"): UN tablero con el semáforo de redes de cada marca. Tarjeta por
// marca con estado de Instagram, Facebook y YouTube, botón de conectar cuando falta, y
// "Copiar invitación": el mensaje de WhatsApp listo para que el dueño de la
// página apruebe la solicitud de acceso (Meta exige ese "sí" una vez por
// página; ver guía en memoria del proyecto). Los datos ya viajan en la lista
// de clientes (ig_username / fb_page_name / tt_username); aquí no hay fetch
// propio: la vista lee el store y se repinta con él.
// ============================================================================
import { el, clear, toast, api, copyText, esCreador } from '../api.js?v=202609241218';
import { icon } from '../shell/icons.js?v=202609241218';
import { T, isEN } from '../shell/i18n.js?v=202609241218';

const VIEW_ID = 'conexiones';

let ctx = null;
let rootEl = null;
let unsubs = [];

const INVITACION = () => T(
  'Te llegó una notificación de Facebook que dice "Vianey Dm solicitó acceso a tu página". Es de nuestra agencia, para publicarte también en Facebook en automático. Solo pícale Aprobar porfa 🙏 (La encuentras en la campanita de Facebook o en Business Suite → Configuración → Solicitudes.)',
  'You got a Facebook notification saying "Vianey Dm requested access to your Page". It is from our agency, so we can also auto-publish to Facebook for you. Just tap Approve please 🙏 (You will find it in the Facebook bell or in Business Suite → Settings → Requests.)'
);

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }
// El conector es una CREDENCIAL: solo la dueña de la agencia (admin) lo ve.
function esAdmin() { return ((ctx.store.getState().me || {}).role === 'admin'); }

// Clientes que SÍ ven esta sección en su portal (pedido 2026-08-27: solo
// Regeneris). MISMA lista en shell.js y topbar.js — cámbialas juntas.
const CLIENT_CONEXIONES_IDS = ['demo-regeneris'];
function clientAllowed() {
  return CLIENT_CONEXIONES_IDS.includes((ctx.store.getState().me || {}).client_id);
}

async function conectar(kind, clientId) {
  const url = `/api/marketing/${kind}/login?client_id=${encodeURIComponent(clientId)}${isEN ? '&lang=en' : ''}`;
  const r = await fetch(url, { credentials: 'include', redirect: 'manual' });
  if (r.status === 503) {
    toast(kind === 'yt'
      ? T('Falta configurar la app de YouTube (pídeme la guía).', 'YouTube still needs setup (ask me for the guide).')
      : T('Falta configurar la app de Meta para esta red.', 'The Meta app still needs setup for this network.'), { type: 'error' });
    return;
  }
  window.location.href = url;
}

async function copiarInvitacion() {
  try {
    await navigator.clipboard.writeText(INVITACION());
    toast(T('Invitación copiada: pégala en WhatsApp al dueño de la página.', 'Invite copied: paste it in WhatsApp to the page owner.'), { type: 'success' });
  } catch {
    toast(T('No se pudo copiar. Mantén presionado el texto para copiarlo.', 'Could not copy. Long-press the text to copy it.'), { type: 'error' });
  }
}

function filaRed({ nombre, icono, conectado, detalle, onConnect }) {
  let derecha;
  if (conectado) {
    derecha = el('span', { class: 'cx-red__estado cx-red__estado--ok', text: detalle });
  } else if (onConnect) {
    derecha = el('button', {
      class: 'btn cx-red__btn', type: 'button', onclick: onConnect,
    }, [el('span', { text: T('Conectar', 'Connect') })]);
  } else {
    derecha = el('span', { class: 'cx-red__estado', text: T('En proceso…', 'In progress…') });
  }
  return el('div', { class: 'cx-red' + (conectado ? ' cx-red--ok' : '') }, [
    el('span', { class: 'cx-red__ico' }, [icon(icono, 16)]),
    el('span', { class: 'cx-red__nombre', text: nombre }),
    derecha,
  ]);
}

function tarjeta(c) {
  const cliente = isClient();
  const ig = c.ig_username ? '@' + c.ig_username : null;
  const fb = c.fb_page_name || null;
  const yt = c.yt_channel_title || null;
  const completa = !!(ig && fb);
  return el('article', { class: 'cx-card' + (completa ? ' cx-card--full' : '') }, [
    el('header', { class: 'cx-card__head' }, [
      el('span', { class: 'cx-card__dot', style: { background: c.brand_color || 'var(--acc, #7c3aed)' } }),
      el('h2', { class: 'cx-card__name', text: c.name }),
      completa ? el('span', { class: 'cx-card__badge', text: T('Completa', 'Complete') }) : null,
    ].filter(Boolean)),
    // El cliente habilitado también tiene su botón Conectar (pedido
    // 2026-08-27); el backend lo fuerza a su propia marca. OJO: mientras la
    // app de Meta siga en modo desarrollo, cuentas sin rol verán el aviso de
    // Meta "la app no está activa" — por eso abajo se conserva la nota con el
    // camino de aprobar la solicitud, que sí funciona hoy.
    filaRed({
      nombre: 'Instagram', icono: 'camera',
      conectado: !!ig, detalle: ig ? `${ig} ✓` : '',
      onConnect: () => conectar('ig', c.id),
    }),
    filaRed({
      nombre: 'Facebook', icono: 'link',
      conectado: !!fb, detalle: fb ? `${fb} ✓` : '',
      onConnect: () => conectar('fb', c.id),
    }),
    // YouTube (pedido 2026-09-24: "en Conexiones debería aparecer la opción de
    // conectar YouTube"). Mismo flujo que la ficha de la marca (/yt/login con
    // la cuenta de Google del canal). El cliente no puede conectar YouTube
    // (el backend responde 403), así que a él solo se le muestra si ya está.
    (yt || !cliente) ? filaRed({
      nombre: 'YouTube', icono: 'play',
      conectado: !!yt, detalle: yt ? `${yt} ✓` : '',
      onConnect: cliente ? null : () => conectar('yt', c.id),
    }) : null,
    // Sin Facebook aún: al equipo le damos el botón de invitación; al cliente,
    // la instrucción de UN tap para aprobar la solicitud que ya le enviamos.
    // El creador conecta SU página él mismo: no hay dueño a quien invitar.
    (fb || esCreador()) ? null : (cliente
      ? el('p', { class: 'cx-nota', text: T(
          'Te enviamos una solicitud de acceso a tu página de Facebook. Apruébala en: tu página → Configuración → Acceso a la página → Solicitudes pendientes → Aprobar. Con eso quedará conectada.',
          'We sent an access request to your Facebook Page. Approve it at: your Page → Settings → Page access → Pending requests → Approve. That will complete the connection.'
        ) })
      : el('button', {
          class: 'cx-invitar', type: 'button', onclick: copiarInvitacion,
        }, [icon('copy', 14), ' ' + T('Copiar invitación para el dueño', "Copy the owner's invite")])),
  ].filter(Boolean));
}


// ── TU IA: un conector POR AGENCIA ───────────────────────────────────────────
// Regla dura de la dueña (21-sep-2026): "cada uno tiene que tener su propio
// conector, no pueden mezclarse conectores de las agencias". El conector que
// se crea aquí nace con el workspace de quien lo crea y el servidor MCP filtra
// TODAS sus consultas por ese workspace: solo ve las marcas de esta agencia.
let iaEstado = null;   // { claves:[], tiene_clave_acceso:bool } | 'cargando' | 'error'
let iaVer = false;     // ¿se muestra el enlace completo en pantalla?

function enmascarar(url) {
  const i = url.lastIndexOf('/');
  const tok = url.slice(i + 1);
  return url.slice(0, i + 1) + tok.slice(0, 6) + '•'.repeat(18) + tok.slice(-4);
}

async function cargarIA() {
  iaEstado = 'cargando';
  try {
    iaEstado = await api.get('/mcp/claves');
  } catch {
    iaEstado = 'error';
  }
  render();
}

async function crearConector() {
  try {
    await api.post('/mcp/claves', { label: T('Conector de la agencia', 'Agency connector') });
    toast(T('Conector creado. Cópialo y pégalo en tu IA.', 'Connector created. Copy it into your AI.'), { type: 'success' });
    iaVer = true;
    await cargarIA();
  } catch (e) {
    toast((e && e.message) || T('No se pudo crear el conector.', 'Could not create the connector.'), { type: 'error' });
  }
}

async function revocarConector(token) {
  const seguro = window.confirm(T(
    'Se apaga este conector. La IA que lo tenga pegado dejará de entrar al instante. ¿Seguimos?',
    'This turns the connector off. Any AI using it loses access immediately. Continue?'
  ));
  if (!seguro) return;
  try {
    await api.post('/mcp/claves/revocar', { token });
    toast(T('Conector apagado.', 'Connector turned off.'), { type: 'success' });
    await cargarIA();
  } catch (e) {
    toast((e && e.message) || T('No se pudo apagar.', 'Could not turn it off.'), { type: 'error' });
  }
}

function pasos() {
  return el('div', { class: 'cx-ia__pasos' }, [
    el('div', { class: 'cx-ia__paso' }, [
      el('b', { text: 'Claude' }),
      el('span', { text: T(
        'Ajustes → Conectores → Agregar conector personalizado. Pega el enlace y listo (no pide contraseña).',
        'Settings → Connectors → Add custom connector. Paste the link and you are done (no password needed).'
      ) }),
    ]),
    el('div', { class: 'cx-ia__paso' }, [
      el('b', { text: 'ChatGPT' }),
      el('span', { text: T(
        'Ajustes → Conectores (modo desarrollador) → Nuevo servidor MCP. Pega el mismo enlace y deja la autenticación en "ninguna".',
        'Settings → Connectors (developer mode) → New MCP server. Paste the same link and leave authentication as "none".'
      ) }),
    ]),
  ]);
}

function seccionIA() {
  const caja = el('section', { class: 'cx-ia' });
  caja.append(
    el('header', { class: 'cx-ia__head' }, [
      el('span', { class: 'cx-ia__ico' }, [icon('activity', 16)]),
      el('h2', { class: 'cx-ia__title', text: T('Conecta tu IA', 'Connect your AI') }),
    ]),
    el('p', { class: 'cx-ia__sub', text: T(
      'Claude o ChatGPT pueden leer y escribir TU calendario: llenar captions, proponer guiones, armar el mes. Cada agencia tiene su propio conector y solo alcanza sus marcas; el de una agencia nunca ve el calendario de otra.',
      'Claude or ChatGPT can read and write YOUR calendar: fill captions, draft scripts, build the month. Each agency has its own connector and only reaches its own brands; one agency never sees another one\'s calendar.'
    ) }),
  );

  if (iaEstado === 'cargando' || iaEstado === null) {
    caja.appendChild(el('div', { class: 'cx-ia__cargando' }, [el('span', { class: 'spinner' })]));
    return caja;
  }
  if (iaEstado === 'error') {
    caja.appendChild(el('p', { class: 'cx-nota', text: T('No se pudo leer tus conectores.', 'Could not read your connectors.') }));
    return caja;
  }

  const vivas = (iaEstado.claves || []).filter((k) => !k.revoked);
  if (!vivas.length) {
    caja.append(
      pasos(),
      el('button', {
        class: 'btn btn-primary cx-ia__crear', type: 'button',
        text: T('Crear mi conector', 'Create my connector'),
        onclick: crearConector,
      }),
    );
    return caja;
  }

  const lista = el('div', { class: 'cx-ia__lista' });
  for (const k of vivas) {
    lista.appendChild(el('div', { class: 'cx-ia__fila' }, [
      el('div', { class: 'cx-ia__datos' }, [
        el('span', { class: 'cx-ia__label', text: (k.client_name
          ? T('Solo ', 'Only ') + k.client_name
          : (k.label || T('Todas mis marcas', 'All my brands'))) + (k.readonly ? T(' · solo lectura', ' · read only') : '') }),
        el('code', { class: 'cx-ia__url', text: iaVer ? k.url : enmascarar(k.url) }),
      ]),
      el('div', { class: 'cx-ia__acciones' }, [
        el('button', {
          class: 'btn btn-sm', type: 'button', text: T('Copiar', 'Copy'),
          onclick: async () => {
            await copyText(k.url);
            toast(T('Enlace copiado.', 'Link copied.'), { type: 'success' });
          },
        }),
        el('button', {
          class: 'btn btn-sm', type: 'button', text: iaVer ? T('Ocultar', 'Hide') : T('Ver', 'Show'),
          onclick: () => { iaVer = !iaVer; render(); },
        }),
        el('button', {
          class: 'btn btn-sm cx-ia__off', type: 'button', text: T('Apagar', 'Turn off'),
          onclick: () => revocarConector(k.token),
        }),
      ]),
    ]));
  }
  caja.append(
    lista,
    el('p', { class: 'cx-ia__aviso', text: T(
      'Este enlace ES la llave: quien lo tenga entra a tu calendario. No lo pegues en chats ni en documentos compartidos, y si se te sale de las manos, apágalo y crea otro.',
      'This link IS the key: whoever holds it gets into your calendar. Do not paste it in chats or shared documents, and if it leaks, turn it off and create another.'
    ) }),
    pasos(),
    el('button', {
      class: 'btn cx-ia__crear', type: 'button',
      text: T('Crear otro conector', 'Create another connector'),
      onclick: crearConector,
    }),
  );
  return caja;
}

function render() {
  if (!rootEl) return;
  clear(rootEl);

  const cliente = isClient();
  if (cliente && !clientAllowed()) {
    rootEl.appendChild(el('div', { class: 'cx-empty' }, [
      icon('link', 28),
      el('p', { text: T('Esta sección es del equipo.', 'This section is for the team.') }),
    ]));
    return;
  }

  rootEl.appendChild(el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Conexiones', 'Connections') }),
    el('p', { class: 'mk-sub', text: cliente
      ? T(
        'Las redes de tu marca conectadas a tu portal. Verde = publicando y midiendo en automático.',
        'Your brand networks connected to your portal. Green = auto-publishing and measuring.'
      )
      : esCreador()
      ? T(
        'Tus redes por marca. Verde = publica en automático. Conecta Instagram, tu página de Facebook y tu canal de YouTube con tus propias cuentas.',
        'Your networks per brand. Green = auto-publishing. Connect Instagram, your Facebook Page and your YouTube channel with your own accounts.'
      )
      : T(
        'El semáforo de redes por marca. Verde = publica en automático. Si falta Facebook: conéctalo si administras la página, o copia la invitación y mándasela al dueño (solo tiene que picar Aprobar).',
        'The per-brand network status. Green = auto-publishing. If Facebook is missing: connect it if you manage the Page, or copy the invite and send it to the owner (they just tap Approve).'
      ) }),
  ]));

  // El conector de IA lo maneja la DUEÑA de la agencia: el enlace es la llave.
  if (esAdmin()) rootEl.appendChild(seccionIA());

  const clients = (ctx.store.getState().clients || []).filter((c) => !c.archived);
  if (!clients.length) {
    rootEl.appendChild(el('div', { class: 'cx-empty' }, [
      el('span', { class: 'spinner' }),
      el('p', { text: T('Cargando marcas…', 'Loading brands…') }),
    ]));
    return;
  }

  const grid = el('div', { class: 'cx-grid' });
  for (const c of clients) grid.appendChild(tarjeta(c));
  rootEl.appendChild(grid);
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/conexiones.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/conexiones.css?v=202609241218';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'cx-root' });
    host.appendChild(rootEl);
    unsubs.push(ctx.store.subscribe(['clients'], render));
    render();
    if (esAdmin()) cargarIA();
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null;
    iaEstado = null; iaVer = false;
  },
};
