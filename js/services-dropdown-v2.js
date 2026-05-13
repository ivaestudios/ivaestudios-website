/* IVAE Studios — Services dropdown (clean editorial card list)
   Soft cream rounded panel with line-art icons, small title + italic
   description, and a right arrow on each row. Replaces the simple
   #services / #servicios anchor link in the site header. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var icons = {
    wedding:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M7 6l2 3M17 6l-2 3M9 4h6"/></svg>',
    family:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="2.5"/><circle cx="16" cy="7" r="2.5"/><circle cx="12" cy="14" r="1.8"/><path d="M3.5 19.5c.5-2.5 2.4-4 4.5-4s4 1.5 4.5 4M11.5 19.5c.5-2.5 2.4-4 4.5-4s4 1.5 4.5 4"/></svg>',
    couple:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5l-7-7a4.5 4.5 0 0 1 6.5-6.2L12 8l.5-.7a4.5 4.5 0 0 1 6.5 6.2l-7 7z"/></svg>',
    editorial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M9 6V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6"/><circle cx="12" cy="12.5" r="3.2"/></svg>'
  };

  var items = isES ? [
    { title: 'Bodas',     desc: 'Cobertura editorial completa de bodas destino',  href: '/es/fotografo-bodas-destino-mexico', icon: 'wedding' },
    { title: 'Familia',   desc: 'Sesiones familiares en resorts de lujo',         href: '/es/fotos-familiares-lujo-cancun',  icon: 'family' },
    { title: 'Parejas',   desc: 'Lunas de miel, aniversarios y escapadas',        href: '/es/fotografia-parejas-mexico',     icon: 'couple' },
    { title: 'Editorial', desc: 'Campañas de marca y editoriales de revista',     href: '/es/editorial-de-lujo',             icon: 'editorial' }
  ] : [
    { title: 'Weddings',  desc: 'Full editorial destination wedding coverage',    href: '/destination-wedding-photographer-mexico', icon: 'wedding' },
    { title: 'Family',    desc: 'Family sessions at luxury resorts',              href: '/luxury-family-photos-cancun',      icon: 'family' },
    { title: 'Couples',   desc: 'Honeymoons, anniversaries, romantic getaways',   href: '/couples-photography-mexico',       icon: 'couple' },
    { title: 'Editorial', desc: 'Brand campaigns and magazine editorials',        href: '/luxury-editorial',                 icon: 'editorial' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var rowArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>';

  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      /* Trigger inherits the nav link look — no overrides needed */
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1),opacity 0.3s,color 0.3s;opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Panel — cream rounded, soft shadow, like the reference */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 18px);left:50%;transform:translateX(-50%) translateY(-8px);transform-origin:top center;width:440px;max-width:calc(100vw - 32px);background:#fdfcfa;border:1px solid rgba(14,22,32,0.06);border-radius:16px;padding:14px 12px;box-shadow:0 22px 50px -18px rgba(14,22,32,0.20),0 8px 22px -10px rgba(14,22,32,0.10);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.32s cubic-bezier(0.22,1,0.36,1),transform 0.42s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.42s;z-index:1100}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.32s cubic-bezier(0.22,1,0.36,1),transform 0.42s cubic-bezier(0.22,1,0.36,1)}'
      /* Hover bridge keeps menu open between trigger and panel */
      + '.svc-dd-menu::before{content:"";position:absolute;top:-18px;left:0;right:0;height:18px}'
      /* Items — high specificity (0,3,0) to beat .site-header .h-nav a (0,2,1) */
      + '.svc-dd .svc-dd-menu .svc-dd-item{display:grid !important;grid-template-columns:42px 1fr 22px !important;align-items:start !important;gap:14px !important;padding:14px 16px !important;border-radius:10px !important;text-decoration:none !important;color:#0e1620 !important;font-family:"Cormorant Garamond",Georgia,serif !important;text-transform:none !important;letter-spacing:normal !important;background:transparent !important;border:0 !important;min-height:0 !important;font-weight:400 !important;transition:background 0.28s cubic-bezier(0.22,1,0.36,1) !important}'
      + '.svc-dd .svc-dd-menu .svc-dd-item::after{content:none !important;display:none !important}'
      + '.svc-dd .svc-dd-menu .svc-dd-item:hover,.svc-dd .svc-dd-menu .svc-dd-item:focus-visible{background:rgba(196,163,90,0.07) !important;outline:none !important;transform:none !important}'
      /* Icon column */
      + '.svc-dd-icon{display:inline-flex !important;align-items:center;justify-content:center;width:42px;height:42px;color:#c4a35a;flex-shrink:0;transition:transform 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-icon svg{width:24px;height:24px}'
      + '.svc-dd .svc-dd-menu .svc-dd-item:hover .svc-dd-icon{transform:scale(1.06) translateY(-1px)}'
      /* Text stack */
      + '.svc-dd-text{min-width:0;display:flex;flex-direction:column;gap:2px;padding-top:4px}'
      + '.svc-dd-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:18px;font-weight:500;line-height:1.2;letter-spacing:-0.005em;color:#0e1620}'
      + '.svc-dd-desc{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:13px;line-height:1.4;color:#6b7280;font-weight:400;letter-spacing:0.005em}'
      /* Arrow */
      + '.svc-dd-arrow{display:inline-flex !important;align-items:center;justify-content:center;width:22px;height:22px;color:#a8b0bb;align-self:center;transition:transform 0.32s cubic-bezier(0.22,1,0.36,1),color 0.3s ease}'
      + '.svc-dd-arrow svg{width:18px;height:18px}'
      + '.svc-dd .svc-dd-menu .svc-dd-item:hover .svc-dd-arrow,.svc-dd .svc-dd-menu .svc-dd-item:focus-visible .svc-dd-arrow{transform:translateX(4px);color:#c4a35a}'
      /* Dark mode */
      + 'html.dark .svc-dd-menu{background:#10161f;border-color:rgba(196,163,90,0.16);box-shadow:0 22px 50px -18px rgba(0,0,0,0.6),0 8px 22px -10px rgba(0,0,0,0.45)}'
      + 'html.dark .svc-dd .svc-dd-menu .svc-dd-item{color:#f9f8f7 !important}'
      + 'html.dark .svc-dd .svc-dd-menu .svc-dd-item:hover,html.dark .svc-dd .svc-dd-menu .svc-dd-item:focus-visible{background:rgba(196,163,90,0.10) !important}'
      + 'html.dark .svc-dd-title{color:#f9f8f7}'
      + 'html.dark .svc-dd-desc{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-arrow{color:rgba(249,248,247,0.4)}'
      /* Mobile */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd .svc-dd-menu .svc-dd-item,.svc-dd-icon,.svc-dd-arrow,.svc-dd-trigger svg{transition:opacity 0.2s !important;transform:none !important}.svc-dd-menu{transform:translateX(-50%) !important}.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{transform:translateX(-50%) !important}}';
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
      a.innerHTML = ''
        + '<span class="svc-dd-icon" aria-hidden="true">' + (icons[item.icon] || '') + '</span>'
        + '<span class="svc-dd-text">'
        +   '<span class="svc-dd-title">' + item.title + '</span>'
        +   '<span class="svc-dd-desc">' + item.desc + '</span>'
        + '</span>'
        + '<span class="svc-dd-arrow" aria-hidden="true">' + rowArrow + '</span>';
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
