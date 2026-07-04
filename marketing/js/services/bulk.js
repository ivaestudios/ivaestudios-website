// ============================================================================
// IVAE Marketing v2 - Acciones masivas sobre posts (seleccion multiple).
//
// CERO DOM: este modulo solo habla con store + api. Las vistas (tabla,
// tablero, calendario) pintan la barra de seleccion y llaman estas funciones.
//
// Contrato:
//   selection: getSelection(), count(), isSelected(id), toggle(id),
//              select(ids), deselect(ids), clear()
//              -> cada cambio emite store 'bulk:selection' {ids, count}
//   bulkUpdate(ids, fields)        -> {ok, count, undo}
//   bulkSetStatus(ids, status)     -> atajo de bulkUpdate
//   bulkAssign(ids, userId)        -> atajo de bulkUpdate
//   bulkMoveToClient(ids, id)      -> atajo de bulkUpdate({client_id})
//   bulkShiftDates(ids, days)      -> via store.reorder (publish_date)
//   bulkDelete(ids)                -> {ok, count}
//   bulkDuplicate(ids)             -> {ok, created}
//
// Patron oficial (identico a store.js): optimista -> fetch -> exito:
// reconciliar + emits + refreshClientCounts | error: rollback + toast error.
//
// Endpoints v2 (backend real, [[path]].js):
//   POST /posts/bulk-update  { ids:[1..100], patch:{...} }        (forma A)
//   POST /posts/bulk-update  { updates:[{id, publish_date}] }     (forma B)
//   POST /posts/bulk-delete  { ids }
//   POST /posts/:id/duplicate                                     (por post)
// El bulk-update exige que todos los ids sean del MISMO cliente y solo acepta
// BULK_PATCH_FIELDS; cualquier rechazo (400/404/405/422/501) degrada a
// PATCH/DELETE/POST por post contra la API v1, igual que hace store.loadPosts
// con scope=all. El frontend funciona con ambos backends.
// ============================================================================

import { api } from '../api.js?v=202607040015';
import { toast } from '../shell/toast.js?v=202607040015';
import * as store from '../shell/store.js?v=202607040015';
import { addDaysISO } from '../lib/dates.js?v=202607040015';

const BULK_UPDATE_ENDPOINT = '/posts/bulk-update';
const BULK_DELETE_ENDPOINT = '/posts/bulk-delete';
const ERR_SAVE = 'No se pudo guardar, intenta de nuevo.';

/**
 * El backend viejo no tiene /posts/bulk-*: 404/405/501 activan el fallback.
 * 400/422 = el backend nuevo rechazo el shape (multi-cliente o campo fuera de
 * BULK_PATCH_FIELDS): el PATCH por post si lo resuelve, asi que tambien cae.
 */
function isMissingEndpoint(e) {
  const s = e && e.status;
  return s === 400 || s === 404 || s === 405 || s === 422 || s === 501;
}

function uniqIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj ? obj[k] : undefined;
  return out;
}

function normalizePosts(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.posts)) return res.posts;
  if (res && res.post && res.post.id) return [res.post];
  return [];
}

/** Reemplaza en el store los posts que el server devolvio reconciliados. */
function reconcile(serverPosts) {
  for (const p of serverPosts) {
    if (p && p.id) store.upsertPost(p);
  }
}

function emitChanged() {
  store.emit('posts:changed');
  store.emit('mutated');
  store.refreshClientCounts();
}

// ── Seleccion multiple (estado compartido entre vistas) ──────────────────────
let selected = new Set();

function emitSelection() {
  store.emit('bulk:selection', { ids: [...selected], count: selected.size });
}

export function getSelection() { return [...selected]; }
export function count() { return selected.size; }
export function isSelected(id) { return selected.has(id); }

export function select(ids) {
  let changed = false;
  for (const id of uniqIds(ids)) {
    if (!selected.has(id)) { selected.add(id); changed = true; }
  }
  if (changed) emitSelection();
}

export function deselect(ids) {
  let changed = false;
  for (const id of uniqIds(ids)) {
    if (selected.delete(id)) changed = true;
  }
  if (changed) emitSelection();
}

export function toggle(id) {
  if (!id) return;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  emitSelection();
}

export function clear() {
  if (!selected.size) return;
  selected = new Set();
  emitSelection();
}

// Cambiar de cliente o de vista limpia la seleccion (la barra desaparece).
store.on('client:changed', clear);
store.subscribe(['view'], () => clear());
// Si un post se borra (desde el editor, por ejemplo) sale de la seleccion.
store.on('post:deleted', ({ id } = {}) => { if (id) deselect(id); });

