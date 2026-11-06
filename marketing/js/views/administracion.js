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
import { api, el, clear } from '../api.js?v=202611060053';
import { icon, iconMarca } from '../shell/icons.js?v=202611060053';
import { T, isEN } from '../shell/i18n.js?v=202611060053';
import { toast } from '../shell/toast.js?v=202611060053';

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

function pintar() {
  if (!rootEl || !data) return;
  clear(rootEl);
  const secciones = [
    cabecera,
    () => tarjetaPauta(data),
    () => numeros(data),
    () => lectura(data),
    () => seccionLeads(data),
    () => seccionVentas(data),
    () => seccionGastos(data),
    () => seccionPaquetes(data),
  ];
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
      'Lo que cuesta conseguir cada sesión y lo que deja.',
      'What each session costs to win and what it brings in.',
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

// ── Los números del mes ─────────────────────────────────────────────────────
// Como su Excel: lo que entró (sesiones y marcas), cuántas sesiones, lo que
// deja cada una y lo que le queda; y abajo lo de la pauta.
function numeros(d) {
  const k = d.kpis;
  const tc = Number(d.cfg.tipo_cambio) || 0;
  const tile = (valor, etiqueta, sub, tono) => el('div', { class: 'adm-kpi' + (tono ? ` adm-kpi--${tono}` : '') }, [
    el('div', { class: 'adm-kpi__v', text: valor }),
    el('div', { class: 'adm-kpi__k', text: etiqueta }),
    sub ? el('div', { class: 'adm-kpi__s', text: sub }) : null,
  ]);
  const ticketMxn = k.ticket_mxn != null ? k.ticket_mxn : k.ticket_hist_mxn;
  const subTicket = k.ticket_mxn != null
    ? `≈ ${usd(k.ticket_mxn / tc)} · ${T(`${k.sesiones_con_monto} ${k.sesiones_con_monto === 1 ? 'sesión' : 'sesiones'}`, `${k.sesiones_con_monto} ${k.sesiones_con_monto === 1 ? 'session' : 'sessions'}`)}`
    : (k.ticket_hist_mxn != null
      ? T(`Tus últimas ${k.ticket_hist_n} sesiones`, `Your last ${k.ticket_hist_n} sessions`)
      : T('Aún sin sesiones con monto', 'No sessions with an amount yet'));
  const conv = d.pauta && d.pauta.conversaciones;
  const queda = k.queda_mxn;
  return el('section', { class: 'adm-kpis' }, [
    tile(mxn(k.ingresos_mxn), T('Ingresos del mes', 'Income this month'),
      k.ingresos_mxn ? T(`Sesiones ${mxn(k.ingresos_sesiones_mxn)} · marcas ${mxn(k.ingresos_marcas_mxn)}`, `Sessions ${mxn(k.ingresos_sesiones_mxn)} · brands ${mxn(k.ingresos_marcas_mxn)}`) : T('Todavía no entra nada', 'Nothing in yet'), 'brand'),
    tile(num(k.sesiones_n), T('Sesiones cerradas', 'Closed sessions'), k.ventas.sin_precio ? T(`${k.ventas.sin_precio} sin monto`, `${k.ventas.sin_precio} without amount`) : T(`De pauta: ${num(k.ventas.pauta)}`, `From ads: ${num(k.ventas.pauta)}`)),
    tile(ticketMxn != null ? mxn(ticketMxn) : '—', T('Ticket por sesión', 'Ticket per session'), subTicket),
    tile(queda != null ? mxn(queda) : '—', T('Te queda', 'You keep'), T(`Después de gastos, ofrenda y SAT`, 'After expenses, tithe and taxes'), queda != null && queda < 0 ? 'mal' : 'ok'),
    // El presupuesto es el de HOY: contra un mes pasado no dice nada.
    tile(mxn(k.gasto), T('Gasto en pauta', 'Ad spend'), d.periodo.es_actual ? `${T('de', 'of')} ${mxn(k.presupuesto_mes)} ${T('del mes', 'this month')}` : null),
    tile(num(k.leads.pauta), T('Leads de pauta', 'Leads from ads'),
      k.costo_lead_pauta != null ? T(`${mxn(k.costo_lead_pauta)} por lead`, `${mxn(k.costo_lead_pauta)} per lead`) : (conv != null ? T(`Meta contó ${num(conv)} conversaciones`, `Meta counted ${num(conv)} conversations`) : T('Aún sin leads de pauta', 'No leads from ads yet'))),
    tile(num(k.leads.seo), T('Leads de SEO', 'Leads from SEO'), T('Google y el sitio web', 'Google and the website')),
    tile(k.costo_sesion_pauta != null ? mxn(k.costo_sesion_pauta) : '—', T('Costo por sesión de pauta', 'Cost per session from ads'),
      k.costo_sesion_pauta != null ? T(`${num(k.ventas.pauta)} ${k.ventas.pauta === 1 ? 'sesión' : 'sesiones'} de pauta`, `${num(k.ventas.pauta)} from ads`) : T('Aún sin sesiones de pauta', 'No sessions from ads yet')),
  ]);
}

// Una o dos frases que dicen qué significan los números, sin tecnicismos.
function lectura(d) {
  const k = d.kpis;
  const frases = [];
  if (k.ingresos_mxn > 0) {
    frases.push(T(
      `Este mes entraron ${mxn(k.ingresos_mxn)}: ${mxn(k.ingresos_sesiones_mxn)} de sesiones y ${mxn(k.ingresos_marcas_mxn)} de marcas.`,
      `This month ${mxn(k.ingresos_mxn)} came in: ${mxn(k.ingresos_sesiones_mxn)} from sessions and ${mxn(k.ingresos_marcas_mxn)} from brands.`,
    ));
    if (k.queda_mxn != null) {
      frases.push(k.queda_mxn >= 0
        ? T(`Quitando gastos (${mxn(k.gastos_mxn)}), ofrenda (${mxn(k.ofrenda_mxn)}) y SAT (${mxn(k.sat_mxn)}), te quedan ${mxn(k.queda_mxn)}.`,
          `After expenses (${mxn(k.gastos_mxn)}), tithe (${mxn(k.ofrenda_mxn)}) and taxes (${mxn(k.sat_mxn)}), you keep ${mxn(k.queda_mxn)}.`)
        : T(`Este mes todavía faltan ${mxn(-k.queda_mxn)} para cubrir gastos, ofrenda y SAT.`,
          `This month is still ${mxn(-k.queda_mxn)} short of covering expenses, tithe and taxes.`));
    }
  }
  const ticketMxn = k.ticket_mxn != null ? k.ticket_mxn : k.ticket_hist_mxn;
  if (d.periodo.es_actual && k.sesiones_para_pagar != null && ticketMxn) {
    frases.push(k.sesiones_para_pagar <= 1
      ? T(
        `Una sesión te deja ${mxn(ticketMxn)}: con una sola al mes pagas los ${mxn(k.presupuesto_mes)} de pauta.`,
        `A session brings ${mxn(ticketMxn)}: a single one a month pays for ${mxn(k.presupuesto_mes)} of ads.`,
      )
      : T(
        `Una sesión te deja ${mxn(ticketMxn)}: se necesitan ${Math.ceil(k.sesiones_para_pagar)} al mes para pagar los ${mxn(k.presupuesto_mes)} de pauta.`,
        `A session brings ${mxn(ticketMxn)}: it takes ${Math.ceil(k.sesiones_para_pagar)} a month to pay for ${mxn(k.presupuesto_mes)} of ads.`,
      ));
  }
  if (k.retorno_pauta === 0) {
    frases.push(T(
      `La pauta de este mes (${mxn(k.gasto)}) todavía no trajo ninguna sesión cerrada.`,
      `This month's ads (${mxn(k.gasto)}) haven't brought a closed session yet.`,
    ));
  } else if (k.retorno_pauta != null) {
    frases.push(T(
      `Por cada peso de pauta regresaron ${k.retorno_pauta.toLocaleString(LOC, { maximumFractionDigits: 1 })} pesos en sesiones.`,
      `Every peso spent on ads brought back ${k.retorno_pauta.toLocaleString(LOC, { maximumFractionDigits: 1 })} pesos in sessions.`,
    ));
  }
  if (k.leads.sin_definir) {
    frases.push(T(
      `${k.leads.sin_definir} ${k.leads.sin_definir === 1 ? 'lead no tiene' : 'leads no tienen'} fuente: toca "¿De dónde?" para que cuenten bien.`,
      `${k.leads.sin_definir} ${k.leads.sin_definir === 1 ? 'lead has' : 'leads have'} no source: tap "Where from?" so the numbers add up.`,
    ));
  }
  if (!frases.length) return null;
  return el('section', { class: 'adm-lectura' }, frases.map((f) => el('p', { text: f })));
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
  const { cfg, kpis: k } = d;
  const gastos = cfg.gastos || [];
  const linea = (txt, valor, clase) => el('div', { class: 'adm-queda__fila' + (clase ? ` ${clase}` : '') }, [el('span', { text: txt }), el('span', { class: 'adm-queda__v', text: valor })]);
  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T('Lo que queda del mes', 'What is left this month') }),
      el('button', { class: 'btn btn-sm', type: 'button', text: T('Editar gastos', 'Edit expenses'), onclick: editarGastos }),
    ]),
    el('ul', { class: 'adm-gastos' }, gastos.map((g) => el('li', {}, [el('span', { text: g.nombre }), el('span', { class: 'adm-gastos__m', text: mxn(g.monto) })]))),
    !gastos.length ? el('p', { class: 'adm-vacio', text: T('Sin gastos fijos anotados.', 'No fixed expenses yet.') }) : null,
    el('div', { class: 'adm-queda' }, [
      linea(T('Ingresos', 'Income'), mxn(k.ingresos_mxn)),
      linea(T('Gastos fijos', 'Fixed expenses'), `− ${mxn(k.gastos_mxn)}`),
      linea(T(`Ofrenda (${num(cfg.ofrenda_pct)}%)`, `Tithe (${num(cfg.ofrenda_pct)}%)`), `− ${mxn(k.ofrenda_mxn)}`),
      linea(T(`SAT estimado (${num(cfg.sat_pct)}%)`, `Taxes, estimate (${num(cfg.sat_pct)}%)`), `− ${mxn(k.sat_mxn)}`),
      linea(T('Te queda', 'You keep'), mxn(k.queda_mxn), 'adm-queda__total' + (k.queda_mxn < 0 ? ' is-mal' : '')),
    ]),
    el('p', { class: 'adm-nota', text: T('El SAT es un estimado (RESICO): el número real lo da tu contador.', 'Taxes are an estimate (RESICO): your accountant has the real number.') }),
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
  link.href = '/marketing/css/administracion.css?v=202611060053';
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
