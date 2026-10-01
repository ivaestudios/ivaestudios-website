// ============================================================================
// IVAE Marketing — Vista "Carrusel" (cortador de carruseles; solo staff).
//
// DOS modos:
//  · Imágenes: subes la tira (slides pegados en fila) → corta cada slide a
//    resolución original y los descargas 1 por 1 o en ZIP.
//  · Video: subes la tira de VIDEO (p. ej. 5 clips cortos lado a lado) →
//    detecta cada slide, mide su duración real (recorta la cola congelada) y
//    entrega cada slide como video vertical en alta resolución.
//
// TODO PASA EN EL NAVEGADOR (WebCodecs para video, con respaldo MediaRecorder):
// nada se sube a un servidor, funciona igual en el cel que en la compu y no
// gasta datos. El video sale a velocidad correcta en cualquier máquina y con audio.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202610010057';
import { icon } from '../shell/icons.js?v=202610010057';
import { T } from '../shell/i18n.js?v=202610010057';
import { renderGen, resetGen } from './carrusel-gen.js?v=202610010057';
import * as prefs from '../shell/prefs.js?v=202610010057';
import {
  esArchivoDeVideo, grupoDePaginasVideo, cargarVideo, playThrough, analizarPagina,
  slidesRealesDe, huecosDe, zoomSrc, cortarWebCodecs, armarZip,
} from '../lib/cortador-video.js?v=202610010057';

const VIEW_ID = 'carrusel';
const MAX_COLS = 12;
const MAX_ROWS = 4;

let rootEl = null;
let mode = 'img';          // 'img' | 'video'

// ── Estado modo IMAGEN ───────────────────────────────────────────────────────
// VARIAS tiras a la vez: cada carrusel que subes es una "tira" con su propia
// cuadricula (una puede ser de 5 y otra de 8) y sus propios slides. El ZIP final
// las junta todas, cada una en su carpeta.
let tiras = [];            // [{ id, img, url, name, cols, rows, slides }]
let tiraSeq = 0;
let fmt = 'jpg';           // 'jpg' | 'png' (global: aplica a todas las tiras)
// Como se acomoda el ZIP cuando hay varias tiras: una carpeta por carrusel, o
// todo suelto en la raiz. Se recuerda entre sesiones (preferencia por usuario).
let zipModo = 'carpetas';  // 'carpetas' | 'junto'
let cutting = 0;           // token para descartar cortes viejos si cambian los controles

// ── Estado modo VIDEO ────────────────────────────────────────────────────────
// VARIAS tiras a la vez, igual que imágenes (pedido de Vianey 30-sep-2026:
// "de video puedes perfeccionar y mejorar ese"). Y cada tira puede venir en
// VARIAS PÁGINAS: su diseñador exportó un carrusel de 6 en dos archivos, uno
// con 5 slides y otro con el 6º más cuatro huecos en blanco. Los archivos con
// el mismo nombre base ("X.mp4" + "X (2).mp4", o "X-1.mp4" + "X-2.mp4") se
// tratan como UN solo carrusel, los slides se numeran de corrido y los huecos
// se detectan y se saltan.
//   vtira = { id, name, zoom, paginas: [pag], slides: [], phase, progress, token }
//   pag   = { file, video, url, dur, cols, rows, durations: [], blancos: [] }
let vtiras = [];
let vtiraSeq = 0;
let vtoken = 0;            // generación: cambia y toda pasada vieja se detiene
let vProgressEls = new Map(); // tira.id -> barra de progreso (sin re-render)

// ── Utilidades ───────────────────────────────────────────────────────────────

function baseName(name) {
  const s = String(name || 'carrusel').replace(/\.[^.]+$/, '');
  const clean = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().replace(/\s+/g, '-');
  return (clean || 'carrusel').toLowerCase();
}

// Detección de la cuadrícula: prueba filas 1-4 × columnas 1-12 y se queda con
// la combinación cuyos slides queden más cerca de 4:5 (1080×1350), 1:1 o 9:16.
function detectGrid(w, h) {
  const TARGETS = [4 / 5, 1, 9 / 16]; // en orden de prioridad
  let best = null;
  for (let r = 1; r <= MAX_ROWS; r++) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const ratio = (w / c) / (h / r);
      for (let ti = 0; ti < TARGETS.length; ti++) {
        const err = Math.abs(ratio - TARGETS[ti]) / TARGETS[ti];
        if (err > 0.04) continue;
        const cand = { r, c, err, ti, n: r * c };
        const wins = !best
          || (cand.err < best.err - 0.01)
          || (Math.abs(cand.err - best.err) <= 0.01 && (cand.ti < best.ti || (cand.ti === best.ti && cand.n < best.n)));
        if (wins) best = cand;
      }
    }
  }
  if (best) return { rows: best.r, cols: best.c };
  return { rows: 1, cols: Math.min(MAX_COLS, Math.max(1, Math.round(w / h))) };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), type, quality);
  });
}

function freeSlidesDe(t) {
  for (const s of t.slides) { try { URL.revokeObjectURL(s.url); } catch { /* noop */ } }
  t.slides = [];
}

function freeSlides() {
  for (const t of tiras) {
    freeSlidesDe(t);
    try { URL.revokeObjectURL(t.url); } catch { /* noop */ }
  }
  tiras = [];
}

// Todos los slides de todas las tiras, en orden.
function todosLosSlides() {
  return tiras.flatMap((t) => t.slides);
}

function freeVideoSlidesDe(t) {
  for (const sl of t.slides) { try { URL.revokeObjectURL(sl.url); } catch { /* noop */ } }
  t.slides = [];
}
function freeVideoTiras() {
  vtoken += 1;
  for (const t of vtiras) {
    freeVideoSlidesDe(t);
    for (const pg of t.paginas) {
      try { pg.video.pause(); } catch { /* noop */ }
      try { URL.revokeObjectURL(pg.url); } catch { /* noop */ }
    }
  }
  vtiras = [];
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* noop */ } }, 60000);
}

