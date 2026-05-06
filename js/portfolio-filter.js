/* ════════════════════════════════════════════════════════════════════
   portfolio-filter.js
   IVAE Studios · Redesign 2026 · Oleada 3 · Agent 15
   ──────────────────────────────────────────────────────────────────
   Category filter for the standalone /portfolio page.

     <nav class="portfolio-filter">
       <button data-filter="*"        aria-pressed="true">All</button>
       <button data-filter="family"   aria-pressed="false">Family</button>
       …
     </nav>
     <div class="portfolio-justified-grid">
       <figure class="portfolio-item" data-category="family">…</figure>
       …
       <div class="portfolio-empty" data-empty>…</div>
     </div>

   Behavior:
     - Click on a filter button toggles its aria-pressed=true and sets
       the matching siblings to aria-pressed=false.
     - Items whose data-category does NOT match the active filter get
       the .is-hidden class. CSS handles the actual hide via display:none
       so the column flow re-balances naturally.
     - "*" matches everything (unhides all items).
     - If the active filter has zero matching items, the .portfolio-empty
       block gets .is-active so the soft fallback message ("12 sessions
       in this category — galleries available on request") shows.
     - URL hash (#family) is read on load and written on click so the
       chosen filter survives reloads and is shareable.
     - No JS = all items visible (CSS does not hide anything by default).

   Pattern is intentionally close to a future js/blog-filter.js so the
   two stay easy to refactor side-by-side.
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!('querySelector' in document) || !('addEventListener' in window)) return;

  const navs = document.querySelectorAll('.portfolio-filter');
  if (!navs.length) return;

  const grids = document.querySelectorAll('.portfolio-justified-grid');
  if (!grids.length) return;

  // Allow multiple filter / grid pairs on a page (defensive — we only
  // ship one today, but the home portfolio could adopt this later).
  navs.forEach(function (nav) {
    // The grid that this filter controls. If the nav has aria-controls,
    // honor it. Otherwise, take the next .portfolio-justified-grid in
    // document order.
    let grid = null;
    const controlsId = nav.getAttribute('aria-controls');
    if (controlsId) {
      grid = document.getElementById(controlsId);
    }
    if (!grid) {
      // Walk forward through siblings/descendants until we find a grid.
      grid = document.querySelector('.portfolio-justified-grid');
    }
    if (!grid) return;

    const buttons = nav.querySelectorAll('button[data-filter]');
    const items   = grid.querySelectorAll('.portfolio-item');
    const empty   = grid.querySelector('.portfolio-empty');

    function setEmptyState(visibleCount, label) {
      if (!empty) return;
      if (visibleCount > 0) {
        empty.classList.remove('is-active');
        return;
      }
      // Swap the category label inside the empty block, if a slot exists.
      const slot = empty.querySelector('[data-empty-label]');
      if (slot && label) {
        slot.textContent = label;
      }
      empty.classList.add('is-active');
    }

    function applyFilter(value, label) {
      let visibleCount = 0;
      items.forEach(function (item) {
        const cat = item.getAttribute('data-category') || '';
        const matches = (value === '*') || (cat === value);
        item.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });
      setEmptyState(visibleCount, label);
    }

    function setActive(button) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        const value = button.getAttribute('data-filter') || '*';
        const label = (button.textContent || '').trim();
        setActive(button);
        applyFilter(value, label);
        // Persist in the URL hash so reloads / share-links retain state.
        // We use replaceState (not assign) to avoid clobbering history.
        if (window.history && window.history.replaceState) {
          const newHash = (value === '*') ? '' : ('#' + value);
          const url = window.location.pathname + window.location.search + newHash;
          window.history.replaceState(null, '', url);
        }
      });
    });

    // Initial state — read hash, pick matching button, otherwise "*".
    const initial = (window.location.hash || '').replace(/^#/, '');
    let initialButton = null;
    if (initial) {
      buttons.forEach(function (b) {
        if (b.getAttribute('data-filter') === initial) initialButton = b;
      });
    }
    if (initialButton) {
      setActive(initialButton);
      applyFilter(initial, (initialButton.textContent || '').trim());
    } else {
      // Honor the aria-pressed=true that ships in the HTML (defaults to "All").
      const pressed = nav.querySelector('button[aria-pressed="true"]');
      if (pressed) {
        applyFilter(pressed.getAttribute('data-filter') || '*',
                    (pressed.textContent || '').trim());
      }
    }
  });
})();
