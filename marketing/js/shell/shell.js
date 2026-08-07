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
//     closeAll,confirmDiscard}, pickers, dnd, toast, setFab, setViewControls, setTabBadge,
//     openEditor, selectClient, icons }
//
// Degradacion limpia: si /notifications devuelve 404 (migracion 004 sin
// aplicar) se ocultan campana y tab Avisos y todo lo demas funciona.
// ============================================================================

import { api, el, clear } from '../api.js?v=202608070959';
import * as store from './store.js?v=202608070959';
import * as prefs from './prefs.js?v=202608070959';
import * as router from './router.js?v=202608070959';
import { openSheet, pickFrom, closeAll, confirmDiscard } from './sheet.js?v=202608070959';
import { toast } from './toast.js?v=202608070959';
import { icon } from './icons.js?v=202608070959';
import * as iconsMod from './icons.js?v=202608070959';
import { createTopbar } from './topbar.js?v=202608070959';
import { createBottomNav } from './bottomnav.js?v=202608070959';
import { createSearch } from './search.js?v=202608070959';
import { createNotifications } from './notifications.js?v=202608070959';
import { T } from './i18n.js?v=202608070959';
import * as version from './version.js?v=202608070959';
import * as pickers from '../ui/pickers.js?v=202608070959';
import * as dnd from '../ui/dnd.js?v=202608070959';

// Lista canonica (prefs.js): calendario/tablero/tabla/timeline/carga.
const CONTENT_VIEWS = prefs.CONTENT_VIEWS;
// El cliente solo ve las vistas de calendario (Calendario = meses,
// Cuadrícula = calendario). Nada de Inicio/Tablero/Tabla/Timeline/Carga.
const CLIENT_VIEWS = ['meses', 'calendario', 'entregables'];
// Métricas (con su botón de Reporte PDF) se habilita en la versión CLIENTE
// solo para las marcas que Vianey aprueba una por una. Hoy: IVAE STUDIOS (su
// propia marca) y REGENERIS (lo pidió el 2026-07-29). El resto no la ve.
// La MISMA lista vive duplicada en topbar.js (patrón existente): si agregas
// una marca aquí, agrégala allá. El backend ya limita a cada cliente a SU
// marca (/report y /ig/metrics-range fuerzan session.client_id).
const CLIENT_METRICS_IDS = [
  '6ae5dd2381faa430d9e6966470b29602', // IVAE STUDIOS
  'demo-regeneris',                    // REGENERIS THERAPY
  '67322bb3c5f64991a9178b1d1784231a',  // DEMO (revisores de App Store / Play)
];
const isClientRole = () => ((store.getState().me || {}).role === 'client');
const clientCanView = (view) => CLIENT_VIEWS.includes(view)
  || (view === 'metricas' && CLIENT_METRICS_IDS.includes((store.getState().me || {}).client_id));
const CONTENT_LABELS = {
  meses: T('Calendario', 'Calendar'),
  calendario: T('Cuadrícula', 'Grid'),
  entregables: T('Entregables', 'Deliverables'),
  metricas: T('Métricas', 'Metrics'),
  carrusel: T('Carrusel', 'Carousel'),
  descargar: T('Descargar', 'Download'),
  tablero: T('Tablero', 'Board'),
  tabla: T('Tabla', 'Table'),
  timeline: 'Timeline',
  carga: T('Carga', 'Workload'),
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
let barsHost = null;
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
  // Se VACÍA el contenido de la marca anterior en el mismo instante que cambia
  // el nombre de arriba. Si no, y la carga de la marca nueva falla (bache de
  // señal, servidor caído), quedaba en pantalla el calendario de Dental Now
  // bajo el rótulo de Meli, con un toast de 4s como único aviso: se edita o se
  // aprueba la pieza equivocada. Con posts=[] la vista pinta su tarjeta de
  // "No se pudo cargar" y ofrece Reintentar.
  store.set({ activeClientId: id, search: '', posts: [], postsError: null, loading: true });
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
  // Métricas no es vista de contenido, pero en móvil se navega desde este
  // mismo seg (staff siempre; cliente si su marca está aprobada): el seg se
  // queda visible ahí para poder regresar a Calendario/Cuadrícula.
  const isContent = CONTENT_VIEWS.includes(view)
    || (view === 'metricas' && (isClientRole() ? clientCanView('metricas') : true));
  subheadSeg.hidden = !isContent;
  const hasSlot = subheadSlot.children.length > 0;
  const show = isContent || hasSlot;
  subheadEl.hidden = !show;
  document.body.classList.toggle('has-subhead', show);
  if (isContent) {
    const client = isClientRole();
    for (const b of subheadSeg.querySelectorAll('button')) {
      const is = b.dataset.view === view;
      b.classList.toggle('is-active', is);
      b.setAttribute('aria-selected', is ? 'true' : 'false');
      if (b.dataset.view === 'carrusel') b.hidden = client; // herramienta de staff
      if (b.dataset.view === 'descargar') b.hidden = client; // herramienta de staff
    }
  }
}

