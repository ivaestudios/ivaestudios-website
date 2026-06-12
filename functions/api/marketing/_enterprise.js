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
  // Mejorar/traducir sin caption no tiene sentido: aviso claro en vez de
  // mandarle a la IA una instrucción imposible.
  if ((action === 'improve' || action === 'translate') && !String(post.caption || '').trim()) {
    return json({ error: 'Este post aún no tiene caption. Usa ✨ Generar primero.' }, 400);
  }
  const client = await env.DB.prepare('SELECT id, name FROM mkt_clients WHERE id = ?').bind(post.client_id).first();

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ text: aiFallback(action, post), source: 'plantilla', action });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      // Sin timeout, una request colgada deja el botón girando indefinidamente.
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(45000) : undefined,
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
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      return json({ error: 'La IA tardó demasiado en responder. Intenta de nuevo.' }, 504);
    }
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
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.1: las líneas no deben pasar de 75 octetos; se continúan con
// CRLF + espacio. Parsers estrictos (Outlook) rechazan líneas largas.
function icsFold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const chLen = new TextEncoder().encode(ch).length;
    if (curLen + chLen > (out.length ? 74 : 75)) { out.push(cur); cur = ''; curLen = 0; }
    cur += ch;
    curLen += chLen;
  }
  if (cur) out.push(cur);
  return out.join('\r\n ');
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

  return new Response(lines.map(icsFold).join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="contenido-${(client.name || 'marca').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ── Plantillas de mes (snapshot reutilizable, estilo Monday templates) ──────
// POST /templates {name, client_id, from} — guardar un mes como plantilla.
// GET /templates — listar. DELETE /templates/:id — borrar.
// POST /templates/:id/apply {client_id, to} — sembrar un mes desde plantilla.

const TPL_FIELDS = ['title', 'content_type', 'platform', 'caption', 'hook', 'body', 'cta', 'hashtags', 'notes_team', 'grabacion', 'client_visible'];

export async function handleTemplates(request, env, session, parts, method) {
  try {
    // GET /templates
    if (parts.length === 1 && method === 'GET') {
      const res = await env.DB.prepare('SELECT id, name, data, created_at FROM mkt_month_templates ORDER BY created_at DESC').all();
      const rows = (res.results || []).map((t) => {
        let n = 0;
        try { n = (JSON.parse(t.data) || []).length; } catch { /* noop */ }
        return { id: t.id, name: t.name, count: n, created_at: t.created_at };
      });
      return json({ templates: rows });
    }

    // POST /templates — snapshot de un mes
    if (parts.length === 1 && method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
      const name = String((b && b.name) || '').trim().slice(0, 80);
      const clientId = b && b.client_id;
      const from = String((b && b.from) || '');
      if (!name || !clientId || !/^\d{4}-\d{2}$/.test(from)) {
        return json({ error: 'name, client_id y from (AAAA-MM) son requeridos' }, 400);
      }
      const res = await env.DB.prepare(
        'SELECT * FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ? ORDER BY publish_date, position'
      ).bind(clientId, `${from}-%`).all();
      const posts = res.results || [];
      if (!posts.length) return json({ error: 'Ese mes no tiene contenidos' }, 400);
      const data = posts.map((p) => {
        const row = { day: Number(String(p.publish_date).slice(8, 10)) || 1 };
        for (const f of TPL_FIELDS) row[f] = p[f];
        return row;
      });
      const r = await env.DB.prepare(
        'INSERT INTO mkt_month_templates (name, created_by, data) VALUES (?, ?, ?) RETURNING id'
      ).bind(name, session.user_id, JSON.stringify(data)).first();
      return json({ ok: true, id: r && r.id, name, count: data.length }, 201);
    }

    // DELETE /templates/:id
    if (parts.length === 2 && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM mkt_month_templates WHERE id = ?').bind(parts[1]).run();
      return json({ ok: true });
    }

    // POST /templates/:id/apply
    if (parts.length === 3 && parts[2] === 'apply' && method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
      const clientId = b && b.client_id;
      const to = String((b && b.to) || '');
      if (!clientId || !/^\d{4}-\d{2}$/.test(to)) return json({ error: 'client_id y to (AAAA-MM) son requeridos' }, 400);
      const client = await env.DB.prepare('SELECT id FROM mkt_clients WHERE id = ?').bind(clientId).first();
      if (!client) return json({ error: 'Cliente no encontrado' }, 404);
      const tpl = await env.DB.prepare('SELECT * FROM mkt_month_templates WHERE id = ?').bind(parts[0] === 'templates' ? parts[1] : parts[0]).first();
      if (!tpl) return json({ error: 'Plantilla no encontrada' }, 404);
      let items;
      try { items = JSON.parse(tpl.data) || []; } catch { return json({ error: 'Plantilla corrupta' }, 500); }
      if (!items.length) return json({ error: 'La plantilla está vacía' }, 400);

      const [ty, tm] = to.split('-').map(Number);
      const lastDay = new Date(ty, tm, 0).getDate();
      let created = 0;
      for (const it of items) {
        const day = Math.min(Math.max(Number(it.day) || 1, 1), lastDay);
        const date = `${to}-${String(day).padStart(2, '0')}`;
        await env.DB.prepare(
          `INSERT INTO mkt_posts (id, client_id, title, content_type, grabacion, publish_date,
             platform, status, caption, hook, body, cta, hashtags, notes_team,
             client_visible, approval_state, position, created_by)
           VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'idea', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        ).bind(
          clientId, it.title || 'Contenido', it.content_type || 'reel', it.grabacion ?? null, date,
          it.platform || 'instagram', it.caption ?? null, it.hook ?? null, it.body ?? null,
          it.cta ?? null, it.hashtags ?? null, it.notes_team ?? null,
          it.client_visible ?? 1, created, session.user_id
        ).run();
        created += 1;
      }
      return json({ ok: true, created, to });
    }
  } catch (e) {
    if (/no such table/i.test((e && e.message) || '')) return json({ error: 'Migracion 007 pendiente' }, 409);
    throw e;
  }
  return json({ error: 'Method not allowed' }, 405);
}

// ── Aviso por correo al cliente (Resend) ────────────────────────────────────
// Se dispara cuando un contenido pasa a Revisión visible para el cliente.
// Sin RESEND_API_KEY no hace nada (la app sigue normal). Destinatarios:
// contact_email de la marca + usuarios cliente con correo real (@).
// Incluye el link mágico si existe, para aprobar sin contraseña.

export async function sendClientReviewEmail(env, post) {
  if (!env.RESEND_API_KEY) return { skipped: 'sin RESEND_API_KEY' };
  try {
    const client = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(post.client_id).first();
    if (!client) return { skipped: 'sin cliente' };

    const users = await env.DB.prepare(
      "SELECT email FROM mkt_users WHERE role = 'client' AND client_id = ? AND active = 1"
    ).bind(post.client_id).all();
    const to = [...new Set([
      ...(client.contact_email && client.contact_email.includes('@') ? [client.contact_email.trim()] : []),
      ...((users.results || []).map((u) => u.email).filter((e) => e && e.includes('@'))),
    ])];
    if (!to.length) return { skipped: 'sin correos de cliente' };

    const base = env.MKT_PUBLIC_ORIGIN || 'https://ivaestudios.com';
    const link = client.share_token
      ? `${base}/api/marketing/share/${client.share_token}`
      : `${base}/marketing/`;
    const fecha = post.publish_date ? ` (programado para el ${post.publish_date})` : '';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(15000) : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'IVAE Marketing <info@ivaestudios.com>',
        to,
        subject: `Tienes contenido por aprobar — ${client.name}`,
        text: [
          `Hola,`,
          ``,
          `"${post.title || 'Nuevo contenido'}"${fecha} está listo para tu revisión.`,
          ``,
          `Entra aquí para verlo y aprobarlo:`,
          link,
          ``,
          `— IVAE Marketing`,
        ].join('\n'),
      }),
    });
    if (!r.ok) return { skipped: `resend ${r.status}` };
    return { sent: to.length };
  } catch (e) {
    return { skipped: (e && e.message) || 'error' };
  }
}

// ── Reporte mensual del cliente (imprimible / compartible) ──────────────────
// GET /report?client_id&month=YYYY-MM — HTML con el branding de la marca.

const REP_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const REP_STATUS = {
  idea: 'Idea', guion: 'Guion', grabacion: 'Grabación', edicion: 'Edición',
  revision: 'Revisión', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado',
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function handleMonthlyReport(request, env, session, url) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  const month = String(url.searchParams.get('month') || '');
  if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('client_id y month (AAAA-MM) requeridos', { status: 400 });
  }
  const client = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return new Response('Cliente no encontrado', { status: 404 });

  const res = await env.DB.prepare(
    'SELECT * FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ? ORDER BY publish_date, position'
  ).bind(clientId, `${month}-%`).all();
  const posts = res.results || [];

  const [y, m] = month.split('-').map(Number);
  const label = `${REP_MONTHS[(m || 1) - 1]} ${y}`;
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(client.brand_color || '') ? client.brand_color : '#7c3aed';
  const byType = {};
  let publicados = 0;
  for (const p of posts) {
    const t = p.content_type || 'otro';
    byType[t] = (byType[t] || 0) + 1;
    if (p.status === 'publicado') publicados += 1;
  }
  const plural = { reel: 'reels', foto: 'fotos', carrusel: 'carruseles', historia: 'historias' };
  const typeChips = Object.entries(byType)
    .map(([t, n]) => `<span class="chip">${n} ${esc(n === 1 ? t : (plural[t] || t))}</span>`).join('');

  const rows = posts.map((p) => `
    <article class="post">
      <div class="post__head">
        <span class="post__date">${esc(String(p.publish_date).slice(8, 10))} ${esc(REP_MONTHS[(m || 1) - 1]).slice(0, 3)}</span>
        <span class="post__type">${esc(p.content_type || 'post')}</span>
        <span class="post__status" data-s="${esc(p.status)}">${esc(REP_STATUS[p.status] || p.status || '')}</span>
      </div>
      <h3>${esc(p.title || 'Sin título')}</h3>
      ${p.caption ? `<p class="post__cap">${esc(String(p.caption).slice(0, 400))}${String(p.caption).length > 400 ? '…' : ''}</p>` : ''}
    </article>`).join('\n');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reporte ${esc(label)} · ${esc(client.name)}</title>
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; margin: 0; }
  body { font: 15px/1.55 -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a24; background: #f6f6f9; padding: 0 0 48px; }
  .band { height: 8px; background: var(--accent); }
  .wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px; }
  header.rep { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
  header.rep img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
  header.rep .logo-fallback { width: 56px; height: 56px; border-radius: 12px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 24px; font-weight: 800; }
  h1 { font-size: 22px; } .sub { color: #666; margin-bottom: 20px; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; }
  .chip { background: #fff; border: 1px solid #e3e3ec; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; }
  .chip--hero { background: var(--accent); color: #fff; border-color: transparent; }
  .post { background: #fff; border: 1px solid #e7e7f0; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; break-inside: avoid; }
  .post__head { display: flex; gap: 10px; align-items: center; font-size: 12.5px; margin-bottom: 6px; }
  .post__date { font-weight: 700; color: var(--accent); text-transform: uppercase; }
  .post__type { text-transform: uppercase; letter-spacing: .04em; color: #888; font-weight: 700; }
  .post__status { margin-left: auto; font-weight: 600; color: #555; background: #f0f0f6; border-radius: 999px; padding: 2px 10px; }
  .post__status[data-s="publicado"], .post__status[data-s="aprobado"] { background: #e5f7ec; color: #177245; }
  h3 { font-size: 16px; margin-bottom: 4px; }
  .post__cap { color: #555; font-size: 13.5px; white-space: pre-wrap; }
  footer { margin-top: 30px; text-align: center; color: #999; font-size: 12.5px; }
  .printbtn { position: fixed; right: 18px; bottom: 18px; background: var(--accent); color: #fff; border: 0; border-radius: 999px; padding: 12px 20px; font: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
  @media print { .printbtn { display: none; } body { background: #fff; } .post { border-color: #ddd; } }
</style></head><body>
<div class="band"></div>
<div class="wrap">
  <header class="rep">
    ${client.logo_url ? `<img src="${esc(client.logo_url)}" alt="">` : `<div class="logo-fallback">${esc((client.name || '?').charAt(0).toUpperCase())}</div>`}
    <div>
      <h1>${esc(client.name)}</h1>
      <div class="sub">Reporte de contenido · ${esc(label.charAt(0).toUpperCase() + label.slice(1))}</div>
    </div>
  </header>
  <div class="stats">
    <span class="chip chip--hero">${posts.length} contenidos</span>
    <span class="chip">${publicados} publicados</span>
    ${typeChips}
  </div>
  ${rows || '<p style="color:#888">Este mes no tiene contenidos.</p>'}
  <footer>Generado por IVAE Marketing · ivaestudios.com</footer>
</div>
<button class="printbtn" onclick="print()">Imprimir / PDF</button>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
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
