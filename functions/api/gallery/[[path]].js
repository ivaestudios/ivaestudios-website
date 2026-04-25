// Cloudflare Pages Functions catch-all for the IVAE Gallery API.
// Mounted at /api/gallery/* — internally we strip the prefix and reuse
// the path-matching logic that the standalone Worker used.
//
// All bindings (DB, R2_BUCKET, RESEND_API_KEY, JWT_SECRET, CRON_SECRET,
// ADMIN_EMAIL, SESSION_EXPIRY_SECONDS, DROPBOX_APP_KEY, GOOGLE_DRIVE_*)
// are configured in Cloudflare Pages → Settings → Functions.
//
// Surgical changes vs. ivae-gallery/src/worker.js:
//   1. `export default { fetch, scheduled }` → `async function fetchHandler(...)`
//      (the scheduled cron handler is removed — replaced by GitHub Action).
//   2. New /api/admin/cron-sweep endpoint (bearer-auth) runs the sweeps.
//   3. Email-builder URLs rewritten:
//        https://gallery.ivaestudios.com/...      → https://ivaestudios.com/gallery/...
//        https://gallery.ivaestudios.com/api/...  → https://ivaestudios.com/api/gallery/...
//   4. Pages Functions onRequest entry point at the bottom strips the
//      /api/gallery prefix from the request URL before invoking fetchHandler.

// ============================================================================
// BEGIN: contents of original src/worker.js (with surgical changes — see notes above)
// ============================================================================

// ═══════════════════════════════════════════════════════════
// IVAE Gallery — Cloudflare Worker API
// ═══════════════════════════════════════════════════════════

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

// ── AWS SigV4 PRESIGNED URL FOR R2 ──
// Signs a PUT URL that lets the browser upload directly to R2 bucket for max speed.
async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

async function sha256Hex(data) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function presignR2Put(env, bucket, key, expiresSec = 3600) {
  return presignR2Op(env, { method: 'PUT', bucket, key, expiresSec });
}

