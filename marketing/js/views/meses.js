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
  el, clear, copyText, api,
  STATUSES, STATUS_ORDER, CONTENT_TYPES, APPROVALS,
  statusLabel, contentTypeLabel, approvalLabel, fmtDate,
} from '../api.js?v=202607181835';
import { icon } from '../shell/icons.js?v=202607181835';
import { T } from '../shell/i18n.js?v=202607181835';
import { buildInsertUpdates } from '../kanban/move-sheet.js?v=202607181835';
import { slidesFromPost, fieldsFromSlides, slideLabel, slideHint, slidePlaceholder, slidesToText, altsFromText, altsToText } from '../editor/slides.js?v=202607181835';

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
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS = T(MONTHS_ES, MONTHS_EN);

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
let allPostsForFilters = []; // posts SIN filtrar del ultimo render (opciones de filtros)
let sideEl = null;           // barra lateral de meses (desktop)
let activeMonth = null;      // mes seleccionado: el area principal muestra SOLO este
                             // (la navegacion por mes es la barra lateral / barra de meses)

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
  const name = MONTHS[(m || 1) - 1] || '';
  return `${name} ${y || ''}`.trim();
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Valor de una columna para ordenar (texto en minusculas o numero).
function sortValOf(p, key) {
  switch (key) {
    case 'task':     return String(p.title || '').toLowerCase();
    case 'status':   return (statusLabel(p.status) || '').toLowerCase();
    case 'platform': return String(p.platform || '').toLowerCase();
    case 'type':     return (contentTypeLabel(p.content_type) || '').toLowerCase();
    case 'grab':     return (p.grabacion == null || p.grabacion === '') ? 99 : Number(p.grabacion);
    case 'manual':   return Number(p.position) || 0;
    case 'date':
    default:         return String(p.publish_date || '9999-99-99');
  }
}

function sortRows(rows) {
  const { key, dir } = getSort();
  const mul = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = sortValOf(a, key);
    const vb = sortValOf(b, key);
    let c;
    if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
    else c = va < vb ? -1 : va > vb ? 1 : 0;
    if (c !== 0) return c * mul;
    // Desempate estable: posicion y luego id.
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

// ── Aprobación del cliente (approval_state) ──────────────────────────────────

// Sin approval_state guardado = pendiente (mismo default que tabla y editor).
function approvalOf(post) { return (post && post.approval_state) || 'pending'; }

function isClientRole() { return document.body.classList.contains('is-client'); }

// Puntito de aprobación junto al badge de Estado (desktop): el color dice si
// la pieza está pendiente/aprobada/con cambios; el detalle va en el title.
function approvalDotNode(post) {
  const state = approvalOf(post);
  const def = APPROVALS[state] || APPROVALS.pending;
  const dot = el('span', {
    class: 'meses-apprdot', 'aria-hidden': 'true',
    title: `${T('Aprobación:', 'Approval:')} ${approvalLabel(state)}`,
  });
  dot.style.setProperty('--chipc', def.color);
  return dot;
}

// Decisión del cliente: POST /approve o /request-changes (mismos endpoints que
// tabla/editor). Optimista + rollback + toast. Devuelve true si se guardó.
async function sendApprovalDecision(post, decision, comment) {
  const rollback = ctx.store.optimistic((s) => ({
    posts: (s.posts || []).map((p) => (p.id === post.id ? { ...p, approval_state: decision } : p)),
  }));
  try {
    await trackMutation((async () => {
      const path = decision === 'approved' ? 'approve' : 'request-changes';
      const res = await api.post(`/posts/${encodeURIComponent(post.id)}/${path}`, comment ? { comment } : {});
      if (res && res.post && res.post.id) ctx.store.upsertPost(res.post);
      ctx.store.emit('posts:changed');
      ctx.store.emit('mutated');
      ctx.store.refreshClientCounts();
    })());
    ctx.toast(decision === 'approved'
      ? T('¡Pieza aprobada! El equipo ya lo sabe. ✨', 'Piece approved! The team already knows. ✨')
      : T('Cambios pedidos. El equipo lo verá enseguida.', 'Changes requested. The team will see it right away.'), { type: 'success' });
    return true;
  } catch (e) {
    rollback();
    ctx.toast((e && e.message) || T('No se pudo guardar, intenta de nuevo.', 'Could not save, try again.'), { type: 'error' });
    return false;
  }
}

// "Pedir cambios" desde la tarjeta (cliente): sheet con comentario. El
// comentario se pide siempre (igual que en el editor: un "cambios" sin decir
// cuáles no le sirve al equipo y el backend arma el hilo con él).
function openPedirCambios(post) {
  ctx.sheet.openSheet({
    title: T('Pedir cambios', 'Request changes'),
    mode: 'form',
    build(body, close) {
      const ta = el('textarea', {
        class: 'input meses-chgta', rows: '4', maxlength: '2000',
        placeholder: T('¿Qué quieres cambiar de esta pieza?', 'What would you like to change in this piece?'),
        'aria-label': T('Comentario de cambios', 'Change request comment'),
      });
      const help = el('div', { class: 'help', text: T('Tu comentario le llega directo al equipo.', 'Your comment goes straight to the team.') });
      const sendBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Enviar', 'Send'),
        onclick: async () => {
          const comment = ta.value.trim();
          if (!comment) {
            help.textContent = T('Cuéntanos qué cambiar (es lo que verá el equipo).', 'Tell us what to change (it is what the team will see).');
            help.classList.add('meses-urlhelp--error');
            ta.focus();
            return;
          }
          sendBtn.disabled = true;
          const ok = await sendApprovalDecision(post, 'changes', comment);
          sendBtn.disabled = false;
          if (ok) close({ source: 'save' });
        },
      });
      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: T('Comentario', 'Comment') }), ta]),
        help,
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          sendBtn,
        ]),
      );
      setTimeout(() => { try { ta.focus(); } catch { /* noop */ } }, 60);
    },
  });
}

// ── Guardrail de caption (regla cero-errores) ────────────────────────────────
// El caption es el copy FINAL de IG: el guion (HOOK/BODY/CTA/SLIDES) y los
// hashtags viven en SUS campos. Si el caption trae líneas-etiqueta de guion o
// hashtags reales (#Palabra, no #1), se avisa UNA vez por pieza y por sesión —
// sin bloquear jamás el guardado.
const RE_CAPTION_ETIQUETA = /^\s*(HOOK|CUERPO|BODY|CTA|COPY|HASHTAGS?|GANCHO|SLIDE\s*\d+)\s*:?\s*$/im;
const RE_CAPTION_HASHTAG = /#\p{L}/u;
const captionAvisados = new Set(); // ids de posts ya avisados en esta sesión

function avisarCaptionSucio(postId, caption) {
  const txt = String(caption || '');
  if (!txt) return;
  if (!RE_CAPTION_ETIQUETA.test(txt) && !RE_CAPTION_HASHTAG.test(txt)) return;
  if (captionAvisados.has(postId)) return;
  captionAvisados.add(postId);
  ctx.toast(T('El caption trae guion/hashtags dentro — van en su campo.', 'The caption has script/hashtags inside — they go in their own field.'), { type: 'info', ms: 5200 });
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
  } catch { return T('enlace', 'link'); }
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

// Mutaciones de ESTA vista en vuelo: el store emite posts:changed al RESOLVER
// la red, no al momento del click. Mientras haya una en vuelo, ese evento NO
// debe cerrar sheets (la usuaria pudo abrir otro picker/form y estar
// escribiendo; ver el handler de posts:changed en mount()).
let mutacionesEnVuelo = 0;
async function trackMutation(promise) {
  mutacionesEnVuelo += 1;
  try { return await promise; } finally { mutacionesEnVuelo -= 1; }
}

// Si un PATCH resuelve DESPUÉS de cambiar de marca (p. ej. autosave del drawer
// pendiente al cambiar de cliente), replacePost del store mete el post como
// fila nueva en la lista de la marca activa. El texto ya quedó guardado en el
// servidor: aquí solo se saca la fila intrusa de la lista en memoria.
function descartarSiEsDeOtraMarca(saved) {
  if (!ctx || !saved || !saved.id || !saved.client_id) return;
  const { activeClientId, posts } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos' || saved.client_id === activeClientId) return;
  ctx.store.set({ posts: (posts || []).filter((p) => p.id !== saved.id) });
}

async function patchWithUndo(post, fields, prevFields, msg) {
  const res = await trackMutation(ctx.store.patchPost(post.id, fields));
  if (res) {
    descartarSiEsDeOtraMarca(res);
    ctx.toast(msg, {
      type: 'success',
      action: { label: 'Deshacer', onAction: () => { trackMutation(ctx.store.patchPost(post.id, prevFields)); } },
    });
  }
}

// Eliminar una fila (post) con confirmacion. El store es optimista: quita la
// fila al instante y hace rollback si la red falla.
function confirmDeleteRow(post) {
  ctx.sheet.openSheet({
    title: 'Eliminar fila',
    mode: 'form',
    build(body, close) {
      body.append(
        el('p', { class: 'meses-confirm__txt', text: `Se eliminará "${post.title || T('Sin título', 'Untitled')}". Esta acción no se puede deshacer.` }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          el('button', {
            class: 'btn btn-danger sheet-cta', type: 'button', text: 'Eliminar',
            onclick: async () => {
              close({ source: 'confirm' });
              const ok = await trackMutation(ctx.store.removePost(post.id));
              if (ok) ctx.toast('Fila eliminada.', { type: 'success' });
            },
          }),
        ]),
      );
    },
  });
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
let drawerFlush = null; // guarda lo pendiente ANTES de cerrar (autosave)

function closeCaptionDrawer() {
  if (!drawerEl) return;
  try { if (drawerFlush) drawerFlush(); } catch { /* noop */ }
  drawerFlush = null;
  try { drawerEl.remove(); } catch { /* noop */ }
  drawerEl = null;
  document.removeEventListener('keydown', onDrawerKeydown, true);
}

function onDrawerKeydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeCaptionDrawer(); }
}

