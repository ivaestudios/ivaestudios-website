// ============================================================================
// IVAE Marketing v2 — Calendario: utilidades de fecha, selectores puros y
// builders DOM compartidos por mes / semana / agenda / backlog.
//
// - Fechas SIEMPRE en hora local; publish_date viaja como 'YYYY-MM-DD'.
// - La semana empieza en lunes (convencion es-MX de trabajo).
// - Sin estado propio: funciones puras + builders pequenos sin side effects.
// ============================================================================

import { el, statusBadge, chip, STATUSES, CONTENT_TYPES } from '../api.js?v=202606241500';

// ── Fechas ───────────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' en hora LOCAL (no UTC). */
export function fmtYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' (o ISO con hora) -> Date local, o null si no parsea. */
export function parseYMD(s) {
  if (!s) return null;
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayYMD() { return fmtYMD(new Date()); }

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

/** Lunes de la semana que contiene a `d`. */
export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const off = (x.getDay() + 6) % 7; // lun=0 ... dom=6
  x.setDate(x.getDate() - off);
  return x;
}

export function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Matriz del mes: arreglo de semanas (cada una 7 Date) desde el lunes de la
 * semana del dia 1 hasta el domingo de la semana del ultimo dia.
 */
export function monthMatrix(cursor) {
  const first = startOfMonth(cursor);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  let day = startOfWeek(first);
  const weeks = [];
  while (day <= last || weeks.length === 0) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
    if (day > last) break;
  }
  return weeks;
}

// ── Formato es-MX ────────────────────────────────────────────────────────────

export const DOW_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const DOW_MIN = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const FMT_MONTH = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const FMT_MONTH_S = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const FMT_WD = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });

