// ============================================================================
// IVAE Marketing v2 - Editor de post (item card estilo Monday). Ruta #/post/:id
//
// Es el deep-link que usan busqueda y avisos. Se registra como vista del
// router (main.js) y se pinta como sheet a PANTALLA COMPLETA en movil
// (100dvh, sin backdrop-dismiss ni swipe-down: es captura de datos) y como
// modal centrado max-width 760px en desktop. Un solo codigo, dos contenedores
// (editor.css decide por media query).
//
// Estructura:
//   Header sticky: X (44px) + indicador de guardado (aria-live) + menu 3
//   puntos; titulo inline autosize; chips de acceso rapido status /
//   aprobacion / fecha (editar con 2 taps sin navegar tabs).
//   Tabs sticky (scroll-x con fade): Contenido, Guion, Checklist (badge 3/5),
//   Conversacion (badge N), Actividad. Render PEREZOSO: solo el tab activo
//   monta DOM; scroll conservado por tab; el ultimo tab usado por post se
//   recuerda en memoria de sesion.
//
// Cierre: X, Esc en desktop o boton atras del telefono. SIEMPRE flush del
// autosave antes; si falla, sheet "Hay cambios sin guardar" con Reintentar /
// Descartar cambios / Seguir editando. Nada se cierra perdiendo texto.
//
// Contrato de vista: export default { id, mount(el, ctx), onParams, unmount }.
// ============================================================================

import { el, api, statusBadge, approvalBadge, fmtDate } from '../api.js?v=202606240300';
import { icon } from '../shell/icons.js?v=202606240300';
import { openSheet, pickFrom, openCount } from '../shell/sheet.js?v=202606240300';
import * as store from '../shell/store.js?v=202606240300';
import * as cl from '../services/checklist.js?v=202606240300';
import { createAutosave } from './autosave.js?v=202606240300';
import { textExpand } from '../ui/pickers.js?v=202606240300';
import { openActionsMenu } from './actions.js?v=202606240300';
import { mount as mountContenido } from './tab-contenido.js?v=202606240300';
import { mount as mountGuion } from './tab-guion.js?v=202606240300';
import { mount as mountChecklist } from './tab-checklist.js?v=202606240300';
import { mount as mountConversacion } from './tab-conversacion.js?v=202606240300';
import { mount as mountActividad } from './tab-actividad.js?v=202606240300';

const TABS = [
  { key: 'contenido', label: 'Contenido', mount: mountContenido },
  { key: 'guion', label: 'Guion', mount: mountGuion },
  { key: 'checklist', label: 'Checklist', mount: mountChecklist },
  { key: 'conversacion', label: 'Conversacion', mount: mountConversacion },
  { key: 'actividad', label: 'Actividad', mount: mountActividad },
];

// Ultimo tab usado por post (memoria de la sesion, no persiste).
const tabMemory = new Map();

// Campos cuyo guardado debe refrescar los counts del switcher de clientes.
const COUNT_FIELDS = new Set(['status', 'approval_state', 'client_visible']);

// ── Estado del modulo (un editor a la vez: es una vista del router) ─────────
let ctx = null;
let params = {};
let postId = null;
let snapshot = null;        // post tal cual lo dio el server
let comments = [];
let approvals = [];
let checklistSeed = [];     // checklist del GET /posts/:id (backend v2)
let autosave = null;
let activeTab = 'contenido';
let tabDispose = null;
let tabScroll = {};         // key -> scrollTop
let unsubs = [];
let docListeners = [];
let closing = false;
let loaded = false;

// DOM refs
let rootEl = null;
let panelEl = null;
let bodyEl = null;
let titleTa = null;
let indicatorEl = null;
let indicatorText = null;
let retryBtn = null;
let chipsEl = null;
let tabsEl = null;
let conflictEl = null;
const tabBadges = new Map();

