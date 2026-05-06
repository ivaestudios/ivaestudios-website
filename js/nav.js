/* ============================================================
 * IVAE Studios — Primary navigation behaviour
 * Oleada 1 · Agent 04
 * Sticky scroll state, mobile drawer, focus trap, a11y wiring.
 * ============================================================ */
(function () {
  'use strict';

  const SCROLL_THRESHOLD = 24;
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const header = document.querySelector('.site-nav');
  const drawer = document.getElementById('nav-drawer');
  const toggle = header && header.querySelector('.site-nav__toggle');
  const closeBtn = drawer && drawer.querySelector('.nav-drawer__close');
  if (!header) return;

  /* ─── Scroll state ─────────────────────────────────────── */
  let scrollScheduled = false;
  let lastScrolled = false;

  const onScroll = () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.requestAnimationFrame(() => {
      const scrolled = window.scrollY > SCROLL_THRESHOLD;
      if (scrolled !== lastScrolled) {
        header.classList.toggle('is-scrolled', scrolled);
        lastScrolled = scrolled;
      }
      scrollScheduled = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── Drawer ───────────────────────────────────────────── */
  if (!drawer || !toggle) return;

  // Build a backdrop sibling so the click-outside affordance works.
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-drawer-backdrop';
  backdrop.hidden = true;
  drawer.parentNode.insertBefore(backdrop, drawer);

  let lastFocused = null;
  let scrollLockY = 0;

  const getFocusable = () => Array.from(drawer.querySelectorAll(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const items = getFocusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      closeDrawer();
      return;
    }
    trapFocus(event);
  };

  const lockScroll = () => {
    scrollLockY = window.scrollY;
    document.documentElement.classList.add('nav-drawer-open');
  };
  const unlockScroll = () => {
    document.documentElement.classList.remove('nav-drawer-open');
    window.scrollTo(0, scrollLockY);
  };

  function openDrawer() {
    lastFocused = document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    // Force reflow so the transition fires.
    void drawer.offsetWidth;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-visible');
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll();
    document.addEventListener('keydown', onKeydown);
    const focusables = getFocusable();
    if (focusables.length) focusables[0].focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    toggle.setAttribute('aria-expanded', 'false');
    unlockScroll();
    document.removeEventListener('keydown', onKeydown);
    // Defer hidden until transition ends.
    const onEnd = () => {
      if (!drawer.classList.contains('is-open')) {
        drawer.hidden = true;
        backdrop.hidden = true;
      }
      drawer.removeEventListener('transitionend', onEnd);
    };
    drawer.addEventListener('transitionend', onEnd);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    } else {
      toggle.focus();
    }
  }

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) closeDrawer();
    else openDrawer();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  drawer.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) closeDrawer();
  });
}());
