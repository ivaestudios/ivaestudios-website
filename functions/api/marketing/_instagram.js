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
// Scopes del flujo Instagram Login. manage_insights habilita followers/alcance.
// Bajo Standard Access (modo desarrollo) funciona para cuentas con un ROL de
// tester aceptado en la app; App Review solo hace falta para cuentas de
// terceros SIN rol (público). No es necesario para el set fijo de clientes.
// content_publish (2026-08-15): las marcas que se (re)conecten ya otorgan
// publicar — el programador lo necesita. Tokens viejos siguen sirviendo para
// insights; para programar, reconectar la marca una vez.
const IG_SCOPE = 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200, en = false) {
  return new Response(`<!doctype html><html lang="${en ? 'en' : 'es'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Instagram · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a{display:inline-flex;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none}small{color:#888}</style><main>${body}</main>`,
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
  // Conectar Instagram desde el portal del CLIENTE: habilitado marca por marca
  // (Vianey lo aprueba). El resto de clientes sigue bloqueado: la conexión la
  // hace la agencia. MISMA lista en marketing/js/views/metricas.js.
  const CLIENT_CAN_CONNECT = [
    '6ae5dd2381faa430d9e6966470b29602', // IVAE STUDIOS (marca propia)
    'demo-regeneris',                    // REGENERIS THERAPY
  ];
  if (session.role === 'client' && !CLIENT_CAN_CONNECT.includes(session.client_id)) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return json({ error: 'Falta configurar la app de Meta (META_APP_ID y META_APP_SECRET en Cloudflare Pages).' }, 503);
  }
  // El cliente solo puede conectar SU propia marca (no puede pasar otro client_id).
  const clientId = session.role === 'client' ? session.client_id : (url.searchParams.get('client_id') || '');
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);

  const nonce = rnd();
  const en = url.searchParams.get('lang') === 'en';
  await kvSet(env, `ig_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now(), l: en ? 'en' : 'es' }));
  const p = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: redirectUri(request),
    state: nonce,
    response_type: 'code',
    scope: IG_SCOPE,
  });
  // NOTA: se quitó force_reauth=true (2026-07-19). Se había agregado para el App
  // Review, pero hacía que Instagram rebotara al feed sin volver al callback
  // ("no vuelve al sistema"). El flujo de junio funcionaba SIN él. La pantalla de
  // consentimiento igual sale en la 1ª conexión tras revocar el permiso en IG.
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
  const en = st.l === 'en';
  const T = (es, ing) => (en ? ing : es);
  if (Date.now() - st.t > 10 * 60 * 1000) {
    return html(`<h1>${T('El intento caducó', 'This attempt expired')}</h1><p>${T('Hazlo de nuevo desde la app.', 'Try again from the app.')}</p><a href="${back}">${T('Volver', 'Back')}</a>`, 400, en);
  }

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

    // 3) username + ID REAL de la cuenta.
    // ⚠️ NO usar t1.user_id: el canje lo manda como NUMERO y estos ids pasan de
    // 2^53, asi que JSON.parse los redondea y se guardaba un id que NO EXISTE
    // (SMILE NOW quedo en ...784 cuando la cuenta es ...786). Con ese id,
    // /insights contesta error 100/33 y la demografia salia siempre vacia.
    // /me devuelve el id como TEXTO, sin perder digitos.
    let username = '';
    let cuentaId = String(t1.user_id);
    try {
      const me = await (await fetch(`${GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(token)}`)).json();
      username = me.username || '';
      if (me.id) cuentaId = String(me.id);
    } catch { /* opcional */ }

    // GUARDA ANTI-CRUCE (2026-07-30): el callback guardaba CUALQUIER cuenta que
    // autorizara, sin comprobar de quién es. Si en el navegador estaba abierta
    // otra cuenta de Instagram, esa quedaba pegada a la marca equivocada —
    // pasó de verdad: @ivae.studios terminó conectada a REGENERIS y su panel
    // habría mostrado métricas ajenas. Ahora, si ese Instagram ya pertenece a
    // OTRA marca, se rechaza y no se toca nada.
    // La marca DEMO (67322…) comparte a propósito @ivae.studios con la marca
    // real de IVAE: es nuestra propia cuenta, no un cruce. Se excluye del
    // chequeo para que no bloquee reconexiones legítimas de IVAE STUDIOS.
    const clash = await env.DB.prepare(
      "SELECT id, name FROM mkt_clients WHERE ig_user_id = ? AND id != ? AND id != '67322bb3c5f64991a9178b1d1784231a'"
    ).bind(cuentaId, st.c).first();
    if (clash) {
      return html(
        `<h1>${T('Esa cuenta ya es de otra marca', 'That account belongs to another brand')}</h1>`
        + `<p>${T(`La cuenta ${username ? '<b>@' + username + '</b>' : 'de Instagram'} ya está conectada a <b>${clash.name}</b>. Cierra sesión en Instagram y entra con la cuenta correcta de esta marca, o desconéctala primero de la otra.`,
          `The account ${username ? '<b>@' + username + '</b>' : 'on Instagram'} is already linked to <b>${clash.name}</b>. Sign out of Instagram and sign in with the right account for this brand, or disconnect it from the other one first.`)}</p>`
        + `<a href="${back}">${T('Volver a la app', 'Back to the app')}</a>`,
        409, en,
      );
    }

    await env.DB.prepare(
      "UPDATE mkt_clients SET ig_user_id = ?, ig_username = ?, ig_access_token = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(cuentaId, username, token, st.c).run();
    await env.DB.prepare('DELETE FROM mkt_ig_metrics WHERE client_id = ?').bind(st.c).run().catch(() => {});

    return html(
      `<h1>✅ ${username ? '@' + username : 'Instagram'} ${T('conectado', 'connected')}</h1>`
      + `<p>${T('Las métricas ya van a salir en el reporte mensual de esta marca.',
        'Insights will now appear in this brand\u2019s monthly report.')}</p>`
      + `<a href="${back}">${T('Volver a la app', 'Back to the app')}</a>`,
      200, en,
    );
  } catch (e) {
    return html(`<h1>${T('Meta devolvió un error', 'Meta returned an error')}</h1><p>${String(e.message || e).slice(0, 250)}</p><a href="${back}">${T('Volver a la app', 'Back to the app')}</a>`, 502, en);
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

// ── Helpers de insights (todo bajo Standard Access, sin App Review) ──────────
async function igJson(url) {
  try { return await fetch(url).then((r) => r.json()); } catch { return null; }
}
// Lee el valor de una métrica per-media (soporta total_value y values[]).
function metricVal(item) {
  if (!item) return null;
  if (item.total_value && item.total_value.value != null) return item.total_value.value;
  if (item.values && item.values[0] && item.values[0].value != null) return item.values[0].value;
  return null;
}
// Insights de UN post/reel. El set se adapta al tipo (pedir una métrica no
// soportada rompe TODA la llamada), con reintento mínimo si algo falla.
async function fetchPostInsights(mediaId, isReel, tok) {
  const base = 'views,reach,saved,shares,total_interactions';
  const sets = [isReel ? base + ',ig_reels_avg_watch_time' : base, 'views,reach'];
  for (const metric of sets) {
    const r = await igJson(`${GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${tok}`);
    if (r && r.data && !r.error) {
      const out = {};
      for (const it of r.data) out[it.name] = metricVal(it);
      return out;
    }
  }
  return {};
}
// Demografía de audiencia a nivel CUENTA por un breakdown (gender|age|city).
// Requiere ≥100 seguidores; si no, la API no devuelve datos → null.
async function fetchDemographic(igUserId, breakdown, tok) {
  // OJO: se pide sobre 'me', NO sobre el id guardado. Ver la nota de arriba de
  // resolverCuenta(): el id del canje puede no ser el de la cuenta.
  const r = await igJson(`${GRAPH}/me/insights?metric=follower_demographics&period=lifetime&timeframe=this_month&breakdown=${breakdown}&metric_type=total_value&access_token=${tok}`);
  const bd = r && r.data && r.data[0] && r.data[0].total_value && r.data[0].total_value.breakdowns;
  const results = bd && bd[0] && bd[0].results;
  if (!Array.isArray(results)) {
    // Que no vuelva a pasar: un error de la API se veia igual que "esta cuenta
    // todavia no califica". Ahora queda en el registro con su codigo.
    if (r && r.error) console.error('[ig demografia]', breakdown, r.error.code, r.error.error_subcode, String(r.error.message).slice(0, 120));
    return null;
  }
  const out = results.map((x) => ({ key: (x.dimension_values || [])[0], value: x.value }))
    .filter((x) => x.key != null && x.value != null);
  return out.length ? out : null;
}

// Caché persistente de insights por post (mkt_kv 'igi:<mediaId>'). Cada post se
// pide a la API UNA vez y se reusa; así los periodos largos acumulan métricas
// reales sin re-pegar a la API ni saturar el límite de subrequests. Los posts
// viejos (>30 días) casi no cambian → caché 45 días; los recientes → 12 h.
async function igInsSet(env, mediaId, pi, stable) {
  const exp = Date.now() + (stable ? 45 * 86400000 : 12 * 3600000);
  try {
    await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)')
      .bind('igi:' + mediaId, JSON.stringify({ pi, exp })).run();
  } catch { /* noop: la métrica sigue saliendo, solo no se cachea */ }
}

// Métricas con caché 6h (por cliente + mes pedido).
export async function fetchIgMetrics(env, clientId, month) {
  const client = await env.DB.prepare('SELECT ig_user_id, ig_username, ig_access_token FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client || !client.ig_user_id || !client.ig_access_token) return { connected: false };

  const cached = await env.DB.prepare('SELECT data, fetched_at FROM mkt_ig_metrics WHERE client_id = ?').bind(clientId).first().catch(() => null);
  if (cached) {
    const fresh = Date.now() - new Date(cached.fetched_at.replace(' ', 'T') + 'Z').getTime() < 6 * 3600 * 1000;
    const d = JSON.parse(cached.data);
    if (fresh && d._month === month) {
      return { connected: true, username: client.ig_username, data: { ...d, months: d.months || {} }, month };
    }
  }

  const tok = encodeURIComponent(client.ig_access_token);
  const id = client.ig_user_id;
  // Bajo Standard Access (modo desarrollo, cuenta con rol de tester aceptado):
  // /me (perfil), /me/media (posts) y /{id}/insights (alcance + demografía).
  const [prof, media] = await Promise.all([
    fetch(`${GRAPH}/me?fields=id,username,account_type,media_count,followers_count&access_token=${tok}`).then((r) => r.json()),
    fetch(`${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,like_count,comments_count,timestamp&limit=100&access_token=${tok}`).then((r) => r.json()),
  ]);
  if (prof.error) return { connected: true, username: client.ig_username, error: prof.error.message };

  // Alcance de los últimos 28 días (best-effort). Métrica vigente 2025+: 'reach'
  // con metric_type=total_value (la antigua 'impressions' fue retirada 21-abr-2025).
  let reach28 = null;
  try {
    // ⚠️ SIN metric_type. Con `period=days_28&metric_type=total_value` Instagram
    // NO devuelve 28 dias: devuelve mas o menos un dia. Medido el 2026-09-09,
    // el mismo dia y la misma cuenta:
    //   SMILE NOW  2,344 contra 21,013 reales   ADAGIO RH   83 contra 10,612
    //   MELISA    10,156 contra 216,559 reales  REGENERIS 1,520 contra 10,688
    // Con `period=days_28` a secas llegan los valores acumulados de 28 dias en
    // values[], y el ULTIMO es el de hoy. Se cruzo con la otra forma valida
    // (metric_type=total_value + since/until de 28 dias) y dan lo mismo.
    const ins = await igJson(`${GRAPH}/me/insights?metric=reach&period=days_28&access_token=${tok}`);
    const vals = ins && ins.data && ins.data[0] && ins.data[0].values;
    if (Array.isArray(vals) && vals.length) reach28 = vals[vals.length - 1].value;
    else if (ins && ins.data && ins.data[0]) reach28 = metricVal(ins.data[0]);
  } catch { /* sin alcance: el reporte sigue con followers + interacciones */ }

  // Demografía de la audiencia (nivel cuenta): género, edad y ciudades top.
  // Best-effort: si la cuenta tiene <100 seguidores o no califica, queda null.
  let audience = null;
  try {
    const [gender, age, city] = await Promise.all([
      fetchDemographic(id, 'gender', tok),
      fetchDemographic(id, 'age', tok),
      fetchDemographic(id, 'city', tok),
    ]);
    if (gender || age || city) audience = { gender, age, city };
  } catch { /* sin demografía */ }

  // Posts del mes pedido, con métricas POR VIDEO (best-effort por post).
  const months = {};
  const posts = [];
  for (const m of media.data || []) {
    const k = String(m.timestamp || '').slice(0, 7);
    if (!k) continue;
    if (!months[k]) months[k] = { posts: 0, likes: 0, comments: 0 };
    months[k].posts += 1;
    months[k].likes += m.like_count || 0;
    months[k].comments += m.comments_count || 0;
    if (k === month && posts.length < 40) {
      const isReel = (m.media_product_type === 'REELS') || (m.media_type === 'VIDEO');
      const pi = await fetchPostInsights(m.id, isReel, tok);
      posts.push({
        id: m.id,
        caption: (m.caption || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        type: m.media_product_type || m.media_type || 'POST',
        permalink: m.permalink || null,
        thumb: m.thumbnail_url || m.media_url || null,
        timestamp: m.timestamp,
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        views: pi.views ?? null,
        reach: pi.reach ?? null,
        saved: pi.saved ?? null,
        shares: pi.shares ?? null,
        interactions: pi.total_interactions ?? null,
        // ig_reels_avg_watch_time viene en MILISEGUNDos → lo paso a segundos.
        avg_watch: pi.ig_reels_avg_watch_time != null ? pi.ig_reels_avg_watch_time / 1000 : null,
      });
    }
  }
  posts.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  // Si el username de la BD está vacío (fallo del callback), lo guardamos aquí.
  if (prof.username && !client.ig_username) {
    await env.DB.prepare("UPDATE mkt_clients SET ig_username = ? WHERE id = ?").bind(prof.username, clientId).run().catch(() => {});
  }
  const data = {
    followers: prof.followers_count,
    media_count: prof.media_count,
    reach_28d: reach28,
    months,
    audience,
    posts,
    _month: month,
  };
  await env.DB.prepare(
    "INSERT OR REPLACE INTO mkt_ig_metrics (client_id, data, fetched_at) VALUES (?, ?, datetime('now'))"
  ).bind(clientId, JSON.stringify(data)).run();
  return { connected: true, username: client.ig_username, data, month };
}

// Métricas por RANGO de fechas [from, to] (AAAA-MM-DD). Para el panel de
// métricas con periodos (semana/mes/3-6 meses/año/personalizado). Agrega los
// posts del rango + audiencia (snapshot) + alcance de cuenta. Sin caché (siempre
// fresco; los insights por post se piden en lotes para ir rápido).
export async function fetchIgMetricsRange(env, clientId, from, to) {
  const client = await env.DB.prepare('SELECT ig_user_id, ig_username, ig_access_token FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client || !client.ig_user_id || !client.ig_access_token) return { connected: false };

  const tok = encodeURIComponent(client.ig_access_token);
  const id = client.ig_user_id;

  const prof = await igJson(`${GRAPH}/me?fields=id,username,account_type,media_count,followers_count&access_token=${tok}`);
  if (!prof || prof.error) return { connected: true, username: client.ig_username, error: (prof && prof.error && prof.error.message) || 'No se pudo leer Instagram' };

  // Alcance de la cuenta (últimos 28 días) + demografía actual — snapshots.
  let reach28 = null;
  // Mismas dos correcciones que arriba: sobre 'me' (el id guardado podia venir
  // redondeado) y SIN metric_type (con el, days_28 devuelve mas o menos un dia).
  try {
    const ins = await igJson(`${GRAPH}/me/insights?metric=reach&period=days_28&access_token=${tok}`);
    const vals = ins && ins.data && ins.data[0] && ins.data[0].values;
    if (Array.isArray(vals) && vals.length) reach28 = vals[vals.length - 1].value;
    else if (ins && ins.data && ins.data[0]) reach28 = metricVal(ins.data[0]);
  } catch { /* noop */ }
  let audience = null;
  try {
    const [gender, age, city] = await Promise.all([
      fetchDemographic(id, 'gender', tok), fetchDemographic(id, 'age', tok), fetchDemographic(id, 'city', tok),
    ]);
    if (gender || age || city) audience = { gender, age, city };
  } catch { /* noop */ }

  // Recolecta los posts dentro del rango paginando /me/media (viene de nuevo a
  // viejo → cortamos al pasar el inicio del rango).
  const inRange = (ts) => { const d = String(ts || '').slice(0, 10); return d >= from && d <= to; };
  const rangePosts = [];
  let nextUrl = `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,like_count,comments_count,timestamp&limit=50&access_token=${tok}`;
  let pages = 0; let stop = false;
  while (nextUrl && pages < 15 && !stop) {
    const page = await igJson(nextUrl);
    if (!page || page.error || !Array.isArray(page.data)) break;
    for (const m of page.data) {
      const d = String(m.timestamp || '').slice(0, 10);
      if (d && d < from) { stop = true; break; }
      if (inRange(m.timestamp)) rangePosts.push(m);
    }
    pages += 1;
    nextUrl = (page.paging && page.paging.next) ? page.paging.next : null;
  }
  rangePosts.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  if (rangePosts.length > 365) rangePosts.length = 365;  // tope de seguridad (~1 año)

  const totals = { posts: rangePosts.length, views: 0, reach: 0, likes: 0, comments: 0, saved: 0, shares: 0, interactions: 0 };
  for (const m of rangePosts) { totals.likes += m.like_count || 0; totals.comments += m.comments_count || 0; }

  // Lee de un jalón todos los insights ya cacheados (1 query). Los que falten se
  // piden a la API hasta un budget (seguro en subrequests) y se cachean; en las
  // próximas cargas / el cron diario se va llenando → un periodo largo acumula
  // datos reales y 6 meses ≠ 1 año.
  const cacheMap = new Map();
  if (rangePosts.length) {
    const keys = rangePosts.map((m) => 'igi:' + m.id);
    const ph = keys.map(() => '?').join(',');
    const rows = await env.DB.prepare(`SELECT key, value FROM mkt_kv WHERE key IN (${ph})`).bind(...keys).all().catch(() => null);
    for (const r of ((rows && rows.results) || [])) {
      try { const o = JSON.parse(r.value); if (o && o.pi && o.exp > Date.now()) cacheMap.set(r.key.slice(4), o.pi); } catch { /* noop */ }
    }
  }

  // 200 con Workers Paid (2026-07-31): el plan da ~1000 subrequests/request
  // (antes ~50, por eso el 40). 200 cubre el año completo de una marca activa
  // en UNA carga; el peor caso (200 fetches con reintento + 200 escrituras a
  // D1 + paginado) queda en ~650 subrequests, con margen.
  const budget = { n: 200 };  // máx fetches NUEVOS por request (los cacheados no gastan budget)
  const all = [];
  for (let i = 0; i < rangePosts.length; i += 10) {
    const batch = rangePosts.slice(i, i + 10);
    const got = await Promise.all(batch.map(async (m) => {
      let pi = cacheMap.get(m.id);
      if (!pi && budget.n > 0) {
        budget.n -= 1;
        const isReel = (m.media_product_type === 'REELS') || (m.media_type === 'VIDEO');
        const fetched = await fetchPostInsights(m.id, isReel, tok);
        if (fetched && (fetched.reach != null || fetched.views != null)) {
          pi = fetched;
          const ageDays = (Date.now() - Date.parse(String(m.timestamp || '').replace(' ', 'T'))) / 86400000;
          await igInsSet(env, m.id, fetched, ageDays > 30);
        }
      }
      pi = pi || {};
      return {
        id: m.id,
        caption: (m.caption || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        type: m.media_product_type || m.media_type || 'POST',
        permalink: m.permalink || null,
        thumb: m.thumbnail_url || m.media_url || null,
        timestamp: m.timestamp,
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        views: pi.views ?? null,
        reach: pi.reach ?? null,
        saved: pi.saved ?? null,
        shares: pi.shares ?? null,
        interactions: pi.total_interactions ?? null,
        avg_watch: pi.ig_reels_avg_watch_time != null ? pi.ig_reels_avg_watch_time / 1000 : null,
      };
    }));
    for (const p of got) {
      all.push(p);
      if (p.views != null) totals.views += p.views;
      if (p.reach != null) totals.reach += p.reach;
      if (p.saved != null) totals.saved += p.saved;
      if (p.shares != null) totals.shares += p.shares;
      totals.interactions += (p.interactions != null ? p.interactions : (p.likes + p.comments));
    }
  }
  const pending = all.filter((p) => p.views == null && p.reach == null).length;
  const posts = all.slice(0, 60);  // lista a mostrar (las KPIs ya suman TODO el periodo)

  return {
    connected: true,
    username: client.ig_username || prof.username || '',
    data: {
      followers: prof.followers_count,
      media_count: prof.media_count,
      reach_28d: reach28,
      audience,
      posts,
      totals,
      truncated: rangePosts.length > posts.length ? rangePosts.length - posts.length : 0,
      pending,
    },
    from, to,
  };
}

// GET /ig/metrics-range?client_id&from&to (AAAA-MM-DD) — staff o cliente propio.
export async function handleIgMetricsRange(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  if (!clientId) return json({ error: 'client_id requerido' }, 400);
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return json({ error: 'from y to (AAAA-MM-DD) requeridos' }, 400);
  }
  const out = await fetchIgMetricsRange(env, clientId, from, to);
  // Pauta CAPTURADA de los meses que toca el rango (la API de IG solo trae lo
  // orgánico; el staff copia las vistas de pauta del panel de la marca). Va en
  // un campo aparte: la vista la pinta como cifra capturada, nunca mezclada.
  try {
    const meses = [];
    let d = new Date(`${from}T00:00:00Z`);
    const fin = new Date(`${to}T00:00:00Z`);
    while (d <= fin && meses.length < 24) {
      meses.push(d.toISOString().slice(0, 7));
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }
    if (meses.length) {
      const ph = meses.map(() => '?').join(',');
      const rows = (await env.DB.prepare(
        `SELECT month, paid_views FROM mkt_ig_manual WHERE client_id = ? AND month IN (${ph}) AND paid_views IS NOT NULL`
      ).bind(clientId, ...meses).all()).results || [];
      if (rows.length) {
        out.paid = {
          views: rows.reduce((a, r) => a + (Number(r.paid_views) || 0), 0),
          months: rows.map((r) => r.month).sort(),
        };
      }
    }
  } catch { /* sin columna o sin captura: el resto de la respuesta sigue */ }
  return json(out);
}

// Auto-renovación: los tokens largos de IG se pueden refrescar para extender
// otros 60 días. Refresca los que llevan >25 días sin tocarse (así, con que
// alguien use la app ~1 vez al mes, el token nunca caduca y no hay que
// reconectar a mano). Best-effort: no rompe nada si Meta falla.
export async function refreshAgingIgTokens(env) {
  let list = [];
  try {
    const rows = await env.DB.prepare(
      // OJO: la fecha que manda es ig_token_refreshed_at (migración 021), NO
      // updated_at: esa la toca cualquier edición de la marca y saboteaba el
      // refresh (auditoría 2026-07-31). COALESCE para las filas viejas.
      "SELECT id, ig_access_token FROM mkt_clients WHERE ig_access_token IS NOT NULL AND ig_user_id IS NOT NULL AND (COALESCE(ig_token_refreshed_at, updated_at) IS NULL OR COALESCE(ig_token_refreshed_at, updated_at) < datetime('now','-25 days')) LIMIT 50"
    ).all();
    list = (rows && rows.results) || [];
  } catch { return 0; }
  let refreshed = 0;
  for (const c of list) {
    try {
      const r = await igJson(`${BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.ig_access_token)}`);
      if (r && r.access_token && !r.error) {
        await env.DB.prepare("UPDATE mkt_clients SET ig_access_token = ?, ig_token_refreshed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(r.access_token, c.id).run();
        refreshed += 1;
      }
    } catch { /* noop: el token sigue válido hasta su expiración */ }
  }
  return refreshed;
}

// Salud de las conexiones de IG: prueba el token de cada marca conectada (un
// /me barato). Si una se cayó (el cliente cambió su contraseña o quitó la app),
// la devuelve para avisar — una sola vez por caída (dedupe en mkt_kv
// 'igdown:<clientId>'); al recuperarse, limpia el flag para poder volver a
// avisar si se cae otra vez.
export async function checkIgConnections(env) {
  let clients = [];
  try {
    const r = await env.DB.prepare(
      "SELECT id, name, ig_access_token FROM mkt_clients WHERE ig_access_token IS NOT NULL AND ig_user_id IS NOT NULL LIMIT 20"
    ).all();
    clients = (r && r.results) || [];
  } catch { return []; }
  const down = [];
  for (const c of clients) {
    const me = await igJson(`${GRAPH}/me?fields=id&access_token=${encodeURIComponent(c.ig_access_token)}`);
    const ok = !!(me && me.id && !me.error);
    const flag = 'igdown:' + c.id;
    if (ok) {
      await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(flag).run().catch(() => {});
    } else {
      const already = await env.DB.prepare('SELECT 1 FROM mkt_kv WHERE key = ?').bind(flag).first().catch(() => null);
      if (!already) { await kvSet(env, flag, new Date().toISOString()); down.push({ id: c.id, name: c.name }); }
    }
  }
  return down;
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
      'SELECT followers, reach, interactions, posts, paid_views FROM mkt_ig_manual WHERE client_id = ? AND month = ?'
    ).bind(clientId, month).first();
    if (!r) return null;
    if (r.followers == null && r.reach == null && r.interactions == null && r.posts == null && r.paid_views == null) return null;
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
      `INSERT INTO mkt_ig_manual (client_id, month, followers, reach, interactions, posts, paid_views, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(client_id, month) DO UPDATE SET
         followers=excluded.followers, reach=excluded.reach,
         interactions=excluded.interactions, posts=excluded.posts,
         paid_views=excluded.paid_views,
         updated_at=datetime('now')`
    ).bind(clientId, month, num(b.followers), num(b.reach), num(b.interactions), num(b.posts), num(b.paid_views)).run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

// ── GET /ig/feed?client_id=… → el PERFIL REAL para el simulador de feed ──────
// La vista Feed imita el perfil de Instagram: para que la imitación no mienta
// necesita lo que YA está publicado (foto de perfil, biografía, seguidores y
// las últimas publicaciones con su miniatura) y encima de eso pinta lo que
// falta por salir. Es una sola llamada barata (perfil + media, SIN insights)
// con caché de 20 min en mkt_kv: las URLs del CDN de Instagram caducan, así
// que no conviene guardarlas más tiempo.
const IG_FEED_TTL = 20 * 60 * 1000;

export async function handleIgFeed(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  if (!clientId) return json({ error: 'client_id requerido' }, 400);

  const client = await env.DB.prepare(
    'SELECT ig_user_id, ig_username, ig_access_token FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!client || !client.ig_user_id || !client.ig_access_token) return json({ connected: false });

  const key = `igfeed:${clientId}`;
  if (url.searchParams.get('fresco') !== '1') {
    const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(key).first().catch(() => null);
    if (row) {
      try {
        const c = JSON.parse(row.value);
        if (c && c.at && Date.now() - c.at < IG_FEED_TTL) return json({ ...c.out, cache: true });
      } catch { /* caché inservible: se vuelve a pedir */ }
    }
  }

  const tok = encodeURIComponent(client.ig_access_token);
  const CAMPOS = 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count';
  let prof = await igJson(`${GRAPH}/me?fields=${CAMPOS}&access_token=${tok}`);
  // Si algún campo no está disponible para esta cuenta, Instagram tumba TODA la
  // llamada: se reintenta con lo mínimo indispensable antes de darse por vencido.
  if (!prof || prof.error) {
    prof = await igJson(`${GRAPH}/me?fields=id,username,media_count,followers_count&access_token=${tok}`);
  }
  if (!prof || prof.error) {
    return json({ connected: true, username: client.ig_username, error: (prof && prof.error && prof.error.message) || 'Instagram no respondió' });
  }

  const media = await igJson(
    `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,`
    + `like_count,comments_count,timestamp,children{media_url,thumbnail_url,media_type}&limit=36&access_token=${tok}`
  );

  const posts = [];
  for (const m of (media && media.data) || []) {
    const hijo = m.children && m.children.data && m.children.data[0];
    // El álbum (carrusel) no trae media_url propio: la portada es su primer hijo.
    const thumb = m.media_url || m.thumbnail_url
      || (hijo ? (hijo.thumbnail_url || hijo.media_url) : null);
    const esReel = m.media_product_type === 'REELS' || m.media_type === 'VIDEO';
    posts.push({
      id: m.id,
      tipo: m.media_type === 'CAROUSEL_ALBUM' ? 'carrusel' : (esReel ? 'reel' : 'post'),
      thumb: thumb || null,
      permalink: m.permalink || null,
      caption: m.caption || '',
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      timestamp: m.timestamp || null,
      slides: m.media_type === 'CAROUSEL_ALBUM' && m.children && m.children.data
        ? m.children.data.map((h) => h.thumbnail_url || h.media_url).filter(Boolean)
        : (thumb ? [thumb] : []),
    });
  }
  posts.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  const out = {
    connected: true,
    username: prof.username || client.ig_username || '',
    perfil: {
      username: prof.username || client.ig_username || '',
      name: prof.name || '',
      biography: prof.biography || '',
      website: prof.website || '',
      foto: prof.profile_picture_url || '',
      followers: prof.followers_count ?? null,
      follows: prof.follows_count ?? null,
      media_count: prof.media_count ?? null,
    },
    posts,
  };
  await kvSet(env, key, JSON.stringify({ at: Date.now(), out })).catch(() => {});
  return json(out);
}
