// ============================================================================
// IVAE Marketing — Generador de carruseles profesionales (modo "Generar" de
// la vista Carrusel; solo staff).
//
// LA REGLA MADRE (CARRUSELES_PROFESIONALES_PLAN.md): *la foto manda, el texto
// susurra*. Cada slide es la FOTO a sangre completa (cover-fit, sin marcos ni
// fondos de color plano) con un velo de gradiente sutil solo donde hay texto.
// La plantilla es un sistema BLOQUEADO por código —misma posición de titular,
// misma tipografía (Outfit), mismos márgenes y paginación en todas las
// slides— para que cada carrusel salga "de agencia" sin decisiones nuevas.
//
// Flujo: eliges fotos (hasta 10) → escribes hook de portada + texto por
// slide (opcional; sin texto la foto va limpia) → color de acento = el de la
// marca activa → vista previa en vivo → descarga JPG por slide o ZIP.
// TODO EN EL NAVEGADOR (canvas 1080×1350, formato 4:5 de Instagram): nada se
// sube a ningún servidor y funciona igual en el cel que en la compu.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202607291808';
import { icon } from '../shell/icons.js?v=202607291808';
import { T } from '../shell/i18n.js?v=202607291808';
import * as store from '../shell/store.js?v=202607291808';

const W = 1080;
const H = 1350;                 // 4:5 — el formato que Instagram prioriza
const MARGIN = 76;              // zona segura idéntica en todas las slides
const MAX_SLIDES = 10;

// ── Estado ───────────────────────────────────────────────────────────────────
let slides = [];        // [{ file, bitmap, title, body, pos: 'auto'|'top'|'bottom' }]
let hookKicker = '';    // línea chica de la portada (ej. "GUÍA RÁPIDA")
let ctaText = '';       // cierre opcional en la última slide (ej. "Agenda tu sesión → DM")
let brandLabel = '';    // chip de marca (editable; nace del cliente activo)
let accent = '#E24DA0';
let rendering = false;
let previews = [];      // [{ canvas, blob }]

let deps = null;        // { getBrand, canvasToBlob, buildZip, download }
let hostEl = null;

export function resetGen() {
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = []; hookKicker = ''; ctaText = '';
}

// ── Composición de un slide (el "candado" de la plantilla) ───────────────────

function fitCover(ctx, bmp) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * s; const h = bmp.height * s;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
}

// Envuelve texto por ancho real medido; regresa las líneas (máx maxLines,
// con "…" si se desborda — mejor puntos suspensivos que texto encimado).
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? line + ' ' + word : word;
    if (ctx.measureText(probe).width <= maxWidth || !line) {
      line = probe;
    } else {
      lines.push(line); line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  else if (line && lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

// Velo de legibilidad: gradiente SOLO en la franja del texto, nunca en toda
// la foto (la regla: el velo protege la letra, no tapa la imagen).
function scrim(ctx, at) {
  const g = at === 'top'
    ? ctx.createLinearGradient(0, H * 0.52, 0, 0)
    : ctx.createLinearGradient(0, H * 0.48, 0, H);
  g.addColorStop(0, 'rgba(10,10,14,0)');
  g.addColorStop(0.55, 'rgba(10,10,14,0.38)');
  g.addColorStop(1, 'rgba(10,10,14,0.72)');
  ctx.fillStyle = g;
  if (at === 'top') ctx.fillRect(0, 0, W, H * 0.52);
  else ctx.fillRect(0, H * 0.48, W, H * 0.52);
}

function chip(ctx, textLeft, textRight) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 30px Outfit, sans-serif';
  ctx.textBaseline = 'top';
  if (textLeft) { ctx.textAlign = 'left'; ctx.fillText(textLeft.toUpperCase(), MARGIN, MARGIN - 6); }
  if (textRight) { ctx.textAlign = 'right'; ctx.fillText(textRight, W - MARGIN, MARGIN - 6); }
  ctx.restore();
}

// Dibuja un slide completo. idx 0 = portada (hook grande); demás = interiores.
function drawSlide(canvas, s, idx, total) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = '#0A0A0E'; ctx.fillRect(0, 0, W, H);
  if (s.bitmap) fitCover(ctx, s.bitmap);

  const isCover = idx === 0;
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const isLast = idx === total - 1;
  const cta = isLast ? ctaText.trim() : '';
  const hasText = !!(title || body || cta || (isCover && hookKicker.trim()));
  const at = s.pos === 'top' ? 'top' : 'bottom';

  if (hasText) scrim(ctx, at);
  chip(ctx, brandLabel, total > 1 ? `${idx + 1}/${total}` : '');

  if (hasText) {
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16;
    const maxW = W - MARGIN * 2;

    // Bloques de texto de ABAJO hacia arriba (o arriba hacia abajo si pos=top)
    const blocks = [];
    if (isCover && hookKicker.trim()) {
      blocks.push({ font: '700 34px Outfit, sans-serif', color: accent, lh: 46, lines: [hookKicker.trim().toUpperCase()], gap: 18, spacing: 6 });
    }
    if (title) {
      const f = isCover ? '800 92px Outfit, sans-serif' : '700 60px Outfit, sans-serif';
      ctx.font = f;
      blocks.push({ font: f, color: '#FFFFFF', lh: isCover ? 102 : 70, lines: wrapText(ctx, title, maxW, isCover ? 4 : 3), gap: 20 });
    }
    if (body) {
      ctx.font = '400 42px Outfit, sans-serif';
      blocks.push({ font: '400 42px Outfit, sans-serif', color: 'rgba(255,255,255,0.94)', lh: 56, lines: wrapText(ctx, body, maxW, 5), gap: 16 });
    }
    if (cta) {
      ctx.font = '700 44px Outfit, sans-serif';
      blocks.push({ font: '700 44px Outfit, sans-serif', color: accent, lh: 56, lines: wrapText(ctx, cta, maxW, 2), gap: 0 });
    }

    const totalH = blocks.reduce((sum, b) => sum + b.lines.length * b.lh + b.gap, 0);
    let y = at === 'top' ? MARGIN + 64 + 40 : H - MARGIN - totalH + blocks[0].lh * 0.8;
    for (const b of blocks) {
      ctx.font = b.font; ctx.fillStyle = b.color;
      if (b.spacing) { /* kicker con tracking manual */
        for (const line of b.lines) { drawTracked(ctx, line, MARGIN, y, b.spacing); y += b.lh; }
      } else {
        for (const line of b.lines) { ctx.fillText(line, MARGIN, y); y += b.lh; }
      }
      y += b.gap;
    }
    ctx.restore();
  }

  // Pista de swipe en la portada (solo si hay más slides): flecha discreta.
  if (isCover && total > 1) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const cx = W - MARGIN - 16; const cy = H - MARGIN - 18;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx - 6, cy - 14); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx - 6, cy + 14);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTracked(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
}