// ── ed: contrato interno que reciben los tabs ───────────────────────────────
const ed = {
  get ctx() { return ctx; },
  get postId() { return postId; },
  getPost() { return { ...(snapshot || {}), ...(autosave ? autosave.getDirty() : {}) }; },
  getMe() { return store.getState().me || {}; },
  getClient() {
    const { clients } = store.getState();
    const cid = snapshot && snapshot.client_id;
    return (clients || []).find((c) => c.id === cid) || null;
  },
  getParams() { return { ...params }; },
  getComments() { return comments; },
  setComments(list) { comments = Array.isArray(list) ? list : []; },
  getApprovals() { return approvals; },
  getChecklistSeed() { return checklistSeed; },
  setField(field, value, opts) {
    autosave?.setField(field, value, opts);
    refreshHeader();
  },
  flush() { return autosave ? autosave.flush() : Promise.resolve(true); },
  discardChanges() { autosave?.clearDirty(); },
  refreshHeader,
  setTabBadge,
  openApprovalPicker,
  reloadThread,
  forceClose() { if (closing) return; closing = true; goBack(); },
  requestClose,
};

// ── Indicador de guardado (4 estados visibles, aria-live polite) ─────────────
function paintSaveState(state) {
  if (!indicatorEl) return;
  indicatorEl.className = `edsave is-${state}`;
  retryBtn.hidden = state !== 'error';
  if (state === 'saved') indicatorText.textContent = 'Guardado';
  else if (state === 'dirty' || state === 'saving') indicatorText.textContent = 'Guardando...';
  else if (state === 'offline') indicatorText.textContent = 'Sin conexion, se guardara al volver';
  else if (state === 'error') indicatorText.textContent = 'No se guardo';
}

// ── Header: titulo + chips de acceso rapido ──────────────────────────────────
function refreshHeader() {
  if (!loaded) return;
  const p = ed.getPost();
  if (titleTa && document.activeElement !== titleTa && titleTa.value !== (p.title || '')) {
    titleTa.value = p.title || '';
    fitTitle();
  }
  if (!chipsEl) return;
  while (chipsEl.firstChild) chipsEl.removeChild(chipsEl.firstChild);

  // Chip de estado: el 80% de los toques (abre el picker sin ir al tab).
  chipsEl.appendChild(el('button', {
    class: 'edchip', type: 'button', 'aria-label': 'Cambiar estado',
    onclick: async (e) => {
      const anchor = e.currentTarget;
      const next = await ctx.pickers.pickStatus({ current: ed.getPost().status, anchor });
      if (next === null || next === ed.getPost().status) return;
      ed.setField('status', next, { immediate: true });
    },
  }, [statusBadge(p.status)]));

  chipsEl.appendChild(el('button', {
    class: 'edchip', type: 'button', 'aria-label': 'Cambiar aprobacion',
    onclick: (e) => openApprovalPicker(e.currentTarget),
  }, [approvalBadge(p.approval_state)]));

  chipsEl.appendChild(el('button', {
    class: 'edchip edchip--date', type: 'button', 'aria-label': 'Cambiar fecha de publicacion',
    onclick: async (e) => {
      const anchor = e.currentTarget;
      const next = await ctx.pickers.pickDate({ current: ed.getPost().publish_date, anchor });
      if (next === null) return;
      ed.setField('publish_date', next || null, { immediate: true });
    },
  }, [
    icon('calendar', 14),
    el('span', { text: p.publish_date ? fmtDate(p.publish_date) : 'Sin fecha' }),
  ]));
}

function fitTitle() {
  if (!titleTa) return;
  titleTa.style.height = 'auto';
  titleTa.style.height = `${Math.max(titleTa.scrollHeight, 28)}px`;
}

