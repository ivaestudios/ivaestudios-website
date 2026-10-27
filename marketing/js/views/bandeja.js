// ============================================================================
// IVAE Marketing — Vista "Bandeja" (solo staff): comentarios, mensajes y CRM
// de la marca activa, en un solo lugar.
//
// Pedido de Vianey (23-sep-2026): "quiero que también conteste comentarios,
// quiero tener un CRM donde pueda contestar Messenger, Insta, WhatsApp".
//
// Dos pestañas: MENSAJES (Instagram DMs, Messenger, WhatsApp: lista de
// conversaciones + chat con respuesta y sugerencia IA + ficha CRM con etapa,
// notas y seguimiento) y COMENTARIOS (Instagram y Facebook: responder en
// público, por mensaje privado, marcar visto, ocultar). Un engrane (admin)
// abre los ajustes: datos del webhook para Meta, suscripción por marca,
// WhatsApp por marca y "Sondear ahora".
//
// Móvil primero: la lista ocupa la pantalla y el chat la reemplaza con botón
// de regresar; en escritorio van lado a lado. Se refresca solo cada 25 s.
//
// EQUIPO DE VENTAS (7-oct-2026, SMILE NOW): la marca puede tener agentes y
// supervisores (accesos de cliente con bandeja_rol). Los leads se reparten
// parejo, cada agente ve sus chats, el supervisor ve el DESEMPEÑO (tiempos de
// respuesta, llamadas, seguimientos, citas, leads por anuncio). En WhatsApp,
// pasadas 24 h el texto del agente sale dentro de la PLANTILLA ABIERTA (saludo
// y cierre fijos, el medio libre) y cada mensaje muestra si llegó o no.
// ============================================================================
import { api, el, clear, timeAgo, initials, copyText } from '../api.js?v=202610262345';
import { toast } from '../shell/toast.js?v=202610262345';
import { icon, iconMarca } from '../shell/icons.js?v=202610262345';
import { T, isEN } from '../shell/i18n.js?v=202610262345';
import { conectarCRM, panelEmbudo, pintarBarra as pintarBarraCRM, cargarCRM, abrirOportunidad, reiniciarCRM, textoEvento, iconoEvento, cambiarEtapaCRM } from './bandeja-crm.js?v=202610262345';

const VIEW_ID = 'bandeja';
const REFRESCO_MS = 25000;

let ctx = null;
let rootEl = null;
let unsubs = [];
let timer = null;
let mounted = false;

let tab = 'mensajes';          // 'mensajes' | 'embudo' | 'comentarios' | 'desempeno'
let canal = '';                // filtro de canal ('' = todos)
let etapa = '';                // filtro de etapa ('' = todas)
let soloSinLeer = false;
let busqueda = '';
let estadoCom = 'pendientes';  // 'pendientes' | 'todos'
let asignado = '';             // '' | 'yo' | 'sin'
let porSeguir = false;         // la persona lleva días sin contestar
let sinResponder = false;      // el último mensaje es de la persona
let verArchivadas = false;     // conversaciones archivadas (para recuperarlas)
let periodo = 30;              // días del dashboard
let desempeno = null;
let llamadasPanel = null;      // { llamadas, totales, linea } del periodo (supervisor)
let plantillaClave = 'seguimiento';
const infoPlantilla = new Map(); // `${convId}:${clave}` -> { max, antes, despues, botones }

let resumen = null;
let convs = [];
let coms = [];
let convAbierta = null;        // { conversacion, mensajes }
let convPedida = null;         // deep-link ?conv=
let opPedida = null;           // deep-link ?op= (oportunidad, desde un aviso de tarea)
let cargandoLista = false;
let enviando = false;
const borradores = new Map();  // convId -> texto del composer

// ── Etiquetas ────────────────────────────────────────────────────────────────
const ETAPAS = ['nuevo', 'platica', 'cotizado', 'cita', 'cliente', 'perdido'];
const ETAPA_TXT = {
  nuevo: () => T('Nuevo', 'New'),
  platica: () => T('En plática', 'Talking'),
  cotizado: () => T('Cotizado', 'Quoted'),
  cita: () => T('Cita agendada', 'Booked'),
  cliente: () => T('Cliente', 'Customer'),
  perdido: () => T('Perdido', 'Lost'),
};
// Etapas en UN solo color: escalones del color de la marca, de claro (nuevo)
// a lleno (cliente), y gris para perdido (bandeja.css, --et-*). Antes eran
// azul/morado/naranja/verde... y se veía un arcoíris (15-oct-2026, Israel:
// "hay muchos colores como raros, que se vea lo más profesional posible").
const ETAPA_COLOR = { nuevo: 'var(--et-nuevo)', platica: 'var(--et-platica)', cotizado: 'var(--et-cotizado)', cita: 'var(--et-cita)', cliente: 'var(--et-cliente)', perdido: 'var(--et-perdido)' };
const RESULTADOS_LLAMADA = [
  ['contesto', () => T('Contestó', 'Answered')],
  ['cita', () => T('Agendó cita', 'Booked')],
  ['no_contesto', () => T('No contestó', 'No answer')],
  ['buzon', () => T('Buzón de voz', 'Voicemail')],
  ['numero_mal', () => T('Número equivocado', 'Wrong number')],
];
const RESULTADO_TXT = Object.fromEntries(RESULTADOS_LLAMADA.map(([k, f]) => [k, f]));
const CANAL_TXT = { instagram: 'Instagram', messenger: 'Messenger', whatsapp: 'WhatsApp', facebook: 'Facebook', tiktok: 'TikTok', correo: T('Correo', 'Email') };
const CANAL_ICO = { instagram: 'instagram', messenger: 'messenger', facebook: 'facebook', whatsapp: 'whatsapp', tiktok: 'tiktok' };
// El logo de la red va RELLENO (iconMarca); si algún día llega un canal sin
// logo, cae al ícono de enlace para no dejar el hueco.
const icoCanal = (c, n) => (c === 'correo' ? icon('mail', n) : (iconMarca(CANAL_ICO[c] || '', n) || icon('link', n)));
// Un color por app (Vianey, 25-sep-2026): Messenger celeste, Instagram rosado,
// WhatsApp verde, TikTok plomo oscuro. Mismos valores que --net-* en bandeja.css.
const CANAL_COLOR = { instagram: '#E1306C', messenger: '#0084FF', facebook: '#0084FF', whatsapp: '#25D366', tiktok: '#545463', correo: '#B45309' };
// El token de la hoja manda (cambia con el tema); el hex queda de respaldo.
const colorDe = (canal) => (CANAL_COLOR[canal] ? `var(--net-${canal}, ${CANAL_COLOR[canal]})` : 'var(--brand)');

const clienteActivo = () => {
  const st = ctx.store.getState();
  return (st.clients || []).find((c) => c.id === st.activeClientId) || null;
};
const yoMe = () => (ctx.store.getState().me || {});
const esAdmin = () => yoMe().role === 'admin';
const esStaff = () => yoMe().role === 'admin' || yoMe().role === 'team';
// Equipo de la marca: el agente solo ve sus chats; el supervisor (y el staff)
// ve todo, reasigna y abre el desempeño.
const esAgente = () => yoMe().role === 'client' && yoMe().bandeja_rol === 'agente';
const esSupervisor = () => esStaff() || (yoMe().role === 'client' && yoMe().bandeja_rol === 'supervisor');
const cid = () => (clienteActivo() || {}).id || '';
// Marca "solo CRM" (/auth/me.solo_crm): sin la pestaña de Comentarios, solo
// Mensajes y Desempeño (demo de Sebastián, 14-oct-2026).
const sinComentarios = () => yoMe().role === 'client' && !!yoMe().solo_crm;
const equipoAgentes = () => ((resumen && !resumen.error && resumen.equipo) || []);

