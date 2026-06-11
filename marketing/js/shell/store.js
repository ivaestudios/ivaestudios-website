// ============================================================================
// IVAE Marketing v2 — Store reactivo singleton + acciones canonicas.
//
// Contrato CONGELADO (ARCHITECTURE.md "Store contract"): los 9 paquetes
// restantes codean contra este modulo. No cambiar firmas.
//
// ESTADO:
//   { me, clients, activeClientId, posts, users, view, params, filters,
//     search, unreadCount, online, loading, booted }
//
// API:
//   getState(); set(patch, {silent}); subscribe(keys[]|'*', fn) -> unsub
//   optimistic(applyFn) -> rollbackFn; emit(evt, payload) / on(evt, fn) -> off
//
// ACCIONES (UNICA via de mutacion de posts; patron oficial:
//   optimista -> fetch -> exito: reconciliar con la respuesta + emit +
//   refreshClientCounts best-effort | error: rollback + toast):
//   loadPosts, patchPost, createPost, removePost, upsertPost, reorder, loadUsers
//
// EVENTOS DE DOMINIO: 'client:changed', 'posts:changed', 'post:updated',
//   'post:created', 'post:deleted', 'mutated', 'notifications:read',
//   'view:applied'.
// ============================================================================

import { api, toast } from '../api.js?v=202606110013';

const ERR_SAVE = 'No se pudo guardar, intenta de nuevo.';

const state = {
  me: null,                 // {id,email,name,role,client_id}
  clients: [],              // [shapeClient + counts:{posts,pending}]
  activeClientId: null,     // string | 'todos'
  posts: [],                // posts del cliente activo (shapePost)
  users: null,              // null | [] cache lazy de GET /users
  view: null,               // id de vista activa
  params: {},               // params actuales de la ruta
  filters: {},              // espejo de los filtros de la URL
  search: '',
  unreadCount: 0,
  online: true,
  loading: false,
  booted: false,
};

// ── Suscripciones por clave ──────────────────────────────────────────────────
const subs = new Map();   // key -> Set<fn> ; '*' para todas

export function getState() { return state; }

export function subscribe(keys, fn) {
  const list = keys === '*' ? ['*'] : (Array.isArray(keys) ? keys : [keys]);
  for (const k of list) {
    if (!subs.has(k)) subs.set(k, new Set());
    subs.get(k).add(fn);
  }
  return () => { for (const k of list) subs.get(k)?.delete(fn); };
}

function notify(key, value, prev) {
  for (const fn of subs.get(key) || []) {
    try { fn(key, value, prev); } catch (e) { console.error('[store] subscriber', key, e); }
  }
  for (const fn of subs.get('*') || []) {
    try { fn(key, value, prev); } catch (e) { console.error('[store] subscriber *', key, e); }
  }
}

export function set(patch, { silent = false } = {}) {
  const changed = [];
  for (const [k, v] of Object.entries(patch || {})) {
    const prev = state[k];
    if (prev === v) continue;
    state[k] = v;
    changed.push([k, v, prev]);
  }
  if (!silent) for (const [k, v, p] of changed) notify(k, v, p);
}

/**
 * Mutacion optimista: `applyFn(state)` devuelve un patch {clave: valorNuevo}.
 * Se toma snapshot superficial de las claves tocadas ANTES de aplicar y se
 * devuelve un rollback que las restaura. Para arreglos (posts) el caller
 * construye un arreglo NUEVO (no muta el existente).
 */
export function optimistic(applyFn) {
  const patch = applyFn(state) || {};
  const snapshot = {};
  for (const k of Object.keys(patch)) snapshot[k] = state[k];
  set(patch);
  let rolled = false;
  return function rollback() {
    if (rolled) return;
    rolled = true;
    set(snapshot);
  };
}

// ── Bus de eventos de dominio ────────────────────────────────────────────────
const bus = new Map();   // evt -> Set<fn>

export function on(evt, fn) {
  if (!bus.has(evt)) bus.set(evt, new Set());
  bus.get(evt).add(fn);
  return () => bus.get(evt)?.delete(fn);
}

