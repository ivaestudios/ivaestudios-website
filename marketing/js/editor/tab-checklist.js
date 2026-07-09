// ============================================================================
// IVAE Marketing v2 - Editor de post: tab Checklist.
//
// - Cabecera con barra de progreso proporcional + "X de Y completados".
// - Filas de 48px con DOS zonas de tap claras: la mitad izquierda (checkbox
//   extendido) togglea, el label edita inline (Enter guarda, Esc cancela).
// - Meta sutil al completar ("Natalia, hace 2 h").
// - Menu 3 puntos por item: Subir / Bajar / Eliminar (reorden movil SIN drag:
//   la lista es corta y el long-press a 390px es fragil).
// - Add-row sticky al fondo: Enter crea y CONSERVA el foco para encadenar.
// - Vacia: empty state con "Usar plantilla de <tipo>".
// - Al llegar a 100%: la barra pulsa y, si el status va atras en el pipeline,
//   toast accionable "Checklist completa" con "Mover a Revision".
//
// Toda mutacion es optimista via services/checklist.js (rollback + toast ya
// vienen del servicio). Si la migracion 004 no esta aplicada (servicio no
// disponible) el tab degrada a un aviso y el resto del editor funciona.
//
// mount(host, ed) -> dispose()
// ============================================================================

import { el, timeAgo, STATUSES } from '../api.js?v=202607081914';
import { icon } from '../shell/icons.js?v=202607081914';
import { openSheet } from '../shell/sheet.js?v=202607081914';
import * as store from '../shell/store.js?v=202607081914';
import * as cl from '../services/checklist.js?v=202607081914';
import { checklistFor, applyChecklistTemplate, contentTypeLabel } from './templates.js?v=202607081914';

