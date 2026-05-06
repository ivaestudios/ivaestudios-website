/* ════════════════════════════════════════════════════════════════════
   portfolio.js
   IVAE Studios · Redesign 2026 · Oleada 3 · Agent 15
   ──────────────────────────────────────────────────────────────────
   Lightbox wrapper for the standalone /portfolio page.

   The homepage portfolio (js/home-portfolio.js) is bound to
   .portfolio__tile--image / [data-portfolio-grid] markup. The
   /portfolio page uses a different, more editorial structure:

     <figure class="portfolio-item" data-category="family">
       <a href="/images/library/file.jpg" data-lightbox>
         <picture><img …></picture>
       </a>
       <figcaption>…</figcaption>
     </figure>

   Rather than fork the existing lightbox styles, this script
   reuses the .portfolio-lightbox CSS already shipped by
   _home-portfolio.css. Behavior parity with home-portfolio.js:
     - Click / Enter / Space on the anchor opens the overlay.
     - Escape, click on backdrop, or close button closes.
     - ArrowLeft / ArrowRight cycle through visible items only
       (so the active filter governs the loop).
     - Focus is trapped while open and restored to the trigger
       on close.
     - Respects prefers-reduced-motion (CSS handles timing).
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!('querySelector' in document) || !('addEventListener' in window)) return;

  const triggers = Array.prototype.slice.call(
    document.querySelectorAll('.portfolio-item [data-lightbox]')
  );
  if (!triggers.length) return;

  // Build a flat set of items. Each entry knows its full-size src, alt,
  // caption, owning figure (for visibility checks), and its trigger
  // anchor (for focus restoration).
  const items = triggers.map(function (anchor) {
    const figure  = anchor.closest('.portfolio-item');
    const img     = anchor.querySelector('img');
    const cap     = figure ? figure.querySelector('figcaption') : null;
    return {
      anchor:  anchor,
      figure:  figure,
      src:     anchor.getAttribute('href') || (img ? img.currentSrc || img.src : ''),
      alt:     img ? (img.getAttribute('alt') || '') : '',
      caption: cap ? cap.textContent.trim() : ''
    };
  });

  // Reuse the same lightbox shell home-portfolio.js builds. If both
  // scripts load on the same page (they shouldn't, but defensive),
  // a second .portfolio-lightbox would just sit idle behind the first.
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

  let activeIndex = 0;
  let lastTrigger = null;

  // Visible items respect the current filter — items hidden via
  // .is-hidden by portfolio-filter.js are skipped by prev/next.
  function visibleItems() {
    return items.filter(function (item) {
      return item.figure && !item.figure.classList.contains('is-hidden');
    });
  }

  function show(index, triggerEl) {
    const visible = visibleItems();
    if (!visible.length) return;
    const len = visible.length;
    activeIndex = ((index % len) + len) % len;
    lastTrigger = triggerEl || visible[activeIndex].anchor;
    render(visible);
    document.body.classList.add('portfolio-lightbox-open');
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(function () { btnClose.focus(); });
  }

  function render(visible) {
    const list = visible || visibleItems();
    if (!list.length) return;
    const item = list[activeIndex];
    lbImage.src = item.src;
    lbImage.alt = item.alt;
    lbCaption.textContent = item.caption;
    const multi = list.length > 1;
    btnPrev.hidden = !multi;
    btnNext.hidden = !multi;
  }

  function next() {
    const visible = visibleItems();
    if (!visible.length) return;
    activeIndex = (activeIndex + 1) % visible.length;
    render(visible);
  }

  function prev() {
    const visible = visibleItems();
    if (!visible.length) return;
    activeIndex = (activeIndex - 1 + visible.length) % visible.length;
    render(visible);
  }

  function close() {
    if (!lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('portfolio-lightbox-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  // ── Anchor click — intercept and open the lightbox ─────────────────
  triggers.forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      // Modifier-clicks (Ctrl/Cmd/middle-click) keep their default open-
      // in-new-tab behavior so users who really want the raw image still
      // get it.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
      event.preventDefault();
      const visible = visibleItems();
      const figure = anchor.closest('.portfolio-item');
      const idx = visible.findIndex(function (item) { return item.figure === figure; });
      show(idx >= 0 ? idx : 0, anchor);
    });
  });

  // ── Lightbox controls ──────────────────────────────────────────────
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', next);

  lb.addEventListener('click', function (event) {
    if (event.target === lb) close();
  });

  // ── Keyboard: Escape, arrows, focus trap ───────────────────────────
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
        const focusables = getFocusables();
        if (!focusables.length) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last  = focusables[focusables.length - 1];
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
