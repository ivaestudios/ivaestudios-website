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
  ymd, parseDate, avatar,
} from '../api.js?v=202607181835';
import { openSheet, pickFrom } from '../shell/sheet.js?v=202607181835';

// ── Pickers de enum ──────────────────────────────────────────────────────────

export function pickStatus({ current, anchor, title = 'Estado' } = {}) {
  return pickFrom({
    title, anchor,
    options: STATUS_ORDER.map((s) => ({
      value: s, label: STATUSES[s].label, color: STATUSES[s].color, current: s === current,
    })),
  });
}

export function pickApproval({ current, anchor, title = 'Aprobación' } = {}) {
  return pickFrom({
    title, anchor,
    options: Object.keys(APPROVALS).map((k) => ({
      value: k, label: APPROVALS[k].label, color: APPROVALS[k].color, current: k === current,
    })),
  });
}

export function pickType({ current, anchor, title = 'Tipo de contenido' } = {}) {
  return pickFrom({
    title, anchor,
    options: CONTENT_TYPE_ORDER.map((t) => ({
      value: t, label: CONTENT_TYPES[t].label, color: CONTENT_TYPES[t].color, current: t === current,
    })),
  });
}

export function pickPlatform({ current, anchor, allowEmpty = true, title = 'Plataforma' } = {}) {
  const options = PLATFORMS.map((p) => ({ value: p, label: p, current: p === current }));
  if (allowEmpty) options.push({ value: '', label: 'Sin plataforma', current: !current });
  return pickFrom({ title, anchor, options });
}

export function pickGrabacion({ current, anchor, title = 'Prioridad de grabación' } = {}) {
  return pickFrom({
    title, anchor,
    options: GRABACION_LEVELS.map((n) => ({
      value: n, label: `Nivel ${n}${n === 1 ? ' (más urgente)' : n === 5 ? ' (menos urgente)' : ''}`,
      current: Number(current) === n,
    })),
  });
}

export function pickPriority({ current, anchor, title = 'Prioridad' } = {}) {
  return pickFrom({
    title, anchor,
    options: PRIORITY_ORDER.map((p) => ({
      value: p, label: PRIORITIES[p].label, color: PRIORITIES[p].color, current: p === current,
    })),
  });
}

// ── Fecha con atajos ─────────────────────────────────────────────────────────
/**
 * pickDate({current, anchor, title, allowClear}) ->
 *   'YYYY-MM-DD' | '' (quitar fecha) | null (cancelado)
 */
export function pickDate({ current = null, anchor = null, title = 'Fecha de publicación', allowClear = true } = {}) {
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
          { label: 'Hoy', value: plus(0) },
          { label: 'Mañana', value: plus(1) },
          { label: 'En 7 días', value: plus(7) },
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
            class: 'pk-shortcut pk-shortcut--clear', type: 'button', text: 'Quitar fecha',
            onclick: () => choose(''),
          }));
        }

        const input = el('input', { class: 'input pk-date', type: 'date' });
        if (current && parseDate(current)) input.value = String(current).slice(0, 10);

        const ok = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: 'Aceptar',
          onclick: () => { if (input.value) choose(input.value); else close({ source: 'cancel' }); },
        });

        body.append(
          row,
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'O elige un día' }), input]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
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
export function pickPerson({ current = '', users = [], anchor = null, allowFree = true, title = 'Responsable' } = {}) {
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
              el('span', { class: 'pick-row__sub', text: u.role === 'admin' ? 'Administradora' : 'Equipo' }),
            ]),
            name === current ? el('span', { class: 'pick-row__check', text: '✓' }) : null,
          ]));
        }
        list.appendChild(el('button', {
          class: 'pick-row pick-row--clear', type: 'button',
          onclick: () => choose({ user_id: null, name: '' }),
        }, [el('span', { class: 'pick-row__label', text: 'Quitar responsable' })]));
        body.appendChild(list);

        if (allowFree) {
          const input = el('input', {
            class: 'input', type: 'text', placeholder: 'Otra persona (texto libre)',
            maxlength: '60',
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) choose({ user_id: null, name: input.value.trim() });
          });
          body.appendChild(el('div', { class: 'field pk-free' }, [
            el('label', { class: 'label', text: 'O escribe un nombre' }),
            el('div', { class: 'pk-free-row' }, [
              input,
              el('button', {
                class: 'btn', type: 'button', text: 'Usar',
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
export function textExpand({ title = 'Editar texto', value = '', placeholder = '', maxLength = 4000, hint = '' } = {}) {
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
          class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar',
          onclick: () => { picked = ta.value; close({ source: 'save' }); },
        });
        body.append(
          ta,
          hint ? el('div', { class: 'help', text: hint }) : null,
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
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
