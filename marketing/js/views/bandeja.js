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
// ============================================================================
import { api, el, clear, timeAgo, initials, copyText } from '../api.js?v=202609251423';
import { toast } from '../shell/toast.js?v=202609251423';
import { icon, iconMarca } from '../shell/icons.js?v=202609251423';
import { T, isEN } from '../shell/i18n.js?v=202609251423';

const VIEW_ID = 'bandeja';
const REFRESCO_MS = 25000;

let ctx = null;
let rootEl = null;
let unsubs = [];
let timer = null;
let mounted = false;

let tab = 'mensajes';          // 'mensajes' | 'comentarios'
let canal = '';                // filtro de canal ('' = todos)
let etapa = '';                // filtro de etapa ('' = todas)
let soloSinLeer = false;
let busqueda = '';
let estadoCom = 'pendientes';  // 'pendientes' | 'todos'

let resumen = null;
let convs = [];
let coms = [];
let convAbierta = null;        // { conversacion, mensajes }
let convPedida = null;         // deep-link ?conv=
let cargandoLista = false;
let enviando = false;
const borradores = new Map();  // convId -> texto del composer

// ── Etiquetas ────────────────────────────────────────────────────────────────
const ETAPAS = ['nuevo', 'platica', 'cotizado', 'cliente', 'perdido'];
const ETAPA_TXT = {
  nuevo: () => T('Nuevo', 'New'),
  platica: () => T('En plática', 'Talking'),
  cotizado: () => T('Cotizado', 'Quoted'),
  cliente: () => T('Cliente', 'Customer'),
  perdido: () => T('Perdido', 'Lost'),
};
const ETAPA_COLOR = { nuevo: '#3b82f6', platica: '#a855f7', cotizado: '#f59e0b', cliente: '#22c55e', perdido: '#6b7280' };
const CANAL_TXT = { instagram: 'Instagram', messenger: 'Messenger', whatsapp: 'WhatsApp', facebook: 'Facebook', tiktok: 'TikTok' };
const CANAL_ICO = { instagram: 'instagram', messenger: 'messenger', facebook: 'facebook', whatsapp: 'whatsapp', tiktok: 'tiktok' };
// El logo de la red va RELLENO (iconMarca); si algún día llega un canal sin
// logo, cae al ícono de enlace para no dejar el hueco.
const icoCanal = (c, n) => iconMarca(CANAL_ICO[c] || '', n) || icon('link', n);
// Un color por app (Vianey, 25-sep-2026): Messenger celeste, Instagram rosado,
// WhatsApp verde, TikTok plomo oscuro. Mismos valores que --net-* en bandeja.css.
const CANAL_COLOR = { instagram: '#E1306C', messenger: '#0084FF', facebook: '#0084FF', whatsapp: '#25D366', tiktok: '#3A3A45' };
const colorDe = (canal) => CANAL_COLOR[canal] || 'var(--brand)';

const clienteActivo = () => {
  const st = ctx.store.getState();
  return (st.clients || []).find((c) => c.id === st.activeClientId) || null;
};
const esAdmin = () => ((ctx.store.getState().me || {}).role === 'admin');
const cid = () => (clienteActivo() || {}).id || '';

