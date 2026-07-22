// ============================================================================
// IVAE Marketing — Conector MCP (Model Context Protocol) para Claude.ai.
//
// Permite que Claude chat (un proyecto por marca) GESTIONE el calendario de
// contenido de cada marca: LEER, CREAR y EDITAR posts/guiones (copy, captions,
// hook/cuerpo/CTA, hashtags, links de inspiración y video, fecha de publicación, tipo y estado).
//
// Transporte: "Streamable HTTP" sin estado (lo que pide claude.ai hoy).
//   - POST  -> mensajes JSON-RPC 2.0 (initialize / tools/list / tools/call...).
//             Siempre respondemos application/json (SSE es opcional, no lo usamos).
//   - GET    -> 405 (no ofrecemos stream servidor->cliente).
//   - DELETE -> 204 (cierre de sesión, no-op porque somos stateless).
//
// Autenticación = "capability URL": el secreto VA EN LA RUTA. El usuario pega
//   https://ivaestudios.com/api/mcp/<SECRETO>  en Claude (Configuración ->
//   Conectores). claude.ai no admite tokens pegados a mano ni en query-string.
//
// SCOPING POR MARCA: cada clave (fila de mkt_mcp_keys) puede llevar client_id.
//   - client_id presente -> la clave está FIJADA a esa marca: leer/crear/editar
//     SOLO sobre esa marca (un proyecto de Claude = una marca, imposible tocar otra).
//   - client_id NULL     -> clave global (equipo): opera cualquier marca.
//
// Comparte la base ivae-gallery-db (tablas mkt_*) con el panel de marketing.
// NO toca nada existente: lee mkt_clients/mkt_posts e inserta/actualiza mkt_posts.
// ============================================================================

import { resolveVideo } from '../marketing/_downloader.js';

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

// Enums espejo del backend de marketing (functions/api/marketing/[[path]].js).
const CONTENT_TYPES = ['reel', 'post', 'tiktok', 'informativo', 'carrusel', 'experiencia', 'pauta', 'tratamientos', 'historia', 'foto'];
const STATUSES = ['idea', 'guion', 'grabacion', 'edicion', 'revision', 'aprobado', 'programado', 'publicado'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn'];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;

// Límites de cordura (anti-abuso / anti-filas-gigantes).
const MAX_BODY_BYTES = 512 * 1024;  // 512 KB por request
const MAX_BATCH = 20;               // mensajes JSON-RPC por lote
const MAX_FIELD = 8000;             // chars por campo de texto del guion
const MIN_TOKEN_LEN = 32;

// Campos de texto editables (guion + copy) — se recortan a MAX_FIELD.
const TEXT_FIELDS = ['title', 'hook', 'body', 'cta', 'caption', 'hashtags', 'alt_text'];

// Normaliza un campo URL (inspo/video). Tolera links sin protocolo (les pone https://).
// { skip:true } = no enviado (no tocar) · { value:null } = vaciar · { value } = URL válida · { err:true } = inválida.
function normUrl(v) {
  if (v == null) return { skip: true };
  let raw = String(v).trim();
  if (raw === '') return { value: null };
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return { value: u.href };
  } catch { /* inválida */ }
  return { err: true };
}

// ── Definición de las herramientas que ve Claude ─────────────────────────────
const POST_FIELDS_SCHEMA = {
  title: { type: 'string', description: 'Título corto del contenido.' },
  content_type: { type: 'string', enum: CONTENT_TYPES, description: 'Tipo (reel, carrusel, foto, historia…).' },
  status: { type: 'string', enum: STATUSES, description: 'Estado del pipeline (idea, guion, revision…).' },
  publish_date: { type: 'string', description: 'Fecha de publicación AAAA-MM-DD (ubica el post en el mes del calendario). También acepta AAAA-MM (día 1).' },
  hook: { type: 'string', description: 'HOOK del guion (gancho inicial).' },
  body: { type: 'string', description: 'CUERPO del guion.' },
  cta: { type: 'string', description: 'CTA / llamado a la acción.' },
  caption: { type: 'string', description: 'COPY / caption final para publicar.' },
  hashtags: { type: 'string', description: 'Hashtags.' },
  alt_text: { type: 'string', description: 'Texto alternativo (SEO alt) de la imagen. En carruseles, un alt por slide como "Slide 1 — texto" separados por línea en blanco.' },
  inspo_url: { type: 'string', description: 'Link de INSPIRACIÓN/referencia (columna "Inspo"): URL del reel o tendencia en que se basa el contenido. Cadena vacía para quitarlo.' },
  video_url: { type: 'string', description: 'Link del VIDEO / asset final (columna "Video final"): URL del video. Cadena vacía para quitarlo.' },
  platform: { type: 'string', enum: PLATFORMS, description: 'Plataforma (default Instagram).' },
  grabacion: { type: 'integer', description: 'Prioridad de grabación 1-5 (1 = más urgente).' },
};

