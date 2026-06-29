// ============================================================================
// IVAE Marketing — Vista "Métricas" (panel de Instagram por periodo).
// Selector de periodo (semana / mes / 3-6 meses / año / personalizado con
// calendario) + KPIs + audiencia + rendimiento por video + descargar reporte.
// Datos: GET /ig/metrics-range?client_id&from&to. Solo staff (los clientes ven
// otras pestañas). Por marca: si la marca no tiene IG conectado, lo dice.
// ============================================================================
import { api, el, clear } from '../api.js?v=202606291422';
import { icon } from '../shell/icons.js?v=202606291422';

const VIEW_ID = 'metricas';

let ctx = null;
let rootEl = null;
let mounted = false;
let unsubs = [];

let period = '30d';
let customFrom = '';
let customTo = '';
let customOpen = false;
let loading = false;
let lastRes = null;
let lastKey = '';        // clientId|from|to del último fetch (evita refetch igual)

// Solo Semana y Mes: son los periodos donde Instagram entrega datos completos
// y confiables. Periodos largos (3/6/12 meses) y personalizado se quitaron
// porque Instagram no da estadisticas tan atras (datos parciales/vacios).
const PERIODS = [
  { id: '7d', label: 'Semana', days: 7 },
  { id: '30d', label: 'Mes', days: 30 },
];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date());
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return iso(d); }
function prettyDate(s) { const [y, m, da] = String(s).split('-').map(Number); return `${da} ${MESES[(m || 1) - 1]} ${y}`; }
function fmtSec(s) { return s == null ? null : (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`); }

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/metricas.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/metricas.css?v=202606291422';
  document.head.appendChild(link);
}

function currentRange() {
  if (period === 'custom' && customFrom && customTo) {
    return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
  }
  const p = PERIODS.find((x) => x.id === period) || PERIODS[1];
  return { from: daysAgoISO(p.days), to: todayISO() };
}
function periodText() {
  const { from, to } = currentRange();
  if (period === 'custom') return `${prettyDate(from)} – ${prettyDate(to)}`;
  const p = PERIODS.find((x) => x.id === period) || PERIODS[1];
  return `${p.label} · ${prettyDate(from)} – ${prettyDate(to)}`;
}
function activeBrand() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: 'Marca' };
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function load(force = false) {
  if (!mounted) return;
  const brand = activeBrand();
  if (!brand) { lastRes = null; render(); return; }
  const { from, to } = currentRange();
  const key = `${brand.id}|${from}|${to}`;
  if (!force && key === lastKey && lastRes) { render(); return; }
  lastKey = key;
  loading = true; render();
  try {
    const res = await api.get(`/ig/metrics-range?client_id=${encodeURIComponent(brand.id)}&from=${from}&to=${to}`);
    if (!mounted) return;
    loading = false; lastRes = res; render();
  } catch (e) {
    if (!mounted) return;
    loading = false; lastRes = { error: e.message || 'Error al cargar' }; render();
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function kpi(value, label, { hero = false, sub = '' } = {}) {
  return el('div', { class: 'mt-kpi' + (hero ? ' mt-kpi--hero' : '') }, [
    el('div', { class: 'mt-kpi__val', text: value }),
    el('div', { class: 'mt-kpi__lbl', text: label }),
    sub ? el('div', { class: 'mt-kpi__sub', text: sub }) : null,
  ]);
}

function demoBars(list, { sortByValue = true, top = 0, mapKey = (k) => k } = {}) {
  if (!Array.isArray(list) || !list.length) return [];
  let rows = [...list];
  if (sortByValue) rows.sort((a, b) => (b.value || 0) - (a.value || 0));
  else rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  if (top) rows = rows.slice(0, top);
  const total = list.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return rows.map((x) => {
    const p = Math.round((x.value || 0) / total * 100);
    return el('div', { class: 'mt-aud__row' }, [
      el('span', { class: 'mt-aud__k', text: mapKey(x.key) }),
      el('span', { class: 'mt-aud__bar' }, [el('i', { style: { width: p + '%' } })]),
      el('span', { class: 'mt-aud__v', text: p + '%' }),
    ]);
  });
}

function buildAudience(aud) {
  if (!aud || (!aud.gender && !aud.age && !aud.city)) return null;
  const gLabel = (k) => ({ M: 'Hombres', F: 'Mujeres', U: 'Sin dato' }[k] || k);
  const kids = [
    el('h3', { class: 'mt-h', text: 'Tu audiencia' }),
    el('p', { class: 'mt-hint', text: 'Foto actual de tus seguidores (no cambia con el periodo).' }),
  ];
  if (aud.gender) kids.push(el('div', { class: 'mt-aud' }, demoBars(aud.gender, { mapKey: gLabel })));
  if (aud.age) { kids.push(el('div', { class: 'mt-aud__sub', text: 'Edad' })); kids.push(el('div', { class: 'mt-aud' }, demoBars(aud.age, { sortByValue: false }))); }
  if (aud.city) { kids.push(el('div', { class: 'mt-aud__sub', text: 'Ciudades top' })); kids.push(el('div', { class: 'mt-aud' }, demoBars(aud.city, { top: 5 }))); }
  return el('section', { class: 'mt-card' }, kids);
}

function typeLabel(t) { return ({ REELS: 'Reel', VIDEO: 'Video', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Foto', FEED: 'Post' }[t] || 'Post'); }

function buildVideos(posts, truncated) {
  if (!Array.isArray(posts) || !posts.length) return null;
  const vm = (lbl, val) => (val == null ? null : el('span', { class: 'mt-vm' }, [el('b', { text: fmtN(val) }), ' ' + lbl]));
  const rows = posts.map((p) => {
    const day = String(p.timestamp || '').slice(8, 10);
    const mo = MESES[(Number(String(p.timestamp || '').slice(5, 7)) || 1) - 1] || '';
    const watch = fmtSec(p.avg_watch);
    return el('article', { class: 'mt-vid' }, [
      el('div', { class: 'mt-vid__head' }, [
        el('span', { class: 'mt-vid__type', text: typeLabel(p.type) }),
        el('span', { class: 'mt-vid__date', text: day ? `${day} ${mo}` : '' }),
        p.permalink ? el('a', { class: 'mt-vid__link', href: p.permalink, target: '_blank', rel: 'noopener', text: 'ver ↗' }) : null,
      ]),
      p.caption ? el('p', { class: 'mt-vid__cap', text: p.caption }) : null,
      el('div', { class: 'mt-vid__metrics' }, [
        vm('vistas', p.views), vm('alcance', p.reach), vm('me gusta', p.likes),
        vm('comentarios', p.comments), vm('guardados', p.saved), vm('compartidos', p.shares),
        watch ? el('span', { class: 'mt-vm' }, [el('b', { text: watch }), ' visto prom.']) : null,
      ]),
    ]);
  });
  const head = el('div', { class: 'mt-vids__head' }, [
    el('h3', { class: 'mt-h', text: `Rendimiento por video (${posts.length})` }),
    truncated ? el('span', { class: 'mt-note', text: `+${truncated} más en el periodo` }) : null,
  ]);
  return el('section', { class: 'mt-card' }, [head, el('div', { class: 'mt-vids' }, rows)]);
}

function buildEmpty(title, body, action, steps) {
  return el('div', { class: 'mt-empty empty-rich' }, [
    el('div', { class: 'empty-rich__ico' }, [icon('gauge', 26)]),
    el('h3', { class: 'empty-rich__t', text: title }),
    el('p', { class: 'empty-rich__s', text: body }),
    Array.isArray(steps) && steps.length
      ? el('ol', { class: 'mt-steps' }, steps.map((s, i) => el('li', { class: 'mt-step' }, [
          el('span', { class: 'mt-step__n', text: String(i + 1) }),
          el('span', { class: 'mt-step__t', text: s }),
        ])))
      : null,
    action || null,
  ]);
}

// ── Render principal ──────────────────────────────────────────────────────────
function buildPeriodBar() {
  const bar = el('div', { class: 'mt-periods' });
  for (const p of PERIODS) {
    bar.appendChild(el('button', {
      class: 'mt-chip' + (period === p.id ? ' is-active' : ''), type: 'button', text: p.label,
      onclick: () => { period = p.id; load(); },
    }));
  }
  return bar;
}

function render() {
  if (!rootEl) return;
  clear(rootEl);

  const brand = activeBrand();

  // Encabezado.
  const dl = brand ? el('a', {
    class: 'btn mt-download', target: '_blank', rel: 'noopener',
    href: (() => { const { from, to } = currentRange(); return `/api/marketing/report?client_id=${encodeURIComponent(brand.id)}&from=${from}&to=${to}`; })(),
  }, [icon('activity', 16), el('span', { text: 'Descargar reporte (PDF)' })]) : null;

  rootEl.appendChild(el('header', { class: 'mt-head' }, [
    el('div', { class: 'mt-head__l' }, [
      el('h1', { class: 'mt-title', text: 'Métricas de Instagram' }),
      el('div', { class: 'mt-sub', text: brand ? `${brand.name} · ${periodText()}` : 'Elige una marca' }),
    ]),
    dl,
  ]));

  if (!brand) {
    rootEl.appendChild(buildEmpty('Elige una marca', 'Selecciona una marca arriba para ver sus métricas de Instagram.'));
    return;
  }

  rootEl.appendChild(buildPeriodBar());

  if (loading) {
    rootEl.appendChild(el('div', { class: 'mt-loading' }, [el('div', { class: 'mt-spin' }), el('span', { text: 'Cargando métricas…' })]));
    return;
  }

  const res = lastRes;
  if (!res) { return; }

  if (res.error) {
    rootEl.appendChild(buildEmpty('No se pudieron cargar', res.error, el('button', { class: 'btn', type: 'button', text: 'Reintentar', onclick: () => load(true) })));
    return;
  }
  if (res.connected === false) {
    rootEl.appendChild(buildEmpty(
      'Instagram no conectado',
      'Conecta el Instagram de esta marca para ver seguidores, alcance, interacciones y el rendimiento de cada publicación, todo aquí.',
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Conectar Instagram',
        onclick: () => {
          const b = activeBrand();
          if (b) window.location.href = `/api/marketing/ig/login?client_id=${encodeURIComponent(b.id)}`;
        },
      }),
      [
        'Toca "Conectar Instagram" aquí abajo',
        'Inicia sesión y autoriza el acceso en Instagram',
        'Listo: el reporte se llena solo',
      ],
    ));
    return;
  }
  if (res.error || (res.connected && res.error)) {
    rootEl.appendChild(buildEmpty('Instagram', res.error || 'Sin datos', null));
    return;
  }

  const d = res.data || {};
  const t = d.totals || { posts: 0, views: 0, reach: 0, interactions: 0 };

  // KPIs.
  const kpis = el('div', { class: 'mt-kpis' }, [
    kpi(fmtN(d.followers), 'Seguidores', { hero: true, sub: d.reach_28d != null ? `${fmtN(d.reach_28d)} de alcance (últimos 28 días)` : '' }),
    kpi(fmtN(t.views), 'Vistas del periodo'),
    kpi(fmtN(t.reach), 'Alcance de publicaciones'),
    kpi(fmtN(t.interactions), 'Interacciones'),
    kpi(fmtN(t.posts), 'Publicaciones'),
  ]);
  rootEl.appendChild(kpis);
  if (d.pending) {
    rootEl.appendChild(el('p', { class: 'mt-hint mt-hint--pending', text: `Afinando métricas de ${d.pending} publicación${d.pending === 1 ? '' : 'es'} del periodo — vuelve a abrir en un momento para verlas completas.` }));
  }

  const aud = buildAudience(d.audience);
  if (aud) rootEl.appendChild(aud);

  const vids = buildVideos(d.posts, d.truncated);
  if (vids) rootEl.appendChild(vids);

  if (!aud && (!d.posts || !d.posts.length)) {
    rootEl.appendChild(buildEmpty('Sin datos en el periodo', 'No hay publicaciones ni datos de audiencia para estas fechas. Prueba un periodo más amplio.'));
  }
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────────
export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    mounted = true;
    ensureCss();
    rootEl = el('div', { class: 'mt-root' });
    host.appendChild(rootEl);
    unsubs.push(ctx.store.subscribe(['clients', 'activeClientId'], () => { lastKey = ''; load(); }));
    render();
    load();
  },
  onParams() { load(); },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    mounted = false;
    rootEl = null;
    ctx = null;
  },
};