function chipCanal(c) {
  return el('span', { class: 'chip bj-chip-canal', style: { '--c': colorDe(c) } }, [
    icoCanal(c, 12), el('span', { class: 'chip__txt', text: CANAL_TXT[c] || c }),
  ]);
}
function chipEtapa(e) {
  return el('span', { class: 'chip', style: { '--c': ETAPA_COLOR[e] || 'var(--text-dim)' } }, [
    el('span', { class: 'swatch' }), el('span', { class: 'chip__txt', text: (ETAPA_TXT[e] || (() => e))() }),
  ]);
}
function nombreDe(v) {
  return v.nombre || (v.username ? '@' + v.username : (v.canal === 'whatsapp' ? '+' + v.contacto_id : T('Sin nombre', 'No name')));
}
function horasDesde(iso) {
  if (!iso) return Infinity;
  const d = new Date(String(iso).replace(' ', 'T') + 'Z');
  return isNaN(d) ? Infinity : (Date.now() - d.getTime()) / 36e5;
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function cargarResumen() {
  const id = cid();
  if (!id) return;
  try { resumen = await api.get(`/bandeja/resumen?client_id=${encodeURIComponent(id)}`); }
  catch (e) { resumen = { error: e.message }; }
  pintarCabecera();
}

async function cargarLista({ silencioso = false } = {}) {
  const id = cid();
  if (!id) return;
  if (!silencioso) cargandoLista = true;
  try {
    if (tab === 'mensajes') {
      const qs = new URLSearchParams({ client_id: id });
      if (canal) qs.set('canal', canal);
      if (etapa) qs.set('etapa', etapa);
      if (soloSinLeer) qs.set('sin_leer', '1');
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
    if (!silencioso) toast(e.message, { type: 'error' });
  }
  cargandoLista = false;
  pintarCuerpo();
}

async function abrirConv(convId, { silencioso = false } = {}) {
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
    await cargarLista({ silencioso: true });
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
  headEl.append(
    el('div', { class: 'bj-head__fila' }, [
      el('div', { class: 'bj-head__txt' }, [
        el('h1', { class: 'bj-title', text: T('Bandeja', 'Inbox') }),
        el('p', { class: 'bj-sub', text: cli
          ? T(`Comentarios y mensajes de ${cli.name}, en un solo lugar.`, `Comments and messages for ${cli.name}, all in one place.`)
          : T('Elige una marca arriba.', 'Pick a brand above.') }),
      ]),
      esAdmin() ? el('button', {
        class: 'btn btn-ghost btn-icon bj-gear', type: 'button', 'aria-label': T('Ajustes de la bandeja', 'Inbox settings'),
        onclick: abrirAjustes,
      }, [icon('settings', 18)]) : null,
    ].filter(Boolean)),
    r ? el('div', { class: 'bj-canales' }, ['instagram', 'messenger', 'whatsapp'].map((k) => {
      const c = r.canales[k];
      return el('span', { class: 'bj-canal' + (c.conectado ? ' is-on' : ''), style: { '--c': colorDe(k) } }, [
        icoCanal(k, 14), el('span', { text: CANAL_TXT[k] + (c.conectado && c.cuenta ? ' · ' + c.cuenta : '') }),
        c.conectado ? null : el('span', { class: 'bj-canal__off', text: T('sin conectar', 'not connected') }),
      ].filter(Boolean));
    })) : null,
  );
  // Segmento de pestañas con contadores vivos.
  if (segEl) {
    clear(segEl);
    const nMsg = r ? r.no_leidos : 0;
    const nCom = r ? r.comentarios_pendientes : 0;
    segEl.append(
      el('button', { type: 'button', role: 'tab', class: tab === 'mensajes' ? 'is-active' : '', 'aria-selected': String(tab === 'mensajes'), onclick: () => cambiarTab('mensajes') }, [
        el('span', { text: T('Mensajes', 'Messages') }), nMsg ? el('span', { class: 'bj-seg__n', text: String(nMsg) }) : null,
      ].filter(Boolean)),
      el('button', { type: 'button', role: 'tab', class: tab === 'comentarios' ? 'is-active' : '', 'aria-selected': String(tab === 'comentarios'), onclick: () => cambiarTab('comentarios') }, [
        el('span', { text: T('Comentarios', 'Comments') }), nCom ? el('span', { class: 'bj-seg__n', text: String(nCom) }) : null,
      ].filter(Boolean)),
    );
  }
}

function cambiarTab(t) {
  if (tab === t) return;
  tab = t;
  canal = '';
  convAbierta = null;
  pintarCabecera();
  pintarCuerpo();
  cargarLista();
  try { ctx.router.navigate(VIEW_ID, { cliente: cid(), ...(t === 'comentarios' ? { tab: 'comentarios' } : {}) }); } catch { /* sin router */ }
}

// ── Cuerpo ───────────────────────────────────────────────────────────────────
function pintarCuerpo() {
  if (!cuerpoEl) return;
  clear(cuerpoEl);
  rootEl.classList.toggle('is-chat', tab === 'mensajes' && !!convAbierta);
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

function filtrosMensajes() {
  const fila = el('div', { class: 'bj-filtros' });
  const canales = [['', T('Todos', 'All')], ['instagram', 'Instagram'], ['messenger', 'Messenger'], ['whatsapp', 'WhatsApp']];
  for (const [k, lbl] of canales) fila.appendChild(chipFiltro(lbl, canal === k, () => { canal = k; cargarLista(); pintarCuerpo(); }, null, k || null));
  fila.appendChild(chipFiltro(T('Sin leer', 'Unread'), soloSinLeer, () => { soloSinLeer = !soloSinLeer; cargarLista(); pintarCuerpo(); }, 'bell'));
  const sel = el('select', { class: 'select bj-select', 'aria-label': T('Etapa', 'Stage'), onchange: (e) => { etapa = e.target.value; cargarLista(); } }, [
    el('option', { value: '', text: T('Todas las etapas', 'All stages') }),
    ...ETAPAS.map((k) => el('option', { value: k, text: ETAPA_TXT[k](), selected: etapa === k })),
  ]);
  const buscar = el('input', { class: 'input bj-buscar', type: 'search', placeholder: T('Buscar persona o texto', 'Search person or text'), value: busqueda,
    oninput: (e) => { busqueda = e.target.value.trim(); clearTimeout(buscar._t); buscar._t = setTimeout(() => cargarLista(), 350); } });
  return el('div', { class: 'bj-filtros-wrap' }, [fila, el('div', { class: 'bj-filtros2' }, [sel, buscar])]);
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
        : (soloSinLeer || canal || etapa || busqueda
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
        el('span', { class: 'bj-conv__fila' }, [
          el('span', { class: 'bj-conv__ultimo', text: v.ultimo_texto || '' }),
          v.no_leidos
            ? el('span', { class: 'bj-conv__n', text: String(v.no_leidos) })
            : el('span', { class: 'bj-conv__etapa', style: { '--e': ETAPA_COLOR[v.etapa] || 'var(--text-mute)' }, title: (ETAPA_TXT[v.etapa] || (() => v.etapa))() }),
        ]),
      ]),
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
  const cerrada = horasDesde(v.ultimo_cliente_en) > 24;
  const head = el('header', { class: 'bj-chat__head', style: { '--c': colorDe(v.canal) } }, [
    el('button', { type: 'button', class: 'btn btn-ghost btn-icon bj-back', 'aria-label': T('Volver a la lista', 'Back to the list'), onclick: () => { convAbierta = null; pintarCuerpo(); } }, [icon('left', 20)]),
    el('span', { class: 'bj-avatar' }, [el('span', { text: initials(nombreDe(v)) }), el('span', { class: 'bj-avatar__ico' }, [icoCanal(v.canal, 11)])]),
    el('div', { class: 'bj-chat__quien' }, [
      el('div', { class: 'bj-chat__nombre', text: nombreDe(v) }),
      // Segundo renglón: canal, @usuario y la etapa como chip tocable (abre un
      // picker). Un <select> en el primer renglón no cabía en el teléfono y
      // dejaba el nombre en "A..".
      el('div', { class: 'bj-chat__meta' }, [
        el('span', { class: 'bj-chat__canal' }, [chipCanal(v.canal)]),
        v.username && v.nombre ? el('span', { class: 'muted bj-chat__user', text: '@' + v.username }) : null,
        el('button', { type: 'button', class: 'bj-etapa', 'aria-label': T('Cambiar etapa', 'Change stage'), onclick: async (e) => {
          const nueva = await ctx.sheet.pickFrom({ title: T('Etapa', 'Stage'), anchor: e.currentTarget, options: ETAPAS.map((k) => ({ value: k, label: ETAPA_TXT[k](), color: ETAPA_COLOR[k], current: v.etapa === k })) });
          if (nueva && nueva !== v.etapa) { await cambiarEtapa(v, nueva); pintarCuerpo(); }
        } }, [chipEtapa(v.etapa), icon('down', 13)]),
      ].filter(Boolean)),
    ]),
    el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': T('Ficha de la persona', 'Person card'), onclick: () => abrirFicha(v) }, [icon('user', 18)]),
  ]);

  msgsEl = el('div', { class: 'bj-msgs' });
  if (!mensajes.length) msgsEl.appendChild(el('p', { class: 'muted bj-msgs__nada', text: T('Todavía no hay mensajes.', 'No messages yet.') }));
  let diaPrev = '';
  for (const m of mensajes) {
    const dia = String(m.creado || '').slice(0, 10);
    if (dia !== diaPrev) { msgsEl.appendChild(el('div', { class: 'bj-dia', text: fmtDia(dia) })); diaPrev = dia; }
    msgsEl.appendChild(burbuja(m));
  }

  const draft = borradores.get(v.id) || '';
  const ta = el('textarea', { class: 'textarea bj-ta', rows: 1, placeholder: T('Escribe tu respuesta…', 'Write your reply…'),
    oninput: (e) => { borradores.set(v.id, e.target.value); autoAlto(e.target); },
    onkeydown: (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); enviar(v, ta); } } }, [draft]);
  requestAnimationFrame(() => autoAlto(ta));
  const btnIA = el('button', { type: 'button', class: 'btn btn-sm bj-ia', onclick: () => sugerirConv(v, ta, btnIA) }, [icon('sparkles', 14), ' ' + T('Sugerir', 'Suggest')]);
  const btnEnviar = el('button', { type: 'button', class: 'bj-enviar', 'aria-label': T('Enviar', 'Send'), title: T('Enviar', 'Send'), onclick: () => enviar(v, ta) }, [icon('send', 19)]);
  composerEl = el('div', { class: 'bj-composer' }, [
    cerrada ? el('p', { class: 'bj-aviso', text: v.canal === 'whatsapp'
      ? T('Han pasado más de 24 h desde su último mensaje: WhatsApp puede rechazar el envío hasta que vuelva a escribir.', 'More than 24 h since their last message: WhatsApp may reject the send until they write again.')
      : T('Han pasado más de 24 h desde su último mensaje: Meta puede rechazar el envío (se intenta como agente humano).', 'More than 24 h since their last message: Meta may reject the send (we retry as a human agent).') }) : null,
    el('div', { class: 'bj-composer__fila' }, [ta, el('div', { class: 'bj-composer__btns' }, [btnIA, btnEnviar])]),
  ].filter(Boolean));

  return el('div', { class: 'bj-chat__in', style: { '--c': colorDe(v.canal) } }, [head, msgsEl, composerEl]);
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
    else if (m.adjunto_tipo === 'audio') hijos.push(el('audio', { src: m.adjunto_url, controls: true, class: 'bj-adj-audio', preload: 'metadata' }));
    else hijos.push(el('a', { href: m.adjunto_url, target: '_blank', rel: 'noopener', class: 'bj-adj-link' }, [icon('link', 13), ' ' + ({ share: T('Publicación compartida', 'Shared post'), story_mention: T('Mención en historia', 'Story mention') }[m.adjunto_tipo] || T('Adjunto', 'Attachment'))]));
  } else if (m.adjunto_tipo && !m.texto) {
    hijos.push(el('span', { class: 'muted', text: ({ share: T('Compartió una publicación', 'Shared a post'), story_mention: T('Te mencionó en una historia', 'Mentioned you in a story') }[m.adjunto_tipo] || T('Adjunto', 'Attachment')) }));
  }
  if (m.texto) hijos.push(el('span', { class: 'bj-burbuja__txt', text: m.texto }));
  const pie = [el('span', { text: horaCorta(m.creado) })];
  if (salida && m.autor_nombre && m.autor_nombre !== 'Meta') pie.unshift(el('span', { text: m.autor_nombre + ' · ' }));
  if (m.estado === 'error') pie.push(el('span', { class: 'bj-burbuja__err', text: ' · ' + T('No se envió', 'Not sent') + (m.error ? ': ' + m.error : '') }));
  // La hora va DENTRO de la burbuja (como WhatsApp), no debajo.
  return el('div', { class: 'bj-burbuja' + (salida ? ' is-out' : ' is-in') + (m.estado === 'error' ? ' is-error' : '') }, [
    el('div', { class: 'bj-burbuja__cuerpo' }, [...hijos, el('div', { class: 'bj-burbuja__pie' }, pie)]),
  ]);
}

