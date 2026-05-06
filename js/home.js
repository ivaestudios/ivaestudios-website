/* ============================================================
 * IVAE Studios — homepage orchestrator
 * Oleada 2 · Agent 13
 *
 * Wires up the global helpers (IVAE.anim, IVAE.image) and adds
 * the few homepage-only behaviors:
 *   - thin gold scroll-progress line at the top of the viewport
 *   - smooth-scroll fallback for in-page anchors with sticky-nav
 *     offset (older Safari and JS-triggered hash navigation)
 *   - FAQ deep-linking via #faq-N (open <details> on load + on
 *     hashchange)
 *
 * Does not duplicate work from nav.js, animations.js, or
 * image-loader.js — they each auto-init.
 * ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STICKY_OFFSET_VAR = '--space-9';
  const PROGRESS_ID = 'ivae-scroll-progress';
  const FAQ_PATTERN = /^#faq-\d+$/;

  /* ─── Section progress indicator ─────────────────────────── */

  function initScrollProgress() {
    let bar = document.getElementById(PROGRESS_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = PROGRESS_ID;
      bar.setAttribute('aria-hidden', 'true');
      // Inline styles — avoid coordinating with Agent 12's CSS
      // orchestrator. The progress bar is not a "section".
      Object.assign(bar.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        height: '1px',
        width: '0%',
        background: 'var(--editorial-gold, #C4A35A)',
        zIndex: 'var(--z-overlay, 500)',
        pointerEvents: 'none',
        transformOrigin: '0 50%',
        willChange: REDUCED ? 'auto' : 'width'
      });
      document.body.insertBefore(bar, document.body.firstChild);
    }

    let scheduled = false;
    const update = () => {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = Math.max(0, Math.min(1, window.scrollY / max));
      bar.style.width = (pct * 100).toFixed(2) + '%';
      scheduled = false;
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ─── Anchor smooth-scroll fixup for sticky nav offset ──── */

  function getStickyOffset() {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(STICKY_OFFSET_VAR)
      .trim();
    const px = parseFloat(v);
    return Number.isFinite(px) ? px : 96;
  }

  function initAnchorSmoothScroll() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      if (!hash || hash === '#' || hash.length < 2) return;
      let target = null;
      try { target = document.querySelector(hash); } catch (_) { return; }
      if (!target) return;

      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const top = rect.top + window.scrollY - getStickyOffset();
      window.scrollTo({
        top: top,
        behavior: REDUCED ? 'auto' : 'smooth'
      });
      if (window.history && typeof window.history.pushState === 'function') {
        window.history.pushState(null, '', hash);
      }
    });
  }

  /* ─── FAQ accordion deep-linking ─────────────────────────── */

  function openFaqFromHash() {
    const hash = window.location.hash;
    if (!hash || !FAQ_PATTERN.test(hash)) return;
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY - getStickyOffset();
    window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function initFaqDeepLink() {
    if (window.location.hash && FAQ_PATTERN.test(window.location.hash)) {
      // Defer one frame so layout has settled.
      window.requestAnimationFrame(openFaqFromHash);
    }
    window.addEventListener('hashchange', openFaqFromHash);
  }

  /* ─── Bootstrap ──────────────────────────────────────────── */

  function init() {
    initScrollProgress();
    initAnchorSmoothScroll();
    initFaqDeepLink();
    // Re-scan reveals for any nodes added after animations.js ran.
    if (window.IVAE && window.IVAE.anim && typeof window.IVAE.anim.refresh === 'function') {
      window.IVAE.anim.refresh();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.IVAE = window.IVAE || {};
  window.IVAE.home = {
    initScrollProgress: initScrollProgress,
    initAnchorSmoothScroll: initAnchorSmoothScroll,
    initFaqDeepLink: initFaqDeepLink
  };
}());
