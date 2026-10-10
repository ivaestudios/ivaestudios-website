// ============================================================================
// IVAE Marketing — LLAMADAS GRABADAS desde la Bandeja (CRM).
//
// Pedido de Sebas (SMILE NOW) vía Israel, 10-oct-2026: "¿podemos añadir lo de
// grabar las llamadas?". Hasta hoy el agente llamaba desde su celular (tel:) y
// solo anotaba el resultado; nada se grababa.
//
// Cómo funciona (llamada PUENTE, pensada para el teléfono del agente):
//   1. El agente toca "Llamar con la línea" en el chat del paciente.
//   2. Twilio llama al CELULAR DEL AGENTE mostrando el número de la clínica.
//      Al contestar oye "Llamada de SMILE NOW para Ana. Presiona cualquier
//      tecla para marcarle" (la tecla evita que el buzón del agente se quede
//      hablando con el paciente).
//   3. Twilio marca al paciente con el número de la clínica. Al contestar, el
//      paciente oye el aviso de grabación y queda en línea con el agente.
//   4. La llamada se graba en dos canales. Al colgar, el audio se copia a R2
//      (y se borra de Twilio), Gemini lo transcribe con quién dijo qué, hace
//      un resumen y sugiere el resultado (contestó, agendó cita, buzón…).
//   5. Queda en el chat del paciente y en el panel del supervisor; el
//      dashboard cuenta la llamada a nombre del agente con sus minutos reales.
//
// Entrantes: si la línea es un número de Twilio, cuando el paciente devuelve
// la llamada suena el celular de SU agente (o de todos los disponibles), con
// el mismo aviso y grabación. Si nadie contesta: desvío opcional y después
// buzón de voz, que también se transcribe y se avisa al equipo.
//
// Cada marca conecta SU cuenta de Twilio (Account SID + Auth Token + número):
// nada se mezcla entre marcas ni agencias. Los webhooks de Twilio llegan sin
// cookie y se validan con la firma X-Twilio-Signature (HMAC-SHA1 con el Auth
// Token de la marca dueña de la llamada).
// ============================================================================
import { saJson, tokenGoogle } from './_imagen.js';
import { ACTIVOS, CFG_LINEA_BASE, fmtTel, lineaConectada, cfgLineaDe, resumenLinea, llamadaPublica } from './_llamadas-comun.js';
import {
  marca, cfgDe, guardarCfg, registrarEvento, asignar, avisarUsuarios, avisarStaff,
  convDe, convDeMiWs, marcaDeMiWs, leerJson, nombreComercial, RESULTADOS_LLAMADA,
} from './_bandeja.js';

