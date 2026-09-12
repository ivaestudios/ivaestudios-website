// ============================================================================
// IVAE Marketing — Vista "Estudios" (solo staff): el padrón de IVAE Gallery.
//
// Pedido de Israel (2026-09-11): "¿dónde puedo ver cuántos clientes tengo y
// todo? agrégalo al sistema de administración de Vianey". La galería y esta
// app comparten la MISMA base D1, así que el backend (_estudios.js) lee la
// tabla `studios` directo: cuántos fotógrafos se registraron, en qué plan van,
// cuánto pagan al mes, cuánto espacio usan y a quiénes se les vence la prueba.
//
// - UN fetch: GET /api/marketing/estudios (staff; el gate vive en el catch-all;
//   api.get ya antepone /api/marketing, así que aquí se pide '/estudios').
// - Contadores arriba (estudios, en prueba, gratis, pagando, MXN al mes, GB),
//   filtros por plan y buscador; tarjetas por estudio.
// - Las ACCIONES (cambiar plan, notas, suspender) siguen en el panel de la
//   galería: cada tarjeta enlaza allá. Aquí solo se mira.
// - Mobile-first 390px: una columna, contadores 2x3, targets >= 44px.
//
// Contrato de vista: export default { id, mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import { api, el, clear, toast } from '../api.js?v=202609121514';
import { icon } from '../shell/icons.js?v=202609121514';
import { T, isEN } from '../shell/i18n.js?v=202609121514';

const VIEW_ID = 'estudios';
const PANEL_GALERIA = 'https://gallery.ivaestudios.com/admin/estudios.html';
const TTL_MS = 60000;

let ctx = null;
let rootEl = null;
let bodyEl = null;
let cache = null;           // { at, data }
let seq = 0;
let filtro = 'todos';       // todos | prueba | gratis | pagando | atencion
let busqueda = '';
let refreshBtn = null;

