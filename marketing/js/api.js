// ============================================================================
// IVAE Marketing — API client + shared UI helpers + ENUM maps (ES module).
// Imported by login (index.html), team app (app.js) and client portal (client.js).
//
// All requests hit  /api/marketing + path, send the mkt_session cookie
// (credentials:'same-origin'), speak JSON, and throw Error(server {error}) on
// non-2xx so callers can `try { ... } catch (e) { toast(e.message,'error') }`.
// ============================================================================

import { isEN, T } from './shell/i18n.js?v=202607221901';

const BASE = '/api/marketing';
const TIMEOUT = 30000; // 30s
const DLOC = isEN ? 'en-US' : 'es-MX'; // locale de fechas según idioma

async function request(path, { method = 'GET', body, headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      throw new Error(T('La solicitud tardó demasiado. Inténtalo de nuevo.', 'The request took too long. Try again.'));
    }
    throw new Error(T('Error de conexión. Revisa tu internet.', 'Connection error. Check your internet.'));
  }
  clearTimeout(timer);

  // 204 / empty body
  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const fallback =
      res.status === 401 ? T('Tu sesión expiró. Vuelve a iniciar sesión.', 'Your session expired. Please sign in again.') :
      res.status === 403 ? T('No tienes permiso para esta acción.', "You don't have permission for this action.") :
      res.status === 404 ? T('No se encontró el recurso.', 'Resource not found.') :
      res.status === 409 ? T('Ya existe un registro con esos datos.', 'A record with that data already exists.') :
      res.status >= 500 ? T('Error del servidor. Inténtalo de nuevo.', 'Server error. Try again.') :
      T('Algo salió mal. Inténtalo de nuevo.', 'Something went wrong. Try again.');
    const err = new Error((data && data.error) ? data.error : fallback);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get(path)         { return request(path); },
  post(path, body)  { return request(path, { method: 'POST',  body }); },
  patch(path, body) { return request(path, { method: 'PATCH', body }); },
  put(path, body)   { return request(path, { method: 'PUT',   body }); },
  del(path)         { return request(path, { method: 'DELETE' }); },
};

// ── DOM builder ─────────────────────────────────────────────────────────────
// el('div', {class:'card', onclick:fn, dataset:{id:'x'}}, [child, 'text', ...])
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'for') node.htmlFor = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Convenience: clear all children of a node.
export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

// ── Toasts ──────────────────────────────────────────────────────────────────
// Renders into a `.toast-host` (auto-created if missing). type: success|error|info
const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12" y2="7.5"/></svg>',
};

export function toast(msg, type = 'info', ms = 4000) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  const t = el('div', { class: `toast toast--${type}` }, [
    el('span', { class: 'ico', html: TOAST_ICONS[type] || TOAST_ICONS.info }),
    el('span', { class: 'toast__msg', text: msg }),
  ]);
  host.appendChild(t);
  const remove = () => {
    t.classList.add('is-leaving');
    t.addEventListener('animationend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 400); // fallback
  };
  const timer = setTimeout(remove, ms);
  t.addEventListener('click', () => { clearTimeout(timer); remove(); });
  return remove;
}

// ── Clipboard helper ─────────────────────────────────────────────────────────
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    return true;
  } catch { return false; }
}

