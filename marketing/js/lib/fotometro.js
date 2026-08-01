// ============================================================================
// IVAE Marketing — FOTÓMETRO: la app aprende a VER la foto.
//
// Antes de escribir una sola letra, mide la imagen y decide DÓNDE va el texto y
// CÓMO tratarlo para que SIEMPRE se lea. Todo es aritmética determinista: mismo
// resultado siempre, 0 llamadas de red, 0 costo, ~10 ms. Nada sale del
// navegador.
//
// POR QUÉ NO SE LO PREGUNTAMOS A UNA IA (investigación 2026-08-01): ningún
// modelo de visión devuelve hoy coordenadas confiables — el mejor mide 0.181
// mIoU contra 0.773 de un detector especializado, y la propia documentación de
// Anthropic advierte que "las coordenadas de Claude son aproximadas". La IA es
// buenísima ELIGIENDO entre opciones y escribiendo; malísima diciendo "el texto
// va en este rectángulo". Así que la geometría se MIDE aquí y la IA (fase 2)
// solo elegirá entre lo que este módulo ya validó.
//
// LO QUE RESUELVE, en concreto:
//   · el velo fijo (opacidad .42 pase lo que pase) es el delator #1 de
//     "plantilla": ahoga las fotos oscuras y no salva a las claras. Aquí se
//     calcula el MÍNIMO necesario, foto por foto y zona por zona.
//   · sobre fondos muy claros (mármol, cielo quemado, pared de clínica) el
//     blanco NO alcanza ni con velo — es aritmética, no gusto. Por eso el
//     módulo puede cambiar a TEXTO OSCURO o a BANDA SÓLIDA de marca.
//   · el texto encima de una cara: se penaliza el detalle facial vía energía de
//     bordes + tono de piel (sin descargar modelos de 10 MB).
//
// Contrato de salida (por foto): ver analizarFoto().
// ============================================================================

// Rejilla de análisis. 24×30 celdas sobre 1080×1350 = celdas de 45×45 px:
// suficiente para distinguir "cielo" de "follaje" sin volverse ruido.
const COLS = 24;
const ROWS = 30;

// Márgenes seguros del diseño aprobado (los mismos 104 px del CSS) y la zona
// inferior que ocupan la paginación y el chevron.
const MARGEN = 104;
const RESERVA_ABAJO = 200;
const RESERVA_ARRIBA = 150; // header: @handle + marca + fecha

// ── Utilidades de color ──────────────────────────────────────────────────────

