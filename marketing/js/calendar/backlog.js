// ============================================================================
// IVAE Marketing v2 — Calendario: backlog "Sin fecha" (panel desktop).
//
// Panel lateral con los posts sin publish_date. Cada tarjeta se arrastra al
// mes o a la semana; el propio panel es target de drop para QUITAR la fecha.
// Fallback sin drag: boton Programar (pickDate) y menu contextual.
//
// En movil el backlog vive dentro de la agenda (agenda.js); este modulo es el
// panel lateral de >= 768px.
// ============================================================================

import { el } from '../api.js?v=202606121328';
import { buildPostCard } from './data.js?v=202606121328';
import { cardDraggable, openCardMenu, reschedule, markDropTarget } from './dnd.js?v=202606121328';
import { openQuickCreate } from './quickcreate.js?v=202606121328';
import * as calState from './state.js?v=202606121328';

/**
 * Renderiza el panel dentro de `asideEl` (lo vacia primero).
 * deps: { posts (backlog filtrado), clientsById, isTodos, disposers }
 */
export function renderBacklog(asideEl, ctx, { posts, clientsById, isTodos, disposers }) {
  while (asideEl.firstChild) asideEl.removeChild(asideEl.firstChild);

  const clientOf = (p) => (isTodos ? clientsById.get(p.client_id) || null : null);

  const head = el('div', { class: 'bk-head' }, [
    ctx.icons('inbox', 18),
    el('h2', { class: 'bk-title', text: 'Sin fecha' }),
    posts.length ? el('span', { class: 'bk-count', text: String(posts.length) }) : null,
    el('button', {
      class: 'bk-close', type: 'button', 'aria-label': 'Cerrar backlog',
      onclick: () => calState.setBacklogOpen(false),
    }, [ctx.icons('close', 16)]),
  ]);

  // El cuerpo es drop target: soltar una tarjeta aqui le quita la fecha.
  const body = el('div', {
    class: 'bk-body',
    'aria-label': 'Backlog sin fecha, suelta aqui para quitar la fecha',
  });
  markDropTarget(body, '');

  if (!posts.length) {
    body.appendChild(el('div', { class: 'bk-empty' }, [
      ctx.icons('inbox', 24),
      el('p', { text: 'No hay contenidos sin fecha.' }),
      el('p', { class: 'bk-empty__hint', text: 'Arrastra una tarjeta del calendario hasta aqui para quitarle la fecha.' }),
    ]));
  } else {
    body.appendChild(el('p', { class: 'bk-hint', text: 'Arrastra una tarjeta a un dia del calendario para programarla.' }));
    for (const p of posts) {
      const card = buildPostCard(ctx, p, {
        client: clientOf(p),
        onMore: (anchor) => openCardMenu(ctx, p, { anchor }),
      });

      // Fallback visible sin drag: Programar via pickDate.
      const schedule = el('button', {
        class: 'bk-schedule', type: 'button',
        'aria-label': `Programar ${p.title || 'contenido'}`,
        onclick: async (e) => {
          e.stopPropagation();
          const picked = await ctx.pickers.pickDate({
            current: null, title: 'Programar para', allowClear: false, anchor: schedule,
          });
          if (picked === null || picked === '') return;
          reschedule(ctx, p.id, picked, '');
        },
      }, [ctx.icons('calendar', 16), el('span', { text: 'Programar' })]);
      card.appendChild(schedule);

      body.appendChild(card);
      disposers.push(cardDraggable(ctx, card, p));
    }
  }

  const foot = el('div', { class: 'bk-foot' }, [
    el('button', {
      class: 'btn bk-new', type: 'button',
      onclick: () => openQuickCreate(ctx, { date: '' }),
    }, [ctx.icons('plus', 16), 'Nuevo sin fecha']),
  ]);

  asideEl.append(head, body, foot);
}
