// ============================================================================
// IVAE Marketing — ADMINISTRACIÓN del estudio (solo admin, solo IVAE STUDIOS).
//
// El prefijo `_` evita que Pages Functions genere una ruta: lo importa el
// catch-all y expone handleNegocio(). Igual que _asistente.js.
//
// QUÉ ES
//   Pedido de Vianey (5-nov-2026): "un sistema de administración… checar las
//   pautas… 100 pesos al día… redirigirlo todo al número de Juan… cuántos leads
//   tenemos en pauta y cuántos en SEO… el costo por sesión ya cerrada, el costo
//   de pauta y el ticket promedio… volvemos a los paquetes anteriores".
//   Una pantalla que junta, por mes:
//     · Pauta: gasto real en Meta (cuenta "Vianey Dm") y el presupuesto diario.
//     · Leads: conversaciones de la Bandeja cuyo PRIMER mensaje cae en el mes,
//       con su fuente (pauta / SEO / redes / …). Se deduce sola y Vianey la
//       corrige con un toque; los leads que llegan por fuera (WhatsApp 990,
//       llamadas) se anotan a mano.
//     · Sesiones cerradas: las reservas de Juan entran solas; las demás a mano.
//     · Costo por lead y por sesión de pauta, ticket promedio y retorno.
//
// ⚠️ LOS CORREOS NO SE TOCAN (Vianey, 5-nov-2026). Aquí la Bandeja solo se LEE:
//   nada escribe en mkt_conversaciones ni en mkt_mensajes. Lo que se corrige
//   (la fuente de un lead) vive en mkt_neg_leads, aparte.
//
// Tablas: migración 046_negocio.sql. Config en mkt_kv 'negocio_cfg'.
// ============================================================================
import { pautaDelPeriodo, fijarTopeDiario, anunciosDelPeriodo } from './_ads.js';

// La única marca que tiene esto: el estudio de fotografía (dinero de la casa).
export const IVAE_STUDIOS = '6ae5dd2381faa430d9e6966470b29602';

// Colecciones ANTERIORES (las del PDF "Exclusive Collections - anteriores"):
// Vianey las regresó el 5-nov-2026. Precios en USD.
const PAQUETES_ANTERIORES = [
  { clave: 'spark', nombre: 'The Spark', minutos: 35, fotos: '15', precio: 245 },
  { clave: 'glow', nombre: 'The Glow Hour', minutos: 45, fotos: '25', precio: 325 },
  { clave: 'essential', nombre: 'The Essential Flow', minutos: 60, fotos: '35', precio: 395 },
  { clave: 'creative', nombre: 'The Creative Runway', minutos: 75, fotos: '50', precio: 475 },
  { clave: 'visual', nombre: 'The Visual Story', minutos: 90, fotos: '70', precio: 575 },
  { clave: 'full', nombre: 'The Full Experience', minutos: 90, fotos: 'Galería completa', precio: 725 },
];
// Las colecciones que rigieron del 30-oct al 5-nov-2026: una reserva hecha con
// esos nombres se vendió a ESE precio, así que se respeta al importarla.
const PRECIOS_30OCT = { postcard: 295, keepsake: 375, chapter: 475, story: 545, editorial: 645, heirloom: 895 };
// Mezcla real de 44 sesiones confirmadas (oct-2025 a oct-2026): la referencia
// del ticket promedio mientras el mes no tenga ventas con precio.
const MEZCLA_44 = { spark: 15, glow: 11, essential: 12, creative: 3, visual: 2, full: 1 };

const FUENTES = ['pauta', 'seo', 'redes', 'recomendacion', 'hotel', 'otro'];
const FUENTES_LEAD = [...FUENTES, 'no_lead'];
// Control de meses (6-nov-2026, del Excel de Vianey): cada ingreso es una
// sesión, un upgrade, una propina, una marca (las empresas de marketing) u otro.
const TIPOS_INGRESO = ['sesion', 'upgrade', 'propina', 'marca', 'otro'];
const FORMAS_PAGO = ['stripe', 'bbva', 'efectivo', 'otro'];
const EMPRESAS_BASE = ['Regeneris', 'Divina Start Productions', 'Smile Now', 'Melisa', 'Adagio'];
// Sus gastos fijos, como los anota ella (se editan en el panel).
const GASTOS_BASE = [
  { id: 'renta', nombre: 'Renta', monto: 6800 },
  { id: 'internet', nombre: 'Internet', monto: 600 },
  { id: 'luz', nombre: 'Luz (bimestral, la mitad)', monto: 875 },
  { id: 'contador', nombre: 'Contador', monto: 500 },
  { id: 'despensa', nombre: 'Despensa', monto: 5000 },
  { id: 'bbva', nombre: 'Tarjeta BBVA Oro', monto: 8000 },
  { id: 'biblia', nombre: 'Biblia e himnario', monto: 440 },
];

const CFG_BASE = {
  presupuesto_diario: 100,                                    // MXN al día
  destino: { nombre: 'Juan', numero: '+52 998 758 2363' },     // todo anuncio va a WhatsApp de Juan
  paquetes: PAQUETES_ANTERIORES,
  tipo_cambio: 18.7,                                          // MXN por USD
  tc_en: null,
  empresas: EMPRESAS_BASE,
  gastos: GASTOS_BASE,
  ofrenda_pct: 10,                                            // su ofrenda: 10% de lo que entra
  sat_pct: 1.25,                                              // RESICO: entre 1% y 1.5%
};

const soloAdmin = (session) => session && session.role === 'admin';

// ── Fechas (Cancún = UTC-5 todo el año) ─────────────────────────────────────
const hoyCancun = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const diaCancunDeUtc = (s) => {
  const t = Date.parse(String(s || '').replace(' ', 'T') + (String(s || '').includes('Z') ? '' : 'Z'));
  return isNaN(t) ? null : new Date(t - 5 * 3600e3).toISOString().slice(0, 10);
};
const masUnDia = (ymd) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const mesesAtras = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };
function periodoDe(mesPedido) {
  const hoy = hoyCancun();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mesPedido || '')) ? mesPedido : hoy.slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const diasMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const desde = `${mes}-01`;
  const fin = `${mes}-${String(diasMes).padStart(2, '0')}`;
  const esActual = mes === hoy.slice(0, 7);
  const futuro = desde > hoy;
  const hasta = esActual ? hoy : fin;
  const transcurridos = futuro ? 0 : (esActual ? Number(hoy.slice(8, 10)) : diasMes);
  return { mes, desde, hasta, fin, dias_mes: diasMes, dias_transcurridos: transcurridos, es_actual: esActual, futuro };
}
// Rango en UTC ('AAAA-MM-DD HH:MM:SS') que cubre los días de Cancún desde..hasta.
const rangoUtc = (desde, hasta) => [`${desde} 05:00:00`, `${masUnDia(hasta)} 05:00:00`];

// ── Config ──────────────────────────────────────────────────────────────────
async function leerCfg(env) {
  let guardada = null;
  try {
    const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'negocio_cfg'").first();
    guardada = r && r.value ? JSON.parse(r.value) : null;
  } catch { guardada = null; }
  const cfg = { ...CFG_BASE, ...(guardada || {}) };
  if (!Array.isArray(cfg.paquetes) || !cfg.paquetes.length) cfg.paquetes = PAQUETES_ANTERIORES;
  if (!Array.isArray(cfg.gastos)) cfg.gastos = GASTOS_BASE;
  if (!Array.isArray(cfg.empresas) || !cfg.empresas.length) cfg.empresas = EMPRESAS_BASE;
  return guardada ? cfg : { ...cfg, primera_vez: true };
}
// La primera vez que se abre el panel queda guardado el presupuesto que pidió
// Vianey (100 al día) y ese mismo número pasa a ser el techo de la pauta
// automática (ads_tope_diario nacía en 500). Una sola vez.
async function iniciarCfg(env, cfg) {
  if (!cfg.primera_vez) return cfg;
  const { primera_vez, ...limpia } = cfg;
  await guardarCfg(env, limpia);
  try { await fijarTopeDiario(env, limpia.presupuesto_diario); } catch (e) { console.error('[negocio] tope', e && e.message); }
  return limpia;
}
async function guardarCfg(env, cfg) {
  await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind('negocio_cfg', JSON.stringify(cfg)).run();
}
// El tipo de cambio se refresca una vez al día (fuente gratuita, sin llave). Si
// falla, se queda el último que hubo: nunca tumba la pantalla.
async function refrescarTipoCambio(env, cfg) {
  const hoy = hoyCancun();
  if (cfg.tc_en === hoy || cfg.tc_manual) return cfg;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const mxn = Number(d && d.rates && d.rates.MXN);
    if (d && d.result === 'success' && mxn > 5 && mxn < 60) {
      const nuevo = { ...cfg, tipo_cambio: Math.round(mxn * 100) / 100, tc_en: hoy };
      await guardarCfg(env, nuevo);
      return nuevo;
    }
  } catch { /* sin red: se queda el último */ }
  return cfg;
}

