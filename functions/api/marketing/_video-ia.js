// ============================================================================
// IVAE Marketing — Generador de video con IA (SOLO staff).
//
// Proveedor v1: fal.ai (pago por uso, sin membresía). Se eligió por el informe
// INFORME-VIDEO-IA-Y-META.md (15/16-ago-2026): FastWan a $0.025 el clip para
// b-roll y Veo 3 Fast para la toma con persona y audio. Google Vertex (los $300
// gratis) entra en v2 como segundo proveedor; el catálogo ya lo contempla.
//
// Flujo: POST /video-ia/jobs → fila en mkt_video_jobs + POST a la cola de fal
//        GET  /video-ia/jobs/:id → si sigue corriendo, consulta a fal; al
//             terminar baja el MP4 y lo guarda en R2 (marketing/video-ia/<id>.mp4)
//        GET  /video-ia/jobs?client_id → lista + gasto del mes por marca
//        GET  /video-ia/jobs/:id/video → sirve el MP4 desde R2
//        POST /video-ia/escena → Claude propone la descripción de la escena
//             a partir del hook/guion de una pieza (en inglés: los modelos de
//             video entienden mejor el inglés; la explicación va en español).
// ============================================================================

const FAL_QUEUE = 'https://queue.fal.run';

// Catálogo. El precio es el que se le enseña a la dueña ANTES de generar y el
// que se anota como costo. Fuente: informe 15-ago-2026 + página de fal.
export const CATALOGO = {
  rapido: {
    label: 'Rápido', sub: 'b-roll: paisajes, objetos, ambiente. Sin personas hablando.',
    endpoint: 'fal-ai/wan/v2.2-5b/text-to-video/fast-wan',
    modelo: 'FastWan 2.2 · 720p', usd: 0.025, audio: false, seconds: 5,
  },
  alta: {
    label: 'Alta', sub: 'persona a cuadro, con audio. La calidad del anuncio de Regeneris.',
    endpoint: 'fal-ai/veo3/fast',
    modelo: 'Veo 3 Fast · 1080p con audio', usd: 1.20, audio: true, seconds: 8,
  },
};

const MKT_NOW = "strftime('%Y-%m-%d %H:%M:%f','now')";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function nuevoId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function configurado(env) { return !!(env.FAL_KEY && String(env.FAL_KEY).trim()); }

async function falFetch(env, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || 25000),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Cuerpo de la petición por modelo. Todo vertical 9:16 salvo que se pida otro.
function cuerpoPara(tier, prompt, aspect) {
  if (tier === 'rapido') {
    return {
      prompt, aspect_ratio: aspect, resolution: '720p', num_frames: 121, frames_per_second: 24,
      enable_prompt_expansion: true, video_quality: 'high', enable_safety_checker: false,
    };
  }
  // veo3/fast: prompt + aspect_ratio + duration ("8s") + generate_audio
  return { prompt, aspect_ratio: aspect, duration: '8s', generate_audio: true, resolution: '1080p' };
}

export async function estado(env) {
  return json({ ok: true, configurado: configurado(env), catalogo: CATALOGO });
}

export async function crearJob(request, env, session) {
  if (!configurado(env)) return json({ error: 'Falta configurar la llave de fal.ai (FAL_KEY) en Cloudflare.' }, 503);
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const client_id = String(b.client_id || '').trim();
  const tier = String(b.tier || 'rapido');
  const prompt = String(b.prompt || '').trim();
  const aspect = ['9:16', '16:9', '1:1'].includes(b.aspect) ? b.aspect : '9:16';
  const post_id = b.post_id ? String(b.post_id) : null;
  if (!client_id) return json({ error: 'Falta la marca.' }, 400);
  if (!CATALOGO[tier]) return json({ error: 'Calidad desconocida.' }, 400);
  if (prompt.length < 12) return json({ error: 'Describe la escena con un poco más de detalle.' }, 400);
  if (prompt.length > 1500) return json({ error: 'La descripción es demasiado larga (máximo 1500 caracteres).' }, 400);
  const cli = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(client_id).first();
  if (!cli) return json({ error: 'Marca no encontrada.' }, 404);

  const cat = CATALOGO[tier];
  const id = nuevoId();
  await env.DB.prepare(
    `INSERT INTO mkt_video_jobs (id, client_id, post_id, tier, model, prompt, aspect, seconds, status, provider, cost_usd, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'fal', ?, ?)`
  ).bind(id, client_id, post_id, tier, cat.endpoint, prompt, aspect, cat.seconds, cat.usd, session.email || null).run();

  // Encolar en fal. Si falla, la fila queda en error con el motivo legible.
  let r;
  try {
    r = await falFetch(env, `${FAL_QUEUE}/${cat.endpoint}`, { method: 'POST', body: JSON.stringify(cuerpoPara(tier, prompt, aspect)) });
  } catch (e) {
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW} WHERE id=?`).bind('No se pudo hablar con fal: ' + (e && e.message), id).run();
    return json({ error: 'No se pudo hablar con el proveedor. Intenta de nuevo.' }, 502);
  }
  if (!r.res.ok || !r.data.request_id) {
    const msg = (r.data && (r.data.detail || r.data.error || r.data.message)) || `fal respondió ${r.res.status}`;
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW} WHERE id=?`).bind(String(msg).slice(0, 400), id).run();
    return json({ error: typeof msg === 'string' ? msg : 'El proveedor rechazó la petición.' }, 502);
  }
  await env.DB.prepare(
    `UPDATE mkt_video_jobs SET status='running', request_id=?, status_url=?, response_url=?, updated_at=${MKT_NOW} WHERE id=?`
  ).bind(r.data.request_id, r.data.status_url || null, r.data.response_url || null, id).run();
  const job = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  return json({ ok: true, job: publico(job) }, 201);
}