// Luminancia relativa WCAG (0..1). Es la que manda en los cálculos de contraste.
function lumRel(r, g, b) {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Contraste WCAG entre dos luminancias relativas (1..21).
function contraste(l1, l2) {
  const a = Math.max(l1, l2), b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

// Luminancia percibida rápida (0..255) para varianza/bordes: no necesita ser
// colorimétrica, solo consistente.
const luma = (r, g, b) => (r * 299 + g * 587 + b * 114) / 1000;

// Heurística de tono de piel (YCbCr). Barata y suficiente para PENALIZAR una
// zona, no para afirmar "aquí hay una cara". Se usa junto con energía de bordes:
// piel + mucho detalle = probablemente un rostro; piel + zona plana = un brazo,
// una pared beige, madera… y esas no son tan graves.
function esPiel(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

// ── Medición de la foto ──────────────────────────────────────────────────────

/**
 * Recorre la imagen UNA vez y devuelve las métricas por celda.
 * @param {ImageBitmap|HTMLImageElement} bmp
 * @returns {{cols:number, rows:number, lum:Float32Array, sigma:Float32Array, borde:Float32Array, piel:Float32Array}}
 */
function medirCeldas(bmp) {
  // Se analiza en chico (una celda ≈ 6×6 px de muestreo): 20× más rápido y las
  // métricas de zona no cambian. La foto original NUNCA se toca ni se degrada.
  const aw = COLS * 6, ah = ROWS * 6;
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(aw, ah)
    : Object.assign(document.createElement('canvas'), { width: aw, height: ah });
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  // cover-fit idéntico al del render, para que lo medido sea lo que se ve.
  const s = Math.max(aw / bmp.width, ah / bmp.height);
  ctx.drawImage(bmp, (aw - bmp.width * s) / 2, (ah - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
  const { data } = ctx.getImageData(0, 0, aw, ah);

  const n = COLS * ROWS;
  const lum = new Float32Array(n);      // luminancia WCAG media (0..1)
  const sigma = new Float32Array(n);    // desviación estándar de luma (0..255)
  const borde = new Float32Array(n);    // energía de bordes media
  const piel = new Float32Array(n);     // fracción de píxeles con tono de piel

  const cw = aw / COLS, ch = ah / ROWS;
  const lumaEn = (x, y) => {
    const i = (y * aw + x) * 4;
    return luma(data[i], data[i + 1], data[i + 2]);
  };

  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const x0 = Math.floor(cx * cw), y0 = Math.floor(cy * ch);
      const x1 = Math.min(aw, Math.floor((cx + 1) * cw)), y1 = Math.min(ah, Math.floor((cy + 1) * ch));
      let sumL = 0, sumY = 0, sumY2 = 0, sumB = 0, nPiel = 0, cnt = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * aw + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          sumL += lumRel(r, g, b);
          const Y = luma(r, g, b);
          sumY += Y; sumY2 += Y * Y;
          if (esPiel(r, g, b)) nPiel++;
          // Gradiente simple (|dx| + |dy|): detecta detalle sin costo de Sobel.
          if (x + 1 < aw && y + 1 < ah) {
            sumB += Math.abs(Y - lumaEn(x + 1, y)) + Math.abs(Y - lumaEn(x, y + 1));
          }
          cnt++;
        }
      }
      const k = cy * COLS + cx;
      if (!cnt) continue;
      lum[k] = sumL / cnt;
      const media = sumY / cnt;
      sigma[k] = Math.sqrt(Math.max(0, sumY2 / cnt - media * media));
      borde[k] = sumB / cnt;
      piel[k] = nPiel / cnt;
    }
  }
  return { cols: COLS, rows: ROWS, lum, sigma, borde, piel };
}

// ── Tratamientos posibles del texto ──────────────────────────────────────────
// El orden importa: se prefiere el que MENOS tapa la foto. Solo se baja al
// siguiente cuando el anterior no alcanza el contraste objetivo.
//
//  1. blanco sin velo        → fondo ya oscuro: la foto se ve entera.
//  2. blanco + velo mínimo   → lo habitual; se calcula la opacidad exacta.
//  3. texto oscuro           → fondo muy claro (mármol, cielo quemado, pared de
//                              clínica): el blanco JAMÁS gana ahí, por mucho
//                              velo que se le eche. Aquí gana el negro suave.
//  4. banda sólida de marca  → último recurso: fondo claro Y con mucho detalle
//                              (comida sobre mantel blanco, azulejo). Una banda
//                              limpia se ve intencional; un velo gris se ve mal.
// CALIBRACIÓN (medida con casos reales, 2026-08-01). WCAG define "texto
// grande" desde 24px y le pide 3:1 (AA) / 4.5:1 (AAA) — mucho menos que el
// 4.5/7 del texto chico. El título de este diseño mide 99px y el cuerpo 42px:
// TODO es texto grande. Exigirle 7:1 (como hacía la primera versión) obligaba a
// velos del 60% o a saltar a texto oscuro sobre un cielo azul donde el blanco
// se ve precioso — o sea, arruinaba la foto por una regla que no aplicaba.
const OBJETIVO = 4.5;   // AAA para texto grande: se lee impecable
const MINIMO = 3.0;     // AA para texto grande: piso absoluto, no se baja de aquí

const L_BLANCO = 1.0;                 // luminancia relativa del blanco puro
const L_OSCURO = lumRel(24, 24, 30);  // #18181E — negro suave de la marca

// Simula un velo oscuro de opacidad `a` sobre una luminancia de fondo `l`.
// El velo es #0C0C10 (el mismo del CSS), su luminancia es ~0.005.
const L_VELO = lumRel(12, 12, 16);
const conVelo = (l, a) => l * (1 - a) + L_VELO * a;
// Y un velo CLARO (para el modo de texto oscuro): #F7F7F5.
const L_VELO_CLARO = lumRel(247, 247, 245);
const conVeloClaro = (l, a) => l * (1 - a) + L_VELO_CLARO * a;

/**
 * Elige el tratamiento más suave que alcance el contraste objetivo.
 * @param {number} lFondo luminancia relativa media de la zona (0..1)
 * @param {number} lPeor  luminancia del punto MÁS desfavorable de la zona
 * @param {number} detalle energía de bordes media de la zona
 */
function elegirTratamiento(lFondo, lPeorClaro, detalle, lPeorOscuro) {
  // DIRECCIÓN DE MARCA (Vianey, 2026-08-01): "no me gusta el fondo blanco,
  // prefiero sombra negra letra blanca". Así que el texto SIEMPRE es blanco;
  // lo único que se decide aquí es CUÁNTA sombra hace falta para que se lea.
  // El texto oscuro sobre velo claro salió del sistema, y la banda de último
  // recurso es negra, nunca clara.
  //
  // El "peor punto" para el blanco es el más CLARO de la zona: un solo reflejo
  // basta para romper una palabra.
  // 1) ¿El blanco ya se lee tal cual? (fondo oscuro: la foto respira entera)
  if (contraste(L_BLANCO, lPeorClaro) >= OBJETIVO) {
    return { modo: 'blanco', velo: 0, contraste: contraste(L_BLANCO, lPeorClaro) };
  }
  // 2) Blanco + la sombra MÍNIMA que lo lleve al objetivo. El rango llega
  //    ahora a 0.86: en el look "moody" una foto muy oscurecida es parte del
  //    estilo, no un defecto — antes se cortaba en 0.62 y una playa a
  //    mediodía se iba a banda sólida.
  for (let a = 0.06; a <= 0.86; a += 0.02) {
    if (contraste(L_BLANCO, conVelo(lPeorClaro, a)) >= OBJETIVO) {
      return { modo: 'blanco', velo: Number(a.toFixed(2)), contraste: contraste(L_BLANCO, conVelo(lPeorClaro, a)) };
    }
  }
  // 3) Ni con 86% de sombra: banda negra. Contraste garantizado y se ve
  //    intencional, que es justo el lenguaje que pidió la marca.
  return { modo: 'banda', velo: 1, contraste: contraste(L_BLANCO, L_VELO) };
}

// ── Cajas candidatas ─────────────────────────────────────────────────────────
// Las posiciones LEGALES del diseño aprobado: las 3 alturas que ya existen en el
// generador (top/mid/bottom). No se inventan posiciones nuevas — la identidad
// visual que aprobó Vianey es invariante del sistema.
const ALTURAS = [
  { pos: 'top', topPct: 19 },
  { pos: 'mid', topPct: 30 },
  { pos: 'bottom', topPct: 46 },
];

function evaluarCaja(m, topPct, altoPct) {
  const { cols, rows, lum, sigma, borde, piel } = m;
  const x0 = Math.floor((MARGEN / 1080) * cols);
  const x1 = Math.ceil(((1080 - MARGEN) / 1080) * cols);
  const y0 = Math.floor((topPct / 100) * rows);
  const y1 = Math.min(rows, Math.ceil(((topPct + altoPct) / 100) * rows));

  let sumL = 0, sumL2 = 0, peorL = 0, minL = 1, sumB = 0, sumS = 0, riesgoCara = 0, n = 0;
  // Luminancia media por FILA: sirve para detectar el "corte" (horizonte, borde
  // de mesa, pared que termina) que parte la caja en dos mundos distintos.
  const filas = [];
  for (let y = y0; y < y1; y++) {
    let filaL = 0, filaN = 0;
    for (let x = x0; x < x1; x++) {
      const k = y * cols + x;
      filaL += lum[k]; filaN++;
      sumL += lum[k];
      sumL2 += lum[k] * lum[k];
      // "Peor" = el punto más CLARO si el texto va en blanco. Se guarda el
      // máximo porque un solo reflejo blanco basta para romper una palabra.
      if (lum[k] > peorL) peorL = lum[k];
      if (lum[k] < minL) minL = lum[k];
      sumB += borde[k];
      sumS += sigma[k];
      // Piel CON detalle = probable rostro. Piel plana (pared beige, madera) no.
      if (piel[k] > 0.35 && borde[k] > 10) riesgoCara += piel[k];
      n++;
    }
    if (filaN) filas.push(filaL / filaN);
  }
  if (!n) return null;
  const lMedia = sumL / n;
  const detalle = sumB / n;
  const ruido = sumS / n;
  // FRACCIÓN de la caja que parece rostro (0..1). Se acumulaba sin dividir:
  // valía 126 en lugar de 0.35 y el umbral de 0.12 se cumplía siempre.
  riesgoCara = riesgoCara / n;

  // ── PARTIDO EN DOS: el delator #1 de un diseño automático ──────────────────
  // Un bloque de texto a caballo entre el cielo y la arena (o entre la pared y
  // la mesa) se ve mal SIEMPRE: la mitad de las palabras queda sobre un fondo y
  // la otra mitad sobre otro, y ningún velo lo arregla parejo. Se mide buscando
  // el corte horizontal que MÁS separa las dos mitades de la caja.
  let partido = 0;
  if (filas.length >= 4) {
    let acum = 0;
    const total = filas.reduce((a, b) => a + b, 0);
    for (let i = 1; i < filas.length - 1; i++) {
      acum += filas[i - 1];
      const mediaArriba = acum / i;
      const mediaAbajo = (total - acum) / (filas.length - i);
      partido = Math.max(partido, Math.abs(mediaArriba - mediaAbajo));
    }
  }
  // El "peor punto" se suaviza hacia la media: un píxel aislado no debe forzar
  // un velo brutal, pero tampoco se ignora (70% peor / 30% media).
  const lPeor = peorL * 0.7 + lMedia * 0.3;
  // Su espejo para el texto oscuro: el punto más OSCURO, suavizado igual.
  const lPeorOsc = minL * 0.7 + lMedia * 0.3;

  const trat = elegirTratamiento(lMedia, lPeor, detalle, lPeorOsc);

  // Puntaje: menos velo es mejor (la foto respira), menos detalle es mejor
  // (el texto no pelea), y CERO tolerancia con las caras.
  let score = 100;
  score -= trat.velo * 55;                       // cada punto de velo tapa la foto
  // El detalle pesa MÁS que el velo: una zona limpia con velo suave se ve mejor
  // que una zona texturizada sin velo. Curva cuadrática para que "un poco de
  // textura" no castigue, pero "follaje/arena/multitud" descarte la zona.
  score -= Math.min(60, Math.pow(detalle, 1.45) * 0.9);
  score -= Math.min(20, Math.pow(ruido, 1.2) * 0.12);
  score -= riesgoCara * 120;            // castigo fuerte: nunca sobre una cara
  // Partido: una diferencia de 0.25 de luminancia entre mitades ya es un
  // horizonte evidente. Se castiga duro porque no hay velo que lo salve.
  score -= Math.min(70, Math.pow(partido, 1.2) * 190);
  if (trat.modo === 'banda') score -= 18; // funciona, pero es el último recurso
  if (trat.modo === 'oscuro') score -= 4;

  return {
    topPct, altoPct, ...trat,
    detalle: Number(detalle.toFixed(1)),
    riesgoCara: Number(riesgoCara.toFixed(2)),
    partido: Number(partido.toFixed(3)),
    score: Number(score.toFixed(1)),
  };
}

// Mide una FRANJA horizontal (en % de altura) y decide su tratamiento. Se usa
// para el encabezado (@handle + marca + fecha) y para el pie (paginación +
// chevron), que viven en zonas de la foto COMPLETAMENTE distintas a la del
// título: en una foto con pared blanca arriba y mesa negra abajo, el título
// puede ir en negro y la paginación DEBE ir en blanco. Medir solo el bloque de
// texto dejaba la paginación invisible — un detalle chico que delata a la
// máquina.
function tratarFranja(m, desdePct, hastaPct) {
  const { cols, rows, lum, borde } = m;
  const x0 = Math.floor((MARGEN / 1080) * cols);
  const x1 = Math.ceil(((1080 - MARGEN) / 1080) * cols);
  const y0 = Math.max(0, Math.floor((desdePct / 100) * rows));
  const y1 = Math.min(rows, Math.ceil((hastaPct / 100) * rows));
  let sumL = 0, peor = 0, minL = 1, sumB = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = y * cols + x;
      sumL += lum[k];
      if (lum[k] > peor) peor = lum[k];
      if (lum[k] < minL) minL = lum[k];
      sumB += borde[k];
      n++;
    }
  }
  if (!n) return { modo: 'blanco', velo: 0, refuerzo: false };
  const media = sumL / n;
  const lPeor = peor * 0.7 + media * 0.3;
  const t = elegirTratamiento(media, lPeor, sumB / n, minL * 0.7 + media * 0.3);
  // En franjas chicas la banda sólida se ve pesada: se prefiere el color que
  // más contraste dé, con el velo suave del degradado que ya existe.
  if (t.modo === 'banda') {
    // En franjas chicas la banda se ve pesada: queda el blanco con la sombra
    // REFORZADA. (Antes podía devolver texto oscuro; la marca lo descartó.)
    return { modo: 'blanco', velo: 0, refuerzo: true };
  }
  // El velo se devuelve (antes se tiraba): si la franja necesita velo para
  // leerse, el encabezado/pie deben pintarlo, no ignorarlo.
  // El texto del marco es de 30-34px, o sea CHICO en el feed: se le exige el
  // objetivo de texto normal (4.5), no el de titular.
  return { modo: t.modo, velo: t.velo, refuerzo: t.velo > 0.25 };
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Analiza UNA foto y devuelve el plan de composición.
 * @returns {{
 *   pos: 'top'|'mid'|'bottom',      // dónde va el bloque de texto
 *   modo: 'blanco'|'oscuro'|'banda',// tratamiento del texto
 *   velo: number,                   // opacidad del velo (0..1)
 *   contraste: number,              // contraste WCAG resultante
 *   semaforo: 'verde'|'ambar',      // ¿se puede confiar?
 *   aviso: string|null,             // qué revisar, en español
 *   opciones: object[]              // las 3 alturas evaluadas (para "otra opción")
 * }}
 */
