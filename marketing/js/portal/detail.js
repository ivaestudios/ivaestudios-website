// ============================================================================
// Portal cliente v2 — Detalle full-screen como RUTA (#post=<id>).
//
// Reemplaza el modal v1 y su carrera de transitionend. main.js es dueno del
// hash: aqui solo open(id)/close() pintan el overlay. El boton atras del
// telefono cierra via popstate->hashchange (lo orquesta main.js).
//
// Contenido: tarjeta IG completa (caption entera + Copiar), seccion Guion
// (Gancho/Desarrollo/Llamado a la accion) solo si existe, Hashtags con
// Copiar, NUEVO timeline de decisiones desde data.approvals (v1 lo recibia y
// nunca lo renderizaba), hilo de comentarios inline y ACTION BAR STICKY
// inferior en zona de pulgar: Aprobar + Pedir cambios si pending/changes,
// caja verde de gracias si approved (sin des-aprobar).
// ============================================================================

import { el, clear, copyText, fmtDate } from '../api.js?v=202607221901';
import { toast } from '../shell/toast.js?v=202607221901';
import { closeAll as closeAllSheets } from '../shell/sheet.js?v=202607221901';
import * as store from './store.js?v=202607221901';
import { igCard, ICONS } from './igcard.js?v=202607221901';
import { renderThread, openThreadSheet } from './thread.js?v=202607221901';
import { openChangesSheet } from './inbox.js?v=202607221901';

let hostEl = null;          // #detail
let requestClose = null;    // main.js decide como salir de la ruta
let currentId = null;
let prevFocus = null;
let hideTimer = 0;          // timer del hide diferido de close(); open() lo cancela

const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Re-asienta el scroll-lock del body al cerrar un sheet abierto SOBRE el
// detalle: sheet.js hace lockBody(false) cuando su stack queda vacio sin
// saber que este overlay sigue abierto, y el feed de fondo volvia a ser
// scrolleable (bleed-through / rubber-banding en iOS). Se pasa como onClose
// a openThreadSheet/openChangesSheet; sheet.js llama onClose DESPUES de
// soltar su lock, asi que este re-lock sincrono gana. Cuando el cierre del
// sheet viene de close() del propio detalle (closeAllSheets), currentId ya
// es null y NO re-bloquea: close() restaura overflow normalmente.
function relockBody() {
  if (currentId != null) document.body.style.overflow = 'hidden';
}

export function init(host, { onRequestClose }) {
  hostEl = host;
  requestClose = onRequestClose;
}

export function isOpen() { return currentId != null; }
export function openId() { return currentId; }

// ── Abrir (idempotente por id; guard anti-carrera via store.state.openPostId)
export async function open(id) {
  if (!hostEl) return;
  // Cancelar el hide diferido de un close() reciente: sin esto, cerrar y tocar
  // otra tarjeta en <240ms dejaba el overlay oculto/vacio con la ruta activa
  // y el scroll del feed bloqueado (overflow:hidden nunca se restauraba).
  clearTimeout(hideTimer);
  // Idempotente solo si de verdad esta visible; si el host quedo oculto
  // (estado roto por una carrera previa), repintar en vez de morir aqui.
  if (currentId === id && !hostEl.hidden) return;
  currentId = id;
  store.state.openPostId = id;
  prevFocus = document.activeElement;

  hostEl.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => hostEl.classList.add('is-open'));

  paintSkeleton();

  let entry;
  try {
    entry = await store.getDetail(id);
  } catch (err) {
    if (store.state.openPostId !== id) return; // ya se cerro o se abrio otro
    if (store.handleAuthError(err)) return;
    paintError(err);
    return;
  }
  if (store.state.openPostId !== id) return; // guard anti-carrera
  paint(entry);
}

export function close() {
  if (!hostEl || currentId == null) return;
  currentId = null;
  store.state.openPostId = null;
  closeAllSheets(); // un sheet abierto sobre el detalle no debe sobrevivirlo
  hostEl.classList.remove('is-open');
  document.body.style.overflow = '';
  const hide = () => { hostEl.hidden = true; clear(hostEl); };
  if (reducedMotion()) { hide(); } else { hideTimer = setTimeout(hide, 240); }
  if (prevFocus && prevFocus.focus && document.contains(prevFocus)) {
    try { prevFocus.focus({ preventScroll: true }); } catch { /* sin foco previo */ }
  }
  prevFocus = null;
}