function chipCanal(c) {
  return el('span', { class: 'chip bj-chip-canal', style: { '--c': colorDe(c) } }, [
    icoCanal(c, 12), el('span', { class: 'chip__txt', text: CANAL_TXT[c] || c }),
  ]);
}
function nombreDe(v) {
  return v.nombre || (v.username ? '@' + v.username : (v.canal === 'whatsapp' ? '+' + v.contacto_id : (v.canal === 'correo' ? v.contacto_id : T('Sin nombre', 'No name'))));
}
function origenDe(v) {
  try { return v && v.origen ? (typeof v.origen === 'string' ? JSON.parse(v.origen) : v.origen) : null; } catch { return null; }
}
function origenAnuncio(v) { const o = origenDe(v); return o && o.tipo === 'anuncio' ? o : null; }
function horasDesde(iso) {
  if (!iso) return Infinity;
  const d = new Date(String(iso).replace(' ', 'T') + 'Z');
  return isNaN(d) ? Infinity : (Date.now() - d.getTime()) / 36e5;
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function cargarResumen() {
  const id = cid();
  if (!id) return;
  const conCorreoAntes = !!(resumen && resumen.canales && resumen.canales.correo && resumen.canales.correo.conectado);
  try { resumen = await api.get(`/bandeja/resumen?client_id=${encodeURIComponent(id)}`); }
  catch (e) { resumen = { error: e.message }; }
  pintarCabecera();
  if (tab === 'embudo') pintarBarraCRM();
  // El filtro "Correo" depende del resumen, que llega después de pintar la
  // lista: si cambió, se vuelve a pintar el cuerpo para que aparezca.
  const conCorreo = !!(resumen && resumen.canales && resumen.canales.correo && resumen.canales.correo.conectado);
  if (conCorreo !== conCorreoAntes && tab === 'mensajes') pintarCuerpo();
}

// Borradores y avisos de los comentarios, por id: el refresco automático
// repinta la lista entera y antes borraba la respuesta a medio escribir y el
// aviso de "contéstalo en Instagram".
const borradorCom = new Map();
const fueraCom = new Map();

async function cargarLista({ silencioso = false, auto = false } = {}) {
  const id = cid();
  if (!id) return;
  // El embudo (CRM) se carga y se pinta solo (bandeja-crm.js).
  if (tab === 'embudo') { await cargarCRM({ silencioso }); return; }
  if (!silencioso) cargandoLista = true;
  try {
    if (tab === 'desempeno') {
      const [dd, ll] = await Promise.all([
        api.get(`/bandeja/desempeno?client_id=${encodeURIComponent(id)}&dias=${periodo}`),
        api.get(`/bandeja/llamadas?client_id=${encodeURIComponent(id)}&dias=${periodo}`).catch(() => null),
      ]);
      desempeno = dd;
      llamadasPanel = ll;
    } else if (tab === 'mensajes') {
      const qs = new URLSearchParams({ client_id: id });
      if (canal) qs.set('canal', canal);
      if (etapa) qs.set('etapa', etapa);
      if (soloSinLeer) qs.set('sin_leer', '1');
      if (asignado) qs.set('asignado', asignado);
      if (porSeguir) qs.set('por_seguir', '1');
      if (sinResponder) qs.set('sin_responder', '1');
      if (verArchivadas) qs.set('archivadas', '1');
      if (busqueda) qs.set('q', busqueda);
      const r = await api.get(`/bandeja/conversaciones?${qs}`);
      convs = r.conversaciones || [];
    } else {
      const qs = new URLSearchParams({ client_id: id, estado: estadoCom });
      if (canal === 'instagram' || canal === 'facebook') qs.set('canal', canal);
      const r = await api.get(`/bandeja/comentarios?${qs}`);
      coms = r.comentarios || [];
    }
  } catch (e) {
    if (tab === 'desempeno') desempeno = { error: e.message };
    if (!silencioso) toast(e.message, { type: 'error' });
  }
  cargandoLista = false;
  // El refresco silencioso del dashboard no repinta (no salta la pantalla).
  if (tab === 'desempeno' && silencioso) return;
  // Tampoco el automático mientras alguien escribe o toca un comentario: los
  // datos ya quedaron al día y se pintan en el siguiente refresco.
  if (auto) {
    const act = document.activeElement;
    if (act && act.closest && act.closest('.bj-com')) return;
  }
  pintarCuerpo();
}

async function abrirConv(convId, { silencioso = false } = {}) {
  if (!convAbierta || convAbierta.conversacion.id !== convId) plantillaClave = 'seguimiento';
  try {
    const r = await api.get(`/bandeja/conversaciones/${encodeURIComponent(convId)}`);
    convAbierta = r;
    const v = convs.find((x) => x.id === convId);
    if (v) v.no_leidos = 0;
    if (resumen && !silencioso) cargarResumen();
    pintarCuerpo();
    if (!silencioso) requestAnimationFrame(() => bajarChat(true));
  } catch (e) {
    if (!silencioso) toast(e.message, { type: 'error' });
  }
}

function programarRefresco() {
  clearInterval(timer);
  timer = setInterval(async () => {
    if (!mounted || document.hidden) return;
    if (tab !== 'desempeno') await cargarLista({ silencioso: true, auto: true });
    if (convAbierta) {
      const antes = convAbierta.mensajes.length;
      await abrirConv(convAbierta.conversacion.id, { silencioso: true });
      if (convAbierta && convAbierta.mensajes.length !== antes) bajarChat(false);
    }
    cargarResumen();
  }, REFRESCO_MS);
}

// ── Cabecera ─────────────────────────────────────────────────────────────────
let headEl = null, segEl = null, cuerpoEl = null;

function pintarCabecera() {
  if (!headEl) return;
  clear(headEl);
  const cli = clienteActivo();
  const r = resumen && !resumen.error ? resumen : null;
  headEl.append(...[
    el('div', { class: 'bj-head__fila' }, [
      el('div', { class: 'bj-head__txt' }, [
        el('h1', { class: 'bj-title', text: T('Bandeja', 'Inbox') }),
        el('p', { class: 'bj-sub', text: cli
          ? (sinComentarios()
            ? T(`Mensajes y llamadas de ${cli.name}, en un solo lugar.`, `Messages and calls for ${cli.name}, all in one place.`)
            : T(`Comentarios y mensajes de ${cli.name}, en un solo lugar.`, `Comments and messages for ${cli.name}, all in one place.`))
          : T('Elige una marca arriba.', 'Pick a brand above.') }),
      ].filter(Boolean)),
      // El agente marca si está disponible: si no, el reparto lo salta.
      esAgente() && r ? el('button', {
        type: 'button', class: 'bj-dispo' + (r.yo && r.yo.disponible ? ' is-on' : ''), 'aria-pressed': String(!!(r.yo && r.yo.disponible)),
        onclick: () => cambiarDisponible(!(r.yo && r.yo.disponible)),
      }, [el('span', { class: 'bj-dispo__punto' }), el('span', { text: r.yo && r.yo.disponible ? T('Disponible', 'Available') : T('No disponible', 'Away') })]) : null,
      esStaff() ? el('button', {
        class: 'btn btn-ghost btn-icon bj-gear', type: 'button', 'aria-label': T('Ajustes de la bandeja', 'Inbox settings'),
        onclick: abrirAjustes,
      }, [icon('settings', 18)]) : null,
    ].filter(Boolean)),
    // Aviso de demo: una línea, no un globo de dos renglones.
    r && r.demo ? el('p', { class: 'bj-demo' }, [
      icon('info', 14),
      el('span', { text: T('Demo: nada se envía a pacientes reales.', 'Demo: nothing reaches real patients.') }),
    ]) : null,
    // Al agente no le sirve el semáforo de conexiones (lo administra la agencia).
    // En el teléfono cada red es logo + punto verde (la cuenta solo en escritorio):
    // antes la fila se salía de la pantalla con "Messenger · SMI…".
    // Cada red es un BOTÓN que filtra los mensajes por esa red (14-oct-2026,
    // Israel: "los botones para seleccionar por redes no funcionan"); otro toque
    // quita el filtro. Va sincronizado con el menú "Red".
    r && !esAgente() ? el('div', { class: 'bj-canales', role: 'group', 'aria-label': T('Filtrar por red', 'Filter by network') }, [el('span', { class: 'bj-canales__lbl', text: T('Redes', 'Networks') }), ...['instagram', 'messenger', 'whatsapp', 'correo'].filter((k) => r.canales[k] && (k !== 'correo' || r.canales[k].conectado)).map((k) => {
      const c = r.canales[k];
      const sel = tab === 'mensajes' && canal === k;
      return el('button', {
        type: 'button', class: 'bj-canal' + (c.conectado ? ' is-on' : '') + (sel ? ' is-sel' : ''), style: { '--c': colorDe(k) },
        'aria-pressed': String(sel), title: sel ? T(`Quitar el filtro de ${CANAL_TXT[k]}`, `Clear the ${CANAL_TXT[k]} filter`) : T(`Ver solo ${CANAL_TXT[k]}`, `Show only ${CANAL_TXT[k]}`) + (c.cuenta ? ' · ' + c.cuenta : ''),
        onclick: () => filtrarRed(k),
      }, [
        icoCanal(k, 14),
        el('span', { class: 'bj-canal__red', text: CANAL_TXT[k] }),
        c.conectado && c.cuenta ? el('span', { class: 'bj-canal__cuenta', text: c.cuenta }) : null,
        c.conectado ? el('span', { class: 'bj-canal__ok', 'aria-label': T('conectado', 'connected') }) : el('span', { class: 'bj-canal__off', text: T('sin conectar', 'not connected') }),
      ].filter(Boolean));
    })]) : null,
  ].filter(Boolean));
  // Segmento de pestañas con contadores vivos.
  if (segEl) {
    clear(segEl);
    const nMsg = r ? r.no_leidos : 0;
    const nCom = r ? r.comentarios_pendientes : 0;
    segEl.append(...[
      el('button', { type: 'button', role: 'tab', 'data-tab': 'mensajes', class: tab === 'mensajes' ? 'is-active' : '', 'aria-selected': String(tab === 'mensajes'), onclick: () => cambiarTab('mensajes') }, [
        el('span', { text: T('Mensajes', 'Messages') }), nMsg ? el('span', { class: 'bj-seg__n', text: String(nMsg) }) : null,
      ].filter(Boolean)),
      // EMBUDO (CRM, 15-oct-2026): oportunidades por etapa y tareas. El número
      // son las tareas vencidas o de hoy.
      el('button', { type: 'button', role: 'tab', 'data-tab': 'embudo', class: tab === 'embudo' ? 'is-active' : '', 'aria-selected': String(tab === 'embudo'), onclick: () => cambiarTab('embudo') }, [
        el('span', { text: T('Embudo', 'Pipeline') }), r && r.tareas_hoy ? el('span', { class: 'bj-seg__n', text: String(r.tareas_hoy) }) : null,
      ].filter(Boolean)),
      sinComentarios() ? null : el('button', { type: 'button', role: 'tab', 'data-tab': 'comentarios', class: tab === 'comentarios' ? 'is-active' : '', 'aria-selected': String(tab === 'comentarios'), onclick: () => cambiarTab('comentarios') }, [
        el('span', { text: T('Comentarios', 'Comments') }), nCom ? el('span', { class: 'bj-seg__n', text: String(nCom) }) : null,
      ].filter(Boolean)),
      esSupervisor() ? el('button', { type: 'button', role: 'tab', 'data-tab': 'desempeno', class: tab === 'desempeno' ? 'is-active' : '', 'aria-selected': String(tab === 'desempeno'), onclick: () => cambiarTab('desempeno') }, [
        el('span', { text: T('Desempeño', 'Performance') }),
      ]) : null,
    ].filter(Boolean));
    // Una sola pestaña no navega a nada (agente de una marca solo CRM): fuera.
    segEl.hidden = segEl.children.length < 2;
    // Cuatro pestañas (equipo de la agencia) no caben en un renglón del
    // teléfono: ahí van en cuadrícula de 2×2 (bandeja.css, .bj-seg--4).
    segEl.classList.toggle('bj-seg--4', segEl.children.length >= 4);
  }
}

// Toque en una red de la cabecera: lleva a Mensajes con solo esa red; si ya
// estaba elegida, quita el filtro.
function filtrarRed(k) {
  const quitar = tab === 'mensajes' && canal === k;
  if (tab !== 'mensajes') {
    tab = 'mensajes';
    convAbierta = null;
    try { ctx.router.navigate(VIEW_ID, { cliente: cid() }); } catch { /* sin router */ }
  }
  canal = quitar ? '' : k;
  pintarCabecera();
  pintarCuerpo();
  cargarLista();
}

async function cambiarDisponible(si) {
  try {
    await api.patch('/bandeja/equipo/yo', { disponible: si });
    const me = yoMe();
    ctx.store.set({ me: { ...me, bandeja_disponible: si } });
    toast(si ? T('Listo: te llegan chats nuevos.', 'Done: new chats will reach you.') : T('Listo: no te llegarán chats nuevos hasta que vuelvas.', 'Done: no new chats until you are back.'), { type: 'success' });
    await cargarResumen();
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function cambiarTab(t) {
  if (tab === t) return;
  tab = t;
  canal = '';
  convAbierta = null;
  pintarCabecera();
  pintarCuerpo();
  cargarLista();
  try { ctx.router.navigate(VIEW_ID, { cliente: cid(), ...(t !== 'mensajes' ? { tab: t } : {}) }); } catch { /* sin router */ }
}

// ── Cuerpo ───────────────────────────────────────────────────────────────────
function pintarCuerpo() {
  if (!cuerpoEl) return;
  clear(cuerpoEl);
  rootEl.classList.toggle('is-chat', tab === 'mensajes' && !!convAbierta);
  // En escritorio, Mensajes ocupa justo la pantalla (bandeja.css, .is-msgs).
  rootEl.classList.toggle('is-msgs', tab === 'mensajes' && !!cid());
  rootEl.classList.toggle('is-emb', tab === 'embudo' && !!cid());
  if (!cid()) {
    cuerpoEl.appendChild(vacio('inbox', T('Elige una marca', 'Pick a brand'), T('La bandeja es por marca: elige una arriba.', 'The inbox is per brand: pick one above.')));
    return;
  }
  if (tab === 'mensajes') {
    const split = el('div', { class: 'bj-split' }, [
      el('section', { class: 'bj-lista' }, [filtrosMensajes(), listaConvs()]),
      el('section', { class: 'bj-chat' }, [convAbierta ? chat() : vacioChat()]),
    ]);
    cuerpoEl.appendChild(split);
  } else if (tab === 'embudo') {
    cuerpoEl.appendChild(panelEmbudo());
  } else if (tab === 'desempeno') {
    cuerpoEl.appendChild(panelDesempeno());
  } else {
    cuerpoEl.append(filtrosComentarios(), listaComentarios());
  }
}

function vacio(ico, titulo, texto, extra = null) {
  return el('div', { class: 'empty bj-empty' }, [
    el('div', { class: 'empty__icon' }, [icon(ico, 26)]),
    el('h3', { text: titulo }),
    el('p', { text: texto }),
    extra,
  ].filter(Boolean));
}

// `red` pinta el LOGO de la app (relleno) en vez de un ícono de trazo.
function chipFiltro(label, activo, onclick, ico = null, red = null) {
  return el('button', {
    type: 'button', class: 'bj-filtro' + (activo ? ' is-on' : '') + (red ? ' bj-filtro--red' : ''),
    style: red ? { '--c': colorDe(red) } : null, onclick,
  }, [
    red ? icoCanal(red, 14) : (ico ? icon(ico, 13) : null), el('span', { text: label }),
  ].filter(Boolean));
}

// ── Filtros: buscador + 3 menús (Mostrar · Red · Etapa) ────────────────────
// 14-oct-2026 (Israel: "que se vea profesional"): antes eran 7 chips sueltos
// en dos filas que se salían de la pantalla + el <select> nativo del teléfono
// (la ruedita de iOS). Regla de la casa: una fila que crece se agrupa en
// menús. Las opciones se arman AL TOCAR, así los contadores y los filtros del
// equipo siempre salen con el resumen al día (antes, si la lista llegaba antes
// que el resumen, "Míos" y "Sin asignar" no aparecían).
const VISTAS = [
  ['', 'inbox', () => T('Todos', 'All')],
  ['sin_leer', 'bell', () => T('Sin leer', 'Unread')],
  ['sin_responder', 'clock', () => T('Sin responder', 'Awaiting reply')],
  ['por_seguir', 'refresh', () => T('Por seguir', 'Follow up')],
  ['mios', 'user', () => T('Míos', 'Mine')],
  ['sin_asignar', 'users', () => T('Sin asignar', 'Unassigned')],
  // Lo archivado se puede ver y recuperar (antes archivar era sin regreso).
  ['archivadas', 'archive', () => T('Archivadas', 'Archived')],
];
function vistaActual() {
  if (soloSinLeer) return 'sin_leer';
  if (sinResponder) return 'sin_responder';
  if (porSeguir) return 'por_seguir';
  if (asignado === 'yo') return 'mios';
  if (asignado === 'sin') return 'sin_asignar';
  if (verArchivadas) return 'archivadas';
  return '';
}
function ponerVista(k) {
  soloSinLeer = k === 'sin_leer';
  sinResponder = k === 'sin_responder';
  porSeguir = k === 'por_seguir';
  asignado = k === 'mios' ? 'yo' : (k === 'sin_asignar' ? 'sin' : '');
  verArchivadas = k === 'archivadas';
}
// Botón de menú: etiqueta chica arriba, valor elegido abajo. Lleno = filtrando.
function menuFiltro({ titulo, hoja = '', valor, activo, opciones, alElegir }) {
  const b = el('button', {
    type: 'button', class: 'bj-menu' + (activo ? ' is-on' : ''), 'aria-haspopup': 'listbox', 'aria-label': `${titulo}: ${valor}`,
    onclick: async () => {
      const v = await ctx.sheet.pickFrom({ title: hoja || titulo, anchor: b, options: opciones() });
      if (v === null || v === undefined) return;
      alElegir(v);
    },
  }, [
    el('span', { class: 'bj-menu__txt' }, [el('span', { class: 'bj-menu__lbl', text: titulo }), el('span', { class: 'bj-menu__val', text: valor })]),
    icon('down', 14),
  ]);
  return b;
}
const icoPick = (k, n = 18) => el('span', { class: 'bj-pick-ico', style: { color: CANAL_COLOR[k] || 'currentColor' } }, [icoCanal(k, n)]);

function filtrosMensajes() {
  const vista = vistaActual();
  const vistaTxt = (VISTAS.find(([k]) => k === vista) || VISTAS[0])[2]();
  const menuVista = menuFiltro({
    titulo: T('Ver', 'View'), hoja: T('Qué conversaciones ver', 'Which conversations to see'), valor: vistaTxt, activo: !!vista,
    opciones: () => {
      const r = resumen && !resumen.error ? resumen : null;
      const hayEquipo = !!(r && r.equipo && r.equipo.length) || esAgente();
      const sub = {
        '': T('Todas las conversaciones', 'Every conversation'),
        sin_leer: r && r.no_leidos ? T(`${r.no_leidos} mensajes nuevos`, `${r.no_leidos} new messages`) : T('Nada nuevo por ahora', 'Nothing new right now'),
        sin_responder: T('El último mensaje es de la persona', 'The last message is from the person'),
        por_seguir: r && r.por_seguir ? T(`${r.por_seguir} llevan días sin contestar`, `${r.por_seguir} have gone quiet for days`) : T('Llevan días sin contestar', 'Gone quiet for days'),
        mios: T('Los que atiendes tú', 'The ones you handle'),
        archivadas: T('Para verlas o recuperarlas', 'To view or restore them'),
        sin_asignar: r && r.sin_asignar ? T(`${r.sin_asignar} sin agente`, `${r.sin_asignar} without an agent`) : T('Sin agente', 'Without an agent'),
      };
      return VISTAS.filter(([k]) => hayEquipo || (k !== 'mios' && k !== 'sin_asignar'))
        .map(([k, ico, f]) => ({ value: k, label: f(), sub: sub[k], icon: icon(ico, 18), current: vista === k }));
    },
    alElegir: (k) => { ponerVista(k); cargarLista(); pintarCuerpo(); },
  });
  const menuRed = menuFiltro({
    titulo: T('Red', 'Network'), hoja: T('Filtrar por red', 'Filter by network'), valor: canal ? CANAL_TXT[canal] || canal : T('Todas', 'All'), activo: !!canal,
    opciones: () => {
      const r = resumen && !resumen.error ? resumen : null;
      const redes = ['instagram', 'messenger', 'whatsapp'];
      if (r && r.canales && r.canales.correo && r.canales.correo.conectado) redes.push('correo');
      return [
        { value: '', label: T('Todas las redes', 'All networks'), icon: icon('inbox', 18), current: !canal },
        ...redes.map((k) => ({ value: k, label: CANAL_TXT[k], icon: icoPick(k), current: canal === k })),
      ];
    },
    alElegir: (k) => { canal = k; cargarLista(); pintarCabecera(); pintarCuerpo(); },
  });
  const menuEtapa = menuFiltro({
    titulo: T('Etapa', 'Stage'), hoja: T('Filtrar por etapa', 'Filter by stage'), valor: etapa ? ETAPA_TXT[etapa]() : T('Todas', 'All'), activo: !!etapa,
    opciones: () => [
      { value: '', label: T('Todas las etapas', 'All stages'), icon: icon('sliders', 18), current: !etapa },
      ...ETAPAS.map((k) => ({ value: k, label: ETAPA_TXT[k](), color: ETAPA_COLOR[k], current: etapa === k })),
    ],
    alElegir: (k) => { etapa = k; cargarLista(); pintarCuerpo(); },
  });
  const buscar = el('input', {
    class: 'bj-buscar__in', type: 'search', enterkeyhint: 'search', autocomplete: 'off', id: 'bj-buscar',
    placeholder: T('Buscar persona o texto', 'Search person or text'), 'aria-label': T('Buscar', 'Search'), value: busqueda,
    oninput: (e) => { busqueda = e.target.value.trim(); clearTimeout(buscar._t); buscar._t = setTimeout(() => cargarLista(), 350); },
  });
  return el('div', { class: 'bj-filtros-wrap' }, [
    el('label', { class: 'bj-buscar' }, [icon('search', 17), buscar]),
    el('div', { class: 'bj-menus' + (vista && canal && etapa ? ' is-llenos' : '') }, [menuVista, menuRed, menuEtapa]),
  ]);
}

function listaConvs() {
  if (cargandoLista && !convs.length) return el('div', { class: 'bj-cargando' }, [el('span', { class: 'spinner' })]);
  if (!convs.length) {
    const r = resumen && !resumen.error ? resumen : null;
    const nada = r && !r.canales.instagram.conectado && !r.canales.messenger.conectado && !r.canales.whatsapp.conectado;
    return vacio('inbox',
      nada ? T('Conecta una red primero', 'Connect a network first') : T('Sin conversaciones', 'No conversations'),
      nada
        ? T('Conecta Instagram o Facebook en Conexiones y los mensajes de esta marca aparecerán aquí.', 'Connect Instagram or Facebook in Connections and this brand’s messages will show up here.')
        : (soloSinLeer || canal || etapa || busqueda || asignado || porSeguir || sinResponder || verArchivadas
          ? T('Nada con esos filtros.', 'Nothing matches those filters.')
          : T('Cuando alguien escriba a esta marca por Instagram, Messenger o WhatsApp, aparece aquí y te avisamos.', 'When someone messages this brand on Instagram, Messenger or WhatsApp it shows up here and we notify you.')));
  }
  const ul = el('div', { class: 'bj-convs', role: 'list' });
  for (const v of convs) {
    const activa = convAbierta && convAbierta.conversacion.id === v.id;
    // Fila estilo WhatsApp: filo de color de la app, avatar con su ícono,
    // nombre + hora arriba, último mensaje + globo de no leídos abajo. La etapa
    // del CRM vive como un punto de color, para no competir con el mensaje.
    ul.appendChild(el('button', {
      type: 'button', role: 'listitem',
      class: 'bj-conv' + (v.no_leidos ? ' is-unread' : '') + (activa ? ' is-active' : ''),
      style: { '--c': colorDe(v.canal) },
      'aria-label': `${nombreDe(v)} · ${CANAL_TXT[v.canal] || v.canal}${v.no_leidos ? ` · ${v.no_leidos} ${T('sin leer', 'unread')}` : ''}`,
      onclick: () => abrirConv(v.id),
    }, [
      el('span', { class: 'bj-avatar' }, [el('span', { text: initials(nombreDe(v)) }), el('span', { class: 'bj-avatar__ico' }, [icoCanal(v.canal, 11)])]),
      el('span', { class: 'bj-conv__txt' }, [
        el('span', { class: 'bj-conv__fila' }, [
          el('span', { class: 'bj-conv__nombre', text: nombreDe(v) }),
          el('span', { class: 'bj-conv__hora', text: timeAgo(v.ultimo_en) }),
        ]),
        // Etapa del CRM (con su nombre, no un punto mudo), quién lo atiende y si
        // vino de un anuncio.
        el('span', { class: 'bj-conv__tags' }, [
          el('span', { class: 'bj-tag bj-tag--etapa', style: { '--e': ETAPA_COLOR[v.etapa] || 'var(--text-mute)' } }, [
            el('span', { class: 'bj-tag__punto' }), el('span', { text: (ETAPA_TXT[v.etapa] || (() => v.etapa || ''))() }),
          ]),
          v.asignado_nombre && !esAgente() ? el('span', { class: 'bj-tag bj-tag--agente' }, [icon('user', 11), el('span', { text: v.asignado_nombre.split(' ')[0] })]) : null,
          !v.asignado_a && (esAgente() || equipoAgentes().length) ? el('span', { class: 'bj-tag bj-tag--libre', text: T('Sin asignar', 'Unassigned') }) : null,
          origenAnuncio(v) ? el('span', { class: 'bj-tag bj-tag--ad', text: T('Anuncio', 'Ad') }) : null,
        ].filter(Boolean)),
        el('span', { class: 'bj-conv__fila' }, [
          el('span', { class: 'bj-conv__ultimo', text: v.ultimo_texto || '' }),
          v.no_leidos ? el('span', { class: 'bj-conv__n', text: String(v.no_leidos) }) : null,
        ].filter(Boolean)),
      ].filter(Boolean)),
    ]));
  }
  return ul;
}

function vacioChat() {
  return el('div', { class: 'bj-chat__vacio' }, [
    icon('inbox', 28),
    el('p', { text: T('Elige una conversación para leerla y contestar.', 'Pick a conversation to read and reply.') }),
  ]);
}

// ── Chat ─────────────────────────────────────────────────────────────────────
let msgsEl = null, composerEl = null;

function bajarChat(instantaneo) {
  if (!msgsEl) return;
  msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: instantaneo ? 'auto' : 'smooth' });
}

function chat() {
  const { conversacion: v, mensajes } = convAbierta;
  const eventos = convAbierta.eventos || [];
  const horas = horasDesde(v.ultimo_cliente_en);
  // El correo no tiene ventana de 24 h: se puede contestar cuando sea.
  const cerrada = v.canal !== 'correo' && horas > 24;
  const esWa = v.canal === 'whatsapp';
  const r = resumen && !resumen.error ? resumen : null;
  // WhatsApp: pasadas 24 h el texto sale dentro de la plantilla abierta.
  const usaPlantilla = esWa && (horas >= 23.9 || plantillaClave === 'confirmacion');
  const plantillasMarca = (r && r.plantillas) || {};
  const head = el('header', { class: 'bj-chat__head', style: { '--c': colorDe(v.canal) } }, [
    el('button', { type: 'button', class: 'btn btn-ghost btn-icon bj-back', 'aria-label': T('Volver a la lista', 'Back to the list'), onclick: () => { convAbierta = null; pintarCuerpo(); } }, [icon('left', 20)]),
    el('span', { class: 'bj-avatar' }, [el('span', { text: initials(nombreDe(v)) }), el('span', { class: 'bj-avatar__ico' }, [icoCanal(v.canal, 11)])]),
    el('div', { class: 'bj-chat__quien' }, [
      el('div', { class: 'bj-chat__nombre', text: nombreDe(v) }),
      // Segundo renglón: canal, @usuario, la etapa (tocable) y quién lo atiende.
      el('div', { class: 'bj-chat__meta' }, [
        el('span', { class: 'bj-chat__canal' }, [chipCanal(v.canal)]),
        v.username && v.nombre ? el('span', { class: 'muted bj-chat__user', text: '@' + v.username }) : null,
        el('button', { type: 'button', class: 'bj-etapa', 'aria-label': T('Cambiar etapa', 'Change stage'), onclick: async (e) => {
          const nueva = await ctx.sheet.pickFrom({ title: T('Etapa', 'Stage'), anchor: e.currentTarget, options: ETAPAS.map((k) => ({ value: k, label: ETAPA_TXT[k](), color: ETAPA_COLOR[k], current: v.etapa === k })) });
          // Mismo camino que el embudo: Perdido pide el motivo y Cita la fecha.
          if (nueva && nueva !== v.etapa) await cambiarEtapaCRM(v, nueva, { anchor: e.currentTarget });
        } }, [el('span', { class: 'bj-etapa__punto', style: { '--e': ETAPA_COLOR[v.etapa] || 'var(--text-mute)' } }), el('span', { class: 'bj-etapa__txt', text: (ETAPA_TXT[v.etapa] || (() => v.etapa || ''))() }), icon('down', 13)]),
        botonAsignado(v),
      ].filter(Boolean)),
    ]),
    el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': T('Llamada', 'Call'), title: T('Llamar o registrar llamada', 'Call or log a call'), onclick: () => abrirLlamada(v) }, [icon('phone', 18)]),
    // La ficha ahora es la OPORTUNIDAD completa (datos, plan, tareas, historial).
    el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': T('Oportunidad: datos, plan, tareas e historial', 'Deal: details, plan, tasks and history'), title: T('Oportunidad', 'Deal'), onclick: () => abrirOportunidad(v.id) }, [icon('briefcase', 18)]),
  ]);

  msgsEl = el('div', { class: 'bj-msgs' });
  const origen = origenAnuncio(v);
  if (origen) {
    msgsEl.appendChild(el('div', { class: 'bj-nota bj-nota--ad' }, [
      el('span', { text: T('Llegó por el anuncio', 'Came from the ad') + (origen.titulo ? `: “${origen.titulo}”` : '') }),
    ]));
  }
  // Mensajes, eventos del equipo (asignaciones, llamadas anotadas a mano) y
  // llamadas con la línea (grabadas) en una sola línea de tiempo. El evento de
  // una llamada grabada no se pinta: su tarjeta ya lo dice todo.
  const llamadas = convAbierta.llamadas || [];
  const linea = [
    ...mensajes.map((m) => ({ t: m.creado, m })),
    ...eventos.filter((e) => !(e.tipo === 'llamada' && e.dato && e.dato.llamada_id)).map((e) => ({ t: e.creado, e })),
    ...llamadas.filter((l) => !['no_contesto_agente', 'cancelada', 'iniciando'].includes(l.estado)).map((l) => ({ t: l.creado, l })),
  ].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  // "Todavía no hay mensajes" solo si de verdad no hay nada: antes salía
  // junto a la tarjeta de un mensaje de voz (14-oct-2026, captura de Israel).
  if (!linea.length) msgsEl.appendChild(el('p', { class: 'muted bj-msgs__nada', text: T('Todavía no hay mensajes.', 'No messages yet.') }));
  let diaPrev = '';
  for (const it of linea) {
    const dia = String(it.t || '').slice(0, 10);
    if (dia !== diaPrev) { msgsEl.appendChild(el('div', { class: 'bj-dia', text: fmtDia(dia) })); diaPrev = dia; }
    msgsEl.appendChild(it.m ? burbuja(it.m) : (it.l ? tarjetaLlamada(it.l) : notaEvento(it.e)));
  }

  const draft = borradores.get(v.id) || '';
  // Instagram y Messenger: pasados 7 días Meta ya no acepta nada por la API
  // (ni como agente humano). El campo se apaga y manda el botón de la app.
  const sinApi = !esWa && v.canal !== 'correo' && horas > 24 * 7;
  const ta = el('textarea', { class: 'textarea bj-ta', rows: 1, disabled: sinApi, placeholder: sinApi
    ? (v.canal === 'instagram' ? T('Escríbele desde Instagram con el botón de arriba', 'Write from Instagram using the button above') : T('Escríbele desde Business Suite con el botón de arriba', 'Write from Business Suite using the button above'))
    : usaPlantilla ? T('Escribe tu mensaje…', 'Write your message…') : T('Escribe tu respuesta…', 'Write your reply…'),
    oninput: (e) => { borradores.set(v.id, e.target.value); autoAlto(e.target); if (usaPlantilla) pintarVistaPrevia(v, e.target.value); },
    onkeydown: (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); enviar(v, ta); } } }, [draft]);
  requestAnimationFrame(() => autoAlto(ta));
  const btnIA = el('button', { type: 'button', class: 'btn btn-sm bj-ia', disabled: sinApi, onclick: () => sugerirConv(v, ta, btnIA) }, [icon('sparkles', 14), ' ' + T('Sugerir', 'Suggest')]);
  const btnEnviar = el('button', { type: 'button', class: 'bj-enviar', disabled: sinApi, 'aria-label': T('Enviar', 'Send'), title: T('Enviar', 'Send'), onclick: () => enviar(v, ta) }, [icon('send', 19)]);

  const avisos = [];
  if (esWa) {
    const pl = plantillasMarca[plantillaClave] || {};
    const aprobada = pl.estado === 'APPROVED';
    if (usaPlantilla) {
      // Compacta (14-oct-2026): en el teléfono la caja se comía medio chat.
      // Renglón 1: por qué va en plantilla + costo. Renglón 2: tipo + conteo.
      avisos.push(el('div', { class: 'bj-plantilla' }, [
        el('div', { class: 'bj-plantilla__fila' }, [
          el('strong', { class: 'bj-plantilla__tit', text: horas >= 23.9
            ? T('Más de 24 h: va en plantilla', 'Over 24 h: sent as a template')
            : T('Con botones de confirmación', 'With confirmation buttons') }),
          // Meta decide la categoría: utilidad ≈ USD 0.0085, marketing ≈ USD 0.0397 (México, oct-2026).
          el('span', { class: 'bj-plantilla__costo', text: pl.categoria === 'MARKETING'
            ? T('≈ 75 centavos (Meta la cobra como marketing)', '≈ USD 0.04 (billed as marketing)')
            : pl.categoria ? T('≈ 15 centavos', '≈ USD 0.01') : T('≈ 15 a 75 centavos, según la categoría que le dé Meta', '≈ USD 0.01 to 0.04, depending on the category Meta assigns') }),
        ]),
        el('div', { class: 'bj-plantilla__fila' }, [
          el('div', { class: 'seg bj-plantilla__seg', role: 'tablist' }, [
            ['seguimiento', T('Seguimiento', 'Follow-up')], ['confirmacion', T('Con botones', 'With buttons')],
          ].map(([k, lbl]) => el('button', { type: 'button', role: 'tab', class: plantillaClave === k ? 'is-active' : '', onclick: () => { plantillaClave = k; pintarCuerpo(); } }, [lbl]))),
          el('span', { class: 'bj-plantilla__cuenta', 'aria-live': 'polite' }),
        ]),
        !aprobada ? el('p', { class: 'bj-aviso', text: pl.estado === 'PENDING' || pl.estado === 'IN_APPEAL'
          ? T('Meta todavía está revisando esta plantilla. En cuanto la apruebe se puede enviar.', 'Meta is still reviewing this template. It can be sent once approved.')
          : (pl.estado
            ? T(`La plantilla está en estado ${pl.estado}${pl.motivo ? ' (' + pl.motivo + ')' : ''}.`, `The template status is ${pl.estado}${pl.motivo ? ' (' + pl.motivo + ')' : ''}.`)
            : T('Esta marca todavía no tiene sus plantillas abiertas. Créalas en Ajustes de la bandeja.', 'This brand has no open templates yet. Create them in Inbox settings.')) }) : null,
        el('div', { class: 'bj-plantilla__previa' }),
      ].filter(Boolean)));
    } else if (horas < 24) {
      const quedan = Math.max(0, 24 - horas);
      avisos.push(el('div', { class: 'bj-ventana' }, [
        el('span', { text: T(`Ventana abierta: quedan ${quedan >= 1 ? Math.floor(quedan) + ' h' : Math.round(quedan * 60) + ' min'} para escribir libre y gratis.`, `Window open: ${quedan >= 1 ? Math.floor(quedan) + ' h' : Math.round(quedan * 60) + ' min'} left to write freely.`) }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { plantillaClave = 'confirmacion'; pintarCuerpo(); } }, [T('Mandar con botones de confirmación', 'Send with confirmation buttons')]),
      ]));
    }
  } else if (cerrada && v.canal !== 'correo') {
    const dias = horas / 24;
    avisos.push(el('div', { class: 'bj-aviso bj-aviso--app' }, [
      el('span', { text: dias > 7
        ? T('Pasaron más de 7 días: Meta ya no deja contestar desde aquí. Escríbele desde la app y el mensaje se registra igual.', 'More than 7 days: Meta no longer allows replies from here. Write from the app and it is still logged.')
        : T('Pasaron más de 24 h: se intenta como agente humano (hasta 7 días). Si Meta lo rechaza, escríbele desde la app.', 'Over 24 h: we try as a human agent (up to 7 days). If Meta rejects it, write from the app.') }),
      botonAbrirApp(v),
    ].filter(Boolean)));
  }
  composerEl = el('div', { class: 'bj-composer' + (usaPlantilla ? ' is-plantilla' : '') }, [
    ...avisos,
    el('div', { class: 'bj-composer__fila' }, [ta, el('div', { class: 'bj-composer__btns' }, [btnIA, btnEnviar])]),
  ]);
  if (usaPlantilla) requestAnimationFrame(() => pintarVistaPrevia(v, ta.value));

  return el('div', { class: 'bj-chat__in', style: { '--c': colorDe(v.canal) } }, [head, msgsEl, composerEl]);
}

