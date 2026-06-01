/* IVAE Marketing — Single source of truth for the sub-brand header.
   Injects a consistent purple/pink header on every IVAE Marketing page
   (master, 6 industry landings, SMM blog posts, intake form, calendar).
   EN + ES aware. Mirrors the architecture of js/site-header.js (the IVAE
   Studios header) but with IVAE Marketing branding + its own mobile drawer.

   Self-contained: injects its own <style> block + header DOM, and removes
   the legacy bare `.smm-lang-switch` so there's never a double language
   switcher. Include once per page:  <script src="/js/marketing-header.js" defer></script> */
(function () {
  'use strict';

  var path = location.pathname.replace(/\/$/, '') || '/';
  var isES = path.indexOf('/es/') === 0 || path === '/es';

  // Reciprocal EN<->ES map for the language switcher (IVAE Marketing URLs).
  var enFromEs = {
    '/es/manejo-redes-sociales': '/social-media-management',
    '/es/redes-sociales-hoteles-lujo-mexico': '/social-media-luxury-hotels-mexico',
    '/es/redes-sociales-restaurantes-cancun': '/social-media-restaurants-cancun',
    '/es/redes-sociales-spa-wellness-mexico': '/social-media-spa-wellness-mexico',
    '/es/redes-sociales-clinica-dental-mexico': '/social-media-dental-clinic-mexico',
    '/es/manejo-instagram-cancun': '/instagram-management-cancun',
    '/es/agencia-tiktok-hoteles-mexico': '/tiktok-agency-hotels-mexico'
  };
  var esFromEn = {};
  Object.keys(enFromEs).forEach(function (k) { esFromEn[enFromEs[k]] = k; });

  // Marketing master is the sub-brand "home".
  var masterEn = '/social-media-management';
  var masterEs = '/es/manejo-redes-sociales';
  var homeHref = isES ? masterEs : masterEn;

  // Language switch targets. Pages without a reciprocal (EN-only blog posts)
  // fall back to the master page of the other language.
  var enHref, esHref;
  if (isES) {
    enHref = enFromEs[path] || masterEn;
    esHref = path || masterEs;
  } else {
    enHref = path || masterEn;
    esHref = esFromEn[path] || masterEs;
  }

  var labels = isES ? {
    verticals: 'Verticales', blog: 'Diario', studio: 'IVAE Studios',
    cta: 'Iniciar Brief', menuOpen: 'Abrir navegación', menuClose: 'Cerrar navegación',
    langGroup: 'Idioma', tagline: 'Redes sociales para hospitalidad de lujo'
  } : {
    verticals: 'Verticals', blog: 'Journal', studio: 'IVAE Studios',
    cta: 'Begin Brief', menuOpen: 'Open navigation', menuClose: 'Close navigation',
    langGroup: 'Language', tagline: 'Social media for luxury hospitality'
  };

  var blogHref = '/marketing-blog';
  var studioHref = isES ? '/es/' : '/';
  var intakeHref = '/marketing-intake';

  // Industry verticals (EN + ES) for the nav + mobile drawer.
  var verticals = isES ? [
    { href: '/es/redes-sociales-hoteles-lujo-mexico', label: 'Hoteles de Lujo' },
    { href: '/es/redes-sociales-restaurantes-cancun', label: 'Restaurantes' },
    { href: '/es/redes-sociales-spa-wellness-mexico', label: 'Spa & Wellness' },
    { href: '/es/redes-sociales-clinica-dental-mexico', label: 'Clínicas Dentales' },
    { href: '/es/manejo-instagram-cancun', label: 'Instagram Cancún' },
    { href: '/es/agencia-tiktok-hoteles-mexico', label: 'TikTok Hoteles' }
  ] : [
    { href: '/social-media-luxury-hotels-mexico', label: 'Luxury Hotels' },
    { href: '/social-media-restaurants-cancun', label: 'Restaurants' },
    { href: '/social-media-spa-wellness-mexico', label: 'Spa & Wellness' },
    { href: '/social-media-dental-clinic-mexico', label: 'Dental Clinics' },
    { href: '/instagram-management-cancun', label: 'Instagram Cancún' },
    { href: '/tiktok-agency-hotels-mexico', label: 'TikTok Hotels' }
  ];

  var enActive = !isES ? ' class="is-active" aria-current="page"' : '';
  var esActive = isES ? ' class="is-active" aria-current="page"' : '';

  // ── Styles (injected once) ────────────────────────────────────────────
  var css = ''
    + '.imkt-hd{position:sticky;top:0;z-index:9000;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;background:rgba(10,10,15,.72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(167,139,250,.16);font-family:"Outfit",system-ui,-apple-system,sans-serif}'
    + '.imkt-hd.scrolled{background:rgba(10,10,15,.92);border-bottom-color:rgba(167,139,250,.28)}'
    + '.imkt-hd a{text-decoration:none}'
    + '.imkt-hd-logo{display:inline-flex;align-items:baseline;gap:0;font-weight:700;font-size:16px;letter-spacing:-.01em;color:#f0eee9;white-space:nowrap}'
    + '.imkt-hd-logo b{font-weight:700}'
    + '.imkt-hd-logo .g{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;margin-left:5px;font-weight:700}'
    + '.imkt-hd-nav{display:flex;align-items:center;gap:30px;margin:0 auto}'
    + '.imkt-hd-nav a{font-size:13px;font-weight:600;letter-spacing:.01em;color:rgba(240,238,233,.72);transition:color .2s;position:relative;padding:4px 0}'
    + '.imkt-hd-nav a:hover{color:#f0eee9}'
    + '.imkt-hd-nav a.is-active{color:#c4b5fd}'
    + '.imkt-hd-nav a.studio{color:rgba(240,238,233,.5);font-family:"Space Mono",monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em}'
    + '.imkt-hd-nav a.studio:hover{color:#c4b5fd}'
    + '.imkt-hd-right{display:flex;align-items:center;gap:16px}'
    + '.imkt-hd-lang{display:inline-flex;align-items:center;gap:7px;font-family:"Space Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.18em}'
    + '.imkt-hd-lang a{color:rgba(240,238,233,.5);transition:color .2s;padding:2px 2px;border-bottom:1px solid transparent}'
    + '.imkt-hd-lang a:hover{color:#f0eee9}'
    + '.imkt-hd-lang a.is-active{color:#c4b5fd;border-bottom-color:#a78bfa}'
    + '.imkt-hd-lang .sep{color:rgba(240,238,233,.25);font-weight:400}'
    + '.imkt-hd-cta{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#0a0a0f !important;background:linear-gradient(135deg,#a78bfa,#ec4899);padding:11px 20px;border-radius:100px;transition:box-shadow .2s,transform .2s;white-space:nowrap}'
    + '.imkt-hd-cta:hover{box-shadow:0 6px 20px rgba(167,139,250,.4);transform:translateY(-1px);color:#0a0a0f !important}'
    + '.imkt-hd-cta svg{width:15px;height:15px}'
    + '.imkt-hd-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:44px;height:44px;padding:0;background:transparent;border:1px solid rgba(167,139,250,.25);border-radius:10px;cursor:pointer}'
    + '.imkt-hd-burger span{display:block;width:18px;height:1.6px;background:#c4b5fd;margin:0 auto;border-radius:2px;transition:transform .25s,opacity .25s}'
    + '.imkt-hd-burger[aria-expanded="true"] span:nth-child(1){transform:translateY(6.6px) rotate(45deg)}'
    + '.imkt-hd-burger[aria-expanded="true"] span:nth-child(2){opacity:0}'
    + '.imkt-hd-burger[aria-expanded="true"] span:nth-child(3){transform:translateY(-6.6px) rotate(-45deg)}'
    // Mobile drawer
    + '.imkt-mnav{position:fixed;top:0;right:0;bottom:0;width:min(86vw,360px);z-index:9100;background:#0a0a0f;border-left:1px solid rgba(167,139,250,.2);transform:translateX(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:84px 28px 40px;display:flex;flex-direction:column;gap:6px;visibility:hidden}'
    + '.imkt-mnav.is-open{transform:translateX(0);visibility:visible}'
    + '.imkt-mnav-close{position:absolute;top:18px;right:20px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid rgba(167,139,250,.25);border-radius:10px;color:#c4b5fd;cursor:pointer}'
    + '.imkt-mnav-close svg{width:20px;height:20px}'
    + '.imkt-mnav a{text-decoration:none}'
    + '.imkt-mnav-link{font-family:"Outfit",sans-serif;font-size:20px;font-weight:600;color:#f0eee9;padding:12px 0;border-bottom:1px solid rgba(167,139,250,.08)}'
    + '.imkt-mnav-sec-label{font-family:"Space Mono",monospace;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a78bfa;margin:18px 0 8px}'
    + '.imkt-mnav-sub{font-family:"Outfit",sans-serif;font-size:16px;font-weight:500;color:rgba(240,238,233,.78);padding:9px 0 9px 14px;border-left:2px solid rgba(167,139,250,.2);margin-bottom:2px}'
    + '.imkt-mnav-sub:hover{color:#f0eee9;border-left-color:#a78bfa}'
    + '.imkt-mnav-lang{display:flex;align-items:center;gap:10px;font-family:"Space Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.15em;margin:20px 0 18px;color:rgba(240,238,233,.4)}'
    + '.imkt-mnav-lang a{color:rgba(240,238,233,.6)}'
    + '.imkt-mnav-lang a.is-active{color:#c4b5fd}'
    + '.imkt-mnav-cta{display:block;text-align:center;font-size:14px;font-weight:700;letter-spacing:.05em;color:#0a0a0f !important;background:linear-gradient(135deg,#a78bfa,#ec4899);padding:15px 24px;border-radius:100px;margin-top:auto}'
    + '.imkt-mnav-scrim{position:fixed;inset:0;z-index:9050;background:rgba(5,5,8,.6);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}'
    + '.imkt-mnav-scrim.is-open{opacity:1;visibility:visible}'
    + '@media (max-width:860px){.imkt-hd-nav{display:none}.imkt-hd-cta{display:none}.imkt-hd-lang{display:none}.imkt-hd-burger{display:flex}}'
    + '@media (min-width:861px){.imkt-mnav,.imkt-mnav-scrim{display:none}}'
    + '@media (prefers-reduced-motion:reduce){.imkt-mnav{transition:none}.imkt-mnav-scrim{transition:none}.imkt-hd-burger span{transition:none}}';

  var arrow = '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>';

  var navItems = ''
    + '<a href="' + homeHref + '"' + (path === homeHref.replace(/\/$/, '') ? ' class="is-active"' : '') + '>' + labels.verticals + '</a>'
    + '<a href="' + blogHref + '">' + labels.blog + '</a>'
    + '<a href="' + studioHref + '" class="studio">' + labels.studio + ' &#8599;</a>';

  var headerHTML = ''
    + '<header class="imkt-hd" id="imktHeader" role="banner" data-injected="true">'
    +   '<a href="' + homeHref + '" class="imkt-hd-logo" aria-label="IVAE Marketing"><b>IVAE</b><span class="g">MARKETING</span></a>'
    +   '<nav class="imkt-hd-nav" aria-label="Primary">' + navItems + '</nav>'
    +   '<div class="imkt-hd-right">'
    +     '<div class="imkt-hd-lang" role="group" aria-label="' + labels.langGroup + '">'
    +       '<a href="' + enHref + '" data-lang-switch="en" hreflang="en" lang="en"' + enActive + '>EN</a>'
    +       '<span class="sep" aria-hidden="true">|</span>'
    +       '<a href="' + esHref + '" data-lang-switch="es" hreflang="es" lang="es"' + esActive + '>ES</a>'
    +     '</div>'
    +     '<a href="' + intakeHref + '" class="imkt-hd-cta">' + labels.cta + arrow + '</a>'
    +     '<button class="imkt-hd-burger" id="imktBurger" type="button" aria-expanded="false" aria-controls="imktMnav" aria-label="' + labels.menuOpen + '"><span></span><span></span><span></span></button>'
    +   '</div>'
    + '</header>'
    + '<nav class="imkt-mnav" id="imktMnav" aria-label="' + labels.menuOpen + '" aria-hidden="true">'
    +   '<button class="imkt-mnav-close" id="imktMnavClose" type="button" aria-label="' + labels.menuClose + '"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>'
    +   '<a href="' + homeHref + '" class="imkt-mnav-link">' + (isES ? 'Servicios' : 'Services') + '</a>'
    +   '<div class="imkt-mnav-sec-label">' + labels.verticals + '</div>'
    +   verticals.map(function (v) { return '<a href="' + v.href + '" class="imkt-mnav-sub">' + v.label + '</a>'; }).join('')
    +   '<a href="' + blogHref + '" class="imkt-mnav-link">' + labels.blog + '</a>'
    +   '<a href="' + studioHref + '" class="imkt-mnav-link">' + labels.studio + ' &#8599;</a>'
    +   '<div class="imkt-mnav-lang" role="group" aria-label="' + labels.langGroup + '">'
    +     '<a href="' + enHref + '" data-lang-switch="en" hreflang="en"' + enActive + '>EN</a>'
    +     '<span aria-hidden="true">·</span>'
    +     '<a href="' + esHref + '" data-lang-switch="es" hreflang="es"' + esActive + '>ES</a>'
    +   '</div>'
    +   '<a href="' + intakeHref + '" class="imkt-mnav-cta">' + labels.cta + '</a>'
    + '</nav>'
    + '<div class="imkt-mnav-scrim" id="imktMnavScrim" aria-hidden="true"></div>';

  function inject() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
      return;
    }

    // Inject styles once.
    if (!document.getElementById('imkt-header-styles')) {
      var style = document.createElement('style');
      style.id = 'imkt-header-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    // Remove ANY pre-existing header variant on the page so the canonical
    // IVAE Marketing header is the only one. These pages historically each
    // shipped a different header: `.topnav` (industry landings),
    // `.imkt-header` (intake), static `header.site-header` (SMM blog posts),
    // and the bare `.smm-lang-switch` (master pages). Also clear the IVAE
    // Studios injected drawer (#mNav/#mNavScrim) in case site-header.js ran.
    var removeSelectors = [
      '.smm-lang-switch', '.lang-switch', '.topnav', '.imkt-header',
      'header.site-header', '#siteHeader', '#mNav', '#mNavScrim',
      '#imktHeader', '#imktMnav', '#imktMnavScrim'
    ];
    removeSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    });

    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    var burger = document.getElementById('imktBurger');
    var mnav = document.getElementById('imktMnav');
    var scrim = document.getElementById('imktMnavScrim');
    var closeBtn = document.getElementById('imktMnavClose');

    function setOpen(open) {
      if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (mnav) { mnav.classList.toggle('is-open', open); mnav.setAttribute('aria-hidden', open ? 'false' : 'true'); }
      if (scrim) scrim.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    if (burger) burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mnav && mnav.classList.contains('is-open')) setOpen(false);
    });
    document.querySelectorAll('#imktMnav a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });

    // Scroll state for header background.
    var header = document.getElementById('imktHeader');
    if (header) {
      var last = false;
      var onScroll = function () {
        var s = (window.pageYOffset || document.documentElement.scrollTop) > 40;
        if (s !== last) { header.classList.toggle('scrolled', s); last = s; }
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    document.dispatchEvent(new CustomEvent('marketing-header:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
