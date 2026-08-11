// ============================================================================
// IVAE Marketing — REPORTAR y BLOQUEAR (Apple guideline 1.2).
//
// Apple rechazó la 1.0 el 6-ago-2026 por no tener controles de contenido de
// usuarios. Este módulo es la CARA de esos controles y debe cumplir tres cosas
// que el revisor comprueba con el dedo:
//   1. Todo contenido de otra persona se puede REPORTAR en ≤2 toques.
//   2. A todo autor se le puede BLOQUEAR, y su contenido desaparece AL
//      INSTANTE de la vista de quien bloquea.
//   3. Está disponible para TODOS los roles (la cuenta demo es de cliente).
//
// El backend (POST /reports, POST /blocks) avisa al equipo por correo: la
// política publicada promete resolver en menos de 24 horas.
// ============================================================================

import { api, toast } from '../api.js?v=202608110057';
import { T } from './i18n.js?v=202608110057';
import { pickFrom, confirmar } from './sheet.js?v=202608110057';

const MOTIVOS = [
  { id: 'ofensivo', label: T('Lenguaje ofensivo o insultos', 'Offensive language or insults') },
  { id: 'acoso', label: T('Acoso o amenazas', 'Harassment or threats') },
  { id: 'odio', label: T('Discurso de odio', 'Hate speech') },
  { id: 'sexual', label: T('Contenido sexual o violento', 'Sexual or violent content') },
  { id: 'spam', label: T('Spam o publicidad', 'Spam or advertising') },
  { id: 'otro', label: T('Otro motivo', 'Other reason') },
];

/**
 * Menú de moderación de una pieza de contenido.
 * @param {HTMLElement} anchor  botón que lo abre (la hoja se ancla ahí)
 * @param {{target_type:string,target_id:string,target_author_id:?string,author_name:string,excerpt:string,onBlocked?:Function}} ctx
 */
export async function moderarComentario(anchor, ctx) {
  const quien = ctx.author_name || T('esta persona', 'this person');
  const opciones = [
    { value: 'reportar', label: T('Reportar este contenido', 'Report this content') },
  ];
  // Bloquear exige saber a quién: sin autor identificado no se ofrece.
  if (ctx.target_author_id) {
    opciones.push({ value: 'bloquear', label: T(`Bloquear a ${quien}`, `Block ${quien}`) });
  }
  const elegido = await pickFrom({
    title: T('Reportar o bloquear', 'Report or block'),
    options: opciones,
    anchor,
  });
  if (elegido === 'reportar') return reportar(anchor, ctx);
  if (elegido === 'bloquear') return bloquear(ctx);
  return null;
}

async function reportar(anchor, ctx) {
  const motivo = await pickFrom({
    title: T('¿Por qué lo reportas?', 'Why are you reporting this?'),
    options: MOTIVOS.map((m) => ({ value: m.id, label: m.label })),
    anchor,
  });
  if (!motivo) return null;
  try {
    await api.post('/reports', {
      target_type: ctx.target_type,
      target_id: ctx.target_id,
      target_author_id: ctx.target_author_id || null,
      target_excerpt: String(ctx.excerpt || '').slice(0, 400),
      reason: motivo,
    });
    toast(T('Reporte enviado. Lo revisamos en menos de 24 horas.',
      'Report sent. We review it within 24 hours.'), 'success', 4200);
    return 'reported';
  } catch (e) {
    toast((e && e.message) || T('No se pudo enviar el reporte.', 'Could not send the report.'), 'error');
    return null;
  }
}

async function bloquear(ctx) {
  const quien = ctx.author_name || T('esta persona', 'this person');
  const ok = await confirmar({
    title: T(`¿Bloquear a ${quien}?`, `Block ${quien}?`),
    accion: T('Sí, bloquear', 'Yes, block'),
  });
  if (!ok) return null;
  try {
    await api.post('/blocks', { user_id: ctx.target_author_id, name: ctx.author_name || '' });
    toast(T(`Bloqueaste a ${quien}. Ya no verás su contenido.`,
      `You blocked ${quien}. You won't see their content.`), 'success', 4200);
    // Apple exige que desaparezca AL INSTANTE, sin recargar: se quitan del DOM
    // todos los mensajes de esa persona antes de que vuelva el servidor.
    try {
      document.querySelectorAll(`[data-author-id="${ctx.target_author_id}"]`).forEach((n) => n.remove());
    } catch { /* noop */ }
    if (typeof ctx.onBlocked === 'function') ctx.onBlocked();
    else setTimeout(() => location.reload(), 700);
    return 'blocked';
  } catch (e) {
    toast((e && e.message) || T('No se pudo bloquear.', 'Could not block.'), 'error');
    return null;
  }
}

/** Pantalla "Personas bloqueadas" (desde el menú de cuenta): ver y desbloquear. */
export async function abrirBloqueados() {
  let lista = [];
  try { lista = (await api.get('/blocks')).blocks || []; }
  catch { toast(T('No se pudo cargar la lista.', 'Could not load the list.'), 'error'); return; }

  if (!lista.length) {
    await pickFrom({
      title: T('Personas bloqueadas', 'Blocked people'),
      options: [{ value: 'x', label: T('No has bloqueado a nadie.', "You haven't blocked anyone.") }],
    });
    return;
  }
  const elegido = await pickFrom({
    title: T('Personas bloqueadas', 'Blocked people'),
    options: lista.map((b) => ({
      value: b.blocked_user_id,
      label: T(`Desbloquear a ${b.name}`, `Unblock ${b.name}`),
    })),
  });
  if (!elegido) return;
  try {
    await api.del(`/blocks/${elegido}`);
    toast(T('Desbloqueado.', 'Unblocked.'), 'success');
    setTimeout(() => location.reload(), 600);
  } catch (e) {
    toast((e && e.message) || T('No se pudo desbloquear.', 'Could not unblock.'), 'error');
  }
}
