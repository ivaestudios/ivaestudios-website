// ============================================================================
// IVAE Marketing v2 - Vista Meses (la pantalla principal de Vianey).
// Ruta: #/meses
//
// Replica fiel de su flujo en Notion: "una pagina por marca y mes". Dentro de
// la marca activa se ven SECCIONES POR MES colapsables (FEBRERO 2026 + conteo)
// y, en cada una, UNA tabla simple estilo Notion:
//   Grabacion | Tarea | Plataforma | Tipo | Estado | Captions |
//   Notas <persona segun client.note_labels> ... | Inspo | Video final
//
// - Edicion inline en cada celda: enums via ctx.pickers (sheet/popover
//   compartido), textos en la celda misma (blur o Enter guarda, Esc cancela),
//   URLs via mini-form en ctx.sheet.
// - "+ Nueva linea" al fondo de cada seccion (Enter crea y deja el foco listo
//   para la siguiente, flujo Notion). "+ Agregar mes" al final.
// - Movil (<768px): misma estructura por mes, cada fila en 2 renglones
//   (titulo que abre el editor + chips que abren su picker).
// - Datos SOLO del store global (loadPosts del shell); cero fetch propio.
// - Prefs por usuario y cliente: collapsedGroups.meses.<clientId> (colapso)
//   y mesesExtra.<clientId> (meses vacios agregados a mano).
//
// Contrato de vista: export default { mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import {
  el, clear,
  STATUSES, CONTENT_TYPES,
  statusLabel, contentTypeLabel, fmtDate,
} from '../api.js';
import { icon } from '../shell/icons.js';

// Colores de los chips de grabacion (los de su Notion):
// 1=ambar, 2=morado, 3=gris, 4=azul, 5=rosa.
const GRAB_COLORS = {
  1: '#f59e0b',
  2: '#8b5cf6',
  3: '#64748b',
  4: '#3b82f6',
  5: '#ec4899',
};

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const SIN_MES = 'sin';

// ── Estado del modulo (efimero, JAMAS en store ni localStorage) ──────────────
let ctx = null;
let rootEl = null;
let sectionsEl = null;
let unsubs = [];
let mq = null;            // matchMedia(min-width: 768px)
let mqHandler = null;
let renderQueued = false;
let renderPending = false;  // llego un render mientras se editaba una celda
let inlineEditing = false;  // hay un input/textarea inline abierto
let composer = null;        // { key:'YYYY-MM'|'sin', value:string, wantFocus:bool }
let composerInput = null;   // input vivo del composer (para restaurar foco)
let visibleKeys = new Set();// meses visibles del ultimo render (para Agregar mes)

// ── Helpers de fechas / agrupacion ───────────────────────────────────────────

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isYM(s) { return /^\d{4}-\d{2}$/.test(String(s || '')); }

function monthKeyOf(post) {
  const s = String((post && post.publish_date) || '').slice(0, 7);
  return isYM(s) ? s : null;
}

/** "febrero 2026" (el uppercase lo pone el CSS del encabezado). */
function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const name = MONTHS_ES[(m || 1) - 1] || '';
  return `${name} ${y || ''}`.trim();
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const da = String(a.publish_date || '9999-99-99');
    const db = String(b.publish_date || '9999-99-99');
    if (da !== db) return da < db ? -1 : 1;
    const pa = Number(a.position) || 0;
    const pb = Number(b.position) || 0;
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function nextPosition(rows) {
  let max = 0;
  for (const p of rows || []) {
    const n = Number(p.position);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1000;
}

function notesOf(post) {
  return (post && post.notes_people && typeof post.notes_people === 'object')
    ? post.notes_people
    : {};
}

/** URL valida http(s) o null (regla de seguridad: hrefs solo via new URL). */
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* invalida */ }
  return null;
}

function shortUrl(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h.length > 18 ? `${h.slice(0, 17)}…` : h;
  } catch { return 'enlace'; }
}

// ── Prefs (colapso por mes + meses vacios agregados a mano) ──────────────────

function clientKey() {
  const { activeClientId } = ctx.store.getState();
  return activeClientId || 'todos';
}

function collapseKey() { return `collapsedGroups.meses.${clientKey()}`; }
function extraKey() { return `mesesExtra.${clientKey()}`; }

function getCollapseMap() {
  const m = ctx.prefs.get(collapseKey(), {});
  return (m && typeof m === 'object') ? m : {};
}

function isCollapsed(key, collapseMap) {
  if (Object.prototype.hasOwnProperty.call(collapseMap, key)) return !!collapseMap[key];
  // Default: el mes actual expandido, el resto (y "Sin mes") colapsado.
  return key !== currentYM();
}

function setCollapsed(key, collapsed) {
  const m = getCollapseMap();
  m[key] = !!collapsed;
  ctx.prefs.set(collapseKey(), m);
}

function getExtraMonths() {
  const list = ctx.prefs.get(extraKey(), []);
  return Array.isArray(list) ? list.filter(isYM) : [];
}