// ── Esqueleto / error ────────────────────────────────────────────────────────
function shell(title) {
  clear(hostEl);
  const closeBtn = el('button', {
    class: 'pdetail__close', type: 'button', 'aria-label': 'Cerrar detalle',
    html: ICONS.close,
    onclick: () => requestClose && requestClose(),
  });
  const head = el('div', { class: 'pdetail__head' }, [
    closeBtn,
    el('h2', { class: 'pdetail__title', text: title || 'Detalle' }),
  ]);
  const scroll = el('div', { class: 'pdetail__scroll' });
  const inner = el('div', { class: 'pdetail__inner' });
  scroll.append(inner);
  hostEl.append(head, scroll);
  return { inner, scroll };
}

function paintSkeleton() {
  const { inner } = shell('Detalle');
  inner.append(el('div', { class: 'pboot', style: { minHeight: '50dvh' } }, [
    el('span', { class: 'spinner spinner--lg', 'aria-hidden': 'true' }),
    el('p', { text: 'Cargando...' }),
  ]));
}

function paintError(err) {
  const { inner } = shell('Detalle');
  inner.append(el('div', { class: 'empty' }, [
    el('div', { class: 'empty__icon', html: ICONS.sparkle }),
    el('h3', { text: 'No pudimos abrir este contenido' }),
    el('p', { text: (err && err.message) || 'Inténtalo de nuevo.' }),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: () => requestClose && requestClose() }, ['Volver']),
  ]));
}

