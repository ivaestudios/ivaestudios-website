/* IVAE Studios — Services dropdown (editorial caption-page redesign)
   Replaces the simple #services anchor link in the site header with a
   minimal serif list: four Cormorant titles, a hairline of gold on hover.
   Aman / St. Regis restraint — no chrome, no icons, no rules. Just air. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { title: 'Bodas',     href: '/es/fotografo-bodas-destino-mexico' },
    { title: 'Familia',   href: '/es/fotos-familiares-lujo-cancun' },
    { title: 'Parejas',   href: '/es/fotografia-parejas-mexico' },
    { title: 'Editorial', href: '/es/editorial-de-lujo' }
  ] : [
    { title: 'Weddings',  href: '/luxury-weddings' },
    { title: 'Family',    href: '/luxury-family-photos-cancun' },
    { title: 'Couples',   href: '/couples-photography-mexico' },
    { title: 'Editorial', href: '/luxury-editorial' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      /* Trigger */
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1),opacity 0.3s,color 0.3s;opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Panel — narrow column, 95% opacity cream, no border, no radius, barely-there shadow */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 24px);left:50%;transform:translateX(-50%) translateY(-8px);transform-origin:top center;width:280px;max-width:calc(100vw - 32px);background:rgba(253,252,250,0.95);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:0;border-radius:0;padding:40px 36px;box-shadow:0 18px 50px -28px rgba(14,22,32,0.18);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.4s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.5s;z-index:1100}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.4s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1)}'
      /* Hover bridge */
      + '.svc-dd-menu::before{content:"";position:absolute;top:-24px;left:0;right:0;height:24px}'
      /* Item — single line of Cormorant on its own row.
         !important is required to override .site-header .h-nav a rules from
         site-header.css (display:inline-flex, font-size:10px, uppercase, etc). */
      + '.svc-dd-menu .svc-dd-item{position:relative !important;display:block !important;font-family:"Cormorant Garamond",Georgia,serif !important;font-size:28px !important;font-weight:400 !important;line-height:1 !important;letter-spacing:-0.005em !important;color:#0e1620 !important;text-decoration:none !important;padding:0 !important;margin:0 !important;text-transform:none !important;min-height:0 !important;background:transparent !important;border:0 !important;align-items:flex-start !important;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1),color 0.3s ease !important}'
      + '.svc-dd-menu .svc-dd-item + .svc-dd-item{margin-top:30px !important}'
      /* Nuke the parent nav\'s ::after gold underline that would otherwise leak in */
      + '.svc-dd-menu .svc-dd-item::after{content:none !important;display:none !important}'
      /* Hairline of gold to the left, hidden until hover */
      + '.svc-dd-menu .svc-dd-item::before{content:"" !important;position:absolute !important;left:-20px !important;top:50% !important;width:24px !important;height:1px !important;background:#c4a35a !important;transform:translateY(-50%) scaleX(0) !important;transform-origin:right center !important;opacity:0 !important;bottom:auto !important;right:auto !important;transition:opacity 0.35s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1) !important}'
      /* Hover / focus */
      + '.svc-dd-menu .svc-dd-item:hover,.svc-dd-menu .svc-dd-item:focus-visible{outline:none !important;transform:translateX(4px) !important;color:#0e1620 !important}'
      + '.svc-dd-menu .svc-dd-item:hover::before,.svc-dd-menu .svc-dd-item:focus-visible::before{opacity:1 !important;transform:translateY(-50%) scaleX(1) !important}'
      /* Dark mode */
      + 'html.dark .svc-dd-menu{background:rgba(13,19,28,0.95);box-shadow:0 18px 50px -22px rgba(0,0,0,0.65)}'
      + 'html.dark .svc-dd-menu .svc-dd-item{color:#f9f8f7 !important}'
      + 'html.dark .svc-dd-menu .svc-dd-item:hover,html.dark .svc-dd-menu .svc-dd-item:focus-visible{color:#fff !important}'
      /* Mobile */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd-menu .svc-dd-item,.svc-dd-menu .svc-dd-item::before,.svc-dd-trigger svg{transition:opacity 0.2s !important;transform:none !important}.svc-dd-menu{transform:translateX(-50%) !important}.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{transform:translateX(-50%) !important}.svc-dd-menu .svc-dd-item:hover{transform:none !important}}';
    document.head.appendChild(style);
  }

  function buildDropdown(triggerLink){
    var wrap = document.createElement('div');
    wrap.className = 'svc-dd';
    wrap.setAttribute('data-svc-dropdown', '');

    var trig = document.createElement('a');
    trig.className = 'svc-dd-trigger';
    trig.href = triggerLink.getAttribute('href') || '#services';
    trig.setAttribute('aria-haspopup', 'true');
    trig.setAttribute('aria-expanded', 'false');
    trig.innerHTML = (triggerLink.textContent.trim() || triggerLabel) + ' <span aria-hidden="true">' + caret + '</span>';
    wrap.appendChild(trig);

    var menu = document.createElement('div');
    menu.className = 'svc-dd-menu';
    menu.setAttribute('role', 'menu');

    items.forEach(function(item){
      var a = document.createElement('a');
      a.className = 'svc-dd-item';
      a.href = item.href;
      a.setAttribute('role', 'menuitem');
      a.textContent = item.title;
      menu.appendChild(a);
    });

    wrap.appendChild(menu);

    trig.addEventListener('click', function(ev){
      if (window.matchMedia && matchMedia('(hover: hover)').matches) {
        if ((trig.getAttribute('href') || '').charAt(0) === '#') return;
        return;
      }
      ev.preventDefault();
      var open = wrap.getAttribute('data-open') === 'true';
      wrap.setAttribute('data-open', open ? 'false' : 'true');
      trig.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    document.addEventListener('click', function(ev){
      if (!wrap.contains(ev.target)) {
        wrap.setAttribute('data-open', 'false');
        trig.setAttribute('aria-expanded', 'false');
      }
    });

    wrap.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') {
        wrap.setAttribute('data-open', 'false');
        trig.setAttribute('aria-expanded', 'false');
        trig.focus();
      }
    });

    return wrap;
  }

  function init(){
    var navs = document.querySelectorAll('.header-nav, ul.header-nav, .h-nav, ul.h-nav');
    navs.forEach(function(nav){
      var candidates = nav.querySelectorAll('a[href*="#services"], a[href*="#servicios"]');
      var link = null;
      candidates.forEach(function(a){
        var h = a.getAttribute('href') || '';
        if (h.indexOf('#services') !== -1 || h.indexOf('#servicios') !== -1) {
          if (!link) link = a;
        }
      });
      if (!link) return;
      var li = link.closest('li');
      var dropdown = buildDropdown(link);
      if (li) {
        li.innerHTML = '';
        li.appendChild(dropdown);
      } else {
        link.parentNode.replaceChild(dropdown, link);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