function buildSubhead(root) {
  subheadSeg = el('div', { class: 'seg subhead-seg', role: 'tablist', 'aria-label': T('Vista de contenido', 'Content view') });
  // Vianey pidio quitar Tablero/Tabla/Timeline/Carga de su admin: tanto admin
  // como cliente solo ven las dos vistas de calendario (Calendario = meses,
  // Cuadricula = calendario).
  const VISIBLE_CONTENT_VIEWS = ['meses', 'calendario', 'entregables', 'carrusel', 'descargar'];
  const segViews = CONTENT_VIEWS.filter((v) => VISIBLE_CONTENT_VIEWS.includes(v));
  // En móvil las tabs del topbar no existen (<1024px, shell.css): este seg es
  // la ÚNICA entrada a Métricas. Para el cliente, solo si su marca está en la
  // lista aprobada; para el STAFF, siempre — Vianey entró desde el cel y
  // Métricas no aparecía por ningún lado (hueco reportado 2026-07-29).
  if (isClientRole() ? clientCanView('metricas') : true) segViews.push('metricas');
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
          // Si hay trabajo a medias (editor o sheet abiertos), NO descargar la
          // app a los 900ms: se perdería el texto sin guardar. Aviso persistente
          // con acción; la dueña decide cuándo ir al login.
          const editing = document.body.classList.contains('editor-open') || document.querySelector('.sheet');
          if (editing) {
            toast(T('Tu sesión expiró. Copia tu texto pendiente y vuelve a entrar.', 'Your session expired. Copy your unsaved text and sign in again.'), {
              type: 'error', ms: 60000,
              action: { label: T('Ir al login', 'Go to login'), onAction: () => location.replace('/marketing/') },
            });
          } else {
            toast(T('Tu sesión expiró. Vuelve a iniciar sesión.', 'Your session expired. Please sign in again.'), { type: 'info' });
            setTimeout(() => location.replace('/marketing/'), 900);
          }
        }
        throw err;
      }
    };
  }
}

// ── Franjas de aviso bajo el topbar (offline / verifica tu correo / versión) ──
// Las tres viven dentro de #barsHost, un contenedor fijo bajo el topbar. Se
// apilan solas (flujo normal) y su alto TOTAL se publica en --bars-h, que es
// lo que desplaza #subhead y #viewScroll (shell.css). Antes cada barra era
// `position: fixed` con su propio top y el CSS enumeraba las combinaciones a
// mano: con tres barras eso ya no escalaba y una combinación olvidada tapaba
// el seg de vistas.
function getBarsHost() {
  if (barsHost) return barsHost;
  barsHost = document.getElementById('barsHost');
  if (!barsHost) {
    barsHost = el('div', { id: 'barsHost' });
    const tb = document.getElementById('topbar');
    if (tb) tb.insertAdjacentElement('afterend', barsHost);
    else document.body.appendChild(barsHost);
  }
  if (typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(syncBarsHeight).observe(barsHost); } catch { /* noop */ }
  }
  window.addEventListener('resize', syncBarsHeight);
  return barsHost;
}

function syncBarsHeight() {
  const h = barsHost ? barsHost.offsetHeight : 0;
  document.body.style.setProperty('--bars-h', `${h}px`);
}

