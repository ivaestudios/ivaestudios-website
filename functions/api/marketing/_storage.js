// ============================================================================
// IVAE Marketing — GET /api/marketing/storage (modulo importado).
//
// El prefijo `_` hace que Pages Functions NO genere una ruta para este archivo:
// lo importa el catch-all y expone handleStorage(). Sin export onRequest, igual
// que _dashboard.js.
//
// QUE MIDE
//   Cuanto pesa lo que tenemos guardado en Cloudflare R2. NO existe columna de
//   tamaño en la BD (mkt_deliverables nunca guardo bytes), asi que el dato se
//   saca del bucket recorriendo objetos con env.R2_BUCKET.list().
//
// EL BUCKET ES COMPARTIDO — regla de oro de este modulo:
//   ivae-gallery-photos lo usan TRES apps. Cada una tiene sus prefijos:
//     marketing  -> 'marketing/'  (video final + entregables + posters)
//                   'backups/'    (respaldo diario JSON del cron de marketing)
//     galeria    -> 'galleries/'  (full/web/thumb de cada foto)
//                   'logos/' 'music/'
//     vacantes   -> 'careers/'    (CV de cada candidato; functions/api/careers)
//   Nunca se reporta el total del bucket como "lo de marketing": el payload
//   trae los numeros separados (+ 'otros' para lo que no cae en ninguno).
//
// COMO LO RECORRE (y por que no se cuelga)
//   list() pagina de 1000 en 1000 (cursor/truncated). La galeria puede tener
//   decenas de miles de objetos, asi que:
//     1) primero recorre SOLO los prefijos de marketing (pocos objetos, exacto);
//     2) despues recorre el bucket completo para el total, con tope de paginas
//        y presupuesto de tiempo. Si se corta, el total viaja con partial=true
//        y la UI dice "al menos X" en vez de inventar una cifra.
//   El orden importa: las claves salen alfabeticas ('galleries/' < 'marketing/'),
//   asi que si el recorrido completo se cortara, marketing se perderia entero.
//   Por eso marketing se mide APARTE y siempre es exacto.
//
// CACHE
//   El resultado vive en mkt_kv('storage_usage') con su marca de tiempo y se
//   recalcula a lo mucho cada 26 h (o cuando alguien pide ?refresh=1, con un
//   piso de 10 min). El panel pinta lo guardado y dice cuando se midio.
//   El TTL es de 26 h A PROPOSITO: el cron corre 1 vez al dia, asi que con 12 h
//   la cache quedaba fria media jornada y quien abriera Inicio de noche pagaba
//   el recorrido en pantalla. 26 h > 24 h = siempre alcanza al cron siguiente.
//   Si D1 no responde (sin mkt_kv, error transitorio) la cache desaparece y con
//   ella el piso de los 10 min, asi que hay un respaldo en memoria del isolate
//   (lastMeasureAt) para que el boton no pueda disparar recorridos en cadena.
//
// PRECIO — lo que este numero SI y NO promete
//   Tarifa publica de Cloudflare R2 (consultada 2026-07-27):
//   almacenamiento Standard 0.015 USD por GB al mes, con 10 GB al mes incluidos
//   gratis POR CUENTA (no por bucket) y salida de datos (egress) gratis.
//   https://developers.cloudflare.com/r2/pricing/
//   R2 NO tiene un tope duro: cobra por uso. Aqui no se inventa ningun limite.
//   Tres advertencias que el widget tiene que respetar:
//     a) la cuenta tiene MAS buckets (ivae-juan-backups, ivae-website-assets),
//        asi que "cabe en los 10 GB gratis" es cierto DE ESTE BUCKET, no de la
//        factura: por eso el texto dice "de la cuenta" y aclara que solo se
//        mide este bucket.
//     b) R2 factura el PROMEDIO GB-mes, no la foto de hoy: el costo se publica
//        como estimacion "si el tamaño no cambia".
//     c) list() no ve las partes de subidas multipart abortadas, que R2 SI
//        almacena y cobra. El total siempre es un PISO de la factura.
// ============================================================================

const KV_KEY = 'storage_usage';

// Prefijos por app (ver cabecera). Se comparan con startsWith sobre la clave.
const MKT_PREFIXES = ['marketing/', 'backups/'];
const GALLERY_PREFIXES = ['galleries/', 'logos/', 'music/'];
const CAREERS_PREFIXES = ['careers/'];

