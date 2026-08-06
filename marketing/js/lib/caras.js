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
        fd.setOptions({ model: 'full', minDetectionConfidence: 0.35 });
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
  // Se detecta sobre el RECORTE cover-fit 1080×1350 — lo que DE VERDAD se ve
  // en el slide. Y con RESCATE DE INCLINACIÓN: BlazeFace pierde caras ladeadas
  // (niña riéndose con la cabeza echada atrás = 0 detecciones); si la pasada
  // frontal no ve nada, se reintenta con el lienzo girado ±25° y las cajas se
  // des-rotan al encuadre. La pasada frontal exitosa NO paga las 2 extra.
  const K = 0.75;
  const cw = Math.round(W * K);
  const ch = Math.round(H * K);
  const e = Math.max(cw / bmp.width, ch / bmp.height);
  const enviar = (cv) => new Promise((resolve) => {
    let listo = false;
    const t = setTimeout(() => { if (!listo) { listo = true; resolve([]); } }, 9000);
    fd.onResults((r) => { if (!listo) { listo = true; clearTimeout(t); resolve(r.detections || []); } });
    fd.send({ image: cv }).catch(() => { if (!listo) { listo = true; clearTimeout(t); resolve([]); } });
  });
  const todas = [];
  for (const ang of [0, -25, 25]) {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d');
    if (ang) {
      cx.translate(cw / 2, ch / 2);
      cx.rotate(ang * Math.PI / 180);
      cx.translate(-cw / 2, -ch / 2);
    }
    cx.drawImage(bmp, (cw - bmp.width * e) / 2, (ch - bmp.height * e) / 2, bmp.width * e, bmp.height * e);
    const dets = await enviar(cv);
    for (const det of dets) {
      const b = det.boundingBox;
      let caja = { x: (b.xCenter - b.width / 2) * cw, y: (b.yCenter - b.height / 2) * ch, w: b.width * cw, h: b.height * ch };
      if (ang) {
        // Des-rotar las 4 esquinas alrededor del centro y tomar el envolvente.
        const rad = -ang * Math.PI / 180; const px = cw / 2; const py = ch / 2;
        const pts = [[caja.x, caja.y], [caja.x + caja.w, caja.y], [caja.x, caja.y + caja.h], [caja.x + caja.w, caja.y + caja.h]]
          .map(([x, y]) => {
            const dx = x - px; const dy = y - py;
            return [px + dx * Math.cos(rad) - dy * Math.sin(rad), py + dx * Math.sin(rad) + dy * Math.cos(rad)];
          });
        const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
        caja = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        // El envolvente de un rect girado se INFLA por |cos|+|sin| (~1.33 a
        // 25°): se deflacta hacia el centro para recuperar el tamaño real —
        // sin esto, media foto quedaba "cara" y todo se volvía imposible.
        const rad2 = Math.abs(ang) * Math.PI / 180;
        const k = 1 / (Math.cos(rad2) + Math.sin(rad2));
        const dcx = caja.x + caja.w / 2; const dcy = caja.y + caja.h / 2;
        caja = { x: dcx - (caja.w * k) / 2, y: dcy - (caja.h * k) / 2, w: caja.w * k, h: caja.h * k };
      }
      todas.push({ x: caja.x / K, y: caja.y / K, w: caja.w / K, h: caja.h / K });
    }
    if (ang === 0 && todas.length) break;
  }
  // Dedupe: la misma cara vista en 2 pasadas se queda con la caja más grande.
  const unicas = [];
  for (const c of todas.sort((a, b) => b.w * b.h - a.w * a.h)) {
    const dup = unicas.some((u) => {
      const ix = Math.max(0, Math.min(u.x + u.w, c.x + c.w) - Math.max(u.x, c.x));
      const iy = Math.max(0, Math.min(u.y + u.h, c.y + c.h) - Math.max(u.y, c.y));
      return ix * iy > 0.4 * Math.min(u.w * u.h, c.w * c.h);
    });
    if (!dup) unicas.push(c);
  }
  return unicas.filter((c) => c.w > 26 && c.h > 26);
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
