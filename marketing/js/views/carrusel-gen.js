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
import { el, clear, toast, api } from '../api.js?v=202608060321';
import { icon } from '../shell/icons.js?v=202608060321';
import { T } from '../shell/i18n.js?v=202608060321';
import * as store from '../shell/store.js?v=202608060321';
import { analizarCarrusel } from '../lib/fotometro.js?v=202608060321';
import { detectarCaras, resumenCaras } from '../lib/caras.js?v=202608060321';
import { slidesFromPost } from '../editor/slides.js?v=202608060321';
import { PLANTILLAS, plantillaPorId, PLANTILLA_POR_DEFECTO, fechaCorta } from '../lib/plantillas.js?v=202608060321';

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
let piezaId = '';           // pieza del calendario cargada (mkt_posts.id)
let textosPieza = null;     // textos de la pieza esperando a que lleguen fotos
let offPosts = null;        // desuscripción de posts:changed (selector de pieza)
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
  piezaId = ''; textosPieza = null;
  if (offPosts) { offPosts(); offPosts = null; }
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
  Raleway:         { file: 'raleway-latin-var.woff2', css: (b) => `@font-face{font-family:Raleway;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${b}) format('woff2')}` },
};

// ── ESTILO POR MARCA ─────────────────────────────────────────────────────────
// Cada marca tiene su propia tipografía, y ESA manda sobre la de la plantilla.
// La regla nació del Canva real de SMILE NOW (2026-08): sus carruseles son
// Raleway Light en mayúsculas con Bold en lo clave, y el nombre del tratamiento
// en Cormorant Garamond cursiva — nada de la Outfit/Pinyon de IVAE. El estilo
// se detecta por el campo "Marca" y se inyecta DESPUÉS del CSS de la plantilla,
// así que gana por cascada sin tocar las 9 plantillas.
const ESTILOS_MARCA = [
  {
    match: /smile/i,
    fuentes: ['Raleway', 'Cormorant', 'CormorantIt'],
    css: `
/* SMILE NOW — Raleway light + bold; wordmark espaciado; acento serif cursiva */
.slide{font-family:Raleway,sans-serif}
.title,.tit{font-family:Raleway,sans-serif;font-weight:300;letter-spacing:.03em;text-transform:uppercase}
.title b{font-weight:800}
.tit i,.title i{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:700;text-transform:none;font-size:1.16em;letter-spacing:.01em}
.fin{font-family:Raleway,sans-serif;font-weight:300;letter-spacing:.34em}
.kicker,.support,.bajada,.pag,.li,.pill,.eyebrow,.cuerpo,.detalle{font-family:Raleway,sans-serif}
/* El wordmark: S M I L E  N O W espaciado, no caligrafía */
.hdr .b{font-family:Raleway,sans-serif;font-weight:300;font-size:34px;letter-spacing:.42em;text-transform:uppercase;transform:none;white-space:nowrap}
.hdr .h,.hdr .d{font-family:Raleway,sans-serif;font-weight:500;font-size:24px;letter-spacing:.24em;text-transform:uppercase}
.marco{font-family:Raleway,sans-serif}
`,
  },
];

function estiloMarca() {
  const n = String(brandLabel || '').trim();
  if (!n) return null;
  return ESTILOS_MARCA.find((e) => e.match.test(n)) || null;
}
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

// ── Oficio tipográfico (jueces 2026-08-06) ──────────────────────────────────
// Todo esto es TRATAMIENTO de pantalla: los textos guardados no se tocan.
// Los emojis pertenecen al caption, no al arte: horneados en el JPG no se
// pueden quitar y ningún carrusel de agencia los lleva en el titular.
const sinEmoji = (t) => String(t || '')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, ' ')
  .replace(/\s{2,}/g, ' ').trim();
// Un teléfono pegado (529982039659) se agrupa como se rotula en México.
const telBonito = (t) => String(t || '').replace(/\b(\d{2})?(\d{3})(\d{3})(\d{4})\b/g,
  (m, cc, a, b, c) => (cc ? '+' : '') + [cc, a, b, c].filter(Boolean).join(' '));
// Ningún renglón termina en conector: el conector baja CON su palabra
// (espacio duro   — el carácter, JAMÁS la entidad &nbsp; que mata el
// XML). Y la última línea de una bajada nunca es huérfana de una palabra.
const CONECTORES = new Set(['y', 'e', 'o', 'u', 'en', 'un', 'una', 'de', 'del', 'al', 'para', 'con', 'por', 'sin', 'a', 'que', 'la', 'el', 'lo', 'los', 'las', 'le', 'les', 'te', 'me', 'nos', 'tu', 'su', 'mi', 'se', 'no', 'ni', 'más', 'es', 'son', 'ya', 'pero', 'aunque', 'cuando', 'como', 'donde', 'mientras', 'porque', 'si']);
function pegarConectores(t, viuda) {
  const palabras = String(t || '').split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return String(t || '');
  let out = '';
  for (let i = 0; i < palabras.length; i++) {
    out += palabras[i];
    if (i === palabras.length - 1) break;
    const esCon = CONECTORES.has(palabras[i].toLowerCase().replace(/[¿¡]/g, ''));
    const esViuda = viuda && i === palabras.length - 2;
    out += (esCon || esViuda) ? '\u00A0' : ' ';
  }
  return out;
}
// Titular display: sin punto final (se conservan ? ! …), conectores pegados.
const pulirTitulo = (t) => pegarConectores(sinEmoji(t).replace(/(?<![.!?…])\.\s*$/, ''), false);
const pulirBajada = (t) => pegarConectores(telBonito(sinEmoji(t)), true);

// El acento de la casa: la última palabra con peso del titular va en serif
// cursiva (Cormorant) — la firma que separa una pieza de agencia de una
// plantilla genérica. Solo si el texto no trae ya sus **negritas**.
function tituloHTML(t) {
  if (!t || t.includes('**')) return rich(t);
  const palabras = t.split(/[\s\u00A0]+/).filter(Boolean);
  if (palabras.length < 3) return rich(t);
  for (let i = palabras.length - 1; i >= 0; i--) {
    const cruda = palabras[i];
    const limpia = cruda.replace(/[^\p{L}]/gu, '');
    if (limpia.length >= 5 && !CONECTORES.has(limpia.toLowerCase()) && !/\d/.test(cruda)) {
      const idx = t.lastIndexOf(cruda);
      if (idx < 0) break;
      const m = cruda.match(/^([\p{L}\p{M}]+)([^]*)$/u);
      const nucleo = m ? m[1] : cruda; const cola = m ? m[2] : '';
      return esc(t.slice(0, idx)) + `<i>${esc(nucleo)}</i>` + esc(cola + t.slice(idx + cruda.length));
    }
  }
  return rich(t);
}