// Quién atiende el chat. Supervisor: elige agente. Agente: "Tomar" si no tiene dueño.
function botonAsignado(v) {
  const agentes = equipoAgentes();
  if (!agentes.length && !v.asignado_a && !esAgente()) return null;
  if (esAgente()) {
    if (v.asignado_a) return el('span', { class: 'bj-asignado is-mio' }, [icon('user', 12), el('span', { text: T('Tuyo', 'Yours') })]);
    return el('button', { type: 'button', class: 'bj-asignado is-libre', onclick: () => tomarConv(v) }, [icon('plus', 12), el('span', { text: T('Tomar', 'Take it') })]);
  }
  return el('button', { type: 'button', class: 'bj-asignado' + (v.asignado_a ? '' : ' is-libre'), 'aria-label': T('Asignar a un agente', 'Assign to an agent'), onclick: async (e) => {
    const opciones = [
      ...agentes.map((a) => ({ value: a.id, label: a.nombre + (a.disponible ? '' : ' · ' + T('no disponible', 'away')), current: v.asignado_a === a.id })),
      { value: '__nadie', label: T('Sin asignar', 'Unassigned'), current: !v.asignado_a },
    ];
    const elegido = await ctx.sheet.pickFrom({ title: T('Asignar a', 'Assign to'), anchor: e.currentTarget, options: opciones });
    if (!elegido || elegido === v.asignado_a || (elegido === '__nadie' && !v.asignado_a)) return;
    try {
      const x = await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/asignar`, { user_id: elegido === '__nadie' ? null : elegido });
      toast(x.asignado_nombre ? T(`Asignado a ${x.asignado_nombre}`, `Assigned to ${x.asignado_nombre}`) : T('Quedó sin asignar', 'Now unassigned'), { type: 'success' });
      await abrirConv(v.id, { silencioso: true });
      cargarLista({ silencioso: true });
    } catch (err) { toast(err.message, { type: 'error' }); }
  } }, [icon('users', 12), el('span', { text: v.asignado_nombre || T('Sin asignar', 'Unassigned') }), icon('down', 12)]);
}

async function tomarConv(v) {
  try {
    await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/asignar`, { user_id: yoMe().id });
    toast(T('Listo: este chat ya es tuyo.', 'Done: this chat is yours now.'), { type: 'success' });
    await abrirConv(v.id, { silencioso: true });
    cargarLista({ silencioso: true });
    cargarResumen();
  } catch (e) { toast(e.message, { type: 'error' }); }
}

// Instagram y Messenger: desde la app de Meta se puede escribir sin límite de
// días y el mensaje llega a la Bandeja como eco (a nombre de quien tocó aquí).
function botonAbrirApp(v) {
  let href = null;
  if (v.canal === 'instagram' && v.username) href = `https://ig.me/m/${encodeURIComponent(v.username)}`;
  else if (v.canal === 'instagram') href = 'https://www.instagram.com/direct/inbox/';
  else if (v.canal === 'messenger') href = 'https://business.facebook.com/latest/inbox/all';
  if (!href) return null;
  return el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener', onclick: () => {
    api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/abrir-app`, {}).catch(() => {});
  } }, [icon('link', 14), ' ' + (v.canal === 'instagram' ? T('Abrir en Instagram', 'Open in Instagram') : T('Abrir en Business Suite', 'Open in Business Suite'))]);
}

// Así le va a llegar: saludo y cierre fijos + el texto del agente en un solo párrafo.
async function pintarVistaPrevia(v, texto) {
  const box = composerEl && composerEl.querySelector('.bj-plantilla__previa');
  if (!box) return;
  const clave = plantillaClave;
  const k = `${v.id}:${clave}`;
  let info = infoPlantilla.get(k);
  if (!info) {
    try { info = await api.get(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/plantilla?clave=${clave}`); infoPlantilla.set(k, info); }
    catch { return; }
  }
  if (!composerEl || !composerEl.contains(box)) return;
  const limpio = String(texto || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const n = Array.from(limpio).length;
  clear(box);
  // OJO: DOMElement.append(null) pinta la palabra "null" (auditoría 8-oct-2026,
  // se veía bajo la vista previa cuando la plantilla no lleva botones).
  box.append(...[
    el('span', { class: 'bj-plantilla__lbl', text: T('Así le llega:', 'This is what they get:') }),
    el('span', { class: 'bj-plantilla__txt' }, [
      el('span', { class: 'bj-plantilla__fijo', text: info.antes }),
      el('span', { class: 'bj-plantilla__libre', text: limpio || T('[tu mensaje]', '[your message]') }),
      el('span', { class: 'bj-plantilla__fijo', text: info.despues }),
    ]),
    info.botones && info.botones.length ? el('span', { class: 'bj-plantilla__btns' }, info.botones.map((b) => el('span', { class: 'bj-plantilla__btn', text: b }))) : null,
    /[\r\n]/.test(texto || '') ? el('span', { class: 'bj-plantilla__nota', text: T('Los saltos de línea se vuelven espacios.', 'Line breaks become spaces.') }) : null,
  ].filter(Boolean));
  const cuenta = composerEl.querySelector('.bj-plantilla__cuenta');
  if (cuenta) { cuenta.textContent = `${n} / ${info.max}`; cuenta.classList.toggle('is-mal', n > info.max); }
}

// Llamadas y asignaciones dentro del chat, como notas pequeñas.
function notaEvento(e) {
  // Eventos del CRM (etapa, tarea, plan, cita, comentario): mismo texto que el historial.
  const crm = textoEvento(e);
  if (crm) {
    return el('div', { class: 'bj-nota bj-nota--crm' + (e.tipo === 'nota' ? ' bj-nota--comentario' : '') }, [
      icon(iconoEvento(e.tipo, e.dato), 12),
      el('span', { text: crm + ' · ' + horaCorta(e.creado) }),
    ]);
  }
  return el('div', { class: 'bj-nota' + (e.tipo === 'llamada' ? ' bj-nota--llamada' : '') }, [
    e.tipo === 'llamada' ? icon('phone', 12) : icon('user', 12),
    el('span', { text: textoNotaEvento(e) + ' · ' + horaCorta(e.creado) }),
  ]);
}
function textoNotaEvento(e) {
  const d = e.dato || {};
  let txt = '';
  if (e.tipo === 'llamada') {
    txt = T(`${e.user_nombre || 'Alguien'} llamó · ${(RESULTADO_TXT[d.resultado] || (() => d.resultado))()}`, `${e.user_nombre || 'Someone'} called · ${(RESULTADO_TXT[d.resultado] || (() => d.resultado))()}`)
      + (d.minutos ? ` · ${d.minutos} min` : '') + (d.nota ? ` · “${d.nota}”` : '');
  } else if (e.tipo === 'tomada') txt = T(`${e.user_nombre || 'Alguien'} tomó el chat`, `${e.user_nombre || 'Someone'} took the chat`);
  else if (e.tipo === 'reasignacion') txt = T(`Reasignado a ${e.user_nombre || '—'}`, `Reassigned to ${e.user_nombre || '—'}`) + (d.motivo ? ` · ${d.motivo}` : '') + (d.por ? T(` · por ${d.por}`, ` · by ${d.por}`) : '');
  else txt = T(`Asignado a ${e.user_nombre || '—'}`, `Assigned to ${e.user_nombre || '—'}`) + (d.por ? T(` · por ${d.por}`, ` · by ${d.por}`) : '');
  return txt;
}

