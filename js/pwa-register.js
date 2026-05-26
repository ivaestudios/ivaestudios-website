// IVAE Studios — register the service worker. Called from a defer
// <script src="/js/pwa-register.js"> tag on every page. Only registers
// on https (Cloudflare auto-https) and where Service Worker API exists.
(function(){
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;
  // Do not register the service worker for admin or Cloudflare Functions
  // routes — those endpoints must not be cached / intercepted by the SW.
  var path = window.location.pathname || '/';
  if (path.indexOf('/admin') === 0 || path.indexOf('/functions') === 0) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
  });
})();
