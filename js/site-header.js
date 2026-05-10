/* IVAE Studios — Single source of truth for the site header.
   Injects the canonical header on every page. EN + ES aware.
   Replaces any existing <header id="siteHeader"> in the DOM with this version. */
(function () {
  'use strict';

  var path = location.pathname.replace(/\/$/, '') || '/';
  var isES = path.indexOf('/es/') === 0 || path === '/es';

  // Reciprocal map for the language switcher
  var enFromEs = {
    '/es': '/',
    '/es/acerca-de': '/about',
    '/es/fotos-familiares-lujo-cancun': '/luxury-family-photos-cancun',
    '/es/fotografia-parejas-mexico': '/couples-photography-mexico',
    '/es/editorial-de-lujo': '/luxury-editorial',
    '/es/fotografo-bodas-destino-mexico': '/luxury-weddings',
    '/es/blog': '/blog',
    '/es/marca': '/brand'
  };
  var esFromEn = {};
  Object.keys(enFromEs).forEach(function (k) { esFromEn[enFromEs[k]] = k; });

  var enHref = isES ? (enFromEs[path] || '/') : (path || '/');
  var esHref = isES ? (path || '/es/') : (esFromEn[path] || '/es/');

  // Make sure trailing slashes match site convention
  if (enHref === '/es') enHref = '/es/';

  var labels = isES ? {
    home: 'Inicio', about: 'Acerca', services: 'Servicios', blog: 'Diario',
    cta: 'Comenzar Consulta', menuOpen: 'Abrir navegación', langGroup: 'Idioma'
  } : {
    home: 'Home', about: 'About', services: 'Services', blog: 'Journal',
    cta: 'Begin Inquiry', menuOpen: 'Open navigation', langGroup: 'Language'
  };

  var homeHref = isES ? '/es/' : '/';
  var aboutHref = isES ? '/es/acerca-de' : '/about';
  var blogHref = isES ? '/es/blog' : '/blog';

  var enActive = !isES ? ' class="is-active" aria-current="page"' : '';
  var esActive = isES ? ' class="is-active" aria-current="page"' : '';

  var headerHTML = ''
    + '<header class="site-header" id="siteHeader" role="banner" data-injected="true">'
    +   '<a href="' + homeHref + '" class="h-logo">IVAE <em>Studios</em></a>'
    +   '<nav aria-label="Primary">'
    +     '<ul class="h-nav">'
    +       '<li><a href="' + homeHref + '">' + labels.home + '</a></li>'
    +       '<li><a href="' + aboutHref + '">' + labels.about + '</a></li>'
    +       '<li><a href="#services">' + labels.services + '</a></li>'
    +       '<li><a href="' + blogHref + '">' + labels.blog + '</a></li>'
    +     '</ul>'
    +   '</nav>'
    +   '<div class="lang-switch" role="group" aria-label="' + labels.langGroup + '">'
    +     '<a href="' + enHref + '" data-lang-switch="en" hreflang="en" lang="en"' + enActive + '>EN</a>'
    +     '<span class="lang-sep" aria-hidden="true">|</span>'
    +     '<a href="' + esHref + '" data-lang-switch="es" hreflang="es" lang="es"' + esActive + '>ES</a>'
    +   '</div>'
    +   '<a href="#inquiry" class="h-cta">'
    +     labels.cta
    +     '<svg fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>'
    +   '</a>'
    +   '<button class="h-burger" id="hBurger" type="button" aria-expanded="false" aria-controls="mNav" aria-label="' + labels.menuOpen + '"><span></span><span></span><span></span></button>'
    + '</header>';

  function inject() {
    var existing = document.getElementById('siteHeader');
    if (existing) {
      // Replace inline static header with the canonical one
      existing.outerHTML = headerHTML;
    } else if (document.body) {
      // No static header on the page — inject at body top
      document.body.insertAdjacentHTML('afterbegin', headerHTML);
    } else {
      // body not ready yet — defer
      document.addEventListener('DOMContentLoaded', inject, { once: true });
      return;
    }

    // Mark active page in nav
    var here = path === '/es' ? '/es/' : (path || '/');
    var navLinks = document.querySelectorAll('#siteHeader .h-nav a');
    navLinks.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var hrefNorm = href.replace(/\/$/, '') || '/';
      var hereNorm = here.replace(/\/$/, '') || '/';
      if (hrefNorm === hereNorm && href.indexOf('#') === -1) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
    });

    // Wire burger toggle
    var burger = document.getElementById('hBurger');
    var mNav = document.getElementById('mNav');
    if (burger) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (mNav) {
          mNav.classList.toggle('is-open', !open);
        }
      });
    }

    // Scrolled class on header for scroll effects
    var header = document.getElementById('siteHeader');
    if (header) {
      var lastScrolled = false;
      var onScroll = function () {
        var scrolled = (window.pageYOffset || document.documentElement.scrollTop) > 40;
        if (scrolled !== lastScrolled) {
          header.classList.toggle('scrolled', scrolled);
          lastScrolled = scrolled;
        }
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Notify dependent scripts (e.g., services-dropdown-v2.js) that the
    // header is in the DOM and they can hydrate now.
    document.dispatchEvent(new CustomEvent('site-header:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
