// ============================================================================
// IVAE Marketing — Bandeja · CRM: EMBUDO, OPORTUNIDADES Y TAREAS.
//
// Pedido de SMILE NOW (15-oct-2026, Sebastián vía Israel, con capturas de su
// CRM actual): "algo así que muestre en cuál etapa están" y "en cada
// oportunidad tengamos los campos para documentar planes de tratamiento, se
// registren los puntos de contacto y deje generar tareas". Israel: "hazlo muy
// profesional".
//
// · EMBUDO (pestaña de la Bandeja): tablero por etapa con cuántas
//   oportunidades y cuánto dinero hay en cada columna. Cada tarjeta dice su
//   valor, su próxima tarea (roja si ya se venció) y la cita. En escritorio se
//   arrastran entre columnas; en el teléfono las columnas se deslizan y una
//   barra de etapas salta entre ellas. Vista "Tareas": lo que toca hacer,
//   lo vencido primero.
// · OPORTUNIDAD (hoja ancha en escritorio, casi pantalla completa en el
//   teléfono): barra de etapas, datos, valor, cita, motivo de pérdida, PLAN DE
//   TRATAMIENTO por partidas, tareas e HISTORIAL de puntos de contacto
//   (mensajes por día, llamadas, cambios de etapa, tareas, comentarios).
//
// La conversación ES la oportunidad (backend: _bandeja.js, migración 044).
// Las horas se muestran y se capturan en hora de Cancún (UTC-5 todo el año),
// sin importar la zona del aparato.
// ============================================================================
import { api, el, clear, timeAgo, initials } from '../api.js?v=202610151733';
import { toast } from '../shell/toast.js?v=202610151733';
import { icon } from '../shell/icons.js?v=202610151733';
import { T, isEN } from '../shell/i18n.js?v=202610151733';

// Dependencias que pone bandeja.js al montar (estado de la Bandeja, colores,
// formatos y acciones del chat). Ver conectarCRM() en bandeja.js.
let d = null;
export function conectarCRM(deps) { d = deps; }

// ── Estado del embudo ────────────────────────────────────────────────────────
let vista = 'tablero';         // 'tablero' | 'tareas'
let filas = null;              // oportunidades (null = sin cargar)
let errorEmbudo = null;
let tareas = null;             // tareas de la marca (vista Tareas)
let verHechas = false;
let busq = '';
let resp = '';                 // '' | 'yo' | 'sin' | id de agente
let firma = '';                // el refresco silencioso solo repinta si algo cambió
let cargando = false;
let hostEl = null, segEl = null, buscarEl = null, menusEl = null, contEl = null;
let dndOff = null;
let colMovil = 0;              // columna visible en el teléfono
let ultimoArrastre = 0;
const COLS_ABIERTAS = new Set(); // columnas con "ver todas" abierto
const POR_COLUMNA = 40;
let abierta = null;            // { id, recargar } de la oportunidad abierta
let catalogo = null;           // { lista, editable } por marca

export function reiniciarCRM() {
  filas = null; tareas = null; errorEmbudo = null; busq = ''; resp = ''; firma = ''; colMovil = 0;
  COLS_ABIERTAS.clear(); catalogo = null;
}

// ── Fechas en hora de Cancún ─────────────────────────────────────────────────
const H = 36e5;
const msUtc = (s) => { const t = Date.parse(String(s || '').replace(' ', 'T').slice(0, 19) + 'Z'); return isNaN(t) ? NaN : t; };
const isoCun = (ms) => new Date(ms - 5 * H).toISOString();
const hoyCun = () => isoCun(Date.now()).slice(0, 10);
const masDias = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function aCancun(utc) {
  const t = msUtc(utc);
  if (isNaN(t)) return null;
  const x = isoCun(t);
  return { fecha: x.slice(0, 10), hora: x.slice(11, 16) };
}
// Fecha y hora de Cancún -> 'AAAA-MM-DD HH:MM' UTC (lo que guarda el servidor).
function aUtc(fecha, hora) {
  const t = Date.parse(`${fecha}T${hora || '09:00'}:00Z`);
  return isNaN(t) ? null : new Date(t + 5 * H).toISOString().slice(0, 16).replace('T', ' ');
}
const DIAS = isEN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = isEN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDia(ymd) {
  const h = hoyCun();
  if (ymd === h) return T('Hoy', 'Today');
  if (ymd === masDias(h, 1)) return T('Mañana', 'Tomorrow');
  if (ymd === masDias(h, -1)) return T('Ayer', 'Yesterday');
  const x = new Date(ymd + 'T12:00:00Z');
  if (isNaN(x)) return ymd;
  const anio = ymd.slice(0, 4) !== h.slice(0, 4) ? ' ' + ymd.slice(0, 4) : '';
  return isEN ? `${DIAS[x.getUTCDay()]} ${MESES[x.getUTCMonth()]} ${x.getUTCDate()}${anio}` : `${DIAS[x.getUTCDay()]} ${x.getUTCDate()} ${MESES[x.getUTCMonth()]}${anio}`;
}
const fmtHora = (hhmm) => String(hhmm || '').slice(0, 5);
// Vencimiento de una tarea (UTC) -> "Hoy 16:00".
function fmtVence(utc) { const c = aCancun(utc); return c ? `${fmtDia(c.fecha)} ${c.hora}` : ''; }
// Cita (ya en hora de Cancún 'AAAA-MM-DD HH:MM') -> "jue 16 oct · 11:00".
function fmtCita(s) { const [f, h] = String(s || '').split(' '); return f ? `${fmtDia(f)} · ${fmtHora(h)}` : ''; }
function fmtMomento(utc) { const c = aCancun(utc); return c ? `${fmtDia(c.fecha)} · ${c.hora}` : ''; }
// 'vencida' | 'hoy' | 'futura' | 'sin'
function estadoVence(utc) {
  const t = msUtc(utc);
  if (isNaN(t)) return 'sin';
  if (t < Date.now()) return 'vencida';
  return aCancun(utc).fecha === hoyCun() ? 'hoy' : 'futura';
}
// "3 d en la etapa": cuánto lleva la oportunidad sin moverse.
function enEtapa(utc) {
  const t = msUtc(utc);
  if (isNaN(t)) return '';
  const min = Math.max(0, (Date.now() - t) / 6e4);
  if (min < 60) return T('recién llegó a esta etapa', 'just moved to this stage');
  if (min < 1440) return T(`${Math.floor(min / 60)} h en esta etapa`, `${Math.floor(min / 60)} h in this stage`);
  const dd = Math.floor(min / 1440);
  return T(`${dd} ${dd === 1 ? 'día' : 'días'} en esta etapa`, `${dd} ${dd === 1 ? 'day' : 'days'} in this stage`);
}
const mayus = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const citaPasada = (s) => { const [f, h] = String(s || '').split(' '); const u = f ? aUtc(f, fmtHora(h)) : null; return u ? msUtc(u) < Date.now() : false; };