// ── LLAMADAS ─────────────────────────────────────────────────────────────────
// Con la LÍNEA de la marca conectada (Twilio, 10-oct-2026, pedido de Sebas de
// SMILE NOW): el agente toca Llamar, le entra la llamada a SU celular desde el
// número de la clínica, presiona una tecla y se marca al paciente. Se graba,
// se transcribe y aquí mismo elige cómo salió. Sin línea: como siempre (tel: y
// registro a mano), que también sirve para lo que se llamó por fuera.
const ESTADO_LLAMADA = {
  iniciando: () => T('Preparando la llamada…', 'Preparing the call…'),
  llamando_agente: () => T('Llamando a tu celular…', 'Calling your phone…'),
  confirmando: () => T('Contestaste: presiona cualquier tecla en tu teléfono para marcarle.', 'You answered: press any key on your phone to dial.'),
  llamando_paciente: () => T('Marcando al paciente…', 'Dialing the patient…'),
  en_curso: () => T('En llamada', 'On the call'),
  sonando: () => T('Sonando…', 'Ringing…'),
  terminada: () => T('Terminó', 'Ended'),
  no_contesto: () => T('No contestó', 'No answer'),
  ocupado: () => T('Ocupado', 'Busy'),
  fallida: () => T('No se pudo llamar', 'Call failed'),
  cancelada: () => T('Cancelada', 'Canceled'),
  no_contesto_agente: () => T('No contestaste en tu celular o no presionaste ninguna tecla.', 'You did not answer on your phone or pressed no key.'),
  perdida: () => T('Nadie contestó', 'Nobody answered'),
  buzon: () => T('Dejó mensaje de voz', 'Left a voicemail'),
};
const estadoLlamadaTxt = (e) => (ESTADO_LLAMADA[e] ? ESTADO_LLAMADA[e]() : e);
function fmtDur(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// +52 998 123 4567 para mostrar en los campos.
function fmtTelUI(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3);
  if (d.length === 12 && d.startsWith('52')) return `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? '+' + d : '';
}
function telDeConv(v) {
  if (v.telefono) return v.telefono;
  if (v.canal === 'whatsapp' && v.contacto_id) return '+' + v.contacto_id;
  return '';
}
const lineaMarca = () => { const r = resumen && !resumen.error ? resumen : null; return r && r.llamadas && r.llamadas.conectada ? r.llamadas : null; };
const segDesde = (iso) => { const d = new Date(String(iso || '').replace(' ', 'T') + 'Z'); return isNaN(d) ? 0 : Math.max(0, (Date.now() - d.getTime()) / 1000); };

function abrirLlamada(v, { alCerrar = null } = {}) {
  const linea = lineaMarca();
  let parar = () => {};
  ctx.sheet.openSheet({
    title: T('Llamada', 'Call'),
    mode: 'form',
    onClose: () => { parar(); if (alCerrar) alCerrar(); },
    build(body, close) {
      if (linea) parar = seccionLlamarConLinea(body, v, linea, close);
      else if (esStaff()) body.appendChild(el('p', { class: 'muted bj-aj__p', text: T('Para que las llamadas salgan con el número de la clínica, se graben y se transcriban, conecta la línea de la marca en Ajustes de la bandeja.', 'To call with the clinic number, record and transcribe, connect the brand line in Inbox settings.') }));
      seccionRegistroManual(body, v, close, { plegado: !!linea });
    },
  });
}

// Llamar con la línea: campos, botón y el estado EN VIVO de la llamada.
// Devuelve la función que detiene el sondeo (al cerrar la hoja).
function seccionLlamarConLinea(body, v, linea, close) {
  const r = resumen && !resumen.error ? resumen : null;
  const fPac = el('input', { id: 'bj-tel-paciente', class: 'input', type: 'tel', inputmode: 'tel', autocomplete: 'off', value: fmtTelUI(telDeConv(v)), placeholder: T('Ej. 998 123 4567', 'E.g. 998 123 4567') });
  const fMio = el('input', { id: 'bj-tel-mio', class: 'input', type: 'tel', inputmode: 'tel', autocomplete: 'tel', value: fmtTelUI((r && r.yo && r.yo.telefono) || ''), placeholder: T('Ej. 998 765 4321', 'E.g. 998 765 4321') });
  const form = el('div', { class: 'bj-llamar-form' }, [
    el('div', { class: 'field' }, [el('label', { class: 'label', for: 'bj-tel-paciente', text: T('Número del paciente', 'Patient number') }), fPac]),
    el('div', { class: 'field' }, [el('label', { class: 'label', for: 'bj-tel-mio', text: T('Tu celular (ahí te entra la llamada)', 'Your phone (the call rings here)') }), fMio]),
    el('p', { class: 'muted bj-aj__p', text: T(
      `Te llamamos a tu celular desde ${linea.numero}. Contesta y presiona cualquier tecla: en ese momento marcamos al paciente con el número de la clínica. La llamada se graba y se transcribe sola.`,
      `We call your phone from ${linea.numero}. Answer and press any key: then we dial the patient with the clinic number. The call is recorded and transcribed automatically.`) }),
  ]);
  const btn = el('button', { type: 'button', class: 'btn btn-primary bj-llamar' }, [icon('phone', 16), ' ' + T('Llamar con la línea de la clínica', 'Call with the clinic line')]);
  const vivoEl = el('div', { class: 'bj-vivo', 'aria-live': 'polite', hidden: true });
  body.append(form, btn, vivoEl);

  let vivo = null, tPoll = null, tTick = null, finEn = 0, pidioTrans = false, resultado = '';
  const parar = () => { clearTimeout(tPoll); clearInterval(tTick); tPoll = null; tTick = null; };

  async function iniciar() {
    if (btn.dataset.loading) return;
    btn.dataset.loading = 'true';
    try {
      const x = await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/llamar`, { numero: fPac.value.trim(), mi_numero: fMio.value.trim() });
      if (resumen && resumen.yo) resumen.yo.telefono = fMio.value.trim();
      seguir(x.llamada);
    } catch (e) {
      if (e.status === 409 && e.data && e.data.llamada) { toast(e.message, { type: 'error' }); seguir(e.data.llamada); }
      else {
        toast(e.message, { type: 'error', ms: 9000 });
        if (e.data && e.data.falta === 'mi_numero') fMio.focus();
        else if (e.data && e.data.falta === 'numero') fPac.focus();
      }
    } finally { delete btn.dataset.loading; }
  }
  btn.addEventListener('click', iniciar);

  function seguir(l) {
    vivo = l; finEn = 0; pidioTrans = false; resultado = l.resultado || '';
    form.hidden = true; btn.hidden = true;
    pintar();
    parar();
    tTick = setInterval(() => { const t = vivoEl.querySelector('.bj-vivo__t'); if (t && vivo && vivo.estado === 'en_curso') t.textContent = fmtDur(segDesde(vivo.contestada_en)); }, 1000);
    tPoll = setTimeout(sondear, 1200);
  }

  async function sondear() {
    if (!body.isConnected) { parar(); return; }
    try { const x = await api.get(`/bandeja/llamadas/${encodeURIComponent(vivo.id)}`); const antes = vivo; vivo = x.llamada; if (!resultado && vivo.resultado) resultado = vivo.resultado; if (JSON.stringify(antes) !== JSON.stringify(vivo)) pintar(); }
    catch { /* se reintenta */ }
    let espera = 1500;
    if (!vivo.activa) {
      espera = 3000;
      if (!finEn) { finEn = Date.now(); abrirConv(v.id, { silencioso: true }); }
      const pendiente = vivo.grabada && !['lista', 'error', 'sin_ia'].includes(vivo.transcripcion_estado);
      // La grabación tarda unos segundos en llegar; sin ella a los 25 s no la hubo.
      if (!vivo.grabada && Date.now() - finEn > 25000) { parar(); return; }
      if (vivo.grabada && !pendiente) { parar(); abrirConv(v.id, { silencioso: true }); return; }
      if (pendiente && !pidioTrans && vivo.transcripcion_estado !== 'procesando' && Date.now() - finEn > 45000) {
        pidioTrans = true;
        api.post(`/bandeja/llamadas/${encodeURIComponent(vivo.id)}/transcribir`, {}, { timeout: 180000 }).catch(() => {});
      }
      if (Date.now() - finEn > 300000) { parar(); return; }
    }
    tPoll = setTimeout(sondear, espera);
  }

  async function colgar(b) {
    b.dataset.loading = 'true';
    try { const x = await api.post(`/bandeja/llamadas/${encodeURIComponent(vivo.id)}/colgar`, {}); vivo = x.llamada; pintar(); }
    catch (e) { toast(e.message, { type: 'error' }); }
    finally { delete b.dataset.loading; }
  }

  function pintar() {
    const l = vivo;
    clear(vivoEl);
    vivoEl.hidden = false;
    if (l.activa) {
      // OJO: append() pinta "null" (a diferencia de el()): se filtra.
      vivoEl.append(...[
        el('div', { class: 'bj-vivo__fila is-viva' }, [
          el('span', { class: 'bj-vivo__punto', 'aria-hidden': 'true' }),
          el('strong', { text: estadoLlamadaTxt(l.estado) }),
          l.estado === 'en_curso' ? el('span', { class: 'bj-vivo__t', text: fmtDur(segDesde(l.contestada_en)) }) : null,
        ].filter(Boolean)),
        l.estado === 'en_curso' ? el('p', { class: 'muted bj-aj__p', text: T('Se está grabando. Al colgar aparece aquí la transcripción.', 'Recording. The transcript shows up here after you hang up.') }) : null,
        el('button', { type: 'button', class: 'btn btn-danger bj-llamar', onclick: (e) => colgar(e.currentTarget) }, [icon('close', 16), ' ' + T('Colgar', 'Hang up')]),
      ].filter(Boolean));
      return;
    }
    const sinPaciente = ['no_contesto_agente', 'cancelada'].includes(l.estado) || (l.estado === 'fallida' && !l.resultado);
    vivoEl.append(el('div', { class: 'bj-vivo__fila' + (l.estado === 'terminada' ? ' is-ok' : ' is-mal') }, [
      icon(l.estado === 'terminada' ? 'check' : 'warning', 16),
      el('strong', { text: estadoLlamadaTxt(l.estado) + (l.duracion_seg ? ' · ' + fmtDur(l.duracion_seg) : '') }),
    ]));
    if (l.error) vivoEl.appendChild(el('p', { class: 'bj-aviso', text: l.error }));
    if (sinPaciente) {
      vivoEl.appendChild(el('button', { type: 'button', class: 'btn bj-llamar', onclick: () => { clear(vivoEl); vivoEl.hidden = true; form.hidden = false; btn.hidden = false; } }, [icon('refresh', 16), ' ' + T('Intentar de nuevo', 'Try again')]));
      return;
    }
    // Transcripción.
    const t = l.transcripcion;
    if (t && t.resumen) {
      vivoEl.appendChild(el('div', { class: 'bj-call__res-ia' }, [
        el('span', { class: 'bj-call__lbl', text: T('Resumen', 'Summary') }),
        el('p', { text: t.resumen }),
        t.cita ? el('p', { class: 'bj-call__cita' }, [icon('calendar', 13), el('span', { text: ' ' + t.cita })]) : null,
      ].filter(Boolean)));
    } else if (l.grabada && (!l.transcripcion_estado || l.transcripcion_estado === 'pendiente' || l.transcripcion_estado === 'procesando')) {
      vivoEl.appendChild(el('p', { class: 'muted bj-call__estado' }, [el('span', { class: 'spinner' }), el('span', { text: ' ' + T('Transcribiendo la llamada…', 'Transcribing the call…') })]));
    } else if (l.transcripcion_estado === 'error') {
      vivoEl.appendChild(el('p', { class: 'bj-aviso', text: T('No se pudo transcribir. La grabación quedó guardada en el chat.', 'Could not transcribe. The recording is saved in the chat.') }));
    }
    // ¿Cómo salió? (la IA lo sugiere; la persona confirma).
    const chips = el('div', { class: 'bj-res' });
    const pintarChips = () => {
      clear(chips);
      for (const [k, lbl] of RESULTADOS_LLAMADA) chips.appendChild(el('button', { type: 'button', class: 'bj-filtro' + (resultado === k ? ' is-on' : ''), onclick: () => { resultado = k; pintarChips(); } }, [lbl()]));
    };
    pintarChips();
    const nota = el('textarea', { id: 'bj-llamada-nota', class: 'textarea', rows: 2, placeholder: T('Nota: qué se habló, qué sigue (opcional)', 'Note: what was said, next step (optional)') }, [l.nota || '']);
    vivoEl.append(
      el('div', { class: 'field' }, [el('label', { class: 'label', text: l.resultado_por === 'ia' ? T('¿Cómo salió? (la IA lo sugirió)', 'How did it go? (suggested by AI)') : T('¿Cómo salió?', 'How did it go?') }), chips]),
      el('div', { class: 'field' }, [nota]),
      el('div', { class: 'btn-row' }, [el('button', { type: 'button', class: 'btn btn-primary', onclick: async (e) => {
        if (!resultado) { toast(T('Elige cómo salió la llamada.', 'Pick how the call went.'), { type: 'error' }); return; }
        const b = e.currentTarget; b.dataset.loading = 'true';
        try {
          await api.post(`/bandeja/llamadas/${encodeURIComponent(l.id)}/resultado`, { resultado, nota: nota.value.trim() });
          toast(T('Llamada guardada', 'Call saved'), { type: 'success' });
          parar();
          close({ force: true });
          await abrirConv(v.id, { silencioso: true });
          cargarLista({ silencioso: true });
        } catch (err) { toast(err.message, { type: 'error' }); }
        finally { delete b.dataset.loading; }
      } }, [T('Guardar', 'Save')])]),
    );
  }
  return parar;
}