// Generic presigner for any S3-compatible R2 operation (PUT, POST, GET, etc.)
// with arbitrary query params (uploads=, partNumber=, uploadId=, etc.).
async function presignR2Op(env, { method, bucket, key, expiresSec = 3600, extraQuery = {} }) {
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  const endpoint = env.R2_ENDPOINT;
  if (!accessKey || !secretKey || !endpoint) throw new Error('R2 credentials not configured');

  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const host = new URL(endpoint).host;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;
  const canonicalUri = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': 'host',
    ...extraQuery
  };
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQuery = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\nhost\nUNSIGNED-PAYLOAD`;

  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function generateSimplePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'ivae-' + code;
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

// ── SESSION MANAGEMENT ──
async function getSession(request, env) {
  const token = getCookie(request, 'session');
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(token).first();
  return row || null;
}

function sessionCookie(token, maxAge) {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// ── AUTH HANDLERS ──
async function handleRegister(request, env) {
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) return json({ error: 'Name, email and password required' }, 400);
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'Email already registered' }, 409);

    const id = randomId();
    const hash = await hashPassword(password);
    const role = email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'client';

    await env.DB.prepare('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)').bind(id, email, hash, name, role).run();

    // Auto-login
    const sessionId = randomId();
    const expiry = env.SESSION_EXPIRY_SECONDS || '604800';
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))').bind(sessionId, id, expiry).run();

    return json({ id, email, name, role }, 201, { 'Set-Cookie': sessionCookie(sessionId, expiry) });
  } catch (e) {
    return json({ error: 'Registration failed: ' + e.message }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) return json({ error: 'No account found with this email. Please check your email address.' }, 401);

    // OAuth users cannot login with password
    if (!user.password) {
      const provider = user.auth_provider || 'Google';
      return json({ error: 'This account uses ' + provider.charAt(0).toUpperCase() + provider.slice(1) + ' sign-in. Please click the "Continue with ' + provider.charAt(0).toUpperCase() + provider.slice(1) + '" button instead.' }, 401);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) return json({ error: 'Incorrect password. Please check your password and try again.' }, 401);

    const sessionId = randomId();
    const expiry = env.SESSION_EXPIRY_SECONDS || '604800';
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))').bind(sessionId, user.id, expiry).run();

    return json({ id: user.id, email: user.email, name: user.name, role: user.role }, 200, { 'Set-Cookie': sessionCookie(sessionId, expiry) });
  } catch (e) {
    return json({ error: 'Login failed: ' + e.message }, 500);
  }
}

async function handleLogout(request, env, session) {
  if (session) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

async function handleMe(session) {
  if (!session) return json({ error: 'Not authenticated' }, 401);
  return json({ id: session.user_id, email: session.email, name: session.name, role: session.role });
}

// ── OAUTH HELPERS ──
function getBaseUrl(request) {
  const url = new URL(request.url);
  return url.origin;
}

async function oauthLogin(env, email, name, provider, redirectTo = '') {
  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (!user) {
    const id = randomId();
    const role = email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'client';
    await env.DB.prepare('INSERT INTO users (id, email, password, name, role, auth_provider) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, '', name, role, provider).run();
    user = { id, email, name, role };
  }
  const sessionId = randomId();
  const expiry = env.SESSION_EXPIRY_SECONDS || '604800';
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime("now", "+" || ? || " seconds"))').bind(sessionId, user.id, expiry).run();
  const redirectUrl = redirectTo || (user.role === 'admin' ? '/gallery/admin/' : '/gallery/galleries');
  return new Response(null, {
    status: 302,
    headers: { 'Location': redirectUrl, 'Set-Cookie': sessionCookie(sessionId, expiry) }
  });
}

// ── GOOGLE OAUTH ──
function handleGoogleAuth(request, env) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'Google OAuth not configured' }, 500);
  const base = getBaseUrl(request);
  const reqUrl = new URL(request.url);
  const redirect = reqUrl.searchParams.get('redirect') || '';
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: base + '/api/gallery/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state: redirect
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(), 302);
}

async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const base = getBaseUrl(request);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '';
  if (error || !code) return Response.redirect(base + '/gallery/?error=google_denied&detail=' + encodeURIComponent(error || 'no_code'), 302);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: base + '/api/gallery/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      const detail = tokens.error_description || tokens.error || 'token_exchange_failed';
      return Response.redirect(base + '/gallery/?error=google_failed&detail=' + encodeURIComponent(detail), 302);
    }
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': 'Bearer ' + tokens.access_token }
    });
    const gUser = await userRes.json();
    if (!gUser.email) return Response.redirect(base + '/gallery/?error=google_no_email', 302);
    return oauthLogin(env, gUser.email, gUser.name || gUser.email.split('@')[0], 'google', state);
  } catch (e) {
    return Response.redirect(base + '/gallery/?error=google_error&detail=' + encodeURIComponent(e.message || 'unknown'), 302);
  }
}

// ── FORGOT / RESET PASSWORD ──
async function handleForgotPassword(request, env) {
  const { email } = await request.json();
  if (!email) return json({ error: 'Email required' }, 400);
  const okResponse = json({ ok: true, message: 'If this email exists, a reset link has been sent.' });
  // Always return OK to avoid email enumeration
  const user = await env.DB.prepare('SELECT id, email, name, auth_provider FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (!user) return okResponse;
  if (user.auth_provider && user.auth_provider !== 'email') return okResponse;
  const token = randomId() + randomId();
  await env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run();
  const expires = new Date(Date.now() + 3600000).toISOString();
  await env.DB.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)').bind(user.id, token, expires).run();
  const resetUrl = 'https://ivaestudios.com/gallery/reset-password?token=' + token;
  // Send the email via Resend. We never return the token in the response body.
  if (env.RESEND_API_KEY) {
    const html =
      '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1c1c1c;">' +
        '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px;">Reset your password</h1>' +
        '<p style="line-height:1.55;color:#444;">Hi ' + escapeHtml(user.name || '') + ',</p>' +
        '<p style="line-height:1.55;color:#444;">We received a request to reset the password for your IVAE Studios gallery account. Click the button below to choose a new password. This link expires in 1 hour.</p>' +
        '<p style="margin:28px 0;"><a href="' + resetUrl + '" style="background:#c4a35a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:2px;letter-spacing:1px;font-family:Arial,sans-serif;font-size:13px;text-transform:uppercase;display:inline-block;">Reset password</a></p>' +
        '<p style="line-height:1.55;color:#888;font-size:13px;">Or copy this link into your browser:<br/><span style="word-break:break-all;">' + resetUrl + '</span></p>' +
        '<p style="line-height:1.55;color:#888;font-size:13px;margin-top:24px;">If you didn\'t request this, you can safely ignore this email — your password won\'t change.</p>' +
        '<hr style="border:0;border-top:1px solid #eee;margin:32px 0 16px;"/>' +
        '<p style="color:#aaa;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">IVAE Studios &middot; Cancun</p>' +
      '</div>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'IVAE Studios <gallery@ivaestudios.com>',
          to: [user.email],
          subject: 'Reset your IVAE Studios gallery password',
          html
        })
      });
      if (!res.ok) console.warn('[forgot-password] resend send failed:', res.status, await res.text());
    } catch (e) {
      console.warn('[forgot-password] resend exception:', e.message);
    }
  } else {
    console.warn('[forgot-password] RESEND_API_KEY missing — token generated but no email sent for user', user.id);
  }
  return okResponse;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function handleResetPassword(request, env) {
  const { token, password } = await request.json();
  if (!token || !password) return json({ error: 'Token and password required' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
  const reset = await env.DB.prepare('SELECT * FROM password_resets WHERE token = ? AND expires_at > datetime("now")').bind(token).first();
  if (!reset) return json({ error: 'Invalid or expired reset link. Please request a new one.' }, 400);
  const hash = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').bind(hash, reset.user_id).run();
  await env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(reset.user_id).run();
  return json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
}

// ── GALLERY HANDLERS ──
async function handleGetGalleries(env, session) {
  let rows;
  if (session.role === 'admin') {
    rows = await env.DB.prepare(`
      SELECT g.*, COUNT(DISTINCT p.id) as photo_count, COUNT(DISTINCT ga.user_id) as client_count
      FROM galleries g
      LEFT JOIN photos p ON p.gallery_id = g.id
      LEFT JOIN gallery_access ga ON ga.gallery_id = g.id
      GROUP BY g.id ORDER BY g.created_at DESC
    `).all();
  } else {
    rows = await env.DB.prepare(`
      SELECT g.*, COUNT(DISTINCT p.id) as photo_count
      FROM galleries g
      JOIN gallery_access ga ON ga.gallery_id = g.id
      LEFT JOIN photos p ON p.gallery_id = g.id
      WHERE ga.user_id = ? AND g.status = 'published'
      GROUP BY g.id ORDER BY g.session_date DESC
    `).bind(session.user_id).all();
  }
  return json(rows.results || []);
}

async function handleGetPortfolio(env) {
  const rows = await env.DB.prepare(`
    SELECT g.id, g.title, g.description, g.session_date, g.cover_key, g.cover_design, g.bg_color, g.txt_color, g.occasion,
      (SELECT COUNT(*) FROM photos WHERE gallery_id = g.id) as photo_count,
      (SELECT id FROM photos WHERE gallery_id = g.id ORDER BY sort_order LIMIT 1) as first_photo_id
    FROM galleries g
    WHERE g.show_on_portfolio = 1 AND g.status = 'published'
    ORDER BY g.session_date DESC
  `).all();
  return json(rows.results || []);
}

async function handleGetPublicGallery(env, galleryId) {
  const gallery = await env.DB.prepare('SELECT * FROM galleries WHERE id = ? AND show_on_portfolio = 1 AND is_private = 0 AND status = ?').bind(galleryId, 'published').first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);

  const photos = await env.DB.prepare('SELECT id, filename, width, height, sort_order, scene_id FROM photos WHERE gallery_id = ? ORDER BY sort_order, uploaded_at').bind(galleryId).all();
  const scenes = await env.DB.prepare('SELECT * FROM scenes WHERE gallery_id = ? ORDER BY sort_order ASC').bind(galleryId).all();

  const photosData = (photos.results || []).map(p => ({ ...p, selected: false }));
  return json({ ...gallery, photos: photosData, scenes: scenes.results || [], clients: [] });
}

// By-link access: gallery is viewable by anyone with the link IF the photographer
// opted in via request_email=1 (Pic-Time-style email gate). Requires the gate to
// be on so that we capture the visitor's email before they see the photos.
// The status must be 'published' — drafts and archived stay private.
async function handleGetGalleryByLink(env, galleryId) {
  const gallery = await env.DB.prepare(
    "SELECT * FROM galleries WHERE id = ? AND status = 'published' AND request_email = 1"
  ).bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  // Honor expiry
  if (gallery.expire_enabled && gallery.expire_date && new Date(gallery.expire_date) < new Date()) {
    return json({ error: 'This gallery has expired' }, 410);
  }
  const photos = await env.DB.prepare(
    'SELECT id, filename, width, height, sort_order, scene_id FROM photos WHERE gallery_id = ? ORDER BY sort_order, uploaded_at'
  ).bind(galleryId).all();
  const scenes = await env.DB.prepare(
    'SELECT * FROM scenes WHERE gallery_id = ? ORDER BY sort_order ASC'
  ).bind(galleryId).all();
  const photosData = (photos.results || []).map(p => ({ ...p, selected: false }));
  return json({ ...gallery, photos: photosData, scenes: scenes.results || [], clients: [] });
}

// Share-token (Pic-Time-style): photographer creates a tokenized URL anyone
// with the link can open WITHOUT logging in. No email gate forced unless
// request_email = 1 on the gallery (in which case the gallery.html email
// gate still applies). Token is per-gallery, regeneratable, revocable.
async function handleGetGalleryByShareToken(env, token) {
  if (!token || !/^[a-f0-9]{24,64}$/i.test(token)) return json({ error: 'Invalid token' }, 404);
  let gallery;
  try {
    gallery = await env.DB.prepare(
      "SELECT * FROM galleries WHERE share_token = ? AND status = 'published'"
    ).bind(token).first();
  } catch (e) {
    // Schema drift: column not yet added on this DB.
    if ((e.message || '').includes('no such column')) return json({ error: 'Gallery not found' }, 404);
    throw e;
  }
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  if (gallery.expire_enabled && gallery.expire_date && new Date(gallery.expire_date) < new Date()) {
    return json({ error: 'This gallery has expired' }, 410);
  }
  const [photos, scenes] = await Promise.all([
    env.DB.prepare(
      'SELECT id, filename, width, height, sort_order, scene_id FROM photos WHERE gallery_id = ? ORDER BY sort_order, uploaded_at'
    ).bind(gallery.id).all(),
    env.DB.prepare(
      'SELECT * FROM scenes WHERE gallery_id = ? ORDER BY sort_order ASC'
    ).bind(gallery.id).all()
  ]);
  const photosData = (photos.results || []).map(p => ({ ...p, selected: false }));
  return json({ ...gallery, photos: photosData, scenes: scenes.results || [], clients: [] });
}

async function handleRegenerateShareToken(env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  // 24 hex chars = 96 bits of entropy. Plenty for a public share link.
  const token = randomId().slice(0, 24);
  try {
    const result = await env.DB.prepare(
      'UPDATE galleries SET share_token = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(token, galleryId).run();
    if (result.meta && result.meta.changes === 0) return json({ error: 'Gallery not found' }, 404);
  } catch (e) {
    if ((e.message || '').includes('no such column')) {
      return json({ error: 'share_token column missing — run migration 007_share_token.sql' }, 500);
    }
    throw e;
  }
  return json({ token, url: 'https://ivaestudios.com/gallery/g/' + token });
}

async function handleRevokeShareToken(env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  try {
    await env.DB.prepare(
      'UPDATE galleries SET share_token = NULL, updated_at = datetime("now") WHERE id = ?'
    ).bind(galleryId).run();
  } catch (e) {
    if ((e.message || '').includes('no such column')) {
      return json({ error: 'share_token column missing — run migration 007_share_token.sql' }, 500);
    }
    throw e;
  }
  return json({ ok: true });
}

async function handleGetGallery(env, session, galleryId) {
  // Step 1: parallel access-check + gallery fetch. Both are independent.
  const isAdmin = session.role === 'admin';
  const [accessRow, gallery] = await Promise.all([
    isAdmin
      ? Promise.resolve({ ok: true })
      : env.DB.prepare('SELECT 1 FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(galleryId, session.user_id).first(),
    env.DB.prepare('SELECT * FROM galleries WHERE id = ?').bind(galleryId).first()
  ]);
  if (!isAdmin && !accessRow) return json({ error: 'Access denied' }, 403);
  if (!gallery) return json({ error: 'Gallery not found' }, 404);

  // Honor expiry — even invited clients lose access after expire_date.
  // Admins can still see the gallery to extend or republish.
  if (!isAdmin && gallery.expire_enabled && gallery.expire_date && new Date(gallery.expire_date) < new Date()) {
    return json({ error: 'This gallery has expired' }, 410);
  }

  // Step 2: parallel photos + scenes + selections + (admin) clients.
  // CRITICAL: selections must filter by gallery_id, otherwise we pull every
  // selection that user ever made across all galleries (D1 RBR cost adds up).
  const [photos, scenes, selections, cl] = await Promise.all([
    env.DB.prepare('SELECT id, filename, width, height, size_bytes, sort_order, scene_id FROM photos WHERE gallery_id = ? ORDER BY sort_order, uploaded_at').bind(galleryId).all(),
    env.DB.prepare('SELECT * FROM scenes WHERE gallery_id = ? ORDER BY sort_order ASC').bind(galleryId).all(),
    env.DB.prepare('SELECT s.photo_id FROM selections s JOIN photos p ON s.photo_id = p.id WHERE s.user_id = ? AND p.gallery_id = ?').bind(session.user_id, galleryId).all(),
    isAdmin
      ? env.DB.prepare('SELECT u.id, u.name, u.email, ga.granted_at, ga.access_password FROM gallery_access ga JOIN users u ON ga.user_id = u.id WHERE ga.gallery_id = ?').bind(galleryId).all()
      : Promise.resolve({ results: [] })
  ]);

  const selectedIds = new Set((selections.results || []).map(s => s.photo_id));
  const photosWithSelection = (photos.results || []).map(p => ({ ...p, selected: selectedIds.has(p.id) }));

  return json({
    ...gallery,
    photos: photosWithSelection,
    scenes: scenes.results || [],
    clients: cl.results || []
  });
}

async function handleCreateGallery(request, env, session) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const { title, description, session_date, status } = await request.json();
  if (!title) return json({ error: 'Title required' }, 400);
  const id = randomId();
  // Defaults: watermark ON ("IVAE" / "STUDIOS" @ 0.3 opacity), download disabled, sharing on
  await env.DB.prepare(
    'INSERT INTO galleries (id, title, description, session_date, status, watermark_enabled, watermark_text, watermark_subtext, watermark_opacity, allow_download, allow_sharing) VALUES (?, ?, ?, ?, ?, 1, "IVAE", "STUDIOS", 0.3, 0, 1)'
  ).bind(id, title, description || null, session_date || null, status || 'draft').run();
  return json({ id, title, description, session_date, status: status || 'draft' }, 201);
}

async function handleUpdateGallery(request, env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const data = await request.json();
  const sets = [];
  const vals = [];
  for (const key of ['title', 'description', 'session_date', 'status', 'cover_key', 'cover_design', 'bg_color', 'txt_color', 'focal_x', 'focal_y', 'occasion', 'is_private', 'expire_enabled', 'expire_date', 'allow_sharing', 'allow_download', 'download_quality', 'watermark_enabled', 'watermark_opacity', 'watermark_text', 'watermark_subtext', 'logo_key', 'logo_white', 'proofing_enabled', 'proofing_target', 'proofing_message', 'proofing_locked', 'slideshow_speed_ms', 'request_email', 'gallery_style', 'security_policy', 'show_on_portfolio', 'client_can_add']) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
  }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);

  // Detect status transition to 'published' so we can fire the auto-publish trigger.
  let didPublish = false;
  if (data.status === 'published') {
    try {
      const prev = await env.DB.prepare('SELECT status FROM galleries WHERE id = ?').bind(galleryId).first();
      if (prev && prev.status !== 'published') didPublish = true;
    } catch {}
  }

  sets.push('updated_at = datetime("now")');
  vals.push(galleryId);
  try {
    await env.DB.prepare(`UPDATE galleries SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  } catch (e) {
    // Schema drift: a column referenced in the update doesn't exist on this DB
    // yet (migration not applied). Drop offending columns and retry once so
    // the rest of the fields still save instead of nuking the whole edit.
    const msg = (e && e.message) || '';
    const m = msg.match(/no such column:\s*(\w+)/i);
    if (m) {
      const bad = m[1];
      const idx = sets.findIndex(s => s.startsWith(bad + ' '));
      if (idx !== -1) {
        sets.splice(idx, 1);
        vals.splice(idx, 1); // matched positional binding
        await env.DB.prepare(`UPDATE galleries SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
        console.warn('[gallery PUT] dropped unknown column', bad, '— run pending migration');
      } else throw e;
    } else throw e;
  }

  // Fire auto-publish trigger AFTER the status change is committed.
  // Run async via waitUntil-style fire-and-forget so the admin response is fast.
  if (didPublish) {
    handleGalleryPublished(env, galleryId).catch(e => console.error('[publish trigger]', e.message));
  }

  return json({ ok: true, published: didPublish });
}

async function handleDeleteGallery(env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  // Delete photos from R2
  const photos = await env.DB.prepare('SELECT r2_key, thumb_key FROM photos WHERE gallery_id = ?').bind(galleryId).all();
  for (const p of (photos.results || [])) {
    if (p.r2_key) await env.R2_BUCKET.delete(p.r2_key);
    if (p.thumb_key) await env.R2_BUCKET.delete(p.thumb_key);
  }
  await env.DB.prepare('DELETE FROM galleries WHERE id = ?').bind(galleryId).run();
  return json({ ok: true });
}

// ── GALLERY ACCESS ──
async function handleGrantAccess(request, env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const { name, email } = await request.json();
  if (!email) return json({ error: 'Email required' }, 400);

  let user = await env.DB.prepare('SELECT id, name, email, password FROM users WHERE email = ?').bind(email).first();
  let plainPassword = generateSimplePassword();

  if (!user) {
    const hashedPw = await hashPassword(plainPassword);
    const userId = randomId();
    const clientName = name || email.split('@')[0];
    await env.DB.prepare('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)').bind(userId, email, hashedPw, clientName, 'client').run();
    user = { id: userId, name: clientName, email };
  } else {
    // Always update user's login password to match the new generated one
    const hashedPw = await hashPassword(plainPassword);
    await env.DB.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').bind(hashedPw, user.id).run();
  }

  // Check if already has access
  const existing = await env.DB.prepare('SELECT access_password FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(galleryId, user.id).first();
  if (existing) {
    return json({ user_id: user.id, name: user.name, email: user.email, password: existing.access_password, already: true });
  }

  await env.DB.prepare('INSERT INTO gallery_access (gallery_id, user_id, access_password) VALUES (?, ?, ?)').bind(galleryId, user.id, plainPassword).run();
  return json({ user_id: user.id, name: user.name, email: user.email, password: plainPassword });
}

async function handleRevokeAccess(env, session, galleryId, userId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  await env.DB.prepare('DELETE FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(galleryId, userId).run();
  return json({ ok: true });
}

async function handleUpdateAccessPassword(request, env, session, galleryId, userId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const { password } = await request.json();
  if (!password || password.length < 4) return json({ error: 'Password must be at least 4 characters' }, 400);
  const hashedPw = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').bind(hashedPw, userId).run();
  await env.DB.prepare('UPDATE gallery_access SET access_password = ? WHERE gallery_id = ? AND user_id = ?').bind(password, galleryId, userId).run();
  return json({ ok: true, password });
}

async function handleSendInviteEmail(request, env, session, galleryId, userId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  if (!env.RESEND_API_KEY) return json({ error: 'Email service not configured. Add RESEND_API_KEY secret.' }, 500);

  const gallery = await env.DB.prepare('SELECT title, cover_key, description FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);

  const user = await env.DB.prepare('SELECT u.name, u.email FROM users u WHERE u.id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const access = await env.DB.prepare('SELECT access_password FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(galleryId, userId).first();
  if (!access) return json({ error: 'User does not have access' }, 404);

  // Direct-to-gallery URL: now that the gallery static assets are served from
  // the same origin (ivaestudios.com/gallery/...), we skip the legacy
  // /?redirect=... dance entirely. The login gate on /gallery/gallery?id=...
  // still triggers when no session is present.
  const galleryUrl = `https://ivaestudios.com/gallery/gallery?id=${galleryId}`;
  const loginUrl = galleryUrl;
  const coverUrl = `https://ivaestudios.com/api/gallery/galleries/${galleryId}/cover`;

  const html = buildInviteEmail({
    clientName: user.name,
    galleryTitle: gallery.title,
    galleryDescription: gallery.description,
    coverUrl,
    galleryUrl,
    loginUrl,
    email: user.email,
    password: access.access_password,
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'IVAE Studios <gallery@ivaestudios.com>',
      to: [user.email],
      subject: `Your gallery is ready: ${gallery.title}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Failed to send email', detail: err }, 500);
  }

  return json({ ok: true, sent_to: user.email });
}

function buildInviteEmail({ clientName, galleryTitle, galleryDescription, coverUrl, galleryUrl, loginUrl, email, password }) {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light only"/>
<title>${galleryTitle} — IVAE Studios</title>
<style>
  :root { color-scheme: light only; }
  [data-ogsc] .dark-bg { background-color: #2c2c2c !important; }
  [data-ogsc] .white-text { color: #ffffff !important; }
  [data-ogsc] .gold-text { color: #c9b99a !important; }
  @media (prefers-color-scheme: dark) {
    .dark-bg { background-color: #2c2c2c !important; }
    .white-text { color: #ffffff !important; }
    .gold-text { color: #c9b99a !important; }
    body, .body-bg { background-color: #f7f6f3 !important; }
  }
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background-color:#f7f6f3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color-scheme:light only;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;">

<!-- Preheader -->
<div style="display:none;font-size:1px;color:#f7f6f3;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  ${clientName ? clientName + ', your' : 'Your'} gallery "${galleryTitle}" is ready to view and download.
</div>

<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <!-- Main Card -->
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 12px rgba(0,0,0,0.06);">

    <!-- Logo Bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2c2c2c" class="dark-bg">
      <tr>
        <td class="dark-bg" style="padding:18px 0;text-align:center;background-color:#2c2c2c;">
          <p class="gold-text" style="margin:0;font-size:12px;letter-spacing:5px;color:#c9b99a;font-weight:400;text-transform:uppercase;">IVAE Studios</p>
        </td>
      </tr>
    </table>

    <!-- Cover Photo -->
    <img src="${coverUrl}" alt="${galleryTitle}" width="600" style="width:100%;display:block;max-height:400px;object-fit:cover;"/>

    <!-- Title Bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2c2c2c" class="dark-bg">
      <tr>
        <td class="dark-bg" style="padding:28px 36px;background-color:#2c2c2c;">
          <p class="white-text" style="margin:0;font-size:30px;color:#ffffff;font-weight:300;line-height:1.3;">Your <span style="font-style:italic;">gallery</span> is ready</p>
        </td>
      </tr>
    </table>

    <!-- Body Content -->
    <div style="padding:36px 40px 12px;">
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
        ${clientName ? clientName + ', we' : 'We'} are thrilled to share your photos with you. Your gallery <strong style="color:#2c2c2c;">${galleryTitle}</strong> is now ready for viewing and downloading.${galleryDescription ? ' ' + galleryDescription : ''}
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:8px 0 32px;">
        <a href="${galleryUrl}" style="display:inline-block;background:#2c2c2c;color:#ffffff;text-decoration:none;padding:15px 52px;border-radius:40px;font-size:13px;letter-spacing:2px;font-weight:500;text-transform:uppercase;">VIEW YOUR GALLERY</a>
      </div>
    </div>

    ${password ? `
    <!-- Credentials Section -->
    <div style="padding:0 40px 32px;">
      <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="width:44px;vertical-align:middle;">
            <div style="width:32px;height:32px;background:#f0eeea;border-radius:50%;text-align:center;line-height:32px;">
              <span style="font-size:16px;">&#128274;</span>
            </div>
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:18px;color:#2c2c2c;font-weight:400;">Your access <em style="font-style:italic;">credentials</em></p>
          </td>
        </tr>
      </table>
      <div style="border-top:1px solid #eee;padding-top:16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;border-radius:24px;">
                <tr>
                  <td style="padding:12px 20px;">
                    <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Email:</span>
                    <span style="font-size:14px;color:#2c2c2c;font-weight:500;padding-left:8px;">${email}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;border-radius:24px;">
                <tr>
                  <td style="padding:12px 20px;">
                    <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Password:</span>
                    <span style="font-size:15px;color:#2c2c2c;font-weight:600;padding-left:8px;font-family:'Courier New',monospace;letter-spacing:1px;">${password}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    </div>` : ''}

    <!-- Instructions Section -->
    <div style="background:#f7f6f3;padding:32px 40px;margin:0;">
      <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="width:44px;vertical-align:middle;">
            <div style="width:32px;height:32px;background:#ffffff;border-radius:50%;text-align:center;line-height:32px;">
              <span style="font-size:16px;">&#128247;</span>
            </div>
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:18px;color:#2c2c2c;font-weight:400;">How to <em style="font-style:italic;">view</em> your photos</p>
          </td>
        </tr>
      </table>
      <div style="border-top:1px solid #e8e5e0;padding-top:16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 0;vertical-align:top;width:40px;">
              <div style="width:28px;height:28px;border-radius:50%;background:#2c2c2c;text-align:center;line-height:28px;font-size:12px;color:#fff;font-weight:600;">1</div>
            </td>
            <td style="padding:10px 0;font-size:14px;color:#555;line-height:1.6;">Click <strong style="color:#2c2c2c;">"View Your Gallery"</strong> above</td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:#2c2c2c;text-align:center;line-height:28px;font-size:12px;color:#fff;font-weight:600;">2</div>
            </td>
            <td style="padding:10px 0;font-size:14px;color:#555;line-height:1.6;">Log in with the <strong style="color:#2c2c2c;">email and password</strong> shown above</td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:#2c2c2c;text-align:center;line-height:28px;font-size:12px;color:#fff;font-weight:600;">3</div>
            </td>
            <td style="padding:10px 0;font-size:14px;color:#555;line-height:1.6;">Browse and <strong style="color:#2c2c2c;">mark your favorites</strong> with the heart icon</td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:#2c2c2c;text-align:center;line-height:28px;font-size:12px;color:#fff;font-weight:600;">4</div>
            </td>
            <td style="padding:10px 0;font-size:14px;color:#555;line-height:1.6;"><strong style="color:#2c2c2c;">Download</strong> individual photos or the entire gallery</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Tip Section -->
    <div style="padding:28px 40px;">
      <div style="background:#faf8f5;border-radius:12px;padding:20px 24px;border:1px solid #eee;">
        <p style="margin:0 0 6px;font-size:14px;color:#2c2c2c;font-weight:500;">Quick <em style="font-style:italic;">tip:</em></p>
        <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">For the best viewing experience, open your gallery on a desktop or laptop. You can also share the gallery link with family and friends!</p>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:28px 20px 16px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;color:#999;text-transform:uppercase;">IVAE Studios</p>
    <p style="margin:0 0 12px;font-size:12px;color:#bbb;">Luxury Photography &middot; Cancun &amp; Riviera Maya</p>
    <a href="https://ivaestudios.com" style="font-size:12px;color:#8a7d6b;text-decoration:none;">ivaestudios.com</a>
    <p style="margin:16px 0 0;font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()} IVAE Studios. All rights reserved.</p>
  </div>

</div>
</body></html>`;
}

// ── PUBLIC COVER (for emails) ──
async function handleGetCover(env, galleryId) {
  const gallery = await env.DB.prepare('SELECT cover_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return new Response('Gallery not found', { status: 404 });

  let r2Key = null;
  if (gallery.cover_key) {
    const photo = await env.DB.prepare('SELECT r2_key FROM photos WHERE id = ?').bind(gallery.cover_key).first();
    if (photo) r2Key = photo.r2_key;
  }
  // Fallback: use first photo in gallery
  if (!r2Key) {
    const first = await env.DB.prepare('SELECT r2_key FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC LIMIT 1').bind(galleryId).first();
    if (first) r2Key = first.r2_key;
  }
  if (!r2Key) return new Response('No photos', { status: 404 });

  const obj = await env.R2_BUCKET.get(r2Key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }
  });
}

// ── LOGO (per-gallery brand mark, served on cover + lightbox topbar) ──
async function handleUploadLogo(request, env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const gallery = await env.DB.prepare('SELECT id FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  const formData = await request.formData();
  const file = formData.get('logo');
  if (!file) return json({ error: 'No file provided' }, 400);
  const ct = (file.type || '').toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(ct)) {
    return json({ error: 'Logo must be PNG, JPEG, SVG, or WEBP' }, 400);
  }
  const ext = ct === 'image/png' ? 'png' : ct === 'image/svg+xml' ? 'svg' : ct === 'image/webp' ? 'webp' : 'jpg';
  const logoKey = `logos/${galleryId}.${ext}`;
  await env.R2_BUCKET.put(logoKey, file.stream(), { httpMetadata: { contentType: ct, cacheControl: 'public, max-age=86400' } });
  await env.DB.prepare('UPDATE galleries SET logo_key = ?, updated_at = datetime("now") WHERE id = ?').bind(logoKey, galleryId).run();
  return json({ ok: true, logo_key: logoKey });
}

async function handleGetLogo(env, galleryId) {
  const gallery = await env.DB.prepare('SELECT logo_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery || !gallery.logo_key) return new Response('No logo', { status: 404 });
  const obj = await env.R2_BUCKET.get(gallery.logo_key);
  if (!obj) return new Response('Not found', { status: 404 });
  const ext = gallery.logo_key.split('.').pop().toLowerCase();
  const ct = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return new Response(obj.body, {
    headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' }
  });
}

async function handleDeleteLogo(env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const gallery = await env.DB.prepare('SELECT logo_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  if (gallery.logo_key) {
    try { await env.R2_BUCKET.delete(gallery.logo_key); } catch {}
  }
  await env.DB.prepare('UPDATE galleries SET logo_key = NULL, updated_at = datetime("now") WHERE id = ?').bind(galleryId).run();
  return json({ ok: true });
}

// ── SLIDESHOW MUSIC ──
// Per-gallery audio track that loops during the client-side slideshow.
// Stored at music/{galleryId}.{ext} in R2; the column slideshow_music_key
// already exists in the schema and is read by gallery.html.
const MUSIC_MIMES = {
  'audio/mpeg': 'mp3',
  'audio/mp3':  'mp3',
  'audio/mp4':  'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac':  'aac',
  'audio/wav':  'wav',
  'audio/x-wav': 'wav',
  'audio/ogg':  'ogg',
  'audio/webm': 'webm'
};
const MUSIC_MAX_BYTES = 25 * 1024 * 1024;  // 25 MB — keeps R2 + transfer sane

async function handleUploadMusic(request, env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const gallery = await env.DB.prepare('SELECT id, slideshow_music_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  const formData = await request.formData();
  const file = formData.get('music');
  if (!file) return json({ error: 'No file provided' }, 400);
  const ct = (file.type || '').toLowerCase();
  const ext = MUSIC_MIMES[ct];
  if (!ext) return json({ error: 'Unsupported audio format. Use MP3, M4A, AAC, WAV, OGG, or WEBM.' }, 400);
  if (file.size > MUSIC_MAX_BYTES) return json({ error: `Audio file too large (${Math.round(file.size/1024/1024)}MB). Max 25MB.` }, 400);

  // Clear out any previous track at a different extension before writing the new one
  if (gallery.slideshow_music_key && gallery.slideshow_music_key !== `music/${galleryId}.${ext}`) {
    try { await env.R2_BUCKET.delete(gallery.slideshow_music_key); } catch {}
  }

  const musicKey = `music/${galleryId}.${ext}`;
  await env.R2_BUCKET.put(musicKey, file.stream(), {
    httpMetadata: { contentType: ct, cacheControl: 'public, max-age=86400' }
  });
  await env.DB.prepare('UPDATE galleries SET slideshow_music_key = ?, updated_at = datetime("now") WHERE id = ?')
    .bind(musicKey, galleryId).run();
  return json({ ok: true, slideshow_music_key: musicKey, size: file.size });
}

async function handleGetMusic(env, galleryId) {
  const gallery = await env.DB.prepare('SELECT slideshow_music_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery || !gallery.slideshow_music_key) return new Response('No music', { status: 404 });
  const obj = await env.R2_BUCKET.get(gallery.slideshow_music_key);
  if (!obj) return new Response('Not found', { status: 404 });
  const ext = gallery.slideshow_music_key.split('.').pop().toLowerCase();
  const ctMap = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm' };
  const ct = ctMap[ext] || 'application/octet-stream';
  return new Response(obj.body, {
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    }
  });
}

async function handleDeleteMusic(env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const gallery = await env.DB.prepare('SELECT slideshow_music_key FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!gallery) return json({ error: 'Gallery not found' }, 404);
  if (gallery.slideshow_music_key) {
    try { await env.R2_BUCKET.delete(gallery.slideshow_music_key); } catch {}
  }
  await env.DB.prepare('UPDATE galleries SET slideshow_music_key = NULL, updated_at = datetime("now") WHERE id = ?').bind(galleryId).run();
  return json({ ok: true });
}

// ── VISITOR REGISTRATION (email gate) ──
async function handleRegisterVisitor(request, env, galleryId) {
  try {
    const gallery = await env.DB.prepare('SELECT id, title, request_email FROM galleries WHERE id = ?').bind(galleryId).first();
    if (!gallery) return json({ error: 'Gallery not found' }, 404);
    const data = await request.json();
    const email = (data.email || '').trim().toLowerCase();
    const name = (data.name || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Valid email required' }, 400);
    const ip = request.headers.get('cf-connecting-ip') || '';
    const ua = (request.headers.get('user-agent') || '').slice(0, 240);
    await env.DB.prepare('INSERT INTO visitor_log (gallery_id, email, name, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
      .bind(galleryId, email, name || null, ip || null, ua || null).run();
    // 30-day cookie
    const cookie = `pic_visit_${galleryId}=${encodeURIComponent(email)}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax; Secure; HttpOnly`;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
    });
  } catch (e) {
    console.error('[handleRegisterVisitor]', e.message);
    return json({ error: 'Registration failed' }, 500);
  }
}

// ── PROOF SUBMISSIONS (client final selections) ──
async function handleSubmitProof(request, env, session, galleryId) {
  try {
    const gallery = await env.DB.prepare('SELECT id, title, proofing_enabled, proofing_locked, proofing_target FROM galleries WHERE id = ?').bind(galleryId).first();
    if (!gallery) return json({ error: 'Gallery not found' }, 404);
    if (!gallery.proofing_enabled) return json({ error: 'Proofing is not enabled for this gallery' }, 400);
    if (gallery.proofing_locked) return json({ error: 'Selections are locked for this gallery' }, 400);
    const data = await request.json();
    const photoIds = Array.isArray(data.photo_ids) ? data.photo_ids.filter(x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x)) : [];
    if (!photoIds.length) return json({ error: 'No photos selected' }, 400);
    let email = (data.email || '').trim().toLowerCase();
    let name = (data.name || '').trim();
    if (!email && session?.user) { email = session.user.email; name = session.user.name; }
    if (!email && !session) {
      // Try cookie set by visitor gate
      const cookies = (request.headers.get('cookie') || '').split(';').map(s => s.trim());
      const c = cookies.find(s => s.startsWith(`pic_visit_${galleryId}=`));
      if (c) email = decodeURIComponent(c.split('=')[1] || '');
    }
    if (!email) return json({ error: 'Email required' }, 400);
    const note = (data.note || '').slice(0, 1000);
    await env.DB.prepare('INSERT INTO proof_submissions (gallery_id, email, name, photo_ids, note) VALUES (?, ?, ?, ?, ?)')
      .bind(galleryId, email, name || null, JSON.stringify(photoIds), note || null).run();
    // Notify photographer via Resend if configured
    if (env.RESEND_API_KEY && env.ADMIN_EMAIL) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'IVAE Gallery <gallery@ivaestudios.com>',
            to: env.ADMIN_EMAIL,
            subject: `${gallery.title} — Client submitted ${photoIds.length} selections`,
            html: `<p>${name || email} submitted <strong>${photoIds.length}</strong> final selections for <strong>${gallery.title}</strong>.</p>${note ? `<blockquote style="border-left:3px solid #c4a35a;padding:8px 14px;color:#444;">${note.replace(/</g, '&lt;')}</blockquote>` : ''}<p><a href="https://ivaestudios.com/gallery/admin/gallery-edit.html?id=${galleryId}">Review in admin</a></p>`
          })
        });
      } catch (e) { console.error('Resend notify failed:', e.message); }
    }
    return json({ ok: true, count: photoIds.length });
  } catch (e) {
    console.error('[handleSubmitProof]', e.message);
    return json({ error: 'Submission failed' }, 500);
  }
}