function openCaptionDrawer(post) {
  closeCaptionDrawer();

  // El guion COMPLETO por secciones (misma visualización que el móvil), en el
  // panel lateral derecho de siempre. Cada sección con su botón de copiar.
  // Carrusel: el guion se edita POR SLIDES (Slide 1 · HOOK … Slide N · CTA);
  // caption y hashtags siguen siendo secciones normales. Otros tipos: HOOK/BODY/CTA.
  const isCarrusel = post.content_type === 'carrusel';
  const SECTIONS = isCarrusel
    ? [
      { field: 'caption', label: 'CAPTION', hint: 'Listo para pegar en IG' },
      { field: 'hashtags', label: 'HASHTAGS', hint: '' },
    ]
    : [
      { field: 'hook', label: 'HOOK', hint: 'Las primeras palabras venden' },
      { field: 'body', label: 'BODY', hint: 'Desarrollo de la idea' },
      { field: 'cta', label: 'CTA', hint: 'Cierre con acción clara' },
      { field: 'caption', label: 'CAPTION', hint: 'Listo para pegar en IG' },
      { field: 'hashtags', label: 'HASHTAGS', hint: '' },
      { field: 'alt_text', label: 'SEO ALT', hint: 'Texto alternativo de la imagen (IG)' },
    ];
  const tas = {};
  let slides = null;
  let alts = null; // SEO alt por slide (solo carrusel)
  if (isCarrusel) {
    slides = slidesFromPost(post);
    if (slides.length < 2) slides = [slides[0] || '', ''];
    alts = altsFromText(post.alt_text, slides.length);
  }

  async function copyField(field, label) {
    const v = String(tas[field] ? tas[field].value : '').trim();
    if (!v) { ctx.toast(`No hay ${label} que copiar.`, { type: 'info' }); return; }
    let ok = false;
    try { await navigator.clipboard.writeText(v); ok = true; } catch { /* fallback abajo */ }
    if (!ok) {
      try { tas[field].select(); ok = document.execCommand('copy'); } catch { /* noop */ }
    }
    ctx.toast(ok ? `${label} copiado.` : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }

  // Los mismos 3 botones de copiar que el tab Guion del editor (móvil):
  // caption solo, caption + hashtags (listo para IG) y guion completo.
  async function copyPlain(text, okMsg, emptyMsg) {
    const v = String(text || '').trim();
    if (!v) { ctx.toast(emptyMsg, { type: 'info' }); return; }
    const ok = await copyText(v);
    ctx.toast(ok ? okMsg : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }
  function copyCaptionOnly() {
    return copyPlain(tas.caption.value, 'Caption copiado.', 'No hay caption que copiar.');
  }
  function copyCaptionAll() {
    const parts = ['caption', 'hashtags'].map((f) => String(tas[f] ? tas[f].value : '').trim()).filter(Boolean);
    return copyPlain(parts.join('\n\n'), 'Caption + hashtags copiados.', 'No hay caption que copiar.');
  }
  function copyScriptAll() {
    if (isCarrusel && slides) {
      return copyPlain(slidesToText(slides), 'Guion copiado.', 'No hay guion que copiar.');
    }
    const lines = [];
    for (const [f, lbl] of [['hook', 'HOOK'], ['body', 'BODY'], ['cta', 'CTA']]) {
      const v = String(tas[f] ? tas[f].value : '').trim();
      if (v) lines.push(`${lbl}:\n${v}`);
    }
    return copyPlain(lines.join('\n\n'), 'Guion copiado.', 'No hay guion que copiar.');
  }

  // Autosize: cada caja crece hasta su contenido (máx 320px) — nada de texto
  // rebanado a media línea.
  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; };

  const counters = {};
  function updateCount(field) {
    const elc = counters[field]; if (!elc) return;
    const v = String(tas[field].value || '');
    if (field === 'hashtags') {
      const n = (v.match(/#[^\s#]+/g) || []).length;
      elc.textContent = `${n}/30`;
      elc.classList.toggle('is-over', n > 30);
    } else {
      elc.textContent = `${v.length}/2200`;
      elc.classList.toggle('is-over', v.length >= 2200);
    }
  }

  // Host de slides (solo carrusel): se reconstruye al agregar/quitar slides.
  const slidesHost = isCarrusel ? el('div', { class: 'meses-drawer__slides' }) : null;
  function renderSlides() {
    if (!slidesHost) return;
    while (slidesHost.firstChild) slidesHost.removeChild(slidesHost.firstChild);
    // Reordenar arrastrando (pointer events, igual que el editor): solo los
    // slides de EN MEDIO — la Portada abre y el Cierre cierra, fijos.
    const blockRefs = [];
    const isMiddle = (idx) => idx > 0 && idx < slides.length - 1;
    const moveSlide = (from, to) => {
      const [s] = slides.splice(from, 1); slides.splice(to, 0, s);
      const [a] = alts.splice(from, 1); alts.splice(to, 0, a);
      renderSlides(); renderAlts(); scheduleSave();
    };
    slides.forEach((text, i) => {
      const ta = el('textarea', {
        class: 'meses-drawer__ta meses-drawer__ta--sec',
        placeholder: slidePlaceholder(i, slides.length),
        maxLength: 4000,
        rows: 1,
      });
      ta.value = text || '';
      ta.addEventListener('input', () => { slides[i] = ta.value; fit(ta); scheduleSave(); });
      ta.addEventListener('blur', () => flushSave());
      const hint = slideHint(i, slides.length);
      const grip = isMiddle(i) ? el('span', {
        class: 'edslide-grip', title: 'Arrastra para reordenar', 'aria-hidden': 'true',
      }, [icon('grip', 16)]) : null;
      const secEl = el('section', { class: 'mdsec' }, [
        el('div', { class: 'mdsec__head' }, [
          el('span', { class: 'mdsec__lbl', text: slideLabel(i, slides.length) }),
          hint ? el('span', { class: 'mdsec__hint', text: hint }) : null,
          (i > 0 && i < slides.length - 1) ? el('button', {
            class: 'mdsec__copy', type: 'button', title: 'Quitar este slide',
            'aria-label': `Quitar slide ${i + 1}`,
            onclick: () => { slides.splice(i, 1); alts.splice(i, 1); renderSlides(); renderAlts(); scheduleSave(); },
          }, [icon('trash', 14)]) : null,
          el('button', {
            class: 'mdsec__copy', type: 'button', title: 'Copiar este slide',
            'aria-label': `Copiar slide ${i + 1}`,
            onclick: () => copyPlain(slides[i], 'Slide copiado.', 'Este slide está vacío.'),
          }, [icon('copy', 14)]),
          grip, // agarradera al costado derecho
        ]),
        ta,
      ]);
      if (grip) {
        grip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const startY = e.clientY;
          let target = null;
          let moved = false;
          document.body.style.userSelect = 'none';
          const onMove = (ev) => {
            const dy = ev.clientY - startY;
            if (!moved && Math.abs(dy) > 4) { moved = true; secEl.classList.add('is-dragging'); }
            if (!moved) return;
            secEl.style.transform = `translateY(${dy}px)`;
            target = null;
            for (const ref of blockRefs) {
              if (ref.el === secEl || !isMiddle(ref.i)) { ref.el.classList.remove('is-dropover'); continue; }
              const r = ref.el.getBoundingClientRect();
              const over = ev.clientY >= r.top && ev.clientY <= r.bottom;
              ref.el.classList.toggle('is-dropover', over);
              if (over) target = ref.i;
            }
          };
          const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.style.userSelect = '';
            secEl.classList.remove('is-dragging');
            secEl.style.transform = '';
            for (const ref of blockRefs) ref.el.classList.remove('is-dropover');
            if (moved && target !== null && target !== i) moveSlide(i, target);
          };
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerup', onUp);
        });
      }
      blockRefs.push({ el: secEl, i });
      slidesHost.appendChild(secEl);
      fit(ta);
    });
    slidesHost.appendChild(el('div', { class: 'mdsec mdsec--add' }, [
      el('button', {
        class: 'btn meses-drawer__addslide', type: 'button',
        onclick: () => {
          slides.splice(slides.length - 1, 0, '');
          alts.splice(alts.length - 1, 0, '');
          renderSlides(); renderAlts(); scheduleSave();
        },
      }, [icon('plus', 15), ' Agregar slide']),
    ]));
  }

  // SEO ALT por slide (carrusel): al final del panel, uno por slide con copiar.
  const altsHost = isCarrusel ? el('div', { class: 'meses-drawer__alts' }) : null;
  function renderAlts() {
    if (!altsHost) return;
    while (altsHost.firstChild) altsHost.removeChild(altsHost.firstChild);
    alts.forEach((text, i) => {
      const ta = el('textarea', {
        class: 'meses-drawer__ta meses-drawer__ta--sec',
        placeholder: `Describe la imagen del slide ${i + 1} (SEO/accesibilidad)`,
        maxLength: 1000,
        rows: 1,
      });
      ta.value = text || '';
      ta.addEventListener('input', () => { alts[i] = ta.value; fit(ta); scheduleSave(); });
      ta.addEventListener('blur', () => flushSave());
      altsHost.appendChild(el('section', { class: 'mdsec' }, [
        el('div', { class: 'mdsec__head' }, [
          el('span', { class: 'mdsec__lbl', text: `SEO ALT · SLIDE ${i + 1}` }),
          i === 0 ? el('span', { class: 'mdsec__hint', text: 'Texto alternativo (IG)' }) : null,
          i > 0 ? el('button', {
            class: 'mdsec__copy', type: 'button', title: 'Borrar este SEO alt',
            'aria-label': `Borrar SEO alt del slide ${i + 1}`,
            // Solo se VACÍA el texto (nada de splice): alts debe seguir 1:1
            // con los slides o reordenar/quitar slides corre los alts de lugar.
            onclick: () => { alts[i] = ''; renderAlts(); scheduleSave(); },
          }, [icon('trash', 14)]) : null,
          el('button', {
            class: 'mdsec__copy', type: 'button', title: `Copiar SEO alt del slide ${i + 1}`,
            'aria-label': `Copiar SEO alt del slide ${i + 1}`,
            onclick: () => copyPlain(alts[i], 'SEO alt copiado.', 'Este alt está vacío.'),
          }, [icon('copy', 14)]),
        ]),
        ta,
      ]));
      fit(ta);
    });
    // Sin botón "Agregar SEO alt": los alts nacen y mueren JUNTO con su slide
    // (agregar/quitar/mover slide ya espeja el arreglo). Un push suelto aquí
    // desfasaba alts.length de slides.length y corría los textos de slide.
  }

  const body = el('div', { class: 'meses-drawer__body' }, SECTIONS.map((s) => {
    const ta = el('textarea', {
      class: 'meses-drawer__ta meses-drawer__ta--sec',
      placeholder: s.field === 'caption' ? 'Escribe el caption completo aquí...' : `Escribe el ${s.label.toLowerCase()} aquí...`,
      maxLength: 4000,
      rows: 1,
    });
    ta.value = post[s.field] || '';
    ta.addEventListener('input', () => { fit(ta); updateCount(s.field); scheduleSave(); });
    ta.addEventListener('blur', () => flushSave());
    tas[s.field] = ta;
    const withCount = s.field === 'caption' || s.field === 'hashtags';
    if (withCount) counters[s.field] = el('span', { class: 'mdsec__count' });
    return el('section', { class: 'mdsec' }, [
      el('div', { class: 'mdsec__head' }, [
        el('span', { class: 'mdsec__lbl', text: s.label }),
        s.hint ? el('span', { class: 'mdsec__hint', text: s.hint }) : null,
        withCount ? counters[s.field] : null,
        el('button', {
          class: 'mdsec__copy', type: 'button', title: `Copiar ${s.label}`,
          'aria-label': `Copiar ${s.label}`,
          onclick: () => copyField(s.field, s.label),
        }, [icon('copy', 14)]),
      ]),
      ta,
    ]);
  }));

  if (slidesHost) { renderSlides(); body.insertBefore(slidesHost, body.firstChild); }
  if (altsHost) { renderAlts(); body.appendChild(altsHost); }

  // ── AUTOSAVE: se guarda solo (sin botón "Guardar"). Debounce 800ms al escribir
  //    + al salir del campo + al cerrar. Indicador "Guardando…/Guardado ✓". ──
  const indicatorEl = el('span', { class: 'meses-drawer__save meses-drawer__save--saved', text: 'Guardado ✓' });
  const currentValues = () => {
    const out = {};
    for (const s of SECTIONS) out[s.field] = (tas[s.field].value || '').trim() || null;
    if (isCarrusel && slides) {
      const f = fieldsFromSlides(slides);
      out.hook = f.hook || null; out.body = f.body || null; out.cta = f.cta || null;
      out.alt_text = altsToText(alts) || null;
    }
    return out;
  };
  const savedSnap = currentValues(); // lo ya guardado (base para calcular el delta)
  let saveTimer = null, saving = false, queued = false;
  const paint = (state) => {
    indicatorEl.className = 'meses-drawer__save meses-drawer__save--' + state;
    indicatorEl.textContent = (state === 'saving' || state === 'dirty') ? 'Guardando…'
      : state === 'error' ? '⚠ No se guardó' : 'Guardado ✓';
  };
  async function doSave() {
    if (saving) { queued = true; return; }
    const cur = currentValues(); const patch = {};
    for (const k of Object.keys(cur)) if (cur[k] !== savedSnap[k]) patch[k] = cur[k];
    if (!Object.keys(patch).length) { paint('saved'); return; }
    // Guardrail cero-errores: avisa si el caption trae guion/hashtags dentro
    // (una vez por pieza; NUNCA bloquea el guardado).
    if (Object.prototype.hasOwnProperty.call(patch, 'caption')) avisarCaptionSucio(post.id, patch.caption);
    saving = true; paint('saving');
    let ok = false;
    try {
      const saved = await trackMutation(ctx.store.patchPost(post.id, patch));
      ok = !!saved;
      // Flush tardío tras cambiar de marca: no dejar la fila de la marca
      // anterior inyectada en el calendario de la marca nueva.
      if (saved) descartarSiEsDeOtraMarca(saved);
    } catch { ok = false; }
    if (ok) { Object.assign(savedSnap, cur); paint('saved'); } else { paint('error'); }
    saving = false;
    if (queued) { queued = false; doSave(); }
  }
  const scheduleSave = () => {
    paint('dirty');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; doSave(); }, 800);
  };
  const flushSave = () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    doSave();
  };
  drawerFlush = flushSave;

  // Cmd/Ctrl+Enter = guardar y cerrar (el cierre hace flush).
  body.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); closeCaptionDrawer(); }
  });

  drawerEl = el('div', { class: 'meses-drawer__wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Guion de ${post.title || 'contenido'}` }, [
    el('div', { class: 'meses-drawer__overlay', onclick: () => closeCaptionDrawer() }),
    el('aside', { class: 'meses-drawer' }, [
      el('header', { class: 'meses-drawer__head' }, [
        el('div', { class: 'meses-drawer__titles' }, [
          el('span', { class: 'meses-drawer__kicker', text: T('Guion', 'Script') }),
          el('h3', { class: 'meses-drawer__title', text: post.title || T('Sin título', 'Untitled') }),
        ]),
        el('button', {
          class: 'meses-drawer__close', type: 'button', 'aria-label': 'Cerrar',
          onclick: () => closeCaptionDrawer(),
        }, [icon('close', 18)]),
      ]),
      body,
      el('div', { class: 'meses-drawer__copyrow' }, [
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: 'Copia solo el caption', onclick: copyCaptionOnly }, [icon('copy', 14), 'Copiar caption']),
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: 'Caption + hashtags juntos, listos para pegar en IG', onclick: copyCaptionAll }, [icon('copy', 14), 'Copiar caption + hashtags']),
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: 'HOOK, BODY y CTA etiquetados', onclick: copyScriptAll }, [icon('copy', 14), 'Copiar guion completo']),
      ]),
      el('footer', { class: 'meses-drawer__foot' }, [
        indicatorEl,
        el('div', { class: 'meses-drawer__actions' }, [
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Listo', onclick: () => closeCaptionDrawer() }),
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
  // Ajustar cada caja a su contenido y pintar contadores.
  for (const f of Object.keys(tas)) { fit(tas[f]); updateCount(f); }
  // Los textareas de slides se crearon antes de montar el drawer (scrollHeight
  // era 0): re-ajustarlos ya visibles para que no salgan recortados.
  if (slidesHost) for (const sta of slidesHost.querySelectorAll('textarea')) fit(sta);
  if (altsHost) for (const sta of altsHost.querySelectorAll('textarea')) fit(sta);
  // Abrir desde el COMIENZO: scroll arriba, sin abrir teclado en móvil.
  body.scrollTop = 0;
  drawerEl.querySelector('.meses-drawer__close')?.focus();
}

// ── Enlaces (Inspo / Video final) ────────────────────────────────────────────

function openUrlSheet(post, field, title, { allowUpload = false } = {}) {
  const current = safeUrl(post[field]) || '';
  const msgSaved = 'Enlace guardado.';
  // ¿El valor actual es un video subido a R2 (no un enlace externo)?
  const isUploaded = allowUpload && /\/posts\/[a-z0-9]+\/video(?:\?|$)/i.test(current);

  ctx.sheet.openSheet({
    title,
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input meses-urlinput', type: 'url', inputmode: 'url',
        placeholder: 'https://...', 'aria-label': title,
      });
      // Si lo actual es un video subido, el campo de enlace arranca vacío.
      input.value = isUploaded ? '' : current;
      const help = el('div', { class: 'help meses-urlhelp', text: 'Pega un enlace que empiece con http:// o https://' });

      // Quitar el valor actual (enlace externo o video subido en R2).
      const removeNow = async () => {
        close({ source: 'save' });
        if (isUploaded) {
          try {
            const r = await fetch(`/api/marketing/posts/${post.id}/video`, { method: 'DELETE', credentials: 'include' });
            if (r.ok) { ctx.store.upsertPost(await r.json()); ctx.toast('Video quitado.', { type: 'success' }); return; }
          } catch { /* cae al patch */ }
          patchWithUndo(post, { video_url: null }, { video_url: current }, 'Video quitado.');
        } else {
          patchWithUndo(post, { [field]: null }, { [field]: current }, 'Enlace quitado.');
        }
      };

      const save = () => {
        const raw = input.value.trim();
        if (!raw) {
          if (current) { removeNow(); } else { close({ source: 'cancel' }); }
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
        el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Guardar', onclick: save }),
      ]);

      // ── Subir archivo (solo Video final): sube directo a R2 con progreso ──
      if (allowUpload) {
        const fileInput = el('input', {
          type: 'file', accept: 'video/mp4,video/quicktime,video/webm,video/*',
          style: { display: 'none' },
        });
        const upHint = el('div', { class: 'help meses-uphint', text: 'MP4, MOV o WebM · hasta 100 MB' });
        const upBtn = el('button', { class: 'btn meses-upbtn', type: 'button', onclick: () => fileInput.click() },
          [icon('plus', 16), el('span', { text: isUploaded ? 'Reemplazar video' : 'Subir video' })]);

        fileInput.addEventListener('change', () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (f.size > 100 * 1024 * 1024) {
            upHint.textContent = 'El video supera 100 MB. Comprímelo o pega un enlace.';
            upHint.classList.add('meses-urlhelp--error');
            return;
          }
          upBtn.disabled = true;
          upHint.classList.remove('meses-urlhelp--error');
          const fd = new FormData(); fd.append('video', f);
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/marketing/posts/${post.id}/video`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) upHint.textContent = `Subiendo… ${Math.round((e.loaded / e.total) * 100)}%`;
          };
          xhr.onload = () => {
            upBtn.disabled = false;
            if (xhr.status >= 200 && xhr.status < 300) {
              try { ctx.store.upsertPost(JSON.parse(xhr.responseText)); } catch { /* noop */ }
              close({ source: 'save' });
              ctx.toast('Video subido.', { type: 'success' });
            } else {
              let m = 'No se pudo subir el video.';
              try { m = JSON.parse(xhr.responseText).error || m; } catch { /* noop */ }
              upHint.textContent = m; upHint.classList.add('meses-urlhelp--error');
            }
          };
          xhr.onerror = () => { upBtn.disabled = false; upHint.textContent = 'Error de red al subir.'; upHint.classList.add('meses-urlhelp--error'); };
          xhr.send(fd);
        });

        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Subir archivo' }), upBtn, fileInput, upHint]),
          el('div', { class: 'meses-or', text: 'o pega un enlace' }),
        );
      }

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Enlace' }), input]),
        help,
      );
      if (current) {
        body.appendChild(el('button', {
          class: 'meses-urlremove', type: 'button',
          text: isUploaded ? 'Quitar video' : 'Quitar enlace',
          onclick: removeNow,
        }));
      }
      body.appendChild(footer);
      if (!allowUpload) setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 60);
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

// Barra SEGMENTADA de progreso del mes: un segmento por etapa del pipeline
// (ancho proporcional al conteo, color de la etapa) para leer de un vistazo
// cuanto hay en cada fase. El % destacado es el de publicados.
function buildMonthProgress(rows) {
  const list = (rows || []).filter((p) => STATUSES[p.status]);
  if (!list.length) return null;
  const total = list.length;
  const counts = {};
  for (const p of list) counts[p.status] = (counts[p.status] || 0) + 1;
  const publicados = counts.publicado || 0;
  const pct = Math.round((publicados / total) * 100);

  const segs = STATUS_ORDER.filter((s) => counts[s]).map((s) => {
    const seg = el('span', { class: 'meses-prog__seg', title: `${statusLabel(s)}: ${counts[s]}` });
    seg.style.flexGrow = String(counts[s]);
    seg.style.background = (STATUSES[s] || {}).color || 'var(--brand)';
    return seg;
  });

  return el('div', { class: 'meses-prog' }, [
    el('div', { class: 'meses-prog__head' }, [
      el('span', { class: 'meses-prog__label', text: 'Progreso del mes' }),
      el('span', { class: 'meses-prog__pct', text: `${pct}% · ${publicados}/${total} publicados` }),
    ]),
    el('div', { class: 'meses-prog__track meses-prog__track--seg' }, segs),
  ]);
}

// Franja de stats del mes activo: piezas, % publicado y atrasados.
function buildMonthStats(rows) {
  const list = rows || [];
  if (!list.length) return null;
  const total = list.length;
  const pub = list.filter((p) => p.status === 'publicado').length;
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const atrasados = list.filter((p) => p.publish_date && p.publish_date < todayStr && p.status !== 'publicado').length;
  // Sin aprobar = pendiente O con cambios pedidos (todo lo que aún no tiene
  // el visto bueno del cliente).
  const sinAprobar = list.filter((p) => approvalOf(p) !== 'approved').length;
  const stat = (k, v, cls) => el('div', { class: 'meses-stat' + (cls ? ` ${cls}` : '') }, [
    el('span', { class: 'meses-stat__v', text: String(v) }),
    el('span', { class: 'meses-stat__k', text: k }),
  ]);
  return el('div', { class: 'meses-stats' }, [
    stat(T('Piezas', 'Pieces'), total),
    stat(T('Publicado', 'Published'), `${Math.round((pub / total) * 100)}%`),
    stat(T('Atrasados', 'Overdue'), atrasados, atrasados ? 'is-danger' : 'is-ok'),
    stat(T('Sin aprobar', 'Unapproved'), sinAprobar, sinAprobar ? 'is-warn' : 'is-ok'),
  ]);
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
      () => openUrlSheet(post, field, label, { allowUpload: field === 'video_url' }),
      `Agregar ${label}`,
    ));
    return td;
  }
  const link = el('a', {
    class: 'meses-url__a', href: url, target: '_blank', rel: 'noopener noreferrer', title: url,
  }, [icon('link', 13), el('span', { text: shortUrl(url) })]);
  const editBtn = el('button', {
    class: 'meses-url__edit', type: 'button', 'aria-label': `Cambiar ${label}`,
    onclick: () => openUrlSheet(post, field, label, { allowUpload: field === 'video_url' }),
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
  }, [el('span', { class: 'meses-task__label', text: post.title || T('Sin título', 'Untitled') })]);
  const openBtn = el('button', {
    class: 'meses-task__open', type: 'button', 'aria-label': 'Abrir en el editor',
    title: 'Abrir',
    onclick: () => ctx.openEditor(post.id),
  }, [icon('edit', 14)]);
  const deleteBtn = el('button', {
    class: 'meses-task__del', type: 'button', 'aria-label': 'Eliminar fila',
    title: 'Eliminar fila',
    onclick: () => confirmDeleteRow(post),
  }, [icon('trash', 14)]);
  const dragBtn = el('button', {
    class: 'meses-task__drag', type: 'button',
    'aria-label': 'Arrastrar para reordenar', title: 'Arrastrar para reordenar',
  }, [icon('grip', 14)]);
  tdTask.appendChild(el('span', { class: 'meses-task' }, [dragBtn, titleBtn, openBtn, deleteBtn]));

  // Plataforma / Tipo / Estado (pickers compartidos)
  const tdPlat = el('td', { class: 'meses-td' }, [
    cellButton(platformNode(post.platform), (a) => onPickPlatform(post, a),
      post.platform ? `Plataforma ${post.platform}, cambiar` : 'Asignar plataforma'),
  ]);
  const tdType = el('td', { class: 'meses-td' }, [
    cellButton(typePillNode(post.content_type), (a) => onPickType(post, a),
      post.content_type ? `Tipo ${contentTypeLabel(post.content_type)}, cambiar` : 'Asignar tipo'),
  ]);
  // Estado + puntito de aprobación (pendiente/aprobado/cambios) en la misma
  // celda: la aprobación del cliente se ve sin abrir el editor.
  const tdStatus = el('td', { class: 'meses-td' }, [
    cellButton(
      el('span', { class: 'meses-statuscell' }, [statusPillNode(post.status), approvalDotNode(post)]),
      (a) => onPickStatus(post, a),
      `Estado ${statusLabel(post.status) || 'sin estado'}, aprobación ${approvalLabel(approvalOf(post)).toLowerCase()}, cambiar`,
    ),
  ]);

  // Fecha publicacion (columna real de su Notion; editar puede mover de mes)
  const tdDate = el('td', { class: 'meses-td meses-td--date' }, [
    cellButton(
      post.publish_date
        ? el('span', { class: 'meses-date', text: fmtDate(post.publish_date, { day: 'numeric', month: 'long' }) })
        : el('span', { class: 'meses-empty', text: T('Fecha', 'Date') }),
      (a) => onPickDate(post, a),
      post.publish_date ? `${T('Fecha', 'Date')} ${fmtDate(post.publish_date, { day: 'numeric', month: 'long' })}` : T('Asignar fecha', 'Set date'),
    ),
  ]);

  // Captions: panel lateral DERECHO (side peek) con el guion completo por
  // secciones (HOOK/BODY/CTA/Caption/Hashtags + copiar), como en el móvil.
  const tdCaption = el('td', { class: 'meses-td meses-td--text' });
  // Preview del GUION: empieza por el HOOK (arranque del guion). Si no hay hook,
  // cae al body y por último al caption.
  const guionPreview = post.hook || post.body || post.caption;
  tdCaption.appendChild(cellButton(
    textCellNode(guionPreview, 'Agregar guion'),
    () => openCaptionDrawer(post),
    'Abrir guion completo',
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

// ── Drag & drop de filas (reordenar con el puño ⠿; persiste en position) ────
let dndDispose = null;

function wireRowDnd(tbody) {
  if (!ctx || !ctx.dnd) return;
  if (dndDispose) { try { dndDispose(); } catch { /* noop */ } dndDispose = null; }
  let ph = null;
  const clearPh = () => { if (ph) { ph.remove(); ph = null; } };
  dndDispose = ctx.dnd.draggableList(tbody, 'tr.meses-row', (tr) => ({
    mode: 'move',
    data: { id: tr.dataset.id },
    handle: tr.querySelector('.meses-task__drag'),
    dropSelector: 'tbody',
    touchAction: 'none',
    onMove: (c) => {
      if (!ph) ph = el('tr', { class: 'meses-row--ph' }, [el('td', { colspan: '99' })]);
      const others = [...tbody.querySelectorAll('tr.meses-row:not(.dnd-origin)')];
      let before = null;
      for (const r of others) {
        const rect = r.getBoundingClientRect();
        if (c.y < rect.top + rect.height / 2) { before = r; break; }
      }
      if (before) tbody.insertBefore(ph, before);
      else tbody.appendChild(ph);
    },
    onDrop: async (c) => {
      if (!ph || !ph.parentNode) { clearPh(); return; }
      // Índice de inserción: filas visibles (sin el origen) antes del placeholder.
      let idx = 0;
      for (let n = tbody.firstElementChild; n && n !== ph; n = n.nextElementSibling) {
        if (n.classList && n.classList.contains('meses-row') && !n.classList.contains('dnd-origin')) idx += 1;
      }
      const ids = [...tbody.querySelectorAll('tr.meses-row:not(.dnd-origin)')].map((r) => r.dataset.id);
      clearPh();
      const { posts } = ctx.store.getState();
      const byId = new Map((posts || []).map((p) => [String(p.id), p]));
      const list = ids.map((id) => byId.get(String(id))).filter(Boolean);
      const moved = byId.get(String(c.data.id));
      if (!moved) return;
      const updates = buildInsertUpdates(list, idx, moved, null);
      if (!updates.length) return;
      const wasManual = getSort().key === 'manual';
      if (!wasManual) setSort('manual', 'asc');
      const ok = await trackMutation(ctx.store.reorder(updates));
      if (ok && !wasManual) {
        ctx.toast('Orden manual activado: las filas quedan como las acomodes.', { type: 'info' });
      }
      scheduleRender();
    },
    onCancel: clearPh,
  }));
}

function buildTable(rows, noteLabels) {
  // Encabezados con filtro INTEGRADO (estilo Excel): clic en la columna abre
  // el picker de esa columna; si hay filtro activo se pinta con la marca.
  // Encabezado con menu ordenar+filtrar integrado (estilo Excel). La flecha
  // apunta arriba/abajo cuando ESA columna es la que ordena.
  const colHeader = ({ skey, sortType, label, filterDim, extra = {} }) => {
    const f = getFilters();
    const s = getSort();
    const dimDef = filterDim ? FILTER_DIMS.find((x) => x.dim === filterDim) : null;
    const filtered = !!(filterDim && f[filterDim]);
    const sorted = !!(skey && s.key === skey);
    const txt = filtered ? `${label}: ${dimDef.labelOf(f[filterDim])}` : label;
    return el('th', { scope: 'col', ...extra }, [
      el('button', {
        class: 'meses-th__filter' + (filtered ? ' is-active' : '') + (sorted ? ' is-sorted' : ''),
        type: 'button', 'aria-haspopup': 'dialog', title: 'Ordenar y filtrar',
        onclick: (e) => openColMenu({ skey, sortType, label, filterDim }, e.currentTarget),
      }, [
        el('span', { text: txt }),
        icon(sorted && s.dir === 'asc' ? 'up' : 'down', 12),
      ]),
    ]);
  };
  const headCells = [
    colHeader({ skey: 'grab', sortType: 'num', label: T('Grab.', 'Rec.'), filterDim: 'grab', extra: { class: 'meses-col--grab' } }),
    colHeader({ skey: 'task', sortType: 'text', label: T('Tarea', 'Task'), filterDim: null, extra: { class: 'meses-col--task' } }),
    colHeader({ skey: 'status', sortType: 'text', label: T('Estado', 'Status'), filterDim: 'status' }),
    colHeader({ skey: 'date', sortType: 'date', label: T('Fecha publicación', 'Publish date'), filterDim: null }),
    colHeader({ skey: 'platform', sortType: 'text', label: T('Plataforma', 'Platform'), filterDim: 'platform' }),
    colHeader({ skey: 'type', sortType: 'text', label: T('Tipo', 'Type'), filterDim: 'type' }),
    el('th', { text: T('Guiones', 'Scripts'), scope: 'col' }),
    ...noteLabels.map((p) => el('th', { text: `${T('Notas', 'Notes')} ${p}`, scope: 'col' })),
    el('th', { text: T('Inspo', 'Inspo'), scope: 'col' }),
    el('th', { text: T('Video final', 'Final video'), scope: 'col' }),
  ];
  const tbody = el('tbody', {}, rows.map((p) => buildRow(p, noteLabels)));
  const table = el('table', { class: 'meses-table' }, [
    el('thead', {}, [el('tr', {}, headCells)]),
    tbody,
  ]);
  wireRowDnd(tbody);
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

function buildMobileItem(post, noteLabels) {
  const grab = Number(post.grabacion);
  const typeDef = CONTENT_TYPES[post.content_type];
  const statusDef = STATUSES[post.status];

  // Chips en orden de lectura para el cliente: FECHA primero (cuándo se
  // publica), luego tipo y estado, y al final plataforma/grabación.
  const chips = el('div', { class: 'meses-item__chips' }, [
    mobileChip({
      text: post.publish_date ? fmtDate(post.publish_date) : T('Fecha', 'Date'),
      ghost: !post.publish_date,
      aria: post.publish_date ? `${T('Fecha', 'Date')} ${fmtDate(post.publish_date, { day: 'numeric', month: 'long' })}` : T('Asignar fecha', 'Set date'),
      onTap: (a) => onPickDate(post, a),
    }),
    mobileChip({
      text: post.content_type ? contentTypeLabel(post.content_type) : T('Tipo', 'Type'),
      color: post.content_type ? ((typeDef && typeDef.color) || null) : null,
      ghost: !post.content_type,
      aria: post.content_type ? `${T('Tipo', 'Type')} ${contentTypeLabel(post.content_type)}` : T('Asignar tipo', 'Set type'),
      onTap: (a) => onPickType(post, a),
    }),
    mobileChip({
      text: statusLabel(post.status) || T('Estado', 'Status'),
      color: (statusDef && statusDef.color) || null,
      ghost: !STATUSES[post.status],
      aria: `${T('Estado', 'Status')} ${statusLabel(post.status) || T('sin estado', 'no status')}`,
      onTap: (a) => onPickStatus(post, a),
    }),
    mobileChip({
      text: post.platform || T('Plataforma', 'Platform'),
      ghost: !post.platform,
      aria: post.platform ? `${T('Plataforma', 'Platform')} ${post.platform}` : T('Asignar plataforma', 'Set platform'),
      onTap: (a) => onPickPlatform(post, a),
    }),
    mobileChip({
      text: grab && GRAB_COLORS[grab] ? `G${grab}` : T('Grab.', 'Rec.'),
      color: grab ? GRAB_COLORS[grab] : null,
      ghost: !grab,
      aria: grab ? `${T('Grabación nivel', 'Recording level')} ${grab}` : T('Asignar grabación', 'Set recording'),
      onTap: (a) => onPickGrabacion(post, a),
    }),
  ]);

  const card = el('div', { class: 'meses-item' }, [
    el('div', { class: 'meses-item__top' }, [
      el('button', {
        class: 'meses-item__main', type: 'button',
        onclick: () => ctx.openEditor(post.id),
      }, [
        el('span', { class: 'meses-item__title', text: post.title || T('Sin título', 'Untitled') }),
        icon('right', 16),
      ]),
      el('button', {
        class: 'meses-item__del', type: 'button', 'aria-label': 'Eliminar fila',
        title: 'Eliminar fila',
        onclick: () => confirmDeleteRow(post),
      }, [icon('trash', 18)]),
    ]),
  ]);

  // Preview del caption (el CONTENIDO real): es lo que el cliente quiere leer.
  // Toca para abrir el caption completo en panel.
  // Preview del GUION: empieza por el HOOK (no el caption). Fallback: body, caption.
  const cap = String(post.hook || post.body || post.caption || '').trim();
  if (cap) {
    card.appendChild(el('button', {
      class: 'meses-item__cap', type: 'button', 'aria-label': 'Ver guion completo',
      onclick: () => openCaptionDrawer(post),
    }, [el('span', { class: 'meses-item__captext', text: cap })]));
  }

  // Link de Inspo (referencia): si la pieza tiene uno, un chip resaltado que
  // abre el link en pestaña nueva — se ve de un vistazo si hay referencia.
  const inspoUrl = safeUrl(post.inspo_url);
  if (inspoUrl) {
    chips.insertBefore(
      el('a', {
        class: 'meses-chip meses-chip--inspo', href: inspoUrl,
        target: '_blank', rel: 'noopener noreferrer',
        'aria-label': `Ver inspiración (${shortUrl(inspoUrl)})`, title: inspoUrl,
      }, [icon('link', 13), el('span', { text: 'Inspo' })]),
      chips.children[1] || null, // justo después de la fecha
    );
  }

  // Chip de aprobación (solo lectura): cliente y dueña ven de un vistazo si la
  // pieza está pendiente, aprobada o con cambios pedidos.
  const apprState = approvalOf(post);
  const apprDef = APPROVALS[apprState] || APPROVALS.pending;
  const apprChip = el('span', {
    class: 'meses-chip meses-chip--appr',
    'aria-label': `Aprobación: ${approvalLabel(apprState)}`,
  }, [
    el('span', { class: 'meses-chip__dot', 'aria-hidden': 'true' }),
    el('span', { text: approvalLabel(apprState) }),
  ]);
  apprChip.style.setProperty('--chipc', apprDef.color);
  chips.appendChild(apprChip);
  card.appendChild(chips);

  // Notas por persona (Jairo, contacto del cliente...): se muestran DIRECTO en
  // la tarjeta para que el cliente las lea sin abrir la pieza. Solo las que
  // tienen texto (las vacias no ensucian). Tocar = abrir el editor para
  // leer/responder. Es SOLO lectura del dato existente: no escribe ni mueve nada.
  const np = notesOf(post);
  const noteEls = (noteLabels || [])
    .map((person) => {
      const txt = String((np && np[person]) || '').trim();
      if (!txt) return null;
      return el('button', {
        class: 'meses-note', type: 'button',
        'aria-label': `Nota de ${person}, abrir para editar`,
        onclick: () => ctx.openEditor(post.id, { tab: 'contenido' }),
      }, [
        el('span', { class: 'meses-note__who', text: person }),
        el('span', { class: 'meses-note__txt', text: txt }),
      ]);
    })
    .filter(Boolean);
  if (noteEls.length) card.appendChild(el('div', { class: 'meses-notes' }, noteEls));

  // Acciones rapidas: abren el editor DIRECTO en la pestaña (sin entrar y
  // buscar). Es lo que mas se usa por pieza: el guion y las notas.
  card.appendChild(el('div', { class: 'meses-item__actions' }, [
    el('button', {
      class: 'meses-act', type: 'button', 'aria-label': T('Abrir guion', 'Open script'),
      onclick: () => ctx.openEditor(post.id, { tab: 'guion' }),
    }, [icon('edit', 15), el('span', { text: T('Guion', 'Script') })]),
    el('button', {
      class: 'meses-act', type: 'button', 'aria-label': T('Abrir notas del equipo', 'Open team notes'),
      onclick: () => ctx.openEditor(post.id, { tab: 'contenido' }),
    }, [icon('copy', 15), el('span', { text: T('Notas', 'Notes') })]),
  ]));

  // El CLIENTE decide desde la tarjeta (solo si sigue pendiente): Aprobar de
  // un toque, o Pedir cambios con comentario. Optimista + toast.
  if (isClientRole() && apprState === 'pending') {
    const okBtn = el('button', {
      class: 'meses-approve__btn meses-approve__btn--ok', type: 'button',
      'aria-label': `Aprobar "${post.title || T('Sin título', 'Untitled')}"`,
      onclick: async () => {
        okBtn.disabled = true;
        await sendApprovalDecision(post, 'approved', null);
        okBtn.disabled = false;
      },
    }, [icon('check', 15), el('span', { text: T('Aprobar', 'Approve') })]);
    card.appendChild(el('div', { class: 'meses-approve' }, [
      okBtn,
      el('button', {
        class: 'meses-approve__btn meses-approve__btn--chg', type: 'button',
        'aria-label': `${T('Pedir cambios en', 'Request changes on')} "${post.title || T('Sin título', 'Untitled')}"`,
        onclick: () => openPedirCambios(post),
      }, [icon('edit', 15), el('span', { text: T('Pedir cambios', 'Request changes') })]),
    ]));
  }
  return card;
}

// Lista movil: una tarjeta por pieza dentro del contenedor `.meses-list`.
function buildMobileList(rows, noteLabels) {
  return el('div', { class: 'meses-list' }, rows.map((p) => buildMobileItem(p, noteLabels)));
}

// ── Composer "+ Nueva linea" ─────────────────────────────────────────────────

function buildComposer(key, monthRows) {
  // "+ Nueva línea": agrega una fila NUEVA EN BLANCO en la tabla (con todas sus
  // celdas vacías) y deja el título listo para escribir. Se llena celda por
  // celda ahí mismo, sin abrir otra pantalla.
  const btn = el('button', {
    class: 'meses-newline', type: 'button',
  }, [icon('plus', 16), el('span', { text: T('Nueva línea', 'New row') })]);
  btn.addEventListener('click', async () => {
    const { activeClientId } = ctx.store.getState();
    if (!activeClientId || activeClientId === 'todos') return;
    btn.disabled = true;
    // La fila nueva nace con status 'idea' y sin tipo/plataforma: con un filtro
    // activo quedaría INVISIBLE y parecería que el botón no hizo nada (y los
    // reintentos crean filas fantasma). Se limpian los filtros antes de crear.
    if (Object.values(getFilters()).some(Boolean)) {
      setFilters({});
      ctx.toast('Quitamos los filtros para que veas tu fila nueva.', { type: 'info' });
    }
    const data = {
      client_id: activeClientId,
      title: '',
      status: 'idea',
      position: nextPosition(monthRows),
    };
    if (key !== SIN_MES) data.publish_date = `${key}-01`;
    const post = await trackMutation(ctx.store.createPost(data));
    btn.disabled = false;
    // La fila nueva aparece sola (el store emite -> re-render). Solo hago scroll
    // hacia ella para dejarla a la vista, lista para llenar celda por celda.
    if (post && post.id) {
      setTimeout(() => {
        const row = sectionsEl && sectionsEl.querySelector(`tr.meses-row[data-id="${post.id}"]`);
        if (row) row.scrollIntoView({ block: 'nearest' });
      }, 200);
    }
  });
  return btn;
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
  activeMonth = v; // el mes nuevo queda activo (la navegacion es por mes)
  render();
}

// ── Copiar mes (staff): duplica las piezas de un mes origen al mes ACTIVO ────
// Por cada post del origen: POST /posts/:id/duplicate (el server copia guion y
// checklist) y luego PATCH publish_date al MISMO día del mes destino (topado
// al último día: 31 de enero → 28/29 de febrero).

let copiandoMes = false;

async function openCopyMonth() {
  if (copiandoMes) return;
  const { activeClientId, posts } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return;
  if (!activeMonth || activeMonth === SIN_MES) {
    ctx.toast('Elige primero un mes destino con fecha.', { type: 'info' });
    return;
  }

  // Meses origen: los que tienen contenido (SIN filtros), menos el destino.
  const byM = new Map();
  for (const p of posts || []) {
    const k = monthKeyOf(p);
    if (!k || k === activeMonth) continue;
    if (!byM.has(k)) byM.set(k, []);
    byM.get(k).push(p);
  }
  const keys = [...byM.keys()].sort().reverse(); // el más reciente primero
  if (!keys.length) {
    ctx.toast('No hay otro mes con contenido para copiar.', { type: 'info' });
    return;
  }

  const destLbl = capitalize(monthLabel(activeMonth));
  const src = await ctx.sheet.pickFrom({
    title: `Copiar a ${destLbl} desde…`,
    options: keys.map((ym) => ({
      value: ym,
      label: capitalize(monthLabel(ym)),
      sub: `${byM.get(ym).length} ${byM.get(ym).length === 1 ? 'pieza' : 'piezas'}`,
    })),
  });
  if (!src) return;

  const rows = byM.get(src) || [];
  const [dy, dm] = activeMonth.split('-').map(Number);
  const lastDay = new Date(dy, dm, 0).getDate();
  copiandoMes = true;
  ctx.toast(`Copiando ${rows.length} ${rows.length === 1 ? 'pieza' : 'piezas'} de ${capitalize(monthLabel(src))} a ${destLbl}…`, { type: 'info' });

  let ok = 0;
  let fail = 0;
  await trackMutation((async () => {
    for (const p of rows) {
      try {
        const res = await api.post(`/posts/${encodeURIComponent(p.id)}/duplicate`, {
          include_checklist: 1, include_script: 1,
        });
        const nuevo = (res && res.post) || res;
        if (!nuevo || !nuevo.id) { fail += 1; continue; }
        const day = Math.min(Number(String(p.publish_date || '').slice(8, 10)) || 1, lastDay);
        // patchPost inserta el duplicado en memoria al resolver (la copia va
        // apareciendo en el mes destino conforme avanza) y toastea si falla.
        const saved = await ctx.store.patchPost(nuevo.id, {
          publish_date: `${activeMonth}-${String(day).padStart(2, '0')}`,
        });
        if (saved) ok += 1; else fail += 1;
      } catch { fail += 1; }
    }
  })());
  copiandoMes = false;

  // Estado fresco del servidor al final (posiciones, títulos, contadores).
  await ctx.store.loadPosts();
  ctx.store.refreshClientCounts();
  if (fail) ctx.toast(`Se copiaron ${ok} de ${rows.length} piezas; ${fail} fallaron. Inténtalo de nuevo para las que faltan.`, { type: 'error' });
  else ctx.toast(`Listo: ${ok} ${ok === 1 ? 'pieza copiada' : 'piezas copiadas'} a ${destLbl}. ✨`, { type: 'success' });
}






// Captura manual de resultados de Instagram del mes activo (bridge mientras
// Meta aprueba el acceso automático). Aparecen en el reporte mensual.
function openIgManual() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos' || !activeMonth || activeMonth === SIN_MES) return;
  const brand = (clients || []).find((c) => c.id === activeClientId);
  const mesLbl = capitalize(monthLabel(activeMonth));
  ctx.sheet.openSheet({
    title: `Resultados de IG · ${mesLbl}`,
    mode: 'form',
    build(body, close) {
      const field = (label, key, ph) => {
        const input = el('input', { class: 'input', type: 'number', min: '0', inputmode: 'numeric', placeholder: ph, dataset: { k: key } });
        return { row: el('div', { class: 'field' }, [el('label', { class: 'label', text: label }), input]), input };
      };
      const f1 = field('Seguidores', 'followers', 'ej. 4100');
      const f2 = field('Alcance del mes', 'reach', 'ej. 35000');
      const f3 = field('Interacciones (likes + comentarios)', 'interactions', 'ej. 1200');
      const f4 = field('Publicaciones del mes', 'posts', 'ej. 12');
      const inputs = [f1, f2, f3, f4];
      const hint = el('p', {
        class: 'meses-confirm__txt',
        text: `Abre Meta Business Suite → ${(brand && brand.name) || 'la marca'} → Estadísticas, copia los números de ${mesLbl} y pégalos aquí. Saldrán en el reporte mensual con tu logo.`,
      });
      const saveBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar resultados' });
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const payload = { client_id: activeClientId, month: activeMonth };
        for (const { input } of inputs) payload[input.dataset.k] = input.value.trim() === '' ? null : Number(input.value);
        try {
          const r = await fetch('/api/marketing/ig/manual', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar.');
          close({ source: 'saved' });
          ctx.toast(`Resultados de IG de ${mesLbl} guardados. Ya salen en el reporte. ✨`, { type: 'success' });
        } catch (e) {
          ctx.toast(e.message || 'No se pudo guardar.', { type: 'error' });
          saveBtn.disabled = false;
        }
      });
      body.append(hint, f1.row, f2.row, f3.row, f4.row, el('div', { class: 'sheet__footer' }, [
        el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
        saveBtn,
      ]));
      // La usuaria puede empezar a teclear antes de que llegue la precarga:
      // se marca cada campo tocado para que el fetch tardío no lo pise.
      for (const { input } of inputs) input.addEventListener('input', () => { input.dataset.dirty = '1'; });
      // Precargar lo que ya esté guardado (SOLO en campos vírgenes y vacíos).
      (async () => {
        try {
          const d = await fetch(`/api/marketing/ig/manual?client_id=${activeClientId}&month=${activeMonth}`, { credentials: 'include' }).then((r) => r.json());
          if (d && d.manual) for (const { input } of inputs) {
            const v = d.manual[input.dataset.k];
            if (v != null && !input.dataset.dirty && input.value.trim() === '') input.value = v;
          }
        } catch { /* noop */ }
      })();
      setTimeout(() => f1.input.focus(), 60);
    },
  });
}

// ── Brief de la marca (solo staff) ───────────────────────────────────────────
// Lo que la marca contestó en su onboarding, en un sheet de solo lectura.
// Cache simple en memoria por client_id: el brief casi nunca cambia y así el
// segundo toque abre al instante (se limpia al desmontar la vista).
const briefCache = new Map();

// Convierte cualquier respuesta a texto legible (listas → comas, vacío → em dash).
function briefAnswerText(v) {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.map(briefAnswerText).join(', ') : '—';
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => `${k}: ${briefAnswerText(x)}`).join(' · ') || '—';
  }
  return String(v);
}

// Pinta el brief bonito: título de sección (estilo mfilt__glabel) y por item
// la pregunta chiquita + la respuesta legible. Tolerante a varias formas del
// JSON: arreglo de secciones, {secciones:[...]}, u objeto plano pregunta→respuesta.
function renderBrief(brief) {
  const root = el('div', { class: 'mbrief' });
  const addItem = (q, a) => root.appendChild(el('div', { class: 'mbrief__item' }, [
    q ? el('div', { class: 'mbrief__q', text: String(q) }) : null,
    el('div', { class: 'mbrief__a', text: briefAnswerText(a) }),
  ]));
  const addSecTitle = (t) => root.appendChild(el('div', { class: 'mfilt__glabel mbrief__sec', text: String(t) }));

  const secs = Array.isArray(brief) ? brief
    : (brief && (Array.isArray(brief.secciones) ? brief.secciones
      : (Array.isArray(brief.sections) ? brief.sections : null)));
  if (secs) {
    for (const s of secs) {
      if (!s || typeof s !== 'object') continue;
      const title = s.titulo || s.title || s.seccion || s.section || s.nombre || '';
      if (title) addSecTitle(title);
      const items = Array.isArray(s.items) ? s.items : (Array.isArray(s.preguntas) ? s.preguntas : []);
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const q = it.pregunta || it.question || it.q || it.label || '';
        const a = 'respuesta' in it ? it.respuesta : ('answer' in it ? it.answer : it.a);
        addItem(q, a);
      }
    }
  } else if (brief && typeof brief === 'object') {
    // Objeto plano: cada llave es la pregunta; un sub-objeto es una sección.
    for (const [q, a] of Object.entries(brief)) {
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        addSecTitle(q);
        for (const [q2, a2] of Object.entries(a)) addItem(q2, a2);
      } else {
        addItem(q, a);
      }
    }
  }
  if (!root.childNodes.length) {
    root.appendChild(el('p', { class: 'meses-confirm__txt', text: 'El brief está vacío.' }));
  }
  return root;
}

// Abre el brief de la marca activa. 404 = la marca aún no lo llena (toast
// suave, sin sheet); cualquier otro error = toast de error.
async function openBrief() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return;
  const brand = (clients || []).find((c) => c.id === activeClientId);
  let brief = briefCache.get(activeClientId);
  if (brief === undefined) {
    try {
      brief = await api.get(`/clients/${activeClientId}/brief`);
    } catch (e) {
      if (!ctx) return; // la vista se desmontó mientras cargaba
      if (e && e.status === 404) ctx.toast('Esta marca aún no llena su brief', { type: 'info' });
      else ctx.toast((e && e.message) || 'No se pudo cargar el brief.', { type: 'error' });
      return;
    }
    if (!ctx) return;
    if (brief == null) { ctx.toast('Esta marca aún no llena su brief', { type: 'info' }); return; }
    briefCache.set(activeClientId, brief);
  }
  ctx.sheet.openSheet({
    title: `Brief de ${(brand && brand.name) || 'la marca'}`,
    mode: 'menu',
    build(body) {
      body.appendChild(renderBrief(brief));
    },
  });
}

// Interruptor de avisos automáticos por marca (recordatorios, atrasados,
// sin-aprobar). Persiste en mkt_clients.reminders_enabled vía PATCH.
async function toggleReminders(btn) {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return;
  const brand = (clients || []).find((c) => c.id === activeClientId);
  if (!brand) return;
  const next = brand.reminders_enabled === 0 ? 1 : 0;
  btn.disabled = true;
  try {
    const r = await fetch(`/api/marketing/clients/${activeClientId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminders_enabled: next }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar.');
    ctx.store.set({ clients: clients.map((c) => (c.id === activeClientId ? { ...c, reminders_enabled: next } : c)) });
    const span = btn.querySelector('.meses-remtoggle__txt');
    if (span) span.textContent = `Avisos automáticos: ${next ? 'Activados' : 'Desactivados'}`;
    btn.classList.toggle('is-off', !next);
    ctx.toast(next
      ? `Avisos automáticos activados para ${brand.name}.`
      : `Avisos automáticos desactivados para ${brand.name}.`, { type: 'success' });
  } catch (e) {
    ctx.toast(e.message || 'No se pudo guardar.', { type: 'error' });
  } finally {
    btn.disabled = false;
  }
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

function buildSection({ key, rows, noteLabels, collapsed = false, desktop, isTodos, single = false }) {
  const label = key === SIN_MES ? T('Sin mes', 'No date') : monthLabel(key);
  const bodyId = `meses-body-${key.replace(/[^a-z0-9-]/gi, '')}`;

  let heading;
  let head = null;
  if (single) {
    // Modo "mes activo": encabezado simple (NO colapsable). La navegacion por
    // mes es la barra lateral (desktop) / la barra de meses (movil).
    heading = el('h2', { class: 'meses-sec__h meses-sec__h--single' }, [
      el('span', { class: 'meses-sec__title', text: label }),
      el('span', { class: 'meses-sec__count', text: String(rows.length) }),
    ]);
  } else {
    head = el('button', {
      class: 'meses-sec__head', type: 'button',
      'aria-expanded': collapsed ? 'false' : 'true',
      'aria-controls': bodyId,
    }, [
      el('span', { class: 'meses-sec__chev' }, [icon('down', 16)]),
      el('span', { class: 'meses-sec__title', text: label }),
      el('span', { class: 'meses-sec__count', text: String(rows.length) }),
    ]);
    heading = el('h2', { class: 'meses-sec__h' }, [head]);
  }

  const bodyKids = [];
  if (rows.length) {
    // Desktop/tablet (>=768px): tabla completa. Movil (<768px): una tarjeta por
    // pieza con la misma info en chips (sin scroll horizontal). Sigue siendo
    // "una fila por pieza" — solo reflowada para que quepa en el telefono.
    bodyKids.push(desktop ? buildTable(rows, noteLabels) : buildMobileList(rows, noteLabels));
    // Barra unica de progreso del mes: pegada bajo la tabla para que se lea
    // como su resumen, antes del boton "Nueva linea".
    const progress = buildMonthProgress(rows);
    if (progress) bodyKids.push(progress);
  } else if (isClientRole() && !(allPostsForFilters || []).length) {
    // Calendario 100% VACIO de un cliente (self-signup): bienvenida en vez del
    // copy de staff. Una sola tarjeta, arriba del composer.
    bodyKids.push(el('div', { class: 'meses-empty empty-rich empty-rich--welcome' }, [
      el('div', { class: 'empty-rich__ico' }, [icon('calendar', 26)]),
      el('h3', { class: 'empty-rich__t', text: T('¡Bienvenido a tu calendario de contenido! 🎉', 'Welcome to your content calendar! 🎉') }),
      el('p', { class: 'empty-rich__s', text: T('Crea tu primera pieza con + Nueva línea: ponle título, fecha y escribe tu guion. Tu calendario, tus reglas.', 'Create your first piece with + New row: give it a title, a date and write your script. Your calendar, your rules.') }),
    ]));
  } else {
    bodyKids.push(el('div', { class: 'meses-empty empty-rich' }, [
      el('div', { class: 'empty-rich__ico' }, [icon('calendar', 26)]),
      el('h3', { class: 'empty-rich__t', text: T('Mes despejado', 'Clear month') }),
      el('p', { class: 'empty-rich__s', text: T('Aun no hay contenidos en este mes. Agrega la primera linea abajo para arrancar.', 'No content in this month yet. Add the first row below to get started.') }),
    ]));
  }
  if (!isTodos) bodyKids.push(buildComposer(key, rows));

  const showCollapsed = !single && collapsed;
  const body = el('div', { class: 'meses-sec__body', id: bodyId, hidden: showCollapsed }, bodyKids);

  // Franja de stats del mes (solo en modo "mes activo", con contenido).
  const statsStrip = (single && rows.length) ? buildMonthStats(rows) : null;

  const sec = el('section', {
    class: 'meses-sec' + (showCollapsed ? ' is-collapsed' : ''),
    dataset: { mes: key },
    'aria-label': `${label}, ${rows.length} ${rows.length === 1 ? 'fila' : 'filas'}`,
  }, [heading, statsStrip, body]);

  if (head) head.addEventListener('click', () => toggleSection(sec, key));
  return sec;
}

// ── Filtros (persistidos por cliente, estilo Notion) ─────────────────────────

const FILTER_DIMS = [
  { dim: 'status',   label: T('Estado', 'Status'),     getVal: (p) => p.status || '',       labelOf: (v) => statusLabel(v) || v },
  { dim: 'type',     label: T('Tipo', 'Type'),         getVal: (p) => p.content_type || '', labelOf: (v) => contentTypeLabel(v) || v },
  { dim: 'platform', label: T('Plataforma', 'Platform'), getVal: (p) => p.platform || '',     labelOf: (v) => v },
  { dim: 'grab',     label: T('Grabación', 'Recording'),  getVal: (p) => (p.grabacion == null || p.grabacion === '' ? '' : String(p.grabacion)), labelOf: (v) => `${T('Nivel', 'Level')} ${v}` },
  // Aprobación del cliente: sirve al cliente (banner "por revisar") y a la
  // dueña en su panel de filtros. Sin valor guardado cuenta como pendiente.
  { dim: 'approval', label: T('Aprobación', 'Approval'), getVal: (p) => approvalOf(p), labelOf: (v) => approvalLabel(v) || v },
];

function filtersKey() {
  const { activeClientId } = ctx.store.getState();
  return `meses.filtros.${activeClientId || 'global'}`;
}

// La elección de la SESIÓN vive en memoria y manda sobre localStorage: si el
// navegador bloquea el storage (Safari privado, cuota llena), prefs.set falla
// EN SILENCIO y sin esta capa el usuario elige "reciente primero" y la vista
// se queda en el default — el bug de "elijo un orden y no pasa nada".
const filterSession = new Map(); // filtersKey() -> objeto de filtros
const sortSession = new Map();   // sortPrefKey() -> { key, dir }

function getFilters() {
  const k = filtersKey();
  if (filterSession.has(k)) return filterSession.get(k);
  const f = ctx.prefs.get(k, null);
  return (f && typeof f === 'object' && !Array.isArray(f)) ? f : {};
}

function setFilters(f) {
  const any = Object.values(f).some(Boolean);
  filterSession.set(filtersKey(), any ? f : {});
  ctx.prefs.set(filtersKey(), any ? f : undefined); // undefined = borrar la pref
}

function applyFilters(posts) {
  const f = getFilters();
  if (!Object.values(f).some(Boolean)) return posts;
  return posts.filter((p) => FILTER_DIMS.every(({ dim, getVal }) => !f[dim] || getVal(p) === f[dim]));
}

// ── Orden (persistido por cliente) ───────────────────────────────────────────

function sortPrefKey() {
  const { activeClientId } = ctx.store.getState();
  return `meses.orden.${activeClientId || 'global'}`;
}

function getSort() {
  const k = sortPrefKey();
  if (sortSession.has(k)) return sortSession.get(k);
  // Por defecto SIEMPRE por fecha de publicacion, MAS RECIENTE PRIMERO (31 -> 1).
  // El orden que elijas (o el arrastre manual) dura mientras estas en la vista;
  // al recargar el calendario vuelve a abrir con lo mas reciente arriba.
  return { key: 'date', dir: 'desc' };
}

function setSort(key, dir) {
  const v = { key, dir: dir === 'desc' ? 'desc' : 'asc' };
  sortSession.set(sortPrefKey(), v);  // solo en esta sesion; el default al abrir es fecha
}

// Menu de columna estilo Excel: ordenar (segun la columna) + filtrar (si aplica).
async function openColMenu({ skey, sortType, label, filterDim }, anchor) {
  const f = getFilters();
  const s = getSort();
  const options = [];
  if (skey) {
    if (sortType === 'date') {
      options.push({ value: 'sort:asc',  label: 'Ordenar: más antiguo primero (día 1 → 31)', current: s.key === skey && s.dir === 'asc' });
      options.push({ value: 'sort:desc', label: 'Ordenar: más reciente primero (día 31 → 1)', current: s.key === skey && s.dir === 'desc' });
    } else if (sortType === 'num') {
      options.push({ value: 'sort:asc',  label: 'Ordenar: 1 → 5', current: s.key === skey && s.dir === 'asc' });
      options.push({ value: 'sort:desc', label: 'Ordenar: 5 → 1', current: s.key === skey && s.dir === 'desc' });
    } else {
      options.push({ value: 'sort:asc',  label: 'Ordenar: A → Z', current: s.key === skey && s.dir === 'asc' });
      options.push({ value: 'sort:desc', label: 'Ordenar: Z → A', current: s.key === skey && s.dir === 'desc' });
    }
  }
  if (filterDim) {
    const dimDef = FILTER_DIMS.find((x) => x.dim === filterDim);
    const seen = new Map();
    for (const p of allPostsForFilters) { const v = dimDef.getVal(p); if (v) seen.set(v, (seen.get(v) || 0) + 1); }
    options.push({ value: 'all', label: 'Mostrar todos', current: !f[filterDim] });
    for (const [v, n] of [...seen.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      options.push({ value: 'f:' + v, label: `${dimDef.labelOf(v)} (${n})`, current: f[filterDim] === v });
    }
  }
  const v = await ctx.sheet.pickFrom({ title: label, options, anchor });
  if (!v) return;
  if (v.startsWith('sort:')) setSort(skey, v.slice(5));
  else if (v === 'all') setFilters({ ...f, [filterDim]: '' });
  else if (v.startsWith('f:')) setFilters({ ...f, [filterDim]: v.slice(2) });
  render();
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

const SORT_MENU = [
  { value: 'date:asc',     label: 'Fecha: antiguo primero (día 1 → 31)' },
  { value: 'date:desc',    label: 'Fecha: reciente primero (día 31 → 1)' },
  { value: 'task:asc',     label: 'Tarea: A → Z' },
  { value: 'task:desc',    label: 'Tarea: Z → A' },
  { value: 'status:asc',   label: 'Estado: A → Z' },
  { value: 'platform:asc', label: 'Plataforma: A → Z' },
  { value: 'type:asc',     label: 'Tipo: A → Z' },
  { value: 'grab:asc',     label: 'Grabación: 1 → 5' },
];

async function onSortChip(anchor) {
  const s = getSort();
  const cur = `${s.key}:${s.dir}`;
  const options = SORT_MENU.map((o) => ({ ...o, current: o.value === cur }));
  const v = await ctx.sheet.pickFrom({ title: 'Ordenar', options, anchor });
  if (!v) return;
  const [key, dir] = v.split(':');
  setSort(key, dir);
  render();
}

// Etiqueta corta del criterio de orden actual (se muestra en el boton Ordenar).
function sortShortLabel(s) {
  const map = {
    'date:desc': 'Reciente',
    'date:asc': 'Antiguo',
    'task:asc': 'Tarea A→Z',
    'task:desc': 'Tarea Z→A',
    'status:asc': 'Estado',
    'platform:asc': 'Plataforma',
    'type:asc': 'Tipo',
    'grab:asc': 'Grabación',
  };
  return map[`${s.key}:${s.dir}`] || 'Reciente';
}

// Barra movil: 2 controles solidos (Ordenar con su criterio actual + Filtros
// con un badge de cuantos hay activos) y un boton Limpiar solo si aplica. Todos
// los filtros viven en UN solo panel (openFilterSheet), no en chips sueltos.
function buildFilterBar(allPosts) {
  const f = getFilters();
  const activeCount = Object.values(f).filter(Boolean).length;
  const s = getSort();
  const bar = el('div', { class: 'meses-toolbar', role: 'toolbar', 'aria-label': 'Ordenar y filtrar' });

  bar.appendChild(el('button', {
    class: 'meses-tool', type: 'button', 'aria-haspopup': 'dialog',
    onclick: (e) => onSortChip(e.currentTarget),
  }, [
    icon('sort', 16),
    el('span', { class: 'meses-tool__lbl', text: 'Ordenar' }),
    el('span', { class: 'meses-tool__val', text: sortShortLabel(s) }),
  ]));

  bar.appendChild(el('button', {
    class: 'meses-tool meses-tool--filters' + (activeCount ? ' is-active' : ''),
    type: 'button', 'aria-haspopup': 'dialog',
    onclick: () => openFilterSheet(allPosts),
  }, [
    icon('sliders', 16),
    el('span', { class: 'meses-tool__lbl', text: 'Filtros' }),
    activeCount ? el('span', { class: 'meses-tool__badge', text: String(activeCount) }) : null,
  ]));

  // Limpiar NO va en la barra (se desbordaria en pantallas angostas): vive
  // dentro del panel de filtros. El badge comunica que hay filtros activos.
  return bar;
}

// Panel unico de filtros (bottom sheet): una seccion por dimension con chips
// seleccionables (single-select) + conteo por valor, y footer con Limpiar y
// "Ver N piezas" (conteo en vivo). Se trabaja sobre un borrador; solo al
// pulsar Aplicar se commitea y re-renderiza la lista.
function openFilterSheet(allPosts) {
  const draft = { ...getFilters() };

  // Valores disponibles por dimension (con conteo); se omiten las vacias.
  const groups = FILTER_DIMS.map((d) => {
    const seen = new Map();
    for (const p of allPosts) { const v = d.getVal(p); if (v) seen.set(v, (seen.get(v) || 0) + 1); }
    const values = [...seen.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return { d, values };
  }).filter((g) => g.values.length);

  ctx.sheet.openSheet({
    title: 'Filtros',
    mode: 'menu',
    build(body, close) {
      const paint = () => {
        clear(body);
        const wrap = el('div', { class: 'mfilt' });
        if (!groups.length) {
          wrap.appendChild(el('div', { class: 'mfilt__empty', text: 'No hay filtros disponibles todavía.' }));
        }
        for (const { d, values } of groups) {
          const cur = draft[d.dim] || '';
          const chips = el('div', { class: 'mfilt__chips' });
          chips.appendChild(el('button', {
            class: 'mfilt-chip' + (!cur ? ' is-on' : ''), type: 'button',
            'aria-pressed': !cur ? 'true' : 'false',
            onclick: () => { draft[d.dim] = ''; paint(); },
          }, [!cur ? icon('check', 14) : null, el('span', { text: 'Todos' })]));
          for (const [v, n] of values) {
            const on = cur === v;
            chips.appendChild(el('button', {
              class: 'mfilt-chip' + (on ? ' is-on' : ''), type: 'button',
              'aria-pressed': on ? 'true' : 'false',
              onclick: () => { draft[d.dim] = on ? '' : v; paint(); },
            }, [
              on ? icon('check', 14) : null,
              el('span', { text: d.labelOf(v) }),
              el('span', { class: 'mfilt-chip__n', text: String(n) }),
            ]));
          }
          wrap.appendChild(el('div', { class: 'mfilt__group' }, [
            el('div', { class: 'mfilt__glabel', text: d.label }),
            chips,
          ]));
        }
        body.appendChild(wrap);

        const anyDraft = Object.values(draft).some(Boolean);
        const count = allPosts.filter((p) => FILTER_DIMS.every(({ dim, getVal }) => !draft[dim] || getVal(p) === draft[dim])).length;
        const clearBtn = el('button', {
          class: 'btn', type: 'button', text: 'Limpiar',
          onclick: () => { for (const k of Object.keys(draft)) draft[k] = ''; paint(); },
        });
        clearBtn.disabled = !anyDraft;
        const applyBtn = el('button', {
          class: 'btn btn-primary sheet-cta', type: 'button',
          text: `Ver ${count} ${count === 1 ? 'pieza' : 'piezas'}`,
          onclick: () => { setFilters(draft); render(); close({ source: 'apply' }); },
        });
        body.appendChild(el('div', { class: 'sheet__footer' }, [clearBtn, applyBtn]));
      };
      paint();
    },
  });
}

// ── Barra lateral de meses (desktop) ─────────────────────────────────────────

// Selecciona el mes activo (la navegacion por mes). El area principal se
// re-renderiza mostrando SOLO ese mes; nada de secciones apiladas.
function selectMonth(key) {
  if (activeMonth === key) return;
  activeMonth = key;
  render();
  if (rootEl) {
    const main = rootEl.querySelector('.meses-main');
    if (main && main.scrollIntoView) main.scrollIntoView({ block: 'start' });
  }
}

// Barra de meses horizontal para movil/tablet (la barra lateral solo existe
// >=1024px). Mismas opciones que la lateral, en chips.
function buildMonthBar(keys, byMonth, sinMes) {
  const bar = el('div', { class: 'meses-monthbar', role: 'tablist', 'aria-label': 'Meses' });
  for (const k of keys) {
    const label = k === SIN_MES ? T('Sin mes', 'No date') : capitalize(monthLabel(k));
    const n = k === SIN_MES ? sinMes.length : (byMonth.get(k) || []).length;
    const active = k === activeMonth;
    bar.appendChild(el('button', {
      class: 'meses-monthpill' + (active ? ' is-active' : ''),
      type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false',
      onclick: () => selectMonth(k),
    }, [
      el('span', { class: 'meses-monthpill__lbl', text: label }),
      el('span', { class: 'meses-monthpill__n', text: String(n) }),
    ]));
  }
  return bar;
}

function buildSideNav(ordered, byMonth, sinMes, isTodos) {
  if (!sideEl) return;
  clear(sideEl);
  const items = ordered.map((ym) => ({ key: ym, label: capitalize(monthLabel(ym)), n: (byMonth.get(ym) || []).length }));
  if (sinMes.length) items.push({ key: SIN_MES, label: 'Sin mes', n: sinMes.length });
  sideEl.appendChild(el('div', { class: 'meses-side__title', text: 'Meses' }));
  for (const it of items) {
    const active = it.key === activeMonth;
    sideEl.appendChild(el('button', {
      class: 'meses-side__item' + (active ? ' is-active' : ''),
      type: 'button',
      'aria-current': active ? 'true' : 'false',
      onclick: () => selectMonth(it.key),
    }, [
      el('span', { class: 'meses-side__lbl', text: it.label }),
      el('span', { class: 'meses-side__n', text: String(it.n) }),
    ]));
  }
  // "Agregar mes" para TODOS los roles: el cliente dueño de su calendario
  // (self-signup) tambien lo necesita para planear el mes siguiente. Los
  // endpoints ya lo permiten; esto es solo UI.
  if (!isTodos) {
    sideEl.appendChild(el('button', {
      class: 'meses-side__add', type: 'button',
      onclick: () => openAddMonth(),
    }, [icon('plus', 14), el('span', { text: T('Agregar mes', 'Add month') })]));
  }
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
  allPostsForFilters = allPosts;
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

  // Meses visibles: los que tienen contenido + los agregados a mano. El mes
  // actual SOLO se fuerza si no hay nada mas (cliente recien creado), para no
  // mostrar un mes vacio de relleno (p. ej. Junio 0 cuando el plan es Julio).
  const keySet = new Set([...byMonth.keys(), ...extra]);
  if (keySet.size === 0) keySet.add(currentYM());
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

  // Banner del CLIENTE arriba del calendario: "Tienes N piezas por revisar"
  // (todas las pendientes de su aprobación, de cualquier mes). Tocar filtra
  // por Aprobación=Pendiente y salta al mes más reciente con piezas por ver.
  if (isClientRole()) {
    const porRevisar = allPosts.filter((p) => approvalOf(p) === 'pending');
    if (porRevisar.length) {
      sectionsEl.appendChild(el('button', {
        class: 'meses-revisar', type: 'button',
        onclick: () => {
          setFilters({ ...getFilters(), approval: 'pending' });
          const meses = porRevisar.map(monthKeyOf).filter(Boolean).sort();
          if (meses.length) activeMonth = meses[meses.length - 1];
          render();
        },
      }, [
        icon('bell', 18),
        el('span', {
          class: 'meses-revisar__txt',
          text: `Tienes ${porRevisar.length} ${porRevisar.length === 1 ? 'pieza' : 'piezas'} por revisar`,
        }),
        icon('right', 16),
      ]));
    }
  }

  // En desktop los filtros viven en los encabezados de la tabla (estilo Excel).
  // La barra de chips solo se usa en movil (la lista no tiene encabezados).
  if (!desktop) sectionsEl.appendChild(buildFilterBar(allPosts));

  if (isTodos) {
    sectionsEl.appendChild(el('div', {
      class: 'meses-todos-note',
      text: 'Estás viendo todas las marcas. Elige una marca para agregar filas y meses.',
    }));
  }

  // La navegacion por mes vive en la barra lateral (desktop) / barra de meses
  // (movil). El area principal muestra SOLO el mes activo, sin secciones
  // colapsables apiladas. Por defecto cae en el mes MAS RECIENTE (el ultimo
  // calendario creado), no en el mes actual del sistema.
  const selectableKeys = [...ordered];
  if (sinMes.length) selectableKeys.push(SIN_MES);
  if (!activeMonth || !selectableKeys.includes(activeMonth)) {
    // Por defecto cae en el MES MÁS RECIENTE (el último "calendario" creado), no
    // en el mes actual del sistema. `ordered` ya trae los meses con contenido y
    // los agregados a mano, en orden ascendente, así que el último es el más nuevo.
    activeMonth = ordered.length
      ? ordered[ordered.length - 1]
      : (selectableKeys[0] || currentYM());
  }

  // Selector de meses para movil/tablet (la barra lateral solo existe >=1024px).
  if (selectableKeys.length > 1) {
    sectionsEl.appendChild(buildMonthBar(selectableKeys, byMonth, sinMes));
  }

  const activeRows = activeMonth === SIN_MES ? sinMes : (byMonth.get(activeMonth) || []);
  sectionsEl.appendChild(buildSection({
    key: activeMonth,
    rows: sortRows(activeRows),
    noteLabels,
    desktop,
    isTodos,
    single: true,
  }));

  const esCliente = isClientRole(); // (helper de módulo; sin shadowing local)
  // "Agregar mes" para TODOS los roles (cliente incluido): el dueño de su
  // calendario lo necesita para planear el mes siguiente.
  if (!isTodos) {
    sectionsEl.appendChild(el('button', {
      class: 'meses-addmonth', type: 'button',
      onclick: () => openAddMonth(),
    }, [icon('plus', 16), el('span', { text: T('Agregar mes', 'Add month') })]));
  }
  if (!isTodos && !esCliente) {
    // Copiar mes anterior: duplica las piezas de otro mes en el mes activo
    // (solo staff, y solo con un mes destino con fecha).
    if (activeMonth && activeMonth !== SIN_MES) {
      sectionsEl.appendChild(el('button', {
        class: 'meses-addmonth meses-copymonth', type: 'button',
        title: `${T('Duplica todas las piezas de otro mes en', 'Duplicate all pieces from another month into')} ${capitalize(monthLabel(activeMonth))}`,
        onclick: () => openCopyMonth(),
      }, [icon('copy', 16), el('span', { text: T('Copiar mes anterior…', 'Copy previous month…') })]));
    }
    // Avisos automáticos por marca (solo admin/equipo).
    const brandRow = (ctx.store.getState().clients || []).find((c) => c.id === activeClientId);
    const remOn = !brandRow || brandRow.reminders_enabled !== 0;
    sectionsEl.appendChild(el('button', {
      class: 'meses-addmonth meses-remtoggle' + (remOn ? '' : ' is-off'), type: 'button',
      title: T('Recordatorios de publicación, atrasados y sin-aprobar de esta marca', 'Publish, overdue and unapproved reminders for this brand'),
      onclick: (e) => toggleReminders(e.currentTarget),
    }, [icon('bell', 16), el('span', { class: 'meses-remtoggle__txt', text: `${T('Avisos automáticos:', 'Automatic alerts:')} ${remOn ? T('Activados', 'On') : T('Desactivados', 'Off')}` })]));
  }
  // Reporte mensual imprimible con el branding de la marca (admin y cliente).
  if (!isTodos && activeClientId && activeMonth && activeMonth !== SIN_MES) {
    sectionsEl.appendChild(el('a', {
      class: 'meses-icslink meses-replink',
      href: `/api/marketing/report?client_id=${encodeURIComponent(activeClientId)}&month=${encodeURIComponent(activeMonth)}`,
      target: '_blank', rel: 'noopener',
    }, [icon('activity', 15), el('span', { text: `${T('Reporte de', 'Report for')} ${capitalize(monthLabel(activeMonth))}` })]));
    // Brief de la marca: lo que contestó en su onboarding (SOLO staff).
    if (!esCliente) {
      sectionsEl.appendChild(el('button', {
        class: 'meses-icslink mbrief-open', type: 'button',
        title: T('Lo que la marca contestó en su brief de onboarding', 'What the brand answered in its onboarding brief'),
        onclick: () => openBrief(),
      }, [icon('briefcase', 15), el('span', { text: T('Brief de la marca', 'Brand brief') })]));
    }
    // Captura manual de resultados de Instagram para el mes (solo staff).
    if (!esCliente) {
      sectionsEl.appendChild(el('button', {
        class: 'meses-addmonth meses-igmanual', type: 'button',
        onclick: () => openIgManual(),
      }, [icon('camera', 16), el('span', { text: `${T('Resultados de Instagram de', 'Instagram results for')} ${capitalize(monthLabel(activeMonth))}` })]));
    }
  }

  // Barra lateral de meses (desktop): salta y expande la seccion del mes.
  buildSideNav(ordered, byMonth, sinMes, isTodos);

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
    sideEl = el('nav', { class: 'meses-side', 'aria-label': 'Meses' });
    rootEl = el('div', { class: 'meses-root' }, [
      sideEl,
      el('div', { class: 'meses-main' }, [sectionsEl]),
    ]);
    host.appendChild(rootEl);

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'activeClientId', 'clients'], scheduleRender),
      // Regla anti popovers huerfanos: antes de procesar posts:changed se
      // cierran sheets/pickers abiertos (su anchor pudo dejar de existir).
      // OJO: si el evento viene de una mutación de ESTA vista que resolvió
      // tarde (red lenta), NO se cierra nada — la usuaria pudo abrir otro
      // sheet en ese lapso y estar escribiendo (closeAll tiraría lo tecleado).
      ctx.store.on('posts:changed', () => {
        if (mutacionesEnVuelo > 0) return;
        try { ctx.sheet.closeAll(); } catch { /* noop */ }
      }),
      ctx.store.on('client:changed', () => { composer = null; composerInput = null; activeMonth = null; closeCaptionDrawer(); }),
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
    if (dndDispose) { try { dndDispose(); } catch { /* noop */ } dndDispose = null; }
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
    briefCache.clear();
    activeMonth = null;
    sectionsEl = null;
    sideEl = null;
    rootEl = null;
    ctx = null;
  },
};
