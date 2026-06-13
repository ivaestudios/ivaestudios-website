// ============================================================================
// IVAE Marketing — Instagram Graph API con Instagram Login (flujo 2024+).
// Flujo: staff abre /ig/login?client_id=… → instagram.com/oauth/authorize →
// /ig/callback intercambia code → token corto → token largo (60 días) →
// guarda en mkt_clients.ig_*. Métricas: /ig/metrics?client_id&month con
// caché 6h en mkt_ig_metrics. Sin META_APP_ID/SECRET responde aviso amable.
// ============================================================================

const AUTH = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com/v21.0';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Instagram · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a{display:inline-flex;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none}small{color:#888}</style><main>${body}</main>`,
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
const redirectUri = (request) => new URL('/api/marketing/ig/callback', request.url).toString();

// GET /ig/login?client_id=… (staff) → redirige a Instagram OAuth
export async function handleIgLogin(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return json({ error: 'Falta configurar la app de Meta (META_APP_ID y META_APP_SECRET en Cloudflare Pages).' }, 503);
  }
  const clientId = url.searchParams.get('client_id') || '';
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);

  const nonce = rnd();
  await kvSet(env, `ig_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now() }));
  const p = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: redirectUri(request),
    state: nonce,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_manage_insights',
  });
  return Response.redirect(`${AUTH}?${p}`, 302);
}

// GET /ig/callback?code&state — sin sesión; valida nonce de un solo uso.
export async function handleIgCallback(request, env, url) {
  const back = '/marketing/app#/meses';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `ig_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar Instagram" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><p>Hazlo de nuevo desde la app.</p><a href="${back}">Volver</a>`, 400);

  try {
    // 1) code → token corto + user_id
    const form = new URLSearchParams({
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(request),
      code,
    });
    const t1res = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const t1 = await t1res.json();
    if (!t1.access_token || !t1.user_id) {
      throw new Error(t1.error_message || t1.error?.message || 'sin token');
    }

    // 2) token corto → token largo (60 días)
    const longRes = await fetch(`${GRAPH.replace('/v21.0', '')}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&access_token=${encodeURIComponent(t1.access_token)}`);
    const long = await longRes.json();
    const token = long.access_token || t1.access_token;

    // 3) pedir username para mostrar al usuario
    let username = '';
    try {
      const me = await (await fetch(`${GRAPH}/me?fields=username&access_token=${encodeURIComponent(token)}`)).json();
      username = me.username || '';
    } catch { /* opcional */ }

    await env.DB.prepare(
      "UPDATE mkt_clients SET ig_user_id = ?, ig_username = ?, ig_access_token = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(String(t1.user_id), username, token, st.c).run();
    await env.DB.prepare('DELETE FROM mkt_ig_metrics WHERE client_id = ?').bind(st.c).run().catch(() => {});

    return html(`<h1>✅ ${username ? '@' + username : 'Instagram'} conectado</h1><p>Las métricas ya van a salir en el reporte mensual de esta marca.</p><a href="${back}">Volver a la app</a>`);
  } catch (e) {
    return html(`<h1>Meta devolvió un error</h1><p>${String(e.message || e).slice(0, 250)}</p><a href="${back}">Volver a la app</a>`, 502);
  }
}

// Compat: la ruta del router viejo (/ig/assign) no se usa en el flujo nuevo
// porque el callback ya tiene un único user_id. Devuelvo 410 amable.
export async function handleIgAssign() {
  return html('<h1>Este paso ya no es necesario</h1><p>Vuelve a la app.</p><a href="/marketing/app#/meses">Volver</a>', 410);
}

// POST /ig/disconnect {client_id} (staff)
export async function handleIgDisconnect(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  await env.DB.prepare(
    "UPDATE mkt_clients SET ig_user_id = NULL, ig_username = NULL, ig_access_token = NULL, updated_at = datetime('now') WHERE id = ?"
  ).bind(b.client_id || '').run();
  await env.DB.prepare('DELETE FROM mkt_ig_metrics WHERE client_id = ?').bind(b.client_id || '').run();
  return json({ ok: true });
}

// Métricas con caché 6h.
export async function fetchIgMetrics(env, clientId, month) {
  const client = await env.DB.prepare('SELECT ig_user_id, ig_username, ig_access_token FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client || !client.ig_user_id || !client.ig_access_token) return { connected: false };

  const cached = await env.DB.prepare('SELECT data, fetched_at FROM mkt_ig_metrics WHERE client_id = ?').bind(clientId).first().catch(() => null);
  if (cached && Date.now() - new Date(cached.fetched_at.replace(' ', 'T') + 'Z').getTime() < 6 * 3600 * 1000) {
    const d = JSON.parse(cached.data);
    return { connected: true, username: client.ig_username, data: { ...d, months: d.months || {} }, month };
  }

  const tok = encodeURIComponent(client.ig_access_token);
  const id = client.ig_user_id;
  const [prof, reach, media] = await Promise.all([
    fetch(`${GRAPH}/${id}?fields=followers_count,media_count,username&access_token=${tok}`).then((r) => r.json()),
    fetch(`${GRAPH}/${id}/insights?metric=reach&period=days_28&access_token=${tok}`).then((r) => r.json()),
    fetch(`${GRAPH}/${id}/media?fields=like_count,comments_count,timestamp,media_type&limit=100&access_token=${tok}`).then((r) => r.json()),
  ]);
  if (prof.error) return { connected: true, username: client.ig_username, error: prof.error.message };

  const months = {};
  for (const m of media.data || []) {
    const k = String(m.timestamp || '').slice(0, 7);
    if (!k) continue;
    if (!months[k]) months[k] = { posts: 0, likes: 0, comments: 0 };
    months[k].posts += 1;
    months[k].likes += m.like_count || 0;
    months[k].comments += m.comments_count || 0;
  }
  const data = {
    followers: prof.followers_count,
    media_count: prof.media_count,
    reach_28d: (((reach.data || [])[0] || {}).values || []).slice(-1)[0]?.value ?? null,
    months,
  };
  await env.DB.prepare(
    "INSERT OR REPLACE INTO mkt_ig_metrics (client_id, data, fetched_at) VALUES (?, ?, datetime('now'))"
  ).bind(clientId, JSON.stringify(data)).run();
  return { connected: true, username: client.ig_username, data, month };
}

// GET /ig/metrics?client_id&month — staff o el cliente de su propia marca.
export async function handleIgMetrics(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  if (!clientId) return json({ error: 'client_id requerido' }, 400);
  const out = await fetchIgMetrics(env, clientId, url.searchParams.get('month') || '');
  return json(out);
}
