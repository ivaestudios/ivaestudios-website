/* IVAE Studios — Editorial framework runtime.
   Powers .lw-rv reveal animations and .faq-item accordion on all 4
   service pages. Defer-loaded. */
(function(){
  'use strict';
  document.documentElement.classList.add('js-on');

  var $$ = function(s, sc){
    return Array.prototype.slice.call((sc || document).querySelectorAll(s));
  };

  /* Reveal observer — fades .lw-rv elements into view on scroll */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) {
          e.target.classList.add('vis');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('.lw-rv').forEach(function(el){ io.observe(el); });
  } else {
    $$('.lw-rv').forEach(function(el){ el.classList.add('vis'); });
  }

  /* FAQ accordion — close-others-on-open */
  $$('.faq-trigger').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = btn.closest('.faq-item');
      if (!item) return;
      var willOpen = !item.classList.contains('open');
      $$('.faq-item.open').forEach(function(other){
        if (other !== item) {
          other.classList.remove('open');
          var ob = other.querySelector('.faq-trigger');
          if (ob) ob.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });
})();
