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
import { el, clear, toast } from '../api.js?v=202608280019';
import { icon } from '../shell/icons.js?v=202608280019';
import { T } from '../shell/i18n.js?v=202608280019';
import { renderGen, resetGen } from './carrusel-gen.js?v=202608280019';
import * as prefs from '../shell/prefs.js?v=202608280019';

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
let vvideo = null;         // HTMLVideoElement con la tira de video
let vfile = null;          // File original (para decodificar el audio)
let vurl = '';
let vname = 'carrusel';
let vcols = 5;
let vrows = 1;
let vzoom = 100;           // % de zoom del encuadre para el corte de video
let vdur = 0;              // duración total de la tira (seg)
let vdurations = [];       // duración real detectada por slide (seg)
let vslides = [];          // [{ blob, url, name, duration, ext }]
let vphase = 'idle';       // 'idle' | 'analizando' | 'listo' | 'cortando'
let vprogress = 0;         // 0..1
let vtoken = 0;            // cancela pasadas viejas

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

function freeVideoSlides() {
  for (const s of vslides) { try { URL.revokeObjectURL(s.url); } catch { /* noop */ } }
  vslides = [];
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

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function buildZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  let cdSize = 0;
  for (const e of entries) {
    const data = new Uint8Array(await e.blob.arrayBuffer());
    const name = enc.encode(e.name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    cdSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

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
    const zip = await buildZip(entries);
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

function acceptVideoFile(file) {
  if (!file) return;
  if (!/^video\//i.test(file.type) && !/\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name || '')) {
    toast(T('Sube un video (MP4 o MOV) de la tira del carrusel.', 'Upload a video (MP4 or MOV) of the carousel strip.'), 'error');
    return;
  }
  if (!videoSupported()) {
    toast(T('Tu navegador no permite cortar video. Prueba en Chrome o Safari actualizado.', 'Your browser can\'t cut video. Try an up-to-date Chrome or Safari.'), 'error');
    return;
  }
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  v.onloadedmetadata = () => {
    if (vurl) { try { URL.revokeObjectURL(vurl); } catch { /* noop */ } }
    freeVideoSlides();
    vvideo = v; vurl = url; vfile = file; vname = baseName(file.name);
    vdur = v.duration && isFinite(v.duration) ? v.duration : 0;
    const g = detectGrid(v.videoWidth, v.videoHeight);
    vcols = g.cols; vrows = g.rows;
    vdurations = []; vphase = 'idle';
    analyzeDurations();
  };
  v.onerror = () => { URL.revokeObjectURL(url); toast(T('No se pudo leer el video. Prueba con un MP4.', 'Could not read the video. Try an MP4.'), 'error'); };
}

// Pasada 1: reproduce la tira una vez (muted) y mide la duración REAL de cada
// slide comparando su región cuadro a cuadro (recorta la cola congelada).
async function analyzeDurations() {
  const v = vvideo; if (!v) return;
  const token = ++vtoken;
  vphase = 'analizando'; vprogress = 0; freeVideoSlides(); render();

  const cols2 = vcols, rows2 = vrows, n = cols2 * rows2;
  const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
  const DW = 24, DH = 32, CHANGE = 10;
  const mc = document.createElement('canvas'); mc.width = DW; mc.height = DH;
  const mg = mc.getContext('2d', { willReadFrequently: true });
  const prev = new Array(n).fill(null);
  const lastChange = new Array(n).fill(0);
  let anyChange = new Array(n).fill(false);

  const sample = () => {
    const t = v.currentTime;
    for (let idx = 0; idx < n; idx++) {
      const c = idx % cols2, r = Math.floor(idx / cols2);
      mg.drawImage(v, c * sw, r * sh, sw, sh, 0, 0, DW, DH);
      const data = mg.getImageData(0, 0, DW, DH).data;
      const p = prev[idx];
      if (p) {
        let diff = 0;
        for (let k = 0; k < data.length; k += 4) diff += Math.abs(data[k] - p[k]) + Math.abs(data[k + 1] - p[k + 1]) + Math.abs(data[k + 2] - p[k + 2]);
        diff /= (DW * DH * 3);
        if (diff > CHANGE) { lastChange[idx] = t; anyChange[idx] = true; }
      }
      prev[idx] = data;
    }
    vprogress = vdur ? Math.min(1, t / vdur) : 0;
    if (vphase === 'analizando') updateVProgress();
  };

  await playThrough(v, sample, token);
  if (token !== vtoken) return;

  // Duración por slide: hasta el último cambio (+ colchón), mínimo 1s. Un slide
  // que nunca cambió (imagen fija dentro del video) toma la duración total.
  vdurations = lastChange.map((lc, idx) => {
    if (!anyChange[idx]) return vdur || 1;
    return Math.max(1, Math.min(vdur || lc + 0.2, lc + 0.2));
  });
  vphase = 'listo'; vprogress = 0;
  render();
}

// Reproduce el video 0→(fin o pausa) llamando onFrame(meta) en cada cuadro.
// meta.mediaTime = tiempo REAL del cuadro en la línea del video (no del reloj):
// clave para que el corte con WebCodecs salga a velocidad correcta en cualquier
// compu. onFrame puede pausar el video para terminar antes (recorte por slide).
function playThrough(v, onFrame, token) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { v.pause(); } catch { /* noop */ } resolve(); };
    const useRVFC = 'requestVideoFrameCallback' in v;
    let iv = null;
    const step = (now, metadata) => {
      if (token !== vtoken) { finish(); return; }
      onFrame(metadata);
      // onFrame puede haber pausado (recorte): terminar en cuanto pare o acabe.
      if (v.ended || v.paused) { finish(); return; }
      if (useRVFC) v.requestVideoFrameCallback(step);
    };
    v.onended = finish;
    const begin = () => {
      if (token !== vtoken) { finish(); return; }
      v.play().then(() => {
        if (token !== vtoken) { finish(); return; }
        if (useRVFC) v.requestVideoFrameCallback(step);
        else iv = setInterval(() => {
          if (token !== vtoken || v.ended || v.paused) { clearInterval(iv); finish(); return; }
          onFrame({ mediaTime: v.currentTime });
        }, 1000 / 30);
      }).catch(() => { if (iv) clearInterval(iv); finish(); });
    };
    // Regresa al inicio y ESPERA a que el cuadro esté decodificado antes de
    // grabar: si arrancamos durante el reposicionamiento, el primer cuadro sale
    // NEGRO. Con esto el primer cuadro grabado ya es contenido real.
    if (v.currentTime <= 0.02 && v.readyState >= 2) { begin(); return; }
    let seeked = false;
    const onSeeked = () => { if (seeked) return; seeked = true; v.removeEventListener('seeked', onSeeked); begin(); };
    v.addEventListener('seeked', onSeeked);
    try { v.currentTime = 0; } catch { onSeeked(); }
    setTimeout(onSeeked, 700); // salvavidas si 'seeked' no dispara
  });
}

