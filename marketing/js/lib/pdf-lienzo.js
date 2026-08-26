// ============================================================================
// IVAE Marketing — LIENZO compartido de los PDFs móviles (Entregables y
// Contenido). Extraído de pdf-entregables v5 tras la lección de Safari.
//
// REGLAS DURAS (sangre ya cobrada):
//  - TODO se dibuja con canvas 2D + FontFace API. NADA de foreignObject:
//    Safari no pinta <img> ni @font-face dentro de un SVG-como-imagen.
//  - drawImage con rect de ORIGEN fuera de la imagen (aunque sea por
//    0.00000006px de flotante) no dibuja NADA en WebKit — todo rect de
//    origen va CLAVADO con Math.min/Math.max a los límites de la imagen.
//  - Páginas 9:16 en espacio de diseño 1080×1920, raster a 1.5× (Retina);
//    las anotaciones /Link se escalan ×S al ensamblar.
//
// Voz visual: papel de imprenta — Raleway 300 caps espaciado + Cormorant
// cursiva. Probar SIEMPRE en WebKit real (playwright-webkit) antes de subir.
// ============================================================================

import { pdfDesdeJpegs } from './pdf-jpeg.js?v=202608261411';

// Espacio de diseño y raster.
export const W = 1080;
export const H = 1920;
export const S = 1.5;
export const PT_W = 540;
export const PT_H = 960;

// Paleta de imprenta.
export const PAPEL = '#F5F2EC';
export const TINTA = '#17171B';
export const HUMO = '#6E6A62';
export const FILETE = 'rgba(23,23,27,.16)';

export const MX = 64;
export const CONT_W = W - MX * 2;     // 952
export const PIE_TOP = 1826;

export const NOTA = { size: 27, peso: 300, esp: 0, color: 'rgba(23,23,27,.72)', alinear: 'center' };

// La voz editorial por marca (marca + renglón del cabezal). Un solo lugar:
// lo usan Entregables y Contenido — NO duplicar en las vistas.
const VOCES = [{ match: /smile/i, marca: 'Smile Now', handle: 'DENTAL & FACIAL CARE' }];
export function vozDeMarca(cliente) {
  const voz = VOCES.find((v) => v.match.test((cliente && cliente.name) || ''));
  if (voz) return { marca: voz.marca, handle: voz.handle };
  const ig = cliente && cliente.instagram_handle ? `@${String(cliente.instagram_handle).replace(/^@/, '')}` : '';
  return { marca: (cliente && cliente.name) || 'IVAE', handle: ig };
}

