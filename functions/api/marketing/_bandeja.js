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
export const ETAPAS = ['nuevo', 'platica', 'cotizado', 'cliente', 'perdido'];
const CANALES_MSG = ['instagram', 'messenger', 'whatsapp'];
const LIM_TEXTO = { instagram: 950, messenger: 1900, whatsapp: 4000 };
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
  return { instagram: 'Instagram', messenger: 'Messenger', facebook: 'Facebook', whatsapp: 'WhatsApp' }[c] || c;
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
  ig_user_id, ig_username, ig_access_token, fb_page_id, fb_page_name, fb_access_token,
  wa_phone_id, wa_waba_id, wa_numero, wa_access_token, bandeja_sondeo_at, bandeja_estado`;

async function marca(env, clientId) {
  if (!clientId) return null;
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE id = ?`).bind(clientId).first();
}
async function marcaPorIg(env, igId) {
  if (!igId) return null;
  // La marca DEMO comparte @ivae.studios con la marca real: gana la real
  // (la que no es demo) para que los mensajes no caigan en la de los revisores.
  return env.DB.prepare(`SELECT ${COLS_MARCA} FROM mkt_clients WHERE ig_user_id = ? AND ig_access_token IS NOT NULL ORDER BY (id = '67322bb3c5f64991a9178b1d1784231a') ASC LIMIT 1`).bind(igId).first();
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

// Aviso en la campana + push al teléfono. Best-effort: jamás rompe la entrada.
async function avisarStaff(env, c, { tipo, body, link }) {
  try {
    const ids = await staffDeLaMarca(env, c);
    if (!ids.length) return 0;
    await env.DB.batch(ids.map((uid) => env.DB.prepare(
      'INSERT INTO mkt_notifications (id, user_id, client_id, type, actor_name, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(randomId(), uid, c.id, tipo, c.name, body, link)));
    await repartirPush(env, ids, { titulo: c.name, cuerpo: body, link: '/marketing/app' + link, tipo, quien: c.name }).catch(() => {});
    return ids.length;
  } catch (e) {
    console.error('[bandeja aviso]', e && e.message);
    return 0;
  }
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
async function insertarMensaje(env, { convId, mid = null, direccion, texto = '', adjunto = null, autorUserId = null, autorNombre = null, estado = null, error = null, creado = null }) {
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO mkt_mensajes (id, conv_id, mid, direccion, texto, adjunto_tipo, adjunto_url, adjunto_id, autor_user_id, autor_nombre, estado, error, creado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).bind(randomId(), convId, mid || null, direccion, String(texto || '').slice(0, 8000),
    adjunto ? adjunto.tipo || null : null, adjunto ? adjunto.url || null : null, adjunto ? adjunto.id || null : null,
    autorUserId, autorNombre, estado, error, creado).run();
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
async function ingerirMensajeMeta(env, c, canal, ev) {
  const m = ev && ev.message;
  if (!m && !(ev && ev.postback)) return 0; // delivery / read / reaction: no interesan
  const propioId = canal === 'instagram' ? String(c.ig_user_id || '') : String(c.fb_page_id || '');
  const cuando = fechaDeMs(ev.timestamp);
  if (m && m.is_echo) {
    // ECO de un mensaje SALIENTE (nuestro por API, o escrito en la bandeja de
    // Meta / la app de Instagram). Si lo mandamos nosotros ya está guardado
    // con ese mid y el INSERT OR IGNORE lo deja pasar.
    const contacto = String((ev.recipient && ev.recipient.id) || '');
    if (!contacto || contacto === propioId) return 0;
    const conv = await convDe(env, c, canal, contacto);
    const adj = adjuntoDeMeta(m);
    const ok = await insertarMensaje(env, { convId: conv.id, mid: m.mid, direccion: 'out', texto: m.text || '', adjunto: adj, autorNombre: 'Meta', estado: 'enviado', creado: cuando });
    if (ok) await refrescarConv(env, conv.id, 0);
    return ok ? 1 : 0;
  }
  const contacto = String((ev.sender && ev.sender.id) || '');
  if (!contacto || contacto === propioId) return 0;
  const texto = m ? (m.text || '') : (ev.postback.title || ev.postback.payload || '');
  const mid = m ? m.mid : `pb:${contacto}:${ev.timestamp}`;
  const adj = m ? adjuntoDeMeta(m) : null;
  const conv = await convDe(env, c, canal, contacto, { resolverNombre: true });
  const ok = await insertarMensaje(env, { convId: conv.id, mid, direccion: 'in', texto, adjunto: adj, creado: cuando });
  if (!ok) return 0;
  await refrescarConv(env, conv.id, 1);
  // Un aviso por ráfaga: si ya había mensajes sin leer, el equipo ya lo sabe.
  if (!conv.noLeidosAntes) {
    const quien = conv.nombre || (conv.username ? '@' + conv.username : 'Alguien');
    await avisarStaff(env, c, {
      tipo: 'mensaje',
      body: `${quien} te escribió por ${nombreCanal(canal)}: "${(texto || textoDeAdjunto(adj)).slice(0, 90)}"`,
      link: `#/bandeja?cliente=${c.id}&conv=${conv.id}`,
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
  if (!conv.noLeidosAntes) {
    await avisarStaff(env, c, {
      tipo: 'mensaje',
      body: `${conv.nombre || '+' + contacto} te escribió por WhatsApp: "${(texto || textoDeAdjunto(adj)).slice(0, 90)}"`,
      link: `#/bandeja?cliente=${c.id}&conv=${conv.id}`,
    });
  }
  return 1;
}

// ── ENTRADA: comentarios ─────────────────────────────────────────────────────
// cm = {canal, commentId, mediaId, permalink, caption, parentId, autor, autorId, texto, cuando}
// frescoDesde: en el primer sondeo, lo anterior a esa fecha entra ya atendido
// y sin aviso (si no, el primer día llegarían 200 avisos de comentarios viejos).
async function guardarComentario(env, c, cm, { frescoDesde = null, avisar = true } = {}) {
  if (!cm.commentId) return 0;
  const propio = cm.autorId && (cm.autorId === String(c.ig_user_id || '') || cm.autorId === String(c.fb_page_id || ''));
  if (propio) return 0; // lo escribió la marca (o nosotros): no es algo que atender
  const viejo = !!(frescoDesde && cm.cuando && cm.cuando < frescoDesde);
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
        const nombres = {};
        for (const ct of v.contacts || []) nombres[String(ct.wa_id)] = ct.profile && ct.profile.name;
        for (const m of v.messages || []) resumen.mensajes += await ingerirMensajeWa(env, c, m, nombres[String(m.from)]);
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
  const propioId = String(esIG ? c.ig_user_id : c.fb_page_id);
  const r = await graph(`${base}/conversations?platform=${esIG ? 'instagram' : 'messenger'}&fields=id,updated_time,participants,messages.limit(15){id,from,to,message,created_time,attachments}&limit=12`, { token });
  let n = 0;
  for (const conv of r.data || []) {
    const actualizada = fechaDeIso(conv.updated_time);
    if (desde && actualizada <= desde) continue;
    const otro = ((conv.participants && conv.participants.data) || []).find((p) => String(p.id) !== propioId);
    if (!otro) continue;
    const cv = await convDe(env, c, canal, String(otro.id), { nombre: otro.name || null, username: otro.username || null });
    let entrantes = 0;
    let ultimoTexto = '';
    const msgs = ((conv.messages && conv.messages.data) || []).slice().reverse(); // Meta los manda del más nuevo al más viejo
    for (const m of msgs) {
      const mio = String((m.from && m.from.id) || '') === propioId;
      const a = m.attachments && m.attachments.data && m.attachments.data[0];
      const adj = a ? { tipo: a.video_data ? 'video' : a.image_data ? 'image' : a.file_url ? 'file' : 'share', url: (a.video_data && a.video_data.url) || (a.image_data && a.image_data.url) || a.file_url || null } : null;
      const creado = fechaDeIso(m.created_time);
      // En el primer sondeo lo viejo entra leído: es historial, no pendientes.
      const viejo = primera && creado < fechaDeMs(Date.now() - 48 * 3600e3);
      const ok = await insertarMensaje(env, { convId: cv.id, mid: m.id, direccion: mio ? 'out' : 'in', texto: m.message || '', adjunto: adj, autorNombre: mio ? 'Meta' : null, estado: mio ? 'enviado' : null, creado });
      if (ok) { n++; if (!mio && !viejo) { entrantes++; ultimoTexto = m.message || textoDeAdjunto(adj); } }
    }
    if (n) await refrescarConv(env, cv.id, entrantes);
    if (entrantes && !cv.noLeidosAntes) {
      await avisarStaff(env, c, {
        tipo: 'mensaje',
        body: `${cv.nombre || (cv.username ? '@' + cv.username : 'Alguien')} te escribió por ${nombreCanal(canal)}: "${String(ultimoTexto).slice(0, 90)}"`,
        link: `#/bandeja?cliente=${c.id}&conv=${cv.id}`,
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
    if (c.ig_user_id && c.ig_access_token) {
      try { n.comentarios += await sondearComentariosIG(env, c, frescoDesde); estado.ig_comentarios = 'ok'; } catch (e) { estado.ig_comentarios = resumirError(e); }
      try { n.mensajes += await sondearConversaciones(env, c, 'instagram', desde, primera); estado.ig_mensajes = 'ok'; } catch (e) { estado.ig_mensajes = resumirError(e); }
    }
    if (c.fb_page_id && c.fb_access_token) {
      try { n.comentarios += await sondearComentariosFB(env, c, frescoDesde); estado.fb_comentarios = 'ok'; } catch (e) { estado.fb_comentarios = resumirError(e); }
      try { n.mensajes += await sondearConversaciones(env, c, 'messenger', desde, primera); estado.fb_mensajes = 'ok'; } catch (e) { estado.fb_mensajes = resumirError(e); }
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
async function enviarTexto(c, conv, texto) {
  const lim = LIM_TEXTO[conv.canal] || 1900;
  const mids = [];
  for (const pieza of partirTexto(texto, lim)) {
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

export async function handleBandeja(request, env, session, url, parts) {
  const method = request.method;
  const ws = (session && session.workspace_id) || 'ivae';
  const esAdmin = session.role === 'admin';
  const sub = parts.slice(1); // parts[0] === 'bandeja'
  const qp = (k) => url.searchParams.get(k) || '';

  // ── Resumen por marca: contadores, canales y salud del sondeo ──
  if (sub[0] === 'resumen' && method === 'GET') {
    const c = await marcaDeMiWs(env, ws, qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const [convs, coms, seg] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(no_leidos), 0) AS no_leidos FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0').bind(c.id).first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_comentarios WHERE client_id = ? AND atendido = 0').bind(c.id).first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_conversaciones WHERE client_id = ? AND seguimiento IS NOT NULL AND seguimiento <= ?').bind(c.id, fechaHoy()).first(),
    ]);
    let estado = null;
    try { estado = c.bandeja_estado ? JSON.parse(c.bandeja_estado) : null; } catch { estado = null; }
    let ultimoWebhook = null;
    if (esAdmin) {
      try { const r = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_ULTIMO_WEBHOOK).first(); ultimoWebhook = r ? JSON.parse(r.value) : null; } catch { ultimoWebhook = null; }
    }
    return json({
      marca: { id: c.id, name: c.name },
      conversaciones: Number(convs.n) || 0,
      no_leidos: Number(convs.no_leidos) || 0,
      comentarios_pendientes: Number(coms.n) || 0,
      seguimientos_hoy: Number(seg.n) || 0,
      canales: {
        instagram: { conectado: !!(c.ig_user_id && c.ig_access_token), cuenta: c.ig_username ? '@' + c.ig_username : null },
        messenger: { conectado: !!(c.fb_page_id && c.fb_access_token), cuenta: c.fb_page_name || null },
        whatsapp: { conectado: !!(c.wa_phone_id && c.wa_access_token), cuenta: c.wa_numero || null },
      },
      sondeo_at: c.bandeja_sondeo_at || null,
      estado,
      ultimo_webhook: ultimoWebhook,
      etapas: ETAPAS,
    });
  }

  // ── Conversaciones ──
  if (sub[0] === 'conversaciones' && sub.length === 1 && method === 'GET') {
    const c = await marcaDeMiWs(env, ws, qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const where = ['client_id = ?'];
    const binds = [c.id];
    const canal = qp('canal');
    if (CANALES_MSG.includes(canal)) { where.push('canal = ?'); binds.push(canal); }
    const etapa = qp('etapa');
    if (ETAPAS.includes(etapa)) { where.push('etapa = ?'); binds.push(etapa); }
    if (qp('archivadas') === '1') where.push('archivado = 1'); else where.push('archivado = 0');
    if (qp('sin_leer') === '1') where.push('no_leidos > 0');
    const q = qp('q').trim();
    if (q) { where.push('(nombre LIKE ? OR username LIKE ? OR contacto_id LIKE ? OR ultimo_texto LIKE ?)'); const like = `%${q}%`; binds.push(like, like, like, like); }
    const r = await env.DB.prepare(
      `SELECT id, canal, contacto_id, nombre, username, ultimo_texto, ultimo_en, ultimo_cliente_en, no_leidos, etapa, notas, seguimiento, archivado
         FROM mkt_conversaciones WHERE ${where.join(' AND ')} ORDER BY (no_leidos > 0) DESC, ultimo_en DESC LIMIT 200`
    ).bind(...binds).all();
    return json({ conversaciones: r.results || [] });
  }

  if (sub[0] === 'conversaciones' && sub.length >= 2) {
    const conv = await convDeMiWs(env, ws, sub[1]);
    if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
    const accion = sub[2] || '';

    if (!accion && method === 'GET') {
      const msgs = await env.DB.prepare(
        'SELECT id, mid, direccion, texto, adjunto_tipo, adjunto_url, adjunto_id, autor_nombre, estado, error, creado FROM mkt_mensajes WHERE conv_id = ? ORDER BY creado ASC, rowid ASC LIMIT 400'
      ).bind(conv.id).all();
      if (conv.no_leidos) await env.DB.prepare('UPDATE mkt_conversaciones SET no_leidos = 0 WHERE id = ?').bind(conv.id).run();
      const { client_id, ...resto } = conv;
      return json({ conversacion: { ...resto, client_id, no_leidos: 0 }, mensajes: (msgs.results || []).map((m) => ({ ...m, adjunto_url: m.adjunto_url || m.adjunto_id ? `/api/marketing/bandeja/adjunto/${m.id}` : null })) });
    }

    if (!accion && method === 'PATCH') {
      const b = await leerJson(request);
      const sets = [];
      const binds = [];
      if (b.etapa !== undefined) { if (!ETAPAS.includes(b.etapa)) return json({ error: 'Etapa inválida' }, 400); sets.push('etapa = ?'); binds.push(b.etapa); }
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
      return json({ ok: true });
    }

    if (accion === 'enviar' && method === 'POST') {
      const b = await leerJson(request);
      const texto = String(b.texto || '').trim();
      if (!texto) return json({ error: 'Escribe el mensaje.' }, 400);
      if (texto.length > 4000) return json({ error: 'El mensaje es demasiado largo (máximo 4000 caracteres).' }, 400);
      const c = await marca(env, conv.client_id);
      let mids;
      try {
        mids = await enviarTexto(c, conv, texto);
      } catch (e) {
        const ex = e.code === 'SIN_CANAL' ? { msg: e.message } : explicarError(e, conv.canal);
        await insertarMensaje(env, { convId: conv.id, direccion: 'out', texto, autorUserId: session.user_id, autorNombre: session.name, estado: 'error', error: ex.msg.slice(0, 300) });
        return json({ error: ex.msg, ventana: !!ex.ventana, permiso: !!ex.permiso }, 502);
      }
      // Un renglón por pieza enviada, con su mid (así el eco de Meta no duplica).
      const piezas = partirTexto(texto, LIM_TEXTO[conv.canal] || 1900);
      for (let i = 0; i < piezas.length; i++) {
        await insertarMensaje(env, { convId: conv.id, mid: mids[i] || null, direccion: 'out', texto: piezas[i], autorUserId: session.user_id, autorNombre: session.name, estado: 'enviado' });
      }
      await refrescarConv(env, conv.id, 0);
      await env.DB.prepare("UPDATE mkt_conversaciones SET no_leidos = 0, etapa = CASE WHEN etapa = 'nuevo' THEN 'platica' ELSE etapa END WHERE id = ?").bind(conv.id).run();
      return json({ ok: true, mids });
    }

    if (accion === 'sugerir' && method === 'POST') {
      const c = await marca(env, conv.client_id);
      const msgs = await env.DB.prepare('SELECT direccion, texto, adjunto_tipo FROM mkt_mensajes WHERE conv_id = ? ORDER BY creado DESC, rowid DESC LIMIT 12').bind(conv.id).all();
      const historial = (msgs.results || []).reverse().map((m) => `${m.direccion === 'in' ? 'Persona' : 'Marca'}: ${m.texto || textoDeAdjunto({ tipo: m.adjunto_tipo })}`).join('\n');
      if (!historial) return json({ error: 'Todavía no hay mensajes que contestar.' }, 400);
      try {
        const sugerencia = await sugerirRespuesta(env, c, { tipo: 'mensaje', canal: conv.canal, historial });
        return json({ sugerencia });
      } catch (e) { return json({ error: e.message || 'No se pudo sugerir.' }, 502); }
    }
    return json({ error: 'Not found' }, 404);
  }

  // ── Comentarios ──
  if (sub[0] === 'comentarios' && sub.length === 1 && method === 'GET') {
    const c = await marcaDeMiWs(env, ws, qp('client_id'));
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
    if (!cm) return json({ error: 'Comentario no encontrado' }, 404);
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
        return json({ error: ex.msg, permiso: !!ex.permiso }, 502);
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
          await insertarMensaje(env, { convId: cv.id, mid: r.dm.message_id || null, direccion: 'out', texto, autorUserId: session.user_id, autorNombre: session.name, estado: 'enviado' });
          await refrescarConv(env, cv.id, 0);
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
      catch (e) { const ex = explicarError(e, cm.canal); return json({ error: ex.msg, permiso: !!ex.permiso }, 502); }
      await env.DB.prepare('UPDATE mkt_comentarios SET oculto = ?, atendido = CASE WHEN ? THEN 1 ELSE atendido END WHERE id = ?').bind(oculto ? 1 : 0, oculto ? 1 : 0, cm.id).run();
      return json({ ok: true, oculto });
    }

    if (accion === 'sugerir' && method === 'POST') {
      try {
        const sugerencia = await sugerirRespuesta(env, c, { tipo: 'comentario', canal: cm.canal, texto: cm.texto, autor: cm.autor });
        return json({ sugerencia });
      } catch (e) { return json({ error: e.message || 'No se pudo sugerir.' }, 502); }
    }
    return json({ error: 'Not found' }, 404);
  }

  // ── Adjuntos: proxy con sesión (WhatsApp exige el token para bajar media) ──
  if (sub[0] === 'adjunto' && sub[1] && method === 'GET') {
    const m = await env.DB.prepare(
      `SELECT m.adjunto_url, m.adjunto_id, m.adjunto_tipo, v.client_id, v.canal FROM mkt_mensajes m
         JOIN mkt_conversaciones v ON v.id = m.conv_id JOIN mkt_clients c ON c.id = v.client_id
        WHERE m.id = ? AND COALESCE(c.workspace_id, 'ivae') = ?`
    ).bind(sub[1], ws).first();
    if (!m) return json({ error: 'Adjunto no encontrado' }, 404);
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
      return json({ error: 'No se pudo bajar el adjunto: ' + String(e && e.message).slice(0, 120) }, 502);
    }
  }

  // ── Sondear ahora (una marca) ──
  if (sub[0] === 'sondear' && method === 'POST') {
    const c = await marcaDeMiWs(env, ws, qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    try {
      const r = await sondearBandeja(env, { clientId: c.id });
      return json({ ok: true, resultado: r[0] || null });
    } catch (e) { return json({ error: (e && e.message) || 'Fallo del sondeo' }, 502); }
  }

  // ── Suscribir webhooks de una marca ──
  if (sub[0] === 'suscribir' && method === 'POST') {
    const c = await marcaDeMiWs(env, ws, qp('client_id'));
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

  // ── Seguimientos vencidos de hoy (para el aviso del cron) ──
  return json({ error: 'Not found' }, 404);
}

// Cada mañana (cron diario): un aviso por conversación con seguimiento para hoy
// o vencido, y se limpia la fecha para que no repita.
export async function avisarSeguimientos(env) {
  const hoy = fechaHoy();
  const r = await env.DB.prepare(
    `SELECT v.id, v.client_id, v.nombre, v.username, v.canal, v.seguimiento FROM mkt_conversaciones v WHERE v.seguimiento IS NOT NULL AND v.seguimiento <= ? LIMIT 100`
  ).bind(hoy).all();
  let n = 0;
  for (const v of r.results || []) {
    const c = await marca(env, v.client_id);
    if (!c) continue;
    await avisarStaff(env, c, {
      tipo: 'seguimiento',
      body: `Hoy toca dar seguimiento a ${v.nombre || (v.username ? '@' + v.username : v.canal)} (${nombreCanal(v.canal)}).`,
      link: `#/bandeja?cliente=${c.id}&conv=${v.id}`,
    });
    await env.DB.prepare('UPDATE mkt_conversaciones SET seguimiento = NULL WHERE id = ?').bind(v.id).run();
    n++;
  }
  return n;
}
