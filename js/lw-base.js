/* ═══════════════════════════════════════════════════════════════
   lw-base.js — Shared hero + pillars behavior for IVAE Studios
   service pages (luxury-weddings, couples-photography,
   luxury-family-photos, plus any future service page).

   Source of truth: luxury-weddings.html (the page where the
   cinematic hero + pillars currently behave correctly).

   Each module is guarded by an existence check so the file safely
   no-ops on pages that don't include a given hook. Every animation
   respects `prefers-reduced-motion: reduce`.

   Modules included:
     1. `js-on` toggle on <html>
     2. Reveal IntersectionObserver  (guarded against lw-editorial.js)
     3. Letter cascade splitter      (#lw-h1 or .lw-cascade)
     4. Word-by-word splitter        ([data-words])
     5. Motes spawner                (#lwMotes)
     6. Hero 3D parallax             (.lw-hero + #lwHeroImg)
     7. Magnet CTA                   ([data-magnet])
     8. SVG ring stroke-draw         (#lwRing)
     9. Stats count-up               ([data-count-to])
    10. Next-Saturday date filler    (#lwNextDate, #lwNextDate2)
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* 1. js-on toggle on <html> */
  document.documentElement.classList.add('js-on');

  /* helpers */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function(s, sc){ return (sc || document).querySelector(s); };
  var $$ = function(s, sc){ return Array.prototype.slice.call((sc || document).querySelectorAll(s)); };

  /* 2. Reveal IntersectionObserver
        Skip if lw-editorial.js is already running it — guard via
        `lw-editorial-active` class on <html> (set by that file). */
  (function reveal(){
    if(document.documentElement.classList.contains('lw-editorial-active')) return;
    var targets = $$('.lw-rv');
    if(!targets.length) return;
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){
            e.target.classList.add('vis');
            io.unobserve(e.target);
          }
        });
      }, {rootMargin:'0px 0px -8% 0px', threshold:0.12});
      targets.forEach(function(el){ io.observe(el); });
    }else{
      targets.forEach(function(el){ el.classList.add('vis'); });
    }
  })();

  /* 3. Letter-cascade h1 (split text into spans, animate in) */
  (function letterCascade(){
    var h1 = document.getElementById('lw-h1') || document.querySelector('.lw-cascade');
    if(!h1) return;
    if(reduceMotion) return;
    // Walk child nodes, wrapping each visible character in a span,
    // preserving <br> and <em> elements.
    function wrap(node){
      var children = Array.prototype.slice.call(node.childNodes);
      var i = 0;
      children.forEach(function(c){
        if(c.nodeType === 3){
          var text = c.textContent;
          if(!text) return;
          var frag = document.createDocumentFragment();
          // Split by word so we can keep wrapping intact
          var words = text.split(/(\s+)/);
          words.forEach(function(w){
            if(/^\s+$/.test(w)){ frag.appendChild(document.createTextNode(w)); return; }
            if(!w) return;
            var wordSpan = document.createElement('span');
            wordSpan.className = 'lw-h1-word';
            for(var k=0;k<w.length;k++){
              var ch = document.createElement('span');
              ch.className = 'lw-h1-letter';
              ch.style.transitionDelay = (i*0.035) + 's';
              ch.textContent = w[k];
              wordSpan.appendChild(ch);
              i++;
            }
            frag.appendChild(wordSpan);
          });
          c.parentNode.replaceChild(frag, c);
        } else if(c.nodeType === 1 && c.tagName !== 'BR'){
          wrap(c);
        }
      });
    }
    wrap(h1);
  })();

  /* 4. Word-by-word reveal on h2/h3 with [data-words] */
  (function wordsReveal(){
    if(reduceMotion) return;
    var els = $$('[data-words]');
    if(!els.length) return;
    els.forEach(function(el){
      // Wrap each text run's words in spans, leaving <em> tags intact (their words still get wrapped).
      var idx = 0;
      function walk(node){
        var children = Array.prototype.slice.call(node.childNodes);
        children.forEach(function(c){
          if(c.nodeType === 3){
            var text = c.textContent;
            if(!text.trim()){ return; }
            var frag = document.createDocumentFragment();
            text.split(/(\s+)/).forEach(function(w){
              if(/^\s+$/.test(w)){ frag.appendChild(document.createTextNode(w)); return; }
              if(!w) return;
              var s = document.createElement('span');
              s.className = 'lw-w-word';
              s.style.transitionDelay = (idx*0.06) + 's';
              s.textContent = w;
              frag.appendChild(s);
              idx++;
            });
            c.parentNode.replaceChild(frag, c);
          } else if(c.nodeType === 1){
            walk(c);
          }
        });
      }
      walk(el);
    });
  })();

  /* 5. Floating gold motes */
  (function motes(){
    var host = document.getElementById('lwMotes');
    if(!host || reduceMotion) return;
    var n = 8;
    for(var i=0;i<n;i++){
      var m = document.createElement('span');
      m.className = 'lw-mote';
      m.style.left = (Math.random()*100) + '%';
      m.style.top = (Math.random()*100) + '%';
      m.style.animationDelay = (-Math.random()*26) + 's';
      m.style.animationDuration = (18 + Math.random()*16) + 's';
      var size = 2 + Math.random()*3;
      m.style.width = size + 'px';
      m.style.height = size + 'px';
      host.appendChild(m);
    }
  })();

  /* 6. 3D mouse parallax on hero image (max 6deg rotation) */
  (function heroParallax(){
    if(reduceMotion) return;
    if(!window.matchMedia('(pointer:fine)').matches) return;
    var hero = document.querySelector('.lw-hero');
    var img  = document.getElementById('lwHeroImg');
    if(!hero || !img) return;
    var rect = null;
    var raf  = null;
    var rx = 0, ry = 0, tx = 0, ty = 0;
    var MAX_DEG = 6;
    function onMove(e){
      if(!rect) rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width  - 0.5;
      var y = (e.clientY - rect.top)  / rect.height - 0.5;
      ry = x * (MAX_DEG * 2);
      rx = y * -(MAX_DEG * 2);
      if(rx >  MAX_DEG) rx =  MAX_DEG; else if(rx < -MAX_DEG) rx = -MAX_DEG;
      if(ry >  MAX_DEG) ry =  MAX_DEG; else if(ry < -MAX_DEG) ry = -MAX_DEG;
      tx = x * -14; ty = y * -8;
      if(!raf) raf = requestAnimationFrame(apply);
    }
    function apply(){
      img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      raf = null;
    }
    function onLeave(){
      rx = 0; ry = 0; tx = 0; ty = 0;
      img.style.transform = '';
      rect = null;
    }
    function onResize(){ rect = null; }
    hero.addEventListener('mousemove', onMove, {passive:true});
    hero.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize, {passive:true});
  })();

  /* 7. Magnetic CTAs */
  (function magnet(){
    if(reduceMotion) return;
    if(!window.matchMedia('(pointer:fine)').matches) return;
    var btns = $$('[data-magnet]');
    if(!btns.length) return;
    btns.forEach(function(btn){
      var raf = null, tx = 0, ty = 0;
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        var cx = r.left + r.width/2, cy = r.top + r.height/2;
        tx = (e.clientX - cx) * 0.18;
        ty = (e.clientY - cy) * 0.18;
        if(Math.abs(tx) > 6) tx = tx > 0 ?  6 : -6;
        if(Math.abs(ty) > 6) ty = ty > 0 ?  6 : -6;
        if(!raf) raf = requestAnimationFrame(function(){
          btn.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
          raf = null;
        });
      });
      btn.addEventListener('mouseleave', function(){
        btn.style.transform = '';
      });
    });
  })();

  /* 8. SVG ring stroke-draw on view */
  (function ring(){
    var ring = document.getElementById('lwRing');
    if(!ring) return;
    if(reduceMotion){ ring.classList.add('lw-ring-on'); return; }
    setTimeout(function(){ ring.classList.add('lw-ring-on'); }, 600);
  })();

  /* 9. Stat count-up */
  (function countUp(){
    var stats = document.querySelectorAll('[data-count-to]');
    if(!stats.length) return;
    if(reduceMotion){
      stats.forEach(function(el){
        var n = parseInt(el.getAttribute('data-count-to'), 10);
        var s = el.getAttribute('data-count-suffix') || '';
        el.textContent = n + s;
      });
      return;
    }
    if(!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count-to'), 10);
        var suffix = el.getAttribute('data-count-suffix') || '';
        var dur = 1400, t0 = null, from = 0;
        function step(t){
          if(!t0) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          // ease-out cubic
          var e = 1 - Math.pow(1 - p, 3);
          var v = Math.round(from + (target - from) * e);
          el.textContent = v + suffix;
          if(p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, {threshold:0.45});
    stats.forEach(function(el){ obs.observe(el); });
  })();

  /* 10. Next-available Saturday (60 days from today) */
  (function nextDate(){
    var els = [document.getElementById('lwNextDate'), document.getElementById('lwNextDate2')];
    if(!els[0] && !els[1]) return;
    var d = new Date();
    d.setDate(d.getDate() + 60);
    // Find next Saturday
    while(d.getDay() !== 6) d.setDate(d.getDate() + 1);
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var txt = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    els.forEach(function(el){ if(el) el.textContent = txt; });
  })();

})();
