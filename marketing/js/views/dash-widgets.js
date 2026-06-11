// ============================================================================
// IVAE Marketing v2 — Widgets del dashboard (Inicio). BUILDERS PUROS.
//
// CERO estado, CERO fetch, CERO store: cada funcion recibe datos + callbacks
// y devuelve un nodo DOM. El controlador (views/dashboard.js) es quien decide
// que pintar y que hacer al tocar.
//
// Reglas que cumple este modulo:
//   - Todo dato de usuario via textContent (helper el() de api.js).
//   - El donut es SVG construido con createElementNS (nada de innerHTML).
//   - Leyendas textuales SIEMPRE visibles (no-solo-color, sin tooltips hover).
//   - Targets tactiles >= 44px (la barra del pipeline mide 14px pero su hit
//     area es de 44px via el boton contenedor).
//   - Texto visible en es-MX sin acentos (convencion v2) y sin em-dashes.
// ============================================================================

import {
  el,
  STATUSES, STATUS_ORDER,
  CONTENT_TYPES, PLATFORMS,
  statusBadge, approvalBadge,
} from '../api.js?v=202606110013';
import { icon } from '../shell/icons.js?v=202606110013';
import { fmtShort, diffDays, parseISO, DIAS_CORTOS } from '../lib/dates.js?v=202606110013';

// Bucket para status que ya no existen en el enum (NUNCA invisibles).
export const OTROS_KEY = '__otros';
const OTROS_COLOR = '#64748b';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const PLATFORM_COLORS = {
  Instagram: '#d946ef',
  TikTok: '#22d3ee',
  Facebook: '#3b82f6',
  YouTube: '#ef4444',
  LinkedIn: '#0ea5e9',
  Otra: '#64748b',
};

function safeColor(c, fallback = 'var(--brand)') {
  return HEX_RE.test(String(c || '')) ? c : fallback;
}

function typeColor(contentType) {
  const t = CONTENT_TYPES[contentType];
  return (t && t.color) || OTROS_COLOR;
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function metaBadge(n) {
  return el('span', { class: 'dash-card__meta', text: String(n) });
}

/** Card generica del dashboard: titulo + meta opcional + contenido. */
function card({ title, className = '', headRight = null, children = [] }) {
  const kids = [];
  if (title) {
    kids.push(el('div', { class: 'dash-card__head' }, [
      el('h3', { class: 'dash-card__title', text: title }),
      headRight,
    ]));
  }
  for (const c of [].concat(children)) if (c) kids.push(c);
  return el('section', { class: `dash-card ${className}`.trim() }, kids);
}

// ── SVG helper (sin innerHTML) ───────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, children = []) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    n.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) if (c) n.appendChild(c);
  return n;
}

// ── Normalizacion de plataformas (el server manda texto libre) ──────────────
/**
 * [{platform, count}] crudos -> [{platform, count, color}] canonicos:
 * match case-insensitive contra PLATFORMS; el resto se agrupa como 'Otra'.
 * Ordenado por count desc.
 */