// ── Aprobacion (fuerza la decision del cliente; endpoints dedicados) ────────
async function openApprovalPicker(anchor) {
  const cur = ed.getPost().approval_state;
  const decision = await pickFrom({
    title: 'Aprobacion',
    anchor,
    options: [
      { value: 'approved', label: 'Aprobado', color: '#22c55e', sub: 'Esto fuerza la decision del cliente', current: cur === 'approved' },
      { value: 'changes', label: 'Cambios pedidos', color: '#ec4899', sub: 'Pide un comentario con los cambios', current: cur === 'changes' },
    ],
  });
  if (!decision || decision === cur) return;

  let comment = null;
  if (decision === 'changes') {
    comment = await textExpand({
      title: '¿Qué cambios se piden?',
      placeholder: 'Describe los cambios (obligatorio)',
      maxLength: 2000,
    });
    if (comment === null || !comment.trim()) {
      if (comment !== null) ctx.toast('Se necesita un comentario para pedir cambios.', { type: 'info' });
      return;
    }
  }

  const prev = snapshot ? snapshot.approval_state : cur;
  if (snapshot) snapshot = { ...snapshot, approval_state: decision }; // optimista
  refreshHeader();
  try {
    const path = decision === 'approved' ? 'approve' : 'request-changes';
    const body = comment ? { comment: comment.trim() } : {};
    const res = await api.post(`/posts/${encodeURIComponent(postId)}/${path}`, body);
    if (res && res.post && res.post.id) {
      snapshot = res.post;
      store.upsertPost(res.post);
    }
    store.emit('post:updated', { id: postId, fields: { approval_state: decision } });
    store.emit('posts:changed');
    store.emit('mutated');
    store.refreshClientCounts();
    refreshHeader();
    reloadThread(); // la decision genera approval + comentario
  } catch (e) {
    if (snapshot) snapshot = { ...snapshot, approval_state: prev }; // rollback
    refreshHeader();
    ctx.toast((e && e.message) || 'No se pudo guardar, intenta de nuevo.', { type: 'error' });
  }
}

// ── Hilo (comments + approvals) en background ────────────────────────────────
async function reloadThread() {
  try {
    const res = await api.get(`/posts/${encodeURIComponent(postId)}`);
    if (!res || !res.post || res.post.id !== postId) return;
    comments = Array.isArray(res.comments) ? res.comments : comments;
    approvals = Array.isArray(res.approvals) ? res.approvals : approvals;
    if (Array.isArray(res.checklist)) checklistSeed = res.checklist;
    setTabBadge('conversacion', comments.length ? String(comments.length) : '');
  } catch { /* best-effort */ }
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function setTabBadge(key, text) {
  const b = tabBadges.get(key);
  if (!b) return;
  b.textContent = text || '';
  b.hidden = !text;
}

function paintActiveTab() {
  if (!tabsEl) return;
  for (const btn of tabsEl.querySelectorAll('button')) {
    const is = btn.dataset.tab === activeTab;
    btn.classList.toggle('is-active', is);
    btn.setAttribute('aria-selected', is ? 'true' : 'false');
    btn.tabIndex = is ? 0 : -1;
  }
}

function switchTab(key, { fromParams = false } = {}) {
  const def = TABS.find((t) => t.key === key);
  if (!def || !loaded) return;
  if (key === activeTab && bodyEl && bodyEl.dataset.tab === key) return;

  // Flush al cambiar de tab + conserva el scroll del tab que se va.
  autosave?.flush();
  if (bodyEl && bodyEl.dataset.tab) tabScroll[bodyEl.dataset.tab] = bodyEl.scrollTop;

  if (tabDispose) { try { tabDispose(); } catch (e) { console.error('[editor] tab dispose', e); } tabDispose = null; }
  while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);

  activeTab = key;
  bodyEl.dataset.tab = key;
  tabMemory.set(postId, key);
  paintActiveTab();

  try {
    tabDispose = def.mount(bodyEl, ed) || null;
  } catch (e) {
    console.error('[editor] tab mount', key, e);
    bodyEl.appendChild(el('div', { class: 'edconv__empty' }, [
      el('p', { class: 'muted', text: 'Este tab no se pudo cargar. Intenta de nuevo.' }),
    ]));
  }
  bodyEl.scrollTop = tabScroll[key] || 0;

  // Refleja el tab en la URL sin apilar history (replace).
  if (!fromParams && params.tab !== key) {
    const next = { ...params, id: postId, tab: key };
    delete next.comment;
    params = next;
    ctx.router.navigate('post', next, { replace: true });
  }

  // El boton de scroll del tab activo queda visible (tabs con scroll-x).
  const btn = tabsEl.querySelector(`button[data-tab="${key}"]`);
  btn?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ── Cierre ───────────────────────────────────────────────────────────────────
function goBack() {
  const { activeClientId } = store.getState();
  const target = ctx.prefs.lastContentView(activeClientId);
  let navigated = false;
  const onHash = () => { navigated = true; };
  window.addEventListener('hashchange', onHash, { once: true });
  setTimeout(() => {
    window.removeEventListener('hashchange', onHash);
    if (!navigated && String(location.hash).startsWith('#/post/')) {
      // Deep-link directo sin historial dentro de la app.
      ctx.router.navigate(target, activeClientId && activeClientId !== 'todos' ? { cliente: activeClientId } : {}, { replace: true });
    }
  }, 260);
  try { history.back(); } catch {
    ctx.router.navigate(target, activeClientId && activeClientId !== 'todos' ? { cliente: activeClientId } : {}, { replace: true });
  }
}

async function requestClose() {
  if (closing) return;
  if (!autosave || !autosave.isDirty()) { closing = true; goBack(); return; }
  const ok = await autosave.flush();
  if (ok) { closing = true; goBack(); return; }
  openUnsavedSheet();
}

function openUnsavedSheet() {
  openSheet({
    title: 'Hay cambios sin guardar',
    mode: 'form',
    build(body, close) {
      const retry = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Reintentar',
        onclick: async () => {
          retry.dataset.loading = 'true';
          const ok = await autosave.flush();
          retry.dataset.loading = 'false';
          if (ok) { close({ source: 'done' }); closing = true; goBack(); }
          else ctx.toast('Sigue sin guardarse. Revisa tu conexion.', { type: 'error' });
        },
      });
      body.append(
        el('p', { class: 'ed-confirm__text', text: 'No se pudieron guardar los últimos cambios. ¿Qué quieres hacer?' }),
        el('div', { class: 'sheet__footer sheet__footer--stack' }, [
          retry,
          el('button', {
            class: 'btn btn-danger', type: 'button', text: 'Descartar cambios',
            onclick: () => { autosave.clearDirty(); close({ source: 'discard' }); closing = true; goBack(); },
          }),
          el('button', {
            class: 'btn', type: 'button', text: 'Seguir editando',
            onclick: () => close({ source: 'stay' }),
          }),
        ]),
      );
    },
  });
}

