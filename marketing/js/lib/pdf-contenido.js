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

import { T } from '../shell/i18n.js?v=202608070939';
import {
  W, TINTA, HUMO, MX, CONT_W, PIE_TOP, NOTA,
  cargarFuentes, nuevaPagina, exportar, texto, anchoTexto, parrafo, regla,
  cab, pieDePagina, tituloSeccion, botonCanvas,
  paginaPortadaBase, paginaCierreAprobado, labelDeMes, armarYDescargar, MESES_ES,
} from './pdf-lienzo.js?v=202608070939';

// Tipos de pieza que son VIDEO (los estáticos —carrusel/foto/post— no llevan
// guion y viven en el PDF de Entregables).
const TIPOS_VIDEO = ['reel', 'tiktok', 'historia', 'experiencia', 'informativo', 'pauta', 'tratamientos'];

function fechaBonita(publishDate) {
  const m = String(publishDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mes = (MESES_ES[parseInt(m[2], 10) - 1] || '').slice(0, 3).toUpperCase();
  return `SE PUBLICA · ${parseInt(m[3], 10)} ${mes}`;
}

// ── Página de un video: guion por secciones + botón de inspiración ──────────
function paginaGuion({ marca, handle, mesLabel, titulo, sub, fecha, secciones, inspo, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, 'guion', sub);

  const yTop = 360;
  // Zona de texto: si hay inspiración, el bloque botón+nota vive abajo fijo.
  const BTN_Y = 1560;
  const yLimite = inspo ? BTN_Y - 60 : PIE_TOP - 40;

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
    // último bloque se recorta con "…" (jamás encimarse con botón o pie).
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
  } else {
    texto(cx, 'Guion en preparación', { x: W / 2, y: 760, size: 64, cursiva: true, alinear: 'center' });
    texto(cx, 'Te lo compartimos en cuanto esté escrito.', { ...NOTA, x: W / 2, y: 840 });
  }

  // La fecha va arriba a la derecha del guion, discreta.
  if (fecha) texto(cx, fecha, { x: W - MX, y: yTop, size: 21, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });

  const links = [];
  if (inspo) {
    regla(cx, W / 2, CONT_W, BTN_Y - 64);
    const b = botonCanvas(cx, BTN_Y, 'Ver la inspiración', true);
    texto(cx, 'Toca el botón: es el video de referencia para este contenido.', { ...NOTA, x: W / 2, y: BTN_Y + 132 + 50 });
    links.push({ x: b.x, y: b.y - 14, w: b.w, h: b.h + 28, url: inspo });
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

  // Videos del mes, en el orden del calendario (fecha, luego posición).
  const videos = (piezas || [])
    .filter((p) => TIPOS_VIDEO.includes(String(p.content_type || '').toLowerCase()))
    .sort((a, b) => String(a.publish_date || '9999').localeCompare(String(b.publish_date || '9999')));
  if (!videos.length) throw new Error(T('Este mes no tiene videos planeados.', 'This month has no planned videos.'));

  const total = 2 + videos.length;
  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  paginas.push(paginaPortadaBase({
    marca, handle, mesLabel, total,
    tituloCursiva: 'Contenido',
    resumen: `${videos.length} ${videos.length === 1 ? 'VIDEO' : 'VIDEOS'}`,
    lineas: ['El plan de tus videos de este mes —', 'su guion y su inspiración, antes de grabar.'],
  }));

  let folio = 1;
  for (let i = 0; i < videos.length; i++) {
    const p = videos[i];
    paso(T(`Video ${i + 1} de ${videos.length}…`, `Video ${i + 1} of ${videos.length}…`));
    paginas.push(paginaGuion({
      marca, handle, mesLabel,
      titulo: `Video ${i + 1}`,
      sub: p.title || '',
      fecha: fechaBonita(p.publish_date),
      secciones: [
        { etiqueta: 'Gancho', texto: String(p.hook || '').trim() },
        { etiqueta: 'Desarrollo', texto: String(p.body || '').trim() },
        { etiqueta: 'Cierre', texto: String(p.cta || '').trim() },
      ],
      inspo: String(p.inspo_url || '').trim() || null,
      folio: ++folio, total,
    }));
  }

  paso(T('Cerrando el documento…', 'Closing the document…'));
  paginas.push(paginaCierreAprobado({
    marca, handle, mesLabel, folio: total, total,
    lineas: ['Ya viste el plan del mes.', '¿Grabamos así?'],
  }));

  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  const nombre = `${marca.replace(/\s+/g, '-')}_Contenido_${mesLabel.replace(/\s+/g, '-')}.pdf`;
  const blob = armarYDescargar(paginas, nombre);
  return { paginas: paginas.length, nombre, bytes: blob.size };
}
