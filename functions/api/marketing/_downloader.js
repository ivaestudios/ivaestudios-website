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
//  · Instagram → snapsave.app resuelve desde SUS servidores (Instagram bloquea
//                las IPs de datacenter de Cloudflare); de su respuesta sale la
//                URL CRUDA del CDN de IG. Respaldos: 4 descargadores públicos
//                EN PARALELO (fastdl.to, motor /media ×3, vxinstagram), después
//                GraphQL público, cobalt y, al final, /api/v1/media/{id}/info/
//                con sesión (IG_SESSIONID). Todos entregan la URL cruda del CDN,
//                así que el anti-SSRF NO tuvo que abrirse a ningún host nuevo.
//
// Anti-SSRF: el proxy SOLO baja bytes de hosts de CDN conocidos (MEDIA_HOST_RE);
// la ruta es staff-only. Las URLs del CDN son firmadas y expiran: NUNCA se
// guardan — se re-resuelve al momento de descargar.
// ============================================================================

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';
const IG_DOC_ID = '27128499623469141'; // PolarisPostRootQuery (mediados 2026; ROTA — override por env IG_DOC_ID)

// Hosts a los que el proxy tiene permitido ir a bajar bytes (defensa anti-SSRF).
const MEDIA_HOST_RE = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com|tiktok\.com|byteoversea\.com|akamaized\.net|pinimg\.com|cdninstagram\.com|fbcdn\.net|tikwm\.com|eepy\.today|otomir23\.me|liubquanti\.click)$/i;

// Instancias públicas de cobalt (resolver universal: hacen el fetch desde SUS
// servidores, así que funcionan desde las IPs de datacenter de Cloudflare que
// Instagram bloquea). Se prueban en orden; override/extensión por env COBALT_URL.
const COBALT_INSTANCES = ['https://co.eepy.today/', 'https://co.otomir23.me/'];
// Instancias de cobalt con SESIÓN de IG propia (sin CAPTCHA): sí devuelven el MP4
// de reels "gated" (con login). Se prueban AL FINAL, solo si las de arriba no
// dieron video (p.ej. un reel gated donde solo dan la portada). Son un relay
// gratuito y algo inestable → override/extensión por env COBALT_SESSION_URL.
const COBALT_SESSION_INSTANCES = ['https://api.cobalt.liubquanti.click/'];

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

// Clasifica un item de cobalt (video | image) + su extensión.
function cobaltItem(url, filename, ptype) {
  const f = String(filename || '');
  let ext = (f.match(/\.([a-z0-9]{2,4})(\?|$)/i) || [])[1]
         || (String(url).match(/\.([a-z0-9]{2,4})(\?|$)/i) || [])[1] || '';
  let type = ptype === 'photo' ? 'image' : ptype === 'video' ? 'video' : null;
  if (!type) {
    if (/^(mp4|mov|webm|m4v)$/i.test(ext) || /\.mp4/i.test(url)) type = 'video';
    else if (/^(jpe?g|png|webp|heic|gif)$/i.test(ext)) type = 'image';
    else type = 'video';
  }
  if (!ext) ext = type === 'image' ? 'jpg' : 'mp4';
  return { url, type, ext };
}

// Una llamada a UNA instancia de cobalt → { items:[{url,type,ext}] } | null.
async function cobaltCall(inst, url, platform) {
  let j = null;
  try {
    const r = await xfetch(inst, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, downloadMode: 'auto', videoQuality: 'max' }),
    }, 9000);
    j = await r.json();
  } catch { return null; }
  if (!j) return null;
  const items = [];
  if ((j.status === 'redirect' || j.status === 'tunnel') && j.url) {
    items.push(cobaltItem(j.url, j.filename));
  } else if (j.status === 'picker' && Array.isArray(j.picker)) {
    for (const p of j.picker) if (p && p.url) items.push(cobaltItem(p.url, p.filename, p.type));
  }
  if (!items.length) return null;
  const first = items[0];
  return {
    platform, title: platform, thumbnail: null,
    width: null, height: null, durationSec: null,
    type: first.type, ext: first.ext, mediaUrl: first.url, items,
    // fromTunnel=true → cobalt MUXEA video+audio en su servidor (audio garantizado).
    // Un 'redirect' es una URL cruda del CDN: en Instagram suele ser DASH de SOLO
    // VIDEO (sin audio) → para IG solo confiamos en tunnels.
    fromTunnel: (j.status === 'tunnel'),
    watermark: false, mediaHeaders: mediaHeadersFor(platform),
  };
}

