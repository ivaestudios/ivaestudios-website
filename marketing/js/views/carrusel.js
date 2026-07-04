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
// TODO PASA EN EL NAVEGADOR (canvas + MediaRecorder): nada se sube a un
// servidor, por eso funciona igual en el cel que en la compu y no gasta datos.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202607040145';
import { icon } from '../shell/icons.js?v=202607040145';

const VIEW_ID = 'carrusel';
const MAX_COLS = 12;
const MAX_ROWS = 4;

let rootEl = null;
let mode = 'img';          // 'img' | 'video'

// ── Estado modo IMAGEN ───────────────────────────────────────────────────────
let img = null;            // HTMLImageElement con la tira cargada
let imgUrl = '';           // object URL de la tira (para el preview)
let imgName = 'carrusel';  // base para nombrar los slides
let cols = 5;
let rows = 1;
let fmt = 'jpg';           // 'jpg' | 'png'
let slides = [];           // [{ blob, url, name }]
let cutting = 0;           // token para descartar cortes viejos si cambian los controles

// ── Estado modo VIDEO ────────────────────────────────────────────────────────
let vvideo = null;         // HTMLVideoElement con la tira de video
let vurl = '';
let vname = 'carrusel';
let vcols = 5;
let vrows = 1;
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

function freeSlides() {
  for (const s of slides) { try { URL.revokeObjectURL(s.url); } catch { /* noop */ } }
  slides = [];
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

async function cutSlides() {
  if (!img) return;
  const token = ++cutting;
  freeSlides();
  render();
  const sw = Math.floor(img.naturalWidth / cols);
  const sh = Math.floor(img.naturalHeight / rows);
  const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const ext = fmt === 'png' ? 'png' : 'jpg';
  const out = [];
  try {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        n += 1;
        const canvas = document.createElement('canvas');
        canvas.width = sw; canvas.height = sh;
        const g = canvas.getContext('2d');
        g.drawImage(img, c * sw, r * sh, sw, sh, 0, 0, sw, sh);
        const blob = await canvasToBlob(canvas, type, 0.95);
        if (token !== cutting) return;
        const nn = String(n).padStart(2, '0');
        out.push({ blob, url: URL.createObjectURL(blob), name: `${imgName}-${nn}.${ext}` });
      }
    }
  } catch (e) {
    console.error('[carrusel] corte', e);
    toast('No se pudo cortar la imagen. Prueba con un PNG o JPG.', { type: 'error' });
    return;
  }
  if (token !== cutting) { for (const s of out) URL.revokeObjectURL(s.url); return; }
  slides = out;
  render();
}

async function downloadZip() {
  if (!slides.length) return;
  try {
    const zip = await buildZip(slides);
    download(zip, `${imgName}-slides.zip`);
    toast(`ZIP con ${slides.length} slides descargado.`, { type: 'success' });
  } catch (e) {
    console.error('[carrusel] zip', e);
    toast('No se pudo armar el ZIP. Descarga los slides uno por uno.', { type: 'error' });
  }
}

function acceptFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name || '')) {
    toast('Formato no soportado. Exporta el carrusel como PNG o JPG.', { type: 'error' });
    return;
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (imgUrl) { try { URL.revokeObjectURL(imgUrl); } catch { /* noop */ } }
    freeSlides();
    img = image;
    imgUrl = url;
    imgName = baseName(file.name);
    const g = detectGrid(image.naturalWidth, image.naturalHeight);
    cols = g.cols; rows = g.rows;
    cutSlides();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    toast('No se pudo leer la imagen. Exporta el carrusel como PNG o JPG.', { type: 'error' });
  };
  image.src = url;
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
    toast('Sube un video (MP4 o MOV) de la tira del carrusel.', { type: 'error' });
    return;
  }
  if (!videoSupported()) {
    toast('Tu navegador no permite cortar video. Prueba en Chrome o Safari actualizado.', { type: 'error' });
    return;
  }
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  v.onloadedmetadata = () => {
    if (vurl) { try { URL.revokeObjectURL(vurl); } catch { /* noop */ } }
    freeVideoSlides();
    vvideo = v; vurl = url; vname = baseName(file.name);
    vdur = v.duration && isFinite(v.duration) ? v.duration : 0;
    const g = detectGrid(v.videoWidth, v.videoHeight);
    vcols = g.cols; vrows = g.rows;
    vdurations = []; vphase = 'idle';
    analyzeDurations();
  };
  v.onerror = () => { URL.revokeObjectURL(url); toast('No se pudo leer el video. Prueba con un MP4.', { type: 'error' }); };
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

