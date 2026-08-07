/* ═══════════════════════════════════════════════════════════════
   PROBADOR CON IA · IVAE Studios
   La persona sube SU foto y Gemini la viste con el look elegido
   (figura + color + locación) manteniendo su cara y su pose.
   Rutas:
     GET  /api/outfit/status  → { ready }  (¿hay GEMINI_API_KEY?)
     POST /api/outfit/tryon   → multipart { photo, fig, color, scene }
                              → { ok, image: dataURI }
   Anti-abuso: 4 generaciones/día por IP + tope global 80/día (D1),
   foto máx 7 MB, solo JPEG/PNG/WebP reales (magic bytes).
   La foto se procesa en memoria y NO se guarda.
   ═══════════════════════════════════════════════════════════════ */

const MAX_PHOTO = 7 * 1024 * 1024;
const PER_IP_DAY = 4;
const GLOBAL_DAY = 80;

const OUTFITS = {
  mujerMaxi:  'a flowing floor-length maxi dress in {color}, lightweight linen and chiffon, elegant beach editorial style',
  mujerCorto: 'an elegant knee-length flowy dress in {color}, lightweight breathable fabric, beach editorial style',
  hombre:     'a relaxed {color} linen shirt with sleeves lightly rolled and one button open, with light cream linen trousers',
  nina:       'a simple elegant light cotton dress in {color} for a young girl',
  nino:       'a plain {color} linen shirt with light sand shorts for a young boy'
};
const COLORS = {
  cream: 'soft cream', white: 'ivory white', sand: 'warm sand beige', sage: 'muted sage green',
  dustyrose: 'dusty rose pink', terracotta: 'warm terracotta', softblue: 'soft powder blue',
  navy: 'deep navy blue', black: 'black', coral: 'bright coral'
};
const SCENES = {
  golden:   'on a Caribbean beach at golden hour, warm sunset light over turquoise water',
  turquesa: 'on a bright white-sand Caribbean beach at midday, turquoise sea behind',
  rosa:     'on a Caribbean beach under a soft pink pastel sunset sky',
  selva:    'in a lush tropical Mexican jungle with warm light filtering through the trees'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function sniffImage(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

function b64FromBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS outfit_gen_log (
       id TEXT PRIMARY KEY, ip TEXT, created_at TEXT
     )`
  ).run();
}

async function callGemini(env, mime, photoB64, prompt) {
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mime, data: photoB64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { responseModalities: ['IMAGE'] }
  });
  const models = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];
  let lastErr = 'sin respuesta';
  for (const model of models) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body
      }
    );
    if (r.status === 404) { lastErr = `modelo ${model} no disponible`; continue; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastErr = (data && data.error && data.error.message) || `HTTP ${r.status}`;
      if (r.status === 429 || r.status === 503) break; // cuota o saturación: no reintentar otro modelo
      continue;
    }
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    for (const p of parts) {
      const inl = p.inlineData || p.inline_data;
      if (inl && inl.data) return { ok: true, mime: inl.mimeType || inl.mime_type || 'image/png', data: inl.data };
    }
    lastErr = 'la IA no devolvió imagen';
  }
  return { ok: false, error: lastErr };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const segs = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];

  try {
    if (request.method === 'GET' && segs[0] === 'status')
      return json({ ready: !!env.GEMINI_API_KEY });

    if (request.method === 'POST' && segs[0] === 'tryon') {
      const es = (request.headers.get('accept-language') || 'es').toLowerCase().indexOf('es') !== -1;
      const msg = (esTxt, enTxt) => (es ? esTxt : enTxt);

      if (!env.GEMINI_API_KEY)
        return json({ ok: false, error: msg('El probador con IA aún no está activado.', 'The AI fitting room is not enabled yet.') }, 503);

      const ct = request.headers.get('content-type') || '';
      if (!ct.includes('multipart/form-data')) return json({ ok: false, error: 'Formato inválido.' }, 400);
      let form;
      try { form = await request.formData(); }
      catch (e) { return json({ ok: false, error: msg('No se pudo leer tu foto. Intenta de nuevo.', 'Could not read your photo. Try again.') }, 400); }

      const photo = form.get('photo');
      const fig = String(form.get('fig') || 'mujerMaxi');
      const color = String(form.get('color') || 'cream');
      const scene = String(form.get('scene') || 'golden');
      if (!(photo instanceof File) || photo.size === 0)
        return json({ ok: false, error: msg('Sube una foto primero.', 'Upload a photo first.') }, 400);
      if (photo.size > MAX_PHOTO)
        return json({ ok: false, error: msg('La foto pesa más de 7 MB. Usa una más ligera.', 'Photo is over 7 MB. Use a lighter one.') }, 400);
      if (!OUTFITS[fig] || !COLORS[color] || !SCENES[scene])
        return json({ ok: false, error: 'Solicitud inválida.' }, 400);

      const buf = await photo.arrayBuffer();
      const mime = sniffImage(buf);
      if (!mime)
        return json({ ok: false, error: msg('La foto debe ser JPG, PNG o WebP.', 'Photo must be JPG, PNG or WebP.') }, 400);

      // límites: por IP y global, por día UTC
      await ensureTable(env);
      const ip = request.headers.get('cf-connecting-ip') || '';
      const dayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
      const mine = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM outfit_gen_log WHERE ip = ? AND created_at > ?`
      ).bind(ip, dayStart).first();
      if (mine && mine.n >= PER_IP_DAY)
        return json({ ok: false, error: msg('Alcanzaste tus pruebas de hoy. Vuelve mañana o escríbenos por WhatsApp.', 'You reached today\'s tries. Come back tomorrow or message us on WhatsApp.') }, 429);
      const all = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM outfit_gen_log WHERE created_at > ?`
      ).bind(dayStart).first();
      if (all && all.n >= GLOBAL_DAY)
        return json({ ok: false, error: msg('El probador descansa por hoy. Vuelve mañana.', 'The fitting room is resting for today. Come back tomorrow.') }, 429);

      const outfitTxt = OUTFITS[fig].replace('{color}', COLORS[color]);
      const prompt =
        `Edit this photo. Dress the person in ${outfitTxt}. ` +
        `Keep their face, identity, hair, skin tone, body shape and pose exactly the same. ` +
        `Place them ${SCENES[scene]}. ` +
        `Photorealistic, luxury editorial photography, natural light, high detail. ` +
        `Return only the edited image.`;

      const g = await callGemini(env, mime, b64FromBuffer(buf), prompt);
      if (!g.ok)
        return json({ ok: false, error: msg('La IA está saturada en este momento. Intenta de nuevo en un minuto.', 'The AI is busy right now. Try again in a minute.'), detail: g.error }, 502);

      await env.DB.prepare(`INSERT INTO outfit_gen_log (id, ip, created_at) VALUES (?, ?, ?)`)
        .bind(crypto.randomUUID(), ip, new Date().toISOString()).run();

      return json({ ok: true, image: `data:${g.mime};base64,${g.data}` });
    }

    return json({ ok: false, error: 'Ruta no válida.' }, 404);
  } catch (err) {
    return json({ ok: false, error: 'Error interno. Intenta de nuevo.' }, 500);
  }
}
