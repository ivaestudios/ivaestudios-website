// ============================================================================
// IVAE Marketing v2 - Esfuerzo y carga de trabajo (workload).
//
// Modulo PURO: sin DOM, sin red, sin store. Lo consumen la vista Carga,
// Timeline y el dashboard.
//
// Modelo:
// - Cada post "pesa" puntos de esfuerzo. Si el post trae un campo numerico
//   `effort` ese valor manda; si no, se estima por content_type con
//   DEFAULT_EFFORT (un reel cuesta mas que una historia).
// - La capacidad se mide en puntos por persona por semana
//   (DEFAULT_WEEKLY_CAPACITY) y utilization() la convierte en niveles
//   semanticos para pintar la vista (sin colores aqui: solo ids de nivel).
// ============================================================================

import {
  addDays, listDays, parseISO, startOfWeek, toISO, todayISO, diffDays,
} from './dates.js?v=202607182156';
import { T } from '../shell/i18n.js?v=202607182156';

/** Puntos por tipo de contenido (claves ya normalizadas, ver normalizeType). */
export const DEFAULT_EFFORT = {
  reel: 3,
  video: 3,
  carrusel: 2,
  carousel: 2,
  galeria: 2,
  post: 1,
  imagen: 1,
  estatico: 1,
  foto: 1,
  historia: 1,
  story: 1,
  stories: 1,
  texto: 1,
  otro: 1,
};

export const EFFORT_FALLBACK = 1;

/** Capacidad semanal sugerida por persona, en puntos. */
export const DEFAULT_WEEKLY_CAPACITY = 15;

/** Niveles de utilizacion (orden ascendente) con etiqueta es-MX. */
export const UTILIZATION_LEVELS = [
  { id: 'baja', max: 0.6, label: T('Con espacio', 'Has room') },
  { id: 'media', max: 0.85, label: T('Equilibrada', 'Balanced') },
  { id: 'alta', max: 1.0, label: T('Casi llena', 'Almost full') },
  { id: 'sobrecarga', max: Infinity, label: T('Sobrecargada', 'Overloaded') },
];

/** minusculas + sin acentos + sin espacios extremos: 'Carrusel ' -> 'carrusel'. */
export function normalizeType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Puntos de un post. Prioridad: post.effort numerico > mapa por tipo >
 * EFFORT_FALLBACK. `map` permite un mapa por cliente sin tocar el default.
 */
export function effortOf(post, map = DEFAULT_EFFORT) {
  if (!post) return 0;
  const explicit = Number(post.effort);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const key = normalizeType(post.content_type);
  const fromMap = map && Object.prototype.hasOwnProperty.call(map, key) ? Number(map[key]) : NaN;
  return Number.isFinite(fromMap) && fromMap > 0 ? fromMap : EFFORT_FALLBACK;
}

export function sumEffort(posts, map = DEFAULT_EFFORT) {
  let total = 0;
  for (const p of posts || []) total += effortOf(p, map);
  return total;
}

/**
 * Responsable de un post. El modelo v2 usa assignee_id; se aceptan alias
 * defensivos por compatibilidad con el legacy. null = sin asignar.
 */
export function getAssignee(post) {
  if (!post) return null;
  return post.assignee_id ?? post.assigned_to ?? post.assignee ?? null;
}

/**
 * Agrupa por responsable: Map<assigneeId|null, {count, points, posts}>.
 * La clave null agrupa lo sin asignar.
 */
export function groupByAssignee(posts, map = DEFAULT_EFFORT) {
  const out = new Map();
  for (const p of posts || []) {
    const key = getAssignee(p);
    if (!out.has(key)) out.set(key, { count: 0, points: 0, posts: [] });
    const g = out.get(key);
    g.count += 1;
    g.points += effortOf(p, map);
    g.posts.push(p);
  }
  return out;
}

/**
 * Carga por dia dentro de un rango inclusivo.
 * Devuelve { byDay: Map<iso, {count, points, posts}>, sinFecha }.
 * Todos los dias del rango existen en el Map (con ceros) para pintar grids.
 */
