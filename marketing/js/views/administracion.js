// ============================================================================
// IVAE Marketing — Vista "Administración" (solo admin, solo IVAE STUDIOS).
//
// Pedido de Vianey (5-nov-2026): "un sistema de administración… checar las
// pautas… 100 pesos al día… todo al número de Juan… cuántos leads tenemos en
// pauta y cuántos en SEO… el costo por sesión ya cerrada, el costo de pauta y
// el ticket promedio… volvemos a los paquetes anteriores".
//
// Por mes: lo que se gastó en pauta, los leads por fuente, las sesiones
// cerradas, el costo por lead y por sesión de pauta, y el ticket promedio con
// los paquetes vigentes. La fuente de cada lead se deduce sola y se corrige con
// un toque. Los correos solo se LEEN (regla de Vianey). Backend: _negocio.js.
// ============================================================================
import { api, el, clear } from '../api.js?v=202611060116';
import { icon, iconMarca } from '../shell/icons.js?v=202611060116';
import { T, isEN } from '../shell/i18n.js?v=202611060116';
import { toast } from '../shell/toast.js?v=202611060116';

const VIEW_ID = 'administracion';

let ctx = null;
let rootEl = null;
let mes = null;            // 'AAAA-MM'; null = el mes actual
let data = null;
let filtroLeads = 'todos';
let verTodosLeads = false;

const LOC = isEN ? 'en-US' : 'es-MX';
const FUENTES = [
  ['pauta', () => T('Pauta', 'Ads')],
  ['seo', () => T('SEO', 'SEO')],
  ['redes', () => T('Redes', 'Social')],
  ['recomendacion', () => T('Recomendación', 'Referral')],
  ['hotel', () => T('Hotel o agencia', 'Hotel or agency')],
  ['otro', () => T('Otro', 'Other')],
];
const FUENTE_SUB = {
  pauta: () => T('Anuncios de Meta', 'Meta ads'),
  seo: () => T('Google y el sitio web', 'Google and the website'),
  redes: () => T('Instagram o Facebook sin anuncio', 'Instagram or Facebook, no ad'),
  recomendacion: () => T('Alguien nos recomendó', 'Someone referred us'),
  hotel: () => T('Lo mandó un hotel o una agencia', 'Sent by a hotel or agency'),
  otro: () => T('Otra vía', 'Other'),
};
const nombreFuente = (f) => {
  if (f === 'no_lead') return T('No es lead', 'Not a lead');
  const x = FUENTES.find(([k]) => k === f);
  return x ? x[1]() : T('¿De dónde?', 'Where from?');
};
const CANAL_TXT = { instagram: 'Instagram', messenger: 'Facebook', whatsapp: 'WhatsApp', correo: T('Correo', 'Email'), llamada: T('Llamada', 'Call'), whatsapp_990: 'WhatsApp 990', persona: T('En persona', 'In person'), otro: T('Otro', 'Other') };
const icoCanal = (c, n = 18) => {
  if (c === 'correo') return icon('mail', n);
  if (c === 'llamada') return icon('phone', n);
  if (c === 'persona' || c === 'otro') return icon('user', n);
  const marca = { instagram: 'instagram', messenger: 'messenger', whatsapp: 'whatsapp', whatsapp_990: 'whatsapp' }[c];
  return (marca && iconMarca(marca, n)) || icon('link', n);
};

function esAdmin() { return ((ctx.store.getState().me || {}).role === 'admin'); }