const DESIGN_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
.slide{position:relative;width:1080px;height:1350px;font-family:Outfit,sans-serif;color:#fff;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
/* Rampas LARGAS con paradas intermedias: un degradado de dos paradas también
   deja un tono medio perceptible; con la curva 58/22 se funde sin escalón. */
.scrim-top{position:absolute;top:0;left:0;right:0;height:300px;background:linear-gradient(rgba(12,12,16,.30),rgba(12,12,16,.17) 42%,rgba(12,12,16,.06) 74%,rgba(12,12,16,0))}
.scrim-block{position:absolute;left:0;right:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.42) 90px,rgba(12,12,16,.42))}
.scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:320px;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.08) 30%,rgba(12,12,16,.2) 62%,rgba(12,12,16,.34))}
.hdr{position:absolute;top:88px;left:104px;right:104px;display:grid;grid-template-columns:1fr auto 1fr;gap:56px;align-items:baseline;text-shadow:0 1px 14px rgba(0,0,0,.45)}.hdr .h{justify-self:start;text-wrap:balance}.hdr .d{justify-self:end;white-space:nowrap}
.hdr .h,.hdr .d{font-size:28px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.96)}
.hdr .b{font-family:'Pinyon Script',cursive;font-size:54px;line-height:1;transform:translateY(6px);color:#fff}
.pag{position:absolute;left:104px;bottom:96px;font-size:30px;font-weight:400;letter-spacing:.08em;color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%}
.chev i{position:absolute;top:50%;left:50%;width:16px;height:16px;border-top:2.5px solid rgba(255,255,255,.92);border-right:2.5px solid rgba(255,255,255,.92);transform:translate(-62%,-50%) rotate(45deg)}
.chev.down i{transform:translate(-50%,-64%) rotate(135deg)}
/* El acento de la casa: serif cursiva dentro del titular en caps. */
.title i{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:600;
  text-transform:none;letter-spacing:.01em;font-size:1.12em}
/* La firma del cierre: sustituye al chevron-siguiente (era una flecha a la
   nada). Vive sobre la línea del folio para no pisarlo. */
.fin{position:absolute;left:104px;right:104px;bottom:168px;text-align:center;
  font-size:27px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.9);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.fin .sep{opacity:.55}
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
// Las medidas estaban cableadas a las de "Editorial" (titular 99px en un carril
// de 872px). Panorámica usa un carril de 744px —porque el texto tiene que
// alejarse de las costuras— y una portada de 134px, así que el MISMO texto
// ocupa más líneas de las estimadas: el bloque crecía sin que el guardarraíl se
// enterara y la última línea se metía debajo del pie. Cazado en la prueba
// visual con fotos reales, no con un caso inventado.
const MEDIDAS_PANO = { ancho: 744, tit: 92, titSm: 76, titCover: 134, titCoverSm: 112, kicker: 32, bajada: 40, charsBajada: 30 };

// Renglones que ocupa un texto envuelto por palabras (greedy, como el
// navegador): ceil(chars/porLinea) creía que "¿TU HIJO NECESITA ORTODONCIA"
// eran 2 renglones cuando el word-wrap real da 3 — y ese renglón fantasma
// era exactamente lo que la bajada le pisaba al folio.
function lineasQueOcupa(texto, porLinea) {
  // [^\S\u00A0] = espacio en blanco EXCEPTO el duro: las palabras pegadas con
  // \u00A0 (conectores, viudas) envuelven juntas también en la estimación.
  const palabras = String(texto || '').trim().split(/[^\S\u00A0]+/).filter(Boolean);
  if (!palabras.length) return 0;
  let lineas = 1; let linea = '';
  for (const w of palabras) {
    const junta = linea ? linea + ' ' + w : w;
    if (junta.length <= porLinea || !linea) linea = junta;
    else { lineas++; linea = w; }
  }
  return lineas;
}

function altoBloque({ kicker, cleanLen, titulo, title, items, plainBody, support }, sm, comp, esPortada) {
  const pano = plantillaPorId(plantillaId).id === 'panorama';
  const M = pano ? MEDIDAS_PANO : null;
  const fsT = pano
    ? (esPortada ? (sm ? M.titCoverSm : M.titCover) : (sm ? M.titSm : M.tit))
    : (sm ? 82 : 99);
  const ancho = pano ? M.ancho : 872;
  // ANCHO MEDIO DE CARÁCTER, medido de los .woff2 reales (no el 0.52 mágico que
  // había): el titular de Editorial es Outfit 275 en MAYÚSCULAS, cuya constante
  // es .597 — con 0.52 el código creía que cabían 34 caracteres donde caben 29
  // y el bloque crecía por debajo del guardarraíl. Panorámica usa Cormorant en
  // caja normal (.423) y su carril es más estrecho, así que ahí el error se
  // multiplicaba.
  const anchoChar = pano ? 0.423 : 0.597;
  let h = 0;
  if (kicker) h += (pano ? M.kicker : 36) * 1.2 + 26;
  if (cleanLen) {
    const porLinea = Math.max(1, Math.floor(ancho / (fsT * anchoChar)));
    const tx = String(titulo || title || '').replace(/\*\*/g, '');
    const lin = tx ? lineasQueOcupa(tx, porLinea) : Math.ceil(cleanLen / porLinea);
    h += lin * fsT * 1.07 + 8;
  }
  if (items && items.length) {
    const pad = comp ? 24 : 34, fsP = comp ? 36 : 39, gap = comp ? 26 : 44, mt = comp ? 44 : 64;
    h += mt + items.reduce((a, it, i) => {
      const lineas = Math.ceil(it.length / Math.max(1, Math.floor(604 / (fsP * 0.5))));
      return a + pad * 2 + lineas * fsP * 1.3 + (i ? gap : 0);
    }, 0);
  }
  for (const t of [plainBody, support]) {
    if (t) {
      const fsB = pano ? M.bajada : 42;
      const chars = pano ? M.charsBajada : 34;
      h += (pano ? 32 : 44) + lineasQueOcupa(String(t).replace(/\*\*/g, ''), chars) * fsB * (pano ? 1.5 : 1.4);
    }
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
  const kicker = sinEmoji((s.kicker || '').trim());
  const title = pulirTitulo((s.title || '').trim());
  const bodyCrudo = (s.body || '').trim();
  const items = !isCover && bodyCrudo.includes('/') ? bodyCrudo.split('/').map((x) => sinEmoji(x.trim())).filter(Boolean).slice(0, 3) : null;
  const body = pulirBajada(bodyCrudo);
  const support = isLast ? pulirBajada(ctaSupport.trim()) : (isCover ? body : '');
  const plainBody = !isCover && !items ? body : '';

  // Posición y tratamiento: los decide el FOTÓMETRO salvo que el usuario haya
  // tocado el botón de altura (entonces manda él y el sistema se calla).
  const plan = s.plan || null;
  const pos = s.posManual || (plan && plan.pos) || s.pos || 'mid';
  // Posición FINA: el fotómetro evalúa 8 alturas y elige la mejor que no pise
  // un rostro detectado. Con posición manual (o de la IA directora) se toma la
  // mejor caja DE ESE balde que tampoco pise cara.
  let topPct = pos === 'top' ? 19 : pos === 'bottom' ? 50 : 33;
  if (s.posManual && plan && plan.opciones) {
    const cand = plan.opciones.find((o) => o.pos === pos && !o.vetoCara) || plan.opciones.find((o) => o.pos === pos);
    if (cand) topPct = cand.topPct;
  } else if (plan && typeof plan.topPct === 'number') {
    topPct = plan.topPct;
  }
  const modo = (plan && plan.modo) || 'blanco';
  const veloA = plan ? plan.velo : 0.42;   // 0.42 era el valor FIJO de antes

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
  // "BLANQUEAMIENTO," (15 chars) no cabe en la columna a 99px (14 chars/renglón):
  // una palabra que no envuelve se sale por el borde — el palabrón manda a .sm.
  const esPano = plantillaPorId(plantillaId).id === 'panorama';
  const charsFull = esPano
    ? Math.floor(MEDIDAS_PANO.ancho / ((isCover ? MEDIDAS_PANO.titCover : MEDIDAS_PANO.tit) * 0.423))
    : Math.floor(872 / (99 * 0.597));
  const palabron = title.replace(/\*\*/g, '').split(/\s+/).some((w) => w.length > charsFull);
  let smTitle = cleanLen > 46 || palabron;
  let compactas = false;
  let topAjustado = topPct;
  let miniK = 1;   // último recurso: escala proporcional del bloque entero
  let alto = 700;  // alto estimado del bloque (lo usa también la plantilla Nota)
  if (hasText) {
    // Pie REAL: la paginación arranca en y≈1218 y el chevron (a la derecha)
    // en y≈1204; el texto va centrado/izquierda, así que el piso honesto del
    // bloque es y=1200 → reserva 150. Con 205 se compactaban slides que SÍ
    // cabían (calibrado con casos reales en la ronda 2).
    const H = 1350;
    // Piso HONESTO por plantilla: Editorial = folio y≈1218 → 140. Panorámica:
    // el pie corrido arranca en y≈1144 (bottom:170) → 220; y su portada además
    // lleva la flecha circular (y1046-1120) → 310. Calibrado mirando la tira.
    const RESERVA = esPano ? (isCover ? 310 : 220) : (isLast ? 250 : 140);
    const pz = { kicker, cleanLen: title ? cleanLen : 0, titulo: title, items, plainBody, support };
    const estima = (sm, comp) => altoBloque(pz, sm, comp, isCover);
    alto = estima(smTitle, compactas);
    const cabe = () => (H * topAjustado / 100) + alto * miniK <= H - RESERVA;
    if (!cabe() && !smTitle) { smTitle = true; alto = estima(smTitle, compactas); }
    if (!cabe() && items) { compactas = true; alto = estima(smTitle, compactas); }
    if (!cabe()) {
      // Subir sí, pero JAMÁS por encima de la altura más alta que el fotómetro
      // marcó libre de rostro: antes el empuje ciego podía plantar el bloque
      // sobre la cara que el veto había esquivado. Si ni así cabe, se encoge.
      const libres = plan && plan.opciones ? plan.opciones.filter((o) => !o.vetoCara).map((o) => o.topPct) : [];
      const techo = libres.length ? Math.min(...libres) : 12;
      topAjustado = Math.max(techo, Math.floor((H - RESERVA - alto) / H * 100));
    }
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
  if (title) inner += `<div class="title${smTitle ? ' sm' : ''}">${tituloHTML(title)}</div>`;
  if (items) inner += `<div class="pills${compactas ? ' compactas' : ''}">${items.map((it) => `<div class="pill">${esc(it)}</div>`).join('')}</div>`;
  if (plainBody) inner += `<div class="support">${rich(plainBody)}</div>`;
  if (support) inner += `<div class="support">${isLast ? rich(support).replace(/ · /g, '<br/>') : rich(support)}</div>`;

  const blockTop = `${topAjustado}%`;

  // El pie SIEMPRE cae dentro de la banda (ésta llega a bottom:0), y el
  // encabezado solo si el bloque subió tanto que la banda lo alcanza. Donde
  // manda la banda (#0C0C10, casi negra) el texto va claro, sin importar lo
  // que dijera la foto: medir la foto tapada era el defecto. (Vive DESPUÉS del
  // guardarraíl: usar topAjustado antes de declararlo era un ReferenceError
  // latente que tronaba el primer slide en modo banda — lo cazó el lint.)
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
  const miniCSS = miniK < 1
    ? `;transform:scale(${miniK.toFixed(3)});transform-origin:top left;width:${Math.round(872 / miniK)}px;left:104px;right:auto`
    : '';
  // ── LA LEY DE LA SOMBRA (Vianey, 2026-08-06) ─────────────────────────────
  // Tres formas válidas y NADA intermedio:
  //  · DIFUMINADA — anclada a un BORDE de la foto (arriba o abajo), llega al
  //    texto con fuerza completa y muere hacia adentro sin que se note dónde
  //    termina (rampa larguísima con curva). Jamás flota a media foto.
  //  · COMPLETA — manta uniforme sobre TODA la foto, sin degradado.
  //  · LOCAL — un cojín elíptico pegado al bloque de texto, con pluma ancha.
  // Elección: texto abajo → difuminada desde abajo; texto arriba → desde
  // arriba; texto en medio → local (un degradado a media foto siempre se ve a
  // medio hacer). Y si la foto pide un velo muy fuerte por todos lados
  // (veloA ≥ .52), mejor COMPLETA: pareja y honesta, como se hace a mano.
  const textoY = Math.round(topAjustado * 13.5);            // % → px sobre 1350
  const finBloque = Math.min(1350, textoY + alto + 60);
  let veloForma = '';
  if (veloA >= 0.52) {
    // COMPLETA (uniforme; se rebaja porque cubre todo y suma en cada píxel)
    veloForma = `<div style="position:absolute;inset:0;background:rgba(12,12,16,${Math.min(0.58, veloA * 0.82).toFixed(3)})"></div>`;
  } else if (pos === 'bottom' || pos === 'mid' && textoY > 620) {
    // DIFUMINADA desde ABAJO: fuerza completa desde 40px antes del texto hasta
    // el borde inferior; el desvanecido hacia arriba ocupa hasta 520px.
    const rampa = Math.max(180, Math.min(520, textoY - 40));
    const ini = Math.max(0, textoY - 40 - rampa);
    veloForma = `<div style="position:absolute;left:0;right:0;top:${ini}px;bottom:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,${(veloA * 0.18).toFixed(3)}) ${Math.round(rampa * 0.38)}px,rgba(12,12,16,${(veloA * 0.55).toFixed(3)}) ${Math.round(rampa * 0.7)}px,rgba(12,12,16,${veloA}) ${rampa}px,rgba(12,12,16,${veloA}))"></div>`;
  } else if (pos === 'top') {
    // DIFUMINADA desde ARRIBA (espejo)
    const rampa = Math.max(180, Math.min(520, 1350 - finBloque));
    veloForma = `<div style="position:absolute;left:0;right:0;top:0;height:${finBloque + rampa}px;background:linear-gradient(rgba(12,12,16,${veloA}),rgba(12,12,16,${veloA}) ${finBloque}px,rgba(12,12,16,${(veloA * 0.55).toFixed(3)}) ${finBloque + Math.round(rampa * 0.3)}px,rgba(12,12,16,${(veloA * 0.18).toFixed(3)}) ${finBloque + Math.round(rampa * 0.62)}px,rgba(12,12,16,0))"></div>`;
  } else {
    // LOCAL: cojín elíptico bajo la letra, pluma ancha, sin bordes.
    const cy = textoY + alto / 2;
    const ry = Math.round(alto / 2 + 190);
    veloForma = `<div style="position:absolute;left:-8%;right:-8%;top:${Math.max(0, cy - ry)}px;height:${ry * 2}px;background:radial-gradient(ellipse 78% 52% at 50% 50%,rgba(12,12,16,${Math.min(0.6, veloA * 1.05).toFixed(3)}),rgba(12,12,16,${(veloA * 0.5).toFixed(3)}) 46%,rgba(12,12,16,0) 74%)"></div>`;
  }
  const veloHTML = !hasText ? ''
    : modo === 'banda'
      ? `<div class="banda" style="top:${Math.max(0, topAjustado - 7)}%;bottom:0"></div>`
      : modo === 'oscuro'
        ? `<div class="scrim-block veil-claro" style="top:${Math.max(0, topAjustado - 7)}%;bottom:0;--va:${veloA}"></div>`
        : veloForma;

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

  // Los velos fijos de cabecera/pie NO se apilan con las formas nuevas: si la
  // difuminada ya cubre ese borde (o la manta completa cubre todo), pintarlos
  // encima crea justo el "medio velo" que la ley prohíbe.
  const completa = veloA >= 0.52 && modo !== 'banda' && modo !== 'oscuro';
  const scrimArriba = modo === 'oscuro' || completa || pos === 'top' ? '' : '<div class="scrim-top"></div>';
  const scrimAbajo = modo === 'oscuro' || completa || pos === 'bottom' || (pos === 'mid' && textoY > 620) ? '' : '<div class="scrim-bottom"></div>';
  return `
  <div class="slide${claseModo}">
    ${scrimArriba}
    ${veloHTML}
    ${scrimAbajo}
    <div class="hdr">
      <span class="h">${esc(handle.trim())}</span>
      <span class="b">${esc(brandLabel.trim())}</span>
      <span class="d">${now.getDate()} ${MES} ${now.getFullYear()}</span>
    </div>
    ${hasText ? `<div class="block" style="top:${blockTop}${miniCSS}">${inner}</div>` : ''}
    <div class="pag">${String(idx + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}</div>
    ${isLast
    ? `<div class="fin">${esc(brandLabel.trim())}${handle.trim() ? ` <span class="sep">·</span> ${esc(handle.trim())}` : ''}</div>`
    : '<div class="chev"><i></i></div>'}
  </div>`;
}

// Rasteriza la capa de diseño (HTML→SVG→imagen) a 2× para nitidez del export.
async function designLayer(s, idx, total) {
  const P = plantillaPorId(plantillaId);
  // Cada plantilla trae SU hoja de estilos y SUS fuentes: no se embeben las
  // cuatro familias siempre (cada una pesa ~40 KB dentro del SVG).
  // El estilo de la MARCA se suma al de la plantilla: sus fuentes se embeben
  // también, y su CSS va AL FINAL para ganar por cascada.
  const marca = estiloMarca();
  let fonts = P.id === 'editorial' ? await designFonts() : await fuentesDe(P);
  if (marca) {
    const extra = await Promise.all(marca.fuentes.map(fuenteEmbebida));
    fonts += extra.join('');
  }
  const hoja = (P.id === 'editorial' ? DESIGN_CSS : P.css({ tinta: '#1D2A24' })) + (marca ? marca.css : '');
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
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sanearXML(svg));
  });
  return img;
}