// Registro a mano: la llamada que se hizo por fuera de la línea.
function seccionRegistroManual(body, v, close, { plegado = false } = {}) {
  const tel = v.canal === 'whatsapp' ? fmtTelUI('+' + v.contacto_id) : (v.telefono ? fmtTelUI(v.telefono) : '');
  let resultado = '';
  const chips = el('div', { class: 'bj-res' });
  const pintarChips = () => {
    clear(chips);
    for (const [k, lbl] of RESULTADOS_LLAMADA) chips.appendChild(el('button', { type: 'button', class: 'bj-filtro' + (resultado === k ? ' is-on' : ''), onclick: () => { resultado = k; pintarChips(); } }, [lbl()]));
  };
  pintarChips();
  const minutos = el('input', { id: 'bj-man-min', class: 'input', type: 'number', min: '0', max: '600', inputmode: 'numeric', placeholder: T('Minutos (opcional)', 'Minutes (optional)') });
  const nota = el('textarea', { id: 'bj-man-nota', class: 'textarea', rows: 2, placeholder: T('Nota: qué se habló, qué sigue (opcional)', 'Note: what was said, next step (optional)') });
  const hijos = [
    !plegado ? (tel ? el('a', { class: 'btn btn-primary bj-llamar', href: `tel:${tel.replace(/\s/g, '')}` }, [icon('phone', 16), ' ' + T(`Llamar a ${tel}`, `Call ${tel}`)]) : el('p', { class: 'muted', text: T('Este canal no trae número de teléfono: registra aquí la llamada que hiciste por otro medio.', 'This channel has no phone number: log here the call you made another way.') })) : null,
    el('div', { class: 'field' }, [el('label', { class: 'label', text: T('¿Cómo salió?', 'How did it go?') }), chips]),
    el('div', { class: 'field' }, [minutos]),
    el('div', { class: 'field' }, [nota]),
    el('div', { class: 'btn-row' }, [el('button', { type: 'button', class: plegado ? 'btn' : 'btn btn-primary', onclick: async () => {
      if (!resultado) { toast(T('Elige cómo salió la llamada.', 'Pick how the call went.'), { type: 'error' }); return; }
      try {
        await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/llamada`, { resultado, minutos: Number(minutos.value) || 0, nota: nota.value.trim() });
        toast(T('Llamada registrada', 'Call logged'), { type: 'success' });
        close({ force: true });
        await abrirConv(v.id, { silencioso: true });
        cargarLista({ silencioso: true });
      } catch (e) { toast(e.message, { type: 'error' }); }
    } }, [T('Registrar llamada', 'Log call')])]),
  ].filter(Boolean);
  if (!plegado) { body.append(...hijos); return; }
  body.appendChild(el('details', { class: 'bj-manual' }, [
    el('summary', { text: T('¿Llamaste desde tu teléfono? Regístrala aquí', 'Called from your own phone? Log it here') }),
    el('div', { class: 'bj-manual__in' }, hijos),
  ]));
}

// ── Reproductor de audio propio (14-oct-2026) ──────────────────────────────
// El <audio controls> del navegador decía "0:00 / 0:00" hasta darle play (iOS
// no precarga) y cada navegador lo pinta distinto. Este es como la nota de voz
// de WhatsApp: botón redondo, barra que se arrastra y la duración desde el
// principio (la sabemos por la grabación). Solo suena uno a la vez.
let sonando = null;
function reproductor(src, segs = 0, { nota = false } = {}) {
  const audio = el('audio', { preload: 'metadata', src });
  let total = Number(segs) || 0;
  const ico = () => icon(audio.paused ? 'play' : 'pause', 18);
  const btn = el('button', { type: 'button', class: 'bj-play__btn', 'aria-label': T('Reproducir', 'Play') }, [icon('play', 18)]);
  const barra = el('input', { type: 'range', class: 'bj-play__barra', min: '0', max: '1000', step: '1', value: '0', 'aria-label': T('Avance de la grabación', 'Recording position') });
  const tiempo = el('span', { class: 'bj-play__t', text: total ? fmtDur(total) : '0:00' });
  const caja = el('div', { class: 'bj-play' + (nota ? ' is-nota' : '') }, [btn, barra, tiempo, audio]);
  const pintar = () => {
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total;
    const p = dur ? Math.min(1, audio.currentTime / dur) : 0;
    if (!barra._arrastrando) barra.value = String(Math.round(p * 1000));
    caja.style.setProperty('--p', (p * 100).toFixed(2) + '%');
    tiempo.textContent = audio.currentTime > 0 || !audio.paused ? `${fmtDur(audio.currentTime)} / ${fmtDur(dur)}` : fmtDur(dur);
  };
  const estado = () => {
    clear(btn); btn.appendChild(ico());
    btn.setAttribute('aria-label', audio.paused ? T('Reproducir', 'Play') : T('Pausar', 'Pause'));
    caja.classList.toggle('is-sonando', !audio.paused);
  };
  btn.addEventListener('click', () => {
    if (audio.paused) {
      if (sonando && sonando !== audio) sonando.pause();
      sonando = audio;
      audio.play().catch(() => toast(T('No se pudo reproducir la grabación.', 'Could not play the recording.'), { type: 'error' }));
    } else audio.pause();
  });
  audio.addEventListener('loadedmetadata', () => { if (Number.isFinite(audio.duration) && audio.duration > 0) total = audio.duration; pintar(); });
  audio.addEventListener('timeupdate', pintar);
  audio.addEventListener('play', estado);
  audio.addEventListener('pause', estado);
  audio.addEventListener('ended', () => { audio.currentTime = 0; pintar(); estado(); });
  barra.addEventListener('input', () => {
    barra._arrastrando = true;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total;
    caja.style.setProperty('--p', (Number(barra.value) / 10).toFixed(2) + '%');
    if (dur) tiempo.textContent = `${fmtDur(dur * Number(barra.value) / 1000)} / ${fmtDur(dur)}`;
  });
  barra.addEventListener('change', () => {
    barra._arrastrando = false;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total;
    if (dur) { try { audio.currentTime = dur * Number(barra.value) / 1000; } catch { /* aún sin datos */ } }
    pintar();
  });
  pintar();
  return caja;
}

// Tarjeta de una llamada con la línea: quién, cuánto, cómo salió, el audio y
// la transcripción. En el chat va completa; en el panel, con el nombre del
// paciente y un botón para abrir su chat.
function tarjetaLlamada(l, { enPanel = false, alCambiar = null } = {}) {
  const entrante = l.direccion === 'entrante';
  const perdida = entrante && (l.estado === 'perdida' || l.estado === 'buzon');
  const titulo = l.buzon ? T('Mensaje de voz', 'Voicemail')
    : perdida ? T('Llamada perdida', 'Missed call')
      : entrante ? T(`Llamada entrante · contestó ${l.user_nombre || '—'}`, `Incoming call · answered by ${l.user_nombre || '—'}`)
        : T(`${l.user_nombre || 'Alguien'} llamó`, `${l.user_nombre || 'Someone'} called`);
  const cuando = enPanel ? `${fmtDia(String(l.creado).slice(0, 10))} ${horaCorta(l.creado)}` : horaCorta(l.creado);
  // El mensaje de voz dura lo que su grabación (no la llamada con el saludo):
  // antes la tarjeta decía 0:34 y el reproductor 0:14.
  const dur = l.buzon && l.grabacion_seg ? fmtDur(l.grabacion_seg) : (l.duracion_seg ? fmtDur(l.duracion_seg) : estadoLlamadaTxt(l.estado));
  const hijos = [el('div', { class: 'bj-call__top' }, [
    el('span', { class: 'bj-call__ico' }, [icon(l.buzon ? 'volume' : 'phone', 16)]),
    el('span', { class: 'bj-call__cab' }, [
      el('strong', { class: 'bj-call__tit', text: titulo }),
      el('span', { class: 'bj-call__meta', text: `${dur} · ${cuando}` }),
    ]),
  ])];
  if (enPanel && l.conv_id) {
    hijos.push(el('button', { type: 'button', class: 'bj-call__quien', onclick: () => { cambiarTab('mensajes'); abrirConv(l.conv_id); } }, [
      icon('user', 12), el('span', { text: (l.conv_nombre || l.numero || T('Paciente', 'Patient')) + (l.conv_nombre && l.numero ? ` · ${l.numero}` : '') }),
    ]));
  }
  if (l.activa) hijos.push(el('p', { class: 'bj-call__estado' }, [el('span', { class: 'bj-vivo__punto', 'aria-hidden': 'true' }), el('span', { text: ' ' + estadoLlamadaTxt(l.estado) })]));
  if (!l.activa && l.resultado && !l.buzon) {
    const lbl = (RESULTADO_TXT[l.resultado] || (() => l.resultado))();
    hijos.push(el('button', { type: 'button', class: 'bj-call__resbtn', 'aria-label': T('Cambiar cómo salió', 'Change outcome'), onclick: async (e) => {
      const nuevo = await ctx.sheet.pickFrom({ title: T('¿Cómo salió?', 'How did it go?'), anchor: e.currentTarget, options: RESULTADOS_LLAMADA.map(([k, f]) => ({ value: k, label: f(), current: l.resultado === k })) });
      if (!nuevo) return;
      try {
        await api.post(`/bandeja/llamadas/${encodeURIComponent(l.id)}/resultado`, { resultado: nuevo });
        toast(T('Resultado guardado', 'Outcome saved'), { type: 'success' });
        if (alCambiar) alCambiar(); else if (convAbierta) abrirConv(convAbierta.conversacion.id, { silencioso: true });
      } catch (err) { toast(err.message, { type: 'error' }); }
    } }, [
      el('span', { text: lbl }),
      l.resultado_por === 'ia' ? el('span', { class: 'bj-call__ia', text: T('· sugerido por IA', '· AI suggested') }) : null,
      l.resultado_por === 'auto' ? el('span', { class: 'bj-call__ia', text: T('· automático', '· automatic') }) : null,
      icon('down', 12),
    ].filter(Boolean)));
  }
  if (l.audio) hijos.push(reproductor(l.audio, l.grabacion_seg || l.duracion_seg));
  else if (l.grabada && !l.activa) hijos.push(el('p', { class: 'muted bj-call__estado', text: T('Guardando la grabación…', 'Saving the recording…') }));
  const t = l.transcripcion;
  if (t && (t.resumen || (t.turnos && t.turnos.length))) {
    if (t.resumen || t.cita || t.siguiente_paso) {
      hijos.push(el('div', { class: 'bj-call__res-ia' }, [
        el('span', { class: 'bj-call__lbl' }, [icon('sparkles', 12), el('span', { text: T('Resumen de la llamada', 'Call summary') })]),
        t.resumen ? el('p', { class: 'bj-call__resumen', text: t.resumen }) : null,
        t.cita ? el('p', { class: 'bj-call__cita' }, [icon('calendar', 14), el('span', { text: t.cita })]) : null,
        t.siguiente_paso ? el('p', { class: 'bj-call__sig' }, [el('strong', { text: T('Sigue: ', 'Next: ') }), el('span', { text: t.siguiente_paso })]) : null,
      ].filter(Boolean)));
    }
    if (t.turnos && t.turnos.length) {
      hijos.push(el('details', { class: 'bj-call__trans' }, [
        el('summary', { text: T('Ver transcripción', 'Show transcript') }),
        el('div', { class: 'bj-call__turnos' }, t.turnos.map((x) => el('p', { class: 'bj-turno is-' + x.quien }, [
          el('strong', { text: (x.quien === 'paciente' ? T('Paciente', 'Patient') : (l.user_nombre || T('Agente', 'Agent'))) + ': ' }),
          el('span', { text: x.texto }),
        ]))),
      ]));
    } else if (enPanel) {
      hijos.push(el('button', { type: 'button', class: 'btn btn-ghost btn-sm bj-call__vertrans', onclick: () => verTranscripcion(l.id) }, [T('Ver transcripción', 'Show transcript')]));
    }
  } else if (l.grabada && !l.activa) {
    if (l.transcripcion_estado === 'error') {
      hijos.push(el('p', { class: 'bj-call__estado is-mal' }, [
        el('span', { text: T('No se pudo transcribir. ', 'Could not transcribe. ') }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async (e) => {
          const b = e.currentTarget; b.dataset.loading = 'true';
          try { await api.post(`/bandeja/llamadas/${encodeURIComponent(l.id)}/transcribir`, {}, { timeout: 180000 }); toast(T('Transcripción lista', 'Transcript ready'), { type: 'success' }); if (alCambiar) alCambiar(); else if (convAbierta) abrirConv(convAbierta.conversacion.id, { silencioso: true }); }
          catch (err) { toast(err.message, { type: 'error', ms: 8000 }); }
          finally { delete b.dataset.loading; }
        } }, [icon('refresh', 13), ' ' + T('Reintentar', 'Retry')]),
      ]));
    } else if (l.transcripcion_estado === 'sin_ia') {
      hijos.push(el('p', { class: 'muted bj-call__estado', text: T('Grabada. La transcripción automática no está activa.', 'Recorded. Automatic transcription is off.') }));
    } else {
      hijos.push(el('p', { class: 'muted bj-call__estado' }, [el('span', { class: 'spinner' }), el('span', { text: ' ' + T('Transcribiendo…', 'Transcribing…') })]));
    }
  }
  if (l.nota) hijos.push(el('p', { class: 'bj-call__nota', text: `“${l.nota}”` }));
  return el('div', { class: 'bj-call' + (entrante ? ' is-entrante' : '') + (perdida ? ' is-perdida' : '') + (enPanel ? ' is-panel' : '') }, hijos);
}

async function verTranscripcion(id) {
  let l;
  try { l = (await api.get(`/bandeja/llamadas/${encodeURIComponent(id)}`)).llamada; }
  catch (e) { toast(e.message, { type: 'error' }); return; }
  ctx.sheet.openSheet({
    title: T('Transcripción', 'Transcript'),
    mode: 'form',
    build(body) {
      const t = l.transcripcion || {};
      body.append(...[
        l.audio ? reproductor(l.audio, l.grabacion_seg || l.duracion_seg) : null,
        t.resumen ? el('p', { class: 'bj-call__resumen', text: t.resumen }) : null,
        el('div', { class: 'bj-call__turnos' }, (t.turnos || []).map((x) => el('p', { class: 'bj-turno is-' + x.quien }, [
          el('strong', { text: (x.quien === 'paciente' ? T('Paciente', 'Patient') : (l.user_nombre || T('Agente', 'Agent'))) + ': ' }),
          el('span', { text: x.texto }),
        ]))),
      ].filter(Boolean));
    },
  });
}

// 14:05 — la hora sola, como en WhatsApp (la fecha ya la da el separador de día).
function horaCorta(iso) {
  const d = new Date(String(iso || '').replace(' ', 'T') + (String(iso || '').includes('Z') ? '' : 'Z'));
  if (isNaN(d)) return String(iso || '').slice(11, 16);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDia(ymd) {
  if (!ymd) return '';
  const hoy = new Date().toISOString().slice(0, 10);
  if (ymd === hoy) return T('Hoy', 'Today');
  const d = new Date(ymd + 'T12:00:00Z');
  return d.toLocaleDateString(isEN ? 'en-US' : 'es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function burbuja(m) {
  const salida = m.direccion === 'out';
  const hijos = [];
  if (m.adjunto_url) {
    if (m.adjunto_tipo === 'image') hijos.push(el('a', { href: m.adjunto_url, target: '_blank', rel: 'noopener', class: 'bj-adj' }, [el('img', { src: m.adjunto_url, alt: T('Foto', 'Photo'), loading: 'lazy' })]));
    else if (m.adjunto_tipo === 'video') hijos.push(el('video', { src: m.adjunto_url, controls: true, class: 'bj-adj', preload: 'metadata' }));
    else if (m.adjunto_tipo === 'audio') hijos.push(reproductor(m.adjunto_url, 0, { nota: true }));
    else hijos.push(el('a', { href: m.adjunto_url, target: '_blank', rel: 'noopener', class: 'bj-adj-link' }, [icon('link', 13), ' ' + ({ share: T('Publicación compartida', 'Shared post'), story_mention: T('Mención en historia', 'Story mention') }[m.adjunto_tipo] || T('Adjunto', 'Attachment'))]));
  } else if (m.adjunto_tipo && !m.texto) {
    hijos.push(el('span', { class: 'muted', text: ({ share: T('Compartió una publicación', 'Shared a post'), story_mention: T('Te mencionó en una historia', 'Mentioned you in a story') }[m.adjunto_tipo] || T('Adjunto', 'Attachment')) }));
  }
  const conPlantilla = String(m.via || '').startsWith('plantilla:');
  if (conPlantilla) hijos.unshift(el('span', { class: 'bj-burbuja__via', text: T('Enviado con plantilla', 'Sent with template') }));
  else if (salida && m.via === 'app') hijos.unshift(el('span', { class: 'bj-burbuja__via', text: T('Desde la app', 'From the app') }));
  if (m.texto) hijos.push(el('span', { class: 'bj-burbuja__txt', text: m.texto }));
  const pie = [el('span', { text: horaCorta(m.creado) })];
  if (salida && m.autor_nombre && m.autor_nombre !== 'Meta') pie.unshift(el('span', { text: m.autor_nombre + ' · ' }));
  // Palomitas como WhatsApp: ✓ enviado, ✓✓ entregado, ✓✓ azul leído.
  if (salida && (m.estado === 'enviado' || m.estado === 'entregado' || m.estado === 'leido')) {
    pie.push(el('span', {
      class: 'bj-tick' + (m.estado === 'leido' ? ' is-leido' : ''),
      title: m.estado === 'leido' ? T('Leído', 'Read') : (m.estado === 'entregado' ? T('Entregado', 'Delivered') : T('Enviado', 'Sent')),
      text: m.estado === 'enviado' ? ' ✓' : ' ✓✓',
    }));
  }
  const malo = m.estado === 'error' || m.estado === 'fallido';
  if (malo) pie.push(el('span', { class: 'bj-burbuja__err', text: ' · ' + (m.estado === 'fallido' ? T('No llegó', 'Not delivered') : T('No se envió', 'Not sent')) + (m.error ? ': ' + m.error : '') }));
  // La hora va DENTRO de la burbuja (como WhatsApp), no debajo.
  return el('div', { class: 'bj-burbuja' + (salida ? ' is-out' : ' is-in') + (malo ? ' is-error' : '') + (conPlantilla ? ' is-plantilla' : '') }, [
    el('div', { class: 'bj-burbuja__cuerpo' }, [...hijos, el('div', { class: 'bj-burbuja__pie' }, pie)]),
  ]);
}

function autoAlto(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(window.innerWidth < 600 ? 120 : 160, Math.max(44, ta.scrollHeight)) + 'px';
}

async function enviar(v, ta) {
  const texto = (ta.value || '').trim();
  if (!texto || enviando) return;
  enviando = true;
  ta.disabled = true;
  try {
    const cuerpo = { texto };
    // "Con botones" (confirmación) se pide explícito; el seguimiento lo decide el servidor por la ventana.
    if (v.canal === 'whatsapp' && plantillaClave === 'confirmacion') cuerpo.plantilla = 'confirmacion';
    const x = await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/enviar`, cuerpo);
    if (x && x.plantilla) toast(T('Enviado dentro de la plantilla. Abajo verás si llegó.', 'Sent inside the template. You will see below if it was delivered.'), { type: 'success' });
    plantillaClave = 'seguimiento';
    borradores.delete(v.id);
    ta.value = '';
    await abrirConv(v.id, { silencioso: true });
    bajarChat(false);
    cargarLista({ silencioso: true });
  } catch (e) {
    toast(e.message, { type: 'error', ms: 8000 });
    await abrirConv(v.id, { silencioso: true });
  } finally {
    enviando = false;
    const nuevo = rootEl && rootEl.querySelector('.bj-ta');
    if (nuevo) { nuevo.disabled = false; nuevo.focus(); }
  }
}

async function sugerirConv(v, ta, btn) {
  btn.dataset.loading = 'true';
  try {
    const r = await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/sugerir`, {});
    ta.value = r.sugerencia || '';
    borradores.set(v.id, ta.value);
    autoAlto(ta);
    ta.focus();
    toast(T('Sugerencia lista: revísala y ajústala antes de enviar.', 'Suggestion ready: review and adjust before sending.'), { type: 'info' });
  } catch (e) {
    toast(e.message, { type: 'error' });
  } finally { delete btn.dataset.loading; }
}


// ── Comentarios ──────────────────────────────────────────────────────────────
function filtrosComentarios() {
  const r = resumen && !resumen.error ? resumen : null;
  return el('div', { class: 'bj-filtros-wrap' }, [el('div', { class: 'bj-menus bj-menus--2' + (estadoCom === 'todos' && canal ? ' is-llenos' : '') }, [
    menuFiltro({
      titulo: T('Ver', 'View'), hoja: T('Qué comentarios ver', 'Which comments to see'), valor: estadoCom === 'todos' ? T('Todos', 'All') : T('Pendientes', 'Pending'), activo: estadoCom === 'todos',
      opciones: () => [
        { value: 'pendientes', label: T('Pendientes', 'Pending'), sub: r && r.comentarios_pendientes ? T(`${r.comentarios_pendientes} por contestar`, `${r.comentarios_pendientes} to answer`) : T('Por contestar', 'To answer'), icon: icon('bell', 18), current: estadoCom === 'pendientes' },
        { value: 'todos', label: T('Todos', 'All'), sub: T('También los contestados y ocultos', 'Answered and hidden too'), icon: icon('inbox', 18), current: estadoCom === 'todos' },
      ],
      alElegir: (k) => { estadoCom = k; cargarLista(); pintarCuerpo(); },
    }),
    menuFiltro({
      titulo: T('Red', 'Network'), hoja: T('Filtrar por red', 'Filter by network'), valor: canal ? CANAL_TXT[canal] || canal : T('Todas', 'All'), activo: !!canal,
      opciones: () => [
        { value: '', label: T('Todas las redes', 'All networks'), icon: icon('inbox', 18), current: !canal },
        { value: 'instagram', label: 'Instagram', icon: icoPick('instagram'), current: canal === 'instagram' },
        { value: 'facebook', label: 'Facebook', icon: icoPick('facebook'), current: canal === 'facebook' },
      ],
      alElegir: (k) => { canal = k; cargarLista(); pintarCuerpo(); },
    }),
  ])]);
}

function listaComentarios() {
  if (cargandoLista && !coms.length) return el('div', { class: 'bj-cargando' }, [el('span', { class: 'spinner' })]);
  if (!coms.length) {
    const r = resumen && !resumen.error ? resumen : null;
    const nada = r && !r.canales.instagram.conectado && !r.canales.messenger.conectado;
    return vacio('check',
      nada ? T('Conecta una red primero', 'Connect a network first') : (estadoCom === 'pendientes' ? T('Todo contestado', 'All answered') : T('Sin comentarios', 'No comments')),
      nada
        ? T('Conecta Instagram o Facebook en Conexiones y los comentarios de esta marca aparecerán aquí.', 'Connect Instagram or Facebook in Connections and this brand’s comments will show up here.')
        : (estadoCom === 'pendientes'
          ? T('No hay comentarios pendientes. Los nuevos llegan solos y te avisamos.', 'No pending comments. New ones arrive on their own and we notify you.')
          : T('Todavía no se han leído comentarios de esta marca.', 'No comments have been read for this brand yet.')),
      r && r.sondeo_at ? el('p', { class: 'muted bj-empty__nota', text: T(`Última lectura: ${timeAgo(r.sondeo_at)}.`, `Last read: ${timeAgo(r.sondeo_at)}.`) }) : null);
  }
  const wrap = el('div', { class: 'bj-coms' });
  for (const k of coms) wrap.appendChild(tarjetaComentario(k));
  return wrap;
}

function tarjetaComentario(k) {
  const card = el('article', { class: 'bj-com' + (k.atendido ? ' is-done' : '') + (k.oculto ? ' is-hidden' : '') });
  card.append(...[
    el('header', { class: 'bj-com__head' }, [
      chipCanal(k.canal),
      el('span', { class: 'bj-com__autor', text: k.autor ? (k.canal === 'instagram' ? '@' + k.autor : k.autor) : T('Alguien', 'Someone') }),
      el('span', { class: 'bj-com__hora', text: timeAgo(k.comentado_en) }),
      k.parent_id ? el('span', { class: 'chip', text: T('respuesta', 'reply') }) : null,
      k.oculto ? el('span', { class: 'chip', style: { '--c': '#ef4444' }, text: T('oculto', 'hidden') }) : null,
    ].filter(Boolean)),
    k.media_caption || k.media_permalink ? el('div', { class: 'bj-com__post' }, [
      el('span', { class: 'bj-com__caption', text: k.media_caption ? '“' + String(k.media_caption).slice(0, 90) + (k.media_caption.length > 90 ? '…' : '') + '”' : T('En una publicación', 'On a post') }),
      k.media_permalink ? el('a', { href: k.media_permalink, target: '_blank', rel: 'noopener', class: 'bj-com__link' }, [T('Ver publicación', 'View post'), ' ', icon('right', 12)]) : null,
    ].filter(Boolean)) : null,
    el('p', { class: 'bj-com__texto', text: k.texto || '' }),
  ].filter(Boolean));
  if (k.atendido) {
    card.appendChild(el('div', { class: 'bj-com__resp' }, [
      icon('check', 14),
      el('span', { text: k.respuesta
        ? T(`Respondido${k.respondido_por ? ' por ' + k.respondido_por : ''}${k.dm_enviado ? ' (también por mensaje)' : ''}: `, `Answered${k.respondido_por ? ' by ' + k.respondido_por : ''}${k.dm_enviado ? ' (also by DM)' : ''}: `) + k.respuesta
        : T('Marcado como visto', 'Marked as seen') }),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => marcarComentario(k, false) }, [T('Reabrir', 'Reopen')]),
    ]));
    return card;
  }
  const ta = el('textarea', { class: 'textarea bj-ta bj-com__ta', rows: 1, placeholder: T('Escribe la respuesta…', 'Write the reply…'),
    oninput: (e) => { autoAlto(e.target); borradorCom.set(k.id, e.target.value); } });
  if (borradorCom.has(k.id)) { ta.value = borradorCom.get(k.id); requestAnimationFrame(() => autoAlto(ta)); }
  const btnIA = el('button', { type: 'button', class: 'btn btn-sm bj-ia', onclick: () => sugerirCom(k, ta, btnIA) }, [icon('sparkles', 14), ' ' + T('Sugerir', 'Suggest')]);
  const btnPub = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => responderCom(k, ta, 'publico', btnPub) }, [icon('send', 14), ' ' + T('Responder', 'Reply')]);
  const btnAmbos = el('button', { type: 'button', class: 'btn btn-sm', onclick: () => responderCom(k, ta, 'ambos', btnAmbos), title: T('Responde en público y además le manda un mensaje privado (Meta permite uno por comentario).', 'Replies publicly and also sends a private message (Meta allows one per comment).') }, [T('Responder + mensaje privado', 'Reply + private message')]);
  const btnVisto = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => marcarComentario(k, true) }, [icon('check', 14), ' ' + T('Visto', 'Seen')]);
  const btnOcultar = el('button', { type: 'button', class: 'btn btn-ghost btn-sm bj-ocultar', onclick: () => ocultarCom(k, btnOcultar) }, [icon('eye', 14), ' ' + T('Ocultar', 'Hide')]);
  // Ordenados (14-oct-2026): Sugerir | Responder; abajo, a lo ancho, responder
  // también por mensaje privado; y aparte, chicos, Visto y Ocultar. Antes los
  // cinco caían en tres renglones disparejos con "Ocultar" solo al final.
  card.appendChild(el('div', { class: 'bj-com__acciones' }, [
    ta,
    el('div', { class: 'bj-com__btns' }, [btnIA, btnPub, btnAmbos]),
    el('div', { class: 'bj-com__sec' }, [btnVisto, btnOcultar]),
  ]));
  if (fueraCom.has(k.id)) salidaPorLaRed(k, ta, card, fueraCom.get(k.id), { scroll: false });
  return card;
}

async function responderCom(k, ta, modo, btn) {
  const texto = (ta.value || '').trim();
  if (!texto) { toast(T('Escribe la respuesta primero.', 'Write the reply first.'), { type: 'info' }); ta.focus(); return; }
  btn.dataset.loading = 'true';
  try {
    const r = await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/responder`, { texto, modo });
    toast(r.dm ? T('Respondido en público y por mensaje.', 'Replied publicly and by DM.') : T('Respuesta publicada.', 'Reply published.'), { type: 'success' });
    borradorCom.delete(k.id); fueraCom.delete(k.id);
    await cargarLista({ silencioso: true });
    cargarResumen();
  } catch (e) {
    if (e.data && e.data.sin_permiso_meta) salidaPorLaRed(k, ta, btn, e.data.permalink || k.media_permalink);
    else toast(e.message, { type: 'error', ms: 9000 });
  } finally { delete btn.dataset.loading; }
}

// Meta todavía no aprueba el permiso de comentarios para la app (solo funciona
// en cuentas con rol en la app, como IVAE Studios). Antes salía un toast que
// pedía "reconectar", y reconectar no sirve: aquí se ofrece la salida real,
// contestar en la red con el texto ya copiado y dejarlo registrado.
function copiarYa(texto) {
  // Copia SÍNCRONA dentro del clic: si se espera a la promesa del portapapeles,
  // Safari bloquea la pestaña nueva y Chrome puede perder el foco al abrirla.
  let ok = false;
  try {
    const t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, t.value.length);
    ok = document.execCommand('copy'); t.remove();
  } catch { ok = false; }
  if (!ok && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).catch(() => {});
  return ok;
}
function salidaPorLaRed(k, ta, desde, permalink, { scroll = true } = {}) {
  const card = desde.classList && desde.classList.contains('bj-com') ? desde : desde.closest('.bj-com');
  if (!card) return;
  fueraCom.set(k.id, permalink || null);
  const prev = card.querySelector('.bj-com__fuera');
  if (prev) prev.remove();
  const red = k.canal === 'facebook' ? 'Facebook' : 'Instagram';
  const texto = () => (ta.value || '').trim();
  const btnAbrir = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => {
    const t = texto();
    if (!t) { toast(T('Escribe la respuesta primero.', 'Write the reply first.'), { type: 'info' }); ta.focus(); return; }
    copiarYa(t);
    if (permalink) window.open(permalink, '_blank', 'noopener');
    toast(permalink
      ? T(`Respuesta copiada. En ${red}, pégala en el comentario y luego toca "Ya lo respondí".`, `Reply copied. On ${red}, paste it under the comment, then tap "I replied".`)
      : T(`Respuesta copiada. Ábrela en ${red} y pégala en el comentario.`, `Reply copied. Open ${red} and paste it under the comment.`), { type: 'success', ms: 8000 });
  } }, [icon('copy', 14), ' ' + (permalink ? T(`Copiar y abrir en ${red}`, `Copy and open in ${red}`) : T('Copiar respuesta', 'Copy reply'))]);
  const btnHecho = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
    const t = texto();
    btnHecho.dataset.loading = 'true';
    try {
      await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/atendido`, t ? { atendido: true, respuesta: t } : { atendido: true });
      toast(T('Listo: quedó como respondido.', 'Done: marked as answered.'), { type: 'success' });
      borradorCom.delete(k.id); fueraCom.delete(k.id);
      await cargarLista({ silencioso: true });
      cargarResumen();
    } catch (err) { toast(err.message, { type: 'error' }); }
    finally { delete btnHecho.dataset.loading; }
  } }, [icon('check', 14), ' ' + T(`Ya lo respondí en ${red}`, `I replied on ${red}`)]);
  const aviso = el('div', { class: 'bj-aviso bj-com__fuera', role: 'status' }, [
    el('p', { text: T(
      `Meta todavía no deja responder comentarios de ${red} desde la app en esta cuenta: el permiso está en revisión. Cuando lo apruebe, este botón funcionará en todas las marcas. Mientras, contéstalo en ${red}:`,
      `Meta does not yet allow replying to ${red} comments from the app on this account: the permission is under review. Once approved, this button will work for every brand. For now, reply on ${red}:`) }),
    el('div', { class: 'bj-com__fuera-btns' }, [btnAbrir, btnHecho]),
  ]);
  const acciones = card.querySelector('.bj-com__acciones');
  if (acciones) acciones.insertBefore(aviso, acciones.firstChild); else card.appendChild(aviso);
  if (scroll) aviso.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
async function sugerirCom(k, ta, btn) {
  btn.dataset.loading = 'true';
  try {
    const r = await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/sugerir`, {});
    ta.value = r.sugerencia || '';
    borradorCom.set(k.id, ta.value);
    autoAlto(ta);
    ta.focus();
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { delete btn.dataset.loading; }
}
async function marcarComentario(k, atendido) {
  try {
    await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/atendido`, { atendido });
    if (atendido) { borradorCom.delete(k.id); fueraCom.delete(k.id); }
    await cargarLista({ silencioso: true });
    cargarResumen();
  } catch (e) { toast(e.message, { type: 'error' }); }
}
async function ocultarCom(k, btn) {
  // Deja de verse en la publicación (la persona no se entera).
  const ok = await ctx.sheet.confirmDiscard({
    title: T('¿Ocultar este comentario en la publicación?', 'Hide this comment on the post?'),
    keepLabel: T('Cancelar', 'Cancel'),
    discardLabel: T('Ocultar', 'Hide'),
  }).catch(() => false);
  if (!ok) return;
  btn.dataset.loading = 'true';
  try {
    await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/ocultar`, { oculto: true });
    toast(T('Comentario oculto.', 'Comment hidden.'), { type: 'success' });
    await cargarLista({ silencioso: true });
    cargarResumen();
  } catch (e) { toast(e.message, { type: 'error', ms: 8000 }); }
  finally { delete btn.dataset.loading; }
}

