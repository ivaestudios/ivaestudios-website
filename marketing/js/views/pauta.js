// ============================================================================
// IVAE Marketing — Vista "Pauta" (anuncios pagados de la casa, solo admin).
//
// Pedido de la dueña (14-sep-2026): "un sistema para pautar y que tú veas y
// hagas los movimientos según rendimiento". Esto es el PASO 1 de eso: conectar
// la cuenta publicitaria y VER los números. Decidir y mover va después, con su
// bitácora y su interruptor, para que ejecutar sea una decisión explícita.
//
// Hoy es SOLO la cuenta de IVAE (no de marcas cliente): por eso no hay
// selector de marca y la sección es de admin. Ver functions/api/marketing/_ads.js.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202609150005';
import { icon } from '../shell/icons.js?v=202609150005';
import { T, isEN } from '../shell/i18n.js?v=202609150005';

const VIEW_ID = 'pauta';

let ctx = null;
let rootEl = null;
let dias = 7;

function esAdmin() { return ((ctx.store.getState().me || {}).role === 'admin'); }

// Meta manda los presupuestos en centavos de la moneda de la cuenta.
function dinero(centavos, moneda) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  try {
    return (n / 100).toLocaleString(isEN ? 'en-US' : 'es-MX', { style: 'currency', currency: moneda || 'MXN', maximumFractionDigits: 0 });
  } catch { return `${(n / 100).toFixed(0)} ${moneda || ''}`; }
}
// El gasto de insights viene en unidades enteras (no centavos), al revés.
function gasto(v, moneda) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try {
    return n.toLocaleString(isEN ? 'en-US' : 'es-MX', { style: 'currency', currency: moneda || 'MXN', maximumFractionDigits: 0 });
  } catch { return `${n.toFixed(0)} ${moneda || ''}`; }
}
function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try { return n.toLocaleString(isEN ? 'en-US' : 'es-MX'); } catch { return String(n); }
}

// El "resultado" de una campaña depende de su objetivo: mensajes, clics al
// sitio, interacciones… Meta lo devuelve en actions[], no en un campo fijo.
const ACCIONES_UTILES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'link_click',
  'landing_page_view',
  'lead',
  'purchase',
  'post_engagement',
];
function resultadoDe(ins) {
  const acts = (ins && ins.actions) || [];
  for (const tipo of ACCIONES_UTILES) {
    const a = acts.find((x) => x.action_type === tipo);
    if (a) {
      const costos = (ins.cost_per_action_type || []).find((x) => x.action_type === tipo);
      return { tipo, valor: Number(a.value) || 0, costo: costos ? Number(costos.value) : null };
    }
  }
  return null;
}
const NOMBRE_ACCION = {
  'onsite_conversion.messaging_conversation_started_7d': () => T('conversaciones', 'conversations'),
  link_click: () => T('clics al enlace', 'link clicks'),
  landing_page_view: () => T('visitas a la página', 'landing page views'),
  lead: () => T('registros', 'leads'),
  purchase: () => T('compras', 'purchases'),
  post_engagement: () => T('interacciones', 'engagements'),
};

function chipEstado(c) {
  const e = String(c.effective_status || c.status || '').toUpperCase();
  const mapa = {
    ACTIVE: [T('Activa', 'Active'), 'ok'],
    PAUSED: [T('Pausada', 'Paused'), 'off'],
    IN_PROCESS: [T('Procesando', 'Processing'), 'warn'],
    WITH_ISSUES: [T('Con problemas', 'With issues'), 'warn'],
    CAMPAIGN_PAUSED: [T('Pausada', 'Paused'), 'off'],
    ADSET_PAUSED: [T('Pausada', 'Paused'), 'off'],
    DELETED: [T('Borrada', 'Deleted'), 'off'],
    ARCHIVED: [T('Archivada', 'Archived'), 'off'],
  };
  const [txt, tono] = mapa[e] || [e || '—', 'off'];
  return el('span', { class: `pauta-chip pauta-chip--${tono}`, text: txt });
}

function tarjetaCampana(c, moneda) {
  const ins = (c.insights && c.insights.data && c.insights.data[0]) || null;
  const r = resultadoDe(ins);
  const presupuesto = c.daily_budget
    ? `${dinero(c.daily_budget, moneda)} ${T('al día', 'a day')}`
    : (c.lifetime_budget ? `${dinero(c.lifetime_budget, moneda)} ${T('en total', 'total')}` : T('sin presupuesto', 'no budget'));

  const dato = (etiqueta, valor) => el('div', { class: 'pauta-dato' }, [
    el('div', { class: 'pauta-dato__v', text: valor }),
    el('div', { class: 'pauta-dato__k', text: etiqueta }),
  ]);

  return el('div', { class: 'pauta-card' }, [
    el('div', { class: 'pauta-card__top' }, [
      el('div', { class: 'pauta-card__name', text: c.name || '—' }),
      chipEstado(c),
    ]),
    el('div', { class: 'pauta-card__sub', text: presupuesto }),
    el('div', { class: 'pauta-datos' }, [
      dato(T('Gastado', 'Spent'), ins ? gasto(ins.spend, moneda) : '—'),
      dato(T('Alcance', 'Reach'), ins ? num(ins.reach) : '—'),
      dato(T('Clics', 'Clicks'), ins ? num(ins.clicks) : '—'),
      r
        ? dato((NOMBRE_ACCION[r.tipo] || (() => r.tipo))(), num(r.valor))
        : dato(T('Resultados', 'Results'), '—'),
      r && r.costo != null
        ? dato(T('Costo por resultado', 'Cost per result'), gasto(r.costo, moneda))
        : null,
    ].filter(Boolean)),
  ]);
}

