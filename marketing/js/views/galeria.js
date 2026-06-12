// ============================================================================
// IVAE Marketing v2 - Vista Galería (#/galeria) — inspirada en la vista
// "Galería de archivos" de Monday.com.
//
// Grid visual del contenido del mes: una tarjeta por post con tipo, fecha,
// estado, preview del caption y video (si fue subido). El cliente ve su feed
// del mes de un vistazo; tap en la tarjeta abre el editor (staff) o el
// detalle de caption (solo lectura del texto completo para todos).
//
// Contrato de vista: export default { id, mount(el, ctx), unmount(), onParams() }.
// Datos SOLO del store global (cero fetch propio), igual que meses.js.
// ============================================================================

import { el, clear, STATUSES, statusLabel, contentTypeLabel, fmtDate } from '../api.js?v=202606112051';
import { icon } from '../shell/icons.js?v=202606112051';

let ctx = null;
let rootEl = null;
let gridEl = null;
let headEl = null;
let unsubs = [];
let activeMonth = null;
let renderQueued = false;

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthKeyOf(post) {
  const s = String((post && post.publish_date) || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return `${MONTHS_ES[(m || 1) - 1] || ''} ${y || ''}`.trim();
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function scheduleRender() {
  if (!rootEl || renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

// ── Tarjeta ──────────────────────────────────────────────────────────────────

function buildCard(post) {
  const statusDef = STATUSES[post.status];

  // Medio: video subido/enlazado > icono por tipo de contenido.
  const hasVideo = !!post.video_url;
  const mediaKids = [];
  if (hasVideo) {
    mediaKids.push(el('span', { class: 'gal-card__play' }, [icon('right', 22)]));
    mediaKids.push(el('span', { class: 'gal-card__mediatag', text: 'Video' }));
  } else {
    const ic = post.content_type === 'carrusel' ? 'copy' : post.content_type === 'foto' ? 'camera' : 'calendar';
    mediaKids.push(el('span', { class: 'gal-card__typeicon' }, [icon(ic, 26)]));
  }
  const media = el('div', { class: 'gal-card__media', dataset: { tipo: post.content_type || 'reel' } }, mediaKids);

  const statusPill = el('span', { class: 'gal-card__status' }, [
    el('span', { class: 'gal-card__dot', 'aria-hidden': 'true' }),
    el('span', { text: statusLabel(post.status) || 'Sin estado' }),
  ]);
  statusPill.style.setProperty('--chipc', (statusDef && statusDef.color) || 'var(--text-mute)');

  const capText = String(post.caption || '').trim();

  const card = el('article', { class: 'gal-card', dataset: { id: String(post.id) } }, [
    media,
    el('div', { class: 'gal-card__body' }, [
      el('div', { class: 'gal-card__meta' }, [
        el('span', { class: 'gal-card__type', text: contentTypeLabel(post.content_type) || 'Post' }),
        el('span', { class: 'gal-card__date', text: post.publish_date ? fmtDate(post.publish_date, { day: 'numeric', month: 'short' }) : 'Sin fecha' }),
      ]),
      el('h3', { class: 'gal-card__title', text: post.title || 'Sin título' }),
      capText
        ? el('p', { class: 'gal-card__cap', text: capText })
        : el('p', { class: 'gal-card__cap gal-card__cap--empty', text: 'Sin caption todavía' }),
      el('div', { class: 'gal-card__foot' }, [statusPill]),
    ]),
  ]);

  // Tap: staff abre el editor completo; el cliente abre el detalle (editor en
  // modo edicion tambien esta permitido para clientes en su marca).
  card.addEventListener('click', (e) => {
    if (hasVideo && e.target.closest('.gal-card__media')) {
      window.open(post.video_url, '_blank', 'noopener');
      return;
    }
    ctx.openEditor(post.id);
  });

  // Video reproducible al tocar el medio.
  if (hasVideo) media.classList.add('gal-card__media--video');

  return card;
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  if (!rootEl || !ctx) return;
  const { posts, loading, activeClientId } = ctx.store.getState();
  const isTodos = activeClientId === 'todos';

  clear(headEl);
  clear(gridEl);

  if (loading && (!posts || !posts.length)) {
    for (let i = 0; i < 6; i++) gridEl.appendChild(el('div', { class: 'gal-card gal-card--skel' }));
    return;
  }
  if (isTodos) {
    gridEl.appendChild(el('div', { class: 'gal-empty', text: 'Elige una marca para ver su galería.' }));
    return;
  }

  // Agrupar por mes y elegir el mes activo (igual que meses.js: con contenido).
  const byMonth = new Map();
  for (const p of posts || []) {
    const k = monthKeyOf(p);
    if (!k) continue;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(p);
  }
  const ordered = [...byMonth.keys()].sort();
  if (!ordered.length) {
    gridEl.appendChild(el('div', { class: 'gal-empty', text: 'Aún no hay contenidos con fecha en esta marca.' }));
    return;
  }
  if (!activeMonth || !ordered.includes(activeMonth)) {
    activeMonth = ordered.includes(currentYM()) ? currentYM() : ordered[0];
  }

  // Encabezado: selector de mes (pills) + conteo.
  const bar = el('div', { class: 'gal-monthbar' });
  for (const ym of ordered) {
    const active = ym === activeMonth;
    bar.appendChild(el('button', {
      class: 'gal-monthpill' + (active ? ' is-active' : ''),
      type: 'button', 'aria-pressed': active ? 'true' : 'false',
      onclick: () => { activeMonth = ym; render(); },
    }, [
      el('span', { text: cap(monthLabel(ym)) }),
      el('span', { class: 'gal-monthpill__n', text: String((byMonth.get(ym) || []).length) }),
    ]));
  }
  headEl.appendChild(bar);

  const rows = [...(byMonth.get(activeMonth) || [])].sort((a, b) =>
    String(a.publish_date || '').localeCompare(String(b.publish_date || '')));
  for (const p of rows) gridEl.appendChild(buildCard(p));
}

// ── Contrato ─────────────────────────────────────────────────────────────────

export default {
  id: 'galeria',

  mount(host, c) {
    ctx = c;
    headEl = el('div', { class: 'gal-head' });
    gridEl = el('div', { class: 'gal-grid' });
    rootEl = el('div', { class: 'gal-root' }, [headEl, gridEl]);
    host.appendChild(rootEl);

    unsubs.push(
      ctx.store.subscribe(['posts', 'loading', 'activeClientId'], scheduleRender),
      ctx.store.on('client:changed', () => { activeMonth = null; }),
    );
    render();
  },

  onParams() { scheduleRender(); },

  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    activeMonth = null;
    renderQueued = false;
    headEl = null;
    gridEl = null;
    rootEl = null;
    ctx = null;
  },
};