// ── Desempeño (supervisor y staff) ───────────────────────────────────────────
// Lo que el dueño pidió ver: cuánto tarda cada quien, quién contesta más,
// llamadas, seguimientos, citas y de qué anuncio llegan los leads.
function fmtMin(m) {
  if (m == null) return '—';
  if (m < 1) return T('< 1 min', '< 1 min');
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) return `${(m / 60).toFixed(1).replace('.0', '')} h`;
  return T(`${(m / 1440).toFixed(1).replace('.0', '')} días`, `${(m / 1440).toFixed(1).replace('.0', '')} days`);
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function panelDesempeno() {
  const wrap = el('div', { class: 'bj-dash' });
  const r = resumen && !resumen.error ? resumen : null;
  const acciones = el('div', { class: 'bj-dash__acc' }, [
    el('div', { class: 'bj-filtros' }, [7, 30, 90].map((d) => chipFiltro(T(`${d} días`, `${d} days`), periodo === d, () => { periodo = d; desempeno = null; pintarCuerpo(); cargarLista(); }))),
    el('div', { class: 'bj-dash__btns' }, [
      r && r.sin_asignar && equipoAgentes().length ? el('button', { type: 'button', class: 'btn btn-sm', onclick: (e) => repartirSinAsignar(e.currentTarget) }, [icon('users', 14), ' ' + T(`Repartir ${r.sin_asignar} sin asignar`, `Assign ${r.sin_asignar} unassigned`)]) : null,
      el('button', { type: 'button', class: 'btn btn-sm', onclick: abrirEquipo }, [icon('users', 14), ' ' + T('Equipo', 'Team')]),
    ].filter(Boolean)),
  ]);
  wrap.appendChild(acciones);
  if (!desempeno) { wrap.appendChild(el('div', { class: 'bj-cargando' }, [el('span', { class: 'spinner' })])); return wrap; }
  if (desempeno.error) { wrap.appendChild(vacio('warning', T('No se pudo cargar', 'Could not load'), desempeno.error)); return wrap; }
  const d = desempeno;
  const t = d.totales;
  const kpi = (valor, etiqueta, nota = null, tono = '') => el('div', { class: 'bj-kpi' + (tono ? ' is-' + tono : '') }, [
    el('span', { class: 'bj-kpi__v', text: String(valor) }),
    el('span', { class: 'bj-kpi__l', text: etiqueta }),
    nota ? el('span', { class: 'bj-kpi__n', text: nota }) : null,
  ].filter(Boolean));
  wrap.appendChild(el('div', { class: 'bj-kpis' }, [
    kpi(t.leads, T('Leads nuevos', 'New leads'), T(`en ${d.periodo.dias} días`, `in ${d.periodo.dias} days`)),
    kpi(`${pct(t.respondidos, t.leads)}%`, T('Leads contestados', 'Leads answered'), T(`${t.respondidos} de ${t.leads}`, `${t.respondidos} of ${t.leads}`)),
    kpi(fmtMin(t.primera_respuesta_min), T('Primera respuesta', 'First reply'), T('tiempo típico', 'typical time')),
    kpi(fmtMin(t.respuesta_mediana_min), T('Respuesta típica', 'Typical reply'), T('a cualquier mensaje', 'to any message')),
    kpi(t.sin_respuesta_ahora, T('Esperando respuesta', 'Waiting for reply'), T('ahora mismo', 'right now'), t.sin_respuesta_ahora ? 'alerta' : ''),
    kpi(t.seguimientos, T('Seguimientos', 'Follow-ups'), T(`${t.plantillas} con plantilla`, `${t.plantillas} with template`)),
    kpi(t.llamadas, T('Llamadas', 'Calls')),
    kpi(t.citas, T('Citas agendadas', 'Appointments'), t.leads ? T(`${pct(t.citas, t.leads)}% de los leads`, `${pct(t.citas, t.leads)}% of leads`) : null, 'bien'),
  ]));
  if (t.whatsapp && t.whatsapp.enviados) {
    const w = t.whatsapp;
    wrap.appendChild(el('p', { class: 'bj-dash__wa' }, [
      el('strong', { text: 'WhatsApp: ' }),
      el('span', { text: T(`${w.enviados} enviados · ${pct(w.entregados, w.enviados)}% entregados · ${pct(w.leidos, w.enviados)}% leídos`, `${w.enviados} sent · ${pct(w.entregados, w.enviados)}% delivered · ${pct(w.leidos, w.enviados)}% read`) }),
      w.no_entregados ? el('span', { class: 'bj-dash__mal', text: T(` · ${w.no_entregados} no llegaron`, ` · ${w.no_entregados} not delivered`) }) : null,
    ].filter(Boolean)));
  }

  // Leads por día (barras).
  if (d.dias && d.dias.length) {
    const max = Math.max(1, ...d.dias.map((x) => x.leads));
    wrap.appendChild(el('section', { class: 'bj-dash__sec' }, [
      el('h3', { class: 'bj-dash__h', text: T('Leads por día', 'Leads per day') }),
      el('div', { class: 'bj-barras', role: 'img', 'aria-label': T('Leads por día', 'Leads per day') }, d.dias.map((x) => el('span', {
        class: 'bj-barra', title: `${x.dia}: ${x.leads}`,
        style: { '--h': `${Math.round((x.leads / max) * 100)}%` },
      }))),
      el('div', { class: 'bj-barras__eje' }, [el('span', { text: fmtDiaCorto(d.dias[0].dia) }), el('span', { text: fmtDiaCorto(d.dias[d.dias.length - 1].dia) })]),
    ]));
  }

  // Por agente.
  const filas = d.agentes || [];
  const secAg = el('section', { class: 'bj-dash__sec' }, [el('h3', { class: 'bj-dash__h', text: T('Por agente', 'By agent') })]);
  if (!filas.length) secAg.appendChild(el('p', { class: 'muted', text: T('Todavía no hay actividad del equipo en este periodo.', 'No team activity in this period yet.') }));
  else {
    const cols = [
      ['nombre', T('Agente', 'Agent')], ['asignados', T('Asignados', 'Assigned')], ['chats_atendidos', T('Atendidos', 'Handled')],
      ['primera_respuesta_min', T('1ª respuesta', '1st reply')], ['respuesta_mediana_min', T('Resp. típica', 'Typical reply')],
      ['mensajes', T('Mensajes', 'Messages')], ['seguimientos', T('Seguimientos', 'Follow-ups')], ['llamadas', T('Llamadas', 'Calls')], ['citas', T('Citas', 'Booked')],
    ];
    const tabla = el('table', { class: 'bj-tabla' }, [
      el('thead', {}, [el('tr', {}, cols.map(([, l]) => el('th', { text: l })))]),
      el('tbody', {}, filas.map((f) => el('tr', {}, cols.map(([k]) => {
        if (k === 'nombre') return el('td', { class: 'bj-tabla__nom' }, [el('span', { text: f.nombre }), f.es_agente && f.disponible === false ? el('span', { class: 'bj-tag', text: T('no disponible', 'away') }) : null].filter(Boolean));
        if (k.endsWith('_min')) return el('td', { text: fmtMin(f[k]) });
        if (k === 'llamadas') return el('td', { text: f.llamadas ? `${f.llamadas} (${f.llamadas_contestadas} ✓)` : '0' });
        return el('td', { text: String(f[k] ?? 0) });
      })))),
    ]);
    secAg.appendChild(el('div', { class: 'bj-tabla-wrap' }, [tabla]));
  }
  wrap.appendChild(secAg);

  // Llamadas con la línea: escuchar cada una y leer su transcripción.
  const lp = llamadasPanel;
  if (lp && ((lp.linea && lp.linea.conectada) || (lp.llamadas && lp.llamadas.length))) {
    const tt = lp.totales || {};
    const sec = el('section', { class: 'bj-dash__sec' }, [
      el('h3', { class: 'bj-dash__h', text: T('Llamadas grabadas', 'Recorded calls') }),
      el('p', { class: 'muted bj-dash__wa', text: T(
        `${tt.llamadas || 0} llamadas · ${tt.contestadas || 0} contestadas · ${tt.grabadas || 0} grabadas · ${tt.minutos || 0} min` + (tt.perdidas ? ` · ${tt.perdidas} perdidas` : ''),
        `${tt.llamadas || 0} calls · ${tt.contestadas || 0} answered · ${tt.grabadas || 0} recorded · ${tt.minutos || 0} min` + (tt.perdidas ? ` · ${tt.perdidas} missed` : '')) }),
    ]);
    const lista = lp.llamadas || [];
    if (!lista.length) sec.appendChild(el('p', { class: 'muted', text: T('Todavía no hay llamadas con la línea en este periodo. Se hacen desde el botón del teléfono en cada chat.', 'No line calls in this period yet. They are made from the phone button in each chat.') }));
    const caja = el('div', { class: 'bj-calls' });
    let mostradas = 0;
    const recargar = async () => { try { llamadasPanel = await api.get(`/bandeja/llamadas?client_id=${encodeURIComponent(cid())}&dias=${periodo}`); pintarCuerpo(); } catch (e) { toast(e.message, { type: 'error' }); } };
    const mas = el('button', { type: 'button', class: 'btn btn-sm bj-calls__mas' });
    const pintarMas = () => {
      for (const l of lista.slice(mostradas, mostradas + 20)) caja.appendChild(tarjetaLlamada(l, { enPanel: true, alCambiar: recargar }));
      mostradas = Math.min(lista.length, mostradas + 20);
      mas.hidden = mostradas >= lista.length;
      mas.textContent = T(`Ver más (${lista.length - mostradas})`, `Show more (${lista.length - mostradas})`);
    };
    mas.addEventListener('click', pintarMas);
    pintarMas();
    sec.append(caja, mas);
    wrap.appendChild(sec);
  }

  // Por anuncio y por canal.
  const anuncios = d.anuncios || [];
  if (anuncios.length) {
    wrap.appendChild(el('section', { class: 'bj-dash__sec' }, [
      el('h3', { class: 'bj-dash__h', text: T('De dónde llegan', 'Where they come from') }),
      el('div', { class: 'bj-ads' }, anuncios.map((a) => el('div', { class: 'bj-ad' + (a.anuncio ? '' : ' is-org') }, [
        el('span', { class: 'bj-ad__t', text: a.titulo }),
        el('span', { class: 'bj-ad__n', text: T(`${a.leads} leads · ${a.citas} citas (${pct(a.citas, a.leads)}%)`, `${a.leads} leads · ${a.citas} booked (${pct(a.citas, a.leads)}%)`) }),
      ]))),
      d.canales && d.canales.length ? el('div', { class: 'bj-filtros bj-dash__canales' }, d.canales.map((c) => el('span', { class: 'bj-canal is-on', style: { '--c': colorDe(c.canal) } }, [icoCanal(c.canal, 13), el('span', { text: `${CANAL_TXT[c.canal] || c.canal}: ${c.leads}` })]))) : null,
    ].filter(Boolean)));
  }
  wrap.appendChild(el('p', { class: 'muted bj-dash__nota', text: T(
    'Tiempos en horas corridas (cuentan noches y fines de semana). Una "respuesta" es el primer mensaje de una persona del equipo después de que el paciente escribió. Seguimiento = mensaje enviado cuando el paciente llevaba 24 h o más sin escribir.',
    'Times are wall-clock hours (nights and weekends count). A "reply" is the first team message after the patient wrote. Follow-up = message sent when the patient had been silent for 24 h or more.') }));
  return wrap;
}
function fmtDiaCorto(ymd) {
  const dt = new Date(ymd + 'T12:00:00Z');
  return isNaN(dt) ? ymd : dt.toLocaleDateString(isEN ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short' });
}

async function repartirSinAsignar(btn) {
  btn.dataset.loading = 'true';
  try {
    const x = await api.post(`/bandeja/repartir?client_id=${encodeURIComponent(cid())}`, {});
    const det = Object.entries(x.por_agente || {}).map(([n, k]) => `${n}: ${k}`).join(' · ');
    toast(T(`Repartidos ${x.repartidas} chats${det ? ' (' + det + ')' : ''}.`, `Assigned ${x.repartidas} chats${det ? ' (' + det + ')' : ''}.`), { type: 'success', ms: 7000 });
    await cargarResumen();
    desempeno = null; pintarCuerpo(); cargarLista();
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { delete btn.dataset.loading; }
}

// ── Equipo de la marca ───────────────────────────────────────────────────────
// Staff: da de alta agentes, cambia roles y configura el reparto.
// Supervisor: ve al equipo y marca quién está disponible.
function abrirEquipo() {
  const cli = clienteActivo();
  if (!cli) return;
  ctx.sheet.openSheet({
    title: T(`Equipo de ${cli.name}`, `${cli.name} team`),
    mode: 'form',
    build(body) { seccionEquipo(body, cli); },
  });
}

function seccionEquipo(body, cli) {
  const caja = el('div', { class: 'bj-eq' }, [el('p', { class: 'muted', text: T('Cargando…', 'Loading…') })]);
  body.appendChild(caja);
  (async () => {
    let info;
    try { info = await api.get(`/bandeja/equipo?client_id=${encodeURIComponent(cli.id)}`); }
    catch (e) { clear(caja); caja.appendChild(el('p', { class: 'bj-aviso', text: e.message })); return; }
    clear(caja);
    const puede = !!info.puede_editar;
    caja.appendChild(el('p', { class: 'muted bj-aj__p', text: T(
      'Agente: atiende los chats que le tocan (el reparto es por turnos, parejo). Supervisor: ve todo y el desempeño. Solo reciben chats los agentes disponibles.',
      'Agent: handles the chats assigned to them (round-robin). Supervisor: sees everything and performance. Only available agents get chats.') }));
    const lista = el('ul', { class: 'bj-eq__lista' });
    if (!info.accesos.length) lista.appendChild(el('li', { class: 'muted', text: T('Esta marca todavía no tiene accesos.', 'This brand has no logins yet.') }));
    for (const u of info.accesos) {
      const sel = puede ? el('select', { class: 'select bj-eq__rol', 'aria-label': T('Rol en la bandeja', 'Inbox role'), onchange: async (e) => {
        try { await api.patch(`/bandeja/equipo/${encodeURIComponent(u.id)}`, { rol: e.target.value || null }); toast(T('Rol guardado', 'Role saved'), { type: 'success' }); await cargarResumen(); }
        catch (err) { toast(err.message, { type: 'error' }); }
      } }, [
        el('option', { value: '', text: T('Sin bandeja', 'No inbox'), selected: !u.rol }),
        el('option', { value: 'agente', text: T('Agente', 'Agent'), selected: u.rol === 'agente' }),
        el('option', { value: 'supervisor', text: T('Supervisor', 'Supervisor'), selected: u.rol === 'supervisor' }),
      ]) : el('span', { class: 'bj-tag', text: u.rol === 'agente' ? T('Agente', 'Agent') : (u.rol === 'supervisor' ? T('Supervisor', 'Supervisor') : T('Sin bandeja', 'No inbox')) });
      const dispo = u.rol === 'agente' ? el('label', { class: 'bj-eq__dispo' }, [
        el('input', { type: 'checkbox', checked: u.disponible, onchange: async (e) => {
          try { await api.patch(`/bandeja/equipo/${encodeURIComponent(u.id)}`, { disponible: e.target.checked }); toast(e.target.checked ? T(`${u.nombre} recibe chats`, `${u.nombre} gets chats`) : T(`${u.nombre} ya no recibe chats nuevos`, `${u.nombre} gets no new chats`), { type: 'success' }); await cargarResumen(); }
          catch (err) { toast(err.message, { type: 'error' }); e.target.checked = !e.target.checked; }
        } }), el('span', { text: T('Disponible', 'Available') }),
      ]) : null;
      // Celular de agentes y supervisores: ahí les entran las llamadas con la línea.
      const tel = u.rol ? el('input', { id: `bj-eq-tel-${u.id}`, class: 'input bj-eq__tel', type: 'tel', inputmode: 'tel', 'aria-label': T(`Celular de ${u.nombre}`, `${u.nombre}'s phone`), value: fmtTelUI(u.telefono || ''), placeholder: T('Celular para llamadas', 'Phone for calls'), onchange: async (e) => {
        try { await api.patch(`/bandeja/equipo/${encodeURIComponent(u.id)}`, { telefono: e.target.value.trim() }); toast(T('Celular guardado', 'Phone saved'), { type: 'success' }); }
        catch (err) { toast(err.message, { type: 'error' }); }
      } }) : null;
      lista.appendChild(el('li', { class: 'bj-eq__fila' + (u.activo ? '' : ' is-off') }, [
        el('div', { class: 'bj-eq__quien' }, [el('strong', { text: u.nombre }), el('span', { class: 'muted', text: u.usuario || '' })]),
        el('div', { class: 'bj-eq__ctl' }, [sel, dispo, tel].filter(Boolean)),
      ]));
    }
    caja.appendChild(lista);
    if (!puede) return;

    // Alta de un agente nuevo (acceso de cliente de esta marca con rol de agente).
    const fNom = el('input', { class: 'input', placeholder: T('Nombre (ej. Laura)', 'Name (e.g. Laura)') });
    const fUsr = el('input', { class: 'input', placeholder: T('Usuario o correo para entrar (ej. laura.smile)', 'Login (e.g. laura.smile)'), autocomplete: 'off', autocapitalize: 'off' });
    const fRol = el('select', { class: 'select' }, [el('option', { value: 'agente', text: T('Agente', 'Agent') }), el('option', { value: 'supervisor', text: T('Supervisor', 'Supervisor') })]);
    const salida = el('div', { class: 'bj-eq__nuevo' });
    const btnAlta = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => {
      const nombre = fNom.value.trim(); const usuario = fUsr.value.trim();
      if (!nombre || !usuario) { toast(T('Escribe el nombre y el usuario.', 'Enter name and login.'), { type: 'error' }); return; }
      btnAlta.dataset.loading = 'true';
      try {
        const u = await api.post('/users', { name: nombre, email: usuario, role: 'client', client_id: cli.id });
        await api.patch(`/bandeja/equipo/${encodeURIComponent(u.id)}`, { rol: fRol.value });
        clear(salida);
        salida.append(...[
          el('p', { class: 'bj-aj__p', text: T('Listo. Pásale estos datos (la contraseña solo se ve esta vez):', 'Done. Share these details (the password is shown only once):') }),
          filaCopiar(T('Entrar en', 'Sign in at'), 'https://ivaestudios.com/marketing/'),
          filaCopiar(T('Usuario', 'Login'), usuario),
          u.password ? filaCopiar(T('Contraseña', 'Password'), u.password) : null,
        ].filter(Boolean));
        fNom.value = ''; fUsr.value = '';
        await cargarResumen();
        seccionRefrescar();
      } catch (e) { toast(e.message, { type: 'error', ms: 8000 }); }
      finally { delete btnAlta.dataset.loading; }
    } }, [icon('plus', 14), ' ' + T('Dar de alta', 'Add')]);
    caja.append(
      el('h4', { class: 'bj-aj__h4', text: T('Agregar a alguien del equipo', 'Add a team member') }),
      el('div', { class: 'field' }, [fNom]), el('div', { class: 'field' }, [fUsr]), el('div', { class: 'field' }, [fRol]), btnAlta, salida,
    );

    // Reparto.
    const cfg = info.cfg || {};
    const chkRep = el('input', { type: 'checkbox', checked: cfg.reparto !== false });
    const selReas = el('select', { class: 'select' }, [0, 10, 15, 30, 60].map((m) => el('option', { value: String(m), text: m ? T(`Si no contesta en ${m} min, pasa al siguiente`, `If no reply in ${m} min, pass it on`) : T('Nunca reasignar solo', 'Never reassign automatically'), selected: Number(cfg.reasignar_min || 0) === m })));
    const selDias = el('select', { class: 'select' }, [2, 3, 5, 7].map((dd) => el('option', { value: String(dd), text: T(`"Por seguir" a los ${dd} días sin respuesta`, `"Follow up" after ${dd} days without reply`), selected: Number(cfg.dias_seguimiento || 3) === dd })));
    const chkAg = el('input', { type: 'checkbox', checked: !!cfg.avisar_agencia });
    const btnCfg = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
      btnCfg.dataset.loading = 'true';
      try {
        await api.post(`/bandeja/cfg?client_id=${encodeURIComponent(cli.id)}`, { reparto: chkRep.checked, reasignar_min: Number(selReas.value), dias_seguimiento: Number(selDias.value), avisar_agencia: chkAg.checked });
        toast(T('Reparto guardado', 'Assignment saved'), { type: 'success' });
        await cargarResumen();
      } catch (e) { toast(e.message, { type: 'error' }); }
      finally { delete btnCfg.dataset.loading; }
    } }, [T('Guardar reparto', 'Save assignment')]);
    caja.append(
      el('h4', { class: 'bj-aj__h4', text: T('Reparto', 'Assignment') }),
      el('label', { class: 'bj-eq__chk' }, [chkRep, el('span', { text: T('Repartir los chats nuevos por turnos entre los agentes disponibles', 'Assign new chats round-robin among available agents') })]),
      el('div', { class: 'field' }, [selReas]),
      el('div', { class: 'field' }, [selDias]),
      el('label', { class: 'bj-eq__chk' }, [chkAg, el('span', { text: T('Avisar también a la agencia de cada mensaje nuevo', 'Also notify the agency of every new message') })]),
      btnCfg,
    );
    function seccionRefrescar() { const p = caja.parentNode; if (p) { caja.remove(); seccionEquipo(p, cli); } }
  })();
}

