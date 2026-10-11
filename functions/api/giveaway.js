// IVAE Studios — Free Wedding Photography 2027 for US couples (you cover our travel)
// Cloudflare Pages Function — /api/giveaway
//
//   POST /api/giveaway              JSON { first_name, email, from_city, ..., turnstileToken, ref }
//                                   (o formulario clásico x-www-form-urlencoded: sin JavaScript
//                                   el navegador manda el form y se le redirige a la página con
//                                   ?applied=CODE). Guarda la SOLICITUD en D1 (giveaway_entries),
//                                   manda la confirmación por Resend a la pareja y AVISA a info@.
//   GET  /api/giveaway?a=stats&key=…  → conteos (solo con GIVEAWAY_KEY).
//   GET  /api/giveaway?a=export&key=… → CSV de todas las solicitudes (solo con GIVEAWAY_KEY).
//
// NO es sorteo ni concurso (Israel, 10-oct-2026: "es solo mandar su solicitud y
// ya… mientras más parejas nos contacten mejor, solo pedimos cubrir los
// viáticos"): es una OFERTA abierta. Cada solicitud es un lead al que Vianey
// contesta con disponibilidad y el estimado de viaje. `ref` solo se guarda para
// saber quién pasó el link.
//
// LEY DE LA CASA (Israel, 11-oct-2026: "no quiero perder ningún lead"): una
// solicitud de una persona real NUNCA se pierde.
//   · Si el antibots (Turnstile) no cargó o el token venció, la solicitud se
//     guarda igual marcada `sin-verificar` (sin correo a la pareja, con aviso
//     interno) en vez de rechazarla.
//   · El campo trampa solo descarta cuando ADEMÁS falló el antibots: el
//     autocompletado del navegador puede llenarlo en una persona real.
//   · Si D1 falla, la solicitud se manda completa por correo a info@ y la
//     pareja ve su confirmación igual.
//   · Si la pareja vuelve a escribir, lo nuevo (teléfono, fecha, notas) se
//     agrega a su ficha y se avisa; nunca se descarta.
//   · Cada solicitud dispara un aviso a info@ con "responder" directo a la pareja.

const CAMPAIGN = 'cancun2027';
const OPENS_AT = Date.parse('2026-10-10T00:00:00Z');   // abierto desde el 10-oct-2026 (Israel: "todo 2027")
const CLOSES_AT = Date.parse('2028-01-01T05:00:00Z');  // acepta solicitudes hasta terminar 2027 (se puede cerrar antes cambiando esto)
const SITE = 'https://ivaestudios.com';
const LANDING = `${SITE}/cancun-wedding-giveaway`;
const RULES = `${SITE}/cancun-wedding-giveaway-rules`;
const GALERIA = 'https://gallery.ivaestudios.com/gallery.html?id=25e55b14abf7e8535affef8eef23a6a8&muestra=02cb2779ae2ae59411c7ca28612b859a';
const FROM = 'IVAE Studios <info@ivaestudios.com>';
const INTERNO = ['info@ivaestudios.com'];      // a quién se avisa cada solicitud
const MAX_SIN_VERIFICAR_HORA = 20;             // tope de avisos internos por solicitudes sin antibots en una hora (freno a bots)

const ALLOWED_ORIGINS = new Set([
  'https://ivaestudios.com',
  'https://www.ivaestudios.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);
function pickOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'https://ivaestudios.com';
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin || 'https://ivaestudios.com',
      'Vary': 'Origin',
    },
  });
}
// Formulario sin JavaScript: se contesta con una redirección a la página.
function redirigir(data) {
  const u = new URL(LANDING);
  if (data.ok) {
    u.searchParams.set('applied', data.code || 'OK');
    if (data.repeat) u.searchParams.set('repeat', '1');
    if (data.emailed === false) u.searchParams.set('noemail', '1');
  } else {
    u.searchParams.set('error', data.error || 'Something went wrong. Please try again.');
  }
  u.hash = 'enter';
  return new Response(null, { status: 303, headers: { Location: u.toString(), 'Cache-Control': 'no-store' } });
}
async function leerCuerpo(request) {
  const ct = (request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('form')) {
    try {
      const fd = await request.formData();
      const o = {};
      for (const [k, v] of fd.entries()) o[k] = typeof v === 'string' ? v : '';
      o.turnstileToken = o.turnstileToken || o['cf-turnstile-response'] || '';
      return { body: o, form: true };
    } catch { return { body: null, form: true }; }
  }
  try { return { body: await request.json(), form: false }; } catch { return { body: null, form: false }; }
}

