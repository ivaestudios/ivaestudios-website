// ============================================================================
// IVAE Marketing — módulo enterprise.
// Única función viva: handleMonthlyReport (reporte mensual imprimible).
// El resto del pack (IA, .ics, duplicar mes, plantillas, link mágico, email)
// se desechó a petición de Vianey el 2026-06-12.
// Módulo separado de [[path]].js; el guion bajo evita que Pages lo trate
// como ruta.
//
// REDISEÑO 2026-07 — dirección "editorial": portada a sangre con el color del
// cliente, secciones numeradas con folio impreso, y una regla rectora:
// NINGUNA CIFRA VIAJA SOLA (todo número lleva su lectura redactada debajo).
// Restricciones del runtime (Cloudflare Workers): sin Node, sin DOM, sin fs.
// Todo el color se calcula EN JS y se inyecta como hex literal — cero
// color-mix() (falla en iOS viejo) y cero webfonts/CDN.
// ============================================================================

// ── Reporte mensual del cliente (imprimible / compartible) ──────────────────
// GET /report?client_id&month=YYYY-MM              (modo mes)
// GET /report?client_id&from=YYYY-MM-DD&to=YYYY-MM-DD  (modo rango)

const REP_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const REP_MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const REP_STATUS = {
  idea: 'Idea', guion: 'Guion', grabacion: 'Grabación', edicion: 'Edición',
  revision: 'Revisión', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado',
};
const REP_STATUS_PL = {
  idea: 'Ideas', guion: 'Guiones', grabacion: 'Grabaciones', edicion: 'Ediciones',
  revision: 'Revisiones', aprobado: 'Aprobados', programado: 'Programados', publicado: 'Publicados',
};
// Orden real del pipeline (para el embudo de producción).
const REP_STATUS_ORDER = ['idea', 'guion', 'grabacion', 'edicion', 'revision',
  'aprobado', 'programado', 'publicado'];
// content_type reales del schema (001_init.sql:60).
const REP_TYPE = {
  reel: 'Reel', tiktok: 'TikTok', informativo: 'Informativo', carrusel: 'Carrusel',
  experiencia: 'Experiencia', pauta: 'Pauta', tratamientos: 'Tratamientos',
  historia: 'Historia', foto: 'Foto', otro: 'Otro',
};
const REP_TYPE_PL = {
  reel: 'reels', tiktok: 'tiktoks', informativo: 'informativos', carrusel: 'carruseles',
  experiencia: 'experiencias', pauta: 'pautas', tratamientos: 'tratamientos',
  historia: 'historias', foto: 'fotos', otro: 'otros',
};
const DOW_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Sólo http(s) y sin caracteres que puedan romper un atributo. Cualquier otra
// cosa que venga de la BD (javascript:, data:, basura) se descarta.
function safeHref(u) {
  const s = String(u == null ? '' : u).trim();
  return /^https?:\/\/[^\s"'<>`]+$/.test(s) ? s : null;
}
// Las miniaturas del CDN de Meta siempre son https.
function safeImg(u) {
  const s = String(u == null ? '' : u).trim();
  return /^https:\/\/[^\s"'<>`]+$/.test(s) ? s : null;
}

function rangeLabel(from, to) {
  const d = (s) => { const [y, mo, da] = String(s).split('-').map(Number); return { y, mo, da }; };
  const a = d(from); const b = d(to);
  const mn = (mo) => REP_MONTHS[(mo || 1) - 1];
  if (a.y === b.y && a.mo === b.mo) return `${a.da}–${b.da} ${mn(a.mo)} ${a.y}`;
  if (a.y === b.y) return `${a.da} ${mn(a.mo)} – ${b.da} ${mn(b.mo)} ${a.y}`;
  return `${a.da} ${mn(a.mo)} ${a.y} – ${b.da} ${mn(b.mo)} ${b.y}`;
}

// Slug ASCII para el folio impreso: "ODONTOLOGÍA NIÑOS & MÁS" → "ODONTOLOGIA-NINOS-MAS".
function slugUpper(s) {
  let out = String(s || 'IVAE');
  try { out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { /* sin ICU: pasa crudo */ }
  out = out.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);
  return out || 'IVAE';
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR — todo se calcula aquí y se inyecta como hex literal.
// Nada de color-mix(): la doble declaración de custom property NO hace
// fallback (la segunda gana y al fallar queda unset → barras transparentes
// en iOS 15).
// ═══════════════════════════════════════════════════════════════════════════
const REP_FALLBACK_BRAND = '#7c3aed';

function hex2rgb(hex) {
  let h = String(hex == null ? '' : hex).replace('#', '').trim();
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  else if (h.length >= 6) h = h.slice(0, 6);          // #rrggbbaa → se ignora el alfa
  else return [124, 58, 237];
  const out = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return out.some((v) => !Number.isFinite(v)) ? [124, 58, 237] : out;
}
function rgb2hex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');
}
// Luminancia relativa (WCAG 2.1).
function relLum(rgb) {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const l1 = relLum(a); const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function mixRgb(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }

// Deriva toda la paleta desde brand_color. El texto de marca se oscurece
// EN BUCLE hasta medir ≥4.5:1 sobre papel blanco: un porcentaje fijo falla
// con ámbar, amarillo, cian y lima.
function brandTokens(hex) {
  const c = hex2rgb(hex);
  const W = [255, 255, 255];
  const K = [11, 18, 32];
  // 0.179 es el umbral real donde blanco y negro empatan sobre un color.
  let ink = c; let n = 0;
  while (contrast(ink, W) < 4.5 && n++ < 40) ink = mixRgb(ink, K, 0.06);
  let deep = c; n = 0;
  while (contrast(deep, W) < 7 && n++ < 60) deep = mixRgb(deep, K, 0.06);
  const t40 = mixRgb(W, c, 0.40);
  const t72 = mixRgb(W, c, 0.72);
  // Tinta legible SOBRE cada fondo real. 0.179 es el umbral donde blanco y
  // negro empatan; cada superficie elige la suya por separado, porque el
  // color crudo, brand-deep y las tintas NO se comportan igual (ámbar: blanco
  // sobre --brand mide 2.15:1 y sobre --brand-deep 7.16:1).
  const on = (bg) => (relLum(bg) > 0.179 ? '#14141b' : '#ffffff');
  return {
    brand: rgb2hex(c),
    // --on-brand se pinta SOLO sobre brand-deep (portada y colofón).
    onBrand: on(deep),
    // --on-brand-raw se pinta sobre el color crudo (barras, chips, botón).
    onBrandRaw: on(c),
    onT40: on(t40),
    onT72: on(t72),
    brandInk: rgb2hex(ink),
    brandDeep: rgb2hex(deep),
    t06: rgb2hex(mixRgb(W, c, 0.06)),
    t14: rgb2hex(mixRgb(W, c, 0.14)),
    t40: rgb2hex(t40),
    t72: rgb2hex(t72),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NÚMEROS
// ═══════════════════════════════════════════════════════════════════════════
function nf(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  try { return v.toLocaleString('es-MX'); } catch { return String(Math.round(v)); }
}
// Nunca un 0 donde falta el dato: null ⇒ "—".
function fmtN(n) { return n == null ? '—' : nf(n); }
// Abrevia arriba de 5 dígitos para que no desborde en un teléfono de 390px.
// El separador decimal es el PUNTO, igual que toLocaleString('es-MX'): en
// México la coma separa miles, así que "1,3 M" se leería como 13.
function nfBig(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  // 999,600 redondearía a "1000 K": desde 999,500 ya es "1 M".
  if (v >= 999500) {
    const m = v / 1e6;
    return (m >= 10 ? String(Math.round(m)) : m.toFixed(1).replace(/\.0$/, '')) + ' M';
  }
  if (v >= 1e5) return String(Math.round(v / 1e3)) + ' K';
  return nf(v);
}
// Retención sub-segundo es normal en un reel que la gente saltea: redondearla
// a "0s" rompe la regla del documento (nunca un 0 donde sí hay dato).
function fmtSec(s) {
  if (s == null) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  if (v >= 60) return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`;
  if (v < 1) {
    const d = v.toFixed(1);
    return d === '0.0' ? 'menos de 1s' : `${d}s`;
  }
  return `${Math.round(v)}s`;
}
function pctOf(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
// Marca las cifras largas para que el CSS baje el cuerpo y no desborde.
function lenFlag(str) { return String(str).length >= 7 ? '6' : ''; }

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES SVG — funciones puras: reciben datos, devuelven string.
// Todos los colores salen por `class`, nunca por atributo fill: un solo bloque
// CSS reteñe el documento entero.
// REGLA DURA: menos de 4 puntos de dato ⇒ devuelven '' y el caller escribe
// el dato en texto.
// ═══════════════════════════════════════════════════════════════════════════
let _uidSeq = 0;
function uid(p) { _uidSeq = (_uidSeq + 1) % 1000000; return `${p}${_uidSeq}`; }

// ── 1 · Fondo de portada ───────────────────────────────────────────────────
// El color va como <rect> de PRIMER PLANO, no como background CSS: los fill de
// SVG son contenido y no dependen de la casilla "Gráficos de fondo" del
// diálogo de impresión.
function coverBg(ghost) {
  const g = String(ghost == null ? '' : ghost).replace(/[^0-9]/g, '').slice(0, 4);
  return `<svg class="cover__bg" viewBox="0 0 800 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect width="800" height="1000" fill="var(--brand-deep)"/></svg>
<svg class="cover__bg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${[120, 210, 300, 390].map((r) => `<circle cx="0" cy="0" r="${r}" class="son" opacity=".16"/>`).join('')}${g ? `<text class="ghost" x="792" y="985" text-anchor="end" font-size="300" font-weight="800" stroke-width="1.5" opacity=".20">${g}</text>` : ''}</svg>`;
}

// ── 2 · Heatmap-calendario de cadencia ─────────────────────────────────────
// counts = { 1: 2, 4: 1, ... } piezas por día del mes.
// OJO ZONA HORARIA: el Worker corre en UTC y las fechas son 'YYYY-MM-DD'.
// Se usa Date.UTC + getUTCDay(); con getDay() el mes entero se recorre un día.
// El heatmap SÍ conserva la cuadrícula completa aunque haya pocos datos:
// los días vacíos son información, no ruido.
function heatCalendar(year, month, counts) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const off = (first.getUTCDay() + 6) % 7;                 // lunes = 0
  const C = 92; const G = 10; const PAD = 30;   // PAD deja aire para la cabecera L-D
  const cols = 7; const rows = Math.ceil((off + days) / 7);
  const W = cols * C + (cols - 1) * G;
  const H = PAD + rows * C + (rows - 1) * G;
  const cls = (n) => (n >= 3 ? 'fb' : n === 2 ? 'fb72' : n === 1 ? 'fb40' : 'ftrk');
  let out = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    .map((d, i) => `<text class="lbl" x="${i * (C + G) + C / 2}" y="20" font-size="24" text-anchor="middle">${d}</text>`).join('');
  for (let d = 1; d <= days; d++) {
    const i = off + d - 1;
    const x = (i % 7) * (C + G);
    const y = PAD + Math.floor(i / 7) * (C + G);
    const n = counts[d] || 0;
    // Cada relleno lleva SU tinta medida: --ink-3 sobre --t-72 mide 1.00:1
    // (el número del día desaparecía en los días de 2 piezas).
    const ink = n >= 3 ? 'fonr' : n === 2 ? 'fon72' : n === 1 ? 'fon40' : 'fink2';
    out += `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="6" class="${cls(n)}"/>`
      + `<text x="${x + C / 2}" y="${y + C / 2 + 10}" font-size="28" text-anchor="middle" class="${ink}" opacity="${n ? '.9' : '.5'}">${d}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calendario de publicación del periodo">${out}</svg>`;
}

// ── 3 · Barra de composición 100% apilada (mezcla por tipo) ────────────────
// Se descarta la dona a propósito: con 9 content_type reales se vuelve confeti
// y no se lee impresa en gris. La rebanada más clara lleva TRAMA diagonal
// para sobrevivir a la impresión monocromática.
function stackBar(parts) {
  const list = (parts || []).filter((p) => p && p.value > 0);
  if (list.length < 2) return '';
  const total = list.reduce((s, p) => s + p.value, 0) || 1;
  const W = 700; const H = 34; const pid = uid('hatch');
  const ramp = ['fb', 'fb72', 'fb40', 'fb14'];
  let x = 0; let bars = '';
  list.forEach((p, i) => {
    const w = (p.value / total) * W;
    const c = ramp[Math.min(i, ramp.length - 1)];
    bars += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(w - 2, 1).toFixed(1)}" height="${H}" rx="2" class="${c}"/>`;
    if (c === 'fb14') bars += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(w - 2, 1).toFixed(1)}" height="${H}" rx="2" fill="url(#${pid})"/>`;
    // La cifra SIEMPRE escrita: la gráfica no puede depender sólo del color.
    if (w > 46) bars += `<text x="${(x + w / 2 - 1).toFixed(1)}" y="${H / 2 + 7}" font-size="19" text-anchor="middle" class="${i === 0 ? 'fonr' : i === 1 ? 'fon72' : 'fink'}">${p.value}</text>`;
    x += w;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mezcla de contenidos del periodo"><defs><pattern id="${pid}" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="3" height="8" fill="var(--ink-3)" opacity=".35"/></pattern></defs>${bars}</svg>`;
}

// ── 4 · Arco de cumplimiento ───────────────────────────────────────────────
// Semi-dona sin aguja: es un indicador, no un velocímetro.
function arcGauge(pct, big, sub) {
  const p = Math.max(0, Math.min(1, Number(pct) || 0));
  const R = 78; const CX = 100; const CY = 96; const LEN = Math.PI * R;
  const d = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  return `<svg viewBox="0 0 200 118" role="img" aria-label="${esc(big)} ${esc(sub || '')}"><path d="${d}" stroke="var(--rule)" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${d}" stroke="var(--brand)" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${LEN.toFixed(1)}" stroke-dashoffset="${(LEN * (1 - p)).toFixed(1)}"/><text x="100" y="88" text-anchor="middle" font-size="40" font-weight="800" class="fink">${esc(big)}</text>${sub ? `<text class="lbl" x="100" y="110" text-anchor="middle" font-size="12">${esc(sub)}</text>` : ''}</svg>`;
}

// ── 5 · Embudo de estados (idea → publicado) ───────────────────────────────
function funnelBar(stages) {
  const live = (stages || []).filter((s) => s && s.value > 0);
  if (live.length < 2) return '';
  const total = live.reduce((s, p) => s + p.value, 0) || 1;
  const W = 700; const H = 22;
  let x = 0; let out = ''; let labels = ''; let lastEnd = -1e9;
  live.forEach((s, i) => {
    const w = (s.value / total) * W;
    const op = (0.35 + 0.65 * (i + 1) / live.length).toFixed(2);
    out += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(w - 2, 1).toFixed(1)}" height="${H}" rx="2" class="fb" opacity="${op}"/>`;
    // La etiqueta se omite si no cabe O si chocaría con la anterior.
    // Jamás texto encimado: prefiero perder una etiqueta a entregar un borrón.
    const txt = `${s.value} ${s.word || s.label}`;
    // Mono a font-size 15 con letter-spacing .10em ≈ 10.6 unidades por carácter.
    const tw = txt.length * 10.6;
    if (w > 64 && x >= lastEnd + 12) {
      labels += `<text class="lbl" x="${x.toFixed(1)}" y="${H + 20}" font-size="15">${esc(txt)}</text>`;
      lastEnd = x + tw;
    }
    x += w;
  });
  return `<svg viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="Etapas de producción">${out}${labels}</svg>`;
}

// ── 6 · Sparkline de meses ─────────────────────────────────────────────────
// El caller DEBE descartar el bucket más antiguo: /me/media?limit=100 no pagina
// y ese mes viene truncado (dibujaría una caída falsa).
// Menos de 4 puntos ⇒ no hay gráfica.
function sparkline(vals, lastLabel) {
  const v = (vals || []).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  if (v.length < 4) return '';
  const W = 260; const H = 64; const P = 6;
  const mx = Math.max.apply(null, v);
  const mn = Math.min.apply(null, v);
  const rg = (mx - mn) || 1;
  const pts = v.map((n, i) => [
    P + (i * (W - 2 * P)) / (v.length - 1),
    H - P - ((n - mn) / rg) * (H - 2 * P),
  ]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `M${P},${H} L${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')} L${W - P},${H} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Tendencia de los últimos meses"><path d="${area}" class="fb14"/><polyline points="${line}" class="sb"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" class="fb"/>${lastLabel ? `<text class="lbl" x="${W - P}" y="${H + 12}" text-anchor="end" font-size="11">${esc(lastLabel)}</text>` : ''}</svg>`;
}

// ── 7 · Barras horizontales sobre línea base continua ──────────────────────
// Es HTML, no SVG, a propósito: se apila solo en móvil y no necesita viewBox.
// La línea base completa hace que una barra corta siga leyéndose como escala.
function barsH(rows, opts) {
  const o = opts || {};
  if (!rows || !rows.length) return '';
  // keepOrder: las dimensiones ORDINALES (rangos de edad) se leen en su orden
  // natural; ordenarlas por valor entrega "35-44, 18-24, 25-34".
  let list = o.keepOrder
    ? rows.slice()
    : rows.slice().sort((a, b) => (b.value || 0) - (a.value || 0));
  if (o.top) list = list.slice(0, o.top);
  const total = rows.reduce((s, r) => s + (r.value || 0), 0) || 1;
  const mx = Math.max.apply(null, list.map((r) => r.value || 0)) || 1;
  return `<div class="aud">${list.map((r) => {
    const pct = pctOf(r.value || 0, total);
    const w = Math.max(((r.value || 0) / mx) * 100, 1.5);
    const isTop = (r.value || 0) === mx ? '1' : '0';
    return `<div class="aud__row" data-top="${isTop}"><span class="aud__k">${esc(r.label)}</span><span class="aud__bar"><i style="width:${w.toFixed(1)}%"></i></span><span class="aud__v">${pct}%</span></div>`;
  }).join('')}</div>`;
}

// ── 8 · Columnas verticales de edad (ordinal ⇒ se lee mejor vertical) ──────
function barsV(rows) {
  const list = (rows || []).filter((r) => r && r.value != null);
  if (list.length < 4) return '';                          // regla dura
  const W = 620; const H = 190; const PB = 34; const PT = 26;
  const mx = Math.max.apply(null, list.map((r) => r.value || 0)) || 1;
  const total = list.reduce((s, r) => s + (r.value || 0), 0) || 1;
  const cw = W / list.length;
  const bw = Math.min(cw - 16, 74);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Edad de tu audiencia">${list.map((r, i) => {
    const h = ((r.value || 0) / mx) * (H - PB - PT);
    const x = i * cw + (cw - bw) / 2;
    const y = H - PB - h;
    const pct = pctOf(r.value || 0, total);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="2" class="${(r.value || 0) === mx ? 'fb' : 'fb40 ostrk'}"/><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" font-size="17" text-anchor="middle" class="fink">${pct}%</text><text class="lbl" x="${(x + bw / 2).toFixed(1)}" y="${H - 12}" font-size="14" text-anchor="middle">${esc(r.label)}</text>`;
  }).join('')}<line x1="0" y1="${H - PB + 6}" x2="${W}" y2="${H - PB + 6}" class="strk"/></svg>`;
}

// ── 9 · Barra partida de género ────────────────────────────────────────────
function splitBar(parts) {
  const list = (parts || []).filter((p) => p && p.value > 0);
  if (!list.length) return '';
  const total = list.reduce((s, p) => s + p.value, 0) || 1;
  const W = 700; const H = 40;
  let x = 0;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Género de tu audiencia">${list.map((p, i) => {
    const w = (p.value / total) * W;
    const pct = pctOf(p.value, total);
    // El valor va DENTRO si el segmento mide >18%, y afuera si no. Ese detalle
    // separa un gráfico hecho a mano de uno genérico.
    const inside = w > W * 0.18;
    const txt = `${pct}% ${p.label}`;
    // Si la etiqueta de afuera se saldría del lienzo, NO se dibuja recortada:
    // el caller siempre escribe el desglose completo en el pie de la gráfica.
    const fits = inside || (x + w + 8 + txt.length * 9.5) <= W;
    const t = fits
      ? `<text x="${(x + (inside ? w / 2 : w + 8)).toFixed(1)}" y="${H / 2 + 7}" font-size="19" text-anchor="${inside ? 'middle' : 'start'}" class="${inside && i === 0 ? 'fonr' : 'fink'}">${esc(txt)}</text>`
      : '';
    const r = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(w - 2, 1).toFixed(1)}" height="${H}" rx="2" class="${i === 0 ? 'fb' : i === 1 ? 'fb40' : 'fb14'}"/>`;
    x += w;
    return r + t;
  }).join('')}</svg>`;
}

// ── 10 · Barra de dato dentro de la celda de la tabla ──────────────────────
// La tabla se vuelve gráfica sin gastar un renglón. v == null ⇒ fantasma
// rayado "en proceso", NUNCA un 0.
function idxBar(v, max) {
  if (v == null) return '<span class="bar bar--wait" style="width:100%"></span>';
  const w = Math.max(((v || 0) / (max || 1)) * 100, 1.5);
  return `<span class="bar" style="width:${w.toFixed(1)}%"></span>`;
}

// ── 11 · Chip de delta ─────────────────────────────────────────────────────
// Sin base de comparación ⇒ "—" con nota. NUNCA 0%: un delta inventado es el
// único error del que un cliente sí se acuerda. El negativo va en gris.
function deltaChip(cur, prev, naText) {
  if (cur == null || prev == null || !prev) {
    return `<span class="delta" data-d="na">${esc(naText || '— sin comparativa')}</span>`;
  }
  const p = ((cur - prev) / prev) * 100;
  const up = p >= 0;
  const tri = up ? '<path d="M4 0 L8 7 L0 7Z"/>' : '<path d="M4 7 L0 0 L8 0Z"/>';
  return `<span class="delta" data-d="${up ? 'up' : 'down'}"><svg width="8" height="7" viewBox="0 0 8 7" fill="currentColor" aria-hidden="true">${tri}</svg>${up ? '+' : ''}${p.toFixed(0)}%</span>`;
}

// ── 12 · Monograma (sin logo_url, o miniatura caída) ───────────────────────
// OJO: el color va por CLASS, no por atributo fill. Una regla CSS como
// `svg text{fill:var(--ink-2)}` le gana siempre a un atributo de presentación
// (fill="currentColor"), y la inicial saldría en tinta oscura sobre la portada.
function monogram(name, size) {
  const s = size || 56;
  const l = (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  return `<svg class="cover__mono" width="${s}" height="${s}" viewBox="0 0 56 56" role="img" aria-label="${esc(name)}"><rect x=".75" y=".75" width="54.5" height="54.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><text class="fon" x="28" y="38" text-anchor="middle" font-size="28">${esc(l)}</text></svg>`;
}