function autoAlto(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(160, Math.max(44, ta.scrollHeight)) + 'px';
}

async function enviar(v, ta) {
  const texto = (ta.value || '').trim();
  if (!texto || enviando) return;
  enviando = true;
  ta.disabled = true;
  try {
    await api.post(`/bandeja/conversaciones/${encodeURIComponent(v.id)}/enviar`, { texto });
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

async function cambiarEtapa(v, nueva) {
  try {
    await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, { etapa: nueva });
    v.etapa = nueva;
    const enLista = convs.find((x) => x.id === v.id);
    if (enLista) enLista.etapa = nueva;
    toast(T(`Etapa: ${ETAPA_TXT[nueva]()}`, `Stage: ${ETAPA_TXT[nueva]()}`), { type: 'success' });
  } catch (e) { toast(e.message, { type: 'error' }); }
}

// Ficha CRM: nombre, etapa, seguimiento, notas, archivar.
function abrirFicha(v) {
  ctx.sheet.openSheet({
    title: T('Ficha de la persona', 'Person card'),
    mode: 'form',
    build(body, close) {
      const nombre = el('input', { class: 'input', value: v.nombre || '', placeholder: T('Nombre', 'Name') });
      const seg = el('input', { class: 'input', type: 'date', value: v.seguimiento || '' });
      const notas = el('textarea', { class: 'textarea', rows: 4, placeholder: T('Notas: qué pidió, qué se le cotizó, qué sigue…', 'Notes: what they asked, what was quoted, what is next…') }, [v.notas || '']);
      const sel = el('select', { class: 'select' }, ETAPAS.map((k) => el('option', { value: k, text: ETAPA_TXT[k](), selected: v.etapa === k })));
      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Nombre', 'Name') }), nombre]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Etapa', 'Stage') }), sel]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Dar seguimiento el', 'Follow up on') }), seg,
          el('p', { class: 'field__hint muted', text: T('Ese día te llega un aviso al teléfono.', 'You get an alert on your phone that day.') })]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Notas', 'Notes') }), notas]),
        el('p', { class: 'muted bj-ficha__id', text: `${CANAL_TXT[v.canal]} · ${v.canal === 'whatsapp' ? '+' + v.contacto_id : 'ID ' + v.contacto_id}` }),
        el('div', { class: 'btn-row bj-ficha__btns' }, [
          el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
            try {
              await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, { nombre: nombre.value.trim(), etapa: sel.value, seguimiento: seg.value || '', notas: notas.value });
              Object.assign(v, { nombre: nombre.value.trim() || null, etapa: sel.value, seguimiento: seg.value || null, notas: notas.value });
              toast(T('Ficha guardada', 'Card saved'), { type: 'success' });
              close({ force: true });
              await cargarLista({ silencioso: true });
              pintarCuerpo();
            } catch (e) { toast(e.message, { type: 'error' }); }
          } }, [T('Guardar', 'Save')]),
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
            try {
              await api.patch(`/bandeja/conversaciones/${encodeURIComponent(v.id)}`, { archivado: !v.archivado });
              toast(v.archivado ? T('Conversación recuperada', 'Conversation restored') : T('Conversación archivada', 'Conversation archived'), { type: 'success' });
              close({ force: true });
              convAbierta = null;
              await cargarLista({ silencioso: true });
              pintarCuerpo();
            } catch (e) { toast(e.message, { type: 'error' }); }
          } }, [v.archivado ? T('Recuperar', 'Restore') : T('Archivar', 'Archive')]),
        ]),
      );
    },
  });
}

