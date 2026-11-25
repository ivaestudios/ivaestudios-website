// ============================================================================
// IVAE Marketing — PÁGINAS DE FACEBOOK (Facebook Login for Business + Pages API).
//
// Investigación 2026-08-17 (misma app de Meta que Instagram — tipo Business):
//   · OAuth: facebook.com/dialog/oauth con config_id → code → user token corto
//     → token largo (fb_exchange_token) → GET /me/accounts → PAGE TOKEN por
//     página. Los page tokens de larga duración NO CADUCAN (mejor que IG ~60d).
//   · Reel: POST /{page}/video_reels start → rupload con header file_url (el
//     video NO se re-sube: Meta lo baja de la URL firmada de R2) → finish.
//   · Carrusel: cada slide via POST /{page}/photos published=false → un post
//     de feed con attached_media (post multi-foto, el "carrusel" de FB).
//   · NO existe crossposting IG→FB por API (el auto-share del Accounts Center
//     ignora lo publicado por API) — por eso se publica dos veces.
//
// Env necesarios (Cloudflare Pages): FB_APP_ID (el Meta App ID de arriba del
// dashboard, 2823115284726253 — NO el Instagram App ID), FB_APP_SECRET (App
// secret de la app), FB_CONFIG_ID (la Configuración de Facebook Login for
// Business con pages_show_list + pages_read_engagement + pages_manage_posts).
// Sin ellos, todo responde con un aviso amable de qué falta.
// ============================================================================

import { paginaConexion } from './_pagina-conexion.js';
import { suscribirTrasConectar } from './_bandeja.js';

const FB_AUTH = 'https://www.facebook.com/v23.0/dialog/oauth';
const FB_GRAPH = 'https://graph.facebook.com/v23.0';
const FB_RUPLOAD = 'https://rupload.facebook.com/video-upload/v23.0';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function html(body, status = 200) {
  return paginaConexion(body, status, { titulo: 'Facebook · IVAE Marketing' });
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
const fbRedirectUri = (request) => new URL('/api/marketing/fb/callback', request.url).toString();

function faltaConfig(env) {
  if (!env.FB_APP_ID || !env.FB_APP_SECRET || !env.FB_CONFIG_ID) {
    return 'Falta configurar Facebook en la app de Meta: producto "Facebook Login for Business", y en Cloudflare Pages los secretos FB_APP_ID, FB_APP_SECRET y FB_CONFIG_ID.';
  }
  return null;
}

// GET /fb/login?client_id=… (staff; clientes solo en lista blanca) → OAuth de
// Facebook. Espejo del CLIENT_CAN_CONNECT de _instagram.js (pedido 2026-08-27:
// botón Conectar para el cliente Regeneris). El cliente queda FORZADO a su
// propia marca: se ignora el client_id de la URL.
// Vianey 13-nov-2026: "las conexiones nadie más que nosotros". Ningún cliente conecta redes; solo el equipo.
// Vianey 17-nov-2026: "añade la sección de conexiones para que cada cliente le pueda conectar su cuenta". Cualquier cliente conecta SU marca (se fuerza su client_id); desconectar sigue siendo del equipo.
export async function handleFbLogin(request, env, session, url) {
  if (session.role === 'client' && !session.client_id) return json({ error: 'Forbidden' }, 403);
  const falta = faltaConfig(env);
  if (falta) return json({ error: falta }, 503);
  const clientId = session.role === 'client'
    ? (session.client_id || '')
    : (url.searchParams.get('client_id') || '');
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);
  const nonce = rnd();
  // lang viaja en el state: las pantallas del callback hablan el idioma de la
  // app (el App Review exige interfaz en inglés cuando se graba con ?lang=en).
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  await kvSet(env, `fb_state_${nonce}`, JSON.stringify({ c: clientId, t: Date.now(), l: lang }));
  const p = new URLSearchParams({
    client_id: env.FB_APP_ID,
    redirect_uri: fbRedirectUri(request),
    state: nonce,
    response_type: 'code',
    config_id: env.FB_CONFIG_ID,
    // El dialogo de Facebook sale en el idioma de la CUENTA de la persona, no
    // del sitio. Para el video de la revision de Meta (todo en ingles) se le
    // pide explicito con locale cuando se entro con ?lang=en.
    ...(lang === 'en' ? { locale: 'en_US' } : {}),
  });
  return Response.redirect(`${FB_AUTH}?${p}`, 302);
}