// Límite por IP en memoria (por aislado): 5 solicitudes por minuto bastan para
// una pareja escribiendo a mano y frenan a un script.
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
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = new Set(['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11', '2027-12', 'later', 'undecided']);
const DESTINOS = new Set(['cancun', 'riviera-maya', 'tulum', 'isla-mujeres', 'los-cabos', 'us-city', 'us-other', 'undecided']);
const INVITADOS = new Set(['elopement', '2-30', '31-80', '81-150', '150+', 'undecided']);
const CIUDAD_TXT = {
  dallas: 'Dallas / Fort Worth, TX', houston: 'Houston, TX', 'austin-san-antonio': 'Austin / San Antonio, TX', chicago: 'Chicago, IL',
  'new-york': 'New York / New Jersey', philadelphia: 'Philadelphia, PA', atlanta: 'Atlanta, GA', miami: 'Miami / Fort Lauderdale, FL',
  'orlando-tampa': 'Orlando / Tampa, FL', 'charlotte-raleigh': 'Charlotte / Raleigh, NC', denver: 'Denver, CO', 'los-angeles': 'Los Angeles, CA',
  'san-francisco': 'San Francisco / Bay Area, CA', washington: 'Washington, DC / Baltimore', boston: 'Boston, MA', minneapolis: 'Minneapolis, MN',
  detroit: 'Detroit, MI', 'st-louis': 'St. Louis, MO', ohio: 'Cleveland / Cincinnati / Columbus, OH', nashville: 'Nashville, TN', phoenix: 'Phoenix, AZ',
  other: 'Otra ciudad de EEUU',
};
const CIUDADES = new Set(Object.keys(CIUDAD_TXT));
const DESTINO_TXT = { cancun: 'Cancún', 'riviera-maya': 'Riviera Maya', tulum: 'Tulum', 'isla-mujeres': 'Isla Mujeres', 'los-cabos': 'Los Cabos', 'us-city': 'En su ciudad (EEUU)', 'us-other': 'Otro lugar de EEUU', undecided: 'Sin decidir' };
const INVITADOS_TXT = { elopement: 'Solo ellos dos', '2-30': 'Hasta 30', '31-80': '31 a 80', '81-150': '81 a 150', '150+': 'Más de 150', undecided: 'Sin definir' };
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function mesTxt(m) {
  if (!m || m === 'undecided') return 'Sin fecha aún';
  if (m === 'later') return 'Después de 2027';
  const [y, mm] = String(m).split('-');
  return (MESES_ES[+mm - 1] || mm) + ' ' + y;
}

function codigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => abc[x % abc.length]).join('');
}
function id() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
function esAdmin(url, env) {
  const k = url.searchParams.get('key') || url.searchParams.get('preview') || '';
  return !!(env.GIVEAWAY_KEY && k && k.length === env.GIVEAWAY_KEY.length && k === env.GIVEAWAY_KEY);
}

