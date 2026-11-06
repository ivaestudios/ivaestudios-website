// IVAE Studios: reservas en línea de sesiones de fotos
// Cloudflare Pages Function: /api/book
//
//   POST /api/book            reserva una sesión (formulario de /book y /es/reservar,
//                             o JSON de un asistente de IA)
//   GET  /api/book?id=&email= en qué va una reserva
//
// Vianey (6-nov-2026): "necesito que sea muy fácil reservar con nosotros… que les llegue la
// carta de confirmación y todo completo". La reserva NO se decide aquí: se pasa a Juan
// (worker ivae-juan, /web/reservar, con RESERVA_WEB_SECRETO). Juan la mete a la misma cola
// que las reservas de WhatsApp: Google revisa el calendario de info@, aparta la fecha, manda
// la carta de confirmación en PDF al correo del cliente y le avisa a Israel por WhatsApp.
//
// Sin captcha a propósito: los asistentes de IA (Muse, ChatGPT, Gemini…) no pueden resolverlo.
// El freno contra abuso vive en Juan (topes por persona y por día, campo trampa → revisión
// a mano) y aquí (límite por IP).

const JUAN = 'https://ivae-juan.vianeydm07.workers.dev';
const WHATSAPP = 'https://wa.me/529902046514';

const RL_WINDOW_MS = 60_000;
const RL_MAX = 6;
const rlBucket = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const arr = (rlBucket.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { rlBucket.set(ip, arr); return false; }
  arr.push(now); rlBucket.set(ip, arr);
  if (rlBucket.size > 5000) rlBucket.clear();
  return true;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

const TXT = {
  en: {
    title: 'Booking request received',
    okH: 'Your session request is in',
    okP: (d) => `We are checking ${d.date} at ${d.time} against our calendar right now. If the time is free, your confirmation letter arrives at ${d.email} within a few minutes. If it is taken, we will email you the closest available times.`,
    okPay: 'No deposit is needed. You pay at the end of your session, by card or in cash.',
    reviewH: 'We received your request',
    reviewP: 'Our team will confirm it personally by email or WhatsApp shortly.',
    busyH: 'That time is already booked',
    busyP: (d) => `${d.date} at ${d.time} is not available.`,
    altP: 'Free times that day:',
    noAlt: 'There are no free times left that day. Please choose another date.',
    errH: 'Something is missing',
    back: 'Back to the booking form',
    wa: 'Message us on WhatsApp',
    status: 'Check the status of this booking',
    form: '/book',
  },
  es: {
    title: 'Solicitud de reserva recibida',
    okH: 'Recibimos su solicitud',
    okP: (d) => `Estamos revisando el ${d.date} a las ${d.time} en nuestro calendario. Si el horario está libre, su carta de confirmación llega a ${d.email} en unos minutos. Si está ocupado, le escribimos por correo con los horarios más cercanos.`,
    okPay: 'No se necesita anticipo. La sesión se paga al terminar, con tarjeta o en efectivo.',
    reviewH: 'Recibimos su solicitud',
    reviewP: 'Nuestro equipo la confirmará personalmente por correo o WhatsApp en breve.',
    busyH: 'Ese horario ya está ocupado',
    busyP: (d) => `El ${d.date} a las ${d.time} no está disponible.`,
    altP: 'Horarios libres ese día:',
    noAlt: 'Ya no quedan horarios libres ese día. Por favor elija otra fecha.',
    errH: 'Falta un dato',
    back: 'Volver al formulario',
    wa: 'Escríbanos por WhatsApp',
    status: 'Ver el estado de esta reserva',
    form: '/es/reservar',
  },
};

function pagina(lang, status, h, cuerpo) {
  const t = TXT[lang];
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t.title)} | IVAE Studios</title>
<style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff;color:#1a2433;line-height:1.6}main{max-width:560px;margin:0 auto;padding:48px 16px}h1{font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2;margin:0 0 16px}p{margin:0 0 14px}ul{padding-left:20px}a{color:#1f3a5a}.btn{display:inline-block;margin:8px 8px 0 0;padding:12px 18px;border:1px solid #1a2433;color:#1a2433;text-decoration:none;font-size:14px;letter-spacing:.06em;text-transform:uppercase}.btn.dark{background:#1a2433;color:#fff}.logo{font-family:Georgia,serif;letter-spacing:.2em;font-size:14px;margin-bottom:32px;display:block;color:#1a2433;text-decoration:none}</style></head>
<body><main><a class="logo" href="/">IVAE STUDIOS</a><h1>${esc(h)}</h1>${cuerpo}
<p><a class="btn" href="${t.form}">${esc(t.back)}</a><a class="btn dark" href="${WHATSAPP}" rel="noopener">${esc(t.wa)}</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

const quiereJson = (request) => {
  const ct = request.headers.get('Content-Type') || '';
  const ac = request.headers.get('Accept') || '';
  return ct.includes('application/json') || (ac.includes('application/json') && !ac.includes('text/html'));
};

