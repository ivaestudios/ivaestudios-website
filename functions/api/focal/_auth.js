/* ═══════════════════════════════════════════════════════════════
   Focal-points admin auth — shared helpers
   ───────────────────────────────────────────────────────────────
   Used by /api/focal, /api/focal/login, /api/focal/logout.
   Pages Functions ignores files/folders starting with `_`, so this
   module is *not* a route — only an importable utility.
   ═══════════════════════════════════════════════════════════════ */

export const COOKIE_NAME = 'ivae_admin_session';
export const SESSION_TTL_S = 14400; // 4 hours

/* ── crypto helpers (Web Crypto API) ── */

function b64urlEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function hmacSign(message, key) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

/* Constant-time string compare. Avoids early-exit timing leaks. */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // walk one buffer to keep timing roughly proportional
    let acc = 1;
    for (let i = 0; i < ab.length; i++) acc |= ab[i];
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/* ── cookie helpers ── */

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(/;\s*/).forEach(function (p) {
    const eq = p.indexOf('=');
    if (eq < 0) return;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

export function buildSessionCookie(value, maxAge) {
  return COOKIE_NAME + '=' + value +
    '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}

export async function issueSessionCookie(env) {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const sig = await hmacSign(String(expiry), env.ADMIN_HMAC_KEY);
  return buildSessionCookie(expiry + '.' + sig, SESSION_TTL_S);
}

export async function verifySessionCookie(cookieHeader, env) {
  if (!env || !env.ADMIN_HMAC_KEY) return false;
  const cookies = parseCookies(cookieHeader || '');
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const dot = raw.indexOf('.');
  if (dot < 1) return false;
  const expiryStr = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expiry = parseInt(expiryStr, 10);
  if (!expiry || !sig) return false;
  if (Math.floor(Date.now() / 1000) >= expiry) return false;
  const expected = await hmacSign(expiryStr, env.ADMIN_HMAC_KEY);
  return timingSafeEqual(expected, sig);
}

/* ── response helper ── */

export function jsonResponse(obj, status, extraHeaders) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  };
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (k) {
      headers[k] = extraHeaders[k];
    });
  }
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: headers
  });
}
