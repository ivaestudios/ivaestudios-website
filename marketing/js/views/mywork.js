// ============================================================================
// IVAE Marketing v2 — Vista "Mi trabajo". Ruta: #/mi-trabajo
//
// Posts CROSS-CLIENTE asignados al usuario de la sesion (assignee_user_id;
// fallback al texto legacy `assignee` que coincide con me.name), agrupados
// estilo Monday My Work: Atrasados / Hoy / Proximos 7 dias / Mas adelante /
// Sin fecha (+ Publicados opcional via opciones).
//
// - Datos: GET /posts?scope=all (staff). Si el backend v2 aun no esta
//   desplegado, degrada a un fetch por cliente (mismo patron que el store).
// - El dataset vive en MEMORIA DEL MODULO (no en store.posts): el store solo
//   contiene los posts del cliente activo y contaminarlo romperia las demas
//   vistas. Las mutaciones replican el patron oficial optimista -> PATCH ->
//   reconciliar | rollback + toast, sincronizan store.upsertPost SOLO si el
//   post pertenece al cliente activo y emiten 'post:updated' + 'mutated'.
// - Badge del bottom-nav: setTabBadge('mi-trabajo', vencidos). El motor de
//   badge sobrevive al unmount (modulo singleton): se refresca con throttle
//   en cada 'mutated' y al volver a la pestana.
// - Mobile-first 390px: tarjetas-fila con target completo, menu de 3 puntos
//   de 44px con acciones rapidas (estado, fecha, marcar publicado).
//
// Contrato de vista: export default { mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import { api, el, clear, STATUSES, statusLabel, statusBadge } from '../api.js?v=202607221913';
import { icon } from '../shell/icons.js?v=202607221913';
import { T } from '../shell/i18n.js?v=202607221913';
import { todayISO, diffDays, relativeDay, fmtShort } from '../lib/dates.js?v=202607221913';

// CSS del paquete (compartido con la vista Automatizaciones). Lazy y con
// guard: si app.html ya lo linkea (o la otra vista ya lo inyecto), no duplica.
function ensurePackageCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/mywork.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/mywork.css?v=4';
  document.head.appendChild(link);
}

const VIEW_ID = 'mi-trabajo';
const ERR_SAVE = T('No se pudo guardar, intenta de nuevo.', "Couldn't save, try again.");
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');
const STALE_MS = 30000;          // recarga al montar si los datos son mas viejos
const QUIET_RELOAD_MS = 2500;    // debounce del refetch tras 'mutated'

// api.js (v1) no exporta PRIORITIES: mapa local solo para pintar la etiqueta.
const PRIORITY_TAGS = {
  alta: { label: T('Alta', 'High'), color: '#f59e0b' },
  urgente: { label: T('Urgente', 'Urgent'), color: '#ef4444' },
};

const SECTION_DEFS = [
  { key: 'vencidos', label: T('Atrasados', 'Overdue'), short: T('Atrasados', 'Overdue'), ic: 'warning', tone: 'danger' },
  { key: 'hoy', label: T('Hoy', 'Today'), short: T('Hoy', 'Today'), ic: 'clock', tone: 'accent' },
  { key: 'semana', label: T('Proximos 7 dias', 'Next 7 days'), short: T('Semana', 'Week'), ic: 'calendar' },
  { key: 'despues', label: T('Mas adelante', 'Later'), short: null, ic: 'right' },
  { key: 'sinfecha', label: T('Sin fecha', 'No date'), short: T('Sin fecha', 'No date'), ic: 'inbox' },
  { key: 'listos', label: T('Publicados', 'Published'), short: null, ic: 'check', done: true },
];
const SUMMARY_KEYS = ['vencidos', 'hoy', 'semana', 'sinfecha'];

// ── Estado persistente del modulo (sobrevive al unmount: motor de badge) ────
let storeRef = null;
let setTabBadgeRef = null;
let globalWired = false;
let myPosts = null;        // ultimo dataset cargado (posts mios, todos)
let lastLoadAt = 0;
let inflight = null;
let reloadTimer = 0;