export function cap(s) {
  const t = String(s || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** 'Junio 2026' */
export function monthTitle(d) {
  return `${cap(FMT_MONTH.format(d))} ${d.getFullYear()}`;
}

/** 'Miercoles 10 de junio' (con acentos del locale). */
export function dayLong(d) {
  return `${cap(FMT_WD.format(d))} ${d.getDate()} de ${FMT_MONTH.format(d)}`;
}

/** '10 jun' */
export function dayShort(d) {
  return `${d.getDate()} ${FMT_MONTH_S.format(d).replace('.', '')}`;
}

/** Rango de semana: '9 al 15 de junio 2026' o '29 jun al 5 jul 2026'. */
export function weekTitle(start) {
  const end = addDays(start, 6);
  if (sameMonth(start, end)) {
    return `${start.getDate()} al ${end.getDate()} de ${FMT_MONTH.format(start)} ${end.getFullYear()}`;
  }
  const a = `${start.getDate()} ${FMT_MONTH_S.format(start).replace('.', '')}`;
  const b = `${end.getDate()} ${FMT_MONTH_S.format(end).replace('.', '')}`;
  return `${a} al ${b} ${end.getFullYear()}`;
}

// ── Filtros (espejo de la URL: estado, tipo, persona, desde, hasta, q) ──────

function splitList(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** store.filters (params crudos) -> filtros normalizados del calendario. */
export function parseFilters(raw = {}) {
  return {
    estado: splitList(raw.estado),
    tipo: splitList(raw.tipo),
    persona: String(raw.persona || '').trim(),
    desde: String(raw.desde || '').slice(0, 10),
    hasta: String(raw.hasta || '').slice(0, 10),
    q: String(raw.q || '').trim().toLowerCase(),
  };
}

export function countActiveFilters(f) {
  let n = 0;
  if (f.estado.length) n++;
  if (f.tipo.length) n++;
  if (f.persona) n++;
  if (f.desde || f.hasta) n++;
  return n;
}

/**
 * Aplica filtros en memoria. El rango desde/hasta solo aplica a posts CON
 * fecha: el backlog (sin fecha) no se oculta por rango.
 */
export function applyFilters(posts, f) {
  return (posts || []).filter((p) => {
    if (f.estado.length && !f.estado.includes(p.status)) return false;
    if (f.tipo.length && !f.tipo.includes(p.content_type)) return false;
    if (f.persona && String(p.assignee || '').toLowerCase() !== f.persona.toLowerCase()) return false;
    const day = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
    if (day) {
      if (f.desde && day < f.desde) return false;
      if (f.hasta && day > f.hasta) return false;
    }
    if (f.q) {
      const hit = [p.title, p.caption, p.hook].some((x) => x && String(x).toLowerCase().includes(f.q));
      if (!hit) return false;
    }
    return true;
  });
}

// ── Selectores ───────────────────────────────────────────────────────────────

function byPosition(a, b) {
  const pa = a.position == null ? Number.MAX_SAFE_INTEGER : Number(a.position);
  const pb = b.position == null ? Number.MAX_SAFE_INTEGER : Number(b.position);
  if (pa !== pb) return pa - pb;
  return String(a.title || '').localeCompare(String(b.title || ''), 'es');
}

/** Map 'YYYY-MM-DD' -> posts ordenados por position. */
export function groupByDay(posts) {
  const map = new Map();
  for (const p of posts || []) {
    const day = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
    if (!day) continue;
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(p);
  }
  for (const list of map.values()) list.sort(byPosition);
  return map;
}

/** Posts sin fecha (backlog), ordenados por position. */
export function backlogPosts(posts) {
  return (posts || []).filter((p) => !p.publish_date).slice().sort(byPosition);
}

/**
 * "Ancla de trabajo": el dia 'YYYY-MM-DD' donde esta el contenido del cliente.
 * Es el post programado mas PROXIMO de hoy en adelante; si no hay futuros, el
 * mas reciente; null si no hay posts con fecha. Sirve para abrir el calendario
 * en el MES CON CONTENIDO (no siempre el mes actual). Comparacion lexicografica
 * de 'YYYY-MM-DD' == cronologica.
 */
export function workingAnchor(posts) {
  const today = todayYMD();
  let upcoming = null; let latest = null;
  for (const p of posts || []) {
    const day = p.publish_date ? String(p.publish_date).slice(0, 10) : '';
    if (!day) continue;
    if (!latest || day > latest) latest = day;
    if (day >= today && (!upcoming || day < upcoming)) upcoming = day;
  }
  return upcoming || latest || null;
}

// ── Info de catalogo con fallback seguro ─────────────────────────────────────

export function statusInfo(s) {
  const i = STATUSES && STATUSES[s];
  if (i) return { label: i.label || String(s), color: i.color || '#8b5cf6' };
  return { label: s ? String(s) : 'Sin estado', color: '#6b7280' };
}

export function typeInfo(t) {
  const i = CONTENT_TYPES && CONTENT_TYPES[t];
  if (i) return { label: i.label || String(t), color: i.color || '#8b5cf6' };
  return { label: t ? String(t) : 'Sin tipo', color: '#6b7280' };
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

// ── Builders DOM compartidos ─────────────────────────────────────────────────

/** Punto de color del cliente (modo Todos los clientes). */
export function clientDotEl(client) {
  return el('span', {
    class: 'cal-cdot',
    style: { background: safeColor(client && client.brand_color) },
    title: (client && client.name) || '',
    'aria-hidden': 'true',
  });
}

/**
 * Tarjeta de post (agenda, semana y backlog).
 * onMore(anchorEl) abre el menu contextual (fallback visible del dnd).
 */
export function buildPostCard(ctx, post, { client = null, showDate = false, onMore = null } = {}) {
  const info = statusInfo(post.status);
  const card = el('article', {
    class: 'cal-card',
    dataset: { id: post.id },
    style: { '--card-color': info.color },
  });

  const meta = el('span', { class: 'cal-card__meta' }, [
    post.status ? statusBadge(post.status) : el('span', { class: 'cal-card__nostatus', text: 'Sin estado' }),
    post.content_type ? chip(post.content_type) : null,
    post.platform ? el('span', { class: 'cal-card__plat', text: post.platform }) : null,
    post.assignee ? el('span', { class: 'cal-card__who', text: post.assignee }) : null,
    showDate && post.publish_date
      ? el('span', { class: 'cal-card__date', text: dayShort(parseYMD(post.publish_date) || new Date()) })
      : null,
  ]);

  const main = el('button', {
    class: 'cal-card__main', type: 'button',
    'aria-label': `Abrir ${post.title || 'contenido'}`,
    onclick: () => ctx.openEditor(post.id),
  }, [
    el('span', { class: 'cal-card__title' }, [
      client ? clientDotEl(client) : null,
      el('span', { class: 'cal-card__titletxt', text: post.title || 'Sin titulo' }),
    ]),
    meta,
  ]);

  card.appendChild(main);
  if (onMore) {
    const more = el('button', {
      class: 'cal-card__more', type: 'button', 'aria-label': 'Opciones del contenido',
      onclick: (e) => { e.stopPropagation(); onMore(more); },
    }, [ctx.icons('dots', 18)]);
    card.appendChild(more);
  }
  return card;
}
