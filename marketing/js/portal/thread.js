// ============================================================================
// Portal cliente v2 — Hilo de comentarios (compartido por sheet e inline).
//
// renderThread(host, post)        -> pinta hilo + composer dentro de host
// openThreadSheet(post, {onClose}) -> bottom sheet con el hilo (backdrop SI
//                                    cierra: es sheet de lectura; el composer
//                                    no captura datos criticos, regla NN/g
//                                    aplicada solo al form de pedir cambios)
//
// Burbujas: mias a la derecha (grad-soft, avatar acento), equipo a la
// izquierda. timeAgo es-MX. Re-filtro defensivo !c.internal aunque el server
// ya filtra en SQL. Datos SIEMPRE via textContent.
// ============================================================================

import { el, clear, initials, timeAgo } from '../api.js?v=202607152032';
import { toast } from '../shell/toast.js?v=202607152032';
import { openSheet } from '../shell/sheet.js?v=202607152032';
import * as store from './store.js?v=202607152032';

function bubble(c) {
  const mine = !!c._mine || c.author_role === 'client';
  return el('div', { class: 'pmsg' + (mine ? ' is-mine' : '') }, [
    el('span', {
      class: 'avatar avatar--sm',
      title: c.author_name || '',
      text: initials(c.author_name || '?'),
      'aria-hidden': 'true',
    }),
    el('div', { class: 'pmsg__wrap' }, [
      el('div', { class: 'pmsg__meta' }, [
        el('span', { class: 'pmsg__author', text: c.author_name || (mine ? 'Tú' : 'Tu equipo') }),
        el('span', { text: timeAgo(c.created_at) }),
      ]),
      el('div', { class: 'pmsg__bubble', text: c.body || '' }),
    ]),
  ]);
}

/**
 * Pinta el hilo + composer dentro de `host`. Devuelve {refresh} por si la
 * vista quiere repintar tras un cambio externo.
 */
export function renderThread(host, post) {
  clear(host);

  const list = el('div', { class: 'pthread', dataset: { threadFor: post.id } });
  const entry = store.state.details.get(post.id);
  const comments = (entry ? entry.comments : []).filter((c) => !c.internal);

  const paint = () => {
    clear(list);
    const e = store.state.details.get(post.id);
    const cs = (e ? e.comments : []).filter((c) => !c.internal);
    if (!cs.length) {
      list.append(el('p', {
        class: 'pthread__empty',
        text: 'Aún no hay comentarios. Si tienes dudas o ideas, escríbenos aquí, te leemos 💬',
      }));
    } else {
      for (const c of cs) list.append(bubble(c));
    }
  };

  if (!comments.length) {
    list.append(el('p', {
      class: 'pthread__empty',
      text: 'Aún no hay comentarios. Si tienes dudas o ideas, escríbenos aquí, te leemos 💬',
    }));
  } else {
    for (const c of comments) list.append(bubble(c));
  }

  // Composer sticky al fondo: el teclado no tapa el boton Comentar.
  const ta = el('textarea', {
    class: 'textarea', rows: '1',
    placeholder: 'Escribe un comentario para tu equipo...',
    'aria-label': 'Nuevo comentario',
  });
  // En iOS el textarea enfocado puede quedar bajo el teclado: lo acercamos.
  ta.addEventListener('focus', () => {
    setTimeout(() => { try { ta.scrollIntoView({ block: 'nearest' }); } catch { /* sin soporte */ } }, 250);
  });

  const sendBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Comentar' });
  sendBtn.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    sendBtn.dataset.loading = 'true';
    try {
      const comment = await store.sendComment(post.id, body);
      // Append quirurgico (sin repintar el hilo completo).
      const empty = list.querySelector('.pthread__empty');
      if (empty) empty.remove();
      const node = bubble(comment);
      list.append(node);
      try { node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* sin soporte */ }
      ta.value = '';
      toast('Comentario enviado.', { type: 'success', ms: 1800 });
    } catch (err) {
      if (!store.handleAuthError(err)) {
        toast(err.message || 'No pudimos enviar tu comentario. Inténtalo de nuevo.', { type: 'error' });
      }
    } finally {
      delete sendBtn.dataset.loading;
    }
  });

  host.append(
    list,
    el('div', { class: 'pcomposer' }, [ta, sendBtn]),
  );

  return { refresh: paint };
}

/**
 * Abre el hilo en el bottom sheet del shell. Rehidrata con GET /posts/:id
 * (cache 60s en store.details) y usa guard anti-carrera por post abierto.
 * opts.onClose se encadena tras el cierre (cualquier via: X, backdrop,
 * atras, Esc, drag): lo usa detail.js para re-asentar su scroll-lock.
 */
export function openThreadSheet(post, { onClose } = {}) {
  let alive = true;
  openSheet({
    title: 'Comentarios',
    mode: 'menu', // sheet de lectura: backdrop y boton atras SI cierran
    onClose: (info) => {
      alive = false;
      if (onClose) { try { onClose(info); } catch (e) { console.error('[thread] onClose', e); } }
    },
    async build(body) {
      const loading = el('div', { class: 'pthread__empty' }, [
        el('span', { class: 'spinner', 'aria-hidden': 'true', style: { margin: '0 auto 8px' } }),
        el('p', { text: 'Cargando comentarios...' }),
      ]);
      body.append(loading);
      try {
        await store.getDetail(post.id);
      } catch (err) {
        if (!alive) return;
        clear(body);
        if (store.handleAuthError(err)) return;
        body.append(el('p', { class: 'pthread__empty', text: err.message || 'No pudimos cargar los comentarios.' }));
        return;
      }
      if (!alive) return;
      clear(body);
      renderThread(body, post);
    },
  });
}
