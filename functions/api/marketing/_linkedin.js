// ============================================================================
// IVAE Marketing — LINKEDIN (OAuth 2.0 + Posts API versionada).
//
// Investigación 2026-10-09 (learn.microsoft.com/linkedin):
//   · Dos niveles de acceso. PERFIL de la persona: productos "Sign In with
//     LinkedIn using OpenID Connect" + "Share on LinkedIn" (autoservicio, sin
//     revisión) → scope w_member_social. PÁGINA de empresa: producto
//     "Community Management API" (se solicita y LinkedIn lo revisa) → scopes
//     w_organization_social / r_organization_social / rw_organization_admin.
//     Pedir un scope que la app no tiene aprobado tumba el login con
//     unauthorized_scope_error, por eso los de página sólo se piden cuando el
//     interruptor mkt_kv 'li_org_aprobado' = '1' está prendido.
//   · El access token dura 60 DÍAS y LinkedIn sólo da refresh token (365 d) a
//     socios aprobados del Marketing Developer Platform. Sin refresh, a los 60
//     días la marca tiene que RECONECTAR; la app lo avisa antes.
//   · API versionada: cabeceras `LinkedIn-Version: YYYYMM` (cada versión vive
//     ~1 año) y `X-Restli-Protocol-Version: 2.0.0`. POST /rest/posts → 201 y el
//     id del post viene en la cabecera x-restli-id.
//   · Texto en formato "little": los caracteres \ | { } @ [ ] ( ) < > # * _ ~
//     se escapan con barra invertida; los hashtags van como {hashtag|\#|tag}.
//   · Video: Videos API (initializeUpload → PUT de partes de 4 MB con ETag →
//     finalizeUpload → esperar status AVAILABLE). MP4, 3 s a 30 min, 75 KB a
//     500 MB. Imagen: Images API (initializeUpload → PUT). Varias fotos:
//     content.multiImage (no hay carrusel orgánico en LinkedIn).
//   · La API NO programa: publica al momento. El reloj de la app es el que
//     manda a la hora, igual que con Instagram, Facebook, TikTok y YouTube.
//
// Env: LI_CLIENT_ID, LI_CLIENT_SECRET. Sin ellos, aviso amable (503).
// ============================================================================

