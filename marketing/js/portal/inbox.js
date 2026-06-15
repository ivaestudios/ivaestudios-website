// ============================================================================
// Portal cliente v2 — Bandeja "Por aprobar" (vista estrella, inbox-zero).
//
// - Stack de tarjetas IG pendientes (fecha asc, sin fecha al final).
// - Aprobar one-tap: celebracion EN EL NODO VIVO antes de cualquier sync
//   (fix del bug v1 de la celebracion muerta); colapso animado y remocion
//   quirurgica SOLO de ese nodo; DESPUES store.syncApproval repinta bateria,
//   contador del tab y agenda (origin 'inbox' evita el re-render inmediato
//   de esta seccion).
// - Pedir cambios: sheet modo form (NO cierra por backdrop), comentario
//   OBLIGATORIO con error inline aria-live; la tarjeta pasa a la franja
//   "Pediste cambios (N)" CONSERVANDO el boton Aprobar (fix limitacion v1).
// - Inbox-zero calido cuando ya no hay nada que revisar.
// ============================================================================

import { el, clear } from '../api.js?v=202606150006';
import { toast } from '../shell/toast.js?v=202606150006';
import { openSheet } from '../shell/sheet.js?v=202606150006';
import * as store from './store.js?v=202606150006';
import { igCard, ICONS } from './igcard.js?v=202606150006';
import { openThreadSheet } from './thread.js?v=202606150006';

let hostEl = null;
let openDetailFn = null;
let changesOpen = false; // estado UI efimero de la franja (vive en memoria)
let unsubs = [];

const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mount / unmount ──────────────────────────────────────────────────────────
export function mount(host, { onOpenDetail }) {
  hostEl = host;
  openDetailFn = onOpenDetail;
  render();

  unsubs.push(store.on('approval', ({ origin }) => {
    // El flujo de aprobar del propio inbox ya hizo su cirugia animada;
    // cualquier otra fuente (detalle, refetch) repinta la seccion completa.
    if (origin !== 'inbox') render();
  }));
  unsubs.push(store.on('posts', () => {
    // Refetch de fondo: repinta solo si NO hay una celebracion en curso.
    if (!hostEl) return;
    if (!hostEl.querySelector('.igcard.is-done')) render();
  }));
  unsubs.push(store.on('comment', ({ id }) => updateCommentCount(id)));
}

export function unmount() {
  for (const off of unsubs) off();
  unsubs = [];
  hostEl = null;
}

// ── Render ───────────────────────────────────────────────────────────────────
export function render() {
  if (!hostEl) return;
  clear(hostEl);

  const pending = store.pendingPosts();
  const changes = store.changesPosts();

  if (!pending.length && !changes.length) {
    hostEl.append(inboxZero());
    return;
  }

  if (pending.length) {
    hostEl.append(el('div', { class: 'pinbox-head' }, [
      el('b', { text: String(pending.length) }),
      el('span', { text: pending.length === 1 ? 'contenido espera tu visto bueno ✨' : 'contenidos esperan tu visto bueno ✨' }),
    ]));
    pending.forEach((p, i) => {
      hostEl.append(buildCard(p, { index: i + 1, total: pending.length, keepApprove: true, showState: false }));
    });
  } else {
    hostEl.append(el('div', { class: 'pzero empty' }, [
      el('div', { class: 'empty__icon', html: ICONS.check }),
      el('h3', { text: 'Nada nuevo por revisar 💜' }),
      el('p', { text: 'Solo quedan los contenidos a los que pediste cambios. Tu equipo ya está trabajando en ellos.' }),
    ]));
  }

  if (changes.length) hostEl.append(changesStrip(changes));
}

function inboxZero() {
  return el('div', { class: 'pzero empty' }, [
    el('div', { class: 'empty__icon', html: ICONS.check }),
    el('h3', { text: 'Todo aprobado por ahora 💜' }),
    el('p', { text: 'Gracias por revisar. Te avisaremos en cuanto haya contenido nuevo para ti.' }),
  ]);
}

