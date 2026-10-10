// ============================================================================
// IVAE Marketing — PDF de CONTENIDO del mes (pedido de Vianey 2026-08-07:
// "uno para ellos igual pero para el contenido, por video con el guion y el
// link de inspo para que vean").
//
// Es el hermano PRE-PRODUCCIÓN del PDF de Entregables: mismo lenguaje móvil
// 9:16 de pdf-lienzo.js (canvas 2D, botones sólidos tocables, cero QR).
// Una página por VIDEO planeado del calendario con:
//  - el GUION en secciones (gancho / desarrollo / cierre), con auto-ajuste
//    de tamaño para que quepa completo;
//  - botón "Ver la inspiración" → inspo_url (solo si existe: sin botones
//    muertos);
//  - la fecha en que se publica.
// Cierra con el mismo camino feliz «Aprobado» por WhatsApp.
// ============================================================================

import { T } from '../shell/i18n.js?v=202610101800';
import { slidesFromPost } from '../editor/slides.js?v=202610101800';
import {
  W, TINTA, HUMO, MX, CONT_W, PIE_TOP, NOTA,
  cargarFuentes, nuevaPagina, exportar, texto, anchoTexto, parrafo, regla,
  cab, pieDePagina, tituloSeccion, botonCanvas, pastilla,
  paginaPortadaBase, paginaCierreAprobado, labelDeMes, armarYDescargar, MESES_ES,
} from './pdf-lienzo.js?v=202610101800';

// Tipos de pieza que son VIDEO. Los CARRUSELES también entran (pedido
// 2026-08-07 "los carruseles también"): sus textos van POR SLIDE con
// slidesFromPost. Los POSTS de imagen entran desde 2026-10-06 (Israel:
// "no descarga los posts, solo los carruseles"): llevan gancho, la
// descripción de la imagen con sus textos, y el cierre.
const TIPOS_VIDEO = ['reel', 'tiktok', 'historia', 'informativo', 'pauta', 'tratamientos'];
const TIPOS_POST = ['post', 'foto'];
// Los TESTIMONIOS (tipo "Experiencia/Testimonial") son su propia familia:
// llevan TAG visible y van SIEMPRE al final del documento — el material lo
// comparte el cliente, no lo produce el estudio (pedido 2026-08-07).
const TIPOS_TESTIMONIO = ['experiencia'];