// ── 13 · Miniatura con fallback ────────────────────────────────────────────
// Nunca background-image: las URLs del CDN de Meta caducan y un paréntesis en
// la URL rompe url(). loading="eager" porque una imagen perezosa no aparece
// en el PDF si no alcanzó a cargar.
function thumbImg(url, name, cls) {
  const c = cls || 'thumb';
  const initial = (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  const u = safeImg(url);
  if (!u) return `<div class="${c} mono-fallback">${esc(initial)}</div>`;
  return `<img class="${c}" src="${esc(u)}" alt="" loading="eager" decoding="sync" referrerpolicy="no-referrer" data-cls="${c}" data-i="${esc(initial)}" onerror="ivaeThumbFail(this)">`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGREGACIÓN DE INSTAGRAM
// ═══════════════════════════════════════════════════════════════════════════
// En modo mes fetchIgMetrics NO devuelve `totals` (_instagram.js:270-276): sólo
// fetchIgMetricsRange lo trae. Se suma aquí a partir de data.posts[], SALTANDO
// los null (jamás tratándolos como 0) y llevando la cuenta de cuántas
// publicaciones sí están medidas — el rótulo honesto es "suma de las N
// publicaciones medidas", nunca "alcance del mes".
function sumPosts(list) {
  const keys = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'interactions'];
  const out = { measured: 0, missing: 0, count: 0 };
  for (const k of keys) out[k] = null;
  for (const p of list || []) {
    if (!p) continue;
    out.count += 1;
    if (p.reach == null && p.views == null) { out.missing += 1; continue; }
    out.measured += 1;
    for (const k of keys) if (p[k] != null) out[k] = (out[k] || 0) + Number(p[k]);
  }
  return out;
}

// Normaliza el bloque de métricas del modo RANGO (donde sí hay totals sobre
// TODO el periodo, no sólo sobre los 60 posts que se listan).
function fromTotals(t, pending) {
  const measured = Math.max(0, (t.posts || 0) - (pending || 0));
  const zn = (v) => (measured === 0 || !v ? null : v);      // 0 medido = dato ausente
  return {
    count: t.posts || 0,
    measured,
    missing: pending || 0,
    views: zn(t.views), reach: zn(t.reach), saved: zn(t.saved), shares: zn(t.shares),
    likes: t.likes != null ? t.likes : null,
    comments: t.comments != null ? t.comments : null,
    interactions: zn(t.interactions),
  };
}

const IG_TYPE = {
  REELS: 'Reel', VIDEO: 'Video', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Foto',
  FEED: 'Post', POST: 'Post', STORY: 'Historia',
};
// Plural Y artículo: "carrusel"+s daba "carrusels", y "los fotos" es un error
// de género. El plural del español no se construye concatenando una s.
const IG_TYPE_PL = {
  REELS: { a: 'los', s: 'reel', p: 'reels' },
  VIDEO: { a: 'los', s: 'video', p: 'videos' },
  CAROUSEL_ALBUM: { a: 'los', s: 'carrusel', p: 'carruseles' },
  IMAGE: { a: 'las', s: 'foto', p: 'fotos' },
  FEED: { a: 'los', s: 'post', p: 'posts' },
  POST: { a: 'los', s: 'post', p: 'posts' },
  STORY: { a: 'las', s: 'historia', p: 'historias' },
};
function igTypeKey(t) { return IG_TYPE[t] ? t : 'POST'; }
function igTypeLabel(t) { return IG_TYPE[igTypeKey(t)]; }
// n piezas → "los 3 carruseles" / "la foto". art=false ⇒ sin artículo.
function igTypeWords(t, n) {
  const w = IG_TYPE_PL[igTypeKey(t)];
  const plural = n == null || n !== 1;
  return { art: w.a, word: plural ? w.p : w.s };
}
function demoLabel(k) { return ({ M: 'Hombres', F: 'Mujeres', U: 'Sin dato' })[k] || String(k || ''); }
// Métrica de orden del podio/tabla: alcance, y si no hay, vistas.
function reachOf(p) { return p.reach != null ? p.reach : (p.views != null ? p.views : null); }

// Fecha corta "12 jul" a partir de 'YYYY-MM-DD' o un timestamp ISO.
function shortDate(s) {
  const str = String(s || '');
  const d = str.slice(8, 10);
  const mo = Number(str.slice(5, 7));
  if (!d || !mo) return '';
  return `${d} ${REP_MONTHS_ABBR[mo - 1] || ''}`;
}
function ymdShift(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const t = Date.UTC(y, (m || 1) - 1, d || 1) + days * 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function handleMonthlyReport(request, env, session, url, igFetcher = null, manualFetcher = null, igRangeFetcher = null) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;   // forzado a su marca
  const month = String(url.searchParams.get('month') || '');
  const from = String(url.searchParams.get('from') || '');
  const to = String(url.searchParams.get('to') || '');
  // Se valida la fecha REAL, no sólo la forma: '2026-99' pasaba el regex y el
  // documento salía con "Reporte undefined 2026" y "4 de NaN días".
  const okMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const okDay = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const t = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(t)) return false;
    return new Date(t).toISOString().slice(0, 10) === s;   // descarta 2026-02-31
  };
  const rangeMode = okDay(from) && okDay(to);
  if (!clientId || (!rangeMode && !okMonth(month))) {
    return new Response('client_id y (month AAAA-MM o from+to AAAA-MM-DD) requeridos', { status: 400 });
  }
  if (rangeMode && from > to) {
    return new Response('El rango está invertido: from debe ser anterior a to', { status: 400 });
  }
  const client = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return new Response('Cliente no encontrado', { status: 404 });

  // ── FUGA DE DATOS INTERNOS (bug verificado) ───────────────────────────────
  // El SELECT * de antes no filtraba client_visible: los posts ocultos (título,
  // caption y estado) ya se estaban imprimiendo en un documento que el cliente
  // recibe por WhatsApp. Ahora se filtra en la consulta —no en la plantilla— y
  // se piden columnas explícitas para que notes_team NUNCA viaje al template.
  // El reporte ES un documento para el cliente, así que el filtro aplica
  // siempre; el staff puede ver el borrador completo con ?include_hidden=1.
  const isClient = session.role === 'client';
  const includeHidden = !isClient && url.searchParams.get('include_hidden') === '1';
  const visClause = includeHidden ? '' : ' AND client_visible = 1';
  // SÓLO lo que la plantilla usa de verdad. `caption` es el copy del guion y
  // `title`/`approval_state` son de trabajo interno: no tienen por qué viajar.
  const POST_COLS = 'content_type, publish_date, status';

  const res = rangeMode
    ? await env.DB.prepare(`SELECT ${POST_COLS} FROM mkt_posts WHERE client_id = ? AND publish_date BETWEEN ? AND ?${visClause} ORDER BY publish_date, position`).bind(clientId, from, to).all()
    : await env.DB.prepare(`SELECT ${POST_COLS} FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ?${visClause} ORDER BY publish_date, position`).bind(clientId, `${month}-%`).all();
  const posts = res.results || [];

  // ── Periodo ───────────────────────────────────────────────────────────────
  const periodKey = rangeMode ? from.slice(0, 7) : month;
  const [py, pm] = periodKey.split('-').map(Number);
  const label = rangeMode ? rangeLabel(from, to) : `${REP_MONTHS[(pm || 1) - 1]} ${py}`;
  const labelTitle = label.charAt(0).toUpperCase() + label.slice(1);
  const labelUpper = label.toUpperCase();
  const monthWord = rangeMode ? 'el periodo' : REP_MONTHS[(pm || 1) - 1];
  const singleMonth = !rangeMode || from.slice(0, 7) === to.slice(0, 7);

  const periodFrom = rangeMode ? from : `${month}-01`;
  const daysInPeriod = rangeMode
    ? Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1
    : new Date(Date.UTC(py, pm, 0)).getUTCDate();

  // Periodo anterior de la MISMA longitud (para el delta de producción).
  const prevFrom = rangeMode ? ymdShift(periodFrom, -daysInPeriod) : null;
  const prevTo = rangeMode ? ymdShift(periodFrom, -1) : null;
  const prevMonth = rangeMode ? null
    : `${pm === 1 ? py - 1 : py}-${String(pm === 1 ? 12 : pm - 1).padStart(2, '0')}`;
  const nextMonth = rangeMode ? null
    : `${pm === 12 ? py + 1 : py}-${String(pm === 12 ? 1 : pm + 1).padStart(2, '0')}`;
  const nextMonthWord = rangeMode ? 'las próximas semanas'
    : REP_MONTHS[(pm === 12 ? 0 : pm)] + (pm === 12 ? ` ${py + 1}` : '');

  // ── Paleta derivada del color de marca ────────────────────────────────────
  const rawBrand = /^#[0-9a-fA-F]{3,8}$/.test(client.brand_color || '') ? client.brand_color : REP_FALLBACK_BRAND;
  const T = brandTokens(rawBrand);
  const nameLen = String(client.name || '').length;
  const coverFs = nameLen <= 10 ? 'clamp(44px,13vw,92px)'
    : nameLen <= 18 ? 'clamp(36px,10vw,72px)'
      : nameLen <= 28 ? 'clamp(28px,7.5vw,54px)'
        : 'clamp(23px,6vw,42px)';
  const slug = slugUpper(client.name);

  // ── Producción (sección ancla: NUNCA depende de Instagram) ────────────────
  const byType = {};
  const byStatus = {};
  const dayCounts = {};                 // día del mes → piezas (sólo mes único)
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  const dateSet = new Set();
  let publicados = 0;
  for (const p of posts) {
    const t = p.content_type || 'otro';
    byType[t] = (byType[t] || 0) + 1;
    const st = p.status || 'idea';
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (st === 'publicado') publicados += 1;
    const d = String(p.publish_date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      dateSet.add(d);
      const [dy, dm, dd] = d.split('-').map(Number);
      if (singleMonth) dayCounts[dd] = (dayCounts[dd] || 0) + 1;
      dowCounts[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()] += 1;
    }
  }
  const daysWith = dateSet.size;
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const topType = typeEntries[0] || null;
  const stageList = REP_STATUS_ORDER
    .map((s) => ({
      label: REP_STATUS[s], value: byStatus[s] || 0,
      // "6 publicado" no es español: cada etapa lleva su plural.
      word: (byStatus[s] || 0) === 1 ? REP_STATUS[s] : REP_STATUS_PL[s],
    }))
    .filter((s) => s.value > 0);
  const cumpl = posts.length ? publicados / posts.length : 0;

  // ── Consultas auxiliares (D1, cero fetch nuevo) ───────────────────────────
  // Cada una se aísla con su propio catch: si a una marca le falta una tabla,
  // el reporte no se cae, sólo pierde ese bloque.
  const noteKey = rangeMode ? `report_note:${clientId}:${from}_${to}` : `report_note:${clientId}:${month}`;
  // El aislamiento tiene que cubrir también el throw SÍNCRONO de prepare()/
  // bind(): con `q(stmt)` esa excepción se lanzaba antes de entrar al catch y
  // tiraba el reporte entero. Por eso se pasan thunks.
  const q = (fn) => {
    try { return fn().all().then((r) => r.results || []).catch(() => []); } catch { return Promise.resolve([]); }
  };
  const [prevRows, delivRows, noteRows, nextRows, allRows] = await Promise.all([
    q(() => (rangeMode
      ? env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date BETWEEN ? AND ?${visClause}`).bind(clientId, prevFrom, prevTo)
      : env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ?${visClause}`).bind(clientId, `${prevMonth}-%`))),
    q(() => (rangeMode
      ? env.DB.prepare('SELECT id, type, title, link, video_ext, month, updated_at, created_at FROM mkt_deliverables WHERE client_id = ? AND month BETWEEN ? AND ? ORDER BY month, sort_order, created_at').bind(clientId, from.slice(0, 7), to.slice(0, 7))
      : env.DB.prepare('SELECT id, type, title, link, video_ext, month, updated_at, created_at FROM mkt_deliverables WHERE client_id = ? AND month = ? ORDER BY sort_order, created_at').bind(clientId, month))),
    // Nota editorial opcional: hoy NO hay UI que la escriba; se llena por
    // escritura directa a D1 en mkt_kv (report_note:<cliente>[:<periodo>]).
    q(() => env.DB.prepare('SELECT key, value FROM mkt_kv WHERE key IN (?, ?)').bind(noteKey, `report_note:${clientId}`)),
    q(() => (rangeMode
      ? env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date > ? AND publish_date <= ?${visClause}`).bind(clientId, to, ymdShift(to, 45))
      : env.DB.prepare(`SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ?${visClause}`).bind(clientId, `${nextMonth}-%`))),
    // Total SIN filtrar, sólo para avisarle al staff cuántas piezas quedaron
    // fuera de la vista del cliente (el cliente nunca ve este dato).
    isClient || includeHidden ? Promise.resolve([]) : q(() => (rangeMode
      ? env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date BETWEEN ? AND ?').bind(clientId, from, to)
      : env.DB.prepare('SELECT COUNT(*) AS n FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ?').bind(clientId, `${month}-%`))),
  ]);
  const prevCount = prevRows.length ? Number(prevRows[0].n || 0) : null;
  const deliverables = delivRows;
  const nextCount = nextRows.length ? Number(nextRows[0].n || 0) : 0;
  const hiddenCount = allRows.length ? Math.max(0, Number(allRows[0].n || 0) - posts.length) : 0;
  let editorialNote = '';
  for (const r of noteRows) {
    if (r.key === noteKey && String(r.value || '').trim()) { editorialNote = String(r.value); break; }
    if (String(r.value || '').trim()) editorialNote = String(r.value);
  }

  // ── Instagram (best-effort: el reporte sale aunque IG truene) ─────────────
  let ig = null;
  let igError = '';
  try {
    const fetcher = rangeMode ? igRangeFetcher : igFetcher;
    if (fetcher) {
      const r = rangeMode ? await fetcher(env, clientId, from, to) : await fetcher(env, clientId, month);
      if (r && r.connected && r.data && !r.error) ig = r;
      else if (r && r.error) {
        // El detalle crudo de la Graph API ("Session has expired on…") es para
        // nosotros, no para el documento que recibe el cliente.
        igError = String(r.error);
        try { console.log('[reporte] Instagram:', igError); } catch { /* sin consola */ }
      }
    }
  } catch { igError = 'No se pudo leer Instagram en este momento.'; }

  let manual = null;
  if (!ig && manualFetcher && !rangeMode) {
    try { manual = await manualFetcher(env, clientId, month); } catch { /* sigue sin IG */ }
  }

  const igList = ig ? (ig.data.posts || []).filter(Boolean) : [];
  const igMeasured = igList.filter((p) => p.reach != null || p.views != null);
  const M = ig
    ? (rangeMode && ig.data.totals ? fromTotals(ig.data.totals, ig.data.pending) : sumPosts(igList))
    : null;
  const audience = ig ? (ig.data.audience || null) : null;
  const hasDemo = !!(audience && (audience.gender || audience.age || audience.city));
  const igHandle = (ig && ig.username) || client.instagram_handle || '';

  // Tendencia mensual: se descarta el bucket MÁS ANTIGUO (viene truncado de
  // /me/media?limit=100 sin paginar y dibujaría una caída falsa).
  let sparkHtml = '';
  let sparkCap = '';
  if (ig && ig.data.months && !rangeMode) {
    // /me/media?limit=100 trae TODOS los meses de las últimas 100 piezas,
    // incluidos los POSTERIORES al mes reportado. Si no se recortan, la
    // gráfica de un reporte de mayo termina en "jul 2026" y el pie le
    // atribuye a mayo el número de julio. Se recorta al periodo y recién
    // entonces se descarta el bucket más antiguo (viene truncado).
    const keys = Object.keys(ig.data.months).filter((k) => k <= periodKey).sort();
    const usable = keys.slice(1);
    const vals = usable.map((k) => (ig.data.months[k] || {}).posts || 0);
    // La etiqueta del último punto en palabras ("jul 2026"), no el bucket crudo.
    const lastKey = usable.length ? usable[usable.length - 1] : '';
    const lastLbl = /^\d{4}-\d{2}$/.test(lastKey)
      ? `${REP_MONTHS_ABBR[Number(lastKey.slice(5, 7)) - 1] || ''} ${lastKey.slice(0, 4)}` : lastKey;
    sparkHtml = sparkline(vals, lastLbl);
    if (sparkHtml) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      // La frase del mes SÓLO si el último bucket es de verdad el mes reportado.
      const curN = lastKey === periodKey ? vals[vals.length - 1] : null;
      sparkCap = curN != null
        ? `Publicaciones en Instagram por mes. En ${esc(monthWord)} fueron <b>${curN}</b>, contra un promedio de <b>${avg.toFixed(1)}</b> en los últimos ${vals.length} meses.`
        : `Publicaciones en Instagram por mes. El promedio de los últimos ${vals.length} meses es <b>${avg.toFixed(1)}</b>.`;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 01 · EL MES EN UNA FRASE + KPIs
  // ═════════════════════════════════════════════════════════════════════════
  const leadParts = [];
  if (posts.length) {
    leadParts.push(`En ${monthWord} produjimos <b>${posts.length}</b> ${posts.length === 1 ? 'contenido' : 'contenidos'}${publicados ? ` y publicamos <b>${publicados}</b>` : ''}.`);
    if (daysWith >= 2) leadParts.push(`Hubo publicación en <b>${daysWith} de ${daysInPeriod}</b> días.`);
    if (topType && typeEntries.length >= 2) {
      leadParts.push(`El formato dominante fue <b>${esc(REP_TYPE_PL[topType[0]] || topType[0])}</b> (${topType[1]}).`);
    }
  } else {
    leadParts.push(`En ${monthWord} no hay contenidos registrados en el calendario.`);
  }
  if (M && M.measured > 0 && (M.views != null || M.reach != null)) {
    const v = M.views != null ? M.views : M.reach;
    leadParts.push(`En Instagram, las <b>${M.measured}</b> publicaciones ya medidas suman <b>${nfBig(v)}</b> ${M.views != null ? 'vistas' : 'de alcance'}.`);
  } else if (manual) {
    leadParts.push(`Los números de Instagram de este mes vienen de captura manual.`);
  }
  const leadHtml = leadParts.join(' ');

  // Construcción de los KPIs: 1 héroe + 3. Nunca 8: un dueño no jerarquiza
  // ocho cifras. Cuando no hay Instagram, el reporte SE REORDENA (no se
  // encoge): el héroe pasa a ser la producción.
  const kpis = [];
  const srcTag = manual ? '<span class="tagsrc">captura manual</span>' : '';
  if (M && M.measured > 0 && (M.views != null || M.reach != null)) {
    const heroVal = M.views != null ? M.views : M.reach;
    const heroLbl = M.views != null ? 'Vistas' : 'Alcance';
    kpis.push({
      hero: true, k: `${heroLbl} sumadas`, v: nfBig(heroVal),
      delta: deltaChip(null, null, '— sin comparativa'),
      read: `Suma de las <b>${M.measured}</b> ${M.measured === 1 ? 'publicación medida' : 'publicaciones medidas'} del periodo${M.missing ? `, de ${M.count} en total. ${M.missing === 1 ? 'Falta <b>1</b>' : `Faltan <b>${M.missing}</b>`} por liberar.` : '.'} No es el total de la cuenta.`,
    });
    kpis.push({
      k: 'Interacciones', v: nfBig(M.interactions != null ? M.interactions : ((M.likes || 0) + (M.comments || 0))),
      delta: deltaChip(null, null, '— sin comparativa'),
      read: `Me gusta, comentarios, guardados y compartidos de las publicaciones medidas.`,
    });
    kpis.push({
      k: 'Seguidores', v: nfBig(ig.data.followers),
      delta: deltaChip(null, null, '— sin histórico'),
      read: `Foto de la cuenta al generar este reporte. Todavía no guardamos histórico mensual, por eso no hay comparativa.`,
    });
    kpis.push({
      k: 'Contenidos entregados', v: nf(posts.length),
      delta: deltaChip(posts.length, prevCount, '— sin periodo previo'),
      read: `<b>${publicados}</b> ya ${publicados === 1 ? 'publicado' : 'publicados'}${posts.length - publicados > 0 ? ` y ${posts.length - publicados} en proceso` : ''}.`,
    });
  } else if (manual) {
    kpis.push({
      hero: true, k: 'Alcance del mes', v: nfBig(manual.reach),
      delta: deltaChip(null, null, '— sin comparativa'),
      read: `Número capturado a mano desde la app de Instagram del negocio.`,
    });
    kpis.push({
      k: 'Interacciones', v: nfBig(manual.interactions),
      delta: deltaChip(null, null, '— sin comparativa'),
      read: `Suma de me gusta, comentarios, guardados y compartidos que reporta la app.`,
    });
    kpis.push({
      k: 'Seguidores', v: nfBig(manual.followers),
      delta: deltaChip(null, null, '— sin histórico'),
      read: `Foto de la cuenta al cierre del mes.${manual.posts != null ? ` La app reportó <b>${nf(manual.posts)}</b> ${Number(manual.posts) === 1 ? 'publicación' : 'publicaciones'} en el mes.` : ''}`,
    });
    kpis.push({
      k: 'Contenidos entregados', v: nf(posts.length),
      delta: deltaChip(posts.length, prevCount, '— sin periodo previo'),
      read: `<b>${publicados}</b> ya ${publicados === 1 ? 'publicado' : 'publicados'}${posts.length - publicados > 0 ? ` y ${posts.length - publicados} en proceso` : ''}.`,
    });
  } else {
    // Sin Instagram: el peso visual cae en producción.
    kpis.push({
      hero: true, k: 'Contenidos entregados', v: nf(posts.length),
      delta: deltaChip(posts.length, prevCount, '— sin periodo previo'),
      read: prevCount != null && prevCount > 0
        ? `Contra <b>${prevCount}</b> del periodo anterior.`
        : `Es el primer periodo con registro, así que todavía no hay contra qué compararlo.`,
    });
    kpis.push({
      k: 'Publicados', v: nf(publicados),
      delta: deltaChip(null, null, '— sin comparativa'),
      read: posts.length ? `<b>${pctOf(publicados, posts.length)}%</b> del plan del periodo.` : 'Sin plan registrado en este periodo.',
    });
    kpis.push({
      k: 'Cumplimiento', v: posts.length ? `${pctOf(publicados, posts.length)}%` : '—',
      delta: deltaChip(null, null, '— sin comparativa'),
      read: posts.length ? `Piezas publicadas sobre piezas planeadas.` : `Sin piezas planeadas no hay porcentaje que calcular.`,
    });
    kpis.push({
      k: 'Días con publicación', v: daysWith ? `${daysWith}/${daysInPeriod}` : '—',
      delta: deltaChip(null, null, '— sin comparativa'),
      read: daysWith ? `La constancia es lo que sostiene el alcance mes con mes.` : `Todavía no hay fechas de publicación registradas.`,
    });
  }

  const kpiHtml = kpis.map((o) => `<div class="kpi${o.hero ? ' kpi--hero' : ''}">
        <div class="kpi__k">${esc(o.k)}</div>
        <div class="kpi__v num" data-len="${lenFlag(o.v)}">${esc(o.v)}</div>
        ${o.delta || ''}
        <p class="kpi__read">${o.read}</p>
      </div>`).join('');

  // ═════════════════════════════════════════════════════════════════════════
  // Secciones (se empujan sólo si tienen algo que decir; el counter() de CSS
  // renumera solo, así que ocultar una sección no descuadra nada).
  // ═════════════════════════════════════════════════════════════════════════
  const sections = [];
  const folio = `<div class="folio">${esc(slug)} · ${esc(labelUpper)} · </div>`;
  const open = (t, dek) => `<header class="sec__open"><div class="sec__n"></div><h2 class="sec__t">${esc(t)}</h2>${dek ? `<p class="sec__dek">${dek}</p>` : ''}</header>`;

  // ── 01 · El mes en una frase ──────────────────────────────────────────────
  // El alcance de 28 días es el ÚNICO dato a nivel cuenta que da la API; va
  // como línea aparte, nunca dentro de los KPIs, porque no es del periodo.
  const reach28 = ig && ig.data.reach_28d != null ? Number(ig.data.reach_28d) : null;
  const reach28Html = reach28 != null
    ? `<p class="micro">Alcance de la cuenta en los últimos 28 días: <b>${esc(fmtN(reach28))}</b>. Es una ventana móvil de Instagram, no el mes calendario, por eso no se suma con lo de arriba.</p>`
    : '';
  // Aviso interno: el reporte es el documento del cliente y filtra los
  // contenidos ocultos. Sin esta línea el staff ve menos piezas que en su
  // calendario y no sabe por qué. El cliente NUNCA la ve.
  const hiddenHtml = hiddenCount > 0
    ? `<p class="micro noprint">Vista de cliente: ${hiddenCount} ${hiddenCount === 1 ? 'contenido oculto no aparece' : 'contenidos ocultos no aparecen'} en este reporte. Agrega <b>&amp;include_hidden=1</b> a la dirección para verlos.</p>`
    : (includeHidden ? '<p class="micro noprint">Vista interna: incluye los contenidos ocultos al cliente.</p>' : '');
  sections.push(`<section class="sec sec--lead">
      ${open(rangeMode ? 'El periodo en una frase' : 'El mes en una frase', `Lo esencial primero. Si sólo lees una pantalla, que sea esta.${srcTag}`)}
      <p class="lead">${leadHtml}</p>
      <div class="kpis">${kpiHtml}</div>
      ${reach28Html}
      ${hiddenHtml}
      ${folio}
    </section>`);

  // ── 02 · Lo que produjimos (ancla) ────────────────────────────────────────
  let prodBody = '';
  if (!posts.length) {
    prodBody = `<div class="empty">
        <h4>Periodo sin actividad registrada</h4>
        <p>No hay contenidos con fecha dentro de ${esc(labelTitle)} en el calendario de la marca. Si trabajamos en piezas que todavía no tienen fecha asignada, aparecerán en el reporte del periodo en que se publiquen.</p>
      </div>`;
  } else {
    // El calendario sólo se dibuja en modo MES: un rango parcial dentro de un
    // mes pintaría días que ni siquiera pertenecen al periodo reportado.
    const heat = rangeMode ? '' : heatCalendar(py, pm, dayCounts);
    const mix = stackBar(posts.length >= 4
      ? typeEntries.map(([t, n]) => ({ label: REP_TYPE_PL[t] || t, value: n }))
      : []);
    const funnel = posts.length >= 4 ? funnelBar(stageList) : '';
    const gauge = arcGauge(cumpl, `${pctOf(publicados, posts.length)}%`, 'publicado');
    const typeText = typeEntries
      .map(([t, n]) => `<span class="chipx"><b>${n}</b> ${esc(n === 1 ? (REP_TYPE[t] || t).toLowerCase() : (REP_TYPE_PL[t] || t))}</span>`).join('');
    const stageText = stageList.map((s) => `<span class="chipx"><b>${s.value}</b> ${esc(String(s.word).toLowerCase())}</span>`).join('');

    prodBody = `<div class="grid2">
        <figure class="panel">
          ${heat || `<p class="body">Publicamos en <b>${daysWith}</b> de los <b>${daysInPeriod}</b> días del periodo.</p>`}
          <figcaption class="chartcap">${heat
    ? `Cada cuadro es un día. Publicamos en <b>${daysWith}</b> de <b>${daysInPeriod}</b> días; entre más parejo el patrón, más estable el alcance.`
    : `Publicamos en <b>${daysWith}</b> de <b>${daysInPeriod}</b> días. El calendario visual sólo se dibuja en los reportes de mes completo.`}</figcaption>
        </figure>
        <div class="stack">
          <figure class="panel">
            ${mix || `<div class="chips">${typeText}</div>`}
            <figcaption class="chartcap">${mix
    ? `Mezcla de formatos del periodo: ${typeEntries.map(([t, n]) => `<b>${n}</b> ${esc(n === 1 ? (REP_TYPE[t] || t).toLowerCase() : (REP_TYPE_PL[t] || t))}`).join(', ')}.`
    : typeEntries.length < 2
      ? `Todo el periodo fue de un solo formato, así que no hay mezcla que graficar.`
      : `Con menos de 4 piezas la gráfica de mezcla engaña más de lo que informa, así que va en texto.`}</figcaption>
          </figure>
          <figure class="panel">
            ${gauge}
            <figcaption class="chartcap">Cumplimiento: <b>${publicados}</b> de <b>${posts.length}</b> piezas planeadas ya están publicadas.</figcaption>
          </figure>
        </div>
      </div>
      <figure class="panel panel--wide">
        ${funnel || `<div class="chips">${stageText}</div>`}
        <figcaption class="chartcap">Dónde está cada pieza en la línea de producción, de idea a publicado: ${stageList.map((s) => `<b>${s.value}</b> ${esc(String(s.word).toLowerCase())}`).join(', ')}.</figcaption>
      </figure>
      ${sparkHtml ? `<figure class="panel panel--wide"><div class="sparkwrap">${sparkHtml}</div><figcaption class="chartcap">${sparkCap}</figcaption></figure>` : ''}`;
  }
  sections.push(`<section class="sec sec--prod">
      ${open('Lo que produjimos', 'Esta sección sale de nuestro calendario de trabajo, no de Instagram: existe siempre, aunque las métricas de la plataforma tarden.')}
      ${prodBody}
      ${folio}
    </section>`);

  // ── 03 · Lo mejor del mes ─────────────────────────────────────────────────
  if (igMeasured.length >= 1) {
    const ranked = igMeasured.slice().sort((a, b) => (reachOf(b) || 0) - (reachOf(a) || 0));
    const medianReach = (() => {
      const v = ranked.map((p) => reachOf(p) || 0).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : 0;
    })();
    const why = (p) => {
      const bits = [];
      const r = reachOf(p) || 0;
      if (medianReach > 0 && r > medianReach * 1.2) bits.push(`llegó <b>${Math.round((r / medianReach - 1) * 100)}%</b> más lejos que la publicación mediana del periodo`);
      if (p.saved != null && p.saved > 0) bits.push(`se guardó <b>${nf(p.saved)}</b> ${p.saved === 1 ? 'vez' : 'veces'}`);
      if (p.shares != null && p.shares > 0) bits.push(`se compartió <b>${nf(p.shares)}</b> ${p.shares === 1 ? 'vez' : 'veces'}`);
      if (p.avg_watch != null) bits.push(`la gente lo vio <b>${esc(fmtSec(p.avg_watch))}</b> en promedio`);
      if (!bits.length) return `Es la pieza con más alcance del periodo.`;
      return `Funcionó porque ${bits.slice(0, 2).join(' y ')}.`;
    };
    const metric = (lbl, val) => `<div class="bigm"><span class="bigm__v num">${esc(nfBig(val))}</span><span class="bigm__k">${esc(lbl)}</span></div>`;
    // reachOf() cae a vistas cuando no hay alcance: rotular esa cifra como
    // "alcance" y repetirla como "vistas" imprimía el mismo número dos veces
    // con dos nombres distintos. Cada cifra se rotula por lo que ES.
    const reachMetric = (p) => (p.reach != null ? metric('alcance', p.reach)
      : (p.views != null ? metric('vistas', p.views) : ''));
    const viewsMetric = (p) => (p.reach != null && p.views != null ? metric('vistas', p.views) : '');
    const first = ranked[0];
    const rest = ranked.slice(1, 3);

    // Micro-premios: sólo si el dato existe de verdad.
    const best = (key, min) => {
      const c = igMeasured.filter((p) => p[key] != null && p[key] >= (min || 0) && p[key] > 0);
      if (!c.length) return null;
      return c.reduce((a, b) => (b[key] > a[key] ? b : a));
    };
    const prizes = [
      { k: 'El más guardado', p: best('saved'), f: (p) => `${nf(p.saved)} ${p.saved === 1 ? 'guardado' : 'guardados'}` },
      { k: 'El más compartido', p: best('shares'), f: (p) => `${nf(p.shares)} ${p.shares === 1 ? 'compartido' : 'compartidos'}` },
      // Sin el mínimo de 1s se premiaba "el más visto hasta el final" con 0.4s
      // de retención: un premio que se lee como burla.
      { k: 'El más visto hasta el final', p: best('avg_watch', 1), f: (p) => `${fmtSec(p.avg_watch)} de vista promedio` },
    ].filter((x) => x.p);

    sections.push(`<section class="sec sec--best">
      ${open(rangeMode ? 'Lo mejor del periodo' : 'Lo mejor del mes', `Ordenado por alcance —y si Instagram todavía no libera el alcance de una pieza, por vistas—. ${igMeasured.length === 1 ? 'Sólo entra la publicación que ya tiene métricas' : `Sólo entran las ${igMeasured.length} publicaciones que ya tienen métricas`}.`)}
      <div class="podium__1">
        <div class="podium__grid">
          <div class="podium__media">${thumbImg(first.thumb, client.name)}</div>
          <div class="podium__body">
            <div class="piece__head"><span class="piece__type">${esc(igTypeLabel(first.type))}</span><span class="piece__date">${esc(shortDate(first.timestamp))}</span>${safeHref(first.permalink) ? `<a class="piece__link" href="${esc(safeHref(first.permalink))}" target="_blank" rel="noopener noreferrer">ver en Instagram ↗</a>` : ''}</div>
            <p class="podium__cap">${esc(first.caption || 'Sin descripción')}</p>
            <div class="bigms">${reachMetric(first)}${viewsMetric(first)}${metric('interacciones', first.interactions != null ? first.interactions : (first.likes || 0) + (first.comments || 0))}</div>
            <p class="chartcap">${why(first)}</p>
          </div>
        </div>
      </div>
      ${rest.length ? `<div class="podium__rest">${rest.map((p) => `<article class="podium__c">
        <div class="podium__grid podium__grid--sm">
          <div class="podium__media">${thumbImg(p.thumb, client.name)}</div>
          <div class="podium__body">
            <div class="piece__head"><span class="piece__type">${esc(igTypeLabel(p.type))}</span><span class="piece__date">${esc(shortDate(p.timestamp))}</span></div>
            <p class="podium__cap">${esc(p.caption || 'Sin descripción')}</p>
            <div class="bigms bigms--sm">${reachMetric(p)}${metric('interacciones', p.interactions != null ? p.interactions : (p.likes || 0) + (p.comments || 0))}</div>
          </div>
        </div>
      </article>`).join('')}</div>` : ''}
      ${prizes.length ? `<div class="prizes">${prizes.map((x) => `<div class="prize"><div class="prize__k">${esc(x.k)}</div><div class="prize__v">${esc(x.f(x.p))}</div><div class="micro">${esc(String(x.p.caption || '').slice(0, 70) || igTypeLabel(x.p.type))}</div></div>`).join('')}</div>` : ''}
      ${folio}
    </section>`);
  }

  // ── 04 · Publicación por publicación ──────────────────────────────────────
  if (igList.length >= 1) {
    const ranked = igList.slice().sort((a, b) => (reachOf(b) || 0) - (reachOf(a) || 0));
    const maxReach = Math.max.apply(null, ranked.map((p) => reachOf(p) || 0).concat([1]));
    const cell = (lbl, val) => `<td class="n" data-l="${esc(lbl)}">${val == null ? '<span class="pend">en proceso</span>' : esc(nfBig(val))}</td>`;
    const rows = ranked.map((p, i) => {
      const r = reachOf(p);
      const watch = fmtSec(p.avg_watch);
      return `<tr${i === 0 ? ' class="top"' : ''}>
        <td class="l cap-cell" data-l="Publicación">
          <div class="cellhead">${thumbImg(p.thumb, client.name, 'thumb thumb--sm')}<span class="rank">${String(i + 1).padStart(2, '0')}</span><span class="piece__type">${esc(igTypeLabel(p.type))}</span></div>
          <div class="cap">${esc(p.caption || 'Sin descripción')}</div>
          ${idxBar(r, maxReach)}
        </td>
        <td class="l" data-l="Fecha">${esc(shortDate(p.timestamp))}</td>
        ${cell('Vistas', p.views)}
        ${cell('Alcance', p.reach)}
        ${cell('Interacciones', p.interactions != null ? p.interactions : (p.likes || 0) + (p.comments || 0))}
        ${cell('Guardados', p.saved)}
        ${cell('Compartidos', p.shares)}
        <td class="n" data-l="Retención">${watch ? esc(watch) : '<span class="pend">—</span>'}</td>
      </tr>`;
    }).join('');
    // El modo MES corta en 40 posts (_instagram.js) y NO emite `truncated`:
    // el aviso estaba muerto justo en el modo que lo necesita. El total real
    // del mes está en months[periodKey].posts.
    const monthTotal = !rangeMode ? (((ig.data.months || {})[periodKey]) || {}).posts : null;
    const extra = rangeMode
      ? Number(ig.data.truncated || 0)
      : Math.max(0, Number(monthTotal || 0) - igList.length);
    const listDek = extra > 0
      ? `Las ${igList.length} publicaciones más recientes del periodo, ordenadas por alcance.`
      : `${igList.length === 1 ? 'La publicación del periodo' : `Las ${igList.length} publicaciones del periodo, ordenadas por alcance`}.`;
    sections.push(`<section class="sec sec--perf">
      ${open('Publicación por publicación', `${listDek} La barra bajo cada texto compara su alcance contra el mejor del periodo. "En proceso" significa que Instagram todavía no libera esa métrica: nunca ponemos un cero en su lugar.`)}
      <div class="tablewrap">
      <table class="perf">
        <thead><tr>
          <th class="l">Publicación</th><th class="l">Fecha</th><th>Vistas</th><th>Alcance</th>
          <th>Inter.</th><th>Guard.</th><th>Comp.</th><th>Retención</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      ${extra > 0 ? `<p class="micro">Se muestran las ${igList.length} publicaciones más recientes del periodo; ${extra === 1 ? 'hay 1 más' : `hay ${extra} más`} ${rangeMode ? 'contabilizada' + (extra === 1 ? '' : 's') + ' en los totales' : 'publicada' + (extra === 1 ? '' : 's') + ' en el mes'}.</p>` : ''}
      ${folio}
    </section>`);
  }

  // ── 05 · Tu audiencia ─────────────────────────────────────────────────────
  if (ig && hasDemo) {
    const gender = (audience.gender || []).map((x) => ({ label: demoLabel(x.key), value: x.value }));
    const age = (audience.age || []).slice().sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .map((x) => ({ label: String(x.key), value: x.value }));
    const city = (audience.city || []).map((x) => ({ label: String(x.key).split(',')[0], value: x.value }));

    const gTotal = gender.reduce((s, x) => s + (x.value || 0), 0);
    // La frase debe citar el porcentaje del grupo que NOMBRA. Antes siempre
    // usaba el % femenino y le cambiaba el sustantivo al mayoritario: con
    // 70% hombres imprimía "3 de cada 10 son hombres" y se contradecía con
    // su propia barra tres centímetros abajo. Además 'Sin dato' (U) se
    // excluye del denominador, que si no diluye los dos porcentajes.
    const fem = gender.find((x) => x.label === 'Mujeres');
    const male = gender.find((x) => x.label === 'Hombres');
    const known = (fem ? fem.value || 0 : 0) + (male ? male.value || 0 : 0);
    const domG = known
      ? ((fem ? fem.value || 0 : 0) >= (male ? male.value || 0 : 0)
        ? { lbl: 'mujeres', v: fem ? fem.value || 0 : 0 }
        : { lbl: 'hombres', v: male.value || 0 })
      : null;
    const domPct = domG ? pctOf(domG.v, known) : null;
    const cTotal = city.reduce((s, x) => s + (x.value || 0), 0);
    const topCity = city.slice().sort((a, b) => b.value - a.value)[0];
    const cityPct = cTotal && topCity ? pctOf(topCity.value, cTotal) : null;
    const aTotal = age.reduce((s, x) => s + (x.value || 0), 0);
    const topAges = age.slice().sort((a, b) => b.value - a.value).slice(0, 2);
    const agePct = aTotal ? pctOf(topAges.reduce((s, x) => s + x.value, 0), aTotal) : null;

    const frase = [];
    // Math.min(9,…) evita el absurdo "10 de cada 10" con 96%. Y si hay cubeta
    // "Sin dato" se dice, para que la frase no pelee con la barra de abajo,
    // que sí reparte sobre el total.
    if (domPct != null) {
      frase.push(`<b>${Math.min(9, Math.max(5, Math.round(domPct / 10)))} de cada 10</b> son ${domG.lbl}${known < gTotal ? ' (de quienes lo declaran)' : ''}`);
    }
    if (agePct != null && topAges.length) frase.push(`<b>${agePct}%</b> tiene entre ${esc(topAges.map((x) => x.label).sort().join(' y '))} años`);
    if (cityPct != null && topCity) frase.push(`<b>${cityPct}%</b> está en ${esc(topCity.label)}`);

    const ageChart = barsV(age);
    // La edad es ORDINAL: la lista de respaldo conserva el orden de los rangos.
    const ageList = ageChart ? '' : barsH(age, { top: 6, keepOrder: true });

    sections.push(`<section class="sec sec--aud">
      ${open('Tu audiencia', 'Es una foto actual de quién te sigue hoy, no de quién te vio en este periodo: Instagram sólo publica la demografía a nivel cuenta.')}
      ${frase.length ? `<p class="lead">${frase.join(', ')}${frase.length ? '.' : ''}</p>` : ''}
      ${gender.length ? `<figure class="panel"><figcaption class="kicker">Género</figcaption>${splitBar(gender)}<figcaption class="chartcap">Distribución de tus seguidores por género declarado: ${gender.map((g) => `<b>${pctOf(g.value, gTotal)}%</b> ${esc(String(g.label).toLowerCase())}`).join(', ')}.</figcaption></figure>` : ''}
      ${age.length ? `<figure class="panel"><figcaption class="kicker">Edad</figcaption>${ageChart || ageList}<figcaption class="chartcap">${ageChart ? 'Rangos de edad de tus seguidores.' : 'Con pocos rangos la lista se lee mejor que una gráfica.'}</figcaption></figure>` : ''}
      ${city.length ? `<figure class="panel"><figcaption class="kicker">Ciudades</figcaption>${barsH(city, { top: 5 })}<figcaption class="chartcap">Las 5 ciudades con más seguidores. El porcentaje es sobre el total de ciudades reportadas.</figcaption></figure>` : ''}
      ${folio}
    </section>`);
  } else if (ig && !hasDemo) {
    sections.push(`<section class="sec sec--aud">
      ${open('Tu audiencia', 'Quién te sigue hoy.')}
      <div class="empty">
        <h4>Instagram todavía no libera la demografía de esta cuenta</h4>
        <p>La plataforma sólo entrega género, edad y ciudades cuando la cuenta rebasa aproximadamente 100 seguidores. En cuanto pase ese umbral, esta sección se llena sola en el siguiente reporte.</p>
      </div>
      ${folio}
    </section>`);
  }

  // ── Panel de estado cuando NO hay Instagram ───────────────────────────────
  if (!ig) {
    sections.push(`<section class="sec sec--noig">
      ${open('Resultados en Instagram', manual ? 'Los números de arriba son captura manual del cierre de mes.' : 'Lo que se desbloquea al conectar la cuenta.')}
      <div class="empty">
        <h4>${manual ? 'Este mes trabajamos con captura manual' : 'Todavía no vemos tus números de Instagram'}</h4>
        <p>${manual
    ? 'Los indicadores del mes se capturaron a mano desde la app del negocio. Al conectar la cuenta por API el reporte gana el detalle publicación por publicación, la demografía de tu audiencia y el podio del mes.'
    : `La cuenta de la marca no está conectada${igError ? ' en este momento' : ''}, así que este reporte se apoya en nuestro calendario de producción, que sí está completo.`}</p>
        <ul>
          <li>Alcance y vistas por publicación</li>
          <li>Guardados, compartidos y retención</li>
          <li>Género, edad y ciudades de tu audiencia</li>
          <li>El podio de las piezas que mejor funcionaron</li>
        </ul>
      </div>
      ${folio}
    </section>`);
  }

  // ── 06 · Entregables del periodo ──────────────────────────────────────────
  if (deliverables.length) {
    // El reporte prometía "Ver / Descargar" aunque la marca tuviera las
    // descargas apagadas. El enlace abre el video para VER (va sin download=1,
    // así que el candado no lo toca), pero el texto no debe prometer de más.
    const puedeBajar = client.downloads_enabled == null || !!client.downloads_enabled;
    const items = deliverables.map((d) => {
      const isReel = d.type === 'reel';
      const href = isReel
        // Mismo sello anti-cache que la app (?v=<updated_at>): sin el, quien abrio
        // el reporte ANTES de que cambiaramos el video se seguia bajando el video
        // VIEJO desde su cache HTTP (la URL era identica, Cache-Control 1 hora).
        ? (d.video_ext ? `${url.origin}/api/marketing/deliverables/${encodeURIComponent(d.id)}/video?v=${String(d.updated_at || d.created_at || '').replace(/\D+/g, '') || '0'}` : null)
        : safeHref(d.link);
      const title = String(d.title || '').trim() || (isReel ? 'Reel sin título' : 'Carrusel sin título');
      return `<div class="deliv__i">
        <span class="deliv__type">${isReel ? 'Reel' : 'Carrusel'}</span>
        <span class="deliv__t">${esc(title)}</span>
        ${href ? `<a class="deliv__a" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${isReel ? (puedeBajar ? 'Ver / Descargar' : 'Ver') : 'Ver carrusel'} ↗</a>` : '<span class="pend">en proceso</span>'}
      </div>`;
    }).join('');
    const reels = deliverables.filter((d) => d.type === 'reel').length;
    const carr = deliverables.length - reels;
    sections.push(`<section class="sec sec--deliv">
      ${open('Entregables del periodo', 'El material final, listo para publicar o descargar. Es literalmente el producto por el que nos contrataste.')}
      <p class="body"><b>${deliverables.length}</b> ${deliverables.length === 1 ? 'entregable' : 'entregables'}${reels ? `: <b>${reels}</b> ${reels === 1 ? 'reel' : 'reels'}` : ''}${carr ? `${reels ? ' y ' : ': '}<b>${carr}</b> ${carr === 1 ? 'carrusel' : 'carruseles'}` : ''}. Los enlaces abren desde tu cuenta.</p>
      <div class="deliv">${items}</div>
      ${folio}
    </section>`);
  }

  // ── 07 · Lo que aprendimos ────────────────────────────────────────────────
  // Regla dura: ningún hallazgo con n<2. Máximo 3.
  const findings = [];
  if (igMeasured.length >= 4) {
    // A · Formato ganador (necesita ≥2 piezas medidas por formato).
    // Se agrupa por el TIPO crudo, no por la etiqueta: hace falta el tipo para
    // resolver artículo y plural ("los carruseles", "las fotos" — nunca
    // "los carrusels" ni "los fotos").
    const groups = {};
    for (const p of igMeasured) {
      const k = igTypeKey(p.type);
      if (!groups[k]) groups[k] = [];
      const r = reachOf(p);
      if (r != null) groups[k].push(r);
    }
    const valid = Object.entries(groups).filter(([, v]) => v.length >= 2)
      .map(([k, v]) => ({ k, n: v.length, avg: v.reduce((s, x) => s + x, 0) / v.length }))
      .sort((a, b) => b.avg - a.avg);
    if (valid.length >= 2 && valid[valid.length - 1].avg > 0) {
      const a = valid[0]; const b = valid[valid.length - 1];
      const diff = Math.round((a.avg / b.avg - 1) * 100);
      if (diff >= 20) {
        const wa = igTypeWords(a.k, a.n); const wb = igTypeWords(b.k, b.n);
        const wa2 = igTypeWords(a.k, 2); const wb2 = igTypeWords(b.k, 2);
        findings.push({
          obs: `${wa2.art.charAt(0).toUpperCase()}${wa2.art.slice(1)} ${wa2.word} rinden mejor que ${wb2.art} ${wb2.word} en esta cuenta.`,
          ev: `${a.n} ${wa.word} ${a.n === 1 ? 'promedió' : 'promediaron'} ${nfBig(Math.round(a.avg))} de alcance contra ${nfBig(Math.round(b.avg))} de ${b.n} ${wb.word}: <b>${diff}%</b> de diferencia.`,
          act: `Subimos el peso de ${wa2.word} en el plan del siguiente periodo y dejamos ${wb2.art} ${wb2.word} para los mensajes que sí necesitan ese formato.`,
        });
      }
    }
  }
  {
    // B · Retención de reels (≥2 con avg_watch).
    const w = igMeasured.filter((p) => p.avg_watch != null);
    if (w.length >= 2) {
      const avg = w.reduce((s, p) => s + p.avg_watch, 0) / w.length;
      const best = w.reduce((a, b) => (b.avg_watch > a.avg_watch ? b : a));
      findings.push({
        obs: `La gente se queda ${esc(fmtSec(avg))} en promedio viendo tus videos.`,
        ev: `Medido en ${w.length} videos del periodo. El mejor retuvo ${esc(fmtSec(best.avg_watch))}${best.caption ? `: "${esc(String(best.caption).slice(0, 60))}"` : ''}.`,
        act: `Replicamos la estructura de apertura del video que mejor retuvo en los primeros tres segundos de las próximas piezas.`,
      });
    }
  }
  {
    // C · Guardados / compartidos (≥2 piezas con el dato).
    const sv = igMeasured.filter((p) => p.saved != null && p.saved > 0);
    if (sv.length >= 2) {
      const total = sv.reduce((s, p) => s + p.saved, 0);
      const top = sv.reduce((a, b) => (b.saved > a.saved ? b : a));
      findings.push({
        obs: `Tu contenido de referencia se guarda: es el que la gente piensa volver a ver.`,
        ev: `${nf(total)} guardados repartidos en ${sv.length} publicaciones; el más guardado fue ${igTypeWords(top.type, 1).art === 'las' ? 'una' : 'un'} ${igTypeWords(top.type, 1).word} con ${nf(top.saved)}.`,
        act: `Aumentamos el contenido de utilidad (guías, precios, antes y después): es el que se guarda y el que Instagram vuelve a mostrar.`,
      });
    }
  }
  if (posts.length >= 4 && daysWith >= 2) {
    // D · Cadencia (sale de la BD propia: siempre disponible).
    const bestDow = dowCounts.indexOf(Math.max.apply(null, dowCounts));
    findings.push({
      obs: `La cadencia del periodo fue de ${(posts.length / (daysInPeriod / 7)).toFixed(1)} piezas por semana.`,
      ev: `${posts.length} contenidos repartidos en ${daysWith} días distintos${dowCounts[bestDow] >= 2 ? `, con el ${esc(DOW_ES[bestDow])} como día más cargado (${dowCounts[bestDow]} piezas)` : ''}.`,
      act: `Sostenemos el ritmo y repartimos mejor la semana para no dejar huecos largos sin publicar.`,
    });
  }
  const topFindings = findings.slice(0, 3);
  if (topFindings.length) {
    sections.push(`<section class="sec sec--learn">
      ${open('Lo que aprendimos', 'Máximo tres hallazgos, y sólo con evidencia suficiente: si algo pasó una sola vez, no es un patrón y no lo escribimos.')}
      ${/* El "qué haremos" NO se repite aquí: es exactamente el mismo string
           que la sección "Qué sigue", y verlo dos veces se lee como relleno. */''}
      ${topFindings.map((f) => `<div class="finding">
        <p>${f.obs}</p>
        <small><em>Evidencia:</em> ${f.ev}</small>
      </div>`).join('')}
      <p class="micro">Lo que haremos con cada hallazgo está en la siguiente sección.</p>
      ${folio}
    </section>`);
  }

  // ── 08 · Qué sigue ────────────────────────────────────────────────────────
  const actions = [];
  for (const f of topFindings) actions.push(f.act);
  if (actions.length < 3 && nextCount > 0) {
    actions.push(`Sacar adelante ${nextCount === 1 ? 'el contenido' : `los ${nextCount} contenidos`} ya agendados para ${esc(nextMonthWord)}.`);
  }
  if (actions.length < 3 && posts.length && publicados < posts.length) {
    actions.push(`Cerrar las ${posts.length - publicados} piezas del periodo que todavía no salen publicadas.`);
  }
  if (actions.length < 3 && !ig) {
    actions.push('Conectar la cuenta de Instagram para que el próximo reporte traiga alcance, guardados y demografía reales.');
  }
  if (actions.length < 3) {
    actions.push('Mantener la constancia de publicación: es lo que sostiene el alcance mes con mes.');
  }
  sections.push(`<section class="sec sec--next">
      ${open('Qué sigue', 'Tres decisiones concretas para el siguiente periodo.')}
      <ol class="next">${actions.slice(0, 3).map((a) => `<li>${a}</li>`).join('')}</ol>
      ${editorialNote ? `<div class="note"><div class="kicker">Nota de IVAE</div><p>${esc(editorialNote).replace(/\n+/g, '<br>')}</p></div>` : ''}
      <p class="body">${nextCount > 0
    ? `Ya tenemos <b>${nextCount}</b> ${nextCount === 1 ? 'contenido agendado' : 'contenidos agendados'} para ${esc(nextMonthWord)}.`
    : `El calendario de ${esc(nextMonthWord)} está por armarse: te lo compartimos en cuanto esté listo.`}</p>
      ${folio}
    </section>`);

  // ── Pie del documento: glosario + metodología + colofón ───────────────────
  const glossary = [
    ['Alcance', 'Cuántas cuentas distintas vieron la publicación al menos una vez.'],
    ['Vistas', 'Cuántas veces se reprodujo o se mostró el contenido, aunque sea la misma persona.'],
    ['Interacciones', 'Suma de me gusta, comentarios, guardados y compartidos.'],
    ['Guardados', 'Personas que archivaron la publicación para volver a verla. Es la señal más fuerte de utilidad.'],
    ['Retención', 'Segundos promedio que la gente se queda viendo un video antes de irse.'],
  ];
  sections.push(`<section class="sec sec--foot">
      ${open('Cómo leer este reporte', 'Los términos y el método, para que ningún número quede a interpretación.')}
      <dl class="gloss">${glossary.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <div class="method">
        <div class="kicker">Metodología</div>
        <p class="body">Los contenidos del periodo salen de nuestro calendario de producción y son el dato más completo del reporte. Las métricas de Instagram se leen cuando la plataforma las libera: por eso algunas publicaciones aparecen "en proceso" en lugar de con un cero. El <b>alcance de 28 días</b>, cuando aparece, es una ventana móvil de la cuenta, no el mes calendario, y la demografía de la audiencia es una foto del día en que se generó el reporte, no del periodo. Cuando sumamos métricas por publicación lo decimos explícitamente ("suma de las N publicaciones medidas") y nunca lo presentamos como el total de la cuenta.</p>
      </div>
      ${folio}
    </section>`);

  // ═════════════════════════════════════════════════════════════════════════
  // HTML
  // ═════════════════════════════════════════════════════════════════════════
  // El Worker corre en UTC: a las 19:00 de Cancún un reporte del día 31 se
  // fechaba el 1. America/Cancun es UTC-5 fijo (sin horario de verano desde
  // 2015), así que el corrimiento es constante y no necesita ICU.
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const emitted = `${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()}`;
  const ghost = posts.length || (M ? M.count : 0) || '';
  const logo = safeImg(client.logo_url);

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="${esc(T.brandDeep)}">
<title>Reporte ${esc(labelTitle)} · ${esc(client.name)}</title>
<script>
// Miniatura caída (las URLs del CDN de Meta caducan) → monograma, nunca un
// hueco roto. VA EN EL HEAD: si estuviera al final del documento, una imagen
// que falla antes de que ese <script> corra lanza ReferenceError y deja el
// ícono de imagen rota. Sin librerías y sin innerHTML anidado.
function ivaeThumbFail(el){
  try{
    var d=document.createElement('div');
    d.className=(el.getAttribute('data-cls')||'thumb')+' mono-fallback';
    d.textContent=el.getAttribute('data-i')||'?';
    if(el.parentNode) el.parentNode.replaceChild(d,el);
  }catch(e){/* si falla, se queda el alt vacío */}
}
</script>
<style>
/* ══════════════════════════════════════════════════════════════════════════
   REPORTE MENSUAL IVAE — hoja de estilo única, sin CDN, sin webfonts.
   Los tokens de color se CALCULAN EN EL WORKER y se inyectan como hex
   literal: cero dependencia de color-mix() → funciona en iOS 12+.
   ══════════════════════════════════════════════════════════════════════════ */
:root{
  /* ── Marca (inyectada) ── */
  --brand:${T.brand};
  /* --on-brand se pinta SÓLO sobre --brand-deep (portada, colofón).
     Sobre --brand crudo y sobre las tintas van estas otras: con marcas
     claras (ámbar, lima, cian) blanco sobre --brand mide 2.15:1. */
  --on-brand:${T.onBrand};
  --on-brand-raw:${T.onBrandRaw};
  --on-t-40:${T.onT40};
  --on-t-72:${T.onT72};
  --brand-ink:${T.brandInk};
  --brand-deep:${T.brandDeep};
  --t-06:${T.t06};
  --t-14:${T.t14};
  --t-40:${T.t40};
  --t-72:${T.t72};
  /* ── Tinta y papel (fijos) ── */
  --ink:#14141b; --ink-2:#4d4d5c; --ink-3:#8a8a99;
  --rule:#e5e5ee; --rule-2:#f1f1f7;
  --paper:#ffffff; --paper-2:#fbfaf7;
  /* ── Juicio: NUNCA en color de marca, y el negativo nunca en rojo ── */
  --pos:#15734a; --neg:#5c5c6b;
  /* ── Tipografía ── */
  --f-display:ui-serif,Georgia,'Iowan Old Style','Times New Roman',serif;
  --f-ui:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --f-mono:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  /* ── Espaciado (escala de 4) y geometría ── */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px; --s8:64px;
  --r:3px; --page:840px; --gut:20px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
img{max-width:100%;display:block}
a{color:var(--brand-ink);text-underline-offset:2px}
html{-webkit-text-size-adjust:100%}
body{font:400 15px/1.62 var(--f-ui);color:var(--ink-2);background:var(--paper-2);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
/* Documento estático: cero animación, cero movimiento. */
*,*::before,*::after{animation:none!important;transition:none!important}

/* ── ESCALA TIPOGRÁFICA ─────────────────────────────────────────────────
   1) La serif es SOLO para palabras: Georgia trae cifras de estilo antiguo
      y descuadra cualquier columna de números.
   2) Todo lo numérico va en --f-ui con tabular-nums.
   3) La mono SOLO en etiquetas, fechas y folios.                        */
.kicker{font:600 11px/1.2 var(--f-mono);text-transform:uppercase;letter-spacing:.18em;color:var(--ink-3)}
.lead{font-family:var(--f-display);font-weight:400;font-size:clamp(20px,5vw,30px);
  line-height:1.35;letter-spacing:-.01em;color:var(--ink);max-width:36ch}
.lead b{font-weight:700}
.body{font-size:15px;line-height:1.62;max-width:66ch}
.micro{font-size:11.5px;line-height:1.5;color:var(--ink-3);max-width:62ch}
.kpis+.micro,.micro+.micro{margin-top:var(--s4)}
.num,.kpi__v,.aud__v,.delta,.bigm__v,td.n{font-family:var(--f-ui);
  font-variant-numeric:tabular-nums lining-nums;font-feature-settings:'tnum' 1;letter-spacing:-.015em}

/* ── LAYOUT ─────────────────────────────────────────────────────────────── */
.doc{counter-reset:sec}
.sec{counter-increment:sec;max-width:var(--page);margin:0 auto;padding:var(--s8) var(--gut) 0}
.sec__open{position:relative;margin-bottom:var(--s6)}
.sec__open::before{content:"";display:block;width:56px;height:3px;background:var(--brand);margin-bottom:14px}
.sec__n::before{content:counter(sec,decimal-leading-zero);
  font:700 11px/1 var(--f-mono);letter-spacing:.22em;color:var(--brand-ink)}
.sec__t{font-family:var(--f-display);font-weight:700;font-size:clamp(24px,6vw,36px);
  line-height:1.06;letter-spacing:-.02em;color:var(--ink);margin-top:6px}
.sec__dek{margin-top:10px;font-size:14.5px;color:var(--ink-2);max-width:62ch}
.folio{display:none}
.stack{display:flex;flex-direction:column;gap:var(--s4)}

/* ── BARRA DE UTILIDAD (solo pantalla) ──────────────────────────────────── */
.util{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);flex-wrap:wrap;
  max-width:var(--page);margin:0 auto;padding:10px var(--gut);font-size:12px;color:var(--ink-3)}
/* El botón va en --brand-ink (garantizado ≥4.5:1 contra blanco por el bucle
   de brandTokens), no en --brand crudo: blanco sobre ámbar mide 2.15:1. */
.printbtn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));
  background:var(--brand-ink);color:#fff;border:0;border-radius:999px;
  padding:13px 22px;font:700 14px/1 var(--f-ui);cursor:pointer;
  box-shadow:0 8px 24px rgba(0,0,0,.20);z-index:20}

/* ── PORTADA ────────────────────────────────────────────────────────────
   El color va en un <svg> de PRIMER PLANO (rect), no en background: los
   fill de SVG son contenido y sobreviven al diálogo de impresión.       */
.cover{position:relative;isolation:isolate;overflow:hidden;color:var(--on-brand);
  min-height:72vh;display:grid;grid-template-rows:auto 1fr auto;
  padding:clamp(24px,7vw,56px) clamp(20px,6vw,56px)}
.cover__bg{position:absolute;inset:0;z-index:-1;width:100%;height:100%}
.cover__top{display:flex;align-items:center;gap:14px}
.cover__logo{width:56px;height:56px;border-radius:var(--r);object-fit:cover;background:rgba(255,255,255,.14)}
.cover__mono{width:56px;height:56px;flex:0 0 auto}
.cover__kick{font:600 12px/1.2 var(--f-mono);text-transform:uppercase;letter-spacing:.26em;opacity:.82}
.cover__mid{align-self:center;padding:var(--s6) 0}
.cover__name{font-family:var(--f-display);font-weight:700;line-height:.92;letter-spacing:-.035em;
  font-size:var(--cover-fs,clamp(38px,11.5vw,92px));margin:var(--s4) 0 var(--s3)}
.cover__handle{font:600 13px/1.4 var(--f-ui);letter-spacing:.02em;opacity:.78;margin-bottom:10px}
.cover__period{font:600 13px/1.5 var(--f-mono);text-transform:uppercase;letter-spacing:.2em;opacity:.92}
.cover__foot{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12px;opacity:.86;
  border-top:1px solid rgba(255,255,255,.22);padding-top:14px}
.cover[data-onbrand="dark"] .cover__foot{border-top-color:rgba(0,0,0,.18)}

/* ── KPIs: 1 héroe + 3. Nunca 8: un dueño no jerarquiza ocho cifras. ───── */
.kpis{display:grid;gap:var(--s2);grid-template-columns:1fr 1fr;margin-top:var(--s6)}
.kpi{border-top:2px solid var(--rule);padding:var(--s4) var(--s3) var(--s5) 0;break-inside:avoid}
.kpi--hero{grid-column:1/-1;border-top-color:var(--brand)}
.kpi__k{font:700 10.5px/1.2 var(--f-ui);letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3)}
.kpi__v{font-weight:800;line-height:.9;color:var(--ink);margin:12px 0 6px;font-size:clamp(34px,9vw,54px)}
.kpi--hero .kpi__v{font-size:clamp(46px,13vw,88px)}
.kpi__v[data-len="6"]{font-size:clamp(30px,8vw,46px)}
.kpi--hero .kpi__v[data-len="6"]{font-size:clamp(38px,10.5vw,70px)}
/* NINGUNA CIFRA VIAJA SOLA: cada KPI obliga a su línea de lectura. */
.kpi__read{font-size:12.5px;line-height:1.5;color:var(--ink-2);max-width:34ch}
.kpi__read b{color:var(--ink);font-weight:700}
.delta{display:inline-flex;align-items:center;gap:5px;font:700 11.5px/1 var(--f-mono);
  letter-spacing:.03em;padding:4px 7px;border-radius:2px;margin-bottom:8px}
.delta[data-d="up"]{color:var(--pos);background:rgba(21,115,74,.09)}
.delta[data-d="down"]{color:var(--neg);background:rgba(92,92,107,.10)}
.delta[data-d="na"]{color:var(--ink-3);background:var(--rule-2)}

/* ── Bloques de gráfica ─────────────────────────────────────────────────── */
.panel{background:var(--paper);border:1px solid var(--rule);border-radius:var(--r);
  padding:var(--s5) var(--s4);break-inside:avoid}
.panel+.panel,.panel--wide{margin-top:var(--s4)}
.grid2{display:grid;gap:var(--s4);grid-template-columns:1fr}
.chartcap{margin-top:12px;font-size:12.5px;line-height:1.5;color:var(--ink-2);max-width:56ch}
.chartcap b{color:var(--ink);font-weight:700}
figure{margin:0}
figure svg{display:block;width:100%;height:auto}
.sparkwrap{max-width:320px}
.chips{display:flex;flex-wrap:wrap;gap:var(--s2)}
.chipx{font-size:13px;color:var(--ink-2);background:var(--t-06);border:1px solid var(--rule);
  border-radius:999px;padding:5px 12px}
.chipx b{color:var(--ink);font-weight:700}

/* ── PODIO ──────────────────────────────────────────────────────────────── */
.podium__1{background:var(--t-06);border:1px solid var(--rule);border-left:3px solid var(--brand);
  border-radius:var(--r);padding:clamp(18px,5vw,32px);break-inside:avoid}
.podium__rest{display:grid;gap:var(--s3);grid-template-columns:1fr;margin-top:var(--s3)}
.podium__c{border:1px solid var(--rule);border-radius:var(--r);padding:var(--s4);
  background:var(--paper);break-inside:avoid}
.podium__grid{display:grid;gap:var(--s4);grid-template-columns:1fr}
.podium__media{max-width:220px}
.podium__cap{font-size:14px;color:var(--ink-2);margin:8px 0 14px;max-width:52ch}
.thumb{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r);
  box-shadow:inset 0 0 0 1px var(--rule);background:var(--t-14)}
.thumb--sm{width:32px;height:32px;aspect-ratio:auto;flex:0 0 auto}
.mono-fallback{display:grid;place-items:center;background:var(--t-14);color:var(--brand-ink);
  font:400 24px/1 var(--f-display);border-radius:var(--r);aspect-ratio:1}
.thumb--sm.mono-fallback{font-size:15px}
.bigms{display:flex;flex-wrap:wrap;gap:var(--s5)}
.bigm__v{display:block;font-weight:800;font-size:clamp(24px,6vw,34px);line-height:1;color:var(--ink)}
.bigms--sm .bigm__v{font-size:22px}
.bigm__k{display:block;margin-top:4px;font:700 10px/1.2 var(--f-mono);letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-3)}
.prizes{display:grid;gap:var(--s2);grid-template-columns:1fr;margin-top:var(--s5)}
.prize{border-top:1px solid var(--rule);padding-top:10px;break-inside:avoid}
.prize__k{font:700 10px/1.2 var(--f-mono);text-transform:uppercase;letter-spacing:.16em;color:var(--ink-3)}
.prize__v{font-weight:700;color:var(--ink);font-size:15px;margin:4px 0}
.piece__head{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12px;margin-bottom:6px}
.piece__date{font:700 11px/1 var(--f-mono);letter-spacing:.06em;color:var(--brand-ink);text-transform:uppercase}
.piece__type{font:700 10px/1 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.piece__link{margin-left:auto;font:700 11px/1 var(--f-ui);text-decoration:none;white-space:nowrap}

/* ── TABLA DE RENDIMIENTO ───────────────────────────────────────────────── */
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.perf{width:100%;border-collapse:collapse;font-size:13.5px;border-top:2px solid var(--ink)}
.perf th{font:700 10px/1.2 var(--f-ui);letter-spacing:.09em;text-transform:uppercase;
  color:var(--ink-3);text-align:right;padding:9px 8px;border-bottom:1px solid var(--rule);white-space:nowrap}
.perf th:first-child,.perf th.l,.perf td:first-child,.perf td.l{text-align:left}
.perf td{padding:11px 8px;border-bottom:1px solid var(--rule-2);vertical-align:top}
.perf td.n{text-align:right;font-weight:600;color:var(--ink);white-space:nowrap}
.perf tr{break-inside:avoid}
.perf tr.top td{background:var(--t-06)}
.cellhead{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.perf .rank{font:700 11px/1.4 var(--f-mono);color:var(--ink-3)}
.perf .cap{color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;max-width:34ch}
/* Barra de dato DENTRO de la celda: la tabla se vuelve gráfica sin gastar
   un renglón. El outline salva los acentos pálidos. */
.bar{display:block;height:3px;margin-top:6px;background:var(--brand);
  outline:.5px solid var(--brand-ink);outline-offset:-.5px}
.bar--wait{background:repeating-linear-gradient(135deg,var(--rule) 0 4px,var(--paper) 4px 8px);
  outline-color:var(--rule)}
.pend{color:var(--ink-3);font-weight:400}

/* ── AUDIENCIA: barras sobre línea base continua ─────────────────────────── */
.aud{display:flex;flex-direction:column;gap:2px;margin-top:var(--s3)}
.aud__row{display:grid;grid-template-columns:96px 1fr 52px;align-items:center;gap:12px;padding:7px 0;
  break-inside:avoid}
.aud__k{font-size:13px;font-weight:600;color:var(--ink-2)}
.aud__bar{position:relative;height:6px;background:var(--rule)}
.aud__bar i{position:absolute;inset:0 auto 0 0;display:block;background:var(--t-40)}
.aud__row[data-top="1"] .aud__bar i{background:var(--brand)}
.aud__v{text-align:right;font-weight:700;color:var(--ink);font-size:13px}

/* ── ENTREGABLES ────────────────────────────────────────────────────────── */
.deliv{display:grid;gap:var(--s2);grid-template-columns:1fr;margin-top:var(--s4)}
.deliv__i{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--rule);
  padding:12px 0;break-inside:avoid}
.deliv__type{font:700 10px/1 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;
  color:var(--brand-ink);flex:0 0 auto}
.deliv__t{font-weight:600;color:var(--ink);flex:1;min-width:0}
.deliv__a{font:700 12px/1 var(--f-ui);text-decoration:none;white-space:nowrap}

/* ── HALLAZGOS ──────────────────────────────────────────────────────────── */
.finding{border-left:3px solid var(--brand);padding:2px 0 2px 18px;margin:var(--s5) 0;break-inside:avoid}
.finding p{font-family:var(--f-display);font-size:17px;line-height:1.5;color:var(--ink)}
.finding b{font-weight:700}
.finding small{display:block;margin-top:8px;font:400 12.5px/1.55 var(--f-ui);color:var(--ink-3)}
.finding small em{font-style:normal;color:var(--ink-2);font-weight:600}
.finding small b{color:var(--ink-2)}

/* ── QUÉ SIGUE ──────────────────────────────────────────────────────────── */
.next{list-style:none;counter-reset:nx}
.next li{counter-increment:nx;position:relative;padding:14px 0 14px 42px;
  border-bottom:1px solid var(--rule);font-size:15px;color:var(--ink);break-inside:avoid}
.next li::before{content:counter(nx,decimal-leading-zero);position:absolute;left:0;top:15px;
  font:700 12px/1 var(--f-mono);letter-spacing:.1em;color:var(--brand-ink)}
.note{margin-top:var(--s5);background:var(--t-06);border-left:3px solid var(--brand);
  border-radius:var(--r);padding:var(--s4) var(--s5);break-inside:avoid}
.note p{margin-top:8px;font-family:var(--f-display);font-size:16px;line-height:1.55;color:var(--ink)}

/* ── ESTADOS VACÍOS: una invitación, jamás un error ni un cero ──────────── */
.empty{border:1px dashed var(--t-40);background:var(--t-06);border-radius:var(--r);
  padding:var(--s5);break-inside:avoid}
.empty h4{font-family:var(--f-display);font-weight:700;font-size:20px;line-height:1.2;
  color:var(--ink);margin-bottom:8px}
.empty p{font-size:14px;color:var(--ink-2);max-width:56ch}
.empty ul{margin:var(--s3) 0 0 18px;font-size:13.5px;color:var(--ink-2);columns:2;column-gap:var(--s5)}
.tagsrc{display:inline-block;font:600 10px/1 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-3);border:1px solid var(--rule);border-radius:2px;padding:4px 7px;margin-left:8px}

/* ── PIE DEL DOCUMENTO ──────────────────────────────────────────────────── */
.gloss{columns:2;column-gap:var(--s6);margin-top:var(--s4)}
.gloss div{break-inside:avoid;margin-bottom:var(--s3)}
.gloss dt{font-weight:700;color:var(--ink);font-size:13px}
.gloss dd{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.method{margin-top:var(--s5)}
.method p{margin-top:8px}
/* El colchón inferior es obligatorio en pantalla: .printbtn es position:fixed
   y sin él tapa la última línea del colofón al final del scroll. Va en el
   colofón —no en el body— para no abrir una franja blanca bajo el color. */
.colophon{margin-top:var(--s8);color:var(--on-brand);position:relative;isolation:isolate;
  padding:var(--s7) var(--gut) 104px;text-align:center;overflow:hidden}
.colophon__bg{position:absolute;inset:0;z-index:-1;width:100%;height:100%}
.colophon a{color:inherit}
.colophon p{font-size:13px;opacity:.9;margin-top:6px}
.colophon .kicker{color:inherit;opacity:.75}

/* ── SVG: todos los colores por class, nunca por atributo fill ──────────── */
svg .fb{fill:var(--brand)} svg .fb72{fill:var(--t-72)} svg .fb40{fill:var(--t-40)}
svg .fb14{fill:var(--t-14)} svg .fb06{fill:var(--t-06)} svg .ftrk{fill:var(--rule)}
svg .fink{fill:var(--ink)} svg .fink2{fill:var(--ink-2)} svg .fink3{fill:var(--ink-3)}
/* Cada tinta encima de SU relleno: .fon sólo sobre brand-deep. */
svg .fon{fill:var(--on-brand)} svg .fonr{fill:var(--on-brand-raw)}
svg .fon40{fill:var(--on-t-40)} svg .fon72{fill:var(--on-t-72)}
/* Contorno para los rellenos pálidos (t-40 mide 1.2:1 con marcas claras). */
svg .ostrk{stroke:var(--brand-ink);stroke-width:1;vector-effect:non-scaling-stroke}
svg .sb{stroke:var(--brand-ink);fill:none;stroke-width:2;vector-effect:non-scaling-stroke;
  stroke-linejoin:round;stroke-linecap:round}
svg .strk{stroke:var(--rule);fill:none;stroke-width:1;vector-effect:non-scaling-stroke}
svg .son{stroke:var(--on-brand);fill:none;stroke-width:1;vector-effect:non-scaling-stroke}
svg text{font-family:var(--f-ui);font-variant-numeric:tabular-nums;fill:var(--ink-2)}
svg text.lbl{font-family:var(--f-mono);letter-spacing:.10em;fill:var(--ink-3)}
/* El numeral fantasma de la portada va en CONTORNO: la clase es obligatoria
   porque la regla svg text{fill:...} le gana a cualquier atributo fill. */
svg text.ghost{fill:none;stroke:var(--on-brand)}

/* ══ RESPONSIVE ═══════════════════════════════════════════════════════════
   99% de los clientes abren esto en el teléfono: el móvil es el caso base,
   el escritorio es la mejora.                                             */
@media (min-width:600px){
  :root{--gut:28px}
  .kpis{grid-template-columns:repeat(3,1fr)}
  .kpi--hero{grid-column:1/-1}
  .podium__rest{grid-template-columns:1fr 1fr}
  .prizes{grid-template-columns:repeat(3,1fr)}
  .deliv{grid-template-columns:1fr 1fr}
  .podium__grid{grid-template-columns:200px 1fr;align-items:start}
  .podium__grid--sm{grid-template-columns:88px 1fr;gap:var(--s3)}
  .podium__media{max-width:none}
}
@media (min-width:860px){
  .grid2{grid-template-columns:1.05fr .95fr;gap:var(--s5)}
  .kpis{grid-template-columns:1.5fr 1fr 1fr 1fr;gap:0}
  .kpi--hero{grid-column:auto;padding-right:var(--s6)}
  .kpi{border-right:1px solid var(--rule);padding-right:var(--s5)}
  .kpi:last-child{border-right:0}
}
@media (max-width:520px){.empty ul{columns:1}.gloss{columns:1}.util__hint{display:none}}
/* La tabla se convierte en fichas etiquetadas. No es opcional con 99% móvil. */
@media (max-width:640px){
  .tablewrap{overflow-x:visible}
  .perf,.perf tbody,.perf tr,.perf td{display:block;width:100%}
  .perf thead{position:absolute;left:-9999px}
  .perf{border-top:0}
  .perf tr{border:1px solid var(--rule);border-radius:var(--r);padding:12px 14px;margin-bottom:10px}
  .perf tr.top{background:var(--t-06)}
  .perf td{border:0;padding:4px 0;display:flex;justify-content:space-between;gap:16px;text-align:left}
  .perf td.n{text-align:right}
  .perf td::before{content:attr(data-l);font:700 10px/1.6 var(--f-ui);letter-spacing:.08em;
    text-transform:uppercase;color:var(--ink-3)}
  .perf td:first-child::before{content:none}
  .perf td.cap-cell{display:block}
  .perf .cap{max-width:none}
  .perf .bar{margin-top:8px}
  .aud__row{grid-template-columns:80px 1fr 44px;gap:10px}
  .bigms{gap:var(--s4)}
}

/* ══ IMPRESIÓN ════════════════════════════════════════════════════════════
   Carta (en México nadie imprime A4). Portada a sangre real vía @page :first.
   NO se promete pie corrido con position:fixed — no es fiable en Safari/iOS.
   En su lugar, folio por sección.                                          */
@page{size:Letter portrait;margin:14mm 13mm 16mm}
@page :first{margin:0}
@media print{
  html,body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  :root{--s5:18px;--s6:24px;--s7:30px;--s8:34px;--gut:0px}
  body{font-size:10.5pt}
  .util,.printbtn,.noprint{display:none!important}
  a{color:inherit;text-decoration:none}
  a[href]::after{content:none}
  .panel,.podium__c,.podium__1,.empty{box-shadow:none}
  .colophon{padding-bottom:var(--s7)}
  /* 246mm = alto de Carta (279.4) menos los márgenes de @page (14+16), con
     box-sizing:border-box. NO subirlo apostando a @page :first{margin:0}:
     donde el selector de página se ignora (Safari/iOS, que es el 99% de
     estos clientes) la portada desborda y regala una hoja en blanco. */
  .cover{min-height:246mm;break-after:page;padding:22mm 18mm}
  /* Sólo 2 saltos forzados: la tabla y el pie. Más saltos = hojas medio vacías. */
  .sec--perf,.sec--foot{break-before:page}
  .sec__t,.sec__open{break-after:avoid}
  .kpi,.panel,.finding,.podium__1,.podium__c,.prize,.deliv__i,.empty,.aud__row,.next li,figure,tr{
    break-inside:avoid}
  p,li{orphans:3;widows:3}
  thead{display:table-header-group}
  .tablewrap{overflow:visible}
  .perf{font-size:9.5pt}
  .perf .cap{-webkit-line-clamp:3}
  .kpis{grid-template-columns:1.5fr 1fr 1fr 1fr;gap:0}
  .kpi{border-right:1px solid var(--rule);padding-right:var(--s5)}
  .kpi--hero{grid-column:auto}
  .grid2{grid-template-columns:1.05fr .95fr}
  .podium__rest,.deliv{grid-template-columns:1fr 1fr}
  .prizes{grid-template-columns:repeat(3,1fr)}
  .podium__grid{grid-template-columns:180px 1fr}
  .gloss{columns:2}
  /* Folio por sección: seguro, se ve intencional, sobrevive a cualquier navegador. */
  .folio{display:block;margin-top:var(--s5);padding-top:8px;border-top:.75pt solid var(--rule);
    font:600 8pt/1 var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3)}
  .folio::after{content:counter(sec,decimal-leading-zero)}
  /* Hairlines: nada por debajo de .75pt sobrevive a la impresión. */
  .perf td,.perf th,.deliv__i,.next li{border-color:#d8d8e2}
}
</style></head>
<body>
<div class="doc">

<div class="util noprint">
  <span>Reporte de contenido · ${esc(labelTitle)}</span>
  <span class="util__hint">Sale mejor impreso en Carta vertical</span>
</div>

<header class="cover" data-onbrand="${T.onBrand === '#14141b' ? 'dark' : 'light'}" style="--cover-fs:${coverFs}">
  ${coverBg(ghost)}
  <div class="cover__top">
    ${logo ? `<img class="cover__logo" src="${esc(logo)}" alt="" loading="eager" decoding="sync" referrerpolicy="no-referrer" data-cls="cover__logo" data-i="${esc((client.name || '?').charAt(0).toUpperCase())}" onerror="ivaeThumbFail(this)">` : monogram(client.name)}
    <span class="cover__kick">IVAE Marketing</span>
  </div>
  <div class="cover__mid">
    <h1 class="cover__name">${esc(client.name)}</h1>
    ${igHandle ? `<div class="cover__handle">@${esc(String(igHandle).replace(/^@/, ''))}</div>` : ''}
    <div class="cover__period">Reporte de contenido · ${esc(labelUpper)}</div>
  </div>
  <div class="cover__foot">
    <span>Preparado por IVAE Marketing</span>
    <span>Emitido el ${esc(emitted)}</span>
    <span>${posts.length} ${posts.length === 1 ? 'contenido' : 'contenidos'} en el periodo</span>
  </div>
</header>

${sections.join('\n')}

<footer class="colophon">
  <svg class="colophon__bg" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect width="800" height="200" fill="var(--brand-deep)"/></svg>
  <div class="kicker">IVAE Marketing</div>
  <p>Manejo de redes sociales · ivaestudios.com</p>
  <p>Próximo reporte: ${esc(nextMonthWord)}</p>
</footer>

</div>
<button class="printbtn noprint" onclick="window.print()">Imprimir / PDF</button>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