// ── Tarjeta con acciones ─────────────────────────────────────────────────────
function buildCard(post, { index, total, keepApprove, showState }) {
  const approveBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
    el('span', { class: 'ico', html: ICONS.check, 'aria-hidden': 'true' }),
    el('span', { text: 'Aprobar' }),
  ]);
  const changesBtn = el('button', { class: 'btn', type: 'button', text: 'Pedir cambios' });

  const actions = keepApprove ? [approveBtn, changesBtn] : [approveBtn];

  const card = igCard(post, store.state.client, {
    actions,
    onOpenThread: openThreadSheet,
    commentCount: store.commentCount(post.id),
    position: (index && total) ? { index, total } : null,
    showState,
    onOpen: (p) => openDetailFn && openDetailFn(p.id),
  });

  approveBtn.addEventListener('click', () => approveFlow(post, card, approveBtn));
  changesBtn.addEventListener('click', () => openChangesSheet(post));
  return card;
}

// ── Aprobar one-tap con celebracion en el nodo vivo ──────────────────────────
async function approveFlow(post, card, btn) {
  btn.dataset.loading = 'true';
  let res;
  try {
    res = await store.approve(post.id);
  } catch (err) {
    delete btn.dataset.loading;
    if (!store.handleAuthError(err)) {
      toast(err.message || 'No pudimos registrar tu aprobación. Inténtalo de nuevo.', { type: 'error' });
    }
    return;
  }
  void res;

  // 1) PRIMERO celebrar en el nodo vivo (nada de replaceChildren todavia).
  if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* sin vibracion */ } }
  card.classList.add('is-done');
  const acts = card.querySelector('.igcard__actions');
  const done = el('div', { class: 'igcard__done' }, [
    el('span', { class: 'check' }, [el('span', { class: 'ico', html: ICONS.check, 'aria-hidden': 'true' })]),
    el('span', { text: '¡Aprobado! Gracias por revisarlo 💜' }),
  ]);
  if (acts) acts.replaceWith(done); else card.append(done);
  const openLink = card.querySelector('.igcard__open');
  if (openLink) openLink.remove();
  toast('Gracias, aprobaste este contenido 💜', { type: 'success' });

  const finish = () => {
    card.remove();
    // 3) DESPUES el sync global: bateria, contador del tab y agenda escuchan
    //    'approval'; este modulo lo ignora (origin 'inbox') y solo ajusta
    //    su encabezado/estado vacio con una re-pintada ya sin la tarjeta.
    store.syncApproval(post.id, 'approved', { origin: 'inbox' });
    render();
  };

  if (reducedMotion()) {
    setTimeout(finish, 350);
    return;
  }

  // 2) A los 1200ms colapsar con transicion de max-height y remover SOLO ese nodo.
  setTimeout(() => {
    card.style.maxHeight = card.scrollHeight + 'px';
    card.classList.add('is-collapse-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.classList.add('is-collapsing');
        let doneOnce = false;
        const after = () => { if (!doneOnce) { doneOnce = true; finish(); } };
        card.addEventListener('transitionend', after, { once: true });
        setTimeout(after, 450); // respaldo si transitionend no dispara
      });
    });
  }, 1200);
}