// ── Dinero ───────────────────────────────────────────────────────────────────
function fmtDinero(n, moneda = 'MXN') {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '';
  const v = Number(n);
  const txt = v.toLocaleString(isEN ? 'en-US' : 'es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return (moneda === 'USD' ? 'US$' : '$') + txt;
}
// Suma por moneda: "$312,400 · US$1,200".
function fmtTotales(lista) {
  const s = { MXN: 0, USD: 0 };
  for (const v of lista) if (v.valor_estimado != null) s[v.moneda === 'USD' ? 'USD' : 'MXN'] += Number(v.valor_estimado) || 0;
  return [s.MXN ? fmtDinero(s.MXN, 'MXN') : '', s.USD ? fmtDinero(s.USD, 'USD') : ''].filter(Boolean).join(' · ');
}
const numero = (s) => { const t = String(s ?? '').replace(/[,\s$]/g, '').replace(/^US/i, ''); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
function totalPlan(plan, estados = null) {
  if (!plan || !Array.isArray(plan.items)) return 0;
  return plan.items
    .filter((i) => (estados ? estados.includes(i.estado) : i.estado !== 'rechazado'))
    .reduce((s, i) => s + (Number(numero(i.precio)) || 0), 0);
}

// ── Catálogos de la vista ────────────────────────────────────────────────────
const TIPOS = [
  ['llamada', 'phone', () => T('Llamada', 'Call'), () => T('Ej. Confirmar la cita', 'E.g. Confirm the visit')],
  ['mensaje', 'chat', () => T('Mensaje', 'Message'), () => T('Ej. Mandar presupuesto', 'E.g. Send the quote')],
  ['cita', 'calendar', () => T('Cita', 'Visit'), () => T('Ej. Valoración', 'E.g. Assessment')],
  ['seguimiento', 'clock', () => T('Seguimiento', 'Follow-up'), () => T('Ej. ¿Ya lo decidió?', 'E.g. Decided yet?')],
];
const TIPO = Object.fromEntries(TIPOS.map(([k, ico, txt, ej]) => [k, { ico, txt, ej }]));
const PARTIDAS = [
  ['propuesto', () => T('Propuesto', 'Proposed'), '#a1a1aa'],
  ['aceptado', () => T('Aceptado', 'Accepted'), 'var(--brand)'],
  ['realizado', () => T('Realizado', 'Done'), 'var(--text)'],
  ['rechazado', () => T('Rechazado', 'Declined'), '#c0352b'],
];
const PARTIDA = Object.fromEntries(PARTIDAS.map(([k, txt, color]) => [k, { txt, color }]));
const MOTIVOS = [
  () => T('El precio', 'The price'),
  () => T('Eligió otra clínica', 'Chose another clinic'),
  () => T('Dejó de contestar', 'Stopped replying'),
  () => T('Solo pedía informes', 'Only asking for info'),
  () => T('No es candidato al tratamiento', 'Not a candidate for the treatment'),
  () => T('Lo dejó para más adelante', 'Postponed it'),
];
const ABIERTAS = ['nuevo', 'platica', 'cotizado', 'cita'];
const etq = (k) => (d.ETAPA_TXT[k] ? d.ETAPA_TXT[k]() : (k || ''));
const primerNombre = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const clonar = (x) => JSON.parse(JSON.stringify(x));
// Campo de texto que crece con su contenido (sin barra ni texto escondido).
function crecer(ta) { if (!ta || !ta.isConnected) return; ta.style.height = 'auto'; ta.style.height = Math.max(44, ta.scrollHeight + 2) + 'px'; }
// append() pinta la palabra "null" si recibe null: siempre por aquí.
const poner = (nodo, ...hijos) => nodo.append(...hijos.filter((h) => h !== null && h !== undefined && h !== false));
const rid = () => Math.random().toString(36).slice(2, 10);
function nombreDeTarea(t) {
  return t.conv_nombre || (t.conv_username ? '@' + t.conv_username : (t.conv_canal === 'whatsapp' && t.conv_contacto ? d.fmtTelUI('+' + t.conv_contacto) : T('Paciente', 'Patient')));
}

// ── Texto de un evento del CRM (lo usa también el chat) ──────────────────────
export function textoEvento(e) {
  const x = e.dato || {};
  const quien = e.user_nombre || T('Alguien', 'Someone');
  const tt = `“${x.titulo || ''}”`;
  switch (e.tipo) {
    case 'etapa':
      return T(`${quien} movió a ${etq(x.a)}`, `${quien} moved it to ${etq(x.a)}`)
        + (x.de ? T(` (antes: ${etq(x.de)})`, ` (was: ${etq(x.de)})`) : '') + (x.motivo ? ` · ${x.motivo}` : '');
    case 'tarea':
      if (x.accion === 'hecha') return T(`${quien} completó la tarea ${tt}`, `${quien} completed the task ${tt}`);
      if (x.accion === 'reabierta') return T(`${quien} reabrió la tarea ${tt}`, `${quien} reopened the task ${tt}`);
      if (x.accion === 'reprogramada') return T(`${quien} reprogramó ${tt}`, `${quien} rescheduled ${tt}`) + (x.vence_en ? ` · ${fmtVence(x.vence_en)}` : '');
      if (x.accion === 'reasignada') return T(`${quien} pasó ${tt} a ${x.para}`, `${quien} handed ${tt} to ${x.para}`);
      if (x.accion === 'borrada') return T(`${quien} borró la tarea ${tt}`, `${quien} deleted the task ${tt}`);
      if (x.accion === 'canceladas') return x.n === 1 ? T('Se canceló su tarea pendiente al marcarlo como perdido', 'Its pending task was cancelled when marked as lost') : T(`Se cancelaron sus ${x.n} tareas pendientes al marcarlo como perdido`, `Its ${x.n} pending tasks were cancelled when marked as lost`);
      return T(`${quien} creó la tarea ${tt}`, `${quien} created the task ${tt}`)
        + (x.para && x.para !== quien ? T(` para ${x.para}`, ` for ${x.para}`) : '')
        + (x.vence_en ? T(` · vence ${fmtVence(x.vence_en)}`, ` · due ${fmtVence(x.vence_en)}`) : '');
    case 'plan':
      return T(`${quien} actualizó el plan de tratamiento`, `${quien} updated the treatment plan`)
        + (x.n ? ` · ${x.n} ${x.n === 1 ? T('tratamiento', 'treatment') : T('tratamientos', 'treatments')}` : '')
        + (x.total ? ` · ${fmtDinero(x.total, x.moneda)}` : '');
    case 'cita':
      if (!x.a) return T(`${quien} quitó la cita`, `${quien} removed the appointment`);
      return x.de ? T(`${quien} cambió la cita a ${fmtCita(x.a)}`, `${quien} moved the appointment to ${fmtCita(x.a)}`)
        : T(`${quien} agendó la cita: ${fmtCita(x.a)}`, `${quien} booked the appointment: ${fmtCita(x.a)}`);
    case 'nota':
      return T(`${quien}: ${x.texto || ''}`, `${quien}: ${x.texto || ''}`);
    default:
      return null;
  }
}
export function iconoEvento(tipo, dato) {
  if (tipo === 'tarea') return dato && dato.accion === 'hecha' ? 'check' : 'tasks';
  return ({ etapa: 'sliders', plan: 'activity', cita: 'calendar', nota: 'edit', llamada: 'phone', asignacion: 'users', reasignacion: 'users', tomada: 'user' })[tipo] || 'info';
}

// ── Carga ────────────────────────────────────────────────────────────────────
export async function cargarCRM({ silencioso = false } = {}) {
  const id = d.cid();
  if (!id || (cargando && silencioso)) return;
  cargando = true;
  try {
    if (vista === 'tareas') {
      const qs = new URLSearchParams({ client_id: id });
      if (verHechas) qs.set('estado', 'hecha');
      if (resp && resp !== 'sin') qs.set('asignado', resp);
      tareas = (await api.get(`/bandeja/tareas?${qs}`)).tareas || [];
    } else {
      const qs = new URLSearchParams({ client_id: id });
      if (resp) qs.set('asignado', resp);
      if (busq) qs.set('q', busq);
      filas = (await api.get(`/bandeja/embudo?${qs}`)).oportunidades || [];
      errorEmbudo = null;
    }
  } catch (e) {
    if (vista !== 'tareas') errorEmbudo = e.message;
    else if (tareas === null) tareas = [];
    if (!silencioso) toast(e.message, { type: 'error' });
  }
  cargando = false;
  const nueva = JSON.stringify([vista, verHechas, resp, busq, filas, tareas, errorEmbudo]);
  // Mientras se arrastra una tarjeta, el refresco no repinta (soltaría el arrastre).
  if (silencioso && (nueva === firma || document.querySelector('.dnd-ghost'))) return;
  firma = nueva;
  pintarContenido();
}

// Tras cualquier cambio: la oportunidad abierta, el tablero y la Bandeja.
function trasCambio(convId) {
  if (abierta && abierta.id === convId) abierta.recargar();
  if (hostEl && hostEl.isConnected) cargarCRM({ silencioso: true });
  d.alCambiar(convId);
}

// ── Pestaña EMBUDO ───────────────────────────────────────────────────────────
export function panelEmbudo() {
  segEl = el('div', { class: 'seg bj-emb__seg', role: 'tablist', 'aria-label': T('Vista del embudo', 'Pipeline view') });
  const inp = el('input', {
    class: 'bj-buscar__in', type: 'search', enterkeyhint: 'search', autocomplete: 'off', id: 'bj-emb-buscar',
    placeholder: T('Buscar paciente', 'Search patient'), 'aria-label': T('Buscar', 'Search'), value: busq,
    oninput: (e) => { busq = e.target.value.trim(); clearTimeout(inp._t); inp._t = setTimeout(() => cargarCRM(), 350); },
  });
  buscarEl = el('label', { class: 'bj-buscar bj-emb__buscar' }, [icon('search', 17), inp]);
  menusEl = el('div', { class: 'bj-emb__menus' });
  contEl = el('div', { class: 'bj-emb__cont' });
  hostEl = el('div', { class: 'bj-emb' }, [
    el('div', { class: 'bj-emb__barra' }, [segEl, el('div', { class: 'bj-emb__filtros' }, [buscarEl, menusEl])]),
    contEl,
  ]);
  pintarBarra();
  pintarContenido(true);
  return hostEl;
}

export function pintarBarra() {
  if (!segEl) return;
  clear(segEl);
  const r = d.resumen();
  const nHoy = r && r.tareas_hoy ? r.tareas_hoy : 0;
  poner(segEl, 
    el('button', { type: 'button', role: 'tab', 'data-vista': 'tablero', class: vista === 'tablero' ? 'is-active' : '', 'aria-selected': String(vista === 'tablero'), onclick: () => cambiarVista('tablero') }, [icon('board', 15), el('span', { text: T('Tablero', 'Board') })]),
    el('button', { type: 'button', role: 'tab', 'data-vista': 'tareas', class: vista === 'tareas' ? 'is-active' : '', 'aria-selected': String(vista === 'tareas'), onclick: () => cambiarVista('tareas') }, [
      icon('tasks', 15), el('span', { text: T('Tareas', 'Tasks') }), nHoy ? el('span', { class: 'bj-seg__n', 'aria-label': T(`${nHoy} para hoy o vencidas`, `${nHoy} due today or overdue`), text: String(nHoy) }) : null,
    ].filter(Boolean)),
  );
  buscarEl.hidden = vista === 'tareas';
  clear(menusEl);
  const agentes = d.equipoAgentes();
  if (d.esSupervisor() && agentes.length) {
    const yo = d.yoMe().id;
    const ops = [
      { value: '', label: vista === 'tareas' ? T('Las de todo el equipo', 'The whole team') : T('Todo el equipo', 'The whole team'), icon: icon('users', 18), current: !resp },
      { value: 'yo', label: T('Las mías', 'Mine'), icon: icon('user', 18), current: resp === 'yo' },
      ...(vista === 'tablero' ? [{ value: 'sin', label: T('Sin asignar', 'Unassigned'), icon: icon('inbox', 18), current: resp === 'sin' }] : []),
      ...agentes.filter((a) => a.id !== yo).map((a) => ({ value: a.id, label: a.nombre, icon: icon('user', 18), current: resp === a.id })),
    ];
    const actual = ops.find((o) => o.value === resp) || ops[0];
    menusEl.append(d.menuFiltro({
      titulo: T('Responsable', 'Owner'), hoja: T('¿De quién?', 'Whose?'),
      valor: resp ? actual.label : T('Todos', 'Everyone'), activo: !!resp,
      opciones: () => ops,
      alElegir: (k) => { resp = k; pintarBarra(); cargarCRM(); },
    }));
  }
  menusEl.hidden = !menusEl.childElementCount;
}

function cambiarVista(v) {
  if (vista === v) return;
  vista = v;
  if (v === 'tablero' && resp === 'sin') resp = '';
  pintarBarra();
  pintarContenido(true);
  cargarCRM();
}

function pintarContenido(forzar = false) {
  if (!contEl || (!forzar && !contEl.isConnected)) return;
  // El repintado conserva dónde estaba cada columna (horizontal y vertical).
  const tab = contEl.querySelector('.bj-tablero');
  const sx = tab ? tab.scrollLeft : null;
  const sy = {};
  contEl.querySelectorAll('.bj-col').forEach((c) => { sy[c.dataset.etapa] = c.querySelector('.bj-col__cards').scrollTop; });
  if (dndOff) { dndOff(); dndOff = null; }
  clear(contEl);
  contEl.className = 'bj-emb__cont is-' + vista;
  if (vista === 'tareas') { contEl.appendChild(vistaTareas()); return; }
  contEl.append(...vistaTablero());
  const t2 = contEl.querySelector('.bj-tablero');
  if (!t2) return;
  requestAnimationFrame(() => {
    if (sx != null) t2.scrollLeft = sx;
    else if (colMovil) irAColumna(colMovil, false);
    t2.querySelectorAll('.bj-col').forEach((c) => { const y = sy[c.dataset.etapa]; if (y) c.querySelector('.bj-col__cards').scrollTop = y; });
  });
  conectarArrastre(t2);
}

function vistaTablero() {
  if (errorEmbudo && !filas) return [el('div', { class: 'bj-emb__vacio' }, [icon('warning', 26), el('p', { text: errorEmbudo })])];
  if (filas === null) return [el('div', { class: 'bj-cargando' }, [el('span', { class: 'spinner' })])];
  const porEtapa = Object.fromEntries(d.ETAPAS.map((k) => [k, []]));
  for (const v of filas) (porEtapa[v.etapa] || porEtapa.nuevo).push(v);
  // Dentro de la columna: primero lo que tiene una tarea vencida, luego lo más reciente.
  const vencida = (v) => (v.proxima_tarea && v.proxima_tarea.vence_en && estadoVence(v.proxima_tarea.vence_en) === 'vencida' ? 1 : 0);
  for (const k of d.ETAPAS) porEtapa[k].sort((a, b) => (vencida(b) - vencida(a)) || String(b.ultimo_en || '').localeCompare(String(a.ultimo_en || '')));

  // Indicadores: lo que el dueño quiere ver de un vistazo.
  const abiertas = filas.filter((v) => ABIERTAS.includes(v.etapa));
  const hoy = hoyCun();
  const en7 = masDias(hoy, 7);
  const citas = filas.filter((v) => v.fecha_cita && v.etapa !== 'perdido' && v.fecha_cita.slice(0, 10) >= hoy && v.fecha_cita.slice(0, 10) <= en7 && !citaPasada(v.fecha_cita)).length;
  // Tareas vencidas (no pacientes): el mismo número que el grupo "Vencidas" de la vista Tareas.
  const vencidas = filas.reduce((n, v) => n + (Number(v.tareas_vencidas) || 0), 0);
  const sinPaso = abiertas.filter((v) => !Number(v.tareas_pend)).length;
  // El que se puede tocar lo dice ("Ver →"); los demás son solo datos.
  const kpi = (n, lbl, tono = '', onclick = null) => el(onclick ? 'button' : 'div', {
    class: 'bj-emb__kpi' + (tono ? ' is-' + tono : ''), ...(onclick ? { type: 'button', onclick, 'aria-label': `${n} ${lbl} · ${T('ver tareas', 'see tasks')}` } : {}),
  }, [
    el('span', { class: 'bj-emb__kpi-n', text: n }),
    el('span', { class: 'bj-emb__kpi-lbl', text: lbl }),
    onclick ? el('span', { class: 'bj-emb__kpi-ver' }, [el('span', { text: T('Ver', 'See') }), icon('right', 13)]) : null,
  ].filter(Boolean));
  const kpis = el('div', { class: 'bj-emb__kpis' }, [
    kpi(String(abiertas.length), abiertas.length === 1 ? T('oportunidad abierta', 'open deal') : T('oportunidades abiertas', 'open deals')),
    kpi(fmtTotales(abiertas) || '$0', T('en juego', 'in play'), 'valor'),
    kpi(String(citas), T('citas en 7 días', 'visits in 7 days')),
    vencidas
      ? kpi(String(vencidas), vencidas === 1 ? T('tarea vencida', 'overdue task') : T('tareas vencidas', 'overdue tasks'), 'mal', () => cambiarVista('tareas'))
      : kpi(String(sinPaso), T('sin siguiente paso', 'without a next step'), sinPaso ? 'aviso' : ''),
  ]);

  // Teléfono: barra de etapas para saltar entre columnas.
  const chips = el('div', { class: 'bj-emb__etapas', role: 'tablist', 'aria-label': T('Etapas', 'Stages') }, d.ETAPAS.map((k, i) => el('button', {
    type: 'button', role: 'tab', class: 'bj-emb__etapa' + (i === colMovil ? ' is-on' : ''), 'aria-selected': String(i === colMovil),
    style: { '--e': d.ETAPA_COLOR[k], '--t': `var(--et-${k}-txt)` }, onclick: () => irAColumna(i, true),
  }, [el('span', { class: 'bj-col__punto' }), el('span', { text: etq(k) }), el('span', { class: 'bj-emb__etapa-n', text: String(porEtapa[k].length) })])));

  const tablero = el('div', { class: 'bj-tablero', onscroll: (e) => alDeslizar(e.currentTarget) }, d.ETAPAS.map((k) => columna(k, porEtapa[k])));
  const pie = el('p', { class: 'bj-emb__nota muted', text: T('Clientes y perdidos: últimos 90 días. Toca una tarjeta para ver su oportunidad completa.', 'Customers and lost: last 90 days. Tap a card to open the full deal.')
    + (puedeArrastrar() ? T(' Arrastra una tarjeta para cambiarla de etapa.', ' Drag a card to change its stage.') : '') });
  return [kpis, chips, tablero, pie];
}

function columna(k, lista) {
  const todas = COLS_ABIERTAS.has(k);
  const visibles = todas ? lista : lista.slice(0, POR_COLUMNA);
  const tot = fmtTotales(lista);
  return el('section', { class: 'bj-col', 'data-etapa': k, style: { '--e': d.ETAPA_COLOR[k], '--t': `var(--et-${k}-txt)` }, 'aria-label': `${etq(k)} · ${lista.length}` }, [
    el('header', { class: 'bj-col__head' }, [
      el('div', { class: 'bj-col__fila' }, [
        el('span', { class: 'bj-col__punto' }),
        el('h3', { class: 'bj-col__nombre', text: etq(k) }),
        el('span', { class: 'bj-col__n', text: String(lista.length) }),
      ]),
      el('div', { class: 'bj-col__valor' + (tot ? '' : ' is-vacio'), text: tot || T('Sin valor', 'No value') }),
    ]),
    el('div', { class: 'bj-col__cards' }, [
      ...(visibles.length ? visibles.map(tarjeta) : [el('p', { class: 'bj-col__vacio', text: T('Nada en esta etapa', 'Nothing in this stage') })]),
      lista.length > visibles.length ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm bj-col__mas', onclick: () => { COLS_ABIERTAS.add(k); pintarContenido(true); } }, [T(`Ver ${lista.length - visibles.length} más`, `Show ${lista.length - visibles.length} more`)]) : null,
    ].filter(Boolean)),
  ]);
}

function tarjeta(v) {
  const prox = v.proxima_tarea;
  const ev = prox && prox.vence_en ? estadoVence(prox.vence_en) : 'sin';
  const viva = ABIERTAS.includes(v.etapa);
  const nom = d.nombreDe(v);
  // Datos en gris, cada uno con su ícono y sin partirse (antes: pastillas de
  // colores por red, anuncio, agente y tratamientos). La red ya la dice el
  // logo del avatar; el anuncio vive dentro de la oportunidad.
  const nPlan = Number(v.plan_n) || 0;
  const meta = [
    v.asignado_nombre && !d.esAgente() ? el('span', { class: 'bj-card__dato' }, [icon('user', 12), el('span', { text: primerNombre(v.asignado_nombre) })]) : null,
    !v.asignado_a && (d.esAgente() || d.equipoAgentes().length) ? el('span', { class: 'bj-card__dato' }, [icon('user', 12), el('span', { text: T('Sin asignar', 'Unassigned') })]) : null,
    nPlan ? el('span', { class: 'bj-card__dato' }, [icon('activity', 12), el('span', { text: nPlan === 1 ? T('1 tratamiento', '1 treatment') : T(`${nPlan} tratamientos`, `${nPlan} treatments`) })]) : null,
  ].filter(Boolean);
  return el('button', {
    type: 'button', class: 'bj-card' + (ev === 'vencida' && viva ? ' is-vencida' : ''), 'data-id': v.id,
    'aria-label': `${nom} · ${d.CANAL_TXT[v.canal] || v.canal} · ${etq(v.etapa)}${v.valor_estimado != null ? ' · ' + fmtDinero(v.valor_estimado, v.moneda) : ''}`,
    onclick: () => { if (Date.now() - ultimoArrastre > 350) abrirOportunidad(v.id); },
  }, [
    el('span', { class: 'bj-card__top' }, [
      el('span', { class: 'bj-avatar bj-avatar--sm', style: { '--c': d.colorDe(v.canal) } }, [el('span', { text: initials(nom) }), el('span', { class: 'bj-avatar__ico' }, [d.icoCanal(v.canal, 9)])]),
      el('span', { class: 'bj-card__quien' }, [
        el('span', { class: 'bj-card__nombre', text: nom }),
        v.valor_estimado != null ? el('span', { class: 'bj-card__valor', text: fmtDinero(v.valor_estimado, v.moneda) }) : null,
      ].filter(Boolean)),
    ]),
    meta.length ? el('span', { class: 'bj-card__meta' }, meta) : null,
    prox ? el('span', { class: 'bj-card__tarea is-' + ev }, [
      icon((TIPO[prox.tipo] || TIPO.seguimiento).ico, 13),
      el('span', { class: 'bj-card__tarea-txt', text: prox.titulo }),
      prox.vence_en ? el('span', { class: 'bj-card__vence', text: ev === 'vencida' ? T('Venció ', 'Overdue ') + fmtVence(prox.vence_en) : fmtVence(prox.vence_en) }) : null,
    ].filter(Boolean)) : (viva ? el('span', { class: 'bj-card__tarea is-falta' }, [icon('warning', 13), el('span', { class: 'bj-card__tarea-txt', text: T('Sin siguiente paso', 'No next step') })]) : null),
    v.fecha_cita && v.etapa !== 'perdido' ? el('span', { class: 'bj-card__cita' + (citaPasada(v.fecha_cita) ? ' is-pasada' : '') }, [icon('calendar', 13), el('span', { text: T('Cita: ', 'Visit: ') + fmtCita(v.fecha_cita) })]) : null,
    v.etapa === 'perdido' && v.motivo_perdida ? el('span', { class: 'bj-card__motivo', text: v.motivo_perdida }) : null,
    el('span', { class: 'bj-card__pie' }, [
      el('span', { text: mayus(enEtapa(v.etapa_en)) }),
      v.no_leidos ? el('span', { class: 'bj-card__n', title: T(`${v.no_leidos} ${v.no_leidos === 1 ? 'mensaje' : 'mensajes'} sin leer`, `${v.no_leidos} unread`), 'aria-label': T(`${v.no_leidos} ${v.no_leidos === 1 ? 'mensaje' : 'mensajes'} sin leer`, `${v.no_leidos} unread`) }, [icon('chat', 11), el('span', { text: String(v.no_leidos) })]) : null,
    ].filter(Boolean)),
  ].filter(Boolean));
}

// Teléfono: una columna a la vez (scroll-snap); la barra de etapas sigue al dedo.
function irAColumna(i, suave) {
  const t = contEl && contEl.querySelector('.bj-tablero');
  const col = t && t.children[i];
  if (!col) return;
  colMovil = i;
  t.scrollTo({ left: col.offsetLeft - t.firstElementChild.offsetLeft, behavior: suave ? 'smooth' : 'auto' });
  marcarChip(i);
}
function alDeslizar(t) {
  if (!t.children.length || t.scrollWidth <= t.clientWidth + 4) return;
  const ancho = t.children[0].getBoundingClientRect().width || 1;
  const i = Math.max(0, Math.min(t.children.length - 1, Math.round(t.scrollLeft / (ancho + 10))));
  if (i !== colMovil) { colMovil = i; marcarChip(i); }
}
function marcarChip(i) {
  const chips = contEl && contEl.querySelectorAll('.bj-emb__etapa');
  if (!chips) return;
  chips.forEach((c, j) => { c.classList.toggle('is-on', j === i); c.setAttribute('aria-selected', String(j === i)); });
  const on = chips[i];
  if (on && on.parentElement.scrollWidth > on.parentElement.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

// Escritorio (ratón): arrastrar una tarjeta a otra columna cambia su etapa.
// En el teléfono la etapa se cambia dentro de la oportunidad (barra de etapas):
// un arrastre largo pelearía con el deslizar entre columnas.
function puedeArrastrar() { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
function conectarArrastre(t) {
  const ctx = d.ctx();
  if (!puedeArrastrar() || !ctx.dnd || !ctx.dnd.draggableList) return;
  const limpiar = () => contEl && contEl.querySelectorAll('.bj-col.is-over').forEach((c) => c.classList.remove('is-over'));
  dndOff = ctx.dnd.draggableList(t, '.bj-card', (item) => ({
    mode: 'move', data: { id: item.dataset.id }, scrollEl: t, dropSelector: '.bj-col',
    onStart: () => { item.classList.add('is-arrastrada'); },
    onMove: (c) => { limpiar(); if (c.over && c.over.dataset.etapa !== (filas.find((v) => v.id === item.dataset.id) || {}).etapa) c.over.classList.add('is-over'); },
    onCancel: () => { limpiar(); item.classList.remove('is-arrastrada'); ultimoArrastre = Date.now(); },
    onDrop: async (c) => {
      limpiar();
      item.classList.remove('is-arrastrada');
      ultimoArrastre = Date.now();
      const v = filas.find((x) => x.id === item.dataset.id);
      const destino = c.over && c.over.dataset.etapa;
      if (v && destino && destino !== v.etapa) await moverEtapa(v, destino, { optimista: true });
    },
  }));
}

// ── Cambio de etapa (tablero y oportunidad) ──────────────────────────────────
// Perdido pide el motivo; Cita agendada sin fecha ofrece anotarla.
export function cambiarEtapaCRM(v, nueva, opts = {}) { return moverEtapa(v, nueva, opts); }
async function moverEtapa(v, nueva, { anchor = null, optimista = false } = {}) {
  if (!nueva || nueva === v.etapa) return false;
  const cuerpo = { etapa: nueva };
  if (nueva === 'perdido') {
    const m = await pedirMotivo(anchor);
    if (m === null) return false;
    cuerpo.motivo_perdida = m;
  }
  const antes = { etapa: v.etapa, etapa_en: v.etapa_en, motivo_perdida: v.motivo_perdida };
  if (optimista) {
    Object.assign(v, { etapa: nueva, etapa_en: new Date().toISOString().slice(0, 19).replace('T', ' ') }, cuerpo.motivo_perdida ? { motivo_perdida: cuerpo.motivo_perdida } : {});
    pintarContenido(true);
  }
  let r = null;
  try {
    r = await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, cuerpo);
  } catch (e) {
    if (optimista) { Object.assign(v, antes); pintarContenido(true); }
    toast(e.message, { type: 'error' });
    return false;
  }
  const nc = (r && r.tareas_canceladas) || 0;
  toast(T(`${d.nombreDe(v)} pasó a ${etq(nueva)}`, `${d.nombreDe(v)} moved to ${etq(nueva)}`)
    + (nc ? T(` · se cancelaron ${nc === 1 ? 'su tarea pendiente' : `sus ${nc} tareas pendientes`}`, ` · ${nc} pending ${nc === 1 ? 'task' : 'tasks'} cancelled`) : ''), { type: 'success' });
  if (nueva === 'cita' && !v.fecha_cita) await pedirCita(v);
  trasCambio(v.id);
  return true;
}

function pedirMotivo(anchor) {
  return d.ctx().sheet.pickFrom({
    title: T('¿Por qué se perdió?', 'Why was it lost?'), anchor,
    options: [
      ...MOTIVOS.map((f) => ({ value: f(), label: f() })),
      { value: '__otro', label: T('Otro motivo…', 'Another reason…'), icon: icon('edit', 18) },
    ],
  }).then((m) => {
    if (m === null || m === undefined) return null;
    if (m !== '__otro') return m;
    return pedirTexto({ titulo: T('Motivo de pérdida', 'Lost reason'), placeholder: T('Escribe el motivo', 'Write the reason'), accion: T('Guardar', 'Save') });
  });
}

function pedirTexto({ titulo, placeholder = '', accion, valor = '' }) {
  return new Promise((resolve) => {
    let listo = false;
    const fin = (x) => { if (!listo) { listo = true; resolve(x); } };
    d.ctx().sheet.openSheet({
      title: titulo, mode: 'form', onClose: () => fin(null),
      build(body, close) {
        const inp = el('input', { class: 'input', id: 'bj-pedir-texto', value: valor, placeholder, maxlength: '300', autocomplete: 'off', 'aria-label': titulo });
        const ok = () => { const t = inp.value.trim(); if (!t) { inp.focus(); return; } fin(t); close({ force: true }); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        poner(body, 
          el('div', { class: 'field' }, [inp]),
          el('div', { class: 'bj-op__btns' }, [
            el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close({ force: true }) }, [T('Cancelar', 'Cancel')]),
            el('button', { type: 'button', class: 'btn btn-primary', onclick: ok }, [accion]),
          ]),
        );
        setTimeout(() => { try { inp.focus(); } catch { /* noop */ } }, 80);
      },
    });
  });
}

function pedirCita(v) {
  return new Promise((resolve) => {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; resolve(); } };
    d.ctx().sheet.openSheet({
      title: T('¿Cuándo es la cita?', 'When is the appointment?'), mode: 'form', onClose: fin,
      build(body, close) {
        const f = el('input', { class: 'input', type: 'date', id: 'bj-cita-fecha', min: hoyCun() });
        const h = el('input', { class: 'input', type: 'time', id: 'bj-cita-hora', step: '900', value: '10:00' });
        const btn = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
          if (!f.value) { toast(T('Elige el día de la cita.', 'Pick the appointment day.'), { type: 'error' }); f.focus(); return; }
          if (!h.value) { toast(T('Pon la hora de la cita.', 'Add the appointment time.'), { type: 'error' }); h.focus(); return; }
          btn.dataset.loading = 'true';
          try {
            await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, { fecha_cita: `${f.value} ${h.value}` });
            v.fecha_cita = `${f.value} ${h.value}`;
            toast(T(`Cita anotada: ${fmtCita(v.fecha_cita)}`, `Appointment saved: ${fmtCita(v.fecha_cita)}`), { type: 'success' });
            fin();
            close({ force: true });
          } catch (e) { toast(e.message, { type: 'error' }); delete btn.dataset.loading; }
        } }, [T('Guardar cita', 'Save appointment')]);
        poner(body, 
          el('p', { class: 'muted bj-op__p', text: T(`${d.nombreDe(v)} pasó a Cita agendada. Anota cuándo es para verla en su tarjeta y en el tablero.`, `${d.nombreDe(v)} is now Booked. Add when it is so it shows on the card and the board.`) }),
          el('div', { class: 'bj-op__dos' }, [
            campo(T('Día', 'Day'), f, { id: 'bj-cita-fecha' }),
            campo(T('Hora (Cancún)', 'Time (Cancún)'), h, { id: 'bj-cita-hora' }),
          ]),
          el('div', { class: 'bj-op__btns' }, [
            el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close({ force: true }) }, [T('Ahora no', 'Not now')]),
            btn,
          ]),
        );
      },
    });
  });
}