const LI_AUTH = 'https://www.linkedin.com/oauth/v2/authorization';
const LI_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
const LI_API = 'https://api.linkedin.com';
// Versión de la API de marketing. Cada versión vive ~12 meses: subirla aquí
// (y probar) antes de que LinkedIn la retire.
const LI_VERSION = '202609';
const SCOPE_PERFIL = 'openid profile w_member_social';
const SCOPE_PAGINA = 'w_organization_social r_organization_social rw_organization_admin';
// Lo que cabe en la memoria del Worker con holgura (igual que TikTok).
const LI_MAX_VIDEO = 64 * 1024 * 1024;
const LI_MAX_COMMENTARY = 3000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function html(body, status = 200) {
  const page = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IVAE Marketing · LinkedIn</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0f0f14;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}main{max-width:460px;background:#1a1a22;border:1px solid #2a2a35;border-radius:14px;padding:22px 24px}h1{font-size:20px;margin:0 0 10px}p{line-height:1.5;color:#cfcfd8}a{color:#f5a8d3}ul{padding-left:18px}li{margin:6px 0}</style></head><body><main>${body}</main></body></html>`;
  return new Response(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function rnd() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
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
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

async function liOrgAprobado(env) {
  return (await kvGet(env, 'li_org_aprobado')) === '1';
}
function liRedirectUri(request) {
  const u = new URL(request.url);
  return `${u.origin}/api/marketing/li/callback`;
}
function cabeceras(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Traduce los errores de LinkedIn al idioma de la oficina.
async function liJson(url, init, contexto = '') {
  const res = await fetch(url, init);
  const txt = await res.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt.slice(0, 200) }; }
  if (!res.ok) {
    const base = data.message || data.error_description || data.error || data.raw || `HTTP ${res.status}`;
    let msg;
    if (res.status === 401) msg = 'LinkedIn ya no acepta el permiso de esta marca (LinkedIn lo da por 60 días). Reconéctala desde Conexiones.';
    else if (res.status === 403) msg = 'LinkedIn no dejó publicar: la persona que conectó debe ser administradora de la página, y para publicar como PÁGINA la app necesita el permiso de LinkedIn aprobado (Community Management API). Detalle: ' + base;
    else if (res.status === 429) msg = 'LinkedIn frenó por límite de llamadas (150 por persona al día). Reintentar más tarde.';
    else msg = `LinkedIn respondió ${res.status}${contexto ? ' en ' + contexto : ''}: ${base}`;
    const e = new Error(msg); e.status = res.status; e.data = data; throw e;
  }
  return { data, headers: res.headers };
}

// Formato "little" de LinkedIn: todo carácter reservado se escapa, aunque no
// se use como elemento. Sin esto un "(link en bio)" o un "#1" tumban el post.
function escaparLittle(txt) {
  return String(txt || '').replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => '\\' + c);
}
function hashtagsLittle(tags) {
  const toks = String(tags || '').split(/\s+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean);
  // Dentro de la plantilla el valor va tal cual (letras, dígitos y guion bajo).
  return toks.map((t) => `{hashtag|\\#|${t.replace(/[^\p{L}\p{N}_]/gu, '')}}`).filter((t) => t !== '{hashtag|\\#|}').join(' ');
}
function comentario(post) {
  const cap = String(post.caption || '').trim();
  const tags = hashtagsLittle(post.hashtags);
  let out = escaparLittle(cap);
  if (tags && !cap.includes(String(post.hashtags || '').trim().split(/\s+/)[0] || '\u0000')) out = out ? `${out}\n\n${tags}` : tags;
  // Si el caption YA trae los hashtags escritos, quedaron escapados como texto
  // plano (\#tag): se vuelven a convertir en hashtags reales.
  out = out.replace(/\\#([\p{L}\p{N}_]+)/gu, '{hashtag|\\#|$1}');
  return out.slice(0, LI_MAX_COMMENTARY);
}

// GET /li/login?client_id=… (staff) → OAuth de LinkedIn para la marca.
export async function handleLiLogin(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.LI_CLIENT_ID || !env.LI_CLIENT_SECRET) {
    return json({ error: 'Falta configurar la app de LinkedIn (LI_CLIENT_ID y LI_CLIENT_SECRET en Cloudflare Pages).' }, 503);
  }
  const clientId = url.searchParams.get('client_id') || '';
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  await kvSet(env, `li_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now(), en: url.searchParams.get('lang') === 'en' }));
  const conPagina = await liOrgAprobado(env);
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: env.LI_CLIENT_ID,
    redirect_uri: liRedirectUri(request),
    state: nonce,
    scope: conPagina ? `${SCOPE_PERFIL} ${SCOPE_PAGINA}` : SCOPE_PERFIL,
  });
  return Response.redirect(`${LI_AUTH}?${p}`, 302);
}

// Las páginas que la persona administra (sólo con el permiso de páginas).
async function paginasAdministradas(token) {
  const { data } = await liJson(
    `${LI_API}/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50`,
    { headers: cabeceras(token) }, 'organizationAcls',
  );
  const urns = [];
  for (const e of (data.elements || [])) {
    const u = e.organizationTarget || e.organization;
    if (u && !urns.includes(u)) urns.push(u);
  }
  const out = [];
  for (const u of urns) {
    const id = String(u).split(':').pop();
    let nombre = u;
    try {
      const { data: org } = await liJson(`${LI_API}/rest/organizations/${encodeURIComponent(id)}`, { headers: cabeceras(token) }, 'organizations');
      nombre = org.localizedName || org.vanityName || u;
    } catch { /* el nombre es informativo */ }
    out.push({ urn: u, nombre });
  }
  return out;
}

async function guardarPagina(env, clientId, pag) {
  await env.DB.prepare(
    "UPDATE mkt_clients SET li_org_urn = ?, li_org_name = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(pag.urn, pag.nombre, clientId).run();
}

function paginaListo(back, nombre, pagina, sinRefresh, en) {
  const t = en
    ? {
      h: '✅ LinkedIn connected',
      p: `The brand is now linked to <b>${esc(nombre)}</b>${pagina ? ` and to the Page <b>${esc(pagina)}</b>` : ''}. Pieces with "also on LinkedIn" will be posted there.`,
      r: sinRefresh ? '<p>LinkedIn grants this access for <b>60 days</b>. The app will warn you before it expires so you can reconnect in one tap.</p>' : '',
      a: 'Back to the app',
    }
    : {
      h: '✅ LinkedIn conectado',
      p: `La marca quedó ligada a <b>${esc(nombre)}</b>${pagina ? ` y a la página <b>${esc(pagina)}</b>` : ''}. Las piezas con "también en LinkedIn" se publicarán ahí.`,
      r: sinRefresh ? '<p>LinkedIn da este permiso por <b>60 días</b>. La app te avisa antes de que venza para reconectar con un toque.</p>' : '',
      a: 'Volver a la app',
    };
  return html(`<h1>${t.h}</h1><p>${t.p}</p>${t.r}<a href="${back}">${t.a}</a>`);
}

// GET /li/callback — code → token → persona (+ páginas) → guardar en la marca.
// También atiende ?pick=<nonce>&org=<id> cuando la persona administra varias páginas.
export async function handleLiCallback(request, env, url) {
  const back = '/marketing/app#/conexiones';
  const pick = url.searchParams.get('pick');
  if (pick) {
    const raw = await kvGet(env, `li_pick_${pick}`);
    if (!raw) return html(`<h1>Link caducado</h1><p>Vuelve a Conexiones y conecta LinkedIn de nuevo.</p><a href="${back}">Volver</a>`, 400);
    let st; try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
    const org = url.searchParams.get('org') || '';
    const pag = (st.paginas || []).find((p) => String(p.urn).endsWith(':' + org));
    if (!pag) return html(`<h1>Página no válida</h1><a href="${back}">Volver</a>`, 400);
    await guardarPagina(env, st.c, pag);
    await env.DB.prepare('DELETE FROM mkt_kv WHERE key = ?').bind(`li_pick_${pick}`).run();
    return paginaListo(back, st.nombre, pag.nombre, st.sinRefresh, st.en);
  }
  const err = url.searchParams.get('error');
  if (err) {
    const d = url.searchParams.get('error_description') || '';
    return html(`<h1>No se autorizó</h1><p>LinkedIn devolvió: ${esc(err)} ${esc(d)}</p><a href="${back}">Volver a la app</a>`, 400);
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `li_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar LinkedIn" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  if (Date.now() - st.t > 10 * 60 * 1000) return html(`<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  try {
    const { data: t } = await liJson(LI_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        client_id: env.LI_CLIENT_ID, client_secret: env.LI_CLIENT_SECRET,
        redirect_uri: liRedirectUri(request),
      }),
    }, 'accessToken');
    if (!t.access_token) throw new Error(t.error_description || t.error || 'LinkedIn no devolvió el token');
    // Quién es: OpenID Connect (sub = id de la persona).
    const { data: me } = await liJson(`${LI_API}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` } }, 'userinfo');
    if (!me.sub) throw new Error('LinkedIn no devolvió la identidad de la persona.');
    const personUrn = `urn:li:person:${me.sub}`;
    const nombre = me.name || [me.given_name, me.family_name].filter(Boolean).join(' ') || 'LinkedIn';
    const scopes = String(t.scope || '');
    const conPagina = /w_organization_social/.test(scopes);
    const expiraEn = Number(t.expires_in) || 60 * 24 * 3600;
    const refreshEn = Number(t.refresh_token_expires_in) || 0;
    await env.DB.prepare(
      `UPDATE mkt_clients SET li_person_urn = ?, li_person_name = ?, li_access_token = ?, li_refresh_token = ?,
       li_access_expires_at = datetime('now', '+' || ? || ' seconds'),
       li_refresh_expires_at = CASE WHEN ? > 0 THEN datetime('now', '+' || ? || ' seconds') ELSE NULL END,
       li_scopes = ?, li_connected_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).bind(personUrn, nombre, t.access_token, t.refresh_token || null, expiraEn, refreshEn, refreshEn, scopes, st.c).run();
    // Páginas: sólo si el permiso vino en el token.
    let paginaNombre = '';
    if (conPagina) {
      let paginas = [];
      try { paginas = await paginasAdministradas(t.access_token); } catch { paginas = []; }
      if (paginas.length === 1) {
        await guardarPagina(env, st.c, paginas[0]);
        paginaNombre = paginas[0].nombre;
      } else if (paginas.length > 1) {
        const nonce = rnd();
        await kvSet(env, `li_pick_${nonce}`, JSON.stringify({ c: st.c, nombre, paginas, sinRefresh: !t.refresh_token, en: st.en, t: Date.now() }));
        const items = paginas.map((p) => `<li><a href="/api/marketing/li/callback?pick=${nonce}&org=${encodeURIComponent(String(p.urn).split(':').pop())}">${esc(p.nombre)}</a></li>`).join('');
        return html(st.en
          ? `<h1>Which Page belongs to this brand?</h1><p>You manage several LinkedIn Pages. Pick the right one:</p><ul>${items}</ul><p><a href="${back}">Skip (profile only)</a></p>`
          : `<h1>¿Qué página es de esta marca?</h1><p>Administras varias páginas de LinkedIn. Elige la correcta:</p><ul>${items}</ul><p><a href="${back}">Saltar (sólo el perfil)</a></p>`);
      } else {
        await env.DB.prepare("UPDATE mkt_clients SET li_org_urn = NULL, li_org_name = NULL WHERE id = ?").bind(st.c).run();
      }
    }
    return paginaListo(back, nombre, paginaNombre, !t.refresh_token, st.en);
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// Token vigente para la marca: refresca si hay refresh token y caduca en <5
// min; sin refresh (lo normal fuera del programa de socios) sólo avisa.
export async function tokenLinkedInVigente(env, clientId) {
  const c = await env.DB.prepare(
    'SELECT li_access_token, li_refresh_token, li_access_expires_at FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c || !c.li_access_token) throw new Error('La marca no tiene LinkedIn conectado (Conexiones → Conectar LinkedIn).');
  const vence = c.li_access_expires_at ? Date.parse(c.li_access_expires_at.replace(' ', 'T') + 'Z') : 0;
  if (vence && vence - Date.now() > 5 * 60 * 1000) return c.li_access_token;
  if (!c.li_refresh_token) {
    throw new Error('El permiso de LinkedIn de esta marca caducó (LinkedIn lo da por 60 días). Reconéctala desde Conexiones.');
  }
  const { data: t } = await liJson(LI_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: c.li_refresh_token,
      client_id: env.LI_CLIENT_ID, client_secret: env.LI_CLIENT_SECRET,
    }),
  }, 'refresh');
  if (!t.access_token) throw new Error('LinkedIn no renovó el permiso: reconecta la marca desde Conexiones.');
  await env.DB.prepare(
    `UPDATE mkt_clients SET li_access_token = ?, li_refresh_token = ?,
     li_access_expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now') WHERE id = ?`
  ).bind(t.access_token, t.refresh_token || c.li_refresh_token, Number(t.expires_in) || 3600, clientId).run();
  return t.access_token;
}

