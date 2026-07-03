// ============================================================================
// IVAE Marketing v2 - Automatizaciones (reglas no-code estilo Monday).
//
// CERO DOM: catalogo + CRUD + cache + describeRule(). La vista
// views/automations.js pinta el builder "Cuando pase X, haz Y" con esto.
//
// Regla normalizada:
//   { id, client_id (null = todos los clientes), enabled (bool),
//     trigger: {type, value?}, actions: [{type, value?}], created_at? }
//
// API v2:
//   GET    /automations?client_id=ID   (sin param = todas, solo staff)
//   POST   /automations                {client_id, enabled, trigger, actions}
//   PATCH  /automations/:id            {enabled?|trigger?|actions?|client_id?}
//   DELETE /automations/:id
//   GET    /automations/runs?rule_id=&limit=   (historial de ejecuciones)
//
// DEGRADACION LIMPIA: 404 -> available=false; la vista muestra el empty state
// "disponible cuando se aplique la migracion" (mismo patron que avisos).
//
// Eventos store: 'automations:changed' {clientId}.
// ============================================================================

import { api } from '../api.js?v=202607031925';
import { toast } from '../shell/toast.js?v=202607031925';
import * as store from '../shell/store.js?v=202607031925';

const TTL = 60000;
const ERR_SAVE = 'No se pudo guardar, intenta de nuevo.';

let available = true;
const cache = new Map(); // clientKey -> {at, rules:[...]}

export function isAvailable() { return available; }

function is404(e) { return !!(e && e.status === 404); }

function markUnavailable() {
  available = false;
  cache.clear();
}

// ── Catalogo (ids estables para el backend, etiquetas es-MX) ─────────────────
// needsValue: 'status' | 'days' | 'user' | 'text' | null

export const TRIGGERS = [
  { id: 'post_created', label: 'Se crea un contenido', needsValue: null },
  { id: 'status_changed', label: 'El estado cambia a', needsValue: 'status' },
  { id: 'publish_date_arrived', label: 'Llega la fecha de publicacion', needsValue: null },
  { id: 'publish_date_in', label: 'Faltan N dias para publicar', needsValue: 'days' },
  { id: 'client_approved', label: 'El cliente aprueba', needsValue: null },
  { id: 'client_changes_requested', label: 'El cliente pide cambios', needsValue: null },
  { id: 'comment_added', label: 'Alguien comenta', needsValue: null },
];

export const ACTIONS = [
  { id: 'set_status', label: 'Cambiar el estado a', needsValue: 'status' },
  { id: 'assign_user', label: 'Asignar a', needsValue: 'user' },
  { id: 'notify_user', label: 'Avisar a', needsValue: 'user' },
  { id: 'notify_client', label: 'Avisar al cliente', needsValue: null },
  { id: 'shift_date', label: 'Mover la fecha N dias', needsValue: 'days' },
  { id: 'add_checklist', label: 'Agregar checklist', needsValue: 'text' },
];

export function triggerDef(type) { return TRIGGERS.find((t) => t.id === type) || null; }
export function actionDef(type) { return ACTIONS.find((a) => a.id === type) || null; }

// ── Normalizacion (acepta shape anidado o columnas planas del server) ────────

