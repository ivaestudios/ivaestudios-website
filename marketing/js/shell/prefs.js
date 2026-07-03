// ============================================================================
// IVAE Marketing v2 — Preferencias de usuario (localStorage namespaced).
//
// Contrato (ARCHITECTURE.md):
//   - Namespace: mkt2.<userId>.<clave>  (JSON seguro, try/catch, default).
//   - Claves del shell: lastClient, lastView.<clientId>, recentSearches (max 8),
//     density ('comoda'|'compacta'), returnTo.
//   - Claves reservadas para vistas (mismo helper): collapsedGroups.<view>.<clientId>,
//     boardCols, calMode, calFilters, calMini, tableSort, tableCols, cardFields,
//     swimlane, tlScale, tlCollapsed.<clientId>, dashScope, savedViewActive.<clientId>.
//   - migrate(): copia UNA sola vez mkt.view / mkt.client del legacy SIN borrar
//     las claves viejas (rollback al frontend v3 sigue siendo posible).
//   - sessionStorage mkt.jump (drill-down del dashboard) se consume una vez.
//
// Las vistas NUNCA tocan localStorage directo: siempre via este modulo.
// ============================================================================

let userId = 'anon';

function ns(key) { return `mkt2.${userId}.${key}`; }

/** Fija el usuario activo del namespace. Llamado por shell.boot() tras /auth/me. */
export function init(id) {
  userId = id ? String(id) : 'anon';
}

/** Lee una preferencia (JSON seguro). Devuelve `def` si no existe o esta corrupta. */
export function get(key, def = null) {
  try {
    const raw = localStorage.getItem(ns(key));
    if (raw == null) return def;
    return JSON.parse(raw);
  } catch {
    return def;
  }
}

/** Guarda una preferencia (JSON). Silencioso si localStorage no esta disponible. */
export function set(key, value) {
  try {
    if (value === undefined) { localStorage.removeItem(ns(key)); return; }
    localStorage.setItem(ns(key), JSON.stringify(value));
  } catch { /* storage lleno o bloqueado: la app sigue */ }
}

/** Borra una preferencia. */
export function remove(key) {
  try { localStorage.removeItem(ns(key)); } catch { /* noop */ }
}

// ── Migracion unica desde el legacy (mkt.view / mkt.client) ─────────────────
// Mapa de ids de vista v1 -> v2.
const LEGACY_VIEW_MAP = { calendar: 'calendario', board: 'tablero', list: 'tabla' };

/**
 * Copia las preferencias del frontend legacy UNA sola vez por usuario.
 * NO borra mkt.view / mkt.client: el rollback instantaneo al v3 las necesita.
 */
export function migrate() {
  // 2026-06-10: la vista Meses (flujo Notion) pasa a ser la pantalla principal.
  // Reset UNICO de las vistas recordadas para que todos aterricen ahi una vez.
  if (!get('mesesIntro')) {
    set('mesesIntro', true);
    set('lastViewDefault', 'meses');
    try {
      const pre = ns('lastView.');
      Object.keys(localStorage).filter((k) => k.startsWith(pre)).forEach((k) => localStorage.removeItem(k));
    } catch { /* sin storage: nada que resetear */ }
  }
  if (get('migrated', false)) return;
  try {
    const legacyClient = localStorage.getItem('mkt.client');
    const legacyView = localStorage.getItem('mkt.view');
    const mapped = LEGACY_VIEW_MAP[legacyView] || null;
    if (legacyClient) {
      set('lastClient', legacyClient);
      if (mapped) set(`lastView.${legacyClient}`, mapped);
    }
    if (mapped) set('lastViewDefault', mapped);
  } catch { /* sin storage: nada que migrar */ }
  set('migrated', true);
}

// ── Helpers de alto nivel usados por el shell ────────────────────────────────

/**
 * Vistas de contenido por cliente (lista CANONICA: la consumen el seg del
 * subhead en shell.js, el tab Contenido del bottom-nav y este whitelist).
 */
export const CONTENT_VIEWS = ['meses', 'calendario', 'entregables', 'carrusel', 'tablero', 'tabla', 'timeline', 'carga'];

/** Ultima vista de contenido usada para un cliente (whitelist CONTENT_VIEWS). */
export function lastContentView(clientId) {
  const v = get(`lastView.${clientId}`) || get('lastViewDefault') || 'meses';
  return CONTENT_VIEWS.includes(v) ? v : 'meses';
}

export function setLastContentView(clientId, view) {
  if (!CONTENT_VIEWS.includes(view)) return;
  set(`lastView.${clientId}`, view);
  set('lastViewDefault', view);
}

/** Busquedas recientes (max 8, sin duplicados, la mas nueva primero). */
export function pushRecentSearch(q) {
  const txt = String(q || '').trim();
  if (!txt) return;
  const list = get('recentSearches', []).filter((s) => s !== txt);
  list.unshift(txt);
  set('recentSearches', list.slice(0, 8));
}

export function removeRecentSearch(q) {
  set('recentSearches', get('recentSearches', []).filter((s) => s !== q));
}

/** Drill-down del dashboard: sessionStorage mkt.jump, se consume UNA vez. */
export function takeJump() {
  try {
    const raw = sessionStorage.getItem('mkt.jump');
    if (raw == null) return null;
    sessionStorage.removeItem('mkt.jump');
    return JSON.parse(raw);
  } catch { return null; }
}

export function setJump(data) {
  try { sessionStorage.setItem('mkt.jump', JSON.stringify(data)); } catch { /* noop */ }
}
