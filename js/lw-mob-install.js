/* lw-mob-install.js
 * Custom PWA install banner for IVAE Studios.
 * - Visit counter via localStorage (ivae_visits).
 * - Shows on 2nd+ visit when beforeinstallprompt fires.
 * - "Not now" dismisses for 30 days.
 * IIFE, defer-loadable, inline CSS injected at top.
 */
(function () {
  'use strict';

  var STORAGE_VISITS = 'ivae_visits';
  var STORAGE_DISMISS = 'ivae_install_dismissed_until';
  var DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

  function bumpVisits() {
    try {
      var n = parseInt(localStorage.getItem(STORAGE_VISITS) || '0', 10) || 0;
      n += 1;
      localStorage.setItem(STORAGE_VISITS, String(n));
      return n;
    } catch (e) { return 0; }
  }

  function isDismissed() {
    try {
      var until = parseInt(localStorage.getItem(STORAGE_DISMISS) || '0', 10) || 0;
      return Date.now() < until;
    } catch (e) { return false; }
  }

  function setDismissed() {
    try {
      localStorage.setItem(STORAGE_DISMISS, String(Date.now() + DISMISS_MS));
    } catch (e) { /* no-op */ }
  }

  var visitCount = bumpVisits();

  function injectCss() {
    if (document.getElementById('lw-mob-install-css')) return;
    var css = '' +
      '.lw-mob-install{position:fixed;left:12px;right:12px;' +
      'bottom:calc(env(safe-area-inset-bottom, 0px) + 16px);' +
      'z-index:9990;background:rgba(10,15,23,0.96);' +
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
      'border-left:3px solid #C9A961;border-radius:12px;' +
      'padding:14px 16px;color:#fff;font-family:inherit;' +
      'box-shadow:0 18px 48px rgba(0,0,0,0.4);' +
      'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' +
      'transform:translateY(120%);opacity:0;' +
      'transition:transform .4s ease,opacity .4s ease;' +
      'max-width:560px;margin:0 auto;}' +
      '.lw-mob-install.is-visible{transform:translateY(0);opacity:1;}' +
      '.lw-mob-install__body{flex:1 1 180px;min-width:0;}' +
      '.lw-mob-install__title{font-size:14px;font-weight:600;' +
      'letter-spacing:.01em;margin:0 0 2px;color:#fff;}' +
      '.lw-mob-install__text{font-size:12px;opacity:.78;margin:0;line-height:1.4;}' +
      '.lw-mob-install__actions{display:flex;gap:8px;flex:0 0 auto;}' +
      '.lw-mob-install__btn{min-height:44px;padding:10px 16px;' +
      'border-radius:8px;font-size:13px;font-weight:600;' +
      'cursor:pointer;border:none;font-family:inherit;' +
      'letter-spacing:.02em;transition:transform .2s ease,opacity .2s ease;}' +
      '.lw-mob-install__btn--primary{background:#C9A961;color:#0A0F17;}' +
      '.lw-mob-install__btn--primary:active{transform:scale(.97);}' +
      '.lw-mob-install__btn--ghost{background:transparent;color:#fff;opacity:.7;}' +
      '.lw-mob-install__btn--ghost:active{opacity:1;}' +
      '@media (prefers-reduced-motion: reduce){' +
      '.lw-mob-install{transition:opacity .2s ease;transform:none;}' +
      '.lw-mob-install.is-visible{transform:none;}}';
    var style = document.createElement('style');
    style.id = 'lw-mob-install-css';
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.className = 'lw-mob-install';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Instalar IVAE Studios');
    wrap.innerHTML =
      '<div class="lw-mob-install__body">' +
        '<p class="lw-mob-install__title">Install IVAE Studios</p>' +
        '<p class="lw-mob-install__text">Faster access, full-screen experience.</p>' +
      '</div>' +
      '<div class="lw-mob-install__actions">' +
        '<button type="button" class="lw-mob-install__btn lw-mob-install__btn--ghost" data-install-dismiss>Not now</button>' +
        '<button type="button" class="lw-mob-install__btn lw-mob-install__btn--primary" data-install-accept>Add to Home Screen</button>' +
      '</div>';
    return wrap;
  }

  var deferredPrompt = null;
  var bannerEl = null;

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('is-visible');
    setTimeout(function () {
      if (bannerEl && bannerEl.parentNode) {
        bannerEl.parentNode.removeChild(bannerEl);
      }
      bannerEl = null;
    }, 400);
  }

  function showBanner() {
    if (bannerEl || !deferredPrompt) return;
    injectCss();
    bannerEl = buildBanner();
    document.body.appendChild(bannerEl);
    // Force layout, then transition in.
    void bannerEl.offsetWidth;
    bannerEl.classList.add('is-visible');

    bannerEl.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-install-dismiss]')) {
        setDismissed();
        hideBanner();
      } else if (t.closest('[data-install-accept]')) {
        if (!deferredPrompt) { hideBanner(); return; }
        try {
          deferredPrompt.prompt();
          if (deferredPrompt.userChoice && typeof deferredPrompt.userChoice.then === 'function') {
            deferredPrompt.userChoice
              .then(function () { deferredPrompt = null; hideBanner(); })
              .catch(function () { deferredPrompt = null; hideBanner(); });
          } else {
            deferredPrompt = null;
            hideBanner();
          }
        } catch (err) {
          hideBanner();
        }
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (visitCount < 2) return;
    if (isDismissed()) return;
    // Small delay so the banner doesn't fight the page entrance.
    setTimeout(showBanner, 1200);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideBanner();
    try { localStorage.removeItem(STORAGE_DISMISS); } catch (e) { /* no-op */ }
  });
})();