// ── Render scheduling ────────────────────────────────────────────────────────

function scheduleRender() {
  if (!rootEl) return;
  if (inlineEditing) { renderPending = true; return; }
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// ── Mutaciones (el store es optimista + rollback + toast de error) ───────────

async function patchWithUndo(post, fields, prevFields, msg) {
  const res = await ctx.store.patchPost(post.id, fields);
  if (res) {
    ctx.toast(msg, {
      type: 'success',
      action: { label: 'Deshacer', onAction: () => { ctx.store.patchPost(post.id, prevFields); } },
    });
  }
}

async function onPickGrabacion(post, anchor) {
  const v = await ctx.pickers.pickGrabacion({ current: post.grabacion, anchor });
  if (v == null || Number(v) === Number(post.grabacion)) return;
  patchWithUndo(post,
    { grabacion: Number(v) },
    { grabacion: post.grabacion == null || post.grabacion === '' ? null : Number(post.grabacion) },
    `Grabación: nivel ${v}.`);
}

async function onPickStatus(post, anchor) {
  const v = await ctx.pickers.pickStatus({ current: post.status, anchor });
  if (v == null || v === post.status) return;
  patchWithUndo(post, { status: v }, { status: post.status }, `Estado: ${statusLabel(v) || v}.`);
}

async function onPickType(post, anchor) {
  const v = await ctx.pickers.pickType({ current: post.content_type, anchor });
  if (v == null || v === post.content_type) return;
  patchWithUndo(post, { content_type: v }, { content_type: post.content_type },
    `Tipo: ${contentTypeLabel(v) || v}.`);
}

async function onPickPlatform(post, anchor) {
  const cur = post.platform || '';
  const v = await ctx.pickers.pickPlatform({ current: cur, anchor });
  if (v == null || v === cur) return;
  patchWithUndo(post, { platform: v || null }, { platform: cur || null },
    v ? `Plataforma: ${v}.` : 'Plataforma quitada.');
}

async function onPickDate(post, anchor) {
  const cur = post.publish_date || null;
  const v = await ctx.pickers.pickDate({ current: cur, anchor });
  if (v == null || v === cur || (v === '' && !cur)) return;
  // '' = quitar fecha (la fila pasa a la seccion "Sin mes"); 'YYYY-MM-DD' = mover.
  patchWithUndo(post, { publish_date: v || null }, { publish_date: cur },
    v ? `Fecha: ${fmtDate(v, { day: 'numeric', month: 'long' })}.` : 'Fecha quitada.');
}

// ── Edicion inline de texto (titulo, captions, notas por persona) ────────────

/**
 * Abre un editor inline dentro de la celda. multiline=true usa textarea
 * flotante (no brinca la altura de la fila); si no, input en el lugar.
 * Enter guarda (Shift+Enter = salto en textarea), Esc cancela, blur guarda.
 */
function openInlineEdit({ cell, current, label, maxLength = 2000, multiline = false, onSave }) {
  if (inlineEditing) return;
  inlineEditing = true;
  cell.classList.add('is-editing');

  const field = multiline
    ? el('textarea', { class: 'meses-edit', rows: '4', maxlength: String(maxLength), 'aria-label': label })
    : el('input', { class: 'meses-edit meses-edit--line', type: 'text', maxlength: String(maxLength), 'aria-label': label });
  field.value = current || '';

  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    inlineEditing = false;
    const value = field.value;
    const changed = value.trim() !== String(current || '').trim();
    if (save && changed) {
      onSave(value);
    } else {
      // Nada que guardar: restaura la celda original.
      render();
    }
    if (renderPending) { renderPending = false; render(); }
  };

  field.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); return; }
    if (e.key === 'Enter' && (!multiline || !e.shiftKey)) { e.preventDefault(); finish(true); }
  });
  field.addEventListener('blur', () => finish(true));

  cell.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  } catch { /* noop */ }
}

function saveTitle(post, value) {
  const title = String(value || '').trim();
  if (!title) { render(); return; }
  patchWithUndo(post, { title }, { title: post.title }, 'Título actualizado.');
}

function saveCaption(post, value) {
  const caption = String(value || '').trim() || null;
  patchWithUndo(post, { caption }, { caption: post.caption || null }, 'Caption guardado.');
}

function saveNote(post, person, value) {
  // Merge inmutable: el backend guarda el objeto notes_people COMPLETO.
  const prev = { ...notesOf(post) };
  const merged = { ...prev };
  const txt = String(value || '').trim();
  if (txt) merged[person] = txt;
  else delete merged[person];
  patchWithUndo(post, { notes_people: merged }, { notes_people: prev }, `Nota de ${person} guardada.`);
}

// ── Panel lateral de caption (estilo side peek de Notion) ────────────────────
// Los captions son largos: la celda solo muestra un preview y el panel lateral
// da espacio completo para leer y editar. Vive en document.body (sobrevive a
// los re-renders de la tabla).

