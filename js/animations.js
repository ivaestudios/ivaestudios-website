/* IVAE Studios — animations.js
 * Editorial scroll-reveal system. Restraint over flash.
 * - data-reveal              fade-up (or variant) on intersect
 * - data-reveal-stagger      cascading delay on children
 * - data-reveal-words        word-by-word translateY mask reveal
 * - data-magnetic            subtle cursor-following CTA (>= md, no reduced-motion)
 *
 * No setInterval / setTimeout polling. IntersectionObserver only.
 * All behaviors are no-ops under prefers-reduced-motion: reduce.
 */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MD_QUERY = '(min-width: 768px)';
  const STAGGER_MS = 80;
  const WORD_STAGGER_MS = 60;
  const MAGNETIC_MAX = 6; // px

  /* ---------- helpers ---------- */

  const isElement = (n) => n && n.nodeType === 1;

  function applyStagger(el) {
    const selector = el.getAttribute('data-reveal-stagger');
    const children = selector
      ? el.querySelectorAll(selector)
      : el.children;
    let i = 0;
    for (const child of children) {
      if (!isElement(child)) continue;
      child.style.setProperty('--reveal-delay', (i * STAGGER_MS) + 'ms');
      i += 1;
    }
  }

  function clearWillChange(el) {
    el.style.willChange = '';
  }

  /* ---------- word splitting ---------- */

  function splitWords(el) {
    if (!isElement(el) || el.dataset.rvWordsSplit === '1') return;
    const text = el.textContent;
    if (!text || !text.trim()) return;
    const words = text.split(/(\s+)/); // keep whitespace tokens
    const frag = document.createDocumentFragment();
    let wordIndex = 0;
    for (const token of words) {
      if (token === '') continue;
      if (/^\s+$/.test(token)) {
        frag.appendChild(document.createTextNode(token));
        continue;
      }
      const outer = document.createElement('span');
      outer.className = 'rv-word';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.textContent = token;
      inner.style.setProperty('--word-delay', (wordIndex * WORD_STAGGER_MS) + 'ms');
      outer.appendChild(inner);
      frag.appendChild(outer);
      wordIndex += 1;
    }
    // Preserve a screen-reader-only copy of the original text.
    const sr = document.createElement('span');
    sr.className = 'rv-sr-only';
    sr.textContent = text;
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(frag);
    el.dataset.rvWordsSplit = '1';
  }

  /* ---------- intersection observer ---------- */

  let observer = null;

  function ensureObserver() {
    if (observer || REDUCED) return observer;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          el.classList.add('is-revealed');
          observer.unobserve(el);
          // Clear will-change after the longest reasonable transition.
          el.addEventListener('transitionend', function once() {
            clearWillChange(el);
            el.removeEventListener('transitionend', once);
          });
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0 }
    );
    return observer;
  }

  function observe(el) {
    if (!isElement(el)) return;
    if (el.dataset.rvObserved === '1') return;
    el.dataset.rvObserved = '1';
    if (el.hasAttribute('data-reveal-words')) splitWords(el);
    if (el.hasAttribute('data-reveal-stagger')) applyStagger(el);
    el.style.willChange = 'opacity, transform';
    ensureObserver().observe(el);
  }

  function revealAll(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('[data-reveal], [data-reveal-words]');
    if (REDUCED) {
      for (const el of nodes) {
        if (el.hasAttribute('data-reveal-words')) splitWords(el);
        el.classList.add('is-revealed');
      }
      return;
    }
    for (const el of nodes) observe(el);
  }

  function refresh() { revealAll(document); }

  /* ---------- magnetic CTAs ---------- */

  function bindMagnetic() {
    if (REDUCED) return;
    const mq = window.matchMedia(MD_QUERY);
    const targets = document.querySelectorAll('[data-magnetic]');
    for (const el of targets) {
      let active = false;
      const onMove = (e) => {
        if (!active || !mq.matches) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        const tx = Math.max(-1, Math.min(1, dx)) * MAGNETIC_MAX;
        const ty = Math.max(-1, Math.min(1, dy)) * MAGNETIC_MAX;
        el.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0)';
      };
      el.addEventListener('mouseenter', () => { active = true; });
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', () => {
        active = false;
        el.style.transform = '';
      });
    }
  }

  /* ---------- bootstrap ---------- */

  function init() {
    revealAll(document);
    bindMagnetic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.IVAE = window.IVAE || {};
  window.IVAE.anim = { revealAll, refresh, splitWords };
})();
