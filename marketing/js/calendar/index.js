// ============================================================================
// IVAE Marketing v2 — Vista CALENDARIO (flagship). Modulo de vista lazy.
//
// Contrato (main.js / router.js):
//   export default { mount(el, ctx), unmount(), onParams(params) }
//
// Composicion:
//   - < 768px : agenda por dia + mini-mes navegable (agenda.js, minimonth.js)
//   - >= 768px: Mes (month.js) o Semana (week.js) + panel backlog (backlog.js)
//   - Controles del subhead: segmented Mes/Semana + backlog + filtros
//   - FAB "Nuevo contenido" -> quick-create (quickcreate.js)
//
// Datos: SIEMPRE store.posts (cliente activo o scope todos). Mutaciones via
// acciones canonicas del store (optimista + rollback + toast). Filtros en la
// URL, espejados por el shell en store.filters.
// ============================================================================

import { el, clear } from '../api.js?v=202606241500';
import {
  fmtYMD, parseYMD, addDays, addMonths, startOfMonth, startOfWeek,
  monthTitle, weekTitle, parseFilters, countActiveFilters, applyFilters,
  groupByDay, backlogPosts, workingAnchor,
} from './data.js?v=202606241500';
import * as calState from './state.js?v=202606241500';
import { renderMonth } from './month.js?v=202606241500';
import { renderWeek } from './week.js?v=202606241500';
import { renderAgenda } from './agenda.js?v=202606241500';
import { renderBacklog } from './backlog.js?v=202606241500';
import { buildControls } from './filters.js?v=202606241500';
import { openQuickCreate } from './quickcreate.js?v=202606241500';

const MQ_DESKTOP = '(min-width: 768px)';

let ctx = null;
let host = null;
let rootEl = null;
let mainEl = null;
let asideEl = null;
let titleEl = null;
let toolbarEl = null;
let controls = null;
let mq = null;

let unsubs = [];        // suscripciones store/estado local
let dndDisposers = [];  // dispose() de cada draggable del render actual
let raf = 0;
let mounted = false;

// Auto-aterrizaje en el "mes de trabajo": se aterriza una vez por cliente.
// Guarda el cliente ya aterrizado (sentinela != a cualquier id real al inicio).
const NO_CLIENT = Symbol('none');
let landedClientId = NO_CLIENT;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDesktop() {
  return mq ? mq.matches : window.matchMedia(MQ_DESKTOP).matches;
}

/** Modo efectivo: en movil siempre agenda; en desktop el modo elegido. */
function effectiveMode() {
  return isDesktop() ? calState.get().mode : 'agenda';
}

function disposeDnd() {
  for (const d of dndDisposers) { try { d(); } catch { /* noop */ } }
  dndDisposers = [];
}

function scheduleRender() {
  if (!mounted) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
}

/** Acepta saltos del dashboard (mkt.jump) o ?fecha= en la URL. Devuelve true si aplicó. */
function applyDateHints(params) {
  const hint = (params && (params.fecha || params.dia)) || null;
  if (hint && parseYMD(hint)) { calState.selectDay(hint); return true; }
  return false;
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  if (!mounted || !mainEl) return;
  const st = ctx.store.getState();

  // Auto-aterrizaje: al abrir (y al cambiar de cliente) posiciona el calendario
  // en el MES CON CONTENIDO del cliente (post más próximo, o el más reciente),
  // no en el mes actual si ahí no hay nada. Una sola vez por cliente; la
  // navegación manual y el botón "Hoy" no se vuelven a tocar.
  // Marca al cliente como aterrizado en cuanto la carga TERMINA (aunque NO tenga
  // posts): así, crear el 1er post después no reposiciona la vista a mitad de sesión.
  if (st.activeClientId !== landedClientId && !st.loading) {
    landedClientId = st.activeClientId;
    const anchor = workingAnchor(st.posts);
    if (anchor) {
      const d = parseYMD(anchor);
      calState.patch({ cursor: startOfMonth(d), selectedDay: anchor });
    }
  }

  const cal = calState.get();
  const mode = effectiveMode();

  rootEl.dataset.mode = mode;

  // Titulo del toolbar (solo visible en desktop).
  if (mode === 'semana') titleEl.textContent = weekTitle(startOfWeek(cal.cursor));
  else titleEl.textContent = monthTitle(startOfMonth(cal.cursor));

  // Datos filtrados.
  const filters = parseFilters(st.filters);
  const filtered = applyFilters(st.posts, filters);
  const byDay = groupByDay(filtered);
  const backlog = backlogPosts(filtered);
  const isTodos = st.activeClientId === 'todos';
  const clientsById = new Map((st.clients || []).map((c) => [c.id, c]));

  controls?.sync({
    filterCount: countActiveFilters(filters),
    backlogCount: backlog.length,
  });

  disposeDnd();

  // Carga inicial sin datos: skeleton.
  if (st.loading && !(st.posts || []).length) {
    clear(mainEl).appendChild(el('div', { class: 'view-loading' }, [
      el('span', { class: 'spinner', 'aria-hidden': 'true' }),
      el('span', { class: 'muted', text: 'Cargando calendario' }),
    ]));
    asideEl.hidden = true;
    return;
  }

  const deps = { byDay, backlog, clientsById, isTodos, disposers: dndDisposers };

  if (mode === 'agenda') {
    renderAgenda(mainEl, ctx, deps);
    asideEl.hidden = true;
  } else {
    if (mode === 'semana') {
      renderWeek(mainEl, ctx, { cursor: cal.cursor, ...deps });
    } else {
      renderMonth(mainEl, ctx, { cursor: cal.cursor, ...deps });
    }
    // Panel backlog lateral (desktop).
    if (cal.backlogOpen) {
      asideEl.hidden = false;
      renderBacklog(asideEl, ctx, { posts: backlog, clientsById, isTodos, disposers: dndDisposers });
    } else {
      asideEl.hidden = true;
      clear(asideEl);
    }
  }
}