// ── Formato ─────────────────────────────────────────────────────────────────
function mxn(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  try { return n.toLocaleString(LOC, { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }); } catch { return `$${Math.round(n)}`; }
}
// "US$395": con el formato de moneda es-MX salía "USD 395", que se confunde al lado de los pesos.
function usd(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  return `US$${n.toLocaleString(LOC, { maximumFractionDigits: 0 })}`;
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString(LOC) : '—'; }
function nombreMes(m) {
  const [a, mm] = String(m).split('-').map(Number);
  const s = new Date(Date.UTC(a, mm - 1, 15)).toLocaleDateString(LOC, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function diaCorto(ymd) {
  if (!ymd) return '';
  const d = new Date(`${ymd}T12:00:00Z`);
  return isNaN(d) ? ymd : d.toLocaleDateString(LOC, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function mesVecino(m, delta) {
  const [a, mm] = String(m).split('-').map(Number);
  const d = new Date(Date.UTC(a, mm - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const hoyCancun = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

// ── Datos ───────────────────────────────────────────────────────────────────
async function cargar() {
  const q = mes ? `?mes=${encodeURIComponent(mes)}` : '';
  data = await api.get(`/negocio/resumen${q}`);
  mes = data.periodo.mes;
  return data;
}
// Tras cada cambio se vuelve a pedir el resumen: los números salen del servidor
// y así nunca se contradicen con la lista.
async function recargar() {
  try { await cargar(); pintar(); } catch (e) { toast(e.message || T('No se pudo actualizar.', 'Could not refresh.'), 'error'); }
}

// ── Pantalla ────────────────────────────────────────────────────────────────
async function render() {
  if (!rootEl) return;
  clear(rootEl);
  if (!esAdmin()) {
    rootEl.appendChild(vacio('key', T('Solo la dueña', 'Owner only'), T(
      'Los números del negocio no se comparten.',
      'Business numbers are not shared.',
    )));
    return;
  }
  rootEl.appendChild(el('div', { class: 'adm-empty' }, [el('span', { class: 'spinner' })]));
  try {
    await cargar();
  } catch (e) {
    clear(rootEl);
    rootEl.appendChild(vacio('warning', T('No se pudo cargar', 'Could not load'), (e && e.message) || '', el('button', {
      class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'), onclick: render,
    })));
    return;
  }
  pintar();
}

// ── El tablero: pestañas por pregunta ────────────────────────────────────────
// Vianey (6-nov-2026): "no siento que sea un sistema de administración, no es
// muy visual… quiero costo por reserva, costo por lead, info de la campaña,
// cosas para tomar decisiones y saber qué anuncio o qué publicación funciona
// mejor". Cada pestaña contesta UNA pregunta, con números grandes y gráficas;
// el mes de arriba manda en todas.
const IVAE_STUDIOS_ID = '6ae5dd2381faa430d9e6966470b29602';
const PESTANAS = [
  ['resumen', () => T('Resumen', 'Overview')],
  ['anuncios', () => T('Anuncios', 'Ads')],
  ['publicaciones', () => T('Publicaciones', 'Posts')],
  ['clientes', () => T('Clientes', 'Clients')],
  ['dinero', () => T('Dinero', 'Money')],
];
let pestana = (() => { try { return localStorage.getItem('adm_pestana') || 'resumen'; } catch { return 'resumen'; } })();
function irPestana(p) {
  if (p === 'bandeja') { ctx.router.navigate('bandeja', { cliente: IVAE_STUDIOS_ID, tab: 'embudo' }); return; }
  pestana = PESTANAS.some(([k]) => k === p) ? p : 'resumen';
  try { localStorage.setItem('adm_pestana', pestana); } catch { /* sin almacenamiento */ }
  pintar();
  try { rootEl.scrollIntoView({ block: 'start' }); } catch { /* noop */ }
}

function pintar() {
  if (!rootEl || !data) return;
  clear(rootEl);
  const porPestana = {
    resumen: [() => kpisResumen(data), () => decisiones(data), () => embudoAnuncios(data), () => origenClientes(data)],
    anuncios: [() => tarjetaPauta(data), () => seccionAnuncios(data)],
    publicaciones: [() => seccionPublicaciones(data)],
    clientes: [() => kpisClientes(data), () => origenClientes(data), () => seccionLeads(data)],
    dinero: [() => dineroHero(data), () => graficaMeses(data), () => quienPaga(data), () => seccionVentas(data), () => seccionGastos(data), () => seccionPaquetes(data)],
  };
  const secciones = [cabecera, barraPestanas, ...(porPestana[pestana] || porPestana.resumen)];
  // Una sección que reviente no se lleva la pantalla entera.
  for (const s of secciones) {
    try { const n = s(); if (n) rootEl.appendChild(n); }
    catch (e) { console.error('[administracion]', e); }
  }
}

function vacio(iconName, titulo, texto, boton) {
  return el('div', { class: 'adm-empty' }, [
    icon(iconName, 28),
    el('h2', { text: titulo }),
    texto ? el('p', { text: texto }) : null,
    boton || null,
  ]);
}

function cabecera() {
  const hoyMes = hoyCancun().slice(0, 7);
  const ir = (delta) => { mes = mesVecino(mes, delta); verTodosLeads = false; render(); };
  return el('div', { class: 'mk-head adm-head' }, [
    el('h1', { class: 'mk-title', text: T('Administración', 'Administration') }),
    el('p', { class: 'mk-sub', text: T(
      'Qué te trae clientes, cuánto te cuesta y cuánto te queda.',
      'What brings you clients, what it costs and what you keep.',
    ) }),
    el('div', { class: 'adm-mes' }, [
      el('button', { class: 'adm-mes__b', type: 'button', 'aria-label': T('Mes anterior', 'Previous month'), onclick: () => ir(-1) }, [icon('left', 20)]),
      el('span', { class: 'adm-mes__t', text: nombreMes(mes) }),
      el('button', {
        class: 'adm-mes__b', type: 'button', 'aria-label': T('Mes siguiente', 'Next month'),
        disabled: mes >= hoyMes, onclick: () => ir(1),
      }, [icon('right', 20)]),
    ]),
  ]);
}

function barraPestanas() {
  return el('nav', { class: 'adm-tabs', role: 'tablist', 'aria-label': T('Secciones', 'Sections') }, PESTANAS.map(([k, txt]) => el('button', {
    class: 'adm-tab' + (k === pestana ? ' is-active' : ''), type: 'button', role: 'tab',
    'aria-selected': k === pestana ? 'true' : 'false', onclick: () => irPestana(k),
  }, [txt()])));
}

const tituloSec = (texto, sub) => el('div', { class: 'adm-sec__cab' }, [
  el('h2', { class: 'adm-sec__h', text: texto }),
  sub ? el('p', { class: 'adm-sec__sub', text: sub }) : null,
]);

function tile(valor, etiqueta, sub, tono) {
  return el('div', { class: 'adm-kpi' + (tono ? ` adm-kpi--${tono}` : '') }, [
    el('div', { class: 'adm-kpi__v', text: valor }),
    el('div', { class: 'adm-kpi__k', text: etiqueta }),
    sub ? el('div', { class: 'adm-kpi__s', text: sub }) : null,
  ]);
}

// ── Resumen ─────────────────────────────────────────────────────────────────
function kpisResumen(d) {
  const k = d.kpis;
  const queda = k.queda_mxn;
  return el('section', { class: 'adm-kpis' }, [
    tile(mxn(k.ingresos_mxn), T('Entró este mes', 'In this month'), T(`${num(k.sesiones_n)} ${k.sesiones_n === 1 ? 'sesión' : 'sesiones'} y ${num((d.ventas || []).filter((v) => v.tipo === 'marca').length)} marcas`, `${num(k.sesiones_n)} sessions and brands`), 'brand'),
    // A medio mes lo normal es que falte (los gastos fijos van completos): se dice "te falta", no "-$".
    queda != null && queda < 0
      ? tile(mxn(-queda), T('Te falta para cubrir el mes', 'Still needed this month'), T('Gastos, ofrenda, SAT y anuncios', 'Expenses, tithe, taxes and ads'), 'mal')
      : tile(queda != null ? mxn(queda) : '—', T('Te queda', 'You keep'), T('Ya sin gastos, ofrenda, SAT ni anuncios', 'After expenses, tithe, taxes and ads'), 'ok'),
    tile(k.costo_lead_pauta != null ? mxn(k.costo_lead_pauta) : '—', T('Costo por lead', 'Cost per lead'),
      k.costo_lead_pauta != null ? T('Cada persona que te escribió por un anuncio', 'Each person who wrote from an ad') : T('Aún nadie te escribió por un anuncio', 'Nobody wrote from an ad yet')),
    tile(k.costo_sesion_pauta != null ? mxn(k.costo_sesion_pauta) : '—', T('Costo por reserva', 'Cost per booking'),
      k.costo_sesion_pauta != null ? T('Cada sesión que llegó por anuncio', 'Each session that came from an ad') : T('Aún sin reservas de anuncios', 'No bookings from ads yet')),
  ]);
}

const ICONO_TONO = { accion: 'zap', bien: 'check', alerta: 'warning' };
const IR_TXT = { anuncios: () => T('Ver anuncios', 'See ads'), publicaciones: () => T('Ver publicaciones', 'See posts'), dinero: () => T('Ver dinero', 'See money'), clientes: () => T('Ver clientes', 'See clients'), bandeja: () => T('Abrir la Bandeja', 'Open the Inbox') };
function decisiones(d) {
  const recs = d.recomendaciones || [];
  if (!recs.length) return null;
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('Qué te recomiendo hacer', 'What I recommend'), T('Lo más importante primero.', 'Most important first.')),
    el('ul', { class: 'adm-recs' }, recs.map((r) => el('li', { class: `adm-rec adm-rec--${r.tono}` }, [
      el('span', { class: 'adm-rec__ico' }, [icon(ICONO_TONO[r.tono] || 'info', 18)]),
      el('div', { class: 'adm-rec__main' }, [
        el('div', { class: 'adm-rec__t', text: r.titulo }),
        el('p', { class: 'adm-rec__p', text: r.texto }),
        r.ir && IR_TXT[r.ir] ? el('button', { class: 'adm-rec__ir', type: 'button', onclick: () => irPestana(r.ir) }, [el('span', { text: IR_TXT[r.ir]() }), icon('right', 14)]) : null,
      ]),
    ]))),
  ]);
}

// El camino del dinero en anuncios: cuánto se metió y en qué se convirtió,
// con lo que costó cada paso. Sin barras proporcionales: los pasos van de
// miles de personas a unas cuantas reservas y una barra no se vería.
function embudoAnuncios(d) {
  const e = d.embudo || {};
  const k = d.kpis;
  const paso = (valor, etiqueta, costo) => el('li', { class: 'adm-paso' }, [
    el('div', { class: 'adm-paso__v', text: valor }),
    el('div', { class: 'adm-paso__k', text: etiqueta }),
    costo ? el('div', { class: 'adm-paso__c', text: costo }) : null,
  ]);
  const gasto = Number(e.gasto) || 0;
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('Tus anuncios este mes', 'Your ads this month'), gasto
      ? T('Lo que metiste y en qué se convirtió.', 'What you put in and what it turned into.')
      : T('Este mes no ha corrido ningún anuncio.', 'No ads have run this month.')),
    el('ol', { class: 'adm-pasos' + (gasto ? '' : ' is-vacio') }, [
      paso(mxn(gasto), T('Invertiste', 'You spent'), d.periodo.es_actual ? T(`de ${mxn(k.presupuesto_mes)} del mes`, `of ${mxn(k.presupuesto_mes)} this month`) : null),
      paso(e.alcance != null ? num(e.alcance) : '—', T('Personas que lo vieron', 'People who saw it'), null),
      paso(num(e.leads || 0), T('Te escribieron', 'Wrote to you'), e.leads ? T(`${mxn(gasto / e.leads)} cada uno`, `${mxn(gasto / e.leads)} each`) : (e.resultados_meta ? T(`Meta contó ${num(e.resultados_meta)} resultados`, `Meta counted ${num(e.resultados_meta)} results`) : null)),
      paso(num(e.reservas || 0), T('Reservaron', 'Booked'), e.reservas ? T(`${mxn(gasto / e.reservas)} cada reserva`, `${mxn(gasto / e.reservas)} per booking`) : null),
      paso(mxn(e.ventas_mxn || 0), T('Te pagaron', 'Paid you'), gasto && e.ventas_mxn ? T(`por cada $1 regresaron $${(e.ventas_mxn / gasto).toLocaleString(LOC, { maximumFractionDigits: 1 })}`, `each $1 brought back $${(e.ventas_mxn / gasto).toLocaleString(LOC, { maximumFractionDigits: 1 })}`) : null),
    ]),
  ]);
}

// Barras horizontales de una sola serie (un color), ordenadas, con el valor al
// final de cada barra. `destacar` pinta UNA barra en el color fuerte y el resto
// en gris (énfasis): para "la mejor".
function barrasH(items, { formato = num, destacar = null, unColor = true } = {}) {
  const max = Math.max(...items.map((x) => x.valor), 0) || 1;
  return el('ul', { class: 'adm-barras' }, items.map((x) => el('li', { class: 'adm-barra' }, [
    el('div', { class: 'adm-barra__k', title: x.etiqueta, text: x.etiqueta }),
    el('div', { class: 'adm-barra__fila' }, [
      el('div', { class: 'adm-barra__pista' }, [el('div', {
        class: 'adm-barra__b' + (destacar != null ? (x.id === destacar ? ' is-on' : ' is-gris') : (unColor ? '' : '')),
        style: { width: `${Math.max(2, (x.valor / max) * 100)}%` },
      })]),
      el('div', { class: 'adm-barra__v', text: formato(x.valor) }),
    ]),
  ])));
}

function origenClientes(d) {
  const k = d.kpis.leads || {};
  const items = [
    ['pauta', T('Anuncios', 'Ads')], ['seo', T('Google y sitio web', 'Google and website')], ['redes', T('Instagram y Facebook', 'Instagram and Facebook')],
    ['recomendacion', T('Recomendación', 'Referral')], ['hotel', T('Hotel o agencia', 'Hotel or agency')], ['otro', T('Otro', 'Other')], ['sin_definir', T('Sin saber', 'Unknown')],
  ].map(([id, etiqueta]) => ({ id, etiqueta, valor: Number(k[id]) || 0 })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('¿De dónde llegan tus clientes?', 'Where do your clients come from?'), T(`${num(k.total || 0)} personas nuevas te escribieron este mes.`, `${num(k.total || 0)} new people wrote to you this month.`)),
    items.length ? barrasH(items) : el('p', { class: 'adm-vacio', text: T('Todavía nadie nuevo este mes.', 'Nobody new this month yet.') }),
  ]);
}

