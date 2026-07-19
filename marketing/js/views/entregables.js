// ============================================================================
// IVAE Marketing — Vista "Entregables" (contenido final para el cliente).
// El equipo (staff) sube REELS (arrastrar/soltar -> R2, calidad original) y
// agrega CARRUSELES por link. El CLIENTE de la marca ve cada reel con
// reproductor + boton Descargar, y los carruseles como boton "Ver carrusel"
// (abre el link, nunca el link crudo). Todo agrupado por mes.
// Backend: GET/POST /deliverables · POST/GET /deliverables/:id/video · DELETE.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202607182156';
import { icon } from '../shell/icons.js?v=202607182156';
import { T } from '../shell/i18n.js?v=202607182156';

const VIEW_ID = 'entregables';
const MAX_VIDEO_MB = 3000;             // tope de cordura (~3GB); el video se sube por partes
const CHUNK_BYTES = 50 * 1024 * 1024;  // ~50MB por parte (bajo el limite de 100MB/request del Worker)
const UP_LANES = 3;                    // partes subiendo a la vez (paraleliza la subida)
const MES = T(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

// Reconoce videos por MIME O por extensión: muchos .mov/.mkv/.hevc llegan con
// file.type VACÍO (iPhone, cámaras, archivos copiados) y NO deben descartarse
// — esa era la causa de "subí 9 y solo entraron 7".
const VIDEO_EXTS = ['mp4', 'm4v', 'mov', 'qt', 'webm', 'mkv', 'avi', '3gp', '3g2', 'mpg', 'mpeg', 'ogv', 'wmv', 'flv', 'ts', 'mts', 'm2ts', 'hevc'];
const EXT_MIME = {
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', qt: 'video/quicktime',
  webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2', mpg: 'video/mpeg', mpeg: 'video/mpeg', ogv: 'video/ogg',
  wmv: 'video/x-ms-wmv', flv: 'video/x-flv', ts: 'video/mp2t', mts: 'video/mp2t',
  m2ts: 'video/mp2t', hevc: 'video/mp4',
};
function fileExt(name) { const m = /\.([^.]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
function isVideoFile(f) {
  if (f && typeof f.type === 'string' && f.type.startsWith('video/')) return true;
  return VIDEO_EXTS.includes(fileExt(f && f.name));
}
function guessMime(f) {
  if (f && typeof f.type === 'string' && f.type.startsWith('video/')) return f.type;
  return EXT_MIME[fileExt(f && f.name)] || 'video/mp4';
}

let ctx = null;
let rootEl = null;
let unsubs = [];
let items = [];
let loading = false;
let busy = false;
let addMonth = '';          // 'YYYY-MM' al que se agregan nuevos entregables
let lastClientId = null;
let uploadPct = 0;          // progreso de subida (0-100)
let progressEls = null;     // refs vivos de la barra (se actualizan sin re-render)
let queueInfo = null;       // { index, total } al subir varios reels en fila
let activeMonthNav = '';    // 'YYYY-MM' del mes visible (navegación por píldoras)
let dlAllBusy = false;      // "Descargar todos" en curso (evita dobles arranques)
const dlAllCache = new Map(); // mes -> File[] ya bajados (móvil: el 2º toque comparte al instante)

// ── Carga perezosa de videos (velocidad en móvil) ───────────────────────────
// Antes: CADA reel del mes creaba un <video preload="metadata"> que disparaba
// descargas de metadatos EN PARALELO (decenas de MB compitiendo) → los primeros
// videos tardaban. Ahora nacen con preload="none" (0 bytes de video) + póster;
// solo se "activan" (cargan metadatos / primer frame) al acercarse al viewport.
// El archivo COMPLETO se transmite intacto al reproducir — no se pierde calidad.
let vidObserver = null;
function activateVideo(v) {
  if (!v || v.dataset.activated) return;
  v.dataset.activated = '1';
  // Si el usuario ya lo abrió/reproduce, NO tocar (load() lo reiniciaría).
  if (v.readyState >= 1 || !v.paused || v.currentTime > 0) return;
  v.preload = 'metadata';
  // Sin póster: pedir el primer frame como vista previa (#t=0.1).
  if (!v.getAttribute('poster') && v.src && !/#t=/.test(v.src)) {
    try { v.src = `${v.src}#t=0.1`; } catch { /* noop */ } }
  try { v.load(); } catch { /* noop */ }
}
function observeVideo(v) {
  if (!('IntersectionObserver' in window)) { activateVideo(v); return; }
  if (!vidObserver) {
    vidObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { activateVideo(e.target); vidObserver.unobserve(e.target); }
      }
    }, { rootMargin: '200% 0px' });
  }
  vidObserver.observe(v);
}
function resetVideoObserver() {
  if (vidObserver) { try { vidObserver.disconnect(); } catch { /* noop */ } vidObserver = null; }
}

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function monthLabel(ym) { const [y, m] = String(ym).split('-').map(Number); return `${(MES[(m || 1) - 1] || '').toUpperCase()} ${y}`; }
// "Julio 2026" (para las píldoras de la barra de meses; el encabezado usa MAYÚSCULAS).
function monthTitle(ym) { const [y, m] = String(ym).split('-').map(Number); const n = MES[(m || 1) - 1] || ''; return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`; }

function activeClient() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: T('Marca', 'Brand') };
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/entregables.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/entregables.css?v=202607182156';
  document.head.appendChild(link);
}

async function load() {
  const client = activeClient();
  dlAllCache.clear(); // los archivos armados de "Descargar todos" caducan al recargar la lista
  if (!client) { items = []; render(); return; }
  loading = true; render();
  try {
    const res = await api.get(`/deliverables?client_id=${encodeURIComponent(client.id)}`);
    items = (res && res.deliverables) || [];
  } catch (e) {
    items = [];
    toast(e.message || T('No se pudieron cargar los entregables', 'Could not load the deliverables'), 'error');
  }
  loading = false;
  render();
}

// ── Acciones (staff) ─────────────────────────────────────────────────────────
// Actualiza la barra de progreso en vivo (sin re-render, para no perder fluidez).
function updateProgressUI() {
  if (!progressEls) return;
  progressEls.fill.style.width = uploadPct + '%';
  const q = (queueInfo && queueInfo.total > 1) ? `(${queueInfo.index}/${queueInfo.total}) ` : '';
  progressEls.label.textContent = uploadPct >= 100 ? `${q}${T('Procesando…', 'Processing…')}` : `${q}${T('Subiendo…', 'Uploading…')} ${uploadPct}%`;
}

// Sube UNA parte con XMLHttpRequest (fetch no expone progreso de subida).
function xhrPutPart(id, uploadId, ext, partNumber, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = `uploadId=${encodeURIComponent(uploadId)}&ext=${encodeURIComponent(ext)}&part=${partNumber}`;
    xhr.open('PUT', `/api/marketing/deliverables/${id}/video/multipart/part?${qs}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error(T('Respuesta inválida del servidor.', 'Invalid server response.'))); }
      } else {
        let m = T('Error al subir una parte del video.', 'Error uploading a part of the video.');
        try { m = JSON.parse(xhr.responseText).error || m; } catch { /* noop */ }
        reject(new Error(m));
      }
    };
    xhr.onerror = () => reject(new Error(T('Se cortó la conexión durante la subida.', 'The connection dropped during the upload.')));
    xhr.send(blob);
  });
}

