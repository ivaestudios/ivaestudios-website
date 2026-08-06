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
} from '../api.js?v=202608060318';
import { icon } from '../shell/icons.js?v=202608060318';
import { T } from '../shell/i18n.js?v=202608060318';
import { fmtShort, diffDays, parseISO, DIAS_CORTOS } from '../lib/dates.js?v=202608060318';

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
export function normalizePlatforms(rows, { base = [] } = {}) {
  const canon = new Map(PLATFORMS.map((p) => [p.toLowerCase(), p]));
  const acc = new Map();
  for (const b of base) acc.set(b, 0); // siembra plataformas base (siempre visibles, como el diseño)
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
    .filter((x) => x.count > 0 || base.includes(x.platform))
    .sort((a, b) => b.count - a.count);
}

// ── 1) Contadores 2x2 (drill-down universal) ─────────────────────────────────

/** Pildora de tendencia: deltaPill({dir:'up'|'down'|'flat', pct}). Reutilizable. */
export function deltaPill({ dir = 'flat', pct = 0 } = {}) {
  const sym = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '=';
  return el('span', { class: `delta is-${dir}`, text: `${sym} ${Math.abs(Math.round(pct))}%` });
}

function counterCard({ key, value, label, sub, tone, withCheck, delta, onTap }) {
  const valueWrap = el('span', { class: 'dash-counter__value' }, [
    withCheck ? icon('check', 22) : null,
    el('b', { text: String(value) }),
    delta ? deltaPill(delta) : null,
  ]);
  return el('button', {
    class: 'dash-counter' + (tone ? ` is-${tone}` : ''),
    type: 'button',
    dataset: { counter: key },
    'aria-label': `${label}: ${value}${sub ? `, ${sub}` : ''}. ${T('Ver detalle', 'View details')}`,
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
export function countersGrid({ counters = {}, weekRange = '', typeBreakdown = '', monthDelta = null, onJump }) {
  const pending = Number(counters.pending) || 0;
  const week = Number(counters.week) || 0;
  const overdue = Number(counters.overdue) || 0;
  const monthTotal = Number(counters.monthTotal) || 0;
  const noDate = Number(counters.noDate) || 0;

  return el('div', { class: 'dash-counters' }, [
    counterCard({
      key: 'aprobar', value: pending, label: T('Por aprobar', 'To approve'),
      sub: pending > 0 ? T('requieren tu revisión', 'need your review') : T('nada por revisar', 'nothing to review'),
      tone: pending > 0 ? 'warn' : '', onTap: onJump,
    }),
    counterCard({
      key: 'semana', value: week, label: T('Esta semana', 'This week'),
      sub: weekRange ? `${T('programados', 'scheduled')} · ${weekRange}` : T('programados', 'scheduled'),
      tone: 'brand', onTap: onJump,
    }),
    counterCard({
      key: 'atrasados', value: overdue, label: T('Atrasados', 'Overdue'),
      tone: overdue > 0 ? 'danger' : 'ok',
      sub: overdue === 0 ? T('Al dia', 'Up to date') : '',
      onTap: onJump,
    }),
    counterCard({
      key: 'mes', value: monthTotal, label: T('Posts del mes', 'Posts this month'),
      sub: typeBreakdown
        || (noDate > 0 ? `${T('y', 'plus')} ${plural(noDate, T('idea sin fecha', 'idea without a date'), T('ideas sin fecha', 'ideas without a date'))}` : ''),
      delta: monthDelta,
      onTap: onJump,
    }),
  ]);
}

// ── 2) Pipeline (5 etapas del diseño + barra de progreso por fila) ──────────

// El modelo interno tiene 8 estados; el cliente ve 5 etapas (las 4 de
// produccion se agrupan en "Borrador"), igual que el diseño Sistema IVA.
const PIPELINE_BUCKETS = [
  { key: 'borrador',   label: T('Borrador', 'Draft'),        color: STATUSES.edicion.color,    members: ['idea', 'guion', 'grabacion', 'edicion'] },
  { key: 'revision',   label: T('Revisión', 'Review'),       color: STATUSES.revision.color,   members: ['revision'] },
  { key: 'aprobado',   label: T('Aprobado', 'Approved'),     color: STATUSES.aprobado.color,   members: ['aprobado'] },
  { key: 'programado', label: T('Programado', 'Scheduled'),  color: STATUSES.programado.color, members: ['programado'] },
  { key: 'publicado',  label: T('Publicado', 'Published'),   color: STATUSES.publicado.color,  members: ['publicado'] },
];

function pipelineData(pipeline) {
  const counts = new Map();
  for (const r of pipeline || []) {
    const k = String((r && r.status) || '');
    counts.set(k, (counts.get(k) || 0) + (Number(r && r.count) || 0));
  }
  const rows = PIPELINE_BUCKETS.map((b) => ({
    key: b.key, label: b.label, color: b.color,
    count: b.members.reduce((a, s) => a + (counts.get(s) || 0), 0),
  }));
  const total = rows.reduce((a, x) => a + x.count, 0);
  return { rows, total };
}

/** pipelineCard({pipeline:[{status,count}], onStatusTap(key)}) */
export function pipelineCard({ pipeline, onStatusTap }) {
  const { rows, total } = pipelineData(pipeline);

  if (!total) {
    return card({
      title: 'Pipeline',
      className: 'dash-pipeline',
      children: el('p', { class: 'dash-card__empty', text: T('Sin contenidos en el pipeline.', 'No content in the pipeline.') }),
    });
  }

  const tap = (key) => { if (onStatusTap) onStatusTap(key); };

  // Barra apilada superior (solo segmentos con contenido).
  const segs = rows.filter((s) => s.count > 0);
  const bar = el('div', { class: 'dash-battery', 'aria-label': `Pipeline, ${total} ${T('contenidos', 'items')}` }, segs.map((s) =>
    el('button', {
      class: 'dash-battery__seg',
      type: 'button',
      style: { flexGrow: String(s.count) },
      'aria-label': `${s.label}: ${s.count}`,
      onclick: () => tap(s.key),
    }, [el('span', { class: 'dash-battery__fill', style: { background: s.color } })])
  ));

  // Leyenda: SIEMPRE las 5 etapas, cada una con su mini-barra de progreso +
  // conteo (sin "Ver todos", como el diseño Sistema IVA).
  const pipe = el('div', { class: 'dash-pipe' }, rows.map((s) => {
    const w = total ? Math.round((s.count / total) * 100) : 0;
    return el('button', {
      class: 'dash-pipe__row' + (s.count === 0 ? ' is-zero' : ''),
      type: 'button',
      'aria-label': `${s.label}: ${s.count}`,
      onclick: () => tap(s.key),
    }, [
      el('span', { class: 'dash-pipe__dot', style: { background: s.color } }),
      el('span', { class: 'dash-pipe__label', text: s.label }),
      el('span', { class: 'dash-pipe__track' }, [
        el('span', { class: 'dash-pipe__fill', style: { width: `${w}%`, background: s.color } }),
      ]),
      el('span', { class: 'dash-pipe__count', text: String(s.count) }),
    ]);
  }));

  return card({
    title: 'Pipeline',
    className: 'dash-pipeline',
    headRight: el('span', { class: 'dash-card__meta', text: `${total} ${T('en total', 'total')}` }),
    children: [bar, pipe],
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
      el('span', { class: 'dash-row__title', text: item.title || T('Sin titulo', 'Untitled') }),
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
    children.push(el('p', { class: 'dash-card__empty', text: T('Nada espera aprobacion del cliente.', 'Nothing awaiting client approval.') }));
  } else {
    children.push(el('div', { class: 'dash-list' }, items.map((it) => postRow({
      item: it,
      accent: typeColor(it.content_type),
      sub: el('span', { class: 'dash-row__sub' }, [
        el('span', { class: 'dash-row__date', text: it.publish_date ? fmtShort(it.publish_date) : T('Sin fecha', 'No date') }),
      ]),
      right: approvalBadge(it.approval_state || 'pending'),
      onOpen,
    }))));
    if (count > items.length) {
      children.push(el('button', {
        class: 'dash-link', type: 'button',
        text: `${T('Ver los', 'View all')} ${count} ${T('pendientes', 'pending')}`,
        onclick: () => { if (onSeeAll) onSeeAll(); },
      }));
    }
  }
  return card({
    title: T('Por aprobar', 'To approve'),
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
      el('p', { class: 'dash-card__empty', text: T('Semana libre de publicaciones.', 'No posts scheduled this week.') }),
      onCreate ? el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', text: T('Nuevo contenido', 'New content'),
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
        isHoy ? el('span', { class: 'dash-day__tag', text: T('Hoy', 'Today') }) : null,
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
            warn ? el('span', { class: 'dash-row__alert', text: T('Sin aprobar', 'Not approved') }) : null,
          ]),
          warn,
          onOpen,
        }));
      }
    }
    children.push(wrap);
    if (count > items.length) {
      children.push(el('button', {
        class: 'dash-link', type: 'button', text: T('Ver toda la semana', 'View the whole week'),
        onclick: () => { if (onSeeAll) onSeeAll(); },
      }));
    }
  }

  return card({
    title: T('Proximos 7 dias', 'Next 7 days'),
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
          el('span', { class: 'dash-overdue__badge', text: plural(late, T('dia', 'day'), T('dias', 'days')) }),
          el('span', { class: 'dash-row__date', text: it.publish_date ? fmtShort(it.publish_date) : '' }),
        ]),
        onOpen,
        trailing: el('button', {
          class: 'dash-resched',
          type: 'button',
          'aria-label': `${T('Reprogramar', 'Reschedule')} ${it.title || T('contenido', 'content')}`,
          onclick: (e) => { e.stopPropagation(); if (onReschedule) onReschedule(it); },
        }, [icon('calendar', 16), el('span', { text: T('Reprogramar', 'Reschedule') })]),
      });
    })),
  ];
  if (count > items.length) {
    children.push(el('button', {
      class: 'dash-link', type: 'button',
      text: `${T('Ver los', 'View all')} ${count} ${T('atrasados', 'overdue')}`,
      onclick: () => { if (onSeeAll) onSeeAll(); },
    }));
  }
  return card({
    title: T('Atrasados', 'Overdue'),
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
      title: T('Plataformas', 'Platforms'),
      className: 'dash-donutcard',
      children: el('p', {
        class: 'dash-card__empty',
        text: monthLabel ? `${T('Sin publicaciones con fecha en', 'No dated posts in')} ${monthLabel}.` : T('Sin publicaciones con fecha este mes.', 'No dated posts this month.'),
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
  lbl.appendChild(document.createTextNode(T('del mes', 'this month')));

  const svg = svgEl('svg', {
    viewBox: '0 0 160 160', width: 160, height: 160,
    class: 'dash-donut', role: 'img',
    'aria-label': `${T('Distribucion por plataforma', 'Breakdown by platform')}: ${platforms.map((p) => `${p.platform} ${p.count}`).join(', ')}`,
  }, [ring, num, lbl]);

  const pct = (n) => Math.round((n / total) * 100);
  const top = platforms.reduce((m, p) => (p.count > (m ? m.count : -1) ? p : m), null);

  const hero = el('div', { class: 'dash-plat__hero' }, [
    el('b', { class: 'dash-plat__total', text: String(total) }),
    el('span', {
      class: 'dash-plat__cap',
      text: top && top.count > 0 ? `${T('publicaciones', 'posts')} · ${top.platform} ${T('lidera', 'leads')}` : T('publicaciones del mes', 'posts this month'),
    }),
  ]);

  // Barras horizontales por plataforma: densas, llenan el alto de la card.
  const bars = el('div', { class: 'dash-plat__bars' }, platforms.map((p) =>
    el('button', {
      class: 'dash-plat__row',
      type: 'button',
      'aria-label': `${p.platform}: ${p.count} (${pct(p.count)}%)`,
      onclick: () => { if (onPlatformTap) onPlatformTap(p.platform); },
    }, [
      el('span', { class: 'dash-plat__name' }, [
        el('span', { class: 'dash-plat__dot', style: { background: p.color } }),
        el('span', { text: p.platform }),
      ]),
      el('span', { class: 'dash-plat__track' }, [
        el('i', { style: { width: `${pct(p.count)}%`, background: p.color } }),
      ]),
      el('span', { class: 'dash-plat__val' }, [
        el('b', { text: String(p.count) }),
        el('small', { text: `${pct(p.count)}%` }),
      ]),
    ])
  ));

  return card({
    title: T('Plataformas', 'Platforms'),
    className: 'dash-donutcard',
    headRight: monthLabel ? el('span', { class: 'dash-card__meta', text: monthLabel }) : null,
    children: el('div', { class: 'dash-donutcard__body' }, [
      svg,
      el('div', { class: 'dash-plat__main' }, [hero, bars]),
    ]),
  });
}

// ── 7) Racha de actividad (numero + sparkline 14 dias) ───────────────────────

/** streakCard({streak, days:[{date,count}], onDetails()}) */
export function streakCard({ streak = 0, days = [], onDetails }) {
  const counts = days.map((d) => Number(d.count) || 0);
  const maxC = Math.max(1, ...counts);
  const total14 = counts.reduce((a, c) => a + c, 0);
  // Mejor racha historica: la corrida mas larga de dias consecutivos con actividad.
  let best = 0, run = 0;
  for (const c of counts) { if (c > 0) { run += 1; if (run > best) best = run; } else run = 0; }
  // Meta semanal: dias con actividad en los ultimos 7.
  const weekDone = counts.slice(-7).filter((c) => c > 0).length;
  const weekGoal = 5;
  const weekPct = Math.min(100, Math.round((weekDone / weekGoal) * 100));

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
    streak >= 2 ? T(`Llevan ${streak} dias seguidos creando contenido.`, `${streak} days in a row creating content.`) :
    streak === 1 ? T('Llevan 1 dia de actividad. Mañana se vuelve racha.', '1 day of activity. Tomorrow it becomes a streak.') :
    T('Aun sin racha. Crear o editar contenido la enciende.', 'No streak yet. Creating or editing content starts one.');

  const mini = (k, v, extra) => el('div', { class: 'dash-mini' }, [
    el('span', { class: 'dash-mini__k', text: k }),
    el('span', { class: 'dash-mini__v', text: String(v) }),
    extra || null,
  ]);

  return el('section', { class: 'dash-card dash-streak' }, [
    el('div', { class: 'dash-card__head' }, [
      el('h3', { class: 'dash-card__title', text: T('Racha', 'Streak') }),
    ]),
    el('button', {
      class: 'dash-streak__body',
      type: 'button',
      'aria-label': `${T('Racha de actividad', 'Activity streak')}: ${plural(streak, T('dia', 'day'), T('dias', 'days'))}. ${T('Meta semanal', 'Weekly goal')} ${weekDone} ${T('de', 'of')} ${weekGoal}. ${T('Ver detalle de los ultimos 14 dias', 'View details for the last 14 days')}`,
      onclick: () => { if (onDetails) onDetails(); },
    }, [
      el('div', { class: 'dash-streak__left' }, [
        el('span', { class: 'dash-streak__num' }, [
          el('b', { text: String(streak) }),
          el('span', { text: streak === 1 ? T('dia', 'day') : T('dias', 'days') }),
        ]),
        spark,
      ]),
      el('div', { class: 'dash-streak__stats' }, [
        mini(T('Meta semanal', 'Weekly goal'), `${weekDone}/${weekGoal}`,
          el('span', { class: 'dash-mini__bar' }, [el('i', { style: { width: `${weekPct}%` } })])),
        mini(T('Mejor racha', 'Best streak'), plural(best, T('dia', 'day'), T('dias', 'days'))),
        mini(T('Acciones 14d', 'Actions 14d'), total14),
      ]),
    ]),
    el('p', { class: 'dash-streak__copy', text: copy }),
  ]);
}

// ── 8) Cards por cliente (alcance Agencia) ───────────────────────────────────

/** clientsSection({clients:[{id,name,brand_color,counts}], onOpen(cliente)}) */
export function clientsSection({ clients = [], onOpen }) {
  if (!clients.length) {
    return card({
      title: T('Clientes', 'Clients'),
      className: 'dash-clients',
      children: el('p', { class: 'dash-card__empty', text: T('Sin clientes activos.', 'No active clients.') }),
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
      'aria-label': `${c.name || T('Cliente', 'Client')}: ${plural(overdue, T('atrasado', 'overdue'), T('atrasados', 'overdue'))}, ${pending} ${T('por aprobar', 'to approve')}. ${T('Abrir su resumen', 'Open their summary')}`,
      onclick: () => { if (onOpen) onOpen(c); },
    }, [
      el('span', { class: 'dash-client__dot', style: { background: safeColor(c.brand_color) } }),
      el('span', { class: 'dash-client__main' }, [
        el('span', { class: 'dash-client__name', text: c.name || T('Cliente', 'Client') }),
        el('span', {
          class: 'dash-client__meta',
          text: `${plural(posts, T('contenido', 'piece'), T('contenidos', 'pieces'))} · ${week} ${T('esta semana', 'this week')}`,
        }),
        el('span', { class: 'dash-client__badges' }, [
          overdue > 0 ? el('span', { class: 'dash-pill is-danger', text: plural(overdue, T('atrasado', 'overdue'), T('atrasados', 'overdue')) }) : null,
          pending > 0 ? el('span', { class: 'dash-pill is-warn', text: `${pending} ${T('por aprobar', 'to approve')}` }) : null,
          (overdue === 0 && pending === 0) ? el('span', { class: 'dash-pill is-ok', text: T('Al dia', 'Up to date') }) : null,
        ]),
      ]),
      icon('right', 18),
    ]);
  }));

  return card({ title: T('Clientes', 'Clients'), className: 'dash-clients', children: grid });
}

// ── 9) Almacenamiento en R2 (alcance Agencia, SOLO equipo) ──────────────────

// Colores del desglose. Fijos a proposito (igual que STATUSES/PLATFORMS): son
// rellenos de barra, se leen bien en tema oscuro y claro.
const STO_COLORS = {
  marketing: '#e24da0', // magenta de marca
  gallery:   '#9d5be0', // violeta de marca
  careers:   '#38bdf8', // azul (CV de vacantes: tercera app del bucket)
  other:     '#64748b', // gris
};

/**
 * Bytes a texto legible. OJO: base 1000, NO 1024 — Cloudflare factura y muestra
 * R2 en GB decimales, asi que 1 GB = 1,000,000,000 bytes. Usar 1024 daria un
 * numero mas chico que el del recibo.
 */
export function fmtBytes(n) {
  const b = Number(n) || 0;
  // Los cortes miran el valor YA redondeado: con `>= 1e6` a secas, 999,999,999 B
  // caia en MB y se pintaba "1000 MB" en vez de "1.0 GB".
  if (b >= 999.95e6) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 999.5e3) return `${Math.round(b / 1e6)} MB`;
  if (b >= 999.5) return `${Math.round(b / 1e3)} KB`;
  return `${b} B`;
}

