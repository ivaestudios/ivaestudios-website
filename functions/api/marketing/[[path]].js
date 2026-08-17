// ============================================================================
// IVAE Marketing API v2 — router enterprise COMPLETO (backend-api).
// ============================================================================
// Cloudflare Pages Functions catch-all for the IVAE Marketing API.
// Mounted at /api/marketing/* — the onRequest entry point at the bottom strips
// that prefix and routes the rest.
//
// Bindings (configured in Cloudflare Pages → Settings → Functions):
//   DB                      → D1 database `ivae-gallery-db` (SAME db as gallery;
//                             all our tables are `mkt_*`, fully namespaced).
//   ADMIN_EMAIL             → the one email allowed to bootstrap the admin
//                             (vianeydm07@gmail.com).
//   SESSION_IDLE_SECONDS    → ventana de INACTIVIDAD de la sesión (default
//                             '7776000' = 90 días). Se renueva sola en cada uso
//                             (sliding), con tope absoluto de 180 días desde
//                             que se creó. Ver getSession/slideSession.
//                             (La vieja SESSION_EXPIRY_SECONDS ya NO se lee.)
//   MKT_CRON_SECRET         → bearer secret for POST /cron (optional backup of
//                             the throttled lazySweep; the app works without it).
//
// Auth is fully isolated from the gallery app: the cookie name is `mkt_session`
// (NOT `session`), users live in `mkt_users`, sessions in `mkt_sessions`.
//
// SECURITY MODEL (enforced server-side, see getSession + per-handler checks):
//   admin  → everything.
//   team   → manage all clients + posts (no user mgmt beyond inviting clients?
//            spec lets team create client logins; we allow team to manage users
//            for the agency's convenience — admin/team gate).
//   client → READ-ONLY on their own client_id's posts where client_visible=1,
//            EXCEPT approve / request-changes / comment. Never sees other
//            clients, notes_team, notes_people, internal comments, checklist,
//            priority, tags, overdue, work_start or effort_points. Scope is
//            ALWAYS derived from the session user, never from a client-supplied
//            ?client_id. publicPost is an explicit allowlist
//            (CLIENT_VISIBLE_FIELDS): nothing new ever leaks by accident.
//
// V2 (enterprise) — ADDITIVE ONLY. Every legacy endpoint keeps its exact
// signature and response shape; new sections are delimited with banners:
//   - notifications + throttled lazySweep (primary time-recipe mechanism)
//   - automations (8 fixed recipes, GET/PATCH, event hooks depth 1)
//   - posts: bulk-update / bulk-delete / duplicate / checklist CRUD (nested)
//   - search, dashboard (imported _dashboard.js), workload + capacities
//   - saved views CRUD
//   - POST /cron (Bearer MKT_CRON_SECRET, BEFORE the session gate)
// Degradation: if migration 004 is not applied yet, the new endpoints answer
// 404 ("No disponible") and everything legacy keeps working.

import { handleDashboard } from './_dashboard.js';
import { handleStorage, refreshStorageUsage } from './_storage.js';
import { handleMonthlyReport } from './_enterprise.js';
import { detectPlatform, resolveVideo, isAllowedMediaHost, suggestName, mediaHeadersFor, buscarPinterest, fotosDePin } from './_downloader.js';
import { pedirMes } from './_mes-ia.js';
import { publicarEnInstagram, ahoraCancun } from './_publicador.js';
import { pedirCarrusel } from './_carrusel-ia.js';
import {
  handleIgLogin, handleIgCallback, handleIgAssign, handleIgDisconnect,
  handleIgMetrics, handleIgMetricsRange, fetchIgMetrics, fetchIgMetricsRange,
  handleIgManual, getManualMetrics, refreshAgingIgTokens, checkIgConnections,
} from './_instagram.js';

// ============================================================================
// CRYPTO / UTILITY HELPERS  (copied VERBATIM from the gallery function)
// ============================================================================

// ── CRYPTO HELPERS ──
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return saltHex + ':' + hashHex;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const computed = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── BÓVEDA DE CONTRASEÑAS DE CLIENTE ────────────────────────────────────────
// Vianey necesita PODER VER la contraseña de cada cliente: se la dicta por
// WhatsApp cuando la olvidan, y pidió que siga apareciendo aunque el cliente
// la cambie por su cuenta. Un hash PBKDF2 no se puede deshacer, así que
// ADEMÁS del hash (que sigue siendo lo único que valida el login) se guarda
// una copia CIFRADA con AES-GCM en `password_enc`.
//
// La llave NO vive en D1: vive en R2, un servicio aparte con credenciales
// aparte. Por eso un volcado de la base de datos —el escenario de fuga más
// probable— no alcanza para leer ni una sola contraseña. Se genera sola la
// primera vez que se usa, así que no hay nada que configurar a mano.
// Alternativa: si algún día se define la variable de entorno MKT_PW_KEY, esa
// gana sobre R2 (permite rotar la llave sin tocar el bucket).
const PW_VAULT_R2_KEY = 'marketing/_vault/pw.key';
let pwVaultKeyCache = null;

async function pwVaultKey(env) {
  if (pwVaultKeyCache) return pwVaultKeyCache;
  let raw = null;
  if (env.MKT_PW_KEY) {
    raw = new TextEncoder().encode(String(env.MKT_PW_KEY));
  } else if (env.R2_BUCKET) {
    try {
      let obj = await env.R2_BUCKET.get(PW_VAULT_R2_KEY);
      if (!obj) {
        // Primer uso: genera la llave. `onlyIf` evita que dos isolates
        // simultáneos se pisen; pase lo que pase se RELEE, así que ambos
        // terminan usando la que quedó escrita de verdad.
        const fresh = crypto.getRandomValues(new Uint8Array(32));
        try {
          await env.R2_BUCKET.put(PW_VAULT_R2_KEY, fresh, { onlyIf: { etagDoesNotMatch: '*' } });
        } catch { /* ya existía o el bucket no soporta condicional */ }
        obj = await env.R2_BUCKET.get(PW_VAULT_R2_KEY);
      }
      if (obj) raw = new Uint8Array(await obj.arrayBuffer());
    } catch (e) { console.error('[mkt pw vault]', e && e.message); }
  }
  if (!raw || !raw.length) return null;
  const digest = await crypto.subtle.digest('SHA-256', raw);
  pwVaultKeyCache = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return pwVaultKeyCache;
}

function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Devuelve "<iv b64>.<ciphertext b64>" o null. JAMÁS tira: si la bóveda no
// está disponible el login/alta sigue funcionando, solo que sin copia visible.
async function pwEncrypt(env, plain) {
  try {
    if (!plain) return null;
    const key = await pwVaultKey(env);
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
    return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(ct))}`;
  } catch { return null; }
}

async function pwDecrypt(env, blob) {
  try {
    if (!blob) return null;
    const key = await pwVaultKey(env);
    if (!key) return null;
    const [ivB, ctB] = String(blob).split('.');
    if (!ivB || !ctB) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB) }, key, b64ToBytes(ctB));
    return new TextDecoder().decode(plain);
  } catch { return null; }
}

// Guarda la copia cifrada. Best-effort en todos los caminos donde pasa una
// contraseña en claro (alta, login, cambio propio, reset por correo, panel).
async function rememberPassword(env, userId, plain) {
  try {
    const enc = await pwEncrypt(env, plain);
    if (!enc) return;
    await env.DB.prepare(
      "UPDATE mkt_users SET password_enc = ?, password_enc_at = datetime('now') WHERE id = ?"
    ).bind(enc, userId).run();
  } catch (e) { console.error('[mkt remember pw]', e && e.message); }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

// ── JSON column helpers (defensive parse; never throw) ──
// Parse a stored JSON array of short strings → array (defaults to []).
function parseNoteLabels(raw) {
  try {
    const v = JSON.parse(raw == null || raw === '' ? '[]' : raw);
    if (!Array.isArray(v)) return [];
    return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => String(s).trim()).slice(0, 12);
  } catch { return []; }
}
// Parse a stored JSON object {person: noteText} → object (defaults to {}).
function parseNotesPeople(raw) {
  try {
    const v = JSON.parse(raw == null || raw === '' ? '{}' : raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof k === 'string') out[k] = val == null ? '' : String(val);
    }
    return out;
  } catch { return {}; }
}
// Validate an incoming note_labels value: must be an array of short strings.
// Returns a sanitized array, or null if the input is not a valid array.
function sanitizeNoteLabels(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const s of input) {
    if (typeof s !== 'string') continue;
    const t = s.trim();
    if (!t) continue;
    if (t.length > 40) return null; // "short strings" guard
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}
// Validate an incoming notes_people value: must be a plain object of
// {string: string-ish}. Returns a sanitized object, or null if invalid.
function sanitizeNotesPeople(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof k !== 'string' || !k.trim()) continue;
    out[k.trim()] = v == null ? '' : String(v);
  }
  return out;
}

// ── MARKETING-SPECIFIC HELPERS ──

// Temp password generator (mirrors the gallery's generateSimplePassword shape):
// "ivae-" + 5 unambiguous lowercase/number chars. Used when an admin creates a
// user/client without specifying a password, or on reset-password.
function generateSimplePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'ivae-' + code;
}

// `mkt_session` cookie (NOT the gallery's `session`). HttpOnly + Secure +
// SameSite=Strict so it's same-origin only and not script-readable.
function sessionCookie(token, maxAge) {
  return `mkt_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// ── VIDA DE LA SESIÓN (renovación deslizante) ────────────────────────────────
// El cliente entra 2-3 veces al mes; con 7 días fijos SIEMPRE encontraba la
// sesión vencida y tenía que buscar la contraseña que le mandamos por WhatsApp.
//   · Ventana de inactividad (idle): 90 días. Se REINICIA en cada uso, así que
//     mientras entre al menos una vez cada 90 días nunca vuelve a teclear nada.
//   · Tope absoluto: 180 días desde created_at. Una cookie robada NO vive para
//     siempre — a los 6 meses caduca aunque se siga usando.
//   · La renovación se escribe como máximo 1 vez al día por sesión
//     (RENEW_THRESHOLD_SECONDS) para no meter un write de D1 en cada request.
const SESSION_ABSOLUTE_MAX_SECONDS = 15552000; // 180 días — tope duro
const SESSION_RENEW_THRESHOLD_SECONDS = 86400; // renovar sólo si envejeció ≥1 día

// OJO: la perilla es SESSION_IDLE_SECONDS (nueva). La vieja
// SESSION_EXPIRY_SECONDS quedó OBSOLETA y se IGNORA a propósito: en el
// dashboard de Cloudflare Pages sigue puesta en 604800 (7 días) y si la
// leyéramos, este arreglo no serviría de nada en producción.
function sessionIdleSeconds(env) {
  const n = parseInt(env.SESSION_IDLE_SECONDS || '7776000', 10); // 90 días
  if (!Number.isFinite(n) || n <= 0) return 7776000;
  return Math.min(n, SESSION_ABSOLUTE_MAX_SECONDS);
}

// 'YYYY-MM-DD HH:MM:SS' (UTC, formato de datetime() en SQLite) → epoch ms.
function sqliteUtcMs(s) {
  if (!s) return NaN;
  return Date.parse(String(s).replace(' ', 'T') + 'Z');
}

// Read the mkt_session cookie, JOIN sessions+users, return the live session row
// or null. Only returns if the session is unexpired AND the user is active=1.
//
// `authCtx` (opcional) activa la RENOVACIÓN DESLIZANTE: si se pasa y la sesión
// ya envejeció, extiende expires_at en la BD y deja en authCtx.setCookie la
// cabecera Set-Cookie que onRequest adjunta a la respuesta (si no se refresca
// también la cookie, el navegador la tira aunque la BD siga viva).
async function getSession(request, env, authCtx) {
  const token = getCookie(request, 'mkt_session');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, s.expires_at AS session_expires_at,
            s.created_at AS session_created_at,
            u.email, u.name, u.role, u.client_id
       FROM mkt_sessions s
       JOIN mkt_users u ON s.user_id = u.id
      WHERE s.id = ?
        AND s.expires_at > datetime('now')
        AND u.active = 1`
  ).bind(token).first();
  if (!row) return null;
  if (authCtx) {
    try { await slideSession(env, row, token, authCtx); } catch { /* nunca romper el request */ }
  }
  return row;
}

// Extiende la sesión al usarla. Best-effort: si algo falla, el request sigue.
async function slideSession(env, row, token, authCtx) {
  const idle = sessionIdleSeconds(env);
  const now = Date.now();
  const expMs = sqliteUtcMs(row.session_expires_at);
  const createdMs = sqliteUtcMs(row.session_created_at);
  if (!Number.isFinite(expMs)) return;

  // Tope absoluto desde la creación. Si created_at es ilegible el MIN() del SQL
  // daría NULL (viola NOT NULL) → excepción → no se renovaría nunca: mejor
  // salir aquí, explícito.
  if (!Number.isFinite(createdMs)) return;
  const capRemaining = Math.min(
    idle,
    Math.floor((createdMs + SESSION_ABSOLUTE_MAX_SECONDS * 1000 - now) / 1000)
  );
  if (capRemaining <= 0) return; // ya tocó el tope: se deja morir, no se renueva

  // ¿Vale la pena escribir? Se compara contra el valor que el UPDATE va a
  // dejar de verdad (MIN(ahora+idle, creación+tope)), NO contra `idle` a secas.
  // Comparar contra `idle` fallaba a partir del día 90: pasado ese punto manda
  // el tope absoluto, expires_at ya no puede subir, pero `idle - remaining`
  // se quedaba por encima del umbral para siempre → un UPDATE de D1 en CADA
  // petición (incluido el streaming de video de Entregables). Así son ≤1
  // escritura al día a cualquier edad, y CERO una vez tocado el tope.
  const remaining = Math.floor((expMs - now) / 1000);
  if (capRemaining - remaining < SESSION_RENEW_THRESHOLD_SECONDS) return;

  await env.DB.prepare(
    `UPDATE mkt_sessions
        SET expires_at = MIN(
              datetime('now', '+' || ? || ' seconds'),
              datetime(created_at, '+' || ? || ' seconds')
            )
      WHERE id = ?`
  ).bind(String(idle), String(SESSION_ABSOLUTE_MAX_SECONDS), token).run();

  authCtx.setCookie = sessionCookie(token, capRemaining);
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cliente';
}

// Generate a slug that's unique within mkt_clients (suffix -2, -3, … on clash).
async function uniqueSlug(env, base) {
  let slug = slugify(base);
  let candidate = slug;
  let n = 1;
  // Loop is bounded in practice; guard with a hard cap anyway.
  while (n < 1000) {
    const hit = await env.DB.prepare('SELECT id FROM mkt_clients WHERE slug = ? COLLATE NOCASE').bind(candidate).first();
    if (!hit) return candidate;
    n += 1;
    candidate = `${slug}-${n}`;
  }
  return `${slug}-${randomId().slice(0, 6)}`;
}

// Best-effort activity log. NEVER throws — wrapped so logging can't break a
// mutation. Returns nothing.
async function logActivity(env, { client_id, post_id, session, action, detail }) {
  try {
    await env.DB.prepare(
      `INSERT INTO mkt_activity (id, client_id, post_id, user_id, actor_name, action, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      randomId(),
      client_id || null,
      post_id || null,
      session ? session.user_id : null,
      session ? session.name : null,
      action,
      detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail))
    ).run();
  } catch (e) {
    // Swallow — logging must never break the request.
    console.error('[mkt logActivity]', action, e && e.message);
  }
}

// Columns a team/admin user may set on a post via POST/PATCH. Everything else
// (id, client_id on update, created_by, timestamps, approval_state) is managed
// by the server. V2: `priority` joins the list; tags / assignee_user_id /
// work_start / effort_points are handled apart with dedicated sanitizers.
const POST_EDITABLE_FIELDS = [
  'title', 'content_type', 'grabacion', 'publish_date', 'publish_time', 'assignee', 'platform',
  'status', 'caption', 'inspo_url', 'video_url', 'hook', 'body', 'cta',
  'hashtags', 'alt_text', 'notes_team', 'client_visible', 'priority',
  'collaborators', 'thumb_offset'
];

// Lo que un rol CLIENTE puede escribir de un post: su contenido y el formato,
// nunca el flujo interno del equipo. Auditoría 2026-07-31: antes el PATCH solo
// verificaba que el post fuera de SU marca y luego aplicaba la lista completa —
// con devtools un cliente podía vaciar `notes_team` (que ni siquiera puede
// leer), poner status='publicado' saltándose sus 2 botones, cambiar niveles de
// grabación, auto-asignar staff (disparando notificaciones) o esconder piezas
// con client_visible=0. Su decisión de aprobación va por /approve y
// /request-changes, que sí son suyos.
const CLIENT_EDITABLE_FIELDS = [
  'title', 'content_type', 'publish_date', 'platform', 'caption',
  'inspo_url', 'video_url', 'hook', 'body', 'cta', 'hashtags', 'alt_text',
];
// Un solo lugar decide qué puede escribir cada rol: PATCH, POST y reorder.
function editablesPara(session) {
  return session && session.role === 'client' ? CLIENT_EDITABLE_FIELDS : POST_EDITABLE_FIELDS;
}
// Devuelve el nombre del primer campo prohibido presente, o null.
function campoProhibidoPara(session, bodyObj) {
  if (!session || session.role !== 'client') return null;
  return CLIENT_FORBIDDEN_FIELDS.find((f) => Object.prototype.hasOwnProperty.call(bodyObj || {}, f)) || null;
}

// `notes_people` NO está aquí a propósito (pedido de Vianey 2026-08-07: las
// revisoras del cliente dejan sus anotaciones ahí y les salía "Campo no
// editable"). Esas notas SIEMPRE fueron para que el cliente las viera —
// shapePost se las manda — y ahora también las escribe; el sanitizador
// exige {persona: texto} y cada cambio queda en el historial con su nombre.
// Lo que sigue prohibido es el flujo INTERNO del equipo: el estado va por
// sus dos botones (Aprobado / Pedir cambios), no a mano.
const CLIENT_FORBIDDEN_FIELDS = [
  'status', 'grabacion', 'assignee', 'assignee_user_id', 'notes_team',
  'client_visible', 'priority', 'approval_state',
  'work_start', 'effort_points', 'tags',
];

// Fields returned in a post object (per spec). `notes_people` is a JSON column
// shaped separately (parsed to an object) in shapePost.
const POST_RETURN_FIELDS = [
  'id', 'client_id', 'title', 'content_type', 'grabacion', 'publish_date',
  'assignee', 'platform', 'status', 'caption', 'inspo_url', 'video_url',
  'hook', 'body', 'cta', 'hashtags', 'alt_text', 'notes_team', 'client_visible',
  'approval_state', 'position', 'created_at', 'updated_at'
];

// V2 columns (migration 005). Added to the staff shape ONLY when the column
// exists in the row (pre-005 rows simply omit them: clean degradation).
// `overdue` is server-managed: NEVER editable over HTTP.
const POST_V2_FIELDS = ['priority', 'assignee_user_id', 'overdue', 'work_start', 'effort_points'];

