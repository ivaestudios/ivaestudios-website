// ============================================================================
// IVAE Marketing — Conector MCP (Model Context Protocol) para Claude.ai.
//
// Permite que Claude chat (un proyecto por marca) LEA marcas/posts y CREE
// guiones/posts directamente en el calendario de contenido de cada marca.
//
// Transporte: "Streamable HTTP" sin estado (lo que pide claude.ai hoy).
//   - POST  -> mensajes JSON-RPC 2.0 (initialize / tools/list / tools/call...).
//             Siempre respondemos application/json (SSE es opcional, no lo usamos).
//   - GET    -> 405 (no ofrecemos stream servidor->cliente).
//   - DELETE -> 204 (cierre de sesión, no-op porque somos stateless).
//
// Autenticación = "capability URL": el secreto VA EN LA RUTA. El usuario pega
//   https://ivaestudios.com/api/mcp/<SECRETO>  en Claude (Configuración ->
//   Conectores). claude.ai no admite tokens pegados a mano ni en query-string,
//   así que el secreto-en-ruta es el camino simple soportado.
//
// SCOPING POR MARCA: cada clave (fila de mkt_mcp_keys) puede llevar client_id.
//   - client_id presente  -> la clave está FIJADA a esa marca: create/list
//     ignoran el argumento 'brand' y operan SOLO sobre esa marca (un proyecto
//     de Claude = una marca, imposible escribir en otra).
//   - client_id NULL      -> clave global (uso interno del equipo): puede operar
//     sobre cualquier marca vía el argumento 'brand'.
//
// Comparte la base ivae-gallery-db (tablas mkt_*) con el panel de marketing.
// NO toca nada existente: solo lee mkt_clients/mkt_posts e inserta en mkt_posts.
// ============================================================================

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

// Enums espejo del backend de marketing (functions/api/marketing/[[path]].js).
const CONTENT_TYPES = ['reel', 'tiktok', 'informativo', 'carrusel', 'experiencia', 'pauta', 'tratamientos', 'historia', 'foto'];
const STATUSES = ['idea', 'guion', 'grabacion', 'edicion', 'revision', 'aprobado', 'programado', 'publicado'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn'];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;

// Límites de cordura (anti-abuso / anti-filas-gigantes).
const MAX_BODY_BYTES = 512 * 1024;  // 512 KB por request
const MAX_BATCH = 20;               // mensajes JSON-RPC por lote
const MAX_FIELD = 8000;             // chars por campo de texto del guion
const MIN_TOKEN_LEN = 32;

// ── Definición de las herramientas que ve Claude ─────────────────────────────
const TOOLS = [
  {
    name: 'list_brands',
    description: 'Lista la(s) marca(s) disponibles. Si este conector está fijado a una marca, devuelve solo esa. Úsalo si no estás seguro del nombre exacto.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_posts',
    description: 'Lee los posts/guiones que YA existen (opcionalmente filtrados por mes), para no duplicar y ubicar el nuevo contenido. Devuelve fecha, tipo, estado, título y un fragmento del hook.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brand: { type: 'string', description: 'Marca: nombre, @handle o slug. NO hace falta si el conector ya está fijado a una marca.' },
        month: { type: 'string', description: 'Opcional. Mes AAAA-MM para filtrar (ej. 2026-07).' },
      },
    },
  },
  {
    name: 'create_post',
    description: 'Crea un guion/post en el calendario. El guion se divide en: hook, body (cuerpo), cta, caption (el copy final para publicar) y hashtags. La fecha (publish_date o month) ubica el post en el mes correcto. Si el conector está fijado a una marca, NO hace falta indicar brand.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brand: { type: 'string', description: 'Marca destino: nombre, @handle o slug. NO hace falta si el conector ya está fijado a una marca.' },
        title: { type: 'string', description: 'Título corto del contenido.' },
        content_type: { type: 'string', enum: CONTENT_TYPES, description: 'Tipo de contenido (default: reel).' },
        status: { type: 'string', enum: STATUSES, description: 'Estado en el pipeline (default: guion).' },
        publish_date: { type: 'string', description: 'Fecha de publicación AAAA-MM-DD. Ubica el post en el calendario.' },
        month: { type: 'string', description: 'Alternativa a publish_date: solo el mes AAAA-MM (se coloca el día 1).' },
        hook: { type: 'string', description: 'HOOK del guion (el gancho inicial).' },
        body: { type: 'string', description: 'CUERPO del guion.' },
        cta: { type: 'string', description: 'CTA / llamado a la acción.' },
        caption: { type: 'string', description: 'COPY / caption final para publicar.' },
        hashtags: { type: 'string', description: 'Hashtags.' },
        platform: { type: 'string', enum: PLATFORMS, description: 'Plataforma (default: Instagram).' },
      },
    },
  },
];

