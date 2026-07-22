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

import { api, el } from '../api.js?v=202607220117';
import { openSheet } from './sheet.js?v=202607220117';
import { toast } from './toast.js?v=202607220117';
import * as store from './store.js?v=202607220117';
import { icon } from './icons.js?v=202607220117';
import { T } from './i18n.js?v=202607220117';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

function clientRow(c, activeId, onPick, onEdit) {
  const pending = c.counts && c.counts.pending > 0 ? c.counts.pending : 0;
  const row = el('button', {
    class: 'cs-row' + (c.id === activeId ? ' is-active' : ''),
    type: 'button',
    onclick: () => onPick(c.id),
  }, [
    el('span', { class: 'cs-row__dot', style: { background: safeColor(c.brand_color) } }),
    el('span', { class: 'cs-row__main' }, [
      el('span', { class: 'cs-row__name', text: c.name }),
      c.instagram_handle ? el('span', { class: 'cs-row__sub', text: '@' + String(c.instagram_handle).replace(/^@/, '') }) : null,
    ]),
    pending ? el('span', { class: 'cs-row__badge', text: String(pending), title: `${pending} ${T('por aprobar', 'pending approval')}` }) : null,
    c.id === activeId ? el('span', { class: 'cs-row__check' }, [icon('check', 16)]) : null,
  ]);
  if (!onEdit) return row;
  // Staff: lápiz para editar la marca (nombre, color, IG, logo) sin salir.
  return el('div', { class: 'cs-rowwrap' }, [
    row,
    el('button', {
      class: 'cs-row__edit', type: 'button',
      'aria-label': `${T('Editar', 'Edit')} ${c.name}`, title: `${T('Editar', 'Edit')} ${c.name}`,
      onclick: (e) => { e.stopPropagation(); onEdit(c); },
    }, [icon('edit', 15)]),
  ]);
}

export function openClientSwitcher({ anchor = null, selectClient }) {
  const { clients, activeClientId, me } = store.getState();
  const isStaff = me && me.role !== 'client';
  const visibles = clients.filter((c) => !c.archived);

  openSheet({
    title: T('Tus clientes', 'Your clients'),
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
              el('span', { class: 'cs-row__name', text: T('Todos los clientes', 'All clients') }),
              el('span', { class: 'cs-row__sub', text: T('Vista global de la agencia', 'Agency-wide view') }),
            ]),
            activeClientId === 'todos' ? el('span', { class: 'cs-row__check' }, [icon('check', 16)]) : null,
          ]));
        }

        const matches = visibles.filter((c) => !f || String(c.name).toLowerCase().includes(f));
        const onEdit = isStaff ? (c) => { close({ source: 'edit' }); openEditClient(c, { selectClient }); } : null;
        for (const c of matches) list.appendChild(clientRow(c, activeClientId, pick, onEdit));
        if (!matches.length) {
          list.appendChild(el('div', { class: 'cs-empty', text: f ? T('Ningún cliente coincide.', 'No clients match.') : T('Aún no hay clientes.', 'No clients yet.') }));
        }
      };

      if (visibles.length > 8) {
        const input = el('input', {
          class: 'input cs-filter', type: 'search',
          placeholder: T('Filtrar clientes', 'Filter clients'), 'aria-label': T('Filtrar clientes', 'Filter clients'),
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
          }, [icon('plus', 18), T('Nuevo cliente', 'New client')]),
        ]));
      }
    },
  });
}

// ── Alta rapida de cliente ───────────────────────────────────────────────────
const PRESET_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

export function openNewClient({ selectClient } = {}) {
  openSheet({
    title: T('Nuevo cliente', 'New client'),
    mode: 'form',
    build(body, close) {
      const nameIn = el('input', { class: 'input', type: 'text', placeholder: T('Nombre del cliente', 'Client name'), maxlength: '80' });
      const igIn = el('input', { class: 'input', type: 'text', placeholder: T('@cuenta (opcional)', '@handle (optional)'), maxlength: '60' });
      const colorIn = el('input', { class: 'cs-color', type: 'color', value: PRESET_COLORS[0], 'aria-label': T('Color de marca', 'Brand color') });

      const presets = el('div', { class: 'cs-presets' }, PRESET_COLORS.map((c) =>
        el('button', {
          class: 'cs-preset', type: 'button', 'aria-label': `Color ${c}`,
          style: { background: c },
          onclick: () => { colorIn.value = c; },
        })
      ));

      const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Crear cliente', 'Create client') });
      saveBtn.addEventListener('click', async () => {
        const name = nameIn.value.trim();
        if (!name) { toast(T('Escribe el nombre del cliente.', 'Enter the client name.'), { type: 'error' }); nameIn.focus(); return; }
        saveBtn.disabled = true;
        try {
          const created = await api.post('/clients', {
            name,
            brand_color: colorIn.value,
            instagram_handle: igIn.value.trim().replace(/^@/, '') || null,
          });
          const c = (created && created.client) || created;
          await store.refreshClientCounts();
          toast(T(`Cliente ${name} creado.`, `Client ${name} created.`), { type: 'success' });
          close({ source: 'saved' });
          if (c && c.id && selectClient) selectClient(c.id);
        } catch (e) {
          toast(e.message || T('No se pudo crear el cliente.', 'Could not create the client.'), { type: 'error' });
          saveBtn.disabled = false;
        }
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Nombre', 'Name') }), nameIn]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Instagram' }), igIn]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: T('Color de marca', 'Brand color') }),
          el('div', { class: 'cs-color-row' }, [colorIn, presets]),
        ]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => nameIn.focus(), 50);
    },
  });
}