const CONTENT_TYPES = ['reel', 'post', 'tiktok', 'informativo', 'carrusel', 'experiencia', 'pauta', 'tratamientos', 'historia', 'foto'];
const STATUSES = ['idea', 'guion', 'grabacion', 'edicion', 'revision', 'aprobado', 'programado', 'publicado'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn'];
const PRIORITIES = ['baja', 'media', 'alta', 'urgente'];

// Pipeline order (for the aprobado_mueve_estado recipe: only move FORWARD).
const STATUS_ORDER = {};
STATUSES.forEach((s, i) => { STATUS_ORDER[s] = i; });

// Labels used in resolved notification bodies (es-MX, no em-dashes).
const STATUS_LABELS = {
  idea: 'Idea', guion: 'Guion', grabacion: 'Grabación', edicion: 'Edición',
  revision: 'Revisión', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado'
};

// ── V2 sanitizers / date helpers ──

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Today in Cancun local time (UTC-5 fixed; Quintana Roo has no DST), YYYY-MM-DD.
function cancunToday() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Add n days to a YYYY-MM-DD date (UTC arithmetic, no DST surprises).
function addDaysISO(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function truncateText(s, n = 140) {
  const t = String(s == null ? '' : s).trim();
  return t.length > n ? t.slice(0, n - 3) + '...' : t;
}

// Parse a stored tags JSON array → array of strings (defaults to []).
function parseTagsStored(raw) {
  try {
    const v = JSON.parse(raw == null || raw === '' ? '[]' : raw);
    if (!Array.isArray(v)) return [];
    return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => String(s).trim()).slice(0, 12);
  } catch { return []; }
}

// Validate an incoming tags value: array of short strings, max 12 items of 30
// chars, deduped case-insensitively. Returns the sanitized array or null if
// the input is invalid (→ 400, same pattern as sanitizeNotesPeople).
function sanitizeTags(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  const seen = new Set();
  for (const s of input) {
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (!t) continue;
    if (t.length > 30) return null;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

// assignee_user_id must reference an ACTIVE staff user (admin|team) or be null.
// Returns { user } (null user = clear) or { error: Response }.
async function resolveAssigneeUser(env, value) {
  if (value === null || value === '' || value === undefined) return { user: null };
  if (typeof value !== 'string') return { error: json({ error: 'assignee_user_id invalido' }, 400) };
  const u = await env.DB.prepare(
    "SELECT id, name FROM mkt_users WHERE id = ? AND active = 1 AND role IN ('admin','team')"
  ).bind(value).first();
  if (!u) return { error: json({ error: 'assignee_user_id no existe o no esta activo' }, 400) };
  return { user: u };
}

// work_start: null/'' → null; otherwise must be YYYY-MM-DD.
// effort_points: null/'' → null; otherwise integer 0..20.
function validateWorkStart(v) {
  if (v === null || v === '' || v === undefined) return { value: null };
  if (typeof v !== 'string' || !YMD_RE.test(v)) return { error: json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400) };
  return { value: v };
}
function validateEffortPoints(v) {
  if (v === null || v === '' || v === undefined) return { value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 20) return { error: json({ error: 'effort_points debe ser un entero de 0 a 20' }, 400) };
  return { value: n };
}

// publish_date guard for NEW writes only: null/'' pass through untouched
// (legacy compatibility), anything else must be YYYY-MM-DD.
function invalidPublishDate(v) {
  return v != null && v !== '' && (typeof v !== 'string' || !YMD_RE.test(v));
}

// Detect "migration not applied yet" errors so new endpoints can answer 404
// (the v2 shell hides the bell / new views on 404 — clean degradation).
function isMissingTableError(e) {
  return !!(e && /no such table/i.test(e.message || ''));
}
async function guardTables(fn) {
  try { return await fn(); }
  catch (e) {
    if (isMissingTableError(e)) return json({ error: 'No disponible (migracion 004 pendiente)' }, 404);
    throw e;
  }
}

// Strip internal fields from a post for a client viewer.
// HARDENED (v2): explicit allowlist. status / grabacion / assignee / inspo_url
// / notes_team / notes_people / priority / tags / overdue / work_start /
// effort_points / checklist NEVER travel to the client portal.
const CLIENT_VISIBLE_FIELDS = [
  'id', 'client_id', 'title', 'content_type', 'publish_date', 'platform',
  'caption', 'hook', 'body', 'cta', 'hashtags', 'alt_text', 'video_url', 'client_visible',
  'approval_state', 'position', 'created_at', 'updated_at'
];
function publicPost(post) {
  if (!post) return post;
  const out = {};
  for (const f of CLIENT_VISIBLE_FIELDS) out[f] = post[f];
  return out;
}

// Campos de planeación INTERNA que nunca deben viajar a un login de cliente.
// Auditoría 2026-07-31: shapePost los mandaba todos (solo se borraba
// notes_team), así que con devtools un cliente veía los niveles de grabación,
// quién del equipo tiene asignada su pieza, prioridades y estimaciones — justo
// lo que la regla de producto esconde en la interfaz. Se REDACTA en vez de usar
// el allowlist CLIENT_VISIBLE_FIELDS porque el portal sí necesita status,
// inspo_url y notes_people para pintar su calendario.
const POST_INTERNAL_FIELDS = [
  'notes_team', 'grabacion', 'assignee', 'assignee_user_id',
  'priority', 'work_start', 'effort_points', 'tags', 'overdue',
];
function redactForClient(shaped) {
  for (const f of POST_INTERNAL_FIELDS) delete shaped[f];
  return shaped;
}
// Forma de salida de UN post según quién pregunta. Usarlo SIEMPRE que se
// devuelva un post: el PATCH y el POST devolvían shapePost() crudo y el portal
// del cliente se guardaba los campos internos en su estado (ronda 2, 2026-07-31).
function shapePostFor(session, post) {
  const shaped = shapePost(post);
  return (session && session.role === 'client') ? redactForClient(shaped) : shaped;
}

// Shape a full post row into the returned object (team/admin keep everything).
function shapePost(post) {
  const out = {};
  for (const f of POST_RETURN_FIELDS) out[f] = post[f];
  out.notes_people = parseNotesPeople(post.notes_people); // parsed object {person: text}
  for (const f of POST_V2_FIELDS) {
    if (post[f] !== undefined) out[f] = post[f];
  }
  if (post.tags !== undefined) out.tags = parseTagsStored(post.tags);
  return out;
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

async function handleRegister(request, env) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { name, email, password } = bodyObj || {};
  if (!name || !email || !password) return json({ error: 'Name, email and password required' }, 400);
  if (String(password).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
  if (!env.ADMIN_EMAIL) return json({ error: 'Server is missing ADMIN_EMAIL configuration' }, 500);

  // Bootstrap rule: only the configured ADMIN_EMAIL may register, and ONLY if
  // no admin already exists. Everyone else is created by an admin/team.
  if (String(email).toLowerCase() !== String(env.ADMIN_EMAIL).toLowerCase()) {
    return json({ error: 'Open registration is disabled. Ask an administrator to create your account.' }, 403);
  }
  const adminExists = await env.DB.prepare("SELECT id FROM mkt_users WHERE role = 'admin' LIMIT 1").first();
  if (adminExists) return json({ error: 'An administrator already exists.' }, 403);

  const dup = await env.DB.prepare('SELECT id FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (dup) return json({ error: 'Email already registered' }, 409);

  const id = randomId();
  const hash = await hashPassword(password);
  await env.DB.prepare(
    "INSERT INTO mkt_users (id, email, password, name, role, active, must_reset) VALUES (?, ?, ?, ?, 'admin', 1, 0)"
  ).bind(id, email, hash, name).run();

  // Auto-login the first admin.
  const sessionId = randomId();
  const expiry = sessionIdleSeconds(env);
  await env.DB.prepare(
    'INSERT INTO mkt_sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))'
  ).bind(sessionId, id, expiry).run();
  await env.DB.prepare("UPDATE mkt_users SET last_login = datetime('now') WHERE id = ?").bind(id).run();

  const fakeSession = { user_id: id, name };
  await logActivity(env, { session: fakeSession, action: 'user.register_admin', detail: email });

  return json(
    { id, email, name, role: 'admin', client_id: null },
    201,
    { 'Set-Cookie': sessionCookie(sessionId, expiry) }
  );
}

async function handleLogin(request, env) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { email, password } = bodyObj || {};
  if (!email || !password) return json({ error: 'Email and password required' }, 400);

  // Anti fuerza-bruta: 10 intentos por IP+email cada 10 minutos (ventana fija).
  const rlKey = `login:${clientIp(request)}:${String(email).toLowerCase().slice(0, 80)}`;
  if (!(await authRateLimit(env, rlKey, 10, 600))) {
    return json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, 429);
  }

  // Entra con el CORREO o con el USUARIO de toda la vida. Las cuentas viejas
  // (regeneristherapy, smilenow, MELISAFITNESS…) tienen su nombre de usuario
  // en `username`, así que siguen entrando igual mientras `email` pasa a ser
  // un correo de verdad — que es lo único que puede pedir un restablecimiento.
  const ident = String(email).trim();
  let user = null;
  try {
    user = await env.DB.prepare(
      'SELECT * FROM mkt_users WHERE email = ?1 COLLATE NOCASE OR username = ?1 COLLATE NOCASE'
    ).bind(ident).first();
  } catch {
    // Pre-migración 017 (sin columna username): búsqueda de siempre.
    user = await env.DB.prepare('SELECT * FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(ident).first();
  }
  if (!user) return json({ error: 'Credenciales incorrectas.' }, 401);
  if (!user.active) return json({ error: 'Esta cuenta está desactivada.' }, 403);
  if (!user.password) return json({ error: 'Credenciales incorrectas.' }, 401);

  const valid = await verifyPassword(password, user.password);
  if (!valid) return json({ error: 'Credenciales incorrectas.' }, 401);

  // Bóveda: si la copia visible falta o quedó desfasada (el cliente cambió su
  // contraseña por su cuenta), se refresca aquí — es el único momento en que
  // el servidor tiene la contraseña en claro sin que Vianey la haya tecleado.
  if (!user.password_enc || (await pwDecrypt(env, user.password_enc)) !== password) {
    await rememberPassword(env, user.id, password);
  }

  const sessionId = randomId();
  const expiry = sessionIdleSeconds(env);
  await env.DB.prepare(
    'INSERT INTO mkt_sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))'
  ).bind(sessionId, user.id, expiry).run();
  await env.DB.prepare("UPDATE mkt_users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

  return json(
    { id: user.id, email: user.email, name: user.name, role: user.role, client_id: user.client_id, must_reset: user.must_reset === 1, eula_required: !(await eulaAceptado(env, user.id)) },
    200,
    { 'Set-Cookie': sessionCookie(sessionId, expiry) }
  );
}

async function handleLogout(request, env, session) {
  if (session) {
    try { await env.DB.prepare('DELETE FROM mkt_sessions WHERE id = ?').bind(session.session_id).run(); } catch {}
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

async function handleMe(session, env) {
  if (!session) return json({ error: 'Not authenticated' }, 401);
  // email_verified viene de la migración 016; consulta tolerante para no
  // romper /auth/me si aún no se aplicó (default: verificado).
  let emailVerified = true;
  try {
    const r = await env.DB.prepare('SELECT email_verified FROM mkt_users WHERE id = ?').bind(session.user_id).first();
    if (r && r.email_verified === 0) emailVerified = false;
  } catch { /* pre-migración */ }
  return json({
    id: session.user_id,
    email: session.email,
    name: session.name,
    role: session.role,
    client_id: session.client_id,
    email_verified: emailVerified,
    // Apple 1.2: el shell exige aceptar el EULA antes de dejar entrar.
    eula_accepted: await eulaAceptado(env, session.user_id),
    eula_version: EULA_VERSION,
    // Apple 5.1.1(v): la app debe decir la VERDAD sobre qué se borra. Dueño
    // (marca de auto-registro) = cae todo; invitado o staff = solo su cuenta.
    is_owner: await esDuenioDeSuMarca(env, session)
  });
}

async function handleChangePassword(request, env, session) {
  if (!session) return json({ error: 'Not authenticated' }, 401);
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { current, next } = bodyObj || {};
  if (!current || !next) return json({ error: 'Current and next password required' }, 400);
  if (String(next).length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);

  const user = await env.DB.prepare('SELECT id, password FROM mkt_users WHERE id = ?').bind(session.user_id).first();
  if (!user) return json({ error: 'User not found' }, 404);
  const valid = user.password ? await verifyPassword(current, user.password) : false;
  if (!valid) return json({ error: 'La contraseña actual es incorrecta.' }, 401);

  const hash = await hashPassword(next);
  await env.DB.prepare("UPDATE mkt_users SET password = ?, must_reset = 0, updated_at = datetime('now') WHERE id = ?")
    .bind(hash, user.id).run();
  await rememberPassword(env, user.id, next); // que el panel de accesos siga al día
  // Cambiar la contraseña EXPULSA a todas las demás sesiones (se conserva la
  // actual, para no sacar de la app a quien acaba de cambiarla). Es la única
  // forma que tiene una persona de cortar el acceso de un teléfono perdido o
  // de una cookie robada: sin esto, la sesión ajena seguiría viva hasta 180
  // días. Best-effort: si falla, la contraseña ya quedó cambiada igual.
  try {
    await env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ? AND id != ?')
      .bind(user.id, session.session_id).run();
  } catch (e) { console.error('[mkt revoke sessions]', e && e.message); }
  await logActivity(env, { session, action: 'user.change_password', detail: session.email });
  return json({ ok: true });
}

// DELETE /auth/account — el cliente borra SU cuenta y TODO lo de su marca:
// posts (+comentarios), entregables (+comentarios), métricas manuales de IG,
// sesiones y usuarios de la marca, y la marca misma. Solo role='client'
// (las cuentas de staff se gestionan vía /users). Best-effort por tabla:
// las tablas de migraciones aún no aplicadas se saltan (isMissingTableError).
// ============================================================================
// CUMPLIMIENTO APP STORE (rechazo 6-ago-2026 · guidelines 1.2 y 5.1.1(v))
//
// 1.2  Contenido de usuarios: EULA aceptado de forma AFIRMATIVA, filtro de
//      lenguaje ofensivo al publicar, reportar contenido y bloquear usuarios.
// 5.1.1(v) Borrado de cuenta desde la propia app, para TODOS los roles.
//
// Regla de negocio (Vianey 2026-08-07): quien borra su cuenta solo se borra
// A SÍ MISMO, salvo que sea DUEÑO de la marca (auto-registro) — ahí sí cae
// todo el workspace. Antes CUALQUIER cliente arrasaba la marca entera.
// ============================================================================

const EULA_VERSION = '2026-08';

// Escape mínimo para el HTML de los correos de moderación.
const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Filtro de contenido ofensivo (ES + EN). Server-side a propósito: un filtro
// en el navegador no cuenta para Apple. Compara por PALABRA COMPLETA sobre el
// texto normalizado (sin acentos, sin l33t) para no castigar palabras que
// contienen otra dentro ("besos" no es un insulto).
const PALABRAS_VETADAS = [
  'puta', 'puto', 'putas', 'putos', 'pendejo', 'pendeja', 'pendejos', 'pendejas',
  'cabron', 'cabrona', 'cabrones', 'mierda', 'joder', 'jodete', 'imbecil',
  'idiota', 'estupido', 'estupida', 'maricon', 'maricones', 'marica', 'zorra',
  'perra', 'malparido', 'gilipollas', 'coño', 'verga', 'chinga', 'chingada',
  'chingar', 'culero', 'culera', 'naco', 'naca', 'retrasado', 'mongolico',
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'bastard', 'asshole', 'cunt',
  'faggot', 'nigger', 'whore', 'slut', 'rape', 'retard',
  'matarte', 'matarlo', 'matarla', 'violarte', 'muerete', 'suicidate',
];
const MAPA_L33T = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '7': 't' };
function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[4@31!05$7]/g, (c) => MAPA_L33T[c] || c)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function contenidoOfensivo(texto) {
  const t = normalizarTexto(texto);
  if (!t) return false;
  const palabras = new Set(t.split(' '));
  return PALABRAS_VETADAS.some((p) => palabras.has(normalizarTexto(p)));
}
const ERROR_MODERACION = 'Ese texto no cumple nuestras Normas de convivencia. Quita el lenguaje ofensivo e inténtalo de nuevo.';
// Devuelve una Response 422 si el texto no pasa, o null si está limpio.
async function vetarSiOfensivo(env, session, texto, donde) {
  if (!contenidoOfensivo(texto)) return null;
  try {
    await logActivity(env, {
      client_id: (session && session.client_id) || null, session,
      action: 'moderation.blocked_text', detail: donde,
    });
  } catch { /* best-effort */ }
  return json({ error: ERROR_MODERACION, code: 'CONTENIDO_OFENSIVO' }, 422);
}

// ── Bloqueo entre usuarios (unidireccional: solo afecta a quien bloquea) ─────
async function idsBloqueadosPor(env, userId) {
  if (!userId) return new Set();
  try {
    const r = await env.DB.prepare('SELECT blocked_user_id FROM mkt_blocks WHERE blocker_user_id = ?').bind(userId).all();
    return new Set((r.results || []).map((x) => x.blocked_user_id));
  } catch { return new Set(); }   // pre-migración 024
}

async function handleListBlocks(env, session) {
  try {
    const r = await env.DB.prepare(
      `SELECT b.blocked_user_id, COALESCE(u.name, b.blocked_name, 'Usuario') AS name, b.created_at
       FROM mkt_blocks b LEFT JOIN mkt_users u ON u.id = b.blocked_user_id
       WHERE b.blocker_user_id = ? ORDER BY b.created_at DESC`
    ).bind(session.user_id).all();
    return json({ blocks: r.results || [] });
  } catch { return json({ blocks: [] }); }
}

async function handleBlockUser(request, env, session) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const target = String((b || {}).user_id || '').trim();
  if (!target) return json({ error: 'Falta el usuario a bloquear.' }, 400);
  if (target === session.user_id) return json({ error: 'No puedes bloquearte a ti mismo.' }, 400);
  const nombre = String((b || {}).name || '').slice(0, 120) || null;
  await env.DB.prepare(
    'INSERT OR REPLACE INTO mkt_blocks (blocker_user_id, blocked_user_id, blocked_name) VALUES (?, ?, ?)'
  ).bind(session.user_id, target, nombre).run();
  await logActivity(env, { client_id: session.client_id || null, session, action: 'user.block', detail: nombre || target });
  return json({ ok: true });
}

async function handleUnblockUser(env, session, targetId) {
  await env.DB.prepare('DELETE FROM mkt_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?')
    .bind(session.user_id, targetId).run();
  return json({ ok: true });
}

// ── Reportes de contenido (cualquier rol) ───────────────────────────────────
const RAZONES_REPORTE = ['ofensivo', 'acoso', 'spam', 'sexual', 'odio', 'otro'];

async function handleCreateReport(request, env, session) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const targetType = String((b || {}).target_type || '').trim();
  const targetId = String((b || {}).target_id || '').trim();
  const reason = String((b || {}).reason || 'otro').trim();
  if (!targetType || !targetId) return json({ error: 'Falta el contenido a reportar.' }, 400);
  if (!RAZONES_REPORTE.includes(reason)) return json({ error: 'Motivo no válido.' }, 400);

  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO mkt_reports (id, target_type, target_id, target_author_id, target_excerpt, client_id,
      reporter_user_id, reporter_email, reason, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, targetType, targetId,
    String((b || {}).target_author_id || '') || null,
    String((b || {}).target_excerpt || '').slice(0, 400) || null,
    session.client_id || null,
    session.user_id, session.email || null,
    reason, String((b || {}).note || '').slice(0, 500) || null
  ).run();

  await logActivity(env, { client_id: session.client_id || null, session, action: 'content.report', detail: `${targetType}:${reason}` });

  // Aviso inmediato al equipo: Apple exige actuar en menos de 24 h.
  try {
    await sendAuthEmail(env, {
      to: 'info@ivaestudios.com',
      subject: '⚠️ Contenido reportado en IVAE Marketing',
      html: authEmailHtml(
        'Contenido reportado',
        `<strong style="color:#fff">${escHtml(session.name || session.email || 'Un usuario')}</strong> reportó un contenido (${escHtml(targetType)}) por <strong style="color:#fff">${escHtml(reason)}</strong>.<br/><br/>Texto: ${escHtml(String((b || {}).target_excerpt || '').slice(0, 300))}<br/><br/>Hay que resolverlo en menos de 24 horas.`,
        'Abrir la app', 'https://ivaestudios.com/marketing/app'
      ),
      text: `Reporte de ${session.email}: ${targetType} por ${reason}. Resolver en <24h.`,
    });
  } catch { /* el reporte ya quedó guardado */ }

  return json({ ok: true, id }, 201);
}

// Bandeja de moderación (solo staff).
async function handleListReports(env) {
  const r = await env.DB.prepare(
    `SELECT r.*, u.name AS reporter_name FROM mkt_reports r
     LEFT JOIN mkt_users u ON u.id = r.reporter_user_id
     ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`
  ).all();
  return json({ reports: r.results || [] });
}

// Resolver un reporte: 'removed' borra el contenido; 'dismissed' lo deja.
async function handleResolveReport(request, env, session, reportId) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const accion = String((b || {}).action || '').trim();
  if (!['removed', 'dismissed'].includes(accion)) return json({ error: "action debe ser 'removed' o 'dismissed'" }, 400);
  const rep = await env.DB.prepare('SELECT * FROM mkt_reports WHERE id = ?').bind(reportId).first();
  if (!rep) return json({ error: 'Reporte no encontrado' }, 404);

  if (accion === 'removed') {
    const tabla = rep.target_type === 'deliverable_comment' ? 'mkt_deliverable_comments'
      : rep.target_type === 'comment' ? 'mkt_comments' : null;
    if (tabla) {
      try { await env.DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(rep.target_id).run(); } catch { /* ya no existe */ }
    }
    // Expulsión del autor si se pide (Apple: "ejecting the user").
    if (b.eject && rep.target_author_id) {
      try { await env.DB.prepare('UPDATE mkt_users SET active = 0 WHERE id = ?').bind(rep.target_author_id).run(); } catch {}
      try { await env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ?').bind(rep.target_author_id).run(); } catch {}
    }
  }
  await env.DB.prepare(
    "UPDATE mkt_reports SET status = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?"
  ).bind(accion, session.email || session.user_id, reportId).run();
  await logActivity(env, { client_id: rep.client_id, session, action: 'content.moderate', detail: `${accion}:${rep.target_type}` });
  return json({ ok: true });
}

// ── EULA ────────────────────────────────────────────────────────────────────
// ¿Esta sesión es DUEÑA de su marca? (self-signup). Decide el alcance real del
// borrado de cuenta y el texto que la app le muestra al usuario.
async function esDuenioDeSuMarca(env, session) {
  if (!session || !session.client_id) return false;
  try {
    const c = await env.DB.prepare('SELECT owner_user_id FROM mkt_clients WHERE id = ?').bind(session.client_id).first();
    return !!(c && c.owner_user_id && c.owner_user_id === session.user_id);
  } catch { return false; }
}

async function handleAcceptEula(env, session) {
  await env.DB.prepare("UPDATE mkt_users SET eula_version = ?, eula_accepted_at = datetime('now') WHERE id = ?")
    .bind(EULA_VERSION, session.user_id).run();
  await logActivity(env, { client_id: session.client_id || null, session, action: 'user.accept_eula', detail: EULA_VERSION });
  return json({ ok: true, eula_version: EULA_VERSION });
}

async function eulaAceptado(env, userId) {
  try {
    const r = await env.DB.prepare('SELECT eula_version, eula_accepted_at FROM mkt_users WHERE id = ?').bind(userId).first();
    return !!(r && r.eula_accepted_at && r.eula_version === EULA_VERSION);
  } catch { return true; }   // pre-migración 024: no bloquear la app
}

async function handleDeleteAccount(request, env, session) {

  // RE-AUTENTICACIÓN (auditoría 2026-07-31): borrar es irreversible y arrasa
  // meses de trabajo de la marca. Sin esto, una sesión robada (duran 180 días)
  // o un teléfono prestado bastaban. Mismo patrón que handleChangePassword.
  let bodyObj = null;
  try { bodyObj = await request.json(); } catch { bodyObj = null; }
  const current = bodyObj && bodyObj.current;
  if (!current) return json({ error: 'Confirma tu contraseña para eliminar la cuenta.' }, 400);
  const me = await env.DB.prepare('SELECT id, password FROM mkt_users WHERE id = ?').bind(session.user_id).first();
  const ok = me && me.password ? await verifyPassword(String(current), me.password) : false;
  if (!ok) return json({ error: 'La contraseña es incorrecta.' }, 401);

  const cid = session.client_id;

  // ── ¿Qué se borra? (regla de Vianey 2026-08-07) ───────────────────────────
  // DUEÑO de la marca (auto-registro): cae TODO el workspace.
  // INVITADO por la agencia (Ale, Ana…) o STAFF: SOLO su propio usuario. Antes
  // cualquier cliente arrasaba la marca completa y el acceso de su compañera.
  let esDuenio = false;
  if (cid) {
    try {
      const c = await env.DB.prepare('SELECT owner_user_id FROM mkt_clients WHERE id = ?').bind(cid).first();
      esDuenio = !!(c && c.owner_user_id && c.owner_user_id === session.user_id);
    } catch { esDuenio = false; }   // pre-migración 024: nunca arrasar por defecto
  }

  // Log ANTES de borrar (después ya no existen ni el actor ni la marca).
  await logActivity(env, {
    client_id: cid, session, action: 'user.delete_account',
    detail: `${session.email} · ${esDuenio ? 'dueño: marca completa' : 'solo su acceso'}`,
  });

  if (!esDuenio) {
    // Borrado del USUARIO solamente. Sus comentarios se anonimizan en vez de
    // desaparecer: el hilo de aprobaciones de la marca debe seguir teniendo
    // sentido para quien se queda.
    const propios = [
      env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ?').bind(session.user_id),
      env.DB.prepare("UPDATE mkt_comments SET author_name = 'Usuario eliminado', user_id = NULL WHERE user_id = ?").bind(session.user_id),
      env.DB.prepare("UPDATE mkt_deliverable_comments SET author_name = 'Usuario eliminado', user_id = NULL WHERE user_id = ?").bind(session.user_id),
      env.DB.prepare('DELETE FROM mkt_blocks WHERE blocker_user_id = ? OR blocked_user_id = ?').bind(session.user_id, session.user_id),
      env.DB.prepare('DELETE FROM mkt_users WHERE id = ?').bind(session.user_id),
    ];
    for (const stmt of propios) {
      try { await stmt.run(); }
      catch (e) { if (!isMissingTableError(e) && !isMissingColumnError(e)) throw e; }
    }
    // Aviso al equipo: alguien perdió acceso a una marca viva.
    try {
      await sendAuthEmail(env, {
        to: 'info@ivaestudios.com',
        subject: 'Una cuenta se eliminó a sí misma — IVAE Marketing',
        html: authEmailHtml(
          'Cuenta eliminada por su titular',
          `<strong style="color:#fff">${escHtml(session.name || session.email)}</strong> (${escHtml(session.email)}) eliminó su acceso desde la app.<br/><br/>El contenido de la marca NO se tocó. Si esa persona debe seguir teniendo acceso, hay que crearle un usuario nuevo.`,
          'Abrir la app', 'https://ivaestudios.com/marketing/app'
        ),
        text: `${session.email} eliminó su propia cuenta. El contenido de la marca no se tocó.`,
      });
    } catch { /* la cuenta ya se borró */ }
    return json({ ok: true, scope: 'user' }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  // DELETEs en orden hijo→padre. Un solo batch atómico en el caso normal;
  // si falta alguna tabla opcional, reintenta uno por uno saltándola.
  const stmts = [
    env.DB.prepare('DELETE FROM mkt_comments WHERE post_id IN (SELECT id FROM mkt_posts WHERE client_id = ?)').bind(cid),
    env.DB.prepare('DELETE FROM mkt_deliverable_comments WHERE deliverable_id IN (SELECT id FROM mkt_deliverables WHERE client_id = ?)').bind(cid),
    env.DB.prepare('DELETE FROM mkt_deliverables WHERE client_id = ?').bind(cid),
    env.DB.prepare('DELETE FROM mkt_ig_manual WHERE client_id = ?').bind(cid),
    env.DB.prepare('DELETE FROM mkt_posts WHERE client_id = ?').bind(cid),
    env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id IN (SELECT id FROM mkt_users WHERE client_id = ?)').bind(cid),
    env.DB.prepare('DELETE FROM mkt_users WHERE client_id = ?').bind(cid),
    env.DB.prepare('DELETE FROM mkt_clients WHERE id = ?').bind(cid)
  ];
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (!isMissingTableError(e)) throw e;
    for (const stmt of stmts) {
      try { await stmt.run(); }
      catch (e2) { if (!isMissingTableError(e2)) throw e2; }
    }
  }
  // Cookie limpia: la sesión ya no existe en la BD.
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

// Carrusel con IA: recibe miniaturas + el plan del fotómetro y devuelve el
// carrusel escrito. Tope de payload para no reventar el Worker: 10 fotos de
// ~200 KB en base64 ≈ 2.7 MB, muy por debajo del límite de request.
async function handleCarruselGuion(request, env, session) {
  // El tope se mide ANTES de parsear: un body gigante reventaba la memoria del
  // Worker en request.json() y el chequeo de después llegaba tarde (auditoría).
  const cl = Number(request.headers.get('content-length') || 0);
  if (cl > 16_000_000) return json({ error: 'Las miniaturas pesan demasiado.' }, 413);
  // Content-Length se puede omitir (chunked), así que el peso REAL se mide
  // leyendo el texto: es el único número que no se puede falsear.
  let body;
  let crudo;
  try { crudo = await request.text(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (crudo.length > 16_000_000) return json({ error: 'Las miniaturas pesan demasiado.' }, 413);
  try { body = JSON.parse(crudo); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  crudo = null;
  // Entrada saneada campo por campo: nada del cliente viaja entero al prompt.
  const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const POS = new Set(['top', 'mid', 'bottom']);
  const MODOS = new Set(['blanco', 'oscuro', 'banda']);
  const fotos = (Array.isArray(body.fotos) ? body.fotos.slice(0, 10) : []).map((f) => ({
    b64: typeof f.b64 === 'string' ? f.b64 : '',
    mime: MIMES.has(f.mime) ? f.mime : 'image/jpeg',
    plan: f.plan && typeof f.plan === 'object' ? {
      pos: POS.has(f.plan.pos) ? f.plan.pos : 'mid',
      modo: MODOS.has(f.plan.modo) ? f.plan.modo : 'blanco',
      semaforo: f.plan.semaforo === 'ambar' ? 'ambar' : 'verde',
      aviso: String(f.plan.aviso || '').slice(0, 140),
    } : null,
  })).filter((f) => f.b64);
  if (fotos.length < 2) return json({ error: 'Sube al menos 2 fotos: la IA arma una historia, no un slide suelto.' }, 400);
  const pesado = fotos.reduce((a, f) => a + f.b64.length, 0);
  if (pesado > 12_000_000) return json({ error: 'Las miniaturas pesan demasiado.' }, 413);

  const t0 = Date.now();
  try {
    // Modo DIRIGIR: los textos vienen aprobados por la dueña y la IA solo
    // decide diseño (pos + avisos). Se sanean igual que todo lo demás.
    const textos = Array.isArray(body.textos)
      ? body.textos.slice(0, 10).map((t) => ({
          kicker: String((t && t.kicker) || '').slice(0, 60),
          title: String((t && t.title) || '').slice(0, 140),
          body: String((t && t.body) || '').slice(0, 260),
        }))
      : null;
    const out = await pedirCarrusel(env, {
      brief: String(body.brief || '').slice(0, 800),
      marca: String(body.marca || '').slice(0, 80),
      nSlides: body.nSlides,
      fotos,
      textos,
    });
    try {
      await logActivity(env, {
        client_id: body.client_id || null, session, action: 'carousel.ai',
        detail: `${out.slides.length} slides · ${Date.now() - t0}ms`,
      });
    } catch { /* best-effort */ }
    return json(out);
  } catch (e) {
    const msg = (e && e.message) || 'No se pudo generar el guion.';
    console.error('[mkt carrusel-ia]', msg);
    // 503 en fallos de servicio (para que la UI ofrezca reintentar) y 502 en el
    // resto; el mensaje viaja tal cual porque ya está escrito para la usuaria.
    return json({ error: msg, code: e && e.code }, e && e.code === 'SIN_LLAVE' ? 503 : 502);
  }
}

// ============================================================================
// REGISTRO PÚBLICO (self-signup) + verificación de email + reset por token.
// Cada registro crea SU PROPIO workspace: 1 mkt_clients (la marca) + 1
// mkt_users role='client' apuntando a ella + sesión (auto-login). El modelo
// multi-tenant existente hace el resto (el client gestiona su calendario).
// ============================================================================

// Rate limit de ventana fija sobre mkt_rate_limits. Best-effort: si la tabla
// no existe aún (pre-migración 016) NO bloquea el tráfico.
async function authRateLimit(env, key, max, windowSecs) {
  try {
    const row = await env.DB.prepare('SELECT count, window_start FROM mkt_rate_limits WHERE key = ?').bind(key).first();
    const now = Date.now();
    if (row) {
      const started = Date.parse(row.window_start + 'Z') || 0;
      if (now - started < windowSecs * 1000) {
        if (row.count >= max) return false; // excedido
        await env.DB.prepare('UPDATE mkt_rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
        return true;
      }
    }
    await env.DB.prepare(
      "INSERT INTO mkt_rate_limits (key, count, window_start) VALUES (?, 1, datetime('now')) " +
      "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = datetime('now')"
    ).bind(key).run();
    return true;
  } catch { return true; }
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Envío de correo vía Resend (mismo patrón que marketing-intake.js). Best-effort:
// devuelve true/false y JAMÁS tira — sin RESEND_API_KEY el flujo sigue (el
// banner de "verifica tu correo" simplemente persiste hasta que se configure.)
async function sendAuthEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) return false;
  const from = env.INTAKE_FROM_EMAIL || 'IVAE Marketing <info@ivaestudios.com>';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (r.ok) return true;
      if (r.status < 500) return false; // 4xx: no reintentar
    } catch { /* red: reintenta una vez */ }
    await new Promise((res) => setTimeout(res, 800));
  }
  return false;
}

function authEmailHtml(title, bodyHtml, ctaLabel, ctaUrl) {
  return `<!doctype html><body style="margin:0;background:#0A0A0E;color:#ECECF1;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#121218;border:1px solid #1E1E26;border-radius:16px;padding:28px">
    <div style="font-size:13px;font-weight:bold;letter-spacing:.12em;color:#E24DA0;margin-bottom:14px">IVAE MARKETING</div>
    <h1 style="font-size:20px;margin:0 0 12px;color:#fff">${title}</h1>
    <div style="font-size:14px;line-height:1.6;color:#9A9AA8">${bodyHtml}</div>
    ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#E24DA0,#9D5BE0);color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:12px">${ctaLabel}</a>
    <div style="font-size:12px;color:#62626F;margin-top:16px;word-break:break-all">Si el botón no funciona, copia este enlace:<br>${ctaUrl}</div>` : ''}
  </div></body>`;
}

// POST /auth/signup — registro público: crea marca + usuario + sesión.
async function handleSignup(request, env) {
  const ip = clientIp(request);
  if (!(await authRateLimit(env, `signup:ip:${ip}`, 5, 3600))) {
    return json({ error: 'Demasiados registros desde esta conexión. Intenta más tarde.' }, 429);
  }
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const name = String((bodyObj || {}).name || '').trim();
  const brand = String((bodyObj || {}).brand || '').trim();
  const email = String((bodyObj || {}).email || '').trim().toLowerCase();
  const password = String((bodyObj || {}).password || '');
  if (!name || !brand || !email || !password) return json({ error: 'Nombre, marca, email y contraseña son obligatorios.' }, 400);
  // Apple 1.2: la aceptación del EULA debe ser AFIRMATIVA y quedar registrada.
  if (!(bodyObj || {}).eula_accepted) {
    return json({ error: 'Debes aceptar los Términos de Uso para crear tu cuenta.' }, 400);
  }
  if (!EMAIL_RE.test(email)) return json({ error: 'Ese email no parece válido.' }, 400);
  if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  if (name.length > 80 || brand.length > 80) return json({ error: 'Nombre o marca demasiado largos.' }, 400);

  const dup = await env.DB.prepare('SELECT id FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (dup) return json({ error: 'Ese email ya tiene una cuenta. Inicia sesión.' }, 409);

  // Workspace propio: la marca del usuario (defaults del schema) + su login.
  const clientId = randomId();
  const slug = await uniqueSlug(env, brand);
  const userId = randomId();
  const hash = await hashPassword(password);
  const verifyToken = randomId();
  const sessionId = randomId();
  const expiry = sessionIdleSeconds(env);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO mkt_clients (id, name, slug, note_labels, owner_user_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(clientId, brand, slug, JSON.stringify([]), userId),
    env.DB.prepare(
      "INSERT INTO mkt_users (id, email, password, name, role, client_id, active, must_reset, email_verified, verify_token, eula_version, eula_accepted_at) VALUES (?, ?, ?, ?, 'client', ?, 1, 0, 0, ?, ?, datetime('now'))"
    ).bind(userId, email, hash, name, clientId, verifyToken, EULA_VERSION),
    env.DB.prepare(
      'INSERT INTO mkt_sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))'
    ).bind(sessionId, userId, expiry),
    env.DB.prepare("UPDATE mkt_users SET last_login = datetime('now') WHERE id = ?").bind(userId),
  ]);
  await rememberPassword(env, userId, password);

  const verifyUrl = `https://ivaestudios.com/api/marketing/auth/verify?token=${verifyToken}`;
  await sendAuthEmail(env, {
    to: email,
    subject: 'Confirma tu correo — IVAE Marketing',
    html: authEmailHtml(
      `Hola ${name}, confirma tu correo`,
      `Tu espacio de trabajo <strong style="color:#fff">${brand}</strong> ya está listo. Confirma tu correo para asegurar tu cuenta.`,
      'Confirmar mi correo', verifyUrl
    ),
    text: `Hola ${name}. Tu espacio "${brand}" ya está listo. Confirma tu correo: ${verifyUrl}`,
  });

  await logActivity(env, { client_id: clientId, session: { user_id: userId, name }, action: 'user.signup', detail: email });
  return json(
    { id: userId, email, name, role: 'client', client_id: clientId, email_verified: false },
    201,
    { 'Set-Cookie': sessionCookie(sessionId, expiry) }
  );
}

// GET /auth/verify?token=... — confirma el correo y regresa a la app.
async function handleVerifyEmail(env, url) {
  const token = String(url.searchParams.get('token') || '');
  const appUrl = 'https://ivaestudios.com/marketing/app';
  if (token.length < 16) return Response.redirect(`${appUrl}?verified=0`, 302);
  const user = await env.DB.prepare('SELECT id FROM mkt_users WHERE verify_token = ?').bind(token).first();
  if (!user) return Response.redirect(`${appUrl}?verified=0`, 302);
  await env.DB.prepare(
    "UPDATE mkt_users SET email_verified = 1, verify_token = NULL, updated_at = datetime('now') WHERE id = ?"
  ).bind(user.id).run();
  return Response.redirect(`${appUrl}?verified=1`, 302);
}

// POST /auth/resend-verify — reenvía el correo de verificación (sesión requerida).
// Si el correo del signup se perdió (spam / Resend caído) el usuario quedaba
// email_verified=0 para siempre; esto regenera el verify_token y lo reenvía.
// Rate limit: 3 reenvíos por hora por usuario.
async function handleResendVerify(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Not authenticated' }, 401);
  if (!(await authRateLimit(env, `resendverify:user:${session.user_id}`, 3, 3600))) {
    return json({ error: 'Demasiados reenvíos. Intenta en una hora.' }, 429);
  }
  const user = await env.DB.prepare(
    'SELECT id, email, name, email_verified FROM mkt_users WHERE id = ?'
  ).bind(session.user_id).first();
  if (!user) return json({ error: 'Not authenticated' }, 401);
  if (user.email_verified) return json({ ok: true, verified: true });

  // Token nuevo (invalida el enlace viejo) + reenvío.
  const verifyToken = randomId();
  await env.DB.prepare(
    "UPDATE mkt_users SET verify_token = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(verifyToken, user.id).run();
  const verifyUrl = `https://ivaestudios.com/api/marketing/auth/verify?token=${verifyToken}`;
  const sent = await sendAuthEmail(env, {
    to: user.email,
    subject: 'Confirma tu correo — IVAE Marketing',
    html: authEmailHtml(
      `Hola ${user.name}, confirma tu correo`,
      'Aquí tienes un nuevo enlace para confirmar tu correo y asegurar tu cuenta.',
      'Confirmar mi correo', verifyUrl
    ),
    text: `Hola ${user.name}. Confirma tu correo: ${verifyUrl}`,
  });
  // Aquí SÍ se avisa el fallo (hay sesión: no aplica anti-enumeración).
  if (!sent) {
    console.error('[mkt resend-verify] fallo al enviar el correo de verificación');
    return json({ error: 'No pudimos enviar el correo. Intenta más tarde.' }, 503);
  }
  return json({ ok: true, sent: true });
}

// POST /auth/forgot — pide reset por email. SIEMPRE responde ok (no enumera).
async function handleForgotPassword(request, env) {
  const ip = clientIp(request);
  if (!(await authRateLimit(env, `forgot:ip:${ip}`, 5, 3600))) return json({ ok: true });
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const email = String((bodyObj || {}).email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: true });
  // Sin RESEND_API_KEY el correo no puede salir para NADIE: misma respuesta
  // exista o no la cuenta (anti-enumeración intacta), pero con sent:false y log.
  if (!env.RESEND_API_KEY) {
    console.error('[mkt forgot] RESEND_API_KEY no configurada: no se puede enviar el correo de reset');
    return json({ ok: true, sent: false });
  }
  const user = await env.DB.prepare('SELECT id, name FROM mkt_users WHERE email = ? COLLATE NOCASE AND active = 1').bind(email).first();
  if (user) {
    const token = randomId();
    await env.DB.prepare(
      "UPDATE mkt_users SET reset_token = ?, reset_expires = datetime('now', '+1 hour') WHERE id = ?"
    ).bind(token, user.id).run();
    const resetUrl = `https://ivaestudios.com/marketing/?reset=${token}`;
    const sent = await sendAuthEmail(env, {
      to: email,
      subject: 'Restablece tu contraseña — IVAE Marketing',
      html: authEmailHtml(
        'Restablecer contraseña',
        'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora. Si no fuiste tú, ignora este correo.',
        'Crear nueva contraseña', resetUrl
      ),
      text: `Restablece tu contraseña (vence en 1 hora): ${resetUrl}`,
    });
    // Fallo del proveedor (Resend caído / 4xx): avisar en vez de fingir éxito.
    // No revela si el email existe: el proveedor falla igual para todos.
    if (!sent) {
      console.error('[mkt forgot] fallo al enviar el correo de reset');
      return json({ error: 'No pudimos enviar el correo. Intenta más tarde.' }, 503);
    }
  }
  return json({ ok: true });
}

// POST /auth/reset-with-token — fija la nueva contraseña y cierra TODAS las
// sesiones del usuario (seguridad: un token de email manda sobre sesiones vivas).
async function handleResetWithToken(request, env) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const token = String((bodyObj || {}).token || '');
  const password = String((bodyObj || {}).password || '');
  if (token.length < 16) return json({ error: 'Enlace inválido o vencido. Pide uno nuevo.' }, 400);
  if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  const user = await env.DB.prepare(
    "SELECT id, email FROM mkt_users WHERE reset_token = ? AND reset_expires > datetime('now')"
  ).bind(token).first();
  if (!user) return json({ error: 'Enlace inválido o vencido. Pide uno nuevo.' }, 400);
  const hash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE mkt_users SET password = ?, must_reset = 0, reset_token = NULL, reset_expires = NULL, email_verified = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(hash, user.id),
    env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ?').bind(user.id),
  ]);
  await rememberPassword(env, user.id, password); // el panel de accesos sigue al día
  await logActivity(env, { session: { user_id: user.id, name: user.email }, action: 'user.reset_with_token', detail: user.email });
  return json({ ok: true });
}

// ============================================================================
// CLIENTS
// ============================================================================

async function clientCounts(env, clientId) {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM mkt_posts WHERE client_id = ?) AS posts,
       (SELECT COUNT(*) FROM mkt_posts WHERE client_id = ? AND approval_state IN ('pending','changes') AND client_visible = 1) AS pending`
  ).bind(clientId, clientId).first();
  return { posts: row ? row.posts : 0, pending: row ? row.pending : 0 };
}

function shapeClient(c, counts) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    brand_color: c.brand_color,
    logo_url: c.logo_url,
    instagram_handle: c.instagram_handle,
    note_labels: parseNoteLabels(c.note_labels), // parsed array of person names
    archived: c.archived,
    // ¿El cliente puede DESCARGAR sus entregables? Lo decide Vianey por marca.
    // Por defecto sí (COALESCE): ninguna marca cambia de comportamiento al
    // aparecer la columna.
    downloads_enabled: c.downloads_enabled == null ? 1 : (c.downloads_enabled ? 1 : 0),
    // Bug preexistente: este campo NUNCA viajaba, así que el interruptor de
    // "Avisos automáticos" siempre se pintaba en Activado aunque estuviera
    // apagado en la base (el backend sí lo respetaba; mentía la pantalla).
    reminders_enabled: c.reminders_enabled == null ? 1 : (c.reminders_enabled ? 1 : 0),
    counts: counts || { posts: 0, pending: 0 }
  };
}

// Explicit allowlist of what a CLIENT login may see about its own client
// record. Never reuse shapeClient here: it carries internal fields
// (note_labels = team member names, slug, archived, total post counts
// including non client_visible posts) that must not reach the portal,
// not even as invisible payload in devtools.
function shapeClientForPortal(c, counts) {
  return {
    id: c.id,
    name: c.name,
    brand_color: c.brand_color,
    logo_url: c.logo_url,
    instagram_handle: c.instagram_handle,
    downloads_enabled: c.downloads_enabled == null ? 1 : (c.downloads_enabled ? 1 : 0),
    // Only 'pending' (already filtered by client_visible = 1). 'posts'
    // would reveal how many hidden contents exist.
    counts: { pending: counts ? counts.pending : 0 }
  };
}

async function handleListClients(env, session) {
  // El cliente ve SOLO su propia marca, pero con el objeto COMPLETO (incl.
  // note_labels) porque ahora usa el calendario compartido idéntico al del
  // equipo (decision de la duena: el cliente ve y edita todo lo suyo). El
  // aislamiento entre marcas se mantiene: solo se devuelve SU client_id.
  if (session.role === 'client') {
    if (!session.client_id) return json([]);
    const c = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(session.client_id).first();
    if (!c) return json([]);
    return json([shapeClient(c, await clientCounts(env, c.id))]);
  }
  // Conteos de TODAS las marcas en UNA query agrupada (antes: 1 + 2×N queries en
  // serie, una por cliente, en la ruta crítica del arranque).
  const res = await env.DB.prepare('SELECT * FROM mkt_clients ORDER BY archived ASC, name COLLATE NOCASE ASC').all();
  const rows = res.results || [];
  const countsRes = await env.DB.prepare(
    `SELECT client_id,
       COUNT(*) AS posts,
       SUM(CASE WHEN approval_state IN ('pending','changes') AND client_visible = 1 THEN 1 ELSE 0 END) AS pending
     FROM mkt_posts GROUP BY client_id`
  ).all();
  const cmap = new Map();
  for (const r of (countsRes.results || [])) cmap.set(r.client_id, { posts: r.posts || 0, pending: r.pending || 0 });
  const out = rows.map((c) => shapeClient(c, cmap.get(c.id) || { posts: 0, pending: 0 }));
  return json(out);
}

async function handleCreateClient(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { name, brand_color, instagram_handle, logo_url, timezone, notes } = bodyObj || {};
  if (!name || !String(name).trim()) return json({ error: 'Client name required' }, 400);

  // Optional per-person note labels (must be an array of short strings).
  let noteLabels = [];
  if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'note_labels')) {
    const sane = sanitizeNoteLabels(bodyObj.note_labels);
    if (sane === null) return json({ error: 'note_labels must be an array of short strings' }, 400);
    noteLabels = sane;
  }

  const id = randomId();
  const slug = await uniqueSlug(env, name);
  await env.DB.prepare(
    `INSERT INTO mkt_clients (id, name, slug, brand_color, logo_url, instagram_handle, timezone, notes, note_labels)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, String(name).trim(), slug,
    brand_color || '#7c3aed',
    logo_url || null,
    instagram_handle || null,
    timezone || 'America/Cancun',
    notes || null,
    JSON.stringify(noteLabels)
  ).run();

  const c = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(id).first();
  await logActivity(env, { client_id: id, session, action: 'client.create', detail: name });
  return json(shapeClient(c, { posts: 0, pending: 0 }), 201);
}

