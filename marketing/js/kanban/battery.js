// ============================================================================
// IVAE Marketing v2 — Kanban: bateria de estados (resumen estilo Monday).
//
// Barra apilada con un segmento por columna del tablero, proporcional al
// numero de tarjetas. La barra completa es UN solo target tactil (>=44px):
// al tocarla, el dueño (views/kanban.js) abre un resumen por estado.
// Los segmentos individuales son decorativos (spans), nunca botones chicos.
//
// API:
//   createBattery({ onOpen }) -> { el, update(segments) }
//   segments: [{ key, label, color, count }]
// ============================================================================

import { el, clear } from '../api.js?v=202607032115';

export function createBattery({ onOpen } = {}) {
  const bar = el('div', { class: 'kb-battery__bar', 'aria-hidden': 'true' });
  const totalEl = el('span', { class: 'kb-battery__total' });
  const topEl = el('span', { class: 'kb-battery__top' });

  const root = el('button', {
    class: 'kb-battery',
    type: 'button',
    'aria-label': 'Resumen por estado',
    onclick: () => { try { onOpen?.(); } catch (e) { console.error('[kanban] battery onOpen', e); } },
  }, [
    el('span', { class: 'kb-battery__meta' }, [totalEl, topEl]),
    bar,
  ]);

  /**
   * Repinta la bateria. Segmentos con count 0 no se dibujan.
   * Con 0 tarjetas la bateria se oculta por completo.
   */
  function update(segments = []) {
    const visible = segments.filter((s) => s && s.count > 0);
    const total = visible.reduce((n, s) => n + s.count, 0);

    clear(bar);
    if (!total) {
      root.hidden = true;
      return;
    }
    root.hidden = false;

    for (const s of visible) {
      bar.appendChild(el('span', {
        class: 'kb-battery__seg',
        style: {
          width: `${Math.max(2, (s.count / total) * 100)}%`,
          background: s.color || 'var(--text-mute)',
        },
        title: `${s.label}: ${s.count}`,
      }));
    }

    totalEl.textContent = total === 1 ? '1 contenido' : `${total} contenidos`;

    // El estado con mas tarjetas, como pista rapida.
    const top = visible.reduce((a, b) => (b.count > a.count ? b : a), visible[0]);
    topEl.textContent = `${top.label} ${top.count}`;

    root.setAttribute(
      'aria-label',
      'Resumen por estado: ' + visible.map((s) => `${s.label} ${s.count}`).join(', ')
    );
  }

  return { el: root, update };
}
