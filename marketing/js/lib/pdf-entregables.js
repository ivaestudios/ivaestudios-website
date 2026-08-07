// ============================================================================
// IVAE Marketing — PDF de ENTREGABLES del mes, PENSADO PARA iPHONE (pedido de
// Vianey 2026-08-07: "el pdf es para móvil en iPhone… nada de QR: yo te subo
// la tira, tú la divides y la pones bonito").
//
// v4 móvil-primero (afinado por panel de jueces móvil/editorial/QA):
//  - Páginas VERTICALES 9:16 (1080×1920): en WhatsApp/Quick Look cada página
//    llena la pantalla como una historia — no un A4 encogido.
//  - CERO códigos QR: el PDF vive EN el teléfono, no hay nada que escanear.
//    Todo acceso es un BOTÓN tocable a lo ancho (anotaciones /Link reales),
//    RELLENO de tinta — para una clienta no-tech "botón" = bloque sólido.
//  - Carruseles: slide 1 protagonista y luego los slides GRANDES a 2×2 en
//    páginas de continuación (legibles sin zoom — es un documento de
//    REVISIÓN; la cuadrícula chiquita de miniaturas no se leía en teléfono).
//  - Las cajas de slide usan el RATIO REAL de la tira (nada de object-fit
//    que decapite el tope de cada pieza).
//  - Cada video abre SOLO ese video (enlace público firmado del backend);
//    un video sin material dice "en producción" SIN botón muerto.
//  - Cierre: «Responder Aprobado» es el botón primario (texto precargado).
//
// Lenguaje visual: papel de imprenta, Raleway 300 caps espaciado + Cormorant
// cursiva — la voz de SMILE NOW. Raster HTML→SVG→canvas con XML ESTRICTO.
// ============================================================================

import { T } from '../shell/i18n.js?v=202608070310';
import { pdfDesdeJpegs } from './pdf-jpeg.js?v=202608070310';

// 9:16 a resolución de historia: nítido en Retina sin PDFs de 40 MB.
const W = 1080;
const H = 1920;
// Página PDF en pt (misma proporción; los visores ajustan al ancho de pantalla).
const PT_W = 540;
const PT_H = 960;

// Paleta de imprenta.
const PAPEL = '#F5F2EC';
const TINTA = '#17171B';
const HUMO = '#6E6A62';
const FILETE = 'rgba(23,23,27,.16)';

// Márgenes y zonas fijas de la página móvil.
const MX = 64;                 // margen lateral
const CONT_W = W - MX * 2;     // 952: ancho útil (los botones lo llenan)
const PIE_TOP = 1826;          // donde arranca el pie: nada debe pasar de aquí

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
.marco{position:absolute;inset:44px;border:1.6px solid ${FILETE}}
.cab{position:absolute;top:78px;left:${MX}px;right:${MX}px;display:flex;
  justify-content:space-between;align-items:baseline;
  font-size:21px;font-weight:500;letter-spacing:.3em;color:${HUMO};text-transform:uppercase}
.pie{position:absolute;bottom:70px;left:${MX}px;right:${MX}px;display:flex;
  justify-content:space-between;align-items:baseline;
  font-size:19px;font-weight:500;letter-spacing:.26em;color:${HUMO};text-transform:uppercase}
.folio{font-variant-numeric:tabular-nums}
.wordmark{font-weight:300;letter-spacing:.42em;text-transform:uppercase;white-space:nowrap}
.cursiva{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:600;text-transform:none;letter-spacing:.01em}
.regla{height:1.6px;background:${FILETE};border:0}
.boton{display:block;width:100%;background:${TINTA};border:2.4px solid ${TINTA};padding:38px 20px;
  font-size:30px;font-weight:500;letter-spacing:.24em;text-transform:uppercase;
  color:${PAPEL};text-align:center}