// ── Vista TAREAS ─────────────────────────────────────────────────────────────
function vistaTareas() {
  const wrap = el('div', { class: 'bj-tv' });
  wrap.appendChild(el('div', { class: 'seg bj-tv__seg', role: 'tablist', 'aria-label': T('Qué tareas ver', 'Which tasks') }, [
    [false, T('Pendientes', 'Pending')], [true, T('Hechas (30 días)', 'Done (30 days)')],
  ].map(([h, lbl]) => el('button', { type: 'button', role: 'tab', class: verHechas === h ? 'is-active' : '', 'aria-selected': String(verHechas === h), onclick: () => { if (verHechas === h) return; verHechas = h; tareas = null; pintarContenido(true); cargarCRM(); } }, [lbl]))));
  if (tareas === null) { wrap.appendChild(el('div', { class: 'bj-cargando' }, [el('span', { class: 'spinner' })])); return wrap; }
  if (!tareas.length) {
    wrap.appendChild(el('div', { class: 'bj-emb__vacio' }, [
      icon(verHechas ? 'check' : 'tasks', 26),
      el('p', { class: 'bj-emb__vacio-tit', text: verHechas ? T('Nada hecho en los últimos 30 días', 'Nothing done in the last 30 days') : T('Sin tareas pendientes', 'No pending tasks') }),
      el('p', { class: 'muted', text: T('Las tareas se crean dentro de cada oportunidad: abre una tarjeta del tablero y agenda el siguiente paso.', 'Tasks are created inside each deal: open a card on the board and schedule the next step.') }),
    ]));
    return wrap;
  }
  if (verHechas) {
    wrap.appendChild(el('div', { class: 'bj-tareas', role: 'list' }, tareas.map((t) => filaTarea(t))));
    return wrap;
  }
  const hoy = hoyCun();
  const grupos = [
    ['vencidas', T('Vencidas', 'Overdue'), 'mal'], ['hoy', T('Hoy', 'Today'), ''], ['manana', T('Mañana', 'Tomorrow'), ''],
    ['semana', T('Próximos 7 días', 'Next 7 days'), ''], ['despues', T('Más adelante', 'Later'), ''], ['sin', T('Sin fecha', 'No date'), ''],
  ];
  const de = (t) => {
    if (!t.vence_en) return 'sin';
    if (estadoVence(t.vence_en) === 'vencida') return 'vencidas';
    const f = aCancun(t.vence_en).fecha;
    if (f === hoy) return 'hoy';
    if (f === masDias(hoy, 1)) return 'manana';
    return f <= masDias(hoy, 7) ? 'semana' : 'despues';
  };
  for (const [k, lbl, tono] of grupos) {
    const lista = tareas.filter((t) => de(t) === k);
    if (!lista.length) continue;
    poner(wrap, 
      el('h3', { class: 'bj-tv__grupo' + (tono ? ' is-' + tono : '') }, [el('span', { text: lbl }), el('span', { class: 'bj-tv__n', text: String(lista.length) })]),
      el('div', { class: 'bj-tareas', role: 'list' }, lista.map((t) => filaTarea(t))),
    );
  }
  return wrap;
}