// Un SVG como data-URI se parsea con XML ESTRICTO, y XML solo conoce cinco
// entidades: &amp; &lt; &gt; &quot; &apos;. Cualquier otra con nombre —&nbsp;,
// &iacute;, &ldquo;— hace fallar el parseo y el slide COMPLETO no se dibuja.
// Hoy esc() protege el texto del cliente, pero basta con que alguien ate una
// viuda con &nbsp; en una plantilla, o que la IA devuelva &mdash;, para tumbar
// la vista previa entera con un "intenta de nuevo" que no explica nada.
// Aquí se traducen a su forma numérica, que XML sí entiende.
const ENTIDADES = {
  nbsp: 160, iexcl: 161, laquo: 171, raquo: 187, deg: 176, middot: 183,
  aacute: 225, eacute: 233, iacute: 237, oacute: 243, uacute: 250,
  Aacute: 193, Eacute: 201, Iacute: 205, Oacute: 211, Uacute: 218,
  ntilde: 241, Ntilde: 209, uuml: 252, Uuml: 220,
  ldquo: 8220, rdquo: 8221, lsquo: 8216, rsquo: 8217,
  mdash: 8212, ndash: 8211, hellip: 8230, bull: 8226,
  eacutes: 233, times: 215, oline: 8254, prime: 8242,
};
function sanearXML(s) {
  return String(s).replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (todo, nombre) => {
    if (nombre === 'amp' || nombre === 'lt' || nombre === 'gt' || nombre === 'quot' || nombre === 'apos') return todo;
    const cp = ENTIDADES[nombre];
    if (cp) return `&#${cp};`;
    // Desconocida: se neutraliza el & para que el SVG SIGA dibujándose. Perder
    // un carácter raro es infinitamente mejor que perder el slide entero.
    console.warn('[carrusel] entidad XML no soportada, se escapa:', todo);
    return `&amp;${nombre};`;
  });
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