/** "hace un momento" / "hace 3 h" / "hace 2 dias" a partir de un ISO. */
function agoLabel(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 2) return T('medido hace un momento', 'measured just now');
  if (min < 60) return `${T('medido hace', 'measured')} ${min} min${T('', ' ago')}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${T('medido hace', 'measured')} ${h} h${T('', ' ago')}`;
  const d = Math.floor(h / 24);
  return d === 1
    ? T('medido ayer', 'measured yesterday')
    : `${T('medido hace', 'measured')} ${d} ${T('dias', 'days ago')}`;
}

/**
 * storageCard({ storage, loading, error, onRefresh })
 *
 * `storage` es el payload de GET /storage tal cual. NO se inventa ningun tope:
 * R2 cobra por uso y no tiene limite duro, asi que la barra reparte el 100% del
 * espacio usado entre marketing / galeria / otros (composicion, no medidor).
 * La unica referencia real que se cita es la cuota gratis mensual de R2, que
 * viaja en el propio payload (pricing.free_gb_per_month).
 */
export function storageCard({ storage = null, loading = false, error = '', onRefresh } = {}) {
  const head = el('span', { class: 'dash-card__meta', text: T('Cloudflare R2', 'Cloudflare R2') });

  if (loading && !storage) {
    return card({
      title: T('Almacenamiento', 'Storage'),
      className: 'dash-storage',
      headRight: head,
      // aria-hidden como el resto de los esqueletos del panel: un div sin rol no
      // anuncia su aria-label, asi que el label solo era ruido muerto.
      children: el('div', { class: 'dash-sto__skel skeleton', 'aria-hidden': 'true' }),
    });
  }

  if (!storage) {
    return card({
      title: T('Almacenamiento', 'Storage'),
      className: 'dash-storage',
      headRight: head,
      children: [
        el('p', {
          class: 'dash-card__empty',
          text: error || T('No se pudo medir el almacenamiento.', "Couldn't measure storage."),
        }),
        onRefresh ? el('button', {
          class: 'dash-link', type: 'button', text: T('Volver a medir', 'Measure again'),
          onclick: () => onRefresh(),
        }) : null,
      ],
    });
  }

  const total = storage.total || { bytes: 0, objects: 0 };
  const mkt = storage.marketing || { bytes: 0, objects: 0, videos: 0 };
  const gal = storage.gallery || { bytes: 0, objects: 0 };
  const car = storage.careers || { bytes: 0, objects: 0 };
  const oth = storage.other || { bytes: 0, objects: 0 };
  const price = storage.pricing || {};
  const totalBytes = Number(total.bytes) || 0;
  // partial = algun recorrido se corto. El server ya junta los dos pasos aqui.
  const partial = !!total.partial || !!mkt.partial;

  const rows = [
    // La etiqueta nombra TODO lo que entra en el rubro: 'backups/' (el respaldo
    // diario de la base) tambien cuenta como marketing y crece solo.
    { key: 'marketing', label: T('Marketing (videos, entregables y respaldos)', 'Marketing (videos, deliverables and backups)'), bytes: Number(mkt.bytes) || 0 },
    { key: 'gallery', label: T('Galeria de fotos', 'Photo gallery'), bytes: Number(gal.bytes) || 0 },
    { key: 'careers', label: T('Vacantes (CV recibidos)', 'Careers (received CVs)'), bytes: Number(car.bytes) || 0 },
    { key: 'other', label: T('Otros archivos', 'Other files'), bytes: Number(oth.bytes) || 0 },
  ].filter((r) => r.bytes > 0);

  // Con medicion parcial los porcentajes mentirian: las filas son un piso y el
  // total otro, asi que no suman 100. En ese caso se pintan solo los GB.
  const pct = (b) => (totalBytes > 0 ? Math.round((b / totalBytes) * 100) : 0);
  const legend = rows.map((r) => `${r.label} ${fmtBytes(r.bytes)}`).join(', ');

  // Barra apilada: reparte el total usado. Es un DIV (no navega a ningun lado),
  // con la lectura completa en aria-label y la leyenda SIEMPRE visible debajo.
  const bar = el('div', {
    class: 'dash-sto__bar', role: 'img',
    'aria-label': `${T('Almacenamiento en uso', 'Storage in use')}: ${fmtBytes(totalBytes)}. ${legend}`,
  }, rows.length
    ? rows.map((r) => el('span', {
      class: 'dash-sto__seg',
      style: { flexGrow: String(Math.max(1, r.bytes)), background: STO_COLORS[r.key] },
    }))
    : [el('span', { class: 'dash-sto__seg is-empty', style: { flexGrow: '1' } })]);

  const list = el('div', { class: 'dash-sto__rows' }, rows.map((r) => el('div', { class: 'dash-sto__row' }, [
    el('span', { class: 'dash-sto__dot', style: { background: STO_COLORS[r.key] } }),
    el('span', { class: 'dash-sto__label', text: r.label }),
    el('span', { class: 'dash-sto__track' }, [
      el('i', { style: { width: `${Math.max(2, pct(r.bytes))}%`, background: STO_COLORS[r.key] } }),
    ]),
    el('span', { class: 'dash-sto__val' }, [
      el('b', { text: fmtBytes(r.bytes) }),
      // "<1%" en vez de "0%": un rubro que existe y pesa nunca vale cero.
      partial ? null : el('small', { text: pct(r.bytes) < 1 ? '<1%' : `${pct(r.bytes)}%` }),
    ]),
  ])));

  // Contexto util y verificable: cuantos videos hay y cuanto cuesta al mes.
  // Con medicion parcial el server manda cost_usd = null y aqui NO se estima.
  const facts = [];
  const nVid = Number(mkt.videos) || 0;
  if (nVid > 0) {
    facts.push(`${plural(nVid, T('video', 'video'), T('videos', 'videos'))} ${T('de marketing', 'in marketing')} · ${fmtBytes(mkt.video_bytes)}`);
  }
  const freeGb = Number(price.free_gb_per_month) || 0;
  const costUsd = price.cost_usd;
  if (typeof costUsd === 'number') {
    // La decision se toma por BYTES, nunca por el precio: redondeado a centavos,
    // todo lo facturable por debajo de 0.334 GB daba $0 y el panel anunciaba
    // "sin costo" con el bucket ya pasado de los 10 GB.
    // Ojo con la palabra "gratis": la cuota es de TODA la cuenta y aqui solo se
    // mide este bucket, por eso la frase no promete que la factura sea $0.
    const fitsFree = freeGb > 0 && totalBytes <= freeGb * 1e9;
    if (fitsFree) {
      facts.push(T(
        `cabe en los ${freeGb} GB gratis de la cuenta`,
        `fits within the account's free ${freeGb} GB`,
      ));
    } else if (costUsd > 0 && costUsd < 0.01) {
      // Menos de un centavo: decirlo asi es honesto; "$0.00" no lo seria.
      facts.push(T('costo estimado menos de $0.01 USD al mes', 'estimated cost under $0.01 USD a month'));
    } else {
      // "si el tamaño no cambia": R2 factura el promedio GB-mes, no la foto de
      // hoy. Subir y borrar un video en 3 dias no cuesta el mes completo.
      facts.push(`${T('costo estimado', 'estimated cost')} $${costUsd.toFixed(2)} USD ${T('al mes si el tamaño no cambia', 'a month if the size stays the same')}`);
    }
  }

  const children = [
    el('div', { class: 'dash-sto__hero' }, [
      el('b', { class: 'dash-sto__total', text: `${partial ? '+' : ''}${fmtBytes(totalBytes)}` }),
      el('span', {
        class: 'dash-sto__cap',
        // "en la nube" sonaba a TODO lo que hay en Cloudflare; esto es UN bucket
        // (la cuenta tiene otros que no se miden aqui).
        text: partial
          ? T('en el bucket de fotos y videos (medicion parcial: es al menos esto)', 'in the photo and video bucket (partial measurement: at least this much)')
          : T('en uso en el bucket de fotos y videos', 'in use in the photo and video bucket'),
      }),
    ]),
    bar,
    list,
  ];

  if (facts.length) children.push(el('p', { class: 'dash-sto__facts', text: facts.join(' · ') }));

  if (freeGb > 0 && Number(price.price_per_gb_usd) > 0) {
    // Referencia REAL (no un tope inventado): R2 cobra por uso, con una cuota
    // gratis mensual POR CUENTA. Se dice que la cuota es de la cuenta y que
    // aqui solo se mide un bucket, para que "gratis" no se lea como "la factura
    // es $0": la cuenta tiene otros buckets que tambien consumen esa cuota.
    children.push(el('p', {
      class: 'dash-sto__note',
      text: T(
        `R2 no tiene limite: los primeros ${freeGb} GB de cada mes son gratis en toda la cuenta (aqui solo se mide este bucket) y arriba de eso cuesta $${price.price_per_gb_usd} USD por GB al mes.`,
        `R2 has no hard cap: the first ${freeGb} GB each month are free across the whole account (only this bucket is measured here); above that it costs $${price.price_per_gb_usd} USD per GB-month.`,
      ),
    }));
  }

  children.push(el('div', { class: 'dash-sto__foot' }, [
    el('span', { class: 'dash-sto__when', text: agoLabel(storage.measured_at) + (storage.stale ? ` · ${T('dato guardado', 'saved value')}` : '') }),
    onRefresh ? el('button', {
      class: 'dash-link dash-sto__again', type: 'button',
      text: loading ? T('Midiendo...', 'Measuring...') : T('Volver a medir', 'Measure again'),
      disabled: loading || undefined,
      onclick: () => onRefresh(),
    }) : null,
  ]));

  return card({
    title: T('Almacenamiento', 'Storage'),
    className: 'dash-storage',
    headRight: head,
    children,
  });
}