// Detector de versión nueva: la SPA congela sus módulos con ?v=SELLO al cargar,
// así que tras cada deploy las pestañas abiertas corren código viejo (fuente #1
// de "te dije que lo publiqué y no lo veo"). Se comprueba AL CARGAR, al volver
// a la pestaña y cada 5 min; el aviso es una FRANJA PERSISTENTE (no un toast de
// 10 min que se pierde si no estás mirando) que se queda hasta actualizar o
// cerrarla a mano. Nunca recarga sola: podría haber texto sin guardar.
function installVersionWatch() {
  if (!version.CURRENT) return; // sin sello propio no hay nada que comparar
  let bar = null;
  let dismissed = null; // sello del servidor que ya se descartó a mano

  const build = (serverStamp) => {
    const txt = el('span', {
      class: 'update-bar__txt',
      text: T('Hay una versión nueva de la app.', 'A new version is available.'),
    });
    const when = el('span', {
      class: 'update-bar__when',
      text: T(`Publicada ${version.formatStamp(serverStamp)}`, `Published ${version.formatStamp(serverStamp)}`),
    });
    const btn = el('button', {
      class: 'update-bar__btn', type: 'button',
      text: T('Actualizar', 'Update'),
      onclick: async () => {
        btn.disabled = true;
        btn.textContent = T('Actualizando…', 'Updating…');
        // applyUpdate devuelve false si no hay servidor del otro lado: en ese
        // caso NO tocó nada y el botón tiene que volver a estar disponible.
        const ok = await version.applyUpdate().catch(() => false);
        if (!ok) {
          btn.disabled = false;
          btn.textContent = T('Actualizar', 'Update');
          toast(T(
            'Sin conexión con el servidor. Inténtalo cuando vuelva la señal.',
            'No connection to the server. Try again when your signal is back.',
          ), 'warn');
        }
      },
    });
    const closeBtn = el('button', {
      class: 'update-bar__x', type: 'button',
      'aria-label': T('Cerrar este aviso', 'Dismiss this notice'),
      title: T('Cerrar este aviso', 'Dismiss this notice'),
      onclick: () => {
        dismissed = serverStamp;
        hide();
      },
    }, [icon('close', 16)]);
    // La franja nace VACÍA a propósito: una live region solo anuncia lo que
    // cambia DESPUÉS de insertarla, así que si naciera con el texto dentro el
    // lector de pantalla no diría nada. El contenido entra en render().
    const host = el('div', { class: 'update-bar', role: 'status', 'aria-live': 'polite' });
    return { host, parts: [txt, when, btn, closeBtn] };
  };

  const hide = () => {
    if (!bar) return;
    bar.remove();
    bar = null;
    syncBarsHeight();
  };

  const render = (res) => {
    // 'unknown' (se cayó la red o el servidor) NO borra un aviso ya puesto: la
    // versión nueva sigue existiendo aunque ahora no se pueda comprobar.
    if (res.state === 'unknown') return;
    if (res.state !== 'new' || !res.server) { hide(); return; }
    if (res.server === dismissed) return; // ya la cerró a mano: no insistir
    if (bar && bar.dataset.stamp === res.server) return; // ya está puesta
    hide();
    const { host, parts } = build(res.server);
    bar = host;
    bar.dataset.stamp = res.server;
    getBarsHost().appendChild(bar);
    syncBarsHeight(); // ya mide 40px (min-height): no hay salto al llenarla
    requestAnimationFrame(() => {
      if (bar !== host || !host.isConnected) return; // la cerraron mientras tanto
      host.append(...parts);
      syncBarsHeight();
    });
  };

  version.onChange(render);

  // maxAgeMs 30 s: volver a la pestaña sí re-comprueba, pero alt-tabbear diez
  // veces seguidas no dispara diez peticiones.
  const check = () => {
    if (document.visibilityState !== 'visible') return;
    version.check({ maxAgeMs: 30000 }).catch(() => {});
  };
  // 1) al cargar la app (tras el arranque, para no competir con las peticiones
  //    críticas), 2) cada 5 min, 3) al recuperar el foco de la pestaña.
  setTimeout(check, 2500);
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
}

// Banner de verificación de correo (clientes auto-registrados): franja delgada
// bajo el topbar, SOLO si /auth/me trae email_verified === false explícito
// (los usuarios de agencia no traen el campo y no ven nada). El botón reenvía
// el correo vía POST /auth/resend-verify.
function installVerifyBanner(me) {
  if (!me || me.email_verified !== false) return;
  const btn = el('button', {
    class: 'verify-bar__btn', type: 'button', text: T('Reenviar correo', 'Resend email'),
    onclick: async () => {
      btn.disabled = true;
      try {
        await api.post('/auth/resend-verify');
        toast(T('Te reenviamos el correo de verificación. Revisa tu bandeja (y spam).', 'We resent the verification email. Check your inbox (and spam).'), { type: 'success' });
      } catch (e) {
        toast(e.message || T('No se pudo reenviar el correo. Intenta de nuevo.', 'Could not resend the email. Try again.'), { type: 'error' });
        btn.disabled = false;
      }
    },
  });
  const bar = el('div', { class: 'verify-bar' }, [
    el('span', { class: 'verify-bar__txt', text: T('Confirma tu correo para proteger tu cuenta.', 'Confirm your email to protect your account.') }),
    btn,
  ]);
  // Vive en #barsHost: su alto entra en --bars-h y desplaza #subhead y
  // #viewScroll (shell.css), así que el banner no tapa nada aunque coincida
  // con la barra offline o con la franja de versión nueva.
  getBarsHost().appendChild(bar);
  syncBarsHeight();
}