const TOOLS = [
  {
    name: 'list_brands',
    description: 'Lista la(s) marca(s) disponibles. Si este conector está fijado a una marca, devuelve solo esa.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_posts',
    description: 'Lee los posts/guiones del calendario (opcionalmente por mes). Devuelve el ID de cada post (necesario para editarlo con update_post), su fecha, tipo, estado, título, y si ya tiene caption/copy o le falta.',
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
    name: 'get_post',
    description: 'Lee UN post COMPLETO por su ID (el ID lo da list_posts): guion completo (hook, body/cuerpo, cta), caption (copy final), hashtags, fecha, tipo, estado y plataforma. Úsalo SIEMPRE antes de update_post cuando necesites revisar, mejorar, traducir o corregir lo que ya está escrito.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['post_id'],
      properties: { post_id: { type: 'string', description: 'ID del post (lo da list_posts).' } },
    },
  },
  {
    name: 'create_post',
    description: 'Crea un post/guion NUEVO en el calendario. El guion se separa en hook, body (cuerpo), cta, caption (copy final) y hashtags. También puedes poner el link de inspiración/referencia (inspo_url) y el link del video/asset final (video_url). La fecha (publish_date o month) lo ubica en el mes. Si el conector está fijado a una marca, NO hace falta indicar brand.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { brand: { type: 'string', description: 'Marca destino. NO hace falta si el conector ya está fijado a una marca.' }, ...POST_FIELDS_SCHEMA, month: { type: 'string', description: 'Alternativa a publish_date: solo el mes AAAA-MM (día 1).' } },
    },
  },
  {
    name: 'update_post',
    description: 'EDITA un post que YA existe (por su ID, que obtienes con list_posts): rellenar/cambiar el caption (copy), el guion (hook/body/cta), hashtags, el link de inspiración (inspo_url), el link del video/asset (video_url), la fecha de publicación, el tipo o el estado. Solo cambia los campos que envíes; los demás quedan igual. Ideal para "rellenar los captions que faltan", "ponle el link de inspiración a estos posts" o "cambiar la fecha de este post".',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['post_id'],
      properties: { post_id: { type: 'string', description: 'ID del post a editar (lo da list_posts).' }, ...POST_FIELDS_SCHEMA },
    },
  },
  {
    name: 'download_media',
    description: 'Descarga y LEE un video de Instagram, TikTok o Pinterest usando el descargador de la app (sin marca de agua). Dale la URL del reel/video — o el link de INSPIRACIÓN (inspo_url) de un post (lo obtienes con list_posts o get_post). Devuelve: el caption/título del reel, su duración, un LINK de descarga directo, y la PORTADA del video como imagen para que puedas LEER de qué trata. Úsalo para analizar un reel de referencia y escribir el guion (hook/body/cta) del post basado en él. Nota: para el contenido hablado completo revisa el caption; la imagen es la portada.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'URL del reel/video de Instagram, TikTok o Pinterest (o el inspo_url de un post).' },
      },
    },
  },
];

// ── Helpers JSON-RPC / MCP ───────────────────────────────────────────────────
function rpcOk(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcErr(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }
function toolText(text) { return { content: [{ type: 'text', text }], isError: false }; }
function toolErr(text) { return { content: [{ type: 'text', text }], isError: true }; }
// Texto + una imagen (p.ej. la PORTADA de un video) para que Claude la LEA.
function toolMedia(text, imageB64, mime) {
  const content = [{ type: 'text', text }];
  if (imageB64) content.push({ type: 'image', data: imageB64, mimeType: mime || 'image/jpeg' });
  return { content, isError: false };
}
// base64 de un ArrayBuffer, por trozos (evita reventar el stack con buffers grandes).
function abToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function clip(v) { const s = String(v); return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) : s; }