// ── ZIP (método STORE, sin compresión — el contenido ya viene comprimido) ────

// ── Corte de IMAGEN ──────────────────────────────────────────────────────────

// Corta UNA tira.
//
// El token de cancelacion es POR TIRA, no global: si fuera global, subir una
// tira nueva mientras otra esta cortando abortaria el corte de la primera y la
// dejaria vacia para siempre. `cutting` queda como generacion global, solo para
// invalidar todo de golpe al salir de la vista.
async function cutTira(t) {
  if (!t || !t.img) return;
  const token = (t.cut = (t.cut || 0) + 1);
  const gen = cutting;
  const vivo = () => token === t.cut && gen === cutting;
  freeSlidesDe(t);
  render();
  const sw = Math.floor(t.img.naturalWidth / t.cols);
  const sh = Math.floor(t.img.naturalHeight / t.rows);
  const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const ext = fmt === 'png' ? 'png' : 'jpg';
  const out = [];
  try {
    let n = 0;
    for (let r = 0; r < t.rows; r++) {
      for (let c = 0; c < t.cols; c++) {
        n += 1;
        const canvas = document.createElement('canvas');
        canvas.width = sw; canvas.height = sh;
        const g = canvas.getContext('2d');
        g.drawImage(t.img, c * sw, r * sh, sw, sh, 0, 0, sw, sh);
        const blob = await canvasToBlob(canvas, type, 0.95);
        if (!vivo()) { for (const s of out) URL.revokeObjectURL(s.url); return; }
        const nn = String(n).padStart(2, '0');
        out.push({ blob, url: URL.createObjectURL(blob), name: `${t.name}-${nn}.${ext}` });
      }
    }
  } catch (e) {
    console.error('[carrusel] corte', e);
    toast(T('No se pudo cortar la imagen. Prueba con un PNG o JPG.', 'Could not cut the image. Try a PNG or JPG.'), 'error');
    return;
  }
  if (!vivo()) { for (const s of out) URL.revokeObjectURL(s.url); return; }
  t.slides = out;
  render();
}

// Re-corta TODAS (cambio de formato: aplica a todas las tiras).
async function cutTodas() {
  const gen = cutting;
  for (const t of tiras) {
    if (gen !== cutting) return;  // salimos de la vista
    await cutTira(t);
  }
}

function quitarTira(id) {
  const i = tiras.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = tiras[i];
  t.cut = (t.cut || 0) + 1;  // aborta SOLO el corte de esta tira, no el de las otras
  freeSlidesDe(t);
  try { URL.revokeObjectURL(t.url); } catch { /* noop */ }
  tiras.splice(i, 1);
  render();
}

// Nombres de carpeta unicos: dos archivos "carrusel.jpg" no pueden pisarse
// dentro del ZIP.
function carpetasUnicas() {
  const usados = new Map();
  return tiras.map((t) => {
    const n = (usados.get(t.name) || 0) + 1;
    usados.set(t.name, n);
    return n === 1 ? t.name : `${t.name}-${n}`;
  });
}

async function downloadZip() {
  const total = todosLosSlides();
  if (!total.length) return;
  const carpetas = carpetasUnicas();
  const varias = tiras.length > 1;
  const entries = !varias
    // Una sola tira: plano y con su nombre tal cual, como siempre.
    ? tiras[0].slides.map((s) => ({ blob: s.blob, name: s.name }))
    : zipModo === 'carpetas'
    ? tiras.flatMap((t, i) => t.slides.map((s) => ({ blob: s.blob, name: `${carpetas[i]}/${s.name}` })))
    // Todo junto: los nombres tienen que quedar UNICOS o el ZIP se pisa a si
    // mismo — dos tiras que se llamen igual producen el mismo "carrusel-01.jpg"
    // y solo sobrevive uno. Por eso se numera con el nombre ya desambiguado.
    : tiras.flatMap((t, i) => t.slides.map((s, j) => ({
      blob: s.blob,
      name: `${carpetas[i]}-${String(j + 1).padStart(2, '0')}.${s.name.split('.').pop()}`,
    })));
  const bytes = entries.reduce((a, e) => a + e.blob.size, 0);
  // Este ZIP es de 32 bits (sin ZIP64): pasando 4 GB los offsets se desbordan y
  // sale un archivo corrupto SIN avisar. Mejor frenar antes.
  if (bytes > 3.5 * 1024 * 1024 * 1024) {
    toast(T('Son demasiadas tiras juntas para un solo ZIP. Quita algunas y descarga en dos tandas.',
      'Too many strips for a single ZIP. Remove some and download in two batches.'), 'error');
    return;
  }
  try {
    const zip = await armarZip(entries);
    const nombre = tiras.length === 1 ? `${tiras[0].name}-slides.zip` : `carruseles-${tiras.length}-tiras.zip`;
    download(zip, nombre);
    toast(T(`ZIP con ${entries.length} slides de ${tiras.length} ${tiras.length === 1 ? 'tira' : 'tiras'} descargado.`,
      `ZIP with ${entries.length} slides from ${tiras.length} ${tiras.length === 1 ? 'strip' : 'strips'} downloaded.`), 'success');
  } catch (e) {
    console.error('[carrusel] zip', e);
    toast(T('No se pudo armar el ZIP. Descarga los slides uno por uno.', 'Could not build the ZIP. Download the slides one by one.'), 'error');
  }
}

// Carga UNA tira y la agrega al final (no reemplaza las que ya estan).
function cargarTira(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const g = detectGrid(image.naturalWidth, image.naturalHeight);
      resolve({ id: ++tiraSeq, img: image, url, name: baseName(file.name), cols: g.cols, rows: g.rows, slides: [], cut: 0 });
    };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    image.src = url;
  });
}

