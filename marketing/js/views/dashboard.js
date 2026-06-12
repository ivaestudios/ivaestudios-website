// ============================================================================
// IVAE Marketing v2 — Vista Inicio / Resumen (dashboard). Ruta: #/inicio
//
// - UN solo fetch: GET /api/marketing/dashboard?month=YYYY-MM[&client_id=]
//   (el agregador unico del backend v2, _dashboard.js). Cache de 60s por
//   querystring en este modulo; cualquier 'mutated' del store la invalida.
//   NOTA: services/stats.js (tal como quedo construido) envuelve el GET
//   /stats eliminado y no trae las mini-listas, asi que este modulo cachea
//   /dashboard directamente con el mismo patron (TTL 60s + invalidate).
// - Drill-down universal: cada contador / segmento / leyenda navega via
//   router con params de filtro en la URL (estado, desde, hasta, aprobacion,
//   plataforma). El shell vuelca TODOS los params a store.filters
//   (paramsToFilters), asi que el contrato es solo-URL: nada de sessionStorage
//   mkt.jump (la vista tabla nunca lo consumia y quedaba stale). Si la vista
//   destino aun no soporta un param (p. ej. aprobacion/plataforma en tabla),
//   matchFilters lo ignora y degrada a la vista sin filtro: nunca rompe.
// - Scope Cliente/Agencia (pref dashScope) + navegador de mes (siempre abre
//   en el mes actual: el dashboard responde "como vamos HOY").
// - Reprogramar atrasados: optimista (la fila sale al instante), PATCH via
//   store.patchPost (rollback + toast del store si falla), toast con
//   Deshacer y re-fetch silencioso en background.
// - Mobile-first 390px: una columna, contadores 2x2, targets >= 44px.
//   Los builders de DOM viven en dash-widgets.js (puros, sin estado).
//
// Contrato de vista: export default { id, mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import { api, el, clear } from '../api.js?v=202606112051';
import { icon } from '../shell/icons.js?v=202606112051';
import {
  todayISO, addDaysISO, addMonths, parseISO, toISO,
  fmtMonthYear, fmtShort, fmtLong,
} from '../lib/dates.js?v=202606112051';
import * as W from './dash-widgets.js?v=202606112051';

const TTL_MS = 60000;
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Cache modulo-level: sobrevive a remounts (volver a Inicio es instantaneo).
const cache = new Map(); // querystring -> { at, data }

let ctx = null;
let rootEl = null;
let headEl = null;
let bodyEl = null;

// Header (parches quirurgicos, jamas se re-crea).
let scopeSeg = null;
let scopeClienteBtn = null;
let scopeAgenciaBtn = null;
let scopeNoteEl = null;
let refreshBtn = null;
let monthLabelEl = null;
let todayBtn = null;

let dmonth = '';            // 'YYYY-MM' del navegador de mes
let dataState = { data: null, loading: false, error: null };
let seq = 0;                // guard de carreras de fetch
let unsubs = [];
let offFns = [];
let visHandler = null;
let reloadTimer = 0;

// ── Helpers de estado ────────────────────────────────────────────────────────

function currentMonth() {
  return todayISO().slice(0, 7);
}

/**
 * Mes inicial de Inicio: HOY si tiene contenido (o si no hay datos aún);
 * si HOY está vacío, el mes con posts más cercano hacia adelante (o el
 * último con contenido). Evita aterrizar en un dashboard vacío cuando
 * todo el contenido vive en el mes siguiente.
 */
function initialMonth(c) {
  const today = currentMonth();
  try {
    const posts = (c.store.getState().posts || []).filter((p) => p.publish_date);
    if (!posts.length) return today;
    const months = [...new Set(posts.map((p) => String(p.publish_date).slice(0, 7)))].sort();
    if (months.includes(today)) return today;
    return months.find((m) => m > today) || months[months.length - 1];
  } catch {
    return today;
  }
}

function shiftMonthStr(month, delta) {
  const d = addMonths(parseISO(`${month}-01`), delta);
  return d ? toISO(d).slice(0, 7) : month;
}

/**
 * Alcance efectivo: con cliente 'todos' siempre Agencia; con un solo cliente
 * activo siempre Cliente; si no, manda la pref dashScope.
 */
function effectiveScope() {
  const st = ctx.store.getState();
  if (st.activeClientId === 'todos') return 'agencia';
  const activos = (st.clients || []).filter((c) => !c.archived);
  if (activos.length <= 1) return 'cliente';
  return ctx.prefs.get('dashScope', 'cliente') === 'agencia' ? 'agencia' : 'cliente';
}