// ── Estados transversales ────────────────────────────────────────────────────

/** Skeleton de carga (primera pintura, sin datos). */
export function dashSkeleton() {
  const counters = el('div', { class: 'dash-counters' },
    [0, 1, 2, 3].map(() => el('div', { class: 'dash-counter dash-counter--skel skeleton' })));
  const block = () => el('div', { class: 'dash-card dash-skelblock skeleton skeleton--block' });
  return el('div', { class: 'dash-skel', 'aria-hidden': 'true' }, [counters, block(), block(), block()]);
}

/**
 * Card unica de error con reintento.
 * Vive en ui/states.js (la comparten Calendario y Entregables, que no cargan
 * este modulo); se re-exporta aqui para no tocar a views/dashboard.js.
 */
export { errorCard } from '../ui/states.js?v=202608060318';

/** Vacio total del cliente: ni un contenido creado. */
export function emptyMonth({ onCreate }) {
  return el('div', { class: 'empty dash-empty' }, [
    el('div', { class: 'empty__icon' }, [icon('spark', 28)]),
    el('h3', { text: T('Todavia no hay contenidos', 'No content yet') }),
    el('p', { text: T('Crea el primero y este resumen se llena solo.', 'Create the first one and this summary fills itself in.') }),
    onCreate ? el('button', {
      class: 'btn btn-primary', type: 'button', text: T('Nuevo contenido', 'New content'),
      onclick: () => onCreate(),
    }) : null,
  ]);
}