// ── Correo de confirmación a la pareja (Resend) ──────────────────────────────
const LEGAL = 'For legal residents of the 50 United States and D.C., 18 or older, with a wedding date in 2027. Subject to availability; the couple covers the team\'s travel at cost outside Cancún and the Riviera Maya, and any venue vendor fees.';
function correoConfirmacion({ first_name, code, link }) {
  const nombre = escapeHtml(first_name);
  const url = escapeHtml(link);
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f7f7f5;font-family:Georgia,'Times New Roman',serif;color:#1a2433">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f5"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e4df">
<tr><td style="padding:0"><img src="${SITE}/images/optimized/boda-ji-kailyn-ceremonia-vacia-1200.jpg" width="560" alt="The ceremony setting at Ji and Kailyn's wedding, photographed by IVAE Studios" style="display:block;width:100%;max-width:560px;height:auto;border:0"/></td></tr>
<tr><td style="padding:26px 28px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#1f3a5a">IVAE Studios · Cancún &amp; Riviera Maya</td></tr>
<tr><td style="padding:6px 28px 0;text-align:center;font-size:30px;line-height:1.15;font-weight:400;color:#1a1a1a">Thank you, ${nombre}. We have your application.</td></tr>
<tr><td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a2433">Within two business days you will hear from Vianey with our availability for your date and, if your wedding is outside Cancún and the Riviera Maya, the travel estimate at cost: round trip flights from Cancún for our two photographers, two nights near your venue and local transport. No markup, and no commitment until you say yes.</td></tr>
<tr><td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a2433">What you receive, free: <strong>your full wedding day</strong> photographed by our two photographers, all your edited photos in your private online gallery, a professional slideshow, a sneak peek and digital delivery in 4 to 6 weeks. The film and albums are available at our regular prices if you want them.</td></tr>
<tr><td style="padding:22px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a2433">While you wait, this is a complete wedding exactly as our couples receive it, from the bouquet to the candles:</td></tr>
<tr><td style="padding:16px 28px 0;text-align:center"><a href="${GALERIA}" style="display:inline-block;background:#1f3a5a;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px">See Ji &amp; Kailyn's gallery</a></td></tr>
<tr><td style="padding:24px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2433">Know another bride and groom getting married in 2027? The offer is open to them too, while dates last:<br><a href="${url}" style="color:#1f3a5a;word-break:break-all">${url}</a></td></tr>
<tr><td style="padding:26px 28px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2433">Warmly,<br><strong>Vianey Díaz</strong><br>Director, IVAE Studios<br><a href="${SITE}" style="color:#1f3a5a">ivaestudios.com</a> · <a href="https://www.instagram.com/ivae.studios/" style="color:#1f3a5a">@ivae.studios</a></td></tr>
<tr><td style="padding:14px 28px 22px;border-top:1px solid #e6e4df;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#7a8290">Application ${escapeHtml(code)}. ${LEGAL} <a href="${RULES}" style="color:#7a8290">Terms</a> · <a href="${SITE}/privacy-policy" style="color:#7a8290">Privacy</a>. To stop receiving emails about this, reply with the word UNSUBSCRIBE.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Thank you, ${first_name}. We have your application.\n\nWithin two business days you will hear from Vianey with our availability for your date and, if your wedding is outside Cancún and the Riviera Maya, the travel estimate at cost: round trip flights from Cancún for our two photographers, two nights near your venue and local transport. No markup, and no commitment until you say yes.\n\nWhat you receive, free: your full wedding day photographed by our two photographers, all your edited photos in your private online gallery, a professional slideshow, a sneak peek and digital delivery in 4 to 6 weeks. The film and albums are available at our regular prices if you want them.\n\nSee Ji & Kailyn's full gallery: ${GALERIA}\n\nKnow another bride and groom getting married in 2027? The offer is open to them too, while dates last: ${link}\n\nWarmly,\nVianey Díaz\nDirector, IVAE Studios\n${SITE} · @ivae.studios\n\nApplication ${code}. ${LEGAL} Terms: ${RULES}. To stop receiving emails about this, reply UNSUBSCRIBE.`;
  return { html, text };
}

