// ============================================================================
// IVAE Marketing — PINTEREST (API v5). 25-nov-2026, Vianey: "conecta pinterest".
//
// App "IVAE Marketing App" (id 1640131) en developers.pinterest.com. Nivel
// TRIAL aprobado el 25-nov-2026:
//   · Leer y crear tableros y pines, analíticas básicas, leer anuncios.
//   · ⚠️ En Trial los pines que se crean SOLO los ve la cuenta que los crea.
//     Para que salgan al público hay que pedir STANDARD (botón Upgrade) con un
//     video del flujo completo (conectar, elegir tablero, publicar un pin).
//   · Límite: 1000 llamadas al día.
//
// OAuth (docs v5): www.pinterest.com/oauth/ → code → POST /v5/oauth/token con
// Basic (app id : secret) → access (30 días) + refresh (1 año). Si Pinterest
// devuelve un refresh nuevo al renovar, se guarda siempre.
// Publicar: POST /v5/pins con media_source:
//   · image_url (post o foto), multiple_image_urls (carrusel, de 2 a 5 fotos),
//   · video_id (reel): POST /v5/media → subir a upload_url (multipart) →
//     GET /v5/media/{id} hasta 'succeeded' → POST /v5/pins. Si el video sigue
//     procesando, el reloj lo termina en la siguiente vuelta (mkt_kv pin_media:<pieza>).
//
// Env: PIN_APP_ID (1640131) y PIN_APP_SECRET en Cloudflare Pages (la llave la
// pega Vianey; nunca se imprime). Redirect registrado en la app de Pinterest:
//   https://ivaestudios.com/api/marketing/pin/callback
// ============================================================================

import { paginaConexion } from './_pagina-conexion.js';

const PIN_AUTH = 'https://www.pinterest.com/oauth/';
const PIN_API = 'https://api.pinterest.com/v5';
const PIN_SCOPE = 'user_accounts:read,boards:read,boards:write,pins:read,pins:write';
// Tipos de pieza que salen como VIDEO (mismo criterio que el PDF de contenido,
// más los testimonios, que también son video).
const TIPOS_VIDEO = ['reel', 'tiktok', 'historia', 'informativo', 'pauta', 'tratamientos', 'experiencia', 'video'];
// Un Worker tiene poca memoria: el video se baja entero para mandarlo a Pinterest.
const VIDEO_MAX_BYTES = 95 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return paginaConexion(body, status, { titulo: 'Pinterest · IVAE Marketing' });
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
async function kvTake(env, k) {
  const v = await kvGet(env, k);
  if (v != null) await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(k).run();
  return v;
}
async function kvDel(env, k) {
  try { await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(k).run(); } catch { /* noop */ }
}
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
const pinRedirectUri = (request) => new URL('/api/marketing/pin/callback', request.url).toString();
const back = '/marketing/app#/conexiones';
function faltaConfig(env) {
  return (!env.PIN_APP_ID || !env.PIN_APP_SECRET)
    ? 'Falta configurar la app de Pinterest (PIN_APP_ID y PIN_APP_SECRET en Cloudflare).'
    : null;
}
// La marca es de la misma agencia que quien la toca (las agencias no se mezclan).
async function marcaDeLaSesion(env, session, clientId) {
  const c = await env.DB.prepare('SELECT id, name, workspace_id FROM mkt_clients WHERE id = ?').bind(clientId || '').first();
  if (!c) return null;
  if (session && session.workspace_id && (c.workspace_id || 'ivae') !== session.workspace_id) return null;
  return c;
}