async function handleGetProofs(env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const rows = await env.DB.prepare('SELECT id, email, name, photo_ids, note, submitted_at, status FROM proof_submissions WHERE gallery_id = ? ORDER BY submitted_at DESC').bind(galleryId).all();
  const submissions = (rows.results || []).map(r => ({ ...r, photo_ids: JSON.parse(r.photo_ids || '[]') }));
  return json({ submissions });
}

async function handleGetVisitors(env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const rows = await env.DB.prepare('SELECT email, name, registered_at FROM visitor_log WHERE gallery_id = ? ORDER BY registered_at DESC LIMIT 200').bind(galleryId).all();
  return json({ visitors: rows.results || [] });
}

// ── PHOTO HANDLERS ──
async function handleUploadPhoto(request, env, session, galleryId) {
  try {
    if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const gallery = await env.DB.prepare('SELECT id FROM galleries WHERE id = ?').bind(galleryId).first();
    if (!gallery) return json({ error: 'Gallery not found' }, 404);

    const formData = await request.formData();
    const fullFile = formData.get('full');
    const thumbFile = formData.get('thumb');
    const webFile = formData.get('web');

    if (!fullFile) return json({ error: 'No file provided' }, 400);

    const filename = formData.get('filename') || fullFile.name || 'photo.jpg';
    const photoId = randomId();
    const r2Key = `galleries/${galleryId}/full/${photoId}.jpg`;
    const thumbKey = thumbFile ? `galleries/${galleryId}/thumb/${photoId}.jpg` : null;
    const webKey = webFile ? `galleries/${galleryId}/web/${photoId}.jpg` : null;

    // Upload all variants to R2 in parallel.
    // cacheControl on the R2 object becomes the default response header when
    // R2 fronts a public custom domain — saves us from rewriting headers per
    // request and lets Cloudflare CDN edges cache aggressively.
    const meta = (cc) => ({ contentType: 'image/jpeg', cacheControl: cc });
    const fullCC  = 'private, max-age=3600';                       // originals never go to public CDN
    const variantCC = 'public, max-age=31536000, immutable';        // thumb/web are content-addressed
    const writes = [env.R2_BUCKET.put(r2Key, fullFile.stream(), { httpMetadata: meta(fullCC) })];
    if (thumbFile && thumbKey) writes.push(env.R2_BUCKET.put(thumbKey, thumbFile.stream(), { httpMetadata: meta(variantCC) }));
    if (webFile && webKey) writes.push(env.R2_BUCKET.put(webKey, webFile.stream(), { httpMetadata: meta(variantCC) }));
    await Promise.all(writes);

    // Timestamp-based sort order avoids race conditions with parallel uploads
    const sortOrder = Date.now();

    await env.DB.prepare('INSERT INTO photos (id, gallery_id, filename, r2_key, thumb_key, web_key, size_bytes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(photoId, galleryId, filename, r2Key, thumbKey, webKey, fullFile.size, sortOrder).run();

    return json({ id: photoId, filename, sort_order: sortOrder, thumb_key: thumbKey, web_key: webKey, r2_key: r2Key }, 201);
  } catch (e) {
    console.error('[handleUploadPhoto] error:', e.message, e.stack);
    return json({ error: 'Upload failed: ' + e.message }, 500);
  }
}

// ── PRESIGNED URLS for direct browser → R2 upload (max speed) ──
async function handleGetPresignedUrls(request, env, session, galleryId) {
  try {
    if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
    const gallery = await env.DB.prepare('SELECT id FROM galleries WHERE id = ?').bind(galleryId).first();
    if (!gallery) return json({ error: 'Gallery not found' }, 404);

    const { count = 1 } = await request.json();
    const bucket = 'ivae-gallery-photos';
    const results = [];

    // Generate 3 presigned URLs per photo: full (original), thumb (~800w grid),
    // web (~2400w lightbox). Daemon uses sharp to resize and PUTs each one in
    // parallel with the original. Worker can't run sharp/native code, so the
    // daemon is the only place we can shrink images — without these variants
    // the gallery falls back to serving the 6.6 MB original for thumb AND web.
    for (let i = 0; i < count; i++) {
      const photoId = randomId();
      const fullKey  = `galleries/${galleryId}/full/${photoId}.jpg`;
      const thumbKey = `galleries/${galleryId}/thumb/${photoId}.jpg`;
      const webKey   = `galleries/${galleryId}/web/${photoId}.jpg`;
      const [fullUrl, thumbUrl, webUrl] = await Promise.all([
        presignR2Put(env, bucket, fullKey),
        presignR2Put(env, bucket, thumbKey),
        presignR2Put(env, bucket, webKey)
      ]);
      results.push({ photoId, fullKey, fullUrl, thumbKey, thumbUrl, webKey, webUrl });
    }

    return json({ uploads: results });
  } catch (e) {
    console.error('[handleGetPresignedUrls] error:', e.message, e.stack);
    return json({ error: 'Failed to generate presigned URLs: ' + e.message }, 500);
  }
}

// ── MULTIPART INIT — call S3 CreateMultipartUpload, return uploadId + N presigned part URLs + complete URL ──
// Browser passes { fullKey, partCount } per file. We do init, then presign every part PUT and the complete POST.
// Daemon then uploads all parts in parallel and posts complete.
async function handleMultipartInit(request, env, session, galleryId) {
  try {
    if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
    const gallery = await env.DB.prepare('SELECT id FROM galleries WHERE id = ?').bind(galleryId).first();
    if (!gallery) return json({ error: 'Gallery not found' }, 404);

    const { items } = await request.json(); // [{ fullKey, partCount }]
    if (!Array.isArray(items) || !items.length) return json({ error: 'No items' }, 400);

    const bucket = 'ivae-gallery-photos';
    const accessKey = env.R2_ACCESS_KEY_ID;
    const secretKey = env.R2_SECRET_ACCESS_KEY;
    const endpoint = env.R2_ENDPOINT;
    if (!accessKey || !secretKey || !endpoint) return json({ error: 'R2 not configured' }, 500);

    const out = [];
    for (const item of items) {
      const key = item.fullKey;
      const partCount = Math.min(Math.max(1, item.partCount | 0), 1000);

      // 1. CreateMultipartUpload — direct call (not presigned), Worker has creds.
      const initUrl = `${endpoint}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}?uploads=`;
      const initSigned = await signedFetchUrl(env, 'POST', endpoint, bucket, key, { uploads: '' });
      const initRes = await fetch(initSigned.url, { method: 'POST', headers: initSigned.headers });
      if (!initRes.ok) {
        const body = await initRes.text().catch(() => '');
        return json({ error: `CreateMultipartUpload failed: ${initRes.status} ${body.slice(0, 200)}` }, 500);
      }
      const initXml = await initRes.text();
      const uploadId = (initXml.match(/<UploadId>([^<]+)<\/UploadId>/) || [])[1];
      if (!uploadId) return json({ error: 'No UploadId from R2' }, 500);

      // 2. Presign each part PUT.
      const partUrls = [];
      for (let i = 1; i <= partCount; i++) {
        const url = await presignR2Op(env, {
          method: 'PUT', bucket, key,
          extraQuery: { partNumber: String(i), uploadId }
        });
        partUrls.push(url);
      }

      // 3. Presign the CompleteMultipartUpload POST.
      const completeUrl = await presignR2Op(env, {
        method: 'POST', bucket, key,
        extraQuery: { uploadId }
      });

      out.push({ fullKey: key, uploadId, partUrls, completeUrl });
    }

    return json({ items: out });
  } catch (e) {
    console.error('[handleMultipartInit] error:', e.message, e.stack);
    return json({ error: 'Multipart init failed: ' + e.message }, 500);
  }
}

// Direct (non-presigned) signed request helper — used by Worker for the
// CreateMultipartUpload call. Returns { url, headers } ready for fetch().
async function signedFetchUrl(env, method, endpoint, bucket, key, queryParams = {}) {
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const host = new URL(endpoint).host;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQuery = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');

  const payloadHash = 'UNSIGNED-PAYLOAD';
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const sortedHeaderKeys = Object.keys(headers).map(h => h.toLowerCase()).sort();
  const canonicalHeaders = sortedHeaderKeys.map(h => `${h}:${headers[h]}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const finalUrl = canonicalQuery ? `${endpoint}${canonicalUri}?${canonicalQuery}` : `${endpoint}${canonicalUri}`;
  return { url: finalUrl, headers: { ...headers, Authorization: authHeader } };
}

async function handleConfirmUpload(request, env, session, galleryId) {
  try {
    if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
    const { photos: items } = await request.json();
    if (!Array.isArray(items) || !items.length) return json({ error: 'No photos to confirm' }, 400);

    // Batch insert — 10 columns. width/height + thumb_key/web_key come from
    // the daemon (sharp.metadata + sharp.resize); they are NULL when the
    // direct-R2 fallback ran or the daemon couldn't generate the variant.
    // /thumb and /web endpoints handle NULL keys by serving the original.
    const baseOrder = Date.now();
    const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const values = [];
    items.forEach((p, idx) => {
      values.push(
        p.photoId,
        galleryId,
        p.filename || 'photo.jpg',
        p.fullKey,
        p.size || 0,
        baseOrder + idx,
        Number.isInteger(p.width)  && p.width  > 0 ? p.width  : null,
        Number.isInteger(p.height) && p.height > 0 ? p.height : null,
        typeof p.thumbKey === 'string' && p.thumbKey ? p.thumbKey : null,
        typeof p.webKey   === 'string' && p.webKey   ? p.webKey   : null
      );
    });
    await env.DB.prepare(`INSERT INTO photos (id, gallery_id, filename, r2_key, size_bytes, sort_order, width, height, thumb_key, web_key) VALUES ${placeholders}`).bind(...values).run();

    return json({ ok: true, count: items.length, photos: items.map((p, idx) => ({ id: p.photoId, filename: p.filename, sort_order: baseOrder + idx })) });
  } catch (e) {
    console.error('[handleConfirmUpload] error:', e.message, e.stack);
    return json({ error: 'Confirm failed: ' + e.message }, 500);
  }
}

// Lazy backfill: client sends naturalWidth/Height after thumb loads, we
// fill in missing dimensions for legacy photos. No JPEG parsing needed in
// the worker; the browser already decoded the image.
async function handleBackfillDimensions(request, env) {
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || !items.length) return json({ error: 'No items' }, 400);
    const stmts = [];
    for (const it of items) {
      const w = Number.isInteger(it.width) ? it.width : parseInt(it.width);
      const h = Number.isInteger(it.height) ? it.height : parseInt(it.height);
      if (!it.photoId || !w || !h || w < 1 || h < 1) continue;
      stmts.push(env.DB.prepare('UPDATE photos SET width = ?, height = ? WHERE id = ? AND (width IS NULL OR height IS NULL)').bind(w, h, it.photoId));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, updated: stmts.length });
  } catch (e) {
    console.error('[handleBackfillDimensions] error:', e.message);
    return json({ error: 'Backfill failed: ' + e.message }, 500);
  }
}

// Parse JPEG width/height from raw bytes by walking the marker chain.
// Returns {width, height} or null. Handles SOF0/SOF1/SOF2/SOF3/SOF5..SOF15.
// Reads at most ~64KB — enough to clear the EXIF block and reach the SOF.
function parseJpegDimensions(bytes) {
  // SOI: FF D8
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let i = 2;
  while (i < bytes.length - 9) {
    // Skip 0xFF padding
    while (i < bytes.length && bytes[i] === 0xFF) i++;
    if (i >= bytes.length) return null;
    const marker = bytes[i]; i++;
    // Standalone markers (no length): D0..D7 RST, D8 SOI, D9 EOI, 01 TEM
    if (marker === 0xD9 || marker === 0xDA || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      // SOS (DA) means image data starts; bail.
      if (marker === 0xDA) return null;
      continue;
    }
    if (i + 1 >= bytes.length) return null;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    if (segLen < 2) return null;
    // SOF markers: C0-C3, C5-C7, C9-CB, CD-CF (skip C4=DHT, C8=JPG, CC=DAC)
    const isSof =
      (marker >= 0xC0 && marker <= 0xC3) ||
      (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) ||
      (marker >= 0xCD && marker <= 0xCF);
    if (isSof) {
      // Layout after segLen: 1 byte precision, 2 bytes height, 2 bytes width
      if (i + 7 >= bytes.length) return null;
      const height = (bytes[i + 3] << 8) | bytes[i + 4];
      const width  = (bytes[i + 5] << 8) | bytes[i + 6];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    i += segLen;
  }
  return null;
}

// Core repair logic shared by the per-gallery endpoint and the admin
// "backfill across all galleries" endpoint. Returns a plain object so the
// caller can aggregate / decide on HTTP shape. Throws on hard failure.
//
// Options:
//   - maxPhotos: if the gallery has more than this many NULL-dim photos,
//     return { skipped: true, scanned } without doing any R2 fetches.
//     This keeps the all-galleries sweep under the 30s worker CPU budget.
async function repairGalleryDimsCore(env, galleryId, { maxPhotos = Infinity } = {}) {
  const rows = await env.DB.prepare(
    'SELECT id, r2_key, thumb_key FROM photos WHERE gallery_id = ? AND (width IS NULL OR height IS NULL)'
  ).bind(galleryId).all();
  const targets = rows.results || [];
  if (!targets.length) return { scanned: 0, repaired: 0, failed: 0, failures: [], skipped: false };

  if (targets.length > maxPhotos) {
    return { scanned: targets.length, repaired: 0, failed: 0, failures: [], skipped: true };
  }

  let repaired = 0;
  const failed = [];
  const stmts = [];
  // Process in small parallel batches so we don't exhaust subrequest budget.
  const BATCH = 6;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (p) => {
      // Prefer thumb (smaller fetch) if it exists; fall back to original.
      const key = p.thumb_key || p.r2_key;
      if (!key) return { id: p.id, ok: false, reason: 'no key' };
      try {
        const obj = await env.R2_BUCKET.get(key, { range: { offset: 0, length: 65536 } });
        if (!obj) return { id: p.id, ok: false, reason: 'not in R2' };
        const buf = new Uint8Array(await obj.arrayBuffer());
        const dims = parseJpegDimensions(buf);
        if (!dims) return { id: p.id, ok: false, reason: 'parse failed' };
        return { id: p.id, ok: true, ...dims };
      } catch (e) {
        return { id: p.id, ok: false, reason: e.message };
      }
    }));
    for (const r of results) {
      if (r.ok) {
        stmts.push(env.DB.prepare('UPDATE photos SET width = ?, height = ? WHERE id = ? AND (width IS NULL OR height IS NULL)').bind(r.width, r.height, r.id));
        repaired++;
      } else {
        failed.push({ id: r.id, reason: r.reason });
      }
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { scanned: targets.length, repaired, failed: failed.length, failures: failed.slice(0, 10), skipped: false };
}

// Admin one-click repair: scan a gallery for photos with NULL width/height,
// fetch the first 64KB of each from R2, parse the JPEG SOF marker, and
// backfill the dimensions in D1. Removes the regression where direct-R2
// uploads landed without dims and rendered as squares.
async function handleRepairGalleryDims(env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  try {
    const r = await repairGalleryDimsCore(env, galleryId);
    if (!r.scanned) return json({ ok: true, scanned: 0, repaired: 0, message: 'All photos already have dimensions' });
    return json({ ok: true, scanned: r.scanned, repaired: r.repaired, failed: r.failed, failures: r.failures });
  } catch (e) {
    console.error('[handleRepairGalleryDims]', e.message, e.stack);
    return json({ error: 'Repair failed: ' + e.message }, 500);
  }
}

// Admin sweep: scan EVERY gallery for photos with NULL width/height and
// backfill them. The schema is single-tenant (no owner_id on galleries),
// so any admin gets every gallery. Per-gallery work is capped at
// PER_GALLERY_CAP photos so a single huge gallery can't push the worker
// past the 30s CPU budget — those are reported under `skipped` and the
// admin can run the per-gallery endpoint manually.
async function handleAdminBackfillAll(env, session) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  try {
    // Per-gallery cap. With BATCH=6 parallel R2 range-reads at ~500ms each,
    // 100 photos ≈ 17 sequential rounds ≈ ~9s of wall time — comfortably
    // under the 30s CPU limit even with several galleries in one request.
    const PER_GALLERY_CAP = 100;
    const rows = await env.DB.prepare('SELECT DISTINCT id FROM galleries').all();
    const galleries = rows.results || [];
    const perGallery = [];
    const skipped = [];
    let scanned = 0;
    let fixed = 0;
    for (const g of galleries) {
      try {
        const r = await repairGalleryDimsCore(env, g.id, { maxPhotos: PER_GALLERY_CAP });
        if (r.skipped) {
          console.warn('[handleAdminBackfillAll] skipped gallery', g.id, 'with', r.scanned, 'NULL-dim photos (>cap)');
          skipped.push({ galleryId: g.id, scanned: r.scanned });
          continue;
        }
        if (r.scanned) {
          perGallery.push({ galleryId: g.id, scanned: r.scanned, fixed: r.repaired });
          scanned += r.scanned;
          fixed += r.repaired;
        }
      } catch (e) {
        console.error('[handleAdminBackfillAll] gallery', g.id, 'failed:', e.message);
        perGallery.push({ galleryId: g.id, error: e.message });
      }
    }
    return json({ ok: true, galleries: galleries.length, scanned, fixed, perGallery, skipped });
  } catch (e) {
    console.error('[handleAdminBackfillAll]', e.message, e.stack);
    return json({ error: 'Backfill-all failed: ' + e.message }, 500);
  }
}

async function handleDeletePhoto(env, session, photoId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const photo = await env.DB.prepare('SELECT r2_key, thumb_key, web_key FROM photos WHERE id = ?').bind(photoId).first();
  if (!photo) return json({ error: 'Photo not found' }, 404);
  const deletes = [];
  if (photo.r2_key) deletes.push(env.R2_BUCKET.delete(photo.r2_key));
  if (photo.thumb_key) deletes.push(env.R2_BUCKET.delete(photo.thumb_key));
  if (photo.web_key) deletes.push(env.R2_BUCKET.delete(photo.web_key));
  await Promise.all(deletes);
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();
  return json({ ok: true });
}

async function handleBulkDeletePhotos(request, env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const { photo_ids } = await request.json();
  if (!Array.isArray(photo_ids) || !photo_ids.length) return json({ error: 'No photos specified' }, 400);
  const placeholders = photo_ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT r2_key, thumb_key, web_key FROM photos WHERE id IN (${placeholders}) AND gallery_id = ?`).bind(...photo_ids, galleryId).all();
  const deletes = [];
  for (const p of (rows.results || [])) {
    if (p.r2_key) deletes.push(env.R2_BUCKET.delete(p.r2_key));
    if (p.thumb_key) deletes.push(env.R2_BUCKET.delete(p.thumb_key));
    if (p.web_key) deletes.push(env.R2_BUCKET.delete(p.web_key));
  }
  await Promise.all(deletes);
  await env.DB.prepare(`DELETE FROM photos WHERE id IN (${placeholders}) AND gallery_id = ?`).bind(...photo_ids, galleryId).run();
  return json({ ok: true, deleted: rows.results?.length || 0 });
}

// Tiny gray 1×1 JPEG placeholder served when NO variant exists (instead of
// blowing the user's mobile data with a 17MB original). Browser will paint
// it stretched to the cell — visually muted but keeps layout intact.
const PLACEHOLDER_JPEG_B64 = '/9j/2wCEAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDIBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAAEAAQMBIgACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
let _placeholderBytes = null;
function getPlaceholderBytes() {
  if (_placeholderBytes) return _placeholderBytes;
  const bin = atob(PLACEHOLDER_JPEG_B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  _placeholderBytes = arr;
  return arr;
}

async function handleGetThumb(request, env, session, photoId, ctx) {
  return serveResized(request, env, session, photoId, 800, 'thumb', ctx);
}

// Serves a resized JPEG.
// PERF — three layers:
//   1. Cloudflare edge cache (caches.default) — checked BEFORE auth/D1.
//      Returns immediately on cache hit (no D1 queries, no R2 fetch).
//   2. R2 variant (thumb_key or web_key) — small file, cached by browser.
//   3. Fallback chain: thumb → web → tiny placeholder. NEVER serves the
//      multi-MB original from /thumb (that's what was killing mobile).
async function serveResized(request, env, session, photoId, maxWidth, variant, ctx) {
  // 1. Edge cache check — short-circuit before any work
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const etag = `"${photoId}-${variant}"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': etag } });
  }

  const photo = await env.DB.prepare('SELECT p.thumb_key, p.web_key, p.r2_key, p.gallery_id, p.filename FROM photos p WHERE p.id = ?').bind(photoId).first();
  if (!photo) return new Response('Not found', { status: 404 });

  // Access check
  if (!session || session.role !== 'admin') {
    const hasAccess = session ? await env.DB.prepare('SELECT 1 FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(photo.gallery_id, session.user_id).first() : null;
    if (!hasAccess) {
      const isPortfolio = await env.DB.prepare('SELECT 1 FROM galleries WHERE id = ? AND show_on_portfolio = 1 AND status = ?').bind(photo.gallery_id, 'published').first();
      if (!isPortfolio) return new Response('Forbidden', { status: 403 });
    }
  }

  // Pick variant: prefer the requested one, fall back to the OTHER variant
  // (smaller than original), and only as a LAST resort serve the placeholder.
  // Never serve the multi-MB original from /thumb or /web — that destroys
  // mobile clients on cellular.
  const primary = variant === 'thumb' ? photo.thumb_key : photo.web_key;
  const secondary = variant === 'thumb' ? photo.web_key : photo.thumb_key;
  const chosenKey = primary || secondary;

  const isDownload = new URL(request.url).searchParams.get('download') === '1';

  let response;
  if (chosenKey) {
    const obj = await env.R2_BUCKET.get(chosenKey);
    if (obj) {
      const headers = {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'X-Variant': primary ? variant : (variant === 'thumb' ? 'web-fallback' : 'thumb-fallback')
      };
      if (isDownload && photo.filename) headers['Content-Disposition'] = `attachment; filename="${photo.filename}"`;
      response = new Response(obj.body, { headers });
    }
  }

  if (!response) {
    // No variant at all — serve placeholder. Mobile-safe.
    // Vianey needs to re-upload via daemon v1.4.0 to generate variants.
    const ph = getPlaceholderBytes();
    response = new Response(ph, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300',
        'ETag': `"${photoId}-placeholder"`,
        'X-Variant': 'placeholder-no-variant',
        'X-Photo-Needs-Reupload': '1'
      }
    });
  }

  // Cache at edge. Use ctx.waitUntil so the response ships immediately.
  if (ctx && response.headers.get('X-Variant') !== 'placeholder-no-variant') {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  // Audit log explicit downloads (?download=1 from gallery.html "Web-Size"
  // button). Plain previews are not logged — only the user-initiated save.
  // Also skip when an admin is browsing their own studio.
  if (isDownload && response.status === 200 && (!session || session.role !== 'admin')) {
    const p = logDownload(env, request, photoId, variant);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p);
    else p.catch(() => {});
  }
  return response;
}

async function handleGetWeb(request, env, session, photoId, ctx) {
  return serveResized(request, env, session, photoId, 2400, 'web', ctx);
}

async function handleGetFull(request, env, session, photoId, ctx) {
  const etag = `"${photoId}-full"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { 'Cache-Control': 'private, max-age=3600', 'ETag': etag } });
  }

  const photo = await env.DB.prepare('SELECT p.r2_key, p.filename, p.gallery_id FROM photos p WHERE p.id = ?').bind(photoId).first();
  if (!photo) return new Response('Not found', { status: 404 });

  if (!session || session.role !== 'admin') {
    const hasAccess = session ? await env.DB.prepare('SELECT 1 FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(photo.gallery_id, session.user_id).first() : null;
    if (!hasAccess) {
      const isPortfolio = await env.DB.prepare('SELECT 1 FROM galleries WHERE id = ? AND show_on_portfolio = 1 AND status = ?').bind(photo.gallery_id, 'published').first();
      if (!isPortfolio) return new Response('Forbidden', { status: 403 });
    }
  }

  const obj = await env.R2_BUCKET.get(photo.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });

  // Audit log: /full is always served as an attachment, so every successful
  // hit is a download. Skip when admin is viewing their own studio (no value
  // in self-logged events) — but still record client/portfolio downloads.
  if (!session || session.role !== 'admin') {
    const p = logDownload(env, request, photoId, 'full');
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p);
    else p.catch(() => {});
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${photo.filename}"`,
      'Cache-Control': 'private, max-age=3600',
      'ETag': etag
    }
  });
}