let drawerEl = null;

function closeCaptionDrawer() {
  if (!drawerEl) return;
  try { drawerEl.remove(); } catch { /* noop */ }
  drawerEl = null;
  document.removeEventListener('keydown', onDrawerKeydown, true);
}

function onDrawerKeydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeCaptionDrawer(); }
}

function openCaptionDrawer(post) {
  closeCaptionDrawer();

  const ta = el('textarea', {
    class: 'meses-drawer__ta',
    placeholder: 'Escribe el caption completo aquí...',
    maxLength: 4000,
  });
  ta.value = post.caption || '';

  const save = () => {
    const v = ta.value;
    closeCaptionDrawer();
    if ((v || '').trim() !== (post.caption || '').trim()) saveCaption(post, v);
  };

  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
  });

  drawerEl = el('div', { class: 'meses-drawer__wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Caption de ${post.title || 'contenido'}` }, [
    el('div', { class: 'meses-drawer__overlay', onclick: () => closeCaptionDrawer() }),
    el('aside', { class: 'meses-drawer' }, [
      el('header', { class: 'meses-drawer__head' }, [
        el('div', { class: 'meses-drawer__titles' }, [
          el('span', { class: 'meses-drawer__kicker', text: 'Caption' }),
          el('h3', { class: 'meses-drawer__title', text: post.title || 'Sin título' }),
        ]),
        el('button', {
          class: 'meses-drawer__close', type: 'button', 'aria-label': 'Cerrar',
          onclick: () => closeCaptionDrawer(),
        }, [icon('close', 18)]),
      ]),
      ta,
      el('footer', { class: 'meses-drawer__foot' }, [
        el('span', { class: 'meses-drawer__hint', text: 'Cmd+Enter guarda · Esc cierra' }),
        el('div', { class: 'meses-drawer__actions' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => closeCaptionDrawer() }),
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Guardar', onclick: save }),
        ]),
      ]),
    ]),
  ]);

  document.body.appendChild(drawerEl);
  document.addEventListener('keydown', onDrawerKeydown, true);
  // Reflow forzado en lugar de rAF: rAF se congela en pestanas tapadas y la
  // transicion de entrada nunca corria (el panel quedaba invisible).
  void drawerEl.offsetWidth;
  drawerEl.classList.add('is-open');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ── Enlaces (Inspo / Video final) ────────────────────────────────────────────

function openUrlSheet(post, field, title) {
  const current = safeUrl(post[field]) || '';
  const msgSaved = 'Enlace guardado.';
  ctx.sheet.openSheet({
    title,
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input meses-urlinput', type: 'url', inputmode: 'url',
        placeholder: 'https://...', 'aria-label': title,
      });
      input.value = current;
      const help = el('div', { class: 'help meses-urlhelp', text: 'Pega un enlace que empiece con http:// o https://' });

      const save = () => {
        const raw = input.value.trim();
        if (!raw) {
          if (current) {
            close({ source: 'save' });
            patchWithUndo(post, { [field]: null }, { [field]: current }, 'Enlace quitado.');
          } else {
            close({ source: 'cancel' });
          }
          return;
        }
        const url = safeUrl(raw);
        if (!url) {
          help.textContent = 'Ese enlace no es válido. Debe empezar con http:// o https://';
          help.classList.add('meses-urlhelp--error');
          input.focus();
          return;
        }
        close({ source: 'save' });
        patchWithUndo(post, { [field]: url }, { [field]: current || null }, msgSaved);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
      });

      const footer = el('div', { class: 'sheet__footer' }, [
        el('button', {
          class: 'btn', type: 'button', text: 'Cancelar',
          onclick: () => close({ source: 'cancel' }),
        }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Guardar', onclick: save }),
      ]);

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Enlace' }), input]),
        help,
      );
      if (current) {
        body.appendChild(el('button', {
          class: 'meses-urlremove', type: 'button', text: 'Quitar enlace',
          onclick: () => {
            close({ source: 'save' });
            patchWithUndo(post, { [field]: null }, { [field]: current }, 'Enlace quitado.');
          },
        }));
      }
      body.appendChild(footer);
      setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 60);
    },
  });
}

// ── Builders de celdas (desktop) ─────────────────────────────────────────────

function grabChipNode(g) {
  const n = Number(g);
  if (!n || !GRAB_COLORS[n]) return el('span', { class: 'meses-muted', text: '+' });
  const chip = el('span', { class: 'meses-grabchip', text: String(n) });
  chip.style.setProperty('--chipc', GRAB_COLORS[n]);
  return chip;
}

function statusPillNode(status) {
  const def = STATUSES[status];
  const pill = el('span', { class: 'meses-pill' }, [
    el('span', { class: 'meses-pill__dot', 'aria-hidden': 'true' }),
    el('span', { text: statusLabel(status) || 'Sin estado' }),
  ]);
  pill.style.setProperty('--chipc', (def && def.color) || 'var(--text-mute)');
  return pill;
}

