// ============================================================================
// IVAE Marketing v2 — Kanban: alta rapida de contenido.
//
// Dos modos:
//   1) createColumnComposer({ ctx, getStatus, getClientId, getNextPosition,
//      onCreated }) -> elemento de pie de columna. Boton "Agregar" que se
//      expande a un input inline (Enter crea, Esc cancela). Crea el post en
//      la columna (status) al final (position sparse).
//   2) openQuickAddSheet({ ctx, status, getNextPosition, onCreated }) ->
//      bottom sheet (FAB "Nuevo"): titulo + estado + fecha opcional +
//      cliente (solo si el tablero esta en "Todos los clientes").
//
// La creacion va SIEMPRE por ctx.store.createPost (toast de error incluido
// en el store; aqui solo toast de exito).
// ============================================================================

import { el, STATUSES, STATUS_ORDER, fmtDate } from '../api.js?v=202606121308';
import { icon } from '../shell/icons.js?v=202606121308';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

/** Elige cliente cuando el tablero esta en "Todos" (resuelve id o null). */
async function resolveClientId(ctx) {
  const { activeClientId, clients } = ctx.store.getState();
  if (activeClientId && activeClientId !== 'todos') return activeClientId;
  const options = (clients || [])
    .filter((c) => !c.archived)
    .map((c) => ({ value: c.id, label: c.name, color: safeColor(c.brand_color) }));
  if (!options.length) {
    ctx.toast('No hay clientes activos para crear contenido.', { type: 'error' });
    return null;
  }
  return ctx.sheet.pickFrom({ title: 'Para que cliente', options });
}

async function doCreate(ctx, { title, status, clientId, publishDate, position }) {
  const data = {
    client_id: clientId,
    title,
    status,
    position,
  };
  if (publishDate) data.publish_date = publishDate;
  const post = await ctx.store.createPost(data);
  if (post) ctx.toast('Contenido creado.', { type: 'success' });
  return post;
}

// ── 1) Composer inline al pie de cada columna ────────────────────────────────
export function createColumnComposer({ ctx, getStatus, getClientId, getNextPosition, onCreated }) {
  let busy = false;

  const input = el('input', {
    class: 'input kb-composer__input',
    type: 'text',
    placeholder: 'Titulo del contenido',
    maxlength: '140',
    autocomplete: 'off',
    'aria-label': 'Titulo del nuevo contenido',
  });

  const form = el('div', { class: 'kb-composer__form', hidden: true }, [
    input,
    el('div', { class: 'kb-composer__actions' }, [
      el('button', {
        class: 'btn btn-primary kb-composer__save', type: 'button', text: 'Agregar',
        onclick: () => submit(),
      }),
      el('button', {
        class: 'btn kb-composer__cancel', type: 'button', 'aria-label': 'Cancelar',
        onclick: () => closeForm(),
      }, [icon('close', 16)]),
    ]),
  ]);

  const openBtn = el('button', {
    class: 'kb-composer__open', type: 'button',
    onclick: () => openForm(),
  }, [icon('plus', 18), el('span', { text: 'Agregar' })]);

  const root = el('div', { class: 'kb-composer' }, [openBtn, form]);

  function openForm() {
    openBtn.hidden = true;
    form.hidden = false;
    input.value = '';
    setTimeout(() => input.focus(), 40);
  }

  function closeForm() {
    form.hidden = true;
    openBtn.hidden = false;
    input.value = '';
  }

  async function submit() {
    const title = input.value.trim();
    if (!title || busy) return;
    busy = true;
    try {
      const clientId = getClientId ? getClientId() : null;
      const cid = (clientId && clientId !== 'todos') ? clientId : await resolveClientId(ctx);
      if (!cid) { busy = false; return; }
      const post = await doCreate(ctx, {
        title,
        status: getStatus(),
        clientId: cid,
        position: getNextPosition(getStatus()),
      });
      if (post) {
        input.value = '';
        input.focus();
        try { onCreated?.(post); } catch (e) { console.error('[kanban] composer onCreated', e); }
      }
    } finally {
      busy = false;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeForm(); }
  });

  return root;
}

