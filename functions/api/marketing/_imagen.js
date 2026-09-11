// ============================================================================
// IVAE Marketing — IMAGEN IA (solo staff).
//
// Genera fotos para los posts con Imagen 4 de Google en Vertex AI, que es lo
// que paga el crédito de 300 USD (la misma GOOGLE_SA_JSON del generador de
// video). Si no hay Google configurado, cae a gpt-image-1 de OpenAI.
//
//   POST /api/marketing/imagen  { prompt, aspect?, n? }
//   → { ok, imagenes: ["data:image/png;base64,…"], via }
//
// aspect: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'  (Imagen no acepta 4:5;
// para un post de Instagram se pide 3:4 y se recorta a 4:5 del lado del que
// llama, que es donde está PIL).
// ============================================================================
const VERTEX_LOCATION = 'us-central1';
// Vertex no expone el mismo catálogo en todos los proyectos: se prueban en
// orden y se usa el primero que responda (el 404 de un modelo no disponible es
// inmediato y barato).
const MODELOS_VERTEX = [
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-preview-06-06',
  'imagen-3.0-generate-002',
  'imagen-3.0-generate-001',
  'imagegeneration@006',
];
const ASPECTOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);

// Devuelve la imagen como bytes (image/png|jpeg) en vez de base64 dentro de
// un JSON: empaquetar 1.6 MB de base64 en JSON.stringify tumbaba el Worker
// (502) 3 de cada 4 veces; los bytes crudos salen sin problema.
function binario(dataUrl, extra = {}) {
  const coma = dataUrl.indexOf(',');
  const mime = (dataUrl.slice(5, coma).split(';')[0]) || 'image/png';
  const b64 = dataUrl.slice(coma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const headers = { 'Content-Type': mime, 'Cache-Control': 'no-store' };
  for (const [k, v] of Object.entries(extra)) if (v != null) headers[k] = String(v).slice(0, 200);
  return new Response(bytes, { status: 200, headers });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function saJson(env) {
  if (!env.GOOGLE_SA_JSON) return null;
  try {
    const sa = JSON.parse(env.GOOGLE_SA_JSON);
    if (sa && sa.client_email && sa.private_key && sa.project_id) return sa;
  } catch { /* llave mal pegada */ }
  return null;
}
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
let _tok = null;
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
    exp: ahora + 3600, iat: ahora,
  }));
  const llave = await crypto.subtle.importKey(
    'pkcs8', pemADer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const firma = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, llave, new TextEncoder().encode(`${cabeza}.${cuerpo}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabeza}.${cuerpo}.${b64url(firma)}`,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('Google no dio token: ' + (data.error_description || data.error || res.status));
  _tok = { valor: data.access_token, expira: ahora + (Number(data.expires_in) || 3600) };
  return _tok.valor;
}

async function unModeloVertex(env, modelo, prompt, aspect, n) {
  const sa = saJson(env);
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}`
    + `/locations/${VERTEX_LOCATION}/publishers/google/models/${modelo}:predict`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenGoogle(env)}` },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: n, aspectRatio: aspect, personGeneration: 'allow_adult', addWatermark: false },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error('Vertex ' + res.status + ': ' + JSON.stringify(data).slice(0, 220));
    err.noExiste = res.status === 404 || res.status === 403;
    throw err;
  }
  const preds = data.predictions || [];
  if (!preds.length) throw new Error('Imagen no devolvió nada (¿el prompt se filtró?): ' + JSON.stringify(data).slice(0, 220));
  return { modelo, imagenes: preds.map((p) => 'data:image/png;base64,' + p.bytesBase64Encoded) };
}