// ── Helpers JSON-RPC / MCP ───────────────────────────────────────────────────
function rpcOk(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcErr(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }
function toolText(text) { return { content: [{ type: 'text', text }], isError: false }; }
function toolErr(text) { return { content: [{ type: 'text', text }], isError: true }; }
function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function clip(v) { const s = String(v); return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) : s; }

// ── Autenticación: devuelve la fila de la clave {token, client_id} o null ────
async function getKey(env, token) {
  const t = String(token || '');
  if (t.length < MIN_TOKEN_LEN) return null;
  try {
    return await env.DB.prepare(
      'SELECT token, client_id FROM mkt_mcp_keys WHERE token = ? AND COALESCE(revoked, 0) = 0 LIMIT 1'
    ).bind(t).first();
  } catch {
    return null; // si la tabla no existe -> rechaza (fail closed)
  }
}

// ── Resolución de marca ──────────────────────────────────────────────────────
async function brandById(env, id) {
  return env.DB.prepare('SELECT id, name, slug, instagram_handle FROM mkt_clients WHERE id = ? AND archived = 0 LIMIT 1').bind(id).first();
}
async function resolveBrandArg(env, brand) {
  const b = String(brand || '').trim();
  if (!b) return null;
  const noAt = b.replace(/^@/, '');
  let row = await env.DB.prepare(
    `SELECT id, name, slug, instagram_handle FROM mkt_clients
       WHERE archived = 0 AND (
         id = ?1 OR slug = ?1 COLLATE NOCASE OR name = ?1 COLLATE NOCASE
         OR instagram_handle = ?1 COLLATE NOCASE OR instagram_handle = ?2 COLLATE NOCASE
         OR instagram_handle = ?3 COLLATE NOCASE
       ) LIMIT 1`
  ).bind(b, noAt, '@' + noAt).first();
  if (row) return row;
  const like = '%' + noAt + '%';
  const res = await env.DB.prepare(
    `SELECT id, name, slug, instagram_handle FROM mkt_clients
       WHERE archived = 0 AND (name LIKE ?1 COLLATE NOCASE OR slug LIKE ?1 COLLATE NOCASE
         OR instagram_handle LIKE ?1 COLLATE NOCASE) LIMIT 3`
  ).bind(like).all();
  const rows = (res && res.results) || [];
  return rows.length === 1 ? rows[0] : null;
}
// Si la clave está fijada (scope.clientId) usa ESA marca e ignora el argumento;
// si es global, resuelve por el argumento brand.
async function brandFor(env, scope, brandArg) {
  if (scope && scope.clientId) return brandById(env, scope.clientId);
  return resolveBrandArg(env, brandArg);
}

// ── Handlers de cada herramienta ─────────────────────────────────────────────
async function listBrands(env, scope) {
  if (scope && scope.clientId) {
    const b = await brandById(env, scope.clientId);
    return b
      ? toolText(`Este conector está fijado a la marca: ${b.name}${b.instagram_handle ? ` (${b.instagram_handle})` : ''} — slug: ${b.slug}. Todo lo que crees irá a esta marca.`)
      : toolErr('La marca de este conector ya no existe.');
  }
  const res = await env.DB.prepare(
    'SELECT name, slug, instagram_handle FROM mkt_clients WHERE archived = 0 ORDER BY name'
  ).all();
  const rows = (res && res.results) || [];
  if (!rows.length) return toolText('No hay marcas registradas.');
  const lines = rows.map((r) => `• ${r.name}${r.instagram_handle ? ` (${r.instagram_handle})` : ''} — slug: ${r.slug}`);
  return toolText(`Marcas (${rows.length}):\n${lines.join('\n')}`);
}