// GET /fb/callback — code → token largo → páginas del usuario → elegir página.
export async function handleFbCallback(request, env, url) {
  const back = '/marketing/app#/conexiones';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const raw = await kvTake(env, `fb_state_${state}`);
  if (!code || !raw) return html(`<h1>Link inválido o caducado</h1><p>Vuelve a la app e intenta "Conectar Facebook" de nuevo.</p><a href="${back}">Volver a la app</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  const EN = st.l === 'en';
  if (Date.now() - st.t > 10 * 60 * 1000) return html(EN ? `<h1>The attempt expired</h1><p>Try again from the app.</p><a href="${back}">Back</a>` : `<h1>El intento caducó</h1><p>Hazlo de nuevo desde la app.</p><a href="${back}">Volver</a>`, 400);

  try {
    // 1) code → user token corto
    const t1 = await (await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id: env.FB_APP_ID, client_secret: env.FB_APP_SECRET,
      redirect_uri: fbRedirectUri(request), code,
    }))).json();
    if (!t1.access_token) throw new Error((t1.error && t1.error.message) || 'sin token');
    // 2) corto → largo (60 días; las páginas heredarán tokens SIN caducidad)
    const t2 = await (await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: env.FB_APP_ID,
      client_secret: env.FB_APP_SECRET, fb_exchange_token: t1.access_token,
    }))).json();
    const userTok = t2.access_token || t1.access_token;
    // 3) páginas administradas (cada una trae su PAGE token de larga duración)
    let acc = await (await fetch(`${FB_GRAPH}/me/accounts?fields=${CAMPOS_PAGINA}&limit=50&access_token=${encodeURIComponent(userTok)}`)).json();
    // Si Facebook no deja leer el Instagram de las páginas, se pide la lista
    // sencilla de siempre: conectar NUNCA depende de ese dato.
    if (!acc || acc.error) acc = await (await fetch(`${FB_GRAPH}/me/accounts?fields=${CAMPOS_BASICOS}&limit=50&access_token=${encodeURIComponent(userTok)}`)).json();
    const pages = (acc.data || []).filter((p) => p.id && p.access_token);
    if (!pages.length) {
      // BUG de Meta visto 2026-08-27: tras revocar y re-autorizar la app,
      // /me/accounts responde vacío AUNQUE el token traiga las páginas en
      // granular_scopes (verificado con debug_token). Rodeo oficial: sacar
      // los ids de granular_scopes y pedir el token de cada página directo.
      try {
        const dbg = await (await fetch(`${FB_GRAPH}/debug_token?` + new URLSearchParams({
          input_token: userTok, access_token: `${env.FB_APP_ID}|${env.FB_APP_SECRET}`,
        }))).json();
        const ids = [...new Set(((dbg.data && dbg.data.granular_scopes) || [])
          .flatMap((g) => g.target_ids || []))];
        for (const id of ids.slice(0, 25)) {
          let pg = await (await fetch(`${FB_GRAPH}/${id}?fields=${CAMPOS_PAGINA}&access_token=${encodeURIComponent(userTok)}`)).json();
          if (!pg || pg.error) pg = await (await fetch(`${FB_GRAPH}/${id}?fields=${CAMPOS_BASICOS}&access_token=${encodeURIComponent(userTok)}`)).json();
          if (pg.id && pg.access_token) pages.push(pg);
        }
      } catch { /* se queda el aviso de Sin páginas */ }
    }
    if (!pages.length) {
      return html(EN
        ? `<h1>No Pages</h1><p>This Facebook account does not manage any Page. Create the brand's Page (or ask for an admin role) and try again.</p><a href="${back}">Back to the app</a>`
        : `<h1>Sin páginas</h1><p>Esta cuenta de Facebook no administra ninguna página. Crea la página de la marca (o pide rol de administrador) y vuelve a intentar.</p><a href="${back}">Volver a la app</a>`);
    }
    // ELEGIR PÁGINA (25-nov-2026). Antes, si Facebook entregaba UNA sola
    // página, la app la conectaba sin preguntar: así MELISA quedó ligada a
    // "Artesanías: Justo para ti" en vez de su página de fitness. Ahora solo
    // se conecta sola la página ligada al Instagram de la marca; en cualquier
    // otro caso (aunque sea una sola) se enseña la lista con el Instagram de
    // cada página y se elige con un clic.
    const marca = await env.DB.prepare('SELECT ig_user_id, ig_username FROM mkt_clients WHERE id = ?').bind(st.c).first();
    const lista = pages.map((p) => ({
      id: p.id, name: p.name, access_token: p.access_token,
      ig: (p.instagram_business_account && p.instagram_business_account.username) || null,
      igId: (p.instagram_business_account && p.instagram_business_account.id) || null,
    }));
    const ligadas = lista.filter((p) => esDeLaMarca(p, marca));
    const pickId = rnd();
    // La lista se guarda 10 min para elegir (o cambiar de página); si solo
    // hay una y es la de la marca, no hace falta guardarla.
    if (!(ligadas.length === 1 && lista.length === 1)) {
      await kvSet(env, `fb_pick_${pickId}`, JSON.stringify({ c: st.c, t: Date.now(), l: st.l, marcaIg: (marca && marca.ig_username) || null, pages: lista }));
    }
    if (ligadas.length === 1) {
      await guardarPagina(env, st.c, ligadas[0]);
      return html(conectadaHtml(ligadas[0], EN, back, lista.length > 1 ? pickId : null));
    }
    return html(pickerHtml({ pickId, lista, marcaIg: (marca && marca.ig_username) || null, EN, back, marca }));
  } catch (e) {
    return html(`<h1>No se pudo conectar</h1><p>${esc((e && e.message) || 'Error desconocido')}</p><a href="${back}">Volver a la app</a>`, 500);
  }
}

