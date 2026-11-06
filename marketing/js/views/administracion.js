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
import { api, el, clear } from '../api.js?v=202611060033';
import { icon, iconMarca } from '../shell/icons.js?v=202611060033';
import { T, isEN } from '../shell/i18n.js?v=202611060033';
import { toast } from '../shell/toast.js?v=202611060033';

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
function numeros(d) {
  const k = d.kpis;
  const tc = Number(d.cfg.tipo_cambio) || 0;
  const tile = (valor, etiqueta, sub, tono) => el('div', { class: 'adm-kpi' + (tono ? ` adm-kpi--${tono}` : '') }, [
    el('div', { class: 'adm-kpi__v', text: valor }),
    el('div', { class: 'adm-kpi__k', text: etiqueta }),
    sub ? el('div', { class: 'adm-kpi__s', text: sub }) : null,
  ]);
  const ticket = k.ticket_usd != null ? k.ticket_usd : k.ticket_ref_usd;
  const subTicket = k.ticket_usd != null
    ? `≈ ${mxn(k.ticket_usd * tc)} · ${T(`${k.ticket_n} ${k.ticket_n === 1 ? 'sesión' : 'sesiones'}`, `${k.ticket_n} ${k.ticket_n === 1 ? 'session' : 'sessions'}`)}`
    : T('Referencia: 44 sesiones reales (oct-2025 a oct-2026)', 'Reference: 44 real sessions (Oct 2025 to Oct 2026)');
  const conv = d.pauta && d.pauta.conversaciones;
  return el('section', { class: 'adm-kpis' }, [
    // El presupuesto es el de HOY: contra un mes pasado no dice nada.
    tile(mxn(k.gasto), T('Gasto en pauta', 'Ad spend'), d.periodo.es_actual ? `${T('de', 'of')} ${mxn(k.presupuesto_mes)} ${T('del mes', 'this month')}` : null, 'brand'),
    tile(num(k.leads.pauta), T('Leads de pauta', 'Leads from ads'), conv != null ? T(`Meta contó ${num(conv)} conversaciones`, `Meta counted ${num(conv)} conversations`) : null),
    tile(num(k.leads.seo), T('Leads de SEO', 'Leads from SEO'), T('Google y el sitio web', 'Google and the website')),
    tile(num(k.ventas.total), T('Sesiones cerradas', 'Closed sessions'), T(`De pauta: ${num(k.ventas.pauta)}`, `From ads: ${num(k.ventas.pauta)}`)),
    tile(k.costo_lead_pauta != null ? mxn(k.costo_lead_pauta) : '—', T('Costo por lead', 'Cost per lead'),
      k.costo_lead_pauta != null ? T('de pauta', 'from ads') : T('Aún sin leads de pauta', 'No leads from ads yet')),
    tile(k.costo_sesion_pauta != null ? mxn(k.costo_sesion_pauta) : '—', T('Costo por sesión cerrada', 'Cost per closed session'),
      k.costo_sesion_pauta != null ? T('de pauta', 'from ads') : T('Aún sin sesiones de pauta', 'No sessions from ads yet')),
    tile(ticket != null ? usd(ticket) : '—', T('Ticket promedio', 'Average ticket'), subTicket),
    tile(usd(k.ingresos_usd), T('Ventas del mes', 'Sales this month'), k.ingresos_usd ? `≈ ${mxn(k.ingresos_usd * tc)}` : null),
  ]);
}

