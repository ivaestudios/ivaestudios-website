// ============================================================================
// IVAE Marketing — Tema (Oscuro por defecto / Claro opcional).
//
// La ELECCIÓN del usuario vive en localStorage 'mkt_theme' ('light'|'dark');
// si no ha elegido, manda el DEFAULT POR ROL cacheado en 'mkt_theme_def'
// (los CLIENTES arrancan en claro, pedido 2026-08-26; staff en oscuro). Se
// aplica poniendo data-theme="light" en <html>. Un script inline en el <head>
// de app.html/index.html lo aplica ANTES de pintar (cero flash); este módulo
// expone el estado y el cambio EN VIVO (sin recargar: los tokens CSS conmutan
// solos). La capa visual vive en css/theme-light.css (cargada al final).
// ============================================================================

const KEY = 'mkt_theme';       // elección EXPLÍCITA del usuario
const DEF = 'mkt_theme_def';   // default por ROL (se cachea al conocer el rol)

// Colores del chrome del navegador/PWA por tema (meta theme-color).
const META_DARK = '#0A0A0E';
const META_LIGHT = '#F6F6FA';

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
    return localStorage.getItem(DEF) === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
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
  // Se guarda SIEMPRE explícito (también 'dark'): así la elección del usuario
  // le gana al default por rol y un cliente que prefiere oscuro se queda ahí.
  try { localStorage.setItem(KEY, t); } catch { /* sin storage: no persiste */ }
  applyTheme(t);
}

/** Default por ROL: los CLIENTES arrancan en claro; staff en oscuro. Solo
 *  pesa si el usuario no ha elegido tema; se cachea para el próximo arranque
 *  (el inline del <head> lo lee y pinta sin flash). */
export function setRoleDefault(role) {
  try {
    if (role === 'client') localStorage.setItem(DEF, 'light');
    else localStorage.removeItem(DEF);
  } catch { /* noop */ }
  applyTheme(getTheme());
}

// Al importar: asegura que el atributo y el meta reflejen lo guardado (el boot
// inline del <head> ya lo hizo antes de pintar; esto solo re-sincroniza).
applyTheme(getTheme());
