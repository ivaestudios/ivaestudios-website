// ============================================================================
// IVAE Marketing — GET /api/marketing/estudios (modulo importado).
//
// El prefijo `_` hace que Pages Functions NO genere una ruta para este archivo:
// lo importa el catch-all y expone handleEstudios(). Sin export onRequest,
// igual que _dashboard.js y _storage.js.
//
// QUÉ ES
//   El padrón de IVAE Gallery visto desde el sistema de Vianey. Pedido de
//   Israel (2026-09-11): "¿dónde puedo ver cuántos clientes tengo y todo?
//   agrégalo al sistema de administración de Vianey". La galería
//   (gallery.ivaestudios.com) y esta app comparten la MISMA base D1
//   (ivae-gallery-db), así que aquí se lee la tabla `studios` directo, sin
//   tokens ni llamadas entre dominios.
//
// QUÉ DEVUELVE (solo staff; el gate vive en el router del catch-all)
//   { generated_at, resumen:{ estudios, pagando, en_prueba, gratis, por_vencer,
//     mrr_mxn, bytes_clientes, galerias, fotos, clientes },
//     planes:[{clave, etiqueta, cupo_gb, asientos, precio_mxn}],
//     estudios:[{ id, nombre, slug, contacto, telefono, plan, grupo, precio_mxn,
//                 cupo_gb, cupo_bytes, bytes, pct, asientos, estado, pago_estado,
//                 prueba_hasta, dias_prueba, origen, notas, created_at,
//                 galerias, fotos, clientes, es_casa }] }
//
// REGLAS
//   - Solo LECTURA. Cambiar plan, notas o suspender se hace en el panel de la
//     galería (/admin/estudios.html), que es quien conoce Stripe y el cupo.
//   - Los precios y etiquetas se piden a la galería (/api/precios, público) con
//     un respaldo fijo por si no responde: el MRR nunca sale en cero por eso.
//   - Un solo batch de 3 consultas: 40 estudios × varias consultas sería lento.
//   - Espacio en GB decimales (1 GB = 1e9 bytes), igual que Mi plan.
// ============================================================================

const GB = 1000 * 1000 * 1000;
const ESTUDIO_CASA = 'ivae';
const PRECIOS_URL = 'https://gallery.ivaestudios.com/api/precios';

// Respaldo si la galería no contesta en 2 s (copia de PLANES en su worker;
// la fuente de verdad sigue siendo /api/precios).
const PLANES_RESPALDO = [
  { clave: 'prueba',  etiqueta: 'Prueba',  cupo_gb: 50,     asientos: 1,  precio_mxn: 0 },
  { clave: 'gratis',  etiqueta: 'Gratis',  cupo_gb: 10,     asientos: 1,  precio_mxn: 0 },
  { clave: 'inicio',  etiqueta: 'Inicio',  cupo_gb: 50,     asientos: 1,  precio_mxn: 119 },
  { clave: 'pro',     etiqueta: 'Pro',     cupo_gb: 500,    asientos: 3,  precio_mxn: 349 },
  { clave: 'estudio', etiqueta: 'Estudio', cupo_gb: 2000,   asientos: 10, precio_mxn: 749 },
  { clave: 'casa',    etiqueta: 'La casa', cupo_gb: null,   asientos: 99, precio_mxn: 0 },
];

let precioCache = { at: 0, planes: null };

async function planesDeLaGaleria() {
  if (precioCache.planes && Date.now() - precioCache.at < 10 * 60 * 1000) return precioCache.planes;
  const base = new Map(PLANES_RESPALDO.map((p) => [p.clave, { ...p }]));
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(PRECIOS_URL, { signal: ctrl.signal, cf: { cacheTtl: 600 } });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      for (const p of (d && d.planes) || []) {
        if (!p || !p.id) continue;
        base.set(p.id, { clave: p.id, etiqueta: p.etiqueta || p.id, cupo_gb: p.cupo_gb ?? null, asientos: p.asientos ?? 1, precio_mxn: Number(p.precio_mxn) || 0 });
      }
    }
  } catch { /* respaldo fijo */ }
  const planes = [...base.values()];
  precioCache = { at: Date.now(), planes };
  return planes;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function grupoDe(e) {
  if (e.id === ESTUDIO_CASA) return 'casa';
  if (e.plan === 'prueba') return 'prueba';
  if (e.plan === 'gratis') return 'gratis';
  return 'pagando';
}