// Reproduce el video 0→fin llamando onFrame en cada cuadro. Resuelve al terminar.
function playThrough(v, onFrame, token) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { v.pause(); } catch { /* noop */ } resolve(); };
    const useRVFC = 'requestVideoFrameCallback' in v;
    let iv = null;
    const step = () => {
      if (token !== vtoken) { finish(); return; }
      onFrame();
      if (v.ended) { finish(); return; }
      if (useRVFC) v.requestVideoFrameCallback(step);
    };
    v.onended = finish;
    try { v.currentTime = 0; } catch { /* noop */ }
    v.play().then(() => {
      if (useRVFC) v.requestVideoFrameCallback(step);
      else iv = setInterval(() => { if (token !== vtoken || v.ended) { clearInterval(iv); finish(); } else onFrame(); }, 1000 / 30);
    }).catch(() => { if (iv) clearInterval(iv); finish(); });
  });
}

// Pasada 2: reproduce una vez y graba en paralelo un canvas por slide; cada
// grabadora se detiene al llegar a la duración real de su slide.
async function cutVideoSlides() {
  const v = vvideo; if (!v || !vdurations.length) return;
  const token = ++vtoken;
  vphase = 'cortando'; vprogress = 0; freeVideoSlides(); render();

  const cols2 = vcols, rows2 = vrows, n = cols2 * rows2;
  const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
  const { mime, ext } = pickVideoMime();
  const durations = vdurations.slice();
  const maxDur = Math.max(...durations, 0.5);

  const ctxs = [], recs = [], chunks = [], stopped = [], blobs = new Array(n);
  for (let idx = 0; idx < n; idx++) {
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    ctxs.push(cv.getContext('2d'));
    const stream = (cv.captureStream || cv.mozCaptureStream).call(cv, 30);
    const opts = { videoBitsPerSecond: 10_000_000 };
    if (mime) opts.mimeType = mime;
    let rec;
    try { rec = new MediaRecorder(stream, opts); }
    catch { rec = new MediaRecorder(stream); }
    const ch = []; chunks.push(ch);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) ch.push(e.data); };
    recs.push(rec); stopped.push(false);
  }
  const donePromises = recs.map((rec, idx) => new Promise((res) => {
    rec.onstop = () => { blobs[idx] = new Blob(chunks[idx], { type: mime || 'video/webm' }); res(); };
  }));

  // Primer cuadro en cada canvas antes de arrancar (evita frame negro inicial).
  try { v.currentTime = 0; } catch { /* noop */ }
  recs.forEach((rec) => { try { rec.start(); } catch { /* noop */ } });

  const draw = () => {
    const t = v.currentTime;
    for (let idx = 0; idx < n; idx++) {
      const c = idx % cols2, r = Math.floor(idx / cols2);
      if (t <= durations[idx] + 0.05) {
        ctxs[idx].drawImage(v, c * sw, r * sh, sw, sh, 0, 0, sw, sh);
      } else if (!stopped[idx]) {
        stopped[idx] = true;
        try { recs[idx].stop(); } catch { /* noop */ }
      }
    }
    vprogress = maxDur ? Math.min(1, t / maxDur) : 0;
    updateVProgress();
    if (v.currentTime >= maxDur - 0.02) { try { v.pause(); } catch { /* noop */ } }
  };

  await playThrough(v, draw, token);
  recs.forEach((rec, idx) => { if (!stopped[idx]) { try { rec.stop(); } catch { /* noop */ } } });
  await Promise.all(donePromises);
  if (token !== vtoken) { blobs.forEach((b) => b && b.size); return; }

  freeVideoSlides();
  vslides = blobs.map((b, idx) => ({
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
    toast(`ZIP con ${vslides.length} videos descargado.`, { type: 'success' });
  } catch (e) {
    console.error('[carrusel] zip video', e);
    toast('No se pudo armar el ZIP. Descarga los videos uno por uno.', { type: 'error' });
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
    }, [icon('camera', 15), ' Imágenes']),
    el('button', {
      class: 'car-modeseg__btn' + (mode === 'video' ? ' is-active' : ''), type: 'button', role: 'tab',
      onclick: () => { if (mode !== 'video') { mode = 'video'; render(); } },
    }, [icon('gantt', 15), ' Video']),
  ]);
}

