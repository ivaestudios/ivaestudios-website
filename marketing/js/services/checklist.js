// ============================================================================
// IVAE Marketing v2 - Checklist por post (subtareas) + conteos para vistas.
//
// CERO DOM: solo store + api + caches. El editor pinta la lista; tabla,
// tablero y calendario pintan el badge "2/5" con counts.
//
// API v2 (rutas ANIDADAS bajo el post, re-check de ownership server-side):
//   GET    /posts/:id/checklist                  -> {items:[...]} | [...]
//   POST   /posts/:id/checklist                  {label, position} -> {item}
//   PATCH  /posts/:id/checklist/:itemId          {label?|done?|position?} -> {item}
//   DELETE /posts/:id/checklist/:itemId          -> {ok}
//   POST   /posts/:id/checklist/reorder          {updates:[{id, position}]}
//   GET    /posts?...&include=checklist          -> posts con checklist_done/checklist_total
//          (fuente de los counts; no existe un endpoint /checklist/counts)
//
// Item: { id, post_id, text, done(0|1), position } (position sparse x1000).
// El server llama 'label' al texto; este servicio lo expone como 'text' a las
// vistas (y tolera ambos al leer).
//
// Caches (el diseno pide cache de counts):
//   - items por post: TTL 30s (el editor abre fresco casi siempre).
//   - counts por cliente: TTL 60s + ajuste OPTIMISTA en cada mutacion local
//     (sin refetch para pintar el badge al instante).
// DEGRADACION LIMPIA: 404 en los GET de coleccion (list/counts = migracion
// 004 sin aplicar) -> available=false y las vistas ocultan la seccion.
// OJO: un 404 en mutaciones de UN item significa "ese item ya no existe"
// (lo borro alguien mas), NO migracion faltante: rollback + toast + refetch.
//
// Eventos store: 'checklist:changed' {postId} y 'checklist:counts' {clientId}.
// ============================================================================

import { api } from '../api.js?v=202607221924';
import { toast } from '../shell/toast.js?v=202607221924';
import * as store from '../shell/store.js?v=202607221924';
import { T } from '../shell/i18n.js?v=202607221924';

const ITEMS_TTL = 30000;
const COUNTS_TTL = 60000;
const POS_STEP = 1000;
const ERR_SAVE = T('No se pudo guardar, intenta de nuevo.', "Couldn't save, try again.");

let available = true;

const itemsCache = new Map();  // postId -> {at, items:[...]}
const countsCache = new Map(); // clientKey ('todos'|clientId) -> {at, map:{postId:{done,total}}}
let tmpSeq = 0;

export function isAvailable() { return available; }

function markUnavailable() {
  available = false;
  itemsCache.clear();
  countsCache.clear();
}

function is404(e) { return !!(e && e.status === 404); }

function normalizeItems(res) {
  const list = Array.isArray(res) ? res : (res && res.items) || [];
  return list
    .map((it) => ({
      id: it.id,
      post_id: it.post_id,
      text: String(it.text ?? it.label ?? ''),
      done: it.done ? 1 : 0,
      position: Number(it.position) || 0,
      done_by_name: it.done_by_name ?? null,
      done_at: it.done_at ?? null,
    }))
    .sort((a, b) => a.position - b.position);
}

function cacheSet(postId, items) {
  itemsCache.set(postId, { at: Date.now(), items });
}

function cachedItems(postId) {
  const hit = itemsCache.get(postId);
  return hit ? hit.items : null;
}

function emitChanged(postId) {
  store.emit('checklist:changed', { postId });
}

function clientOfPost(postId) {
  const p = store.getState().posts.find((x) => x.id === postId);
  return (p && p.client_id) || null;
}

// ── Items por post ───────────────────────────────────────────────────────────

/** Lista de items del post (cache 30s, `force` para refetch). [] si no hay. */
export async function list(postId, { force = false } = {}) {
  if (!postId || !available) return [];
  const hit = itemsCache.get(postId);
  if (!force && hit && Date.now() - hit.at < ITEMS_TTL) return hit.items;
  try {
    const res = await api.get(`/posts/${encodeURIComponent(postId)}/checklist`);
    const items = normalizeItems(res);
    cacheSet(postId, items);
    return items;
  } catch (e) {
    if (is404(e)) { markUnavailable(); return []; }
    // Error de red: devuelve lo que haya en cache (aunque este viejo).
    return hit ? hit.items : [];
  }
}

