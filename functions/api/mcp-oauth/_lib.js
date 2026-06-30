// ============================================================================
// IVAE Marketing — OAuth helpers para el conector MCP de Claude.ai.
// claude.ai exige OAuth (oauth_dcr) para conectar conectores personalizados;
// esto implementa el mínimo: descubrimiento + registro dinámico (DCR) +
// authorize (con clave) + token (PKCE S256). Estado en D1 (mkt_mcp_oauth).
// Archivo con prefijo "_" => NO es una ruta, solo librería importable.
// ============================================================================

export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...extra },
  });
}
export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}

export function randHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256b64url(str) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return b64url(new Uint8Array(hash));
}
export async function sha256hex(str) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Estado OAuth en D1 (tabla mkt_mcp_oauth) ─────────────────────────────────
export async function putOAuth(env, kind, id, data, ttlSec) {
  const expires = ttlSec ? new Date(Date.now() + ttlSec * 1000).toISOString() : null;
  await env.DB.prepare(
    'INSERT OR REPLACE INTO mkt_mcp_oauth (kind, id, data, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(kind, id, JSON.stringify(data || {}), expires, new Date().toISOString()).run();
}
export async function getOAuth(env, kind, id) {
  let row;
  try {
    row = await env.DB.prepare('SELECT data, expires_at FROM mkt_mcp_oauth WHERE kind = ? AND id = ?').bind(kind, id).first();
  } catch { return null; }
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  try { return JSON.parse(row.data || '{}'); } catch { return {}; }
}
export async function delOAuth(env, kind, id) {
  try { await env.DB.prepare('DELETE FROM mkt_mcp_oauth WHERE kind = ? AND id = ?').bind(kind, id).run(); } catch { /* noop */ }
}

// Verifica la clave de acceso (la "contraseña" del conector) contra el hash en D1.
export async function checkPassword(env, password) {
  const cfg = await getOAuth(env, 'config', 'password');
  if (!cfg || !cfg.hash) return false;
  const h = await sha256hex(String(password || ''));
  return h === cfg.hash;
}
