// ============================================================================
// IVAE Marketing — Generador de carruseles profesionales (modo "Generar").
//
// PLANTILLA "EDITORIAL MINIMAL" — calcada de los ejemplos aprobados por
// Vianey (2026-07-29, estilo Hanover & Tyke): minimalista, moderna y limpia.
//   · Encabezado: @firma (izq) · MARCA en cursiva (centro) · fecha (der)
//   · Pie: paginación "01\07" (izq) · chevron en círculo (der; ↓ en la última)
//   · Tipografía blanca SIEMPRE: títulos en MAYÚSCULAS mezclando peso
//     delgado + NEGRITA en palabras clave (sintaxis **palabra**)
//   · Listas en PASTILLAS OVALADAS delineadas (separa los puntos con "/")
//   · La foto manda: a sangre completa, velo sutil solo bajo el texto
// El sistema está BLOQUEADO por código: mismos márgenes, mismas fuentes,
// mismas piezas en todas las slides — así todo sale "de agencia".
//
// TODO EN EL NAVEGADOR (canvas 1080×1350, 4:5): nada se sube a servidores.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202607291901';
import { icon } from '../shell/icons.js?v=202607291901';
import { T } from '../shell/i18n.js?v=202607291901';
import * as store from '../shell/store.js?v=202607291901';

const W = 1080;
const H = 1350;
const MX = 96;
const MAX_SLIDES = 10;

// ── Estado ───────────────────────────────────────────────────────────────────
let slides = [];        // [{ file, bitmap, kicker, title, body, pos }]  pos: 'top'|'mid'|'bottom'
let brandLabel = '';    // marca del centro del encabezado (cursiva)
let handle = '';        // @firma de la izquierda
let ctaSupport = '';    // línea de apoyo del último slide
let rendering = false;
let previews = [];

let deps = null;
let hostEl = null;

export function resetGen() {
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = [];
}

// ── Texto con **negritas** (envuelve midiendo cada palabra con SU peso) ─────
function runWords(text) {
  const words = [];
  let bold = false;
  for (const piece of String(text).split('**')) {
    for (const w of piece.split(/\s+/)) { if (w) words.push({ w, b: bold }); }
    bold = !bold;
  }
  return words;
}

function wrapRuns(ctx, text, size, maxWidth, maxLines, weights) {
  const words = runWords(text);
  const lines = [];
  let line = [];
  let lineW = 0;
  ctx.font = `${weights[0]} ${size}px Outfit, sans-serif`;
  const sp = ctx.measureText(' ').width;
  for (const item of words) {
    ctx.font = `${item.b ? weights[1] : weights[0]} ${size}px Outfit, sans-serif`;
    const w = ctx.measureText(item.w).width;
    if (line.length && lineW + sp + w > maxWidth) {
      lines.push(line);
      if (lines.length === maxLines) return lines;
      line = [item]; lineW = w;
    } else { lineW += (line.length ? sp : 0) + w; line.push(item); }
  }
  if (line.length) lines.push(line);
  return lines.slice(0, maxLines);
}

// align: 'left' | 'center'
function drawRunLines(ctx, lines, size, lh, weights, color, y, align) {
  ctx.fillStyle = color;
  for (const line of lines) {
    ctx.font = `${weights[0]} ${size}px Outfit, sans-serif`;
    const sp = ctx.measureText(' ').width;
    let total = 0;
    for (const it of line) { ctx.font = `${it.b ? weights[1] : weights[0]} ${size}px Outfit, sans-serif`; total += ctx.measureText(it.w).width; }
    total += sp * (line.length - 1);
    let cx = align === 'center' ? (W - total) / 2 : MX;
    for (const it of line) {
      ctx.font = `${it.b ? weights[1] : weights[0]} ${size}px Outfit, sans-serif`;
      ctx.fillText(it.w, cx, y);
      cx += ctx.measureText(it.w).width + sp;
    }
    y += lh;
  }
  return y;
}