export function normalizePlatforms(rows) {
  const canon = new Map(PLATFORMS.map((p) => [p.toLowerCase(), p]));
  const acc = new Map();
  for (const r of rows || []) {
    const raw = String((r && r.platform) || '').trim();
    const key = canon.get(raw.toLowerCase()) || 'Otra';
    acc.set(key, (acc.get(key) || 0) + (Number(r && r.count) || 0));
  }
  return [...acc.entries()]
    .map(([platform, count]) => ({
      platform,
      count,
      color: PLATFORM_COLORS[platform] || PLATFORM_COLORS.Otra,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ── 1) Contadores 2x2 (drill-down universal) ─────────────────────────────────

function counterCard({ key, value, label, sub, tone, withCheck, onTap }) {
  const valueWrap = el('span', { class: 'dash-counter__value' }, [
    withCheck ? icon('check', 22) : null,
    el('b', { text: String(value) }),
  ]);
  return el('button', {
    class: 'dash-counter' + (tone ? ` is-${tone}` : ''),
    type: 'button',
    dataset: { counter: key },
    'aria-label': `${label}: ${value}${sub ? `, ${sub}` : ''}. Ver detalle`,
    onclick: () => { if (onTap) onTap(key); },
  }, [
    valueWrap,
    el('span', { class: 'dash-counter__label', text: label }),
    sub ? el('span', { class: 'dash-counter__sub', text: sub }) : null,
  ]);
}

/**
 * countersGrid({counters:{pending,week,overdue,monthTotal,noDate}, onJump(key)})
 * keys de drill-down: 'aprobar' | 'semana' | 'atrasados' | 'mes'.
 */
export function countersGrid({ counters = {}, onJump }) {
  const pending = Number(counters.pending) || 0;
  const week = Number(counters.week) || 0;
  const overdue = Number(counters.overdue) || 0;
  const monthTotal = Number(counters.monthTotal) || 0;
  const noDate = Number(counters.noDate) || 0;

  return el('div', { class: 'dash-counters' }, [
    counterCard({
      key: 'aprobar', value: pending, label: 'Por aprobar',
      tone: pending > 0 ? 'warn' : '', onTap: onJump,
    }),
    counterCard({
      key: 'semana', value: week, label: 'Esta semana',
      tone: '', onTap: onJump,
    }),
    counterCard({
      key: 'atrasados', value: overdue, label: 'Atrasados',
      tone: overdue > 0 ? 'danger' : 'ok',
      withCheck: overdue === 0,
      sub: overdue === 0 ? 'Al dia' : '',
      onTap: onJump,
    }),
    counterCard({
      key: 'mes', value: monthTotal, label: 'Posts del mes',
      sub: noDate > 0 ? `y ${plural(noDate, 'idea sin fecha', 'ideas sin fecha')}` : '',
      onTap: onJump,
    }),
  ]);
}

// ── 2) Pipeline battery (barra apilada + leyenda SIEMPRE visible) ───────────

function pipelineData(pipeline) {
  const counts = new Map();
  let otros = 0;
  for (const r of pipeline || []) {
    const k = String((r && r.status) || '');
    const n = Number(r && r.count) || 0;
    if (STATUSES[k]) counts.set(k, (counts.get(k) || 0) + n);
    else otros += n;
  }
  const segments = [];
  for (const s of STATUS_ORDER) {
    const n = counts.get(s);
    if (n) segments.push({ key: s, label: STATUSES[s].label, color: STATUSES[s].color, count: n });
  }
  if (otros > 0) segments.push({ key: OTROS_KEY, label: 'Otros', color: OTROS_COLOR, count: otros });
  const total = segments.reduce((a, x) => a + x.count, 0);
  const zeros = STATUS_ORDER
    .filter((s) => !counts.get(s))
    .map((s) => ({ key: s, label: STATUSES[s].label, color: STATUSES[s].color, count: 0 }));
  return { segments, total, zeros };
}

/** pipelineCard({pipeline:[{status,count}], onStatusTap(key)}) */
export function pipelineCard({ pipeline, onStatusTap }) {
  const { segments, total, zeros } = pipelineData(pipeline);

  if (!total) {
    return card({
      title: 'Pipeline',
      className: 'dash-pipeline',
      children: el('p', { class: 'dash-card__empty', text: 'Sin contenidos en el pipeline.' }),
    });
  }

  const pct = (n) => Math.round((n / total) * 100);

  // Barra: cada segmento es un boton de 44px de alto; el color visible es un
  // relleno interno de 14px (target amplio sin engordar la barra).
  const bar = el('div', { class: 'dash-battery', 'aria-label': `Pipeline, ${total} contenidos` }, segments.map((s) =>
    el('button', {
      class: 'dash-battery__seg',
      type: 'button',
      style: { flexGrow: String(s.count) },
      'aria-label': `${s.label}: ${s.count} (${pct(s.count)}%)`,
      onclick: () => { if (onStatusTap) onStatusTap(s.key); },
    }, [el('span', { class: 'dash-battery__fill', style: { background: s.color } })])
  ));

  const legendRow = (s) => el('button', {
    class: 'dash-legend__row' + (s.count === 0 ? ' is-zero' : ''),
    type: 'button',
    onclick: () => { if (onStatusTap) onStatusTap(s.key); },
  }, [
    el('span', { class: 'dash-legend__dot', style: { background: s.color } }),
    el('span', { class: 'dash-legend__label', text: s.label }),
    el('span', { class: 'dash-legend__count', text: String(s.count) }),
    el('span', { class: 'dash-legend__pct', text: `${pct(s.count)}%` }),
  ]);

  const legend = el('div', { class: 'dash-legend' }, segments.map(legendRow));

  let moreBtn = null;
  if (zeros.length) {
    moreBtn = el('button', {
      class: 'dash-link',
      type: 'button',
      text: 'Ver todos los estados',
      onclick: () => {
        for (const z of zeros) legend.appendChild(legendRow(z));
        moreBtn.remove();
      },
    });
  }

  return card({
    title: 'Pipeline',
    className: 'dash-pipeline',
    headRight: el('span', { class: 'dash-card__meta', text: `${total} en total` }),
    children: [bar, legend, moreBtn],
  });
}

// ── Fila de post compartida por las mini-listas ──────────────────────────────

/**
 * postRow({item, accent, sub, right, warn, onOpen, trailing}):
 * toda la fila navega (boton); `trailing` es una accion hermana propia
 * (ej. Reprogramar) con su propio target de 44px.
 */
function postRow({ item, accent, sub = null, right = null, warn = false, onOpen, trailing = null }) {
  const rowBtn = el('button', {
    class: 'dash-row' + (warn ? ' is-warn' : ''),
    type: 'button',
    onclick: () => { if (onOpen) onOpen(item); },
  }, [
    el('span', { class: 'dash-row__bar', style: { background: accent || 'var(--border-strong)' } }),
    el('span', { class: 'dash-row__main' }, [
      el('span', { class: 'dash-row__title', text: item.title || 'Sin titulo' }),
      sub,
    ]),
    right,
  ]);
  if (!trailing) return rowBtn;
  return el('div', { class: 'dash-rowwrap' }, [rowBtn, trailing]);
}

// ── 3) Por aprobar ───────────────────────────────────────────────────────────

/** approvalsCard({count, items:[postLite], onOpen(item), onSeeAll()}) */
export function approvalsCard({ count = 0, items = [], onOpen, onSeeAll }) {
  const children = [];
  if (!items.length) {
    children.push(el('p', { class: 'dash-card__empty', text: 'Nada espera aprobacion del cliente.' }));
  } else {
    children.push(el('div', { class: 'dash-list' }, items.map((it) => postRow({
      item: it,
      accent: typeColor(it.content_type),
      sub: el('span', { class: 'dash-row__sub' }, [
        el('span', { class: 'dash-row__date', text: it.publish_date ? fmtShort(it.publish_date) : 'Sin fecha' }),
      ]),
      right: approvalBadge(it.approval_state || 'pending'),
      onOpen,
    }))));
    if (count > items.length) {
      children.push(el('button', {
        class: 'dash-link', type: 'button',
        text: `Ver los ${count} pendientes`,
        onclick: () => { if (onSeeAll) onSeeAll(); },
      }));
    }
  }
  return card({
    title: 'Por aprobar',
    className: 'dash-approvals',
    headRight: count > 0 ? metaBadge(count) : null,
    children,
  });
}

// ── 4) Proximos 7 dias (agrupado por dia, semaforo de aprobacion) ───────────

function dayLabel(iso) {
  const d = parseISO(iso);
  if (!d) return iso || '';
  const dia = DIAS_CORTOS[(d.getDay() + 6) % 7];
  return `${dia} ${fmtShort(iso)}`;
}

/** weekCard({count, items, today, onOpen(item), onSeeAll(), onCreate()}) */
export function weekCard({ count = 0, items = [], today = '', onOpen, onSeeAll, onCreate }) {
  const children = [];

  if (!items.length) {
    children.push(el('div', { class: 'dash-card__cta' }, [
      el('p', { class: 'dash-card__empty', text: 'Semana libre de publicaciones.' }),
      onCreate ? el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', text: 'Nuevo contenido',
        onclick: () => onCreate(),
      }) : null,
    ]));
  } else {
    const byDay = new Map();
    for (const it of items) {
      const d = String(it.publish_date || '').slice(0, 10);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(it);
    }
    const wrap = el('div', { class: 'dash-week' });
    for (const [d, list] of byDay) {
      const isHoy = d === today;
      wrap.appendChild(el('div', { class: 'dash-day' + (isHoy ? ' is-today' : '') }, [
        el('span', { class: 'dash-day__label', text: dayLabel(d) }),
        isHoy ? el('span', { class: 'dash-day__tag', text: 'Hoy' }) : null,
      ]));
      for (const it of list) {
        const dist = diffDays(today, d);
        const warn = dist !== null && dist >= 0 && dist <= 1 && it.approval_state !== 'approved';
        wrap.appendChild(postRow({
          item: it,
          accent: typeColor(it.content_type),
          sub: el('span', { class: 'dash-row__sub' }, [
            statusBadge(it.status),
            it.platform ? el('span', { class: 'dash-row__tag', text: it.platform }) : null,
            warn ? el('span', { class: 'dash-row__alert', text: 'Sin aprobar' }) : null,
          ]),
          warn,
          onOpen,
        }));
      }
    }
    children.push(wrap);
    if (count > items.length) {
      children.push(el('button', {
        class: 'dash-link', type: 'button', text: 'Ver toda la semana',
        onclick: () => { if (onSeeAll) onSeeAll(); },
      }));
    }
  }

  return card({
    title: 'Proximos 7 dias',
    className: 'dash-weekcard',
    headRight: count > 0 ? metaBadge(count) : null,
    children,
  });
}

// ── 5) Atrasados (con Reprogramar) ───────────────────────────────────────────

/** overdueCard({count, items, today, onOpen(item), onReschedule(item), onSeeAll()}) */
export function overdueCard({ count = 0, items = [], today = '', onOpen, onReschedule, onSeeAll }) {
  const children = [
    el('div', { class: 'dash-list' }, items.map((it) => {
      const lateRaw = diffDays(it.publish_date, today);
      const late = Math.max(1, lateRaw == null ? 1 : lateRaw);
      return postRow({
        item: it,
        accent: typeColor(it.content_type),
        sub: el('span', { class: 'dash-row__sub' }, [
          el('span', { class: 'dash-overdue__badge', text: plural(late, 'dia', 'dias') }),
          el('span', { class: 'dash-row__date', text: it.publish_date ? fmtShort(it.publish_date) : '' }),
        ]),
        onOpen,
        trailing: el('button', {
          class: 'dash-resched',
          type: 'button',
          'aria-label': `Reprogramar ${it.title || 'contenido'}`,
          onclick: (e) => { e.stopPropagation(); if (onReschedule) onReschedule(it); },
        }, [icon('calendar', 16), el('span', { text: 'Reprogramar' })]),
      });
    })),
  ];
  if (count > items.length) {
    children.push(el('button', {
      class: 'dash-link', type: 'button',
      text: `Ver los ${count} atrasados`,
      onclick: () => { if (onSeeAll) onSeeAll(); },
    }));
  }
  return card({
    title: 'Atrasados',
    className: 'dash-overduecard',
    headRight: metaBadge(count),
    children,
  });
}

// ── 6) Donut por plataforma (SVG puro + leyenda textual) ─────────────────────

/**
 * donutCard({platforms:[{platform,count,color}] YA normalizadas,
 *            monthLabel, onPlatformTap(nombre)})
 */
export function donutCard({ platforms = [], monthLabel = '', onPlatformTap }) {
  const total = platforms.reduce((a, p) => a + (Number(p.count) || 0), 0);

  if (!total) {
    return card({
      title: 'Plataformas',
      className: 'dash-donutcard',
      children: el('p', {
        class: 'dash-card__empty',
        text: monthLabel ? `Sin publicaciones con fecha en ${monthLabel}.` : 'Sin publicaciones con fecha este mes.',
      }),
    });
  }

  const R = 62;
  const CIRC = 2 * Math.PI * R;
  const ring = svgEl('g', { transform: 'rotate(-90 80 80)' });
  // Fondo sutil por si un redondeo deja un hueco de 1px.
  ring.appendChild(svgEl('circle', {
    cx: 80, cy: 80, r: R, fill: 'none',
    stroke: 'rgba(255,255,255,.06)', 'stroke-width': 20,
  }));
  let acc = 0;
  for (const p of platforms) {
    const len = (p.count / total) * CIRC;
    ring.appendChild(svgEl('circle', {
      cx: 80, cy: 80, r: R, fill: 'none',
      stroke: p.color,
      'stroke-width': 20,
      'stroke-dasharray': `${len} ${CIRC - len}`,
      'stroke-dashoffset': String(-acc),
    }));
    acc += len;
  }

  const num = svgEl('text', { x: 80, y: 78, 'text-anchor': 'middle', class: 'dash-donut__num' });
  num.appendChild(document.createTextNode(String(total)));
  const lbl = svgEl('text', { x: 80, y: 98, 'text-anchor': 'middle', class: 'dash-donut__lbl' });
  lbl.appendChild(document.createTextNode('del mes'));

  const svg = svgEl('svg', {
    viewBox: '0 0 160 160', width: 160, height: 160,
    class: 'dash-donut', role: 'img',
    'aria-label': `Distribucion por plataforma: ${platforms.map((p) => `${p.platform} ${p.count}`).join(', ')}`,
  }, [ring, num, lbl]);

  const pct = (n) => Math.round((n / total) * 100);
  const legend = el('div', { class: 'dash-legend' }, platforms.map((p) =>
    el('button', {
      class: 'dash-legend__row',
      type: 'button',
      onclick: () => { if (onPlatformTap) onPlatformTap(p.platform); },
    }, [
      el('span', { class: 'dash-legend__dot', style: { background: p.color } }),
      el('span', { class: 'dash-legend__label', text: p.platform }),
      el('span', { class: 'dash-legend__count', text: String(p.count) }),
      el('span', { class: 'dash-legend__pct', text: `${pct(p.count)}%` }),
    ])
  ));

  return card({
    title: 'Plataformas',
    className: 'dash-donutcard',
    headRight: monthLabel ? el('span', { class: 'dash-card__meta', text: monthLabel }) : null,
    children: el('div', { class: 'dash-donutcard__body' }, [svg, legend]),
  });
}

// ── 7) Racha de actividad (numero + sparkline 14 dias) ───────────────────────

/** streakCard({streak, days:[{date,count}], onDetails()}) */
export function streakCard({ streak = 0, days = [], onDetails }) {
  const maxC = Math.max(1, ...days.map((d) => Number(d.count) || 0));
  const spark = el('span', { class: 'dash-spark', 'aria-hidden': 'true' }, days.map((d, i) => {
    const c = Number(d.count) || 0;
    const h = c > 0 ? Math.max(18, Math.round((c / maxC) * 100)) : 8;
    return el('span', {
      class: 'dash-spark__bar'
        + (c > 0 ? ' has-val' : '')
        + (i === days.length - 1 ? ' is-today' : ''),
      style: { height: `${h}%` },
    });
  }));

  const copy =
    streak >= 2 ? `Llevan ${streak} dias seguidos creando contenido.` :
    streak === 1 ? 'Llevan 1 dia de actividad. Mañana se vuelve racha.' :
    'Aun sin racha. Crear o editar contenido la enciende.';

  return el('section', { class: 'dash-card dash-streak' }, [
    el('div', { class: 'dash-card__head' }, [
      el('h3', { class: 'dash-card__title', text: 'Racha' }),
    ]),
    el('button', {
      class: 'dash-streak__body',
      type: 'button',
      'aria-label': `Racha de actividad: ${plural(streak, 'dia', 'dias')}. Ver detalle de los ultimos 14 dias`,
      onclick: () => { if (onDetails) onDetails(); },
    }, [
      el('span', { class: 'dash-streak__num' }, [
        el('b', { text: String(streak) }),
        el('span', { text: streak === 1 ? 'dia' : 'dias' }),
      ]),
      spark,
    ]),
    el('p', { class: 'dash-streak__copy', text: copy }),
  ]);
}

// ── 8) Cards por cliente (alcance Agencia) ───────────────────────────────────

/** clientsSection({clients:[{id,name,brand_color,counts}], onOpen(cliente)}) */
export function clientsSection({ clients = [], onOpen }) {
  if (!clients.length) {
    return card({
      title: 'Clientes',
      className: 'dash-clients',
      children: el('p', { class: 'dash-card__empty', text: 'Sin clientes activos.' }),
    });
  }

  const grid = el('div', { class: 'dash-clients__grid' }, clients.map((c) => {
    const counts = c.counts || {};
    const overdue = Number(counts.overdue) || 0;
    const pending = Number(counts.pending) || 0;
    const posts = Number(counts.posts) || 0;
    const week = Number(counts.week) || 0;

    return el('button', {
      class: 'dash-client' + (overdue > 0 ? ' is-urgent' : ''),
      type: 'button',
      'aria-label': `${c.name || 'Cliente'}: ${plural(overdue, 'atrasado', 'atrasados')}, ${pending} por aprobar. Abrir su resumen`,
      onclick: () => { if (onOpen) onOpen(c); },
    }, [
      el('span', { class: 'dash-client__dot', style: { background: safeColor(c.brand_color) } }),
      el('span', { class: 'dash-client__main' }, [
        el('span', { class: 'dash-client__name', text: c.name || 'Cliente' }),
        el('span', {
          class: 'dash-client__meta',
          text: `${plural(posts, 'contenido', 'contenidos')} · ${week} esta semana`,
        }),
        el('span', { class: 'dash-client__badges' }, [
          overdue > 0 ? el('span', { class: 'dash-pill is-danger', text: plural(overdue, 'atrasado', 'atrasados') }) : null,
          pending > 0 ? el('span', { class: 'dash-pill is-warn', text: `${pending} por aprobar` }) : null,
          (overdue === 0 && pending === 0) ? el('span', { class: 'dash-pill is-ok', text: 'Al dia' }) : null,
        ]),
      ]),
      icon('right', 18),
    ]);
  }));

  return card({ title: 'Clientes', className: 'dash-clients', children: grid });
}

// ── Estados transversales ────────────────────────────────────────────────────

/** Skeleton de carga (primera pintura, sin datos). */
export function dashSkeleton() {
  const counters = el('div', { class: 'dash-counters' },
    [0, 1, 2, 3].map(() => el('div', { class: 'dash-counter dash-counter--skel skeleton' })));
  const block = () => el('div', { class: 'dash-card dash-skelblock skeleton skeleton--block' });
  return el('div', { class: 'dash-skel', 'aria-hidden': 'true' }, [counters, block(), block(), block()]);
}

/** Card unica de error con reintento. */
export function errorCard({ message, onRetry }) {
  return el('div', { class: 'dash-error' }, [
    el('div', { class: 'dash-error__icon' }, [icon('warning', 26)]),
    el('h3', { text: 'No se pudo cargar el resumen' }),
    el('p', { class: 'dash-error__msg', text: message || 'Revisa tu conexion e intenta de nuevo.' }),
    el('button', {
      class: 'btn btn-primary', type: 'button', text: 'Reintentar',
      onclick: () => { if (onRetry) onRetry(); },
    }),
  ]);
}

/** Vacio total del cliente: ni un contenido creado. */
export function emptyMonth({ onCreate }) {
  return el('div', { class: 'empty dash-empty' }, [
    el('div', { class: 'empty__icon' }, [icon('spark', 28)]),
    el('h3', { text: 'Todavia no hay contenidos' }),
    el('p', { text: 'Crea el primero y este resumen se llena solo.' }),
    onCreate ? el('button', {
      class: 'btn btn-primary', type: 'button', text: 'Nuevo contenido',
      onclick: () => onCreate(),
    }) : null,
  ]);
}
