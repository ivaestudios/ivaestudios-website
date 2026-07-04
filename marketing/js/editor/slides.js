// ============================================================================
// IVAE Marketing — Guion de CARRUSELES por slides.
//
// El guion de un carrusel se edita como slides (Slide 1 · HOOK … Slide N · CTA)
// pero se GUARDA en las mismas columnas de siempre para no tocar la base ni el
// conector: hook = slide 1, cta = último slide, body = slides intermedios
// serializados como "Slide 2 — texto" separados por línea en blanco (el mismo
// formato que ya usan los guiones existentes, así los viejos se abren bien).
// ============================================================================

/** Slides intermedios a partir del body ("Slide N — texto" o texto corrido). */
export function middleSlides(body) {
  const s = String(body || '').trim();
  if (!s) return [];
  const parts = s.split(/(?:^|\n)\s*slide\s*\d+\s*[—:–.\-]?\s*/i).map((t) => t.trim()).filter(Boolean);
  return parts.length ? parts : [s];
}

/** [slide1, …intermedios…, slideN] desde los campos del post. */
export function slidesFromPost(p) {
  return [String((p && p.hook) || '').trim(), ...middleSlides(p && p.body), String((p && p.cta) || '').trim()];
}

/** Campos hook/body/cta desde la lista de slides (los intermedios vacíos se caen). */
export function fieldsFromSlides(slides) {
  const arr = (slides || []).map((s) => String(s || '').trim());
  const hook = arr[0] || '';
  const cta = arr.length > 1 ? arr[arr.length - 1] : '';
  const mid = arr.slice(1, Math.max(1, arr.length - 1)).filter(Boolean);
  const body = mid.map((t, i) => `Slide ${i + 2} — ${t}`).join('\n\n');
  return { hook, body, cta };
}

export function slideLabel(i, total) {
  if (i === 0) return 'SLIDE 1 · HOOK';
  if (i === total - 1) return `SLIDE ${total} · CTA`;
  return `SLIDE ${i + 1}`;
}

export function slideHint(i, total) {
  if (i === 0) return 'La portada que detiene el scroll';
  if (i === total - 1) return 'Cierre con acción clara';
  return '';
}

export function slidePlaceholder(i, total) {
  if (i === 0) return 'El texto de la portada';
  if (i === total - 1) return 'El cierre con llamado a la acción';
  return `Texto del slide ${i + 1}`;
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

/** Lista de alts alineada al número de slides (huecos = ''). */
export function altsFromText(text, count) {
  const s = String(text || '').trim();
  const arr = new Array(Math.max(1, count || 1)).fill('');
  if (!s) return arr;
  const re = /(?:^|\n)\s*slide\s*(\d+)\s*[—:–.\-]?\s*([^]*?)(?=\n\s*slide\s*\d+\s*[—:–.\-]?|$)/gi;
  let m; let found = false;
  while ((m = re.exec(s))) {
    found = true;
    const i = parseInt(m[1], 10) - 1;
    if (i >= 0 && i < arr.length) arr[i] = m[2].trim();
  }
  if (!found) arr[0] = s;
  return arr;
}

export function altsToText(alts) {
  const arr = (alts || []).map((a) => String(a || '').trim());
  if (arr.length <= 1) return arr[0] || '';
  return arr.map((a, i) => (a ? `Slide ${i + 1} — ${a}` : '')).filter(Boolean).join('\n\n');
}
