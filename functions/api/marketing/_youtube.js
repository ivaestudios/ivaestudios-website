// ============================================================================
// IVAE Marketing — YOUTUBE (OAuth de Google + YouTube Data API v3).
//
// Investigación 2026-09-13 (docs oficiales developers.google.com/youtube/v3):
//   · OAuth: accounts.google.com/o/oauth2/v2/auth con access_type=offline y
//     prompt=consent (SIN esos dos NO llega refresh_token y la conexión se
//     muere en una hora). El access dura 3600 s; el refresh no caduca solo,
//     PERO si la pantalla de consentimiento quedó en "Testing" Google lo mata
//     a los 7 DÍAS — por eso el estado de la app tiene que estar "En
//     producción" aunque siga sin verificar.
//   · Subir: videos.insert con uploadType=resumable (2 pasos: la metadata
//     devuelve un Location y ahí se hace PUT del MP4). Cuesta 1600 unidades
//     de cuota; la cuota gratis del proyecto son 10,000/día = ~6 videos al
//     día. Leer el canal cuesta 1.
//   · SHORTS: no hay bandera en la API. YouTube lo decide solo por la forma
//     del video (vertical y ≤3 min). Nuestros reels ya nacen 9:16, así que
//     salen como Short sin pedir nada.
//   · ⚠️ AUDITORÍA (el equivalente al audit de TikTok): mientras el proyecto
//     de Google no pase la revisión de cumplimiento de YouTube, TODO lo que
//     suba la API queda BLOQUEADO EN PRIVADO aunque pidamos público. Igual
//     que en TikTok, aquí no se miente: sin el interruptor mkt_kv
//     'yt_app_auditada' = '1' se pide PRIVADO a propósito y se le dice a la
//     persona que el video la espera en YouTube Studio para hacerlo público
//     con un clic. Al pasar la auditoría se prende el interruptor y el mismo
//     código empieza a publicar en público, sin tocar nada.
//   · selfDeclaredMadeForKids es OBLIGATORIO declararlo (COPPA). Lo elige una
//     persona en la app; jamás lo inventamos.
//
// Env: YT_CLIENT_ID, YT_CLIENT_SECRET. Sin ellos, aviso amable.
// ⚠️ A PROPÓSITO NO se reutiliza el GOOGLE_CLIENT_ID de la galería (el de
// "Entrar con Google" de las clientas): la pantalla de consentimiento es POR
// PROYECTO, así que meterle los permisos sensibles de YouTube arrastraría al
// login de las clientas al mismo trámite de verificación de Google (y a su
// tope de 100 usuarios). El canal de publicación vive en su propio proyecto.
// ============================================================================

