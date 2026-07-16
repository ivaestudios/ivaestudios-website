// ============================================================================
// IVAE Marketing — Descargador de videos (Instagram / TikTok / Pinterest).
//
// Resuelve un link público a un MP4 LIMPIO (sin marca de agua) en la resolución
// más alta disponible, 100% server-side (Cloudflare Pages Function). El router
// ([[path]].js) usa resolveVideo() para (a) mostrar una tarjeta de vista previa
// y (b) transmitir los bytes al navegador con Content-Disposition: attachment.
//
// Técnica (verificada 2026, la misma que ssstik/pindown usan por dentro):
//  · TikTok    → playAddr / play_addr es el MP4 SIN marca (downloadAddr = CON
//                marca). Tier A = scrape del JSON embebido; fallback = tikwm
//                (IPs limpias) cuando el IP del Worker recibe muro anti-bot.
//  · Pinterest → API interna PinResource: data.videos.video_list.V_720P es el
//                MP4 fuente (1080x1920), servido limpio en v1.pinimg.com.
//  · Instagram → shortcode → media_id → /api/v1/media/{id}/info/ (x-ig-app-id);
//                video_versions[] ordenado por ancho = MP4 original del CDN.
//
// Anti-SSRF: el proxy SOLO baja bytes de hosts de CDN conocidos (MEDIA_HOST_RE);
// la ruta es staff-only. Las URLs del CDN son firmadas y expiran: NUNCA se
// guardan — se re-resuelve al momento de descargar.
// ============================================================================

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';
const IG_DOC_ID = '27128499623469141'; // PolarisPostRootQuery (mediados 2026; ROTA — override por env IG_DOC_ID)

// Hosts a los que el proxy tiene permitido ir a bajar bytes (defensa anti-SSRF).
const MEDIA_HOST_RE = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com|tiktok\.com|byteoversea\.com|akamaized\.net|pinimg\.com|cdninstagram\.com|fbcdn\.net|tikwm\.com)$/i;

export function detectPlatform(raw) {
  const u = String(raw || '').toLowerCase();
  if (!/^https?:\/\//.test(u)) return null;
  if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(u)) return 'tiktok';
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
  if (/pinterest\.[a-z.]+|pin\.it/.test(u)) return 'pinterest';
  return null;
}

export function isAllowedMediaHost(u) {
  try { return MEDIA_HOST_RE.test(new URL(u).hostname); } catch { return false; }
}

// fetch con timeout duro: una petición externa colgada (p.ej. el muro anti-bot
// de tiktok.com desde la IP de Cloudflare) tumbaría la Function con un 502; el
// AbortSignal la corta y la deja caer a un error manejado / respaldo.
function xfetch(url, opts = {}, ms = 12000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

// Headers para BAJAR el MP4 del CDN, derivados de la plataforma (el endpoint de
// descarga los reconstruye sin re-resolver, así que no dependen del resolve).
export function mediaHeadersFor(platform) {
  if (platform === 'tiktok') return { 'User-Agent': DESKTOP_UA, 'Referer': 'https://www.tiktok.com/' };
  if (platform === 'pinterest') return { 'User-Agent': DESKTOP_UA, 'Referer': 'https://www.pinterest.com/' };
  return { 'User-Agent': DESKTOP_UA };
}

// Nombre de archivo sugerido (seguro para Content-Disposition).
export function suggestName(info) {
  const base = String(info.title || info.platform || 'video')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\wÀ-ſ .-]+/g, '')
    .trim().replace(/\s+/g, '_').slice(0, 60) || info.platform || 'video';
  return `${info.platform}-${base}.${info.ext || 'mp4'}`;
}

// Dispatch principal. Devuelve:
//  { platform, title, thumbnail, width, height, durationSec, mediaUrl, ext,
//    watermark:false, mediaHeaders }
export async function resolveVideo(url, env) {
  const platform = detectPlatform(url);
  if (platform === 'tiktok') return resolveTikTok(url, env);
  if (platform === 'pinterest') return resolvePinterest(url, env);
  if (platform === 'instagram') return resolveInstagram(url, env);
  throw new Error('Pega un link de Instagram, TikTok o Pinterest.');
}

