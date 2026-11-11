// ============================================================================
// AVISARLE A META QUIÉN RESERVÓ Y QUIÉN PAGÓ (Conversions API, 7-nov-2026).
// Vianey: "construye eso que nos falta: avisarle a Meta cada vez que alguien
// reserva". Es el motor de los anunciantes grandes: Meta aprende de quién de
// verdad compra, no de quién da clic, y busca más gente parecida.
//
// Qué se manda, al conjunto de datos "IVAE Studios Sitio" (1830358918394577):
//   · Schedule  → la persona tiene su sesión reservada (etapa cita o cliente).
//   · Purchase  → pagó (Stripe amarrado o ingreso registrado), con el monto.
// Con quién se amarra: el teléfono y el correo (en SHA-256, como pide Meta), el
// nombre, y si llegó desde un anuncio, el ctwa_clid (WhatsApp) o el id de
// Instagram / Messenger. Nada viaja en claro: Meta solo recibe los hashes.
//
// Cada evento sale UNA vez por persona (mkt_meta_eventos guarda el envío) y
// con event_id fijo, así que si se repite Meta lo descarta. Corre al final de
// la sincronización del Embudo (al abrirlo y cada 15 min desde el cron).
// Token: META_CAPI_TOKEN de Cloudflare si existe; si no, el token de la cuenta
// de anuncios que la app ya tiene (mkt_kv.ads_token, permiso ads_management).
//
// CHATS DE WHATSAPP QUE LLEGARON DE UN ANUNCIO (11-nov-2026). Israel: "Meta
// puede decir 3 conversaciones pero solo escribieron 2 y no se cerraron".
// Meta cuenta el primer mensaje y no sabe qué pasó después. Esos chats traen
// el clic de Meta (ctwa_clid) y se avisan por OTRO camino, el único que Meta
// amarra al anuncio: el conjunto de datos de la cuenta de WhatsApp, con el
// acceso de WhatsApp de la marca (usuario del sistema, no caduca).
//   · LeadSubmitted → lead real: la persona siguió escribiendo después del
//                     mensaje precargado (2 o más mensajes suyos).
//   · Purchase      → reservó (etapa cita o cliente). En mensajería Meta NO
//                     acepta "Schedule" (error 2804066, probado). La reserva es
//                     la venta: se paga el día de la sesión, casi siempre fuera
//                     de la ventana de 7 días del anuncio. Valor = lo pagado
//                     (MXN) o lo cotizado. En mkt_meta_eventos queda como
//                     'Schedule' para que la tarjeta diga "reservó".
// ============================================================================

const DATASET_FIJO = '1830358918394577';
const GRAPH = 'https://graph.facebook.com/v26.0';
const DIAS_ATRAS = 30;           // reservas y pagos más viejos no se mandan
const TOPE_EVENT_TIME = 6;       // Meta no acepta event_time de más de 7 días

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function soloDigitos(t) { const d = String(t || '').replace(/\D/g, ''); return d.length >= 10 ? d : null; }
function segundos(fecha, ahora) {
  const t = Date.parse(String(fecha || '').replace(' ', 'T') + (String(fecha || '').length <= 19 ? 'Z' : ''));
  if (!t) return Math.floor(ahora / 1000);
  const tope = ahora - TOPE_EVENT_TIME * 864e5;
  return Math.floor(Math.max(t, tope) / 1000);
}
function origenDeConv(v) {
  try { return v.origen ? JSON.parse(v.origen) : null; } catch { return null; }
}

// El conjunto de datos de la cuenta de WhatsApp. Se anota en mkt_kv.meta_dataset_wa
// ({ waba: dataset }); si falta, se le pregunta a Meta. Aquí no se crea: crearlo
// es una decisión, no un efecto de barrer.
async function datasetWa(env, c) {
  const waba = String(c.wa_waba_id || '');
  if (!waba || !c.wa_access_token) return null;
  let mapa = {};
  try {
    const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'meta_dataset_wa'").first();
    if (r && r.value) mapa = JSON.parse(r.value) || {};
  } catch { /* se pregunta a Meta */ }
  if (mapa[waba]) return String(mapa[waba]);
  try {
    const r = await fetch(`${GRAPH}/${waba}/dataset?access_token=${encodeURIComponent(c.wa_access_token)}`);
    const j = await r.json().catch(() => ({}));
    const id = (j && j.data && j.data[0] && j.data[0].id) || (j && j.id) || null;
    if (!id) return null;
    mapa[waba] = String(id);
    await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind('meta_dataset_wa', JSON.stringify(mapa)).run().catch(() => {});
    return String(id);
  } catch { return null; }
}

