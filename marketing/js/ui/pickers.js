// ============================================================================
// IVAE Marketing v2 — Pickers tipados (compartidos por TODAS las vistas).
//
// Construidos sobre js/shell/sheet.js (bottom sheet movil / popover desktop).
// Cada picker devuelve una Promise:
//   - null  = cancelado (backdrop, atras, Esc, X)
//   - valor = lo elegido ('' significa "quitar" donde aplica)
//
// pickPerson resuelve {user_id, name} (o null): el server copia name a
// assignee texto para compatibilidad con el frontend viejo.
// ============================================================================

import {
  el,
  STATUSES, STATUS_ORDER,
  CONTENT_TYPES, CONTENT_TYPE_ORDER,
  APPROVALS, PLATFORMS, GRABACION_LEVELS,
  PRIORITIES, PRIORITY_ORDER,
  statusLabel, contentTypeLabel, approvalLabel, priorityLabel,
  ymd, parseDate, avatar,
} from '../api.js?v=202607220055';
import { openSheet, pickFrom } from '../shell/sheet.js?v=202607220055';
import { T } from '../shell/i18n.js?v=202607220055';

// ── Pickers de enum ──────────────────────────────────────────────────────────

export function pickStatus({ current, anchor, title = T('Estado', 'Status') } = {}) {
  return pickFrom({
    title, anchor,
    options: STATUS_ORDER.map((s) => ({
      value: s, label: statusLabel(s), color: STATUSES[s].color, current: s === current,
    })),
  });
}

export function pickApproval({ current, anchor, title = T('Aprobación', 'Approval') } = {}) {
  return pickFrom({
    title, anchor,
    options: Object.keys(APPROVALS).map((k) => ({
      value: k, label: approvalLabel(k), color: APPROVALS[k].color, current: k === current,
    })),
  });
}

export function pickType({ current, anchor, title = T('Tipo de contenido', 'Content type') } = {}) {
  return pickFrom({
    title, anchor,
    options: CONTENT_TYPE_ORDER.map((t) => ({
      value: t, label: contentTypeLabel(t), color: CONTENT_TYPES[t].color, current: t === current,
    })),
  });
}

export function pickPlatform({ current, anchor, allowEmpty = true, title = T('Plataforma', 'Platform') } = {}) {
  const options = PLATFORMS.map((p) => ({ value: p, label: p, current: p === current }));
  if (allowEmpty) options.push({ value: '', label: T('Sin plataforma', 'No platform'), current: !current });
  return pickFrom({ title, anchor, options });
}

export function pickGrabacion({ current, anchor, title = T('Prioridad de grabación', 'Recording priority') } = {}) {
  return pickFrom({
    title, anchor,
    options: GRABACION_LEVELS.map((n) => ({
      value: n, label: `${T('Nivel', 'Level')} ${n}`,
      current: Number(current) === n,
    })),
  });
}

export function pickPriority({ current, anchor, title = T('Prioridad', 'Priority') } = {}) {
  return pickFrom({
    title, anchor,
    options: PRIORITY_ORDER.map((p) => ({
      value: p, label: priorityLabel(p), color: PRIORITIES[p].color, current: p === current,
    })),
  });
}

// ── Fecha con atajos ─────────────────────────────────────────────────────────
/**
 * pickDate({current, anchor, title, allowClear}) ->
 *   'YYYY-MM-DD' | '' (quitar fecha) | null (cancelado)
 */
export function pickDate({ current = null, anchor = null, title = T('Fecha de publicación', 'Publish date'), allowClear = true } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };

    openSheet({
      title, mode: 'picker', anchor,
      onClose: () => settle(picked),
      build(body, close) {
        const today = new Date();
        const plus = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return ymd(d); };
        const choose = (v) => { picked = v; close({ source: 'pick' }); };

        const shortcuts = [
          { label: T('Hoy', 'Today'), value: plus(0) },
          { label: T('Mañana', 'Tomorrow'), value: plus(1) },
          { label: T('En 7 días', 'In 7 days'), value: plus(7) },
        ];
        const row = el('div', { class: 'pk-shortcuts' }, shortcuts.map((s) =>
          el('button', {
            class: 'pk-shortcut' + (current === s.value ? ' is-current' : ''),
            type: 'button', text: s.label,
            onclick: () => choose(s.value),
          })
        ));
        if (allowClear) {
          row.appendChild(el('button', {
            class: 'pk-shortcut pk-shortcut--clear', type: 'button', text: T('Quitar fecha', 'Clear date'),
            onclick: () => choose(''),
          }));
        }

        const input = el('input', { class: 'input pk-date', type: 'date' });
        if (current && parseDate(current)) input.value = String(current).slice(0, 10);

        const ok = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: T('Aceptar', 'OK'),
          onclick: () => { if (input.value) choose(input.value); else close({ source: 'cancel' }); },
        });

        body.append(
          row,
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('O elige un día', 'Or pick a day') }), input]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            ok,
          ]),
        );
      },
    });
  });
}

