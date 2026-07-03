// ============================================================================
// IVAE Marketing v2 — Calendario: adaptadores de dominio sobre el motor UNICO
// ui/dnd.js + fallback visible "Mover a" (menu contextual de tarjeta).
//
// Targets de drop: cualquier nodo con [data-cal-drop] y atributo data-day
// ('YYYY-MM-DD', o '' = quitar fecha / mandar al backlog).
//
// Mutacion: store.patchPost (optimista + rollback + toast de error ya
// incluidos). En exito se ofrece Deshacer via toast.
// ============================================================================

import { parseYMD, dayShort, todayYMD } from './data.js?v=202607031415';

export const DROP_SELECTOR = '[data-cal-drop]';

/**
 * Marca un nodo como target de drop del calendario. `day` = 'YYYY-MM-DD' o
 * '' (quitar fecha). setAttribute explicito: un atributo con valor vacio
 * sigue siendo presente para closest('[data-cal-drop]').
 */
export function markDropTarget(node, day) {
  node.setAttribute('data-cal-drop', '');
  node.setAttribute('data-day', day || '');
  return node;
}

// ── Resaltado del target bajo el dedo/cursor ─────────────────────────────────
let overEl = null;

function setOver(node) {
  if (overEl === node) return;
  if (overEl) overEl.classList.remove('is-dropover');
  overEl = node || null;
  if (overEl) overEl.classList.add('is-dropover');
}

// ── Reprogramar (mutacion canonica del calendario) ───────────────────────────
/**
 * Cambia publish_date de un post. newDay '' o null = quitar fecha (backlog).
 * Devuelve true si el server confirmo. En exito muestra toast con Deshacer.
 */
export async function reschedule(ctx, postId, newDay, prevDay) {
  const next = newDay || null;
  const prev = prevDay || null;
  if (next === prev) return false;

  const res = await ctx.store.patchPost(postId, { publish_date: next });
  if (!res) return false; // patchPost ya hizo rollback + toast de error

  const d = next ? parseYMD(next) : null;
  let msg;
  if (!next) msg = 'Enviado a Sin fecha.';
  else if (next === todayYMD()) msg = 'Programado para hoy.';
  else msg = `Movido al ${dayShort(d)}.`;

  ctx.toast(msg, {
    type: 'success',
    action: {
      label: 'Deshacer',
      onAction: () => { ctx.store.patchPost(postId, { publish_date: prev }); },
    },
  });
  return true;
}

// ── Tarjeta arrastrable ──────────────────────────────────────────────────────
/**
 * Hace arrastrable una tarjeta/pill hacia los targets [data-cal-drop].
 * Suprime el click fantasma que sigue a un drag con mouse para que soltar
 * una tarjeta no abra el editor. Devuelve dispose().
 */
export function cardDraggable(ctx, element, post, { scrollEl = null } = {}) {
  let suppressClick = false;

  const onClickCapture = (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
    }
  };
  element.addEventListener('click', onClickCapture, true);

  const armSuppress = () => {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400);
  };

  const prevDay = post.publish_date ? String(post.publish_date).slice(0, 10) : '';

  const disposeDrag = ctx.dnd.draggable(element, {
    mode: 'move',
    data: { id: post.id, day: prevDay },
    dropSelector: DROP_SELECTOR,
    scrollEl: scrollEl || undefined,
    onMove: (c) => setOver(c.over),
    onDrop: (c) => {
      setOver(null);
      armSuppress();
      const target = c.over;
      if (!target || !target.hasAttribute('data-day')) return;
      const day = target.getAttribute('data-day') || '';
      reschedule(ctx, c.data.id, day, c.data.day);
    },
    onCancel: () => {
      setOver(null);
      armSuppress();
    },
  });

  return function dispose() {
    disposeDrag();
    element.removeEventListener('click', onClickCapture, true);
    setOver(null);
  };
}

// ── Fallback visible: menu contextual "Mover a" ──────────────────────────────
/**
 * Menu de tarjeta (tambien sirve como fallback sin drag): abrir, cambiar
 * fecha, cambiar estado, quitar fecha y eliminar.
 */
export function openCardMenu(ctx, post, { anchor = null } = {}) {
  const hasDate = !!post.publish_date;
  const prevDay = hasDate ? String(post.publish_date).slice(0, 10) : '';

  const row = (ic, label, onTap, danger = false) => {
    const span = document.createElement('span');
    span.className = 'acct-row__label';
    span.textContent = label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acct-row' + (danger ? ' acct-row--danger' : '');
    btn.append(ctx.icons(ic, 20), span);
    btn.addEventListener('click', onTap);
    return btn;
  };

  ctx.sheet.openSheet({
    title: post.title || 'Contenido',
    mode: 'menu',
    anchor,
    build(body, close) {
      body.append(
        row('edit', 'Abrir contenido', () => {
          close({ source: 'open' });
          ctx.openEditor(post.id);
        }),
        row('calendar', hasDate ? 'Mover a otra fecha' : 'Programar fecha', async () => {
          close({ source: 'date' });
          const picked = await ctx.pickers.pickDate({
            current: prevDay || null,
            title: 'Mover a',
            allowClear: hasDate,
          });
          if (picked === null) return;       // cancelado
          reschedule(ctx, post.id, picked, prevDay);
        }),
        row('check', 'Cambiar estado', async () => {
          close({ source: 'status' });
          const s = await ctx.pickers.pickStatus({ current: post.status });
          if (s === null || s === post.status) return;
          ctx.store.patchPost(post.id, { status: s });
        }),
        hasDate ? row('inbox', 'Quitar fecha (backlog)', () => {
          close({ source: 'unschedule' });
          reschedule(ctx, post.id, '', prevDay);
        }) : null,
        row('trash', 'Eliminar', () => {
          close({ source: 'delete' });
          confirmDelete(ctx, post);
        }, true),
      );
    },
  });
}

/** Confirmacion explicita antes de borrar (no hay undo de delete). */
export function confirmDelete(ctx, post) {
  ctx.sheet.openSheet({
    title: 'Eliminar contenido',
    mode: 'form',
    build(body, close) {
      const p = document.createElement('p');
      p.className = 'cal-confirm__txt';
      p.textContent = `Se eliminara "${post.title || 'Sin titulo'}" de forma permanente. Esta accion no se puede deshacer.`;

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', () => close({ source: 'cancel' }));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-danger sheet-cta';
      del.textContent = 'Eliminar';
      del.addEventListener('click', async () => {
        del.disabled = true;
        const ok = await ctx.store.removePost(post.id);
        if (ok) {
          ctx.toast('Contenido eliminado.', { type: 'success' });
          close({ source: 'deleted' });
        } else {
          del.disabled = false; // removePost ya mostro el toast de error
        }
      });

      const foot = document.createElement('div');
      foot.className = 'sheet__footer';
      foot.append(cancel, del);
      body.append(p, foot);
    },
  });
}