// ── Aviso interno a info@ (cada solicitud, en español, "responder" va a la pareja) ──
function correoInterno(f, { titulo = 'Nueva solicitud', alerta = '', estado_correo = '', cambios = null } = {}) {
  const pareja = f.first_name + (f.partner_name ? ' & ' + f.partner_name : '');
  const ciudad = CIUDAD_TXT[f.from_city] || f.from_city || '?';
  const subject = `${alerta ? '⚠️ ' : ''}${titulo} boda 2027: ${pareja} · ${ciudad} · ${mesTxt(f.wedding_month)}`;
  const filas = [
    ['Novia', f.first_name], ['Novio', f.partner_name || '(no lo puso)'], ['Correo', f.email], ['Teléfono', f.phone || '(no lo puso)'],
    ['Viven en', ciudad], ['Boda', mesTxt(f.wedding_month)], ['Dónde', DESTINO_TXT[f.destination] || f.destination || '?'], ['Invitados', INVITADOS_TXT[f.guests] || f.guests || '?'],
    ['Instagram', f.instagram ? '@' + f.instagram : '(no lo puso)'], ['Notas', f.note || '(sin notas)'], ['Llegó por', f.source || '(directo)'], ['Link de amigo', f.ref_code || 'no'],
    ['Código', f.code], ['Correo de confirmación', estado_correo === 'sent' ? 'enviado' : estado_correo === 'omitido-sin-verificar' ? 'NO enviado (sin verificar)' : estado_correo || '?'],
  ];
  const tr = filas.map(([k, v]) => `<tr><td style="padding:6px 10px 6px 0;color:#7a8290;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a2433">
${alerta ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fdecea;border:1px solid #f5c2c0;color:#a12622"><strong>Atención:</strong> ${escapeHtml(alerta)}</p>` : ''}
${cambios && cambios.length ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fff8e1;border:1px solid #f1d98a"><strong>La pareja volvió a escribir y agregó:</strong><br>${cambios.map(escapeHtml).join('<br>')}</p>` : ''}
<p style="margin:0 0 10px"><strong>${escapeHtml(pareja)}</strong> mandó su solicitud para la boda gratis 2027. Hay que contestarle en 2 días hábiles con disponibilidad y, si la boda es fuera de Cancún, el estimado de viaje. <strong>Responder a este correo le escribe directo a la pareja.</strong></p>
<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${tr}</table>
<p style="margin:16px 0 0;color:#7a8290;font-size:12px">Todas las solicitudes: ${LANDING}. Export CSV con la llave de administración.</p>
</body></html>`;
  const text = (alerta ? `ATENCIÓN: ${alerta}\n\n` : '') + (cambios && cambios.length ? `La pareja volvió a escribir y agregó:\n${cambios.join('\n')}\n\n` : '') +
    `${pareja} mandó su solicitud para la boda gratis 2027. Contestar en 2 días hábiles. Responder a este correo le escribe directo a la pareja.\n\n` +
    filas.map(([k, v]) => `${k}: ${v}`).join('\n');
  return {
    from: FROM, to: INTERNO, reply_to: f.email, subject, html, text,
    tags: [{ name: 'campana', value: 'giveaway_cancun2027' }, { name: 'tipo', value: 'aviso_interno' }],
  };
}

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
    } catch (e) { console.warn('giveaway resend network', e && e.name); }
    if (i < 2) await new Promise((r) => setTimeout(r, 200 * Math.pow(3, i)));
  }
  return 'error';
}

// ── Solicitud ────────────────────────────────────────────────────────────────
async function solicitar(context, origin) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const { body, form } = await leerCuerpo(request);
  const responder = (data, status) => (form ? redirigir(data) : json(data, status, origin));
  if (!rateLimit(ip)) return responder({ error: 'Too many attempts. Please wait a minute and try again.' }, 429);
  if (!body || typeof body !== 'object') return responder({ error: 'Invalid request.' }, 400);

  const ahora = Date.now();
  const admin = esAdmin(url, env);
  if (ahora < OPENS_AT && !admin) return responder({ error: 'Applications are not open yet. Write to info@ivaestudios.com and we will gladly help.' }, 409);
  if (ahora > CLOSES_AT && !admin) return responder({ error: 'This offer has closed. Write to info@ivaestudios.com and we will gladly help.' }, 410);

  const first_name = clean(body.first_name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const partner_name = clean(body.partner_name, 80) || null;
  const phone = clean(body.phone, 40) || null;
  const from_city = CIUDADES.has(body.from_city) ? body.from_city : '';
  const wedding_month = MESES.has(body.wedding_month) ? body.wedding_month : 'undecided';
  const destination = DESTINOS.has(body.destination) ? body.destination : 'undecided';
  const guests = INVITADOS.has(body.guests) ? body.guests : 'undecided';
  const instagram = clean(body.instagram, 60).replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null;
  const note = clean(body.note, 1500) || null;
  const source = clean(body.source, 120) || null;
  const ref = clean(body.ref, 16).toUpperCase() || null;
  const consent = body.consent === true || body.consent === 'on' || body.consent === 1 || body.consent === 'true' || body.consent === '1';
  if (!first_name) return responder({ error: "Please tell us the bride's first name.", field: 'first_name' }, 400);
  if (!isValidEmail(email)) return responder({ error: 'That email address does not look right.', field: 'email' }, 400);
  if (!from_city) return responder({ error: 'Tell us where you will be flying from.', field: 'from_city' }, 400);
  if (!consent) return responder({ error: 'Please accept the Terms to apply.', field: 'consent' }, 400);

  // Campo trampa (los bots lo llenan; el autocompletado de una persona también puede).
  const trampa = !!(clean(body.hp_field, 10) || clean(body.website, 10));

  // Antibots (Turnstile). Si no se puede verificar, NO se rechaza: se marca.
  let verificado = admin ? 'admin' : (env.TURNSTILE_SECRET_KEY ? 'sin-token' : 'sin-antibots');
  if (env.TURNSTILE_SECRET_KEY && !admin) {
    const token = clean(body.turnstileToken, 4000);
    if (token) {
      try {
        const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
        });
        const r = await v.json();
        verificado = r && r.success ? 'ok' : 'rechazado';
      } catch (e) { console.warn('giveaway turnstile network', e && e.name); verificado = 'ok-sin-red'; }
    }
  }
  const humano = verificado === 'ok' || verificado === 'admin' || verificado === 'ok-sin-red' || verificado === 'sin-antibots';
  if (!humano && trampa) return responder({ ok: true, code: 'OK', link: LANDING }, 200);           // bot seguro: ni se guarda
  if (verificado === 'sin-antibots' && trampa) return responder({ ok: true, code: 'OK', link: LANDING }, 200);
  // Token vencido o ya usado: una vez se le pide al navegador que lo renueve y reintente solo.
  if (verificado === 'rechazado' && !form && !body.retry) return responder({ error: 'Our anti-bot check expired. Please tap Send again.', retry: true }, 403);
  const sinVerificar = verificado === 'sin-token' || verificado === 'rechazado';

  const db = env.DB || null;
  const refOk = ref && /^[A-Z2-9]{8}$/.test(ref) ? ref : null;

  // ¿Ya mandó solicitud? Se le confirma sin crear otra, y lo nuevo que traiga se agrega a su ficha.
  if (db) {
    const ya = await db.prepare('SELECT id, code, partner_name, phone, wedding_month, destination, guests, note FROM giveaway_entries WHERE campaign = ? AND email = ?').bind(CAMPAIGN, email).first();
    if (ya) {
      if (!sinVerificar) {
        const set = []; const vals = []; const cambios = [];
        if (partner_name && !ya.partner_name) { set.push('partner_name = ?'); vals.push(partner_name); cambios.push('novio: ' + partner_name); }
        if (phone && !ya.phone) { set.push('phone = ?'); vals.push(phone); cambios.push('teléfono: ' + phone); }
        if (wedding_month !== 'undecided' && wedding_month !== ya.wedding_month) { set.push('wedding_month = ?'); vals.push(wedding_month); cambios.push('fecha: ' + mesTxt(wedding_month)); }
        if (destination !== 'undecided' && destination !== ya.destination) { set.push('destination = ?'); vals.push(destination); cambios.push('dónde: ' + (DESTINO_TXT[destination] || destination)); }
        if (guests !== 'undecided' && guests !== ya.guests) { set.push('guests = ?'); vals.push(guests); cambios.push('invitados: ' + (INVITADOS_TXT[guests] || guests)); }
        if (note && note !== ya.note && !(ya.note || '').includes(note)) {
          set.push('note = ?'); vals.push((ya.note ? ya.note + '\n' : '') + '[' + new Date().toISOString().slice(0, 10) + '] ' + note); cambios.push('notas: ' + note);
        }
        if (set.length) {
          try { await db.prepare(`UPDATE giveaway_entries SET ${set.join(', ')} WHERE id = ?`).bind(...vals, ya.id).run(); } catch (e) { console.error('giveaway update', e && e.message); }
          if (env.RESEND_API_KEY) {
            const f = { ...ya, email, first_name, partner_name: partner_name || ya.partner_name, phone: phone || ya.phone, from_city, wedding_month: wedding_month !== 'undecided' ? wedding_month : ya.wedding_month, destination: destination !== 'undecided' ? destination : ya.destination, guests: guests !== 'undecided' ? guests : ya.guests, instagram, note: note || ya.note, source, ref_code: refOk };
            await resend(env, correoInterno(f, { titulo: 'Solicitud actualizada', cambios, estado_correo: 'ya enviado antes' }));
          }
        }
      }
      return responder({ ok: true, repeat: true, code: ya.code, link: `${LANDING}?ref=${ya.code}` }, 200);
    }
  }

  const code = codigo();
  const eid = id();
  const ip_hash = await sha(ip + '|' + (env.GIVEAWAY_KEY || 'ivae'));
  const ua = clean(request.headers.get('User-Agent') || '', 200) || null;
  const status = sinVerificar ? 'sin-verificar' : 'ok';
  const fila = { id: eid, code, email, first_name, partner_name, phone, from_city, wedding_month, destination, guests, instagram, note, source, ref_code: refOk };

  let guardada = false;
  if (db) {
    try {
      await db.prepare(
        `INSERT INTO giveaway_entries (id, campaign, code, email, first_name, partner_name, phone, from_city, wedding_month, destination, guests, instagram, note, source, ref_code, consent, ip_hash, ua, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).bind(eid, CAMPAIGN, code, email, first_name, partner_name, phone, from_city, wedding_month, destination, guests, instagram, note, source, refOk, ip_hash, ua, status).run();
      guardada = true;
    } catch (e) {
      if (/UNIQUE/i.test(String(e && e.message))) {
        try {
          const x = await db.prepare('SELECT code FROM giveaway_entries WHERE campaign = ? AND email = ?').bind(CAMPAIGN, email).first();
          if (x) return responder({ ok: true, repeat: true, code: x.code, link: `${LANDING}?ref=${x.code}` }, 200);
        } catch { /* sigue al rescate por correo */ }
      }
      console.error('giveaway insert', e && e.message);
    }
  }

  const link = `${LANDING}?ref=${code}`;
  let email_status = 'no-key';
  if (sinVerificar) email_status = 'omitido-sin-verificar';
  else if (env.RESEND_API_KEY) {
    const c = correoConfirmacion({ first_name, code, link });
    email_status = await resend(env, {
      from: FROM, to: [email], reply_to: 'info@ivaestudios.com',
      subject: 'We have your application: your wedding, photographed by us for free',
      html: c.html, text: c.text,
      tags: [{ name: 'campana', value: 'giveaway_cancun2027' }, { name: 'tipo', value: 'confirmacion' }],
    });
  }
  if (guardada) { try { await db.prepare('UPDATE giveaway_entries SET email_status = ? WHERE id = ?').bind(email_status, eid).run(); } catch { /* noop */ } }

  // Aviso interno. Si no se guardó en D1, este correo ES la solicitud.
  let aviso = 'omitido';
  if (env.RESEND_API_KEY) {
    let avisar = true;
    if (sinVerificar && guardada) {
      try {
        const n = await db.prepare("SELECT COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? AND status = 'sin-verificar' AND created_at >= datetime('now', '-1 hour')").bind(CAMPAIGN).first();
        if (n && n.n > MAX_SIN_VERIFICAR_HORA) avisar = false;
      } catch { /* noop */ }
    }
    if (avisar) {
      const alerta = !guardada
        ? (db ? 'NO SE GUARDÓ EN LA BASE DE DATOS (error de D1). Este correo es la única copia de la solicitud: anotarla a mano.' : 'La base de datos no estaba disponible. Este correo es la única copia de la solicitud: anotarla a mano.')
        : (sinVerificar ? 'Llegó sin verificación antibots (el widget no cargó o el token venció). No se le mandó confirmación automática: revisar que sea real y contestarle.' : '');
      aviso = await resend(env, correoInterno(fila, { alerta, estado_correo: email_status }));
    }
  }
  if (!guardada && aviso !== 'sent') {
    return responder({ error: 'We could not save your application. Please try again in a moment, or write to info@ivaestudios.com.' }, 500);
  }
  return responder({ ok: true, code, link, emailed: email_status === 'sent', unverified: sinVerificar }, 200);
}