// ── Llamadas a la API ────────────────────────────────────────────────────────
function mensajePinterest(data, status) {
  const base = (data && (data.message || data.error_description || data.error)) || `HTTP ${status}`;
  if (status === 401) return 'El permiso de Pinterest de la marca caducó o se quitó: vuelve a conectarla en Conexiones.';
  if (status === 403) return `Pinterest no dejó hacer esto con este permiso (${base}).`;
  if (status === 429) return 'Pinterest: se llegó al límite de llamadas por ahora (en Trial son 1000 al día). Se reintenta más tarde.';
  return `Pinterest: ${base}`;
}
async function pinJson(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(mensajePinterest(data, res.status));
  return data;
}
async function pinToken(env, params) {
  const res = await fetch(`${PIN_API}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.PIN_APP_ID}:${env.PIN_APP_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new Error(mensajePinterest(t, res.status));
  return t;
}
async function listarTableros(token) {
  const tableros = [];
  let bookmark = null;
  for (let i = 0; i < 3; i++) {
    const qs = new URLSearchParams({ page_size: '100', ...(bookmark ? { bookmark } : {}) });
    const r = await pinJson(`${PIN_API}/boards?${qs}`, token);
    for (const b of (r.items || [])) if (b && b.id) tableros.push({ id: String(b.id), name: b.name || '' });
    bookmark = r.bookmark;
    if (!bookmark) break;
  }
  return tableros;
}
async function guardarTablero(env, clientId, tablero) {
  await env.DB.prepare(
    "UPDATE mkt_clients SET pin_board_id = ?, pin_board_name = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(tablero.id, tablero.name || '', clientId).run();
}

// ── Conectar ─────────────────────────────────────────────────────────────────
// GET /pin/login?client_id=… → OAuth de Pinterest. El cliente conecta su propia marca.
export async function handlePinLogin(request, env, session, url) {
  if (session.role === 'client' && !session.client_id) return json({ error: 'Forbidden' }, 403);
  const falta = faltaConfig(env);
  if (falta) return json({ error: falta }, 503);
  const clientId = session.role === 'client' ? (session.client_id || '') : (url.searchParams.get('client_id') || '');
  const marca = await marcaDeLaSesion(env, session, clientId);
  if (!marca) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  await kvSet(env, `pin_state_${nonce}`, JSON.stringify({ c: marca.id, t: Date.now(), l: lang }));
  const p = new URLSearchParams({
    client_id: env.PIN_APP_ID,
    redirect_uri: pinRedirectUri(request),
    response_type: 'code',
    scope: PIN_SCOPE,
    state: nonce,
  });
  return Response.redirect(`${PIN_AUTH}?${p}`, 302);
}

// GET /pin/callback — code → permiso → cuenta → tablero. También el 2º paso
// (?pick=…&board=…) cuando la cuenta tiene varios tableros.
export async function handlePinCallback(request, env, url) {
  if (url.searchParams.get('pick')) return elegirDelPicker(env, url);
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `pin_state_${state}`);
  let st = null;
  try { st = raw ? JSON.parse(raw) : null; } catch { st = null; }
  const EN = !!(st && st.l === 'en');
  if (url.searchParams.get('error')) {
    return html(EN
      ? `<h1>Pinterest was not connected</h1><p>Access was not granted. You can try again from the app.</p><a href="${back}">Back to the app</a>`
      : `<h1>No se conectó Pinterest</h1><p>No se dio el permiso. Puedes intentarlo otra vez desde la app.</p><a href="${back}">Volver a la app</a>`, 400);
  }
  const code = url.searchParams.get('code');
  if (!code || !st) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar Pinterest" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  if (Date.now() - st.t > 10 * 60 * 1000) return html(EN ? `<h1>The attempt expired</h1><a href="${back}">Back</a>` : `<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  try {
    const t = await pinToken(env, { grant_type: 'authorization_code', code, redirect_uri: pinRedirectUri(request) });
    const yo = await pinJson(`${PIN_API}/user_account`, t.access_token);
    const usuario = yo.username || '';
    await env.DB.prepare(
      `UPDATE mkt_clients SET pin_user_id = ?, pin_username = ?, pin_access_token = ?, pin_refresh_token = ?,
       pin_access_expires_at = datetime('now', '+' || ? || ' seconds'),
       pin_refresh_expires_at = datetime('now', '+' || ? || ' seconds'),
       pin_board_id = NULL, pin_board_name = NULL, pin_connected_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).bind(String(yo.id || usuario || ''), usuario, t.access_token, t.refresh_token || null,
      Number(t.expires_in) || 2592000, Number(t.refresh_token_expires_in) || 31536000, st.c).run();
    const quien = esc(usuario ? '@' + usuario : 'la cuenta');
    const tableros = await listarTableros(t.access_token);
    if (tableros.length === 1) {
      await guardarTablero(env, st.c, tableros[0]);
      return html(EN
        ? `<h1>✅ Pinterest connected</h1><p>The brand is linked to <b>${quien}</b>. Pins will go to the board <b>${esc(tableros[0].name)}</b>.</p><a href="${back}">Back to the app</a>`
        : `<h1>✅ Pinterest conectado</h1><p>La marca quedó ligada a <b>${quien}</b>. Los pines irán al tablero <b>${esc(tableros[0].name)}</b>.</p><a href="${back}">Volver a la app</a>`);
    }
    if (!tableros.length) {
      return html(EN
        ? `<h1>✅ Pinterest connected</h1><p>The brand is linked to <b>${quien}</b>, but the account has no boards yet. Create one in Pinterest and pick it in the app (Connections → Pinterest → Board).</p><a href="${back}">Back to the app</a>`
        : `<h1>✅ Pinterest conectado</h1><p>La marca quedó ligada a <b>${quien}</b>, pero la cuenta todavía no tiene tableros. Crea uno en Pinterest y elígelo en la app (Conexiones → Pinterest → Tablero).</p><a href="${back}">Volver a la app</a>`);
    }
    const pickId = rnd();
    await kvSet(env, `pin_pick_${pickId}`, JSON.stringify({ c: st.c, t: Date.now(), l: st.l, b: tableros }));
    const botones = tableros.map((b) =>
      `<a href="/api/marketing/pin/callback?pick=${pickId}&board=${encodeURIComponent(b.id)}">📌 ${esc(b.name)}</a>`
    ).join('');
    return html(EN
      ? `<h1>Which board should the pins go to?</h1><p>Connected as <b>${quien}</b>. Pick the brand's board:</p>${botones}<small>This link expires in 10 minutes. You can change it later in Connections.</small>`
      : `<h1>¿En qué tablero se publican los pines?</h1><p>Conectado como <b>${quien}</b>. Elige el tablero de la marca:</p>${botones}<small>Este enlace caduca en 10 minutos. Lo puedes cambiar después en Conexiones.</small>`);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

async function elegirDelPicker(env, url) {
  const raw = await kvTake(env, `pin_pick_${url.searchParams.get('pick') || ''}`);
  if (!raw) return html(`<h1>Link caducado</h1><p>Elige el tablero en la app: Conexiones → Pinterest → Tablero.</p><a href="${back}">Volver</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  const EN = st.l === 'en';
  if (Date.now() - st.t > 10 * 60 * 1000) return html(EN ? `<h1>The attempt expired</h1><a href="${back}">Back</a>` : `<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  const tablero = (st.b || []).find((b) => b.id === (url.searchParams.get('board') || ''));
  if (!tablero) return html(EN ? '<h1>Board not found</h1>' : '<h1>Tablero no encontrado</h1>', 400);
  await guardarTablero(env, st.c, tablero);
  return html(EN
    ? `<h1>✅ Pinterest connected</h1><p>Pins will go to the board <b>${esc(tablero.name)}</b>.</p><a href="${back}">Back to the app</a>`
    : `<h1>✅ Pinterest conectado</h1><p>Los pines irán al tablero <b>${esc(tablero.name)}</b>.</p><a href="${back}">Volver a la app</a>`);
}

// Permiso vigente de la marca: se renueva si vence en menos de 1 día.
export async function tokenPinterestVigente(env, clientId) {
  const c = await env.DB.prepare(
    'SELECT pin_access_token, pin_refresh_token, pin_access_expires_at FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c || !c.pin_access_token) throw new Error('La marca no tiene Pinterest conectado (Conexiones → Pinterest → Conectar).');
  const vence = c.pin_access_expires_at ? Date.parse(String(c.pin_access_expires_at).replace(' ', 'T') + 'Z') : 0;
  if (vence && vence - Date.now() > 24 * 3600 * 1000) return c.pin_access_token;
  if (!c.pin_refresh_token) throw new Error('El permiso de Pinterest caducó: vuelve a conectar la marca en Conexiones.');
  const t = await pinToken(env, { grant_type: 'refresh_token', refresh_token: c.pin_refresh_token });
  await env.DB.prepare(
    `UPDATE mkt_clients SET pin_access_token = ?, pin_refresh_token = ?,
     pin_access_expires_at = datetime('now', '+' || ? || ' seconds'),
     pin_refresh_expires_at = CASE WHEN ? IS NOT NULL THEN datetime('now', '+' || ? || ' seconds') ELSE pin_refresh_expires_at END,
     updated_at = datetime('now') WHERE id = ?`
  ).bind(t.access_token, t.refresh_token || c.pin_refresh_token, Number(t.expires_in) || 2592000,
    t.refresh_token ? 1 : null, Number(t.refresh_token_expires_in) || 31536000, clientId).run();
  return t.access_token;
}

// GET /pin/boards?client_id=… → la cuenta, el tablero elegido y los tableros.
export async function handlePinBoards(env, session, url) {
  const clientId = session.role === 'client' ? (session.client_id || '') : (url.searchParams.get('client_id') || '');
  const marca = await marcaDeLaSesion(env, session, clientId);
  if (!marca) return json({ error: 'Cliente no encontrado' }, 404);
  const c = await env.DB.prepare('SELECT pin_username, pin_board_id, pin_board_name FROM mkt_clients WHERE id = ?').bind(marca.id).first();
  if (!c || !c.pin_username) return json({ conectado: false });
  try {
    const tok = await tokenPinterestVigente(env, marca.id);
    const tableros = await listarTableros(tok);
    return json({ conectado: true, username: c.pin_username, board_id: c.pin_board_id, board_name: c.pin_board_name, boards: tableros });
  } catch (e) {
    return json({ conectado: true, username: c.pin_username, board_id: c.pin_board_id, board_name: c.pin_board_name, boards: [], error: (e && e.message) || 'Error' });
  }
}

// POST /pin/board {client_id, board_id} → el tablero donde se publica.
export async function handlePinSetBoard(request, env, session) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const clientId = session.role === 'client' ? (session.client_id || '') : String((b && b.client_id) || '');
  const marca = await marcaDeLaSesion(env, session, clientId);
  if (!marca) return json({ error: 'Cliente no encontrado' }, 404);
  try {
    const tok = await tokenPinterestVigente(env, marca.id);
    const tablero = (await listarTableros(tok)).find((x) => x.id === String((b && b.board_id) || ''));
    if (!tablero) return json({ error: 'Ese tablero no es de la cuenta conectada.' }, 400);
    await guardarTablero(env, marca.id, tablero);
    return json({ ok: true, board_id: tablero.id, board_name: tablero.name });
  } catch (e) {
    return json({ error: (e && e.message) || 'Error' }, 422);
  }
}

// POST /pin/disconnect {client_id} (equipo) → se borra el permiso de la marca.
export async function handlePinDisconnect(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const marca = await marcaDeLaSesion(env, session, String((b && b.client_id) || ''));
  if (!marca) return json({ error: 'Cliente no encontrado' }, 404);
  await env.DB.prepare(
    `UPDATE mkt_clients SET pin_user_id = NULL, pin_username = NULL, pin_access_token = NULL, pin_refresh_token = NULL,
     pin_access_expires_at = NULL, pin_refresh_expires_at = NULL, pin_board_id = NULL, pin_board_name = NULL,
     pin_connected_at = NULL, updated_at = datetime('now') WHERE id = ?`
  ).bind(marca.id).run();
  return json({ ok: true });
}

// ── Publicar ─────────────────────────────────────────────────────────────────
function tituloPin(post) {
  const t = String(post.title || '').replace(/^\s*(reel|carrusel|post|foto|historia|pauta|video)\s*\d*\s*[·:\-–]\s*/i, '').trim();
  return (t || 'Pin').slice(0, 100);
}
function descripcionPin(post) {
  const cap = String(post.caption || '').trim();
  const tags = String(post.hashtags || '').trim();
  return [cap, tags].filter(Boolean).join('\n\n').slice(0, 800);
}

/**
 * Publica la pieza en el tablero de la marca. Devuelve { pinId } o, si el
 * video sigue procesando en Pinterest, { pendiente: true } (el reloj lo termina).
 */
export async function publicarEnPinterest(env, { clientId, post, videoUrl, slides, cover }) {
  const tok = await tokenPinterestVigente(env, clientId);
  const c = await env.DB.prepare('SELECT pin_board_id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!c || !c.pin_board_id) throw new Error('Falta elegir el tablero de Pinterest de la marca (Conexiones → Pinterest → Tablero).');
  const base = { board_id: c.pin_board_id, title: tituloPin(post), description: descripcionPin(post) };
  const alt = String(post.alt_text || '').trim();
  if (alt) base.alt_text = alt.slice(0, 500);
  const fotos = (slides || []).filter(Boolean);
  const esVideo = TIPOS_VIDEO.includes(post.content_type || 'reel') && !!videoUrl;

  if (esVideo) return publicarVideo(env, tok, post, videoUrl, cover, base);

  let media_source;
  if ((post.content_type || '') === 'carrusel' && fotos.length >= 2) {
    media_source = { source_type: 'multiple_image_urls', items: fotos.slice(0, 5).map((url) => ({ url })) };
  } else {
    const una = fotos[0] || cover || null;
    if (!una) throw new Error('La pieza no tiene foto ni video para Pinterest.');
    media_source = { source_type: 'image_url', url: una };
  }
  const pin = await pinJson(`${PIN_API}/pins`, tok, { method: 'POST', body: JSON.stringify({ ...base, media_source }) });
  if (!pin || !pin.id) throw new Error('Pinterest no confirmó el pin.');
  return { pinId: String(pin.id) };
}

async function publicarVideo(env, tok, post, videoUrl, cover, base) {
  const clave = 'pin_media:' + post.id;
  let estado = null;
  try { const v = await kvGet(env, clave); estado = v ? JSON.parse(v) : null; } catch { estado = null; }
  if (!estado || !estado.media_id) {
    // 1) Pinterest da un lugar para subir el video.
    const reg = await pinJson(`${PIN_API}/media`, tok, { method: 'POST', body: JSON.stringify({ media_type: 'video' }) });
    if (!reg.media_id || !reg.upload_url) throw new Error('Pinterest no dio dónde subir el video.');
    // 2) El video se baja del almacén y se sube ahí (formulario multipart).
    const vid = await fetch(videoUrl);
    if (!vid.ok) throw new Error('No se pudo leer el video del almacén (' + vid.status + ').');
    const peso = Number(vid.headers.get('content-length') || 0);
    if (peso > VIDEO_MAX_BYTES) throw new Error('El video pesa más de 95 MB: Pinterest desde la app acepta hasta 95 MB por ahora.');
    const blob = await vid.blob();
    if (blob.size > VIDEO_MAX_BYTES) throw new Error('El video pesa más de 95 MB: Pinterest desde la app acepta hasta 95 MB por ahora.');
    const form = new FormData();
    for (const [k, v] of Object.entries(reg.upload_parameters || {})) form.append(k, v);
    form.append('file', blob, 'video.mp4');
    const up = await fetch(reg.upload_url, { method: 'POST', body: form });
    if (!up.ok && up.status !== 204) throw new Error('Pinterest no recibió el video (' + up.status + ').');
    estado = { media_id: String(reg.media_id), t: Date.now() };
    await kvSet(env, clave, JSON.stringify(estado));
  }
  // 3) Esperar a que Pinterest lo procese (un rato aquí; si no, la siguiente vuelta del reloj).
  let m = null;
  for (let i = 0; i < 6; i++) {
    m = await pinJson(`${PIN_API}/media/${encodeURIComponent(estado.media_id)}`, tok);
    if (m.status === 'succeeded' || m.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  if (m && m.status === 'failed') {
    await kvDel(env, clave);
    throw new Error('Pinterest no pudo procesar el video (formato o duración).');
  }
  if (!m || m.status !== 'succeeded') return { pendiente: true };
  // 4) El pin con el video (y la portada, si la pieza tiene).
  const media_source = { source_type: 'video_id', media_id: estado.media_id, ...(cover ? { cover_image_url: cover } : { cover_image_key_frame_time: 1 }) };
  const pin = await pinJson(`${PIN_API}/pins`, tok, { method: 'POST', body: JSON.stringify({ ...base, media_source }) });
  await kvDel(env, clave);
  if (!pin || !pin.id) throw new Error('Pinterest no confirmó el pin.');
  return { pinId: String(pin.id) };
}