// ── Comentarios ──────────────────────────────────────────────────────────────
function filtrosComentarios() {
  const fila = el('div', { class: 'bj-filtros' });
  fila.append(
    chipFiltro(T('Pendientes', 'Pending'), estadoCom === 'pendientes', () => { estadoCom = 'pendientes'; cargarLista(); pintarCuerpo(); }, 'bell'),
    chipFiltro(T('Todos', 'All'), estadoCom === 'todos', () => { estadoCom = 'todos'; cargarLista(); pintarCuerpo(); }),
    el('span', { class: 'bj-filtros__sep' }),
    chipFiltro('Instagram', canal === 'instagram', () => { canal = canal === 'instagram' ? '' : 'instagram'; cargarLista(); pintarCuerpo(); }, 'instagram'),
    chipFiltro('Facebook', canal === 'facebook', () => { canal = canal === 'facebook' ? '' : 'facebook'; cargarLista(); pintarCuerpo(); }, 'facebook'),
  );
  return el('div', { class: 'bj-filtros-wrap' }, [fila]);
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
  card.append(
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
  );
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
    oninput: (e) => autoAlto(e.target) });
  const btnIA = el('button', { type: 'button', class: 'btn btn-sm bj-ia', onclick: () => sugerirCom(k, ta, btnIA) }, [icon('sparkles', 14), ' ' + T('Sugerir', 'Suggest')]);
  const btnPub = el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => responderCom(k, ta, 'publico', btnPub) }, [icon('send', 14), ' ' + T('Responder', 'Reply')]);
  const btnAmbos = el('button', { type: 'button', class: 'btn btn-sm', onclick: () => responderCom(k, ta, 'ambos', btnAmbos), title: T('Responde en público y además le manda un mensaje privado (Meta permite uno por comentario).', 'Replies publicly and also sends a private message (Meta allows one per comment).') }, [T('Responder + mensaje', 'Reply + DM')]);
  const btnVisto = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => marcarComentario(k, true) }, [icon('check', 14), ' ' + T('Visto', 'Seen')]);
  const btnOcultar = el('button', { type: 'button', class: 'btn btn-ghost btn-sm bj-ocultar', onclick: () => ocultarCom(k, btnOcultar) }, [icon('eye', 14), ' ' + T('Ocultar', 'Hide')]);
  card.appendChild(el('div', { class: 'bj-com__acciones' }, [
    ta,
    el('div', { class: 'bj-com__btns' }, [btnIA, btnPub, btnAmbos, btnVisto, btnOcultar]),
  ]));
  return card;
}