// Normaliza una fecha de entrada -> 'YYYY-MM-DD' | '' (limpiar) | undefined (inválida/no dada).
function normDate(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (YMD_RE.test(s)) return s;
  if (YM_RE.test(s)) return s + '-01';
  return undefined;
}

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
// Si la clave está fijada (scope.clientId) usa ESA marca. Si además pidieron
// explícitamente OTRA marca, no escribas en silencio donde no era: devuelve el
// conflicto para que el handler responda con un error claro.
async function brandFor(env, scope, brandArg) {
  if (scope && scope.clientId) {
    const pinned = await brandById(env, scope.clientId);
    const arg = String(brandArg || '').trim();
    if (pinned && arg) {
      const wanted = await resolveBrandArg(env, brandArg);
      if (wanted && wanted.id !== pinned.id) return { __conflict: true, pinned, wanted };
    }
    return pinned;
  }
  return resolveBrandArg(env, brandArg);
}
function brandConflictErr(brand) {
  return toolErr(
    `Este conector está FIJADO a la marca "${brand.pinned.name}" y no puede leer ni escribir en "${brand.wanted.name}". ` +
    `Para trabajar ${brand.wanted.name} usa su conector propio o el conector global del equipo (funciona con todas las marcas en cualquier chat).`
  );
}

