// ============================================================================
// IVAE Marketing — Tema (CLARO por defecto / Oscuro opcional).
//
// Regla de la dueña (2026-09-08): la app arranca en CLARO para TODOS, cliente
// o staff. El que quiera oscuro lo elige él mismo con el interruptor y su
// elección manda para siempre. La ELECCIÓN vive en localStorage 'mkt_theme'
// ('light'|'dark'); sin elección, CLARO. Ya no hay default por rol: el viejo
// 'mkt_theme_def' se borra al arrancar. Se aplica poniendo data-theme="light"
// en <html> (el oscuro es la ausencia del atributo). Un script inline en el <head>
// de app.html/index.html lo aplica ANTES de pintar (cero flash); este módulo
// expone el estado y el cambio EN VIVO (sin recargar: los tokens CSS conmutan
// solos). La capa visual vive en css/theme-light.css (cargada al final).
// ============================================================================

const KEY = 'mkt_theme';       // elección EXPLÍCITA del usuario
const DEF = 'mkt_theme_def';   // LEGADO: default por rol, ya sin uso (se borra)

// Colores del chrome del navegador/PWA por tema (meta theme-color).
const META_DARK = '#0A0A0E';
const META_LIGHT = '#F6F6FA';

export function getTheme() {
  // CLARO salvo que el usuario haya pedido oscuro a mano. Si localStorage
  // truena (Safari privado), también claro: el default nunca debe ser oscuro.
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
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

/** LEGADO. Ya no hay default por rol: todos arrancan en claro. Se conserva la
 *  función porque el shell la llama al conocer el rol, y de paso limpia la
 *  llave vieja para que no quede basura en el navegador de nadie. */
export function setRoleDefault() {
  try { localStorage.removeItem(DEF); } catch { /* noop */ }
  applyTheme(getTheme());
}

// Al importar: asegura que el atributo y el meta reflejen lo guardado (el boot
// inline del <head> ya lo hizo antes de pintar; esto solo re-sincroniza).
applyTheme(getTheme());
