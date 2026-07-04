// ============================================================================
// IVAE Marketing — Vista "Carrusel" (cortador de carruseles; solo staff).
//
// Flujo: subes la tira del carrusel (los slides pegados en fila, p. ej. 5 de
// 1080×1350; a veces en 2 filas de 5) → la app detecta la cuadrícula, corta
// cada slide a resolución original y los descargas 1 por 1 o todos en ZIP.
//
// TODO PASA EN EL NAVEGADOR (canvas): la imagen nunca se sube a un servidor,
// por eso funciona igual de rápido en el cel que en la compu y no gasta datos.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202607031955';
import { icon } from '../shell/icons.js?v=202607031955';

const VIEW_ID = 'carrusel';
const MAX_COLS = 12;
const MAX_ROWS = 4;

let rootEl = null;
let img = null;            // HTMLImageElement con la tira cargada
let imgUrl = '';           // object URL de la tira (para el preview)
let imgName = 'carrusel';  // base para nombrar los slides
let cols = 5;
let rows = 1;
let fmt = 'jpg';           // 'jpg' | 'png'
let slides = [];           // [{ blob, url, name }]
let cutting = 0;           // token para descartar cortes viejos si cambian los controles

// ── Utilidades ───────────────────────────────────────────────────────────────

function baseName(name) {
  const s = String(name || 'carrusel').replace(/\.[^.]+$/, '');
  const clean = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().replace(/\s+/g, '-');
  return (clean || 'carrusel').toLowerCase();
}

// Detección de la cuadrícula: prueba filas 1-4 × columnas 1-12 y se queda con
// la combinación cuyos slides queden más cerca de 4:5 (1080×1350), 1:1 o 9:16.
// En empates gana el formato 4:5 (una tira de 5400×1350 son 5 slides de IG,
// no 4 cuadrados) y luego la opción con MENOS slides (5 cuadrados = 1×5, no 2×10).
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

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* noop */ } }, 60000);
}

// ── ZIP (método STORE, sin compresión — los JPG/PNG ya vienen comprimidos) ──

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
    lh.setUint16(4, 20, true);         // versión mínima
    lh.setUint16(6, 0x0800, true);     // nombres UTF-8
    lh.setUint16(8, 0, true);          // método 0 = store
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

// ── Corte ────────────────────────────────────────────────────────────────────

async function cutSlides() {
  if (!img) return;
  const token = ++cutting;
  freeSlides();
  render(); // muestra "Cortando…"
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
        if (token !== cutting) return; // los controles cambiaron: descartar
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

// ── Carga de imagen ──────────────────────────────────────────────────────────

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

// ── UI ───────────────────────────────────────────────────────────────────────

function stepper(label, get, set, min, max) {
  const val = el('span', { class: 'car-step__val', text: String(get()) });
  const mk = (txt, d) => el('button', {
    class: 'car-step__btn', type: 'button', 'aria-label': `${txt} ${label}`,
    onclick: () => { const v = Math.min(max, Math.max(min, get() + d)); if (v !== get()) { set(v); val.textContent = String(v); cutSlides(); } },
  }, [txt]);
  return el('div', { class: 'car-step' }, [
    el('span', { class: 'car-step__lbl', text: label }),
    el('div', { class: 'car-step__ctrl' }, [mk('−', -1), val, mk('+', 1)]),
  ]);
}

function render() {
  if (!rootEl) return;
  clear(rootEl);

  const head = el('header', { class: 'car-head' }, [
    el('h2', { class: 'car-title', text: 'Cortador de carruseles' }),
    el('p', {
      class: 'car-sub',
      text: 'Sube la tira del carrusel (los slides pegados en fila) y descárgalos ya cortados, listos para publicar. Todo pasa en tu dispositivo: no se sube a ningún lado.',
    }),
  ]);
  rootEl.appendChild(head);

  // Zona de carga (siempre visible: sirve para cambiar de imagen).
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

  // Preview con la cuadrícula encima.
  const gridLines = [];
  for (let c = 1; c < cols; c++) gridLines.push(el('span', { class: 'car-line car-line--v', style: `left:${(c / cols) * 100}%` }));
  for (let r = 1; r < rows; r++) gridLines.push(el('span', { class: 'car-line car-line--h', style: `top:${(r / rows) * 100}%` }));
  rootEl.appendChild(el('div', { class: 'car-preview' }, [
    el('img', { src: imgUrl, alt: 'Tira del carrusel' }),
    ...gridLines,
  ]));

  // Controles: columnas / filas / formato + info del corte.
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
    stepper('Columnas', () => cols, (v) => { cols = v; }, 1, MAX_COLS),
    stepper('Filas', () => rows, (v) => { rows = v; }, 1, MAX_ROWS),
    fmtSeg,
    el('span', { class: 'car-info', text: `${cols * rows} slides de ${sw}×${sh}px` }),
  ]));

  // Slides cortados.
  if (!slides.length) {
    rootEl.appendChild(el('div', { class: 'car-cutting', text: 'Cortando…' }));
    return;
  }
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
    freeSlides();
    if (imgUrl) { try { URL.revokeObjectURL(imgUrl); } catch { /* noop */ } }
    img = null; imgUrl = ''; rootEl = null;
  },
};

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/carrusel.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/carrusel.css?v=202607031955';
  document.head.appendChild(link);
}
