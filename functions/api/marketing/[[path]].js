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
//   SESSION_EXPIRY_SECONDS  → session lifetime (default '604800' = 7 days).
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
import { handleMonthlyReport } from './_enterprise.js';

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

// Read the mkt_session cookie, JOIN sessions+users, return the live session row
// or null. Only returns if the session is unexpired AND the user is active=1.
async function getSession(request, env) {
  const token = getCookie(request, 'mkt_session');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, u.email, u.name, u.role, u.client_id
       FROM mkt_sessions s
       JOIN mkt_users u ON s.user_id = u.id
      WHERE s.id = ?
        AND s.expires_at > datetime('now')
        AND u.active = 1`
  ).bind(token).first();
  return row || null;
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
  'title', 'content_type', 'grabacion', 'publish_date', 'assignee', 'platform',
  'status', 'caption', 'inspo_url', 'video_url', 'hook', 'body', 'cta',
  'hashtags', 'notes_team', 'client_visible', 'priority'
];

// Fields returned in a post object (per spec). `notes_people` is a JSON column
// shaped separately (parsed to an object) in shapePost.
const POST_RETURN_FIELDS = [
  'id', 'client_id', 'title', 'content_type', 'grabacion', 'publish_date',
  'assignee', 'platform', 'status', 'caption', 'inspo_url', 'video_url',
  'hook', 'body', 'cta', 'hashtags', 'notes_team', 'client_visible',
  'approval_state', 'position', 'created_at', 'updated_at'
];

// V2 columns (migration 005). Added to the staff shape ONLY when the column
// exists in the row (pre-005 rows simply omit them: clean degradation).
// `overdue` is server-managed: NEVER editable over HTTP.
const POST_V2_FIELDS = ['priority', 'assignee_user_id', 'overdue', 'work_start', 'effort_points'];

const CONTENT_TYPES = ['reel', 'tiktok', 'informativo', 'carrusel', 'experiencia', 'pauta', 'tratamientos', 'historia', 'foto'];
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
  'caption', 'hook', 'body', 'cta', 'hashtags', 'video_url', 'client_visible',
  'approval_state', 'position', 'created_at', 'updated_at'
];
function publicPost(post) {
  if (!post) return post;
  const out = {};
  for (const f of CLIENT_VISIBLE_FIELDS) out[f] = post[f];
  return out;
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
  const expiry = env.SESSION_EXPIRY_SECONDS || '604800';
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

  const user = await env.DB.prepare('SELECT * FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (!user) return json({ error: 'Credenciales incorrectas.' }, 401);
  if (!user.active) return json({ error: 'Esta cuenta está desactivada.' }, 403);
  if (!user.password) return json({ error: 'Credenciales incorrectas.' }, 401);

  const valid = await verifyPassword(password, user.password);
  if (!valid) return json({ error: 'Credenciales incorrectas.' }, 401);

  const sessionId = randomId();
  const expiry = env.SESSION_EXPIRY_SECONDS || '604800';
  await env.DB.prepare(
    'INSERT INTO mkt_sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))'
  ).bind(sessionId, user.id, expiry).run();
  await env.DB.prepare("UPDATE mkt_users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

  return json(
    { id: user.id, email: user.email, name: user.name, role: user.role, client_id: user.client_id, must_reset: user.must_reset === 1 },
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

async function handleMe(session) {
  if (!session) return json({ error: 'Not authenticated' }, 401);
  return json({
    id: session.user_id,
    email: session.email,
    name: session.name,
    role: session.role,
    client_id: session.client_id
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
  await logActivity(env, { session, action: 'user.change_password', detail: session.email });
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
  const res = await env.DB.prepare('SELECT * FROM mkt_clients ORDER BY archived ASC, name COLLATE NOCASE ASC').all();
  const rows = res.results || [];
  const out = [];
  for (const c of rows) out.push(shapeClient(c, await clientCounts(env, c.id)));
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
  const allowed = ['name', 'brand_color', 'logo_url', 'instagram_handle', 'timezone', 'notes', 'archived', 'contact_email', 'reminders_enabled'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, f)) {
      sets.push(`${f} = ?`);
      vals.push(f === 'archived' || f === 'reminders_enabled' ? (bodyObj[f] ? 1 : 0) : bodyObj[f]);
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
  await logActivity(env, { client_id: clientId, session, action: 'client.archive' });
  return json({ ok: true, archived: 1 });
}

// ============================================================================
// USERS (team + client logins) — admin/team only
// ============================================================================

function shapeUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    client_id: u.client_id,
    active: u.active,
    last_login: u.last_login
  };
}

async function handleListUsers(env) {
  const res = await env.DB.prepare(
    'SELECT id, email, name, role, client_id, active, last_login FROM mkt_users ORDER BY role ASC, name COLLATE NOCASE ASC'
  ).all();
  return json((res.results || []).map(shapeUser));
}

async function handleCreateUser(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { name, email, role, client_id, password } = bodyObj || {};
  if (!name || !email || !role) return json({ error: 'Name, email and role required' }, 400);
  if (role !== 'team' && role !== 'client') return json({ error: "role must be 'team' or 'client'" }, 400);
  if (role === 'client') {
    if (!client_id) return json({ error: 'client_id required for a client login' }, 400);
    const c = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(client_id).first();
    if (!c) return json({ error: 'client_id does not exist' }, 400);
  }

  const dup = await env.DB.prepare('SELECT id FROM mkt_users WHERE email = ? COLLATE NOCASE').bind(email).first();
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
  ).bind(id, email, hash, name, role, role === 'client' ? client_id : null, mustReset).run();

  await logActivity(env, {
    client_id: role === 'client' ? client_id : null,
    session,
    action: 'user.create',
    detail: `${role}:${email}`
  });

  const created = await env.DB.prepare(
    'SELECT id, email, name, role, client_id, active, last_login FROM mkt_users WHERE id = ?'
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
  const sets = [];
  const vals = [];
  if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'name')) { sets.push('name = ?'); vals.push(bodyObj.name); }
  if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'active')) { sets.push('active = ?'); vals.push(bodyObj.active ? 1 : 0); }
  if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'role')) {
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

  const updated = await env.DB.prepare(
    'SELECT id, email, name, role, client_id, active, last_login FROM mkt_users WHERE id = ?'
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
//     Users with role client receive NO notifications in v1.
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
// excluding the actor. Clients never receive notifications in v1.
async function staffFanout(env, post, excludeUserId) {
  const res = await env.DB.prepare(
    "SELECT id FROM mkt_users WHERE role = 'admin' AND active = 1"
  ).all();
  const ids = (res.results || []).map((r) => r.id);
  if (post && post.assignee_user_id) ids.push(post.assignee_user_id);
  return [...new Set(ids)].filter((id) => id && id !== excludeUserId);
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
    if (!recipeOn(autos, 'aprobado_mueve_estado')) return;
    if (STATUS_ORDER[post.status] != null && STATUS_ORDER[post.status] < STATUS_ORDER['aprobado']) {
      await env.DB.prepare(
        "UPDATE mkt_posts SET status = 'aprobado', updated_at = datetime('now') WHERE id = ?"
      ).bind(post.id).run();
      await logActivity(env, {
        client_id: post.client_id, post_id: post.id, session,
        action: 'automation.run', detail: `aprobado_mueve_estado:${post.status}->aprobado`
      });
    }
    await notify(env, {
      user_ids: recipients, type: 'aprobacion',
      body: `${session.name} aprobó ${post.title}`,
      link, post_id: post.id, client_id: post.client_id, actor_name: session.name
    });
  } else {
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

  // ── Comment fan-out (gated by the aviso_comentario recipe) ──
  if (!recipeOn(autos, 'aviso_comentario')) return;
  let recipients;
  if (session.role === 'client') {
    // Client commented → admins + assignee + staff already in the thread.
    recipients = await staffFanout(env, post, session.user_id);
    recipients = recipients.concat(await threadParticipants(env, post.id));
  } else {
    // Staff commented → staff thread participants + assignee (NEVER clients).
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

  const v2 = await buildV2PostColumns(env, bodyObj);
  if (v2.error) return v2.error;

  const id = randomId();
  // Build the column list from POST_EDITABLE_FIELDS that were supplied.
  const cols = ['id', 'client_id', 'created_by'];
  const placeholders = ['?', '?', '?'];
  const vals = [id, clientId, session.user_id];
  for (const f of POST_EDITABLE_FIELDS) {
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
  return json(shapePost(created), 201);
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

  const approvalsRes = await env.DB.prepare(
    'SELECT id, post_id, actor_name, decision, comment, created_at FROM mkt_approvals WHERE post_id = ? ORDER BY created_at ASC'
  ).bind(postId).all();

  const payload = {
    post: shapePost(post),
    comments: commentsRes.results || [],
    approvals: approvalsRes.results || []
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
    return json({ error: 'Conflicto: el contenido cambio mientras editabas.', post: shapePost(post) }, 409);
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

  const v2 = await buildV2PostColumns(env, bodyObj);
  if (v2.error) return v2.error;

  const sets = [];
  const vals = [];
  for (const f of POST_EDITABLE_FIELDS) {
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
  // notes_people is INTERNAL (team/admin only, already gated above) + JSON column.
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

  return json(shapePost(updated));
}

async function handleDeletePost(env, session, postId) {
  const post = await env.DB.prepare('SELECT id, client_id, title FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  // Aislamiento: el cliente solo borra posts de SU marca.
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
  for (const u of updates) {
    if (!u || !u.id) return json({ error: 'Each update needs an id' }, 400);
    if (u.status != null && !STATUSES.includes(u.status)) return json({ error: `Invalid status: ${u.status}` }, 400);
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
    'inspo_url', 'video_url', 'hashtags', 'notes_team', 'client_visible', 'notes_people'];
  for (const f of copyCols) {
    if (source[f] !== undefined) { cols.push(f); vals.push(source[f]); }
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

async function handleActivity(request, env, session, url) {
  const clientId = url.searchParams.get('client_id');
  const postId = url.searchParams.get('post_id');
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const where = [];
  const vals = [];
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
    return json({
      ok: true,
      ran: (result && result.ran) || [],
      pruned: (result && result.pruned) || { notifications: 0, runs: 0, sessions: 0 }
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
const MKT_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // ~100 MB (limite practico del Worker)

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
  if (!ext) return json({ error: 'Formato no soportado. Usa MP4, MOV o WebM.' }, 415);
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
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return new Response('Forbidden', { status: 403 });

  const rangeOpt = request.headers.get('Range') ? { range: request.headers } : undefined;
  let obj = null;
  for (const e of MKT_VIDEO_EXTS) {
    obj = await env.R2_BUCKET.get(`marketing/video/${postId}.${e}`, rangeOpt);
    if (obj) break;
  }
  if (!obj) return new Response('Sin video', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Disposition', 'inline');
  if (obj.range && Object.prototype.hasOwnProperty.call(obj.range, 'offset')) {
    const offset = obj.range.offset || 0;
    const len = (obj.range.length != null) ? obj.range.length : (obj.size - offset);
    headers.set('Content-Range', `bytes ${offset}-${offset + len - 1}/${obj.size}`);
    headers.set('Content-Length', String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

async function handleDeleteVideo(env, session, postId) {
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);
  const { error } = await mktPostForVideo(env, session, postId);
  if (error) return error;
  for (const e of MKT_VIDEO_EXTS) { try { await env.R2_BUCKET.delete(`marketing/video/${postId}.${e}`); } catch {} }
  await env.DB.prepare("UPDATE mkt_posts SET video_url = NULL, updated_at = datetime('now') WHERE id = ?").bind(postId).run();
  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json(shapePost(updated), 200);
}

// Main router. `path` is the URL pathname AFTER the /api/marketing prefix has
// been stripped (e.g. '/auth/login', '/posts/abc/approve').
// Route discipline: LITERAL routes always sit before :id matchers (post ids
// are 32-hex, so 'bulk-update' / 'reorder' / 'unread-count' can never collide).
async function route(request, env) {
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

  // ── CRON (no session; Bearer MKT_CRON_SECRET) — BEFORE the session gate ──
  if (path === '/cron' && method === 'POST') return handleCron(request, env);

  // Everything else needs a valid session.
  const session = await getSession(request, env);

  if (path === '/auth/logout' && method === 'POST') return handleLogout(request, env, session);
  if (path === '/auth/me' && method === 'GET') return handleMe(session);

  if (!session) return json({ error: 'Not authenticated' }, 401);

  if (path === '/auth/change-password' && method === 'POST') return handleChangePassword(request, env, session);

  const isStaff = session.role === 'admin' || session.role === 'team';

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
      // Editar / borrar: staff o cliente (el handler verifica la marca del post).
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
        if (method === 'GET') return handleServeVideo(request, env, session, postId);
        if (method === 'DELETE') return handleDeleteVideo(env, session, postId);
        return json({ error: 'Method not allowed' }, 405);
      }
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

  // ── EXPORTAR CALENDARIO .ics (staff o cliente; el cliente va forzado a SU marca) ──
  // Reporte mensual del cliente (HTML imprimible; cliente forzado a su marca).
  if (path === '/report' && method === 'GET') {
    return handleMonthlyReport(request, env, session, url);
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

  // ── ACTIVITY (admin/team only) ──
  if (parts[0] === 'activity' && parts.length === 1 && method === 'GET') {
    if (!isStaff) return json({ error: 'Forbidden' }, 403);
    return handleActivity(request, env, session, url);
  }

  return json({ error: 'Not found' }, 404);
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
    return await route(rewrittenReq, env);
  } catch (e) {
    return json({ error: 'Internal error: ' + (e && e.message ? e.message : 'unknown') }, 500);
  }
}