async function handlePatchClient(request, env, session, clientId) {
  const existing = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!existing) return json({ error: 'Client not found' }, 404);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const allowed = ['name', 'brand_color', 'logo_url', 'instagram_handle', 'timezone', 'notes', 'archived', 'contact_email', 'reminders_enabled', 'downloads_enabled'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, f)) {
      sets.push(`${f} = ?`);
      vals.push(['archived', 'reminders_enabled', 'downloads_enabled'].includes(f) ? (bodyObj[f] ? 1 : 0) : bodyObj[f]);
    }
  }
  // note_labels is a JSON column → validate + stringify separately.
  if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'note_labels')) {
    const sane = sanitizeNoteLabels(bodyObj.note_labels);
    if (sane === null) return json({ error: 'note_labels must be an array of short strings' }, 400);
    sets.push('note_labels = ?');
    vals.push(JSON.stringify(sane));
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  sets.push("updated_at = datetime('now')");
  vals.push(clientId);
  await env.DB.prepare(`UPDATE mkt_clients SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const c = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(clientId).first();
  await logActivity(env, { client_id: clientId, session, action: 'client.update', detail: Object.keys(bodyObj || {}).join(',') });
  return json(shapeClient(c, await clientCounts(env, clientId)));
}

async function handleArchiveClient(env, session, clientId) {
  const existing = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!existing) return json({ error: 'Client not found' }, 404);
  await env.DB.prepare("UPDATE mkt_clients SET archived = 1, updated_at = datetime('now') WHERE id = ?").bind(clientId).run();
  // Cortar el acceso de la marca archivada: cierra las sesiones vivas de sus
  // logins de cliente y los desactiva (sin esto el login seguía 100% funcional).
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM mkt_sessions WHERE user_id IN (SELECT id FROM mkt_users WHERE client_id = ? AND role = 'client')"
    ).bind(clientId),
    env.DB.prepare(
      "UPDATE mkt_users SET active = 0, updated_at = datetime('now') WHERE client_id = ? AND role = 'client'"
    ).bind(clientId),
  ]);
  await logActivity(env, { client_id: clientId, session, action: 'client.archive' });
  return json({ ok: true, archived: 1 });
}

// GET /clients/:id/brief — el brief de onboarding que llenó la marca (JSON en
// mkt_clients.brief). SOLO staff: es material interno del equipo. Tolerante a
// la migración pendiente (estilo isMissingTableError, pero la columna nueva
// dispara "no such column") → 404 limpio en vez de 500.
async function handleGetClientBrief(env, clientId) {
  let row;
  try {
    row = await env.DB.prepare('SELECT brief FROM mkt_clients WHERE id = ?').bind(clientId).first();
  } catch (e) {
    if (isMissingTableError(e) || /no such column/i.test((e && e.message) || '')) {
      return json({ error: 'Esta marca aún no llena su brief' }, 404);
    }
    throw e;
  }
  if (!row) return json({ error: 'Client not found' }, 404);
  if (row.brief == null || row.brief === '') return json({ error: 'Esta marca aún no llena su brief' }, 404);
  let brief = null;
  try { brief = JSON.parse(row.brief); } catch { /* brief corrupto → 404 abajo */ }
  if (brief == null) return json({ error: 'Esta marca aún no llena su brief' }, 404);
  return json(brief);
}

// ============================================================================
// USERS (team + client logins) — admin/team only
// ============================================================================

function shapeUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username || null,
    name: u.name,
    role: u.role,
    client_id: u.client_id,
    active: u.active,
    last_login: u.last_login,
    // La contraseña NUNCA viaja en la lista: solo si hay copia guardada y
    // desde cuándo. El valor se pide aparte, uno por uno (GET /users/:id/password).
    has_password_copy: u.password_enc ? true : false,
    password_saved_at: u.password_enc_at || null,
  };
}

// Columnas que devuelve el CRUD de usuarios. `password_enc` viaja solo para
// que shapeUser sepa si HAY copia — el texto cifrado no sale nunca de aquí.
const USER_COLS = 'id, email, username, name, role, client_id, active, last_login, password_enc, password_enc_at';

async function handleListUsers(env) {
  let res;
  try {
    res = await env.DB.prepare(
      `SELECT ${USER_COLS} FROM mkt_users ORDER BY role ASC, name COLLATE NOCASE ASC`
    ).all();
  } catch {
    // Pre-migración 017: sin username ni bóveda.
    res = await env.DB.prepare(
      'SELECT id, email, name, role, client_id, active, last_login FROM mkt_users ORDER BY role ASC, name COLLATE NOCASE ASC'
    ).all();
  }
  return json((res.results || []).map(shapeUser));
}

// GET /users/:id/password — devuelve la contraseña guardada EN CLARO.
// Solo admin (no 'team'): es la credencial completa de la cuenta. Cada lectura
// queda en la bitácora de actividad, para que se pueda auditar quién la vio.
async function handleRevealPassword(env, session, userId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  let row;
  try {
    row = await env.DB.prepare('SELECT id, email, name, password_enc, password_enc_at FROM mkt_users WHERE id = ?')
      .bind(userId).first();
  } catch {
    return json({ password: null, reason: 'vault_missing' });
  }
  if (!row) return json({ error: 'User not found' }, 404);
  if (!row.password_enc) return json({ password: null, reason: 'not_captured', saved_at: null });
  const plain = await pwDecrypt(env, row.password_enc);
  if (plain === null) return json({ password: null, reason: 'vault_unavailable', saved_at: row.password_enc_at });
  await logActivity(env, { session, action: 'user.reveal_password', detail: row.email });
  return json({ password: plain, saved_at: row.password_enc_at });
}

// POST /users/:id/remember-password — guarda en la bóveda una contraseña que
// YA es la del cliente, sin cambiarla ni cerrarle la sesión.
//
// Sirve para las cuentas de antes de la bóveda: Vianey se sabe la contraseña
// pero el sistema solo tiene el hash. Antes, la única forma de que apareciera
// en el panel era CAMBIARLA (y eso echa al cliente de su sesión). Aquí la
// escribe, se comprueba contra el hash de siempre, y si coincide se guarda la
// copia cifrada. Si no coincide no pasa nada: no cambia ninguna contraseña.
async function handleRememberPassword(request, env, session, userId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  // Aunque ya pide admin, se limita el ritmo: así no sirve para adivinar
  // contraseñas a fuerza bruta si alguien se colara con una sesión de admin.
  if (!(await authRateLimit(env, `rememberpw:${session.user_id}`, 30, 3600))) {
    return json({ error: 'Demasiados intentos. Espera un rato.' }, 429);
  }
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const pw = String((bodyObj || {}).password || '');
  if (!pw) return json({ error: 'Escribe la contraseña.' }, 400);
  const row = await env.DB.prepare('SELECT id, email, password FROM mkt_users WHERE id = ?').bind(userId).first();
  if (!row) return json({ error: 'User not found' }, 404);
  const valid = row.password ? await verifyPassword(pw, row.password) : false;
  if (!valid) return json({ error: 'Esa no es la contraseña actual de esta cuenta.' }, 400);
  await rememberPassword(env, userId, pw);
  const check = await env.DB.prepare('SELECT password_enc FROM mkt_users WHERE id = ?').bind(userId).first();
  if (!check || !check.password_enc) return json({ error: 'No se pudo guardar en la bóveda. Intenta de nuevo.' }, 503);
  await logActivity(env, { session, action: 'user.remember_password', detail: row.email });
  return json({ ok: true });
}

async function handleCreateUser(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { name, email, role, client_id, password } = bodyObj || {};
  if (!name || !email || !role) return json({ error: 'Name, email and role required' }, 400);
  // Trim del usuario (email): un espacio accidental lo volvía imposible de
  // loguear y burlaba el chequeo de duplicados (igual que patch/signup).
  const em = String(email).trim();
  if (!em) return json({ error: 'Name, email and role required' }, 400);
  if (role !== 'team' && role !== 'client') return json({ error: "role must be 'team' or 'client'" }, 400);
  if (role === 'client') {
    if (!client_id) return json({ error: 'client_id required for a client login' }, 400);
    const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(client_id).first();
    if (!c) return json({ error: 'client_id does not exist' }, 400);
  }

  const dup = await env.DB.prepare('SELECT id FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(em).first();
  if (dup) return json({ error: 'Email already registered' }, 409);

  // If no password supplied, generate a temp one and force a reset on first login.
  let plainToReturn = null;
  let mustReset = 0;
  let pw = password;
  if (!pw) {
    pw = generateSimplePassword();
    plainToReturn = pw;
    mustReset = 1;
  } else if (String(pw).length < 6) {
    return json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const id = randomId();
  const hash = await hashPassword(pw);
  await env.DB.prepare(
    'INSERT INTO mkt_users (id, email, password, name, role, client_id, active, must_reset) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
  ).bind(id, em, hash, name, role, role === 'client' ? client_id : null, mustReset).run();
  await rememberPassword(env, id, pw);

  await logActivity(env, {
    client_id: role === 'client' ? client_id : null,
    session,
    action: 'user.create',
    detail: `${role}:${email}`
  });

  const created = await env.DB.prepare(
    `SELECT ${USER_COLS} FROM mkt_users WHERE id = ?`
  ).bind(id).first();

  const out = shapeUser(created);
  // Return the generated password ONCE so it can be shared with the new user.
  if (plainToReturn) out.password = plainToReturn;
  return json(out, 201);
}

async function handlePatchUser(request, env, session, userId) {
  const existing = await env.DB.prepare('SELECT * FROM mkt_users WHERE id = ?').bind(userId).first();
  if (!existing) return json({ error: 'User not found' }, 404);

  // Privilege guard: only an admin may modify an admin account.
  // Without this, a 'team' caller could demote (role) or lock out
  // (active=0) the owner's admin account.
  if (existing.role === 'admin' && session.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const has = (k) => bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, k);

  // Cambiar correo, usuario o contraseña son primitivas de takeover: un 'team'
  // solo puede hacerlo sobre logins de CLIENTE; sobre admin/team requiere admin.
  if ((has('email') || has('username') || has('password')) && existing.role !== 'client' && session.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  // Un identificador de login (correo o usuario) no puede chocar con NINGÚN
  // otro identificador de otra cuenta, porque el login busca en las dos
  // columnas: si chocaran, dos cuentas responderían a la misma cadena.
  const identTaken = async (value) => {
    try {
      const row = await env.DB.prepare(
        'SELECT id FROM mkt_users WHERE (email = ?1 COLLATE NOCASE OR username = ?1 COLLATE NOCASE) AND id != ?2'
      ).bind(value, userId).first();
      return !!row;
    } catch {
      const row = await env.DB.prepare('SELECT id FROM mkt_users WHERE email = ? COLLATE NOCASE AND id != ?')
        .bind(value, userId).first();
      return !!row;
    }
  };

  const sets = [];
  const vals = [];
  if (has('name')) { sets.push('name = ?'); vals.push(bodyObj.name); }
  if (has('active')) { sets.push('active = ?'); vals.push(bodyObj.active ? 1 : 0); }
  // Correo: no vacío y único. Para los CLIENTES exige un correo de verdad,
  // porque es la única dirección a la que se puede mandar el restablecimiento.
  if (has('email')) {
    const email = String(bodyObj.email || '').trim();
    if (!email) return json({ error: 'El correo no puede quedar vacío' }, 400);
    if (existing.role === 'client' && !EMAIL_RE.test(email)) {
      return json({ error: 'Escribe un correo válido (con @). Es el que recibirá el enlace para restablecer la contraseña.' }, 400);
    }
    if (await identTaken(email)) return json({ error: 'Ese correo ya está en uso' }, 409);
    sets.push('email = ?'); vals.push(email);
  }
  // Usuario: alias de login opcional (las cuentas viejas entran con él).
  // Cadena vacía = borrarlo (queda solo el correo).
  if (has('username')) {
    const uname = String(bodyObj.username || '').trim();
    if (uname) {
      if (uname.includes('@')) return json({ error: 'El usuario no lleva @. Ese dato va en el campo de correo.' }, 400);
      if (await identTaken(uname)) return json({ error: 'Ese usuario ya está en uso' }, 409);
      sets.push('username = ?'); vals.push(uname);
    } else {
      sets.push('username = NULL');
    }
  }
  // Contraseña: mínimo 6, se guarda hasheada y deja de forzar el cambio inicial.
  if (has('password')) {
    const pw = String(bodyObj.password || '');
    if (pw.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
    sets.push('password = ?'); vals.push(await hashPassword(pw));
    sets.push('must_reset = ?'); vals.push(0);
  }
  if (has('role')) {
    const r = bodyObj.role;
    if (r !== 'team' && r !== 'client' && r !== 'admin') return json({ error: 'Invalid role' }, 400);
    // Only an admin may grant/keep the admin role.
    if (r === 'admin' && session.role !== 'admin') return json({ error: 'Only an admin can assign the admin role' }, 403);
    sets.push('role = ?'); vals.push(r);
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  sets.push("updated_at = datetime('now')");
  vals.push(userId);
  await env.DB.prepare(`UPDATE mkt_users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  // Cambiar la contraseña desde el panel TIRA las sesiones de esa cuenta: la
  // credencial vieja deja de servir de verdad, no solo al teclearla. Se
  // conserva la sesión de quien hizo el cambio por si se cambió a sí mismo.
  // (Renombrar el usuario NO expulsa: la sesión va por token, no por correo.)
  // Best-effort: el cambio ya quedó guardado pase lo que pase.
  if (has('password')) {
    await rememberPassword(env, userId, String(bodyObj.password || ''));
    try {
      await env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ? AND id != ?')
        .bind(userId, session.session_id).run();
    } catch (e) { console.error('[mkt revoke sessions]', e && e.message); }
  }

  const updated = await env.DB.prepare(
    `SELECT ${USER_COLS} FROM mkt_users WHERE id = ?`
  ).bind(userId).first();
  await logActivity(env, { session, action: 'user.update', detail: `${existing.email}:${Object.keys(bodyObj || {}).join(',')}` });
  return json(shapeUser(updated));
}

async function handleResetUserPassword(env, session, userId) {
  const existing = await env.DB.prepare('SELECT id, email, role FROM mkt_users WHERE id = ?').bind(userId).first();
  if (!existing) return json({ error: 'User not found' }, 404);
  // Privilege guard: the reset returns the new password in clear text, so it
  // is an account-takeover primitive. A 'team' caller may only reset CLIENT
  // logins (legit portal workflow). Resetting an admin or another team
  // account requires an admin session. (Own password: /auth/change-password.)
  if (session.role !== 'admin' && existing.role !== 'client') {
    return json({ error: 'Forbidden' }, 403);
  }
  const pw = generateSimplePassword();
  const hash = await hashPassword(pw);
  await env.DB.prepare("UPDATE mkt_users SET password = ?, must_reset = 1, updated_at = datetime('now') WHERE id = ?")
    .bind(hash, userId).run();
  await rememberPassword(env, userId, pw);
  // Restablecer la contraseña TIRA todas las sesiones del usuario afectado.
  // Es lo que Vianey usa cuando a un cliente le roban el teléfono o cuando hay
  // que cortarle el acceso a alguien: si no, la sesión vieja seguiría entrando
  // con la cookie hasta 180 días aunque la contraseña ya sea otra.
  try {
    await env.DB.prepare('DELETE FROM mkt_sessions WHERE user_id = ?').bind(userId).run();
  } catch (e) { console.error('[mkt revoke sessions]', e && e.message); }
  await logActivity(env, { session, action: 'user.reset_password', detail: existing.email });
  return json({ password: pw });
}

// ============================================================================
// V2 — NOTIFICATIONS ENGINE + AUTOMATIONS (8 fixed recipes) + LAZY SWEEP
// ============================================================================
// Design rules:
//   - notify() is best-effort (try/catch, like logActivity): a notification
//     failure NEVER breaks the API response.
//   - Event recipes run AFTER the commit, wrapped in try/catch, depth 1:
//     changes made BY an automation are direct UPDATEs that never re-trigger
//     recipes (anti-loop).
//   - Time recipes run in lazySweep (PRIMARY mechanism, throttled 15 min via
//     mkt_kv), hung off GET /notifications + /notifications/unread-count.
//     POST /cron (GitHub Actions, Bearer secret) is an optional BACKUP.
//   - Daily dedupe via mkt_automation_runs.run_key = '<recipe>:<post>:<date>'
//     with INSERT OR IGNORE: only notify when the insert actually landed.
//   - Fan-out: assignee_user_id + active admins, excluding the actor, deduped.
//   - v2: los usuarios role=client SÍ reciben avisos propios (pedido de
//     aprobación, comentario visible del equipo, entregable nuevo) vía
//     clientUserIds(); las recetas/automatizaciones siguen siendo del equipo.
//   - Bodies arrive RESOLVED (es-MX, no em-dashes): history never changes if
//     a post is renamed later.

// Fixed recipe catalog. Keys are identical in the frontend catalog
// (js/services/automations.js). Value = allowed config shape.
const AUTOMATION_RECIPES = {
  aprobado_mueve_estado: {},      // client approves → move status to 'aprobado' + notify team
  aviso_cambios: {},              // client requests changes → notify assignee + admins (with comment)
  aviso_comentario: {},           // a comment lands → notify the team thread
  aviso_asignacion: {},           // assignee_user_id changes → notify the new assignee (never self)
  recordatorio_publicacion: { days_before: [1, 2] }, // time: remind N days before publish_date
  marcar_atrasado: {},            // time: date passed → overdue=1 + notify (1/day)
  aviso_revision_cliente: {},     // status lands on 'revision' (visible) → notify team it awaits the client
  alerta_sin_aprobar: {}          // time: publish date arrived without approval → alert
};

// Sanitize a recipe config. Returns the clean object or null (→ 400).
function sanitizeAutomationConfig(recipeKey, cfg) {
  if (cfg === undefined || cfg === null) return {};
  if (typeof cfg !== 'object' || Array.isArray(cfg)) return null;
  if (recipeKey === 'recordatorio_publicacion') {
    const db = Number(cfg.days_before == null ? 1 : cfg.days_before);
    if (db !== 1 && db !== 2) return null;
    return { days_before: db };
  }
  return {}; // every other recipe has no config; unknown keys are dropped
}

// Load the automations table → { recipe_key: { enabled, config } }.
// Throws "no such table" pre-004 (callers catch / guardTables handles routes).
async function loadAutomations(env) {
  const res = await env.DB.prepare('SELECT recipe_key, enabled, config FROM mkt_automations').all();
  const map = {};
  for (const row of (res.results || [])) {
    let cfg = {};
    try { cfg = JSON.parse(row.config || '{}') || {}; } catch { cfg = {}; }
    map[row.recipe_key] = { enabled: row.enabled === 1, config: cfg };
  }
  return map;
}
function recipeOn(autos, key) {
  // Missing row (fresh db before seed) counts as enabled=default(1) only if
  // the key exists in the catalog; be conservative: missing row = disabled.
  return !!(autos[key] && autos[key].enabled);
}

// Insert one notification row per target user. Best-effort.
async function notify(env, { user_ids, type, body, link, post_id, comment_id, client_id, actor_name }) {
  try {
    const ids = [...new Set((user_ids || []).filter(Boolean))];
    if (!ids.length || !body) return 0;
    const stmts = ids.map((uid) => env.DB.prepare(
      `INSERT INTO mkt_notifications (id, user_id, client_id, post_id, comment_id, type, actor_name, body, link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      randomId(), uid, client_id || null, post_id || null, comment_id || null,
      type, actor_name || null, String(body), link || null
    ));
    await env.DB.batch(stmts);
    return ids.length;
  } catch (e) {
    console.error('[mkt notify]', type, e && e.message);
    return 0;
  }
}

// Fan-out targets for a post event: active admins + the typed assignee,
// excluding the actor. (Los avisos AL cliente van aparte, vía clientUserIds.)
async function staffFanout(env, post, excludeUserId) {
  const res = await env.DB.prepare(
    "SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1"
  ).all();
  const ids = (res.results || []).map((r) => r.id);
  if (post && post.assignee_user_id) ids.push(post.assignee_user_id);
  return [...new Set(ids)].filter((id) => id && id !== excludeUserId);
}

// Cuentas de cliente (role='client', activas) de una marca, excluyendo al
// actor. v2: el cliente SÍ recibe avisos de lo suyo (aprobaciones pendientes,
// comentarios visibles del equipo y entregables nuevos).
async function clientUserIds(env, clientId, excludeUserId) {
  if (!clientId) return [];
  const res = await env.DB.prepare(
    "SELECT id FROM mkt_users WHERE role = 'client' AND active = 1 AND client_id = ?"
  ).bind(clientId).all();
  return (res.results || []).map((r) => r.id).filter((id) => id && id !== excludeUserId);
}

// Staff users (admin|team, active) who already commented on a post.
async function threadParticipants(env, postId) {
  const res = await env.DB.prepare(
    `SELECT DISTINCT c.user_id AS id
       FROM mkt_comments c
       JOIN mkt_users u ON u.id = c.user_id
      WHERE c.post_id = ? AND u.active = 1 AND u.role IN ('admin','team')`
  ).bind(postId).all();
  return (res.results || []).map((r) => r.id);
}

// ── EVENT HOOKS (called after commit; callers wrap in try/catch) ──

// After approve / request-changes (handleApprovalDecision).
// May move the post forward to 'aprobado' (aprobado_mueve_estado): a DIRECT
// UPDATE that never re-triggers recipes (depth 1).
async function hookApprovalDecision(env, session, post, decision, comment) {
  const autos = await loadAutomations(env);
  const link = '#/post/' + post.id;
  const recipients = await staffFanout(env, post, session.user_id);

  if (decision === 'approved') {
    // El botón "Aprobado" del CLIENTE mueve el estado a 'aprobado' (solo hacia
    // adelante) SIN depender de la receta; el equipo la sigue respetando. La
    // NOTIFICACIÓN queda igual que antes (bajo la receta aprobado_mueve_estado).
    if ((session.role === 'client' || recipeOn(autos, 'aprobado_mueve_estado'))
        && STATUS_ORDER[post.status] != null && STATUS_ORDER[post.status] < STATUS_ORDER['aprobado']) {
      await env.DB.prepare(
        "UPDATE mkt_posts SET status = 'aprobado', updated_at = datetime('now') WHERE id = ?"
      ).bind(post.id).run();
      await logActivity(env, {
        client_id: post.client_id, post_id: post.id, session,
        action: 'automation.run', detail: `aprobado_mueve_estado:${post.status}->aprobado`
      });
    }
    if (!recipeOn(autos, 'aprobado_mueve_estado')) return;
    await notify(env, {
      user_ids: recipients, type: 'aprobacion',
      body: `${session.name} aprobó ${post.title}`,
      link, post_id: post.id, client_id: post.client_id, actor_name: session.name
    });
  } else {
    // El botón "Modificar" del CLIENTE regresa la pieza a 'guion' para reproceso
    // (sin depender de receta). El comentario ya vive en Comentarios + Notas +
    // auditoría por los fixes previos. La notificación sigue bajo aviso_cambios.
    if (session.role === 'client' && post.status !== 'guion') {
      await env.DB.prepare(
        "UPDATE mkt_posts SET status = 'guion', updated_at = datetime('now') WHERE id = ?"
      ).bind(post.id).run();
      await logActivity(env, {
        client_id: post.client_id, post_id: post.id, session,
        action: 'automation.run', detail: `cliente_modifica:${post.status}->guion`
      });
    }
    if (!recipeOn(autos, 'aviso_cambios')) return;
    const extra = comment && comment.trim() ? ': ' + truncateText(comment, 140) : '';
    await notify(env, {
      user_ids: recipients, type: 'cambios_solicitados',
      body: `${session.name} pidió cambios en ${post.title}${extra}`,
      link, post_id: post.id, client_id: post.client_id, actor_name: session.name
    });
  }
}

// After a new comment (handleAddComment). Detects @mentions against active
// staff names; mentioned users get type 'mencion' and are excluded from the
// generic 'comentario' fan-out (one notification per user per event).
async function hookAddComment(env, session, post, commentRow) {
  const autos = await loadAutomations(env);
  const link = '#/post/' + post.id;
  const bodyText = String(commentRow.body || '');
  const lower = bodyText.toLowerCase();

  const staffRes = await env.DB.prepare(
    "SELECT id, name FROM mkt_users WHERE active = 1 AND role IN ('admin','team')"
  ).all();
  const staff = staffRes.results || [];

  // ── Mentions (always on; not a toggleable recipe) ──
  const mentioned = [];
  for (const u of staff) {
    if (!u.name || u.id === session.user_id) continue;
    const full = '@' + String(u.name).toLowerCase();
    const first = '@' + String(u.name).toLowerCase().split(/\s+/)[0];
    if (lower.includes(full) || lower.includes(first)) mentioned.push(u.id);
  }
  if (mentioned.length) {
    await notify(env, {
      user_ids: mentioned, type: 'mencion',
      body: `${session.name} te mencionó en ${post.title}: ${truncateText(bodyText, 140)}`,
      link, post_id: post.id, comment_id: commentRow.id,
      client_id: post.client_id, actor_name: session.name
    });
  }

  // ── Aviso AL CLIENTE (siempre activo, no es receta): el equipo publicó un
  // comentario VISIBLE en un post suyo. Los internos ("Solo equipo") jamás. ──
  if (session.role !== 'client' && !commentRow.internal) {
    const clients = await clientUserIds(env, post.client_id, session.user_id);
    if (clients.length) {
      await notify(env, {
        user_ids: clients, type: 'comentario',
        body: `${session.name} comentó en ${post.title}: ${truncateText(bodyText, 140)}`,
        link, post_id: post.id, comment_id: commentRow.id,
        client_id: post.client_id, actor_name: session.name
      });
    }
  }

  // ── Comment fan-out al EQUIPO (gated by the aviso_comentario recipe) ──
  if (!recipeOn(autos, 'aviso_comentario')) return;
  let recipients;
  if (session.role === 'client') {
    // Client commented → admins + assignee + staff already in the thread.
    recipients = await staffFanout(env, post, session.user_id);
    recipients = recipients.concat(await threadParticipants(env, post.id));
  } else {
    // Staff commented → staff thread participants + assignee (el aviso al
    // cliente ya salió arriba; este fan-out sigue siendo solo del equipo).
    recipients = await threadParticipants(env, post.id);
    if (post.assignee_user_id) recipients.push(post.assignee_user_id);
  }
  const already = new Set(mentioned);
  recipients = [...new Set(recipients)].filter((id) => id && id !== session.user_id && !already.has(id));
  if (!recipients.length) return;
  await notify(env, {
    user_ids: recipients, type: 'comentario',
    body: `${session.name} comentó en ${post.title}: ${truncateText(bodyText, 140)}`,
    link, post_id: post.id, comment_id: commentRow.id,
    client_id: post.client_id, actor_name: session.name
  });
}

// After PATCH /posts/:id (handlePatchPost) and per-row on bulk status moves.
async function hookPatchPost(env, session, before, after, bodyObj) {
  const autos = await loadAutomations(env);
  const link = '#/post/' + after.id;

  // aviso_asignacion: only when assignee_user_id actually CHANGED, never on
  // self-assignment.
  if (Object.prototype.hasOwnProperty.call(bodyObj || {}, 'assignee_user_id')) {
    const next = after.assignee_user_id || null;
    const prev = before.assignee_user_id || null;
    if (next && next !== prev && next !== session.user_id && recipeOn(autos, 'aviso_asignacion')) {
      await notify(env, {
        user_ids: [next], type: 'asignacion',
        body: `${session.name} te asignó ${after.title}`,
        link, post_id: after.id, client_id: after.client_id, actor_name: session.name
      });
    }
  }

  // Aviso AL CLIENTE (siempre activo, no es receta): pedido de aprobación.
  // Un post suyo pendiente de aprobar acaba de hacerse visible en su portal
  // (approval_state es del servidor: los posts nacen 'pending' y el equipo
  // pide la aprobación encendiendo client_visible).
  if (session.role !== 'client'
      && after.client_visible === 1 && before.client_visible !== 1
      && after.approval_state === 'pending') {
    const clients = await clientUserIds(env, after.client_id, session.user_id);
    if (clients.length) {
      await notify(env, {
        user_ids: clients, type: 'aprobacion_pendiente',
        body: `${session.name} te pide aprobar ${after.title || 'un contenido'}`,
        link, post_id: after.id, client_id: after.client_id, actor_name: session.name
      });
    }
  }

  // aviso_revision_cliente: the post just landed on 'revision' and is visible
  // to the client → tell the team it awaits the client's review.
  if (bodyObj && bodyObj.status === 'revision' && before.status !== 'revision'
      && after.client_visible === 1 && recipeOn(autos, 'aviso_revision_cliente')) {
    const recipients = await staffFanout(env, after, session.user_id);
    await notify(env, {
      user_ids: recipients, type: 'revision_pendiente',
      body: `${after.title} pasó a Revisión y espera al cliente`,
      link, post_id: after.id, client_id: after.client_id, actor_name: session.name
    });
  }
}

// ── LAZY SWEEP (PRIMARY time-recipe mechanism) ──
// Throttled to once per 15 minutes via mkt_kv('lazy_sweep_at'); hung off the
// notifications polling endpoints so it runs whenever someone uses the app.
// POST /cron calls it with {force:true}. Always wrapped by callers.
const SWEEP_THROTTLE_MS = 15 * 60 * 1000;

async function lazySweep(env, opts = {}) {
  const force = !!opts.force;

  // Throttle gate (read + write BEFORE doing work, to avoid stampedes).
  const kvRow = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'lazy_sweep_at'").first();
  if (!force && kvRow && kvRow.value) {
    const last = Date.parse(kvRow.value);
    if (Number.isFinite(last) && (Date.now() - last) < SWEEP_THROTTLE_MS) return null;
  }
  await env.DB.prepare(
    "INSERT INTO mkt_kv (key, value) VALUES ('lazy_sweep_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(new Date().toISOString()).run();

  // EL PROGRAMADOR viaja con el sweep: cada vez que alguien usa la app se
  // publican las piezas cuya hora ya llegó (además del cron de garantía).
  // Best-effort: un fallo de Instagram jamás tumba el sweep.
  try { await publicarPendientes(env); } catch { /* queda en publish_error */ }

  const autos = await loadAutomations(env);
  const today = cancunToday();
  const ran = [];

  // Dedupe helper: true only when the run_key insert actually landed.
  async function claimRun(recipe, postId) {
    const res = await env.DB.prepare(
      'INSERT OR IGNORE INTO mkt_automation_runs (run_key, post_id) VALUES (?, ?)'
    ).bind(`${recipe}:${postId}:${today}`, postId).run();
    return !!(res && res.meta && res.meta.changes > 0);
  }

  // (a) recordatorio_publicacion: publish_date is N days away and the post is
  // not 'programado'/'publicado' yet → remind assignee + admins (1/day).
  if (recipeOn(autos, 'recordatorio_publicacion')) {
    const db = autos.recordatorio_publicacion.config.days_before === 2 ? 2 : 1;
    const target = addDaysISO(today, db);
    const res = await env.DB.prepare(
      `SELECT * FROM mkt_posts
        WHERE publish_date = ? AND status NOT IN ('programado','publicado')
          AND client_id IN (SELECT id FROM mkt_clients WHERE COALESCE(reminders_enabled, 1) = 1)
        LIMIT 200`
    ).bind(target).all();
    let fired = 0;
    for (const p of (res.results || [])) {
      if (!(await claimRun('recordatorio_publicacion', p.id))) continue;
      const when = db === 1 ? 'mañana' : 'en 2 días';
      const targets = await staffFanout(env, p, null);
      fired += await notify(env, {
        user_ids: targets, type: 'recordatorio',
        body: `${p.title} se publica ${when} y sigue en ${STATUS_LABELS[p.status] || p.status}`,
        link: '#/post/' + p.id, post_id: p.id, client_id: p.client_id
      }) ? 1 : 0;
    }
    ran.push({ recipe_key: 'recordatorio_publicacion', fired });
  }

  // (b) marcar_atrasado: date passed and still not published → overdue=1
  // (server-managed flag, never a new status) + notify once per day.
  if (recipeOn(autos, 'marcar_atrasado')) {
    const res = await env.DB.prepare(
      `SELECT * FROM mkt_posts
        WHERE publish_date IS NOT NULL AND publish_date < ? AND status != 'publicado'
          AND client_id IN (SELECT id FROM mkt_clients WHERE COALESCE(reminders_enabled, 1) = 1)
        LIMIT 200`
    ).bind(today).all();
    const rows = res.results || [];
    // Flag the newly-late ones (only when the column exists, i.e. post-005).
    const toFlag = rows.filter((p) => p.overdue === 0);
    if (toFlag.length) {
      await env.DB.batch(toFlag.map((p) =>
        env.DB.prepare('UPDATE mkt_posts SET overdue = 1 WHERE id = ?').bind(p.id)
      ));
    }
    let fired = 0;
    for (const p of rows) {
      if (!(await claimRun('marcar_atrasado', p.id))) continue;
      const targets = await staffFanout(env, p, null);
      fired += await notify(env, {
        user_ids: targets, type: 'vencido',
        body: `${p.title} quedó atrasado: la fecha pasó y sigue en ${STATUS_LABELS[p.status] || p.status}`,
        link: '#/post/' + p.id, post_id: p.id, client_id: p.client_id
      }) ? 1 : 0;
    }
    ran.push({ recipe_key: 'marcar_atrasado', fired });
  }

  // (c) alerta_sin_aprobar: the publish date arrived TODAY and the client has
  // not approved → alert admins + assignee (1/day).
  if (recipeOn(autos, 'alerta_sin_aprobar')) {
    const res = await env.DB.prepare(
      `SELECT * FROM mkt_posts
        WHERE publish_date = ? AND approval_state != 'approved'
          AND status != 'publicado' AND client_visible = 1
          AND client_id IN (SELECT id FROM mkt_clients WHERE COALESCE(reminders_enabled, 1) = 1)
        LIMIT 200`
    ).bind(today).all();
    let fired = 0;
    for (const p of (res.results || [])) {
      if (!(await claimRun('alerta_sin_aprobar', p.id))) continue;
      const targets = await staffFanout(env, p, null);
      fired += await notify(env, {
        user_ids: targets, type: 'recordatorio',
        body: `${p.title} se publica hoy y el cliente aún no lo aprueba`,
        link: '#/post/' + p.id, post_id: p.id, client_id: p.client_id
      }) ? 1 : 0;
    }
    ran.push({ recipe_key: 'alerta_sin_aprobar', fired });
  }

  // (e) Auto-publicar: TODO post cuya fecha de publicación ya llegó pasa a
  // PUBLICADO, esté en el estado que esté (idea, guion, revisión…) y en TODOS
  // los calendarios. Regla de Israel (2026-07-03): "si ya es 18 tiene que
  // cambiar a publicado sí o sí" — el equipo no siempre entra a moverlo a
  // mano y el progreso del mes debe avanzar solo.
  // OJO (auditoría 2026-08-16): las piezas del PROGRAMADOR quedan FUERA —
  // esas pasan a 'publicado' SOLO cuando Instagram confirma (si no, esta
  // regla las marcaba publicadas a medianoche y el publicador ya no las veía:
  // fallo 100% silencioso, cazado en la auditoría de las piezas del 16-ago).
  const autoPub = await env.DB.prepare(
    "UPDATE mkt_posts SET status = 'publicado', updated_at = datetime('now') " +
    "WHERE status NOT IN ('publicado', 'programado', 'publicando') AND publish_date IS NOT NULL AND publish_date <= ?"
  ).bind(today).run();
  ran.push({ recipe_key: 'auto_publicar', moved: (autoPub && autoPub.meta && autoPub.meta.changes) || 0 });

  // (c2) Auto-renovar tokens de Instagram que ya envejecen (>25 días): extiende
  // otros 60 días para que las métricas no se caigan ni haya que reconectar.
  let igRefreshed = 0;
  try { igRefreshed = await refreshAgingIgTokens(env); } catch { /* noop */ }
  if (igRefreshed) ran.push({ recipe_key: 'ig_token_refresh', refreshed: igRefreshed });

  // (c3) Salud de las conexiones de Instagram: si una se cayó (el cliente cambió
  // su contraseña o quitó la app), avisa al staff UNA vez para reconectar (1 clic).
  try {
    const down = await checkIgConnections(env);
    if (down.length) {
      const staffRows = await env.DB.prepare("SELECT id FROM mkt_users WHERE active = 1 AND role IN ('admin','team')").all();
      const ids = ((staffRows && staffRows.results) || []).map((u) => u.id);
      let alerted = 0;
      for (const c of down) {
        const ok = await notify(env, {
          user_ids: ids, type: 'recordatorio',
          body: `Reconecta el Instagram de ${c.name}: la conexión se cerró. Entra a Métricas → Conectar Instagram (1 clic).`,
          link: '#/metricas?cliente=' + c.id, client_id: c.id,
        });
        if (ok) alerted += 1;
      }
      ran.push({ recipe_key: 'ig_connection_down', alerted });
    }
  } catch (e) { /* noop: la salud de IG no rompe el barrido */ }

  // (d) Pruning: old notifications (>120d), old runs (>30d), expired sessions.
  const pn = await env.DB.prepare(
    "DELETE FROM mkt_notifications WHERE created_at < datetime('now', '-120 days')"
  ).run();
  const pr = await env.DB.prepare(
    "DELETE FROM mkt_automation_runs WHERE created_at < datetime('now', '-30 days')"
  ).run();
  const ps = await env.DB.prepare(
    "DELETE FROM mkt_sessions WHERE expires_at <= datetime('now')"
  ).run();

  return {
    ran,
    pruned: {
      notifications: (pn && pn.meta && pn.meta.changes) || 0,
      runs: (pr && pr.meta && pr.meta.changes) || 0,
      sessions: (ps && ps.meta && ps.meta.changes) || 0
    },
    swept_at: new Date().toISOString()
  };
}

// Never let the sweep break a polling response.
async function safeSweep(env) {
  try { await lazySweep(env); } catch (e) { console.error('[mkt lazySweep]', e && e.message); }
}

// ============================================================================
// POSTS
// ============================================================================

// Resolve the client scope for a request.
//   - client role: ALWAYS their own client_id. If they pass a different
//     ?client_id → 403. Returns { scopedClientId, error } where error is a
//     Response to short-circuit with.
//   - team/admin: whatever ?client_id they pass (or null = all clients).
function resolveClientScope(session, url) {
  const qp = url.searchParams.get('client_id');
  if (session.role === 'client') {
    if (!session.client_id) return { error: json({ error: 'No client assigned to this account' }, 403) };
    if (qp && qp !== session.client_id) return { error: json({ error: 'Forbidden' }, 403) };
    return { scopedClientId: session.client_id };
  }
  return { scopedClientId: qp || null };
}

async function handleListPosts(request, env, session, url) {
  const scope = resolveClientScope(session, url);
  if (scope.error) return scope.error;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const isClient = session.role === 'client';
  // V2: staff without client_id may pass ?scope=all → every NON-archived
  // client (mode "Todos los clientes" + "Mi trabajo"). Without it, the legacy
  // behavior (no client filter at all) is preserved byte for byte.
  const scopeAll = !isClient && !scope.scopedClientId && url.searchParams.get('scope') === 'all';

  const where = [];
  const vals = [];
  if (scope.scopedClientId) { where.push('client_id = ?'); vals.push(scope.scopedClientId); }
  if (scopeAll) { where.push('client_id IN (SELECT id FROM mkt_clients WHERE archived = 0)'); }
  // Cliente con edicion completa (modo "calendario compartido"): ve TODOS los
  // posts de SU marca (resolveClientScope ya lo limito a su client_id), sin el
  // filtro client_visible. El aislamiento por marca se mantiene intacto.
  if (from) { where.push('publish_date >= ?'); vals.push(from); }
  if (to) { where.push('publish_date <= ?'); vals.push(to); }
  if (status) {
    if (!STATUSES.includes(status)) return json({ error: 'Invalid status filter' }, 400);
    where.push('status = ?'); vals.push(status);
  }

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT * FROM mkt_posts${whereSql} ORDER BY position ASC, created_at ASC`;
  const res = await env.DB.prepare(sql).bind(...vals).all();
  const rows = res.results || [];
  const out = rows.map(shapePost);
  // Campos internos (notas del equipo, grabación, asignado, prioridad…): JAMÁS
  // viajan a un login de cliente. notes_people SÍ: esas notas son para él.
  if (isClient) for (const p of out) redactForClient(p);

  // V2: ?include=checklist → checklist_done / checklist_total per post via ONE
  // GROUP BY (no N+1). Missing table (pre-004) = no counts.
  if (url.searchParams.get('include') === 'checklist' && out.length) {
    try {
      const counts = await env.DB.prepare(
        `SELECT i.post_id AS post_id, COUNT(*) AS total, COALESCE(SUM(i.done), 0) AS done
           FROM mkt_checklist_items i
          WHERE i.post_id IN (SELECT id FROM mkt_posts${whereSql})
          GROUP BY i.post_id`
      ).bind(...vals).all();
      const byPost = {};
      for (const r of (counts.results || [])) byPost[r.post_id] = r;
      for (const p of out) {
        const c = byPost[p.id];
        p.checklist_total = c ? c.total : 0;
        p.checklist_done = c ? c.done : 0;
      }
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
    }
  }
  return json(out);
}

// Shared validation + column building for the v2 post fields that are handled
// APART from POST_EDITABLE_FIELDS (each needs its own sanitizer). Returns
// { error } or { cols: [{ name, value }], assigneeName } — assigneeName is the
// user's name to mirror into the legacy `assignee` text column.
async function buildV2PostColumns(env, bodyObj) {
  const cols = [];
  let assigneeName;
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'tags')) {
    const sane = sanitizeTags(bodyObj.tags);
    if (sane === null) return { error: json({ error: 'tags debe ser una lista de hasta 12 etiquetas de 30 caracteres' }, 400) };
    cols.push({ name: 'tags', value: JSON.stringify(sane) });
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'assignee_user_id')) {
    const r = await resolveAssigneeUser(env, bodyObj.assignee_user_id);
    if (r.error) return { error: r.error };
    cols.push({ name: 'assignee_user_id', value: r.user ? r.user.id : null });
    if (r.user) assigneeName = r.user.name; // compat: mirror name to assignee
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'work_start')) {
    const r = validateWorkStart(bodyObj.work_start);
    if (r.error) return { error: r.error };
    cols.push({ name: 'work_start', value: r.value });
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'effort_points')) {
    const r = validateEffortPoints(bodyObj.effort_points);
    if (r.error) return { error: r.error };
    cols.push({ name: 'effort_points', value: r.value });
  }
  return { cols, assigneeName };
}

