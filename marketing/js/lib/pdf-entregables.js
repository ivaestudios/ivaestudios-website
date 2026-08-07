// ============================================================================
// IVAE Marketing — PDF editorial de ENTREGABLES del mes (pedido de Vianey
// 2026-08-06: "mi cliente no le entiende a la tecnología y quiere un PDF
// donde pueda ver todos los carruseles y videos… lo mejor de lo mejor").
//
// v2 tras la ronda de jueces (editorial 7 / clienta 6 / marca 7):
//  - Enlaces TOCABLES de verdad (anotaciones /Link del PDF): el botón del
//    carrusel, el de cada video y el WhatsApp del cierre.
//  - Taxonomía llana: VIDEO 1..n / CARRUSEL 1..n + el título original como
//    subtítulo en cursiva (nada de POST/PANCARTA/REEL a secas).
//  - Cuadro del video por MUESTREO de nitidez (4 candidatos, gana el más
//    nítido); el poster subido a mano siempre gana.
//  - Cierre con camino feliz («Aprobado») + teléfono en la voz del sistema.
//  - Portada con línea llana de propósito y datos sin duplicar.
//
// Lenguaje visual: papel de imprenta, Raleway 300 caps espaciado + Cormorant
// cursiva — la voz de SMILE NOW. Raster HTML→SVG→canvas con XML ESTRICTO.
// ============================================================================

import { T } from '../shell/i18n.js?v=202608070151';
import { pdfDesdeJpegs } from './pdf-jpeg.js?v=202608070151';

// A4 a ~178 dpi: nítido en pantalla y decente impreso, sin PDFs de 40 MB.
const W = 1480;
const H = 2093;

// Paleta de imprenta.
const PAPEL = '#F5F2EC';
const TINTA = '#17171B';
const HUMO = '#6E6A62';
const FILETE = 'rgba(23,23,27,.16)';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Fuentes embebidas (mismo contrato que el generador) ─────────────────────
let fontsCss = null;
async function fuentes() {
  if (fontsCss) return fontsCss;
  const b64 = async (path) => {
    const buf = await (await fetch(path)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const [ral, cor, corIt] = await Promise.all([
    b64('/marketing/fonts/raleway-latin-var.woff2'),
    b64('/marketing/fonts/cormorant-roman.woff2'),
    b64('/marketing/fonts/cormorant-italic.woff2'),
  ]);
  fontsCss =
    `@font-face{font-family:Raleway;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${ral}) format('woff2')}` +
    `@font-face{font-family:Cormorant;font-style:normal;font-weight:300 700;src:url(data:font/woff2;base64,${cor}) format('woff2')}` +
    `@font-face{font-family:Cormorant;font-style:italic;font-weight:300 700;src:url(data:font/woff2;base64,${corIt}) format('woff2')}`;
  return fontsCss;
}

// ── Rasterizador de página (foreignObject, XML estricto) ────────────────────
async function rasterizar(html) {
  const css = `
${await fuentes()}
*{margin:0;padding:0;box-sizing:border-box}
.pag{width:${W}px;height:${H}px;background:${PAPEL};color:${TINTA};
  font-family:Raleway,sans-serif;position:relative;overflow:hidden}
.marco{position:absolute;inset:56px;border:1.6px solid ${FILETE}}
.cab{position:absolute;top:104px;left:120px;right:120px;display:flex;
  justify-content:space-between;align-items:baseline;
  font-size:24px;font-weight:500;letter-spacing:.34em;color:${HUMO};text-transform:uppercase}
.pie{position:absolute;bottom:104px;left:120px;right:120px;display:flex;
  justify-content:space-between;align-items:baseline;
  font-size:22px;font-weight:500;letter-spacing:.3em;color:${HUMO};text-transform:uppercase}
.folio{font-variant-numeric:tabular-nums}
.wordmark{font-weight:300;letter-spacing:.42em;text-transform:uppercase;white-space:nowrap}
.cursiva{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:600;text-transform:none;letter-spacing:.01em}
.regla{height:1.6px;background:${FILETE};border:0}
.boton{display:inline-block;border:2px solid ${TINTA};padding:26px 54px;
  font-size:26px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:${TINTA}}
`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${html}</div>` +
    `</foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'async';
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('raster')); img.src = url; });
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.fillStyle = PAPEL;
  cx.fillRect(0, 0, W, H);
  cx.drawImage(img, 0, 0);
  return cv.toDataURL('image/jpeg', 0.9);
}