// ── SELECTION HANDLERS ──
async function handleToggleSelection(env, session, photoId) {
  const photo = await env.DB.prepare('SELECT gallery_id FROM photos WHERE id = ?').bind(photoId).first();
  if (!photo) return json({ error: 'Photo not found' }, 404);

  if (session.role !== 'admin') {
    const access = await env.DB.prepare('SELECT 1 FROM gallery_access WHERE gallery_id = ? AND user_id = ?').bind(photo.gallery_id, session.user_id).first();
    if (!access) return json({ error: 'Access denied' }, 403);
  }

  const existing = await env.DB.prepare('SELECT 1 FROM selections WHERE user_id = ? AND photo_id = ?').bind(session.user_id, photoId).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM selections WHERE user_id = ? AND photo_id = ?').bind(session.user_id, photoId).run();
    return json({ selected: false });
  } else {
    await env.DB.prepare('INSERT INTO selections (user_id, photo_id) VALUES (?, ?)').bind(session.user_id, photoId).run();
    return json({ selected: true });
  }
}

async function handleGetSelections(env, session, galleryId) {
  if (session.role === 'admin') {
    // Admin sees all clients' selections
    const rows = await env.DB.prepare(`
      SELECT u.name, u.email, p.id as photo_id, p.filename, s.selected_at
      FROM selections s
      JOIN users u ON s.user_id = u.id
      JOIN photos p ON s.photo_id = p.id
      WHERE p.gallery_id = ?
      ORDER BY u.name, s.selected_at
    `).bind(galleryId).all();
    return json(rows.results || []);
  } else {
    const rows = await env.DB.prepare(`
      SELECT p.id as photo_id, p.filename, s.selected_at
      FROM selections s JOIN photos p ON s.photo_id = p.id
      WHERE s.user_id = ? AND p.gallery_id = ?
    `).bind(session.user_id, galleryId).all();
    return json(rows.results || []);
  }
}

