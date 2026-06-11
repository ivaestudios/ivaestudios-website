// ============================================================================
// IVAE Marketing v2 — Kanban: "Mover a" (bottom sheet) + matematicas de
// posicion sparse compartidas con la vista.
//
// El sheet es el fallback SIEMPRE visible del drag (regla del motor dnd):
// en movil mover una tarjeta con precision es mas facil asi que arrastrando.
//
// Posiciones: sparse en pasos de 1000. Si el hueco se agota o la columna
// tiene posiciones nulas o duplicadas, se renormaliza la columna COMPLETA en
// el MISMO batch de /posts/reorder (contrato store.reorder).
//
// Exporta ademas helpers puros (sin DOM) que views/kanban.js reutiliza:
//   STEP, OTHERS_KEY, columnKeyOf, comparePosts, sortColumn,
//   buildInsertUpdates(fullList, insertIdx, post, newStatus)
// ============================================================================

import { el, STATUSES, STATUS_ORDER } from '../api.js?v=202606110017';
import { icon } from '../shell/icons.js?v=202606110017';

export const STEP = 1000;
export const OTHERS_KEY = '__otros__';
export const OTHERS_LABEL = 'Otros';
export const OTHERS_COLOR = 'var(--text-mute)';

/** Columna a la que pertenece un post: status conocido o bucket Otros. */
export function columnKeyOf(post) {
  const s = post && post.status;
  return (s && STATUSES && STATUSES[s]) ? s : OTHERS_KEY;
}

/** Orden estable dentro de una columna: position asc (null al final), luego
 *  fecha de publicacion asc (sin fecha al final), luego titulo, luego id. */
export function comparePosts(a, b) {
  const pa = (a.position == null || Number.isNaN(Number(a.position))) ? null : Number(a.position);
  const pb = (b.position == null || Number.isNaN(Number(b.position))) ? null : Number(b.position);
  if (pa != null && pb != null && pa !== pb) return pa - pb;
  if (pa != null && pb == null) return -1;
  if (pa == null && pb != null) return 1;
  const da = a.publish_date || '';
  const db = b.publish_date || '';
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  const ta = String(a.title || '').toLowerCase();
  const tb = String(b.title || '').toLowerCase();
  if (ta !== tb) return ta < tb ? -1 : 1;
  return String(a.id) < String(b.id) ? -1 : 1;
}

export function sortColumn(posts) {
  return [...posts].sort(comparePosts);
}

function needsNormalize(list) {
  const seen = new Set();
  for (const p of list) {
    const pos = p.position;
    if (pos == null || Number.isNaN(Number(pos))) return true;
    if (seen.has(Number(pos))) return true;
    seen.add(Number(pos));
  }
  return false;
}

/**
 * Calcula el batch de updates para insertar `post` en `insertIdx` dentro de
 * `fullList` (columna destino ORDENADA y SIN el post movido).
 * Devuelve [{id, position, status?}]: 1 update si hay hueco sparse;
 * la columna completa renormalizada (pasos de 1000) si no lo hay.
 * `newStatus` viaja solo en el update del post movido (null = sin cambio,
 * p. ej. reorden dentro de Otros).
 */
export function buildInsertUpdates(fullList, insertIdx, post, newStatus = null) {
  const idx = Math.max(0, Math.min(insertIdx, fullList.length));
  const prev = idx > 0 ? fullList[idx - 1] : null;
  const next = idx < fullList.length ? fullList[idx] : null;

  const movedExtra = newStatus ? { status: newStatus } : {};

  if (!needsNormalize(fullList)) {
    let pos = null;
    if (!prev && !next) {
      pos = STEP;
    } else if (prev && next) {
      const mid = Math.floor((Number(prev.position) + Number(next.position)) / 2);
      if (mid > Number(prev.position) && mid < Number(next.position)) pos = mid;
    } else if (prev) {
      pos = Number(prev.position) + STEP;
    } else if (next) {
      const cand = Number(next.position) - STEP;
      if (cand > 0) pos = cand;
      else if (Number(next.position) > 1) pos = Math.floor(Number(next.position) / 2);
    }
    if (pos != null) {
      return [{ id: post.id, position: pos, ...movedExtra }];
    }
  }

  // Renormalizacion: columna completa (incluido el movido) en el mismo batch.
  const finalOrder = [...fullList];
  finalOrder.splice(idx, 0, post);
  const updates = [];
  finalOrder.forEach((p, i) => {
    const pos = (i + 1) * STEP;
    if (p.id === post.id) {
      updates.push({ id: p.id, position: pos, ...movedExtra });
    } else if (p.position !== pos) {
      updates.push({ id: p.id, position: pos });
    }
  });
  return updates;
}