async function leerCuerpo(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return (await request.json().catch(() => null)) || {};
  if (ct.includes('form')) {
    const f = await request.formData().catch(() => null);
    const o = {};
    if (f) for (const [k, v] of f.entries()) if (typeof v === 'string') o[k] = v;
    return o;
  }
  return {};
}

async function aJuan(env, ruta, init) {
  const r = await fetch(JUAN + ruta, {
    ...init,
    headers: { ...(init && init.headers), 'x-reserva-web': env.RESERVA_WEB_SECRETO || '' },
  });
  const d = await r.json().catch(() => ({ ok: false, error: 'invalid response' }));
  return { http: r.status, d };
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const enJson = quiereJson(request);
  const b = await leerCuerpo(request);
  const lang = String(b.lang || b.idioma || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const t = TXT[lang];
  if (!rateLimit(ip)) {
    return enJson ? json({ ok: false, error: 'Too many attempts. Please wait a minute.' }, 429)
      : pagina(lang, 429, t.errH, `<p>${lang === 'es' ? 'Demasiados intentos. Espere un minuto.' : 'Too many attempts. Please wait a minute.'}</p>`);
  }
  if (!env.RESERVA_WEB_SECRETO) {
    return enJson ? json({ ok: false, error: 'Online booking is not available right now. Please message us on WhatsApp.', whatsapp: WHATSAPP }, 503)
      : pagina(lang, 503, t.errH, `<p>${lang === 'es' ? 'La reserva en línea no está disponible en este momento.' : 'Online booking is not available right now.'}</p>`);
  }
  const payload = {
    collection: b.collection, date: b.date, time: b.time, hotel: b.hotel, location: b.location,
    guests: b.guests, name: b.name, email: b.email, whatsapp: b.whatsapp || b.phone, notes: b.notes,
    lang, source: b.source || (enJson ? 'api' : 'web form'), website: b.website,
  };
  let res;
  try {
    res = await aJuan(env, '/web/reservar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {
    res = { http: 502, d: { ok: false, error: 'Booking service unavailable. Please message us on WhatsApp.' } };
  }
  const d = res.d || {};
  const hm = String(b.time || '').match(/^(\d{1,2}):(\d{2})$/);
  const hora = hm ? `${((Number(hm[1]) + 11) % 12) + 1}:${hm[2]} ${Number(hm[1]) >= 12 ? 'PM' : 'AM'}` : b.time;
  const vista = { date: esc(b.date), time: esc(hora), email: esc(b.email) };

  if (d.ok) {
    const statusUrl = d.booking_id ? `https://ivaestudios.com/api/book?id=${d.booking_id}&email=${encodeURIComponent(String(b.email || '').trim().toLowerCase())}` : null;
    if (enJson) {
      return json({
        ok: true, booking_id: d.booking_id || null, status: d.status || 'processing',
        message: d.status === 'needs_review'
          ? 'Request received. The studio will confirm it personally by email or WhatsApp.'
          : 'Request received. The calendar is being checked now; if the time is free a confirmation letter (PDF) is emailed within a few minutes. If not, the studio emails the closest available times.',
        payment: 'No deposit. Payment at the end of the session, by card or cash.',
        status_url: statusUrl, whatsapp: WHATSAPP,
      }, res.http === 201 ? 201 : 200);
    }
    if (d.status === 'needs_review') return pagina(lang, 200, t.reviewH, `<p>${esc(t.reviewP)}</p>`);
    return pagina(lang, 200, t.okH, `<p>${t.okP(vista)}</p><p>${esc(t.okPay)}</p>${statusUrl ? `<p><a href="${esc(statusUrl)}">${esc(t.status)}</a></p>` : ''}`);
  }

  if (res.http === 409) {
    const alt = Array.isArray(d.alternativas) ? d.alternativas : [];
    if (enJson) return json({ ok: false, error: d.error, field: 'time', available_times: alt.map((s) => s.label) }, 409);
    return pagina(lang, 409, t.busyH, `<p>${t.busyP(vista)}</p>${alt.length ? `<p>${esc(t.altP)}</p><ul>${alt.map((s) => `<li>${esc(s.label)}</li>`).join('')}</ul>` : `<p>${esc(t.noAlt)}</p>`}`);
  }
  if (enJson) return json({ ok: false, error: d.error || 'Could not book', field: d.campo || null, whatsapp: WHATSAPP }, res.http >= 400 && res.http < 600 ? res.http : 400);
  return pagina(lang, res.http >= 400 && res.http < 600 ? res.http : 400, t.errH, `<p>${esc(d.error || 'Could not book.')}</p>`);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const email = url.searchParams.get('email');
  if (!id || !email) {
    return json({
      ok: true,
      how_to_book: 'POST to https://ivaestudios.com/api/book (JSON or form) or use the form at https://ivaestudios.com/book',
      docs: 'https://ivaestudios.com/api/openapi.json',
    }, 200);
  }
  if (!env.RESERVA_WEB_SECRETO) return json({ ok: false, error: 'unavailable' }, 503);
  try {
    const r = await aJuan(env, `/web/estado?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`, { method: 'GET' });
    return json(r.d, r.http);
  } catch {
    return json({ ok: false, error: 'unavailable' }, 502);
  }
}
