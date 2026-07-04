// ============================================================================
// IVAE Marketing v2 - Vista Tabla enterprise (estilo Monday Main Table).
// Ruta: #/tabla   Namespace CSS: .etable (JAMAS .grid, que es del legacy).
//
// - Grupos colapsables por Mes (default) / Estado / Sin grupos, con battery
//   bar de distribucion de status y bucket 'Otros' (posts nunca invisibles).
// - Edicion inline tipada via ctx.pickers (un PATCH por campo, optimista con
//   rollback en el store + toast 'Guardado.').
// - Sort por columna client-side DENTRO de cada grupo (asc/desc/ninguno).
// - Seleccion multiple: shift-click desktop, long-press movil con fallback
//   visible ('Seleccionar' en el menu de la toolbar) + barra de acciones
//   masivas via services/bulk (1 request, snapshot, rollback total).
// - Quick-add por grupo con herencia de defaults (table/quickadd.js).
// - Columnas de notas dinamicas por client.note_labels (table/columns.js).
// - 390px: tarjetas-fila por grupo con chips configurables (max 3).
// - Chips de vistas guardadas via services/views (con degradacion local).
//
// Contrato de vista: export default { mount(el, ctx), onParams(), unmount() }.
// ============================================================================

import { el, clear, api, fmtDate, avatar } from '../api.js?v=202607032115';
import { icon } from '../shell/icons.js?v=202607032115';
import { isPast } from '../lib/dates.js?v=202607032115';
import * as viewsSvc from '../services/views.js?v=202607032115';
import {
  buildColumns, visibleColumns,
  MOBILE_SORT_OPTIONS, CARD_FIELDS, DEFAULT_CARD_FIELDS, MAX_CARD_FIELDS,
  PRIORITIES, PRIORITY_ORDER, safeUrl,
  STATUSES, CONTENT_TYPES, GRABACION_LEVELS,
} from '../table/columns.js?v=202607032115';
import * as grp from '../table/groups.js?v=202607032115';
import { createSelection } from '../table/selection.js?v=202607032115';
import {
  createQuickAddRow, createQuickAddButton, openQuickAddSheet, resetChain,
} from '../table/quickadd.js?v=202607032115';

const FILTER_KEYS = ['estado', 'tipo', 'persona', 'desde', 'hasta', 'q'];
const ERR_SAVE = 'No se pudo guardar, intenta de nuevo.';

let ctx = null;
let rootEl = null;
let bodyHost = null;       // contenedor del cuerpo (tabla o tarjetas)
let noticeEl = null;
let countEl = null;
let groupChipTxt = null;
let sortChipTxt = null;
let viewsRowEl = null;
let selection = null;
let unsubs = [];
let mql = null;
let onMql = null;
let renderQueued = false;

// Efimero del render (JAMAS en store/prefs):
let renderedGroups = [];   // [{key, ids:[...]}] en orden visible
let visibleOrder = [];     // ids planos en orden visible (rangos shift-click)
let rovingCells = [];      // matriz [fila][col] de celdas enfocables
let rovingPos = { r: 0, c: 0 };

// ── Helpers de estado ────────────────────────────────────────────────────────

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

/** Asigna la variable CSS --gc (las custom properties no entran por style:{}). */
function withGroupColor(node, color) {
  try { node.style.setProperty('--gc', color || 'var(--client-accent)'); } catch { /* noop */ }
  return node;
}

function clientKey() {
  const { activeClientId } = ctx.store.getState();
  return activeClientId || 'todos';
}

function activeClient() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || null;
}

function getGroupBy() {
  const all = ctx.prefs.get('tableGroupBy', {}) || {};
  const v = all[clientKey()];
  return ['month', 'status', 'none'].includes(v) ? v : 'month';
}
function setGroupBy(v) {
  const all = ctx.prefs.get('tableGroupBy', {}) || {};
  all[clientKey()] = v;
  ctx.prefs.set('tableGroupBy', all);
}

function getSort() {
  const all = ctx.prefs.get('tableSort', {}) || {};
  const s = all[clientKey()];
  return (s && s.key && (s.dir === 'asc' || s.dir === 'desc')) ? s : null;
}
function setSort(s) {
  const all = ctx.prefs.get('tableSort', {}) || {};
  if (s) all[clientKey()] = s; else delete all[clientKey()];
  ctx.prefs.set('tableSort', all);
}

function getColsPref() {
  const all = ctx.prefs.get('tableCols', {}) || {};
  const v = all[clientKey()];
  return Array.isArray(v) ? v : null;
}
function setColsPref(keys) {
  const all = ctx.prefs.get('tableCols', {}) || {};
  all[clientKey()] = keys;
  ctx.prefs.set('tableCols', all);
}

function getCardFields() {
  const all = ctx.prefs.get('tableCardFields', {}) || {};
  const v = all[clientKey()];
  return (Array.isArray(v) && v.length) ? v.slice(0, MAX_CARD_FIELDS) : DEFAULT_CARD_FIELDS;
}
function setCardFields(keys) {
  const all = ctx.prefs.get('tableCardFields', {}) || {};
  all[clientKey()] = keys.slice(0, MAX_CARD_FIELDS);
  ctx.prefs.set('tableCardFields', all);
}

function getCollapsedSet(groupsList, mode) {
  const stored = grp.readCollapsed(ctx.prefs, clientKey(), mode);
  if (stored) return new Set(stored);
  return new Set(grp.initialCollapsed(groupsList, mode, !isDesktop()));
}
function persistCollapsed(set, mode) {
  grp.writeCollapsed(ctx.prefs, clientKey(), mode, [...set]);
}

// ── Filtros (espejo de la URL, igual que el tablero) ─────────────────────────

function activeFilters() {
  const { filters, search } = ctx.store.getState();
  const f = { ...(filters || {}) };
  if (!f.q && search) f.q = search;
  return f;
}

function filterCount() {
  const f = activeFilters();
  return FILTER_KEYS.filter((k) => f[k]).length;
}

function matchFilters(p) {
  const f = activeFilters();
  if (f.estado && p.status !== f.estado) return false;
  if (f.tipo && p.content_type !== f.tipo) return false;
  if (f.persona && String(p.assignee || '').toLowerCase() !== String(f.persona).toLowerCase()) return false;
  if (f.desde && (!p.publish_date || String(p.publish_date).slice(0, 10) < f.desde)) return false;
  if (f.hasta && (!p.publish_date || String(p.publish_date).slice(0, 10) > f.hasta)) return false;
  if (f.q) {
    const q = String(f.q).toLowerCase();
    const hit = [p.title, p.caption, p.assignee]
      .some((v) => v && String(v).toLowerCase().includes(q));
    if (!hit) return false;
  }
  return true;
}

