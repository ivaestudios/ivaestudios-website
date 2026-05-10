/* IVAE Studios — Services dropdown (editorial mega-menu)
   Full-bleed image mega-menu: left column is a tall photo that crossfades
   as the user hovers each service in the right-hand serif index. Replaces
   the simple #services / #servicios anchor link in the site header. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { title: 'Bodas',     desc: 'Bodas destino · cobertura editorial completa', href: '/es/fotografo-bodas-destino-mexico', img: '/images/wedding-bride-cancun-beach-ivae-studios-3.jpg', cap: 'Bodas destino · Riviera Maya' },
    { title: 'Familia',   desc: 'Sesiones familiares en resorts de lujo',       href: '/es/fotos-familiares-lujo-cancun',  img: '/images/family-cancun-ivae-studios.webp',                cap: 'Familias · resorts de lujo' },
    { title: 'Parejas',   desc: 'Lunas de miel, aniversarios, escapadas',       href: '/es/fotografia-parejas-mexico',     img: '/images/couple-cancun-beach-ivae-studios.jpg',           cap: 'Parejas · lunas de miel' },
    { title: 'Editorial', desc: 'Campañas de marca y editoriales de revista',   href: '/es/editorial-de-lujo',             img: '/images/editorial-cancun-ivae-studios.jpg',              cap: 'Editorial · campañas de marca' }
  ] : [
    { title: 'Weddings',  desc: 'Destination weddings · full editorial coverage', href: '/luxury-weddings',                img: '/images/wedding-bride-cancun-beach-ivae-studios-3.jpg', cap: 'Destination weddings · Riviera Maya' },
    { title: 'Family',    desc: 'Family sessions at luxury resorts',              href: '/luxury-family-photos-cancun',    img: '/images/family-cancun-ivae-studios.webp',                cap: 'Families · luxury resorts' },
    { title: 'Couples',   desc: 'Honeymoons, anniversaries, romantic getaways',   href: '/couples-photography-mexico',     img: '/images/couple-cancun-beach-ivae-studios.jpg',           cap: 'Couples · honeymoons' },
    { title: 'Editorial', desc: 'Brand campaigns and magazine editorials',        href: '/luxury-editorial',               img: '/images/editorial-cancun-ivae-studios.jpg',              cap: 'Editorial · brand campaigns' }
  ];

  var triggerLabel = isES ? 'Servicios' : 'Services';
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>';
  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  function preloadImages(){
    items.forEach(function(it){ var i = new Image(); i.src = it.img; });
  }

  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Mega-menu shell */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 20px);left:50%;transform:translateX(-50%) translateY(-8px);transform-origin:top center;width:720px;max-width:calc(100vw - 32px);background:#fdfcfa;border:1px solid rgba(14,22,32,0.10);border-radius:1px;padding:0;box-shadow:0 24px 60px -28px rgba(14,22,32,0.22),0 8px 24px -14px rgba(14,22,32,0.10);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.42s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.5s;z-index:1100;overflow:hidden}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.42s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-menu::before{content:"";position:absolute;top:-20px;left:0;right:0;height:20px;background:transparent}'
      + '.svc-dd-grid{display:grid;grid-template-columns:300px 1fr;align-items:stretch}'
      /* LEFT — image stage */
      + '.svc-dd-stage{position:relative;overflow:hidden;background:#0e1620;min-height:420px}'
      + '.svc-dd-frame{position:absolute;inset:0}'
      + '.svc-dd-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.9s cubic-bezier(0.4,0,0.2,1),transform 6s cubic-bezier(0.22,1,0.36,1);transform:scale(1.04);will-change:opacity,transform}'
      + '.svc-dd-frame img.is-active{opacity:1;transform:scale(1)}'
      + '.svc-dd-stage::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,22,32,0) 55%,rgba(14,22,32,0.55) 100%);pointer-events:none;z-index:1}'
      + '.svc-dd-stage-top{position:absolute;top:18px;left:20px;right:20px;z-index:2;display:flex;align-items:center;color:rgba(253,252,250,0.9);font-family:Syne,system-ui,sans-serif;font-size:9px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase}'
      + '.svc-dd-stage-top::before{content:"";display:inline-block;width:18px;height:1px;background:#c4a35a;margin-right:10px}'
      + '.svc-dd-stage-caption{position:absolute;left:20px;right:20px;bottom:18px;z-index:2;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:13px;font-weight:400;line-height:1.3;color:#fdfcfa;letter-spacing:0.01em;opacity:0;transform:translateY(6px);transition:opacity 0.45s cubic-bezier(0.22,1,0.36,1) 0.05s,transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s}'
      + '.svc-dd-stage-caption.is-active{opacity:1;transform:translateY(0)}'
      + '.svc-dd-stage-caption::before{content:"";display:block;width:22px;height:1px;background:#c4a35a;margin-bottom:8px;opacity:0.9}'
      /* RIGHT — serif index */
      + '.svc-dd-index{display:flex;flex-direction:column;padding:26px 30px 18px}'
      + '.svc-dd-head{padding-bottom:14px;margin-bottom:6px;position:relative}'
      + '.svc-dd-head::after{content:"";position:absolute;left:0;bottom:0;width:34px;height:1px;background:#c4a35a}'
      + '.svc-dd-eyebrow{display:block;font-family:Syne,system-ui,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:#c4a35a;margin-bottom:6px}'
      + '.svc-dd-tagline{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:14px;font-weight:400;color:#525a66;line-height:1.35;letter-spacing:0.005em}'
      + '.svc-dd-list{display:flex;flex-direction:column;padding:4px 0 2px;flex:1}'
      + '.svc-dd-item{display:grid;grid-template-columns:8px 1fr 14px;align-items:baseline;column-gap:14px;padding:14px 0;text-decoration:none;color:#0e1620;position:relative;border-bottom:1px solid rgba(14,22,32,0.07);transition:color 0.3s ease}'
      + '.svc-dd-item:last-child{border-bottom:0}'
      + '.svc-dd-item:focus-visible{outline:none}'
      /* Tiny gold dot — replaces roman numerals */
      + '.svc-dd-dot{width:5px;height:5px;border-radius:50%;background:rgba(196,163,90,0.4);align-self:center;transition:background 0.32s ease,transform 0.4s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item:hover .svc-dd-dot,.svc-dd-item:focus-visible .svc-dd-dot,.svc-dd-item.is-active .svc-dd-dot{background:#c4a35a;transform:scale(1.3)}'
      + '.svc-dd-text{min-width:0;position:relative}'
      + '.svc-dd-title{display:inline-block;font-family:"Cormorant Garamond",Georgia,serif;font-size:26px;font-weight:400;line-height:1.05;letter-spacing:-0.005em;color:#0e1620;margin-bottom:3px;position:relative;transition:transform 0.5s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-title::after{content:"";position:absolute;left:0;bottom:-2px;width:100%;height:1px;background:#c4a35a;transform:scaleX(0);transform-origin:left center;transition:transform 0.55s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item:hover .svc-dd-title::after,.svc-dd-item:focus-visible .svc-dd-title::after,.svc-dd-item.is-active .svc-dd-title::after{transform:scaleX(1)}'
      + '.svc-dd-item:hover .svc-dd-title,.svc-dd-item:focus-visible .svc-dd-title{transform:translateX(2px)}'
      + '.svc-dd-desc{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:13px;line-height:1.4;color:#6b7280;font-weight:400;letter-spacing:0.005em;margin-top:2px}'
      + '.svc-dd-arrow{align-self:center;width:14px;height:10px;color:#c4a35a;opacity:0;transform:translateX(-6px);transition:opacity 0.32s ease,transform 0.36s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-arrow svg{width:14px;height:10px;stroke-width:1.4}'
      + '.svc-dd-item:hover .svc-dd-arrow,.svc-dd-item:focus-visible .svc-dd-arrow,.svc-dd-item.is-active .svc-dd-arrow{opacity:1;transform:translateX(0)}'
      /* Footer */
      + '.svc-dd-foot{display:flex;align-items:center;justify-content:space-between;padding:14px 0 2px;margin-top:6px;border-top:1px solid rgba(14,22,32,0.10);text-decoration:none;color:#0e1620;position:relative}'
      + '.svc-dd-foot::before{content:"";position:absolute;left:0;top:-1px;width:34px;height:1px;background:#c4a35a}'
      + '.svc-dd-foot-label{font-family:Syne,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:#525a66;transition:color 0.3s ease}'
      + '.svc-dd-foot:hover .svc-dd-foot-label{color:#c4a35a}'
      + '.svc-dd-foot-arrow{display:inline-flex;align-items:center;width:22px;height:11px;color:#c4a35a;transition:transform 0.35s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-foot-arrow svg{width:22px;height:11px;stroke-width:1.4}'
      + '.svc-dd-foot:hover .svc-dd-foot-arrow{transform:translateX(6px)}'
      /* Dark mode */
      + 'html.dark .svc-dd-menu{background:#0d131c;border-color:rgba(196,163,90,0.18);box-shadow:0 30px 60px -22px rgba(0,0,0,0.7),0 10px 26px -16px rgba(0,0,0,0.55)}'
      + 'html.dark .svc-dd-stage{background:#06090d}'
      + 'html.dark .svc-dd-stage::after{background:linear-gradient(180deg,rgba(6,9,13,0) 50%,rgba(6,9,13,0.65) 100%)}'
      + 'html.dark .svc-dd-tagline{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-item{color:#f9f8f7;border-bottom-color:rgba(249,248,247,0.08)}'
      + 'html.dark .svc-dd-item:last-child{border-bottom:0}'
      + 'html.dark .svc-dd-title{color:#f9f8f7}'
      + 'html.dark .svc-dd-desc{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-foot{color:#f9f8f7;border-top-color:rgba(249,248,247,0.10)}'
      + 'html.dark .svc-dd-foot-label{color:rgba(249,248,247,0.6)}'
      + 'html.dark .svc-dd-foot:hover .svc-dd-foot-label{color:#c4a35a}'
      /* Mobile hide */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd-item,.svc-dd-arrow,.svc-dd-dot,.svc-dd-trigger svg,.svc-dd-frame img,.svc-dd-stage-caption,.svc-dd-title,.svc-dd-title::after,.svc-dd-foot-arrow{transition:opacity 0.2s !important;transform:none !important}.svc-dd-menu{transform:translateX(-50%) !important}.svc-dd-frame img{transform:none !important}}';
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

    var grid = document.createElement('div');
    grid.className = 'svc-dd-grid';

    // ---- LEFT: image stage ----
    var stage = document.createElement('div');
    stage.className = 'svc-dd-stage';

    var stageTop = document.createElement('div');
    stageTop.className = 'svc-dd-stage-top';
    stageTop.innerHTML = '<span>' + (isES ? 'Trabajo' : 'Work') + '</span>';
    stage.appendChild(stageTop);

    var frame = document.createElement('div');
    frame.className = 'svc-dd-frame';
    var imgEls = [];
    items.forEach(function(it, i){
      var img = document.createElement('img');
      img.src = it.img;
      img.alt = it.title + ' — IVAE Studios';
      img.loading = 'lazy';
      img.decoding = 'async';
      if (i === 0) img.classList.add('is-active');
      frame.appendChild(img);
      imgEls.push(img);
    });
    stage.appendChild(frame);

    var caption = document.createElement('div');
    caption.className = 'svc-dd-stage-caption is-active';
    caption.textContent = items[0].cap;
    stage.appendChild(caption);

    grid.appendChild(stage);

    // ---- RIGHT: serif index ----
    var index = document.createElement('div');
    index.className = 'svc-dd-index';

    var head = document.createElement('div');
    head.className = 'svc-dd-head';
    head.innerHTML = ''
      + '<span class="svc-dd-eyebrow">' + (isES ? 'Servicios' : 'Services') + '</span>'
      + '<span class="svc-dd-tagline">' + (isES ? 'Cuatro disciplinas, una mirada cinematográfica.' : 'Four disciplines, one cinematic eye.') + '</span>';
    index.appendChild(head);

    var list = document.createElement('div');
    list.className = 'svc-dd-list';

    var itemEls = [];
    items.forEach(function(item, i){
      var a = document.createElement('a');
      a.className = 'svc-dd-item' + (i === 0 ? ' is-active' : '');
      a.href = item.href;
      a.setAttribute('role', 'menuitem');
      a.innerHTML = ''
        + '<span class="svc-dd-dot" aria-hidden="true"></span>'
        + '<span class="svc-dd-text">'
        +   '<span class="svc-dd-title">' + item.title + '</span>'
        +   '<span class="svc-dd-desc">' + item.desc + '</span>'
        + '</span>'
        + '<span class="svc-dd-arrow" aria-hidden="true">' + arrow + '</span>';
      list.appendChild(a);
      itemEls.push(a);
    });
    index.appendChild(list);

    var foot = document.createElement('a');
    foot.className = 'svc-dd-foot';
    foot.href = isES ? '/es/' : '/';
    foot.innerHTML = ''
      + '<span class="svc-dd-foot-label">' + (isES ? 'Ver portafolio completo' : 'View full portfolio') + '</span>'
      + '<span class="svc-dd-foot-arrow" aria-hidden="true">' + arrow + '</span>';
    index.appendChild(foot);

    grid.appendChild(index);
    menu.appendChild(grid);
    wrap.appendChild(menu);

    function activate(i){
      itemEls.forEach(function(el, j){ el.classList.toggle('is-active', j === i); });
      imgEls.forEach(function(el, j){ el.classList.toggle('is-active', j === i); });
      caption.classList.remove('is-active');
      void caption.offsetWidth;
      caption.textContent = items[i].cap;
      caption.classList.add('is-active');
    }
    itemEls.forEach(function(el, i){
      el.addEventListener('mouseenter', function(){ activate(i); });
      el.addEventListener('focus', function(){ activate(i); });
    });

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
    preloadImages();
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
