// ============================================================================
// IVAE Marketing — PÁGINAS DE FACEBOOK (Facebook Login for Business + Pages API).
//
// Investigación 2026-08-17 (misma app de Meta que Instagram — tipo Business):
//   · OAuth: facebook.com/dialog/oauth con config_id → code → user token corto
//     → token largo (fb_exchange_token) → GET /me/accounts → PAGE TOKEN por
//     página. Los page tokens de larga duración NO CADUCAN (mejor que IG ~60d).
//   · Reel: POST /{page}/video_reels start → rupload con header file_url (el
//     video NO se re-sube: Meta lo baja de la URL firmada de R2) → finish.
//   · Carrusel: cada slide via POST /{page}/photos published=false → un post
//     de feed con attached_media (post multi-foto, el "carrusel" de FB).
//   · NO existe crossposting IG→FB por API (el auto-share del Accounts Center
//     ignora lo publicado por API) — por eso se publica dos veces.
//
// Env necesarios (Cloudflare Pages): FB_APP_ID (el Meta App ID de arriba del
// dashboard, 2823115284726253 — NO el Instagram App ID), FB_APP_SECRET (App
// secret de la app), FB_CONFIG_ID (la Configuración de Facebook Login for
// Business con pages_show_list + pages_read_engagement + pages_manage_posts).
// Sin ellos, todo responde con un aviso amable de qué falta.
// ============================================================================

const FB_AUTH = 'https://www.facebook.com/v23.0/dialog/oauth';
const FB_GRAPH = 'https://graph.facebook.com/v23.0';
const FB_RUPLOAD = 'https://rupload.facebook.com/video-upload/v23.0';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Facebook · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a,button.pg{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none;font:inherit;cursor:pointer;text-align:left}small{color:#888}</style><main>${body}</main>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function rnd() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function kvSet(env, k, v) {
  await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind(k, v).run();
}
async function kvTake(env, k) {
  const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(k).first();
  if (row) await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(k).run();
  return row ? row.value : null;
}
const fbRedirectUri = (request) => new URL('/api/marketing/fb/callback', request.url).toString();

function faltaConfig(env) {
  if (!env.FB_APP_ID || !env.FB_APP_SECRET || !env.FB_CONFIG_ID) {
    return 'Falta configurar Facebook en la app de Meta: producto "Facebook Login for Business", y en Cloudflare Pages los secretos FB_APP_ID, FB_APP_SECRET y FB_CONFIG_ID.';
  }
  return null;
}

// GET /fb/login?client_id=… (staff) → redirige al OAuth de Facebook.
export async function handleFbLogin(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const falta = faltaConfig(env);
  if (falta) return json({ error: falta }, 503);
  const clientId = url.searchParams.get('client_id') || '';
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  await kvSet(env, `fb_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now() }));
  const p = new URLSearchParams({
    client_id: env.FB_APP_ID,
    redirect_uri: fbRedirectUri(request),
    state: nonce,
    response_type: 'code',
    config_id: env.FB_CONFIG_ID,
  });
  return Response.redirect(`${FB_AUTH}?${p}`, 302);
}

// GET /fb/callback — code → token largo → páginas del usuario → elegir página.
export async function handleFbCallback(request, env, url) {
  const back = '/marketing/app#/meses';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `fb_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar Facebook" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><p>Hazlo de nuevo desde la app.</p><a href="${back}">Volver</a>`, 400);

  try {
    // 1) code → user token corto
    const t1 = await (await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id: env.FB_APP_ID, client_secret: env.FB_APP_SECRET,
      redirect_uri: fbRedirectUri(request), code,
    }))).json();
    if (!t1.access_token) throw new Error((t1.error && t1.error.message) || 'sin token');
    // 2) corto → largo (60 días; las páginas heredarán tokens SIN caducidad)
    const t2 = await (await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: env.FB_APP_ID,
      client_secret: env.FB_APP_SECRET, fb_exchange_token: t1.access_token,
    }))).json();
    const userTok = t2.access_token || t1.access_token;
    // 3) páginas administradas (cada una trae su PAGE token de larga duración)
    const acc = await (await fetch(`${FB_GRAPH}/me/accounts?fields=id,name,access_token&limit=50&access_token=${encodeURIComponent(userTok)}`)).json();
    const pages = (acc.data || []).filter((p) => p.id && p.access_token);
    if (!pages.length) {
      return html(`<h1>Sin páginas</h1><p>Esta cuenta de Facebook no administra ninguna página. Crea la página de la marca (o pide rol de administrador) y vuelve a intentar.</p><a href="${back}">Volver a la app</a>`);
    }
    if (pages.length === 1) {
      await guardarPagina(env, st.c, pages[0]);
      return html(`<h1>✅ Facebook conectado</h1><p>La marca quedó ligada a la página <b>${esc(pages[0].name)}</b>. Las piezas con "también en Facebook" se publicarán ahí.</p><a href="${back}">Volver a la app</a>`);
    }
    // Varias páginas: guardar la lista 10 min y dejar elegir con un click.
    const pickId = rnd();
    await kvSet(env, `fb_pick_${pickId}`, JSON.stringify({ c: st.c, t: Date.now(), pages: pages.map((p) => ({ id: p.id, name: p.name, access_token: p.access_token })) }));
    const botones = pages.map((p) =>
      `<a href="/api/marketing/fb/callback?pick=${pickId}&page=${encodeURIComponent(p.id)}">📘 ${esc(p.name)}</a>`
    ).join('');
    return html(`<h1>¿Cuál página es de esta marca?</h1><p>Tu cuenta administra varias páginas — elige la correcta:</p>${botones}<small>Este enlace caduca en 10 minutos.</small>`);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// GET /fb/callback?pick=…&page=… — segundo paso del picker de páginas.