/** Snapshot {id, position, status} de los posts tocados (para Deshacer). */
export function snapshotFor(updates, posts) {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const snap = [];
  for (const u of updates) {
    const p = byId.get(u.id);
    if (!p) continue;
    const s = { id: p.id, position: p.position == null ? null : Number(p.position) };
    if (u.status !== undefined) s.status = p.status;
    snap.push(s);
  }
  return snap;
}

// ── Sheet "Mover a" ──────────────────────────────────────────────────────────
/**
 * openMoveSheet({ ctx, post, getColumns, getFullColumn, onMoved })
 *   - getColumns(): [{key,label,color,count}] columnas visibles del tablero
 *     (incluye Otros solo si existe; Otros NO es destino valido).
 *   - getFullColumn(key): posts COMPLETOS (sin filtros) de esa columna,
 *     ordenados, SIN excluir al movido (aqui se excluye).
 *   - onMoved(updates): el dueño ejecuta el reorder (con undo).
 * Paso 1: elegir columna destino. Paso 2: Al inicio o Al final.
 */
export function openMoveSheet({ ctx, post, getColumns, getFullColumn, onMoved }) {
  const fromKey = columnKeyOf(post);

  ctx.sheet.openSheet({
    title: 'Mover a',
    mode: 'picker',
    build(body, close) {
      const list = el('div', { class: 'pick-list', role: 'listbox' });

      const columns = getColumns().filter((c) => c.key !== OTHERS_KEY);
      // Reorden dentro de Otros: unica forma de "mover" sin status valido.
      if (fromKey === OTHERS_KEY) {
        columns.unshift({ key: OTHERS_KEY, label: `${OTHERS_LABEL} (sin cambiar estado)`, color: OTHERS_COLOR, count: null });
      }

      for (const col of columns) {
        const isCurrent = col.key === fromKey;
        list.appendChild(el('button', {
          class: 'pick-row' + (isCurrent ? ' is-current' : ''),
          type: 'button', role: 'option',
          'aria-selected': isCurrent ? 'true' : 'false',
          onclick: () => pickPlace(col),
        }, [
          el('span', { class: 'pick-row__dot', style: { background: col.color || 'var(--text-mute)' } }),
          el('span', { class: 'pick-row__main' }, [
            el('span', { class: 'pick-row__label', text: col.label }),
            col.count != null ? el('span', { class: 'pick-row__sub', text: col.count === 1 ? '1 tarjeta' : `${col.count} tarjetas` }) : null,
          ]),
          isCurrent ? el('span', { class: 'pick-row__check', text: '✓' }) : null,
        ]));
      }
      body.appendChild(list);

      function pickPlace(col) {
        // Paso 2: posicion dentro de la columna (sheet apilado, max 2 capas).
        ctx.sheet.openSheet({
          title: `Mover a ${col.key === OTHERS_KEY ? OTHERS_LABEL : col.label}`,
          mode: 'picker',
          build(body2, close2) {
            const choose = (where) => {
              close2({ source: 'pick' });
              close({ source: 'pick' });
              apply(col, where);
            };
            body2.appendChild(el('div', { class: 'pick-list' }, [
              el('button', { class: 'pick-row', type: 'button', onclick: () => choose('start') }, [
                icon('up', 18),
                el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: 'Al inicio' })]),
              ]),
              el('button', { class: 'pick-row', type: 'button', onclick: () => choose('end') }, [
                icon('down', 18),
                el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: 'Al final' })]),
              ]),
            ]));
          },
        });
      }

      function apply(col, where) {
        const full = getFullColumn(col.key).filter((p) => p.id !== post.id);
        const idx = where === 'start' ? 0 : full.length;
        const newStatus = (col.key !== OTHERS_KEY && col.key !== fromKey) ? col.key : null;
        const updates = buildInsertUpdates(full, idx, post, newStatus);
        try { onMoved?.(updates, col); } catch (e) { console.error('[kanban] onMoved', e); }
      }
    },
  });
}
