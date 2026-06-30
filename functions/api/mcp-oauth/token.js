// IVAE Marketing — Endpoint de token OAuth (authorization_code con PKCE S256, y refresh_token).
import { json, corsPreflight, randHex, sha256b64url, putOAuth, getOAuth, delOAuth } from './_lib.js';

const ACCESS_TTL = 60 * 60 * 24 * 90;   // 90 días
const REFRESH_TTL = 60 * 60 * 24 * 365; // 1 año

export function onRequestOptions() { return corsPreflight(); }

async function issueTokens(env) {
  const access = 'at_' + randHex(28);
  const refresh = 'rt_' + randHex(28);
  await putOAuth(env, 'token', access, { scope: 'mcp' }, ACCESS_TTL);
  await putOAuth(env, 'refresh', refresh, { scope: 'mcp' }, REFRESH_TTL);
  return { access, refresh };
}

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid_request' }, 400); }
  const grant = form.get('grant_type');

  if (grant === 'authorization_code') {
    const code = form.get('code') || '';
    const redirectUri = form.get('redirect_uri') || '';
    const clientId = form.get('client_id') || '';
    const verifier = form.get('code_verifier') || '';
    const rec = await getOAuth(env, 'code', code);
    if (!rec) return json({ error: 'invalid_grant', error_description: 'Código inválido o expirado.' }, 400);
    // Un código es de un solo uso.
    await delOAuth(env, 'code', code);
    if (rec.redirect_uri !== redirectUri) return json({ error: 'invalid_grant', error_description: 'redirect_uri no coincide.' }, 400);
    if (rec.client_id !== clientId) return json({ error: 'invalid_grant', error_description: 'client_id no coincide.' }, 400);
    if (!verifier) return json({ error: 'invalid_request', error_description: 'Falta code_verifier.' }, 400);
    const challenge = await sha256b64url(verifier);
    if (challenge !== rec.code_challenge) return json({ error: 'invalid_grant', error_description: 'PKCE no coincide.' }, 400);

    const { access, refresh } = await issueTokens(env);
    return json({ access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: 'mcp' });
  }

  if (grant === 'refresh_token') {
    const rt = form.get('refresh_token') || '';
    const rec = await getOAuth(env, 'refresh', rt);
    if (!rec) return json({ error: 'invalid_grant', error_description: 'refresh_token inválido o expirado.' }, 400);
    await delOAuth(env, 'refresh', rt); // rotación
    const { access, refresh } = await issueTokens(env);
    return json({ access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: 'mcp' });
  }

  return json({ error: 'unsupported_grant_type' }, 400);
}