async function acceptFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const buenos = files.filter((f) => /^image\/(png|jpe?g|webp)$/i.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name || ''));
  if (!buenos.length) {
    toast(T('Formato no soportado. Exporta el carrusel como PNG o JPG.', 'Unsupported format. Export the carousel as PNG or JPG.'), 'error');
    return;
  }
  if (buenos.length < files.length) {
    toast(T(`${files.length - buenos.length} archivo(s) no son PNG/JPG y se omitieron.`,
      `${files.length - buenos.length} file(s) aren't PNG/JPG and were skipped.`), 'error');
  }
  const nuevas = (await Promise.all(buenos.map(cargarTira))).filter(Boolean);
  if (!nuevas.length) {
    toast(T('No se pudo leer la imagen. Exporta el carrusel como PNG o JPG.', 'Could not read the image. Export the carousel as PNG or JPG.'), 'error');
    return;
  }
  tiras.push(...nuevas);
  render();
  for (const t of nuevas) await cutTira(t);
}

// ── VIDEO ────────────────────────────────────────────────────────────────────

function videoSupported() {
  return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
}

function pickVideoMime() {
  const cands = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (window.MediaRecorder) {
    for (const m of cands) {
      try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: m.startsWith('video/mp4') ? 'mp4' : 'webm' }; } catch { /* noop */ }
    }
  }
  return { mime: '', ext: 'webm' };
}

const fmtDur = (s) => `${(Math.round(s * 10) / 10).toFixed(1)}s`;

// ── VIDEO · archivos y páginas ───────────────────────────────────────────────

// Las pasadas de video (medir, cortar) van UNA tras otra aunque ella suelte
// varias tiras de golpe: dos videos reproduciéndose a la vez se roban cuadros.
let vCola = Promise.resolve();
const enColaVideo = (fn) => { vCola = vCola.then(fn, fn); return vCola; };

function vTiraDe(id) { return vtiras.find((t) => t.id === id) || null; }

function quitarVTira(id) {
  const t = vTiraDe(id); if (!t) return;
  vtoken += 1; // detiene cualquier pasada sobre esta tira
  freeVideoSlidesDe(t);
  for (const pg of t.paginas) {
    try { pg.video.pause(); } catch { /* noop */ }
    try { URL.revokeObjectURL(pg.url); } catch { /* noop */ }
  }
  vtiras = vtiras.filter((x) => x.id !== id);
  render();
}

async function acceptVideoFiles(fileList) {
  const files = [...(fileList || [])].filter(esArchivoDeVideo);
  if (!files.length) {
    toast(T('Sube un video (MP4 o MOV) de la tira del carrusel.', 'Upload a video (MP4 or MOV) of the carousel strip.'), 'error');
    return;
  }
  if (!videoSupported()) {
    toast(T('Tu navegador no permite cortar video. Prueba en Chrome o Safari actualizado.', 'Your browser can\'t cut video. Try an up-to-date Chrome or Safari.'), 'error');
    return;
  }
  for (const grupo of grupoDePaginasVideo(files)) {
    const t = { id: ++vtiraSeq, name: baseName(grupo[0].name), zoom: 100, paginas: [], slides: [], phase: 'cargando', progress: 0, token: 0 };
    vtiras.push(t); render();
    for (const f of grupo) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { video, url, dur } = await cargarVideo(f);
        const g = detectGrid(video.videoWidth, video.videoHeight);
        t.paginas.push({ file: f, video, url, dur, cols: g.cols, rows: g.rows, durations: [], blancos: [] });
      } catch {
        toast(T(`No se pudo leer "${f.name}". Prueba con un MP4.`, `Could not read "${f.name}". Try an MP4.`), 'error');
      }
    }
    if (!t.paginas.length) { quitarVTira(t.id); continue; }
    if (t.paginas.length > 1) toast(T(`${t.paginas.length} archivos unidos en un solo carrusel ✓`, `${t.paginas.length} files merged into one carousel ✓`), 'success');
    enColaVideo(() => analyzeTira(t));
  }
}

// ── VIDEO · medir cada slide ─────────────────────────────────────────────────
async function analyzeTira(t) {
  if (!vTiraDe(t.id)) return;
  const token = ++vtoken; t.token = token;
  t.phase = 'analizando'; t.progress = 0; freeVideoSlidesDe(t); render();
  let hechas = 0;
  for (const pg of t.paginas) {
    if (token !== vtoken) return;
    // eslint-disable-next-line no-await-in-loop
    await analizarPagina(pg, () => token === vtoken, (p) => { t.progress = (hechas + p) / t.paginas.length; updateVProgress(t); });
    hechas += 1;
  }
  if (token !== vtoken) return;
  t.phase = 'listo'; t.progress = 0; render();
}

// Router del corte: WebCodecs (independiente de la compu) si está disponible;
// si no, o si falla, cae al respaldo con MediaRecorder.
async function cutTiraVideo(t) {
  const canWC = typeof window.VideoEncoder !== 'undefined' && typeof window.VideoFrame !== 'undefined';
  if (canWC) {
    try { await cutTiraWebCodecs(t); return; }
    catch (e) {
      console.error('[carrusel] WebCodecs falló, uso respaldo:', e);
      toast(T('El motor principal falló, usé el de respaldo (esos videos pueden no descargarse en WhatsApp). Detalle: ', 'The main engine failed, so the fallback was used (those videos may not download in WhatsApp). Detail: ') + ((e && e.message) || T('desconocido', 'unknown')), 'error', 10000);
      vtoken += 1;
    }
  }
  await cutTiraMediaRecorder(t);
}

// Corta TODAS las tiras que estén listas, una tras otra.
function cutTodasLasTirasVideo() {
  for (const t of vtiras) {
    if (t.phase !== 'listo' || t.slides.length) continue;
    enColaVideo(() => cutTiraVideo(t));
  }
}