// ── 2) Sheet de alta rapida (FAB "Nuevo") ────────────────────────────────────
export function openQuickAddSheet({ ctx, status = null, getNextPosition, onCreated } = {}) {
  const firstStatus = (STATUS_ORDER && STATUS_ORDER[0]) || null;
  let chosenStatus = (status && STATUSES[status]) ? status : firstStatus;
  let chosenDate = '';
  let chosenClient = null;

  const st = ctx.store.getState();
  const needsClient = !st.activeClientId || st.activeClientId === 'todos';
  if (!needsClient) chosenClient = st.activeClientId;

  ctx.sheet.openSheet({
    title: 'Nuevo contenido',
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'text',
        placeholder: 'Titulo del contenido',
        maxlength: '140', autocomplete: 'off',
        'aria-label': 'Titulo del nuevo contenido',
      });

      // Fila de estado.
      const statusValue = el('span', { class: 'kb-qa-row__value' });
      const statusDot = el('span', { class: 'kb-qa-row__dot' });
      const paintStatus = () => {
        const s = chosenStatus && STATUSES[chosenStatus];
        statusDot.style.background = (s && s.color) || 'var(--text-mute)';
        statusValue.textContent = (s && s.label) || 'Elegir estado';
      };
      paintStatus();
      const statusRow = el('button', {
        class: 'kb-qa-row', type: 'button',
        onclick: async () => {
          const v = await ctx.pickers.pickStatus({ current: chosenStatus, anchor: statusRow });
          if (v != null) { chosenStatus = v; paintStatus(); }
        },
      }, [statusDot, el('span', { class: 'kb-qa-row__label', text: 'Estado' }), statusValue, icon('right', 16)]);

      // Fila de fecha (opcional).
      const dateValue = el('span', { class: 'kb-qa-row__value', text: 'Sin fecha' });
      const dateRow = el('button', {
        class: 'kb-qa-row', type: 'button',
        onclick: async () => {
          const v = await ctx.pickers.pickDate({ current: chosenDate || null, anchor: dateRow });
          if (v === null) return;
          chosenDate = v;
          dateValue.textContent = v ? fmtDate(v) : 'Sin fecha';
        },
      }, [icon('calendar', 18), el('span', { class: 'kb-qa-row__label', text: 'Fecha' }), dateValue, icon('right', 16)]);

      // Fila de cliente (solo en "Todos los clientes").
      let clientRow = null;
      const clientValue = el('span', { class: 'kb-qa-row__value', text: 'Elegir cliente' });
      if (needsClient) {
        clientRow = el('button', {
          class: 'kb-qa-row', type: 'button',
          onclick: async () => {
            const v = await resolveClientId(ctx);
            if (v) {
              chosenClient = v;
              const c = (ctx.store.getState().clients || []).find((x) => x.id === v);
              clientValue.textContent = (c && c.name) || 'Cliente';
            }
          },
        }, [icon('users', 18), el('span', { class: 'kb-qa-row__label', text: 'Cliente' }), clientValue, icon('right', 16)]);
      }

      const saveBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear contenido',
      });
      saveBtn.addEventListener('click', async () => {
        const title = input.value.trim();
        if (!title) { ctx.toast('Escribe un titulo para el contenido.', { type: 'error' }); input.focus(); return; }
        if (!chosenStatus) { ctx.toast('Elige un estado.', { type: 'error' }); return; }
        if (needsClient && !chosenClient) { ctx.toast('Elige un cliente.', { type: 'error' }); return; }
        saveBtn.disabled = true;
        const post = await doCreate(ctx, {
          title,
          status: chosenStatus,
          clientId: chosenClient,
          publishDate: chosenDate || null,
          position: getNextPosition ? getNextPosition(chosenStatus) : 1000,
        });
        if (post) {
          close({ source: 'saved' });
          try { onCreated?.(post); } catch (e) { console.error('[kanban] quickadd onCreated', e); }
        } else {
          saveBtn.disabled = false;
        }
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Titulo' }), input]),
        el('div', { class: 'kb-qa-rows' }, [statusRow, dateRow, clientRow]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => input.focus(), 60);
    },
  });
}
