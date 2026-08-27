// ============================================================================
// IVAE Marketing — Vista "Conexiones" (solo staff).
//
// Pedido de la dueña (2026-08-27, "que las empresas sean más fáciles de
// conectar"): UN tablero con el semáforo de redes de cada marca. Tarjeta por
// marca con estado de Instagram y Facebook, botón de conectar cuando falta, y
// "Copiar invitación": el mensaje de WhatsApp listo para que el dueño de la
// página apruebe la solicitud de acceso (Meta exige ese "sí" una vez por
// página; ver guía en memoria del proyecto). Los datos ya viajan en la lista
// de clientes (ig_username / fb_page_name / tt_username); aquí no hay fetch
// propio: la vista lee el store y se repinta con él.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202608270318';
import { icon } from '../shell/icons.js?v=202608270318';
import { T } from '../shell/i18n.js?v=202608270318';

const VIEW_ID = 'conexiones';

let ctx = null;
let rootEl = null;
let unsubs = [];

const INVITACION = () => T(
  'Te llegó una notificación de Facebook que dice "Vianey Dm solicitó acceso a tu página". Es de nuestra agencia, para publicarte también en Facebook en automático. Solo pícale Aprobar porfa 🙏 (La encuentras en la campanita de Facebook o en Business Suite → Configuración → Solicitudes.)',
  'You got a Facebook notification saying "Vianey Dm requested access to your Page". It is from our agency, so we can also auto-publish to Facebook for you. Just tap Approve please 🙏 (You will find it in the Facebook bell or in Business Suite → Settings → Requests.)'
);

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }

async function conectar(kind, clientId) {
  const url = `/api/marketing/${kind}/login?client_id=${encodeURIComponent(clientId)}`;
  const r = await fetch(url, { credentials: 'include', redirect: 'manual' });
  if (r.status === 503) {
    toast(T('Falta configurar la app de Meta para esta red.', 'The Meta app still needs setup for this network.'), { type: 'error' });
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
  return el('div', { class: 'cx-red' + (conectado ? ' cx-red--ok' : '') }, [
    el('span', { class: 'cx-red__ico' }, [icon(icono, 16)]),
    el('span', { class: 'cx-red__nombre', text: nombre }),
    conectado
      ? el('span', { class: 'cx-red__estado cx-red__estado--ok', text: detalle })
      : el('button', {
          class: 'btn cx-red__btn', type: 'button', onclick: onConnect,
        }, [el('span', { text: T('Conectar', 'Connect') })]),
  ]);
}

function tarjeta(c) {
  const ig = c.ig_username ? '@' + c.ig_username : null;
  const fb = c.fb_page_name || null;
  const completa = !!(ig && fb);
  return el('article', { class: 'cx-card' + (completa ? ' cx-card--full' : '') }, [
    el('header', { class: 'cx-card__head' }, [
      el('span', { class: 'cx-card__dot', style: { background: c.brand_color || 'var(--acc, #7c3aed)' } }),
      el('h2', { class: 'cx-card__name', text: c.name }),
      completa ? el('span', { class: 'cx-card__badge', text: T('Completa', 'Complete') }) : null,
    ].filter(Boolean)),
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
    fb ? null : el('button', {
      class: 'cx-invitar', type: 'button', onclick: copiarInvitacion,
    }, [icon('copy', 14), ' ' + T('Copiar invitación para el dueño', "Copy the owner's invite")]),
  ].filter(Boolean));
}

function render() {
  if (!rootEl) return;
  clear(rootEl);

  if (isClient()) {
    rootEl.appendChild(el('div', { class: 'cx-empty' }, [
      icon('link', 28),
      el('p', { text: T('Esta sección es del equipo.', 'This section is for the team.') }),
    ]));
    return;
  }

  rootEl.appendChild(el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Conexiones', 'Connections') }),
    el('p', { class: 'mk-sub', text: T(
      'El semáforo de redes por marca. Verde = publica en automático. Si falta Facebook: conéctalo si administras la página, o copia la invitación y mándasela al dueño (solo tiene que picar Aprobar).',
      'The per-brand network status. Green = auto-publishing. If Facebook is missing: connect it if you manage the Page, or copy the invite and send it to the owner (they just tap Approve).'
    ) }),
  ]));

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
  link.href = '/marketing/css/conexiones.css?v=202608270318';
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
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null;
  },
};