// ── Paquete → precio ────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)/g, '').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
function precioDe(paquete, cfg) {
  const n = norm(paquete);
  if (!n) return null;
  const exacto = cfg.paquetes.find((p) => norm(p.nombre) === n);
  if (exacto) return Number(exacto.precio) || null;
  if (PRECIOS_30OCT[n] != null) return PRECIOS_30OCT[n];
  const parecido = cfg.paquetes.find((p) => p.clave && n.split(' ').includes(p.clave));
  return parecido ? Number(parecido.precio) || null : null;
}
function ticketReferencia(cfg) {
  let suma = 0; let n = 0;
  for (const [clave, veces] of Object.entries(MEZCLA_44)) {
    const p = cfg.paquetes.find((x) => x.clave === clave);
    if (!p || !(Number(p.precio) > 0)) continue;
    suma += Number(p.precio) * veces; n += veces;
  }
  return n ? Math.round((suma / n) * 100) / 100 : null;
}

// ── Fuente de un lead (deducida) ────────────────────────────────────────────
const CORREOS_PROPIOS = /^(info@ivaestudios\.com|vianeydm07@gmail\.com|vianeydmphoto@gmail\.com|isra9158@gmail\.com)$/i;
const TELS_PROPIOS = /(9902046514|2288570584|9987582363)$/;
const NO_ES_LEAD = /^asunto:\s*(aceptada|rechazada|accepted|declined|invitaci|notas:)|meta policy|policy support|verification program|eligible to join|important notice/i;
// Correos de hoteles y proveedores: casi siempre permisos o pagos, no clientes.
const DOMINIO_PROVEEDOR = /(posadas|hyatt|hilton|marriott|iberostar|(^|\.)riu\.|barcelo|princess-hotels|rosewood|vivaresorts|sirenis|mondrian|grupolomas|trshotels|oceanhotels|houseofaia|omytransfer|palladium|karisma|hotel|resort)/i;
function origenDe(v) { try { return v.origen ? JSON.parse(v.origen) : null; } catch { return null; } }
function fuenteAuto(v) {
  const o = origenDe(v);
  if (o && o.tipo === 'anuncio') return 'pauta';
  if (/^prueba\b/i.test(String(v.nombre || ''))) return 'no_lead';
  if (NO_ES_LEAD.test(String(v.primer_texto || ''))) return 'no_lead';
  const contacto = String(v.contacto_id || '').toLowerCase();
  if (v.canal === 'correo') {
    if (CORREOS_PROPIOS.test(contacto) || /@google\.com$|no-?reply/.test(contacto)) return 'no_lead';
    if (DOMINIO_PROVEEDOR.test(contacto.split('@')[1] || '')) return 'no_lead';
    // "Re:" o "Fwd:" de entrada = el hilo empezó antes (un cliente que ya estaba o
    // una respuesta nuestra): no se adivina, lo dice Vianey.
    if (/^asunto:\s*(re|rv|fw|fwd)\s*:/i.test(String(v.primer_texto || ''))) return null;
    return 'seo';     // el correo de info@ se encuentra en el sitio y en Google
  }
  if (v.canal === 'whatsapp' && TELS_PROPIOS.test(contacto.replace(/\D/g, ''))) return 'no_lead';
  if (v.canal === 'instagram' || v.canal === 'messenger') return 'redes';
  return null;        // WhatsApp sin anuncio: no se sabe, lo dice Vianey
}

