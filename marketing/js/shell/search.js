// ============================================================================
// IVAE Marketing v2 — Busqueda global.
//
// MOVIL: overlay full-screen (input 48px autofocus + Cancelar + recientes).
// DESKTOP: el mismo modulo renderiza un dropdown anclado al input del topbar.
//
// - Debounce 250ms.
// - Fase 1 (instantanea): filtra en memoria los posts del cliente activo
//   (title, caption, hook) -> seccion 'En <cliente>'.
// - Fase 2 (solo staff, query >= 2): GET /search?q= -> 'Otros clientes' y
//   'Clientes'. Si el endpoint no existe (404), la fase 2 se omite.
// - Recientes: prefs recentSearches (max 8), tap re-ejecuta, X borra.
// - Tap en post -> #/post/<id> con ?cliente= correcto; tap en cliente ->
//   cambia el cliente activo y va a su tablero.
// - Cierre: Esc, Cancelar, backdrop o boton atras (capa history).
// ============================================================================

import { api, el, clear, statusBadge, chip, fmtDate } from '../api.js?v=202606241100';
import * as store from './store.js?v=202606241100';
import * as prefs from './prefs.js?v=202606241100';
import { pushLayer } from './router.js?v=202606241100';
import { icon } from './icons.js?v=202606241100';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const safeColor = (c) => (HEX_RE.test(String(c || '')) ? c : 'var(--brand)');

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export function createSearch({ router, selectClient }) {
  let overlay = null;
  let release = null;
  let reqSeq = 0;

  function isOpen() { return !!overlay; }

  function close(info = {}) {
    if (!overlay) return;
    const o = overlay;
    overlay = null;
    o.classList.remove('is-open');
    setTimeout(() => o.remove(), 220);
    if (!info.fromHistory && !info.fromRouter && release) release();
    release = null;
  }

  function open(anchor = null) {
    if (overlay) return;
    const desktop = window.matchMedia('(min-width: 1024px)').matches && anchor;

    const input = el('input', {
      class: 'gs-input', type: 'search',
      placeholder: 'Buscar contenido o clientes',
      'aria-label': 'Buscar contenido o clientes',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    });
    const cancelBtn = el('button', {
      class: 'gs-cancel', type: 'button', text: 'Cancelar',
      onclick: () => close({ source: 'cancel' }),
    });
    const results = el('div', { class: 'gs-results' });

    overlay = el('div', {
      class: 'gs-overlay' + (desktop ? ' gs-overlay--desktop' : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Búsqueda',
    }, [
      el('div', { class: 'gs-bar' }, [icon('search', 20), input, cancelBtn]),
      results,
    ]);

    if (desktop) {
      const r = anchor.getBoundingClientRect();
      overlay.style.top = `${r.bottom + 6}px`;
      overlay.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close({ source: 'backdrop' }); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close({ source: 'esc' }); });

    document.body.appendChild(overlay);
    release = pushLayer((info) => close(info));
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      input.focus();
    });

    renderRecents(results, input);
    input.addEventListener('input', debounce(() => run(input.value, results, input), 250));
  }

  // ── Recientes ──────────────────────────────────────────────────────────────
  function renderRecents(results, input) {
    clear(results);
    const recents = prefs.get('recentSearches', []);
    if (!recents.length) {
      results.appendChild(el('div', { class: 'gs-hint', text: 'Busca por título, caption o nombre de cliente.' }));
      return;
    }
    results.appendChild(el('div', { class: 'gs-sectitle', text: 'Búsquedas recientes' }));
    for (const q of recents) {
      results.appendChild(el('div', { class: 'gs-recent' }, [
        el('button', {
          class: 'gs-recent__txt', type: 'button', text: q,
          onclick: () => { input.value = q; run(q, results, input); },
        }),
        el('button', {
          class: 'gs-recent__x', type: 'button', 'aria-label': `Borrar ${q}`,
          onclick: (e) => { e.stopPropagation(); prefs.removeRecentSearch(q); renderRecents(results, input); },
        }, [icon('close', 14)]),
      ]));
    }
  }

  // ── Render de resultados ───────────────────────────────────────────────────
  function postRow(p, clientName, dotColor) {
    return el('button', {
      class: 'gs-row', type: 'button',
      onclick: () => {
        prefs.pushRecentSearch(String(p.title || '').slice(0, 60));
        close({ source: 'pick' });
        const params = { id: p.id };
        if (p.client_id) params.cliente = p.client_id;
        router.navigate('post', params);
      },
    }, [
      dotColor ? el('span', { class: 'gs-row__dot', style: { background: safeColor(dotColor) } }) : null,
      el('span', { class: 'gs-row__main' }, [
        el('span', { class: 'gs-row__title', text: p.title || 'Sin título' }),
        el('span', { class: 'gs-row__meta' }, [
          clientName ? el('span', { class: 'gs-row__client', text: clientName }) : null,
          p.content_type ? chip(p.content_type) : null,
          p.status ? statusBadge(p.status) : null,
          p.publish_date ? el('span', { class: 'gs-row__date', text: fmtDate(p.publish_date) }) : null,
        ]),
      ]),
    ]);
  }

  function clientRow(c) {
    return el('button', {
      class: 'gs-row', type: 'button',
      onclick: () => {
        close({ source: 'pick' });
        selectClient(c.id);
      },
    }, [
      el('span', { class: 'gs-row__dot', style: { background: safeColor(c.brand_color) } }),
      el('span', { class: 'gs-row__main' }, [
        el('span', { class: 'gs-row__title', text: c.name }),
        c.instagram_handle ? el('span', { class: 'gs-row__meta', text: '@' + String(c.instagram_handle).replace(/^@/, '') }) : null,
      ]),
    ]);
  }

  async function run(q, results, input) {
    const query = String(q || '').trim();
    const seq = ++reqSeq;
    if (!query) { renderRecents(results, input); return; }

    const { posts, clients, activeClientId, me } = store.getState();
    const needle = query.toLowerCase();
    clear(results);

    // Fase 1: memoria (cliente activo).
    const activeClient = clients.find((c) => c.id === activeClientId);
    const local = (posts || []).filter((p) =>
      [p.title, p.caption, p.hook].some((f) => f && String(f).toLowerCase().includes(needle))
    ).slice(0, 12);

    if (local.length) {
      results.appendChild(el('div', { class: 'gs-sectitle', text: activeClient ? `En ${activeClient.name}` : 'En este cliente' }));
      for (const p of local) results.appendChild(postRow(p, null, activeClient && activeClient.brand_color));
    }

    // Fase 2: server (solo staff, 2+ caracteres).
    const isStaff = me && me.role !== 'client';
    let server = null;
    if (isStaff && query.length >= 2) {
      const loading = el('div', { class: 'gs-hint', text: 'Buscando en todos los clientes' });
      results.appendChild(loading);
      try {
        server = await api.get(`/search?q=${encodeURIComponent(query)}`);
      } catch { server = null; /* endpoint nuevo aun no desplegado: fase 1 basta */ }
      if (seq !== reqSeq) return; // llego una busqueda mas nueva
      loading.remove();
    }

    if (server) {
      const byId = new Map(clients.map((c) => [c.id, c]));
      const others = (server.posts || []).filter((p) => p.client_id !== activeClientId);
      if (others.length) {
        results.appendChild(el('div', { class: 'gs-sectitle', text: 'Otros clientes' }));
        for (const p of others.slice(0, 12)) {
          const c = byId.get(p.client_id);
          results.appendChild(postRow(p, p.client_name || (c && c.name) || '', c && c.brand_color));
        }
      }
      const foundClients = server.clients || [];
      if (foundClients.length) {
        results.appendChild(el('div', { class: 'gs-sectitle', text: 'Clientes' }));
        for (const c of foundClients.slice(0, 8)) results.appendChild(clientRow(c));
      }
    }

    if (!results.children.length) {
      results.appendChild(el('div', { class: 'gs-empty' }, [
        icon('search', 26),
        el('p', { text: 'No encontramos nada con esa palabra.' }),
      ]));
    }
    prefs.pushRecentSearch(query);
  }

  return { open, close, isOpen };
}