// MÉTODO PRINCIPAL — WebCodecs, con el motor compartido de lib/cortador-video.js
// (el mismo que usa Entregables): velocidad correcta en cualquier compu, 30 fps
// constantes, audio de su página (o silencio), mínimo 3 s por slide (Instagram)
// y salida MP4 que WhatsApp e iPhone aceptan. Los huecos se saltan y los slides
// se numeran de corrido a través de las páginas.
async function cutTiraWebCodecs(t) {
  if (!vTiraDe(t.id)) return;
  if (!slidesRealesDe(t.paginas).length) return;
  const token = ++vtoken; t.token = token;
  t.phase = 'cortando'; t.progress = 0; freeVideoSlidesDe(t); render();
  const out = await cortarWebCodecs({
    paginas: t.paginas, zoom: t.zoom,
    sigueVivo: () => token === vtoken,
    onProgress: (p) => { t.progress = p; updateVProgress(t); },
  });
  if (token !== vtoken || !out) return;
  freeVideoSlidesDe(t);
  t.slides = out.map((o, i) => ({
    blob: o.blob, url: URL.createObjectURL(o.blob),
    name: `${t.name}-${String(i + 1).padStart(2, '0')}.mp4`,
    duration: o.duration, ext: 'mp4',
  }));
  t.phase = 'listo'; t.progress = 0;
  render();
}

// RESPALDO — MediaRecorder: graba UN slide a la vez, en tiempo real. Solo si el
// navegador no tiene WebCodecs (Safari viejo).
async function cutTiraMediaRecorder(t) {
  if (!vTiraDe(t.id)) return;
  const reales = slidesRealesDe(t.paginas);
  if (!reales.length) return;
  const token = ++vtoken; t.token = token;
  t.phase = 'cortando'; t.progress = 0; freeVideoSlidesDe(t); render();
  const { mime, ext } = pickVideoMime();
  const out = [];
  let k = 0;
  for (const { pg, idx } of reales) {
    if (token !== vtoken) return;
    const v = pg.video;
    const cols2 = pg.cols, rows2 = pg.rows;
    const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
    const c = idx % cols2, r = Math.floor(idx / cols2);
    const dur = Math.max(0.3, pg.durations[idx]);
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const cx = cv.getContext('2d');
    const stream = (cv.captureStream || cv.mozCaptureStream).call(cv, 30);
    let silentCtx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        silentCtx = new AC();
        const dest = silentCtx.createMediaStreamDestination();
        const osc = silentCtx.createOscillator();
        const gain = silentCtx.createGain(); gain.gain.value = 0;
        osc.connect(gain); gain.connect(dest); osc.start();
        const at = dest.stream.getAudioTracks()[0];
        if (at) stream.addTrack(at);
      }
    } catch { silentCtx = null; }
    const opts = { videoBitsPerSecond: 10_000_000 };
    if (mime) opts.mimeType = mime;
    let rec;
    try { rec = new MediaRecorder(stream, opts); } catch { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime || 'video/webm' })); });
    let stopped = false, started = false;
    const kk = k;
    // eslint-disable-next-line no-await-in-loop
    await playThrough(v, () => {
      const tt = v.currentTime;
      if (tt <= dur + 0.05) {
        const z = zoomSrc(c * sw, r * sh, sw, sh, t.zoom);
        cx.drawImage(v, z.sx, z.sy, z.sw, z.sh, 0, 0, sw, sh);
        if (!started) { started = true; try { rec.start(); } catch { /* noop */ } }
      } else if (!stopped) {
        stopped = true;
        try { rec.stop(); } catch { /* noop */ }
        try { v.pause(); } catch { /* noop */ }
      }
      t.progress = (kk + (dur ? Math.min(1, tt / dur) : 1)) / reales.length;
      updateVProgress(t);
    }, () => token === vtoken);
    if (started && !stopped) { try { rec.stop(); } catch { /* noop */ } }
    // eslint-disable-next-line no-await-in-loop
    out.push({ blob: started ? await done : new Blob([], { type: mime || 'video/webm' }), duration: dur });
    try { if (silentCtx) silentCtx.close(); } catch { /* noop */ }
    k += 1;
  }
  if (token !== vtoken) return;
  freeVideoSlidesDe(t);
  t.slides = out.map((o, i) => ({
    blob: o.blob, url: URL.createObjectURL(o.blob),
    name: `${t.name}-${String(i + 1).padStart(2, '0')}.${ext}`,
    duration: o.duration, ext,
  }));
  t.phase = 'listo'; t.progress = 0;
  render();
}

function carpetasUnicasVideo() {
  const usados = new Map();
  return vtiras.map((t) => {
    const n = (usados.get(t.name) || 0) + 1;
    usados.set(t.name, n);
    return n === 1 ? t.name : `${t.name}-${n}`;
  });
}

// ZIP de TODOS los videos cortados: como en imágenes, una carpeta por
// carrusel (o todo junto con nombres únicos), y plano si es una sola tira.
async function downloadVideoZip() {
  const conSlides = vtiras.filter((t) => t.slides.length);
  const total = conSlides.reduce((a, t) => a + t.slides.length, 0);
  if (!total) return;
  const carpetas = carpetasUnicasVideo();
  const varias = conSlides.length > 1;
  const entries = !varias
    ? conSlides[0].slides.map((sl) => ({ blob: sl.blob, name: sl.name }))
    : zipModo === 'carpetas'
    ? vtiras.flatMap((t, i) => t.slides.map((sl) => ({ blob: sl.blob, name: `${carpetas[i]}/${sl.name}` })))
    : vtiras.flatMap((t, i) => t.slides.map((sl, j) => ({ blob: sl.blob, name: `${carpetas[i]}-${String(j + 1).padStart(2, '0')}.${sl.ext}` })));
  const bytes = entries.reduce((a, e) => a + e.blob.size, 0);
  if (bytes > 3.5 * 1024 * 1024 * 1024) {
    toast(T('Son demasiados videos para un solo ZIP. Quita algunas tiras y descarga en dos tandas.', 'Too many videos for one ZIP. Remove some strips and download in two batches.'), 'error', 8000);
    return;
  }
  try {
    const zip = await armarZip(entries);
    download(zip, varias ? 'carruseles-videos.zip' : `${conSlides[0].name}-videos.zip`);
    toast(T(`ZIP con ${total} videos descargado.`, `ZIP with ${total} videos downloaded.`), 'success');
  } catch (e) {
    console.error('[carrusel] zip video', e);
    toast(T('No se pudo armar el ZIP. Descarga los videos uno por uno.', 'Could not build the ZIP. Download the videos one by one.'), 'error');
  }
}