// GET /li/estado?client_id=… (staff) → lo que el editor y Conexiones pintan.
export async function handleLiEstado(env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const clientId = url.searchParams.get('client_id') || '';
  const c = await env.DB.prepare(
    'SELECT li_person_name, li_org_name, li_org_urn, li_access_token, li_access_expires_at FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  const org_aprobado = await liOrgAprobado(env);
  const configurada = !!(env.LI_CLIENT_ID && env.LI_CLIENT_SECRET);
  if (!c || !c.li_access_token) return json({ conectado: false, configurada, org_aprobado });
  const vence = c.li_access_expires_at ? Date.parse(c.li_access_expires_at.replace(' ', 'T') + 'Z') : 0;
  return json({
    conectado: true, configurada, org_aprobado,
    perfil: c.li_person_name || '', pagina: c.li_org_name || '', pagina_urn: c.li_org_urn || '',
    vence_en_dias: vence ? Math.max(0, Math.round((vence - Date.now()) / 86400000)) : null,
  });
}

// POST /li/disconnect { client_id } (staff). LinkedIn no expone revocación por
// API: se limpia la fila y la persona puede retirar el permiso en
// linkedin.com/mypreferences/d/data-sharing-for-permitted-services.
export async function handleLiDisconnect(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const clientId = b.client_id || '';
  if (!clientId) return json({ error: 'Falta client_id' }, 400);
  const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!c) return json({ error: 'Cliente no encontrado' }, 404);
  await env.DB.prepare(
    `UPDATE mkt_clients SET li_person_urn = NULL, li_person_name = NULL, li_org_urn = NULL, li_org_name = NULL,
     li_access_token = NULL, li_refresh_token = NULL, li_access_expires_at = NULL, li_refresh_expires_at = NULL,
     li_scopes = NULL, li_connected_at = NULL, updated_at = datetime('now') WHERE id = ?`
  ).bind(clientId).run();
  return json({ ok: true });
}

