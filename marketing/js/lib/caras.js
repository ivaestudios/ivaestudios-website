// ============================================================================
// IVAE Marketing — Detección de ROSTROS real para el generador de carruseles.
//
// Regla de Vianey (2026-08-06): el texto JAMÁS sobre una cara. Adivinar por
// tonos de piel no alcanzó — esto usa MediaPipe Face Detection AUTOALOJADO
// (marketing/vendor/mediapipe/, ~6 MB de wasm+modelos; el CSP de /marketing/*
// lleva 'wasm-unsafe-eval' exactamente para esto). Todo corre en el navegador:
// nada sale a ningún servidor.
//
// Devuelve rectángulos en coordenadas del LIENZO 1080×1350 después del
// cover-fit — es decir, DONDE SE VE la cara en el slide, que es lo único que
// le importa al fotómetro para vetar cajas de texto.
//
// Si el detector no carga (navegador viejo, wasm bloqueado), devuelve [] y el
// sistema cae con gracia a la heurística de piel de siempre.
// ============================================================================

const RUTA = '/marketing/vendor/mediapipe/';
const W = 1080, H = 1350;

let detectorPromise = null;
let cola = Promise.resolve();   // MediaPipe es de a una imagen a la vez

function cargarDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = new Promise((resolve) => {
    const sc = document.createElement('script');
    sc.src = RUTA + 'face_detection.js';
    sc.onload = () => {
      try {
        const fd = new window.FaceDetection({ locateFile: (f) => RUTA + f });
        // 'full' ve caras chicas y lejanas (niños en plano abierto).
        fd.setOptions({ model: 'full', minDetectionConfidence: 0.4 });
        resolve(fd);
      } catch (e) {
        console.warn('[caras] detector no inicializó:', e && e.message);
        resolve(null);
      }
    };
    sc.onerror = () => { console.warn('[caras] no se pudo cargar el detector'); resolve(null); };
    document.head.appendChild(sc);
  });
  return detectorPromise;
}

/**
 * Detecta rostros en un bitmap y los proyecta al lienzo 1080×1350 (cover-fit).
 * @returns {Promise<Array<{x:number,y:number,w:number,h:number}>>}
 */
export function detectarCaras(bmp) {
  if (!bmp) return Promise.resolve([]);
  // En cola: dos send() simultáneos corrompen el estado interno de MediaPipe.
  const turno = cola.then(() => detectar(bmp)).catch(() => []);
  cola = turno.catch(() => {});
  return turno;
}

async function detectar(bmp) {
  const fd = await cargarDetector();
  if (!fd) return [];
  const K = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const cw = Math.max(2, Math.round(bmp.width * K));
  const ch = Math.max(2, Math.round(bmp.height * K));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(bmp, 0, 0, cw, ch);

  const dets = await new Promise((resolve) => {
    let listo = false;
    const t = setTimeout(() => { if (!listo) { listo = true; resolve([]); } }, 9000);
    fd.onResults((r) => { if (!listo) { listo = true; clearTimeout(t); resolve(r.detections || []); } });
    fd.send({ image: cv }).catch(() => { if (!listo) { listo = true; clearTimeout(t); resolve([]); } });
  });

  // De coordenadas normalizadas de la FOTO → píxeles del LIENZO tras cover-fit.
  const e = Math.max(W / bmp.width, H / bmp.height);
  const dx = (W - bmp.width * e) / 2;
  const dy = (H - bmp.height * e) / 2;
  return dets.map((d) => {
    const b = d.boundingBox;
    return {
      x: (b.xCenter - b.width / 2) * bmp.width * e + dx,
      y: (b.yCenter - b.height / 2) * bmp.height * e + dy,
      w: b.width * bmp.width * e,
      h: b.height * bmp.height * e,
    };
  }).filter((c) => c.w > 26 && c.h > 26);
}

/** Resumen humano de dónde están las caras (viaja a la IA directora). */
export function resumenCaras(caras) {
  if (!caras || !caras.length) return '';
  const zonas = caras.map((c) => {
    const cy = (c.y + c.h / 2) / H;
    const v = cy < 0.36 ? 'arriba' : cy < 0.64 ? 'en medio' : 'abajo';
    const cx = (c.x + c.w / 2) / W;
    const hor = cx < 0.38 ? 'izquierda' : cx > 0.62 ? 'derecha' : 'centro';
    return `${v}-${hor}`;
  });
  return `Caras detectadas (${caras.length}): ${[...new Set(zonas)].join(', ')}.`;
}