// ── PANORÁMICA: una sola imagen continua a lo largo de TODA la tira ─────────
//
// Con UNA foto se estira sobre los W×total y cada slide enseña su trozo: al
// deslizar la foto no cambia, sigue. Con VARIAS se reparten pegadas a lo ancho,
// pero con anchos DESIGUALES a propósito: si cada foto midiera justo un slide,
// sus bordes caerían clavados en las costuras y se vería igual que un carrusel
// normal. El ritmo desigual obliga a que las fotos crucen de un slide al
// siguiente, que es exactamente lo que produce la sensación de continuidad.
function planPanorama(n, total) {
  const anchoTira = W * total;
  if (n <= 1) return [{ x: 0, w: anchoTira }];
  const paso = total / n;
  // Se BUSCA el desfase que deja las uniones entre fotos lo más lejos posible
  // de los bordes de slide. Sin esto, con 4 fotos en 4 slides cada foto cae
  // justo en su slide y el resultado se ve idéntico a un carrusel normal —
  // pasó en la primera prueba: las uniones quedaron en 1.21 / 2.04 / 3.13,
  // pegadas a 1 / 2 / 3. Con la búsqueda quedan en 1.5 / 2.5 / 3.5, o sea a
  // media cara de cada slide, que es lo que obliga a la foto a cruzar.
  // Barrido determinista: el mismo mazo da siempre el mismo reparto.
  let mejor = 0;
  let mejorDist = -1;
  for (let d = 0; d < 1; d += 0.02) {
    let minDist = 9;
    for (let k = 1; k < n; k++) {
      const c = k * paso + d;
      if (c <= 0.03 || c >= total - 0.03) { minDist = -1; break; }  // se saldría de la tira
      minDist = Math.min(minDist, Math.abs(c - Math.round(c)));
    }
    if (minDist > mejorDist) { mejorDist = minDist; mejor = d; }
  }
  const cortes = [0, ...Array.from({ length: n - 1 }, (_, k) => (k + 1) * paso + mejor), total];
  return Array.from({ length: n }, (_, i) => ({
    x: cortes[i] * W,
    w: (cortes[i + 1] - cortes[i]) * W,
  }));
}

function pintarPanorama(ctx, idx, total) {
  const bmps = slides.map((s) => s.bitmap).filter(Boolean);
  if (!bmps.length) return;
  const plan = planPanorama(bmps.length, total);
  const desp = idx * W;
  ctx.save();
  ctx.translate(-desp, 0);
  bmps.forEach((bmp, i) => {
    const c = plan[i];
    if (!c) return;
    if (c.x + c.w < desp - 4 || c.x > desp + W + 4) return;  // no toca este slide
    ctx.save();
    // Medio píxel de solape: sin esto se ve una hilacha clara entre foto y foto.
    ctx.beginPath(); ctx.rect(c.x - 0.5, 0, c.w + 1, H); ctx.clip();
    const e = Math.max(c.w / bmp.width, H / bmp.height);
    ctx.drawImage(bmp, c.x + (c.w - bmp.width * e) / 2, (H - bmp.height * e) / 2,
      bmp.width * e, bmp.height * e);
    ctx.restore();
  });
  ctx.restore();
}