// ── ADMIN HANDLERS ──
// Returns dashboard counters + a daily activity series.
// Query params:
//   period = 7 | 30 | 90 | all (default 30) — controls the activity series window.
async function handleAdminStats(request, env, session) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const url = new URL(request.url);
  const periodRaw = (url.searchParams.get('period') || '30').toLowerCase();
  const days = periodRaw === 'all' ? 365 : Math.max(1, Math.min(365, parseInt(periodRaw, 10) || 30));

  // Totals (always lifetime — period scopes only the activity series).
  const galleries = await env.DB.prepare('SELECT COUNT(*) as c FROM galleries').first();
  const photos = await env.DB.prepare(
    'SELECT COUNT(*) as c, COALESCE(SUM(size_bytes),0) as total_bytes FROM photos'
  ).first();
  const clients = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
  const published = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM galleries WHERE status = 'published'"
  ).first();

  // Daily activity series: count whichever signals we have (visitor_log,
  // proof_submissions, gallery_events). Each table is best-effort — if a
  // migration hasn't run yet the query just returns 0 for that day.
  const series = await buildActivitySeries(env, days);

  // Storage limit comes from studio_settings (single row).
  let storageLimitGb = 10;
  try {
    const s = await env.DB.prepare('SELECT storage_limit_gb FROM studio_settings WHERE id = ?')
      .bind('studio').first();
    if (s && s.storage_limit_gb) storageLimitGb = s.storage_limit_gb;
  } catch { /* table may not exist on first deploy */ }

  return json({
    totalGalleries: galleries.c,
    totalPhotos: photos.c,
    totalClients: clients.c,
    publishedGalleries: published.c,
    storageBytes: photos.total_bytes,
    storageLimitBytes: storageLimitGb * 1024 * 1024 * 1024,
    period: { days, label: periodRaw },
    series // [{ date: 'YYYY-MM-DD', visits, proofs, events, total }, ...]
  });
}

// Builds a per-day activity series for the dashboard chart from the available
// signal tables. Resilient: if any table is missing, that source contributes 0.
async function buildActivitySeries(env, days) {
  const today = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.push({
      date: d.toISOString().slice(0, 10),
      visits: 0, proofs: 0, events: 0, total: 0
    });
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.date, i]));

  const tally = async (sql, key) => {
    try {
      const r = await env.DB.prepare(sql).bind(days).all();
      for (const row of (r.results || [])) {
        if (idx[row.day] !== undefined) buckets[idx[row.day]][key] += row.c | 0;
      }
    } catch { /* table missing; skip */ }
  };

  await tally(
    `SELECT substr(registered_at,1,10) as day, COUNT(*) as c FROM visitor_log
       WHERE registered_at >= datetime('now', '-' || ? || ' days')
       GROUP BY day`, 'visits');
  await tally(
    `SELECT substr(submitted_at,1,10) as day, COUNT(*) as c FROM proof_submissions
       WHERE submitted_at >= datetime('now', '-' || ? || ' days')
       GROUP BY day`, 'proofs');
  await tally(
    `SELECT substr(occurred_at,1,10) as day, COUNT(*) as c FROM gallery_events
       WHERE occurred_at >= datetime('now', '-' || ? || ' days')
       GROUP BY day`, 'events');

  for (const b of buckets) b.total = b.visits + b.proofs + b.events;
  return buckets;
}

// ── STUDIO SETTINGS HANDLERS ──
// Single-row settings table for the studio. GET reads; PUT updates whitelisted
// fields. Both admin-only.
const STUDIO_SETTINGS_FIELDS = [
  'studio_name', 'tagline', 'contact_email', 'contact_phone', 'website_url',
  'brand_primary', 'brand_accent', 'brand_bg', 'brand_logo_key',
  'brand_font_serif', 'brand_font_sans',
  'default_watermark_enabled', 'default_watermark_text',
  'default_watermark_subtext', 'default_watermark_opacity',
  'default_from_name', 'default_signature',
  'notify_admin_on_proof', 'notify_admin_on_visit',
  'storage_limit_gb',
  'default_expire_days', 'default_request_email',
  'default_allow_download', 'default_allow_sharing',
  'instagram_handle', 'pinterest_url'
];

async function handleGetStudioSettings(env, session) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  let row;
  try {
    row = await env.DB.prepare('SELECT * FROM studio_settings WHERE id = ?').bind('studio').first();
  } catch (e) {
    return json({ error: 'studio_settings table missing — run migration 004', detail: e.message }, 500);
  }
  if (!row) {
    // Lazy init if seed didn't run
    await env.DB.prepare('INSERT OR IGNORE INTO studio_settings (id) VALUES (?)').bind('studio').run();
    row = await env.DB.prepare('SELECT * FROM studio_settings WHERE id = ?').bind('studio').first();
  }
  return json(row);
}