function textoVence(t) {
  if (t.estado === 'hecha') return T(`Hecha ${fmtVence(t.hecha_en)}`, `Done ${fmtVence(t.hecha_en)}`);
  if (!t.vence_en) return T('Sin fecha', 'No date');
  return estadoVence(t.vence_en) === 'vencida' ? T(`Venció ${fmtVence(t.vence_en)}`, `Overdue since ${fmtVence(t.vence_en)}`) : fmtVence(t.vence_en);
}

// Renglón de tarea (vista Tareas y dentro de la oportunidad).
function filaTarea(t, { enOp = false } = {}) {
  const hecha = t.estado === 'hecha';
  const ev = hecha ? 'hecha' : (t.vence_en ? estadoVence(t.vence_en) : 'sin');
  const tipo = TIPO[t.tipo] || TIPO.seguimiento;
  const yo = (d.yoMe() || {}).id;
  const check = el('button', {
    type: 'button', class: 'bj-tarea__check' + (hecha ? ' is-hecha' : ''), role: 'checkbox', 'aria-checked': String(hecha),
    'aria-label': hecha ? T(`Marcar como pendiente: ${t.titulo}`, `Mark as pending: ${t.titulo}`) : T(`Marcar como hecha: ${t.titulo}`, `Mark as done: ${t.titulo}`),
    onclick: async (e) => { e.stopPropagation(); if (await marcarTarea(t, hecha ? 'pendiente' : 'hecha')) trasCambio(t.conv_id); },
  }, [icon('check', 14)]);
  const meta = el('span', { class: 'bj-tarea__meta' }, [
    el('span', { class: 'bj-tarea__tipo' }, [icon(tipo.ico, 12), el('span', { text: tipo.txt() })]),
    el('span', { class: 'bj-tarea__vence is-' + ev, text: textoVence(t) }),
    !enOp ? el('span', { class: 'bj-tarea__quien' }, [d.icoCanal(t.conv_canal, 11), el('span', { text: nombreDeTarea(t) })]) : null,
    t.asignado_nombre && (t.asignado_a !== yo || d.esSupervisor()) ? el('span', { class: 'bj-tarea__resp' }, [icon('user', 11), el('span', { text: t.asignado_a === yo ? T('Tú', 'You') : primerNombre(t.asignado_nombre) })]) : null,
  ].filter(Boolean));
  const cuerpo = enOp
    ? el('div', { class: 'bj-tarea__cuerpo' }, [el('span', { class: 'bj-tarea__titulo', text: t.titulo }), meta, t.notas ? el('span', { class: 'bj-tarea__notas', text: t.notas }) : null].filter(Boolean))
    : el('button', { type: 'button', class: 'bj-tarea__cuerpo', 'aria-label': T(`Abrir la oportunidad de ${nombreDeTarea(t)}`, `Open ${nombreDeTarea(t)}’s deal`), onclick: () => abrirOportunidad(t.conv_id) }, [el('span', { class: 'bj-tarea__titulo', text: t.titulo }), meta]);
  const menu = el('button', { type: 'button', class: 'btn btn-ghost btn-icon bj-tarea__menu', 'aria-label': T('Opciones de la tarea', 'Task options'), onclick: (e) => menuTarea(t, e.currentTarget, { enOp }) }, [icon('dots', 18)]);
  return el('div', { class: 'bj-tarea is-' + ev, role: 'listitem' }, [check, cuerpo, menu]);
}

async function marcarTarea(t, estado) {
  try {
    await api.patch(`/bandeja/tareas/${encodeURIComponent(t.id)}`, { estado });
    t.estado = estado;
    if (estado === 'hecha') {
      toast(T('Tarea hecha', 'Task done'), { type: 'success', action: { label: T('Deshacer', 'Undo'), onAction: async () => {
        try { await api.patch(`/bandeja/tareas/${encodeURIComponent(t.id)}`, { estado: 'pendiente' }); t.estado = 'pendiente'; trasCambio(t.conv_id); }
        catch (e) { toast(e.message, { type: 'error' }); }
      } } });
    }
    return true;
  } catch (e) { toast(e.message, { type: 'error' }); return false; }
}

async function menuTarea(t, anchor, { enOp = false } = {}) {
  const ctx = d.ctx();
  const pend = t.estado !== 'hecha';
  const k = await ctx.sheet.pickFrom({
    title: t.titulo, anchor,
    options: [
      pend ? { value: 'editar', label: T('Editar o reprogramar', 'Edit or reschedule'), icon: icon('edit', 18) } : null,
      pend ? { value: 'manana', label: T('Pasarla a mañana', 'Move to tomorrow'), sub: t.vence_en ? T(`Misma hora: ${aCancun(t.vence_en).hora}`, `Same time: ${aCancun(t.vence_en).hora}`) : T('Mañana a las 10:00', 'Tomorrow at 10:00'), icon: icon('clock', 18) } : null,
      !pend ? { value: 'reabrir', label: T('Volver a pendiente', 'Back to pending'), icon: icon('refresh', 18) } : null,
      // Dentro de la oportunidad ya se está viendo: ahí no se ofrece.
      !enOp ? { value: 'abrir', label: T('Ver la oportunidad', 'Open the deal'), icon: icon('briefcase', 18) } : null,
      { value: 'borrar', label: T('Borrar tarea', 'Delete task'), icon: icon('trash', 18), color: '#ef4444' },
    ].filter(Boolean),
  });
  if (!k) return;
  const listo = () => trasCambio(t.conv_id);
  try {
    if (k === 'editar') { editarTarea(t, listo, abierta && abierta.id === t.conv_id ? abierta.asignado() : undefined); return; }
    if (k === 'abrir') { if (!(abierta && abierta.id === t.conv_id)) abrirOportunidad(t.conv_id); return; }
    if (k === 'reabrir') { if (await marcarTarea(t, 'pendiente')) listo(); return; }
    if (k === 'manana') {
      const c = t.vence_en ? aCancun(t.vence_en) : null;
      const base = c && c.fecha > hoyCun() ? c.fecha : hoyCun();
      await api.patch(`/bandeja/tareas/${encodeURIComponent(t.id)}`, { vence_en: aUtc(masDias(base, 1), c ? c.hora : '10:00') });
      toast(T('Tarea pasada a mañana', 'Task moved to tomorrow'), { type: 'success' });
      listo();
      return;
    }
    if (k === 'borrar') {
      const ok = await ctx.sheet.confirmDiscard({ title: T('¿Borrar esta tarea?', 'Delete this task?'), keepLabel: T('Cancelar', 'Cancel'), discardLabel: T('Borrar', 'Delete') });
      if (!ok) return;
      await api.del(`/bandeja/tareas/${encodeURIComponent(t.id)}`);
      toast(T('Tarea borrada', 'Task deleted'), { type: 'success' });
      listo();
    }
  } catch (e) { toast(e.message, { type: 'error' }); }
}

// ── Formulario de tarea (nueva o editar) ─────────────────────────────────────
// Por defecto: llamada, hoy a la siguiente hora redonda (o mañana a las 10 si
// ya es tarde), a cargo de quien atiende el chat.
function horarioSugerido() {
  const ahora = isoCun(Date.now());
  const hora = Number(ahora.slice(11, 13));
  if (hora >= 18) return { fecha: masDias(hoyCun(), 1), hora: '10:00' };
  if (hora < 8) return { fecha: hoyCun(), hora: '10:00' };
  return { fecha: hoyCun(), hora: String(hora + 1).padStart(2, '0') + ':00' };
}

