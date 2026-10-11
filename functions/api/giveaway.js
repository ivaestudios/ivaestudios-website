// IVAE Studios — Cancún Wedding Photography Giveaway (US couples, 2027)
// Cloudflare Pages Function — /api/giveaway
//
//   POST /api/giveaway              { first_name, email, ... , turnstileToken, ref }
//                                   → registra la entrada en D1 (giveaway_entries),
//                                     acredita la referencia y manda el correo de
//                                     confirmación por Resend. Devuelve { ok, code, link, entries }.
//   POST /api/giveaway?a=follow     { code } → entrada extra por seguir @ivae.studios.
//   GET  /api/giveaway?a=stats&key=…  → conteos (solo con GIVEAWAY_KEY).
//   GET  /api/giveaway?a=export&key=… → CSV de todas las entradas (solo con GIVEAWAY_KEY).
//
// Reglas de la casa: nunca se guardan dos entradas del mismo correo (índice
// único por campaña), el teléfono y el Instagram son opcionales, y el sorteo se
// hace FUERA de aquí (scratchpad/giveaway/sortear.py) con el CSV exportado.
// Las entradas solo se aceptan dentro del periodo oficial; con la llave de
// administración se puede probar antes (?preview=KEY).

const CAMPAIGN = 'cancun2027';
const OPENS_AT = Date.parse('2026-10-21T13:00:00Z');   // Oct 21, 2026, 9:00 a.m. ET
const CLOSES_AT = Date.parse('2026-12-03T04:59:59Z');  // Dec 2, 2026, 11:59 p.m. ET
const MAX_REFERRALS = 5;
const SITE = 'https://ivaestudios.com';
const LANDING = `${SITE}/cancun-wedding-giveaway`;
const RULES = `${SITE}/cancun-wedding-giveaway-rules`;
const FROM = 'IVAE Studios <info@ivaestudios.com>';

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

// Límite por IP en memoria (por aislado): 5 entradas por minuto bastan para
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
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = new Set(['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11', '2027-12', '2028-01', '2028-02', '2028-03', 'later', 'undecided']);
const DESTINOS = new Set(['cancun', 'riviera-maya', 'tulum', 'isla-mujeres', 'los-cabos', 'undecided']);
const INVITADOS = new Set(['elopement', '2-30', '31-80', '81-150', '150+', 'undecided']);

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
const entradasDe = (f) => 1 + (Number(f.bonus_follow) ? 1 : 0) + Math.min(MAX_REFERRALS, Number(f.referrals) || 0);

