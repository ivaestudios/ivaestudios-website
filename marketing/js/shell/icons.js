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
  filter:    'M22 4H2l8 9v6l4 2v-8z',
  briefcase: 'M3 8h18v12H3zM8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18',
  zap:       'M13 2 3 14h7l-1 8 11-13h-7z',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  trash:     'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  link:      'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  copy:      'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  spark:     'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  archive:   'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  scissors:  'M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M20 4L8.5 15.5M14.5 14.5L20 20M8.5 8.5L12 12',
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