// GET /fb/callback?pick=…&page=… — segundo paso del picker de páginas.
export async function handleFbPick(request, env, url) {
  const back = '/marketing/app#/conexiones';
  const pickId = url.searchParams.get('pick') || '';
  const pageId = url.searchParams.get('page') || '';
  // Sin página elegida: solo se vuelve a enseñar la lista (no se borra).
  const raw = pageId
    ? await kvTake(env, `fb_pick_${pickId}`)
    : ((await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(`fb_pick_${pickId}`).first()) || {}).value;
  if (!raw) return html(`<h1>Link caducado</h1><p>Vuelve a "Conectar Facebook" en la app.</p><a href="${back}">Volver</a>`, 400);
  let st;
  try { st = JSON.parse(raw); } catch { return html('<h1>Estado corrupto</h1>', 400); }
  const EN = st.l === 'en';
  if (Date.now() - st.t > 10 * 60 * 1000) return html(EN ? `<h1>The attempt expired</h1><a href="${back}">Back</a>` : `<h1>El intento caducó</h1><a href="${back}">Volver</a>`, 400);
  if (!pageId) {
    const marca = await env.DB.prepare('SELECT ig_user_id, ig_username FROM mkt_clients WHERE id = ?').bind(st.c).first();
    return html(pickerHtml({ pickId, lista: st.pages || [], marcaIg: st.marcaIg || (marca && marca.ig_username) || null, EN, back, marca }));
  }
  const page = (st.pages || []).find((p) => p.id === pageId);
  if (!page) return html(EN ? '<h1>Page not found</h1>' : '<h1>Página no encontrada</h1>', 400);
  await guardarPagina(env, st.c, page);
  return html(conectadaHtml(page, EN, back, null));
}

// El Instagram ligado a cada página. OJO (verificado el 25-nov-2026 con las
// llaves reales de 4 marcas): con los permisos actuales de la app Facebook NO
// manda este dato (ni en IVAE Studios, que sí tiene su Instagram ligado).
// Por eso la lista SIEMPRE pregunta, y el Instagram solo se usa si llega.
const CAMPOS_PAGINA = 'id,name,access_token,instagram_business_account{id,username}';
const CAMPOS_BASICOS = 'id,name,access_token';