// Sube UNA parte con reintentos (cubre cortes/blips de red sin perder el archivo).
// Hasta 4 intentos con espera creciente (0.8s, 1.6s, 2.4s) antes de rendirse.
async function putPartWithRetry(id, uploadId, ext, partNumber, blob, onProgress, attempts = 4) {
  let lastErr;
  for (let a = 0; a < attempts; a++) {
    try { return await xhrPutPart(id, uploadId, ext, partNumber, blob, onProgress); }
    catch (e) {
      lastErr = e;
      if (a < attempts - 1) await new Promise((res) => setTimeout(res, 800 * (a + 1)));
    }
  }
  throw lastErr;
}

// Captura un cuadro del video (en el cliente) como miniatura JPEG. Best-effort:
// si falla (p.ej. iOS al subir), devuelve null y la tarjeta usa el 1er cuadro.
function generatePoster(file) {
  return new Promise((resolve) => {
    let done = false; let url;
    const finish = (v) => { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch { /* noop */ } resolve(v); };
    try {
      const v = document.createElement('video');
      url = URL.createObjectURL(file);
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.onloadeddata = () => { const t = Math.min(0.6, (v.duration || 1) / 3); try { v.currentTime = (isFinite(t) && t > 0) ? t : 0; } catch { finish(null); } };
      v.onseeked = () => {
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) return finish(null);
          const scale = Math.min(1, 720 / Math.max(w, h));
          const cw = Math.round(w * scale), ch = Math.round(h * scale);
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(v, 0, 0, cw, ch);
          c.toBlob((b) => finish(b), 'image/jpeg', 0.72);
        } catch { finish(null); }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000); // timeout de seguridad
    } catch { finish(null); }
  });
}

// COLA de subida. Todo lo que arrastres o elijas se ENCOLA y se sube uno tras otro
// (encolar, no paralelizar, evita saturar la conexión). Si sueltas/eliges MÁS mientras
// otra subida sigue en curso, se AGREGAN a la fila en vez de ignorarse — así funciona
// igual si arrastras varios de golpe o de uno en uno.
let uploadQueue = [];   // Files pendientes de subir
let draining = false;   // hay un drenado de la cola en curso

function enqueueReels(fileList) {
  const all = [...(fileList || [])];
  const vids = all.filter(isVideoFile);
  const skipped = all.length - vids.length;
  if (!vids.length) { toast(T('Ninguno de esos archivos es un video.', 'None of those files is a video.'), 'error'); return; }
  uploadQueue.push(...vids);
  if (skipped > 0) toast(T(`${skipped} no ${skipped > 1 ? 'eran' : 'era'} video y se ${skipped > 1 ? 'omitieron' : 'omitió'}.`, `${skipped} ${skipped > 1 ? 'were not videos and were skipped' : 'was not a video and was skipped'}.`), 'info', 4000);
  if (draining) { toast(`+${vids.length} ${T('en la fila', 'in the queue')}`, 'info', 2500); return; } // ya hay subida en curso: solo encola
  drainQueue();
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  let processed = 0; const failedNames = [];
  try {
    while (uploadQueue.length) {
      const file = uploadQueue.shift();
      processed += 1;
      const qinfo = { index: processed, total: processed + uploadQueue.length };
      // try/catch propio: un throw NUNCA debe abandonar el resto de la fila.
      let ok = false;
      try { ok = await uploadReel(file, qinfo); } catch { ok = false; }
      // Reintento automático del archivo completo (cubre fallos transitorios). uploadReel
      // borra el registro huérfano al fallar, así que el reintento arranca limpio (sin duplicar).
      if (!ok) { try { ok = await uploadReel(file, qinfo); } catch { ok = false; } }
      if (!ok) failedNames.push(file.name);
    }
  } finally {
    draining = false; queueInfo = null;
    if (processed > 1) { try { await load(); } catch { /* recarga best-effort */ } }
    if (failedNames.length) {
      const n = failedNames.length;
      toast(T(`${n === 1 ? '1 reel no se subió' : `${n} reels no se subieron`}: ${failedNames.join(', ')}. Vuelve a soltarlos para reintentar.`, `${n === 1 ? '1 reel failed to upload' : `${n} reels failed to upload`}: ${failedNames.join(', ')}. Drop them again to retry.`), 'error', 9000);
    }
  }
}