// ── QR nítido (vendor/qrcode, dibujado a mano sobre canvas) ─────────────────
let qrListo = null;
function cargarQr() {
  if (qrListo) return qrListo;
  qrListo = new Promise((ok, bad) => {
    if (window.qrcode) { ok(window.qrcode); return; }
    const sc = document.createElement('script');
    sc.src = '/marketing/vendor/qrcode/qrcode.js';
    sc.onload = () => ok(window.qrcode);
    sc.onerror = () => bad(new Error('qr'));
    document.head.appendChild(sc);
  });
  return qrListo;
}

async function qrDataUrl(texto, px) {
  const qrcode = await cargarQr();
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const celda = Math.floor(px / (n + 8));
  const lado = celda * (n + 8);
  const cv = document.createElement('canvas');
  cv.width = lado; cv.height = lado;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#FFFFFF';
  cx.fillRect(0, 0, lado, lado);
  cx.fillStyle = TINTA;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) cx.fillRect((c + 4) * celda, (r + 4) * celda, celda, celda);
    }
  }
  return cv.toDataURL('image/png');
}

// ── Cuadro del reel: poster del API o el fotograma MÁS NÍTIDO del video ─────
// (Jueces: congelar a los 0.6s daba captions a media animación y motion blur;
// se muestrean 4 momentos y gana el de mayor energía de gradiente.)
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

