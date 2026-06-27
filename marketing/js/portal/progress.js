// ============================================================================
// Portal cliente v2 — Badge de progreso del mes.
//
// Card compacta: "Junio: 8 de 12 listos" + bateria horizontal segmentada
// (verde aprobados, ambar por revisar, rosa cambios pedidos), calculada
// client-side desde los posts del mes visible (cero API nueva). La bateria
// anima width cada vez que el cliente aprueba. El numero acompana SIEMPRE al
// color (regla WCAG: nunca solo color). Tap -> sheet de desglose con filas
// navegables.
// ============================================================================

import { el, clear } from '../api.js?v=202606262025';
import { openSheet } from '../shell/sheet.js?v=202606262025';
import * as store from './store.js?v=202606262025';
import { ICONS } from './igcard.js?v=202606262025';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let hostEl = null;
let goToTab = null;
let unsubs = [];

export function mount(host, { onGoToTab }) {
  hostEl = host;
  goToTab = onGoToTab;
  render();
  unsubs.push(store.on('approval', () => update()));
  unsubs.push(store.on('posts', () => update()));
  unsubs.push(store.on('month', () => render()));
}

export function unmount() {
  for (const off of unsubs) off();
  unsubs = [];
  hostEl = null;
}

function monthLabel(cursor) {
  const c = cursor || new Date();
  return `${MONTHS[c.getMonth()]} ${c.getFullYear()}`;
}

export function render() {
  if (!hostEl) return;
  clear(hostEl);

  const cursor = store.state.monthCursor;
  const s = store.monthStats(cursor);

  if (!s.total) {
    // Sin contenido este mes: card informativa, sin bateria ni sheet.
    hostEl.append(el('div', { class: 'pprogress', role: 'status' }, [
      el('div', { class: 'pprogress__row' }, [
        el('span', { class: 'pprogress__month', text: monthLabel(cursor) }),
        el('span', { text: 'aún sin contenido programado ✨' }),
      ]),
    ]));
    return;
  }

  const aria = `${s.approved} de ${s.total} contenidos del mes aprobados`;
  const card = el('button', {
    class: 'pprogress', type: 'button',
    'aria-label': aria + '. Ver desglose',
  }, [
    el('div', { class: 'pprogress__row' }, [
      el('span', { class: 'pprogress__month', text: monthLabel(cursor).split(' ')[0] + ':' }),
      el('span', {}, [
        el('b', { text: `${s.approved} de ${s.total}` }),
        ' listos',
      ]),
      el('span', { class: 'pprogress__chev', html: ICONS.chevdown, 'aria-hidden': 'true' }),
    ]),
    battery(s),
    legend(s),
  ]);
  card.addEventListener('click', () => openBreakdown());
  hostEl.append(card);
}

/** Solo repinta numeros y anchos (la transicion de width hace la animacion). */
export function update() {
  if (!hostEl) return;
  const card = hostEl.querySelector('.pprogress');
  if (!card) { render(); return; }
  const s = store.monthStats(store.state.monthCursor);
  if (!s.total) { render(); return; }

  const b = card.querySelector('.pbattery');
  const lg = card.querySelector('.pprogress__legend');
  const row = card.querySelector('.pprogress__row');
  if (!b || !lg || !row) { render(); return; }

  const segs = b.querySelectorAll('.pbattery__seg');
  if (segs.length === 3) {
    segs[0].style.width = pct(s.approved, s.total);
    segs[1].style.width = pct(s.pending, s.total);
    segs[2].style.width = pct(s.changes, s.total);
  }
  const numEl = row.querySelector('b');
  if (numEl) numEl.textContent = `${s.approved} de ${s.total}`;
  card.setAttribute('aria-label', `${s.approved} de ${s.total} contenidos del mes aprobados. Ver desglose`);
  lg.replaceWith(legend(s));
}

function pct(n, total) { return total ? `${(n / total) * 100}%` : '0%'; }

function battery(s) {
  const b = el('div', { class: 'pbattery', 'aria-hidden': 'true' }, [
    el('span', { class: 'pbattery__seg pbattery__seg--approved' }),
    el('span', { class: 'pbattery__seg pbattery__seg--pending' }),
    el('span', { class: 'pbattery__seg pbattery__seg--changes' }),
  ]);
  // Anchos tras insertar para que la transicion CSS anime desde 0.
  requestAnimationFrame(() => {
    const segs = b.querySelectorAll('.pbattery__seg');
    segs[0].style.width = pct(s.approved, s.total);
    segs[1].style.width = pct(s.pending, s.total);
    segs[2].style.width = pct(s.changes, s.total);
  });
  return b;
}

function legend(s) {
  const item = (color, label, n) => el('span', {}, [
    el('span', { class: 'dot', style: { background: color }, 'aria-hidden': 'true' }),
    el('b', { text: String(n) }),
    ` ${label}`,
  ]);
  return el('div', { class: 'pprogress__legend' }, [
    item('var(--ok)', s.approved === 1 ? 'aprobado' : 'aprobados', s.approved),
    item('var(--warn)', 'por revisar', s.pending),
    s.changes ? item('var(--pink)', 'con cambios', s.changes) : null,
  ]);
}

// ── Sheet de desglose (lectura: backdrop SI cierra) ──────────────────────────
function openBreakdown() {
  const s = store.monthStats(store.state.monthCursor);
  openSheet({
    title: 'Tu mes en ' + monthLabel(store.state.monthCursor).split(' ')[0].toLowerCase(),
    mode: 'menu',
    build(body, close) {
      const row = (color, label, n, go) => {
        const r = el('button', { class: 'pbreak-row', type: 'button' }, [
          el('span', { class: 'dot', style: { background: color }, 'aria-hidden': 'true' }),
          el('span', { text: label }),
          el('span', { class: 'pbreak-row__n', text: String(n) }),
          el('span', { class: 'ico', html: ICONS.chevron, 'aria-hidden': 'true' }),
        ]);
        r.addEventListener('click', () => { close({ source: 'row' }); go(); });
        return r;
      };
      body.append(
        row('var(--ok)', 'Aprobados', s.approved, () => goToTab && goToTab('agenda')),
        row('var(--warn)', 'Por revisar', s.pending, () => goToTab && goToTab('inbox')),
        row('var(--pink)', 'Con cambios pedidos', s.changes, () => goToTab && goToTab('inbox')),
      );
    },
  });
}