// ── Render completo ──────────────────────────────────────────────────────────
function paint(entry) {
  const post = entry.post;
  const { inner } = shell(post.title || 'Contenido');

  // Tarjeta IG completa (caption entera, burbuja abre el sheet del hilo).
  inner.append(igCard(post, store.state.client, {
    clampCaption: false,
    showState: post.approval_state === 'changes',
    onOpenThread: (p) => openThreadSheet(p, { onClose: relockBody }),
    commentCount: entry.comments.length,
  }));

  // Fecha amistosa completa.
  inner.append(el('div', { class: 'pdetail__block' }, [
    el('div', { class: 'pdetail__label' }, [el('span', { text: 'Fecha de publicación' })]),
    el('div', {
      class: 'preadbox' + (post.publish_date ? '' : ' is-empty'),
      text: post.publish_date
        ? capitalize(fmtDate(post.publish_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
        : 'Sin fecha programada todavía.',
    }),
  ]));

  // Caption con Copiar.
  inner.append(readBlock('Caption', post.caption, { copy: true }));

  // Guion solo si existe.
  if (post.hook || post.body || post.cta) {
    const parts = el('div', { class: 'pscript' });
    if (post.hook) parts.append(scriptPart('Gancho', post.hook));
    if (post.body) parts.append(scriptPart('Desarrollo', post.body));
    if (post.cta) parts.append(scriptPart('Llamado a la acción', post.cta));
    inner.append(el('div', { class: 'pdetail__block' }, [
      el('div', { class: 'pdetail__label' }, [el('span', { text: 'Guion' })]),
      parts,
    ]));
  }

  // Hashtags con Copiar.
  if (post.hashtags) {
    inner.append(readBlock('Hashtags', post.hashtags, { copy: true }));
  }

  // NUEVO: timeline de decisiones (data.approvals, antes ignorado).
  if (entry.approvals.length) {
    inner.append(el('div', { class: 'pdetail__block' }, [
      el('div', { class: 'pdetail__label' }, [el('span', { text: 'Historial de decisiones' })]),
      historyTimeline(entry.approvals),
    ]));
  }

  // Hilo de comentarios inline.
  const threadBlock = el('div', { class: 'pdetail__block' }, [
    el('div', { class: 'pdetail__label' }, [el('span', { text: 'Comentarios' })]),
  ]);
  const threadHost = el('div');
  threadBlock.append(threadHost);
  inner.append(threadBlock);
  renderThread(threadHost, post);

  // Action bar sticky inferior (zona de pulgar).
  hostEl.append(actionBar(post));
}

function capitalize(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function readBlock(label, value, { copy = false } = {}) {
  const has = !!(value && String(value).trim());
  const head = el('div', { class: 'pdetail__label' }, [
    el('span', { text: label }),
    el('span', { class: 'spacer' }),
  ]);
  if (copy && has) {
    const btn = el('button', { class: 'pcopy', type: 'button' }, [
      el('span', { class: 'ico', html: ICONS.copy, 'aria-hidden': 'true' }),
      el('span', { text: 'Copiar' }),
    ]);
    btn.addEventListener('click', async () => {
      const ok = await copyText(String(value));
      toast(ok ? 'Copiado al portapapeles.' : 'No pudimos copiar.', { type: ok ? 'success' : 'error', ms: 1800 });
    });
    head.append(btn);
  }
  return el('div', { class: 'pdetail__block' }, [
    head,
    el('div', { class: 'preadbox' + (has ? '' : ' is-empty'), text: has ? String(value) : 'Aún sin contenido.' }),
  ]);
}

function scriptPart(tag, text) {
  return el('div', { class: 'pscript__part' }, [
    el('div', { class: 'pscript__tag', text: tag }),
    el('div', { class: 'pscript__text', text }),
  ]);
}

function historyTimeline(approvals) {
  const meName = (store.state.me && store.state.me.name) || '';
  const wrap = el('div', { class: 'phistory' });
  // Mas reciente primero: la decision vigente arriba.
  const list = [...approvals].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  for (const a of list) {
    const isApprove = a.decision === 'approved';
    const mine = a._mine || (a.actor_name && a.actor_name === meName);
    const who = mine ? 'Tú' : (a.actor_name || 'Alguien de tu equipo');
    const verb = isApprove
      ? (mine ? 'aprobaste este contenido' : 'aprobó este contenido')
      : (mine ? 'pediste cambios' : 'pidió cambios');
    const item = el('div', {
      class: 'phistory__item',
      style: { '--c': isApprove ? 'var(--ok)' : 'var(--pink)' },
    }, [
      el('span', { class: 'phistory__dot', 'aria-hidden': 'true' }),
      el('div', { class: 'phistory__body' }, [
        el('span', {}, [el('b', { text: who }), ` ${verb}`]),
        el('div', { class: 'phistory__when', text: friendlyWhen(a.created_at) }),
        (!isApprove && a.comment) ? el('div', { class: 'phistory__quote', text: a.comment }) : null,
      ]),
    ]);
    wrap.append(item);
  }
  return wrap;
}

function friendlyWhen(iso) {
  if (!iso) return '';
  const ymdPart = String(iso).slice(0, 10);
  const f = fmtDate(ymdPart, { day: 'numeric', month: 'long' });
  return f ? `el ${f}` : '';
}

// ── Action bar: decision en zona de pulgar ───────────────────────────────────
function actionBar(post) {
  const bar = el('div', { class: 'pdetail__bar' });

  if (post.approval_state === 'approved') {
    bar.append(thanksBox());
    return bar;
  }

  const approveBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
    el('span', { class: 'ico', html: ICONS.check, 'aria-hidden': 'true' }),
    el('span', { text: 'Aprobar' }),
  ]);
  const changesBtn = el('button', { class: 'btn', type: 'button', text: 'Pedir cambios' });

  approveBtn.addEventListener('click', async () => {
    approveBtn.dataset.loading = 'true';
    try {
      await store.approve(post.id);
    } catch (err) {
      delete approveBtn.dataset.loading;
      if (!store.handleAuthError(err)) {
        toast(err.message || 'No pudimos registrar tu aprobación. Inténtalo de nuevo.', { type: 'error' });
      }
      return;
    }
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* sin vibracion */ } }
    // Celebrar primero EN el action bar vivo; el sync repinta el resto.
    clear(bar);
    bar.append(thanksBox(true));
    const badge = hostEl.querySelector('.igcard__state');
    if (badge) badge.remove();
    toast('Gracias, aprobaste este contenido 💜', { type: 'success' });
    store.syncApproval(post.id, 'approved', { origin: 'detail' });
  });

  changesBtn.addEventListener('click', () => {
    openChangesSheet(post, {
      onClose: relockBody, // el cierre del sheet no debe soltar el lock del detalle
      onDone: () => {
        // Reflejar el nuevo estado dentro del detalle abierto (paint vuelve a
        // montar contenido + action bar desde el cache ya sincronizado).
        if (store.state.openPostId !== post.id) return;
        const entry = store.state.details.get(post.id);
        if (entry) paint(entry);
      },
    });
  });

  bar.append(approveBtn, changesBtn);
  return bar;
}

function thanksBox(justNow = false) {
  return el('div', { class: 'pthanks', role: 'status' }, [
    el('span', { class: 'check' }, [el('span', { class: 'ico', html: ICONS.check, 'aria-hidden': 'true' })]),
    el('span', { text: justNow ? '¡Aprobado! Gracias por revisarlo 💜' : 'Ya aprobaste este contenido. Gracias 💜' }),
  ]);
}
