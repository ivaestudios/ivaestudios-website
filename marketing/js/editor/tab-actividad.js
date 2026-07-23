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

import { el, api, statusLabel, fmtDateTime, avatar } from '../api.js?v=202607221924';
import { icon } from '../shell/icons.js?v=202607221924';
import { T } from '../shell/i18n.js?v=202607221924';

const PAGE = 40;

// Verbos del feed en es-MX (espejo de logActivity del backend).
const ACTION_LABELS = {
  'post.create': T('creo el contenido', 'created the content'),
  'post.update': T('edito el contenido', 'edited the content'),
  'status.change': T('movio el estado', 'moved the status'),
  'post.comment': T('comento', 'commented'),
  'post.approve': T('aprobo', 'approved'),
  'post.request_changes': T('pidio cambios', 'requested changes'),
  'post.delete': T('elimino el contenido', 'deleted the content'),
  'post.duplicate': T('duplico el contenido', 'duplicated the content'),
  'post.reorder': T('reordeno contenidos', 'reordered content'),
  'post.bulk_update': T('edito en lote', 'bulk-edited'),
  'checklist.add': T('agrego un paso a la checklist', 'added a checklist step'),
  'checklist.done': T('completo un paso de la checklist', 'completed a checklist step'),
  'checklist.delete': T('elimino un paso de la checklist', 'deleted a checklist step'),
};

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'));
  return isNaN(d) ? null : d;
}

function dayKey(iso) {
  const d = toDate(iso);
  if (!d) return T('Sin fecha', 'No date');
  return d.toLocaleDateString(T('es-MX', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeOf(iso) {
  const d = toDate(iso);
  return d ? d.toLocaleTimeString(T('es-MX', 'en-US'), { hour: '2-digit', minute: '2-digit' }) : '';
}

/** "guion→grabacion" -> "Guion -> Grabacion" con labels bonitos. */
function statusChangeText(detail) {
  const parts = String(detail || '').split('→').map((s) => s.trim());
  if (parts.length === 2) return `${statusLabel(parts[0])} ${T('a', 'to')} ${statusLabel(parts[1])}`;
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
  const chipsEl = el('div', { class: 'edact__chips', role: 'tablist', 'aria-label': T('Filtro de actividad', 'Activity filter') });
  const CHIPS = [
    { key: 'todo', label: T('Todo', 'All') },
    { key: 'decisiones', label: T('Decisiones', 'Decisions') },
    { key: 'estados', label: T('Cambios de estado', 'Status changes') },
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
    class: 'btn edact__more', type: 'button', text: T('Cargar mas', 'Load more'), hidden: true,
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
        actor: a.actor_name || T('Cliente', 'Client'),
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
        actor: a.actor_name || T('Alguien', 'Someone'),
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
        ` ${ok ? T('aprobo este contenido', 'approved this content') : T('pidio cambios', 'requested changes')}`,
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
        el('span', { class: 'muted', text: T('Cargando actividad', 'Loading activity') }),
      ]));
      return;
    }

    const entries = mergedEntries();
    if (!entries.length) {
      listEl.appendChild(el('div', { class: 'edconv__empty' }, [
        el('p', { class: 'muted', text: filter === 'todo' ? T('Sin actividad todavia.', 'No activity yet.') : T('Nada con este filtro.', 'Nothing with this filter.') }),
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
