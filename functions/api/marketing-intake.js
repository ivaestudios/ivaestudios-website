// IVAE Marketing — Client Intake Form → Email Pipeline
// Cloudflare Pages Function — POST /api/marketing-intake
// Sends a formatted intake brief to info@ivaestudios.com via Resend.

const MAX = {
  shortText: 250,
  mediumText: 800,
  longText: 2000,
  name: 120,
  email: 254,
  phone: 40,
  url: 300,
};

// Allowed origins for CORS. Apex + www + local preview.
const ALLOWED_ORIGINS = new Set([
  'https://ivaestudios.com',
  'https://www.ivaestudios.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);

// Pick the allowed origin for the current request — falls back to the
// canonical apex if the Origin header is missing or unknown.
function pickOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return 'https://ivaestudios.com';
}

// In-memory fallback rate limiter (per-isolate, best-effort). The
// authoritative limit is the Cloudflare INTAKE_RATELIMIT binding when
// available; this kicks in only when the binding is missing so the form
// is never wide open. 3 requests / 60s per IP.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 3;
const rlBucket = new Map();
function memoryRateLimit(ip) {
  const now = Date.now();
  const arr = (rlBucket.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) {
    rlBucket.set(ip, arr);
    return false;
  }
  arr.push(now);
  rlBucket.set(ip, arr);
  // Cheap GC so the map doesn't grow forever.
  if (rlBucket.size > 5000) {
    for (const [k, v] of rlBucket) {
      const fresh = v.filter((t) => now - t < RL_WINDOW_MS);
      if (fresh.length === 0) rlBucket.delete(k);
      else rlBucket.set(k, fresh);
    }
  }
  return true;
}

// Resend send with retry on transient failures (5xx + network errors).
// Returns { ok: boolean, status: number }. Never throws.
async function resendSendWithRetry(env, payload, { attempts = 3, label = 'send' } = {}) {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      lastStatus = res.status;
      if (res.ok) return { ok: true, status: res.status };
      // 4xx — permanent, don't retry. 5xx — transient, retry with backoff.
      if (res.status < 500) {
        // Read but don't log the body (may echo user input).
        try { await res.text(); } catch {}
        console.error(`Resend ${label} permanent failure status=${res.status}`);
        return { ok: false, status: res.status };
      }
      console.warn(`Resend ${label} transient failure status=${res.status} attempt=${i + 1}`);
    } catch (e) {
      // Network error — log type only, never the full error (may include URLs/tokens).
      console.warn(`Resend ${label} network error attempt=${i + 1}: ${e.name || 'Error'}`);
    }
    // Exponential backoff: 200ms, 600ms.
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * Math.pow(3, i)));
    }
  }
  return { ok: false, status: lastStatus };
}

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

const sanitize = (v, maxLen) => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x).slice(0, 100)).join(', ');
  return String(v).trim().slice(0, maxLen || MAX.mediumText);
};

