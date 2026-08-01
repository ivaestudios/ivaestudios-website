// ============================================================================
// IVAE Marketing — Generador de carruseles profesionales v3 (modo "Generar").
//
// MOTOR HÍBRIDO (el salto de calidad que pidió Vianey — "lo mejor de lo
// mejor"): la FOTO se pinta en canvas (decode HQ, cover-fit, 1440×1800) y
// TODA la capa de diseño es HTML/CSS REAL rasterizada vía SVG foreignObject
// encima — tipografía de verdad (Outfit variable + Pinyon Script cursiva,
// tracking fino, negritas selectivas), velos con gradientes CSS, pastillas
// ovaladas elegantes y GRANO DE PELÍCULA (feTurbulence). Las proporciones
// están medidas de las plantillas de referencia que aprobó Vianey (estilo
// Hanover & Tyke: @firma + marca cursiva + fecha; paginación 01\07 +
// chevron en círculo; títulos caps delgada/negrita; óvalos para listas).
//
// TODO EN EL NAVEGADOR: nada se sube a ningún servidor.
// ============================================================================
import { el, clear, toast, api } from '../api.js?v=202608010245';
import { icon } from '../shell/icons.js?v=202608010245';
import { T } from '../shell/i18n.js?v=202608010245';
import * as store from '../shell/store.js?v=202608010245';
import { analizarCarrusel } from '../lib/fotometro.js?v=202608010245';

const W = 1080;
const H = 1350;
const MAX_SLIDES = 10;
const SCALE = 4 / 3;            // export 1440×1800 (tope real de Instagram)

// ── Estado ───────────────────────────────────────────────────────────────────
let slides = [];        // [{ file, bitmap, kicker, title, body, pos }]
let brandLabel = '';
let brandForClient = null;
let handle = '';
let ctaSupport = '';
let fechaPublicacion = '';   // AAAA-MM-DD de la pieza (no la fecha de hoy)
let brief = '';             // la línea que escribe Vianey: "promo de julio…"
let captionIA = '';         // el copy de IG que devolvió la IA
let hashtagsIA = '';
let descartes = [];         // [{i, motivo}] fotos que la IA dejó fuera
let pensando = false;       // hay una llamada a la IA en curso
let iaToken = 0;            // token PROPIO de la IA (ver escribirConIA)
let genToken = 0;
let previews = [];

let deps = null;
let hostEl = null;

export function resetGen() {
  genToken += 1;
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = [];
  brandLabel = ''; brandForClient = null; handle = ''; ctaSupport = ''; fechaPublicacion = '';
  brief = ''; captionIA = ''; hashtagsIA = ''; descartes = []; pensando = false;
}