// ── Banner de conflicto (409) ────────────────────────────────────────────────
function showConflict() {
  if (!conflictEl) return;
  conflictEl.hidden = false;
}

async function resolveConflict() {
  try {
    const res = await api.get(`/posts/${encodeURIComponent(postId)}`);
    if (res && res.post && res.post.id === postId) {
      snapshot = res.post;
      comments = Array.isArray(res.comments) ? res.comments : comments;
      approvals = Array.isArray(res.approvals) ? res.approvals : approvals;
      if (Array.isArray(res.checklist)) checklistSeed = res.checklist;
      store.upsertPost(res.post);
    }
    conflictEl.hidden = true;
    refreshHeader();
    // Remonta el tab activo sobre el snapshot fresco; los campos dirty no
    // conflictivos siguen en el mapa y se re-aplican en el proximo flush.
    bodyEl.dataset.tab = '';
    switchTab(activeTab, { fromParams: true });
    if (autosave.isDirty()) autosave.flush();
  } catch (e) {
    ctx.toast((e && e.message) || 'No se pudo actualizar.', { type: 'error' });
  }
}

// ── Construccion del chrome del editor ───────────────────────────────────────
function buildChrome(host) {
  indicatorText = el('span', { class: 'edsave__text', text: 'Guardado' });
  retryBtn = el('button', {
    class: 'edsave__retry', type: 'button', text: 'Reintentar', hidden: true,
    onclick: () => autosave?.retry(),
  });
  indicatorEl = el('span', { class: 'edsave is-saved', role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'edsave__spinner', 'aria-hidden': 'true' }),
    el('span', { class: 'edsave__check', 'aria-hidden': 'true' }, [icon('check', 12)]),
    indicatorText,
    retryBtn,
  ]);

  const closeBtn = el('button', {
    class: 'edicon', type: 'button', 'aria-label': 'Cerrar editor',
    onclick: () => requestClose(),
  }, [icon('close', 22)]);

  const menuBtn = el('button', {
    class: 'edicon', type: 'button', 'aria-label': 'Mas acciones', 'aria-haspopup': 'menu',
    onclick: (e) => openActionsMenu(ed, e.currentTarget),
  }, [icon('dots', 22)]);

  titleTa = el('textarea', {
    class: 'edtitle', rows: '1', maxlength: '200',
    placeholder: 'Titulo del contenido',
    'aria-label': 'Titulo del contenido',
  });
  titleTa.addEventListener('input', () => { fitTitle(); ed.setField('title', titleTa.value); });
  titleTa.addEventListener('blur', () => autosave?.flush());
  titleTa.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleTa.blur(); }
  });

  chipsEl = el('div', { class: 'edchips' });

  conflictEl = el('div', { class: 'edconflict', hidden: true }, [
    el('span', { class: 'edconflict__text', text: 'Alguien más editó este contenido.' }),
    el('button', { class: 'btn btn-sm', type: 'button', text: 'Actualizar', onclick: () => resolveConflict() }),
  ]);

  tabsEl = el('div', { class: 'edtabs', role: 'tablist', 'aria-label': 'Secciones del contenido' });
  for (const t of TABS) {
    const badge = el('span', { class: 'edtabs__badge', hidden: true });
    tabBadges.set(t.key, badge);
    tabsEl.appendChild(el('button', {
      class: 'edtabs__tab', type: 'button', role: 'tab', dataset: { tab: t.key },
      'aria-selected': 'false',
      onclick: () => switchTab(t.key),
    }, [el('span', { text: t.label }), badge]));
  }
  // Flechas izquierda/derecha entre tabs (tablist accesible).
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    switchTab(next.key);
    tabsEl.querySelector(`button[data-tab="${next.key}"]`)?.focus();
  });

  bodyEl = el('div', { class: 'edbody' });

  panelEl = el('div', {
    class: 'edpanel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Editor de contenido',
  }, [
    el('div', { class: 'edhead' }, [
      el('div', { class: 'edhead__row' }, [closeBtn, indicatorEl, menuBtn]),
      titleTa,
      chipsEl,
      conflictEl,
    ]),
    tabsEl,
    bodyEl,
  ]);

  rootEl = el('div', { class: 'edroot' }, [el('div', { class: 'edroot__backdrop' }), panelEl]);
  host.appendChild(rootEl);
  document.body.classList.add('editor-open');
  requestAnimationFrame(() => rootEl.classList.add('is-open'));
}