function cabecera() {
  const sel = el('div', { class: 'pauta-rango' }, [7, 14, 30].map((d) => el('button', {
    class: 'btn btn-sm' + (d === dias ? ' is-active' : ''), type: 'button',
    text: T(`${d} días`, `${d} days`),
    onclick: () => { dias = d; render(); },
  })));
  return el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Pauta', 'Ads') }),
    el('p', { class: 'mk-sub', text: T(
      'Los anuncios pagados de IVAE. Aquí se ve qué gastó cada campaña y qué devolvió.',
      "IVAE's paid ads. What each campaign spent and what it returned.",
    ) }),
    sel,
  ]);
}

function vacio(iconName, titulo, texto, boton) {
  return el('div', { class: 'pauta-empty' }, [
    icon(iconName, 28),
    el('h2', { text: titulo }),
    el('p', { text: texto }),
    boton || null,
  ].filter(Boolean));
}

async function conectar() {
  const url = `/api/marketing/ads/login${isEN ? '?lang=en' : ''}`;
  const r = await fetch(url, { credentials: 'include', redirect: 'manual' });
  if (r.status === 503) {
    let msg = T('Falta configurar la pauta en la app de Meta.', 'Ads setup is missing in the Meta app.');
    try { const d = await r.json(); if (d && d.error) msg = d.error; } catch { /* sin cuerpo */ }
    toast(msg, { type: 'error' });
    return;
  }
  window.location.href = url;
}

async function render() {
  if (!rootEl) return;
  clear(rootEl);
  if (!esAdmin()) {
    rootEl.appendChild(vacio('lock', T('Solo la dueña', 'Owner only'), T(
      'La pauta es dinero de la casa: esta sección no se comparte.',
      "Ads are the studio's own money: this section is not shared.",
    )));
    return;
  }
  rootEl.appendChild(cabecera());

  const cargando = el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })]);
  rootEl.appendChild(cargando);

  let estado = null;
  try {
    estado = await (await fetch('/api/marketing/ads/estado', { credentials: 'include' })).json();
  } catch {
    cargando.remove();
    rootEl.appendChild(vacio('warning', T('Sin conexión', 'Offline'), T('No se pudo consultar. Reintenta.', 'Could not check. Try again.')));
    return;
  }
  cargando.remove();

  if (!estado || !estado.conectada) {
    rootEl.appendChild(vacio(
      'link',
      T('Conecta tu cuenta publicitaria', 'Connect your ad account'),
      estado && estado.falta_config
        ? estado.falta_config
        : T(
          'Para leer tus campañas y sus números hace falta darle acceso a la cuenta publicitaria de IVAE.',
          "To read your campaigns and their numbers, the app needs access to IVAE's ad account.",
        ),
      estado && estado.falta_config ? null : el('button', {
        class: 'btn btn-primary', type: 'button',
        text: T('Conectar cuenta publicitaria', 'Connect ad account'),
        onclick: conectar,
      }),
    ));
    return;
  }

  const moneda = (estado.cuenta && estado.cuenta.currency) || 'MXN';

  // Sin método de pago Meta no deja publicar: se avisa aquí, no cuando falle.
  if (estado.pago && !estado.pago.medio_pago) {
    rootEl.appendChild(el('div', { class: 'pauta-aviso' }, [
      icon('warning', 18),
      el('span', { text: T(
        'Esta cuenta no tiene método de pago, así que Meta no va a dejar publicar ninguna campaña. Ponlo en Business Manager, en la cuenta publicitaria.',
        'This account has no payment method, so Meta will not let any campaign run. Add it in Business Manager, on the ad account.',
      ) }),
    ]));
  }

  const lista = el('div', { class: 'pauta-grid' });
  rootEl.appendChild(lista);
  lista.appendChild(el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })]));

  let data = null;
  try {
    data = await (await fetch(`/api/marketing/ads/campanas?dias=${dias}`, { credentials: 'include' })).json();
  } catch { /* se trata abajo */ }
  clear(lista);

  if (!data || data.error) {
    lista.appendChild(vacio('warning', T('No se pudieron leer las campañas', 'Could not read campaigns'), (data && data.error) || ''));
    return;
  }
  if (!data.campanas.length) {
    lista.appendChild(vacio('spark', T('Todavía no hay campañas', 'No campaigns yet'), T(
      'Cuando crees la primera en Meta, aparece aquí con sus números.',
      'When you create the first one in Meta, it shows up here with its numbers.',
    )));
    return;
  }
  for (const c of data.campanas) lista.appendChild(tarjetaCampana(c, moneda));
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/pauta.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/pauta.css?v=202609150005';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'pauta-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() { rootEl = null; ctx = null; },
};
