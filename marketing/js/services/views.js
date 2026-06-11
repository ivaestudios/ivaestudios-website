// ============================================================================
// IVAE Marketing v2 - Vistas guardadas (filtros con nombre, estilo Monday).
//
// CERO DOM: solo store + api + prefs + router. La vista que pinta los chips
// de "Mis vistas" consume este modulo.
//
// Vista guardada normalizada:
//   { id, client_id, name, base ('tabla'|'tablero'|'calendario'|'timeline'),
//     filters: {q?, estado?, tipo?, persona?, desde?, hasta?}, position }
// Los filters usan EXACTAMENTE los params de la URL del router
// (#/<vista>?cliente=&q=&estado=&tipo=&persona=&desde=&hasta=), asi aplicar
// una vista = navegar con esos params.
//
// API v2 (el server llama view_type a la base y config a los filters;
// este modulo traduce en la frontera y expone base/filters a las vistas):
//   GET    /views?client_id=ID    -> {views:[{view_type, config, ...}]}
//   POST   /views                 {client_id, name, view_type, config, position}
//   PATCH  /views/:id             {name?|view_type?|config?|position?}
//   DELETE /views/:id
//
// DEGRADACION LIMPIA: si /views devuelve 404 (migracion sin aplicar) el
// modulo pasa a modo LOCAL: las vistas se guardan en prefs
// ('savedViewsLocal.<clientId>') y todo sigue funcionando solo-en-este-
// dispositivo. La vista activa se persiste en prefs 'savedViewActive.<id>'
// (clave reservada en prefs.js).
//
// Eventos store: 'views:changed' {clientId} y 'view:applied' {id, base,
// filters} (evento de dominio canonico del store).
// ============================================================================

import { api } from '../api.js';
import { toast } from '../shell/toast.js';
import * as store from '../shell/store.js';
import * as prefs from '../shell/prefs.js';
import { navigate, current } from '../shell/router.js';

const TTL = 60000;
const ERR_SAVE = 'No se pudo guardar, intenta de nuevo.';

/** Claves de filtro validas (espejo de los params de ruta del router). */
export const FILTER_KEYS = ['q', 'estado', 'tipo', 'persona', 'desde', 'hasta'];

/** Vistas base sobre las que tiene sentido guardar filtros. */
export const BASES = ['tabla', 'tablero', 'calendario', 'timeline'];

let serverAvailable = true;
const cache = new Map(); // clientKey -> {at, views:[...]}

export function isServerAvailable() { return serverAvailable; }

function is404(e) { return !!(e && e.status === 404); }

function keyOf(clientId) {
  return clientId === 'todos' || !clientId ? 'todos' : String(clientId);
}

function localKey(clientKey) {
  return `savedViewsLocal.${clientKey}`;
}

