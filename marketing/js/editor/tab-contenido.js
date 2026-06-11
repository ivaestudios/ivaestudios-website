// ============================================================================
// IVAE Marketing v2 - Editor de post: tab Contenido.
//
// Filas etiqueta-valor de 48px tap-to-edit (patron Monday movil):
//   Estado / Aprobacion / Fecha / Plataforma / Tipo / Grabacion / Hecho por /
//   Visible para el cliente / Inspiracion URL / Video URL / Notas del equipo
//   + una fila por persona segun note_labels del cliente (merge inmutable de
//   notes_people, mismo patron del backend).
//
// Cada commit de picker = guardado INSTANTANEO de UN campo (optimista via el
// motor de autosave del editor). Avisos contextuales:
//   - apagar visibilidad con aprobacion pendiente -> confirmacion
//   - cambiar tipo con checklist vacia -> toast accionable "Aplicar checklist"
//
// mount(host, ed) -> dispose()
// ============================================================================

import {
  el,
  statusBadge, approvalBadge, chip,
  fmtDate, avatar,
} from '../api.js';
import { pickFrom } from '../shell/sheet.js';
import * as store from '../shell/store.js';
import * as checklistService from '../services/checklist.js';
import { rowButton, rowSwitch, rowUrl, rowTextExpand, emptyValue } from './fields.js';
import { applyChecklistTemplate, contentTypeLabel } from './templates.js';

