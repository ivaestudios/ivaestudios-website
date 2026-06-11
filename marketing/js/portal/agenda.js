// ============================================================================
// Portal cliente v2 — Tab Calendario (agenda vertical agrupada por dia).
//
// - Nav mes anterior/siguiente + boton Hoy + label "Junio 2026" aria-live.
// - defaultMonth portado de v1 (primer mes >= hoy con posts con fecha).
// - Item de 60px: barra izquierda con el color del content_type, titulo,
//   chip de tipo, approvalBadge SOLO si pending/changes (los aprobados se
//   ven limpios), chevron. Tap abre el detalle como ruta #post=<id>.
// - NUEVO: seccion fija "Sin fecha (N)" al final (fix del hueco v1 donde un
//   post sin publish_date era inalcanzable para el cliente).
// - El cliente NUNCA ve el status interno del pipeline, solo approval_state.
// ============================================================================

import { el, clear, ymd, parseDate, fmtDate, chip, approvalBadge, contentTypeLabel, CONTENT_TYPES } from '../api.js';
import * as store from './store.js';
import { ICONS } from './igcard.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let hostEl = null;
let openDetailFn = null;
let unsubs = [];

export function mount(host, { onOpenDetail }) {
  hostEl = host;
  openDetailFn = onOpenDetail;
  render();
  unsubs.push(store.on('month', () => render()));
  unsubs.push(store.on('posts', () => render()));
  unsubs.push(store.on('approval', () => render()));
}

export function unmount() {
  for (const off of unsubs) off();
  unsubs = [];
  hostEl = null;
}

function awaiting(p) { return p.approval_state === 'pending' || p.approval_state === 'changes'; }

export function render() {
  if (!hostEl) return;
  clear(hostEl);

  const cursor = store.state.monthCursor || store.startOfMonth(new Date());
  const label = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  // ── Cabecera con navegacion de mes ─────────────────────────────────────────
  hostEl.append(el('div', { class: 'pagenda-head' }, [
    el('h2', { text: 'Tu calendario' }),
    el('div', { class: 'pagenda-nav' }, [
      el('button', {
        class: 'pagenda-nav__btn', type: 'button', 'aria-label': 'Mes anterior',
        html: ICONS.prev, onclick: () => store.shiftMonth(-1),
      }),
      el('span', { class: 'pagenda-month', 'aria-live': 'polite', text: label }),
      el('button', {
        class: 'pagenda-nav__btn', type: 'button', 'aria-label': 'Mes siguiente',
        html: ICONS.next, onclick: () => store.shiftMonth(1),
      }),
      el('button', { class: 'pagenda-today', type: 'button', text: 'Hoy', onclick: () => store.goToday() }),
    ]),
  ]));

  // ── Dias del mes ───────────────────────────────────────────────────────────
  const byDay = store.postsByDay(cursor);
  if (!byDay.size) {
    hostEl.append(el('div', { class: 'pagenda-empty empty' }, [
      el('div', { class: 'empty__icon', html: ICONS.calendar }),
      el('h3', { text: 'Sin contenido este mes' }),
      el('p', { text: 'Cuando tu equipo programe contenido para este mes, aparecerá aquí en orden por fecha.' }),
    ]));
  } else {
    const todayKey = ymd(new Date());
    for (const key of [...byDay.keys()].sort()) {
      const d = parseDate(key);
      const isToday = key === todayKey;
      const group = el('section', { class: 'pday' + (isToday ? ' is-today' : '') });
      group.append(el('div', { class: 'pday__label' }, [
        el('span', { class: 'pday__num', text: String(d.getDate()) }),
        el('span', { text: fmtDate(key, { weekday: 'long' }) }),
        isToday ? el('span', { class: 'pday__today-tag', text: 'Hoy' }) : null,
      ]));
      for (const p of byDay.get(key)) group.append(item(p));
      hostEl.append(group);
    }
  }

  // ── Sin fecha (N): SIEMPRE alcanzables (fix v1) ────────────────────────────
  const undated = store.undatedPosts();
  if (undated.length) {
    const sec = el('section', { class: 'pundated', 'aria-label': 'Contenidos sin fecha' });
    sec.append(el('div', { class: 'pundated__head' }, [
      el('span', { text: 'Sin fecha' }),
      el('span', { class: 'tag', text: String(undated.length) }),
    ]));
    sec.append(el('p', {
      class: 'pundated__hint',
      text: 'Estos contenidos aún no tienen día programado, pero ya puedes revisarlos.',
    }));
    for (const p of undated) sec.append(item(p));
    hostEl.append(sec);
  }
}

function item(p) {
  const color = (CONTENT_TYPES[p.content_type] && CONTENT_TYPES[p.content_type].color) || 'var(--brand)';
  return el('button', {
    class: 'pitem', type: 'button',
    style: { '--ct': color },
    onclick: () => openDetailFn && openDetailFn(p.id),
  }, [
    el('div', { class: 'pitem__body' }, [
      el('div', { class: 'pitem__title', text: p.title || contentTypeLabel(p.content_type) }),
      el('div', { class: 'pitem__meta' }, [
        chip(p.content_type),
        awaiting(p) ? approvalBadge(p.approval_state) : null,
      ]),
    ]),
    el('span', { class: 'pitem__chev', html: ICONS.chevron, 'aria-hidden': 'true' }),
  ]);
}
