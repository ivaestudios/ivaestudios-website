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
} from '../api.js?v=202609241154';
import { openSheet, pickFrom, confirmDiscard } from '../shell/sheet.js?v=202609241154';
import { T } from '../shell/i18n.js?v=202609241154';

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

// ── Hora ─────────────────────────────────────────────────────────────────────
const HORAS_SUGERIDAS = ['08:30', '13:00', '19:00'];
/**
 * pickTime({current, anchor, title, allowClear}) ->
 *   'HH:MM' | '' (quitar hora) | null (cancelado)
 * Hora de Cancún (GMT-5): es la que compara el reloj de la app.
 */
export function pickTime({ current = null, anchor = null, title = T('Hora de publicación', 'Publish time'), allowClear = true } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    openSheet({
      title, mode: 'picker', anchor,
      onClose: () => settle(picked),
      build(body, close) {
        const choose = (v) => { picked = v; close({ source: 'pick' }); };
        const row = el('div', { class: 'pk-shortcuts' }, HORAS_SUGERIDAS.map((h) =>
          el('button', { class: 'pk-shortcut' + (current === h ? ' is-current' : ''), type: 'button', text: h, onclick: () => choose(h) })
        ));
        if (allowClear) {
          row.appendChild(el('button', { class: 'pk-shortcut pk-shortcut--clear', type: 'button', text: T('Quitar hora', 'Clear time'), onclick: () => choose('') }));
        }
        const input = el('input', { class: 'input pk-date', type: 'time', step: '300' });
        if (current && /^\d{2}:\d{2}/.test(String(current))) input.value = String(current).slice(0, 5);
        const ok = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: T('Aceptar', 'OK'),
          onclick: () => { if (input.value) choose(input.value.slice(0, 5)); else close({ source: 'cancel' }); },
        });
        body.append(
          row,
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('O escribe la hora (Cancún)', 'Or type the time (Cancún)') }), input]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            ok,
          ]),
        );
      },
    });
  });
}

// ── Programar (fecha + hora + redes) ─────────────────────────────────────────
/**
 * pickSchedule({post, client, anchor, canProgram}) ->
 *   { fields: {publish_date, publish_time, also_facebook, also_tiktok, also_youtube}, programar: bool }
 *   | null (cancelado)
 * Pedido de Vianey (24-sep-2026): "programar en el calendario con hora, solo
 * me deja el día; y que cuando se pongan las plataformas se publique en esas".
 * Instagram no lleva interruptor: si la marca lo tiene conectado, el reloj
 * SIEMPRE publica ahí (así funciona el programador); las demás redes son
 * los interruptores also_* que ya usaba el editor.
 */
