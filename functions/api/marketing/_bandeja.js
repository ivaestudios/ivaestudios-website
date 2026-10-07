// ============================================================================
// IVAE Marketing — BANDEJA por marca: comentarios + mensajes + CRM.
//
// Pedido de Vianey (23-sep-2026): "quiero que también conteste comentarios,
// quiero tener un CRM donde pueda contestar Messenger, Insta, WhatsApp".
//
// Cómo entra todo:
//   · WEBHOOK  POST /api/marketing/webhook/meta  (firmado con el App Secret).
//     Instagram (object=instagram): comentarios en entry[].changes y DMs en
//     entry[].messaging. Página (object=page): comentarios en changes.feed y
//     Messenger en messaging. WhatsApp (object=whatsapp_business_account).
//     La marca se reconoce por el id de la cuenta/página/número que Meta manda.
//   · SONDEO   sondearBandeja(env) desde el cron del publicador (cada 15 min):
//     lee comentarios y conversaciones con el token de cada marca. Es el
//     respaldo mientras la app de Meta no esté publicada (sin publicar, Meta
//     no manda webhooks) y por si alguno se pierde.
// Cómo sale: respuestas públicas a comentarios (IG /replies, FB /comments),
// respuesta privada al autor (private reply), DMs (IG Login API, Messenger
// Platform, WhatsApp Cloud API). Fuera de la ventana de 24 h se reintenta con
// la etiqueta HUMAN_AGENT (7 días) y, si Meta la rechaza, se explica claro.
//
// Reglas de la casa que viven aquí: nunca se guardan dos veces (mid /
// comment_id únicos), los comentarios de la propia marca no cuentan, en el
// primer sondeo lo viejo (>48 h) entra ya atendido y sin aviso (anti-tormenta),
// y cada marca solo ve lo suyo (todo cuelga de client_id).
// ============================================================================
import { repartirPush } from './_push.js';

const GRAPH_FB = 'https://graph.facebook.com/v23.0';
const GRAPH_IG = 'https://graph.instagram.com/v23.0';
// 'cita' (7-oct-2026, SMILE NOW): para una clínica el resultado que importa es
// la cita agendada; el dashboard del dueño la cuenta por agente y por anuncio.
export const ETAPAS = ['nuevo', 'platica', 'cotizado', 'cita', 'cliente', 'perdido'];
const CANALES_MSG = ['instagram', 'messenger', 'whatsapp', 'correo'];
const LIM_TEXTO = { instagram: 950, messenger: 1900, whatsapp: 4000, correo: 20000 };
// CORREO (6-oct-2026, Israel: "agrega correos"): el buzón info@ entra a la
// Bandeja de UNA marca (la que diga mkt_kv 'bandeja_correo_marca'). Los correos
// NUEVOS los deja aquí el bot (ivae-juan), que ya los recibe del robot de
// Google; las respuestas salen por Resend desde info@ con copia oculta a info@
// para que también queden en el Gmail.
const KV_CORREO_MARCA = 'bandeja_correo_marca';
const CORREO_BUZON = 'info@ivaestudios.com';
async function correoDeLaMarca(env, clientId) {
  try { const r = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_CORREO_MARCA).first(); return !!(r && r.value === clientId); }
  catch { return false; }
}
const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// FIRMA de info@ (Israel, 6-oct: "se tiene que enviar con la firma"): la misma
// imagen de la firma de Gmail (Vianey Díaz · Directora · IVAE Studios), copiada
// a nuestro dominio para que no se rompa si cambian la firma en Gmail.
const FIRMA_IMG = 'https://ivaestudios.com/marketing/img/firma-vianey-ivae.jpg';
const FIRMA_TXT = 'Vianey Díaz\nDirectora · IVAE Studios\n+52 228 857 0584 · info@ivaestudios.com\n@ivae.studios · www.ivaestudios.com';
const FIRMA_HTML = `<img src="${FIRMA_IMG}" width="420" height="210" alt="Vianey Díaz · Directora · IVAE Studios · +52 228 857 0584 · info@ivaestudios.com · @ivae.studios · www.ivaestudios.com" style="display:block;width:420px;max-width:100%;height:auto;border:0">`;
// "El <fecha>, <quien> escribió:" + el correo original citado, como Gmail: la
// respuesta llega como correo aparte y así no pierde el contexto.
function citaCorreo(ult, conv) {
  if (!ult || !ult.texto) return { html: '', txt: '' };
  const quien = conv.nombre ? `${conv.nombre} <${conv.contacto_id}>` : conv.contacto_id;
  // creado viene en UTC ("AAAA-MM-DD HH:MM:SS"): se muestra en hora de Cancún.
  let fecha = String(ult.creado || '').slice(0, 16);
  try {
    const d = new Date(String(ult.creado).replace(' ', 'T') + 'Z');
    if (!isNaN(d)) fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  } catch { /* se queda la fecha cruda */ }
  const cuerpo = String(ult.texto).replace(/^Asunto:.*\n+/, '').slice(0, 6000);
  return {
    html: `<div style="margin-top:18px;color:#5f6368;font-size:13px">El ${escHtml(fecha)}, ${escHtml(quien)} escribió:</div>`
      + `<blockquote style="margin:6px 0 0 0;padding-left:12px;border-left:2px solid #ccc;color:#5f6368;font-size:13px">${escHtml(cuerpo).replace(/\n/g, '<br>')}</blockquote>`,
    txt: `\n\nEl ${fecha}, ${quien} escribió:\n` + cuerpo.split('\n').map((l) => '> ' + l).join('\n'),
  };
}
const MODELO_SUGERENCIA = 'claude-haiku-4-5-20251001';
const KV_VERIFY = 'bandeja_verify_token';
const KV_ULTIMO_WEBHOOK = 'bandeja_webhook_ultimo';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Fecha como la guarda D1: 'YYYY-MM-DD HH:MM:SS' en UTC.
function fechaDeMs(ms) {
  const n = Number(ms);
  const d = Number.isFinite(n) && n > 0 ? new Date(n) : new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
// Meta manda '2026-09-23T10:00:00+0000'; se normaliza al mismo formato.
function fechaDeIso(s) {
  if (!s) return fechaDeMs(Date.now());
  const d = new Date(String(s).replace(/\+0000$/, 'Z'));
  return isNaN(d) ? fechaDeMs(Date.now()) : fechaDeMs(d.getTime());
}
export function nombreCanal(c) {
  return { instagram: 'Instagram', messenger: 'Messenger', facebook: 'Facebook', whatsapp: 'WhatsApp', correo: 'correo' }[c] || c;
}

// ── Cliente de la Graph API ──────────────────────────────────────────────────
// Token en el header (nunca en la URL: no aparece en logs). Reintenta red y
// 5xx/429; un 4xx sale de inmediato con el código de Meta para explicarlo.
async function graph(url, { method = 'GET', token, body, form } = {}) {
  const headers = { authorization: `Bearer ${token}` };
  let payload;
  if (body) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  else if (form) { payload = new URLSearchParams(form); }
  let ultimo = null;
  for (let intento = 0; intento < 3; intento++) {
    let res, data;
    try {
      res = await fetch(url, { method, headers, body: payload, signal: AbortSignal.timeout(15000) });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ultimo = new Error('Meta no respondió: ' + (e && e.message)); ultimo.code = 'RED';
      await espera(600 * (intento + 1));
      continue;
    }
    if (res.ok && !data.error) return data;
    const err = new Error((data.error && (data.error.error_user_msg || data.error.message)) || `HTTP ${res.status}`);
    err.code = data.error && data.error.code;
    err.subcode = data.error && data.error.error_subcode;
    err.status = res.status;
    const transitorio = res.status === 429 || res.status >= 500 || String(err.code) === '4' || String(err.code) === '17';
    if (!transitorio) throw err;
    ultimo = err;
    await espera(600 * (intento + 1));
  }
  throw ultimo || new Error('Meta no respondió');
}

// Traduce el error de Meta a algo que Vianey pueda leer y actuar.
export function explicarError(e, canal) {
  const code = String((e && e.code) || '');
  const sub = String((e && e.subcode) || '');
  const msg = String((e && e.message) || e || '');
  if (code === '131047' || sub === '2534022' || /allowed window|outside.*window|24 ?hours/i.test(msg)) {
    return {
      ventana: true,
      msg: canal === 'whatsapp'
        ? 'La ventana de 24 h de WhatsApp está cerrada: hasta que la persona vuelva a escribir no se le pueden mandar mensajes normales.'
        : 'La ventana de 24 h de este chat está cerrada (la persona lleva más de un día sin escribir). Meta solo deja contestar después con el permiso Human Agent, que todavía no está aprobado.',
    };
  }
  if (code === '190') return { permiso: true, msg: `La conexión de ${nombreCanal(canal)} caducó. Reconecta la cuenta desde Conexiones.` };
  if (code === '10' || code === '200' || code === '3' || /permission|not authorized|does not have the capability|\(#100\) Tried accessing nonexisting/i.test(msg)) {
    return { permiso: true, msg: `Falta un permiso en la conexión de ${nombreCanal(canal)}: reconecta la cuenta desde Conexiones marcando todo, o falta la aprobación de Meta para hablar con el público. (${msg.slice(0, 120)})` };
  }
  if (sub === '2534014' || sub === '2534015' || /already (sent|replied)/i.test(msg)) {
    return { msg: 'Ese comentario ya recibió su respuesta privada (Meta permite una sola por comentario).' };
  }
  return { msg: `No se pudo (${code || 'error'}): ${msg.slice(0, 160)}` };
}
function resumirError(e) {
  return explicarError(e).msg.slice(0, 200);
}

// Parte un texto largo en piezas <= lim sin cortar palabras ni emojis.
export function partirTexto(texto, lim) {
  const chars = Array.from(String(texto || ''));
  if (chars.length <= lim) return [String(texto || '')];
  const piezas = [];
  let resto = chars;
  while (resto.length > lim) {
    const vTxt = resto.slice(0, lim).join('');
    let corte = vTxt.lastIndexOf('\n');
    if (corte < lim * 0.4) {
      const frase = Math.max(vTxt.lastIndexOf('. '), vTxt.lastIndexOf('! '), vTxt.lastIndexOf('? '));
      corte = frase >= lim * 0.4 ? frase + 1 : vTxt.lastIndexOf(' ');
    }
    const nChars = corte < 1 ? lim : Array.from(vTxt.slice(0, corte)).length;
    const pieza = resto.slice(0, nChars).join('').trim();
    if (pieza) piezas.push(pieza);
    resto = Array.from(resto.slice(nChars).join('').trim());
  }
  const cola = resto.join('').trim();
  if (cola) piezas.push(cola);
  return piezas.length ? piezas : [String(texto || '')];
}

// ── Marcas ───────────────────────────────────────────────────────────────────
const COLS_MARCA = `id, name, brief, notes, instagram_handle, COALESCE(workspace_id, 'ivae') AS workspace_id,
  ig_user_id, ig_igsid, ig_username, ig_access_token, fb_page_id, fb_page_name, fb_access_token,
  wa_phone_id, wa_waba_id, wa_numero, wa_access_token, bandeja_sondeo_at, bandeja_estado, bandeja_cfg`;

// Los ids con los que Meta puede nombrar a la PROPIA cuenta de la marca en un
// canal. En Instagram son dos (migración 039): ig_user_id (36610…, el de la
// API) e ig_igsid (17841…, el de webhooks y participantes de /conversations).
function idsPropios(c, canal) {
  if (canal === 'instagram') return new Set([c.ig_user_id, c.ig_igsid].filter(Boolean).map(String));
  return new Set([c.fb_page_id].filter(Boolean).map(String));
}

async function marca(env, clientId) {
  if (!clientId) return null;
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE id = ?`).bind(clientId).first();
}
async function marcaPorIg(env, igId) {
  if (!igId) return null;
  // La marca DEMO comparte @ivae.studios con la marca real: gana la real
  // (la que no es demo) para que los mensajes no caigan en la de los revisores.
  // Meta manda en los webhooks el user_id (17841…), no el id de la API: se
  // busca por los dos.
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE (ig_user_id = ? OR ig_igsid = ?) AND ig_access_token IS NOT NULL ORDER BY (id = '67322bb3c5f64991a9178b1d1784231a') ASC LIMIT 1`).bind(igId, igId).first();
}
async function marcaPorPagina(env, pageId) {
  if (!pageId) return null;
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE fb_page_id = ? AND fb_access_token IS NOT NULL ORDER BY (id = '67322bb3c5f64991a9178b1d1784231a') ASC LIMIT 1`).bind(pageId).first();
}
async function marcaPorWa(env, phoneId) {
  if (!phoneId) return null;
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE wa_phone_id = ? AND wa_access_token IS NOT NULL LIMIT 1`).bind(phoneId).first();
}

// Quién recibe los avisos de una marca: admins y equipo activos de SU workspace.
async function staffDeLaMarca(env, c) {
  try {
    const r = await env.DB.prepare(
      "SELECT id FROM mkt_users WHERE active = 1 AND role IN ('admin', 'team') AND COALESCE(workspace_id, 'ivae') = ?"
    ).bind(c.workspace_id || 'ivae').all();
    return (r.results || []).map((x) => x.id);
  } catch { return []; }
}