async function handleCreatePost(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  // El cliente solo crea en SU marca (ignora cualquier client_id del body).
  if (session.role === 'client') {
    if (!session.client_id) return json({ error: 'No client assigned to this account' }, 403);
    bodyObj.client_id = session.client_id;
  }
  const clientId = bodyObj && bodyObj.client_id;
  if (!clientId) return json({ error: 'client_id required' }, 400);
  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'client_id does not exist' }, 400);

  // Validate enums when supplied.
  if (bodyObj.content_type != null && !CONTENT_TYPES.includes(bodyObj.content_type)) return json({ error: 'Invalid content_type' }, 400);
  if (bodyObj.status != null && !STATUSES.includes(bodyObj.status)) return json({ error: 'Invalid status' }, 400);
  if (bodyObj.grabacion != null && bodyObj.grabacion !== '' && (Number(bodyObj.grabacion) < 1 || Number(bodyObj.grabacion) > 5)) {
    return json({ error: 'grabacion must be 1..5' }, 400);
  }
  if (bodyObj.priority != null && !PRIORITIES.includes(bodyObj.priority)) return json({ error: 'Invalid priority' }, 400);
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'publish_date') && invalidPublishDate(bodyObj.publish_date)) {
    return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
  }

  // MISMO candado que el PATCH: crear era una puerta trasera para escribir
  // campos internos (status='publicado', client_visible=0, notes_team,
  // priority, assignee_user_id…). Auditoría ronda 2, 2026-07-31.
  const intrusoCrear = campoProhibidoPara(session, bodyObj);
  if (intrusoCrear) return json({ error: `Campo no editable: ${intrusoCrear}` }, 403);

  const v2 = await buildV2PostColumns(env, bodyObj);
  if (v2.error) return v2.error;

  const id = randomId();
  // Build the column list from POST_EDITABLE_FIELDS that were supplied.
  const cols = ['id', 'client_id', 'created_by'];
  const placeholders = ['?', '?', '?'];
  const vals = [id, clientId, session.user_id];
  for (const f of editablesPara(session)) {
    if (Object.prototype.hasOwnProperty.call(bodyObj, f)) {
      cols.push(f);
      placeholders.push('?');
      let v = bodyObj[f];
      if (f === 'client_visible') v = v ? 1 : 0;
      if (f === 'grabacion') v = (v === '' || v == null) ? null : Number(v);
      vals.push(v);
    }
  }
  // notes_people is INTERNAL (team/admin only) + a JSON column → handle apart.
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'notes_people')) {
    const sane = sanitizeNotesPeople(bodyObj.notes_people);
    if (sane === null) return json({ error: 'notes_people must be an object of {person: text}' }, 400);
    cols.push('notes_people');
    placeholders.push('?');
    vals.push(JSON.stringify(sane));
  }
  // V2 columns (tags / assignee_user_id / work_start / effort_points).
  for (const c of v2.cols) {
    cols.push(c.name);
    placeholders.push('?');
    vals.push(c.value);
  }
  // Mirror the typed assignee's name into the legacy text column unless the
  // caller explicitly set `assignee` too.
  if (v2.assigneeName && !Object.prototype.hasOwnProperty.call(bodyObj, 'assignee')) {
    cols.push('assignee');
    placeholders.push('?');
    vals.push(v2.assigneeName);
  }
  await env.DB.prepare(
    `INSERT INTO mkt_posts (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`
  ).bind(...vals).run();

  const created = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(id).first();
  await logActivity(env, { client_id: clientId, post_id: id, session, action: 'post.create', detail: created.title });

  // Aviso AL CLIENTE: el post nace visible en su portal y pendiente de aprobar.
  // OJO (ronda 2, 2026-07-31): SOLO si nace CON CONTENIDO. Antes bastaba
  // teclear un título en el calendario para dispararle al cliente un
  // "te pide aprobar X" de una pieza vacía —y para inflar su contador de
  // pendientes— desde los 6 puntos de creación rápida. La pieza sigue
  // visible en su portal (y en el reporte mensual, que filtra por
  // client_visible); lo que se calla es el aviso prematuro. Cuando el guion
  // ya existe, el equipo pide la aprobación desde el editor y ahí sí avisa
  // (hookPatchPost, "Aviso AL CLIENTE (siempre activo)").
  const naceConContenido = !!(created.caption || created.hook || created.body || created.cta || created.video_url);
  try {
    if (session.role !== 'client' && created.client_visible === 1 && created.approval_state === 'pending' && naceConContenido) {
      const clients = await clientUserIds(env, clientId, session.user_id);
      if (clients.length) {
        await notify(env, {
          user_ids: clients, type: 'aprobacion_pendiente',
          body: `${session.name} te pide aprobar ${created.title || 'un contenido'}`,
          link: '#/post/' + id, post_id: id, client_id: clientId, actor_name: session.name
        });
      }
    }
  } catch (e) { if (!isMissingTableError(e)) console.error('[mkt notifyClientCreate]', e && e.message); }

  return json(shapePostFor(session, created), 201);
}

// Checklist items of a post, ordered, with done_by_name resolved.
async function listChecklistItems(env, postId) {
  const res = await env.DB.prepare(
    `SELECT i.id, i.post_id, i.label, i.done, i.position, i.done_by, i.done_at,
            i.created_at, u.name AS done_by_name
       FROM mkt_checklist_items i
       LEFT JOIN mkt_users u ON u.id = i.done_by
      WHERE i.post_id = ?
      ORDER BY i.position ASC, i.created_at ASC`
  ).bind(postId).all();
  return res.results || [];
}

async function handleGetPost(request, env, session, postId) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  // Aislamiento por marca: un cliente solo accede a posts de SU client_id.
  // (Con edicion completa ya NO se exige client_visible: ve todo lo suyo.)
  if (session.role === 'client' && post.client_id !== session.client_id) {
    return json({ error: 'Forbidden' }, 403);
  }

  const commentsRes = await env.DB.prepare(
    'SELECT id, post_id, user_id, author_name, author_role, body, internal, created_at FROM mkt_comments WHERE post_id = ? ORDER BY created_at ASC'
  ).bind(postId).all();
  // Apple 1.2: al bloquear a alguien, su contenido desaparece de MI vista al
  // instante. El bloqueo es unidireccional: no se borra nada de nadie más.
  const bloqueados = await idsBloqueadosPor(env, session.user_id);
  if (bloqueados.size) {
    commentsRes.results = (commentsRes.results || []).filter((c) => !bloqueados.has(c.user_id));
  }

  const approvalsRes = await env.DB.prepare(
    'SELECT a.id, a.post_id, a.actor_name, a.decision, a.comment, a.created_at, u.role AS actor_role '
    + 'FROM mkt_approvals a LEFT JOIN mkt_users u ON u.id = a.user_id '
    + 'WHERE a.post_id = ? ORDER BY a.created_at ASC'
  ).bind(postId).all();

  // Los comentarios INTERNOS ("Solo equipo") jamás viajan a un login de cliente.
  let comments = commentsRes.results || [];
  if (session.role === 'client') comments = comments.filter((c) => !c.internal);

  // "Pedir cambios": la retroalimentación del cliente SIEMPRE se guarda en
  // mkt_approvals y se DUPLICA en mkt_comments para el hilo. Pero si esa copia
  // falta (data vieja anterior al doble-guardado, o un fallo silencioso del
  // INSERT), el comentario del cliente quedaría SOLO en mkt_approvals =
  // invisible en el hilo ("se perdió"). Aquí lo reinyectamos al hilo desde
  // mkt_approvals cuando aún no está (dedupe por texto), para que NUNCA se
  // pierda un comentario de cambios: lo ve el cliente y lo ve el equipo.
  const approvals = approvalsRes.results || [];
  const seenBodies = new Set(comments.map((c) => String(c.body || '').trim()));
  for (const a of approvals) {
    if (a.decision !== 'changes') continue;
    const body = String(a.comment || '').trim();
    if (!body || seenBodies.has(body)) continue;
    seenBodies.add(body);
    comments.push({
      id: 'appr-' + a.id,
      post_id: a.post_id,
      user_id: null,
      author_name: a.actor_name,
      author_role: a.actor_role || 'client',
      body,
      internal: 0,
      created_at: a.created_at,
      from_approval: 1,
    });
  }
  comments.sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || '')));

  // Igual que en el listado: las "Notas del equipo" (notes_team) no viajan al
  // cliente (notes_people sí: esas notas son para que el cliente las vea).
  const shaped = shapePost(post);
  if (session.role === 'client') redactForClient(shaped);

  const payload = {
    post: shaped,
    comments,
    approvals
  };
  // Checklist del post (Pre-004 / tabla ausente → lista vacia).
  try { payload.checklist = await listChecklistItems(env, postId); }
  catch (e) { if (isMissingTableError(e)) payload.checklist = []; else throw e; }
  return json(payload);
}

async function handlePatchPost(request, env, session, postId) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  // Aislamiento: el cliente solo edita posts de SU marca.
  if (session.role === 'client' && post.client_id !== session.client_id) {
    return json({ error: 'Forbidden' }, 403);
  }

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  // V2: optimistic concurrency (opt-in). If the caller sends the updated_at it
  // read, a mismatch answers 409 with the CURRENT post so the UI can merge.
  if (bodyObj && bodyObj.expected_updated_at && bodyObj.expected_updated_at !== post.updated_at) {
    return json({ error: 'Conflicto: el contenido cambio mientras editabas.', post: shapePostFor(session, post) }, 409);
  }

  if (bodyObj.content_type != null && !CONTENT_TYPES.includes(bodyObj.content_type)) return json({ error: 'Invalid content_type' }, 400);
  if (bodyObj.status != null && !STATUSES.includes(bodyObj.status)) return json({ error: 'Invalid status' }, 400);
  if (bodyObj.grabacion != null && bodyObj.grabacion !== '' && (Number(bodyObj.grabacion) < 1 || Number(bodyObj.grabacion) > 5)) {
    return json({ error: 'grabacion must be 1..5' }, 400);
  }
  if (bodyObj.priority != null && !PRIORITIES.includes(bodyObj.priority)) return json({ error: 'Invalid priority' }, 400);
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'publish_date') && invalidPublishDate(bodyObj.publish_date)) {
    return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
  }

  // Rol CLIENTE: rechaza (no ignora en silencio) los campos internos.
  const intruso = campoProhibidoPara(session, bodyObj);
  if (intruso) return json({ error: `Campo no editable: ${intruso}` }, 403);
  const editables = editablesPara(session);

  const v2 = await buildV2PostColumns(env, bodyObj);
  if (v2.error) return v2.error;

  const sets = [];
  const vals = [];
  for (const f of editables) {
    if (Object.prototype.hasOwnProperty.call(bodyObj, f)) {
      let v = bodyObj[f];
      if (f === 'client_visible') v = v ? 1 : 0;
      if (f === 'grabacion') v = (v === '' || v == null) ? null : Number(v);
      sets.push(`${f} = ?`);
      vals.push(v);
    }
  }
  // Allow position to be patched directly too (drag/drop convenience).
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'position')) {
    sets.push('position = ?'); vals.push(Number(bodyObj.position) || 0);
  }
  // notes_people es INTERNO: el gate real es CLIENT_FORBIDDEN_FIELDS de arriba
  // (el comentario viejo decía "already gated above" y era FALSO — auditoría
  // 2026-07-31).
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'notes_people')) {
    const sane = sanitizeNotesPeople(bodyObj.notes_people);
    if (sane === null) return json({ error: 'notes_people must be an object of {person: text}' }, 400);
    sets.push('notes_people = ?'); vals.push(JSON.stringify(sane));
  }
  // V2 columns.
  for (const c of v2.cols) {
    sets.push(`${c.name} = ?`); vals.push(c.value);
  }
  if (v2.assigneeName && !Object.prototype.hasOwnProperty.call(bodyObj, 'assignee')) {
    sets.push('assignee = ?'); vals.push(v2.assigneeName);
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);

  // overdue is SERVER-managed (read-only over HTTP): clear it when this PATCH
  // resolves the lateness (published, or date back in the future / removed).
  // Guard on the column existing (post-005) so legacy DBs never see the column.
  if (post.overdue !== undefined && post.overdue === 1) {
    const newStatus = bodyObj.status != null ? bodyObj.status : post.status;
    const newDate = Object.prototype.hasOwnProperty.call(bodyObj, 'publish_date') ? bodyObj.publish_date : post.publish_date;
    const resolved = newStatus === 'publicado' || newDate == null || newDate === '' || newDate >= cancunToday();
    if (resolved) sets.push('overdue = 0');
  }

  sets.push("updated_at = datetime('now')");
  vals.push(postId);
  await env.DB.prepare(`UPDATE mkt_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  const action = (bodyObj.status != null && bodyObj.status !== post.status) ? 'status.change' : 'post.update';
  await logActivity(env, { client_id: post.client_id, post_id: postId, session, action, detail: action === 'status.change' ? `${post.status}→${bodyObj.status}` : Object.keys(bodyObj).join(',') });

  // V2 event hooks (after commit, depth 1, never break the response).
  try { await hookPatchPost(env, session, post, updated, bodyObj); }
  catch (e) { if (!isMissingTableError(e)) console.error('[mkt hookPatchPost]', e && e.message); }

  return json(shapePostFor(session, updated));
}

async function handleDeletePost(env, session, postId) {
  // El CLIENTE TAMBIEN puede borrar. Decision explicita de Vianey 2026-07-27:
  // "ellos tambien tienen que poder editar y eliminar". Una auditoria propuso
  // cerrarlo con 403 y se REVIRTIO a proposito — no lo vuelvas a cerrar sin
  // preguntarle. Lo que protege del borrado accidental es el dialogo de
  // confirmDeleteRow() (meses.js), donde la salida segura (Cancelar) es la
  // grande; el aislamiento por marca de abajo es lo que SI es innegociable.
  const post = await env.DB.prepare('SELECT id, client_id, title FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  // Aislamiento por marca. Redundante mientras el 403 de arriba exista, pero NO
  // se quita: si algun dia se decide reabrir el borrado al cliente, el
  // aislamiento entre marcas NO puede depender de esa decision de producto
  // (sin esta linea, quitar el 403 dejaria a un cliente borrar piezas de OTRA
  // marca con una peticion cruda).
  if (session.role === 'client' && post.client_id !== session.client_id) {
    return json({ error: 'Forbidden' }, 403);
  }
  await env.DB.prepare('DELETE FROM mkt_posts WHERE id = ?').bind(postId).run();
  await logActivity(env, { client_id: post.client_id, post_id: postId, session, action: 'post.delete', detail: post.title });
  return json({ ok: true });
}

// approve / request-changes: allowed for client (their own visible post) OR team/admin.
async function handleApprovalDecision(request, env, session, postId, decision) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  if (session.role === 'client') {
    if (post.client_id !== session.client_id) return json({ error: 'Forbidden' }, 403);
  }

  let bodyObj = {};
  try { bodyObj = (await request.json()) || {}; } catch { bodyObj = {}; }
  const comment = bodyObj.comment != null ? String(bodyObj.comment) : null;

  // request-changes requires a comment per spec.
  if (decision === 'changes' && (!comment || !comment.trim())) {
    return json({ error: 'A comment is required when requesting changes' }, 400);
  }
  // Filtro de contenido ofensivo (Apple 1.2): este texto se copia a
  // mkt_approvals, a mkt_comments Y a notes_people — filtrar en la ENTRADA.
  if (comment) { const veto = await vetarSiOfensivo(env, session, comment, 'pedir_cambios'); if (veto) return veto; }

  const newState = decision === 'approved' ? 'approved' : 'changes';
  await env.DB.prepare("UPDATE mkt_posts SET approval_state = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newState, postId).run();

  // Audit trail row.
  await env.DB.prepare(
    'INSERT INTO mkt_approvals (id, post_id, user_id, actor_name, decision, comment) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(randomId(), postId, session.user_id, session.name, newState, comment).run();

  // If a comment was provided, also drop it in the thread (non-internal so the
  // client and team both see it).
  if (comment && comment.trim()) {
    try {
      await env.DB.prepare(
        'INSERT INTO mkt_comments (id, post_id, user_id, author_name, author_role, body, internal) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).bind(randomId(), postId, session.user_id, session.name, session.role, comment.trim()).run();
    } catch (e) { console.error('[mkt approval comment]', e && e.message); }
  }

  // Cuando un CLIENTE pide cambios, anexa el texto a la columna "Notas <persona>"
  // de la tabla del equipo, para que Vianey lo vea de un vistazo sin abrir el
  // hilo de Comentarios. La persona = la etiqueta (note_labels) que coincide con
  // el login del cliente (ej. login "Meli" -> nota "Meli"); si no coincide, la
  // primera etiqueta. Se ANEXA (nunca sobrescribe) y no duplica. Best-effort: si
  // algo falla, el comentario igual vive en Comentarios + auditoría.
  if (decision === 'changes' && session.role === 'client' && comment && comment.trim()) {
    try {
      const clientRow = await env.DB.prepare('SELECT note_labels FROM mkt_clients WHERE id = ?').bind(post.client_id).first();
      const labels = parseNoteLabels(clientRow && clientRow.note_labels);
      if (labels.length) {
        const login = (session.name || '').trim().toLowerCase();
        const person = labels.find((l) => l.toLowerCase() === login) || labels[0];
        const notes = parseNotesPeople(post.notes_people);
        const prev = String(notes[person] || '').trim();
        const dateStr = new Date().toISOString().slice(0, 10);
        const line = `✏️ Pidió cambios (${dateStr}): ${comment.trim()}`;
        if (!prev.includes(line)) {
          notes[person] = prev ? `${prev}\n${line}` : line;
          await env.DB.prepare("UPDATE mkt_posts SET notes_people = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(JSON.stringify(notes), postId).run();
        }
      }
    } catch (e) { console.error('[mkt approval note]', e && e.message); }
  }

  await logActivity(env, {
    client_id: post.client_id, post_id: postId, session,
    action: decision === 'approved' ? 'post.approve' : 'post.request_changes',
    detail: comment || null
  });

  // V2 hooks BEFORE the final read so the response reflects the recipe's
  // status move (aprobado_mueve_estado). Never breaks the response.
  try { await hookApprovalDecision(env, session, post, newState, comment); }
  catch (e) { if (!isMissingTableError(e)) console.error('[mkt hookApproval]', e && e.message); }

  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json({ ok: true, approval_state: newState, post: session.role === 'client' ? publicPost(updated) : shapePost(updated) });
}

async function handleAddComment(request, env, session, postId) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  if (session.role === 'client') {
    if (post.client_id !== session.client_id) return json({ error: 'Forbidden' }, 403);
  }

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const body = bodyObj && bodyObj.body;
  if (!body || !String(body).trim()) return json({ error: 'Comment body required' }, 400);
  // Filtro de contenido ofensivo (Apple 1.2) — server-side: un filtro en
  // el navegador no cuenta para App Review.
  { const veto = await vetarSiOfensivo(env, session, body, 'comentario'); if (veto) return veto; }

  // A client can NEVER set internal=1. Only team/admin may.
  const internal = (session.role !== 'client' && bodyObj.internal) ? 1 : 0;

  const id = randomId();
  await env.DB.prepare(
    'INSERT INTO mkt_comments (id, post_id, user_id, author_name, author_role, body, internal) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, postId, session.user_id, session.name, session.role, String(body).trim(), internal).run();

  await logActivity(env, { client_id: post.client_id, post_id: postId, session, action: 'post.comment', detail: internal ? 'internal' : 'public' });

  const created = await env.DB.prepare(
    'SELECT id, post_id, author_name, author_role, body, internal, created_at FROM mkt_comments WHERE id = ?'
  ).bind(id).first();

  // V2 hooks (mentions + comment fan-out). Never break the response.
  try { await hookAddComment(env, session, post, created); }
  catch (e) { if (!isMissingTableError(e)) console.error('[mkt hookComment]', e && e.message); }

  return json(created, 201);
}

// Bulk reorder/move (drag & drop). staff o cliente (este ultimo solo su marca).
async function handleReorder(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const updates = bodyObj && bodyObj.updates;
  if (!Array.isArray(updates) || !updates.length) return json({ error: 'updates[] required' }, 400);

  // Aislamiento del cliente: TODOS los ids deben ser de SU marca, o 403.
  if (session.role === 'client') {
    const ids = updates.map((u) => u && u.id).filter(Boolean);
    if (!ids.length) return json({ error: 'Each update needs an id' }, 400);
    const ph = ids.map(() => '?').join(',');
    const owned = await env.DB.prepare(`SELECT id FROM mkt_posts WHERE id IN (${ph}) AND client_id = ?`).bind(...ids, session.client_id).all();
    if ((owned.results || []).length !== ids.length) return json({ error: 'Forbidden' }, 403);
  }

  const statements = [];
  const esCliente = session.role === 'client';
  for (const u of updates) {
    if (!u || !u.id) return json({ error: 'Each update needs an id' }, 400);
    if (u.status != null && !STATUSES.includes(u.status)) return json({ error: `Invalid status: ${u.status}` }, 400);
    // El cliente SÍ puede arrastrar (reordenar/mover de día), pero no colar un
    // cambio de estado ni una fecha inválida por esta ruta. Ronda 2 2026-07-31.
    if (esCliente && u.status != null) return json({ error: 'Campo no editable: status' }, 403);
    if (Object.prototype.hasOwnProperty.call(u, 'publish_date') && invalidPublishDate(u.publish_date)) {
      return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
    }
    const sets = ['position = ?'];
    const vals = [Number(u.position) || 0];
    if (u.status != null) { sets.push('status = ?'); vals.push(u.status); }
    if (Object.prototype.hasOwnProperty.call(u, 'publish_date')) { sets.push('publish_date = ?'); vals.push(u.publish_date || null); }
    sets.push("updated_at = datetime('now')");
    vals.push(u.id);
    statements.push(env.DB.prepare(`UPDATE mkt_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals));
  }

  // Apply atomically as a batch.
  await env.DB.batch(statements);

  await logActivity(env, { session, action: 'post.reorder', detail: `${updates.length} updated` });
  return json({ ok: true, updated: updates.length });
}

// ── V2: BULK UPDATE / BULK DELETE / DUPLICATE (staff) ──

const BULK_PATCH_FIELDS = [
  'status', 'publish_date', 'shift_days', 'priority', 'grabacion', 'assignee',
  'assignee_user_id', 'platform', 'content_type', 'client_visible', 'tags_add', 'tags_remove'
];