// ¿La página está ligada al Instagram de la marca? Por usuario (sin @, sin
// mayúsculas) o por id de Instagram.
function esDeLaMarca(p, marca) {
  if (!marca || !p) return false;
  const u = (x) => String(x || '').replace(/^@/, '').trim().toLowerCase();
  if (p.ig && marca.ig_username && u(p.ig) === u(marca.ig_username)) return true;
  return !!(p.igId && marca.ig_user_id && String(p.igId) === String(marca.ig_user_id));
}

const ESTILO_PICKER = `<style>
.pg-ig{display:block;font-weight:500;font-size:13px;color:var(--mute);margin-top:2px}
.pg-ok .pg-ig{color:var(--ok);font-weight:600}
.pg-txt{display:block;min-width:0}
.aviso{border:1px solid color-mix(in srgb,var(--brand) 35%,var(--border));background:color-mix(in srgb,var(--brand) 7%,var(--surface));border-radius:14px;padding:12px 14px;margin:0 0 6px;color:var(--text);font-size:14.5px}
.aviso ol,.ayuda ol{margin:8px 0 0;padding-left:20px;color:var(--dim)}
.ayuda{margin:16px 0 0;padding:12px 14px;border-radius:14px;background:var(--surface-2);color:var(--dim);font-size:14.5px}
.ayuda b{color:var(--text)}
a.salir{justify-content:center;background:none;border:1px solid var(--border);color:var(--dim)}
</style>`;

function pickerHtml({ pickId, lista, marcaIg, EN, back, marca }) {
  // ¿Facebook mandó el Instagram de las páginas? Si no, no se adivina nada:
  // ni "sin Instagram" ni "ninguna es de la marca".
  const igConocido = lista.some((p) => p.ig || p.igId);
  const orden = [...lista].sort((a, b) => Number(esDeLaMarca(b, marca)) - Number(esDeLaMarca(a, marca)));
  const algunaLigada = orden.some((p) => esDeLaMarca(p, marca));
  const botones = orden.map((p) => {
    const suya = esDeLaMarca(p, marca);
    const ig = !igConocido ? ''
      : p.ig
        ? `Instagram: @${esc(p.ig)}` + (suya ? (EN ? ' · this brand' : ' · es de esta marca') : '')
        : (EN ? 'No Instagram linked' : 'Sin Instagram ligado');
    return `<a class="${suya ? 'pg-ok' : ''}" href="/api/marketing/fb/callback?pick=${pickId}&page=${encodeURIComponent(p.id)}">📘 <span class="pg-txt">${esc(p.name)}${ig ? `<span class="pg-ig">${ig}</span>` : ''}</span></a>`;
  }).join('');
  const deLaMarca = marcaIg ? (EN ? ` (the one for Instagram <b>@${esc(marcaIg)}</b>)` : ` (la del Instagram <b>@${esc(marcaIg)}</b>)`) : '';
  const pasos = EN
    ? `<ol><li>Go back and tap "Connect Facebook" again. In the Facebook window, choose to edit the access and tick that Page.</li><li>If it still does not appear, that Page is managed by another Facebook account: sign in with that one.</li></ol>`
    : `<ol><li>Vuelve a darle a "Conectar Facebook". En la ventana de Facebook, elige editar el acceso y marca esa página.</li><li>Si aun así no sale, esa página la administra otra cuenta de Facebook: entra con esa.</li></ol>`;
  // Si Facebook SÍ dijo el Instagram de cada página y ninguna es la de la
  // marca, se avisa arriba. Si no lo dijo, la ayuda va abajo, tranquila.
  const avisoArriba = igConocido && marcaIg && !algunaLigada
    ? (EN
      ? `<div class="aviso">None of these Pages is linked to this brand's Instagram (<b>@${esc(marcaIg)}</b>). If the brand's Page is not on the list:${pasos}</div>`
      : `<div class="aviso">Ninguna de estas páginas está ligada al Instagram de la marca (<b>@${esc(marcaIg)}</b>). Si la página de la marca no sale en la lista:${pasos}</div>`)
    : '';
  const ayudaAbajo = avisoArriba ? '' : (EN
    ? `<div class="ayuda">Is the brand's Page${deLaMarca} missing?${pasos}</div>`
    : `<div class="ayuda">¿No está la página de la marca${deLaMarca}?${pasos}</div>`);
  const titulo = EN ? 'Which Page belongs to this brand?' : '¿Cuál página es de esta marca?';
  const intro = lista.length > 1
    ? (EN ? 'Your account gave access to several Pages. Pick the right one:' : 'Tu cuenta dio acceso a varias páginas. Elige la correcta:')
    : (EN ? 'Facebook gave access to this Page. Connect it only if it belongs to this brand:' : 'Facebook dio acceso a esta página. Conéctala solo si es de esta marca:');
  const ninguna = EN ? `<a class="salir" href="${back}">None of these: back to the app</a>` : `<a class="salir" href="${back}">Ninguna es: volver a la app</a>`;
  return `${ESTILO_PICKER}<h1>${titulo}</h1>${avisoArriba}<p>${intro}</p>${botones}${ayudaAbajo}${ninguna}<small>${EN ? 'This link expires in 10 minutes.' : 'Este enlace caduca en 10 minutos.'}</small>`;
}

