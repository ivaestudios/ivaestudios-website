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
//            clients, notes_team, or internal comments. Scope is ALWAYS derived
//            from the session user, never from a client-supplied ?client_id.

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
// by the server.
const POST_EDITABLE_FIELDS = [
  'title', 'content_type', 'grabacion', 'publish_date', 'assignee', 'platform',
  'status', 'caption', 'inspo_url', 'video_url', 'hook', 'body', 'cta',
  'hashtags', 'notes_team', 'client_visible'
];

// Fields returned in a post object (per spec).
const POST_RETURN_FIELDS = [
  'id', 'client_id', 'title', 'content_type', 'grabacion', 'publish_date',
  'assignee', 'platform', 'status', 'caption', 'inspo_url', 'video_url',
  'hook', 'body', 'cta', 'hashtags', 'notes_team', 'client_visible',
  'approval_state', 'position', 'created_at', 'updated_at'
];

const CONTENT_TYPES = ['reel', 'tiktok', 'informativo', 'carrusel', 'experiencia', 'pauta', 'tratamientos', 'historia', 'foto'];
const STATUSES = ['idea', 'guion', 'grabacion', 'edicion', 'revision', 'aprobado', 'programado', 'publicado'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn'];

// Strip internal fields from a post for a client viewer.
function publicPost(post) {
  if (!post) return post;
  const out = {};
  for (const f of POST_RETURN_FIELDS) out[f] = post[f];
  delete out.notes_team; // never expose internal notes to a client
  return out;
}

// Shape a full post row into the returned object (team/admin keep everything).
function shapePost(post) {
  const out = {};
  for (const f of POST_RETURN_FIELDS) out[f] = post[f];
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
    archived: c.archived,
    counts: counts || { posts: 0, pending: 0 }
  };
}

