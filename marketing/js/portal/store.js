// ============================================================================
// Portal cliente v2 — Store propio (EventTarget), AISLADO del shell de equipo.
//
// Importa SOLO api.js (regla de la arquitectura: cero estado compartido con
// js/shell/store.js). Pub/sub minimo + selectores puros + las TRES escrituras
// que el rol client tiene permitidas: approve / request-changes / comments.
//
// Eventos que emite (CustomEvent.detail):
//   'posts'    {}                       lista de posts cambio (re-render quirurgico)
//   'approval' {id, state, origin}      cambio de decision (inbox decide si re-render)
//   'comment'  {id, comment}            comentario agregado (contadores en vivo)
//   'month'    {cursor}                 mes visible de la agenda cambio
//   'tab'      {tab}                    tab activa cambio
//
// REGLAS DURAS portadas de v1 + arquitectura:
//   - El frontend JAMAS envia client_id (la API auto-escopa por sesion).
//   - approval_state es el UNICO eje visible; status/grabacion/assignee/
//     notes_* NUNCA se leen aqui aunque lleguen en el payload.
//   - 401 a mitad de sesion: toast breve + redirect al login (sin atrapamiento).
// ============================================================================

import { api, parseDate, ymd } from '../api.js?v=202606241200';
import { toast } from '../shell/toast.js?v=202606241200';

const TAB_KEY = 'mkt.portal.tab';
const DETAIL_TTL = 60 * 1000;   // cache de GET /posts/:id
const POSTS_STALE = 60 * 1000;  // re-GET /posts al volver a la app

const bus = new EventTarget();

export const state = {
  me: null,            // {id,email,name,role,client_id}
  client: null,        // perfil propio (degradable a null = "tu marca")
  posts: [],           // GET /posts ya escopado y filtrado por el server
  monthCursor: null,   // Date al dia 1 del mes visible en agenda/progreso
  tab: 'inbox',        // 'inbox' | 'agenda' (persistido)
  openPostId: null,    // guard anti-carrera del detalle
  details: new Map(),  // postId -> {post, comments, approvals, fetchedAt}
  lastPostsFetch: 0,
};

// ── Pub/sub ──────────────────────────────────────────────────────────────────
export function on(evt, fn) {
  const h = (e) => fn(e.detail || {});
  bus.addEventListener(evt, h);
  return () => bus.removeEventListener(evt, h);
}
export function emit(evt, detail = {}) {
  bus.dispatchEvent(new CustomEvent(evt, { detail }));
}

// ── 401 a mitad de sesion ────────────────────────────────────────────────────
let kicked = false;
export function handleAuthError(err) {
  if (err && err.status === 401 && !kicked) {
    kicked = true;
    toast('Tu sesión expiró. Te llevamos al inicio de sesión.', { type: 'info' });
    setTimeout(() => location.replace('/marketing/'), 900);
    return true;
  }
  return false;
}

// ── Boot / cargas ────────────────────────────────────────────────────────────
export function init(me) {
  state.me = me;
  const savedTab = readTab();
  if (savedTab === 'inbox' || savedTab === 'agenda') state.tab = savedTab;
}

export async function loadInitial() {
  // GET /clients es degradable (portal funciona como "tu marca" sin perfil);
  // GET /posts es obligatorio.
  const [clients, posts] = await Promise.all([
    api.get('/clients').catch(() => []),
    api.get('/posts'),
  ]);
  state.client = Array.isArray(clients) ? (clients[0] || null) : (clients || null);
  state.posts = Array.isArray(posts) ? posts : [];
  state.lastPostsFetch = Date.now();
  state.monthCursor = defaultMonth();
}

export async function refreshPosts() {
  try {
    const posts = await api.get('/posts');
    state.posts = Array.isArray(posts) ? posts : [];
    state.lastPostsFetch = Date.now();
    emit('posts', {});
  } catch (err) {
    if (handleAuthError(err)) return;
    // Refresco en segundo plano: fallar en silencio (los datos viejos siguen).
  }
}

export function refreshIfStale() {
  if (Date.now() - state.lastPostsFetch > POSTS_STALE) refreshPosts();
}

// ── Tabs / mes visible ───────────────────────────────────────────────────────
function readTab() {
  try { return localStorage.getItem(TAB_KEY); } catch { return null; }
}
export function setTab(tab) {
  if (tab !== 'inbox' && tab !== 'agenda') return;
  if (state.tab === tab) { emit('tab', { tab }); return; }
  state.tab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* almacenamiento lleno: no pasa nada */ }
  emit('tab', { tab });
}

export function shiftMonth(delta) {
  const c = state.monthCursor || startOfMonth(new Date());
  state.monthCursor = startOfMonth(new Date(c.getFullYear(), c.getMonth() + delta, 1));
  emit('month', { cursor: state.monthCursor });
}
export function goToday() {
  state.monthCursor = startOfMonth(new Date());
  emit('month', { cursor: state.monthCursor });
}

// ── Selectores puros ─────────────────────────────────────────────────────────
function dateKey(p) { return p.publish_date ? String(p.publish_date).slice(0, 10) : '9999'; }
function byDateThenPosition(a, b) {
  const d = dateKey(a).localeCompare(dateKey(b));
  return d !== 0 ? d : ((a.position || 0) - (b.position || 0));
}