// Actualiza SOLO la barra de progreso de esa tira sin re-render (para no
// interrumpir la reproducción que está midiendo o cortando).
function updateVProgress(t) {
  const bar = vProgressEls.get(t.id);
  if (bar) bar.style.width = `${Math.round(t.progress * 100)}%`;
}

// ── UI ───────────────────────────────────────────────────────────────────────

function modeToggle() {
  return el('div', { class: 'car-modeseg', role: 'tablist' }, [
    el('button', {
      class: 'car-modeseg__btn' + (mode === 'img' ? ' is-active' : ''), type: 'button', role: 'tab',
      onclick: () => { if (mode !== 'img') { mode = 'img'; render(); } },
    }, [icon('camera', 15), ' ' + T('Imágenes', 'Images')]),
    el('button', {
      class: 'car-modeseg__btn' + (mode === 'video' ? ' is-active' : ''), type: 'button', role: 'tab',
      onclick: () => { if (mode !== 'video') { mode = 'video'; render(); } },
    }, [icon('gantt', 15), ' Video']),
    el('button', {
      class: 'car-modeseg__btn' + (mode === 'gen' ? ' is-active' : ''), type: 'button', role: 'tab',
      onclick: () => { if (mode !== 'gen') { mode = 'gen'; render(); } },
    }, [icon('activity', 15), ' ' + T('Generar', 'Generate')]),
  ]);
}

function stepper(label, get, set, min, max, onChange, step = 1, fmtVal = (x) => String(x)) {
  const val = el('span', { class: 'car-step__val', text: fmtVal(get()) });
  const mk = (txt, d) => el('button', {
    class: 'car-step__btn', type: 'button', 'aria-label': `${txt} ${label}`,
    onclick: () => { const v = Math.min(max, Math.max(min, get() + d)); if (v !== get()) { set(v); val.textContent = fmtVal(v); onChange(); } },
  }, [txt]);
  return el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: label }),
    el('div', { class: 'car-step__ctrl' }, [mk('−', -step), val, mk('+', step)]),
  ]);
}

// Región fuente para aplicar ZOOM: recorta un margen centrado de la celda del
// slide y lo escala a tamaño completo → hace desaparecer la "línea" del slide
// de al lado cuando la tira no venía perfectamente encuadrada. z en % (100=sin).
function gridLinesFor(c, r) {
  const lines = [];
  for (let i = 1; i < c; i++) lines.push(el('span', { class: 'car-line car-line--v', style: `left:${(i / c) * 100}%` }));
  for (let i = 1; i < r; i++) lines.push(el('span', { class: 'car-line car-line--h', style: `top:${(i / r) * 100}%` }));
  return lines;
}

function render() {
  if (!rootEl) return;
  vProgressEls = new Map();
  clear(rootEl);

  rootEl.appendChild(el('header', { class: 'car-head' }, [
    el('h2', { class: 'car-title', text: mode === 'gen' ? T('Generador de carruseles', 'Carousel generator') : T('Cortador de carruseles', 'Carousel cutter') }),
    el('p', {
      class: 'car-sub',
      text: mode === 'gen'
        ? T('Tus fotos + tu texto = carrusel profesional listo para Instagram. La foto a sangre completa, el texto mínimo y la marca siempre en su lugar.', 'Your photos + your text = a professional Instagram-ready carousel.')
        : mode === 'img'
        ? T('Sube tus tiras de carrusel (los slides pegados en fila) y descárgalas ya cortadas. Puedes subir VARIAS de golpe y salen todas en un solo ZIP. Todo pasa en tu dispositivo: no se sube a ningún lado.', 'Upload your carousel strips (the slides joined in a row) and download them already cut. You can upload SEVERAL at once and they all come out in a single ZIP. Everything happens on your device: nothing gets uploaded anywhere.')
        : T('Sube la tira de VIDEO (los clips cortos pegados en fila) y córtala en videos verticales, uno por slide, con su duración real. Todo pasa en tu dispositivo: no se sube a ningún lado.', 'Upload the VIDEO strip (the short clips joined in a row) and cut it into vertical videos, one per slide, with their real duration. Everything happens on your device: nothing gets uploaded anywhere.'),
    }),
  ]));
  rootEl.appendChild(modeToggle());

  if (mode === 'img') renderImg();
  else if (mode === 'gen') { const host = el('div'); rootEl.appendChild(host); renderGen(host, { canvasToBlob, buildZip: armarZip, download }); }
  else renderVideo();
}