function formTarea({ tarea = null, conv = null, convAsignado = undefined, alGuardar, alCancelar }) {
  const yo = d.yoMe() || {};
  // Quién atiende al paciente: de él (o del supervisor) son sus tareas.
  const dueno = conv ? (conv.asignado_a || null) : (convAsignado !== undefined ? convAsignado : (tarea && tarea.conv_asignado !== undefined ? tarea.conv_asignado : null));
  const sug = horarioSugerido();
  const c = tarea && tarea.vence_en ? aCancun(tarea.vence_en) : null;
  const st = {
    titulo: tarea ? tarea.titulo : '',
    tipo: tarea ? tarea.tipo : 'llamada',
    fecha: tarea ? (c ? c.fecha : '') : sug.fecha,
    hora: tarea ? (c ? c.hora : '') : sug.hora,
    asignado: tarea ? tarea.asignado_a : ((conv && conv.asignado_a) || yo.id),
    asignadoNombre: tarea ? tarea.asignado_nombre : ((conv && conv.asignado_a && conv.asignado_nombre) || yo.name || T('Tú', 'You')),
    notas: tarea ? tarea.notas || '' : '',
  };
  const sfx = tarea ? '-ed' : '';
  const titulo = el('input', { class: 'input', id: 'bj-tarea-titulo' + sfx, value: st.titulo, maxlength: '160', autocomplete: 'off', placeholder: TIPO[st.tipo].ej(), oninput: (e) => { st.titulo = e.target.value; } });
  const tipos = el('div', { class: 'bj-ftarea__tipos', role: 'radiogroup', 'aria-label': T('Tipo de tarea', 'Task type') });
  const pintarTipos = () => {
    clear(tipos);
    for (const [k, ico, txt] of TIPOS) {
      tipos.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': String(st.tipo === k), class: 'bj-ftarea__tipo' + (st.tipo === k ? ' is-on' : ''), onclick: () => { st.tipo = k; titulo.placeholder = TIPO[k].ej(); pintarTipos(); } }, [icon(ico, 15), el('span', { text: txt() })]));
    }
  };
  pintarTipos();
  const fecha = el('input', { class: 'input', type: 'date', id: 'bj-tarea-fecha' + sfx, value: st.fecha, oninput: (e) => { st.fecha = e.target.value; pintarAtajos(); } });
  const hora = el('input', { class: 'input', type: 'time', id: 'bj-tarea-hora' + sfx, step: '900', value: st.hora, oninput: (e) => { st.hora = e.target.value; } });
  const atajos = el('div', { class: 'bj-ftarea__atajos' });
  function pintarAtajos() {
    clear(atajos);
    const h = hoyCun();
    for (const [n, lbl] of [[0, T('Hoy', 'Today')], [1, T('Mañana', 'Tomorrow')], [3, T('En 3 días', 'In 3 days')], [7, T('En una semana', 'In a week')]]) {
      const f = masDias(h, n);
      atajos.appendChild(el('button', { type: 'button', class: 'bj-ftarea__atajo' + (st.fecha === f ? ' is-on' : ''), 'aria-pressed': String(st.fecha === f), onclick: () => { st.fecha = f; fecha.value = f; if (!st.hora) { st.hora = '10:00'; hora.value = '10:00'; } pintarAtajos(); } }, [lbl]));
    }
  }
  pintarAtajos();
  // Responsable: el supervisor (o la agencia) elige; el agente se la pone a sí mismo.
  // Una agente solo puede tener tareas de pacientes que ella atiende (o que
  // nadie atiende): si el paciente ya tiene agente, la lista es ella y tú.
  const agentes = d.equipoAgentes().filter((a) => !dueno || a.id === dueno);
  const puedeElegir = d.esSupervisor() && agentes.some((a) => a.id !== yo.id);
  const btnResp = el('button', { type: 'button', class: 'bj-campo-etapa bj-ftarea__resp', id: 'bj-tarea-resp' + sfx, disabled: !puedeElegir });
  const pintarResp = () => { clear(btnResp); poner(btnResp, icon('user', 16), el('span', { class: 'bj-campo-etapa__txt', text: st.asignado === yo.id ? T(`Tú (${primerNombre(yo.name)})`, `You (${primerNombre(yo.name)})`) : st.asignadoNombre }), puedeElegir ? icon('down', 16) : null); };
  pintarResp();
  if (puedeElegir) btnResp.addEventListener('click', async () => {
    const ops = [{ value: yo.id, label: T(`Yo (${yo.name})`, `Me (${yo.name})`), current: st.asignado === yo.id }, ...agentes.filter((a) => a.id !== yo.id).map((a) => ({ value: a.id, label: a.nombre, current: st.asignado === a.id }))];
    const k = await d.ctx().sheet.pickFrom({ title: T('¿Quién la hace?', 'Who does it?'), anchor: btnResp, options: ops });
    if (!k) return;
    st.asignado = k;
    st.asignadoNombre = (ops.find((o) => o.value === k) || {}).label || '';
    pintarResp();
  });
  const notas = el('textarea', { class: 'textarea', id: 'bj-tarea-notas' + sfx, rows: 2, maxlength: '1000', placeholder: T('Detalles (opcional)', 'Details (optional)'), oninput: (e) => { st.notas = e.target.value; } }, [st.notas]);
  const btnOk = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
    if (!st.titulo.trim()) { toast(T('Escribe qué hay que hacer.', 'Write what needs to be done.'), { type: 'error' }); titulo.focus(); return; }
    if (st.fecha && !st.hora) { toast(T('Pon la hora límite.', 'Add the due time.'), { type: 'error' }); hora.focus(); return; }
    if (!st.fecha && st.hora) { toast(T('Pon el día límite.', 'Add the due day.'), { type: 'error' }); fecha.focus(); return; }
    btnOk.dataset.loading = 'true';
    try {
      await alGuardar({ titulo: st.titulo.trim(), tipo: st.tipo, vence_en: st.fecha ? aUtc(st.fecha, st.hora) : null, asignado_a: st.asignado, notas: st.notas.trim() });
    } catch (e) { toast(e.message, { type: 'error' }); }
    finally { delete btnOk.dataset.loading; }
  } }, [tarea ? T('Guardar tarea', 'Save task') : T('Crear tarea', 'Create task')]);
  setTimeout(() => { try { titulo.focus({ preventScroll: false }); } catch { /* noop */ } }, 60);
  return el('div', { class: 'bj-ftarea' }, [
    campo(T('Qué hay que hacer', 'What needs to be done'), titulo, { id: 'bj-tarea-titulo' + sfx }),
    tipos,
    el('div', { class: 'bj-op__dos' }, [
      campo(T('Día límite', 'Due day'), fecha, { id: 'bj-tarea-fecha' + sfx }),
      campo(T('Hora (Cancún)', 'Time (Cancún)'), hora, { id: 'bj-tarea-hora' + sfx }),
    ]),
    atajos,
    campo(T('Responsable', 'Owner'), btnResp, { id: 'bj-tarea-resp' + sfx, hint: d.esSupervisor() && dueno ? T('Solo quien atiende a este paciente, o tú.', 'Only whoever handles this patient, or you.') : null }),
    campo(T('Notas', 'Notes'), notas, { id: 'bj-tarea-notas' + sfx }),
    el('div', { class: 'bj-op__btns' }, [
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: alCancelar }, [T('Cancelar', 'Cancel')]),
      btnOk,
    ]),
  ]);
}

function editarTarea(t, listo, convAsignado = undefined) {
  d.ctx().sheet.openSheet({
    title: T('Editar tarea', 'Edit task'), mode: 'form',
    build(body, close) {
      body.appendChild(formTarea({
        tarea: t, convAsignado,
        alCancelar: () => close({ force: true }),
        alGuardar: async (c) => {
          const cambios = {};
          if (c.titulo !== t.titulo) cambios.titulo = c.titulo;
          if (c.tipo !== t.tipo) cambios.tipo = c.tipo;
          if ((c.vence_en || null) !== (t.vence_en ? t.vence_en.slice(0, 16) : null)) cambios.vence_en = c.vence_en;
          if (c.asignado_a !== t.asignado_a) cambios.asignado_a = c.asignado_a;
          if ((c.notas || '') !== (t.notas || '')) cambios.notas = c.notas;
          if (Object.keys(cambios).length) {
            await api.patch(`/bandeja/tareas/${encodeURIComponent(t.id)}`, cambios);
            toast(T('Tarea guardada', 'Task saved'), { type: 'success' });
          }
          close({ force: true });
          listo();
        },
      }));
    },
  });
}

// ── Utilidades de formulario ─────────────────────────────────────────────────
function campo(lbl, ctrl, { id = null, hint = null, ancho = false } = {}) {
  return el('div', { class: 'field bj-op__campo' + (ancho ? ' is-ancho' : '') }, [
    el('label', { class: 'label', ...(id ? { for: id } : {}), text: lbl }),
    ctrl,
    hint ? el('p', { class: 'field__hint muted', text: hint }) : null,
  ].filter(Boolean));
}
function tituloSec(txt, ico, extra = null) {
  return el('h3', { class: 'bj-op__tit' }, [icon(ico, 16), el('span', { text: txt }), extra ? el('span', { class: 'bj-op__tit-extra', text: extra }) : null].filter(Boolean));
}

async function cargarCatalogo() {
  if (catalogo) return catalogo;
  try {
    const r = await api.get(`/bandeja/catalogo?client_id=${encodeURIComponent(d.cid())}`);
    catalogo = { lista: r.catalogo || [], editable: !!r.editable };
  } catch { catalogo = { lista: [], editable: false }; }
  return catalogo;
}

