// ============================================================================
// IVAE Marketing — PAUTA (Marketing API de Meta).
//
// QUE ES
// La parte de anuncios pagados de IVAE. Hoy es SOLO para la cuenta publicitaria
// de la propia casa (act_1324130795400604, MXN, America/Cancun): por eso el
// token y la cuenta viven en mkt_kv y no por marca. Si algun dia se abre a
// clientes, esto se mueve a columnas de mkt_clients y el candado pasa a ser por
// workspace, como el resto.
//
// POR QUE NO HIZO FALTA REVISION DE META
// El caso de uso "Crear y administrar anuncios con la API de marketing" quedo
// agregado a la app el 14-sep-2026, y ahi ads_management / ads_read /
// business_management salen "Listo para la prueba": eso alcanza para las
// cuentas donde la persona que da el permiso tiene rol en la app (Vianey es la
// duena). El "Marketing API Access Tier" queda en Acceso limitado, que basta
// para una cuenta y con los limites de llamadas bajos.
//
// ENV que hacen falta (Cloudflare Pages): FB_APP_ID y FB_APP_SECRET, los MISMOS
// de Paginas. No hace falta nada mas: los permisos van por `scope` en el
// dialogo clasico (ver ADS_SCOPE), no por una "configuracion" de login.
//
// ⚠️ NADA DE ESTO GASTA DINERO TODAVIA. Este archivo hoy solo LEE (cuentas,
// campanas, numeros). Mover presupuesto y crear campanas va aparte, con su
// bitacora (mkt_ads_log) y su interruptor, para que ejecutar sea una decision
// explicita y no un efecto secundario de leer.
// ============================================================================

const FB_AUTH = 'https://www.facebook.com/v23.0/dialog/oauth';
const FB_GRAPH = 'https://graph.facebook.com/v23.0';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pauta · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none}small{color:#888}</style><main>${body}</main>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rnd() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function kvSet(env, k, v) {
  await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind(k, v).run();
}
async function kvGet(env, k) {
  const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(k).first();
  return row ? row.value : null;
}
async function kvJson(env, k) {
  const v = await kvGet(env, k);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}
async function kvTake(env, k) {
  const v = await kvGet(env, k);
  if (v != null) await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(k).run();
  return v;
}

const adsRedirectUri = (request) => new URL('/api/marketing/ads/callback', request.url).toString();

// Permisos que se le piden a Facebook. Van por `scope` a pelo, SIN config_id.
//
// ⚠️ Esto NO es como el login de Páginas (_facebook.js), que sí exige una
// "configuración" de Inicio de sesión para empresas. Medido el 14-sep-2026
// contra esta app: el diálogo clásico con `scope` responde y devuelve code, así
// que no hace falta crear ninguna configuración nueva. Lo ÚNICO que hay que
// tener es esta ruta de vuelta dada de alta en "URI de redireccionamiento de
// OAuth válidos" (ya está: /api/marketing/ads/callback).
const ADS_SCOPE = 'ads_management,ads_read';

function faltaConfig(env) {
  if (!env.FB_APP_ID || !env.FB_APP_SECRET) {
    return 'Faltan FB_APP_ID / FB_APP_SECRET en Cloudflare Pages.';
  }
  return null;
}

// Solo la casa toca la pauta: es dinero de IVAE, no de una marca cliente.
const soloAdmin = (session) => session && session.role === 'admin';

// ── Conectar ────────────────────────────────────────────────────────────────
// GET /ads/login → diálogo de Facebook pidiendo acceso a cuentas publicitarias.
export async function handleAdsLogin(request, env, session, url) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const falta = faltaConfig(env);
  if (falta) return json({ error: falta }, 503);
  const nonce = rnd();
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  await kvSet(env, `ads_state_${nonce}`, JSON.stringify({ t: Date.now(), l: lang }));
  const p = new URLSearchParams({
    client_id: env.FB_APP_ID,
    redirect_uri: adsRedirectUri(request),
    state: nonce,
    response_type: 'code',
    scope: ADS_SCOPE,
    // Si Facebook ya dio por buenos estos permisos antes, salta el diálogo y
    // vuelve con un code de los permisos VIEJOS. auth_type=rerequest obliga a
    // volver a preguntar, que es justo lo que queremos la primera vez.
    auth_type: 'rerequest',
    ...(lang === 'en' ? { locale: 'en_US' } : {}),
  });
  return Response.redirect(`${FB_AUTH}?${p}`, 302);
}

