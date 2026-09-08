// ============================================================================
// IVAE Marketing — Generador de video con IA (SOLO staff).
//
// DOS PROVEEDORES, un mismo flujo:
//
//   google  → Veo 3.1 de Google. Es el bueno (video CON audio nativo).
//             Dos formas de entrar, y NO son lo mismo para el bolsillo:
//               a) VERTEX AI  (GOOGLE_SA_JSON) → lo paga el crédito de $300.
//               b) API GEMINI (GEMINI_API_KEY) → NO lo paga el crédito de $300;
//                  se le cobra a la tarjeta. Google lo dice textual:
//                  "The $300 credit can't pay for Gemini API in AI Studio costs."
//             Si están las dos, gana Vertex.
//   fal     → FastWan (FAL_KEY). B-roll sin personas, baratísimo, sin audio.
//
// Precios verificados el 7-sep-2026 (misma tarifa en Vertex y en Gemini), POR
// SEGUNDO de video generado, audio incluido:
//   Veo 3.1 Lite  720p $0.05   ·  1080p $0.08
//   Veo 3.1 Fast  720p $0.10   ·  1080p $0.12
//   Veo 3.1       720p/1080p $0.40
// Un clip de 8 s en Lite cuesta $0.40 USD (unos 8 pesos). Ver
// _docs/VERTEX_VEO_SPEC.md para el contrato completo y las fuentes.
//
// Flujo: POST /video-ia/jobs → fila en mkt_video_jobs + arranque en el proveedor
//        GET  /video-ia/jobs/:id → si sigue corriendo, pregunta; al terminar
//             baja el MP4 y lo guarda en R2 (marketing/video-ia/<id>.mp4)
//        GET  /video-ia/jobs?client_id → lista + gasto del mes por marca
//        GET  /video-ia/jobs/:id/video → sirve el MP4 desde R2
//        POST /video-ia/escena → Claude propone la descripción de la escena
// ============================================================================

const FAL_QUEUE = 'https://queue.fal.run';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_LOCATION = 'us-central1'; // Veo 3.1 SOLO vive en us-central1.

// ---------------------------------------------------------------------------
// Catálogo. El precio que se le enseña a la dueña ANTES de generar es
// usd_segundo × segundos, y ese mismo número es el que se anota como costo.
// Cada nivel de Google trae los DOS identificadores de modelo porque Vertex y
// la API de Gemini les pusieron nombres distintos al mismo modelo.
// ---------------------------------------------------------------------------
export const CATALOGO = {
  economico: {
    label: 'Económico',
    sub: 'Veo 3.1 Lite. Con audio. Es el que conviene para la mayoría de los reels.',
    proveedor: 'google',
    vertex: 'veo-3.1-lite-generate-001',
    gemini: 'veo-3.1-lite-generate-preview',
    modelo: 'Veo 3.1 Lite · 720p con audio',
    resolution: '720p', usdSeg: 0.05, audio: true, personas: true,
  },
  bueno: {
    label: 'Bueno',
    sub: 'Veo 3.1 Fast. Más detalle y mejor movimiento que el económico.',
    proveedor: 'google',
    vertex: 'veo-3.1-fast-generate-001',
    gemini: 'veo-3.1-fast-generate-preview',
    modelo: 'Veo 3.1 Fast · 720p con audio',
    resolution: '720p', usdSeg: 0.10, audio: true, personas: true,
  },
  mejor: {
    label: 'El mejor',
    sub: 'Veo 3.1 completo en 1080p. Para la toma principal de un anuncio.',
    proveedor: 'google',
    vertex: 'veo-3.1-generate-001',
    gemini: 'veo-3.1-generate-preview',
    modelo: 'Veo 3.1 · 1080p con audio',
    resolution: '1080p', usdSeg: 0.40, audio: true, personas: true,
  },
  broll: {
    label: 'B-roll suelto',
    sub: 'Sin audio y sin personas: paisajes, objetos, ambiente. Centavos.',
    proveedor: 'fal',
    endpoint: 'fal-ai/wan/v2.2-5b/text-to-video/fast-wan',
    modelo: 'FastWan 2.2 · 720p sin audio',
    resolution: '720p', usdSeg: 0.005, audio: false, personas: false,
  },
};

// Veo solo acepta 4, 6 u 8 segundos. FastWan da 5.
const SEGUNDOS_GOOGLE = [4, 6, 8];
const SEGUNDOS_FAL = [5];

