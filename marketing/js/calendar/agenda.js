// ============================================================================
// IVAE Marketing v2 — Calendario: agenda por dia (layout movil, 390px primero).
//
// mini-mes navegable arriba (colapsable) + tira del dia (‹ dia ›) + tarjetas
// del dia + seccion backlog "Sin fecha". Las tarjetas se arrastran (long
// press) y se sueltan sobre el mini-mes o sobre los chevrons de dia; el menu
// de tarjeta es el fallback sin drag.
// ============================================================================

import { el } from '../api.js?v=202606111127';
import {
  fmtYMD, parseYMD, addDays, dayLong, todayYMD, buildPostCard,
} from './data.js?v=202606111127';
import { renderMiniMonth } from './minimonth.js?v=202606111127';
import { cardDraggable, openCardMenu, markDropTarget } from './dnd.js?v=202606111127';
import { openQuickCreate } from './quickcreate.js?v=202606111127';
import * as calState from './state.js?v=202606111127';

/**
 * Renderiza la agenda dentro de `mainEl` (lo vacia primero).
 * deps: { byDay (Map), backlog (posts sin fecha filtrados), clientsById,
 *         isTodos, disposers (array donde registrar dispose de dnd) }
 */
export function renderAgenda(mainEl, ctx, { byDay, backlog, clientsById, isTodos, disposers }) {
  while (mainEl.firstChild) mainEl.removeChild(mainEl.firstChild);
  const st = calState.get();
  const selected = st.selectedDay;
  const selectedDate = parseYMD(selected) || new Date();

  const clientOf = (p) => (isTodos ? clientsById.get(p.client_id) || null : null);

  // ── Mini-mes (colapsable) ────────────────────────────────────────────────
  const miniToggle = el('button', {
    class: 'ag-minitoggle', type: 'button',
    'aria-expanded': st.miniOpen ? 'true' : 'false',
    onclick: () => calState.setMiniOpen(!calState.get().miniOpen),
  }, [
    ctx.icons(st.miniOpen ? 'up' : 'down', 16),
    el('span', { text: st.miniOpen ? 'Ocultar mes' : 'Ver mes' }),
  ]);

  const miniWrap = el('div', { class: 'ag-mini' });
  if (st.miniOpen) {
    renderMiniMonth(miniWrap, ctx, {
      cursor: st.cursor,
      selectedDay: selected,
      byDay,
      onPick: (day) => calState.selectDay(day),
      onMonth: (d) => calState.patch({ cursor: d }),
    });
  } else {
    miniWrap.hidden = true;
  }

  // ── Tira del dia (‹ dia ›); los chevrons tambien aceptan drops ───────────
  const prevDay = fmtYMD(addDays(selectedDate, -1));
  const nextDay = fmtYMD(addDays(selectedDate, 1));
  const isToday = selected === todayYMD();

  const prevBtn = el('button', {
    class: 'ag-strip__nav', type: 'button',
    'aria-label': 'Dia anterior',
    onclick: () => calState.selectDay(prevDay),
  }, [ctx.icons('left', 20)]);
  markDropTarget(prevBtn, prevDay);

  const nextBtn = el('button', {
    class: 'ag-strip__nav', type: 'button',
    'aria-label': 'Dia siguiente',
    onclick: () => calState.selectDay(nextDay),
  }, [ctx.icons('right', 20)]);
  markDropTarget(nextBtn, nextDay);

  const strip = el('div', { class: 'ag-strip' }, [
    prevBtn,
    el('div', { class: 'ag-strip__mid' }, [
      el('span', { class: 'ag-strip__day', text: dayLong(selectedDate) }),
      isToday
        ? el('span', { class: 'ag-strip__todaytag', text: 'Hoy' })
        : el('button', {
          class: 'ag-strip__today', type: 'button', text: 'Ir a hoy',
          onclick: () => calState.goToday(),
        }),
    ]),
    nextBtn,
  ]);

  // ── Tarjetas del dia ──────────────────────────────────────────────────────
  const posts = byDay.get(selected) || [];
  const list = el('div', { class: 'ag-list', role: 'list' });

  if (!posts.length) {
    list.appendChild(el('div', { class: 'ag-empty' }, [
      ctx.icons('calendar', 26),
      el('p', { text: 'Nada programado este dia.' }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Crear contenido',
        onclick: () => openQuickCreate(ctx, { date: selected }),
      }),
    ]));
  } else {
    for (const p of posts) {
      const card = buildPostCard(ctx, p, {
        client: clientOf(p),
        onMore: (anchor) => openCardMenu(ctx, p, { anchor }),
      });
      card.setAttribute('role', 'listitem');
      list.appendChild(card);
      disposers.push(cardDraggable(ctx, card, p));
    }
  }

  // ── Backlog: Sin fecha ────────────────────────────────────────────────────
  const bkOpen = st.backlogOpen;
  const bkHead = el('button', {
    class: 'ag-bk__head', type: 'button',
    'aria-expanded': bkOpen ? 'true' : 'false',
    onclick: () => calState.setBacklogOpen(!calState.get().backlogOpen),
  }, [
    ctx.icons('inbox', 18),
    el('span', { class: 'ag-bk__title', text: 'Sin fecha' }),
    backlog.length ? el('span', { class: 'ag-bk__count', text: String(backlog.length) }) : null,
    ctx.icons(bkOpen ? 'up' : 'down', 16),
  ]);

  // La zona del backlog tambien es target: soltar aqui quita la fecha.
  const bkBody = el('div', { class: 'ag-bk__body' });
  markDropTarget(bkBody, '');
  if (bkOpen) {
    if (!backlog.length) {
      bkBody.appendChild(el('p', { class: 'ag-bk__empty', text: 'No hay contenidos sin fecha. Arrastra uno aqui para quitarle la fecha.' }));
    } else {
      bkBody.appendChild(el('p', { class: 'ag-bk__hint', text: 'Manten presionada una tarjeta y suelta sobre un dia del mes para programarla.' }));
      for (const p of backlog) {
        const card = buildPostCard(ctx, p, {
          client: clientOf(p),
          onMore: (anchor) => openCardMenu(ctx, p, { anchor }),
        });
        bkBody.appendChild(card);
        disposers.push(cardDraggable(ctx, card, p));
      }
    }
  } else {
    bkBody.hidden = true;
  }

  const bk = el('section', { class: 'ag-bk', 'aria-label': 'Contenidos sin fecha' }, [bkHead, bkBody]);

  mainEl.append(miniToggle, miniWrap, strip, list, bk);
}
