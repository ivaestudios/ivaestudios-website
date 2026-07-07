/* IVAE Studios — Sticky mobile CTA injector for location pages.
   Reads data-lw-loc-sticky from <script> tag (or window var) to localize
   the labels by language. Auto-injects the bar after DOMContentLoaded
   and toggles visibility on scroll (≤900px viewport, scrollY > 600). */
(function(){
  'use strict';
  if (document.querySelector('.lw-loc-sticky')) return;

  // Localization: pages set window.LW_LOC_STICKY = {primary, secondary, primaryHref, secondaryHref}
  // before this script loads, OR we infer from <html lang>.
  var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0,2);
  var defaults = {
    en: {
      primary: 'Book Session',
      secondary: 'WhatsApp',
      primaryHref: 'https://wa.me/529987582363?text=Hello%2C%20I%27d%20like%20to%20book%20a%20photo%20session',
      secondaryHref: 'mailto:info@ivaestudios.com',
      ariaPrimary: 'Book a session on WhatsApp (opens in new tab)',
      ariaSecondary: 'Email IVAE Studios'
    },
    es: {
      primary: 'Reservar',
      secondary: 'WhatsApp',
      primaryHref: 'https://wa.me/529987582363?text=Hola%2C%20me%20interesa%20reservar%20una%20sesi%C3%B3n',
      secondaryHref: 'mailto:info@ivaestudios.com',
      ariaPrimary: 'Reservar por WhatsApp (se abre en pestaña nueva)',
      ariaSecondary: 'Enviar correo a IVAE Studios'
    }
  };
  var cfg = (window.LW_LOC_STICKY) || defaults[lang] || defaults.en;

  function init(){
    var bar = document.createElement('aside');
    bar.className = 'lw-loc-sticky';
    bar.setAttribute('aria-label', lang === 'es' ? 'Contacto rápido' : 'Quick contact');
    bar.setAttribute('data-state', 'hidden');
    bar.innerHTML = ''
      + '<a class="primary" href="' + cfg.primaryHref + '" target="_blank" rel="noopener" aria-label="' + cfg.ariaPrimary + '">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12a8.25 8.25 0 1 1 3.62 6.84L3 20l1.22-4.27A8.21 8.21 0 0 1 3.75 12Z"/></svg>'
      +   '<span>' + cfg.primary + '</span>'
      + '</a>'
      + '<a class="secondary" href="' + cfg.secondaryHref + '" aria-label="' + cfg.ariaSecondary + '">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"/></svg>'
      +   '<span>' + cfg.secondary + '</span>'
      + '</a>';
    document.body.appendChild(bar);

    function update(){
      var show = window.scrollY > 600 && window.innerWidth <= 900;
      if (show){
        bar.setAttribute('data-state','visible');
        document.body.classList.add('has-loc-sticky');
      } else {
        bar.setAttribute('data-state','hidden');
        document.body.classList.remove('has-loc-sticky');
      }
    }
    var ticking = false;
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){ update(); ticking = false; });
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