// Router del corte: WebCodecs (independiente de la compu) si está disponible;
// si no, o si falla, cae al respaldo con MediaRecorder.
async function cutVideoSlides() {
  const canWC = typeof window.VideoEncoder !== 'undefined' && typeof window.VideoFrame !== 'undefined';
  if (canWC) {
    try { await cutVideoWebCodecs(); return; }
    catch (e) {
      console.error('[carrusel] WebCodecs falló, uso respaldo:', e);
      // Que NO se rinda en silencio: si el motor bueno falla (p. ej. en Safari),
      // avisamos el porqué — así el video de respaldo, que WhatsApp no descarga
      // bien, no toma al usuario por sorpresa.
      toast(T('El motor principal falló, usé el de respaldo (esos videos pueden no descargarse en WhatsApp). Detalle: ', 'The main engine failed, so the fallback was used (those videos may not download in WhatsApp). Detail: ') + ((e && e.message) || T('desconocido', 'unknown')), 'error', 10000);
      vtoken += 1;
    }
  }
  await cutVideoMediaRecorder();
}

// Decodifica el audio de la tira UNA vez (rápido, no en tiempo real). Devuelve
// un AudioBuffer, o null si el video no tiene audio o el navegador no puede.
async function decodeAudioSafe(file) {
  if (!file || typeof window.AudioEncoder === 'undefined' || typeof window.AudioData === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx = null;
  try {
    const buf = await file.arrayBuffer();
    ctx = new AC();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    return (audio && audio.length > 0) ? audio : null;
  } catch { return null; }
  finally { if (ctx) { try { ctx.close(); } catch { /* noop */ } } }
}

// Codifica en AAC el tramo [0, dur] del audio y lo mete al muxer del slide.
async function encodeAudioForSlide(audioBuf, dur, muxer) {
  const sr = audioBuf.sampleRate, ch = Math.max(1, audioBuf.numberOfChannels);
  const total = Math.min(audioBuf.length, Math.floor(dur * sr));
  if (total <= 0) return;
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(audioBuf.getChannelData(c));
  let aerr = null;
  const aenc = new window.AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aerr = e; } },
    error: (e) => { aerr = e; },
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 128_000 });
  const BLK = 4096;
  for (let off = 0; off < total; off += BLK) {
    const nf = Math.min(BLK, total - off);
    const data = new Float32Array(nf * ch); // planar: [ch0…, ch1…]
    for (let c = 0; c < ch; c++) data.set(chans[c].subarray(off, off + nf), c * nf);
    const ad = new window.AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: nf, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush(); aenc.close();
  if (aerr) throw aerr;
}