// ── Correo de confirmación (Resend) ─────────────────────────────────────────
function correoConfirmacion({ first_name, code, link }) {
  const nombre = escapeHtml(first_name);
  const url = escapeHtml(link);
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f7f7f5;font-family:Georgia,'Times New Roman',serif;color:#1a2433">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f5"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e4df">
<tr><td style="padding:30px 28px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#1f3a5a">IVAE Studios · Cancún &amp; Riviera Maya</td></tr>
<tr><td style="padding:6px 28px 0;text-align:center;font-size:30px;line-height:1.15;font-weight:400;color:#1a1a1a">You're in, ${nombre}.</td></tr>
<tr><td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a2433">Your entry for the Cancún wedding photography giveaway is confirmed. One couple will receive <strong>The Heartfelt Film</strong> collection for their wedding in Cancún or the Riviera Maya: eight hours of coverage, two photographers and a filmmaker, the full gallery, a highlight film and a feature film.</td></tr>
<tr><td style="padding:22px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a2433"><strong>Want extra entries?</strong> Share your personal link. Every friend who enters through it adds one entry for you (up to ${MAX_REFERRALS}), and following <a href="https://www.instagram.com/ivae.studios/" style="color:#1f3a5a">@ivae.studios</a> adds another.</td></tr>
<tr><td style="padding:16px 28px 0;text-align:center"><a href="${url}" style="display:inline-block;background:#1f3a5a;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px">Your link to share</a></td></tr>
<tr><td style="padding:10px 28px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5a6472;word-break:break-all">${url}</td></tr>
<tr><td style="padding:26px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2433">Entries close on <strong>December 2, 2026 at 11:59 p.m. ET</strong>. The winner is drawn at random on December 4 and notified by email, so keep an eye on this inbox.</td></tr>
<tr><td style="padding:22px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2433">While you wait, this is a complete wedding exactly as our couples receive it:<br><a href="https://gallery.ivaestudios.com/gallery.html?id=25e55b14abf7e8535affef8eef23a6a8&amp;muestra=02cb2779ae2ae59411c7ca28612b859a" style="color:#1f3a5a">See a full wedding gallery</a></td></tr>
<tr><td style="padding:26px 28px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2433">Warmly,<br><strong>Vianey Díaz</strong><br>Director, IVAE Studios<br><a href="${SITE}" style="color:#1f3a5a">ivaestudios.com</a> · <a href="https://www.instagram.com/ivae.studios/" style="color:#1f3a5a">@ivae.studios</a></td></tr>
<tr><td style="padding:14px 28px 22px;border-top:1px solid #e6e4df;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#7a8290">Entry code ${escapeHtml(code)}. No purchase necessary. Open to legal residents of the 50 United States and D.C., 18 or older. Void where prohibited. <a href="${RULES}" style="color:#7a8290">Official Rules</a> · <a href="${SITE}/privacy-policy" style="color:#7a8290">Privacy</a>. This giveaway is not sponsored, endorsed or administered by Instagram or Meta. To stop receiving emails about it, reply with the word UNSUBSCRIBE.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `You're in, ${first_name}.\n\nYour entry for the Cancún wedding photography giveaway is confirmed. One couple will receive The Heartfelt Film collection for their wedding in Cancún or the Riviera Maya: eight hours of coverage, two photographers and a filmmaker, the full gallery, a highlight film and a feature film.\n\nWant extra entries? Share your personal link. Every friend who enters through it adds one entry for you (up to ${MAX_REFERRALS}), and following @ivae.studios on Instagram adds another.\n\nYour link: ${link}\n\nEntries close on December 2, 2026 at 11:59 p.m. ET. The winner is drawn at random on December 4 and notified by email.\n\nSee a full wedding gallery: https://gallery.ivaestudios.com/gallery.html?id=25e55b14abf7e8535affef8eef23a6a8&muestra=02cb2779ae2ae59411c7ca28612b859a\n\nWarmly,\nVianey Díaz\nDirector, IVAE Studios\n${SITE} · @ivae.studios\n\nEntry code ${code}. No purchase necessary. Open to legal residents of the 50 United States and D.C., 18 or older. Void where prohibited. Official Rules: ${RULES}. Not sponsored, endorsed or administered by Instagram or Meta. To stop receiving emails about it, reply UNSUBSCRIBE.`;
  return { html, text };
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

// ── Entrada ──────────────────────────────────────────────────────────────────
async function entrar(context, origin) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!rateLimit(ip)) return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, origin);
  if (!env.DB) return json({ error: 'The giveaway is not available right now. Please try again later.' }, 503, origin);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, origin); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400, origin);

  const ahora = Date.now();
  const admin = esAdmin(url, env);
  if (ahora < OPENS_AT && !admin) return json({ error: 'Entries open on October 21, 2026. Come back then!' }, 409, origin);
  if (ahora > CLOSES_AT && !admin) return json({ error: 'Entries closed on December 2, 2026. Thank you for your interest.' }, 410, origin);

  // Honeypot: un campo que la persona no ve y los bots llenan.
  if (clean(body.website, 10)) return json({ ok: true, code: 'OK', entries: 1 }, 200, origin);

  const first_name = clean(body.first_name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const partner_name = clean(body.partner_name, 80) || null;
  const phone = clean(body.phone, 40) || null;
  const wedding_month = MESES.has(body.wedding_month) ? body.wedding_month : 'undecided';
  const destination = DESTINOS.has(body.destination) ? body.destination : 'undecided';
  const guests = INVITADOS.has(body.guests) ? body.guests : 'undecided';
  const instagram = clean(body.instagram, 60).replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null;
  const note = clean(body.note, 600) || null;
  const source = clean(body.source, 120) || null;
  const ref = clean(body.ref, 16).toUpperCase() || null;
  const consent = body.consent === true || body.consent === 'on' || body.consent === 1;
  if (!first_name) return json({ error: 'Please tell us your first name.', field: 'first_name' }, 400, origin);
  if (!isValidEmail(email)) return json({ error: 'That email address does not look right.', field: 'email' }, 400, origin);
  if (!consent) return json({ error: 'Please accept the Official Rules to enter.', field: 'consent' }, 400, origin);

  // Turnstile (igual que el formulario de IVAE Marketing).
  if (env.TURNSTILE_SECRET_KEY && !admin) {
    const token = clean(body.turnstileToken, 4000);
    if (!token) return json({ error: 'Anti-bot verification required. Please refresh and try again.' }, 400, origin);
    try {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      });
      const r = await v.json();
      if (!r.success) return json({ error: 'Anti-bot verification failed. Please refresh and try again.' }, 403, origin);
    } catch (e) { console.warn('giveaway turnstile network', e && e.name); }
  }

  // ¿Ya estaba? Se le recuerda su código sin crear otra entrada.
  const ya = await env.DB.prepare('SELECT code, first_name, bonus_follow, referrals FROM giveaway_entries WHERE campaign = ? AND email = ?').bind(CAMPAIGN, email).first();
  if (ya) {
    return json({ ok: true, repeat: true, code: ya.code, link: `${LANDING}?ref=${ya.code}`, entries: entradasDe(ya), bonus_follow: !!Number(ya.bonus_follow) }, 200, origin);
  }

  const code = codigo();
  const eid = id();
  const ip_hash = await sha(ip + '|' + (env.GIVEAWAY_KEY || 'ivae'));
  const ua = clean(request.headers.get('User-Agent') || '', 200) || null;
  // La referencia solo cuenta si el código existe, es de esta campaña y no es la propia.
  let refOk = null;
  if (ref && /^[A-Z2-9]{8}$/.test(ref)) {
    const r = await env.DB.prepare('SELECT code, email, referrals FROM giveaway_entries WHERE campaign = ? AND code = ?').bind(CAMPAIGN, ref).first();
    if (r && r.email !== email) refOk = r;
  }
  try {
    await env.DB.prepare(
      `INSERT INTO giveaway_entries (id, campaign, code, email, first_name, partner_name, phone, wedding_month, destination, guests, instagram, note, source, ref_code, consent, ip_hash, ua)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(eid, CAMPAIGN, code, email, first_name, partner_name, phone, wedding_month, destination, guests, instagram, note, source, refOk ? refOk.code : null, ip_hash, ua).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) {
      const x = await env.DB.prepare('SELECT code, bonus_follow, referrals FROM giveaway_entries WHERE campaign = ? AND email = ?').bind(CAMPAIGN, email).first();
      if (x) return json({ ok: true, repeat: true, code: x.code, link: `${LANDING}?ref=${x.code}`, entries: entradasDe(x) }, 200, origin);
    }
    console.error('giveaway insert', e && e.message);
    return json({ error: 'We could not save your entry. Please try again in a moment.' }, 500, origin);
  }
  if (refOk) {
    try { await env.DB.prepare('UPDATE giveaway_entries SET referrals = referrals + 1 WHERE campaign = ? AND code = ?').bind(CAMPAIGN, refOk.code).run(); } catch { /* la referencia es un extra */ }
  }

  const link = `${LANDING}?ref=${code}`;
  let email_status = 'no-key';
  if (env.RESEND_API_KEY) {
    const c = correoConfirmacion({ first_name, code, link });
    email_status = await resend(env, {
      from: FROM, to: [email], reply_to: 'info@ivaestudios.com',
      subject: "You're in: the Cancún wedding photography giveaway",
      html: c.html, text: c.text,
      tags: [{ name: 'campana', value: 'giveaway_cancun2027' }, { name: 'tipo', value: 'confirmacion' }],
    });
  }
  try { await env.DB.prepare('UPDATE giveaway_entries SET email_status = ? WHERE id = ?').bind(email_status, eid).run(); } catch { /* noop */ }
  return json({ ok: true, code, link, entries: 1, bonus_follow: false }, 200, origin);
}

async function seguir(context, origin) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Not available.' }, 503, origin);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, origin); }
  const code = clean(body && body.code, 16).toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) return json({ error: 'Invalid code.' }, 400, origin);
  await env.DB.prepare('UPDATE giveaway_entries SET bonus_follow = 1 WHERE campaign = ? AND code = ?').bind(CAMPAIGN, code).run();
  const f = await env.DB.prepare('SELECT bonus_follow, referrals FROM giveaway_entries WHERE campaign = ? AND code = ?').bind(CAMPAIGN, code).first();
  if (!f) return json({ error: 'Invalid code.' }, 404, origin);
  return json({ ok: true, entries: entradasDe(f), bonus_follow: true }, 200, origin);
}

async function stats(env, origin) {
  const t = await env.DB.prepare(
    `SELECT COUNT(*) AS entradas, SUM(bonus_follow) AS siguen, SUM(CASE WHEN ref_code IS NOT NULL THEN 1 ELSE 0 END) AS referidas,
            SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS ultimas_24h,
            SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS correos_enviados
       FROM giveaway_entries WHERE campaign = ?`
  ).bind(CAMPAIGN).first();
  const porDia = await env.DB.prepare("SELECT substr(created_at, 1, 10) AS dia, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY 1").bind(CAMPAIGN).all();
  const porFuente = await env.DB.prepare('SELECT COALESCE(source, \'(directo)\') AS fuente, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY n DESC LIMIT 20').bind(CAMPAIGN).all();
  const porMes = await env.DB.prepare('SELECT wedding_month, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY 1').bind(CAMPAIGN).all();
  const porDestino = await env.DB.prepare('SELECT destination, COUNT(*) AS n FROM giveaway_entries WHERE campaign = ? GROUP BY 1 ORDER BY n DESC').bind(CAMPAIGN).all();
  return json({ campaign: CAMPAIGN, abre: new Date(OPENS_AT).toISOString(), cierra: new Date(CLOSES_AT).toISOString(), totales: t, por_dia: porDia.results, por_fuente: porFuente.results, por_mes: porMes.results, por_destino: porDestino.results }, 200, origin);
}

async function exportar(env) {
  const r = await env.DB.prepare('SELECT * FROM giveaway_entries WHERE campaign = ? ORDER BY created_at ASC').bind(CAMPAIGN).all();
  const filas = r.results || [];
  const cols = ['id', 'code', 'email', 'first_name', 'partner_name', 'phone', 'wedding_month', 'destination', 'guests', 'instagram', 'note', 'source', 'ref_code', 'referrals', 'bonus_follow', 'entries', 'email_status', 'status', 'created_at'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [cols.join(',')];
  for (const f of filas) out.push(cols.map((c) => esc(c === 'entries' ? entradasDe(f) : f[c])).join(','));
  return new Response('﻿' + out.join('\n'), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="giveaway-${CAMPAIGN}.csv"`, 'Cache-Control': 'no-store' } });
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
    if (request.method === 'POST') return a === 'follow' ? seguir(context, origin) : entrar(context, origin);
    if (request.method === 'GET') {
      if (!esAdmin(url, env)) return json({ error: 'Not found' }, 404, origin);
      if (!env.DB) return json({ error: 'No DB' }, 503, origin);
      if (a === 'export') return exportar(env);
      return stats(env, origin);
    }
    return json({ error: 'Method not allowed' }, 405, origin);
  } catch (e) {
    console.error('giveaway', e && e.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500, origin);
  }
}
