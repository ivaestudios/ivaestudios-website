// ============================================================================
// IVAE Marketing — PDF editorial de ENTREGABLES del mes (pedido de Vianey
// 2026-08-06: "mi cliente no le entiende a la tecnología y quiere un PDF
// donde pueda ver todos los carruseles y videos… lo mejor de lo mejor").
//
// Lenguaje visual: papel de imprenta (hueso), Raleway 300 en MAYÚSCULAS
// espaciadas + Cormorant cursiva de acento — la voz de SMILE NOW, la misma
// del generador de carruseles. Cada página se rasteriza con el pipeline
// HTML→SVG→canvas (XML ESTRICTO: cero entidades HTML, <br/> cerrado) y el
// PDF se ensambla a mano (pdf-jpeg.js).
//
// Estructura: PORTADA → una página por REEL (su cuadro real del video) →
// una página por CARRUSEL (QR gigante "apunta tu cámara") → CIERRE con
// el WhatsApp de IVAE para pedir cambios.
// ============================================================================

import { T } from '../shell/i18n.js?v=202608070029';
import { pdfDesdeJpegs } from './pdf-jpeg.js?v=202608070029';

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
.serif{font-family:Cormorant,Georgia,serif}
.cursiva{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:600;text-transform:none;letter-spacing:.01em}
.regla{height:1.6px;background:${FILETE};border:0}
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
  const qr = qrcode(0, 'M');   // 0 = tamaño automático
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

// ── Cuadro del reel: poster del API o fotograma del propio video ────────────
async function imagenDeReel(item) {
  const aDataUrl = async (blob) => new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  });
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
      v.currentTime = Math.min(0.6, (v.duration || 1) / 3);
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1500); });
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth || 1080; cv.height = v.videoHeight || 1920;
      cv.getContext('2d').drawImage(v, 0, 0);
      return cv.toDataURL('image/jpeg', 0.88);
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

// ── Piezas compartidas del layout ───────────────────────────────────────────
function cab(marca, handle) {
  return `<div class="cab"><span>${esc(handle)}</span><span class="wordmark" style="font-size:26px">${esc(marca)}</span></div>`;
}
function pie(mesLabel, folio, total) {
  return `<div class="pie"><span>${esc(mesLabel)}</span><span class="folio">${esc(folio)} / ${esc(total)}</span></div>`;
}

// ── Páginas ─────────────────────────────────────────────────────────────────
function paginaPortada({ marca, handle, mesLabel, nReels, nCarruseles }) {
  const resumen = [
    nReels ? `${nReels} ${nReels === 1 ? 'video' : 'videos'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'carrusel' : 'carruseles'}` : null,
  ].filter(Boolean).join('   ·   ');
  return `<div class="pag">
    <div class="marco"></div>
    <div class="cab"><span>${esc(handle)}</span><span>${esc(mesLabel)}</span></div>
    <div style="position:absolute;left:120px;right:120px;top:34%;text-align:center">
      <div class="wordmark" style="font-size:88px">${esc(marca)}</div>
      <hr class="regla" style="width:220px;margin:70px auto"/>
      <div class="cursiva" style="font-size:150px;line-height:1">Entregables</div>
      <div style="font-size:34px;font-weight:300;letter-spacing:.5em;text-transform:uppercase;margin-top:56px;color:${HUMO}">${esc(mesLabel)}</div>
    </div>
    <div style="position:absolute;left:120px;right:120px;bottom:170px;text-align:center;
      font-size:26px;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:${HUMO}">${esc(resumen)}</div>
    <div class="pie"><span>IVAE Estudios</span><span>${esc(handle)}</span></div>
  </div>`;
}

