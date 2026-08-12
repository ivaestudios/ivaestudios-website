/* ═══════════════════════════════════════════════════════════════
   PRUÉBATE ESTE LOOK · IVAE Studios
   La clienta elige un look del lookbook (foto REAL de una sesión),
   sube su foto, y la IA la viste con ESE vestido exacto.
   Clave del diseño: a la IA se le manda la FOTO del vestido, no una
   descripción de palabras (así no inventa una prenda distinta).

   Rutas:
     GET  /api/outfit/status  → { ready, variantes, restantes }
     POST /api/outfit/tryon   → multipart { photo, look, prenda }
                              → { ok, images: [dataURI, ...] }

   Reglas que protegen a la marca:
     · Se entregan VARIAS variantes: si una sale mal, no parecemos malos.
     · El prompt PROHÍBE cambiar cara, cuerpo, piel y peso.
     · La foto se procesa en memoria y NUNCA se guarda.
     · Topes duros de gasto: por IP y global, ajustables por variable.
   ═══════════════════════════════════════════════════════════════ */

const MAX_PHOTO = 7 * 1024 * 1024;
const PER_IP_DAY_DEF = 2;    // intentos por persona al día
const GLOBAL_DAY_DEF = 15;   // intentos en todo el sitio al día
const VARIANTES = 2;         // fotos por intento (2 basta y baja el costo un tercio)

// Encuadres distintos para que las variantes no salgan calcadas
const ENCUADRES = [
  'Full body vertical portrait, the person centered, feet visible.',
  'Three quarter body portrait, from mid thigh up, slightly closer.',
  'Full body, wider shot with more of the location visible around them.'
];