function stepper(label, get, set, min, max, onChange) {
  const val = el('span', { class: 'car-step__val', text: String(get()) });
  const mk = (txt, d) => el('button', {
    class: 'car-step__btn', type: 'button', 'aria-label': `${txt} ${label}`,
    onclick: () => { const v = Math.min(max, Math.max(min, get() + d)); if (v !== get()) { set(v); val.textContent = String(v); onChange(); } },
  }, [txt]);
  return el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: label }),
    el('div', { class: 'car-step__ctrl' }, [mk('−', -1), val, mk('+', 1)]),
  ]);
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
    el('h2', { class: 'car-title', text: 'Cortador de carruseles' }),
    el('p', {
      class: 'car-sub',
      text: mode === 'img'
        ? 'Sube la tira del carrusel (los slides pegados en fila) y descárgalos ya cortados, listos para publicar. Todo pasa en tu dispositivo: no se sube a ningún lado.'
        : 'Sube la tira de VIDEO (los clips cortos pegados en fila) y córtala en videos verticales, uno por slide, con su duración real. Todo pasa en tu dispositivo: no se sube a ningún lado.',
    }),
  ]));
  rootEl.appendChild(modeToggle());

  if (mode === 'img') renderImg();
  else renderVideo();
}

function renderImg() {
  const input = el('input', {
    class: 'car-file', type: 'file', accept: 'image/png,image/jpeg,image/webp',
    onchange: (e) => { acceptFile(e.target.files && e.target.files[0]); e.target.value = ''; },
  });
  const drop = el('div', {
    class: 'car-drop' + (img ? ' car-drop--mini' : ''),
    role: 'button', tabindex: '0',
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add('is-over'); },
    ondragleave: () => drop.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('is-over'); acceptFile(e.dataTransfer.files && e.dataTransfer.files[0]); },
  }, [
    icon('camera', img ? 18 : 26),
    el('div', { class: 'car-drop__txt' }, [
      el('strong', { text: img ? 'Subir otra imagen' : 'Toca para subir la tira del carrusel' }),
      img ? null : el('span', { text: 'PNG o JPG · por ejemplo 5 slides en fila (también acepta 2 filas de 5)' }),
    ]),
    input,
  ]);
  rootEl.appendChild(drop);
  if (!img) return;

  rootEl.appendChild(el('div', { class: 'car-preview' }, [
    el('img', { src: imgUrl, alt: 'Tira del carrusel' }),
    ...gridLinesFor(cols, rows),
  ]));

  const sw = Math.floor(img.naturalWidth / cols);
  const sh = Math.floor(img.naturalHeight / rows);
  const fmtSeg = el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: 'Formato' }),
    el('div', { class: 'car-step__ctrl car-step__ctrl--seg' }, ['jpg', 'png'].map((f) => el('button', {
      class: 'car-step__btn car-step__btn--seg' + (fmt === f ? ' is-active' : ''), type: 'button', text: f.toUpperCase(),
      onclick: () => { if (fmt !== f) { fmt = f; cutSlides(); } },
    }))),
  ]);
  rootEl.appendChild(el('div', { class: 'car-controls' }, [
    stepper('Columnas', () => cols, (v) => { cols = v; }, 1, MAX_COLS, cutSlides),
    stepper('Filas', () => rows, (v) => { rows = v; }, 1, MAX_ROWS, cutSlides),
    fmtSeg,
    el('span', { class: 'car-info', text: `${cols * rows} slides de ${sw}×${sh}px` }),
  ]));

  if (!slides.length) { rootEl.appendChild(el('div', { class: 'car-cutting', text: 'Cortando…' })); return; }
  rootEl.appendChild(el('div', { class: 'car-actions' }, [
    el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: downloadZip }, [
      icon('archive', 16), ` Descargar todos (ZIP · ${slides.length})`,
    ]),
    el('span', { class: 'car-hint', text: 'O descarga uno por uno abajo. En iPhone se guardan en Archivos/Descargas.' }),
  ]));
  rootEl.appendChild(el('div', { class: 'car-grid' }, slides.map((s, i) => el('figure', { class: 'car-slide' }, [
    el('img', { src: s.url, alt: `Slide ${i + 1}`, loading: 'lazy' }),
    el('figcaption', { class: 'car-slide__bar' }, [
      el('span', { class: 'car-slide__num', text: String(i + 1) }),
      el('button', {
        class: 'car-slide__dl', type: 'button', title: `Descargar slide ${i + 1}`,
        onclick: () => download(s.blob, s.name),
      }, [icon('down', 15), ' Descargar']),
    ]),
  ]))));
}