// Extensiones de video que sube marketing (espejo de MKT_VIDEO_MIMES del
// catch-all). Solo sirven para contar "cuantos videos" en el widget.
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v', 'mpeg', '3gp'];

const PAGE = 1000;              // maximo que acepta R2 list()
const MAX_PAGES_MKT = 60;       // 60k objetos de marketing: sobra de lejos
const MAX_PAGES_TOTAL = 200;    // 200k objetos del bucket entero
const TIME_BUDGET_MS = 18000;   // el cliente aborta a los 30 s: cortamos antes
const CRON_BUDGET_MS = 8000;    // el Action usa curl --max-time 60: no lo apuramos
const TTL_MS = 26 * 60 * 60 * 1000;   // > 24 h: siempre alcanza al cron diario
const MIN_REFRESH_MS = 10 * 60 * 1000; // piso para ?refresh=1

// Respaldo en memoria del isolate para cuando D1 no responde (sin mkt_kv o
// error transitorio): sin el, `!cached` anula el piso de MIN_REFRESH_MS y cada
// clic del boton dispara un recorrido completo del bucket. No es perfecto entre
// instancias, pero corta la cadena.
let lastMeasureAt = 0;
let lastMeasureData = null;

// Tarifa vigente de R2 Standard (ver cabecera). Si Cloudflare la cambia, se
// cambia AQUI y el widget se entera solo: el numero viaja en el payload.
const PRICE_PER_GB_USD = 0.015;
const FREE_GB_PER_MONTH = 10;
const PRICING_URL = 'https://developers.cloudflare.com/r2/pricing/';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

function startsWithAny(key, prefixes) {
  for (const p of prefixes) if (key.startsWith(p)) return true;
  return false;
}

function isVideoKey(key) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) return false;
  return VIDEO_EXTS.includes(key.slice(dot + 1).toLowerCase());
}

/**
 * Recorre el bucket (o un prefijo) sumando con onObject.
 * Corta por tope de paginas o por reloj y avisa con partial=true: preferimos
 * un numero honesto e incompleto a uno completo e inventado.
 */
async function walk(bucket, { prefix, maxPages, deadline, onObject }) {
  let cursor;
  let pages = 0;
  let partial = false;
  for (;;) {
    const res = await bucket.list(prefix ? { limit: PAGE, prefix, cursor } : { limit: PAGE, cursor });
    pages += 1;
    for (const o of res.objects || []) onObject(o);
    if (!res.truncated) break;
    // El cursor TIENE que avanzar. Si R2 devolviera truncated sin cursor (o el
    // mismo de antes) la siguiente list() arrancaria desde el principio y
    // recontariamos la misma pagina hasta agotar maxPages: un total inventado.
    // Preferimos cortar y decir "parcial".
    if (!res.cursor || res.cursor === cursor) { partial = true; break; }
    cursor = res.cursor;
    if (pages >= maxPages || Date.now() >= deadline) { partial = true; break; }
  }
  return { pages, partial };
}

/**
 * Mide el bucket de verdad (sin cache). Devuelve el objeto que se guarda en
 * mkt_kv y que consume el widget. Exportada aparte para que el cron la llame.
 */