// Codifica `dur` segundos de SILENCIO en AAC. Se usa cuando la tira es muda, para
// que TODO slide salga con pista de audio: un MP4 sin audio es justo lo que hacía
// que WhatsApp no lo pudiera descargar/compartir (los videos normales siempre
// llevan audio). Con silencio, el video sale "normal" y se comparte sin error.
async function encodeSilentAudio(dur, muxer, sr, ch) {
  const total = Math.max(1, Math.floor(dur * sr));
  let aerr = null;
  const aenc = new window.AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aerr = e; } },
    error: (e) => { aerr = e; },
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 96_000 });
  const BLK = 4096;
  for (let off = 0; off < total; off += BLK) {
    const nf = Math.min(BLK, total - off);
    const data = new Float32Array(nf * ch); // ceros = silencio (planar)
    const ad = new window.AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: nf, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush(); aenc.close();
  if (aerr) throw aerr;
}

// MÉTODO PRINCIPAL — WebCodecs: a cada cuadro le pone su TIEMPO REAL del video
// (no el del reloj de pared). Aunque la compu vaya lenta y capture menos cuadros,
// el video sale con la DURACIÓN CORRECTA (nunca en cámara lenta). Conserva el
// audio de la tira (recortado por slide). Salida MP4.
async function cutVideoWebCodecs() {
  const v = vvideo; if (!v || !vdurations.length) return;
  const token = ++vtoken;
  vphase = 'cortando'; vprogress = 0; freeVideoSlides(); render();

  const { Muxer, ArrayBufferTarget } = await import('../vendor/mp4-muxer.mjs?v=202608280019');
  const cols2 = vcols, rows2 = vrows, n = cols2 * rows2;
  const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
  const sw2 = sw - (sw % 2), sh2 = sh - (sh % 2); // H.264 exige dimensiones pares

  // Elige el códec H.264 MÁS COMPATIBLE que soporte el tamaño. Prioridad:
  // Main 4.0 → Baseline 4.0 → Main 5.1 → Baseline 5.1 → (último recurso) High.
  // WhatsApp / iOS / Android reproducen y comparten Main y Baseline sin problema;
  // el perfil High daba error al compartir en algunos teléfonos.
  let codec = null;
  for (const cc of ['avc1.4d0028', 'avc1.42e028', 'avc1.4d0033', 'avc1.42e033', 'avc1.640028', 'avc1.42e01e']) {
    try {
      const s = await window.VideoEncoder.isConfigSupported({ codec: cc, width: sw2, height: sh2, bitrate: 10_000_000 });
      if (s && s.supported) { codec = cc; break; }
    } catch { /* noop */ }
  }
  if (!codec) throw new Error(T('sin códec H.264 soportado', 'no supported H.264 codec'));

  // Audio de la tira (una sola decodificación para todos los slides).
  const audioBuf = await decodeAudioSafe(vfile);
  const hasAudio = !!audioBuf;
  // TODA salida lleva pista de audio (silenciosa si la tira es muda). Un MP4 sin
  // audio es lo que impedía descargar/compartir en WhatsApp.
  const canAudio = typeof window.AudioEncoder !== 'undefined' && typeof window.AudioData !== 'undefined';
  const aSr = hasAudio ? audioBuf.sampleRate : 44100;
  const aCh = hasAudio ? Math.max(1, audioBuf.numberOfChannels) : 2;

  const out = new Array(n);
  for (let idx = 0; idx < n; idx++) {
    if (token !== vtoken) return;
    const c = idx % cols2, r = Math.floor(idx / cols2);
    const dur = Math.max(0.3, vdurations[idx]);
    const cv = document.createElement('canvas'); cv.width = sw2; cv.height = sh2;
    const cx = cv.getContext('2d');
    const muxerCfg = {
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: sw2, height: sh2 },
      fastStart: 'in-memory',
    };
    if (canAudio) muxerCfg.audio = { codec: 'aac', numberOfChannels: aCh, sampleRate: aSr };
    const muxer = new Muxer(muxerCfg);
    let encErr = null;
    const encoder = new window.VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encErr = e; } },
      error: (e) => { encErr = e; },
    });
    encoder.configure({ codec, width: sw2, height: sh2, bitrate: 10_000_000, framerate: 30, latencyMode: 'realtime', avc: { format: 'avc' } });

    // Línea de tiempo a 30fps CONSTANTE (CFR): cada cuadro se ancla a la rejilla
    // de 1/30s según su tiempo REAL en el video. Así conserva la velocidad correcta
    // en cualquier compu Y produce un frame-rate estable con duración de cuadro bien
    // definida — que es justo lo que WhatsApp/iOS necesitan para reproducir y
    // compartir sin error (los tiempos variables generaban cuadros irregulares).
    const FPS = 30, FDUR = Math.round(1e6 / FPS);
    let lastIdx = -1, t0 = null, frames = 0;
    await playThrough(v, (meta) => {
      const mt = (meta && typeof meta.mediaTime === 'number') ? meta.mediaTime : v.currentTime;
      if (mt > dur + 0.05) { try { v.pause(); } catch { /* noop */ } return; }
      if (t0 === null) t0 = mt;
      const fidx = Math.round((mt - t0) * FPS);
      if (fidx <= lastIdx) { // fuente a >30fps: descarta el cuadro sobrante (mantiene la velocidad)
        vprogress = (idx + Math.min(1, mt / dur)) / n; updateVProgress(); return;
      }
      lastIdx = fidx;
      const ts = fidx * FDUR;
      const z = zoomSrc(c * sw, r * sh, sw, sh, vzoom);
      cx.drawImage(v, z.sx, z.sy, z.sw, z.sh, 0, 0, sw2, sh2);
      try {
        const vf = new window.VideoFrame(cv, { timestamp: ts, duration: FDUR });
        encoder.encode(vf, { keyFrame: frames % 30 === 0 }); // IDR al inicio y cada ~1s
        vf.close();
        frames += 1;
      } catch (e) { encErr = e; try { v.pause(); } catch { /* noop */ } }
      vprogress = (idx + Math.min(1, mt / dur)) / n;
      updateVProgress();
    }, token);

    if (encErr) { try { encoder.close(); } catch { /* noop */ } throw encErr; }
    if (!frames) throw new Error(T('no se capturó ningún cuadro', 'no frames were captured'));
    await encoder.flush();
    encoder.close();
    // Audio del slide: el real de la tira, o SILENCIO si es muda (siempre hay pista).
    if (canAudio) {
      try {
        if (hasAudio) await encodeAudioForSlide(audioBuf, dur, muxer);
        else await encodeSilentAudio(dur, muxer, aSr, aCh);
      } catch (e) { console.error('[carrusel] audio slide', e && e.message); }
    }
    muxer.finalize();
    out[idx] = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }
  if (token !== vtoken) return;

  freeVideoSlides();
  vslides = out.map((b, idx) => ({
    blob: b, url: URL.createObjectURL(b),
    name: `${vname}-${String(idx + 1).padStart(2, '0')}.mp4`,
    duration: vdurations[idx], ext: 'mp4',
  }));
  vphase = 'listo'; vprogress = 0;
  render();
}