function typePillNode(type) {
  if (!type) return el('span', { class: 'meses-muted', text: '+' });
  const def = CONTENT_TYPES[type];
  const pill = el('span', { class: 'meses-pill' }, [
    el('span', { class: 'meses-pill__dot', 'aria-hidden': 'true' }),
    el('span', { text: contentTypeLabel(type) }),
  ]);
  pill.style.setProperty('--chipc', (def && def.color) || 'var(--text-mute)');
  return pill;
}

function platformNode(platform) {
  const p = String(platform || '').trim();
  if (!p) return el('span', { class: 'meses-muted', text: '+' });
  return el('span', { class: 'meses-pill meses-pill--plain', text: p });
}

function cellButton(content, onClick, aria) {
  return el('button', {
    class: 'meses-cellbtn', type: 'button',
    'aria-label': aria || null,
    'aria-haspopup': 'dialog',
    onclick: (e) => onClick(e.currentTarget),
  }, [content]);
}

function textCellNode(value, placeholder) {
  const txt = String(value || '').trim();
  if (!txt) return el('span', { class: 'meses-muted meses-text', text: placeholder });
  return el('span', { class: 'meses-text', text: txt, title: txt });
}

function buildUrlCell(post, field, label) {
  const td = el('td', { class: 'meses-td meses-td--url' });
  const url = safeUrl(post[field]);
  if (!url) {
    td.appendChild(cellButton(
      el('span', { class: 'meses-muted', text: '+' }),
      () => openUrlSheet(post, field, label),
      `Agregar ${label}`,
    ));
    return td;
  }
  const link = el('a', {
    class: 'meses-url__a', href: url, target: '_blank', rel: 'noopener noreferrer', title: url,
  }, [icon('link', 13), el('span', { text: shortUrl(url) })]);
  const editBtn = el('button', {
    class: 'meses-url__edit', type: 'button', 'aria-label': `Cambiar ${label}`,
    onclick: () => openUrlSheet(post, field, label),
  }, [icon('edit', 13)]);
  td.appendChild(el('span', { class: 'meses-url' }, [link, editBtn]));
  return td;
}

function buildRow(post, noteLabels) {
  const tr = el('tr', { class: 'meses-row', dataset: { id: String(post.id) } });

  // Grabacion (sticky)
  const tdGrab = el('td', { class: 'meses-td meses-col--grab' }, [
    cellButton(
      grabChipNode(post.grabacion),
      (anchor) => onPickGrabacion(post, anchor),
      post.grabacion ? `Grabación nivel ${post.grabacion}, cambiar` : 'Asignar grabación',
    ),
  ]);

  // Tarea (sticky): texto editable inline + affordance de abrir el editor.
  const tdTask = el('td', { class: 'meses-td meses-col--task' });
  const titleBtn = el('button', {
    class: 'meses-task__txt', type: 'button',
    title: post.title || '',
    onclick: () => openInlineEdit({
      cell: tdTask,
      current: post.title || '',
      label: 'Tarea',
      maxLength: 300,
      multiline: false,
      onSave: (v) => saveTitle(post, v),
    }),
  }, [el('span', { class: 'meses-task__label', text: post.title || 'Sin título' })]);
  const openBtn = el('button', {
    class: 'meses-task__open', type: 'button', 'aria-label': 'Abrir en el editor',
    title: 'Abrir',
    onclick: () => ctx.openEditor(post.id),
  }, [icon('edit', 14)]);
  tdTask.appendChild(el('span', { class: 'meses-task' }, [titleBtn, openBtn]));

  // Plataforma / Tipo / Estado (pickers compartidos)
  const tdPlat = el('td', { class: 'meses-td' }, [
    cellButton(platformNode(post.platform), (a) => onPickPlatform(post, a),
      post.platform ? `Plataforma ${post.platform}, cambiar` : 'Asignar plataforma'),
  ]);
  const tdType = el('td', { class: 'meses-td' }, [
    cellButton(typePillNode(post.content_type), (a) => onPickType(post, a),
      post.content_type ? `Tipo ${contentTypeLabel(post.content_type)}, cambiar` : 'Asignar tipo'),
  ]);
  const tdStatus = el('td', { class: 'meses-td' }, [
    cellButton(statusPillNode(post.status), (a) => onPickStatus(post, a),
      `Estado ${statusLabel(post.status) || 'sin estado'}, cambiar`),
  ]);

  // Fecha publicacion (columna real de su Notion; editar puede mover de mes)
  const tdDate = el('td', { class: 'meses-td meses-td--date' }, [
    cellButton(
      post.publish_date
        ? el('span', { class: 'meses-date', text: fmtDate(post.publish_date, { day: 'numeric', month: 'long' }) })
        : el('span', { class: 'meses-empty', text: 'Fecha' }),
      (a) => onPickDate(post, a),
      post.publish_date ? `Fecha ${fmtDate(post.publish_date, { day: 'numeric', month: 'long' })}, cambiar` : 'Asignar fecha',
    ),
  ]);

  // Captions: panel lateral (los captions largos no caben en la celda).
  const tdCaption = el('td', { class: 'meses-td meses-td--text' });
  tdCaption.appendChild(cellButton(
    textCellNode(post.caption, 'Agregar caption'),
    () => openCaptionDrawer(post),
    'Abrir caption completo',
  ));

  // Orden EXACTO de su Notion: Grab | Tarea | Estado | Fecha | Plataforma | Tipo | Captions
  tr.append(tdGrab, tdTask, tdStatus, tdDate, tdPlat, tdType, tdCaption);

  // Notas por persona (una columna por note_label del cliente)
  const notes = notesOf(post);
  for (const person of noteLabels) {
    const td = el('td', { class: 'meses-td meses-td--text' });
    td.appendChild(cellButton(
      textCellNode(notes[person], 'Agregar nota'),
      () => openInlineEdit({
        cell: td,
        current: notes[person] || '',
        label: `Notas ${person}`,
        maxLength: 2000,
        multiline: true,
        onSave: (v) => saveNote(post, person, v),
      }),
      `Editar notas de ${person}`,
    ));
    tr.appendChild(td);
  }

  tr.append(
    buildUrlCell(post, 'inspo_url', 'Inspo'),
    buildUrlCell(post, 'video_url', 'Video final'),
  );
  return tr;
}