// GEMINI IMAGE en Vertex (gemini-2.5-flash-image, "nano banana"): también lo
// paga el crédito y suele estar disponible aunque Imagen no. Se intenta en
// us-central1 y en global.
async function porGeminiImagen(env, prompt, aspect, n) {
  const sa = saJson(env);
  const tok = await tokenGoogle(env);
  let ultimo = null;
  for (const loc of ['us-central1', 'global']) {
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${sa.project_id}/locations/${loc}/publishers/google/models/gemini-2.5-flash-image:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect }, candidateCount: 1 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      ultimo = Object.assign(new Error(`Gemini ${loc} ${res.status}: ` + JSON.stringify(data).slice(0, 200)), { noExiste: res.status === 404 || res.status === 403 });
      if (!ultimo.noExiste) throw ultimo;
      continue;
    }
    const partes = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const imgs = partes.filter((p) => p.inlineData && p.inlineData.data)
      .map((p) => `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`);
    if (!imgs.length) throw new Error('Gemini no devolvió imagen: ' + JSON.stringify(data).slice(0, 200));
    return { modelo: `gemini-2.5-flash-image@${loc}`, imagenes: imgs.slice(0, n) };
  }
  throw ultimo || new Error('Gemini image no disponible.');
}

// Si el proyecto no tiene NINGÚN modelo de imagen (todos 404), se recuerda lo
// que viva el isolate para no gastar llamadas fallidas por cada foto.
let _vertexSinImagen = false;
async function porVertex(env, prompt, aspect, n) {
  if (_vertexSinImagen) throw Object.assign(new Error('Vertex sin generador de imagen en este proyecto (ya probado).'), { noExiste: true });
  let ultimo = null;
  try { return await porGeminiImagen(env, prompt, aspect, n); }
  catch (e) { ultimo = e; if (!e.noExiste) throw e; }
  for (const m of MODELOS_VERTEX) {
    try { return await unModeloVertex(env, m, prompt, aspect, n); }
    catch (e) { ultimo = e; if (!e.noExiste) throw e; }
  }
  _vertexSinImagen = true;
  throw ultimo || new Error('Ningún modelo de imagen disponible en el proyecto.');
}

async function porOpenAI(env, prompt, aspect, n) {
  const size = aspect === '9:16' ? '1024x1536' : (aspect === '16:9' ? '1536x1024' : (aspect === '1:1' ? '1024x1024' : '1024x1536'));
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${String(env.OPENAI_API_KEY).trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n, size, quality: 'high' }),
    signal: AbortSignal.timeout(180000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + JSON.stringify(data).slice(0, 300));
  return (data.data || []).map((d) => 'data:image/png;base64,' + d.b64_json);
}

export async function handleImagen(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const prompt = String(b.prompt || '').trim();
  if (!prompt) return json({ error: 'Falta el prompt' }, 400);
  if (prompt.length > 4000) return json({ error: 'Prompt demasiado largo (máximo 4000)' }, 400);
  const aspect = ASPECTOS.has(b.aspect) ? b.aspect : '3:4';
  const n = Math.min(4, Math.max(1, Number(b.n) || 1));
  // motor: 'auto' (Google y si falla OpenAI), 'google' u 'openai'. El proyecto
  // de Google de prueba tiene cuota mínima (429 seguidos): para lotes, 'openai'.
  const motor = ['google', 'openai'].includes(b.motor) ? b.motor : 'auto';

  const hayGoogle = !!saJson(env) && motor !== 'openai';
  const hayOpenAI = !!(env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).trim()) && motor !== 'google';
  if (!hayGoogle && !hayOpenAI) return json({ error: 'No hay ningún generador de imagen conectado en Cloudflare.' }, 503);

  let fallaGoogle = null;
  try {
    if (hayGoogle) {
      const r = await porVertex(env, prompt, aspect, n);
      if (n === 1) return binario(r.imagenes[0], { 'X-Via': 'vertex', 'X-Modelo': r.modelo });
      return json({ ok: true, via: 'vertex', modelo: r.modelo, imagenes: r.imagenes });
    }
  } catch (e) {
    fallaGoogle = String((e && e.message) || e).slice(0, 400);
    if (!hayOpenAI) return json({ ok: false, error: fallaGoogle }, 424);
  }
  try {
    // El aviso dice POR QUÉ no se usó el crédito de Google: sin eso, la app
    // gasta de la tarjeta en silencio (el crédito de Vertex vence 7-dic-2026).
    const imgs = await porOpenAI(env, prompt, aspect, n);
    if (n === 1) return binario(imgs[0], { 'X-Via': 'openai', 'X-Aviso': fallaGoogle });
    return json({ ok: true, via: 'openai', aviso: fallaGoogle, imagenes: imgs });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 400), google: fallaGoogle }, 424);
  }
}
