/* ============================================================
 * IVAE Studios — Outfit Guide enhancer
 * Oleada 3 · Agent 12
 *
 * Three responsibilities — all gracefully degrading:
 *   1. W3C tab pattern for the session-type panels
 *      (roving tabindex + ArrowLeft/Right, Home/End)
 *   2. Palette swatch click filters the visible outfit boards
 *      (also resets to "show all" when the active palette is
 *      clicked again)
 *   3. Print trigger button — small enhancement around
 *      window.print() so the button gives a hint to assistive
 *      tech while keeping its native behavior.
 *
 * Without JS, every panel is visible (CSS .has-outfit-guide-js
 * fallback). Reduced motion is respected by the surrounding CSS
 * which disables transitions; this script is itself motion-free.
 * ============================================================ */
(function () {
  'use strict';

  const HAS_DOC = typeof document !== 'undefined';
  if (!HAS_DOC) return;

  /* Gate the JS-only layout — _outfit-guide.css uses this flag
     to hide non-active panels and show the tab strip. */
  document.documentElement.classList.add('has-outfit-guide-js');

  /* ─────────────── 1 · Tabs (W3C APG pattern) ─────────────── */

  function initTabs() {
    const tablist = document.querySelector('.guide-tabs__list[role="tablist"]');
    if (!tablist) return;

    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));

    function activate(index, focus) {
      tabs.forEach((tab, i) => {
        const isActive = i === index;
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        tab.classList.toggle('is-active', isActive);
        const panel = panels[i];
        if (panel) {
          panel.classList.toggle('is-active', isActive);
        }
      });
      if (focus && tabs[index]) {
        tabs[index].focus();
      }
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(i, false));
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        let next = -1;
        switch (event.key) {
          case 'ArrowRight': next = i === last ? 0 : i + 1; break;
          case 'ArrowLeft':  next = i === 0 ? last : i - 1; break;
          case 'Home':       next = 0; break;
          case 'End':        next = last; break;
          default: return;
        }
        event.preventDefault();
        activate(next, true);
      });
    });
  }

  /* ─────────────── 2 · Palette → board filter ────────────── */

  function initPaletteFilter() {
    const palettes = Array.from(document.querySelectorAll('.palette[data-palette]'));
    const grid = document.querySelector('[data-board-grid]');
    if (!palettes.length || !grid) return;

    const boards = Array.from(grid.querySelectorAll('[data-board-palette]'));
    let activeKey = null; /* null = show all */

    function setActive(key) {
      activeKey = key;
      palettes.forEach(p => {
        const isActive = p.getAttribute('data-palette') === key;
        p.classList.toggle('is-active', isActive);
        p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      boards.forEach(b => {
        const matches = !key || b.getAttribute('data-board-palette') === key;
        b.classList.toggle('is-hidden', !matches);
      });
    }

    palettes.forEach(p => {
      p.addEventListener('click', () => {
        const key = p.getAttribute('data-palette');
        /* Toggle: click same palette twice to clear filter. */
        if (activeKey === key) {
          setActive(null);
        } else {
          setActive(key);
        }
      });
      p.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          p.click();
        }
      });
    });

    /* Initial state — first palette is marked active in markup;
       sync the boards to it so the filter visibly applies on load. */
    const initiallyActive = palettes.find(p => p.classList.contains('is-active'));
    if (initiallyActive) {
      setActive(initiallyActive.getAttribute('data-palette'));
    }
  }

  /* ─────────────── 3 · Print trigger ─────────────────────── */

  function initPrintTrigger() {
    const buttons = document.querySelectorAll('[data-print-trigger]');
    buttons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        try {
          window.print();
        } catch (_err) {
          /* No-op: some embedded contexts deny window.print().
             The user can still use Cmd/Ctrl+P. */
        }
      });
    });
  }

  /* ─────────────── boot ──────────────────────────────────── */

  function boot() {
    initTabs();
    initPaletteFilter();
    initPrintTrigger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}());