// Aviso en la campana + push al teléfono a una lista de usuarios. Best-effort:
// jamás rompe la entrada.
async function avisarUsuarios(env, c, ids, { tipo, body, link }) {
  try {
    const unicos = [...new Set((ids || []).filter(Boolean))];
    if (!unicos.length) return 0;
    await env.DB.batch(unicos.map((uid) => env.DB.prepare(
      'INSERT INTO mkt_notifications (id, user_id, client_id, type, actor_name, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(randomId(), uid, c.id, tipo, c.name, body, link)));
    await repartirPush(env, unicos, { titulo: c.name, cuerpo: body, link: '/marketing/app' + link, tipo, quien: c.name }).catch(() => {});
    return unicos.length;
  } catch (e) {
    console.error('[bandeja aviso]', e && e.message);
    return 0;
  }
}
async function avisarStaff(env, c, aviso) {
  return avisarUsuarios(env, c, await staffDeLaMarca(env, c), aviso);
}

// ── EQUIPO DE LA MARCA, REPARTO Y EVENTOS (migración 040) ────────────────────
// Pedido de Israel para SMILE NOW (7-oct-2026): los leads de las campañas se
// reparten parejo entre los agentes, cada agente recibe el aviso de SUS chats
// y el dueño ve un dashboard con quién contesta, cuánto tarda y cuántas citas.
// Un agente o supervisor es un acceso de CLIENTE de la marca con bandeja_rol.
const CFG_BASE = { reparto: true, reasignar_min: 0, dias_seguimiento: 3, avisar_agencia: false, nombre_comercial: '' };
function cfgDe(c) {
  let x = {};
  try { x = c && c.bandeja_cfg ? JSON.parse(c.bandeja_cfg) : {}; } catch { x = {}; }
  return { ...CFG_BASE, ...x, plantillas: (x && x.plantillas) || {} };
}
async function guardarCfg(env, clientId, cfg) {
  await env.DB.prepare('UPDATE mkt_clients SET bandeja_cfg = ? WHERE id = ?').bind(JSON.stringify(cfg), clientId).run();
}
// Todos los accesos de cliente de la marca (con o sin rol en la bandeja).
async function accesosDeMarca(env, clientId) {
  try {
    const r = await env.DB.prepare(
      `SELECT id, name, email, username, bandeja_rol, COALESCE(bandeja_disponible, 1) AS disponible, active
         FROM mkt_users WHERE role = 'client' AND client_id = ? ORDER BY name COLLATE NOCASE`
    ).bind(clientId).all();
    return r.results || [];
  } catch { return []; }
}
async function equipoDeMarca(env, clientId) {
  return (await accesosDeMarca(env, clientId)).filter((u) => u.active && (u.bandeja_rol === 'agente' || u.bandeja_rol === 'supervisor'));
}
async function registrarEvento(env, { clientId, convId = null, userId = null, userNombre = null, tipo, dato = null }) {
  try {
    await env.DB.prepare(
      'INSERT INTO mkt_bandeja_eventos (id, client_id, conv_id, user_id, user_nombre, tipo, dato) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(randomId(), clientId, convId, userId, userNombre, tipo, dato ? JSON.stringify(dato) : null).run();
  } catch (e) { console.error('[bandeja evento]', e && e.message); }
}
// REPARTO PAREJO: entre los agentes activos y disponibles gana el que lleva más
// tiempo sin recibir un chat (por turnos). Con 4 agentes y 40 leads, 10 cada uno.
async function siguienteAgente(env, clientId, excluir = null) {
  const r = await env.DB.prepare(
    `SELECT u.id, u.name,
            (SELECT MAX(e.creado) FROM mkt_bandeja_eventos e
              WHERE e.client_id = ? AND e.user_id = u.id AND e.tipo IN ('asignacion', 'reasignacion', 'tomada')) AS ultimo
       FROM mkt_users u
      WHERE u.role = 'client' AND u.client_id = ? AND u.bandeja_rol = 'agente' AND u.active = 1 AND COALESCE(u.bandeja_disponible, 1) = 1`
  ).bind(clientId, clientId).all();
  const lista = (r.results || []).filter((u) => u.id !== excluir);
  if (!lista.length) return null;
  lista.sort((a, b) => String(a.ultimo || '').localeCompare(String(b.ultimo || '')) || String(a.name).localeCompare(String(b.name)));
  return lista[0];
}
async function asignar(env, c, convId, agente, { tipo = 'asignacion', dato = null } = {}) {
  await env.DB.prepare("UPDATE mkt_conversaciones SET asignado_a = ?, asignado_en = datetime('now') WHERE id = ?").bind(agente.id, convId).run();
  await registrarEvento(env, { clientId: c.id, convId, userId: agente.id, userNombre: agente.name, tipo, dato });
}
// Al entrar un mensaje: si el chat no tiene agente (o el suyo ya no está activo)
// y la marca tiene equipo, se asigna por turno. El paciente que regresa se
// queda con SU agente. Devuelve { agente, nuevo }.
async function asignarSiToca(env, c, convId) {
  const cfg = cfgDe(c);
  if (cfg.reparto === false) return { agente: null, nuevo: false };
  const v = await env.DB.prepare(
    `SELECT v.asignado_a, u.active, u.name FROM mkt_conversaciones v LEFT JOIN mkt_users u ON u.id = v.asignado_a WHERE v.id = ?`
  ).bind(convId).first();
  if (!v) return { agente: null, nuevo: false };
  if (v.asignado_a && v.active) return { agente: { id: v.asignado_a, name: v.name }, nuevo: false };
  const ag = await siguienteAgente(env, c.id);
  if (!ag) return { agente: null, nuevo: false };
  await asignar(env, c, convId, ag);
  return { agente: ag, nuevo: true };
}
// Aviso de mensaje entrante. Marca SIN equipo: como siempre (staff de la
// agencia). Marca CON equipo: al agente del chat; si nadie lo tiene, a los
// supervisores. La agencia solo se entera si la marca lo pide (avisar_agencia).
async function avisarEntrada(env, c, convId, { body, link, asignacion }) {
  const equipo = await equipoDeMarca(env, c.id);
  if (!equipo.length) return avisarStaff(env, c, { tipo: 'mensaje', body, link });
  const ag = asignacion && asignacion.agente;
  const dest = ag ? [ag.id] : equipo.filter((u) => u.bandeja_rol === 'supervisor').map((u) => u.id);
  const n = await avisarUsuarios(env, c, dest, { tipo: 'mensaje', body: asignacion && asignacion.nuevo ? `Nuevo lead para ti · ${body}` : body, link });
  if (cfgDe(c).avisar_agencia) await avisarStaff(env, c, { tipo: 'mensaje', body, link });
  return n;
}
// De qué anuncio llegó el lead. WhatsApp manda `referral` en el primer mensaje
// de un anuncio Click to WhatsApp; Messenger e Instagram, `referral` con
// source ADS. Se guarda el PRIMER origen (primer contacto).
function origenDe(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const ctx = ref.ads_context_data || {};
  const esAnuncio = ref.source_type === 'ad' || ref.source === 'ADS' || !!ref.ad_id || !!ref.ctwa_clid;
  return {
    tipo: esAnuncio ? 'anuncio' : String(ref.source_type || ref.source || 'referido').toLowerCase(),
    ad_id: String(ref.source_id || ref.ad_id || '') || null,
    titulo: String(ref.headline || ctx.ad_title || ref.body || '').slice(0, 140) || null,
    url: ref.source_url || null,
    ctwa_clid: ref.ctwa_clid || null,
  };
}
async function guardarOrigen(env, convId, origen) {
  if (!origen) return;
  try { await env.DB.prepare('UPDATE mkt_conversaciones SET origen = COALESCE(origen, ?) WHERE id = ?').bind(JSON.stringify(origen), convId).run(); }
  catch { /* el origen es un extra */ }
}
function horasDesde(s) {
  if (!s) return Infinity;
  const t = Date.parse(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
  return isNaN(t) ? Infinity : (Date.now() - t) / 36e5;
}

// ── Conversaciones y mensajes ────────────────────────────────────────────────
async function convDe(env, c, canal, contactoId, { nombre = null, username = null, resolverNombre = false } = {}) {
  const ya = await env.DB.prepare(
    'SELECT id, no_leidos, nombre, username, archivado FROM mkt_conversaciones WHERE client_id = ? AND canal = ? AND contacto_id = ?'
  ).bind(c.id, canal, contactoId).first();
  if (ya) {
    if ((nombre && !ya.nombre) || (username && !ya.username)) {
      await env.DB.prepare('UPDATE mkt_conversaciones SET nombre = COALESCE(nombre, ?), username = COALESCE(username, ?) WHERE id = ?')
        .bind(nombre, username, ya.id).run();
    }
    return { id: ya.id, nueva: false, noLeidosAntes: ya.no_leidos, nombre: ya.nombre || nombre, username: ya.username || username };
  }
  if (resolverNombre && !nombre) {
    const p = await perfilContacto(c, canal, contactoId);
    nombre = p.nombre || nombre;
    username = p.username || username;
  }
  const id = randomId();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO mkt_conversaciones (id, client_id, canal, contacto_id, nombre, username) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, c.id, canal, contactoId, nombre, username).run();
  // Carrera entre webhook y sondeo: si otro la creó primero, se usa la suya.
  const fila = await env.DB.prepare('SELECT id, no_leidos FROM mkt_conversaciones WHERE client_id = ? AND canal = ? AND contacto_id = ?')
    .bind(c.id, canal, contactoId).first();
  return { id: fila ? fila.id : id, nueva: true, noLeidosAntes: fila ? fila.no_leidos : 0, nombre, username };
}

// Nombre de la persona (best-effort; sin permiso de mensajes Meta lo niega).
async function perfilContacto(c, canal, contactoId) {
  try {
    if (canal === 'instagram' && c.ig_access_token) {
      const d = await graph(`${GRAPH_IG}/${contactoId}?fields=name,username`, { token: c.ig_access_token });
      return { nombre: d.name || '', username: d.username || '' };
    }
    if (canal === 'messenger' && c.fb_access_token) {
      const d = await graph(`${GRAPH_FB}/${contactoId}?fields=name`, { token: c.fb_access_token });
      return { nombre: d.name || '', username: '' };
    }
  } catch { /* sin nombre: se muestra el id */ }
  return { nombre: '', username: '' };
}

// true si se guardó (false = ya existía ese mid).
async function insertarMensaje(env, { convId, mid = null, direccion, texto = '', adjunto = null, autorUserId = null, autorNombre = null, estado = null, error = null, creado = null, via = null }) {
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO mkt_mensajes (id, conv_id, mid, direccion, texto, adjunto_tipo, adjunto_url, adjunto_id, autor_user_id, autor_nombre, estado, error, creado, via)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`
  ).bind(randomId(), convId, mid || null, direccion, String(texto || '').slice(0, 8000),
    adjunto ? adjunto.tipo || null : null, adjunto ? adjunto.url || null : null, adjunto ? adjunto.id || null : null,
    autorUserId, autorNombre, estado, error, creado, via).run();
  return !!(r.meta && r.meta.changes);
}

// Recalcula el resumen de la conversación desde sus mensajes (robusto ante
// mensajes que llegan desordenados por el sondeo) y suma los no leídos nuevos.
async function refrescarConv(env, convId, nuevosEntrantes = 0) {
  await env.DB.prepare(
    `UPDATE mkt_conversaciones SET
       ultimo_texto = (SELECT CASE WHEN texto IS NOT NULL AND texto != '' THEN texto
                                   WHEN adjunto_tipo = 'image' THEN '📷 Foto'
                                   WHEN adjunto_tipo = 'video' THEN '🎥 Video'
                                   WHEN adjunto_tipo = 'audio' THEN '🎤 Audio'
                                   WHEN adjunto_tipo IS NOT NULL THEN '📎 Adjunto' ELSE '' END
                       FROM mkt_mensajes WHERE conv_id = ? ORDER BY creado DESC, rowid DESC LIMIT 1),
       ultimo_en = (SELECT MAX(creado) FROM mkt_mensajes WHERE conv_id = ?),
       ultimo_cliente_en = (SELECT MAX(creado) FROM mkt_mensajes WHERE conv_id = ? AND direccion = 'in'),
       no_leidos = no_leidos + ?,
       archivado = CASE WHEN ? > 0 THEN 0 ELSE archivado END,
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(convId, convId, convId, nuevosEntrantes, nuevosEntrantes, convId).run();
}

function adjuntoDeMeta(m) {
  const a = m && m.attachments && m.attachments[0];
  if (!a) return null;
  const tipo = { image: 'image', video: 'video', audio: 'audio', file: 'file', share: 'share', story_mention: 'story_mention', reel: 'share', ig_reel: 'share', template: 'share' }[a.type] || a.type || 'file';
  return { tipo, url: (a.payload && (a.payload.url || a.payload.sticker_id)) || null };
}
function textoDeAdjunto(adj) {
  if (!adj) return '';
  return { image: '📷 Foto', video: '🎥 Video', audio: '🎤 Audio', share: '🔗 Compartió una publicación', story_mention: '✨ Te mencionó en una historia' }[adj.tipo] || '📎 Adjunto';
}

// ── ENTRADA: mensajes ────────────────────────────────────────────────────────
// Un evento de entry[].messaging de Instagram o Messenger. Devuelve 1 si guardó.
// Quién mandó un mensaje que llega como ECO (escrito en la app de Instagram,
// Business Suite o la app de WhatsApp): el agente que tocó "Seguir desde la
// app" en esa conversación en la última hora. Así el seguimiento cuenta a su
// nombre en el dashboard aunque no haya salido del CRM.
async function autorDeEco(env, convId) {
  try {
    const e = await env.DB.prepare(
      "SELECT user_id, user_nombre FROM mkt_bandeja_eventos WHERE conv_id = ? AND tipo = 'abrio_app' AND creado >= datetime('now', '-60 minutes') ORDER BY creado DESC LIMIT 1"
    ).bind(convId).first();
    return e ? { id: e.user_id, nombre: e.user_nombre } : null;
  } catch { return null; }
}

async function ingerirMensajeMeta(env, c, canal, ev) {
  const m = ev && ev.message;
  if (!m && !(ev && ev.postback)) {
    // Un evento solo de "referral" (la persona abrió el chat desde un anuncio
    // y todavía no escribe): se guarda de qué anuncio viene.
    if (ev && ev.referral && ev.sender && ev.sender.id && !idsPropios(c, canal).has(String(ev.sender.id))) {
      const conv = await convDe(env, c, canal, String(ev.sender.id), { resolverNombre: true });
      await guardarOrigen(env, conv.id, origenDe(ev.referral));
    }
    return 0; // delivery / read / reaction: no interesan
  }
  const propios = idsPropios(c, canal);
  const cuando = fechaDeMs(ev.timestamp);
  if (m && m.is_echo) {
    // ECO de un mensaje SALIENTE (nuestro por API, o escrito en la bandeja de
    // Meta / la app de Instagram). Si lo mandamos nosotros ya está guardado
    // con ese mid y el INSERT OR IGNORE lo deja pasar.
    const contacto = String((ev.recipient && ev.recipient.id) || '');
    if (!contacto || propios.has(contacto)) return 0;
    const conv = await convDe(env, c, canal, contacto);
    const adj = adjuntoDeMeta(m);
    const quien = await autorDeEco(env, conv.id);
    const ok = await insertarMensaje(env, { convId: conv.id, mid: m.mid, direccion: 'out', texto: m.text || '', adjunto: adj, autorUserId: quien ? quien.id : null, autorNombre: quien ? quien.nombre : 'Meta', estado: 'enviado', creado: cuando, via: 'app' });
    if (ok) await refrescarConv(env, conv.id, 0);
    return ok ? 1 : 0;
  }
  const contacto = String((ev.sender && ev.sender.id) || '');
  if (!contacto || propios.has(contacto)) return 0;
  const texto = m ? (m.text || '') : (ev.postback.title || ev.postback.payload || '');
  const mid = m ? m.mid : `pb:${contacto}:${ev.timestamp}`;
  const adj = m ? adjuntoDeMeta(m) : null;
  const conv = await convDe(env, c, canal, contacto, { resolverNombre: true });
  const ok = await insertarMensaje(env, { convId: conv.id, mid, direccion: 'in', texto, adjunto: adj, creado: cuando });
  if (!ok) return 0;
  await refrescarConv(env, conv.id, 1);
  await guardarOrigen(env, conv.id, origenDe(ev.referral || (m && m.referral) || (ev.postback && ev.postback.referral)));
  const asignacion = await asignarSiToca(env, c, conv.id);
  // Un aviso por ráfaga: si ya había mensajes sin leer, el equipo ya lo sabe
  // (salvo que el chat se acabe de asignar: ese agente tiene que enterarse).
  if (!conv.noLeidosAntes || asignacion.nuevo) {
    const quien = conv.nombre || (conv.username ? '@' + conv.username : 'Alguien');
    await avisarEntrada(env, c, conv.id, {
      body: `${quien} te escribió por ${nombreCanal(canal)}: "${(texto || textoDeAdjunto(adj)).slice(0, 90)}"`,
      link: `#/bandeja?cliente=${c.id}&conv=${conv.id}`,
      asignacion,
    });
  }
  return 1;
}

// Un mensaje de WhatsApp Cloud API (value.messages[]).
async function ingerirMensajeWa(env, c, m, nombre) {
  if (!m || !m.from) return 0;
  const contacto = String(m.from);
  const cuando = fechaDeMs(Number(m.timestamp) * 1000);
  let texto = '';
  let adj = null;
  switch (m.type) {
    case 'text': texto = (m.text && m.text.body) || ''; break;
    case 'image': adj = { tipo: 'image', id: m.image && m.image.id }; texto = (m.image && m.image.caption) || ''; break;
    case 'sticker': adj = { tipo: 'image', id: m.sticker && m.sticker.id }; break;
    case 'video': adj = { tipo: 'video', id: m.video && m.video.id }; texto = (m.video && m.video.caption) || ''; break;
    case 'audio': adj = { tipo: 'audio', id: m.audio && m.audio.id }; break;
    case 'document': adj = { tipo: 'file', id: m.document && m.document.id }; texto = (m.document && (m.document.caption || m.document.filename)) || ''; break;
    case 'location': texto = `📍 ${(m.location && (m.location.name || m.location.address)) || ''} ${m.location ? m.location.latitude + ',' + m.location.longitude : ''}`.trim(); break;
    case 'button': texto = (m.button && m.button.text) || '(tocó un botón)'; break;
    case 'interactive': texto = (m.interactive && ((m.interactive.button_reply && m.interactive.button_reply.title) || (m.interactive.list_reply && m.interactive.list_reply.title))) || '(eligió una opción)'; break;
    case 'contacts': texto = '👤 Compartió un contacto'; break;
    case 'reaction': return 0;
    default: texto = m.type ? `(${m.type})` : '';
  }
  const conv = await convDe(env, c, 'whatsapp', contacto, { nombre: nombre || null });
  const ok = await insertarMensaje(env, { convId: conv.id, mid: m.id, direccion: 'in', texto, adjunto: adj, creado: cuando });
  if (!ok) return 0;
  await refrescarConv(env, conv.id, 1);
  await guardarOrigen(env, conv.id, origenDe(m.referral));
  const asignacion = await asignarSiToca(env, c, conv.id);
  if (!conv.noLeidosAntes || asignacion.nuevo) {
    await avisarEntrada(env, c, conv.id, {
      body: `${conv.nombre || '+' + contacto} te escribió por WhatsApp: "${(texto || textoDeAdjunto(adj)).slice(0, 90)}"`,
      link: `#/bandeja?cliente=${c.id}&conv=${conv.id}`,
      asignacion,
    });
  }
  return 1;
}

// ECO de WhatsApp (coexistencia: mismo número en la app del celular y en la
// API). Lo que el equipo manda desde la app llega aquí; Meta no lo cobra y no
// tiene ventana de 24 h. Campo smb_message_echoes del webhook.
async function ingerirEcoWa(env, c, e) {
  const contacto = String((e && e.to) || '');
  if (!contacto) return 0;
  let texto = '';
  let adj = null;
  switch (e.type) {
    case 'text': texto = (e.text && e.text.body) || ''; break;
    case 'image': adj = { tipo: 'image', id: e.image && e.image.id }; texto = (e.image && e.image.caption) || ''; break;
    case 'video': adj = { tipo: 'video', id: e.video && e.video.id }; texto = (e.video && e.video.caption) || ''; break;
    case 'audio': adj = { tipo: 'audio', id: e.audio && e.audio.id }; break;
    case 'document': adj = { tipo: 'file', id: e.document && e.document.id }; texto = (e.document && (e.document.caption || e.document.filename)) || ''; break;
    default: texto = e.type ? `(${e.type})` : '';
  }
  const conv = await convDe(env, c, 'whatsapp', contacto);
  const quien = await autorDeEco(env, conv.id);
  const ok = await insertarMensaje(env, {
    convId: conv.id, mid: e.id, direccion: 'out', texto, adjunto: adj,
    autorUserId: quien ? quien.id : null, autorNombre: quien ? quien.nombre : 'App de WhatsApp',
    estado: 'enviado', creado: fechaDeMs(Number(e.timestamp) * 1000), via: 'app',
  });
  if (ok) await refrescarConv(env, conv.id, 0);
  return ok ? 1 : 0;
}

// ESTADOS de WhatsApp: la API contesta "aceptado" aunque el mensaje nunca
// llegue (ventana de 24 h cerrada, pago, tope de marketing). El fallo real
// llega minutos después por aquí; sin esto la Bandeja decía "enviado" de algo
// que el paciente jamás recibió.
const FALLOS_WA = {
  131047: 'No llegó: pasaron más de 24 h desde el último mensaje de la persona. Vuelve a enviarlo y saldrá dentro de la plantilla.',
  131049: 'No llegó: Meta lo frenó para no saturar a la persona con mensajes de marketing. Intenta mañana o llama.',
  131042: 'No llegó: hay un problema de pago en la cuenta de WhatsApp. Revisa la tarjeta en Facturación de Meta.',
  131026: 'No llegó: ese número no tiene WhatsApp o no puede recibir mensajes.',
  131050: 'No llegó: la persona pidió no recibir mensajes de marketing de esta marca.',
  131051: 'No llegó: WhatsApp no admite ese tipo de mensaje.',
  132000: 'No llegó: el texto no cabe en la plantilla aprobada (revisa saltos de línea y largo).',
  132001: 'No llegó: la plantilla no existe o Meta todavía no la aprueba.',
  132015: 'No llegó: Meta pausó la plantilla por quejas o baja lectura.',
  132016: 'No llegó: Meta desactivó la plantilla.',
  130472: 'No llegó: la persona está en un experimento de Meta que limita mensajes de marketing.',
};
function explicarFalloWa(err) {
  const code = Number(err && err.code);
  if (FALLOS_WA[code]) return FALLOS_WA[code];
  const det = (err && ((err.error_data && err.error_data.details) || err.message || err.title)) || '';
  return `No llegó (${code || 'error'}): ${String(det).slice(0, 150)}`;
}
async function aplicarEstadoWa(env, c, st) {
  const mid = String((st && st.id) || '');
  if (!mid) return 0;
  const cuando = fechaDeMs(Number(st.timestamp) * 1000);
  const m = await env.DB.prepare('SELECT id, estado, conv_id, autor_user_id, texto FROM mkt_mensajes WHERE mid = ?').bind(mid).first();
  if (!m) return 0; // mensajes del bot u otros sistemas que no pasan por la Bandeja
  if (st.status === 'failed') {
    const err = (st.errors || [])[0] || {};
    const motivo = explicarFalloWa(err);
    await env.DB.prepare("UPDATE mkt_mensajes SET estado = 'fallido', error = ? WHERE id = ?").bind(motivo.slice(0, 300), m.id).run();
    // Quien lo mandó se entera al instante (si no, cree que dio seguimiento).
    if (m.autor_user_id && m.estado !== 'fallido') {
      const v = await env.DB.prepare('SELECT nombre, contacto_id FROM mkt_conversaciones WHERE id = ?').bind(m.conv_id).first();
      await avisarUsuarios(env, c, [m.autor_user_id], {
        tipo: 'mensaje',
        body: `Tu mensaje a ${(v && (v.nombre || '+' + v.contacto_id)) || 'un contacto'} no llegó. ${motivo}`,
        link: `#/bandeja?cliente=${c.id}&conv=${m.conv_id}`,
      });
    }
    return 1;
  }
  if (st.status === 'delivered') {
    await env.DB.prepare("UPDATE mkt_mensajes SET entregado_en = COALESCE(entregado_en, ?), estado = CASE WHEN estado IS NULL OR estado = 'enviado' THEN 'entregado' ELSE estado END WHERE id = ?").bind(cuando, m.id).run();
    return 1;
  }
  if (st.status === 'read') {
    await env.DB.prepare("UPDATE mkt_mensajes SET leido_en = COALESCE(leido_en, ?), entregado_en = COALESCE(entregado_en, ?), estado = CASE WHEN estado IS NULL OR estado IN ('enviado', 'entregado') THEN 'leido' ELSE estado END WHERE id = ?").bind(cuando, cuando, m.id).run();
    return 1;
  }
  return 0;
}

// ── ENTRADA: comentarios ─────────────────────────────────────────────────────
// cm = {canal, commentId, mediaId, permalink, caption, parentId, autor, autorId, texto, cuando}
// frescoDesde: en el primer sondeo, lo anterior a esa fecha entra ya atendido
// y sin aviso (si no, el primer día llegarían 200 avisos de comentarios viejos).
async function guardarComentario(env, c, cm, { frescoDesde = null, avisar = true } = {}) {
  if (!cm.commentId) return 0;
  const propio = (cm.autorId && (idsPropios(c, 'instagram').has(String(cm.autorId)) || cm.autorId === String(c.fb_page_id || '')))
    || (cm.canal === 'instagram' && cm.autor && c.ig_username && String(cm.autor).toLowerCase() === String(c.ig_username).toLowerCase());
  if (propio) return 0; // lo escribió la marca (o nosotros): no es algo que atender
  // Lo de hace más de 7 días entra ya atendido y sin aviso, sea el sondeo que
  // sea: una publicación vieja que se lee por primera vez no es trabajo nuevo
  // (pasó con @ivae.studios: comentarios de marzo a junio salían "pendientes").
  const limite = fechaDeMs(Date.now() - 7 * 24 * 3600e3);
  const viejo = !!(cm.cuando && ((frescoDesde && cm.cuando < frescoDesde) || cm.cuando < limite));
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO mkt_comentarios (id, client_id, canal, comment_id, media_id, media_permalink, media_caption, parent_id, autor, autor_id, texto, comentado_en, atendido)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(randomId(), c.id, cm.canal, String(cm.commentId), cm.mediaId || null, cm.permalink || null,
    cm.caption ? String(cm.caption).slice(0, 300) : null, cm.parentId || null, cm.autor || null, cm.autorId || null,
    String(cm.texto || '').slice(0, 4000), cm.cuando || fechaDeMs(Date.now()), viejo ? 1 : 0).run();
  if (!(r.meta && r.meta.changes)) return 0;
  if (avisar && !viejo) {
    await avisarStaff(env, c, {
      tipo: 'comentario',
      body: `${cm.autor || 'Alguien'} comentó en ${nombreCanal(cm.canal)}: "${String(cm.texto || '').slice(0, 90)}"`,
      link: `#/bandeja?cliente=${c.id}&tab=comentarios`,
    });
  }
  return 1;
}

function comentarioDeWebhookIG(v) {
  return {
    canal: 'instagram',
    commentId: v.id,
    mediaId: v.media && v.media.id,
    parentId: v.parent_id || null,
    autor: (v.from && v.from.username) || '',
    autorId: String((v.from && v.from.id) || ''),
    texto: v.text || '',
    cuando: fechaDeMs(Date.now()),
  };
}
function comentarioDeWebhookFB(v) {
  if (v.item !== 'comment' || v.verb !== 'add') return null;
  return {
    canal: 'facebook',
    commentId: v.comment_id,
    mediaId: v.post_id || null,
    permalink: (v.post && v.post.permalink_url) || null,
    parentId: v.parent_id && v.parent_id !== v.post_id ? v.parent_id : null,
    autor: (v.from && v.from.name) || '',
    autorId: String((v.from && v.from.id) || ''),
    texto: v.message || '',
    cuando: v.created_time ? fechaDeMs(Number(v.created_time) * 1000) : fechaDeMs(Date.now()),
  };
}

// ── WEBHOOK ──────────────────────────────────────────────────────────────────
async function firmaValida(secreto, raw, firma) {
  if (!firma || !firma.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
  const dado = firma.slice(7).toLowerCase();
  if (dado.length !== hex.length) return false;
  let dif = 0;
  for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ dado.charCodeAt(i);
  return dif === 0;
}

// Token de verificación del webhook: se genera una vez y se guarda en mkt_kv.
// Solo el admin lo lee (GET /bandeja/webhook-info) para pegarlo en Meta.
export async function tokenVerificacion(env, { crear = false } = {}) {
  const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_VERIFY).first().catch(() => null);
  if (row && row.value) return row.value;
  if (!crear) return null;
  const tok = 'ivae-' + randomId();
  await env.DB.prepare('INSERT OR IGNORE INTO mkt_kv (key, value) VALUES (?, ?)').bind(KV_VERIFY, tok).run();
  const otra = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_VERIFY).first();
  return (otra && otra.value) || tok;
}

// GET = verificación de Meta (hub.challenge). POST = eventos firmados.
export async function handleWebhookMeta(request, env, url, waitUntil) {
  if (request.method === 'GET') {
    const modo = url.searchParams.get('hub.mode');
    const tok = url.searchParams.get('hub.verify_token') || '';
    const reto = url.searchParams.get('hub.challenge') || '';
    const esperado = await tokenVerificacion(env);
    if (modo === 'subscribe' && esperado && tok === esperado) {
      return new Response(reto, { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await request.text();
  const firma = request.headers.get('x-hub-signature-256') || '';
  // Instagram (app hija) y la app madre firman con su propio App Secret; se
  // aceptan los dos. Sin secreto configurado: cerrado (nunca abierto en silencio).
  const secretos = [...new Set([env.FB_APP_SECRET, env.META_APP_SECRET].filter(Boolean))];
  let ok = false;
  for (const s of secretos) { if (await firmaValida(s, raw, firma)) { ok = true; break; } }
  if (!ok) return new Response('Unauthorized', { status: 401 });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }
  const trabajo = procesarWebhook(env, body).catch((e) => console.error('[bandeja webhook]', e && e.message));
  if (typeof waitUntil === 'function') waitUntil(trabajo); else await trabajo;
  return new Response('OK', { status: 200 });
}

export async function procesarWebhook(env, body) {
  const obj = body && body.object;
  const resumen = { objeto: obj || '', mensajes: 0, comentarios: 0, sin_marca: [] };
  for (const entry of (body && body.entry) || []) {
    const entryId = String(entry.id || '');
    if (obj === 'instagram') {
      let c = await marcaPorIg(env, entryId);
      // Por si Meta manda otro id en entry: el destinatario del DM es la cuenta.
      if (!c) {
        const ev0 = (entry.messaging || [])[0];
        const rid = ev0 && ((ev0.message && ev0.message.is_echo) ? ev0.sender && ev0.sender.id : ev0.recipient && ev0.recipient.id);
        if (rid) c = await marcaPorIg(env, String(rid));
      }
      if (!c) { resumen.sin_marca.push(`instagram:${entryId}`); continue; }
      for (const ev of entry.messaging || []) resumen.mensajes += await ingerirMensajeMeta(env, c, 'instagram', ev);
      for (const ch of entry.changes || []) {
        if (ch.field === 'comments') resumen.comentarios += await guardarComentario(env, c, comentarioDeWebhookIG(ch.value || {}));
      }
    } else if (obj === 'page') {
      const c = await marcaPorPagina(env, entryId);
      if (!c) { resumen.sin_marca.push(`page:${entryId}`); continue; }
      for (const ev of entry.messaging || []) resumen.mensajes += await ingerirMensajeMeta(env, c, 'messenger', ev);
      for (const ch of entry.changes || []) {
        if (ch.field !== 'feed') continue;
        const cm = comentarioDeWebhookFB(ch.value || {});
        if (cm) resumen.comentarios += await guardarComentario(env, c, cm);
      }
    } else if (obj === 'whatsapp_business_account') {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        const phoneId = v.metadata && v.metadata.phone_number_id;
        const c = await marcaPorWa(env, phoneId ? String(phoneId) : '');
        if (!c) { resumen.sin_marca.push(`whatsapp:${phoneId || entryId}`); continue; }
        if (ch.field === 'smb_message_echoes') {
          for (const e of v.message_echoes || []) resumen.mensajes += await ingerirEcoWa(env, c, e);
          continue;
        }
        const nombres = {};
        for (const ct of v.contacts || []) nombres[String(ct.wa_id)] = ct.profile && ct.profile.name;
        for (const m of v.messages || []) resumen.mensajes += await ingerirMensajeWa(env, c, m, nombres[String(m.from)]);
        for (const st of v.statuses || []) resumen.estados = (resumen.estados || 0) + await aplicarEstadoWa(env, c, st);
      }
    }
  }
  // Huella del último webhook (sin contenido): la pantalla de ajustes la
  // enseña para saber si Meta ya está mandando algo, sin abrir logs.
  try {
    await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind(KV_ULTIMO_WEBHOOK, JSON.stringify({
      en: new Date().toISOString(), objeto: resumen.objeto, mensajes: resumen.mensajes, comentarios: resumen.comentarios, sin_marca: resumen.sin_marca.slice(0, 5),
    })).run();
  } catch { /* la huella es opcional */ }
  return resumen;
}

// ── SONDEO (respaldo de los webhooks) ────────────────────────────────────────
async function sondearComentariosIG(env, c, frescoDesde) {
  const medios = await graph(`${GRAPH_IG}/${c.ig_user_id}/media?fields=id,permalink,caption,timestamp,comments_count&limit=12`, { token: c.ig_access_token });
  let n = 0;
  for (const md of medios.data || []) {
    if (!md.comments_count) continue;
    const cms = await graph(`${GRAPH_IG}/${md.id}/comments?fields=id,text,username,timestamp,from,replies{id,text,username,timestamp,from}&limit=50`, { token: c.ig_access_token });
    for (const cm of cms.data || []) {
      const base = { canal: 'instagram', mediaId: md.id, permalink: md.permalink, caption: md.caption };
      n += await guardarComentario(env, c, { ...base, commentId: cm.id, autor: cm.username || (cm.from && cm.from.username) || '', autorId: String((cm.from && cm.from.id) || ''), texto: cm.text || '', cuando: fechaDeIso(cm.timestamp) }, { frescoDesde });
      for (const rp of (cm.replies && cm.replies.data) || []) {
        n += await guardarComentario(env, c, { ...base, commentId: rp.id, parentId: cm.id, autor: rp.username || (rp.from && rp.from.username) || '', autorId: String((rp.from && rp.from.id) || ''), texto: rp.text || '', cuando: fechaDeIso(rp.timestamp) }, { frescoDesde });
      }
    }
  }
  return n;
}

async function sondearComentariosFB(env, c, frescoDesde) {
  const posts = await graph(`${GRAPH_FB}/${c.fb_page_id}/posts?fields=id,permalink_url,message,created_time,comments.limit(50){id,message,from,created_time,parent}&limit=10`, { token: c.fb_access_token });
  let n = 0;
  for (const p of posts.data || []) {
    for (const cm of (p.comments && p.comments.data) || []) {
      n += await guardarComentario(env, c, {
        canal: 'facebook', commentId: cm.id, mediaId: p.id, permalink: p.permalink_url, caption: p.message,
        parentId: cm.parent && cm.parent.id && cm.parent.id !== p.id ? cm.parent.id : null,
        autor: (cm.from && cm.from.name) || '', autorId: String((cm.from && cm.from.id) || ''),
        texto: cm.message || '', cuando: fechaDeIso(cm.created_time),
      }, { frescoDesde });
    }
  }
  return n;
}

// Conversaciones de Instagram (IG Login) o Messenger (página) desde la Graph
// API. Solo se recorren las actualizadas después del sondeo anterior.
async function sondearConversaciones(env, c, canal, desde, primera) {
  const esIG = canal === 'instagram';
  const base = esIG ? `${GRAPH_IG}/${c.ig_user_id}` : `${GRAPH_FB}/${c.fb_page_id}`;
  const token = esIG ? c.ig_access_token : c.fb_access_token;
  const propios = idsPropios(c, canal);
  const yoUser = String((esIG ? c.ig_username : '') || '').toLowerCase();
  const r = await graph(`${base}/conversations?platform=${esIG ? 'instagram' : 'messenger'}&fields=id,updated_time,participants,messages.limit(15){id,from,to,message,created_time,attachments}&limit=12`, { token });
  let n = 0;
  for (const conv of r.data || []) {
    const actualizada = fechaDeIso(conv.updated_time);
    if (desde && actualizada <= desde) continue;
    const parts = (conv.participants && conv.participants.data) || [];
    // La propia cuenta se reconoce por id O por username (en Instagram el id de
    // los participantes es el 17841…, no el que guardamos).
    const esYo = (p) => propios.has(String(p.id)) || (yoUser && String(p.username || '').toLowerCase() === yoUser);
    for (const p of parts) if (esYo(p)) propios.add(String(p.id));
    const otro = parts.find((p) => !esYo(p));
    if (!otro) continue;
    const cv = await convDe(env, c, canal, String(otro.id), { nombre: otro.name || null, username: otro.username || null });
    let entrantes = 0;
    let ultimoTexto = '';
    const msgs = ((conv.messages && conv.messages.data) || []).slice().reverse(); // Meta los manda del más nuevo al más viejo
    for (const m of msgs) {
      const mio = propios.has(String((m.from && m.from.id) || ''));
      const a = m.attachments && m.attachments.data && m.attachments.data[0];
      const adj = a ? { tipo: a.video_data ? 'video' : a.image_data ? 'image' : a.file_url ? 'file' : 'share', url: (a.video_data && a.video_data.url) || (a.image_data && a.image_data.url) || a.file_url || null } : null;
      const creado = fechaDeIso(m.created_time);
      // En el primer sondeo lo viejo entra leído: es historial, no pendientes.
      const viejo = primera && creado < fechaDeMs(Date.now() - 48 * 3600e3);
      const ok = await insertarMensaje(env, { convId: cv.id, mid: m.id, direccion: mio ? 'out' : 'in', texto: m.message || '', adjunto: adj, autorNombre: mio ? 'Meta' : null, estado: mio ? 'enviado' : null, creado });
      if (ok) { n++; if (!mio && !viejo) { entrantes++; ultimoTexto = m.message || textoDeAdjunto(adj); } }
    }
    if (n) await refrescarConv(env, cv.id, entrantes);
    const asignacion = entrantes ? await asignarSiToca(env, c, cv.id) : { agente: null, nuevo: false };
    if (entrantes && (!cv.noLeidosAntes || asignacion.nuevo)) {
      await avisarEntrada(env, c, cv.id, {
        body: `${cv.nombre || (cv.username ? '@' + cv.username : 'Alguien')} te escribió por ${nombreCanal(canal)}: "${String(ultimoTexto).slice(0, 90)}"`,
        link: `#/bandeja?cliente=${c.id}&conv=${cv.id}`,
        asignacion,
      });
    }
  }
  return n;
}

// Sondea las marcas más "olvidadas" primero (máximo `max` por corrida para
// que el cron del publicador no se alargue). Devuelve qué pasó con cada una.
export async function sondearBandeja(env, { clientId = null, max = 4 } = {}) {
  let ids;
  if (clientId) ids = [clientId];
  else {
    const r = await env.DB.prepare(
      "SELECT id FROM mkt_clients WHERE archived = 0 AND (ig_access_token IS NOT NULL OR fb_access_token IS NOT NULL) ORDER BY COALESCE(bandeja_sondeo_at, '') ASC LIMIT ?"
    ).bind(max).all();
    ids = (r.results || []).map((x) => x.id);
  }
  const out = [];
  for (const id of ids) {
    const c = await marca(env, id);
    if (!c) continue;
    const primera = !c.bandeja_sondeo_at;
    const frescoDesde = primera ? fechaDeMs(Date.now() - 48 * 3600e3) : null;
    const desde = primera ? null : c.bandeja_sondeo_at;
    const estado = {};
    const n = { comentarios: 0, mensajes: 0 };
    // Un canal que venía FALLANDO (permiso faltante, cuenta reconectada) nunca
    // trajo su historial: esta vez se recorre completo, como un primer sondeo
    // (lo viejo entra leído y sin aviso). Si no, "solo lo nuevo desde el último
    // sondeo" dejaba fuera para siempre todo lo anterior al arreglo.
    let prev = {};
    try { prev = c.bandeja_estado ? JSON.parse(c.bandeja_estado) : {}; } catch { prev = {}; }
    const rango = (clave) => (primera || prev[clave] !== 'ok' ? [null, true] : [desde, false]);
    if (c.ig_user_id && c.ig_access_token) {
      // El id de webhooks (17841…) se guarda una vez por marca (migración 039).
      if (!c.ig_igsid) {
        try {
          const me = await graph(`${GRAPH_IG}/me?fields=user_id`, { token: c.ig_access_token });
          if (me && me.user_id) {
            c.ig_igsid = String(me.user_id);
            await env.DB.prepare('UPDATE mkt_clients SET ig_igsid = ? WHERE id = ?').bind(c.ig_igsid, c.id).run();
          }
        } catch { /* se reintenta en el siguiente sondeo */ }
      }
      try { n.comentarios += await sondearComentariosIG(env, c, frescoDesde); estado.ig_comentarios = 'ok'; } catch (e) { estado.ig_comentarios = resumirError(e); }
      try { const [d, p] = rango('ig_mensajes'); n.mensajes += await sondearConversaciones(env, c, 'instagram', d, p); estado.ig_mensajes = 'ok'; } catch (e) { estado.ig_mensajes = resumirError(e); }
    }
    if (c.fb_page_id && c.fb_access_token) {
      try { n.comentarios += await sondearComentariosFB(env, c, frescoDesde); estado.fb_comentarios = 'ok'; } catch (e) { estado.fb_comentarios = resumirError(e); }
      try { const [d, p] = rango('fb_mensajes'); n.mensajes += await sondearConversaciones(env, c, 'messenger', d, p); estado.fb_mensajes = 'ok'; } catch (e) { estado.fb_mensajes = resumirError(e); }
    }
    await env.DB.prepare("UPDATE mkt_clients SET bandeja_sondeo_at = datetime('now'), bandeja_estado = ? WHERE id = ?")
      .bind(JSON.stringify({ ...estado, en: new Date().toISOString() }), c.id).run();
    out.push({ marca: c.name, ...n, estado });
  }
  return out;
}

// ── SUSCRIPCIÓN A WEBHOOKS por marca ─────────────────────────────────────────
// Meta solo manda eventos de una cuenta/página si la app está suscrita a ella.
// Se llama al conectar (best-effort) y desde el botón de ajustes.
export async function suscribirWebhooks(env, c) {
  const r = {};
  if (c.ig_user_id && c.ig_access_token) {
    try { await graph(`${GRAPH_IG}/me/subscribed_apps?subscribed_fields=comments,messages`, { method: 'POST', token: c.ig_access_token }); r.instagram = 'ok'; }
    catch (e) { r.instagram = resumirError(e); }
  }
  if (c.fb_page_id && c.fb_access_token) {
    try { await graph(`${GRAPH_FB}/${c.fb_page_id}/subscribed_apps`, { method: 'POST', token: c.fb_access_token, form: { subscribed_fields: 'feed,messages,messaging_postbacks,message_echoes' } }); r.facebook = 'ok'; }
    catch (e) { r.facebook = resumirError(e); }
  }
  if (c.wa_waba_id && c.wa_access_token) {
    try { await graph(`${GRAPH_FB}/${c.wa_waba_id}/subscribed_apps`, { method: 'POST', token: c.wa_access_token }); r.whatsapp = 'ok'; }
    catch (e) { r.whatsapp = resumirError(e); }
  }
  try {
    const prev = c.bandeja_estado ? JSON.parse(c.bandeja_estado) : {};
    await env.DB.prepare('UPDATE mkt_clients SET bandeja_estado = ? WHERE id = ?')
      .bind(JSON.stringify({ ...prev, webhook: r, webhook_en: new Date().toISOString() }), c.id).run();
  } catch { /* opcional */ }
  return r;
}
// Atajos para los callbacks de conexión (no lanzan jamás).
export async function suscribirTrasConectar(env, clientId) {
  try { const c = await marca(env, clientId); if (c) return await suscribirWebhooks(env, c); } catch { /* best-effort */ }
  return null;
}

// ── PLANTILLA ABIERTA (WhatsApp fuera de la ventana de 24 h) ─────────────────
// Israel (7-oct-2026): "no nos sirve enviar plantillas porque perdemos
// clientes". Meta no deja mandar texto libre por API pasadas 24 h del último
// mensaje del paciente, pero SÍ deja una plantilla aprobada cuyo cuerpo es
// casi todo un espacio libre: saludo y cierre fijos, y en medio lo que el
// agente escriba. El paciente recibe un mensaje normal. Reglas de Meta: la
// plantilla no empieza ni termina en variable, la variable va en un solo
// párrafo (sin saltos de línea ni 4+ espacios) y el cuerpo mide hasta 1024.
// Categoría UTILITY: seguimiento de algo que la persona ya pidió (cita,
// cotización, valoración). Cuesta ~USD 0.0085 en México y Meta no la limita
// por persona como a las de marketing.
const PLANTILLAS = {
  seguimiento: {
    base: 'seguimiento_abierto',
    titulo: 'Seguimiento',
    cuerpo: (marcaTxt) => `Hola {{1}}, te escribe {{2}} de ${marcaTxt}. {{3}} Si tienes alguna duda, responde a este mensaje y con gusto te ayudamos.`,
    ejemplo: ['Ana', 'Laura', 'Te confirmo que tu valoración quedó el jueves 9 a las 5 de la tarde en la clínica.'],
    botones: [],
  },
  confirmacion: {
    base: 'confirmacion_abierta',
    titulo: 'Confirmación con botones',
    cuerpo: (marcaTxt) => `Hola {{1}}, te escribe {{2}} de ${marcaTxt}. {{3}} ¿Nos confirmas, por favor?`,
    ejemplo: ['Ana', 'Laura', 'Tu cita de valoración quedó el jueves 9 a las 5 de la tarde.'],
    botones: ['Sí, confirmo', 'Cambiar fecha'],
  },
};
const IDIOMA_PLANTILLA = 'es_MX';
const MAX_CUERPO = 1024;
function slugPlantilla(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'marca';
}
function nombreComercial(c) {
  return String(cfgDe(c).nombre_comercial || c.name || '').trim();
}
// El nombre de la plantilla lleva la marca: varias marcas pueden compartir una
// cuenta de WhatsApp (WABA) y cada una necesita su propio texto fijo.
function defPlantilla(c, clave) {
  const p = PLANTILLAS[clave];
  if (!p) return null;
  const marcaTxt = nombreComercial(c);
  return { clave, nombre: `${p.base}_${slugPlantilla(marcaTxt)}`, cuerpo: p.cuerpo(marcaTxt), botones: p.botones, ejemplo: p.ejemplo, titulo: p.titulo };
}
const errSinCanal = (msg) => Object.assign(new Error(msg), { code: 'SIN_CANAL' });

// Lee de Meta el estado real de las plantillas de la marca y lo guarda.
async function refrescarPlantillas(env, c) {
  const cfg = cfgDe(c);
  if (!c.wa_waba_id || !c.wa_access_token) return cfg.plantillas;
  let lista;
  try {
    const r = await graph(`${GRAPH_FB}/${c.wa_waba_id}/message_templates?fields=name,status,category,language,rejected_reason,quality_score,components&limit=200`, { token: c.wa_access_token });
    lista = r.data || [];
  } catch { return cfg.plantillas; }
  for (const clave of Object.keys(PLANTILLAS)) {
    const d = defPlantilla(c, clave);
    const t = lista.find((x) => x.name === d.nombre && x.language === IDIOMA_PLANTILLA);
    if (t) {
      const body = (t.components || []).find((k) => k.type === 'BODY');
      cfg.plantillas[clave] = {
        ...(cfg.plantillas[clave] || {}), nombre: d.nombre, id: t.id, estado: t.status, categoria: t.category,
        motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
        calidad: (t.quality_score && t.quality_score.score) || null,
        cuerpo: body ? body.text : d.cuerpo, botones: d.botones,
      };
    } else if (cfg.plantillas[clave] && cfg.plantillas[clave].nombre !== d.nombre) {
      delete cfg.plantillas[clave]; // la marca cambió de nombre: esa plantilla ya no le corresponde
    }
  }
  await guardarCfg(env, c.id, cfg);
  return cfg.plantillas;
}

// Da de alta en Meta las plantillas abiertas de la marca (las que falten).
async function crearPlantillas(env, c) {
  if (!c.wa_waba_id || !c.wa_access_token) throw errSinCanal('Conecta el WhatsApp de la marca con el ID de su cuenta (WABA) para crear las plantillas.');
  const cfg = cfgDe(c);
  const resultado = {};
  for (const clave of Object.keys(PLANTILLAS)) {
    const d = defPlantilla(c, clave);
    const ya = cfg.plantillas[clave];
    if (ya && ya.nombre === d.nombre && ['APPROVED', 'PENDING', 'IN_APPEAL'].includes(ya.estado)) { resultado[clave] = ya.estado; continue; }
    const components = [{ type: 'BODY', text: d.cuerpo, example: { body_text: [d.ejemplo] } }];
    if (d.botones.length) components.push({ type: 'BUTTONS', buttons: d.botones.map((t) => ({ type: 'QUICK_REPLY', text: t })) });
    try {
      const r = await graph(`${GRAPH_FB}/${c.wa_waba_id}/message_templates`, {
        method: 'POST', token: c.wa_access_token,
        body: { name: d.nombre, language: IDIOMA_PLANTILLA, category: 'UTILITY', components },
      });
      cfg.plantillas[clave] = { nombre: d.nombre, id: r.id || null, estado: r.status || 'PENDING', categoria: r.category || 'UTILITY', cuerpo: d.cuerpo, botones: d.botones };
      resultado[clave] = cfg.plantillas[clave].estado;
    } catch (e) {
      // Ya existía con ese nombre (se creó antes): el refresco trae su estado.
      const existe = /already exists|exists in|duplicate|ya existe/i.test(String(e.message)) || String(e.subcode) === '2388024';
      cfg.plantillas[clave] = { nombre: d.nombre, estado: existe ? 'EXISTE' : 'ERROR', error: existe ? null : String(e.message).slice(0, 200), cuerpo: d.cuerpo, botones: d.botones };
      resultado[clave] = existe ? 'EXISTE' : 'ERROR: ' + String(e.message).slice(0, 160);
    }
  }
  await guardarCfg(env, c.id, cfg);
  const plantillas = await refrescarPlantillas(env, { ...c, bandeja_cfg: JSON.stringify(cfg) });
  return { resultado, plantillas };
}

function primerNombre(s) {
  const t = String(s || '').replace(/[^\p{L}\p{M}' -]/gu, ' ').trim().split(/\s+/)[0] || '';
  return t.length >= 2 ? t.slice(0, 30) : '';
}
function limpiarParaPlantilla(t) {
  return String(t || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
function renderPlantilla(cuerpo, params) {
  return String(cuerpo).replace(/\{\{(\d+)\}\}/g, (_, i) => (params[Number(i) - 1] != null ? params[Number(i) - 1] : ''));
}
// Cuánto texto libre cabe en la plantilla para este paciente y este agente.
function espacioPlantilla(c, conv, autorNombre, clave) {
  const d = defPlantilla(c, clave);
  const p = cfgDe(c).plantillas[clave];
  const cuerpo = (p && p.nombre === d.nombre && p.cuerpo) || d.cuerpo;
  const p1 = primerNombre(conv.nombre) || 'de nuevo';
  const p2 = primerNombre(autorNombre) || nombreComercial(c);
  return { cuerpo, p1, p2, max: MAX_CUERPO - renderPlantilla(cuerpo, [p1, p2, '']).length - 2 };
}

async function enviarPlantillaAbierta(c, conv, texto, { clave = 'seguimiento', autorNombre = '' } = {}) {
  if (!c.wa_phone_id || !c.wa_access_token) throw errSinCanal('Esta marca no tiene WhatsApp conectado.');
  const d = defPlantilla(c, clave);
  if (!d) throw errSinCanal('Esa plantilla no existe.');
  const p = cfgDe(c).plantillas[clave];
  if (!p || p.nombre !== d.nombre) throw errSinCanal('Pasaron más de 24 h desde el último mensaje de la persona y esta marca todavía no tiene su plantilla abierta. Créala en Ajustes de la bandeja (WhatsApp → Plantillas).');
  const estado = String(p.estado || '');
  if (estado === 'PENDING' || estado === 'IN_APPEAL') throw errSinCanal('Meta todavía está revisando la plantilla abierta (suele tardar de minutos a unas horas). Intenta en un rato.');
  if (['REJECTED', 'DISABLED', 'PAUSED', 'ERROR'].includes(estado)) throw errSinCanal(`La plantilla abierta está ${({ REJECTED: 'rechazada', DISABLED: 'desactivada', PAUSED: 'pausada', ERROR: 'con error' })[estado]} en Meta${p.motivo ? ' (' + p.motivo + ')' : ''}. Revísala en Ajustes de la bandeja.`);
  const esp = espacioPlantilla(c, conv, autorNombre, clave);
  const p3 = limpiarParaPlantilla(texto);
  if (!p3) throw errSinCanal('Escribe el mensaje.');
  if (Array.from(p3).length > esp.max) throw errSinCanal(`Dentro de la plantilla caben ${esp.max} caracteres y tu mensaje tiene ${Array.from(p3).length}. Acórtalo un poco.`);
  const r = await graph(`${GRAPH_FB}/${c.wa_phone_id}/messages`, { method: 'POST', token: c.wa_access_token, body: {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: conv.contacto_id, type: 'template',
    template: { name: p.nombre, language: { code: IDIOMA_PLANTILLA }, components: [{ type: 'body', parameters: [esp.p1, esp.p2, p3].map((t) => ({ type: 'text', text: t })) }] },
  } });
  const visto = renderPlantilla(esp.cuerpo, [esp.p1, esp.p2, p3]) + (d.botones.length ? '\n' + d.botones.map((b) => `[ ${b} ]`).join('  ') : '');
  return { mid: (r.messages && r.messages[0] && r.messages[0].id) || null, texto: visto, via: 'plantilla:' + clave };
}

// ── SALIDA: mensajes ─────────────────────────────────────────────────────────
// Fuera de la ventana de 24 h Meta rechaza el envío normal; se reintenta con
// la etiqueta HUMAN_AGENT (vale 7 días; necesita la función aprobada en la
// app). Si tampoco, el error llega explicado a la pantalla.
async function enviarMetaConVentana(url, token, to, texto) {
  try {
    return await graph(url, { method: 'POST', token, body: { recipient: { id: to }, messaging_type: 'RESPONSE', message: { text: texto } } });
  } catch (e) {
    const fuera = String(e.subcode) === '2534022' || /outside.*window|allowed window|24 ?hours/i.test(String(e.message));
    if (!fuera) throw e;
    return graph(url, { method: 'POST', token, body: { recipient: { id: to }, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT', message: { text: texto } } });
  }
}

// Manda un texto por el canal de la conversación. Devuelve los mids.
async function enviarTexto(c, conv, texto, env, opts = {}) {
  const lim = LIM_TEXTO[conv.canal] || 1900;
  const mids = [];
  for (const pieza of partirTexto(texto, lim)) {
    if (conv.canal === 'correo') {
      if (!env || !env.RESEND_API_KEY) throw Object.assign(new Error('El envío de correos no está configurado (falta RESEND_API_KEY).'), { code: 'SIN_CANAL' });
      // El asunto sale del último correo de la persona ("Asunto: …" en la 1a línea).
      const ult = await env.DB.prepare("SELECT texto, creado FROM mkt_mensajes WHERE conv_id = ? AND direccion = 'in' ORDER BY creado DESC, rowid DESC LIMIT 1").bind(conv.id).first();
      const cita = citaCorreo(ult, conv);
      const m = String((ult && ult.texto) || '').match(/^Asunto:[ \t]*([^\n]+)/m);
      // Sin correo previo de la persona es un correo NUEVO: su asunto propio, sin "Re:".
      const asunto = m
        ? (/^re:/i.test(m[1].trim()) ? m[1].trim() : 'Re: ' + m[1].trim())
        : (String(opts.asunto || '').trim() || 'IVAE Studios');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `IVAE Studios <${CORREO_BUZON}>`, to: [conv.contacto_id], bcc: [CORREO_BUZON], reply_to: CORREO_BUZON,
          subject: asunto.slice(0, 200), text: `${pieza}\n\n--\n${FIRMA_TXT}${cita.txt}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1f">${escHtml(pieza).replace(/\n/g, '<br>')}</div>`
            + `<div style="margin-top:22px">${FIRMA_HTML}</div>${cita.html}`,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error('No se pudo enviar el correo: ' + String((j && (j.message || j.error)) || res.status).slice(0, 200)), { code: 'SIN_CANAL' });
      mids.push(j.id ? 'resend:' + j.id : null);
      continue;
    }
    if (conv.canal === 'whatsapp') {
      if (!c.wa_phone_id || !c.wa_access_token) throw Object.assign(new Error('Esta marca no tiene WhatsApp conectado.'), { code: 'SIN_CANAL' });
      const r = await graph(`${GRAPH_FB}/${c.wa_phone_id}/messages`, { method: 'POST', token: c.wa_access_token, body: {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: conv.contacto_id, type: 'text', text: { preview_url: false, body: pieza },
      } });
      mids.push((r.messages && r.messages[0] && r.messages[0].id) || null);
    } else if (conv.canal === 'instagram') {
      if (!c.ig_user_id || !c.ig_access_token) throw Object.assign(new Error('Esta marca no tiene Instagram conectado.'), { code: 'SIN_CANAL' });
      const r = await enviarMetaConVentana(`${GRAPH_IG}/${c.ig_user_id}/messages`, c.ig_access_token, conv.contacto_id, pieza);
      mids.push(r.message_id || null);
    } else {
      if (!c.fb_page_id || !c.fb_access_token) throw Object.assign(new Error('Esta marca no tiene la página de Facebook conectada.'), { code: 'SIN_CANAL' });
      const r = await enviarMetaConVentana(`${GRAPH_FB}/me/messages`, c.fb_access_token, conv.contacto_id, pieza);
      mids.push(r.message_id || null);
    }
  }
  return mids;
}

// ── SALIDA: comentarios ──────────────────────────────────────────────────────
async function responderComentario(c, cm, texto, modo) {
  const out = {};
  const esIG = cm.canal === 'instagram';
  if (esIG && (!c.ig_user_id || !c.ig_access_token)) throw Object.assign(new Error('Esta marca no tiene Instagram conectado.'), { code: 'SIN_CANAL' });
  if (!esIG && (!c.fb_page_id || !c.fb_access_token)) throw Object.assign(new Error('Esta marca no tiene la página de Facebook conectada.'), { code: 'SIN_CANAL' });
  if (modo === 'publico' || modo === 'ambos') {
    out.publico = esIG
      ? await graph(`${GRAPH_IG}/${cm.comment_id}/replies`, { method: 'POST', token: c.ig_access_token, body: { message: texto.slice(0, 950) } })
      : await graph(`${GRAPH_FB}/${cm.comment_id}/comments`, { method: 'POST', token: c.fb_access_token, body: { message: texto.slice(0, 1900) } });
  }
  if (modo === 'dm' || modo === 'ambos') {
    // Private reply: UNA por comentario, dentro de 7 días. Abre la conversación.
    out.dm = esIG
      ? await graph(`${GRAPH_IG}/${c.ig_user_id}/messages`, { method: 'POST', token: c.ig_access_token, body: { recipient: { comment_id: cm.comment_id }, message: { text: texto.slice(0, 950) } } })
      : await graph(`${GRAPH_FB}/me/messages`, { method: 'POST', token: c.fb_access_token, body: { recipient: { comment_id: cm.comment_id }, message: { text: texto.slice(0, 950) } } });
  }
  return out;
}
async function ocultarComentario(c, cm, oculto) {
  if (cm.canal === 'instagram') return graph(`${GRAPH_IG}/${cm.comment_id}`, { method: 'POST', token: c.ig_access_token, body: { hide: !!oculto } });
  return graph(`${GRAPH_FB}/${cm.comment_id}`, { method: 'POST', token: c.fb_access_token, body: { is_hidden: !!oculto } });
}

// ── SUGERENCIA DE RESPUESTA (Claude) ─────────────────────────────────────────
// La IA solo PROPONE; publica la persona. Usa la ficha de la marca (brief y
// notas) como única fuente: nada de precios o promesas inventadas.
async function sugerirRespuesta(env, c, { tipo, canal, texto, autor, historial }) {
  if (!env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('Falta la llave de Claude (ANTHROPIC_API_KEY) en este proyecto.'), { code: 'SIN_LLAVE' });
  }
  const voz = [c.brief, c.notes].filter(Boolean).join('\n').slice(0, 2500);
  const system = [
    `Eres el community manager de ${c.name}, una marca cliente de una agencia de marketing.`,
    voz ? `Ficha de la marca (tu única fuente de datos; no inventes nada que no esté aquí):\n${voz}` : 'No tienes ficha de la marca: no des datos concretos (precios, horarios, direcciones); ofrece confirmarlos.',
    tipo === 'comentario'
      ? `Redacta UNA respuesta breve (máximo 220 caracteres) a un comentario público en ${nombreCanal(canal)}.`
      : `Redacta la siguiente respuesta (máximo 500 caracteres) en una conversación privada por ${nombreCanal(canal)}.`,
    'Reglas: responde en el idioma de la persona; tono cálido, cercano y profesional; en español trato de usted salvo que la persona tutee; sin guiones largos (usa comas); corazones solo si la persona los usa;',
    tipo === 'comentario'
      ? 'NUNCA des precios en público: si preguntan precio, agradece e invita a que escriba por mensaje directo;'
      : 'no inventes precios, disponibilidad ni citas: si no están en la ficha, di que se le confirman enseguida;',
    'nunca digas que eres una IA ni un asistente; sin hashtags; sin firmar. Devuelve SOLO el texto de la respuesta, sin comillas ni explicación.',
  ].join('\n');
  const user = tipo === 'comentario'
    ? `Comentario de ${autor || 'alguien'}: "${String(texto || '').slice(0, 1500)}"`
    : `Conversación (los últimos mensajes; "Persona" es quien escribe y "Marca" somos nosotros):\n${historial}\n\nEscribe la respuesta de la Marca al último mensaje de la Persona.`;
  let res, data;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELO_SUGERENCIA, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(30000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    throw new Error('No se pudo hablar con Claude: ' + (e && e.message));
  }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(/credit|billing/i.test(msg) ? 'La cuenta de Claude se quedó sin saldo.' : `Claude rechazó la petición: ${msg}`);
  }
  const txt = ((data.content || []).find((b) => b.type === 'text') || {}).text || '';
  return txt.trim().replace(/^["“”']+|["“”']+$/g, '').replace(/\s[—–]\s/g, ', ').trim();
}

// ── API DEL PANEL (staff) ────────────────────────────────────────────────────
// OJO: nunca contestar 502 desde aquí: Cloudflare reemplaza los 5xx del origen
// por su página 'error code: 502' y el JSON con la explicación se pierde. Los
// fallos de Meta o de Claude van como 422 con {error}.
// La marca de cada conversación/comentario tiene que ser del workspace de la
// sesión: se comprueba en cada consulta por id, no solo por ?client_id.
async function convDeMiWs(env, ws, convId) {
  return env.DB.prepare(
    `SELECT v.*, c.name AS marca_nombre FROM mkt_conversaciones v JOIN mkt_clients c ON c.id = v.client_id
      WHERE v.id = ? AND COALESCE(c.workspace_id, 'ivae') = ?`
  ).bind(convId, ws).first();
}
async function comentarioDeMiWs(env, ws, id) {
  return env.DB.prepare(
    `SELECT k.* FROM mkt_comentarios k JOIN mkt_clients c ON c.id = k.client_id
      WHERE k.id = ? AND COALESCE(c.workspace_id, 'ivae') = ?`
  ).bind(id, ws).first();
}
async function marcaDeMiWs(env, ws, clientId) {
  const c = await marca(env, clientId);
  return c && c.workspace_id === ws ? c : null;
}
async function leerJson(request) {
  try { return (await request.json()) || {}; } catch { return {}; }
}
function fechaHoy() { return new Date().toISOString().slice(0, 10); }

// "Por seguir": el seguimiento agendado ya llegó, o la persona lleva N días
// sin contestar el último mensaje de la marca (y no es cliente ni perdido).
function sqlPorSeguir(p = '') {
  return `((${p}seguimiento IS NOT NULL AND ${p}seguimiento <= ?) OR (${p}etapa NOT IN ('cliente', 'perdido') AND ${p}ultimo_en IS NOT NULL AND ${p}ultimo_en <= datetime('now', ?) AND (${p}ultimo_cliente_en IS NULL OR ${p}ultimo_cliente_en < ${p}ultimo_en)))`;
}
const RESULTADOS_LLAMADA = ['contesto', 'no_contesto', 'buzon', 'cita', 'numero_mal'];
const RESULTADO_TXT = { contesto: 'contestó', no_contesto: 'no contestó', buzon: 'buzón de voz', cita: 'agendó cita', numero_mal: 'número equivocado' };

export async function handleBandeja(request, env, session, url, parts) {
  const method = request.method;
  const ws = (session && session.workspace_id) || 'ivae';
  const esAdmin = session.role === 'admin';
  // Equipo de la marca (migración 040): un acceso de CLIENTE con bandeja_rol.
  // El agente solo ve sus chats y los que nadie tiene; el supervisor (y el
  // staff de la agencia) ve todo y el desempeño del equipo.
  const esCliente = session.role === 'client';
  const esAgente = esCliente && session.bandeja_rol === 'agente';
  const esSupervisor = !esCliente || session.bandeja_rol === 'supervisor';
  const yo = session.user_id;
  const sub = parts.slice(1); // parts[0] === 'bandeja'
  const qp = (k) => url.searchParams.get(k) || '';
  const marcaOk = async (clientId) => {
    if (!clientId || (esCliente && clientId !== session.client_id)) return null;
    return marcaDeMiWs(env, ws, clientId);
  };
  const convOk = async (convId) => {
    const v = await convDeMiWs(env, ws, convId);
    if (!v) return null;
    if (esCliente && v.client_id !== session.client_id) return null;
    if (esAgente && v.asignado_a && v.asignado_a !== yo) return null;
    return v;
  };
  const prohibido = () => json({ error: 'No tienes permiso para esto.' }, 403);

  // ── Resumen por marca: contadores, canales, equipo y plantillas ──
  if (sub[0] === 'resumen' && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const cfg = cfgDe(c);
    const diasSeg = Math.max(1, Number(cfg.dias_seguimiento) || 3);
    const filtroAg = esAgente ? ' AND (asignado_a = ? OR asignado_a IS NULL)' : '';
    const bAg = esAgente ? [yo] : [];
    const [convs, coms, seg, sinAsignar, porSeguir, equipo] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(no_leidos), 0) AS no_leidos FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0${filtroAg}`).bind(c.id, ...bAg).first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_comentarios WHERE client_id = ? AND atendido = 0').bind(c.id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_conversaciones WHERE client_id = ? AND seguimiento IS NOT NULL AND seguimiento <= ?${filtroAg}`).bind(c.id, fechaHoy(), ...bAg).first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0 AND asignado_a IS NULL AND ultimo_cliente_en IS NOT NULL').bind(c.id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0 AND ${sqlPorSeguir()}${esAgente ? ' AND asignado_a = ?' : ''}`).bind(c.id, fechaHoy(), `-${diasSeg} days`, ...(esAgente ? [yo] : [])).first(),
      equipoDeMarca(env, c.id),
    ]);
    let estado = null;
    try { estado = c.bandeja_estado ? JSON.parse(c.bandeja_estado) : null; } catch { estado = null; }
    let ultimoWebhook = null;
    if (esAdmin) {
      try { const r = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_ULTIMO_WEBHOOK).first(); ultimoWebhook = r ? JSON.parse(r.value) : null; } catch { ultimoWebhook = null; }
    }
    const plantillas = {};
    for (const k of Object.keys(PLANTILLAS)) {
      const d = defPlantilla(c, k);
      const p = cfg.plantillas[k];
      const vigente = p && p.nombre === d.nombre;
      plantillas[k] = { titulo: d.titulo, estado: vigente ? p.estado || null : null, motivo: vigente ? p.motivo || null : null, cuerpo: (vigente && p.cuerpo) || d.cuerpo, botones: d.botones };
    }
    return json({
      marca: { id: c.id, name: c.name },
      conversaciones: Number(convs.n) || 0,
      no_leidos: Number(convs.no_leidos) || 0,
      comentarios_pendientes: Number(coms.n) || 0,
      seguimientos_hoy: Number(seg.n) || 0,
      sin_asignar: Number(sinAsignar.n) || 0,
      por_seguir: Number(porSeguir.n) || 0,
      canales: {
        instagram: { conectado: !!(c.ig_user_id && c.ig_access_token), cuenta: c.ig_username ? '@' + c.ig_username : null },
        messenger: { conectado: !!(c.fb_page_id && c.fb_access_token), cuenta: c.fb_page_name || null },
        whatsapp: { conectado: !!(c.wa_phone_id && c.wa_access_token), cuenta: c.wa_numero || null },
        correo: { conectado: await correoDeLaMarca(env, c.id), cuenta: CORREO_BUZON },
      },
      sondeo_at: c.bandeja_sondeo_at || null,
      estado: esCliente ? null : estado,
      ultimo_webhook: ultimoWebhook,
      etapas: ETAPAS,
      yo: { id: yo, nombre: session.name, rol: esCliente ? session.bandeja_rol : (esAdmin ? 'admin' : 'equipo'), disponible: session.bandeja_disponible !== 0, supervisor: esSupervisor },
      equipo: equipo.filter((u) => u.bandeja_rol === 'agente').map((u) => ({ id: u.id, nombre: u.name, disponible: !!u.disponible })),
      cfg: { reparto: cfg.reparto !== false, reasignar_min: Number(cfg.reasignar_min) || 0, dias_seguimiento: diasSeg, nombre_comercial: nombreComercial(c), avisar_agencia: !!cfg.avisar_agencia },
      plantillas,
    });
  }

  // ── Conversaciones ──
  if (sub[0] === 'conversaciones' && sub.length === 1 && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const cfg = cfgDe(c);
    const where = ['v.client_id = ?'];
    const binds = [c.id];
    const canal = qp('canal');
    if (CANALES_MSG.includes(canal)) { where.push('v.canal = ?'); binds.push(canal); }
    const etapa = qp('etapa');
    if (ETAPAS.includes(etapa)) { where.push('v.etapa = ?'); binds.push(etapa); }
    if (qp('archivadas') === '1') where.push('v.archivado = 1'); else where.push('v.archivado = 0');
    if (qp('sin_leer') === '1') where.push('v.no_leidos > 0');
    if (esAgente) { where.push('(v.asignado_a = ? OR v.asignado_a IS NULL)'); binds.push(yo); }
    const asig = qp('asignado');
    if (asig === 'yo') { where.push('v.asignado_a = ?'); binds.push(yo); }
    else if (asig === 'sin') where.push('v.asignado_a IS NULL');
    else if (asig && esSupervisor) { where.push('v.asignado_a = ?'); binds.push(asig); }
    if (qp('por_seguir') === '1') { where.push(sqlPorSeguir('v.')); binds.push(fechaHoy(), `-${Math.max(1, Number(cfg.dias_seguimiento) || 3)} days`); }
    if (qp('sin_responder') === '1') where.push('v.ultimo_cliente_en IS NOT NULL AND v.ultimo_cliente_en = v.ultimo_en');
    const q = qp('q').trim();
    if (q) { where.push('(v.nombre LIKE ? OR v.username LIKE ? OR v.contacto_id LIKE ? OR v.ultimo_texto LIKE ?)'); const like = `%${q}%`; binds.push(like, like, like, like); }
    const r = await env.DB.prepare(
      `SELECT v.id, v.canal, v.contacto_id, v.nombre, v.username, v.ultimo_texto, v.ultimo_en, v.ultimo_cliente_en, v.no_leidos, v.etapa, v.notas, v.seguimiento, v.archivado,
              v.asignado_a, v.asignado_en, u.name AS asignado_nombre, v.origen
         FROM mkt_conversaciones v LEFT JOIN mkt_users u ON u.id = v.asignado_a
        WHERE ${where.join(' AND ')} ORDER BY (v.no_leidos > 0) DESC, v.ultimo_en DESC LIMIT 200`
    ).bind(...binds).all();
    return json({ conversaciones: r.results || [] });
  }

  if (sub[0] === 'conversaciones' && sub.length >= 2) {
    const conv = await convOk(sub[1]);
    if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
    const accion = sub[2] || '';

    if (!accion && method === 'GET') {
      const [msgs, evs, asig] = await Promise.all([
        env.DB.prepare(
          'SELECT id, mid, direccion, texto, adjunto_tipo, adjunto_url, adjunto_id, autor_nombre, estado, error, creado, via, entregado_en, leido_en FROM mkt_mensajes WHERE conv_id = ? ORDER BY creado ASC, rowid ASC LIMIT 400'
        ).bind(conv.id).all(),
        env.DB.prepare(
          "SELECT tipo, user_nombre, dato, creado FROM mkt_bandeja_eventos WHERE conv_id = ? AND tipo IN ('llamada', 'asignacion', 'reasignacion', 'tomada') ORDER BY creado ASC LIMIT 200"
        ).bind(conv.id).all(),
        conv.asignado_a ? env.DB.prepare('SELECT name FROM mkt_users WHERE id = ?').bind(conv.asignado_a).first() : null,
      ]);
      if (conv.no_leidos) await env.DB.prepare('UPDATE mkt_conversaciones SET no_leidos = 0 WHERE id = ?').bind(conv.id).run();
      const { client_id, ...resto } = conv;
      return json({
        conversacion: { ...resto, client_id, no_leidos: 0, asignado_nombre: asig ? asig.name : null },
        mensajes: (msgs.results || []).map((m) => ({ ...m, adjunto_url: m.adjunto_url || m.adjunto_id ? `/api/marketing/bandeja/adjunto/${m.id}` : null })),
        eventos: (evs.results || []).map((e) => { let dato = null; try { dato = e.dato ? JSON.parse(e.dato) : null; } catch { dato = null; } return { ...e, dato }; }),
      });
    }

    if (!accion && method === 'PATCH') {
      const b = await leerJson(request);
      const sets = [];
      const binds = [];
      let etapaNueva = null;
      if (b.etapa !== undefined) {
        if (!ETAPAS.includes(b.etapa)) return json({ error: 'Etapa inválida' }, 400);
        sets.push('etapa = ?'); binds.push(b.etapa);
        if (b.etapa !== conv.etapa) etapaNueva = b.etapa;
      }
      if (b.notas !== undefined) { sets.push('notas = ?'); binds.push(String(b.notas || '').slice(0, 4000) || null); }
      if (b.seguimiento !== undefined) {
        if (b.seguimiento && !/^\d{4}-\d{2}-\d{2}$/.test(b.seguimiento)) return json({ error: 'La fecha de seguimiento debe ser AAAA-MM-DD' }, 400);
        sets.push('seguimiento = ?'); binds.push(b.seguimiento || null);
      }
      if (b.nombre !== undefined) { sets.push('nombre = ?'); binds.push(String(b.nombre || '').slice(0, 120) || null); }
      if (b.archivado !== undefined) { sets.push('archivado = ?'); binds.push(b.archivado ? 1 : 0); }
      if (b.leido === true) { sets.push('no_leidos = 0'); }
      if (!sets.length) return json({ error: 'Nada que actualizar' }, 400);
      sets.push("updated_at = datetime('now')");
      binds.push(conv.id);
      await env.DB.prepare(`UPDATE mkt_conversaciones SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
      if (etapaNueva) await registrarEvento(env, { clientId: conv.client_id, convId: conv.id, userId: yo, userNombre: session.name, tipo: 'etapa', dato: { de: conv.etapa, a: etapaNueva } });
      return json({ ok: true });
    }

    if (accion === 'enviar' && method === 'POST') {
      const b = await leerJson(request);
      const texto = String(b.texto || '').trim();
      if (!texto) return json({ error: 'Escribe el mensaje.' }, 400);
      if (texto.length > 4000) return json({ error: 'El mensaje es demasiado largo (máximo 4000 caracteres).' }, 400);
      const c = await marca(env, conv.client_id);
      // WhatsApp fuera de la ventana de 24 h (o si el agente lo pide): sale
      // dentro de la plantilla abierta. Margen de 6 min contra la carrera con Meta.
      const ventanaWa = conv.canal === 'whatsapp' && horasDesde(conv.ultimo_cliente_en) < 23.9;
      const clave = PLANTILLAS[b.plantilla] ? b.plantilla : null;
      const conPlantilla = conv.canal === 'whatsapp' && (!ventanaWa || !!clave);
      let filas;
      try {
        if (conPlantilla) {
          const r = await enviarPlantillaAbierta(c, conv, texto, { clave: clave || 'seguimiento', autorNombre: session.name });
          filas = [{ mid: r.mid, texto: r.texto, via: r.via }];
        } else {
          const mids = await enviarTexto(c, conv, texto, env, { asunto: b.asunto });
          filas = partirTexto(texto, LIM_TEXTO[conv.canal] || 1900).map((p, i) => ({ mid: mids[i] || null, texto: p, via: null }));
        }
      } catch (e) {
        const ex = e.code === 'SIN_CANAL' ? { msg: e.message } : explicarError(e, conv.canal);
        await insertarMensaje(env, { convId: conv.id, direccion: 'out', texto, autorUserId: yo, autorNombre: session.name, estado: 'error', error: ex.msg.slice(0, 300), via: conPlantilla ? 'plantilla:' + (clave || 'seguimiento') : null });
        return json({ error: ex.msg, ventana: !!ex.ventana, permiso: !!ex.permiso }, 422);
      }
      // Un renglón por pieza enviada, con su mid (así el eco de Meta no duplica).
      for (const f of filas) {
        await insertarMensaje(env, { convId: conv.id, mid: f.mid, direccion: 'out', texto: f.texto, autorUserId: yo, autorNombre: session.name, estado: 'enviado', via: f.via });
      }
      await refrescarConv(env, conv.id, 0);
      await env.DB.prepare("UPDATE mkt_conversaciones SET no_leidos = 0, etapa = CASE WHEN etapa = 'nuevo' THEN 'platica' ELSE etapa END WHERE id = ?").bind(conv.id).run();
      // El agente que contesta un chat sin dueño se lo queda.
      if (esAgente && !conv.asignado_a) await asignar(env, c, conv.id, { id: yo, name: session.name }, { tipo: 'tomada' });
      return json({ ok: true, mids: filas.map((f) => f.mid), plantilla: conPlantilla });
    }

    // Asignar a un agente (supervisor/staff) o tomar un chat sin dueño (agente).
    if (accion === 'asignar' && method === 'POST') {
      const b = await leerJson(request);
      const c = await marca(env, conv.client_id);
      const destino = b.user_id ? String(b.user_id) : null;
      if (esAgente) {
        if (destino !== yo || (conv.asignado_a && conv.asignado_a !== yo)) return prohibido();
        if (!conv.asignado_a) await asignar(env, c, conv.id, { id: yo, name: session.name }, { tipo: 'tomada' });
        return json({ ok: true, asignado_a: yo, asignado_nombre: session.name });
      }
      if (!esSupervisor) return prohibido();
      if (!destino) {
        await env.DB.prepare('UPDATE mkt_conversaciones SET asignado_a = NULL, asignado_en = NULL WHERE id = ?').bind(conv.id).run();
        return json({ ok: true, asignado_a: null });
      }
      const ag = (await equipoDeMarca(env, conv.client_id)).find((u) => u.id === destino && u.bandeja_rol === 'agente');
      if (!ag) return json({ error: 'Ese agente no pertenece al equipo de esta marca.' }, 400);
      await asignar(env, c, conv.id, ag, { tipo: conv.asignado_a ? 'reasignacion' : 'asignacion', dato: { por: session.name, de: conv.asignado_a || null } });
      if (ag.id !== yo) {
        await avisarUsuarios(env, c, [ag.id], {
          tipo: 'mensaje',
          body: `${session.name} te asignó el chat de ${conv.nombre || (conv.username ? '@' + conv.username : (conv.canal === 'whatsapp' ? '+' + conv.contacto_id : 'un contacto'))}.`,
          link: `#/bandeja?cliente=${c.id}&conv=${conv.id}`,
        });
      }
      return json({ ok: true, asignado_a: ag.id, asignado_nombre: ag.name });
    }

    // Registro de una llamada (el dashboard las cuenta por agente).
    if (accion === 'llamada' && method === 'POST') {
      const b = await leerJson(request);
      const resultado = String(b.resultado || '');
      if (!RESULTADOS_LLAMADA.includes(resultado)) return json({ error: 'Elige cómo salió la llamada.' }, 400);
      const minutos = Math.max(0, Math.min(600, Math.round(Number(b.minutos) || 0)));
      const nota = String(b.nota || '').trim().slice(0, 500) || null;
      await registrarEvento(env, { clientId: conv.client_id, convId: conv.id, userId: yo, userNombre: session.name, tipo: 'llamada', dato: { resultado, minutos, nota } });
      if (resultado === 'cita' && conv.etapa !== 'cita' && conv.etapa !== 'cliente') {
        await env.DB.prepare("UPDATE mkt_conversaciones SET etapa = 'cita', updated_at = datetime('now') WHERE id = ?").bind(conv.id).run();
        await registrarEvento(env, { clientId: conv.client_id, convId: conv.id, userId: yo, userNombre: session.name, tipo: 'etapa', dato: { de: conv.etapa, a: 'cita' } });
      }
      if (esAgente && !conv.asignado_a) await asignar(env, await marca(env, conv.client_id), conv.id, { id: yo, name: session.name }, { tipo: 'tomada' });
      return json({ ok: true });
    }

    // El agente va a escribir desde la app (Instagram, Business Suite o la app
    // de WhatsApp): se anota para que el eco cuente a su nombre.
    if (accion === 'abrir-app' && method === 'POST') {
      await registrarEvento(env, { clientId: conv.client_id, convId: conv.id, userId: yo, userNombre: session.name, tipo: 'abrio_app', dato: { canal: conv.canal } });
      return json({ ok: true });
    }

    // Cuánto texto cabe en la plantilla abierta para este chat (el composer lo muestra).
    if (accion === 'plantilla' && method === 'GET') {
      const c = await marca(env, conv.client_id);
      const clave = PLANTILLAS[qp('clave')] ? qp('clave') : 'seguimiento';
      const esp = espacioPlantilla(c, conv, session.name, clave);
      return json({ clave, max: esp.max, antes: renderPlantilla(esp.cuerpo, [esp.p1, esp.p2, '\u0000']).split('\u0000')[0], despues: renderPlantilla(esp.cuerpo, [esp.p1, esp.p2, '\u0000']).split('\u0000')[1] || '', botones: PLANTILLAS[clave].botones });
    }

    if (accion === 'sugerir' && method === 'POST') {
      const c = await marca(env, conv.client_id);
      const msgs = await env.DB.prepare('SELECT direccion, texto, adjunto_tipo FROM mkt_mensajes WHERE conv_id = ? ORDER BY creado DESC, rowid DESC LIMIT 12').bind(conv.id).all();
      const lista = (msgs.results || []).reverse();
      // Sin un mensaje de la persona no hay nada que contestar: antes la IA
      // inventaba una respuesta a nuestro propio mensaje (pasó el 7-oct).
      if (!lista.some((m) => m.direccion === 'in')) return json({ error: 'La persona todavía no ha escrito: no hay nada que contestar.' }, 400);
      const historial = lista.map((m) => `${m.direccion === 'in' ? 'Persona' : 'Marca'}: ${m.texto || textoDeAdjunto({ tipo: m.adjunto_tipo })}`).join('\n');
      try {
        const sugerencia = await sugerirRespuesta(env, c, { tipo: 'mensaje', canal: conv.canal, historial });
        return json({ sugerencia });
      } catch (e) { return json({ error: e.message || 'No se pudo sugerir.' }, 422); }
    }
    return json({ error: 'Not found' }, 404);
  }

  // ── Comentarios ──
  if (sub[0] === 'comentarios' && sub.length === 1 && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const where = ['client_id = ?'];
    const binds = [c.id];
    if (qp('estado') !== 'todos') where.push('atendido = 0');
    const canal = qp('canal');
    if (canal === 'instagram' || canal === 'facebook') { where.push('canal = ?'); binds.push(canal); }
    const r = await env.DB.prepare(
      `SELECT id, canal, comment_id, media_id, media_permalink, media_caption, parent_id, autor, autor_id, texto, comentado_en, atendido, respuesta, respondido_en, respondido_por, dm_enviado, oculto
         FROM mkt_comentarios WHERE ${where.join(' AND ')} ORDER BY atendido ASC, comentado_en DESC LIMIT 200`
    ).bind(...binds).all();
    return json({ comentarios: r.results || [] });
  }

  if (sub[0] === 'comentarios' && sub.length >= 3) {
    const cm = await comentarioDeMiWs(env, ws, sub[1]);
    if (!cm || (esCliente && cm.client_id !== session.client_id)) return json({ error: 'Comentario no encontrado' }, 404);
    const accion = sub[2];
    const c = await marca(env, cm.client_id);

    if (accion === 'responder' && method === 'POST') {
      const b = await leerJson(request);
      const texto = String(b.texto || '').trim();
      const modo = ['publico', 'dm', 'ambos'].includes(b.modo) ? b.modo : 'publico';
      if (!texto) return json({ error: 'Escribe la respuesta.' }, 400);
      if ((modo === 'dm' || modo === 'ambos') && cm.dm_enviado) return json({ error: 'Ese comentario ya recibió su respuesta privada (Meta permite una sola).' }, 409);
      let r;
      try { r = await responderComentario(c, cm, texto, modo); }
      catch (e) {
        const ex = e.code === 'SIN_CANAL' ? { msg: e.message } : explicarError(e, cm.canal);
        return json({ error: ex.msg, permiso: !!ex.permiso }, 422);
      }
      await env.DB.prepare(
        `UPDATE mkt_comentarios SET atendido = 1, respuesta = ?, respuesta_id = COALESCE(?, respuesta_id), respondido_en = datetime('now'), respondido_por = ?,
                dm_enviado = CASE WHEN ? THEN 1 ELSE dm_enviado END WHERE id = ?`
      ).bind(texto, r.publico && r.publico.id ? String(r.publico.id) : null, session.name || null, (modo === 'dm' || modo === 'ambos') ? 1 : 0, cm.id).run();
      // La respuesta privada abre una conversación: que aparezca en Mensajes.
      if (r.dm && cm.autor_id) {
        try {
          const canalMsg = cm.canal === 'instagram' ? 'instagram' : 'messenger';
          const cv = await convDe(env, c, canalMsg, String(r.dm.recipient_id || cm.autor_id), { nombre: cm.canal === 'facebook' ? cm.autor : null, username: cm.canal === 'instagram' ? cm.autor : null });
          await insertarMensaje(env, { convId: cv.id, mid: r.dm.message_id || null, direccion: 'out', texto, autorUserId: yo, autorNombre: session.name, estado: 'enviado' });
          await refrescarConv(env, cv.id, 0);
          if (esAgente) {
            const ya = await env.DB.prepare('SELECT asignado_a FROM mkt_conversaciones WHERE id = ?').bind(cv.id).first();
            if (ya && !ya.asignado_a) await asignar(env, c, cv.id, { id: yo, name: session.name }, { tipo: 'tomada' });
          }
        } catch { /* el comentario ya quedó contestado; la conversación es extra */ }
      }
      return json({ ok: true, publico: !!r.publico, dm: !!r.dm });
    }

    if (accion === 'atendido' && method === 'POST') {
      const b = await leerJson(request);
      await env.DB.prepare('UPDATE mkt_comentarios SET atendido = ? WHERE id = ?').bind(b.atendido === false ? 0 : 1, cm.id).run();
      return json({ ok: true });
    }

    if (accion === 'ocultar' && method === 'POST') {
      const b = await leerJson(request);
      const oculto = b.oculto !== false;
      try { await ocultarComentario(c, cm, oculto); }
      catch (e) { const ex = explicarError(e, cm.canal); return json({ error: ex.msg, permiso: !!ex.permiso }, 422); }
      await env.DB.prepare('UPDATE mkt_comentarios SET oculto = ?, atendido = CASE WHEN ? THEN 1 ELSE atendido END WHERE id = ?').bind(oculto ? 1 : 0, oculto ? 1 : 0, cm.id).run();
      return json({ ok: true, oculto });
    }

    if (accion === 'sugerir' && method === 'POST') {
      try {
        const sugerencia = await sugerirRespuesta(env, c, { tipo: 'comentario', canal: cm.canal, texto: cm.texto, autor: cm.autor });
        return json({ sugerencia });
      } catch (e) { return json({ error: e.message || 'No se pudo sugerir.' }, 422); }
    }
    return json({ error: 'Not found' }, 404);
  }

  // ── Adjuntos: proxy con sesión (WhatsApp exige el token para bajar media) ──
  if (sub[0] === 'adjunto' && sub[1] && method === 'GET') {
    const m = await env.DB.prepare(
      `SELECT m.adjunto_url, m.adjunto_id, m.adjunto_tipo, v.client_id, v.canal, v.asignado_a FROM mkt_mensajes m
         JOIN mkt_conversaciones v ON v.id = m.conv_id JOIN mkt_clients c ON c.id = v.client_id
        WHERE m.id = ? AND COALESCE(c.workspace_id, 'ivae') = ?`
    ).bind(sub[1], ws).first();
    if (!m || (esCliente && m.client_id !== session.client_id) || (esAgente && m.asignado_a && m.asignado_a !== yo)) return json({ error: 'Adjunto no encontrado' }, 404);
    try {
      let res;
      if (m.canal === 'whatsapp' && m.adjunto_id) {
        const c = await marca(env, m.client_id);
        const meta = await graph(`${GRAPH_FB}/${m.adjunto_id}`, { token: c.wa_access_token });
        res = await fetch(meta.url, { headers: { authorization: `Bearer ${c.wa_access_token}` }, signal: AbortSignal.timeout(20000) });
      } else if (m.adjunto_url && /^https:\/\//.test(m.adjunto_url)) {
        res = await fetch(m.adjunto_url, { signal: AbortSignal.timeout(20000) });
      } else {
        return json({ error: 'Este adjunto no se puede abrir.' }, 404);
      }
      if (!res.ok) return json({ error: 'Meta ya no entrega este archivo (caducó).' }, 410);
      const h = new Headers();
      h.set('content-type', res.headers.get('content-type') || 'application/octet-stream');
      h.set('cache-control', 'private, max-age=3600');
      h.set('x-content-type-options', 'nosniff');
      return new Response(res.body, { status: 200, headers: h });
    } catch (e) {
      return json({ error: 'No se pudo bajar el adjunto: ' + String(e && e.message).slice(0, 120) }, 422);
    }
  }

  // ── Equipo de la marca: quién atiende y cómo se reparte ──
  if (sub[0] === 'equipo' && sub.length === 1 && method === 'GET') {
    if (!esSupervisor) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const accesos = await accesosDeMarca(env, c.id);
    return json({
      accesos: accesos.map((u) => ({ id: u.id, nombre: u.name, usuario: u.username || u.email, rol: u.bandeja_rol || null, disponible: !!u.disponible, activo: !!u.active })),
      cfg: (() => { const x = cfgDe(c); return { reparto: x.reparto !== false, reasignar_min: Number(x.reasignar_min) || 0, dias_seguimiento: Number(x.dias_seguimiento) || 3, avisar_agencia: !!x.avisar_agencia, nombre_comercial: nombreComercial(c) }; })(),
      puede_editar: !esCliente,
    });
  }
  // Rol en la bandeja (solo staff) y disponibilidad (staff, supervisor o uno mismo).
  if (sub[0] === 'equipo' && sub[1] && method === 'PATCH') {
    const b = await leerJson(request);
    const objetivoId = sub[1] === 'yo' ? yo : sub[1];
    const u = await env.DB.prepare("SELECT id, role, client_id, name FROM mkt_users WHERE id = ?").bind(objetivoId).first();
    if (!u || u.role !== 'client') return json({ error: 'Ese acceso no existe.' }, 404);
    if (!(await marcaOk(u.client_id))) return json({ error: 'Ese acceso no existe.' }, 404);
    const sets = [];
    const binds = [];
    if (b.rol !== undefined) {
      if (esCliente) return prohibido();
      const rol = b.rol === 'agente' || b.rol === 'supervisor' ? b.rol : null;
      sets.push('bandeja_rol = ?'); binds.push(rol);
    }
    if (b.disponible !== undefined) {
      if (esAgente && objetivoId !== yo) return prohibido();
      sets.push('bandeja_disponible = ?'); binds.push(b.disponible ? 1 : 0);
    }
    if (!sets.length) return json({ error: 'Nada que actualizar' }, 400);
    binds.push(u.id);
    await env.DB.prepare(`UPDATE mkt_users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...binds).run();
    return json({ ok: true });
  }

  // ── Configuración del reparto (solo staff) ──
  if (sub[0] === 'cfg' && method === 'POST') {
    if (esCliente) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const b = await leerJson(request);
    const cfg = cfgDe(c);
    if (b.reparto !== undefined) cfg.reparto = !!b.reparto;
    if (b.reasignar_min !== undefined) cfg.reasignar_min = Math.max(0, Math.min(1440, Math.round(Number(b.reasignar_min) || 0)));
    if (b.dias_seguimiento !== undefined) cfg.dias_seguimiento = Math.max(1, Math.min(60, Math.round(Number(b.dias_seguimiento) || 3)));
    if (b.avisar_agencia !== undefined) cfg.avisar_agencia = !!b.avisar_agencia;
    if (b.nombre_comercial !== undefined) cfg.nombre_comercial = String(b.nombre_comercial || '').trim().slice(0, 60);
    await guardarCfg(env, c.id, cfg);
    return json({ ok: true });
  }

  // ── Repartir los chats sin dueño de los últimos 14 días ──
  if (sub[0] === 'repartir' && method === 'POST') {
    if (!esSupervisor) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const r = await env.DB.prepare(
      "SELECT id FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0 AND asignado_a IS NULL AND ultimo_cliente_en >= datetime('now', '-14 days') ORDER BY ultimo_cliente_en ASC LIMIT 200"
    ).bind(c.id).all();
    const porAgente = {};
    for (const v of r.results || []) {
      const ag = await siguienteAgente(env, c.id);
      if (!ag) return json({ error: 'No hay agentes disponibles en el equipo de esta marca.' }, 400);
      await asignar(env, c, v.id, ag, { dato: { por: session.name, repartir: true } });
      porAgente[ag.name] = (porAgente[ag.name] || 0) + 1;
    }
    return json({ ok: true, repartidas: (r.results || []).length, por_agente: porAgente });
  }

  // ── Plantillas abiertas de WhatsApp ──
  if (sub[0] === 'plantillas') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    if (method === 'GET') {
      if (!esSupervisor) return prohibido();
      return json({ plantillas: await refrescarPlantillas(env, c) });
    }
    if (method === 'POST') {
      if (esCliente) return prohibido();
      try { return json({ ok: true, ...(await crearPlantillas(env, c)) }); }
      catch (e) { return json({ error: e.code === 'SIN_CANAL' ? e.message : explicarError(e, 'whatsapp').msg }, 422); }
    }
  }

  // ── Dashboard de desempeño (supervisor y staff) ──
  if (sub[0] === 'desempeno' && method === 'GET') {
    if (!esSupervisor) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    return json(await calcularDesempeno(env, c, Number(qp('dias')) || 30));
  }

  // ── Sondear ahora (una marca) ──
  if (sub[0] === 'sondear' && method === 'POST') {
    if (esCliente) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    try {
      const r = await sondearBandeja(env, { clientId: c.id });
      return json({ ok: true, resultado: r[0] || null });
    } catch (e) { return json({ error: (e && e.message) || 'Fallo del sondeo' }, 422); }
  }

  // ── Suscribir webhooks de una marca ──
  if (sub[0] === 'suscribir' && method === 'POST') {
    if (esCliente) return prohibido();
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    return json({ ok: true, resultado: await suscribirWebhooks(env, c) });
  }

  // ── Solo admin: datos para configurar el webhook en Meta ──
  if (sub[0] === 'webhook-info' && method === 'GET') {
    if (!esAdmin) return json({ error: 'Forbidden' }, 403);
    const tok = await tokenVerificacion(env, { crear: true });
    let ultimo = null;
    try { const r = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_ULTIMO_WEBHOOK).first(); ultimo = r ? JSON.parse(r.value) : null; } catch { ultimo = null; }
    return json({
      url: new URL('/api/marketing/webhook/meta', request.url).toString().replace(/^http:\/\/localhost[^/]*/, 'https://ivaestudios.com'),
      verify_token: tok,
      firma_configurada: !!(env.FB_APP_SECRET || env.META_APP_SECRET),
      ultimo_webhook: ultimo,
    });
  }

  // ── Solo admin: WhatsApp por marca (número + token de la Cloud API) ──
  if (sub[0] === 'whatsapp' && sub.length === 1 && method === 'POST') {
    if (!esAdmin) return json({ error: 'Forbidden' }, 403);
    const b = await leerJson(request);
    const c = await marcaDeMiWs(env, ws, String(b.client_id || ''));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const phoneId = String(b.phone_id || '').trim();
    const token = String(b.token || '').trim();
    const wabaId = String(b.waba_id || '').trim();
    if (!/^\d{6,25}$/.test(phoneId)) return json({ error: 'El ID del número (phone number ID) son solo dígitos.' }, 400);
    if (token.length < 40) return json({ error: 'Pega el token permanente completo (usuario del sistema).' }, 400);
    let info;
    try { info = await graph(`${GRAPH_FB}/${phoneId}?fields=display_phone_number,verified_name,quality_rating`, { token }); }
    catch (e) { return json({ error: 'Meta no acepta ese número o token: ' + explicarError(e, 'whatsapp').msg }, 400); }
    await env.DB.prepare("UPDATE mkt_clients SET wa_phone_id = ?, wa_waba_id = ?, wa_numero = ?, wa_access_token = ?, wa_connected_at = datetime('now') WHERE id = ?")
      .bind(phoneId, wabaId || null, info.display_phone_number || null, token, c.id).run();
    const fresco = await marca(env, c.id);
    const sus = await suscribirWebhooks(env, fresco);
    return json({ ok: true, numero: info.display_phone_number || null, nombre: info.verified_name || null, webhook: sus });
  }
  if (sub[0] === 'whatsapp' && sub[1] === 'desconectar' && method === 'POST') {
    if (!esAdmin) return json({ error: 'Forbidden' }, 403);
    const b = await leerJson(request);
    const c = await marcaDeMiWs(env, ws, String(b.client_id || ''));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    await env.DB.prepare('UPDATE mkt_clients SET wa_phone_id = NULL, wa_waba_id = NULL, wa_numero = NULL, wa_access_token = NULL, wa_connected_at = NULL WHERE id = ?').bind(c.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ── DESEMPEÑO DEL EQUIPO ─────────────────────────────────────────────────────
// Lo que el dueño de SMILE pidió ver: cuánto tarda cada quien en contestar,
// quién contesta más, llamadas, seguimientos y citas, por agente y por anuncio.
// Tiempo de respuesta = desde el mensaje del paciente que quedó esperando hasta
// la siguiente respuesta de una PERSONA (no cuenta el bot). Horas corridas.
function mediana(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function promedio(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function msDe(s) { return Date.parse(String(s).replace(' ', 'T') + 'Z'); }
function diaCancun(s) {
  const t = msDe(s);
  return isNaN(t) ? '' : new Date(t - 5 * 3600e3).toISOString().slice(0, 10);
}
const AUTORES_NO_HUMANOS = new Set(['Juan', 'Bot', 'IA']);

async function calcularDesempeno(env, c, diasPedidos) {
  const dias = Math.min(180, Math.max(1, Math.round(diasPedidos) || 30));
  const desde = fechaDeMs(Date.now() - dias * 864e5);
  const [msgsR, convsR, evR, backlog, accesos] = await Promise.all([
    env.DB.prepare(
      `SELECT m.conv_id, m.direccion, m.autor_user_id, m.autor_nombre, m.creado, m.via, m.estado, v.canal
         FROM mkt_mensajes m JOIN mkt_conversaciones v ON v.id = m.conv_id
        WHERE v.client_id = ? AND m.creado >= ? ORDER BY m.conv_id, m.creado, m.rowid LIMIT 40000`
    ).bind(c.id, fechaDeMs(Date.now() - (dias + 3) * 864e5)).all(),
    env.DB.prepare(
      `SELECT v.id, v.canal, v.asignado_a, v.origen, v.etapa, MIN(m.creado) AS primer_in
         FROM mkt_conversaciones v JOIN mkt_mensajes m ON m.conv_id = v.id AND m.direccion = 'in'
        WHERE v.client_id = ? GROUP BY v.id`
    ).bind(c.id).all(),
    env.DB.prepare('SELECT conv_id, user_id, user_nombre, tipo, dato, creado FROM mkt_bandeja_eventos WHERE client_id = ? AND creado >= ?').bind(c.id, desde).all(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0 AND ultimo_cliente_en IS NOT NULL AND ultimo_cliente_en = ultimo_en AND ultimo_en <= datetime('now', '-15 minutes')").bind(c.id).first(),
    accesosDeMarca(env, c.id),
  ]);

  const nombres = new Map(accesos.map((u) => [u.id, u.name]));
  const agentes = new Map();
  const fila = (id, nombre) => {
    const k = id || ('fuera:' + (nombre || ''));
    if (!agentes.has(k)) {
      agentes.set(k, {
        id: id || null, nombre: (id && nombres.get(id)) || nombre || 'Sin nombre', es_agente: false,
        asignados: 0, chats_atendidos: 0, primeras: [], respuestas: [], mensajes: 0, seguimientos: 0, plantillas: 0,
        llamadas: 0, llamadas_contestadas: 0, minutos_llamada: 0, citas: 0, _convs: new Set(),
      });
    }
    return agentes.get(k);
  };
  for (const u of accesos) if (u.bandeja_rol === 'agente' && u.active) { const f = fila(u.id, u.name); f.es_agente = true; f.disponible = !!u.disponible; }

  // Leads nuevos del periodo: conversaciones cuyo PRIMER mensaje del paciente cae en el periodo.
  const convs = convsR.results || [];
  const primerIn = new Map(convs.map((v) => [v.id, v.primer_in]));
  const leads = convs.filter((v) => v.primer_in && v.primer_in >= desde);
  const porCanal = {};
  const porAnuncio = new Map();
  const porDia = {};
  for (let i = Math.min(dias, 60) - 1; i >= 0; i--) porDia[new Date(Date.now() - 5 * 3600e3 - i * 864e5).toISOString().slice(0, 10)] = 0;
  for (const v of leads) {
    porCanal[v.canal] = (porCanal[v.canal] || 0) + 1;
    let o = null;
    try { o = v.origen ? JSON.parse(v.origen) : null; } catch { o = null; }
    const esAnuncio = !!(o && o.tipo === 'anuncio');
    const clave = esAnuncio ? (o.ad_id || o.titulo || 'anuncio') : 'organico';
    const f = porAnuncio.get(clave) || { clave, titulo: esAnuncio ? (o.titulo || `Anuncio ${o.ad_id || ''}`.trim()) : 'Sin anuncio (orgánico)', ad_id: esAnuncio ? o.ad_id || null : null, anuncio: esAnuncio, leads: 0, citas: 0 };
    f.leads++;
    if (v.etapa === 'cita' || v.etapa === 'cliente') f.citas++;
    porAnuncio.set(clave, f);
    const d = diaCancun(v.primer_in);
    if (d in porDia) porDia[d]++;
  }

  // Tiempos de respuesta, mensajes, seguimientos y entregas.
  const respondidos = new Set();
  let enviadosWa = 0, entregados = 0, leidos = 0, fallidos = 0;
  let convActual = null, esperando = null, ultimoIn = null, primeraHecha = false;
  for (const m of msgsR.results || []) {
    if (m.conv_id !== convActual) {
      convActual = m.conv_id; esperando = null; ultimoIn = null;
      const pi = primerIn.get(m.conv_id);
      primeraHecha = !(pi && pi >= desde); // solo los leads del periodo miden "primera respuesta"
    }
    if (m.direccion === 'in') {
      if (!esperando) esperando = m.creado;
      ultimoIn = m.creado;
      continue;
    }
    const humano = !!m.autor_user_id || (m.autor_nombre && !AUTORES_NO_HUMANOS.has(m.autor_nombre));
    if (!humano || m.estado === 'error' || m.creado < desde) {
      if (humano && esperando && m.estado !== 'error') esperando = null;
      continue;
    }
    const f = fila(m.autor_user_id, m.autor_user_id ? null : (m.autor_nombre === 'Meta' || m.autor_nombre === 'App de WhatsApp' ? 'Desde la app de Meta o WhatsApp' : m.autor_nombre));
    f.mensajes++;
    if (String(m.via || '').startsWith('plantilla:')) f.plantillas++;
    if (!ultimoIn || (msDe(m.creado) - msDe(ultimoIn)) >= 24 * 3600e3) f.seguimientos++;
    if (m.canal === 'whatsapp') {
      enviadosWa++;
      if (m.estado === 'entregado' || m.estado === 'leido') entregados++;
      if (m.estado === 'leido') leidos++;
      if (m.estado === 'fallido') fallidos++;
    }
    if (esperando) {
      const min = Math.max(0, (msDe(m.creado) - msDe(esperando)) / 60000);
      f.respuestas.push(min);
      f._convs.add(m.conv_id);
      if (!primeraHecha) { f.primeras.push(min); primeraHecha = true; respondidos.add(m.conv_id); }
      esperando = null;
    }
  }

  // Eventos: asignaciones, llamadas y citas.
  let citasTotal = 0, llamadasTotal = 0;
  for (const e of evR.results || []) {
    let dato = null;
    try { dato = e.dato ? JSON.parse(e.dato) : null; } catch { dato = null; }
    if (['asignacion', 'reasignacion', 'tomada'].includes(e.tipo)) { if (e.user_id) fila(e.user_id, e.user_nombre).asignados++; }
    else if (e.tipo === 'llamada') {
      const f = fila(e.user_id, e.user_nombre);
      f.llamadas++; llamadasTotal++;
      if (dato && (dato.resultado === 'contesto' || dato.resultado === 'cita')) f.llamadas_contestadas++;
      f.minutos_llamada += (dato && Number(dato.minutos)) || 0;
    } else if (e.tipo === 'etapa' && dato && dato.a === 'cita') {
      fila(e.user_id, e.user_nombre).citas++; citasTotal++;
    }
  }

  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const lista = [...agentes.values()]
    .filter((f) => f.es_agente || f.mensajes || f.llamadas || f.asignados || f.citas)
    .map((f) => ({
      id: f.id, nombre: f.nombre, es_agente: f.es_agente, disponible: f.disponible,
      asignados: f.asignados, chats_atendidos: f._convs.size, mensajes: f.mensajes, seguimientos: f.seguimientos, plantillas: f.plantillas,
      llamadas: f.llamadas, llamadas_contestadas: f.llamadas_contestadas, minutos_llamada: f.minutos_llamada, citas: f.citas,
      primera_respuesta_min: r1(mediana(f.primeras)), respuesta_mediana_min: r1(mediana(f.respuestas)), respuesta_promedio_min: r1(promedio(f.respuestas)),
    }))
    .sort((a, b) => (b.mensajes - a.mensajes) || (b.asignados - a.asignados));
  const todasPrimeras = [...agentes.values()].flatMap((f) => f.primeras);
  const todasResp = [...agentes.values()].flatMap((f) => f.respuestas);
  return {
    periodo: { dias, desde },
    totales: {
      leads: leads.length,
      respondidos: leads.filter((v) => respondidos.has(v.id)).length,
      sin_respuesta_ahora: Number(backlog && backlog.n) || 0,
      primera_respuesta_min: r1(mediana(todasPrimeras)),
      respuesta_mediana_min: r1(mediana(todasResp)),
      mensajes: lista.reduce((a, f) => a + f.mensajes, 0),
      seguimientos: lista.reduce((a, f) => a + f.seguimientos, 0),
      plantillas: lista.reduce((a, f) => a + f.plantillas, 0),
      llamadas: llamadasTotal,
      citas: citasTotal,
      whatsapp: { enviados: enviadosWa, entregados, leidos, no_entregados: fallidos },
    },
    agentes: lista,
    canales: Object.entries(porCanal).map(([canal, n]) => ({ canal, leads: n })).sort((a, b) => b.leads - a.leads),
    anuncios: [...porAnuncio.values()].sort((a, b) => b.leads - a.leads).slice(0, 25),
    dias: Object.entries(porDia).map(([dia, n]) => ({ dia, leads: n })),
  };
}

// ── REASIGNACIÓN AUTOMÁTICA (cron cada 15 min) ───────────────────────────────
// Si el agente no contesta un chat nuevo en N minutos, pasa al siguiente
// disponible. Solo marcas con reasignar_min configurado (5 minutos o más).
export async function reasignarVencidas(env) {
  let marcas;
  try {
    marcas = (await env.DB.prepare("SELECT id FROM mkt_clients WHERE archived = 0 AND bandeja_cfg LIKE '%reasignar_min%'").all()).results || [];
  } catch { return 0; }
  let n = 0;
  for (const row of marcas) {
    const c = await marca(env, row.id);
    if (!c) continue;
    const cfg = cfgDe(c);
    const min = Number(cfg.reasignar_min) || 0;
    if (min < 5 || cfg.reparto === false) continue;
    const vencidas = (await env.DB.prepare(
      `SELECT v.id, v.asignado_a, v.nombre, v.username, v.contacto_id, v.canal FROM mkt_conversaciones v
        WHERE v.client_id = ? AND v.archivado = 0 AND v.asignado_a IS NOT NULL
          AND v.ultimo_cliente_en IS NOT NULL AND v.ultimo_cliente_en = v.ultimo_en
          AND v.asignado_en <= datetime('now', ?) AND v.ultimo_cliente_en <= datetime('now', ?)
          AND v.ultimo_cliente_en >= datetime('now', '-2 days')
          AND NOT EXISTS (SELECT 1 FROM mkt_mensajes m WHERE m.conv_id = v.id AND m.direccion = 'out' AND m.creado >= v.asignado_en)
        LIMIT 25`
    ).bind(c.id, `-${min} minutes`, `-${min} minutes`).all()).results || [];
    for (const v of vencidas) {
      const ag = await siguienteAgente(env, c.id, v.asignado_a);
      if (!ag) break;
      await asignar(env, c, v.id, ag, { tipo: 'reasignacion', dato: { de: v.asignado_a, motivo: `sin respuesta en ${min} min` } });
      await avisarUsuarios(env, c, [ag.id], {
        tipo: 'mensaje',
        body: `Te pasamos el chat de ${v.nombre || (v.username ? '@' + v.username : (v.canal === 'whatsapp' ? '+' + v.contacto_id : 'un contacto'))}: lleva ${min} min sin respuesta.`,
        link: `#/bandeja?cliente=${c.id}&conv=${v.id}`,
      });
      n++;
    }
  }
  return n;
}

// Cada mañana (cron diario): un aviso por conversación con seguimiento para hoy
// o vencido, y se limpia la fecha para que no repita. En marcas con equipo el
// aviso va al agente del chat, y cada agente recibe además cuántos chats tiene
// por seguir (la persona lleva días sin contestar).
export async function avisarSeguimientos(env) {
  const hoy = fechaHoy();
  const r = await env.DB.prepare(
    `SELECT v.id, v.client_id, v.nombre, v.username, v.canal, v.seguimiento, v.asignado_a FROM mkt_conversaciones v WHERE v.seguimiento IS NOT NULL AND v.seguimiento <= ? LIMIT 100`
  ).bind(hoy).all();
  let n = 0;
  for (const v of r.results || []) {
    const c = await marca(env, v.client_id);
    if (!c) continue;
    const aviso = {
      tipo: 'seguimiento',
      body: `Hoy toca dar seguimiento a ${v.nombre || (v.username ? '@' + v.username : v.canal)} (${nombreCanal(v.canal)}).`,
      link: `#/bandeja?cliente=${c.id}&conv=${v.id}`,
    };
    if (v.asignado_a) await avisarUsuarios(env, c, [v.asignado_a], aviso);
    else await avisarStaff(env, c, aviso);
    await env.DB.prepare('UPDATE mkt_conversaciones SET seguimiento = NULL WHERE id = ?').bind(v.id).run();
    n++;
  }
  // Resumen por agente de los chats "por seguir".
  try {
    const marcas = (await env.DB.prepare(
      "SELECT DISTINCT client_id FROM mkt_users WHERE role = 'client' AND bandeja_rol = 'agente' AND active = 1"
    ).all()).results || [];
    for (const { client_id: cid } of marcas) {
      const c = await marca(env, cid);
      if (!c) continue;
      const dias = Math.max(1, Number(cfgDe(c).dias_seguimiento) || 3);
      const filas = (await env.DB.prepare(
        `SELECT asignado_a, COUNT(*) AS n FROM mkt_conversaciones
          WHERE client_id = ? AND archivado = 0 AND asignado_a IS NOT NULL AND etapa NOT IN ('cliente', 'perdido')
            AND ultimo_en <= datetime('now', ?) AND ultimo_en >= datetime('now', '-30 days')
            AND (ultimo_cliente_en IS NULL OR ultimo_cliente_en < ultimo_en)
          GROUP BY asignado_a`
      ).bind(cid, `-${dias} days`).all()).results || [];
      for (const f of filas) {
        await avisarUsuarios(env, c, [f.asignado_a], {
          tipo: 'seguimiento',
          body: `Tienes ${f.n} ${f.n === 1 ? 'chat' : 'chats'} por seguir: la persona lleva ${dias} días o más sin contestar.`,
          link: `#/bandeja?cliente=${cid}&seguir=1`,
        });
        n++;
      }
    }
  } catch (e) { console.error('[bandeja por seguir]', e && e.message); }
  return n;
}