// Sube un video (File/Blob) a un deliverable EXISTENTE por partes en paralelo.
// Reutilizado por la subida normal y por "Optimizar para Meta". onProgress(pct 0-100).
async function multipartUpload(deliverableId, src, onProgress) {
  const start = await api.post(`/deliverables/${deliverableId}/video/multipart/start`, { mime: guessMime(src) });
  const { uploadId, ext } = start;
  const total = src.size;
  const numParts = Math.max(1, Math.ceil(total / CHUNK_BYTES));
  const doneParts = new Array(numParts);
  const partLoaded = new Array(numParts).fill(0);
  const bump = () => {
    const sum = partLoaded.reduce((a, b) => a + b, 0);
    if (onProgress) onProgress(Math.min(99, Math.round((sum / total) * 100)));
  };
  let nextPart = 0; let aborted = false;
  const worker = async () => {
    while (!aborted) {
      const i = nextPart++;
      if (i >= numParts) return;
      const from = i * CHUNK_BYTES;
      const blob = src.slice(from, Math.min(from + CHUNK_BYTES, total));
      let r;
      try { r = await putPartWithRetry(deliverableId, uploadId, ext, i + 1, blob, (n) => { partLoaded[i] = n; bump(); }); }
      catch (e) { aborted = true; throw e; }
      partLoaded[i] = blob.size; bump();
      doneParts[i] = { partNumber: i + 1, etag: r.etag };
    }
  };
  await Promise.all(Array.from({ length: Math.min(UP_LANES, numParts) }, worker));
  await api.post(`/deliverables/${deliverableId}/video/multipart/complete`, { uploadId, ext, parts: doneParts });
  if (onProgress) onProgress(100);
}

async function uploadReel(file, qinfo) {
  const client = activeClient();
  if (!client || busy) return false;
  if (!isVideoFile(file)) { toast(T(`"${file.name}" no es un video.`, `"${file.name}" is not a video.`), 'error'); return false; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast(T(`"${file.name}" es enorme (más de 3 GB). Compártelo por link mejor.`, `"${file.name}" is huge (over 3 GB). Better share it by link.`), 'error', 6000); return false; }
  busy = true; uploadPct = 0; queueInfo = qinfo || null; render();
  let created = null;
  const month = addMonth || currentMonth();
  try {
    created = await api.post('/deliverables', {
      client_id: client.id, month, type: 'reel',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    // Subir por partes (~50MB) en paralelo -> mantiene la conexión llena.
    await multipartUpload(created.id, file, (p) => { uploadPct = p; updateProgressUI(); });
    uploadPct = 100; updateProgressUI();
    // Miniatura (best-effort): capturar un cuadro del video.
    try {
      const posterBlob = await generatePoster(file);
      if (posterBlob) {
        const pf = new FormData(); pf.append('poster', posterBlob, 'poster.jpg');
        await fetch(`/api/marketing/deliverables/${created.id}/poster`, { method: 'POST', credentials: 'same-origin', body: pf });
      }
    } catch { /* sin poster: la tarjeta usa el primer cuadro del video */ }
    toast((queueInfo && queueInfo.total > 1) ? `${T('Subido', 'Uploaded')} ${queueInfo.index}/${queueInfo.total} ✓` : T('Reel subido ✓', 'Reel uploaded ✓'), 'success');
    activeMonthNav = month; // al subir, la vista te lleva al mes donde quedó el reel
    if (!qinfo || qinfo.total <= 1) await load(); // en lote, drainQueue recarga 1 sola vez al final
    return true;
  } catch (e) {
    if (created) { try { await api.del(`/deliverables/${created.id}`); } catch { /* limpia el registro huerfano */ } }
    toast(e.message || T('No se pudo subir el reel', 'Could not upload the reel'), 'error');
    return false;
  } finally {
    busy = false; uploadPct = 0; progressEls = null; render();
  }
}

// Devuelve true SOLO si el carrusel quedó guardado: el botón limpia las
// casillas únicamente en ese caso (si falla, lo tecleado se conserva).
async function addCarrusel(link, title) {
  const client = activeClient();
  if (!client || busy) return false;
  let url = String(link || '').trim();
  if (!url) { toast(T('Pega el link del carrusel.', 'Paste the carousel link.'), 'error'); return false; }
  // Un link real SIEMPRE lleva un punto en el dominio (canva.link, instagram.com,
  // drive.google.com…). Si NO trae protocolo NI punto, casi seguro es el título
  // escrito en la casilla equivocada (ej. "CARRUSELES") -> avisamos claro en vez de
  // guardar un enlace roto como "https://CARRUSELES".
  const hasProto = /^https?:\/\//i.test(url);
  if (!hasProto && !/[^\s]\.[^\s]/.test(url)) {
    toast(T('Eso no parece un link. Aquí va el ENLACE (ej. canva.link/…); el nombre va en la casilla "Título".', 'That doesn\'t look like a link. The LINK goes here (e.g. canva.link/…); the name goes in the "Title" box.'), 'error', 7000);
    return false;
  }
  if (!hasProto) url = 'https://' + url.replace(/^\/+/, '');
  // Validación final con el parser de URL: el dominio debe tener un punto, o no se guarda.
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) throw 0;
    url = u.href;
  } catch {
    toast(T('Ese enlace no es válido. Revisa que sea un link completo (ej. https://canva.link/…).', 'That link is not valid. Make sure it\'s a full link (e.g. https://canva.link/…).'), 'error', 7000);
    return false;
  }
  busy = true; render();
  const month = addMonth || currentMonth();
  try {
    await api.post('/deliverables', {
      client_id: client.id, month, type: 'carrusel',
      link: url, title: (title || '').trim().slice(0, 200) || null,
    });
    toast(T('Carrusel agregado ✓', 'Carousel added ✓'), 'success');
    activeMonthNav = month; // al agregar, la vista te lleva a ese mes
    await load();
    return true;
  } catch (e) {
    toast(e.message || T('No se pudo agregar el carrusel', 'Could not add the carousel'), 'error');
    return false;
  } finally {
    busy = false; render();
  }
}

