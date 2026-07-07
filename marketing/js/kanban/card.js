// ============================================================================
// IVAE Marketing v2 — Kanban: tarjeta (estilo Monday, mobile-first 390px).
//
// createCard({ post, color, fields, client, onOpen, onMenu }) -> <article>
//   - post:   shapePost del store.
//   - color:  color de la columna (franja izquierda de la tarjeta).
//   - fields: que campos se muestran (pref 'cardFields'); ver DEFAULT_CARD_FIELDS.
//   - client: {name, color} cuando el tablero esta en "Todos los clientes".
//   - onOpen: tap en el cuerpo (abre el editor).
//   - onMenu: tap en el boton de opciones (menu contextual / Mover a).
//
// La tarjeta NO muta nada por si misma: el dueño decide. touch-action
// 'pan-x pan-y' para que el scroll del tablero siga funcionando y el motor
// dnd inicie el drag con long-press.
// ============================================================================

import {
  el,
  CONTENT_TYPES, APPROVALS, PRIORITIES,
  fmtDate, parseDate, avatar,
} from '../api.js?v=202607071200';
import { icon } from '../shell/icons.js?v=202607071200';

export const DEFAULT_CARD_FIELDS = {
  fecha: true,
  tipo: true,
  plataforma: true,
  persona: true,
  aprobacion: true,
  prioridad: true,
};

export const CARD_FIELD_LABELS = {
  fecha: 'Fecha de publicacion',
  tipo: 'Tipo de contenido',
  plataforma: 'Plataforma',
  persona: 'Responsable',
  aprobacion: 'Aprobacion del cliente',
  prioridad: 'Prioridad',
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

/** 'overdue' | 'today' | null segun publish_date vs hoy (zona local). */
export function dateState(post) {
  const d = parseDate(post && post.publish_date);
  if (!d) return null;
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (a < b) return 'overdue';
  if (a === b) return 'today';
  return null;
}

/** Valor de aprobacion tolerante a nombre de campo (legacy vs v2). */
function approvalOf(post) {
  const k = post.approval ?? post.client_approval ?? post.approval_status ?? null;
  return (k && APPROVALS && APPROVALS[k]) ? { key: k, ...APPROVALS[k] } : null;
}

export function createCard({ post, color, fields = DEFAULT_CARD_FIELDS, client = null, onOpen, onMenu }) {
  const f = { ...DEFAULT_CARD_FIELDS, ...(fields || {}) };

  // ── Meta superior: cliente (solo en "Todos") ───────────────────────────────
  const clientRow = client ? el('span', { class: 'kb-card__client' }, [
    el('span', { class: 'kb-card__clientdot', style: { background: safeColor(client.color) } }),
    el('span', { class: 'kb-card__clientname', text: client.name || '' }),
  ]) : null;

  // ── Chips de meta ──────────────────────────────────────────────────────────
  const chips = [];
  if (f.tipo && post.content_type) {
    const t = CONTENT_TYPES && CONTENT_TYPES[post.content_type];
    const typeChip = el('span', {
      class: 'kb-chip',
      text: (t && t.label) || post.content_type,
    });
    if (t && t.color) {
      typeChip.style.color = t.color;
      typeChip.style.borderColor = 'currentColor';
    }
    chips.push(typeChip);
  }
  if (f.plataforma && post.platform) {
    chips.push(el('span', { class: 'kb-chip kb-chip--plat', text: post.platform }));
  }
  const ap = f.aprobacion ? approvalOf(post) : null;
  if (ap) {
    chips.push(el('span', { class: 'kb-chip kb-chip--ap' }, [
      el('span', { class: 'kb-chip__dot', style: { background: ap.color || 'var(--text-mute)' } }),
      el('span', { text: ap.label || ap.key }),
    ]));
  }

  // ── Pie: fecha + prioridad + responsable ───────────────────────────────────
  const foot = [];
  if (f.fecha) {
    const ds = dateState(post);
    foot.push(el('span', {
      class: 'kb-card__date' +
        (ds === 'overdue' ? ' is-overdue' : '') +
        (ds === 'today' ? ' is-today' : '') +
        (!post.publish_date ? ' is-empty' : ''),
    }, [
      icon('calendar', 13),
      el('span', { text: post.publish_date ? fmtDate(post.publish_date) : 'Sin fecha' }),
    ]));
  }
  const pr = (f.prioridad && post.priority && PRIORITIES && PRIORITIES[post.priority])
    ? PRIORITIES[post.priority] : null;
  if (pr) {
    foot.push(el('span', {
      class: 'kb-card__prio',
      style: { background: pr.color || 'var(--text-mute)' },
      title: `Prioridad: ${pr.label}`,
      'aria-label': `Prioridad: ${pr.label}`,
    }));
  }
  foot.push(el('span', { class: 'kb-card__spacer' }));
  if (f.persona && post.assignee) {
    const av = el('span', { class: 'kb-card__avatar', title: post.assignee }, [avatar(post.assignee, true)]);
    foot.push(av);
  }

  // ── Cuerpo clickeable (abre el editor) ─────────────────────────────────────
  const main = el('button', {
    class: 'kb-card__open',
    type: 'button',
    'aria-label': `Abrir ${post.title || 'contenido sin titulo'}`,
    onclick: () => { try { onOpen?.(post); } catch (e) { console.error('[kanban] card onOpen', e); } },
  }, [
    clientRow,
    el('span', { class: 'kb-card__title', text: post.title || 'Sin titulo' }),
    chips.length ? el('span', { class: 'kb-card__chips' }, chips) : null,
    foot.length > 1 ? el('span', { class: 'kb-card__foot' }, foot) : null,
  ]);

  const menuBtn = el('button', {
    class: 'kb-card__menu',
    type: 'button',
    'aria-label': `Opciones de ${post.title || 'contenido'}`,
    'aria-haspopup': 'dialog',
    onclick: (e) => {
      e.stopPropagation();
      try { onMenu?.(post, menuBtn); } catch (err) { console.error('[kanban] card onMenu', err); }
    },
  }, [icon('dots', 18)]);

  const card = el('article', {
    class: 'kb-card',
    dataset: { id: String(post.id) },
  }, [
    el('span', { class: 'kb-card__edge', style: { background: color || 'var(--text-mute)' }, 'aria-hidden': 'true' }),
    main,
    menuBtn,
  ]);
  // Scroll horizontal del tablero y vertical de la columna siguen vivos;
  // el drag inicia por long-press (motor ui/dnd.js).
  card.style.touchAction = 'pan-x pan-y';
  return card;
}