async function responderCom(k, ta, modo, btn) {
  const texto = (ta.value || '').trim();
  if (!texto) { toast(T('Escribe la respuesta primero.', 'Write the reply first.'), { type: 'info' }); ta.focus(); return; }
  btn.dataset.loading = 'true';
  try {
    const r = await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/responder`, { texto, modo });
    toast(r.dm ? T('Respondido en público y por mensaje.', 'Replied publicly and by DM.') : T('Respuesta publicada.', 'Reply published.'), { type: 'success' });
    await cargarLista({ silencioso: true });
    cargarResumen();
  } catch (e) {
    toast(e.message, { type: 'error', ms: 9000 });
  } finally { delete btn.dataset.loading; }
}
async function sugerirCom(k, ta, btn) {
  btn.dataset.loading = 'true';
  try {
    const r = await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/sugerir`, {});
    ta.value = r.sugerencia || '';
    autoAlto(ta);
    ta.focus();
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { delete btn.dataset.loading; }
}
async function marcarComentario(k, atendido) {
  try {
    await api.post(`/bandeja/comentarios/${encodeURIComponent(k.id)}/atendido`, { atendido });
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
        try { info = await api.get('/bandeja/webhook-info'); } catch (e) { info = { error: e.message }; }
        clear(body);
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
        }
      })();
    },
  });
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
function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => (l.getAttribute('href') || '').includes('/marketing/css/bandeja.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/bandeja.css?v=202609251423';
  document.head.appendChild(link);
}