export function mount(host, ed) {
  const { ctx } = ed;
  let items = [];
  let disposed = false;
  let celebrated = false;
  let editingId = null;
  let loadedOnce = false;

  // Render instantaneo con la checklist del GET /posts/:id (backend v2 manda
  // label; el servicio usa text: se aceptan ambos). El refetch la reconcilia.
  const seed = ed.getChecklistSeed()
    .filter((raw) => raw && raw.id)
    .map((raw, i) => ({
      id: raw.id,
      post_id: raw.post_id || ed.postId,
      text: String(raw.text ?? raw.label ?? ''),
      done: raw.done ? 1 : 0,
      position: Number(raw.position) || (i + 1) * 1000,
    }));
  if (seed.length) { items = seed; loadedOnce = true; }

  // Meta done_by/done_at: el servicio normaliza esos campos fuera, asi que se
  // siembran del payload GET /posts/:id (backend v2) y se mantienen en local
  // al togglear (yo + ahora). Best-effort: si no hay dato, no se pinta meta.
  const doneMeta = new Map();
  for (const raw of ed.getChecklistSeed()) {
    if (raw && raw.id && (raw.done_at || raw.done_by_name || raw.done_by)) {
      doneMeta.set(raw.id, {
        by: raw.done_by_name || '',
        at: raw.done_at || '',
      });
    }
  }

  const root = el('div', { class: 'edtab edtab-checklist' });

  // ── Cabecera de progreso ───────────────────────────────────────────────────
  const barFill = el('div', { class: 'edprog__fill' });
  const barEl = el('div', { class: 'edprog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [barFill]);
  const progText = el('div', { class: 'edprog__text', 'aria-live': 'polite' });
  const headEl = el('div', { class: 'edcheck__head' }, [progText, barEl]);

  const listEl = el('div', { class: 'edcheck__list', role: 'list' });

  // ── Add-row sticky ─────────────────────────────────────────────────────────
  const addInput = el('input', {
    class: 'input ed-input edcheck__addinput', type: 'text',
    placeholder: 'Agregar paso...', maxlength: '200',
    'aria-label': 'Agregar paso a la checklist',
  });
  const addBtn = el('button', {
    class: 'btn btn-primary edcheck__addbtn', type: 'button', 'aria-label': 'Agregar',
    onclick: () => submitAdd(),
  }, [icon('plus', 18)]);
  const addRow = el('div', { class: 'edcheck__add' }, [addInput, addBtn]);
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitAdd(); }
  });

  async function submitAdd() {
    const txt = addInput.value.trim();
    if (!txt) return;
    addInput.value = '';
    addInput.focus(); // conserva el foco para encadenar
    await cl.add(ed.postId, txt);
  }

  const emptyEl = el('div', { class: 'edcheck__empty', hidden: true });
  const unavailableEl = el('div', { class: 'edcheck__empty' }, [
    el('p', { class: 'muted', text: 'La checklist se activa cuando se aplique la actualizacion del servidor.' }),
  ]);

  root.append(headEl, emptyEl, listEl, addRow);

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderProgress() {
    const total = items.length;
    const done = items.filter((it) => it.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    barFill.style.width = `${pct}%`;
    barEl.setAttribute('aria-valuenow', String(pct));
    progText.textContent = total
      ? `${done} de ${total} completados`
      : 'Sin pasos todavia';
    barEl.hidden = !total;
    ed.setTabBadge('checklist', total ? `${done}/${total}` : '');

    if (total && done === total) {
      barEl.classList.add('is-complete');
      if (!celebrated) {
        celebrated = true;
        barEl.classList.remove('is-pulse');
        requestAnimationFrame(() => barEl.classList.add('is-pulse'));
        maybeOfferAdvance();
      }
    } else {
      barEl.classList.remove('is-complete', 'is-pulse');
      celebrated = false;
    }
  }

  function maybeOfferAdvance() {
    const p = ed.getPost();
    const cur = STATUSES[p.status];
    const rev = STATUSES.revision;
    if (!cur || !rev || cur.order >= rev.order) return;
    ctx.toast('Checklist completa.', {
      type: 'success',
      action: {
        label: 'Mover a Revision',
        onAction: () => { ed.setField('status', 'revision', { immediate: true }); ed.refreshHeader(); },
      },
    });
  }

  function itemRow(it, idx) {
    const isEditing = editingId === it.id;

    // Zona izquierda completa = checkbox extendido (target enorme).
    const checkbox = el('button', {
      class: 'edcheck__box', type: 'button', role: 'checkbox',
      'aria-checked': it.done ? 'true' : 'false',
      'aria-label': it.done ? `Desmarcar: ${it.text}` : `Marcar: ${it.text}`,
      onclick: () => toggle(it),
    }, [el('span', { class: 'edcheck__square' }, [it.done ? icon('check', 14) : null])]);

    let mainEl;
    if (isEditing) {
      const input = el('input', {
        class: 'input ed-input edcheck__edit', type: 'text', maxlength: '200',
        'aria-label': 'Editar paso',
      });
      input.value = it.text;
      let committed = false; // Enter dispara blur al re-render: un solo commit
      const commit = () => {
        if (committed) return;
        committed = true;
        const txt = input.value.trim();
        editingId = null;
        if (txt && txt !== it.text) cl.rename(ed.postId, it.id, txt);
        else render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.stopPropagation(); committed = true; editingId = null; render(); }
      });
      input.addEventListener('blur', commit);
      mainEl = el('span', { class: 'edcheck__main' }, [input]);
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 30);
    } else {
      const meta = it.done ? doneMeta.get(it.id) : null;
      const metaText = meta
        ? [meta.by, meta.at ? timeAgo(meta.at) : ''].filter(Boolean).join(' · ')
        : '';
      mainEl = el('button', {
        class: 'edcheck__main edcheck__main--btn', type: 'button',
        onclick: () => { editingId = it.id; render(); },
        'aria-label': `Editar: ${it.text}`,
      }, [
        el('span', { class: 'edcheck__label' + (it.done ? ' is-done' : ''), text: it.text }),
        metaText ? el('span', { class: 'edcheck__meta', text: metaText }) : null,
      ]);
    }

    const menuBtn = el('button', {
      class: 'edcheck__menu', type: 'button', 'aria-label': `Opciones de: ${it.text}`,
      onclick: (e) => { e.stopPropagation(); openItemMenu(it, idx, menuBtn); },
    }, [icon('dots', 18)]);

    return el('div', { class: 'edcheck__item' + (it.done ? ' is-done' : ''), role: 'listitem' }, [
      checkbox, mainEl, menuBtn,
    ]);
  }

  function render() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!cl.isAvailable()) {
      emptyEl.hidden = true;
      headEl.hidden = true;
      addRow.hidden = true;
      if (!unavailableEl.isConnected) root.insertBefore(unavailableEl, listEl);
      return;
    }
    headEl.hidden = false;
    addRow.hidden = false;
    if (unavailableEl.isConnected) unavailableEl.remove();

    renderProgress();

    if (!items.length && !loadedOnce) {
      // Primera carga sin cache: shimmer en vez de empty state (sin flash).
      emptyEl.hidden = true;
      for (let i = 0; i < 3; i++) listEl.appendChild(el('div', { class: 'edskel__row', 'aria-hidden': 'true' }));
      return;
    }
    if (!items.length) {
      renderEmpty();
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    items.forEach((it, idx) => listEl.appendChild(itemRow(it, idx)));
  }

  function renderEmpty() {
    while (emptyEl.firstChild) emptyEl.removeChild(emptyEl.firstChild);
    const type = ed.getPost().content_type;
    const steps = checklistFor(type);
    emptyEl.append(
      el('p', { class: 'muted', text: 'Divide este contenido en pasos para no perder nada.' }),
      el('button', {
        class: 'btn btn-primary', type: 'button',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          const n = await applyChecklistTemplate(ed.postId, type);
          btn.disabled = false;
          if (n) ctx.toast(`${n} pasos agregados.`, { type: 'success' });
        },
      }, [icon('spark', 16), `Usar plantilla de ${contentTypeLabel(type)}`]),
      el('p', { class: 'help', text: `Incluye: ${steps.slice(0, 4).join(', ')}...` }),
    );
  }

  // ── Mutaciones (el servicio ya es optimista con rollback + toast) ─────────
  async function toggle(it) {
    const next = !it.done;
    if (next) doneMeta.set(it.id, { by: ed.getMe().name || '', at: new Date().toISOString() });
    else doneMeta.delete(it.id);
    await cl.setDone(ed.postId, it.id, next);
  }

  function openItemMenu(it, idx, anchor) {
    openSheet({
      title: it.text,
      mode: 'menu',
      anchor,
      build(body, close) {
        const mk = (label, iconName, fn, danger = false) => el('button', {
          class: 'pick-row' + (danger ? ' pick-row--danger' : ''), type: 'button',
          onclick: () => { close({ source: 'pick' }); fn(); },
        }, [icon(iconName, 18), el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: label })])]);

        const list = el('div', { class: 'pick-list' });
        if (idx > 0) list.appendChild(mk('Subir', 'up', () => move(idx, idx - 1)));
        if (idx < items.length - 1) list.appendChild(mk('Bajar', 'down', () => move(idx, idx + 1)));
        list.appendChild(mk('Eliminar', 'trash', () => cl.remove(ed.postId, it.id), true));
        body.appendChild(list);
      },
    });
  }

  function move(from, to) {
    const ids = items.map((it) => it.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    cl.reorderItems(ed.postId, ids);
  }

  // ── Datos ──────────────────────────────────────────────────────────────────
  async function load(force) {
    const fresh = await cl.list(ed.postId, { force });
    if (disposed) return;
    loadedOnce = true;
    // Si el servicio aun no esta disponible (404), conserva el seed read-only.
    if (cl.isAvailable() || fresh.length) items = fresh;
    render();
  }

  const offChanged = store.on('checklist:changed', ({ postId } = {}) => {
    if (postId !== ed.postId || disposed) return;
    cl.list(ed.postId).then((fresh) => {
      if (disposed) return;
      items = fresh;
      render();
    });
  });

  host.appendChild(root);
  render();          // pinta lo que haya en cache al instante
  load(true);        // y refresca del server

  return function dispose() {
    disposed = true;
    offChanged();
  };
}
