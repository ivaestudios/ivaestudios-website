// ============================================================================
// IVAE Marketing — Web Push: el aviso llega al telefono con la app CERRADA.
//
// Por que a mano: en Cloudflare Pages Functions no hay npm, asi que el cifrado
// del Web Push va escrito aqui con WebCrypto. Son tres normas encadenadas:
//   · RFC 8291 — de donde sale la llave para cifrarle a ESE dispositivo.
//   · RFC 8188 — como se empaqueta el mensaje (content-encoding aes128gcm).
//   · RFC 8292 — VAPID: el permiso firmado que identifica al remitente.
//
// El flujo en una frase: se hace un acuerdo de llaves con el dispositivo, se
// deriva una llave de un solo uso, se cifra el texto con AES-128-GCM y se
// manda al buzon que dio el navegador, firmado con la llave VAPID de IVAE.
//
// NADA de esto tira hacia arriba: un aviso que no sale jamas debe romper la
// respuesta de la app (misma regla que notify() y logActivity()).
// ============================================================================

const CODIFICA = new TextEncoder();

// ── base64url (sin relleno), en las dos direcciones ─────────────────────────
export function b64urlABytes(s) {
  const norm = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesAB64url(bytes) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function une(...trozos) {
  const total = trozos.reduce((n, t) => n + t.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) { out.set(t, i); i += t.length; }
  return out;
}

// ── HKDF de una pasada: extract + expand, que es justo lo que pide el RFC ───
async function hkdf(salt, ikm, info, largo) {
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info }, base, largo * 8,
  );
  return new Uint8Array(bits);
}

// ── VAPID: el JWT ES256 que dice "esto lo manda IVAE" ───────────────────────
// La llave privada viaja como JWK en el secreto VAPID_JWK de Cloudflare.
export async function firmaVapid(env, audiencia) {
  const jwk = JSON.parse(env.VAPID_JWK);
  const llave = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const cab = bytesAB64url(CODIFICA.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = bytesAB64url(CODIFICA.encode(JSON.stringify({
    aud: audiencia,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUB || 'mailto:info@ivaestudios.com',
  })));
  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, llave, CODIFICA.encode(`${cab}.${cuerpo}`),
  );
  return `${cab}.${cuerpo}.${bytesAB64url(firma)}`;
}

// La llave PUBLICA que el navegador necesita para suscribirse (65 bytes, sin
// comprimir). Se arma desde el mismo JWK, asi no hay dos verdades que cuadrar.
export function vapidPublica(env) {
  const jwk = JSON.parse(env.VAPID_JWK);
  return bytesAB64url(une(new Uint8Array([4]), b64urlABytes(jwk.x), b64urlABytes(jwk.y)));
}

// ── El cifrado de RFC 8291 ──────────────────────────────────────────────────
// `fijos` existe SOLO para poder probar contra el ejemplo oficial de la norma
// (que trae sal y par efimero dados). En produccion nunca se pasa: la sal y el
// par se sortean aqui dentro, que es justo lo que exige la seguridad.
export async function cifra(texto, p256dhB64, authB64, fijos = null) {
  const uaPub = b64urlABytes(p256dhB64);       // llave publica del dispositivo
  const authSecret = b64urlABytes(authB64);    // su secreto de 16 bytes

  // Par efimero: se usa UNA vez y se tira.
  const efimero = fijos && fijos.par ? fijos.par : await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', efimero.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const compartido = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey }, efimero.privateKey, 256,
  ));

  // IKM: mezcla el secreto compartido con el "auth" del dispositivo y con las
  // dos llaves publicas, para que la llave sea unica de esta pareja.
  const infoLlave = une(CODIFICA.encode('WebPush: info\0'), uaPub, asPub);
  const ikm = await hkdf(authSecret, compartido, infoLlave, 32);

  const sal = fijos && fijos.sal ? fijos.sal : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, CODIFICA.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, CODIFICA.encode('Content-Encoding: nonce\0'), 12);

  // Un solo registro: el texto y el byte 0x02 que marca "aqui se acabo".
  const plano = une(CODIFICA.encode(texto), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aes, plano,
  ));

  // Cabecera del RFC 8188: sal(16) + tamaño de registro(4) + largo llave(1) + llave(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return une(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

/**
 * Manda UN aviso a UN dispositivo.
 * Devuelve { ok } o { ok:false, muerta:true } cuando el buzon ya no existe
 * (404/410): esa suscripcion hay que borrarla, no reintentarla.
 */
export async function enviarPush(env, sub, datos) {
  if (!env.VAPID_JWK) return { ok: false, motivo: 'sin-llave' };
  try {
    const url = new URL(sub.endpoint);
    const cuerpo = await cifra(JSON.stringify(datos), sub.p256dh, sub.auth);
    const jwt = await firmaVapid(env, `${url.protocol}//${url.host}`);
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
        Authorization: `vapid t=${jwt}, k=${vapidPublica(env)}`,
      },
      body: cuerpo,
    });
    if (r.status === 404 || r.status === 410) return { ok: false, muerta: true, estado: r.status };
    if (!r.ok) return { ok: false, estado: r.status, detalle: (await r.text()).slice(0, 200) };
    return { ok: true, estado: r.status };
  } catch (e) {
    return { ok: false, motivo: String((e && e.message) || e).slice(0, 200) };
  }
}

/**
 * Reparte un aviso a TODOS los dispositivos de estas personas y limpia solo
 * los buzones muertos. Best-effort: nunca tira.
 */
export async function repartirPush(env, userIds, datos) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length || !env.VAPID_JWK) return 0;
    const marcas = ids.map(() => '?').join(',');
    const res = await env.DB.prepare(
      `SELECT s.id, s.endpoint, s.p256dh, s.auth
         FROM mkt_push_subs s
         JOIN mkt_users u ON u.id = s.user_id
        WHERE s.user_id IN (${marcas}) AND u.active = 1 AND u.push_activo = 1`
    ).bind(...ids).all();
    const subs = res.results || [];
    if (!subs.length) return 0;

    const salidas = await Promise.all(subs.map((s) => enviarPush(env, s, datos)));
    const muertas = subs.filter((_, i) => salidas[i].muerta).map((s) => s.id);
    const fallidas = subs.filter((_, i) => !salidas[i].ok && !salidas[i].muerta).map((s) => s.id);
    const ok = subs.filter((_, i) => salidas[i].ok).map((s) => s.id);

    const stmts = [];
    if (muertas.length) {
      stmts.push(env.DB.prepare(
        `DELETE FROM mkt_push_subs WHERE id IN (${muertas.map(() => '?').join(',')})`
      ).bind(...muertas));
    }
    if (fallidas.length) {
      // A los 5 rebotes seguidos se da de baja sola: un endpoint que ya no
      // contesta solo gasta tiempo en cada aviso.
      stmts.push(env.DB.prepare(
        `UPDATE mkt_push_subs SET fallos = fallos + 1 WHERE id IN (${fallidas.map(() => '?').join(',')})`
      ).bind(...fallidas));
      stmts.push(env.DB.prepare('DELETE FROM mkt_push_subs WHERE fallos >= 5'));
    }
    if (ok.length) {
      stmts.push(env.DB.prepare(
        `UPDATE mkt_push_subs SET fallos = 0, ultimo_ok = datetime('now') WHERE id IN (${ok.map(() => '?').join(',')})`
      ).bind(...ok));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return ok.length;
  } catch (e) {
    console.error('[mkt push]', e && e.message);
    return 0;
  }
}