const YT_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const YT_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_REVOKE = 'https://oauth2.googleapis.com/revoke';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';
// upload = subir el video; readonly = poder decir a qué canal se subirá.
const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
// Pedazo de subida: múltiplo de 256 KB (lo exige el protocolo resumable) y lo
// bastante chico para no acercarse a los 128 MB de memoria del Worker.
const YT_CHUNK = 8 * 1024 * 1024;
// Cloudflare corta una petición a los ~100 s: se trabaja 70 y lo que falte lo
// continúa el reloj en la siguiente vuelta.
const YT_PRESUPUESTO_MS = 70 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>YouTube · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a{display:inline-flex;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none}small{color:#888}</style><main>${body}</main>`,
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
const ytRedirectUri = (request) => new URL('/api/marketing/yt/callback', request.url).toString();
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

async function ytAuditada(env) {
  const row = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'yt_app_auditada'").first();
  return !!(row && row.value === '1');
}

// GET /yt/login?client_id=… (staff) → OAuth de Google para el canal de la marca.
export async function handleYtLogin(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.YT_CLIENT_ID || !env.YT_CLIENT_SECRET) {
    return json({ error: 'Falta configurar la app de YouTube (YT_CLIENT_ID y YT_CLIENT_SECRET en Cloudflare Pages).' }, 503);
  }
  const clientId = url.searchParams.get('client_id') || '';
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  await kvSet(env, `yt_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now() }));
  const p = new URLSearchParams({
    client_id: env.YT_CLIENT_ID,
    redirect_uri: ytRedirectUri(request),
    response_type: 'code',
    scope: YT_SCOPE,
    access_type: 'offline',       // sin esto NO hay refresh token
    prompt: 'consent',            // fuerza a que lo devuelva también al reconectar
    include_granted_scopes: 'true',
    state: nonce,
  });
  return Response.redirect(`${YT_AUTH}?${p}`, 302);
}

// GET /yt/callback — code → tokens → canal → guardar en la marca.
export async function handleYtCallback(request, env, url) {
  const back = '/marketing/app#/meses';
  const err = url.searchParams.get('error');
  if (err) return html(`<h1>No se autorizó</h1><p>Google devolvió: ${esc(err)}</p><a href="${back}">Volver a la app</a>`, 400);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `yt_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar YouTube" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  try {
    const t = await (await fetch(YT_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET,
        redirect_uri: ytRedirectUri(request), grant_type: 'authorization_code',
      }),
    })).json();
    if (!t.access_token) throw new Error(t.error_description || t.error || 'Google no devolvió el token');
    if (!t.refresh_token) {
      throw new Error('Google no devolvió el permiso permanente (refresh token). Entra a myaccount.google.com/permissions, quita "IVAE Marketing" y vuelve a conectar.');
    }
    // El canal: sin esto no sabemos a DÓNDE se va a publicar.
    let canalId = '';
    let canalTitulo = '';
    try {
      const ch = await (await fetch(`${YT_API}/channels?part=snippet&mine=true`, {
        headers: { Authorization: `Bearer ${t.access_token}` },
      })).json();
      const it = (ch.items || [])[0];
      if (it) { canalId = it.id || ''; canalTitulo = (it.snippet && it.snippet.title) || ''; }
    } catch { /* el canal es informativo */ }
    if (!canalId) {
      throw new Error('Esa cuenta de Google no tiene canal de YouTube. Crea el canal de la marca en youtube.com y vuelve a conectar.');
    }
    await env.DB.prepare(
      `UPDATE mkt_clients SET yt_channel_id = ?, yt_channel_title = ?, yt_access_token = ?, yt_refresh_token = ?,
       yt_access_expires_at = datetime('now', '+' || ? || ' seconds'), yt_connected_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`
    ).bind(canalId, canalTitulo, t.access_token, t.refresh_token, Number(t.expires_in) || 3600, st.c).run();
    const auditada = await ytAuditada(env);
    return html(`<h1>✅ YouTube conectado</h1><p>La marca quedó ligada al canal <b>${esc(canalTitulo || canalId)}</b>. Las piezas con "también en YouTube" se subirán ahí${auditada ? '' : ' <b>en privado</b>, listas para hacerlas públicas con un clic desde YouTube Studio (mientras el proyecto pasa la revisión de YouTube)'}.</p><a href="${back}">Volver a la app</a>`);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// Token vigente para la marca: refresca si caduca en <5 min. Google NO rota el
// refresh token en cada uso (a diferencia de TikTok), pero si algún día manda
// uno nuevo se persiste igual.
export async function tokenYouTubeVigente(env, clientId) {
  const c = await env.DB.prepare(
    'SELECT yt_access_token, yt_refresh_token, yt_access_expires_at FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c || !c.yt_access_token) throw new Error('La marca no tiene YouTube conectado (ficha del cliente → Conectar YouTube).');
  const vence = c.yt_access_expires_at ? Date.parse(c.yt_access_expires_at.replace(' ', 'T') + 'Z') : 0;
  if (vence && vence - Date.now() > 5 * 60 * 1000) return c.yt_access_token;
  if (!c.yt_refresh_token) throw new Error('El permiso de YouTube caducó y no hay refresh, reconecta la marca desde su ficha.');
  const t = await (await fetch(YT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET,
      refresh_token: c.yt_refresh_token, grant_type: 'refresh_token',
    }),
  })).json();
  if (!t.access_token) {
    const motivo = String(t.error || '');
    throw new Error(/invalid_grant/.test(motivo)
      ? 'Google revocó el permiso de YouTube de esta marca (pasa si la app quedó en modo "Testing": ahí el permiso muere a los 7 días). Reconéctala desde su ficha.'
      : 'Google no renovó el permiso de YouTube, reconecta la marca desde su ficha. (' + (t.error_description || motivo) + ')');
  }
  await env.DB.prepare(
    `UPDATE mkt_clients SET yt_access_token = ?, yt_refresh_token = ?,
     yt_access_expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now') WHERE id = ?`
  ).bind(t.access_token, t.refresh_token || c.yt_refresh_token, Number(t.expires_in) || 3600, clientId).run();
  return t.access_token;
}