async function handleListClients(env, session) {
  // A client sees ONLY their own client object.
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

  const id = randomId();
  const slug = await uniqueSlug(env, name);
  await env.DB.prepare(
    `INSERT INTO mkt_clients (id, name, slug, brand_color, logo_url, instagram_handle, timezone, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, String(name).trim(), slug,
    brand_color || '#7c3aed',
    logo_url || null,
    instagram_handle || null,
    timezone || 'America/Cancun',
    notes || null
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
  const allowed = ['name', 'brand_color', 'logo_url', 'instagram_handle', 'timezone', 'notes', 'archived'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, f)) {
      sets.push(`${f} = ?`);
      vals.push(f === 'archived' ? (bodyObj[f] ? 1 : 0) : bodyObj[f]);
    }
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
  const existing = await env.DB.prepare('SELECT id, email FROM mkt_users WHERE id = ?').bind(userId).first();
  if (!existing) return json({ error: 'User not found' }, 404);
  const pw = generateSimplePassword();
  const hash = await hashPassword(pw);
  await env.DB.prepare("UPDATE mkt_users SET password = ?, must_reset = 1, updated_at = datetime('now') WHERE id = ?")
    .bind(hash, userId).run();
  await logActivity(env, { session, action: 'user.reset_password', detail: existing.email });
  return json({ password: pw });
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

  const where = [];
  const vals = [];
  if (scope.scopedClientId) { where.push('client_id = ?'); vals.push(scope.scopedClientId); }
  if (session.role === 'client') { where.push('client_visible = 1'); }
  if (from) { where.push('publish_date >= ?'); vals.push(from); }
  if (to) { where.push('publish_date <= ?'); vals.push(to); }
  if (status) {
    if (!STATUSES.includes(status)) return json({ error: 'Invalid status filter' }, 400);
    where.push('status = ?'); vals.push(status);
  }

  const sql = `SELECT * FROM mkt_posts${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY position ASC, created_at ASC`;
  const res = await env.DB.prepare(sql).bind(...vals).all();
  const rows = res.results || [];
  const out = rows.map(session.role === 'client' ? publicPost : shapePost);
  return json(out);
}

async function handleCreatePost(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
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
  await env.DB.prepare(
    `INSERT INTO mkt_posts (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`
  ).bind(...vals).run();

  const created = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(id).first();
  await logActivity(env, { client_id: clientId, post_id: id, session, action: 'post.create', detail: created.title });
  return json(shapePost(created), 201);
}

async function handleGetPost(request, env, session, postId) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  // Client isolation: a client may only read their own client's visible posts.
  if (session.role === 'client') {
    if (post.client_id !== session.client_id) return json({ error: 'Forbidden' }, 403);
    if (post.client_visible !== 1) return json({ error: 'Forbidden' }, 403);
  }

  const isClient = session.role === 'client';
  const commentsSql = isClient
    ? 'SELECT id, post_id, author_name, author_role, body, internal, created_at FROM mkt_comments WHERE post_id = ? AND internal = 0 ORDER BY created_at ASC'
    : 'SELECT id, post_id, user_id, author_name, author_role, body, internal, created_at FROM mkt_comments WHERE post_id = ? ORDER BY created_at ASC';
  const commentsRes = await env.DB.prepare(commentsSql).bind(postId).all();

  const approvalsRes = await env.DB.prepare(
    'SELECT id, post_id, actor_name, decision, comment, created_at FROM mkt_approvals WHERE post_id = ? ORDER BY created_at ASC'
  ).bind(postId).all();

  return json({
    post: isClient ? publicPost(post) : shapePost(post),
    comments: commentsRes.results || [],
    approvals: approvalsRes.results || []
  });
}

async function handlePatchPost(request, env, session, postId) {
  // team/admin only — clients get 403 (enforced by router, double-checked here).
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);

  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (bodyObj.content_type != null && !CONTENT_TYPES.includes(bodyObj.content_type)) return json({ error: 'Invalid content_type' }, 400);
  if (bodyObj.status != null && !STATUSES.includes(bodyObj.status)) return json({ error: 'Invalid status' }, 400);
  if (bodyObj.grabacion != null && bodyObj.grabacion !== '' && (Number(bodyObj.grabacion) < 1 || Number(bodyObj.grabacion) > 5)) {
    return json({ error: 'grabacion must be 1..5' }, 400);
  }

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
  if (!sets.length) return json({ error: 'No editable fields supplied' }, 400);
  sets.push("updated_at = datetime('now')");
  vals.push(postId);
  await env.DB.prepare(`UPDATE mkt_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  const action = (bodyObj.status != null && bodyObj.status !== post.status) ? 'status.change' : 'post.update';
  await logActivity(env, { client_id: post.client_id, post_id: postId, session, action, detail: action === 'status.change' ? `${post.status}→${bodyObj.status}` : Object.keys(bodyObj).join(',') });
  return json(shapePost(updated));
}

async function handleDeletePost(env, session, postId) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  const post = await env.DB.prepare('SELECT id, client_id, title FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
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
    if (post.client_visible !== 1) return json({ error: 'Forbidden' }, 403);
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

  const updated = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  return json({ ok: true, approval_state: newState, post: session.role === 'client' ? publicPost(updated) : shapePost(updated) });
}

async function handleAddComment(request, env, session, postId) {
  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);

  if (session.role === 'client') {
    if (post.client_id !== session.client_id) return json({ error: 'Forbidden' }, 403);
    if (post.client_visible !== 1) return json({ error: 'Forbidden' }, 403);
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
  return json(created, 201);
}

// Bulk reorder/move (drag & drop). team/admin only.
async function handleReorder(request, env, session) {
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const updates = bodyObj && bodyObj.updates;
  if (!Array.isArray(updates) || !updates.length) return json({ error: 'updates[] required' }, 400);

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

// ============================================================================
// ACTIVITY — team/admin only
// ============================================================================

async function handleActivity(request, env, session, url) {
  const clientId = url.searchParams.get('client_id');
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const where = [];
  const vals = [];
  if (clientId) { where.push('client_id = ?'); vals.push(clientId); }
  const sql = `SELECT id, client_id, post_id, user_id, actor_name, action, detail, created_at
                 FROM mkt_activity${where.length ? ' WHERE ' + where.join(' AND ') : ''}
                ORDER BY created_at DESC LIMIT ?`;
  vals.push(limit);
  const res = await env.DB.prepare(sql).bind(...vals).all();
  return json(res.results || []);
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

// Main router. `path` is the URL pathname AFTER the /api/marketing prefix has
// been stripped (e.g. '/auth/login', '/posts/abc/approve').
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
    // POST /posts/reorder  (must come before the /posts/:id matcher)
    if (parts.length === 2 && parts[1] === 'reorder' && method === 'POST') {
      return handleReorder(request, env, session);
    }
    if (parts.length === 1) {
      if (method === 'GET') return handleListPosts(request, env, session, url);
      if (method === 'POST') {
        if (!isStaff) return json({ error: 'Forbidden' }, 403);
        return handleCreatePost(request, env, session);
      }
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts.length === 2) {
      const postId = parts[1];
      if (method === 'GET') return handleGetPost(request, env, session, postId);
      if (method === 'PATCH') {
        if (!isStaff) return json({ error: 'Forbidden' }, 403);
        return handlePatchPost(request, env, session, postId);
      }
      if (method === 'DELETE') {
        if (!isStaff) return json({ error: 'Forbidden' }, 403);
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
    }
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
