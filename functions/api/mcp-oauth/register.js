// IVAE Marketing — Registro dinámico de cliente OAuth (RFC 7591) para claude.ai.
import { json, corsPreflight, randHex, putOAuth } from './_lib.js';

export function onRequestOptions() { return corsPreflight(); }

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* cuerpo opcional */ }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === 'string') : [];
  const clientId = 'ivae-' + randHex(16);

  // Cliente público con PKCE (sin secreto). Guardamos los redirect_uris para validarlos en /authorize.
  await putOAuth(env, 'client', clientId, {
    redirect_uris: redirectUris,
    client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : 'cliente',
  }, null);

  return json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : undefined,
  }, 201);
}