function navigateFilters(patch) {
  const cur = ctx.router.current();
  const params = { ...cur.params };
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v == null) delete params[k]; else params[k] = v;
  }
  ctx.router.navigate(cur.view || 'tabla', params, { replace: true });
}

function clearAllFilters() {
  ctx.store.set({ search: '' });
  navigateFilters({ estado: '', tipo: '', persona: '', desde: '', hasta: '', q: '' });
}

function postById(id) {
  return (ctx.store.getState().posts || []).find((p) => String(p.id) === String(id)) || null;
}

function nextPositionFor(group) {
  const all = ctx.store.getState().posts || [];
  const mode = getGroupBy();
  let pool = all;
  if (group && mode === 'month') pool = all.filter((p) => grp.monthKeyOf(p) === group.key);
  else if (group && mode === 'status') pool = all.filter((p) => grp.statusKeyOf(p) === group.key);
  return grp.nextPositionIn(pool);
}

// ── Edicion inline tipada (un PATCH por campo, optimista + rollback) ─────────

async function patchAndToast(postId, fields) {
  const res = await ctx.store.patchPost(postId, fields);
  if (res) ctx.toast('Guardado.', { type: 'success', ms: 1200 });
  return !!res;
}

/** Aprobacion: usa /approve y /request-changes (funcionan en v1 y v2). */
async function setApproval(post, value) {
  if (!value || value === post.approval_state) return;

  if (value === 'pending') {
    // Solo el backend v2 acepta approval_state en PATCH; en v1 el store
    // hace rollback + toast del error del servidor.
    await patchAndToast(post.id, { approval_state: 'pending' });
    return;
  }

  let comment = null;
  if (value === 'changes') {
    const txt = await ctx.pickers.textExpand({
      title: 'Pedir cambios',
      placeholder: 'Que hay que cambiar...',
      hint: 'El comentario es obligatorio y lo vera tambien el cliente.',
      maxLength: 2000,
    });
    if (txt === null) return;
    comment = String(txt).trim();
    if (!comment) {
      ctx.toast('Escribe un comentario para pedir cambios.', { type: 'error' });
      return;
    }
  }

  const rollback = ctx.store.optimistic((s) => ({
    posts: s.posts.map((p) => (p.id === post.id ? { ...p, approval_state: value } : p)),
  }));
  try {
    const path = value === 'approved'
      ? `/posts/${encodeURIComponent(post.id)}/approve`
      : `/posts/${encodeURIComponent(post.id)}/request-changes`;
    const res = await api.post(path, comment ? { comment } : {});
    if (res && res.post && res.post.id) ctx.store.upsertPost(res.post);
    ctx.store.emit('posts:changed');
    ctx.store.emit('mutated');
    ctx.store.refreshClientCounts();
    ctx.toast('Guardado.', { type: 'success', ms: 1200 });
  } catch (e) {
    rollback();
    ctx.toast((e && e.message) || ERR_SAVE, { type: 'error' });
  }
}

/** Texto largo: si el PATCH falla, reabre con el borrador (no se pierde texto). */
async function editText(def, post) {
  let draft = def.current(post) || '';
  for (;;) {
    const v = await ctx.pickers.textExpand({
      title: def.label,
      value: draft,
      maxLength: def.maxLength || 4000,
    });
    if (v === null) return;
    const fields = def.patch(v, post);
    const ok = await patchAndToast(post.id, fields);
    if (ok) return;
    draft = v; // reintenta sin perder lo escrito
  }
}

async function editTitle(post) {
  let draft = post.title || '';
  for (;;) {
    const v = await ctx.pickers.textExpand({
      title: 'Titulo', value: draft, maxLength: 200,
    });
    if (v === null) return;
    const title = String(v).trim();
    if (!title) {
      ctx.toast('El titulo no puede quedar vacio.', { type: 'error' });
      draft = v;
      continue;
    }
    const ok = await patchAndToast(post.id, { title });
    if (ok) return;
    draft = v;
  }
}

function editUrl(def, post) {
  ctx.sheet.openSheet({
    title: def.label,
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'url', inputmode: 'url',
        placeholder: 'https://...',
        'aria-label': `Enlace de ${def.label}`,
      });
      input.value = def.current(post) || '';
      const save = async () => {
        let raw = input.value.trim();
        // Acepta links sin protocolo (ej. canva.link/…): le anteponemos https:// si
        // trae un dominio con punto. safeUrl sigue siendo el guardia estricto final.
        if (raw && !/^https?:\/\//i.test(raw) && /[^\s]\.[^\s]/.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
        if (raw && !safeUrl(raw)) {
          ctx.toast('Pega un enlace válido (ej. instagram.com/… o https://…).', { type: 'error' });
          input.focus();
          return;
        }
        close({ source: 'save' });
        await patchAndToast(post.id, def.patch(raw ? safeUrl(raw) : ''));
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
      });
      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Enlace' }), input]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar', onclick: save }),
        ]),
      );
      setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 60);
    },
  });
}

