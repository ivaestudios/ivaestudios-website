/* IVAE Studios: base blanca (2026-10). El modo oscuro se retiró por petición.
   Los artículos de IVAE Marketing que viven en /blog/ conservan su tema oscuro (otra marca). */
(function () {
  'use strict';
  if (document.querySelector('link[href*="imkt-toque"],link[href*="marketing-blog"]')) {
    document.documentElement.classList.add('dark');
    return;
  }
  document.documentElement.classList.remove('dark');
  try { localStorage.setItem('ivae-theme', 'light'); } catch (e) {}
})();
