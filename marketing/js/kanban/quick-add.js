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

import { el, STATUSES, STATUS_ORDER, statusLabel, fmtDate } from '../api.js?v=202607182156';
import { icon } from '../shell/icons.js?v=202607182156';
import { T } from '../shell/i18n.js?v=202607182156';

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
    ctx.toast(T('No hay clientes activos para crear contenido.', 'No active clients to create content for.'), { type: 'error' });
    return null;
  }
  return ctx.sheet.pickFrom({ title: T('Para que cliente', 'For which client'), options });
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
  if (post) ctx.toast(T('Contenido creado.', 'Content created.'), { type: 'success' });
  return post;
}

// ── 1) Composer inline al pie de cada columna ────────────────────────────────
export function createColumnComposer({ ctx, getStatus, getClientId, getNextPosition, onCreated }) {
  let busy = false;

  const input = el('input', {
    class: 'input kb-composer__input',
    type: 'text',
    placeholder: T('Titulo del contenido', 'Content title'),
    maxlength: '140',
    autocomplete: 'off',
    'aria-label': T('Titulo del nuevo contenido', 'Title of the new content'),
  });

  const form = el('div', { class: 'kb-composer__form', hidden: true }, [
    input,
    el('div', { class: 'kb-composer__actions' }, [
      el('button', {
        class: 'btn btn-primary kb-composer__save', type: 'button', text: T('Agregar', 'Add'),
        onclick: () => submit(),
      }),
      el('button', {
        class: 'btn kb-composer__cancel', type: 'button', 'aria-label': T('Cancelar', 'Cancel'),
        onclick: () => closeForm(),
      }, [icon('close', 16)]),
    ]),
  ]);

  const openBtn = el('button', {
    class: 'kb-composer__open', type: 'button',
    onclick: () => openForm(),
  }, [icon('plus', 18), el('span', { text: T('Agregar', 'Add') })]);

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
    title: T('Nuevo contenido', 'New content'),
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'text',
        placeholder: T('Titulo del contenido', 'Content title'),
        maxlength: '140', autocomplete: 'off',
        'aria-label': T('Titulo del nuevo contenido', 'Title of the new content'),
      });

      // Fila de estado.
      const statusValue = el('span', { class: 'kb-qa-row__value' });
      const statusDot = el('span', { class: 'kb-qa-row__dot' });
      const paintStatus = () => {
        const s = chosenStatus && STATUSES[chosenStatus];
        statusDot.style.background = (s && s.color) || 'var(--text-mute)';
        statusValue.textContent = (s && statusLabel(chosenStatus)) || T('Elegir estado', 'Choose a status');
      };
      paintStatus();
      const statusRow = el('button', {
        class: 'kb-qa-row', type: 'button',
        onclick: async () => {
          const v = await ctx.pickers.pickStatus({ current: chosenStatus, anchor: statusRow });
          if (v != null) { chosenStatus = v; paintStatus(); }
        },
      }, [statusDot, el('span', { class: 'kb-qa-row__label', text: T('Estado', 'Status') }), statusValue, icon('right', 16)]);

      // Fila de fecha (opcional).
      const dateValue = el('span', { class: 'kb-qa-row__value', text: T('Sin fecha', 'No date') });
      const dateRow = el('button', {
        class: 'kb-qa-row', type: 'button',
        onclick: async () => {
          const v = await ctx.pickers.pickDate({ current: chosenDate || null, anchor: dateRow });
          if (v === null) return;
          chosenDate = v;
          dateValue.textContent = v ? fmtDate(v) : T('Sin fecha', 'No date');
        },
      }, [icon('calendar', 18), el('span', { class: 'kb-qa-row__label', text: T('Fecha', 'Date') }), dateValue, icon('right', 16)]);

      // Fila de cliente (solo en "Todos los clientes").
      let clientRow = null;
      const clientValue = el('span', { class: 'kb-qa-row__value', text: T('Elegir cliente', 'Choose a client') });
      if (needsClient) {
        clientRow = el('button', {
          class: 'kb-qa-row', type: 'button',
          onclick: async () => {
            const v = await resolveClientId(ctx);
            if (v) {
              chosenClient = v;
              const c = (ctx.store.getState().clients || []).find((x) => x.id === v);
              clientValue.textContent = (c && c.name) || T('Cliente', 'Client');
            }
          },
        }, [icon('users', 18), el('span', { class: 'kb-qa-row__label', text: T('Cliente', 'Client') }), clientValue, icon('right', 16)]);
      }

      const saveBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Crear contenido', 'Create content'),
      });
      saveBtn.addEventListener('click', async () => {
        const title = input.value.trim();
        if (!title) { ctx.toast(T('Escribe un titulo para el contenido.', 'Write a title for the content.'), { type: 'error' }); input.focus(); return; }
        if (!chosenStatus) { ctx.toast(T('Elige un estado.', 'Choose a status.'), { type: 'error' }); return; }
        if (needsClient && !chosenClient) { ctx.toast(T('Elige un cliente.', 'Choose a client.'), { type: 'error' }); return; }
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
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Titulo', 'Title') }), input]),
        el('div', { class: 'kb-qa-rows' }, [statusRow, dateRow, clientRow]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => input.focus(), 60);
    },
  });
}
