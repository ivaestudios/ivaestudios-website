// ============================================================================
// IVAE Marketing v2 - Vista Tabla: registro de columnas tipadas.
//
// Cada columna es un objeto:
//   { key, label, w (ancho px desktop), defaultVisible, type, sortable,
//     sortValue(post), render(post) -> Node, current(post), patch(value, post) }
//
// type decide que editor abre table.js al hacer click en la celda:
//   'status' | 'date' | 'person' | 'platform' | 'type' | 'grabacion' |
//   'approval' | 'priority' | 'text' | 'url'
//
// Las columnas "Notas <persona>" se generan dinamicamente desde
// client.note_labels (igual que la tabla legacy). El patch de notas manda el
// objeto notes_people COMPLETO tras merge inmutable (contrato del backend).
//
// Agregar una columna nueva = una entrada mas en buildColumns().
// ============================================================================

import {
  el, fmtDate,
  STATUSES, STATUS_ORDER,
  CONTENT_TYPES, CONTENT_TYPE_ORDER,
  APPROVALS, PLATFORMS, GRABACION_LEVELS,
  avatar, statusLabel, contentTypeLabel, approvalLabel,
} from '../api.js?v=202606121319';
import * as apiMod from '../api.js?v=202606121319';
import { icon } from '../shell/icons.js?v=202606121319';
import { isPast } from '../lib/dates.js?v=202606121319';

// Prioridad: usa los mapas de api.js si el shell-core ya los agrego; si no,
// cae a este espejo local (mismas keys que la migracion 005).
export const PRIORITIES = apiMod.PRIORITIES || {
  baja:    { label: 'Baja',    color: '#64748b' },
  media:   { label: 'Media',   color: '#3b82f6' },
  alta:    { label: 'Alta',    color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444' },
};
export const PRIORITY_ORDER = apiMod.PRIORITY_ORDER || ['baja', 'media', 'alta', 'urgente'];

const APPROVAL_ORDER = ['pending', 'changes', 'approved'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve la URL solo si es http(s) valida; si no, null (regla de seguridad). */
export function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* invalida */ }
  return null;
}

export function noteColKey(person) {
  return `nota:${person}`;
}

function notesOf(post) {
  return (post && post.notes_people && typeof post.notes_people === 'object')
    ? post.notes_people
    : {};
}

function low(v) {
  return String(v || '').toLowerCase();
}

function muted(text) {
  return el('span', { class: 'etable-muted', text });
}

function truncText(value, placeholder) {
  const txt = String(value || '').trim();
  if (!txt) return muted(placeholder);
  return el('span', { class: 'etable-trunc', text: txt });
}

// ── Renders por tipo ─────────────────────────────────────────────────────────

