// IVAE Marketing — Endpoint de autorización OAuth (PKCE S256) con clave.
// GET  -> muestra una pantalla simple para ingresar la CLAVE del conector.
// POST -> valida la clave, emite un código de autorización y redirige de vuelta a Claude.
import { randHex, putOAuth, getOAuth, checkPassword } from './_lib.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function page({ params, error }) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource', 'response_type']
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params[k] || '')}">`).join('\n      ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar IVAE Marketing</title>
<style>
  body{margin:0;background:#0c0c11;color:#ECECF1;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{width:100%;max-width:380px;padding:28px;background:#15151c;border:1px solid #26263010;border-radius:16px;box-shadow:0 10px 40px #0008}
  h1{font-size:19px;margin:0 0 6px} p{color:#9A9AA8;font-size:14px;margin:0 0 18px}
  label{display:block;font-size:13px;color:#9A9AA8;margin:0 0 6px}
  input[type=password]{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #2a2a34;background:#0E0E13;color:#fff;font-size:16px}
  button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:10px;background:linear-gradient(135deg,#E24DA0,#9D5BE0);color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .err{color:#ff8497;font-size:13px;margin:10px 0 0}
  .brand{font-weight:800;background:linear-gradient(135deg,#E24DA0,#9D5BE0);-webkit-background-clip:text;background-clip:text;color:transparent}
</style></head><body>
  <form class="card" method="POST" action="/api/mcp-oauth/authorize">
    <h1>Conectar <span class="brand">IVAE Marketing</span></h1>
    <p>Ingresa la clave del conector para autorizar a Claude a leer y escribir en el calendario.</p>
    <label for="p">Clave del conector</label>
    <input id="p" type="password" name="password" autofocus autocomplete="off">
    ${error ? `<div class="err">${esc(error)}</div>` : ''}
    <button type="submit">Autorizar</button>
    ${hidden}
  </form>
</body></html>`;
}

function htmlRes(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// Valida los parámetros OAuth comunes. Devuelve {ok, error}.
async function validate(env, params) {
  if (params.response_type !== 'code') return { ok: false, error: 'response_type debe ser "code".' };
  if (!params.code_challenge || params.code_challenge_method !== 'S256') return { ok: false, error: 'Falta PKCE (code_challenge S256).' };
  if (!params.client_id) return { ok: false, error: 'Falta client_id.' };
  if (!params.redirect_uri) return { ok: false, error: 'Falta redirect_uri.' };
  const client = await getOAuth(env, 'client', params.client_id);
  if (!client) return { ok: false, error: 'Cliente no registrado.' };
  const uris = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
  if (uris.length && !uris.includes(params.redirect_uri)) return { ok: false, error: 'redirect_uri no autorizado.' };
  return { ok: true };
}

function readQuery(url) {
  const q = new URL(url).searchParams;
  const o = {};
  for (const k of ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource']) o[k] = q.get(k) || '';
  return o;
}

export async function onRequestGet({ request, env }) {
  const params = readQuery(request.url);
  const v = await validate(env, params);
  if (!v.ok) return htmlRes(page({ params, error: v.error }), 400);
  return htmlRes(page({ params }));
}

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return htmlRes('Solicitud inválida', 400); }
  const params = {};
  for (const k of ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource']) params[k] = form.get(k) || '';
  const password = form.get('password') || '';

  const v = await validate(env, params);
  if (!v.ok) return htmlRes(page({ params, error: v.error }), 400);

  if (!(await checkPassword(env, password))) {
    return htmlRes(page({ params, error: 'Clave incorrecta. Intenta de nuevo.' }), 401);
  }

  // Clave correcta -> emite código de autorización (válido 10 min) ligado al PKCE + redirect_uri.
  const code = randHex(24);
  await putOAuth(env, 'code', code, {
    code_challenge: params.code_challenge,
    redirect_uri: params.redirect_uri,
    client_id: params.client_id,
  }, 600);

  const back = new URL(params.redirect_uri);
  back.searchParams.set('code', code);
  if (params.state) back.searchParams.set('state', params.state);
  return new Response(null, { status: 302, headers: { Location: back.toString(), 'Cache-Control': 'no-store' } });
}
