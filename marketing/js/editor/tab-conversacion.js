// ============================================================================
// IVAE Marketing v2 - Editor de post: tab Conversacion.
//
// - Hilo con el patron visual existente: avatar, autor, tag "Interno" ambar,
//   timeAgo. Los comentarios del cliente (request-changes) caen aqui.
// - Composer sticky abajo con toggle de visibilidad INEQUIVOCO:
//     "Solo equipo" (default staff, ambar)  vs  "Visible para <cliente>"
//   para que un comentario interno JAMAS se filtre por descuido.
// - Cmd/Ctrl+Enter envia (desktop). Envio optimista + re-fetch del hilo en
//   background. Error: el texto VUELVE al composer (nada se pierde).
// - visualViewport: el composer se reacomoda sobre el teclado de iOS.
//
// mount(host, ed) -> dispose()
// ============================================================================

import { el, api, timeAgo, avatar } from '../api.js?v=202607071209';
import { icon } from '../shell/icons.js?v=202607071209';

let tmpSeq = 0;

export function mount(host, ed) {
  const { ctx } = ed;
  let internal = true; // default staff: Solo equipo
  let disposed = false;
  let sending = false;

  const client = ed.getClient();
  const clientName = (client && client.name) || 'el cliente';

  const root = el('div', { class: 'edtab edtab-conv' });
  const threadEl = el('div', { class: 'edconv__thread', role: 'log', 'aria-label': 'Conversacion' });

  // ── Hilo ───────────────────────────────────────────────────────────────────
  function commentNode(c) {
    const isClient = c.author_role === 'client';
    const isInternal = !!c.internal;
    return el('div', {
      class: 'edconv__msg' + (isInternal ? ' is-internal' : '') + (isClient ? ' is-client' : '') + (c._pending ? ' is-pending' : ''),
      dataset: { cid: c.id || '' },
    }, [
      avatar(c.author_name || '?', true),
      el('div', { class: 'edconv__bubble' }, [
        el('div', { class: 'edconv__meta' }, [
          el('span', { class: 'edconv__author', text: c.author_name || 'Alguien' }),
          isInternal
            ? el('span', { class: 'edconv__tag edconv__tag--internal', text: 'Interno' })
            : el('span', { class: 'edconv__tag edconv__tag--public' }, [icon('eye', 12), `Visible para ${clientName}`]),
          el('span', { class: 'edconv__time', text: c._pending ? 'enviando...' : timeAgo(c.created_at) }),
        ]),
        el('div', { class: 'edconv__body', text: c.body || '' }),
      ]),
    ]);
  }

  function renderThread() {
    while (threadEl.firstChild) threadEl.removeChild(threadEl.firstChild);
    const comments = ed.getComments();
    ed.setTabBadge('conversacion', comments.length ? String(comments.length) : '');
    if (!comments.length) {
      threadEl.appendChild(el('div', { class: 'edconv__empty' }, [
        el('p', { class: 'muted', text: 'Sin comentarios todavia. Escribe el primero.' }),
      ]));
      return;
    }
    for (const c of comments) threadEl.appendChild(commentNode(c));
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { threadEl.scrollTop = threadEl.scrollHeight; });
  }

  function highlightComment(cid) {
    const node = threadEl.querySelector(`[data-cid="${CSS.escape(String(cid))}"]`);
    if (!node) return;
    node.scrollIntoView({ block: 'center' });
    node.classList.add('is-highlight');
    setTimeout(() => node.classList.remove('is-highlight'), 2400);
  }

  // ── Composer ───────────────────────────────────────────────────────────────
  const ta = el('textarea', {
    class: 'ed-ta edconv__input', rows: '1',
    placeholder: 'Escribe un comentario...',
    'aria-label': 'Nuevo comentario',
  });
  const fitTa = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 24), 140)}px`; };
  ta.addEventListener('input', fitTa);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
  });

  const toggleBtn = el('button', {
    class: 'edconv__vis', type: 'button',
    'aria-live': 'polite',
    onclick: () => { internal = !internal; refreshToggle(); },
  });
  function refreshToggle() {
    while (toggleBtn.firstChild) toggleBtn.removeChild(toggleBtn.firstChild);
    if (internal) {
      toggleBtn.classList.add('is-internal');
      toggleBtn.classList.remove('is-public');
      toggleBtn.append(icon('users', 14), el('span', { text: 'Solo equipo' }));
      toggleBtn.setAttribute('aria-label', 'Visibilidad: solo equipo. Tocar para hacerlo visible al cliente.');
    } else {
      toggleBtn.classList.remove('is-internal');
      toggleBtn.classList.add('is-public');
      toggleBtn.append(icon('eye', 14), el('span', { text: `Visible para ${clientName}` }));
      toggleBtn.setAttribute('aria-label', `Visibilidad: visible para ${clientName}. Tocar para hacerlo interno.`);
    }
  }
  refreshToggle();

  const sendBtn = el('button', {
    class: 'btn btn-primary edconv__send', type: 'button', 'aria-label': 'Comentar',
    onclick: () => send(),
  }, [icon('send', 18)]);

  const composer = el('div', { class: 'edconv__composer' }, [
    el('div', { class: 'edconv__composer-top' }, [toggleBtn]),
    el('div', { class: 'edconv__composer-row' }, [ta, sendBtn]),
  ]);

  async function send() {
    const body = ta.value.trim();
    if (!body || sending) return;
    sending = true;

    const me = ed.getMe();
    const tmp = {
      id: `tmp-${++tmpSeq}`,
      post_id: ed.postId,
      author_name: me.name || me.email || 'Yo',
      author_role: me.role || 'team',
      body,
      internal: internal ? 1 : 0,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    // Optimista: aparece al instante.
    ed.setComments([...ed.getComments(), tmp]);
    renderThread();
    scrollToBottom();
    ta.value = '';
    fitTa();

    try {
      const created = await api.post(`/posts/${encodeURIComponent(ed.postId)}/comments`, {
        body, internal: internal ? 1 : 0,
      });
      if (disposed) return;
      const real = (created && created.comment) || created;
      ed.setComments(ed.getComments().map((c) => (c.id === tmp.id ? { ...real } : c)));
      renderThread();
      scrollToBottom();
      // Re-fetch en background para reconciliar (orden, hilos paralelos).
      ed.reloadThread().then(() => { if (!disposed) renderThread(); });
    } catch (e) {
      if (disposed) return;
      // Rollback: quita el pendiente y DEVUELVE el texto al composer.
      ed.setComments(ed.getComments().filter((c) => c.id !== tmp.id));
      renderThread();
      ta.value = body;
      fitTa();
      ctx.toast((e && e.message) || 'No se pudo comentar, intenta de nuevo.', { type: 'error' });
    } finally {
      sending = false;
    }
  }

  // ── Teclado iOS: el composer sube con el teclado ──────────────────────────
  let vvHandler = null;
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vvHandler = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      composer.style.transform = hidden > 40 ? `translateY(-${hidden}px)` : '';
    };
    vv.addEventListener('resize', vvHandler);
    vv.addEventListener('scroll', vvHandler);
  }

  root.append(threadEl, composer);
  host.appendChild(root);
  renderThread();
  scrollToBottom();

  // Deep-link a un comentario (#/post/:id?tab=conversacion&comment=<cid>).
  const cid = ed.getParams().comment;
  if (cid) setTimeout(() => highlightComment(cid), 120);

  return function dispose() {
    disposed = true;
    if (vvHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', vvHandler);
      window.visualViewport.removeEventListener('scroll', vvHandler);
    }
  };
}
