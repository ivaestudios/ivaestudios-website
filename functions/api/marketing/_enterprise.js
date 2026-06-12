// ============================================================================
// IVAE Marketing — módulo enterprise (rama enterprise-overhaul).
// Funciones nuevas inspiradas en Monday.com:
//   - handleAiAssist:       IA para captions (generar/mejorar/traducir/hashtags/ideas)
//   - handleCalendarIcs:    exportar el calendario como .ics (Google/Apple Calendar)
//   - handleDuplicateMonth: duplicar todo un mes a otro (plantillas de mes)
// Módulo separado de [[path]].js para mantener el router legible; el guion
// bajo evita que Pages lo trate como ruta.
// ============================================================================

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ── IA: captions con Claude ──────────────────────────────────────────────────
// POST /posts/:id/ai  { action: 'caption'|'improve'|'translate'|'hashtags'|'ideas', text? }
// Con ANTHROPIC_API_KEY usa el Messages API (modelo claude-opus-4-8 por defecto,
// configurable con ANTHROPIC_MODEL). Sin clave, cae a una plantilla local para
// que el flujo funcione igual (el botón nunca "muere").

const AI_ACTIONS = ['caption', 'improve', 'translate', 'hashtags', 'ideas'];

function aiSystemPrompt(client) {
  const brand = (client && client.name) || 'la marca';
  return [
    `Eres el copywriter senior de IVAE Marketing, una agencia de redes sociales en Cancún.`,
    `Escribes contenido para la marca "${brand}". Tono: cercano, profesional y vendedor, sin sonar a anuncio genérico.`,
    `Reglas: usa emojis con moderación (2-5), párrafos cortos, y cierra con un llamado a la acción claro.`,
    `Si el post es en español usa español de México; si te piden inglés, usa inglés natural de marketing.`,
    `Responde SOLO con el texto pedido, sin preámbulos ni explicaciones.`,
  ].join('\n');
}

function aiUserPrompt(action, post, extraText) {
  const ctx = [
    `Datos del post:`,
    `- Tarea/título: ${post.title || 'Sin título'}`,
    `- Tipo de contenido: ${post.content_type || 'reel'}`,
    `- Plataforma: ${post.platform || 'Instagram'}`,
    post.publish_date ? `- Fecha de publicación: ${post.publish_date}` : '',
    post.caption ? `- Caption actual:\n"""${post.caption}"""` : '',
    extraText ? `- Indicaciones extra: ${extraText}` : '',
  ].filter(Boolean).join('\n');

  switch (action) {
    case 'caption':
      return `${ctx}\n\nEscribe un caption completo para este post (gancho inicial fuerte, cuerpo con valor, CTA y 8-12 hashtags al final).`;
    case 'improve':
      return `${ctx}\n\nMejora el caption actual: más gancho, más claro y más vendedor. Conserva la información, datos de contacto y hashtags si existen.`;
    case 'translate':
      return `${ctx}\n\nTraduce el caption actual al otro idioma (si está en español → inglés; si está en inglés → español de México). Mantén formato, emojis y hashtags.`;
    case 'hashtags':
      return `${ctx}\n\nGenera 12 hashtags óptimos para este post (mezcla de nicho, locales de Cancún y de alcance). Responde solo los hashtags separados por espacios.`;
    case 'ideas':
      return `${ctx}\n\nDame 5 ideas de contenido nuevas para esta marca (1 línea cada una, formato "Tipo — idea").`;
    default:
      return ctx;
  }
}

// Fallback local (sin API key): plantillas decentes para que el demo funcione.
function aiFallback(action, post) {
  const t = post.title || 'tu próximo contenido';
  switch (action) {
    case 'hashtags':
      return '#marketing #cancun #rivieramaya #contenidodigital #socialmedia #reels #negocioslocales #emprendedores #branding #marketingdigital #mexico #agencia';
    case 'ideas':
      return [
        `Reel — Detrás de cámaras de "${t}"`,
        'Carrusel — 5 errores comunes que tu cliente ideal comete',
        'Reel — Testimonio de un cliente real con resultado medible',
        'Post — Antes y después de trabajar con la marca',
        'Reel — Tendencia del momento adaptada a tu nicho',
      ].join('\n');
    case 'translate':
      return (post.caption || '') + '\n\n(⚠️ Traducción automática no disponible sin API key — configura ANTHROPIC_API_KEY)';
    case 'improve':
      return (post.caption || '') + '\n\n✨ ¿Listo para dar el siguiente paso? Escríbenos y te decimos cómo.';
    case 'caption':
    default:
      return [
        `✨ ${t}`,
        '',
        'Hay algo que tu competencia todavía no entiende: la constancia gana. Y hoy te mostramos por qué.',
        '',
        '📲 Escríbenos para empezar.',
        '',
        '#marketing #cancun #socialmedia #reels #negocioslocales',
      ].join('\n');
  }
}

