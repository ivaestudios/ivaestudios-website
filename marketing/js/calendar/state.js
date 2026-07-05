// ============================================================================
// IVAE Marketing v2 — Calendario: estado LOCAL de la vista (singleton).
//
// Vive fuera del store global: modo, cursor de mes/semana, dia seleccionado
// (agenda movil) y paneles abiertos son UI propia del calendario. Los filtros
// NO viven aqui: son la URL (store.filters), fuente unica de verdad.
//
// Persistencia via prefs (claves reservadas del contrato: calMode, calMini,
// calFilters; calBacklog usa el mismo namespace del modulo prefs).
// ============================================================================

import * as prefs from '../shell/prefs.js?v=202607051330';
import { fmtYMD, parseYMD, startOfMonth } from './data.js?v=202607051330';

const st = {
  mode: 'mes',                        // 'mes' | 'semana' (en <768px siempre agenda)
  cursor: startOfMonth(new Date()),   // ancla del mes/semana visibles
  selectedDay: fmtYMD(new Date()),    // 'YYYY-MM-DD' del dia activo en agenda
  miniOpen: true,                     // mini-mes visible (movil)
  backlogOpen: false,                 // panel Sin fecha (desktop)
};

const listeners = new Set();

export function get() { return st; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  for (const fn of [...listeners]) {
    try { fn(st); } catch (e) { console.error('[cal:state] listener', e); }
  }
}

export function patch(p) {
  let changed = false;
  for (const [k, v] of Object.entries(p || {})) {
    if (st[k] !== v) { st[k] = v; changed = true; }
  }
  if (changed) emitChange();
}

/** Restaura preferencias y resetea cursor/dia al presente. Llamar en mount. */
export function initFromPrefs() {
  st.mode = prefs.get('calMode') === 'semana' ? 'semana' : 'mes';
  st.miniOpen = prefs.get('calMini', true) !== false;
  st.backlogOpen = prefs.get('calBacklog', false) === true;
  st.cursor = startOfMonth(new Date());
  st.selectedDay = fmtYMD(new Date());
}

export function setMode(mode) {
  if (mode !== 'mes' && mode !== 'semana') return;
  prefs.set('calMode', mode);
  patch({ mode });
}

export function setMiniOpen(open) {
  prefs.set('calMini', !!open);
  patch({ miniOpen: !!open });
}

export function setBacklogOpen(open) {
  prefs.set('calBacklog', !!open);
  patch({ backlogOpen: !!open });
}

/** Selecciona un dia (agenda); el cursor sigue al mes del dia elegido. */
export function selectDay(day) {
  const d = parseYMD(day);
  if (!d) return;
  patch({ selectedDay: fmtYMD(d), cursor: startOfMonth(d) });
}

/** Lleva cursor y dia seleccionado a hoy. */
export function goToday() {
  const now = new Date();
  patch({ selectedDay: fmtYMD(now), cursor: startOfMonth(now) });
}
