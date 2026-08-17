// ============================================================================
// IVAE Marketing — TIKTOK (Login Kit + Content Posting API).
//
// Investigación 2026-08-17 (docs oficiales developers.tiktok.com):
//   · OAuth: tiktok.com/v2/auth/authorize (client_key, scopes por COMAS) →
//     code → open.tiktokapis.com/v2/oauth/token → access 24h + refresh 365d
//     CON ROTACIÓN (el refresh devuelto puede ser NUEVO: persistirlo siempre).
//   · Video: FILE_UPLOAD en un solo chunk (≤64MB) — así NO hace falta la
//     verificación de dominio. Carrusel de fotos: content/init SOLO acepta
//     PULL_FROM_URL → exige el dominio verificado (TXT en el DNS, checklist).
//   · creator_info/query es OBLIGATORIO antes de cada post: devuelve las
//     opciones de privacidad reales. App SIN auditar → todo sale SELF_ONLY.
//   · MODO AUTOMÁTICO: si la cuenta ofrece PUBLIC_TO_EVERYONE (app auditada)
//     → Direct Post público; si no → INBOX (borrador al buzón de TikTok, el
//     dueño lo publica con un tap; ventana de 24h). Se auto-mejora al pasar
//     la auditoría, sin tocar código.
//
// Env: TT_CLIENT_KEY, TT_CLIENT_SECRET. Sin ellos, aviso amable.
// ============================================================================