export async function handleEstudios(request, env, session, url) {
  void request; void session; void url;
  try {
    const [st, uso, cli] = await env.DB.batch([
      env.DB.prepare(
        `SELECT id, nombre, slug, plan, cupo_gb, asientos, estado, prueba_hasta, pago_estado, pago_hasta,
                contacto, telefono, origen, notas, bytes_reservados, created_at
           FROM studios
          ORDER BY (id = ?) DESC, created_at DESC`
      ).bind(ESTUDIO_CASA),
      env.DB.prepare(
        `SELECT g.studio_id AS sid, COUNT(DISTINCT g.id) AS galerias, COUNT(p.id) AS fotos,
                COALESCE(SUM(p.size_bytes), 0) AS bytes
           FROM galleries g LEFT JOIN photos p ON p.gallery_id = g.id
          GROUP BY g.studio_id`
      ),
      env.DB.prepare(
        `SELECT g.studio_id AS sid, COUNT(DISTINCT u.id) AS clientes
           FROM users u
           JOIN gallery_access ga ON ga.user_id = u.id
           JOIN galleries g ON g.id = ga.gallery_id
          WHERE u.role = 'client'
          GROUP BY g.studio_id`
      ),
    ]);
    const planes = await planesDeLaGaleria();
    const precioDe = new Map(planes.map((p) => [p.clave, p.precio_mxn || 0]));
    const porId = new Map((uso.results || []).map((u) => [u.sid, u]));
    const cliPorId = new Map((cli.results || []).map((c) => [c.sid, c.clientes]));
    const ahora = Date.now();

    const estudios = (st.results || []).map((e) => {
      const u = porId.get(e.id) || { galerias: 0, fotos: 0, bytes: 0 };
      const fin = e.prueba_hasta ? Date.parse(String(e.prueba_hasta).replace(' ', 'T') + (String(e.prueba_hasta).endsWith('Z') ? '' : 'Z')) : null;
      const cupoBytes = e.id === ESTUDIO_CASA ? null : (e.cupo_gb ? e.cupo_gb * GB : null);
      const grupo = grupoDe(e);
      const activo = (!e.estado || e.estado === 'activo') && e.pago_estado !== 'cancelado';
      return {
        id: e.id, nombre: e.nombre, slug: e.slug, contacto: e.contacto || null, telefono: e.telefono || null,
        plan: e.plan, grupo,
        precio_mxn: grupo === 'pagando' && activo ? (precioDe.get(e.plan) || 0) : 0,
        cupo_gb: e.id === ESTUDIO_CASA ? null : e.cupo_gb, cupo_bytes: cupoBytes,
        bytes: u.bytes || 0,
        pct: cupoBytes ? Math.round(((u.bytes || 0) / cupoBytes) * 100) : 0,
        asientos: e.asientos, estado: e.estado, pago_estado: e.pago_estado || null,
        prueba_hasta: e.prueba_hasta || null,
        dias_prueba: fin && Number.isFinite(fin) ? Math.ceil((fin - ahora) / 86400000) : null,
        origen: e.origen || null, notas: e.notas || null, created_at: e.created_at,
        galerias: u.galerias || 0, fotos: u.fotos || 0, clientes: cliPorId.get(e.id) || 0,
        es_casa: e.id === ESTUDIO_CASA,
      };
    });

    const ajenos = estudios.filter((e) => !e.es_casa);
    const resumen = {
      estudios: ajenos.length,
      pagando: ajenos.filter((e) => e.grupo === 'pagando' && e.precio_mxn > 0).length,
      en_prueba: ajenos.filter((e) => e.grupo === 'prueba').length,
      por_vencer: ajenos.filter((e) => e.grupo === 'prueba' && e.dias_prueba != null && e.dias_prueba <= 3).length,
      gratis: ajenos.filter((e) => e.grupo === 'gratis').length,
      mrr_mxn: ajenos.reduce((t, e) => t + (e.precio_mxn || 0), 0),
      bytes_clientes: ajenos.reduce((t, e) => t + (e.bytes || 0), 0),
      galerias: ajenos.reduce((t, e) => t + (e.galerias || 0), 0),
      fotos: ajenos.reduce((t, e) => t + (e.fotos || 0), 0),
      clientes: ajenos.reduce((t, e) => t + (e.clientes || 0), 0),
    };
    return json({ generated_at: new Date().toISOString(), resumen, planes, estudios });
  } catch (e) {
    console.error('[handleEstudios]', e && e.message);
    return json({ error: 'No se pudo leer el padrón de la galería' }, 500);
  }
}
