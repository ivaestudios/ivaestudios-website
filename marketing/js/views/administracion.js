// ============================================================================
// IVAE Marketing — Vista "Administración" (solo admin, solo IVAE STUDIOS).
//
// Pedido de Vianey (5-nov-2026): "un sistema de administración… checar las
// pautas… 100 pesos al día… todo al número de Juan… cuántos leads tenemos en
// pauta y cuántos en SEO… el costo por sesión ya cerrada, el costo de pauta y
// el ticket promedio… volvemos a los paquetes anteriores".
//
// Diseño (6-nov-2026): "quiero algo profesional, sencillo, claro, que se vea
// como aplicación de finanzas… parece 100% IA". Como la app de un banco: un
// saldo grande, acciones rápidas, movimientos con el monto a la derecha, cada
// cifra con su etiqueta arriba y una sola línea de texto por cosa; nada de
// párrafos explicando. Lo que se elige en las hojas va en botones, no en
// listas desplegables. Cinco pestañas; el mes de arriba manda en todas.
// Backend: functions/api/marketing/_negocio.js.
// ============================================================================
import { api, el, clear } from '../api.js?v=202611070449';
import { icon, iconMarca } from '../shell/icons.js?v=202611070449';
import { T, isEN } from '../shell/i18n.js?v=202611070449';
import { toast } from '../shell/toast.js?v=202611070449';

const VIEW_ID = 'administracion';
const IVAE_STUDIOS_ID = '6ae5dd2381faa430d9e6966470b29602';

let ctx = null;
let rootEl = null;
let mes = null;            // 'AAAA-MM'; null = el mes actual
let data = null;
let filtroLeads = 'todos';
let verTodosLeads = false;
let verTablaMeses = false;