function buildQuery() {
  const st = ctx.store.getState();
  const qs = new URLSearchParams();
  qs.set('month', dmonth);
  if (effectiveScope() === 'cliente' && st.activeClientId && st.activeClientId !== 'todos') {
    qs.set('client_id', st.activeClientId);
  }
  return qs.toString();
}

// ── Carga (cache 60s + dedupe por seq) ───────────────────────────────────────

function setSpin(b) {
  if (!refreshBtn) return;
  refreshBtn.setAttribute('aria-busy', b ? 'true' : 'false');
  refreshBtn.classList.toggle('is-busy', !!b);
}

async function load({ force = false, silent = false } = {}) {
  if (!rootEl || !ctx) return;
  const key = buildQuery();

  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) {
    dataState = { data: hit.data, loading: false, error: null };
    renderBody();
    return;
  }

  const my = ++seq;
  dataState.loading = true;
  dataState.error = null;
  if (!silent || !dataState.data) renderBody();
  setSpin(true);

  try {
    const res = await api.get(`/dashboard?${key}`);
    if (my !== seq || !rootEl) return;
    cache.set(key, { at: Date.now(), data: res });
    dataState = { data: res, loading: false, error: null };
    renderBody();
  } catch (e) {
    if (my !== seq || !rootEl) return;
    dataState.loading = false;
    if (!(silent && dataState.data)) {
      dataState.error = (e && e.message) || 'No se pudo cargar el resumen.';
      dataState.data = null;
      renderBody();
    }
  } finally {
    if (my === seq) setSpin(false);
  }
}

/** Re-fetch silencioso en background (debounce) tras mutaciones propias. */
function scheduleSilentReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    reloadTimer = 0;
    load({ force: true, silent: true });
  }, 700);
}

// ── Drill-down universal ─────────────────────────────────────────────────────

/**
 * Navega a otra vista con los filtros como params de URL. El shell convierte
 * todos los params (salvo cliente/id/tab/comment) en store.filters, asi que
 * la vista destino los lee de un solo lugar; los params que no reconoce los
 * ignora y degrada limpio a la vista sin ese filtro.
 */
function goJump(view, params = {}) {
  const st = ctx.store.getState();
  const cid = (dataState.data && dataState.data.scope === 'global') ? 'todos' : (st.activeClientId || null);
  const p = { ...params };
  if (cid) p.cliente = cid;
  ctx.router.navigate(view, p);
}

function jumpCounter(key) {
  const today = (dataState.data && dataState.data.today) || todayISO();
  if (key === 'aprobar') {
    goJump('tabla', { aprobacion: 'pending' });
  } else if (key === 'semana') {
    goJump('calendario', { desde: today, hasta: addDaysISO(today, 6) });
  } else if (key === 'atrasados') {
    goJump('tabla', { hasta: addDaysISO(today, -1) });
  } else {
    goJump('calendario');
  }
}

function jumpStatus(key) {
  if (!key || key === W.OTROS_KEY) {
    goJump('tablero');
  } else {
    goJump('tablero', { estado: key });
  }
}