function buildTable(rows, noteLabels) {
  const headCells = [
    el('th', { class: 'meses-col--grab', text: 'Grab.', scope: 'col', title: 'Grabación' }),
    el('th', { class: 'meses-col--task', text: 'Tarea', scope: 'col' }),
    el('th', { text: 'Estado', scope: 'col' }),
    el('th', { text: 'Fecha publicación', scope: 'col' }),
    el('th', { text: 'Plataforma', scope: 'col' }),
    el('th', { text: 'Tipo', scope: 'col' }),
    el('th', { text: 'Captions', scope: 'col' }),
    ...noteLabels.map((p) => el('th', { text: `Notas ${p}`, scope: 'col' })),
    el('th', { text: 'Inspo', scope: 'col' }),
    el('th', { text: 'Video final', scope: 'col' }),
  ];
  const table = el('table', { class: 'meses-table' }, [
    el('thead', {}, [el('tr', {}, headCells)]),
    el('tbody', {}, rows.map((p) => buildRow(p, noteLabels))),
  ]);
  return el('div', { class: 'meses-tablewrap' }, [table]);
}

// ── Filas movil (2 renglones: titulo + chips) ────────────────────────────────

function mobileChip({ text, color, ghost, aria, onTap }) {
  const b = el('button', {
    class: 'meses-chip' + (ghost ? ' meses-chip--ghost' : ''),
    type: 'button', 'aria-label': aria, 'aria-haspopup': 'dialog',
    onclick: (e) => onTap(e.currentTarget),
  }, [el('span', { text })]);
  if (color) b.style.setProperty('--chipc', color);
  return b;
}

function buildMobileItem(post) {
  const grab = Number(post.grabacion);
  const typeDef = CONTENT_TYPES[post.content_type];
  const statusDef = STATUSES[post.status];

  const chips = el('div', { class: 'meses-item__chips' }, [
    mobileChip({
      text: grab && GRAB_COLORS[grab] ? `G${grab}` : 'Grab.',
      color: grab ? GRAB_COLORS[grab] : null,
      ghost: !grab,
      aria: grab ? `Grabación nivel ${grab}, cambiar` : 'Asignar grabación',
      onTap: (a) => onPickGrabacion(post, a),
    }),
    mobileChip({
      text: post.content_type ? contentTypeLabel(post.content_type) : 'Tipo',
      color: post.content_type ? ((typeDef && typeDef.color) || null) : null,
      ghost: !post.content_type,
      aria: post.content_type ? `Tipo ${contentTypeLabel(post.content_type)}, cambiar` : 'Asignar tipo',
      onTap: (a) => onPickType(post, a),
    }),
    mobileChip({
      text: post.platform || 'Plataforma',
      ghost: !post.platform,
      aria: post.platform ? `Plataforma ${post.platform}, cambiar` : 'Asignar plataforma',
      onTap: (a) => onPickPlatform(post, a),
    }),
    mobileChip({
      text: statusLabel(post.status) || 'Estado',
      color: (statusDef && statusDef.color) || null,
      ghost: !STATUSES[post.status],
      aria: `Estado ${statusLabel(post.status) || 'sin estado'}, cambiar`,
      onTap: (a) => onPickStatus(post, a),
    }),
    mobileChip({
      text: post.publish_date ? fmtDate(post.publish_date) : 'Fecha',
      ghost: !post.publish_date,
      aria: post.publish_date ? `Fecha ${fmtDate(post.publish_date, { day: 'numeric', month: 'long' })}, cambiar` : 'Asignar fecha',
      onTap: (a) => onPickDate(post, a),
    }),
  ]);

  return el('div', { class: 'meses-item' }, [
    el('button', {
      class: 'meses-item__main', type: 'button',
      onclick: () => ctx.openEditor(post.id),
    }, [
      el('span', { class: 'meses-item__title', text: post.title || 'Sin título' }),
      icon('right', 16),
    ]),
    chips,
  ]);
}