const row = (label, value) => {
  const v = escapeHtml(value);
  if (!v) return '';
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;width:180px">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#111;font-size:14px;white-space:pre-wrap">${v}</td></tr>`;
};

const section = (title, html) => html
  ? `<h3 style="font-family:'Inter',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:0.12em;color:#0F1419;border-top:2px solid #0F1419;padding-top:20px;margin-top:32px;margin-bottom:8px">${title}</h3><table style="border-collapse:collapse;width:100%">${html}</table>`
  : '';

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowedOrigin = pickOrigin(request);

  // ─── 1. Rate limit ───
  // Prefer the Cloudflare binding; fall back to in-memory bucket so the
  // endpoint is never unlimited if the binding is missing/misconfigured.
  let limited = false;
  if (env.INTAKE_RATELIMIT) {
    try {
      const { success } = await env.INTAKE_RATELIMIT.limit({ key: ip });
      if (!success) limited = true;
    } catch (e) {
      console.warn('Rate-limit binding threw, falling back to in-memory bucket');
      if (!memoryRateLimit(ip)) limited = true;
    }
  } else {
    if (!memoryRateLimit(ip)) limited = true;
  }
  if (limited) {
    console.log(`marketing-intake rate-limited ip=${ip}`);
    return json({ error: 'Too many requests. Please try again in a minute.' }, 429, allowedOrigin);
  }

  // ─── 2. Parse body ───
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400, allowedOrigin);
  }

  // ─── 3. Honeypot ───
  if (body.website && String(body.website).trim() !== '') {
    // Silently 200 to avoid tipping off bots
    console.log(`marketing-intake honeypot tripped ip=${ip}`);
    return json({ ok: true }, 200, allowedOrigin);
  }

  // ─── 4. Validate required fields ───
  const legal_name = sanitize(body.legal_name, MAX.name);
  const contact_name = sanitize(body.contact_name, MAX.name);
  const contact_email = sanitize(body.contact_email, MAX.email);
  const contact_role = sanitize(body.contact_role, MAX.name);
  const one_sentence = sanitize(body.one_sentence, MAX.shortText);
  const goal_12mo = sanitize(body.goal_12mo, MAX.mediumText);
  const ideal_client = sanitize(body.ideal_client, MAX.mediumText);
  const competitors = sanitize(body.competitors, MAX.mediumText);
  const budget = sanitize(body.budget, 50);

  if (!legal_name || !contact_name || !contact_email || !contact_role || !one_sentence || !ideal_client || !competitors) {
    return json({ error: 'Required fields are missing.' }, 400, allowedOrigin);
  }
  if (!isValidEmail(contact_email)) {
    return json({ error: 'Email address is not valid.' }, 400, allowedOrigin);
  }

  // ─── 5. Turnstile verification (if secret configured) ───
  const turnstileToken = body.turnstileToken;
  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return json({ error: 'Anti-bot verification required.' }, 400, allowedOrigin);
    }
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          remoteip: ip,
        }),
      });
      const tsRes = await verify.json();
      if (!tsRes.success) {
        // Log only the error-code list (safe enum), never raw body.
        const codes = Array.isArray(tsRes['error-codes']) ? tsRes['error-codes'].join(',') : 'unknown';
        console.warn(`Turnstile verification rejected ip=${ip} codes=${codes}`);
        return json({ error: 'Anti-bot verification failed. Please refresh and try again.' }, 403, allowedOrigin);
      }
    } catch (e) {
      // Network error to Turnstile — log type only, soft-fail to avoid
      // blocking real users on Cloudflare-side issues.
      console.warn(`Turnstile network error: ${e.name || 'Error'}`);
    }
  }

  // ─── 6. Sanitize all fields ───
  const f = {
    legal_name,
    commercial_name: sanitize(body.commercial_name, MAX.name),
    year_founded: sanitize(body.year_founded, 10),
    website_url: sanitize(body.website_url, MAX.url),
    location: sanitize(body.location, MAX.mediumText),
    one_sentence,
    contact_name,
    contact_role,
    contact_email,
    contact_whatsapp: sanitize(body.contact_whatsapp, MAX.phone),
    decision_maker: sanitize(body.decision_maker, MAX.name),
    comm_channel: sanitize(body.comm_channel, 30),
    goal_12mo,
    priority: sanitize(body.priority, 200),
    kpis: sanitize(body.kpis, MAX.mediumText),
    fire_reason: sanitize(body.fire_reason, MAX.mediumText),
    ideal_client,
    client_mix: sanitize(body.client_mix, MAX.shortText),
    emotional_state: sanitize(body.emotional_state, MAX.mediumText),
    audience_lang: sanitize(body.audience_lang, 100),
    adj_yes: sanitize(body.adj_yes, MAX.shortText),
    adj_no: sanitize(body.adj_no, MAX.shortText),
    ref_1: sanitize(body.ref_1, MAX.mediumText),
    ref_2: sanitize(body.ref_2, MAX.mediumText),
    ref_3: sanitize(body.ref_3, MAX.mediumText),
    ref_avoid: sanitize(body.ref_avoid, MAX.mediumText),
    ig_handle: sanitize(body.ig_handle, 80),
    tiktok_handle: sanitize(body.tiktok_handle, 80),
    fb_handle: sanitize(body.fb_handle, MAX.shortText),
    other_channels: sanitize(body.other_channels, MAX.shortText),
    current_agency: sanitize(body.current_agency, 30),
    working_not_working: sanitize(body.working_not_working, MAX.longText),
    monthly_inquiries: sanitize(body.monthly_inquiries, MAX.shortText),
    competitors,
    competitor_strengths: sanitize(body.competitor_strengths, MAX.longText),
    aspiration: sanitize(body.aspiration, MAX.shortText),
    budget,
    start_date: sanitize(body.start_date, MAX.shortText),
    deadlines: sanitize(body.deadlines, MAX.shortText),
    restrictions: sanitize(body.restrictions, MAX.mediumText),
    anything_else: sanitize(body.anything_else, MAX.longText),
    want_call: sanitize(body.want_call, 10),
  };

  // ─── 7. Build email HTML ───
  const subject = `IVAE Marketing — Strategy Brief from ${f.legal_name}`;
  const submittedAt = new Date().toISOString();
  const referer = request.headers.get('Referer') || '';
  const ua = request.headers.get('User-Agent') || '';

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2ED;font-family:'Inter',-apple-system,Segoe UI,sans-serif;color:#0F1419">
<div style="max-width:680px;margin:0 auto;background:#FFFFFF;padding:40px 32px;border-bottom:8px solid #E8FF5C">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#6B7380;margin-bottom:8px">IVAE Marketing · Strategy Brief</div>
  <h1 style="font-size:24px;font-weight:600;margin:0 0 8px;letter-spacing:-0.01em">${escapeHtml(f.legal_name)}</h1>
  <p style="font-size:14px;color:#6B7380;margin:0 0 8px">${escapeHtml(f.one_sentence)}</p>
  <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#6B7380;margin:0">${escapeHtml(submittedAt)}</p>

  ${section('Business', `
    ${row('Legal name', f.legal_name)}
    ${row('Commercial name', f.commercial_name)}
    ${row('Year founded', f.year_founded)}
    ${row('Website', f.website_url)}
    ${row('Location(s)', f.location)}
    ${row('In one sentence', f.one_sentence)}
  `)}

  ${section('Decision-makers', `
    ${row('Primary contact', `${f.contact_name} — ${f.contact_role}`)}
    ${row('Email', `<a href="mailto:${escapeHtml(f.contact_email)}" style="color:#0F1419">${escapeHtml(f.contact_email)}</a>`)}
    ${row('WhatsApp / phone', f.contact_whatsapp)}
    ${row('Final decision-maker', f.decision_maker)}
    ${row('Preferred channel', f.comm_channel)}
  `)}

  ${section('Goals', `
    ${row('12-month vision', f.goal_12mo)}
    ${row('90-day priorities', f.priority)}
    ${row('KPIs to measure', f.kpis)}
    ${row('What would fire an agency', f.fire_reason)}
  `)}

  ${section('Audience', `
    ${row('Ideal client', f.ideal_client)}
    ${row('Client mix', f.client_mix)}
    ${row('Emotional state', f.emotional_state)}
    ${row('Languages', f.audience_lang)}
  `)}

  ${section('Voice & references', `
    ${row('Adjectives YES', f.adj_yes)}
    ${row('Adjectives NO', f.adj_no)}
    ${row('Inspiration 1', f.ref_1)}
    ${row('Inspiration 2', f.ref_2)}
    ${row('Inspiration 3', f.ref_3)}
    ${row('Avoid being like', f.ref_avoid)}
  `)}

  ${section('Current state', `
    ${row('Instagram', f.ig_handle)}
    ${row('TikTok', f.tiktok_handle)}
    ${row('Facebook', f.fb_handle)}
    ${row('Other channels', f.other_channels)}
    ${row('Currently working with', f.current_agency)}
    ${row('What is working / not working', f.working_not_working)}
    ${row('Monthly inquiries from social', f.monthly_inquiries)}
  `)}

  ${section('Competitive landscape', `
    ${row('Competitors', f.competitors)}
    ${row('Competitor strengths', f.competitor_strengths)}
    ${row('Aspirational peer', f.aspiration)}
  `)}

  ${section('Investment & next steps', `
    ${row('Budget tier', f.budget)}
    ${row('Desired start date', f.start_date)}
    ${row('Fixed deadlines', f.deadlines)}
    ${row('Restrictions / no-go', f.restrictions)}
    ${row('Anything else', f.anything_else)}
    ${row('Wants discovery call', f.want_call === 'yes' ? 'YES — schedule within 7 days' : '—')}
  `)}

  <hr style="border:0;border-top:1px solid #D9D6CF;margin:32px 0 16px"/>
  <p style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#9B9590;margin:0;line-height:1.6">
    Submitted: ${escapeHtml(submittedAt)}<br/>
    IP: ${escapeHtml(ip)}<br/>
    Referrer: ${escapeHtml(referer)}<br/>
    User-Agent: ${escapeHtml(ua.slice(0, 200))}
  </p>
</div>
</body></html>`;

  // ─── 8. Send via Resend ───
  const plainTextBrief = buildPlainTextBrief(f, submittedAt);

  if (!env.RESEND_API_KEY) {
    // Graceful fallback: build a plain-text version of the brief and instruct
    // the client to open mailto: with it prefilled. The form still "works" —
    // it just routes through the prospect's email client instead of silently
    // via API. This unblocks the form before Resend secrets are configured.
    console.log('marketing-intake mailto-fallback (RESEND_API_KEY not set)');
    return json({
      ok: true,
      fallback: 'mailto',
      mailto: {
        to: env.INTAKE_TO_EMAIL || 'info@ivaestudios.com',
        subject,
        body: plainTextBrief,
      },
      note: 'Email service not yet configured. Opening your email client to send the brief directly.',
    }, 200, allowedOrigin);
  }

  const toEmail = env.INTAKE_TO_EMAIL || 'info@ivaestudios.com';
  const fromEmail = env.INTAKE_FROM_EMAIL || 'info@ivaestudios.com';

  // 1) Send full brief to IVAE Marketing team (with retry on transient errors).
  const teamSend = await resendSendWithRetry(env, {
    from: `IVAE Marketing Intake <${fromEmail}>`,
    to: [toEmail],
    reply_to: f.contact_email,
    subject,
    html,
    text: plainTextBrief,
  }, { attempts: 3, label: 'team-brief' });

  if (!teamSend.ok) {
    return json(
      { error: 'We could not deliver your brief. Please write to info@ivaestudios.com directly.' },
      502,
      allowedOrigin,
    );
  }

  // 2) Send confirmation to client (best-effort, do not block on failure).
  try {
    const firstName = (f.contact_name || '').split(' ')[0] || '';
    const clientSubject = 'Hemos recibido tu brief — IVAE Marketing';
    const clientHtml = buildClientConfirmationHtml(f, firstName);
    const clientText = buildClientConfirmationText(f, firstName);
    await resendSendWithRetry(env, {
      from: `IVAE Marketing <${fromEmail}>`,
      to: [f.contact_email],
      reply_to: toEmail,
      subject: clientSubject,
      html: clientHtml,
      text: clientText,
    }, { attempts: 2, label: 'client-confirmation' });
  } catch (e) {
    // Confirmation email is best-effort — don't fail the form submission.
    console.warn(`Client confirmation skipped: ${e.name || 'Error'}`);
  }

  console.log(`marketing-intake ok ip=${ip} brand="${(f.legal_name || '').slice(0, 60)}"`);

  // ─── 9. Success ───
  return json({ ok: true }, 200, allowedOrigin);
}