function jumpPlatform(name) {
  if (!name || name === 'Otra') {
    goJump('tabla');
  } else {
    goJump('tabla', { plataforma: name });
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

function openPost(item) {
  if (item && item.id) ctx.openEditor(item.id);
}

/** Reprogramar un atrasado: optimista + Deshacer + re-fetch en background. */
async function reschedule(item) {
  const v = await ctx.pickers.pickDate({
    current: item.publish_date || null,
    title: 'Reprogramar publicacion',
    allowClear: false,
  });
  if (v == null || v === '') return;

  const prevDate = item.publish_date || null;
  const snapshot = dataState.data;

  // Optimista: la fila sale de Atrasados al instante.
  if (snapshot && snapshot.overdue) {
    const items = (snapshot.overdue.items || []).filter((p) => p.id !== item.id);
    dataState = {
      ...dataState,
      data: {
        ...snapshot,
        counters: {
          ...(snapshot.counters || {}),
          overdue: Math.max(0, (Number(snapshot.counters && snapshot.counters.overdue) || 1) - 1),
        },
        overdue: {
          count: Math.max(0, (Number(snapshot.overdue.count) || 1) - 1),
          items,
        },
      },
    };
    renderBody();
  }

  const res = await ctx.store.patchPost(item.id, { publish_date: v });
  if (!res) {
    // El store ya hizo rollback de posts + toast de error: restauramos la UI.
    dataState = { ...dataState, data: snapshot };
    renderBody();
    return;
  }

  ctx.toast(`Reprogramado al ${fmtShort(v)}.`, {
    type: 'success',
    action: {
      label: 'Deshacer',
      onAction: () => {
        ctx.store.patchPost(item.id, { publish_date: prevDate });
        scheduleSilentReload();
      },
    },
  });
  scheduleSilentReload();
}

/** Cliente destino para crear (el activo, o picker si estamos en 'todos'). */
async function resolveClientId() {
  const { activeClientId, clients } = ctx.store.getState();
  if (activeClientId && activeClientId !== 'todos') return activeClientId;
  const options = (clients || [])
    .filter((c) => !c.archived)
    .map((c) => ({
      value: c.id,
      label: c.name,
      color: HEX_RE.test(String(c.brand_color || '')) ? c.brand_color : 'var(--brand)',
    }));
  if (!options.length) {
    ctx.toast('No hay clientes activos para crear contenido.', { type: 'error' });
    return null;
  }
  return ctx.sheet.pickFrom({ title: 'Para que cliente', options });
}

/** Position sparse al final de la columna Idea de ese cliente. */
function nextIdeaPosition(clientId) {
  const { posts } = ctx.store.getState();
  let max = 0;
  let n = 0;
  for (const p of posts || []) {
    if (p.client_id !== clientId || (p.status || 'idea') !== 'idea') continue;
    n += 1;
    const pos = Number(p.position);
    if (!Number.isNaN(pos) && pos > max) max = pos;
  }
  return max ? max + 1000 : (n + 1) * 1000;
}

/** Alta rapida desde el FAB / empty states (titulo + fecha opcional). */
async function openQuickCreate() {
  const cid = await resolveClientId();
  if (!cid || !ctx) return;
  ctx.sheet.openSheet({
    title: 'Nuevo contenido',
    mode: 'form',
    build(body, close) {
      const input = el('input', {
        class: 'input', type: 'text', maxlength: '140',
        placeholder: 'Titulo del contenido',
        'aria-label': 'Titulo del contenido',
        autocomplete: 'off',
      });
      const dateInput = el('input', { class: 'input pk-date', type: 'date' });
      let busy = false;

      const createBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear',
        onclick: () => submit(),
      });

      async function submit() {
        const title = input.value.trim();
        if (!title) { input.focus(); return; }
        if (busy) return;
        busy = true;
        createBtn.setAttribute('data-loading', 'true');
        const data = { client_id: cid, title, status: 'idea', position: nextIdeaPosition(cid) };
        if (dateInput.value) data.publish_date = dateInput.value;
        const post = await ctx.store.createPost(data); // toast de error en el store
        busy = false;
        createBtn.removeAttribute('data-loading');
        if (post) {
          close({ source: 'save' });
          ctx.toast('Contenido creado.', { type: 'success' });
          scheduleSilentReload();
        }
      }

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Titulo' }), input]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: 'Fecha de publicacion (opcional)' }),
          dateInput,
        ]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          createBtn,
        ]),
      );
      setTimeout(() => input.focus(), 60);
    },
  });
}

/** Detalle de la racha: lista de los 14 dias con su conteo. */
function openStreakSheet() {
  const days = [...(((dataState.data || {}).activity || {}).days || [])].reverse();
  ctx.sheet.openSheet({
    title: 'Actividad de los ultimos 14 dias',
    mode: 'menu',
    build(body) {
      if (!days.length) {
        body.appendChild(el('p', { class: 'dash-sheet__empty', text: 'Sin datos de actividad todavia.' }));
        return;
      }
      const list = el('div', { class: 'dash-actlist' });
      for (const d of days) {
        const c = Number(d.count) || 0;
        list.appendChild(el('div', { class: 'dash-actrow' + (c > 0 ? ' has-activity' : '') }, [
          el('span', { class: 'dash-actrow__dot' }),
          el('span', { class: 'dash-actrow__day', text: fmtLong(d.date) }),
          el('span', {
            class: 'dash-actrow__count',
            text: c > 0 ? `${c} ${c === 1 ? 'accion' : 'acciones'}` : 'Sin actividad',
          }),
        ]));
      }
      body.appendChild(list);
    },
  });
}

/** Tap en una card de cliente (Agencia): drill-down natural a su resumen. */
function openClientCard(c) {
  if (!c || !c.id) return;
  ctx.prefs.set('dashScope', 'cliente');
  const st = ctx.store.getState();
  if (st.activeClientId === c.id) {
    updateHead();
    load();
  } else {
    // selectClient re-apunta la URL (la vista sigue siendo inicio) y dispara
    // nuestra suscripcion a activeClientId, que recarga el payload.
    ctx.selectClient(c.id);
  }
}