export function mount(host, ed) {
  const { ctx } = ed;
  const rows = [];
  const root = el('div', { class: 'edtab edtab-contenido' });

  const post = () => ed.getPost();

  function addSection(title, children) {
    root.appendChild(el('div', { class: 'edsection' }, [
      title ? el('h3', { class: 'edsection__title', text: title }) : null,
      el('div', { class: 'edsection__rows' }, children),
    ]));
  }

  // ── Estado ─────────────────────────────────────────────────────────────────
  const rEstado = rowButton({
    label: 'Estado',
    render: (v) => v.appendChild(statusBadge(post().status)),
    onTap: async (anchor) => {
      const next = await ctx.pickers.pickStatus({ current: post().status, anchor });
      if (next === null || next === post().status) return;
      ed.setField('status', next, { immediate: true });
      refreshAll();
    },
  });

  // ── Aprobacion (solo staff; fuerza la decision del cliente) ───────────────
  const rAprobacion = rowButton({
    label: 'Aprobacion',
    render: (v) => v.appendChild(approvalBadge(post().approval_state)),
    onTap: (anchor) => ed.openApprovalPicker(anchor).then(refreshAll),
  });

  // ── Fecha ──────────────────────────────────────────────────────────────────
  const rFecha = rowButton({
    label: 'Fecha de publicacion',
    render: (v) => {
      const d = post().publish_date;
      if (d) v.appendChild(el('span', { class: 'edrow__date', text: fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }) }));
      else v.appendChild(emptyValue('Sin fecha'));
    },
    onTap: async (anchor) => {
      const next = await ctx.pickers.pickDate({ current: post().publish_date, anchor });
      if (next === null) return;
      ed.setField('publish_date', next || null, { immediate: true });
      refreshAll();
    },
  });

  // ── Plataforma ─────────────────────────────────────────────────────────────
  const rPlataforma = rowButton({
    label: 'Plataforma',
    render: (v) => {
      const p = post().platform;
      if (p) v.appendChild(el('span', { class: 'edrow__plain', text: p }));
      else v.appendChild(emptyValue('Sin plataforma'));
    },
    onTap: async (anchor) => {
      const next = await ctx.pickers.pickPlatform({ current: post().platform, anchor });
      if (next === null) return;
      ed.setField('platform', next, { immediate: true });
      refreshAll();
    },
  });

  // ── Tipo (al cambiar, ofrece checklist del tipo si esta vacia) ────────────
  const rTipo = rowButton({
    label: 'Tipo de contenido',
    render: (v) => v.appendChild(chip(post().content_type)),
    onTap: async (anchor) => {
      const next = await ctx.pickers.pickType({ current: post().content_type, anchor });
      if (next === null || next === post().content_type) return;
      ed.setField('content_type', next, { immediate: true });
      refreshAll();
      offerChecklist(next);
    },
  });

  async function offerChecklist(type) {
    if (!checklistService.isAvailable()) return;
    const items = await checklistService.list(ed.postId);
    if (items.length) return;
    ctx.toast(`Checklist de ${contentTypeLabel(type)} disponible.`, {
      type: 'info',
      action: {
        label: 'Aplicar',
        onAction: () => {
          applyChecklistTemplate(ed.postId, type).then((n) => {
            if (n) ctx.toast(`${n} pasos agregados a la checklist.`, { type: 'success' });
          });
        },
      },
    });
  }

  // ── Grabacion ──────────────────────────────────────────────────────────────
  const rGrabacion = rowButton({
    label: 'Grabacion',
    render: (v) => {
      const g = post().grabacion;
      if (g) v.appendChild(el('span', { class: 'edrow__plain', text: `G${g}` }));
      else v.appendChild(emptyValue('Sin prioridad'));
    },
    onTap: async (anchor) => {
      const cur = post().grabacion;
      const next = await pickFrom({
        title: 'Prioridad de grabacion',
        anchor,
        options: [
          { value: '', label: 'Sin prioridad', current: !cur },
          ...[1, 2, 3, 4, 5].map((n) => ({
            value: n,
            label: `G${n}${n === 1 ? ' (mas urgente)' : n === 5 ? ' (menos urgente)' : ''}`,
            current: Number(cur) === n,
          })),
        ],
      });
      if (next === null) return;
      ed.setField('grabacion', next === '' ? null : next, { immediate: true });
      refreshAll();
    },
  });

  // ── Hecho por (staff + texto libre) ───────────────────────────────────────
  const rPersona = rowButton({
    label: 'Hecho por',
    render: (v) => {
      const a = post().assignee;
      if (a) {
        v.appendChild(avatar(a, true));
        v.appendChild(el('span', { class: 'edrow__plain', text: a }));
      } else {
        v.appendChild(emptyValue('Sin responsable'));
      }
    },
    onTap: async (anchor) => {
      const users = await store.loadUsers();
      const res = await ctx.pickers.pickPerson({ current: post().assignee || '', users, anchor });
      if (res === null) return;
      // El server v2 acepta assignee_user_id (y copia name a assignee); el
      // backend viejo simplemente ignora la clave extra.
      ed.setField('assignee', res.name, { immediate: true });
      if (res.user_id !== undefined) ed.setField('assignee_user_id', res.user_id, { immediate: true });
      refreshAll();
    },
  });

  // ── Visible para el cliente ────────────────────────────────────────────────
  const rVisible = rowSwitch({
    label: 'Visible para el cliente',
    sub: 'Aparece en su portal para aprobar',
    get: () => !!post().client_visible,
    onToggle: async (next) => {
      if (!next && post().approval_state === 'pending') {
        const sure = await pickFrom({
          title: 'El cliente dejara de verlo',
          options: [
            { value: 'si', label: 'Ocultar del portal', sub: 'La aprobacion pendiente quedara en pausa' },
            { value: 'no', label: 'Cancelar', current: true },
          ],
        });
        if (sure !== 'si') return false;
      }
      ed.setField('client_visible', next ? 1 : 0, { immediate: true });
      return true;
    },
  });

  // ── URLs ───────────────────────────────────────────────────────────────────
  const rInspo = rowUrl({
    label: 'Inspiracion',
    get: () => post().inspo_url,
    onSave: (v) => ed.setField('inspo_url', v || null, { immediate: true }),
  });
  const rVideo = rowUrl({
    label: 'Video',
    get: () => post().video_url,
    onSave: (v) => ed.setField('video_url', v || null, { immediate: true }),
  });

  // ── Notas ──────────────────────────────────────────────────────────────────
  const rNotas = rowTextExpand({
    label: 'Notas del equipo',
    get: () => post().notes_team,
    onSave: (v) => ed.setField('notes_team', v, { immediate: true }),
    placeholder: 'Notas internas del equipo (el cliente no las ve)',
  });

  // Filas dinamicas por persona segun note_labels del cliente activo.
  const client = ed.getClient();
  const noteLabels = (client && Array.isArray(client.note_labels)) ? client.note_labels : [];
  const personRows = noteLabels.map((person) => rowTextExpand({
    label: `Notas ${person}`,
    get: () => {
      const np = post().notes_people;
      return (np && typeof np === 'object' && np[person]) || '';
    },
    onSave: (v) => {
      const cur = post().notes_people;
      const base = (cur && typeof cur === 'object') ? cur : {};
      const merged = { ...base, [person]: v };
      ed.setField('notes_people', merged, { immediate: true });
    },
    placeholder: `Pendientes o notas para ${person}`,
  }));

  rows.push(
    rEstado, rAprobacion, rFecha, rPlataforma, rTipo, rGrabacion, rPersona,
    rVisible, rInspo, rVideo, rNotas, ...personRows,
  );

  addSection('Flujo', [rEstado.el, rAprobacion.el, rFecha.el]);
  addSection('Formato', [rPlataforma.el, rTipo.el, rGrabacion.el, rPersona.el]);
  addSection('Cliente', [rVisible.el]);
  addSection('Enlaces', [rInspo.el, rVideo.el]);
  addSection('Notas', [rNotas.el, ...personRows.map((r) => r.el)]);

  function refreshAll() {
    for (const r of rows) { try { r.refresh(); } catch { /* noop */ } }
    ed.refreshHeader();
  }

  // El snapshot puede cambiar por fuera (conflicto 409 resuelto, aprobacion).
  const offUpdated = store.on('post:updated', ({ id } = {}) => {
    if (id === ed.postId) refreshAll();
  });

  host.appendChild(root);

  return function dispose() {
    offUpdated();
  };
}
