// ============================================================================
// IVAE Marketing — PDF de ENTREGABLES del mes, PENSADO PARA iPHONE (pedido de
// Vianey 2026-08-07: "el pdf es para móvil en iPhone… nada de QR; cada
// carrusel como un post que se desliza, nítido y a tamaño").
//
// v5 canvas-directo: el motor de dibujo vive en pdf-lienzo.js (compartido con
// el PDF de Contenido) — ahí están las lecciones de Safari. Aquí solo quedan
// las páginas propias de Entregables:
//  - CARRUSEL = UN SLIDE POR PÁGINA a casi pantalla completa, con puntitos
//    tipo Instagram: deslizar el PDF ES deslizar el post.
//  - NITIDEZ: slides rebanados a resolución NATIVA de la tira.
//  - Cada video abre SOLO ese video (enlace público firmado); sin material
//    dice "en producción" SIN botón muerto.
// ============================================================================

import { T } from '../shell/i18n.js?v=202608112250';
import {
  W, S, TINTA, HUMO, MX, CONT_W, PIE_TOP, NOTA,
  cargarFuentes, nuevaPagina, exportar, texto, textoRecortado,
  cab, pieDePagina, tituloSeccion, marquito, dibujarCover, botonCanvas,
  paginaPortadaBase, paginaCierreAprobado, labelDeMes, armarYDescargar,
} from './pdf-lienzo.js?v=202608112250';

// ── Cuadro del reel: poster del API o el fotograma MÁS NÍTIDO del video ─────
function nitidez(cx, w, h) {
  const d = cx.getImageData(0, 0, w, h).data;
  let e = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = (y * w + x) * 4;
      const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const gx = (d[i + 4] * 0.3 + d[i + 5] * 0.59 + d[i + 6] * 0.11) - g;
      const gy = (d[i + w * 4] * 0.3 + d[i + w * 4 + 1] * 0.59 + d[i + w * 4 + 2] * 0.11) - g;
      e += gx * gx + gy * gy;
    }
  }
  return e;
}

// Devuelve algo DIBUJABLE (ImageBitmap o canvas) — nada de dataURLs
// intermedios: el drawImage directo conserva la nitidez.
async function imagenDeReel(item) {
  if (item.poster_url) {
    try {
      const r = await fetch(item.poster_url, { credentials: 'include' });
      if (r.ok) return await createImageBitmap(await r.blob());
    } catch { /* cae al fotograma */ }
  }
  if (!item.video_url) return null;
  try {
    const r = await fetch(item.video_url, { credentials: 'include' });
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    try {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.src = url;
      await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error('video')); });
      const dur = v.duration || 2;
      const buscar = (t) => new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1500); v.currentTime = t; });
      const candidatos = dur >= 2.2
        ? [0.12, 0.3, 0.5, 0.7].map((f) => Math.max(1.5, f * dur))
        : [dur / 2];
      const probeW = 240;
      const probeH = Math.max(2, Math.round(probeW * (v.videoHeight || 1920) / (v.videoWidth || 1080)));
      const probe = document.createElement('canvas');
      probe.width = probeW; probe.height = probeH;
      const pcx = probe.getContext('2d', { willReadFrequently: true });
      let mejorT = candidatos[0]; let mejorE = -1;
      for (const t of candidatos) {
        await buscar(t);
        pcx.drawImage(v, 0, 0, probeW, probeH);
        const e = nitidez(pcx, probeW, probeH);
        if (e > mejorE) { mejorE = e; mejorT = t; }
      }
      await buscar(mejorT);
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth || 1080; cv.height = v.videoHeight || 1920;
      cv.getContext('2d').drawImage(v, 0, 0);
      return cv;
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

// ── La tira del carrusel → slides a resolución NATIVA ───────────────────────
// El número de slides se elige probando cada n (1..20): gana el que deje el
// slide más cerca de un formato real de IG; en empate geométrico gana 4:5,
// luego 1:1. (Mismo algoritmo que el visor de entregables.js — cambiarlos
// JUNTOS.)
const RATIOS_IG = [
  { r: 4 / 5, p: 0 }, { r: 1, p: 1 }, { r: 3 / 4, p: 2 }, { r: 9 / 16, p: 3 },
];
function numSlidesDeTira(w, h) {
  let mejor = { d: Infinity, p: 9, n: 1 };
  for (let n = 1; n <= 20; n++) {
    const r = w / (n * h);
    if (r < 0.4) break;
    for (const c of RATIOS_IG) {
      const d = Math.abs(r - c.r);
      const casiEmpate = Math.abs(d - mejor.d) <= 0.015;
      if ((d < mejor.d && !casiEmpate) || (casiEmpate && c.p < mejor.p)) mejor = { d, p: c.p, n };
    }
  }
  return mejor.n;
}