function setScope(scope) {
  ctx.prefs.set('dashScope', scope);
  updateHead();
  load();
}

function shiftMonth(delta) {
  dmonth = shiftMonthStr(dmonth, delta);
  updateHead();
  load();
}

// ── Header (se construye UNA vez; updateHead lo parchea) ─────────────────────

function buildHead() {
  scopeClienteBtn = el('button', {
    type: 'button', role: 'tab', text: 'Cliente',
    onclick: () => setScope('cliente'),
  });
  scopeAgenciaBtn = el('button', {
    type: 'button', role: 'tab', text: 'Agencia',
    onclick: () => setScope('agencia'),
  });
  scopeSeg = el('div', {
    class: 'seg dash-scope', role: 'tablist', 'aria-label': 'Alcance del resumen',
  }, [scopeClienteBtn, scopeAgenciaBtn]);

  scopeNoteEl = el('span', { class: 'dash-scopenote', hidden: true });

  refreshBtn = el('button', {
    class: 'dash-iconbtn', type: 'button', 'aria-label': 'Actualizar resumen',
    onclick: () => load({ force: true }),
  }, [icon('refresh', 20)]);

  monthLabelEl = el('h2', { class: 'dash-month__label', 'aria-live': 'polite' });
  todayBtn = el('button', {
    class: 'btn btn-sm dash-today', type: 'button', text: 'Este mes', hidden: true,
    onclick: () => { dmonth = currentMonth(); updateHead(); load(); },
  });

  headEl = el('div', { class: 'dash-head' }, [
    el('div', { class: 'dash-head__row' }, [
      scopeSeg,
      scopeNoteEl,
      el('span', { class: 'dash-spacer' }),
      refreshBtn,
    ]),
    el('div', { class: 'dash-head__row dash-head__row--month' }, [
      el('button', {
        class: 'dash-iconbtn', type: 'button', 'aria-label': 'Mes anterior',
        onclick: () => shiftMonth(-1),
      }, [icon('left', 20)]),
      monthLabelEl,
      el('button', {
        class: 'dash-iconbtn', type: 'button', 'aria-label': 'Mes siguiente',
        onclick: () => shiftMonth(1),
      }, [icon('right', 20)]),
      todayBtn,
    ]),
  ]);
}

function updateHead() {
  if (!headEl || !ctx) return;
  const st = ctx.store.getState();
  const activos = (st.clients || []).filter((c) => !c.archived);
  const isTodos = st.activeClientId === 'todos';
  const showToggle = !isTodos && activos.length > 1;
  const cur = (st.clients || []).find((c) => c.id === st.activeClientId) || null;

  scopeSeg.hidden = !showToggle;
  scopeNoteEl.hidden = showToggle;
  scopeNoteEl.textContent = isTodos ? 'Todos los clientes' : (cur ? cur.name : 'Resumen');

  scopeClienteBtn.textContent = cur ? cur.name : 'Cliente';
  const scope = effectiveScope();
  scopeClienteBtn.classList.toggle('is-active', scope === 'cliente');
  scopeClienteBtn.setAttribute('aria-selected', scope === 'cliente' ? 'true' : 'false');
  scopeAgenciaBtn.classList.toggle('is-active', scope === 'agencia');
  scopeAgenciaBtn.setAttribute('aria-selected', scope === 'agencia' ? 'true' : 'false');

  monthLabelEl.textContent = fmtMonthYear(`${dmonth}-01`);
  todayBtn.hidden = dmonth === currentMonth();
}

// ── Render del cuerpo (replaceChildren del body, nunca del header) ───────────