// ── Composer "+ Nueva linea" ─────────────────────────────────────────────────

function buildComposer(key, monthRows) {
  const open = composer && composer.key === key;
  if (!open) {
    return el('button', {
      class: 'meses-newline', type: 'button',
      onclick: () => { composer = { key, value: '', wantFocus: true }; render(); },
    }, [icon('plus', 16), el('span', { text: 'Nueva línea' })]);
  }

  const input = el('input', {
    class: 'meses-newline__input', type: 'text',
    placeholder: 'Escribe la tarea y presiona Enter',
    'aria-label': 'Nueva tarea',
  });
  input.value = composer.value || '';
  input.addEventListener('input', () => { if (composer) composer.value = input.value; });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      composer = null;
      composerInput = null;
      render();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    const { activeClientId } = ctx.store.getState();
    if (!activeClientId || activeClientId === 'todos') return;

    if (composer) { composer.value = ''; composer.wantFocus = true; }
    input.value = '';

    const data = {
      client_id: activeClientId,
      title,
      status: 'idea',
      position: nextPosition(monthRows),
    };
    if (key !== SIN_MES) data.publish_date = `${key}-01`;
    const post = await ctx.store.createPost(data);
    if (post) ctx.toast('Agregado.', { type: 'success' });
    // El store emite posts -> re-render; el foco se restaura en render().
  });

  const closeBtn = el('button', {
    class: 'meses-newline__close', type: 'button', 'aria-label': 'Cerrar nueva línea',
    onclick: () => { composer = null; composerInput = null; render(); },
  }, [icon('close', 16)]);

  composerInput = input;
  return el('div', { class: 'meses-newline-open' }, [
    input,
    el('span', { class: 'meses-newline__hint', text: 'Enter agrega' }),
    closeBtn,
  ]);
}

// ── Agregar mes ──────────────────────────────────────────────────────────────

