// ============================================================================
// IVAE Marketing v2 — Router por hash + capas de history.
//
// Rutas: #/<vista>?cliente=<id>&q=&estado=&tipo=&persona=&desde=&hasta=
//        #/post/<id>?tab=&comment=   (detalle full-screen, modulo editor)
//
// - parse() -> {view, params}
// - navigate(view, params, {replace}) serializa y asigna location.hash
// - hashchange -> diff: cambio de vista = unmount + mount; solo params =
//   view.onParams(params) sin remount.
// - CAPAS DE HISTORY: cada sheet/overlay abierto hace pushLayer(close);
//   popstate con capas pendientes cierra la capa superior y NO navega.
//   Asi el boton atras del telefono siempre hace lo esperado.
// - Vista desconocida -> redirect silencioso a la vista fallback + toast info.
//
// El registro de vistas (registerView) vive aqui; shell.js lo re-exporta.
// ============================================================================

const views = new Map();          // id -> {id,label,icon,mount,unmount?,onParams?}
let hostEl = null;                // contenedor #view
let makeCtx = null;               // () => ctx entregado a mount(el, ctx)
let fallbackView = 'tablero';
let beforeMount = null;           // hook del shell (cerrar sheets, prefs, accent)
let afterMount = null;            // hook del shell (chrome: tabs activas, subhead)
let onUnknown = null;             // aviso de vista desconocida (toast info)
let active = null;                // {def, view, params, el}
let started = false;

// ── Registro de vistas ───────────────────────────────────────────────────────
export function registerView(def) {
  if (!def || !def.id || typeof def.mount !== 'function') {
    throw new Error('registerView requiere {id, label, icon, mount}');
  }
  views.set(def.id, def);
  return def;
}

export function getView(id) { return views.get(id) || null; }
export function listViews() { return [...views.values()]; }

// ── Parse / serialize ────────────────────────────────────────────────────────
export function parse(hash = location.hash) {
  let h = String(hash || '');
  if (h.startsWith('#')) h = h.slice(1);
  if (h.startsWith('/')) h = h.slice(1);
  if (!h) return { view: null, params: {} };

  const qIdx = h.indexOf('?');
  const pathPart = qIdx === -1 ? h : h.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : h.slice(qIdx + 1);

  const segs = pathPart.split('/').filter(Boolean);
  const params = {};
  if (queryPart) {
    for (const [k, v] of new URLSearchParams(queryPart)) params[k] = v;
  }
  if (segs[0] === 'post' && segs[1]) {
    params.id = decodeURIComponent(segs[1]);
    return { view: 'post', params };
  }
  return { view: decodeURIComponent(segs[0] || ''), params };
}

export function serialize(view, params = {}) {
  const p = { ...params };
  let path;
  if (view === 'post' && p.id) {
    path = `post/${encodeURIComponent(p.id)}`;
    delete p.id;
  } else {
    path = encodeURIComponent(view);
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const q = qs.toString();
  return `#/${path}${q ? `?${q}` : ''}`;
}

export function current() {
  return active
    ? { view: active.view, params: { ...active.params } }
    : parse();
}

// ── Navegacion ───────────────────────────────────────────────────────────────
export function navigate(view, params = {}, { replace = false } = {}) {
  const hash = serialize(view, params);
  if (hash === location.hash) { apply(parse(hash)); return; }
  if (replace) {
    const url = location.pathname + location.search + hash;
    history.replaceState(history.state, '', url);
    apply(parse(hash));
  } else {
    location.hash = hash; // dispara hashchange -> apply
  }
}

// ── Capas de history (sheets / overlays vs boton atras) ─────────────────────
let layerSeq = 0;
const layerStack = []; // [{id, close}]

/**
 * Registra una capa cerrable con el boton atras. Devuelve release():
 * llamalo cuando la capa se cierre por OTRO medio (X, backdrop) para
 * consumir el history state sin re-cerrar.
 */
export function pushLayer(close) {
  const id = ++layerSeq;
  layerStack.push({ id, close });
  try { history.pushState({ ...(history.state || {}), mktLayer: id }, ''); } catch { /* noop */ }
  return function release() {
    const idx = layerStack.findIndex((l) => l.id === id);
    if (idx === -1) return; // ya consumida por popstate
    layerStack.splice(idx, 1);
    if (history.state && history.state.mktLayer === id) {
      try { history.back(); } catch { /* noop */ }
    }
  };
}

export function hasLayers() { return layerStack.length > 0; }

/** Cierra todas las capas abiertas (sin tocar history; para navegacion). */
export function closeAllLayers() {
  while (layerStack.length) {
    const top = layerStack.pop();
    try { top.close({ fromRouter: true }); } catch { /* noop */ }
  }
}

function onPopState() {
  if (layerStack.length) {
    const top = layerStack.pop();
    try { top.close({ fromHistory: true }); } catch { /* noop */ }
    // El hash no cambio (la capa se apilo sobre la misma ruta): no navegar.
    return;
  }
  // Sin capas: deja que hashchange (si lo hubo) resuelva la ruta.
}

// ── Mount / unmount ──────────────────────────────────────────────────────────
function unmountActive() {
  if (!active) return;
  try { active.def.unmount?.(); } catch (e) { console.error('[router] unmount', e); }
  if (hostEl) { while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild); }
  active = null;
}

function paramsEqual(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function apply(route) {
  let { view, params } = route;

  if (!view) { navigate(fallbackView, {}, { replace: true }); return; }
  const def = views.get(view);
  if (!def) {
    onUnknown?.(view);
    navigate(fallbackView, {}, { replace: true });
    return;
  }

  // Misma vista, solo cambiaron params -> onParams sin remount.
  if (active && active.view === view) {
    if (!paramsEqual(active.params, params)) {
      active.params = params;
      beforeMount?.(view, params, { paramsOnly: true });
      try { active.def.onParams?.(params); } catch (e) { console.error('[router] onParams', e); }
      afterMount?.(view, params, { paramsOnly: true });
    }
    return;
  }

  closeAllLayers();
  unmountActive();
  beforeMount?.(view, params, { paramsOnly: false });

  const el = hostEl;
  active = { def, view, params, el };
  try {
    const r = def.mount(el, makeCtx ? makeCtx(view, params) : {});
    if (r && typeof r.catch === 'function') {
      r.catch((e) => console.error('[router] mount', view, e));
    }
  } catch (e) {
    console.error('[router] mount', view, e);
  }
  afterMount?.(view, params, { paramsOnly: false });
}

// ── Arranque ─────────────────────────────────────────────────────────────────
/**
 * init({host, ctxFactory, fallback, onBeforeMount, onAfterMount, onUnknownView})
 * y luego start(initialRoute?) cuando el shell tenga estado listo.
 */
export function init(opts) {
  hostEl = opts.host;
  makeCtx = opts.ctxFactory || null;
  fallbackView = opts.fallback || 'tablero';
  beforeMount = opts.onBeforeMount || null;
  afterMount = opts.onAfterMount || null;
  onUnknown = opts.onUnknownView || null;
}

export function start(initial) {
  if (started) return;
  started = true;
  window.addEventListener('hashchange', () => apply(parse()));
  window.addEventListener('popstate', onPopState);
  if (initial && !parse().view) {
    navigate(initial.view, initial.params || {}, { replace: true });
  } else {
    apply(parse());
  }
}
