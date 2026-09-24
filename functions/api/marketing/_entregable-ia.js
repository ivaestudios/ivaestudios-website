// ============================================================================
// IVAE Marketing — ENTREGABLE → CALENDARIO con IA (pedido de Vianey 24-sep-2026):
// "a veces solo subo el video; para programarlo tengo que subirlo al
// calendario: que la IA lo lea y le ponga el guion, el copy y los hashtags".
//
// Dos pasos, cada uno con la herramienta que sabe hacerlo:
//   1. leerEntregable(): Gemini 2.5 Flash VE el video (o la imagen del
//      carrusel) y devuelve transcripción, texto en pantalla y escenas.
//      - Vertex AI (GOOGLE_SA_JSON, lo paga el crédito): inline hasta 19 MB.
//      - Gemini API (GEMINI_API_KEY): Files API, sin tope práctico de tamaño.
//   2. escribirCopy(): Claude (la misma llave del generador de mes) redacta
//      título, gancho, guion, CTA, caption final, hashtags y texto alt con la
//      VOZ real de la marca (sus últimas piezas + brief) y las reglas de la
//      casa (sin clichés de IA, sin guiones largos, sin hechos inventados).
// Ninguno de los dos pasos toca la base: eso lo hace [[path]].js.
// ============================================================================
import { saJson, tokenGoogle } from './_imagen.js';

const MODELO_CLAUDE = 'claude-sonnet-5';
const MODELO_GEMINI = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const TOPE_INLINE = 19 * 1024 * 1024;

function b64(bytes) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < a.length; i += 0x8000) out += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(out);
}

const PROMPT_LECTURA = `Eres el asistente de una agencia de marketing. Mira este contenido completo (video o imagen) y devuelve SOLO un JSON con esta forma:
{
  "transcripcion": "todo lo que se DICE en voz, literal, en su idioma (cadena vacía si no hay voz)",
  "texto_en_pantalla": "los textos que aparecen sobreimpresos, en orden (cadena vacía si no hay)",
  "escenas": [{ "segundo": 0, "que_pasa": "qué se ve y qué hace la persona, una frase" }],
  "tema": "de qué trata en una frase",
  "idioma": "es | en | otro",
  "personas": "quién aparece (p. ej. 'una mujer joven habla a cámara'), sin inventar nombres"
}
No inventes nada: si algo no se entiende, déjalo vacío. Máximo 12 escenas.`;

function extraerJson(texto) {
  const s = String(texto || '').trim();
  const i = s.indexOf('{'); const j = s.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('La IA no devolvió JSON al leer el video.');
  return JSON.parse(s.slice(i, j + 1));
}

function textoDeRespuestaGemini(data) {
  const cand = data && data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.map((p) => p.text || '').join('');
}

async function leerConVertex(env, bytes, mime) {
  const sa = saJson(env);
  const tok = await tokenGoogle(env);
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64(bytes) } }, { text: PROMPT_LECTURA }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 4000 },
  };
  let ultimo = null;
  for (const loc of ['us-central1', 'global']) {
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${sa.project_id}/locations/${loc}/publishers/google/models/${MODELO_GEMINI}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(170000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return extraerJson(textoDeRespuestaGemini(data));
    ultimo = (data.error && data.error.message) || `HTTP ${res.status}`;
    if (res.status !== 404) break;
  }
  throw new Error('Gemini (Vertex) no pudo leer el video: ' + ultimo);
}