async function openAddMonth() {
  const now = new Date();
  const options = [];
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (visibleKeys.has(ym)) continue;
    options.push({ value: ym, label: capitalize(monthLabel(ym)), current: false });
  }
  if (!options.length) {
    ctx.toast('Esos meses ya están en la lista.', { type: 'info' });
    return;
  }
  const v = await ctx.sheet.pickFrom({ title: 'Agregar mes', options });
  if (!v) return;

  const list = getExtraMonths();
  if (!list.includes(v)) {
    list.push(v);
    ctx.prefs.set(extraKey(), list);
  }
  setCollapsed(v, false); // el mes nuevo abre expandido
  render();
  requestAnimationFrame(() => {
    const sec = sectionsEl && sectionsEl.querySelector(`[data-mes="${v}"]`);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Secciones ────────────────────────────────────────────────────────────────

function toggleSection(secEl, key) {
  const body = secEl.querySelector('.meses-sec__body');
  const head = secEl.querySelector('.meses-sec__head');
  if (!body || !head) return;
  const collapsed = !body.hidden;
  body.hidden = collapsed;
  secEl.classList.toggle('is-collapsed', collapsed);
  head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  setCollapsed(key, collapsed);
}

function buildSection({ key, rows, noteLabels, collapsed, desktop, isTodos }) {
  const label = key === SIN_MES ? 'Sin mes' : monthLabel(key);
  const bodyId = `meses-body-${key.replace(/[^a-z0-9-]/gi, '')}`;

  const head = el('button', {
    class: 'meses-sec__head', type: 'button',
    'aria-expanded': collapsed ? 'false' : 'true',
    'aria-controls': bodyId,
  }, [
    el('span', { class: 'meses-sec__chev' }, [icon('down', 16)]),
    el('span', { class: 'meses-sec__title', text: label }),
    el('span', { class: 'meses-sec__count', text: String(rows.length) }),
  ]);
  const heading = el('h2', { class: 'meses-sec__h' }, [head]);

  const bodyKids = [];
  if (rows.length) {
    bodyKids.push(desktop ? buildTable(rows, noteLabels) : el('div', { class: 'meses-list' }, rows.map(buildMobileItem)));
  } else {
    bodyKids.push(el('div', { class: 'meses-empty', text: 'Sin contenidos este mes.' }));
  }
  if (!isTodos) bodyKids.push(buildComposer(key, rows));

  const body = el('div', { class: 'meses-sec__body', id: bodyId, hidden: collapsed }, bodyKids);

  const sec = el('section', {
    class: 'meses-sec' + (collapsed ? ' is-collapsed' : ''),
    dataset: { mes: key },
    'aria-label': `${label}, ${rows.length} ${rows.length === 1 ? 'fila' : 'filas'}`,
  }, [heading, body]);

  head.addEventListener('click', () => toggleSection(sec, key));
  return sec;
}

// ── Filtros (persistidos por cliente, estilo Notion) ─────────────────────────

const FILTER_DIMS = [
  { dim: 'status',   label: 'Estado',     getVal: (p) => p.status || '',       labelOf: (v) => statusLabel(v) || v },
  { dim: 'type',     label: 'Tipo',       getVal: (p) => p.content_type || '', labelOf: (v) => contentTypeLabel(v) || v },
  { dim: 'platform', label: 'Plataforma', getVal: (p) => p.platform || '',     labelOf: (v) => v },
  { dim: 'grab',     label: 'Grabación',  getVal: (p) => (p.grabacion == null || p.grabacion === '' ? '' : String(p.grabacion)), labelOf: (v) => `Nivel ${v}` },
];

function filtersKey() {
  const { activeClientId } = ctx.store.getState();
  return `meses.filtros.${activeClientId || 'global'}`;
}

function getFilters() {
  const f = ctx.prefs.get(filtersKey(), null);
  return (f && typeof f === 'object' && !Array.isArray(f)) ? f : {};
}

function setFilters(f) {
  const any = Object.values(f).some(Boolean);
  ctx.prefs.set(filtersKey(), any ? f : undefined); // undefined = borrar la pref
}

function applyFilters(posts) {
  const f = getFilters();
  if (!Object.values(f).some(Boolean)) return posts;
  return posts.filter((p) => FILTER_DIMS.every(({ dim, getVal }) => !f[dim] || getVal(p) === f[dim]));
}

async function onFilterChip(dimDef, allPosts, anchor) {
  const f = getFilters();
  const seen = new Map();
  for (const p of allPosts) {
    const v = dimDef.getVal(p);
    if (v) seen.set(v, (seen.get(v) || 0) + 1);
  }
  const options = [{ value: 'all', label: 'Todos', current: !f[dimDef.dim] }];
  for (const [v, n] of [...seen.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    options.push({ value: v, label: `${dimDef.labelOf(v)} (${n})`, current: f[dimDef.dim] === v });
  }
  const v = await ctx.sheet.pickFrom({ title: `Filtrar por ${dimDef.label.toLowerCase()}`, options, anchor });
  if (!v) return;
  setFilters({ ...f, [dimDef.dim]: v === 'all' ? '' : v });
  render();
}

function buildFilterBar(allPosts) {
  const f = getFilters();
  const anyActive = Object.values(f).some(Boolean);
  const bar = el('div', { class: 'meses-filters', role: 'toolbar', 'aria-label': 'Filtros' }, [icon('filter', 14)]);
  for (const d of FILTER_DIMS) {
    const active = !!f[d.dim];
    bar.appendChild(el('button', {
      class: 'meses-filter' + (active ? ' is-active' : ''),
      type: 'button', 'aria-haspopup': 'dialog',
      onclick: (e) => onFilterChip(d, allPosts, e.currentTarget),
    }, [el('span', { text: active ? `${d.label}: ${d.labelOf(f[d.dim])}` : d.label })]));
  }
  if (anyActive) {
    bar.appendChild(el('button', {
      class: 'meses-filter meses-filter--clear', type: 'button', text: 'Limpiar',
      onclick: () => { setFilters({}); render(); },
    }));
  }
  return bar;
}

// ── Render principal ─────────────────────────────────────────────────────────

function render() {
  if (!rootEl || !ctx) return;
  const st = ctx.store.getState();
  const { posts, loading, activeClientId, clients } = st;
  const isTodos = activeClientId === 'todos';
  const client = !isTodos ? (clients || []).find((c) => c.id === activeClientId) : null;
  const noteLabels = (client && Array.isArray(client.note_labels))
    ? client.note_labels.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const desktop = mq ? mq.matches : window.matchMedia('(min-width: 768px)').matches;

  // Cargando sin datos: skeleton.
  if (loading && (!posts || !posts.length)) {
    clear(sectionsEl);
    for (let i = 0; i < 2; i++) {
      sectionsEl.appendChild(el('section', { class: 'meses-sec meses-sec--skel', 'aria-hidden': 'true' }, [
        el('div', { class: 'meses-skel meses-skel--head' }),
        el('div', { class: 'meses-skel' }),
        el('div', { class: 'meses-skel' }),
        el('div', { class: 'meses-skel meses-skel--short' }),
      ]));
    }
    return;
  }

  // Filtros activos (por cliente) + agrupar por mes + bucket "Sin mes".
  const allPosts = posts || [];
  const visiblePosts = applyFilters(allPosts);
  const byMonth = new Map();
  const sinMes = [];
  for (const p of visiblePosts) {
    const k = monthKeyOf(p);
    if (k) {
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k).push(p);
    } else {
      sinMes.push(p);
    }
  }

  // Meses vacios agregados a mano: se persisten hasta que tengan filas.
  const extraAll = getExtraMonths();
  const extra = extraAll.filter((m) => !byMonth.has(m));
  if (!isTodos && extra.length !== extraAll.length) ctx.prefs.set(extraKey(), extra);

  // Meses visibles: con posts + agregados a mano + el mes actual siempre.
  const keySet = new Set([...byMonth.keys(), ...extra, currentYM()]);
  const ordered = [...keySet].sort();
  visibleKeys = new Set(ordered);

  // Si el composer apunta a una seccion que ya no existe (cambio de cliente,
  // mes vaciado), se descarta.
  const allKeys = new Set(ordered);
  if (sinMes.length) allKeys.add(SIN_MES);
  if (composer && (!allKeys.has(composer.key) || isTodos)) composer = null;

  const collapseMap = getCollapseMap();

  // Conservar scroll horizontal por seccion y el foco del composer.
  const prevScroll = new Map();
  for (const sec of sectionsEl.querySelectorAll('.meses-sec')) {
    const wrap = sec.querySelector('.meses-tablewrap');
    if (wrap && wrap.scrollLeft) prevScroll.set(sec.dataset.mes, wrap.scrollLeft);
  }
  const composerHadFocus = !!(composerInput && document.activeElement === composerInput);
  composerInput = null;

  clear(sectionsEl);

  // Barra de filtros (opciones desde TODOS los posts, no los ya filtrados).
  sectionsEl.appendChild(buildFilterBar(allPosts));

  if (isTodos) {
    sectionsEl.appendChild(el('div', {
      class: 'meses-todos-note',
      text: 'Estás viendo todas las marcas. Elige una marca para agregar filas y meses.',
    }));
  }

  for (const ym of ordered) {
    sectionsEl.appendChild(buildSection({
      key: ym,
      rows: sortRows(byMonth.get(ym) || []),
      noteLabels,
      collapsed: isCollapsed(ym, collapseMap),
      desktop,
      isTodos,
    }));
  }

  if (sinMes.length) {
    sectionsEl.appendChild(buildSection({
      key: SIN_MES,
      rows: sortRows(sinMes),
      noteLabels,
      collapsed: isCollapsed(SIN_MES, collapseMap),
      desktop,
      isTodos,
    }));
  }

  if (!isTodos) {
    sectionsEl.appendChild(el('button', {
      class: 'meses-addmonth', type: 'button',
      onclick: () => openAddMonth(),
    }, [icon('plus', 16), el('span', { text: 'Agregar mes' })]));
  }

  // Restaurar scroll horizontal.
  for (const sec of sectionsEl.querySelectorAll('.meses-sec')) {
    const left = prevScroll.get(sec.dataset.mes);
    if (left) {
      const wrap = sec.querySelector('.meses-tablewrap');
      if (wrap) wrap.scrollLeft = left;
    }
  }

  // Restaurar foco del composer (flujo Notion: Enter y sigues escribiendo).
  if (composer && composerInput && (composerHadFocus || composer.wantFocus)) {
    composer.wantFocus = false;
    try {
      composerInput.focus({ preventScroll: true });
      composerInput.setSelectionRange(composerInput.value.length, composerInput.value.length);
    } catch { /* noop */ }
  }
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'meses',

  mount(host, c) {
    ctx = c;
    sectionsEl = el('div', { class: 'meses-sections' });
    rootEl = el('div', { class: 'meses-root' }, [sectionsEl]);
    host.appendChild(rootEl);

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'activeClientId', 'clients'], scheduleRender),
      // Regla anti popovers huerfanos: antes de procesar posts:changed se
      // cierran sheets/pickers abiertos (su anchor pudo dejar de existir).
      ctx.store.on('posts:changed', () => { try { ctx.sheet.closeAll(); } catch { /* noop */ } }),
      ctx.store.on('client:changed', () => { composer = null; composerInput = null; closeCaptionDrawer(); }),
    );

    mq = window.matchMedia('(min-width: 768px)');
    mqHandler = () => scheduleRender();
    if (mq.addEventListener) mq.addEventListener('change', mqHandler);
    else mq.addListener(mqHandler);

    render();
  },

  onParams() {
    scheduleRender();
  },

  unmount() {
    closeCaptionDrawer();
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    if (mq && mqHandler) {
      if (mq.removeEventListener) mq.removeEventListener('change', mqHandler);
      else mq.removeListener(mqHandler);
    }
    mq = null;
    mqHandler = null;
    renderQueued = false;
    renderPending = false;
    inlineEditing = false;
    composer = null;
    composerInput = null;
    visibleKeys = new Set();
    sectionsEl = null;
    rootEl = null;
    ctx = null;
  },
};