async function handleUpdateStudioSettings(request, env, session) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const sets = []; const vals = [];
  for (const f of STUDIO_SETTINGS_FIELDS) {
    if (body[f] !== undefined) {
      // Coerce booleans into integers for SQLite.
      let v = body[f];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      sets.push(`${f} = ?`); vals.push(v);
    }
  }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);
  sets.push("updated_at = datetime('now')");
  await env.DB.prepare(`UPDATE studio_settings SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals, 'studio').run();
  const row = await env.DB.prepare('SELECT * FROM studio_settings WHERE id = ?')
    .bind('studio').first();
  return json(row);
}

// ── EVENT TRACKING (lightweight client-side analytics) ──
// Public endpoint: any visitor of a published gallery can record events.
// Accepts either a single event { type, photo_id?, meta? } or a batch
// { batch: [events] }. Tolerant of unknown types — just skips them so
// stale clients never break.
const EVENT_TYPES = new Set([
  // Legacy short names (kept so older callers still work)
  'view', 'photo_view', 'favorite', 'unfavorite', 'download', 'share', 'slideshow', 'proof_submit',
  // Names emitted by /js/track.js
  'gallery_view', 'gallery_enter', 'photo_open', 'favorite_add', 'favorite_remove',
  'slideshow_start', 'download_request', 'scene_view', 'share_click'
]);

async function handleTrackEvent(request, env, galleryId) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const events = Array.isArray(body.batch) ? body.batch : [body];

  // Only record events for galleries that exist.
  const g = await env.DB.prepare('SELECT id FROM galleries WHERE id = ?').bind(galleryId).first();
  if (!g) return json({ error: 'Not found' }, 404);

  const cookies = parseCookieHeader(request.headers.get('Cookie') || '');
  const visitor_id = cookies['pic_visit'] || body.visitor_id || null;
  const visitor_email = body.visitor_email || cookies['pic_email'] || null;

  let recorded = 0;
  for (const ev of events) {
    const type = String(ev.type || ev.event_type || '').toLowerCase();
    if (!EVENT_TYPES.has(type)) continue;
    const photo_id = (ev.photo_id && /^[a-f0-9]{32}$/.test(ev.photo_id)) ? ev.photo_id : null;
    const meta = ev.meta ? JSON.stringify(ev.meta).slice(0, 1000) : null;
    try {
      await env.DB.prepare(
        `INSERT INTO gallery_events (gallery_id, event_type, visitor_id, visitor_email, photo_id, meta)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(galleryId, type, visitor_id, visitor_email, photo_id, meta).run();
      recorded++;
    } catch (e) {
      // Table might not exist if migration didn't run yet — silently break so
      // analytics never break the client.
      return json({ ok: true, recorded });
    }
  }
  return json({ ok: true, recorded });
}

// Tiny cookie parser used by the event tracker (avoids pulling a dep in).
function parseCookieHeader(h) {
  const out = {};
  for (const part of h.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

// ── DOWNLOAD AUDIT LOG ──
// Records one row per photo download into gallery_events. Best-effort: any
// failure (missing photo, schema drift, transient D1 error) is swallowed so
// it can never block the bytes from streaming back to the client. Captures
// who (session user OR pic_email/pic_visit cookie OR null), where (cf-ip),
// what (photo_id + variant: full | web | thumb), and how (truncated UA).
async function logDownload(env, request, photoId, variant) {
  try {
    if (!photoId) return;
    const photo = await env.DB.prepare(
      'SELECT gallery_id FROM photos WHERE id = ?'
    ).bind(photoId).first();
    if (!photo) return;
    const session = await getSession(request, env);
    const cookies = parseCookieHeader(request.headers.get('Cookie') || '');
    const visitorId = session?.user_id || cookies['pic_visit'] || null;
    const visitorEmail = session?.email || cookies['pic_email'] || null;
    const ip = request.headers.get('cf-connecting-ip') || null;
    const ua = (request.headers.get('user-agent') || '').slice(0, 200);
    const meta = JSON.stringify({ variant, ip, ua });
    await env.DB.prepare(
      `INSERT INTO gallery_events (gallery_id, event_type, visitor_id, visitor_email, photo_id, meta)
       VALUES (?, 'download', ?, ?, ?, ?)`
    ).bind(photo.gallery_id, visitorId, visitorEmail, photoId, meta).run();
  } catch (e) {
    console.warn('[logDownload]', e && e.message);
  }
}

// Admin: paginated history of download events for one gallery, joined with
// photo metadata (filename) for display. ORDER BY occurred_at DESC; capped
// at 500 rows to keep response sizes sane.
async function handleGetDownloads(request, env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const url = new URL(request.url);
  let limit = parseInt(url.searchParams.get('limit') || '200', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 200;
  if (limit > 500) limit = 500;
  try {
    const rows = await env.DB.prepare(
      `SELECT e.id, e.gallery_id, e.event_type, e.visitor_id, e.visitor_email,
              e.photo_id, e.meta, e.occurred_at,
              p.filename, p.thumb_key, p.web_key
         FROM gallery_events e
         LEFT JOIN photos p ON p.id = e.photo_id
        WHERE e.gallery_id = ? AND e.event_type = 'download'
        ORDER BY e.occurred_at DESC
        LIMIT ?`
    ).bind(galleryId, limit).all();
    const downloads = (rows.results || []).map(r => {
      let meta = null;
      try { meta = r.meta ? JSON.parse(r.meta) : null; } catch { meta = null; }
      return {
        id: r.id,
        photo_id: r.photo_id,
        filename: r.filename || null,
        visitor_id: r.visitor_id,
        visitor_email: r.visitor_email,
        occurred_at: r.occurred_at,
        variant: meta?.variant || null,
        ip: meta?.ip || null,
        ua: meta?.ua || null
      };
    });
    return json({ downloads, count: downloads.length, limit });
  } catch (e) {
    return json({ error: 'Could not load downloads: ' + (e && e.message) }, 500);
  }
}

// ── EMAIL TEMPLATES + SCHEDULED SENDS (FASE 3) ──
// Renders {{var}} placeholders. The HTML form escapes values so user data
// can't break out into raw HTML; the text form does not (used for subjects).
function escHtmlForEmail(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderEmailText(text, vars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] != null ? String(vars[k]) : '');
}
function renderEmailHtml(html, vars) {
  return String(html || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => escHtmlForEmail(vars[k] != null ? vars[k] : ''));
}

// Build the variable bag that templates can reference.
async function buildEmailVars(env, gallery, user, accessPassword) {
  const settings = await env.DB.prepare('SELECT * FROM studio_settings WHERE id = ?').bind('studio').first().catch(() => null);
  // Direct-to-gallery URL (skip legacy /?redirect=... dance — see handleSendInviteEmail).
  const galleryUrl = `https://ivaestudios.com/gallery/gallery?id=${gallery.id}`;
  let photoCount = 0;
  try {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE gallery_id = ?').bind(gallery.id).first();
    photoCount = c?.n || 0;
  } catch {}
  let daysUntilExpire = '';
  let expireDate = '';
  if (gallery.expire_date) {
    expireDate = new Date(gallery.expire_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const ms = new Date(gallery.expire_date) - new Date();
    daysUntilExpire = Math.max(0, Math.ceil(ms / 86400000));
  }
  return {
    client_name: (user && user.name) || (user && user.email && user.email.split('@')[0]) || 'there',
    client_email: (user && user.email) || '',
    gallery_title: gallery.title || '',
    gallery_url: galleryUrl,
    studio_name: (settings && settings.studio_name) || 'IVAE Studios',
    tagline: (settings && settings.tagline) || '',
    contact_email: (settings && settings.contact_email) || 'gallery@ivaestudios.com',
    instagram_handle: (settings && settings.instagram_handle) || 'ivaestudios',
    expire_date: expireDate,
    days_until_expire: String(daysUntilExpire),
    photo_count: String(photoCount),
    access_password: accessPassword || ''
  };
}

async function sendEmailViaResend(env, { from, to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
  const payload = {
    from: from || 'IVAE Studios <gallery@ivaestudios.com>',
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: html
  };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('Resend ' + res.status + ': ' + detail.slice(0, 200));
  }
  return res.json().catch(() => ({}));
}

// ── EMAIL TEMPLATES CRUD ──
async function handleListEmailTemplates(env, session) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  try {
    const rows = await env.DB.prepare('SELECT id, name, trigger, enabled, delay_days, subject, body_html, reply_to, updated_at FROM email_templates ORDER BY updated_at DESC').all();
    return json({ templates: rows.results || [] });
  } catch (e) {
    return json({ error: 'email_templates table missing — run migration 005', detail: e.message }, 500);
  }
}

async function handleUpdateEmailTemplate(request, env, session, id) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const allowed = ['name', 'subject', 'body_html', 'enabled', 'delay_days', 'reply_to'];
  const sets = []; const vals = [];
  for (const f of allowed) {
    if (body[f] !== undefined) {
      let v = body[f];
      if (f === 'enabled') v = v ? 1 : 0;
      if (f === 'delay_days') v = parseInt(v, 10) || 0;
      sets.push(`${f} = ?`); vals.push(v);
    }
  }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  try {
    await env.DB.prepare(`UPDATE email_templates SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    const row = await env.DB.prepare('SELECT id, name, trigger, enabled, delay_days, subject, body_html, reply_to, updated_at FROM email_templates WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'Template not found' }, 404);
    return json({ ok: true, template: row });
  } catch (e) {
    return json({ error: 'Update failed', detail: e.message }, 500);
  }
}

async function handleTestEmailTemplate(request, env, session, id) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  if (!env.RESEND_API_KEY) return json({ error: 'Email service not configured. Add RESEND_API_KEY secret.' }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const to = String(body.to || '').trim();
  if (!/.+@.+\..+/.test(to)) return json({ error: 'Invalid recipient email' }, 400);

  let template;
  try {
    template = await env.DB.prepare('SELECT id, name, subject, body_html, reply_to FROM email_templates WHERE id = ?').bind(id).first();
  } catch (e) {
    return json({ error: 'email_templates table missing — run migration 005' }, 500);
  }
  if (!template) return json({ error: 'Template not found' }, 404);

  // Apply in-progress draft if provided so the test reflects unsaved edits.
  if (body.draft) {
    if (typeof body.draft.subject === 'string') template.subject = body.draft.subject;
    if (typeof body.draft.body_html === 'string') template.body_html = body.draft.body_html;
    if (typeof body.draft.reply_to === 'string') template.reply_to = body.draft.reply_to || null;
  }

  // Synthesize sample vars (admin test — no real gallery context).
  const settings = await env.DB.prepare('SELECT * FROM studio_settings WHERE id = ?').bind('studio').first().catch(() => null);
  const sample = {
    client_name: 'Maria Lopez',
    client_email: to,
    gallery_title: 'Wedding · Riviera Maya',
    gallery_url: 'https://ivaestudios.com/gallery/',
    studio_name: (settings && settings.studio_name) || 'IVAE Studios',
    tagline: (settings && settings.tagline) || 'Resort photography in Cancún',
    contact_email: (settings && settings.contact_email) || 'gallery@ivaestudios.com',
    instagram_handle: (settings && settings.instagram_handle) || 'ivaestudios',
    expire_date: 'May 15, 2026',
    days_until_expire: '21',
    photo_count: '342'
  };
  const subject = '[TEST] ' + renderEmailText(template.subject, sample);
  const html = renderEmailHtml(template.body_html, sample);

  try {
    await sendEmailViaResend(env, { to, subject, html, replyTo: template.reply_to });
    return json({ ok: true, sent_to: to });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── AUTO-PUBLISH TRIGGER ──
// Called from handleUpdateGallery whenever a gallery's status transitions
// to 'published' (regardless of how — admin click, scheduled, etc).
// 1. Stamps delivered_at the first time only (so re-publish doesn't reset clock).
// 2. Sends the 'invite' template immediately to every gallery_access user.
// 3. Queues 'testimonial' (delivery + delay_days) and 'anniversary' rows
//    in scheduled_emails for each user.
async function handleGalleryPublished(env, galleryId) {
  let gallery;
  try {
    gallery = await env.DB.prepare('SELECT id, title, description, status, delivered_at, expire_date FROM galleries WHERE id = ?').bind(galleryId).first();
  } catch (e) { console.error('[publish trigger] read failed', e.message); return; }
  if (!gallery || gallery.status !== 'published') return;

  // 1. Stamp delivered_at if first publish
  let isFirstPublish = false;
  if (!gallery.delivered_at) {
    isFirstPublish = true;
    try {
      await env.DB.prepare("UPDATE galleries SET delivered_at = datetime('now') WHERE id = ? AND delivered_at IS NULL").bind(galleryId).run();
      gallery.delivered_at = new Date().toISOString();
    } catch (e) { console.error('[publish trigger] stamp delivered_at', e.message); }
  }

  // 2. Find all clients with access
  let access = [];
  try {
    const rows = await env.DB.prepare(`
      SELECT u.id, u.name, u.email, ga.access_password
        FROM gallery_access ga
        JOIN users u ON u.id = ga.user_id
       WHERE ga.gallery_id = ?
    `).bind(galleryId).all();
    access = rows.results || [];
  } catch (e) { console.error('[publish trigger] access lookup', e.message); return; }
  if (!access.length) { console.log('[publish trigger] no access grants for', galleryId); return; }

  // 3. Load relevant templates
  let templates = {};
  try {
    const rows = await env.DB.prepare(`
      SELECT id, trigger, enabled, delay_days, subject, body_html, reply_to
        FROM email_templates
       WHERE trigger IN ('on_publish', 'on_delivery_plus_7d', 'on_anniversary')
    `).all();
    for (const t of (rows.results || [])) templates[t.trigger] = t;
  } catch (e) { console.error('[publish trigger] templates', e.message); }

  for (const u of access) {
    const vars = await buildEmailVars(env, gallery, u, u.access_password);

    // 3a. Send invite immediately (only on first publish — re-publish doesn't re-invite)
    const invite = templates['on_publish'];
    if (isFirstPublish && invite && invite.enabled && env.RESEND_API_KEY) {
      try {
        await sendEmailViaResend(env, {
          to: u.email,
          subject: renderEmailText(invite.subject, vars),
          html: renderEmailHtml(invite.body_html, vars),
          replyTo: invite.reply_to || vars.contact_email
        });
      } catch (e) { console.error('[publish trigger] invite send', u.email, e.message); }
    }

    // 3b. Queue scheduled templates
    for (const trig of ['on_delivery_plus_7d', 'on_anniversary']) {
      const t = templates[trig];
      if (!t || !t.enabled) continue;
      const delay = Number(t.delay_days || (trig === 'on_anniversary' ? 365 : 7));
      const sendAfter = `datetime('${gallery.delivered_at.replace(/'/g, "''")}', '+${delay} days')`;
      try {
        // Idempotent: only queue if not already queued for this (template, gallery, recipient).
        const existing = await env.DB.prepare(
          'SELECT id FROM scheduled_emails WHERE template_id = ? AND gallery_id = ? AND recipient_email = ? AND sent_at IS NULL'
        ).bind(t.id, galleryId, u.email).first();
        if (existing) continue;
        await env.DB.prepare(`
          INSERT INTO scheduled_emails (template_id, gallery_id, recipient_email, recipient_name, send_after)
          VALUES (?, ?, ?, ?, ${sendAfter})
        `).bind(t.id, galleryId, u.email, u.name || null).run();
      } catch (e) { console.error('[publish trigger] queue', trig, u.email, e.message); }
    }
  }
}

