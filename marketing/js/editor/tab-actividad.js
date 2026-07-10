// ============================================================================
// IVAE Marketing v2 - Editor de post: tab Actividad.
//
// Timeline read-only agrupado por dia que MEZCLA:
//   - mkt_approvals (Aprobado / Cambios pedidos, con el comentario citado)
//   - mkt_activity del post (status.change como "Guion -> Grabacion",
//     post.update, post.create, post.comment, post.duplicate, checklist.*)
//
// Chips de filtro: Todo / Decisiones / Cambios de estado.
// "Cargar mas" en paginas de 40. Carga LAZY: solo al abrir el tab.
//
// GET /activity?post_id=<id>&limit=N: el backend v2 filtra por post; el
// backend viejo ignora post_id y devuelve el feed global, asi que SIEMPRE
// re-filtramos client-side por post_id (correcto con ambos).
//
// mount(host, ed) -> dispose()
// ============================================================================

import { el, api, statusLabel, fmtDateTime, avatar } from '../api.js?v=202607092340';
import { icon } from '../shell/icons.js?v=202607092340';

const PAGE = 40;

// Verbos del feed en es-MX (espejo de logActivity del backend).
const ACTION_LABELS = {
  'post.create': 'creo el contenido',
  'post.update': 'edito el contenido',
  'status.change': 'movio el estado',
  'post.comment': 'comento',
  'post.approve': 'aprobo',
  'post.request_changes': 'pidio cambios',
  'post.delete': 'elimino el contenido',
  'post.duplicate': 'duplico el contenido',
  'post.reorder': 'reordeno contenidos',
  'post.bulk_update': 'edito en lote',
  'checklist.add': 'agrego un paso a la checklist',
  'checklist.done': 'completo un paso de la checklist',
  'checklist.delete': 'elimino un paso de la checklist',
};

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'));
  return isNaN(d) ? null : d;
}

