// ============================================================================
// IVAE Marketing — Instagram Graph API con Instagram Login (flujo 2024+).
// Flujo: staff abre /ig/login?client_id=… → instagram.com/oauth/authorize →
// /ig/callback intercambia code → token corto → token largo (60 días) →
// guarda en mkt_clients.ig_*. Métricas: /ig/metrics?client_id&month con
// caché 6h en mkt_ig_metrics. Sin META_APP_ID/SECRET responde aviso amable.
// ============================================================================

const AUTH = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
const BASE = 'https://graph.instagram.com';
const GRAPH = `${BASE}/v23.0`;
// Scopes del flujo Instagram Login. manage_insights habilita followers/alcance;
// requiere Advanced Access (App Review) para cuentas que no administra la app.
const IG_SCOPE = 'instagram_business_basic,instagram_business_manage_insights';

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
    scope: IG_SCOPE,
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
    const longRes = await fetch(`${BASE}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&access_token=${encodeURIComponent(t1.access_token)}`);
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
  // Solo endpoints permitidos sin App Review (scope instagram_business_basic):
  // /me (perfil) y /me/media (lista de posts con likes/comments).
  // /insights/reach requiere instagram_business_manage_insights → App Review.
  const [prof, media] = await Promise.all([
    fetch(`${GRAPH}/me?fields=id,username,account_type,media_count,followers_count&access_token=${tok}`).then((r) => r.json()),
    fetch(`${GRAPH}/me/media?fields=like_count,comments_count,timestamp,media_type&limit=100&access_token=${tok}`).then((r) => r.json()),
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
  // Si el username de la BD está vacío (fallo del callback), lo guardamos aquí.
  if (prof.username && !client.ig_username) {
    await env.DB.prepare("UPDATE mkt_clients SET ig_username = ? WHERE id = ?").bind(prof.username, clientId).run().catch(() => {});
  }
  const data = {
    followers: prof.followers_count,
    media_count: prof.media_count,
    reach_28d: null, // requiere App Review
    months,
  };
  await env.DB.prepare(
    "INSERT OR REPLACE INTO mkt_ig_metrics (client_id, data, fetched_at) VALUES (?, ?, datetime('now'))"
  ).bind(clientId, JSON.stringify(data)).run();
  return { connected: true, username: client.ig_username, data, month };
}

// GET /ig/metrics?client_id&month — staff o el cliente de su propia marca.
// Prioridad: API conectada con datos → si no, captura manual del mes.
export async function handleIgMetrics(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  if (!clientId) return json({ error: 'client_id requerido' }, 400);
  const month = url.searchParams.get('month') || '';
  const out = await fetchIgMetrics(env, clientId, month);
  if (out && out.connected && out.data && !out.error) return json(out);
  // Fallback: números capturados a mano para ese mes.
  const man = await getManualMetrics(env, clientId, month);
  if (man) return json({ connected: true, source: 'manual', manual: man, month });
  return json(out);
}

// ── Captura manual de resultados (bridge mientras Meta aprueba App Review) ──
// Lee los números de un mes; null si no hay.
export async function getManualMetrics(env, clientId, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return null;
  try {
    const r = await env.DB.prepare(
      'SELECT followers, reach, interactions, posts FROM mkt_ig_manual WHERE client_id = ? AND month = ?'
    ).bind(clientId, month).first();
    if (!r) return null;
    if (r.followers == null && r.reach == null && r.interactions == null && r.posts == null) return null;
    return r;
  } catch { return null; }
}

// GET/POST /ig/manual?client_id&month (staff). POST guarda los 4 números.
export async function handleIgManual(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const method = request.method;
  let clientId = url.searchParams.get('client_id') || '';
  let month = url.searchParams.get('month') || '';

  if (method === 'GET') {
    if (!clientId || !/^\d{4}-\d{2}$/.test(month)) return json({ error: 'client_id y month requeridos' }, 400);
    const r = await getManualMetrics(env, clientId, month);
    return json({ ok: true, manual: r || null });
  }
  if (method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    clientId = b.client_id || clientId;
    month = b.month || month;
    if (!clientId || !/^\d{4}-\d{2}$/.test(String(month))) return json({ error: 'client_id y month (AAAA-MM) requeridos' }, 400);
    const num = (v) => (v === '' || v == null ? null : (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null));
    await env.DB.prepare(
      `INSERT INTO mkt_ig_manual (client_id, month, followers, reach, interactions, posts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(client_id, month) DO UPDATE SET
         followers=excluded.followers, reach=excluded.reach,
         interactions=excluded.interactions, posts=excluded.posts,
         updated_at=datetime('now')`
    ).bind(clientId, month, num(b.followers), num(b.reach), num(b.interactions), num(b.posts)).run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}
