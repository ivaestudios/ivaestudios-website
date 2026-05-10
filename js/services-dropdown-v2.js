/* IVAE Studios — Services dropdown (editorial luxury redesign)
   Replaces the simple #services anchor link in the site header with a
   refined editorial dropdown (Weddings / Family / Couples / Editorial).
   Loaded on every page via the existing /js/lang-detect.js position pattern. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { num: 'I',   title: 'Bodas',     desc: 'Bodas destino · cobertura editorial completa', href: '/es/fotografo-bodas-destino-mexico' },
    { num: 'II',  title: 'Familia',   desc: 'Sesiones familiares en resorts de lujo',       href: '/es/fotos-familiares-lujo-cancun' },
    { num: 'III', title: 'Parejas',   desc: 'Lunas de miel, aniversarios, escapadas',       href: '/es/fotografia-parejas-mexico' },
    { num: 'IV',  title: 'Editorial', desc: 'Campañas de marca y editoriales de revista',   href: '/es/editorial-de-lujo' }
  ] : [
    { num: 'I',   title: 'Weddings',  desc: 'Destination weddings · full editorial coverage', href: '/luxury-weddings' },
    { num: 'II',  title: 'Family',    desc: 'Family sessions at luxury resorts',              href: '/luxury-family-photos-cancun' },
    { num: 'III', title: 'Couples',   desc: 'Honeymoons, anniversaries, romantic getaways',   href: '/couples-photography-mexico' },
    { num: 'IV',  title: 'Editorial', desc: 'Brand campaigns and magazine editorials',        href: '/luxury-editorial' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  // Inject CSS once
  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Menu shell — wider, lighter, more editorial */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 22px);left:50%;transform:translateX(-50%) translateY(-10px);transform-origin:top center;width:480px;max-width:calc(100vw - 32px);background:#fdfcfa;border:1px solid rgba(14,22,32,0.08);border-radius:2px;padding:0;box-shadow:0 30px 60px -20px rgba(14,22,32,0.18),0 18px 36px -18px rgba(14,22,32,0.10);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.35s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.45s;z-index:1100}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.35s cubic-bezier(0.22,1,0.36,1),transform 0.45s cubic-bezier(0.22,1,0.36,1)}'
      /* Hover bridge — keeps menu open between trigger and panel */
      + '.svc-dd-menu::before{content:"";position:absolute;top:-22px;left:0;right:0;height:22px}'
      /* Eyebrow — Syne, gold, ultra letterspaced */
      + '.svc-dd-head{padding:30px 36px 18px;border-bottom:1px solid rgba(14,22,32,0.06);position:relative}'
      + '.svc-dd-head::after{content:"";position:absolute;left:36px;bottom:-1px;width:42px;height:1px;background:#c4a35a}'
      + '.svc-dd-eyebrow{display:block;font-family:Syne,system-ui,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:#c4a35a;margin-bottom:6px}'
      + '.svc-dd-tagline{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:14px;font-weight:400;color:#525a66;line-height:1.4;letter-spacing:0.005em}'
      /* Items list */
      + '.svc-dd-list{padding:10px 0}'
      + '.svc-dd-item{display:grid;grid-template-columns:54px 1fr 22px;align-items:baseline;gap:0;padding:18px 36px;text-decoration:none;color:#0e1620;position:relative;transition:background 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item + .svc-dd-item{border-top:1px solid rgba(14,22,32,0.05)}'
      + '.svc-dd-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:#c4a35a;transform:scaleY(0);transform-origin:center;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item:hover,.svc-dd-item:focus-visible{background:rgba(196,163,90,0.04);outline:none}'
      + '.svc-dd-item:hover::before,.svc-dd-item:focus-visible::before{transform:scaleY(1)}'
      /* Roman numeral — small, editorial */
      + '.svc-dd-num{font-family:"Cormorant Garamond",Georgia,serif;font-size:13px;font-weight:400;font-style:italic;color:#c4a35a;letter-spacing:0.08em;line-height:1;padding-top:6px;transition:color 0.3s,transform 0.4s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item:hover .svc-dd-num{transform:translateX(-2px)}'
      /* Text */
      + '.svc-dd-text{min-width:0}'
      + '.svc-dd-title{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;font-weight:400;line-height:1.1;letter-spacing:-0.01em;color:#0e1620;margin-bottom:4px;transition:color 0.3s}'
      + '.svc-dd-item:hover .svc-dd-title{color:#0e1620}'
      + '.svc-dd-desc{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:13.5px;line-height:1.45;color:#6b7280;font-weight:400;letter-spacing:0.005em}'
      /* Arrow — minimal, editorial */
      + '.svc-dd-arrow{align-self:center;width:22px;height:14px;color:#c4a35a;opacity:0;transform:translateX(-8px);transition:opacity 0.32s cubic-bezier(0.22,1,0.36,1),transform 0.34s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-arrow svg{width:22px;height:14px;stroke-width:1.4}'
      + '.svc-dd-item:hover .svc-dd-arrow,.svc-dd-item:focus-visible .svc-dd-arrow{opacity:1;transform:translateX(0)}'
      /* Footer — minimal */
      + '.svc-dd-footer{display:flex;align-items:center;justify-content:space-between;padding:18px 36px 22px;border-top:1px solid rgba(14,22,32,0.06);font-family:Syne,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#525a66;text-decoration:none;transition:color 0.3s;background:rgba(196,163,90,0.025)}'
      + '.svc-dd-footer:hover{color:#c4a35a}'
      + '.svc-dd-footer-arrow{display:inline-flex;align-items:center;width:18px;height:11px;transition:transform 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-footer-arrow svg{width:18px;height:11px;stroke-width:1.4}'
      + '.svc-dd-footer:hover .svc-dd-footer-arrow{transform:translateX(5px)}'
      /* Dark mode — true editorial dark */
      + 'html.dark .svc-dd-menu{background:#0d131c;border-color:rgba(196,163,90,0.18);box-shadow:0 30px 60px -20px rgba(0,0,0,0.7),0 18px 36px -18px rgba(0,0,0,0.5)}'
      + 'html.dark .svc-dd-head{border-bottom-color:rgba(249,248,247,0.06)}'
      + 'html.dark .svc-dd-tagline{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-item{color:#f9f8f7}'
      + 'html.dark .svc-dd-item + .svc-dd-item{border-top-color:rgba(249,248,247,0.05)}'
      + 'html.dark .svc-dd-item:hover{background:rgba(196,163,90,0.06)}'
      + 'html.dark .svc-dd-title{color:#f9f8f7}'
      + 'html.dark .svc-dd-item:hover .svc-dd-title{color:#fff}'
      + 'html.dark .svc-dd-desc{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-footer{border-top-color:rgba(249,248,247,0.06);color:rgba(249,248,247,0.6);background:rgba(196,163,90,0.04)}'
      + 'html.dark .svc-dd-footer:hover{color:#c4a35a}'
      /* Mobile: hide dropdown menu (mobile-nav handles its own list) */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd-item,.svc-dd-arrow,.svc-dd-num,.svc-dd-trigger svg{transition:opacity 0.2s !important}.svc-dd-menu{transform:translateX(-50%) !important}}';
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

    // Header: eyebrow + tagline
    var head = document.createElement('div');
    head.className = 'svc-dd-head';
    head.innerHTML = ''
      + '<span class="svc-dd-eyebrow">' + (isES ? 'Servicios' : 'Services') + '</span>'
      + '<span class="svc-dd-tagline">' + (isES ? 'Cuatro disciplinas, una mirada cinematográfica.' : 'Four disciplines, one cinematic eye.') + '</span>';
    menu.appendChild(head);

    // Items list
    var list = document.createElement('div');
    list.className = 'svc-dd-list';
    items.forEach(function(item){
      var a = document.createElement('a');
      a.className = 'svc-dd-item';
      a.href = item.href;
      a.setAttribute('role', 'menuitem');
      a.innerHTML = ''
        + '<span class="svc-dd-num" aria-hidden="true">' + item.num + '</span>'
        + '<span class="svc-dd-text">'
        +   '<span class="svc-dd-title">' + item.title + '</span>'
        +   '<span class="svc-dd-desc">' + item.desc + '</span>'
        + '</span>'
        + '<span class="svc-dd-arrow" aria-hidden="true">' + arrow + '</span>';
      list.appendChild(a);
    });
    menu.appendChild(list);

    // Footer link "View all" / "Ver todos"
    var footer = document.createElement('a');
    footer.className = 'svc-dd-footer';
    footer.href = isES ? '/es/' : '/';
    footer.innerHTML = ''
      + '<span>' + (isES ? 'Ver todo el portafolio' : 'View full portfolio') + '</span>'
      + '<span class="svc-dd-footer-arrow" aria-hidden="true">' + arrow + '</span>';
    menu.appendChild(footer);

    wrap.appendChild(menu);

    // Click handler — toggle on tap (mobile/touch); hover already handled by CSS
    trig.addEventListener('click', function(ev){
      if (window.matchMedia && matchMedia('(hover: hover)').matches) {
        // Desktop with hover — let the link work normally only if href has #
        if ((trig.getAttribute('href') || '').charAt(0) === '#') return; // anchor scroll OK
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
      // Match any href ending in #services or #servicios (handles
      // /#services, /es/#services, #services, #servicios, etc.)
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
