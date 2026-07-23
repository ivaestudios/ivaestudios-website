// ============================================================================
// IVAE Marketing — Tema (Oscuro por defecto / Claro opcional).
//
// El tema se guarda en localStorage 'mkt_theme' ('light' | ausente=oscuro) y se
// aplica poniendo data-theme="light" en <html>. Un script inline en el <head>
// de app.html/index.html lo aplica ANTES de pintar (cero flash); este módulo
// expone el estado y el cambio EN VIVO (sin recargar: los tokens CSS conmutan
// solos). La capa visual vive en css/theme-light.css (cargada al final).
// ============================================================================

const KEY = 'mkt_theme';

// Colores del chrome del navegador/PWA por tema (meta theme-color).
const META_DARK = '#0A0A0E';
const META_LIGHT = '#F6F6FA';

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export const isLight = () => getTheme() === 'light';

function syncMeta(theme) {
  try {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'light' ? META_LIGHT : META_DARK);
  } catch { /* noop */ }
}

/** Aplica el tema al documento (atributo + meta). No persiste. */
export function applyTheme(theme) {
  try {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  } catch { /* noop */ }
  syncMeta(theme);
}

/** Cambia el tema de TODA la app EN VIVO (sin recargar) y lo persiste. */
export function setTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  try {
    if (t === 'light') localStorage.setItem(KEY, 'light');
    else localStorage.removeItem(KEY);
  } catch { /* sin storage: no persiste */ }
  applyTheme(t);
}

// Al importar: asegura que el atributo y el meta reflejen lo guardado (el boot
// inline del <head> ya lo hizo antes de pintar; esto solo re-sincroniza).
applyTheme(getTheme());
