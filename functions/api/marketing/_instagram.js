// ============================================================================
// IVAE Marketing — Instagram Graph API (métricas por marca para reportes).
// Flujo: staff abre /ig/login?client_id=… → OAuth de Meta → /ig/callback
// intercambia el code por token largo, enumera las páginas con cuenta IG
// Business y asigna (directo si hay 1; selector si hay varias).
// Métricas: /ig/metrics?client_id&month con caché de 6h en mkt_ig_metrics.
// Requiere env.META_APP_ID + env.META_APP_SECRET (CF Pages). Sin ellos, los
// endpoints responden un aviso amable y la UI muestra qué falta.
// Nota: el callback llega SIN cookie (SameSite=Strict + redirect cross-site);
// se autentica con el nonce de un solo uso guardado en mkt_kv.
// ============================================================================

const G = 'https://graph.facebook.com/v21.0';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Instagram · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a,button.row{display:flex;align-items:center;gap:10px;width:100%;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;font:inherit;cursor:pointer;text-decoration:none;text-align:left}small{color:#888}</style><main>${body}</main>`,
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

// GET /ig/login?client_id=… (staff)
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
    scope: 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,business_management',
  });
  return Response.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${p}`, 302);
}

// GET /ig/callback?code&state — sin sesión (ver nota arriba); valida el nonce.
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
    // code → token corto → token largo (60 días)
    const q1 = new URLSearchParams({ client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, redirect_uri: redirectUri(request), code });
    const t1 = await (await fetch(`${G}/oauth/access_token?${q1}`)).json();
    if (!t1.access_token) throw new Error(t1.error?.message || 'sin token');
    const q2 = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: t1.access_token });
    const t2 = await (await fetch(`${G}/oauth/access_token?${q2}`)).json();
    const userTok = t2.access_token || t1.access_token;

    // páginas administradas con cuenta de Instagram Business ligada
    const pages = await (await fetch(`${G}/me/accounts?fields=name,access_token,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(userTok)}`)).json();
    const cands = (pages.data || [])
      .filter((p) => p.instagram_business_account)
      .map((p) => ({ ig: p.instagram_business_account.id, user: p.instagram_business_account.username, page: p.name, tok: p.access_token }));

    if (!cands.length) {
      return html(`<h1>No encontré cuentas conectables</h1><p>La cuenta de Instagram debe ser <b>Business o Creator</b> y estar <b>ligada a una página de Facebook</b> que tú administres. Revisa eso en Meta Business Suite y reintenta.</p><a href="${back}">Volver a la app</a>`);
    }

    const assign = async (cand) => {
      await env.DB.prepare(
        "UPDATE mkt_clients SET ig_user_id = ?, ig_username = ?, ig_access_token = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(cand.ig, cand.user, cand.tok, st.c).run();
      await env.DB.prepare('DELETE FROM mkt_ig_metrics WHERE client_id = ?').bind(st.c).run().catch?.(() => {});
      return html(`<h1>✅ @${cand.user} conectado</h1><p>Las métricas ya van a salir en el reporte mensual de esta marca.</p><a href="${back}">Volver a la app</a>`);
    };

    if (cands.length === 1) return assign(cands[0]);

    // varias cuentas: selector de un solo uso
    const nonce2 = rnd();
    await kvSet(env, `ig_pick_${nonce2}`, JSON.stringify({ c: st.c, t: Date.now(), cands }));
    const rows = cands.map((c, i) =>
      `<form method="post" action="/api/marketing/ig/assign"><input type="hidden" name="n" value="${nonce2}"><input type="hidden" name="i" value="${i}"><button class="row" type="submit"><b>@${c.user}</b><small>· página ${c.page}</small></button></form>`).join('');
    return html(`<h1>¿Cuál Instagram es de esta marca?</h1>${rows}`);
  } catch (e) {
    return html(`<h1>Meta devolvió un error</h1><p>${String(e.message || e).slice(0, 200)}</p><a href="${back}">Volver a la app</a>`, 502);
  }
}

// POST /ig/assign (form del selector; nonce de un solo uso)
export async function handleIgAssign(request, env) {
  const form = await request.formData().catch(() => null);
  const raw = form ? await kvTake(env, `ig_pick_${form.get('n')}`) : null;
  if (!raw) return html('<h1>Link caducado</h1><p>Reintenta desde la app.</p>', 400);
  const st = JSON.parse(raw);
  const cand = st.cands[Number(form.get('i'))];
  if (!cand || Date.now() - st.t > 10 * 60 * 1000) return html('<h1>Opción inválida o caducada</h1>', 400);
  await env.DB.prepare(
    "UPDATE mkt_clients SET ig_user_id = ?, ig_username = ?, ig_access_token = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(cand.ig, cand.user, cand.tok, st.c).run();
  return html(`<h1>✅ @${cand.user} conectado</h1><p>Listo: sus métricas salen en el reporte.</p><a href="/marketing/app#/meses">Volver a la app</a>`);
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

// Métricas con caché 6h. Devuelve {connected, username?, data?}.
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
    fetch(`${G}/${id}?fields=followers_count,media_count,username&access_token=${tok}`).then((r) => r.json()),
    fetch(`${G}/${id}/insights?metric=reach&period=days_28&access_token=${tok}`).then((r) => r.json()),
    fetch(`${G}/${id}/media?fields=like_count,comments_count,timestamp,media_type&limit=100&access_token=${tok}`).then((r) => r.json()),
  ]);
  if (prof.error) return { connected: true, username: client.ig_username, error: prof.error.message };

  // agrupar interacciones por mes (YYYY-MM)
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
