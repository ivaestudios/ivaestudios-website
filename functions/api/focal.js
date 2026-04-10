/* ═══════════════════════════════════════════════════════════════
   Cloudflare Pages Function — /api/focal
   ───────────────────────────────────────────────────────────────
   KV binding required: FOCAL_DATA
   Stores/retrieves focal point data for all images.
   ═══════════════════════════════════════════════════════════════ */

export async function onRequestGet(context) {
  try {
    var data = await context.env.FOCAL_DATA.get('focal_points');
    return new Response(data || '{}', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    var key = context.request.headers.get('X-Admin-Key');
    if (key !== 'ivae2026') {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    var body = await context.request.text();
    JSON.parse(body); // validate JSON
    await context.env.FOCAL_DATA.put('focal_points', body);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key'
    }
  });
}