const SINGULARES = { mensajes: 'mensaje', registros: 'registro', compras: 'compra', 'visitas a la página': 'visita', clics: 'clic', interacciones: 'interacción' };
const recorte = (s, n = 40) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const dato = (v, k) => el('div', { class: 'adm-dato' }, [el('div', { class: 'adm-dato__v', text: v }), el('div', { class: 'adm-dato__k', text: k })]);
// ── Anuncios ────────────────────────────────────────────────────────────────
const ESTADO_AD = { activo: () => T('Encendido', 'Running'), pausado: () => T('Pausado', 'Paused'), terminado: () => T('Terminado', 'Ended') };
function seccionAnuncios(d) {
  const a = d.anuncios || {};
  const lista = a.lista || [];
  const rango = a.rango === '90' ? T('Últimos 90 días (este mes no hubo anuncios)', 'Last 90 days (no ads this month)') : T('Este mes', 'This month');
  if (!lista.length) {
    return el('section', { class: 'adm-sec' }, [
      tituloSec(T('¿Qué anuncio funciona mejor?', 'Which ad works best?'), rango),
      el('p', { class: 'adm-vacio', text: a.error ? T('Meta no respondió. Intenta en un rato.', "Meta didn't answer. Try again later.") : T('No hubo anuncios con gasto en este tiempo.', 'No ads with spend in this period.') }),
    ]);
  }
  const conCosto = lista.filter((x) => x.resultado && x.resultado.costo != null);
  const unidad = (x) => (x.resultado ? (SINGULARES[x.resultado.nombre] || x.resultado.nombre) : '');
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('¿Qué anuncio funciona mejor?', 'Which ad works best?'), rango),
    // Con clientes: cuánto costó cada persona que escribió. Sin clientes: cuánto
    // costó cada resultado que buscaba el anuncio (clic, visita, interacción).
    a.criterio === 'lead' ? el('div', { class: 'adm-sub' }, [
      el('div', { class: 'adm-sub__t', text: T('Cuánto te costó cada persona que te escribió (menos es mejor)', 'Cost per person who wrote to you (lower is better)') }),
      barrasH(lista.filter((x) => x.leads > 0).map((x) => ({ id: x.ad_id, etiqueta: recorte(x.nombre, 34), valor: x.costo_lead })).sort((p, q) => p.valor - q.valor), { formato: mxn, destacar: a.mejor }),
    ]) : (conCosto.length > 1 ? el('div', { class: 'adm-sub' }, [
      el('div', { class: 'adm-sub__t', text: T('Ninguno trajo clientes todavía. Esto es lo que costó lo que sí consiguieron:', 'None brought clients yet. This is what each result cost:') }),
      barrasH(conCosto.map((x) => ({ id: x.ad_id, etiqueta: `${recorte(x.nombre, 28)} · ${T('por', 'per')} ${unidad(x)}`, valor: x.resultado.costo })).sort((p, q) => p.valor - q.valor), { formato: mxn }),
    ]) : null),
    el('ul', { class: 'adm-ads' }, lista.map((x) => el('li', { class: 'adm-ad' + (x.ad_id === a.mejor && a.criterio === 'lead' ? ' is-mejor' : '') }, [
      el('div', { class: 'adm-ad__top' }, [
        x.foto ? el('img', { class: 'adm-ad__foto', src: x.foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('span', { class: 'adm-ad__foto adm-ad__foto--vacia' }, [icon('spark', 20)]),
        el('div', { class: 'adm-ad__cab' }, [
          el('div', { class: 'adm-ad__n', text: x.nombre }),
          el('div', { class: 'adm-ad__chips' }, [
            el('span', { class: `adm-chip adm-chip--${x.estado === 'activo' ? 'ok' : 'off'}`, text: (ESTADO_AD[x.estado] || ESTADO_AD.terminado)() }),
            x.ad_id === a.mejor ? el('span', { class: 'adm-chip adm-chip--top', text: a.criterio === 'lead' ? T('El mejor', 'Best') : T('Más barato', 'Cheapest') }) : null,
            x.ad_id === a.peor ? el('span', { class: 'adm-chip adm-chip--warn', text: T('El más caro', 'Most expensive') }) : null,
          ]),
        ]),
      ]),
      el('div', { class: 'adm-ad__datos' }, [
        dato(mxn(x.gasto), T('Gastó', 'Spent')),
        dato(num(x.alcance), T('Lo vieron', 'Saw it')),
        dato(x.resultado ? num(x.resultado.valor) : '—', x.resultado ? x.resultado.nombre : T('resultados', 'results')),
        dato(x.resultado && x.resultado.costo != null ? mxn(x.resultado.costo) : '—', x.resultado ? T(`por ${unidad(x)}`, `per ${unidad(x)}`) : T('por resultado', 'per result')),
        dato(num(x.leads), T('Te escribieron', 'Wrote to you')),
        dato(x.reservas ? `${num(x.reservas)} · ${mxn(x.costo_reserva)}` : '0', T('Reservaron', 'Booked')),
      ]),
      x.resultado && x.resultado.tipo === 'post_engagement'
        ? el('p', { class: 'adm-ad__nota', text: T('Este anuncio buscaba likes, no clientes.', 'This ad went after likes, not clients.') }) : null,
    ]))),
    el('div', { class: 'adm-mas' }, [el('button', { class: 'btn', type: 'button', onclick: () => ctx.router.navigate('pauta', {}) }, [T('Encender o pausar en Pauta', 'Turn on or pause in Ads')])]),
  ]);
}

// ── Publicaciones ───────────────────────────────────────────────────────────
function seccionPublicaciones(d) {
  const p = d.publicaciones || {};
  const lista = p.lista || [];
  const rango = p.rango === '90' ? T('Últimos 90 días', 'Last 90 days') : T('Este mes', 'This month');
  if (!lista.length) {
    return el('section', { class: 'adm-sec' }, [
      tituloSec(T('¿Qué publicación funciona mejor?', 'Which post works best?'), rango),
      el('p', { class: 'adm-vacio', text: p.error || T('No hay publicaciones en este tiempo.', 'No posts in this period.') }),
    ]);
  }
  const top = lista.slice(0, 8);
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('¿Qué publicación funciona mejor?', 'Which post works best?'), T(`${rango}: la que más interacción tuvo (likes, comentarios, guardados y compartidos).`, `${rango}: the one with the most interaction.`)),
    el('div', { class: 'adm-sub' }, [
      el('div', { class: 'adm-sub__t', text: T('Interacciones por publicación', 'Interactions per post') }),
      barrasH(top.map((x) => ({ id: x.id, etiqueta: `${x.tipo === 'reel' ? 'Reel' : 'Post'} · ${diaCorto(x.fecha)} · ${recorte(x.texto, 26)}`, valor: x.interacciones })), { destacar: top[0] && top[0].id }),
    ]),
    el('ul', { class: 'adm-pubs' }, lista.slice(0, 12).map((x, i) => el('li', {}, [el('a', {
      class: 'adm-pub' + (i === 0 ? ' is-mejor' : ''), href: x.enlace || '#', target: '_blank', rel: 'noopener',
    }, [
      x.foto ? el('img', { class: 'adm-pub__foto', src: x.foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('span', { class: 'adm-pub__foto adm-ad__foto--vacia' }, [icon('camera', 22)]),
      el('div', { class: 'adm-pub__info' }, [
        el('div', { class: 'adm-pub__top' }, [
          el('span', { class: 'adm-pub__tipo', text: `${x.tipo === 'reel' ? 'Reel' : 'Post'} · ${diaCorto(x.fecha)}` }),
          i === 0 ? el('span', { class: 'adm-chip adm-chip--top', text: T('La mejor', 'Best') }) : null,
        ]),
        el('div', { class: 'adm-pub__txt', text: x.texto || T('Sin texto', 'No caption') }),
        el('div', { class: 'adm-pub__nums' }, [
          dato(num(x.interacciones), T('interacciones', 'interactions')),
          dato(x.alcance != null ? num(x.alcance) : '—', T('la vieron', 'reached')),
          dato(x.guardados != null ? num(x.guardados) : '—', T('guardados', 'saves')),
          dato(x.compartidos != null ? num(x.compartidos) : '—', T('compartidos', 'shares')),
        ]),
      ]),
    ])]))),
    el('p', { class: 'adm-nota', text: T('La que más gusta es la mejor candidata para convertirla en anuncio a WhatsApp.', 'The most liked one is the best candidate for a WhatsApp ad.') }),
  ]);
}