export async function handleFbPick(request, env, url) {
  const back = '/marketing/app#/meses';
  const raw = await kvTake(env, `fb_pick_${url.searchParams.get('pick') || ''}`);
  if (!raw) return html(`<h1>Link caducado</h1><p>Vuelve a "Conectar Facebook" en la app.</p><a href="${back}">Volver</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  const page = (st.pages || []).find((p) => p.id === (url.searchParams.get('page') || ''));
  if (!page) return html('<h1>Página no encontrada</h1>', 400);
  await guardarPagina(env, st.c, page);
  return html(`<h1>✅ Facebook conectado</h1><p>La marca quedó ligada a la página <b>${esc(page.name)}</b>.</p><a href="${back}">Volver a la app</a>`);
}

async function guardarPagina(env, clientId, page) {
  await env.DB.prepare(
    `UPDATE mkt_clients SET fb_page_id = ?, fb_page_name = ?, fb_access_token = ?, fb_connected_at = datetime('now') WHERE id = ?`
  ).bind(page.id, page.name || '', page.access_token, clientId).run();
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

async function fbJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    let msg = (data.error && (data.error.error_user_msg || data.error.message)) || `HTTP ${res.status}`;
    if (/permission|#200|#10\b/i.test(msg)) msg = 'La página de Facebook está conectada con permisos insuficientes — reconéctala desde la ficha del cliente. (' + msg + ')';
    const e = new Error(msg);
    e.fbCode = data.error && data.error.code;
    throw e;
  }
  return data;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// El caption FINAL para Facebook: mismo criterio que Instagram.
function captionFb(post) {
  const cap = String(post.caption || '').trim();
  const tags = String(post.hashtags || '').trim();
  return (tags && !cap.includes(tags.split(/\s+/)[0]) ? `${cap}\n\n${tags}` : cap).slice(0, 5000);
}

/**
 * Publica UNA pieza en la página de Facebook de su marca.
 * Reel (video firmado) → Reels API de páginas; carrusel (slides firmados) →
 * post multi-foto; foto única → /photos. Devuelve { fbPostId, permalink }.
 */
export async function publicarEnFacebook(env, { client, post, videoUrl, slides }) {
  if (!client || !client.fb_page_id || !client.fb_access_token) {
    throw new Error('La marca no tiene página de Facebook conectada (ficha del cliente → Conectar Facebook).');
  }
  const tok = client.fb_access_token;
  const caption = captionFb(post);

  // CARRUSEL → post multi-foto (el "carrusel" nativo de páginas).
  if (slides && slides.length >= 2) {
    const ids = [];
    for (const u of slides.slice(0, 10)) {
      const f = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/photos`, {
        method: 'POST',
        body: new URLSearchParams({ url: u, published: 'false', access_token: tok }),
      });
      if (f.id) ids.push(f.id);
    }
    if (!ids.length) throw new Error('Facebook no aceptó ninguna foto del carrusel.');
    const params = new URLSearchParams({ message: caption, access_token: tok });
    ids.forEach((id, i) => params.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const postRes = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/feed`, { method: 'POST', body: params });
    if (!postRes.id) throw new Error('Facebook no confirmó el post del carrusel.');
    return { fbPostId: postRes.id, permalink: `https://www.facebook.com/${postRes.id}` };
  }

  // REEL → Reels API de páginas en 3 fases; el video viaja por file_url.
  if (videoUrl) {
    const inicio = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({ upload_phase: 'start', access_token: tok }),
    });
    if (!inicio.video_id) throw new Error('Facebook no devolvió el video_id del reel.');
    const up = await fetch(`${FB_RUPLOAD}/${inicio.video_id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${tok}`, file_url: videoUrl },
    });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok || upData.error) {
      throw new Error('Facebook no pudo bajar el video: ' + ((upData.error && upData.error.message) || `HTTP ${up.status}`));
    }
    await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({
        upload_phase: 'finish', video_id: inicio.video_id,
        video_state: 'PUBLISHED', description: caption, access_token: tok,
      }),
    });
    // El procesamiento es asíncrono: se espera lo razonable y se registra.
    for (let i = 0; i < 12; i++) {
      await espera(5000);
      try {
        const st = await fbJson(`${FB_GRAPH}/${inicio.video_id}?fields=status&access_token=${encodeURIComponent(tok)}`);
        const v = st.status && st.status.video_status;
        if (v === 'ready') break;
        if (v === 'error') throw new Error('Facebook no pudo procesar el reel.');
      } catch (e) { if (/no pudo procesar/.test(e.message)) throw e; break; }
    }
    return { fbPostId: inicio.video_id, permalink: `https://www.facebook.com/reel/${inicio.video_id}` };
  }

  // FOTO única (post tipo 'post' con inspo JPEG).
  if (post.inspo_url && /\.(jpe?g)(\?|$)/i.test(post.inspo_url)) {
    const f = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/photos`, {
      method: 'POST',
      body: new URLSearchParams({ url: post.inspo_url, caption, access_token: tok }),
    });
    if (!f.post_id && !f.id) throw new Error('Facebook no confirmó la foto.');
    return { fbPostId: f.post_id || f.id, permalink: `https://www.facebook.com/${f.post_id || f.id}` };
  }

  throw new Error('La pieza no tiene video ni slides para publicar en Facebook.');
}
