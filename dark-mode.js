/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Dark Mode (theme toggle)
   ───────────────────────────────────────────────────────────────
   Loads BEFORE paint (no FOUC).
   • Default theme: dark
   • User choice persisted in localStorage as 'ivae-theme'
   • Toggle button injected into .site-header (or any [data-theme-mount])
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ivae-theme';

  function getInitialTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {}
    // No stored preference — respect OS-level color-scheme preference.
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (e) {}
    return 'dark'; // ultimate default
  }

  // Re-apply when OS theme changes mid-session (only if user hasn't explicitly chosen).
  try {
    var mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mql && mql.addEventListener) {
      mql.addEventListener('change', function (e) {
        // Only auto-flip if the user has never set a manual preference.
        try {
          if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? 'dark' : 'light');
          }
        } catch (err) {}
      });
    }
  } catch (e) {}

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.innerHTML = theme === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }
  }

  // Apply BEFORE paint
  applyTheme(getInitialTheme());

  // Inject toggle button + wire up
  function init() {
    if (document.querySelector('.theme-toggle')) return;
    var theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.innerHTML = theme === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    btn.addEventListener('click', function () {
      var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next);
    });

    // Try to mount before .header-cta (the Book Now button)
    var cta = document.querySelector('.site-header .header-cta');
    if (cta && cta.parentNode) {
      cta.parentNode.insertBefore(btn, cta);
      return;
    }
    // Fallback: mount inside any [data-theme-mount]
    var mount = document.querySelector('[data-theme-mount]');
    if (mount) {
      mount.appendChild(btn);
      return;
    }
    // Last resort: mount at end of header
    var header = document.querySelector('.site-header, header');
    if (header) header.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