// ── Editar marca (nombre, Instagram, color, logo) ────────────────────────────
export function openEditClient(client, { selectClient } = {}) {
  openSheet({
    title: `${T('Editar', 'Edit')} ${client.name}`,
    mode: 'form',
    build(body, close) {
      const nameIn = el('input', { class: 'input', type: 'text', value: client.name || '', maxlength: '80' });
      const igIn = el('input', {
        class: 'input', type: 'text', placeholder: T('@cuenta (opcional)', '@handle (optional)'), maxlength: '60',
        value: client.instagram_handle ? '@' + String(client.instagram_handle).replace(/^@/, '') : '',
      });
      const colorIn = el('input', {
        class: 'cs-color', type: 'color', 'aria-label': T('Color de marca', 'Brand color'),
        value: HEX_RE.test(String(client.brand_color || '')) ? client.brand_color : PRESET_COLORS[0],
      });
      const presets = el('div', { class: 'cs-presets' }, PRESET_COLORS.map((c) =>
        el('button', {
          class: 'cs-preset', type: 'button', 'aria-label': `Color ${c}`,
          style: { background: c },
          onclick: () => { colorIn.value = c; },
        })
      ));
      const logoIn = el('input', {
        class: 'input', type: 'url', placeholder: T('https://… (logo, opcional)', 'https://… (logo, optional)'), maxlength: '500',
        value: client.logo_url || '',
      });
      const mailIn = el('input', {
        class: 'input', type: 'email', placeholder: T('correo@cliente.com (opcional)', 'email@client.com (optional)'), maxlength: '120',
        value: client.contact_email || '',
      });

      // ── Columnas de notas (personas) ──
      // Cada nombre es una columna "Notas <persona>" en el calendario.
      const noteList = el('div', { class: 'cs-notelist' });
      const addNoteRow = (val = '') => {
        const input = el('input', { class: 'input cs-noteinput', type: 'text', placeholder: T('Nombre de la persona', "Person's name"), maxlength: '40', value: val });
        const row = el('div', { class: 'cs-noterow' }, [
          input,
          el('button', {
            class: 'cs-noterm', type: 'button', 'aria-label': T('Quitar', 'Remove'), title: T('Quitar', 'Remove'),
            onclick: () => row.remove(),
          }, [icon('close', 16)]),
        ]);
        noteList.appendChild(row);
        return input;
      };
      const startLabels = Array.isArray(client.note_labels) && client.note_labels.length
        ? client.note_labels : [''];
      for (const l of startLabels) addNoteRow(l);
      const addNoteBtn = el('button', {
        class: 'btn cs-noteadd', type: 'button',
        onclick: () => { addNoteRow(''); },
      }, [icon('plus', 15), el('span', { text: T('Agregar persona', 'Add person') })]);

      const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar cambios', 'Save changes') });
      saveBtn.addEventListener('click', async () => {
        const name = nameIn.value.trim();
        if (!name) { toast(T('El nombre no puede quedar vacío.', 'The name cannot be empty.'), { type: 'error' }); nameIn.focus(); return; }
        const logo = logoIn.value.trim();
        if (logo && !/^https?:\/\//i.test(logo)) { toast(T('El logo debe ser un link http(s).', 'The logo must be an http(s) link.'), { type: 'error' }); logoIn.focus(); return; }
        const mail = mailIn.value.trim();
        if (mail && !mail.includes('@')) { toast(T('Ese correo no se ve válido.', "That email doesn't look valid."), { type: 'error' }); mailIn.focus(); return; }
        const labels = [...noteList.querySelectorAll('.cs-noteinput')]
          .map((i) => i.value.trim()).filter(Boolean);
        saveBtn.disabled = true;
        try {
          await api.patch(`/clients/${client.id}`, {
            name,
            brand_color: colorIn.value,
            instagram_handle: igIn.value.trim().replace(/^@/, '') || null,
            logo_url: logo || null,
            contact_email: mail || null,
            note_labels: labels,
          });
          await store.refreshClientCounts();
          toast(T(`Marca actualizada: ${name}.`, `Brand updated: ${name}.`), { type: 'success' });
          close({ source: 'saved' });
        } catch (e) {
          toast(e.message || T('No se pudo guardar.', 'Could not save.'), { type: 'error' });
          saveBtn.disabled = false;
        }
      });

      const archiveBtn = el('button', {
        class: 'btn btn-danger cs-archive', type: 'button', text: T('Archivar marca', 'Archive brand'),
        title: T('La marca deja de aparecer; sus contenidos no se borran', 'The brand stops appearing; its content is not deleted'),
        onclick: async () => {
          if (!archiveBtn.dataset.armed) {
            archiveBtn.dataset.armed = '1';
            archiveBtn.textContent = T('¿Segura? Toca otra vez', 'Sure? Tap again');
            setTimeout(() => { archiveBtn.dataset.armed = ''; archiveBtn.textContent = T('Archivar marca', 'Archive brand'); }, 3000);
            return;
          }
          try {
            await api.patch(`/clients/${client.id}`, { archived: 1 });
            await store.refreshClientCounts();
            toast(`${client.name} ${T('archivada.', 'archived.')}`, { type: 'success' });
            close({ source: 'archived' });
            const left = (store.getState().clients || []).filter((c) => !c.archived);
            if (selectClient && left.length) selectClient(left[0].id);
          } catch (e) {
            toast(e.message || T('No se pudo archivar.', 'Could not archive.'), { type: 'error' });
          }
        },
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Nombre', 'Name') }), nameIn]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Instagram' }), igIn]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: T('Color de marca', 'Brand color') }),
          el('div', { class: 'cs-color-row' }, [colorIn, presets]),
        ]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Logo (para el reporte)', 'Logo (for the report)') }), logoIn]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Correo del cliente', 'Client email') }), mailIn]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: T('Columnas de notas (personas)', 'Note columns (people)') }),
          el('p', { class: 'cs-notehint', text: T('Cada nombre es una columna "Notas …" en el calendario de esta marca.', 'Each name is a "Notes …" column in this brand\'s calendar.') }),
          noteList,
          addNoteBtn,
        ]),
        (() => {
          const igField = el('div', { class: 'field' }, [
            el('label', { class: 'label', text: T('Instagram (métricas para el reporte)', 'Instagram (metrics for the report)') }),
            client.ig_username
              ? el('div', { class: 'cs-igrow' }, [
                  el('span', { class: 'cs-igok', text: `✅ @${client.ig_username} ${T('conectado', 'connected')}` }),
                  el('button', {
                    class: 'btn', type: 'button', text: T('Desconectar', 'Disconnect'),
                    onclick: async (e) => {
                      e.currentTarget.disabled = true;
                      const r = await fetch('/api/marketing/ig/disconnect', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ client_id: client.id }),
                      });
                      if (r.ok) { await store.refreshClientCounts(); toast(T('Instagram desconectado.', 'Instagram disconnected.'), { type: 'success' }); close({ source: 'ig' }); }
                    },
                  }),
                ])
              : el('button', {
                  class: 'btn cs-igconnect', type: 'button',
                  onclick: async () => {
                    const r = await fetch(`/api/marketing/ig/login?client_id=${client.id}`, { credentials: 'include', redirect: 'manual' });
                    if (r.status === 503) { toast(T('Falta configurar la app de Meta (te paso la guía).', 'The Meta app still needs setup (ask me for the guide).'), { type: 'error' }); return; }
                    window.location.href = `/api/marketing/ig/login?client_id=${client.id}`;
                  },
                }, [icon('camera', 16), el('span', { text: T('Conectar Instagram', 'Connect Instagram') })]),
          ]);
          // Si está conectado: cargar métricas en vivo bajo el estado
          if (client.ig_username) {
            const metricsBox = el('div', { class: 'cs-igmetrics', text: T('Cargando métricas…', 'Loading metrics…') });
            igField.appendChild(metricsBox);
            (async () => {
              try {
                const month = new Date().toISOString().slice(0, 7);
                const r = await fetch(`/api/marketing/ig/metrics?client_id=${client.id}&month=${month}`, { credentials: 'include' });
                const d = await r.json();
                while (metricsBox.firstChild) metricsBox.removeChild(metricsBox.firstChild);
                if (!d || !d.connected || !d.data || d.error) {
                  metricsBox.textContent = d && d.error ? `⚠️ ${d.error}` : T('Aún no hay métricas.', 'No metrics yet.');
                  return;
                }
                const mm = (d.data.months || {})[month] || { posts: 0, likes: 0, comments: 0 };
                const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));
                const stat = (n, l) => el('div', { class: 'cs-igstat' }, [
                  el('div', { class: 'cs-igstat__n', text: fmt(n) }),
                  el('div', { class: 'cs-igstat__l', text: l }),
                ]);
                metricsBox.append(
                  stat(d.data.followers, T('Seguidores', 'Followers')),
                  stat(d.data.reach_28d, T('Alcance (28d)', 'Reach (28d)')),
                  stat(mm.likes + mm.comments, T('Interacciones del mes', 'Interactions this month')),
                  stat(mm.posts, T('Posts publicados', 'Posts published')),
                );
              } catch (e) {
                metricsBox.textContent = T('No se pudieron cargar las métricas.', 'Could not load metrics.');
              }
            })();
          }
          return igField;
        })(),
        el('div', { class: 'sheet__footer' }, [
          archiveBtn,
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          saveBtn,
        ]),
      );
      setTimeout(() => nameIn.focus(), 50);
    },
  });
}