// ── EMAIL QUEUE SWEEP (cron) ──
// Picks scheduled_emails where send_after <= now AND sent_at IS NULL,
// renders the matching template fresh (so admin edits since queue time
// take effect), sends, and stamps sent_at or error.
async function handleEmailQueueSweep(env) {
  if (!env.RESEND_API_KEY) { console.log('[email sweep] RESEND_API_KEY missing'); return; }
  let due;
  try {
    due = await env.DB.prepare(`
      SELECT se.id, se.template_id, se.gallery_id, se.recipient_email, se.recipient_name,
             t.enabled AS tpl_enabled, t.subject AS tpl_subject, t.body_html AS tpl_body,
             t.reply_to AS tpl_reply
        FROM scheduled_emails se
        JOIN email_templates t ON t.id = se.template_id
       WHERE se.sent_at IS NULL
         AND datetime(se.send_after) <= datetime('now')
       LIMIT 100
    `).all();
  } catch (e) { console.error('[email sweep] query', e.message); return; }

  for (const row of (due.results || [])) {
    if (!row.tpl_enabled) {
      // Template disabled — skip silently (don't mark sent so admin can re-enable)
      try {
        await env.DB.prepare("UPDATE scheduled_emails SET error = 'template disabled' WHERE id = ?").bind(row.id).run();
      } catch {}
      continue;
    }
    let gallery, user;
    try {
      gallery = await env.DB.prepare('SELECT id, title, description, expire_date, delivered_at FROM galleries WHERE id = ?').bind(row.gallery_id).first();
      user = await env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(row.recipient_email).first();
    } catch (e) { console.error('[email sweep] context', e.message); continue; }
    if (!gallery) {
      try { await env.DB.prepare("UPDATE scheduled_emails SET error = 'gallery removed' WHERE id = ?").bind(row.id).run(); } catch {}
      continue;
    }
    const vars = await buildEmailVars(env, gallery, user || { email: row.recipient_email, name: row.recipient_name });
    try {
      await sendEmailViaResend(env, {
        to: row.recipient_email,
        subject: renderEmailText(row.tpl_subject, vars),
        html: renderEmailHtml(row.tpl_body, vars),
        replyTo: row.tpl_reply || vars.contact_email
      });
      await env.DB.prepare("UPDATE scheduled_emails SET sent_at = datetime('now'), error = NULL WHERE id = ?").bind(row.id).run();
    } catch (e) {
      console.error('[email sweep] send', row.recipient_email, e.message);
      try { await env.DB.prepare("UPDATE scheduled_emails SET error = ? WHERE id = ?").bind(e.message.slice(0, 500), row.id).run(); } catch {}
    }
  }
}

// ── WORKFLOW TIMELINE (FASE 1B) ──
// Merges gallery_events + visitor_log + proof_submissions into a single feed.
async function handleGetTimeline(request, env, session) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const url = new URL(request.url);
  let days = parseInt(url.searchParams.get('days') || '30', 10);
  if (![7, 30, 90].includes(days)) days = 30;
  const since = `datetime('now', '-${days} days')`;
  const events = [];

  // Gallery events (views, favorites, photo opens, etc.)
  try {
    const rows = await env.DB.prepare(`
      SELECT e.event_type, e.gallery_id, g.title AS gallery_title,
             e.visitor_email, e.occurred_at, e.meta
        FROM gallery_events e
        LEFT JOIN galleries g ON g.id = e.gallery_id
       WHERE datetime(e.occurred_at) >= ${since}
       ORDER BY e.occurred_at DESC
       LIMIT 250
    `).all();
    for (const r of (rows.results || [])) {
      const actor = r.visitor_email || 'A guest';
      let label;
      switch (r.event_type) {
        case 'gallery_view':
        case 'view':
          label = `${actor} viewed ${r.gallery_title || 'a gallery'}`; break;
        case 'gallery_enter':
          label = `${actor} entered ${r.gallery_title || 'the gallery'}`; break;
        case 'photo_open':
        case 'photo_view':
          label = `${actor} opened a photo in ${r.gallery_title || 'a gallery'}`; break;
        case 'favorite_add':
        case 'favorite':
          label = `${actor} favorited a photo in ${r.gallery_title || 'a gallery'}`; break;
        case 'favorite_remove':
        case 'unfavorite':
          label = `${actor} removed a favorite in ${r.gallery_title || 'a gallery'}`; break;
        case 'slideshow_start':
        case 'slideshow':
          label = `${actor} started slideshow in ${r.gallery_title || 'a gallery'}`; break;
        case 'download_request':
        case 'download':
          label = `${actor} downloaded from ${r.gallery_title || 'a gallery'}`; break;
        case 'share_click':
        case 'share':
          label = `${actor} shared ${r.gallery_title || 'a gallery'}`; break;
        case 'scene_view':
          label = `${actor} viewed a scene in ${r.gallery_title || 'a gallery'}`; break;
        default:
          label = `${actor}: ${r.event_type}`;
      }
      events.push({
        type: r.event_type,
        gallery_id: r.gallery_id,
        gallery_title: r.gallery_title || '',
        when: r.occurred_at,
        actor: r.visitor_email,
        label,
        meta: r.meta ? safeJsonParse(r.meta) : null
      });
    }
  } catch (e) { console.warn('[timeline] gallery_events', e.message); }

  // Visitor registrations (email-gate signups)
  try {
    const rows = await env.DB.prepare(`
      SELECT v.email, v.name, v.registered_at, v.gallery_id, g.title AS gallery_title
        FROM visitor_log v
        LEFT JOIN galleries g ON g.id = v.gallery_id
       WHERE datetime(v.registered_at) >= ${since}
       ORDER BY v.registered_at DESC
       LIMIT 100
    `).all();
    for (const r of (rows.results || [])) {
      const actor = r.name || r.email;
      events.push({
        type: 'visit',
        gallery_id: r.gallery_id,
        gallery_title: r.gallery_title || '',
        when: r.registered_at,
        actor: r.email,
        label: `${actor} signed in to ${r.gallery_title || 'a gallery'}`,
        meta: { name: r.name }
      });
    }
  } catch (e) { console.warn('[timeline] visitor_log', e.message); }

  // Proof submissions
  try {
    const rows = await env.DB.prepare(`
      SELECT p.email, p.name, p.photo_ids, p.note, p.submitted_at, p.status,
             p.gallery_id, g.title AS gallery_title
        FROM proof_submissions p
        LEFT JOIN galleries g ON g.id = p.gallery_id
       WHERE datetime(p.submitted_at) >= ${since}
       ORDER BY p.submitted_at DESC
       LIMIT 100
    `).all();
    for (const r of (rows.results || [])) {
      const actor = r.name || r.email;
      let count = 0;
      try { count = (JSON.parse(r.photo_ids) || []).length; } catch {}
      events.push({
        type: 'proof',
        gallery_id: r.gallery_id,
        gallery_title: r.gallery_title || '',
        when: r.submitted_at,
        actor: r.email,
        label: `${actor} submitted ${count} selection${count === 1 ? '' : 's'} for ${r.gallery_title || 'a gallery'}`,
        meta: { count, status: r.status, note: r.note }
      });
    }
  } catch (e) { console.warn('[timeline] proof_submissions', e.message); }

  // Gallery published events (delivered_at stamps in window)
  try {
    const rows = await env.DB.prepare(`
      SELECT id, title, delivered_at
        FROM galleries
       WHERE delivered_at IS NOT NULL
         AND datetime(delivered_at) >= ${since}
       ORDER BY delivered_at DESC
       LIMIT 50
    `).all();
    for (const r of (rows.results || [])) {
      events.push({
        type: 'gallery_published',
        gallery_id: r.id,
        gallery_title: r.title,
        when: r.delivered_at,
        actor: null,
        label: `Published "${r.title}"`,
        meta: null
      });
    }
  } catch (e) { console.warn('[timeline] published', e.message); }

  // Galleries expiring in next 14 days (forward-looking)
  try {
    const rows = await env.DB.prepare(`
      SELECT id, title, expire_date
        FROM galleries
       WHERE expire_enabled = 1
         AND expire_date IS NOT NULL
         AND date(expire_date) >= date('now')
         AND date(expire_date) <= date('now', '+14 days')
       ORDER BY expire_date ASC
       LIMIT 50
    `).all();
    for (const r of (rows.results || [])) {
      const ms = new Date(r.expire_date) - new Date();
      const dleft = Math.max(0, Math.ceil(ms / 86400000));
      events.push({
        type: 'gallery_expiring',
        gallery_id: r.id,
        gallery_title: r.title,
        when: new Date().toISOString(), // surface in "today" group
        actor: null,
        label: `"${r.title}" expires in ${dleft} day${dleft === 1 ? '' : 's'}`,
        meta: { expire_date: r.expire_date, days_left: dleft }
      });
    }
  } catch (e) { console.warn('[timeline] expiring', e.message); }

  // Sort desc and cap to 200
  events.sort((a, b) => (b.when || '').localeCompare(a.when || ''));
  const capped = events.slice(0, 200);

  // Group by day for the UI
  const groups = {};
  for (const e of capped) {
    const day = (e.when || '').slice(0, 10);
    if (!groups[day]) groups[day] = { date: day, count: 0, sample_event_types: [] };
    groups[day].count++;
    if (groups[day].sample_event_types.length < 3 && !groups[day].sample_event_types.includes(e.type)) {
      groups[day].sample_event_types.push(e.type);
    }
  }
  const grouped = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  return json({ events: capped, grouped_by_day: grouped, days });
}

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

async function handleAdminClients(env, session) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const rows = await env.DB.prepare(`
    SELECT u.id, u.name, u.email, u.created_at, COUNT(DISTINCT ga.gallery_id) as gallery_count
    FROM users u LEFT JOIN gallery_access ga ON ga.user_id = u.id
    WHERE u.role = 'client'
    GROUP BY u.id ORDER BY u.created_at DESC
  `).all();
  return json(rows.results || []);
}

// ── SCENES HANDLERS ──
async function handleGetScenes(env, session, galleryId) {
  const rows = await env.DB.prepare('SELECT * FROM scenes WHERE gallery_id = ? ORDER BY sort_order ASC').bind(galleryId).all();
  return json(rows.results || []);
}

async function handleCreateScene(request, env, session, galleryId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const data = await request.json();
  const id = crypto.randomUUID().replace(/-/g, '');
  const maxOrder = await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM scenes WHERE gallery_id = ?').bind(galleryId).first();
  await env.DB.prepare('INSERT INTO scenes (id, gallery_id, name, sort_order) VALUES (?, ?, ?, ?)').bind(id, galleryId, data.name || 'Untitled', (maxOrder?.m || 0) + 1).run();
  const scene = await env.DB.prepare('SELECT * FROM scenes WHERE id = ?').bind(id).first();
  return json(scene, 201);
}

