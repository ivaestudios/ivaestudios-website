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

import { el, clear, ymd, parseDate, fmtDate, chip, approvalBadge, contentTypeLabel, CONTENT_TYPES } from '../api.js?v=202607042255';
import * as store from './store.js?v=202607042255';
import { ICONS } from './igcard.js?v=202607042255';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let hostEl = null;
let openDetailFn = null;
let unsubs = [];
let mq = null;
let mqHandler = null;

export function mount(host, { onOpenDetail }) {
  hostEl = host;
  openDetailFn = onOpenDetail;
  // Define desktop/movil ANTES del primer render (tabla vs tarjetas).
  mq = window.matchMedia('(min-width: 768px)');
  mqHandler = () => render();
  if (mq.addEventListener) mq.addEventListener('change', mqHandler);
  else mq.addListener(mqHandler);
  render();
  unsubs.push(store.on('month', () => render()));
  unsubs.push(store.on('posts', () => render()));
  unsubs.push(store.on('approval', () => render()));
}

export function unmount() {
  for (const off of unsubs) off();
  unsubs = [];
  if (mq && mqHandler) {
    if (mq.removeEventListener) mq.removeEventListener('change', mqHandler);
    else mq.removeListener(mqHandler);
  }
  mq = null;
  mqHandler = null;
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

  // ── Contenido del mes ──────────────────────────────────────────────────────
  const byDay = store.postsByDay(cursor);
  const monthPosts = [];
  for (const key of [...byDay.keys()].sort()) for (const p of byDay.get(key)) monthPosts.push(p);

  // Encabezado de seccion estilo "JUNIO 2026 · 13" (como el panel del equipo).
  hostEl.append(el('div', { class: 'pcal-sechead' }, [
    el('span', { class: 'pcal-sechead__title', text: label.toUpperCase() }),
    el('span', { class: 'pcal-sechead__count', text: String(monthPosts.length) }),
  ]));

  if (!monthPosts.length) {
    hostEl.append(el('div', { class: 'pagenda-empty empty' }, [
      el('div', { class: 'empty__icon', html: ICONS.calendar }),
      el('h3', { text: 'Sin contenido este mes' }),
      el('p', { text: 'Cuando tu equipo programe contenido para este mes, aparecerá aquí.' }),
    ]));
  } else if (mq && mq.matches) {
    // Desktop: tabla por meses (solo lectura). Toca una fila para ver y aprobar.
    hostEl.append(buildTable(monthPosts));
  } else {
    // Movil: tarjetas compactas (mejor que una tabla a 390px).
    for (const p of monthPosts) hostEl.append(item(p));
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

function buildTable(posts) {
  const head = el('tr', {}, [
    el('th', { class: 'meses-col--task', scope: 'col', text: 'Contenido' }),
    el('th', { scope: 'col', text: 'Tipo' }),
    el('th', { scope: 'col', text: 'Fecha' }),
    el('th', { scope: 'col', text: 'Plataforma' }),
    el('th', { scope: 'col', text: 'Caption' }),
    el('th', { scope: 'col', text: 'Estado' }),
  ]);
  const open = (id) => openDetailFn && openDetailFn(id);
  const rows = posts.map((p) => {
    const cap = p.caption ? (p.caption.length > 80 ? p.caption.slice(0, 80) + '…' : p.caption) : '';
    return el('tr', {
      class: 'meses-row pcal-row', tabindex: '0', role: 'button',
      'aria-label': `${p.title || contentTypeLabel(p.content_type)}, ver y aprobar`,
      onclick: () => open(p.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p.id); } },
    }, [
      el('td', { class: 'meses-td meses-col--task' }, [el('span', { class: 'pcal-task', text: p.title || contentTypeLabel(p.content_type) })]),
      el('td', { class: 'meses-td' }, [chip(p.content_type)]),
      el('td', { class: 'meses-td meses-td--date', text: p.publish_date ? fmtDate(p.publish_date, { day: 'numeric', month: 'long' }) : '—' }),
      el('td', { class: 'meses-td', text: p.platform || '—' }),
      el('td', { class: 'meses-td pcal-caption', text: cap || '—' }),
      el('td', { class: 'meses-td' }, [approvalBadge(p.approval_state)]),
    ]);
  });
  return el('div', { class: 'meses-tablewrap pcal-wrap' }, [
    el('table', { class: 'meses-table' }, [el('thead', {}, [head]), el('tbody', {}, rows)]),
  ]);
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
