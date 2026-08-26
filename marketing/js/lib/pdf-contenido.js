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

import { T } from '../shell/i18n.js?v=202608261245';
import { slidesFromPost } from '../editor/slides.js?v=202608261245';
import {
  W, TINTA, HUMO, MX, CONT_W, PIE_TOP, NOTA,
  cargarFuentes, nuevaPagina, exportar, texto, anchoTexto, parrafo, regla,
  cab, pieDePagina, tituloSeccion, botonCanvas, pastilla,
  paginaPortadaBase, paginaCierreAprobado, labelDeMes, armarYDescargar, MESES_ES,
} from './pdf-lienzo.js?v=202608261245';

// Tipos de pieza que son VIDEO. Los CARRUSELES también entran (pedido
// 2026-08-07 "los carruseles también"): sus textos van POR SLIDE con
// slidesFromPost. Solo foto/post quedan fuera (no llevan guion).
const TIPOS_VIDEO = ['reel', 'tiktok', 'historia', 'informativo', 'pauta', 'tratamientos'];
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
function paginaGuion({ marca, handle, mesLabel, titulo, etiqueta, sub, fecha, secciones, inspo, tag, pendiente, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, etiqueta || 'guion', sub);

  const links = [];
  let yTop = 360;
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
    const lee = etiqueta === 'carrusel' ? 'DESPUÉS — LEE LOS TEXTOS' : 'DESPUÉS — LEE EL GUION';
    texto(cx, lee, { x: MX, y: y0 + 32 + 132 + 158, size: 21, peso: 500, esp: 0.3, color: HUMO });
    yTop = y0 + 32 + 132 + 236;   // aire entre el rótulo del paso y el primer bloque
  }
  const yLimite = PIE_TOP - 40;

  const conTexto = secciones.filter((s) => s.texto);
  const dibujarGuion = (size, medir) => {
    const lineH = Math.round(size * 1.62);
    const o = { x: MX, size, peso: 300, color: TINTA, esp: 0 };
    let y = yTop;
    for (const s of conTexto) {
      if (!medir) texto(cx, s.etiqueta, { x: MX, y, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO });
      y += 44;
      const n = parrafo(cx, s.texto, { ...o, y: y + size }, CONT_W, lineH, medir);
      y += n * lineH + 46;
    }
    return y - 46;
  };

  if (conTexto.length) {
    // Auto-ajuste: 30 → 27 → 24 px; si aun así no cabe, 24px y el final del
    // último bloque se recorta con "…" (jamás encimarse con el pie).
    let size = 30;
    while (size > 24 && dibujarGuion(size, true) > yLimite) size -= 3;
    if (dibujarGuion(size, true) > yLimite) {
      const lineH = Math.round(size * 1.62);
      const maxLineasUlt = () => {
        let y = yTop;
        for (let i = 0; i < conTexto.length - 1; i++) {
          y += 44;
          y += parrafo(cx, conTexto[i].texto, { x: MX, size, peso: 300, y: 0 }, CONT_W, lineH, true) * lineH + 46;
        }
        return Math.max(1, Math.floor((yLimite - y - 44) / lineH));
      };
      const ult = conTexto[conTexto.length - 1];
      const cabe = maxLineasUlt();
      // Recorte por palabras hasta que quepa en `cabe` renglones.
      const palabras = String(ult.texto).split(/\s+/);
      while (palabras.length > 1 && parrafo(cx, palabras.join(' ') + '…', { x: MX, size, peso: 300, y: 0 }, CONT_W, lineH, true) > cabe) {
        palabras.pop();
      }
      ult.texto = palabras.join(' ') + '…';
    }
    dibujarGuion(size, false);
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

/**
 * Genera y descarga el PDF de contenido del mes (videos con guion + inspo).
 * @param {{month:string, piezas:Array, marca:string, handle:string, onPaso?:Function}} opts
 */
export async function generarPdfContenido({ month, piezas, marca, handle, onPaso }) {
  const paso = (msg) => { try { onPaso && onPaso(msg); } catch { /* noop */ } };
  await cargarFuentes();
  const mesLabel = labelDeMes(month);

  // ORDEN: primero todos los VIDEOS, luego los CARRUSELES y al FINAL los
  // TESTIMONIOS (reglas de Vianey 2026-08-07: nada de intercalar por fecha);
  // dentro de cada familia sí manda la fecha de publicación.
  const tipo = (p) => String(p.content_type || '').toLowerCase();
  const esVideo = (p) => TIPOS_VIDEO.includes(tipo(p));
  const esCarrusel = (p) => tipo(p) === 'carrusel';
  const esTestimonio = (p) => TIPOS_TESTIMONIO.includes(tipo(p));
  const familiaDe = (p) => (esTestimonio(p) ? 2 : (esCarrusel(p) ? 1 : 0));
  const plan = (piezas || [])
    .filter((p) => esVideo(p) || esCarrusel(p) || esTestimonio(p))
    .sort((a, b) => (familiaDe(a) - familiaDe(b))
      || String(a.publish_date || '9999').localeCompare(String(b.publish_date || '9999')));
  if (!plan.length) throw new Error(T('Este mes no tiene contenido planeado.', 'This month has no planned content.'));
  const nVideos = plan.filter(esVideo).length;
  const nCarruseles = plan.filter(esCarrusel).length;
  const nTestimonios = plan.filter(esTestimonio).length;

  const total = 2 + plan.length;
  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  const resumen = [
    nVideos ? `${nVideos} ${nVideos === 1 ? 'VIDEO' : 'VIDEOS'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'CARRUSEL' : 'CARRUSELES'}` : null,
    nTestimonios ? `${nTestimonios} ${nTestimonios === 1 ? 'TESTIMONIO' : 'TESTIMONIOS'}` : null,
  ].filter(Boolean).join('   ·   ');
  paginas.push(paginaPortadaBase({
    marca, handle, mesLabel, total, resumen,
    tituloCursiva: 'Contenido',
    lineas: ['El plan de tu contenido de este mes —', 'guiones e inspiración, antes de producir.'],
  }));

  let folio = 1; let iVideo = 0; let iCarrusel = 0; let iTestimonio = 0;
  for (const p of plan) {
    paso(T(`Pieza ${folio} de ${plan.length}…`, `Piece ${folio} of ${plan.length}…`));
    const inspo = String(p.inspo_url || '').trim() || null;
    const fecha = fechaBonita(p.publish_date);
    if (esTestimonio(p)) {
      // TESTIMONIO: el material lo comparte el cliente. TAG visible, guion
      // vacío a propósito y el pedido explícito de enviarlo a IVAE.
      const secciones = [
        { etiqueta: 'Gancho', texto: String(p.hook || '').trim() },
        { etiqueta: 'Desarrollo', texto: String(p.body || '').trim() },
        { etiqueta: 'Cierre', texto: String(p.cta || '').trim() },
      ];
      paginas.push(paginaGuion({
        marca, handle, mesLabel,
        titulo: `Testimonio ${++iTestimonio}`,
        etiqueta: 'testimonio',
        tag: 'Testimonio',
        sub: p.title || '', fecha, secciones, inspo,
        pendiente: 'Compártenos el video del testimonio por WhatsApp y nosotros lo editamos, le ponemos subtítulos y lo publicamos.',
        folio: ++folio, total,
      }));
    } else if (esCarrusel(p)) {
      // Los textos del carrusel van POR SLIDE (slidesFromPost: hook,
      // intermedios del body, cta) — el mismo desglose del editor.
      const slides = slidesFromPost(p).map((s) => String(s || '').trim());
      const secciones = slides.map((s, i) => ({
        etiqueta: i === 0 ? 'Slide 1 · portada' : (i === slides.length - 1 ? `Slide ${slides.length} · cierre` : `Slide ${i + 1}`),
        texto: s,
      }));
      paginas.push(paginaGuion({
        marca, handle, mesLabel,
        titulo: `Carrusel ${++iCarrusel}`,
        etiqueta: 'carrusel',
        sub: p.title || '', fecha, secciones, inspo,
        folio: ++folio, total,
      }));
    } else {
      paginas.push(paginaGuion({
        marca, handle, mesLabel,
        titulo: `Video ${++iVideo}`,
        etiqueta: 'guion',
        sub: p.title || '', fecha,
        secciones: [
          { etiqueta: 'Gancho', texto: String(p.hook || '').trim() },
          { etiqueta: 'Desarrollo', texto: String(p.body || '').trim() },
          { etiqueta: 'Cierre', texto: String(p.cta || '').trim() },
        ],
        inspo,
        folio: ++folio, total,
      }));
    }
  }

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