async function commitCell(def, post, anchor) {
  switch (def.type) {
    case 'status': {
      const v = await ctx.pickers.pickStatus({ current: post.status, anchor });
      if (v == null || v === post.status) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'date': {
      const v = await ctx.pickers.pickDate({ current: post.publish_date || null, anchor });
      if (v === null) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'person': {
      const users = await ctx.store.loadUsers();
      const v = await ctx.pickers.pickPerson({ current: post.assignee || '', users, anchor });
      if (v === null) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'platform': {
      const v = await ctx.pickers.pickPlatform({ current: post.platform || '', anchor });
      if (v === null) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'type': {
      const v = await ctx.pickers.pickType({ current: post.content_type, anchor });
      if (v == null || v === post.content_type) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'grabacion': {
      const v = await ctx.sheet.pickFrom({
        title: 'Prioridad de grabacion',
        anchor,
        options: [
          ...GRABACION_LEVELS.map((n) => ({
            value: String(n),
            label: `Nivel ${n}${n === 1 ? ' (mas urgente)' : n === 5 ? ' (menos urgente)' : ''}`,
            current: Number(post.grabacion) === n,
          })),
          { value: '', label: 'Sin nivel', current: post.grabacion == null || post.grabacion === '' },
        ],
      });
      if (v === null) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'priority': {
      const v = await ctx.sheet.pickFrom({
        title: 'Prioridad',
        anchor,
        options: PRIORITY_ORDER.map((k) => ({
          value: k,
          label: (PRIORITIES[k] && PRIORITIES[k].label) || k,
          color: (PRIORITIES[k] && PRIORITIES[k].color) || undefined,
          current: (post.priority || 'media') === k,
        })),
      });
      if (v == null) return;
      await patchAndToast(post.id, def.patch(v));
      return;
    }
    case 'approval': {
      const v = await ctx.pickers.pickApproval({ current: post.approval_state, anchor });
      if (v == null) return;
      await setApproval(post, v);
      return;
    }
    case 'text':
      await editText(def, post);
      return;
    case 'url':
      editUrl(def, post);
      return;
    default:
  }
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function paintToolbar() {
  if (groupChipTxt) groupChipTxt.textContent = `Agrupar: ${grp.groupModeLabel(getGroupBy())}`;
  if (sortChipTxt) {
    const s = getSort();
    const opt = s && MOBILE_SORT_OPTIONS.find((o) => o.key === s.key);
    sortChipTxt.textContent = `Orden: ${opt ? opt.label : (s ? s.key : 'Posicion')}`;
  }
}

function openGroupBySheet(anchor) {
  ctx.sheet.pickFrom({
    title: 'Agrupar por',
    anchor,
    options: grp.GROUP_MODES.map((m) => ({
      value: m.value, label: m.label, current: getGroupBy() === m.value,
    })),
  }).then((v) => {
    if (v == null || v === getGroupBy()) return;
    setGroupBy(v);
    paintToolbar();
    scheduleRender();
  });
}

function openSortSheet(anchor) {
  ctx.sheet.openSheet({
    title: 'Ordenar',
    mode: 'menu',
    anchor,
    build(body, close) {
      const cur = getSort();
      const list = el('div', { class: 'pick-list' });
      for (const o of MOBILE_SORT_OPTIONS) {
        const isCur = !!(cur && cur.key === o.key);
        list.appendChild(el('button', {
          class: 'pick-row' + (isCur ? ' is-current' : ''), type: 'button',
          onclick: () => {
            setSort({ key: o.key, dir: isCur && cur.dir === 'asc' ? 'desc' : 'asc' });
            close({ source: 'pick' });
            paintToolbar();
            scheduleRender();
          },
        }, [
          el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: o.label })]),
          isCur ? el('span', { class: 'pick-row__check', text: cur.dir === 'asc' ? '↑' : '↓' }) : null,
        ]));
      }
      list.appendChild(el('button', {
        class: 'pick-row pick-row--clear' + (!cur ? ' is-current' : ''), type: 'button',
        onclick: () => { setSort(null); close({ source: 'pick' }); paintToolbar(); scheduleRender(); },
      }, [el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: 'Sin orden (posicion)' })])]));
      body.appendChild(list);
    },
  });
}

function openColumnsSheet(anchor) {
  const allCols = buildColumns(activeClient());
  ctx.sheet.openSheet({
    title: 'Columnas visibles',
    mode: 'menu',
    anchor,
    build(body) {
      const visible = new Set(visibleColumns(allCols, getColsPref()).map((c) => c.key));
      const list = el('div', { class: 'etable-menu' });
      for (const col of allCols) {
        const check = el('span', { class: 'etable-menu-row__check', text: visible.has(col.key) ? '✓' : '' });
        list.appendChild(el('button', {
          class: 'etable-menu-row', type: 'button',
          'aria-pressed': visible.has(col.key) ? 'true' : 'false',
          onclick: (e) => {
            if (visible.has(col.key)) visible.delete(col.key);
            else visible.add(col.key);
            setColsPref(allCols.map((c) => c.key).filter((k) => visible.has(k)));
            check.textContent = visible.has(col.key) ? '✓' : '';
            e.currentTarget.setAttribute('aria-pressed', visible.has(col.key) ? 'true' : 'false');
            scheduleRender();
          },
        }, [el('span', { class: 'etable-menu-row__label', text: col.label }), check]));
      }
      body.appendChild(list);
    },
  });
}

function openCardFieldsSheet(anchor) {
  ctx.sheet.openSheet({
    title: 'Campos de la tarjeta',
    mode: 'menu',
    anchor,
    build(body) {
      body.appendChild(el('p', { class: 'etable-menu__hint', text: `Elige hasta ${MAX_CARD_FIELDS} campos.` }));
      const current = new Set(getCardFields());
      const list = el('div', { class: 'etable-menu' });
      for (const f of CARD_FIELDS) {
        const check = el('span', { class: 'etable-menu-row__check', text: current.has(f.key) ? '✓' : '' });
        list.appendChild(el('button', {
          class: 'etable-menu-row', type: 'button',
          'aria-pressed': current.has(f.key) ? 'true' : 'false',
          onclick: (e) => {
            if (current.has(f.key)) {
              current.delete(f.key);
            } else {
              if (current.size >= MAX_CARD_FIELDS) {
                ctx.toast(`Maximo ${MAX_CARD_FIELDS} campos en la tarjeta.`, { type: 'info' });
                return;
              }
              current.add(f.key);
            }
            setCardFields(CARD_FIELDS.map((x) => x.key).filter((k) => current.has(k)));
            check.textContent = current.has(f.key) ? '✓' : '';
            e.currentTarget.setAttribute('aria-pressed', current.has(f.key) ? 'true' : 'false');
            scheduleRender();
          },
        }, [el('span', { class: 'etable-menu-row__label', text: f.label }), check]));
      }
      body.appendChild(list);
    },
  });
}

function openOverflowMenu(anchor) {
  ctx.sheet.openSheet({
    title: 'Opciones de la tabla',
    mode: 'menu',
    anchor,
    build(body, close) {
      const row = (ic, label, onTap) => el('button', {
        class: 'etable-menu-row', type: 'button',
        onclick: () => { close({ source: 'pick' }); onTap(); },
      }, [icon(ic, 20), el('span', { class: 'etable-menu-row__label', text: label }), icon('right', 16)]);

      const mode = getGroupBy();
      const { posts } = ctx.store.getState();
      const groupsList = grp.groupPosts((posts || []).filter(matchFilters), mode, {
        brandColor: activeClient() && activeClient().brand_color,
      });

      const items = [
        row('down', 'Expandir todo', () => { persistCollapsed(new Set(), mode); scheduleRender(); }),
        row('up', 'Colapsar todo', () => {
          persistCollapsed(new Set(groupsList.map((g) => g.key)), mode);
          scheduleRender();
        }),
      ];
      if (!isDesktop()) {
        items.push(row('check', 'Seleccionar contenidos', () => selection.enterSelectMode()));
      }
      items.push(row('spark', 'Guardar vista actual', () => openSaveViewSheet()));
      if (viewsSvc.cached(clientKey()).length) {
        items.push(row('settings', 'Administrar vistas', () => openManageViewsSheet()));
      }
      if (filterCount() > 0) {
        items.push(row('filter', 'Quitar filtros', () => clearAllFilters()));
      }
      body.appendChild(el('div', { class: 'etable-menu' }, items));
    },
  });
}

