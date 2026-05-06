/* ═══════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/focal
   ───────────────────────────────────────────────────────────────
   KV binding required: FOCAL_DATA
   Env var required:    ADMIN_PASSWORD (set in Cloudflare Pages →
                        Settings → Environment variables → Encrypted)

   Endpoints:
   • GET   /api/focal              → public read (focal point data)
   • POST  /api/focal/login        → body { password }: 200 if matches
                                     env, 401 otherwise, 503 if env unset
   • POST  /api/focal              → header X-Admin-Key must match env
                                     ADMIN_PASSWORD; writes focal payload
                                     to KV
   ═══════════════════════════════════════════════════════════════ */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });

// Constant-time string compare to avoid timing leaks
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function delayJitter() {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
}

export async function onRequestGet(context) {
  try {
    const data = await context.env.FOCAL_DATA.get('focal_points');
    return new Response(data || '{}', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const expected = context.env.ADMIN_PASSWORD;

  // Fail-closed: missing env var → 503
  if (!expected) {
    return json(503, {
      error: 'Admin disabled — set ADMIN_PASSWORD in Cloudflare Pages env vars',
    });
  }

  // /api/focal/login → password check only
  if (url.pathname === '/api/focal/login') {
    let body;
    try {
      body = await context.request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    if (!safeEq(body && body.password, expected)) {
      await delayJitter();
      return json(401, { error: 'No autorizado' });
    }
    return json(200, { ok: true });
  }

  // /api/focal → write focal points (X-Admin-Key header)
  const key = context.request.headers.get('X-Admin-Key');
  if (!safeEq(key, expected)) {
    await delayJitter();
    return json(401, { error: 'No autorizado' });
  }
  try {
    const body = await context.request.text();
    JSON.parse(body); // validate JSON
    await context.env.FOCAL_DATA.put('focal_points', body);
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