function parseMaybeJSON(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

export function normalizeRule(r) {
  if (!r) return null;
  let trigger = r.trigger;
  if (!trigger || typeof trigger !== 'object') {
    trigger = { type: r.trigger_type || String(r.trigger || ''), value: parseMaybeJSON(r.trigger_value) ?? null };
  } else {
    trigger = { type: trigger.type, value: trigger.value ?? null };
  }
  let actions = r.actions;
  if (typeof actions === 'string') actions = parseMaybeJSON(actions);
  if (!Array.isArray(actions)) {
    actions = r.action_type ? [{ type: r.action_type, value: parseMaybeJSON(r.action_value) ?? null }] : [];
  } else {
    actions = actions.map((a) => ({ type: a.type, value: a.value ?? null }));
  }
  return {
    id: r.id,
    client_id: r.client_id ?? null,
    enabled: !!(r.enabled ?? true),
    trigger,
    actions,
    created_at: r.created_at || null,
  };
}

function normalizeList(res) {
  const list = Array.isArray(res) ? res : (res && (res.automations || res.rules)) || [];
  return list.map(normalizeRule).filter(Boolean);
}

function keyOf(clientId) {
  return clientId === 'todos' || !clientId ? 'todos' : String(clientId);
}

function cachePut(clientKey, rules) {
  cache.set(clientKey, { at: Date.now(), rules });
}

function emitChanged(clientId) {
  store.emit('automations:changed', { clientId: keyOf(clientId) });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Reglas del cliente ('todos' = las de toda la agencia). Cache 60s.
 * [] si el endpoint no esta (available pasa a false).
 */
export async function list(clientId = store.getState().activeClientId, { force = false } = {}) {
  if (!available) return [];
  const key = keyOf(clientId);
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.rules;
  try {
    const qs = key === 'todos' ? '' : `?client_id=${encodeURIComponent(key)}`;
    const res = await api.get(`/automations${qs}`);
    const rules = normalizeList(res);
    cachePut(key, rules);
    return rules;
  } catch (e) {
    if (is404(e)) { markUnavailable(); return []; }
    return hit ? hit.rules : [];
  }
}

/**
 * Crea una regla. Sin fase optimista (no hay id local). Valida antes de
 * mandar. Devuelve la regla creada o null (ya con toast de error).
 */
export async function create(rule) {
  if (!available) return null;
  const check = validateRule(rule);
  if (!check.ok) { toast(check.error, { type: 'error' }); return null; }
  try {
    const body = {
      client_id: rule.client_id ?? null,
      enabled: rule.enabled === false ? 0 : 1,
      trigger: { type: rule.trigger.type, value: rule.trigger.value ?? null },
      actions: rule.actions.map((a) => ({ type: a.type, value: a.value ?? null })),
    };
    const res = await api.post('/automations', body);
    const created = normalizeRule((res && res.automation) || (res && res.rule) || res);
    if (created && created.id) {
      const key = keyOf(created.client_id ?? rule.client_id);
      const hit = cache.get(key);
      if (hit) cachePut(key, [...hit.rules, created]);
      const all = cache.get('todos');
      if (all && key !== 'todos') cachePut('todos', [...all.rules, created]);
      emitChanged(created.client_id);
    }
    return created;
  } catch (e) {
    if (is404(e)) {
      markUnavailable();
      toast('Las automatizaciones estaran disponibles cuando se aplique la migracion.', { type: 'info' });
    } else {
      toast((e && e.message) || ERR_SAVE, { type: 'error' });
    }
    return null;
  }
}

/** Busca una regla en cualquier cache cargado. */
function findCached(id) {
  for (const [key, entry] of cache) {
    const rule = entry.rules.find((r) => r.id === id);
    if (rule) return { key, rule };
  }
  return null;
}

/** Patch optimista en todos los caches que contengan la regla. */
function patchCaches(id, patchFn) {
  const prevByKey = new Map();
  for (const [key, entry] of cache) {
    if (!entry.rules.some((r) => r.id === id)) continue;
    prevByKey.set(key, entry.rules);
    cachePut(key, entry.rules.map((r) => (r.id === id ? patchFn(r) : r)).filter(Boolean));
  }
  return function rollback() {
    for (const [key, rules] of prevByKey) cachePut(key, rules);
  };
}

/**
 * Actualiza una regla (enabled, trigger, actions o client_id).
 * Optimista + rollback + toast. Devuelve true/false.
 */
export async function update(id, patch) {
  if (!available || !id) return false;
  const found = findCached(id);
  const rollback = patchCaches(id, (r) => normalizeRule({ ...r, ...patch, id: r.id }));
  emitChanged(found ? found.rule.client_id : null);
  try {
    const body = { ...patch };
    if (body.enabled !== undefined) body.enabled = body.enabled ? 1 : 0;
    const res = await api.patch(`/automations/${encodeURIComponent(id)}`, body);
    const updated = normalizeRule((res && res.automation) || (res && res.rule) || res);
    if (updated && updated.id) {
      patchCaches(id, () => updated);
    }
    emitChanged(updated ? updated.client_id : null);
    return true;
  } catch (e) {
    rollback();
    emitChanged(found ? found.rule.client_id : null);
    // 404 aqui = la regla ya no existe (la borro alguien mas), no migracion.
    if (is404(e)) toast('Esa regla ya no existe.', { type: 'error' });
    else toast((e && e.message) || ERR_SAVE, { type: 'error' });
    return false;
  }
}

/** Prende o apaga una regla (switch de la lista). */
export function toggle(id, enabled) {
  return update(id, { enabled: !!enabled });
}

/** Elimina una regla. Optimista + rollback + toast. */
export async function remove(id) {
  if (!available || !id) return false;
  const found = findCached(id);
  const rollback = patchCaches(id, () => null);
  emitChanged(found ? found.rule.client_id : null);
  try {
    await api.del(`/automations/${encodeURIComponent(id)}`);
    return true;
  } catch (e) {
    if (is404(e)) {
      // Ya estaba borrada en el server: el optimista queda como verdad.
      return true;
    }
    rollback();
    emitChanged(found ? found.rule.client_id : null);
    toast((e && e.message) || 'No se pudo eliminar.', { type: 'error' });
    return false;
  }
}

/**
 * Historial de ejecuciones (para "Actividad" de la vista).
 * ruleId null = todas. [] si no hay endpoint.
 */
export async function runs(ruleId = null, { limit = 30 } = {}) {
  if (!available) return [];
  try {
    const qs = new URLSearchParams();
    if (ruleId) qs.set('rule_id', ruleId);
    qs.set('limit', String(limit));
    const res = await api.get(`/automations/runs?${qs.toString()}`);
    return Array.isArray(res) ? res : (res && res.runs) || [];
  } catch (e) {
    if (is404(e)) markUnavailable();
    return [];
  }
}

// ── Validacion y descripcion ─────────────────────────────────────────────────

function needsCheck(def, value) {
  if (!def || !def.needsValue) return true;
  if (def.needsValue === 'days') {
    const n = Number(value);
    return Number.isFinite(n) && n !== 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** {ok, error}: trigger valido + al menos una accion valida. */
export function validateRule(rule) {
  if (!rule || !rule.trigger || !rule.trigger.type) {
    return { ok: false, error: 'Elige cuando se dispara la regla.' };
  }
  const t = triggerDef(rule.trigger.type);
  if (!t) return { ok: false, error: 'Ese disparador no existe.' };
  if (!needsCheck(t, rule.trigger.value)) {
    return { ok: false, error: 'Al disparador le falta su valor.' };
  }
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  if (!actions.length) return { ok: false, error: 'Agrega al menos una accion.' };
  for (const a of actions) {
    const def = actionDef(a && a.type);
    if (!def) return { ok: false, error: 'Una de las acciones no existe.' };
    if (!needsCheck(def, a.value)) {
      return { ok: false, error: `A la accion "${def.label}" le falta su valor.` };
    }
  }
  return { ok: true, error: null };
}

function defaultStatusLabel(value) {
  return String(value || '').replace(/_/g, ' ');
}

function defaultUserLabel(value) {
  if (value === 'team' || value === 'equipo') return 'el equipo';
  const users = store.getState().users;
  const u = Array.isArray(users) ? users.find((x) => String(x.id) === String(value)) : null;
  return (u && (u.name || u.email)) || 'esa persona';
}

function triggerPhrase(trigger, { statusLabel }) {
  const v = trigger.value;
  switch (trigger.type) {
    case 'post_created': return 'se crea un contenido';
    case 'status_changed':
      return v ? `el estado cambia a ${statusLabel(v)}` : 'el estado cambia';
    case 'publish_date_arrived': return 'llega la fecha de publicacion';
    case 'publish_date_in': {
      const n = Math.abs(Number(v) || 0);
      return `faltan ${n} ${n === 1 ? 'dia' : 'dias'} para publicar`;
    }
    case 'client_approved': return 'el cliente aprueba';
    case 'client_changes_requested': return 'el cliente pide cambios';
    case 'comment_added': return 'alguien comenta';
    default: return 'pasa algo';
  }
}

function actionPhrase(action, { statusLabel, userLabel }) {
  const v = action.value;
  switch (action.type) {
    case 'set_status': return `cambia el estado a ${statusLabel(v)}`;
    case 'assign_user': return `asigna a ${userLabel(v)}`;
    case 'notify_user': return `avisa a ${userLabel(v)}`;
    case 'notify_client': return 'avisa al cliente';
    case 'shift_date': {
      const n = Number(v) || 0;
      const abs = Math.abs(n);
      const dias = `${abs} ${abs === 1 ? 'dia' : 'dias'}`;
      return n < 0 ? `adelanta la fecha ${dias}` : `recorre la fecha ${dias}`;
    }
    case 'add_checklist': return `agrega la checklist "${v}"`;
    default: return 'hace algo';
  }
}

/**
 * Frase humana de la regla, estilo Monday:
 * 'Cuando el estado cambia a Aprobado, asigna a Vianey y avisa al cliente.'
 * opts: { statusLabel(v), userLabel(v) } para que la vista use sus etiquetas.
 */
export function describeRule(rule, opts = {}) {
  const r = normalizeRule(rule);
  if (!r || !r.trigger || !r.trigger.type) return '';
  const ctx = {
    statusLabel: opts.statusLabel || defaultStatusLabel,
    userLabel: opts.userLabel || defaultUserLabel,
  };
  const t = triggerPhrase(r.trigger, ctx);
  const acts = (r.actions || []).map((a) => actionPhrase(a, ctx));
  const actsTxt = acts.length <= 1
    ? (acts[0] || '')
    : `${acts.slice(0, -1).join(', ')} y ${acts[acts.length - 1]}`;
  const sentence = `Cuando ${t}, ${actsTxt}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