// ── Estado por montaje ───────────────────────────────────────────────────────
let ctx = null;
let mounted = false;
let rootEl = null;
let unsubs = [];
let renderQueued = false;
let loading = false;
let loadErr = null;

// ── Datos ────────────────────────────────────────────────────────────────────

function isMine(p, me) {
  if (!me) return false;
  if (p.assignee_user_id != null && p.assignee_user_id !== '') {
    return String(p.assignee_user_id) === String(me.id);
  }
  const a = String(p.assignee || '').trim().toLowerCase();
  if (!a) return false;
  const name = String(me.name || '').trim().toLowerCase();
  return !!name && a === name;
}

async function fetchMine() {
  const { me, clients } = storeRef.getState();
  let posts;
  try {
    const res = await api.get('/posts?scope=all');
    posts = Array.isArray(res) ? res : (res && res.posts) || [];
  } catch (e) {
    // Backend v2 aun no desplegado: degradacion con un fetch por cliente.
    const ids = (clients || []).filter((c) => !c.archived).map((c) => c.id);
    if (!ids.length) throw e;
    const all = await Promise.all(ids.map((id) =>
      api.get(`/posts?client_id=${encodeURIComponent(id)}`).catch(() => [])
    ));
    posts = all.flat();
  }
  return posts.filter((p) => isMine(p, me));
}

function reload({ quiet = false } = {}) {
  if (inflight) return inflight;
  if (!quiet) { loading = true; loadErr = null; scheduleRender(); }
  inflight = (async () => {
    try {
      const list = await fetchMine();
      myPosts = list;
      loadErr = null;
      lastLoadAt = Date.now();
    } catch (e) {
      loadErr = e;
      // Refresh manual con datos viejos en pantalla: avisa que fallo.
      if (!quiet && Array.isArray(myPosts) && ctx) {
        ctx.toast((e && e.message) || T('No se pudo refrescar.', "Couldn't refresh."), { type: 'error' });
      }
    } finally {
      inflight = null;
      loading = false;
      updateBadge();
      scheduleRender();
    }
  })();
  return inflight;
}

function scheduleQuietReload(ms = QUIET_RELOAD_MS) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { reload({ quiet: true }); }, ms);
}

// Motor global: vive una sola vez por sesion de pagina y mantiene el badge
// del bottom-nav fresco aunque la vista este desmontada.
function wireGlobal(c) {
  storeRef = c.store;
  setTabBadgeRef = c.setTabBadge;
  if (globalWired) return;
  globalWired = true;
  c.store.on('mutated', () => scheduleQuietReload());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLoadAt > 60000) {
      scheduleQuietReload(300);
    }
  });
}

// ── Clasificacion ────────────────────────────────────────────────────────────

function classify(p, today) {
  if (p.status === 'publicado') return 'listos';
  if (Number(p.overdue) === 1) return 'vencidos';
  const d = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
  if (!d) return 'sinfecha';
  const diff = diffDays(today, d);
  if (diff === null) return 'sinfecha';
  if (diff < 0) return 'vencidos';
  if (diff === 0) return 'hoy';
  if (diff <= 7) return 'semana';
  return 'despues';
}

function groupPosts(list) {
  const today = todayISO();
  const groups = new Map(SECTION_DEFS.map((s) => [s.key, []]));
  for (const p of list || []) groups.get(classify(p, today)).push(p);
  const byDate = (a, b) => {
    const da = a.publish_date ? String(a.publish_date).slice(0, 10) : '9999-99-99';
    const db = b.publish_date ? String(b.publish_date).slice(0, 10) : '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return String(a.title || '').localeCompare(String(b.title || ''), 'es');
  };
  for (const [k, arr] of groups) {
    if (k === 'listos') arr.sort((a, b) => byDate(b, a));
    else arr.sort(byDate);
  }
  return groups;
}