// ── Reservas de Juan → ventas ───────────────────────────────────────────────
// Idempotente: inserta las nuevas y solo actualiza el estado y el día de la
// sesión de las que ya estaban. Lo que Vianey corrigió (precio, fuente) no se pisa.
async function sincronizarReservas(env, cfg) {
  let d = null;
  try {
    const r = await env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'juan_reservas'").first();
    d = r && r.value ? JSON.parse(r.value) : null;
  } catch { d = null; }
  if (!d || d.client_id !== IVAE_STUDIOS || !Array.isArray(d.reservas)) return 0;
  const stmts = [];
  for (const r of d.reservas) {
    if (!r || r.id == null) continue;
    const estado = r.estado === 'hecho' ? 'cerrada' : r.estado === 'cancelado' ? 'cancelada' : null;
    if (!estado) continue;                       // 'ocupado' = bloqueo de agenda; pendientes y errores no son venta
    const fecha = diaCancunDeUtc(r.creado) || hoyCancun();
    const fechaSesion = String(r.inicio_iso || '').slice(0, 10) || null;
    const prueba = /prueba/i.test(String(r.cliente || ''));
    stmts.push(env.DB.prepare(
      `INSERT INTO mkt_neg_ventas (id, client_id, fecha, fecha_sesion, cliente, paquete, precio, estado, reserva_id, notas, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'juan')
       ON CONFLICT(reserva_id) DO UPDATE SET
         estado = CASE WHEN mkt_neg_ventas.estado = 'no_cuenta' THEN 'no_cuenta' ELSE excluded.estado END,
         fecha_sesion = excluded.fecha_sesion`
    ).bind(
      'v' + crypto.randomUUID().replace(/-/g, ''), IVAE_STUDIOS, fecha, fechaSesion,
      String(r.cliente || '').slice(0, 120) || null, String(r.paquete || '').slice(0, 80) || null,
      precioDe(r.paquete, cfg), prueba && estado === 'cerrada' ? 'no_cuenta' : estado,
      'juan:' + r.id, r.email ? `Correo: ${String(r.email).slice(0, 120)}` : null,
    ));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return stmts.length;
}

// ── Cobros de Stripe → ingresos ─────────────────────────────────────────────
// Vianey (6-nov-2026): "todo súper vinculado, incluso Stripe". Cada cobro de
// sesión, upgrade o propina entra solo como ingreso con lo que llegó en pesos.
// El historial hasta octubre ya vive en su control de meses (Excel): los cobros
// cuentan desde CORTE_COBROS para no duplicar. Si ya hay un ingreso de esa
// persona sin monto (la reserva de Juan) o con un monto parecido cerca de esa
// fecha, el cobro se le AMARRA en vez de crear otro.
const CORTE_COBROS = '2026-11-01';
export const tokensNombre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, ' ')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 1 && !['the', 'and', 'y', 'de', 'del', 'la', 'los', 'las', 'mr', 'mrs', 'ms'].includes(x));
// Misma persona: comparten el primer nombre o un apellido (el que paga con su
// tarjeta suele escribir nombre y apellido; la reserva solo trae el nombre).
export function mismaPersona(a, b) {
  const x = tokensNombre(a); const y = tokensNombre(b);
  if (!x.length || !y.length) return false;
  return x[0] === y[0] || x.some((t) => t.length > 3 && y.includes(t));
}
const diasEntre = (a, b) => Math.abs((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);

async function sincronizarCobros(env, cfg) {
  const cobros = await leerCobros(env, `${CORTE_COBROS}T05:00:00`);
  if (!cobros.length) return 0;
  const ventas = (await env.DB.prepare(
    'SELECT id, cliente, fecha, fecha_sesion, tipo, monto_mxn, cobro_id, reserva_id FROM mkt_neg_ventas WHERE client_id = ? AND fecha >= ?'
  ).bind(IVAE_STUDIOS, mesesAtras(CORTE_COBROS, 1)).all()).results || [];
  const usados = new Set(ventas.map((v) => v.cobro_id).filter(Boolean));
  const links = await leerLinks(env);
  const tc = Number(cfg.tipo_cambio) || CFG_BASE.tipo_cambio;
  let n = 0;
  for (const c of cobros) {
    const lk = c.payment_link ? links.get(c.payment_link) : null;
    if (lk) await marcarLinkPagado(env, c);
    if (usados.has(c.id)) continue;
    const dia = diaCancunDeUtc(c.creado);
    if (!dia || dia < CORTE_COBROS) continue;
    const auto = clasificarCobro(c, cfg.paquetes || []);
    // Lo que dice el link de Juan manda (sabe si fue sesión, upgrade o propina).
    const tipo = lk && ['sesion', 'upgrade', 'propina', 'otro'].includes(lk.tipo) ? lk.tipo : auto.tipo;
    const paquete = (lk && lk.paquete) || auto.paquete;
    const pesos = pesosDeCobro(c, tc);
    const quien = c.nombre || (lk && lk.cliente) || c.email || 'Cliente de Stripe';
    // Pareja: la reserva de ese link (exacta) o, si no, la misma persona, y solo
    // si es UNA: con monto anotado, que el monto se parezca (±10 días); sin monto
    // (la reserva de Juan), que el pago sea del día de su sesión (±2 días: se paga
    // al terminar). Dos con el mismo nombre esa semana = no se adivina: el cobro
    // entra aparte (revisión de la otra sesión, 6-nov-2026).
    const porNombre = ventas.filter((v) => !v.cobro_id && (v.tipo || 'sesion') === tipo && mismaPersona(v.cliente, quien) && (
      v.monto_mxn != null
        ? diasEntre(v.fecha_sesion || v.fecha, dia) <= 10 && Math.abs(Number(v.monto_mxn) - pesos) <= Math.max(150, pesos * 0.06)
        : !!v.fecha_sesion && diasEntre(v.fecha_sesion, dia) <= 2));
    const pareja = (lk && lk.reserva_id && ventas.find((v) => !v.cobro_id && v.reserva_id === lk.reserva_id))
      || (porNombre.length === 1 ? porNombre[0] : null);
    if (pareja) {
      await env.DB.prepare(
        `UPDATE mkt_neg_ventas SET cobro_id = ?, forma_pago = COALESCE(forma_pago, 'stripe'),
           fecha = CASE WHEN monto_mxn IS NULL THEN ? ELSE fecha END, monto_mxn = COALESCE(monto_mxn, ?), updated_at = datetime('now') WHERE id = ?`
      ).bind(c.id, dia, pesos, pareja.id).run();
      pareja.cobro_id = c.id;
    } else {
      await env.DB.prepare(
        `INSERT INTO mkt_neg_ventas (id, client_id, fecha, cliente, paquete, precio, estado, notas, creado_por, tipo, monto_mxn, forma_pago, cobro_id, conv_id)
         VALUES (?, ?, ?, ?, ?, ?, 'cerrada', ?, 'stripe', ?, ?, 'stripe', ?, ?)`
      ).bind('v' + crypto.randomUUID().replace(/-/g, ''), IVAE_STUDIOS, dia, String(quien).slice(0, 120), paquete,
        String(c.moneda || '').toUpperCase() === 'USD' ? (Number(c.monto) || 0) / 100 : null,
        [`Stripe${c.descripcion ? ': ' + c.descripcion : ''}`, c.email ? `Correo: ${c.email}` : null].filter(Boolean).join(' · ').slice(0, 500),
        tipo, pesos, c.id, (lk && lk.conv_id) || null).run();
    }
    usados.add(c.id);
    n++;
  }
  return n;
}

// ── Para el Embudo de la Bandeja (bandeja_cfg.giro = 'foto') ────────────────
// Una sola lista de precios para el panel y para el CRM: la de "Paquetes
// vigentes" de Administración, más los reels.
const REELS = [
  { nombre: 'The Editorial Reel', precio: 295 },
  { nombre: 'The Narrative Reel', precio: 445 },
  { nombre: 'The Cinematic Short', precio: 695 },
];
export async function catalogoFoto(env) {
  const cfg = await leerCfg(env);
  return { moneda: 'USD', items: [...cfg.paquetes.map((p) => ({ nombre: p.nombre, precio: Number(p.precio) || null })), ...REELS] };
}
export async function precioPaqueteFoto(env, nombre, cfg = null) {
  return precioDe(nombre, cfg || await leerCfg(env));
}
export const cfgNegocio = leerCfg;
// Conversaciones que no son oportunidades (el propio estudio, pruebas, hoteles
// y proveedores, avisos automáticos): fuera del tablero.
export function noEsLead(v) { return fuenteAuto(v) === 'no_lead'; }

// Lo que NOSOTROS le escribimos dice en qué va la persona (6-nov-2026, Ann: "ya
// dice que le enviamos su galería final, ¿por qué está en plática?").
// El flujo del estudio (Vianey, 6-nov-2026): primer contacto → seguimiento →
// se reserva → el DÍA de la sesión se paga (Stripe o efectivo; sin anticipo) →
// 1 a 3 días hábiles para la galería de selección → la clienta elige →
// post-producción de su selección (y upgrade si quiere más fotos) → entrega.
// · FASE_POR_MENSAJE: en qué paso de cliente va, de lo más avanzado a lo menos.
//   Pago confirmado = la sesión ya fue (se paga al terminar).
// · YA_FUE_SESION: cualquiera de esas frases → ya es Cliente.
// · TIENE_SESION: la plantilla "about your photo session" que Israel solo manda
//   a quien ya reservó → al menos Sesión reservada.
// Ojo: antes de vender Juan sí habla de la galería ("galería para selección en
// 1–3 días hábiles"); por eso aquí solo entran frases en pasado o de después.
export const FASE_POR_MENSAJE = [
  ['entregada', /final gallery|galer[ií]a final|final (edited )?photos (are|have been) (ready|uploaded|sent)/i],
  ['postpro', /upgrade payment|pago del upgrade|(received|got) your (photo )?selection|recibimos (su |tu )?selecci[oó]n/i],
  ['eligiendo', /(we'?ve|we have|we) (just )?(sent|uploaded|delivered) your (online |photo )?gallery|your gallery (has been|was) (sent|uploaded|delivered)|gallery will be ready (later )?today|so you can make your selection|ya (le |te )?(enviamos|mandamos|subimos) (su |tu |la )?galer[ií]a/i],
  ['en_proceso', /editing your photos|editando (sus|tus) fotos|confirmed the payment|received your payment|payment for your session|(confirmamos|recibimos) (su |tu |el )?pago/i],
];
export const YA_FUE_SESION = new RegExp(FASE_POR_MENSAJE.map(([, re]) => re.source).join('|'), 'i');
export const TIENE_SESION = /about your photo session/i;
// La misma plantilla también avisa cancelaciones (Vicki y Sarah, 30-oct): esto gana.
export const CANCELO_SESION = /(has been|was) cancel+ed|cancel+ed as requested|cancel+ed since|(fue|ha sido) cancelada|cancelamos (su |tu |la )?sesi[oó]n|se cancel[oó] (su |tu |la )?sesi[oó]n/i;
export function faseDeMensaje(texto) {
  const t = String(texto || '');
  for (const [fase, re] of FASE_POR_MENSAJE) if (re.test(t)) return fase;
  return null;
}

// Los pasos de una clienta (etapa 'cliente' del Embudo; solo el estudio).
export const FASES_FOTO = ['por_cobrar', 'en_proceso', 'eligiendo', 'postpro', 'entregada'];

// ── Cobros de Stripe de las sesiones (tabla cobros_sesion, la llena la galería) ──
// Cada cobro dice quién pagó (correo, nombre, teléfono), qué compró y lo que
// llegó en pesos. Si la tabla aún no existe, no hay cobros (nada se rompe).
export async function leerCobros(env, desdeIso) {
  try {
    const r = await env.DB.prepare(
      'SELECT id, creado, monto, moneda, monto_mxn, neto_mxn, comision_mxn, email, nombre, telefono, descripcion, payment_link FROM cobros_sesion WHERE creado >= ? ORDER BY creado'
    ).bind(desdeIso).all();
    return r.results || [];
  } catch { return []; }
}
// Los links de pago que crea Juan (048_pagos_stripe, sesión de Juan): cada uno
// sabe de qué chat, de qué reserva y de qué es (sesión, upgrade, propina). Un
// cobro que vino de uno de esos links se amarra EXACTO, sin adivinar por nombre.
export async function leerLinks(env) {
  try {
    const r = await env.DB.prepare('SELECT id, conv_id, reserva_id, tipo, paquete, cliente, correo FROM mkt_pago_links').all();
    return new Map((r.results || []).map((l) => [l.id, l]));
  } catch { return new Map(); }
}
// Cuando un cobro llega por un link de Juan, el link queda pagado.
export async function marcarLinkPagado(env, cobro) {
  if (!cobro.payment_link) return;
  await env.DB.prepare("UPDATE mkt_pago_links SET estado = 'pagado', pagado_en = COALESCE(pagado_en, ?), pago_id = COALESCE(pago_id, ?) WHERE id = ? AND estado <> 'pagado'")
    .bind(cobro.creado, cobro.id, cobro.payment_link).run().catch(() => {});
}
// ¿Sesión, upgrade o propina? Por lo que dice que compró; el paquete si lo nombra.
export function clasificarCobro(c, paquetes = []) {
  const desc = String(c.descripcion || '');
  const p = paquetes.find((x) => x.nombre && desc.toLowerCase().includes(String(x.nombre).toLowerCase().replace(/^the\s+/, '')));
  // Así lo escriben en los links reales: "Upgrade", "Up grade", "Up-grade".
  if (/up[\s-]?grade|extra photo|fotos? extra|additional photo/i.test(desc)) return { tipo: 'upgrade', paquete: null };
  if (/propina|\btip\b|gratuity/i.test(desc)) return { tipo: 'propina', paquete: null };
  // Solo el transporte (sin paquete): no es una sesión.
  if (/^\s*(transport(ation|e)?|traslado)s?\s*$/i.test(desc)) return { tipo: 'otro', paquete: null };
  return { tipo: 'sesion', paquete: p ? p.nombre : null };
}
// Lo que entró en pesos: lo que dice Stripe; si no lo dijo, el monto al tipo de cambio.
export function pesosDeCobro(c, tc) {
  if (c.monto_mxn != null) return Number(c.monto_mxn);
  const n = (Number(c.monto) || 0) / 100;
  return String(c.moneda || '').toUpperCase() === 'USD' ? Math.round(n * (Number(tc) || 18.7) * 100) / 100 : n;
}

// ── Publicaciones de Instagram de un periodo (Administración → Publicaciones) ─
// Lo mismo que lee Métricas (alcance, interacciones, guardados, compartidos),
// ordenado de la que más funcionó a la que menos. 30 min en mkt_kv: leer los
// insights de cada publicación cuesta llamadas.
async function publicacionesDelPeriodo(env, deps, desde, hasta) {
  const clave = `neg_ig:${desde}:${hasta}`;
  try {
    const r = await env.DB.prepare('SELECT value FROM mkt_kv WHERE key = ?').bind(clave).first();
    const g = r && r.value ? JSON.parse(r.value) : null;
    if (g && g.en && Date.now() - g.en < 30 * 60e3 && g.datos) return g.datos;
  } catch { /* sin caché: se lee de Instagram */ }
  if (!deps.fetchIgMetricsRange) return { conectado: false, publicaciones: [] };
  let datos;
  try {
    const out = await deps.fetchIgMetricsRange(env, IVAE_STUDIOS, desde, hasta);
    if (!out || !out.connected || out.error || !out.data) return { conectado: !!(out && out.connected), publicaciones: [], error: (out && out.error) || null };
    const pubs = (out.data.posts || []).map((m) => ({
      id: m.id,
      texto: String(m.caption || '').slice(0, 90),
      tipo: /REEL|VIDEO/i.test(String(m.type || '')) ? 'reel' : 'post',
      enlace: m.permalink || null,
      foto: m.thumb || null,
      fecha: String(m.timestamp || '').slice(0, 10),
      alcance: m.reach != null ? Number(m.reach) : null,
      vistas: m.views != null ? Number(m.views) : null,
      interacciones: m.interactions != null ? Number(m.interactions) : (Number(m.likes) || 0) + (Number(m.comments) || 0),
      likes: Number(m.likes) || 0,
      comentarios: Number(m.comments) || 0,
      guardados: m.saved != null ? Number(m.saved) : null,
      compartidos: m.shares != null ? Number(m.shares) : null,
    }));
    pubs.sort((a, b) => (b.interacciones - a.interacciones) || ((b.alcance || 0) - (a.alcance || 0)));
    datos = { conectado: true, publicaciones: pubs.slice(0, 24), total: pubs.length, pendientes: out.data.pending || 0 };
  } catch (e) {
    return { conectado: true, publicaciones: [], error: (e && e.message) || 'No se pudo leer Instagram' };
  }
  await env.DB.prepare('INSERT OR REPLACE INTO mkt_kv (key, value) VALUES (?, ?)').bind(clave, JSON.stringify({ en: Date.now(), datos })).run().catch(() => {});
  return datos;
}

// "mensajes" → "mensaje", para decir "$6 por mensaje".
const SINGULAR = { mensajes: 'mensaje', registros: 'registro', compras: 'compra', 'visitas a la página': 'visita a la página', clics: 'clic', interacciones: 'interacción' };
const recorte = (s, n = 48) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

// ── El resumen del mes ──────────────────────────────────────────────────────
async function resumen(env, url, deps = {}) {
  const p = periodoDe(url.searchParams.get('mes'));
  let cfg = await iniciarCfg(env, await leerCfg(env));
  cfg = await refrescarTipoCambio(env, cfg);
  await sincronizarReservas(env, cfg).catch((e) => console.error('[negocio] reservas', e && e.message));
  await sincronizarCobros(env, cfg).catch((e) => console.error('[negocio] cobros', e && e.message));
  const [u0, u1] = rangoUtc(p.desde, p.fin);

  const [convsR, todasR, overR, manualR, ventasR, juanR, historicoR, pauta] = await Promise.all([
    // Leads del mes: conversaciones cuyo PRIMER mensaje del cliente cae en el mes.
    // primer_out: si nosotros escribimos antes, la conversación la empezamos
    // nosotros (avisos a quien ya es cliente, como Ann) y no es un lead nuevo.
    env.DB.prepare(
      `SELECT v.id, v.canal, v.contacto_id, v.nombre, v.username, v.origen, v.etapa,
              MIN(CASE WHEN m.direccion = 'in' THEN m.creado END) AS primer_in,
              MIN(CASE WHEN m.direccion = 'out' THEN m.creado END) AS primer_out
         FROM mkt_conversaciones v JOIN mkt_mensajes m ON m.conv_id = v.id
        WHERE v.client_id = ? GROUP BY v.id HAVING primer_in >= ? AND primer_in < ?
        ORDER BY primer_in DESC LIMIT 400`
    ).bind(IVAE_STUDIOS, u0, u1).all(),
    // Todas las conversaciones (para deducir de dónde vino cada venta).
    env.DB.prepare('SELECT id, canal, contacto_id, nombre, origen, etapa, archivado, ultimo_en, ultimo_cliente_en FROM mkt_conversaciones WHERE client_id = ? LIMIT 3000').bind(IVAE_STUDIOS).all(),
    env.DB.prepare('SELECT conv_id, fuente FROM mkt_neg_leads WHERE client_id = ? AND conv_id IS NOT NULL').bind(IVAE_STUDIOS).all(),
    env.DB.prepare('SELECT * FROM mkt_neg_leads WHERE client_id = ? AND conv_id IS NULL AND fecha >= ? AND fecha <= ? ORDER BY fecha DESC, created_at DESC').bind(IVAE_STUDIOS, p.desde, p.fin).all(),
    env.DB.prepare('SELECT * FROM mkt_neg_ventas WHERE client_id = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha DESC, created_at DESC').bind(IVAE_STUDIOS, p.desde, p.fin).all(),
    env.DB.prepare("SELECT value FROM mkt_kv WHERE key = 'juan_bot_estado'").first().catch(() => null),
    // Los últimos 12 meses cerrados: la referencia del ticket cuando el mes aún no tiene sesiones.
    env.DB.prepare("SELECT tipo, monto_mxn, precio FROM mkt_neg_ventas WHERE client_id = ? AND estado = 'cerrada' AND fecha >= ? AND fecha <= ?").bind(IVAE_STUDIOS, mesesAtras(p.desde, 12), p.fin).all().catch(() => ({ results: [] })),
    p.futuro ? Promise.resolve({ conectada: true, origen: 'base', gasto: 0, moneda: 'MXN', activas: [], conversaciones: null, clics: null, error: null }) : pautaDelPeriodo(env, p.desde, p.hasta),
  ]);

  // Primer texto de cada lead del mes (para ver de qué se trata y deducir "no es lead").
  const override = new Map((overR.results || []).map((o) => [o.conv_id, o.fuente]));
  const convs = (convsR.results || []).filter((v) => override.has(v.id) || !(v.primer_out && String(v.primer_out) < String(v.primer_in)));
  const primeros = new Map();
  if (convs.length) {
    const ids = convs.map((v) => v.id);
    for (let i = 0; i < ids.length; i += 80) {
      const lote = ids.slice(i, i + 80);
      const r = await env.DB.prepare(
        `SELECT m.conv_id, m.texto FROM mkt_mensajes m
          WHERE m.direccion = 'in' AND m.conv_id IN (${lote.map(() => '?').join(',')})
            AND m.creado = (SELECT MIN(x.creado) FROM mkt_mensajes x WHERE x.conv_id = m.conv_id AND x.direccion = 'in')`
      ).bind(...lote).all();
      for (const row of r.results || []) if (!primeros.has(row.conv_id)) primeros.set(row.conv_id, row.texto || '');
    }
  }

  const leads = convs.map((v) => {
    const texto = primeros.get(v.id) || '';
    const auto = fuenteAuto({ ...v, primer_texto: texto });
    const o = origenDe(v);
    return {
      id: v.id, conv_id: v.id, manual: false, canal: v.canal,
      nombre: v.nombre || (v.username ? '@' + v.username : v.contacto_id),
      fecha: diaCancunDeUtc(v.primer_in), texto: String(texto).replace(/^Asunto:\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 140),
      fuente: override.has(v.id) ? override.get(v.id) : auto, auto: !override.has(v.id),
      anuncio: o && o.tipo === 'anuncio' ? (o.titulo || o.ad_id || 'Anuncio') : null,
      etapa: v.etapa || null,
    };
  });
  for (const l of manualR.results || []) {
    leads.push({ id: l.id, conv_id: null, manual: true, canal: l.canal || 'otro', nombre: l.nombre || 'Sin nombre', fecha: l.fecha, texto: l.notas || '', fuente: l.fuente, auto: false, anuncio: null, etapa: null });
  }
  leads.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  // Fuente de cada venta: la que puso Vianey o la de su conversación (por correo o por nombre).
  const todas = todasR.results || [];
  const porCorreo = new Map(todas.filter((v) => v.canal === 'correo').map((v) => [String(v.contacto_id).toLowerCase(), v]));
  const porNombre = new Map();
  for (const v of todas) { const k = norm(v.nombre); if (k && k.length > 3 && !porNombre.has(k)) porNombre.set(k, v); }
  const fuenteDeConv = (v) => (override.has(v.id) ? override.get(v.id) : fuenteAuto(v));
  const ventas = [];
  let ocultas = 0;
  for (const v of ventasR.results || []) {
    if (v.estado !== 'cerrada') { ocultas++; continue; }
    let auto = null;
    if (!v.fuente) {
      const correo = (String(v.notas || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
      const conv = (correo && porCorreo.get(correo.toLowerCase())) || porNombre.get(norm(v.cliente));
      if (conv) { const f = fuenteDeConv(conv); auto = f && f !== 'no_lead' ? f : null; }
    }
    const tipo = TIPOS_INGRESO.includes(v.tipo) ? v.tipo : 'sesion';
    // Lo que entró en pesos es lo que ella anota al cobrar. Una reserva de Juan
    // trae el precio en USD pero todavía no es dinero en la cuenta: no suma hasta
    // que se le pone el monto.
    const mxn = v.monto_mxn != null ? Number(v.monto_mxn) : null;
    ventas.push({
      id: v.id, fecha: v.fecha, fecha_sesion: v.fecha_sesion, cliente: v.cliente, paquete: v.paquete,
      precio: v.precio != null ? Number(v.precio) : null, fuente: v.fuente || auto, fuente_auto: !v.fuente,
      origen: v.reserva_id ? 'juan' : (v.creado_por === 'excel' ? 'excel' : (v.creado_por === 'stripe' ? 'stripe' : 'manual')), notas: v.notas || '',
      stripe: !!v.cobro_id,
      tipo, monto_mxn: v.monto_mxn != null ? Number(v.monto_mxn) : null, mxn, forma_pago: v.forma_pago || null, empresa: v.empresa || null,
    });
  }

  // ── Números ──
  const tc = Number(cfg.tipo_cambio) || CFG_BASE.tipo_cambio;
  const cuenta = (lista, f) => lista.filter((x) => x.fuente === f).length;
  const validos = leads.filter((l) => l.fuente !== 'no_lead');
  const porFuenteLeads = Object.fromEntries(FUENTES.map((f) => [f, cuenta(validos, f)]));
  porFuenteLeads.sin_definir = validos.filter((l) => !l.fuente).length;
  const sesiones = ventas.filter((v) => v.tipo === 'sesion');
  const porFuenteVentas = Object.fromEntries(FUENTES.map((f) => [f, cuenta(sesiones, f)]));
  porFuenteVentas.sin_definir = sesiones.filter((v) => !v.fuente).length;
  // Control de meses: lo que entró de sesiones (con upgrades y propinas) y lo de las marcas, en pesos.
  const suma = (lista) => lista.reduce((s, v) => s + (v.mxn > 0 ? v.mxn : 0), 0);
  const deSesiones = ventas.filter((v) => ['sesion', 'upgrade', 'propina'].includes(v.tipo));
  const ingresosSesiones = suma(deSesiones);
  const ingresosMarcas = suma(ventas.filter((v) => v.tipo === 'marca'));
  const ingresosOtros = suma(ventas.filter((v) => v.tipo === 'otro'));
  const ingresosMxn = ingresosSesiones + ingresosMarcas + ingresosOtros;
  const sesionesConMonto = sesiones.filter((v) => v.mxn > 0);
  const conPrecio = sesiones.filter((v) => v.precio > 0);
  const ingresos = conPrecio.reduce((s, v) => s + v.precio, 0);
  const ventasPauta = sesiones.filter((v) => v.fuente === 'pauta');
  const ingresosPauta = ventasPauta.filter((v) => v.precio > 0).reduce((s, v) => s + v.precio, 0);
  const ingresosPautaMxn = suma(ventas.filter((v) => v.fuente === 'pauta'));
  const gasto = Number(pauta.gasto) || 0;
  // Ticket = lo que deja una sesión con sus upgrades, en pesos. Si el mes no
  // tiene, la referencia son sus últimos 12 meses (o la mezcla de 44 sesiones).
  const ticketMxn = sesionesConMonto.length ? ingresosSesiones / sesionesConMonto.length : null;
  const ticket = ticketMxn != null ? ticketMxn / tc : null;
  const hist = historicoR && historicoR.results ? historicoR.results : [];
  const histSes = hist.filter((h) => (h.tipo || 'sesion') === 'sesion' && h.monto_mxn > 0).length;
  const histMxn = hist.filter((h) => ['sesion', 'upgrade', 'propina'].includes(h.tipo || 'sesion')).reduce((s, h) => s + (h.monto_mxn > 0 ? Number(h.monto_mxn) : 0), 0);
  const ticketHistMxn = histSes >= 3 ? histMxn / histSes : null;
  const ticketRef = ticketHistMxn != null ? ticketHistMxn / tc : ticketReferencia(cfg);
  const ticketBaseMxn = ticketMxn != null ? ticketMxn : (ticketHistMxn != null ? ticketHistMxn : (ticketRef ? ticketRef * tc : null));
  // Gastos fijos, ofrenda, SAT y lo gastado en anuncios: lo que se va del mes
  // para saber lo que le queda.
  const gastosMxn = (cfg.gastos || []).reduce((s, g) => s + (Number(g.monto) > 0 ? Number(g.monto) : 0), 0);
  const ofrendaMxn = ingresosMxn * ((Number(cfg.ofrenda_pct) || 0) / 100);
  const satMxn = ingresosMxn * ((Number(cfg.sat_pct) || 0) / 100);
  const quedaMxn = ingresosMxn - gastosMxn - ofrendaMxn - satMxn - gasto;
  const presupuestoMes = (Number(cfg.presupuesto_diario) || 0) * p.dias_mes;
  const redondo = (n) => (n == null || !isFinite(n) ? null : Math.round(n * 100) / 100);

  let juan = null;
  try { const e = juanR && juanR.value ? JSON.parse(juanR.value) : null; juan = e ? { en: e.en || null } : null; } catch { juan = null; }

  // ── Para decidir: anuncios, publicaciones, mes a mes y recomendaciones ──
  const hoy = hoyCancun();
  const hace90 = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 89); return d.toISOString().slice(0, 10); })();
  const [adsMes, pubsMes, serieR, pautaMesR, ventas120R] = await Promise.all([
    p.futuro ? Promise.resolve({ conectada: true, anuncios: [] }) : anunciosDelPeriodo(env, p.desde, p.hasta),
    p.futuro ? Promise.resolve({ conectado: true, publicaciones: [] }) : publicacionesDelPeriodo(env, deps, p.desde, p.hasta),
    env.DB.prepare(
      "SELECT substr(fecha, 1, 7) AS mes, tipo, COUNT(*) AS n, SUM(COALESCE(monto_mxn, 0)) AS mxn FROM mkt_neg_ventas WHERE client_id = ? AND estado = 'cerrada' AND fecha >= ? AND fecha <= ? GROUP BY 1, 2"
    ).bind(IVAE_STUDIOS, mesesAtras(p.desde, 11), p.fin).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT substr(dia, 1, 7) AS mes, SUM(gasto) AS gasto FROM mkt_ads_dia WHERE dia >= ? AND dia <= ? GROUP BY 1').bind(mesesAtras(p.desde, 11), p.fin).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT cliente, notas, fuente FROM mkt_neg_ventas WHERE client_id = ? AND estado = 'cerrada' AND COALESCE(tipo, 'sesion') = 'sesion' AND fecha >= ?").bind(IVAE_STUDIOS, mesesAtras(hoy, 4)).all().catch(() => ({ results: [] })),
  ]);
  // Si el mes no tuvo anuncios o casi no hubo publicaciones, se enseñan los
  // últimos 90 días: siempre hay algo con qué decidir.
  let anuncios = adsMes; let anunciosRango = 'mes';
  if (!p.futuro && !(adsMes.anuncios || []).length) { anuncios = await anunciosDelPeriodo(env, hace90, hoy); anunciosRango = '90'; }
  let publicaciones = pubsMes; let publicacionesRango = 'mes';
  if (!p.futuro && (pubsMes.publicaciones || []).length < 3 && pubsMes.conectado !== false) {
    const p90 = await publicacionesDelPeriodo(env, deps, hace90, hoy);
    if ((p90.publicaciones || []).length > (pubsMes.publicaciones || []).length) { publicaciones = p90; publicacionesRango = '90'; }
  }

  // De qué anuncio llegó cada lead (WhatsApp/Messenger/IG mandan el anuncio en el
  // primer mensaje) y cuántas de esas personas reservaron.
  const leadsPorAd = new Map();
  for (const v of todas) { const o = origenDe(v); if (o && o.tipo === 'anuncio' && o.ad_id) leadsPorAd.set(String(o.ad_id), (leadsPorAd.get(String(o.ad_id)) || 0) + 1); }
  const reservasPorAd = new Map();
  for (const s of ventas120R.results || []) {
    const correo = (String(s.notas || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
    const conv = (correo && porCorreo.get(correo.toLowerCase())) || porNombre.get(norm(s.cliente));
    const o = conv ? origenDe(conv) : null;
    if (o && o.tipo === 'anuncio' && o.ad_id) reservasPorAd.set(String(o.ad_id), (reservasPorAd.get(String(o.ad_id)) || 0) + 1);
  }
  const listaAds = (anuncios.anuncios || []).map((a) => {
    const leadsAd = leadsPorAd.get(String(a.ad_id)) || 0;
    const resAd = reservasPorAd.get(String(a.ad_id)) || 0;
    return { ...a, leads: leadsAd, reservas: resAd, costo_lead: leadsAd ? redondo(a.gasto / leadsAd) : null, costo_reserva: resAd ? redondo(a.gasto / resAd) : null };
  });
  // "El mejor" es el que trae CLIENTES (costo por lead). Si ninguno trajo, solo
  // se dice cuál fue más barato por resultado, sin llamarlo el mejor: un clic
  // barato que nadie convierte no es un buen anuncio.
  const conResultado = listaAds.filter((a) => a.resultado && a.resultado.valor > 0 && a.resultado.costo != null);
  const conLeads = listaAds.filter((a) => a.leads > 0);
  const menor = (lista, f) => lista.reduce((m, a) => (f(a) < f(m) ? a : m));
  const mayor = (lista, f) => lista.reduce((m, a) => (f(a) > f(m) ? a : m));
  let criterioAds = null; let mejorAd = null; let peorAd = null;
  if (conLeads.length) {
    criterioAds = 'lead';
    mejorAd = menor(conLeads, (a) => a.costo_lead);
    peorAd = conLeads.length > 1 ? mayor(conLeads, (a) => a.costo_lead) : null;
  } else if (conResultado.length) {
    criterioAds = 'resultado';
    mejorAd = menor(conResultado, (a) => a.resultado.costo);
    peorAd = conResultado.length > 1 ? mayor(conResultado, (a) => a.resultado.costo) : null;
  }
  const listaPubs = publicaciones.publicaciones || [];
  const mejorPub = listaPubs[0] || null;

  // Mes a mes (12 meses hasta el elegido): lo que entró de sesiones y de marcas, y lo gastado en anuncios.
  const serie = [];
  for (let i = 11; i >= 0; i--) {
    const mes = mesesAtras(p.desde, i).slice(0, 7);
    const filasMes = (serieR.results || []).filter((f) => f.mes === mes);
    const de = (tipos) => filasMes.filter((f) => tipos.includes(f.tipo || 'sesion')).reduce((s, f) => s + (Number(f.mxn) || 0), 0);
    const gastoMes = ((pautaMesR.results || []).find((f) => f.mes === mes) || {}).gasto;
    serie.push({
      mes,
      sesiones_mxn: redondo(de(['sesion', 'upgrade', 'propina'])),
      marcas_mxn: redondo(de(['marca'])),
      otros_mxn: redondo(de(['otro'])),
      sesiones_n: filasMes.filter((f) => (f.tipo || 'sesion') === 'sesion').reduce((s, f) => s + (Number(f.n) || 0), 0),
      pauta_mxn: mes === p.mes ? redondo(gasto) : redondo(Number(gastoMes) || 0),
    });
  }

  // Quién está esperando que le contesten (lo mismo que cuenta el Embudo).
  const noLeadsMarcados = new Set([...override.entries()].filter(([, f]) => f === 'no_lead').map(([id]) => id));
  const esperando = todas.filter((v) => !v.archivado && v.ultimo_cliente_en && v.ultimo_en && String(v.ultimo_cliente_en) >= String(v.ultimo_en)
    && !['cliente', 'perdido'].includes(v.etapa) && !noLeadsMarcados.has(v.id) && fuenteAuto(v) !== 'no_lead').length;

  // Pendientes: reglas claras, ordenadas por lo que más importa. Título corto y
  // una línea, como la notificación de una app de banco (Vianey, 6-nov-2026:
  // "que se vea como aplicación de finanzas… parece 100% IA").
  const recs = [];
  const rec = (prioridad, tono, titulo, texto, ir) => recs.push({ prioridad, tono, titulo, texto, ir });
  const presu = Number(cfg.presupuesto_diario) || 0;
  if (p.es_actual && presu > 0 && !(pauta.activas || []).length) {
    rec(1, 'accion', 'Presupuesto de anuncios sin usar', `${pesos(presu)} al día disponibles y ningún anuncio encendido.`, 'anuncios');
  }
  if (esperando > 0) {
    rec(2, 'accion', `${esperando} ${esperando === 1 ? 'persona espera' : 'personas esperan'} respuesta`, 'Contéstales desde la Bandeja.', 'bandeja');
  }
  const gastoAds = listaAds.reduce((t, a) => t + a.gasto, 0);
  if (criterioAds === 'lead') {
    rec(3, 'bien', `Mejor anuncio: ${recorte(mejorAd.nombre, 34)}`,
      `${pesos(mejorAd.costo_lead)} por persona que te escribió${mejorAd.reservas ? ` · ${mejorAd.reservas} ${mejorAd.reservas === 1 ? 'reserva' : 'reservas'}` : ''}.`, 'anuncios');
  } else if (listaAds.length) {
    rec(3, 'alerta', 'Tus anuncios no trajeron clientes',
      `${pesos(gastoAds)} gastados${anunciosRango === '90' ? ' en 90 días' : ''} y nadie escribió por ellos.`, 'anuncios');
  }
  if (mejorPub) {
    rec(4, 'bien', 'Publicación que más gustó', `«${recorte(mejorPub.texto, 32)}» · ${mejorPub.interacciones.toLocaleString('es-MX')} interacciones.`, 'publicaciones');
  }
  const sinMonto = sesiones.length - sesionesConMonto.length;
  if (sinMonto > 0) rec(5, 'accion', `${sinMonto} ${sinMonto === 1 ? 'sesión sin monto' : 'sesiones sin monto'}`, 'Anota cuánto cobraste.', 'dinero');
  if (porFuenteLeads.sin_definir > 0) rec(6, 'accion', `${porFuenteLeads.sin_definir} ${porFuenteLeads.sin_definir === 1 ? 'cliente sin origen' : 'clientes sin origen'}`, 'Marca de dónde llegó cada uno.', 'clientes');
  recs.sort((a, b) => a.prioridad - b.prioridad);

  return {
    periodo: p,
    anuncios: { conectada: anuncios.conectada !== false, rango: anunciosRango, lista: listaAds, criterio: criterioAds, mejor: mejorAd ? mejorAd.ad_id : null, peor: peorAd ? peorAd.ad_id : null, gasto: redondo(gastoAds), error: anuncios.error || null },
    publicaciones: { conectado: publicaciones.conectado !== false, rango: publicacionesRango, lista: listaPubs, total: publicaciones.total || listaPubs.length, error: publicaciones.error || null },
    serie,
    esperando,
    recomendaciones: recs.slice(0, 6),
    embudo: {
      gasto: redondo(gasto),
      alcance: pauta.alcance != null ? Number(pauta.alcance) : null,
      resultados_meta: pauta.conversaciones != null ? Number(pauta.conversaciones) : (pauta.clics != null ? Number(pauta.clics) : null),
      leads: porFuenteLeads.pauta,
      reservas: ventasPauta.length,
      ventas_mxn: redondo(ingresosPautaMxn),
    },
    cfg: {
      presupuesto_diario: cfg.presupuesto_diario, destino: cfg.destino, paquetes: cfg.paquetes, tipo_cambio: tc, tc_en: cfg.tc_en || null, tc_manual: !!cfg.tc_manual,
      empresas: cfg.empresas, gastos: cfg.gastos, ofrenda_pct: Number(cfg.ofrenda_pct) || 0, sat_pct: Number(cfg.sat_pct) || 0,
    },
    pauta,
    juan,
    leads,
    ventas,
    ocultas,
    kpis: {
      gasto: redondo(gasto),
      presupuesto_mes: presupuestoMes,
      leads: { total: validos.length, ...porFuenteLeads },
      ventas: { total: sesiones.length, ...porFuenteVentas, sin_precio: sesiones.length - sesionesConMonto.length },
      // Control de meses (pesos).
      ingresos_mxn: redondo(ingresosMxn),
      ingresos_sesiones_mxn: redondo(ingresosSesiones),
      ingresos_marcas_mxn: redondo(ingresosMarcas),
      ingresos_otros_mxn: redondo(ingresosOtros),
      sesiones_n: sesiones.length,
      sesiones_con_monto: sesionesConMonto.length,
      ticket_mxn: redondo(ticketMxn),
      ticket_hist_mxn: redondo(ticketHistMxn),
      ticket_hist_n: histSes,
      gastos_mxn: redondo(gastosMxn),
      ofrenda_mxn: redondo(ofrendaMxn),
      sat_mxn: redondo(satMxn),
      queda_mxn: redondo(quedaMxn),
      // Lo de antes, en dólares.
      ingresos_usd: redondo(ingresos),
      ingresos_pauta_usd: redondo(ingresosPauta),
      ticket_usd: redondo(ticket),
      ticket_n: sesionesConMonto.length,
      ticket_ref_usd: redondo(ticketRef),
      costo_lead_pauta: porFuenteLeads.pauta ? redondo(gasto / porFuenteLeads.pauta) : null,
      costo_sesion_pauta: ventasPauta.length ? redondo(gasto / ventasPauta.length) : null,
      retorno_pauta: gasto > 0 ? redondo(ingresosPautaMxn / gasto) : null,
      conversion_pauta: porFuenteLeads.pauta ? redondo(ventasPauta.length / porFuenteLeads.pauta) : null,
      sesiones_para_pagar: ticketBaseMxn ? redondo(presupuestoMes / ticketBaseMxn) : null,
    },
  };
}

// ── Escrituras ──────────────────────────────────────────────────────────────
const limpio = (s, n) => (s == null ? null : String(s).trim().slice(0, n) || null);
const fechaOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);

async function ajustes(request, env) {
  const body = await request.json().catch(() => ({}));
  const cfg = await iniciarCfg(env, await leerCfg(env));
  const nuevo = { ...cfg };
  if (body.presupuesto_diario != null) {
    const n = Math.round(Number(body.presupuesto_diario));
    if (!(n >= 50 && n <= 50000)) return { error: 'El presupuesto diario va de 50 a 50,000 pesos.', status: 400 };
    nuevo.presupuesto_diario = n;
  }
  if (body.tipo_cambio != null) {
    const t = Number(body.tipo_cambio);
    if (!(t > 5 && t < 60)) return { error: 'Ese tipo de cambio no se ve bien.', status: 400 };
    nuevo.tipo_cambio = Math.round(t * 100) / 100; nuevo.tc_manual = true; nuevo.tc_en = hoyCancun();
  }
  if (body.tc_auto === true) { nuevo.tc_manual = false; nuevo.tc_en = null; }
  // Control de meses: gastos fijos, ofrenda y SAT.
  if (Array.isArray(body.gastos)) {
    const lista = body.gastos.slice(0, 40).map((g, i) => ({
      id: limpio(g.id, 30) || `g${Date.now().toString(36)}${i}`,
      nombre: limpio(g.nombre, 60),
      monto: Math.round(Number(g.monto) * 100) / 100,
    })).filter((g) => g.nombre && g.monto >= 0 && g.monto < 10000000);
    nuevo.gastos = lista;
  }
  if (body.ofrenda_pct != null) { const n = Number(body.ofrenda_pct); if (!(n >= 0 && n <= 50)) return { error: 'La ofrenda va de 0 a 50 por ciento.', status: 400 }; nuevo.ofrenda_pct = Math.round(n * 100) / 100; }
  if (body.sat_pct != null) { const n = Number(body.sat_pct); if (!(n >= 0 && n <= 35)) return { error: 'El SAT va de 0 a 35 por ciento.', status: 400 }; nuevo.sat_pct = Math.round(n * 100) / 100; }
  if (Array.isArray(body.empresas)) {
    const lista = body.empresas.slice(0, 30).map((e) => limpio(e, 60)).filter(Boolean);
    if (lista.length) nuevo.empresas = lista;
  }
  if (Array.isArray(body.paquetes)) {
    const lista = body.paquetes.slice(0, 20).map((x, i) => ({
      clave: limpio(x.clave, 30) || (cfg.paquetes[i] && cfg.paquetes[i].clave) || `p${i}`,
      nombre: limpio(x.nombre, 60),
      minutos: Number(x.minutos) || null,
      fotos: limpio(x.fotos, 40),
      precio: Math.round(Number(x.precio) * 100) / 100,
    })).filter((x) => x.nombre && x.precio > 0);
    if (!lista.length) return { error: 'Faltan los paquetes con su precio.', status: 400 };
    nuevo.paquetes = lista;
  }
  await guardarCfg(env, nuevo);
  if (body.presupuesto_diario != null && nuevo.presupuesto_diario !== cfg.presupuesto_diario) await fijarTopeDiario(env, nuevo.presupuesto_diario);
  return { ok: true };
}

async function guardarLead(request, env, session, deps) {
  const b = await request.json().catch(() => ({}));
  const fuente = String(b.fuente || '');
  if (!FUENTES_LEAD.includes(fuente)) return { error: 'Fuente no válida.', status: 400 };
  if (b.conv_id) {
    const v = await env.DB.prepare('SELECT id FROM mkt_conversaciones WHERE id = ? AND client_id = ?').bind(String(b.conv_id), IVAE_STUDIOS).first();
    if (!v) return { error: 'Conversación no encontrada.', status: 404 };
    await env.DB.prepare(
      `INSERT INTO mkt_neg_leads (id, client_id, conv_id, fuente, creado_por) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(conv_id) DO UPDATE SET fuente = excluded.fuente, updated_at = datetime('now')`
    ).bind(deps.randomId(), IVAE_STUDIOS, v.id, fuente, session.name || null).run();
    return { ok: true };
  }
  const nombre = limpio(b.nombre, 120);
  if (!nombre) return { error: 'Escribe el nombre.', status: 400 };
  await env.DB.prepare(
    'INSERT INTO mkt_neg_leads (id, client_id, fecha, nombre, canal, fuente, notas, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(deps.randomId(), IVAE_STUDIOS, fechaOk(b.fecha) || hoyCancun(), nombre, limpio(b.canal, 30) || 'otro', fuente, limpio(b.notas, 500), session.name || null).run();
  return { ok: true };
}

async function borrarLead(env, id) {
  // Una fuente corregida se borra = vuelve a la deducida; un lead a mano se borra.
  const r = await env.DB.prepare('DELETE FROM mkt_neg_leads WHERE client_id = ? AND (id = ? OR conv_id = ?)').bind(IVAE_STUDIOS, id, id).run();
  return (r.meta && r.meta.changes) ? { ok: true } : { error: 'No encontrado.', status: 404 };
}

function camposVenta(b, cfg) {
  const out = {};
  if ('cliente' in b) out.cliente = limpio(b.cliente, 120);
  if ('paquete' in b) out.paquete = limpio(b.paquete, 80);
  // Control de meses: tipo de ingreso, lo que entró en pesos, cómo pagó y de qué empresa.
  if ('tipo' in b) out.tipo = TIPOS_INGRESO.includes(String(b.tipo)) ? String(b.tipo) : undefined;
  if ('monto_mxn' in b) { const n = Number(b.monto_mxn); out.monto_mxn = b.monto_mxn === null || b.monto_mxn === '' ? null : (n >= 0 && n < 10000000 ? Math.round(n * 100) / 100 : undefined); }
  if ('forma_pago' in b) out.forma_pago = b.forma_pago === null || b.forma_pago === '' ? null : (FORMAS_PAGO.includes(String(b.forma_pago)) ? String(b.forma_pago) : undefined);
  if ('empresa' in b) out.empresa = limpio(b.empresa, 80);
  if (out.tipo === 'marca' && !out.cliente && out.empresa) out.cliente = out.empresa;
  if ('precio' in b) { const n = Number(b.precio); out.precio = b.precio === null || b.precio === '' ? null : (n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : undefined); }
  if ('fuente' in b) out.fuente = b.fuente === null || b.fuente === '' ? null : (FUENTES.includes(String(b.fuente)) ? String(b.fuente) : undefined);
  if ('fecha' in b) out.fecha = fechaOk(b.fecha) || undefined;
  if ('fecha_sesion' in b) out.fecha_sesion = b.fecha_sesion ? (fechaOk(b.fecha_sesion) || undefined) : null;
  if ('notas' in b) out.notas = limpio(b.notas, 500);
  if ('estado' in b) out.estado = ['cerrada', 'no_cuenta'].includes(String(b.estado)) ? String(b.estado) : undefined;
  // Paquete nuevo sin precio escrito → el del catálogo.
  if (out.paquete && !('precio' in b)) out.precio = precioDe(out.paquete, cfg);
  return out;
}

async function crearVenta(request, env, session, deps) {
  const b = await request.json().catch(() => ({}));
  const cfg = await leerCfg(env);
  const c = camposVenta(b, cfg);
  if (Object.values(c).includes(undefined)) return { error: 'Revisa los datos.', status: 400 };
  if (!c.cliente) return { error: c.tipo === 'marca' ? 'Elige la empresa.' : 'Escribe el nombre del cliente.', status: 400 };
  if (c.precio == null && c.paquete) c.precio = precioDe(c.paquete, cfg);
  await env.DB.prepare(
    `INSERT INTO mkt_neg_ventas (id, client_id, fecha, fecha_sesion, cliente, paquete, precio, fuente, estado, notas, creado_por, tipo, monto_mxn, forma_pago, empresa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cerrada', ?, ?, ?, ?, ?, ?)`
  ).bind(deps.randomId(), IVAE_STUDIOS, c.fecha || hoyCancun(), c.fecha_sesion || null, c.cliente, c.paquete || null,
    c.precio != null ? c.precio : null, c.fuente || null, c.notas || null, session.name || null,
    c.tipo || 'sesion', c.monto_mxn != null ? c.monto_mxn : null, c.forma_pago || null, c.tipo === 'marca' ? (c.empresa || c.cliente) : null).run();
  return { ok: true };
}

async function editarVenta(request, env, id) {
  const b = await request.json().catch(() => ({}));
  const cfg = await leerCfg(env);
  const c = camposVenta(b, cfg);
  if (Object.values(c).includes(undefined)) return { error: 'Revisa los datos.', status: 400 };
  const claves = Object.keys(c);
  if (!claves.length) return { error: 'Nada que cambiar.', status: 400 };
  const r = await env.DB.prepare(
    `UPDATE mkt_neg_ventas SET ${claves.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND client_id = ?`
  ).bind(...claves.map((k) => c[k]), id, IVAE_STUDIOS).run();
  return (r.meta && r.meta.changes) ? { ok: true } : { error: 'No encontrada.', status: 404 };
}

async function borrarVenta(env, id) {
  // Las de Juan no se borran (volverían en la siguiente sincronización): quedan como "no cuenta".
  const v = await env.DB.prepare('SELECT reserva_id FROM mkt_neg_ventas WHERE id = ? AND client_id = ?').bind(id, IVAE_STUDIOS).first();
  if (!v) return { error: 'No encontrada.', status: 404 };
  if (v.reserva_id) await env.DB.prepare("UPDATE mkt_neg_ventas SET estado = 'no_cuenta', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  else await env.DB.prepare('DELETE FROM mkt_neg_ventas WHERE id = ?').bind(id).run();
  return { ok: true };
}

export async function handleNegocio(request, env, session, path, url, deps) {
  const { json } = deps;
  if (!soloAdmin(session)) return json({ error: 'Forbidden' }, 403);
  const method = request.method;
  const sub = path.slice('/negocio'.length) || '/';
  const responder = (r) => json(r.error ? { error: r.error } : r, r.error ? (r.status || 400) : 200);
  try {
    if (sub === '/resumen' && method === 'GET') return json(await resumen(env, url, deps));
    if (sub === '/ajustes' && method === 'POST') return responder(await ajustes(request, env));
    if (sub === '/leads' && method === 'POST') return responder(await guardarLead(request, env, session, deps));
    let m = sub.match(/^\/leads\/([\w-]{6,80})$/);
    if (m && method === 'DELETE') return responder(await borrarLead(env, m[1]));
    if (sub === '/ventas' && method === 'POST') return responder(await crearVenta(request, env, session, deps));
    m = sub.match(/^\/ventas\/([\w-]{6,80})$/);
    if (m && method === 'PATCH') return responder(await editarVenta(request, env, m[1]));
    if (m && method === 'DELETE') return responder(await borrarVenta(env, m[1]));
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('[negocio]', e && e.stack || e);
    // Nunca 5xx: Cloudflare reemplaza el cuerpo y el motivo se pierde.
    const sinTabla = /no such table/i.test(String(e && e.message));
    return json({ error: sinTabla ? 'Falta crear las tablas de Administración (migración 046).' : 'No se pudo. Reintenta.' }, 422);
  }
}