// ── Nucleo: aplicar updates por post (bulk -> fallback v1) ──────────────────
/**
 * updates = [{id, fields}]. Optimista + rollback. Devuelve los posts
 * reconciliados por el server (puede ser [] con el backend viejo).
 * Lanza el error original si TODO fallo (el caller hace rollback y toast).
 */
async function pushUpdates(updates) {
  // Forma B del bulk-update solo expresa publish_date por post; cualquier
  // otro campo heterogeneo va directo al PATCH por post.
  const onlyDates = updates.every((u) => {
    const keys = Object.keys(u.fields || {});
    return keys.length === 1 && keys[0] === 'publish_date';
  });
  try {
    if (!onlyDates) throw { status: 422 };
    const res = await api.post(BULK_UPDATE_ENDPOINT, {
      updates: updates.map((u) => ({ id: u.id, publish_date: u.fields.publish_date ?? null })),
    });
    return normalizePosts(res);
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e;
    // Fallback v1: PATCH por post en paralelo.
    const results = await Promise.allSettled(
      updates.map((u) => api.patch(`/posts/${encodeURIComponent(u.id)}`, u.fields))
    );
    const okPosts = [];
    let firstError = null;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const p = (r.value && r.value.post) || r.value;
        if (p && p.id) okPosts.push(p);
      } else if (!firstError) {
        firstError = r.reason;
      }
    }
    if (firstError && !okPosts.length) throw firstError;
    if (firstError) {
      // Exito parcial: avisa pero no revierte lo que si entro.
      toast('Algunos contenidos no se pudieron actualizar.', { type: 'error' });
    }
    return okPosts;
  }
}

// ── API publica de mutaciones ────────────────────────────────────────────────

/**
 * Aplica los mismos campos a todos los ids. Optimista + rollback + toast de
 * error. Devuelve {ok, count, undo}: `undo` restaura los valores previos de
 * esos campos (para el toast con accion Deshacer de la vista).
 */
export async function bulkUpdate(ids, fields) {
  const list = uniqIds(ids);
  const keys = Object.keys(fields || {});
  if (!list.length || !keys.length) return { ok: false, count: 0, undo: null };

  const { posts } = store.getState();
  const byId = new Map(posts.map((p) => [p.id, p]));
  // Snapshot por post SOLO de los campos que vamos a tocar (para undo).
  const snapshot = list
    .filter((id) => byId.has(id))
    .map((id) => ({ id, fields: pick(byId.get(id), keys) }));

  const idSet = new Set(list);
  const rollback = store.optimistic((s) => ({
    posts: s.posts.map((p) => (idSet.has(p.id) ? { ...p, ...fields } : p)),
  }));

  try {
    let serverPosts;
    try {
      const res = await api.post(BULK_UPDATE_ENDPOINT, { ids: list, patch: fields });
      serverPosts = normalizePosts(res);
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
      serverPosts = await pushUpdates(list.map((id) => ({ id, fields })));
    }
    reconcile(serverPosts);
    emitChanged();

    let undone = false;
    const undo = async () => {
      if (undone || !snapshot.length) return false;
      undone = true;
      return applySnapshot(snapshot);
    };
    return { ok: true, count: list.length, undo };
  } catch (e) {
    rollback();
    toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return { ok: false, count: 0, undo: null };
  }
}

/** Restaura un snapshot [{id, fields}] (lo usa el Deshacer de bulkUpdate). */
async function applySnapshot(snapshot) {
  const byId = new Map(snapshot.map((u) => [u.id, u.fields]));
  const rollback = store.optimistic((s) => ({
    posts: s.posts.map((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id) } : p)),
  }));
  try {
    const serverPosts = await pushUpdates(snapshot.map((u) => ({ id: u.id, fields: u.fields })));
    reconcile(serverPosts);
    emitChanged();
    return true;
  } catch (e) {
    rollback();
    toast((e && e.message) || 'No se pudo deshacer.', { type: 'error' });
    return false;
  }
}

/** Atajo: cambia el estado de varios posts. */
export function bulkSetStatus(ids, status) {
  return bulkUpdate(ids, { status });
}

/** Atajo: asigna responsable (userId null = sin asignar). */
export function bulkAssign(ids, userId) {
  return bulkUpdate(ids, { assignee_user_id: userId ?? null });
}

/** Atajo: mueve los posts a otro cliente. */
export function bulkMoveToClient(ids, clientId) {
  if (!clientId) return Promise.resolve({ ok: false, count: 0, undo: null });
  return bulkUpdate(ids, { client_id: clientId });
}