function paginaReel({ marca, handle, mesLabel, titulo, sub, imgDataUrl, folio, total }) {
  const foto = imgDataUrl
    ? `<img src="${imgDataUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
        color:${HUMO};font-size:28px;letter-spacing:.3em">VIDEO</div>`;
  return `<div class="pag">
    ${cab(marca, handle)}
    <div style="position:absolute;top:218px;left:120px;right:120px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:44px;font-weight:300;letter-spacing:.18em;text-transform:uppercase">${esc(titulo)}</span>
      <span class="cursiva" style="font-size:40px;color:${HUMO}">video</span>
    </div>
    <hr class="regla" style="position:absolute;top:300px;left:120px;right:120px"/>
    <div style="position:absolute;top:352px;left:50%;transform:translateX(-50%);
      width:846px;height:1504px;background:#FFFFFF;padding:18px;
      box-shadow:0 26px 60px rgba(23,23,27,.16);border:1px solid ${FILETE}">
      <div style="width:100%;height:100%;overflow:hidden;background:#EDEAE3">${foto}</div>
    </div>
    ${sub ? `<div style="position:absolute;bottom:170px;left:120px;right:120px;text-align:center;
      font-size:26px;letter-spacing:.14em;color:${HUMO};text-transform:uppercase">${esc(sub)}</div>` : ''}
    ${pie(mesLabel, folio, total)}
  </div>`;
}

function paginaCarrusel({ marca, handle, mesLabel, titulo, link, qrUrl, folio, total }) {
  const corto = String(link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `<div class="pag">
    ${cab(marca, handle)}
    <div style="position:absolute;top:218px;left:120px;right:120px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:44px;font-weight:300;letter-spacing:.18em;text-transform:uppercase">${esc(titulo)}</span>
      <span class="cursiva" style="font-size:40px;color:${HUMO}">carrusel</span>
    </div>
    <hr class="regla" style="position:absolute;top:300px;left:120px;right:120px"/>
    <div style="position:absolute;top:430px;left:50%;transform:translateX(-50%);text-align:center">
      <div style="background:#FFFFFF;padding:44px;border:1px solid ${FILETE};box-shadow:0 26px 60px rgba(23,23,27,.14)">
        <img src="${qrUrl}" style="width:560px;height:560px;display:block" alt=""/>
      </div>
      <div class="cursiva" style="font-size:56px;margin-top:88px">Míralo en tu teléfono</div>
      <div style="font-size:27px;line-height:1.75;color:${HUMO};margin-top:34px;max-width:760px">
        Abre la cámara de tu teléfono, apúntala al código<br/>y toca el aviso que aparece en la pantalla.
      </div>
      <div style="font-size:26px;letter-spacing:.12em;margin-top:66px;color:${TINTA};font-weight:500">${esc(corto)}</div>
    </div>
    ${pie(mesLabel, folio, total)}
  </div>`;
}

function paginaCierre({ marca, handle, mesLabel }) {
  return `<div class="pag">
    <div class="marco"></div>
    ${cab(marca, handle)}
    <div style="position:absolute;left:120px;right:120px;top:32%;text-align:center">
      <div class="cursiva" style="font-size:120px;line-height:1.05">Gracias</div>
      <div style="font-size:30px;font-weight:300;letter-spacing:.2em;text-transform:uppercase;margin-top:64px;line-height:2">
        ¿Quieres algún cambio?<br/>Escríbenos por WhatsApp
      </div>
      <div style="font-size:52px;font-weight:500;letter-spacing:.08em;margin-top:48px">+52 990 204 6514</div>
      <hr class="regla" style="width:220px;margin:88px auto"/>
      <div style="font-size:24px;font-weight:500;letter-spacing:.34em;text-transform:uppercase;color:${HUMO}">
        ${esc(marca)} · ${esc(handle)}
      </div>
    </div>
    <div class="pie"><span>IVAE Estudios</span><span>${esc(mesLabel)}</span></div>
  </div>`;
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
 * @param {{month:string, items:Array, marca:string, handle:string, onPaso?:Function}} opts
 */
export async function generarPdfEntregables({ month, items, marca, handle, onPaso }) {
  const paso = (msg) => { try { onPaso && onPaso(msg); } catch { /* noop */ } };
  const mesLabel = labelDeMes(month);
  const reels = items.filter((x) => x.type === 'reel');
  const carruseles = items.filter((x) => x.type !== 'reel');
  const total = 2 + reels.length + carruseles.length;

  const paginas = [];
  paso(T('Armando la portada…', 'Building the cover…'));
  paginas.push(await rasterizar(paginaPortada({
    marca, handle, mesLabel, nReels: reels.length, nCarruseles: carruseles.length,
  })));

  let folio = 1;
  for (let i = 0; i < reels.length; i++) {
    const it = reels[i];
    paso(T(`Video ${i + 1} de ${reels.length}…`, `Video ${i + 1} of ${reels.length}…`));
    const img = await imagenDeReel(it);
    const pieza = it.piece || null;
    paginas.push(await rasterizar(paginaReel({
      marca, handle, mesLabel,
      titulo: it.title || (pieza ? `${pieza.type || 'REEL'} ${pieza.num || ''}` : `Video ${i + 1}`),
      sub: pieza && pieza.title ? pieza.title : '',
      imgDataUrl: img,
      folio: ++folio, total,
    })));
  }

  for (let i = 0; i < carruseles.length; i++) {
    const it = carruseles[i];
    paso(T(`Carrusel ${i + 1} de ${carruseles.length}…`, `Carousel ${i + 1} of ${carruseles.length}…`));
    const qrUrl = await qrDataUrl(it.link || 'https://ivaestudios.com', 1120);
    paginas.push(await rasterizar(paginaCarrusel({
      marca, handle, mesLabel,
      titulo: it.title || `Carrusel ${i + 1}`,
      link: it.link || '',
      qrUrl,
      folio: ++folio, total,
    })));
  }

  paso(T('Cerrando el documento…', 'Closing the document…'));
  paginas.push(await rasterizar(paginaCierre({ marca, handle, mesLabel })));

  // Telemetría para el laboratorio de jueces (misma filosofía que __cargLayout).
  try { window.__pdfPaginas = paginas.slice(); } catch { /* noop */ }

  const blob = pdfDesdeJpegs(paginas.map((dataUrl) => ({ dataUrl, w: W, h: H })));
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
