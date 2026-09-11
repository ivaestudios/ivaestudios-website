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
const MODELO_VERTEX = 'imagen-4.0-generate-001';
const ASPECTOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);

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

async function porVertex(env, prompt, aspect, n) {
  const sa = saJson(env);
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}`
    + `/locations/${VERTEX_LOCATION}/publishers/google/models/${MODELO_VERTEX}:predict`;
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
  if (!res.ok) throw new Error('Vertex ' + res.status + ': ' + JSON.stringify(data).slice(0, 300));
  const preds = data.predictions || [];
  if (!preds.length) throw new Error('Imagen no devolvió nada (¿el prompt se filtró?): ' + JSON.stringify(data).slice(0, 300));
  return preds.map((p) => 'data:image/png;base64,' + p.bytesBase64Encoded);
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

  const hayGoogle = !!saJson(env);
  const hayOpenAI = !!(env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).trim());
  if (!hayGoogle && !hayOpenAI) return json({ error: 'No hay ningún generador de imagen conectado en Cloudflare.' }, 503);

  let fallaGoogle = null;
  try {
    if (hayGoogle) return json({ ok: true, via: 'vertex', imagenes: await porVertex(env, prompt, aspect, n) });
  } catch (e) {
    fallaGoogle = String((e && e.message) || e).slice(0, 400);
    if (!hayOpenAI) return json({ error: fallaGoogle }, 502);
  }
  try {
    // El aviso dice POR QUÉ no se usó el crédito de Google: sin eso, la app
    // gasta de la tarjeta en silencio (el crédito de Vertex vence 7-dic-2026).
    return json({ ok: true, via: 'openai', aviso: fallaGoogle, imagenes: await porOpenAI(env, prompt, aspect, n) });
  } catch (e) {
    return json({ error: String((e && e.message) || e).slice(0, 400), google: fallaGoogle }, 502);
  }
}