/**
 * Corre la fecha de publicacion N dias (positivo o negativo). Los posts sin
 * fecha se ignoran. Delega en store.reorder (ya es optimista con rollback y
 * toast). Devuelve {ok, count}.
 */
export async function bulkShiftDates(ids, days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n === 0) return { ok: false, count: 0 };
  const idSet = new Set(uniqIds(ids));
  const { posts } = store.getState();
  const updates = [];
  for (const p of posts) {
    if (!idSet.has(p.id) || !p.publish_date) continue;
    const moved = addDaysISO(p.publish_date, n);
    if (moved) updates.push({ id: p.id, publish_date: moved });
  }
  if (!updates.length) {
    toast('Esos contenidos no tienen fecha que mover.', { type: 'info' });
    return { ok: false, count: 0 };
  }
  const ok = await store.reorder(updates);
  return { ok: !!ok, count: ok ? updates.length : 0 };
}

/**
 * Elimina varios posts. Optimista + rollback + toast de error.
 * Devuelve {ok, count}. Tambien los saca de la seleccion.
 */
export async function bulkDelete(ids) {
  const list = uniqIds(ids);
  if (!list.length) return { ok: false, count: 0 };
  const idSet = new Set(list);

  const rollback = store.optimistic((s) => ({
    posts: s.posts.filter((p) => !idSet.has(p.id)),
  }));

  try {
    try {
      await api.post(BULK_DELETE_ENDPOINT, { ids: list });
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
      // Fallback v1: DELETE por post.
      const results = await Promise.allSettled(
        list.map((id) => api.del(`/posts/${encodeURIComponent(id)}`))
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length) throw failed[0].reason;
      if (failed.length) toast('Algunos contenidos no se pudieron eliminar.', { type: 'error' });
    }
    deselect(list);
    for (const id of list) store.emit('post:deleted', { id });
    emitChanged();
    return { ok: true, count: list.length };
  } catch (e) {
    rollback();
    toast((e && e.message) || 'No se pudo eliminar.', { type: 'error' });
    return { ok: false, count: 0 };
  }
}

// Campos que se copian al duplicar con el fallback v1 (solo los que existan).
const DUP_FIELDS = [
  'client_id', 'title', 'caption', 'hook', 'content_type', 'status',
  'publish_date', 'assignee_id', 'effort', 'pillar', 'format', 'notes',
];

/**
 * Duplica posts (sin fase optimista: no hay id local). El server decide la
 * semantica del duplicado (POST /posts/:id/duplicate, uno por post); el
 * fallback v1 copia campos y agrega ' (copia)' al titulo.
 * Devuelve {ok, created:[posts]}.
 */
export async function bulkDuplicate(ids) {
  const list = uniqIds(ids);
  if (!list.length) return { ok: false, created: [] };

  try {
    let created;
    try {
      const results = await Promise.allSettled(
        list.map((id) => api.post(`/posts/${encodeURIComponent(id)}/duplicate`, {}))
      );
      created = [];
      let firstError = null;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const p = (r.value && r.value.post) || r.value;
          if (p && p.id) created.push(p);
        } else if (!firstError) {
          firstError = r.reason;
        }
      }
      if (firstError && !created.length) throw firstError;
      if (firstError) toast('Algunos contenidos no se pudieron duplicar.', { type: 'error' });
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
      // Fallback v1: POST /posts con una copia por cada post en memoria.
      const { posts } = store.getState();
      const byId = new Map(posts.map((p) => [p.id, p]));
      const sources = list.map((id) => byId.get(id)).filter(Boolean);
      if (!sources.length) throw e;
      const results = await Promise.allSettled(sources.map((src) => {
        const body = {};
        for (const k of DUP_FIELDS) {
          if (src[k] !== undefined && src[k] !== null) body[k] = src[k];
        }
        body.title = `${src.title || 'Sin titulo'} (copia)`;
        return api.post('/posts', body);
      }));
      created = [];
      let firstError = null;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const p = (r.value && r.value.post) || r.value;
          if (p && p.id) created.push(p);
        } else if (!firstError) {
          firstError = r.reason;
        }
      }
      if (firstError && !created.length) throw firstError;
      if (firstError) toast('Algunos contenidos no se pudieron duplicar.', { type: 'error' });
    }
    for (const p of created) {
      store.upsertPost(p);
      store.emit('post:created', p);
    }
    emitChanged();
    return { ok: true, created };
  } catch (e) {
    toast((e && e.message) || 'No se pudo duplicar.', { type: 'error' });
    return { ok: false, created: [] };
  }
}
