/* ═══════════════════════════════════════════════════════════════
   Cloudflare Pages Function — POST /api/focal/logout
   ───────────────────────────────────────────────────────────────
   Clears the ivae_admin_session cookie by issuing a Max-Age=0
   replacement. Always returns 200 — idempotent.
   ═══════════════════════════════════════════════════════════════ */

import { buildSessionCookie, jsonResponse } from './_auth.js';

export async function onRequestPost() {
  const cookie = buildSessionCookie('', 0);
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
