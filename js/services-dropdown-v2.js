/* IVAE Studios — Services dropdown (editorial thumbnail card grid)
   Replaces the simple #services anchor link in the site header with a
   2x2 editorial card grid of portrait-aspect thumbnails — Vanity Fair tiles
   filtered through Aman Resorts restraint.
   Loaded on every page via the existing /js/lang-detect.js position pattern. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { eyebrow: 'Destino',    title: 'Bodas',     href: '/es/fotografo-bodas-destino-mexico', img: '/images/wedding-bride-cancun-beach-ivae-studios-3.jpg', alt: 'Bodas destino en Cancún' },
    { eyebrow: 'Resort',     title: 'Familia',   href: '/es/fotos-familiares-lujo-cancun',   img: '/images/family-cancun-ivae-studios.webp',                alt: 'Familia en resort de lujo' },
    { eyebrow: 'Romance',    title: 'Parejas',   href: '/es/fotografia-parejas-mexico',      img: '/images/couple-cancun-beach-ivae-studios.jpg',           alt: 'Sesión de parejas en Cancún' },
    { eyebrow: 'Campañas',   title: 'Editorial', href: '/es/editorial-de-lujo',              img: '/images/editorial-cancun-ivae-studios.jpg',              alt: 'Editorial de lujo' }
  ] : [
    { eyebrow: 'Destination', title: 'Weddings',  href: '/luxury-weddings',              img: '/images/wedding-bride-cancun-beach-ivae-studios-3.jpg', alt: 'Destination weddings in Cancún' },
    { eyebrow: 'Resort',      title: 'Family',    href: '/luxury-family-photos-cancun',  img: '/images/family-cancun-ivae-studios.webp',                alt: 'Family at a luxury resort' },
    { eyebrow: 'Romance',     title: 'Couples',   href: '/couples-photography-mexico',   img: '/images/couple-cancun-beach-ivae-studios.jpg',           alt: 'Couples photography in Cancún' },
    { eyebrow: 'Campaigns',   title: 'Editorial', href: '/luxury-editorial',             img: '/images/editorial-cancun-ivae-studios.jpg',              alt: 'Editorial photography' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';
  var exploreLabel = isES ? 'explorar' : 'explore';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var tinyArrow = '<svg viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="6" x2="20" y2="6"/><polyline points="15 1.5 20 6 15 10.5"/></svg>';

  // Inject CSS once
  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      /* Trigger */
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Menu shell — wide editorial panel */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 22px);left:50%;transform:translateX(-50%) translateY(-10px);transform-origin:top center;width:640px;max-width:calc(100vw - 32px);background:#fdfcfa;border:1px solid rgba(14,22,32,0.08);border-radius:2px;padding:0;box-shadow:0 30px 60px -20px rgba(14,22,32,0.18),0 18px 36px -18px rgba(14,22,32,0.10);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.35s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.45s;z-index:1100}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.35s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1)}'
      /* Hover bridge */
      + '.svc-dd-menu::before{content:"";position:absolute;top:-22px;left:0;right:0;height:22px}'
      /* Header — single editorial line, off-center */
      + '.svc-dd-head{padding:26px 28px 18px;border-bottom:1px solid rgba(14,22,32,0.06);position:relative;display:flex;align-items:baseline;gap:18px}'
      + '.svc-dd-head::after{content:"";position:absolute;left:28px;bottom:-1px;width:42px;height:1px;background:#c4a35a}'
      + '.svc-dd-eyebrow{font-family:Syne,system-ui,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:#c4a35a;line-height:1;flex-shrink:0}'
      + '.svc-dd-tagline{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:14px;font-weight:400;color:#525a66;line-height:1.3;letter-spacing:0.005em}'
      /* Grid */
      + '.svc-dd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:18px}'
      /* Card */
      + '.svc-dd-card{position:relative;display:block;text-decoration:none;color:inherit;aspect-ratio:3/4;overflow:hidden;border:1px solid rgba(196,163,90,0.18);background:#0e1620;transition:border-color 0.45s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-card:hover,.svc-dd-card:focus-visible{outline:none;border-color:rgba(196,163,90,0.95)}'
      /* Image */
      + '.svc-dd-card-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.001);transition:transform 0.8s cubic-bezier(0.22,1,0.36,1);filter:saturate(0.92) contrast(1.02)}'
      + '.svc-dd-card:hover .svc-dd-card-img,.svc-dd-card:focus-visible .svc-dd-card-img{transform:scale(1.04)}'
      /* Gradient veil */
      + '.svc-dd-card-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,22,32,0) 35%,rgba(14,22,32,0.35) 60%,rgba(14,22,32,0.88) 100%);pointer-events:none;transition:opacity 0.45s cubic-bezier(0.22,1,0.36,1)}'
      /* Caption stack */
      + '.svc-dd-card-cap{position:absolute;left:16px;right:16px;bottom:14px;z-index:2;display:block;color:#fdfcfa}'
      + '.svc-dd-card-eye{display:block;font-family:Syne,system-ui,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:0.38em;text-transform:uppercase;color:#c4a35a;margin-bottom:6px;line-height:1}'
      + '.svc-dd-card-ttl{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;font-weight:400;line-height:1.05;letter-spacing:-0.005em;color:#fdfcfa;margin-bottom:8px}'
      + '.svc-dd-card-go{display:inline-flex;align-items:center;gap:8px;font-family:Syne,system-ui,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.28em;text-transform:uppercase;color:rgba(253,252,250,0.78);transition:color 0.32s cubic-bezier(0.22,1,0.36,1),letter-spacing 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-card-go svg{width:18px;height:9px;stroke-width:1.2;transition:transform 0.34s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-card:hover .svc-dd-card-go,.svc-dd-card:focus-visible .svc-dd-card-go{color:#fdfcfa}'
      + '.svc-dd-card:hover .svc-dd-card-go svg,.svc-dd-card:focus-visible .svc-dd-card-go svg{transform:translateX(4px)}'
      /* Gold rule sweep */
      + '.svc-dd-card-rule{position:absolute;left:0;right:0;bottom:0;height:1px;background:#c4a35a;transform:scaleX(0);transform-origin:left center;transition:transform 0.7s cubic-bezier(0.22,1,0.36,1);z-index:3}'
      + '.svc-dd-card:hover .svc-dd-card-rule,.svc-dd-card:focus-visible .svc-dd-card-rule{transform:scaleX(1)}'
      /* Footer */
      + '.svc-dd-footer{display:flex;align-items:center;justify-content:space-between;padding:16px 28px 20px;border-top:1px solid rgba(14,22,32,0.06);font-family:Syne,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#525a66;text-decoration:none;transition:color 0.3s;background:rgba(196,163,90,0.025)}'
      + '.svc-dd-footer:hover{color:#c4a35a}'
      + '.svc-dd-footer-arrow{display:inline-flex;align-items:center;width:20px;height:10px;transition:transform 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-footer-arrow svg{width:20px;height:10px;stroke-width:1.3}'
      + '.svc-dd-footer:hover .svc-dd-footer-arrow{transform:translateX(5px)}'
      /* Dark mode */
      + 'html.dark .svc-dd-menu{background:#0d131c;border-color:rgba(196,163,90,0.18);box-shadow:0 30px 60px -20px rgba(0,0,0,0.7),0 18px 36px -18px rgba(0,0,0,0.5)}'
      + 'html.dark .svc-dd-head{border-bottom-color:rgba(249,248,247,0.06)}'
      + 'html.dark .svc-dd-tagline{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-card{border-color:rgba(196,163,90,0.22)}'
      + 'html.dark .svc-dd-card:hover,html.dark .svc-dd-card:focus-visible{border-color:#c4a35a}'
      + 'html.dark .svc-dd-footer{border-top-color:rgba(249,248,247,0.06);color:rgba(249,248,247,0.6);background:rgba(196,163,90,0.04)}'
      + 'html.dark .svc-dd-footer:hover{color:#c4a35a}'
      /* Mobile: hide dropdown menu (mobile-nav handles its own list) */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd-card,.svc-dd-card-img,.svc-dd-card-rule,.svc-dd-card-go,.svc-dd-card-go svg,.svc-dd-trigger svg,.svc-dd-footer-arrow{transition:opacity 0.2s !important}.svc-dd-menu{transform:translateX(-50%) !important}.svc-dd-card-img{transform:none !important}.svc-dd-card:hover .svc-dd-card-img,.svc-dd-card:focus-visible .svc-dd-card-img{transform:none !important}.svc-dd-card-rule{transform:scaleX(1) !important;opacity:0}.svc-dd-card:hover .svc-dd-card-rule,.svc-dd-card:focus-visible .svc-dd-card-rule{opacity:1}}';
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

    // Header: eyebrow + italic tagline on one editorial line
    var head = document.createElement('div');
    head.className = 'svc-dd-head';
    head.innerHTML = ''
      + '<span class="svc-dd-eyebrow">' + (isES ? 'Servicios' : 'Services') + '</span>'
      + '<span class="svc-dd-tagline">' + (isES ? 'Cuatro disciplinas, una mirada cinematográfica.' : 'Four disciplines, one cinematic eye.') + '</span>';
    menu.appendChild(head);

    // Grid of 4 thumbnail cards
    var grid = document.createElement('div');
    grid.className = 'svc-dd-grid';
    items.forEach(function(item){
      var a = document.createElement('a');
      a.className = 'svc-dd-card';
      a.href = item.href;
      a.setAttribute('role', 'menuitem');
      a.innerHTML = ''
        + '<img class="svc-dd-card-img" src="' + item.img + '" alt="' + item.alt + '" loading="lazy" decoding="async" />'
        + '<span class="svc-dd-card-veil" aria-hidden="true"></span>'
        + '<span class="svc-dd-card-rule" aria-hidden="true"></span>'
        + '<span class="svc-dd-card-cap">'
        +   '<span class="svc-dd-card-eye">' + item.eyebrow + '</span>'
        +   '<span class="svc-dd-card-ttl">' + item.title + '</span>'
        +   '<span class="svc-dd-card-go">' + exploreLabel + ' ' + tinyArrow + '</span>'
        + '</span>';
      grid.appendChild(a);
    });
    menu.appendChild(grid);

    // Footer link
    var footer = document.createElement('a');
    footer.className = 'svc-dd-footer';
    footer.href = isES ? '/es/' : '/';
    footer.innerHTML = ''
      + '<span>' + (isES ? 'Ver todo el portafolio' : 'View full portfolio') + '</span>'
      + '<span class="svc-dd-footer-arrow" aria-hidden="true">' + tinyArrow + '</span>';
    menu.appendChild(footer);

    wrap.appendChild(menu);

    // Click handler — toggle on tap (touch); hover already handled by CSS
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

    // Click outside to close
    document.addEventListener('click', function(ev){
      if (!wrap.contains(ev.target)) {
        wrap.setAttribute('data-open', 'false');
        trig.setAttribute('aria-expanded', 'false');
      }
    });

    // Esc to close
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