function overdueCount() {
  if (!Array.isArray(myPosts)) return 0;
  const today = todayISO();
  return myPosts.filter((p) => classify(p, today) === 'vencidos').length;
}

function updateBadge() {
  if (typeof setTabBadgeRef === 'function') setTabBadgeRef(VIEW_ID, overdueCount());
}

// ── Prefs ────────────────────────────────────────────────────────────────────

function getCollapsed() {
  const v = ctx.prefs.get('collapsedGroups.mywork', null);
  return Array.isArray(v) ? v : ['listos'];
}

function setCollapsed(key, collapsed) {
  const cur = new Set(getCollapsed());
  if (collapsed) cur.add(key); else cur.delete(key);
  ctx.prefs.set('collapsedGroups.mywork', [...cur]);
}

function showDone() { return !!ctx.prefs.get('myworkShowDone', false); }

// ── Mutaciones (optimista local + sync store + rollback + toast) ─────────────

async function mutatePost(post, fields, okMsg, undoFields = null) {
  const toastFn = ctx ? ctx.toast : null;
  const prev = myPosts;
  myPosts = (myPosts || []).map((p) => (p.id === post.id ? { ...p, ...fields } : p));
  updateBadge();
  scheduleRender();
  try {
    const res = await api.patch(`/posts/${post.id}`, fields);
    const updated = (res && res.post) || res;
    if (updated && updated.id) {
      myPosts = (myPosts || []).map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
      // Sincroniza el store SOLO si el post ya vive ahi (cliente activo).
      const st = storeRef.getState();
      if ((st.posts || []).some((sp) => sp.id === updated.id)) storeRef.upsertPost(updated);
    }
    storeRef.emit('post:updated', { id: post.id, fields });
    storeRef.emit('posts:changed');
    storeRef.emit('mutated');
    // Campos que alteran los counts del switcher / dashboard (best-effort).
    if (['status', 'approval_state', 'client_visible'].some((k) => k in fields)) {
      storeRef.refreshClientCounts();
    }
    updateBadge();
    scheduleRender();
    if (okMsg && toastFn) {
      toastFn(okMsg, {
        type: 'success',
        action: undoFields ? { label: T('Deshacer', 'Undo'), onAction: () => { mutatePost(post, undoFields, null); } } : null,
      });
    }
    return true;
  } catch (e) {
    myPosts = prev;
    updateBadge();
    scheduleRender();
    if (toastFn) toastFn((e && e.message) || ERR_SAVE, { type: 'error' });
    return false;
  }
}

// ── Acciones rapidas ─────────────────────────────────────────────────────────

function openCardMenu(post, anchor) {
  const c = ctx;
  c.sheet.openSheet({
    title: post.title || T('Contenido', 'Content'),
    mode: 'menu',
    anchor,
    build(body, close) {
      const row = (ic, label, fn) => el('button', {
        class: 'mw-act', type: 'button',
        onclick: () => { close({ source: 'pick' }); fn(); },
      }, [icon(ic, 20), el('span', { class: 'mw-act__label', text: label })]);

      body.append(
        row('edit', T('Abrir', 'Open'), () => c.openEditor(post.id)),
        row('board', T('Cambiar estado', 'Change status'), async () => {
          const v = await c.pickers.pickStatus({ current: post.status });
          if (v && v !== post.status) {
            const label = statusLabel(v);
            mutatePost(post, { status: v }, `${T('Estado', 'Status')}: ${label}.`, { status: post.status });
          }
        }),
        row('calendar', T('Cambiar fecha', 'Change date'), async () => {
          const v = await c.pickers.pickDate({ current: post.publish_date || null });
          if (v === null || v === undefined) return;
          const next = v === '' ? null : v;
          const cur = post.publish_date ? String(post.publish_date).slice(0, 10) : null;
          if (next !== cur) {
            mutatePost(
              post,
              { publish_date: next },
              next ? `${T('Fecha', 'Date')}: ${fmtShort(next)}.` : T('Fecha quitada.', 'Date removed.'),
              { publish_date: cur },
            );
          }
        }),
        post.status !== 'publicado'
          ? row('check', T('Marcar Publicado', 'Mark Published'), () => {
              mutatePost(post, { status: 'publicado' }, T('Marcado como Publicado.', 'Marked as Published.'), { status: post.status });
            })
          : null,
      );
    },
  });
}