function publico(j) {
  if (!j) return null;
  const { status_url, response_url, request_id, ...rest } = j;
  return { ...rest, video_url: j.status === 'done' ? `/api/marketing/video-ia/jobs/${j.id}/video` : null };
}

// Consulta a fal y, si terminó, guarda el video en R2. Idempotente: si ya está
// done/error no vuelve a llamar al proveedor.
async function refrescar(env, job) {
  if (job.status !== 'running' || !job.status_url) return job;
  let st;
  try { st = await falFetch(env, job.status_url, { method: 'GET' }); }
  catch { return job; } // transitorio: se vuelve a intentar en el siguiente sondeo
  const s = st.data && st.data.status;
  if (s === 'IN_QUEUE' || s === 'IN_PROGRESS') return job;
  if (s !== 'COMPLETED') {
    const msg = (st.data && (st.data.detail || st.data.error)) || `estado ${s || st.res.status}`;
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`).bind(String(msg).slice(0, 400), job.id).run();
    return { ...job, status: 'error', error: String(msg) };
  }
  let out;
  try { out = await falFetch(env, job.response_url, { method: 'GET' }); }
  catch { return job; }
  const videoUrl = out.data && out.data.video && out.data.video.url;
  if (!videoUrl) {
    await env.DB.prepare(`UPDATE mkt_video_jobs SET status='error', error='El proveedor terminó sin entregar video.', updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`).bind(job.id).run();
    return { ...job, status: 'error' };
  }
  // Bajar y guardar en R2. Los links de fal caducan: por eso se copia.
  const key = `marketing/video-ia/${job.id}.mp4`;
  const vres = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
  if (!vres.ok || !vres.body) return job;
  await env.R2_BUCKET.put(key, vres.body, { httpMetadata: { contentType: 'video/mp4', cacheControl: 'private, max-age=86400' } });
  await env.DB.prepare(`UPDATE mkt_video_jobs SET status='done', video_key=?, updated_at=${MKT_NOW}, finished_at=${MKT_NOW} WHERE id=?`).bind(key, job.id).run();
  return { ...job, status: 'done', video_key: key };
}

export async function verJob(env, id) {
  let job = await env.DB.prepare('SELECT * FROM mkt_video_jobs WHERE id = ?').bind(id).first();
  if (!job) return json({ error: 'No existe ese video.' }, 404);
  if (job.status === 'running' && configurado(env)) job = await refrescar(env, job);
  return json({ ok: true, job: publico(job) });
}

export async function listarJobs(env, url) {
  const client_id = String(url.searchParams.get('client_id') || '').trim();
  if (!client_id) return json({ error: 'Falta client_id' }, 400);
  const rows = (await env.DB.prepare(
    'SELECT * FROM mkt_video_jobs WHERE client_id = ? ORDER BY created_at DESC LIMIT 60'
  ).bind(client_id).all()).results || [];
  // Los que siguen corriendo se refrescan aquí mismo (máximo 6 por llamada).
  const out = [];
  let refrescados = 0;
  for (const j of rows) {
    if (j.status === 'running' && refrescados < 6 && configurado(env)) { out.push(await refrescar(env, j)); refrescados++; }
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
  const tier = b.tier === 'alta' ? 'alta' : 'rapido';
  if (!hook && !guion) return json({ error: 'Pásame el hook o el guion de la pieza.' }, 400);
  const reglas = tier === 'alta'
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
  if (parts.length === 4 && parts[1] === 'jobs' && parts[3] === 'video' && (method === 'GET' || method === 'HEAD')) return servirVideo(request, env, parts[2]);
  return json({ error: 'Not found' }, 404);
}