// ── Date helpers (UI formatting, Spanish, no timezone surprises) ─────────────
// Posts store publish_date as 'YYYY-MM-DD'. Parse as local to avoid UTC shift.
export function parseDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function ymd(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function fmtDate(ymdStr, opts = { day: 'numeric', month: 'short' }) {
  const d = parseDate(ymdStr);
  return d ? d.toLocaleDateString(DLOC, opts) : '';
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  // server stores UTC 'YYYY-MM-DD HH:MM:SS'; normalize to ISO
  const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'));
  if (isNaN(d)) return String(iso);
  return d.toLocaleString(DLOC, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
// Relative time ("hace 5 min" / "5 min ago").
export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'));
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isEN) {
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
    const dd = Math.floor(h / 24); if (dd < 7) return `${dd} d ago`;
    return fmtDateTime(iso);
  }
  if (s < 60) return 'hace un momento';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const dd = Math.floor(h / 24); if (dd < 7) return `hace ${dd} d`;
  return fmtDateTime(iso);
}

// Initials for an avatar.
export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

// ── ENUM maps (single source of truth; mirror migrations + spec) ─────────────
// content_type: key → { label, color }
export const CONTENT_TYPES = {
  reel:         { label: 'Reel',                  en: 'Reel',                   color: '#64748b' },
  post:         { label: 'Post',                  en: 'Post',                   color: '#0d9488' },
  tiktok:       { label: 'TikTok',                en: 'TikTok',                 color: '#a16207' },
  informativo:  { label: 'Informativo',           en: 'Informational',          color: '#2563eb' },
  carrusel:     { label: 'Carrusel',              en: 'Carousel',               color: '#7c3aed' },
  experiencia:  { label: 'Experiencia/Testimonio',en: 'Experience/Testimonial', color: '#16a34a' },
  pauta:        { label: 'Pauta',                 en: 'Paid ad',                color: '#ca8a04' },
  tratamientos: { label: 'Tratamientos',          en: 'Treatments',             color: '#dc2626' },
  historia:     { label: 'Historia',              en: 'Story',                  color: '#0ea5e9' },
  foto:         { label: 'Foto',                  en: 'Photo',                  color: '#475569' },
};
export const CONTENT_TYPE_ORDER = ['reel','post','tiktok','informativo','carrusel','experiencia','pauta','tratamientos','historia','foto'];

// status: key → { order, label, color }  (pipeline order)
export const STATUSES = {
  idea:       { order: 0, label: 'Idea',       en: 'Idea',      color: '#64748b' },
  guion:      { order: 1, label: 'Guion',      en: 'Script',    color: '#3b82f6' },
  grabacion:  { order: 2, label: 'Grabación',  en: 'Recording', color: '#f59e0b' },
  edicion:    { order: 3, label: 'Edición',    en: 'Editing',   color: '#8b5cf6' },
  revision:   { order: 4, label: 'Revisión',   en: 'Review',    color: '#ec4899' },
  aprobado:   { order: 5, label: 'Aprobado',   en: 'Approved',  color: '#22c55e' },
  programado: { order: 6, label: 'Programado', en: 'Scheduled', color: '#06b6d4' },
  publicado:  { order: 7, label: 'Publicado',  en: 'Published', color: '#10b981' },
};
export const STATUS_ORDER = ['idea','guion','grabacion','edicion','revision','aprobado','programado','publicado'];

// approval_state: key → { label, color }
export const APPROVALS = {
  pending:  { label: 'Pendiente',         en: 'Pending',            color: '#f59e0b' },
  approved: { label: 'Aprobado',          en: 'Approved',           color: '#22c55e' },
  changes:  { label: 'Cambios pedidos',   en: 'Changes requested',  color: '#ec4899' },
};

// platforms (free-ish, but offer these)
export const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn'];

// grabacion priority 1..5
export const GRABACION_LEVELS = [1, 2, 3, 4, 5];

// Small label lookups (safe fallbacks for unknown keys).
const pickLbl = (o) => (o ? ((isEN && o.en) ? o.en : o.label) : '');
export const contentTypeLabel = (k) => pickLbl(CONTENT_TYPES[k]) || k || '';
export const statusLabel      = (k) => pickLbl(STATUSES[k]) || k || '';
export const approvalLabel    = (k) => pickLbl(APPROVALS[k]) || k || '';

// ── Reusable badge/chip builders (so all screens render identically) ─────────
export function chip(contentType) {
  const c = el('span', { class: 'chip', 'data-type': contentType }, [
    el('span', { class: 'swatch' }),
    el('span', { class: 'chip__txt', text: contentTypeLabel(contentType) }),
  ]);
  return c;
}
export function statusBadge(status) {
  return el('span', { class: 'status-badge', 'data-status': status }, [
    el('span', { class: 'swatch' }),
    statusLabel(status),
  ]);
}
export function approvalBadge(state) {
  return el('span', { class: 'approval-badge', 'data-approval': state }, [
    el('span', { class: 'dot' }),
    approvalLabel(state),
  ]);
}
export function avatar(name, sm = false) {
  return el('span', { class: 'avatar' + (sm ? ' avatar--sm' : ''), title: name || '', text: initials(name) });
}

// ════════════════════════════════════════════════════════════════════════════
// v2 (shell-core) — extensiones ADITIVAS. Todo lo anterior queda intacto:
// el legacy app.js / client.js siguen importando sin cambios.
// ════════════════════════════════════════════════════════════════════════════

// priority: key → { label, color }  (migracion 005; enum JS, sin CHECK SQL)
export const PRIORITIES = {
  baja:    { label: 'Baja',    en: 'Low',    color: '#64748b' },
  media:   { label: 'Media',   en: 'Medium', color: '#3b82f6' },
  alta:    { label: 'Alta',    en: 'High',   color: '#f59e0b' },
  urgente: { label: 'Urgente', en: 'Urgent', color: '#ef4444' },
};
export const PRIORITY_ORDER = ['baja', 'media', 'alta', 'urgente'];
export const priorityLabel = (k) => pickLbl(PRIORITIES[k]) || k || '';

export function priorityBadge(priority) {
  return el('span', { class: 'priority-badge', 'data-priority': priority }, [
    el('span', { class: 'dot' }),
    priorityLabel(priority),
  ]);
}

// Tipos de aviso (mkt_notifications.type) → etiqueta es-MX.
// El body llega YA resuelto del server; esto es solo para filtros/encabezados.
export const NOTIF_TYPE_LABELS = {
  aprobacion:    T('Aprobación', 'Approval'),
  cambios:       T('Cambios pedidos', 'Changes requested'), // mismo termino que APPROVALS.changes y el boton "Pedir cambios"
  comentario:    T('Comentario', 'Comment'),
  mencion:       T('Mención', 'Mention'),
  asignacion:    T('Asignación', 'Assignment'),
  recordatorio:  T('Recordatorio', 'Reminder'),
  atrasado:      T('Atrasado', 'Overdue'),
  revision:      T('Revisión del cliente', 'Client review'),
  sin_aprobar:   T('Sin aprobar', 'Not approved'),
  sistema:       T('Aviso', 'Alert'),
};
export const notifTypeLabel = (k) => NOTIF_TYPE_LABELS[k] || T('Aviso', 'Alert');