.boton--linea{background:transparent;color:${TINTA}}
.nota{font-size:27px;font-weight:300;letter-spacing:.02em;color:rgba(23,23,27,.72);text-align:center}
.marquito{background:#FFFFFF;padding:14px;box-shadow:0 24px 54px rgba(23,23,27,.16);border:1px solid ${FILETE}}
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
// El número de slides NO se adivina con "ancho/(alto×0.8)": eso asume 4:5
// exacto y con slides 3:4 o cuadrados redondea al n EQUIVOCADO (todo queda
// rebanado a destiempo). Se prueba cada n y gana el que deje el slide más
// cerca de un formato real de Instagram (9:16, 3:4, 4:5, 1:1). Techo 20.
// Con empate geométrico (4 cuadrados ≡ 5 de 4:5) gana el formato MÁS común
// en carruseles: 4:5 primero, luego 1:1, luego 3:4 y 9:16.
const RATIOS_IG = [
  { r: 4 / 5, p: 0 }, { r: 1, p: 1 }, { r: 3 / 4, p: 2 }, { r: 9 / 16, p: 3 },
];
function numSlidesDeTira(w, h) {
  let mejor = { d: Infinity, p: 9, n: 1 };
  for (let n = 1; n <= 20; n++) {
    const r = w / (n * h);
    if (r < 0.4) break;                     // más angosto que 9:16: ya nos pasamos
    for (const c of RATIOS_IG) {
      const d = Math.abs(r - c.r);
      const casiEmpate = Math.abs(d - mejor.d) <= 0.015;
      if ((d < mejor.d && !casiEmpate) || (casiEmpate && c.p < mejor.p)) mejor = { d, p: c.p, n };
    }
  }
  return mejor.n;
}

// Devuelve { slides, ratio }: el ratio REAL del slide manda en las cajas del
// PDF — nada de forzar 4:5 con object-fit (decapitaba el tope de cada pieza).
async function slidesDeTira(posterUrl) {
  const r = await fetch(posterUrl, { credentials: 'include' });
  if (!r.ok) throw new Error('tira');
  const bmp = await createImageBitmap(await r.blob());
  const n = numSlidesDeTira(bmp.width, bmp.height);
  const sw = bmp.width / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const cv = document.createElement('canvas');
    const outW = Math.min(1000, Math.round(sw));
    cv.width = outW; cv.height = Math.round(outW * bmp.height / sw);
    cv.getContext('2d').drawImage(bmp, i * sw, 0, sw, bmp.height, 0, 0, cv.width, cv.height);
    out.push(cv.toDataURL('image/jpeg', 0.88));
  }
  return { slides: out, ratio: sw / bmp.height };
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function cab(izq, der) {
  return `<div class="cab"><span>${esc(izq)}</span><span class="wordmark" style="font-size:22px">${esc(der)}</span></div>`;
}
function pie(mesLabel, folio, total) {
  return `<div class="pie"><span>${esc(mesLabel)}</span><span class="folio">${folio} / ${total}</span></div>`;
}
function tituloSeccion(titulo, sub, etiqueta) {
  return `
    <div style="position:absolute;top:168px;left:${MX}px;right:${MX}px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:46px;font-weight:300;letter-spacing:.16em;text-transform:uppercase">${esc(titulo)}</span>
      <span class="cursiva" style="font-size:42px;color:rgba(23,23,27,.8)">${esc(etiqueta)}</span>
    </div>
    ${sub ? `<div class="cursiva" style="position:absolute;top:240px;left:${MX}px;right:${MX}px;font-size:33px;color:${HUMO};
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>` : ''}
    <hr class="regla" style="position:absolute;top:${sub ? 302 : 258}px;left:${MX}px;right:${MX}px"/>`;
}

// ── Páginas (cada builder devuelve { html, links }) ─────────────────────────
function paginaPortada({ marca, handle, mesLabel, nReels, nCarruseles, total }) {
  const resumen = [
    nReels ? `${nReels} ${nReels === 1 ? 'video' : 'videos'}` : null,
    nCarruseles ? `${nCarruseles} ${nCarruseles === 1 ? 'carrusel' : 'carruseles'}` : null,
  ].filter(Boolean).join('   ·   ');
  return {
    html: `<div class="pag">
    <div class="marco"></div>
    <div class="cab"><span>${esc(handle)}</span><span></span></div>
    <div style="position:absolute;left:${MX}px;right:${MX}px;top:27%;text-align:center">
      <div class="wordmark" style="font-size:58px">${esc(marca)}</div>
      <hr class="regla" style="width:180px;margin:64px auto"/>
      <div class="cursiva" style="font-size:132px;line-height:1">Entregables</div>
      <div style="font-size:28px;font-weight:300;letter-spacing:.5em;text-transform:uppercase;margin-top:56px;color:${HUMO}">${esc(mesLabel)}</div>
      <hr class="regla" style="width:110px;margin:60px auto"/>
      <div style="font-size:25px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:${TINTA}">${esc(resumen)}</div>
      <div style="font-size:26px;font-weight:300;letter-spacing:.04em;color:${HUMO};margin-top:48px;line-height:1.7">
        El contenido de tus redes de este mes,<br/>listo para revisar.
      </div>
    </div>
    <div style="position:absolute;left:${MX}px;right:${MX}px;bottom:150px;text-align:center;
      font-size:23px;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:${HUMO}">
      Desliza hacia abajo &#8595;
    </div>
    <div class="pie"><span>IVAE Estudios</span><span class="folio">1 / ${total}</span></div>
  </div>`,
    links: [],
  };
}

// Página de video: cuadro 9:16 protagonista + botón sólido que abre SOLO ese
// video. Sin material: mensaje "en producción" y NINGÚN botón muerto (jueces:
// un botón que no abre nada mata la confianza en TODOS los botones).
const REEL = { top: 336, w: 640 };
const REEL_ALTO = Math.round(REEL.w * 16 / 9);          // 1138
const REEL_BTN_Y = REEL.top + REEL_ALTO + 28 + 56;

function paginaReel({ marca, handle, mesLabel, titulo, sub, imgDataUrl, deepLink, enProduccion, folio, total }) {
  const foto = imgDataUrl
    ? `<img src="${imgDataUrl}" style="width:100%;height:100%;object-fit:cover" alt=""/>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:60px;text-align:center;
        color:${HUMO};font-size:30px;font-weight:300;line-height:1.9">Este video está en producción —<br/>te lo enviamos en cuanto esté listo.</div>`;
  const acceso = enProduccion
    ? `<div class="nota" style="margin-top:10px;letter-spacing:.2em;text-transform:uppercase;font-size:25px;color:${TINTA};font-weight:500">En producción</div>`
    : `<div class="boton">Ver este video</div>
      <div class="nota" style="margin-top:26px">Toca el botón y el video se abre solo.</div>`;
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'video')}
    <div class="marquito" style="position:absolute;top:${REEL.top}px;left:50%;transform:translateX(-50%);
      width:${REEL.w + 28}px;height:${REEL_ALTO + 28}px">
      <div style="width:100%;height:100%;overflow:hidden;background:#EDEAE3">${foto}</div>
    </div>
    <div style="position:absolute;top:${REEL_BTN_Y}px;left:${MX}px;right:${MX}px">${acceso}</div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: enProduccion ? [] : [
      { x: MX, y: REEL_BTN_Y - 14, w: CONT_W, h: 160, url: deepLink },
      // El cuadro del video también es tocable: en el teléfono lo primero que
      // hace la clienta es picarle a la imagen.
      { x: (W - REEL.w - 28) / 2, y: REEL.top, w: REEL.w + 28, h: REEL_ALTO + 28, url: deepLink },
    ],
  };
}