function conectadaHtml(page, EN, back, pickId) {
  const ig = page.ig ? (EN ? ` (Instagram @${esc(page.ig)})` : ` (Instagram @${esc(page.ig)})`) : '';
  const otra = pickId
    ? `<a href="/api/marketing/fb/callback?pick=${pickId}">${EN ? 'Not this one? Pick another Page' : '¿No es esta? Elegir otra página'}</a>`
    : '';
  return EN
    ? `<h1>✅ Facebook connected</h1><p>The brand is now linked to the Page <b>${esc(page.name)}</b>${ig}. Pieces marked "also on Facebook" will be published there.</p><a href="${back}">Back to the app</a>${otra}`
    : `<h1>✅ Facebook conectado</h1><p>La marca quedó ligada a la página <b>${esc(page.name)}</b>${ig}. Las piezas con "también en Facebook" se publicarán ahí.</p><a href="${back}">Volver a la app</a>${otra}`;
}

async function guardarPagina(env, clientId, page) {
  await env.DB.prepare(
    `UPDATE mkt_clients SET fb_page_id = ?, fb_page_name = ?, fb_access_token = ?, fb_connected_at = datetime('now') WHERE id = ?`
  ).bind(page.id, page.name || '', page.access_token, clientId).run();
  // Bandeja: suscribe la página a los webhooks (comentarios y Messenger).
  await suscribirTrasConectar(env, clientId);
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

async function fbJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    let msg = (data.error && (data.error.error_user_msg || data.error.message)) || `HTTP ${res.status}`;
    if (/permission|#200|#10\b/i.test(msg)) msg = 'La página de Facebook está conectada con permisos insuficientes — reconéctala desde la ficha del cliente. (' + msg + ')';
    const e = new Error(msg);
    e.fbCode = data.error && data.error.code;
    throw e;
  }
  return data;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// El caption FINAL para Facebook: mismo criterio que Instagram.
function captionFb(post) {
  const cap = String(post.caption || '').trim();
  const tags = String(post.hashtags || '').trim();
  return (tags && !cap.includes(tags.split(/\s+/)[0]) ? `${cap}\n\n${tags}` : cap).slice(0, 5000);
}

/**
 * Publica UNA pieza en la página de Facebook de su marca.
 * Reel (video firmado) → Reels API de páginas; carrusel (slides firmados) →
 * post multi-foto; foto única → /photos. Devuelve { fbPostId, permalink }.
 */
// POST /fb/disconnect { client_id } (staff) — quitar la página de Facebook de
// la marca (30-sep-2026: faltaba el botón). Solo limpia la fila: el permiso de
// Meta es del usuario que conectó (el mismo de Instagram), no de la página, así
// que no se revoca aquí para no tumbar Instagram de paso.
export async function handleFbDisconnect(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const clientId = String(b.client_id || '');
  if (!clientId) return json({ error: 'Falta client_id' }, 400);
  const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!c) return json({ error: 'Cliente no encontrado' }, 404);
  await env.DB.prepare(
    `UPDATE mkt_clients SET fb_page_id = NULL, fb_page_name = NULL, fb_access_token = NULL, fb_connected_at = NULL,
     updated_at = datetime('now') WHERE id = ?`
  ).bind(clientId).run();
  return json({ ok: true });
}