// ── Persona (staff + texto libre) ────────────────────────────────────────────
/**
 * pickPerson({current, users, anchor, allowFree, title}) ->
 *   {user_id: string|null, name: string} | null (cancelado)
 *   "Quitar" resuelve {user_id: null, name: ''}.
 * `users` = arreglo de GET /users (store.loadUsers()).
 */
export function pickPerson({ current = '', users = [], anchor = null, allowFree = true, title = T('Responsable', 'Assignee') } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };

    openSheet({
      title, mode: 'picker', anchor,
      onClose: () => settle(picked),
      build(body, close) {
        const choose = (v) => { picked = v; close({ source: 'pick' }); };
        const staff = (users || []).filter((u) => u.role !== 'client' && u.active !== 0);

        const list = el('div', { class: 'pick-list' });
        for (const u of staff) {
          const name = u.name || u.email || '';
          list.appendChild(el('button', {
            class: 'pick-row' + (name === current ? ' is-current' : ''), type: 'button',
            onclick: () => choose({ user_id: u.id, name }),
          }, [
            avatar(name, true),
            el('span', { class: 'pick-row__main' }, [
              el('span', { class: 'pick-row__label', text: name }),
              el('span', { class: 'pick-row__sub', text: u.role === 'admin' ? T('Administradora', 'Admin') : T('Equipo', 'Team') }),
            ]),
            name === current ? el('span', { class: 'pick-row__check', text: '✓' }) : null,
          ]));
        }
        list.appendChild(el('button', {
          class: 'pick-row pick-row--clear', type: 'button',
          onclick: () => choose({ user_id: null, name: '' }),
        }, [el('span', { class: 'pick-row__label', text: T('Quitar responsable', 'Remove assignee') })]));
        body.appendChild(list);

        if (allowFree) {
          const input = el('input', {
            class: 'input', type: 'text', placeholder: T('Otra persona (texto libre)', 'Someone else (free text)'),
            maxlength: '60',
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) choose({ user_id: null, name: input.value.trim() });
          });
          body.appendChild(el('div', { class: 'field pk-free' }, [
            el('label', { class: 'label', text: T('O escribe un nombre', 'Or type a name') }),
            el('div', { class: 'pk-free-row' }, [
              input,
              el('button', {
                class: 'btn', type: 'button', text: T('Usar', 'Use'),
                onclick: () => { if (input.value.trim()) choose({ user_id: null, name: input.value.trim() }); },
              }),
            ]),
          ]));
        }
      },
    });
  });
}

// ── Editor expandido de texto ────────────────────────────────────────────────
/**
 * textExpand({title, value, placeholder, maxLength, hint}) ->
 *   string (nuevo texto, puede ser '') | null (cancelado)
 */
export function textExpand({ title = T('Editar texto', 'Edit text'), value = '', placeholder = '', maxLength = 4000, hint = '' } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };

    openSheet({
      title, mode: 'form',
      onClose: () => settle(picked),
      build(body, close) {
        const ta = el('textarea', {
          class: 'input pk-textarea', placeholder, maxlength: String(maxLength),
        });
        ta.value = value || '';
        const save = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
          onclick: () => { picked = ta.value; close({ source: 'save' }); },
        });
        body.append(
          ta,
          hint ? el('div', { class: 'help', text: hint }) : null,
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            save,
          ]),
        );
        // Abrir desde el COMIENZO (no el final), para que captions largos no
        // aparezcan scrolleados hasta abajo. Editable de inmediato (un clic).
        setTimeout(() => { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }, 60);
      },
    });
  });
}
