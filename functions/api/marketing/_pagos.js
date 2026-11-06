// ============================================================================
// IVAE Marketing — 💳 LINKS DE PAGO de Stripe para la Bandeja del estudio (6-nov-2026).
//
// Israel: "necesito que Juan me ayude a generar links de pago… todo conectado al
// 100%… acceso a Stripe solo para crear links y para leer".
//
// REPARTO (acordado entre la sesión de Juan y la de Administración, 6-nov-2026):
//   · La llave de Stripe (RESTRINGIDA: links y lectura) vive SOLO en el Worker de
//     Juan (ivae-juan). Aquí no hay llave: el link se le PIDE a Juan con el token
//     puente que él publica en mkt_kv 'juan_puente_token' (misma base).
//   · Cada link queda en mkt_pago_links (migración 048) con el chat, la reserva y
//     el tipo (sesión / upgrade / propina). Un solo uso, con el correo prellenado.
//   · Los PAGOS no viven aquí: los guarda la galería en cobros_sesion (webhook de
//     Stripe de toda la cuenta) y _negocio.js / _bandeja.js los amarran a la
//     clienta y a la venta. Aquí solo se LEEN para decir "pagado" o "sin pagar".
//
// Rutas (todas con sesión; agentes de clínica no las ven):
//   GET  /pagos/estado?client_id=   links, cobros recientes, estado de Stripe y catálogo
//   GET  /pagos/precio?client_id=&paquete=   precio USD del catálogo (prellenar)
//   GET  /pagos/conv/:id            links y cobros de un chat
//   POST /pagos/link                crea el link (conv_id y/o reserva_id opcionales)
// ============================================================================
import { marcaDeMiWs, convDeMiWs, cfgDe, leerJson } from './_bandeja.js';
import { catalogoFoto, precioPaqueteFoto } from './_negocio.js';

const URL_JUAN = 'https://ivae-juan.vianeydm07.workers.dev';
const sinTabla = (e) => /no such table/i.test(String((e && e.message) || e));

async function tokenPuente(env) {
  const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'juan_puente_token'").first().catch(() => null);
  return r && r.value ? String(r.value) : '';
}
async function estadoStripe(env) {
  const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'juan_stripe_estado'").first().catch(() => null);
  try { return r && r.value ? JSON.parse(r.value) : { listo: false }; } catch { return { listo: false }; }
}
function cobroPlano(c) {
  return {
    id: c.id, fecha: c.creado, monto: (Number(c.monto) || 0) / 100, moneda: String(c.moneda || 'usd').toLowerCase(),
    monto_mxn: c.monto_mxn != null ? Number(c.monto_mxn) : null, cliente: c.nombre || null, correo: c.email || null,
    telefono: c.telefono || null, concepto: c.descripcion || null, link_id: c.payment_link || null,
  };
}
const COLS_COBRO = 'id, creado, monto, moneda, monto_mxn, email, nombre, telefono, descripcion, payment_link';
// La tabla cobros_sesion llega con la migración 029 de la galería: si aún no existe, no hay cobros.
async function cobrosRecientes(env, { dias = 120, limite = 80 } = {}) {
  try {
    const r = await env.DB.prepare(`SELECT ${COLS_COBRO} FROM cobros_sesion WHERE creado >= datetime('now', ?) ORDER BY creado DESC LIMIT ?`).bind(`-${dias} days`, limite).all();
    return (r.results || []).map(cobroPlano);
  } catch (e) { if (sinTabla(e)) return []; throw e; }
}
async function cobrosDeConv(env, convId, linkIds) {
  const out = []; const vistos = new Set();
  try {
    const r = await env.DB.prepare(`SELECT ${COLS_COBRO.split(', ').map((k) => 'c.' + k).join(', ')} FROM mkt_cobros_conv l JOIN cobros_sesion c ON c.id = l.cobro_id WHERE l.conv_id = ? ORDER BY c.creado DESC LIMIT 10`).bind(convId).all();
    for (const c of r.results || []) { vistos.add(c.id); out.push(cobroPlano(c)); }
  } catch (e) { if (!sinTabla(e)) throw e; }
  if (linkIds.length) {
    try {
      const r = await env.DB.prepare(`SELECT ${COLS_COBRO} FROM cobros_sesion WHERE payment_link IN (${linkIds.map(() => '?').join(',')}) ORDER BY creado DESC LIMIT 10`).bind(...linkIds).all();
      for (const c of r.results || []) if (!vistos.has(c.id)) { vistos.add(c.id); out.push(cobroPlano(c)); }
    } catch (e) { if (!sinTabla(e)) throw e; }
  }
  return out;
}