// ── Piezas fijas ─────────────────────────────────────────────────────────────
function fitCover(ctx, bmp) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  ctx.drawImage(bmp, (W - bmp.width * s) / 2, (H - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
}

function scrim(ctx, yFrom, yTo, alpha) {
  const g = ctx.createLinearGradient(0, Math.max(0, yFrom - 110), 0, yTo);
  g.addColorStop(0, 'rgba(12,12,16,0)');
  g.addColorStop(1, `rgba(12,12,16,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, yFrom - 110), W, yTo - yFrom + 110);
}

function softText(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14;
}

function frame(ctx, idx, total) {
  ctx.save();
  softText(ctx);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  // @firma
  ctx.font = '400 29px Outfit, sans-serif';
  ctx.textAlign = 'left';
  if (handle.trim()) ctx.fillText(handle.trim(), MX - 22, 132);
  // fecha
  const now = new Date();
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()];
  ctx.textAlign = 'right';
  ctx.fillText(`${now.getDate()} ${MES} ${now.getFullYear()}`, W - MX + 22, 132);
  // marca al centro, en cursiva elegante
  if (brandLabel.trim()) {
    ctx.textAlign = 'center';
    ctx.font = 'italic 600 44px Georgia, "Times New Roman", serif';
    ctx.fillText(brandLabel.trim(), W / 2, 136);
  }
  // paginación
  ctx.textAlign = 'left';
  ctx.font = '400 31px Outfit, sans-serif';
  ctx.fillText(`${String(idx + 1).padStart(2, '0')}\\${String(total).padStart(2, '0')}`, MX - 22, H - 100);
  // chevron en círculo (→, o ↓ en la última)
  const cx = W - MX - 8; const cy = H - 112; const r = 30;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.beginPath();
  if (idx === total - 1) { ctx.moveTo(cx - 10, cy - 5); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx + 10, cy - 5); }
  else { ctx.moveTo(cx - 5, cy - 10); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx - 5, cy + 10); }
  ctx.stroke();
  ctx.restore();
}

// Pastilla ovalada delineada (la firma del estilo para las listas).
function oval(ctx, textLines, cx, cy, rx, ry, rot) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.restore();
  ctx.save();
  softText(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = '400 40px Outfit, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lh = 52;
  let y = cy - ((textLines.length - 1) * lh) / 2 + 14;
  for (const line of textLines) { ctx.fillText(line, cx, y); y += lh; }
  ctx.restore();
}

function wrapPlain(ctx, text, size, weight, maxWidth, maxLines) {
  ctx.font = `${weight} ${size}px Outfit, sans-serif`;
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line ? line + ' ' + w : w;
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
    else { lines.push(line); line = w; if (lines.length === maxLines) return lines; }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

// ── Slides ───────────────────────────────────────────────────────────────────
function anchorY(pos) { return pos === 'top' ? 0.24 : pos === 'mid' ? 0.40 : 0.56; }

function drawSlide(ctx, s, idx, total) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0B0B10'; ctx.fillRect(0, 0, W, H);
  if (s.bitmap) fitCover(ctx, s.bitmap);

  const kicker = (s.kicker || '').trim();
  const title = (s.title || '').trim();
  const body = (s.body || '').trim();
  const isLast = idx === total - 1;
  const support = isLast ? ctaSupport.trim() : '';
  const isCover = idx === 0;
  const align = isCover || isLast ? 'left' : 'left';
  const items = body.includes('/') ? body.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 3) : null;

  const aY = H * anchorY(s.pos || (isCover ? 'mid' : 'top'));
  if (kicker || title || body || support) scrim(ctx, aY, H, items ? 0.30 : 0.38);
  frame(ctx, idx, total);

  ctx.save();
  softText(ctx);
  ctx.textBaseline = 'alphabetic';
  let y = aY;

  if (kicker) {
    ctx.font = '400 37px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.fillText(kicker.toUpperCase(), align === 'center' ? W / 2 : MX, y);
    y += 34;
  }
  if (title) {
    ctx.textAlign = 'left';
    const size = isCover || isLast ? 96 : 78;
    const lh = isCover || isLast ? 106 : 88;
    const lines = wrapRuns(ctx, title.toUpperCase(), size, W - MX * 2, 4, [275, 800]);
    y = drawRunLines(ctx, lines, size, lh, [275, 800], '#FFFFFF', y + (isCover || isLast ? 96 : 80), align);
  }

  if (items) {
    // Pastillas ovaladas (máx 3), con leve rotación alternada — el toque a mano
    y += 40;
    const rots = [-0.035, 0.03, -0.025];
    const offs = [-30, 26, -20];
    for (let i = 0; i < items.length; i++) {
      ctx.font = '400 40px Outfit, sans-serif';
      const lines = wrapPlain(ctx, items[i], 40, 400, W * 0.52, 2);
      let wMax = 0;
      for (const l of lines) wMax = Math.max(wMax, ctx.measureText(l).width);
      const rx = Math.min(W / 2 - MX + 30, wMax / 2 + 110);
      const ry = lines.length > 1 ? 96 : 68;
      const cy = y + ry;
      oval(ctx, lines, W / 2 + offs[i % 3], cy, rx, ry, rots[i % 3]);
      y = cy + ry + 34;
    }
  } else if (body) {
    y += 30;
    ctx.textAlign = 'left';
    const lines = wrapRuns(ctx, body, 44, W - MX * 2 - 60, 3, [400, 700]);
    y = drawRunLines(ctx, lines, 44, 60, [400, 700], 'rgba(255,255,255,0.95)', y + 14, align);
  }
  if (support) {
    y += 26;
    ctx.textAlign = 'left';
    const lines = wrapRuns(ctx, support, 44, W - MX * 2 - 40, 2, [400, 700]);
    drawRunLines(ctx, lines, 44, 58, [400, 700], 'rgba(255,255,255,0.96)', y + 12, align);
  }
  ctx.restore();
}

// ── Render ───────────────────────────────────────────────────────────────────
async function ensureFonts() {
  try {
    await Promise.all(['275 96px', '800 96px', '400 40px', '400 29px', '700 44px']
      .map((f) => document.fonts.load(`${f} Outfit`)));
  } catch { /* respaldo del sistema */ }
}

// Se exporta a 1440×1800 (el tope real que Instagram conserva) dibujando el
// MISMO layout de 1080×1350 escalado: más nitidez sin tocar el diseño.
const SCALE = 4 / 3;

async function regenerate(previewHost) {
  if (rendering) return;
  rendering = true;
  try {
    await ensureFonts();
    previews = [];
    clear(previewHost);
    slides.forEach((s, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
      const c2 = canvas.getContext('2d');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';   // sin esto el navegador reduce en modo "rápido" y se come el detalle
      c2.scale(SCALE, SCALE);
      drawSlide(c2, s, i, slides.length);
      previews.push({ canvas });
      const cell = el('div', { class: 'carg-cell' }, [el('div', { class: 'carg-cell__num', text: String(i + 1) })]);
      canvas.className = 'carg-cell__canvas';
      cell.prepend(canvas);
      previewHost.appendChild(cell);
    });
  } finally { rendering = false; }
}

// ── UI ───────────────────────────────────────────────────────────────────────
const POS_LABEL = { top: '↑', mid: '·', bottom: '↓' };
const POS_NEXT = { top: 'mid', mid: 'bottom', bottom: 'top' };

export function renderGen(root, helpers) {
  deps = helpers;
  hostEl = root;
  const { clients, activeClientId } = store.getState();
  const brand = (clients || []).find((c) => c.id === activeClientId) || null;
  if (brand && !brandLabel) brandLabel = brand.name || '';

  const previewHost = el('div', { class: 'carg-grid' });
  const redraw = () => regenerate(previewHost);

  const fileIn = el('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      const files = [...(e.target.files || [])].slice(0, MAX_SLIDES - slides.length);
      for (const f of files) {
        try {
          // CERO pérdida útil: se calcula cuántos píxeles NECESITA el slide
          // final (cover-fit a 1440×1800, considerando el recorte) y se
          // decodifica con calidad alta a 1.35× ese tamaño — ni un píxel
          // útil menos (fotos pesadas conservan todo su detalle aprovechable)
          // y jamás se agranda (upscale) una foto chica.
          let bitmap;
          try {
            const probe = await createImageBitmap(f);
            const need = Math.max((W * SCALE) / probe.width, (H * SCALE) / probe.height);
            const k = Math.min(1, need * 1.35);
            if (k < 1) {
              bitmap = await createImageBitmap(f, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' });
              try { probe.close(); } catch { /* noop */ }
            } else { bitmap = probe; }
          } catch { bitmap = await createImageBitmap(f); }
          slides.push({ file: f, bitmap, kicker: '', title: '', body: '', pos: slides.length === 0 ? 'mid' : 'top' });
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
    const isLast = i === slides.length - 1 && slides.length > 1;
    const thumb = el('canvas', { class: 'carg-card__thumb' });
    const tctx = thumb.getContext('2d');
    thumb.width = 216; thumb.height = 270;
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    const sc = Math.max(108 / s.bitmap.width, 135 / s.bitmap.height);
    tctx.drawImage(s.bitmap, (108 - s.bitmap.width * sc) / 2, (135 - s.bitmap.height * sc) / 2, s.bitmap.width * sc, s.bitmap.height * sc);

    const kickerIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.kicker,
      placeholder: isCover ? T('Kicker (ej. ¿SIN ENERGÍA?)', 'Kicker') : T('Kicker (ej. MOOD — opcional)', 'Kicker (optional)'),
      maxlength: '40',
      oninput: (e) => { s.kicker = e.target.value; }, onchange: redraw,
    });
    const titleIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.title,
      placeholder: isCover
        ? T('HOOK — resalta con **negritas**: **Conecta** tu ánimo con el **remedio**', 'Cover hook with **bold**')
        : T('Título grande (usa **negritas** en lo clave)', 'Big title'),
      maxlength: '110',
      oninput: (e) => { s.title = e.target.value; }, onchange: redraw,
    });
    const bodyIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.body,
      placeholder: T('Texto — separa con / para pastillas ovaladas: Respira 4-7-8 / Escribe 5 min / Té caliente', 'Text — separate with / for oval pills'),
      maxlength: '220',
      oninput: (e) => { s.body = e.target.value; }, onchange: redraw,
    });
    return el('div', { class: 'carg-card' }, [
      thumb,
      el('div', { class: 'carg-card__main' }, [
        el('div', { class: 'carg-card__head' }, [
          el('b', { text: isCover ? T('1 · Portada', '1 · Cover') : isLast ? `${i + 1} · ` + T('Cierre', 'Closing') : `${i + 1}` }),
          el('div', { class: 'carg-card__acts' }, [
            el('button', { class: 'btn btn-sm', type: 'button', title: T('Altura del texto', 'Text height'), text: POS_LABEL[s.pos] || '↑', onclick: (e) => { s.pos = POS_NEXT[s.pos] || 'mid'; e.target.textContent = POS_LABEL[s.pos]; redraw(); } }),
            i > 0 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Antes', text: '←', onclick: () => { [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]]; renderGen(hostEl, deps); } }) : null,
            i < slides.length - 1 ? el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Después', text: '→', onclick: () => { [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]]; renderGen(hostEl, deps); } }) : null,
            el('button', { class: 'btn btn-sm carg-card__del', type: 'button', text: '✕', onclick: () => { slides.splice(i, 1); renderGen(hostEl, deps); } }),
          ].filter(Boolean)),
        ]),
        kickerIn, titleIn, bodyIn,
      ]),
    ]);
  });

  const dl = async (format) => {
    if (!previews.length) { toast(T('Primero genera la vista previa.', 'Generate the preview first.'), { type: 'error' }); return; }
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const entries = [];
    for (let i = 0; i < previews.length; i++) {
      const blob = await deps.canvasToBlob(previews[i].canvas, type, 0.97);
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
      'Plantilla editorial minimal: @firma + marca en cursiva + fecha arriba, paginación y chevron abajo, títulos en mayúsculas con **negritas** en lo clave, y pastillas ovaladas para listas (separa con /). Una foto por slide; el sistema arma el resto idéntico en todas.',
      'Minimal editorial template: handle + script brand + date on top, pagination and chevron below, caps titles with **bold** keywords, oval pills for lists (separate with /).',
    ) }),
    el('div', { class: 'carg-controls' }, [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => fileIn.click() }, [icon('camera', 15), ' ' + T(slides.length ? 'Agregar fotos' : 'Elegir fotos', 'Add photos')]),
      fileIn,
      el('input', { class: 'input carg-in', type: 'text', value: brandLabel, placeholder: T('Marca (centro, en cursiva)', 'Brand (center, script)'), maxlength: '36', oninput: (e) => { brandLabel = e.target.value; }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: handle, placeholder: T('@firma (izquierda)', '@handle (left)'), maxlength: '36', oninput: (e) => { handle = e.target.value; }, onchange: redraw }),
      el('input', { class: 'input carg-in', type: 'text', value: ctaSupport, placeholder: T('Apoyo del cierre (ej. Guarda este post ✦ mándanos DM)', 'Closing support'), maxlength: '90', oninput: (e) => { ctaSupport = e.target.value; }, onchange: redraw }),
    ]),
    slides.length ? el('div', { class: 'carg-cards' }, slideCards) : el('div', { class: 'car-empty carg-empty' }, [
      icon('camera', 28),
      el('p', { text: T('Sin fotos todavía. Elige hasta 10 — la primera es la portada y la última el cierre.', 'No photos yet. Pick up to 10.') }),
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