// ── TikTok ───────────────────────────────────────────────────────────────────
// Se prioriza tikwm: devuelve el CDN MÓVIL (v16m) que NO está protegido por
// Referer/hotlink → sí se puede re-descargar desde el servidor. El playAddr del
// HTML usa el web-CDN (v16-webapp-prime) que 403ea al re-descargar, y en las IPs
// de datacenter de Cloudflare el HTML suele recibir el muro anti-bot; por eso es
// solo respaldo. Se enriquecen las dimensiones desde el HTML cuando se pueda.
async function resolveTikTok(url) {
  let info = await tiktokViaTikwm(url).catch(() => null);
  if (!info || !info.mediaUrl) {
    const id = await tiktokId(url);
    info = id ? await tiktokViaHtml(id).catch(() => null) : null;
  } else if (!info.width) {
    const id = await tiktokId(url);
    const html = id ? await tiktokViaHtml(id).catch(() => null) : null;
    if (html && html.width) { info.width = html.width; info.height = html.height; }
  }
  if (!info || !info.mediaUrl) {
    throw new Error('TikTok no devolvió el video. Puede ser privado, bloqueado por región, o el servidor recibió el muro anti-bot. Prueba con el link completo del video.');
  }
  return info;
}

async function tiktokId(url) {
  let u = url;
  if (/vm\.tiktok|vt\.tiktok|tiktok\.com\/t\//i.test(u)) {
    for (let i = 0; i < 3; i++) {
      const r = await xfetch(u, { redirect: 'manual', headers: { 'User-Agent': DESKTOP_UA } });
      const loc = r.headers.get('location');
      if (!loc) break;
      u = loc.startsWith('http') ? loc : new URL(loc, u).toString();
      if (/\/(video|photo)\/\d+/.test(u)) break;
    }
  }
  return (u.match(/\/(?:video|photo)\/(\d+)/) || [])[1]
      || (u.match(/[?&]item_id=(\d+)/) || [])[1]
      || null;
}

