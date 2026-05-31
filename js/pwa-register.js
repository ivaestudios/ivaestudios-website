// IVAE Studios — register the service worker. Called from a defer
// <script src="/js/pwa-register.js"> tag on every page. Only registers
// on https (Cloudflare auto-https) and where Service Worker API exists.
//
// It also (a) forces an update check on every load so a freshly deployed
// service worker is picked up immediately (sw.js is served no-cache), and
// (b) when a NEW service worker takes control of the page (i.e. a deploy
// shipped), reloads the page ONCE so the user renders with fresh CSS/JS
// instead of the previously cached assets. The reload is skipped on the
// very first registration (no previous controller) and guarded against
// loops, so it only fires on a genuine version update.
(function(){
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;
  // Do not register the service worker for admin or Cloudflare Functions
  // routes — those endpoints must not be cached / intercepted by the SW.
  var path = window.location.pathname || '/';
  if (path.indexOf('/admin') === 0 || path.indexOf('/functions') === 0) return;

  // Was a service worker already controlling this page on load? If yes, a
  // later controllerchange means an UPDATE shipped -> reload once for fresh
  // assets. Skipped on first-ever registration; guarded against loops.
  var hadController = !!navigator.serviceWorker.controller;
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg){
      // Force the browser to re-check sw.js now so a new version installs +
      // activates immediately. The SW calls skipWaiting() + clients.claim().
      try { reg.update(); } catch(e){}
    }).catch(function(){});
  });
})();