// Plantillas abiertas de WhatsApp: nombre de la marca en el texto fijo,
// crearlas en Meta y ver si ya están aprobadas.
function seccionPlantillas(body, cli) {
  const r = resumen && !resumen.error ? resumen : null;
  const caja = el('div', { class: 'bj-pl' });
  body.appendChild(caja);
  const pintar = (plantillas) => {
    clear(caja);
    caja.appendChild(el('p', { class: 'muted bj-aj__p', text: T(
      'Pasadas 24 h desde el último mensaje del paciente, WhatsApp solo deja mandar plantillas. Estas son "abiertas": saludo y cierre fijos, y en medio lo que escriba el agente. El paciente recibe un mensaje normal. Cuestan unos 15 centavos cada una.',
      'After 24 h since the patient\'s last message, WhatsApp only allows templates. These are "open": fixed greeting and closing, and the agent\'s text in the middle. About USD 0.01 each.') }));
    const nombre = el('input', { class: 'input', value: (r && r.cfg && r.cfg.nombre_comercial) || cli.name, placeholder: T('Nombre de la marca en el mensaje', 'Brand name in the message') });
    caja.append(el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Así se presenta la marca: "te escribe Laura de …"', 'Brand name: "this is Laura from …"') }), nombre]));
    const ul = el('ul', { class: 'bj-aj__lista' });
    for (const [k, p] of Object.entries(plantillas || {})) {
      const ok = p.estado === 'APPROVED';
      const cat = p.categoria === 'MARKETING' ? T(' · Meta la clasificó como marketing (≈ 75 centavos y con tope por persona)', ' · Meta classified it as marketing') : (p.categoria === 'UTILITY' ? T(' · utilidad (≈ 15 centavos)', ' · utility') : '');
      const txtEstado = ({ APPROVED: T('aprobada', 'approved'), PENDING: T('en revisión de Meta', 'in Meta review'), REJECTED: T('rechazada', 'rejected'), PAUSED: T('pausada', 'paused'), DISABLED: T('desactivada', 'disabled'), EXISTE: T('creada, revisando estado', 'created, checking status'), ERROR: T('error al crear', 'creation error') })[p.estado] || T('sin crear', 'not created');
      ul.appendChild(el('li', { class: ok ? 'is-ok' : 'is-bad' }, [
        icon(ok ? 'check' : 'clock', 14),
        el('span', {}, [el('strong', { text: `${p.titulo || k}: ${txtEstado}` }), cat ? el('span', { class: 'muted', text: cat }) : null, el('br'), el('span', { class: 'muted', text: p.cuerpo || '' }), p.motivo ? el('span', { class: 'bj-burbuja__err', text: ' · ' + p.motivo }) : null].filter(Boolean)),
      ]));
    }
    caja.appendChild(ul);
    const btnCrear = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => {
      btnCrear.dataset.loading = 'true';
      try {
        const nuevo = nombre.value.trim();
        if (nuevo && (!r || !r.cfg || nuevo !== r.cfg.nombre_comercial)) await api.post(`/bandeja/cfg?client_id=${encodeURIComponent(cli.id)}`, { nombre_comercial: nuevo });
        const x = await api.post(`/bandeja/plantillas?client_id=${encodeURIComponent(cli.id)}`, {});
        const malos = Object.entries(x.resultado || {}).filter(([, v]) => String(v).startsWith('ERROR'));
        toast(malos.length ? malos.map(([kk, v]) => `${kk}: ${v}`).join(' · ') : T('Plantillas enviadas a Meta. Suelen aprobarse en minutos.', 'Templates sent to Meta. Usually approved within minutes.'), { type: malos.length ? 'error' : 'success', ms: 9000 });
        await cargarResumen();
        pintar(resumen && resumen.plantillas);
      } catch (e) { toast(e.message, { type: 'error', ms: 9000 }); }
      finally { delete btnCrear.dataset.loading; }
    } }, [T('Crear plantillas en Meta', 'Create templates in Meta')]);
    const btnRev = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
      btnRev.dataset.loading = 'true';
      try { await api.get(`/bandeja/plantillas?client_id=${encodeURIComponent(cli.id)}`); await cargarResumen(); pintar(resumen && resumen.plantillas); toast(T('Estado actualizado', 'Status updated'), { type: 'success' }); }
      catch (e) { toast(e.message, { type: 'error' }); }
      finally { delete btnRev.dataset.loading; }
    } }, [icon('refresh', 14), ' ' + T('Revisar estado', 'Check status')]);
    caja.appendChild(el('div', { class: 'btn-row bj-aj__btns' }, [btnCrear, btnRev]));
  };
  pintar(r && r.plantillas);
}

