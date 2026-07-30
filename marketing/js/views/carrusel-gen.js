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
import { el, clear, toast } from '../api.js?v=202607291928';
import { icon } from '../shell/icons.js?v=202607291928';
import { T } from '../shell/i18n.js?v=202607291928';
import * as store from '../shell/store.js?v=202607291928';

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
let genToken = 0;
let previews = [];

let deps = null;
let hostEl = null;

export function resetGen() {
  genToken += 1;
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = [];
  brandLabel = ''; brandForClient = null; handle = ''; ctaSupport = '';
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
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%;display:flex;align-items:center;justify-content:center}
.chev svg{display:block}
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
`;

const CHEV_RIGHT = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M9 5 L18 13 L9 21" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEV_DOWN = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M5 9 L13 18 L21 9" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function slideHTML(s, idx, total) {
  const isCover = idx === 0;
  const isLast = idx === total - 1;
  const kicker = (s.kicker || '').trim();
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const support = isLast ? ctaSupport.trim() : (isCover ? body : '');
  const items = !isCover && body.includes('/') ? body.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3) : null;
  const plainBody = !isCover && !items ? body : '';

  // Posición del bloque (top/mid/bottom) — % medidos de las referencias.
  const topPct = s.pos === 'top' ? 19 : s.pos === 'bottom' ? 46 : 30;
  const alignCls = !isCover && !isLast && items ? '' : '';

  const now = new Date();
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

  return `
  <div class="slide">
    <div class="scrim-top"></div>
    ${hasText ? `<div class="scrim-block" style="top:${scrimTop};bottom:0"></div>` : ''}
    <div class="scrim-bottom"></div>
    <div class="hdr">
      <span class="h">${esc(handle.trim())}</span>
      <span class="b">${esc(brandLabel.trim())}</span>
      <span class="d">${now.getDate()} ${MES} ${now.getFullYear()}</span>
    </div>
    ${hasText ? `<div class="block" style="top:${blockTop}">${inner}</div>` : ''}
    <div class="pag">${String(idx + 1).padStart(2, '0')}\\${String(total).padStart(2, '0')}</div>
    <div class="chev">${isLast ? CHEV_DOWN : CHEV_RIGHT}</div>
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
          el('div', { class: 'carg-card__acts' }, [
            el('button', { class: 'btn btn-sm', type: 'button', title: T('Altura del texto', 'Text height'), 'aria-label': T('Altura del texto', 'Text height'), text: POS_LABEL[s.pos] || '↑', onclick: (e) => { s.pos = POS_NEXT[s.pos] || 'mid'; e.target.textContent = POS_LABEL[s.pos]; redraw(); } }),
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
      const zip = await deps.buildZip(entries);
      deps.download(zip, 'carrusel-ivae.zip');
      toast(T(`${entries.length} slides descargados.`, `${entries.length} slides downloaded.`), 'success');
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
    slides.length ? el('div', { class: 'carg-cards' }, slideCards) : el('div', { class: 'car-empty carg-empty' }, [
      icon('camera', 28),
      el('p', { text: T('Sin fotos todavía. Elige hasta 10 — la primera es la portada y la última el cierre.', 'No photos yet. Pick up to 10.') }),
    ]),
    slides.length ? el('div', { class: 'carg-actions' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => regenerate(previewHost).then(() => toast(T('Vista previa lista.', 'Preview ready.'), 'success')) }, [icon('activity', 15), ' ' + T('Generar vista previa', 'Generate preview')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('jpg') }, [icon('download', 15), ' ' + T('Descargar JPG', 'Download JPG')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('png') }, ['PNG']),
    ]) : null,
    previewHost,
  );

  if (slides.length) regenerate(previewHost);
}