// ── Clientes ────────────────────────────────────────────────────────────────
function kpisClientes(d) {
  const k = d.kpis;
  return el('section', { class: 'adm-kpis' }, [
    tile(num(k.leads.total), T('Personas nuevas', 'New people'), T('Te escribieron este mes', 'Wrote to you this month'), 'brand'),
    tile(num(k.leads.pauta), T('Por anuncios', 'From ads'), k.costo_lead_pauta != null ? T(`${mxn(k.costo_lead_pauta)} cada una`, `${mxn(k.costo_lead_pauta)} each`) : null),
    tile(num(k.leads.seo), T('Por Google y el sitio', 'From Google and site'), T('Sin costo de anuncios', 'No ad cost')),
    tile(num(d.esperando || 0), T('Esperan respuesta', 'Waiting for a reply'), T('En el Embudo de la Bandeja', 'In the Inbox pipeline'), d.esperando ? 'mal' : 'ok'),
  ]);
}

// ── Dinero ──────────────────────────────────────────────────────────────────
function dineroHero(d) {
  const k = d.kpis;
  const entro = Number(k.ingresos_mxn) || 0;
  const partes = [
    [T('Gastos fijos', 'Fixed expenses'), Number(k.gastos_mxn) || 0],
    [T('Ofrenda', 'Tithe'), Number(k.ofrenda_mxn) || 0],
    [T('SAT', 'Taxes'), Number(k.sat_mxn) || 0],
    [T('Anuncios', 'Ads'), Number(k.gasto) || 0],
  ];
  const seVa = partes.reduce((s, [, v]) => s + v, 0);
  const queda = Number(k.queda_mxn) || 0;
  const escala = Math.max(entro, seVa) || 1;
  return el('section', { class: 'adm-sec adm-hero' }, [
    el('div', { class: 'adm-hero__k', text: queda >= 0 ? T('Te queda este mes', 'You keep this month') : T('Te falta este mes', 'Short this month') }),
    el('div', { class: 'adm-hero__v' + (queda < 0 ? ' is-mal' : ''), text: mxn(Math.abs(queda)) }),
    el('div', { class: 'adm-hero__fila' }, [
      el('span', {}, [T('Entró ', 'In '), el('b', { text: mxn(entro) })]),
      el('span', {}, [T('Se fue ', 'Out '), el('b', { text: mxn(seVa) })]),
    ]),
    // Una barra. Si alcanzó: lo que entró, partido en lo que se fue y lo que
    // queda. Si no: lo que se va del mes, y cuánto de eso ya cubre lo que entró.
    queda >= 0
      ? el('div', { class: 'adm-partes', role: 'img', 'aria-label': T(`Entró ${mxn(entro)}: se fue ${mxn(seVa)} y quedan ${mxn(queda)}`, `In ${mxn(entro)}: ${mxn(seVa)} out, ${mxn(queda)} left`) }, [
        seVa > 0 ? el('div', { class: 'adm-partes__b adm-partes__b--va', style: { width: `${(seVa / escala) * 100}%` } }) : null,
        queda > 0 ? el('div', { class: 'adm-partes__b adm-partes__b--queda', style: { width: `${(queda / escala) * 100}%` } }) : null,
      ])
      : el('div', { class: 'adm-partes', role: 'img', 'aria-label': T(`Se va ${mxn(seVa)}; lo que entró (${mxn(entro)}) cubre una parte y faltan ${mxn(-queda)}`, `${mxn(seVa)} goes out; income covers ${mxn(entro)}, ${mxn(-queda)} missing`) }, [
        entro > 0 ? el('div', { class: 'adm-partes__b adm-partes__b--queda', style: { width: `${(entro / escala) * 100}%` } }) : null,
        el('div', { class: 'adm-partes__b adm-partes__b--va', style: { width: `${((escala - entro) / escala) * 100}%` } }),
      ]),
    el('ul', { class: 'adm-leyenda' }, queda >= 0 ? [
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--va' }), T('Se fue', 'Out')]),
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--queda' }), T('Te queda', 'You keep')]),
    ] : [
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--queda' }), T('Ya cubierto con lo que entró', 'Covered by income')]),
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--va' }), T('Falta', 'Missing')]),
    ]),
    el('ul', { class: 'adm-gastos' }, partes.filter(([, v]) => v > 0).map(([t, v]) => el('li', {}, [el('span', { text: t }), el('span', { class: 'adm-gastos__m', text: mxn(v) })]))),
  ]);
}