// ── Ajustes (admin) ──────────────────────────────────────────────────────────
function abrirAjustes() {
  const cli = clienteActivo();
  ctx.sheet.openSheet({
    title: T('Ajustes de la bandeja', 'Inbox settings'),
    mode: 'form',
    build(body) {
      const cargando = el('p', { class: 'muted', text: T('Cargando…', 'Loading…') });
      body.appendChild(cargando);
      (async () => {
        let info = null;
        if (esAdmin()) { try { info = await api.get('/bandeja/webhook-info'); } catch (e) { info = { error: e.message }; } }
        clear(body);
        // 0) Equipo de ventas de la marca + plantillas abiertas de WhatsApp.
        if (cli) {
          body.appendChild(el('h3', { class: 'bj-aj__h', text: T('Equipo y reparto', 'Team and assignment') }));
          seccionEquipo(body, cli);
          body.appendChild(el('h3', { class: 'bj-aj__h', text: T('Plantillas de WhatsApp', 'WhatsApp templates') }));
          const rr = resumen && !resumen.error ? resumen : null;
          if (rr && rr.canales && rr.canales.whatsapp && rr.canales.whatsapp.conectado) seccionPlantillas(body, cli);
          else body.appendChild(el('p', { class: 'muted bj-aj__p', text: T('Conecta primero el WhatsApp de la marca (abajo). Las plantillas viven en su cuenta de WhatsApp.', 'Connect the brand WhatsApp first (below). Templates live in its WhatsApp account.') }));
        }
        if (!esAdmin()) return;
        // 1) Webhook para pegar en Meta
        body.appendChild(el('h3', { class: 'bj-aj__h', text: T('Webhook de Meta', 'Meta webhook') }));
        body.appendChild(el('p', { class: 'muted bj-aj__p', text: T(
          'Pega estos dos datos en la app de Meta (Webhooks → Instagram, Página y WhatsApp). Con eso los comentarios y mensajes llegan al instante. Mientras la app de Meta siga sin publicar, la bandeja se apoya en el sondeo cada 15 minutos.',
          'Paste these two values in the Meta app (Webhooks → Instagram, Page and WhatsApp). Then comments and messages arrive instantly. While the Meta app is unpublished, the inbox relies on polling every 15 minutes.'
        ) }));
        if (info.error) body.appendChild(el('p', { class: 'bj-aviso', text: info.error }));
        else {
          body.appendChild(filaCopiar(T('URL de devolución de llamada', 'Callback URL'), info.url));
          body.appendChild(filaCopiar(T('Token de verificación', 'Verify token'), info.verify_token));
          body.appendChild(el('p', { class: 'muted bj-aj__p', text: info.firma_configurada
            ? T('Firma: verificada con el secreto de la app ✓', 'Signature: verified with the app secret ✓')
            : T('Falta el secreto de la app en Cloudflare (FB_APP_SECRET): sin él el webhook rechaza todo.', 'The app secret is missing in Cloudflare (FB_APP_SECRET): without it the webhook rejects everything.') }));
          const u = info.ultimo_webhook;
          body.appendChild(el('p', { class: 'muted bj-aj__p', text: u
            ? T(`Último evento de Meta: ${timeAgo(u.en)} (${u.objeto}: ${u.mensajes} mensajes, ${u.comentarios} comentarios${u.sin_marca && u.sin_marca.length ? '; sin marca: ' + u.sin_marca.join(', ') : ''}).`,
                `Last Meta event: ${timeAgo(u.en)} (${u.objeto}: ${u.mensajes} messages, ${u.comentarios} comments${u.sin_marca && u.sin_marca.length ? '; no brand: ' + u.sin_marca.join(', ') : ''}).`)
            : T('Meta todavía no ha mandado ningún evento a esta URL.', 'Meta has not sent any event to this URL yet.') }));
        }
        // 2) Esta marca
        if (cli) {
          body.appendChild(el('h3', { class: 'bj-aj__h', text: cli.name }));
          const r = resumen && !resumen.error ? resumen : null;
          if (r && r.estado) {
            const est = r.estado;
            const filas = [['ig_comentarios', T('Comentarios de Instagram', 'Instagram comments')], ['ig_mensajes', T('Mensajes de Instagram', 'Instagram messages')], ['fb_comentarios', T('Comentarios de Facebook', 'Facebook comments')], ['fb_mensajes', 'Messenger']]
              .filter(([k]) => est[k] !== undefined);
            if (filas.length) {
              body.appendChild(el('p', { class: 'muted bj-aj__p', text: T(`Último sondeo: ${timeAgo(r.sondeo_at)}`, `Last poll: ${timeAgo(r.sondeo_at)}`) }));
              body.appendChild(el('ul', { class: 'bj-aj__lista' }, filas.map(([k, lbl]) => el('li', { class: est[k] === 'ok' ? 'is-ok' : 'is-bad' }, [
                icon(est[k] === 'ok' ? 'check' : 'warning', 14), el('span', { text: `${lbl}: ${est[k] === 'ok' ? T('bien', 'ok') : est[k]}` }),
              ]))));
            }
            if (est.webhook) {
              body.appendChild(el('ul', { class: 'bj-aj__lista' }, Object.entries(est.webhook).map(([k, v]) => el('li', { class: v === 'ok' ? 'is-ok' : 'is-bad' }, [
                icon(v === 'ok' ? 'check' : 'warning', 14), el('span', { text: `${T('Suscripción', 'Subscription')} ${CANAL_TXT[k] || k}: ${v === 'ok' ? T('activa', 'active') : v}` }),
              ]))));
            }
          }
          const btnSondear = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
            btnSondear.dataset.loading = 'true';
            try {
              const x = await api.post(`/bandeja/sondear?client_id=${encodeURIComponent(cli.id)}`, {});
              const res = x.resultado || {};
              toast(T(`Sondeo listo: ${res.comentarios || 0} comentarios y ${res.mensajes || 0} mensajes nuevos.`, `Poll done: ${res.comentarios || 0} new comments and ${res.mensajes || 0} new messages.`), { type: 'success' });
              await cargarResumen(); await cargarLista({ silencioso: true });
            } catch (e) { toast(e.message, { type: 'error' }); }
            finally { delete btnSondear.dataset.loading; }
          } }, [icon('refresh', 14), ' ' + T('Sondear ahora', 'Poll now')]);
          const btnSus = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
            btnSus.dataset.loading = 'true';
            try {
              const x = await api.post(`/bandeja/suscribir?client_id=${encodeURIComponent(cli.id)}`, {});
              const malos = Object.entries(x.resultado || {}).filter(([, v]) => v !== 'ok');
              toast(malos.length ? malos.map(([k, v]) => `${CANAL_TXT[k] || k}: ${v}`).join(' · ') : T('Marca suscrita a los webhooks.', 'Brand subscribed to webhooks.'), { type: malos.length ? 'error' : 'success', ms: 9000 });
              await cargarResumen();
            } catch (e) { toast(e.message, { type: 'error' }); }
            finally { delete btnSus.dataset.loading; }
          } }, [icon('zap', 14), ' ' + T('Suscribir a webhooks', 'Subscribe to webhooks')]);
          body.appendChild(el('div', { class: 'btn-row bj-aj__btns' }, [btnSondear, btnSus]));

          // 3) WhatsApp de la marca
          body.appendChild(el('h3', { class: 'bj-aj__h', text: T('WhatsApp de la marca', 'Brand WhatsApp') }));
          const wa = r && r.canales.whatsapp;
          if (wa && wa.conectado) {
            body.appendChild(el('p', { class: 'bj-aj__p', text: T(`Conectado: ${wa.cuenta || ''}`, `Connected: ${wa.cuenta || ''}`) }));
            const btnOff = el('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: async () => {
              try { await api.post('/bandeja/whatsapp/desconectar', { client_id: cli.id }); toast(T('WhatsApp desconectado.', 'WhatsApp disconnected.'), { type: 'success' }); await cargarResumen(); ctx.sheet.closeAll(); }
              catch (e) { toast(e.message, { type: 'error' }); }
            } }, [T('Desconectar', 'Disconnect')]);
            body.appendChild(btnOff);
          } else {
            body.appendChild(el('p', { class: 'muted bj-aj__p', text: T(
              'Cada marca usa su propio número de WhatsApp Business en la API de Meta. Desde el WhatsApp Manager del negocio copia el ID del número, el ID de la cuenta (WABA) y un token permanente de usuario del sistema, y pégalos aquí.',
              'Each brand uses its own WhatsApp Business number on the Meta API. From the business WhatsApp Manager copy the phone number ID, the account (WABA) ID and a permanent system-user token, and paste them here.'
            ) }));
            const fPhone = el('input', { class: 'input', inputmode: 'numeric', placeholder: T('ID del número (phone number ID)', 'Phone number ID') });
            const fWaba = el('input', { class: 'input', inputmode: 'numeric', placeholder: T('ID de la cuenta de WhatsApp (WABA)', 'WhatsApp Business Account ID (WABA)') });
            const fTok = el('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: T('Token permanente', 'Permanent token') });
            const btnWa = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => {
              btnWa.dataset.loading = 'true';
              try {
                const x = await api.post('/bandeja/whatsapp', { client_id: cli.id, phone_id: fPhone.value.trim(), waba_id: fWaba.value.trim(), token: fTok.value.trim() });
                toast(T(`WhatsApp conectado: ${x.numero || ''} ${x.nombre ? '(' + x.nombre + ')' : ''}`, `WhatsApp connected: ${x.numero || ''} ${x.nombre ? '(' + x.nombre + ')' : ''}`), { type: 'success' });
                fTok.value = '';
                await cargarResumen();
                ctx.sheet.closeAll();
              } catch (e) { toast(e.message, { type: 'error', ms: 9000 }); }
              finally { delete btnWa.dataset.loading; }
            } }, [T('Conectar WhatsApp', 'Connect WhatsApp')]);
            body.append(el('div', { class: 'field' }, [fPhone]), el('div', { class: 'field' }, [fWaba]), el('div', { class: 'field' }, [fTok]), btnWa);
          }

          // 4) Línea para llamadas grabadas (Twilio de la marca)
          body.appendChild(el('h3', { class: 'bj-aj__h', text: T('Llamadas grabadas', 'Recorded calls') }));
          seccionLinea(body, cli);
        }
      })();
    },
  });
}

// Línea de llamadas de la marca: se conecta con SU cuenta de Twilio. Las
// llamadas salen con ese número, se graban y se transcriben; si es un número
// de Twilio, cuando el paciente devuelve la llamada suena el celular de su agente.
function seccionLinea(body, cli) {
  const caja = el('div', { class: 'bj-ln' });
  body.appendChild(caja);
  const pintar = (ln) => {
    clear(caja);
    if (ln && ln.conectada) {
      caja.appendChild(el('p', { class: 'bj-aj__p', text: T(`Conectada: ${ln.numero}`, `Connected: ${ln.numero}`) }));
      caja.appendChild(el('p', { class: 'muted bj-aj__p', text: ln.entrantes
        ? T('Recibe llamadas: si el paciente devuelve la llamada, suena el celular de su agente (o de los disponibles). Si nadie contesta, va al desvío o al buzón de voz, que también se transcribe.', 'Takes calls: when the patient calls back, their agent\'s phone rings (or the available agents\'). If nobody answers, it goes to the forward number or voicemail, which is also transcribed.')
        : T('Solo para llamar: es un número verificado, así que cuando el paciente devuelve la llamada suena ese teléfono, no el CRM.', 'Outbound only: it is a verified number, so callbacks ring that phone, not the CRM.') }));
      const chkAviso = el('input', { id: 'bj-ln-aviso', type: 'checkbox', checked: ln.aviso !== false });
      const fDesvio = el('input', { id: 'bj-ln-desvio', class: 'input', type: 'tel', inputmode: 'tel', value: ln.desvio || '', placeholder: T('Opcional, ej. recepción 998 123 4567', 'Optional, e.g. front desk') });
      const btnG = el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
        btnG.dataset.loading = 'true';
        try {
          const x = await api.post('/bandeja/linea/cfg', { client_id: cli.id, aviso: chkAviso.checked, desvio: fDesvio.value.trim() });
          toast(T('Línea guardada', 'Line saved'), { type: 'success' });
          if (resumen && !resumen.error) resumen.llamadas = x.linea;
          pintar(x.linea);
        } catch (e) { toast(e.message, { type: 'error' }); }
        finally { delete btnG.dataset.loading; }
      } }, [T('Guardar', 'Save')]);
      const btnOff = el('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: async () => {
        if (!window.confirm(T('¿Desconectar la línea? Las llamadas ya grabadas se quedan.', 'Disconnect the line? Recorded calls stay.'))) return;
        try {
          await api.post('/bandeja/linea/desconectar', { client_id: cli.id });
          toast(T('Línea desconectada', 'Line disconnected'), { type: 'success' });
          await cargarResumen();
          pintar(resumen && resumen.llamadas);
        } catch (e) { toast(e.message, { type: 'error' }); }
      } }, [T('Desconectar', 'Disconnect')]);
      caja.append(...[
        el('label', { class: 'bj-eq__chk' }, [chkAviso, el('span', { text: T('Avisar al paciente que la llamada se graba (recomendado: son datos de salud)', 'Tell the patient the call is recorded (recommended)') })]),
        ln.entrantes ? el('div', { class: 'field' }, [el('label', { class: 'label', for: 'bj-ln-desvio', text: T('Si ningún agente contesta, desviar a', 'If no agent answers, forward to') }), fDesvio]) : null,
        el('div', { class: 'btn-row bj-aj__btns' }, [btnG, btnOff]),
      ].filter(Boolean));
      return;
    }
    caja.appendChild(el('p', { class: 'muted bj-aj__p', text: T(
      'El agente toca Llamar en el chat, le entra la llamada a su celular desde el número de la clínica y, al presionar una tecla, se marca al paciente. Todo se graba y se transcribe. Se conecta con una cuenta de Twilio de la marca: compra ahí un número de México (o verifica el número de la clínica) y pega estos tres datos.',
      'The agent taps Call in the chat, their phone rings from the clinic number and, after pressing a key, the patient is dialed. Everything is recorded and transcribed. Connect it with the brand\'s Twilio account: buy a Mexican number there (or verify the clinic number) and paste these three values.') }));
    const fSid = el('input', { id: 'bj-ln-sid', class: 'input', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: T('Account SID (empieza con AC)', 'Account SID (starts with AC)') });
    const fTok = el('input', { id: 'bj-ln-tok', class: 'input', type: 'password', autocomplete: 'off', placeholder: 'Auth Token' });
    const fNum = el('input', { id: 'bj-ln-num', class: 'input', type: 'tel', inputmode: 'tel', placeholder: T('Número de la línea, ej. +52 998 123 4567', 'Line number, e.g. +52 998 123 4567') });
    const btn = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => {
      btn.dataset.loading = 'true';
      try {
        const x = await api.post('/bandeja/linea', { client_id: cli.id, account_sid: fSid.value.trim(), auth_token: fTok.value.trim(), numero: fNum.value.trim() });
        fTok.value = '';
        toast(x.prueba
          ? T('Línea conectada. Ojo: la cuenta de Twilio está en prueba y solo puede llamar a números verificados.', 'Line connected. Note: the Twilio account is a trial and can only call verified numbers.')
          : T('Línea conectada. Ya se puede llamar desde los chats.', 'Line connected. Calls can be made from the chats.'), { type: x.prueba ? 'error' : 'success', ms: 9000 });
        if (resumen && !resumen.error) resumen.llamadas = x.linea;
        pintar(x.linea);
      } catch (e) { toast(e.message, { type: 'error', ms: 10000 }); }
      finally { delete btn.dataset.loading; }
    } }, [icon('phone', 14), ' ' + T('Conectar línea', 'Connect line')]);
    caja.append(el('div', { class: 'field' }, [fSid]), el('div', { class: 'field' }, [fTok]), el('div', { class: 'field' }, [fNum]), btn);
  };
  const r = resumen && !resumen.error ? resumen : null;
  pintar(r && r.llamadas);
}

function filaCopiar(label, valor) {
  return el('div', { class: 'bj-copiar' }, [
    el('span', { class: 'bj-copiar__lbl', text: label }),
    el('code', { class: 'bj-copiar__val', text: valor }),
    el('button', { type: 'button', class: 'btn btn-sm', onclick: async () => {
      try { await copyText(valor); toast(T('Copiado', 'Copied'), { type: 'success' }); }
      catch { toast(T('No se pudo copiar.', 'Could not copy.'), { type: 'error' }); }
    } }, [icon('copy', 14), ' ' + T('Copiar', 'Copy')]),
  ]);
}

// ── Montaje ──────────────────────────────────────────────────────────────────
// El CRM (embudo, oportunidades, tareas) vive en bandeja-crm.js; aquí se le
// pasa lo que comparte con la Bandeja.
function conectarDepsCRM() {
  conectarCRM({
    ctx: () => ctx,
    cid, esAgente, esSupervisor, yoMe, equipoAgentes,
    resumen: () => (resumen && !resumen.error ? resumen : null),
    ETAPAS, ETAPA_TXT, ETAPA_COLOR, CANAL_TXT, RESULTADO_TXT,
    icoCanal, colorDe, nombreDe, origenAnuncio, telDeConv, fmtTelUI, menuFiltro,
    textoEventoChat: textoNotaEvento,
    abrirLlamada,
    // Ir del CRM al chat de esa persona.
    abrirChat(convId) {
      tab = 'mensajes';
      try { ctx.router.navigate(VIEW_ID, { cliente: cid() }); } catch { /* sin router */ }
      pintarCabecera();
      pintarCuerpo();
      cargarLista();
      abrirConv(convId);
    },
    // Algo cambió en una oportunidad: contadores, la lista y el chat abierto.
    alCambiar(convId) {
      if (!mounted) return;
      cargarResumen();
      if (convAbierta && convAbierta.conversacion.id === convId) abrirConv(convId, { silencioso: true });
      if (tab === 'mensajes') cargarLista({ silencioso: true });
    },
  });
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => (l.getAttribute('href') || '').includes('/marketing/css/bandeja.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/bandeja.css?v=202610262345';
  document.head.appendChild(link);
}

function aplicarParams(params) {
  if (params && params.tab === 'comentarios' && !sinComentarios()) tab = 'comentarios';
  else if (params && params.tab === 'desempeno' && esSupervisor()) tab = 'desempeno';
  else if (params && params.tab === 'embudo') tab = 'embudo';
  if (params && params.op) { opPedida = params.op; tab = 'embudo'; }
  else if (params && params.tab === 'mensajes') tab = 'mensajes';
  if (params && params.seguir === '1') { porSeguir = true; tab = 'mensajes'; }
  if (params && params.conv) { convPedida = params.conv; tab = 'mensajes'; }
}

async function arrancar() {
  convAbierta = null;
  convs = []; coms = []; resumen = null;
  pintarCabecera();
  pintarCuerpo();
  await Promise.all([cargarResumen(), cargarLista()]);
  if (convPedida) { const id = convPedida; convPedida = null; await abrirConv(id); }
  if (opPedida) { const id = opPedida; opPedida = null; abrirOportunidad(id); }
}

export default {
  id: VIEW_ID,
  mount(host, c, params) {
    ctx = c;
    mounted = true;
    ensureCss();
    conectarDepsCRM();
    aplicarParams(params || ((ctx.router.current && ctx.router.current()) || {}).params);
    headEl = el('header', { class: 'bj-head' });
    segEl = el('div', { class: 'seg bj-seg', role: 'tablist', 'aria-label': T('Bandeja', 'Inbox') });
    cuerpoEl = el('div', { class: 'bj-cuerpo' });
    rootEl = el('div', { class: 'bj-root' }, [headEl, segEl, cuerpoEl]);
    host.appendChild(rootEl);
    unsubs.push(ctx.store.subscribe(['activeClientId'], () => { canal = ''; etapa = ''; busqueda = ''; asignado = ''; porSeguir = false; sinResponder = false; verArchivadas = false; desempeno = null; infoPlantilla.clear(); reiniciarCRM(); arrancar(); }));
    arrancar();
    programarRefresco();
  },
  onParams(params) {
    const antes = tab;
    aplicarParams(params);
    if (convPedida) { const id = convPedida; convPedida = null; if (tab !== antes) { pintarCabecera(); cargarLista(); } abrirConv(id); return; }
    if (tab !== antes) { convAbierta = null; pintarCabecera(); pintarCuerpo(); cargarLista(); }
    if (opPedida) { const id = opPedida; opPedida = null; abrirOportunidad(id); }
  },
  unmount() {
    mounted = false;
    clearInterval(timer); timer = null;
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; headEl = null; segEl = null; cuerpoEl = null; msgsEl = null; composerEl = null;
    convAbierta = null; ctx = null;
  },
};