export function emit(evt, payload) {
  for (const fn of bus.get(evt) || []) {
    try { fn(payload); } catch (e) { console.error('[store] bus', evt, e); }
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────
function replacePost(list, post) {
  let found = false;
  const out = list.map((p) => {
    if (p.id === post.id) { found = true; return post; }
    return p;
  });
  if (!found) out.push(post);
  return out;
}

/** Refresca counts del switcher tras cada mutacion (best-effort, jamas truena). */
export async function refreshClientCounts() {
  try {
    const clients = await api.get('/clients');
    if (Array.isArray(clients)) set({ clients });
  } catch { /* best-effort */ }
}

// ── ACCIONES CANONICAS ───────────────────────────────────────────────────────

/**
 * Carga los posts del cliente activo (o de todos con scope=all + fallback
 * multi-fetch si el backend nuevo aun no esta desplegado).
 */
export async function loadPosts(clientId = state.activeClientId) {
  set({ loading: true });
  try {
    let posts;
    if (clientId === 'todos') {
      try {
        const res = await api.get('/posts?scope=all');
        posts = Array.isArray(res) ? res : (res && res.posts) || [];
      } catch {
        // Backend v2 aun no desplegado: degradacion con un fetch por cliente.
        const ids = state.clients.filter((c) => !c.archived).map((c) => c.id);
        const all = await Promise.all(ids.map((id) =>
          api.get(`/posts?client_id=${encodeURIComponent(id)}`).catch(() => [])
        ));
        posts = all.flat();
      }
    } else if (clientId) {
      const res = await api.get(`/posts?client_id=${encodeURIComponent(clientId)}`);
      posts = Array.isArray(res) ? res : (res && res.posts) || [];
    } else {
      posts = [];
    }
    set({ posts, loading: false });
    return posts;
  } catch (e) {
    set({ loading: false });
    toast(e.message || 'No se pudieron cargar los contenidos.', 'error');
    return null;
  }
}

/**
 * PATCH parcial de un post (SOLO campos dirty). Optimista + rollback.
 * Devuelve el post reconciliado del servidor, o null si fallo (ya con toast).
 */
export async function patchPost(id, fields) {
  const prev = state.posts.find((p) => p.id === id);
  const rollback = optimistic((s) => ({
    posts: s.posts.map((p) => (p.id === id ? { ...p, ...fields } : p)),
  }));
  try {
    const res = await api.patch(`/posts/${id}`, fields);
    const post = (res && res.post) || res;
    if (post && post.id) set({ posts: replacePost(state.posts, post) });
    emit('post:updated', { id, fields });
    emit('posts:changed');
    emit('mutated');
    refreshClientCounts();
    return post || prev;
  } catch (e) {
    rollback();
    toast(e.message || ERR_SAVE, 'error');
    return null;
  }
}

/**
 * Crea un post. Sin fase optimista (no hay id local); normaliza
 * created.post || created. Devuelve el post creado o null.
 */
export async function createPost(data) {
  try {
    const res = await api.post('/posts', data);
    const post = (res && res.post) || res;
    if (post && post.id) set({ posts: [...state.posts, post] });
    emit('post:created', post);
    emit('posts:changed');
    emit('mutated');
    refreshClientCounts();
    return post;
  } catch (e) {
    toast(e.message || ERR_SAVE, 'error');
    return null;
  }
}

/** Elimina un post (optimista + rollback). Devuelve true/false. */
export async function removePost(id) {
  const rollback = optimistic((s) => ({
    posts: s.posts.filter((p) => p.id !== id),
  }));
  try {
    await api.del(`/posts/${id}`);
    emit('post:deleted', { id });
    emit('posts:changed');
    emit('mutated');
    refreshClientCounts();
    return true;
  } catch (e) {
    rollback();
    toast(e.message || 'No se pudo eliminar.', 'error');
    return false;
  }
}

/** Inserta o reemplaza un post en memoria (sin red). */
export function upsertPost(post) {
  if (!post || !post.id) return;
  set({ posts: replacePost(state.posts, post) });
}

/**
 * Reordenamiento batch (kanban/calendario): updates = [{id, position?,
 * publish_date?, status?}]. position sparse en pasos de 1000; la
 * renormalizacion de columna viaja en el MISMO batch.
 */
export async function reorder(updates) {
  if (!Array.isArray(updates) || !updates.length) return true;
  const byId = new Map(updates.map((u) => [u.id, u]));
  const rollback = optimistic((s) => ({
    posts: s.posts.map((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id) } : p)),
  }));
  try {
    await api.post('/posts/reorder', { updates });
    emit('posts:changed');
    emit('mutated');
    return true;
  } catch (e) {
    rollback();
    toast(e.message || ERR_SAVE, 'error');
    return false;
  }
}

/** Invalida la cache de usuarios (tras crear/restablecer un acceso). */
export function invalidateUsers() { set({ users: null }); }

/** Cache lazy de usuarios staff (GET /users). */
export async function loadUsers() {
  if (Array.isArray(state.users)) return state.users;
  try {
    const users = await api.get('/users');
    set({ users: Array.isArray(users) ? users : [] });
  } catch {
    set({ users: [] });
  }
  return state.users;
}