// CORS preflight — echoes the request Origin if it's on the allowlist.
export function onRequestOptions(context) {
  const allowedOrigin = pickOrigin(context.request);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

// Reject any non-POST/OPTIONS verbs explicitly with a sane CORS body.
export function onRequest(context) {
  const method = context.request.method;
  if (method === 'POST') return onRequestPost(context);
  if (method === 'OPTIONS') return onRequestOptions(context);
  const allowedOrigin = pickOrigin(context.request);
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Allow': 'POST, OPTIONS',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    },
  });
}

function json(data, status = 200, origin = 'https://ivaestudios.com') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

// Client confirmation email — IVAE Marketing purple/pink branding.
// Sent to the prospect's email after they submit the brief.
function buildClientConfirmationHtml(f, firstName) {
  const safeName = escapeHtml(firstName);
  const safeBrand = escapeHtml(f.legal_name || f.commercial_name || 'tu marca');

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Hemos recibido tu brief — IVAE Marketing</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f0eee9;-webkit-font-smoothing:antialiased;">

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0f;padding:40px 16px;">
<tr><td align="center">

  <!-- Container -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:linear-gradient(180deg,#12121a 0%,#0a0a0f 100%);border:1px solid rgba(167,139,250,0.18);border-radius:16px;overflow:hidden;">

    <!-- Header with gradient bar -->
    <tr>
      <td style="background:linear-gradient(135deg,#a78bfa 0%,#c084fc 40%,#ec4899 100%);height:4px;line-height:4px;font-size:0;">&nbsp;</td>
    </tr>

    <!-- Logo + Eyebrow -->
    <tr>
      <td style="padding:40px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:16px;color:#f0eee9;letter-spacing:-0.01em;">
              <span style="display:inline-block;width:10px;height:10px;background:linear-gradient(135deg,#a78bfa,#ec4899);border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
              IVAE Marketing
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;">
              <span style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:#a78bfa;padding:8px 16px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.18);border-radius:100px;">
                ◉ BRIEF RECIBIDO
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Hero -->
    <tr>
      <td style="padding:32px 40px 24px 40px;">
        <h1 style="font-family:'Outfit',sans-serif;font-size:38px;font-weight:900;line-height:1.05;letter-spacing:-0.025em;color:#f0eee9;margin:0 0 20px 0;">
          Gracias, ${safeName || 'gracias'}.<br/>
          <span style="background:linear-gradient(105deg,#a78bfa 0%,#c084fc 18%,#d8b4fe 28%,#ec4899 50%,#f472b6 70%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#ec4899;">El brief llegó.</span>
        </h1>
        <p style="font-family:'Outfit',sans-serif;font-size:16px;line-height:1.7;color:#c4b5fd;margin:0;">
          Recibimos toda la información de <strong style="color:#f0eee9;">${safeBrand}</strong>. Nuestro equipo de estrategia ya está revisando los detalles. Esto es lo que sigue exactamente.
        </p>
      </td>
    </tr>

    <!-- Timeline -->
    <tr>
      <td style="padding:8px 40px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(167,139,250,0.18);">

          <tr>
            <td style="padding:20px 0;border-bottom:1px solid rgba(167,139,250,0.10);" valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="100" valign="top" style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#a78bfa;padding-top:2px;">
                    En 24h
                  </td>
                  <td valign="top" style="font-family:'Outfit',sans-serif;font-size:15px;line-height:1.65;color:#f0eee9;">
                    Un acuse de recibo personal de tu estratega confirmando que el brief llegó.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0;border-bottom:1px solid rgba(167,139,250,0.10);" valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="100" valign="top" style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#a78bfa;padding-top:2px;">
                    En 72h
                  </td>
                  <td valign="top" style="font-family:'Outfit',sans-serif;font-size:15px;line-height:1.65;color:#f0eee9;">
                    Una invitación a llamada de descubrimiento de 30 minutos con una agenda de 3 preguntas que enviamos por adelantado.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0;border-bottom:1px solid rgba(167,139,250,0.10);" valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="100" valign="top" style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#a78bfa;padding-top:2px;">
                    En 7 días
                  </td>
                  <td valign="top" style="font-family:'Outfit',sans-serif;font-size:15px;line-height:1.65;color:#f0eee9;">
                    Tu <strong style="color:#c4b5fd;">Social Strategy Snapshot</strong> personalizado — 6 páginas de análisis hechas a la medida de tu brief. Sin compromiso.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0;" valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="100" valign="top" style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#a78bfa;padding-top:2px;">
                    Día 14
                  </td>
                  <td valign="top" style="font-family:'Outfit',sans-serif;font-size:15px;line-height:1.65;color:#f0eee9;">
                    Llamada de propuesta si ambas partes vemos compatibilidad. Si no, el snapshot es tuyo para quedarte.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>

    <!-- CTA + Contact -->
    <tr>
      <td style="padding:8px 40px 40px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(167,139,250,0.10),rgba(236,72,153,0.06));border:1px solid rgba(167,139,250,0.25);border-radius:12px;">
          <tr>
            <td style="padding:24px 28px;">
              <p style="font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;color:#a78bfa;margin:0 0 8px 0;">
                ¿Algo urgente?
              </p>
              <p style="font-family:'Outfit',sans-serif;font-size:15px;line-height:1.6;color:#f0eee9;margin:0;">
                Escríbenos directamente a <a href="mailto:info@ivaestudios.com" style="color:#c4b5fd;text-decoration:none;font-weight:500;border-bottom:1px solid rgba(167,139,250,0.4);">info@ivaestudios.com</a> o por <a href="https://wa.me/529987582363" style="color:#c4b5fd;text-decoration:none;font-weight:500;border-bottom:1px solid rgba(167,139,250,0.4);">WhatsApp</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Signature -->
    <tr>
      <td style="padding:0 40px 40px 40px;">
        <p style="font-family:'Outfit',sans-serif;font-size:14px;color:#8b85a3;margin:0 0 4px 0;font-style:italic;">
          Un abrazo,
        </p>
        <p style="font-family:'Outfit',sans-serif;font-size:15px;color:#f0eee9;font-weight:500;margin:0;">
          Equipo de IVAE Marketing
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:rgba(167,139,250,0.04);padding:24px 40px;border-top:1px solid rgba(167,139,250,0.12);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#6b6580;line-height:1.7;">
              IVAE Marketing · Agencia de Redes Sociales<br/>
              Cancún · Riviera Maya · Los Cabos · México<br/>
              <a href="https://ivaestudios.com/es/manejo-redes-sociales" style="color:#a78bfa;text-decoration:none;">ivaestudios.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>

</td></tr>
</table>

</body></html>`;
}

// Plain-text alternative for the client confirmation email. Used as the
// `text` field next to the HTML so spam filters and text-only clients
// (and accessibility tooling) still get a readable version.
function buildClientConfirmationText(f, firstName) {
  const brand = f.legal_name || f.commercial_name || 'tu marca';
  const name = firstName ? `${firstName}, ` : '';
  return `IVAE MARKETING — BRIEF RECIBIDO

Gracias, ${name}el brief llegó.

Recibimos toda la información de ${brand}. Nuestro equipo de
estrategia ya está revisando los detalles. Esto es lo que sigue:

EN 24H
  Un acuse de recibo personal de tu estratega confirmando que
  el brief llegó.

EN 72H
  Una invitación a llamada de descubrimiento de 30 minutos con
  una agenda de 3 preguntas que enviamos por adelantado.

EN 7 DÍAS
  Tu Social Strategy Snapshot personalizado — 6 páginas de
  análisis hechas a la medida de tu brief. Sin compromiso.

DÍA 14
  Llamada de propuesta si ambas partes vemos compatibilidad.
  Si no, el snapshot es tuyo para quedarte.

¿Algo urgente?
  Email:    info@ivaestudios.com
  WhatsApp: https://wa.me/529987582363

Un abrazo,
Equipo de IVAE Marketing

────────────────────────────────
IVAE Marketing · Agencia de Redes Sociales
Cancún · Riviera Maya · Los Cabos · México
https://ivaestudios.com/es/manejo-redes-sociales
`;
}

// Plain-text version of the brief for mailto: fallback. No HTML escaping
// because mailto: bodies are plain text.
function buildPlainTextBrief(f, submittedAt) {
  const line = (label, value) => value ? `${label}: ${value}\n` : '';
  const section = (title, body) => body.trim() ? `\n────────────────────────────────\n${title.toUpperCase()}\n────────────────────────────────\n${body}` : '';

  return `IVAE MARKETING — STRATEGY BRIEF
Submitted: ${submittedAt}

${section('Business', [
  line('Legal name', f.legal_name),
  line('Commercial name', f.commercial_name),
  line('Year founded', f.year_founded),
  line('Website', f.website_url),
  line('Location(s)', f.location),
  line('In one sentence', f.one_sentence),
].join(''))}

${section('Decision-makers', [
  line('Primary contact', `${f.contact_name} — ${f.contact_role}`),
  line('Email', f.contact_email),
  line('WhatsApp / phone', f.contact_whatsapp),
  line('Final decision-maker', f.decision_maker),
  line('Preferred channel', f.comm_channel),
].join(''))}

${section('Goals', [
  line('12-month vision', f.goal_12mo),
  line('90-day priorities', f.priority),
  line('KPIs to measure', f.kpis),
  line('What would fire an agency', f.fire_reason),
].join(''))}

${section('Audience', [
  line('Ideal client', f.ideal_client),
  line('Client mix', f.client_mix),
  line('Emotional state', f.emotional_state),
  line('Languages', f.audience_lang),
].join(''))}

${section('Voice & references', [
  line('Adjectives YES', f.adj_yes),
  line('Adjectives NO', f.adj_no),
  line('Inspiration 1', f.ref_1),
  line('Inspiration 2', f.ref_2),
  line('Inspiration 3', f.ref_3),
  line('Avoid being like', f.ref_avoid),
].join(''))}

${section('Current state', [
  line('Instagram', f.ig_handle),
  line('TikTok', f.tiktok_handle),
  line('Facebook', f.fb_handle),
  line('Other channels', f.other_channels),
  line('Currently working with', f.current_agency),
  line('What is working / not working', f.working_not_working),
  line('Monthly inquiries from social', f.monthly_inquiries),
].join(''))}

${section('Competitive landscape', [
  line('Competitors', f.competitors),
  line('Competitor strengths', f.competitor_strengths),
  line('Aspirational peer', f.aspiration),
].join(''))}

${section('Investment & next steps', [
  line('Budget tier', f.budget),
  line('Desired start date', f.start_date),
  line('Fixed deadlines', f.deadlines),
  line('Restrictions / no-go', f.restrictions),
  line('Anything else', f.anything_else),
  line('Wants discovery call', f.want_call === 'yes' ? 'YES — schedule within 7 days' : 'No'),
].join(''))}

────────────────────────────────
Submitted from ivaestudios.com/marketing-intake
`;
}