// Resolver universal cobalt: prueba varias instancias. PREFIERE un resultado con
// VIDEO sobre uno de solo-imagen: en un reel "gated" las instancias logged-out
// devuelven solo la PORTADA (imagen), pero la instancia con sesión propia
// (COBALT_SESSION_INSTANCES, sin CAPTCHA) sí devuelve el MP4 — así el video gana
// aunque una instancia rápida ya haya dado la portada. Devuelve el objeto | null.
// `muxedOnly` (para Instagram): solo acepta resultados de VIDEO que vengan de un
// TUNNEL (cobalt muxea → con audio); descarta los 'redirect' (DASH solo-video,
// sin audio). Así IG nunca baja mudo por culpa de cobalt.
async function viaCobalt(url, platform, env, muxedOnly = false) {
  let imageOnly = null;
  const tryInst = async (inst) => {
    const res = await cobaltCall(inst, url, platform);
    if (!res) return null;
    const hasVideo = res.items.some((it) => it.type === 'video');
    if (hasVideo && (!muxedOnly || res.fromTunnel)) return res; // video (y muxeado si se exige)
    if (!imageOnly && res.items.some((it) => it.type === 'image')) imageOnly = res;
    return null;
  };
  // 1) Instancias rápidas (públicas), un intento c/u — cubre reels públicos veloz.
  const fast = [];
  if (env && env.COBALT_URL) fast.push(env.COBALT_URL);
  for (const i of COBALT_INSTANCES) fast.push(i);
  for (const inst of fast) { const v = await tryInst(inst); if (v) return v; }
  // 2) Instancias con sesión (para reels gated) — inestables → hasta 3 intentos c/u.
  const sess = [];
  if (env && env.COBALT_SESSION_URL) sess.push(env.COBALT_SESSION_URL);
  for (const i of COBALT_SESSION_INSTANCES) sess.push(i);
  for (const inst of sess) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const v = await tryInst(inst);
      if (v) return v;
    }
  }
  return imageOnly;
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
  let info;
  if (platform === 'tiktok') info = await resolveTikTok(url, env);
  else if (platform === 'pinterest') info = await resolvePinterest(url, env);
  else if (platform === 'instagram') info = await resolveInstagram(url, env);
  else throw new Error('Pega un link de Instagram, TikTok o Pinterest.');
  // Normaliza a items[] (soporta imagen/carrusel) manteniendo mediaUrl (1er item).
  if (info) {
    if (!info.items || !info.items.length) {
      info.items = [{ url: info.mediaUrl, type: info.type || 'video', ext: info.ext || 'mp4' }];
    }
    info.mediaUrl = info.mediaUrl || (info.items[0] && info.items[0].url);
    info.type = info.type || (info.items[0] && info.items[0].type) || 'video';
    info.ext = info.ext || (info.items[0] && info.items[0].ext) || 'mp4';
  }
  return info;
}

// Sube las dimensiones a un resultado sin ellas (p.ej. de cobalt) enriqueciendo
// desde otra fuente si está disponible; nunca falla.
function enrichDims(info, from) {
  if (info && from && from.width && !info.width) { info.width = from.width; info.height = from.height; }
  if (info && from && from.thumbnail && !info.thumbnail) info.thumbnail = from.thumbnail;
  return info;
}