function fechaBonita(publishDate) {
  const m = String(publishDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mes = (MESES_ES[parseInt(m[2], 10) - 1] || '').slice(0, 3).toUpperCase();
  return `SE PUBLICA · ${parseInt(m[3], 10)} ${mes}`;
}

// ── Página de una pieza: PRIMERO la inspiración, DESPUÉS el guion ───────────
// (Pedido de Vianey: "primero ve el video de inspiración y luego ve el
// guion — sube el link de la inspo primero".)
// Si el guion no cabe ni a 24px (carruseles de 8 slides, guiones largos), la
// pieza CONTINÚA en la página siguiente en vez de salirse de la hoja (Israel,
// 2026-10-06: "el carrusel 1 sale de la hoja del pdf"). Para eso el folio y
// el total se calculan ANTES de dibujar (contarPaginasGuion).
const Y_TOP_BASE = 360;
const Y_LIMITE = PIE_TOP - 40;
const ALTO_INSPO = 12 + 32 + 132 + 236;   // rótulo + botón + nota + "DESPUÉS — LEE…"

// Dónde arranca el primer bloque de texto según lleve TAG y/o inspo.
function yTopDe(cx, { tag, inspo }) {
  let yTop = Y_TOP_BASE;
  if (tag) {
    const p = pastilla(cx, MX, 340, tag);
    yTop = 340 + p.h + 54;
  }
  if (inspo) yTop += ALTO_INSPO;
  return yTop;
}
function altoSeccion(cx, s, size) {
  const lineH = Math.round(size * 1.62);
  const n = parrafo(cx, s.texto, { x: MX, size, peso: 300, y: 0 }, CONT_W, lineH, true);
  return 44 + n * lineH + 46;
}
// Reparte las secciones en páginas. Primero intenta UNA página con auto-ajuste
// 30 → 27 → 24 px; si ni a 24 cabe, parte a 24 px: la primera página arranca
// en yTop1 (con inspo y tag) y las siguientes en yTopN.
function repartir(cx, secciones, yTop1, yTopN) {
  for (const size of [30, 27, 24]) {
    const alto = secciones.reduce((a, s) => a + altoSeccion(cx, s, size), 0) - 46;
    if (yTop1 + alto <= Y_LIMITE) return { size, paginas: [secciones] };
  }
  const size = 24;
  const paginas = []; let actual = []; let y = yTop1;
  for (const s of secciones) {
    const alto = altoSeccion(cx, s, size);
    if (actual.length && y + alto - 46 > Y_LIMITE) { paginas.push(actual); actual = []; y = yTopN; }
    actual.push(s); y += alto;
  }
  if (actual.length) paginas.push(actual);
  return { size, paginas };
}
function planDe(opts) {
  const conTexto = (opts.secciones || []).filter((s) => s.texto);
  if (!conTexto.length) return { size: 30, paginas: [[]] };
  const { cx } = nuevaPagina();   // lienzo de medición, se descarta
  const yTop1 = yTopDe(cx, opts);
  const yTopN = yTopDe(cx, { tag: opts.tag, inspo: null });
  return repartir(cx, conTexto, yTop1, yTopN);
}
export function contarPaginasGuion(opts) { return planDe(opts).paginas.length; }

// Dibuja UNA página con las secciones que le tocan (ya repartidas).
function dibujarPaginaGuion({ marca, handle, mesLabel, titulo, etiqueta, sub, fecha, secciones, inspo, tag, pendiente, folio, total, size, sigue }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, etiqueta || 'guion', sub);

  const links = [];
  let yTop = Y_TOP_BASE;
  // TAG de la pieza (p.ej. TESTIMONIO): pastilla sólida bajo el filete.
  if (tag) {
    const p = pastilla(cx, MX, 340, tag);
    yTop = 340 + p.h + 54;
  }
  // La fecha va a la derecha del primer renglón útil, discreta.
  if (fecha) texto(cx, fecha, { x: W - MX, y: tag ? 372 : (inspo ? 372 : 360), size: 21, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });

  if (inspo) {
    const y0 = yTop + 12;
    texto(cx, 'PRIMERO — VE LA INSPIRACIÓN', { x: MX, y: y0, size: 21, peso: 500, esp: 0.3, color: HUMO });
    const b = botonCanvas(cx, y0 + 32, 'Ver la inspiración', true);
    texto(cx, 'Toca el botón: es el video de referencia de esta pieza.', { ...NOTA, size: 24, x: W / 2, y: y0 + 32 + 132 + 46 });
    links.push({ x: b.x, y: b.y - 14, w: b.w, h: b.h + 28, url: inspo });
    regla(cx, W / 2, CONT_W, y0 + 32 + 132 + 96);
    const lee = (etiqueta === 'carrusel' || etiqueta === 'post') ? 'DESPUÉS — LEE LOS TEXTOS' : 'DESPUÉS — LEE EL GUION';
    texto(cx, lee, { x: MX, y: y0 + 32 + 132 + 158, size: 21, peso: 500, esp: 0.3, color: HUMO });
    yTop = y0 + ALTO_INSPO - 12;   // aire entre el rótulo del paso y el primer bloque
  }
  const yLimite = Y_LIMITE;

  const conTexto = (secciones || []).filter((s) => s.texto);
  const dibujarGuion = (sz, medir) => {
    const lineH = Math.round(sz * 1.62);
    const o = { x: MX, size: sz, peso: 300, color: TINTA, esp: 0 };
    let y = yTop;
    for (const s of conTexto) {
      if (!medir) texto(cx, s.etiqueta, { x: MX, y, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO });
      y += 44;
      const n = parrafo(cx, s.texto, { ...o, y: y + sz }, CONT_W, lineH, medir);
      y += n * lineH + 46;
    }
    return y - 46;
  };

  if (conTexto.length) {
    const sz = size || 24;
    if (dibujarGuion(sz, true) > yLimite) {
      // Un solo bloque más largo que la hoja: se recorta el final con "…"
      // (jamás encimarse con el pie).
      const lineH = Math.round(sz * 1.62);
      const maxLineasUlt = () => {
        let y = yTop;
        for (let i = 0; i < conTexto.length - 1; i++) {
          y += 44;
          y += parrafo(cx, conTexto[i].texto, { x: MX, size: sz, peso: 300, y: 0 }, CONT_W, lineH, true) * lineH + 46;
        }
        return Math.max(1, Math.floor((yLimite - y - 44) / lineH));
      };
      const ult = conTexto[conTexto.length - 1];
      const cabe = maxLineasUlt();
      const palabras = String(ult.texto).split(/\s+/);
      while (palabras.length > 1 && parrafo(cx, palabras.join(' ') + '…', { x: MX, size: sz, peso: 300, y: 0 }, CONT_W, lineH, true) > cabe) {
        palabras.pop();
      }
      ult.texto = palabras.join(' ') + '…';
    }
    dibujarGuion(sz, false);
    if (sigue) texto(cx, 'Sigue en la siguiente página →', { x: W - MX, y: PIE_TOP - 6, size: 21, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
  } else if (pendiente) {
    // TESTIMONIO sin material: el guion va EN BLANCO a propósito — lo que
    // falta es el VIDEO, y lo manda el cliente. La página lo pide claro.
    const yVacio = Math.max(yTop + 200, 780);
    texto(cx, 'Pendiente de enviar', { x: W / 2, y: yVacio, size: 64, cursiva: true, alinear: 'center' });
    parrafo(cx, pendiente, { x: W / 2, y: yVacio + 86, size: 27, peso: 300, color: 'rgba(23,23,27,.72)', alinear: 'center' }, CONT_W - 60, 46);
  } else {
    const yVacio = inspo ? yTop + 260 : 760;
    texto(cx, 'Guion en preparación', { x: W / 2, y: yVacio, size: 64, cursiva: true, alinear: 'center' });
    texto(cx, 'Te lo compartimos en cuanto esté escrito.', { ...NOTA, x: W / 2, y: yVacio + 80 });
  }

  pieDePagina(cx, mesLabel, folio, total);
  return { dataUrl: exportar(cv), links };
}

// Una pieza → una o varias páginas (continuaciones con "· continúa" en el
// subtítulo, sin repetir el botón de inspiración). `folio` es el de la primera.
function paginasGuion(opts) {
  const { size, paginas } = planDe(opts);
  return paginas.map((secs, i) => dibujarPaginaGuion({
    ...opts,
    secciones: secs,
    size,
    inspo: i === 0 ? opts.inspo : null,
    sub: i === 0 ? opts.sub : `${opts.sub ? `${opts.sub} · ` : ''}continúa`,
    sigue: i < paginas.length - 1,
    folio: opts.folio + i,
  }));
}

/**
 * Genera y descarga el PDF de contenido del mes (videos con guion + inspo).
 * @param {{month:string, piezas:Array, marca:string, handle:string, onPaso?:Function}} opts
 */
export async function generarPdfContenido({ month, piezas, marca, handle, onPaso }) {
  const paso = (msg) => { try { onPaso && onPaso(msg); } catch { /* noop */ } };
  await cargarFuentes();
  const mesLabel = labelDeMes(month);

  // ORDEN: primero todos los VIDEOS, luego los CARRUSELES, luego los POSTS y
  // al FINAL los TESTIMONIOS (reglas de Vianey 2026-08-07: nada de intercalar
  // por fecha); dentro de cada familia sí manda la fecha de publicación.
  const tipo = (p) => String(p.content_type || '').toLowerCase();
  const esVideo = (p) => TIPOS_VIDEO.includes(tipo(p));
  const esCarrusel = (p) => tipo(p) === 'carrusel';
  const esPost = (p) => TIPOS_POST.includes(tipo(p));
  const esTestimonio = (p) => TIPOS_TESTIMONIO.includes(tipo(p));
  const familiaDe = (p) => (esTestimonio(p) ? 3 : (esPost(p) ? 2 : (esCarrusel(p) ? 1 : 0)));
  const plan = (piezas || [])
    .filter((p) => esVideo(p) || esCarrusel(p) || esPost(p) || esTestimonio(p))
    .sort((a, b) => (familiaDe(a) - familiaDe(b))
      || String(a.publish_date || '9999').localeCompare(String(b.publish_date || '9999')));
  if (!plan.length) throw new Error(T('Este mes no tiene contenido planeado.', 'This month has no planned content.'));
  const nVideos = plan.filter(esVideo).length;
  const nCarruseles = plan.filter(esCarrusel).length;
  const nPosts = plan.filter(esPost).length;
  const nTestimonios = plan.filter(esTestimonio).length;

  // 1) Qué lleva cada página (sin folio todavía).
  let iVideo = 0; let iCarrusel = 0; let iPost = 0; let iTestimonio = 0;
  const base = (p) => ({ marca, handle, mesLabel, sub: p.title || '', fecha: fechaBonita(p.publish_date), inspo: String(p.inspo_url || '').trim() || null });
  const ghc = (p) => ([
    { etiqueta: 'Gancho', texto: String(p.hook || '').trim() },
    { etiqueta: 'Desarrollo', texto: String(p.body || '').trim() },
    { etiqueta: 'Cierre', texto: String(p.cta || '').trim() },
  ]);
  const items = plan.map((p) => {
    if (esTestimonio(p)) {
      // TESTIMONIO: el material lo comparte el cliente. TAG visible, guion
      // vacío a propósito y el pedido explícito de enviarlo a IVAE.
      return { ...base(p), titulo: `Testimonio ${++iTestimonio}`, etiqueta: 'testimonio', tag: 'Testimonio', secciones: ghc(p),
        pendiente: 'Compártenos el video del testimonio por WhatsApp y nosotros lo editamos, le ponemos subtítulos y lo publicamos.' };
    }
    if (esCarrusel(p)) {
      // Los textos del carrusel van POR SLIDE (slidesFromPost: hook,
      // intermedios del body, cta) — el mismo desglose del editor.
      const slides = slidesFromPost(p).map((s) => String(s || '').trim());
      const secciones = slides.map((s, i) => ({
        etiqueta: i === 0 ? 'Slide 1 · portada' : (i === slides.length - 1 ? `Slide ${slides.length} · cierre` : `Slide ${i + 1}`),
        texto: s,
      }));
      return { ...base(p), titulo: `Carrusel ${++iCarrusel}`, etiqueta: 'carrusel', secciones };
    }
    if (esPost(p)) {
      // POST de imagen: gancho, la imagen con sus textos (van en body) y cierre.
      return { ...base(p), titulo: `Post ${++iPost}`, etiqueta: 'post', secciones: [
        { etiqueta: 'Gancho', texto: String(p.hook || '').trim() },
        { etiqueta: 'Imagen y textos', texto: String(p.body || '').trim() },
        { etiqueta: 'Cierre', texto: String(p.cta || '').trim() },
      ] };
    }
    return { ...base(p), titulo: `Video ${++iVideo}`, etiqueta: 'guion', secciones: ghc(p) };
  });

  // 2) Cuántas páginas ocupa cada pieza → folio y total correctos.
  const cuentas = items.map((it) => contarPaginasGuion(it));
  const total = 2 + cuentas.reduce((a, n) => a + n, 0);

  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  const resumen = [
    nVideos ? `${nVideos} ${nVideos === 1 ? 'VIDEO' : 'VIDEOS'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'CARRUSEL' : 'CARRUSELES'}` : null,
    nPosts ? `${nPosts} ${nPosts === 1 ? 'POST' : 'POSTS'}` : null,
    nTestimonios ? `${nTestimonios} ${nTestimonios === 1 ? 'TESTIMONIO' : 'TESTIMONIOS'}` : null,
  ].filter(Boolean).join('   ·   ');
  paginas.push(paginaPortadaBase({
    marca, handle, mesLabel, total, resumen,
    tituloCursiva: 'Contenido',
    lineas: ['El plan de tu contenido de este mes —', 'guiones e inspiración, antes de producir.'],
  }));

  // 3) Dibujar.
  let folio = 1;
  items.forEach((it, i) => {
    paso(T(`Pieza ${i + 1} de ${items.length}…`, `Piece ${i + 1} of ${items.length}…`));
    const pags = paginasGuion({ ...it, folio: folio + 1, total });
    paginas.push(...pags);
    folio += pags.length;
  });

  paso(T('Cerrando el documento…', 'Closing the document…'));
  // Los testimonios que siguen sin material se recuerdan en el cierre: es lo
  // ÚNICO que el documento le pide al cliente.
  const faltan = plan.filter((p) => esTestimonio(p) && !String(p.hook || p.body || p.cta || '').trim()).length;
  paginas.push(paginaCierreAprobado({
    marca, handle, mesLabel, folio: total, total,
    lineas: faltan
      ? ['Ya viste el plan del mes.', '¿Grabamos así?', '',
        `Pendiente: envíanos ${faltan === 1 ? 'un testimonio' : `${faltan} testimonios`} en video.`]
      : ['Ya viste el plan del mes.', '¿Grabamos así?'],
  }));

  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  const nombre = `${marca.replace(/\s+/g, '-')}_Contenido_${mesLabel.replace(/\s+/g, '-')}.pdf`;
  const blob = armarYDescargar(paginas, nombre);
  return { paginas: paginas.length, nombre, bytes: blob.size };
}