// ── Fuentes por FontFace API (el canvas 2D SÍ las usa en Safari) ────────────
let fuentesListas = null;
export function cargarFuentes() {
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
export function nuevaPagina() {
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
export const exportar = (cv) => cv.toDataURL('image/jpeg', 0.9);

// ── Texto con espaciado de imprenta (letra por letra, idéntico en Safari) ───
function fuenteDe(o) {
  const fam = o.cursiva ? 'CormorantPDF' : 'RalewayPDF';
  const estilo = o.cursiva ? 'italic ' : '';
  const peso = o.peso || (o.cursiva ? 600 : 300);
  return `${estilo}${peso} ${o.size}px ${fam}, ${o.cursiva ? 'Georgia, serif' : 'sans-serif'}`;
}
export function anchoTexto(cx, s, o) {
  cx.font = fuenteDe(o);
  const esp = (o.esp || 0) * o.size;
  if (!esp) return cx.measureText(s).width;
  let w = 0;
  for (const ch of s) w += cx.measureText(ch).width + esp;
  return s.length ? w - esp : 0;
}
export function texto(cx, str, o) {
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
export function textoRecortado(cx, str, o, maxW) {
  let s = o.mayus ? String(str).toUpperCase() : String(str);
  if (anchoTexto(cx, s, o) <= maxW) return texto(cx, s, { ...o, mayus: false });
  while (s.length > 1 && anchoTexto(cx, s + '…', o) > maxW) s = s.slice(0, -1);
  return texto(cx, s.trimEnd() + '…', { ...o, mayus: false });
}
// Word-wrap real. Con `medir: true` NO dibuja: solo cuenta renglones.
export function parrafo(cx, str, o, maxW, lineH, medir) {
  const palabras = String(str).split(/\s+/).filter(Boolean);
  const lineas = [];
  let linea = '';
  for (const p of palabras) {
    const cand = linea ? linea + ' ' + p : p;
    if (anchoTexto(cx, cand, o) <= maxW || !linea) linea = cand;
    else { lineas.push(linea); linea = p; }
  }
  if (linea) lineas.push(linea);
  if (!medir) lineas.forEach((l, i) => texto(cx, l, { ...o, y: o.y + i * lineH }));
  return lineas.length;
}
export function regla(cx, xCentro, w, y) {
  cx.fillStyle = FILETE;
  cx.fillRect(xCentro - w / 2, y, w, 1.6);
}

// ── Piezas compartidas de página ────────────────────────────────────────────
export function cab(cx, izq, der) {
  texto(cx, izq, { x: MX, y: 100, size: 21, peso: 500, esp: 0.3, mayus: true, color: HUMO });
  if (der) texto(cx, der, { x: W - MX, y: 100, size: 22, peso: 300, esp: 0.42, mayus: true, color: HUMO, alinear: 'right' });
}
export function pieDePagina(cx, mesLabel, folio, total) {
  texto(cx, mesLabel, { x: MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, mayus: true, color: HUMO });
  texto(cx, `${folio} / ${total}`, { x: W - MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
}
export function tituloSeccion(cx, titulo, etiqueta, sub) {
  texto(cx, titulo, { x: MX, y: 214, size: 46, peso: 300, esp: 0.16, mayus: true });
  texto(cx, etiqueta, { x: W - MX, y: 212, size: 42, cursiva: true, color: 'rgba(23,23,27,.8)', alinear: 'right' });
  if (sub) textoRecortado(cx, sub, { x: MX, y: 272, size: 33, cursiva: true, color: HUMO }, CONT_W);
  regla(cx, W / 2, CONT_W, sub ? 302 : 258);
}
export function marquito(cx, x, y, w, h, pad) {
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
// Imagen a cubrir (cover) — rect de ORIGEN clavado a los límites (WebKit).
export function dibujarCover(cx, img, r) {
  const iw = img.width || img.videoWidth || 1;
  const ih = img.height || img.videoHeight || 1;
  const k = Math.max(r.w / iw, r.h / ih);
  const sw = Math.min(iw, r.w / k);
  const sh = Math.min(ih, r.h / k);
  const sx = Math.min(iw - sw, Math.max(0, (iw - sw) / 2));
  const sy = Math.min(ih - sh, Math.max(0, (ih - sh) / 2));
  cx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
}
// Rectángulo redondeado a mano: `roundRect` no existe en WebKit viejo y su
// ausencia tumbaría la página entera (misma familia de trampas que drawImage).
function rectRedondo(cx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  cx.beginPath();
  cx.moveTo(x + k, y);
  cx.lineTo(x + w - k, y);
  cx.arcTo(x + w, y, x + w, y + k, k);
  cx.lineTo(x + w, y + h - k);
  cx.arcTo(x + w, y + h, x + w - k, y + h, k);
  cx.lineTo(x + k, y + h);
  cx.arcTo(x, y + h, x, y + h - k, k);
  cx.lineTo(x, y + k);
  cx.arcTo(x, y, x + k, y, k);
  cx.closePath();
}

// TAG sólido (pastilla): la etiqueta que identifica una pieza de un vistazo
// — p.ej. TESTIMONIO. Devuelve su alto para seguir apilando debajo.
export function pastilla(cx, x, y, label, opts) {
  const o = opts || {};
  const size = o.size || 22;
  const fuente = { size, peso: 600, esp: 0.26, mayus: true };
  const w = anchoTexto(cx, String(label).toUpperCase(), fuente) + 56;
  const h = size + 34;
  cx.fillStyle = o.fondo || TINTA;
  rectRedondo(cx, x, y, w, h, h / 2);
  cx.fill();
  texto(cx, label, { ...fuente, x: x + w / 2, y: y + h / 2 + size / 2 - 2, color: o.color || PAPEL, alinear: 'center' });
  return { w, h };
}

export function botonCanvas(cx, y, label, relleno) {
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

// ── Portada y cierre genéricos (mismo esqueleto en ambos PDFs) ──────────────
export function paginaPortadaBase({ handle, marca, tituloCursiva, mesLabel, resumen, lineas, total }) {
  const { cv, cx } = nuevaPagina();
  cx.strokeStyle = FILETE;
  cx.lineWidth = 1.6;
  cx.strokeRect(44, 44, W - 88, H - 88);
  cab(cx, handle, '');
  let y = Math.round(H * 0.27) + 40;
  texto(cx, marca, { x: W / 2, y, size: 58, peso: 300, esp: 0.42, mayus: true, alinear: 'center' });
  regla(cx, W / 2, 180, y + 62);
  y += 228;
  texto(cx, tituloCursiva, { x: W / 2, y, size: 132, cursiva: true, alinear: 'center' });
  y += 92;
  texto(cx, mesLabel, { x: W / 2, y, size: 28, peso: 300, esp: 0.5, mayus: true, color: HUMO, alinear: 'center' });
  regla(cx, W / 2, 110, y + 58);
  y += 128;
  texto(cx, resumen, { x: W / 2, y, size: 25, peso: 500, esp: 0.28, alinear: 'center' });
  y += 78;
  (lineas || []).forEach((l, i) => texto(cx, l, { x: W / 2, y: y + i * 44, size: 26, peso: 300, color: HUMO, alinear: 'center' }));
  texto(cx, 'DESLIZA HACIA ABAJO ↓', { x: W / 2, y: H - 156, size: 23, peso: 500, esp: 0.26, color: HUMO, alinear: 'center' });
  texto(cx, 'IVAE Estudios', { x: MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, mayus: true, color: HUMO });
  texto(cx, `1 / ${total}`, { x: W - MX, y: PIE_TOP + 24, size: 19, peso: 500, esp: 0.26, color: HUMO, alinear: 'right' });
  return { dataUrl: exportar(cv), links: [] };
}

export function paginaCierreAprobado({ marca, handle, mesLabel, lineas, folio, total }) {
  const { cv, cx } = nuevaPagina();
  cx.strokeStyle = FILETE;
  cx.lineWidth = 1.6;
  cx.strokeRect(44, 44, W - 88, H - 88);
  cab(cx, handle, marca);
  const waSi = 'https://wa.me/529902046514?text=' + encodeURIComponent('Aprobado ✅');
  const waCambio = 'https://wa.me/529902046514?text=' + encodeURIComponent('Hola, quiero un cambio en: ');
  texto(cx, 'Gracias', { x: W / 2, y: Math.round(H * 0.19) + 90, size: 116, cursiva: true, alinear: 'center' });
  (lineas || []).forEach((l, i) => texto(cx, l, { x: W / 2, y: Math.round(H * 0.19) + 210 + i * 52, size: 27, peso: 300, alinear: 'center' }));
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

// ── Ensamble y descarga ─────────────────────────────────────────────────────
export const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function labelDeMes(month) {
  const m = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(month || '');
  const nombre = MESES_ES[parseInt(m[2], 10) - 1] || '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${m[1]}`;
}

export function armarYDescargar(paginas, nombre) {
  const blob = pdfDesdeJpegs(
    paginas.map((p) => ({
      dataUrl: p.dataUrl, w: Math.round(W * S), h: Math.round(H * S),
      links: (p.links || []).map((L) => ({ x: L.x * S, y: L.y * S, w: L.w * S, h: L.h * S, url: L.url })),
    })),
    { pageW: PT_W, pageH: PT_H },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return blob;
}
