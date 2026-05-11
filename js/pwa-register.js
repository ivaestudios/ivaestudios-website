// IVAE Studios — register the service worker. Called from a defer
// <script src="/js/pwa-register.js"> tag on every page. Only registers
// on https (Cloudflare auto-https) and where Service Worker API exists.
(function(){
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
  });
})();