// ── TikTok ───────────────────────────────────────────────────────────────────
// Se prioriza tikwm: devuelve el CDN MÓVIL (v16m) que NO está protegido por
// Referer/hotlink → sí se puede re-descargar desde el servidor. El playAddr del
// HTML usa el web-CDN (v16-webapp-prime) que 403ea al re-descargar, y en las IPs
// de datacenter de Cloudflare el HTML suele recibir el muro anti-bot; por eso es
// solo respaldo. Se enriquecen las dimensiones desde el HTML cuando se pueda.
async function resolveTikTok(url, env) {
  let info = await tiktokViaTikwm(url).catch(() => null);
  if (info && info.mediaUrl && !info.width) {
    const id = await tiktokId(url);
    const html = id ? await tiktokViaHtml(id).catch(() => null) : null;
    enrichDims(info, html);
  }
  if (!info || !info.mediaUrl) info = await viaCobalt(url, 'tiktok', env).catch(() => null);
  if (!info || !info.mediaUrl) {
    const id = await tiktokId(url);
    info = id ? await tiktokViaHtml(id).catch(() => null) : null;
  }
  if (!info || !info.mediaUrl) {
    throw new Error('TikTok no devolvió el video. Puede ser una publicación de fotos, privado o bloqueado por región. Prueba con el link completo del video.');
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
async function resolvePinterest(url, env) {
  const id = await pinId(url);
  let data = id ? await pinResource(id).catch(() => null) : null;
  if (!data && id) data = await pinFromHtml(id).catch(() => null);
  const best = data ? pickRendition(collectPinRenditions(data)) : null;
  if (best && !String(best.url).endsWith('.m3u8')) {
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
  // Pin de IMAGEN (pedido 2026-08-13 "quiero las fotos literal"): ya no es un
  // error — se cosechan sus fotos en resolución original (cubre pin sencillo,
  // carrusel de pin y story-pins). El front ya sabe pintar items type:'image'.
  const imgs = data ? collectPinImages(data) : [];
  if (imgs.length) {
    return {
      platform: 'pinterest',
      title: (data.title || data.grid_title || 'pinterest').slice(0, 120),
      thumbnail: imgs[0].thumb || imgs[0].url,
      width: imgs[0].width || null,
      height: imgs[0].height || null,
      durationSec: null,
      type: 'image',
      mediaUrl: imgs[0].url,
      ext: 'jpg',
      watermark: false,
      mediaHeaders: { 'User-Agent': DESKTOP_UA, 'Referer': 'https://www.pinterest.com/' },
      items: imgs.map((im) => ({ url: im.url, type: 'image', ext: 'jpg' })),
    };
  }
  // Respaldo cobalt (IPs limpias).
  const cb = await viaCobalt(url, 'pinterest', env).catch(() => null);
  if (cb && cb.mediaUrl) return cb;
  if (data && data.embed && data.embed.src) throw new Error('Este pin es un video incrustado de otra plataforma (YouTube/Vimeo).');
  throw new Error('Este pin no tiene video ni imagen que se pueda bajar.');
}

// Todas las imágenes de un pin, cada una en su mejor resolución + miniatura
// para la cuadrícula. El dict de Pinterest viene como {'236x':{url,w,h},…,
// 'orig':{…}}; si no hay 'orig' se toma la más ancha.
function collectPinImages(data) {
  const out = [];
  const push = (dict) => {
    if (!dict) return;
    const sizes = Object.values(dict).filter((v) => v && v.url);
    const orig = dict.orig || sizes.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (!orig || !orig.url) return;
    const mini = (dict['236x'] || dict['474x'] || orig).url;
    out.push({ url: orig.url, width: orig.width || null, height: orig.height || null, thumb: mini });
  };
  for (const slot of (data.carousel_data && data.carousel_data.carousel_slots) || []) push(slot.images);
  for (const pg of (data.story_pin_data && data.story_pin_data.pages) || []) {
    for (const bl of (pg.blocks || [])) push(bl.image && bl.image.images);
  }
  if (!out.length) push(data.images);
  const seen = new Set();
  return out.filter((x) => !seen.has(x.url) && seen.add(x.url));
}

// ── Pinterest · FOTOS para el Estudio de carruseles ─────────────────────────
// Devuelven la misma forma: [{url, respaldo, thumb, w, h, titulo, pin}].
//
// La búsqueda va por el buscador de imágenes de DuckDuckGo acotado a
// pinterest.com. NO es capricho: la API interna de búsqueda de Pinterest
// (BaseSearchResource) regresa 0 resultados sin sesión (probado 2026-08-13,
// con y sin cookies de invitado + context{}), y la página /search/pins/ ya es
// cascarón client-side sin pines en el HTML. DDG sí responde en servidor y
// entrega los i.pinimg directos. `url` lleva el upgrade /NNNx/ → /originals/
// (probado: 736x 68KB → originals 129KB); si el CDN lo niega, el que baja usa
// `respaldo` (el tamaño que DDG sí vio).

export async function buscarPinterest(query) {
  const q = `${query} site:pinterest.com`;
  // 1) token vqd de la página de búsqueda
  const r1 = await xfetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, {
    headers: { 'User-Agent': DESKTOP_UA },
  });
  const h1 = await r1.text();
  const vqd = (h1.match(/vqd="([^"]+)"/) || h1.match(/vqd=([\d-]+)/) || [])[1];
  if (!vqd) throw new Error('El buscador no respondió. Intenta de nuevo o pega el link de un pin.');
  // 2) resultados de imagen
  const r2 = await xfetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,&p=1`, {
    headers: { 'User-Agent': DESKTOP_UA, 'Referer': 'https://duckduckgo.com/' },
  });
  if (!r2.ok) throw new Error('El buscador no respondió. Intenta de nuevo o pega el link de un pin.');
  const j = await r2.json().catch(() => null);
  const results = (j && j.results) || [];
  const fotos = [];
  const vistos = new Set();
  for (const p of results) {
    const img = String(p.image || '');
    if (!/(^|\.)pinimg\.com$/i.test((() => { try { return new URL(img).hostname; } catch { return ''; } })())) continue;
    const orig = img.replace(/\/\d+x\d*\//, '/originals/');
    if (vistos.has(orig)) continue;
    vistos.add(orig);
    fotos.push({
      url: orig,                       // apuesta a la resolución original
      respaldo: img,                   // lo que el buscador sí vio (existe seguro)
      thumb: p.thumbnail || img,
      w: p.width || null,
      h: p.height || null,
      titulo: String(p.title || '').slice(0, 80),
      pin: /pinterest\./i.test(String(p.url || '')) ? p.url : null,
    });
  }
  if (!fotos.length) throw new Error('La búsqueda no regresó fotos de Pinterest. Prueba otras palabras o pega el link de un pin.');
  return fotos;
}

export async function fotosDePin(url) {
  const id = await pinId(url);
  if (!id) throw new Error('Ese link no parece un pin de Pinterest.');
  let data = await pinResource(id).catch(() => null);
  if (!data) data = await pinFromHtml(id).catch(() => null);
  if (!data) throw new Error('Pinterest no soltó este pin ahora mismo. Intenta de nuevo en unos segundos.');
  const imgs = collectPinImages(data);
  if (!imgs.length) throw new Error('Este pin no trae imagen (¿es un video?).');
  const titulo = String(data.title || data.grid_title || '').slice(0, 80);
  return imgs.map((im) => ({ url: im.url, thumb: im.thumb, w: im.width, h: im.height, titulo, pin: `https://www.pinterest.com/pin/${id}/` }));
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

// ── Instagram · snapsave (vía pública, SIN sesión) ───────────────────────────
// snapsave.app es un descargador público cuyo BACKEND hace el fetch a Instagram
// desde sus propias IPs (las de Cloudflare las bloquea IG), así que resuelve
// reels públicos sin cookie ni sesión. Responde JS OFUSCADO con un "packer"
// casero; adentro viene el botón de descarga a d.rapidcdn.app/v2?token=<JWT> y
// el PAYLOAD de ese JWT lleva la URL CRUDA del CDN de Instagram.
//
// Se usa la URL CRUDA (scontent-*.cdninstagram.com), no el relay de rapidcdn:
//  · ya está permitida por MEDIA_HOST_RE (no hay que abrir el anti-SSRF),
//  · baja sin ningún header especial y sin pasar bytes por un tercero,
//  · el MP4 es idéntico al original (H.264 + AAC muxeado, sin marca de agua).
// La URL viene firmada y CADUCA en horas → jamás se guarda, se re-resuelve.

// Desempaca la respuesta de snapsave SIN eval (Workers prohíbe eval/new Function).
// Los parámetros del packer CAMBIAN en cada petición (verificado: 4 llamadas
// seguidas dieron alfabetos y bases distintas), así que se leen del final del
// script y nunca van fijos. Cola: ("<datos>",u,"<alfabeto n>",t,e,r))
// Cada símbolo son dígitos en base `e` escritos con el alfabeto `n` y separados
// por n[e]; su valor menos `t` es un BYTE UTF-8 del HTML original.
function snapUnpack(js) {
  const m = String(js || '').match(/\("([^"]*)",\s*\d+,\s*"([^"]*)",\s*(\d+),\s*(\d+),\s*\d+\)\)/);
  if (!m) return null; // snapsave cambió de packer → que falle claro y caiga al respaldo
  const h = m[1], n = m[2], t = +m[3], e = +m[4];
  if (!h || !n || !(e > 1) || e >= n.length) return null;
  const delim = n[e];
  const bytes = [];
  for (let i = 0; i < h.length; i++) {
    let s = '';
    while (i < h.length && h[i] !== delim) { s += h[i]; i++; }
    let val = 0;
    for (const ch of s) {
      const d = n.indexOf(ch);
      if (d < 0 || d >= e) return null;
      val = val * e + d;
    }
    bytes.push((val - t) & 0xff);
  }
  try { return new TextDecoder('utf-8').decode(Uint8Array.from(bytes)); } catch { return null; }
}

// Abre el PAYLOAD de un JWT (segmento 2) y devuelve { url, filename } si trae una
// URL. No se valida la firma: el token es del proveedor, no nuestro — sólo nos
// interesa el dato de adentro, y la URL se re-valida contra MEDIA_HOST_RE.
function igJwtDecode(seg) {
  try {
    let b64 = String(seg || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const j = JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return (j && typeof j.url === 'string' && /^https:\/\//.test(j.url)) ? j : null;
  } catch { return null; }
}

// Abre el JWT de d.rapidcdn.app (solo el payload) → { url, filename }: la URL
// cruda del CDN de Instagram.
function snapJwtPayload(link) {
  const tok = String(link || '').match(/[?&]token=[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/);
  return tok ? igJwtDecode(tok[1]) : null;
}

// Los 3 headers de navegador son OBLIGATORIOS: sin Origin/Referer/UA real,
// snapsave está detrás del muro anti-bot de Cloudflare y responde 403.
async function igViaSnapsave(pageUrl) {
  const r = await xfetch('https://snapsave.app/action.php?lang=en', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://snapsave.app',
      'Referer': 'https://snapsave.app/',
      'User-Agent': DESKTOP_UA,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `url=${encodeURIComponent(pageUrl)}`,
  }, 10000); // en vivo responde en <1s; 10s es de sobra y acota el peor caso
  if (!r.ok) return null;
  const decoded = snapUnpack(await r.text());
  if (!decoded) return null;
  // El HTML va escapado dentro del JS (\" y \/) → se normaliza antes de parsear.
  const html = decoded.replace(/\\"/g, '"').replace(/\\\//g, '/');

  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="([^"]*d\.rapidcdn\.app[^"]*)"/g)) {
    const p = snapJwtPayload(m[1]);
    if (!p || seen.has(p.url) || !isAllowedMediaHost(p.url)) continue;
    seen.add(p.url);
    items.push(cobaltItem(p.url, p.filename)); // mismo clasificador (url/type/ext)
  }
  if (!items.length) return null;

  // Portada: <img src="d.rapidcdn.app/thumb?token=..."> → también trae la URL cruda.
  let thumbnail = null;
  const tm = html.match(/<img[^>]+src="([^"]*d\.rapidcdn\.app\/thumb[^"]*)"/);
  const tp = tm ? snapJwtPayload(tm[1]) : null;
  if (tp && isAllowedMediaHost(tp.url)) thumbnail = tp.url;

  const first = items[0];
  return {
    platform: 'instagram',
    title: 'instagram', // snapsave NO devuelve el caption (solo el medio)
    thumbnail,
    width: null, height: null, durationSec: null,
    type: first.type, ext: first.ext, mediaUrl: first.url, items,
    watermark: false,
    mediaHeaders: mediaHeadersFor('instagram'),
  };
}

// ── Instagram · respaldos públicos (4 proveedores, 1 solo decoder) ───────────
// Verificados en vivo 2026-07-27 contra un reel público Y uno age-restricted:
// los 4 devolvieron el MISMO MP4 byte a byte (2 497 065 B / 1 527 913 B, h264 +
// AAC), o sea que ninguno recomprime: todos resuelven al original de Instagram.
//
// Los 4 comparten el MISMO formato de salida: en algún lado de su respuesta hay
// un enlace `...?token=<JWT>` cuyo PAYLOAD lleva { url, filename }, y esa `url`
// es la URL CRUDA de scontent-*.cdninstagram.com. Por eso:
//  · NO hubo que tocar MEDIA_HOST_RE (cdninstagram.com ya estaba permitido) —
//    nunca bajamos bytes del host del proveedor, sólo le pedimos que resuelva;
//  · un solo decoder (igJwtItems) sirve para los 4.
// Igual que en snapsave, la URL viene firmada y CADUCA en horas → no se guarda.
function igJwtItems(text) {
  const items = [];
  const seen = new Set();
  // El JWT es base64url, así que NO le afectan los escapes (\xNN de un motor,
  // \" de otro): se puede sacar del cuerpo crudo sin desescapar nada.
  for (const m of String(text || '').matchAll(/[?&]token=[A-Za-z0-9_-]+\.([A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]+/g)) {
    const p = igJwtDecode(m[1]);
    if (!p || seen.has(p.url) || !isAllowedMediaHost(p.url)) continue; // anti-SSRF
    seen.add(p.url);
    items.push(cobaltItem(p.url, p.filename)); // mismo clasificador (url/type/ext)
  }
  return items;
}

// Arma el objeto de respuesta a partir de los items de un respaldo. OJO: en estos
// proveedores la MINIATURA (.jpg) suele venir ANTES que el video en el HTML, así
// que no se puede tomar items[0] a ciegas — se separan videos de imágenes y la
// primera imagen se aprovecha como portada.
function igItemsToInfo(items) {
  const vids = (items || []).filter((it) => it.type === 'video');
  const imgs = (items || []).filter((it) => it.type === 'image');
  const use = vids.length ? vids : imgs; // sin video = post de fotos (carrusel)
  if (!use.length) return null;
  const first = use[0];
  return {
    platform: 'instagram',
    title: 'instagram', // ningún respaldo devuelve el caption
    thumbnail: (vids.length && imgs.length) ? imgs[0].url : null,
    width: null, height: null, durationSec: null,
    type: first.type, ext: first.ext, mediaUrl: first.url, items: use,
    watermark: false,
    mediaHeaders: mediaHeadersFor('instagram'),
  };
}

// Respaldo · fastdl.to — motor "ajaxSearch/snapcdn". El más rápido y limpio:
// responde JSON de verdad ({status:"ok", data:"<html>"}), sin ofuscación.
async function igViaFastdl(canon) {
  const r = await xfetch('https://fastdl.to/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://fastdl.to',
      'Referer': 'https://fastdl.to/en',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': DESKTOP_UA,
      'Accept': '*/*',
    },
    body: `q=${encodeURIComponent(canon)}&t=media&lang=en`,
  }, 7000);
  if (!r.ok) return null;
  return igItemsToInfo(igJwtItems(await r.text()));
}

// Respaldo · motor "/media" (downloadgram.app / instasave.website /
// downloadgram.org son TRES FRENTES DEL MISMO BACKEND: mismo contrato, mismo
// decoder, sólo cambia host/Origin/Referer). Responde JS con los datos escapados
// en \xNN — no hace falta desescaparlo porque el JWT es base64url puro.
// Se mantienen los 3 dominios a propósito: comparten software pero tienen IP y
// CUOTA DE RATE-LIMIT INDEPENDIENTES (tira 429 a la ~4ª petición en ráfaga y se
// repone en segundos), así que uno cubre al otro cuando el 429 aparece.
async function igViaMediaEngine(host, origin, canon) {
  const r = await xfetch(`https://${host}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': origin,
      'Referer': `${origin}/`,
      'User-Agent': DESKTOP_UA,
      'Accept': '*/*',
    },
    body: `url=${encodeURIComponent(canon)}`,
  }, 7000);
  if (!r.ok) return null; // un 429 aquí simplemente deja ganar a otro proveedor
  return igItemsToInfo(igJwtItems(await r.text()));
}

// Respaldo · vxinstagram.com — el contrato más barato de todos: UN GET que
// responde 302 y trae el JWT (de rapidcdn, el mismo de snapsave) en el header
// Location; no se sigue la redirección, sólo se lee. Sirve SÓLO para reels:
// /offload/<code>/0.mp4 entrega un único medio (el índice 0), así que en un
// carrusel devolvería incompleto → se llama nada más cuando el link es un reel.
async function igViaVxinstagram(code) {
  const r = await xfetch(`https://vxinstagram.com/offload/${encodeURIComponent(code)}/0.mp4`, {
    redirect: 'manual',
    headers: { 'User-Agent': DESKTOP_UA },
  }, 7000);
  return igItemsToInfo(igJwtItems(r.headers.get('location') || ''));
}

// Corre TODOS los respaldos EN PARALELO y se queda con el primero que entregue
// VIDEO. En serie serían ~5 × 7 s = 35 s de peor caso y la vista previa es
// síncrona; en paralelo el peor caso es UN timeout (~7 s) y el caso normal es el
// más rápido de los cinco (~0,4-0,9 s medidos). Como los 5 devuelven el MISMO
// archivo, no se pierde calidad por dejar que gane el más veloz.
// Un resultado de SÓLO IMAGEN (post de fotos) se guarda aparte y sólo se usa si
// ninguno dio video — así un carrusel de fotos sigue funcionando.
async function igViaRespaldos(canon, code, isReel) {
  const provs = [
    () => igViaFastdl(canon),
    () => igViaMediaEngine('api.downloadgram.app', 'https://www.downloadgram.app', canon),
    () => igViaMediaEngine('api.instasave.website', 'https://instasave.website', canon),
    () => igViaMediaEngine('api.downloadgram.org', 'https://downloadgram.org', canon),
  ];
  if (isReel) provs.push(() => igViaVxinstagram(code));

  let imageOnly = null;
  const carrera = provs.map((fn) => (async () => {
    const info = await fn().catch(() => null); // proveedor caído/lento = no rompe
    if (!info || !info.mediaUrl) throw new Error('sin resultado');
    if (info.type === 'video') return info;
    if (!imageOnly) imageOnly = info;
    throw new Error('solo imagen'); // no gana la carrera, pero queda de reserva
  })());
  // Promise.any = el primero que CUMPLE; sólo rechaza si fallan todos.
  try { return await Promise.any(carrera); } catch { return imageOnly; }
}

// ── Instagram ────────────────────────────────────────────────────────────────
// Instagram bloquea IPs de datacenter (como las de Cloudflare) agresivamente y
// desde 2026-07 el GraphQL público responde "execution error" con cualquier
// doc_id. Por eso se prueban CINCO estrategias en orden de fiabilidad medida:
//   1) snapsave  — resuelve desde SUS IPs. Verificada en vivo 2026-07-27.
//   2) RESPALDOS PÚBLICOS en paralelo (fastdl.to + motor /media ×3 +
//      vxinstagram): 4 operadores distintos, los 4 sacaron también el reel
//      age-restricted en pruebas y todos entregan la URL CRUDA del CDN de IG.
//   3) GraphQL público — sigue aquí porque es la ÚNICA que trae caption/portada
//      /dimensiones (el conector MCP las usa) y por si IG lo vuelve a abrir.
//   4) cobalt SOLO-MUXEADO — relay universal, nunca su 'redirect' (sería mudo).
//   5) sesión IG_SESSIONID — último recurso; es lo único que saca reels gated.
// doc_id/app_id son sobrescribibles por env porque el doc_id ROTA.
async function resolveInstagram(url, env) {
  const code = await igShortcode(url);
  if (!code) throw new Error('No pude leer el código del reel/post de Instagram.');
  const appId = (env && env.IG_APP_ID) || IG_APP_ID;
  const docId = (env && env.IG_DOC_ID) || IG_DOC_ID;
  const sid = (env && env.IG_SESSIONID) || null; // sesión de IG (secreto): saca gated/privado
  const mediaId = igShortcodeToMediaId(code);
  // URL canónica para los resolvedores de terceros: se conserva el tipo de link
  // (reel vs p) porque un carrusel de fotos NO existe bajo /reel/.
  const kind = /\/(?:reel|reels|tv)\//i.test(url) ? 'reel' : 'p';
  const canon = `https://www.instagram.com/${kind}/${code}/`;

  // 1) snapsave — 2 intentos: su muro anti-bot puede tirar un 403 aislado.
  for (let i = 0; i < 2; i++) {
    const s = await igViaSnapsave(canon).catch(() => null);
    if (s && s.mediaUrl) return s;
    if (i === 0) await new Promise((r) => setTimeout(r, 400));
  }

  // 2) RESPALDOS PÚBLICOS, todos a la vez. Van AQUÍ (antes de GraphQL/cobalt)
  // porque están verificados en vivo y resuelven en menos de 1 s, mientras que
  // GraphQL hoy está cerrado y cobalt es el eslabón más lento de la cadena.
  const bk = await igViaRespaldos(canon, code, kind === 'reel').catch(() => null);
  if (bk && bk.mediaUrl) return bk;

  // 3) GraphQL público (sin sesión). Trae el MP4 progresivo con AUDIO muxeado
  // MÁS el caption/portada; si algún día revive, gana en calidad de metadatos.
  // UN solo intento: hoy IG lo tiene cerrado (responde "execution error" con
  // cualquier doc_id), así que reintentar sólo alarga la espera del usuario.
  const g = await igViaGraphQL(code, appId, docId, null).catch(() => null);
  if (g && g.mediaUrl) return g;

  // 4) Respaldo cobalt SOLO-MUXEADO: únicamente se acepta un TUNNEL de cobalt
  // (video+audio); NUNCA su 'redirect' de IG (DASH solo-video, sin audio). Es
  // preferible fallar y pedir reintentar que entregar un video MUDO.
  const cb = await viaCobalt(url, 'instagram', env, true).catch(() => null);
  if (cb && cb.items && cb.items.length) return cb;

  // 5) ÚLTIMO RECURSO — sesión propia de IG. Sin sesión, media-info devuelve
  // login_required (inútil), así que sólo se intenta cuando el secreto existe.
  if (sid) {
    for (let i = 0; i < 2; i++) {
      let info = mediaId ? await igViaMediaInfo(mediaId, appId, sid).catch(() => null) : null;
      if (!info || !info.mediaUrl) info = await igViaGraphQL(code, appId, docId, sid).catch(() => null);
      if (info && info.mediaUrl) return info;
      if (i === 0) await new Promise((r) => setTimeout(r, 350));
    }
  }

  throw new Error(sid
    ? 'Instagram no soltó el video en este momento (ni con la sesión). Espera unos segundos y dale Descargar de nuevo.'
    : 'No pude bajar este video de Instagram ahora mismo. Vuelve a intentar en unos segundos; si sigue fallando puede ser un reel privado o restringido (ésos necesitan el secreto IG_SESSIONID en Cloudflare). TikTok y Pinterest siguen funcionando normal.');
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

async function igViaMediaInfo(mediaId, appId, sid) {
  const headers = {
    'User-Agent': 'Instagram 269.0.0.18.75 Android',
    'x-ig-app-id': appId,
    'Accept': 'application/json',
  };
  if (sid) headers['Cookie'] = `sessionid=${sid}`;
  const r = await xfetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, { headers });
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

async function igViaGraphQL(shortcode, appId, docId, sid) {
  const csrf = await igPrimeCsrf();
  const body = new URLSearchParams({
    doc_id: docId,
    variables: JSON.stringify({
      shortcode,
      __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false,
    }),
  });
  const cookie = [csrf ? `csrftoken=${csrf}` : '', sid ? `sessionid=${sid}` : ''].filter(Boolean).join('; ');
  const r = await xfetch('https://www.instagram.com/graphql/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-IG-App-ID': appId,
      'X-CSRFToken': csrf || '',
      'X-ASBD-ID': '129477',
      'X-IG-WWW-Claim': '0',
      'Sec-Fetch-Site': 'same-origin',
      'Cookie': cookie,
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