async function leerBytes(urlMedia, max, que) {
  const r = await fetch(urlMedia);
  if (!r.ok) throw new Error(`No se pudo leer ${que} del almacén (${r.status}).`);
  const bytes = await r.arrayBuffer();
  if (max && bytes.byteLength > max) throw new Error(`${que} pasa de ${Math.round(max / 1024 / 1024)} MB: comprimirlo para LinkedIn.`);
  return bytes;
}

async function subirImagen(token, owner, urlImagen) {
  const { data } = await liJson(`${LI_API}/rest/images?action=initializeUpload`, {
    method: 'POST', headers: cabeceras(token), body: JSON.stringify({ initializeUploadRequest: { owner } }),
  }, 'images.initializeUpload');
  const v = data.value || {};
  if (!v.uploadUrl || !v.image) throw new Error('LinkedIn no devolvió el destino de subida de la imagen.');
  const bytes = await leerBytes(urlImagen, 20 * 1024 * 1024, 'la imagen');
  const up = await fetch(v.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  if (!up.ok) throw new Error('LinkedIn no aceptó la subida de la imagen (HTTP ' + up.status + ').');
  return v.image;
}

async function subirVideo(token, owner, urlVideo) {
  const bytes = await leerBytes(urlVideo, LI_MAX_VIDEO, 'el video');
  const { data } = await liJson(`${LI_API}/rest/videos?action=initializeUpload`, {
    method: 'POST', headers: cabeceras(token),
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false } }),
  }, 'videos.initializeUpload');
  const v = data.value || {};
  const partes = v.uploadInstructions || [];
  if (!v.video || !partes.length) throw new Error('LinkedIn no devolvió el destino de subida del video.');
  const etags = [];
  for (const p of partes) {
    const trozo = bytes.slice(p.firstByte, p.lastByte + 1);
    const up = await fetch(p.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: trozo,
    });
    if (!up.ok) throw new Error('LinkedIn no aceptó un tramo del video (HTTP ' + up.status + ').');
    const et = up.headers.get('etag') || up.headers.get('ETag') || '';
    etags.push(et);
  }
  await liJson(`${LI_API}/rest/videos?action=finalizeUpload`, {
    method: 'POST', headers: cabeceras(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || '', uploadedPartIds: etags } }),
  }, 'videos.finalizeUpload');
  // Esperar a que LinkedIn lo procese (hasta ~60 s; si sigue procesando, el
  // post se crea igual y LinkedIn lo publica solo al terminar).
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const { data: st } = await liJson(`${LI_API}/rest/videos/${encodeURIComponent(v.video)}`, { headers: cabeceras(token) }, 'videos.get');
      if (st.status === 'AVAILABLE') break;
      if (st.status === 'PROCESSING_FAILED') throw new Error('LinkedIn no pudo procesar el video: ' + (st.processingFailureReason || 'sin motivo'));
    } catch (e) {
      if (/no pudo procesar/.test(e.message || '')) throw e;
      // Un token sólo de w_member_social no puede LEER /rest/videos: se sigue.
      break;
    }
  }
  return v.video;
}