export function analizarFoto(bmp, { altoPct = 34 } = {}) {
  const m = medirCeldas(bmp);
  const cajas = ALTURAS
    .map((a) => {
      const r = evaluarCaja(m, a.topPct, altoPct);
      return r ? { pos: a.pos, ...r } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!cajas.length) {
    return { pos: 'mid', modo: 'blanco', velo: 0.42, contraste: 0, semaforo: 'ambar', aviso: 'No se pudo analizar la foto.', opciones: [] };
  }
  const mejor = cajas[0];
  const aviso = derivarAviso(mejor);

  return {
    pos: mejor.pos,
    modo: mejor.modo,
    velo: mejor.velo,
    // Encabezado y pie se tratan APARTE: viven en otra parte de la foto.
    // Encabezado y pie: modo, velo Y refuerzo de sombra (el velo se tiraba).
    header: tratarFranja(m, 4, 13),
    pie: tratarFranja(m, 85, 98),
    modoHeader: tratarFranja(m, 4, 13).modo,   // compat
    modoPie: tratarFranja(m, 85, 98).modo,
    contraste: Number(mejor.contraste.toFixed(1)),
    semaforo: aviso ? 'ambar' : 'verde',
    aviso,
    opciones: cajas,
  };
}

/**
 * El veredicto humano de una caja. Se deriva SIEMPRE de la caja que realmente
 * se va a usar: si alguien sustituye la composición (rompe-rachas, botón ⟳)
 * tiene que volver a llamar aquí, o el semáforo miente sobre otra zona.
 */
export function derivarAviso(caja) {
  if (!caja) return 'No se pudo analizar la foto.';
  if (caja.contraste < MINIMO) return 'El texto puede costar leerse: prueba otra foto o mueve el bloque.';
  if (caja.riesgoCara > 0.12) return 'Puede haber una persona donde va el texto: revísalo.';
  if (caja.modo === 'banda') return 'Fondo muy claro y con detalle: se usó banda sólida para que se lea.';
  if (caja.partido > 0.22) return 'El texto queda entre dos zonas muy distintas de la foto: revísalo.';
  if (caja.detalle > 26) return 'Zona con mucho detalle: el texto podría competir con la foto.';
  return null;
}

/**
 * Analiza varias fotos y además cuida el RITMO del carrusel: si 3 o más slides
 * seguidos quedan con el bloque en la misma altura, se baja a la segunda mejor
 * opción de uno de ellos. Un carrusel donde todo está en el mismo lugar se ve
 * hecho por una máquina; la variación controlada se ve hecha por alguien.
 */
export function analizarCarrusel(bitmaps, opts) {
  // `altosPct`: el alto REAL que ocupará el texto de cada slide (lo calcula el
  // generador con las métricas del diseño). Sin él se cae al 34% de siempre.
  const altos = (opts && opts.altosPct) || [];
  const planes = bitmaps.map((b, i) => (b
    ? analizarFoto(b, { ...(opts || {}), altoPct: altos[i] || (opts && opts.altoPct) || 34 })
    : null));
  for (let i = 2; i < planes.length; i++) {
    const a = planes[i - 2], b = planes[i - 1], c = planes[i];
    if (!a || !b || !c) continue;
    if (a.pos === b.pos && b.pos === c.pos) {
      // Se cambia el de EN MEDIO (rompe la racha sin tocar portada ni cierre) y
      // solo si su alternativa sigue siendo legible.
      // La alternativa tiene que ser legible Y no caer sobre una cara: antes
      // solo se miraba el contraste y podía mandar el texto sobre un rostro.
      const alt = (b.opciones || []).find((o) => o.pos !== b.pos
        && o.contraste >= MINIMO && o.riesgoCara <= 0.12);
      if (alt) {
        const avisoAlt = derivarAviso(alt);
        planes[i - 1] = {
          ...b, pos: alt.pos, modo: alt.modo, velo: alt.velo,
          contraste: Number(alt.contraste.toFixed(1)),
          // El veredicto se RE-DERIVA: era el de la caja vieja.
          semaforo: avisoAlt ? 'ambar' : 'verde', aviso: avisoAlt,
        };
      }
    }
  }
  return planes;
}