// Carrusel con tira — página 1: el slide 1 protagonista al ratio REAL + línea
// que anuncia las páginas grandes que siguen. (La cuadrícula de miniaturas se
// fue: a escala de teléfono no se leía, y este PDF es para REVISAR.)
function paginaCarruselPortada({ marca, handle, mesLabel, titulo, sub, link, slides, ratio, folio, total }) {
  const n = slides.length;
  const cardW = Math.min(680, Math.round(1000 * ratio));
  const cardH = Math.round(cardW / ratio);
  // El bloque (marco + nota) se CENTRA en la zona útil: una tarjeta 4:5 a
  // 680 de ancho dejaba medio cuerpo de página vacío abajo (jueces).
  const ZONA_TOP = 320; const bloqueH = cardH + 28 + 52 + 44;
  const top = Math.max(336, ZONA_TOP + Math.round((PIE_TOP - ZONA_TOP - bloqueH) / 2));
  const notaY = top + cardH + 28 + 52;
  const linea = n === 1
    ? 'Así se publicará esta imagen. Aquí no hay nada que tocar — solo revísala.'
    : `Carrusel de ${n} slides — cada uno viene grande en las páginas que siguen. Si quieres leer más de cerca, abre los dedos sobre la imagen.`;
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'carrusel')}
    <div class="marquito" style="position:absolute;top:${top}px;left:50%;transform:translateX(-50%);
      width:${cardW + 28}px;height:${cardH + 28}px">
      <div style="width:100%;height:100%;overflow:hidden;background:#EDEAE3">
        <img src="${slides[0]}" style="width:100%;height:100%;object-fit:cover" alt=""/>
      </div>
    </div>
    <div class="nota" style="position:absolute;top:${notaY}px;left:${MX}px;right:${MX}px">${esc(linea)}</div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    // Si el carrusel además tiene link, el slide protagonista es tocable.
    links: link ? [{ x: (W - cardW - 28) / 2, y: top, w: cardW + 28, h: cardH + 28, url: link }] : [],
  };
}