export async function handleAiAssist(request, env, session, postId) {
  // Solo staff: la IA consume créditos de la agencia, no del cliente.
  if (session.role === 'client') return json({ error: 'Forbidden' }, 403);

  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const action = String((bodyObj && bodyObj.action) || 'caption');
  if (!AI_ACTIONS.includes(action)) return json({ error: 'Acción de IA no válida' }, 400);
  const extraText = bodyObj && bodyObj.text ? String(bodyObj.text).slice(0, 2000) : '';

  const post = await env.DB.prepare('SELECT * FROM mkt_posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  const client = await env.DB.prepare('SELECT id, name FROM mkt_clients WHERE id = ?').bind(post.client_id).first();

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ text: aiFallback(action, post), source: 'plantilla', action });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-opus-4-8',
        max_tokens: 2048,
        system: aiSystemPrompt(client),
        messages: [{ role: 'user', content: aiUserPrompt(action, post, extraText) }],
      }),
    });

    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).error?.message || ''; } catch { /* noop */ }
      // Mapeo amable de errores del API.
      if (r.status === 401) return json({ error: 'API key de IA inválida. Revisa ANTHROPIC_API_KEY.' }, 502);
      if (r.status === 429) return json({ error: 'La IA está saturada (límite de uso). Intenta en unos segundos.' }, 502);
      if (r.status >= 500) return json({ error: 'El servicio de IA tuvo un problema temporal. Intenta de nuevo.' }, 502);
      return json({ error: `Error de IA: ${detail || r.status}` }, 502);
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) return json({ error: 'La IA no devolvió texto. Intenta de nuevo.' }, 502);
    return json({ text, source: 'claude', action, model: data.model });
  } catch (e) {
    return json({ error: 'No se pudo contactar a la IA: ' + (e.message || 'error de red') }, 502);
  }
}

// ── Exportar calendario .ics ─────────────────────────────────────────────────
// GET /calendar.ics?client_id=...  (cliente: forzado a SU marca)

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export async function handleCalendarIcs(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id; // aislamiento por marca
  if (!clientId) return new Response('client_id requerido', { status: 400 });

  const client = await env.DB.prepare('SELECT id, name FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return new Response('Cliente no encontrado', { status: 404 });

  const res = await env.DB.prepare(
    "SELECT id, title, content_type, publish_date, caption, status FROM mkt_posts WHERE client_id = ? AND publish_date IS NOT NULL ORDER BY publish_date"
  ).bind(clientId).all();
  const posts = (res && res.results) || [];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IVAE Marketing//Calendario de contenido//ES',
    `X-WR-CALNAME:${icsEscape('Contenido · ' + client.name)}`,
    'CALSCALE:GREGORIAN',
  ];
  for (const p of posts) {
    const day = String(p.publish_date).replace(/-/g, '');
    if (!/^\d{8}$/.test(day)) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:mkt-${p.id}@ivaestudios.com`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${icsEscape(`[${p.content_type || 'post'}] ${p.title || 'Contenido'}`)}`,
      `DESCRIPTION:${icsEscape((p.caption || '').slice(0, 800))}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="contenido-${(client.name || 'marca').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ── Duplicar mes (plantillas de mes estilo Monday) ───────────────────────────
// POST /posts/duplicate-month  { client_id, from: 'YYYY-MM', to: 'YYYY-MM' }
// Copia las filas del mes origen al destino conservando el día (recortado al
// largo del mes destino). El estado vuelve a 'idea' y la aprobación a pending.

export async function handleDuplicateMonth(request, env, session) {
  let bodyObj;
  try { bodyObj = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { client_id: clientId, from, to } = bodyObj || {};
  if (!clientId || !/^\d{4}-\d{2}$/.test(String(from || '')) || !/^\d{4}-\d{2}$/.test(String(to || ''))) {
    return json({ error: 'client_id, from (AAAA-MM) y to (AAAA-MM) son requeridos' }, 400);
  }
  if (from === to) return json({ error: 'El mes destino debe ser distinto al origen' }, 400);

  const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Cliente no encontrado' }, 404);

  const res = await env.DB.prepare(
    "SELECT * FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ? ORDER BY publish_date, position"
  ).bind(clientId, `${from}-%`).all();
  const posts = (res && res.results) || [];
  if (!posts.length) return json({ error: 'El mes origen no tiene contenidos' }, 400);

  const [ty, tm] = to.split('-').map(Number);
  const lastDay = new Date(ty, tm, 0).getDate(); // día final del mes destino

  let created = 0;
  for (const p of posts) {
    const day = Math.min(Number(String(p.publish_date).slice(8, 10)) || 1, lastDay);
    const newDate = `${to}-${String(day).padStart(2, '0')}`;
    await env.DB.prepare(
      `INSERT INTO mkt_posts (id, client_id, title, content_type, grabacion, publish_date, assignee,
         platform, status, caption, inspo_url, hook, body, cta, hashtags, notes_team, notes_people,
         client_visible, approval_state, position, priority, created_by)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, 'idea', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(
      p.client_id, p.title, p.content_type, p.grabacion, newDate, p.assignee,
      p.platform, p.caption, p.inspo_url, p.hook, p.body, p.cta, p.hashtags,
      p.notes_team, p.notes_people || '{}', p.client_visible, p.position,
      p.priority || 'media', session.user_id
    ).run();
    created += 1;
  }

  return json({ ok: true, created, from, to });
}
