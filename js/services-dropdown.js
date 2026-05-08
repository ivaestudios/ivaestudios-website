/* IVAE Studios — Services dropdown
   Replaces the simple #services anchor link in the site header with a
   styled dropdown (Weddings / Family / Couples / Editorial). Loaded on
   every page via the existing /js/lang-detect.js position pattern. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { title: 'Bodas', desc: 'Cobertura editorial completa de bodas destino', href: '/es/fotografo-bodas-destino-mexico', icon: 'wedding' },
    { title: 'Familia', desc: 'Sesiones familiares en resorts de lujo', href: '/es/fotos-familiares-lujo-cancun', icon: 'family' },
    { title: 'Parejas', desc: 'Lunas de miel, aniversarios, escapadas', href: '/es/fotografia-parejas-mexico', icon: 'couple' },
    { title: 'Editorial', desc: 'Sesiones editoriales y estilo de marca', href: '/es/blog/estilo-fotografo-lujo-editorial-vs-documental', icon: 'editorial' }
  ] : [
    { title: 'Weddings', desc: 'Full editorial destination wedding coverage', href: '/luxury-weddings', icon: 'wedding' },
    { title: 'Family', desc: 'Family sessions at luxury resorts', href: '/luxury-family-photos-cancun', icon: 'family' },
    { title: 'Couples', desc: 'Honeymoons, anniversaries, romantic getaways', href: '/couples-photography-mexico', icon: 'couple' },
    { title: 'Editorial', desc: 'Editorial sessions & brand styling', href: '/blog/luxury-photographer-style-editorial-vs-documentary', icon: 'editorial' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';

  var icons = {
    wedding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>',
    family: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="2.5"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    couple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    editorial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v16"/></svg>'
  };

  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  // Inject CSS once
  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:6px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);opacity:0.7}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg{transform:rotate(180deg);opacity:1}'
      + '.svc-dd-menu{position:absolute;top:calc(100% + 18px);left:50%;transform:translateX(-50%) translateY(-8px);min-width:380px;max-width:420px;background:#fafaf8;border:1px solid rgba(14,22,32,0.08);border-radius:14px;padding:10px;box-shadow:0 24px 64px rgba(14,22,32,0.16),0 4px 12px rgba(14,22,32,0.06);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.28s cubic-bezier(0.22,1,0.36,1),transform 0.32s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.32s;z-index:1100}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.28s cubic-bezier(0.22,1,0.36,1),transform 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-menu::before{content:"";position:absolute;top:-18px;left:0;right:0;height:18px}'
      + '.svc-dd-item{display:flex;align-items:flex-start;gap:14px;padding:12px 14px;border-radius:10px;text-decoration:none;color:#0e1620;transition:background 0.22s}'
      + '.svc-dd-item:hover,.svc-dd-item:focus-visible{background:rgba(196,163,90,0.10);outline:none}'
      + '.svc-dd-icon{flex-shrink:0;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;background:rgba(196,163,90,0.12);border-radius:8px;color:#c4a35a}'
      + '.svc-dd-icon svg{width:18px;height:18px}'
      + '.svc-dd-text{flex:1;min-width:0}'
      + '.svc-dd-title{display:block;font-family:Syne,system-ui,sans-serif;font-size:13.5px;font-weight:700;line-height:1.2;letter-spacing:0;color:#0e1620;margin-bottom:3px}'
      + '.svc-dd-desc{display:block;font-family:"Cormorant Garamond",serif;font-style:italic;font-size:12.5px;line-height:1.4;color:#525a66;font-weight:400}'
      + '.svc-dd-arrow{flex-shrink:0;align-self:center;width:14px;height:14px;color:#8a8f97;opacity:0;transform:translateX(-4px);transition:opacity 0.22s,transform 0.22s,color 0.22s}'
      + '.svc-dd-arrow svg{width:14px;height:14px}'
      + '.svc-dd-item:hover .svc-dd-arrow{opacity:1;transform:translateX(0);color:#c4a35a}'
      + '/* Dark mode */'
      + 'html.dark .svc-dd-menu{background:#131a26;border-color:rgba(196,163,90,0.22);box-shadow:0 24px 64px rgba(0,0,0,0.55),0 4px 12px rgba(0,0,0,0.35)}'
      + 'html.dark .svc-dd-item{color:#f9f8f7}'
      + 'html.dark .svc-dd-item:hover{background:rgba(196,163,90,0.14)}'
      + 'html.dark .svc-dd-title{color:#f9f8f7}'
      + 'html.dark .svc-dd-desc{color:rgba(249,248,247,0.62)}'
      + 'html.dark .svc-dd-arrow{color:rgba(249,248,247,0.5)}'
      + 'html.dark .svc-dd-icon{background:rgba(196,163,90,0.16)}'
      + '/* Mobile: hide dropdown menu (mobile-nav handles its own list) */'
      + '@media(max-width:899px){.svc-dd-menu{display:none}}';
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
        + '<span class="svc-dd-arrow" aria-hidden="true">' + arrow + '</span>';
      menu.appendChild(a);
    });

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
    var navs = document.querySelectorAll('.header-nav, ul.header-nav');
    navs.forEach(function(nav){
      var link = nav.querySelector('a[href="#services"], a[href="#servicios"]');
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
