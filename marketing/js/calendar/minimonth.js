// ============================================================================
// IVAE Marketing v2 — Calendario: mini-mes navegable (agenda movil).
//
// - Grid 7 columnas, celdas >= 44px, dots de status por dia (max 3).
// - Cada celda es target de drop ([data-cal-drop][data-day]): arrastrar una
//   tarjeta de la agenda o del backlog sobre un dia la reprograma.
// - Navegacion: chevrons + swipe horizontal (umbral 48px).
// ============================================================================

import { el } from '../api.js?v=202606110024';
import {
  fmtYMD, addMonths, startOfMonth, monthMatrix,
  sameMonth, monthTitle, dayLong, todayYMD, statusInfo, DOW_MIN,
} from './data.js?v=202606110024';
import { markDropTarget } from './dnd.js?v=202606110024';

/**
 * Renderiza el mini-mes dentro de `wrap` (lo vacia primero).
 * opts: { cursor (Date del mes), selectedDay, byDay (Map ymd->posts),
 *         onPick(ymd), onMonth(DateNuevoMes) }
 */
export function renderMiniMonth(wrap, ctx, { cursor, selectedDay, byDay, onPick, onMonth }) {
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  wrap.classList.add('mini');

  const monthStart = startOfMonth(cursor);
  const today = todayYMD();

  // ── Header: ‹ Mes Año › ────────────────────────────────────────────────────
  const head = el('div', { class: 'mini__head' }, [
    el('button', {
      class: 'mini__nav', type: 'button', 'aria-label': 'Mes anterior',
      onclick: () => onMonth(addMonths(monthStart, -1)),
    }, [ctx.icons('left', 18)]),
    el('span', { class: 'mini__title', text: monthTitle(monthStart), 'aria-live': 'polite' }),
    el('button', {
      class: 'mini__nav', type: 'button', 'aria-label': 'Mes siguiente',
      onclick: () => onMonth(addMonths(monthStart, 1)),
    }, [ctx.icons('right', 18)]),
  ]);

  // ── Grid ───────────────────────────────────────────────────────────────────
  const grid = el('div', { class: 'mini__grid', role: 'grid', 'aria-label': monthTitle(monthStart) });
  for (let i = 0; i < 7; i++) {
    grid.appendChild(el('span', { class: 'mini__dow', text: DOW_MIN[i], 'aria-hidden': 'true' }));
  }

  for (const week of monthMatrix(monthStart)) {
    for (const d of week) {
      const day = fmtYMD(d);
      const posts = byDay.get(day) || [];
      const isOut = !sameMonth(d, monthStart);

      const dots = el('span', { class: 'mini__dots', 'aria-hidden': 'true' });
      for (const p of posts.slice(0, 3)) {
        dots.appendChild(el('span', {
          class: 'mini__dot',
          style: { background: statusInfo(p.status).color },
        }));
      }

      const cell = el('button', {
        class: 'mini__day'
          + (isOut ? ' is-out' : '')
          + (day === today ? ' is-today' : '')
          + (day === selectedDay ? ' is-selected' : ''),
        type: 'button',
        'aria-label': `${dayLong(d)}${posts.length ? `, ${posts.length} contenido${posts.length === 1 ? '' : 's'}` : ''}`,
        'aria-pressed': day === selectedDay ? 'true' : 'false',
        onclick: () => onPick(day),
      }, [
        el('span', { class: 'mini__num', text: String(d.getDate()) }),
        dots,
      ]);
      markDropTarget(cell, day);
      grid.appendChild(cell);
    }
  }

  // ── Swipe horizontal para cambiar de mes ───────────────────────────────────
  let swipeX = null, swipeY = null, swiped = false;
  grid.addEventListener('pointerdown', (e) => {
    swipeX = e.clientX; swipeY = e.clientY; swiped = false;
  });
  grid.addEventListener('pointerup', (e) => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX;
    const dy = e.clientY - swipeY;
    swipeX = swipeY = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      onMonth(addMonths(monthStart, dx < 0 ? 1 : -1));
    }
  });
  // Un swipe no debe disparar el click del dia donde termino el gesto.
  grid.addEventListener('click', (e) => {
    if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, true);

  wrap.append(head, grid);
}