function buildToolbar() {
  groupChipTxt = el('span', { class: 'etable-chip__txt' });
  const groupChip = el('button', {
    class: 'etable-chip', type: 'button', 'aria-haspopup': 'dialog',
    onclick: (e) => openGroupBySheet(e.currentTarget),
  }, [icon('board', 15), groupChipTxt]);

  sortChipTxt = el('span', { class: 'etable-chip__txt' });
  const sortChip = el('button', {
    class: 'etable-chip etable-chip--m', type: 'button', 'aria-haspopup': 'dialog',
    onclick: (e) => openSortSheet(e.currentTarget),
  }, [icon('gantt', 15), sortChipTxt]);

  const colsChip = el('button', {
    class: 'etable-chip etable-chip--d', type: 'button', 'aria-haspopup': 'dialog',
    'aria-label': 'Columnas visibles',
    onclick: (e) => openColumnsSheet(e.currentTarget),
  }, [icon('settings', 15), el('span', { class: 'etable-chip__txt', text: 'Columnas' })]);

  const fieldsChip = el('button', {
    class: 'etable-chip etable-chip--m', type: 'button', 'aria-haspopup': 'dialog',
    onclick: (e) => openCardFieldsSheet(e.currentTarget),
  }, [icon('eye', 15), el('span', { class: 'etable-chip__txt', text: 'Campos' })]);

  const dotsBtn = el('button', {
    class: 'etable-chip etable-chip--icon', type: 'button',
    'aria-label': 'Mas opciones', 'aria-haspopup': 'dialog',
    onclick: (e) => openOverflowMenu(e.currentTarget),
  }, [icon('dots', 18)]);

  countEl = el('span', { class: 'etable-count', 'aria-live': 'polite' });

  paintToolbar();
  return el('div', { class: 'etable-toolbar' }, [
    groupChip, sortChip, colsChip, fieldsChip, dotsBtn,
    el('span', { class: 'etable-toolbar__spacer' }),
    countEl,
  ]);
}

// ── Vistas guardadas (chips) ─────────────────────────────────────────────────

function openSaveViewSheet() {
  ctx.sheet.openSheet({
    title: 'Guardar vista actual',
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'text', maxlength: '60',
        placeholder: 'Nombre de la vista',
        'aria-label': 'Nombre de la vista',
      });
      const save = async () => {
        const name = input.value.trim();
        if (!name) { ctx.toast('Ponle nombre a la vista.', { type: 'error' }); input.focus(); return; }
        close({ source: 'save' });
        const created = await viewsSvc.captureCurrent(name);
        if (created) {
          ctx.toast('Vista guardada.', { type: 'success' });
          paintViews();
        }
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Nombre' }), input]),
        el('p', { class: 'etable-menu__hint', text: 'Guarda la combinacion actual de vista y filtros para volver con un tap.' }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar', onclick: save }),
        ]),
      );
      setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 60);
    },
  });
}

function openManageViewsSheet() {
  ctx.sheet.openSheet({
    title: 'Vistas guardadas',
    mode: 'menu',
    build(body, close) {
      const list = el('div', { class: 'etable-menu' });
      const paint = async () => {
        const views = await viewsSvc.list(clientKey(), { force: true });
        clear(list);
        if (!views.length) {
          list.appendChild(el('p', { class: 'etable-menu__hint', text: 'No hay vistas guardadas.' }));
          return;
        }
        for (const v of views) {
          const delBtn = el('button', {
            class: 'etable-menu-row__del', type: 'button',
            'aria-label': `Eliminar vista ${v.name}`,
            onclick: async (e) => {
              e.stopPropagation();
              const ok = await viewsSvc.remove(v.id);
              if (ok) { ctx.toast('Vista eliminada.', { type: 'success' }); paintViews(); paint(); }
            },
          }, [icon('trash', 16)]);
          list.appendChild(el('div', { class: 'etable-menu-row etable-menu-row--static' }, [
            el('button', {
              class: 'etable-menu-row__apply', type: 'button',
              onclick: () => { close({ source: 'pick' }); viewsSvc.apply(v); },
            }, [el('span', { class: 'etable-menu-row__label', text: v.name })]),
            delBtn,
          ]));
        }
      };
      paint();
      body.appendChild(list);
    },
  });
}

async function paintViews() {
  if (!viewsRowEl) return;
  const myToken = (paintViews.token = (paintViews.token || 0) + 1);
  const views = await viewsSvc.list(clientKey());
  if (paintViews.token !== myToken || !viewsRowEl || !viewsRowEl.isConnected) return;
  clear(viewsRowEl);
  viewsRowEl.hidden = !views.length;
  if (!views.length) return;
  for (const v of views) {
    const active = viewsSvc.matchesCurrent(v);
    viewsRowEl.appendChild(el('button', {
      class: 'etable-vchip' + (active ? ' is-active' : ''),
      type: 'button',
      'aria-pressed': active ? 'true' : 'false',
      onclick: () => viewsSvc.apply(v),
    }, [el('span', { class: 'etable-vchip__txt', text: v.name })]));
  }
  viewsRowEl.appendChild(el('button', {
    class: 'etable-vchip etable-vchip--add', type: 'button',
    onclick: () => openSaveViewSheet(),
  }, [icon('plus', 14), el('span', { text: 'Guardar' })]));
}

// ── Seleccion: repintado ligero (sin re-render del cuerpo) ───────────────────