const TW_API = 'https://api.twilio.com/2010-04-01';
// Twilio necesita una URL pública fija para pedir instrucciones (TwiML).
const BASE_PUBLICA = 'https://ivaestudios.com';
const RUTA_TW = '/api/marketing/llamadas/tw/';
const VOZ = 'Polly.Mia';
const IDIOMA_VOZ = 'es-MX';
const R2_PREFIJO = 'marketing/llamadas';
const MODELO_GEMINI = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const TOPE_INLINE = 19 * 1024 * 1024;
const MAX_INTENTOS = 4;
// Motor principal de transcripción: Whisper en Cloudflare Workers AI (binding
// AI del proyecto, centavos por hora de audio). Twilio entrega la grabación en
// WAV de DOS canales (agente y paciente por separado): cada lado se transcribe
// aparte y los turnos salen exactos, sin adivinar quién habló. Claude hace el
// resumen. Gemini (Vertex) queda de respaldo.
const MODELO_WHISPER = '@cf/openai/whisper-large-v3-turbo';
const MODELO_RESUMEN = 'claude-haiku-4-5-20251001';
const TRAMO_SEG = 180;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const escXml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function twiml(cuerpo) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>`, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
}
const say = (t) => `<Say voice="${VOZ}" language="${IDIOMA_VOZ}">${escXml(t)}</Say>`;
const vacio = () => new Response(null, { status: 204 });
// URL de un webhook de Twilio para una llamada (con & escapado para el XML).
function u(accion, id, extra = {}) {
  const q = new URLSearchParams({ l: id, ...extra });
  return `${BASE_PUBLICA}${RUTA_TW}${accion}?${q.toString()}`;
}
const ua = (accion, id, extra) => escXml(u(accion, id, extra));

// ── Teléfonos ────────────────────────────────────────────────────────────────
// A E.164. Diez dígitos = México (+52). El "1" viejo de celular (521 + 10, el
// formato con el que WhatsApp nombra a los mexicanos) se quita para marcar.
export function aE164(entrada) {
  const s = String(entrada || '').trim();
  if (!s) return null;
  let d = s.replace(/\D/g, '');
  if (s.startsWith('00')) d = d.slice(2);
  else if (!s.startsWith('+') && d.length === 10) d = '52' + d;
  if (d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3);
  if (d.length < 8 || d.length > 15) return null;
  return '+' + d;
}
// El id con el que WhatsApp nombra a ese número (México lleva el 1).
function waIdDe(e164) {
  const d = String(e164 || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('52') ? '521' + d.slice(2) : d;
}
export function telefonoDeConv(v) {
  if (!v) return null;
  if (v.telefono) return aE164(v.telefono);
  if (v.canal === 'whatsapp' && v.contacto_id) return aE164('+' + v.contacto_id);
  return null;
}
function nombrePaciente(v) {
  if (!v) return '';
  return String(v.nombre || (v.username ? v.username : '')).split(/\s+/).slice(0, 2).join(' ');
}

// ── Cliente de la API de Twilio ──────────────────────────────────────────────
// form = lista de pares (Twilio acepta claves repetidas).
async function tw(cred, ruta, { method = 'GET', form = null } = {}) {
  const url = ruta.startsWith('https://') ? ruta : `${TW_API}/Accounts/${cred.sid}${ruta}`;
  const headers = { authorization: 'Basic ' + btoa(`${cred.sid}:${cred.token}`) };
  let body;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    const p = new URLSearchParams();
    for (const [k, v] of form) if (v !== undefined && v !== null) p.append(k, String(v));
    body = p.toString();
  }
  let res;
  try { res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20000) }); }
  catch (e) { const err = new Error('Twilio no respondió: ' + (e && e.message)); err.code = 'RED'; throw err; }
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.code = data.code; err.status = res.status;
    throw err;
  }
  return data;
}
const credDe = (c) => ({ sid: c.tw_account_sid, token: c.tw_auth_token });

// Errores de Twilio en palabras que Vianey o el agente puedan resolver.
export function explicarTwilio(e) {
  const code = Number(e && e.code);
  const msg = String((e && e.message) || e || '');
  if (code === 20003 || (e && e.status === 401)) return 'Twilio no acepta esas credenciales: revisa el Account SID y el Auth Token.';
  if (code === 21219) return 'La cuenta de Twilio sigue en prueba: solo puede llamar a números verificados. Agrega saldo en Twilio para llamar a cualquier número.';
  if (code === 21215 || code === 13227) return 'Twilio no tiene permiso para llamar a ese país. Actívalo en Twilio: Voice → Settings → Geo permissions (México).';
  if (code === 21210 || code === 21212) return 'El número de la línea no está verificado en Twilio. Revisa la conexión en Ajustes.';
  if (code === 21211 || code === 21217 || code === 21214 || code === 13223 || code === 13224) return 'Ese número no es válido para llamar. Escríbelo con lada, por ejemplo 998 123 4567.';
  if (code === 20429 || (e && e.status === 429)) return 'Twilio pidió esperar un momento. Intenta de nuevo en unos segundos.';
  if (code === 20005 || code === 30006) return 'La cuenta de Twilio está suspendida o sin saldo.';
  if (e && e.code === 'RED') return msg;
  return 'Twilio rechazó la llamada: ' + msg.slice(0, 200);
}

// ── Firma de los webhooks (X-Twilio-Signature) ───────────────────────────────
function b64(bytes) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < a.length; i += 0x8000) out += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(out);
}
async function firmaValida(token, url, params, firma) {
  if (!token || !firma) return false;
  let s = url;
  for (const k of Object.keys(params).sort()) s += k + params[k];
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const esperada = b64(await crypto.subtle.sign('HMAC', key, enc.encode(s)));
  if (esperada.length !== firma.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  return dif === 0;
}

// ── Configuración de la línea por marca ──────────────────────────────────────
const cfgLinea = cfgLineaDe;
async function marcaPorLinea(env, numero) {
  const n = aE164(numero);
  if (!n) return null;
  return env.DB.prepare('SELECT id FROM mkt_clients WHERE tw_numero = ? AND tw_auth_token IS NOT NULL LIMIT 1').bind(n).first()
    .then((r) => (r ? marca(env, r.id) : null));
}

// ── Filas ────────────────────────────────────────────────────────────────────
async function filaLlamada(env, id) {
  return id ? env.DB.prepare('SELECT * FROM mkt_llamadas WHERE id = ?').bind(id).first() : null;
}
async function actualizar(env, id, campos) {
  const ks = Object.keys(campos);
  if (!ks.length) return;
  await env.DB.prepare(`UPDATE mkt_llamadas SET ${ks.map((k) => `${k} = ?`).join(', ')}, actualizado = datetime('now') WHERE id = ?`)
    .bind(...ks.map((k) => campos[k]), id).run();
}
function parseJson(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

// Cierra la llamada: estado final + evento 'llamada' (el que cuenta el
// dashboard por agente). Idempotente: si ya tiene evento, solo actualiza.
async function cerrarLlamada(env, c, fila, { estado, duracion = 0, resultado }) {
  const minutos = duracion > 0 ? Math.ceil(duracion / 60) : 0;
  await actualizar(env, fila.id, { estado, duracion_seg: duracion || 0, terminada_en: new Date().toISOString().slice(0, 19).replace('T', ' ') });
  if (fila.evento_id || !fila.conv_id) {
    if (!fila.resultado) await actualizar(env, fila.id, { resultado, resultado_por: 'auto' });
    return;
  }
  const dato = { resultado, minutos, nota: null, llamada_id: fila.id, grabada: estado === 'terminada', auto: true, entrante: fila.direccion === 'entrante' || undefined };
  const eventoId = await registrarEvento(env, { clientId: fila.client_id, convId: fila.conv_id, userId: fila.user_id, userNombre: fila.user_nombre, tipo: 'llamada', dato });
  await actualizar(env, fila.id, { resultado, resultado_por: 'auto', evento_id: eventoId });
  // El agente que habló con un paciente sin dueño se lo queda.
  if (estado === 'terminada' && fila.user_id) {
    try {
      const v = await env.DB.prepare('SELECT asignado_a FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first();
      const u = await env.DB.prepare("SELECT id, name, role, bandeja_rol FROM mkt_users WHERE id = ?").bind(fila.user_id).first();
      if (v && !v.asignado_a && u && u.role === 'client' && u.bandeja_rol === 'agente') await asignar(env, c, fila.conv_id, { id: u.id, name: u.name }, { tipo: 'tomada' });
    } catch { /* la asignación es un extra */ }
  }
}

// Cambia el resultado (lo sugiere la IA o lo confirma el agente) y lo refleja
// en el evento del dashboard. "Agendó cita" confirmado por una persona mueve
// la etapa del chat, igual que el registro manual.
async function aplicarResultado(env, fila, { resultado, por, nota, session = null }) {
  const campos = { resultado, resultado_por: por };
  if (nota !== undefined) campos.nota = nota;
  await actualizar(env, fila.id, campos);
  if (fila.evento_id) {
    const ev = await env.DB.prepare('SELECT dato FROM mkt_bandeja_eventos WHERE id = ?').bind(fila.evento_id).first();
    const dato = { ...(parseJson(ev && ev.dato) || {}), resultado, auto: por !== 'agente' };
    if (nota !== undefined) dato.nota = nota;
    await env.DB.prepare('UPDATE mkt_bandeja_eventos SET dato = ? WHERE id = ?').bind(JSON.stringify(dato), fila.evento_id).run();
  }
  if (por === 'agente' && resultado === 'cita' && fila.conv_id) {
    const v = await env.DB.prepare('SELECT etapa FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first();
    if (v && v.etapa !== 'cita' && v.etapa !== 'cliente') {
      await env.DB.prepare("UPDATE mkt_conversaciones SET etapa = 'cita', updated_at = datetime('now') WHERE id = ?").bind(fila.conv_id).run();
      await registrarEvento(env, { clientId: fila.client_id, convId: fila.conv_id, userId: session ? session.user_id : fila.user_id, userNombre: session ? session.name : fila.user_nombre, tipo: 'etapa', dato: { de: v.etapa, a: 'cita' } });
    }
  }
}

// ── Grabación → R2 → transcripción ──────────────────────────────────────────
function textoGemini(data) {
  const cand = data && data.candidates && data.candidates[0];
  return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
}
function extraerJson(texto) {
  const s = String(texto || '').trim();
  const i = s.indexOf('{'); const j = s.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('La IA no devolvió la transcripción en el formato esperado.');
  return JSON.parse(s.slice(i, j + 1));
}
async function geminiAudio(env, bytes, mime, prompt) {
  if (bytes.byteLength > TOPE_INLINE) throw new Error('La grabación es demasiado larga para transcribirla de una vez.');
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64(bytes) } }, { text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 24000, thinkingConfig: { thinkingBudget: 0 } },
  };
  const errores = [];
  if (saJson(env)) {
    const sa = saJson(env);
    const tok = await tokenGoogle(env);
    for (const loc of ['us-central1', 'global']) {
      const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
      const res = await fetch(`https://${host}/v1/projects/${sa.project_id}/locations/${loc}/publishers/google/models/${MODELO_GEMINI}:generateContent`, {
        method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(170000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return extraerJson(textoGemini(data));
      errores.push((data.error && data.error.message) || `HTTP ${res.status}`);
      if (res.status !== 404) break;
    }
  }
  const key = env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim();
  if (key) {
    const res = await fetch(`${GEMINI_BASE}/v1beta/models/${MODELO_GEMINI}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(170000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return extraerJson(textoGemini(data));
    errores.push((data.error && data.error.message) || `HTTP ${res.status}`);
  }
  if (!errores.length) { const e = new Error('Falta conectar Google (GOOGLE_SA_JSON o GEMINI_API_KEY) para transcribir.'); e.code = 'SIN_IA'; throw e; }
  throw new Error('Gemini no pudo transcribir: ' + errores.join(' · ').slice(0, 300));
}

// ── WAV de Twilio → canales → Whisper ────────────────────────────────────────
function muLawA16(b) {
  const u = ~b & 0xff;
  let t = ((u & 0x0f) << 3) + 0x84;
  t <<= (u & 0x70) >> 4;
  return (u & 0x80) ? (0x84 - t) : (t - 0x84);
}
function aLawA16(b) {
  let a = b ^ 0x55;
  let t = (a & 0x0f) << 4;
  const seg = (a & 0x70) >> 4;
  if (seg === 0) t += 8; else if (seg === 1) t += 0x108; else t = (t + 0x108) << (seg - 1);
  return (a & 0x80) ? t : -t;
}
// Devuelve { rate, canales: [Int16Array, …] }. Acepta PCM 16 bits, mu-law y a-law.
export function leerWav(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (u8.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('La grabación no es un WAV válido.');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= u8.byteLength) {
    const id = tag(off); const size = dv.getUint32(off + 4, true); const cuerpo = off + 8;
    if (id === 'fmt ') fmt = { formato: dv.getUint16(cuerpo, true), canales: dv.getUint16(cuerpo + 2, true), rate: dv.getUint32(cuerpo + 4, true), bits: dv.getUint16(cuerpo + 14, true) };
    else if (id === 'data') { data = { off: cuerpo, len: Math.min(size, u8.byteLength - cuerpo) }; break; }
    off = cuerpo + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('El WAV no trae formato o datos.');
  let formato = fmt.formato;
  if (formato === 0xfffe) formato = fmt.bits === 8 ? 7 : 1; // WAVE_FORMAT_EXTENSIBLE: lo habitual
  const nc = Math.max(1, fmt.canales);
  const bps = fmt.bits / 8;
  const n = Math.floor(data.len / (bps * nc));
  const canales = Array.from({ length: nc }, () => new Int16Array(n));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const o = data.off + (i * nc + c) * bps;
      let v;
      if (formato === 1 && fmt.bits === 16) v = dv.getInt16(o, true);
      else if (formato === 7) v = muLawA16(u8[o]);
      else if (formato === 6) v = aLawA16(u8[o]);
      else if (formato === 1 && fmt.bits === 8) v = (u8[o] - 128) << 8;
      else throw new Error(`Formato de audio no soportado (${fmt.formato}/${fmt.bits} bits).`);
      canales[c][i] = v;
    }
  }
  return { rate: fmt.rate, canales };
}
function wavMono(muestras, rate) {
  const buf = new ArrayBuffer(44 + muestras.length * 2);
  const dv = new DataView(buf);
  const w = (o, t) => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + muestras.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, muestras.length * 2, true);
  new Int16Array(buf, 44).set(muestras);
  return new Uint8Array(buf);
}
// Frases de un canal: cuadros de 20 ms con energía de voz (umbral sobre el
// ruido de fondo de ESA llamada), unidos si la pausa es menor a 0.8 s, con un
// colchón de 0.3 s. Cada frase va sola a Whisper: los límites de cada turno
// salen exactos y el lado callado nunca se manda (en silencio Whisper inventa).
export function frasesDeVoz(m, rate) {
  const cuadro = Math.max(80, Math.round(rate / 50));
  const n = Math.floor(m.length / cuadro);
  if (!n) return [];
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let suma = 0;
    for (let j = f * cuadro; j < (f + 1) * cuadro; j++) suma += m[j] * m[j];
    rms[f] = Math.sqrt(suma / cuadro);
  }
  const orden = Array.from(rms).sort((a, b) => a - b);
  const umbral = Math.max(350, (orden[Math.floor(n * 0.2)] || 0) * 3);
  const juntar = (pausaCuadros) => {
    const regs = [];
    let ini = -1, ult = -1;
    for (let f = 0; f < n; f++) {
      if (rms[f] > umbral) { if (ini < 0) ini = f; ult = f; }
      else if (ini >= 0 && f - ult > pausaCuadros) { regs.push([ini, ult]); ini = -1; }
    }
    if (ini >= 0) regs.push([ini, ult]);
    return regs.filter(([a, b]) => b - a + 1 >= 12);
  };
  let regs = juntar(40);
  if (regs.length > 220) regs = juntar(150); // llamada larguísima: menos pedazos
  const frases = [];
  const maxCuadros = 120 * 50;
  for (const [a, b] of regs) {
    for (let x = a; x <= b; x += maxCuadros) {
      const y = Math.min(b, x + maxCuadros - 1);
      frases.push([Math.max(0, (x - 15) * cuadro), Math.min(m.length, (y + 16) * cuadro)]);
    }
  }
  return frases;
}
const ALUCINACIONES = /suscr[ií]b|gracias por ver|subt[ií]tulos|amara\.org/i;
async function whisperFrase(env, muestras, rate, idioma) {
  const entrada = { audio: b64(wavMono(muestras, rate)) };
  if (idioma) entrada.language = idioma;
  const r = await env.AI.run(MODELO_WHISPER, entrada);
  let texto = String((r && r.text) || '').trim();
  if (ALUCINACIONES.test(texto) && texto.length < 60) texto = '';
  return { texto, idioma: (r && r.transcription_info && r.transcription_info.language) || null };
}
// Todas las frases de todos los canales, de 4 en 4. El idioma se detecta con
// la frase más larga y se fija para el resto (en frases cortas Whisper duda).
async function whisperCanales(env, canales, rate, quienes) {
  const trabajos = [];
  canales.forEach((m, c) => { for (const [a, b] of frasesDeVoz(m, rate)) trabajos.push({ c, a, b }); });
  if (!trabajos.length) return [];
  let largo = 0;
  trabajos.forEach((t, k) => { if (t.b - t.a > trabajos[largo].b - trabajos[largo].a) largo = k; });
  const res = new Array(trabajos.length);
  const t0 = trabajos[largo];
  const prim = await whisperFrase(env, canales[t0.c].subarray(t0.a, t0.b), rate, null);
  res[largo] = prim.texto;
  const idioma = prim.idioma;
  let sig = 0;
  const trabajador = async () => {
    while (sig < trabajos.length) {
      const k = sig++;
      if (k === largo) continue;
      const t = trabajos[k];
      res[k] = (await whisperFrase(env, canales[t.c].subarray(t.a, t.b), rate, idioma)).texto;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, trabajos.length) }, trabajador));
  return trabajos.map((t, k) => (res[k] ? { ini: t.a / rate, fin: t.b / rate, texto: res[k], quien: quienes[t.c] || 'agente' } : null)).filter(Boolean);
}
// Los tramos de cada lado, en orden de tiempo, juntando lo seguido del mismo.
function armarTurnos(segs) {
  const orden = segs.slice().sort((a, b) => a.ini - b.ini);
  const turnos = [];
  for (const s of orden) {
    const ult = turnos[turnos.length - 1];
    if (ult && ult.quien === s.quien) ult.texto += ' ' + s.texto;
    else turnos.push({ quien: s.quien, texto: s.texto });
  }
  return turnos;
}
async function claudeJson(env, system, user, maxTokens = 900) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO_RESUMEN, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Claude no pudo resumir: ' + ((data.error && data.error.message) || `HTTP ${res.status}`));
  return extraerJson(((data.content || []).map((x) => x.text || '').join('')));
}
async function transcribirConWhisper(env, wavBytes, { marcaNombre, fila, paciente }) {
  const { rate, canales } = leerWav(wavBytes);
  let turnos;
  let etiquetar = false;
  if (fila.buzon) {
    turnos = armarTurnos(await whisperCanales(env, [canales[0]], rate, ['paciente']));
  } else if (canales.length >= 2) {
    // Twilio graba la pierna principal en el canal 1: en las salientes es el
    // agente; en las entrantes, el paciente que llamó.
    const quienes = fila.direccion === 'entrante' ? ['paciente', 'agente'] : ['agente', 'paciente'];
    turnos = armarTurnos(await whisperCanales(env, canales.slice(0, 2), rate, quienes));
  } else {
    turnos = (await whisperCanales(env, [canales[0]], rate, ['agente'])).map((x) => ({ quien: 'agente', texto: x.texto }));
    etiquetar = true;
  }
  const base = { turnos, resumen: '', resultado: turnos.length ? '' : 'no_contesto', cita: '', siguiente_paso: '', temas: [], motor: 'whisper' };
  if (!turnos.length) return base;
  const agente = fila.user_nombre || 'el agente';
  const texto = turnos.map((x, i) => (etiquetar ? `${i + 1}. ` : '') + (etiquetar ? x.texto : `${x.quien === 'paciente' ? 'Paciente' : 'Agente'}: ${x.texto}`)).join('\n').slice(0, 60000);
  const system = fila.buzon
    ? `Eres el asistente de ${marcaNombre}. Te paso la transcripción de un MENSAJE DE VOZ que dejó una persona al llamar a la clínica. Responde SOLO un JSON: {"resumen":"una o dos frases: quién llama y qué necesita","siguiente_paso":"qué hacer","temas":["máximo 4"]}. No inventes nada.`
    : `Eres el asistente de calidad de ${marcaNombre}, una clínica. Te paso la transcripción de una llamada entre ${agente} (agente) y ${paciente || 'un paciente'}. Responde SOLO un JSON:
{"resumen":"dos o tres frases: para qué fue la llamada y en qué quedaron","resultado":"cita | contesto | buzon | no_contesto | numero_mal","cita":"día y hora acordados si quedó una cita; si no, cadena vacía","siguiente_paso":"qué sigue, una frase","temas":["máximo 4"]${etiquetar ? ',"hablantes":["agente" o "paciente" por cada renglón numerado, en orden]' : ''}}
Reglas: "cita" solo si quedó una cita con día u hora; "buzon" si contestó un buzón o grabadora; "numero_mal" si dicen que es número equivocado; "no_contesto" si nadie habló; si no, "contesto". Ignora los avisos automáticos. No inventes nada.`;
  try {
    const r = await claudeJson(env, system, texto);
    if (r) {
      base.resumen = String(r.resumen || '');
      base.resultado = fila.buzon ? 'buzon' : String(r.resultado || '');
      base.cita = String(r.cita || '');
      base.siguiente_paso = String(r.siguiente_paso || '');
      base.temas = Array.isArray(r.temas) ? r.temas : [];
      if (etiquetar && Array.isArray(r.hablantes)) {
        base.turnos = armarTurnos(turnos.map((x, i) => ({ ...x, ini: i, quien: r.hablantes[i] === 'paciente' ? 'paciente' : 'agente' })));
      }
    }
  } catch (e) { base.resumen_error = String(e.message || e).slice(0, 200); }
  return base;
}

function promptTranscripcion({ marcaNombre, fila, paciente }) {
  const agente = fila.user_nombre || 'el agente';
  if (fila.buzon) {
    return `Eres el asistente de ${marcaNombre}. Este audio es un MENSAJE DE VOZ que una persona dejó al llamar a la clínica y no ser atendida. Devuelve SOLO un JSON:
{"turnos":[{"quien":"paciente","texto":"lo que dijo, literal"}],"resumen":"una o dos frases: quién llama y qué necesita","resultado":"buzon","cita":"","siguiente_paso":"qué hacer (por ejemplo: devolver la llamada para dar precio)","temas":["máximo 4"]}
Reglas: transcribe literal en español; no inventes nada; si algo no se entiende escribe [inaudible]; ignora el saludo automático de la clínica.`;
  }
  const canales = fila.direccion === 'entrante'
    ? 'el canal izquierdo es el PACIENTE (quien llamó) y el derecho es el AGENTE'
    : 'el canal izquierdo es el AGENTE y el derecho es el PACIENTE';
  return `Eres el asistente de calidad de ${marcaNombre}, una clínica. Transcribe COMPLETA esta llamada telefónica entre ${agente} (agente de ${marcaNombre}) y ${paciente || 'un paciente'}. Devuelve SOLO un JSON con esta forma:
{
  "turnos": [{"quien": "agente" | "paciente", "texto": "lo que dijo, literal"}],
  "resumen": "dos o tres frases: para qué fue la llamada y en qué quedaron",
  "resultado": "cita" | "contesto" | "buzon" | "no_contesto" | "numero_mal",
  "cita": "día y hora acordados si quedó una cita; si no, cadena vacía",
  "siguiente_paso": "qué sigue con esta persona, una frase (cadena vacía si nada)",
  "temas": ["máximo 4 temas de la plática, por ejemplo: precio, alineadores, horario"]
}
Reglas:
- Si la grabación es estéreo, ${canales}. Si no, distingue por lo que dicen (el agente se presenta de ${marcaNombre}).
- Transcribe literal en el idioma de la llamada. No inventes nada; si una parte no se entiende escribe [inaudible].
- Ignora los avisos automáticos ("esta llamada se graba", "presiona cualquier tecla").
- "resultado": "cita" solo si quedó una cita con día u hora; "buzon" si contestó un buzón de voz o una grabadora; "numero_mal" si dicen que es número equivocado; "no_contesto" si nadie habló; en cualquier otro caso "contesto".`;
}

// Baja la grabación de Twilio a R2 (y la borra de Twilio), luego la
// transcribe. Con candado: el webhook, el cron y la app pueden pedirlo a la
// vez y solo uno trabaja. Devuelve true si procesó.
export async function procesarGrabacion(env, id, { forzar = false } = {}) {
  const tope = MAX_INTENTOS + (forzar ? 2 : 0);
  const lock = await env.DB.prepare(
    `UPDATE mkt_llamadas SET transcripcion_estado = 'procesando', procesando_desde = datetime('now'), intentos = intentos + 1, actualizado = datetime('now')
      WHERE id = ? AND grabacion_sid IS NOT NULL AND intentos < ?
        AND (transcripcion_estado IN ('pendiente', 'error') OR transcripcion_estado IS NULL
             OR (transcripcion_estado = 'procesando' AND procesando_desde < datetime('now', '-4 minutes')))`
  ).bind(id, tope).run();
  if (!(lock.meta && lock.meta.changes)) return false;
  const fila = await filaLlamada(env, id);
  const c = fila ? await marca(env, fila.client_id) : null;
  if (!fila || !c) return false;
  try {
    const keyMp3 = fila.grabacion_key || `${R2_PREFIJO}/${fila.client_id}/${fila.id}.mp3`;
    const keyWav = keyMp3.replace(/\.mp3$/, '.wav');
    let mp3 = null, wav = null;
    if (!fila.grabacion_key) {
      if (!lineaConectada(c)) throw new Error('La línea de esta marca se desconectó: no se puede bajar la grabación de Twilio.');
      if (!env.R2_BUCKET) throw new Error('Almacenamiento no disponible.');
      const auth = { authorization: 'Basic ' + btoa(`${c.tw_account_sid}:${c.tw_auth_token}`) };
      const res = await fetch(`${TW_API}/Accounts/${c.tw_account_sid}/Recordings/${fila.grabacion_sid}.mp3`, { headers: auth, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`Twilio no entregó la grabación (HTTP ${res.status}).`);
      mp3 = new Uint8Array(await res.arrayBuffer());
      if (mp3.byteLength < 200) throw new Error('La grabación llegó vacía.');
      // El WAV trae los dos canales separados (para transcribir a cada quien).
      if (env.AI) {
        try {
          const rw = await fetch(`${TW_API}/Accounts/${c.tw_account_sid}/Recordings/${fila.grabacion_sid}.wav`, { headers: auth, signal: AbortSignal.timeout(90000) });
          if (rw.ok) { wav = new Uint8Array(await rw.arrayBuffer()); await env.R2_BUCKET.put(keyWav, wav, { httpMetadata: { contentType: 'audio/wav' } }); }
        } catch { wav = null; }
      }
      await env.R2_BUCKET.put(keyMp3, mp3, { httpMetadata: { contentType: 'audio/mpeg' }, customMetadata: { client_id: fila.client_id, conv_id: fila.conv_id || '' } });
      await actualizar(env, fila.id, { grabacion_key: keyMp3, grabacion_bytes: mp3.byteLength });
      // Ya está con nosotros: se borra de Twilio (privacidad y costo).
      try { await tw(credDe(c), `/Recordings/${fila.grabacion_sid}.json`, { method: 'DELETE' }); } catch { /* queda en Twilio; no pasa nada */ }
    }
    let paciente = '';
    if (fila.conv_id) {
      const v = await env.DB.prepare('SELECT nombre, username FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first();
      paciente = nombrePaciente(v);
    }
    const ctxT = { marcaNombre: nombreComercial(c), fila, paciente };
    let t = null;
    const errores = [];
    if (env.AI) {
      if (!wav) { const o = await env.R2_BUCKET.get(keyWav); if (o) wav = new Uint8Array(await o.arrayBuffer()); }
      if (wav) {
        try { t = await transcribirConWhisper(env, wav, ctxT); }
        catch (e) { errores.push('Whisper: ' + String((e && e.message) || e).slice(0, 160)); }
      }
    }
    if (!t && (saJson(env) || env.GEMINI_API_KEY)) {
      if (!mp3) { const o = await env.R2_BUCKET.get(keyMp3); if (!o) throw new Error('La grabación ya no está en el almacenamiento.'); mp3 = new Uint8Array(await o.arrayBuffer()); }
      try { t = await geminiAudio(env, mp3, 'audio/mpeg', promptTranscripcion(ctxT)); t.motor = 'gemini'; }
      catch (e) { if (e.code !== 'SIN_IA') errores.push(String((e && e.message) || e).slice(0, 200)); }
    }
    if (!t) {
      if (!errores.length) { await actualizar(env, fila.id, { transcripcion_estado: 'sin_ia', transcripcion_error: 'No hay motor de transcripción conectado.', procesando_desde: null }); return true; }
      throw new Error(errores.join(' · '));
    }
    const limpio = {
      turnos: (Array.isArray(t.turnos) ? t.turnos : []).slice(0, 600).map((x) => ({ quien: x && x.quien === 'paciente' ? 'paciente' : 'agente', texto: String((x && x.texto) || '').slice(0, 2000) })).filter((x) => x.texto),
      resumen: String(t.resumen || '').slice(0, 800),
      resultado: RESULTADOS_LLAMADA.includes(t.resultado) ? t.resultado : '',
      cita: String(t.cita || '').slice(0, 200),
      siguiente_paso: String(t.siguiente_paso || '').slice(0, 300),
      temas: (Array.isArray(t.temas) ? t.temas : []).slice(0, 4).map((x) => String(x).slice(0, 40)),
      motor: t.motor || 'gemini',
    };
    await actualizar(env, fila.id, { transcripcion: JSON.stringify(limpio), transcripcion_estado: 'lista', transcripcion_error: null, procesando_desde: null });
    // El WAV solo servía para transcribir; para escuchar queda el MP3.
    try { await env.R2_BUCKET.delete(keyWav); } catch { /* noop */ }
    const fresca = await filaLlamada(env, fila.id);
    // La IA sugiere el resultado mientras ninguna persona lo haya elegido.
    if (!fresca.buzon && limpio.resultado && fresca.evento_id && (!fresca.resultado_por || fresca.resultado_por === 'auto') && limpio.resultado !== fresca.resultado) {
      await aplicarResultado(env, fresca, { resultado: limpio.resultado, por: 'ia' });
    }
    if (fresca.buzon && fresca.conv_id) {
      await avisarLlamadaPerdida(env, c, fresca, { body: `${paciente || fmtTel(fresca.numero_paciente)} dejó un mensaje de voz: ${limpio.resumen || 'escúchalo en el chat'}` });
    }
    return true;
  } catch (e) {
    await actualizar(env, fila.id, { transcripcion_estado: 'error', transcripcion_error: String((e && e.message) || e).slice(0, 300), procesando_desde: null });
    return true;
  }
}

// Cron: grabaciones que se quedaron sin copiar o sin transcribir, y llamadas
// que Twilio nunca cerró (se marcan para que la app no las siga "en curso").
export async function procesarLlamadasPendientes(env, { max = 3 } = {}) {
  let r;
  try {
    r = await env.DB.prepare(
      `SELECT id FROM mkt_llamadas
        WHERE grabacion_sid IS NOT NULL AND intentos < ?
          AND (transcripcion_estado IN ('pendiente', 'error') OR transcripcion_estado IS NULL
               OR (transcripcion_estado = 'procesando' AND procesando_desde < datetime('now', '-4 minutes')))
          AND creado >= datetime('now', '-7 days')
        ORDER BY creado ASC LIMIT ?`
    ).bind(MAX_INTENTOS, max).all();
  } catch { return null; }
  let hechas = 0;
  for (const x of r.results || []) { if (await procesarGrabacion(env, x.id)) hechas++; }
  let cerradas = 0;
  try {
    const q = await env.DB.prepare(
      `UPDATE mkt_llamadas SET estado = 'fallida', error = COALESCE(error, 'Twilio no avisó cómo terminó la llamada.'), actualizado = datetime('now')
        WHERE estado IN (${ACTIVOS.map(() => '?').join(', ')}) AND creado < datetime('now', '-3 hours')`
    ).bind(...ACTIVOS).run();
    cerradas = (q.meta && q.meta.changes) || 0;
  } catch { /* noop */ }
  return { transcritas: hechas, cerradas };
}

// ── Avisos ───────────────────────────────────────────────────────────────────
async function avisarLlamadaPerdida(env, c, fila, { body }) {
  const link = fila.conv_id ? `#/bandeja?cliente=${c.id}&conv=${fila.conv_id}` : `#/bandeja?cliente=${c.id}`;
  let ids = [];
  try {
    const v = fila.conv_id ? await env.DB.prepare('SELECT asignado_a FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first() : null;
    if (v && v.asignado_a) ids = [v.asignado_a];
    else {
      const r = await env.DB.prepare("SELECT id FROM mkt_users WHERE role = 'client' AND client_id = ? AND active = 1 AND bandeja_rol IN ('agente', 'supervisor')").bind(c.id).all();
      ids = (r.results || []).map((x) => x.id);
    }
  } catch { ids = []; }
  if (ids.length) return avisarUsuarios(env, c, ids, { tipo: 'mensaje', body, link });
  return avisarStaff(env, c, { tipo: 'mensaje', body, link });
}

// ── Webhooks de Twilio (sin cookie, firmados) ────────────────────────────────
async function equipoConTelefono(env, clientId) {
  try {
    const r = await env.DB.prepare(
      `SELECT id, name, telefono, bandeja_rol, COALESCE(bandeja_disponible, 1) AS disponible FROM mkt_users
        WHERE role = 'client' AND client_id = ? AND active = 1 AND bandeja_rol IN ('agente', 'supervisor') AND telefono IS NOT NULL AND telefono != ''`
    ).bind(clientId).all();
    return r.results || [];
  } catch { return []; }
}
async function convPorTelefono(env, c, e164) {
  const d = String(e164 || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  const ult = d.slice(-10);
  return env.DB.prepare(
    `SELECT id, nombre, username, asignado_a, canal, contacto_id, telefono FROM mkt_conversaciones
      WHERE client_id = ? AND ((canal = 'whatsapp' AND substr(contacto_id, -10) = ?) OR substr(replace(COALESCE(telefono, ''), '+', ''), -10) = ?)
      ORDER BY archivado ASC, ultimo_en DESC LIMIT 1`
  ).bind(c.id, ult, ult).first();
}
function dialGrabado({ callerId, accionFin, id, timeout = 25 }) {
  return `<Dial callerId="${escXml(callerId)}" timeout="${timeout}" record="record-from-answer-dual" recordingStatusCallback="${ua('grabacion', id)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed" action="${escXml(accionFin)}" method="POST">`;
}
function buzonTwiml(c, id) {
  return say(`En este momento no podemos atenderte. Deja tu nombre y tu mensaje después del tono y te llamamos.`)
    + `<Record maxLength="120" timeout="6" playBeep="true" action="${ua('buzon-fin', id)}" method="POST" recordingStatusCallback="${ua('grabacion', id, { buzon: '1' })}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"/>`
    + say('No escuchamos ningún mensaje. Hasta luego.') + '<Hangup/>';
}

export async function handleTwilio(request, env, url, waitUntil) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // El enrutador de la app quita el prefijo /api/marketing antes de llegar
  // aquí (la ruta es /llamadas/tw/<accion>). Twilio firma la URL PÚBLICA que
  // pidió, que es exactamente la que armamos con BASE_PUBLICA + RUTA_TW.
  const corta = '/llamadas/tw/';
  const p = url.pathname;
  const accion = (p.startsWith(RUTA_TW) ? p.slice(RUTA_TW.length) : p.startsWith(corta) ? p.slice(corta.length) : '').replace(/\/+$/, '');
  const urlFirmada = `${BASE_PUBLICA}${RUTA_TW}${accion}${url.search}`;
  const params = {};
  try { const fd = await request.formData(); for (const [k, v] of fd.entries()) params[k] = String(v); } catch { /* sin cuerpo */ }
  const firma = request.headers.get('x-twilio-signature') || '';
  const enSegundoPlano = (p) => { if (typeof waitUntil === 'function') waitUntil(p.catch(() => {})); else p.catch(() => {}); };

  // Llamadas que ENTRAN a la línea de una marca (VoiceUrl del número).
  if (accion === 'entrante' || accion === 'estado-entrante') {
    const c = await marcaPorLinea(env, params.To);
    if (!c) return accion === 'entrante' ? twiml(say('Este número no está disponible.') + '<Hangup/>') : vacio();
    if (!(await firmaValida(c.tw_auth_token, urlFirmada, params, firma))) return new Response('Firma inválida', { status: 403 });
    if (accion === 'estado-entrante') {
      // La persona colgó antes de que sonara algún agente (o en el saludo).
      const f = params.CallSid ? await env.DB.prepare('SELECT * FROM mkt_llamadas WHERE twilio_sid = ? AND client_id = ?').bind(params.CallSid, c.id).first() : null;
      if (f && (f.estado === 'sonando' || f.estado === 'buzon')) {
        await actualizar(env, f.id, { estado: f.estado === 'buzon' && f.grabacion_sid ? 'buzon' : 'perdida', terminada_en: new Date().toISOString().slice(0, 19).replace('T', ' ') });
        if (f.estado === 'sonando') await avisarLlamadaPerdida(env, c, f, { body: `Llamada perdida de ${fmtTel(f.numero_paciente)}` });
      }
      return vacio();
    }
    return entrante(env, c, params);
  }

  const fila = await filaLlamada(env, url.searchParams.get('l') || '');
  const c = fila ? await marca(env, fila.client_id) : null;
  if (!fila || !c || !c.tw_auth_token) return accion === 'grabacion' || accion.startsWith('estado') || accion === 'paciente' ? vacio() : twiml('<Hangup/>');
  if (!(await firmaValida(c.tw_auth_token, urlFirmada, params, firma))) return new Response('Firma inválida', { status: 403 });
  const cfg = cfgLinea(c);
  const marcaNombre = nombreComercial(c);

  // 1) El agente contestó su celular: confirmar con una tecla.
  if (accion === 'puente') {
    let quien = '';
    if (fila.conv_id) quien = nombrePaciente(await env.DB.prepare('SELECT nombre, username FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first());
    await actualizar(env, fila.id, { estado: 'confirmando' });
    return twiml(`<Gather numDigits="1" timeout="8" action="${ua('conectar', fila.id)}" method="POST">${say(`Llamada de ${marcaNombre} para ${quien || 'tu paciente'}. Presiona cualquier tecla para marcarle.`)}</Gather>`
      + say('No se marcó ninguna tecla. Cuelgo la llamada.') + '<Hangup/>');
  }
  // 2) Tecla recibida: marcar al paciente con el número de la clínica, grabando.
  if (accion === 'conectar') {
    if (!params.Digits) return twiml(say('No se marcó ninguna tecla.') + '<Hangup/>');
    await actualizar(env, fila.id, { estado: 'llamando_paciente' });
    const aviso = cfg.aviso !== false ? ` url="${ua('aviso', fila.id)}" method="POST"` : '';
    return twiml(say('Marcando.') + dialGrabado({ callerId: c.tw_numero, accionFin: u('fin', fila.id), id: fila.id, timeout: 30 })
      + `<Number statusCallback="${ua('paciente', fila.id)}" statusCallbackEvent="answered" statusCallbackMethod="POST"${aviso}>${escXml(fila.numero_paciente)}</Number></Dial>`);
  }
  // Lo primero que oye el paciente al contestar (antes de unirse al agente).
  if (accion === 'aviso') {
    return twiml(say(`Hola, te llamamos de ${marcaNombre}. Esta llamada se graba para darte un mejor servicio.`));
  }
  // El paciente contestó.
  if (accion === 'paciente') {
    if (params.CallStatus === 'in-progress' || params.CallStatus === 'answered') {
      await actualizar(env, fila.id, { estado: 'en_curso', contestada_en: new Date().toISOString().slice(0, 19).replace('T', ' '), twilio_sid_paciente: params.CallSid || null });
    }
    return vacio();
  }
  // 3) Terminó la parte del paciente (saliente).
  if (accion === 'fin') {
    const st = params.DialCallStatus || '';
    const dur = parseInt(params.DialCallDuration, 10) || 0;
    const estado = { completed: 'terminada', 'no-answer': 'no_contesto', busy: 'ocupado', failed: 'fallida', canceled: 'cancelada' }[st] || 'terminada';
    const resultado = estado === 'terminada' && dur > 0 ? 'contesto' : 'no_contesto';
    await cerrarLlamada(env, c, fila, { estado, duracion: estado === 'terminada' ? dur : 0, resultado });
    const frase = { no_contesto: 'No contestó.', ocupado: 'El número está ocupado.', fallida: 'No se pudo comunicar con ese número.' }[estado];
    return twiml((frase ? say(frase) : '') + '<Hangup/>');
  }
  // Estado de la llamada al celular del agente (saliente).
  if (accion === 'estado') {
    const st = params.CallStatus || '';
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(st)) {
      const campos = { terminada_en: new Date().toISOString().slice(0, 19).replace('T', ' ') };
      if (['iniciando', 'llamando_agente', 'confirmando'].includes(fila.estado)) {
        campos.estado = st === 'canceled' ? 'cancelada' : 'no_contesto_agente';
        if (st === 'failed') campos.error = 'No se pudo llamar a tu celular' + (params.ErrorCode ? ` (Twilio ${params.ErrorCode})` : '') + '.';
      } else if (['llamando_paciente', 'en_curso'].includes(fila.estado) && !fila.evento_id) {
        // El aviso de "fin" no llegó: se cierra con lo que se sabe.
        const ini = fila.contestada_en ? Date.parse(fila.contestada_en.replace(' ', 'T') + 'Z') : NaN;
        const dur = isNaN(ini) ? 0 : Math.max(0, Math.round((Date.now() - ini) / 1000));
        await cerrarLlamada(env, c, fila, { estado: dur ? 'terminada' : 'no_contesto', duracion: dur, resultado: dur ? 'contesto' : 'no_contesto' });
      }
      await actualizar(env, fila.id, campos);
    }
    return vacio();
  }
  // 4) Grabación lista en Twilio: copiar a R2 y transcribir.
  if (accion === 'grabacion') {
    if (params.RecordingStatus === 'completed' && params.RecordingSid) {
      const campos = { grabacion_sid: params.RecordingSid, grabacion_seg: parseInt(params.RecordingDuration, 10) || 0, transcripcion_estado: 'pendiente' };
      if (url.searchParams.get('buzon') === '1') { campos.buzon = 1; campos.estado = 'buzon'; }
      await actualizar(env, fila.id, campos);
      enSegundoPlano(procesarGrabacion(env, fila.id));
    }
    return vacio();
  }

  // ── Entrantes ──
  // Susurro al agente: quién llama; con una tecla contesta (el buzón del
  // agente no puede "ganar" la llamada).
  if (accion === 'susurro') {
    let quien = '';
    if (fila.conv_id) quien = nombrePaciente(await env.DB.prepare('SELECT nombre, username FROM mkt_conversaciones WHERE id = ?').bind(fila.conv_id).first());
    return twiml(`<Gather numDigits="1" timeout="7" action="${ua('susurro-ok', fila.id, { u: url.searchParams.get('u') || '' })}" method="POST">${say(`Llamada de ${quien || 'un paciente'} para ${marcaNombre}. Presiona cualquier tecla para contestar.`)}</Gather><Hangup/>`);
  }
  if (accion === 'susurro-ok') {
    if (!params.Digits) return twiml('<Hangup/>');
    const uid = url.searchParams.get('u') || '';
    const ag = uid ? await env.DB.prepare("SELECT id, name, telefono FROM mkt_users WHERE id = ? AND client_id = ? AND active = 1").bind(uid, c.id).first() : null;
    await actualizar(env, fila.id, { estado: 'en_curso', contestada_en: new Date().toISOString().slice(0, 19).replace('T', ' '), user_id: ag ? ag.id : null, user_nombre: ag ? ag.name : null, numero_agente: ag ? ag.telefono : null });
    return twiml('');
  }
  if (accion === 'fin-entrante') {
    const st = params.DialCallStatus || '';
    const paso = Number(url.searchParams.get('paso') || '1');
    const fresca = await filaLlamada(env, fila.id);
    if (st === 'completed') {
      // Contestó un agente (paso 1) o la recepción del desvío (paso 2).
      if (paso === 2 && !fresca.user_id) {
        await actualizar(env, fila.id, { user_nombre: 'Recepción (desvío)', numero_agente: aE164(cfg.desvio) });
        fresca.user_nombre = 'Recepción (desvío)';
      }
      await cerrarLlamada(env, c, fresca, { estado: 'terminada', duracion: parseInt(params.DialCallDuration, 10) || 0, resultado: 'contesto' });
      return twiml('<Hangup/>');
    }
    if (st === 'canceled') {
      await actualizar(env, fila.id, { estado: 'perdida', terminada_en: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      await avisarLlamadaPerdida(env, c, fresca, { body: `Llamada perdida de ${fmtTel(fresca.numero_paciente)}` });
      return twiml('<Hangup/>');
    }
    const desvio = aE164(cfg.desvio);
    if (paso === 1 && desvio) {
      return twiml(dialGrabado({ callerId: c.tw_numero, accionFin: u('fin-entrante', fila.id, { paso: '2' }), id: fila.id, timeout: 25 }) + `<Number>${escXml(desvio)}</Number></Dial>`);
    }
    await actualizar(env, fila.id, { estado: 'buzon' });
    await avisarLlamadaPerdida(env, c, fresca, { body: `Llamada perdida de ${fmtTel(fresca.numero_paciente)}` });
    return twiml(buzonTwiml(c, fila.id));
  }
  if (accion === 'buzon-fin') return twiml(say('Gracias. Te llamamos pronto.') + '<Hangup/>');

  return vacio();
}

async function entrante(env, c, params) {
  const cfg = cfgLinea(c);
  const desde = aE164(params.From);
  const marcaNombre = nombreComercial(c);
  let conv = desde ? await convPorTelefono(env, c, desde) : null;
  if (!conv && desde) {
    // Número nuevo: nace su ficha como contacto de WhatsApp (en México todo
    // celular lo tiene) para que el agente pueda seguirlo desde la Bandeja.
    const cv = await convDe(env, c, 'whatsapp', waIdDe(desde));
    await env.DB.prepare("UPDATE mkt_conversaciones SET telefono = COALESCE(telefono, ?), origen = COALESCE(origen, ?), ultimo_texto = COALESCE(ultimo_texto, '📞 Llamada entrante'), ultimo_en = COALESCE(ultimo_en, datetime('now')) WHERE id = ?")
      .bind(desde, JSON.stringify({ tipo: 'llamada', titulo: 'Llamada a la línea' }), cv.id).run();
    conv = { id: cv.id, asignado_a: null };
  }
  const equipo = await equipoConTelefono(env, c.id);
  const suyo = conv && conv.asignado_a ? equipo.find((x) => x.id === conv.asignado_a) : null;
  const objetivos = (suyo ? [suyo] : equipo.filter((x) => x.bandeja_rol === 'agente' && Number(x.disponible) === 1))
    .filter((x) => aE164(x.telefono) && aE164(x.telefono) !== desde).slice(0, 10);
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO mkt_llamadas (id, client_id, conv_id, direccion, numero_paciente, estado, twilio_sid) VALUES (?, ?, ?, 'entrante', ?, 'sonando', ?)`
  ).bind(id, c.id, conv ? conv.id : null, desde, params.CallSid || null).run();
  let x = say(cfg.aviso !== false ? `Gracias por llamar a ${marcaNombre}. Esta llamada se graba para darte un mejor servicio.` : `Gracias por llamar a ${marcaNombre}.`);
  if (objetivos.length) {
    x += dialGrabado({ callerId: c.tw_numero, accionFin: u('fin-entrante', id, { paso: '1' }), id, timeout: 22 });
    for (const ag of objetivos) {
      const tel = aE164(ag.telefono);
      if (tel) x += `<Number url="${ua('susurro', id, { u: ag.id })}" method="POST">${escXml(tel)}</Number>`;
    }
    x += '</Dial>';
  } else if (aE164(cfg.desvio)) {
    x += dialGrabado({ callerId: c.tw_numero, accionFin: u('fin-entrante', id, { paso: '2' }), id, timeout: 25 }) + `<Number>${escXml(aE164(cfg.desvio))}</Number></Dial>`;
  } else {
    await actualizar(env, id, { estado: 'buzon' });
    x += buzonTwiml(c, id);
  }
  return twiml(x);
}

// ── API de la app (con sesión) ───────────────────────────────────────────────
// Rutas: POST /bandeja/conversaciones/:id/llamar · GET /bandeja/llamadas ·
// GET|POST /bandeja/llamadas/:id[/audio|/colgar|/resultado|/transcribir] ·
// GET|POST /bandeja/linea[/cfg|/desconectar]
export async function handleLlamadas(request, env, session, url, parts, waitUntil) {
  const method = request.method;
  const ws = (session && session.workspace_id) || 'ivae';
  const esAdmin = session.role === 'admin';
  const esCliente = session.role === 'client';
  const esAgente = esCliente && session.bandeja_rol === 'agente';
  const esSupervisor = !esCliente || session.bandeja_rol === 'supervisor';
  const yo = session.user_id;
  const sub = parts.slice(1);
  const qp = (k) => url.searchParams.get(k) || '';
  const prohibido = () => json({ error: 'No tienes permiso para esto.' }, 403);
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
  const llamadaOk = async (id) => {
    const f = await env.DB.prepare(
      `SELECT l.*, v.asignado_a AS conv_asignado, v.nombre AS conv_nombre FROM mkt_llamadas l JOIN mkt_clients c ON c.id = l.client_id
         LEFT JOIN mkt_conversaciones v ON v.id = l.conv_id
        WHERE l.id = ? AND COALESCE(c.workspace_id, 'ivae') = ?`
    ).bind(id, ws).first();
    if (!f) return null;
    if (esCliente && f.client_id !== session.client_id) return null;
    // El agente: sus llamadas y las de los chats que hoy son suyos.
    if (esAgente && f.user_id !== yo && f.conv_asignado !== yo) return null;
    return f;
  };

  // ── Llamar desde un chat ──
  if (sub[0] === 'conversaciones' && sub[2] === 'llamar' && method === 'POST') {
    const conv = await convOk(sub[1]);
    if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
    const c = await marca(env, conv.client_id);
    if (!lineaConectada(c)) return json({ error: 'Esta marca todavía no tiene la línea de llamadas conectada.', sin_linea: true }, 400);
    const b = await leerJson(request);
    const paciente = b.numero ? aE164(b.numero) : telefonoDeConv(conv);
    if (!paciente) return json({ error: 'Escribe el número del paciente con lada, por ejemplo 998 123 4567.', falta: 'numero' }, 400);
    let miNumero = b.mi_numero ? aE164(b.mi_numero) : null;
    if (b.mi_numero && !miNumero) return json({ error: 'Tu celular no parece válido. Escríbelo con lada, por ejemplo 998 123 4567.', falta: 'mi_numero' }, 400);
    if (!miNumero) {
      const r = await env.DB.prepare('SELECT telefono FROM mkt_users WHERE id = ?').bind(yo).first();
      miNumero = r && r.telefono ? aE164(r.telefono) : null;
    }
    if (!miNumero) return json({ error: 'Escribe tu celular: ahí te entra la llamada antes de marcarle al paciente.', falta: 'mi_numero' }, 400);
    if (miNumero === paciente) return json({ error: 'Tu celular y el del paciente son el mismo número.' }, 400);
    if (miNumero === aE164(c.tw_numero)) return json({ error: 'Tu celular no puede ser el mismo número de la línea de la clínica.' }, 400);
    // Guardar lo que se escribió (la próxima vez ya no se pide).
    if (b.mi_numero) await env.DB.prepare("UPDATE mkt_users SET telefono = ?, updated_at = datetime('now') WHERE id = ?").bind(miNumero, yo).run();
    if (b.numero && paciente !== telefonoDeConv(conv)) await env.DB.prepare("UPDATE mkt_conversaciones SET telefono = ?, updated_at = datetime('now') WHERE id = ?").bind(paciente, conv.id).run();
    // Doble toque: si ya hay una llamada viva de este agente, se devuelve esa.
    const viva = await env.DB.prepare(
      `SELECT * FROM mkt_llamadas WHERE user_id = ? AND estado IN (${ACTIVOS.map(() => '?').join(', ')}) AND creado >= datetime('now', '-10 minutes') ORDER BY creado DESC LIMIT 1`
    ).bind(yo, ...ACTIVOS).first();
    if (viva) return json({ error: 'Ya tienes una llamada en curso. Cuélgala antes de hacer otra.', llamada: llamadaPublica(viva) }, 409);
    const id = randomId();
    await env.DB.prepare(
      `INSERT INTO mkt_llamadas (id, client_id, conv_id, user_id, user_nombre, direccion, numero_paciente, numero_agente, estado) VALUES (?, ?, ?, ?, ?, 'saliente', ?, ?, 'llamando_agente')`
    ).bind(id, c.id, conv.id, yo, session.name || null, paciente, miNumero).run();
    try {
      const call = await tw(credDe(c), '/Calls.json', { method: 'POST', form: [
        ['To', miNumero], ['From', c.tw_numero], ['Url', u('puente', id)], ['Method', 'POST'],
        ['StatusCallback', u('estado', id)], ['StatusCallbackMethod', 'POST'], ['Timeout', '25'],
      ] });
      await actualizar(env, id, { twilio_sid: call.sid || null });
    } catch (e) {
      const msg = explicarTwilio(e);
      await actualizar(env, id, { estado: 'fallida', error: msg });
      return json({ error: msg }, 422);
    }
    if (esAgente && !conv.asignado_a) await asignar(env, c, conv.id, { id: yo, name: session.name }, { tipo: 'tomada' });
    return json({ ok: true, llamada: llamadaPublica(await filaLlamada(env, id)) });
  }

  // ── Lista de llamadas de la marca (panel del supervisor; el agente, las suyas) ──
  if (sub[0] === 'llamadas' && sub.length === 1 && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    const dias = Math.min(180, Math.max(1, Number(qp('dias')) || 30));
    const where = ['l.client_id = ?', "l.creado >= datetime('now', ?)", "l.estado NOT IN ('no_contesto_agente', 'cancelada', 'iniciando')", 'l.twilio_sid IS NOT NULL'];
    const binds = [c.id, `-${dias} days`];
    if (esAgente) { where.push('l.user_id = ?'); binds.push(yo); }
    else if (qp('agente')) { where.push('l.user_id = ?'); binds.push(qp('agente')); }
    if (qp('grabadas') === '1') where.push('l.grabacion_sid IS NOT NULL');
    const r = await env.DB.prepare(
      `SELECT l.*, v.nombre AS conv_nombre FROM mkt_llamadas l LEFT JOIN mkt_conversaciones v ON v.id = l.conv_id
        WHERE ${where.join(' AND ')} ORDER BY l.creado DESC LIMIT 150`
    ).bind(...binds).all();
    const filas = r.results || [];
    const tot = { llamadas: filas.length, contestadas: 0, grabadas: 0, minutos: 0, perdidas: 0 };
    for (const f of filas) {
      if (f.estado === 'terminada') tot.contestadas++;
      if (f.grabacion_sid) tot.grabadas++;
      tot.minutos += Math.ceil((Number(f.duracion_seg) || 0) / 60);
      if (f.direccion === 'entrante' && (f.estado === 'perdida' || f.estado === 'buzon')) tot.perdidas++;
    }
    return json({ llamadas: filas.map((f) => llamadaPublica(f, { completa: false })), totales: tot, linea: resumenLinea(c) });
  }

  if (sub[0] === 'llamadas' && sub[1]) {
    const f = await llamadaOk(sub[1]);
    if (!f) return json({ error: 'Llamada no encontrada' }, 404);
    const accion = sub[2] || '';

    if (!accion && method === 'GET') return json({ llamada: llamadaPublica(f) });

    // Audio con soporte de Range (Safari no reproduce sin 206).
    if (accion === 'audio' && method === 'GET') {
      if (!f.grabacion_key || !env.R2_BUCKET) return json({ error: 'La grabación todavía no está lista.' }, 404);
      const rango = request.headers.get('range') || '';
      const m = /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
      const head = await env.R2_BUCKET.head(f.grabacion_key);
      if (!head) return json({ error: 'La grabación ya no está.' }, 404);
      const total = head.size;
      const h = new Headers({ 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' });
      if (m && (m[1] || m[2])) {
        let ini = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
        let fin = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
        if (ini >= total || ini > fin) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
        const obj = await env.R2_BUCKET.get(f.grabacion_key, { range: { offset: ini, length: fin - ini + 1 } });
        h.set('content-range', `bytes ${ini}-${fin}/${total}`);
        h.set('content-length', String(fin - ini + 1));
        return new Response(obj.body, { status: 206, headers: h });
      }
      const obj = await env.R2_BUCKET.get(f.grabacion_key);
      h.set('content-length', String(total));
      if (qp('descargar') === '1') h.set('content-disposition', `attachment; filename="llamada-${String(f.creado).slice(0, 10)}-${f.id.slice(0, 6)}.mp3"`);
      return new Response(obj.body, { status: 200, headers: h });
    }

    if (accion === 'colgar' && method === 'POST') {
      if (esAgente && f.user_id !== yo) return prohibido();
      if (!ACTIVOS.includes(f.estado) || !f.twilio_sid) return json({ ok: true, llamada: llamadaPublica(f) });
      const c = await marca(env, f.client_id);
      if (lineaConectada(c)) {
        try { await tw(credDe(c), `/Calls/${f.twilio_sid}.json`, { method: 'POST', form: [['Status', 'completed']] }); }
        catch { try { await tw(credDe(c), `/Calls/${f.twilio_sid}.json`, { method: 'POST', form: [['Status', 'canceled']] }); } catch { /* ya había colgado */ } }
      }
      if (['iniciando', 'llamando_agente', 'confirmando'].includes(f.estado)) await actualizar(env, f.id, { estado: 'cancelada' });
      return json({ ok: true, llamada: llamadaPublica(await filaLlamada(env, f.id)) });
    }

    if (accion === 'resultado' && method === 'POST') {
      if (esAgente && f.user_id && f.user_id !== yo) return prohibido();
      const b = await leerJson(request);
      const resultado = String(b.resultado || '');
      if (!RESULTADOS_LLAMADA.includes(resultado)) return json({ error: 'Elige cómo salió la llamada.' }, 400);
      if (ACTIVOS.includes(f.estado)) return json({ error: 'La llamada sigue en curso.' }, 409);
      const nota = b.nota !== undefined ? (String(b.nota || '').trim().slice(0, 500) || null) : undefined;
      if (!f.evento_id && f.conv_id) {
        // Sin evento (no llegó a marcarle al paciente): se registra ahora.
        const eventoId = await registrarEvento(env, { clientId: f.client_id, convId: f.conv_id, userId: f.user_id || yo, userNombre: f.user_nombre || session.name, tipo: 'llamada', dato: { resultado, minutos: Math.ceil((Number(f.duracion_seg) || 0) / 60), nota: nota || null, llamada_id: f.id } });
        await actualizar(env, f.id, { evento_id: eventoId });
        f.evento_id = eventoId;
      }
      await aplicarResultado(env, f, { resultado, por: 'agente', nota, session });
      return json({ ok: true, llamada: llamadaPublica(await filaLlamada(env, f.id)) });
    }

    if (accion === 'transcribir' && method === 'POST') {
      if (!f.grabacion_sid) return json({ error: 'Esta llamada no tiene grabación.' }, 400);
      if (f.transcripcion_estado === 'lista') return json({ ok: true, llamada: llamadaPublica(f) });
      // Reintento manual: se libera el candado de error para un intento más.
      await procesarGrabacion(env, f.id, { forzar: true });
      const fresca = await filaLlamada(env, f.id);
      if (fresca.transcripcion_estado === 'error') return json({ error: fresca.transcripcion_error || 'No se pudo transcribir.', llamada: llamadaPublica(fresca) }, 422);
      return json({ ok: true, llamada: llamadaPublica(fresca) });
    }
    return json({ error: 'Not found' }, 404);
  }

  // ── Línea de la marca (solo admin de la agencia) ──
  if (sub[0] === 'linea') {
    if (!esAdmin) return prohibido();
    const b = method === 'GET' ? {} : await leerJson(request);
    const c = await marcaOk(qp('client_id') || String(b.client_id || ''));
    if (!c) return json({ error: 'Marca no encontrada' }, 404);
    if (method === 'GET' && sub.length === 1) return json({ linea: resumenLinea(c) });

    if (sub[1] === 'desconectar' && method === 'POST') {
      if (c.tw_numero_sid && lineaConectada(c)) {
        try { await tw(credDe(c), `/IncomingPhoneNumbers/${c.tw_numero_sid}.json`, { method: 'POST', form: [['VoiceUrl', ''], ['StatusCallback', '']] }); } catch { /* best-effort */ }
      }
      await env.DB.prepare('UPDATE mkt_clients SET tw_account_sid = NULL, tw_auth_token = NULL, tw_numero = NULL, tw_numero_sid = NULL, tw_connected_at = NULL WHERE id = ?').bind(c.id).run();
      return json({ ok: true });
    }

    if (sub[1] === 'cfg' && method === 'POST') {
      const cfg = cfgDe(c);
      const ll = { ...CFG_LINEA_BASE, ...(cfg.llamadas || {}) };
      if (b.aviso !== undefined) ll.aviso = !!b.aviso;
      if (b.desvio !== undefined) {
        if (b.desvio && !aE164(b.desvio)) return json({ error: 'El número de desvío no parece válido.' }, 400);
        ll.desvio = b.desvio ? aE164(b.desvio) : null;
      }
      cfg.llamadas = ll;
      await guardarCfg(env, c.id, cfg);
      return json({ ok: true, linea: resumenLinea(await marca(env, c.id)) });
    }

    if (sub.length === 1 && method === 'POST') {
      const sid = String(b.account_sid || '').trim();
      const token = String(b.auth_token || '').trim();
      const numero = aE164(b.numero);
      if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) return json({ error: 'El Account SID empieza con AC y tiene 34 caracteres (está en la portada de tu consola de Twilio).' }, 400);
      if (!/^[0-9a-fA-F]{32}$/.test(token)) return json({ error: 'El Auth Token son 32 caracteres (en la consola de Twilio, junto al Account SID, botón "Show").' }, 400);
      if (!numero) return json({ error: 'Escribe el número de la línea con lada, por ejemplo +52 998 123 4567.' }, 400);
      const cred = { sid, token };
      let cuenta;
      try { cuenta = await tw(cred, `${TW_API}/Accounts/${sid}.json`); }
      catch (e) { return json({ error: explicarTwilio(e) }, 400); }
      if (cuenta.status && cuenta.status !== 'active') return json({ error: `La cuenta de Twilio está ${cuenta.status === 'suspended' ? 'suspendida' : 'cerrada'}.` }, 400);
      // ¿Es un número comprado en Twilio (sirve para entrantes) o un número
      // propio verificado como identificador (solo salientes)?
      let numeroSid = null;
      let entrantes = 'no';
      try {
        const lst = await tw(cred, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(numero)}`);
        const pn = (lst.incoming_phone_numbers || [])[0];
        if (pn) {
          numeroSid = pn.sid;
          await tw(cred, `/IncomingPhoneNumbers/${pn.sid}.json`, { method: 'POST', form: [
            ['VoiceUrl', `${BASE_PUBLICA}${RUTA_TW}entrante`], ['VoiceMethod', 'POST'],
            ['StatusCallback', `${BASE_PUBLICA}${RUTA_TW}estado-entrante`], ['StatusCallbackMethod', 'POST'],
          ] });
          entrantes = 'si';
        }
      } catch (e) { return json({ error: explicarTwilio(e) }, 400); }
      if (!numeroSid) {
        let verificado = false;
        try {
          const ids = await tw(cred, `/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(numero)}`);
          verificado = !!((ids.outgoing_caller_ids || [])[0]);
        } catch (e) { return json({ error: explicarTwilio(e) }, 400); }
        if (!verificado) return json({ error: 'Ese número no está en esta cuenta de Twilio. Cómpralo en Twilio (Phone Numbers → Buy a number) o verifícalo como identificador (Phone Numbers → Verified Caller IDs) y vuelve a intentar.' }, 400);
      }
      // Otra marca no puede usar la misma línea (las entrantes no sabrían a quién ir).
      const otra = await env.DB.prepare('SELECT id, name FROM mkt_clients WHERE tw_numero = ? AND id != ?').bind(numero, c.id).first();
      if (otra) return json({ error: `Ese número ya es la línea de ${otra.name}.` }, 409);
      await env.DB.prepare("UPDATE mkt_clients SET tw_account_sid = ?, tw_auth_token = ?, tw_numero = ?, tw_numero_sid = ?, tw_connected_at = datetime('now') WHERE id = ?")
        .bind(sid, token, numero, numeroSid, c.id).run();
      return json({ ok: true, prueba: cuenta.type === 'Trial', entrantes: entrantes === 'si', linea: resumenLinea(await marca(env, c.id)) });
    }
  }

  return json({ error: 'Not found' }, 404);
}