async function imagenDeReel(item) {
  const aDataUrl = async (blob) => new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  });
  // El poster subido a mano SIEMPRE gana: es la vía de escape editorial.
  if (item.poster_url) {
    try {
      const r = await fetch(item.poster_url, { credentials: 'include' });
      if (r.ok) return await aDataUrl(await r.blob());
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
      return cv.toDataURL('image/jpeg', 0.88);
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

// ── La tira del carrusel → slides (para verlos EN el PDF) ───────────────────
async function slidesDeTira(posterUrl) {
  const r = await fetch(posterUrl, { credentials: 'include' });
  if (!r.ok) throw new Error('tira');
  const bmp = await createImageBitmap(await r.blob());
  const n = Math.max(1, Math.min(10, Math.round(bmp.width / (bmp.height * 0.8))));
  const sw = bmp.width / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const cv = document.createElement('canvas');
    const outW = Math.min(1000, Math.round(sw));
    cv.width = outW; cv.height = Math.round(outW * bmp.height / sw);
    cv.getContext('2d').drawImage(bmp, i * sw, 0, sw, bmp.height, 0, 0, cv.width, cv.height);
    out.push(cv.toDataURL('image/jpeg', 0.88));
  }
  return out;
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function cab(izq, der) {
  return `<div class="cab"><span>${esc(izq)}</span><span class="wordmark" style="font-size:26px">${esc(der)}</span></div>`;
}
function pie(mesLabel, folio, total) {
  return `<div class="pie"><span>${esc(mesLabel)}</span><span class="folio">${folio} / ${total}</span></div>`;
}
function tituloSeccion(titulo, sub, etiqueta) {
  return `
    <div style="position:absolute;top:206px;left:120px;right:120px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:46px;font-weight:300;letter-spacing:.18em;text-transform:uppercase">${esc(titulo)}</span>
      <span class="cursiva" style="font-size:44px;color:rgba(23,23,27,.8)">${esc(etiqueta)}</span>
    </div>
    ${sub ? `<div class="cursiva" style="position:absolute;top:278px;left:120px;right:120px;font-size:36px;color:${HUMO};
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>` : ''}
    <hr class="regla" style="position:absolute;top:${sub ? 348 : 300}px;left:120px;right:120px"/>`;
}

// ── Páginas (cada builder devuelve { html, links }) ─────────────────────────
function paginaPortada({ marca, handle, mesLabel, nReels, nCarruseles }) {
  const resumen = [
    nReels ? `${nReels} ${nReels === 1 ? 'video' : 'videos'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'carrusel' : 'carruseles'}` : null,
  ].filter(Boolean).join('   ·   ');
  return {
    html: `<div class="pag">
    <div class="marco"></div>
    <div class="cab"><span>${esc(handle)}</span><span></span></div>
    <div style="position:absolute;left:120px;right:120px;top:30%;text-align:center">
      <div class="wordmark" style="font-size:88px">${esc(marca)}</div>
      <hr class="regla" style="width:220px;margin:70px auto"/>
      <div class="cursiva" style="font-size:150px;line-height:1">Entregables</div>
      <div style="font-size:34px;font-weight:300;letter-spacing:.5em;text-transform:uppercase;margin-top:56px;color:${HUMO}">${esc(mesLabel)}</div>
      <hr class="regla" style="width:120px;margin:64px auto"/>
      <div style="font-size:27px;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:${TINTA}">${esc(resumen)}</div>
      <div style="font-size:27px;font-weight:300;letter-spacing:.06em;color:${HUMO};margin-top:44px">
        El contenido de tus redes de este mes, listo para revisar.
      </div>
    </div>
    <div class="pie"><span>IVAE Estudios</span><span class="folio">1 / __TOTAL__</span></div>
  </div>`,
    links: [],
  };
}

// Geometría del bloque de acceso de las páginas de video (para las zonas
// tocables): botón centrado bajo el QR.
const REEL_CARD = { top: 380, w: 740, alto: 1315 };
const ACCESO_Y = REEL_CARD.top + REEL_CARD.alto + 62;   // 1757

function paginaReel({ marca, handle, mesLabel, titulo, sub, imgDataUrl, qrUrl, deepLink, folio, total, instrCorta }) {
  const foto = imgDataUrl
    ? `<img src="${imgDataUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
        color:${HUMO};font-size:28px;letter-spacing:.3em">VIDEO</div>`;
  const instr = instrCorta
    ? 'Toca el botón o escanea el código con tu cámara.'
    : '¿Lo ves en tu teléfono? Toca el botón. ¿Impreso? Escanea el código con la cámara.';
  const botonW = 560;
  const botonX = (W - botonW) / 2 + 130;   // el grupo (QR + botón) va centrado
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'video')}
    <div style="position:absolute;top:${REEL_CARD.top}px;left:50%;transform:translateX(-50%);
      width:${REEL_CARD.w}px;height:${REEL_CARD.alto}px;background:#FFFFFF;padding:16px;
      box-shadow:0 26px 60px rgba(23,23,27,.16);border:1px solid ${FILETE}">
      <div style="width:100%;height:100%;overflow:hidden;background:#EDEAE3">${foto}</div>
    </div>
    <div style="position:absolute;top:${ACCESO_Y}px;left:120px;right:120px;display:flex;align-items:center;justify-content:center;gap:54px">
      <img src="${qrUrl}" style="width:186px;height:186px;flex:none;border:1px solid ${FILETE};background:#fff" alt=""/>
      <div style="text-align:left;max-width:760px">
        <div class="boton">Ver este video</div>
        <div style="font-size:23.5px;color:${HUMO};margin-top:22px;letter-spacing:.02em">${instr}</div>
      </div>
    </div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: [
      { x: botonX - 130, y: ACCESO_Y, w: 700, h: 200, url: deepLink },
    ],
  };
}

function paginaCarrusel({ marca, handle, mesLabel, titulo, sub, link, qrUrl, slides, folio, total, instrCorta }) {
  if (slides && slides.length) return paginaCarruselSlides({ marca, handle, mesLabel, titulo, sub, link, qrUrl, slides, folio, total });
  return paginaCarruselQr({ marca, handle, mesLabel, titulo, sub, link, qrUrl, folio, total, instrCorta });
}

