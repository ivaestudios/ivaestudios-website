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
    // "Invalid parameter" a secas no sirve para nada: el QUE esta mal viene en
    // error_user_msg / error_data / subcodigo. Se junta todo en el mensaje.
    const e = (d && d.error) || {};
    const partes = [
      e.message || `HTTP ${r.status}`,
      e.error_user_title,
      e.error_user_msg,
      e.error_data && typeof e.error_data === 'object' ? JSON.stringify(e.error_data) : e.error_data,
      e.code != null ? `code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}` : null,
    ].filter(Boolean);
    throw new Error(partes.join(' · ').slice(0, 500));
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

// ============================================================================
// PASO 2: EL RELOJ. Guardar cada dia lo que gasto y devolvio cada campana.
//
// Sin esto solo hay fotos del acumulado, y con un acumulado no se puede decidir
// nada: "gasto 300" no dice si va mejorando o empeorando. Corre una vez al dia
// desde handleCron y es idempotente (si corre dos veces el mismo dia, pisa la
// misma fila).
// ============================================================================

// Ayer en la zona horaria de la CUENTA, no del servidor: Meta cierra el dia con
// el reloj de la cuenta, y un dia corrido es un dia entero de datos perdidos.
function ayerEnZona(tz) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
    const hoy = f.format(new Date());
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  } catch {
    const d = new Date(Date.now() - 864e5);
    return d.toISOString().slice(0, 10);
  }
}

export async function guardarDiaAds(env, { dia = null } = {}) {
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return { ok: false, motivo: 'sin cuenta conectada' };
  const d = dia || ayerEnZona(cuenta.timezone);

  // Una sola llamada para TODAS las campanas (level=campaign): el Access Tier
  // limitado tiene pocas llamadas por hora y una por campana lo reventaria.
  let filas = [];
  try {
    const r = await fbJson(`${FB_GRAPH}/${cuenta.id}/insights?` + new URLSearchParams({
      level: 'campaign',
      time_range: JSON.stringify({ since: d, until: d }),
      fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,actions,cost_per_action_type',
      limit: '300',
      access_token: tok.t,
    }));
    filas = (r && r.data) || [];
  } catch (e) {
    return { ok: false, dia: d, error: (e && e.message) || 'error' };
  }
  if (!filas.length) return { ok: true, dia: d, guardadas: 0 };

  // Estado y presupuesto VIVOS (insights no los trae) para que la IA vea con
  // que esta trabajando hoy, no como estaba el dia del gasto.
  const estados = new Map();
  try {
    const r = await fbJson(`${FB_GRAPH}/${cuenta.id}/campaigns?` + new URLSearchParams({
      fields: 'id,status,effective_status,daily_budget,lifetime_budget',
      limit: '300',
      access_token: tok.t,
    }));
    for (const c of (r && r.data) || []) estados.set(c.id, c);
  } catch { /* sin esto se guarda igual: el gasto es lo importante */ }

  const ahora = new Date().toISOString();
  let n = 0;
  for (const f of filas) {
    const est = estados.get(f.campaign_id) || {};
    const res = resultadoPrincipal(f);
    try {
      await env.DB.prepare(
        `INSERT INTO mkt_ads_dia
           (dia, campaign_id, campaign_name, objetivo, estado, presupuesto_diario,
            gasto, impresiones, alcance, clics, resultados, tipo_resultado,
            costo_resultado, moneda, capturado_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(dia, campaign_id) DO UPDATE SET
           campaign_name = excluded.campaign_name, objetivo = excluded.objetivo,
           estado = excluded.estado, presupuesto_diario = excluded.presupuesto_diario,
           gasto = excluded.gasto, impresiones = excluded.impresiones,
           alcance = excluded.alcance, clics = excluded.clics,
           resultados = excluded.resultados, tipo_resultado = excluded.tipo_resultado,
           costo_resultado = excluded.costo_resultado, capturado_at = excluded.capturado_at`
      ).bind(
        d, f.campaign_id, f.campaign_name || null, f.objective || null,
        est.effective_status || est.status || null,
        est.daily_budget ? Number(est.daily_budget) / 100 : null,
        Number(f.spend) || 0, Number(f.impressions) || 0, Number(f.reach) || 0,
        Number(f.clicks) || 0, res ? res.valor : null, res ? res.tipo : null,
        res && res.costo != null ? res.costo : null,
        cuenta.currency || 'MXN', ahora,
      ).run();
      n += 1;
    } catch (e) { console.error('[ads dia]', f.campaign_id, e && e.message); }
  }
  return { ok: true, dia: d, guardadas: n };
}

// El "resultado" depende del objetivo (mensajes, clics, registros…): Meta lo
// manda dentro de actions[], no en un campo fijo. Gemelo del de views/pauta.js.
const ACCIONES_UTILES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'lead',
  'purchase',
  'landing_page_view',
  'link_click',
  'post_engagement',
];
function resultadoPrincipal(ins) {
  const acts = (ins && ins.actions) || [];
  for (const tipo of ACCIONES_UTILES) {
    const a = acts.find((x) => x.action_type === tipo);
    if (a) {
      const c = (ins.cost_per_action_type || []).find((x) => x.action_type === tipo);
      return { tipo, valor: Number(a.value) || 0, costo: c ? Number(c.value) : null };
    }
  }
  return null;
}