// Carrusel con tira — continuación: hasta 4 slides GRANDES a 2×2, cada uno con
// su número (para poder pedir "cámbiame el slide 4" por WhatsApp).
function paginaCarruselSigue({ marca, handle, mesLabel, titulo, sub, slides, ratio, desde, folio, total }) {
  const GAP = 36;
  // La celda respeta el ratio real y cabe en 2×2 dentro de la zona útil.
  let cellW = Math.floor((CONT_W - GAP) / 2) - 28;          // 430 de imagen
  let cellH = Math.round(cellW / ratio);
  const maxH = Math.floor((PIE_TOP - 336 - GAP - 120) / 2) - 28;   // aire para números
  if (cellH > maxH) { cellH = maxH; cellW = Math.round(cellH * ratio); }
  // Slide huérfano (último impar): a tamaño protagonista — dejarlo en celda
  // 2×2 regalaba el 70% de la página (jueces de verificación).
  if (slides.length === 1) {
    cellH = Math.min(1050, PIE_TOP - 320 - 140);
    cellW = Math.round(cellH * ratio);
    if (cellW > 680) { cellW = 680; cellH = Math.round(cellW / ratio); }
  }
  const celdas = slides.map((d, i) =>
    `<div style="flex:none;width:${cellW + 28}px;text-align:center">
      <div class="marquito" style="padding:12px;box-shadow:0 16px 38px rgba(23,23,27,.13)">
        <img src="${d}" style="width:${cellW}px;height:${cellH}px;display:block" alt=""/>
      </div>
      <div style="font-size:21px;font-weight:500;letter-spacing:.26em;color:${HUMO};margin-top:18px">SLIDE ${desde + i}</div>
    </div>`).join('');
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'sigue el carrusel')}
    <div style="position:absolute;top:320px;height:${PIE_TOP - 320}px;left:${MX}px;right:${MX}px;
      display:flex;flex-wrap:wrap;justify-content:center;align-content:center;
      gap:${GAP - 8}px ${GAP}px">${celdas}</div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: [],
  };
}