function renderSkeleton() {
  while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
  const skel = el('div', { class: 'edskel', 'aria-hidden': 'true' });
  for (let i = 0; i < 6; i++) skel.appendChild(el('div', { class: 'edskel__row' }));
  bodyEl.appendChild(skel);
}

// ── Carga del post ───────────────────────────────────────────────────────────
async function load(id) {
  loaded = false;
  postId = id;
  snapshot = null;
  comments = [];
  approvals = [];
  checklistSeed = [];
  tabScroll = {};
  renderSkeleton();

  // Pre-pinta con lo que haya en el store (apertura instantanea desde vistas).
  const inStore = store.getState().posts.find((p) => p.id === id);
  if (inStore) {
    snapshot = { ...inStore };
    loaded = true;
    refreshHeader();
    loaded = false;
  }

  let res;
  try {
    res = await api.get(`/posts/${encodeURIComponent(id)}`);
  } catch (e) {
    ctx.toast((e && e.message) || 'No se pudo abrir el contenido.', { type: 'error' });
    closing = true;
    goBack();
    return;
  }
  if (!res || !res.post || postId !== id || !rootEl) return;

  snapshot = res.post;
  comments = Array.isArray(res.comments) ? res.comments : [];
  approvals = Array.isArray(res.approvals) ? res.approvals : [];
  checklistSeed = Array.isArray(res.checklist) ? res.checklist : [];
  loaded = true;

  refreshHeader();
  setTabBadge('conversacion', comments.length ? String(comments.length) : '');
  updateChecklistBadge();

  const initialTab =
    (params.comment && 'conversacion') ||
    (TABS.some((t) => t.key === params.tab) && params.tab) ||
    tabMemory.get(id) ||
    'contenido';
  bodyEl.dataset.tab = '';
  switchTab(initialTab, { fromParams: true });

  // Post recien creado desde plantilla: foco directo al titulo.
  if (!String(snapshot.title || '').trim()) {
    setTimeout(() => titleTa?.focus(), 120);
  }
}

