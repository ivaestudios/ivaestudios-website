// Piezas de las LLAMADAS GRABADAS que usan tanto la Bandeja (_bandeja.js)
// como el módulo de llamadas (_llamadas.js). Viven aparte para que ninguno
// de los dos tenga que importar al otro (sin importaciones circulares).

// Estados en los que la llamada sigue viva.
export const ACTIVOS = ['iniciando', 'llamando_agente', 'confirmando', 'llamando_paciente', 'en_curso', 'sonando'];
export const CFG_LINEA_BASE = { aviso: true, desvio: null };

// +52 998 123 4567 (solo para mostrar).
export function fmtTel(e164) {
  const d = String(e164 || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('52')) return `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return d ? '+' + d : '';
}
function parseJson(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

export function lineaConectada(c) {
  return !!(c && c.tw_account_sid && c.tw_auth_token && c.tw_numero);
}
export function cfgLineaDe(c) {
  const x = parseJson(c && c.bandeja_cfg) || {};
  return { ...CFG_LINEA_BASE, ...(x.llamadas || {}) };
}
// Lo que la app sabe de la línea de una marca (nunca las llaves).
export function resumenLinea(c) {
  const cfg = cfgLineaDe(c);
  return {
    conectada: lineaConectada(c),
    numero: c && c.tw_numero ? fmtTel(c.tw_numero) : null,
    entrantes: !!(c && c.tw_numero_sid),
    aviso: cfg.aviso !== false,
    desvio: cfg.desvio ? fmtTel(cfg.desvio) : null,
  };
}

// Lo que ve la app de una llamada (sin llaves, sids ni el celular del agente).
export function llamadaPublica(f, { completa = true } = {}) {
  const t = parseJson(f.transcripcion);
  return {
    id: f.id,
    conv_id: f.conv_id,
    direccion: f.direccion,
    estado: f.estado,
    activa: ACTIVOS.includes(f.estado),
    resultado: f.resultado || null,
    resultado_por: f.resultado_por || null,
    user_id: f.user_id || null,
    user_nombre: f.user_nombre || null,
    numero: fmtTel(f.numero_paciente),
    duracion_seg: Number(f.duracion_seg) || 0,
    grabada: !!f.grabacion_key || !!f.grabacion_sid,
    audio: f.grabacion_key ? `/api/marketing/bandeja/llamadas/${f.id}/audio` : null,
    grabacion_seg: Number(f.grabacion_seg) || 0,
    buzon: !!f.buzon,
    transcripcion_estado: f.transcripcion_estado || null,
    transcripcion_error: f.transcripcion_error || null,
    transcripcion: t ? (completa ? t : { resumen: t.resumen || '', cita: t.cita || '', siguiente_paso: t.siguiente_paso || '', resultado: t.resultado || '' }) : null,
    nota: f.nota || null,
    error: f.error || null,
    creado: f.creado,
    contestada_en: f.contestada_en || null,
    terminada_en: f.terminada_en || null,
    conv_nombre: f.conv_nombre || null,
  };
}