// ALARGAR: Veo continúa un video suyo 7 segundos más, en el MISMO plano y sin
// corte, y devuelve el video COMPLETO (8 s → 15 s → 22 s → 29 s). Probado el
// 7-sep-2026 contra Vertex con los tres modelos: los tres alargan.
// El campo `task:"extend"` que dice la documentación NO existe todavía; basta
// con mandar `video` dentro de la instancia y Veo entiende que es continuación.
const ALARGAR_SEG = 7;
const ALARGAR_MAX = 29; // Google no acepta videos de más de 30 s como entrada.

const MKT_NOW = "strftime('%Y-%m-%d %H:%M:%f','now')";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function nuevoId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// --- qué está configurado ---------------------------------------------------
function saJson(env) {
  if (!env.GOOGLE_SA_JSON) return null;
  try {
    const sa = JSON.parse(env.GOOGLE_SA_JSON);
    if (sa && sa.client_email && sa.private_key && sa.project_id) return sa;
  } catch { /* llave mal pegada */ }
  return null;
}
function viaGoogle(env) {
  if (saJson(env)) return 'vertex';
  if (env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim()) return 'gemini';
  return null;
}
function viaFal(env) { return !!(env.FAL_KEY && String(env.FAL_KEY).trim()); }

function disponible(env, tier) {
  const cat = CATALOGO[tier];
  if (!cat) return false;
  return cat.proveedor === 'google' ? !!viaGoogle(env) : viaFal(env);
}

// ---------------------------------------------------------------------------
// OAuth de Google desde el Worker: JWT RS256 firmado con WebCrypto y canjeado
// por un access token de una hora. No hay librerías; Workers trae RSASSA.
// ---------------------------------------------------------------------------
let _tok = null; // { valor, expira } — vive lo que viva el isolate

function b64url(bytes) {
  let bin = '';
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) bin += String.fromCharCode(a[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlTexto(s) { return b64url(new TextEncoder().encode(s)); }

function pemADer(pem) {
  const limpio = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(limpio);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function tokenGoogle(env) {
  const ahora = Math.floor(Date.now() / 1000);
  if (_tok && _tok.expira > ahora + 60) return _tok.valor;
  const sa = saJson(env);
  if (!sa) throw new Error('Falta GOOGLE_SA_JSON');
  const cabeza = b64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64urlTexto(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: ahora + 3600,
    iat: ahora,
  }));
  const llave = await crypto.subtle.importKey(
    'pkcs8', pemADer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const firma = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, llave, new TextEncoder().encode(`${cabeza}.${cuerpo}`));
  const jwt = `${cabeza}.${cuerpo}.${b64url(firma)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error('Google no dio token: ' + (data.error_description || data.error || res.status));
  }
  _tok = { valor: data.access_token, expira: ahora + (Number(data.expires_in) || 3600) };
  return _tok.valor;
}

// --- llamadas a Google ------------------------------------------------------
async function googleFetch(env, url, body) {
  const via = viaGoogle(env);
  const headers = { 'Content-Type': 'application/json' };
  if (via === 'vertex') headers['Authorization'] = `Bearer ${await tokenGoogle(env)}`;
  else headers['x-goog-api-key'] = String(env.GEMINI_API_KEY).trim();
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function urlArranque(env, cat) {
  if (viaGoogle(env) === 'vertex') {
    const sa = saJson(env);
    return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}`
      + `/locations/${VERTEX_LOCATION}/publishers/google/models/${cat.vertex}:predictLongRunning`;
  }
  return `${GEMINI_BASE}/models/${cat.gemini}:predictLongRunning`;
}

function cuerpoGoogle(env, cat, prompt, aspect, seconds, videoB64) {
  const parameters = {
    aspectRatio: aspect,
    resolution: cat.resolution,
    durationSeconds: seconds,
    sampleCount: 1,
    generateAudio: !!cat.audio,
    personGeneration: 'allow_adult',
  };
  if (videoB64) {
    // Continuación: se manda el video anterior y Veo sigue el mismo plano.
    // Sin `resolution` (la hereda del original) y sin `task` (no existe).
    delete parameters.resolution;
    return { instances: [{ prompt, video: { bytesBase64Encoded: videoB64, mimeType: 'video/mp4' } }], parameters };
  }
  // La API de Gemini no documenta sampleCount/personGeneration: se mandan solo
  // los campos que sí acepta, para no arriesgar un 400 por campo desconocido.
  if (viaGoogle(env) !== 'vertex') {
    delete parameters.sampleCount;
    delete parameters.personGeneration;
  }
  return { instances: [{ prompt }], parameters };
}

