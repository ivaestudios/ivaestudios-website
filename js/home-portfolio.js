/* ════════════════════════════════════════════════════════════════════
   home-portfolio.js
   IVAE Studios · Redesign 2026 · Oleada 2 · Agent 04
   Minimal, dependency-free lightbox for the homepage portfolio grid.
   - Click / Enter / Space on .portfolio__tile--image opens the overlay.
   - Escape, click on backdrop, or close button closes.
   - ArrowLeft / ArrowRight cycle through the image set.
   - Focus is trapped while open and restored to the trigger on close.
   - Respects prefers-reduced-motion (CSS handles the timing reduction).
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Bail quietly on legacy browsers — the grid still renders, just no lightbox.
  if (!('querySelector' in document) || !('addEventListener' in window)) return;

  const grids = document.querySelectorAll('[data-portfolio-grid]');
  if (!grids.length) return;

  // Build a per-grid image set so the prev/next loop only includes that grid's
  // images, not images from another locale block on the same page.
  const sets = [];
  grids.forEach(function (grid) {
    const tiles = grid.querySelectorAll('.portfolio__tile--image');
    if (!tiles.length) return;
    const set = [];
    tiles.forEach(function (tile) {
      const img = tile.querySelector('img');
      const captionEl = tile.querySelector('figcaption');
      const trigger = tile.querySelector('.portfolio__tile-trigger') || tile;
      set.push({
        tile: tile,
        trigger: trigger,
        src: img ? img.currentSrc || img.src : '',
        alt: img ? img.alt || '' : '',
        caption: captionEl ? captionEl.textContent.trim() : ''
      });
    });
    if (set.length) sets.push(set);
  });
  if (!sets.length) return;

  // ── Build a single shared lightbox dialog ──────────────────────────
  const lb = document.createElement('div');
  lb.className = 'portfolio-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Portfolio image viewer');
  lb.setAttribute('aria-hidden', 'true');
  lb.tabIndex = -1;
  lb.innerHTML = [
    '<button type="button" class="portfolio-lightbox__btn portfolio-lightbox__close" aria-label="Close">',
    '<span aria-hidden="true">&times;</span>',
    '</button>',
    '<button type="button" class="portfolio-lightbox__btn portfolio-lightbox__prev" aria-label="Previous image">',
    '<span aria-hidden="true">&larr;</span>',
    '</button>',
    '<button type="button" class="portfolio-lightbox__btn portfolio-lightbox__next" aria-label="Next image">',
    '<span aria-hidden="true">&rarr;</span>',
    '</button>',
    '<div class="portfolio-lightbox__stage">',
    '<img class="portfolio-lightbox__image" alt="">',
    '<p class="portfolio-lightbox__caption" aria-live="polite"></p>',
    '</div>'
  ].join('');
  document.body.appendChild(lb);

  const lbImage   = lb.querySelector('.portfolio-lightbox__image');
  const lbCaption = lb.querySelector('.portfolio-lightbox__caption');
  const btnClose  = lb.querySelector('.portfolio-lightbox__close');
  const btnPrev   = lb.querySelector('.portfolio-lightbox__prev');
  const btnNext   = lb.querySelector('.portfolio-lightbox__next');

  let activeSet = null;
  let activeIndex = 0;
  let lastTrigger = null;

  function show(setIdx, imgIdx, triggerEl) {
    activeSet = sets[setIdx];
    if (!activeSet) return;
    activeIndex = ((imgIdx % activeSet.length) + activeSet.length) % activeSet.length;
    lastTrigger = triggerEl || activeSet[activeIndex].trigger;
    render();
    document.body.classList.add('portfolio-lightbox-open');
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    // Defer focus until after the transition kicks off.
    window.requestAnimationFrame(function () { btnClose.focus(); });
  }

  function render() {
    const item = activeSet[activeIndex];
    lbImage.src = item.src;
    lbImage.alt = item.alt;
    lbCaption.textContent = item.caption;
    // Hide prev/next when there's only one image.
    const multi = activeSet.length > 1;
    btnPrev.hidden = !multi;
    btnNext.hidden = !multi;
  }

  function next() {
    if (!activeSet) return;
    activeIndex = (activeIndex + 1) % activeSet.length;
    render();
  }

  function prev() {
    if (!activeSet) return;
    activeIndex = (activeIndex - 1 + activeSet.length) % activeSet.length;
    render();
  }

  function close() {
    if (!lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('portfolio-lightbox-open');
    // Restore focus to whatever opened the dialog.
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    activeSet = null;
    lastTrigger = null;
  }

  // ── Tile click / keyboard binding ──────────────────────────────────
  sets.forEach(function (set, setIdx) {
    set.forEach(function (entry, imgIdx) {
      const trigger = entry.trigger;
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        show(setIdx, imgIdx, trigger);
      });
      // <button> elements handle Enter/Space natively. For non-button
      // triggers, add explicit keyboard support.
      if (trigger.tagName !== 'BUTTON') {
        trigger.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            show(setIdx, imgIdx, trigger);
          }
        });
      }
    });
  });

  // ── Lightbox controls ──────────────────────────────────────────────
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', next);

  // Click on backdrop (the dialog itself), not on the stage.
  lb.addEventListener('click', function (event) {
    if (event.target === lb) close();
  });

  // ── Keyboard: Escape closes, arrows navigate, Tab is trapped ───────
  function getFocusables() {
    return [btnClose, btnPrev, btnNext].filter(function (el) {
      return !el.hidden && !el.disabled;
    });
  }

  document.addEventListener('keydown', function (event) {
    if (!lb.classList.contains('is-open')) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowRight':
        event.preventDefault();
        next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        prev();
        break;
      case 'Tab': {
        // Focus trap — only loop through the dialog's focusables.
        const focusables = getFocusables();
        if (!focusables.length) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        break;
      }
      default:
        break;
    }
  });
})();
