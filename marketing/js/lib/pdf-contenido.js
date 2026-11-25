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

import { T } from '../shell/i18n.js?v=202611251430';
import { slidesFromPost } from '../editor/slides.js?v=202611251430';
import {
  W, TINTA, HUMO, MX, CONT_W, PIE_TOP, NOTA,
  cargarFuentes, nuevaPagina, exportar, texto, anchoTexto, parrafo, regla,
  cab, pieDePagina, tituloSeccion, botonCanvas, pastilla,
  paginaPortadaBase, paginaCierreAprobado, labelDeMes, armarYDescargar, MESES_ES,
} from './pdf-lienzo.js?v=202611251430';

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
//
// El guion se arma RENGLÓN POR RENGLÓN y fluye de una hoja a la siguiente
// (Vianey, 21-nov-2026, PDF de diciembre de MELISA: "está desordenado"). Antes
// se repartía por secciones completas: un guion de YouTube dejaba el gancho
// solo en una hoja, el desarrollo apretado a 24 px en otra y el cierre solo en
// una tercera; y si el desarrollo no cabía, se recortaba con "…" y perdía
// todos sus saltos de línea. Ahora:
//  - si la pieza cabe en una hoja a 30 o 27 px, va en una hoja (como siempre);
//  - si no, el texto corre a 27 px y pasa a la siguiente hoja donde se acabe
//    el espacio, con "Desarrollo · continúa" arriba; nada se recorta;
//  - un renglón vacío deja aire entre párrafos;
//  - un renglón en MAYÚSCULAS ("FULL BODY", "CALENTAMIENTO · 3 min") es un
//    subtítulo y un renglón entre paréntesis es una nota de producción
//    ("(En pantalla: …)"): se ven distintos del texto que se dice.
const Y_TOP_BASE = 360;
const Y_LIMITE = PIE_TOP - 40;
const ALTO_INSPO = 12 + 32 + 132 + 236;   // rótulo + botón + nota + "DESPUÉS — LEE…"
const ALTO_ETIQUETA = 44;
const AIRE_SECCION = 46;

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