const TT_AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_API = 'https://open.tiktokapis.com/v2';
const TT_SCOPE = 'user.info.basic,video.publish,video.upload';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>TikTok · IVAE Marketing</title><style>body{font:15px/1.6 -apple-system,sans-serif;background:#0d0d14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{max-width:430px;background:#16161f;border:1px solid #2a2a38;border-radius:16px;padding:26px}h1{font-size:18px;margin:0 0 10px}p{color:#aaa}a{display:inline-flex;align-items:center;gap:10px;background:#1e1e2a;border:1px solid #33334a;border-radius:12px;color:#fff;padding:13px 14px;margin-top:10px;text-decoration:none}small{color:#888}</style><main>${body}</main>`,
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
const ttRedirectUri = (request) => new URL('/api/marketing/tt/callback', request.url).toString();
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

// GET /tt/login?client_id=… (staff) → OAuth de TikTok.
export async function handleTtLogin(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.TT_CLIENT_KEY || !env.TT_CLIENT_SECRET) {
    return json({ error: 'Falta configurar la app de TikTok (TT_CLIENT_KEY y TT_CLIENT_SECRET en Cloudflare Pages) — checklist paso 7.' }, 503);
  }
  const clientId = url.searchParams.get('client_id') || '';
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  await kvSet(env, `tt_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now() }));
  const p = new URLSearchParams({
    client_key: env.TT_CLIENT_KEY,
    scope: TT_SCOPE,
    response_type: 'code',
    redirect_uri: ttRedirectUri(request),
    state: nonce,
  });
  return Response.redirect(`${TT_AUTH}?${p}`, 302);
}

// GET /tt/callback — code → tokens (access 24h + refresh 365d) → guardar.
export async function handleTtCallback(request, env, url) {
  const back = '/marketing/app#/meses';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `tt_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar TikTok" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  try {
    const t = await (await fetch(`${TT_API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: env.TT_CLIENT_KEY, client_secret: env.TT_CLIENT_SECRET,
        code, grant_type: 'authorization_code', redirect_uri: ttRedirectUri(request),
      }),
    })).json();
    if (!t.access_token || !t.open_id) throw new Error(t.error_description || t.error || 'sin token');
    let username = '';
    try {
      const me = await (await fetch(`${TT_API}/user/info/?fields=open_id,display_name`, {
        headers: { Authorization: `Bearer ${t.access_token}` },
      })).json();
      username = (me.data && me.data.user && me.data.user.display_name) || '';
    } catch { /* opcional */ }
    await env.DB.prepare(
      `UPDATE mkt_clients SET tt_open_id = ?, tt_username = ?, tt_access_token = ?, tt_refresh_token = ?,
       tt_access_expires_at = datetime('now', '+' || ? || ' seconds'),
       tt_refresh_expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now') WHERE id = ?`
    ).bind(t.open_id, username, t.access_token, t.refresh_token || null,
      Number(t.expires_in) || 86400, Number(t.refresh_expires_in) || 31536000, st.c).run();
    return html(`<h1>✅ TikTok conectado</h1><p>La marca quedó ligada a <b>${esc(username || t.open_id)}</b>. Las piezas con "también en TikTok" se publicarán ahí (o llegarán a su buzón de TikTok para publicar con un tap, mientras la app pasa la auditoría).</p><a href="${back}">Volver a la app</a>`);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// Token vigente para la marca: refresca si caduca en <10 min y PERSISTE la
// rotación del refresh token (regla dura de TikTok).
export async function tokenTikTokVigente(env, clientId) {
  const c = await env.DB.prepare(
    'SELECT tt_open_id, tt_access_token, tt_refresh_token, tt_access_expires_at FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c || !c.tt_access_token) throw new Error('La marca no tiene TikTok conectado (ficha del cliente → Conectar TikTok).');
  const vence = c.tt_access_expires_at ? Date.parse(c.tt_access_expires_at.replace(' ', 'T') + 'Z') : 0;
  if (vence && vence - Date.now() > 10 * 60 * 1000) return c.tt_access_token;
  if (!c.tt_refresh_token) throw new Error('El token de TikTok caducó y no hay refresh — reconecta la marca desde su ficha.');
  const t = await (await fetch(`${TT_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TT_CLIENT_KEY, client_secret: env.TT_CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token: c.tt_refresh_token,
    }),
  })).json();
  if (!t.access_token) throw new Error('TikTok no renovó el token — reconecta la marca desde su ficha. (' + (t.error_description || t.error || '') + ')');
  await env.DB.prepare(
    `UPDATE mkt_clients SET tt_access_token = ?, tt_refresh_token = ?,
     tt_access_expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now') WHERE id = ?`
  ).bind(t.access_token, t.refresh_token || c.tt_refresh_token, Number(t.expires_in) || 86400, clientId).run();
  return t.access_token;
}

// GET /tt/creator?client_id=… (staff) → los datos REALES de la cuenta para
// pintar la pantalla de publicación como TikTok exige (nickname visible,
// opciones de privacidad reales, interacciones deshabilitadas, duración máx).
export async function handleTtCreator(env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const clientId = url.searchParams.get('client_id') || '';
  try {
    const tok = await tokenTikTokVigente(env, clientId);
    const ci = await ttJson(`${TT_API}/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: '{}',
    });
    const d = ci.data || {};
    const auditRow = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'tt_app_auditada'").first();
    return json({
      conectado: true,
      auditada: !!(auditRow && auditRow.value === '1'),
      nickname: d.creator_nickname || '',
      username: d.creator_username || '',
      avatar: d.creator_avatar_url || '',
      privacy_level_options: d.privacy_level_options || [],
      comment_disabled: !!d.comment_disabled,
      duet_disabled: !!d.duet_disabled,
      stitch_disabled: !!d.stitch_disabled,
      max_video_post_duration_sec: d.max_video_post_duration_sec || null,
    });
  } catch (e) {
    return json({ conectado: false, error: (e && e.message) || 'Error' });
  }
}

async function ttJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  const err = data.error && data.error.code && data.error.code !== 'ok' ? data.error : null;
  if (!res.ok || err) {
    let msg = (err && (err.message || err.code)) || `HTTP ${res.status}`;
    if (/url_ownership_unverified/.test(msg)) msg = 'TikTok exige verificar el dominio ivaestudios.com en su portal (TXT en el DNS) para carruseles — checklist paso 7.';
    if (/spam_risk_too_many_posts|too_many_pending_share/.test(msg)) msg = 'TikTok frenó por límite de publicaciones del día en esta cuenta — reintentar mañana. (' + msg + ')';
    throw new Error(msg);
  }
  return data;
}

// TikTok no respeta saltos de línea en el caption — se aplanan.
function captionTikTok(post, max = 2200) {
  const cap = String(post.caption || '').trim().replace(/\s*\n+\s*/g, ' · ');
  const tags = String(post.hashtags || '').trim();
  return (tags && !cap.includes(tags.split(/\s+/)[0]) ? `${cap} ${tags}` : cap).slice(0, max);
}

/**
 * Publica UNA pieza en el TikTok de su marca. Modo automático:
 * PUBLIC_TO_EVERYONE disponible → Direct Post público; si no → INBOX
 * (borrador al buzón). Video via FILE_UPLOAD (1 chunk); carrusel via
 * PULL_FROM_URL (exige dominio verificado). Devuelve { ttPostId, modo }.
 */
export async function publicarEnTikTok(env, { clientId, post, videoUrl, slides }) {
  const tok = await tokenTikTokVigente(env, clientId);
  const auth = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json; charset=UTF-8' };

  // 1) creator_info: SIEMPRE primero (regla de TikTok) — trae las privacidades reales.
  const ci = await ttJson(`${TT_API}/post/publish/creator_info/query/`, { method: 'POST', headers: auth, body: '{}' });
  const opciones = (ci.data && ci.data.privacy_level_options) || [];
  // TRAMPA REPORTADA (bundle.social): antes de la auditoría, creator_info a
  // veces LISTA PUBLIC_TO_EVERYONE y aun así el post cae SELF_ONLY en
  // silencio. El modo directo solo se enciende cuando la auditoría esté
  // APROBADA DE VERDAD: interruptor mkt_kv 'tt_app_auditada' = '1' (se
  // prende una sola vez, a mano, cuando TikTok apruebe). Mientras: INBOX —
  // el video llega al buzón de la marca y se publica con un tap, sin
  // obligar a nadie a poner su cuenta en privado.
  const auditRow = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'tt_app_auditada'").first();
  const publico = !!(auditRow && auditRow.value === '1') && opciones.includes('PUBLIC_TO_EVERYONE');

  // Lo que el humano eligió en la pantalla de la app (guidelines de TikTok:
  // la privacidad la elige el usuario y las interacciones nacen apagadas).
  let elec = {};
  try { elec = post.tt_options ? JSON.parse(post.tt_options) : {}; } catch { elec = {}; }
  // Sin elección explícita del humano NO hay Direct Post (regla de TikTok:
  // "no default value"): si falta, la pieza cae al buzón para que la persona
  // decida en la app de TikTok. Jamás inventamos una privacidad.
  const privacidad = opciones.includes(elec.privacy_level) ? elec.privacy_level : null;
  const directo = publico && !!privacidad;

  // CARRUSEL de fotos → content/init (solo PULL_FROM_URL).
  if (slides && slides.length >= 2) {
    const body = {
      media_type: 'PHOTO',
      post_mode: publico ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
      post_info: {
        title: String(post.title || '').slice(0, 90),
        description: captionTikTok(post, 4000),
        ...(directo ? { privacy_level: privacidad } : {}),
        ...(elec.allow_comment === false ? { disable_comment: true } : {}),
      },
      source_info: { source: 'PULL_FROM_URL', photo_images: slides.slice(0, 35), photo_cover_index: 0 },
    };
    const r = await ttJson(`${TT_API}/post/publish/content/init/`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
    return { ttPostId: r.data && r.data.publish_id, modo: directo ? 'directo' : 'buzon' };
  }

  // REEL/VIDEO → FILE_UPLOAD en 1 chunk (nuestros videos son ≤64MB).
  if (!videoUrl) throw new Error('La pieza no tiene video para TikTok.');
  const vid = await fetch(videoUrl);
  if (!vid.ok) throw new Error('No se pudo leer el video del almacén (' + vid.status + ').');
  const bytes = await vid.arrayBuffer();
  if (bytes.byteLength > 64 * 1024 * 1024) throw new Error('El video pasa de 64MB — comprimirlo para TikTok.');

  const init = directo
    ? await ttJson(`${TT_API}/post/publish/video/init/`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({
          post_info: {
            privacy_level: privacidad,
            title: captionTikTok(post),
            disable_comment: elec.allow_comment ? false : true,
            disable_duet: (ci.data && ci.data.duet_disabled) || !elec.allow_duet,
            disable_stitch: (ci.data && ci.data.stitch_disabled) || !elec.allow_stitch,
            ...(elec.brand_content ? { brand_content_toggle: true } : {}),
            ...(elec.brand_organic ? { brand_organic_toggle: true } : {}),
          },
          source_info: { source: 'FILE_UPLOAD', video_size: bytes.byteLength, chunk_size: bytes.byteLength, total_chunk_count: 1 },
        }),
      })
    : await ttJson(`${TT_API}/post/publish/inbox/video/init/`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({
          source_info: { source: 'FILE_UPLOAD', video_size: bytes.byteLength, chunk_size: bytes.byteLength, total_chunk_count: 1 },
        }),
      });
  const publishId = init.data && init.data.publish_id;
  const uploadUrl = init.data && init.data.upload_url;
  if (!publishId || !uploadUrl) throw new Error('TikTok no devolvió el destino de subida.');

  const up = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    },
    body: bytes,
  });
  if (!up.ok) throw new Error('TikTok no aceptó la subida del video (HTTP ' + up.status + ').');

  // Poll del estado hasta completar (o quedar en el buzón).
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await ttJson(`${TT_API}/post/publish/status/fetch/`, {
      method: 'POST', headers: auth, body: JSON.stringify({ publish_id: publishId }),
    });
    const s = st.data && st.data.status;
    if (s === 'PUBLISH_COMPLETE' || s === 'SEND_TO_USER_INBOX') break;
    if (s === 'FAILED') throw new Error('TikTok no pudo procesar el video: ' + ((st.data && st.data.fail_reason) || 'sin motivo'));
  }
  return { ttPostId: publishId, modo: directo ? 'directo' : 'buzon' };
}
