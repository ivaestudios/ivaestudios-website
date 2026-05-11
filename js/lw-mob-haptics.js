/* lw-mob-haptics.js
 * Mobile-native micro-interactions for IVAE Studios.
 * - Light haptic tap feedback (10ms) on primary CTAs (touch devices only).
 * - Web Share API wiring for [data-share] elements with clipboard fallback.
 * IIFE, defer-loadable, no global namespace pollution.
 */
(function () {
  'use strict';

  var hasVibrate = ('vibrate' in navigator) && typeof navigator.vibrate === 'function';
  var hasShare = ('share' in navigator) && typeof navigator.share === 'function';
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* no-op */ }

  var isTouch = (('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

  var HAPTIC_SELECTOR = [
    '.lw-btn-gold',
    '.lw-loc-sticky a.primary',
    '.btn-gold',
    '.btn-magnetic.gold',
    '.lw-inq2-btn',
    '.hero-btn',
    '.lw-blog-categories__btn'
  ].join(',');

  function pulse() {
    if (!hasVibrate || reduceMotion) return;
    try { navigator.vibrate(10); } catch (e) { /* no-op */ }
  }

  function onHapticTap(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(HAPTIC_SELECTOR)) pulse();
  }

  if (isTouch && hasVibrate && !reduceMotion) {
    document.addEventListener('touchstart', onHapticTap, { passive: true });
  }

  function getShareData() {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var metaDesc = document.querySelector('meta[name="description"]');
    var title = (ogTitle && ogTitle.getAttribute('content')) ||
                document.title || 'IVAE Studios';
    var text = (ogDesc && ogDesc.getAttribute('content')) ||
               (metaDesc && metaDesc.getAttribute('content')) ||
               'IVAE Studios - Estudio creativo';
    return {
      title: title,
      text: text,
      url: window.location.href
    };
  }

  function copyToClipboard(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) { reject(err); }
    });
  }

  function onShareClick(e) {
    var trigger = e.target.closest('[data-share]');
    if (!trigger) return;
    e.preventDefault();
    var data = getShareData();
    pulse();
    if (hasShare) {
      navigator.share(data).catch(function () { /* user cancelled */ });
    } else {
      copyToClipboard(data.url).then(function () {
        trigger.setAttribute('data-share-state', 'copied');
        setTimeout(function () {
          trigger.removeAttribute('data-share-state');
        }, 2000);
      }).catch(function () { /* no-op */ });
    }
  }

  document.addEventListener('click', onShareClick, false);
})();