/** Progreso sincrono desde caches: {done, total, pct} | null si no sabemos. */
export function progress(postId) {
  const items = cachedItems(postId);
  if (items) {
    const total = items.length;
    const done = items.filter((it) => it.done).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  const c = countsFor(postId);
  if (!c) return null;
  const total = Number(c.total) || 0;
  const done = Number(c.done) || 0;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * Agrega un item al final. Optimista (id temporal) + rollback + toast.
 * Devuelve el item del server o null.
 */
export async function add(postId, text) {
  const txt = String(text || '').trim();
  if (!postId || !txt || !available) return null;

  const prev = cachedItems(postId) || [];
  const position = (prev.length ? prev[prev.length - 1].position : 0) + POS_STEP;
  const tmp = { id: `tmp-${++tmpSeq}`, post_id: postId, text: txt, done: 0, position };
  cacheSet(postId, [...prev, tmp]);
  adjustCounts(postId, 0, +1);
  emitChanged(postId);

  try {
    const res = await api.post(`/posts/${encodeURIComponent(postId)}/checklist`, { label: txt, position });
    const item = normalizeItems([(res && res.item) || res])[0] || null;
    const cur = cachedItems(postId) || [];
    cacheSet(postId, cur.map((it) => (it.id === tmp.id && item ? item : it)));
    emitChanged(postId);
    return item;
  } catch (e) {
    cacheSet(postId, prev);
    adjustCounts(postId, 0, -1);
    emitChanged(postId);
    toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return null;
  }
}

/** Marca o desmarca un item. Optimista + rollback + toast. */
export async function setDone(postId, itemId, done) {
  const prev = cachedItems(postId);
  if (!prev || !available) return false;
  const target = prev.find((it) => it.id === itemId);
  if (!target || !!target.done === !!done) return true;

  cacheSet(postId, prev.map((it) => (it.id === itemId ? { ...it, done: done ? 1 : 0 } : it)));
  adjustCounts(postId, done ? +1 : -1, 0);
  emitChanged(postId);

  try {
    await api.patch(`/posts/${encodeURIComponent(postId)}/checklist/${encodeURIComponent(itemId)}`, { done: done ? 1 : 0 });
    return true;
  } catch (e) {
    cacheSet(postId, prev);
    adjustCounts(postId, done ? -1 : +1, 0);
    emitChanged(postId);
    if (is404(e)) {
      toast(T('Ese pendiente ya no existe.', 'That to-do no longer exists.'), { type: 'error' });
      list(postId, { force: true });
    } else {
      toast((e && e.message) || ERR_SAVE, { type: 'error' });
    }
    return false;
  }
}

/** Renombra un item. Optimista + rollback + toast. */
export async function rename(postId, itemId, text) {
  const txt = String(text || '').trim();
  const prev = cachedItems(postId);
  if (!prev || !txt || !available) return false;

  cacheSet(postId, prev.map((it) => (it.id === itemId ? { ...it, text: txt } : it)));
  emitChanged(postId);
  try {
    await api.patch(`/posts/${encodeURIComponent(postId)}/checklist/${encodeURIComponent(itemId)}`, { label: txt });
    return true;
  } catch (e) {
    cacheSet(postId, prev);
    emitChanged(postId);
    if (is404(e)) {
      toast(T('Ese pendiente ya no existe.', 'That to-do no longer exists.'), { type: 'error' });
      list(postId, { force: true });
    } else {
      toast((e && e.message) || ERR_SAVE, { type: 'error' });
    }
    return false;
  }
}

/** Elimina un item. Optimista + rollback + toast. */
export async function remove(postId, itemId) {
  const prev = cachedItems(postId);
  if (!prev || !available) return false;
  const target = prev.find((it) => it.id === itemId);
  if (!target) return true;

  cacheSet(postId, prev.filter((it) => it.id !== itemId));
  adjustCounts(postId, target.done ? -1 : 0, -1);
  emitChanged(postId);

  try {
    await api.del(`/posts/${encodeURIComponent(postId)}/checklist/${encodeURIComponent(itemId)}`);
    return true;
  } catch (e) {
    if (is404(e)) {
      // Ya estaba borrado en el server: el optimista queda como verdad.
      return true;
    }
    cacheSet(postId, prev);
    adjustCounts(postId, target.done ? +1 : 0, +1);
    emitChanged(postId);
    toast((e && e.message) || T('No se pudo eliminar.', "Couldn't delete."), { type: 'error' });
    return false;
  }
}

/**
 * Reordena con la lista completa de ids en su nuevo orden. Posiciones sparse
 * x1000 en el MISMO batch. Optimista + rollback + toast.
 */
export async function reorderItems(postId, orderedIds) {
  const prev = cachedItems(postId);
  if (!prev || !available || !Array.isArray(orderedIds)) return false;

  const byId = new Map(prev.map((it) => [it.id, it]));
  const next = [];
  const updates = [];
  orderedIds.forEach((id, i) => {
    const it = byId.get(id);
    if (!it) return;
    const position = (i + 1) * POS_STEP;
    next.push({ ...it, position });
    if (it.position !== position) updates.push({ id, position });
  });
  if (next.length !== prev.length || !updates.length) return !updates.length;

  cacheSet(postId, next);
  emitChanged(postId);
  try {
    try {
      await api.post(`/posts/${encodeURIComponent(postId)}/checklist/reorder`, { updates });
    } catch (e) {
      if (!e || (e.status !== 404 && e.status !== 405)) throw e;
      // Fallback: PATCH por item.
      await Promise.all(updates.map((u) =>
        api.patch(`/posts/${encodeURIComponent(postId)}/checklist/${encodeURIComponent(u.id)}`, { position: u.position })
      ));
    }
    return true;
  } catch (e) {
    cacheSet(postId, prev);
    emitChanged(postId);
    toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return false;
  }
}

// ── Counts por cliente (badge "2/5" en las vistas) ──────────────────────────

function normalizeCounts(res) {
  // Fuente real: GET /posts?...&include=checklist -> [{id, checklist_done,
  // checklist_total, ...}]. Solo entran al mapa los posts con checklist.
  const list = Array.isArray(res) ? res : (res && res.posts) || [];
  const map = {};
  for (const p of list) {
    if (!p || !p.id) continue;
    const total = Number(p.checklist_total) || 0;
    if (!total) continue;
    map[p.id] = { done: Number(p.checklist_done) || 0, total };
  }
  return map;
}

/**
 * Conteos {postId: {done,total}} del cliente (o de todos con 'todos').
 * Cache 60s; `force` refetch. {} si el endpoint no esta o hay error.
 * No existe /checklist/counts en el backend: se deriva de GET /posts con
 * ?include=checklist (un solo request, GROUP BY server-side).
 */
export async function counts(clientId = store.getState().activeClientId, { force = false } = {}) {
  if (!available || !clientId) return {};
  const key = clientId === 'todos' ? 'todos' : String(clientId);
  const hit = countsCache.get(key);
  if (!force && hit && Date.now() - hit.at < COUNTS_TTL) return hit.map;
  try {
    const qs = key === 'todos' ? 'scope=all' : `client_id=${encodeURIComponent(key)}`;
    const res = await api.get(`/posts?${qs}&include=checklist`);
    const map = normalizeCounts(res);
    countsCache.set(key, { at: Date.now(), map });
    store.emit('checklist:counts', { clientId: key });
    return map;
  } catch (e) {
    if (is404(e)) { markUnavailable(); return {}; }
    return hit ? hit.map : {};
  }
}

/** Lookup sincrono en los counts ya cargados. null si no sabemos. */
export function countsFor(postId) {
  for (const { map } of countsCache.values()) {
    if (map[postId]) return map[postId];
  }
  return null;
}

/** Invalida counts (de un cliente o todos) para forzar refetch. */
export function invalidateCounts(clientId = null) {
  if (clientId) countsCache.delete(String(clientId));
  else countsCache.clear();
}

/** Ajuste optimista del badge sin esperar refetch. */
function adjustCounts(postId, dDone, dTotal) {
  const clientId = clientOfPost(postId);
  let touched = false;
  for (const [key, entry] of countsCache) {
    if (key !== 'todos' && clientId && key !== String(clientId)) continue;
    const cur = entry.map[postId] || { done: 0, total: 0 };
    const next = {
      done: Math.max(0, cur.done + dDone),
      total: Math.max(0, cur.total + dTotal),
    };
    if (next.total === 0) delete entry.map[postId];
    else entry.map[postId] = next;
    touched = true;
  }
  if (touched) store.emit('checklist:counts', { clientId });
}

// Un post borrado se lleva su checklist y su badge.
store.on('post:deleted', ({ id } = {}) => {
  if (!id) return;
  itemsCache.delete(id);
  let touched = false;
  for (const entry of countsCache.values()) {
    if (entry.map[id]) { delete entry.map[id]; touched = true; }
  }
  if (touched) store.emit('checklist:counts', { clientId: null });
});