async function tokenMeta(env) {
  if (env.META_CAPI_TOKEN) return env.META_CAPI_TOKEN;
  const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'ads_token'").first().catch(() => null);
  if (!r || !r.value) return null;
  try { const j = JSON.parse(r.value); return j.t || null; } catch { return r.value; }
}

// Los datos de la persona, como los pide Meta (teléfono, correo y nombre en SHA-256).
async function userData(v) {
  const u = {};
  // Un contacto de WhatsApp con el número oculto trae un identificador (CA.123…), no un teléfono.
  const esTelWa = v.canal === 'whatsapp' && !/^[A-Za-z]{2}\./.test(String(v.contacto_id || ''));
  const tel = soloDigitos(v.telefono) || (esTelWa ? soloDigitos(v.contacto_id) : null);
  if (tel) u.ph = [await sha256(tel)];
  const correo = String(v.correo || (v.canal === 'correo' ? v.contacto_id : '') || '').trim().toLowerCase();
  if (correo.includes('@')) u.em = [await sha256(correo)];
  const partes = String(v.nombre || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter((p) => p && !p.includes('@'));
  if (partes.length >= 2) { u.fn = [await sha256(partes[0])]; u.ln = [await sha256(partes[partes.length - 1])]; }
  u.external_id = [await sha256(v.id)];
  return u;
}

// 'business_messaging' solo vale con el conjunto de datos del canal y su clic de
// anuncio (eso va por eventosWhatsAppDeAnuncio) y no acepta 'Schedule'. Lo demás
// se manda como conversación o correo, amarrado por teléfono y correo.
function fuenteDe(v) {
  if (v.canal === 'correo') return { action_source: 'email' };
  if (v.canal === 'whatsapp' || v.canal === 'instagram' || v.canal === 'messenger') return { action_source: 'chat' };
  return { action_source: 'other' };
}

export async function enviarEventosMeta(env, eventos, { test, dataset: ds, token } = {}) {
  const tok = token || await tokenMeta(env);
  if (!tok) return { ok: false, error: 'sin token' };
  const dataset = ds || env.META_DATASET_ID || DATASET_FIJO;
  const body = { data: eventos };
  if (test) body.test_event_code = test;
  const r = await fetch(`${GRAPH}/${dataset}/events?access_token=${encodeURIComponent(tok)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: (j.error && j.error.message) || `HTTP ${r.status}` };
  return { ok: true, recibidos: j.events_received };
}

// Chats de WhatsApp que llegaron de un anuncio: lead real y reserva.
async function eventosWhatsAppDeAnuncio(env, c, desde, ahora, hechos, pagos) {
  const r = await env.DB.prepare(
    `SELECT v.id, v.etapa, v.etapa_en, v.origen, v.valor_estimado, v.moneda, v.ultimo_cliente_en, v.created_at,
            (SELECT COUNT(*) FROM mkt_mensajes m WHERE m.conv_id = v.id AND m.direccion = 'in') AS entrantes
       FROM mkt_conversaciones v
      WHERE v.client_id = ? AND v.archivado = 0 AND v.canal = 'whatsapp' AND v.origen LIKE '%ctwa_clid%'
        AND COALESCE(v.ultimo_cliente_en, v.created_at) >= ?`
  ).bind(c.id, desde).all().catch(() => ({ results: [] }));
  const out = [];
  for (const v of r.results || []) {
    const o = origenDeConv(v);
    if (!o || !o.ctwa_clid) continue;
    const base = {
      action_source: 'business_messaging', messaging_channel: 'whatsapp',
      user_data: { whatsapp_business_account_id: String(c.wa_waba_id), ctwa_clid: String(o.ctwa_clid) },
    };
    if (Number(v.entrantes) >= 2 && !hechos.has(v.id + ':LeadSubmitted')) {
      out.push({ conv: v, evento: 'LeadSubmitted', valor: null,
        ev: { ...base, event_name: 'LeadSubmitted', event_time: segundos(v.ultimo_cliente_en || v.created_at, ahora), event_id: `LeadSubmitted:${v.id}` } });
    }
    if ((v.etapa === 'cita' || v.etapa === 'cliente') && !hechos.has(v.id + ':Schedule')) {
      const p = pagos.get(v.id);
      const valor = p && p.mxn > 0
        ? { currency: 'MXN', value: Math.round(p.mxn * 100) / 100 }
        : (Number(v.valor_estimado) > 0 ? { currency: String(v.moneda || 'USD').toUpperCase(), value: Number(v.valor_estimado) } : null);
      if (!valor) continue; // sin monto no es una venta que Meta pueda aprender; se manda cuando la oportunidad tenga valor
      out.push({ conv: v, evento: 'Schedule', valor: valor.currency === 'MXN' ? valor.value : null,
        ev: { ...base, event_name: 'Purchase', event_time: segundos(v.etapa_en, ahora), event_id: `Reserva:${v.id}`, custom_data: { ...valor, content_name: 'Sesión de fotos' } } });
    }
  }
  return out;
}

async function anotarEnvio(env, c, convId, evento, eventId, valor, resultado) {
  await env.DB.prepare(
    `INSERT INTO mkt_meta_eventos (id, client_id, conv_id, evento, event_id, valor_mxn, enviado_en, ok, respuesta)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
     ON CONFLICT(conv_id, evento) DO UPDATE SET enviado_en = datetime('now'), ok = excluded.ok, respuesta = excluded.respuesta, valor_mxn = excluded.valor_mxn`
  ).bind('me' + crypto.randomUUID().replace(/-/g, '').slice(0, 20), c.id, convId, evento, eventId, valor, resultado.ok ? 1 : 0,
    resultado.ok ? `recibidos ${resultado.recibidos}` : String(resultado.error || '').slice(0, 300)).run().catch(() => {});
}

// El barrido: leads reales, reservas y pagos recientes que Meta todavía no conoce.
export async function avisarMetaReservas(env, c) {
  const ahora = Date.now();
  const desde = new Date(ahora - DIAS_ATRAS * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  const [convsR, hechosR, cobrosR, ventasR] = await Promise.all([
    env.DB.prepare(
      `SELECT id, canal, contacto_id, nombre, correo, telefono, etapa, etapa_en, fecha_cita, origen
         FROM mkt_conversaciones WHERE client_id = ? AND archivado = 0 AND etapa IN ('cita', 'cliente') AND COALESCE(etapa_en, updated_at) >= ?`
    ).bind(c.id, desde).all(),
    // Sin la tabla (migración 050 pendiente) no se manda nada: si no, cada
    // barrido repetiría los mismos eventos sin poder anotarlos.
    env.DB.prepare('SELECT conv_id, evento FROM mkt_meta_eventos WHERE ok = 1').all().catch(() => null),
    env.DB.prepare(
      'SELECT cc.conv_id, cs.creado, cs.monto_mxn, cs.neto_mxn, cs.monto, cs.moneda FROM mkt_cobros_conv cc JOIN cobros_sesion cs ON cs.id = cc.cobro_id WHERE cs.creado >= ?'
    ).bind(desde).all().catch(() => ({ results: [] })),
    env.DB.prepare(
      "SELECT conv_id, fecha, monto_mxn FROM mkt_neg_ventas WHERE client_id = ? AND estado = 'cerrada' AND conv_id IS NOT NULL AND cobro_id IS NULL AND monto_mxn > 0 AND fecha >= ?"
    ).bind(c.id, desde.slice(0, 10)).all().catch(() => ({ results: [] })),
  ]);
  if (!hechosR) return { ok: false, enviados: 0, error: 'falta la tabla mkt_meta_eventos (migración 050)' };
  const hechos = new Set((hechosR.results || []).map((h) => h.conv_id + ':' + h.evento));
  const pagos = new Map(); // conv_id → { mxn, cuando }
  for (const f of cobrosR.results || []) {
    const mxn = Number(f.monto_mxn) || (String(f.moneda).toUpperCase() === 'MXN' ? (Number(f.monto) || 0) / 100 : 0);
    const p = pagos.get(f.conv_id) || { mxn: 0, cuando: f.creado };
    p.mxn += mxn; if (String(f.creado) > String(p.cuando)) p.cuando = f.creado; pagos.set(f.conv_id, p);
  }
  for (const f of ventasR.results || []) {
    const p = pagos.get(f.conv_id) || { mxn: 0, cuando: f.fecha };
    p.mxn += Number(f.monto_mxn) || 0; if (String(f.fecha) > String(p.cuando)) p.cuando = f.fecha; pagos.set(f.conv_id, p);
  }

  // a) WhatsApp que llegó de un anuncio → conjunto de datos de la cuenta de WhatsApp.
  const whatsapp = { enviados: 0, error: null };
  if (c.wa_waba_id && c.wa_access_token) {
    const wa = await eventosWhatsAppDeAnuncio(env, c, desde, ahora, hechos, pagos).catch(() => []);
    if (wa.length) {
      const dataset = await datasetWa(env, c);
      let res;
      if (!dataset) res = { ok: false, error: 'la cuenta de WhatsApp no tiene conjunto de datos en Meta' };
      else {
        try { res = await enviarEventosMeta(env, wa.map((e) => e.ev), { dataset, token: c.wa_access_token }); }
        catch (err) { res = { ok: false, error: (err && err.message) || 'fallo' }; }
      }
      for (const e of wa) await anotarEnvio(env, c, e.conv.id, e.evento, e.ev.event_id, e.valor, res);
      whatsapp.enviados = res.ok ? wa.length : 0; whatsapp.error = res.ok ? null : (res.error || 'fallo');
    }
  }

  // b) Lo demás (correo, WhatsApp e Instagram sin clic de anuncio) → conjunto de datos de la cuenta de anuncios.
  const porEnviar = []; // { conv, evento, valor, cuando }
  for (const v of convsR.results || []) {
    const o = origenDeConv(v);
    if (v.canal === 'whatsapp' && o && o.ctwa_clid) continue; // ya salió por (a)
    if (!hechos.has(v.id + ':Schedule')) porEnviar.push({ conv: v, evento: 'Schedule', valor: null, cuando: v.etapa_en });
    const p = pagos.get(v.id);
    if (p && p.mxn > 0 && !hechos.has(v.id + ':Purchase')) porEnviar.push({ conv: v, evento: 'Purchase', valor: Math.round(p.mxn * 100) / 100, cuando: p.cuando });
  }
  const eventos = [];
  for (const e of porEnviar) {
    const u = await userData(e.conv);
    if (!u.ph && !u.em) continue; // sin con qué amarrar, no sirve
    const ev = {
      event_name: e.evento, event_time: segundos(e.cuando, ahora), event_id: `${e.evento}:${e.conv.id}`,
      ...fuenteDe(e.conv), user_data: u,
    };
    if (e.evento === 'Purchase') ev.custom_data = { currency: 'MXN', value: e.valor, content_name: 'Sesión de fotos' };
    eventos.push(ev); e.event_id = ev.event_id;
  }
  if (!eventos.length) return { ok: !whatsapp.error, enviados: whatsapp.enviados, whatsapp, error: whatsapp.error };
  let resultado;
  try { resultado = await enviarEventosMeta(env, eventos); }
  catch (err) { resultado = { ok: false, error: (err && err.message) || 'fallo' }; }
  for (const e of porEnviar) {
    if (!e.event_id) continue;
    await anotarEnvio(env, c, e.conv.id, e.evento, e.event_id, e.valor, resultado);
  }
  return { ok: resultado.ok && !whatsapp.error, enviados: (resultado.ok ? eventos.length : 0) + whatsapp.enviados, whatsapp, error: resultado.error || whatsapp.error || null };
}

// Para la tarjeta de la oportunidad: qué le avisamos a Meta de esta persona.
export async function avisosMetaDe(env, convIds) {
  const out = new Map();
  if (!convIds.length) return out;
  const qs = convIds.map(() => '?').join(',');
  const r = await env.DB.prepare(`SELECT conv_id, evento, enviado_en, ok FROM mkt_meta_eventos WHERE conv_id IN (${qs})`).bind(...convIds).all().catch(() => ({ results: [] }));
  for (const f of r.results || []) {
    if (!out.has(f.conv_id)) out.set(f.conv_id, {});
    const que = f.evento === 'Schedule' ? 'reserva' : (f.evento === 'LeadSubmitted' ? 'lead' : 'pago');
    out.get(f.conv_id)[que] = { en: f.enviado_en, ok: !!f.ok };
  }
  return out;
}
