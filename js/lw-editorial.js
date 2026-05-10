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


/* ═══════ Sticky mobile CTA (couples/family/editorial — wedding has its own) ═══════ */
(function(){
  'use strict';
  if (document.querySelector('.lw-sticky-cta')) return; // wedding already has one
  if (document.querySelector('.lw-sticky-mob-bar')) return; // already injected
  var bar = document.createElement('div');
  bar.className = 'lw-sticky-mob-bar';
  bar.setAttribute('data-state','hidden');
  bar.setAttribute('aria-hidden','true');
  bar.setAttribute('aria-label','Quick contact');
  bar.innerHTML = ''
    + '<a class="primary" href="#inquiry"><span>Begin Inquiry</span></a>'
    + '<a class="secondary" href="https://wa.me/529902046514" target="_blank" rel="noopener">'
    +   '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12a8.25 8.25 0 1 1 3.62 6.84L3 20l1.22-4.27A8.21 8.21 0 0 1 3.75 12Z"/></svg>'
    +   '<span>WhatsApp</span>'
    + '</a>';
  document.body.appendChild(bar);
  
  var inquiry = document.getElementById('inquiry');
  var inquiryVisible = false;
  if ('IntersectionObserver' in window && inquiry){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ inquiryVisible = e.isIntersecting; update(); });
    }, { rootMargin:'0px 0px -10% 0px', threshold:0.01 });
    io.observe(inquiry);
  }
  function update(){
    var show = window.scrollY > 600 && !inquiryVisible && window.innerWidth <= 900;
    if (show){
      bar.setAttribute('data-state','visible');
      bar.setAttribute('aria-hidden','false');
      document.body.classList.add('has-sticky-mob');
    } else {
      bar.setAttribute('data-state','hidden');
      bar.setAttribute('aria-hidden','true');
      document.body.classList.remove('has-sticky-mob');
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){ update(); ticking = false; });
  }, { passive:true });
  window.addEventListener('resize', update);
  update();
})();
