// ============================================================================
// IVAE Marketing v2 - Helpers de fechas (es-MX, semana inicia LUNES).
//
// Modulo PURO: sin DOM, sin red, sin store. Lo consumen calendario, timeline,
// carga (workload), dashboard y los services (bulk shift, stats).
//
// Convenciones:
// - La fecha canonica de la app es el string ISO corto 'YYYY-MM-DD'
//   (posts.publish_date). parseISO() acepta tambien ISO con hora y Date.
// - Todo se calcula en hora LOCAL (la agencia agenda en su zona, no en UTC):
//   parsear 'YYYY-MM-DD' con new Date(y, m-1, d) evita el corrimiento UTC.
// - Los textos visibles llevan acentos correctos en es-MX (consistente con
//   el calendario, que usa Intl es-MX) y van sin em-dashes.
// ============================================================================

import { T } from '../shell/i18n.js?v=202607221913';

export const MESES = T([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
], [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

export const MESES_CORTOS = T([
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
], [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

// Indice 0 = lunes (la semana de la app inicia en lunes).
export const DIAS = T([
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
], [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]);
export const DIAS_CORTOS = T(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
export const DIAS_INICIAL = T(['L', 'M', 'M', 'J', 'V', 'S', 'D'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_DAY = 86400000;

export function pad2(n) {
  return String(Math.abs(Math.trunc(n))).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD' (hora local). Devuelve '' si no es una fecha valida. */
export function toISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 'YYYY-MM-DD' | ISO con hora | Date -> Date a medianoche LOCAL.
 * Devuelve null si no se puede interpretar.
 */
export function parseISO(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = ISO_RE.exec(String(value || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Rechaza fechas imposibles tipo 2026-02-31 (JS las "arregla" solo).
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidISO(value) {
  return parseISO(value) !== null;
}

export function todayISO() {
  return toISO(new Date());
}

/** Suma dias a un Date (devuelve Date nuevo, no muta). */
export function addDays(date, n) {
  const d = parseISO(date);
  if (!d) return null;
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

/** Suma dias a un ISO corto. '' si la entrada es invalida. */
export function addDaysISO(iso, n) {
  const d = addDays(iso, n);
  return d ? toISO(d) : '';
}

/** Suma meses (con clamp de fin de mes: 31 ene + 1 mes = 28/29 feb). */
export function addMonths(date, n) {
  const d = parseISO(date);
  if (!d) return null;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(n || 0));
  const last = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(day, last));
  return d;
}

export function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

/**
 * Dias de a -> b (b - a). Positivo si b es despues. Math.round absorbe los
 * saltos de horario de verano (dias de 23/25 horas).
 */
export function diffDays(aIso, bIso) {
  const a = parseISO(aIso);
  const b = parseISO(bIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

export function sameDay(a, b) {
  const da = parseISO(a);
  const db = parseISO(b);
  return !!(da && db && da.getTime() === db.getTime());
}

export function sameMonth(a, b) {
  const da = parseISO(a);
  const db = parseISO(b);
  return !!(da && db && da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth());
}

export function isToday(iso) {
  return sameDay(iso, new Date());
}

/** Estrictamente ANTES de hoy (para "vencidos"). */
export function isPast(iso) {
  const d = diffDays(todayISO(), iso);
  return d !== null && d < 0;
}

export function isFuture(iso) {
  const d = diffDays(todayISO(), iso);
  return d !== null && d > 0;
}

/** Lunes de la semana de `date` (Date nuevo, medianoche local). */
export function startOfWeek(date) {
  const d = parseISO(date);
  if (!d) return null;
  const dow = (d.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  d.setDate(d.getDate() - dow);
  return d;
}

/** Domingo de la semana de `date`. */
export function endOfWeek(date) {
  const start = startOfWeek(date);
  return start ? addDays(start, 6) : null;
}

/** {desde, hasta} ISO de la semana (lunes a domingo) que contiene `date`. */
export function weekRangeISO(date) {
  const start = startOfWeek(date);
  if (!start) return null;
  return { desde: toISO(start), hasta: toISO(addDays(start, 6)) };
}

export function startOfMonth(date) {
  const d = parseISO(date);
  return d ? new Date(d.getFullYear(), d.getMonth(), 1) : null;
}

export function endOfMonth(date) {
  const d = parseISO(date);
  return d ? new Date(d.getFullYear(), d.getMonth() + 1, 0) : null;
}

export function monthRangeISO(date) {
  const a = startOfMonth(date);
  const b = endOfMonth(date);
  return a && b ? { desde: toISO(a), hasta: toISO(b) } : null;
}

/** Lista inclusiva de ISO entre desde y hasta. [] si el rango es invalido. */
export function listDays(desdeIso, hastaIso) {
  const a = parseISO(desdeIso);
  const b = parseISO(hastaIso);
  if (!a || !b || a.getTime() > b.getTime()) return [];
  const out = [];
  const cur = new Date(a.getTime());
  while (cur.getTime() <= b.getTime()) {
    out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Cuadricula mensual de 6 semanas (42 celdas) iniciando en lunes.
 * Cada celda: { date, iso, inMonth, isToday }.
 */
export function monthGrid(year, month0) {
  const first = new Date(year, month0, 1);
  const start = startOfWeek(first);
  const hoy = todayISO();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    const iso = toISO(date);
    cells.push({
      date,
      iso,
      inMonth: date.getMonth() === month0,
      isToday: iso === hoy,
    });
  }
  return cells;
}

/** Numero de semana ISO-8601: { year, week }. */
export function isoWeek(date) {
  const d = parseISO(date);
  if (!d) return null;
  // Algoritmo ISO: la semana 1 contiene el primer jueves del anio.
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow + 3); // jueves de esta semana
  const year = t.getFullYear();
  const firstThu = new Date(year, 0, 4);
  const fdow = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - fdow + 3);
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * MS_DAY));
  return { year, week };
}

// ── Formatos visibles (es-MX, con acentos) ───────────────────────────────────

/** '5 jun' (agrega el anio si no es el actual: '5 jun 2027'). */
export function fmtShort(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  const base = `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** '5 jun 2026' (siempre con anio). */
export function fmtMedium(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'Jueves 5 de junio'. */
export function fmtLong(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  const dia = DIAS[(d.getDay() + 6) % 7];
  const out = `${dia} ${d.getDate()}${T(' de ', ' ')}${MESES[d.getMonth()]}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** 'Junio 2026'. */
export function fmtMonthYear(date) {
  const d = parseISO(date);
  if (!d) return '';
  const mes = MESES[d.getMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`;
}

/** '5 jun al 12 jun' (colapsa si es el mismo dia). */
export function fmtRange(desdeIso, hastaIso) {
  if (sameDay(desdeIso, hastaIso)) return fmtShort(desdeIso);
  const a = fmtShort(desdeIso);
  const b = fmtShort(hastaIso);
  if (!a || !b) return a || b || '';
  return `${a}${T(' al ', ' to ')}${b}`;
}

/**
 * Etiqueta relativa corta: 'Hoy', 'Mañana', 'Ayer'; dentro de los proximos
 * 6 dias el nombre del dia ('Jueves'); si no, fmtShort.
 */
export function relativeDay(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  const diff = diffDays(todayISO(), toISO(d));
  if (diff === 0) return T('Hoy', 'Today');
  if (diff === 1) return T('Mañana', 'Tomorrow');
  if (diff === -1) return T('Ayer', 'Yesterday');
  if (diff > 1 && diff <= 6) {
    const dia = DIAS[(d.getDay() + 6) % 7];
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  return fmtShort(iso);
}