async function leerConGeminiApi(env, bytes, mime) {
  const key = String(env.GEMINI_API_KEY).trim();
  // 1) Subida resumable a la Files API (un solo tramo).
  const inicio = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'entregable' } }),
    signal: AbortSignal.timeout(30000),
  });
  const uploadUrl = inicio.headers.get('x-goog-upload-url');
  if (!inicio.ok || !uploadUrl) throw new Error('Gemini no aceptó la subida del video: HTTP ' + inicio.status);
  const subida = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
    signal: AbortSignal.timeout(170000),
  });
  const subido = await subida.json().catch(() => ({}));
  const file = subido && subido.file;
  if (!subida.ok || !file || !file.name) throw new Error('Gemini no guardó el video: HTTP ' + subida.status);
  // 2) Esperar a que lo procese (videos: unos segundos).
  let estado = file.state, uri = file.uri;
  for (let i = 0; i < 40 && estado === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${GEMINI_BASE}/v1beta/${file.name}?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
    const f = await r.json().catch(() => ({}));
    estado = f.state; uri = f.uri || uri;
  }
  if (estado !== 'ACTIVE') throw new Error('Gemini no terminó de procesar el video (' + estado + ').');
  // 3) Leerlo.
  const res = await fetch(`${GEMINI_BASE}/v1beta/models/${MODELO_GEMINI}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ file_data: { mime_type: mime, file_uri: uri } }, { text: PROMPT_LECTURA }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 4000 },
    }),
    signal: AbortSignal.timeout(170000),
  });
  const data = await res.json().catch(() => ({}));
  try { await fetch(`${GEMINI_BASE}/v1beta/${file.name}?key=${encodeURIComponent(key)}`, { method: 'DELETE' }); } catch { /* el archivo caduca solo a las 48 h */ }
  if (!res.ok) throw new Error('Gemini no pudo leer el video: ' + ((data.error && data.error.message) || `HTTP ${res.status}`));
  return extraerJson(textoDeRespuestaGemini(data));
}

/**
 * Lee un video o imagen y devuelve { transcripcion, texto_en_pantalla, escenas, tema, idioma, personas }.
 * @param {object} env
 * @param {{ bytes: ArrayBuffer|Uint8Array, mime: string }} args
 */
export async function leerEntregable(env, { bytes, mime }) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const tieneVertex = !!saJson(env);
  const tieneApi = !!(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim());
  if (!tieneVertex && !tieneApi) throw new Error('Falta conectar Google (GOOGLE_SA_JSON o GEMINI_API_KEY) para que la IA lea el video.');
  if (u8.byteLength <= TOPE_INLINE && tieneVertex) {
    try { return await leerConVertex(env, u8, mime); } catch (e) { if (!tieneApi) throw e; }
  }
  if (tieneApi) return leerConGeminiApi(env, u8, mime);
  throw new Error('El video pesa más de 19 MB y falta GEMINI_API_KEY para leerlo por la Files API.');
}

const ESQUEMA_COPY = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Título interno corto y claro (≤70 caracteres) que diga de qué trata la pieza.' },
    hook: { type: 'string', description: 'El gancho que detiene el scroll (≤120 caracteres). En reel, la primera frase que se dice o se lee.' },
    body: { type: 'string', description: 'El GUION de la pieza tal como quedó grabada: lo que se dice y se muestra, ordenado, en 3-6 líneas hablables. Nada de acotaciones de producción.' },
    cta: { type: 'string', description: 'El cierre accionable (≤120 caracteres).' },
    caption: { type: 'string', description: 'El copy FINAL de Instagram listo para pegar: gancho propio, párrafos cortos, 1-3 emojis por párrafo, cierra con el CTA. SIN hashtags.' },
    hashtags: { type: 'string', description: '8-14 hashtags relevantes separados por espacio, mezcla de locales y de nicho.' },
    alt_text: { type: 'string', description: 'Texto alternativo SEO de la pieza (≤200 caracteres): qué se ve, para quién y dónde, sin hashtags.' },
  },
  required: ['title', 'hook', 'body', 'cta', 'caption', 'hashtags', 'alt_text'],
};

function sistemaCopy(marca) {
  return `Eres el redactor senior de IVAE Marketing (agencia en Cancún) para la marca "${marca}". Te paso lo que la IA VIO y OYÓ en un video (o imagen) YA GRABADO y publicable. Tu trabajo: escribir el guion tal como quedó, el copy final y los hashtags, con la VOZ REAL de la marca (te doy sus piezas: imita su tono, vocabulario y estructura, no los clichés de agencia).

REGLAS DURAS DE LA CASA:
- Español mexicano natural, en el idioma de las piezas previas de la marca (si no hay piezas, español). Aunque el video esté en otro idioma, el copy va en el idioma de la marca. PROHIBIDOS los clichés de IA: "desbloquea", "eleva tu", "sumérgete", "descubre el poder", "no te pierdas", cohetes en exceso.
- PROHIBIDO el guion largo (—) y el punto y coma: usa punto, coma o dos puntos.
- El guion (body) describe la pieza REAL: lo que se dijo y lo que se ve, en orden. No inventes frases que no estén en la transcripción ni datos que no aparezcan (cifras, nombres, premios, testimonios).
- Caption = copy final de Instagram: arranca con un gancho propio, párrafos cortos separados por saltos de línea, 1-3 emojis bien puestos por párrafo, y cierra con el CTA. Sin hashtags dentro.
- CTA: la invitación al DM va DESPUÉS de plantear el valor o la pregunta ("...y si quieres X, escríbeme", "agenda tu valoración"). JAMÁS pedir comentarios ni "comenta la palabra".
- Si la marca ofrece un servicio y el video lo muestra, el copy lo vende con naturalidad; si es un detrás de cámaras o educativo, el copy educa y cierra con una invitación suave.

Entrega SIEMPRE con la herramienta entregar_copy.`;
}

function usuarioCopy({ tipo, titulo, lectura, ejemplos, brief }) {
  const partes = [];
  partes.push(`PIEZA: ${tipo}${titulo ? ` · título interno actual: "${titulo}"` : ''}.`);
  if (tipo === 'carrusel') partes.push('Es un CARRUSEL: la imagen es la tira completa con todos los slides en orden. El body va slide por slide ("Slide 1: …", "Slide 2: …") con el texto real de cada uno; el hook es el texto de la portada.');
  if (brief) partes.push(`BRIEF DE LA MARCA: ${brief}`);
  partes.push(`LO QUE LA IA VIO Y OYÓ:\n${JSON.stringify(lectura, null, 1).slice(0, 9000)}`);
  partes.push(`VOZ REAL de la marca — sus últimas piezas (tipo | título | gancho | caption):\n${ejemplos}`);
  return partes.join('\n\n');
}

/**
 * Redacta título, gancho, guion, CTA, caption, hashtags y alt con Claude.
 */
export async function escribirCopy(env, { marca, brief, ejemplos, tipo, titulo, lectura }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Falta la llave de Claude (ANTHROPIC_API_KEY) en este proyecto.');
  const cuerpo = {
    model: MODELO_CLAUDE,
    max_tokens: 3000,
    system: sistemaCopy(marca),
    messages: [{ role: 'user', content: usuarioCopy({ tipo, titulo, lectura, ejemplos, brief }) }],
    tools: [{ name: 'entregar_copy', description: 'Entrega los textos de la pieza.', input_schema: ESQUEMA_COPY }],
    tool_choice: { type: 'tool', name: 'entregar_copy' },
  };
  let ultimo = null;
  for (let intento = 0; intento < 2; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 1500));
    let res, data;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(90000),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) { ultimo = new Error('No se pudo hablar con Claude: ' + (e && e.message)); continue; }
    if (!res.ok) { ultimo = new Error('Claude respondió ' + res.status + ': ' + ((data.error && data.error.message) || '')); continue; }
    const tool = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'entregar_copy');
    if (!tool || !tool.input) { ultimo = new Error('Claude no entregó los textos.'); continue; }
    const t = tool.input;
    const limpio = (s, n) => String(s || '').replace(/—/g, ',').replace(/;/g, ',').trim().slice(0, n);
    return {
      title: limpio(t.title, 90),
      hook: limpio(t.hook, 200),
      body: limpio(t.body, 4000),
      cta: limpio(t.cta, 200),
      caption: limpio(t.caption, 4000),
      hashtags: limpio(t.hashtags, 400),
      alt_text: limpio(t.alt_text, 300),
    };
  }
  throw ultimo || new Error('La IA no respondió.');
}
