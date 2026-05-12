/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Dark mode (forced, no toggle)
   ───────────────────────────────────────────────────────────────
   Light mode was removed by request. This script now only ensures
   <html class="dark"> is set before paint and clears any stale
   'ivae-theme=light' from localStorage so returning visitors flip
   back to dark automatically.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  document.documentElement.classList.add('dark');
  try {
    localStorage.setItem('ivae-theme', 'dark');
  } catch (e) {}
})();