// RESPALDO — MediaRecorder: graba UN slide a la vez. Fiable pero grava en tiempo
// real, así que depende algo de la potencia de la compu (por eso WebCodecs va
// primero). Se usa solo si el navegador no soporta WebCodecs.
async function cutVideoMediaRecorder() {
  const v = vvideo; if (!v || !vdurations.length) return;
  const token = ++vtoken;
  vphase = 'cortando'; vprogress = 0; freeVideoSlides(); render();

  const cols2 = vcols, rows2 = vrows, n = cols2 * rows2;
  const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
  const { mime, ext } = pickVideoMime();
  const durations = vdurations.slice();
  const out = new Array(n);

  for (let idx = 0; idx < n; idx++) {
    if (token !== vtoken) return;
    const c = idx % cols2, r = Math.floor(idx / cols2);
    const dur = Math.max(0.3, durations[idx]);
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const cx = cv.getContext('2d');
    const stream = (cv.captureStream || cv.mozCaptureStream).call(cv, 30);
    // Pista de audio SILENCIOSA en el stream: así la grabación siempre lleva audio
    // (un video sin audio no se puede descargar/compartir en WhatsApp).
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
    try { rec = new MediaRecorder(stream, opts); }
    catch { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime || 'video/webm' })); });

    let stopped = false, started = false;
    await playThrough(v, () => {
      const t = v.currentTime;
      if (t <= dur + 0.05) {
        const z = zoomSrc(c * sw, r * sh, sw, sh, vzoom);
        cx.drawImage(v, z.sx, z.sy, z.sw, z.sh, 0, 0, sw, sh);
        // Arranca la grabación con el PRIMER cuadro ya dibujado (evita negro).
        if (!started) { started = true; try { rec.start(); } catch { /* noop */ } }
      } else if (!stopped) {
        stopped = true;
        try { rec.stop(); } catch { /* noop */ }
        try { v.pause(); } catch { /* noop */ }
      }
      vprogress = (idx + (dur ? Math.min(1, t / dur) : 1)) / n;
      updateVProgress();
    }, token);
    if (started && !stopped) { try { rec.stop(); } catch { /* noop */ } }
    out[idx] = started ? await done : new Blob([], { type: mime || 'video/webm' });
    try { if (silentCtx) await silentCtx.close(); } catch { /* noop */ }
  }
  if (token !== vtoken) return;

  freeVideoSlides();
  vslides = out.map((b, idx) => ({
    blob: b, url: URL.createObjectURL(b),
    name: `${vname}-${String(idx + 1).padStart(2, '0')}.${ext}`,
    duration: durations[idx], ext,
  }));
  vphase = 'listo'; vprogress = 0;
  render();
}