async function removeItem(it) {
  if (busy) return;
  const what = it.type === 'reel' ? T('este reel', 'this reel') : T('este carrusel', 'this carousel');
  if (!window.confirm(T(`¿Eliminar ${what}? No se puede deshacer.`, `Delete ${what}? This cannot be undone.`))) return;
  busy = true; render();
  try {
    await api.del(`/deliverables/${it.id}`);
    items = items.filter((x) => x.id !== it.id);
    toast(T('Eliminado', 'Deleted'), 'info');
  } catch (e) {
    toast(e.message || T('No se pudo eliminar', 'Could not delete'), 'error');
  } finally {
    busy = false; render();
  }
}

// Descargar/guardar un reel. En MÓVIL usa el menú nativo de Compartir
// (navigator.share con archivo) -> el usuario toca "Guardar video" (iOS Fotos)
// o "Guardar en Archivos". En ESCRITORIO descarga directa por enlace.
const TYPE_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg', 'video/3gpp': '3gp' };
const fileCache = new Map(); // it.id -> File ya en memoria (para 2º toque instantáneo en iOS Safari)

function linkDownload(it) {
  const a = document.createElement('a');
  a.href = it.video_url + '?download=1';
  a.download = String(it.title || 'reel');
  document.body.appendChild(a); a.click(); a.remove();
}

// Descarga UN tramo (Range) como ArrayBuffer.
const DL_LANES = 3;                 // tramos bajando a la vez
const DL_CHUNK = 8 * 1024 * 1024;   // 8MB por tramo
function fetchRange(url, start, end, onLoaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.withCredentials = true;
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
    xhr.onprogress = (e) => { if (onLoaded) onLoaded(e.loaded); };
    xhr.onload = () => {
      if (xhr.status === 206 || xhr.status === 200) resolve({ buf: xhr.response, status: xhr.status, xhr });
      else reject(new Error(T('No se pudo descargar el video.', 'Could not download the video.')));
    };
    xhr.onerror = () => reject(new Error(T('Se cortó la conexión al descargar.', 'The connection dropped while downloading.')));
    xhr.send();
  });
}

// Descarga el video como Blob con progreso. Baja en VARIOS TRAMOS en paralelo y los
// rearma -> más rápido que una sola descarga (que se estanca). Si el servidor no
// soporta rangos (200) o el archivo es chico, cae a una sola descarga. onProgress(pct).
async function fetchVideoBlob(it, onProgress) {
  const url = it.video_url;
  // 1) primer tramo: trae el inicio y revela tamaño total + soporte de rangos.
  const first = await fetchRange(url, 0, DL_CHUNK - 1);
  const ctype = first.xhr.getResponseHeader('Content-Type') || 'video/mp4';
  const cr = first.xhr.getResponseHeader('Content-Range') || '';
  const m = cr.match(/\/(\d+)\s*$/);
  const total = (first.status === 206 && m) ? Number(m[1]) : 0;
  if (first.status !== 206 || !total || total <= first.buf.byteLength) {
    if (onProgress) onProgress(100);
    return new Blob([first.buf], { type: ctype }); // sin rangos o archivo chico: ya está todo
  }
  // 2) bajar el resto en paralelo (hasta DL_LANES tramos a la vez) y rearmar en orden.
  const numChunks = Math.ceil(total / DL_CHUNK);
  const buffers = new Array(numChunks); buffers[0] = first.buf;
  const loaded = new Array(numChunks).fill(0); loaded[0] = first.buf.byteLength;
  const bump = () => { if (onProgress) onProgress(Math.min(99, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100))); };
  bump();
  let next = 1; let aborted = false;
  const worker = async () => {
    while (!aborted) {
      const i = next++;
      if (i >= numChunks) return;
      const start = i * DL_CHUNK;
      const end = Math.min(start + DL_CHUNK, total) - 1;
      let res;
      try { res = await fetchRange(url, start, end, (n) => { loaded[i] = n; bump(); }); }
      catch (e) { aborted = true; throw e; }
      buffers[i] = res.buf; loaded[i] = (end - start + 1); bump();
    }
  };
  await Promise.all(Array.from({ length: Math.min(DL_LANES, numChunks - 1) }, worker));
  if (onProgress) onProgress(100);
  return new Blob(buffers, { type: ctype });
}
function fileFromBlob(it, blob) {
  const ext = TYPE_EXT[String(blob.type || '').toLowerCase()] || 'mp4';
  const fname = (String(it.title || 'reel').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'reel') + '.' + ext;
  return new File([blob], fname, { type: blob.type || 'video/mp4' });
}

// ¿Es un teléfono/tablet donde "Compartir → Guardar video/Guardar en Archivos" es el
// flujo natural (iPhone/iPad/Android)? En ESCRITORIO (Mac/PC) el menú de Compartir NO
// sirve para bajar a la compu (solo ofrece AirDrop, Mail, Mensajes…), así que ahí
// descargamos el archivo DIRECTO al equipo.
function isMobileSave() {
  const ua = navigator.userAgent || '';
  const uaMobile = /iPhone|iPod|Android/i.test(ua)
    || (navigator.userAgentData && navigator.userAgentData.mobile === true);
  const touch = (navigator.maxTouchPoints || 0) > 1;
  const iPadOnMac = /Macintosh/.test(ua) && touch; // iPadOS se hace pasar por Mac
  const coarseOnly = !!(window.matchMedia
    && window.matchMedia('(pointer: coarse)').matches
    && !window.matchMedia('(pointer: fine)').matches);
  return !!(uaMobile || iPadOnMac || (coarseOnly && touch));
}