function aplicarParams(params) {
  if (params && params.tab === 'comentarios') tab = 'comentarios';
  else if (params && params.tab === 'mensajes') tab = 'mensajes';
  if (params && params.conv) { convPedida = params.conv; tab = 'mensajes'; }
}

async function arrancar() {
  convAbierta = null;
  convs = []; coms = []; resumen = null;
  pintarCabecera();
  pintarCuerpo();
  await Promise.all([cargarResumen(), cargarLista()]);
  if (convPedida) { const id = convPedida; convPedida = null; await abrirConv(id); }
}

export default {
  id: VIEW_ID,
  mount(host, c, params) {
    ctx = c;
    mounted = true;
    ensureCss();
    aplicarParams(params || ((ctx.router.current && ctx.router.current()) || {}).params);
    headEl = el('header', { class: 'bj-head' });
    segEl = el('div', { class: 'seg bj-seg', role: 'tablist', 'aria-label': T('Bandeja', 'Inbox') });
    cuerpoEl = el('div', { class: 'bj-cuerpo' });
    rootEl = el('div', { class: 'bj-root' }, [headEl, segEl, cuerpoEl]);
    host.appendChild(rootEl);
    unsubs.push(ctx.store.subscribe(['activeClientId'], () => { canal = ''; etapa = ''; busqueda = ''; arrancar(); }));
    arrancar();
    programarRefresco();
  },
  onParams(params) {
    const antes = tab;
    aplicarParams(params);
    if (convPedida) { const id = convPedida; convPedida = null; if (tab !== antes) { pintarCabecera(); cargarLista(); } abrirConv(id); return; }
    if (tab !== antes) { convAbierta = null; pintarCabecera(); pintarCuerpo(); cargarLista(); }
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
