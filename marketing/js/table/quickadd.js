// ============================================================================
// IVAE Marketing v2 - Vista Tabla: alta rapida por grupo.
//
// Desktop: ultima fila de cada grupo "+ Agregar contenido" que se transforma
// en input inline. Enter crea (POST /posts via store.createPost, optimista en
// memoria) y DEJA el input activo para encadenar; Esc o blur con texto vacio
// cierra. Como cada creacion re-renderiza el cuerpo, el estado "abierto" se
// recuerda a nivel de modulo (chainState) y table.js re-monta la fila abierta.
//
// Movil: boton "+ Agregar" al final del grupo expandido abre un bottom sheet
// con titulo + chips de defaults editables (fecha del grupo, tipo). "Crear"
// crea y deja el sheet listo para encadenar otro.
//
// Herencia de defaults del grupo (groups.defaultsForGroup):
//   mes -> publish_date = dia 1 de ese mes; estado -> ese status;
//   Sin fecha -> publish_date null. Tipo default: reel. Status default: idea.
//   position = max del grupo + 1000 (sparse).
// ============================================================================

import { el, fmtDate, CONTENT_TYPES, contentTypeLabel } from '../api.js?v=202607081914';
import { icon } from '../shell/icons.js?v=202607081914';
import { defaultsForGroup } from './groups.js?v=202607081914';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Estado del encadenado desktop: sobrevive a los re-render de posts:changed.
const chainState = { groupKey: null };

export function resetChain() {
  chainState.groupKey = null;
}

/** Cliente destino: el activo, o un picker si el modo es "Todos". */
async function resolveClientId(ctx) {
  const { activeClientId, clients } = ctx.store.getState();
  if (activeClientId && activeClientId !== 'todos') return activeClientId;
  const options = (clients || [])
    .filter((c) => !c.archived)
    .map((c) => ({
      value: c.id, label: c.name,
      color: HEX_RE.test(String(c.brand_color || '')) ? c.brand_color : 'var(--brand)',
    }));
  if (!options.length) {
    ctx.toast('No hay clientes activos para crear contenido.', { type: 'error' });
    return null;
  }
  return ctx.sheet.pickFrom({ title: 'Para que cliente', options });
}

async function doCreate(ctx, { title, defaults, contentType, position }) {
  const clientId = await resolveClientId(ctx);
  if (!clientId) return null;
  const data = {
    client_id: clientId,
    title,
    content_type: contentType || 'reel',
    status: defaults.status || 'idea',
    publish_date: defaults.publish_date !== undefined ? defaults.publish_date : null,
    position,
  };
  // store.createPost ya hace toast de error y emite posts:changed.
  const post = await ctx.store.createPost(data);
  if (post) ctx.toast('Contenido creado.', { type: 'success', ms: 1500 });
  return post;
}

// ── Desktop: fila inline por grupo ───────────────────────────────────────────
/**
 * createQuickAddRow({ ctx, group, mode, colSpan, getNextPosition })
 * -> <tr class="etable-qa"> para insertar al final del tbody del grupo.
 */
export function createQuickAddRow({ ctx, group, mode, colSpan, getNextPosition }) {
  let busy = false;
  const defaults = defaultsForGroup(group, mode);

  const input = el('input', {
    class: 'input etable-qa__input',
    type: 'text',
    placeholder: 'Titulo del contenido',
    maxlength: '140',
    autocomplete: 'off',
    'aria-label': `Titulo del nuevo contenido en ${group.label}`,
  });

  const form = el('div', { class: 'etable-qa__form', hidden: true }, [
    input,
    el('span', { class: 'etable-qa__hint', text: 'Enter crea · Esc cancela' }),
  ]);

  const openBtn = el('button', {
    class: 'etable-qa__open', type: 'button',
    onclick: () => open(),
  }, [icon('plus', 16), el('span', { text: 'Agregar contenido' })]);

  function open() {
    chainState.groupKey = group.key;
    openBtn.hidden = true;
    form.hidden = false;
    setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 30);
  }

  function closeForm() {
    chainState.groupKey = null;
    form.hidden = true;
    openBtn.hidden = false;
    input.value = '';
  }

  async function submit() {
    const title = input.value.trim();
    if (!title || busy) return;
    busy = true;
    try {
      const post = await doCreate(ctx, {
        title,
        defaults,
        position: getNextPosition(group),
      });
      if (post) {
        // El re-render por posts:changed re-monta esta fila abierta
        // (chainState.groupKey sigue siendo este grupo): encadenado natural.
        input.value = '';
      }
    } finally {
      busy = false;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeForm(); }
  });
  input.addEventListener('blur', () => {
    // Blur con texto vacio cierra (si hay texto, se respeta lo escrito).
    setTimeout(() => {
      if (!input.value.trim() && !form.hidden && document.activeElement !== input) closeForm();
    }, 120);
  });

  const td = el('td', { class: 'etable-qa__cell', colspan: String(colSpan) }, [openBtn, form]);
  const tr = el('tr', { class: 'etable-qa' }, [td]);

  // Re-abrir tras el re-render si este grupo estaba encadenando.
  if (chainState.groupKey === group.key) {
    openBtn.hidden = true;
    form.hidden = false;
    requestAnimationFrame(() => { try { input.focus(); } catch { /* noop */ } });
  }

  return tr;
}