function openOptionsSheet(anchor) {
  const c = ctx;
  c.sheet.openSheet({
    title: T('Opciones', 'Options'),
    mode: 'menu',
    anchor,
    build(body, close) {
      const on = showDone();
      const sw = el('span', { class: 'mw-switch' + (on ? ' is-on' : ''), 'aria-hidden': 'true' }, [
        el('span', { class: 'mw-switch__thumb' }),
      ]);
      body.append(
        el('button', {
          class: 'mw-act mw-act--toggle', type: 'button',
          role: 'switch', 'aria-checked': on ? 'true' : 'false',
          onclick: () => {
            c.prefs.set('myworkShowDone', !on);
            close({ source: 'pick' });
            scheduleRender();
          },
        }, [
          icon('check', 20),
          el('span', { class: 'mw-act__label', text: T('Mostrar publicados', 'Show published') }),
          sw,
        ]),
        el('button', {
          class: 'mw-act', type: 'button',
          onclick: () => { close({ source: 'pick' }); c.router.navigate('automatizaciones', {}); },
        }, [icon('zap', 20), el('span', { class: 'mw-act__label', text: T('Automatizaciones', 'Automations') })]),
      );
    },
  });
}

// ── Render ───────────────────────────────────────────────────────────────────

function scheduleRender() {
  if (!mounted || renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (mounted) render();
  });
}

function clientOf(id) {
  const { clients } = ctx.store.getState();
  return (clients || []).find((x) => x.id === id) || null;
}

function dateChip(p, sectionKey) {
  const d = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
  if (!d) return el('span', { class: 'mw-date mw-date--none', text: T('Sin fecha', 'No date') });
  const late = sectionKey === 'vencidos';
  return el('span', { class: 'mw-date' + (late ? ' is-late' : '') }, [
    icon(late ? 'warning' : 'calendar', 13),
    el('span', { text: relativeDay(d) || fmtShort(d) }),
  ]);
}

function renderCard(p, sectionKey) {
  const c = clientOf(p.client_id);
  const meta = el('div', { class: 'mw-card__meta' });

  if (c) {
    meta.appendChild(el('span', { class: 'mw-client' }, [
      el('span', { class: 'mw-client__dot', style: { background: safeColor(c.brand_color) } }),
      el('span', { class: 'mw-client__name', text: c.name }),
    ]));
  }
  meta.appendChild(statusBadge(p.status));
  meta.appendChild(dateChip(p, sectionKey));
  if (Number(p.overdue) === 1 && p.status !== 'publicado') {
    meta.appendChild(el('span', { class: 'mw-pill mw-pill--late', text: T('Atrasado', 'Overdue') }));
  }
  const prio = PRIORITY_TAGS[p.priority];
  if (prio) {
    meta.appendChild(el('span', {
      class: 'mw-pill', style: { color: prio.color, borderColor: prio.color }, text: prio.label,
    }));
  }

  const menuBtn = el('button', {
    class: 'mw-card__menu', type: 'button',
    'aria-label': `${T('Acciones de', 'Actions for')} ${p.title || T('contenido', 'content')}`, 'aria-haspopup': 'dialog',
    onclick: (e) => { e.stopPropagation(); openCardMenu(p, menuBtn); },
  }, [icon('dots', 20)]);

  return el('article', { class: 'mw-card' + (sectionKey === 'vencidos' ? ' mw-card--late' : ''), dataset: { id: p.id } }, [
    el('button', {
      class: 'mw-card__main', type: 'button',
      onclick: () => ctx.openEditor(p.id),
    }, [
      el('span', { class: 'mw-card__title', text: p.title || T('Sin titulo', 'Untitled') }),
      meta,
    ]),
    menuBtn,
  ]);
}

