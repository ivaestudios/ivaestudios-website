/* IVAE Studios — Shared component behavior.
   Loaded as <script src="/js/components.js?v=..." defer> on all
   refactored pages. Wires up reveal-on-scroll, smooth-scroll-to-anchor,
   and reel scroll-snap helpers. ~80 lines. */

(function(){
  'use strict';

  // ─── Reveal on scroll: any element with [data-reveal] ────────────
  // Add `is-revealed` class once it intersects the viewport.
  // Pages can style `.is-revealed` however they want (fade, slide, etc).
  function initReveal(){
    var els = document.querySelectorAll('[data-reveal]');
    if(!els.length || !('IntersectionObserver' in window)){
      // Fallback: reveal everything immediately.
      els.forEach(function(el){ el.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin:'0px 0px -10% 0px', threshold:0.05 });
    els.forEach(function(el){ io.observe(el); });
  }

  // ─── Smooth scroll for in-page anchors (#inquiry, etc.) ──────────
  function initSmoothScroll(){
    document.addEventListener('click', function(e){
      var a = e.target.closest('a[href^="#"]');
      if(!a) return;
      var hash = a.getAttribute('href');
      if(hash === '#' || hash.length < 2) return;
      var target = document.querySelector(hash);
      if(!target) return;
      e.preventDefault();
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start'
      });
      // Update URL without jumping.
      if(history.pushState) history.pushState(null, '', hash);
    });
  }

  // ─── Reel scroll-snap helpers: [data-reel] horizontal scrollable ──
  function initReels(){
    document.querySelectorAll('[data-reel]').forEach(function(reel){
      reel.style.scrollBehavior = 'smooth';
      reel.style.scrollSnapType = 'x mandatory';
      reel.querySelectorAll(':scope > *').forEach(function(child){
        child.style.scrollSnapAlign = 'start';
      });
    });
  }

  // ─── FAQ accordion (uses native <details>, just enhances) ────────
  // Closes other [data-faq-group] siblings when one opens.
  function initFaq(){
    var groups = {};
    document.querySelectorAll('details[data-faq-group]').forEach(function(d){
      var g = d.getAttribute('data-faq-group');
      groups[g] = groups[g] || [];
      groups[g].push(d);
    });
    Object.keys(groups).forEach(function(g){
      groups[g].forEach(function(d){
        d.addEventListener('toggle', function(){
          if(!d.open) return;
          groups[g].forEach(function(other){
            if(other !== d && other.open) other.open = false;
          });
        });
      });
    });
  }

  function init(){
    initReveal();
    initSmoothScroll();
    initReels();
    initFaq();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