// ── OPORTUNIDAD ──────────────────────────────────────────────────────────────
export async function abrirOportunidad(convId) {
  const ctx = d.ctx();
  if (abierta && abierta.id === convId) return;
  let datos;
  try { datos = await api.get(`/bandeja/conversaciones/${encodeURIComponent(convId)}?marcar=0`); }
  catch (e) { toast(e.message, { type: 'error' }); return; }
  let v = datos.conversacion;
  let seccion = 'datos';
  let formNueva = false;
  let verHechasOp = false;
  let histTodo = false;
  const refs = {};

  const deConv = () => {
    const [cf, ch] = v.fecha_cita ? String(v.fecha_cita).split(' ') : ['', ''];
    const plan = v.plan_tratamiento || { items: [], notas: '' };
    return {
      nombre: v.nombre || '',
      telefono: d.fmtTelUI(d.telDeConv(v)) || '',
      correo: v.correo || '',
      citaFecha: cf || '', citaHora: fmtHora(ch),
      valor: v.valor_estimado != null ? String(v.valor_estimado) : '',
      moneda: v.moneda || 'MXN',
      motivo: v.motivo_perdida || '',
      notas: v.notas || '',
      plan: { items: (plan.items || []).map((i) => ({ id: i.id || rid(), tratamiento: i.tratamiento || '', detalle: i.detalle || '', precio: i.precio != null ? String(i.precio) : '', estado: i.estado || 'propuesto' })), notas: plan.notas || '' },
    };
  };
  let base = deConv();
  let bor = clonar(base);
  const sucio = () => JSON.stringify(bor) !== JSON.stringify(base);
  const cambio = (k) => JSON.stringify(bor[k]) !== JSON.stringify(base[k]);

  let inst = null;
  inst = ctx.sheet.openSheet({
    title: d.nombreDe(v),
    mode: 'form',
    confirmClose: () => {
      if (!sucio()) return true;
      ctx.sheet.confirmDiscard({ title: T('¿Salir sin guardar los cambios?', 'Leave without saving?'), keepLabel: T('Seguir editando', 'Keep editing'), discardLabel: T('Salir sin guardar', 'Leave without saving') })
        .then((si) => { if (si) inst.close({ force: true }); });
      return false;
    },
    onClose: () => { if (abierta && abierta.id === v.id) abierta = null; },
    build(body) {
      refs.body = body;
      refs.raiz = el('div', { class: 'bj-op', 'data-sec': seccion });
      body.appendChild(refs.raiz);
      armar();
    },
  });
  inst.el.classList.add('sheet--op');
  abierta = { id: v.id, recargar, asignado: () => v.asignado_a || null };

  // Salir de la hoja hacia otra cosa (chat): con cambios, pregunta primero.
  async function salirY(fn) {
    if (sucio()) {
      const si = await ctx.sheet.confirmDiscard({ title: T('¿Salir sin guardar los cambios?', 'Leave without saving?'), keepLabel: T('Seguir editando', 'Keep editing'), discardLabel: T('Salir sin guardar', 'Leave without saving') });
      if (!si) return;
    }
    inst.close({ force: true });
    fn();
  }

  function armar() {
    clear(refs.raiz);
    refs.head = el('div', { class: 'bj-op__head' });
    refs.etapas = el('div', { class: 'bj-op__etapas' });
    refs.tabs = el('div', { class: 'seg bj-op__tabs', role: 'tablist', 'aria-label': T('Secciones', 'Sections') });
    refs.datos = el('section', { class: 'bj-op__sec', 'data-sec': 'datos' });
    refs.plan = el('section', { class: 'bj-op__sec', 'data-sec': 'plan' });
    refs.tareas = el('section', { class: 'bj-op__sec', 'data-sec': 'tareas' });
    refs.hist = el('section', { class: 'bj-op__sec', 'data-sec': 'historial' });
    refs.pie = el('div', { class: 'bj-op__pie' });
    refs.pie.hidden = true;
    refs.raiz.append(refs.head, refs.etapas, refs.tabs,
      el('div', { class: 'bj-op__grid' }, [
        el('div', { class: 'bj-op__col' }, [refs.datos, refs.plan]),
        el('div', { class: 'bj-op__col' }, [refs.tareas, refs.hist]),
      ]),
      refs.pie);
    pintarHead(); pintarEtapas(); pintarTabs(); pintarDatos(); pintarPlan(); pintarTareasOp(); pintarHist(); pintarPie();
  }

  async function recargar({ reiniciar = false } = {}) {
    try { datos = await api.get(`/bandeja/conversaciones/${encodeURIComponent(v.id)}?marcar=0`); }
    catch (e) { toast(e.message, { type: 'error' }); return; }
    if (!refs.raiz || !refs.raiz.isConnected) return;
    v = datos.conversacion;
    const nuevo = deConv();
    if (reiniciar || !sucio()) { base = nuevo; bor = clonar(nuevo); }
    else {
      // Lo que no tocó la persona toma el valor nuevo del servidor; lo que sí
      // tocó se respeta (no se pierde lo escrito por una cita agendada aparte).
      for (const k of Object.keys(nuevo)) if (JSON.stringify(bor[k]) === JSON.stringify(base[k])) bor[k] = clonar(nuevo[k]);
      base = nuevo;
    }
    const t = inst.el.querySelector('.sheet__title');
    if (t) t.textContent = d.nombreDe(v);
    pintarHead(); pintarEtapas(); pintarTabs(); pintarDatos(); pintarPlan(); pintarTareasOp(); pintarHist(); pintarPie();
  }

  // ── Cabecera: quién es, de dónde llegó, cuánto vale y acciones ──
  function pintarHead() {
    clear(refs.head);
    const o = d.origenAnuncio(v);
    const tel = d.telDeConv(v);
    const nom = d.nombreDe(v);
    const conPlan = totalPlan(v.plan_tratamiento) > 0;
    poner(refs.head, 
      el('div', { class: 'bj-op__quien' }, [
        el('span', { class: 'bj-avatar bj-avatar--lg', style: { '--c': d.colorDe(v.canal) } }, [el('span', { text: initials(nom) }), el('span', { class: 'bj-avatar__ico' }, [d.icoCanal(v.canal, 12)])]),
        el('div', { class: 'bj-op__quien-txt' }, [
          el('p', { class: 'bj-op__linea' }, [
            el('span', { class: 'bj-op__canal', style: { '--c': d.colorDe(v.canal) }, text: d.CANAL_TXT[v.canal] || v.canal }),
            tel ? el('span', { text: d.fmtTelUI(tel) }) : (v.username ? el('span', { text: '@' + v.username }) : null),
          ].filter(Boolean)),
          el('p', { class: 'bj-op__linea is-mute', text: o ? T('Llegó por el anuncio', 'Came from the ad') + (o.titulo ? `: “${o.titulo}”` : '') : T(`Primer contacto: ${fmtMomento(v.created_at)}`, `First contact: ${fmtMomento(v.created_at)}`) }),
        ]),
      ]),
      el('div', { class: 'bj-op__valor' }, [
        el('span', { class: 'bj-op__valor-lbl', text: conPlan ? T('Valor del plan', 'Plan value') : T('Valor estimado', 'Estimated value') }),
        el('span', { class: 'bj-op__valor-n' + (v.valor_estimado == null ? ' is-vacio' : ''), text: v.valor_estimado != null ? fmtDinero(v.valor_estimado, v.moneda || 'MXN') : T('Sin valor', 'No value') }),
      ]),
      el('div', { class: 'bj-op__acciones' }, [
        el('button', { type: 'button', class: 'btn btn-sm', onclick: () => salirY(() => d.abrirChat(v.id)) }, [icon('chat', 15), el('span', { text: T('Abrir chat', 'Open chat') })]),
        el('button', { type: 'button', class: 'btn btn-sm', onclick: () => d.abrirLlamada(v, { alCerrar: () => recargar() }) }, [icon('phone', 15), el('span', { text: T('Llamar', 'Call') })]),
        botonResponsable(),
      ].filter(Boolean)),
    );
  }

  function botonResponsable() {
    const agentes = d.equipoAgentes();
    if (d.esAgente()) {
      // Texto, no pastilla: no hay nada que tocar (lo que parece botón tiene que hacer algo).
      if (v.asignado_a) return el('span', { class: 'bj-op__tuyo' }, [icon('user', 14), el('span', { text: T('Lo atiendes tú', 'You handle this patient') })]);
      return el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
        try { await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/asignar`, { user_id: d.yoMe().id }); toast(T('Listo: este paciente ya es tuyo.', 'Done: this patient is yours now.'), { type: 'success' }); trasCambio(v.id); }
        catch (e) { toast(e.message, { type: 'error' }); }
      } }, [icon('plus', 15), el('span', { text: T('Tomar', 'Take it') })]);
    }
    if (!agentes.length) return null;
    return el('button', { type: 'button', class: 'btn btn-sm bj-op__resp', 'aria-label': T('Asignar a un agente', 'Assign to an agent'), onclick: async (e) => {
      const ops = [
        ...agentes.map((a) => ({ value: a.id, label: a.nombre + (a.disponible ? '' : ' · ' + T('no disponible', 'away')), current: v.asignado_a === a.id })),
        { value: '__nadie', label: T('Sin asignar', 'Unassigned'), current: !v.asignado_a },
      ];
      const k = await ctx.sheet.pickFrom({ title: T('Asignar a', 'Assign to'), anchor: e.currentTarget, options: ops });
      if (!k || k === v.asignado_a || (k === '__nadie' && !v.asignado_a)) return;
      try {
        const x = await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/asignar`, { user_id: k === '__nadie' ? null : k });
        toast(x.asignado_nombre ? T(`Asignado a ${x.asignado_nombre}`, `Assigned to ${x.asignado_nombre}`) : T('Quedó sin asignar', 'Now unassigned'), { type: 'success' });
        trasCambio(v.id);
      } catch (err) { toast(err.message, { type: 'error' }); }
    } }, [icon('users', 15), el('span', { text: v.asignado_nombre || T('Sin asignar', 'Unassigned') }), icon('down', 13)]);
  }

  // ── Barra de etapas (un toque cambia la etapa) ──
  function pintarEtapas() {
    clear(refs.etapas);
    const pasos = d.ETAPAS.filter((k) => k !== 'perdido');
    const i = pasos.indexOf(v.etapa);
    const perdido = v.etapa === 'perdido';
    const color = d.ETAPA_COLOR[v.etapa] || '#64748b';
    poner(refs.etapas,
      el('div', { class: 'bj-etapas' + (perdido ? ' is-perdido' : ''), role: 'group', 'aria-label': T('Etapa', 'Stage'), style: { '--e': color } }, pasos.map((k, j) => el('button', {
        type: 'button', class: 'bj-etapas__paso' + (!perdido && j <= i ? ' is-hecho' : '') + (k === v.etapa ? ' is-actual' : ''),
        style: { '--e': d.ETAPA_COLOR[k], '--t': `var(--et-${k}-txt)` },
        'aria-pressed': String(k === v.etapa), 'aria-label': T(`Mover a ${etq(k)}`, `Move to ${etq(k)}`), title: etq(k),
        onclick: (e) => cambiarEtapa(k, e.currentTarget),
      }, [el('span', { class: 'bj-etapas__txt', text: etq(k) })]))),
      el('button', {
        type: 'button', class: 'bj-etapas__perdido' + (perdido ? ' is-actual' : ''), 'aria-pressed': String(perdido),
        'aria-label': perdido ? etq('perdido') : T('Marcar como perdido', 'Mark as lost'), onclick: (e) => cambiarEtapa('perdido', e.currentTarget),
      }, [icon('close', 13), el('span', { text: etq('perdido') })]),
      el('p', { class: 'bj-op__etapa-txt' }, [
        el('span', { class: 'bj-etapa__punto', style: { '--e': color } }),
        el('strong', { text: etq(v.etapa) }),
        el('span', { class: 'muted', text: ` · ${enEtapa(v.etapa_en || v.created_at)}` }),
        perdido && v.motivo_perdida ? el('span', { class: 'muted', text: ` · ${v.motivo_perdida}` }) : null,
      ].filter(Boolean)),
    );
  }
  async function cambiarEtapa(k, anchor) {
    if (k === v.etapa) return;
    await moverEtapa(v, k, { anchor });
  }

  // ── Pestañas (solo teléfono): Datos · Plan · Tareas · Historial ──
  function pintarTabs() {
    clear(refs.tabs);
    const nPend = (datos.tareas || []).filter((t) => t.estado === 'pendiente').length;
    const nPlan = (bor.plan.items || []).length;
    for (const [k, lbl, n] of [['datos', T('Datos', 'Details'), 0], ['plan', T('Plan', 'Plan'), nPlan], ['tareas', T('Tareas', 'Tasks'), nPend], ['historial', T('Historial', 'History'), 0]]) {
      refs.tabs.appendChild(el('button', { type: 'button', role: 'tab', 'data-sec': k, class: seccion === k ? 'is-active' : '', 'aria-selected': String(seccion === k), onclick: () => irA(k) }, [
        el('span', { text: lbl }), n ? el('span', { class: 'bj-op__tab-n', text: String(n) }) : null,
      ].filter(Boolean)));
    }
  }
  function irA(k, focoId = null) {
    seccion = k;
    refs.raiz.dataset.sec = k;
    pintarTabs();
    // Los campos que crecen se miden al verse (oculto, su alto es 0).
    requestAnimationFrame(() => refs.raiz.querySelectorAll('.bj-partida__trat').forEach(crecer));
    if (window.matchMedia('(max-width: 899px)').matches) {
      const y = refs.tabs.offsetTop - 6;
      if (refs.body.scrollTop > y) refs.body.scrollTop = y;
    }
    if (focoId) setTimeout(() => { const n = document.getElementById(focoId); if (n) { n.focus(); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 40);
  }

  // ── Datos del paciente y de la oportunidad ──
  function pintarDatos() {
    clear(refs.datos);
    const inp = (k, props = {}) => el('input', { class: 'input', id: 'bj-op-' + k, value: bor[k], autocomplete: 'off', ...props, oninput: (e) => { bor[k] = e.target.value; pintarPie(); } });
    const conPlan = totalPlan(bor.plan) > 0;
    const valor = conPlan
      ? el('input', { class: 'input', id: 'bj-op-valor', value: fmtDinero(totalPlan(bor.plan), bor.moneda), disabled: true, 'aria-describedby': 'bj-op-valor-hint' })
      : inp('valor', { inputmode: 'decimal', placeholder: T('Ej. 18500', 'E.g. 18500') });
    const monedas = el('div', { class: 'seg bj-op__moneda', role: 'radiogroup', 'aria-label': T('Moneda', 'Currency') }, ['MXN', 'USD'].map((m) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(bor.moneda === m), class: bor.moneda === m ? 'is-active' : '',
      onclick: () => { if (bor.moneda === m) return; bor.moneda = m; pintarDatos(); pintarPlan(); pintarPie(); },
    }, [m])));
    const notas = el('textarea', { class: 'textarea', id: 'bj-op-notas', rows: 3, placeholder: T('Qué pidió, qué se le explicó, qué le preocupa…', 'What they asked, what was explained, what worries them…'), oninput: (e) => { bor.notas = e.target.value; pintarPie(); } }, [bor.notas]);
    const perdido = v.etapa === 'perdido';
    const motivo = perdido ? el('div', { class: 'bj-op__motivo' }, [
      inp('motivo', { placeholder: T('Por qué no se cerró', 'Why it did not close'), maxlength: '300' }),
      el('div', { class: 'bj-op__chips' }, MOTIVOS.map((f) => el('button', { type: 'button', class: 'bj-ftarea__atajo' + (bor.motivo === f() ? ' is-on' : ''), onclick: () => { bor.motivo = f(); pintarDatos(); pintarPie(); } }, [f()]))),
    ]) : null;
    poner(refs.datos, 
      tituloSec(T('Datos del paciente', 'Patient details'), 'user'),
      el('div', { class: 'bj-op__campos' }, [
        campo(T('Nombre', 'Name'), inp('nombre', { placeholder: T('Nombre y apellido', 'Full name'), maxlength: '120' }), { id: 'bj-op-nombre', ancho: true }),
        campo(T('Teléfono', 'Phone'), inp('telefono', { type: 'tel', inputmode: 'tel', placeholder: '998 123 4567' }), { id: 'bj-op-telefono' }),
        campo(T('Correo', 'Email'), inp('correo', { type: 'email', inputmode: 'email', placeholder: T('nombre@correo.com', 'name@email.com') }), { id: 'bj-op-correo' }),
      ]),
      tituloSec(T('Oportunidad', 'Deal'), 'briefcase'),
      el('div', { class: 'bj-op__campos' }, [
        el('div', { class: 'field bj-op__campo is-ancho' }, [
          el('label', { class: 'label', for: 'bj-op-citaFecha', text: T('Fecha de la cita', 'Appointment') }),
          el('div', { class: 'bj-op__dos' }, [
            inp('citaFecha', { type: 'date', 'aria-label': T('Día de la cita', 'Appointment day') }),
            inp('citaHora', { type: 'time', step: '900', 'aria-label': T('Hora de la cita (Cancún)', 'Appointment time (Cancún)') }),
          ]),
          // Safari pinta la fecha de hoy en gris en un campo vacío: se dice claro que no hay cita.
          bor.citaFecha || bor.citaHora
            ? el('button', { type: 'button', class: 'bj-op__link', onclick: () => { bor.citaFecha = ''; bor.citaHora = ''; pintarDatos(); pintarPie(); } }, [T('Quitar la cita', 'Remove the appointment')])
            : el('p', { class: 'field__hint muted', text: T('Sin cita todavía.', 'No appointment yet.') }),
        ].filter(Boolean)),
        el('div', { class: 'field bj-op__campo is-ancho' }, [
          el('label', { class: 'label', for: 'bj-op-valor', text: conPlan ? T('Valor (total del plan)', 'Value (plan total)') : T('Valor estimado', 'Estimated value') }),
          el('div', { class: 'bj-op__valor-campo' }, [valor, monedas]),
          el('p', { class: 'field__hint muted', id: 'bj-op-valor-hint', text: conPlan ? T('Se calcula solo con los precios del plan de tratamiento (sin lo rechazado).', 'Calculated from the treatment plan prices (declined items excluded).') : T('Si armas el plan de tratamiento con precios, el valor se calcula solo.', 'Build the treatment plan with prices and the value is calculated for you.') }),
        ]),
        perdido ? campo(T('Motivo de pérdida', 'Lost reason'), motivo, { id: 'bj-op-motivo', ancho: true }) : null,
        // El siguiente paso se agenda como TAREA (con hora, responsable y aviso);
        // la vieja fecha suelta de "seguimiento" ya no se pide aquí.
        campo(T('Notas del paciente', 'Patient notes'), notas, { id: 'bj-op-notas', ancho: true, hint: T('Lo que todo el equipo debe saber de este paciente. Lo del día a día va en Comentarios, en el historial.', 'What the whole team should know about this patient. Day-to-day updates go in Comments, in the history.') }),
      ].filter(Boolean)),
      el('div', { class: 'bj-op__meta' }, [
        el('span', { class: 'muted', text: `${d.CANAL_TXT[v.canal] || v.canal} · ${v.canal === 'whatsapp' ? '+' + v.contacto_id : (v.canal === 'correo' ? v.contacto_id : 'ID ' + v.contacto_id)}` }),
        el('button', { type: 'button', class: 'bj-op__link', onclick: archivar }, [v.archivado ? T('Recuperar oportunidad', 'Restore deal') : T('Archivar oportunidad', 'Archive deal')]),
      ]),
    );
  }

  async function archivar() {
    const si = v.archivado || await ctx.sheet.confirmDiscard({ title: T('¿Archivar esta oportunidad?', 'Archive this deal?'), keepLabel: T('Cancelar', 'Cancel'), discardLabel: T('Archivar', 'Archive') });
    if (!si) return;
    try {
      await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, { archivado: !v.archivado });
      toast(v.archivado ? T('Oportunidad recuperada', 'Deal restored') : T('Oportunidad archivada', 'Deal archived'), { type: 'success' });
      inst.close({ force: true });
      trasCambio(v.id);
    } catch (e) { toast(e.message, { type: 'error' }); }
  }

  // ── Plan de tratamiento por partidas ──
  function pintarPlan() {
    clear(refs.plan);
    const items = bor.plan.items;
    const total = totalPlan(bor.plan);
    poner(refs.plan, 
      tituloSec(T('Plan de tratamiento', 'Treatment plan'), 'activity', items.length ? fmtDinero(total, bor.moneda) : null),
      items.length
        ? el('div', { class: 'bj-plan', role: 'list' }, items.map((it, i) => partida(it, i)))
        : el('p', { class: 'bj-op__vacio', text: T('Todavía no hay tratamientos. Agrega lo que se le propuso al paciente: queda documentado y el valor de la oportunidad se calcula solo.', 'No treatments yet. Add what was proposed to the patient: it is documented and the deal value is calculated for you.') }),
      el('div', { class: 'bj-plan__acciones' }, [
        el('button', { type: 'button', class: 'btn btn-sm', onclick: agregarPartida }, [icon('plus', 15), el('span', { text: T('Agregar tratamiento', 'Add treatment') })]),
        catalogo && catalogo.editable ? el('button', { type: 'button', class: 'bj-op__link', onclick: editarCatalogo }, [T('Editar catálogo y precios', 'Edit catalog and prices')]) : null,
      ].filter(Boolean)),
      items.length ? el('div', { class: 'bj-plan__totales' }, [
        el('div', { class: 'bj-plan__tot' }, [el('span', { text: T('Total del plan', 'Plan total') }), el('strong', { class: 'bj-plan__tot-total', text: fmtDinero(total, bor.moneda) || '$0' })]),
        el('div', { class: 'bj-plan__tot' }, [el('span', { text: T('Aceptado', 'Accepted') }), el('strong', { class: 'bj-plan__tot-acep', text: fmtDinero(totalPlan(bor.plan, ['aceptado', 'realizado']), bor.moneda) || '$0' })]),
        el('div', { class: 'bj-plan__tot' }, [el('span', { text: T('Realizado', 'Done') }), el('strong', { class: 'bj-plan__tot-real', text: fmtDinero(totalPlan(bor.plan, ['realizado']), bor.moneda) || '$0' })]),
      ]) : null,
      campo(T('Notas del plan', 'Plan notes'), el('textarea', { class: 'textarea', id: 'bj-op-plan-notas', rows: 2, placeholder: T('Ej. Financiamiento a 6 meses, empezar por la arcada superior', 'E.g. 6-month financing, start with the upper arch'), oninput: (e) => { bor.plan.notas = e.target.value; pintarPie(); } }, [bor.plan.notas]), { id: 'bj-op-plan-notas' }),
    );
    if (!catalogo) cargarCatalogo().then(() => { if (catalogo.editable && refs.plan.isConnected) pintarPlan(); });
  }
  // Totales en vivo mientras se escriben los precios (sin repintar el plan).
  function refrescarTotales() {
    const t = totalPlan(bor.plan);
    const q = (s) => refs.plan.querySelector(s);
    const n1 = q('.bj-plan__tot-total'); if (n1) n1.textContent = fmtDinero(t, bor.moneda) || '$0';
    const n2 = q('.bj-plan__tot-acep'); if (n2) n2.textContent = fmtDinero(totalPlan(bor.plan, ['aceptado', 'realizado']), bor.moneda) || '$0';
    const n3 = q('.bj-plan__tot-real'); if (n3) n3.textContent = fmtDinero(totalPlan(bor.plan, ['realizado']), bor.moneda) || '$0';
    const ex = q('.bj-op__tit-extra'); if (ex) ex.textContent = fmtDinero(t, bor.moneda);
    // El campo Valor de Datos cambia de modo cuando el plan empieza (o deja) de tener precios.
    const val = refs.datos.querySelector('#bj-op-valor');
    if (val && (t > 0) !== val.disabled) pintarDatos();
    else if (val && t > 0) val.value = fmtDinero(t, bor.moneda);
  }
  function partida(it, i) {
    const est = PARTIDA[it.estado] || PARTIDA.propuesto;
    const btnEstado = el('button', { type: 'button', class: 'bj-partida__estado', style: { '--e': est.color }, 'aria-label': T(`Estado: ${est.txt()}`, `Status: ${est.txt()}`), onclick: async (e) => {
      const k = await ctx.sheet.pickFrom({ title: T('Estado del tratamiento', 'Treatment status'), anchor: e.currentTarget, options: PARTIDAS.map(([k2, txt, color]) => ({ value: k2, label: txt(), color, current: it.estado === k2 })) });
      if (!k || k === it.estado) return;
      it.estado = k;
      pintarPlan(); refrescarTotales(); pintarPie();
    } }, [el('span', { class: 'bj-etapa__punto', style: { '--e': est.color } }), el('span', { text: est.txt() }), icon('down', 13)]);
    // El nombre del tratamiento va en un campo que crece (los nombres largos
    // como "Valoración con radiografía panorámica" no caben en un renglón).
    const trat = el('textarea', { class: 'input bj-partida__trat', id: `bj-partida-${it.id}`, rows: 1, maxlength: '120', autocomplete: 'off', placeholder: T('Tratamiento', 'Treatment'), 'aria-label': T('Tratamiento', 'Treatment'),
      oninput: (e) => { it.tratamiento = e.target.value.replace(/[\r\n]+/g, ' '); if (e.target.value !== it.tratamiento) e.target.value = it.tratamiento; crecer(e.target); pintarPie(); } }, [it.tratamiento]);
    requestAnimationFrame(() => crecer(trat));
    return el('div', { class: 'bj-partida' + (it.estado === 'rechazado' ? ' is-rechazado' : ''), role: 'listitem', style: { '--e': est.color } }, [
      trat,
      el('div', { class: 'bj-partida__fila' }, [
        el('input', { class: 'input bj-partida__det', value: it.detalle, maxlength: '200', autocomplete: 'off', placeholder: window.matchMedia('(max-width: 599px)').matches ? T('Detalle', 'Detail') : T('Pieza, zona, sesiones…', 'Tooth, area, sessions…'), 'aria-label': T('Detalle', 'Detail'), oninput: (e) => { it.detalle = e.target.value; pintarPie(); } }),
        el('label', { class: 'bj-partida__precio' }, [
          el('span', { class: 'bj-partida__signo', text: bor.moneda === 'USD' ? 'US$' : '$' }),
          el('input', { class: 'bj-partida__precio-in', inputmode: 'decimal', value: it.precio, placeholder: '0', autocomplete: 'off', 'aria-label': T(`Precio de ${it.tratamiento || 'este tratamiento'}`, `Price of ${it.tratamiento || 'this treatment'}`), oninput: (e) => { it.precio = e.target.value.replace(/[^\d.,]/g, ''); refrescarTotales(); pintarPie(); } }),
        ]),
      ]),
      el('div', { class: 'bj-partida__fila bj-partida__pie' }, [
        btnEstado,
        el('button', { type: 'button', class: 'btn btn-ghost btn-icon bj-partida__quitar', 'aria-label': T(`Quitar ${it.tratamiento || 'este tratamiento'}`, `Remove ${it.tratamiento || 'this treatment'}`), onclick: () => { bor.plan.items.splice(i, 1); pintarPlan(); refrescarTotales(); pintarTabs(); pintarPie(); } }, [icon('trash', 16)]),
      ]),
    ]);
  }
  async function agregarPartida(e) {
    const anchor = e && e.currentTarget;
    const cat = await cargarCatalogo();
    const usados = new Set(bor.plan.items.map((i) => i.tratamiento.trim().toLowerCase()));
    const k = await ctx.sheet.pickFrom({
      title: T('Agregar tratamiento', 'Add treatment'), anchor,
      options: [
        { value: '__otro', label: T('Escribir otro tratamiento', 'Type another treatment'), icon: icon('edit', 18) },
        // Los precios de lista están en pesos: en una oportunidad en dólares se
        // muestran como referencia y el precio se escribe a mano.
        ...cat.lista.filter((c) => !usados.has(c.nombre.toLowerCase())).map((c) => ({
          value: c.nombre, label: c.nombre,
          sub: c.precio == null ? T('Sin precio de lista', 'No list price') : (bor.moneda === 'USD' ? T(`Lista: ${fmtDinero(c.precio, 'MXN')} MXN (escribe el precio en dólares)`, `List: ${fmtDinero(c.precio, 'MXN')} MXN (type the USD price)`) : fmtDinero(c.precio, 'MXN')),
        })),
      ],
    });
    if (!k) return;
    const c = cat.lista.find((x) => x.nombre === k);
    const it = { id: rid(), tratamiento: k === '__otro' ? '' : k, detalle: '', precio: c && c.precio != null && bor.moneda !== 'USD' ? String(c.precio) : '', estado: 'propuesto' };
    bor.plan.items.push(it);
    pintarPlan(); refrescarTotales(); pintarTabs(); pintarPie();
    setTimeout(() => {
      const n = refs.plan.querySelector(`#bj-partida-${it.id}`);
      if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (k === '__otro') n.focus(); }
    }, 40);
  }

  // ── Tareas de la oportunidad ──
  function pintarTareasOp() {
    clear(refs.tareas);
    const lista = datos.tareas || [];
    const pend = lista.filter((t) => t.estado === 'pendiente');
    const hechas = lista.filter((t) => t.estado === 'hecha');
    poner(refs.tareas, 
      tituloSec(T('Tareas', 'Tasks'), 'tasks', pend.length ? T(`${pend.length} pendiente${pend.length === 1 ? '' : 's'}`, `${pend.length} pending`) : null),
      formNueva
        ? formTarea({
          conv: v,
          alCancelar: () => { formNueva = false; pintarTareasOp(); },
          alGuardar: async (c) => {
            await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/tareas`, c);
            toast(T('Tarea creada', 'Task created'), { type: 'success' });
            formNueva = false;
            trasCambio(v.id);
          },
        })
        : el('button', { type: 'button', class: 'btn btn-sm bj-tareas__nueva', onclick: () => { formNueva = true; pintarTareasOp(); } }, [icon('plus', 15), el('span', { text: T('Nueva tarea', 'New task') })]),
      pend.length ? el('div', { class: 'bj-tareas', role: 'list' }, pend.map((t) => filaTarea(t, { enOp: true }))) : null,
      !pend.length && !formNueva ? el('p', { class: 'bj-op__vacio' + (ABIERTAS.includes(v.etapa) ? ' is-aviso' : ''), text: ABIERTAS.includes(v.etapa)
        ? T('Sin tareas pendientes. Agenda el siguiente paso para que este paciente no se enfríe.', 'No pending tasks. Schedule the next step so this patient does not go cold.')
        : T('Sin tareas pendientes.', 'No pending tasks.') }) : null,
      hechas.length ? el('button', { type: 'button', class: 'bj-op__link bj-op__hechas', 'aria-expanded': String(verHechasOp), onclick: () => { verHechasOp = !verHechasOp; pintarTareasOp(); } }, [
        icon(verHechasOp ? 'up' : 'down', 14), el('span', { text: T(`Hechas (${hechas.length})`, `Done (${hechas.length})`) }),
      ]) : null,
      hechas.length && verHechasOp ? el('div', { class: 'bj-tareas', role: 'list' }, hechas.map((t) => filaTarea(t, { enOp: true }))) : null,
    );
  }

  // ── Historial: cada punto de contacto, lo más nuevo arriba ──
  function pintarHist() {
    clear(refs.hist);
    const msgs = datos.mensajes || [];
    const entrantes = msgs.filter((m) => m.direccion === 'in').length;
    const llamadasLinea = (datos.llamadas || []).filter((l) => !['no_contesto_agente', 'cancelada', 'iniciando'].includes(l.estado));
    const llamadasManual = (datos.eventos || []).filter((e) => e.tipo === 'llamada' && !(e.dato && e.dato.llamada_id));
    const fechas = [v.ultimo_en, ...llamadasLinea.map((l) => l.creado), ...llamadasManual.map((e) => e.creado)].filter(Boolean).sort();
    const ultimo = fechas[fechas.length - 1];
    const entradas = historial(llamadasLinea);
    const dato = (n, lbl) => el('div', { class: 'bj-contacto' }, [el('span', { class: 'bj-contacto__n', text: n }), el('span', { class: 'bj-contacto__lbl', text: lbl })]);
    const ta = el('textarea', { class: 'textarea bj-hist__ta', id: 'bj-op-comentario', rows: 1, maxlength: '1000', placeholder: T('Escribe un comentario', 'Write a comment'), 'aria-label': T('Comentario', 'Comment'), oninput: (e) => crecer(e.target) });
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: async () => {
      const texto = ta.value.trim();
      if (!texto) { ta.focus(); return; }
      btn.dataset.loading = 'true';
      try {
        await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/nota`, { texto });
        toast(T('Comentario agregado', 'Comment added'), { type: 'success' });
        await recargar();
      } catch (e) { toast(e.message, { type: 'error' }); }
      finally { delete btn.dataset.loading; }
    } }, [T('Agregar', 'Add')]);
    const visibles = histTodo ? entradas : entradas.slice(0, 25);
    poner(refs.hist, 
      tituloSec(T('Historial de contacto', 'Contact history'), 'clock'),
      el('div', { class: 'bj-contactos' }, [
        dato(String(entrantes), entrantes === 1 ? T('mensaje del paciente', 'patient message') : T('mensajes del paciente', 'patient messages')),
        dato(String(msgs.length - entrantes), msgs.length - entrantes === 1 ? T('respuesta', 'reply') : T('respuestas', 'replies')),
        dato(String(llamadasLinea.length + llamadasManual.length), llamadasLinea.length + llamadasManual.length === 1 ? T('llamada', 'call') : T('llamadas', 'calls')),
        dato(ultimo ? timeAgo(ultimo) : T('Nunca', 'Never'), T('último contacto', 'last contact')),
      ]),
      el('div', { class: 'bj-hist__nueva' }, [ta, btn]),
      el('ol', { class: 'bj-hist' }, visibles.map(itemHist)),
      entradas.length > visibles.length ? el('button', { type: 'button', class: 'bj-op__link', onclick: () => { histTodo = true; pintarHist(); } }, [T(`Ver todo el historial (${entradas.length})`, `Show the full history (${entradas.length})`)]) : null,
    );
  }
  function historial(llamadasLinea) {
    const out = [];
    let g = null;
    for (const m of datos.mensajes || []) {
      const dia = (aCancun(m.creado) || {}).fecha;
      if (g && g.dir === m.direccion && g.dia === dia && (m.direccion === 'in' || g.autor === (m.autor_nombre || ''))) { g.n++; g.t = m.creado; g.ultimo = m; continue; }
      g = { k: 'msg', dir: m.direccion, dia, n: 1, t: m.creado, ultimo: m, autor: m.autor_nombre || '' };
      out.push(g);
    }
    for (const l of llamadasLinea) out.push({ k: 'llamada', t: l.creado, l });
    for (const e of datos.eventos || []) {
      if (e.tipo === 'llamada' && e.dato && e.dato.llamada_id) continue;
      out.push({ k: 'ev', t: e.creado, e });
    }
    if (v.created_at) out.push({ k: 'inicio', t: v.created_at });
    return out.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  }
  function itemHist(it) {
    let ico = 'info', tit = '', txt = '', tono = '';
    if (it.k === 'msg') {
      ico = 'chat';
      const ult = it.ultimo;
      const contenido = ult.texto || (ult.adjunto_tipo ? T(`(${ult.adjunto_tipo})`, `(${ult.adjunto_tipo})`) : '');
      if (it.dir === 'in') {
        tono = 'in';
        tit = it.n === 1 ? T(`Mensaje del paciente por ${d.CANAL_TXT[v.canal] || v.canal}`, `Patient message on ${d.CANAL_TXT[v.canal] || v.canal}`) : T(`${it.n} mensajes del paciente por ${d.CANAL_TXT[v.canal] || v.canal}`, `${it.n} patient messages on ${d.CANAL_TXT[v.canal] || v.canal}`);
      } else {
        tono = 'out';
        const quien = it.autor || T('el equipo', 'the team');
        tit = it.n === 1 ? T(`Respuesta de ${quien}`, `Reply from ${quien}`) : T(`${it.n} respuestas de ${quien}`, `${it.n} replies from ${quien}`);
      }
      txt = contenido.length > 160 ? contenido.slice(0, 157) + '…' : contenido;
    } else if (it.k === 'llamada') {
      const l = it.l;
      ico = 'phone'; tono = 'llamada';
      const dur = l.duracion_seg ? ` · ${Math.floor(l.duracion_seg / 60)}:${String(l.duracion_seg % 60).padStart(2, '0')}` : '';
      tit = (l.direccion === 'entrante' ? T('Llamada entrante', 'Incoming call') : T('Llamada', 'Call')) + (l.user_nombre ? ` · ${l.user_nombre}` : '') + dur + (l.resultado && d.RESULTADO_TXT[l.resultado] ? ` · ${d.RESULTADO_TXT[l.resultado]()}` : '');
      txt = (l.transcripcion && l.transcripcion.resumen) || l.nota || '';
    } else if (it.k === 'ev') {
      const e = it.e;
      ico = iconoEvento(e.tipo, e.dato);
      if (e.tipo === 'nota') { tono = 'nota'; tit = T(`Comentario de ${e.user_nombre || 'alguien'}`, `Comment from ${e.user_nombre || 'someone'}`); txt = (e.dato && e.dato.texto) || ''; }
      else if (e.tipo === 'llamada') { tono = 'llamada'; tit = d.textoEventoChat(e); }
      else tit = textoEvento(e) || d.textoEventoChat(e);
      if (e.tipo === 'etapa') tono = 'etapa';
      if (e.tipo === 'tarea') tono = 'tarea';
    } else {
      ico = 'inbox'; tit = T(`Primer contacto por ${d.CANAL_TXT[v.canal] || v.canal}`, `First contact on ${d.CANAL_TXT[v.canal] || v.canal}`);
    }
    return el('li', { class: 'bj-hist__item' + (tono ? ' is-' + tono : '') }, [
      el('span', { class: 'bj-hist__ico' }, [icon(ico, 14)]),
      el('div', { class: 'bj-hist__txt' }, [
        el('p', { class: 'bj-hist__tit', text: tit }),
        txt ? el('p', { class: 'bj-hist__cita', text: txt }) : null,
        el('p', { class: 'bj-hist__cuando', text: fmtMomento(it.t) }),
      ].filter(Boolean)),
    ]);
  }

  // ── Pie con Guardar (solo si hay cambios) ──
  function pintarPie() {
    const s = sucio();
    refs.pie.hidden = !s;
    refs.raiz.classList.toggle('is-sucio', s);
    if (!s) { clear(refs.pie); return; }
    if (refs.pie.childElementCount) return;
    const btn = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => guardar(btn) }, [T('Guardar cambios', 'Save changes')]);
    poner(refs.pie, 
      el('span', { class: 'bj-op__pie-txt' }, [el('span', { class: 'bj-op__pie-punto' }), el('span', { text: T('Cambios sin guardar', 'Unsaved changes') })]),
      el('div', { class: 'bj-op__pie-btns' }, [
        el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { bor = clonar(base); pintarDatos(); pintarPlan(); pintarTabs(); pintarPie(); } }, [T('Descartar', 'Discard')]),
        btn,
      ]),
    );
  }

  async function guardar(btn) {
    if (bor.citaFecha && !bor.citaHora) { toast(T('Pon la hora de la cita.', 'Add the appointment time.'), { type: 'error' }); irA('datos', 'bj-op-citaHora'); return; }
    if (!bor.citaFecha && bor.citaHora) { toast(T('Pon el día de la cita.', 'Add the appointment day.'), { type: 'error' }); irA('datos', 'bj-op-citaFecha'); return; }
    const sinNombre = bor.plan.items.find((i) => !i.tratamiento.trim() && (i.precio || i.detalle.trim()));
    if (sinNombre) { toast(T('A un tratamiento le falta el nombre.', 'A treatment is missing its name.'), { type: 'error' }); irA('plan', `bj-partida-${sinNombre.id}`); return; }
    const malPrecio = bor.plan.items.find((i) => Number.isNaN(numero(i.precio)));
    if (malPrecio) { toast(T(`Revisa el precio de “${malPrecio.tratamiento}”.`, `Check the price of “${malPrecio.tratamiento}”.`), { type: 'error' }); irA('plan'); return; }
    const cuerpo = {};
    if (cambio('nombre')) cuerpo.nombre = bor.nombre.trim();
    if (cambio('telefono')) cuerpo.telefono = bor.telefono.trim();
    if (cambio('correo')) cuerpo.correo = bor.correo.trim();
    if (cambio('citaFecha') || cambio('citaHora')) cuerpo.fecha_cita = bor.citaFecha ? `${bor.citaFecha} ${bor.citaHora}` : null;
    if (cambio('moneda')) cuerpo.moneda = bor.moneda;
    if (cambio('valor') && !(totalPlan(bor.plan) > 0)) {
      const n = numero(bor.valor);
      if (Number.isNaN(n) || (n !== null && n < 0)) { toast(T('Escribe el valor como un monto, por ejemplo 18500.', 'Write the value as an amount, e.g. 18500.'), { type: 'error' }); irA('datos', 'bj-op-valor'); return; }
      cuerpo.valor_estimado = n;
    }
    if (cambio('motivo')) cuerpo.motivo_perdida = bor.motivo.trim();
    if (cambio('notas')) cuerpo.notas = bor.notas;
    if (cambio('plan') || (cambio('moneda') && bor.plan.items.length)) {
      cuerpo.plan_tratamiento = {
        items: bor.plan.items.filter((i) => i.tratamiento.trim()).map((i) => ({ id: i.id, tratamiento: i.tratamiento.trim(), detalle: i.detalle.trim(), precio: numero(i.precio), estado: i.estado })),
        notas: bor.plan.notas,
      };
    }
    if (!Object.keys(cuerpo).length) { base = clonar(bor); pintarPie(); return; }
    btn.dataset.loading = 'true';
    try {
      await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, cuerpo);
      toast(T('Oportunidad guardada', 'Deal saved'), { type: 'success' });
      await recargar({ reiniciar: true });
      if (hostEl && hostEl.isConnected) cargarCRM({ silencioso: true });
      d.alCambiar(v.id);
    } catch (e) { toast(e.message, { type: 'error', ms: 7000 }); }
    finally { delete btn.dataset.loading; }
  }
}