// En panorámica el slide i NO enseña `slides[i].bitmap`: enseña un TROZO de la
// tira, que puede ser de otra foto o de dos a la vez. Si el fotómetro midiera
// el bitmap suelto, calcularía el velo de una imagen que ni siquiera está en
// pantalla. Aquí se rasteriza el trozo REAL y se le da a medir eso.
function trozosPanorama(total) {
  return Array.from({ length: total }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = 270; c.height = 338;   // misma proporción 4:5; de sobra para medir
    const g = c.getContext('2d', { willReadFrequently: true });
    g.scale(c.width / W, c.height / H);
    pintarPanorama(g, i, total);
    return c;
  });
}

// Cuánto de la foto sobrevive al estirarla sobre su celda. Una foto normal
// (3:2) repartida en 5 slides pierde ~60% del alto: la cara que importaba se
// queda fuera y no hay forma de saberlo mirando la miniatura. Por eso se avisa.
function recortePanorama(total) {
  const bmps = slides.map((s) => s.bitmap).filter(Boolean);
  if (!bmps.length) return null;
  const plan = planPanorama(bmps.length, total);
  let peor = 1;
  bmps.forEach((b, i) => {
    const c = plan[i];
    if (!c) return;
    const e = Math.max(c.w / b.width, H / b.height);
    const visible = Math.min(1, H / (b.height * e));   // fracción del alto que se ve
    if (visible < peor) peor = visible;
  });
  return peor;
}

// ── Foto (canvas, calidad máxima) ────────────────────────────────────────────
//
// La capa de diseño se pinta ENCIMA de esto y no puede llevar fondo opaco (le
// taparía la foto entera — la trampa que costó dos plantillas). Así que cuando
// un diseño quiere fondo de color y la foto metida en un recuadro, lo declara
// aquí: `fondo` lo pinta el canvas y `cajaFoto` dice dónde va la imagen.
function fitCover(ctx, bmp, caras) {
  const pl = plantillaPorId(plantillaId);
  // Rótulo y familia sinFoto son PAPEL: pintarles la foto debajo dejaba tinta
  // oscura sobre imagen ocupada — ilegible y fuera de la ley del velo.
  if (pl.sinFoto) return;
  // La cara más grande manda el recorte de los RECUADROS (Papel decapitaba al
  // niño: recorte apaisado centrado ciego sobre foto vertical). Solo aplica a
  // cajas — el cover a sangre sigue centrado porque el fotómetro y las coords
  // de caras asumen ese encuadre.
  const cara = (() => {
    if (!caras || !caras.length) return null;
    const e0 = Math.max(W / bmp.width, H / bmp.height);
    const dx0 = (W - bmp.width * e0) / 2; const dy0 = (H - bmp.height * e0) / 2;
    const c = caras.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    return { x: (c.x + c.w / 2 - dx0) / e0, y: (c.y + c.h / 2 - dy0) / e0 };
  })();
  const encaja = (boxW, boxH, focoY) => {
    const e = Math.max(boxW / bmp.width, boxH / bmp.height);
    let offX = (boxW - bmp.width * e) / 2;
    let offY = (boxH - bmp.height * e) / 2;
    if (cara) {
      if (bmp.width * e > boxW + 1) offX = Math.min(0, Math.max(boxW - bmp.width * e, boxW * 0.5 - cara.x * e));
      if (bmp.height * e > boxH + 1) offY = Math.min(0, Math.max(boxH - bmp.height * e, boxH * focoY - cara.y * e));
    }
    return { e, offX, offY };
  };
  if (pl.cajaFoto) {
    const c = pl.cajaFoto;
    ctx.save();
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    // La cara al 40% del alto del recuadro: aire arriba, nunca guillotina.
    const f = encaja(c.w, c.h, 0.40);
    ctx.drawImage(bmp, c.x + f.offX, c.y + f.offY, bmp.width * f.e, bmp.height * f.e);
    ctx.restore();
    return;
  }
  // "Ficha" parte el lienzo: la foto ocupa el 56% de arriba y el panel sólido
  // el resto. Dibujar la foto a sangre completa la dejaría tapada a la mitad.
  const alto = pl.id === 'ficha' ? H * 0.56 : H;
  if (pl.id === 'ficha') {
    const f = encaja(W, alto, 0.44);
    ctx.drawImage(bmp, f.offX, f.offY, bmp.width * f.e, bmp.height * f.e);
    return;
  }
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
      const alto = altoBloque(piezasDe(s, i, slides.length), false, false, i === 0);
      return Math.max(20, Math.min(70, Math.round((alto / 1350) * 100)));
    });
    // Tamaño REAL del titular por slide: la portada va a 152px y los
    // interiores a 104/86. De eso depende cuánta sombra hace falta.
    const pxTitular = slides.map((s, i) => {
      const largo = String(s.title || '').replace(/\*\*/g, '').length;
      if (i === 0) return largo > 46 ? 126 : 152;
      return largo > 46 ? 86 : 104;
    });
    // En panorámica se mide el TROZO que ve cada slide, no la foto suelta.
    const fuentes = plantillaPorId(plantillaId).id === 'panorama'
      ? trozosPanorama(slides.length)
      : slides.map((s) => s.bitmap);
    const planes = analizarCarrusel(fuentes, { altosPct: altos, pxTitular, carasPorFoto: plantillaPorId(plantillaId).id === 'panorama' ? [] : slides.map((x) => x.caras || []) });
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

// ── PASO 1 DEL ESTUDIO: la pieza del calendario ─────────────────────────────
// Los textos YA viven en el calendario (hook / slides / cta). Copiarlos a mano
// al generador era absurdo: se eligen de una lista y entran solos. Un texto
// corto va al título; uno largo se parte en título (primera oración) + cuerpo.
function partirTextoPieza(t) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  if (!t) return { title: '', body: '' };
  // Un teléfono al final JAMÁS va en el titular gigante: baja a la bajada
  // (el texto queda íntegro, solo cambia de jerarquía).
  let tel = '';
  const mTel = t.match(/^([^]*?[a-záéíóúüñ)!?.…:])\s+(\+?\d[\d\s().-]{6,})\s*$/i);
  if (mTel) { t = mTel[1].trim(); tel = mTel[2].trim(); }
  // Un corte que deja una MIGAJA de bajada ("…que te / faltan.") no es diseño:
  // si el resto es ínfimo y el total aún cabe en título chico, va entero.
  const listo = (title, body) => {
    if (body && body.length < 12 && (title.length + body.length) <= 76) { title = (title + ' ' + body).trim(); body = ''; }
    return { title, body: [body, tel].filter(Boolean).join(' ').trim().slice(0, 200) };
  };
  // 56 chars de tope en el título: en MAYÚSCULAS son 2-3 renglones, no 5.
  if (t.length <= 56) return listo(t, '');
  // GREEDY: la oración completa MÁS LARGA que quepa. El regex perezoso de antes
  // cortaba en la primera coma y dejaba "¿…ortodoncia" sin cerrar la pregunta.
  let m = t.match(/^(.{10,55}[.!?…])\s+([^]*)$/);
  if (!m) m = t.match(/^(.{10,55}[,;:])\s+([^]*)$/);
  if (m) return listo(m[1].replace(/[,;:]$/, '').trim(), m[2].trim());
  const corte = t.slice(0, 56).lastIndexOf(' ');
  return listo(t.slice(0, corte > 20 ? corte : 56).trim(), t.slice(corte > 20 ? corte : 56).trim());
}