async function slidesDeTira(posterUrl) {
  const r = await fetch(posterUrl, { credentials: 'include' });
  if (!r.ok) throw new Error('tira');
  const bmp = await createImageBitmap(await r.blob());
  const n = numSlidesDeTira(bmp.width, bmp.height);
  const sw = bmp.width / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(sw);
    cv.height = bmp.height;
    // Origen clavado al ancho real: en el ÚLTIMO slide i*sw+sw puede pasarse
    // del borde por flotante y WebKit no dibuja nada (misma trampa que cover).
    const sx = Math.min(i * sw, bmp.width - 1);
    const anchoSrc = Math.min(sw, bmp.width - sx);
    cv.getContext('2d').drawImage(bmp, sx, 0, anchoSrc, bmp.height, 0, 0, cv.width, cv.height);
    out.push(cv);
  }
  return { slides: out, ratio: sw / bmp.height };
}

// ── Páginas propias de Entregables ──────────────────────────────────────────
const REEL = { top: 336, w: 640 };
const REEL_ALTO = Math.round(REEL.w * 16 / 9);          // 1138

function paginaReel({ marca, handle, mesLabel, titulo, sub, imagen, deepLink, enProduccion, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, 'video', sub);
  const fx = (W - REEL.w - 28) / 2;
  const interior = marquito(cx, fx, REEL.top, REEL.w + 28, REEL_ALTO + 28);
  cx.fillStyle = '#EDEAE3';
  cx.fillRect(interior.x, interior.y, interior.w, interior.h);
  if (imagen) {
    dibujarCover(cx, imagen, interior);
  } else {
    texto(cx, 'Este video está en producción —', { x: W / 2, y: REEL.top + REEL_ALTO / 2 - 8, size: 30, peso: 300, color: HUMO, alinear: 'center' });
    texto(cx, 'te lo enviamos en cuanto esté listo.', { x: W / 2, y: REEL.top + REEL_ALTO / 2 + 46, size: 30, peso: 300, color: HUMO, alinear: 'center' });
  }
  const yAcceso = REEL.top + REEL_ALTO + 28 + 56;
  const links = [];
  if (enProduccion) {
    texto(cx, 'EN PRODUCCIÓN', { x: W / 2, y: yAcceso + 40, size: 25, peso: 500, esp: 0.2, alinear: 'center' });
  } else {
    const b = botonCanvas(cx, yAcceso, 'Ver este video', true);
    texto(cx, 'Toca el botón y el video se abre solo.', { ...NOTA, x: W / 2, y: yAcceso + 132 + 52 });
    links.push({ x: b.x, y: b.y - 14, w: b.w, h: b.h + 28, url: deepLink });
    links.push({ x: fx, y: REEL.top, w: REEL.w + 28, h: REEL_ALTO + 28, url: deepLink });
  }
  pieDePagina(cx, mesLabel, folio, total);
  return { dataUrl: exportar(cv), links };
}

// UN SLIDE POR PÁGINA, casi a sangre, con puntitos tipo Instagram: deslizar
// las páginas del PDF = deslizar el carrusel (pedido literal de Vianey).
function paginaSlide({ marca, handle, mesLabel, titulo, sub, slide, ratio, k, n, link, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, 'carrusel', sub);
  const maxW = 1000; const maxH = 1300;
  const w = Math.min(maxW, Math.round(maxH * ratio));
  const h = Math.round(w / ratio);
  const conNota = k === 1 && n > 1;
  const extra = 118 + (conNota ? 50 : 0);
  const zona = PIE_TOP - 336;
  const y0 = 336 + Math.max(0, Math.round((zona - (h + 28 + extra)) / 2));
  const fx = (W - w - 28) / 2;
  const interior = marquito(cx, fx, y0, w + 28, h + 28);
  cx.drawImage(slide, interior.x, interior.y, interior.w, interior.h);
  let y = y0 + h + 28 + 52;
  if (n > 1) {
    const paso = 26; const r = 6.5;
    const x0 = W / 2 - ((n - 1) * paso) / 2;
    for (let i = 1; i <= n; i++) {
      cx.beginPath();
      cx.arc(x0 + (i - 1) * paso, y, r, 0, Math.PI * 2);
      cx.fillStyle = i === k ? TINTA : 'rgba(23,23,27,.22)';
      cx.fill();
    }
    y += 46;
    texto(cx, `SLIDE ${k} DE ${n}`, { x: W / 2, y, size: 21, peso: 500, esp: 0.26, color: HUMO, alinear: 'center' });
    y += 50;
  }
  if (conNota) texto(cx, 'Desliza — así verás el carrusel en Instagram.', { ...NOTA, x: W / 2, y });
  if (n === 1) texto(cx, 'Así se publicará esta imagen — solo revísala.', { ...NOTA, x: W / 2, y: y0 + h + 28 + 56 });
  pieDePagina(cx, mesLabel, folio, total);
  const links = link ? [{ x: fx, y: y0, w: w + 28, h: h + 28, url: link }] : [];
  return { dataUrl: exportar(cv), links };
}