function paintSelection({ count, selectMode } = {}) {
  if (!rootEl) return;
  const n = count !== undefined ? count : selection.count();
  const mode = selectMode !== undefined ? selectMode : selection.inSelectMode();
  rootEl.classList.toggle('is-selectmode', mode || n > 0);
  rootEl.classList.toggle('has-bulkbar', n > 0);

  for (const node of bodyHost.querySelectorAll('[data-id]')) {
    const sel = selection.isSelected(node.dataset.id);
    if (node.classList.contains('etable-row') || node.classList.contains('etable-card')) {
      node.classList.toggle('is-selected', sel);
      const box = node.querySelector('input[type="checkbox"]');
      if (box) box.checked = sel;
      if (node.classList.contains('etable-card')) node.setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
  }
  // Checkbox de grupo: marcado/indeterminado segun sus filas.
  for (const g of renderedGroups) {
    const box = bodyHost.querySelector(`[data-gcheck="${CSS.escape(g.key)}"]`);
    if (!box) continue;
    const selCount = g.ids.filter((id) => selection.isSelected(id)).length;
    box.checked = g.ids.length > 0 && selCount === g.ids.length;
    box.indeterminate = selCount > 0 && selCount < g.ids.length;
  }
}

// ── Teclado (desktop): roving tabindex entre celdas ──────────────────────────

function setRovingFocus(r, c, focus = true) {
  if (!rovingCells.length) return;
  const row = rovingCells[Math.max(0, Math.min(r, rovingCells.length - 1))];
  if (!row || !row.length) return;
  const cell = row[Math.max(0, Math.min(c, row.length - 1))];
  if (!cell) return;
  const prev = rovingCells[rovingPos.r] && rovingCells[rovingPos.r][rovingPos.c];
  if (prev && prev !== cell) prev.tabIndex = -1;
  rovingPos = { r: rovingCells.indexOf(row), c: row.indexOf(cell) };
  cell.tabIndex = 0;
  if (focus) { try { cell.focus({ preventScroll: false }); } catch { /* noop */ } }
}

function onBodyKeydown(e) {
  if (e.key === 'Escape') {
    if (selection.count() > 0 || selection.inSelectMode()) {
      e.stopPropagation();
      selection.clear();
    }
    return;
  }
  // Tarjeta movil enfocada: Enter/Espacio = tap (abre editor o toggle).
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('etable-card')) {
    e.preventDefault();
    e.target.click();
    return;
  }
  const cell = e.target.closest && e.target.closest('[data-r]');
  if (!cell) return;
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  switch (e.key) {
    case 'ArrowRight': e.preventDefault(); setRovingFocus(r, c + 1); break;
    case 'ArrowLeft': e.preventDefault(); setRovingFocus(r, c - 1); break;
    case 'ArrowDown': e.preventDefault(); setRovingFocus(r + 1, c); break;
    case 'ArrowUp': e.preventDefault(); setRovingFocus(r - 1, c); break;
    case 'Enter':
    case ' ': {
      // Los <button> ya disparan click con Enter/Espacio; esto cubre los
      // contenedores con role=button (celdas URL, tarjetas).
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        e.target.click && e.target.click();
      }
      break;
    }
    default:
  }
}

function onBodyFocusin(e) {
  const cell = e.target.closest && e.target.closest('[data-r]');
  if (!cell) return;
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  if (Number.isFinite(r) && Number.isFinite(c)) setRovingFocus(r, c, false);
}

// ── Click delegado del cuerpo (UN listener para todas las celdas) ────────────

function onBodyClick(e) {
  const target = e.target;

  // 1) Checkbox de fila.
  const rowCheck = target.closest && target.closest('.etable-check input');
  if (rowCheck) {
    const holder = rowCheck.closest('[data-id]');
    if (holder) selection.toggleRow(holder.dataset.id, { range: e.shiftKey });
    return;
  }

  // 2) Boton Abrir (editor completo).
  const openBtn = target.closest && target.closest('.etable-title__open');
  if (openBtn) {
    const holder = openBtn.closest('[data-id]');
    if (holder) ctx.openEditor(holder.dataset.id);
    return;
  }

  // 3) Titulo (edicion de texto).
  const titleBtn = target.closest && target.closest('.etable-title__txt');
  if (titleBtn) {
    const post = postById(titleBtn.closest('[data-id]')?.dataset.id);
    if (post) editTitle(post);
    return;
  }

  // 4) Tarjeta movil.
  const card = target.closest && target.closest('.etable-card');
  if (card) {
    const id = card.dataset.id;
    if (selection.inSelectMode() || selection.count() > 0) {
      selection.toggleRow(id);
      return;
    }
    const chip = target.closest('[data-chip]');
    const post = postById(id);
    if (!post) return;
    if (chip && chip.dataset.chip === 'estado') {
      commitCell({ type: 'status', patch: (v) => ({ status: v }) }, post, chip);
      return;
    }
    if (chip && chip.dataset.chip === 'fecha') {
      commitCell({ type: 'date', patch: (v) => ({ publish_date: v || null }) }, post, chip);
      return;
    }
    ctx.openEditor(id);
    return;
  }

  // 5) Celda tipada de la tabla.
  const cell = target.closest && target.closest('[data-col][data-id]');
  if (cell) {
    if (target.closest('a')) return; // los links navegan, no editan
    const allCols = buildColumns(activeClient());
    const def = allCols.find((c) => c.key === cell.dataset.col);
    const post = postById(cell.dataset.id);
    if (def && post) commitCell(def, post, cell);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (rootEl && rootEl.isConnected) render();
  });
}

function renderSkeleton() {
  clear(bodyHost);
  const wrap = el('div', { class: 'etable-skel', 'aria-hidden': 'true' });
  for (let g = 0; g < 2; g++) {
    wrap.appendChild(el('div', { class: 'etable-skel__head' }));
    for (let i = 0; i < 4; i++) wrap.appendChild(el('div', { class: 'etable-skel__row' }));
  }
  bodyHost.appendChild(wrap);
}

function renderEmpty() {
  clear(bodyHost);
  bodyHost.appendChild(el('div', { class: 'empty etable-empty' }, [
    el('div', { class: 'empty__icon' }, [icon('table', 28)]),
    el('h3', { text: 'Todavia no hay contenidos' }),
    el('p', { text: 'Crea el primero para empezar a planear.' }),
    el('button', {
      class: 'btn btn-primary', type: 'button', text: 'Nuevo contenido',
      onclick: () => openQuickAddSheet({ ctx, group: null, mode: getGroupBy(), getNextPosition: nextPositionFor }),
    }),
  ]));
}

function renderNoMatch() {
  clear(bodyHost);
  bodyHost.appendChild(el('div', { class: 'empty etable-empty' }, [
    el('div', { class: 'empty__icon' }, [icon('search', 28)]),
    el('h3', { text: 'Nada coincide' }),
    el('p', { text: 'Ningun contenido coincide con la busqueda o los filtros activos.' }),
    el('button', {
      class: 'btn', type: 'button', text: 'Quitar filtros',
      onclick: () => clearAllFilters(),
    }),
  ]));
}