function renderImg() {
  const hay = tiras.length > 0;
  const input = el('input', {
    class: 'car-file', type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: 'multiple',
    onchange: (e) => { acceptFiles(e.target.files); e.target.value = ''; },
  });
  const drop = el('div', {
    class: 'car-drop' + (hay ? ' car-drop--mini' : ''),
    role: 'button', tabindex: '0',
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add('is-over'); },
    ondragleave: () => drop.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('is-over'); acceptFiles(e.dataTransfer.files); },
  }, [
    icon('camera', hay ? 18 : 26),
    el('div', { class: 'car-drop__txt' }, [
      el('strong', { text: hay ? T('Agregar otra tira', 'Add another strip') : T('Toca para subir tus tiras de carrusel', 'Tap to upload your carousel strips') }),
      hay ? null : el('span', { text: T('PNG o JPG · puedes elegir VARIAS a la vez y salen todas en un solo ZIP', 'PNG or JPG · you can pick SEVERAL at once and they all come out in a single ZIP') }),
    ]),
    input,
  ]);
  rootEl.appendChild(drop);
  if (!hay) return;

  // ── Barra global: formato + descargar TODO ───────────────────────────────
  const total = todosLosSlides();
  const fmtSeg = el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: T('Formato', 'Format') }),
    el('div', { class: 'car-step__ctrl car-step__ctrl--seg' }, ['jpg', 'png'].map((f) => el('button', {
      class: 'car-step__btn car-step__btn--seg' + (fmt === f ? ' is-active' : ''), type: 'button', text: f.toUpperCase(),
      onclick: () => { if (fmt !== f) { fmt = f; cutTodas(); } },
    }))),
  ]);
  // Como se acomoda el ZIP. Solo tiene sentido con 2+ tiras: con una sola no
  // hay nada que separar y el selector solo estorbaria.
  const zipSeg = tiras.length > 1 ? el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: T('En el ZIP', 'In the ZIP') }),
    el('div', { class: 'car-step__ctrl car-step__ctrl--seg' }, [
      ['carpetas', T('En carpetas', 'In folders')],
      ['junto', T('Todo junto', 'All together')],
    ].map(([v, lbl]) => el('button', {
      class: 'car-step__btn car-step__btn--seg' + (zipModo === v ? ' is-active' : ''), type: 'button', text: lbl,
      onclick: () => { if (zipModo !== v) { zipModo = v; prefs.set('carZipModo', v); render(); } },
    }))),
  ]) : null;

  rootEl.appendChild(el('div', { class: 'car-controls car-controls--global' }, [
    fmtSeg,
    zipSeg,
    el('span', { class: 'car-info', text: `${tiras.length} ${tiras.length === 1 ? T('tira', 'strip') : T('tiras', 'strips')} · ${total.length} slides` }),
  ]));

  if (total.length) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: downloadZip }, [
        icon('archive', 16), ` ${T('Descargar todo', 'Download all')} (ZIP · ${total.length})`,
      ]),
      el('span', {
        class: 'car-hint',
        text: tiras.length === 1
          ? T('O descarga uno por uno abajo. En iPhone se guardan en Archivos/Descargas.', 'Or download them one by one below. On iPhone they save to Files/Downloads.')
          : zipModo === 'carpetas'
          ? T('Un solo ZIP con una carpeta por carrusel. En iPhone se guarda en Archivos/Descargas.', 'A single ZIP with one folder per carousel. On iPhone it saves to Files/Downloads.')
          : T('Un solo ZIP con todos los slides sueltos, sin carpetas. En iPhone se guarda en Archivos/Descargas.', 'A single ZIP with all slides loose, no folders. On iPhone it saves to Files/Downloads.'),
      }),
    ]));
  }

  // ── Una tarjeta por tira ─────────────────────────────────────────────────
  for (const t of tiras) {
    const sw = Math.floor(t.img.naturalWidth / t.cols);
    const sh = Math.floor(t.img.naturalHeight / t.rows);
    const card = el('section', { class: 'car-tira' }, [
      el('div', { class: 'car-tira__head' }, [
        el('strong', { class: 'car-tira__name', text: t.name }),
        el('span', { class: 'car-info', text: `${t.cols * t.rows} ${T('slides de', 'slides of')} ${sw}×${sh}px` }),
        el('button', {
          class: 'car-tira__x', type: 'button',
          'aria-label': `${T('Quitar', 'Remove')} ${t.name}`, title: T('Quitar esta tira', 'Remove this strip'),
          onclick: () => quitarTira(t.id),
        }, [icon('close', 14)]),
      ]),
      el('div', { class: 'car-preview' }, [
        el('img', { src: t.url, alt: T('Tira del carrusel', 'Carousel strip') }),
        ...gridLinesFor(t.cols, t.rows),
      ]),
      el('div', { class: 'car-controls' }, [
        stepper(T('Columnas', 'Columns'), () => t.cols, (v) => { t.cols = v; }, 1, MAX_COLS, () => cutTira(t)),
        stepper(T('Filas', 'Rows'), () => t.rows, (v) => { t.rows = v; }, 1, MAX_ROWS, () => cutTira(t)),
      ]),
    ]);
    if (!t.slides.length) {
      card.appendChild(el('div', { class: 'car-cutting', text: T('Cortando…', 'Cutting…') }));
    } else {
      card.appendChild(el('div', { class: 'car-grid' }, t.slides.map((s, i) => el('figure', { class: 'car-slide' }, [
        el('img', { src: s.url, alt: `Slide ${i + 1}`, loading: 'lazy' }),
        el('figcaption', { class: 'car-slide__bar' }, [
          el('span', { class: 'car-slide__num', text: String(i + 1) }),
          el('button', {
            class: 'car-slide__dl', type: 'button', title: `${T('Descargar slide', 'Download slide')} ${i + 1}`,
            onclick: () => download(s.blob, s.name),
          }, [icon('down', 15), ' ' + T('Descargar', 'Download')]),
        ]),
      ]))));
    }
    rootEl.appendChild(card);
  }
}