async function listPosts(env, scope, args) {
  const brand = await brandFor(env, scope, args.brand);
  if (!brand) {
    return toolErr(scope && scope.clientId
      ? 'La marca de este conector ya no existe.'
      : `No encontré la marca "${args.brand || ''}". Llama list_brands para ver los nombres exactos.`);
  }
  let sql = 'SELECT title, content_type, status, publish_date, hook FROM mkt_posts WHERE client_id = ?1';
  const binds = [brand.id];
  if (args.month) {
    if (!YM_RE.test(args.month)) return toolErr('El mes debe ser AAAA-MM (ej. 2026-07).');
    sql += ' AND publish_date LIKE ?2';
    binds.push(args.month + '%');
  }
  sql += ' ORDER BY (publish_date IS NULL), publish_date ASC LIMIT 200';
  const res = await env.DB.prepare(sql).bind(...binds).all();
  const rows = (res && res.results) || [];
  if (!rows.length) return toolText(`No hay posts en ${brand.name}${args.month ? ` para ${args.month}` : ''}.`);
  const lines = rows.map((r) =>
    `• ${r.publish_date || 'sin fecha'} — [${r.content_type}/${r.status}] ${r.title}${r.hook ? ` — hook: ${String(r.hook).slice(0, 70)}` : ''}`);
  return toolText(`${rows.length} post(s) en ${brand.name}${args.month ? ` (${args.month})` : ''}:\n${lines.join('\n')}`);
}

async function createPost(env, scope, args) {
  const brand = await brandFor(env, scope, args.brand);
  if (!brand) {
    return toolErr(scope && scope.clientId
      ? 'La marca de este conector ya no existe.'
      : `No encontré la marca "${args.brand || ''}". Llama list_brands para ver los nombres exactos.`);
  }

  const content_type = String(args.content_type || 'reel').toLowerCase();
  if (!CONTENT_TYPES.includes(content_type)) return toolErr(`content_type inválido. Opciones: ${CONTENT_TYPES.join(', ')}.`);
  const status = String(args.status || 'guion').toLowerCase();
  if (!STATUSES.includes(status)) return toolErr(`status inválido. Opciones: ${STATUSES.join(', ')}.`);
  let platform = args.platform ? String(args.platform) : 'Instagram';
  if (!PLATFORMS.includes(platform)) platform = 'Instagram';

  let publish_date = null;
  if (args.publish_date && YMD_RE.test(args.publish_date)) publish_date = args.publish_date;
  else if (args.month && YM_RE.test(args.month)) publish_date = args.month + '-01';
  else if (args.publish_date && YM_RE.test(args.publish_date)) publish_date = args.publish_date + '-01';
  else if (args.publish_date || args.month) return toolErr('La fecha debe ser AAAA-MM-DD, o el mes AAAA-MM.');

  const title = (args.title && String(args.title).trim().slice(0, 200)) || 'Nuevo contenido';
  const id = crypto.randomUUID().replace(/-/g, '');

  const cols = ['id', 'client_id', 'title', 'content_type', 'status', 'platform'];
  const vals = [id, brand.id, title, content_type, status, platform];
  const optional = {
    publish_date,
    caption: args.caption, hook: args.hook, body: args.body, cta: args.cta, hashtags: args.hashtags,
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v != null && String(v) !== '') { cols.push(k); vals.push(k === 'publish_date' ? String(v) : clip(v)); }
  }
  const placeholders = cols.map(() => '?').join(', ');
  await env.DB.prepare(`INSERT INTO mkt_posts (${cols.join(', ')}) VALUES (${placeholders})`).bind(...vals).run();

  try {
    await env.DB.prepare(
      'INSERT INTO mkt_activity (client_id, post_id, actor_name, action, detail) VALUES (?, ?, ?, ?, ?)'
    ).bind(brand.id, id, 'Claude (IA)', 'post.create', title.slice(0, 140)).run();
  } catch { /* noop */ }

  const mes = publish_date ? publish_date.slice(0, 7) : 'sin fecha (backlog)';
  return toolText(
    `Guion creado en ${brand.name} ✓\n` +
    `• Título: ${title}\n• Tipo: ${content_type}\n• Estado: ${status}\n` +
    `• Fecha: ${publish_date || 'sin fecha'} (mes: ${mes})\n• ID: ${id}`
  );
}

