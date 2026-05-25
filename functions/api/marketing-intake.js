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

  // ─── 1. Rate limit (if binding available) ───
  if (env.INTAKE_RATELIMIT) {
    try {
      const { success } = await env.INTAKE_RATELIMIT.limit({ key: ip });
      if (!success) {
        return json({ error: 'Too many requests. Please try again in a minute.' }, 429);
      }
    } catch (e) {
      // Rate limiter not configured — proceed
    }
  }

  // ─── 2. Parse body ───
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  // ─── 3. Honeypot ───
  if (body.website && String(body.website).trim() !== '') {
    // Silently 200 to avoid tipping off bots
    return json({ ok: true });
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

  if (!legal_name || !contact_name || !contact_email || !contact_role || !one_sentence || !goal_12mo || !ideal_client || !competitors || !budget) {
    return json({ error: 'Required fields are missing.' }, 400);
  }
  if (!isValidEmail(contact_email)) {
    return json({ error: 'Email address is not valid.' }, 400);
  }

  // ─── 5. Turnstile verification (if secret configured) ───
  const turnstileToken = body.turnstileToken;
  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return json({ error: 'Anti-bot verification required.' }, 400);
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
        return json({ error: 'Anti-bot verification failed. Please refresh and try again.' }, 403);
      }
    } catch (e) {
      // Network error to Turnstile — soft fail
      console.warn('Turnstile verification network error:', e.message);
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
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return json({
      error: 'Email service not configured. Please write directly to info@ivaestudios.com.',
    }, 500);
  }

  const toEmail = env.INTAKE_TO_EMAIL || 'info@ivaestudios.com';
  const fromEmail = env.INTAKE_FROM_EMAIL || 'intake@ivaestudios.com';

  try {
    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `IVAE Marketing Intake <${fromEmail}>`,
        to: [toEmail],
        reply_to: f.contact_email,
        subject,
        html,
      }),
    });
    if (!send.ok) {
      const text = await send.text();
      console.error('Resend API failed:', send.status, text);
      return json({ error: 'We could not deliver your brief. Please write to info@ivaestudios.com directly.' }, 502);
    }
  } catch (e) {
    console.error('Resend network error:', e.message);
    return json({ error: 'Network error sending your brief. Please try again.' }, 502);
  }

  // ─── 9. Success ───
  return json({ ok: true });
}

// CORS preflight
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://ivaestudios.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://ivaestudios.com',
      'Cache-Control': 'no-store',
    },
  });
}