export function bucketByDay(posts, desdeIso, hastaIso, map = DEFAULT_EFFORT) {
  const byDay = new Map();
  for (const iso of listDays(desdeIso, hastaIso)) {
    byDay.set(iso, { count: 0, points: 0, posts: [] });
  }
  const sinFecha = { count: 0, points: 0, posts: [] };
  for (const p of posts || []) {
    const d = parseISO(p && p.publish_date);
    if (!d) {
      sinFecha.count += 1;
      sinFecha.points += effortOf(p, map);
      sinFecha.posts.push(p);
      continue;
    }
    const iso = toISO(d);
    const bucket = byDay.get(iso);
    if (!bucket) continue; // fuera del rango pedido
    bucket.count += 1;
    bucket.points += effortOf(p, map);
    bucket.posts.push(p);
  }
  return { byDay, sinFecha };
}

/**
 * Carga por semana (lunes a domingo) cubriendo el rango.
 * Devuelve [{ desde, hasta, count, points, posts }] en orden cronologico.
 */
export function bucketByWeek(posts, desdeIso, hastaIso, map = DEFAULT_EFFORT) {
  const start = startOfWeek(desdeIso);
  const end = parseISO(hastaIso);
  if (!start || !end || start.getTime() > end.getTime() + 6 * 86400000) return [];

  const weeks = [];
  const index = new Map(); // desdeIso de la semana -> bucket
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    const desde = toISO(cur);
    const hasta = toISO(addDays(cur, 6));
    const bucket = { desde, hasta, count: 0, points: 0, posts: [] };
    weeks.push(bucket);
    index.set(desde, bucket);
    cur = addDays(cur, 7);
  }

  for (const p of posts || []) {
    const d = parseISO(p && p.publish_date);
    if (!d) continue;
    const wk = startOfWeek(d);
    const bucket = index.get(toISO(wk));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.points += effortOf(p, map);
    bucket.posts.push(p);
  }
  return weeks;
}

/**
 * Matriz persona x semana para la vista Carga:
 * Map<assigneeId|null, { total, weeks: [{desde, hasta, count, points, posts,
 * ratio, level}] }>. `capacity` = puntos por persona por semana.
 */
export function workloadMatrix(posts, desdeIso, hastaIso, {
  map = DEFAULT_EFFORT,
  capacity = DEFAULT_WEEKLY_CAPACITY,
} = {}) {
  const byPerson = groupByAssignee(posts, map);
  const out = new Map();
  for (const [who, group] of byPerson) {
    const weeks = bucketByWeek(group.posts, desdeIso, hastaIso, map).map((w) => {
      const u = utilization(w.points, capacity);
      return { ...w, ratio: u.ratio, level: u.level };
    });
    out.set(who, { total: group.points, count: group.count, weeks });
  }
  return out;
}

/**
 * Convierte puntos vs capacidad en un nivel semantico.
 * Devuelve { ratio, level, label }.
 */
export function utilization(points, capacity = DEFAULT_WEEKLY_CAPACITY) {
  const cap = Number(capacity);
  const pts = Number(points) || 0;
  const ratio = cap > 0 ? pts / cap : (pts > 0 ? Infinity : 0);
  for (const lvl of UTILIZATION_LEVELS) {
    if (ratio <= lvl.max) return { ratio, level: lvl.id, label: lvl.label };
  }
  const last = UTILIZATION_LEVELS[UTILIZATION_LEVELS.length - 1];
  return { ratio, level: last.id, label: last.label };
}

/**
 * Dias habiles (lun-vie) que faltan hasta la fecha (para "se nos viene
 * encima"): hoy cuenta como 0. null si la fecha es invalida.
 */
export function workdaysUntil(iso) {
  const target = parseISO(iso);
  if (!target) return null;
  const total = diffDays(todayISO(), toISO(target));
  if (total === null) return null;
  if (total <= 0) return total; // vencido o hoy: el caller decide
  let count = 0;
  let cur = parseISO(todayISO());
  for (let i = 0; i < total; i++) {
    cur = addDays(cur, 1);
    const dow = (cur.getDay() + 6) % 7;
    if (dow < 5) count += 1;
  }
  return count;
}