async function handleUpdateScene(request, env, session, sceneId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const data = await request.json();
  const sets = []; const vals = [];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(data.sort_order); }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);
  vals.push(sceneId);
  await env.DB.prepare(`UPDATE scenes SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  const scene = await env.DB.prepare('SELECT * FROM scenes WHERE id = ?').bind(sceneId).first();
  return json(scene);
}

async function handleDeleteScene(env, session, sceneId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  // Unassign photos from this scene
  await env.DB.prepare('UPDATE photos SET scene_id = NULL WHERE scene_id = ?').bind(sceneId).run();
  await env.DB.prepare('DELETE FROM scenes WHERE id = ?').bind(sceneId).run();
  return json({ ok: true });
}

// Persist drag-and-drop reorder from admin gallery editor.
// Receives { photo_ids: [<id1>, ...] } in the order they should appear.
// Uses a single batched D1 transaction so it's atomic.
async function handlePhotosOrder(request, env, session, galleryId) {
  if (!session || session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const ids = Array.isArray(body?.photo_ids) ? body.photo_ids : null;
  if (!ids) return json({ error: 'photo_ids required' }, 400);
  if (ids.length > 5000) return json({ error: 'Too many ids' }, 400);

  // Validate every id is a 32-char hex (matches photo id format) before binding
  for (const id of ids) {
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/i.test(id)) {
      return json({ error: 'Invalid photo id' }, 400);
    }
  }

  // Batch with D1 batched transaction. Each statement updates one photo's
  // sort_order to its new position, scoped to this gallery so we never
  // accidentally reorder photos in other galleries.
  const stmt = env.DB.prepare('UPDATE photos SET sort_order = ? WHERE id = ? AND gallery_id = ?');
  const batch = ids.map((id, idx) => stmt.bind(idx, id, galleryId));
  try {
    await env.DB.batch(batch);
  } catch (e) {
    return json({ error: 'Reorder failed: ' + (e.message || 'db error') }, 500);
  }
  return json({ ok: true, count: ids.length });
}

async function handleAssignPhotosToScene(request, env, session, sceneId) {
  if (session.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const data = await request.json();
  if (data.photo_ids && Array.isArray(data.photo_ids)) {
    for (const pid of data.photo_ids) {
      await env.DB.prepare('UPDATE photos SET scene_id = ? WHERE id = ?').bind(sceneId, pid).run();
    }
  }
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════
async function fetchHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Only handle /api/ routes
  if (!path.startsWith('/api/')) {
    return env.ASSETS.fetch(request);
  }

  // CORS for development
  if (method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  // ─ Cron sweep (bearer auth, no session) ─
  // Called by GitHub Actions (replaces the previous Worker `scheduled` cron).
  // After our prefix strip the path here is /api/admin/cron-sweep.
  if (method === 'POST' && path === '/api/admin/cron-sweep') {
    const auth = request.headers.get('Authorization') || '';
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) return json({ error: 'Unauthorized' }, 401);
    ctx.waitUntil(handleExpiryWarn(env));
    ctx.waitUntil(handleEmailQueueSweep(env));
    return json({ ok: true, ran: ['handleExpiryWarn', 'handleEmailQueueSweep'] });
  }

  try {
    const session = await getSession(request, env);

    // ── Public auth routes ──
    if (method === 'POST' && path === '/api/auth/register') return handleRegister(request, env);
    if (method === 'POST' && path === '/api/auth/login') return handleLogin(request, env);
    if (method === 'POST' && path === '/api/auth/logout') return handleLogout(request, env, session);
    if (method === 'GET' && path === '/api/auth/me') return handleMe(session);
    // OAuth routes
    if (method === 'GET' && path === '/api/auth/google') return handleGoogleAuth(request, env);
    if (method === 'GET' && path === '/api/auth/google/callback') return handleGoogleCallback(request, env);
    // Password reset
    if (method === 'POST' && path === '/api/auth/forgot-password') return handleForgotPassword(request, env);
    if (method === 'POST' && path === '/api/auth/reset-password') return handleResetPassword(request, env);

    // ── Public portfolio ──
    if (method === 'GET' && path === '/api/portfolio') return handleGetPortfolio(env);

    // ── Public cover image (for emails / embeds) ──
    const coverMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/cover$/);
    if (coverMatch && method === 'GET') return handleGetCover(env, coverMatch[1]);

    // ── Per-gallery logo (public GET, admin POST/DELETE) ──
    const logoMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/logo$/);
    if (logoMatch && method === 'GET') return handleGetLogo(env, logoMatch[1]);
    if (logoMatch && method === 'POST') return handleUploadLogo(request, env, session, logoMatch[1]);
    if (logoMatch && method === 'DELETE') return handleDeleteLogo(env, session, logoMatch[1]);

    // Slideshow music — per-gallery audio track
    const musicMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/music$/);
    if (musicMatch && method === 'GET') return handleGetMusic(env, musicMatch[1]);
    if (musicMatch && method === 'POST') return handleUploadMusic(request, env, session, musicMatch[1]);
    if (musicMatch && method === 'DELETE') return handleDeleteMusic(env, session, musicMatch[1]);

    // ── Public gallery view (portfolio galleries only) ──
    const publicGalleryMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/public$/);
    if (publicGalleryMatch && method === 'GET') return handleGetPublicGallery(env, publicGalleryMatch[1]);

    // ── By-link gallery: published gallery with request_email=1 (anyone with link can view after email gate) ──
    const byLinkMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/by-link$/);
    if (byLinkMatch && method === 'GET') return handleGetGalleryByLink(env, byLinkMatch[1]);

    // ── Share-token public access: anyone with the tokenized URL can view ──
    // No login required, no email gate (unless gallery.request_email = 1, in
    // which case the gallery.html email-gate UI still triggers).
    const shareTokenMatch = path.match(/^\/api\/galleries\/share\/([a-f0-9]{24,64})$/i);
    if (shareTokenMatch && method === 'GET') return handleGetGalleryByShareToken(env, shareTokenMatch[1]);

    // ── Public photo access (handler checks permissions internally) ──
    const thumbMatch = path.match(/^\/api\/photos\/([a-f0-9]{32})\/thumb$/);
    if (thumbMatch && method === 'GET') return handleGetThumb(request, env, session, thumbMatch[1], ctx);

    // ── Web-size photo (2400px, for fast viewing + Web-Size downloads) ──
    const webMatch = path.match(/^\/api\/photos\/([a-f0-9]{32})\/web$/);
    if (webMatch && method === 'GET') return handleGetWeb(request, env, session, webMatch[1], ctx);

    // ── Public full photo access (for portfolio gallery covers/photos) ──
    const fullMatch = path.match(/^\/api\/photos\/([a-f0-9]{32})\/full$/);
    if (fullMatch && method === 'GET') return handleGetFull(request, env, session, fullMatch[1], ctx);

    // Lazy backfill of legacy photo dimensions — public endpoint.
    // UPDATE only fires when width/height are NULL, so it can't be abused
    // to overwrite real values. Must be public so unauthenticated client
    // gallery viewers can backfill on first thumb load.
    if (method === 'POST' && path === '/api/photos/backfill-dimensions') return handleBackfillDimensions(request, env);

    // ── Public engagement endpoints (Phase 3) ──
    // Email gate: anonymous visitor registers email before viewing
    const visitorMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/visitor$/);
    if (visitorMatch && method === 'POST') return handleRegisterVisitor(request, env, visitorMatch[1]);

    // Proof submission: anonymous client submits final selections.
    // Handler validates email from session OR pic_visit cookie OR body.
    const proofMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/proof$/);
    if (proofMatch && method === 'POST') return handleSubmitProof(request, env, session, proofMatch[1]);

    // Public analytics: visitors of published galleries POST events here.
    // Always returns 200 even if the events table is missing (graceful degrade).
    const trackMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/track$/);
    if (trackMatch && method === 'POST') return handleTrackEvent(request, env, trackMatch[1]);

    // ── Protected routes ──
    if (!session) return json({ error: 'Unauthorized' }, 401);

    // Galleries
    if (method === 'GET' && path === '/api/galleries') return handleGetGalleries(env, session);
    if (method === 'POST' && path === '/api/galleries') return handleCreateGallery(request, env, session);

    // Gallery by ID
    const galleryMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})$/);
    if (galleryMatch) {
      const id = galleryMatch[1];
      if (method === 'GET') return handleGetGallery(env, session, id);
      if (method === 'PUT') return handleUpdateGallery(request, env, session, id);
      if (method === 'DELETE') return handleDeleteGallery(env, session, id);
    }

    // Admin: one-click repair for photos with NULL width/height (square-rendering fix).
    // Reads first 64KB of each R2 object and parses JPEG SOF marker.
    const repairDimsMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/repair-dims$/);
    if (repairDimsMatch && method === 'POST') return handleRepairGalleryDims(env, session, repairDimsMatch[1]);

    // Admin: share-token lifecycle (Pic-Time-style public link).
    const shareTokenAdminMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/share-token$/);
    if (shareTokenAdminMatch && method === 'DELETE') return handleRevokeShareToken(env, session, shareTokenAdminMatch[1]);
    const shareTokenRegenMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/share-token\/regenerate$/);
    if (shareTokenRegenMatch && method === 'POST') return handleRegenerateShareToken(env, session, shareTokenRegenMatch[1]);

    // Gallery access
    const accessMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/access$/);
    if (accessMatch && method === 'POST') return handleGrantAccess(request, env, session, accessMatch[1]);

    const revokeMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/access\/([a-f0-9]{32})$/);
    if (revokeMatch && method === 'DELETE') return handleRevokeAccess(env, session, revokeMatch[1], revokeMatch[2]);
    if (revokeMatch && method === 'PUT') return handleUpdateAccessPassword(request, env, session, revokeMatch[1], revokeMatch[2]);

    const sendEmailMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/access\/([a-f0-9]{32})\/send-email$/);
    if (sendEmailMatch && method === 'POST') return handleSendInviteEmail(request, env, session, sendEmailMatch[1], sendEmailMatch[2]);

    // Photos
    const bulkDeleteMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos\/bulk-delete$/);
    if (bulkDeleteMatch && method === 'POST') return handleBulkDeletePhotos(request, env, session, bulkDeleteMatch[1]);

    // Fast upload: presigned URLs for direct browser → R2 upload
    const presignMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos\/presigned$/);
    if (presignMatch && method === 'POST') return handleGetPresignedUrls(request, env, session, presignMatch[1]);

    // Multipart upload init: returns uploadId + presigned part URLs + complete URL.
    // Daemon uploads parts in parallel for high-throughput on large photos.
    const multipartMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos\/multipart\/init$/);
    if (multipartMatch && method === 'POST') return handleMultipartInit(request, env, session, multipartMatch[1]);

    const confirmMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos\/confirm$/);
    if (confirmMatch && method === 'POST') return handleConfirmUpload(request, env, session, confirmMatch[1]);

    const uploadMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos$/);
    if (uploadMatch && method === 'POST') return handleUploadPhoto(request, env, session, uploadMatch[1]);

    // Photo reorder — persists drag-and-drop order from admin gallery editor.
    // Body: { photo_ids: [<id1>, <id2>, ...] }
    const photosOrderMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/photos\/order$/);
    if (photosOrderMatch && method === 'POST') return handlePhotosOrder(request, env, session, photosOrderMatch[1]);

    const photoDeleteMatch = path.match(/^\/api\/photos\/([a-f0-9]{32})$/);
    if (photoDeleteMatch && method === 'DELETE') return handleDeletePhoto(env, session, photoDeleteMatch[1]);

    // Selections
    const selToggle = path.match(/^\/api\/selections\/([a-f0-9]{32})$/);
    if (selToggle && method === 'POST') return handleToggleSelection(env, session, selToggle[1]);

    const selGet = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/selections$/);
    if (selGet && method === 'GET') return handleGetSelections(env, session, selGet[1]);

    // Scenes
    const scenesMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/scenes$/);
    if (scenesMatch && method === 'GET') return handleGetScenes(env, session, scenesMatch[1]);
    if (scenesMatch && method === 'POST') return handleCreateScene(request, env, session, scenesMatch[1]);

    const sceneMatch = path.match(/^\/api\/scenes\/([a-f0-9]{32})$/);
    if (sceneMatch && method === 'PUT') return handleUpdateScene(request, env, session, sceneMatch[1]);
    if (sceneMatch && method === 'DELETE') return handleDeleteScene(env, session, sceneMatch[1]);

    const scenePhotosMatch = path.match(/^\/api\/scenes\/([a-f0-9]{32})\/photos$/);
    if (scenePhotosMatch && method === 'POST') return handleAssignPhotosToScene(request, env, session, scenePhotosMatch[1]);

    // Public config (OAuth keys for client-side integrations)
    if (method === 'GET' && path === '/api/config') {
      return json({
        dropboxAppKey: env.DROPBOX_APP_KEY || '',
        googleClientId: env.GOOGLE_DRIVE_CLIENT_ID || ''
      });
    }

    // Admin proofing & visitor review (Phase 3)
    const proofsMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/proofs$/);
    if (proofsMatch && method === 'GET') return handleGetProofs(env, session, proofsMatch[1]);

    const visitorsMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/visitors$/);
    if (visitorsMatch && method === 'GET') return handleGetVisitors(env, session, visitorsMatch[1]);

    // Admin: download audit log for one gallery (joined with photos for filenames)
    const downloadsMatch = path.match(/^\/api\/galleries\/([a-f0-9]{32})\/downloads$/);
    if (downloadsMatch && method === 'GET') return handleGetDownloads(request, env, session, downloadsMatch[1]);

    // Admin
    if (method === 'GET' && path === '/api/admin/stats') return handleAdminStats(request, env, session);
    if (method === 'GET' && path === '/api/admin/clients') return handleAdminClients(env, session);

    // Admin: scan all galleries and backfill any photo with NULL width/height.
    // Per-gallery cap (100 photos) enforced inside the handler so a huge
    // gallery can't push the worker past 30s.
    if (method === 'POST' && path === '/api/admin/backfill-dimensions') return handleAdminBackfillAll(env, session);

    // Studio settings (singleton)
    if (path === '/api/admin/settings') {
      if (method === 'GET') return handleGetStudioSettings(env, session);
      if (method === 'PUT') return handleUpdateStudioSettings(request, env, session);
    }

    // Email templates (FASE 3)
    if (method === 'GET' && path === '/api/admin/email-templates') return handleListEmailTemplates(env, session);
    const tplMatch = path.match(/^\/api\/admin\/email-templates\/([a-z0-9_]+)$/i);
    if (tplMatch && method === 'PUT') return handleUpdateEmailTemplate(request, env, session, tplMatch[1]);
    const tplTestMatch = path.match(/^\/api\/admin\/email-templates\/([a-z0-9_]+)\/test$/i);
    if (tplTestMatch && method === 'POST') return handleTestEmailTemplate(request, env, session, tplTestMatch[1]);

    // Workflow timeline (FASE 1B)
    if (method === 'GET' && path === '/api/admin/timeline') return handleGetTimeline(request, env, session);

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: 'Internal error: ' + e.message }, 500);
  }
}

// ── EXPIRY WARNING SWEEP ──
async function handleExpiryWarn(env) {
  if (!env.RESEND_API_KEY || !env.ADMIN_EMAIL) return;
  try {
    // Galleries expiring in <=7 days, not warned yet, with at least one access grant
    const rows = await env.DB.prepare(`
      SELECT g.id, g.title, g.expire_date,
             (SELECT COUNT(*) FROM gallery_access ga WHERE ga.gallery_id = g.id) AS client_count
        FROM galleries g
       WHERE g.expire_enabled = 1
         AND g.expire_date IS NOT NULL
         AND g.expire_warned_at IS NULL
         AND date(g.expire_date) <= date('now', '+7 days')
         AND date(g.expire_date) >= date('now')
    `).all();
    for (const g of (rows.results || [])) {
      const days = Math.max(0, Math.ceil((new Date(g.expire_date) - new Date()) / 86400000));
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'IVAE Gallery <gallery@ivaestudios.com>',
            to: env.ADMIN_EMAIL,
            subject: `${g.title} expires in ${days} day${days === 1 ? '' : 's'}`,
            html: `<p><strong>${g.title}</strong> will expire on <strong>${g.expire_date}</strong> (${days} day${days === 1 ? '' : 's'} from now). ${g.client_count} client${g.client_count === 1 ? '' : 's'} have access.</p><p><a href="https://ivaestudios.com/gallery/admin/gallery-edit.html?id=${g.id}">Open in admin</a></p>`
          })
        });
        await env.DB.prepare("UPDATE galleries SET expire_warned_at = datetime('now') WHERE id = ?").bind(g.id).run();
      } catch (e) { console.error('Expiry warn failed for', g.id, e.message); }
    }
  } catch (e) { console.error('[handleExpiryWarn]', e.message); }
}


// ============================================================================
// END: contents of original src/worker.js
// ============================================================================

// ── Pages Functions entry point ──
export async function onRequest(context) {
  const { request, env } = context;
  // Pages Functions exposes waitUntil on the context — proxy it into the
  // ctx-shaped object the original Worker handler expects.
  const ctx = {
    waitUntil: (p) => context.waitUntil(p),
    passThroughOnException: () =>
      context.passThroughOnException && context.passThroughOnException()
  };

  // Strip the /api/gallery prefix so existing routing keeps working.
  const url = new URL(request.url);
  let stripped = url.pathname;
  if (stripped.startsWith('/api/gallery/')) {
    stripped = '/api/' + stripped.slice('/api/gallery/'.length);
  } else if (stripped === '/api/gallery') {
    stripped = '/api';
  }

  // Build a new request with the rewritten URL so the original handler can
  // match its existing path patterns unmodified. Body / headers are reused.
  const rewrittenUrl = url.origin + stripped + url.search;
  const rewrittenReq = new Request(rewrittenUrl, request);

  return fetchHandler(rewrittenReq, env, ctx);
}