// El nombre de la operación viene distinto según la puerta; ambas lo ponen en
// `name`. Vertex además exige mandarlo de vuelta al endpoint del modelo.
function urlSondeo(env, cat, operacion) {
  if (viaGoogle(env) === 'vertex') {
    const sa = saJson(env);
    return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}`
      + `/locations/${VERTEX_LOCATION}/publishers/google/models/${cat.vertex}:fetchPredictOperation`;
  }
  return `${GEMINI_BASE}/${operacion}`;
}

// Busca el video dentro de la respuesta, sea cual sea la forma. Vertex devuelve
// response.videos[]; la API de Gemini response.generateVideoResponse
// .generatedSamples[].video. Se recorre el árbol para no romperse si cambian.
function hallarVideo(nodo, prof = 0) {
  if (!nodo || prof > 8) return null;
  if (typeof nodo === 'object') {
    if (typeof nodo.bytesBase64Encoded === 'string' && nodo.bytesBase64Encoded.length > 1000) {
      return { b64: nodo.bytesBase64Encoded };
    }
    if (typeof nodo.uri === 'string' && /^https?:/.test(nodo.uri)) return { uri: nodo.uri };
    if (typeof nodo.gcsUri === 'string') return { gcsUri: nodo.gcsUri };
    for (const k of Object.keys(nodo)) {
      const r = hallarVideo(nodo[k], prof + 1);
      if (r) return r;
    }
  }
  return null;
}

function b64ABytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Bytes → base64 por trozos: btoa sobre 13 MB de golpe revienta la pila.
function bytesAB64(bytes) {
  const paso = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += paso) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
  }
  return btoa(bin);
}

// --- llamadas a fal ---------------------------------------------------------
async function falFetch(env, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || 25000),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
function cuerpoFal(prompt, aspect) {
  return {
    prompt, aspect_ratio: aspect, resolution: '720p', num_frames: 121, frames_per_second: 24,
    enable_prompt_expansion: true, video_quality: 'high', enable_safety_checker: false,
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export async function estado(env) {
  const via = viaGoogle(env);
  const catalogo = {};
  for (const [k, c] of Object.entries(CATALOGO)) {
    catalogo[k] = {
      label: c.label, sub: c.sub, modelo: c.modelo, proveedor: c.proveedor,
      usdSeg: c.usdSeg, audio: c.audio, personas: c.personas,
      segundos: c.proveedor === 'google' ? SEGUNDOS_GOOGLE : SEGUNDOS_FAL,
      listo: disponible(env, k),
    };
  }
  return json({
    ok: true,
    configurado: !!(via || viaFal(env)),
    google: via,                  // 'vertex' | 'gemini' | null
    fal: viaFal(env),
    // Aviso honesto para la pantalla: por dónde se está pagando.
    pagando: via === 'vertex' ? 'credito' : (via === 'gemini' ? 'tarjeta' : null),
    catalogo,
  });
}

export async function crearJob(request, env, session) {
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const client_id = String(b.client_id || '').trim();
  const tier = String(b.tier || 'economico');
  const prompt = String(b.prompt || '').trim();
  const aspect = ['9:16', '16:9'].includes(b.aspect) ? b.aspect : '9:16';
  const post_id = b.post_id ? String(b.post_id) : null;
  const cat = CATALOGO[tier];
  if (!client_id) return json({ error: 'Falta la marca.' }, 400);
  if (!cat) return json({ error: 'Calidad desconocida.' }, 400);
  if (!disponible(env, tier)) {
    return json({ error: cat.proveedor === 'google'
      ? 'Falta conectar Google en Cloudflare (GOOGLE_SA_JSON o GEMINI_API_KEY).'
      : 'Falta la llave de fal.ai (FAL_KEY) en Cloudflare.' }, 503);
  }
  const permitidos = cat.proveedor === 'google' ? SEGUNDOS_GOOGLE : SEGUNDOS_FAL;
  const seconds = permitidos.includes(Number(b.seconds)) ? Number(b.seconds) : permitidos[permitidos.length - 1];
  if (prompt.length < 12) return json({ error: 'Describe la escena con un poco más de detalle.' }, 400);
  if (prompt.length > 1500) return json({ error: 'La descripción es demasiado larga (máximo 1500 caracteres).' }, 400);
  const cli = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(client_id).first();
  if (!cli) return json({ error: 'Marca no encontrada.' }, 404);

  const via = cat.proveedor === 'google' ? viaGoogle(env) : 'fal';
  const modelo = cat.proveedor === 'google' ? (via === 'vertex' ? cat.vertex : cat.gemini) : cat.endpoint;
  const costo = Number((cat.usdSeg * seconds).toFixed(4));
  const id = nuevoId();
  await env.DB.prepare(
    `INSERT INTO mkt_video_jobs (id, client_id, post_id, tier, model, prompt, aspect, seconds, status, provider, cost_usd, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`
  ).bind(id, client_id, post_id, tier, modelo, prompt, aspect, seconds, via, costo, session.email || null).run();

  const falla = async (msg) => {
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`)
      .bind(String(msg).slice(0, 400), id).run();
  };

  try {
    if (cat.proveedor === 'google') {
      const r = await googleFetch(env, urlArranque(env, cat), cuerpoGoogle(env, cat, prompt, aspect, seconds));
      const operacion = r.data && r.data.name;
      if (!r.res.ok || !operacion) {
        const msg = (r.data && r.data.error && (r.data.error.message || r.data.error.status)) || `Google respondió ${r.res.status}`;
        await falla(msg);
        return json({ error: String(msg) }, 502);
      }
      await env.DB.prepare(
        `UPDATE mkt_video_jobs SET status='running', request_id=?, status_url=?, updated_at=${MKT_NOW} WHERE id=?`
      ).bind(operacion, urlSondeo(env, cat, operacion), id).run();
    } else {
      const r = await falFetch(env, `${FAL_QUEUE}/${cat.endpoint}`, { method: 'POST', body: JSON.stringify(cuerpoFal(prompt, aspect)) });
      if (!r.res.ok || !r.data.request_id) {
        const msg = (r.data && (r.data.detail || r.data.error || r.data.message)) || `fal respondió ${r.res.status}`;
        await falla(typeof msg === 'string' ? msg : 'El proveedor rechazó la petición.');
        return json({ error: typeof msg === 'string' ? msg : 'El proveedor rechazó la petición.' }, 502);
      }
      await env.DB.prepare(
        `UPDATE mkt_video_jobs SET status='running', request_id=?, status_url=?, response_url=?, updated_at=${MKT_NOW} WHERE id=?`
      ).bind(r.data.request_id, r.data.status_url || null, r.data.response_url || null, id).run();
    }
  } catch (e) {
    await falla('No se pudo hablar con el proveedor: ' + (e && e.message));
    return json({ error: 'No se pudo hablar con el proveedor. Intenta de nuevo.' }, 502);
  }

  const job = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  return json({ ok: true, job: publico(job) }, 201);
}