/**
 * Publica UNA pieza en el LinkedIn de su marca (perfil de la persona o página
 * de empresa, según li_options.destino). Devuelve { liPostId, url, destino }.
 */
export async function publicarEnLinkedIn(env, { clientId, post, videoUrl, slides }) {
  const c = await env.DB.prepare(
    'SELECT li_person_urn, li_person_name, li_org_urn, li_org_name, li_access_token FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c || !c.li_access_token) throw new Error('La marca no tiene LinkedIn conectado (Conexiones → Conectar LinkedIn).');
  const token = await tokenLinkedInVigente(env, clientId);
  let elec = {};
  try { elec = post.li_options ? JSON.parse(post.li_options) : {}; } catch { elec = {}; }
  const quierePagina = elec.destino === 'pagina';
  if (quierePagina && !c.li_org_urn) throw new Error('La pieza pide publicarse como PÁGINA, pero la marca no tiene página de LinkedIn conectada. Reconecta LinkedIn o cambia el destino a Perfil.');
  const author = quierePagina ? c.li_org_urn : c.li_person_urn;
  if (!author) throw new Error('La marca no tiene perfil de LinkedIn guardado: reconecta LinkedIn.');
  const destino = quierePagina ? 'pagina' : 'perfil';

  const body = {
    author,
    commentary: comentario(post),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  const fotos = Array.isArray(slides) ? slides.filter(Boolean) : [];
  const alt = String(post.alt_text || post.title || '').slice(0, 300);
  if (fotos.length >= 2) {
    const imgs = [];
    for (const f of fotos.slice(0, 20)) imgs.push({ id: await subirImagen(token, author, f), altText: alt });
    body.content = { multiImage: { images: imgs } };
  } else if (videoUrl) {
    const vid = await subirVideo(token, author, videoUrl);
    body.content = { media: { title: String(post.title || '').slice(0, 200) || 'Video', id: vid } };
  } else if (fotos.length === 1) {
    body.content = { media: { id: await subirImagen(token, author, fotos[0]), altText: alt } };
  }
  if (!body.commentary && !body.content) throw new Error('La pieza no tiene texto ni medio para LinkedIn.');

  const { headers } = await liJson(`${LI_API}/rest/posts`, {
    method: 'POST', headers: cabeceras(token), body: JSON.stringify(body),
  }, 'posts');
  const id = headers.get('x-restli-id') || headers.get('X-RestLi-Id') || '';
  if (!id) throw new Error('LinkedIn no devolvió el id del post.');
  return { liPostId: id, url: `https://www.linkedin.com/feed/update/${id}/`, destino, nombre: quierePagina ? c.li_org_name : c.li_person_name };
}
