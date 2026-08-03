// ============================================================================
// IVAE Marketing — Generador de carruseles profesionales v3 (modo "Generar").
//
// MOTOR HÍBRIDO (el salto de calidad que pidió Vianey — "lo mejor de lo
// mejor"): la FOTO se pinta en canvas (decode HQ, cover-fit, 1440×1800) y
// TODA la capa de diseño es HTML/CSS REAL rasterizada vía SVG foreignObject
// encima — tipografía de verdad (Outfit variable + Pinyon Script cursiva,
// tracking fino, negritas selectivas), velos con gradientes CSS, pastillas
// ovaladas elegantes y GRANO DE PELÍCULA (feTurbulence). Las proporciones
// están medidas de las plantillas de referencia que aprobó Vianey (estilo
// Hanover & Tyke: @firma + marca cursiva + fecha; paginación 01\07 +
// chevron en círculo; títulos caps delgada/negrita; óvalos para listas).
//
// TODO EN EL NAVEGADOR: nada se sube a ningún servidor.
// ============================================================================
import { el, clear, toast, api } from '../api.js?v=202608031406';
import { icon } from '../shell/icons.js?v=202608031406';
import { T } from '../shell/i18n.js?v=202608031406';
import * as store from '../shell/store.js?v=202608031406';
import { analizarCarrusel } from '../lib/fotometro.js?v=202608031406';
import { PLANTILLAS, plantillaPorId, PLANTILLA_POR_DEFECTO, fechaCorta } from '../lib/plantillas.js?v=202608031406';

const W = 1080;
const H = 1350;
const MAX_SLIDES = 10;
const SCALE = 2;                // se rasteriza a 2160×2700 y el export baja a
                                // 1080×1350 con remuestreo propio (ver
                                // exportarSlide): así los filetes de la serif
                                // no los destroza el reescalado de Instagram.

// ── Estado ───────────────────────────────────────────────────────────────────
let slides = [];        // [{ file, bitmap, kicker, title, body, pos }]
let brandLabel = '';
let brandForClient = null;
let handle = '';
let ctaSupport = '';
let fechaPublicacion = '';   // AAAA-MM-DD de la pieza (no la fecha de hoy)
let plantillaId = PLANTILLA_POR_DEFECTO;   // qué diseño se está usando
// Cómo se mira la vista previa: 'trabajo' (grande, para editar), 'feed' (390px,
// el tamaño REAL en el teléfono) o 'perfil' (130px, la cuadrícula del perfil,
// que es donde el cliente decide si entra). Ver a tamaño real es la única
// prueba que vale: en la compu todo parece legible.
let vistaTamano = 'trabajo';
let brief = '';             // la línea que escribe Vianey: "promo de julio…"
let captionIA = '';         // el copy de IG que devolvió la IA
let hashtagsIA = '';
let descartes = [];         // [{i, motivo}] fotos que la IA dejó fuera
let pensando = false;       // hay una llamada a la IA en curso
let iaToken = 0;            // token PROPIO de la IA (ver escribirConIA)
let redrawTimer = 0;        // timer del redibujo diferido — a nivel de módulo
                            // para que un re-render CORTE el del render previo
                            // (un timer huérfano pintaba en un host desmontado)

// La respuesta de la IA llega 40-120 s después y se aplica POR ÍNDICE sobre
// `slides`. Si el mazo cambió en la espera (quitar/mover/agregar fotos, salir
// de la vista), esos índices apuntan a fotos equivocadas: se reordenaría mal,
// se cerrarían bitmaps vivos y hasta se pintarían textos de OTRA marca tras
// volver (auditoría adversaria). Toda mutación del mazo pasa por aquí.
function invalidarIA() { iaToken += 1; }
let genToken = 0;
let previews = [];

let deps = null;
let hostEl = null;

export function resetGen() {
  invalidarIA();   // una respuesta de IA en vuelo ya no aplica a la sesión nueva
  genToken += 1;
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = [];
  brandLabel = ''; handle = ''; ctaSupport = ''; fechaPublicacion = '';
  brandForClient = null;
  brief = ''; captionIA = ''; hashtagsIA = ''; descartes = []; pensando = false;
  // plantillaId NO se resetea: el diseño es una preferencia de quien trabaja,
  // no parte del carrusel que se acaba de cerrar.
}

// ── Fuentes embebidas para el SVG (foreignObject no ve URLs externas) ────────
const ARCHIVOS_FUENTE = {
  Outfit:          { file: 'outfit-latin-var.woff2', css: (b) => `@font-face{font-family:Outfit;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${b}) format('woff2')}` },
  'Pinyon Script': { file: 'pinyon-script.woff2',    css: (b) => `@font-face{font-family:'Pinyon Script';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b}) format('woff2')}` },
  Cormorant:       { file: 'cormorant-roman.woff2',  css: (b) => `@font-face{font-family:Cormorant;font-style:normal;font-weight:300 700;src:url(data:font/woff2;base64,${b}) format('woff2')}` },
  CormorantIt:     { file: 'cormorant-italic.woff2', css: (b) => `@font-face{font-family:Cormorant;font-style:italic;font-weight:300 700;src:url(data:font/woff2;base64,${b}) format('woff2')}` },
};
const fontCache = new Map();   // familia → promesa del @font-face embebido