async function fbJson(u, init) {
  const r = await fetch(u, init);
  let d = null;
  try { d = await r.json(); } catch { /* respuesta no-JSON */ }
  if (!r.ok || (d && d.error)) {
    const m = (d && d.error && d.error.message) || `HTTP ${r.status}`;
    throw new Error(m);
  }
  return d || {};
}

// GET /ads/callback — code → token largo → cuentas publicitarias → elegir.
export async function handleAdsCallback(request, env, url) {
  const back = '/marketing/app#/pauta';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `ads_state_${state}`);
  if (!code || !raw) return html(`<h1>Enlace inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar cuenta publicitaria" otra vez.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  const EN = st.l === 'en';
  if (Date.now() - st.t > 10 * 60 * 1000) {
    return html(EN ? `<h1>The attempt expired</h1><a href="${back}">Back</a>` : `<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  }
  try {
    const corto = await fbJson(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id: env.FB_APP_ID,
      client_secret: env.FB_APP_SECRET,
      redirect_uri: adsRedirectUri(request),
      code,
    }));
    // Token largo (~60 días). Se renueva solo desde el reloj mientras siga vivo.
    const largo = await fbJson(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: env.FB_APP_ID,
      client_secret: env.FB_APP_SECRET,
      fb_exchange_token: corto.access_token,
    }));
    const tok = largo.access_token || corto.access_token;
    await kvSet(env, 'ads_token', JSON.stringify({ t: tok, at: Date.now() }));

    const cuentas = await fbJson(`${FB_GRAPH}/me/adaccounts?` + new URLSearchParams({
      fields: 'id,account_id,name,currency,timezone_name,account_status,funding_source_details',
      limit: '50',
      access_token: tok,
    }));
    const lista = (cuentas && cuentas.data) || [];
    if (!lista.length) {
      return html(EN
        ? `<h1>No ad accounts</h1><p>This Facebook account does not manage any ad account.</p><a href="${back}">Back to the app</a>`
        : `<h1>Sin cuentas publicitarias</h1><p>Esta cuenta de Facebook no administra ninguna cuenta publicitaria.</p><a href="${back}">Volver a la app</a>`);
    }
    if (lista.length === 1) {
      await guardarCuenta(env, lista[0]);
      return html(EN
        ? `<h1>✅ Ad account connected</h1><p>Linked to <b>${esc(lista[0].name)}</b>.</p><a href="${back}">Back to the app</a>`
        : `<h1>✅ Cuenta publicitaria conectada</h1><p>Quedó ligada a <b>${esc(lista[0].name)}</b>.</p><a href="${back}">Volver a la app</a>`);
    }
    const pickId = rnd();
    await kvSet(env, `ads_pick_${pickId}`, JSON.stringify({ t: Date.now(), l: st.l, cuentas: lista }));
    const botones = lista.map((c) =>
      `<a href="/api/marketing/ads/callback?pick=${pickId}&cuenta=${encodeURIComponent(c.id)}">📣 ${esc(c.name)} · ${esc(c.currency)}</a>`
    ).join('');
    return html(EN
      ? `<h1>Which ad account?</h1><p>Your account manages several. Pick the right one:</p>${botones}<small>This link expires in 10 minutes.</small>`
      : `<h1>¿Cuál cuenta publicitaria?</h1><p>Tu cuenta administra varias. Elige la correcta:</p>${botones}<small>Este enlace caduca en 10 minutos.</small>`);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// GET /ads/callback?pick=…&cuenta=… — segundo paso cuando hay varias cuentas.