export async function measureStorage(env, { budgetMs = TIME_BUDGET_MS } = {}) {
  const bucket = env.R2_BUCKET;
  if (!bucket) throw new Error('Sin bucket R2 configurado');

  const t0 = Date.now();
  const deadline = t0 + budgetMs;

  // ── 1) Marketing: recorrido por prefijo propio. Exacto y barato. ──
  const mkt = { bytes: 0, objects: 0, videos: 0, video_bytes: 0 };
  let mktPartial = false;
  let pages = 0;
  for (const prefix of MKT_PREFIXES) {
    const r = await walk(bucket, {
      prefix,
      maxPages: MAX_PAGES_MKT,
      deadline,
      onObject: (o) => {
        const size = Number(o.size) || 0;
        mkt.bytes += size;
        mkt.objects += 1;
        if (isVideoKey(o.key)) { mkt.videos += 1; mkt.video_bytes += size; }
      },
    });
    pages += r.pages;
    if (r.partial) mktPartial = true;
  }

  // ── 2) Bucket completo: para el total y para separar la galeria. ──
  const gal = { bytes: 0, objects: 0 };
  const car = { bytes: 0, objects: 0 };
  const otros = { bytes: 0, objects: 0 };
  const total = { bytes: 0, objects: 0 };
  let mktSeen = { bytes: 0, objects: 0 }; // lo de marketing visto en ESTE recorrido
  const full = await walk(bucket, {
    maxPages: MAX_PAGES_TOTAL,
    deadline,
    onObject: (o) => {
      const size = Number(o.size) || 0;
      total.bytes += size;
      total.objects += 1;
      if (startsWithAny(o.key, MKT_PREFIXES)) { mktSeen.bytes += size; mktSeen.objects += 1; }
      else if (startsWithAny(o.key, GALLERY_PREFIXES)) { gal.bytes += size; gal.objects += 1; }
      else if (startsWithAny(o.key, CAREERS_PREFIXES)) { car.bytes += size; car.objects += 1; }
      else { otros.bytes += size; otros.objects += 1; }
    },
  });
  pages += full.pages;

  // Reconciliacion de los dos recorridos. La regla es que las filas del widget
  // SUMEN el total: si no, los porcentajes no llegan a 100 y nadie se entera.
  if (!full.partial) {
    // El recorrido completo llego hasta el final: sus bytes de marketing son
    // exactos y ademas mas recientes que los del paso 1 (si algo termino de
    // subirse entre las dos pasadas, esta es la version buena). El conteo de
    // videos se queda del paso 1, que es el unico que mira la extension.
    mkt.bytes = mktSeen.bytes;
    mkt.objects = mktSeen.objects;
  } else if (mktSeen.objects < mkt.objects) {
    // Se corto: marketing puede haber quedado fuera del total (sus claves van
    // despues de 'galleries/'). Se suma lo del paso 1, que si es exacto, para
    // que el total nunca quede por debajo del desglose.
    total.bytes += mkt.bytes - mktSeen.bytes;
    total.objects += mkt.objects - mktSeen.objects;
  }

  // Un recorrido cortado en CUALQUIERA de los dos pasos hace que todo el
  // payload sea un piso. Antes solo se miraba full.partial y el paso 1 podia
  // publicarse como cifra firme (con costo incluido) estando incompleto.
  const partial = full.partial || mktPartial;

  const totalGb = total.bytes / 1e9;
  const billableGb = Math.max(0, totalGb - FREE_GB_PER_MONTH);
  // Costo estimado del bucket COMPLETO, SIN redondear a centavos: el widget
  // decide que decir. Redondear aqui hacia 0 hacia que 10.3 GB (ya facturables)
  // se anunciaran como "sin costo". Con medicion parcial no se publica costo:
  // seria un numero mas chico que el real.
  const costUsd = partial ? null : billableGb * PRICE_PER_GB_USD;

  return {
    measured_at: new Date().toISOString(),
    duration_ms: Date.now() - t0,
    pages,
    // partial = el recorrido se corto: los numeros son un PISO, no el total.
    total: { bytes: total.bytes, objects: total.objects, partial },
    marketing: {
      bytes: mkt.bytes, objects: mkt.objects,
      videos: mkt.videos, video_bytes: mkt.video_bytes,
      partial: mktPartial,
    },
    gallery: { bytes: gal.bytes, objects: gal.objects, partial: full.partial },
    careers: { bytes: car.bytes, objects: car.objects, partial: full.partial },
    other: { bytes: otros.bytes, objects: otros.objects, partial: full.partial },
    pricing: {
      price_per_gb_usd: PRICE_PER_GB_USD,
      free_gb_per_month: FREE_GB_PER_MONTH,
      // Bytes facturables de ESTE bucket. El widget decide por bytes, nunca por
      // el precio redondeado.
      billable_gb: Math.round(billableGb * 1000) / 1000,
      cost_usd: costUsd,
      // La cuota gratis es de TODA la cuenta y aqui solo se mide un bucket.
      free_is_account_wide: true,
      url: PRICING_URL,
    },
  };
}