// ── formato ──────────────────────────────────────────────────────────────────
const GB = 1e9;
function gb(bytes) {
  const n = (Number(bytes) || 0) / GB;
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
function mxn(n) {
  return '$' + (Math.round(Number(n) || 0)).toLocaleString(isEN ? 'en-US' : 'es-MX');
}
function fecha(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  if (!Number.isFinite(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString(isEN ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── clasificación (la misma que el backend manda en `grupo`) ────────────────
function etiquetaPlan(e, planes) {
  const p = (planes || []).find((x) => x.clave === e.plan);
  return p ? p.etiqueta : e.plan;
}
function estadoDe(e) {
  if (e.es_casa) return { clase: 'casa', texto: T('La casa', 'The house') };
  if (e.estado && e.estado !== 'activo') return { clase: 'malo', texto: T('Suspendido', 'Suspended') };
  if (e.pago_estado === 'cancelado') return { clase: 'malo', texto: T('Cancelado', 'Canceled') };
  if (e.grupo === 'prueba') {
    const d = e.dias_prueba;
    if (d == null) return { clase: 'prueba', texto: T('En prueba', 'On trial') };
    if (d <= 0) return { clase: 'atencion', texto: T('Prueba vencida', 'Trial expired') };
    if (d <= 3) return { clase: 'atencion', texto: T(`Vence en ${d} día${d === 1 ? '' : 's'}`, `Ends in ${d} day${d === 1 ? '' : 's'}`) };
    return { clase: 'prueba', texto: T(`Prueba · ${d} días`, `Trial · ${d} days`) };
  }
  if (e.grupo === 'gratis') return { clase: 'gratis', texto: T('Gratis', 'Free') };
  return { clase: 'pagando', texto: T('Pagando', 'Paying') };
}

// ── DOM ──────────────────────────────────────────────────────────────────────
function contador(valor, etiqueta, sub, clase) {
  return el('div', { class: 'es-kpi' + (clase ? ' es-kpi--' + clase : '') }, [
    el('div', { class: 'es-kpi__valor', text: valor }),
    el('div', { class: 'es-kpi__etiqueta', text: etiqueta }),
    sub ? el('div', { class: 'es-kpi__sub', text: sub }) : null,
  ]);
}

function tarjeta(e, planes) {
  const est = estadoDe(e);
  const cupo = e.cupo_bytes;
  const pct = cupo ? Math.min(100, Math.round(((e.bytes || 0) / cupo) * 100)) : 0;
  const precio = e.precio_mxn || 0;
  const href = PANEL_GALERIA + '#' + encodeURIComponent(e.id);
  return el('article', { class: 'es-card es-card--' + est.clase, dataset: { id: e.id } }, [
    el('header', { class: 'es-card__head' }, [
      el('div', { class: 'es-card__titulo' }, [
        el('h3', { class: 'es-card__nombre', text: e.nombre || e.slug || e.id }),
        el('span', { class: 'es-card__contacto', text: e.contacto || T('sin correo', 'no email') }),
      ]),
      el('span', { class: 'es-badge es-badge--' + est.clase, text: est.texto }),
    ]),
    el('div', { class: 'es-card__plan' }, [
      el('span', { class: 'es-plan', text: etiquetaPlan(e, planes) }),
      el('span', { class: 'es-plan__precio', text: e.es_casa ? T('sin cobro', 'no charge') : (precio ? mxn(precio) + T(' / mes', ' / mo') : T('$0 / mes', '$0 / mo')) }),
      el('span', { class: 'es-plan__desde', text: T('desde ', 'since ') + fecha(e.created_at) }),
    ]),
    el('div', { class: 'es-card__cifras' }, [
      el('div', { class: 'es-cifra' }, [el('b', { text: String(e.galerias || 0) }), el('span', { text: T('galerías', 'galleries') })]),
      el('div', { class: 'es-cifra' }, [el('b', { text: String(e.fotos || 0) }), el('span', { text: T('fotos', 'photos') })]),
      el('div', { class: 'es-cifra' }, [el('b', { text: String(e.clientes || 0) }), el('span', { text: T('clientas', 'clients') })]),
      // La casa no tiene tope de fotógrafos: esa casilla sobra.
      e.es_casa ? null : el('div', { class: 'es-cifra' }, [el('b', { text: String(e.asientos || 1) }), el('span', { text: T('fotógrafos', 'seats') })]),
    ]),
    el('div', { class: 'es-cupo', title: cupo ? pct + '%' : '' }, [
      el('div', { class: 'es-cupo__texto' }, [
        el('span', { text: gb(e.bytes) + ' GB' }),
        el('span', { class: 'es-cupo__de', text: cupo ? T(` de ${e.cupo_gb} GB`, ` of ${e.cupo_gb} GB`) : T(' · sin límite', ' · unlimited') }),
      ]),
      cupo ? el('div', { class: 'es-cupo__barra' }, [
        el('div', { class: 'es-cupo__lleno' + (pct >= 90 ? ' es-cupo__lleno--lleno' : ''), style: { width: pct + '%' } }),
      ]) : null,
    ]),
    e.notas ? el('p', { class: 'es-card__notas', text: e.notas }) : null,
    el('footer', { class: 'es-card__pie' }, [
      el('a', {
        class: 'btn es-card__abrir', href, target: '_blank', rel: 'noopener',
      }, [icon('link', 15), el('span', { text: T('Abrir en la galería', 'Open in the gallery') })]),
    ]),
  ]);
}

function pasaFiltro(e) {
  if (busqueda) {
    const q = busqueda.toLowerCase();
    const hay = [e.nombre, e.slug, e.contacto, e.plan, e.notas].some((v) => v && String(v).toLowerCase().includes(q));
    if (!hay) return false;
  }
  if (filtro === 'todos') return true;
  if (filtro === 'atencion') {
    const est = estadoDe(e);
    return est.clase === 'atencion' || est.clase === 'malo';
  }
  return e.grupo === filtro;
}

function pintar() {
  if (!bodyEl) return;
  clear(bodyEl);
  const data = cache && cache.data;
  if (!data) return;
  const r = data.resumen || {};
  const kpis = el('div', { class: 'es-kpis' }, [
    contador(String(r.estudios || 0), T('Estudios', 'Studios'), T('fotógrafos registrados', 'registered photographers')),
    contador(String(r.pagando || 0), T('Pagando', 'Paying'), mxn(r.mrr_mxn || 0) + T(' al mes', ' per month'), 'pagando'),
    contador(String(r.en_prueba || 0), T('En prueba', 'On trial'), r.por_vencer ? T(`${r.por_vencer} vencen en 3 días`, `${r.por_vencer} end within 3 days`) : T('14 días con 50 GB', '14 days with 50 GB'), 'prueba'),
    contador(String(r.gratis || 0), T('Gratis', 'Free'), T('10 GB para siempre', '10 GB forever'), 'gratis'),
    contador(gb(r.bytes_clientes || 0), T('GB de clientes', 'Client GB'), T(`${r.galerias || 0} galerías · ${r.fotos || 0} fotos`, `${r.galerias || 0} galleries · ${r.fotos || 0} photos`)),
    contador(String(r.clientes || 0), T('Clientas finales', 'End clients'), T('con acceso a una galería', 'with gallery access')),
  ]);
  bodyEl.appendChild(kpis);

  const lista = (data.estudios || []).filter(pasaFiltro);
  const grid = el('div', { class: 'es-grid' });
  if (!lista.length) {
    grid.appendChild(el('div', { class: 'empty es-vacio' }, [
      el('div', { class: 'empty__icon' }, [icon('users', 28)]),
      el('h3', { text: busqueda ? T('Nada con ese nombre', 'Nothing matches') : T('Todavía no hay estudios aquí', 'No studios here yet') }),
      el('p', { text: busqueda ? T('Prueba con otra palabra o quita el filtro.', 'Try another word or clear the filter.') : T('Cuando un fotógrafo se registre en la galería, aparece aquí.', 'When a photographer signs up for the gallery, it shows up here.') }),
    ]));
  } else {
    for (const e of lista) grid.appendChild(tarjeta(e, data.planes));
  }
  bodyEl.appendChild(grid);
  bodyEl.appendChild(el('p', { class: 'es-pie', text: T('Los datos se leen en vivo de la galería. Para cambiar un plan o dejar notas, abre el estudio en la galería.', 'Data is read live from the gallery. To change a plan or leave notes, open the studio in the gallery.') }));
}

async function cargar({ force = false } = {}) {
  const mio = ++seq;
  if (!force && cache && Date.now() - cache.at < TTL_MS) { pintar(); return; }
  if (refreshBtn) refreshBtn.disabled = true;
  try {
    const data = await api.get('/estudios');   // BASE ya trae /api/marketing
    if (mio !== seq) return;
    cache = { at: Date.now(), data };
    pintar();
  } catch (e) {
    if (mio !== seq) return;
    console.error('[estudios]', e);
    toast(T('No se pudo leer el padrón de la galería.', 'Could not read the gallery roster.'), 'error');
    if (!cache) {
      clear(bodyEl);
      bodyEl.appendChild(el('div', { class: 'empty es-vacio' }, [
        el('div', { class: 'empty__icon' }, [icon('warning', 28)]),
        el('h3', { text: T('La galería no respondió', 'The gallery did not answer') }),
        el('button', { class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'), onclick: () => cargar({ force: true }) }),
      ]));
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function cabecera() {
  const chips = [
    ['todos', T('Todos', 'All')],
    ['pagando', T('Pagando', 'Paying')],
    ['prueba', T('En prueba', 'On trial')],
    ['gratis', T('Gratis', 'Free')],
    ['atencion', T('Atención', 'Attention')],
  ];
  const chipBtns = new Map();
  const seg = el('div', { class: 'es-chips', role: 'tablist', 'aria-label': T('Filtrar estudios', 'Filter studios') }, chips.map(([id, label]) => {
    const b = el('button', {
      class: 'es-chip' + (filtro === id ? ' es-chip--activo' : ''), type: 'button', role: 'tab', text: label,
      'aria-selected': filtro === id ? 'true' : 'false',
      onclick: () => {
        filtro = id;
        for (const [k, btn] of chipBtns) { btn.classList.toggle('es-chip--activo', k === id); btn.setAttribute('aria-selected', k === id ? 'true' : 'false'); }
        pintar();
      },
    });
    chipBtns.set(id, b);
    return b;
  }));
  const buscar = el('input', {
    class: 'input es-buscar', type: 'search', placeholder: T('Buscar estudio o correo', 'Search studio or email'),
    'aria-label': T('Buscar estudio', 'Search studio'),
    oninput: (ev) => { busqueda = (ev.target.value || '').trim(); pintar(); },
  });
  refreshBtn = el('button', {
    class: 'btn es-refrescar', type: 'button', 'aria-label': T('Actualizar', 'Refresh'),
    onclick: () => cargar({ force: true }),
  }, [icon('refresh', 16), el('span', { text: T('Actualizar', 'Refresh') })]);
  return el('header', { class: 'es-head' }, [
    el('div', { class: 'mk-head es-head__titulos' }, [
      el('h2', { class: 'mk-title', text: T('Estudios de la galería', 'Gallery studios') }),
      el('p', { class: 'mk-sub', text: T('Los fotógrafos que se registraron en IVAE Gallery: su plan, lo que pagan y lo que usan.', 'Photographers who signed up for IVAE Gallery: their plan, what they pay and what they use.') }),
    ]),
    el('div', { class: 'es-herramientas' }, [buscar, refreshBtn]),
    seg,
  ]);
}

export default {
  id: VIEW_ID,
  label: T('Estudios', 'Studios'),
  icon: 'users',
  async mount(host, c) {
    ctx = c;
    const me = (ctx.store && ctx.store.getState().me) || {};
    rootEl = el('section', { class: 'es-root view-estudios' });
    if (me.role === 'client') {
      // El backend ya niega con 403; aquí solo no se pinta nada del padrón.
      rootEl.appendChild(el('div', { class: 'empty' }, [el('h3', { text: T('Esta sección es del equipo', 'This section is for the team') })]));
      host.appendChild(rootEl);
      return;
    }
    rootEl.appendChild(cabecera());
    bodyEl = el('div', { class: 'es-body' });
    rootEl.appendChild(bodyEl);
    host.appendChild(rootEl);
    await cargar();
  },
  onParams() { /* sin params: la vista es global */ },
  unmount() {
    seq++;
    rootEl = null; bodyEl = null; refreshBtn = null; ctx = null;
  },
};