// Reparte M textos en N slides: hook → 1, CTA → SIEMPRE el último, intermedios
// en orden. Y la regla de Vianey: NINGÚN slide sin texto — si hay más fotos que
// textos, se parte el texto más largo en dos por oración (lo que haría un
// diseñador), las veces que haga falta.
function repartirTextos(textos, n) {
  if (!textos.length || !n) return Array.from({ length: n }, () => null);
  const cta = textos.length > 1 ? textos[textos.length - 1] : null;
  const cuerpo = textos.slice(0, cta ? -1 : undefined).map((t) => ({ ...t }));
  let guardia = 12;
  while (cuerpo.length + (cta ? 1 : 0) < n && guardia--) {
    // El candidato a partirse: el cuerpo más largo que tenga DOS mitades
    // dignas (≥12 chars cada una) — con frontera de oración aunque el total
    // sea corto, o por la mitad si es un parrafón sin puntuar (≥70).
    let idx = -1; let max = 0; let corte = null;
    cuerpo.forEach((t, i) => {
      const b0 = t.body || '';
      if (b0.length <= max) return;
      const m = b0.match(/^(.{12,}?[.!?…])\s+(.{12,})$/) || b0.match(/^(.{12,}?),\s+(.{12,})$/);
      if (m) { max = b0.length; idx = i; corte = [m[1], m[2]]; return; }
      if (b0.length > 70) {
        const sp = b0.indexOf(' ', Math.floor(b0.length / 2));
        if (sp > 0) { max = b0.length; idx = i; corte = [b0.slice(0, sp), b0.slice(sp + 1)]; }
      }
    });
    if (idx < 0) break;   // ya no hay nada partible: quedarán huecos y se avisa
    cuerpo[idx].body = corte[0].trim();
    // El fragmento abre un slide nuevo: arranca con mayúscula.
    let b = corte[1].trim(); b = b.charAt(0).toUpperCase() + b.slice(1);
    cuerpo.splice(idx + 1, 0, partirTextoPieza(b));
  }
  const out = [];
  for (let i = 0; i < n - (cta ? 1 : 0); i++) out.push(cuerpo[i] || null);
  if (cta) out.push(cta);
  // Sus textos del calendario JAMÁS se pierden en silencio: con más textos que
  // fotos, los que no caben se anexan al cuerpo del último slide que sí entró.
  const sobran = cuerpo.length - (n - (cta ? 1 : 0));
  if (sobran > 0) {
    const resto = cuerpo.slice(n - (cta ? 1 : 0)).map((t) => [t.title, t.body].filter(Boolean).join(' ')).join(' ');
    const ultimo = out[n - (cta ? 2 : 1)] || out[n - 1];
    if (ultimo) ultimo.body = [(ultimo.body || ''), resto].filter(Boolean).join(' ').slice(0, 200);
    toast(T(`${sobran} texto(s) no caben en ${n} fotos: se sumaron al último slide. Sube más fotos para darles su propio slide.`, `${sobran} text(s) merged into the last slide — add photos to give them their own slide.`), 'info');
  }
  const huecos = out.filter((x) => !x).length;
  if (huecos) {
    toast(T(`${huecos} slide(s) quedaron sin texto: escribe algo o quita fotos.`, `${huecos} slide(s) without text.`), 'info');
  }
  return out;
}

function cargarPieza(post) {
  if (!post) { piezaId = ''; textosPieza = null; return; }
  piezaId = post.id;
  const textos = slidesFromPost(post).map(partirTextoPieza);
  if (post.publish_date) fechaPublicacion = String(post.publish_date).slice(0, 10);
  if (slides.length) {
    // Reparto con CABEZA: el hook al slide 1, el CTA SIEMPRE al último, los
    // intermedios en orden y los slides sobrantes quedan de respiro (sin texto).
    const mapa = repartirTextos(textos, slides.length);
    slides.forEach((sl, i) => {
      const t = mapa[i] || { title: '', body: '' };
      sl.kicker = ''; sl.title = t.title; sl.body = t.body;
    });
    textosPieza = null;
    invalidarIA(); analizarTodo(); renderGen(hostEl, deps);
  } else {
    // Aún sin fotos: quedan en espera y se aplican conforme lleguen.
    textosPieza = textos;
    renderGen(hostEl, deps);
  }
  toast(T(`Pieza cargada: ${textos.length} textos del calendario.`, `Piece loaded: ${textos.length} texts.`), 'success');
}

// DIRIGIR sin escribir: los textos de la usuaria quedan INTACTOS; la IA mira
// cada foto y solo decide el diseño (posición del texto + avisos de dirección
// tipo "esta foto contradice el mensaje"). Es el modo para el flujo real de
// Vianey: ella da fotos y textos, el sistema los hace ver de agencia.
async function dirigirConIA() {
  if (pensando) return;
  if (slides.length < 2) { toast(T('Sube al menos 2 fotos para dirigir.', 'Add at least 2 photos.'), 'error'); return; }
  pensando = true;
  renderGen(hostEl, deps);
  const token = ++iaToken;
  try {
    const fotos = await Promise.all(slides.map(async (s) => ({
      b64: s.bitmap ? await miniatura(s.bitmap) : null,
      mime: 'image/jpeg',
      plan: s.plan ? { pos: s.plan.pos, modo: s.plan.modo, semaforo: s.plan.semaforo, aviso: [s.plan.aviso, resumenCaras(s.caras)].filter(Boolean).join(' ') || null } : null,
    })));
    const textos = slides.map((s) => ({ kicker: s.kicker || '', title: s.title || '', body: s.body || '' }));
    if (token !== iaToken) return;
    const { activeClientId } = store.getState();
    const out = await api.post('/carousel/guion', {
      brief, marca: brandLabel, nSlides: slides.length, client_id: activeClientId, fotos, textos,
    }, { timeout: 180000 });
    if (token !== iaToken) { IA_TARDE(); return; }
    // SOLO se aplica la dirección: posición por slide. Ni orden, ni textos.
    let movidos = 0;
    (out.slides || []).slice(0, slides.length).forEach((t, i) => {
      if ((t.pos === 'top' || t.pos === 'mid' || t.pos === 'bottom') && t.pos !== slides[i].pos) {
        slides[i].pos = t.pos;
        slides[i].posManual = t.pos;
        movidos++;
      }
      if (t.alt && !slides[i].alt) slides[i].alt = t.alt;
    });
    // Los avisos de dirección se muestran, jamás se actúan en silencio.
    const avisos = (out.descartadas || []).map((d) => `Foto ${Number(d.i) + 1}: ${d.motivo}`).filter(Boolean);
    descartes = avisos.map((m) => ({ motivo: m, thumb: null }));
    analizarTodo();
    toast(avisos.length
      ? T(`Diseño dirigido (${movidos} textos reacomodados). Ojo: ${avisos.length} aviso(s) de fotos abajo.`, `Directed (${movidos} moved). ${avisos.length} photo warning(s).`)
      : T(`Diseño dirigido: ${movidos} textos reacomodados mirando tus fotos.`, `Directed: ${movidos} texts repositioned.`), 'success');
  } catch (e) {
    toast((e && e.message) || T('No se pudo dirigir el diseño.', 'Could not direct.'), 'error');
  } finally {
    pensando = false;
    renderGen(hostEl, deps);
  }
}

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
      // Rótulo tiene slides sin foto: a la IA le viaja null y escribe solo con
      // el brief (miniatura(null) tronaría el envío completo).
      b64: s.bitmap ? await miniatura(s.bitmap) : null,
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
      // La IA también DIRIGE: eligió dónde va el texto MIRANDO la foto (caras,
      // zonas tranquilas). Se fija como decisión manual para que el fotómetro
      // no la pise al re-medir; el botón de posición sigue mandando después.
      if (t.pos === 'top' || t.pos === 'mid' || t.pos === 'bottom') {
        slides[i].pos = t.pos;
        slides[i].posManual = t.pos;
      }
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
    if (token !== genToken) return false;   // otro render mandó: éste ya no vale
    const layers = await Promise.all(slides.map((s, i) => designLayer(s, i, slides.length)));
    if (token !== genToken) return false;
    previews = [];
    clear(previewHost);
    slides.forEach((s, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
      const c2 = canvas.getContext('2d');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.scale(SCALE, SCALE);
      c2.fillStyle = plantillaPorId(plantillaId).fondo || '#0B0B10';
      c2.fillRect(0, 0, W, H);
      const pid = plantillaPorId(plantillaId).id;
      if (pid === 'mural') pintarMural(c2, i, slides.length);
      else if (pid === 'panorama') pintarPanorama(c2, i, slides.length);
      else if (s.bitmap) fitCover(c2, s.bitmap, s.caras);
      c2.drawImage(layers[i], 0, 0, W, H);
      previews.push({ canvas });
      const cell = el('div', { class: 'carg-cell' }, [el('div', { class: 'carg-cell__num', text: String(i + 1) })]);
      canvas.className = 'carg-cell__canvas';
      cell.prepend(canvas);
      previewHost.appendChild(cell);
    });
    return true;   // el render salió bien y `previews` está al día
  } catch (e) {
    console.error('[carrusel-gen] render', e);
    toast(T('No se pudo generar la vista previa. Intenta de nuevo.', 'Preview failed. Try again.'), 'error');
    return false;  // quien llame NO debe usar `previews`: quedó del render anterior
  }
}