async function stats(env, origin) {
  const t = await env.DB.prepare(
    `SELECT COUNT(*) AS solicitudes,
            SUM(CASE WHEN ref_code IS NOT NULL THEN 1 ELSE 0 END) AS por_link_de_amigo,
            SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS ultimas_24h,
            SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS correos_enviados,
            SUM(CASE WHEN status = 'sin-verificar' THEN 1 ELSE 0 END) AS sin_verificar
       FROM giveaway_entries WHERE campaign = ?`
  ).bind(CAMPAIGN).first();
  const q = async (sql) => (await env.DB.prepare(sql).bind(CAMPAIGN).all()).results;
  return json({
    campaign: CAMPAIGN, abre: new Date(OPENS_AT).toISOString(), cierra: new Date(CLOSES_AT).toISOString(), totales: t,
    por_dia: await q("SELECT substr(created_at, 1, 10) AS dia, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY 1"),
    por_ciudad: await q("SELECT COALESCE(from_city, '') AS ciudad, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY n DESC"),
    por_fuente: await q("SELECT COALESCE(source, '(directo)') AS fuente, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY n DESC LIMIT 20"),
    por_mes: await q('SELECT wedding_month, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY 1'),
    por_destino: await q('SELECT destination, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY n DESC'),
  }, 200, origin);
}