// Sin tira (legado, solo link): botón sólido centrado — sin QR.
function paginaCarruselLink({ marca, handle, mesLabel, titulo, sub, link, folio, total }) {
  const corto = String(link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const BTN_Y = 900;
  return {
    html: `<div class="pag">
    ${cab(handle, marca)}
    ${tituloSeccion(titulo, sub, 'carrusel')}
    <div style="position:absolute;top:${BTN_Y - 200}px;left:${MX}px;right:${MX}px;text-align:center">
      <div class="cursiva" style="font-size:76px;color:${TINTA}">Listo para revisar</div>
    </div>
    <div style="position:absolute;top:${BTN_Y}px;left:${MX}px;right:${MX}px">
      <div class="boton">Ver el carrusel</div>
      <div class="nota" style="margin-top:26px">Toca el botón y se abre solo — ahí se ve el carrusel completo.</div>
      <div class="nota" style="margin-top:70px;font-size:23px">Si el botón no abre, escribe esto en tu navegador:</div>
      <div style="font-size:26px;letter-spacing:.08em;margin-top:16px;color:${TINTA};font-weight:500;
        text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(corto)}</div>
    </div>
    ${pie(mesLabel, folio, total)}
  </div>`,
    links: [{ x: MX, y: BTN_Y - 14, w: CONT_W, h: 160, url: link }],
  };
}

function paginaCierre({ marca, handle, mesLabel, folio, total }) {
  // «Aprobado» es el botón PRIMARIO (texto precargado); pedir cambios es el
  // secundario en filete. Todo el bloque de acción va JUNTO (jueces: el vacío
  // entre pregunta y botón sesgaba y desorientaba).
  const waSi = 'https://wa.me/529902046514?text=' + encodeURIComponent('Aprobado ✅');
  const waCambio = 'https://wa.me/529902046514?text=' + encodeURIComponent('Hola, quiero un cambio en: ');
  const BLOQUE_Y = 1010;
  return {
    html: `<div class="pag">
    <div class="marco"></div>
    ${cab(handle, marca)}
    <div style="position:absolute;left:${MX}px;right:${MX}px;top:19%;text-align:center">
      <div class="cursiva" style="font-size:116px;line-height:1.05">Gracias</div>
      <div style="font-size:27px;font-weight:300;letter-spacing:.03em;color:${TINTA};margin-top:60px;line-height:1.9">
        Ya viste todo el contenido del mes.<br/>¿Cómo lo dejamos?
      </div>
    </div>
    <div style="position:absolute;top:${BLOQUE_Y}px;left:${MX}px;right:${MX}px;text-align:center">
      <div class="boton">Responder &#171;Aprobado&#187;</div>
      <div style="height:28px"></div>
      <div class="boton boton--linea">Pedir un cambio</div>
      <div class="nota" style="margin-top:30px">Los dos botones abren nuestro WhatsApp con el mensaje ya escrito.</div>
      <div style="font-size:40px;font-weight:300;letter-spacing:.16em;margin-top:74px;font-variant-numeric:lining-nums tabular-nums">+52 990 204 6514</div>
      <hr class="regla" style="width:180px;margin:56px auto"/>
      <div style="font-size:21px;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:${HUMO}">
        ${esc(marca)} · ${esc(handle)}
      </div>
    </div>
    <div class="pie"><span>IVAE Estudios</span><span class="folio">${folio} / ${total}</span></div>
  </div>`,
    links: [
      { x: MX, y: BLOQUE_Y - 14, w: CONT_W, h: 158, url: waSi },
      { x: MX, y: BLOQUE_Y + 172, w: CONT_W, h: 158, url: waCambio },
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
  const deepLink = `https://ivaestudios.com/marketing/app#/entregables?cliente=${encodeURIComponent(clientId || '')}`;

  // Las tiras se cargan ANTES de armar nada: el total de páginas depende de
  // cuántos slides tenga cada carrusel (portada + continuaciones de a 4).
  paso(T('Leyendo las tiras…', 'Reading the strips…'));
  const tiras = await Promise.all(carruseles.map(async (it) => {
    if (!it.poster_url) return null;
    try { return await slidesDeTira(it.poster_url); } catch { return null; }
  }));
  const paginasDeCarrusel = (t) => (t ? 1 + Math.ceil(Math.max(0, t.slides.length - 1) / 4) : 1);
  const total = 2 + reels.length + tiras.reduce((s, t) => s + paginasDeCarrusel(t), 0);

  const paginas = [];
  const empujar = async (pg) => { paginas.push({ dataUrl: await rasterizar(pg.html), links: pg.links }); };

  paso(T('Armando la portada…', 'Building the cover…'));
  await empujar(paginaPortada({ marca, handle, mesLabel, nReels: reels.length, nCarruseles: carruseles.length, total }));

  let folio = 1;
  for (let i = 0; i < reels.length; i++) {
    const it = reels[i];
    paso(T(`Video ${i + 1} de ${reels.length}…`, `Video ${i + 1} of ${reels.length}…`));
    const img = await imagenDeReel(it);
    const pieza = it.piece || null;
    // El enlace de CADA video abre SOLO ese video (público firmado); si el
    // backend no lo dio, cae al panel de Entregables.
    const linkVideo = it.public_video_url || (it.video_url ? deepLink : null);
    await empujar(paginaReel({
      marca, handle, mesLabel,
      titulo: `Video ${i + 1}`,
      sub: (pieza && pieza.title) || it.title || '',
      imgDataUrl: img,
      deepLink: linkVideo || deepLink,
      enProduccion: !img && !linkVideo,
      folio: ++folio, total,
    }));
  }

  for (let i = 0; i < carruseles.length; i++) {
    const it = carruseles[i];
    paso(T(`Carrusel ${i + 1} de ${carruseles.length}…`, `Carousel ${i + 1} of ${carruseles.length}…`));
    const t = tiras[i];
    const base = {
      marca, handle, mesLabel,
      titulo: `Carrusel ${i + 1}`,
      sub: it.title || '',
    };
    if (!t) {
      await empujar(paginaCarruselLink({ ...base, link: it.link || deepLink, folio: ++folio, total }));
      continue;
    }
    await empujar(paginaCarruselPortada({ ...base, link: it.link || '', slides: t.slides, ratio: t.ratio, folio: ++folio, total }));
    const resto = t.slides.slice(1);
    for (let j = 0; j < resto.length; j += 4) {
      await empujar(paginaCarruselSigue({
        ...base, slides: resto.slice(j, j + 4), ratio: t.ratio,
        desde: j + 2, folio: ++folio, total,
      }));
    }
  }

  paso(T('Cerrando el documento…', 'Closing the document…'));
  await empujar(paginaCierre({ marca, handle, mesLabel, folio: total, total }));

  // Telemetría para el laboratorio de jueces (misma filosofía que __cargLayout).
  try { window.__pdfPaginas = paginas.map((p) => p.dataUrl); } catch { /* noop */ }

  const blob = pdfDesdeJpegs(
    paginas.map((p) => ({ dataUrl: p.dataUrl, w: W, h: H, links: p.links })),
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