// Guardar al teléfono. iPhone Safari (iOS16+)/Android: menú nativo de Compartir
// (navigator.share con archivo -> "Guardar video" en Fotos / "Guardar en Archivos").
// iOS exige que share() salga JUSTO tras el toque; si el video es grande, la descarga
// consume ese permiso -> cacheamos el archivo y el 2º toque lo comparte al instante.
// Escritorio (sin la API): descarga directa por enlace.
async function saveVideo(it, btn) {
  // Escritorio (Mac/PC): descarga directa al equipo con el gestor del navegador (muestra
  // su propio progreso). Solo en móvil (iPhone/iPad/Android) usamos el menú de Compartir.
  if (!isMobileSave()) { linkDownload(it); return; }
  if (!(navigator.canShare && navigator.share)) { linkDownload(it); return; }
  const label = btn ? btn.querySelector('span:not(.ico)') : null; // la etiqueta, NO el <span class="ico">
  const setLabel = (t) => { if (label) label.textContent = t; };
  const resetBtn = () => { if (btn) btn.classList.remove('dlv-dl--ready'); setLabel(T('Descargar', 'Download')); };

  // 2º toque (archivo ya en memoria): compartir SINCRONO -> activación fresca, no falla.
  const cached = fileCache.get(it.id);
  if (cached) {
    try { await navigator.share({ files: [cached], title: it.title || 'Reel' }); fileCache.delete(it.id); resetBtn(); }
    catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú: deja el botón armado
      // Falló el menú: CONSERVAMOS el archivo (no lo re-bajamos) y dejamos el botón
      // armado para reintentar con un toque (en iOS un <a download> no guardaría nada).
      toast(T('No se abrió el menú para guardar. Toca el botón otra vez.', 'The save menu didn\'t open. Tap the button again.'), 'error', 5000);
    }
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setLabel(`${T('Preparando…', 'Preparing…')} 0%`);
    const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Preparando…', 'Preparing…')} ${pct}%`));
    const file = fileFromBlob(it, blob);
    if (!navigator.canShare({ files: [file] })) { linkDownload(it); return; }
    try {
      await navigator.share({ files: [file], title: it.title || 'Reel' });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú
      // iOS: la descarga consumió el permiso del toque. Dejamos el archivo LISTO y
      // ARMAMOS un 2º toque muy claro (botón resaltado) -> ahí sí abre "Guardar en el teléfono".
      fileCache.set(it.id, file);
      if (btn) btn.classList.add('dlv-dl--ready');
      setLabel(T('Toca para guardar', 'Tap to save'));
      toast(T('Tu video ya está listo ✓ — toca otra vez el botón resaltado para guardarlo en tu teléfono.', 'Your video is ready ✓ — tap the highlighted button again to save it to your phone.'), 'info', 8000);
      return;
    }
  } catch (e) {
    linkDownload(it);
  } finally {
    if (btn) btn.disabled = false;
    if (label && /Preparando|Preparing/.test(label.textContent)) resetBtn();
  }
}

// Guarda un File ya descargado con el gestor del navegador (escritorio y
// fallback móvil): enlace a un blob local -> directo a Descargas.
function blobDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 60000);
}