// ── UI ───────────────────────────────────────────────────────────────────────
const POS_LABEL = { top: '↑', mid: '·', bottom: '↓' };

// Aviso de recorte de la panorámica. Devuelve null cuando no aplica, así que
// va SIEMPRE dentro de un el() (que filtra nulls) — nunca en un append nativo.
function avisoPanorama() {
  if (plantillaPorId(plantillaId).id !== 'panorama') return null;
  const visible = recortePanorama(slides.length);
  if (visible == null || visible >= 0.55) return null;
  const perdido = Math.round((1 - visible) * 100);
  // Cuántos slides aguantaría este material conservando ≥55% del alto.
  const bmps = slides.map((s) => s.bitmap).filter(Boolean);
  let cabe = 1;
  for (let n = slides.length; n >= 2; n--) {
    const plan = planPanorama(bmps.length, n);
    const ok = bmps.every((b, i) => {
      const c = plan[i]; if (!c) return true;
      const e = Math.max(c.w / b.width, H / b.height);
      return Math.min(1, H / (b.height * e)) >= 0.55;
    });
    if (ok) { cabe = n; break; }
  }
  return el('div', { class: 'carg-nota carg-nota--warn' }, [
    icon('close', 14),
    el('span', {
      text: T(
        `La panorámica está recortando el ${perdido}% del alto de tus fotos. `
        + (cabe >= 2
          ? `Con ${cabe} slides se vería completa, o agrega fotos más anchas.`
          : 'Usa menos slides, agrega más fotos o elige una foto horizontal amplia.'),
        `The panorama is cropping ${perdido}% of your photos' height. `
        + (cabe >= 2 ? `${cabe} slides would fit, or add wider photos.` : 'Use fewer slides or add wider photos.'),
      ),
    }),
  ]);
}

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
    // Preset por marca: la firma del masthead no se vuelve a teclear jamás.
    const CONFIG_MARCA = [
      { match: /smile/i, marca: 'Smile Now', handle: 'DENTAL & FACIAL CARE', plantilla: 'editorial' },
    ];
    const cfg = CONFIG_MARCA.find((c) => c.match.test(brandLabel));
    if (cfg) {
      brandLabel = cfg.marca; handle = cfg.handle;
      if (cfg.plantilla) plantillaId = cfg.plantilla;
    }
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
      // Textos de la pieza en espera: se reparten sobre el LOTE completo
      // (hook → 1, CTA → último) ahora que ya se sabe cuántas fotos hay.
      if (textosPieza && slides.length) {
        const mapa = repartirTextos(textosPieza, slides.length);
        slides.forEach((sl, i) => {
          const t = mapa[i];
          if (t && !sl.title && !sl.body) { sl.title = t.title; sl.body = t.body; }
        });
        textosPieza = null;
      }
      analizarTodo();          // el fotómetro decide posición y tratamiento
      renderGen(hostEl, deps);
      // ROSTROS REALES: el detector corre en segundo plano y al terminar se
      // re-mide todo — el texto no puede pisar una cara detectada (regla dura).
      const pendientes = slides.filter((x) => x.bitmap && !x.caras);
      Promise.all(pendientes.map(async (x) => { x.caras = await detectarCaras(x.bitmap); }))
        .then(() => { if (pendientes.length) { analizarTodo(); renderGen(hostEl, deps); } })
        .catch(() => { /* sin detector: la heurística de piel sigue */ });
    },
  });

  const slideCards = slides.map((s, i) => {
    const isCover = i === 0;
    const isLast = i === slides.length - 1 && slides.length > 1;
    const thumb = el('canvas', { class: 'carg-card__thumb' });
    const tctx = thumb.getContext('2d');
    thumb.width = 216; thumb.height = 270;
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    if (s.bitmap) {
      const sc = Math.max(216 / s.bitmap.width, 270 / s.bitmap.height);
      tctx.drawImage(s.bitmap, (216 - s.bitmap.width * sc) / 2, (270 - s.bitmap.height * sc) / 2, s.bitmap.width * sc, s.bitmap.height * sc);
    } else {
      // Slide sin foto (plantilla Rótulo): papel con el número, no un hueco negro.
      tctx.fillStyle = '#F1EEE8'; tctx.fillRect(0, 0, 216, 270);
      tctx.fillStyle = '#E4DFD6'; tctx.font = '600 130px Cormorant, Georgia, serif';
      tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
      tctx.fillText(String(i + 1).padStart(2, '0'), 108, 140);
    }

    // CAMBIAR FOTO sin tocar el diseño: la regla de Vianey — "si no me gusta,
    // cambio la foto, no el diseño". Entra la foto nueva, los textos quedan
    // intactos, y el sistema re-decide posición y velo PARA ESA foto (por eso
    // se borra posManual: la decisión anterior era de la foto que se fue).
    const fotoIn = el('input', {
      type: 'file', accept: 'image/*', hidden: true,
      onchange: async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          invalidarIA();
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
          try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ }
          s.bitmap = bitmap;
          s.file = f;
          s.posManual = null;
          s.plan = null;
          s.caras = await detectarCaras(bitmap).catch(() => []);
          analizarTodo();
          renderGen(hostEl, deps);
          toast(T(`Foto del slide ${i + 1} cambiada — el diseño se reacomodó para ella.`, `Slide ${i + 1} photo swapped.`), 'success');
        } catch {
          toast(T(`No pude leer "${f.name}" — usa JPG o PNG.`, `Could not read "${f.name}".`), 'error');
        }
      },
    });
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
      el('div', { class: 'carg-card__foto' }, [
        thumb,
        s.bitmap ? el('button', {
          class: 'carg-card__swap', type: 'button',
          title: T('Cambiar SOLO la foto: tus textos y el diseño se quedan; el sistema se reacomoda para la foto nueva.', 'Swap only the photo.'),
          onclick: () => fotoIn.click(),
        }, [icon('camera', 13), ' ' + T('Cambiar', 'Swap')]) : null,
        fotoIn,
      ]),
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
      // Si el render falla, `previews` conserva los slides del render ANTERIOR:
      // exportarlos daría un ZIP con contenido viejo y un toast de éxito.
      const ok = await regenerate(previewHost);
      if (!ok) return;   // regenerate ya avisó del error
      const list = previews.slice();
      if (list.length !== slides.length) {
        toast(T('La vista previa no está al día. Genérala otra vez antes de descargar.', 'Preview is out of date. Generate it again before downloading.'), 'error');
        return;
      }
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
  // ── EL ESTUDIO: pasos numerados (estructura, no un montón de botones) ────
  const paso = (n, titulo, sub) => el('div', { class: 'carg-paso' }, [
    el('span', { class: 'carg-paso__n', text: n }),
    el('div', {}, [
      el('b', { class: 'carg-paso__t', text: titulo }),
      sub ? el('span', { class: 'carg-paso__s', text: sub }) : null,
    ]),
  ]);
  // Paso 1: la pieza del calendario — los textos entran solos. Los posts
  // cargan ASÍNCRONOS tras cambiar de cliente: si aún no están, la vista se
  // re-pinta sola cuando lleguen (suscripción de una sola vez).
  if (offPosts) { offPosts(); offPosts = null; }
  const piezasCarrusel = (store.getState().posts || [])
    .filter((p) => /carrusel/i.test(p.content_type || '') || /carrusel/i.test(p.title || ''))
    .sort((a, b) => String(a.publish_date || '').localeCompare(String(b.publish_date || '')));
  if (!piezasCarrusel.length) {
    offPosts = store.on('posts:changed', () => {
      if (offPosts) { offPosts(); offPosts = null; }
      if (hostEl) renderGen(hostEl, deps);
    });
  }
  const selPieza = el('select', {
    class: 'input carg-pieza__sel',
    onchange: (e) => {
      const post = piezasCarrusel.find((x) => x.id === e.target.value) || null;
      cargarPieza(post);
    },
  }, [
    el('option', { value: '', text: T('— Elegir pieza (o trabaja libre) —', '— Pick a piece (or free work) —') }),
    ...piezasCarrusel.map((pz) => el('option', {
      value: pz.id, selected: pz.id === piezaId ? 'selected' : undefined,
      text: `${String(pz.publish_date || '').slice(5, 10)} · ${String(pz.title || 'Sin título').slice(0, 52)}`,
    })),
  ]);

  root.append(...[
    paso('1', T('Pieza del calendario', 'Calendar piece'),
      T('Elige la pieza y sus textos, fecha y marca entran solos. También puedes trabajar libre.', 'Pick the piece; texts and date load themselves.')),
    el('div', { class: 'carg-pieza' }, [
      selPieza,
      textosPieza ? el('span', { class: 'carg-pieza__pend', text: T(`${textosPieza.length} textos en espera: entrarán al subir las fotos.`, `${textosPieza.length} texts waiting for photos.`) }) : null,
    ]),

    paso('2', T('Diseño y fotos', 'Design & photos'),
      T('El estilo de la marca se aplica solo. Sube fotos — o cambia una con el botón sobre su miniatura.', 'Brand style auto-applies.')),
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
    // La panorámica estira las fotos sobre una tira de W×nº-de-slides. Con
    // pocas fotos y muchos slides eso recorta el alto sin piedad y la cara que
    // importaba se queda fuera — y mirando las miniaturas no se nota. Se avisa
    // con el número real y con cuántos slides SÍ aguanta ese material.
    avisoPanorama(),

    el('div', { class: 'carg-controls' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        if (slides.length >= MAX_SLIDES) { toast(T(`Ya tienes las ${MAX_SLIDES} fotos del máximo.`, `Already at the ${MAX_SLIDES}-photo max.`), 'error'); return; }
        fileIn.click();
      } }, [icon('camera', 15), ' ' + T(slides.length ? 'Agregar fotos' : 'Elegir fotos', 'Add photos')]),
      fileIn,
      // Rótulo no usa fotos: los slides se agregan vacíos y son pura tipografía.
      // El botón solo aparece con esa plantilla activa para no confundir en las demás.
      plantillaPorId(plantillaId).sinFoto ? el('button', {
        class: 'btn', type: 'button',
        onclick: () => {
          if (slides.length >= MAX_SLIDES) { toast(T(`Máximo ${MAX_SLIDES} slides.`, `Max ${MAX_SLIDES} slides.`), 'error'); return; }
          invalidarIA();
          slides.push({ file: null, bitmap: null, kicker: '', title: '', body: '', pos: 'mid' });
          renderGen(hostEl, deps);
        },
      }, [icon('plus', 15), ' ' + T('Agregar slide (sin foto)', 'Add slide (no photo)')]) : null,
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

    paso('3', T('Dirección', 'Direction'),
      T('Rostros detectados + fotómetro + IA directora. "Dirigir" respeta tus textos al 100%.', 'Faces + photometer + AI director.')),
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
      // El flujo de Vianey: ELLA escribe los textos y la IA solo DIRIGE el
      // diseño (posición por foto + avisos como "esta foto trae brackets").
      // No toca ni una letra suya.
      el('button', {
        class: 'btn carg-ia__go', type: 'button', disabled: pensando || undefined,
        title: T('No cambia tus textos: la IA mira cada foto y acomoda el diseño (posición, avisos).', 'Does not change your texts: the AI directs the design only.'),
        onclick: dirigirConIA,
      }, pensando
        ? [el('span', { class: 'carg-ia__spin' }), ' ' + T('Dirigiendo…', 'Directing…')]
        : [icon('eye', 15), ' ' + T('Dirigir diseño (IA)', 'Direct design (AI)')]),
      el('span', { class: 'carg-ia__note', text: T(
        '"Escribir": la IA cura, ordena y redacta todo. "Dirigir": tus textos quedan intactos y la IA solo acomoda el diseño mirando cada foto.',
        '"Write": AI curates and writes. "Direct": your texts stay; AI only places them by looking at each photo.') }),
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
    slides.length ? paso('4', T('Entrega', 'Delivery'), T('Revísalo al tamaño real (Feed/Perfil) y descarga listo para publicar.', 'Check at real size and download.')) : null,
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
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => regenerate(previewHost).then((ok) => { if (ok) toast(T('Vista previa lista.', 'Preview ready.'), 'success'); }) }, [icon('activity', 15), ' ' + T('Generar vista previa', 'Generate preview')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('jpg') }, [icon('download', 15), ' ' + T('Descargar JPG', 'Download JPG')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('png') }, ['PNG']),
    ]) : null,
    previewHost,
  ].filter(Boolean));

  if (slides.length) regenerate(previewHost);
}