// ============================================================================
// PASO 3: LA IA DECIDE Y MUEVE.
//
// Lee los ultimos 14 dias de mkt_ads_dia (que es donde vive la HISTORIA; el
// acumulado de Meta no dice si una campana va mejorando) y le pide a Claude una
// decision por campana con su motivo. Despues la ejecuta contra la Marketing
// API y deja huella en mkt_ads_log.
//
// LOS FRENOS (existen aunque sea dinero de la casa: un bug que gasta, gasta):
//   · Interruptor `ads_auto`: en '0' la IA DECIDE pero NO toca nada. Nace
//     apagado a proposito — se prende cuando se haya visto una tanda de
//     decisiones y convenzan.
//   · `ads_tope_diario` (MXN): techo de la suma de presupuestos diarios que la
//     IA puede dejar vivos. Si se pasa, recorta la subida.
//   · Un cambio de presupuesto nunca mueve mas de ±50% de golpe.
//   · Bajar un presupuesto por debajo de lo YA gastado lo rechaza Meta: los
//     de tipo lifetime solo se suben, nunca se bajan.
//   · Todo movimiento (y todo error) queda en mkt_ads_log con el motivo.
// ============================================================================

const MODELO_IA = 'claude-sonnet-5';
const TOPE_DIARIO_DEFAULT = 500;      // MXN/dia repartidos entre campanas
const CAMBIO_MAX = 0.5;               // ±50% por movimiento
// 90 dias: sus campanas son promociones de post que duran pocos dias y se
// espacian. A 14 dias la foto salia vacia aunque hubiera historia de sobra.
const DIAS_VENTANA = 90;

