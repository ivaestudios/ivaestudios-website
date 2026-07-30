// ============================================================================
// IVAE Marketing — Generador de carruseles profesionales (modo "Generar").
//
// PLANTILLA "EDITORIAL MINIMAL" (ejemplos aprobados por Vianey 2026-07-29):
// @firma + marca en cursiva + fecha arriba; paginación 01\07 y chevron en
// círculo abajo; títulos en MAYÚSCULAS mezclando peso delgado 275 + NEGRITA
// 800 (sintaxis **palabra**); pastillas ovaladas para listas (separar con /).
// La foto manda: a sangre completa, velo acotado SOLO al bloque de texto.
//
// ENDURECIDO tras la auditoría enterprise (3 revisores + juez, 2026-07-29):
// presupuesto vertical medido ANTES de dibujar (nada pisa el pie ni se sale),
// descarga siempre regenera (jamás exporta una versión vieja), micro-velos
// fijos arriba/abajo para que encabezado y pie lean sobre fotos claras,
// token anti-carreras, cero fugas de memoria al borrar tarjetas, aviso de
// texto que no cabe (badge ⚠ + toast), marca que se renueva al cambiar de
// cliente, y sombras que escalan con el export 1440×1800.
// TODO EN EL NAVEGADOR: nada se sube a ningún servidor.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202607291913';
import { icon } from '../shell/icons.js?v=202607291913';
import { T } from '../shell/i18n.js?v=202607291913';
import * as store from '../shell/store.js?v=202607291913';

const W = 1080;
const H = 1350;
const MX = 96;
const MAX_SLIDES = 10;
// Export a 1440×1800 (el tope real que Instagram conserva) dibujando el MISMO
// layout de 1080×1350 escalado: más nitidez sin tocar el diseño.
const SCALE = 4 / 3;
// Zona útil vertical del bloque de texto (no pisar encabezado ni pie).
const TOP_SAFE = 230;
const BOTTOM_SAFE = H - 205;

// ── Estado ───────────────────────────────────────────────────────────────────
let slides = [];        // [{ file, bitmap, kicker, title, body, pos }]
let brandLabel = '';
let brandForClient = null;   // a qué cliente pertenece brandLabel (anti-contaminación)
let handle = '';
let ctaSupport = '';
let genToken = 0;       // invalida regeneraciones en vuelo (anti-carreras)
let previews = [];      // [{ canvas, overflow }]

let deps = null;
let hostEl = null;

export function resetGen() {
  genToken += 1;
  for (const s of slides) { try { s.bitmap && s.bitmap.close && s.bitmap.close(); } catch { /* noop */ } }
  slides = []; previews = [];
  brandLabel = ''; brandForClient = null; handle = ''; ctaSupport = '';
}

// ── Texto con **negritas** ───────────────────────────────────────────────────
function runWords(text) {
  const words = [];
  let bold = false;
  for (const piece of String(text).split('**')) {
    for (const w of piece.split(/\s+/)) { if (w) words.push({ w, b: bold }); }
    bold = !bold;
  }
  return words;
}

// Parte por caracteres una palabra más ancha que maxWidth (URLs/hashtags):
// mejor dos renglones feos que texto desbordado fuera del lienzo.
function splitWide(ctx, word, maxWidth) {
  const parts = [];
  let cur = '';
  for (const ch of word) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) { parts.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

// → { lines, overflow } — overflow=true si se tiró texto por no caber.
function wrapRuns(ctx, text, size, maxWidth, maxLines, weights) {
  const words = [];
  for (const item of runWords(text)) {
    ctx.font = `${item.b ? weights[1] : weights[0]} ${size}px Outfit, sans-serif`;
    if (ctx.measureText(item.w).width > maxWidth) {
      for (const part of splitWide(ctx, item.w, maxWidth)) words.push({ w: part, b: item.b });
    } else words.push(item);
  }
  const lines = [];
  let line = [];
  let lineW = 0;
  ctx.font = `${weights[0]} ${size}px Outfit, sans-serif`;
  const sp = ctx.measureText(' ').width;
  let overflow = false;
  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    ctx.font = `${item.b ? weights[1] : weights[0]} ${size}px Outfit, sans-serif`;
    const w = ctx.measureText(item.w).width;
    if (line.length && lineW + sp + w > maxWidth) {
      lines.push(line);
      if (lines.length === maxLines) { overflow = true; break; }
      line = [item]; lineW = w;
    } else { lineW += (line.length ? sp : 0) + w; line.push(item); }
  }
  if (lines.length < maxLines && line.length && !overflow) lines.push(line);
  return { lines, overflow };
}

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