// ── Movil: boton + bottom sheet encadenable ──────────────────────────────────
/**
 * createQuickAddButton({ ctx, group, mode, getNextPosition })
 * -> boton "+ Agregar" para el final del grupo expandido (390px).
 */
export function createQuickAddButton({ ctx, group, mode, getNextPosition }) {
  return el('button', {
    class: 'etable-qa__mbtn', type: 'button',
    onclick: () => openQuickAddSheet({ ctx, group, mode, getNextPosition }),
  }, [icon('plus', 18), el('span', { text: 'Agregar' })]);
}

/**
 * openQuickAddSheet({ ctx, group, mode, getNextPosition })
 * Bottom sheet de alta rapida. group puede ser null (FAB): sin herencia.
 */
export function openQuickAddSheet({ ctx, group = null, mode = 'month', getNextPosition }) {
  const defaults = defaultsForGroup(group, mode);
  let chosenDate = defaults.publish_date || '';
  let chosenType = 'reel';
  const chosenStatus = defaults.status || 'idea';

  ctx.sheet.openSheet({
    title: group ? `Nuevo en ${group.label}` : 'Nuevo contenido',
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'text',
        placeholder: 'Titulo del contenido',
        maxlength: '140', autocomplete: 'off',
        'aria-label': 'Titulo del nuevo contenido',
      });

      // Chips de defaults editables.
      const dateChipTxt = el('span', { text: chosenDate ? fmtDate(chosenDate) : 'Sin fecha' });
      const dateChip = el('button', {
        class: 'etable-qa__chip', type: 'button',
        'aria-label': 'Cambiar fecha',
        onclick: async () => {
          const v = await ctx.pickers.pickDate({ current: chosenDate || null, anchor: dateChip });
          if (v === null) return;
          chosenDate = v;
          dateChipTxt.textContent = v ? fmtDate(v) : 'Sin fecha';
        },
      }, [icon('calendar', 15), dateChipTxt]);

      const typeChipTxt = el('span', { text: contentTypeLabel(chosenType) });
      const typeDot = el('span', {
        class: 'etable-ct__dot', 'aria-hidden': 'true',
        style: { background: (CONTENT_TYPES[chosenType] && CONTENT_TYPES[chosenType].color) || 'var(--text-mute)' },
      });
      const typeChip = el('button', {
        class: 'etable-qa__chip', type: 'button',
        'aria-label': 'Cambiar tipo de contenido',
        onclick: async () => {
          const v = await ctx.pickers.pickType({ current: chosenType, anchor: typeChip });
          if (v == null) return;
          chosenType = v;
          typeChipTxt.textContent = contentTypeLabel(v);
          typeDot.style.background = (CONTENT_TYPES[v] && CONTENT_TYPES[v].color) || 'var(--text-mute)';
        },
      }, [typeDot, typeChipTxt]);

      const saveBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear',
      });
      saveBtn.addEventListener('click', async () => {
        const title = input.value.trim();
        if (!title) {
          ctx.toast('Escribe un titulo para el contenido.', { type: 'error' });
          input.focus();
          return;
        }
        saveBtn.disabled = true;
        const post = await doCreate(ctx, {
          title,
          defaults: { status: chosenStatus, publish_date: chosenDate || null },
          contentType: chosenType,
          position: getNextPosition ? getNextPosition(group) : 1000,
        });
        saveBtn.disabled = false;
        if (post) {
          // Encadenable: limpia el titulo y deja el sheet listo para otro.
          input.value = '';
          try { input.focus(); } catch { /* noop */ }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Titulo' }), input]),
        el('div', { class: 'etable-qa__chips' }, [dateChip, typeChip]),
        el('div', { class: 'sheet__footer etable-qa__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Listo', onclick: () => close({ source: 'done' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 60);
    },
  });
}