function newLocalId() {
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanFilters(filters) {
  const out = {};
  for (const k of FILTER_KEYS) {
    const v = filters && filters[k];
    if (v === undefined || v === null || v === '') continue;
    out[k] = String(v);
  }
  return out;
}

export function normalizeView(v) {
  if (!v || !v.id) return null;
  let filters = v.filters ?? v.config;
  if (typeof filters === 'string') {
    try { filters = JSON.parse(filters); } catch { filters = {}; }
  }
  const base = v.base ?? v.view_type;
  return {
    id: v.id,
    client_id: v.client_id ?? null,
    name: String(v.name || 'Vista sin nombre'),
    base: BASES.includes(base) ? base : 'tabla',
    filters: cleanFilters(filters),
    position: Number(v.position) || 0,
  };
}

function normalizeList(res) {
  const list = Array.isArray(res) ? res : (res && res.views) || [];
  return list.map(normalizeView).filter(Boolean).sort((a, b) => a.position - b.position);
}

function emitChanged(clientKey) {
  store.emit('views:changed', { clientId: clientKey });
}

// ── Modo local (prefs) ───────────────────────────────────────────────────────

function localList(clientKey) {
  return normalizeList(prefs.get(localKey(clientKey), []));
}

function localSave(clientKey, views) {
  prefs.set(localKey(clientKey), views);
  cache.set(clientKey, { at: Date.now(), views });
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Vistas guardadas del cliente (cache 60s). En modo local lee prefs.
 * Siempre devuelve un arreglo.
 */
export async function list(clientId = store.getState().activeClientId, { force = false } = {}) {
  const clientKey = keyOf(clientId);
  const hit = cache.get(clientKey);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.views;

  if (!serverAvailable) {
    const views = localList(clientKey);
    cache.set(clientKey, { at: Date.now(), views });
    return views;
  }

  try {
    const qs = clientKey === 'todos' ? '' : `?client_id=${encodeURIComponent(clientKey)}`;
    const res = await api.get(`/views${qs}`);
    const views = normalizeList(res);
    cache.set(clientKey, { at: Date.now(), views });
    return views;
  } catch (e) {
    if (is404(e)) {
      serverAvailable = false;
      const views = localList(clientKey);
      cache.set(clientKey, { at: Date.now(), views });
      return views;
    }
    return hit ? hit.views : [];
  }
}

/** Lookup sincrono en cache (para pintar chips sin await). */
export function cached(clientId = store.getState().activeClientId) {
  const hit = cache.get(keyOf(clientId));
  return hit ? hit.views : [];
}

// ── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Crea una vista guardada. {clientId, name, base, filters}.
 * Devuelve la vista creada o null (ya con toast de error).
 */
export async function create({ clientId = store.getState().activeClientId, name, base, filters } = {}) {
  const clientKey = keyOf(clientId);
  const nm = String(name || '').trim();
  if (!nm) { toast('Ponle nombre a la vista.', { type: 'error' }); return null; }

  const existing = cache.get(clientKey);
  const position = (((existing && existing.views.length) || 0) + 1) * 1000;
  const draft = normalizeView({
    id: newLocalId(),
    client_id: clientKey === 'todos' ? null : clientKey,
    name: nm,
    base,
    filters,
    position,
  });

  if (!serverAvailable) {
    const views = [...localList(clientKey), draft];
    localSave(clientKey, views);
    emitChanged(clientKey);
    return draft;
  }

  try {
    const res = await api.post('/views', {
      client_id: draft.client_id,
      name: draft.name,
      view_type: draft.base,
      config: draft.filters,
      position: draft.position,
    });
    const created = normalizeView((res && res.view) || res) || draft;
    const hit = cache.get(clientKey);
    cache.set(clientKey, { at: Date.now(), views: [...(hit ? hit.views : []), created] });
    emitChanged(clientKey);
    return created;
  } catch (e) {
    if (is404(e)) {
      serverAvailable = false;
      const views = [...localList(clientKey), draft];
      localSave(clientKey, views);
      emitChanged(clientKey);
      return draft;
    }
    toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return null;
  }
}

/**
 * Guarda la ruta actual como vista: toma store.view + store.filters.
 * Atajo para el boton "Guardar vista actual".
 */
export function captureCurrent(name) {
  const st = store.getState();
  const base = BASES.includes(st.view) ? st.view : 'tabla';
  return create({
    clientId: st.activeClientId,
    name,
    base,
    filters: cleanFilters(st.filters),
  });
}

function findCached(id) {
  for (const [clientKey, entry] of cache) {
    const view = entry.views.find((v) => v.id === id);
    if (view) return { clientKey, view };
  }
  return null;
}

/** Renombra o cambia base/filters/position. Optimista + rollback + toast. */
export async function update(id, patch) {
  const found = findCached(id);
  if (!found) return false;
  const { clientKey } = found;
  const prev = cache.get(clientKey).views;
  const next = prev.map((v) => (v.id === id ? normalizeView({ ...v, ...patch, id }) : v));
  cache.set(clientKey, { at: Date.now(), views: next });
  emitChanged(clientKey);

  if (!serverAvailable || String(id).startsWith('loc-')) {
    localSave(clientKey, next);
    return true;
  }

  try {
    // Traduccion al contrato del server: base -> view_type, filters -> config.
    const body = { ...patch };
    if (body.filters) { body.config = cleanFilters(body.filters); delete body.filters; }
    if (body.base) { body.view_type = body.base; delete body.base; }
    await api.patch(`/views/${encodeURIComponent(id)}`, body);
    return true;
  } catch (e) {
    cache.set(clientKey, { at: Date.now(), views: prev });
    emitChanged(clientKey);
    // 404 aqui = la vista ya no existe en el server, no migracion faltante.
    if (is404(e)) toast('Esa vista ya no existe.', { type: 'error' });
    else toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return false;
  }
}

/** Elimina una vista guardada. Optimista + rollback + toast. */
export async function remove(id) {
  const found = findCached(id);
  if (!found) return false;
  const { clientKey } = found;
  const prev = cache.get(clientKey).views;
  const next = prev.filter((v) => v.id !== id);
  cache.set(clientKey, { at: Date.now(), views: next });
  if (activeId(clientKey) === id) clearActive(clientKey);
  emitChanged(clientKey);

  if (!serverAvailable || String(id).startsWith('loc-')) {
    localSave(clientKey, next);
    return true;
  }

  try {
    await api.del(`/views/${encodeURIComponent(id)}`);
    return true;
  } catch (e) {
    if (is404(e)) {
      // Ya estaba borrada en el server: el optimista queda como verdad.
      return true;
    }
    cache.set(clientKey, { at: Date.now(), views: prev });
    emitChanged(clientKey);
    toast((e && e.message) || 'No se pudo eliminar.', { type: 'error' });
    return false;
  }
}

// ── Aplicar / activa ─────────────────────────────────────────────────────────

/**
 * Aplica la vista: navega a su base con cliente + filtros, persiste la
 * activa en prefs y emite 'view:applied'.
 */
export function apply(view, { replace = false } = {}) {
  const v = normalizeView(view);
  if (!v) return;
  const st = store.getState();
  const clientId = v.client_id || (st.activeClientId !== 'todos' ? st.activeClientId : null);
  const params = { ...v.filters };
  if (clientId) params.cliente = clientId;
  prefs.set(`savedViewActive.${keyOf(clientId)}`, v.id);
  navigate(v.base, params, { replace });
  store.emit('view:applied', { id: v.id, base: v.base, filters: v.filters });
}

/** Id de la vista activa del cliente (persistida) o null. */
export function activeId(clientId = store.getState().activeClientId) {
  return prefs.get(`savedViewActive.${keyOf(clientId)}`) || null;
}

/** Quita la marca de vista activa (al limpiar filtros a mano). */
export function clearActive(clientId = store.getState().activeClientId) {
  prefs.remove(`savedViewActive.${keyOf(clientId)}`);
}

/**
 * true si la ruta actual coincide con la vista guardada (misma base y
 * mismos filtros). Sirve para resaltar el chip activo sin depender de prefs.
 */
export function matchesCurrent(view) {
  const v = normalizeView(view);
  if (!v) return false;
  const cur = current();
  if (cur.view !== v.base) return false;
  const curFilters = cleanFilters(cur.params);
  const keys = new Set([...Object.keys(curFilters), ...Object.keys(v.filters)]);
  for (const k of keys) {
    if ((curFilters[k] || '') !== (v.filters[k] || '')) return false;
  }
  return true;
}