export async function publicarEnFacebook(env, { client, post, videoUrl, slides }) {
  if (!client || !client.fb_page_id || !client.fb_access_token) {
    throw new Error('La marca no tiene página de Facebook conectada (ficha del cliente → Conectar Facebook).');
  }
  const tok = client.fb_access_token;
  const caption = captionFb(post);

  // POST DE UNA FOTO: la foto subida a la pieza (slide 1) va a /photos.
  if (slides && slides.length === 1 && String(post.content_type || '') !== 'carrusel') {
    const f1 = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/photos`, {
      method: 'POST',
      body: new URLSearchParams({ url: slides[0], caption, access_token: tok }),
    });
    if (!f1.post_id && !f1.id) throw new Error('Facebook no confirmó la foto.');
    const idFoto = f1.post_id || f1.id;
    return { fbPostId: idFoto, permalink: `https://www.facebook.com/${idFoto}` };
  }

  // CARRUSEL → post multi-foto (el "carrusel" nativo de páginas).
  if (slides && slides.length >= 2) {
    const ids = [];
    for (const u of slides.slice(0, 10)) {
      const f = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/photos`, {
        method: 'POST',
        body: new URLSearchParams({ url: u, published: 'false', access_token: tok }),
      });
      if (f.id) ids.push(f.id);
    }
    if (!ids.length) throw new Error('Facebook no aceptó ninguna foto del carrusel.');
    const params = new URLSearchParams({ message: caption, access_token: tok });
    ids.forEach((id, i) => params.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const postRes = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/feed`, { method: 'POST', body: params });
    if (!postRes.id) throw new Error('Facebook no confirmó el post del carrusel.');
    return { fbPostId: postRes.id, permalink: `https://www.facebook.com/${postRes.id}` };
  }

  // HISTORIA DE PÁGINA (content_type 'historia', 2026-09-10): Page Stories API,
  // mismas 3 fases que el reel pero en /video_stories y sin descripción (las
  // historias no llevan caption). Dura 24 h; se guarda el video_id.
  if (videoUrl && String(post.content_type || '') === 'historia') {
    const inicio = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_stories`, {
      method: 'POST',
      body: new URLSearchParams({ upload_phase: 'start', access_token: tok }),
    });
    if (!inicio.video_id) throw new Error('Facebook no devolvió el video_id de la historia.');
    const up = await fetch(`${FB_RUPLOAD}/${inicio.video_id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${tok}`, file_url: videoUrl },
    });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok || upData.error) {
      throw new Error('Facebook no pudo bajar el video de la historia: ' + ((upData.error && upData.error.message) || `HTTP ${up.status}`));
    }
    const fin = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_stories`, {
      method: 'POST',
      body: new URLSearchParams({ upload_phase: 'finish', video_id: inicio.video_id, access_token: tok }),
    });
    if (fin.error) throw new Error('Facebook no publicó la historia: ' + fin.error.message);
    return { fbPostId: fin.post_id || inicio.video_id, permalink: `https://www.facebook.com/${client.fb_page_id}` };
  }

  // REEL → Reels API de páginas en 3 fases; el video viaja por file_url.
  if (videoUrl) {
    const inicio = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({ upload_phase: 'start', access_token: tok }),
    });
    if (!inicio.video_id) throw new Error('Facebook no devolvió el video_id del reel.');
    const up = await fetch(`${FB_RUPLOAD}/${inicio.video_id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${tok}`, file_url: videoUrl },
    });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok || upData.error) {
      throw new Error('Facebook no pudo bajar el video: ' + ((upData.error && upData.error.message) || `HTTP ${up.status}`));
    }
    await fbJson(`${FB_GRAPH}/${client.fb_page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({
        upload_phase: 'finish', video_id: inicio.video_id,
        video_state: 'PUBLISHED', description: caption, access_token: tok,
      }),
    });
    // El procesamiento es asíncrono: se espera lo razonable y se registra.
    for (let i = 0; i < 12; i++) {
      await espera(5000);
      try {
        const st = await fbJson(`${FB_GRAPH}/${inicio.video_id}?fields=status&access_token=${encodeURIComponent(tok)}`);
        const v = st.status && st.status.video_status;
        if (v === 'ready') break;
        if (v === 'error') throw new Error('Facebook no pudo procesar el reel.');
      } catch (e) { if (/no pudo procesar/.test(e.message)) throw e; break; }
    }
    return { fbPostId: inicio.video_id, permalink: `https://www.facebook.com/reel/${inicio.video_id}` };
  }

  // FOTO única (post tipo 'post' con inspo JPEG).
  if (post.inspo_url && /\.(jpe?g)(\?|$)/i.test(post.inspo_url)) {
    const f = await fbJson(`${FB_GRAPH}/${client.fb_page_id}/photos`, {
      method: 'POST',
      body: new URLSearchParams({ url: post.inspo_url, caption, access_token: tok }),
    });
    if (!f.post_id && !f.id) throw new Error('Facebook no confirmó la foto.');
    return { fbPostId: f.post_id || f.id, permalink: `https://www.facebook.com/${f.post_id || f.id}` };
  }

  throw new Error('La pieza no tiene video ni slides para publicar en Facebook.');
}

