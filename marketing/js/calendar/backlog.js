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

import { el } from '../api.js?v=202607220055';
import { T } from '../shell/i18n.js?v=202607220055';
import { buildPostCard } from './data.js?v=202607220055';
import { cardDraggable, openCardMenu, reschedule, markDropTarget } from './dnd.js?v=202607220055';
import { openQuickCreate } from './quickcreate.js?v=202607220055';
import * as calState from './state.js?v=202607220055';

/**
 * Renderiza el panel dentro de `asideEl` (lo vacia primero).
 * deps: { posts (backlog filtrado), clientsById, isTodos, disposers }
 */
export function renderBacklog(asideEl, ctx, { posts, clientsById, isTodos, disposers }) {
  while (asideEl.firstChild) asideEl.removeChild(asideEl.firstChild);

  const clientOf = (p) => (isTodos ? clientsById.get(p.client_id) || null : null);

  const head = el('div', { class: 'bk-head' }, [
    ctx.icons('inbox', 18),
    el('h2', { class: 'bk-title', text: T('Sin fecha', 'No date') }),
    posts.length ? el('span', { class: 'bk-count', text: String(posts.length) }) : null,
    el('button', {
      class: 'bk-close', type: 'button', 'aria-label': T('Cerrar backlog', 'Close backlog'),
      onclick: () => calState.setBacklogOpen(false),
    }, [ctx.icons('close', 16)]),
  ]);

  // El cuerpo es drop target: soltar una tarjeta aqui le quita la fecha.
  const body = el('div', {
    class: 'bk-body',
    'aria-label': T('Backlog sin fecha, suelta aqui para quitar la fecha', 'Unscheduled backlog, drop here to remove the date'),
  });
  markDropTarget(body, '');

  if (!posts.length) {
    body.appendChild(el('div', { class: 'bk-empty' }, [
      ctx.icons('inbox', 24),
      el('p', { text: T('No hay contenidos sin fecha.', 'No unscheduled content.') }),
      el('p', { class: 'bk-empty__hint', text: T('Arrastra una tarjeta del calendario hasta aqui para quitarle la fecha.', 'Drag a card from the calendar here to remove its date.') }),
    ]));
  } else {
    body.appendChild(el('p', { class: 'bk-hint', text: T('Arrastra una tarjeta a un dia del calendario para programarla.', 'Drag a card onto a calendar day to schedule it.') }));
    for (const p of posts) {
      const card = buildPostCard(ctx, p, {
        client: clientOf(p),
        onMore: (anchor) => openCardMenu(ctx, p, { anchor }),
      });

      // Fallback visible sin drag: Programar via pickDate.
      const schedule = el('button', {
        class: 'bk-schedule', type: 'button',
        'aria-label': `${T('Programar', 'Schedule')} ${p.title || T('contenido', 'content')}`,
        onclick: async (e) => {
          e.stopPropagation();
          const picked = await ctx.pickers.pickDate({
            current: null, title: T('Programar para', 'Schedule for'), allowClear: false, anchor: schedule,
          });
          if (picked === null || picked === '') return;
          reschedule(ctx, p.id, picked, '');
        },
      }, [ctx.icons('calendar', 16), el('span', { text: T('Programar', 'Schedule') })]);
      card.appendChild(schedule);

      body.appendChild(card);
      disposers.push(cardDraggable(ctx, card, p));
    }
  }

  const foot = el('div', { class: 'bk-foot' }, [
    el('button', {
      class: 'btn bk-new', type: 'button',
      onclick: () => openQuickCreate(ctx, { date: '' }),
    }, [ctx.icons('plus', 16), T('Nuevo sin fecha', 'New without date')]),
  ]);

  asideEl.append(head, body, foot);
}