async function readCache(env) {
  try {
    const row = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(KV_KEY).first();
    if (!row || !row.value) return null;
    const parsed = JSON.parse(row.value);
    return parsed && parsed.measured_at ? parsed : null;
  } catch (e) {
    // Tabla ausente (migracion 004), JSON corrupto o D1 caido. Se registra: sin
    // cache el endpoint sigue sirviendo, pero cada carga recorre el bucket y eso
    // no puede pasar en silencio.
    console.error('[mkt storage] cache read', e && e.message);
    return null;
  }
}

async function writeCache(env, data) {
  try {
    await env.DB.prepare(
      'INSERT INTO mkt_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(KV_KEY, JSON.stringify(data)).run();
  } catch (e) {
    console.error('[mkt storage] cache write', e && e.message);
  }
}

/** Refresco best-effort para el cron diario: nunca rompe al que lo llama. */
export async function refreshStorageUsage(env) {
  if (!env || !env.R2_BUCKET) return false;
  try {
    // Presupuesto mas corto que el del panel: este recorrido bloquea la
    // respuesta del cron y el Action corta con curl --max-time 60.
    const data = await measureStorage(env, { budgetMs: CRON_BUDGET_MS });
    lastMeasureAt = Date.now();
    lastMeasureData = data;
    await writeCache(env, data);
    return true;
  } catch (e) {
    console.error('[mkt storage]', e && e.message);
    return false;
  }
}

/**
 * GET /storage[?refresh=1] — SOLO equipo (el gate duro vive en el router; aqui
 * se repite por si alguien mueve la ruta de lugar).
 */
export async function handleStorage(request, env, session, url) {
  // Mismo criterio que el router (isStaff = admin|team). A proposito NO se
  // escribe como "!== client": un rol nuevo que no sea cliente NO deberia
  // colarse solo porque este modulo se quedo con la regla vieja.
  const role = session && session.role;
  if (role !== 'admin' && role !== 'team') return json({ error: 'Forbidden' }, 403);
  if (!env.R2_BUCKET) return json({ error: 'Almacenamiento no disponible' }, 503);

  // Si D1 no devolvio nada, se usa la ultima medicion de este isolate: sirve de
  // dato Y de piso de refresco.
  const cached = (await readCache(env)) || lastMeasureData;
  const now = Date.now();
  const age = cached ? now - Date.parse(cached.measured_at) : Infinity;
  const wantsRefresh = url && url.searchParams.get('refresh') === '1';

  // Sirve la cache mientras esté fresca. ?refresh=1 la salta, pero nunca antes
  // de MIN_REFRESH_MS: recorrer el bucket no puede depender de cuantas veces
  // alguien le pique al boton.
  const fresh = cached && age >= 0 && age < TTL_MS;
  const canRefresh = !cached || age >= (wantsRefresh ? MIN_REFRESH_MS : TTL_MS);
  if (fresh && !canRefresh) {
    // throttled -> la UI lo dice en voz alta. Sin esto, "Volver a medir" repinta
    // exactamente lo mismo y parece descompuesto.
    return json({
      ...cached, cached: true, age_ms: age,
      ...(wantsRefresh ? { throttled: true, retry_in_ms: Math.max(0, MIN_REFRESH_MS - age) } : {}),
    });
  }

  // Ultimo freno: aunque no haya NADA que servir, un intento de medicion hace
  // menos de MIN_REFRESH_MS no se repite (p. ej. mediciones que fallan lento).
  if (!cached && lastMeasureAt && now - lastMeasureAt < MIN_REFRESH_MS) {
    return json({
      error: 'La medicion es reciente; intenta de nuevo en unos minutos.',
      throttled: true, retry_in_ms: MIN_REFRESH_MS - (now - lastMeasureAt),
    }, 429);
  }

  try {
    lastMeasureAt = Date.now(); // se marca ANTES: un fallo lento tambien cuenta
    const data = await measureStorage(env);
    lastMeasureData = data;
    await writeCache(env, data);
    return json({ ...data, cached: false, age_ms: 0 });
  } catch (e) {
    // Si falla la medicion pero teniamos algo guardado, se muestra lo viejo
    // marcado como stale en vez de dejar el widget en error.
    if (cached) return json({ ...cached, cached: true, stale: true, age_ms: age });
    return json({ error: 'No se pudo medir el almacenamiento: ' + ((e && e.message) || 'error') }, 502);
  }
}