// ── Fuentes embebidas para el SVG (foreignObject no ve URLs externas) ────────
let fontCssPromise = null;
function designFonts() {
  if (fontCssPromise) return fontCssPromise;
  const b64 = async (path) => {
    const buf = await (await fetch(path)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  fontCssPromise = (async () => {
    const [outfit, pinyon] = await Promise.all([
      b64('/marketing/fonts/outfit-latin-var.woff2'),
      b64('/marketing/fonts/pinyon-script.woff2'),
    ]);
    return `@font-face{font-family:Outfit;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${outfit}) format('woff2')}` +
      `@font-face{font-family:'Pinyon Script';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${pinyon}) format('woff2')}`;
  })();
  return fontCssPromise;
}

// ── HTML del diseño (proporciones medidas de las plantillas de referencia) ──
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s) => esc(s).split('**').map((part, i) => (i % 2 ? `<b>${part}</b>` : part)).join('');

const DESIGN_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
.slide{position:relative;width:1080px;height:1350px;font-family:Outfit,sans-serif;color:#fff;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.scrim-top{position:absolute;top:0;left:0;right:0;height:230px;background:linear-gradient(rgba(12,12,16,.34),rgba(12,12,16,0))}
.scrim-block{position:absolute;left:0;right:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.42) 26%,rgba(12,12,16,.42))}
.scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:240px;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.38))}
.hdr{position:absolute;top:88px;left:104px;right:104px;display:flex;justify-content:space-between;align-items:baseline;text-shadow:0 1px 14px rgba(0,0,0,.45)}
.hdr .h,.hdr .d{font-size:28px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.96)}
.hdr .b{font-family:'Pinyon Script',cursive;font-size:54px;line-height:1;transform:translateY(6px);color:#fff}
.pag{position:absolute;left:104px;bottom:96px;font-size:30px;font-weight:400;letter-spacing:.08em;color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%}
.chev i{position:absolute;top:50%;left:50%;width:16px;height:16px;border-top:2.5px solid rgba(255,255,255,.92);border-right:2.5px solid rgba(255,255,255,.92);transform:translate(-62%,-50%) rotate(45deg)}
.chev.down i{transform:translate(-50%,-64%) rotate(135deg)}
.block{position:absolute;left:104px;right:104px;display:flex;flex-direction:column}
.kicker{font-size:36px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.96);margin-bottom:26px;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.title{font-size:99px;font-weight:275;line-height:1.07;text-transform:uppercase;letter-spacing:.004em;text-shadow:0 2px 20px rgba(0,0,0,.4);text-wrap:balance}
.title b{font-weight:800}
.title.sm{font-size:82px}
.support{font-size:42px;font-weight:400;line-height:1.4;color:rgba(255,255,255,.95);margin-top:44px;max-width:82%;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.support b{font-weight:700}
.pills{display:flex;flex-direction:column;align-items:center;gap:44px;margin-top:64px}
.pill{border:1.6px solid rgba(255,255,255,.82);border-radius:50%;padding:34px 78px;font-size:39px;font-weight:400;line-height:1.3;text-align:center;max-width:760px;color:rgba(255,255,255,.98);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pill:nth-child(1){transform:rotate(-1.6deg) translateX(-26px)}
.pill:nth-child(2){transform:rotate(1.3deg) translateX(22px)}
.pill:nth-child(3){transform:rotate(-1.1deg) translateX(-16px)}
.right{text-align:right;align-items:flex-end}
.center{text-align:center;align-items:center}

/* ── TRATAMIENTOS DEL TEXTO (los elige el fotómetro, no el usuario) ────────
   El velo dejó de ser fijo: su opacidad la calcula fotometro.js para CADA
   foto y CADA zona, buscando el MÍNIMO que garantice contraste WCAG 7:1.
   Fondo oscuro → casi sin velo (la foto respira). Fondo muy claro → el blanco
   no gana ni con velo, así que se invierte a texto oscuro. Y si además hay
   mucho detalle (comida sobre mantel blanco, azulejo), banda sólida: se ve
   intencional, mientras que un velo gris se ve mal hecho. */
/* OJO: este bloque toca SOLO el bloque de texto (kicker/título/apoyo/píldoras).
   El encabezado y el pie tienen su propia medición y sus propias clases
   (.hdr-* y .pie-*) porque viven en otra zona de la foto — si se listaran aquí
   ganarían por especificidad y dejarían la paginación invisible sobre un fondo
   oscuro, que fue exactamente el defecto que destapó la prueba visual. */
.slide.t-oscuro .block{color:#18181E}
.slide.t-oscuro .kicker,.slide.t-oscuro .support{color:rgba(24,24,30,.92)}
.slide.t-oscuro .pill{color:#18181E;border-color:rgba(24,24,30,.55)}
/* Sobre claro la sombra oscura ensucia: se cambia por un halo claro sutil. */
.slide.t-oscuro .title,.slide.t-oscuro .kicker,.slide.t-oscuro .support{text-shadow:0 1px 10px rgba(255,255,255,.55)}
.veil-claro{background:linear-gradient(rgba(247,247,245,0),rgba(247,247,245,var(--va)) 26%,rgba(247,247,245,var(--va)))}

/* Encabezado y pie con su PROPIO color: en una foto con pared blanca arriba y
   mesa negra abajo, el título va oscuro pero la paginación tiene que ir clara.
   Medir una sola zona dejaba la paginación invisible. */
.hdr-oscuro .hdr .h,.hdr-oscuro .hdr .d{color:rgba(24,24,30,.9)}
.hdr-oscuro .hdr .b{color:#18181E}
.hdr-oscuro .hdr{text-shadow:0 1px 10px rgba(255,255,255,.55)}
.hdr-claro .hdr .h,.hdr-claro .hdr .d{color:rgba(255,255,255,.96)}
.hdr-claro .hdr .b{color:#fff}
.hdr-claro .hdr{text-shadow:0 1px 14px rgba(0,0,0,.45)}
.pie-oscuro .pag{color:rgba(24,24,30,.92);text-shadow:0 1px 10px rgba(255,255,255,.5)}
.pie-oscuro .chev{border-color:rgba(24,24,30,.7)}
.pie-oscuro .chev i{border-top-color:rgba(24,24,30,.7);border-right-color:rgba(24,24,30,.7)}
.pie-claro .pag{color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pie-claro .chev{border-color:rgba(255,255,255,.92)}
.pie-claro .chev i{border-top-color:rgba(255,255,255,.92);border-right-color:rgba(255,255,255,.92)}

/* Banda sólida: el último recurso, resuelto con elegancia editorial. */
.banda{position:absolute;left:0;right:0;background:#0C0C10}
.banda.clara{background:#F7F7F5}
.slide.t-banda .block{color:#fff}
`;



function slideHTML(s, idx, total) {
  const isCover = idx === 0;
  const isLast = idx === total - 1;
  const kicker = (s.kicker || '').trim();
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const support = isLast ? ctaSupport.trim() : (isCover ? body : '');
  const items = !isCover && body.includes('/') ? body.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3) : null;
  const plainBody = !isCover && !items ? body : '';

  // Posición y tratamiento: los decide el FOTÓMETRO salvo que el usuario haya
  // tocado el botón de altura (entonces manda él y el sistema se calla).
  const plan = s.plan || null;
  const pos = s.posManual || (plan && plan.pos) || s.pos || 'mid';
  const topPct = pos === 'top' ? 19 : pos === 'bottom' ? 46 : 30;
  const modo = (plan && plan.modo) || 'blanco';
  const veloA = plan ? plan.velo : 0.42;   // 0.42 era el valor FIJO de antes
  const claseModo = (modo === 'oscuro' ? ' t-oscuro' : modo === 'banda' ? ' t-banda' : '')
    + (plan ? (plan.modoHeader === 'oscuro' ? ' hdr-oscuro' : ' hdr-claro') : '')
    + (plan ? (plan.modoPie === 'oscuro' ? ' pie-oscuro' : ' pie-claro') : '');

  // FECHA: la de PUBLICACIÓN de la pieza, no la del día en que se arma el
  // carrusel. Antes, preparar el martes el post del viernes imprimía "martes".
  const fechaISO = (typeof fechaPublicacion === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaPublicacion))
    ? fechaPublicacion : null;
  const now = fechaISO ? new Date(fechaISO + 'T12:00:00') : new Date();
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()];

  let inner = '';
  if (kicker) inner += `<div class="kicker">${esc(kicker)}</div>`;
  if (title) inner += `<div class="title${title.replace(/\*\*/g, '').length > 46 ? ' sm' : ''}">${rich(title)}</div>`;
  if (items) inner += `<div class="pills">${items.map((it) => `<div class="pill">${esc(it)}</div>`).join('')}</div>`;
  if (plainBody) inner += `<div class="support">${rich(plainBody)}</div>`;
  if (support) inner += `<div class="support">${rich(support)}</div>`;

  const hasText = !!inner;
  const blockTop = `${topPct}%`;
  const scrimTop = `${Math.max(0, topPct - 7)}%`;

  // El velo ya NO es fijo: `--va` lleva la opacidad que calculó el fotómetro.
  // En modo banda se pinta un bloque sólido en lugar del degradado.
  const veloHTML = !hasText ? ''
    : modo === 'banda'
      ? `<div class="banda" style="top:${scrimTop};bottom:0"></div>`
      : modo === 'oscuro'
        ? `<div class="scrim-block veil-claro" style="top:${scrimTop};bottom:0;--va:${veloA}"></div>`
        : `<div class="scrim-block" style="top:${scrimTop};bottom:0;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,${veloA}) 26%,rgba(12,12,16,${veloA}))"></div>`;

  return `
  <div class="slide${claseModo}">
    ${modo === 'oscuro' ? '' : '<div class="scrim-top"></div>'}
    ${veloHTML}
    ${modo === 'oscuro' ? '' : '<div class="scrim-bottom"></div>'}
    <div class="hdr">
      <span class="h">${esc(handle.trim())}</span>
      <span class="b">${esc(brandLabel.trim())}</span>
      <span class="d">${now.getDate()} ${MES} ${now.getFullYear()}</span>
    </div>
    ${hasText ? `<div class="block" style="top:${blockTop}">${inner}</div>` : ''}
    <div class="pag">${String(idx + 1).padStart(2, '0')}\\${String(total).padStart(2, '0')}</div>
    <div class="chev${isLast ? ' down' : ''}"><i></i></div>
  </div>`;
}

// Rasteriza la capa de diseño (HTML→SVG→imagen) a 2× para nitidez del export.
async function designLayer(s, idx, total) {
  const fonts = await designFonts();
  const html = slideHTML(s, idx, total);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">` +
    `<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.35 0.35 0.35 0 0"/></filter></defs>` +
    `<style>${fonts}${DESIGN_CSS}</style>` +
    `<foreignObject width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject>` +
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.055"/></svg>`;
  const img = new Image();
  img.decoding = 'async';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('design layer failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  return img;
}

// ── Foto (canvas, calidad máxima) ────────────────────────────────────────────
function fitCover(ctx, bmp) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  ctx.drawImage(bmp, (W - bmp.width * s) / 2, (H - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
}

// ── El fotómetro: la app mira las fotos antes de escribir una letra ─────────
// Determinista, ~10 ms por foto, sin red y sin costo. Respeta la decisión
// manual: si el usuario tocó el botón de altura, ese slide queda como él dijo.
function analizarTodo() {
  try {
    const planes = analizarCarrusel(slides.map((s) => s.bitmap));
    slides.forEach((s, i) => {
      s.plan = planes[i] || null;
      if (!s.posManual && s.plan) s.pos = s.plan.pos;
    });
  } catch (e) {
    console.error('[carrusel-gen] fotómetro', e);
    for (const s of slides) s.plan = null;  // se cae con gracia al modo de antes
  }
}

// ── LA IA ESCRIBE (fase 2) ───────────────────────────────────────────────────
// Se le mandan MINIATURAS (512 px de lado largo, ~60 KB), nunca las fotos
// originales: la calidad del export no depende de esto y así el envío es rápido
// y barato. Junto con cada una viaja lo que el fotómetro YA midió, para que el
// copy se escriba sabiendo cuánto espacio hay de verdad.
async function miniatura(bmp) {
  const lado = 512;
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(bmp, 0, 0, w, h);
  const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/jpeg', quality: 0.72 })
    : await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.72));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function escribirConIA() {
  if (pensando || !slides.length) return;
  pensando = true;
  renderGen(hostEl, deps);
  // Token PROPIO, no genToken: ese lo incrementa cada redibujo de la vista
  // previa, así que si la usuaria tecleaba algo mientras la IA pensaba, el
  // resultado llegaba tarde y se descartaba en silencio tras 60 s de espera.
  const token = ++iaToken;
  try {
    const fotos = await Promise.all(slides.map(async (s) => ({
      b64: await miniatura(s.bitmap),
      mime: 'image/jpeg',
      plan: s.plan ? { pos: s.plan.pos, modo: s.plan.modo, semaforo: s.plan.semaforo, aviso: s.plan.aviso } : null,
    })));
    if (token !== iaToken) return;
    const { activeClientId } = store.getState();
    const out = await api.post('/carousel/guion', {
      brief, marca: brandLabel, nSlides: slides.length, client_id: activeClientId, fotos,
    }, { timeout: 180000 });  // mirar 8 fotos y escribir tarda ~40-120 s
    if (token !== iaToken) return;

    // Reordenar las fotos como las curó la IA (y soltar las descartadas).
    const orden = (out.orden || []).filter((i) => slides[i]);
    if (orden.length >= 2) {
      const fuera = slides.filter((_, i) => !orden.includes(i));
      slides = orden.map((i) => slides[i]);
      for (const s of fuera) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
    }
    (out.slides || []).forEach((t, i) => {
      if (!slides[i]) return;
      slides[i].kicker = t.kicker || '';
      slides[i].title = t.title || '';
      slides[i].body = t.body || '';
      slides[i].alt = t.alt || '';
    });
    captionIA = out.caption || '';
    hashtagsIA = out.hashtags || '';
    descartes = out.descartadas || [];
    // Las fotos cambiaron de orden: hay que volver a medir (y a cuidar el ritmo).
    analizarTodo();
    toast(T('Carrusel escrito. Revísalo y edita lo que quieras.', 'Carousel written. Review and edit.'), 'success');
  } catch (e) {
    const msg = (e && e.message) || T('No se pudo escribir el carrusel.', 'Could not write the carousel.');
    toast(msg, 'error');
  } finally {
    pensando = false;
    renderGen(hostEl, deps);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
async function regenerate(previewHost) {
  const token = ++genToken;
  if (!previewHost) return;
  try {
    await designFonts();
    if (token !== genToken) return;
    const layers = await Promise.all(slides.map((s, i) => designLayer(s, i, slides.length)));
    if (token !== genToken) return;
    previews = [];
    clear(previewHost);
    slides.forEach((s, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
      const c2 = canvas.getContext('2d');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.scale(SCALE, SCALE);
      c2.fillStyle = '#0B0B10'; c2.fillRect(0, 0, W, H);
      if (s.bitmap) fitCover(c2, s.bitmap);
      c2.drawImage(layers[i], 0, 0, W, H);
      previews.push({ canvas });
      const cell = el('div', { class: 'carg-cell' }, [el('div', { class: 'carg-cell__num', text: String(i + 1) })]);
      canvas.className = 'carg-cell__canvas';
      cell.prepend(canvas);
      previewHost.appendChild(cell);
    });
  } catch (e) {
    console.error('[carrusel-gen] render', e);
    toast(T('No se pudo generar la vista previa. Intenta de nuevo.', 'Preview failed. Try again.'), 'error');
  }
}

// ── UI ───────────────────────────────────────────────────────────────────────
const POS_LABEL = { top: '↑', mid: '·', bottom: '↓' };
const POS_NEXT = { top: 'mid', mid: 'bottom', bottom: 'top' };

export function renderGen(root, helpers) {
  deps = helpers;
  hostEl = root;
  const { clients, activeClientId } = store.getState();
  const brand = (clients || []).find((c) => c.id === activeClientId) || null;
  if (brand && brandForClient !== activeClientId) {
    brandLabel = brand.name || '';
    brandForClient = activeClientId;
  }

  const previewHost = el('div', { class: 'carg-grid' });
  let redrawTimer = 0;
  const redraw = () => regenerate(previewHost);
  const redrawSoon = () => { clearTimeout(redrawTimer); redrawTimer = setTimeout(redraw, 500); };

  const fileIn = el('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      const all = [...(e.target.files || [])];
      const files = all.slice(0, MAX_SLIDES - slides.length);
      if (all.length > files.length) {
        toast(T(`Máximo ${MAX_SLIDES} fotos: se tomaron las primeras ${files.length}.`, `Max ${MAX_SLIDES} photos.`), 'error');
      }
      for (const f of files) {
        try {
          let bitmap;
          const probe = await createImageBitmap(f);
          try {
            const need = Math.max((W * SCALE) / probe.width, (H * SCALE) / probe.height);
            const k = Math.min(1, need * 1.35);
            if (k < 1) {
              bitmap = await createImageBitmap(f, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' });
              try { probe.close(); } catch { /* noop */ }
            } else { bitmap = probe; }
          } catch { bitmap = probe; }
          slides.push({ file: f, bitmap, kicker: '', title: '', body: '', pos: slides.length === 0 ? 'mid' : 'top' });
        } catch {
          toast(T(`No pude leer "${f.name}" — usa JPG o PNG (HEIC no corre en este navegador).`, `Could not read "${f.name}" — use JPG or PNG.`), 'error');
        }
      }
      e.target.value = '';
      analizarTodo();          // el fotómetro decide posición y tratamiento
      renderGen(hostEl, deps);
    },
  });

  const slideCards = slides.map((s, i) => {
    const isCover = i === 0;
    const isLast = i === slides.length - 1 && slides.length > 1;
    const thumb = el('canvas', { class: 'carg-card__thumb' });
    const tctx = thumb.getContext('2d');
    thumb.width = 216; thumb.height = 270;
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    const sc = Math.max(216 / s.bitmap.width, 270 / s.bitmap.height);
    tctx.drawImage(s.bitmap, (216 - s.bitmap.width * sc) / 2, (270 - s.bitmap.height * sc) / 2, s.bitmap.width * sc, s.bitmap.height * sc);

    const kickerIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.kicker,
      placeholder: isCover ? T('Kicker (ej. ¿SIN ENERGÍA?)', 'Kicker') : T('Kicker (ej. MOOD — opcional)', 'Kicker (optional)'),
      maxlength: '40',
      oninput: (e) => { s.kicker = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    const titleIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.title,
      placeholder: isCover
        ? T('HOOK — resalta con **negritas**: **Conecta** tu ánimo con el **remedio**', 'Cover hook with **bold**')
        : T('Título grande (usa **negritas** en lo clave)', 'Big title'),
      maxlength: '90',
      oninput: (e) => { s.title = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    const bodyIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.body,
      placeholder: isCover ? T('Línea de apoyo (opcional)', 'Support line') : T('Texto — separa con / para pastillas ovaladas: Respira 4-7-8 / Escribe 5 min / Té caliente', 'Text — "/" for oval pills'),
      maxlength: '200',
      oninput: (e) => { s.body = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    return el('div', { class: 'carg-card' }, [
      thumb,
      el('div', { class: 'carg-card__main' }, [
        el('div', { class: 'carg-card__head' }, [
          el('b', { text: isCover ? T('1 · Portada', '1 · Cover') : isLast ? `${i + 1} · ` + T('Cierre', 'Closing') : `${i + 1}` }),
          // Semáforo del fotómetro: verde = medido y aprobado; ámbar = revísalo.
          s.plan ? el('span', {
            class: 'carg-sem carg-sem--' + s.plan.semaforo,
            title: s.plan.aviso || `${T('Contraste', 'Contrast')} ${s.plan.contraste}:1 · ${
              s.plan.modo === 'oscuro' ? T('texto oscuro', 'dark text') : s.plan.modo === 'banda' ? T('banda sólida', 'solid band') : T('texto blanco', 'white text')
            }${s.plan.velo ? ` · ${T('velo', 'veil')} ${Math.round(s.plan.velo * 100)}%` : ` · ${T('sin velo', 'no veil')}`}`,
            text: s.plan.semaforo === 'verde' ? '●' : '▲',
          }) : null,
          el('div', { class: 'carg-card__acts' }, [
            el('button', {
              class: 'btn btn-sm' + (s.posManual ? ' is-manual' : ''), type: 'button',
              title: s.posManual ? T('Altura fijada por ti — toca 3 veces para volver a automático', 'Height set by you') : T('Altura automática (la eligió la app)', 'Automatic height'),
              'aria-label': T('Altura del texto', 'Text height'),
              text: POS_LABEL[s.pos] || '↑',
              onclick: (e) => {
                // Ciclo: auto → top → mid → bottom → auto. El usuario SIEMPRE
                // puede volver a dejarlo en manos del fotómetro.
                if (!s.posManual) { s.posManual = POS_NEXT[s.pos] || 'mid'; }
                else if (s.posManual === 'bottom') { s.posManual = null; s.pos = (s.plan && s.plan.pos) || 'mid'; }
                else { s.posManual = POS_NEXT[s.posManual]; }
                if (s.posManual) s.pos = s.posManual;
                e.target.textContent = POS_LABEL[s.pos];
                e.target.classList.toggle('is-manual', !!s.posManual);
                redraw();
              },
            }),
            // OTRA OPCIÓN: recorre las composiciones que el fotómetro ya midió
            // y validó para ESTA foto. No es aleatorio: son las alternativas
            // legibles, ordenadas por calidad. Instantáneo, sin llamadas.
            (s.plan && (s.plan.opciones || []).length > 1) ? el('button', {
              class: 'btn btn-sm', type: 'button', title: T('Otra composición para esta foto', 'Another composition'),
              'aria-label': T('Otra opción', 'Another option'), text: '⟳',
              onclick: () => {
                const ops = s.plan.opciones.filter((o) => o.contraste >= 3);
                if (ops.length < 2) { toast(T('Esta foto solo admite una composición legible.', 'Only one legible composition here.'), 'info'); return; }
                s.opIdx = ((s.opIdx || 0) + 1) % ops.length;
                const o = ops[s.opIdx];
                s.plan = { ...s.plan, pos: o.pos, modo: o.modo, velo: o.velo, contraste: Number(o.contraste.toFixed(1)) };
                s.posManual = null;   // vuelve a mandar el fotómetro
                s.pos = o.pos;
                renderGen(hostEl, deps);
              },
            }) : null,
            i > 0 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': T('Mover antes', 'Move earlier'), text: '←', onclick: () => { [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]]; renderGen(hostEl, deps); } }) : null,
            i < slides.length - 1 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': T('Mover después', 'Move later'), text: '→', onclick: () => { [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]]; renderGen(hostEl, deps); } }) : null,
            el('button', { class: 'btn btn-sm carg-card__del', type: 'button', 'aria-label': T('Quitar slide', 'Remove slide'), text: '✕', onclick: () => {
              const [gone] = slides.splice(i, 1);
              try { gone && gone.bitmap && gone.bitmap.close && gone.bitmap.close(); } catch { /* noop */ }
              renderGen(hostEl, deps);
            } }),
          ].filter(Boolean)),
        ]),
        kickerIn, titleIn, bodyIn,
      ]),
    ]);
  });

  const dl = async (format) => {
    if (!slides.length) return;
    try {
      await regenerate(previewHost);
      const list = previews.slice();
      const type = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';
      const entries = [];
      for (let i = 0; i < list.length; i++) {
        const blob = await deps.canvasToBlob(list[i].canvas, type, 0.97);
        if (!blob) throw new Error('canvasToBlob null');
        entries.push({ name: `${String(i + 1).padStart(2, '0')}-carrusel.${ext}`, blob });
      }
      if (entries.length === 1) { deps.download(entries[0].blob, entries[0].name); return; }

      // El ZIP lleva TODO lo del carrusel, no solo las imágenes: el caption
      // listo para pegar, los hashtags y el texto alternativo de cada slide
      // (accesibilidad + SEO). Así no hay que volver a la app a copiar nada.
      const partes = [];
      if (captionIA) partes.push('CAPTION PARA INSTAGRAM\n' + '='.repeat(40) + '\n' + captionIA);
      if (hashtagsIA) partes.push('HASHTAGS\n' + '='.repeat(40) + '\n' + hashtagsIA);
      const alts = slides.map((sl, i) => (sl.alt ? `${String(i + 1).padStart(2, '0')}: ${sl.alt}` : null)).filter(Boolean);
      if (alts.length) partes.push('TEXTO ALTERNATIVO POR SLIDE (accesibilidad y SEO)\n' + '='.repeat(40) + '\n' + alts.join('\n'));
      if (partes.length) {
        entries.push({
          name: 'caption-y-textos.txt',
          blob: new Blob([partes.join('\n\n\n')], { type: 'text/plain;charset=utf-8' }),
        });
      }

      const zip = await deps.buildZip(entries);
      const marcaSlug = (brandLabel || 'ivae').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ivae';
      deps.download(zip, `carrusel-${marcaSlug}.zip`);
      toast(T(`${list.length} slides descargados${partes.length ? ' + caption y textos' : ''}.`, `${list.length} slides downloaded.`), 'success');
    } catch (e) {
      console.error('[carrusel-gen] export', e);
      toast(T('No se pudo exportar. Intenta de nuevo.', 'Export failed. Try again.'), 'error');
    }
  };

  clear(root);
  root.append(
    el('p', { class: 'car-hint', text: T(
      'Plantilla editorial minimal: @firma + marca en cursiva + fecha arriba, paginación y chevron abajo, títulos en mayúsculas con **negritas** en lo clave, y pastillas ovaladas para listas (separa con /). Una foto por slide; el sistema arma el resto idéntico en todas.',
      'Minimal editorial template: handle + script brand + date on top, pagination and chevron below, caps titles with **bold** keywords, oval pills for lists (separate with /).',
    ) }),
    el('div', { class: 'carg-controls' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        if (slides.length >= MAX_SLIDES) { toast(T(`Ya tienes las ${MAX_SLIDES} fotos del máximo.`, `Already at the ${MAX_SLIDES}-photo max.`), 'error'); return; }
        fileIn.click();
      } }, [icon('camera', 15), ' ' + T(slides.length ? 'Agregar fotos' : 'Elegir fotos', 'Add photos')]),
      fileIn,
      el('input', { class: 'input carg-in', type: 'text', value: brandLabel, placeholder: T('Marca (centro, en cursiva)', 'Brand (center, script)'), maxlength: '36', oninput: (e) => { brandLabel = e.target.value; redrawSoon(); }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: handle, placeholder: T('@firma (izquierda)', '@handle (left)'), maxlength: '36', oninput: (e) => { handle = e.target.value; redrawSoon(); }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: ctaSupport, placeholder: T('Apoyo del cierre (ej. Guarda este post ✦ mándanos DM)', 'Closing support'), maxlength: '90', oninput: (e) => { ctaSupport = e.target.value; redrawSoon(); }, onchange: redraw }),
    ]),

    // ── LA IA ESCRIBE ────────────────────────────────────────────────────────
    // Una línea de brief y un botón. La app ya midió las fotos; aquí la IA cura,
    // ordena y escribe todo. Lo que devuelve es un BORRADOR: cada campo sigue
    // siendo editable y la vista previa se actualiza al instante, como siempre.
    slides.length ? el('div', { class: 'carg-ia' }, [
      el('input', {
        class: 'input carg-ia__brief', type: 'text', value: brief, maxlength: '200',
        placeholder: T('¿De qué va el carrusel? Ej: promo de limpieza dental de julio', 'What is the carousel about?'),
        oninput: (e) => { brief = e.target.value; },
        onkeydown: (e) => { if (e.key === 'Enter') escribirConIA(); },
      }),
      el('button', {
        class: 'btn btn-primary carg-ia__go', type: 'button', disabled: pensando || undefined,
        onclick: escribirConIA,
      }, pensando
        ? [el('span', { class: 'carg-ia__spin' }), ' ' + T('Escribiendo…', 'Writing…')]
        : [icon('sparkles', 15), ' ' + T('Escribir con IA', 'Write with AI')]),
      el('span', { class: 'carg-ia__note', text: T(
        'La IA elige las mejores fotos, las ordena como historia y escribe los textos y el caption. Todo editable.',
        'The AI picks the best photos, orders them and writes the copy. All editable.') }),
    ]) : null,

    // Qué fotos dejó fuera y por qué (transparencia: nunca borra en silencio).
    descartes.length ? el('div', { class: 'carg-descartes' }, [
      el('b', { text: T('Fotos que dejé fuera:', 'Photos left out:') }),
      el('ul', {}, descartes.map((d) => el('li', { text: `${T('Foto', 'Photo')} ${Number(d.i) + 1}: ${d.motivo}` }))),
    ]) : null,
    slides.length ? el('div', { class: 'carg-cards' }, slideCards) : el('div', { class: 'car-empty carg-empty' }, [
      icon('camera', 28),
      el('p', { text: T('Sin fotos todavía. Elige hasta 10 — la primera es la portada y la última el cierre.', 'No photos yet. Pick up to 10.') }),
    ]),
    // El caption de Instagram que escribió la IA, listo para copiar y pegar.
    (captionIA || hashtagsIA) ? el('div', { class: 'carg-caption' }, [
      el('div', { class: 'carg-caption__head' }, [
        el('b', { text: T('Caption para Instagram', 'Instagram caption') }),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
          try { await navigator.clipboard.writeText((captionIA + (hashtagsIA ? '\n\n' + hashtagsIA : '')).trim()); toast(T('Copiado.', 'Copied.'), 'success'); }
          catch { toast(T('No se pudo copiar.', 'Copy failed.'), 'error'); }
        } }, [icon('copy', 13), ' ' + T('Copiar todo', 'Copy all')]),
      ]),
      el('textarea', {
        class: 'input carg-caption__ta', rows: '7', value: captionIA,
        oninput: (e) => { captionIA = e.target.value; },
      }),
      hashtagsIA ? el('div', { class: 'carg-caption__tags', text: hashtagsIA }) : null,
    ]) : null,

    slides.length ? el('div', { class: 'carg-actions' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => regenerate(previewHost).then(() => toast(T('Vista previa lista.', 'Preview ready.'), 'success')) }, [icon('activity', 15), ' ' + T('Generar vista previa', 'Generate preview')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('jpg') }, [icon('download', 15), ' ' + T('Descargar JPG', 'Download JPG')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('png') }, ['PNG']),
    ]) : null,
    previewHost,
  );

  if (slides.length) regenerate(previewHost);
}