// "Descargar todos" los reels del mes activo: encadena fetchVideoBlob uno por
// uno (secuencial, no satura la conexión) con progreso simple en el botón
// (2/7 · 45%). En escritorio cada archivo se guarda en Descargas al terminar;
// en móvil se arma el mismo 2º toque que el botón individual (iOS exige que
// share() salga JUSTO tras un toque) y el menú de Compartir guarda TODOS juntos.
async function downloadAllReels(month, reels, btn) {
  const label = btn.querySelector('span:not(.ico)');
  const setLabel = (t) => { if (label) label.textContent = t; };
  const mobile = isMobileSave() && !!(navigator.canShare && navigator.share);

  // MÓVIL, 2º toque: los archivos ya están en memoria -> compartir SÍNCRONO.
  const armed = dlAllCache.get(month);
  if (mobile && armed && armed.length) {
    try {
      await navigator.share({ files: armed, title: 'Reels' });
      dlAllCache.delete(month);
      btn.classList.remove('dlv-dl--ready');
      setLabel(T('Descargar todos', 'Download all'));
    } catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú: sigue armado
      toast(T('No se abrió el menú para guardar. Toca el botón otra vez.', 'The save menu didn\'t open. Tap the button again.'), 'error', 5000);
    }
    return;
  }

  if (dlAllBusy) return;
  dlAllBusy = true; btn.disabled = true;
  const failed = []; const files = [];
  try {
    for (let i = 0; i < reels.length; i++) {
      const it = reels[i];
      const pos = `${i + 1}/${reels.length}`;
      setLabel(`${T('Descargando', 'Downloading')} ${pos}…`);
      try {
        const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Descargando', 'Downloading')} ${pos} · ${pct}%`));
        const file = fileFromBlob(it, blob);
        if (mobile) files.push(file); // en móvil se juntan para UN solo menú de Compartir
        else { blobDownload(file); await new Promise((r) => setTimeout(r, 350)); }
      } catch { failed.push(it.title || 'Reel'); }
    }
  } finally {
    dlAllBusy = false; btn.disabled = false;
  }

  if (mobile && files.length) {
    let shareable = false;
    try { shareable = navigator.canShare({ files }); } catch { shareable = false; }
    if (shareable) {
      dlAllCache.set(month, files);
      btn.classList.add('dlv-dl--ready');
      setLabel(T('Toca para guardar todos', 'Tap to save all'));
      toast(T('Tus videos ya están listos ✓ — toca otra vez el botón resaltado para guardarlos.', 'Your videos are ready ✓ — tap the highlighted button again to save them.'), 'info', 8000);
    } else {
      // Este teléfono no comparte varios archivos a la vez: guardar uno por uno.
      for (const f of files) blobDownload(f);
      setLabel(T('Descargar todos', 'Download all'));
    }
  } else {
    setLabel(T('Descargar todos', 'Download all'));
  }

  if (failed.length) {
    toast(T(`${failed.length === 1 ? '1 reel no se descargó' : `${failed.length} reels no se descargaron`}: ${failed.join(', ')}. Intenta de nuevo.`, `${failed.length === 1 ? '1 reel failed to download' : `${failed.length} reels failed to download`}: ${failed.join(', ')}. Try again.`), 'error', 9000);
  } else if (!mobile) {
    toast(`${reels.length} ${T('reels descargados', 'reels downloaded')} ✓`, 'success');
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function buildAddBar() {
  if (!addMonth) addMonth = currentMonth();
  const monthInput = el('input', {
    class: 'dlv-month', type: 'month', value: addMonth, 'aria-label': T('Mes de los entregables', 'Deliverables month'),
    onchange: (e) => { addMonth = e.target.value || currentMonth(); },
  });

  // Drop zone para reels
  const fileInput = el('input', {
    type: 'file', accept: 'video/*', multiple: true, class: 'dlv-fileinput', hidden: true,
    onchange: (e) => { enqueueReels(e.target.files); e.target.value = ''; },
  });
  let dropKids;
  if (busy) {
    // Barra de progreso (refs vivos -> updateProgressUI los actualiza sin re-render).
    const fill = el('div', { class: 'dlv-prog__fill' });
    fill.style.width = uploadPct + '%';
    const q = (queueInfo && queueInfo.total > 1) ? `(${queueInfo.index}/${queueInfo.total}) ` : '';
    const label = el('span', { class: 'dlv-drop__t dlv-prog__label', text: uploadPct >= 100 ? `${q}${T('Procesando…', 'Processing…')}` : `${q}${T('Subiendo…', 'Uploading…')} ${uploadPct}%` });
    progressEls = { fill, label };
    dropKids = [
      icon('camera', 26),
      label,
      el('div', { class: 'dlv-prog' }, [fill]),
      el('span', { class: 'dlv-drop__s', text: T('No cierres esta pantalla mientras sube el video.', 'Don\'t close this screen while the video uploads.') }),
    ];
  } else {
    dropKids = [
      icon('camera', 26),
      el('span', { class: 'dlv-drop__t', text: T('Arrastra un reel aquí o toca para elegir', 'Drag a reel here or tap to choose') }),
      el('span', { class: 'dlv-drop__s', text: T('Video MP4/MOV/WebM · calidad original · videos grandes OK (se suben por partes)', 'MP4/MOV/WebM video · original quality · big videos OK (uploaded in parts)') }),
      fileInput,
    ];
  }
  const drop = el('button', {
    class: 'dlv-drop' + (busy ? ' is-busy' : ''), type: 'button',
    onclick: busy ? null : () => fileInput.click(),
  }, dropKids);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('is-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) enqueueReels(e.dataTransfer.files);
  });

  // Agregar carrusel por link. Cada casilla con su etiqueta visible para que no se
  // confunda el ENLACE (lo que abre el carrusel) con el TÍTULO (solo un nombre).
  const linkInput = el('input', { class: 'dlv-input', type: 'text', inputmode: 'url', placeholder: T('Pega el enlace: canva.link/…, drive…, instagram.com/…', 'Paste the link: canva.link/…, drive…, instagram.com/…') });
  const titleInput = el('input', { class: 'dlv-input dlv-input--title', type: 'text', placeholder: T('Nombre para el cliente', 'Name for the client'), maxlength: 200 });
  const addBtn = el('button', {
    class: 'dlv-addbtn', type: 'button', disabled: busy,
    onclick: async () => {
      // Limpia las casillas SOLO si se agregó de verdad: si la validación o el
      // POST fallan, el link/título se quedan para corregir sin volver a pegar.
      const ok = await addCarrusel(linkInput.value, titleInput.value);
      if (ok) { linkInput.value = ''; titleInput.value = ''; }
    },
  }, [icon('plus', 16), el('span', { text: T('Agregar carrusel', 'Add carousel') })]);

  return el('div', { class: 'dlv-addbar' }, [
    el('div', { class: 'dlv-addbar__row' }, [
      el('label', { class: 'dlv-addbar__lbl', text: T('Subir al mes:', 'Upload to month:') }),
      monthInput,
    ]),
    drop,
    el('div', { class: 'dlv-carrusel-add' }, [
      el('div', { class: 'dlv-field' }, [
        el('label', { class: 'dlv-field__lbl', text: T('Link del carrusel', 'Carousel link') }),
        linkInput,
      ]),
      el('div', { class: 'dlv-field dlv-field--title' }, [
        el('label', { class: 'dlv-field__lbl', text: T('Título (opcional)', 'Title (optional)') }),
        titleInput,
      ]),
      addBtn,
    ]),
  ]);
}

// Tiempo relativo en español. created_at viene en UTC ('YYYY-MM-DD HH:MM:SS').
function relTime(iso) {
  if (!iso) return '';
  const s = String(iso);
  const t = Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return T('ahora', 'now');
  if (sec < 3600) return T(`hace ${Math.floor(sec / 60)} min`, `${Math.floor(sec / 60)} min ago`);
  if (sec < 86400) return T(`hace ${Math.floor(sec / 3600)} h`, `${Math.floor(sec / 3600)} h ago`);
  if (sec < 7 * 86400) return T(`hace ${Math.floor(sec / 86400)} d`, `${Math.floor(sec / 86400)} d ago`);
  return new Date(t).toLocaleDateString(T('es-MX', 'en-US'), { day: 'numeric', month: 'short' });
}