// GET /fb/metrics?client_id=… — métricas EN VIVO de la página conectada de la
// marca (pages_read_engagement): seguidores de la página + la respuesta
// (reacciones/comentarios/compartidos) de sus últimas publicaciones. El staff
// puede pedir cualquier marca; el cliente queda forzado a la suya. Es la
// experiencia visible del permiso pages_read_engagement en el App Review
// (2026-08-27): los números salen de la Graph API al momento, nada cacheado.
export async function handleFbMetrics(request, env, session, url) {
  const clientId = session.role === 'client'
    ? (session.client_id || '')
    : (url.searchParams.get('client_id') || '');
  const c = await env.DB.prepare(
    'SELECT id, name, fb_page_id, fb_page_name, fb_access_token FROM mkt_clients WHERE id = ?'
  ).bind(clientId).first();
  if (!c) return json({ error: 'Cliente no encontrado' }, 404);
  if (!c.fb_page_id || !c.fb_access_token) return json({ connected: false });
  const tok = c.fb_access_token;
  try {
    const page = await fbJson(`${FB_GRAPH}/${c.fb_page_id}?` + new URLSearchParams({
      fields: 'name,fan_count,followers_count,link', access_token: tok,
    }));
    // OJO (2026-08-27, probado contra Graph): en modo desarrollo los conteos
    // likes.summary/comments.summary responden #10 aunque el token TRAIGA
    // pages_read_engagement — Meta los libera con el Acceso Avanzado. Lo que
    // SÍ custodia hoy este permiso y funciona: fan_count y /posts con
    // shares. Cuando la App Review apruebe, aquí se suman los conteos.
    const feed = await fbJson(`${FB_GRAPH}/${c.fb_page_id}/posts?` + new URLSearchParams({
      fields: 'created_time,message,permalink_url,shares',
      limit: '10', access_token: tok,
    }));
    const posts = (feed.data || []).map((p) => ({
      id: p.id,
      created_time: p.created_time || null,
      message: String(p.message || '').replace(/\s+/g, ' ').slice(0, 160),
      permalink: p.permalink_url || null,
      shares: (p.shares && p.shares.count) || 0,
    }));
    return json({
      connected: true,
      page: {
        id: c.fb_page_id,
        name: page.name || c.fb_page_name || '',
        fans: (page.fan_count != null ? page.fan_count : page.followers_count),
        link: page.link || `https://www.facebook.com/${c.fb_page_id}`,
      },
      posts,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    // 424 y NO 5xx: Cloudflare pisa los 5xx con su propia página de error.
    return json({ error: (e && e.message) || 'Facebook no respondió' }, 424);
  }
}
