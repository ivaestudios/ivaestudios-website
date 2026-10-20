// IVAE Studios: consultas de los formularios del sitio
// Cloudflare Pages Function: /api/inquiry
//
//   POST /api/inquiry   JSON { email, name, kind, lines[], message, page, lang, website }
//
// Antes (hasta 20-oct-2026) los formularios de la home y la hoja de contacto
// del celular SOLO abrían la app de correo del teléfono (mailto). Si el cliente
// no tenía configurada la app de Correo, al tocar "Enviar" no pasaba nada y la
// consulta se perdía sin que nos enteráramos. Ahora el mensaje llega directo a
// info@ por Resend; si este endpoint falla, la página cae al mailto de antes.
//
// Solo es para IVAE Studios (fotografía). IVAE Marketing tiene su propio
// formulario (/api/marketing-intake) y son marcas separadas.
//
// LEY DE LA CASA: una consulta de una persona real nunca se pierde.
//   · El campo trampa NO descarta: el autocompletado de una persona puede
//     llenarlo. Se manda igual con "[revisar]" en el asunto.
//   · No se le manda correo automático al cliente (evita que alguien use el
//     formulario para mandar correos a terceros). Vianey contesta a mano;
//     "Responder" en el aviso le escribe directo al cliente.

const FROM = 'IVAE Studios <info@ivaestudios.com>';
const INTERNO = ['info@ivaestudios.com'];

const ALLOWED_ORIGINS = new Set([
  'https://ivaestudios.com',
  'https://www.ivaestudios.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Límite por IP en memoria (por aislado): 5 consultas por minuto bastan para
// una persona escribiendo a mano y frenan a un script.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 5;
const rlBucket = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const arr = (rlBucket.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { rlBucket.set(ip, arr); return false; }
  arr.push(now); rlBucket.set(ip, arr);
  if (rlBucket.size > 5000) {
    for (const [k, v] of rlBucket) { const f = v.filter((t) => now - t < RL_WINDOW_MS); if (f.length) rlBucket.set(k, f); else rlBucket.delete(k); }
  }
  return true;
}

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const cleanBlock = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\r\n?/g, '\n').trim().slice(0, max);
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function resend(env, payload) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return 'sent';
      if (res.status < 500) { try { await res.text(); } catch { /* noop */ } return `error ${res.status}`; }
    } catch (e) { console.warn('inquiry resend network', e && e.name); }
    if (i < 2) await new Promise((r) => setTimeout(r, 200 * Math.pow(3, i)));
  }
  return 'error';
}

async function consulta(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Not allowed' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!rateLimit(ip)) return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429);

  let body = null;
  try { body = await request.json(); } catch { /* noop */ }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);

  const email = clean(body.email, 254).toLowerCase();
  if (!isValidEmail(email)) return json({ error: 'That email address does not look right.', field: 'email' }, 400);
  const name = clean(body.name, 120);
  const kind = clean(body.kind, 80).replace(/[:/\s]+$/, '') || 'Consulta';
  const page = clean(body.page, 200);
  const lang = body.lang === 'es' ? 'es' : 'en';
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 40).map((l) => cleanBlock(l, 2000)) : [];
  const message = cleanBlock(body.message, 4000);
  const trampa = !!clean(body.website, 10);

  if (!env.RESEND_API_KEY) return json({ error: 'Email is not configured.' }, 503);

  const quien = name || email;
  const subject = `${trampa ? '[revisar] ' : ''}Nueva consulta del sitio: ${quien} · ${kind}`;
  const cuerpo = lines.length ? lines.join('\n') : message;
  const nota = `Llegó desde ${page ? 'ivaestudios.com' + page : 'el sitio'} (${lang === 'es' ? 'página en español' : 'página en inglés'}). Responder a este correo le escribe directo a ${email}.`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a2433">
${trampa ? '<p style="margin:0 0 14px;padding:10px 12px;background:#fff8e1;border:1px solid #f1d98a">Se llenó el campo trampa del formulario: puede ser un bot o el autocompletado del navegador. Revisar antes de contestar.</p>' : ''}
<p style="margin:0 0 6px"><strong>${escapeHtml(quien)}</strong> escribió desde el formulario del sitio.</p>
<p style="margin:0 0 14px;color:#7a8290;font-size:12px">${escapeHtml(nota)}</p>
<p style="margin:0 0 4px">Correo: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
<div style="margin:12px 0 0;padding:12px 14px;background:#f7f7f5;border:1px solid #e6e4df;white-space:pre-wrap">${escapeHtml(cuerpo || '(sin mensaje)')}</div>
</body></html>`;
  const text = `${trampa ? 'REVISAR: se llenó el campo trampa (bot o autocompletado).\n\n' : ''}${quien} escribió desde el formulario del sitio.\n${nota}\n\nCorreo: ${email}\n\n${cuerpo || '(sin mensaje)'}`;

  const estado = await resend(env, {
    from: FROM, to: INTERNO, reply_to: email, subject, html, text,
    tags: [{ name: 'tipo', value: 'consulta_sitio' }, { name: 'idioma', value: lang }],
  });
  if (estado !== 'sent') {
    console.error('inquiry resend', estado);
    return json({ error: 'We could not send it right now.' }, 502);
  }
  return json({ ok: true }, 200);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    return await consulta(request, env);
  } catch (e) {
    console.error('inquiry', e && e.message);
    return json({ error: 'Something went wrong.' }, 500);
  }
}