// ── Handlers de cada herramienta ─────────────────────────────────────────────
async function listBrands(env, scope) {
  if (scope && scope.clientId) {
    const b = await brandById(env, scope.clientId);
    return b
      ? toolText(`Este conector está fijado a la marca: ${b.name}${b.instagram_handle ? ` (${b.instagram_handle})` : ''} — slug: ${b.slug}. Todo lo que crees/edites irá a esta marca.`)
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
  if (brand && brand.__conflict) return brandConflictErr(brand);
  if (!brand) {
    return toolErr(scope && scope.clientId
      ? 'La marca de este conector ya no existe.'
      : `No encontré la marca "${args.brand || ''}". Llama list_brands para ver los nombres exactos.`);
  }
  let sql = 'SELECT id, title, content_type, status, publish_date, hook, caption, inspo_url FROM mkt_posts WHERE client_id = ?1';
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
  const lines = rows.map((r) => {
    const cap = (r.caption && String(r.caption).trim()) ? 'caption: ✓' : 'caption: FALTA';
    const inspo = (r.inspo_url && String(r.inspo_url).trim()) ? ` — inspo: ${String(r.inspo_url).trim()}` : '';
    return `• [id: ${r.id}] ${r.publish_date || 'sin fecha'} — [${r.content_type}/${r.status}] ${r.title} — ${cap}${r.hook ? ` — hook: ${String(r.hook).slice(0, 50)}` : ''}${inspo}`;
  });
  return toolText(`${rows.length} post(s) en ${brand.name}${args.month ? ` (${args.month})` : ''}. Usa el ID con update_post para editar:\n${lines.join('\n')}`);
}

async function createPost(env, scope, args) {
  const brand = await brandFor(env, scope, args.brand);
  if (brand && brand.__conflict) return brandConflictErr(brand);
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

  let publish_date = normDate(args.publish_date != null ? args.publish_date : args.month);
  if (publish_date === undefined) return toolErr('La fecha debe ser AAAA-MM-DD, o el mes AAAA-MM.');
  if (publish_date === '') publish_date = null;

  let grabacion = null;
  if (args.grabacion != null && args.grabacion !== '') {
    grabacion = Number(args.grabacion);
    if (!(grabacion >= 1 && grabacion <= 5)) return toolErr('grabacion debe ser un número 1-5.');
  }

  const title = (args.title && String(args.title).trim().slice(0, 200)) || 'Nuevo contenido';
  const id = crypto.randomUUID().replace(/-/g, '');

  const cols = ['id', 'client_id', 'title', 'content_type', 'status', 'platform'];
  const vals = [id, brand.id, title, content_type, status, platform];
  if (publish_date) { cols.push('publish_date'); vals.push(publish_date); }
  if (grabacion != null) { cols.push('grabacion'); vals.push(grabacion); }
  for (const f of ['caption', 'hook', 'body', 'cta', 'hashtags', 'alt_text']) {
    if (args[f] != null && String(args[f]) !== '') { cols.push(f); vals.push(clip(args[f])); }
  }
  for (const f of ['inspo_url', 'video_url']) {
    if (args[f] == null || String(args[f]).trim() === '') continue;
    const u = normUrl(args[f]);
    if (u.err) return toolErr(`${f} debe ser una URL válida (ej. https://...).`);
    cols.push(f); vals.push(u.value);
  }
  const placeholders = cols.map(() => '?').join(', ');
  await env.DB.prepare(`INSERT INTO mkt_posts (${cols.join(', ')}) VALUES (${placeholders})`).bind(...vals).run();
  logActivity(env, brand.id, id, 'post.create', title.slice(0, 140));

  const mes = publish_date ? publish_date.slice(0, 7) : 'sin fecha (backlog)';
  return toolText(
    `Guion creado en ${brand.name} ✓\n` +
    `• Título: ${title}\n• Tipo: ${content_type}\n• Estado: ${status}\n` +
    `• Fecha: ${publish_date || 'sin fecha'} (mes: ${mes})\n• ID: ${id}`
  );
}

async function getPost(env, scope, args) {
  const postId = String(args.post_id || '').trim();
  if (!postId) return toolErr('Falta post_id. Usa list_posts para ver los IDs de los posts.');
  let sql = 'SELECT p.*, c.name AS brand_name FROM mkt_posts p JOIN mkt_clients c ON c.id = p.client_id WHERE p.id = ?1';
  const binds = [postId];
  if (scope && scope.clientId) { sql += ' AND p.client_id = ?2'; binds.push(scope.clientId); }
  const p = await env.DB.prepare(sql).bind(...binds).first();
  if (!p) {
    return toolErr(scope && scope.clientId
      ? 'Ese post no existe en la marca de este conector (o el ID es incorrecto).'
      : 'No encontré un post con ese ID. Usa list_posts para ver los IDs.');
  }
  const S = (v) => ((v == null || String(v).trim() === '') ? '(vacío)' : String(v));
  return toolText([
    `Post de ${p.brand_name} — ID ${p.id}`,
    `• Título: ${S(p.title)}`,
    `• Fecha: ${p.publish_date || 'sin fecha'} · Tipo: ${p.content_type} · Estado: ${p.status} · Plataforma: ${p.platform || 'Instagram'}${p.grabacion ? ` · Grabación: ${p.grabacion}` : ''}`,
    '',
    `HOOK:\n${S(p.hook)}`,
    '',
    `BODY (cuerpo):\n${S(p.body)}`,
    '',
    `CTA:\n${S(p.cta)}`,
    '',
    `CAPTION (copy final):\n${S(p.caption)}`,
    '',
    `HASHTAGS:\n${S(p.hashtags)}`,
    '',
    `SEO ALT:\n${S(p.alt_text)}`,
    '',
    `INSPO (link de referencia):\n${S(p.inspo_url)}`,
    '',
    `VIDEO (link del asset final):\n${S(p.video_url)}`,
  ].join('\n'));
}

async function updatePost(env, scope, args) {
  const postId = String(args.post_id || '').trim();
  if (!postId) return toolErr('Falta post_id. Usa list_posts para ver los IDs de los posts.');

  // Verifica que el post exista y pertenezca a la marca permitida por la clave.
  let post;
  if (scope && scope.clientId) {
    post = await env.DB.prepare('SELECT id, client_id, title FROM mkt_posts WHERE id = ? AND client_id = ?').bind(postId, scope.clientId).first();
    if (!post) return toolErr('Ese post no existe en esta marca (o el ID es incorrecto).');
  } else {
    post = await env.DB.prepare('SELECT id, client_id, title FROM mkt_posts WHERE id = ?').bind(postId).first();
    if (!post) return toolErr('No encontré un post con ese ID.');
  }

  const sets = [];
  const vals = [];
  const changed = [];

  if (args.title != null) { sets.push('title = ?'); vals.push(String(args.title).trim().slice(0, 200)); changed.push('título'); }
  if (args.content_type != null) {
    const ct = String(args.content_type).toLowerCase();
    if (!CONTENT_TYPES.includes(ct)) return toolErr(`content_type inválido. Opciones: ${CONTENT_TYPES.join(', ')}.`);
    sets.push('content_type = ?'); vals.push(ct); changed.push('tipo');
  }
  if (args.status != null) {
    const st = String(args.status).toLowerCase();
    if (!STATUSES.includes(st)) return toolErr(`status inválido. Opciones: ${STATUSES.join(', ')}.`);
    sets.push('status = ?'); vals.push(st); changed.push('estado');
  }
  if (args.platform != null) {
    if (!PLATFORMS.includes(String(args.platform))) return toolErr(`Plataforma inválida. Opciones: ${PLATFORMS.join(', ')}.`);
    sets.push('platform = ?'); vals.push(String(args.platform)); changed.push('plataforma');
  }
  if (args.publish_date != null || args.month != null) {
    const d = normDate(args.publish_date != null ? args.publish_date : args.month);
    if (d === undefined) return toolErr('La fecha debe ser AAAA-MM-DD, o el mes AAAA-MM (o vacío para quitarla).');
    sets.push('publish_date = ?'); vals.push(d === '' ? null : d); changed.push('fecha');
  }
  if (args.grabacion != null && args.grabacion !== '') {
    const g = Number(args.grabacion);
    if (!(g >= 1 && g <= 5)) return toolErr('grabacion debe ser un número 1-5.');
    sets.push('grabacion = ?'); vals.push(g); changed.push('grabación');
  }
  for (const f of ['caption', 'hook', 'body', 'cta', 'hashtags', 'alt_text']) {
    if (args[f] != null) { sets.push(`${f} = ?`); vals.push(String(args[f]) === '' ? null : clip(args[f])); changed.push(f === 'caption' ? 'copy/caption' : f); }
  }
  for (const f of ['inspo_url', 'video_url']) {
    if (args[f] == null) continue;
    const u = normUrl(args[f]);
    if (u.err) return toolErr(`${f} debe ser una URL válida (ej. https://...), o vacío para quitarlo.`);
    sets.push(`${f} = ?`); vals.push(u.value); changed.push(f === 'inspo_url' ? 'inspo (referencia)' : 'video (asset)');
  }

  if (!sets.length) return toolErr('No diste ningún campo para actualizar (caption, hook, body, cta, hashtags, inspo_url, video_url, publish_date, status, tipo…).');
  sets.push("updated_at = datetime('now')");
  vals.push(postId);
  await env.DB.prepare(`UPDATE mkt_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  logActivity(env, post.client_id, postId, 'post.update', String(post.title || '').slice(0, 140));

  return toolText(`Post actualizado ✓ (ID ${postId})\n• Campos cambiados: ${changed.join(', ')}`);
}

// download_media: resuelve un video (IG/TikTok/Pinterest) con el descargador y
// devuelve caption + link de descarga + la PORTADA como imagen (para "leer" el
// reel de inspiración). No toca la base de datos (solo lectura de la red).
async function downloadMedia(env, args) {
  const url = String((args && args.url) || '').trim();
  if (!url) return toolErr('Dame la URL del reel/video (Instagram, TikTok o Pinterest), o el inspo_url de un post.');
  if (!/^https?:\/\//i.test(url)) return toolErr('La URL debe empezar con http:// o https://');
  // Reintenta para PREFERIR el resultado rico (con caption + portada, de la ruta
  // GraphQL de IG); si sale la versión pobre (cobalt: sin portada) se reintenta.
  let info = null, lastErr = null;
  for (let i = 0; i < 3; i++) {
    let cur = null;
    try { cur = await resolveVideo(url, env); } catch (e) { lastErr = e; }
    if (cur && cur.mediaUrl) { info = cur; if (cur.thumbnail) break; }
    if (i < 2) await new Promise((r) => setTimeout(r, 300));
  }
  if (!info || !info.mediaUrl) return toolErr(`No pude obtener el video de esa URL${lastErr ? `: ${(lastErr.message || lastErr)}` : ' (¿es un reel/post público de IG, TikTok o Pinterest?)'}.`);
  const lines = [
    `Plataforma: ${info.platform || '—'}`,
    info.title ? `Caption/título:\n${String(info.title).slice(0, 2000)}` : null,
    info.durationSec ? `Duración: ${info.durationSec}s` : null,
    (info.width && info.height) ? `Dimensiones: ${info.width}×${info.height}` : null,
    `Link de descarga directo (temporal, sin marca de agua):\n${info.mediaUrl}`,
  ].filter(Boolean);
  // Portada como imagen: muchos reels muestran el texto/tema en el primer frame.
  let b64 = null, mime = 'image/jpeg';
  if (info.thumbnail) {
    try {
      const r = await fetch(info.thumbnail, { headers: (info.mediaHeaders || {}) });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength && buf.byteLength < 3 * 1024 * 1024) {
          b64 = abToBase64(buf);
          mime = r.headers.get('content-type') || 'image/jpeg';
        }
      }
    } catch { /* sin portada, no pasa nada */ }
  }
  const note = b64
    ? '\n\n(Abajo va la PORTADA del video para que la leas. Para el contenido hablado, apóyate en el caption.)'
    : '\n\n(No hubo portada; usa el caption para entender el reel.)';
  return toolMedia(lines.join('\n') + note, b64, mime);
}

// Registro de actividad (best-effort; nunca rompe la operación principal).
function logActivity(env, clientId, postId, action, detail) {
  try {
    env.DB.prepare('INSERT INTO mkt_activity (client_id, post_id, actor_name, action, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(clientId, postId, 'Claude (IA)', action, detail).run();
  } catch { /* noop */ }
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
        try { const b = await brandById(env, scope.clientId); if (b) extra = ` Este conector está fijado a la marca "${b.name}": todo lo que crees o edites irá a esa marca (no hace falta indicar brand).`; }
        catch { /* noop */ }
      }
      return rpcOk(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'IVAE Marketing', version: '1.5.0' },
        instructions: 'Conector del calendario de contenido de IVAE Marketing. Flujo típico: usa list_posts para ver los posts del mes (cada uno trae su ID y si le FALTA caption); usa get_post con ese ID para LEER el guion/caption completo de un post antes de revisarlo o mejorarlo; usa update_post para rellenar/cambiar el copy/caption o el guion (hook/body/cta), la fecha o el estado de un post existente; usa create_post para piezas nuevas. El guion se separa en hook, body (cuerpo), cta, caption (copy final) y hashtags. Para planear/AGREGAR el mes siguiente, simplemente crea los posts con la fecha de ese mes (parámetro month=AAAA-MM o publish_date=AAAA-MM-DD): el mes aparece solo en el calendario, no hace falta "agregar mes" por separado.' + extra,
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
        else if (name === 'get_post') r = await getPost(env, scope, args);
        else if (name === 'create_post') r = await createPost(env, scope, args);
        else if (name === 'update_post') r = await updatePost(env, scope, args);
        else if (name === 'download_media') r = await downloadMedia(env, args);
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

// ── Auth OAuth (Bearer) ──────────────────────────────────────────────────────
// claude.ai obtiene un access token vía OAuth (ver functions/api/mcp-oauth/*) y
// lo manda como "Authorization: Bearer ...". Token global -> alcance de todas las
// marcas (la marca se indica por llamada / por las instrucciones del proyecto).
async function validBearer(env, authHeader) {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false;
  const tok = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!tok) return false;
  try {
    const row = await env.DB.prepare('SELECT expires_at FROM mkt_mcp_oauth WHERE kind = ? AND id = ?').bind('token', tok).first();
    if (!row) return false;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
    return true;
  } catch { return false; }
}
function unauthorized(origin) {
  return new Response(JSON.stringify(rpcErr(null, -32001, 'Unauthorized')), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Entrada HTTP (Cloudflare Pages Function, catch-all /api/mcp/*) ────────────
export async function onRequest(context) {
  const { request, env, params } = context;
  const origin = new URL(request.url).origin;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  // Auth: (1) Bearer OAuth -> global; (2) token-en-ruta (capability URL) -> por marca.
  let scope = null;
  if (await validBearer(env, request.headers.get('Authorization'))) {
    scope = { clientId: null };
  } else {
    const token = Array.isArray(params.path) ? params.path[0] : params.path;
    const key = token ? await getKey(env, token) : null;
    if (key) scope = { clientId: key.client_id || null };
  }
  if (!scope) return unauthorized(origin); // 401 + WWW-Authenticate dispara el OAuth de claude.ai

  if (request.method === 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const clen = Number(request.headers.get('content-length') || 0);
  if (clen && clen > MAX_BODY_BYTES) return jsonRes(rpcErr(null, -32600, 'Payload demasiado grande'), 413);

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