// POST /posts/bulk-update {ids:[1..100], patch:{...}} | {updates:[{id,publish_date}]}
// SELECT IN first: ids must exist and belong to ONE client (improvement over
// reorder's silent no-op). ONE atomic batch; ONE activity row.
async function handleBulkUpdate(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  // ── Form B: {updates:[{id, publish_date}]} (replan a whole week) ──
  let ids;
  let patch = null;
  let perRowDates = null;
  if (Array.isArray(bodyObj && bodyObj.updates)) {
    const updates = bodyObj.updates;
    if (!updates.length || updates.length > 100) return json({ error: 'updates debe tener entre 1 y 100 elementos' }, 400);
    perRowDates = {};
    ids = [];
    for (const u of updates) {
      if (!u || typeof u.id !== 'string' || !u.id) return json({ error: 'Cada update necesita un id' }, 400);
      if (invalidPublishDate(u.publish_date)) return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
      ids.push(u.id);
      perRowDates[u.id] = (u.publish_date === '' || u.publish_date == null) ? null : u.publish_date;
    }
  } else {
    ids = bodyObj && bodyObj.ids;
    patch = (bodyObj && bodyObj.patch) || {};
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) {
      return json({ error: 'ids debe tener entre 1 y 100 elementos' }, 400);
    }
    if (ids.some((id) => typeof id !== 'string' || !id)) return json({ error: 'ids invalidos' }, 400);
    const keys = Object.keys(patch).filter((k) => BULK_PATCH_FIELDS.includes(k));
    if (!keys.length) return json({ error: 'Nada que actualizar' }, 422);
    if (Object.prototype.hasOwnProperty.call(patch, 'publish_date')
        && Object.prototype.hasOwnProperty.call(patch, 'shift_days')) {
      return json({ error: 'publish_date y shift_days son excluyentes' }, 400);
    }
    // Field validations (400 on any invalid enum/value).
    if (patch.status != null && !STATUSES.includes(patch.status)) return json({ error: 'Invalid status' }, 400);
    if (Object.prototype.hasOwnProperty.call(patch, 'publish_date') && invalidPublishDate(patch.publish_date)) {
      return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'shift_days')) {
      const n = Number(patch.shift_days);
      if (!Number.isInteger(n) || n < -365 || n > 365 || n === 0) {
        return json({ error: 'shift_days debe ser un entero entre -365 y 365 (no 0)' }, 400);
      }
    }
    if (patch.priority != null && !PRIORITIES.includes(patch.priority)) return json({ error: 'Invalid priority' }, 400);
    if (Object.prototype.hasOwnProperty.call(patch, 'grabacion') && patch.grabacion != null && patch.grabacion !== ''
        && (Number(patch.grabacion) < 1 || Number(patch.grabacion) > 5)) {
      return json({ error: 'grabacion must be 1..5' }, 400);
    }
    if (patch.platform != null && !PLATFORMS.includes(patch.platform)) return json({ error: 'Invalid platform' }, 400);
    if (patch.content_type != null && !CONTENT_TYPES.includes(patch.content_type)) return json({ error: 'Invalid content_type' }, 400);
    if (Object.prototype.hasOwnProperty.call(patch, 'tags_add') && sanitizeTags(patch.tags_add) === null) {
      return json({ error: 'tags_add invalido' }, 400);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'tags_remove') && sanitizeTags(patch.tags_remove) === null) {
      return json({ error: 'tags_remove invalido' }, 400);
    }
  }

  // ── SELECT IN: existence + single-client check ──
  const uniqIds = [...new Set(ids)];
  const ph = uniqIds.map(() => '?').join(', ');
  const found = await env.DB.prepare(`SELECT * FROM mkt_posts WHERE id IN (${ph})`).bind(...uniqIds).all();
  const rows = found.results || [];
  const foundIds = new Set(rows.map((r) => r.id));
  const missing_ids = uniqIds.filter((id) => !foundIds.has(id));
  if (!rows.length) return json({ error: 'No se encontraron contenidos', missing_ids }, 400);
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  if (clientIds.length > 1) return json({ error: 'Todos los contenidos deben ser del mismo cliente' }, 400);
  const clientId = clientIds[0];

  // Resolve assignee once (form A only).
  let assigneeUser = null;
  let assigneeProvided = false;
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'assignee_user_id')) {
    assigneeProvided = true;
    const r = await resolveAssigneeUser(env, patch.assignee_user_id);
    if (r.error) return r.error;
    assigneeUser = r.user;
  }

  const today = cancunToday();
  const hasOverdueCol = rows[0].overdue !== undefined;
  const statements = [];
  for (const row of rows) {
    const sets = [];
    const vals = [];
    let newStatus = row.status;
    let newDate = row.publish_date;
    let dateTouched = false;

    if (perRowDates) {
      newDate = perRowDates[row.id];
      dateTouched = true;
      sets.push('publish_date = ?'); vals.push(newDate);
    } else {
      if (patch.status != null) { newStatus = patch.status; sets.push('status = ?'); vals.push(patch.status); }
      if (Object.prototype.hasOwnProperty.call(patch, 'publish_date')) {
        newDate = (patch.publish_date === '' || patch.publish_date == null) ? null : patch.publish_date;
        dateTouched = true;
        sets.push('publish_date = ?'); vals.push(newDate);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'shift_days') && row.publish_date) {
        newDate = addDaysISO(row.publish_date, Number(patch.shift_days));
        dateTouched = true;
        sets.push('publish_date = ?'); vals.push(newDate);
      }
      if (patch.priority != null) { sets.push('priority = ?'); vals.push(patch.priority); }
      if (Object.prototype.hasOwnProperty.call(patch, 'grabacion')) {
        sets.push('grabacion = ?');
        vals.push((patch.grabacion === '' || patch.grabacion == null) ? null : Number(patch.grabacion));
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'assignee')) {
        sets.push('assignee = ?'); vals.push(patch.assignee == null ? null : String(patch.assignee));
      }
      if (assigneeProvided) {
        sets.push('assignee_user_id = ?'); vals.push(assigneeUser ? assigneeUser.id : null);
        if (assigneeUser && !Object.prototype.hasOwnProperty.call(patch, 'assignee')) {
          sets.push('assignee = ?'); vals.push(assigneeUser.name);
        }
      }
      if (patch.platform != null) { sets.push('platform = ?'); vals.push(patch.platform); }
      if (patch.content_type != null) { sets.push('content_type = ?'); vals.push(patch.content_type); }
      if (Object.prototype.hasOwnProperty.call(patch, 'client_visible')) {
        sets.push('client_visible = ?'); vals.push(patch.client_visible ? 1 : 0);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'tags_add') || Object.prototype.hasOwnProperty.call(patch, 'tags_remove')) {
        let tags = parseTagsStored(row.tags);
        const add = sanitizeTags(patch.tags_add) || [];
        const removeSet = new Set((sanitizeTags(patch.tags_remove) || []).map((t) => t.toLowerCase()));
        const seen = new Set(tags.map((t) => t.toLowerCase()));
        for (const t of add) {
          if (!seen.has(t.toLowerCase()) && tags.length < 12) { tags.push(t); seen.add(t.toLowerCase()); }
        }
        tags = tags.filter((t) => !removeSet.has(t.toLowerCase()));
        sets.push('tags = ?'); vals.push(JSON.stringify(tags));
      }
    }

    // Server-managed overdue: clear it when this bulk patch resolves it.
    if (hasOverdueCol && row.overdue === 1) {
      const resolved = newStatus === 'publicado'
        || (dateTouched && (newDate == null || newDate >= today));
      if (resolved) sets.push('overdue = 0');
    }

    if (!sets.length) continue;
    sets.push("updated_at = datetime('now')");
    vals.push(row.id);
    statements.push(env.DB.prepare(`UPDATE mkt_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals));
  }
  if (statements.length) await env.DB.batch(statements);

  // Re-read the updated rows (reconciliation payload for the optimistic UI).
  const okIds = rows.map((r) => r.id);
  const ph2 = okIds.map(() => '?').join(', ');
  const after = await env.DB.prepare(`SELECT * FROM mkt_posts WHERE id IN (${ph2})`).bind(...okIds).all();
  const posts = (after.results || []).map(shapePost);

  await logActivity(env, {
    client_id: clientId, session, action: 'post.bulk_update',
    detail: { count: rows.length, fields: perRowDates ? ['publish_date'] : Object.keys(patch).filter((k) => BULK_PATCH_FIELDS.includes(k)) }
  });

  // Event recipes for a bulk status move (depth 1, never break the response).
  if (patch && patch.status === 'revision') {
    try {
      for (const p of posts) {
        const beforeRow = rows.find((r) => r.id === p.id);
        if (beforeRow && beforeRow.status !== 'revision') {
          await hookPatchPost(env, session, beforeRow, p, { status: 'revision' });
        }
      }
    } catch (e) { if (!isMissingTableError(e)) console.error('[mkt bulk hooks]', e && e.message); }
  }

  return json({ ok: true, updated: rows.length, posts, missing_ids });
}

// POST /posts/bulk-delete {ids} → {ok, deleted}. FK cascade cleans comments,
// approvals and checklist items.
async function handleBulkDelete(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const ids = bodyObj && bodyObj.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) {
    return json({ error: 'ids debe tener entre 1 y 100 elementos' }, 400);
  }
  if (ids.some((id) => typeof id !== 'string' || !id)) return json({ error: 'ids invalidos' }, 400);

  const uniqIds = [...new Set(ids)];
  const ph = uniqIds.map(() => '?').join(', ');
  const found = await env.DB.prepare(
    `SELECT id, client_id FROM mkt_posts WHERE id IN (${ph})`
  ).bind(...uniqIds).all();
  const rows = found.results || [];
  if (!rows.length) return json({ ok: true, deleted: 0 });

  const res = await env.DB.prepare(`DELETE FROM mkt_posts WHERE id IN (${ph})`).bind(...uniqIds).run();
  const deleted = (res && res.meta && res.meta.changes) || rows.length;
  await logActivity(env, {
    client_id: rows[0].client_id, session, action: 'post.bulk_delete', detail: { count: deleted }
  });
  return json({ ok: true, deleted });
}

// POST /posts/:id/duplicate {include_checklist?, include_script?} → 201 shapePost.
// Copy lands as: title + ' (copia)', status 'idea', approval 'pending',
// publish_date NULL, position at the end of the client board, checklist with
// done=0. Comments and approvals are NOT copied.
async function handleDuplicatePost(request, env, session, postId) {
  const source = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!source) return json({ error: 'Post not found' }, 404);

  let bodyObj = {};
  try { bodyObj = (await request.json()) || {}; } catch { bodyObj = {}; }
  const includeChecklist = bodyObj.include_checklist !== false; // default true
  const includeScript = bodyObj.include_script !== false;       // default true

  const posRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1000 AS pos FROM mkt_posts WHERE client_id = ?'
  ).bind(source.client_id).first();
  const position = (posRow && posRow.pos) || 1000;

  const newId = randomId();
  const cols = ['id', 'client_id', 'created_by', 'title', 'status', 'approval_state', 'publish_date', 'position'];
  const vals = [newId, source.client_id, session.user_id, `${source.title} (copia)`, 'idea', 'pending', null, position];

  const copyCols = ['content_type', 'grabacion', 'assignee', 'platform', 'caption',
    'inspo_url', 'video_url', 'hashtags', 'alt_text', 'notes_team', 'client_visible', 'notes_people'];
  for (const f of copyCols) {
    if (source[f] !== undefined) {
      let v = source[f];
      // video_url de video SUBIDO apunta al stream del post ORIGINAL
      // (/posts/<idOriginal>/video): copiarlo tal cual deja el video de la
      // copia muerto si se borra el original → mejor NULL (se resube).
      if (f === 'video_url' && typeof v === 'string' && v.includes(`/posts/${postId}/video`)) v = null;
      cols.push(f); vals.push(v);
    }
  }
  const scriptCols = ['hook', 'body', 'cta'];
  for (const f of scriptCols) {
    if (source[f] !== undefined) { cols.push(f); vals.push(includeScript ? source[f] : null); }
  }
  // V2 columns (only when they exist on the row, i.e. post-005).
  for (const f of ['priority', 'tags', 'assignee_user_id', 'work_start', 'effort_points']) {
    if (source[f] !== undefined) { cols.push(f); vals.push(source[f]); }
  }

  await env.DB.prepare(
    `INSERT INTO mkt_posts (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).bind(...vals).run();

  // Copy the checklist (unchecked). Missing table (pre-004) → skip silently.
  if (includeChecklist) {
    try {
      const items = await env.DB.prepare(
        'SELECT label, position FROM mkt_checklist_items WHERE post_id = ? ORDER BY position ASC, created_at ASC'
      ).bind(postId).all();
      const list = items.results || [];
      if (list.length) {
        await env.DB.batch(list.map((it) => env.DB.prepare(
          'INSERT INTO mkt_checklist_items (id, post_id, label, done, position) VALUES (?, ?, ?, 0, ?)'
        ).bind(randomId(), newId, it.label, it.position)));
      }
    } catch (e) { if (!isMissingTableError(e)) throw e; }
  }

  const created = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(newId).first();
  await logActivity(env, {
    client_id: source.client_id, post_id: newId, session,
    action: 'post.duplicate', detail: { source_id: postId }
  });
  return json(shapePost(created), 201);
}

// ============================================================================
// V2 — CHECKLIST (staff only; NESTED under the post for ownership re-check)
// ============================================================================

function shapeChecklistItem(row) {
  return {
    id: row.id,
    post_id: row.post_id,
    label: row.label,
    done: row.done,
    position: row.position,
    done_by: row.done_by || null,
    done_by_name: row.done_by_name || null,
    done_at: row.done_at || null,
    created_at: row.created_at
  };
}

async function getChecklistItem(env, postId, itemId) {
  return env.DB.prepare(
    `SELECT i.*, u.name AS done_by_name
       FROM mkt_checklist_items i
       LEFT JOIN mkt_users u ON u.id = i.done_by
      WHERE i.id = ? AND i.post_id = ?`
  ).bind(itemId, postId).first();
}

// GET /posts/:id/checklist → { items }
async function handleChecklistList(env, session, post) {
  const items = await listChecklistItems(env, post.id);
  return json({ items: items.map(shapeChecklistItem) });
}

// POST /posts/:id/checklist { label 1..200, position? } → 201 { item }
async function handleChecklistAdd(request, env, session, post) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const label = bodyObj && typeof bodyObj.label === 'string' ? bodyObj.label.trim() : '';
  if (!label || label.length > 200) return json({ error: 'label es obligatorio (1 a 200 caracteres)' }, 400);

  let position;
  if (bodyObj.position != null && Number.isFinite(Number(bodyObj.position))) {
    position = Number(bodyObj.position);
  } else {
    const row = await env.DB.prepare(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM mkt_checklist_items WHERE post_id = ?'
    ).bind(post.id).first();
    position = (row && row.pos) || 0;
  }

  const id = randomId();
  await env.DB.prepare(
    'INSERT INTO mkt_checklist_items (id, post_id, label, done, position) VALUES (?, ?, ?, 0, ?)'
  ).bind(id, post.id, label, position).run();

  await logActivity(env, { client_id: post.client_id, post_id: post.id, session, action: 'checklist.add', detail: label });
  const item = await getChecklistItem(env, post.id, id);
  return json({ item: shapeChecklistItem(item) }, 201);
}

// PATCH /posts/:id/checklist/:itemId { label?, done?:0|1, position? } → { item }
async function handleChecklistPatch(request, env, session, post, itemId) {
  const existing = await env.DB.prepare(
    'SELECT * FROM mkt_checklist_items WHERE id = ? AND post_id = ?'
  ).bind(itemId, post.id).first();
  if (!existing) return json({ error: 'Item not found' }, 404);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const sets = [];
  const vals = [];
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'label')) {
    const label = typeof bodyObj.label === 'string' ? bodyObj.label.trim() : '';
    if (!label || label.length > 200) return json({ error: 'label es obligatorio (1 a 200 caracteres)' }, 400);
    sets.push('label = ?'); vals.push(label);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'position')) {
    sets.push('position = ?'); vals.push(Number(bodyObj.position) || 0);
  }
  let toggled = null;
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'done')) {
    const done = bodyObj.done ? 1 : 0;
    toggled = done;
    if (done === 1) {
      sets.push('done = 1');
      sets.push('done_by = ?'); vals.push(session.user_id);
      sets.push("done_at = datetime('now')");
    } else {
      sets.push('done = 0');
      sets.push('done_by = NULL');
      sets.push('done_at = NULL');
    }
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  vals.push(itemId);
  vals.push(post.id);
  await env.DB.prepare(
    `UPDATE mkt_checklist_items SET ${sets.join(', ')} WHERE id = ? AND post_id = ?`
  ).bind(...vals).run();

  if (toggled !== null) {
    await logActivity(env, {
      client_id: post.client_id, post_id: post.id, session,
      action: 'checklist.toggle', detail: `${existing.label}:${toggled ? 'done' : 'pendiente'}`
    });
  }
  const item = await getChecklistItem(env, post.id, itemId);
  return json({ item: shapeChecklistItem(item) });
}

// DELETE /posts/:id/checklist/:itemId → { ok }
async function handleChecklistDelete(env, session, post, itemId) {
  const existing = await env.DB.prepare(
    'SELECT id, label FROM mkt_checklist_items WHERE id = ? AND post_id = ?'
  ).bind(itemId, post.id).first();
  if (!existing) return json({ error: 'Item not found' }, 404);
  await env.DB.prepare('DELETE FROM mkt_checklist_items WHERE id = ? AND post_id = ?').bind(itemId, post.id).run();
  await logActivity(env, { client_id: post.client_id, post_id: post.id, session, action: 'checklist.delete', detail: existing.label });
  return json({ ok: true });
}

// POST /posts/:id/checklist/reorder { updates:[{id, position}] } → { ok }
async function handleChecklistReorder(request, env, session, post) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const updates = bodyObj && bodyObj.updates;
  if (!Array.isArray(updates) || !updates.length || updates.length > 100) {
    return json({ error: 'updates[] required' }, 400);
  }
  const statements = [];
  for (const u of updates) {
    if (!u || typeof u.id !== 'string' || !u.id) return json({ error: 'Each update needs an id' }, 400);
    statements.push(env.DB.prepare(
      'UPDATE mkt_checklist_items SET position = ? WHERE id = ? AND post_id = ?'
    ).bind(Number(u.position) || 0, u.id, post.id));
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}

// POST /posts/:id/checklist/bulk { items:[{label, position?}] } → { ok, items }
// Used by the editor's templates ("plantillas por tipo").
async function handleChecklistBulk(request, env, session, post) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const items = bodyObj && bodyObj.items;
  if (!Array.isArray(items) || !items.length || items.length > 30) {
    return json({ error: 'items debe tener entre 1 y 30 elementos' }, 400);
  }
  const baseRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM mkt_checklist_items WHERE post_id = ?'
  ).bind(post.id).first();
  let base = (baseRow && baseRow.pos) || 0;

  const statements = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const label = typeof it.label === 'string' ? it.label.trim() : '';
    if (!label || label.length > 200) return json({ error: 'Cada item necesita un label de 1 a 200 caracteres' }, 400);
    const position = (it.position != null && Number.isFinite(Number(it.position))) ? Number(it.position) : base + i;
    statements.push(env.DB.prepare(
      'INSERT INTO mkt_checklist_items (id, post_id, label, done, position) VALUES (?, ?, ?, 0, ?)'
    ).bind(randomId(), post.id, label, position));
  }
  await env.DB.batch(statements);
  await logActivity(env, { client_id: post.client_id, post_id: post.id, session, action: 'checklist.bulk', detail: { count: items.length } });
  const all = await listChecklistItems(env, post.id);
  return json({ ok: true, items: all.map(shapeChecklistItem) });
}

// ============================================================================
// V2 — NOTIFICATIONS ROUTES (any role; ALWAYS scoped to session.user_id)
// ============================================================================

const NOTIF_FILTERS = ['all', 'unread', 'mentions', 'assigned'];

// GET /notifications?filter=&limit=&before= → { notifications, unread, next_before }
async function handleListNotifications(request, env, session, url) {
  await safeSweep(env); // PRIMARY time-recipe mechanism (throttled inside)

  const filter = url.searchParams.get('filter') || 'all';
  if (!NOTIF_FILTERS.includes(filter)) return json({ error: 'Filtro invalido' }, 400);
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  const before = url.searchParams.get('before');

  const where = ['user_id = ?'];
  const vals = [session.user_id];
  if (filter === 'unread') where.push('read_at IS NULL');
  if (filter === 'mentions') { where.push('type = ?'); vals.push('mencion'); }
  if (filter === 'assigned') { where.push('type = ?'); vals.push('asignacion'); }
  if (before) { where.push('created_at < ?'); vals.push(before); }

  const res = await env.DB.prepare(
    `SELECT id, type, body, link, post_id, comment_id, client_id, actor_name, read_at, created_at
       FROM mkt_notifications
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(...vals, limit).all();
  const rows = res.results || [];

  const unreadRow = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM mkt_notifications WHERE user_id = ? AND read_at IS NULL'
  ).bind(session.user_id).first();

  return json({
    notifications: rows,
    unread: (unreadRow && unreadRow.n) || 0,
    next_before: rows.length === limit ? rows[rows.length - 1].created_at : null
  });
}

// GET /notifications/unread-count → { unread }  (60s polling endpoint)
async function handleUnreadCount(env, session) {
  await safeSweep(env);
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM mkt_notifications WHERE user_id = ? AND read_at IS NULL'
  ).bind(session.user_id).first();
  return json({ unread: (row && row.n) || 0 });
}

// POST /notifications/read {ids:[]} | {all:true} | {ids, unread:true} → {ok, marked}
async function handleNotificationsRead(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (bodyObj && bodyObj.all === true) {
    const res = await env.DB.prepare(
      "UPDATE mkt_notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL"
    ).bind(session.user_id).run();
    return json({ ok: true, marked: (res && res.meta && res.meta.changes) || 0 });
  }

  const ids = bodyObj && bodyObj.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) return json({ error: 'ids[] required' }, 400);
  if (ids.some((id) => typeof id !== 'string' || !id)) return json({ error: 'ids invalidos' }, 400);
  const ph = ids.map(() => '?').join(', ');

  // {ids, unread:true} marks BACK as unread (Monday-style revert).
  if (bodyObj.unread === true) {
    const res = await env.DB.prepare(
      `UPDATE mkt_notifications SET read_at = NULL WHERE user_id = ? AND id IN (${ph})`
    ).bind(session.user_id, ...ids).run();
    return json({ ok: true, marked: (res && res.meta && res.meta.changes) || 0 });
  }

  const res = await env.DB.prepare(
    `UPDATE mkt_notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL AND id IN (${ph})`
  ).bind(session.user_id, ...ids).run();
  return json({ ok: true, marked: (res && res.meta && res.meta.changes) || 0 });
}

// POST /notifications/delete {ids:[]} → {ok} (owner-only delete)
async function handleNotificationsDelete(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const ids = bodyObj && bodyObj.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) return json({ error: 'ids[] required' }, 400);
  if (ids.some((id) => typeof id !== 'string' || !id)) return json({ error: 'ids invalidos' }, 400);
  const ph = ids.map(() => '?').join(', ');
  await env.DB.prepare(
    `DELETE FROM mkt_notifications WHERE user_id = ? AND id IN (${ph})`
  ).bind(session.user_id, ...ids).run();
  return json({ ok: true });
}

// ============================================================================
// V2 — AUTOMATIONS (staff; 8 fixed recipes, GET + PATCH only, no builder)
// ============================================================================

function shapeAutomation(row) {
  let cfg = {};
  try { cfg = JSON.parse(row.config || '{}') || {}; } catch { cfg = {}; }
  return { recipe_key: row.recipe_key, enabled: row.enabled, config: cfg, updated_at: row.updated_at };
}

// GET /automations → [{recipe_key, enabled, config, updated_at}]
async function handleListAutomations(env) {
  const res = await env.DB.prepare(
    'SELECT recipe_key, enabled, config, updated_at FROM mkt_automations ORDER BY recipe_key ASC'
  ).all();
  const rows = (res.results || []).filter((r) => AUTOMATION_RECIPES[r.recipe_key]);
  return json(rows.map(shapeAutomation));
}

// PATCH /automations/:recipe_key {enabled?, config?} → {automation}
async function handlePatchAutomation(request, env, session, recipeKey) {
  if (!AUTOMATION_RECIPES[recipeKey]) return json({ error: 'Receta no encontrada' }, 404);
  const existing = await env.DB.prepare(
    'SELECT recipe_key, enabled, config, updated_at FROM mkt_automations WHERE recipe_key = ?'
  ).bind(recipeKey).first();
  if (!existing) return json({ error: 'Receta no encontrada' }, 404);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const sets = [];
  const vals = [];
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'enabled')) {
    sets.push('enabled = ?'); vals.push(bodyObj.enabled ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'config')) {
    const cfg = sanitizeAutomationConfig(recipeKey, bodyObj.config);
    if (cfg === null) return json({ error: 'Configuracion invalida' }, 400);
    sets.push('config = ?'); vals.push(JSON.stringify(cfg));
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  sets.push('updated_by = ?'); vals.push(session.user_id);
  sets.push("updated_at = datetime('now')");
  vals.push(recipeKey);
  await env.DB.prepare(
    `UPDATE mkt_automations SET ${sets.join(', ')} WHERE recipe_key = ?`
  ).bind(...vals).run();

  const updated = await env.DB.prepare(
    'SELECT recipe_key, enabled, config, updated_at FROM mkt_automations WHERE recipe_key = ?'
  ).bind(recipeKey).first();
  await logActivity(env, { session, action: 'automation.update', detail: `${recipeKey}:${Object.keys(bodyObj || {}).join(',')}` });
  return json({ automation: shapeAutomation(updated) });
}

// ============================================================================
// V2 — SAVED VIEWS (staff; owner or admin-on-shared for writes)
// ============================================================================

const VIEW_TYPES = ['tabla', 'calendario', 'tablero', 'timeline', 'dashboard'];
const VIEW_CONFIG_MAX_BYTES = 8 * 1024;

function shapeView(row, sessionUserId) {
  let cfg = {};
  try { cfg = JSON.parse(row.config || '{}') || {}; } catch { cfg = {}; }
  return {
    id: row.id,
    user_id: row.user_id,
    client_id: row.client_id,
    name: row.name,
    view_type: row.view_type,
    config: cfg,
    is_shared: row.is_shared,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    mine: row.user_id === sessionUserId
  };
}

// The config is stored opaque (the frontend owns its shape) with a size cap.
function encodeViewConfig(config) {
  if (config === undefined || config === null) return '{}';
  if (typeof config !== 'object' || Array.isArray(config)) return null;
  let s;
  try { s = JSON.stringify(config); } catch { return null; }
  if (s.length > VIEW_CONFIG_MAX_BYTES) return null;
  return s;
}

// GET /views?client_id= → { views } (own + shared for the client + global)
async function handleListViews(env, session, url) {
  const clientId = url.searchParams.get('client_id');
  const where = ['(user_id = ? OR is_shared = 1)'];
  const vals = [session.user_id];
  if (clientId) { where.push('(client_id = ? OR client_id IS NULL)'); vals.push(clientId); }
  const res = await env.DB.prepare(
    `SELECT * FROM mkt_saved_views WHERE ${where.join(' AND ')} ORDER BY position ASC, created_at ASC`
  ).bind(...vals).all();
  return json({ views: (res.results || []).map((r) => shapeView(r, session.user_id)) });
}

// POST /views {name 1..60, view_type, client_id|null, config, is_shared?} → 201 {view}
async function handleCreateView(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const name = bodyObj && typeof bodyObj.name === 'string' ? bodyObj.name.trim() : '';
  if (!name || name.length > 60) return json({ error: 'name es obligatorio (1 a 60 caracteres)' }, 400);
  const viewType = bodyObj.view_type;
  if (!VIEW_TYPES.includes(viewType)) return json({ error: 'view_type invalido' }, 400);
  let clientId = bodyObj.client_id || null;
  if (clientId) {
    const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
    if (!c) return json({ error: 'client_id does not exist' }, 400);
  }
  const config = encodeViewConfig(bodyObj.config);
  if (config === null) return json({ error: 'config invalida (objeto JSON de hasta 8KB)' }, 400);

  const id = randomId();
  // user_id ALWAYS from the session; never trusted from the body.
  await env.DB.prepare(
    `INSERT INTO mkt_saved_views (id, user_id, client_id, name, view_type, config, is_shared, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, session.user_id, clientId, name, viewType, config, bodyObj.is_shared ? 1 : 0, Number(bodyObj.position) || 0).run();

  const row = await env.DB.prepare('SELECT * FROM mkt_saved_views WHERE id = ?').bind(id).first();
  await logActivity(env, { client_id: clientId, session, action: 'view.create', detail: name });
  return json({ view: shapeView(row, session.user_id) }, 201);
}

// PATCH /views/:id {name?, config?, is_shared?, position?} (owner, or admin on shared)
async function handlePatchView(request, env, session, viewId) {
  const existing = await env.DB.prepare('SELECT * FROM mkt_saved_views WHERE id = ?').bind(viewId).first();
  if (!existing) return json({ error: 'Vista no encontrada' }, 404);
  const canEdit = existing.user_id === session.user_id || (session.role === 'admin' && existing.is_shared === 1);
  if (!canEdit) return json({ error: 'Forbidden' }, 403);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const sets = [];
  const vals = [];
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'name')) {
    const name = typeof bodyObj.name === 'string' ? bodyObj.name.trim() : '';
    if (!name || name.length > 60) return json({ error: 'name es obligatorio (1 a 60 caracteres)' }, 400);
    sets.push('name = ?'); vals.push(name);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'config')) {
    const config = encodeViewConfig(bodyObj.config);
    if (config === null) return json({ error: 'config invalida (objeto JSON de hasta 8KB)' }, 400);
    sets.push('config = ?'); vals.push(config);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'is_shared')) {
    sets.push('is_shared = ?'); vals.push(bodyObj.is_shared ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(bodyObj, 'position')) {
    sets.push('position = ?'); vals.push(Number(bodyObj.position) || 0);
  }
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  sets.push("updated_at = datetime('now')");
  vals.push(viewId);
  await env.DB.prepare(`UPDATE mkt_saved_views SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const row = await env.DB.prepare('SELECT * FROM mkt_saved_views WHERE id = ?').bind(viewId).first();
  return json({ view: shapeView(row, session.user_id) });
}

// DELETE /views/:id (owner or admin) → {ok}
async function handleDeleteView(env, session, viewId) {
  const existing = await env.DB.prepare('SELECT * FROM mkt_saved_views WHERE id = ?').bind(viewId).first();
  if (!existing) return json({ error: 'Vista no encontrada' }, 404);
  const canDelete = existing.user_id === session.user_id || session.role === 'admin';
  if (!canDelete) return json({ error: 'Forbidden' }, 403);
  await env.DB.prepare('DELETE FROM mkt_saved_views WHERE id = ?').bind(viewId).run();
  return json({ ok: true });
}

// ============================================================================
// V2 — SEARCH (staff only; clients get 403 in the router)
// ============================================================================

// GET /search?q= → { posts:[postLite + client_name], clients:[...] } LIMIT 20
async function handleSearch(env, session, url) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ posts: [], clients: [] });
  // Escape LIKE wildcards so user input is matched literally.
  const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';

  const postsRes = await env.DB.prepare(
    `SELECT p.id, p.title, p.publish_date, p.status, p.approval_state, p.platform,
            p.content_type, p.client_id, c.name AS client_name
       FROM mkt_posts p
       JOIN mkt_clients c ON c.id = p.client_id
      WHERE c.archived = 0
        AND (p.title LIKE ? ESCAPE '\\' OR p.caption LIKE ? ESCAPE '\\')
      ORDER BY p.updated_at DESC
      LIMIT 20`
  ).bind(like, like).all();

  const clientsRes = await env.DB.prepare(
    `SELECT id, name, instagram_handle, brand_color
       FROM mkt_clients
      WHERE archived = 0
        AND (name LIKE ? ESCAPE '\\' OR instagram_handle LIKE ? ESCAPE '\\')
      ORDER BY name COLLATE NOCASE ASC
      LIMIT 20`
  ).bind(like, like).all();

  return json({ posts: postsRes.results || [], clients: clientsRes.results || [] });
}

// ============================================================================
// V2 — WORKLOAD + CAPACITIES (staff)
// ============================================================================

// GET /workload?from=&to= (cap 12 weeks) → { from, to, posts, undated, capacities }
// The per-week aggregation lives in the FRONTEND (lib/effort.js): one single
// source of the workload math.
async function handleWorkload(env, session, url) {
  const today = cancunToday();
  let from = url.searchParams.get('from') || today;
  let to = url.searchParams.get('to') || addDaysISO(today, 55);
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) return json({ error: 'Fecha invalida, usa AAAA-MM-DD' }, 400);
  if (to < from) { const t = from; from = to; to = t; }
  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  if (spanDays > 84) return json({ error: 'El rango maximo es de 12 semanas' }, 400);

  const postsRes = await env.DB.prepare(
    `SELECT p.*, c.name AS client_name, c.brand_color AS brand_color
       FROM mkt_posts p
       JOIN mkt_clients c ON c.id = p.client_id
      WHERE c.archived = 0 AND p.publish_date >= ? AND p.publish_date <= ?
      ORDER BY p.publish_date ASC, p.position ASC`
  ).bind(from, to).all();

  const undatedRes = await env.DB.prepare(
    `SELECT p.*, c.name AS client_name, c.brand_color AS brand_color
       FROM mkt_posts p
       JOIN mkt_clients c ON c.id = p.client_id
      WHERE c.archived = 0 AND p.publish_date IS NULL
      ORDER BY p.position ASC, p.created_at ASC
      LIMIT 100`
  ).all();

  let capacities = [];
  try {
    const capRes = await env.DB.prepare(
      'SELECT assignee, weekly_points FROM mkt_capacities ORDER BY assignee COLLATE NOCASE ASC'
    ).all();
    capacities = capRes.results || [];
  } catch (e) { if (!isMissingTableError(e)) throw e; }

  const withClient = (r) => {
    const p = shapePost(r);
    p.client_name = r.client_name;
    p.brand_color = r.brand_color;
    return p;
  };
  return json({
    from, to,
    posts: (postsRes.results || []).map(withClient),
    undated: (undatedRes.results || []).map(withClient),
    capacities
  });
}

// GET /capacities → [{assignee, weekly_points}]
async function handleListCapacities(env) {
  const res = await env.DB.prepare(
    'SELECT assignee, weekly_points FROM mkt_capacities ORDER BY assignee COLLATE NOCASE ASC'
  ).all();
  return json(res.results || []);
}

// POST /capacities {assignee<=60, weekly_points 0-100} → upsert (POST, not PUT:
// the CORS preflight does not list PUT) → {assignee, weekly_points}
async function handleUpsertCapacity(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const assignee = bodyObj && typeof bodyObj.assignee === 'string' ? bodyObj.assignee.trim() : '';
  if (!assignee || assignee.length > 60) return json({ error: 'assignee es obligatorio (1 a 60 caracteres)' }, 400);
  const wp = Number(bodyObj.weekly_points);
  if (!Number.isInteger(wp) || wp < 0 || wp > 100) return json({ error: 'weekly_points debe ser un entero de 0 a 100' }, 400);

  await env.DB.prepare(
    `INSERT INTO mkt_capacities (assignee, weekly_points, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(assignee) DO UPDATE SET weekly_points = excluded.weekly_points, updated_at = datetime('now')`
  ).bind(assignee, wp).run();
  return json({ assignee, weekly_points: wp });
}

// ============================================================================
// ACTIVITY — team/admin only  (V2: + ?post_id= for the editor's Activity tab)
// ============================================================================

async function handleActivity(request, env, session, url, isStaff) {
  // CLIENTE: solo SU marca, solo acciones que le conciernen, y jamás la
  // actividad de comentarios internos. La URL no puede ampliar el alcance.
  const esCliente = !isStaff;
  const clientId = esCliente ? session.client_id : url.searchParams.get('client_id');
  if (esCliente && !clientId) return json([]);
  const postId = url.searchParams.get('post_id');
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const where = [];
  const vals = [];
  if (esCliente) {
    where.push("action IN ('post.approve','post.request_changes','post.comment','status.change','post.create','post.update')");
    where.push("NOT (action = 'post.comment' AND detail = 'internal')");
  }
  if (clientId) { where.push('client_id = ?'); vals.push(clientId); }
  if (postId) { where.push('post_id = ?'); vals.push(postId); }
  const sql = `SELECT id, client_id, post_id, user_id, actor_name, action, detail, created_at
                 FROM mkt_activity${where.length ? ' WHERE ' + where.join(' AND ') : ''}
                ORDER BY created_at DESC LIMIT ?`;
  vals.push(limit);
  const res = await env.DB.prepare(sql).bind(...vals).all();
  return json(res.results || []);
}

// ============================================================================
// V2 — CRON (NO session; Authorization: Bearer env.MKT_CRON_SECRET).
// Optional BACKUP of the throttled lazySweep — the app works without it.
// ============================================================================

async function handleCron(request, env) {
  if (!env.MKT_CRON_SECRET) return json({ error: 'Cron no configurado' }, 503);
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.MKT_CRON_SECRET}`) return json({ error: 'No autorizado' }, 401);
  try {
    const result = await lazySweep(env, { force: true });

    // Respaldo diario a R2 (best-effort; el cron funciona sin bucket).
    // Un JSON por día: backups/mkt-YYYY-MM-DD.json (se sobreescribe si el
    // cron corre dos veces el mismo día — idempotente).
    let backup = false;
    if (env.R2_BUCKET) {
      try {
        const dump = { generated_at: new Date().toISOString() };
        for (const t of ['mkt_posts', 'mkt_clients', 'mkt_users', 'mkt_deliverables']) {
          try {
            const res = await env.DB.prepare(`SELECT * FROM ${t}`).all();
            dump[t] = (res.results || []).map((row) => {
              // NUNCA respaldar secretos. El respaldo vive en el MISMO bucket R2
              // que la llave de la bóveda (marketing/_vault/pw.key): si se
              // filtrara el bucket, guardar aquí `password_enc` entregaría
              // llave + cifrado = todas las contraseñas en claro. Los
              // ig_access_token son credenciales vivas de 60 días de CADA marca.
              // Auditoría 2026-07-31.
              if (t === 'mkt_users') {
                const { password, password_enc, password_enc_at, verify_token, reset_token, ...rest } = row;
                return rest;
              }
              if (t === 'mkt_clients') {
                const { ig_access_token, ...rest } = row;
                return { ...rest, ig_access_token: row.ig_access_token ? '[REDACTADO]' : null };
              }
              return row;
            });
          } catch (e) { if (!isMissingTableError(e)) throw e; }
        }
        const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        await env.R2_BUCKET.put(`backups/mkt-${day}.json`, JSON.stringify(dump), {
          httpMetadata: { contentType: 'application/json' }
        });
        backup = true;
      } catch (e) { console.error('[mkt cron backup]', e && e.message); }
    }

    // Medicion del almacenamiento en R2 para la barra del panel de Agencia.
    // Se hace AQUI (una vez al dia, sin nadie esperando) para que abrir Inicio
    // lea siempre cache tibia y nunca pague el recorrido del bucket.
    // Best-effort: si falla, el endpoint /storage lo recalcula bajo demanda.
    const storage = await refreshStorageUsage(env);

    // Aviso a admins si mkt_error_log (migración 017) registró errores en las
    // últimas 24 h. Best-effort: sin la tabla no pasa nada.
    try {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM mkt_error_log WHERE created_at >= datetime('now', '-1 day')"
      ).first();
      const n = row ? Number(row.n) || 0 : 0;
      if (n > 0) {
        const admins = await env.DB.prepare(
          "SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1"
        ).all();
        await notify(env, {
          user_ids: (admins.results || []).map((r) => r.id),
          type: 'system',
          body: `La app registró ${n} ${n === 1 ? 'error' : 'errores'} ayer`,
          link: '#/'
        });
      }
    } catch (e) { if (!isMissingTableError(e)) console.error('[mkt cron errores]', e && e.message); }

    return json({
      ok: true,
      ran: (result && result.ran) || [],
      pruned: (result && result.pruned) || { notifications: 0, runs: 0, sessions: 0 },
      backup,
      storage
    });
  } catch (e) {
    if (isMissingTableError(e)) return json({ error: 'Migracion 004 pendiente' }, 409);
    return json({ error: 'Internal error: ' + (e && e.message ? e.message : 'unknown') }, 500);
  }
}