// GET /yt/estado?client_id=… (staff) → lo que el editor necesita pintar:
// a qué canal se publica y si la app ya puede publicar en público.
export async function handleYtEstado(env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const clientId = url.searchParams.get('client_id') || '';
  const c = await env.DB.prepare(
    'SELECT yt_channel_id, yt_channel_title, yt_access_token FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  const auditada = await ytAuditada(env);
  if (!c || !c.yt_access_token) {
    return json({ conectado: false, auditada, configurada: !!(env.YT_CLIENT_ID && env.YT_CLIENT_SECRET) });
  }
  return json({
    conectado: true,
    auditada,
    configurada: true,
    canal: c.yt_channel_title || c.yt_channel_id,
    canal_id: c.yt_channel_id || '',
  });
}

// GET /yt/video?client_id=…&video_id=… (staff) — LEER DE VUELTA el video en el
// canal (videos.list, part=snippet,status,contentDetails; cuesta 1 unidad de
// cuota). Sirve para que el equipo confirme DESDE LA APP que la subida quedó
// en el canal correcto y con la privacidad correcta, sin tener que abrir
// YouTube Studio: la misma regla de la casa que con Meta, todo desde la app.
export async function handleYtVideo(env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const clientId = url.searchParams.get('client_id') || '';
  const videoId = String(url.searchParams.get('video_id') || '').trim();
  if (!/^[A-Za-z0-9_-]{5,24}$/.test(videoId)) return json({ error: 'Falta el id del video.' }, 400);
  const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!c) return json({ error: 'Cliente no encontrado' }, 404);
  let tok;
  try {
    tok = await tokenYouTubeVigente(env, clientId);
  } catch (e) {
    return json({ error: (e && e.message) || 'Esta marca no tiene YouTube conectado.' }, 422);
  }
  const r = await fetch(`${YT_API}/videos?part=snippet,status,contentDetails&id=${encodeURIComponent(videoId)}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: mensajeYouTube(d, r.status) }, 422);
  const v = (d.items || [])[0];
  if (!v) return json({ error: 'YouTube ya no encuentra ese video en el canal.' }, 404);
  const sn = v.snippet || {};
  const st = v.status || {};
  const th = sn.thumbnails || {};
  return json({
    id: v.id,
    titulo: sn.title || '',
    canal: sn.channelTitle || '',
    canal_id: sn.channelId || '',
    privacidad: st.privacyStatus || '',
    para_ninos: st.madeForKids === true,
    subido: sn.publishedAt || '',
    duracion: (v.contentDetails || {}).duration || '',
    miniatura: (th.medium || th.default || {}).url || '',
    url: 'https://youtu.be/' + v.id,
  });
}

// POST /yt/disconnect { client_id } (staff) — desconectar la marca de YouTube.
//
// ⚠️ NO basta con borrar los tokens de nuestra base: la politica de los
// Servicios de la API de YouTube (y la revision de cumplimiento de Google)
// exige que la persona pueda RETIRAR el permiso desde la propia app, no solo
// desde myaccount.google.com. Por eso primero se REVOCA en Google y despues se
// limpia aqui. Revocar el refresh token tumba tambien todos los access tokens
// que salieron de el.
//
// La revocacion se intenta, pero no manda: si Google contesta mal (el permiso
// ya lo habia quitado la persona a mano, o la red falla), igual se limpia la
// marca. Dejar el token guardado despues de que alguien pidio desconectar
// seria lo peor de los dos mundos.
export async function handleYtDisconnect(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const clientId = b.client_id || '';
  if (!clientId) return json({ error: 'Falta client_id' }, 400);

  const c = await env.DB.prepare(
    'SELECT yt_refresh_token, yt_access_token FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c) return json({ error: 'Cliente no encontrado' }, 404);

  let revocado = false;
  const token = c.yt_refresh_token || c.yt_access_token;
  if (token) {
    try {
      const r = await fetch(YT_REVOKE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
      revocado = r.ok;
    } catch { /* la limpieza local sigue pasando */ }
  }

  await env.DB.prepare(
    `UPDATE mkt_clients SET yt_channel_id = NULL, yt_channel_title = NULL, yt_access_token = NULL,
     yt_refresh_token = NULL, yt_access_expires_at = NULL, yt_connected_at = NULL,
     updated_at = datetime('now') WHERE id = ?`
  ).bind(clientId).run();

  return json({ ok: true, revocado });
}

// Traduce los errores de la API de YouTube al idioma de la oficina.
function mensajeYouTube(data, status) {
  const e = (data && data.error) || {};
  const razon = (e.errors && e.errors[0] && e.errors[0].reason) || '';
  const base = e.message || `HTTP ${status}`;
  if (razon === 'quotaExceeded' || /quota/i.test(base)) {
    return 'YouTube ya no acepta más subidas hoy: la cuota gratis del proyecto alcanza para ~6 videos al día y se reinicia a medianoche (hora del Pacífico).';
  }
  if (razon === 'youtubeSignupRequired') return 'Esa cuenta de Google no tiene canal de YouTube: créalo y reconecta la marca.';
  if (razon === 'uploadLimitExceeded') return 'El canal llegó a su límite de subidas del día (lo pone YouTube, no nosotros). Se reintenta mañana.';
  if (razon === 'forbidden' || status === 403) return 'YouTube rechazó la subida con este permiso, reconecta la marca desde su ficha (' + base + ').';
  if (status === 401) return 'El permiso de YouTube de la marca caducó, reconéctala desde su ficha.';
  if (/invalidVideoMetadata|invalidTitle|invalidDescription/i.test(razon)) return 'YouTube rechazó el título o la descripción (sin < ni >, título ≤100 caracteres).';
  return base;
}

// Título de YouTube: ≤100 caracteres y sin < ni > (regla dura de la API).
function tituloYouTube(post) {
  const t = String(post.title || '').replace(/[<>]/g, '').trim();
  return (t || 'Video').slice(0, 100);
}

// Descripción: el copy final + hashtags. Los reels 9:16 llevan #Shorts (no
// obliga a nada, pero ayuda a que YouTube lo trate como Short).
function descripcionYouTube(post) {
  const cap = String(post.caption || '').replace(/[<>]/g, '').trim();
  const tags = String(post.hashtags || '').replace(/[<>]/g, '').trim();
  const tipo = String(post.content_type || '').toLowerCase();
  const vertical = tipo === 'reel' || tipo === 'tiktok' || tipo === 'historia';
  const partes = [cap];
  if (tags && !cap.includes(tags.split(/\s+/)[0])) partes.push(tags);
  if (vertical && !/#shorts/i.test(cap + ' ' + tags)) partes.push('#Shorts');
  return partes.filter(Boolean).join('\n\n').slice(0, 4900);
}

// Etiquetas: de los hashtags de la pieza, sin #, máximo 500 caracteres juntos.
function etiquetasYouTube(post) {
  const crudas = String(post.hashtags || '').split(/[\s,]+/)
    .map((h) => h.replace(/^#+/, '').trim())
    .filter((h) => h.length > 1 && h.length <= 30);
  const out = [];
  let total = 0;
  for (const t of crudas) {
    if (total + t.length + 1 > 480) break;
    out.push(t); total += t.length + 1;
  }
  return out.slice(0, 15);
}

// Categorías de YouTube: la persona la elige por pieza; sin elección, People
// & Blogs (22), que es lo que se usaba fijo hasta hoy.
const YT_CATEGORIAS = ['1', '2', '10', '15', '17', '19', '20', '22', '23', '24', '25', '26', '27', '28'];
function categoriaYouTube(elec) {
  const c = String((elec && elec.category_id) || '').trim();
  return YT_CATEGORIAS.includes(c) ? c : '22';
}

// El peso del archivo SIN bajarlo: HEAD y, si el almacén no lo contesta, un
// Range de un byte (el Content-Range trae el total).
async function pesoDelVideo(url) {
  try {
    const h = await fetch(url, { method: 'HEAD' });
    const n = Number(h.headers.get('content-length') || 0);
    if (h.ok && n > 0) return n;
  } catch { /* seguimos con el Range */ }
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const cr = r.headers.get('content-range') || '';
    const m = cr.match(/\/(\d+)\s*$/);
    if (m) return Number(m[1]);
  } catch { /* nada */ }
  return 0;
}

// Dónde se quedó la subida de una pieza (para continuarla en otra corrida).
async function subidaGuardada(env, postId) {
  try {
    const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind('yt_up:' + postId).first();
    return row ? JSON.parse(row.value || '{}') : null;
  } catch { return null; }
}
async function guardarSubida(env, postId, data) {
  try { await kvSet(env, 'yt_up:' + postId, JSON.stringify(data)); } catch { /* noop */ }
}
async function olvidarSubida(env, postId) {
  try { await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind('yt_up:' + postId).run(); } catch { /* noop */ }
}

/**
 * Sube UNA pieza al canal de YouTube de su marca.
 * Devuelve { ytVideoId, modo } cuando terminó, o { pendiente: true, pct }
 * cuando el video es grande y se quedó a medias: el estado vive en mkt_kv y
 * el reloj continúa la subida en la siguiente vuelta.
 * modo 'publico' | 'oculto' | 'privado', leído del canal DESPUÉS de subir.
 */
export async function publicarEnYouTube(env, { clientId, post, videoUrl }) {
  if (!videoUrl) throw new Error('La pieza no tiene video para YouTube (YouTube solo acepta video).');
  const tok = await tokenYouTubeVigente(env, clientId);

  let elec = {};
  try { elec = post.yt_options ? JSON.parse(post.yt_options) : {}; } catch { elec = {}; }

  // La privacidad: la elige la persona en la app. Mientras el proyecto no pase
  // la revisión de YouTube, TODO sale privado (YouTube lo fuerza igual; aquí
  // se pide privado a propósito para que el estado en la app no mienta).
  const auditada = await ytAuditada(env);
  const pedida = ['public', 'unlisted', 'private'].includes(elec.privacy_status) ? elec.privacy_status : 'private';
  const privacidad = auditada ? pedida : 'private';

  // COPPA: la declaración "es contenido para niños" la hace UNA PERSONA, nunca
  // la app ni la IA. A YouTube se lo dijimos por escrito en la auditoría, así
  // que aquí se EXIGE: sin declarar, no se sube. Antes se asumía "no" en
  // silencio, que es justo lo que prometimos no hacer.
  if (elec.made_for_kids !== true && elec.made_for_kids !== false) {
    throw new Error('Falta declarar si el video es contenido para niños (lo exige YouTube). Ábrelo en Opciones de YouTube y elígelo.');
  }
  const paraNinos = elec.made_for_kids === true;

  // ── EL TAMAÑO DEL VIDEO (22-sep-2026) ─────────────────────────────────────
  // Antes se cargaba el archivo ENTERO en memoria del Worker (arrayBuffer) y
  // por eso había un tope de 64 MB. Para canales de YouTube de verdad, con
  // videos largos en alta, eso no sirve. Ahora se sube POR PEDAZOS: cada
  // trozo se pide al almacén con un Range y se manda con Content-Range, así
  // en memoria nunca hay más de un pedazo.
  //
  // Y como una petición de Cloudflare se corta a los ~100 s, la subida GUARDA
  // DÓNDE SE QUEDÓ (mkt_kv, clave yt_up:<post>) y el reloj la continúa en la
  // siguiente vuelta. Un video de varios GB entra en varias corridas sin que
  // nadie tenga que estar mirando.
  const total = await pesoDelVideo(videoUrl);
  if (!total) throw new Error('No se pudo leer el video del almacén (¿sigue ahí?).');

  const guardado = await subidaGuardada(env, post.id);
  let destino = guardado && guardado.uri ? guardado.uri : null;
  let subido = guardado && guardado.uri ? Number(guardado.offset || 0) : 0;

  if (!destino) {
    // Paso 1: la metadata. Devuelve el Location donde van los bytes.
    const meta = {
      snippet: {
        title: tituloYouTube(post),
        description: descripcionYouTube(post),
        tags: etiquetasYouTube(post),
        categoryId: categoriaYouTube(elec),
        defaultLanguage: 'es',
        defaultAudioLanguage: 'es',
      },
      status: {
        privacyStatus: privacidad,
        selfDeclaredMadeForKids: paraNinos,
        embeddable: true,
      },
    };
    const init = await fetch(`${YT_UPLOAD}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(total),
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(meta),
    });
    if (!init.ok) {
      const d = await init.json().catch(() => ({}));
      throw new Error(mensajeYouTube(d, init.status));
    }
    destino = init.headers.get('location') || init.headers.get('Location');
    if (!destino) throw new Error('YouTube no devolvió el destino de subida.');
    subido = 0;
    await guardarSubida(env, post.id, { uri: destino, offset: 0, total });
  }

  // Paso 2: los bytes, pedazo por pedazo, con un presupuesto de tiempo.
  const t0 = Date.now();
  let hecho = null;
  while (subido < total) {
    const fin = Math.min(subido + YT_CHUNK, total) - 1;
    const parte = await fetch(videoUrl, { headers: { Range: `bytes=${subido}-${fin}` } });
    if (!parte.ok && parte.status !== 206) throw new Error('El almacén cortó el video en ' + Math.round(subido / 1048576) + ' MB (' + parte.status + ').');
    const buf = await parte.arrayBuffer();
    if (!buf.byteLength) throw new Error('El almacén devolvió un pedazo vacío.');

    const put = await fetch(destino, {
      method: 'PUT',
      headers: {
        'Content-Length': String(buf.byteLength),
        'Content-Range': `bytes ${subido}-${subido + buf.byteLength - 1}/${total}`,
      },
      body: buf,
    });
    if (put.status === 308) {
      // "Resume Incomplete": YouTube dice hasta dónde tiene. Ese rango MANDA.
      const rango = put.headers.get('range') || put.headers.get('Range');
      const m = rango && rango.match(/bytes=0-(\d+)/);
      subido = m ? Number(m[1]) + 1 : subido + buf.byteLength;
      await guardarSubida(env, post.id, { uri: destino, offset: subido, total });
    } else if (put.ok) {
      hecho = await put.json().catch(() => ({}));
      break;
    } else if (put.status === 404 || put.status === 410) {
      // La sesión caducó (YouTube las guarda una semana): se empieza de nuevo.
      await olvidarSubida(env, post.id);
      throw new Error('La subida a YouTube caducó a medio camino, se vuelve a intentar desde cero.');
    } else {
      const d = await put.json().catch(() => ({}));
      throw new Error(mensajeYouTube(d, put.status));
    }
    // Presupuesto: dejar la petición viva. Lo que falte lo sigue el reloj.
    if (Date.now() - t0 > YT_PRESUPUESTO_MS && subido < total) {
      return { pendiente: true, pct: Math.round((subido / total) * 100) };
    }
  }
  if (!hecho) {
    // Se acabaron los bytes pero YouTube no cerró: preguntarle en la siguiente.
    return { pendiente: true, pct: 100 };
  }
  await olvidarSubida(env, post.id);
  const d = hecho;
  const ytVideoId = d.id || '';
  if (!ytVideoId) throw new Error('YouTube no confirmó el id del video.');

  // LA VERDAD, NO LO QUE PEDIMOS (22-sep-2026): YouTube aprobó el proyecto
  // pero avisó que el cambio tarda HASTA 72 HORAS en propagarse; mientras
  // tanto puede seguir forzando privado aunque pidamos público. Antes el
  // estado salía de lo que pedimos, así que la app habría dicho "publicado en
  // YouTube" con el video en privado. Se relee con videos.list (1 unidad de
  // cuota) y se reporta lo que el canal DE VERDAD tiene.
  let real = privacidad;
  try {
    const ver = await fetch(`${YT_API}/videos?part=status&id=${encodeURIComponent(ytVideoId)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (ver.ok) {
      const dv = await ver.json();
      const st = ((dv.items || [])[0] || {}).status || {};
      if (st.privacyStatus) real = st.privacyStatus;
    }
  } catch { /* si la relectura falla, nos quedamos con lo pedido */ }

  return { ytVideoId, modo: real === 'public' ? 'publico' : real === 'unlisted' ? 'oculto' : 'privado' };
}