// ── Navegacion del toolbar (desktop) ─────────────────────────────────────────

function navStep(dir) {
  const cal = calState.get();
  if (effectiveMode() === 'semana') {
    const anchor = startOfWeek(cal.cursor);
    calState.patch({ cursor: addDays(anchor, dir * 7) });
  } else {
    calState.patch({ cursor: addMonths(startOfMonth(cal.cursor), dir) });
  }
}

function buildScaffold() {
  titleEl = el('h1', { class: 'cal-title', 'aria-live': 'polite' });

  toolbarEl = el('div', { class: 'cal-toolbar' }, [
    el('div', { class: 'cal-toolbar__nav' }, [
      el('button', {
        class: 'cal-navbtn', type: 'button', 'aria-label': 'Anterior',
        onclick: () => navStep(-1),
      }, [ctx.icons('left', 18)]),
      el('button', {
        class: 'cal-navbtn cal-navbtn--today', type: 'button', text: 'Hoy',
        onclick: () => calState.goToday(),
      }),
      el('button', {
        class: 'cal-navbtn', type: 'button', 'aria-label': 'Siguiente',
        onclick: () => navStep(1),
      }, [ctx.icons('right', 18)]),
    ]),
    titleEl,
  ]);

  mainEl = el('div', { class: 'cal-main' });
  asideEl = el('aside', { class: 'cal-aside', hidden: true, 'aria-label': 'Backlog sin fecha' });

  rootEl = el('section', { class: 'cal' }, [
    toolbarEl,
    el('div', { class: 'cal-body' }, [mainEl, asideEl]),
  ]);
  host.appendChild(rootEl);
}

// ── Contrato de vista ────────────────────────────────────────────────────────

const view = {
  async mount(hostEl, viewCtx) {
    ctx = viewCtx;
    host = hostEl;
    mounted = true;

    calState.initFromPrefs();

    // Drill-down del dashboard (sessionStorage mkt.jump, se consume una vez).
    let explicitDate = false;
    const jump = ctx.prefs.takeJump ? ctx.prefs.takeJump() : null;
    if (jump && (jump.fecha || jump.date) && parseYMD(jump.fecha || jump.date)) {
      calState.selectDay(jump.fecha || jump.date);
      explicitDate = true;
    }
    if (applyDateHints(ctx.params)) explicitDate = true;

    // Si vino fecha explícita (drill-down / ?fecha=), respétala y NO auto-aterrices
    // para este cliente; si no, deja que el 1er render aterrice en el mes con contenido.
    landedClientId = explicitDate ? ctx.store.getState().activeClientId : NO_CLIENT;

    buildScaffold();

    // Controles del subhead: Mes/Semana + backlog + filtros.
    controls = buildControls(ctx);
    ctx.setViewControls(controls.nodes);

    // FAB: nuevo contenido (prefill: dia seleccionado en agenda, hoy en resto).
    ctx.setFab({
      label: 'Nuevo contenido',
      onTap: () => {
        const date = effectiveMode() === 'agenda' ? calState.get().selectedDay : fmtYMD(new Date());
        openQuickCreate(ctx, { date });
      },
    });

    // Re-render: posts/loading del store + estado local + breakpoint.
    unsubs.push(ctx.store.subscribe(['posts', 'loading', 'activeClientId'], scheduleRender));
    unsubs.push(calState.subscribe(scheduleRender));
    unsubs.push(ctx.store.on('posts:changed', scheduleRender));

    mq = window.matchMedia(MQ_DESKTOP);
    const onMq = () => scheduleRender();
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
    unsubs.push(() => {
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      else if (mq.removeListener) mq.removeListener(onMq);
    });

    render();
  },

  onParams(params) {
    // El shell ya actualizo store.filters y recargo posts si cambio el
    // cliente; aqui solo atendemos pistas de fecha y re-render.
    applyDateHints(params);
    scheduleRender();
  },

  unmount() {
    mounted = false;
    cancelAnimationFrame(raf);
    disposeDnd();
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    try { ctx.setFab(null); } catch { /* noop */ }
    try { ctx.setViewControls(null); } catch { /* noop */ }
    controls = null;
    rootEl = null; mainEl = null; asideEl = null; titleEl = null; toolbarEl = null;
    host = null; ctx = null; mq = null;
  },
};

export default view;