const LETRAS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g;
function esSubtitulo(linea) {
  const t = linea.trim();
  if (!t || t.length > 100) return false;
  const cabeza = t.split(/\s·\s|\s\(|:/)[0];
  const letras = (cabeza.match(LETRAS) || []).join('');
  return letras.length >= 3 && letras === letras.toUpperCase();
}
const esNota = (linea) => /^\(.*\)$/.test(linea.trim());

// Corta un renglón en líneas que caben en `maxW` (sin dibujar).
function envolver(cx, str, o, maxW) {
  const lineas = [];
  let linea = '';
  for (const p of String(str).split(/\s+/).filter(Boolean)) {
    const cand = linea ? `${linea} ${p}` : p;
    if (anchoTexto(cx, cand, o) <= maxW || !linea) linea = cand;
    else { lineas.push(linea); linea = p; }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

// Estilos de cada tipo de renglón (mismo papel de imprenta del lienzo).
const estiloTexto = (sz) => ({ x: MX, size: sz, peso: 300, color: TINTA, esp: 0 });
const ESTILO_ETIQUETA = { x: MX, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO };
const ESTILO_SUBTITULO = { x: MX, size: 22, peso: 700, esp: 0.12, mayus: true, color: TINTA };
const estiloNota = (sz) => ({ x: MX, size: Math.round(sz * 0.8), peso: 400, esp: 0, color: HUMO });

// Las secciones → una lista de renglones con su alto. `seccion` dice a qué
// sección pertenece cada renglón (para el "· continúa" de la hoja nueva).
function renglonesDe(cx, secciones, sz) {
  const lineH = Math.round(sz * 1.62);
  const out = [];
  secciones.forEach((s, i) => {
    if (i > 0) out.push({ k: 'aire', alto: AIRE_SECCION, seccion: s.etiqueta });
    out.push({ k: 'etiqueta', texto: s.etiqueta, alto: ALTO_ETIQUETA, seccion: s.etiqueta });
    let previo = 'etiqueta';
    for (const crudo of String(s.texto).split('\n')) {
      const linea = crudo.trim();
      if (!linea) {
        if (previo !== 'etiqueta' && previo !== 'hueco') out.push({ k: 'hueco', alto: Math.round(sz * 0.55), seccion: s.etiqueta });
        previo = 'hueco';
        continue;
      }
      if (esSubtitulo(linea)) {
        // Puede ocupar dos renglones ("BLOQUE 2 · FUERZA Y ESTABILIDAD · 5 min (…)").
        const arriba = previo === 'etiqueta' ? 0 : 18;
        envolver(cx, linea.toUpperCase(), ESTILO_SUBTITULO, CONT_W).forEach((l, j) => {
          const extra = j === 0 ? arriba : 0;
          out.push({ k: 'subtitulo', texto: l, alto: extra + 32, base: extra + 22, seccion: s.etiqueta });
        });
        out[out.length - 1].alto += 8;
        previo = 'subtitulo';
        continue;
      }
      if (esNota(linea)) {
        const o = estiloNota(sz);
        const lh = Math.round(o.size * 1.5);
        envolver(cx, linea, o, CONT_W).forEach((l, j) => {
          out.push({ k: 'nota', texto: l, alto: lh + (j === 0 ? 6 : 0), base: o.size + (j === 0 ? 6 : 0), seccion: s.etiqueta });
        });
        previo = 'nota';
        continue;
      }
      envolver(cx, linea, estiloTexto(sz), CONT_W).forEach((l) => {
        out.push({ k: 'texto', texto: l, alto: lineH, base: sz, seccion: s.etiqueta });
      });
      previo = 'texto';
    }
  });
  return out;
}

// Acomoda los renglones en hojas. Una etiqueta o un subtítulo nunca se queda
// solo al pie de una hoja: se va con su primer renglón.
function acomodar(renglones, yTop1, yTopN) {
  const paginas = [];
  let pag = []; let y = yTop1;
  renglones.forEach((r, i) => {
    if ((r.k === 'aire' || r.k === 'hueco') && !pag.length) return;
    const sigue = renglones[i + 1];
    const junto = (r.k === 'etiqueta' || r.k === 'subtitulo') && sigue ? sigue.alto : 0;
    if (pag.length && y + r.alto + junto > Y_LIMITE) {
      paginas.push(pag); pag = []; y = yTopN;
      if (r.k === 'aire' || r.k === 'hueco') return;
      if (r.k !== 'etiqueta') { pag.push({ k: 'etiqueta', texto: `${r.seccion} · continúa`, alto: ALTO_ETIQUETA, y }); y += ALTO_ETIQUETA; }
    }
    pag.push({ ...r, y });
    y += r.alto;
  });
  if (pag.length) paginas.push(pag);
  return paginas;
}

function planDe(opts) {
  const conTexto = (opts.secciones || []).filter((s) => s.texto);
  if (!conTexto.length) return { size: 30, paginas: [[]] };
  const { cx } = nuevaPagina();   // lienzo de medición, se descarta
  const yTop1 = yTopDe(cx, opts);
  const yTopN = yTopDe(cx, { tag: opts.tag, inspo: null });
  // Una sola hoja si cabe a 30 o a 27 px; si no, corre a 27 px por varias.
  for (const size of [30, 27]) {
    const paginas = acomodar(renglonesDe(cx, conTexto, size), yTop1, yTopN);
    if (paginas.length === 1) return { size, paginas };
  }
  return { size: 27, paginas: acomodar(renglonesDe(cx, conTexto, 27), yTop1, yTopN) };
}
export function contarPaginasGuion(opts) { return planDe(opts).paginas.length; }

// Dibuja UNA hoja con los renglones que le tocan (ya acomodados).
function dibujarPaginaGuion({ marca, handle, mesLabel, titulo, etiqueta, sub, fecha, renglones, inspo, tag, pendiente, folio, total, size, sigue }) {
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
  }

  if (renglones && renglones.length) {
    const sz = size || 27;
    for (const r of renglones) {
      if (r.k === 'etiqueta') texto(cx, r.texto, { ...ESTILO_ETIQUETA, y: r.y });
      else if (r.k === 'subtitulo') texto(cx, r.texto, { ...ESTILO_SUBTITULO, y: r.y + r.base });
      else if (r.k === 'nota') texto(cx, r.texto, { ...estiloNota(sz), y: r.y + r.base });
      else if (r.k === 'texto') texto(cx, r.texto, { ...estiloTexto(sz), y: r.y + r.base });
    }
    if (sigue) texto(cx, 'Sigue en la siguiente página →', { x: W - MX, y: PIE_TOP - 6, size: 21, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
  } else if (pendiente) {
    // TESTIMONIO sin material: el guion va EN BLANCO a propósito — lo que
    // falta es el VIDEO, y lo manda el cliente. La página lo pide claro.
    const yVacio = Math.max(yTop + 200, 780);
    texto(cx, 'Pendiente de enviar', { x: W / 2, y: yVacio, size: 64, cursiva: true, alinear: 'center' });
    parrafo(cx, pendiente, { x: W / 2, y: yVacio + 86, size: 27, peso: 300, color: 'rgba(23,23,27,.72)', alinear: 'center' }, CONT_W - 60, 46);
  } else {
    const yVacio = inspo ? yTop + ALTO_INSPO + 260 : 760;
    texto(cx, 'Guion en preparación', { x: W / 2, y: yVacio, size: 64, cursiva: true, alinear: 'center' });
    texto(cx, 'Te lo compartimos en cuanto esté escrito.', { ...NOTA, x: W / 2, y: yVacio + 80 });
  }

  pieDePagina(cx, mesLabel, folio, total);
  return { dataUrl: exportar(cv), links };
}

// Una pieza → una o varias hojas (continuaciones con "· continúa" en el
// subtítulo, sin repetir el botón de inspiración). `folio` es el de la primera.
function paginasGuion(opts) {
  const { size, paginas } = planDe(opts);
  return paginas.map((renglones, i) => dibujarPaginaGuion({
    ...opts,
    renglones,
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
export async function generarPdfContenido({ month, piezas, marca, handle, clientId, onPaso }) {
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
  // 6-nov-2026: el MISMO PDF se guarda en el servidor para que el asistente de Israel lo pueda
  // mandar por WhatsApp ("pásame el PDF de contenido de Regeneris"), igual que el de Entregables.
  // Best-effort: la descarga ya ocurrió; si guardar falla, el PDF no se pierde.
  let guardado = false;
  if (clientId) {
    try {
      paso(T('Guardando el PDF para el asistente…', 'Saving the PDF for the assistant…'));
      const r = await fetch(`/api/marketing/contenido/pdf?client_id=${encodeURIComponent(clientId)}&month=${encodeURIComponent(month)}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/pdf' }, body: blob,
      });
      guardado = r.ok;
    } catch { guardado = false; }
  }
  return { paginas: paginas.length, nombre, bytes: blob.size, guardado };
}
