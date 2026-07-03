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
    '/es/fotografo-familiar-destino-mexico': '/destination-family-photographer-mexico',
    '/es/fotografo-parejas-destino-mexico': '/destination-couples-photographer-mexico',
    '/es/fotografo-bodas-playa-del-carmen': '/playa-del-carmen-wedding-photographer',
    '/es/fotografo-familiar-playa-del-carmen': '/playa-del-carmen-family-photographer',
    '/es/fotografo-parejas-playa-del-carmen': '/playa-del-carmen-couples-photographer',
    '/es/fotografo-bodas-tulum': '/tulum-wedding-photographer',
    '/es/fotografo-parejas-tulum': '/tulum-couples-photographer',
    '/es/fotografo-bodas-san-miguel-de-allende': '/san-miguel-de-allende-wedding-photographer',
    '/es/fotografo-parejas-san-miguel-de-allende': '/san-miguel-de-allende-couples-photographer',
    '/es/fotografo-bodas-valle-de-bravo': '/valle-de-bravo-wedding-photographer',
    '/es/fotografo-bodas-puerto-vallarta': '/puerto-vallarta-wedding-photographer',
    '/es/fotografo-familiar-puerto-vallarta': '/puerto-vallarta-family-photographer',
    '/es/fotografo-parejas-puerto-vallarta': '/puerto-vallarta-couples-photographer',
    '/es/fotografo-bodas-oaxaca': '/oaxaca-wedding-photographer',
    '/es/fotografo-bodas-merida': '/merida-wedding-photographer',
    '/es/fotografo-familiar-merida': '/merida-family-photographer',
    '/es/fotografo-bodas-ciudad-de-mexico': '/mexico-city-wedding-photographer',
    '/es/fotografo-familiar-ciudad-de-mexico': '/mexico-city-family-photographer',
    '/es/fotografo-bodas-guadalajara': '/guadalajara-wedding-photographer',
    '/es/acerca-de': '/about',
    '/es/fotos-familiares-lujo-cancun': '/luxury-family-photos-cancun',
    '/es/fotografia-parejas-mexico': '/couples-photography-mexico',
    '/es/editorial-de-lujo': '/luxury-editorial',
    '/es/fotografo-bodas-destino-mexico': '/luxury-weddings',
    '/es/blog': '/blog',
    '/es/marca': '/brand',
    '/es/politica-de-privacidad': '/privacy-policy',
    '/es/declaracion-accesibilidad': '/accessibility-statement',
    '/es/vianey-diaz': '/vianey-diaz',
    '/es/manejo-redes-sociales': '/social-media-management',
    '/es/redes-sociales-hoteles-lujo-mexico': '/social-media-luxury-hotels-mexico',
    '/es/redes-sociales-restaurantes-cancun': '/social-media-restaurants-cancun',
    '/es/redes-sociales-spa-wellness-mexico': '/social-media-spa-wellness-mexico',
    '/es/redes-sociales-clinica-dental-mexico': '/social-media-dental-clinic-mexico',
    '/es/agencia-tiktok-hoteles-mexico': '/tiktok-agency-hotels-mexico',
    '/es/manejo-instagram-cancun': '/instagram-management-cancun'
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

  // Service URLs (EN + ES) for the mobile nav drawer
  var weddingsHref = isES ? '/es/fotografo-bodas-destino-mexico' : '/destination-wedding-photographer-mexico';
  var familyHref = isES ? '/es/fotos-familiares-lujo-cancun' : '/luxury-family-photos-cancun';
  var couplesHref = isES ? '/es/fotografia-parejas-mexico' : '/couples-photography-mexico';
  var editorialHref = isES ? '/es/editorial-de-lujo' : '/luxury-editorial';
  var marketingHref = isES ? '/es/manejo-redes-sociales' : '/social-media-management';

  var serviceLabels = isES ? {
    weddings: 'Bodas', family: 'Familia', couples: 'Parejas', editorial: 'Editorial', marketing: 'Marketing'
  } : {
    weddings: 'Weddings', family: 'Family', couples: 'Couples', editorial: 'Editorial', marketing: 'Marketing'
  };

  // Destination pages (EN + ES) for the mobile nav drawer
  var destItems = [
    { en: '/destination-family-photographer-mexico', es: '/es/fotografo-familiar-destino-mexico', enL: 'Across Mexico \u00b7 Families', esL: 'Todo M\u00e9xico \u00b7 Familias' },
    { en: '/destination-couples-photographer-mexico', es: '/es/fotografo-parejas-destino-mexico', enL: 'Across Mexico \u00b7 Couples', esL: 'Todo M\u00e9xico \u00b7 Parejas' },
    { en: '/playa-del-carmen-wedding-photographer', es: '/es/fotografo-bodas-playa-del-carmen', enL: 'Playa del Carmen', esL: 'Playa del Carmen' },
    { en: '/tulum-wedding-photographer', es: '/es/fotografo-bodas-tulum', enL: 'Tulum', esL: 'Tulum' },
    { en: '/san-miguel-de-allende-wedding-photographer', es: '/es/fotografo-bodas-san-miguel-de-allende', enL: 'San Miguel de Allende', esL: 'San Miguel de Allende' },
    { en: '/valle-de-bravo-wedding-photographer', es: '/es/fotografo-bodas-valle-de-bravo', enL: 'Valle de Bravo', esL: 'Valle de Bravo' },
    { en: '/puerto-vallarta-wedding-photographer', es: '/es/fotografo-bodas-puerto-vallarta', enL: 'Puerto Vallarta', esL: 'Puerto Vallarta' },
    { en: '/oaxaca-wedding-photographer', es: '/es/fotografo-bodas-oaxaca', enL: 'Oaxaca', esL: 'Oaxaca' },
    { en: '/merida-wedding-photographer', es: '/es/fotografo-bodas-merida', enL: 'M\u00e9rida', esL: 'M\u00e9rida' },
    { en: '/mexico-city-wedding-photographer', es: '/es/fotografo-bodas-ciudad-de-mexico', enL: 'Mexico City', esL: 'Ciudad de M\u00e9xico' },
    { en: '/guadalajara-wedding-photographer', es: '/es/fotografo-bodas-guadalajara', enL: 'Guadalajara', esL: 'Guadalajara' }
  ];
  var destLabel = isES ? 'Destinos' : 'Destinations';
  var destLinks = destItems.map(function (d) {
    return '<a href="' + (isES ? d.es : d.en) + '" class="m-nav-sublink">' + (isES ? d.esL : d.enL) + '</a>';
  }).join('');

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
    + '</header>'
    // Mobile navigation drawer — full-screen on mobile, slides in from right
    + '<nav class="m-nav" id="mNav" aria-label="Mobile navigation" aria-hidden="true">'
    +   '<button class="m-nav-close" id="mNavClose" type="button" aria-label="' + (isES ? 'Cerrar navegación' : 'Close navigation') + '">'
    +     '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
    +   '</button>'
    +   '<div class="m-nav-inner">'
    +     '<a href="' + homeHref + '" class="m-nav-link">' + labels.home + '</a>'
    +     '<a href="' + aboutHref + '" class="m-nav-link">' + labels.about + '</a>'
    +     '<div class="m-nav-section">'
    +       '<div class="m-nav-section-label">' + labels.services + '</div>'
    +       '<a href="' + weddingsHref + '" class="m-nav-sublink">' + serviceLabels.weddings + '</a>'
    +       '<a href="' + familyHref + '" class="m-nav-sublink">' + serviceLabels.family + '</a>'
    +       '<a href="' + couplesHref + '" class="m-nav-sublink">' + serviceLabels.couples + '</a>'
    +       '<a href="' + editorialHref + '" class="m-nav-sublink">' + serviceLabels.editorial + '</a>'
    +       '<a href="' + marketingHref + '" class="m-nav-sublink m-nav-sublink--accent">' + serviceLabels.marketing + ' <span class="m-nav-pill">NEW</span></a>'
    +     '</div>'
    +     '<div class="m-nav-section">'
    +       '<div class="m-nav-section-label">' + destLabel + '</div>'
    +       destLinks
    +     '</div>'
    +     '<a href="' + blogHref + '" class="m-nav-link">' + labels.blog + '</a>'
    +     '<div class="m-nav-lang">'
    +       '<a href="' + enHref + '" data-lang-switch="en" hreflang="en"' + enActive + '>EN</a>'
    +       '<span aria-hidden="true">·</span>'
    +       '<a href="' + esHref + '" data-lang-switch="es" hreflang="es"' + esActive + '>ES</a>'
    +     '</div>'
    +     '<a href="#inquiry" class="m-nav-cta">' + labels.cta + '</a>'
    +   '</div>'
    + '</nav>'
    + '<div class="m-nav-scrim" id="mNavScrim" aria-hidden="true"></div>';

  function inject() {
    // Remove any pre-existing mobile-nav DOM so the canonical injection
    // below never produces duplicate IDs (#mNav / #mNavScrim). Pages that
    // shipped a static <nav id="mNav"> would otherwise leave a ghost
    // drawer behind that swallows getElementById lookups and breaks the
    // burger toggle.
    var staleMNav = document.getElementById('mNav');
    if (staleMNav) staleMNav.parentNode.removeChild(staleMNav);
    var staleScrim = document.getElementById('mNavScrim');
    if (staleScrim) staleScrim.parentNode.removeChild(staleScrim);

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

    // Wire burger toggle — opens mobile nav drawer
    var burger = document.getElementById('hBurger');
    var mNav = document.getElementById('mNav');
    var mNavScrim = document.getElementById('mNavScrim');
    var mNavClose = document.getElementById('mNavClose');

    function setNavOpen(open) {
      if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (mNav) {
        mNav.classList.toggle('is-open', open);
        mNav.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      if (mNavScrim) mNavScrim.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    if (burger) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') === 'true';
        setNavOpen(!open);
      });
    }
    if (mNavClose) mNavClose.addEventListener('click', function () { setNavOpen(false); });
    if (mNavScrim) mNavScrim.addEventListener('click', function () { setNavOpen(false); });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mNav && mNav.classList.contains('is-open')) {
        setNavOpen(false);
      }
    });

    // Close drawer when a nav link is clicked
    document.querySelectorAll('#mNav a').forEach(function (link) {
      link.addEventListener('click', function () { setNavOpen(false); });
    });

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

    // Resolve the primary CTA target. Most interior pages (venues, legal,
    // author, blog posts) have no in-page #inquiry section, so the gold
    // "Begin Inquiry"/"Comenzar Consulta" button would scroll nowhere. Fall
    // back to the studio's canonical consultation email when no #inquiry
    // anchor exists on the page; keep the smooth-scroll on pages that have it.
    if (!document.getElementById('inquiry')) {
      var ctaFallback = 'mailto:info@ivaestudios.com';
      document.querySelectorAll('#siteHeader .h-cta, #mNav .m-nav-cta').forEach(function (a) {
        a.setAttribute('href', ctaFallback);
      });
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