function publico(j) {
  if (!j) return null;
  const { status_url, response_url, request_id, ...rest } = j;
  const cat = CATALOGO[j.tier];
  return {
    ...rest,
    video_url: j.status === 'done' ? `/api/marketing/video-ia/jobs/${j.id}/video` : null,
    // La pantalla usa esto para enseñar u ocultar el botón "Alargar".
    puede_alargar: j.status === 'done' && j.provider === 'vertex'
      && !!(cat && cat.proveedor === 'google') && Number(j.seconds || 0) < ALARGAR_MAX,
    alargar_usd: cat && cat.proveedor === 'google' ? Number((cat.usdSeg * ALARGAR_SEG).toFixed(4)) : null,
  };
}

// ---------------------------------------------------------------------------
// ALARGAR: continúa un clip 7 s más, en el mismo plano y sin corte. Veo
// devuelve el video COMPLETO, así que el hijo reemplaza al padre a la vista.
// ---------------------------------------------------------------------------
export async function alargarJob(request, env, session, id) {
  if (viaGoogle(env) !== 'vertex') {
    return json({ error: 'Alargar solo funciona por Vertex AI (el que paga el crédito de Google).' }, 503);
  }
  const padre = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  if (!padre) return json({ error: 'No existe ese video.' }, 404);
  if (padre.status !== 'done' || !padre.video_key) return json({ error: 'Ese clip todavía no está listo.' }, 409);
  const cat = CATALOGO[padre.tier];
  if (!cat || cat.proveedor !== 'google') return json({ error: 'Ese clip no se puede alargar.' }, 409);
  const yaDura = Number(padre.seconds || 0);
  if (yaDura >= ALARGAR_MAX) {
    return json({ error: `Ya llegó al máximo que permite Google (${ALARGAR_MAX} segundos de una sola toma).` }, 409);
  }

  let b; try { b = await request.json(); } catch { b = {}; }
  const sigue = String(b.prompt || '').trim();
  // Sin indicación nueva, se le pide continuar lo que ya estaba pasando.
  const prompt = sigue.length >= 8
    ? sigue.slice(0, 1500)
    : `Seamless continuation of the same shot: same person, same wardrobe, same room, same lighting and same camera. The action continues naturally from where it left off. ${String(padre.prompt || '').slice(0, 900)}`;

  const obj = await env.R2_BUCKET.get(padre.video_key);
  if (!obj) return json({ error: 'No encontré el archivo del clip anterior.' }, 404);
  let videoB64;
  try {
    videoB64 = bytesAB64(new Uint8Array(await obj.arrayBuffer()));
  } catch {
    return json({ error: 'El clip ya pesa demasiado para alargarlo otra vez.' }, 413);
  }

  const total = Math.min(ALARGAR_MAX + 1, yaDura + ALARGAR_SEG);
  const costo = Number((cat.usdSeg * ALARGAR_SEG).toFixed(4)); // Google cobra solo lo nuevo.
  const nuevo = nuevoId();
  await env.DB.prepare(
    `INSERT INTO mkt_video_jobs (id, client_id, post_id, tier, model, prompt, aspect, seconds, status, provider, cost_usd, created_by, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'vertex', ?, ?, ?)`
  ).bind(nuevo, padre.client_id, padre.post_id, padre.tier, cat.vertex, prompt, padre.aspect, total, costo, session.email || null, padre.id).run();

  try {
    const r = await googleFetch(env, urlArranque(env, cat), cuerpoGoogle(env, cat, prompt, padre.aspect, ALARGAR_SEG, videoB64));
    const operacion = r.data && r.data.name;
    if (!r.res.ok || !operacion) {
      const msg = (r.data && r.data.error && (r.data.error.message || r.data.error.status)) || `Google respondió ${r.res.status}`;
      await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`)
        .bind(String(msg).slice(0, 400), nuevo).run();
      return json({ error: String(msg) }, 502);
    }
    await env.DB.prepare(
      `UPDATE mkt_video_jobs SET status='running', request_id=?, status_url=?, updated_at=${MKT_NOW} WHERE id=?`
    ).bind(operacion, urlSondeo(env, cat, operacion), nuevo).run();
  } catch (e) {
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`)
      .bind('No se pudo hablar con Google: ' + (e && e.message), nuevo).run();
    return json({ error: 'No se pudo hablar con Google. Intenta de nuevo.' }, 502);
  }

  const job = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(nuevo).first();
  return json({ ok: true, job: publico(job) }, 201);
}