// Con TIRA: el slide 1 protagonista + fila de miniaturas — el carrusel SE VE
// sin escanear nada (pedido de Vianey + crítica #1 de los jueces).
function paginaCarruselSlides({ marca, handle, mesLabel, titulo, sub, link, qrUrl, slides, folio, total }) {
  const CARD = { top: 396, w: 700 };
  const alto = Math.round(CARD.w * 5 / 4);   // 4:5
  const maxThumbs = 6;
  const visibles = slides.slice(0, maxThumbs);
  const extras = slides.length - visibles.length;
  const THUMB_W = 148; const THUMB_H = 185; const GAP = 16;
  const thumbs = visibles.map((d, i) =>
    `<div style="position:relative;flex:none;background:#fff;padding:6px;border:1px solid ${FILETE}">
      <img src="${d}" style="width:${THUMB_W}px;height:${THUMB_H}px;object-fit:cover;display:block" alt=""/>
      ${i === maxThumbs - 1 && extras > 0 ? `<div style="position:absolute;inset:6px;background:rgba(23,23,27,.55);color:#fff;
        display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:300">+${extras}</div>` : ''}
    </div>`).join('');
  const acceso = link
    ? `<div style="position:absolute;top:1668px;left:120px;right:120px;display:flex;align-items:center;justify-content:center;gap:44px">
        <img src="${qrUrl}" style="width:150px;height:150px;flex:none;border:1px solid ${FILETE};background:#fff" alt=""/>
        <div style="text-align:left">
          <div class="boton" style="padding:20px 44px;font-size:24px">Verlo en internet</div>
          <div style="font-size:22px;color:${HUMO};margin-top:16px">Toca el botón o escanea el código con tu cámara.</div>
        </div>
      </div>`
    : '';
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'carrusel')}
    <div style="position:absolute;top:${CARD.top}px;left:50%;transform:translateX(-50%);
      width:${CARD.w + 32}px;height:${alto + 32}px;background:#FFFFFF;padding:16px;
      box-shadow:0 26px 60px rgba(23,23,27,.16);border:1px solid ${FILETE}">
      <div style="width:100%;height:100%;overflow:hidden;background:#EDEAE3">
        <img src="${slides[0]}" style="width:100%;height:100%;object-fit:cover" alt=""/>
      </div>
    </div>
    <div style="position:absolute;top:${CARD.top + alto + 76}px;left:120px;right:120px;
      display:flex;justify-content:center;gap:${GAP}px">${thumbs}</div>
    ${acceso}
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: link ? [{ x: (W - 900) / 2, y: 1650, w: 900, h: 190, url: link }] : [],
  };
}

function paginaCarruselQr({ marca, handle, mesLabel, titulo, sub, link, qrUrl, folio, total, instrCorta }) {
  const corto = String(link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const instr = instrCorta
    ? 'Toca el botón o escanea el código con tu cámara.'
    : '¿Lo ves en tu teléfono? Toca el botón y se abre solo. ¿Lo tienes impreso? Abre la cámara, apúntala al código y toca el aviso.';
  const QR_TOP = 470;
  const QR_LADO = 520;
  const BTN_Y = QR_TOP + 88 + QR_LADO + 96;   // tarjeta (padding 44) + aire
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'carrusel')}
    <div style="position:absolute;top:${QR_TOP}px;left:50%;transform:translateX(-50%);text-align:center">
      <div style="display:inline-block;background:#FFFFFF;padding:44px;border:1px solid ${FILETE};box-shadow:0 26px 60px rgba(23,23,27,.14)">
        <img src="${qrUrl}" style="width:${QR_LADO}px;height:${QR_LADO}px;display:block" alt=""/>
      </div>
      <div style="margin-top:96px"><span class="boton">Ver el carrusel</span></div>
      <div style="font-size:25px;line-height:1.8;color:${HUMO};margin-top:40px;max-width:820px">${instr}</div>
      <div style="font-size:26px;letter-spacing:.1em;margin-top:52px;color:${TINTA};font-weight:500">${esc(corto)}</div>
    </div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: [
      { x: (W - 700) / 2, y: BTN_Y - 20, w: 700, h: 160, url: link },
      { x: (W - 860) / 2, y: QR_TOP, w: 860, h: QR_LADO + 88, url: link },
    ],
  };
}

function paginaCierre({ marca, handle, mesLabel, folio, total }) {
  const wa = 'https://wa.me/529902046514';
  const TEL_Y = Math.round(H * 0.40) + 470;
  return {
    html: `<div class="pag">
    <div class="marco"></div>
    ${cab(handle, marca)}
    <div style="position:absolute;left:120px;right:120px;top:38%;text-align:center">
      <div class="cursiva" style="font-size:120px;line-height:1.05">Gracias</div>
      <div style="font-size:29px;font-weight:300;letter-spacing:.04em;color:${TINTA};margin-top:70px;line-height:1.9">
        Si todo te gusta, respóndenos con un <span class="cursiva" style="font-size:34px">«Aprobado»</span> y lo dejamos programado.
      </div>
      <div style="font-size:28px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;margin-top:74px;line-height:2;color:${HUMO}">
        ¿Quieres algún cambio?<br/>Escríbenos por WhatsApp
      </div>
      <div style="font-size:52px;font-weight:300;letter-spacing:.18em;margin-top:40px;font-variant-numeric:lining-nums tabular-nums">+52 990 204 6514</div>
      <hr class="regla" style="width:220px;margin:80px auto"/>
      <div style="font-size:24px;font-weight:500;letter-spacing:.34em;text-transform:uppercase;color:${HUMO}">
        ${esc(marca)} · ${esc(handle)}
      </div>
    </div>
    <div class="pie"><span>IVAE Estudios</span><span class="folio">${folio} / ${total}</span></div>
  </div>`,
    links: [
      { x: (W - 900) / 2, y: TEL_Y - 40, w: 900, h: 140, url: wa },
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
  const mesLabel = labelDeMes(month);
  const reels = items.filter((x) => x.type === 'reel');
  const carruseles = items.filter((x) => x.type !== 'reel');
  const total = 2 + reels.length + carruseles.length;
  const deepLink = `https://ivaestudios.com/marketing/app#/entregables?cliente=${encodeURIComponent(clientId || '')}`;

  const paginas = [];
  const empujar = async (pg) => { paginas.push({ dataUrl: await rasterizar(pg.html), links: pg.links }); };

  paso(T('Armando la portada…', 'Building the cover…'));
  const portada = paginaPortada({ marca, handle, mesLabel, nReels: reels.length, nCarruseles: carruseles.length });
  portada.html = portada.html.replace('__TOTAL__', String(total));
  await empujar(portada);

  let folio = 1;
  for (let i = 0; i < reels.length; i++) {
    const it = reels[i];
    paso(T(`Video ${i + 1} de ${reels.length}…`, `Video ${i + 1} of ${reels.length}…`));
    const img = await imagenDeReel(it);
    const pieza = it.piece || null;
    // El enlace de CADA video abre SOLO ese video (público firmado); si el
    // backend no lo dio, cae al panel de Entregables.
    const linkVideo = it.public_video_url || deepLink;
    await empujar(paginaReel({
      marca, handle, mesLabel,
      titulo: `Video ${i + 1}`,
      sub: (pieza && pieza.title) || it.title || '',
      imgDataUrl: img,
      qrUrl: await qrDataUrl(linkVideo, 380), deepLink: linkVideo,
      folio: ++folio, total,
      instrCorta: i > 0,
    }));
  }

  for (let i = 0; i < carruseles.length; i++) {
    const it = carruseles[i];
    paso(T(`Carrusel ${i + 1} de ${carruseles.length}…`, `Carousel ${i + 1} of ${carruseles.length}…`));
    let slides = null;
    if (it.poster_url) {
      try { slides = await slidesDeTira(it.poster_url); } catch { slides = null; }
    }
    const qrUrl = await qrDataUrl(it.link || deepLink, slides ? 320 : 1040);
    await empujar(paginaCarrusel({
      marca, handle, mesLabel,
      titulo: `Carrusel ${i + 1}`,
      sub: it.title || '',
      link: it.link || (slides ? '' : deepLink),
      qrUrl, slides,
      folio: ++folio, total,
      instrCorta: reels.length > 0 && i > 0,
    }));
  }

  paso(T('Cerrando el documento…', 'Closing the document…'));
  await empujar(paginaCierre({ marca, handle, mesLabel, folio: total, total }));

  // Telemetría para el laboratorio de jueces (misma filosofía que __cargLayout).
  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  const blob = pdfDesdeJpegs(paginas.map((p) => ({ dataUrl: p.dataUrl, w: W, h: H, links: p.links })));
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