// ============================================================================
// ROUTER
// ============================================================================

// CORS preflight — same-origin only (the app is served from the same domain),
// so we just acknowledge the preflight without opening cross-origin access.
function corsPreflight(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  // Reflect only same-origin requests; do not enable arbitrary cross-origin use.
  if (origin) {
    try {
      const reqUrl = new URL(request.url);
      if (new URL(origin).host === reqUrl.host) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Vary'] = 'Origin';
      }
    } catch {}
  }
  return new Response(null, { status: 204, headers });
}

// ── RANGE (reproducir y descargar por tramos) ────────────────────────────────
// Los reproductores NO piden el archivo completo: piden tramos. Los 3 formatos
// que hay que soportar sí o sí son:
//   'bytes=100-200'  tramo exacto
//   'bytes=100-'     de ahí hasta el final (adelantar el video)
//   'bytes=-64000'   SUFIJO: los ÚLTIMOS 64 KB — así lee Safari/Chrome el índice
//                    (moov) de un MP4 antes de poder reproducir.
// Antes se le pasaba la cabecera cruda a R2 y se leía obj.range: con el sufijo
// R2 no devuelve 'offset', el código caía al camino de archivo completo y mandaba
// Content-Length del ARCHIVO ENTERO con sólo unos KB de cuerpo -> el navegador se
// quedaba esperando bytes que nunca llegaban (rueda girando / error al adelantar).
// Ahora la cabecera se parsea aquí y se le pasa a R2 un rango explícito.

// Parsea la cabecera Range. Devuelve:
//   null                 -> no hay rango que aplicar (servir el archivo completo)
//   { unsatisfiable }    -> rango imposible (416)
//   { start, end?, r2 }  -> tramo; r2 es el R2Range que entiende el bucket
//   { suffix, r2 }       -> sufijo (últimos N bytes)
function mktParseRange(header) {
  if (!header) return null;
  // Un solo rango de bytes. Multi-rango ('bytes=0-9,20-29') o basura: por RFC 7233
  // se IGNORA la cabecera y se manda el archivo completo (200), nunca un 206 falso.
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(String(header));
  if (!m) return null;
  const startRaw = m[1];
  const endRaw = m[2];
  if (startRaw === '' && endRaw === '') return null;      // 'bytes=-' : sin sentido
  if (startRaw === '') {                                   // sufijo 'bytes=-N'
    const n = Number(endRaw);
    if (!Number.isFinite(n) || n <= 0) return { unsatisfiable: true };
    return { suffix: n, r2: { suffix: n } };
  }
  const start = Number(startRaw);
  if (!Number.isFinite(start)) return null;
  if (endRaw === '') return { start, r2: { offset: start } }; // 'bytes=N-'
  const end = Number(endRaw);
  if (!Number.isFinite(end) || end < start) return { unsatisfiable: true }; // invertido
  return { start, end, r2: { offset: start, length: end - start + 1 } };
}

// Resuelve el rango contra el tamaño REAL del archivo. Devuelve { offset, length }
// o null cuando el rango cae fuera del archivo (-> 416).
function mktResolveRange(spec, size) {
  if (!spec || spec.unsatisfiable) return null;
  if (!Number.isFinite(size) || size <= 0) return null;
  if (spec.suffix != null) {
    const length = Math.min(spec.suffix, size);
    return { offset: size - length, length };
  }
  if (spec.start >= size) return null;                    // arranca después del final
  const endIncl = (spec.end == null) ? (size - 1) : Math.min(spec.end, size - 1);
  return { offset: spec.start, length: endIncl - spec.start + 1 };
}

// Sirve un objeto de R2 con soporte real de Range. `getObj(rangeOpt)` lo provee
// quien llama (cada ruta sabe dónde vive su archivo) y se invoca UNA sola vez en
// el camino normal, para no encarecer los muchos Range del móvil.
async function mktServeRanged(request, getObj, headers) {
  const spec = mktParseRange(request.headers.get('Range'));
  let obj = null;
  let rangeFailed = false;
  if (spec && !spec.unsatisfiable) {
    try { obj = await getObj({ range: spec.r2 }); }
    catch { rangeFailed = true; }                          // R2 rechazó el rango
  }
  if (!spec || spec.unsatisfiable || rangeFailed) obj = await getObj(undefined);
  if (!obj) return null;                                   // 404 lo decide quien llama

  const size = obj.size;
  const resolved = spec ? mktResolveRange(spec, size) : null;
  if (spec && !resolved) {
    // 416: rango imposible. Se avisa el tamaño real para que el cliente reintente.
    try { if (obj.body) await obj.body.cancel(); } catch { /* noop */ }
    const h = new Headers(headers);
    h.set('Content-Range', `bytes */${size}`);
    h.delete('Content-Length');
    // NUNCA cachear un 416: si el video se REEMPLAZA por uno mas corto, el
    // navegador que traia la duracion vieja pide un rango que ya no existe y el
    // 416 se quedaria pegado en cache — el video no abriria ni recargando.
    h.set('Cache-Control', 'no-store');
    return new Response(null, { status: 416, headers: h });
  }
  if (resolved && rangeFailed) {
    // El rango SÍ es válido pero R2 no lo aceptó en esa forma: se reintenta con
    // la forma explícita offset+length (la que siempre entiende). Si tampoco,
    // se manda el archivo COMPLETO (200) — nunca un 206 que mienta en el tamaño.
    try { if (obj.body) await obj.body.cancel(); } catch { /* noop */ }
    let retry = null;
    try { retry = await getObj({ range: { offset: resolved.offset, length: resolved.length } }); } catch { retry = null; }
    if (retry) { obj = retry; }
    else {
      const full = await getObj(undefined);
      if (!full) return null;
      headers.set('Content-Length', String(full.size));
      return new Response(full.body, { status: 200, headers });
    }
  }
  if (resolved) {
    // Cinturon: si R2 devolvio un tramo DISTINTO al pedido, no se manda un 206
    // que mienta en el tamano (ese era justo el bug original) — se sirve completo.
    const got = (obj.range && Number.isFinite(Number(obj.range.length))) ? Number(obj.range.length) : null;
    if (got != null && got !== resolved.length) {
      try { if (obj.body) await obj.body.cancel(); } catch { /* noop */ }
      const full = await getObj(undefined);
      if (!full) return null;
      headers.delete('Content-Range');
      headers.set('Content-Length', String(full.size));
      return new Response(full.body, { status: 200, headers });
    }
    headers.set('Content-Range', `bytes ${resolved.offset}-${resolved.offset + resolved.length - 1}/${size}`);
    headers.set('Content-Length', String(resolved.length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(size));
  return new Response(obj.body, { status: 200, headers });
}

// ── VIDEO FINAL (subida directa a R2; 1 video por post) ──────────────────────
// Acceso: staff o el cliente dueño de la marca del post. Se guarda en R2 como
// marketing/video/<postId>.<ext>; video_url guarda la URL absoluta de servido,
// asi el resto de la UI lo trata como un enlace normal. Reusa el binding R2 del
// proyecto (env.R2_BUCKET, el mismo de la galeria).
const MKT_VIDEO_MIMES = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg', 'video/3gpp': '3gp',
};
const MKT_VIDEO_EXTS = [...new Set(Object.values(MKT_VIDEO_MIMES))];
// Mensaje ÚNICO de formato: el navegador avisa lo mismo ANTES de subir, así nadie
// espera una subida entera para enterarse de que el archivo no servía.
const MKT_FORMAT_MSG = 'Formato no soportado. Usa MP4 (H.264), MOV, WebM, M4V, MPEG o 3GP. Los .mkv/.avi/.wmv/.flv no los reproduce ningún navegador: expórtalo en MP4.';
// Tope de la subida en UN solo request (multipart/form-data). Los videos grandes
// NO pasan por aquí: van por partes (multipart de R2), sin tope práctico.
const MKT_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // ~100 MB (limite practico del Worker)
// Tope por PARTE en la subida por partes. El navegador manda ~15MB; se deja holgura
// para las subidas ya en curso con el troceado viejo de 50MB, pero nunca más de esto
// (cada parte se lee entera a memoria del Worker).
const MKT_MAX_PART_BYTES = 64 * 1024 * 1024;
// Tope de cordura de PARTES por subida (15MB x 400 ≈ 6 GB). Evita que una cuenta
// de cliente pueda empujar cientos de GB por la ruta del "Video final".
const MKT_MAX_PARTS = 400;

async function mktPostForVideo(env, session, postId) {
  const post = await env.DB.prepare('SELECT id, client_id FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return { error: json({ error: 'Post not found' }, 404) };
  if (session.role === 'client' && post.client_id !== session.client_id) {
    return { error: json({ error: 'Forbidden' }, 403) };
  }
  return { post };
}

async function handleUploadVideo(request, env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento de video no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;

  const ct = request.headers.get('Content-Type') || '';
  let file = null;
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    file = form.get('video') || form.get('file');
  }
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return json({ error: 'Adjunta el archivo en el campo "video".' }, 400);
  }
  const mime = String(file.type || '').toLowerCase();
  const ext = MKT_VIDEO_MIMES[mime];
  if (!ext) return json({ error: MKT_FORMAT_MSG }, 415);
  if (file.size && file.size > MKT_MAX_VIDEO_BYTES) {
    return json({ error: 'El video supera 100 MB. Comprímelo o pega un enlace.' }, 413);
  }

  // Limpia versiones previas con otra extensión (cambio de formato) y guarda.
  for (const e of MKT_VIDEO_EXTS) {
    if (e !== ext) { try { await env.R2_BUCKET.delete(`marketing/video/${postId}.${e}`); } catch {} }
  }
  await env.R2_BUCKET.put(`marketing/video/${postId}.${ext}`, file.stream(), {
    httpMetadata: { contentType: mime, cacheControl: 'private, max-age=3600' },
  });

  const origin = new URL(request.url).origin;
  const videoUrl = `${origin}/api/marketing/posts/${postId}/video`;
  await env.DB.prepare("UPDATE mkt_posts SET video_url = ?, updated_at = datetime('now') WHERE id = ?").bind(videoUrl, postId).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json(shapePost(updated), 200);
}

async function handleServeVideo(request, env, session, postId) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  const { post, error } = await mktPostForVideo(env, session, postId);
  if (error) return new Response('Forbidden', { status: 403 });
  // MISMA puerta que Entregables: este endpoint sirve el video del calendario
  // ("Video final"). Sin este candado el interruptor se esquivaba entrando por
  // el calendario en vez de por Entregables.
  if (new URL(request.url).searchParams.get('download')
      && !(await descargaPermitida(env, session, (post && post.client_id) || session.client_id))) {
    return new Response('Las descargas están desactivadas para esta marca.', { status: 403 });
  }

  // La extensión no se guarda en mkt_posts, así que se prueban en orden; se
  // recuerda la que existe para no repetir la búsqueda si hay que reintentar.
  let foundExt = null;
  const getObj = async (rangeOpt) => {
    if (foundExt) return env.R2_BUCKET.get(`marketing/video/${postId}.${foundExt}`, rangeOpt);
    for (const e of MKT_VIDEO_EXTS) {
      const o = await env.R2_BUCKET.get(`marketing/video/${postId}.${e}`, rangeOpt);
      if (o) { foundExt = e; return o; }
    }
    return null;
  };

  const headers = new Headers();
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Disposition', 'inline');
  // El helper añade Content-Type/ETag del objeto y resuelve el Range (206/416/200).
  const res = await mktServeRangedWithMeta(request, getObj, headers);
  if (!res) return new Response('Sin video', { status: 404 });
  return res;
}

// Un .mov de CapCut/iPhone trae H.264+AAC adentro — exactamente lo mismo que un
// .mp4 — pero se guarda como 'video/quicktime', y con ESE tipo Chrome ni lo
// intenta: `canPlayType('video/quicktime')` devuelve "" (= NO). Medido en
// producción con un reel real de 4K: el <video> se quedaba colgado sin dar
// error, y el mismo archivo anunciado como video/mp4 reproduce sin tocarlo.
// Se re-etiqueta SOLO al servir; el archivo en R2 y la descarga no cambian
// (la descarga manda Content-Disposition, ahí el tipo da igual).
const MKT_PLAYABLE_CT = { 'video/quicktime': 'video/mp4', 'video/x-m4v': 'video/mp4' };

// Igual que mktServeRanged pero copiando primero los metadatos HTTP del objeto
// (Content-Type, ETag) SIN dejar que pisen las cabeceras ya puestas por la ruta.
async function mktServeRangedWithMeta(request, getObj, headers) {
  const wrapped = async (rangeOpt) => {
    const o = await getObj(rangeOpt);
    if (o) {
      const meta = new Headers();
      o.writeHttpMetadata(meta);
      const ctype = meta.get('Content-Type');
      if (ctype && !headers.has('Content-Type')) {
        headers.set('Content-Type', MKT_PLAYABLE_CT[ctype.toLowerCase()] || ctype);
      }
      if (o.httpEtag && !headers.has('ETag')) headers.set('ETag', o.httpEtag); // revalidación 304
    }
    return o;
  };
  return mktServeRanged(request, wrapped, headers);
}

async function handleDeleteVideo(env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  // Los BYTES del video final son lo unico verdaderamente irrecuperable de una
  // pieza (R2 no tiene papelera). Misma regla que handleDeletePost: borrar es
  // del equipo. El cliente sigue pudiendo SUBIR y REEMPLAZAR su video, y el
  // front le deja quitar el enlace (video_url = NULL) sin destruir el archivo.
  if (session.role === 'client') {
    return json({ error: 'Solo el equipo de IVAE puede eliminar contenido.' }, 403);
  }
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  for (const e of MKT_VIDEO_EXTS) { try { await env.R2_BUCKET.delete(`marketing/video/${postId}.${e}`); } catch {} }
  await env.DB.prepare("UPDATE mkt_posts SET video_url = NULL, updated_at = datetime('now') WHERE id = ?").bind(postId).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json(shapePost(updated), 200);
}

// ── ENTREGABLES (contenido final para el cliente) ────────────────────────────
// Tabla mkt_deliverables. Reel: video en R2 marketing/deliverable/<id>.<ext>
// (calidad original, mismo patron que el video de post). Carrusel: link externo.
// Staff sube/gestiona; el cliente DUENO de la marca ve y descarga (solo lectura).
const MKT_DLV_TYPES = new Set(['reel', 'carrusel']);

// Sello ANTI-CACHÉ derivado de updated_at. El video y el póster se sirven con
// Cache-Control de 1 hora / 1 día, así que al CAMBIAR el video (mismo id, mismos
// comentarios) el navegador seguiría mostrando el viejo. Cada vez que se toca el
// ARCHIVO (multipart/complete escribe `updated_at = MKT_NOW_MS`) el sello cambia,
// la URL cambia y el navegador está OBLIGADO a pedir el archivo nuevo.
// OJO: el service worker de la app NO intercepta /api/ (marketing/sw.js), así
// que aquí el `?v=` solo afecta a la caché HTTP del navegador.
// En mkt_deliverables `updated_at` significa EXACTAMENTE "la última vez que
// cambió el archivo": renombrar el reel (PATCH) NO lo toca a propósito, si no
// un simple cambio de título obligaría al cliente a re-descargar el video entero.
function dlvCacheStamp(d) {
  return String(d.updated_at || d.created_at || '').replace(/\D+/g, '') || '0';
}

// datetime('now') tiene granularidad de 1 SEGUNDO: dos reemplazos dentro del
// mismo segundo daban el MISMO sello y el navegador seguía con el video viejo
// hasta 1 hora. Con milésimas eso no puede pasar (dlvCacheStamp quita el punto).
const MKT_NOW_MS = "strftime('%Y-%m-%d %H:%M:%f','now')";

// ¿Qué archivo de video EXISTE de verdad en R2 para este entregable? Se usa
// después de purgar una subida incompleta: si el reemplazo venía con otra
// extensión, el video ANTERIOR sigue ahí y la fila NO debe quedar en NULL.
async function dlvSurvivingExt(env, id) {
  for (const e of MKT_VIDEO_EXTS) {
    try { const h = await env.R2_BUCKET.head(`marketing/deliverable/${id}.${e}`); if (h) return e; } catch { /* noop */ }
  }
  return null;
}

// Firma del enlace PÚBLICO de un video (para el PDF de entregables: la
// clienta toca el botón y se abre SOLO ese video, sin login). HMAC del id
// con MKT_CRON_SECRET (o pimienta fija si no está configurado): view-only,
// material de marketing de baja sensibilidad.
async function firmaEntregable(env, id) {
  const clave = env.MKT_CRON_SECRET || 'ivae-entregables-publico-2026';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(id))));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

function shapeDeliverable(d, origin, comments = [], piece = null, firma = null) {
  const v = dlvCacheStamp(d);
  return {
    id: d.id, client_id: d.client_id, month: d.month, type: d.type,
    title: d.title || null, link: d.link || null,
    // Vínculo con la pieza del calendario: así el entregable SABE que es el
    // "REEL 3" y se puede cotejar de un vistazo con lo aprobado.
    post_id: d.post_id || null,
    piece: piece || null,   // { num, type, title, date }
    video_url: d.video_ext ? `${origin}/api/marketing/deliverables/${d.id}/video?v=${v}` : null,
    // Solo si REALMENTE hay miniatura: anunciarla siempre hacía que el
    // navegador pidiera una imagen inexistente en la mitad de los videos (404
    // por cada uno). Sin poster el navegador pinta el primer fotograma.
    // El poster también viste a los CARRUSELES: ahí es LA TIRA completa que
    // el cliente ve dividida en slides (pedido de Vianey 2026-08-07).
    poster_url: (d.poster_ok && (d.video_ext || d.type === 'carrusel')) ? `${origin}/api/marketing/deliverables/${d.id}/poster?v=${v}` : null,
    // Enlace público firmado (solo staff lo recibe; viaja dentro del PDF).
    public_video_url: (firma && d.video_ext) ? `${origin}/api/marketing/publico/entregable/${d.id}/video?f=${firma}` : null,
    created_at: d.created_at, updated_at: d.updated_at || null,
    comments,
  };
}

