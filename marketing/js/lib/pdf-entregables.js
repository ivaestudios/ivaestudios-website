// ============================================================================
// IVAE Marketing — PDF de ENTREGABLES del mes, PENSADO PARA iPHONE (pedido de
// Vianey 2026-08-07: "el pdf es para móvil en iPhone… nada de QR; cada
// carrusel como un post que se desliza, nítido y a tamaño").
//
// v5 canvas-directo (la lección de Safari):
//  - TODO se dibuja con canvas 2D — cero foreignObject. El raster v4
//    (HTML→SVG→canvas) se veía perfecto en Chrome pero SAFARI NO PINTA las
//    <img> ni las @font-face dentro de un SVG-como-imagen: Vianey generó el
//    PDF en su Mac y todos los slides y reels salieron CUADROS BLANCOS.
//    Canvas 2D + FontFace API funcionan igual en todos los navegadores.
//  - CARRUSEL = UN SLIDE POR PÁGINA a casi pantalla completa, con puntitos
//    tipo Instagram: deslizar el PDF ES deslizar el post. Sin cuadrículas.
//  - NITIDEZ: los slides se rebanan a resolución NATIVA de la tira (sin
//    techo de 1000px) y las páginas se rasterizan a 1.5× (1620×2880).
//  - Páginas 9:16, cero QR, botones sólidos tocables (anotaciones /Link).
//  - Cada video abre SOLO ese video (enlace público firmado); sin material
//    dice "en producción" SIN botón muerto.
//  - Cierre: «Responder Aprobado» primario con texto precargado.
//
// Voz visual: papel de imprenta, Raleway 300 caps espaciado + Cormorant
// cursiva (SMILE NOW).
// ============================================================================

import { T } from '../shell/i18n.js?v=202608070903';
import { pdfDesdeJpegs } from './pdf-jpeg.js?v=202608070903';

// Espacio de diseño 1080×1920; el canvas real va a 1.5× para Retina.
const W = 1080;
const H = 1920;
const S = 1.5;                 // escala de raster (nitidez en iPhone)
// Página PDF en pt (misma proporción; los visores ajustan al ancho).
const PT_W = 540;
const PT_H = 960;

// Paleta de imprenta.
const PAPEL = '#F5F2EC';
const TINTA = '#17171B';
const HUMO = '#6E6A62';
const FILETE = 'rgba(23,23,27,.16)';

const MX = 64;                 // margen lateral
const CONT_W = W - MX * 2;     // 952: los botones lo llenan
const PIE_TOP = 1826;          // nada útil debajo de esta línea

// ── Fuentes por FontFace API (el canvas 2D SÍ las usa en Safari) ────────────
let fuentesListas = null;
function cargarFuentes() {
  if (fuentesListas) return fuentesListas;
  fuentesListas = (async () => {
    const alta = async (fam, path, opts) => {
      const f = new FontFace(fam, `url(${path})`, opts);
      await f.load();
      document.fonts.add(f);
    };
    await Promise.all([
      alta('RalewayPDF', '/marketing/fonts/raleway-latin-var.woff2', { weight: '100 900' }),
      alta('CormorantPDF', '/marketing/fonts/cormorant-roman.woff2', { weight: '300 700' }),
      alta('CormorantPDF', '/marketing/fonts/cormorant-italic.woff2', { weight: '300 700', style: 'italic' }),
    ]);
  })();
  return fuentesListas;
}

// ── Lienzo de página ────────────────────────────────────────────────────────
function nuevaPagina() {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * S);
  cv.height = Math.round(H * S);
  const cx = cv.getContext('2d');
  cx.scale(S, S);
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.fillStyle = PAPEL;
  cx.fillRect(0, 0, W, H);
  cx.textBaseline = 'alphabetic';
  return { cv, cx };
}
const exportar = (cv) => cv.toDataURL('image/jpeg', 0.9);