const LOC = isEN ? 'en-US' : 'es-MX';
const MESES_L = isEN
  ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  : ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = isEN
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const FUENTES = [
  ['pauta', () => T('Anuncios', 'Ads')],
  ['seo', () => T('Google', 'Google')],
  ['redes', () => T('Redes', 'Social')],
  ['recomendacion', () => T('Recomendación', 'Referral')],
  ['hotel', () => T('Hotel o agencia', 'Hotel or agency')],
  ['otro', () => T('Otro', 'Other')],
];
// La fuente, dicha como la diría ella (en las hojas).
const FUENTE_FACIL = {
  pauta: () => T('Un anuncio', 'An ad'),
  seo: () => T('Google o la web', 'Google or the website'),
  redes: () => T('Instagram o Facebook', 'Instagram or Facebook'),
  recomendacion: () => T('Recomendación', 'Referral'),
  hotel: () => T('Hotel o agencia', 'Hotel or agency'),
  otro: () => T('Otro', 'Other'),
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
const TIPO_TXT = {
  sesion: () => T('Sesión', 'Session'),
  upgrade: () => T('Upgrade', 'Upgrade'),
  propina: () => T('Propina', 'Tip'),
  marca: () => T('Marca', 'Brand'),
  otro: () => T('Otro', 'Other'),
};
const PAGO_TXT = { stripe: () => 'Stripe', bbva: () => 'BBVA', efectivo: () => T('Efectivo', 'Cash'), otro: () => T('Otro', 'Other') };
const pagoTxt = (k) => (PAGO_TXT[k] ? PAGO_TXT[k]() : '');

// Flechas de entrada y salida, como en cualquier app de banco.
const FLECHA = {
  in: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7 7 17M16 17H7V8"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
};
const CORAZON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.1c2.1-.2 4 .9 6 3 2-2.1 3.9-3.2 6-3 3.7.4 5.6 4.3 4 7.6C19.5 16.4 12 21 12 21z"/></svg>';

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
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const partesMes = (m) => String(m).split('-').map(Number);
function nombreMes(m) { const [a, mm] = partesMes(m); return `${mayus(MESES_L[mm - 1])} ${a}`; }
function mesSolo(m) { const [, mm] = partesMes(m); return MESES_L[mm - 1]; }
function diaCorto(ymd) {
  if (!ymd) return '';
  const [, m, dd] = String(ymd).split('-').map(Number);
  return m ? (isEN ? `${MESES_C[m - 1]} ${dd}` : `${dd} ${MESES_C[m - 1]}`) : String(ymd);
}
function mesVecino(m, delta) {
  const [a, mm] = partesMes(m);
  return new Date(Date.UTC(a, mm - 1 + delta, 1)).toISOString().slice(0, 7);
}
const hoyCancun = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
// Encabezado de un día en la lista de movimientos: "Hoy", "Ayer", "3 de noviembre".
function diaTitulo(ymd) {
  if (!ymd) return T('Sin fecha', 'No date');
  const hoy = hoyCancun();
  const ayer = new Date(Date.parse(`${hoy}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  if (ymd === hoy) return T('Hoy', 'Today');
  if (ymd === ayer) return T('Ayer', 'Yesterday');
  const [, m, dd] = String(ymd).split('-').map(Number);
  return isEN ? `${MESES_L[m - 1]} ${dd}` : `${dd} de ${MESES_L[m - 1]}`;
}
function iniciales(nombre) {
  const p = String(nombre || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
const recorte = (s, n = 40) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
// Una cifra con su etiqueta abajo (anuncios, publicaciones, la decisión de pauta).
const dato = (v, k) => el('div', { class: 'adm-dato' }, [el('div', { class: 'adm-dato__v', text: v }), el('div', { class: 'adm-dato__k', text: k })]);

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
    rootEl.appendChild(vacio('key', T('Solo la dueña', 'Owner only'), T('Los números del negocio no se comparten.', 'Business numbers are not shared.')));
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

const PESTANAS = [
  ['resumen', () => T('Resumen', 'Overview')],
  ['dinero', () => T('Dinero', 'Money')],
  ['anuncios', () => T('Anuncios', 'Ads')],
  ['clientes', () => T('Clientes', 'Clients')],
  ['publicaciones', () => T('Posts', 'Posts')],
];
let pestana = (() => { try { return localStorage.getItem('adm_pestana') || 'resumen'; } catch { return 'resumen'; } })();
function irPestana(p) {
  if (p === 'bandeja') { ctx.router.navigate('bandeja', { cliente: IVAE_STUDIOS_ID, tab: 'embudo' }); return; }
  pestana = PESTANAS.some(([k]) => k === p) ? p : 'resumen';
  try { localStorage.setItem('adm_pestana', pestana); } catch { /* sin almacenamiento */ }
  pintar();
  try { rootEl.scrollIntoView({ block: 'start' }); } catch { /* noop */ }
}

// Cada sección con su lugar (área) en la computadora. En el teléfono van una
// debajo de otra en este orden; desde 1000px, administracion.css las acomoda
// en dos columnas por pestaña (Vianey, 6-nov-2026: "no está adaptado para
// compu, solo para cel").
const SECCIONES = {
  resumen: [[saldo, 'saldo'], [accionesRapidas, 'acciones'], [decisionPauta, 'decision'], [statsMes, 'stats'], [pendientes, 'pendientes'], [ultimosMovimientos, 'movs']],
  dinero: [[entradasMes, 'entradas'], [estadoDeCuenta, 'cuenta'], [movimientosMes, 'movs'], [gastosFijos, 'gastos'], [paquetes, 'paquetes']],
  anuncios: [[decisionPauta, 'decision'], [presupuestoAnuncios, 'presupuesto'], [resultadoAnuncios, 'resultado'], [costosMeses, 'meses'], [listaAnuncios, 'lista']],
  clientes: [[statsClientes, 'stats'], [googleVsAnuncios, 'canales'], [origenClientes, 'origen'], [seccionLeads, 'leads']],
  publicaciones: [[mejorPublicacion, 'mejor'], [gridPublicaciones, 'grid']],
};
function pintar() {
  if (!rootEl || !data) return;
  clear(rootEl);
  // Una sección que reviente no se lleva la pantalla entera.
  const poner1 = (host, fn, area) => {
    try {
      const n = fn(data);
      if (!n) return;
      if (area) n.classList.add('adm-a-' + area);
      host.appendChild(n);
    } catch (e) { console.error('[administracion]', e); }
  };
  poner1(rootEl, cabecera);
  poner1(rootEl, barraPestanas);
  const clave = SECCIONES[pestana] ? pestana : 'resumen';
  const cuerpo = el('div', { class: `adm-cuerpo adm-cuerpo--${clave}` });
  for (const [fn, area] of SECCIONES[clave]) poner1(cuerpo, fn, area);
  rootEl.appendChild(cuerpo);
}

// ── Piezas ──────────────────────────────────────────────────────────────────
function vacio(iconName, titulo, texto, boton) {
  return el('div', { class: 'adm-empty' }, [
    icon(iconName, 28),
    el('h2', { text: titulo }),
    texto ? el('p', { text: texto }) : null,
    boton || null,
  ]);
}
const nadaAqui = (texto) => el('p', { class: 'adm-nada', text: texto });

function tarjeta(titulo, accion, hijos, clase) {
  return el('section', { class: 'adm-card' + (clase ? ` ${clase}` : '') }, [
    titulo || accion ? el('div', { class: 'adm-card__cab' }, [
      titulo ? el('h2', { class: 'adm-card__t', text: titulo }) : el('span'),
      accion || null,
    ]) : null,
    ...hijos,
  ]);
}
const botonChico = (texto, onclick, ico) => el('button', { class: 'adm-btn-chico', type: 'button', onclick }, [ico ? icon(ico, 16) : null, el('span', { text: texto })]);
const enlace = (texto, onclick) => el('button', { class: 'adm-enlace', type: 'button', onclick, text: texto });

function stat(etiqueta, valor, sub, { tono, onclick } = {}) {
  return el(onclick ? 'button' : 'div', { class: 'adm-stat' + (tono ? ` adm-stat--${tono}` : ''), type: onclick ? 'button' : null, onclick: onclick || null }, [
    el('div', { class: 'adm-stat__k', text: etiqueta }),
    el('div', { class: 'adm-stat__v', text: valor }),
    sub ? el('div', { class: 'adm-stat__s', text: sub }) : null,
  ]);
}
function avatar(nombre, ico, clase) {
  return el('span', { class: 'adm-av' + (clase ? ` ${clase}` : ''), 'aria-hidden': 'true' }, [ico || el('span', { text: iniciales(nombre) })]);
}
function barra(fraccion, etiqueta) {
  const f = Math.max(0, Math.min(1, Number(fraccion) || 0));
  return el('div', { class: 'adm-barra', role: 'img', 'aria-label': etiqueta || `${Math.round(f * 100)}%` }, [
    el('div', { class: 'adm-barra__lleno', style: { width: `${f * 100}%` } }),
  ]);
}
const pill = (texto, tono) => el('span', { class: 'adm-pill' + (tono ? ` adm-pill--${tono}` : ''), text: texto });

function cabecera() {
  const hoyMes = hoyCancun().slice(0, 7);
  const ir = (delta) => { mes = mesVecino(mes, delta); verTodosLeads = false; render(); };
  return el('header', { class: 'adm-top' }, [
    el('h1', { class: 'adm-top__t', text: T('Administración', 'Administration') }),
    el('div', { class: 'adm-mes' }, [
      el('button', { class: 'adm-mes__b', type: 'button', 'aria-label': T('Mes anterior', 'Previous month'), onclick: () => ir(-1) }, [icon('left', 18)]),
      el('span', { class: 'adm-mes__t', text: nombreMes(mes) }),
      el('button', { class: 'adm-mes__b', type: 'button', 'aria-label': T('Mes siguiente', 'Next month'), disabled: mes >= hoyMes, onclick: () => ir(1) }, [icon('right', 18)]),
    ]),
  ]);
}

function barraPestanas() {
  return el('nav', { class: 'adm-tabs', role: 'tablist', 'aria-label': T('Secciones', 'Sections') }, PESTANAS.map(([k, txt]) => el('button', {
    class: 'adm-tab' + (k === pestana ? ' is-active' : ''), type: 'button', role: 'tab',
    'aria-selected': k === pestana ? 'true' : 'false', onclick: () => irPestana(k),
  }, [txt()])));
}

// Un movimiento: quién, qué y cuánto, como en el estado de cuenta.
function movimiento(v, conFecha) {
  const esMarca = v.tipo === 'marca';
  const nombre = v.cliente || v.empresa || '—';
  const que = esMarca ? T('Marca', 'Brand') : (v.tipo !== 'sesion' ? TIPO_TXT[v.tipo]() : (v.paquete || T('Sesión', 'Session')));
  const sub = [que, v.forma_pago ? pagoTxt(v.forma_pago) : null, v.origen === 'juan' ? T('Reserva de Juan', "Juan's booking") : null].filter(Boolean).join(' · ');
  return el('li', {}, [el('button', { class: 'adm-fila', type: 'button', onclick: () => editarVenta(v) }, [
    avatar(nombre, esMarca ? icon('briefcase', 18) : null, esMarca ? 'adm-av--marca' : ''),
    el('div', { class: 'adm-fila__main' }, [
      el('div', { class: 'adm-fila__n', text: nombre }),
      el('div', { class: 'adm-fila__s', text: sub }),
    ]),
    el('div', { class: 'adm-fila__der' }, [
      v.mxn > 0
        ? el('div', { class: 'adm-monto-fila is-pos', text: `+${mxn(v.mxn)}` })
        : el('div', { class: 'adm-monto-fila is-falta', text: T('Falta monto', 'No amount') }),
      conFecha ? el('div', { class: 'adm-fila__f', text: diaCorto(v.fecha) }) : null,
    ]),
  ])]);
}
const ordenarVentas = (ventas) => (ventas || []).slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || (b.mxn || 0) - (a.mxn || 0));

// ── Resumen ─────────────────────────────────────────────────────────────────
function saldo(d) {
  const k = d.kpis;
  const entro = Number(k.ingresos_mxn) || 0;
  const seVa = (Number(k.gastos_mxn) || 0) + (Number(k.ofrenda_mxn) || 0) + (Number(k.sat_mxn) || 0) + (Number(k.gasto) || 0);
  const queda = Number(k.queda_mxn) || 0;
  const cubre = seVa > 0 ? Math.min(1, entro / seVa) : 1;
  const flujo = (dir, etiqueta, valor) => el('div', { class: `adm-flujo adm-flujo--${dir}` }, [
    el('span', { class: 'adm-flujo__ico', html: FLECHA[dir] }),
    el('div', { class: 'adm-flujo__txt' }, [el('div', { class: 'adm-flujo__k', text: etiqueta }), el('div', { class: 'adm-flujo__v', text: mxn(valor) })]),
  ]);
  // A medio mes lo normal es que falte (los gastos fijos van completos): se dice "te falta", no "-$".
  return el('section', { class: 'adm-card adm-saldo' }, [
    el('div', { class: 'adm-saldo__k', text: queda >= 0 ? T('Te queda este mes', 'Left this month') : T('Te falta para cubrir el mes', 'Still needed this month') }),
    el('div', { class: 'adm-saldo__v', text: mxn(Math.abs(queda)) }),
    barra(cubre, T(`Cubres el ${Math.round(cubre * 100)}% del mes`, `${Math.round(cubre * 100)}% of the month covered`)),
    el('div', { class: 'adm-saldo__nota', text: queda >= 0 ? T('Ya cubriste los gastos del mes.', 'This month is covered.') : T(`Llevas el ${Math.round(cubre * 100)}% de lo que necesitas.`, `${Math.round(cubre * 100)}% of what you need.`) }),
    el('div', { class: 'adm-saldo__dos' }, [
      flujo('in', T('Entró', 'In'), entro),
      flujo('out', T('Gastos del mes', 'Expenses'), seVa),
    ]),
  ]);
}

function accionesRapidas() {
  const accion = (ico, texto, onclick, clase) => el('button', { class: 'adm-accion' + (clase ? ` ${clase}` : ''), type: 'button', onclick }, [
    el('span', { class: 'adm-accion__ico' }, [ico]),
    el('span', { class: 'adm-accion__t', text: texto }),
  ]);
  return el('div', { class: 'adm-acciones' }, [
    accion(icon('plus', 22), T('Ingreso', 'Income'), () => editarVenta(null), 'is-primaria'),
    accion(icon('user', 20), T('Lead', 'Lead'), nuevoLead),
    accion(icon('sliders', 20), T('Presupuesto', 'Budget'), cambiarPresupuesto),
    accion(icon('inbox', 20), T('Bandeja', 'Inbox'), () => irPestana('bandeja')),
  ]);
}

// Lo que cuesta la pauta, a la vista (Vianey: "¿dónde se ve el costo por lead,
// cuánto me cuesta cada cliente, cuánto me cuesta la pauta?"). Si el mes no
// tiene, la línea de abajo lo dice claro en vez de dejar solo "—".
function statsMes(d) {
  const k = d.kpis;
  const ticket = k.ticket_mxn != null ? k.ticket_mxn : k.ticket_hist_mxn;
  const gasto = Number(k.gasto) || 0;
  // Del mismo cálculo que el mes a mes y cada anuncio (se sigue a la persona
  // del anuncio hasta su pago): los números nunca se contradicen.
  const cm = (d.costos || []).find((x) => x.mes === d.periodo.mes) || {};
  return el('section', { class: 'adm-stats' }, [
    stat(T('Gastado en anuncios', 'Spent on ads'), mxn(gasto),
      d.periodo.es_actual ? T(`de ${mxn(k.presupuesto_mes)} del mes`, `of ${mxn(k.presupuesto_mes)} this month`) : T('En el mes', 'In the month')),
    stat(T('Costo por lead', 'Cost per lead'), cm.costo_lead != null ? mxn(cm.costo_lead) : '—',
      cm.costo_lead != null ? T(`${num(cm.leads)} te escribieron por anuncios`, `${num(cm.leads)} wrote from ads`)
        : (gasto > 0 ? T('Nadie escribió por un anuncio', 'Nobody wrote from an ad') : T('No hubo anuncios este mes', 'No ads this month'))),
    stat(T('Costo por cliente', 'Cost per client'), cm.costo_cliente != null ? mxn(cm.costo_cliente) : '—',
      cm.costo_cliente != null ? T(`${num(cm.clientes)} se volvieron clientes`, `${num(cm.clientes)} became clients`)
        : (gasto > 0 ? T('Nadie reservó por un anuncio', 'Nobody booked from an ad') : T('No hubo anuncios este mes', 'No ads this month'))),
    stat(T('Ticket promedio', 'Average ticket'), ticket != null ? mxn(ticket) : '—',
      k.ticket_mxn != null ? T(`${num(k.sesiones_con_monto)} ${k.sesiones_con_monto === 1 ? 'sesión' : 'sesiones'}`, `${num(k.sesiones_con_monto)} sessions`) : T('Últimos 12 meses', 'Last 12 months')),
  ]);
}

// ¿Te conviene invertir más en anuncios? Un sí o no claro, el porqué en una
// línea y los números de 6 meses (la regla vive en _negocio.js: decision).
const ICO_DECISION = { bien: 'check', cuidado: 'warning', alerta: 'warning', neutral: 'info' };
function decisionPauta(d) {
  const x = d.decision;
  if (!x) return null;
  return el('section', { class: `adm-card adm-decision is-${x.tono}` }, [
    el('div', { class: 'adm-decision__cab' }, [
      el('span', { class: 'adm-decision__ico', 'aria-hidden': 'true' }, [icon(ICO_DECISION[x.tono] || 'info', 20)]),
      el('div', { class: 'adm-decision__txt' }, [
        el('div', { class: 'adm-decision__q', text: T('¿Te conviene invertir más en anuncios?', 'Should you spend more on ads?') }),
        el('div', { class: 'adm-decision__v', text: x.veredicto }),
      ]),
    ]),
    el('p', { class: 'adm-decision__p', text: x.texto }),
    el('div', { class: 'adm-decision__nums' }, [
      dato(mxn(x.gasto), T('Invertido en 6 meses', 'Spent in 6 months')),
      dato(num(x.leads), T('Te escribieron', 'Wrote to you')),
      dato(num(x.clientes), T('Se volvieron clientes', 'Became clients')),
      dato(x.retorno != null ? `$${Number(x.retorno).toLocaleString(LOC, { maximumFractionDigits: 1 })}` : '—', T('Regresó por cada $1', 'Returned per $1')),
    ]),
  ]);
}

// Mes a mes: lo invertido y en qué se convirtió (Anuncios).
function costosMeses(d) {
  const filas = (d.costos || []).slice().reverse();
  if (!filas.length) return null;
  const cel = (v) => el('td', { text: v });
  return tarjeta(T('Lo que te cuestan los anuncios, mes a mes', 'What ads cost you, month by month'), null, [
    el('div', { class: 'adm-tabla-wrap' }, [el('table', { class: 'adm-tabla adm-tabla--costos' }, [
      el('thead', {}, [el('tr', {}, [T('Mes', 'Month'), T('Invertido', 'Spent'), T('Te escribieron', 'Wrote'), T('Clientes', 'Clients'), T('Por persona', 'Per lead'), T('Por cliente', 'Per client'), T('Te pagaron', 'Paid you')].map((h) => el('th', { text: h })))]),
      el('tbody', {}, filas.map((x) => el('tr', { class: x.mes === mes ? 'is-actual' : '' }, [
        cel(nombreMes(x.mes)), cel(mxn(x.gasto)), cel(num(x.leads)), cel(num(x.clientes)),
        cel(x.costo_lead != null ? mxn(x.costo_lead) : '—'), cel(x.costo_cliente != null ? mxn(x.costo_cliente) : '—'), cel(mxn(x.ingresos)),
      ]))),
    ])]),
    el('p', { class: 'adm-pie', text: T('Por persona: lo invertido entre quienes te escribieron por un anuncio. Por cliente: entre quienes reservaron.', 'Per lead: spend over people who wrote from an ad. Per client: over those who booked.') }),
  ]);
}

// Google contra anuncios: quién entró por cada lado, cuántos reservaron, cuánto
// pagaron y cuánto costó (Vianey: "¿cuáles entran por SEO, cuáles por pauta?").
function googleVsAnuncios(d) {
  const leads = d.leads || [];
  const ventas = (d.ventas || []).filter((v) => v.tipo !== 'marca');
  const col = (fuente, titulo, costo) => {
    const ls = leads.filter((l) => l.fuente === fuente);
    const cl = ventas.filter((v) => v.fuente === fuente && v.tipo === 'sesion');
    const pagado = ventas.filter((v) => v.fuente === fuente).reduce((s, v) => s + (v.mxn > 0 ? v.mxn : 0), 0);
    return el('div', { class: `adm-canal adm-canal--${fuente}` }, [
      el('div', { class: 'adm-canal__t', text: titulo }),
      el('div', { class: 'adm-canal__nums' }, [
        dato(num(ls.length), T('Te escribieron', 'Wrote to you')),
        dato(num(cl.length), T('Clientes', 'Clients')),
        dato(mxn(pagado), T('Te pagaron', 'Paid you')),
        dato(costo, T('Te costó', 'Cost')),
      ]),
      ls.length
        ? el('div', { class: 'adm-canal__quien' }, [
          ...ls.slice(0, 10).map((l) => el('span', { class: 'adm-pill', text: recorte(l.nombre, 24) })),
          ls.length > 10 ? el('span', { class: 'adm-pill', text: `+${ls.length - 10}` }) : null,
        ])
        : el('p', { class: 'adm-pie', text: T('Nadie este mes.', 'Nobody this month.') }),
    ]);
  };
  return tarjeta(T('Google contra anuncios', 'Google vs ads'), null, [
    el('div', { class: 'adm-canales' }, [
      col('seo', T('Google y tu sitio web (SEO)', 'Google and your website (SEO)'), T('Gratis', 'Free')),
      col('pauta', T('Anuncios (pauta)', 'Ads'), mxn(d.kpis.gasto)),
    ]),
  ]);
}

// El ícono dice de qué se trata (a dónde lleva); el color, si es bueno o alerta.
const IR_ICO = { anuncios: 'activity', bandeja: 'chat', dinero: 'edit', clientes: 'users', publicaciones: 'camera' };
function pendientes(d) {
  const recs = (d.recomendaciones || []).slice(0, 5);
  if (!recs.length) return null;
  return tarjeta(T('Pendientes', 'To do'), null, [el('ul', { class: 'adm-lista' }, recs.map((r) => el('li', {}, [
    el(r.ir ? 'button' : 'div', { class: 'adm-fila', type: r.ir ? 'button' : null, onclick: r.ir ? () => irPestana(r.ir) : null }, [
      el('span', { class: `adm-av adm-av--${r.tono}`, 'aria-hidden': 'true' }, [icon(r.tono === 'alerta' ? 'warning' : (IR_ICO[r.ir] || 'info'), 18)]),
      el('div', { class: 'adm-fila__main' }, [
        el('div', { class: 'adm-fila__n adm-fila__n--2', text: r.titulo }),
        el('div', { class: 'adm-fila__s adm-fila__s--2', text: r.texto }),
      ]),
      r.ir ? el('span', { class: 'adm-fila__chev' }, [icon('right', 18)]) : null,
    ]),
  ])))]);
}

function ultimosMovimientos(d) {
  const ventas = ordenarVentas(d.ventas);
  return tarjeta(T('Movimientos', 'Activity'), ventas.length > 5 ? enlace(T('Ver todo', 'See all'), () => irPestana('dinero')) : null, [
    ventas.length
      ? el('ul', { class: 'adm-lista' }, ventas.slice(0, 5).map((v) => movimiento(v, true)))
      : nadaAqui(T('Sin movimientos este mes.', 'No activity this month.')),
  ]);
}

// ── Dinero ──────────────────────────────────────────────────────────────────
function entradasMes(d) {
  const k = d.kpis;
  const ses = (Number(k.ingresos_sesiones_mxn) || 0) + (Number(k.ingresos_otros_mxn) || 0);
  return el('section', { class: 'adm-card' }, [
    el('div', { class: 'adm-big__k', text: T(`Entró en ${mesSolo(mes)}`, `Income in ${mesSolo(mes)}`) }),
    el('div', { class: 'adm-big__v', text: mxn(k.ingresos_mxn) }),
    el('div', { class: 'adm-big__s', text: `${T('Sesiones', 'Sessions')} ${mxn(ses)} · ${T('Marcas', 'Brands')} ${mxn(k.ingresos_marcas_mxn)}` }),
    ...graficaMeses(d),
  ]);
}

// Columnas apiladas de 12 meses: sesiones y marcas. Tocar una columna abre ese mes.
function graficaMeses(d) {
  const serie = d.serie || [];
  const totales = serie.map((m) => (m.sesiones_mxn || 0) + (m.marcas_mxn || 0) + (m.otros_mxn || 0));
  const max = Math.max(...totales, 0);
  const paso = max > 50000 ? 50000 : 10000;
  const tope = max > 0 ? Math.ceil(max / paso) * paso : paso;
  const corto = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n)));
  const etiqueta = (m) => MESES_C[Number(m.slice(5, 7)) - 1];
  const tip = el('div', { class: 'adm-tip', hidden: true });
  const mostrar = (m, x, host) => {
    clear(tip);
    tip.append(...[
      el('div', { class: 'adm-tip__t', text: nombreMes(m.mes) }),
      el('div', { class: 'adm-tip__r' }, [el('span', { class: 'adm-tip__k adm-tip__k--1' }), el('span', { text: T('Sesiones', 'Sessions') }), el('b', { text: mxn((m.sesiones_mxn || 0) + (m.otros_mxn || 0)) })]),
      el('div', { class: 'adm-tip__r' }, [el('span', { class: 'adm-tip__k adm-tip__k--2' }), el('span', { text: T('Marcas', 'Brands') }), el('b', { text: mxn(m.marcas_mxn) })]),
      m.pauta_mxn ? el('div', { class: 'adm-tip__r adm-tip__r--dim' }, [el('span', { class: 'adm-tip__k' }), el('span', { text: T('Anuncios', 'Ads') }), el('b', { text: mxn(m.pauta_mxn) })]) : null,
    ].filter(Boolean));
    tip.hidden = false;
    const r = host.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(x - r.left, 80), r.width - 80)}px`;
  };
  const plot = el('div', { class: 'adm-cols', onpointerleave: () => { tip.hidden = true; } }, [
    // Rejilla: 0, la mitad y el tope; la franja de abajo (22px) es la de los meses.
    ...[1, 0.5, 0].map((f) => el('div', { class: 'adm-cols__grid' + (f === 0 ? ' is-base' : ''), style: { bottom: `calc(22px + ${f} * (100% - 22px))` } }, [el('span', { text: corto(tope * f) })])),
    ...serie.map((m) => {
      const s = (m.sesiones_mxn || 0) + (m.otros_mxn || 0); const b = m.marcas_mxn || 0;
      return el('button', {
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
    }),
    tip,
  ]);
  const tabla = verTablaMeses ? el('table', { class: 'adm-tabla' }, [
    el('thead', {}, [el('tr', {}, [T('Mes', 'Month'), T('Sesiones', 'Sessions'), T('Marcas', 'Brands'), 'Total'].map((h) => el('th', { text: h })))]),
    el('tbody', {}, serie.slice().reverse().map((m, i) => el('tr', {}, [
      el('td', { text: nombreMes(m.mes) }), el('td', { text: mxn((m.sesiones_mxn || 0) + (m.otros_mxn || 0)) }), el('td', { text: mxn(m.marcas_mxn) }), el('td', { text: mxn(totales[serie.length - 1 - i]) }),
    ]))),
  ]) : null;
  return [
    plot,
    el('div', { class: 'adm-graf-pie' }, [
      el('ul', { class: 'adm-leyenda' }, [
        el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--1' }), T('Sesiones', 'Sessions')]),
        el('li', {}, [el('span', { class: 'adm-leyenda__sw adm-leyenda__sw--2' }), T('Marcas', 'Brands')]),
      ]),
      enlace(verTablaMeses ? T('Ocultar tabla', 'Hide table') : T('Ver tabla', 'View table'), () => { verTablaMeses = !verTablaMeses; pintar(); }),
    ]),
    tabla,
  ].filter(Boolean);
}

// El mes como estado de cuenta: lo que entró, lo que se va y lo que queda.
function estadoDeCuenta(d) {
  const k = d.kpis; const cfg = d.cfg;
  const queda = Number(k.queda_mxn) || 0;
  const linea = (etiqueta, valor, { sub, signo = '−', tono, onclick, total } = {}) => el(onclick ? 'button' : 'div', {
    class: 'adm-linea' + (total ? ' is-total' : '') + (onclick ? ' is-btn' : ''), type: onclick ? 'button' : null, onclick: onclick || null,
  }, [
    el('div', { class: 'adm-linea__k' }, [el('span', { text: etiqueta }), sub ? el('span', { class: 'adm-linea__s', text: sub }) : null]),
    el('div', { class: 'adm-linea__v' + (tono ? ` is-${tono}` : ''), text: `${Math.round(Math.abs(Number(valor) || 0)) ? signo : ''}${mxn(Math.abs(Number(valor) || 0))}` }),
    onclick ? el('span', { class: 'adm-fila__chev' }, [icon('right', 16)]) : null,
  ]);
  return tarjeta(T('Cómo va el mes', 'This month'), null, [el('div', { class: 'adm-cuenta' }, [
    linea(T('Entró', 'Income'), k.ingresos_mxn, { signo: '+', tono: 'pos' }),
    linea(T('Gastos fijos', 'Fixed expenses'), k.gastos_mxn, { onclick: editarGastos }),
    linea(T('Ofrenda', 'Tithe'), k.ofrenda_mxn, { sub: `${num(cfg.ofrenda_pct)}%` }),
    linea(T('SAT', 'Taxes'), k.sat_mxn, { sub: T(`${num(cfg.sat_pct)}% estimado`, `${num(cfg.sat_pct)}% estimate`) }),
    linea(T('Anuncios', 'Ads'), k.gasto),
    // "Te falta $16,214", sin signo: la palabra ya lo dice.
    linea(queda >= 0 ? T('Te queda', 'Left') : T('Te falta', 'Short'), queda, { signo: '', tono: queda >= 0 ? 'pos' : 'falta', total: true }),
  ])]);
}

function movimientosMes(d) {
  const ventas = ordenarVentas(d.ventas);
  const dias = [];
  for (const v of ventas) {
    const ult = dias[dias.length - 1];
    if (ult && ult[0] === v.fecha) ult[1].push(v); else dias.push([v.fecha, [v]]);
  }
  return tarjeta(T('Movimientos', 'Activity'), botonChico(T('Ingreso', 'Income'), () => editarVenta(null), 'plus'), [
    ...dias.flatMap(([f, lista]) => [
      el('div', { class: 'adm-dia', text: diaTitulo(f) }),
      el('ul', { class: 'adm-lista' }, lista.map((v) => movimiento(v, false))),
    ]),
    ventas.length ? null : nadaAqui(T('Todavía no hay ingresos este mes.', 'No income this month yet.')),
    d.ocultas ? el('p', { class: 'adm-pie', text: T(`${d.ocultas} no ${d.ocultas === 1 ? 'cuenta' : 'cuentan'} (canceladas o pruebas).`, `${d.ocultas} not counted (cancelled or tests).`) }) : null,
  ]);
}

function gastosFijos(d) {
  const gastos = d.cfg.gastos || [];
  return tarjeta(T('Gastos fijos', 'Fixed expenses'), botonChico(T('Editar', 'Edit'), editarGastos), [
    gastos.length
      ? el('div', { class: 'adm-cuenta' }, gastos.map((g) => el('div', { class: 'adm-linea' }, [
        el('div', { class: 'adm-linea__k' }, [el('span', { text: g.nombre })]),
        el('div', { class: 'adm-linea__v', text: mxn(g.monto) }),
      ])))
      : nadaAqui(T('Sin gastos fijos anotados.', 'No fixed expenses yet.')),
  ]);
}

function paquetes(d) {
  const { cfg } = d;
  return tarjeta(T('Paquetes', 'Packages'), botonChico(T('Editar', 'Edit'), editarPaquetes), [
    el('div', { class: 'adm-cuenta' }, [
      ...cfg.paquetes.map((p) => el('div', { class: 'adm-linea' }, [
        el('div', { class: 'adm-linea__k' }, [
          el('span', { text: p.nombre }),
          el('span', { class: 'adm-linea__s', text: [p.minutos ? `${p.minutos} min` : null, p.fotos ? (/^\d+$/.test(String(p.fotos)) ? `${p.fotos} ${T('fotos', 'photos')}` : p.fotos) : null].filter(Boolean).join(' · ') }),
        ]),
        el('div', { class: 'adm-linea__v', text: usd(p.precio) }),
      ])),
      el('button', { class: 'adm-linea is-btn', type: 'button', onclick: cambiarTipoCambio }, [
        el('div', { class: 'adm-linea__k' }, [
          el('span', { text: T('Tipo de cambio', 'Exchange rate') }),
          el('span', { class: 'adm-linea__s', text: cfg.tc_manual ? T('Lo pusiste tú', 'Set by you') : T('Se actualiza solo', 'Updates daily') }),
        ]),
        el('div', { class: 'adm-linea__v', text: `$${Number(cfg.tipo_cambio).toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
        el('span', { class: 'adm-fila__chev' }, [icon('right', 16)]),
      ]),
    ]),
  ]);
}

// ── Anuncios ────────────────────────────────────────────────────────────────
function presupuestoAnuncios(d) {
  const { cfg, pauta, juan, kpis: k } = d;
  const diario = Number(cfg.presupuesto_diario) || 0;
  const presMes = Number(k.presupuesto_mes) || diario * d.periodo.dias_mes;
  const gasto = Number(k.gasto) || 0;
  const activas = (pauta && pauta.activas) || [];
  const sumaActivas = activas.reduce((s, c) => s + (Number(c.diario) || 0), 0);
  const juanVivo = juan && juan.en && (Date.now() - Date.parse(juan.en)) < 20 * 60 * 1000;
  const fila = (ico, titulo, sub, der) => el('div', { class: 'adm-fila' }, [
    el('span', { class: 'adm-av', 'aria-hidden': 'true' }, [ico]),
    el('div', { class: 'adm-fila__main' }, [el('div', { class: 'adm-fila__n adm-fila__n--2', text: titulo }), sub ? el('div', { class: 'adm-fila__s adm-fila__s--2', text: sub }) : null]),
    der || null,
  ]);
  return el('section', { class: 'adm-card' }, [
    el('div', { class: 'adm-big__fila' }, [
      el('div', {}, [
        el('div', { class: 'adm-big__k', text: T('Presupuesto de anuncios', 'Ad budget') }),
        el('div', { class: 'adm-big__v' }, [mxn(diario), el('span', { class: 'adm-big__u', text: T(' al día', ' a day') })]),
      ]),
      botonChico(T('Cambiar', 'Change'), cambiarPresupuesto),
    ]),
    barra(presMes ? gasto / presMes : 0, T(`Gastado ${mxn(gasto)} de ${mxn(presMes)}`, `Spent ${mxn(gasto)} of ${mxn(presMes)}`)),
    el('div', { class: 'adm-big__s', text: T(`Gastado ${mxn(gasto)} de ${mxn(presMes)} en ${mesSolo(mes)}`, `Spent ${mxn(gasto)} of ${mxn(presMes)} in ${mesSolo(mes)}`) }),
    el('div', { class: 'adm-sep' }),
    fila(iconMarca('whatsapp', 18) || icon('phone', 18), T(`WhatsApp de ${(cfg.destino && cfg.destino.nombre) || 'Juan'}`, `${(cfg.destino && cfg.destino.nombre) || 'Juan'}'s WhatsApp`),
      [(cfg.destino && cfg.destino.numero) || '', T('aquí llega todo', 'everything lands here')].filter(Boolean).join(' · '),
      juan ? pill(juanVivo ? T('Activo', 'Online') : T('Sin señal', 'Offline'), juanVivo ? 'ok' : 'warn') : null),
    fila(icon('activity', 18), activas.length ? T(`${activas.length} ${activas.length === 1 ? 'anuncio encendido' : 'anuncios encendidos'}`, `${activas.length} running`) : T('Ninguno encendido', 'None running'),
      activas.length ? activas.map((c) => `${recorte(c.nombre, 28)}${c.diario ? ` · ${mxn(c.diario)}` : ''}`).join(' · ') : null,
      botonChico(T('Abrir Pauta', 'Open Ads'), () => ctx.router.navigate('pauta', {}))),
    sumaActivas > diario
      ? el('div', { class: 'adm-aviso' }, [icon('warning', 16), el('span', { text: T(`Lo encendido suma ${mxn(sumaActivas)} al día, más que tu presupuesto.`, `Running ads add up to ${mxn(sumaActivas)} a day, over budget.`) })])
      : null,
    pauta && pauta.error ? el('p', { class: 'adm-pie', text: T('Meta no respondió; el gasto sale del registro de cada noche.', "Meta didn't answer; spend comes from the nightly log.") }) : null,
  ]);
}

// El camino del dinero en anuncios, como renglones de un estado de cuenta.
function resultadoAnuncios(d) {
  const e = d.embudo || {};
  const gasto = Number(e.gasto) || 0;
  const linea = (etiqueta, valor, sub) => el('div', { class: 'adm-linea' }, [
    el('div', { class: 'adm-linea__k' }, [el('span', { text: etiqueta }), sub ? el('span', { class: 'adm-linea__s', text: sub }) : null]),
    el('div', { class: 'adm-linea__v', text: valor }),
  ]);
  return tarjeta(T(`Resultado de ${mesSolo(mes)}`, `${mayus(mesSolo(mes))} results`), null, [el('div', { class: 'adm-cuenta' }, [
    linea(T('Invertido', 'Spent'), mxn(gasto)),
    linea(T('Personas que lo vieron', 'People reached'), e.alcance != null ? num(e.alcance) : '—'),
    linea(T('Te escribieron', 'Wrote to you'), num(e.leads || 0), e.leads ? T(`${mxn(gasto / e.leads)} cada una`, `${mxn(gasto / e.leads)} each`) : null),
    linea(T('Se volvieron clientes', 'Became clients'), num(e.reservas || 0), e.reservas ? T(`${mxn(gasto / e.reservas)} cada cliente`, `${mxn(gasto / e.reservas)} each`) : null),
    linea(T('Te pagaron', 'Paid you'), mxn(e.ventas_mxn || 0), gasto && e.ventas_mxn ? T(`Cada $1 regresó $${(e.ventas_mxn / gasto).toLocaleString(LOC, { maximumFractionDigits: 1 })}`, `Each $1 returned $${(e.ventas_mxn / gasto).toLocaleString(LOC, { maximumFractionDigits: 1 })}`) : null),
  ])]);
}

const SINGULARES = { mensajes: 'mensaje', registros: 'registro', compras: 'compra', 'visitas a la página': 'visita', clics: 'clic', interacciones: 'interacción' };
const ESTADO_AD = { activo: () => T('Encendido', 'Running'), pausado: () => T('Pausado', 'Paused'), terminado: () => T('Terminado', 'Ended') };
function listaAnuncios(d) {
  const a = d.anuncios || {};
  const lista = a.lista || [];
  const titulo = a.rango === '90' ? T('Anuncios · últimos 90 días', 'Ads · last 90 days') : T('Anuncios del mes', 'Ads this month');
  if (!lista.length) {
    return tarjeta(titulo, null, [nadaAqui(a.error ? T('Meta no respondió. Intenta en un rato.', "Meta didn't answer. Try again later.") : T('No hubo anuncios con gasto.', 'No ads with spend.'))]);
  }
  const unidad = (x) => (x.resultado ? (SINGULARES[x.resultado.nombre] || x.resultado.nombre) : '');
  // A la derecha, el número que decide (Vianey: "puede haber algún lead que
  // cueste más caro pero que nos dé más clientes"): el costo por CLIENTE; si
  // nadie reservó, el costo por persona; si nadie escribió, lo que costó cada
  // resultado que buscaba el anuncio.
  const principal = (x) => {
    if (x.clientes > 0) return [mxn(x.costo_cliente), T('por cliente', 'per client')];
    if (x.leads > 0) return [mxn(x.costo_lead), T('por persona', 'per lead')];
    if (x.resultado && x.resultado.costo != null) return [mxn(x.resultado.costo), T(`por ${unidad(x)}`, `per ${unidad(x)}`)];
    return [mxn(x.gasto), T('gastado', 'spent')];
  };
  // Primero el que conviene: por lo que regresa y su costo por cliente; luego por persona; luego por gasto.
  const orden = lista.slice().sort((p, q) => ((q.retorno || 0) - (p.retorno || 0)) || ((q.clientes > 0) - (p.clientes > 0))
    || ((p.costo_cliente ?? Infinity) - (q.costo_cliente ?? Infinity)) || ((p.costo_lead ?? Infinity) - (q.costo_lead ?? Infinity)) || (q.gasto - p.gasto));
  const etiquetaMejor = { cliente: T('El que conviene', 'Best value'), lead: T('Más barato por persona', 'Cheapest per lead'), resultado: T('Más barato', 'Cheapest') }[a.criterio] || '';
  return tarjeta(titulo, null, [
    a.aprendizaje ? el('div', { class: 'adm-leccion' + (a.criterio === 'cliente' ? ' is-bien' : '') }, [icon(a.criterio === 'cliente' ? 'check' : 'info', 16), el('span', { text: a.aprendizaje })]) : null,
    el('div', { class: 'adm-ads' }, orden.map((x) => {
      const [valor, etiqueta] = principal(x);
      const esMejor = x.ad_id === a.mejor;
      const camino = x.leads
        ? T(`${num(x.leads)} te escribieron → ${num(x.clientes)} ${x.clientes === 1 ? 'clienta' : 'clientas'} (${Math.round((x.conversion || 0) * 100)}%)`, `${num(x.leads)} wrote → ${num(x.clientes)} clients (${Math.round((x.conversion || 0) * 100)}%)`)
        : T(`Gastó ${mxn(x.gasto)} · nadie escribió`, `Spent ${mxn(x.gasto)} · nobody wrote`);
      return el('details', { class: 'adm-ad' + (esMejor && a.criterio === 'cliente' ? ' is-mejor' : '') }, [
        el('summary', {}, [
          x.foto ? el('img', { class: 'adm-ad__foto', src: x.foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('span', { class: 'adm-ad__foto' }, [icon('spark', 18)]),
          el('div', { class: 'adm-fila__main' }, [
            el('div', { class: 'adm-fila__n adm-fila__n--2', text: x.nombre }),
            el('div', { class: 'adm-ad__camino', text: camino }),
            el('div', { class: 'adm-ad__sub' }, [
              pill((ESTADO_AD[x.estado] || ESTADO_AD.terminado)(), x.estado === 'activo' ? 'ok' : null),
              esMejor && etiquetaMejor ? pill(etiquetaMejor, a.criterio === 'cliente' ? 'ok' : 'brand') : null,
              x.ad_id === a.peor ? pill(a.criterio === 'cliente' ? T('El que menos conviene', 'Worst value') : T('El más caro', 'Priciest'), 'warn') : null,
            ]),
          ]),
          el('div', { class: 'adm-fila__der' }, [el('div', { class: 'adm-monto-fila', text: valor }), el('div', { class: 'adm-fila__f', text: etiqueta })]),
          el('span', { class: 'adm-ad__chev' }, [icon('down', 16)]),
        ]),
        el('div', { class: 'adm-ad__datos' }, [
          dato(mxn(x.gasto), T('Gastó', 'Spent')),
          dato(num(x.leads), T('Te escribieron', 'Wrote to you')),
          dato(x.costo_lead != null ? mxn(x.costo_lead) : '—', T('Por persona', 'Per lead')),
          dato(x.leads ? `${num(x.clientes)} · ${Math.round((x.conversion || 0) * 100)}%` : num(x.clientes), T('Se volvieron clientes', 'Became clients')),
          dato(x.costo_cliente != null ? mxn(x.costo_cliente) : '—', T('Por cliente', 'Per client')),
          dato(x.retorno != null && x.ingresos ? `${mxn(x.ingresos)} · $${Number(x.retorno).toLocaleString(LOC, { maximumFractionDigits: 1 })}` : '—', T('Te pagaron · por cada $1', 'Paid you · per $1')),
        ]),
        x.resultado && x.resultado.tipo === 'post_engagement'
          ? el('p', { class: 'adm-pie adm-ad__nota', text: T('Este anuncio buscaba likes, no clientes.', 'This ad went after likes, not clients.') }) : null,
      ]);
    })),
  ]);
}

// ── Clientes ────────────────────────────────────────────────────────────────
function statsClientes(d) {
  const k = d.kpis;
  return el('section', { class: 'adm-stats' }, [
    stat(T('Personas nuevas', 'New people'), num(k.leads.total), T('Te escribieron', 'Wrote to you')),
    stat(T('Por anuncios', 'From ads'), num(k.leads.pauta), k.costo_lead_pauta != null ? T(`${mxn(k.costo_lead_pauta)} cada una`, `${mxn(k.costo_lead_pauta)} each`) : T('Sin costo aún', 'No cost yet')),
    stat(T('Por Google', 'From Google'), num(k.leads.seo), T('Gratis', 'Free')),
    stat(T('Esperan respuesta', 'Waiting'), num(d.esperando || 0), d.esperando ? T('Contestar ahora', 'Reply now') : T('Todo al día', 'All caught up'),
      { tono: d.esperando ? 'alerta' : null, onclick: () => irPestana('bandeja') }),
  ]);
}

function origenClientes(d) {
  const k = d.kpis.leads || {};
  const items = [
    ['pauta', T('Anuncios', 'Ads')], ['seo', T('Google y sitio web', 'Google and website')], ['redes', T('Instagram y Facebook', 'Instagram and Facebook')],
    ['recomendacion', T('Recomendación', 'Referral')], ['hotel', T('Hotel o agencia', 'Hotel or agency')], ['otro', T('Otro', 'Other')], ['sin_definir', T('Sin saber', 'Unknown')],
  ].map(([id, etiqueta]) => ({ id, etiqueta, valor: Number(k[id]) || 0 })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = items.reduce((s, x) => s + x.valor, 0) || 1;
  return tarjeta(T('De dónde llegan', 'Where they come from'), null, [
    items.length
      ? el('ul', { class: 'adm-barras' }, items.map((x, i) => el('li', {}, [
        el('div', { class: 'adm-barras__top' }, [el('span', { text: x.etiqueta }), el('span', { class: 'adm-barras__v', text: `${num(x.valor)} · ${Math.round((x.valor / total) * 100)}%` })]),
        el('div', { class: 'adm-barras__pista' }, [el('div', { class: 'adm-barras__b' + (i === 0 ? '' : ' is-gris'), style: { width: `${Math.max(2, (x.valor / items[0].valor) * 100)}%` } })]),
      ])))
      : nadaAqui(T('Todavía nadie nuevo este mes.', 'Nobody new this month yet.')),
  ]);
}

function seccionLeads(d) {
  const leads = d.leads || [];
  const cuenta = (f) => leads.filter((l) => (f === 'sin' ? !l.fuente : l.fuente === f)).length;
  const filtros = [
    ['todos', T('Todos', 'All'), leads.filter((l) => l.fuente !== 'no_lead').length],
    ['pauta', T('Anuncios', 'Ads'), cuenta('pauta')],
    ['seo', 'Google', cuenta('seo')],
    ['redes', T('Redes', 'Social'), cuenta('redes')],
    ['sin', T('Sin origen', 'No source'), cuenta('sin')],
    ['otros', T('Otros', 'Others'), leads.filter((l) => ['recomendacion', 'hotel', 'otro'].includes(l.fuente)).length],
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
  return tarjeta(T('Leads', 'Leads'), botonChico(T('Lead', 'Lead'), nuevoLead, 'plus'), [
    el('div', { class: 'adm-filtros', role: 'tablist' }, filtros.map(([k, txt, n]) => el('button', {
      class: 'adm-filtro' + (k === filtroLeads ? ' is-active' : ''), type: 'button', role: 'tab',
      'aria-selected': k === filtroLeads ? 'true' : 'false',
      onclick: () => { filtroLeads = k; verTodosLeads = false; pintar(); },
    }, [el('span', { text: txt }), el('span', { class: 'adm-filtro__n', text: String(n) })]))),
    mostrar.length ? el('ul', { class: 'adm-lista' }, mostrar.map((l) => el('li', {}, [el('div', { class: 'adm-fila' }, [
      el('span', { class: `adm-av adm-net--${l.canal}`, 'aria-hidden': 'true' }, [icoCanal(l.canal)]),
      el('div', { class: 'adm-fila__main' }, [
        el('div', { class: 'adm-fila__n', text: l.nombre || '—' }),
        el('div', { class: 'adm-fila__s', text: [diaCorto(l.fecha), l.anuncio ? `${T('Anuncio', 'Ad')}: ${l.anuncio}` : (l.texto || CANAL_TXT[l.canal] || '')].filter(Boolean).join(' · ') }),
      ]),
      chipFuente(l.fuente, l.auto, () => elegirFuenteLead(l)),
    ])]))) : nadaAqui(T('Nada aquí este mes.', 'Nothing here this month.')),
    visibles.length > LIMITE && !verTodosLeads
      ? el('div', { class: 'adm-centro' }, [enlace(T(`Ver los ${visibles.length}`, `Show all ${visibles.length}`), () => { verTodosLeads = true; pintar(); })])
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
    ...FUENTES.map(([k]) => ({ value: k, label: FUENTE_FACIL[k](), current: l.fuente === k })),
    { value: 'no_lead', label: T('No es lead', 'Not a lead'), sub: T('Proveedor, hotel, prueba o spam', 'Supplier, hotel, test or spam'), current: l.fuente === 'no_lead' },
  ];
  if (l.manual) opciones.push({ value: '__borrar', label: T('Borrar este lead', 'Delete this lead') });
  else if (!l.auto) opciones.push({ value: '__auto', label: T('Que lo deduzca solo', 'Let it guess') });
  const v = await ctx.sheet.pickFrom({ title: l.nombre || T('¿Cómo te encontró?', 'How did they find you?'), options: opciones });
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

// ── Posts ───────────────────────────────────────────────────────────────────
function mejorPublicacion(d) {
  const p = d.publicaciones || {};
  const x = (p.lista || [])[0];
  const rango = p.rango === '90' ? T('últimos 90 días', 'last 90 days') : mesSolo(mes);
  if (!x) return tarjeta(T('Posts', 'Posts'), null, [nadaAqui(p.error || T('No hay publicaciones en este tiempo.', 'No posts in this period.'))]);
  return tarjeta(T(`La que más gustó · ${rango}`, `Top post · ${rango}`), null, [
    el('a', { class: 'adm-top-pub', href: x.enlace || '#', target: '_blank', rel: 'noopener' }, [
      x.foto ? el('img', { class: 'adm-top-pub__foto', src: x.foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('span', { class: 'adm-top-pub__foto' }, [icon('camera', 22)]),
      el('div', { class: 'adm-top-pub__info' }, [
        el('div', { class: 'adm-fila__s', text: `${x.tipo === 'reel' ? 'Reel' : 'Post'} · ${diaCorto(x.fecha)}` }),
        el('div', { class: 'adm-top-pub__txt', text: x.texto || T('Sin texto', 'No caption') }),
        el('div', { class: 'adm-top-pub__nums' }, [
          dato(num(x.interacciones), T('Interacciones', 'Interactions')),
          dato(x.alcance != null ? num(x.alcance) : '—', T('La vieron', 'Reached')),
          dato(x.guardados != null ? num(x.guardados) : '—', T('Guardados', 'Saves')),
          dato(x.compartidos != null ? num(x.compartidos) : '—', T('Compartidos', 'Shares')),
        ]),
      ]),
    ]),
    el('p', { class: 'adm-pie', text: T('Buena candidata para un anuncio a WhatsApp.', 'A good candidate for a WhatsApp ad.') }),
  ]);
}

function gridPublicaciones(d) {
  const lista = ((d.publicaciones || {}).lista || []).slice(0, 12);
  if (lista.length < 2) return null;
  return tarjeta(T('Todas, de más a menos interacción', 'All, by interaction'), null, [
    el('ul', { class: 'adm-grid' }, lista.map((x) => el('li', {}, [el('a', { href: x.enlace || '#', target: '_blank', rel: 'noopener', 'aria-label': `${recorte(x.texto, 60)}: ${num(x.interacciones)} ${T('interacciones', 'interactions')}` }, [
      x.foto ? el('img', { src: x.foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('span', { class: 'adm-grid__vacia' }, [icon('camera', 20)]),
      el('span', { class: 'adm-grid__n' }, [el('span', { html: CORAZON }), el('span', { text: num(x.interacciones) })]),
      x.tipo === 'reel' ? el('span', { class: 'adm-grid__reel' }, [icon('play', 12)]) : null,
    ])]))),
  ]);
}

// ── Hojas ───────────────────────────────────────────────────────────────────
// Vianey (6-nov-2026), sobre la hoja de ingreso con listas desplegables: "este
// no es un sistema bien hecho… quiero que sea simple y claro todo". Primero el
// monto, grande, como en una app de pagos; lo que se elige va en botones que
// se ven todos de un vistazo, cada pregunta con su título, y lo que casi nunca
// se toca (fechas, precio en dólares) dentro de "Más detalles", ya puesto.

// append() pinta la palabra "null" si le llega un null (el() sí los ignora): todo
// lo que se mete a una hoja pasa por aquí.
function poner(host, ...hijos) { host.append(...hijos.filter(Boolean)); }

function campo(etiqueta, control) {
  return el('label', { class: 'field adm-campo' }, [el('span', { class: 'label', text: etiqueta }), control]);
}

// Una pregunta de la hoja. Es un div y no un <label>: un label que envuelve
// botones "toca" el primero cuando se toca el título.
function pregunta(titulo, control, ayuda) {
  return el('div', { class: 'adm-q' }, [
    el('div', { class: 'adm-q__t', text: titulo }),
    control,
    ayuda ? el('p', { class: 'adm-q__ayuda', text: ayuda }) : null,
  ]);
}

// Botones para elegir uno. opciones = [[valor, texto, sub?, icono?]].
// `quitable`: tocar el elegido lo quita (para lo que es opcional).
function eleccion(opciones, actual, alElegir, { clase = '', quitable = false } = {}) {
  let valor = actual || '';
  const host = el('div', { class: 'adm-ops' + (clase ? ` ${clase}` : ''), role: 'radiogroup' });
  const marcar = () => {
    for (const b of host.children) {
      const on = b.dataset.v === valor;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  };
  for (const [v, txt, sub, ico] of opciones) {
    host.appendChild(el('button', {
      class: 'adm-op', type: 'button', role: 'radio', dataset: { v },
      onclick: () => { valor = quitable && valor === v ? '' : v; marcar(); alElegir(valor); },
    }, [
      ico ? el('span', { class: 'adm-op__ico' }, [icon(ico, 20)]) : null,
      el('span', { class: 'adm-op__t', text: txt }),
      sub ? el('span', { class: 'adm-op__s', text: sub }) : null,
    ]));
  }
  marcar();
  return host;
}

// "Más detalles": se abre al tocarlo; a la derecha dice lo que ya trae puesto.
function masDetalles(resumen, hijos) {
  const txt = el('span', { class: 'adm-mas-det__r' });
  const det = el('details', { class: 'adm-mas-det' }, [
    el('summary', {}, [el('span', { text: T('Más detalles', 'More details') }), txt, icon('down', 16)]),
    el('div', { class: 'adm-mas-det__c' }, hijos.filter(Boolean)),
  ]);
  const refrescar = () => { txt.textContent = resumen() || ''; };
  refrescar();
  det.addEventListener('change', refrescar);
  det.addEventListener('input', refrescar);
  return det;
}

// El monto grande, centrado, como en una app de pagos. Solo números y punto.
function montoGrande(titulo, valor, alCambiar, { moneda = 'MXN', prefijo = '$' } = {}) {
  const inp = el('input', {
    class: 'adm-monto__in', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0',
    value: valor || '', 'aria-label': titulo,
  });
  const medir = () => { inp.style.width = `${Math.max(1, (inp.value || '0').length) + 0.2}ch`; };
  inp.addEventListener('input', () => {
    const limpio = inp.value.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');
    if (limpio !== inp.value) inp.value = limpio;
    medir(); alCambiar(inp.value);
  });
  medir();
  const caja = el('div', { class: 'adm-monto' }, [
    el('div', { class: 'adm-monto__k', text: titulo }),
    el('label', { class: 'adm-monto__fila' }, [
      el('span', { class: 'adm-monto__sig', text: prefijo }),
      inp,
      moneda ? el('span', { class: 'adm-monto__u', text: moneda }) : null,
    ]),
  ]);
  return { caja, inp, poner: (v) => { inp.value = v; medir(); alCambiar(v); } };
}

// Botones del pie de cada hoja: [quitar]  ·····  [Cancelar] [Guardar].
function pieHoja(close, ok, quitar) {
  return el('div', { class: 'adm-btns' }, [
    quitar || null,
    el('span', { class: 'adm-btns__sep' }),
    el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }),
    ok,
  ]);
}

const opcionesFuente = () => FUENTES.map(([k]) => [k, FUENTE_FACIL[k]()]);
const CLASE_DE = (tipo) => (['upgrade', 'propina', 'otro'].includes(tipo) ? 'extra' : (tipo || 'sesion'));

function editarVenta(v) {
  const nueva = !v;
  const cfg = (data && data.cfg) || {};
  const catalogo = cfg.paquetes || [];
  const empresas = cfg.empresas || [];
  const tc = Number(cfg.tipo_cambio) || 0;
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
      let otraEmpresa = !!(bor.empresa && !empresas.includes(bor.empresa));

      const sugerencia = el('div', { class: 'adm-monto__sug' });
      const monto = montoGrande(T('¿Cuánto te pagaron?', 'How much were you paid?'), bor.monto, (x) => { bor.monto = x; pintarSugerencia(); });
      // Con un paquete elegido y sin monto: el precio en pesos al cambio de hoy, a un toque.
      function pintarSugerencia() {
        clear(sugerencia);
        const p = catalogo.find((x) => x.nombre === bor.paquete);
        if (bor.tipo !== 'sesion' || !p || bor.monto || !tc) return;
        const pesos = Math.round(p.precio * tc);
        sugerencia.appendChild(el('button', { class: 'adm-sug', type: 'button', onclick: () => monto.poner(String(pesos)) }, [
          T(`${p.nombre}: ${usd(p.precio)} ≈ ${mxn(pesos)}`, `${p.nombre}: ${usd(p.precio)} ≈ ${mxn(pesos)}`),
          el('b', { text: T(' Usar', ' Use') }),
        ]));
      }

      const variable = el('div');
      const clase = eleccion([
        ['sesion', T('Sesión', 'Session'), null, 'camera'],
        ['marca', T('Marca', 'Brand'), null, 'briefcase'],
        ['extra', T('Extra', 'Extra'), null, 'plus'],
      ], CLASE_DE(bor.tipo), (x) => {
        if (x === 'extra') { if (!['upgrade', 'propina', 'otro'].includes(bor.tipo)) bor.tipo = 'upgrade'; } else bor.tipo = x;
        pintarVariable(); pintarSugerencia();
      }, { clase: 'adm-ops--seg' });

      function pintarVariable() {
        clear(variable);
        const esMarca = bor.tipo === 'marca';
        const esSesion = bor.tipo === 'sesion';
        const fecha = el('input', { class: 'input', type: 'date', value: bor.fecha });
        fecha.addEventListener('change', () => { bor.fecha = fecha.value || hoyCancun(); });
        const fechaSesion = esSesion ? el('input', { class: 'input', type: 'date', value: bor.fechaSesion }) : null;
        if (fechaSesion) fechaSesion.addEventListener('change', () => { bor.fechaSesion = fechaSesion.value; });
        const precio = esSesion ? el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: bor.precio, placeholder: '0' }) : null;
        if (precio) precio.addEventListener('input', () => { precio.value = precio.value.replace(/[^\d.]/g, ''); bor.precio = precio.value; });
        if (CLASE_DE(bor.tipo) === 'extra') {
          poner(variable, pregunta(T('¿Qué fue?', 'What was it?'), eleccion([
            ['upgrade', T('Upgrade', 'Upgrade')], ['propina', T('Propina', 'Tip')], ['otro', T('Otro', 'Other')],
          ], bor.tipo, (x) => { bor.tipo = x; })));
        }
        if (esMarca) {
          const otra = el('input', { class: 'input', value: otraEmpresa ? bor.empresa : '', placeholder: T('Nombre de la empresa', 'Company name'), maxlength: '80', autocomplete: 'off' });
          otra.addEventListener('input', () => { bor.empresa = otra.value; });
          const caja = el('div', { class: 'adm-otra', hidden: !otraEmpresa }, [otra]);
          poner(variable, pregunta(T('¿Qué empresa?', 'Which company?'), el('div', {}, [
            eleccion([...empresas.map((e) => [e, e]), ['__otra', T('Otra', 'Other')]], otraEmpresa ? '__otra' : bor.empresa, (x) => {
              otraEmpresa = x === '__otra';
              caja.hidden = !otraEmpresa;
              bor.empresa = otraEmpresa ? otra.value : x;
              if (otraEmpresa) setTimeout(() => { try { otra.focus(); } catch { /* noop */ } }, 30);
            }),
            caja,
          ])));
        } else {
          const quien = el('input', { class: 'input adm-input-xl', value: bor.cliente, placeholder: T('Nombre del cliente', 'Client name'), maxlength: '120', autocomplete: 'off' });
          quien.addEventListener('input', () => { bor.cliente = quien.value; });
          poner(variable, pregunta(T('¿Quién te pagó?', 'Who paid you?'), quien));
        }
        poner(variable, pregunta(T('¿Cómo te pagó?', 'How did they pay?'), eleccion(
          Object.keys(PAGO_TXT).map((p) => [p, pagoTxt(p)]), bor.pago, (x) => { bor.pago = x; }, { quitable: true },
        )));
        if (esSesion) {
          const opcionesPaq = catalogo.map((p) => [p.nombre, p.nombre, usd(p.precio)]);
          if (bor.paquete && !catalogo.some((p) => p.nombre === bor.paquete)) opcionesPaq.push([bor.paquete, bor.paquete]);
          poner(variable,
            pregunta(T('Paquete', 'Package'), eleccion(opcionesPaq, bor.paquete, (x) => {
              bor.paquete = x;
              const p = catalogo.find((y) => y.nombre === x);
              bor.precio = p ? String(p.precio) : '';
              if (precio) precio.value = bor.precio;
              pintarSugerencia();
            }, { clase: 'adm-ops--grid', quitable: true })),
            pregunta(T('¿Cómo te encontró?', 'How did they find you?'), eleccion(opcionesFuente(), bor.fuente, (x) => { bor.fuente = x; }, { quitable: true })),
          );
        }
        poner(variable, masDetalles(() => [
          bor.fecha === hoyCancun() ? T('Cobrado hoy', 'Paid today') : T(`Cobrado ${diaCorto(bor.fecha)}`, `Paid ${diaCorto(bor.fecha)}`),
          esSesion && bor.fechaSesion ? T(`sesión ${diaCorto(bor.fechaSesion)}`, `session ${diaCorto(bor.fechaSesion)}`) : null,
        ].filter(Boolean).join(' · '), [
          el('div', { class: 'adm-dos' }, [
            campo(T('Día que te pagó', 'Day paid'), fecha),
            fechaSesion ? campo(T('Día de la sesión', 'Session day'), fechaSesion) : null,
          ].filter(Boolean)),
          precio ? campo(T('Precio en dólares', 'Price in dollars'), el('div', { class: 'adm-prefijo' }, [el('span', { text: 'US$' }), precio])) : null,
          v && v.notas ? el('p', { class: 'adm-q__ayuda', text: v.notas }) : null,
        ]));
      }
      pintarVariable();
      pintarSugerencia();

      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        const esMarca = bor.tipo === 'marca';
        if (nueva && !(Number(bor.monto) > 0)) { toast(T('Escribe cuánto te pagaron.', 'Type the amount.'), 'error'); monto.inp.focus(); return; }
        if (esMarca && !String(bor.empresa || '').trim()) { toast(T('Elige la empresa.', 'Pick the company.'), 'error'); return; }
        if (!esMarca && !bor.cliente.trim()) { toast(T('Escribe el nombre del cliente.', "Type the client's name."), 'error'); return; }
        const esSesion = bor.tipo === 'sesion';
        const cuerpo = {
          tipo: bor.tipo,
          cliente: esMarca ? bor.empresa.trim() : bor.cliente,
          empresa: esMarca ? bor.empresa.trim() : null,
          monto_mxn: bor.monto === '' ? null : Number(bor.monto),
          forma_pago: bor.pago || null,
          fecha: bor.fecha,
          paquete: esSesion ? (bor.paquete || null) : null,
          precio: esSesion && bor.precio !== '' ? Number(bor.precio) : null,
          fuente: esSesion ? (bor.fuente || null) : null,
          fecha_sesion: esSesion ? (bor.fechaSesion || null) : null,
        };
        ok.disabled = true;
        try {
          if (nueva) await api.post('/negocio/ventas', cuerpo);
          else await api.patch(`/negocio/ventas/${encodeURIComponent(v.id)}`, cuerpo);
          close({ force: true });
          toast(nueva ? T('Ingreso guardado.', 'Income saved.') : T('Guardado.', 'Saved.'), 'success');
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

      // De dónde salió este ingreso (las reservas de Juan llegan solas, sin monto).
      const contexto = nueva ? null : [
        v.origen === 'juan' ? T('Reserva de Juan', "Juan's booking") : (v.origen === 'excel' ? T('De tu control de meses', 'From your monthly sheet') : (v.origen === 'stripe' ? T('Llegó solo de Stripe', 'Came in from Stripe') : null)),
        v.stripe && v.origen === 'juan' ? T('pagado en Stripe', 'paid on Stripe') : null,
        v.fecha_sesion ? T(`sesión ${diaCorto(v.fecha_sesion)}`, `session ${diaCorto(v.fecha_sesion)}`) : null,
      ].filter(Boolean).join(' · ');
      poner(body,
        contexto ? el('div', { class: 'adm-centro' }, [pill(mayus(contexto))]) : null,
        monto.caja,
        sugerencia,
        pregunta(T('¿Qué te pagaron?', 'What was it for?'), clase),
        variable,
        pieHoja(close, ok, quitar),
      );
      if (nueva) setTimeout(() => { try { monto.inp.focus(); } catch { /* noop */ } }, 80);
    },
  });
}

function nuevoLead() {
  ctx.sheet.openSheet({
    title: T('Anotar un lead', 'Add a lead'), mode: 'form',
    build(body, close) {
      const bor = { canal: 'whatsapp_990', fuente: '', fecha: hoyCancun() };
      const nombre = el('input', { class: 'input adm-input-xl', placeholder: T('Nombre de la persona', 'Their name'), maxlength: '120', autocomplete: 'off' });
      const fecha = el('input', { class: 'input', type: 'date', value: bor.fecha, max: hoyCancun() });
      fecha.addEventListener('change', () => { bor.fecha = fecha.value || hoyCancun(); });
      const notas = el('input', { class: 'input', placeholder: T('Ej. sesión de pareja en diciembre', 'E.g. couple session in December'), maxlength: '300' });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        if (!nombre.value.trim()) { toast(T('Escribe el nombre.', 'Type the name.'), 'error'); nombre.focus(); return; }
        if (!bor.fuente) { toast(T('Elige cómo te encontró (si no sabes, "Otro").', 'Pick how they found you ("Other" if unsure).'), 'error'); return; }
        ok.disabled = true;
        try {
          await api.post('/negocio/leads', { nombre: nombre.value, canal: bor.canal, fuente: bor.fuente, fecha: bor.fecha, notas: notas.value });
          close({ force: true });
          toast(T('Lead anotado.', 'Lead added.'), 'success');
          await recargar();
        } catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body,
        el('p', { class: 'adm-hoja-intro', text: T('Para quien te escribió fuera de la Bandeja.', 'For someone who reached you outside the Inbox.') }),
        pregunta(T('¿Quién?', 'Who?'), nombre),
        pregunta(T('¿Por dónde te escribió?', 'How did they reach you?'), eleccion([
          ['whatsapp_990', 'WhatsApp 990'], ['llamada', T('Llamada', 'Call')], ['instagram', 'Instagram'],
          ['persona', T('En persona', 'In person')], ['otro', T('Otro', 'Other')],
        ], bor.canal, (x) => { bor.canal = x; })),
        pregunta(T('¿Cómo te encontró?', 'How did they find you?'), eleccion(opcionesFuente(), bor.fuente, (x) => { bor.fuente = x; }),
          T('Si no sabes, elige "Otro".', 'If unsure, pick "Other".')),
        masDetalles(() => (bor.fecha === hoyCancun() ? T('Hoy', 'Today') : diaCorto(bor.fecha)), [
          campo(T('Día', 'Day'), fecha),
          campo(T('Nota', 'Note'), notas),
        ]),
        pieHoja(close, ok),
      );
      setTimeout(() => { try { nombre.focus(); } catch { /* noop */ } }, 80);
    },
  });
}

function editarGastos() {
  const cfg = data.cfg;
  const gastos = (cfg.gastos || []).map((g) => ({ ...g }));
  ctx.sheet.openSheet({
    title: T('Gastos fijos', 'Fixed expenses'), mode: 'form',
    build(body, close) {
      const lista = el('div', { class: 'adm-gastos-edit' });
      const total = el('span', { class: 'adm-gastos-edit__total' });
      const sumar = () => { total.textContent = mxn(gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0)); };
      const pintarLista = () => {
        clear(lista);
        for (const g of gastos) {
          const nombre = el('input', { class: 'input', value: g.nombre, placeholder: T('Gasto', 'Expense'), maxlength: '60', 'aria-label': T('Gasto', 'Expense') });
          nombre.addEventListener('input', () => { g.nombre = nombre.value; });
          const monto = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: g.monto ? String(g.monto) : '', placeholder: '0', 'aria-label': T('Monto', 'Amount') });
          monto.addEventListener('input', () => { monto.value = monto.value.replace(/[^\d.]/g, ''); g.monto = Number(monto.value) || 0; sumar(); });
          lista.appendChild(el('div', { class: 'adm-gasto-edit' }, [
            nombre,
            el('div', { class: 'adm-prefijo' }, [el('span', { text: '$' }), monto]),
            el('button', { class: 'adm-quitar-x', type: 'button', 'aria-label': T('Quitar', 'Remove'), onclick: () => { gastos.splice(gastos.indexOf(g), 1); pintarLista(); sumar(); } }, [icon('close', 16)]),
          ]));
        }
      };
      pintarLista(); sumar();
      const ofrenda = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(cfg.ofrenda_pct) });
      const sat = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(cfg.sat_pct) });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        ok.disabled = true;
        try {
          await api.post('/negocio/ajustes', { gastos: gastos.filter((g) => g.nombre && g.nombre.trim()), ofrenda_pct: Number(ofrenda.value) || 0, sat_pct: Number(sat.value) || 0 });
          close({ force: true });
          await recargar();
        } catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body,
        el('div', { class: 'adm-gastos-edit__cab' }, [el('span', { text: T('Total al mes', 'Monthly total') }), total]),
        lista,
        el('button', { class: 'adm-enlace adm-agregar', type: 'button', onclick: () => {
          gastos.push({ nombre: '', monto: 0 }); pintarLista();
          setTimeout(() => { const ins = lista.querySelectorAll('input'); const ultimo = ins[ins.length - 2]; if (ultimo) ultimo.focus(); }, 50);
        } }, [icon('plus', 16), el('span', { text: T('Agregar gasto', 'Add expense') })]),
        el('div', { class: 'adm-dos adm-pct' }, [
          campo(T('Ofrenda (%)', 'Tithe (%)'), ofrenda),
          campo(T('SAT estimado (%)', 'Taxes, estimate (%)'), sat),
        ]),
        pieHoja(close, ok),
      );
    },
  });
}

function pedirNumero({ titulo, etiqueta, valor, ayuda, prefijo, moneda, extra }) {
  return new Promise((resolve) => {
    let listo = false;
    const fin = (x) => { if (!listo) { listo = true; resolve(x); } };
    ctx.sheet.openSheet({
      title: titulo, mode: 'form', onClose: () => fin(null),
      build(body, close) {
        let actual = valor != null ? String(valor) : '';
        const m = montoGrande(etiqueta, actual, (x) => { actual = x; }, { prefijo: prefijo || '', moneda: moneda || '' });
        const ok = () => { const n = Number(actual); if (!(n > 0)) { m.inp.focus(); return; } fin(n); close({ force: true }); };
        m.inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        poner(body,
          m.caja,
          ayuda ? el('p', { class: 'adm-hoja-intro adm-centro', text: ayuda }) : null,
          pieHoja(close, el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: ok }),
            extra ? extra(() => { fin('__extra'); close({ force: true }); }) : null),
        );
        setTimeout(() => { try { m.inp.focus(); m.inp.select(); } catch { /* noop */ } }, 80);
      },
    });
  });
}

async function cambiarPresupuesto() {
  const n = await pedirNumero({
    titulo: T('Presupuesto de anuncios', 'Ad budget'),
    etiqueta: T('Máximo por día', 'Daily maximum'),
    valor: data.cfg.presupuesto_diario, prefijo: '$', moneda: 'MXN',
    ayuda: T('Es el tope: los anuncios encendidos nunca suman más que esto. No enciende ni gasta nada solo.',
      'It is the cap: running ads never add up to more. It does not turn on or spend anything by itself.'),
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
    valor: data.cfg.tipo_cambio, prefijo: '$', moneda: 'MXN',
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
  const lista = data.cfg.paquetes.map((p) => ({ ...p }));
  ctx.sheet.openSheet({
    title: T('Precios de los paquetes', 'Package prices'), mode: 'form',
    build(body, close) {
      const filas = lista.map((p) => {
        const inp = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(p.precio), 'aria-label': p.nombre });
        inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^\d.]/g, ''); p.precio = Number(inp.value); });
        return el('div', { class: 'adm-paq-edit' }, [
          el('span', { class: 'adm-paq-edit__n', text: p.nombre }),
          el('div', { class: 'adm-prefijo' }, [el('span', { text: 'US$' }), inp]),
        ]);
      });
      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        if (lista.some((p) => !(p.precio > 0))) { toast(T('Cada paquete necesita su precio.', 'Each package needs a price.'), 'error'); return; }
        ok.disabled = true;
        try { await api.post('/negocio/ajustes', { paquetes: lista }); close({ force: true }); await recargar(); }
        catch (e) { toast(e.message, 'error'); ok.disabled = false; }
      } });
      poner(body,
        el('p', { class: 'adm-hoja-intro', text: T('Solo cambia los números de este panel. El sitio y Juan no se tocan desde aquí.', 'Only changes this panel. The website and Juan are not changed here.') }),
        ...filas,
        pieHoja(close, ok),
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
  link.href = '/marketing/css/administracion.css?v=202611070449';
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