async function deleteComment(it, c, node) {
  if (!window.confirm(T('¿Eliminar este comentario?', 'Delete this comment?'))) return;
  try {
    await api.del(`/deliverables/${it.id}/comments/${c.id}`);
    node.remove();
    it.comments = (it.comments || []).filter((x) => x.id !== c.id);
  } catch (e) { toast(e.message || T('No se pudo eliminar', 'Could not delete'), 'error'); }
}

function commentEl(it, c, staff) {
  // Encabezado (quién y cuándo: "Nombre · hace 2h") + texto. Los comentarios del
  // CLIENTE se distinguen con borde y etiqueta de color. Para staff, × para borrar.
  const fromClient = c.author_role === 'client';
  const when = relTime(c.created_at);
  const top = el('div', { class: 'dlv-comment__top' }, [
    el('span', { class: 'dlv-comment__who', text: c.author_name || (fromClient ? T('Cliente', 'Client') : T('Equipo IVAE', 'IVAE Team')) }),
    c.author_role ? el('span', { class: 'dlv-comment__role' + (fromClient ? ' is-client' : ''), text: fromClient ? T('Cliente', 'Client') : T('Equipo', 'Team') }) : null,
    when ? el('span', { class: 'dlv-comment__when', text: when }) : null,
  ]);
  const node = el('div', { class: 'dlv-comment' + (fromClient ? ' dlv-comment--client' : '') }, [
    el('div', { class: 'dlv-comment__main' }, [
      top,
      el('p', { class: 'dlv-comment__body', text: c.body }),
    ]),
    staff ? el('button', { class: 'dlv-comment__del', type: 'button', 'aria-label': T('Eliminar comentario', 'Delete comment') }, [icon('trash', 15)]) : null,
  ]);
  if (staff) { const d = node.querySelector('.dlv-comment__del'); if (d) d.addEventListener('click', () => deleteComment(it, c, node)); }
  return node;
}

// Sección de comentarios bajo cada entregable: el CLIENTE escribe los cambios que
// pide y el EQUIPO puede responder. Ambos pueden comentar.
function buildComments(it, staff) {
  const list = el('div', { class: 'dlv-comments__list' });
  const cs = it.comments || [];
  cs.forEach((c) => list.appendChild(commentEl(it, c, staff)));

  const input = el('textarea', {
    class: 'dlv-comment-input', rows: 1, maxlength: 4000, placeholder: T('Escribe un cambio o comentario…', 'Write a change or comment…'),
    oninput: (e) => {
      // En escritorio el textarea LLENA el alto (flex); no fijamos altura inline.
      if (window.matchMedia && window.matchMedia('(min-width: 768px)').matches) return;
      e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
    },
  });
  const send = el('button', { class: 'dlv-comment-send', type: 'button', text: T('Enviar', 'Send') });
  const submit = async () => {
    const body = (input.value || '').trim();
    if (!body || send.disabled) return;
    send.disabled = true;
    try {
      const c = await api.post(`/deliverables/${it.id}/comments`, { body });
      it.comments = (it.comments || []).concat(c);
      const node = commentEl(it, c, staff);
      list.appendChild(node);
      input.value = ''; input.style.height = 'auto';
      node.scrollIntoView({ block: 'nearest' });
    } catch (e) { toast(e.message || T('No se pudo enviar', 'Could not send'), 'error'); }
    finally { send.disabled = false; }
  };
  send.addEventListener('click', submit);
  // Cmd/Ctrl+Enter envía (Enter solo hace salto de línea).
  input.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });

  return el('div', { class: 'dlv-comments' }, [
    list,
    el('div', { class: 'dlv-comment-form' }, [input, send]),
  ]);
}

function buildItem(it, staff) {
  if (it.type === 'reel') {
    const card = el('div', { class: 'dlv-card dlv-card--reel' });
    if (it.video_url) {
      const v = el('video', {
        class: 'dlv-video', src: it.video_url, poster: it.poster_url || null,
        controls: true, playsinline: true, preload: 'none',
      });
      observeVideo(v); // carga metadatos/frame solo al acercarse (rápido en móvil)
      card.appendChild(v);
    } else {
      card.appendChild(el('div', { class: 'dlv-video dlv-video--pending', text: T('Procesando…', 'Processing…') }));
    }
    const foot = el('div', { class: 'dlv-card__foot' }, [
      el('span', { class: 'dlv-card__title', text: it.title || 'Reel' }),
      el('div', { class: 'dlv-card__actions' }, [
        it.video_url ? el('button', {
          class: 'dlv-dl', type: 'button', 'aria-label': T('Descargar reel', 'Download reel'),
          onclick: (e) => saveVideo(it, e.currentTarget),
        }, [icon('down', 16), el('span', { text: T('Descargar', 'Download') })]) : null,
        staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': T('Eliminar', 'Delete'), onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
      ]),
    ]);
    // foot + comentarios en un lado: en móvil van debajo del video; en escritorio
    // (CSS ≥768px) este lado se coloca AL COSTADO del video para leer el comentario.
    card.appendChild(el('div', { class: 'dlv-card__side' }, [foot, buildComments(it, staff)]));
    return card;
  }
  // carrusel: preview (izquierda en escritorio) + comentarios al lado (.dlv-card__side)
  const main = el('div', { class: 'dlv-carrusel__main' }, [
    el('div', { class: 'dlv-carrusel__ico' }, [icon('grip', 30)]),
    el('span', { class: 'dlv-card__title', text: it.title || T('Carrusel', 'Carousel') }),
    el('div', { class: 'dlv-card__actions' }, [
      el('a', {
        class: 'dlv-carrusel-btn', href: it.link, target: '_blank', rel: 'noopener noreferrer',
      }, [icon('eye', 16), el('span', { text: T('Ver carrusel', 'View carousel') })]),
      staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': T('Eliminar', 'Delete'), onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
    ]),
  ]);
  return el('div', { class: 'dlv-card dlv-card--carrusel' }, [
    main,
    el('div', { class: 'dlv-card__side' }, [buildComments(it, staff)]),
  ]);
}