function renderStatus(post) {
  const s = post.status;
  const known = !!STATUSES[s];
  return el('span', {
    class: 'etable-st',
    'data-status': known ? s : 'otro',
  }, [
    el('span', { class: 'etable-st__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'etable-st__txt', text: statusLabel(s) || 'Sin estado' }),
  ]);
}

function renderDate(post) {
  if (!post.publish_date) return muted('Sin fecha');
  const overdue = isPast(post.publish_date) && post.status !== 'publicado';
  const node = el('span', {
    class: 'etable-date' + (overdue ? ' is-overdue' : ''),
    title: overdue ? 'Vencido: la fecha ya paso y no esta publicado' : null,
  }, [
    overdue ? icon('warning', 14) : null,
    el('span', { text: fmtDate(post.publish_date) }),
  ]);
  return node;
}

function renderPerson(post) {
  const name = String(post.assignee || '').trim();
  if (!name) return muted('Sin asignar');
  return el('span', { class: 'etable-person' }, [
    avatar(name, true),
    el('span', { class: 'etable-trunc', text: name }),
  ]);
}

function renderApproval(post) {
  const k = post.approval_state;
  const known = !!APPROVALS[k];
  return el('span', { class: 'etable-appr', 'data-approval': known ? k : 'pending' }, [
    el('span', { class: 'etable-appr__dot', 'aria-hidden': 'true' }),
    el('span', { text: approvalLabel(k) || 'Pendiente' }),
  ]);
}

function renderPlatform(post) {
  const p = String(post.platform || '').trim();
  if (!p) return muted('Sin plataforma');
  return el('span', { class: 'etable-trunc', text: p });
}

function renderType(post) {
  const t = post.content_type;
  if (!t) return muted('Sin tipo');
  const def = CONTENT_TYPES[t];
  return el('span', { class: 'etable-ct' }, [
    el('span', {
      class: 'etable-ct__dot', 'aria-hidden': 'true',
      style: { background: (def && def.color) || 'var(--text-mute)' },
    }),
    el('span', { class: 'etable-trunc', text: contentTypeLabel(t) }),
  ]);
}

function renderGrabacion(post) {
  const g = post.grabacion;
  if (g == null || g === '') return muted('Sin nivel');
  return el('span', { class: 'etable-grab', 'data-g': String(g), text: `G${g}` });
}

function renderPriority(post) {
  const k = post.priority || 'media';
  const def = PRIORITIES[k] || PRIORITIES.media;
  return el('span', { class: 'etable-ct' }, [
    el('span', {
      class: 'etable-ct__dot', 'aria-hidden': 'true',
      style: { background: (def && def.color) || 'var(--text-mute)' },
    }),
    el('span', { class: 'etable-trunc', text: (def && def.label) || k }),
  ]);
}

function renderUrl(field, label) {
  return (post) => {
    const url = safeUrl(post[field]);
    if (!url) return muted('Agregar enlace');
    const a = el('a', {
      class: 'etable-link',
      href: url, target: '_blank', rel: 'noopener noreferrer',
      title: url,
    }, [icon('link', 14), el('span', { text: label })]);
    // El click en el enlace NO debe abrir el editor de la celda.
    a.addEventListener('click', (e) => e.stopPropagation());
    return a;
  };
}

// ── Registro ─────────────────────────────────────────────────────────────────

/**
 * Construye el arreglo de columnas para el cliente activo (o null en modo
 * "Todos"): estaticas + una columna de notas por persona en note_labels.
 */
export function buildColumns(client) {
  const cols = [
    {
      key: 'grabacion', label: 'Grabacion', w: 96, defaultVisible: true,
      type: 'grabacion', sortable: true,
      sortValue: (p) => (p.grabacion == null || p.grabacion === '' ? 99 : Number(p.grabacion)),
      render: renderGrabacion,
      current: (p) => p.grabacion,
      patch: (v) => ({ grabacion: v === '' || v == null ? null : Number(v) }),
    },
    {
      key: 'estado', label: 'Estado', w: 132, defaultVisible: true,
      type: 'status', sortable: true,
      sortValue: (p) => {
        const i = STATUS_ORDER.indexOf(p.status);
        return i === -1 ? 99 : i;
      },
      render: renderStatus,
      current: (p) => p.status,
      patch: (v) => ({ status: v }),
    },
    {
      key: 'plataforma', label: 'Plataforma', w: 110, defaultVisible: true,
      type: 'platform', sortable: true,
      sortValue: (p) => low(p.platform) || '~',
      render: renderPlatform,
      current: (p) => p.platform || '',
      patch: (v) => ({ platform: v || null }),
    },
    {
      key: 'tipo', label: 'Tipo', w: 130, defaultVisible: true,
      type: 'type', sortable: true,
      sortValue: (p) => {
        const i = CONTENT_TYPE_ORDER.indexOf(p.content_type);
        return i === -1 ? 99 : i;
      },
      render: renderType,
      current: (p) => p.content_type,
      patch: (v) => ({ content_type: v }),
    },
    {
      key: 'fecha', label: 'Fecha', w: 116, defaultVisible: true,
      type: 'date', sortable: true,
      sortValue: (p) => p.publish_date || '9999-99-99',
      render: renderDate,
      current: (p) => p.publish_date || null,
      patch: (v) => ({ publish_date: v || null }),
    },
    {
      key: 'persona', label: 'Persona', w: 150, defaultVisible: true,
      type: 'person', sortable: true,
      sortValue: (p) => low(p.assignee) || '~',
      render: renderPerson,
      current: (p) => p.assignee || '',
      // v = {user_id, name} del pickPerson. El v1 ignora assignee_user_id.
      patch: (v) => ({ assignee: (v && v.name) || null, assignee_user_id: (v && v.user_id) || null }),
    },
    {
      key: 'aprobacion', label: 'Aprobacion', w: 150, defaultVisible: true,
      type: 'approval', sortable: true,
      sortValue: (p) => {
        const i = APPROVAL_ORDER.indexOf(p.approval_state);
        return i === -1 ? 0 : i;
      },
      render: renderApproval,
      current: (p) => p.approval_state || 'pending',
      patch: null, // la aplica table.js via /approve y /request-changes
    },
    {
      key: 'prioridad', label: 'Prioridad', w: 110, defaultVisible: false,
      type: 'priority', sortable: true,
      sortValue: (p) => {
        const i = PRIORITY_ORDER.indexOf(p.priority || 'media');
        return i === -1 ? 1 : i;
      },
      render: renderPriority,
      current: (p) => p.priority || 'media',
      patch: (v) => ({ priority: v }),
    },
    {
      key: 'caption', label: 'Caption', w: 220, defaultVisible: true,
      type: 'text', sortable: true, maxLength: 4000, multiline: true,
      sortValue: (p) => low(p.caption) || '~',
      render: (p) => truncText(p.caption, 'Agregar caption'),
      current: (p) => p.caption || '',
      patch: (v) => ({ caption: String(v || '').trim() || null }),
    },
  ];

  // Columnas dinamicas: una por persona en note_labels del cliente activo.
  const labels = (client && Array.isArray(client.note_labels)) ? client.note_labels : [];
  for (const person of labels) {
    const name = String(person || '').trim();
    if (!name) continue;
    cols.push({
      key: noteColKey(name), label: `Notas ${name}`, w: 200, defaultVisible: true,
      type: 'text', sortable: true, maxLength: 2000, multiline: true,
      sortValue: (p) => low(notesOf(p)[name]) || '~',
      render: (p) => truncText(notesOf(p)[name], 'Agregar nota'),
      current: (p) => notesOf(p)[name] || '',
      patch: (v, post) => {
        // Merge inmutable: el backend guarda el objeto completo.
        const merged = { ...notesOf(post) };
        const txt = String(v || '').trim();
        if (txt) merged[name] = txt;
        else delete merged[name];
        return { notes_people: merged };
      },
    });
  }

  cols.push(
    {
      key: 'inspo', label: 'Inspo', w: 110, defaultVisible: false,
      type: 'url', urlField: 'inspo_url', sortable: true,
      sortValue: (p) => low(p.inspo_url) || '~',
      render: renderUrl('inspo_url', 'Inspo'),
      current: (p) => p.inspo_url || '',
      patch: (v) => ({ inspo_url: v || null }),
    },
    {
      key: 'video', label: 'Video', w: 110, defaultVisible: false,
      type: 'url', urlField: 'video_url', sortable: true,
      sortValue: (p) => low(p.video_url) || '~',
      render: renderUrl('video_url', 'Video'),
      current: (p) => p.video_url || '',
      patch: (v) => ({ video_url: v || null }),
    },
  );

  return cols;
}

/** Columnas visibles segun la preferencia guardada (null = defaults). */
export function visibleColumns(allCols, savedKeys) {
  if (!Array.isArray(savedKeys)) return allCols.filter((c) => c.defaultVisible);
  const set = new Set(savedKeys);
  const out = allCols.filter((c) => set.has(c.key));
  // Si la pref quedo vacia o solo con keys que ya no existen, cae a defaults.
  return out.length ? out : allCols.filter((c) => c.defaultVisible);
}

/**
 * Valor de orden para una clave de sort. Cubre las columnas del registro y
 * las claves extra 'titulo' y 'posicion' (orden default).
 */
export function sortValueOf(key, post, allCols) {
  if (key === 'titulo') return low(post.title) || '~';
  if (key === 'posicion') return Number(post.position) || 0;
  const def = (allCols || []).find((c) => c.key === key);
  if (def && typeof def.sortValue === 'function') return def.sortValue(post);
  return 0;
}

/** Opciones del sheet "Orden" movil (radio). */
export const MOBILE_SORT_OPTIONS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'estado', label: 'Estado' },
  { key: 'titulo', label: 'Titulo' },
  { key: 'grabacion', label: 'Grabacion' },
  { key: 'posicion', label: 'Posicion' },
];

/** Campos elegibles como chips de la tarjeta movil (max 3). */
export const CARD_FIELDS = [
  { key: 'estado', label: 'Estado' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'aprobacion', label: 'Aprobacion' },
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'grabacion', label: 'Grabacion' },
];
export const DEFAULT_CARD_FIELDS = ['estado', 'fecha', 'aprobacion'];
export const MAX_CARD_FIELDS = 3;

// Re-exports utiles para table.js (un solo punto de verdad).
export {
  STATUSES, STATUS_ORDER, CONTENT_TYPES, CONTENT_TYPE_ORDER,
  APPROVALS, PLATFORMS, GRABACION_LEVELS,
};