// ── Pedir cambios (sheet form, comentario obligatorio) ───────────────────────
// opts.onClose se reenvia al sheet (corre tras CUALQUIER cierre: X, Cancelar,
// enviar, atras, Esc): lo usa detail.js para re-asentar su scroll-lock.
export function openChangesSheet(post, { onDone, onClose } = {}) {
  openSheet({
    title: 'Pedir cambios',
    mode: 'form', // NO cierra por backdrop: hay datos en juego (regla NN/g)
    onClose,
    build(body, close) {
      const note = el('p', {
        class: 'sheet-note',
        text: 'Cuéntale a tu equipo qué quieres ajustar de "' + (post.title || 'este contenido') + '".',
      });
      const ta = el('textarea', {
        class: 'textarea', rows: '4', id: 'pchangesText',
        placeholder: 'Cuéntanos qué te gustaría ajustar. Entre más claro, mejor 💬',
      });
      const errEl = el('div', { class: 'field__error', 'aria-live': 'polite' });
      const sendBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Enviar cambios' });
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) });

      sendBtn.addEventListener('click', async () => {
        const comment = ta.value.trim();
        if (!comment) {
          errEl.textContent = 'Escribe qué cambios necesitas para poder avisar al equipo.';
          ta.setAttribute('aria-invalid', 'true');
          ta.focus();
          return;
        }
        errEl.textContent = '';
        ta.removeAttribute('aria-invalid');
        sendBtn.dataset.loading = 'true';
        try {
          await store.requestChanges(post.id, comment);
        } catch (err) {
          delete sendBtn.dataset.loading;
          if (!store.handleAuthError(err)) {
            toast(err.message || 'No pudimos enviar tu solicitud. Inténtalo de nuevo.', { type: 'error' });
          }
          return;
        }
        close({ source: 'sent' });
        changesOpen = true; // la franja se abre para que vea a dónde fue su tarjeta
        store.syncApproval(post.id, 'changes', { origin: 'inbox' });
        render();
        toast('Listo, le pedimos los cambios a tu equipo 💜', { type: 'success' });
        if (onDone) onDone();
      });

      body.append(
        note,
        el('div', { class: 'field pchanges-form' }, [
          el('label', { class: 'label', for: 'pchangesText' }, [
            '¿Qué te gustaría cambiar? ',
            el('span', { class: 'req', text: '*' }),
          ]),
          ta,
          errEl,
        ]),
        el('div', { class: 'sheet__footer' }, [cancelBtn, sendBtn]),
      );
      setTimeout(() => ta.focus(), 80); // autofocus tras la animacion del sheet
    },
  });
}

// ── Franja "Pediste cambios (N)" (conserva Aprobar, fix v1) ──────────────────
function changesStrip(changes) {
  const wrap = el('section', { class: 'pchanges', 'aria-label': 'Contenidos con cambios pedidos' });

  const bodyEl = el('div', { class: 'pchanges__body' });
  bodyEl.hidden = !changesOpen;

  const toggle = el('button', {
    class: 'pchanges__toggle', type: 'button',
    'aria-expanded': changesOpen ? 'true' : 'false',
  }, [
    el('span', { text: `Pediste cambios (${changes.length})` }),
    el('span', { class: 'ico', html: ICONS.chevdown, 'aria-hidden': 'true' }),
  ]);
  toggle.addEventListener('click', () => {
    changesOpen = !changesOpen;
    bodyEl.hidden = !changesOpen;
    toggle.setAttribute('aria-expanded', changesOpen ? 'true' : 'false');
  });

  bodyEl.append(el('p', {
    class: 'pchanges__hint',
    text: 'Tu equipo ya está ajustando estos contenidos. Si alguno ya te convence, puedes aprobarlo desde aquí.',
  }));
  for (const p of changes) {
    bodyEl.append(buildCard(p, { index: null, total: null, keepApprove: true, showState: true }));
  }

  wrap.append(toggle, bodyEl);
  return wrap;
}

// ── Contador de comentarios en vivo sobre la burbuja de la tarjeta ───────────
function updateCommentCount(postId) {
  if (!hostEl) return;
  const n = store.commentCount(postId);
  if (n == null) return;
  const bubble = hostEl.querySelector(`button.ig-ico[data-thread="${postId}"]`);
  if (!bubble) return;
  let countEl = bubble.querySelector('.ig-ico__count');
  if (!countEl) {
    countEl = el('span', { class: 'ig-ico__count', dataset: { count: postId } });
    bubble.append(countEl);
  }
  countEl.textContent = String(n);
}