// Numera las piezas del calendario igual que la vista Calendario
// (meses.js/computePieceNums): por marca + mes + tipo, ordenado por fecha,
// posición, creación e id. Si estos criterios se desincronizan, el número
// del entregable dejaría de coincidir con el que ve Vianey en el calendario.
function pieceNumbersFor(posts) {
  const groups = new Map();
  for (const p of posts) {
    if (!p || !p.content_type) continue;
    const month = String(p.publish_date || '').slice(0, 7) || 'sin';
    const k = `${p.client_id || ''}|${month}|${p.content_type}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const nums = new Map();
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const da = String(a.publish_date || '9999-99-99');
      const db = String(b.publish_date || '9999-99-99');
      if (da !== db) return da < db ? -1 : 1;
      const pa = Number(a.position) || 0;
      const pb = Number(b.position) || 0;
      if (pa !== pb) return pa - pb;
      const ca = String(a.created_at || '');
      const cb = String(b.created_at || '');
      if (ca !== cb) return ca < cb ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
    list.forEach((p, i) => nums.set(String(p.id), i + 1));
  }
  return nums;
}

function shapeDlvComment(c) {
  return { id: c.id, author_name: c.author_name || 'Anónimo', author_role: c.author_role || 'team', body: c.body, created_at: c.created_at };
}

async function dlvForAccess(env, session, id) {
  const d = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();
  if (!d) return { error: json({ error: 'Entregable no encontrado' }, 404) };
  if (session.role === 'client' && d.client_id !== session.client_id) {
    return { error: json({ error: 'Forbidden' }, 403) };
  }
  return { d };
}

// ¿Esta marca deja que su cliente DESCARGUE los entregables? Vianey lo decide
// por marca. Solo aplica al rol 'client': el equipo siempre puede bajar su
// propio material.
async function descargaPermitida(env, session, clientId) {
  if (session.role !== 'client') return true;
  if (!clientId) return true;
  let c;
  try {
    c = await env.DB.prepare('SELECT downloads_enabled FROM mkt_clients WHERE id = ?').bind(clientId).first();
  } catch (e) {
    // La columna puede no existir en un entorno que aún no corrió la migración
    // 022. El comentario prometía tolerarlo pero un "no such column" reventaba
    // en 500. Ante la duda se PERMITE: nadie pierde acceso por una migración.
    if (isMissingColumnError(e)) return true;
    throw e;
  }
  return !c || c.downloads_enabled == null || !!c.downloads_enabled;
}

function isMissingColumnError(e) {
  return /no such column/i.test((e && e.message) || '');
}

async function handleListDeliverables(env, session, url) {
  let clientId = url.searchParams.get('client_id');
  if (session.role === 'client') clientId = session.client_id; // forzado a su marca
  if (!clientId) return json({ deliverables: [] });
  const month = url.searchParams.get('month');
  const origin = url.origin;
  const stmt = month
    ? env.DB.prepare('SELECT * FROM mkt_deliverables WHERE client_id = ? AND month = ? ORDER BY sort_order, created_at').bind(clientId, month)
    : env.DB.prepare('SELECT * FROM mkt_deliverables WHERE client_id = ? ORDER BY month DESC, sort_order, created_at').bind(clientId);
  const rows = (await stmt.all()).results || [];
  // Adjuntar comentarios (1 sola query, agrupados por entregable). Best-effort:
  // si la tabla aún no existe (migración no aplicada), la lista sigue funcionando.
  const byDlv = new Map();
  if (rows.length) {
    try {
      // Subconsulta en vez de un placeholder por entregable: D1 topa en 100
      // parámetros, así que al pasar ~100 entregables la query tronaba, el catch
      // se la tragaba y la app respondía 200 con CERO comentarios para todos —
      // el cliente veía "desaparecidas" sus peticiones (ronda 2, 2026-07-31).
      const cres = await env.DB.prepare(
        `SELECT c.id, c.deliverable_id, c.user_id, c.author_name, c.author_role, c.body, c.created_at
           FROM mkt_deliverable_comments c
          WHERE c.deliverable_id IN (SELECT id FROM mkt_deliverables WHERE client_id = ?${month ? ' AND month = ?' : ''})
          ORDER BY c.created_at ASC`
      ).bind(...(month ? [clientId, month] : [clientId])).all();
      const bloqueadosDlv = await idsBloqueadosPor(env, session.user_id);
      for (const c of (cres.results || [])) {
        if (bloqueadosDlv.has(c.user_id)) continue;   // Apple 1.2: bloqueo
        if (!byDlv.has(c.deliverable_id)) byDlv.set(c.deliverable_id, []);
        byDlv.get(c.deliverable_id).push(shapeDlvComment(c));
      }
    } catch (e) { if (!isMissingTableError(e)) console.error('[mkt dlv comments]', e && e.message); }
  }
  // Pieza del calendario vinculada: se numera con el MISMO criterio que la
  // vista Calendario para que el entregable diga "REEL 3" igualito.
  const pieceById = new Map();
  const linked = rows.map((r) => r.post_id).filter(Boolean);
  if (linked.length) {
    try {
      const ph = linked.map(() => '?').join(',');
      const targets = (await env.DB.prepare(
        `SELECT id, client_id, content_type, publish_date, position, created_at, title FROM mkt_posts WHERE id IN (${ph})`
      ).bind(...linked).all()).results || [];
      const months = [...new Set(targets.map((t) => String(t.publish_date || '').slice(0, 7)).filter(Boolean))];
      if (months.length) {
        const mph = months.map(() => '?').join(',');
        const pool = (await env.DB.prepare(
          `SELECT id, client_id, content_type, publish_date, position, created_at FROM mkt_posts WHERE client_id = ? AND substr(publish_date, 1, 7) IN (${mph})`
        ).bind(clientId, ...months).all()).results || [];
        const nums = pieceNumbersFor(pool);
        for (const t of targets) {
          pieceById.set(t.id, {
            num: nums.get(String(t.id)) || null,
            type: t.content_type || null,
            title: t.title || null,
            date: t.publish_date || null,
          });
        }
      }
    } catch (e) { console.error('[mkt dlv piece]', e && e.message); }
  }
  const esStaff = session.role !== 'client';
  const conFirma = await Promise.all(rows.map(async (r) => shapeDeliverable(
    r, origin, byDlv.get(r.id) || [], r.post_id ? pieceById.get(r.post_id) : null,
    esStaff && r.video_ext ? await firmaEntregable(env, r.id) : null
  )));
  return json({ deliverables: conFirma });
}

async function handleListDeliverableComments(env, session, id) {
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  const res = await env.DB.prepare(
    'SELECT id, deliverable_id, author_name, author_role, body, created_at FROM mkt_deliverable_comments WHERE deliverable_id = ? ORDER BY created_at ASC'
  ).bind(id).all();
  return json({ comments: (res.results || []).map(shapeDlvComment) });
}

// Crear comentario. Lo puede hacer el EQUIPO o el CLIENTE dueño de la marca
// (a diferencia de subir/editar, que es solo staff): así el cliente pide cambios.
async function handleAddDeliverableComment(request, env, session, id) {
  const { d, error } = await dlvForAccess(env, session, id);
  if (error) return error;
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const body = (b && typeof b.body === 'string') ? b.body.trim() : '';
  if (!body) return json({ error: 'Escribe un comentario.' }, 400);
  if (body.length > 4000) return json({ error: 'El comentario es muy largo.' }, 400);
  // Filtro de contenido ofensivo (Apple 1.2) — server-side.
  { const veto = await vetarSiOfensivo(env, session, body, 'comentario_entregable'); if (veto) return veto; }
  const cid = randomId();
  await env.DB.prepare(
    'INSERT INTO mkt_deliverable_comments (id, deliverable_id, user_id, author_name, author_role, body) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(cid, id, session.user_id || null, session.name || null, session.role || null, body).run();
  try { await logActivity(env, { client_id: d.client_id, session, action: 'deliverable.comment' }); } catch { /* best-effort */ }

  // Si comenta el CLIENTE → avisar al equipo (admins activos, mismo fan-out
  // que en posts vía staffFanout; los entregables no tienen asignado).
  try {
    if (session.role === 'client') {
      const recipients = await staffFanout(env, null, session.user_id);
      if (recipients.length) {
        await notify(env, {
          user_ids: recipients, type: 'comentario',
          body: `${session.name || 'El cliente'} comentó el entregable ${d.title || d.month}: ${truncateText(body, 140)}`,
          link: '#/entregables', comment_id: cid,
          client_id: d.client_id, actor_name: session.name
        });
      }
    }
  } catch (e) { if (!isMissingTableError(e)) console.error('[mkt notifyDlvComment]', e && e.message); }

  // Al revés: si responde el EQUIPO, avisar SIEMPRE al cliente. Antes solo se
  // avisaba cuando venía la bandera `notify_client`, que únicamente manda el
  // flujo "Cambiar video": el cliente pedía "quítenle la música", el equipo
  // contestaba y él NO se enteraba de nada — se topaba con la respuesta solo si
  // volvía a abrir Entregables por su cuenta (ronda 2, 2026-07-31). Mismo
  // criterio que los comentarios de posts ("Aviso AL CLIENTE (siempre activo)").
  try {
    if (session.role !== 'client') {
      const clients = await clientUserIds(env, d.client_id, session.user_id);
      if (clients.length) {
        await notify(env, {
          user_ids: clients, type: 'entregable',
          body: `${session.name || 'El equipo'} actualizó ${d.title || 'un entregable'}: ${truncateText(body, 140)}`,
          link: '#/entregables', comment_id: cid,
          client_id: d.client_id, actor_name: session.name
        });
      }
    }
  } catch (e) { if (!isMissingTableError(e)) console.error('[mkt notifyDlvSwap]', e && e.message); }

  const c = await env.DB.prepare(
    'SELECT id, deliverable_id, author_name, author_role, body, created_at FROM mkt_deliverable_comments WHERE id = ?'
  ).bind(cid).first();
  return json(shapeDlvComment(c), 201);
}

// Borrar comentario: el EQUIPO (cualquier) o el AUTOR del comentario.
async function handleDeleteDeliverableComment(request, env, session, id, commentId) {
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  const c = await env.DB.prepare('SELECT * FROM mkt_deliverable_comments WHERE id = ? AND deliverable_id = ?').bind(commentId, id).first();
  if (!c) return json({ error: 'Comentario no encontrado' }, 404);
  const isStaff = session.role !== 'client';
  const isAuthor = c.user_id && c.user_id === session.user_id;
  if (!isStaff && !isAuthor) return json({ error: 'Forbidden' }, 403);
  await env.DB.prepare('DELETE FROM mkt_deliverable_comments WHERE id = ?').bind(commentId).run();
  return json({ ok: true });
}

async function handleCreateDeliverable(request, env, session, url) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const clientId = b.client_id;
  const month = String(b.month || '').slice(0, 7);
  const type = b.type;
  if (!clientId || !/^\d{4}-\d{2}$/.test(month) || !MKT_DLV_TYPES.has(type)) {
    return json({ error: 'Faltan datos: client_id, month (YYYY-MM) y type (reel|carrusel).' }, 400);
  }
  const id = randomId();
  const title = b.title ? String(b.title).slice(0, 200) : null;
  const link = (type === 'carrusel' && b.link) ? String(b.link).slice(0, 1000) : null;
  const postId = b.post_id ? String(b.post_id).slice(0, 64) : null;
  await env.DB.prepare('INSERT INTO mkt_deliverables (id, client_id, month, type, title, link, post_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, clientId, month, type, title, link, postId).run();
  const d = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();

  // Aviso AL CLIENTE: hay un entregable nuevo de su marca. Best-effort,
  // nunca rompe la respuesta (mismo patrón que los hooks V2).
  try {
    const clients = await clientUserIds(env, clientId, session.user_id);
    if (clients.length) {
      await notify(env, {
        user_ids: clients, type: 'entregable',
        body: `${session.name} agregó un ${type} nuevo${title ? ': ' + title : ''} (${month})`,
        link: '#/entregables', client_id: clientId, actor_name: session.name
      });
    }
  } catch (e) { if (!isMissingTableError(e)) console.error('[mkt notifyDeliverable]', e && e.message); }

  return json(shapeDeliverable(d, url.origin), 201);
}

async function handleUploadDeliverableVideo(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento de video no disponible' }, 503);
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  const ct = request.headers.get('Content-Type') || '';
  let file = null;
  if (ct.includes('multipart/form-data')) { const form = await request.formData(); file = form.get('video') || form.get('file'); }
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return json({ error: 'Adjunta el archivo en el campo "video".' }, 400);
  }
  const mime = String(file.type || '').toLowerCase();
  const ext = MKT_VIDEO_MIMES[mime];
  if (!ext) return json({ error: MKT_FORMAT_MSG }, 415);
  if (file.size && file.size > MKT_MAX_VIDEO_BYTES) return json({ error: 'El video supera 100 MB. Comprimelo o pega un enlace.' }, 413);
  await env.R2_BUCKET.put(`marketing/deliverable/${id}.${ext}`, file.stream(), {
    httpMetadata: { contentType: mime, cacheControl: 'private, max-age=3600' },
  });
  // Recien DESPUES de que el nuevo esta guardado se borran las otras extensiones
  // (si se borra antes y el put falla, el entregable se queda sin video) y el
  // poster viejo, que sigue siendo el cuadro del video ANTERIOR.
  for (const e of MKT_VIDEO_EXTS) { if (e !== ext) { try { await env.R2_BUCKET.delete(`marketing/deliverable/${id}.${e}`); } catch {} } }
  try { await env.R2_BUCKET.delete(`marketing/deliverable/${id}.poster.jpg`); } catch { /* noop */ }
  await env.DB.prepare(`UPDATE mkt_deliverables SET video_ext = ?, updated_at = ${MKT_NOW_MS} WHERE id = ?`).bind(ext, id).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();
  return json(shapeDeliverable(updated, new URL(request.url).origin), 200);
}

async function handleServeDeliverableVideo(request, env, session, id) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  const { d, error } = await dlvForAccess(env, session, id);
  if (error) return new Response('Forbidden', { status: 403 });
  // Ir DIRECTO a la extensión conocida (d.video_ext): así cada Range request (móvil
  // hace muchos al reproducir/buscar) no prueba las 6 extensiones en serie contra R2.
  let foundExt = d.video_ext || null;
  const getObj = async (rangeOpt) => {
    if (foundExt) {
      const o = await env.R2_BUCKET.get(`marketing/deliverable/${id}.${foundExt}`, rangeOpt);
      if (o) return o;
    }
    for (const e of MKT_VIDEO_EXTS) {
      const o = await env.R2_BUCKET.get(`marketing/deliverable/${id}.${e}`, rangeOpt);
      if (o) { foundExt = e; return o; }
    }
    return null;
  };

  const headers = new Headers();
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  const wantsDownload = new URL(request.url).searchParams.get('download');
  // El candado vive AQUÍ, no en el botón: la URL con ?download=1 se puede
  // escribir a mano, así que esconder el botón no protegería nada.
  if (wantsDownload && !(await descargaPermitida(env, session, d.client_id))) {
    return new Response('Las descargas están desactivadas para esta marca.', { status: 403 });
  }
  if (wantsDownload) {
    const safe = String(d.title || 'reel').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'reel';
    headers.set('Content-Disposition', `attachment; filename="${safe}.${d.video_ext || 'mp4'}"`);
  } else {
    headers.set('Content-Disposition', 'inline');
  }
  const res = await mktServeRangedWithMeta(request, getObj, headers);
  if (!res) return new Response('Sin video', { status: 404 });
  return res;
}

// Sirve el video de UN entregable con firma válida — sin sesión, solo inline.
async function handlePublicDeliverableVideo(request, env, id) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  const f = new URL(request.url).searchParams.get('f') || '';
  const esperada = await firmaEntregable(env, id);
  if (!f || f !== esperada) return new Response('Enlace no válido', { status: 403 });
  const d = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();
  if (!d || !d.video_ext) return new Response('Sin video', { status: 404 });
  let foundExt = d.video_ext || null;
  const getObj = async (rangeOpt) => {
    if (foundExt) {
      const o = await env.R2_BUCKET.get(`marketing/deliverable/${id}.${foundExt}`, rangeOpt);
      if (o) return o;
    }
    for (const e of MKT_VIDEO_EXTS) {
      const o = await env.R2_BUCKET.get(`marketing/deliverable/${id}.${e}`, rangeOpt);
      if (o) { foundExt = e; return o; }
    }
    return null;
  };
  const headers = new Headers();
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Disposition', 'inline');
  const res = await mktServeRangedWithMeta(request, getObj, headers);
  if (!res) return new Response('Sin video', { status: 404 });
  return res;
}

async function handlePatchDeliverable(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const { d, error } = await dlvForAccess(env, session, id);
  if (error) return error;
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const title = b.title !== undefined ? (b.title ? String(b.title).slice(0, 200) : null) : d.title;
  const link = b.link !== undefined ? (b.link ? String(b.link).slice(0, 1000) : null) : d.link;
  // OJO: aqui NO se toca updated_at. En esta tabla updated_at es el sello
  // anti-cache del ARCHIVO (dlvCacheStamp): si un simple renombrado lo moviera,
  // cambiarian video_url y poster_url y el cliente tendria que re-descargar el
  // reel COMPLETO en 4G solo porque le corregimos una letra al titulo.
  // post_id: vincular/desvincular con la pieza del calendario ('' = quitar).
  const postId = b.post_id !== undefined ? (b.post_id ? String(b.post_id).slice(0, 64) : null) : d.post_id;
  await env.DB.prepare('UPDATE mkt_deliverables SET title = ?, link = ?, post_id = ? WHERE id = ?').bind(title, link, postId, id).run();
  const u = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();
  return json(shapeDeliverable(u, new URL(request.url).origin));
}

async function handleDeleteDeliverable(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  for (const e of MKT_VIDEO_EXTS) { try { await env.R2_BUCKET.delete(`marketing/deliverable/${id}.${e}`); } catch {} }
  try { await env.R2_BUCKET.delete(`marketing/deliverable/${id}.poster.jpg`); } catch {}
  try { await env.DB.prepare('DELETE FROM mkt_deliverable_comments WHERE deliverable_id = ?').bind(id).run(); } catch { /* tabla puede no existir aún */ }
  await env.DB.prepare('DELETE FROM mkt_deliverables WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// Miniatura (poster) del reel: imagen JPEG generada en el cliente al subir.
async function handleUploadDeliverablePoster(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  const ct = request.headers.get('Content-Type') || '';
  let file = null;
  if (ct.includes('multipart/form-data')) { const form = await request.formData(); file = form.get('poster') || form.get('file'); }
  if (!file || typeof file.stream !== 'function') return json({ error: 'Adjunta la imagen en el campo "poster".' }, 400);
  await env.R2_BUCKET.put(`marketing/deliverable/${id}.poster.jpg`, file.stream(), {
    httpMetadata: { contentType: 'image/jpeg', cacheControl: 'private, max-age=86400' },
  });
  // Queda anotado: a partir de aquí el listado sí anuncia la miniatura.
  try {
    await env.DB.prepare(`UPDATE mkt_deliverables SET poster_ok = 1, updated_at = ${MKT_NOW_MS} WHERE id = ?`).bind(id).run();
  } catch (e) { if (!isMissingColumnError(e)) throw e; }
  return json({ ok: true });
}

async function handleServeDeliverablePoster(request, env, session, id) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  const { error } = await dlvForAccess(env, session, id);
  if (error) return new Response('Forbidden', { status: 403 });
  const obj = await env.R2_BUCKET.get(`marketing/deliverable/${id}.poster.jpg`);
  if (!obj) return new Response('Sin poster', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=86400');
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

// ── SUBIDA POR PARTES (multipart R2) — videos grandes + progreso ────────────
// El navegador trocea el archivo y sube cada parte; R2 las ensambla. Sin limite
// practico de tamano y con la calidad ORIGINAL (bytes tal cual, sin recomprimir).
// El mecanismo es UNO SOLO y lo usan las dos rutas de video (Entregables y el
// "Video final" del calendario): solo cambia DONDE vive el archivo (keyPrefix) y
// que fila se actualiza al terminar.

// Arranca la subida: valida el formato y crea el multipart en R2.
// Devuelve { res } cuando hay que responder ya (error) o { ext, key, uploadId }.
async function mktMpuStart(request, env, keyPrefix) {
  let b; try { b = await request.json(); } catch { return { res: json({ error: 'JSON invalido' }, 400) }; }
  const mime = String(b.mime || '').toLowerCase();
  const ext = MKT_VIDEO_MIMES[mime];
  if (!ext) return { res: json({ error: MKT_FORMAT_MSG }, 415) };
  // OJO: aqui NO se borra la version anterior. Antes se borraba al ARRANCAR, y
  // con la subida por partes eso deja el video viejo destruido durante TODA la
  // subida (minutos en 4G): si se cae la red o se cierra la pestana, el cliente
  // ve "Sin video" y el original ya no existe. El borrado de las otras
  // extensiones ocurre en mktMpuComplete, cuando el nuevo ya esta guardado.
  const key = `${keyPrefix}.${ext}`;
  const mpu = await env.R2_BUCKET.createMultipartUpload(key, {
    httpMetadata: { contentType: mime, cacheControl: 'private, max-age=3600' },
  });
  return { res: json({ uploadId: mpu.uploadId, ext, key }), ext, key, uploadId: mpu.uploadId };
}

// Sube UNA parte. El cuerpo se lee completo a memoria (R2 necesita el tamano de
// la parte), por eso el navegador manda partes CHICAS (~15MB): con partes de
// 50MB y 3 subiendo a la vez, un 4K de 2GB podia reventar la memoria del Worker.
async function mktMpuPart(request, env, keyPrefix) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId');
  const ext = url.searchParams.get('ext');
  const partNumber = parseInt(url.searchParams.get('part'), 10);
  if (!uploadId || !MKT_VIDEO_EXTS.includes(ext) || !(partNumber >= 1)) {
    return json({ error: 'Faltan uploadId/ext/part validos.' }, 400);
  }
  if (partNumber > MKT_MAX_PARTS) {
    return json({ error: 'El video es demasiado grande para subirlo por aqui. Comparte un enlace.' }, 413);
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared && declared > MKT_MAX_PART_BYTES) {
    return json({ error: 'Esa parte es demasiado grande. Recarga la pagina y vuelve a subir el video.' }, 413);
  }
  const mpu = env.R2_BUCKET.resumeMultipartUpload(`${keyPrefix}.${ext}`, uploadId);
  const body = await request.arrayBuffer();
  // Sin Content-Length (Transfer-Encoding: chunked) la guarda de arriba no aplica,
  // asi que se vuelve a revisar YA con los bytes en la mano.
  if (body.byteLength > MKT_MAX_PART_BYTES) {
    return json({ error: 'Esa parte es demasiado grande. Recarga la pagina y vuelve a subir el video.' }, 413);
  }
  const part = await mpu.uploadPart(partNumber, body);
  return json({ partNumber: part.partNumber, etag: part.etag, size: body.byteLength });
}

// Cancela una subida por partes y BORRA las partes ya subidas. Sin esto, una
// subida abandonada (se corto la red, se cerro la pestana) deja las partes en R2
// invisibles y facturandose para siempre.
async function mktMpuAbort(request, env, keyPrefix) {
  const url = new URL(request.url);
  let uploadId = url.searchParams.get('uploadId');
  let ext = url.searchParams.get('ext');
  if (!uploadId || !ext) {
    try { const b = await request.json(); uploadId = uploadId || b.uploadId; ext = ext || b.ext; } catch { /* noop */ }
  }
  if (!uploadId || !MKT_VIDEO_EXTS.includes(ext)) return json({ error: 'Faltan uploadId/ext validos.' }, 400);
  try {
    const mpu = env.R2_BUCKET.resumeMultipartUpload(`${keyPrefix}.${ext}`, uploadId);
    await mpu.abort();
  } catch { /* ya estaba cancelada/completada: da igual */ }
  return json({ ok: true });
}

// Ensambla las partes y VERIFICA que el archivo quedo completo: si el navegador
// declaro el tamano original (campo `size`) y lo ensamblado no cuadra, se BORRA
// y se responde error — antes se daba por bueno un video cortado y nadie se
// enteraba hasta que el cliente reclamaba.
// Devuelve { ext } si todo bien, o { res } con la respuesta de error.
async function mktMpuComplete(request, env, keyPrefix, body) {
  const b = body;
  const uploadId = b.uploadId;
  const ext = b.ext;
  const parts = Array.isArray(b.parts) ? b.parts : null;
  if (!uploadId || !MKT_VIDEO_EXTS.includes(ext) || !parts || !parts.length) {
    return { res: json({ error: 'Faltan datos de la subida (uploadId/ext/parts).' }, 400) };
  }
  const key = `${keyPrefix}.${ext}`;
  const mpu = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
  // Cancelar SIEMPRE que no se vaya a ensamblar: si no, las partes ya subidas se
  // quedan en R2 invisibles y facturandose (un 4K cortado = >1 GB de basura).
  const bail = async (msg, status) => {
    try { await mpu.abort(); } catch { /* noop */ }
    return { res: json({ error: msg }, status) };
  };
  if (parts.length > MKT_MAX_PARTS) {
    return bail('El video es demasiado grande para subirlo por aqui. Comparte un enlace.', 413);
  }
  // Ninguna parte puede faltar: los numeros deben ser 1..N sin huecos. El cliente
  // manda un arreglo DISPERSO cuando una parte fallo, y JSON.stringify convierte
  // los huecos en null -> hay que revisar la forma ANTES de leer p.partNumber.
  const shapeOk = parts.every((p) => p && p.etag && Number.isFinite(Number(p.partNumber)));
  if (!shapeOk) {
    return bail('Faltan partes del video (la subida quedo incompleta). Intenta de nuevo.', 400);
  }
  const nums = parts.map((p) => Number(p.partNumber)).sort((x, y) => x - y);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      return bail('Faltan partes del video (la subida quedo incompleta). Intenta de nuevo.', 400);
    }
  }
  try {
    await mpu.complete(parts.map((p) => ({ partNumber: Number(p.partNumber), etag: p.etag })));
  } catch (e) {
    return bail('No se pudo ensamblar el video: ' + (e.message || 'error'), 500);
  }
  // Red de seguridad: el tamano ensamblado debe ser EXACTO al del archivo original.
  const expected = Number(b.size || 0);
  if (expected > 0) {
    let real = null;
    try { const h = await env.R2_BUCKET.head(key); real = h ? h.size : null; } catch { real = null; }
    if (real != null && real !== expected) {
      // Se borra lo ensamblado: es preferible "no hay video" a un video cortado
      // que nadie nota hasta que el cliente reclama. `purged` avisa a quien llama
      // para que limpie tambien la fila (video_ext / video_url).
      try { await env.R2_BUCKET.delete(key); } catch {}
      return { purged: true, purgedExt: ext, real, expected, res: json({
        error: `El video llego incompleto (${real} de ${expected} bytes) y no se guardo. Vuelve a subirlo.`,
      }, 422) };
    }
  }
  // AHORA si: el nuevo video ya esta completo y verificado, se puede borrar la
  // version anterior que tenia OTRA extension (cambio de formato). Hacerlo aqui
  // y no al arrancar es lo que evita quedarse sin video si la subida se cae.
  for (const e of MKT_VIDEO_EXTS) {
    if (e !== ext) { try { await env.R2_BUCKET.delete(`${keyPrefix}.${e}`); } catch {} }
  }
  return { ext };
}

async function handleDlvMultipartStart(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento de video no disponible' }, 503);
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  const r = await mktMpuStart(request, env, `marketing/deliverable/${id}`);
  return r.res;
}

async function handleDlvMultipartPart(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  return mktMpuPart(request, env, `marketing/deliverable/${id}`);
}

async function handleDlvMultipartAbort(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await dlvForAccess(env, session, id);
  if (error) return error;
  return mktMpuAbort(request, env, `marketing/deliverable/${id}`);
}

async function handleDlvMultipartComplete(request, env, session, id) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { d, error } = await dlvForAccess(env, session, id);
  if (error) return error;
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const r = await mktMpuComplete(request, env, `marketing/deliverable/${id}`, b);
  if (r.res) {
    if (!r.purged) return r.res;
    // La subida llego incompleta y se borro lo ensamblado. AQUI NO se pone
    // video_ext = NULL a ciegas: si el reemplazo traia OTRA extension, el video
    // ANTERIOR sigue intacto en R2 y la fila tiene que seguir apuntando a el
    // (poniendo NULL el reel se veia "Procesando..." para siempre aunque el
    // archivo bueno estuviera ahi). Se pregunta a R2 que quedo de verdad.
    let alive = null;
    try {
      alive = await dlvSurvivingExt(env, id);
      // Solo se escribe si de verdad cambio: si el video anterior sigue siendo el
      // mismo archivo, mover updated_at cambiaria el sello y el cliente se
      // re-descargaria en 4G un video que no cambio ni un byte.
      if (alive !== (d.video_ext || null)) {
        await env.DB.prepare(`UPDATE mkt_deliverables SET video_ext = ?, updated_at = ${MKT_NOW_MS} WHERE id = ?`).bind(alive, id).run();
      }
    } catch (e) { console.error('[mkt dlv purge]', e && e.message); }
    // Mensaje HONESTO: no es lo mismo "no se guardo, sigues teniendo el de antes"
    // que "se perdio el anterior". Antes siempre se decia lo primero.
    return json({
      error: alive
        ? `El video llegó incompleto (${r.real} de ${r.expected} bytes) y no se guardó. El video anterior sigue ahí: vuelve a intentarlo.`
        : `El video llegó incompleto (${r.real} de ${r.expected} bytes) y no se guardó. Este reel se quedó SIN video: vuelve a subirlo con "Subir video" — los comentarios siguen ahí.`,
      purged: true, kept_previous: !!alive,
    }, 422);
  }
  // El poster que hubiera es del video ANTERIOR: se borra aqui para que no quede
  // una miniatura mintiendo sobre un video que ya cambio. El flujo normal sube el
  // poster nuevo justo despues; si no se pudo generar (HEVC, iOS), la tarjeta cae
  // al primer cuadro del video NUEVO en vez de mostrar el cuadro del viejo.
  try { await env.R2_BUCKET.delete(`marketing/deliverable/${id}.poster.jpg`); } catch { /* noop */ }
  await env.DB.prepare(`UPDATE mkt_deliverables SET video_ext = ?, updated_at = ${MKT_NOW_MS} WHERE id = ?`).bind(r.ext, id).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_deliverables WHERE id = ?').bind(id).first();
  return json(shapeDeliverable(updated, new URL(request.url).origin), 200);
}

// ── VIDEO FINAL del calendario POR PARTES ───────────────────────────────────
// Mismas 3 llamadas que Entregables, mismo nucleo (mktMpu*), pero guardando en
// marketing/video/<postId>.<ext> y dejando video_url en mkt_posts. Asi el "Video
// final" ya NO obliga a comprimir a mano nada que pase de 100 MB.
async function handlePostMultipartStart(request, env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento de video no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  const r = await mktMpuStart(request, env, `marketing/video/${postId}`);
  return r.res;
}

async function handlePostMultipartPart(request, env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  return mktMpuPart(request, env, `marketing/video/${postId}`);
}

async function handlePostMultipartAbort(request, env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  return mktMpuAbort(request, env, `marketing/video/${postId}`);
}

async function handlePostMultipartComplete(request, env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const r = await mktMpuComplete(request, env, `marketing/video/${postId}`, b);
  if (r.res) {
    // Solo se limpia video_url si apuntaba a NUESTRO archivo. video_url es de
    // doble uso: tambien guarda enlaces pegados a mano (Drive, WeTransfer) y una
    // subida cortada no tiene por que borrarle al cliente su enlace.
    if (r.purged) {
      try {
        await env.DB.prepare(
          "UPDATE mkt_posts SET video_url = NULL, updated_at = datetime('now') WHERE id = ? AND video_url LIKE '%/api/marketing/posts/' || id || '/video%'"
        ).bind(postId).run();
      } catch {}
    }
    return r.res;
  }
  const origin = new URL(request.url).origin;
  const videoUrl = `${origin}/api/marketing/posts/${postId}/video`;
  await env.DB.prepare("UPDATE mkt_posts SET video_url = ?, updated_at = datetime('now') WHERE id = ?").bind(videoUrl, postId).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json(shapePost(updated), 200);
}

// Main router. `path` is the URL pathname AFTER the /api/marketing prefix has
// been stripped (e.g. '/auth/login', '/posts/abc/approve').
// Route discipline: LITERAL routes always sit before :id matchers (post ids
// are 32-hex, so 'bulk-update' / 'reorder' / 'unread-count' can never collide).
async function route(request, env, authCtx) {
  const method = request.method;
  if (method === 'OPTIONS') return corsPreflight(request);

  const url = new URL(request.url);
  let path = url.pathname;
  // Normalize: ensure leading slash, drop trailing slash (except root).
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const parts = path.split('/').filter(Boolean); // e.g. ['posts','abc','approve']

  // ── Public auth endpoints (no session required) ──
  if (path === '/auth/login' && method === 'POST') return handleLogin(request, env);
  if (path === '/auth/register' && method === 'POST') return handleRegister(request, env);
  // Registro público (self-signup) + verificación + reset por token (migración 016).
  if (path === '/auth/signup' && method === 'POST') return handleSignup(request, env);
  if (path === '/auth/verify' && method === 'GET') return handleVerifyEmail(env, url);
  // Reenvío del correo de verificación (valida su propia sesión adentro).
  if (path === '/auth/resend-verify' && method === 'POST') return handleResendVerify(request, env);
  if (path === '/auth/forgot' && method === 'POST') return handleForgotPassword(request, env);
  if (path === '/auth/reset-with-token' && method === 'POST') return handleResetWithToken(request, env);

  // Instagram OAuth: el callback llega sin cookie (SameSite=Strict) y se
  // valida con nonce de un solo uso; el assign del selector igual.
  if (path === '/ig/callback' && method === 'GET') return handleIgCallback(request, env, url);
  if (path === '/ig/assign' && method === 'POST') return handleIgAssign(request, env);

  // ── HEALTH (público; para monitores externos: ¿responde la app y la BD?) ──
  if (path === '/health' && method === 'GET') {
    try {
      await env.DB.prepare('SELECT 1').first();
      return json({ ok: true, db: true });
    } catch {
      return json({ ok: false, db: false }, 503);
    }
  }

  // ── VIDEO PÚBLICO FIRMADO (sin sesión): el PDF de entregables enlaza cada
  //    video individual; la firma HMAC hace la URL incompartible-por-adivinanza
  //    y solo permite VER (nunca ?download). ──
  if (parts[0] === 'publico' && parts[1] === 'entregable' && parts.length === 4 && parts[3] === 'video' && (method === 'GET' || method === 'HEAD')) {
    return handlePublicDeliverableVideo(request, env, parts[2]);
  }
  // Slides de carrusel para el publicador (Meta los baja de aquí).
  if (parts[0] === 'publico' && parts[1] === 'carrusel' && parts.length === 4 && (method === 'GET' || method === 'HEAD')) {
    return handlePublicCarouselSlide(request, env, parts[2], parts[3]);
  }
  // Portada del reel para el publicador.
  if (parts[0] === 'publico' && parts[1] === 'portada' && parts.length === 3 && (method === 'GET' || method === 'HEAD')) {
    return handlePublicPortada(request, env, parts[2]);
  }
  // EL TIC-TAC (2026-08-16): timbre público del reloj — el worker
  // ivae-marketing-reloj lo toca cada 10 min para que el publicador y las
  // recetas de tiempo corran AUNQUE nadie use la app. Sin secretos porque
  // solo dispara el mismo lazySweep de siempre (throttled 15 min adentro,
  // idempotente); tocarlo mil veces cuesta lo mismo que una.
  if (parts[0] === 'tick' && (method === 'GET' || method === 'POST')) {
    // El PUBLICADOR corre SIEMPRE en el tick (la query de vencidas es un
    // SELECT barato) — sin esto, el throttle de 15 min del sweep podía
    // retrasar una publicación hasta ~19 min después de su hora.
    let publicadas = 0;
    try { publicadas = ((await publicarPendientes(env)) || []).length; } catch { /* queda en publish_error */ }
    await safeSweep(env);
    // Huella del latido: mkt_kv 'tick_at' — para auditar que el reloj vive.
    try {
      await env.DB.prepare("INSERT INTO mkt_kv (key, value) VALUES ('tick_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(new Date().toISOString()).run();
    } catch { /* el latido jamás tumba el tick */ }
    return json({ ok: true, tic: 'tac', publicadas });
  }

  // ── CRON (no session; Bearer MKT_CRON_SECRET) — BEFORE the session gate ──
  if (path === '/cron' && method === 'POST') return handleCron(request, env);
  // El PROGRAMADOR: publica piezas 'programado' cuya hora ya llegó (cada 15 min).
  if (path === '/cron-publicar' && method === 'POST') return handleCronPublicar(request, env);

  // Everything else needs a valid session (y de paso la renueva: deslizante).
  const session = await getSession(request, env, authCtx);

  if (path === '/auth/logout' && method === 'POST') return handleLogout(request, env, session);
  if (path === '/auth/me' && method === 'GET') return handleMe(session, env);

  if (!session) return json({ error: 'Not authenticated' }, 401);

  if (path === '/auth/change-password' && method === 'POST') return handleChangePassword(request, env, session);
  // Auto-borrado de cuenta (Apple 5.1.1(v)): el DUEÑO de una marca de
  // auto-registro borra todo su workspace; cualquier otro (invitado de la
  // agencia o staff) borra SOLO su propio usuario.
  if (path === '/auth/account' && method === 'DELETE') return handleDeleteAccount(request, env, session);
  // EULA (Apple 1.2): aceptación afirmativa, exigida al entrar.
  if (path === '/auth/accept-eula' && method === 'POST') return handleAcceptEula(env, session);

  // ── Contenido de usuarios: reportar y bloquear (Apple 1.2) ────────────────
  // Disponibles para TODOS los roles: el revisor de Apple debe poder tocarlos
  // con la cuenta demo, que es de cliente.
  if (path === '/reports' && method === 'POST') return handleCreateReport(request, env, session);
  if (path === '/blocks' && method === 'GET') return handleListBlocks(env, session);
  if (path === '/blocks' && method === 'POST') return handleBlockUser(request, env, session);
  {
    const mBlock = path.match(/^\/blocks\/([A-Za-z0-9_-]+)$/);
    if (mBlock && method === 'DELETE') return handleUnblockUser(env, session, mBlock[1]);
  }

  const isStaff = session.role === 'admin' || session.role === 'team';

  // Bandeja de moderación (staff): Apple exige actuar en menos de 24 h.
  if (path === '/reports' && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleListReports(env);
  }
  {
    const mRep = path.match(/^\/reports\/([A-Za-z0-9_-]+)\/resolve$/);
    if (mRep && method === 'POST') {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      return handleResolveReport(request, env, session, mRep[1]);
    }
  }

  // ── CARRUSEL CON IA (staff) ──
  // El navegador manda MINIATURAS (no las fotos originales) + lo que ya midió
  // el fotómetro; Claude cura, ordena y escribe. Ver _carrusel-ia.js.
  if (path === '/carousel/guion' && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleCarruselGuion(request, env, session);
  }

  // ── CLIENTS ──
  if (parts[0] === 'clients') {
    // GET /clients — list (client role gets only their own object).
    if (parts.length === 1) {
      if (method === 'GET') return handleListClients(env, session);
      if (method === 'POST') {
        if (!isStaff) return json({ error: 'Forbidden' }, 403);
        return handleCreateClient(request, env, session);
      }
      return json({ error: 'Method not allowed' }, 405);
    }
    // /clients/:id
    if (parts.length === 2) {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      const clientId = parts[1];
      if (method === 'PATCH') return handlePatchClient(request, env, session, clientId);
      if (method === 'DELETE') return handleArchiveClient(env, session, clientId);
      return json({ error: 'Method not allowed' }, 405);
    }
    // /clients/:id/brief — brief de onboarding (SOLO staff; 403 a clientes).
    if (parts.length === 3 && parts[2] === 'brief') {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      if (method === 'GET') return handleGetClientBrief(env, parts[1]);
      return json({ error: 'Method not allowed' }, 405);
    }
  }

  // ── USERS (admin/team only) ──
  if (parts[0] === 'users') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    if (parts.length === 1) {
      if (method === 'GET') return handleListUsers(env);
      if (method === 'POST') return handleCreateUser(request, env, session);
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts.length === 2) {
      const userId = parts[1];
      if (method === 'PATCH') return handlePatchUser(request, env, session, userId);
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts.length === 3 && parts[2] === 'reset-password' && method === 'POST') {
      return handleResetUserPassword(env, session, parts[1]);
    }
    // Ver la contraseña guardada (solo admin; el handler revalida el rol).
    if (parts.length === 3 && parts[2] === 'password' && method === 'GET') {
      return handleRevealPassword(env, session, parts[1]);
    }
    // Guardar en la bóveda la contraseña que el cliente YA usa (no la cambia).
    if (parts.length === 3 && parts[2] === 'remember-password' && method === 'POST') {
      return handleRememberPassword(request, env, session, parts[1]);
    }
  }

  // ── POSTS ──
  if (parts[0] === 'posts') {
    // Literal sub-routes FIRST (before the /posts/:id matcher).
    if (parts.length === 2 && parts[1] === 'reorder' && method === 'POST') {
      return handleReorder(request, env, session);
    }
    if (parts.length === 2 && parts[1] === 'bulk-update' && method === 'POST') {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      return handleBulkUpdate(request, env, session);
    }
    if (parts.length === 2 && parts[1] === 'bulk-delete' && method === 'POST') {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      return handleBulkDelete(request, env, session);
    }
    if (parts.length === 1) {
      if (method === 'GET') return handleListPosts(request, env, session, url);
      // Crear: staff o cliente (el handler fuerza el client_id del cliente).
      if (method === 'POST') return handleCreatePost(request, env, session);
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts.length === 2) {
      const postId = parts[1];
      if (method === 'GET') return handleGetPost(request, env, session, postId);
      // Editar: staff o cliente (el handler verifica la marca del post).
      // Borrar: SOLO staff (handleDeletePost rechaza role=client con 403).
      if (method === 'PATCH') return handlePatchPost(request, env, session, postId);
      if (method === 'DELETE') {
        return handleDeletePost(env, session, postId);
      }
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts.length === 3) {
      const postId = parts[1];
      const sub = parts[2];
      if (sub === 'approve' && method === 'POST') return handleApprovalDecision(request, env, session, postId, 'approved');
      if (sub === 'request-changes' && method === 'POST') return handleApprovalDecision(request, env, session, postId, 'changes');
      if (sub === 'comments' && method === 'POST') return handleAddComment(request, env, session, postId);
      if (sub === 'duplicate' && method === 'POST') {
        if (!isStaff) return json({ error: 'Forbidden' }, 403);
        return guardTables(() => handleDuplicatePost(request, env, session, postId));
      }
      // Video final: subida directa a R2 (staff o cliente dueño de la marca).
      if (sub === 'video') {
        if (method === 'POST') return handleUploadVideo(request, env, session, postId);
        // HEAD igual que GET: gestores de descarga, WebViews de Android y los
        // previsualizadores consultan el tamano antes de bajar. El helper de Range
        // ya responde bien; solo faltaba dejarlos pasar.
        if (method === 'GET' || method === 'HEAD') return handleServeVideo(request, env, session, postId);
        if (method === 'DELETE') return handleDeleteVideo(env, session, postId);
        return json({ error: 'Method not allowed' }, 405);
      }
    }
    // Video final POR PARTES (videos grandes, mismo mecanismo que Entregables):
    // /posts/:id/video/multipart/{start|part|complete}
    if (parts.length === 5 && parts[2] === 'video' && parts[3] === 'multipart') {
      const postId = parts[1];
      if (parts[4] === 'start' && method === 'POST') return handlePostMultipartStart(request, env, session, postId);
      if (parts[4] === 'part' && method === 'PUT') return handlePostMultipartPart(request, env, session, postId);
      if (parts[4] === 'complete' && method === 'POST') return handlePostMultipartComplete(request, env, session, postId);
      if (parts[4] === 'abort' && method === 'POST') return handlePostMultipartAbort(request, env, session, postId);
      return json({ error: 'Method not allowed' }, 405);
    }
    // ── CHECKLIST (staff only; nested under the post → ownership re-check) ──
    if (parts.length >= 3 && parts[2] === 'checklist') {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      const postId = parts[1];
      return guardTables(async () => {
        const post = await env.DB.prepare('SELECT id, client_id FROM mkt_posts WHERE id = ?').bind(postId).first();
        if (!post) return json({ error: 'Post not found' }, 404);
        if (parts.length === 3) {
          if (method === 'GET') return handleChecklistList(env, session, post);
          if (method === 'POST') return handleChecklistAdd(request, env, session, post);
          return json({ error: 'Method not allowed' }, 405);
        }
        if (parts.length === 4) {
          if (parts[3] === 'reorder' && method === 'POST') return handleChecklistReorder(request, env, session, post);
          if (parts[3] === 'bulk' && method === 'POST') return handleChecklistBulk(request, env, session, post);
          const itemId = parts[3];
          if (method === 'PATCH') return handleChecklistPatch(request, env, session, post, itemId);
          if (method === 'DELETE') return handleChecklistDelete(env, session, post, itemId);
          return json({ error: 'Method not allowed' }, 405);
        }
        return json({ error: 'Not found' }, 404);
      });
    }
  }

  // ── ENTREGABLES (staff sube/gestiona; cliente de la marca ve y descarga) ──
  if (parts[0] === 'deliverables') {
    return guardTables(async () => {
      if (parts.length === 1) {
        if (method === 'GET') return handleListDeliverables(env, session, url);
        if (method === 'POST') return handleCreateDeliverable(request, env, session, url);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (parts.length === 2) {
        const id = parts[1];
        if (method === 'PATCH') return handlePatchDeliverable(request, env, session, id);
        if (method === 'DELETE') return handleDeleteDeliverable(request, env, session, id);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (parts.length === 3 && parts[2] === 'video') {
        const id = parts[1];
        if (method === 'POST') return handleUploadDeliverableVideo(request, env, session, id);
        if (method === 'GET' || method === 'HEAD') return handleServeDeliverableVideo(request, env, session, id);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (parts.length === 3 && parts[2] === 'poster') {
        const id = parts[1];
        if (method === 'POST') return handleUploadDeliverablePoster(request, env, session, id);
        if (method === 'GET') return handleServeDeliverablePoster(request, env, session, id);
        return json({ error: 'Method not allowed' }, 405);
      }
      // Comentarios/cambios del cliente: /deliverables/:id/comments
      if (parts.length === 3 && parts[2] === 'comments') {
        const id = parts[1];
        if (method === 'GET') return handleListDeliverableComments(env, session, id);
        if (method === 'POST') return handleAddDeliverableComment(request, env, session, id);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (parts.length === 4 && parts[2] === 'comments') {
        const id = parts[1];
        if (method === 'DELETE') return handleDeleteDeliverableComment(request, env, session, id, parts[3]);
        return json({ error: 'Method not allowed' }, 405);
      }
      // Subida por partes (videos grandes): /deliverables/:id/video/multipart/{start|part|complete}
      if (parts.length === 5 && parts[2] === 'video' && parts[3] === 'multipart') {
        const id = parts[1];
        if (parts[4] === 'start' && method === 'POST') return handleDlvMultipartStart(request, env, session, id);
        if (parts[4] === 'part' && method === 'PUT') return handleDlvMultipartPart(request, env, session, id);
        if (parts[4] === 'complete' && method === 'POST') return handleDlvMultipartComplete(request, env, session, id);
        if (parts[4] === 'abort' && method === 'POST') return handleDlvMultipartAbort(request, env, session, id);
        return json({ error: 'Method not allowed' }, 405);
      }
      return json({ error: 'Not found' }, 404);
    });
  }

  // ── NOTIFICATIONS (any role; always scoped to the session user) ──
  if (parts[0] === 'notifications') {
    return guardTables(async () => {
      if (parts.length === 1 && method === 'GET') return handleListNotifications(request, env, session, url);
      if (parts.length === 2 && parts[1] === 'unread-count' && method === 'GET') return handleUnreadCount(env, session);
      if (parts.length === 2 && parts[1] === 'read' && method === 'POST') return handleNotificationsRead(request, env, session);
      if (parts.length === 2 && parts[1] === 'delete' && method === 'POST') return handleNotificationsDelete(request, env, session);
      return json({ error: 'Not found' }, 404);
    });
  }

  // ── DASHBOARD (staff; single aggregator, module _dashboard.js) ──
  if (path === '/dashboard' && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleDashboard(request, env, session, url);
  }

  // ── ALMACENAMIENTO EN R2 (SOLO equipo; barra del panel de Agencia) ──
  // Nunca para role='client': el tamaño del bucket es informacion interna
  // (incluye la galeria de fotos de OTROS clientes).
  if (path === '/storage' && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleStorage(request, env, session, url);
  }

  // ── EXPORTAR CALENDARIO .ics (staff o cliente; el cliente va forzado a SU marca) ──
  // ── INSTAGRAM (conexión y métricas) ──
  if (parts[0] === 'ig') {
    if (path === '/ig/login' && method === 'GET') return handleIgLogin(request, env, session, url);
    if (path === '/ig/metrics' && method === 'GET') return handleIgMetrics(request, env, session, url);
    if (path === '/ig/metrics-range' && method === 'GET') return handleIgMetricsRange(request, env, session, url);
    if (path === '/ig/manual' && (method === 'GET' || method === 'POST')) return handleIgManual(request, env, session, url);
    if (path === '/ig/disconnect' && method === 'POST') return handleIgDisconnect(request, env, session);
    return json({ error: 'Not found' }, 404);
  }

  // Reporte mensual del cliente (HTML imprimible; cliente forzado a su marca).
  if (path === '/report' && method === 'GET') {
    return handleMonthlyReport(request, env, session, url, fetchIgMetrics, getManualMetrics, fetchIgMetricsRange);
  }

  // ── SEARCH (staff) ──
  if (path === '/search' && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleSearch(env, session, url);
  }

  // ── WORKLOAD + CAPACITIES (staff) ──
  if (path === '/workload' && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleWorkload(env, session, url);
  }
  if (parts[0] === 'capacities' && parts.length === 1) {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return guardTables(async () => {
      if (method === 'GET') return handleListCapacities(env);
      if (method === 'POST') return handleUpsertCapacity(request, env, session);
      return json({ error: 'Method not allowed' }, 405);
    });
  }

  // ── AUTOMATIONS (staff; 8 fixed recipes) ──
  if (parts[0] === 'automations') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return guardTables(async () => {
      if (parts.length === 1 && method === 'GET') return handleListAutomations(env);
      if (parts.length === 2 && method === 'PATCH') return handlePatchAutomation(request, env, session, parts[1]);
      return json({ error: 'Not found' }, 404);
    });
  }

  // ── SAVED VIEWS (staff) ──
  if (parts[0] === 'views') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return guardTables(async () => {
      if (parts.length === 1) {
        if (method === 'GET') return handleListViews(env, session, url);
        if (method === 'POST') return handleCreateView(request, env, session);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (parts.length === 2) {
        if (method === 'PATCH') return handlePatchView(request, env, session, parts[1]);
        if (method === 'DELETE') return handleDeleteView(env, session, parts[1]);
        return json({ error: 'Method not allowed' }, 405);
      }
      return json({ error: 'Not found' }, 404);
    });
  }

  // ── ACTIVITY (staff: todo; CLIENTE: su historial blindado — pidió Vianey
  //    que con varios revisores por marca se vea quién hizo qué y cuándo) ──
  if (parts[0] === 'activity' && parts.length === 1 && method === 'GET') {
    if (!isStaff && session.role !== 'client') return json({ error: 'Forbidden' }, 403);
    return handleActivity(request, env, session, url, isStaff);
  }

  // ── DESCARGAR (solo staff): descargador de videos IG/TikTok/Pinterest ──
  if (parts[0] === 'descargar') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    if (parts.length === 1 && method === 'POST') return handleResolveDownload(request, env);
    if (parts.length === 2 && parts[1] === 'file' && method === 'GET') return handleDownloadFile(request, env);
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── PINTEREST FOTOS (solo staff): busca pines o cosecha las imágenes de un
  // pin para el Estudio de carruseles. Los bytes bajan por /descargar/file
  // (mismo proxy anti-SSRF; pinimg.com ya está en la lista de hosts).
  if (parts[0] === 'pinterest-fotos' && parts.length === 1 && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handlePinterestFotos(request);
  }

  // ── GENERAR MES CON IA (solo staff): Claude escribe el mes completo de una
  // marca con su voz real. Las piezas nacen como borrador INTERNO (status
  // 'guion', client_visible=0): el cliente no ve nada hasta que el equipo
  // revisa y publica al portal — la IA propone, el humano firma.
  if (parts[0] === 'mes-ia' && parts.length === 1 && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleGenerarMes(request, env, session);
  }

  // ── PUBLICAR AHORA (solo staff): sube la pieza a Instagram de inmediato.
  if (parts[0] === 'posts' && parts.length === 3 && parts[2] === 'slides' && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleUploadCarouselSlide(request, env, parts[1]);
  }
  if (parts[0] === 'posts' && parts.length === 3 && parts[2] === 'portada' && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleUploadPortada(request, env, parts[1]);
  }
  if (parts[0] === 'posts' && parts.length === 3 && parts[2] === 'publicar' && method === 'POST') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handlePublicarPieza(env, parts[1], session);
  }

  return json({ error: 'Not found' }, 404);
}

// El Estudio manda cada slide terminado (JPEG 1080x1350) a la pieza: quedan
// en R2 bajo marketing/carrusel/<postId>/N.jpg listos para el publicador.
async function handleUploadCarouselSlide(request, env, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const post = await env.DB.prepare('SELECT id FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Pieza no encontrada' }, 404);
  const n = Math.max(1, Math.min(10, Number(new URL(request.url).searchParams.get('n')) || 0));
  if (!n) return json({ error: 'Falta n (1-10)' }, 400);
  const body = await request.arrayBuffer();
  if (!body || body.byteLength < 1024) return json({ error: 'Imagen vacía' }, 400);
  if (body.byteLength > 8 * 1024 * 1024) return json({ error: 'Slide muy pesado (max 8MB)' }, 413);
  // JPEG de verdad (magia FFD8) — el publicador solo sirve image/jpeg.
  const magia = new Uint8Array(body.slice(0, 2));
  if (magia[0] !== 0xFF || magia[1] !== 0xD8) return json({ error: 'Debe ser JPEG' }, 400);
  await env.R2_BUCKET.put(`marketing/carrusel/${postId}/${n}.jpg`, body, {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  return json({ ok: true, n });
}

// La PORTADA del reel de una pieza: JPEG en R2 bajo marketing/portada/<id>.jpg
// (la sube el editor). Devuelve la URL firmada para que Meta la baje, o null.
async function portadaFirmadaDePieza(env, post) {
  if (!env.R2_BUCKET) return null;
  const o = await env.R2_BUCKET.head(`marketing/portada/${post.id}.jpg`);
  if (!o) return null;
  const f = await firmaEntregable(env, `portada-${post.id}.jpg`);
  return `https://ivaestudios.com/api/marketing/publico/portada/${post.id}.jpg?f=${f}`;
}

// Sube la portada del reel (staff): JPEG real, máx 8MB.
async function handleUploadPortada(request, env, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const post = await env.DB.prepare('SELECT id FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Pieza no encontrada' }, 404);
  const body = await request.arrayBuffer();
  if (!body || body.byteLength < 1024) return json({ error: 'Imagen vacía' }, 400);
  if (body.byteLength > 8 * 1024 * 1024) return json({ error: 'Portada muy pesada (max 8MB)' }, 413);
  const magia = new Uint8Array(body.slice(0, 2));
  if (magia[0] !== 0xFF || magia[1] !== 0xD8) return json({ error: 'Debe ser JPEG' }, 400);
  await env.R2_BUCKET.put(`marketing/portada/${postId}.jpg`, body, {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  const f = await firmaEntregable(env, `portada-${postId}.jpg`);
  return json({ ok: true, url: `https://ivaestudios.com/api/marketing/publico/portada/${postId}.jpg?f=${f}` });
}

// Sirve la portada con firma válida (Meta la baja de aquí).
async function handlePublicPortada(request, env, archivo) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  if (!/^[\w-]+\.jpg$/.test(archivo)) return new Response('No', { status: 400 });
  const f = new URL(request.url).searchParams.get('f') || '';
  const esperada = await firmaEntregable(env, `portada-${archivo}`);
  if (!f || f !== esperada) return new Response('Enlace no válido', { status: 403 });
  const o = await env.R2_BUCKET.get(`marketing/portada/${archivo.replace(/\.jpg$/, '')}.jpg`);
  if (!o) return new Response('Sin portada', { status: 404 });
  return new Response(o.body, { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
}

// Los SLIDES publicables de una pieza carrusel: JPEGs en R2 bajo
// marketing/carrusel/<postId>/N.jpg, servidos con firma HMAC (misma del PDF)
// para que Meta pueda bajarlos. Devuelve URLs firmadas en orden, o [].
async function slidesFirmadosDePieza(env, post) {
  if (!env.R2_BUCKET) return [];
  const lista = await env.R2_BUCKET.list({ prefix: `marketing/carrusel/${post.id}/` });
  const keys = (lista.objects || []).map((o) => o.key)
    .filter((k) => /\.jpe?g$/i.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!keys.length) return [];
  const urls = [];
  for (const k of keys.slice(0, 10)) {
    const n = k.split('/').pop();
    const f = await firmaEntregable(env, `carrusel-${post.id}-${n}`);
    urls.push(`https://ivaestudios.com/api/marketing/publico/carrusel/${post.id}/${n}?f=${f}`);
  }
  return urls;
}

// Sirve UN slide de carrusel con firma válida — sin sesión, solo inline.
async function handlePublicCarouselSlide(request, env, postId, archivo) {
  if (!env.R2_BUCKET) return new Response('Almacenamiento no disponible', { status: 503 });
  if (!/^[\w.-]+\.jpe?g$/i.test(archivo) || !/^[\w-]+$/.test(postId)) return new Response('No', { status: 400 });
  const f = new URL(request.url).searchParams.get('f') || '';
  const esperada = await firmaEntregable(env, `carrusel-${postId}-${archivo}`);
  if (!f || f !== esperada) return new Response('Enlace no válido', { status: 403 });
  const o = await env.R2_BUCKET.get(`marketing/carrusel/${postId}/${archivo}`);
  if (!o) return new Response('Sin imagen', { status: 404 });
  return new Response(o.body, { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
}

// El video PUBLICABLE de una pieza: PRIMERO el ENTREGABLE enlazado (post_id,
// URL pública FIRMADA que Meta sí puede bajar; el más reciente si hay varios)
// y solo de respaldo el video_url pegado a mano — que suele ser un enlace
// privado (Drive, dashboard) que los servidores de Meta NO pueden abrir
// (auditoría 2026-08-16: antes video_url le ganaba al entregable).
async function videoFirmadoDePieza(env, post) {
  const d = await env.DB.prepare(
    'SELECT id FROM mkt_deliverables WHERE post_id = ? AND video_ext IS NOT NULL ORDER BY updated_at DESC LIMIT 1'
  ).bind(post.id).first();
  if (d) {
    const f = await firmaEntregable(env, d.id);
    return `https://ivaestudios.com/api/marketing/publico/entregable/${d.id}/video?f=${f}`;
  }
  return post.video_url || null;
}

// ── EL PROGRAMADOR ───────────────────────────────────────────────────────────
// Publica las piezas en status 'programado' cuya fecha/hora local de Cancún ya
// llegó. Corre desde DOS relojes: el cron de GitHub cada 15 min (garantía) y
// el lazySweep cada vez que alguien usa la app (inmediatez). Máximo 3 piezas
// por corrida: los reels tardan en procesar y el Worker tiene presupuesto.
// LA RECONCILIACIÓN (post-incidente 2026-08-16): media_publish de Meta puede
// responder "unexpected error" Y AUN ASÍ publicar. Antes de publicar (y tras
// cualquier error) se busca en el feed real si la pieza YA está: caption
// igual (primeros 60 chars) + fecha >= la programada. Si está, se adopta ese
// media id en lugar de volver a publicar — el bug que duplicó el reel 4 veces.
async function buscarYaPublicado(env, post) {
  try {
    const cap = String(post.caption || '').trim().slice(0, 60);
    if (!cap || !post.ig_user_id || !post.ig_access_token) return null;
    const res = await fetch(`https://graph.instagram.com/v23.0/${post.ig_user_id}/media?fields=id,caption,permalink,timestamp&limit=20&access_token=${encodeURIComponent(post.ig_access_token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.data)) return null;
    const desde = `${post.publish_date}T00:00:00`;
    const m = data.data.find((x) => String(x.caption || '').trim().startsWith(cap) && String(x.timestamp || '') >= desde);
    return m ? { mediaId: m.id, permalink: m.permalink || null } : null;
  } catch { return null; }
}

// EL VIGILANTE DEL RELOJ (post-incidente): el cron de GitHub (independiente
// de Cloudflare) revisa que el worker-reloj haya tocado hace <30 min; si el
// tic-tac murió, los admins reciben el aviso — máx 1 vez cada 6 horas.
async function vigilarReloj(env) {
  try {
    const kv = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'tick_at'").first();
    const ultimo = kv && kv.value ? Date.parse(kv.value) : 0;
    if (ultimo && (Date.now() - ultimo) < 30 * 60 * 1000) return;
    const aviso = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'tick_alerta_at'").first();
    if (aviso && aviso.value && (Date.now() - Date.parse(aviso.value)) < 6 * 3600 * 1000) return;
    await env.DB.prepare("INSERT INTO mkt_kv (key, value) VALUES ('tick_alerta_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(new Date().toISOString()).run();
    const admins = await env.DB.prepare("SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1").all();
    await notify(env, {
      user_ids: (admins.results || []).map((u) => u.id),
      type: 'reloj_caido', actor_name: 'Programador IVAE',
      body: `🚨 El reloj de la nube no ha tocado desde hace ${ultimo ? Math.round((Date.now() - ultimo) / 60000) + ' min' : 'nunca'} — las publicaciones programadas dependen de él. Revisar el worker ivae-marketing-reloj.`,
      link: '#/calendario',
    });
  } catch { /* el vigilante jamás tumba nada */ }
}

async function publicarPendientes(env) {
  const { fecha, hora } = ahoraCancun();
  // Rescate: una pieza que quedó en 'publicando' >10 min es un candado
  // huérfano (worker muerto a media faena) — vuelve a la fila.
  await env.DB.prepare(
    `UPDATE mkt_posts SET status = 'programado', updated_at = datetime('now')
     WHERE status = 'publicando' AND published_media_id IS NULL
       AND updated_at < datetime('now', '-10 minutes')`
  ).run();
  const due = await env.DB.prepare(
    `SELECT p.*, c.name AS client_name, c.ig_user_id, c.ig_username, c.ig_access_token
     FROM mkt_posts p JOIN mkt_clients c ON c.id = p.client_id
     WHERE p.status = 'programado' AND p.published_media_id IS NULL
       AND COALESCE(p.approval_state, '') != 'changes_requested'
       AND COALESCE(p.publish_attempts, 0) < 5
       AND p.publish_time IS NOT NULL AND p.publish_time != ''
       AND p.publish_date IS NOT NULL AND p.publish_date != ''
       AND (p.publish_date < ? OR (p.publish_date = ? AND p.publish_time <= ?))
     ORDER BY p.publish_date, p.publish_time LIMIT 6`
  ).bind(fecha, fecha, hora).all();
  const resultados = [];
  for (const post of (due.results || [])) {
    const sesionSistema = { user_id: null, name: 'Programador IVAE' };
    // EL CANDADO (auditoría 2026-08-16): reclamar la pieza ANTES de hablar
    // con Instagram. Hay hasta 3 relojes concurrentes (worker */10, GitHub
    // */15, y el uso normal de la app) y un reel tarda ~30-120s procesando —
    // sin esto la MISMA pieza podía publicarse dos veces.
    const claim = await env.DB.prepare(
      "UPDATE mkt_posts SET status = 'publicando', updated_at = datetime('now') WHERE id = ? AND status = 'programado'"
    ).bind(post.id).run();
    if (!claim || !claim.meta || claim.meta.changes !== 1) continue;   // otro reloj la tiene
    try {
      // ¿Ya está en el perfil? (un ciclo anterior pudo publicar aunque Meta dijera error)
      let r = await buscarYaPublicado(env, post);
      let reconciliada = !!r;
      if (!r) {
        const videoUrl = await videoFirmadoDePieza(env, post);
        const slides = await slidesFirmadosDePieza(env, post);
        const cover = await portadaFirmadaDePieza(env, post);
        try {
          r = await publicarEnInstagram(env, { client: post, post: { ...post, video_url: videoUrl }, slides, cover });
        } catch (ePub) {
          // Meta a veces publica Y responde error: esperar y mirar el feed real.
          await new Promise((res) => setTimeout(res, 8000));
          const yaEsta = await buscarYaPublicado(env, post);
          if (!yaEsta) throw ePub;
          r = yaEsta; reconciliada = true;
        }
      }
      await env.DB.prepare(
        `UPDATE mkt_posts SET status = 'publicado', published_media_id = ?, published_at = datetime('now'),
         publish_error = NULL, updated_at = datetime('now') WHERE id = ?`
      ).bind(r.mediaId, post.id).run();
      await logActivity(env, {
        client_id: post.client_id, post_id: post.id, session: sesionSistema,
        action: reconciliada ? 'post.reconciliado' : 'post.publicado', detail: r.permalink || `@${post.ig_username || ''}`,
      });
      if (reconciliada) {
        const admins = await env.DB.prepare("SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1").all();
        await notify(env, {
          user_ids: (admins.results || []).map((u) => u.id),
          type: 'publicador_reconciliado', post_id: post.id, client_id: post.client_id,
          actor_name: 'Programador IVAE',
          body: `🛡️ ${post.title}: ya estaba publicada en Instagram — se adoptó SIN duplicar (Meta reportó error falso).`,
          link: '#/post/' + post.id,
        });
      }
      resultados.push({ id: post.id, ok: true, permalink: r.permalink });
    } catch (e) {
      const intentos = (Number(post.publish_attempts) || 0) + 1;
      const msg = ((intentos >= 5 ? 'DETENIDO tras 5 intentos — revisar a mano: ' : '') +
        ((e && e.message) || 'Error desconocido')).slice(0, 300);
      await env.DB.prepare(
        `UPDATE mkt_posts SET status = 'programado', publish_attempts = ?, publish_error = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(intentos, msg, post.id).run();
      // ALARMA (post-incidente 16-ago): los admins se enteran AL MINUTO,
      // no cuando lo vean en el perfil.
      const admins = await env.DB.prepare("SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1").all();
      await notify(env, {
        user_ids: (admins.results || []).map((u) => u.id),
        type: 'publicador_error', post_id: post.id, client_id: post.client_id,
        actor_name: 'Programador IVAE',
        body: `⚠️ Publicación fallida (intento ${intentos}/5) — ${post.title}: ${msg.slice(0, 140)}`,
        link: '#/post/' + post.id,
      });
      await logActivity(env, {
        client_id: post.client_id, post_id: post.id, session: sesionSistema,
        action: 'post.publicar_error', detail: msg,
      });
      resultados.push({ id: post.id, ok: false, error: msg });
    }
  }
  return resultados;
}

async function handleCronPublicar(request, env) {
  if (!env.MKT_CRON_SECRET) return json({ error: 'Cron no configurado' }, 503);
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.MKT_CRON_SECRET}`) return json({ error: 'No autorizado' }, 401);
  try {
    await vigilarReloj(env);
    const resultados = await publicarPendientes(env);
    return json({ ok: true, procesadas: resultados.length, resultados });
  } catch (e) {
    return json({ error: (e && e.message) || 'Fallo del publicador' }, 500);
  }
}

// PUBLICAR AHORA (staff): la misma máquina del cron, para una pieza concreta,
// sin esperar el reloj — y la forma de probar la tubería pieza por pieza.
async function handlePublicarPieza(env, postId, session) {
  const post = await env.DB.prepare(
    `SELECT p.*, c.name AS client_name, c.ig_user_id, c.ig_username, c.ig_access_token
     FROM mkt_posts p JOIN mkt_clients c ON c.id = p.client_id WHERE p.id = ?`
  ).bind(postId).first();
  if (!post) return json({ error: 'Pieza no encontrada' }, 404);
  if (post.published_media_id) return json({ error: 'Esta pieza ya se publicó.' }, 409);
  try {
    const videoUrl = await videoFirmadoDePieza(env, post);
    const slides = await slidesFirmadosDePieza(env, post);
    const cover = await portadaFirmadaDePieza(env, post);
    const r = await publicarEnInstagram(env, { client: post, post: { ...post, video_url: videoUrl }, slides, cover });
    await env.DB.prepare(
      `UPDATE mkt_posts SET status = 'publicado', published_media_id = ?, published_at = datetime('now'),
       publish_error = NULL, updated_at = datetime('now') WHERE id = ?`
    ).bind(r.mediaId, post.id).run();
    await logActivity(env, { client_id: post.client_id, post_id: post.id, session, action: 'post.publicado', detail: r.permalink || '' });
    return json({ ok: true, media_id: r.mediaId, permalink: r.permalink });
  } catch (e) {
    const msg = ((e && e.message) || 'Error desconocido').slice(0, 300);
    await env.DB.prepare(`UPDATE mkt_posts SET publish_error = ?, updated_at = datetime('now') WHERE id = ?`).bind(msg, post.id).run();
    await logActivity(env, { client_id: post.client_id, post_id: post.id, session, action: 'post.publicar_error', detail: msg });
    // OJO: 422 y NO 5xx (Cloudflare pisa los 5xx con su página).
    return json({ error: msg }, 422);
  }
}

// GENERAR MES CON IA: junta el contexto real de la marca en D1 (su voz = sus
// últimas piezas; su mezcla de tipos; los días ya ocupados del mes), se lo da
// al estratega (_mes-ia.js) y siembra las piezas devueltas como borradores
// internos. La IA propone, el equipo revisa — nada le llega al cliente solo.
async function handleGenerarMes(request, env, session) {
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const clientId = String((b && b.client_id) || '').trim();
  const month = String((b && b.month) || '').trim();
  const brief = String((b && b.brief) || '').trim().slice(0, 600);
  const n = Math.max(1, Math.min(20, Number(b && b.n) || 10));
  if (!clientId) return json({ error: 'Falta el cliente.' }, 400);
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'Mes inválido (YYYY-MM).' }, 400);

  const cliente = await env.DB.prepare('SELECT id, name FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!cliente) return json({ error: 'Cliente no encontrado.' }, 404);

  // La VOZ: sus últimas piezas con contenido real (título/gancho/caption).
  const voz = await env.DB.prepare(
    `SELECT content_type, title, hook, caption FROM mkt_posts
     WHERE client_id = ? AND COALESCE(caption, '') != ''
     ORDER BY publish_date DESC LIMIT 18`
  ).bind(clientId).all();
  const ejemplos = (voz.results || []).map((p) =>
    `· ${p.content_type || 'reel'} | ${(p.title || '').slice(0, 60)} | ${(p.hook || '').slice(0, 90)} | ${(p.caption || '').replace(/\s+/g, ' ').slice(0, 220)}`
  ).join('\n') || '(marca nueva: sin piezas previas — usa un tono profesional cálido, cercano y local)';

  // La MEZCLA típica (últimos 3 meses) para que el plan respete su ritmo.
  const mezclaRows = await env.DB.prepare(
    `SELECT lower(COALESCE(content_type, 'reel')) t, COUNT(*) n FROM mkt_posts
     WHERE client_id = ? AND publish_date >= date('now', '-90 days')
     GROUP BY t ORDER BY n DESC`
  ).bind(clientId).all();
  const mezcla = (mezclaRows.results || []).map((r) => `${r.t}: ${r.n}`).join(', ')
    || '60% reel, 30% carrusel, 10% post';

  // Días del mes ya ocupados: la IA no debe encimarse con lo planeado.
  const mesRows = await env.DB.prepare(
    `SELECT publish_date FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ?`
  ).bind(clientId, `${month}-%`).all();
  const ocupados = [...new Set((mesRows.results || [])
    .map((r) => Number(String(r.publish_date).slice(8, 10)))
    .filter(Boolean))].sort((a, b) => a - b);

  let piezas;
  try {
    piezas = await pedirMes(env, { marca: cliente.name, month, n, brief, ejemplos, mezcla, ocupados });
  } catch (e) {
    // OJO: 422 y NO 5xx (Cloudflare pisa los 5xx con su página de error).
    return json({ error: (e && e.message) || 'La IA no respondió.' }, 422);
  }

  const creadas = [];
  for (const p of piezas) {
    const id = randomId();
    await env.DB.prepare(
      `INSERT INTO mkt_posts (id, client_id, created_by, title, status, approval_state,
        client_visible, publish_date, content_type, hook, body, cta, caption, hashtags)
       VALUES (?, ?, ?, ?, 'guion', 'pending', 0, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, clientId, session.user_id, p.title, p.publish_date, p.content_type,
      p.hook, p.body, p.cta, p.caption, p.hashtags).run();
    const created = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(id).first();
    creadas.push(created);
    await logActivity(env, { client_id: clientId, post_id: id, session, action: 'post.create', detail: `${p.title} (mes IA)` });
  }
  return json({ ok: true, creadas: creadas.length, posts: creadas });
}

// Busca fotos en Pinterest por texto, o cosecha las imágenes de un pin si lo
// que llega es un link. El Estudio pinta la cuadrícula con los thumbs directos
// de pinimg (el CSP de /marketing/* permite img-src https:).
async function handlePinterestFotos(request) {
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const q = String((b && b.q) || '').trim();
  if (!q) return json({ error: 'Escribe qué buscar o pega el link de un pin.' }, 400);
  try {
    let fotos;
    if (/^https?:\/\//i.test(q)) {
      if (detectPlatform(q) !== 'pinterest') return json({ error: 'Ese link no es de Pinterest.' }, 400);
      fotos = await fotosDePin(q);
    } else {
      fotos = await buscarPinterest(q);
    }
    // OJO: 422 y NO 5xx en errores (Cloudflare pisa los 5xx con su página).
    return json({ ok: true, fotos: fotos.slice(0, 40) });
  } catch (e) {
    return json({ error: (e && e.message) || 'Pinterest no respondió.' }, 422);
  }
}

// ── DESCARGAR handlers ───────────────────────────────────────────────────────
// Resuelve un link a metadata (para la tarjeta de vista previa). NO descarga.
async function handleResolveDownload(request, env) {
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
  const src = String((b && b.url) || '').trim();
  if (!detectPlatform(src)) return json({ error: 'Pega un link de Instagram, TikTok o Pinterest.' }, 400);
  try {
    const info = await resolveVideo(src, env);
    const list = info.items && info.items.length ? info.items : [{ url: info.mediaUrl, type: info.type || 'video', ext: info.ext || 'mp4' }];
    const base = String(info.title || info.platform || 'media').replace(/[\r\n]+/g, ' ').replace(/[^\wÀ-ſ .-]+/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || info.platform;
    const items = list.map((it, i) => ({
      url: it.url,
      type: it.type || 'video',
      ext: it.ext || (it.type === 'image' ? 'jpg' : 'mp4'),
      filename: `${info.platform}-${base}${list.length > 1 ? '-' + (i + 1) : ''}.${it.ext || (it.type === 'image' ? 'jpg' : 'mp4')}`,
    }));
    return json({
      ok: true,
      platform: info.platform,
      title: info.title,
      thumbnail: info.thumbnail,
      width: info.width,
      height: info.height,
      durationSec: info.durationSec,
      type: items[0].type,
      ext: items[0].ext,
      filename: items[0].filename,
      mediaUrl: info.mediaUrl, // el front lo pasa a /file para NO re-resolver
      items, // video/imagen/carrusel
    });
  } catch (e) {
    // OJO: 422 y NO 5xx — Cloudflare reemplaza las respuestas 502/504 de la
    // Function con su propia página de error y se pierde este mensaje JSON.
    return json({ error: (e && e.message) || 'No se pudo extraer el video.' }, 422);
  }
}

// TRANSMITE los bytes del video al navegador como descarga. Recibe la mediaUrl ya
// resuelta (m) desde el paso de resolve para NO re-resolver (evita el doble hit a
// tikwm + el cuelgue del scrape en la IP de CF que causaba 502). Fallback: si no
// viene m (front viejo), re-resuelve desde u. Anti-SSRF: solo hosts de CDN.
async function handleDownloadFile(request, env) {
  const q = new URL(request.url).searchParams;
  let mediaUrl = q.get('m') || '';
  let platform = q.get('p') || '';
  let filename = q.get('n') || 'video.mp4';
  if (!mediaUrl) {
    const src = q.get('u') || '';
    if (!detectPlatform(src)) return new Response('Link no soportado', { status: 400 });
    try {
      const info = await resolveVideo(src, env);
      mediaUrl = info.mediaUrl; platform = info.platform; filename = suggestName(info);
    } catch (e) {
      return json({ error: 'No se pudo extraer: ' + ((e && e.message) || '') }, 422);
    }
  }
  if (!mediaUrl || !isAllowedMediaHost(mediaUrl)) {
    return json({ error: 'Origen del video no permitido' }, 422);
  }
  let upstream = null;
  try { upstream = await fetch(mediaUrl, { headers: mediaHeadersFor(platform) }); } catch { upstream = null; }
  if (!upstream || !upstream.ok || !upstream.body) {
    return json({ error: 'El CDN rechazó la descarga (el link pudo expirar). Vuelve a buscar el video.' }, 422);
  }
  const safe = String(filename).replace(/[\r\n"]+/g, '').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'video.mp4';
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  headers.set('Content-Disposition', `attachment; filename="${safe}"`);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(upstream.body, { status: 200, headers });
}

// ── Pages Functions entry point ──
// Strips the /api/marketing prefix, then routes. Wrapped so any unexpected
// error becomes a clean 500 JSON instead of a runtime crash.
export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    let stripped = url.pathname;
    if (stripped.startsWith('/api/marketing/')) {
      stripped = '/' + stripped.slice('/api/marketing/'.length);
    } else if (stripped === '/api/marketing') {
      stripped = '/';
    }
    const rewrittenUrl = url.origin + stripped + url.search;
    const rewrittenReq = new Request(rewrittenUrl, request);
    // authCtx recoge la cookie renovada (sliding session) que produce getSession.
    const authCtx = {};
    const res = await route(rewrittenReq, env, authCtx);
    if (authCtx.setCookie && res) {
      try {
        // Si la respuesta YA toca mkt_session (logout, cambio de contraseña,
        // borrado de cuenta), esa gana: no le pegamos encima la renovación.
        const already = res.headers.get('Set-Cookie') || '';
        if (already.includes('mkt_session=')) return res;
        const out = new Response(res.body, res);
        out.headers.append('Set-Cookie', authCtx.setCookie);
        return out;
      } catch { return res; } // p.ej. respuestas inmutables — mejor sin renovar que romper
    }
    return res;
  } catch (e) {
    // Registro best-effort en mkt_error_log (migración 017). Silencioso:
    // el log NUNCA debe romper (ni cambiar) la respuesta 500.
    try {
      let userId = null;
      try {
        const s = await getSession(request, env);
        userId = s ? s.user_id : null;
      } catch { /* sin sesión legible — se registra sin user_id */ }
      await env.DB.prepare(
        'INSERT INTO mkt_error_log (id, route, method, message, user_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        randomId(),
        new URL(request.url).pathname,
        request.method,
        String((e && e.message) || e || 'unknown').slice(0, 500),
        userId
      ).run();
    } catch { /* tabla ausente o BD caída — se ignora */ }
    return json({ error: 'Internal error: ' + (e && e.message ? e.message : 'unknown') }, 500);
  }
}