export async function handlePagos(request, env, session, path, url, deps) {
  const { json } = deps;
  const method = request.method;
  const ws = (session && session.workspace_id) || 'ivae';
  const esCliente = session.role === 'client';
  const esAgente = esCliente && session.bandeja_rol === 'agente';
  const sub = path.slice('/pagos'.length).split('/').filter(Boolean);
  const qp = (k) => url.searchParams.get(k) || '';
  // Solo el estudio de fotos (bandeja_cfg.giro = 'foto') cobra sesiones con Stripe.
  const marcaOk = async (clientId) => {
    if (!clientId || (esCliente && clientId !== session.client_id)) return null;
    const c = await marcaDeMiWs(env, ws, clientId);
    return c && cfgDe(c).giro === 'foto' ? c : null;
  };
  const convOk = async (convId) => {
    const v = await convDeMiWs(env, ws, convId);
    if (!v) return null;
    if (esCliente && v.client_id !== session.client_id) return null;
    return v;
  };
  if (esAgente) return json({ aplica: false, error: 'Los cobros los maneja el equipo del estudio.' }, 403);

  if (sub[0] === 'estado' && sub.length === 1 && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ aplica: false });
    const [links, cobros, stripe, cat] = await Promise.all([
      env.DB.prepare('SELECT id, url, monto, moneda, concepto, tipo, cliente, correo, telefono, conv_id, canal, contacto_id, reserva_id, paquete, origen, creado_por, estado, pagado_en, pago_id, created_at FROM mkt_pago_links WHERE client_id = ? ORDER BY created_at DESC LIMIT 80').bind(c.id).all().catch(() => ({ results: [] })),
      cobrosRecientes(env).catch(() => []),
      estadoStripe(env),
      catalogoFoto(env).catch(() => null),
    ]);
    return json({ aplica: true, stripe, links: links.results || [], cobros, catalogo: cat && cat.items ? cat.items : [] });
  }

  if (sub[0] === 'precio' && sub.length === 1 && method === 'GET') {
    const c = await marcaOk(qp('client_id'));
    if (!c) return json({ aplica: false });
    return json({ paquete: qp('paquete'), precio_usd: await precioPaqueteFoto(env, qp('paquete')).catch(() => null) });
  }

  if (sub[0] === 'conv' && sub[1] && sub.length === 2 && method === 'GET') {
    const conv = await convOk(sub[1]);
    if (!conv) return json({ error: 'No encontrado' }, 404);
    const c = await marcaOk(conv.client_id);
    if (!c) return json({ aplica: false });
    const links = (await env.DB.prepare(
      "SELECT id, url, monto, moneda, concepto, tipo, cliente, correo, estado, pagado_en, pago_id, created_at, creado_por, origen FROM mkt_pago_links WHERE client_id = ? AND (conv_id = ? OR (contacto_id = ? AND contacto_id != '')) ORDER BY created_at DESC LIMIT 10"
    ).bind(c.id, conv.id, String(conv.contacto_id || '')).all().catch(() => ({ results: [] }))).results || [];
    const cobros = await cobrosDeConv(env, conv.id, links.map((l) => l.id)).catch(() => []);
    return json({ aplica: true, links, cobros });
  }

  if (sub[0] === 'link' && sub.length === 1 && method === 'POST') {
    const b = await leerJson(request);
    const c = await marcaOk(b.client_id || qp('client_id'));
    if (!c) return json({ error: 'Los links de pago son del estudio de fotos.' }, 400);
    let conv = null;
    if (b.conv_id) {
      conv = await convOk(b.conv_id);
      if (!conv || conv.client_id !== c.id) return json({ error: 'Ese chat no es de esta marca.' }, 403);
    }
    const monto = Number(b.monto);
    if (!(monto > 0)) return json({ error: 'Escribe el monto.' }, 400);
    const tk = await tokenPuente(env);
    if (!tk) return json({ error: 'Juan todavía no publicó su llave puente; espera un minuto e inténtalo de nuevo.' }, 503);
    const cuerpo = {
      monto, moneda: String(b.moneda || 'usd').toLowerCase(), concepto: String(b.concepto || '').slice(0, 250), tipo: String(b.tipo || 'sesion'),
      cliente: String(b.cliente || (conv && conv.nombre) || '').slice(0, 120), correo: String(b.correo || (conv && conv.correo) || '').trim(),
      idioma: b.idioma === 'es' ? 'es' : 'en', paquete: String(b.paquete || '').slice(0, 80),
      reserva_id: b.reserva_id != null && String(b.reserva_id) !== '' ? String(b.reserva_id) : '',
      telefono: String(b.telefono || (conv && conv.canal === 'whatsapp' ? conv.contacto_id : '') || ''),
      conv_id: conv ? conv.id : '', canal: conv ? conv.canal : '', contacto_id: conv ? String(conv.contacto_id || '') : '',
      origen: 'crm', creado_por: (session && session.name) || null,
    };
    let r, j;
    try {
      r = await fetch(URL_JUAN + '/api/stripe/link', { method: 'POST', headers: { authorization: 'Bearer ' + tk, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
      j = await r.json().catch(() => ({}));
    } catch (e) { return json({ error: 'No pude hablar con Juan para crear el link: ' + ((e && e.message) || e) }, 502); }
    if (!r.ok || j.error) return json({ error: j.error || ('Juan respondió ' + r.status) }, r.status === 401 ? 502 : (r.status >= 400 && r.status < 600 ? r.status : 502));
    return json(j);
  }

  return json({ error: 'Not found' }, 404);
}
