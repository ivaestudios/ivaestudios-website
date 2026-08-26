// ============================================================================
// IVAE Marketing — Formato COMPARTIDO del historial de actividad.
//
// Un solo lugar para los verbos del feed, los nombres humanos de los campos
// editados y el texto de los cambios de estado. Lo usan el tab Actividad del
// editor y la sección "Historial de cambios" del calendario (pedido de Vianey
// 2026-08-06: con varias revisoras por marca, ver quién hizo qué y dónde).
// ============================================================================

import { T } from '../shell/i18n.js?v=202608261153';
import { statusLabel } from '../api.js?v=202608261153';

// Verbos del feed en es-MX (espejo de logActivity del backend).
export const ACTION_LABELS = {
  'post.create': T('creo el contenido', 'created the content'),
  'post.update': T('edito el contenido', 'edited the content'),
  'status.change': T('movio el estado', 'moved the status'),
  'post.comment': T('comento', 'commented'),
  'post.approve': T('aprobo', 'approved'),
  'post.request_changes': T('pidio cambios', 'requested changes'),
  'post.publicado': T('publico en Instagram', 'published to Instagram'),
  'post.publicar_error': T('fallo al publicar en Instagram', 'failed to publish to Instagram'),
  'post.delete': T('elimino el contenido', 'deleted the content'),
  'post.duplicate': T('duplico el contenido', 'duplicated the content'),
  'post.reorder': T('reordeno contenidos', 'reordered content'),
  'post.bulk_update': T('edito en lote', 'bulk-edited'),
  'checklist.add': T('agrego un paso a la checklist', 'added a checklist step'),
  'checklist.done': T('completo un paso de la checklist', 'completed a checklist step'),
  'checklist.delete': T('elimino un paso de la checklist', 'deleted a checklist step'),
};

// Campos editables en idioma humano; lo que no está aquí es interno y se calla
// (expected_updated_at, orderings…).
export const CAMPOS = {
  title: T('título', 'title'),
  body: T('guion', 'script'),
  hook: T('hook', 'hook'),
  cta: T('CTA', 'CTA'),
  caption: T('caption', 'caption'),
  hashtags: T('hashtags', 'hashtags'),
  seo_alt: T('alt SEO', 'SEO alt'),
  alt_text: T('alt SEO', 'SEO alt'),
  publish_date: T('fecha de publicación', 'publish date'),
  publish_time: T('hora de publicación', 'publish time'),
  status: T('estado', 'status'),
  content_type: T('tipo de contenido', 'content type'),
  platform: T('plataforma', 'platform'),
  assignee: T('responsable', 'assignee'),
  pillar: T('pilar', 'pillar'),
  notes: T('notas', 'notes'),
  notes_people: T('notas', 'notes'),
  notes_team: T('notas del equipo', 'team notes'),
  grabacion: T('grabación', 'recording'),
  inspo_url: T('inspo', 'inspo'),
  video_url: T('video final', 'final video'),
  client_visible: T('visibilidad', 'visibility'),
};

/** "guion→grabacion" -> "Guion a Grabacion" con labels bonitos. */
export function statusChangeText(detail) {
  const parts = String(detail || '').split('→').map((s) => s.trim());
  if (parts.length === 2) return `${statusLabel(parts[0])} ${T('a', 'to')} ${statusLabel(parts[1])}`;
  return String(detail || '');
}

/** "publish_date,body" -> "fecha de publicación, guion" (interno se calla). */
export function camposHumanos(detail) {
  return String(detail || '').split(',').map((c) => CAMPOS[c.trim()] || null).filter(Boolean).join(', ');
}

/** Detalle corto y humano de un evento del feed ('' si no aporta). */
export function detalleEvento(ev) {
  if (!ev) return '';
  if (ev.action === 'status.change') return statusChangeText(ev.detail);
  if (ev.action === 'post.update') return camposHumanos(ev.detail);
  if (ev.action === 'post.request_changes') return String(ev.detail || '').trim();
  if (ev.action === 'post.comment') return ev.detail === 'internal' ? T('(interno)', '(internal)') : '';
  return '';
}