function renderSection(def, posts, collapsedSet) {
  const collapsed = collapsedSet.has(def.key);
  const list = el('div', { class: 'mw-sec__list', hidden: collapsed });
  for (const p of posts) list.appendChild(renderCard(p, def.key));

  const head = el('button', {
    class: 'mw-sec__head', type: 'button',
    'aria-expanded': collapsed ? 'false' : 'true',
    onclick: () => {
      const next = !list.hidden;
      list.hidden = next;
      head.setAttribute('aria-expanded', next ? 'false' : 'true');
      head.classList.toggle('is-collapsed', next);
      setCollapsed(def.key, next);
    },
  }, [
    el('span', { class: 'mw-sec__caret' }, [icon('down', 16)]),
    icon(def.ic, 16),
    el('span', { class: 'mw-sec__label', text: def.label }),
    el('span', { class: 'mw-count' + (def.tone === 'danger' ? ' mw-count--danger' : ''), text: String(posts.length) }),
  ]);
  if (collapsed) head.classList.add('is-collapsed');

  return el('section', {
    class: 'mw-sec' + (def.tone === 'danger' ? ' mw-sec--danger' : ''),
    dataset: { sec: def.key },
  }, [head, list]);
}

function renderSummary(groups) {
  const wrap = el('div', { class: 'mw-summary', role: 'group', 'aria-label': T('Resumen de mi trabajo', 'My work summary') });
  for (const key of SUMMARY_KEYS) {
    const def = SECTION_DEFS.find((s) => s.key === key);
    const n = (groups.get(key) || []).length;
    wrap.appendChild(el('button', {
      class: 'mw-stat' + (def.tone === 'danger' && n > 0 ? ' mw-stat--danger' : '') + (n === 0 ? ' is-zero' : ''),
      type: 'button',
      'aria-label': `${def.label}: ${n}`,
      onclick: () => {
        if (n === 0) return;
        setCollapsed(key, false);
        scheduleRender();
        requestAnimationFrame(() => {
          const sec = rootEl && rootEl.querySelector(`.mw-sec[data-sec="${key}"]`);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      },
    }, [
      el('span', { class: 'mw-stat__num', text: String(n) }),
      el('span', { class: 'mw-stat__label', text: def.short || def.label }),
    ]));
  }
  return wrap;
}

function render() {
  if (!rootEl) return;

  // Cargando sin datos previos: skeleton.
  if ((loading || inflight) && !Array.isArray(myPosts)) {
    clear(rootEl);
    rootEl.appendChild(renderHead(null));
    const skel = el('div', { class: 'mw-skel-list', 'aria-hidden': 'true' });
    for (let i = 0; i < 5; i++) {
      skel.appendChild(el('div', { class: 'mw-skel' }, [
        el('div', { class: 'mw-skel__bar mw-skel__bar--wide' }),
        el('div', { class: 'mw-skel__bar' }),
      ]));
    }
    rootEl.appendChild(skel);
    return;
  }

  // Error sin datos previos.
  if (loadErr && !Array.isArray(myPosts)) {
    clear(rootEl);
    rootEl.appendChild(renderHead(null));
    rootEl.appendChild(el('div', { class: 'mw-empty' }, [
      el('div', { class: 'mw-empty__icon mw-empty__icon--err' }, [icon('warning', 26)]),
      el('h3', { text: T('No se pudo cargar tu trabajo', "Couldn't load your work") }),
      el('p', { class: 'muted', text: (loadErr && loadErr.message) || T('Revisa tu conexion e intenta de nuevo.', 'Check your connection and try again.') }),
      el('button', { class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'), onclick: () => reload() }),
    ]));
    return;
  }

  const list = Array.isArray(myPosts) ? myPosts : [];
  const groups = groupPosts(list);
  const done = groups.get('listos') || [];
  const pending = list.length - done.length;

  clear(rootEl);
  rootEl.appendChild(renderHead({ pending, list }));

  // Nada asignado en absoluto.
  if (!list.length) {
    rootEl.appendChild(el('div', { class: 'mw-empty' }, [
      el('div', { class: 'mw-empty__icon' }, [icon('briefcase', 26)]),
      el('h3', { text: T('Nada asignado a ti todavia', 'Nothing assigned to you yet') }),
      el('p', { class: 'muted', text: T('Cuando te asignen contenidos de cualquier cliente van a aparecer aqui.', 'When content from any client gets assigned to you, it will show up here.') }),
    ]));
    return;
  }

  rootEl.appendChild(renderSummary(groups));

  // Todo publicado y el toggle apagado: estado "al dia".
  if (pending === 0 && !showDone()) {
    rootEl.appendChild(el('div', { class: 'mw-empty' }, [
      el('div', { class: 'mw-empty__icon mw-empty__icon--ok' }, [icon('check', 26)]),
      el('h3', { text: T('Estas al dia', 'You are all caught up') }),
      el('p', { class: 'muted', text: T('Sin pendientes asignados a ti. Buen trabajo.', 'No pending items assigned to you. Nice work.') }),
      done.length ? el('button', {
        class: 'btn', type: 'button', text: `${T('Ver publicados', 'View published')} (${done.length})`,
        onclick: () => { ctx.prefs.set('myworkShowDone', true); scheduleRender(); },
      }) : null,
    ]));
    return;
  }

  const collapsedSet = new Set(getCollapsed());
  for (const def of SECTION_DEFS) {
    if (def.done && !showDone()) continue;
    const posts = groups.get(def.key) || [];
    if (!posts.length) continue;
    rootEl.appendChild(renderSection(def, posts, collapsedSet));
  }
}

function renderHead(info) {
  let sub = T('Tus contenidos en todos los clientes.', 'Your content across all clients.');
  if (info && Array.isArray(info.list) && info.list.length) {
    const clientsN = new Set(info.list.filter((p) => p.status !== 'publicado').map((p) => p.client_id)).size;
    sub = `${info.pending} ${info.pending === 1 ? T('pendiente', 'pending') : T('pendientes', 'pending')}` +
      (clientsN > 0 ? ` ${T('en', 'across')} ${clientsN} ${clientsN === 1 ? T('cliente', 'client') : T('clientes', 'clients')}` : '');
  }
  return el('header', { class: 'mw-head' }, [
    el('h2', { class: 'mw-head__title', text: T('Mi trabajo', 'My work') }),
    el('p', { class: 'mw-head__sub', text: sub }),
  ]);
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: VIEW_ID,

  mount(host, c) {
    ctx = c;
    mounted = true;
    ensurePackageCss();
    wireGlobal(c);

    rootEl = el('div', { class: 'mw-root' });
    host.appendChild(rootEl);

    // Controles del subhead: refrescar + opciones.
    const refreshBtn = el('button', {
      class: 'mw-ctl', type: 'button', 'aria-label': T('Refrescar', 'Refresh'),
      onclick: () => reload(),
    }, [icon('refresh', 18)]);
    const optsBtn = el('button', {
      class: 'mw-ctl', type: 'button', 'aria-label': T('Opciones', 'Options'), 'aria-haspopup': 'dialog',
      onclick: () => openOptionsSheet(optsBtn),
    }, [icon('settings', 18)]);
    ctx.setViewControls([refreshBtn, optsBtn]);

    unsubs.push(ctx.store.subscribe(['clients', 'me'], scheduleRender));

    if (!Array.isArray(myPosts) || Date.now() - lastLoadAt > STALE_MS) {
      reload({ quiet: Array.isArray(myPosts) });
    }
    render();
  },

  onParams() {
    scheduleRender();
  },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    mounted = false;
    renderQueued = false;
    rootEl = null;
    ctx = null;
    // OJO: el motor global (badge) sigue vivo a proposito.
  },
};