export function pickSchedule({ post, client = null, anchor = null, canProgram = true } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    const c = client || {};
    openSheet({
      title: T('Programar publicación', 'Schedule post'), mode: 'form', anchor,
      onClose: () => settle(picked),
      build(body, close) {
        const today = new Date();
        const plus = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return ymd(d); };

        // Fecha
        const dateIn = el('input', { class: 'input pk-date', type: 'date' });
        if (post.publish_date && parseDate(post.publish_date)) dateIn.value = String(post.publish_date).slice(0, 10);
        const dateBtns = [
          { label: T('Hoy', 'Today'), value: plus(0) },
          { label: T('Mañana', 'Tomorrow'), value: plus(1) },
          { label: T('En 7 días', 'In 7 days'), value: plus(7) },
        ].map((sc) => {
          const b = el('button', { class: 'pk-shortcut', type: 'button', text: sc.label, onclick: () => { dateIn.value = sc.value; marcar(); } });
          b.dataset.v = sc.value;
          return b;
        });
        const dateRow = el('div', { class: 'pk-shortcuts' }, dateBtns);

        // Hora
        const timeIn = el('input', { class: 'input pk-date', type: 'time', step: '300' });
        if (post.publish_time && /^\d{2}:\d{2}/.test(String(post.publish_time))) timeIn.value = String(post.publish_time).slice(0, 5);
        const timeBtns = HORAS_SUGERIDAS.map((h) => el('button', { class: 'pk-shortcut', type: 'button', text: h, onclick: () => { timeIn.value = h; marcar(); } }));
        const timeRow = el('div', { class: 'pk-shortcuts' }, timeBtns);
        function marcar() {
          dateBtns.forEach((b) => b.classList.toggle('is-current', !!dateIn.value && dateIn.value === b.dataset.v));
          timeBtns.forEach((b) => b.classList.toggle('is-current', timeIn.value === b.textContent));
        }
        dateIn.addEventListener('input', marcar); timeIn.addEventListener('input', marcar); marcar();

        // Redes: solo se pueden prender las que la marca tiene conectadas.
        const irAConexiones = () => {
          close({ source: 'cancel' });
          location.hash = '#/conexiones' + (post.client_id ? `?cliente=${encodeURIComponent(post.client_id)}` : '');
        };
        const redes = [
          { key: null, label: 'Instagram', conectada: !!c.ig_username, detalle: c.ig_username ? '@' + c.ig_username : '', on: true },
          { key: 'also_facebook', label: 'Facebook', conectada: !!c.fb_page_name, detalle: c.fb_page_name || '', on: Number(post.also_facebook) === 1 },
          { key: 'also_tiktok', label: 'TikTok', conectada: !!c.tt_username, detalle: c.tt_username ? '@' + c.tt_username : '', on: Number(post.also_tiktok) === 1 },
          { key: 'also_youtube', label: 'YouTube', conectada: !!c.yt_channel_title, detalle: c.yt_channel_title || '', on: Number(post.also_youtube) === 1 },
        ];
        const boxes = {};
        const redesEl = el('div', { class: 'pk-redes' }, redes.map((r) => {
          const box = el('input', { type: 'checkbox' });
          box.checked = r.conectada && r.on;
          box.disabled = !r.conectada || r.key === null;
          if (r.key) boxes[r.key] = box;
          return el('label', { class: 'pk-red' + (r.conectada ? '' : ' pk-red--off') }, [
            box,
            el('span', { class: 'pk-red__txt' }, [
              el('b', { text: r.label }),
              el('small', { text: r.conectada
                ? (r.key === null ? `${r.detalle} · ${T('siempre', 'always')}` : r.detalle)
                : T('No conectada', 'Not connected') }),
            ]),
            r.conectada ? null : el('button', { class: 'pk-red__link', type: 'button', text: T('Conectar', 'Connect'), onclick: irAConexiones }),
          ].filter(Boolean));
        }));
        const algunaRed = () => redes[0].conectada || Object.values(boxes).some((b) => b.checked);

        const campos = () => ({
          publish_date: dateIn.value || null,
          publish_time: timeIn.value ? timeIn.value.slice(0, 5) : null,
          also_facebook: boxes.also_facebook && boxes.also_facebook.checked ? 1 : 0,
          also_tiktok: boxes.also_tiktok && boxes.also_tiktok.checked ? 1 : 0,
          also_youtube: boxes.also_youtube && boxes.also_youtube.checked ? 1 : 0,
        });
        const aviso = el('p', { class: 'pk-hint pk-hint--error', hidden: true });
        const guardar = el('button', {
          class: 'btn', type: 'button', text: T('Guardar', 'Save'),
          onclick: () => { picked = { fields: campos(), programar: false }; close({ source: 'pick' }); },
        });
        const programar = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: T('Programar', 'Schedule'),
          onclick: () => {
            const f = campos();
            let falta = '';
            if (!f.publish_date) falta = T('Elige el día.', 'Pick the day.');
            else if (!f.publish_time) falta = T('Elige la hora: sin hora la app no publica.', 'Pick the time: without a time the app does not publish.');
            else if (!algunaRed()) falta = T('Conecta al menos una red para esta marca.', 'Connect at least one network for this brand.');
            if (falta) { aviso.textContent = falta; aviso.hidden = false; return; }
            picked = { fields: f, programar: true }; close({ source: 'pick' });
          },
        });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Día', 'Day') }), dateRow, dateIn]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Hora (Cancún)', 'Time (Cancún)') }), timeRow, timeIn]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Redes donde se publica', 'Networks to publish on') }), redesEl]),
          el('p', { class: 'pk-hint', text: T('"Programar" deja la pieza lista y la app la publica sola a esa hora. Súbele el video o la imagen antes.', '"Schedule" leaves the piece ready and the app publishes it on its own at that time. Upload the video or image before then.') }),
          aviso,
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            guardar,
            ...(canProgram ? [programar] : []),
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
    const initial = value || '';
    let ta = null;
    let sheetRef = null;

    sheetRef = openSheet({
      title, mode: 'form',
      onClose: () => settle(picked),
      // No tirar lo escrito sin preguntar: el boton atras del telefono, Esc,
      // el backdrop o la X caen todos aqui. Solo pregunta si hay cambios.
      confirmClose() {
        if (!ta || !sheetRef || ta.value === initial) return true;
        confirmDiscard().then((yes) => {
          if (yes) sheetRef.close({ force: true });
          else if (ta) { try { ta.focus(); } catch { /* noop */ } }
        });
        return false;
      },
      build(body, close) {
        ta = el('textarea', {
          class: 'input pk-textarea', placeholder, maxlength: String(maxLength),
        });
        ta.value = value || '';
        const save = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
          onclick: () => { picked = ta.value; close({ source: 'save' }); },
        });
        // OJO: Node.append() es el nativo, NO el helper el(): un `null` en la
        // lista se pinta como el TEXTO literal "null" debajo del textarea. Se
        // filtra antes. (Pasaba en todos los llamadores sin `hint`: "Pedir
        // cambios" del editor y todos los campos largos de editor/fields.js.)
        body.append(...[
          ta,
          hint ? el('div', { class: 'help', text: hint }) : null,
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
            save,
          ]),
        ].filter(Boolean));
        // Abrir desde el COMIENZO (no el final), para que captions largos no
        // aparezcan scrolleados hasta abajo. Editable de inmediato (un clic).
        setTimeout(() => { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }, 60);
      },
    });
  });
}