const PRENDAS = {
  mujerMaxi:  'a long flowing maxi dress',
  mujerCorto: 'an elegant knee length dress',
  hombre:     'a linen shirt with light linen trousers'
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

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS outfit_gen_log (id TEXT PRIMARY KEY, ip TEXT, created_at TEXT)`
  ).run();
}

async function gemini(env, partes) {
  const body = JSON.stringify({
    contents: [{ parts: partes }],
    generationConfig: { responseModalities: ['IMAGE'] }
  });
  // OJO: gemini-2.5-flash-image se retira el 2026-10-02 y el "-preview" murió el 2026-01-15.
  // Orden actual: el nuevo primero, el barato de respaldo, y el viejo solo como última red.
  const modelos = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
  let ultimo = 'sin respuesta';
  for (const modelo of modelos) {
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body
      });
    } catch (e) { ultimo = 'red'; continue; }
    if (r.status === 404) { ultimo = `modelo ${modelo} no disponible`; continue; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      ultimo = (data && data.error && data.error.message) || `HTTP ${r.status}`;
      if (r.status === 429 || r.status === 503) break;
      continue;
    }
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    for (const p of parts) {
      const inl = p.inlineData || p.inline_data;
      if (inl && inl.data) return { ok: true, mime: inl.mimeType || inl.mime_type || 'image/png', data: inl.data };
    }
    ultimo = 'la IA no devolvió imagen';
  }
  return { ok: false, error: ultimo };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const segs = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const perIp = parseInt(env.OUTFIT_PER_IP_DAY || PER_IP_DAY_DEF, 10);
  const perDia = parseInt(env.OUTFIT_GLOBAL_DAY || GLOBAL_DAY_DEF, 10);

  try {
    if (request.method === 'GET' && segs[0] === 'status')
      return json({ ready: !!env.GEMINI_API_KEY, variantes: VARIANTES, porPersona: perIp });

    if (request.method === 'POST' && segs[0] === 'tryon') {
      const es = (request.headers.get('accept-language') || 'es').toLowerCase().indexOf('es') !== -1;
      const msg = (e, i) => (es ? e : i);

      if (!env.GEMINI_API_KEY)
        return json({ ok: false, error: msg('El probador con IA aún no está activado.', 'The AI fitting room is not enabled yet.') }, 503);

      const ct = request.headers.get('content-type') || '';
      if (!ct.includes('multipart/form-data')) return json({ ok: false, error: 'Formato inválido.' }, 400);
      let form;
      try { form = await request.formData(); }
      catch (e) { return json({ ok: false, error: msg('No se pudo leer tu foto. Intenta de nuevo.', 'Could not read your photo. Try again.') }, 400); }

      const photo = form.get('photo');
      const look = String(form.get('look') || '');
      const prenda = String(form.get('prenda') || 'mujerMaxi');
      if (!(photo instanceof File) || photo.size === 0)
        return json({ ok: false, error: msg('Sube una foto primero.', 'Upload a photo first.') }, 400);
      if (photo.size > MAX_PHOTO)
        return json({ ok: false, error: msg('La foto pesa más de 7 MB. Usa una más ligera.', 'Photo is over 7 MB. Use a lighter one.') }, 400);
      // el look SOLO puede ser una foto nuestra del lookbook
      if (!/^\/images\/lookbook\/[a-z0-9-]+\.jpg$/.test(look))
        return json({ ok: false, error: 'Solicitud inválida.' }, 400);
      if (!PRENDAS[prenda]) return json({ ok: false, error: 'Solicitud inválida.' }, 400);

      const buf = await photo.arrayBuffer();
      const mime = sniffImage(buf);
      if (!mime)
        return json({ ok: false, error: msg('La foto debe ser JPG, PNG o WebP.', 'Photo must be JPG, PNG or WebP.') }, 400);

      // Topes de gasto (día UTC)
      await ensureTable(env);
      const ip = request.headers.get('cf-connecting-ip') || '';
      const desde = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
      const mias = await env.DB.prepare(`SELECT COUNT(*) AS n FROM outfit_gen_log WHERE ip = ? AND created_at > ?`)
        .bind(ip, desde).first();
      if (mias && mias.n >= perIp)
        return json({ ok: false, error: msg('Ya usaste tus pruebas de hoy. Vuelve mañana o escríbenos por WhatsApp y te ayudamos personalmente.', 'You used today\'s tries. Come back tomorrow or message us on WhatsApp and we will help you personally.') }, 429);
      const todas = await env.DB.prepare(`SELECT COUNT(*) AS n FROM outfit_gen_log WHERE created_at > ?`)
        .bind(desde).first();
      if (todas && todas.n >= perDia)
        return json({ ok: false, error: msg('El probador descansa por hoy. Vuelve mañana.', 'The fitting room is resting for today. Come back tomorrow.') }, 429);

      // La FOTO del look elegido va como referencia de la prenda
      let refB64 = null, refMime = 'image/jpeg';
      try {
        const rr = await fetch(new URL(look, request.url).toString());
        if (rr.ok) {
          const rb = await rr.arrayBuffer();
          refMime = rr.headers.get('content-type') || 'image/jpeg';
          refB64 = b64(rb);
        }
      } catch (e) {}

      const base =
        `You are editing a real photograph for a luxury destination photography studio. ` +
        `IMAGE 1 is the client. ` +
        (refB64 ? `IMAGE 2 is a reference photo from one of our real sessions. ` +
                  `Use ONLY the clothing worn by the main subject in image 2 (same garment type, same color, same fabric, same length), plus the general light and setting of that location. ` +
                  `IGNORE every other person, object, prop, bouquet and furniture in image 2. Never add a second person to the result: the output must show ONLY the person from image 1. `
                : `Dress the client in ${PRENDAS[prenda]} in soft cream linen, on a Caribbean beach at golden hour. `) +
        `Redress the person from image 1 in that outfit. ` +
        `CRITICAL: keep their face, identity, hairstyle, skin tone, body shape, weight and pose EXACTLY as they are. ` +
        `Do not slim, reshape, retouch or beautify the body or the face. Do not change their age or ethnicity. ` +
        `This is a professional fashion editorial retouch for a photography studio, with the client's consent. ` +
        `Photorealistic editorial photography, natural light, shallow depth of field, high detail. ` +
        `Return only the edited image.`;

      // Se APARTA el intento antes de gastar: así dos personas al mismo tiempo no rebasan el tope
      const idIntento = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO outfit_gen_log (id, ip, created_at) VALUES (?, ?, ?)`)
        .bind(idIntento, ip, new Date().toISOString()).run();

      const fotoB64 = b64(buf);
      const trabajos = [];
      for (let i = 0; i < VARIANTES; i++) {
        const partes = [{ inline_data: { mime_type: mime, data: fotoB64 } }];
        if (refB64) partes.push({ inline_data: { mime_type: refMime, data: refB64 } });
        partes.push({ text: base + ' ' + ENCUADRES[i % ENCUADRES.length] });
        trabajos.push(gemini(env, partes));
      }
      const salidas = await Promise.all(trabajos);
      const buenas = salidas.filter(s => s.ok);

      if (!buenas.length) {
        // no se generó nada: se devuelve el intento apartado para no cobrarle a la clienta
        try { await env.DB.prepare(`DELETE FROM outfit_gen_log WHERE id = ?`).bind(idIntento).run(); } catch (e) {}
        const detalle = (salidas[0] && salidas[0].error) || '';
        return json({
          ok: false,
          error: msg('La IA está saturada en este momento. Intenta de nuevo en un minuto.',
                     'The AI is busy right now. Try again in a minute.'),
          detail: detalle
        }, 502);
      }

      return json({ ok: true, images: buenas.map(b => `data:${b.mime};base64,${b.data}`) });
    }

    return json({ ok: false, error: 'Ruta no válida.' }, 404);
  } catch (err) {
    return json({ ok: false, error: 'Error interno. Intenta de nuevo.' }, 500);
  }
}
