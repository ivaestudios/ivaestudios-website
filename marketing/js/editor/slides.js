// ============================================================================
// IVAE Marketing — Guion de CARRUSELES por slides.
//
// El guion de un carrusel se edita como slides (Slide 1 · HOOK … Slide N · CTA)
// pero se GUARDA en las mismas columnas de siempre para no tocar la base ni el
// conector: hook = slide 1, cta = último slide, body = slides intermedios
// serializados como "Slide 2 — texto" separados por línea en blanco (el mismo
// formato que ya usan los guiones existentes, así los viejos se abren bien).
// ============================================================================

import { T } from '../shell/i18n.js?v=202607221913';

/** Slides intermedios a partir del body ("Slide N — texto" o texto corrido).
 *  Los intermedios VACIOS ("Slide 3 — ") se CONSERVAN: filtrarlos hacia
 *  desaparecer un slide recien agregado al recargar y desalineaba los SEO
 *  alts (van por posicion). Solo se descarta el tramo vacio de antes del
 *  primer marcador. */
export function middleSlides(body) {
  const s = String(body || '').trim();
  if (!s) return [];
  // Parseo con lookahead (como altsFromText) pero el espacio DESPUES del
  // marcador es solo horizontal ([^\S\n]*): un \s* greedy se tragaba los
  // saltos de linea del slide vacio y pegaba el marcador siguiente al texto.
  const re = /(?:^|\n)\s*slide\s*\d+[^\S\n]*[—:–.\-]?[^\S\n]*([^]*?)(?=\n\s*slide\s*\d+\s*[—:–.\-]?|$)/gi;
  const out = [];
  let m; let first = -1;
  while ((m = re.exec(s)) && out.length < 60) {
    if (first < 0) first = m.index;
    out.push(m[1].trim());
  }
  if (!out.length) return [s];
  // Texto suelto antes del primer marcador (bodies legacy): se conserva.
  const pre = s.slice(0, first).trim();
  if (pre) out.unshift(pre);
  return out;
}

/** [slide1, …intermedios…, slideN] desde los campos del post. */
export function slidesFromPost(p) {
  return [String((p && p.hook) || '').trim(), ...middleSlides(p && p.body), String((p && p.cta) || '').trim()];
}

/** Campos hook/body/cta desde la lista de slides. Los intermedios vacíos
 *  TAMBIEN se serializan ("Slide N — ") para no perder el slide al recargar
 *  ni cruzar los SEO alts. */
export function fieldsFromSlides(slides) {
  const arr = (slides || []).map((s) => String(s || '').trim());
  const hook = arr[0] || '';
  const cta = arr.length > 1 ? arr[arr.length - 1] : '';
  const mid = arr.slice(1, Math.max(1, arr.length - 1));
  const body = mid.map((t, i) => `Slide ${i + 2} — ${t}`).join('\n\n');
  return { hook, body, cta };
}

export function slideLabel(i, total) {
  if (i === 0) return 'SLIDE 1 · HOOK';
  if (i === total - 1) return `SLIDE ${total} · CTA`;
  return `SLIDE ${i + 1}`;
}

export function slideHint(i, total) {
  if (i === 0) return T('La portada que detiene el scroll', 'The cover that stops the scroll');
  if (i === total - 1) return T('Cierre con acción clara', 'A close with a clear action');
  return '';
}

export function slidePlaceholder(i, total) {
  if (i === 0) return T('El texto de la portada', 'The cover text');
  if (i === total - 1) return T('El cierre con llamado a la acción', 'The closing call to action');
  return `${T('Texto del slide', 'Text for slide')} ${i + 1}`;
}

/** Guion completo listo para copiar ("SLIDE 1:\n…"). */
export function slidesToText(slides) {
  return (slides || [])
    .map((s, i) => ({ s: String(s || '').trim(), i }))
    .filter((x) => x.s)
    .map((x) => `SLIDE ${x.i + 1}:\n${x.s}`)
    .join('\n\n');
}

// ── SEO ALT (texto alternativo) ──────────────────────────────────────────────
// En carrusel se guarda un alt por slide con el mismo formato "Slide N — texto"
// (separados por línea en blanco); en foto/reel es texto simple.

/** Lista de alts con al menos `count` lugares; si hay MÁS alts guardados que
 *  slides (carruseles con más imágenes que guion), se conservan todos. */
export function altsFromText(text, count) {
  const s = String(text || '').trim();
  const parsed = [];
  if (s) {
    const re = /(?:^|\n)\s*slide\s*(\d+)\s*[—:–.\-]?\s*([^]*?)(?=\n\s*slide\s*\d+\s*[—:–.\-]?|$)/gi;
    let m; let found = false;
    while ((m = re.exec(s))) {
      found = true;
      const i = parseInt(m[1], 10) - 1;
      if (i >= 0 && i < 60) parsed[i] = m[2].trim();
    }
    if (!found) parsed[0] = s;
  }
  const size = Math.max(1, count || 1, parsed.length);
  const arr = new Array(size).fill('');
  for (let i = 0; i < parsed.length; i++) if (parsed[i]) arr[i] = parsed[i];
  return arr;
}

export function altsToText(alts) {
  const arr = (alts || []).map((a) => String(a || '').trim());
  if (arr.length <= 1) return arr[0] || '';
  return arr.map((a, i) => (a ? `Slide ${i + 1} — ${a}` : '')).filter(Boolean).join('\n\n');
}