function fuenteEmbebida(fam) {
  if (fontCache.has(fam)) return fontCache.get(fam);
  const def = ARCHIVOS_FUENTE[fam];
  if (!def) return Promise.resolve('');
  const pr = (async () => {
    const buf = await (await fetch('/marketing/fonts/' + def.file)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return def.css(btoa(bin));
  })().catch((e) => { fontCache.delete(fam); throw e; });   // nunca cachear un fallo
  fontCache.set(fam, pr);
  return pr;
}

// Las familias que pide la plantilla activa (la cursiva de Cormorant viaja
// siempre con su redonda: es el acento del sistema).
async function fuentesDe(plantilla) {
  const fams = [...(plantilla.fuentes || ['Outfit'])];
  if (fams.includes('Cormorant')) fams.push('CormorantIt');
  const partes = await Promise.all(fams.map(fuenteEmbebida));
  return partes.join('');
}

let fontCssPromise = null;
function designFonts() {
  if (fontCssPromise) return fontCssPromise;
  const b64 = async (path) => {
    const buf = await (await fetch(path)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  fontCssPromise = (async () => {
    const [outfit, pinyon] = await Promise.all([
      b64('/marketing/fonts/outfit-latin-var.woff2'),
      b64('/marketing/fonts/pinyon-script.woff2'),
    ]);
    return `@font-face{font-family:Outfit;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${outfit}) format('woff2')}` +
      `@font-face{font-family:'Pinyon Script';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${pinyon}) format('woff2')}`;
  })().catch((e) => {
    // Si el fetch falla (parpadeo de red), NO dejar la promesa rechazada
    // cacheada: el siguiente intento debe volver a pedir las fuentes.
    fontCssPromise = null;
    throw e;
  });
  return fontCssPromise;
}

// ── HTML del diseño (proporciones medidas de las plantillas de referencia) ──
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s) => esc(s).split('**').map((part, i) => (i % 2 ? `<b>${part}</b>` : part)).join('');

const DESIGN_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
.slide{position:relative;width:1080px;height:1350px;font-family:Outfit,sans-serif;color:#fff;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.scrim-top{position:absolute;top:0;left:0;right:0;height:230px;background:linear-gradient(rgba(12,12,16,.34),rgba(12,12,16,0))}
.scrim-block{position:absolute;left:0;right:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.42) 90px,rgba(12,12,16,.42))}
.scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:240px;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.38))}
.hdr{position:absolute;top:88px;left:104px;right:104px;display:flex;justify-content:space-between;align-items:baseline;text-shadow:0 1px 14px rgba(0,0,0,.45)}
.hdr .h,.hdr .d{font-size:28px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.96)}
.hdr .b{font-family:'Pinyon Script',cursive;font-size:54px;line-height:1;transform:translateY(6px);color:#fff}
.pag{position:absolute;left:104px;bottom:96px;font-size:30px;font-weight:400;letter-spacing:.08em;color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%}
.chev i{position:absolute;top:50%;left:50%;width:16px;height:16px;border-top:2.5px solid rgba(255,255,255,.92);border-right:2.5px solid rgba(255,255,255,.92);transform:translate(-62%,-50%) rotate(45deg)}
.chev.down i{transform:translate(-50%,-64%) rotate(135deg)}
.block{position:absolute;left:104px;right:104px;display:flex;flex-direction:column}
.kicker{font-size:36px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.96);margin-bottom:26px;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.title{font-size:99px;font-weight:275;line-height:1.07;text-transform:uppercase;letter-spacing:.004em;text-shadow:0 2px 20px rgba(0,0,0,.4);text-wrap:balance}
.title b{font-weight:800}
.title.sm{font-size:82px}
.support{font-size:42px;font-weight:400;line-height:1.4;color:rgba(255,255,255,.95);margin-top:44px;max-width:82%;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.support b{font-weight:700}
.pills{display:flex;flex-direction:column;align-items:center;gap:44px;margin-top:64px}
.pills.compactas{gap:26px;margin-top:44px}
.pill{border:1.6px solid rgba(255,255,255,.82);border-radius:50%;padding:34px 78px;font-size:39px;font-weight:400;line-height:1.3;text-align:center;max-width:760px;color:rgba(255,255,255,.98);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pills.compactas .pill{padding:24px 56px;font-size:36px}
.pill:nth-child(1){transform:rotate(-1.6deg) translateX(-26px)}
.pill:nth-child(2){transform:rotate(1.3deg) translateX(22px)}
.pill:nth-child(3){transform:rotate(-1.1deg) translateX(-16px)}
.right{text-align:right;align-items:flex-end}
.center{text-align:center;align-items:center}

/* ── TRATAMIENTOS DEL TEXTO (los elige el fotómetro, no el usuario) ────────
   El velo dejó de ser fijo: su opacidad la calcula fotometro.js para CADA
   foto y CADA zona, buscando el MÍNIMO que garantice contraste WCAG 7:1.
   Fondo oscuro → casi sin velo (la foto respira). Fondo muy claro → el blanco
   no gana ni con velo, así que se invierte a texto oscuro. Y si además hay
   mucho detalle (comida sobre mantel blanco, azulejo), banda sólida: se ve
   intencional, mientras que un velo gris se ve mal hecho. */
/* OJO: este bloque toca SOLO el bloque de texto (kicker/título/apoyo/píldoras).
   El encabezado y el pie tienen su propia medición y sus propias clases
   (.hdr-* y .pie-*) porque viven en otra zona de la foto — si se listaran aquí
   ganarían por especificidad y dejarían la paginación invisible sobre un fondo
   oscuro, que fue exactamente el defecto que destapó la prueba visual. */
.slide.t-oscuro .block{color:#18181E}
.slide.t-oscuro .kicker,.slide.t-oscuro .support{color:rgba(24,24,30,.92)}
.slide.t-oscuro .pill{color:#18181E;border-color:rgba(24,24,30,.55)}
/* Sobre claro la sombra oscura ensucia: se cambia por un halo claro sutil. */
.slide.t-oscuro .title,.slide.t-oscuro .kicker,.slide.t-oscuro .support{text-shadow:0 1px 10px rgba(255,255,255,.55)}
/* La rampa termina en 90 px: el velo arranca 7% (94 px) ANTES del texto, así
   que cuando el bloque empieza la opacidad ya es la que midió el fotómetro.
   Con el 26% de antes, la primera línea recibía apenas un tercio del velo. */
.veil-claro{background:linear-gradient(rgba(247,247,245,0),rgba(247,247,245,var(--va)) 90px,rgba(247,247,245,var(--va)))}

/* Encabezado y pie con su PROPIO color: en una foto con pared blanca arriba y
   mesa negra abajo, el título va oscuro pero la paginación tiene que ir clara.
   Medir una sola zona dejaba la paginación invisible. */
.hdr-oscuro .hdr .h,.hdr-oscuro .hdr .d{color:rgba(24,24,30,.9)}
.hdr-oscuro .hdr .b{color:#18181E}
.hdr-oscuro .hdr{text-shadow:0 1px 10px rgba(255,255,255,.55)}
.hdr-claro .hdr .h,.hdr-claro .hdr .d{color:rgba(255,255,255,.96)}
.hdr-claro .hdr .b{color:#fff}
.hdr-claro .hdr{text-shadow:0 1px 14px rgba(0,0,0,.45)}
.pie-oscuro .pag{color:rgba(24,24,30,.92);text-shadow:0 1px 10px rgba(255,255,255,.5)}
.pie-oscuro .chev{border-color:rgba(24,24,30,.7)}
.pie-oscuro .chev i{border-top-color:rgba(24,24,30,.7);border-right-color:rgba(24,24,30,.7)}
.pie-claro .pag{color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pie-claro .chev{border-color:rgba(255,255,255,.92)}
.pie-claro .chev i{border-top-color:rgba(255,255,255,.92);border-right-color:rgba(255,255,255,.92)}

/* Refuerzo: cuando la franja necesitaba velo y no hay dónde ponerlo (el velo
   es del bloque de texto, no del encabezado), se dobla la sombra. Es discreto
   y salva la legibilidad sin manchar la foto con otro degradado. */
.hdr-refuerzo .hdr{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
.hdr-refuerzo.hdr-oscuro .hdr{text-shadow:0 1px 3px rgba(255,255,255,.95),0 2px 16px rgba(255,255,255,.8)}
.pie-refuerzo .pag{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
.pie-refuerzo.pie-oscuro .pag{text-shadow:0 1px 3px rgba(255,255,255,.95),0 2px 16px rgba(255,255,255,.8)}

/* Banda sólida: el último recurso, resuelto con elegancia editorial. */
.banda{position:absolute;left:0;right:0;background:#0C0C10}
.banda.clara{background:#F7F7F5}
.slide.t-banda .block{color:#fff}
`;



// ── ¿Cuánto alto ocupa el bloque de texto? ──────────────────────────────────
// Estimación con las métricas REALES del DESIGN_CSS (fuentes, paddings, gaps).
// Vive aquí arriba porque la usan DOS cosas: el guardarraíl de slideHTML (para
// encoger si no cabe) y analizarTodo (para pedirle al fotómetro que mida la
// caja del tamaño que el texto va a ocupar DE VERDAD, no una fija del 34%).
function altoBloque({ kicker, cleanLen, items, plainBody, support }, sm, comp) {
  const fsT = sm ? 82 : 99;
  let h = 0;
  if (kicker) h += 36 * 1.2 + 26;
  if (cleanLen) h += Math.ceil(cleanLen / Math.max(1, Math.floor(872 / (fsT * 0.52)))) * fsT * 1.07 + 8;
  if (items && items.length) {
    const pad = comp ? 24 : 34, fsP = comp ? 36 : 39, gap = comp ? 26 : 44, mt = comp ? 44 : 64;
    h += mt + items.reduce((a, it, i) => {
      const lineas = Math.ceil(it.length / Math.max(1, Math.floor(604 / (fsP * 0.5))));
      return a + pad * 2 + lineas * fsP * 1.3 + (i ? gap : 0);
    }, 0);
  }
  for (const t of [plainBody, support]) {
    if (t) h += 44 + Math.ceil(String(t).replace(/\*\*/g, '').length / 34) * 42 * 1.4;
  }
  return h;
}

// Las piezas de texto de un slide, tal como las arma slideHTML.
function piezasDe(s, idx, total) {
  const isCover = idx === 0, isLast = idx === total - 1;
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const support = isLast ? ctaSupport.trim() : (isCover ? body : '');
  const items = !isCover && body.includes('/')
    ? body.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3) : null;
  return {
    kicker: (s.kicker || '').trim(),
    title, body, support, items,
    cleanLen: title.replace(/\*\*/g, '').length,
    plainBody: !isCover && !items ? body : '',
  };
}

function slideHTML(s, idx, total) {
  const isCover = idx === 0;
  const isLast = idx === total - 1;
  const kicker = (s.kicker || '').trim();
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const support = isLast ? ctaSupport.trim() : (isCover ? body : '');
  const items = !isCover && body.includes('/') ? body.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3) : null;
  const plainBody = !isCover && !items ? body : '';

  // Posición y tratamiento: los decide el FOTÓMETRO salvo que el usuario haya
  // tocado el botón de altura (entonces manda él y el sistema se calla).
  const plan = s.plan || null;
  const pos = s.posManual || (plan && plan.pos) || s.pos || 'mid';
  const topPct = pos === 'top' ? 19 : pos === 'bottom' ? 46 : 30;
  const modo = (plan && plan.modo) || 'blanco';
  const veloA = plan ? plan.velo : 0.42;   // 0.42 era el valor FIJO de antes
  // El pie SIEMPRE cae dentro de la banda (ésta llega a bottom:0), y el
  // encabezado solo si el bloque subió tanto que la banda lo alcanza. Donde
  // manda la banda (#0C0C10, casi negra) el texto va claro, sin importar lo
  // que dijera la foto: medir la foto tapada era el defecto.
  const bandaCubrePie = modo === 'banda';
  const bandaCubreHdr = modo === 'banda' && (topAjustado - 7) * 13.5 < 148;  // header 88..148px
  const modoHdr = bandaCubreHdr ? 'blanco' : (plan && plan.modoHeader) || 'blanco';
  const modoPie = bandaCubrePie ? 'blanco' : (plan && plan.modoPie) || 'blanco';
  const claseModo = (modo === 'oscuro' ? ' t-oscuro' : modo === 'banda' ? ' t-banda' : '')
    + (modoHdr === 'oscuro' ? ' hdr-oscuro' : ' hdr-claro')
    + (modoPie === 'oscuro' ? ' pie-oscuro' : ' pie-claro')
    // Refuerzo de sombra cuando la franja pedía velo y no hay dónde ponerlo.
    + (plan && plan.header && plan.header.refuerzo && !bandaCubreHdr ? ' hdr-refuerzo' : '')
    + (plan && plan.pie && plan.pie.refuerzo && !bandaCubrePie ? ' pie-refuerzo' : '');

  // FECHA: la de PUBLICACIÓN de la pieza, no la del día en que se arma el
  // carrusel. Antes, preparar el martes el post del viernes imprimía "martes".
  const fechaISO = (typeof fechaPublicacion === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaPublicacion))
    ? fechaPublicacion : null;
  const now = fechaISO ? new Date(fechaISO + 'T12:00:00') : new Date();
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()];

  // ¿HAY texto? Cuenta también el apoyo del cierre (ctaSupport): un cierre sin
  // kicker/título pero con apoyo perdía su bloque y su velo (regresión cazada
  // en la revisión 2). `inner` se arma DESPUÉS, con las clases del guardarraíl.
  let inner = '';
  const hasText = !!(kicker || title || body || support);

  // ── GUARDARRAÍL DE DESBORDE (cazado en la prueba visual E2E) ─────────────
  // Título de 3 líneas + 3 píldoras se salían del lienzo por abajo y el pie
  // cortaba el texto. Se ESTIMA la altura del bloque con las métricas reales
  // del CSS y, si no cabe, se ajusta EN ORDEN sin borrar contenido:
  // 1) título chico (.sm) → 2) píldoras compactas → 3) subir el bloque.
  const cleanLen = title.replace(/\*\*/g, '').length;
  let smTitle = cleanLen > 46;
  let compactas = false;
  let topAjustado = topPct;
  let miniK = 1;   // último recurso: escala proporcional del bloque entero
  let alto = 700;  // alto estimado del bloque (lo usa también la plantilla Nota)
  if (hasText) {
    // Pie REAL: la paginación arranca en y≈1218 y el chevron (a la derecha)
    // en y≈1204; el texto va centrado/izquierda, así que el piso honesto del
    // bloque es y=1200 → reserva 150. Con 205 se compactaban slides que SÍ
    // cabían (calibrado con casos reales en la ronda 2).
    const H = 1350, RESERVA = 140;   // piso del bloque y=1210; paginación y=1218
    const pz = { kicker, cleanLen: title ? cleanLen : 0, items, plainBody, support };
    const estima = (sm, comp) => altoBloque(pz, sm, comp);
    alto = estima(smTitle, compactas);
    const cabe = () => (H * topAjustado / 100) + alto * miniK <= H - RESERVA;
    if (!cabe() && !smTitle) { smTitle = true; alto = estima(smTitle, compactas); }
    if (!cabe() && items) { compactas = true; alto = estima(smTitle, compactas); }
    if (!cabe()) topAjustado = Math.max(12, Math.floor((H - RESERVA - alto) / H * 100));
    if (!cabe()) {
      // Aún no cabe (cierre con kicker+título+3 píldoras+apoyo, todo al tope):
      // se escala el bloque completo, compensando el ancho para conservar los
      // cortes de línea. Proporcional y parejo: se ve intencional, no roto.
      miniK = Math.max(0.8, (H - RESERVA - H * topAjustado / 100) / alto);
    }
  }
  // reconstruir el título/píldoras con las clases finales
  inner = '';
  if (kicker) inner += `<div class="kicker">${esc(kicker)}</div>`;
  if (title) inner += `<div class="title${smTitle ? ' sm' : ''}">${rich(title)}</div>`;
  if (items) inner += `<div class="pills${compactas ? ' compactas' : ''}">${items.map((it) => `<div class="pill">${esc(it)}</div>`).join('')}</div>`;
  if (plainBody) inner += `<div class="support">${rich(plainBody)}</div>`;
  if (support) inner += `<div class="support">${rich(support)}</div>`;

  const blockTop = `${topAjustado}%`;
  const miniCSS = miniK < 1
    ? `;transform:scale(${miniK.toFixed(3)});transform-origin:top left;width:${Math.round(872 / miniK)}px;left:104px;right:auto`
    : '';
  const scrimTop = `${Math.max(0, topAjustado - 7)}%`;

  // El velo ya NO es fijo: `--va` lleva la opacidad que calculó el fotómetro.
  // En modo banda se pinta un bloque sólido en lugar del degradado.
  const veloHTML = !hasText ? ''
    : modo === 'banda'
      ? `<div class="banda" style="top:${scrimTop};bottom:0"></div>`
      : modo === 'oscuro'
        ? `<div class="scrim-block veil-claro" style="top:${scrimTop};bottom:0;--va:${veloA}"></div>`
        : `<div class="scrim-block" style="top:${scrimTop};bottom:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,${veloA}) 90px,rgba(12,12,16,${veloA}))"></div>`;

  // ── El contexto que recibe la plantilla ─────────────────────────────────
  // Todo lo pensado (fotómetro, guardarraíl, escala) queda resuelto aquí; la
  // plantilla solo decide cómo se ve. Así una plantilla nueva no puede romper
  // la legibilidad: hereda las decisiones, no las vuelve a tomar.
  const P = plantillaPorId(plantillaId);
  if (P.id !== 'editorial') {
    return P.html({
      idx, total, isCover, isLast,
      kicker, title, body, support, items, plainBody,
      hasText, smTitle, compactas, blockTop, miniCSS,
      modo, velo: veloA, plan,
      marca: brandLabel.trim(), handle: handle.trim(), fecha: fechaCorta(fechaPublicacion),
      // La tarjeta de "Nota" se centra sola: no depende de dónde hubo hueco.
      papelTop: Math.max(120, Math.round((1350 - (typeof alto === 'number' ? alto : 700) - 300) / 2)),
      // El marco vive sobre la FOTO: su color lo decide la medición de esa
      // franja, no una constante (sobre un cielo claro el blanco se perdía).
      // Velo propio de cada franja del marco: es el texto más chico y cae
      // donde caiga. Un piso de .22 para que el marco siempre se asiente.
      veloMarcoTop: Math.max(0.22, (plan && plan.header && plan.header.velo) || 0.34).toFixed(2),
      veloMarcoBot: Math.max(0.22, (plan && plan.pie && plan.pie.velo) || 0.34).toFixed(2),
      tinta: '#1D2A24',   // verde profundo de "Ficha"
    });
  }

  return `
  <div class="slide${claseModo}">
    ${modo === 'oscuro' ? '' : '<div class="scrim-top"></div>'}
    ${veloHTML}
    ${modo === 'oscuro' ? '' : '<div class="scrim-bottom"></div>'}
    <div class="hdr">
      <span class="h">${esc(handle.trim())}</span>
      <span class="b">${esc(brandLabel.trim())}</span>
      <span class="d">${now.getDate()} ${MES} ${now.getFullYear()}</span>
    </div>
    ${hasText ? `<div class="block" style="top:${blockTop}${miniCSS}">${inner}</div>` : ''}
    <div class="pag">${String(idx + 1).padStart(2, '0')}\\${String(total).padStart(2, '0')}</div>
    <div class="chev${isLast ? ' down' : ''}"><i></i></div>
  </div>`;
}

// Rasteriza la capa de diseño (HTML→SVG→imagen) a 2× para nitidez del export.
async function designLayer(s, idx, total) {
  const P = plantillaPorId(plantillaId);
  // Cada plantilla trae SU hoja de estilos y SUS fuentes: no se embeben las
  // cuatro familias siempre (cada una pesa ~40 KB dentro del SVG).
  const fonts = P.id === 'editorial' ? await designFonts() : await fuentesDe(P);
  const hoja = P.id === 'editorial' ? DESIGN_CSS : P.css({ tinta: '#1D2A24' });
  const html = slideHTML(s, idx, total);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">` +
    `<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.35 0.35 0.35 0 0"/></filter></defs>` +
    `<style>${fonts}${hoja}</style>` +
    `<foreignObject width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject>` +
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.055"/></svg>`;
  const img = new Image();
  img.decoding = 'async';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('design layer failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  return img;
}

// ── MURAL: la foto no se resuelve por slide, sino en un plano continuo ──────
// Posiciones deterministas (nada de azar: el mismo mazo da siempre el mismo
// mural, que es lo que permite volver a exportar igual). Cada foto recibe una
// celda dentro de la tira de ancho W×total, con un desfase vertical que rompe
// la cuadrícula sin ensuciarla.
function planMural(bitmaps, total) {
  const anchoTira = W * total;
  const n = bitmaps.length;
  // Ritmo de PESOS y alturas: da variedad sin recurrir al azar (el mismo mazo
  // debe producir siempre el mismo mural para poder re-exportar igual).
  const RITMO = [
    { alto: 0.50, y: 0.10 },
    { alto: 0.33, y: 0.60 },
    { alto: 0.58, y: 0.21 },
    { alto: 0.29, y: 0.06 },
    { alto: 0.44, y: 0.52 },
    { alto: 0.52, y: 0.16 },
  ];
  return bitmaps.map((bmp, i) => {
    const r = RITMO[i % RITMO.length];
    const h = H * r.alto;
    // El ANCHO sale de la proporción REAL de la foto: una vertical se queda
    // vertical. Antes se reescalaba solo el ancho y todo salía panorámico.
    const prop = bmp ? bmp.width / bmp.height : 1.5;
    const w = Math.min(W * 0.92, h * prop);
    // Centros repartidos parejo por toda la tira: así ningún slide queda vacío
    // y las fotos anchas cruzan el borde solas (que es el efecto que se busca).
    const cx = ((i + 0.5) / n) * anchoTira;
    return { x: cx - w / 2, y: H * r.y, w, h };
  });
}

// Dibuja el trozo del mural que le toca a ESTE slide.
function pintarMural(ctx, idx, total) {
  const plan = planMural(slides.map((s) => s.bitmap), total);
  const desplazamiento = idx * W;
  ctx.save();
  ctx.translate(-desplazamiento, 0);
  slides.forEach((s, i) => {
    const c = plan[i];
    if (!c || !s.bitmap) return;
    // Solo lo que cae en este slide (más un margen para los bordes).
    if (c.x + c.w < desplazamiento - 40 || c.x > desplazamiento + W + 40) return;
    const MARCO = 14;   // filo claro tipo instantánea, el detalle del formato
    ctx.fillStyle = 'rgba(246,244,240,.92)';
    ctx.fillRect(c.x - MARCO, c.y - MARCO, c.w + MARCO * 2, c.h + MARCO * 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    const e = Math.max(c.w / s.bitmap.width, c.h / s.bitmap.height);
    ctx.drawImage(s.bitmap, c.x + (c.w - s.bitmap.width * e) / 2, c.y + (c.h - s.bitmap.height * e) / 2,
      s.bitmap.width * e, s.bitmap.height * e);
    ctx.restore();
  });
  ctx.restore();
}

// ── Foto (canvas, calidad máxima) ────────────────────────────────────────────
function fitCover(ctx, bmp) {
  // "Ficha" parte el lienzo: la foto ocupa el 56% de arriba y el panel sólido
  // el resto. Dibujar la foto a sangre completa la dejaría tapada a la mitad.
  const alto = plantillaPorId(plantillaId).id === 'ficha' ? H * 0.56 : H;
  const s = Math.max(W / bmp.width, alto / bmp.height);
  ctx.drawImage(bmp, (W - bmp.width * s) / 2, (alto - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
}

// ── El fotómetro: la app mira las fotos antes de escribir una letra ─────────
// Determinista, ~10 ms por foto, sin red y sin costo. Respeta la decisión
// manual: si el usuario tocó el botón de altura, ese slide queda como él dijo.
function analizarTodo() {
  try {
    // Cada foto se mide con el alto que SU texto va a ocupar de verdad (mismo
    // estimador que usa el render). Así la zona evaluada y la zona pintada son
    // la misma, y el veredicto del semáforo vale para lo que se ve.
    const altos = slides.map((s, i) => {
      const alto = altoBloque(piezasDe(s, i, slides.length), false, false);
      return Math.max(20, Math.min(70, Math.round((alto / 1350) * 100)));
    });
    // Tamaño REAL del titular por slide: la portada va a 152px y los
    // interiores a 104/86. De eso depende cuánta sombra hace falta.
    const pxTitular = slides.map((s, i) => {
      const largo = String(s.title || '').replace(/\*\*/g, '').length;
      if (i === 0) return largo > 46 ? 126 : 152;
      return largo > 46 ? 86 : 104;
    });
    const planes = analizarCarrusel(slides.map((s) => s.bitmap), { altosPct: altos, pxTitular });
    slides.forEach((s, i) => {
      s.plan = planes[i] || null;
      if (!s.posManual && s.plan) s.pos = s.plan.pos;
    });
  } catch (e) {
    console.error('[carrusel-gen] fotómetro', e);
    for (const s of slides) s.plan = null;  // se cae con gracia al modo de antes
  }
}

// ── LA IA ESCRIBE (fase 2) ───────────────────────────────────────────────────
// Se le mandan MINIATURAS (512 px de lado largo, ~60 KB), nunca las fotos
// originales: la calidad del export no depende de esto y así el envío es rápido
// y barato. Junto con cada una viaja lo que el fotómetro YA midió, para que el
// copy se escriba sabiendo cuánto espacio hay de verdad.
async function miniatura(bmp) {
  const lado = 512;
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(bmp, 0, 0, w, h);
  const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/jpeg', quality: 0.72 })
    : await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.72));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

const IA_TARDE = () => toast(T(
  'Las fotos cambiaron mientras la IA escribía; su propuesta ya no aplica. Vuelve a pedirla.',
  'Photos changed while the AI was writing; ask again.'), 'info');

async function escribirConIA() {
  if (pensando) return;
  if (slides.length < 2) {
    toast(T('Sube al menos 2 fotos: la IA arma una historia, no un slide suelto.', 'Add at least 2 photos.'), 'error');
    return;
  }
  // Si ya hay texto escrito (por ti o por una pasada anterior), se pregunta:
  // la IA reemplaza TODO y perder un copy ya pulido duele.
  const hayTexto = captionIA.trim() || slides.some((s) => (s.kicker || s.title || s.body || '').trim());
  if (hayTexto && !confirm(T(
    'Esto reemplaza los textos y el caption que ya hay. ¿Continuar?',
    'This replaces the current texts and caption. Continue?'))) return;
  pensando = true;
  renderGen(hostEl, deps);
  // Token PROPIO, no genToken: ese lo incrementa cada redibujo de la vista
  // previa, así que si la usuaria tecleaba algo mientras la IA pensaba, el
  // resultado llegaba tarde y se descartaba en silencio tras 60 s de espera.
  const token = ++iaToken;
  try {
    const fotos = await Promise.all(slides.map(async (s) => ({
      b64: await miniatura(s.bitmap),
      mime: 'image/jpeg',
      plan: s.plan ? { pos: s.plan.pos, modo: s.plan.modo, semaforo: s.plan.semaforo, aviso: s.plan.aviso } : null,
    })));
    if (token !== iaToken) return;
    const { activeClientId } = store.getState();
    const out = await api.post('/carousel/guion', {
      brief, marca: brandLabel, nSlides: slides.length, client_id: activeClientId, fotos,
    }, { timeout: 180000 });  // mirar 8 fotos y escribir tarda ~40-120 s
    if (token !== iaToken) { IA_TARDE(); return; }

    // Reordenar las fotos como las curó la IA (y soltar las descartadas).
    // Dedupe + cota también aquí: el servidor ya lo hace, pero un índice
    // repetido crearía slides ALIAS del mismo objeto y cerrar uno tronaría el
    // otro (cinturón y tirantes).
    const nAntes = slides.length;
    const orden = [...new Set((out.orden || []).map(Number))]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < nAntes);
    if (!orden.length) {
      toast(T('La IA no devolvió un orden válido; tus fotos quedan como están.', 'The AI returned no valid order.'), 'error');
      return;
    }
    // Miniaturas de las descartadas ANTES de soltar los bitmaps: los números
    // de envío ya no significan nada después del reorden — se enseña la FOTO.
    descartes = (out.descartadas || [])
      .map((d) => ({ motivo: String(d.motivo || ''), thumb: fotos[d.i] ? 'data:image/jpeg;base64,' + fotos[d.i].b64 : null }))
      .filter((d) => d.motivo || d.thumb);
    const fuera = slides.filter((_, i) => !orden.includes(i));
    slides = orden.map((i) => slides[i]);
    for (const s of fuera) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
    // Los textos van slide a slide del mazo YA curado (mismo orden que `orden`).
    (out.slides || []).slice(0, slides.length).forEach((t, i) => {
      slides[i].kicker = t.kicker || '';
      slides[i].title = t.title || '';
      slides[i].body = t.body || '';
      slides[i].alt = t.alt || '';
    });
    captionIA = out.caption || '';
    hashtagsIA = out.hashtags || '';
    // Las fotos cambiaron de orden: hay que volver a medir (y a cuidar el ritmo).
    analizarTodo();
    toast(T('Carrusel escrito. Revísalo y edita lo que quieras.', 'Carousel written. Review and edit.'), 'success');
  } catch (e) {
    const msg = (e && e.message) || T('No se pudo escribir el carrusel.', 'Could not write the carousel.');
    toast(msg, 'error');
  } finally {
    pensando = false;
    renderGen(hostEl, deps);
  }
}

// Baja un slide a 1080×1350 con remuestreo de calidad. Instagram reescala todo
// lo que reciba con su propio filtro; hacerlo nosotros desde el doble de
// resolución deja los bordes de la tipografía mucho más limpios.
async function exportarSlide(canvas, type) {
  const DEST_W = 1080, DEST_H = 1350;
  try {
    const bmp = await createImageBitmap(canvas, {
      resizeWidth: DEST_W, resizeHeight: DEST_H, resizeQuality: 'high',
    });
    const cv = document.createElement('canvas');
    cv.width = DEST_W; cv.height = DEST_H;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(bmp, 0, 0);
    try { bmp.close(); } catch { /* noop */ }
    // 0.92: por encima el archivo se pasa de 1.5 MB y entonces Instagram
    // aplica una recompresión más agresiva — sale peor que si lo damos ya justo.
    const blob = await deps.canvasToBlob(cv, type, 0.92);
    cv.width = cv.height = 0;    // liberar de una vez
    return blob;
  } catch {
    return deps.canvasToBlob(canvas, type, 0.95);   // navegador sin resize
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
async function regenerate(previewHost) {
  const token = ++genToken;
  if (!previewHost) return;
  try {
    await designFonts();
    if (token !== genToken) return;
    const layers = await Promise.all(slides.map((s, i) => designLayer(s, i, slides.length)));
    if (token !== genToken) return;
    previews = [];
    clear(previewHost);
    slides.forEach((s, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
      const c2 = canvas.getContext('2d');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.scale(SCALE, SCALE);
      c2.fillStyle = '#0B0B10'; c2.fillRect(0, 0, W, H);
      if (plantillaPorId(plantillaId).id === 'mural') pintarMural(c2, i, slides.length);
      else if (s.bitmap) fitCover(c2, s.bitmap);
      c2.drawImage(layers[i], 0, 0, W, H);
      previews.push({ canvas });
      const cell = el('div', { class: 'carg-cell' }, [el('div', { class: 'carg-cell__num', text: String(i + 1) })]);
      canvas.className = 'carg-cell__canvas';
      cell.prepend(canvas);
      previewHost.appendChild(cell);
    });
  } catch (e) {
    console.error('[carrusel-gen] render', e);
    toast(T('No se pudo generar la vista previa. Intenta de nuevo.', 'Preview failed. Try again.'), 'error');
  }
}

// ── UI ───────────────────────────────────────────────────────────────────────
const POS_LABEL = { top: '↑', mid: '·', bottom: '↓' };

export function renderGen(root, helpers) {
  clearTimeout(redrawTimer);   // el redibujo diferido del render anterior muere aquí
  deps = helpers;
  hostEl = root;
  const { clients, activeClientId } = store.getState();
  const brand = (clients || []).find((c) => c.id === activeClientId) || null;
  if (brand && brandForClient !== activeClientId) {
    // CAMBIO DE MARCA: el trabajo anterior no se mezcla con la marca nueva.
    // Antes solo cambiaba el rótulo y las fotos/caption viejos se quedaban.
    if (brandForClient && slides.length) {
      resetGen();
      toast(T('Cambiaste de marca: el carrusel anterior se cerró.', 'Brand changed: previous carousel cleared.'), 'info');
    }
    brandLabel = brand.name || '';
    brandForClient = activeClientId;
  }

  const previewHost = el('div', { class: 'carg-grid carg-grid--' + vistaTamano });
  const redraw = () => regenerate(previewHost);
  const redrawSoon = () => {
    clearTimeout(redrawTimer);
    // Al parar de teclear se RE-MIDE: más texto = caja más alta = puede que
    // otra zona de la foto sea la buena. Medir en cada tecla trabaría el móvil.
    redrawTimer = setTimeout(() => { analizarTodo(); redraw(); }, 500);
  };

  const fileIn = el('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      invalidarIA();
      const all = [...(e.target.files || [])];
      const files = all.slice(0, MAX_SLIDES - slides.length);
      if (all.length > files.length) {
        toast(T(`Máximo ${MAX_SLIDES} fotos: se tomaron las primeras ${files.length}.`, `Max ${MAX_SLIDES} photos.`), 'error');
      }
      for (const f of files) {
        try {
          let bitmap;
          const probe = await createImageBitmap(f);
          try {
            const need = Math.max((W * SCALE) / probe.width, (H * SCALE) / probe.height);
            const k = Math.min(1, need * 1.35);
            if (k < 1) {
              bitmap = await createImageBitmap(f, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' });
              try { probe.close(); } catch { /* noop */ }
            } else { bitmap = probe; }
          } catch { bitmap = probe; }
          slides.push({ file: f, bitmap, kicker: '', title: '', body: '', pos: slides.length === 0 ? 'mid' : 'top' });
        } catch {
          toast(T(`No pude leer "${f.name}" — usa JPG o PNG (HEIC no corre en este navegador).`, `Could not read "${f.name}" — use JPG or PNG.`), 'error');
        }
      }
      e.target.value = '';
      analizarTodo();          // el fotómetro decide posición y tratamiento
      renderGen(hostEl, deps);
    },
  });

  const slideCards = slides.map((s, i) => {
    const isCover = i === 0;
    const isLast = i === slides.length - 1 && slides.length > 1;
    const thumb = el('canvas', { class: 'carg-card__thumb' });
    const tctx = thumb.getContext('2d');
    thumb.width = 216; thumb.height = 270;
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    const sc = Math.max(216 / s.bitmap.width, 270 / s.bitmap.height);
    tctx.drawImage(s.bitmap, (216 - s.bitmap.width * sc) / 2, (270 - s.bitmap.height * sc) / 2, s.bitmap.width * sc, s.bitmap.height * sc);

    const kickerIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.kicker,
      placeholder: isCover ? T('Kicker (ej. ¿SIN ENERGÍA?)', 'Kicker') : T('Kicker (ej. MOOD — opcional)', 'Kicker (optional)'),
      maxlength: '40',
      oninput: (e) => { s.kicker = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    const titleIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.title,
      placeholder: isCover
        ? T('HOOK — resalta con **negritas**: **Conecta** tu ánimo con el **remedio**', 'Cover hook with **bold**')
        : T('Título grande (usa **negritas** en lo clave)', 'Big title'),
      maxlength: '90',
      oninput: (e) => { s.title = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    const bodyIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.body,
      placeholder: isCover ? T('Línea de apoyo (opcional)', 'Support line') : T('Texto — separa con / para pastillas ovaladas: Respira 4-7-8 / Escribe 5 min / Té caliente', 'Text — "/" for oval pills'),
      maxlength: '200',
      oninput: (e) => { s.body = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    return el('div', { class: 'carg-card' }, [
      thumb,
      el('div', { class: 'carg-card__main' }, [
        el('div', { class: 'carg-card__head' }, [
          el('b', { text: isCover ? T('1 · Portada', '1 · Cover') : isLast ? `${i + 1} · ` + T('Cierre', 'Closing') : `${i + 1}` }),
          // Semáforo del fotómetro: verde = medido y aprobado; ámbar = revísalo.
          s.plan ? (() => {
            const detalle = s.plan.aviso || `${T('Contraste', 'Contrast')} ${s.plan.contraste}:1 · ${
              s.plan.modo === 'oscuro' ? T('texto oscuro', 'dark text') : s.plan.modo === 'banda' ? T('banda sólida', 'solid band') : T('texto blanco', 'white text')
            }${s.plan.velo ? ` · ${T('velo', 'veil')} ${Math.round(s.plan.velo * 100)}%` : ` · ${T('sin velo', 'no veil')}`}`;
            // Botón, no span: en el teléfono no existen los tooltips — un tap
            // enseña la lectura del fotómetro en un toast.
            return el('button', {
              class: 'carg-sem carg-sem--' + s.plan.semaforo, type: 'button',
              title: detalle, 'aria-label': `${T('Lectura del fotómetro', 'Photometer reading')}: ${detalle}`,
              text: s.plan.semaforo === 'verde' ? '●' : '▲',
              onclick: () => toast(detalle, s.plan.semaforo === 'verde' ? 'success' : 'info'),
            });
          })() : null,
          el('div', { class: 'carg-card__acts' }, [
            el('button', {
              class: 'btn btn-sm' + (s.posManual ? ' is-manual' : ''), type: 'button',
              title: s.posManual ? T('Altura fijada por ti — toca 3 veces para volver a automático', 'Height set by you') : T('Altura automática (la eligió la app)', 'Automatic height'),
              'aria-label': T('Altura del texto', 'Text height'),
              text: POS_LABEL[s.pos] || '↑',
              onclick: (e) => {
                // Ciclo FIJO: auto → top → mid → bottom → auto. Antes el
                // arranque dependía de la posición automática y, si esta era
                // 'mid', los manuales 'top' y 'mid' quedaban inalcanzables.
                if (!s.posManual) { s.posManual = 'top'; }
                else if (s.posManual === 'bottom') { s.posManual = null; s.pos = (s.plan && s.plan.pos) || 'mid'; }
                else { s.posManual = s.posManual === 'top' ? 'mid' : 'bottom'; }
                if (s.posManual) s.pos = s.posManual;
                e.target.textContent = POS_LABEL[s.pos];
                e.target.classList.toggle('is-manual', !!s.posManual);
                redraw();
              },
            }),
            // OTRA OPCIÓN: recorre las composiciones que el fotómetro ya midió
            // y validó para ESTA foto. No es aleatorio: son las alternativas
            // legibles, ordenadas por calidad. Instantáneo, sin llamadas.
            (s.plan && (s.plan.opciones || []).length > 1) ? el('button', {
              class: 'btn btn-sm', type: 'button', title: T('Otra composición para esta foto', 'Another composition'),
              'aria-label': T('Otra opción', 'Another option'), text: '⟳',
              onclick: () => {
                const ops = s.plan.opciones.filter((o) => o.contraste >= 3);
                if (ops.length < 2) { toast(T('Esta foto solo admite una composición legible.', 'Only one legible composition here.'), 'info'); return; }
                s.opIdx = ((s.opIdx || 0) + 1) % ops.length;
                const o = ops[s.opIdx];
                s.plan = { ...s.plan, pos: o.pos, modo: o.modo, velo: o.velo, contraste: Number(o.contraste.toFixed(1)) };
                s.posManual = null;   // vuelve a mandar el fotómetro
                s.pos = o.pos;
                renderGen(hostEl, deps);
              },
            }) : null,
            i > 0 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': T('Mover antes', 'Move earlier'), text: '←', onclick: () => { invalidarIA(); [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]]; renderGen(hostEl, deps); } }) : null,
            i < slides.length - 1 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': T('Mover después', 'Move later'), text: '→', onclick: () => { invalidarIA(); [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]]; renderGen(hostEl, deps); } }) : null,
            el('button', { class: 'btn btn-sm carg-card__del', type: 'button', 'aria-label': T('Quitar slide', 'Remove slide'), text: '✕', onclick: () => {
              invalidarIA();
              const [gone] = slides.splice(i, 1);
              try { gone && gone.bitmap && gone.bitmap.close && gone.bitmap.close(); } catch { /* noop */ }
              renderGen(hostEl, deps);
            } }),
          ].filter(Boolean)),
        ]),
        kickerIn, titleIn, bodyIn,
      ]),
    ]);
  });

  const dl = async (format) => {
    if (!slides.length) return;
    try {
      // Un redibujo diferido pendiente robaría el token a ESTE regenerate y el
      // ZIP saldría con los slides anteriores (o vacío).
      clearTimeout(redrawTimer);
      await regenerate(previewHost);
      const list = previews.slice();
      const type = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';
      const entries = [];
      for (let i = 0; i < list.length; i++) {
        const blob = await exportarSlide(list[i].canvas, type);
        if (!blob) throw new Error('canvasToBlob null');
        entries.push({ name: `${String(i + 1).padStart(2, '0')}-carrusel.${ext}`, blob });
      }
      if (entries.length === 1) { deps.download(entries[0].blob, entries[0].name); return; }

      // El ZIP lleva TODO lo del carrusel, no solo las imágenes: el caption
      // listo para pegar, los hashtags y el texto alternativo de cada slide
      // (accesibilidad + SEO). Así no hay que volver a la app a copiar nada.
      const partes = [];
      if (captionIA) partes.push('CAPTION PARA INSTAGRAM\n' + '='.repeat(40) + '\n' + captionIA);
      if (hashtagsIA) partes.push('HASHTAGS\n' + '='.repeat(40) + '\n' + hashtagsIA);
      const alts = slides.map((sl, i) => (sl.alt ? `${String(i + 1).padStart(2, '0')}: ${sl.alt}` : null)).filter(Boolean);
      if (alts.length) partes.push('TEXTO ALTERNATIVO POR SLIDE (accesibilidad y SEO)\n' + '='.repeat(40) + '\n' + alts.join('\n'));
      if (partes.length) {
        entries.push({
          name: 'caption-y-textos.txt',
          blob: new Blob([partes.join('\n\n\n')], { type: 'text/plain;charset=utf-8' }),
        });
      }

      const zip = await deps.buildZip(entries);
      const marcaSlug = (brandLabel || 'ivae').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ivae';
      deps.download(zip, `carrusel-${marcaSlug}.zip`);
      toast(T(`${list.length} slides descargados${partes.length ? ' + caption y textos' : ''}.`, `${list.length} slides downloaded.`), 'success');
    } catch (e) {
      console.error('[carrusel-gen] export', e);
      toast(T('No se pudo exportar. Intenta de nuevo.', 'Export failed. Try again.'), 'error');
    }
  };

  clear(root);
  // append() nativo convierte null en el TEXTO "null" (el() sí filtra; esto
  // no). Los ternarios de abajo devuelven null a propósito: hay que colarlos.
  root.append(...[
    el('p', { class: 'car-hint', text: T(
      'Plantilla editorial minimal: @firma + marca en cursiva + fecha arriba, paginación y chevron abajo, títulos en mayúsculas con **negritas** en lo clave, y pastillas ovaladas para listas (separa con /). Una foto por slide; el sistema arma el resto idéntico en todas.',
      'Minimal editorial template: handle + script brand + date on top, pagination and chevron below, caps titles with **bold** keywords, oval pills for lists (separate with /).',
    ) }),
    // ── ELEGIR DISEÑO ────────────────────────────────────────────────────
    // Lo que faltaba: un solo layout no alcanza. "Nota" y "Ficha" ni siquiera
    // ponen el texto sobre la foto, así que funcionan con cualquier imagen.
    el('div', { class: 'carg-plantillas' }, [
      el('span', { class: 'carg-plantillas__lbl', text: T('Diseño', 'Design') }),
      el('div', { class: 'carg-plantillas__chips' }, PLANTILLAS.map((pl) => el('button', {
        class: 'carg-chip' + (pl.id === plantillaId ? ' is-on' : ''),
        type: 'button', title: pl.descripcion,
        'aria-pressed': pl.id === plantillaId ? 'true' : 'false',
        onclick: () => {
          if (plantillaId === pl.id) return;
          plantillaId = pl.id;
          analizarTodo();      // otro diseño = otra caja de texto que medir
          renderGen(hostEl, deps);
        },
      }, [
        el('b', { text: pl.nombre }),
        el('i', { text: pl.descripcion }),
      ]))),
    ]),

    el('div', { class: 'carg-controls' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        if (slides.length >= MAX_SLIDES) { toast(T(`Ya tienes las ${MAX_SLIDES} fotos del máximo.`, `Already at the ${MAX_SLIDES}-photo max.`), 'error'); return; }
        fileIn.click();
      } }, [icon('camera', 15), ' ' + T(slides.length ? 'Agregar fotos' : 'Elegir fotos', 'Add photos')]),
      fileIn,
      el('input', { class: 'input carg-in', type: 'text', value: brandLabel, placeholder: T('Marca (centro, en cursiva)', 'Brand (center, script)'), maxlength: '36', oninput: (e) => { brandLabel = e.target.value; redrawSoon(); }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: handle, placeholder: T('@firma (izquierda)', '@handle (left)'), maxlength: '36', oninput: (e) => { handle = e.target.value; redrawSoon(); }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: ctaSupport, placeholder: T('Apoyo del cierre (ej. Guarda este post ✦ mándanos DM)', 'Closing support'), maxlength: '90', oninput: (e) => { ctaSupport = e.target.value; redrawSoon(); }, onchange: redraw }),
      // Fecha de PUBLICACIÓN (la que se imprime arriba). Vacía = hoy. Antes
      // no había forma de ponerla: armar el martes el post del viernes
      // imprimía "martes" en todos los slides.
      el('label', { class: 'carg-fecha' }, [
        el('span', { class: 'carg-fecha__lbl', text: T('Fecha del post', 'Post date') }),
        el('input', {
          class: 'input carg-in carg-fecha__in', type: 'date', value: fechaPublicacion,
          title: T('La fecha que se imprime en los slides. Vacía = hoy.', 'Date printed on slides. Empty = today.'),
          onchange: (e) => { fechaPublicacion = e.target.value || ''; redraw(); },
        }),
      ]),
    ]),

    // ── LA IA ESCRIBE ────────────────────────────────────────────────────────
    // Una línea de brief y un botón. La app ya midió las fotos; aquí la IA cura,
    // ordena y escribe todo. Lo que devuelve es un BORRADOR: cada campo sigue
    // siendo editable y la vista previa se actualiza al instante, como siempre.
    slides.length ? el('div', { class: 'carg-ia' }, [
      el('input', {
        class: 'input carg-ia__brief', type: 'text', value: brief, maxlength: '200',
        placeholder: T('¿De qué va el carrusel? Ej: promo de limpieza dental de julio', 'What is the carousel about?'),
        oninput: (e) => { brief = e.target.value; },
        onkeydown: (e) => { if (e.key === 'Enter') escribirConIA(); },
      }),
      el('button', {
        class: 'btn btn-primary carg-ia__go', type: 'button', disabled: pensando || undefined,
        onclick: escribirConIA,
      }, pensando
        ? [el('span', { class: 'carg-ia__spin' }), ' ' + T('Escribiendo…', 'Writing…')]
        : [icon('sparkles', 15), ' ' + T('Escribir con IA', 'Write with AI')]),
      el('span', { class: 'carg-ia__note', text: T(
        'La IA elige las mejores fotos, las ordena como historia y escribe los textos y el caption. Todo editable.',
        'The AI picks the best photos, orders them and writes the copy. All editable.') }),
    ]) : null,

    // Qué fotos dejó fuera y por qué (transparencia: nunca borra en silencio).
    descartes.length ? el('div', { class: 'carg-descartes' }, [
      el('b', { text: T('Fotos que dejé fuera:', 'Photos left out:') }),
      el('ul', {}, descartes.map((d) => el('li', { class: 'carg-descartes__it' }, [
        d.thumb ? el('img', { class: 'carg-descartes__mini', src: d.thumb, alt: T('Foto descartada', 'Discarded photo') }) : null,
        el('span', { text: d.motivo }),
      ]))),
    ]) : null,
    slides.length ? el('div', { class: 'carg-cards' }, slideCards) : el('div', { class: 'car-empty carg-empty' }, [
      icon('camera', 28),
      el('p', { text: T('Sin fotos todavía. Elige hasta 10 — la primera es la portada y la última el cierre.', 'No photos yet. Pick up to 10.') }),
    ]),
    // El caption de Instagram que escribió la IA, listo para copiar y pegar.
    (captionIA || hashtagsIA) ? el('div', { class: 'carg-caption' }, [
      el('div', { class: 'carg-caption__head' }, [
        el('b', { text: T('Caption para Instagram', 'Instagram caption') }),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
          try { await navigator.clipboard.writeText((captionIA + (hashtagsIA ? '\n\n' + hashtagsIA : '')).trim()); toast(T('Copiado.', 'Copied.'), 'success'); }
          catch { toast(T('No se pudo copiar.', 'Copy failed.'), 'error'); }
        } }, [icon('copy', 13), ' ' + T('Copiar todo', 'Copy all')]),
      ]),
      el('textarea', {
        class: 'input carg-caption__ta', rows: '7',
        oninput: (e) => { captionIA = e.target.value; },
      }, captionIA),
      hashtagsIA ? el('div', { class: 'carg-caption__tags', text: hashtagsIA }) : null,
    ]) : null,

    // ── ¿CÓMO SE VA A VER DE VERDAD? ────────────────────────────────────
    slides.length ? el('div', { class: 'carg-vistas' }, [
      el('span', { class: 'carg-vistas__lbl', text: T('Ver como', 'View as') }),
      ...[
        { id: 'trabajo', txt: T('Trabajo', 'Work'), ay: T('Grande, para editar', 'Large, for editing') },
        { id: 'feed', txt: T('Feed', 'Feed'), ay: T('390 px — el tamaño real en el teléfono', '390px — real phone size') },
        { id: 'perfil', txt: T('Perfil', 'Grid'), ay: T('130 px — la cuadrícula del perfil', '130px — profile grid') },
      ].map((v) => el('button', {
        class: 'carg-vista' + (vistaTamano === v.id ? ' is-on' : ''),
        type: 'button', title: v.ay, 'aria-pressed': vistaTamano === v.id ? 'true' : 'false',
        onclick: () => { vistaTamano = v.id; renderGen(hostEl, deps); },
      }, v.txt)),
    ]) : null,

    slides.length ? el('div', { class: 'carg-actions' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => regenerate(previewHost).then(() => toast(T('Vista previa lista.', 'Preview ready.'), 'success')) }, [icon('activity', 15), ' ' + T('Generar vista previa', 'Generate preview')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('jpg') }, [icon('download', 15), ' ' + T('Descargar JPG', 'Download JPG')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('png') }, ['PNG']),
    ]) : null,
    previewHost,
  ].filter(Boolean));

  if (slides.length) regenerate(previewHost);
}