function buildGroupHeaderContent(group, collapsed, ids) {
  const check = el('input', {
    type: 'checkbox',
    'data-gcheck': group.key,
    'aria-label': `Seleccionar todo el grupo ${group.label}`,
  });
  check.addEventListener('click', (e) => {
    e.stopPropagation();
    selection.setGroup(ids, e.currentTarget.checked);
  });

  const caret = el('span', { class: 'etable-caret' + (collapsed ? ' is-collapsed' : ''), 'aria-hidden': 'true' }, [icon('down', 16)]);
  return { check, caret };
}

function toggleCollapse(groupKey) {
  const mode = getGroupBy();
  const { posts } = ctx.store.getState();
  const groupsList = grp.groupPosts((posts || []).filter(matchFilters), mode, {
    brandColor: activeClient() && activeClient().brand_color,
  });
  const set = getCollapsedSet(groupsList, mode);
  if (set.has(groupKey)) set.delete(groupKey); else set.add(groupKey);
  persistCollapsed(set, mode);
  scheduleRender();
}

// ── Render desktop (tabla real) ──────────────────────────────────────────────

function renderDesktop(groupsList, collapsedSet) {
  const allCols = buildColumns(activeClient());
  const visCols = visibleColumns(allCols, getColsPref());
  const sort = getSort();
  const { activeClientId, clients } = ctx.store.getState();
  const showClient = activeClientId === 'todos';
  const clientsById = new Map((clients || []).map((c) => [c.id, c]));
  const colSpan = 2 + visCols.length;

  const scroll = el('div', { class: 'etable-scroll' });
  const table = el('table', { class: 'etable__table', role: 'grid', 'aria-label': 'Tabla de contenidos' });

  // THEAD
  const headRow = el('tr', {}, [
    el('th', { class: 'etable__th etable__th--check', scope: 'col', 'aria-label': 'Seleccion' }),
  ]);
  const mkSortTh = (key, label, extraClass = '', width = null) => {
    const active = sort && sort.key === key;
    const th = el('th', {
      class: `etable__th ${extraClass}`,
      scope: 'col',
      'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
      style: width ? { minWidth: `${width}px` } : null,
    });
    th.appendChild(el('button', {
      class: 'etable__sortbtn' + (active ? ' is-active' : ''),
      type: 'button',
      title: `Ordenar por ${label}`,
      onclick: () => {
        let next;
        if (!active) next = { key, dir: 'asc' };
        else if (sort.dir === 'asc') next = { key, dir: 'desc' };
        else next = null;
        setSort(next);
        paintToolbar();
        scheduleRender();
      },
    }, [
      el('span', { text: label }),
      el('span', { class: 'etable__sortarrow', 'aria-hidden': 'true', text: active ? (sort.dir === 'asc' ? '↑' : '↓') : '' }),
    ]));
    return th;
  };
  headRow.appendChild(mkSortTh('titulo', 'Contenido', 'etable__th--title'));
  for (const col of visCols) headRow.appendChild(mkSortTh(col.key, col.label, '', col.w));
  table.appendChild(el('thead', { class: 'etable__thead' }, [headRow]));

  // Cuerpo: un tbody por grupo.
  renderedGroups = [];
  visibleOrder = [];
  rovingCells = [];

  for (const group of groupsList) {
    const collapsed = collapsedSet.has(group.key);
    const sorted = grp.sortPosts(group.posts, sort, allCols);
    const ids = sorted.map((p) => p.id);
    renderedGroups.push({ key: group.key, ids });

    const tbody = el('tbody', { class: 'etable-tbody' });
    const { check, caret } = buildGroupHeaderContent(group, collapsed, ids);

    const gheadCell = el('td', { class: 'etable-ghead__cell', colspan: String(colSpan) }, [
      el('div', { class: 'etable-ghead__in' }, [
        el('label', { class: 'etable-gcheck', onclick: (e) => e.stopPropagation() }, [check]),
        caret,
        el('span', { class: 'etable-ghead__name', text: group.label }),
        el('span', { class: 'etable-ghead__count', text: String(sorted.length) }),
        grp.buildBattery(group.posts),
      ]),
    ]);
    const ghead = withGroupColor(el('tr', {
      class: 'etable-ghead',
      'data-group': group.key,
    }, [gheadCell]), group.color);
    ghead.addEventListener('click', (e) => {
      if (e.target.closest('.etable-gcheck')) return;
      toggleCollapse(group.key);
    });
    const gheadIn = gheadCell.querySelector('.etable-ghead__in');
    gheadIn.setAttribute('role', 'button');
    gheadIn.setAttribute('tabindex', '0');
    gheadIn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    gheadIn.setAttribute('aria-label', `${group.label}, ${sorted.length} contenidos. ${collapsed ? 'Expandir' : 'Colapsar'}`);
    gheadIn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.etable-gcheck')) {
        e.preventDefault();
        toggleCollapse(group.key);
      }
    });
    tbody.appendChild(ghead);

    if (!collapsed) {
      for (const post of sorted) {
        visibleOrder.push(post.id);
        const tr = withGroupColor(el('tr', {
          class: 'etable-row',
          'data-id': post.id,
        }), group.color);
        // Checkbox
        const box = el('input', { type: 'checkbox', 'aria-label': `Seleccionar ${post.title || 'contenido'}` });
        box.checked = selection.isSelected(post.id);
        tr.appendChild(el('td', { class: 'etable__td etable__td--check' }, [
          el('label', { class: 'etable-check' }, [box]),
        ]));

        // Titulo sticky con Abrir.
        const rowCells = [];
        const titleBtn = el('button', {
          class: 'etable-title__txt', type: 'button',
          title: 'Editar titulo',
        }, [el('span', { text: post.title || 'Sin titulo' })]);
        rowCells.push(titleBtn);
        const cl = showClient ? clientsById.get(post.client_id) : null;
        tr.appendChild(el('td', { class: 'etable__td etable__td--title' }, [
          el('div', { class: 'etable-title' }, [
            el('div', { class: 'etable-title__main' }, [
              titleBtn,
              cl ? el('span', { class: 'etable-title__client', text: cl.name }) : null,
            ]),
            el('button', {
              class: 'etable-title__open', type: 'button',
              title: 'Abrir contenido', 'aria-label': `Abrir ${post.title || 'contenido'}`,
            }, [icon('edit', 14), el('span', { text: 'Abrir' })]),
          ]),
        ]));

        // Celdas tipadas.
        for (const col of visCols) {
          const isUrl = col.type === 'url';
          const cellBtn = el(isUrl ? 'div' : 'button', {
            class: 'etable__cellbtn',
            'data-col': col.key,
            'data-id': post.id,
            ...(isUrl ? { role: 'button' } : { type: 'button' }),
            'aria-label': `${col.label} de ${post.title || 'contenido'}`,
          }, [col.render(post)]);
          rowCells.push(cellBtn);
          tr.appendChild(el('td', { class: `etable__td etable__td--${col.type}` }, [cellBtn]));
        }

        // Roving tabindex (data-r / data-c).
        const r = rovingCells.length;
        rowCells.forEach((cellNode, c) => {
          cellNode.dataset.r = String(r);
          cellNode.dataset.c = String(c);
          cellNode.tabIndex = -1;
        });
        rovingCells.push(rowCells);

        tbody.appendChild(tr);
      }

      // Quick-add al final del grupo.
      tbody.appendChild(createQuickAddRow({
        ctx, group, mode: getGroupBy(), colSpan,
        getNextPosition: nextPositionFor,
      }));
    }

    table.appendChild(tbody);
  }

  if (rovingCells.length && rovingCells[0].length) {
    rovingCells[0][0].tabIndex = 0;
    rovingPos = { r: 0, c: 0 };
  }

  scroll.appendChild(table);
  return scroll;
}

