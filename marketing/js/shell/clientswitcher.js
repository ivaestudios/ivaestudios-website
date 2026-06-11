// ============================================================================
// IVAE Marketing v2 — Switcher de cliente (sheet movil / popover desktop).
//
// - Filas 56px: dot del brand_color, nombre, badge gradiente con
//   counts.pending si > 0.
// - Si hay mas de 8 clientes: input de filtro arriba.
// - Primera opcion 'Todos los clientes' (solo staff): habilita vistas globales.
// - Footer: CTA '+ Nuevo cliente' (form sheet con nombre, color e Instagram).
// - Seleccionar: cierra el sheet y delega en shell.selectClient(id), que hace
//   el set optimista + pref lastClient + ?cliente= replace + client:changed.
// ============================================================================

import { api, el } from '../api.js?v=202606110217';
import { openSheet } from './sheet.js?v=202606110217';
import { toast } from './toast.js?v=202606110217';
import * as store from './store.js?v=202606110217';
import { icon } from './icons.js?v=202606110217';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

function clientRow(c, activeId, onPick) {
  const pending = c.counts && c.counts.pending > 0 ? c.counts.pending : 0;
  return el('button', {
    class: 'cs-row' + (c.id === activeId ? ' is-active' : ''),
    type: 'button',
    onclick: () => onPick(c.id),
  }, [
    el('span', { class: 'cs-row__dot', style: { background: safeColor(c.brand_color) } }),
    el('span', { class: 'cs-row__main' }, [
      el('span', { class: 'cs-row__name', text: c.name }),
      c.instagram_handle ? el('span', { class: 'cs-row__sub', text: '@' + String(c.instagram_handle).replace(/^@/, '') }) : null,
    ]),
    pending ? el('span', { class: 'cs-row__badge', text: String(pending), title: `${pending} por aprobar` }) : null,
    c.id === activeId ? el('span', { class: 'cs-row__check' }, [icon('check', 16)]) : null,
  ]);
}

export function openClientSwitcher({ anchor = null, selectClient }) {
  const { clients, activeClientId, me } = store.getState();
  const isStaff = me && me.role !== 'client';
  const visibles = clients.filter((c) => !c.archived);

  openSheet({
    title: 'Tus clientes',
    mode: 'menu',
    anchor,
    build(body, close) {
      const pick = (id) => { close({ source: 'pick' }); selectClient(id); };

      const list = el('div', { class: 'cs-list' });

      const renderList = (filter = '') => {
        while (list.firstChild) list.removeChild(list.firstChild);
        const f = filter.trim().toLowerCase();

        if (isStaff && !f) {
          list.appendChild(el('button', {
            class: 'cs-row cs-row--all' + (activeClientId === 'todos' ? ' is-active' : ''),
            type: 'button',
            onclick: () => pick('todos'),
          }, [
            el('span', { class: 'cs-row__dot cs-row__dot--all' }, [icon('users', 14)]),
            el('span', { class: 'cs-row__main' }, [
              el('span', { class: 'cs-row__name', text: 'Todos los clientes' }),
              el('span', { class: 'cs-row__sub', text: 'Vista global de la agencia' }),
            ]),
            activeClientId === 'todos' ? el('span', { class: 'cs-row__check' }, [icon('check', 16)]) : null,
          ]));
        }

        const matches = visibles.filter((c) => !f || String(c.name).toLowerCase().includes(f));
        for (const c of matches) list.appendChild(clientRow(c, activeClientId, pick));
        if (!matches.length) {
          list.appendChild(el('div', { class: 'cs-empty', text: f ? 'Ningún cliente coincide.' : 'Aún no hay clientes.' }));
        }
      };

      if (visibles.length > 8) {
        const input = el('input', {
          class: 'input cs-filter', type: 'search',
          placeholder: 'Filtrar clientes', 'aria-label': 'Filtrar clientes',
          oninput: (e) => renderList(e.target.value),
        });
        body.appendChild(el('div', { class: 'cs-filter-wrap' }, [input]));
      }

      body.appendChild(list);
      renderList();

      if (isStaff) {
        body.appendChild(el('div', { class: 'cs-foot' }, [
          el('button', {
            class: 'btn cs-new', type: 'button',
            onclick: () => { close({ source: 'new' }); openNewClient({ selectClient }); },
          }, [icon('plus', 18), 'Nuevo cliente']),
        ]));
      }
    },
  });
}

// ── Alta rapida de cliente ───────────────────────────────────────────────────
const PRESET_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

export function openNewClient({ selectClient } = {}) {
  openSheet({
    title: 'Nuevo cliente',
    mode: 'form',
    build(body, close) {
      const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Nombre del cliente', maxlength: '80' });
      const igIn = el('input', { class: 'input', type: 'text', placeholder: '@cuenta (opcional)', maxlength: '60' });
      const colorIn = el('input', { class: 'cs-color', type: 'color', value: PRESET_COLORS[0], 'aria-label': 'Color de marca' });

      const presets = el('div', { class: 'cs-presets' }, PRESET_COLORS.map((c) =>
        el('button', {
          class: 'cs-preset', type: 'button', 'aria-label': `Color ${c}`,
          style: { background: c },
          onclick: () => { colorIn.value = c; },
        })
      ));

      const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear cliente' });
      saveBtn.addEventListener('click', async () => {
        const name = nameIn.value.trim();
        if (!name) { toast('Escribe el nombre del cliente.', { type: 'error' }); nameIn.focus(); return; }
        saveBtn.disabled = true;
        try {
          const created = await api.post('/clients', {
            name,
            brand_color: colorIn.value,
            instagram_handle: igIn.value.trim().replace(/^@/, '') || null,
          });
          const c = (created && created.client) || created;
          await store.refreshClientCounts();
          toast(`Cliente ${name} creado.`, { type: 'success' });
          close({ source: 'saved' });
          if (c && c.id && selectClient) selectClient(c.id);
        } catch (e) {
          toast(e.message || 'No se pudo crear el cliente.', { type: 'error' });
          saveBtn.disabled = false;
        }
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Nombre' }), nameIn]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Instagram' }), igIn]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: 'Color de marca' }),
          el('div', { class: 'cs-color-row' }, [colorIn, presets]),
        ]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => nameIn.focus(), 50);
    },
  });
}