function renderBody() {
  if (!bodyEl) return;
  clear(bodyEl);

  const data = dataState.data;
  if (!data) {
    if (dataState.loading) { bodyEl.appendChild(W.dashSkeleton()); return; }
    if (dataState.error) {
      bodyEl.appendChild(W.errorCard({
        message: dataState.error,
        onRetry: () => load({ force: true }),
      }));
    }
    return;
  }

  const global = data.scope === 'global';
  bodyEl.classList.toggle('dash-body--global', global);
  const today = data.today || todayISO();
  const counters = data.counters || {};
  const approvals = data.approvals || { count: 0, items: [] };
  const week = data.week || { count: 0, items: [] };
  const overdue = data.overdue || { count: 0, items: [] };
  const activity = data.activity || { streak: 0, days: [] };
  const pipelineTotal = (data.pipeline || []).reduce((a, r) => a + (Number(r.count) || 0), 0);

  // Vacio total del cliente: empty global con CTA crear.
  const isEmpty = !global
    && pipelineTotal === 0
    && !(Number(counters.monthTotal) || 0)
    && !(Number(counters.noDate) || 0)
    && !(Number(counters.pending) || 0)
    && !(Number(counters.overdue) || 0);
  if (isEmpty) {
    bodyEl.appendChild(W.emptyMonth({ onCreate: openQuickCreate }));
    return;
  }

  // 1) Contadores 2x2 (siempre).
  bodyEl.appendChild(W.countersGrid({ counters, onJump: jumpCounter }));

  if (global) {
    // Agencia: cards por cliente (el server ya las ordena por urgencia).
    bodyEl.appendChild(W.clientsSection({
      clients: data.clients || [],
      onOpen: openClientCard,
    }));
  } else {
    // Cliente: pipeline + mini-listas.
    bodyEl.appendChild(W.pipelineCard({
      pipeline: data.pipeline || [],
      onStatusTap: jumpStatus,
    }));
    bodyEl.appendChild(W.approvalsCard({
      count: Number(approvals.count) || 0,
      items: approvals.items || [],
      onOpen: openPost,
      onSeeAll: () => jumpCounter('aprobar'),
    }));
    bodyEl.appendChild(W.weekCard({
      count: Number(week.count) || 0,
      items: week.items || [],
      today,
      onOpen: openPost,
      onSeeAll: () => jumpCounter('semana'),
      onCreate: openQuickCreate,
    }));
    if ((Number(overdue.count) || 0) > 0) {
      bodyEl.appendChild(W.overdueCard({
        count: Number(overdue.count) || 0,
        items: overdue.items || [],
        today,
        onOpen: openPost,
        onReschedule: reschedule,
        onSeeAll: () => jumpCounter('atrasados'),
      }));
    }
  }

  // Donut + racha (en ambos alcances).
  bodyEl.appendChild(W.donutCard({
    platforms: W.normalizePlatforms(data.platforms || []),
    monthLabel: fmtMonthYear(`${dmonth}-01`),
    onPlatformTap: jumpPlatform,
  }));
  bodyEl.appendChild(W.streakCard({
    streak: Number(activity.streak) || 0,
    days: activity.days || [],
    onDetails: openStreakSheet,
  }));
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'inicio',

  mount(host, c) {
    ctx = c;
    dmonth = initialMonth(c); // HOY, o el mes con contenido más cercano si HOY está vacío
    dataState = { data: null, loading: false, error: null };

    buildHead();
    bodyEl = el('div', { class: 'dash-body' });
    rootEl = el('div', { class: 'dash-root' }, [headEl, bodyEl]);
    host.appendChild(rootEl);

    ctx.setFab({ label: 'Nuevo', onTap: () => openQuickCreate() });

    // Cualquier mutacion propia invalida el cache; un posts:changed re-fetcha
    // en background (debounced) para que los numeros nunca queden viejos.
    offFns.push(ctx.store.on('mutated', () => cache.clear()));
    offFns.push(ctx.store.on('posts:changed', () => scheduleSilentReload()));

    unsubs.push(ctx.store.subscribe(['clients'], () => updateHead()));
    unsubs.push(ctx.store.subscribe(['activeClientId'], () => {
      updateHead();
      load({ silent: true });
    }));

    visHandler = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    document.addEventListener('visibilitychange', visHandler);

    updateHead();
    load();
  },

  onParams() {
    // Inicio no usa params de ruta; el cambio de ?cliente= ya lo maneja el
    // shell (onBeforeMount) y nuestra suscripcion a activeClientId.
  },

  unmount() {
    seq += 1; // cancela cualquier fetch en vuelo (no pintara)
    clearTimeout(reloadTimer);
    reloadTimer = 0;
    if (visHandler) {
      document.removeEventListener('visibilitychange', visHandler);
      visHandler = null;
    }
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    for (const f of offFns) { try { f(); } catch { /* noop */ } }
    offFns = [];
    rootEl = null;
    headEl = null;
    bodyEl = null;
    scopeSeg = null;
    scopeClienteBtn = null;
    scopeAgenciaBtn = null;
    scopeNoteEl = null;
    refreshBtn = null;
    monthLabelEl = null;
    todayBtn = null;
    ctx = null;
  },
};
