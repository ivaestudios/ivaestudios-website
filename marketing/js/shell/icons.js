// ============================================================================
// IVAE Marketing v2 — Iconos SVG estaticos.
// UNICO modulo de toda la app v2 donde se permite innerHTML (SVG estatico,
// jamas interpolando datos de usuario).
//
// icon(name, size?) -> <span class="ico"> con el SVG de 24-grid en stroke.
// ============================================================================

const PATHS = {
  home:      'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  calendar:  'M3 9h18M7 3v3M17 3v3M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  board:     'M4 4h6v16H4zM14 4h6v9h-6z',
  table:     'M3 5h18v14H3zM3 10h18M9 5v14',
  search:    'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  bell:      'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  user:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  users:     'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  plus:      'M12 5v14M5 12h14',
  close:     'M6 6l12 12M18 6L6 18',
  check:     'M20 6 9 17l-5-5',
  left:      'M15 18l-6-6 6-6',
  right:     'M9 18l6-6-6-6',
  down:      'M6 9l6 6 6-6',
  up:        'M18 15l-6-6-6 6',
  clock:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  dots:      'M12 5.5h.01M12 12h.01M12 18.5h.01',
  send:      'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  logout:    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  key:       'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7-7 5 5 0 0 1 7 7zM15 7l3 3M18 4l3 3',
  activity:  'M22 12h-4l-3 9L9 3l-3 9H2',
  // Chispas: el gesto universal de "esto lo hizo la IA".
  sparkles:  'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM5 2.5l.6 1.4 1.4.6-1.4.6L5 6.5l-.6-1.4L3 4.5l1.4-.6z',
  filter:    'M22 4H2l8 9v6l4 2v-8z',
  briefcase: 'M3 8h18v12H3zM8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18',
  zap:       'M13 2 3 14h7l-1 8 11-13h-7z',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  trash:     'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  link:      'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  globe:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  moon:      'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  sun:       'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  copy:      'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  spark:     'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  archive:   'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  scissors:  'M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M20 4L8.5 15.5M14.5 14.5L20 20M8.5 8.5L12 12',
  download:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  book:      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  inbox:     'M22 12h-6l-2 3h-4l-2-3H2M5 5h14l3 7v7H2v-7z',
  gantt:     'M3 5h8M7 12h10M11 19h8',
  gauge:     'M12 15l3.5-3.5M5 19a9 9 0 1 1 14 0',
  refresh:   'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6',
  eye:       'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  warning:   'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  settings:  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09c0-.7-.4-1.3-1-1.51a1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.7 0 1.3-.4 1.51-1a1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.5.5 1.2.6 1.82.33.6-.21 1-.81 1-1.51V3a2 2 0 1 1 4 0v.09c0 .7.4 1.3 1 1.51.62.27 1.32.17 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82c.21.6.81 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.7 0-1.3.4-1.51 1z',
  grip:      'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  camera:    'M3 8.5a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 15.7a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4',
  sliders:   'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  sort:      'M8 4v16M4 8l4-4 4 4M16 20V4M20 16l-4 4-4-4',
  // Sin conexión (arcos de wifi cortados por una diagonal). OJO: icon() parte
  // el string por 'M', así que cada subtrazo TIENE que empezar con M.
  'wifi-off': 'M2 3l19 19M5.6 12.6a9 9 0 0 1 4.2-2.3M9 16.1a4.5 4.5 0 0 1 2-1.05M12 19.6h.01M16.9 13a9 9 0 0 0-2.6-2.1M2.4 9a15 15 0 0 1 6.2-3.7M13.5 5.1A15 15 0 0 1 21.6 9',
};

/**
 * Crea un icono. `name` debe existir en PATHS (fallback: spark).
 * `size` en px (default 20). Devuelve <span class="ico" aria-hidden>.
 */
export function icon(name, size = 20) {
  const d = PATHS[name] || PATHS.spark;
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${Number(size) || 20}" height="${Number(size) || 20}" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    d.split('M').filter(Boolean).map((p) => `<path d="M${p.trim()}"/>`).join('') +
    `</svg>`;
  return span;
}

/** Lockup de marca IVAE Marketing (splash / topbar). */
export function logoLockup() {
  const mark = document.createElement('span');
  mark.className = 'logo__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 8.5a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
    '<circle cx="12" cy="12.5" r="3.2"/></svg>';
  const word = document.createElement('span');
  word.className = 'logo__word';
  const b = document.createElement('b'); b.textContent = 'IVAE';
  const grad = document.createElement('span'); grad.className = 'grad-text'; grad.textContent = 'Marketing';
  word.append(b, grad);
  const lockup = document.createElement('span');
  lockup.className = 'logo';
  lockup.append(mark, word);
  return lockup;
}

export const ICON_NAMES = Object.keys(PATHS);

/**
 * Logos de red social. NO se dibujan con trazo como el resto de los iconos:
 * un logo de marca se reconoce por su silueta RELLENA. Por eso viven aparte,
 * con su propio render (fill, sin stroke) y el path completo sin partir.
 */
const MARCAS = {
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8M18.41 4.15a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88',
  facebook:  'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07',
  linkedin:  'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13M7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0',
  tiktok:    'M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.77.12v-3.1a5.7 5.7 0 0 0-.77-.05 5.7 5.7 0 1 0 5.7 5.7V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.25-1.48',
  youtube:   'M23.5 6.2a3 3 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8M9.55 15.57V8.43L15.82 12z',
};

export function iconMarca(name, size = 18) {
  const d = MARCAS[name];
  if (!d) return null;
  const span = document.createElement('span');
  span.className = 'ico ico--marca';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${Number(size) || 18}" height="${Number(size) || 18}" ` +
    `fill="currentColor" stroke="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${d}"/></svg>`;
  return span;
}