// ── Dispatcher JSON-RPC. Devuelve objeto-respuesta, o null para notificaciones ─
async function rpc(msg, env, scope) {
  const id = msg ? msg.id : null;
  const method = msg ? msg.method : null;
  const params = (msg && msg.params) || {};
  const isNotif = id === undefined || id === null;
  if (typeof method !== 'string') return isNotif ? null : rpcErr(id, -32600, 'Invalid Request');

  switch (method) {
    case 'initialize': {
      const reqV = params.protocolVersion;
      const protocolVersion = SUPPORTED_VERSIONS.includes(reqV) ? reqV : PROTOCOL_VERSION;
      let extra = '';
      if (scope && scope.clientId) {
        try { const b = await brandById(env, scope.clientId); if (b) extra = ` Este conector está fijado a la marca "${b.name}": todo lo que crees con create_post irá a esa marca (no hace falta indicar brand).`; }
        catch { /* noop */ }
      }
      return rpcOk(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'IVAE Marketing', version: '1.1.0' },
        instructions: 'Conector de IVAE Marketing. Usa create_post para guardar un guion en el calendario; el guion se separa en hook, body (cuerpo), cta, caption (copy final) y hashtags. Usa list_posts para ver lo que ya existe (evita duplicar) y list_brands si no sabes el nombre exacto de la marca.' + extra,
      });
    }
    case 'ping':
      return rpcOk(id, {});
    case 'tools/list':
      return rpcOk(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params.name;
      const args = params.arguments || {};
      try {
        let r;
        if (name === 'list_brands') r = await listBrands(env, scope);
        else if (name === 'list_posts') r = await listPosts(env, scope, args);
        else if (name === 'create_post') r = await createPost(env, scope, args);
        else return rpcErr(id, -32602, `Herramienta desconocida: ${name}`);
        return rpcOk(id, r);
      } catch (e) {
        try { console.error('[mcp] tools/call error:', (e && e.message) || e); } catch { /* noop */ }
        return rpcOk(id, toolErr('Error interno al procesar la solicitud. Intenta de nuevo.'));
      }
    }
    default:
      return isNotif ? null : rpcErr(id, -32601, `Método no encontrado: ${method}`);
  }
}

// ── Entrada HTTP (Cloudflare Pages Function, catch-all /api/mcp/*) ────────────
export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Tope de tamaño del cuerpo (anti-abuso).
  const clen = Number(request.headers.get('content-length') || 0);
  if (clen && clen > MAX_BODY_BYTES) return jsonRes(rpcErr(null, -32600, 'Payload demasiado grande'), 413);

  const token = Array.isArray(params.path) ? params.path[0] : params.path;
  const key = await getKey(env, token);
  if (!key) return jsonRes(rpcErr(null, -32001, 'Unauthorized'), 401);
  const scope = { clientId: key.client_id || null };

  let payload;
  try { payload = await request.json(); }
  catch { return jsonRes(rpcErr(null, -32700, 'Parse error'), 400); }

  if (Array.isArray(payload)) {
    if (payload.length > MAX_BATCH) return jsonRes(rpcErr(null, -32600, 'Lote demasiado grande'), 400);
    const out = [];
    for (const m of payload) { const r = await rpc(m, env, scope); if (r) out.push(r); }
    return out.length ? jsonRes(out) : new Response(null, { status: 202 });
  }

  const r = await rpc(payload, env, scope);
  if (!r) return new Response(null, { status: 202 });
  return jsonRes(r);
}