function renderVideo() {
  if (!videoSupported()) {
    rootEl.appendChild(el('div', { class: 'car-cutting', text: T('Tu navegador no permite cortar video. Ábrelo en Chrome o en Safari actualizado.', 'Your browser can\'t cut video. Open this in an up-to-date Chrome or Safari.') }));
    return;
  }
  // Sin WebCodecs (Safari viejo) el corte cae a MediaRecorder → MP4 FRAGMENTADO y
  // SIN AUDIO que WhatsApp no puede descargar. Avisamos claro que corten en Chrome.
  const noWebCodecs = typeof window.VideoEncoder === 'undefined' || typeof window.VideoFrame === 'undefined';
  if (noWebCodecs) {
    rootEl.appendChild(el('div', { class: 'car-warn' }, [
      el('strong', { text: T('⚠️ Abre esta página en Chrome para cortar los videos.', '⚠️ Open this page in Chrome to cut the videos.') }),
      el('span', { text: T(' En este navegador (Safari) los cortes salen en un formato sin audio que WhatsApp no puede descargar. En Chrome salen normales y se comparten sin problema.', ' In this browser (Safari) the cuts come out in an audio-less format that WhatsApp can\'t download. In Chrome they come out normal and share without issues.') }),
    ]));
  }
  const hay = vtiras.length > 0;
  const input = el('input', {
    class: 'car-file', type: 'file', accept: 'video/mp4,video/quicktime,video/webm', multiple: 'multiple',
    onchange: (e) => { acceptVideoFiles(e.target.files); e.target.value = ''; },
  });
  const drop = el('div', {
    class: 'car-drop' + (hay ? ' car-drop--mini' : ''),
    role: 'button', tabindex: '0',
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add('is-over'); },
    ondragleave: () => drop.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('is-over'); acceptVideoFiles(e.dataTransfer.files); },
  }, [
    icon('gantt', hay ? 18 : 26),
    el('div', { class: 'car-drop__txt' }, [
      el('strong', { text: hay ? T('Agregar otra tira de video', 'Add another video strip') : T('Toca para subir tus tiras de video', 'Tap to upload your video strips') }),
      hay ? null : el('span', { text: T('MP4 o MOV · los clips pegados en fila. Puedes subir VARIAS a la vez, y si un carrusel viene en dos archivos ("X" y "X (2)") se juntan solos.', 'MP4 or MOV · the clips joined in a row. You can upload SEVERAL at once, and a carousel split in two files ("X" and "X (2)") is merged automatically.') }),
    ]),
    input,
  ]);
  rootEl.appendChild(drop);
  if (!hay) return;

  // ── Barra global ─────────────────────────────────────────────────────────
  const listas = vtiras.filter((t) => t.phase === 'listo');
  const porCortar = listas.filter((t) => !t.slides.length && slidesRealesDe(t.paginas).length);
  const cortadas = vtiras.filter((t) => t.slides.length);
  const totalCortados = cortadas.reduce((a, t) => a + t.slides.length, 0);
  const totalReales = vtiras.reduce((a, t) => a + slidesRealesDe(t.paginas).length, 0);
  const totalHuecos = vtiras.reduce((a, t) => a + huecosDe(t.paginas), 0);
  const zipSeg = vtiras.length > 1 ? el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: T('En el ZIP', 'In the ZIP') }),
    el('div', { class: 'car-step__ctrl car-step__ctrl--seg' }, [
      ['carpetas', T('En carpetas', 'In folders')],
      ['junto', T('Todo junto', 'All together')],
    ].map(([v, lbl]) => el('button', {
      class: 'car-step__btn car-step__btn--seg' + (zipModo === v ? ' is-active' : ''), type: 'button', text: lbl,
      onclick: () => { if (zipModo !== v) { zipModo = v; prefs.set('carZipModo', v); render(); } },
    }))),
  ]) : null;
  rootEl.appendChild(el('div', { class: 'car-controls car-controls--global' }, [
    zipSeg,
    el('span', { class: 'car-info', text: `${vtiras.length} ${vtiras.length === 1 ? T('tira', 'strip') : T('tiras', 'strips')} · ${totalReales} videos` + (totalHuecos ? ` · ${totalHuecos} ${totalHuecos === 1 ? T('hueco omitido', 'blank skipped') : T('huecos omitidos', 'blanks skipped')}` : '') }),
  ]));
  if (porCortar.length > 1) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: cutTodasLasTirasVideo }, [
        icon('gantt', 16), ` ${T('Cortar todas', 'Cut all')} (${porCortar.length} ${T('tiras', 'strips')})`,
      ]),
    ]));
  }
  if (totalCortados) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: downloadVideoZip }, [
        icon('archive', 16), ` ${T('Descargar todos', 'Download all')} (ZIP · ${totalCortados})`,
      ]),
      el('span', {
        class: 'car-hint',
        text: cortadas.length === 1
          ? T('O descarga uno por uno abajo. En iPhone se guardan en Archivos/Descargas.', 'Or download them one by one below. On iPhone they save to Files/Downloads.')
          : zipModo === 'carpetas'
          ? T('Un solo ZIP con una carpeta por carrusel.', 'A single ZIP with one folder per carousel.')
          : T('Un solo ZIP con todos los videos sueltos, sin carpetas.', 'A single ZIP with all videos loose, no folders.'),
      }),
    ]));
  }

  // ── Una tarjeta por tira ─────────────────────────────────────────────────
  for (const t of vtiras) {
    const busy = t.phase === 'cargando' || t.phase === 'analizando' || t.phase === 'cortando';
    const reales = slidesRealesDe(t.paginas).length;
    const huecos = huecosDe(t.paginas);
    const pg0 = t.paginas[0];
    const sw = pg0 ? Math.floor(pg0.video.videoWidth / pg0.cols) : 0;
    const sh = pg0 ? Math.floor(pg0.video.videoHeight / pg0.rows) : 0;
    const card = el('section', { class: 'car-tira' + (busy ? ' is-busy' : '') }, [
      el('div', { class: 'car-tira__head' }, [
        el('strong', { class: 'car-tira__name', text: t.name }),
        el('span', { class: 'car-info', text: pg0
          ? `${reales} ${T('videos de', 'videos of')} ${sw}×${sh}px` + (huecos ? ` · ${huecos} ${huecos === 1 ? T('hueco', 'blank') : T('huecos', 'blanks')}` : '') + (t.paginas.length > 1 ? ` · ${t.paginas.length} ${T('archivos unidos', 'files merged')}` : '')
          : T('Leyendo…', 'Reading…') }),
        el('button', {
          class: 'car-tira__x', type: 'button',
          'aria-label': `${T('Quitar', 'Remove')} ${t.name}`, title: T('Quitar esta tira', 'Remove this strip'),
          onclick: () => quitarVTira(t.id),
        }, [icon('close', 14)]),
      ]),
    ]);

    // Cada página: su video con la cuadrícula encima y sus columnas/filas.
    t.paginas.forEach((pg, pi) => {
      pg.video.className = 'car-vpreview__vid';
      pg.video.setAttribute('muted', ''); pg.video.setAttribute('playsinline', '');
      card.appendChild(el('div', { class: 'car-preview car-vpreview' }, [pg.video, ...gridLinesFor(pg.cols, pg.rows)]));
      card.appendChild(el('div', { class: 'car-controls' }, [
        t.paginas.length > 1 ? el('span', { class: 'car-info car-info--pag', text: `${T('Archivo', 'File')} ${pi + 1}: ${pg.file.name}` }) : null,
        stepper(T('Columnas', 'Columns'), () => pg.cols, (v) => { pg.cols = v; }, 1, MAX_COLS, () => enColaVideo(() => analyzeTira(t))),
        stepper(T('Filas', 'Rows'), () => pg.rows, (v) => { pg.rows = v; }, 1, MAX_ROWS, () => enColaVideo(() => analyzeTira(t))),
        pi === 0 ? stepper('Zoom', () => t.zoom, (v) => { t.zoom = v; }, 100, 140, () => render(), 2, (x) => `${x}%`) : null,
      ].filter(Boolean)));
    });
    if (t.zoom > 100) card.appendChild(el('div', { class: 'car-hint', text: T(`Zoom ${t.zoom}%: recorta un poco la orilla para tapar la línea del slide de al lado. Se aplica al cortar.`, `Zoom ${t.zoom}%: trims the edge a bit to hide the line from the next slide. Applied when cutting.`) }));

    if (busy) {
      const bar = el('span', { class: 'car-prog__bar', style: `width:${Math.round(t.progress * 100)}%` });
      vProgressEls.set(t.id, bar);
      card.appendChild(el('div', { class: 'car-prog' }, [
        el('span', { class: 'car-prog__lbl', text: t.phase === 'cargando' ? T('Leyendo el video…', 'Reading the video…') : t.phase === 'analizando' ? T('Midiendo cada slide…', 'Measuring each slide…') : T('Cortando los videos…', 'Cutting the videos…') }),
        el('span', { class: 'car-prog__track' }, [bar]),
      ]));
      rootEl.appendChild(card);
      continue;
    }

    // Duraciones detectadas (los huecos marcados) + botón para cortar.
    if (t.phase === 'listo' && !t.slides.length) {
      const chips = [];
      let num = 0;
      for (const pg of t.paginas) {
        pg.durations.forEach((d, i) => {
          const vacio = !!(pg.blancos && pg.blancos[i]);
          if (!vacio) num += 1;
          chips.push(el('span', { class: 'car-dur' + (vacio ? ' car-dur--vacio' : ''), title: vacio ? T('Este cuadro venía vacío: se omite', 'This frame was blank: skipped') : '' }, [
            el('span', { class: 'car-dur__n', text: vacio ? '·' : String(num) }),
            el('span', { class: 'car-dur__t', text: vacio ? T('vacío', 'blank') : fmtDur(d) }),
          ]));
        });
      }
      if (reales) {
        card.appendChild(el('div', { class: 'car-actions' }, [
          el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: () => enColaVideo(() => cutTiraVideo(t)) }, [
            icon('gantt', 16), ` ${T('Cortar en', 'Cut into')} ${reales} videos`,
          ]),
          el('span', { class: 'car-hint', text: T('Cada slide se recorta a su duración real (mínimo 3 s, lo que pide Instagram) y conserva el audio. Salen en MP4, alta calidad.', 'Each slide is trimmed to its real duration (3 s minimum, as Instagram requires) and keeps the audio. They come out as high-quality MP4.') }),
        ]));
      } else {
        card.appendChild(el('div', { class: 'car-warn' }, [el('strong', { text: T('Este video viene vacío: no hay nada que cortar.', 'This video is blank: nothing to cut.') })]));
      }
      card.appendChild(el('div', { class: 'car-durs' }, chips));
    }

    // Videos cortados.
    if (t.slides.length) {
      card.appendChild(el('div', { class: 'car-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => enColaVideo(() => cutTiraVideo(t)) }, [icon('refresh', 15), ' ' + T('Volver a cortar', 'Cut again')]),
      ]));
      card.appendChild(el('div', { class: 'car-grid' }, t.slides.map((sl, i) => el('figure', { class: 'car-slide' }, [
        el('video', { src: sl.url, class: 'car-slide__vid', muted: true, loop: true, playsinline: true, controls: true, preload: 'metadata' }),
        el('figcaption', { class: 'car-slide__bar' }, [
          el('span', { class: 'car-slide__num', text: `${i + 1} · ${fmtDur(sl.duration)}` }),
          el('button', {
            class: 'car-slide__dl', type: 'button', title: `${T('Descargar video', 'Download video')} ${i + 1}`,
            onclick: () => download(sl.blob, sl.name),
          }, [icon('down', 15), ' ' + T('Descargar', 'Download')]),
        ]),
      ]))));
    }
    rootEl.appendChild(card);
  }
}

export default {
  id: VIEW_ID,
  mount(host) {
    ensureCss();
    zipModo = prefs.get('carZipModo', 'carpetas') === 'junto' ? 'junto' : 'carpetas';
    rootEl = el('div', { class: 'car-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() {
    cutting += 1;
    freeSlides();
    freeVideoTiras();
    vProgressEls = new Map();
    resetGen();
    rootEl = null;
  },
};

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/carrusel.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/carrusel.css?v=202610010057';
  document.head.appendChild(link);
}