export function pendingPosts() {
  return state.posts.filter((p) => p.approval_state === 'pending').sort(byDateThenPosition);
}
export function changesPosts() {
  return state.posts.filter((p) => p.approval_state === 'changes').sort(byDateThenPosition);
}
export function awaitingCount() {
  // 'changes' sigue contando como pendiente (misma definicion que counts.pending
  // del server, para que el cliente y el equipo vean el mismo numero).
  return state.posts.filter((p) => p.approval_state === 'pending' || p.approval_state === 'changes').length;
}
export function undatedPosts() {
  return state.posts
    .filter((p) => !p.publish_date)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
}

export function monthStats(cursor = state.monthCursor) {
  const c = cursor || startOfMonth(new Date());
  const stats = { total: 0, approved: 0, pending: 0, changes: 0 };
  for (const p of state.posts) {
    const d = parseDate(p.publish_date);
    if (!d || d.getFullYear() !== c.getFullYear() || d.getMonth() !== c.getMonth()) continue;
    stats.total++;
    if (p.approval_state === 'approved') stats.approved++;
    else if (p.approval_state === 'changes') stats.changes++;
    else stats.pending++;
  }
  return stats;
}

export function postsByDay(cursor = state.monthCursor) {
  const c = cursor || startOfMonth(new Date());
  const map = new Map(); // 'YYYY-MM-DD' -> posts (position asc)
  for (const p of state.posts) {
    if (!p.publish_date) continue;
    const d = parseDate(p.publish_date);
    if (!d || d.getFullYear() !== c.getFullYear() || d.getMonth() !== c.getMonth()) continue;
    const key = String(p.publish_date).slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  for (const arr of map.values()) arr.sort((a, b) => (a.position || 0) - (b.position || 0));
  return map;
}

export function getPost(id) {
  return state.posts.find((p) => p.id === id) || null;
}

// Primer mes >= hoy con posts con fecha; si no hay, el mes actual (regla v1).
export function defaultMonth() {
  const today = startOfMonth(new Date());
  const future = state.posts
    .map((p) => parseDate(p.publish_date))
    .filter((d) => d && startOfMonth(d) >= today)
    .sort((a, b) => a - b);
  return future.length ? startOfMonth(future[0]) : today;
}

export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

// ── Cache del detalle (TTL 60s, guard anti-carrera via state.openPostId) ────
export async function getDetail(id, { force = false } = {}) {
  const hit = state.details.get(id);
  if (!force && hit && (Date.now() - hit.fetchedAt) < DETAIL_TTL) return hit;

  const data = await api.get('/posts/' + encodeURIComponent(id));
  const entry = {
    post: (data && data.post) ? data.post : data,
    // Defensa en profundidad: el server ya filtra internal=0 para rol client,
    // pero re-filtramos por si el payload cambiara.
    comments: ((data && data.comments) || []).filter((c) => !c.internal),
    approvals: (data && data.approvals) || [],
    fetchedAt: Date.now(),
  };
  state.details.set(id, entry);
  return entry;
}

export function commentCount(id) {
  const hit = state.details.get(id);
  return hit ? hit.comments.length : null; // null = aun no se conoce
}

// ── Mutaciones locales (sincronizan posts[] + cache del detalle) ─────────────
export function syncApproval(id, newState, { origin = '' } = {}) {
  const p = state.posts.find((x) => x.id === id);
  if (p) p.approval_state = newState;
  const hit = state.details.get(id);
  if (hit && hit.post) hit.post.approval_state = newState;
  emit('approval', { id, state: newState, origin });
  emit('posts', {});
}

export function appendLocalComment(id, comment) {
  const hit = state.details.get(id);
  if (hit) hit.comments.push(comment);
  emit('comment', { id, comment });
}

function appendLocalApproval(id, decision, comment) {
  const hit = state.details.get(id);
  if (!hit) return;
  hit.approvals.push({
    id: 'local-' + Date.now(),
    post_id: id,
    actor_name: (state.me && state.me.name) || 'Tú',
    decision,
    comment: comment || null,
    created_at: new Date().toISOString(),
    _mine: true,
  });
}

// ── Las TRES escrituras del rol client (contratos intactos) ──────────────────
// approve NO muta nada por si solo: la vista celebra primero en el nodo vivo
// y llama syncApproval despues (fix del bug v1 de la celebracion muerta).
export async function approve(id) {
  const res = await api.post('/posts/' + encodeURIComponent(id) + '/approve', {});
  if (res && res.post) {
    const hit = state.details.get(id);
    if (hit) hit.post = res.post;
  }
  appendLocalApproval(id, 'approved', null);
  return res;
}

export async function requestChanges(id, comment) {
  const res = await api.post('/posts/' + encodeURIComponent(id) + '/request-changes', { comment });
  if (res && res.post) {
    const hit = state.details.get(id);
    if (hit) hit.post = res.post;
  }
  appendLocalApproval(id, 'changes', comment);
  // El server duplica el comentario en el hilo como internal=0; lo anexamos
  // local para que el hilo abierto lo muestre sin refetch.
  appendLocalComment(id, {
    author_name: (state.me && state.me.name) || 'Tú',
    author_role: 'client',
    body: comment,
    created_at: new Date().toISOString(),
    internal: 0,
    _mine: true,
  });
  return res;
}

export async function sendComment(id, body) {
  const created = await api.post('/posts/' + encodeURIComponent(id) + '/comments', { body });
  const comment = (created && created.body !== undefined) ? { ...created, _mine: true } : {
    author_name: (state.me && state.me.name) || 'Tú',
    author_role: 'client',
    body,
    created_at: new Date().toISOString(),
    internal: 0,
    _mine: true,
  };
  appendLocalComment(id, comment);
  return comment;
}

// ── Utilidades de fecha compartidas por las vistas del portal ────────────────
export { parseDate, ymd };
