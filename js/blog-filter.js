/* ============================================================
   blog-filter.js  ·  Journal — category filter
   IVAE Studios · Redesign 2026 · Oleada 3 · Agent 13

   Progressive enhancement on /blog and /es/blog. The archive
   list ships fully visible; this script wires the button group
   so a click hides items whose data-category does not match.
   No JS = all entries visible, filter buttons inert.

   Pairs with `.blog-filter button[data-filter]` and
   `.archive-list .archive-item[data-category]` in
   styles/_blog-index.css.
   ============================================================ */

(function () {
  'use strict';

  const filterRoot = document.querySelector('.blog-filter');
  const list = document.querySelector('.archive-list');
  if (!filterRoot || !list) return;

  const buttons = Array.from(filterRoot.querySelectorAll('button[data-filter]'));
  const items = Array.from(list.querySelectorAll('.archive-item'));
  if (buttons.length === 0 || items.length === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setActive(btn) {
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
  }

  function applyFilter(category) {
    const showAll = !category || category === '*';
    items.forEach(function (item) {
      const cats = (item.getAttribute('data-category') || '').split(/\s+/);
      const match = showAll || cats.indexOf(category) !== -1;
      item.classList.toggle('is-hidden', !match);
      if (!reduceMotion && match) {
        item.style.opacity = '';
      }
    });

    const liveRegion = document.getElementById('blog-filter-live');
    if (liveRegion) {
      const visible = items.filter(function (i) { return !i.classList.contains('is-hidden'); }).length;
      liveRegion.textContent = visible + ' entries';
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const filter = btn.getAttribute('data-filter') || '*';
      setActive(btn);
      applyFilter(filter);
    });
  });

  // Keyboard navigation: left/right arrows move focus across the button group.
  filterRoot.addEventListener('keydown', function (event) {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    const current = document.activeElement;
    const idx = buttons.indexOf(current);
    if (idx === -1) return;
    event.preventDefault();
    const delta = key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(idx + delta + buttons.length) % buttons.length];
    next.focus();
  });
})();
