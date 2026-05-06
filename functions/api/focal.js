/* ═══════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/focal
   ───────────────────────────────────────────────────────────────
   KV binding required:    FOCAL_DATA
   Secret bindings (Pages → Settings → Environment):
     • ADMIN_PASSWORD   — admin login password
     • ADMIN_HMAC_KEY   — 32+ char random, signs the session cookie
   Until both secrets are set, /api/focal/login fails closed (500).

   Routes (this file only handles the bare /api/focal):
     GET  /api/focal   → public read of focal-points map
     POST /api/focal   → admin write (ivae_admin_session cookie required)

   Login/logout live in the sibling routes:
     POST /api/focal/login   → see  ./focal/login.js
     POST /api/focal/logout  → see  ./focal/logout.js
   ═══════════════════════════════════════════════════════════════ */

import { verifySessionCookie, jsonResponse } from './focal/_auth.js';

export async function onRequestGet(context) {
  try {
    const data = await context.env.FOCAL_DATA.get('focal_points');
    return new Response(data || '{}', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const cookieHeader = context.request.headers.get('Cookie');
  const authed = await verifySessionCookie(cookieHeader, context.env);
  if (!authed) {
    return jsonResponse({ error: 'No autorizado' }, 401);
  }

  try {
    const body = await context.request.text();
    JSON.parse(body); // validate JSON
    await context.env.FOCAL_DATA.put('focal_points', body);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e.message || 'Server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
