// ============================================================================
// IVAE Marketing v2 — Calendario: vista Mes (desktop >= 768px, flagship).
//
// Grid 7xN. Cada celda: numero de dia + hasta 3 pills por status (label
// textual, jamas solo color) + "+N mas" que abre el sheet del dia. Tocar el
// area vacia de una celda abre el quick-create con esa fecha. Las pills se
// arrastran entre celdas (motor ui/dnd.js).
// ============================================================================

import { el, statusBadge } from '../api.js?v=202606200300';
import {
  fmtYMD, startOfMonth, monthMatrix, sameMonth, todayYMD,
  dayLong, statusInfo, clientDotEl, DOW_SHORT,
} from './data.js?v=202606200300';
import { cardDraggable, openCardMenu, reschedule, markDropTarget } from './dnd.js?v=202606200300';
import { openQuickCreate } from './quickcreate.js?v=202606200300';

const MAX_PILLS = 3;

/**
 * Renderiza el mes dentro de `mainEl` (lo vacia primero).
 * deps: { cursor (Date), byDay, clientsById, isTodos, disposers }
 */
export function renderMonth(mainEl, ctx, { cursor, byDay, clientsById, isTodos, disposers }) {
  while (mainEl.firstChild) mainEl.removeChild(mainEl.firstChild);

  const monthStart = startOfMonth(cursor);
  const today = todayYMD();
  const clientOf = (p) => (isTodos ? clientsById.get(p.client_id) || null : null);

  const wrap = el('div', { class: 'cal-month' });

  // Header de dias de la semana.
  const head = el('div', { class: 'cal-mhead', 'aria-hidden': 'true' });
  for (const dow of DOW_SHORT) head.appendChild(el('span', { class: 'cal-mhead__dow', text: dow }));
  wrap.appendChild(head);

  const grid = el('div', { class: 'cal-mgrid', role: 'grid', 'aria-label': 'Mes' });

  for (const week of monthMatrix(monthStart)) {
    for (const d of week) {
      const day = fmtYMD(d);
      const posts = byDay.get(day) || [];
      const isOut = !sameMonth(d, monthStart);
      const isToday = day === today;

      const cellHead = el('div', { class: 'cal-mcell__head' }, [
        el('span', { class: 'cal-mcell__num' + (isToday ? ' is-today' : ''), text: String(d.getDate()) }),
        el('button', {
          class: 'cal-mcell__add', type: 'button',
          'aria-label': `Crear contenido el ${dayLong(d)}`,
          onclick: (e) => { e.stopPropagation(); openQuickCreate(ctx, { date: day }); },
        }, [ctx.icons('plus', 14)]),
      ]);

      const pillsWrap = el('div', { class: 'cal-mcell__pills' });
      for (const p of posts.slice(0, MAX_PILLS)) {
        const pill = buildPill(ctx, p, clientOf(p));
        pillsWrap.appendChild(pill);
        disposers.push(cardDraggable(ctx, pill, p));
      }
      if (posts.length > MAX_PILLS) {
        pillsWrap.appendChild(el('button', {
          class: 'cal-more', type: 'button',
          text: `+${posts.length - MAX_PILLS} mas`,
          onclick: (e) => { e.stopPropagation(); openDaySheet(ctx, d, posts, clientsById, isTodos); },
        }));
      }

      const cell = el('div', {
        class: 'cal-mcell'
          + (isOut ? ' is-out' : '')
          + (isToday ? ' is-today' : ''),
        role: 'gridcell',
        'aria-label': `${dayLong(d)}, ${posts.length} contenido${posts.length === 1 ? '' : 's'}`,
      }, [cellHead, pillsWrap]);
      markDropTarget(cell, day);

      // Tocar el area vacia del dia = quick-create con esa fecha.
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.cal-pill, .cal-more, .cal-mcell__add')) return;
        openQuickCreate(ctx, { date: day });
      });

      grid.appendChild(cell);
    }
  }

  wrap.appendChild(grid);
  mainEl.appendChild(wrap);
}

// ── Pill de post (densidad mes): status SIEMPRE con label textual ────────────
function buildPill(ctx, post, client) {
  const info = statusInfo(post.status);
  return el('button', {
    class: 'cal-pill',
    type: 'button',
    style: { '--pill-color': info.color },
    dataset: { id: post.id },
    'aria-label': `${post.title || 'Sin titulo'}, ${info.label}`,
    title: `${post.title || 'Sin titulo'} (${info.label})`,
    onclick: (e) => { e.stopPropagation(); ctx.openEditor(post.id); },
  }, [
    client ? clientDotEl(client) : null,
    el('span', { class: 'cal-pill__status', text: info.label }),
    el('span', { class: 'cal-pill__title', text: post.title || 'Sin titulo' }),
  ]);
}

// ── Sheet del dia ("+N mas"): lista completa + crear + fallback mover ────────
function openDaySheet(ctx, dateObj, posts, clientsById, isTodos) {
  const day = fmtYMD(dateObj);
  ctx.sheet.openSheet({
    title: dayLong(dateObj),
    mode: 'menu',
    build(body, close) {
      const list = el('div', { class: 'cal-daysheet', role: 'list' });
      for (const p of posts) {
        const info = statusInfo(p.status);
        const row = el('div', { class: 'cal-daysheet__row', role: 'listitem' }, [
          el('button', {
            class: 'cal-daysheet__main', type: 'button',
            onclick: () => { close({ source: 'open' }); ctx.openEditor(p.id); },
          }, [
            el('span', { class: 'cal-daysheet__bar', style: { background: info.color }, 'aria-hidden': 'true' }),
            isTodos ? clientDotEl(clientsById.get(p.client_id) || null) : null,
            el('span', { class: 'cal-daysheet__title', text: p.title || 'Sin titulo' }),
            p.status ? statusBadge(p.status) : null,
          ]),
          el('button', {
            class: 'cal-daysheet__move', type: 'button',
            'aria-label': `Mover ${p.title || 'contenido'} a otra fecha`,
            onclick: async (e) => {
              e.stopPropagation();
              close({ source: 'move' });
              const prev = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
              const picked = await ctx.pickers.pickDate({ current: prev || null, title: 'Mover a', allowClear: true });
              if (picked === null) return;
              reschedule(ctx, p.id, picked, prev);
            },
          }, [ctx.icons('calendar', 18)]),
          el('button', {
            class: 'cal-daysheet__more', type: 'button',
            'aria-label': `Opciones de ${p.title || 'contenido'}`,
            onclick: (e) => {
              e.stopPropagation();
              close({ source: 'menu' });
              openCardMenu(ctx, p);
            },
          }, [ctx.icons('dots', 18)]),
        ]);
        list.appendChild(row);
      }
      body.append(
        list,
        el('button', {
          class: 'btn btn-primary cal-daysheet__new', type: 'button',
          onclick: () => { close({ source: 'create' }); openQuickCreate(ctx, { date: day }); },
        }, [ctx.icons('plus', 18), 'Crear contenido']),
      );
    },
  });
}