function dayKey(iso) {
  const d = toDate(iso);
  if (!d) return 'Sin fecha';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeOf(iso) {
  const d = toDate(iso);
  return d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
}

/** "guion→grabacion" -> "Guion -> Grabacion" con labels bonitos. */
function statusChangeText(detail) {
  const parts = String(detail || '').split('→').map((s) => s.trim());
  if (parts.length === 2) return `${statusLabel(parts[0])} a ${statusLabel(parts[1])}`;
  return String(detail || '');
}

export function mount(host, ed) {
  let filter = 'todo';   // 'todo' | 'decisiones' | 'estados'
  let limit = PAGE;
  let hasMore = false;
  let loading = false;
  let loaded = false;
  let disposed = false;
  let activity = [];

  const root = el('div', { class: 'edtab edtab-actividad' });

  // ── Chips de filtro ────────────────────────────────────────────────────────
  const chipsEl = el('div', { class: 'edact__chips', role: 'tablist', 'aria-label': 'Filtro de actividad' });
  const CHIPS = [
    { key: 'todo', label: 'Todo' },
    { key: 'decisiones', label: 'Decisiones' },
    { key: 'estados', label: 'Cambios de estado' },
  ];
  for (const c of CHIPS) {
    chipsEl.appendChild(el('button', {
      class: 'edact__chip', type: 'button', role: 'tab', dataset: { key: c.key },
      text: c.label,
      onclick: () => { filter = c.key; render(); },
    }));
  }

  const listEl = el('div', { class: 'edact__list' });
  const moreBtn = el('button', {
    class: 'btn edact__more', type: 'button', text: 'Cargar mas', hidden: true,
    onclick: () => { limit += PAGE; load(); },
  });

  root.append(chipsEl, listEl, moreBtn);

  // ── Mezcla y filtrado ──────────────────────────────────────────────────────
  function mergedEntries() {
    const out = [];
    for (const a of ed.getApprovals()) {
      out.push({
        kind: 'approval',
        id: `ap-${a.id}`,
        actor: a.actor_name || 'Cliente',
        decision: a.decision,
        comment: a.comment,
        created_at: a.created_at,
      });
    }
    for (const a of activity) {
      // Las decisiones ya entran por mkt_approvals: evita duplicarlas.
      if (a.action === 'post.approve' || a.action === 'post.request_changes') continue;
      out.push({
        kind: 'activity',
        id: `ac-${a.id}`,
        actor: a.actor_name || 'Alguien',
        action: a.action,
        detail: a.detail,
        created_at: a.created_at,
      });
    }
    out.sort((x, y) => String(y.created_at || '').localeCompare(String(x.created_at || '')));
    if (filter === 'decisiones') return out.filter((e) => e.kind === 'approval');
    if (filter === 'estados') return out.filter((e) => e.kind === 'activity' && e.action === 'status.change');
    return out;
  }

  function entryNode(e) {
    let line;
    let detailNode = null;
    if (e.kind === 'approval') {
      const ok = e.decision === 'approved';
      line = el('span', { class: 'edact__line' }, [
        el('b', { text: e.actor }),
        ` ${ok ? 'aprobo este contenido' : 'pidio cambios'}`,
      ]);
      if (e.comment) {
        detailNode = el('blockquote', { class: 'edact__quote', text: e.comment });
      }
    } else {
      const verb = ACTION_LABELS[e.action] || e.action;
      line = el('span', { class: 'edact__line' }, [el('b', { text: e.actor }), ` ${verb}`]);
      if (e.action === 'status.change' && e.detail) {
        detailNode = el('span', { class: 'edact__detail' }, [
          icon('right', 12),
          el('span', { text: statusChangeText(e.detail) }),
        ]);
      } else if (e.action === 'post.update' && e.detail) {
        detailNode = el('span', { class: 'edact__detail edact__detail--muted', text: String(e.detail).split(',').join(', ') });
      } else if ((e.action || '').startsWith('checklist.') && e.detail) {
        detailNode = el('span', { class: 'edact__detail edact__detail--muted', text: String(e.detail) });
      }
    }

    const dotClass =
      e.kind === 'approval'
        ? (e.decision === 'approved' ? ' is-approved' : ' is-changes')
        : (e.action === 'status.change' ? ' is-status' : '');

    return el('div', { class: 'edact__entry' }, [
      el('span', { class: 'edact__dot' + dotClass }),
      el('div', { class: 'edact__body' }, [
        el('div', { class: 'edact__top' }, [
          avatar(e.actor, true),
          line,
          el('span', { class: 'edact__time', title: fmtDateTime(e.created_at), text: timeOf(e.created_at) }),
        ]),
        detailNode,
      ]),
    ]);
  }

  function render() {
    for (const b of chipsEl.querySelectorAll('button')) {
      const is = b.dataset.key === filter;
      b.classList.toggle('is-active', is);
      b.setAttribute('aria-selected', is ? 'true' : 'false');
    }

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (loading && !loaded) {
      listEl.appendChild(el('div', { class: 'edact__loading' }, [
        el('span', { class: 'spinner', 'aria-hidden': 'true' }),
        el('span', { class: 'muted', text: 'Cargando actividad' }),
      ]));
      return;
    }

    const entries = mergedEntries();
    if (!entries.length) {
      listEl.appendChild(el('div', { class: 'edconv__empty' }, [
        el('p', { class: 'muted', text: filter === 'todo' ? 'Sin actividad todavia.' : 'Nada con este filtro.' }),
      ]));
      moreBtn.hidden = !hasMore;
      return;
    }

    let lastDay = null;
    for (const e of entries) {
      const day = dayKey(e.created_at);
      if (day !== lastDay) {
        lastDay = day;
        listEl.appendChild(el('div', { class: 'edact__day', text: day }));
      }
      listEl.appendChild(entryNode(e));
    }
    moreBtn.hidden = !hasMore;
  }

  // ── Carga lazy ─────────────────────────────────────────────────────────────
  async function load() {
    if (loading) return;
    loading = true;
    render();
    try {
      const res = await api.get(`/activity?post_id=${encodeURIComponent(ed.postId)}&limit=${limit}`);
      if (disposed) return;
      const rows = Array.isArray(res) ? res : (res && res.activity) || [];
      // El backend viejo ignora post_id: SIEMPRE re-filtrar client-side.
      activity = rows.filter((a) => a && a.post_id === ed.postId);
      hasMore = rows.length >= limit;
      loaded = true;
    } catch {
      if (disposed) return;
      loaded = true;
      hasMore = false;
      if (!activity.length) {
        activity = [];
      }
    } finally {
      loading = false;
      if (!disposed) render();
    }
  }

  host.appendChild(root);
  render();
  load();

  return function dispose() {
    disposed = true;
  };
}
