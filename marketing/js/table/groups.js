// ============================================================================
// IVAE Marketing v2 - Vista Tabla: motor de agrupacion.
//
// Estrategias:
//   'month'  -> claves YYYY-MM ordenadas cronologicamente; 'Sin fecha' SIEMPRE
//               al final (backlog). Color = brand_color del cliente activo.
//   'status' -> STATUS_ORDER con color --st-*; status desconocidos caen al
//               bucket 'Otros' (NUNCA invisibles, fix del bug del kanban v1).
//   'none'   -> un solo grupo "Todos los contenidos".
//
// Tambien: comparadores de sort dentro de cada grupo, battery bar de
// distribucion por status y persistencia del colapso por cliente + modo
// (pref 'collapsedGroups.tabla.<clientKey>' = { month:[], status:[], none:[] }).
//
// Modulo sin estado propio: recibe prefs/posts del orquestador (table.js).
// ============================================================================

import { el, STATUSES, STATUS_ORDER, statusLabel } from '../api.js?v=202606142255';
import { fmtMonthYear, todayISO } from '../lib/dates.js?v=202606142255';
import { sortValueOf } from './columns.js?v=202606142255';

export const SIN_FECHA_KEY = 'sin-fecha';
export const OTHERS_KEY = 'otros';
export const OTHERS_LABEL = 'Otros';
export const NONE_KEY = 'todos';
export const POSITION_STEP = 1000;

export const GROUP_MODES = [
  { value: 'month', label: 'Mes' },
  { value: 'status', label: 'Estado' },
  { value: 'none', label: 'Sin grupos' },
];