// ── Render de previews ───────────────────────────────────────────────────────

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('800 92px Outfit'), document.fonts.load('700 60px Outfit'),
      document.fonts.load('700 34px Outfit'), document.fonts.load('400 42px Outfit'),
      document.fonts.load('600 30px Outfit'),
    ]);
  } catch { /* la fuente del sistema es el respaldo */ }
}

async function regenerate(previewHost) {
  if (rendering) return;
  rendering = true;
  try {
    await ensureFonts();
    previews = [];
    clear(previewHost);
    slides.forEach((s, i) => {
      const canvas = document.createElement('canvas');
      drawSlide(canvas, s, i, slides.length);
      previews.push({ canvas });
      const cell = el('div', { class: 'carg-cell' }, [
        el('div', { class: 'carg-cell__num', text: String(i + 1) }),
      ]);
      canvas.className = 'carg-cell__canvas';
      cell.prepend(canvas);
      previewHost.appendChild(cell);
    });
  } finally { rendering = false; }
}

// ── UI ───────────────────────────────────────────────────────────────────────

export function renderGen(root, helpers) {
  deps = helpers;
  hostEl = root;
  const { clients, activeClientId } = store.getState();
  const brand = (clients || []).find((c) => c.id === activeClientId) || null;
  if (brand) {
    if (!brandLabel) brandLabel = brand.name || '';
    if (brand.brand_color && /^#[0-9a-f]{6}$/i.test(brand.brand_color)) accent = brand.brand_color;
  }

  const previewHost = el('div', { class: 'carg-grid' });
  const redraw = () => regenerate(previewHost);

  // ── Paso 1: fotos ──
  const fileIn = el('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      const files = [...(e.target.files || [])].slice(0, MAX_SLIDES - slides.length);
      for (const f of files) {
        try {
          const bitmap = await createImageBitmap(f);
          slides.push({ file: f, bitmap, title: '', body: '', pos: 'bottom' });
        } catch {
          toast(T(`No pude leer "${f.name}" — usa JPG o PNG (HEIC no corre en este navegador).`, `Could not read "${f.name}" — use JPG or PNG.`), { type: 'error' });
        }
      }
      e.target.value = '';
      renderGen(hostEl, deps);
    },
  });

  const slideCards = slides.map((s, i) => {
    const isCover = i === 0;
    const thumb = el('canvas', { class: 'carg-card__thumb' });
    const tctx = thumb.getContext('2d');
    thumb.width = 108; thumb.height = 135;
    const sc = Math.max(108 / s.bitmap.width, 135 / s.bitmap.height);
    tctx.drawImage(s.bitmap, (108 - s.bitmap.width * sc) / 2, (135 - s.bitmap.height * sc) / 2, s.bitmap.width * sc, s.bitmap.height * sc);

    const titleIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.title,
      placeholder: isCover ? T('HOOK de portada (grande) — ej. 5 lugares que hacen magia', 'Cover hook') : T('Título corto (opcional)', 'Short title (optional)'),
      maxlength: isCover ? '90' : '70',
      oninput: (e) => { s.title = e.target.value; },
      onchange: redraw,
    });
    const bodyIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.body,
      placeholder: isCover ? T('Línea de apoyo (opcional)', 'Support line (optional)') : T('Texto del slide (opcional — sin texto la foto va limpia)', 'Slide text (optional)'),
      maxlength: '140',
      oninput: (e) => { s.body = e.target.value; },
      onchange: redraw,
    });
    return el('div', { class: 'carg-card' }, [
      thumb,
      el('div', { class: 'carg-card__main' }, [
        el('div', { class: 'carg-card__head' }, [
          el('b', { text: isCover ? T('1 · Portada', '1 · Cover') : `${i + 1}` }),
          el('div', { class: 'carg-card__acts' }, [
            el('button', { class: 'btn btn-sm', type: 'button', title: T('Texto arriba/abajo', 'Text top/bottom'), text: s.pos === 'top' ? '↑' : '↓', onclick: (e) => { s.pos = s.pos === 'top' ? 'bottom' : 'top'; e.target.textContent = s.pos === 'top' ? '↑' : '↓'; redraw(); } }),
            i > 0 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Subir', text: '←', onclick: () => { [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]]; renderGen(hostEl, deps); } }) : null,
            i < slides.length - 1 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Bajar', text: '→', onclick: () => { [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]]; renderGen(hostEl, deps); } }) : null,
            el('button', { class: 'btn btn-sm carg-card__del', type: 'button', text: '✕', onclick: () => { slides.splice(i, 1); renderGen(hostEl, deps); } }),
          ].filter(Boolean)),
        ]),
        titleIn, bodyIn,
      ]),
    ]);
  });

  const dl = async (format) => {
    if (!previews.length) { toast(T('Primero genera la vista previa.', 'Generate the preview first.'), { type: 'error' }); return; }
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const entries = [];
    for (let i = 0; i < previews.length; i++) {
      const blob = await deps.canvasToBlob(previews[i].canvas, type, 0.95);
      entries.push({ name: `${String(i + 1).padStart(2, '0')}-carrusel.${ext}`, blob });
    }
    if (entries.length === 1) { deps.download(entries[0].blob, entries[0].name); return; }
    const zip = await deps.buildZip(entries);
    deps.download(zip, 'carrusel-ivae.zip');
    toast(T(`${entries.length} slides descargados.`, `${entries.length} slides downloaded.`), { type: 'success' });
  };

  clear(root);
  root.append(
    el('p', { class: 'car-hint', text: T(
      'Elige tus fotos, escribe el hook y el texto de cada slide, y descarga el carrusel listo para Instagram (1080×1350). La foto manda: el texto va mínimo, sobre un velo sutil, con la marca y paginación siempre en el mismo lugar.',
      'Pick your photos, write the hook and per-slide text, and download an Instagram-ready carousel (1080×1350).',
    ) }),
    el('div', { class: 'carg-controls' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => fileIn.click() }, [icon('camera', 15), ' ' + T(slides.length ? 'Agregar fotos' : 'Elegir fotos', 'Add photos')]),
      fileIn,
      el('input', { class: 'input carg-in', type: 'text', value: brandLabel, placeholder: T('Marca (chip superior)', 'Brand chip'), maxlength: '40', oninput: (e) => { brandLabel = e.target.value; }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: hookKicker, placeholder: T('Kicker de portada (ej. GUÍA RÁPIDA)', 'Cover kicker'), maxlength: '40', oninput: (e) => { hookKicker = e.target.value; }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: ctaText, placeholder: T('CTA del cierre (ej. Agenda tu sesión → DM)', 'Closing CTA'), maxlength: '90', oninput: (e) => { ctaText = e.target.value; }, onchange: redraw }),
    ]),
    slides.length ? el('div', { class: 'carg-cards' }, slideCards) : el('div', { class: 'car-empty carg-empty' }, [
      icon('camera', 28),
      el('p', { text: T('Sin fotos todavía. Elige hasta 10 — cada foto es un slide.', 'No photos yet. Pick up to 10 — each photo is one slide.') }),
    ]),
    slides.length ? el('div', { class: 'carg-actions' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => regenerate(previewHost).then(() => toast(T('Vista previa lista.', 'Preview ready.'), { type: 'success' })) }, [icon('activity', 15), ' ' + T('Generar vista previa', 'Generate preview')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('jpg') }, [icon('download', 15), ' ' + T('Descargar JPG', 'Download JPG')]),
      el('button', { class: 'btn', type: 'button', onclick: () => dl('png') }, ['PNG']),
    ]) : null,
    previewHost,
  );

  if (slides.length) regenerate(previewHost);
}