// ── Texto con espaciado de imprenta (letra por letra, idéntico en Safari) ───
// opts: x, y, size, peso, esp (em), mayus, color, alinear, cursiva, pesoCursiva
function fuenteDe(o) {
  const fam = o.cursiva ? 'CormorantPDF' : 'RalewayPDF';
  const estilo = o.cursiva ? 'italic ' : '';
  const peso = o.peso || (o.cursiva ? 600 : 300);
  return `${estilo}${peso} ${o.size}px ${fam}, ${o.cursiva ? 'Georgia, serif' : 'sans-serif'}`;
}
function anchoTexto(cx, s, o) {
  cx.font = fuenteDe(o);
  const esp = (o.esp || 0) * o.size;
  if (!esp) return cx.measureText(s).width;
  let w = 0;
  for (const ch of s) w += cx.measureText(ch).width + esp;
  return s.length ? w - esp : 0;
}
function texto(cx, str, o) {
  const s = o.mayus ? String(str).toUpperCase() : String(str);
  cx.font = fuenteDe(o);
  cx.fillStyle = o.color || TINTA;
  const esp = (o.esp || 0) * o.size;
  const w = anchoTexto(cx, s, o);
  let x = o.x;
  if (o.alinear === 'center') x = o.x - w / 2;
  else if (o.alinear === 'right') x = o.x - w;
  if (!esp) {
    cx.fillText(s, x, o.y);
  } else {
    let cur = x;
    for (const ch of s) {
      cx.fillText(ch, cur, o.y);
      cur += cx.measureText(ch).width + esp;
    }
  }
  return w;
}
// Una línea con puntos suspensivos si no cabe.
function textoRecortado(cx, str, o, maxW) {
  let s = o.mayus ? String(str).toUpperCase() : String(str);
  if (anchoTexto(cx, s, o) <= maxW) return texto(cx, s, { ...o, mayus: false });
  while (s.length > 1 && anchoTexto(cx, s + '…', o) > maxW) s = s.slice(0, -1);
  return texto(cx, s.trimEnd() + '…', { ...o, mayus: false });
}
// Párrafo centrado con word-wrap real.
function parrafo(cx, str, o, maxW, lineH) {
  const palabras = String(str).split(/\s+/);
  const lineas = [];
  let linea = '';
  for (const p of palabras) {
    const cand = linea ? linea + ' ' + p : p;
    if (anchoTexto(cx, cand, o) <= maxW || !linea) linea = cand;
    else { lineas.push(linea); linea = p; }
  }
  if (linea) lineas.push(linea);
  lineas.forEach((l, i) => texto(cx, l, { ...o, y: o.y + i * lineH }));
  return lineas.length;
}
function regla(cx, xCentro, w, y) {
  cx.fillStyle = FILETE;
  cx.fillRect(xCentro - w / 2, y, w, 1.6);
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function cab(cx, izq, der) {
  texto(cx, izq, { x: MX, y: 100, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO });
  if (der) texto(cx, der, { x: W - MX, y: 100, size: 22, peso: 300, esp: 0.42, mayus: true, color: HUMO, alinear: 'right' });
}
function pieDePagina(cx, mesLabel, folio, total) {
  texto(cx, mesLabel, { x: MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, mayus: true, color: HUMO });
  texto(cx, `${folio} / ${total}`, { x: W - MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
}
function tituloSeccion(cx, titulo, etiqueta, sub) {
  texto(cx, titulo, { x: MX, y: 214, size: 46, peso: 300, esp: 0.16, mayus: true });
  texto(cx, etiqueta, { x: W - MX, y: 212, size: 42, cursiva: true, color: 'rgba(23,23,27,.8)', alinear: 'right' });
  if (sub) textoRecortado(cx, sub, { x: MX, y: 272, size: 33, cursiva: true, color: HUMO }, CONT_W);
  regla(cx, W / 2, CONT_W, sub ? 302 : 258);
}
// Marco blanco con sombra; devuelve el rect interior donde va la imagen.
function marquito(cx, x, y, w, h, pad) {
  const p = pad == null ? 14 : pad;
  cx.save();
  cx.shadowColor = 'rgba(23,23,27,.16)';
  cx.shadowBlur = 54 * S;
  cx.shadowOffsetY = 24 * S;
  cx.fillStyle = '#FFFFFF';
  cx.fillRect(x, y, w, h);
  cx.restore();
  cx.strokeStyle = FILETE;
  cx.lineWidth = 1;
  cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  return { x: x + p, y: y + p, w: w - p * 2, h: h - p * 2 };
}
// Imagen a cubrir (cover) dentro de un rect — recorte centrado.
// ⚠️ El rect de ORIGEN va CLAVADO a los límites de la imagen: por punto
// flotante r.h/k puede dar 1920.00000000006 y con el origen fuera de rango
// WebKit/Safari no dibuja NADA (Chrome recorta en silencio) — era el póster
// en blanco del PDF de Vianey.
function dibujarCover(cx, img, r) {
  const iw = img.width || img.videoWidth || 1;
  const ih = img.height || img.videoHeight || 1;
  const k = Math.max(r.w / iw, r.h / ih);
  const sw = Math.min(iw, r.w / k);
  const sh = Math.min(ih, r.h / k);
  const sx = Math.min(iw - sw, Math.max(0, (iw - sw) / 2));
  const sy = Math.min(ih - sh, Math.max(0, (ih - sh) / 2));
  cx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
}
function botonCanvas(cx, y, label, relleno) {
  const h = 132;
  if (relleno) { cx.fillStyle = TINTA; cx.fillRect(MX, y, CONT_W, h); }
  cx.strokeStyle = TINTA;
  cx.lineWidth = 2.4;
  cx.strokeRect(MX + 1.2, y + 1.2, CONT_W - 2.4, h - 2.4);
  texto(cx, label, {
    x: W / 2, y: y + h / 2 + 11, size: 30, peso: 500, esp: 0.24, mayus: true,
    alinear: 'center', color: relleno ? PAPEL : TINTA,
  });
  return { x: MX, y, w: CONT_W, h };
}
const NOTA = { size: 27, peso: 300, esp: 0, color: 'rgba(23,23,27,.72)', alinear: 'center' };

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

// ── Páginas ─────────────────────────────────────────────────────────────────
function paginaPortada({ marca, handle, mesLabel, nReels, nCarruseles, total }) {
  const { cv, cx } = nuevaPagina();
  cx.strokeStyle = FILETE;
  cx.lineWidth = 1.6;
  cx.strokeRect(44, 44, W - 88, H - 88);
  cab(cx, handle, '');
  const resumen = [
    nReels ? `${nReels} ${nReels === 1 ? 'VIDEO' : 'VIDEOS'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'CARRUSEL' : 'CARRUSELES'}` : null,
  ].filter(Boolean).join('   ·   ');
  let y = Math.round(H * 0.27) + 40;
  texto(cx, marca, { x: W / 2, y, size: 58, peso: 300, esp: 0.42, mayus: true, alinear: 'center' });
  regla(cx, W / 2, 180, y + 62);
  y += 128 + 100;
  texto(cx, 'Entregables', { x: W / 2, y, size: 132, cursiva: true, alinear: 'center' });
  y += 92;
  texto(cx, mesLabel, { x: W / 2, y, size: 28, peso: 300, esp: 0.5, mayus: true, color: HUMO, alinear: 'center' });
  regla(cx, W / 2, 110, y + 58);
  y += 128;
  texto(cx, resumen, { x: W / 2, y, size: 25, peso: 500, esp: 0.28, alinear: 'center' });
  y += 78;
  texto(cx, 'El contenido de tus redes de este mes,', { x: W / 2, y, size: 26, peso: 300, color: HUMO, alinear: 'center' });
  texto(cx, 'listo para revisar.', { x: W / 2, y: y + 44, size: 26, peso: 300, color: HUMO, alinear: 'center' });
  texto(cx, 'DESLIZA HACIA ABAJO ↓', { x: W / 2, y: H - 156, size: 23, peso: 500, esp: 0.26, color: HUMO, alinear: 'center' });
  texto(cx, 'IVAE Estudios', { x: MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, mayus: true, color: HUMO });
  texto(cx, `1 / ${total}`, { x: W - MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
  return { dataUrl: exportar(cv), links: [] };
}

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
  const extra = 118 + (conNota ? 50 : 0);              // puntitos + rótulo (+nota)
  const zona = PIE_TOP - 336;
  const y0 = 336 + Math.max(0, Math.round((zona - (h + 28 + extra)) / 2));
  const fx = (W - w - 28) / 2;
  const interior = marquito(cx, fx, y0, w + 28, h + 28);
  cx.drawImage(slide, interior.x, interior.y, interior.w, interior.h);
  // Puntitos de carrusel (el actual relleno) + "SLIDE k DE n".
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

function paginaCierre({ marca, handle, mesLabel, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cx.strokeStyle = FILETE;
  cx.lineWidth = 1.6;
  cx.strokeRect(44, 44, W - 88, H - 88);
  cab(cx, handle, marca);
  const waSi = 'https://wa.me/529902046514?text=' + encodeURIComponent('Aprobado ✅');
  const waCambio = 'https://wa.me/529902046514?text=' + encodeURIComponent('Hola, quiero un cambio en: ');
  texto(cx, 'Gracias', { x: W / 2, y: Math.round(H * 0.19) + 90, size: 116, cursiva: true, alinear: 'center' });
  texto(cx, 'Ya viste todo el contenido del mes.', { x: W / 2, y: Math.round(H * 0.19) + 210, size: 27, peso: 300, alinear: 'center' });
  texto(cx, '¿Cómo lo dejamos?', { x: W / 2, y: Math.round(H * 0.19) + 262, size: 27, peso: 300, alinear: 'center' });
  const BLOQUE_Y = 1010;
  const b1 = botonCanvas(cx, BLOQUE_Y, 'Responder «Aprobado»', true);
  const b2 = botonCanvas(cx, BLOQUE_Y + 160, 'Pedir un cambio', false);
  texto(cx, 'Los dos botones abren nuestro WhatsApp con el mensaje ya escrito.', { ...NOTA, x: W / 2, y: BLOQUE_Y + 160 + 132 + 54 });
  texto(cx, '+52 990 204 6514', { x: W / 2, y: BLOQUE_Y + 160 + 132 + 168, size: 40, peso: 300, esp: 0.16, alinear: 'center' });
  regla(cx, W / 2, 180, BLOQUE_Y + 160 + 132 + 226);
  texto(cx, `${marca} · ${handle}`, { x: W / 2, y: BLOQUE_Y + 160 + 132 + 296, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO, alinear: 'center' });
  texto(cx, 'IVAE Estudios', { x: MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, mayus: true, color: HUMO });
  texto(cx, `${folio} / ${total}`, { x: W - MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
  return {
    dataUrl: exportar(cv),
    links: [
      { x: b1.x, y: b1.y - 10, w: b1.w, h: b1.h + 20, url: waSi },
      { x: b2.x, y: b2.y - 10, w: b2.w, h: b2.h + 20, url: waCambio },
    ],
  };
}

// ── Orquestador ─────────────────────────────────────────────────────────────
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function labelDeMes(month) {
  const m = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(month || '');
  const nombre = MESES_ES[parseInt(m[2], 10) - 1] || '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${m[1]}`;
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

  // Las tiras se cargan ANTES: el total de páginas = un slide por página.
  paso(T('Leyendo las tiras…', 'Reading the strips…'));
  const tiras = await Promise.all(carruseles.map(async (it) => {
    if (!it.poster_url) return null;
    try { return await slidesDeTira(it.poster_url); } catch { return null; }
  }));
  const total = 2 + reels.length + tiras.reduce((s, t) => s + (t ? t.slides.length : 1), 0);

  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  paginas.push(paginaPortada({ marca, handle, mesLabel, nReels: reels.length, nCarruseles: carruseles.length, total }));

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
  paginas.push(paginaCierre({ marca, handle, mesLabel, folio: total, total }));

  // Telemetría para el laboratorio de jueces (misma filosofía que __cargLayout).
  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  // Las anotaciones van en px del canvas real (1.5×): se escalan aquí.
  const blob = pdfDesdeJpegs(
    paginas.map((p) => ({
      dataUrl: p.dataUrl, w: Math.round(W * S), h: Math.round(H * S),
      links: (p.links || []).map((L) => ({ x: L.x * S, y: L.y * S, w: L.w * S, h: L.h * S, url: L.url })),
    })),
    { pageW: PT_W, pageH: PT_H },
  );
  const nombre = `${marca.replace(/\s+/g, '-')}_Entregables_${mesLabel.replace(/\s+/g, '-')}.pdf`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return { paginas: paginas.length, nombre, bytes: blob.size };
}