// Una o dos frases que dicen qué significan los números, sin tecnicismos.
function lectura(d) {
  const k = d.kpis;
  const frases = [];
  const ticket = k.ticket_usd != null ? k.ticket_usd : k.ticket_ref_usd;
  if (d.periodo.es_actual && k.sesiones_para_pagar != null && ticket) {
    frases.push(k.sesiones_para_pagar <= 1
      ? T(
        `Con un ticket de ${usd(ticket)}, una sola sesión al mes paga los ${mxn(k.presupuesto_mes)} de pauta.`,
        `With a ${usd(ticket)} ticket, a single session a month pays for ${mxn(k.presupuesto_mes)} of ads.`,
      )
      : T(
        `Con un ticket de ${usd(ticket)}, se necesitan ${Math.ceil(k.sesiones_para_pagar)} sesiones al mes para pagar los ${mxn(k.presupuesto_mes)} de pauta.`,
        `With a ${usd(ticket)} ticket, it takes ${Math.ceil(k.sesiones_para_pagar)} sessions a month to pay for ${mxn(k.presupuesto_mes)} of ads.`,
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

// ── Sesiones cerradas ───────────────────────────────────────────────────────
function seccionVentas(d) {
  const ventas = d.ventas || [];
  const lista = el('ul', { class: 'adm-lista' }, ventas.map((v) => el('li', {}, [el('button', {
    class: 'adm-fila adm-fila--btn', type: 'button', onclick: () => editarVenta(v),
  }, [
    el('span', { class: 'adm-fila__ico' }, [icon(v.origen === 'juan' ? 'calendar' : 'check', 18)]),
    el('div', { class: 'adm-fila__main' }, [
      el('div', { class: 'adm-fila__top' }, [
        el('span', { class: 'adm-fila__n', text: v.cliente || '—' }),
        el('span', { class: 'adm-fila__p' + (v.precio > 0 ? '' : ' adm-fila__p--falta'), text: v.precio > 0 ? usd(v.precio) : T('Falta precio', 'Missing price') }),
      ]),
      el('div', { class: 'adm-fila__sub', text: [
        v.paquete || T('Sin paquete', 'No package'),
        v.fecha_sesion ? `${T('sesión', 'session')} ${diaCorto(v.fecha_sesion)}` : null,
        v.origen === 'juan' ? T('reserva de Juan', "Juan's booking") : null,
      ].filter(Boolean).join(' · ') }),
    ]),
    el('span', { class: `adm-fuente adm-fuente--${v.fuente || 'falta'} adm-fuente--fija`, text: nombreFuente(v.fuente) }),
  ])])));

  return el('section', { class: 'adm-sec' }, [
    el('div', { class: 'adm-sec__head' }, [
      el('div', { class: 'adm-sec__t', text: T(`Sesiones cerradas · ${ventas.length}`, `Closed sessions · ${ventas.length}`) }),
      el('button', { class: 'btn btn-sm', type: 'button', onclick: () => editarVenta(null) }, [icon('plus', 16), el('span', { text: T('Sesión', 'Session') })]),
    ]),
    el('p', { class: 'adm-nota', text: T(
      'Las reservas de Juan entran solas. Cuenta el día en que se cerró, no el de la sesión.',
      "Juan's bookings come in on their own. It counts the day it closed, not the session day.",
    ) }),
    ventas.length ? lista : el('p', { class: 'adm-vacio', text: T('Todavía no hay sesiones cerradas este mes.', 'No closed sessions this month yet.') }),
    d.ocultas ? el('p', { class: 'adm-nota', text: T(
      `${d.ocultas} no ${d.ocultas === 1 ? 'cuenta' : 'cuentan'} (canceladas, pruebas o marcadas "no cuenta").`,
      `${d.ocultas} not counted (cancelled, tests or marked "doesn't count").`,
    ) }) : null,
  ]);
}

function editarVenta(v) {
  const nueva = !v;
  const paquetes = (data && data.cfg && data.cfg.paquetes) || [];
  ctx.sheet.openSheet({
    title: nueva ? T('Sesión cerrada', 'Closed session') : (v.cliente || T('Sesión', 'Session')), mode: 'form',
    build(body, close) {
      const cliente = el('input', { class: 'input', value: (v && v.cliente) || '', placeholder: T('Nombre del cliente', 'Client name'), maxlength: '120', autocomplete: 'off' });
      const enCatalogo = v && v.paquete && paquetes.some((p) => p.nombre === v.paquete);
      const paquete = el('select', { class: 'select' }, [
        el('option', { value: '', text: T('Elige el paquete', 'Pick the package') }),
        ...paquetes.map((p) => el('option', { value: p.nombre, text: `${p.nombre} · ${usd(p.precio)}`, selected: !!(v && v.paquete === p.nombre) })),
        v && v.paquete && !enCatalogo ? el('option', { value: v.paquete, text: v.paquete, selected: true }) : null,
        el('option', { value: '__otro', text: T('Otro (escribe el precio)', 'Other (type the price)') }),
      ]);
      const precio = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: v && v.precio != null ? String(v.precio) : '', placeholder: 'USD' });
      paquete.addEventListener('change', () => {
        const p = paquetes.find((x) => x.nombre === paquete.value);
        if (p) precio.value = String(p.precio);
        if (paquete.value === '__otro') { precio.value = ''; precio.focus(); }
      });
      const fuente = selectFuente(v ? v.fuente : '', true);
      const fecha = el('input', { class: 'input', type: 'date', value: (v && v.fecha) || hoyCancun() });
      const fechaSesion = el('input', { class: 'input', type: 'date', value: (v && v.fecha_sesion) || '' });

      const ok = el('button', { class: 'btn btn-primary', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
        if (!cliente.value.trim()) { cliente.focus(); return; }
        const cuerpo = {
          cliente: cliente.value,
          paquete: paquete.value === '__otro' ? null : (paquete.value || null),
          precio: precio.value === '' ? null : Number(precio.value),
          fuente: fuente.value || null,
          fecha: fecha.value,
          fecha_sesion: fechaSesion.value || null,
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
        campo(T('Cliente', 'Client'), cliente),
        el('div', { class: 'adm-dos' }, [campo(T('Paquete', 'Package'), paquete), campo(T('Precio (USD)', 'Price (USD)'), precio)]),
        campo(T('¿De dónde llegó?', 'Where did they come from?'), fuente),
        el('div', { class: 'adm-dos' }, [campo(T('Día que se cerró', 'Day it closed'), fecha), campo(T('Día de la sesión', 'Session day'), fechaSesion)]),
        v && v.notas ? el('p', { class: 'adm-nota', text: v.notas }) : null,
        el('div', { class: 'adm-btns' }, [quitar, el('span', { class: 'adm-btns__sep' }), el('button', { class: 'btn btn-ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ force: true }) }), ok]),
      );
      if (nueva) setTimeout(() => { try { cliente.focus(); } catch { /* noop */ } }, 80);
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
  link.href = '/marketing/css/administracion.css?v=202611060033';
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
