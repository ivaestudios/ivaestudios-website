/*!
 * IVAE Studios — Universal Image Loader
 * Lazy loading, blur-up shimmer, aspect-ratio reservation, no CLS.
 * Enhances every <img data-ivae-img> on the page.
 *
 * Usage:
 *   <img data-ivae-img src="hero.jpg" alt="..." data-aspect="16/9">
 *   <img data-ivae-img="hero" src="..." alt="...">  // priority load
 *   <img data-ivae-img data-src="..." alt="...">    // progressive: src injected on intersection
 *
 * Public API:
 *   window.IVAE.image.observe(node?)   // re-scan a subtree
 *   window.IVAE.image.refresh()        // re-scan the document
 */
(function () {
  'use strict';

  const SELECTOR = 'img[data-ivae-img]';
  const ROOT_MARGIN = '200px 0px';
  const DEFAULT_ASPECT = '4/5';
  const VARIANT_CLASS = {
    portrait: 'ivae-image--portrait',
    landscape: 'ivae-image--landscape',
    wide: 'ivae-image--wide',
    square: 'ivae-image--square',
    cinema: 'ivae-image--cinema'
  };

  let io = null;

  function getObserver() {
    if (io || !('IntersectionObserver' in window)) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        swapSrc(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: ROOT_MARGIN, threshold: 0.01 });
    return io;
  }

  function swapSrc(img) {
    const ds = img.getAttribute('data-src');
    const dss = img.getAttribute('data-srcset');
    if (dss && !img.getAttribute('srcset')) {
      img.setAttribute('srcset', dss);
      img.removeAttribute('data-srcset');
    }
    if (ds && img.getAttribute('src') !== ds) {
      img.setAttribute('src', ds);
      img.removeAttribute('data-src');
    }
    // <picture> child <source data-srcset>
    const parent = img.parentElement;
    if (parent && parent.tagName === 'PICTURE') {
      const sources = parent.querySelectorAll('source[data-srcset]');
      sources.forEach(function (s) {
        s.setAttribute('srcset', s.getAttribute('data-srcset'));
        s.removeAttribute('data-srcset');
      });
    }
  }

  function markLoaded(wrapper, img) {
    if (img.complete && img.naturalWidth > 0) {
      wrapper.classList.add('is-loaded');
      return;
    }
    img.addEventListener('load', function () {
      wrapper.classList.add('is-loaded');
    }, { once: true });
    img.addEventListener('error', function () {
      // fail-safe: stop the shimmer even on error so layout doesn't pulse forever
      wrapper.classList.add('is-loaded');
    }, { once: true });
  }

  function enhance(img) {
    if (img.dataset.ivaeReady === '1') return;
    img.dataset.ivaeReady = '1';

    const priority = img.getAttribute('data-ivae-img') === 'hero';
    const aspect = img.getAttribute('data-aspect') || DEFAULT_ASPECT;
    const variant = img.getAttribute('data-variant');

    // Loading hints
    if (priority) {
      img.setAttribute('loading', 'eager');
      img.setAttribute('fetchpriority', 'high');
    } else if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

    // Wrap unless already wrapped (or inside a <picture> already wrapped)
    let wrapper = img.closest('.ivae-image');
    if (!wrapper) {
      const host = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : img;
      wrapper = document.createElement('div');
      wrapper.className = 'ivae-image';
      if (variant && VARIANT_CLASS[variant]) wrapper.classList.add(VARIANT_CLASS[variant]);
      wrapper.style.aspectRatio = aspect.replace('/', ' / ');
      host.parentNode.insertBefore(wrapper, host);
      wrapper.appendChild(host);
    } else if (!wrapper.style.aspectRatio) {
      wrapper.style.aspectRatio = aspect.replace('/', ' / ');
    }

    // Priority: swap immediately, never lazy-defer
    if (priority) {
      swapSrc(img);
      markLoaded(wrapper, img);
      return;
    }

    markLoaded(wrapper, img);

    // Lazy swap via IO when data-src present; otherwise the browser handles loading="lazy"
    const hasDeferred = img.hasAttribute('data-src') || img.hasAttribute('data-srcset');
    const obs = getObserver();
    if (hasDeferred && obs) {
      obs.observe(img);
    } else if (hasDeferred) {
      // No IntersectionObserver — load now (graceful fallback).
      swapSrc(img);
    }
  }

  function observe(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const list = scope.querySelectorAll(SELECTOR);
    for (let i = 0; i < list.length; i++) enhance(list[i]);
  }

  function refresh() { observe(document); }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(refresh);

  window.IVAE = window.IVAE || {};
  window.IVAE.image = { observe: observe, refresh: refresh };
})();
