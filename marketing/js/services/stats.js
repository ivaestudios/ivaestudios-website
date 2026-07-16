// ============================================================================
// IVAE Marketing v2 - Metricas para el dashboard (Inicio).
//
// CERO DOM: solo store + api + cache. La vista Inicio pinta tarjetas y
// graficas con lo que devuelve getStats().
//
// API v2: GET /stats?client_id=ID[&desde=YYYY-MM-DD&hasta=YYYY-MM-DD]
//         GET /stats?scope=all  (cliente 'todos': agrega porCliente)
//
// CACHE 60s por combinacion de parametros (lo pide el diseno), con dedupe
// de requests en vuelo. Cualquier mutacion propia ('mutated') invalida.
//
// DEGRADACION LIMPIA: si /stats devuelve 404 (migracion 004 sin aplicar) o
// falla la red, se calculan metricas LOCALES desde store.posts. getStats()
// NUNCA lanza: siempre devuelve un objeto usable con .source =
// 'server' | 'local' para que la vista pueda avisar si esta degradada.
//
// Shape normalizado (server y local comparten claves base):
//   { source, total, conFecha, sinFecha, vencidos, proximos7, pendientes,
//     publicadosMes, porEstado:{}, porTipo:{}, porPersona:{}, porCliente:{} }
// ============================================================================

import { api } from '../api.js?v=202607152032';
import * as store from '../shell/store.js?v=202607152032';
import { addDaysISO, todayISO } from '../lib/dates.js?v=202607152032';

export const STATS_TTL_MS = 60000;

let serverAvailable = true;
const cache = new Map();    // key -> {at, data}
const inflight = new Map(); // key -> Promise

export function isServerAvailable() { return serverAvailable; }

/** Vacia el cache (cada mutacion propia lo hace solo). */
export function invalidate() {
  cache.clear();
}

store.on('mutated', invalidate);

// ── Normalizacion de status (defensiva: el status es del backend) ───────────
function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

// Estados que consideramos "terminados" para el conteo local de vencidos.
const DONE_STATUSES = new Set([
  'publicado', 'published', 'aprobado', 'approved', 'listo', 'done',
]);

// Estados que cuentan como "esperando aprobacion del cliente".
const PENDING_STATUSES = new Set([
  'pendiente', 'pending', 'por_aprobar', 'en_revision', 'revision',
  'review', 'client_review', 'esperando_cliente',
]);

export function isDoneStatus(status) { return DONE_STATUSES.has(norm(status)); }
export function isPendingApproval(status) { return PENDING_STATUSES.has(norm(status)); }

// ── Calculo local (fallback y primera pintura instantanea) ──────────────────

function bump(obj, key) {
  const k = key === null || key === undefined || key === '' ? 'sin_valor' : String(key);
  obj[k] = (obj[k] || 0) + 1;
}

/**
 * Metricas desde los posts en memoria (los del cliente activo, o todos si
 * activeClientId === 'todos'). Acepta {desde, hasta} para acotar por
 * publish_date (los sin fecha quedan fuera del rango pero se reportan).
 */
export function computeLocalStats({ desde = null, hasta = null } = {}) {
  const { posts } = store.getState();
  const hoy = todayISO();
  const en7 = addDaysISO(hoy, 7);
  const mesPrefijo = hoy.slice(0, 7); // 'YYYY-MM'

  const out = {
    source: 'local',
    total: 0,
    conFecha: 0,
    sinFecha: 0,
    vencidos: 0,
    proximos7: 0,
    pendientes: 0,
    publicadosMes: 0,
    porEstado: {},
    porTipo: {},
    porPersona: {},
    porCliente: {},
  };

  for (const p of posts || []) {
    const fecha = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
    if (fecha) {
      if (desde && fecha < desde) continue;
      if (hasta && fecha > hasta) continue;
    } else if (desde || hasta) {
      out.sinFecha += 1; // fuera del rango pero lo reportamos
      continue;
    }

    out.total += 1;
    bump(out.porEstado, norm(p.status) || 'sin_estado');
    bump(out.porTipo, norm(p.content_type) || 'sin_tipo');
    bump(out.porPersona, p.assignee_id ?? p.assigned_to ?? 'sin_asignar');
    bump(out.porCliente, p.client_id || 'sin_cliente');

    if (isPendingApproval(p.status)) out.pendientes += 1;

    if (!fecha) {
      out.sinFecha += 1;
      continue;
    }
    out.conFecha += 1;
    if (fecha < hoy && !isDoneStatus(p.status)) out.vencidos += 1;
    if (fecha >= hoy && fecha <= en7) out.proximos7 += 1;
    if (fecha.startsWith(mesPrefijo) && isDoneStatus(p.status)) out.publicadosMes += 1;
  }
  return out;
}

// ── Server ───────────────────────────────────────────────────────────────────

function buildKey({ clientId, desde, hasta }) {
  const qs = new URLSearchParams();
  if (clientId === 'todos') qs.set('scope', 'all');
  else if (clientId) qs.set('client_id', clientId);
  if (desde) qs.set('desde', desde);
  if (hasta) qs.set('hasta', hasta);
  return qs.toString();
}

function normalizeServer(res) {
  const raw = (res && res.stats) || res || {};
  return {
    source: 'server',
    total: Number(raw.total) || 0,
    conFecha: Number(raw.conFecha ?? raw.con_fecha) || 0,
    sinFecha: Number(raw.sinFecha ?? raw.sin_fecha) || 0,
    vencidos: Number(raw.vencidos ?? raw.overdue) || 0,
    proximos7: Number(raw.proximos7 ?? raw.upcoming7) || 0,
    pendientes: Number(raw.pendientes ?? raw.pending) || 0,
    publicadosMes: Number(raw.publicadosMes ?? raw.published_month) || 0,
    porEstado: raw.porEstado || raw.by_status || {},
    porTipo: raw.porTipo || raw.by_type || {},
    porPersona: raw.porPersona || raw.by_assignee || {},
    porCliente: raw.porCliente || raw.by_client || {},
    // Extras que el server agregue (tendencias, racha, etc.) se conservan.
    extra: raw.extra || null,
  };
}

/**
 * Metricas con cache de 60s. opts: {clientId, desde, hasta, force}.
 * clientId default: el cliente activo. NUNCA lanza.
 */
export async function getStats(opts = {}) {
  const clientId = opts.clientId ?? store.getState().activeClientId;
  const desde = opts.desde || null;
  const hasta = opts.hasta || null;
  const key = buildKey({ clientId, desde, hasta });

  const hit = cache.get(key);
  if (!opts.force && hit && Date.now() - hit.at < STATS_TTL_MS) return hit.data;

  if (!serverAvailable) {
    const local = computeLocalStats({ desde, hasta });
    cache.set(key, { at: Date.now(), data: local });
    return local;
  }

  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    try {
      const res = await api.get(`/stats${key ? `?${key}` : ''}`);
      const data = normalizeServer(res);
      cache.set(key, { at: Date.now(), data });
      return data;
    } catch (e) {
      if (e && e.status === 404) serverAvailable = false;
      // Stale del cache > local fresco > local vacio: lo que haya.
      if (hit) return hit.data;
      const local = computeLocalStats({ desde, hasta });
      cache.set(key, { at: Date.now(), data: local });
      return local;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}