async function downloadVideoZip() {
  if (!vslides.length) return;
  try {
    const zip = await buildZip(vslides);
    download(zip, `${vname}-videos.zip`);
    toast(T(`ZIP con ${vslides.length} videos descargado.`, `ZIP with ${vslides.length} videos downloaded.`), 'success');
  } catch (e) {
    console.error('[carrusel] zip video', e);
    toast(T('No se pudo armar el ZIP. Descarga los videos uno por uno.', 'Could not build the ZIP. Download the videos one by one.'), 'error');
  }
}

// Actualiza SOLO la barra de progreso sin re-render (para no cortar el video).
let vProgressEl = null;
function updateVProgress() {
  if (vProgressEl) vProgressEl.style.width = `${Math.round(vprogress * 100)}%`;
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
function zoomSrc(baseX, baseY, w, h, zPct) {
  const z = Math.max(1, (zPct || 100) / 100);
  const zw = w / z, zh = h / z;
  return { sx: baseX + (w - zw) / 2, sy: baseY + (h - zh) / 2, sw: zw, sh: zh };
}

function gridLinesFor(c, r) {
  const lines = [];
  for (let i = 1; i < c; i++) lines.push(el('span', { class: 'car-line car-line--v', style: `left:${(i / c) * 100}%` }));
  for (let i = 1; i < r; i++) lines.push(el('span', { class: 'car-line car-line--h', style: `top:${(i / r) * 100}%` }));
  return lines;
}

function render() {
  if (!rootEl) return;
  vProgressEl = null;
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
  else if (mode === 'gen') { const host = el('div'); rootEl.appendChild(host); renderGen(host, { canvasToBlob, buildZip, download }); }
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
  // Sin WebCodecs (Safari) el corte cae a MediaRecorder → MP4 FRAGMENTADO y SIN AUDIO
  // que WhatsApp no puede descargar. Avisamos claro que corten en Chrome.
  const noWebCodecs = typeof window.VideoEncoder === 'undefined' || typeof window.VideoFrame === 'undefined';
  if (noWebCodecs) {
    rootEl.appendChild(el('div', { class: 'car-warn' }, [
      el('strong', { text: T('⚠️ Abre esta página en Chrome para cortar los videos.', '⚠️ Open this page in Chrome to cut the videos.') }),
      el('span', { text: T(' En este navegador (Safari) los cortes salen en un formato sin audio que WhatsApp no puede descargar. En Chrome salen normales y se comparten sin problema.', ' In this browser (Safari) the cuts come out in an audio-less format that WhatsApp can\'t download. In Chrome they come out normal and share without issues.') }),
    ]));
  }
  const busy = vphase === 'analizando' || vphase === 'cortando';
  const input = el('input', {
    class: 'car-file', type: 'file', accept: 'video/mp4,video/quicktime,video/webm',
    onchange: (e) => { acceptVideoFile(e.target.files && e.target.files[0]); e.target.value = ''; },
  });
  const drop = el('div', {
    class: 'car-drop' + (vvideo ? ' car-drop--mini' : '') + (busy ? ' is-busy' : ''),
    role: 'button', tabindex: '0',
    onclick: () => { if (!busy) input.click(); },
    onkeydown: (e) => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); if (!busy) drop.classList.add('is-over'); },
    ondragleave: () => drop.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('is-over'); if (!busy) acceptVideoFile(e.dataTransfer.files && e.dataTransfer.files[0]); },
  }, [
    icon('gantt', vvideo ? 18 : 26),
    el('div', { class: 'car-drop__txt' }, [
      el('strong', { text: vvideo ? T('Subir otro video', 'Upload another video') : T('Toca para subir la tira de video', 'Tap to upload the video strip') }),
      vvideo ? null : el('span', { text: T('MP4 o MOV · los clips cortos pegados en fila (por ejemplo 5)', 'MP4 or MOV · the short clips joined in a row (for example 5)') }),
    ]),
    input,
  ]);
  rootEl.appendChild(drop);
  if (!vvideo) return;

  // Preview: el propio <video> con la cuadrícula encima.
  vvideo.className = 'car-vpreview__vid';
  vvideo.setAttribute('muted', '');
  vvideo.setAttribute('playsinline', '');
  rootEl.appendChild(el('div', { class: 'car-preview car-vpreview' }, [vvideo, ...gridLinesFor(vcols, vrows)]));

  const sw = Math.floor(vvideo.videoWidth / vcols), sh = Math.floor(vvideo.videoHeight / vrows);
  rootEl.appendChild(el('div', { class: 'car-controls' }, [
    stepper(T('Columnas', 'Columns'), () => vcols, (v) => { vcols = v; }, 1, MAX_COLS, analyzeDurations),
    stepper(T('Filas', 'Rows'), () => vrows, (v) => { vrows = v; }, 1, MAX_ROWS, analyzeDurations),
    stepper('Zoom', () => vzoom, (v) => { vzoom = v; }, 100, 140, () => render(), 2, (x) => `${x}%`),
    el('span', { class: 'car-info', text: `${vcols * vrows} ${T('slides de', 'slides of')} ${sw}×${sh}px` }),
  ]));
  if (vzoom > 100) rootEl.appendChild(el('div', { class: 'car-hint', text: T(`Zoom ${vzoom}%: recorta un poco la orilla para tapar la línea del slide de al lado. Se aplica al cortar.`, `Zoom ${vzoom}%: trims the edge a bit to hide the line from the next slide. Applied when cutting.`) }));

  // Barra de progreso (analizando / cortando).
  if (busy) {
    vProgressEl = el('span', { class: 'car-prog__bar', style: `width:${Math.round(vprogress * 100)}%` });
    rootEl.appendChild(el('div', { class: 'car-prog' }, [
      el('span', { class: 'car-prog__lbl', text: vphase === 'analizando' ? T('Midiendo cada slide…', 'Measuring each slide…') : T('Cortando los videos…', 'Cutting the videos…') }),
      el('span', { class: 'car-prog__track' }, [vProgressEl]),
    ]));
    return;
  }

  // Duraciones detectadas + botón para cortar.
  if (vdurations.length && !vslides.length) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: cutVideoSlides }, [
        icon('gantt', 16), ` ${T('Cortar en', 'Cut into')} ${vcols * vrows} videos`,
      ]),
      el('span', { class: 'car-hint', text: T('Cada slide se recorta a su duración real y conserva el audio de la tira. Salen en MP4, alta calidad.', 'Each slide is trimmed to its real duration and keeps the strip\'s audio. They come out as high-quality MP4.') }),
    ]));
    rootEl.appendChild(el('div', { class: 'car-durs' }, vdurations.map((d, i) => el('span', { class: 'car-dur' }, [
      el('span', { class: 'car-dur__n', text: String(i + 1) }),
      el('span', { class: 'car-dur__t', text: fmtDur(d) }),
    ]))));
    return;
  }

  // Videos cortados.
  if (vslides.length) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: downloadVideoZip }, [
        icon('archive', 16), ` ${T('Descargar todos', 'Download all')} (ZIP · ${vslides.length})`,
      ]),
      el('button', { class: 'btn', type: 'button', onclick: cutVideoSlides }, [icon('refresh', 15), ' ' + T('Volver a cortar', 'Cut again')]),
    ]));
    rootEl.appendChild(el('div', { class: 'car-grid' }, vslides.map((s, i) => el('figure', { class: 'car-slide' }, [
      el('video', { src: s.url, class: 'car-slide__vid', muted: true, loop: true, playsinline: true, controls: true, preload: 'metadata' }),
      el('figcaption', { class: 'car-slide__bar' }, [
        el('span', { class: 'car-slide__num', text: `${i + 1} · ${fmtDur(s.duration)}` }),
        el('button', {
          class: 'car-slide__dl', type: 'button', title: `${T('Descargar video', 'Download video')} ${i + 1}`,
          onclick: () => download(s.blob, s.name),
        }, [icon('down', 15), ' ' + T('Descargar', 'Download')]),
      ]),
    ]))));
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
    vtoken += 1;
    freeSlides();
    freeVideoSlides();
    resetGen();
    if (vurl) { try { URL.revokeObjectURL(vurl); } catch { /* noop */ } }
    if (vvideo) { try { vvideo.pause(); } catch { /* noop */ } }
    vvideo = null; vfile = null; vurl = ''; rootEl = null;
  },
};

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/carrusel.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/carrusel.css?v=202608280019';
  document.head.appendChild(link);
}