// ── Catálogo de tratamientos (supervisor y agencia) ──────────────────────────
function editarCatalogo() {
  const filasCat = (catalogo ? catalogo.lista.filter((c) => c.propio !== false) : []).map((c) => ({ id: rid(), nombre: c.nombre, precio: c.precio != null ? String(c.precio) : '' }));
  if (!filasCat.length) filasCat.push({ id: rid(), nombre: '', precio: '' });
  d.ctx().sheet.openSheet({
    title: T('Catálogo de tratamientos', 'Treatment catalog'), mode: 'form',
    build(body, close) {
      const lista = el('div', { class: 'bj-cat', role: 'list' });
      const pintar = () => {
        clear(lista);
        filasCat.forEach((f, i) => lista.appendChild(el('div', { class: 'bj-cat__fila', role: 'listitem' }, [
          el('input', { class: 'input', id: `bj-cat-${f.id}`, value: f.nombre, maxlength: '120', placeholder: T('Tratamiento', 'Treatment'), 'aria-label': T('Tratamiento', 'Treatment'), oninput: (e) => { f.nombre = e.target.value; } }),
          el('label', { class: 'bj-partida__precio' }, [el('span', { class: 'bj-partida__signo', text: '$' }), el('input', { class: 'bj-partida__precio-in', inputmode: 'decimal', value: f.precio, placeholder: '0', 'aria-label': T('Precio de lista', 'List price'), oninput: (e) => { f.precio = e.target.value.replace(/[^\d.,]/g, ''); } })]),
          el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': T('Quitar', 'Remove'), onclick: () => { filasCat.splice(i, 1); pintar(); } }, [icon('trash', 16)]),
        ])));
      };
      pintar();
      const btn = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
        const salida = filasCat.filter((f) => f.nombre.trim()).map((f) => ({ nombre: f.nombre.trim(), precio: numero(f.precio) }));
        if (salida.some((f) => Number.isNaN(f.precio))) { toast(T('Revisa los precios: solo números.', 'Check the prices: numbers only.'), { type: 'error' }); return; }
        btn.dataset.loading = 'true';
        try {
          const r = await api.post(`/bandeja/catalogo?client_id=${encodeURIComponent(d.cid())}`, { catalogo: salida });
          catalogo = null;
          await cargarCatalogo();
          toast(T(`Catálogo guardado: ${r.catalogo.length} tratamientos`, `Catalog saved: ${r.catalogo.length} treatments`), { type: 'success' });
          close({ force: true });
        } catch (e) { toast(e.message, { type: 'error' }); delete btn.dataset.loading; }
      } }, [T('Guardar catálogo', 'Save catalog')]);
      poner(body, 
        el('p', { class: 'muted bj-op__p', text: T('Los tratamientos y precios de lista de la clínica. Al armar un plan se eligen de aquí y el precio se puede ajustar para cada paciente.', 'The clinic treatments and list prices. Plans pick from here and each price can be adjusted per patient.') }),
        lista,
        el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { filasCat.push({ id: rid(), nombre: '', precio: '' }); pintar(); setTimeout(() => { const n = document.getElementById(`bj-cat-${filasCat[filasCat.length - 1].id}`); if (n) n.focus(); }, 30); } }, [icon('plus', 15), el('span', { text: T('Agregar tratamiento', 'Add treatment') })]),
        el('div', { class: 'bj-op__btns' }, [el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close({ force: true }) }, [T('Cancelar', 'Cancel')]), btn]),
      );
    },
  });
}