function wrapPlain(ctx, text, size, weight, maxWidth, maxLines) {
  ctx.font = `${weight} ${size}px Outfit, sans-serif`;
  const words = [];
  for (const w of String(text).trim().split(/\s+/)) {
    if (ctx.measureText(w).width > maxWidth) words.push(...splitWide(ctx, w, maxWidth));
    else words.push(w);
  }
  const lines = [];
  let line = '';
  let overflow = false;
  for (const w of words) {
    const probe = line ? line + ' ' + w : w;
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
    else { lines.push(line); line = w; if (lines.length === maxLines) { overflow = true; break; } }
  }
  if (lines.length < maxLines && line && !overflow) lines.push(line);
  return { lines, overflow };
}

// ── Piezas fijas ─────────────────────────────────────────────────────────────
function fitCover(ctx, bmp) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  ctx.drawImage(bmp, (W - bmp.width * s) / 2, (H - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
}

// Velo ACOTADO al bloque de texto real: rampa corta arriba, pleno sobre el
// bloque, rampa corta abajo. Nunca oscurece el resto de la foto.
function scrim(ctx, yFrom, yTo, alpha) {
  const y0 = Math.max(0, yFrom - 110);
  const y1 = Math.min(H, yTo + 90);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(12,12,16,0)');
  g.addColorStop(Math.min(0.4, 140 / (y1 - y0)), `rgba(12,12,16,${alpha})`);
  g.addColorStop(1, `rgba(12,12,16,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
}

// La sombra del canvas NO escala con el transform: se compensa a mano para
// que el export 1440×1800 conserve la misma suavidad que el diseño.
function softText(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14 * SCALE;
}

function frame(ctx, idx, total) {
  // Micro-velos SIEMPRE: garantizan que @firma/marca/fecha y paginación/chevron
  // lean incluso sobre cielo o arena blanca (la sombra sola no alcanza).
  let g = ctx.createLinearGradient(0, 0, 0, 210);
  g.addColorStop(0, 'rgba(12,12,16,0.34)'); g.addColorStop(1, 'rgba(12,12,16,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 210);
  g = ctx.createLinearGradient(0, H - 230, 0, H);
  g.addColorStop(0, 'rgba(12,12,16,0)'); g.addColorStop(1, 'rgba(12,12,16,0.36)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 230, W, 230);

  ctx.save();
  softText(ctx);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '400 29px Outfit, sans-serif';
  ctx.textAlign = 'left';
  if (handle.trim()) ctx.fillText(handle.trim(), MX - 22, 132);
  const now = new Date();
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()];
  ctx.textAlign = 'right';
  ctx.fillText(`${now.getDate()} ${MES} ${now.getFullYear()}`, W - MX + 22, 132);
  if (brandLabel.trim()) {
    ctx.textAlign = 'center';
    ctx.font = 'italic 600 44px Georgia, "Times New Roman", serif';
    ctx.fillText(brandLabel.trim(), W / 2, 136);
  }
  ctx.textAlign = 'left';
  ctx.font = '400 31px Outfit, sans-serif';
  ctx.fillText(`${String(idx + 1).padStart(2, '0')}\\${String(total).padStart(2, '0')}`, MX - 22, H - 100);
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

// ── Layout medido (presupuesto vertical ANTES de dibujar) ───────────────────
function anchorY(pos) { return pos === 'top' ? 0.24 : pos === 'mid' ? 0.40 : 0.56; }

// Mide el bloque completo con un juego de tamaños; devuelve plan + altura.
function measureBlock(ctx, s, opts) {
  const { titleSize, titleLh, pillMax } = opts;
  const kicker = (s._kicker || '').trim();
  const title = (s._title || '').trim();
  const body = (s._body || '').trim();
  const support = (s._support || '').trim();
  const items = body.includes('/') ? body.split('/').map((x) => x.trim()).filter(Boolean) : null;
  let overflow = items ? items.length > pillMax : false;
  const plan = { kicker, titleLines: null, pills: null, bodyLines: null, supportLines: null, h: 0, opts };
  let h = 0;
  if (kicker) h += 34 + 6;
  if (title) {
    const r = wrapRuns(ctx, title.toUpperCase(), titleSize, W - MX * 2, 4, [275, 800]);
    plan.titleLines = r.lines; overflow = overflow || r.overflow;
    h += titleSize + (r.lines.length - 1) * titleLh + 10;
  }
  if (items) {
    plan.pills = [];
    for (const it of items.slice(0, pillMax)) {
      ctx.font = '400 40px Outfit, sans-serif';
      const r = wrapPlain(ctx, it, 40, 400, W * 0.52, 2);
      overflow = overflow || r.overflow;
      let wMax = 0;
      for (const l of r.lines) wMax = Math.max(wMax, ctx.measureText(l).width);
      const rx = Math.min(W / 2 - MX + 30, wMax / 2 + 110);
      const ry = r.lines.length > 1 ? 96 : 68;
      plan.pills.push({ lines: r.lines, rx, ry });
      h += 40 + ry * 2 - 6;
    }
  } else if (body) {
    const r = wrapRuns(ctx, body, 44, W - MX * 2 - 60, 3, [400, 700]);
    plan.bodyLines = r.lines; overflow = overflow || r.overflow;
    h += 30 + 44 + (r.lines.length - 1) * 60 + 14;
  }
  if (support) {
    const r = wrapRuns(ctx, support, 44, W - MX * 2 - 40, 2, [400, 700]);
    plan.supportLines = r.lines; overflow = overflow || r.overflow;
    h += 26 + 44 + (r.lines.length - 1) * 58 + 12;
  }
  plan.h = h;
  plan.overflow = overflow;
  return plan;
}

function drawSlide(ctx, s, idx, total) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0B0B10'; ctx.fillRect(0, 0, W, H);
  if (s.bitmap) fitCover(ctx, s.bitmap);

  const isCover = idx === 0;
  const isLast = idx === total - 1;
  s._kicker = s.kicker; s._title = s.title; s._body = s.body;
  s._support = isLast ? ctaSupport : '';

  // Presupuesto vertical: mide con el tamaño ideal y degrada si no cabe.
  const big = isCover || isLast;
  const trySizes = big
    ? [{ titleSize: 96, titleLh: 106, pillMax: 3 }, { titleSize: 80, titleLh: 90, pillMax: 3 }, { titleSize: 72, titleLh: 82, pillMax: 2 }]
    : [{ titleSize: 78, titleLh: 88, pillMax: 3 }, { titleSize: 64, titleLh: 74, pillMax: 3 }, { titleSize: 58, titleLh: 68, pillMax: 2 }];
  let plan = null;
  for (const opts of trySizes) {
    plan = measureBlock(ctx, s, opts);
    if (plan.h <= BOTTOM_SAFE - TOP_SAFE) break;
  }
  const hasText = !!(plan.kicker || plan.titleLines || plan.pills || plan.bodyLines || plan.supportLines);
  let y0 = H * anchorY(s.pos || (isCover ? 'mid' : 'top'));
  y0 = Math.max(TOP_SAFE, Math.min(y0, BOTTOM_SAFE - plan.h));

  if (hasText) scrim(ctx, y0, y0 + plan.h, plan.pills ? 0.30 : 0.38);
  frame(ctx, idx, total);
  if (!hasText) return plan.overflow;

  ctx.save();
  softText(ctx);
  ctx.textBaseline = 'alphabetic';
  const { titleSize, titleLh } = plan.opts;
  let y = y0;
  if (plan.kicker) {
    ctx.font = '400 37px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'left';
    ctx.fillText(plan.kicker.toUpperCase(), MX, y + 20);
    y += 40;
  }
  if (plan.titleLines) {
    ctx.textAlign = 'left';
    y = drawRunLines(ctx, plan.titleLines, titleSize, titleLh, [275, 800], '#FFFFFF', y + titleSize, 'left') - titleLh + 10;
  }
  if (plan.pills) {
    y += 40;
    const rots = [-0.035, 0.03, -0.025];
    const offs = [-30, 26, -20];
    for (let i = 0; i < plan.pills.length; i++) {
      const pl = plan.pills[i];
      const cy = y + pl.ry;
      oval(ctx, pl.lines, W / 2 + offs[i % 3], cy, pl.rx, pl.ry, rots[i % 3]);
      y = cy + pl.ry - 6;
    }
  } else if (plan.bodyLines) {
    y += 30;
    ctx.textAlign = 'left';
    y = drawRunLines(ctx, plan.bodyLines, 44, 60, [400, 700], 'rgba(255,255,255,0.95)', y + 14, 'left') - 60 + 14;
  }
  if (plan.supportLines) {
    y += 26;
    ctx.textAlign = 'left';
    drawRunLines(ctx, plan.supportLines, 44, 58, [400, 700], 'rgba(255,255,255,0.96)', y + 12, 'left');
  }
  ctx.restore();
  return plan.overflow;
}

// ── Render ───────────────────────────────────────────────────────────────────
async function ensureFonts() {
  try {
    await Promise.all(['275 96px', '800 96px', '400 40px', '400 29px', '700 44px']
      .map((f) => document.fonts.load(`${f} Outfit`)));
  } catch { /* respaldo del sistema */ }
}

async function regenerate(previewHost) {
  const token = ++genToken;
  await ensureFonts();
  if (token !== genToken || !previewHost) return;
  previews = [];
  clear(previewHost);
  const flagged = [];
  slides.forEach((s, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
    const c2 = canvas.getContext('2d');
    c2.imageSmoothingEnabled = true;
    c2.imageSmoothingQuality = 'high';
    c2.scale(SCALE, SCALE);
    const overflow = drawSlide(c2, s, i, slides.length);
    previews.push({ canvas, overflow });
    if (overflow) flagged.push(i + 1);
    const cell = el('div', { class: 'carg-cell' }, [
      el('div', { class: 'carg-cell__num' + (overflow ? ' carg-cell__num--warn' : ''), text: overflow ? `${i + 1} ⚠` : String(i + 1) }),
    ]);
    canvas.className = 'carg-cell__canvas';
    cell.prepend(canvas);
    previewHost.appendChild(cell);
  });
  if (flagged.length) {
    toast(T(`Ojo: el texto no cabe completo en ${flagged.length === 1 ? 'el slide' : 'los slides'} ${flagged.join(', ')} — recórtalo un poco.`, `Text does not fully fit on slide(s) ${flagged.join(', ')}.`), 'error');
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
  // La marca se rellena por CLIENTE: al cambiar de cliente se renueva (antes
  // se quedaba pegada la anterior y podías exportar con la firma equivocada).
  if (brand && brandForClient !== activeClientId) {
    brandLabel = brand.name || '';
    brandForClient = activeClientId;
  }

  const previewHost = el('div', { class: 'carg-grid' });
  let redrawTimer = 0;
  const redraw = () => regenerate(previewHost);
  // En el cel el teclado no siempre dispara blur: además del onchange, se
  // redibuja solo tras ~500ms sin teclear.
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
          // CERO pérdida útil: decodifica a 1.35× de lo que el slide usa de
          // verdad (cover-fit 1440×1800); jamás agranda una foto chica.
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
      maxlength: '110',
      oninput: (e) => { s.title = e.target.value; redrawSoon(); }, onchange: redraw,
    });
    const bodyIn = el('input', {
      class: 'input carg-card__in', type: 'text', value: s.body,
      placeholder: T('Texto — separa con / para pastillas ovaladas: Respira 4-7-8 / Escribe 5 min / Té caliente', 'Text — separate with / for oval pills'),
      maxlength: '220',
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
      // SIEMPRE regenera antes de exportar: jamás una versión vieja.
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