function updateChecklistBadge() {
  let done = 0, total = 0;
  const prog = cl.progress(postId);
  if (prog) { done = prog.done; total = prog.total; }
  else if (checklistSeed.length) {
    total = checklistSeed.length;
    done = checklistSeed.filter((it) => it && it.done).length;
  }
  setTabBadge('checklist', total ? `${done}/${total}` : '');
}

// ── Contrato de vista ────────────────────────────────────────────────────────
export default {
  id: 'post',

  mount(host, c) {
    ctx = c;
    params = { ...(c.params || {}) };
    closing = false;
    activeTab = 'contenido';
    tabBadges.clear();

    buildChrome(host);

    autosave = createAutosave({
      getId: () => postId,
      getSnapshot: () => snapshot,
      onState: paintSaveState,
      onSaved(serverPost, sentFields, sentValues) {
        if (serverPost && serverPost.id === postId) {
          snapshot = serverPost;
          store.upsertPost(serverPost);
        } else if (snapshot) {
          // Server sin payload: merge local de lo enviado (sin expected_*).
          const merged = { ...snapshot };
          for (const f of sentFields) merged[f] = sentValues[f];
          snapshot = merged;
          store.upsertPost(merged);
        }
        store.emit('post:updated', { id: postId, fields: sentFields });
        store.emit('posts:changed');
        store.emit('mutated');
        if (sentFields.some((f) => COUNT_FIELDS.has(f))) store.refreshClientCounts();
        refreshHeader();
      },
      onConflict() { showConflict(); },
    });

    // Flush con keepalive: la duena edita, bloquea el telefono y todo queda.
    const onPageHide = () => autosave?.flush({ keepalive: true });
    const onVisibility = () => { if (document.visibilityState === 'hidden') autosave?.flush({ keepalive: true }); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    docListeners.push(() => window.removeEventListener('pagehide', onPageHide));
    docListeners.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // Esc cierra en desktop SOLO si no hay sheets encima (ellos la consumen).
    const onKey = (e) => {
      if (e.key === 'Escape' && openCount() === 0) { e.preventDefault(); requestClose(); }
    };
    document.addEventListener('keydown', onKey);
    docListeners.push(() => document.removeEventListener('keydown', onKey));

    // Badge de checklist vivo aunque el tab no este montado.
    unsubs.push(store.on('checklist:changed', ({ postId: pid } = {}) => {
      if (pid === postId) cl.list(postId).then(() => updateChecklistBadge());
    }));
    // Si otro flujo borra el post (lista en otra pestana), cierra limpio.
    unsubs.push(store.on('post:deleted', ({ id } = {}) => {
      if (id === postId && !closing) { closing = true; autosave?.clearDirty(); goBack(); }
    }));

    load(params.id);
  },

  onParams(p) {
    const next = { ...(p || {}) };
    const prevId = params.id;
    params = next;
    if (next.id && next.id !== prevId) {
      autosave?.flush();
      load(next.id);
      return;
    }
    if (next.comment && loaded) { switchTab('conversacion', { fromParams: true }); return; }
    if (next.tab && next.tab !== activeTab && loaded) switchTab(next.tab, { fromParams: true });
  },

  unmount() {
    // Ultimo intento de guardado (la promesa sigue viva tras el unmount y
    // reconcilia el store al resolver).
    if (autosave) {
      if (autosave.isDirty()) autosave.flush();
      autosave.dispose();
      autosave = null;
    }
    if (tabDispose) { try { tabDispose(); } catch { /* noop */ } tabDispose = null; }
    for (const off of unsubs) { try { off(); } catch { /* noop */ } }
    unsubs = [];
    for (const off of docListeners) { try { off(); } catch { /* noop */ } }
    docListeners = [];
    document.body.classList.remove('editor-open');
    rootEl = null;
    panelEl = null;
    bodyEl = null;
    titleTa = null;
    indicatorEl = null;
    indicatorText = null;
    retryBtn = null;
    chipsEl = null;
    tabsEl = null;
    conflictEl = null;
    tabBadges.clear();
    snapshot = null;
    comments = [];
    approvals = [];
    checklistSeed = [];
    postId = null;
    loaded = false;
    ctx = null;
  },
};
