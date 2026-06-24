// ============================================================================
// IVAE Marketing v2 - Vista Tabla: seleccion multiple + acciones masivas.
//
// El ESTADO de la seleccion vive en services/bulk.js (Set compartido que ya
// se limpia solo en client:changed / cambio de vista / post borrado y emite
// 'bulk:selection' por el bus del store). Este modulo agrega lo que es de la
// vista Tabla:
//   - ancla de shift-click (rango en el orden visible),
//   - modo seleccion movil (long-press 500ms con cancelacion por movimiento
//     de 10px + vibrate; fallback visible en el menu de la toolbar),
//   - la barra flotante de acciones masivas (Estado / Fecha / Persona /
//     Eliminar / X) sobre services/bulk (1 request, snapshot, rollback total).
//
// createSelection({ ctx, getVisibleIds }) -> controlador (ver API abajo).
// Todo lo efimero (ancla, modo) vive aqui en memoria, JAMAS en store/prefs.
// ============================================================================

import { el, fmtDate } from '../api.js?v=202606241200';
import { icon } from '../shell/icons.js?v=202606241200';
import * as bulk from '../services/bulk.js?v=202606241200';

const LONGPRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

function plural(n, one, many) {
  return n === 1 ? one : many;
}

export function createSelection({ ctx, getVisibleIds }) {
  let anchorId = null;       // ancla del shift-click (efimero)
  let selectMode = false;    // modo seleccion movil
  let changeCb = null;       // la vista repinta checkboxes/clases
  let offBus = null;
  let destroyed = false;

  // ── Barra flotante ─────────────────────────────────────────────────────────
  const countEl = el('span', { class: 'etable-bulkbar__count', 'aria-live': 'polite' });

  const mkAction = (ic, label, onTap, danger = false) => el('button', {
    class: 'etable-bulkbar__btn' + (danger ? ' etable-bulkbar__btn--danger' : ''),
    type: 'button', title: label, 'aria-label': label,
    onclick: onTap,
  }, [icon(ic, 18), el('span', { class: 'etable-bulkbar__lbl', text: label })]);

  const barEl = el('div', {
    class: 'etable-bulkbar', hidden: true,
    role: 'toolbar', 'aria-label': 'Acciones sobre la seleccion',
  }, [
    countEl,
    mkAction('refresh', 'Estado', () => actEstado()),
    mkAction('calendar', 'Fecha', () => actFecha()),
    mkAction('user', 'Persona', () => actPersona()),
    mkAction('trash', 'Eliminar', () => actEliminar(), true),
    el('button', {
      class: 'etable-bulkbar__btn etable-bulkbar__btn--close',
      type: 'button', 'aria-label': 'Limpiar seleccion',
      onclick: () => api.clear(),
    }, [icon('close', 18)]),
  ]);

  function paintBar() {
    const n = bulk.count();
    barEl.hidden = n === 0;
    countEl.textContent = n ? `${n} ${plural(n, 'seleccionado', 'seleccionados')}` : '';
  }

  // ── Acciones masivas (services/bulk: optimista + rollback total + toast) ───
  function ids() { return bulk.getSelection(); }

  function toastBulk(res, msg) {
    if (!res || !res.ok) return; // bulk ya mostro el toast de error
    ctx.toast(msg, {
      type: 'success',
      action: res.undo ? { label: 'Deshacer', onAction: () => { res.undo(); } } : null,
    });
  }

  async function actEstado() {
    const list = ids();
    if (!list.length) return;
    const v = await ctx.pickers.pickStatus({ title: `Estado para ${list.length}` });
    if (v == null) return;
    const res = await bulk.bulkSetStatus(list, v);
    toastBulk(res, `${res.count} ${plural(res.count, 'contenido actualizado', 'contenidos actualizados')}.`);
  }

  function actFecha() {
    const list = ids();
    if (!list.length) return;
    ctx.sheet.openSheet({
      title: `Fecha para ${list.length}`,
      mode: 'menu',
      build(body, close) {
        const row = (ic, label, onTap) => el('button', {
          class: 'etable-menu-row', type: 'button',
          onclick: () => { close({ source: 'pick' }); onTap(); },
        }, [icon(ic, 20), el('span', { class: 'etable-menu-row__label', text: label }), icon('right', 16)]);
        body.appendChild(el('div', { class: 'etable-menu' }, [
          row('calendar', 'Mover a una fecha', async () => {
            const v = await ctx.pickers.pickDate({ title: 'Nueva fecha', allowClear: true });
            if (v === null) return;
            const res = await bulk.bulkUpdate(list, { publish_date: v || null });
            toastBulk(res, v
              ? `${res.count} movidos al ${fmtDate(v)}.`
              : `Fecha quitada a ${res.count}.`);
          }),
          row('clock', 'Mover N dias', () => openShiftSheet(list)),
        ]));
      },
    });
  }

  function openShiftSheet(list) {
    ctx.sheet.openSheet({
      title: 'Mover N dias',
      mode: 'form',
      build(body, close) {
        let days = 1;
        const num = el('span', { class: 'etable-step__num', 'aria-live': 'polite' });
        const hint = el('p', { class: 'etable-step__hint' });
        const paint = () => {
          num.textContent = days > 0 ? `+${days}` : String(days);
          hint.textContent = days === 0
            ? 'Elige cuantos dias mover.'
            : days > 0
              ? `Las fechas se moveran ${days} ${plural(days, 'dia', 'dias')} hacia adelante.`
              : `Las fechas se moveran ${Math.abs(days)} ${plural(Math.abs(days), 'dia', 'dias')} hacia atras.`;
        };
        const stepBtn = (label, delta, aria) => el('button', {
          class: 'etable-step__btn', type: 'button', text: label, 'aria-label': aria,
          onclick: () => { days += delta; paint(); },
        });
        paint();
        body.append(
          el('div', { class: 'etable-step' }, [
            stepBtn('-7', -7, 'Restar 7 dias'),
            stepBtn('-1', -1, 'Restar 1 dia'),
            num,
            stepBtn('+1', +1, 'Sumar 1 dia'),
            stepBtn('+7', +7, 'Sumar 7 dias'),
          ]),
          hint,
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            el('button', {
              class: 'btn btn-primary sheet-cta', type: 'button', text: 'Mover fechas',
              onclick: async () => {
                if (!days) return;
                close({ source: 'save' });
                const res = await bulk.bulkShiftDates(list, days);
                if (res.ok) {
                  ctx.toast(`${res.count} ${plural(res.count, 'fecha movida', 'fechas movidas')}.`, { type: 'success' });
                }
              },
            }),
          ]),
        );
      },
    });
  }

  async function actPersona() {
    const list = ids();
    if (!list.length) return;
    const users = await ctx.store.loadUsers();
    const v = await ctx.pickers.pickPerson({ users, title: `Responsable para ${list.length}` });
    if (v === null) return;
    const res = await bulk.bulkUpdate(list, {
      assignee: v.name || null,
      assignee_user_id: v.user_id || null,
    });
    toastBulk(res, v.name
      ? `${res.count} asignados a ${v.name}.`
      : `Responsable quitado a ${res.count}.`);
  }

  function actEliminar() {
    const list = ids();
    if (!list.length) return;
    const n = list.length;
    ctx.sheet.openSheet({
      title: `Eliminar ${n} ${plural(n, 'contenido', 'contenidos')}`,
      mode: 'form',
      build(body, close) {
        body.append(
          el('p', {
            class: 'etable-confirm__txt',
            text: `¿Eliminar ${n} ${plural(n, 'contenido', 'contenidos')}? Esta accion no se puede deshacer.`,
          }),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            el('button', {
              class: 'btn btn-danger sheet-cta', type: 'button', text: 'Eliminar',
              onclick: async () => {
                close({ source: 'confirm' });
                const res = await bulk.bulkDelete(list);
                if (res.ok) {
                  ctx.toast(`${res.count} ${plural(res.count, 'contenido eliminado', 'contenidos eliminados')}.`, { type: 'success' });
                }
              },
            }),
          ]),
        );
      },
    });
  }

  // ── Long-press movil (gesto + SIEMPRE con fallback visible en la toolbar) ──
  const lpDispose = [];

  function attachLongPress(containerEl, resolveId) {
    let timer = 0;
    let startX = 0;
    let startY = 0;
    let pressedId = null;

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = 0; }
      pressedId = null;
    };

    const onDown = (e) => {
      if (e.pointerType !== 'touch') return; // en desktop hay shift-click
      const id = resolveId(e.target);
      if (!id) return;
      pressedId = id;
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => {
        timer = 0;
        if (!pressedId) return;
        try { navigator.vibrate && navigator.vibrate(10); } catch { /* noop */ }
        api.enterSelectMode();
        if (!bulk.isSelected(pressedId)) bulk.select([pressedId]);
        pressedId = null;
      }, LONGPRESS_MS);
    };

    const onMove = (e) => {
      if (!timer) return;
      // Si el dedo se mueve, era scroll: cancela el gesto.
      if (Math.abs(e.clientX - startX) > MOVE_CANCEL_PX || Math.abs(e.clientY - startY) > MOVE_CANCEL_PX) cancel();
    };

    containerEl.addEventListener('pointerdown', onDown);
    containerEl.addEventListener('pointermove', onMove);
    containerEl.addEventListener('pointerup', cancel);
    containerEl.addEventListener('pointercancel', cancel);
    const dispose = () => {
      cancel();
      containerEl.removeEventListener('pointerdown', onDown);
      containerEl.removeEventListener('pointermove', onMove);
      containerEl.removeEventListener('pointerup', cancel);
      containerEl.removeEventListener('pointercancel', cancel);
    };
    lpDispose.push(dispose);
    return dispose;
  }

  // ── API del controlador ────────────────────────────────────────────────────
  const api = {
    bar: barEl,

    isSelected: (id) => bulk.isSelected(id),
    count: () => bulk.count(),
    ids,

    /** Click en checkbox/tarjeta. range=true (shift) selecciona el tramo visible. */
    toggleRow(id, { range = false } = {}) {
      if (!id) return;
      if (range && anchorId && anchorId !== id) {
        const order = getVisibleIds();
        const a = order.indexOf(anchorId);
        const b = order.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a];
          bulk.select(order.slice(from, to + 1));
          return;
        }
      }
      anchorId = id;
      bulk.toggle(id);
    },

    /** Checkbox del header de grupo: selecciona/deselecciona sus filas. */
    setGroup(groupIds, on) {
      if (on) bulk.select(groupIds);
      else bulk.deselect(groupIds);
      if (on && groupIds.length) anchorId = groupIds[0];
    },

    clear() {
      anchorId = null;
      selectMode = false;
      bulk.clear();
      // bulk.clear no emite si ya estaba vacia: repinta de todos modos.
      paintBar();
      changeCb && changeCb({ ids: [], count: 0, selectMode });
    },

    inSelectMode: () => selectMode,
    enterSelectMode() {
      if (selectMode) return;
      selectMode = true;
      changeCb && changeCb({ ids: bulk.getSelection(), count: bulk.count(), selectMode });
    },

    attachLongPress,

    onChange(fn) { changeCb = fn; },

    destroy() {
      destroyed = true;
      if (offBus) { try { offBus(); } catch { /* noop */ } offBus = null; }
      for (const d of lpDispose.splice(0)) { try { d(); } catch { /* noop */ } }
      changeCb = null;
      barEl.remove();
    },
  };

  // Cambios de seleccion (de esta vista o de services/bulk): repinta.
  offBus = ctx.store.on('bulk:selection', ({ ids: list, count } = {}) => {
    if (destroyed) return;
    if (!count) { anchorId = null; selectMode = false; }
    paintBar();
    changeCb && changeCb({ ids: list || [], count: count || 0, selectMode });
  });

  paintBar();
  return api;
}