export async function handleAdsPick(request, env, url) {
  const back = '/marketing/app#/pauta';
  const raw = await kvTake(env, `ads_pick_${url.searchParams.get('pick') || ''}`);
  if (!raw) return html(`<h1>Enlace caducado</h1><a href="${back}">Volver</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  const EN = st.l === 'en';
  if (Date.now() - st.t > 10 * 60 * 1000) return html(EN ? '<h1>The attempt expired</h1>' : '<h1>El intento caducó</h1>', 400);
  const cuenta = (st.cuentas || []).find((c) => c.id === (url.searchParams.get('cuenta') || ''));
  if (!cuenta) return html(EN ? '<h1>Account not found</h1>' : '<h1>Cuenta no encontrada</h1>', 400);
  await guardarCuenta(env, cuenta);
  return html(EN
    ? `<h1>✅ Ad account connected</h1><p>Linked to <b>${esc(cuenta.name)}</b>.</p><a href="${back}">Back to the app</a>`
    : `<h1>✅ Cuenta publicitaria conectada</h1><p>Quedó ligada a <b>${esc(cuenta.name)}</b>.</p><a href="${back}">Volver a la app</a>`);
}

async function guardarCuenta(env, c) {
  await kvSet(env, 'ads_cuenta', JSON.stringify({
    id: c.id,                       // "act_1324130795400604"
    account_id: c.account_id || String(c.id || '').replace(/^act_/, ''),
    name: c.name || '',
    currency: c.currency || 'MXN',
    timezone: c.timezone_name || 'America/Cancun',
    status: c.account_status,
    conectada_at: new Date().toISOString(),
  }));
}

// ── Estado ──────────────────────────────────────────────────────────────────
// GET /ads/estado → qué hay conectado y si puede gastar (sin método de pago,
// Meta no deja publicar: mejor decirlo aquí que dejar a la IA chocar contra eso).
export async function handleAdsEstado(env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const falta = faltaConfig(env);
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return json({ conectada: false, falta_config: falta });
  let pago = null;
  let error = null;
  try {
    const d = await fbJson(`${FB_GRAPH}/${cuenta.id}?` + new URLSearchParams({
      fields: 'name,currency,account_status,disable_reason,funding_source_details,balance,amount_spent',
      access_token: tok.t,
    }));
    pago = {
      account_status: d.account_status,
      disable_reason: d.disable_reason,
      medio_pago: (d.funding_source_details && (d.funding_source_details.display_string || d.funding_source_details.type)) || null,
      balance: d.balance,
      gastado_total: d.amount_spent,
    };
  } catch (e) { error = (e && e.message) || 'No se pudo leer la cuenta'; }
  return json({ conectada: true, cuenta, pago, error, falta_config: falta });
}

// ── Campañas + números ──────────────────────────────────────────────────────
// GET /ads/campanas?dias=7 → campañas con lo que gastaron y lo que devolvieron.
// Insights por campaña en una sola llamada (field expansion), que en Acceso
// limitado importa: el tier bajo tiene pocas llamadas por hora.
export async function handleAdsCampanas(env, session, url) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  const dias = Math.min(90, Math.max(1, parseInt(url.searchParams.get('dias') || '7', 10) || 7));
  const preset = dias <= 1 ? 'today' : (dias <= 7 ? 'last_7d' : (dias <= 14 ? 'last_14d' : (dias <= 30 ? 'last_30d' : 'last_90d')));
  try {
    const d = await fbJson(`${FB_GRAPH}/${cuenta.id}/campaigns?` + new URLSearchParams({
      fields: [
        'id', 'name', 'status', 'effective_status', 'objective',
        'daily_budget', 'lifetime_budget', 'start_time', 'stop_time',
        `insights.date_preset(${preset}){spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type,frequency}`,
      ].join(','),
      limit: '100',
      access_token: tok.t,
    }));
    return json({ cuenta, dias, preset, campanas: (d && d.data) || [] });
  } catch (e) {
    return json({ error: (e && e.message) || 'No se pudo leer las campañas' }, 502);
  }
}
