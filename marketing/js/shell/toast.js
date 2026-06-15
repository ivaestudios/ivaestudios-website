// ============================================================================
// IVAE Marketing v2 — Toasts con accion Deshacer.
//
// toast(msg, {type:'success'|'error'|'info', ms, action:{label, onAction}})
// - Host #toastHost (.toast-host) con aria-live polite.
// - Cola: maximo 2 visibles; el resto espera.
// - Con action: duracion 5000ms, boton de texto gradiente; al tocarlo ejecuta
//   onAction (tipicamente el rollback de store.optimistic), cierra el toast y
//   muestra 'Deshecho' 1.5s.
// - Teclado movil: el host se reposiciona con visualViewport si existe.
//
// Comparte clases CSS (.toast, .toast--success...) con el toast legacy de
// api.js para que ambos se vean identicos durante la transicion.
// ============================================================================

import { el } from '../api.js?v=202606150006';

const MAX_VISIBLE = 2;
const queue = [];
let visible = 0;
let host = null;
let vvBound = false;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.getElementById('toastHost');
  if (!host) {
    host = el('div', { id: 'toastHost', class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(host);
  } else {
    host.classList.add('toast-host');
    if (!host.getAttribute('role')) host.setAttribute('role', 'status');
    if (!host.getAttribute('aria-live')) host.setAttribute('aria-live', 'polite');
  }
  bindViewport();
  return host;
}

// Con el teclado abierto (iOS/Android) el bottom fijo queda tapado: usa
// visualViewport para subir el host justo encima del teclado.
function bindViewport() {
  if (vvBound || !window.visualViewport) return;
  vvBound = true;
  const vv = window.visualViewport;
  const update = () => {
    if (!host) return;
    const hidden = window.innerHeight - vv.height - vv.offsetTop;
    host.style.transform = hidden > 40 ? `translateY(-${hidden}px)` : '';
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
}

const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12" y2="7.5"/></svg>',
};

function renderNext() {
  if (visible >= MAX_VISIBLE || !queue.length) return;
  const job = queue.shift();
  visible++;

  const h = ensureHost();
  const ico = el('span', { class: 'ico' });
  ico.innerHTML = ICONS[job.type] || ICONS.info;

  const msgEl = el('span', { class: 'toast__msg', text: job.msg });
  const kids = [ico, msgEl];

  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    t.classList.add('is-leaving');
    t.addEventListener('animationend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 400); // fallback
    visible--;
    renderNext();
  };

  if (job.action && typeof job.action.onAction === 'function') {
    kids.push(el('button', {
      class: 'toast__action', type: 'button',
      text: job.action.label || 'Deshacer',
      onclick: (e) => {
        e.stopPropagation();
        try { job.action.onAction(); } catch (err) { console.error('[toast] action', err); }
        clearTimeout(timer);
        msgEl.textContent = 'Deshecho';
        t.querySelector('.toast__action')?.remove();
        timer = setTimeout(finish, 1500);
      },
    }));
  }

  const t = el('div', { class: `toast toast--${job.type}` }, kids);
  h.appendChild(t);
  timer = setTimeout(finish, job.ms);
  t.addEventListener('click', finish); // tap en el cuerpo descarta
}

/**
 * Muestra un toast. Compatible con dos firmas:
 *   toast('Listo', {type:'success', action:{label:'Deshacer', onAction}})
 *   toast('Listo', 'success', 4000)   (firma legacy de api.js)
 */
export function toast(msg, opts = {}, legacyMs) {
  let options = opts;
  if (typeof opts === 'string') options = { type: opts, ms: legacyMs };
  const { type = 'info', action = null } = options || {};
  const ms = options && options.ms ? options.ms : (action ? 5000 : 4000);
  queue.push({ msg: String(msg ?? ''), type, ms, action });
  renderNext();
}

export default toast;