function render() {
  if (!rootEl) return;
  clear(rootEl);
  const staff = !isClient();
  const client = activeClient();

  if (!client) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('briefcase', 26)]),
      el('h3', { text: T('Elige una marca', 'Choose a brand') }),
      el('p', { text: T('Selecciona un cliente arriba para ver o subir sus entregables.', 'Select a client above to view or upload their deliverables.') }),
    ]));
    return;
  }

  rootEl.appendChild(el('div', { class: 'dlv-head' }, [
    el('h1', { class: 'dlv-h1', text: T('Entregables', 'Deliverables') }),
    el('p', { class: 'dlv-sub', text: staff ? T('Sube los reels finales y agrega los carruseles. El cliente los verá y podrá descargarlos.', 'Upload the final reels and add the carousels. The client will see them and can download them.') : T('Aquí está tu contenido final, listo para ver y descargar.', 'Here\'s your final content, ready to view and download.') }),
  ]));

  if (staff) rootEl.appendChild(buildAddBar());

  if (loading) {
    rootEl.appendChild(el('div', { class: 'dlv-loading' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'muted', text: T('Cargando entregables…', 'Loading deliverables…') })]));
    return;
  }

  if (!items.length) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('camera', 26)]),
      el('h3', { text: staff ? T('Aún no hay entregables', 'No deliverables yet') : T('Todavía no hay contenido', 'No content yet') }),
      el('p', { text: staff ? T('Arrastra un reel o agrega un carrusel arriba para empezar.', 'Drag a reel or add a carousel above to get started.') : T('En cuanto el equipo suba tu contenido, aparecerá aquí.', 'As soon as the team uploads your content, it will show up here.') }),
    ]));
    return;
  }

  // Agrupar por mes (desc) y NAVEGAR por píldoras: el área muestra SOLO el mes
  // activo (nada de apilar todos los meses). Default = el más reciente con contenido.
  const byMonth = new Map();
  for (const it of items) { if (!byMonth.has(it.month)) byMonth.set(it.month, []); byMonth.get(it.month).push(it); }
  const months = [...byMonth.keys()].sort().reverse();
  if (!months.includes(activeMonthNav)) activeMonthNav = months[0];
  if (months.length > 1) rootEl.appendChild(buildMonthBar(months, byMonth));

  const m = activeMonthNav;
  // Ordenar SIEMPRE por nombre, con orden numérico natural (2 < 11 < 12),
  // sin importar cuándo se subió cada uno (re-subir el 11 no lo manda al final).
  const list = byMonth.get(m).sort(
    (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es', { numeric: true, sensitivity: 'base' }),
  );
  const reels = list.filter((it) => it.type === 'reel' && it.video_url);
  resetVideoObserver(); // limpia observaciones del mes anterior antes de re-observar
  const sec = el('section', { class: 'dlv-month-sec' }, [
    el('h2', { class: 'dlv-month-h' }, [
      el('span', { class: 'dlv-month-h__t', text: monthLabel(m) }),
      el('span', { class: 'dlv-month-h__n', text: String(list.length) }),
      reels.length >= 2 ? buildDownloadAllBtn(m, reels) : null,
    ]),
    el('div', { class: 'dlv-grid' }, list.map((it) => buildItem(it, staff))),
  ]);
  rootEl.appendChild(sec);
}

// Barra de píldoras de meses (mismo patrón que la monthbar de "Meses"): nombre
// del mes + conteo; la activa resaltada. Tocar una cambia el mes visible.
function buildMonthBar(months, byMonth) {
  const bar = el('div', { class: 'dlv-monthbar', role: 'tablist', 'aria-label': T('Meses', 'Months') });
  for (const m of months) {
    const active = m === activeMonthNav;
    bar.appendChild(el('button', {
      class: 'dlv-monthpill' + (active ? ' is-active' : ''),
      type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false',
      onclick: () => { if (activeMonthNav !== m) { activeMonthNav = m; render(); } },
    }, [
      el('span', { class: 'dlv-monthpill__lbl', text: monthTitle(m) }),
      el('span', { class: 'dlv-monthpill__n', text: String((byMonth.get(m) || []).length) }),
    ]));
  }
  return bar;
}

// Botón "Descargar todos" del mes activo (solo con 2+ reels ya procesados).
function buildDownloadAllBtn(month, reels) {
  const armed = dlAllCache.has(month); // móvil: archivos listos, falta el 2º toque
  const btn = el('button', {
    class: 'dlv-dl dlv-dlall' + (armed ? ' dlv-dl--ready' : ''), type: 'button',
    'aria-label': T('Descargar todos los reels del mes', 'Download all reels for this month'), disabled: dlAllBusy || null,
    onclick: (e) => downloadAllReels(month, reels, e.currentTarget),
  }, [icon('down', 15), el('span', { text: armed ? T('Toca para guardar todos', 'Tap to save all') : T('Descargar todos', 'Download all') })]);
  return btn;
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    addMonth = currentMonth();
    rootEl = el('div', { class: 'dlv-root' });
    host.appendChild(rootEl);
    lastClientId = (ctx.store.getState().activeClientId) || null;
    unsubs.push(ctx.store.subscribe(['clients', 'activeClientId'], () => {
      const now = ctx.store.getState().activeClientId || null;
      if (now !== lastClientId) { lastClientId = now; activeMonthNav = ''; load(); } else { render(); }
    }));
    render();
    load();
  },
  onParams() { load(); },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    resetVideoObserver();
    rootEl = null; ctx = null; items = []; loading = false; busy = false;
    activeMonthNav = ''; dlAllBusy = false; dlAllCache.clear();
  },
};
