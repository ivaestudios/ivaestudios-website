// ============================================================================
// IVAE Marketing v2 — Calendario: vista Semana (desktop >= 768px).
//
// 7 columnas lun-dom con tarjetas completas (el contenido social es por dia,
// no por hora). Cada columna es target de drop; el boton "+ Crear" al pie y
// el click en area vacia abren el quick-create del dia.
// ============================================================================

import { el } from '../api.js?v=202607061600';
import {
  fmtYMD, addDays, startOfWeek, todayYMD, DOW_SHORT, buildPostCard,
} from './data.js?v=202607061600';
import { cardDraggable, openCardMenu, markDropTarget } from './dnd.js?v=202607061600';
import { openQuickCreate } from './quickcreate.js?v=202607061600';

/**
 * Renderiza la semana dentro de `mainEl` (lo vacia primero).
 * deps: { cursor (Date ancla), byDay, clientsById, isTodos, disposers }
 */
export function renderWeek(mainEl, ctx, { cursor, byDay, clientsById, isTodos, disposers }) {
  while (mainEl.firstChild) mainEl.removeChild(mainEl.firstChild);

  const start = startOfWeek(cursor);
  const today = todayYMD();
  const clientOf = (p) => (isTodos ? clientsById.get(p.client_id) || null : null);

  const grid = el('div', { class: 'cal-week', role: 'grid', 'aria-label': 'Semana' });

  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const day = fmtYMD(d);
    const posts = byDay.get(day) || [];
    const isToday = day === today;

    const head = el('div', { class: 'cal-wcol__head' + (isToday ? ' is-today' : '') }, [
      el('span', { class: 'cal-wcol__dow', text: DOW_SHORT[i] }),
      el('span', { class: 'cal-wcol__num', text: String(d.getDate()) }),
    ]);

    const body = el('div', { class: 'cal-wcol__body' });
    for (const p of posts) {
      const card = buildPostCard(ctx, p, {
        client: clientOf(p),
        onMore: (anchor) => openCardMenu(ctx, p, { anchor }),
      });
      body.appendChild(card);
      disposers.push(cardDraggable(ctx, card, p));
    }

    const addBtn = el('button', {
      class: 'cal-wcol__add', type: 'button',
      'aria-label': `Crear contenido el ${day}`,
      onclick: (e) => { e.stopPropagation(); openQuickCreate(ctx, { date: day }); },
    }, [ctx.icons('plus', 16), el('span', { text: 'Crear' })]);
    body.appendChild(addBtn);

    const col = el('div', {
      class: 'cal-wcol' + (isToday ? ' is-today' : ''),
      role: 'gridcell',
      'aria-label': `${DOW_SHORT[i]} ${d.getDate()}, ${posts.length} contenido${posts.length === 1 ? '' : 's'}`,
    }, [head, body]);
    markDropTarget(col, day);

    // Tocar el area vacia de la columna = quick-create de ese dia.
    col.addEventListener('click', (e) => {
      if (e.target.closest('.cal-card, .cal-wcol__add')) return;
      openQuickCreate(ctx, { date: day });
    });

    grid.appendChild(col);
  }

  mainEl.appendChild(grid);
}
