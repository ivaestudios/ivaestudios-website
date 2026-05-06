/* ═══════════════════════════════════════════════════════════════
   Cloudflare Pages Function — POST /api/focal/login
   ───────────────────────────────────────────────────────────────
   Reads { "password": "..." } from the JSON body and compares it
   (constant-time) against the ADMIN_PASSWORD secret. On match,
   issues an HMAC-signed session cookie. On mismatch, sleeps a
   random 250–500ms (slows brute force) and returns 401.

   Fails closed (500) until both ADMIN_PASSWORD and ADMIN_HMAC_KEY
   secrets are configured in the Pages project.
   ═══════════════════════════════════════════════════════════════ */

import {
  timingSafeEqual,
  issueSessionCookie,
  jsonResponse
} from './_auth.js';

export async function onRequestPost(context) {
  const env = context.env || {};
  if (!env.ADMIN_PASSWORD || !env.ADMIN_HMAC_KEY) {
    return jsonResponse({ error: 'Auth not configured' }, 500);
  }

  let body = {};
  try { body = await context.request.json(); } catch (_) { body = {}; }
  const submitted = (body && typeof body.password === 'string') ? body.password : '';

  // Constant-time compare; never short-circuit.
  const ok = timingSafeEqual(submitted, env.ADMIN_PASSWORD);

  if (!ok) {
    await new Promise(function (r) {
      setTimeout(r, 250 + Math.floor(Math.random() * 250));
    });
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const cookie = await issueSessionCookie(env);
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': cookie });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