// Guarda el MP4 en R2 y marca el job como terminado. Los links de los
// proveedores caducan: por eso SIEMPRE se copia.
async function guardarVideo(env, job, bytesOrBody, tipo = 'video/mp4') {
  const key = `marketing/video-ia/${job.id}.mp4`;
  await env.R2_BUCKET.put(key, bytesOrBody, { httpMetadata: { contentType: tipo, cacheControl: 'private, max-age=86400' } });
  await env.DB.prepare(`UPDATE mkt_video_jobs SET status='done', video_key=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`)
    .bind(key, job.id).run();
  return { ...job, status: 'done', video_key: key };
}

async function marcarError(env, job, msg) {
  await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`)
    .bind(String(msg).slice(0, 400), job.id).run();
  return { ...job, status: 'error', error: String(msg) };
}

// Consulta al proveedor y, si terminó, guarda el video. Idempotente.
async function refrescar(env, job) {
  if (job.status !== 'running' || !job.status_url) return job;
  try {
    return job.provider === 'fal' ? await refrescarFal(env, job) : await refrescarGoogle(env, job);
  } catch {
    return job; // transitorio: se reintenta en el siguiente sondeo
  }
}

async function refrescarGoogle(env, job) {
  const via = viaGoogle(env);
  if (!via) return job;
  let r;
  if (via === 'vertex') r = await googleFetch(env, job.status_url, { operationName: job.request_id });
  else r = await googleFetch(env, job.status_url, undefined);

  if (!r.res.ok) {
    // 404/401 son definitivos; el resto puede ser un tropiezo pasajero.
    if (r.res.status === 404 || r.res.status === 401 || r.res.status === 403) {
      const msg = (r.data && r.data.error && r.data.error.message) || `Google respondió ${r.res.status}`;
      return marcarError(env, job, msg);
    }
    return job;
  }
  if (!r.data || r.data.done !== true) return job;
  if (r.data.error) {
    return marcarError(env, job, r.data.error.message || 'Google no pudo generar el video.');
  }
  const filtrados = r.data.response && Number(r.data.response.raiMediaFilteredCount || 0);
  const hallado = hallarVideo(r.data.response);
  if (!hallado) {
    return marcarError(env, job, filtrados
      ? 'Google bloqueó el video por sus reglas de contenido. Cambia la descripción de la escena.'
      : 'El proveedor terminó sin entregar video.');
  }
  if (hallado.b64) {
    return guardarVideo(env, job, b64ABytes(hallado.b64));
  }
  if (hallado.uri) {
    // La API de Gemini entrega un link que solo abre con la misma llave.
    const headers = via === 'vertex'
      ? { Authorization: `Bearer ${await tokenGoogle(env)}` }
      : { 'x-goog-api-key': String(env.GEMINI_API_KEY).trim() };
    const vres = await fetch(hallado.uri, { headers, redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!vres.ok || !vres.body) return job;
    return guardarVideo(env, job, vres.body);
  }
  // gcsUri: solo pasa si algún día se pide storageUri. Hoy no se pide.
  return marcarError(env, job, 'El video quedó en Cloud Storage y esta app no lee de ahí.');
}

async function refrescarFal(env, job) {
  if (!viaFal(env)) return job;
  const st = await falFetch(env, job.status_url, { method: 'GET' });
  const s = st.data && st.data.status;
  if (s === 'IN_QUEUE' || s === 'IN_PROGRESS') return job;
  if (s !== 'COMPLETED') {
    const msg = (st.data && (st.data.detail || st.data.error)) || `estado ${s || st.res.status}`;
    return marcarError(env, job, msg);
  }
  const out = await falFetch(env, job.response_url, { method: 'GET' });
  const videoUrl = out.data && out.data.video && out.data.video.url;
  if (!videoUrl) return marcarError(env, job, 'El proveedor terminó sin entregar video.');
  const vres = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
  if (!vres.ok || !vres.body) return job;
  return guardarVideo(env, job, vres.body);
}

export async function verJob(env, id) {
  let job = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  if (!job) return json({ error: 'No existe ese video.' }, 404);
  if (job.status === 'running') job = await refrescar(env, job);
  return json({ ok: true, job: publico(job) });
}

export async function listarJobs(env, url) {
  const client_id = String(url.searchParams.get('client_id') || '').trim();
  if (!client_id) return json({ error: 'Falta client_id' }, 400);
  const rows = (await env.DB.prepare(
    'SELECT * FROM mkt_video_jobs WHERE client_id = ? ORDER BY created_at DESC LIMIT 60'
  ).bind(client_id).all()).results || [];
  const out = [];
  let refrescados = 0;
  for (const j of rows) {
    if (j.status === 'running' && refrescados < 6) { out.push(await refrescar(env, j)); refrescados++; }
    else out.push(j);
  }
  const mes = new Date().toISOString().slice(0, 7);
  const gasto = await env.DB.prepare(
    `SELECT COUNT(*) n, COALESCE(SUM(cost_usd),0) usd FROM mkt_video_jobs WHERE client_id = ? AND status IN ('done','running') AND substr(created_at,1,7) = ?`
  ).bind(client_id, mes).first();
  return json({ ok: true, jobs: out.map(publico), gasto_mes: { clips: gasto.n, usd: Number(gasto.usd) } });
}

export async function servirVideo(request, env, id) {
  const job = await env.DB.prepare('SELECT id, video_key, status FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  if (!job || job.status !== 'done' || !job.video_key) return new Response('Sin video', { status: 404 });
  const range = request.headers.get('Range');
  const opt = {};
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) opt.range = { offset: Number(m[1]), length: m[2] ? Number(m[2]) - Number(m[1]) + 1 : undefined };
  }
  const obj = await env.R2_BUCKET.get(job.video_key, opt);
  if (!obj) return new Response('Sin video', { status: 404 });
  const h = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400',
    'Content-Disposition': `inline; filename="video-ia-${id.slice(0, 8)}.mp4"` });
  if (opt.range && obj.range) {
    const start = obj.range.offset, end = start + obj.range.length - 1;
    h.set('Content-Range', `bytes ${start}-${end}/${obj.size}`); h.set('Content-Length', String(obj.range.length));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers: h });
}

export async function borrarJob(env, id) {
  const job = await env.DB.prepare('SELECT id, video_key FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  if (!job) return json({ error: 'No existe.' }, 404);
  if (job.video_key) { try { await env.R2_BUCKET.delete(job.video_key); } catch { /* noop */ } }
  await env.DB.prepare('DELETE FROM mkt_video_jobs WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// Claude propone la escena. Recibe hook/guion y devuelve {prompt_en, nota_es}.
export async function proponerEscena(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Falta la llave de Anthropic.' }, 503);
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const hook = String(b.hook || '').slice(0, 600);
  const guion = String(b.guion || '').slice(0, 2000);
  const marca = String(b.marca || '').slice(0, 120);
  const cat = CATALOGO[String(b.tier || '')] || CATALOGO.economico;
  if (!hook && !guion) return json({ error: 'Pásame el hook o el guion de la pieza.' }, 400);
  const reglas = cat.personas
    ? 'The clip may include ONE person (describe age, look, wardrobe, mood) and native ambient audio; no dialogue longer than a short line.'
    : 'B-roll only: NO people speaking, no close-up hands, no readable text or logos. Environments, objects, light, movement.';
  const sistema = `You write prompts for text-to-video models (Veo, Wan). Output STRICT JSON: {"prompt_en": string, "nota_es": string}.
prompt_en: one paragraph, 60-110 words, in English, concrete and filmable: subject, setting, camera (shot size, movement), lighting, color palette, mood. Vertical 9:16. ${reglas} Never ask the model to render text.
nota_es: 1-2 sentences in Spanish telling the marketer what the clip shows and why it fits the piece.`;
  const usuario = `Brand: ${marca || 'n/a'}\nHook: ${hook}\nScript: ${guion}`;
  let res, data;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: sistema, messages: [{ role: 'user', content: usuario }] }),
      signal: AbortSignal.timeout(25000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) { return json({ error: 'No se pudo hablar con Claude: ' + (e && e.message) }, 502); }
  const texto = (data.content && data.content[0] && data.content[0].text) || '';
  const m = texto.match(/\{[\s\S]*\}/);
  try {
    const out = JSON.parse(m ? m[0] : texto);
    return json({ ok: true, prompt_en: String(out.prompt_en || '').trim(), nota_es: String(out.nota_es || '').trim() });
  } catch { return json({ error: 'Claude no devolvió una escena válida. Intenta de nuevo.' }, 502); }
}

export async function handleVideoIa(request, env, session, url, parts) {
  // parts = ['video-ia', ...]
  const method = request.method;
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (parts.length === 2 && parts[1] === 'estado' && method === 'GET') return estado(env);
  if (parts.length === 2 && parts[1] === 'escena' && method === 'POST') return proponerEscena(request, env);
  if (parts.length === 2 && parts[1] === 'jobs' && method === 'GET') return listarJobs(env, url);
  if (parts.length === 2 && parts[1] === 'jobs' && method === 'POST') return crearJob(request, env, session);
  if (parts.length === 3 && parts[1] === 'jobs' && method === 'GET') return verJob(env, parts[2]);
  if (parts.length === 3 && parts[1] === 'jobs' && method === 'DELETE') return borrarJob(env, parts[2]);
  if (parts.length === 4 && parts[1] === 'jobs' && parts[3] === 'alargar' && method === 'POST') return alargarJob(request, env, session, parts[2]);
  if (parts.length === 4 && parts[1] === 'jobs' && parts[3] === 'video' && (method === 'GET' || method === 'HEAD')) return servirVideo(request, env, parts[2]);
  return json({ error: 'Not found' }, 404);
}