// ── Render movil (tarjetas-fila por grupo) ───────────────────────────────────

function buildCardChip(post, fieldKey) {
  switch (fieldKey) {
    case 'estado': {
      const known = !!STATUSES[post.status];
      return el('button', {
        class: 'etable-st etable-card__chipbtn',
        'data-chip': 'estado', 'data-status': known ? post.status : 'otro',
        type: 'button', 'aria-label': 'Cambiar estado',
      }, [
        el('span', { class: 'etable-st__dot', 'aria-hidden': 'true' }),
        el('span', { class: 'etable-st__txt', text: (STATUSES[post.status] && STATUSES[post.status].label) || post.status || 'Sin estado' }),
      ]);
    }
    case 'fecha': {
      const overdue = post.publish_date && isPast(post.publish_date) && post.status !== 'publicado';
      return el('button', {
        class: 'etable-card__date' + (overdue ? ' is-overdue' : ''),
        'data-chip': 'fecha', type: 'button', 'aria-label': 'Cambiar fecha',
        title: overdue ? 'Vencido' : null,
      }, [
        overdue ? icon('warning', 13) : icon('calendar', 13),
        el('span', { text: post.publish_date ? fmtDate(post.publish_date) : 'Sin fecha' }),
      ]);
    }
    case 'aprobacion': {
      return el('span', { class: 'etable-appr', 'data-approval': post.approval_state || 'pending' }, [
        el('span', { class: 'etable-appr__dot', 'aria-hidden': 'true' }),
        el('span', { text: (post.approval_state === 'approved' && 'Aprobado') || (post.approval_state === 'changes' && 'Cambios') || 'Pendiente' }),
      ]);
    }
    case 'plataforma':
      return post.platform ? el('span', { class: 'etable-card__tag', text: post.platform }) : null;
    case 'tipo': {
      if (!post.content_type) return null;
      const def = CONTENT_TYPES[post.content_type];
      return el('span', { class: 'etable-card__tag' }, [
        el('span', {
          class: 'etable-ct__dot', 'aria-hidden': 'true',
          style: { background: (def && def.color) || 'var(--text-mute)' },
        }),
        el('span', { text: (def && def.label) || post.content_type }),
      ]);
    }
    case 'grabacion':
      return (post.grabacion != null && post.grabacion !== '')
        ? el('span', { class: 'etable-grab', 'data-g': String(post.grabacion), text: `G${post.grabacion}` })
        : null;
    default:
      return null;
  }
}

function renderMobile(groupsList, collapsedSet) {
  const sort = getSort();
  const allCols = buildColumns(activeClient());
  const fields = getCardFields();
  const { activeClientId, clients } = ctx.store.getState();
  const showClient = activeClientId === 'todos';
  const clientsById = new Map((clients || []).map((c) => [c.id, c]));

  const wrap = el('div', { class: 'etable-groups' });
  renderedGroups = [];
  visibleOrder = [];
  rovingCells = [];

  for (const group of groupsList) {
    const collapsed = collapsedSet.has(group.key);
    const sorted = grp.sortPosts(group.posts, sort, allCols);
    const ids = sorted.map((p) => p.id);
    renderedGroups.push({ key: group.key, ids });

    const { check, caret } = buildGroupHeaderContent(group, collapsed, ids);
    // div con role=button (no <button>: lleva un checkbox adentro).
    const head = withGroupColor(el('div', {
      class: 'etable-ghead etable-ghead--m',
      role: 'button',
      tabindex: '0',
      'data-group': group.key,
      'aria-expanded': collapsed ? 'false' : 'true',
      'aria-label': `${group.label}, ${sorted.length} contenidos. ${collapsed ? 'Expandir' : 'Colapsar'}`,
      onclick: (e) => {
        if (e.target.closest('.etable-gcheck')) return;
        toggleCollapse(group.key);
      },
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.etable-gcheck')) {
          e.preventDefault();
          toggleCollapse(group.key);
        }
      },
    }, [
      el('label', { class: 'etable-gcheck etable-gcheck--m', onclick: (e) => e.stopPropagation() }, [check]),
      caret,
      el('span', { class: 'etable-ghead__name', text: group.label }),
      el('span', { class: 'etable-ghead__count', text: String(sorted.length) }),
      grp.buildBattery(group.posts),
    ]), group.color);

    const section = el('section', { class: 'etable-g', 'aria-label': `${group.label}, ${sorted.length} contenidos` }, [head]);

    if (!collapsed) {
      const cards = el('div', { class: 'etable-cards' });
      for (const post of sorted) {
        visibleOrder.push(post.id);
        const cl = showClient ? clientsById.get(post.client_id) : null;
        const chips = [];
        for (const f of fields) {
          const chip = buildCardChip(post, f);
          if (chip) chips.push(chip);
        }
        const card = withGroupColor(el('article', {
          class: 'etable-card',
          'data-id': post.id,
          tabindex: '0',
          role: 'button',
          'aria-label': post.title || 'Contenido',
          'aria-pressed': selection.isSelected(post.id) ? 'true' : 'false',
        }), group.color);
        const box = el('input', { type: 'checkbox', 'aria-label': `Seleccionar ${post.title || 'contenido'}` });
        box.checked = selection.isSelected(post.id);
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          selection.toggleRow(post.id);
        });
        card.appendChild(el('label', {
          class: 'etable-check etable-card__check',
          onclick: (e) => e.stopPropagation(),
        }, [box]));
        card.appendChild(el('div', { class: 'etable-card__main' }, [
          el('div', { class: 'etable-card__title', text: post.title || 'Sin titulo' }),
          cl ? el('div', { class: 'etable-card__client', text: cl.name }) : null,
          el('div', { class: 'etable-card__chips' }, chips),
        ]));
        if (post.assignee) {
          const av = avatar(post.assignee, true);
          av.classList.add('etable-card__avatar');
          card.appendChild(av);
        }
        card.classList.toggle('is-selected', selection.isSelected(post.id));
        cards.appendChild(card);
      }
      section.appendChild(cards);
      section.appendChild(createQuickAddButton({
        ctx, group, mode: getGroupBy(), getNextPosition: nextPositionFor,
      }));
    }

    wrap.appendChild(section);
  }
  return wrap;
}