async function tiktokViaHtml(id) {
  const r = await xfetch(`https://www.tiktok.com/@i/video/${id}`, {
    headers: { 'User-Agent': DESKTOP_UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = await r.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)
        || html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data; try { data = JSON.parse(m[1]); } catch { return null; }
  const item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
            || data?.ItemModule?.[id];
  const v = item && item.video;
  if (!v) return null;
  const gears = (v.bitrateInfo || [])
    .map((g) => ({
      h264: /264/.test(String(g.CodecType || '')),
      w: (g.PlayAddr && g.PlayAddr.Width) || 0,
      h: (g.PlayAddr && g.PlayAddr.Height) || 0,
      url: g.PlayAddr && g.PlayAddr.UrlList && g.PlayAddr.UrlList[0],
    }))
    .filter((g) => g.url)
    .sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const h264 = gears.filter((g) => g.h264);
  const best = h264[0] || gears[0];
  const mediaUrl = (best && best.url) || v.playAddr;
  if (!mediaUrl) return null;
  return {
    platform: 'tiktok',
    title: (item.desc || '').slice(0, 120) || 'tiktok',
    thumbnail: v.cover || v.originCover || v.dynamicCover || null,
    width: (best && best.w) || v.width || null,
    height: (best && best.h) || v.height || null,
    durationSec: v.duration || null,
    mediaUrl,
    ext: 'mp4',
    watermark: false,
    mediaHeaders: { 'User-Agent': DESKTOP_UA, 'Referer': 'https://www.tiktok.com/' },
  };
}

async function tiktokViaTikwm(url) {
  const r = await xfetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': DESKTOP_UA },
    body: `url=${encodeURIComponent(url)}&hd=1`,
  });
  const j = await r.json().catch(() => null);
  if (!j || j.code !== 0 || !j.data) return null;
  const d = j.data;
  const raw = d.hdplay || d.play;
  if (!raw) return null;
  // Guardia anti-audio: si tikwm no pudo extraer el VIDEO devuelve el audio del
  // CDN de música con size/duration en 0 → lo rechazamos para caer al respaldo.
  if ((!d.size && !d.hd_size && !d.duration) || /ies-music|\/music\//i.test(raw)) return null;
  const abs = (u) => (u ? (u.startsWith('http') ? u : `https://www.tikwm.com${u}`) : null);
  return {
    platform: 'tiktok',
    title: (d.title || '').slice(0, 120) || 'tiktok',
    thumbnail: abs(d.cover || d.origin_cover),
    width: null, height: null,
    durationSec: d.duration || null,
    mediaUrl: abs(raw),
    ext: 'mp4',
    watermark: false,
    mediaHeaders: { 'User-Agent': DESKTOP_UA },
  };
}

// ── Pinterest ──────────────────────────────────────────────────────────────
async function resolvePinterest(url) {
  const id = await pinId(url);
  if (!id) throw new Error('No pude leer el ID del pin.');
  let data = await pinResource(id).catch(() => null);
  if (!data) data = await pinFromHtml(id).catch(() => null);
  if (!data) throw new Error('Pinterest no devolvió datos del pin (privado o eliminado).');
  const best = pickRendition(collectPinRenditions(data));
  if (!best) {
    if (data.embed && data.embed.src) throw new Error('Este pin es un video incrustado de otra plataforma (YouTube/Vimeo).');
    throw new Error('Este pin no tiene video.');
  }
  if (String(best.url).endsWith('.m3u8')) throw new Error('Este pin solo tiene streaming (HLS); aún no lo soportamos.');
  return {
    platform: 'pinterest',
    title: (data.title || data.grid_title || 'pinterest').slice(0, 120),
    thumbnail: best.thumbnail || null,
    width: best.width || null,
    height: best.height || null,
    durationSec: best.duration ? Math.round(best.duration / 1000) : null,
    mediaUrl: best.url,
    ext: 'mp4',
    watermark: false,
    mediaHeaders: { 'User-Agent': DESKTOP_UA, 'Referer': 'https://www.pinterest.com/' },
  };
}

async function pinId(url) {
  const direct = url.match(/\/pin\/(?:[\w-]+--)?(\d+)/);
  if (direct) return direct[1];
  const code = (url.match(/pin\.it\/([^/?#]+)/) || [])[1];
  if (!code) return null;
  const r = await xfetch(`https://api.pinterest.com/url_shortener/${code}/redirect/`, {
    headers: { 'User-Agent': DESKTOP_UA }, redirect: 'manual',
  });
  const loc = r.headers.get('location') || '';
  return (loc.match(/\/pin\/(?:[\w-]+--)?(\d+)/) || [])[1] || null;
}

async function pinResource(id) {
  const data = JSON.stringify({ options: { field_set_key: 'unauth_react_main_pin', id } });
  const qs = new URLSearchParams({ data, source_url: `/pin/${id}/` });
  const r = await xfetch(`https://www.pinterest.com/resource/PinResource/get/?${qs}`, {
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'application/json, text/javascript, */*, q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-PWS-Handler': 'www/[username].js',
      'Referer': `https://www.pinterest.com/pin/${id}/`,
    },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return (j && j.resource_response && j.resource_response.data) || null;
}

async function pinFromHtml(id) {
  const r = await xfetch(`https://www.pinterest.com/pin/${id}/`, { headers: { 'User-Agent': DESKTOP_UA } });
  const html = await r.text();
  const blob = (html.match(/<script id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/) || [])[1]
            || (html.match(/<script id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/) || [])[1];
  if (!blob) return null;
  let j; try { j = JSON.parse(blob); } catch { return null; }
  const pins = (j.initialReduxState && j.initialReduxState.pins)
            || (j.props && j.props.initialReduxState && j.props.initialReduxState.pins) || {};
  return pins[id] || Object.values(pins).find((p) => p && p.id === id) || null;
}

function collectPinRenditions(data) {
  const lists = [];
  if (data.videos && data.videos.video_list) lists.push(data.videos.video_list);
  for (const pg of (data.story_pin_data && data.story_pin_data.pages) || []) {
    for (const bl of (pg.blocks || [])) {
      if (bl.video && bl.video.video_list) lists.push(bl.video.video_list);
    }
  }
  const out = [];
  for (const vl of lists) {
    for (const [key, v] of Object.entries(vl)) {
      if (v && v.url) out.push({ ...v, key });
    }
  }
  return out;
}

function pickRendition(rends) {
  if (!rends.length) return null;
  return rends.sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    if (areaB !== areaA) return areaB - areaA;
    const mp4A = String(a.url).endsWith('.mp4') ? 1 : 0;
    const mp4B = String(b.url).endsWith('.mp4') ? 1 : 0;
    return mp4B - mp4A;
  })[0];
}

// ── Instagram ────────────────────────────────────────────────────────────────
// Instagram bloquea IPs de datacenter (como las de Cloudflare) agresivamente, así
// que probamos DOS rutas directas: (1) media/{pk}/info (la más estable de forma),
// (2) GraphQL PolarisPostRootQuery (doc_id 2026, con CSRF cebado del home). Al
// volumen bajo de una agencia (su propio contenido) esto funciona para posts
// públicos; el doc_id/app_id son sobrescribibles por env porque el doc_id ROTA.
async function resolveInstagram(url, env) {
  const code = await igShortcode(url);
  if (!code) throw new Error('No pude leer el código del reel/post de Instagram.');
  const appId = (env && env.IG_APP_ID) || IG_APP_ID;
  const docId = (env && env.IG_DOC_ID) || IG_DOC_ID;
  const mediaId = igShortcodeToMediaId(code);
  let info = mediaId ? await igViaMediaInfo(mediaId, appId).catch(() => null) : null;
  if (!info || !info.mediaUrl) info = await igViaGraphQL(code, appId, docId).catch(() => null);
  if (!info || !info.mediaUrl) {
    throw new Error('Instagram no devolvió el video. Puede ser una cuenta privada/con edad restringida, o bloqueó al servidor (IP de datacenter). Los links públicos suelen funcionar; reintenta en un momento.');
  }
  return info;
}

async function igShortcode(url) {
  let u = url;
  const direct = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (direct) return direct[1];
  // Share links (/share/...) redirigen al reel/post real.
  if (/instagram\.com\/(?:share|reel\/share)/i.test(u)) {
    const r = await xfetch(u, { redirect: 'manual', headers: { 'User-Agent': DESKTOP_UA } });
    const loc = r.headers.get('location') || '';
    return (loc.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || null;
  }
  return null;
}

function igShortcodeToMediaId(shortcode) {
  const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = 0n;
  for (const ch of shortcode) {
    const idx = AL.indexOf(ch);
    if (idx < 0) return null;
    id = id * 64n + BigInt(idx);
  }
  return id.toString();
}

async function igViaMediaInfo(mediaId, appId) {
  const r = await xfetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
    headers: {
      'User-Agent': 'Instagram 269.0.0.18.75 Android',
      'x-ig-app-id': appId,
      'Accept': 'application/json',
    },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return igPickBest(j && j.items && j.items[0]);
}

async function igPrimeCsrf() {
  try {
    const r = await xfetch('https://www.instagram.com/', { headers: { 'User-Agent': DESKTOP_UA } });
    const sc = (r.headers.get('set-cookie') || '').match(/csrftoken=([^;]+)/);
    return sc ? sc[1] : null;
  } catch { return null; }
}

async function igViaGraphQL(shortcode, appId, docId) {
  const csrf = await igPrimeCsrf();
  const body = new URLSearchParams({
    doc_id: docId,
    variables: JSON.stringify({
      shortcode,
      __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false,
    }),
  });
  const r = await xfetch('https://www.instagram.com/graphql/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-IG-App-ID': appId,
      'X-CSRFToken': csrf || '',
      'X-ASBD-ID': '129477',
      'X-IG-WWW-Claim': '0',
      'Sec-Fetch-Site': 'same-origin',
      'Cookie': csrf ? `csrftoken=${csrf}` : '',
      'User-Agent': DESKTOP_UA,
    },
    body,
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const info = j && j.data && j.data.xdt_api__v1__media__shortcode__web_info;
  return igPickBest(info && info.items && info.items[0]);
}

// Parser compartido del item v1 (media/info y GraphQL devuelven la MISMA forma).
function igPickBest(item) {
  if (!item) return null;
  let node = item;
  if (node.carousel_media && !node.video_versions) {
    node = node.carousel_media.find((m) => m.video_versions) || node.carousel_media[0];
  }
  const vv = (node.video_versions || []).slice().sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
  const best = vv[0];
  if (!best || !best.url) return null;
  const cand = node.image_versions2 && node.image_versions2.candidates && node.image_versions2.candidates[0];
  const caption = (item.caption && item.caption.text) || '';
  return {
    platform: 'instagram',
    title: caption.slice(0, 120) || 'instagram',
    thumbnail: (cand && cand.url) || null,
    width: best.width || null,
    height: best.height || null,
    durationSec: (item.video_duration || node.video_duration) ? Math.round(item.video_duration || node.video_duration) : null,
    mediaUrl: best.url,
    ext: 'mp4',
    watermark: false,
    mediaHeaders: { 'User-Agent': DESKTOP_UA },
  };
}