// Sin tira (legado, solo link): botón sólido — sin QR.
function paginaCarruselLink({ marca, handle, mesLabel, titulo, sub, link, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cab(cx, handle, marca);
  tituloSeccion(cx, titulo, 'carrusel', sub);
  const BTN_Y = 900;
  texto(cx, 'Listo para revisar', { x: W / 2, y: BTN_Y - 170, size: 76, cursiva: true, alinear: 'center' });
  const b = botonCanvas(cx, BTN_Y, 'Ver el carrusel', true);
  texto(cx, 'Toca el botón y se abre solo — ahí se ve el carrusel completo.', { ...NOTA, x: W / 2, y: BTN_Y + 132 + 52 });
  texto(cx, 'Si el botón no abre, escribe esto en tu navegador:', { ...NOTA, size: 23, x: W / 2, y: BTN_Y + 132 + 148 });
  const corto = String(link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  textoRecortado(cx, corto, { x: W / 2, y: BTN_Y + 132 + 198, size: 26, peso: 500, esp: 0.08, alinear: 'center' }, CONT_W);
  pieDePagina(cx, mesLabel, folio, total);
  return { dataUrl: exportar(cv), links: [{ x: b.x, y: b.y - 14, w: b.w, h: b.h + 28, url: link }] };
}

/**
 * Genera y descarga el PDF del mes.
 * @param {{month:string, items:Array, marca:string, handle:string, clientId:string, onPaso?:Function}} opts
 */
export async function generarPdfEntregables({ month, items, marca, handle, clientId, onPaso }) {
  const paso = (msg) => { try { onPaso && onPaso(msg); } catch { /* noop */ } };
  await cargarFuentes();
  const mesLabel = labelDeMes(month);
  const reels = items.filter((x) => x.type === 'reel');
  const carruseles = items.filter((x) => x.type !== 'reel');
  const deepLink = `https://ivaestudios.com/marketing/app#/entregables?cliente=${encodeURIComponent(clientId || '')}`;

  paso(T('Leyendo las tiras…', 'Reading the strips…'));
  const tiras = await Promise.all(carruseles.map(async (it) => {
    if (!it.poster_url) return null;
    try { return await slidesDeTira(it.poster_url); } catch { return null; }
  }));
  const total = 2 + reels.length + tiras.reduce((s, t) => s + (t ? t.slides.length : 1), 0);

  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  const resumen = [
    reels.length ? `${reels.length} ${reels.length === 1 ? 'VIDEO' : 'VIDEOS'}` : null,
    carruseles.length ? `${carruseles.length} ${carruseles.length === 1 ? 'CARRUSEL' : 'CARRUSELES'}` : null,
  ].filter(Boolean).join('   ·   ');
  paginas.push(paginaPortadaBase({
    marca, handle, mesLabel, total, resumen,
    tituloCursiva: 'Entregables',
    lineas: ['El contenido de tus redes de este mes,', 'listo para revisar.'],
  }));

  let folio = 1;
  for (let i = 0; i < reels.length; i++) {
    const it = reels[i];
    paso(T(`Video ${i + 1} de ${reels.length}…`, `Video ${i + 1} of ${reels.length}…`));
    const imagen = await imagenDeReel(it);
    const pieza = it.piece || null;
    const linkVideo = it.public_video_url || (it.video_url ? deepLink : null);
    paginas.push(paginaReel({
      marca, handle, mesLabel,
      titulo: `Video ${i + 1}`,
      sub: (pieza && pieza.title) || it.title || '',
      imagen,
      deepLink: linkVideo || deepLink,
      enProduccion: !imagen && !linkVideo,
      folio: ++folio, total,
    }));
  }

  for (let i = 0; i < carruseles.length; i++) {
    const it = carruseles[i];
    paso(T(`Carrusel ${i + 1} de ${carruseles.length}…`, `Carousel ${i + 1} of ${carruseles.length}…`));
    const t = tiras[i];
    const base = { marca, handle, mesLabel, titulo: `Carrusel ${i + 1}`, sub: it.title || '' };
    if (!t) {
      paginas.push(paginaCarruselLink({ ...base, link: it.link || deepLink, folio: ++folio, total }));
      continue;
    }
    const n = t.slides.length;
    for (let k = 1; k <= n; k++) {
      paginas.push(paginaSlide({
        ...base, slide: t.slides[k - 1], ratio: t.ratio, k, n,
        link: it.link || '', folio: ++folio, total,
      }));
    }
  }

  paso(T('Cerrando el documento…', 'Closing the document…'));
  paginas.push(paginaCierreAprobado({
    marca, handle, mesLabel, folio: total, total,
    lineas: ['Ya viste todo el contenido del mes.', '¿Cómo lo dejamos?'],
  }));

  // Telemetría para el laboratorio de jueces (misma filosofía que __cargLayout).
  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  const nombre = `${marca.replace(/\s+/g, '-')}_Entregables_${mesLabel.replace(/\s+/g, '-')}.pdf`;
  const blob = armarYDescargar(paginas, nombre);
  return { paginas: paginas.length, nombre, bytes: blob.size };
}