// El link del correo de verificación redirige a /marketing/app?verified=1|0.
// Antes nadie leía el param y un fallo se tragaba en silencio: ahora hay toast
// de éxito/fracaso y el param se limpia para no repetirlo al recargar.
function consumeVerifiedParam() {
  const qs = new URLSearchParams(location.search);
  if (!qs.has('verified')) return;
  const ok = qs.get('verified') === '1';
  if (ok) {
    toast(T('Correo verificado. ¡Listo!', 'Email verified. All set!'), { type: 'success' });
  } else {
    toast(T('El enlace de verificación no sirvió (inválido o caducado). Usa "Reenviar correo" para recibir uno nuevo.', 'The verification link did not work (invalid or expired). Use "Resend email" to get a new one.'), { type: 'error', ms: 10000 });
  }
  qs.delete('verified');
  const rest = qs.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
}

function installOnlineOffline() {
  let wasOnline = navigator.onLine !== false;
  const update = () => {
    const online = navigator.onLine !== false;
    // Al RECUPERAR la senal nadie recargaba los posts: la vista se quedaba con
    // la tarjeta de error (o antes, con el vacio de "no hay contenido") hasta
    // cerrar y reabrir la app. Ahora el shell reintenta la carga que fallo, y
    // con ella se arreglan TODAS las vistas del store (calendario, cuadricula,
    // tablero, tabla...). Las vistas con datos propios (Entregables) escuchan
    // 'online' por su cuenta.
    if (online && !wasOnline && store.getState().postsError) store.loadPosts();
    wasOnline = online;
    store.set({ online });
    if (offlineBar) offlineBar.hidden = online;
    // La barra vive en #barsHost: al ocultarse/mostrarse cambia --bars-h y
    // #subhead/#viewScroll se recolocan solos (shell.css). No roba taps.
    document.body.classList.toggle('is-offline', !online);
    syncBarsHeight();
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ── Pantalla de arranque fallido ─────────────────────────────────────────────
// El arranque puede fallar por DOS motivos MUY distintos y antes los dos
// terminaban en el login:
//   · sesión vencida (401)  → sí hay que ir al login.
//   · sin red / servidor caído (la petición ni siquiera llegó, o respondió
//     5xx) → NO es culpa de la contraseña. Mandar al login hace que el cliente
//     la escriba, vea "Error de conexión" y concluya que la app está rota.
// api.js solo pone `err.status` cuando HUBO respuesta del servidor: sin status
// = falla de red o timeout.
const isNetworkError = (err) => !err || err.status === undefined;

function showBootError(bootEl, err) {
  if (!bootEl) return;
  const offline = (navigator.onLine === false) || isNetworkError(err);
  const title = offline
    ? T('Sin conexión', 'Offline')
    : T('No pudimos cargar', "We couldn't load");
  // Nada de textos crudos del servidor aquí: el cliente no es técnico y un
  // "boom"/"D1_ERROR" en la primera pantalla asusta más que ayuda. El detalle
  // real va a la consola para nosotros.
  const detail = offline
    ? T('Revisa tu internet y vuelve a intentar. Tu sesión sigue abierta.',
        'Check your internet and try again. Your session is still open.')
    : T('El servidor no está respondiendo. Inténtalo en un momento; tu sesión sigue abierta.',
        'The server is not responding. Try again in a moment; your session is still open.');
  if (err) console.error('[shell] boot', err);

  clear(bootEl); // fuera el spinner: seguir girando parece "aún cargando"
  bootEl.appendChild(el('div', { class: 'boot-error' }, [
    el('div', { class: 'boot-error__icon', 'aria-hidden': 'true' }, [icon(offline ? 'wifi-off' : 'warning', 30)]),
    el('h2', { class: 'boot-error__title', text: title }),
    // Sin la clase `muted`: --text-mute sobre el fondo oscuro da 3.29:1 y
    // reprueba AA a 14px. El color lo pone .boot-error__msg (--text-dim,
    // 7.12:1 en oscuro y 6.96:1 en claro). Y justo esta linea es la unica que
    // explica que pasó y que tranquiliza ("tu sesión sigue abierta").
    el('p', { class: 'boot-error__msg', text: detail }),
    el('button', {
      class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'),
      onclick: () => location.reload(),
    }),
    // Salida manual al login. En el TWA de Android NO hay barra de direcciones:
    // si el servidor devolviera algo que no es 401 con una cookie invalida
    // (error de Cloudflare, 502 durante un deploy, WAF), sin este enlace el
    // usuario quedaba encerrado en esta pantalla para siempre.
    el('button', {
      class: 'btn btn-ghost boot-error__alt', type: 'button',
      text: T('Iniciar sesión', 'Sign in'),
      onclick: () => location.replace('/marketing/'),
    }),
  ]));

  // Al volver la señal se reintenta solo: el cliente no tiene que hacer nada.
  // Con debounce: en un elevador o con wifi malo la señal parpadea y cada
  // rebote recargaba la pagina entera. Se espera a que la conexion se
  // sostenga ~1.2s antes de recargar.
  let onlineTimer = null;
  window.addEventListener('online', () => {
    clearTimeout(onlineTimer);
    onlineTimer = setTimeout(() => {
      if (navigator.onLine !== false) location.reload();
    }, 1200);
  });
  window.addEventListener('offline', () => clearTimeout(onlineTimer));
}

// ── ctx por vista ────────────────────────────────────────────────────────────
function ctxFactory(view, params) {
  return {
    store,
    prefs,
    router: { navigate: router.navigate, current: router.current },
    sheet: { openSheet, pickFrom, closeAll, confirmDiscard },
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

  // 1) Auth gate. Se DISPARA /clients en paralelo con /auth/me (no depende de él;
  // la sesión la valida el backend) → ahorra una vuelta de red en cada arranque.
  const clientsP = api.get('/clients')
    .then((c) => (Array.isArray(c) ? c : []))
    .catch((e) => ({ __err: e }));
  let me;
  try {
    me = await api.get('/auth/me');
  } catch (err) {
    // SOLO un 401 significa "tu sesión ya no vale" → login. Si no hubo red (o
    // el servidor respondió 5xx) la sesión sigue viva: mandar al login hacía
    // que el cliente escribiera su contraseña, viera "Error de conexión" y
    // creyera que la app está descompuesta. Ahora: "Sin conexión — Reintentar".
    if (err && err.status === 401) { location.replace('/marketing/'); return; }
    showBootError(bootEl, err);
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

  // 2) Clientes (crítica) — ya venía cargando en paralelo desde arriba.
  const clients = await clientsP;
  if (clients && clients.__err) {
    // Sin clients no hay app: mismo estado de error que el auth gate (antes el
    // spinner se quedaba girando bajo el mensaje, como si siguiera cargando).
    if (clients.__err.status === 401) { location.replace('/marketing/'); return; }
    showBootError(bootEl, clients.__err);
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

  offlineBar = el('div', { class: 'offline-bar', hidden: true, text: T('Sin conexión', 'Offline') });
  getBarsHost().appendChild(offlineBar);

  applyAccent(activeClientId);
  installAuthInterceptor();
  installOnlineOffline();
  installVersionWatch();
  installVerifyBanner(me);
  consumeVerifiedParam();
  // Limpia el ?_v= que deja el botón "Actualizar" (version.applyUpdate): la
  // URL vuelve a quedar limpia para compartir o guardar en favoritos.
  version.consumeCacheBustParam();
  notifications.start();

  // 5) Router.
  router.init({
    host: viewHost,
    ctxFactory,
    fallback: 'tablero',
    onUnknownView: () => toast(T('Esa vista no existe. Te llevamos al tablero.', "That view doesn't exist. Taking you to the board."), { type: 'info' }),
    onBeforeMount(view, params, { paramsOnly }) {
      // El cliente solo entra a las vistas de calendario (+ editor de post via
      // deep-link). Cualquier otra vista lo regresa a su Calendario.
      if (isClientRole() && !clientCanView(view) && view !== 'post') {
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
  // #barsHost vive DENTRO de #app, así que todo lo que se midió durante el
  // arranque (offline / verifica tu correo) midió 0: #app estaba hidden. Ahora
  // que es visible hay que volver a publicar --bars-h, o la franja se quedaría
  // encima del subhead tapando el selector de vistas. El ResizeObserver también
  // lo haría, pero depende de que exista y de un frame de retraso: esto lo
  // vuelve determinista.
  requestAnimationFrame(syncBarsHeight);
}

// Re-exports utiles para los paquetes de vistas.
export { store, prefs, router, openSheet, pickFrom, closeAll, toast, icon };
