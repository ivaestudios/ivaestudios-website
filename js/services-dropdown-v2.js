/* IVAE Studios — Services dropdown (cinematic split, editorial-luxury)
   Wide 50/50 menu: feature panel on the left (large serif title + tagline +
   animated gold rule), refined list on the right (Syne labels + italic chapter mark).
   Hover or focus on a label swaps the feature panel with a soft crossfade. */
(function(){
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isES = lang.indexOf('es') === 0 || location.pathname.indexOf('/es/') === 0 || location.pathname === '/es';

  var items = isES ? [
    { num: '01', label: 'Bodas',     title: 'Bodas',     tagline: 'Bodas destino con mirada cinematográfica, sin prisa.',     href: '/es/fotografo-bodas-destino-mexico' },
    { num: '02', label: 'Familia',   title: 'Familia',   tagline: 'Retratos familiares en resorts de lujo del Caribe.',       href: '/es/fotos-familiares-lujo-cancun' },
    { num: '03', label: 'Parejas',   title: 'Parejas',   tagline: 'Lunas de miel, aniversarios y escapadas íntimas.',         href: '/es/fotografia-parejas-mexico' },
    { num: '04', label: 'Editorial', title: 'Editorial', tagline: 'Campañas de marca y editoriales de revista.',              href: '/es/editorial-de-lujo' }
  ] : [
    { num: '01', label: 'Weddings',  title: 'Weddings',  tagline: 'Destination weddings shot with an unhurried, cinematic eye.', href: '/luxury-weddings' },
    { num: '02', label: 'Family',    title: 'Family',    tagline: 'Family portraiture inside the Caribbean’s finest resorts.', href: '/luxury-family-photos-cancun' },
    { num: '03', label: 'Couples',   title: 'Couples',   tagline: 'Honeymoons, anniversaries, and quiet romantic getaways.',     href: '/couples-photography-mexico' },
    { num: '04', label: 'Editorial', title: 'Editorial', tagline: 'Brand campaigns and magazine-grade editorial stories.',       href: '/luxury-editorial' }
  ];

  var triggerLabel  = isES ? 'Servicios' : 'Services';
  var eyebrowLabel  = isES ? 'En foco' : 'Now Featuring';
  var indexLabel    = isES ? 'Capítulo' : 'Chapter';
  var totalLabel    = ('0' + items.length).slice(-2);
  var ctaLabel      = isES ? 'Descubrir' : 'Discover';

  var caret = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>';

  if (!document.getElementById('ivae-services-dropdown-style')) {
    var style = document.createElement('style');
    style.id = 'ivae-services-dropdown-style';
    style.textContent = ''
      + '.svc-dd{position:relative;display:inline-flex;align-items:center}'
      + '.svc-dd-trigger{display:inline-flex;align-items:center;gap:7px;color:inherit;font:inherit;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;font-size:inherit}'
      + '.svc-dd-trigger svg{width:9px;height:9px;transition:transform 0.45s cubic-bezier(0.22,1,0.36,1);opacity:0.55}'
      + '.svc-dd[data-open="true"] .svc-dd-trigger svg,.svc-dd:hover .svc-dd-trigger svg,.svc-dd:focus-within .svc-dd-trigger svg{transform:rotate(180deg);opacity:1;color:#c4a35a}'
      /* Menu shell */
      + '.svc-dd-menu{position:absolute;top:calc(100% + 22px);left:50%;transform:translateX(-50%) translateY(-12px);transform-origin:top center;width:640px;max-width:calc(100vw - 32px);background:#fdfcfa;border:1px solid rgba(14,22,32,0.07);border-radius:2px;box-shadow:0 36px 70px -28px rgba(14,22,32,0.22),0 22px 44px -22px rgba(14,22,32,0.10);opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.4s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1),visibility 0s linear 0.5s;z-index:1100;overflow:hidden}'
      + '.svc-dd[data-open="true"] .svc-dd-menu,.svc-dd:hover .svc-dd-menu,.svc-dd:focus-within .svc-dd-menu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0);transition:opacity 0.4s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-menu::before{content:"";position:absolute;top:-22px;left:0;right:0;height:22px;background:transparent}'
      + '.svc-dd-grid{display:grid;grid-template-columns:1fr 1fr;min-height:340px;position:relative}'
      + '.svc-dd-grid::after{content:"";position:absolute;top:32px;bottom:32px;left:50%;width:1px;background:rgba(14,22,32,0.07);transform:translateX(-0.5px)}'
      /* Feature panel (LEFT) */
      + '.svc-dd-feature{position:relative;padding:34px 34px 30px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}'
      + '.svc-dd-feature-top{display:flex;flex-direction:column;gap:14px}'
      + '.svc-dd-eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:Syne,system-ui,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:#c4a35a;line-height:1}'
      + '.svc-dd-eyebrow::before{content:"";display:inline-block;width:18px;height:1px;background:#c4a35a;opacity:0.85}'
      /* Crossfading title */
      + '.svc-dd-title-wrap{position:relative;min-height:128px;display:flex;align-items:flex-start}'
      + '.svc-dd-title{font-family:"Cormorant Garamond",Georgia,serif;font-weight:400;font-size:50px;line-height:0.96;letter-spacing:-0.012em;color:#0e1620;margin:0;position:absolute;top:0;left:0;right:0;opacity:0;transform:translateY(6px);transition:opacity 0.45s cubic-bezier(0.22,1,0.36,1),transform 0.55s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-title[data-active="true"]{opacity:1;transform:translateY(0)}'
      /* Gold rule that ticks across */
      + '.svc-dd-rule{position:relative;height:1px;background:rgba(14,22,32,0.10);overflow:hidden;margin-top:4px}'
      /* Tagline crossfade */
      + '.svc-dd-tagline-wrap{position:relative;min-height:54px}'
      + '.svc-dd-tagline{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:400;font-size:15px;line-height:1.45;color:#525a66;letter-spacing:0.005em;margin:0;position:absolute;top:0;left:0;right:0;opacity:0;transform:translateY(4px);transition:opacity 0.45s cubic-bezier(0.22,1,0.36,1) 0.05s,transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s}'
      + '.svc-dd-tagline[data-active="true"]{opacity:1;transform:translateY(0)}'
      /* Bottom row */
      + '.svc-dd-feature-bot{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:24px}'
      + '.svc-dd-counter{font-family:Syne,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:#525a66;line-height:1;display:inline-flex;align-items:baseline;gap:6px}'
      + '.svc-dd-counter-num{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:400;font-size:18px;letter-spacing:0;color:#c4a35a;line-height:1;display:inline-block;min-width:22px;transition:opacity 0.3s ease}'
      + '.svc-dd-counter-sep{display:inline-block;width:14px;height:1px;background:rgba(14,22,32,0.18);transform:translateY(-4px)}'
      + '.svc-dd-counter-total{font-family:Syne,system-ui,sans-serif;font-size:10px;letter-spacing:0.24em;color:rgba(14,22,32,0.45)}'
      + '.svc-dd-cta{display:inline-flex;align-items:center;gap:10px;font-family:Syne,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:#0e1620;text-decoration:none;line-height:1;padding:6px 0;border-bottom:1px solid rgba(14,22,32,0.18);transition:color 0.3s,border-color 0.3s}'
      + '.svc-dd-cta svg{width:22px;height:12px;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-cta:hover{color:#c4a35a;border-bottom-color:#c4a35a}'
      + '.svc-dd-cta:hover svg{transform:translateX(5px)}'
      /* List column (RIGHT) */
      + '.svc-dd-list{padding:30px 0;display:flex;flex-direction:column;justify-content:center}'
      + '.svc-dd-item{display:grid;grid-template-columns:48px 1fr;align-items:center;gap:0;padding:14px 34px 14px 30px;text-decoration:none;color:#0e1620;position:relative;transition:color 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item:focus-visible{outline:none}'
      + '.svc-dd-item::before{content:"";position:absolute;left:0;top:50%;width:14px;height:1px;background:#c4a35a;transform:translateY(-50%) scaleX(0);transform-origin:left center;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item[data-active="true"]::before,.svc-dd-item:hover::before,.svc-dd-item:focus-visible::before{transform:translateY(-50%) scaleX(1)}'
      + '.svc-dd-num{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:400;font-size:14px;color:rgba(14,22,32,0.35);letter-spacing:0.04em;line-height:1;transition:color 0.32s cubic-bezier(0.22,1,0.36,1)}'
      + '.svc-dd-item[data-active="true"] .svc-dd-num,.svc-dd-item:hover .svc-dd-num,.svc-dd-item:focus-visible .svc-dd-num{color:#c4a35a}'
      + '.svc-dd-label{font-family:Syne,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:#0e1620;line-height:1;transition:color 0.32s cubic-bezier(0.22,1,0.36,1),transform 0.4s cubic-bezier(0.22,1,0.36,1);display:inline-block;transform-origin:left center}'
      + '.svc-dd-item[data-active="true"] .svc-dd-label,.svc-dd-item:hover .svc-dd-label,.svc-dd-item:focus-visible .svc-dd-label{color:#0e1620;transform:translateX(6px)}'
      + '.svc-dd-list[data-hovering="true"] .svc-dd-item:not(:hover):not([data-active="true"]) .svc-dd-label{color:rgba(14,22,32,0.40)}'
      + '.svc-dd-list[data-hovering="true"] .svc-dd-item:not(:hover):not([data-active="true"]) .svc-dd-num{color:rgba(14,22,32,0.22)}'
      /* Dark mode */
      + 'html.dark .svc-dd-menu{background:#0d131c;border-color:rgba(196,163,90,0.16);box-shadow:0 36px 70px -28px rgba(0,0,0,0.75),0 22px 44px -22px rgba(0,0,0,0.55)}'
      + 'html.dark .svc-dd-grid::after{background:rgba(249,248,247,0.07)}'
      + 'html.dark .svc-dd-title{color:#f9f8f7}'
      + 'html.dark .svc-dd-tagline{color:rgba(249,248,247,0.58)}'
      + 'html.dark .svc-dd-rule{background:rgba(249,248,247,0.08)}'
      + 'html.dark .svc-dd-counter{color:rgba(249,248,247,0.55)}'
      + 'html.dark .svc-dd-counter-sep{background:rgba(249,248,247,0.18)}'
      + 'html.dark .svc-dd-counter-total{color:rgba(249,248,247,0.40)}'
      + 'html.dark .svc-dd-cta{color:#f9f8f7;border-bottom-color:rgba(249,248,247,0.20)}'
      + 'html.dark .svc-dd-cta:hover{color:#c4a35a;border-bottom-color:#c4a35a}'
      + 'html.dark .svc-dd-item{color:#f9f8f7}'
      + 'html.dark .svc-dd-label{color:#f9f8f7}'
      + 'html.dark .svc-dd-item[data-active="true"] .svc-dd-label,html.dark .svc-dd-item:hover .svc-dd-label,html.dark .svc-dd-item:focus-visible .svc-dd-label{color:#fdfcfa}'
      + 'html.dark .svc-dd-num{color:rgba(249,248,247,0.32)}'
      + 'html.dark .svc-dd-list[data-hovering="true"] .svc-dd-item:not(:hover):not([data-active="true"]) .svc-dd-label{color:rgba(249,248,247,0.38)}'
      + 'html.dark .svc-dd-list[data-hovering="true"] .svc-dd-item:not(:hover):not([data-active="true"]) .svc-dd-num{color:rgba(249,248,247,0.22)}'
      /* Mobile */
      + '@media(max-width:899px){.svc-dd-menu{display:none}}'
      /* Reduced motion */
      + '@media (prefers-reduced-motion: reduce){.svc-dd-menu,.svc-dd-item,.svc-dd-label,.svc-dd-num,.svc-dd-title,.svc-dd-tagline,.svc-dd-trigger svg,.svc-dd-cta svg{transition:opacity 0.2s !important;transform:none !important}.svc-dd-menu{transform:translateX(-50%) !important}.svc-dd-title[data-active="true"],.svc-dd-tagline[data-active="true"]{opacity:1}}';
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

    // ---- LEFT: feature panel ----
    var feature = document.createElement('div');
    feature.className = 'svc-dd-feature';

    var fTop = document.createElement('div');
    fTop.className = 'svc-dd-feature-top';

    var eyebrow = document.createElement('span');
    eyebrow.className = 'svc-dd-eyebrow';
    eyebrow.textContent = eyebrowLabel;
    fTop.appendChild(eyebrow);

    var titleWrap = document.createElement('div');
    titleWrap.className = 'svc-dd-title-wrap';
    items.forEach(function(it, i){
      var h = document.createElement('h3');
      h.className = 'svc-dd-title';
      h.setAttribute('data-idx', String(i));
      h.textContent = it.title;
      if (i === 0) h.setAttribute('data-active', 'true');
      titleWrap.appendChild(h);
    });
    fTop.appendChild(titleWrap);

    var rule = document.createElement('div');
    rule.className = 'svc-dd-rule';
    fTop.appendChild(rule);

    var tagWrap = document.createElement('div');
    tagWrap.className = 'svc-dd-tagline-wrap';
    items.forEach(function(it, i){
      var p = document.createElement('p');
      p.className = 'svc-dd-tagline';
      p.setAttribute('data-idx', String(i));
      p.textContent = it.tagline;
      if (i === 0) p.setAttribute('data-active', 'true');
      tagWrap.appendChild(p);
    });
    fTop.appendChild(tagWrap);

    feature.appendChild(fTop);

    var fBot = document.createElement('div');
    fBot.className = 'svc-dd-feature-bot';

    var counter = document.createElement('div');
    counter.className = 'svc-dd-counter';
    counter.innerHTML = ''
      + '<span aria-hidden="true">' + indexLabel + '</span>'
      + '<span class="svc-dd-counter-num" data-counter>01</span>'
      + '<span class="svc-dd-counter-sep" aria-hidden="true"></span>'
      + '<span class="svc-dd-counter-total">' + totalLabel + '</span>';
    fBot.appendChild(counter);

    var cta = document.createElement('a');
    cta.className = 'svc-dd-cta';
    cta.href = items[0].href;
    cta.setAttribute('data-cta', '');
    cta.innerHTML = '<span data-cta-label>' + ctaLabel + '</span>' + '<span aria-hidden="true">' + arrow + '</span>';
    fBot.appendChild(cta);

    feature.appendChild(fBot);

    // ---- RIGHT: list ----
    var list = document.createElement('div');
    list.className = 'svc-dd-list';

    items.forEach(function(it, i){
      var a = document.createElement('a');
      a.className = 'svc-dd-item';
      a.href = it.href;
      a.setAttribute('role', 'menuitem');
      a.setAttribute('data-idx', String(i));
      if (i === 0) a.setAttribute('data-active', 'true');
      a.innerHTML = ''
        + '<span class="svc-dd-num" aria-hidden="true">' + it.num + '</span>'
        + '<span class="svc-dd-label">' + it.label + '</span>';
      list.appendChild(a);
    });

    grid.appendChild(feature);
    grid.appendChild(list);
    menu.appendChild(grid);
    wrap.appendChild(menu);

    var titles  = titleWrap.querySelectorAll('.svc-dd-title');
    var tags    = tagWrap.querySelectorAll('.svc-dd-tagline');
    var rows    = list.querySelectorAll('.svc-dd-item');
    var counterNum = counter.querySelector('[data-counter]');
    var currentIdx = 0;

    function paintRule(idx){
      var dark = document.documentElement.classList.contains('dark');
      var trackColor = dark ? 'rgba(249,248,247,0.08)' : 'rgba(14,22,32,0.10)';
      var pct = 0.18 + (idx / Math.max(1, items.length - 1)) * 0.82;
      rule.style.background = 'linear-gradient(to right, #c4a35a 0%, #c4a35a ' + (pct * 100).toFixed(1) + '%, ' + trackColor + ' ' + (pct * 100).toFixed(1) + '%, ' + trackColor + ' 100%)';
    }

    function setActive(idx){
      if (idx === currentIdx) return;
      currentIdx = idx;
      titles.forEach(function(t, i){ t.toggleAttribute('data-active', i === idx); });
      tags.forEach(function(t, i){ t.toggleAttribute('data-active', i === idx); });
      rows.forEach(function(r, i){ r.toggleAttribute('data-active', i === idx); });
      if (counterNum) counterNum.textContent = items[idx].num;
      cta.setAttribute('href', items[idx].href);
      paintRule(idx);
    }

    paintRule(0);

    rows.forEach(function(r, i){
      r.addEventListener('mouseenter', function(){ setActive(i); list.setAttribute('data-hovering', 'true'); });
      r.addEventListener('focus', function(){ setActive(i); list.setAttribute('data-hovering', 'true'); });
    });
    list.addEventListener('mouseleave', function(){ list.removeAttribute('data-hovering'); });

    if (window.MutationObserver) {
      var mo = new MutationObserver(function(){ paintRule(currentIdx); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

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
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        var focusables = Array.prototype.slice.call(rows);
        var active = document.activeElement;
        var idx = focusables.indexOf(active);
        if (idx === -1) idx = currentIdx;
        var next = ev.key === 'ArrowDown' ? (idx + 1) % focusables.length : (idx - 1 + focusables.length) % focusables.length;
        focusables[next].focus();
        ev.preventDefault();
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