// ── Render principal ─────────────────────────────────────────────────────────

function render() {
  const { posts, loading } = ctx.store.getState();
  rootEl.classList.toggle('is-desktop', isDesktop());

  if (loading && (!posts || !posts.length)) {
    countEl.textContent = '';
    noticeEl.hidden = true;
    renderSkeleton();
    return;
  }
  if (!posts || !posts.length) {
    countEl.textContent = '0 contenidos';
    noticeEl.hidden = true;
    renderedGroups = [];
    visibleOrder = [];
    renderEmpty();
    return;
  }

  const filtered = posts.filter(matchFilters);
  countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'contenido' : 'contenidos'}`;

  const nFilters = filterCount();
  noticeEl.hidden = !(nFilters > 0 && filtered.length < posts.length);
  if (!noticeEl.hidden) {
    clear(noticeEl).append(
      el('span', { text: `Filtros activos: ${nFilters}.` }),
      el('button', {
        class: 'etable-notice__clear', type: 'button', text: 'Quitar filtros',
        onclick: () => clearAllFilters(),
      }),
    );
  }

  if (!filtered.length) {
    renderedGroups = [];
    visibleOrder = [];
    renderNoMatch();
    return;
  }

  const mode = getGroupBy();
  const client = activeClient();
  const groupsList = grp.groupPosts(filtered, mode, { brandColor: client && client.brand_color });
  const collapsedSet = getCollapsedSet(groupsList, mode);

  // Conserva el scroll del contenedor desktop.
  const prevScroll = bodyHost.querySelector('.etable-scroll');
  const prevLeft = prevScroll ? prevScroll.scrollLeft : 0;
  const prevTop = prevScroll ? prevScroll.scrollTop : 0;

  clear(bodyHost);
  bodyHost.appendChild(isDesktop()
    ? renderDesktop(groupsList, collapsedSet)
    : renderMobile(groupsList, collapsedSet));

  const nowScroll = bodyHost.querySelector('.etable-scroll');
  if (nowScroll) { nowScroll.scrollLeft = prevLeft; nowScroll.scrollTop = prevTop; }

  paintSelection({});
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'tabla',

  mount(host, c) {
    ctx = c;

    noticeEl = el('div', { class: 'etable-notice', hidden: true });
    bodyHost = el('div', { class: 'etable-body' });
    viewsRowEl = el('div', { class: 'etable-views', hidden: true, role: 'tablist', 'aria-label': 'Vistas guardadas' });

    selection = createSelection({
      ctx,
      getVisibleIds: () => visibleOrder,
    });
    selection.onChange(paintSelection);

    rootEl = el('div', { class: 'etable' }, [
      buildToolbar(),
      viewsRowEl,
      noticeEl,
      bodyHost,
      selection.bar,
    ]);
    host.appendChild(rootEl);

    // UN listener de click + UNO de keydown + focusin (delegacion total).
    bodyHost.addEventListener('click', onBodyClick);
    rootEl.addEventListener('keydown', onBodyKeydown);
    bodyHost.addEventListener('focusin', onBodyFocusin);

    // Long-press movil para entrar en modo seleccion (fallback visible en menu).
    selection.attachLongPress(bodyHost, (target) => {
      const card = target.closest && target.closest('.etable-card');
      return card ? card.dataset.id : null;
    });

    // FAB: alta rapida generica (sheet encadenable).
    ctx.setFab({
      label: 'Nuevo',
      onTap: () => openQuickAddSheet({
        ctx, group: null, mode: getGroupBy(), getNextPosition: nextPositionFor,
      }),
    });

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'filters', 'search', 'activeClientId', 'clients'], scheduleRender),
      ctx.store.on('client:changed', () => { resetChain(); paintToolbar(); paintViews(); }),
      ctx.store.on('views:changed', () => paintViews()),
      ctx.store.on('view:applied', () => paintViews()),
    );

    // Cambio de breakpoint (rotacion / resize): re-render del cuerpo.
    mql = window.matchMedia('(min-width: 768px)');
    onMql = () => scheduleRender();
    try { mql.addEventListener('change', onMql); } catch { mql.addListener(onMql); }

    paintViews();
    render();
  },

  onParams() {
    // El shell ya espejo los params en store.filters; repinta cuerpo y chips.
    paintToolbar();
    paintViews();
    scheduleRender();
  },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    if (mql && onMql) {
      try { mql.removeEventListener('change', onMql); } catch { try { mql.removeListener(onMql); } catch { /* noop */ } }
    }
    mql = null;
    onMql = null;
    if (bodyHost) {
      bodyHost.removeEventListener('click', onBodyClick);
      bodyHost.removeEventListener('focusin', onBodyFocusin);
    }
    if (rootEl) rootEl.removeEventListener('keydown', onBodyKeydown);
    if (selection) { selection.destroy(); selection = null; }
    resetChain();
    renderedGroups = [];
    visibleOrder = [];
    rovingCells = [];
    rovingPos = { r: 0, c: 0 };
    bodyHost = null;
    noticeEl = null;
    countEl = null;
    groupChipTxt = null;
    sortChipTxt = null;
    viewsRowEl = null;
    rootEl = null;
    ctx = null;
  },
};