function renderVideo() {
  if (!videoSupported()) {
    rootEl.appendChild(el('div', { class: 'car-cutting', text: 'Tu navegador no permite cortar video. Ábrelo en Chrome o en Safari actualizado.' }));
    return;
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
      el('strong', { text: vvideo ? 'Subir otro video' : 'Toca para subir la tira de video' }),
      vvideo ? null : el('span', { text: 'MP4 o MOV · los clips cortos pegados en fila (por ejemplo 5)' }),
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
    stepper('Columnas', () => vcols, (v) => { vcols = v; }, 1, MAX_COLS, analyzeDurations),
    stepper('Filas', () => vrows, (v) => { vrows = v; }, 1, MAX_ROWS, analyzeDurations),
    el('span', { class: 'car-info', text: `${vcols * vrows} slides de ${sw}×${sh}px` }),
  ]));

  // Barra de progreso (analizando / cortando).
  if (busy) {
    vProgressEl = el('span', { class: 'car-prog__bar', style: `width:${Math.round(vprogress * 100)}%` });
    rootEl.appendChild(el('div', { class: 'car-prog' }, [
      el('span', { class: 'car-prog__lbl', text: vphase === 'analizando' ? 'Midiendo cada slide…' : 'Cortando los videos…' }),
      el('span', { class: 'car-prog__track' }, [vProgressEl]),
    ]));
    return;
  }

  // Duraciones detectadas + botón para cortar.
  if (vdurations.length && !vslides.length) {
    rootEl.appendChild(el('div', { class: 'car-actions' }, [
      el('button', { class: 'btn btn-primary car-zip', type: 'button', onclick: cutVideoSlides }, [
        icon('gantt', 16), ` Cortar en ${vcols * vrows} videos`,
      ]),
      el('span', { class: 'car-hint', text: 'Cada slide se recorta a su duración real. Por ahora los videos salen sin audio.' }),
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
        icon('archive', 16), ` Descargar todos (ZIP · ${vslides.length})`,
      ]),
      el('button', { class: 'btn', type: 'button', onclick: cutVideoSlides }, [icon('refresh', 15), ' Volver a cortar']),
    ]));
    rootEl.appendChild(el('div', { class: 'car-grid' }, vslides.map((s, i) => el('figure', { class: 'car-slide' }, [
      el('video', { src: s.url, class: 'car-slide__vid', muted: true, loop: true, playsinline: true, controls: true, preload: 'metadata' }),
      el('figcaption', { class: 'car-slide__bar' }, [
        el('span', { class: 'car-slide__num', text: `${i + 1} · ${fmtDur(s.duration)}` }),
        el('button', {
          class: 'car-slide__dl', type: 'button', title: `Descargar video ${i + 1}`,
          onclick: () => download(s.blob, s.name),
        }, [icon('down', 15), ' Descargar']),
      ]),
    ]))));
  }
}

export default {
  id: VIEW_ID,
  mount(host) {
    ensureCss();
    rootEl = el('div', { class: 'car-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() {
    cutting += 1;
    vtoken += 1;
    freeSlides();
    freeVideoSlides();
    if (imgUrl) { try { URL.revokeObjectURL(imgUrl); } catch { /* noop */ } }
    if (vurl) { try { URL.revokeObjectURL(vurl); } catch { /* noop */ } }
    if (vvideo) { try { vvideo.pause(); } catch { /* noop */ } }
    img = null; imgUrl = ''; vvideo = null; vurl = ''; rootEl = null;
  },
};

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/carrusel.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/carrusel.css?v=202607040145';
  document.head.appendChild(link);
}