export function groupModeLabel(mode) {
  const m = GROUP_MODES.find((x) => x.value === mode);
  return m ? m.label : 'Mes';
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function safeColor(c, fallback) {
  return HEX_RE.test(String(c || '')) ? c : fallback;
}

// ── Claves de grupo ──────────────────────────────────────────────────────────

export function monthKeyOf(post) {
  const d = String((post && post.publish_date) || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(d) ? d : SIN_FECHA_KEY;
}

export function statusKeyOf(post) {
  const s = post && post.status;
  return STATUSES[s] ? s : OTHERS_KEY;
}

export function monthLabel(key) {
  if (key === SIN_FECHA_KEY) return 'Sin fecha';
  return fmtMonthYear(`${key}-01`) || key;
}

export function currentMonthKey() {
  return todayISO().slice(0, 7);
}

// ── Agrupacion ───────────────────────────────────────────────────────────────

/**
 * Agrupa posts (YA filtrados) segun el modo. Devuelve
 * [{ key, label, color, posts }] en orden de presentacion. Grupos vacios se
 * omiten (excepto 'none', que siempre devuelve su unico grupo).
 */
export function groupPosts(posts, mode, { brandColor } = {}) {
  const list = Array.isArray(posts) ? posts : [];
  const accent = safeColor(brandColor, 'var(--client-accent)');

  if (mode === 'none') {
    return [{ key: NONE_KEY, label: 'Todos los contenidos', color: accent, posts: list }];
  }

  if (mode === 'status') {
    const map = new Map();
    for (const p of list) {
      const k = statusKeyOf(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    const out = [];
    for (const s of STATUS_ORDER) {
      const bucket = map.get(s);
      if (!bucket || !bucket.length) continue;
      out.push({ key: s, label: STATUSES[s].label, color: STATUSES[s].color, posts: bucket });
    }
    const others = map.get(OTHERS_KEY);
    if (others && others.length) {
      out.push({ key: OTHERS_KEY, label: OTHERS_LABEL, color: 'var(--text-mute)', posts: others });
    }
    return out;
  }

  // mode === 'month' (default)
  const map = new Map();
  for (const p of list) {
    const k = monthKeyOf(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  const monthKeys = [...map.keys()].filter((k) => k !== SIN_FECHA_KEY).sort();
  const out = monthKeys.map((k) => ({
    key: k, label: monthLabel(k), color: accent, posts: map.get(k),
  }));
  const undated = map.get(SIN_FECHA_KEY);
  if (undated && undated.length) {
    out.push({ key: SIN_FECHA_KEY, label: 'Sin fecha', color: 'var(--text-mute)', posts: undated });
  }
  return out;
}

// ── Sort dentro de cada grupo ────────────────────────────────────────────────

function defaultCompare(a, b) {
  const pa = Number(a.position) || 0;
  const pb = Number(b.position) || 0;
  if (pa !== pb) return pa - pb;
  return String(a.created_at || '').localeCompare(String(b.created_at || ''));
}

/**
 * Ordena una copia del arreglo. sort = {key, dir:'asc'|'desc'} | null
 * (null = orden default: position ASC + created_at). allCols alimenta
 * sortValueOf (registro de columnas + 'titulo'/'posicion').
 */
export function sortPosts(posts, sort, allCols) {
  const list = [...(posts || [])];
  if (!sort || !sort.key) return list.sort(defaultCompare);
  const mul = sort.dir === 'desc' ? -1 : 1;
  return list.sort((a, b) => {
    const va = sortValueOf(sort.key, a, allCols);
    const vb = sortValueOf(sort.key, b, allCols);
    let cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), 'es');
    if (cmp !== 0) return cmp * mul;
    return defaultCompare(a, b);
  });
}

// ── Battery bar (distribucion por status) ────────────────────────────────────

/** [{key,label,color,count}] de los status presentes, en orden de pipeline. */
export function batteryData(posts) {
  const counts = new Map();
  for (const p of posts || []) {
    const k = statusKeyOf(p);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = [];
  for (const s of STATUS_ORDER) {
    const n = counts.get(s);
    if (n) out.push({ key: s, label: STATUSES[s].label, color: STATUSES[s].color, count: n });
  }
  const others = counts.get(OTHERS_KEY);
  if (others) out.push({ key: OTHERS_KEY, label: OTHERS_LABEL, color: 'var(--text-mute)', count: others });
  return out;
}

/**
 * Nodo .etable-batt: segmentos flex-grow proporcionales con title de
 * desglose textual (accesible, no solo color).
 */
export function buildBattery(posts) {
  const data = batteryData(posts);
  const total = data.reduce((s, d) => s + d.count, 0);
  const title = data.length
    ? data.map((d) => `${d.label}: ${d.count}`).join(' · ')
    : 'Sin contenidos';
  const bar = el('div', { class: 'etable-batt', role: 'img', 'aria-label': title, title });
  if (!total) {
    bar.appendChild(el('span', { class: 'etable-batt__seg etable-batt__seg--empty', style: { flexGrow: '1' } }));
    return bar;
  }
  for (const d of data) {
    bar.appendChild(el('span', {
      class: 'etable-batt__seg',
      style: { flexGrow: String(d.count), background: d.color },
    }));
  }
  return bar;
}

// ── Defaults heredados para el quick-add por grupo ───────────────────────────

/**
 * {publish_date?, status?} que hereda un post creado dentro del grupo.
 * Mes: dia 1 de ese mes. Estado: ese status. Sin fecha / Otros / none: {}.
 */
export function defaultsForGroup(group, mode) {
  if (!group) return {};
  if (mode === 'month') {
    if (group.key === SIN_FECHA_KEY) return { publish_date: null };
    return { publish_date: `${group.key}-01` };
  }
  if (mode === 'status') {
    if (group.key === OTHERS_KEY) return {};
    return { status: group.key };
  }
  return {};
}

/** position sparse: max del grupo + 1000 (mismo paso que el tablero). */
export function nextPositionIn(posts) {
  let max = 0;
  for (const p of posts || []) {
    const n = Number(p.position);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + POSITION_STEP;
}

// ── Persistencia del colapso (pref 'collapsedGroups.tabla.<clientKey>') ──────

function collapseKey(clientKey) {
  return `collapsedGroups.tabla.${clientKey}`;
}

export function readCollapsed(prefs, clientKey, mode) {
  const all = prefs.get(collapseKey(clientKey), null);
  if (!all || typeof all !== 'object') return null; // null = sin pref aun
  const list = all[mode];
  return Array.isArray(list) ? list : null;
}

export function writeCollapsed(prefs, clientKey, mode, keys) {
  const all = prefs.get(collapseKey(clientKey), {}) || {};
  all[mode] = [...new Set(keys || [])];
  prefs.set(collapseKey(clientKey), all);
}

/**
 * Colapso inicial cuando NO hay pref guardada. En movil + modo mes: todos
 * colapsados EXCEPTO el mes actual (o el primer grupo con contenido): la
 * pantalla inicial es un indice de baterias. En desktop: todo expandido.
 */
export function initialCollapsed(groups, mode, isMobile) {
  if (!isMobile || mode !== 'month') return [];
  const list = groups || [];
  if (!list.length) return [];
  const cur = currentMonthKey();
  const open = list.some((g) => g.key === cur) ? cur : list[0].key;
  return list.map((g) => g.key).filter((k) => k !== open);
}

export { statusLabel };