// Columnas apiladas de 12 meses: sesiones y marcas. Tocar una columna abre ese mes.
let verTablaMeses = false;
function graficaMeses(d) {
  const serie = d.serie || [];
  const totales = serie.map((m) => (m.sesiones_mxn || 0) + (m.marcas_mxn || 0) + (m.otros_mxn || 0));
  const max = Math.max(...totales, 0);
  const tope = max > 0 ? Math.ceil(max / (max > 50000 ? 50000 : 10000)) * (max > 50000 ? 50000 : 10000) : 10000;
  const corto = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n)));
  const MESES_C = isEN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const etiqueta = (m) => MESES_C[Number(m.slice(5, 7)) - 1];
  const tip = el('div', { class: 'adm-tip', hidden: true });
  const mostrar = (m, x, host) => {
    clear(tip);
    poner(tip,
      el('div', { class: 'adm-tip__t', text: nombreMes(m.mes) }),
      el('div', { class: 'adm-tip__r' }, [el('span', { class: 'adm-tip__k adm-tip__k--1' }), el('b', { text: mxn(m.sesiones_mxn) }), el('span', { text: T(' sesiones', ' sessions') })]),
      el('div', { class: 'adm-tip__r' }, [el('span', { class: 'adm-tip__k adm-tip__k--2' }), el('b', { text: mxn(m.marcas_mxn) }), el('span', { text: T(' marcas', ' brands') })]),
      m.pauta_mxn ? el('div', { class: 'adm-tip__r adm-tip__r--dim', text: T(`Anuncios: ${mxn(m.pauta_mxn)}`, `Ads: ${mxn(m.pauta_mxn)}`) }) : null,
    );
    tip.hidden = false;
    const r = host.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(x - r.left, 70), r.width - 70)}px`;
  };
  const plot = el('div', { class: 'adm-cols', onpointerleave: () => { tip.hidden = true; } }, [
    // Rejilla: 0, la mitad y el tope; la franja de abajo (22px) es la de los meses.
    ...[1, 0.5, 0].map((f) => el('div', { class: 'adm-cols__grid' + (f === 0 ? ' is-base' : ''), style: { bottom: `calc(22px + ${f} * (100% - 22px))` } }, [el('span', { text: corto(tope * f) })])),
    ...serie.map((m) => {
      const s = m.sesiones_mxn || 0; const b = m.marcas_mxn || 0;
      const col = el('button', {
        class: 'adm-col' + (m.mes === mes ? ' is-on' : ''), type: 'button',
        'aria-label': `${nombreMes(m.mes)}: ${mxn(s)} ${T('de sesiones', 'from sessions')}, ${mxn(b)} ${T('de marcas', 'from brands')}`,
        onclick: () => { if (m.mes !== mes) { mes = m.mes; render(); } },
        onpointermove: (ev) => mostrar(m, ev.clientX, plot), onfocus: (ev) => mostrar(m, ev.currentTarget.getBoundingClientRect().left + 12, plot),
      }, [
        el('div', { class: 'adm-col__pila' }, [
          b > 0 ? el('div', { class: 'adm-col__seg adm-col__seg--2', style: { height: `${(b / tope) * 100}%` } }) : null,
          s > 0 ? el('div', { class: 'adm-col__seg adm-col__seg--1', style: { height: `${(s / tope) * 100}%` } }) : null,
        ]),
        el('span', { class: 'adm-col__x', text: etiqueta(m.mes) }),
      ]);
      return col;
    }),
    tip,
  ]);
  const tabla = verTablaMeses ? el('table', { class: 'adm-tabla' }, [
    el('thead', {}, [el('tr', {}, [T('Mes', 'Month'), T('Sesiones', 'Sessions'), T('Marcas', 'Brands'), 'Total'].map((h) => el('th', { text: h })))]),
    el('tbody', {}, serie.slice().reverse().map((m, i) => el('tr', {}, [
      el('td', { text: nombreMes(m.mes) }), el('td', { text: mxn(m.sesiones_mxn) }), el('td', { text: mxn(m.marcas_mxn) }), el('td', { text: mxn(totales[serie.length - 1 - i]) }),
    ]))),
  ]) : null;
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('Lo que entró mes a mes', 'Income month by month'), T('Toca un mes para verlo.', 'Tap a month to open it.')),
    el('ul', { class: 'adm-leyenda' }, [
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--1' }), T('Sesiones', 'Sessions')]),
      el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--2' }), T('Marcas', 'Brands')]),
    ]),
    plot,
    el('button', { class: 'adm-link', type: 'button', onclick: () => { verTablaMeses = !verTablaMeses; pintar(); } }, [verTablaMeses ? T('Ocultar tabla', 'Hide table') : T('Ver como tabla', 'View as table')]),
    tabla,
  ]);
}

// Quién te paga este mes: las sesiones juntas y cada empresa aparte.
function quienPaga(d) {
  const ventas = d.ventas || [];
  const porQuien = new Map();
  const ses = ventas.filter((v) => v.tipo !== 'marca').reduce((s, v) => s + (v.mxn > 0 ? v.mxn : 0), 0);
  if (ses > 0) porQuien.set('__ses', { id: '__ses', etiqueta: T('Sesiones (clientes)', 'Sessions (clients)'), valor: ses });
  for (const v of ventas.filter((x) => x.tipo === 'marca' && x.mxn > 0)) {
    const k = v.empresa || v.cliente || T('Marca', 'Brand');
    const f = porQuien.get(k) || { id: k, etiqueta: k, valor: 0 };
    f.valor += v.mxn; porQuien.set(k, f);
  }
  const items = [...porQuien.values()].sort((a, b) => b.valor - a.valor);
  if (!items.length) return null;
  return el('section', { class: 'adm-sec' }, [
    tituloSec(T('¿Quién te pagó este mes?', 'Who paid you this month?')),
    barrasH(items, { formato: mxn }),
  ]);
}

// ── Pauta: presupuesto, destino y campañas encendidas ───────────────────────
function tarjetaPauta(d) {
  const { cfg, pauta, juan } = d;
  const diario = Number(cfg.presupuesto_diario) || 0;
  const activas = (pauta && pauta.activas) || [];
  const sumaActivas = activas.reduce((s, c) => s + (Number(c.diario) || 0), 0);
  const juanVivo = juan && juan.en && (Date.now() - Date.parse(juan.en)) < 20 * 60 * 1000;

  const fila = (ico, k, v, extra) => el('div', { class: 'adm-pauta__fila' }, [
    el('span', { class: 'adm-pauta__ico' }, [ico]),
    el('div', { class: 'adm-pauta__txt' }, [
      el('div', { class: 'adm-pauta__k', text: k }),
      el('div', { class: 'adm-pauta__v' }, [v]),
    ]),
    extra || null,
  ]);

  const campanas = activas.length
    ? el('ul', { class: 'adm-camps' }, activas.map((c) => el('li', {}, [
      el('span', { class: 'adm-camps__n', text: c.nombre || '—' }),
      el('span', { class: 'adm-camps__d', text: c.diario ? `${mxn(c.diario)} ${T('al día', 'a day')}` : '' }),
    ])))
    : el('span', { text: T('Ninguna encendida ahora', 'None running now') });

  return el('section', { class: 'adm-pauta' }, [
    el('div', { class: 'adm-sec__t', text: T('Pauta', 'Ads') }),
    fila(icon('spark', 18), T('Presupuesto', 'Budget'),
      el('span', {}, [
        el('b', { text: `${mxn(diario)} ${T('al día', 'a day')}` }),
        el('span', { class: 'adm-dim', text: ` · ${T('≈', '≈')} ${mxn(diario * d.periodo.dias_mes)} ${T('al mes', 'a month')}` }),
      ]),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Cambiar', 'Change'), onclick: cambiarPresupuesto })),
    fila(iconMarca('whatsapp', 18) || icon('phone', 18), T('Todo llega a', 'Everything goes to'),
      el('span', {}, [
        el('b', { text: `${T('WhatsApp de', 'WhatsApp of')} ${(cfg.destino && cfg.destino.nombre) || 'Juan'}` }),
        el('span', { class: 'adm-dim', text: ' · ' }),
        el('span', { class: 'adm-dim adm-tel', text: (cfg.destino && cfg.destino.numero) || '' }),
        juan ? el('span', { class: 'adm-chip ' + (juanVivo ? 'adm-chip--ok' : 'adm-chip--warn'), text: juanVivo ? T('Juan activo', 'Juan online') : T('Juan sin reportarse', 'Juan not reporting') }) : null,
      ])),
    fila(icon('activity', 18), T('Campañas encendidas', 'Running campaigns'), campanas,
      el('button', {
        class: 'btn btn-sm', type: 'button', text: T('Ver pauta', 'See ads'),
        onclick: () => ctx.router.navigate('pauta', {}),
      })),
    sumaActivas > diario
      ? el('div', { class: 'adm-aviso' }, [icon('warning', 16), el('span', { text: T(
        `Las campañas encendidas suman ${mxn(sumaActivas)} al día: más que tu presupuesto de ${mxn(diario)}.`,
        `Running campaigns add up to ${mxn(sumaActivas)} a day: more than your ${mxn(diario)} budget.`,
      ) })])
      : null,
    pauta && pauta.error
      ? el('p', { class: 'adm-nota', text: T('Meta no respondió; el gasto sale del registro de cada noche.', "Meta didn't answer; spend comes from the nightly log.") })
      : null,
  ]);
}

// ── Leads ───────────────────────────────────────────────────────────────────
function seccionLeads(d) {
  const leads = d.leads || [];
  const cuenta = (f) => leads.filter((l) => (f === 'sin' ? !l.fuente : l.fuente === f)).length;
  const filtros = [
    ['todos', T('Todos', 'All'), leads.filter((l) => l.fuente !== 'no_lead').length],
    ['pauta', T('Pauta', 'Ads'), cuenta('pauta')],
    ['seo', 'SEO', cuenta('seo')],
    ['redes', T('Redes', 'Social'), cuenta('redes')],
    ['sin', T('Sin fuente', 'No source'), cuenta('sin')],
    ['otros', T('Otras', 'Others'), leads.filter((l) => ['recomendacion', 'hotel', 'otro'].includes(l.fuente)).length],
    ['no_lead', T('No son lead', 'Not leads'), cuenta('no_lead')],
  ].filter(([k, , n]) => k === 'todos' || n > 0);
  if (!filtros.some(([k]) => k === filtroLeads)) filtroLeads = 'todos';

  const visibles = leads.filter((l) => {
    if (filtroLeads === 'todos') return l.fuente !== 'no_lead';
    if (filtroLeads === 'sin') return !l.fuente;
    if (filtroLeads === 'otros') return ['recomendacion', 'hotel', 'otro'].includes(l.fuente);
    return l.fuente === filtroLeads;
  });
  const LIMITE = 12;
  const mostrar = verTodosLeads ? visibles : visibles.slice(0, LIMITE);

  const lista = el('ul', { class: 'adm-lista' }, mostrar.map((l) => el('li', { class: 'adm-fila' }, [
    el('span', { class: `adm-fila__ico adm-net--${l.canal}` }, [icoCanal(l.canal)]),
    el('div', { class: 'adm-fila__main' }, [
      el('div', { class: 'adm-fila__top' }, [
        el('span', { class: 'adm-fila__n', text: l.nombre || '—' }),
        el('span', { class: 'adm-fila__f', text: diaCorto(l.fecha) }),
      ]),
      el('div', { class: 'adm-fila__sub', text: l.anuncio ? `${T('Anuncio', 'Ad')}: ${l.anuncio}` : (l.texto || CANAL_TXT[l.canal] || '') }),
    ]),
    chipFuente(l.fuente, l.auto, () => elegirFuenteLead(l)),
  ])));

  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T(`Leads del mes · ${d.kpis.leads.total}`, `Leads this month · ${d.kpis.leads.total}`) }),
      el('button', { class: 'btn btn-sm', type: 'button', onclick: nuevoLead }, [icon('plus', 16), el('span', { text: T('Lead por fuera', 'Outside lead') })]),
    ]),
    el('p', { class: 'adm-nota', text: T(
      'Salen solos de la Bandeja (WhatsApp de Juan, Instagram, Facebook y correo). Los del WhatsApp 990 o de llamadas se anotan con "Lead por fuera".',
      'They come from the Inbox on their own (Juan\'s WhatsApp, Instagram, Facebook and email). Leads from the 990 WhatsApp or calls go in with "Outside lead".',
    ) }),
    el('div', { class: 'adm-filtros', role: 'tablist' }, filtros.map(([k, txt, n]) => el('button', {
      class: 'adm-filtro' + (k === filtroLeads ? ' is-active' : ''), type: 'button', role: 'tab',
      'aria-selected': k === filtroLeads ? 'true' : 'false',
      onclick: () => { filtroLeads = k; verTodosLeads = false; pintar(); },
    }, [el('span', { text: txt }), el('span', { class: 'adm-filtro__n', text: String(n) })]))),
    mostrar.length ? lista : el('p', { class: 'adm-vacio', text: T('Nada aquí este mes.', 'Nothing here this month.') }),
    visibles.length > LIMITE && !verTodosLeads
      ? el('div', { class: 'adm-mas' }, [el('button', {
        class: 'btn', type: 'button', text: T(`Ver los ${visibles.length}`, `Show all ${visibles.length}`),
        onclick: () => { verTodosLeads = true; pintar(); },
      })])
      : null,
  ]);
}

function chipFuente(fuente, auto, onclick) {
  const tono = !fuente ? 'falta' : fuente === 'no_lead' ? 'off' : fuente;
  // Borde punteado = la deduje yo; borde lleno = la puso Vianey.
  return el('button', {
    class: `adm-fuente adm-fuente--${tono}` + (auto && fuente ? ' adm-fuente--auto' : ''), type: 'button', onclick,
    title: auto && fuente ? T('Deducida sola. Toca para corregir.', 'Guessed. Tap to fix.') : T('Toca para cambiar', 'Tap to change'),
  }, [el('span', { text: nombreFuente(fuente) })]);
}

async function elegirFuenteLead(l) {
  const opciones = [
    ...FUENTES.map(([k, txt]) => ({ value: k, label: txt(), sub: FUENTE_SUB[k](), current: l.fuente === k })),
    { value: 'no_lead', label: T('No es lead', 'Not a lead'), sub: T('Proveedor, hotel, prueba o spam', 'Supplier, hotel, test or spam'), current: l.fuente === 'no_lead' },
  ];
  if (l.manual) opciones.push({ value: '__borrar', label: T('Borrar este lead', 'Delete this lead'), sub: T('Lo anotaste a mano', 'You added it by hand') });
  else if (!l.auto) opciones.push({ value: '__auto', label: T('Que lo deduzca solo', 'Let it guess'), sub: T('Quita tu corrección', 'Removes your correction') });
  const v = await ctx.sheet.pickFrom({ title: l.nombre || T('¿De dónde llegó?', 'Where did it come from?'), options: opciones });
  if (!v) return;
  try {
    if (v === '__borrar' || v === '__auto') await api.del(`/negocio/leads/${encodeURIComponent(l.id)}`);
    else if (l.manual) {
      await api.del(`/negocio/leads/${encodeURIComponent(l.id)}`);
      await api.post('/negocio/leads', { nombre: l.nombre, canal: l.canal, fuente: v, fecha: l.fecha, notas: l.texto });
    } else await api.post('/negocio/leads', { conv_id: l.conv_id, fuente: v });
    await recargar();
  } catch (e) { toast(e.message || T('No se pudo guardar.', 'Could not save.'), 'error'); }
}

// append() pinta la palabra "null" si le llega un null (el() sí los ignora): todo
// lo que se mete a una hoja pasa por aquí.
function poner(host, ...hijos) { host.append(...hijos.filter(Boolean)); }

function campo(etiqueta, control) {
  return el('label', { class: 'field adm-campo' }, [el('span', { class: 'label', text: etiqueta }), control]);
}
function selectFuente(actual, conVacio) {
  const s = el('select', { class: 'select' });
  if (conVacio) s.appendChild(el('option', { value: '', text: T('Todavía no sé', "Don't know yet") }));
  for (const [k, txt] of FUENTES) s.appendChild(el('option', { value: k, text: txt(), selected: actual === k }));
  return s;
}

function nuevoLead() {
  ctx.sheet.openSheet({
    title: T('Lead que llegó por fuera', 'Lead from outside the Inbox'), mode: 'form',
    build(body, close) {
      const nombre = el('input', { class: 'input', placeholder: T('Nombre', 'Name'), maxlength: '120', autocomplete: 'off' });
      const canal = el('select', { class: 'select' }, [
        ['whatsapp_990', 'WhatsApp 990'], ['llamada', T('Llamada', 'Call')], ['instagram', 'Instagram'],
        ['persona', T('En persona', 'In person')], ['otro', T('Otro', 'Other')],
      ].map(([k, t]) => el('option', { value: k, text: t })));
      const fuente = selectFuente('seo', false);
      const fecha = el('input', { class: 'input', type: 'date', value: hoyCancun() });
      const notas = el('input', { class: 'input', placeholder: T('Nota (opcional)', 'Note (optional)'), maxlength: '300' });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        if (!nombre.value.trim()) { nombre.focus(); return; }
        ok.disabled = true;
        try {
          await api.post('/negocio/leads', { nombre: nombre.value, canal: canal.value, fuente: fuente.value, fecha: fecha.value, notas: notas.value });
          close({ force: true });
          await recargar();
        } catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body, 
        campo(T('Nombre', 'Name'), nombre),
        el('div', { class: 'adm-dos' }, [campo(T('Por dónde escribió', 'Channel'), canal), campo(T('Día', 'Day'), fecha)]),
        campo(T('¿De dónde nos conoció?', 'How did they find us?'), fuente),
        campo(T('Nota', 'Note'), notas),
        el('div', { class: 'adm-btns' }, [
          el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }),
          ok,
        ]),
      );
      setTimeout(() => { try { nombre.focus(); } catch { /* noop */ } }, 80);
    },
  });
}

// ── Ingresos del mes: su control de meses ───────────────────────────────────
// Como en su Excel: lo que pagó cada persona (sesión, upgrade, propina) y lo
// que pagó cada empresa de marketing, con la forma de pago. Las reservas de
// Juan entran como sesión sin monto hasta que ella anota lo que cobró.
const TIPO_TXT = {
  sesion: () => T('Sesión', 'Session'),
  upgrade: () => T('Upgrade', 'Upgrade'),
  propina: () => T('Propina', 'Tip'),
  marca: () => T('Marca', 'Brand'),
  otro: () => T('Otro', 'Other'),
};
const PAGO_TXT = { stripe: () => 'Stripe', bbva: () => 'BBVA', efectivo: () => T('Efectivo', 'Cash'), otro: () => T('Otro', 'Other') };
const pagoTxt = (k) => (PAGO_TXT[k] ? PAGO_TXT[k]() : '');

function filaIngreso(v) {
  const esMarca = v.tipo === 'marca';
  const sub = [
    !esMarca && v.tipo !== 'sesion' ? TIPO_TXT[v.tipo]() : null,
    !esMarca && v.paquete ? v.paquete : null,
    v.forma_pago ? pagoTxt(v.forma_pago) : null,
    !esMarca && v.fecha_sesion ? `${T('sesión', 'session')} ${diaCorto(v.fecha_sesion)}` : null,
    v.origen === 'juan' ? T('reserva de Juan', "Juan's booking") : null,
  ].filter(Boolean).join(' · ');
  const monto = v.mxn > 0
    ? el('span', { class: 'adm-fila__p', text: mxn(v.mxn) })
    : el('span', { class: 'adm-fila__p adm-fila__p--falta', text: v.precio > 0 ? `${usd(v.precio)} · ${T('falta cobrar', 'to be paid')}` : T('Falta monto', 'Missing amount') });
  return el('li', {}, [el('button', { class: 'adm-fila adm-fila--btn', type: 'button', onclick: () => editarVenta(v) }, [
    el('span', { class: 'adm-fila__ico' + (esMarca ? ' adm-fila__ico--marca' : '') }, [icon(esMarca ? 'briefcase' : (v.origen === 'juan' ? 'calendar' : 'user'), 18)]),
    el('div', { class: 'adm-fila__main' }, [
      el('div', { class: 'adm-fila__top' }, [el('span', { class: 'adm-fila__n', text: v.cliente || v.empresa || '—' }), monto]),
      sub ? el('div', { class: 'adm-fila__sub', text: sub }) : null,
    ]),
    // La fuente se pregunta en lo nuevo; al historial del Excel no se le reclama (se pone al tocar la fila).
    !esMarca && (v.fuente || v.origen !== 'excel') ? el('span', { class: `adm-fuente adm-fuente--${v.fuente || 'falta'} adm-fuente--fija`, text: nombreFuente(v.fuente) }) : null,
  ])]);
}

function seccionVentas(d) {
  const ventas = d.ventas || [];
  const sesiones = ventas.filter((v) => v.tipo !== 'marca');
  const marcas = ventas.filter((v) => v.tipo === 'marca');
  const k = d.kpis;
  const grupo = (titulo, lista, total) => (lista.length ? [
    el('div', { class: 'adm-grupo' }, [el('span', { text: titulo }), el('span', { class: 'adm-grupo__t', text: total })]),
    el('ul', { class: 'adm-lista' }, lista.map(filaIngreso)),
  ] : []);
  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T(`Ingresos del mes · ${mxn(k.ingresos_mxn)}`, `Income this month · ${mxn(k.ingresos_mxn)}`) }),
      el('button', { class: 'btn btn-sm', type: 'button', onclick: () => editarVenta(null) }, [icon('plus', 16), el('span', { text: T('Ingreso', 'Income') })]),
    ]),
    el('p', { class: 'adm-nota', text: T(
      'Lo que te pagó cada cliente y cada marca, como en tu control de meses. Las reservas de Juan entran solas: cuando cobres, tócala y anota el monto.',
      "What each client and brand paid you, like your monthly control. Juan's bookings come in on their own: when you get paid, tap it and enter the amount.",
    ) }),
    ...grupo(sesiones.length > k.sesiones_n
      ? T(`Sesiones y extras · ${sesiones.length}`, `Sessions and extras · ${sesiones.length}`)
      : T(`Sesiones · ${sesiones.length}`, `Sessions · ${sesiones.length}`), sesiones, mxn(k.ingresos_sesiones_mxn + (k.ingresos_otros_mxn || 0))),
    ...grupo(T(`Marcas · ${marcas.length}`, `Brands · ${marcas.length}`), marcas, mxn(k.ingresos_marcas_mxn)),
    !ventas.length ? el('p', { class: 'adm-vacio', text: T('Todavía no hay ingresos este mes.', 'No income this month yet.') }) : null,
    d.ocultas ? el('p', { class: 'adm-nota', text: T(
      `${d.ocultas} no ${d.ocultas === 1 ? 'cuenta' : 'cuentan'} (canceladas, pruebas o marcadas "no cuenta").`,
      `${d.ocultas} not counted (cancelled, tests or marked "doesn't count").`,
    ) }) : null,
  ]);
}

function editarVenta(v) {
  const nueva = !v;
  const cfg = (data && data.cfg) || {};
  const paquetes = cfg.paquetes || [];
  const empresas = cfg.empresas || [];
  ctx.sheet.openSheet({
    title: nueva ? T('Nuevo ingreso', 'New income') : (v.cliente || v.empresa || T('Ingreso', 'Income')), mode: 'form',
    build(body, close) {
      const bor = {
        tipo: (v && v.tipo) || 'sesion',
        cliente: (v && v.tipo !== 'marca' && v.cliente) || '',
        empresa: (v && (v.empresa || (v.tipo === 'marca' ? v.cliente : ''))) || '',
        monto: v && v.monto_mxn != null ? String(v.monto_mxn) : '',
        pago: (v && v.forma_pago) || '',
        paquete: (v && v.paquete) || '',
        precio: v && v.precio != null ? String(v.precio) : '',
        fuente: (v && v.fuente) || '',
        fecha: (v && v.fecha) || hoyCancun(),
        fechaSesion: (v && v.fecha_sesion) || '',
      };
      const campos = el('div');
      const tipoSel = el('select', { class: 'select' }, Object.keys(TIPO_TXT).map((t) => el('option', { value: t, text: TIPO_TXT[t](), selected: bor.tipo === t })));
      tipoSel.addEventListener('change', () => { bor.tipo = tipoSel.value; pintarCampos(); });

      function pintarCampos() {
        clear(campos);
        const esMarca = bor.tipo === 'marca';
        const quien = esMarca
          ? el('select', { class: 'select' }, [
            el('option', { value: '', text: T('Elige la empresa', 'Pick the company') }),
            ...empresas.map((e) => el('option', { value: e, text: e, selected: bor.empresa === e })),
            bor.empresa && !empresas.includes(bor.empresa) ? el('option', { value: bor.empresa, text: bor.empresa, selected: true }) : null,
          ])
          : el('input', { class: 'input', value: bor.cliente, placeholder: T('Nombre del cliente', 'Client name'), maxlength: '120', autocomplete: 'off' });
        quien.addEventListener('input', () => { if (esMarca) bor.empresa = quien.value; else bor.cliente = quien.value; });
        quien.addEventListener('change', () => { if (esMarca) bor.empresa = quien.value; else bor.cliente = quien.value; });
        const monto = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '0.01', value: bor.monto, placeholder: '0' });
        monto.addEventListener('input', () => { bor.monto = monto.value; });
        const pago = el('select', { class: 'select' }, [
          el('option', { value: '', text: T('¿Cómo pagó?', 'How did they pay?') }),
          ...Object.keys(PAGO_TXT).map((p) => el('option', { value: p, text: pagoTxt(p), selected: bor.pago === p })),
        ]);
        pago.addEventListener('change', () => { bor.pago = pago.value; });
        const fecha = el('input', { class: 'input', type: 'date', value: bor.fecha });
        fecha.addEventListener('change', () => { bor.fecha = fecha.value; });
        poner(campos,
          campo(esMarca ? T('Empresa', 'Company') : T('Cliente', 'Client'), quien),
          el('div', { class: 'adm-dos' }, [
            campo(T('Monto cobrado (pesos)', 'Amount received (pesos)'), el('div', { class: 'adm-prefijo' }, [el('span', { text: '$' }), monto])),
            campo(T('Forma de pago', 'Payment method'), pago),
          ]),
        );
        if (bor.tipo === 'sesion') {
          const enCatalogo = bor.paquete && paquetes.some((p) => p.nombre === bor.paquete);
          const paquete = el('select', { class: 'select' }, [
            el('option', { value: '', text: T('Sin paquete', 'No package') }),
            ...paquetes.map((p) => el('option', { value: p.nombre, text: `${p.nombre} · ${usd(p.precio)}`, selected: bor.paquete === p.nombre })),
            bor.paquete && !enCatalogo ? el('option', { value: bor.paquete, text: bor.paquete, selected: true }) : null,
          ]);
          const precio = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: bor.precio, placeholder: 'USD' });
          paquete.addEventListener('change', () => { bor.paquete = paquete.value; const p = paquetes.find((x) => x.nombre === paquete.value); if (p) { bor.precio = String(p.precio); precio.value = bor.precio; } });
          precio.addEventListener('input', () => { bor.precio = precio.value; });
          const fuente = selectFuente(bor.fuente, true);
          fuente.addEventListener('change', () => { bor.fuente = fuente.value; });
          const fechaSesion = el('input', { class: 'input', type: 'date', value: bor.fechaSesion });
          fechaSesion.addEventListener('change', () => { bor.fechaSesion = fechaSesion.value; });
          poner(campos,
            el('div', { class: 'adm-dos' }, [campo(T('Paquete', 'Package'), paquete), campo(T('Precio (USD)', 'Price (USD)'), precio)]),
            campo(T('¿De dónde llegó?', 'Where did they come from?'), fuente),
            el('div', { class: 'adm-dos' }, [campo(T('Día que cobraste', 'Day you got paid'), fecha), campo(T('Día de la sesión', 'Session day'), fechaSesion)]),
          );
        } else {
          poner(campos, campo(T('Día que cobraste', 'Day you got paid'), fecha));
        }
      }
      pintarCampos();

      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        const esMarca = bor.tipo === 'marca';
        if (esMarca && !bor.empresa) { toast(T('Elige la empresa.', 'Pick the company.'), 'error'); return; }
        if (!esMarca && !bor.cliente.trim()) { toast(T('Escribe el nombre.', 'Type the name.'), 'error'); return; }
        const cuerpo = {
          tipo: bor.tipo,
          cliente: esMarca ? bor.empresa : bor.cliente,
          empresa: esMarca ? bor.empresa : null,
          monto_mxn: bor.monto === '' ? null : Number(bor.monto),
          forma_pago: bor.pago || null,
          fecha: bor.fecha,
          paquete: bor.tipo === 'sesion' ? (bor.paquete || null) : null,
          precio: bor.tipo === 'sesion' && bor.precio !== '' ? Number(bor.precio) : null,
          fuente: bor.tipo === 'sesion' ? (bor.fuente || null) : null,
          fecha_sesion: bor.tipo === 'sesion' ? (bor.fechaSesion || null) : null,
        };
        ok.disabled = true;
        try {
          if (nueva) await api.post('/negocio/ventas', cuerpo);
          else await api.patch(`/negocio/ventas/${encodeURIComponent(v.id)}`, cuerpo);
          close({ force: true });
          await recargar();
        } catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });

      const quitar = nueva ? null : el('button', {
        class: 'btn btn-ghost adm-quitar', type: 'button',
        text: v.origen === 'juan' ? T('No cuenta', "Doesn't count") : T('Borrar', 'Delete'),
        onclick: async () => {
          quitar.disabled = true;
          try { await api.del(`/negocio/ventas/${encodeURIComponent(v.id)}`); close({ force: true }); await recargar(); }
          catch (e) { toast(e.message, 'error'); quitar.disabled = false; }
        },
      });

      poner(body,
        campo(T('Tipo', 'Type'), tipoSel),
        campos,
        v && v.notas ? el('p', { class: 'adm-nota', text: v.notas }) : null,
        el('div', { class: 'adm-btns' }, [quitar, el('span', { class: 'adm-btns__sep' }), el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }), ok]),
      );
    },
  });
}

// ── Lo que queda del mes: gastos fijos, ofrenda y SAT ───────────────────────
function seccionGastos(d) {
  const { cfg } = d;
  const gastos = cfg.gastos || [];
  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T(`Tus gastos fijos · ${mxn(d.kpis.gastos_mxn)} al mes`, `Your fixed expenses · ${mxn(d.kpis.gastos_mxn)} a month`) }),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Editar', 'Edit'), onclick: editarGastos }),
    ]),
    el('ul', { class: 'adm-gastos' }, gastos.map((g) => el('li', {}, [el('span', { text: g.nombre }), el('span', { class: 'adm-gastos__m', text: mxn(g.monto) })]))),
    !gastos.length ? el('p', { class: 'adm-vacio', text: T('Sin gastos fijos anotados.', 'No fixed expenses yet.') }) : null,
    el('p', { class: 'adm-nota', text: T(
      `La ofrenda es el ${num(cfg.ofrenda_pct)}% de lo que entra y el SAT un estimado del ${num(cfg.sat_pct)}% (RESICO; el número real lo da tu contador).`,
      `Tithe is ${num(cfg.ofrenda_pct)}% of income and taxes an estimated ${num(cfg.sat_pct)}% (your accountant has the real number).`,
    ) }),
  ]);
}

function editarGastos() {
  const cfg = data.cfg;
  const gastos = (cfg.gastos || []).map((g) => ({ ...g }));
  ctx.sheet.openSheet({
    title: T('Gastos fijos del mes', 'Monthly fixed expenses'), mode: 'form',
    build(body, close) {
      const lista = el('div');
      const pintar = () => {
        clear(lista);
        for (const g of gastos) {
          const nombre = el('input', { class: 'input', value: g.nombre, placeholder: T('Gasto', 'Expense'), maxlength: '60' });
          nombre.addEventListener('input', () => { g.nombre = nombre.value; });
          const monto = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: String(g.monto), placeholder: '0' });
          monto.addEventListener('input', () => { g.monto = Number(monto.value); });
          lista.appendChild(el('div', { class: 'adm-gasto-edit' }, [
            nombre,
            el('div', { class: 'adm-prefijo' }, [el('span', { text: '$' }), monto]),
            el('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': T('Quitar', 'Remove'), onclick: () => { gastos.splice(gastos.indexOf(g), 1); pintar(); } }, [icon('close', 16)]),
          ]));
        }
      };
      pintar();
      const ofrenda = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', max: '50', step: '0.5', value: String(cfg.ofrenda_pct) });
      const sat = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', max: '35', step: '0.25', value: String(cfg.sat_pct) });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        ok.disabled = true;
        try {
          await api.post('/negocio/ajustes', { gastos: gastos.filter((g) => g.nombre && g.nombre.trim()), ofrenda_pct: Number(ofrenda.value), sat_pct: Number(sat.value) });
          close({ force: true });
          await recargar();
        } catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body,
        lista,
        el('button', { class: 'btn btn-sm', type: 'button', onclick: () => { gastos.push({ nombre: '', monto: 0 }); pintar(); setTimeout(() => { const ins = lista.querySelectorAll('input'); const ultimo = ins[ins.length - 2]; if (ultimo) ultimo.focus(); }, 50); } }, [icon('plus', 15), el('span', { text: T('Agregar gasto', 'Add expense') })]),
        el('div', { class: 'adm-dos adm-pct' }, [
          campo(T('Ofrenda (% de lo que entra)', 'Tithe (% of income)'), ofrenda),
          campo(T('SAT estimado (%)', 'Taxes, estimate (%)'), sat),
        ]),
        el('div', { class: 'adm-btns' }, [
          el('span', { class: 'adm-btns__sep' }),
          el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }),
          ok,
        ]),
      );
    },
  });
}

// ── Paquetes vigentes y tipo de cambio ──────────────────────────────────────
function seccionPaquetes(d) {
  const { cfg } = d;
  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T('Paquetes vigentes', 'Current packages') }),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Editar precios', 'Edit prices'), onclick: editarPaquetes }),
    ]),
    el('ul', { class: 'adm-paquetes' }, cfg.paquetes.map((p) => el('li', {}, [
      el('div', {}, [
        el('div', { class: 'adm-paq__n', text: p.nombre }),
        el('div', { class: 'adm-paq__s', text: [p.minutos ? `${p.minutos} min` : null, p.fotos ? (/^\d+$/.test(String(p.fotos)) ? `${p.fotos} ${T('fotos', 'photos')}` : p.fotos) : null].filter(Boolean).join(' · ') }),
      ]),
      el('div', { class: 'adm-paq__p', text: usd(p.precio) }),
    ]))),
    el('div', { class: 'adm-tc' }, [
      el('span', { text: `1 USD = ${Number(cfg.tipo_cambio).toLocaleString(LOC, { maximumFractionDigits: 2 })} MXN` }),
      el('span', { class: 'adm-dim', text: cfg.tc_manual ? T(' · lo pusiste tú', ' · set by you') : (cfg.tc_en ? T(' · de hoy', ' · today') : '') }),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Cambiar', 'Change'), onclick: cambiarTipoCambio }),
    ]),
  ]);
}

function pedirNumero({ titulo, etiqueta, valor, ayuda, prefijo, extra }) {
  return new Promise((resolve) => {
    let listo = false;
    const fin = (v) => { if (!listo) { listo = true; resolve(v); } };
    ctx.sheet.openSheet({
      title: titulo, mode: 'form', onClose: () => fin(null),
      build(body, close) {
        const inp = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: valor != null ? String(valor) : '' });
        const ok = () => { const n = Number(inp.value); if (!(n > 0)) { inp.focus(); return; } fin(n); close({ force: true }); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        poner(body, 
          campo(etiqueta, prefijo ? el('div', { class: 'adm-prefijo' }, [el('span', { text: prefijo }), inp]) : inp),
          ayuda ? el('p', { class: 'adm-nota', text: ayuda }) : null,
          el('div', { class: 'adm-btns' }, [
            extra ? extra(() => { fin('__extra'); close({ force: true }); }) : null,
            el('span', { class: 'adm-btns__sep' }),
            el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }),
            el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: ok }),
          ]),
        );
        setTimeout(() => { try { inp.focus(); inp.select(); } catch { /* noop */ } }, 80);
      },
    });
  });
}

async function cambiarPresupuesto() {
  const n = await pedirNumero({
    titulo: T('Presupuesto de pauta', 'Ad budget'),
    etiqueta: T('Pesos al día', 'Pesos a day'),
    valor: data.cfg.presupuesto_diario, prefijo: '$',
    ayuda: T(
      'Es el techo: la pauta automática nunca deja campañas encendidas que sumen más que esto. No enciende ni gasta nada por sí solo.',
      'It is the ceiling: automatic ads never keep campaigns running that add up to more. It does not turn on or spend anything by itself.',
    ),
  });
  if (n == null) return;
  try {
    await api.post('/negocio/ajustes', { presupuesto_diario: Math.round(n) });
    toast(T(`Presupuesto: ${mxn(Math.round(n))} al día.`, `Budget: ${mxn(Math.round(n))} a day.`), 'success');
    await recargar();
  } catch (e) { toast(e.message, 'error'); }
}

async function cambiarTipoCambio() {
  const n = await pedirNumero({
    titulo: T('Tipo de cambio', 'Exchange rate'),
    etiqueta: T('Pesos por dólar', 'Pesos per dollar'),
    valor: data.cfg.tipo_cambio,
    ayuda: T('Se actualiza solo cada día. Si lo cambias, se queda el tuyo.', 'It updates daily. If you change it, yours stays.'),
    extra: data.cfg.tc_manual ? (salir) => el('button', { class: 'btn btn-ghost', type: 'button', text: T('Que se actualice solo', 'Update automatically'), onclick: salir }) : null,
  });
  if (n == null) return;
  try {
    await api.post('/negocio/ajustes', n === '__extra' ? { tc_auto: true } : { tipo_cambio: n });
    await recargar();
  } catch (e) { toast(e.message, 'error'); }
}

function editarPaquetes() {
  const paquetes = data.cfg.paquetes.map((p) => ({ ...p }));
  ctx.sheet.openSheet({
    title: T('Precios de los paquetes', 'Package prices'), mode: 'form',
    build(body, close) {
      const filas = paquetes.map((p) => {
        const inp = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '1', step: '1', value: String(p.precio) });
        inp.addEventListener('input', () => { p.precio = Number(inp.value); });
        return el('div', { class: 'adm-paq-edit' }, [
          el('span', { class: 'adm-paq__n', text: p.nombre }),
          el('div', { class: 'adm-prefijo' }, [el('span', { text: 'US$' }), inp]),
        ]);
      });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        if (paquetes.some((p) => !(p.precio > 0))) { toast(T('Cada paquete necesita su precio.', 'Each package needs a price.'), 'error'); return; }
        ok.disabled = true;
        try { await api.post('/negocio/ajustes', { paquetes }); close({ force: true }); await recargar(); }
        catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body, 
        el('p', { class: 'adm-nota', text: T(
          'Solo cambia los números del panel (ticket promedio y precio de cada sesión). El sitio, Juan y Google no se tocan desde aquí.',
          'Only changes the numbers on this panel. The website, Juan and Google are not changed from here.',
        ) }),
        ...filas,
        el('div', { class: 'adm-btns' }, [
          el('span', { class: 'adm-btns__sep' }),
          el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }),
          ok,
        ]),
      );
    },
  });
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/administracion.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/administracion.css?v=202611060116';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'adm-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() { rootEl = null; ctx = null; data = null; },
};