async function exportar(env) {
  const r = await env.DB.prepare('SELECT * FROM giveaway_entries WHERE campaign = ? ORDER BY created_at ASC').bind(CAMPAIGN).all();
  const filas = r.results || [];
  const cols = ['id', 'code', 'email', 'first_name', 'partner_name', 'phone', 'from_city', 'wedding_month', 'destination', 'guests', 'instagram', 'note', 'source', 'ref_code', 'email_status', 'status', 'created_at'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [cols.join(',')];
  for (const f of filas) out.push(cols.map((c) => esc(f[c])).join(','));
  return new Response('﻿' + out.join('\n'), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="solicitudes-${CAMPAIGN}.csv"`, 'Cache-Control': 'no-store' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = pickOrigin(request);
  const url = new URL(request.url);
  const a = url.searchParams.get('a') || '';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' } });
  }
  try {
    if (request.method === 'POST') return await solicitar(context, origin);
    if (request.method === 'GET') {
      if (!esAdmin(url, env)) return json({ error: 'Not found' }, 404, origin);
      if (!env.DB) return json({ error: 'No DB' }, 503, origin);
      if (a === 'export') return exportar(env);
      return stats(env, origin);
    }
    return json({ error: 'Method not allowed' }, 405, origin);
  } catch (e) {
    console.error('giveaway', e && e.message);
    return json({ error: 'Something went wrong. Please try again, or write to info@ivaestudios.com.' }, 500, origin);
  }
}