async function bitacora(env, fila) {
  try {
    await env.DB.prepare(
      `INSERT INTO mkt_ads_log (id, at, quien, accion, campaign_id, campaign_name, antes, despues, motivo, ok, error)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      rnd(), new Date().toISOString(), fila.quien || 'ia', fila.accion,
      fila.campaign_id || null, fila.campaign_name || null,
      fila.antes == null ? null : String(fila.antes),
      fila.despues == null ? null : String(fila.despues),
      fila.motivo || null, fila.ok ? 1 : 0, fila.error || null,
    ).run();
  } catch (e) { console.error('[ads log]', e && e.message); }
}

// La foto que ve la IA: por campana, lo de los ultimos 14 dias sumado, mas su
// estado y presupuesto de HOY.
async function fotoParaLaIA(env, cuenta, tok) {
  const desde = new Date(Date.now() - DIAS_VENTANA * 864e5).toISOString().slice(0, 10);
  const hist = await env.DB.prepare(
    `SELECT campaign_id, campaign_name,
            SUM(gasto) AS gasto, SUM(alcance) AS alcance, SUM(clics) AS clics,
            SUM(COALESCE(resultados,0)) AS resultados,
            MAX(tipo_resultado) AS tipo_resultado,
            COUNT(*) AS dias
       FROM mkt_ads_dia
      WHERE dia >= ?
      GROUP BY campaign_id
      ORDER BY gasto DESC
      LIMIT 40`
  ).bind(desde).all();

  const vivas = new Map();
  try {
    const r = await fbJson(`${FB_GRAPH}/${cuenta.id}/campaigns?` + new URLSearchParams({
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      limit: '300',
      access_token: tok.t,
    }));
    for (const c of (r && r.data) || []) vivas.set(c.id, c);
  } catch (e) { throw new Error('No se pudo leer las campañas: ' + ((e && e.message) || '')); }

  const campanas = [];
  for (const h of (hist.results || [])) {
    const v = vivas.get(h.campaign_id);
    if (!v) continue; // borrada en Meta: no se opina de lo que ya no existe
    const gasto = Number(h.gasto) || 0;
    const res = Number(h.resultados) || 0;
    campanas.push({
      id: h.campaign_id,
      nombre: v.name || h.campaign_name,
      estado: v.effective_status || v.status,
      objetivo: v.objective,
      presupuesto_diario_mxn: v.daily_budget ? Number(v.daily_budget) / 100 : null,
      presupuesto_total_mxn: v.lifetime_budget ? Number(v.lifetime_budget) / 100 : null,
      dias_con_datos: Number(h.dias) || 0,
      gasto_14d_mxn: Math.round(gasto * 100) / 100,
      alcance_14d: Number(h.alcance) || 0,
      clics_14d: Number(h.clics) || 0,
      resultados_14d: res,
      tipo_resultado: h.tipo_resultado,
      costo_por_resultado_mxn: res ? Math.round((gasto / res) * 100) / 100 : null,
    });
  }
  return campanas;
}

const ESQUEMA_DECISIONES = {
  type: 'object',
  properties: {
    lectura: { type: 'string', description: 'Dos o tres frases en español, para la dueña, sobre cómo va la pauta en conjunto.' },
    decisiones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string' },
          accion: { type: 'string', enum: ['dejar', 'pausar', 'activar', 'presupuesto'] },
          presupuesto_diario_mxn: { type: 'number', description: 'Solo con accion=presupuesto. Pesos mexicanos al día.' },
          motivo: { type: 'string', description: 'Una frase, en español, con el número que justifica la decisión.' },
        },
        required: ['campaign_id', 'accion', 'motivo'],
      },
    },
  },
  required: ['lectura', 'decisiones'],
};

async function pedirDecisiones(env, campanas, tope) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
  const prompt = `Eres quien lleva la pauta de IVAE Estudios, un estudio de fotografía de bodas y sesiones en Cancún y Riviera Maya. Decides con números, no con corazonadas.

Estas son las campañas de los últimos ${DIAS_VENTANA} días, con lo que gastaron y lo que devolvieron (pesos mexicanos):

${JSON.stringify(campanas, null, 1)}

Presupuesto tope: ${tope} MXN al día sumando TODAS las campañas activas.

Cómo decidir:
- Compara el costo por resultado entre campañas. Lo caro se pausa, lo barato se alimenta.
- Una campaña con menos de 3 días de datos o con menos de 100 MXN gastados todavía no dice nada: déjala correr.
- No muevas por mover: si algo va bien y estable, "dejar" es la respuesta correcta.
- Un cambio de presupuesto no puede ser mayor a ±50% de lo que tiene hoy.
- Las que ya están pausadas solo se activan si sus números eran claramente buenos.
- El motivo SIEMPRE lleva el número que lo justifica.`;

  const cuerpo = {
    model: MODELO_IA,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: 'entregar_decisiones', description: 'Entrega la lectura y una decisión por campaña.', input_schema: ESQUEMA_DECISIONES }],
    tool_choice: { type: 'tool', name: 'entregar_decisiones' },
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(90000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error && d.error.message) || `HTTP ${r.status}`);
  const uso = (d.content || []).find((b) => b.type === 'tool_use');
  if (!uso || !uso.input) throw new Error('La IA no devolvió decisiones');
  return uso.input;
}

// Ejecuta UNA decisión. Devuelve {ok, antes, despues, error}.
async function ejecutar(env, cuenta, tok, campana, dec, tope, ocupadoYa) {
  const post = async (campos) => fbJson(`${FB_GRAPH}/${campana.id}`, {
    method: 'POST',
    body: new URLSearchParams({ ...campos, access_token: tok.t }),
  });
  if (dec.accion === 'pausar') {
    await post({ status: 'PAUSED' });
    return { ok: true, antes: campana.estado, despues: 'PAUSED' };
  }
  if (dec.accion === 'activar') {
    await post({ status: 'ACTIVE' });
    return { ok: true, antes: campana.estado, despues: 'ACTIVE' };
  }
  // presupuesto
  const hoy = campana.presupuesto_diario_mxn;
  if (!hoy) {
    // Sin presupuesto DIARIO no hay nada que ajustar sin riesgo: los de tipo
    // "total" los rechaza Meta si quedan por debajo de lo ya gastado.
    return { ok: false, error: 'La campaña no usa presupuesto diario: no se toca.' };
  }
  let nuevo = Number(dec.presupuesto_diario_mxn);
  if (!Number.isFinite(nuevo) || nuevo <= 0) return { ok: false, error: 'Presupuesto inválido' };
  const techo = hoy * (1 + CAMBIO_MAX);
  const piso = hoy * (1 - CAMBIO_MAX);
  nuevo = Math.min(techo, Math.max(piso, nuevo));
  // El tope de la casa manda sobre lo que pida la IA.
  const margen = tope - ocupadoYa;
  if (nuevo > hoy && nuevo - hoy > margen) nuevo = hoy + Math.max(0, margen);
  nuevo = Math.round(nuevo);
  if (nuevo === Math.round(hoy)) return { ok: false, error: 'El tope diario no deja subir más.' };
  await post({ daily_budget: String(nuevo * 100) });
  return { ok: true, antes: `${Math.round(hoy)} MXN/día`, despues: `${nuevo} MXN/día` };
}

/**
 * Revisa la pauta y (si el interruptor está encendido) la mueve.
 * @param {{ejecutar?: boolean, quien?: string}} opts
 */
export async function revisarPauta(env, opts = {}) {
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return { ok: false, error: 'Cuenta publicitaria no conectada' };

  const auto = (await kvGet(env, 'ads_auto')) === '1';
  const mueve = opts.ejecutar != null ? !!opts.ejecutar : auto;
  const tope = Number(await kvGet(env, 'ads_tope_diario')) || TOPE_DIARIO_DEFAULT;

  const campanas = await fotoParaLaIA(env, cuenta, tok);
  if (!campanas.length) {
    return { ok: true, mueve, lectura: 'Todavía no hay suficiente historia para decidir. El reloj guarda los números cada día; con dos o tres días ya se puede comparar.', decisiones: [], aplicadas: 0 };
  }

  const salida = await pedirDecisiones(env, campanas, tope);
  const porId = new Map(campanas.map((c) => [c.id, c]));

  // Lo que ya ocupan de presupuesto diario las que van a seguir vivas.
  let ocupado = campanas
    .filter((c) => String(c.estado).toUpperCase() === 'ACTIVE')
    .reduce((s, c) => s + (c.presupuesto_diario_mxn || 0), 0);

  const hechas = [];
  for (const dec of (salida.decisiones || [])) {
    const c = porId.get(dec.campaign_id);
    if (!c) continue;
    if (dec.accion === 'dejar') { hechas.push({ ...dec, nombre: c.nombre, aplicada: false }); continue; }
    if (!mueve) { hechas.push({ ...dec, nombre: c.nombre, aplicada: false, pendiente: true }); continue; }
    let r;
    try {
      r = await ejecutar(env, cuenta, tok, c, dec, tope, ocupado);
    } catch (e) { r = { ok: false, error: (e && e.message) || 'Error' }; }
    if (r.ok && dec.accion === 'presupuesto') {
      ocupado += (parseFloat(r.despues) || 0) - (parseFloat(r.antes) || 0);
    }
    await bitacora(env, {
      quien: opts.quien || 'ia', accion: dec.accion,
      campaign_id: c.id, campaign_name: c.nombre,
      antes: r.antes, despues: r.despues, motivo: dec.motivo,
      ok: r.ok, error: r.error,
    });
    hechas.push({ ...dec, nombre: c.nombre, aplicada: !!r.ok, error: r.error, antes: r.antes, despues: r.despues });
  }

  const resumen = { at: new Date().toISOString(), lectura: salida.lectura, decisiones: hechas, mueve, tope };
  await kvSet(env, 'ads_ultima_revision', JSON.stringify(resumen));
  return { ok: true, ...resumen, aplicadas: hechas.filter((h) => h.aplicada).length };
}

// ── Endpoints del paso 3 ────────────────────────────────────────────────────
/**
 * Rellena la historia hacia atrás en UNA sola llamada.
 *
 * El reloj empieza a guardar desde mañana, así que sin esto la primera revisión
 * no tendría con qué comparar. `time_increment=1` hace que Meta devuelva una
 * fila POR DÍA y por campaña de un tirón: 1 llamada en vez de 90, que en
 * Acceso limitado es la diferencia entre poder y no poder. Idempotente.
 */
export async function rellenarHistoria(env, dias = 90) {
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return { ok: false, motivo: 'sin cuenta conectada' };

  const hasta = ayerEnZona(cuenta.timezone);
  const d0 = new Date(`${hasta}T12:00:00Z`);
  d0.setUTCDate(d0.getUTCDate() - (dias - 1));
  const desde = d0.toISOString().slice(0, 10);

  let filas = [];
  try {
    const r = await fbJson(`${FB_GRAPH}/${cuenta.id}/insights?` + new URLSearchParams({
      level: 'campaign',
      time_increment: '1',
      time_range: JSON.stringify({ since: desde, until: hasta }),
      fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,actions,cost_per_action_type,date_start',
      limit: '500',
      access_token: tok.t,
    }));
    filas = (r && r.data) || [];
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'error', desde, hasta };
  }

  const estados = new Map();
  try {
    const r = await fbJson(`${FB_GRAPH}/${cuenta.id}/campaigns?` + new URLSearchParams({
      fields: 'id,status,effective_status,daily_budget',
      limit: '300',
      access_token: tok.t,
    }));
    for (const c of (r && r.data) || []) estados.set(c.id, c);
  } catch { /* el gasto es lo importante */ }

  const ahora = new Date().toISOString();
  let n = 0;
  for (const f of filas) {
    const dia = f.date_start;
    if (!dia) continue;
    const est = estados.get(f.campaign_id) || {};
    const res = resultadoPrincipal(f);
    try {
      await env.DB.prepare(
        `INSERT INTO mkt_ads_dia
           (dia, campaign_id, campaign_name, objetivo, estado, presupuesto_diario,
            gasto, impresiones, alcance, clics, resultados, tipo_resultado,
            costo_resultado, moneda, capturado_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(dia, campaign_id) DO UPDATE SET
           campaign_name = excluded.campaign_name, gasto = excluded.gasto,
           impresiones = excluded.impresiones, alcance = excluded.alcance,
           clics = excluded.clics, resultados = excluded.resultados,
           tipo_resultado = excluded.tipo_resultado,
           costo_resultado = excluded.costo_resultado,
           capturado_at = excluded.capturado_at`
      ).bind(
        dia, f.campaign_id, f.campaign_name || null, f.objective || null,
        est.effective_status || est.status || null,
        est.daily_budget ? Number(est.daily_budget) / 100 : null,
        Number(f.spend) || 0, Number(f.impressions) || 0, Number(f.reach) || 0,
        Number(f.clicks) || 0, res ? res.valor : null, res ? res.tipo : null,
        res && res.costo != null ? res.costo : null,
        cuenta.currency || 'MXN', ahora,
      ).run();
      n += 1;
    } catch (e) { console.error('[ads historia]', dia, e && e.message); }
  }
  return { ok: true, desde, hasta, guardadas: n };
}

export async function handleAdsRevisar(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  let body = {};
  try { body = await request.json(); } catch { /* sin cuerpo */ }
  try {
    // Primera vez: sin historia no hay nada que comparar. Se trae de Meta.
    try {
      const hay = await env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_ads_dia').first();
      if (!hay || !Number(hay.n)) await rellenarHistoria(env);
    } catch { /* si falla, revisarPauta lo dirá con todas sus letras */ }
    const r = await revisarPauta(env, { ejecutar: body.ejecutar, quien: 'ia' });
    return json(r, r.ok ? 200 : 409);
  } catch (e) {
    return json({ error: (e && e.message) || 'No se pudo revisar' }, 502);
  }
}

export async function handleAdsBitacora(env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const auto = (await kvGet(env, 'ads_auto')) === '1';
  const tope = Number(await kvGet(env, 'ads_tope_diario')) || TOPE_DIARIO_DEFAULT;
  const ultima = await kvJson(env, 'ads_ultima_revision');
  let log = [];
  try {
    const r = await env.DB.prepare('SELECT * FROM mkt_ads_log ORDER BY at DESC LIMIT 50').all();
    log = r.results || [];
  } catch { /* tabla nueva: puede no existir en un entorno viejo */ }
  return json({ auto, tope, ultima, log });
}

// POST /ads/ajustes { auto: bool, tope: number } — el interruptor y el techo.
export async function handleAdsAjustes(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  if (typeof body.auto === 'boolean') {
    await kvSet(env, 'ads_auto', body.auto ? '1' : '0');
    await bitacora(env, { quien: 'persona', accion: body.auto ? 'encender_auto' : 'apagar_auto', ok: true, motivo: 'Interruptor de la pauta automática' });
  }
  if (body.tope != null) {
    const t = Math.max(50, Math.min(50000, Number(body.tope) || 0));
    await kvSet(env, 'ads_tope_diario', String(t));
    await bitacora(env, { quien: 'persona', accion: 'tope_diario', despues: `${t} MXN/día`, ok: true, motivo: 'Techo de gasto diario' });
  }
  return handleAdsBitacora(env, session);
}

// ============================================================================
// PASO 4: CREAR UNA CAMPANA.
//
// Todas las campanas de la casa son promociones de un post de Instagram con
// objetivo de clics. Esto arma lo mismo pero desde cero y por API: campana →
// conjunto (publico + presupuesto) → creativo (foto + textos) → anuncio.
//
// ⚠️ NACE PAUSADA, SIEMPRE. Publicar un anuncio con textos recien escritos, en
// la marca de la duena y con su dinero, no puede ser un efecto secundario de
// pedir que se cree: se crea, se mira, y se enciende aparte (POST /ads/encender).
// ============================================================================

// GET /ads/opciones → con que se puede anunciar: paginas e Instagram ligados a
// la cuenta, y el limite de gasto que Meta le puso.
export async function handleAdsOpciones(env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  const out = { cuenta };
  const pide = async (k, path, params) => {
    try {
      const r = await fbJson(`${FB_GRAPH}/${path}?` + new URLSearchParams({ ...params, access_token: tok.t }));
      out[k] = (r && r.data) || r;
    } catch (e) { out[k] = { error: (e && e.message) || 'error' }; }
  };
  await pide('paginas', `${cuenta.id}/promote_pages`, { fields: 'id,name', limit: '50' });
  await pide('instagram', `${cuenta.id}/instagram_accounts`, { fields: 'id,username', limit: '50' });
  await pide('limites', `${cuenta.id}`, { fields: 'spend_cap,amount_spent,balance,min_daily_budget,currency,funding_source_details' });
  // El publico que YA funciono: es el que se copia al crear, y saberlo de
  // antemano evita escribir el anuncio en el idioma equivocado.
  try { out.publico_probado = await publicoProbado(env, cuenta, tok); }
  catch (e) { out.publico_probado = { error: (e && e.message) || 'error' }; }
  return json(out);
}

// El publico NO se inventa: se copia del conjunto de la campana que MEJOR
// costo por resultado tuvo (con gasto suficiente para que el dato signifique
// algo). Si no hay historia, cae a un publico amplio de Mexico.
const PUBLICO_FALLBACK = {
  geo_locations: { countries: ['MX'] },
  age_min: 25,
  age_max: 50,
  targeting_automation: { advantage_audience: 1 },
};

async function publicoProbado(env, cuenta, tok) {
  let mejor = null;
  try {
    const r = await env.DB.prepare(
      `SELECT campaign_id, campaign_name, SUM(gasto) g, SUM(COALESCE(resultados,0)) res
         FROM mkt_ads_dia GROUP BY campaign_id
        HAVING g >= 100 AND res > 0
        ORDER BY (g / res) ASC LIMIT 1`
    ).first();
    mejor = r || null;
  } catch { /* sin historia */ }
  if (!mejor) return { targeting: PUBLICO_FALLBACK, de: null };
  try {
    const r = await fbJson(`${FB_GRAPH}/${mejor.campaign_id}/adsets?` + new URLSearchParams({
      fields: 'targeting,optimization_goal,billing_event',
      limit: '1',
      access_token: tok.t,
    }));
    const a = (r && r.data && r.data[0]) || null;
    if (a && a.targeting) {
      // Se limpia lo que no se puede reusar tal cual en un conjunto nuevo.
      // Se limpia lo que Meta ya no acepta al CREAR aunque lo siga devolviendo
      // al leer: `targeting_optimization` esta retirado (code 100/1870197) y
      // los publicos personalizados no se pueden reusar entre cuentas.
      const t = { ...a.targeting };
      for (const k of [
        'excluded_custom_audiences', 'custom_audiences',
        'brand_safety_content_filter_levels', 'targeting_optimization',
        'targeting_relaxation_types', 'is_whatsapp_destination_ad',
      ]) delete t[k];
      return { targeting: t, de: mejor.campaign_name, costo: Math.round((mejor.g / mejor.res) * 100) / 100 };
    }
  } catch { /* si no se puede leer, publico amplio */ }
  return { targeting: PUBLICO_FALLBACK, de: null };
}

// La foto se le pasa a Meta POR URL (campo `picture`), no subiendo los bytes.
//
// ⚠️ El camino "correcto" (bajar la imagen y subirla a /adimages para tener un
// image_hash) TUMBABA EL WORKER: bajar de ivaestudios.com desde la propia
// Function es una subpeticion a la misma zona, y armar el multipart con File
// no es fiable en el runtime de Workers. Meta baja la URL igual y la cachea,
// asi que el hash no aporta nada aqui. Lo unico que exige es que la URL sea
// publica, y lo es.

// GET /ads/creativo?campaign_id=… → como esta armado por dentro un anuncio que
// YA funciona. Sirve para copiar la forma exacta en vez de adivinarla, y para
// entender por que Meta rechaza una forma nueva.
export async function handleAdsCreativo(env, session, url) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const tok = await kvJson(env, 'ads_token');
  if (!tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  const camp = url.searchParams.get('campaign_id') || '';
  if (!camp) return json({ error: 'Falta campaign_id' }, 400);
  try {
    const r = await fbJson(`${FB_GRAPH}/${camp}/ads?` + new URLSearchParams({
      fields: 'id,name,status,creative{id,name,object_story_id,effective_object_story_id,instagram_permalink_url,effective_instagram_media_id,object_type,image_url,thumbnail_url,asset_feed_spec,object_story_spec}',
      limit: '5',
      access_token: tok.t,
    }));
    return json({ anuncios: (r && r.data) || [] });
  } catch (e) {
    return json({ error: (e && e.message) || 'error' }, 400);
  }
}

/**
 * POST /ads/crear — arma campana + conjunto + creativo + anuncio, TODO PAUSADO.
 * body: { nombre, titular, texto, descripcion, enlace, imagen_url,
 *         presupuesto_mxn, dias, cta }
 */
export async function handleAdsCrear(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  const pagina = String(b.page_id || '134197847330430');
  const presupuesto = Math.max(20, Math.min(5000, Number(b.presupuesto_mxn) || 400));
  const dias = Math.max(1, Math.min(14, Number(b.dias) || 1));
  const enlace = String(b.enlace || 'https://ivaestudios.com/cancun-photographer');
  const nombre = String(b.nombre || `IA · ${new Date().toISOString().slice(0, 10)}`).slice(0, 100);
  if (!b.object_story_id && (!b.texto || !b.imagen_url)) {
    return json({ error: 'Faltan texto o imagen_url (o un object_story_id de un post que ya exista)' }, 400);
  }

  // Se apunta lo que se va creando para poder DESHACERLO si un paso falla.
  // Sin esto, cada intento fallido dejaba una campana huerfana y un conjunto
  // colgando en la cuenta de la duena (paso de verdad: 5 intentos, 5 basuras).
  const pasos = [];
  const creados = [];
  const pedir = async (paso, path, campos) => {
    pasos.push(paso);
    const r = await fbJson(`${FB_GRAPH}/${path}`, {
      method: 'POST',
      body: new URLSearchParams({ ...campos, access_token: tok.t }),
    });
    if (r && r.id) creados.unshift(r.id);   // al reves: se borra de adentro afuera
    return r;
  };
  const deshacer = async () => {
    for (const id of creados) {
      try {
        await fetch(`${FB_GRAPH}/${id}?access_token=${encodeURIComponent(tok.t)}`, { method: 'DELETE' });
      } catch { /* si no se puede borrar, queda pausado: nunca gasta */ }
    }
  };

  try {
    const pub = await publicoProbado(env, cuenta, tok);

    const camp = await pedir('campaña', `${cuenta.id}/campaigns`, {
      name: nombre,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: '[]',
      // Obligatorio desde 2026 cuando el presupuesto vive en el conjunto y no
      // en la campaña (code 100/4834011). En 'false' el presupuesto del
      // conjunto es suyo y no se reparte: con una sola campaña de prueba, que
      // Meta mueva dinero entre conjuntos solo enturbiaría la lectura.
      is_adset_budget_sharing_enabled: 'false',
    });

    const inicio = new Date(Date.now() + 10 * 60 * 1000);          // 10 min de aire
    const fin = new Date(inicio.getTime() + dias * 24 * 3600 * 1000);
    const conj = await pedir('conjunto', `${cuenta.id}/adsets`, {
      name: `${nombre} · conjunto`,
      campaign_id: camp.id,
      daily_budget: String(Math.round(presupuesto * 100)),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(pub.targeting),
      start_time: inicio.toISOString(),
      end_time: fin.toISOString(),
      status: 'PAUSED',
    });

    // DOS FORMAS de creativo, y la diferencia es la que decide si Meta lo acepta:
    //
    //  · object_story_id → se anuncia un post que YA EXISTE en la pagina. Es
    //    como estan hechos todos los anuncios que le han funcionado a la casa
    //    (object_type SHARE). Como el post no lo creo esta app, el candado de
    //    "app en modo desarrollo" no aplica.
    //  · link_data → se crea un post OCULTO nuevo con foto y textos. Es lo que
    //    querriamos (texto escrito a medida), pero Meta lo rechaza mientras la
    //    app no este publicada (code 100/1885183).
    if (b.object_story_id) {
      const creativoPost = await pedir('creativo', `${cuenta.id}/adcreatives`, {
        name: `${nombre} · creativo`,
        object_story_id: String(b.object_story_id),
      });
      const anuncioPost = await pedir('anuncio', `${cuenta.id}/ads`, {
        name: `${nombre} · anuncio`,
        adset_id: conj.id,
        creative: JSON.stringify({ creative_id: creativoPost.id }),
        status: 'PAUSED',
      });
      await bitacora(env, {
        quien: 'ia', accion: 'crear', campaign_id: camp.id, campaign_name: nombre,
        despues: `${presupuesto} MXN/día · ${dias} día(s) · PAUSADA`,
        motivo: `Creada por IA sobre un post existente. Público copiado de: ${pub.de || 'amplio México'}`,
        ok: true,
      });
      return json({
        ok: true, forma: 'post-existente',
        campaign_id: camp.id, adset_id: conj.id,
        creative_id: creativoPost.id, ad_id: anuncioPost.id,
        publico_de: pub.de, publico_costo: pub.costo,
        presupuesto_mxn: presupuesto, dias,
        inicio: inicio.toISOString(), fin: fin.toISOString(), estado: 'PAUSADA',
        enlace_admin: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cuenta.account_id}&selected_campaign_ids=${camp.id}`,
      });
    }

    const story = {
      page_id: pagina,
      link_data: {
        link: enlace,
        message: String(b.texto),
        name: String(b.titular || '').slice(0, 120) || undefined,
        description: String(b.descripcion || '').slice(0, 200) || undefined,
        picture: String(b.imagen_url),
        call_to_action: { type: String(b.cta || 'LEARN_MORE'), value: { link: enlace } },
      },
    };
    const creativo = await pedir('creativo', `${cuenta.id}/adcreatives`, {
      name: `${nombre} · creativo`,
      object_story_spec: JSON.stringify(story),
    });

    const anuncio = await pedir('anuncio', `${cuenta.id}/ads`, {
      name: `${nombre} · anuncio`,
      adset_id: conj.id,
      creative: JSON.stringify({ creative_id: creativo.id }),
      status: 'PAUSED',
    });

    await bitacora(env, {
      quien: 'ia', accion: 'crear', campaign_id: camp.id, campaign_name: nombre,
      despues: `${presupuesto} MXN/día · ${dias} día(s) · PAUSADA`,
      motivo: `Creada por IA. Público copiado de: ${pub.de || 'amplio México'}`,
      ok: true,
    });

    return json({
      ok: true,
      campaign_id: camp.id,
      adset_id: conj.id,
      creative_id: creativo.id,
      ad_id: anuncio.id,
      publico_de: pub.de,
      publico_costo: pub.costo,
      presupuesto_mxn: presupuesto,
      dias,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      estado: 'PAUSADA',
      enlace_admin: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cuenta.account_id}&selected_campaign_ids=${camp.id}`,
    });
  } catch (e) {
    const msg = (e && e.message) || 'Error';
    await deshacer();
    await bitacora(env, { quien: 'ia', accion: 'crear', campaign_name: nombre, ok: false, error: `${pasos.slice(-1)[0] || 'inicio'}: ${msg}` });
    return json({ error: msg, falló_en: pasos.slice(-1)[0] || 'preparación', pasos, deshecho: creados.length }, 400);
  }
}

// POST /ads/encender { campaign_id } — enciende campaña, conjunto y anuncio.
// Va aparte de crear a propósito: encender es lo que empieza a gastar.
export async function handleAdsEncender(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const cuenta = await kvJson(env, 'ads_cuenta');
  const tok = await kvJson(env, 'ads_token');
  if (!cuenta || !tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const id = String(b.campaign_id || '');
  if (!id) return json({ error: 'Falta campaign_id' }, 400);
  const prender = async (oid) => fbJson(`${FB_GRAPH}/${oid}`, {
    method: 'POST', body: new URLSearchParams({ status: 'ACTIVE', access_token: tok.t }),
  });
  try {
    const sets = await fbJson(`${FB_GRAPH}/${id}/adsets?` + new URLSearchParams({ fields: 'id', limit: '20', access_token: tok.t }));
    for (const s of (sets.data || [])) {
      const ads = await fbJson(`${FB_GRAPH}/${s.id}/ads?` + new URLSearchParams({ fields: 'id', limit: '20', access_token: tok.t }));
      for (const a of (ads.data || [])) await prender(a.id);
      await prender(s.id);
    }
    await prender(id);
    await bitacora(env, { quien: b.quien === 'persona' ? 'persona' : 'ia', accion: 'activar', campaign_id: id, antes: 'PAUSED', despues: 'ACTIVE', motivo: b.motivo || 'Encendida a mano', ok: true });
    return json({ ok: true, campaign_id: id, estado: 'ACTIVA' });
  } catch (e) {
    const msg = (e && e.message) || 'Error';
    await bitacora(env, { quien: 'persona', accion: 'activar', campaign_id: id, ok: false, error: msg });
    return json({ error: msg }, 502);
  }
}

// POST /ads/apagar { campaign_id } — pausa la campaña (los conjuntos y
// anuncios se quedan como estén: pausar arriba ya detiene la entrega).
export async function handleAdsApagar(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const tok = await kvJson(env, 'ads_token');
  if (!tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const id = String(b.campaign_id || '');
  if (!id) return json({ error: 'Falta campaign_id' }, 400);
  try {
    await fbJson(`${FB_GRAPH}/${id}`, { method: 'POST', body: new URLSearchParams({ status: 'PAUSED', access_token: tok.t }) });
    await bitacora(env, { quien: b.quien === 'ia' ? 'ia' : 'persona', accion: 'pausar', campaign_id: id, antes: 'ACTIVE', despues: 'PAUSED', motivo: b.motivo || 'Apagada desde la app', ok: true });
    return json({ ok: true, campaign_id: id, estado: 'PAUSADA' });
  } catch (e) {
    const msg = (e && e.message) || 'Error';
    await bitacora(env, { quien: 'persona', accion: 'pausar', campaign_id: id, ok: false, error: msg });
    return json({ error: msg }, 400);
  }
}

// POST /ads/borrar { campaign_id } — borra una campaña.
//
// ⚠️ Con candado: SOLO si nunca gastó. Borrar una campaña con gasto se lleva su
// historial de Meta, y ese historial es justo con lo que se decide. Las que ya
// gastaron se pausan, no se borran.
export async function handleAdsBorrar(request, env, session) {
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const tok = await kvJson(env, 'ads_token');
  if (!tok) return json({ error: 'Cuenta publicitaria no conectada' }, 409);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const id = String(b.campaign_id || '');
  if (!id) return json({ error: 'Falta campaign_id' }, 400);
  try {
    const ins = await fbJson(`${FB_GRAPH}/${id}/insights?` + new URLSearchParams({
      fields: 'spend', date_preset: 'maximum', access_token: tok.t,
    }));
    const gasto = Number(((ins.data || [])[0] || {}).spend) || 0;
    if (gasto > 0) {
      return json({ error: `Esta campaña ya gastó ${gasto}. No se borra: se pausa, para no perder su historial.` }, 409);
    }
    const nombre = (await fbJson(`${FB_GRAPH}/${id}?` + new URLSearchParams({ fields: 'name', access_token: tok.t }))).name;
    await fetch(`${FB_GRAPH}/${id}?access_token=${encodeURIComponent(tok.t)}`, { method: 'DELETE' });
    await bitacora(env, { quien: 'persona', accion: 'borrar', campaign_id: id, campaign_name: nombre, motivo: b.motivo || 'Borrada desde la app (nunca gastó)', ok: true });
    return json({ ok: true, campaign_id: id, borrada: true });
  } catch (e) {
    const msg = (e && e.message) || 'Error';
    await bitacora(env, { quien: 'persona', accion: 'borrar', campaign_id: id, ok: false, error: msg });
    return json({ error: msg }, 400);
  }
}
