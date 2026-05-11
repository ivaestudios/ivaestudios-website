/* ============================================================
   IVAE Studios — Mobile editorial animations controller
   Vanilla JS · IIFE · respects prefers-reduced-motion
   Pairs with: styles/lw-mobile-anim.css
   ============================================================ */
(function () {
  'use strict';

  var mqMobile = window.matchMedia('(max-width: 900px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mqMobile.matches) return;
  var REDUCED = mqReduce.matches;

  var doc = document;
  var body = doc.body;

  /* ---------- helper: split hero h1 into letters -------------- */
  function splitHeadline(h1) {
    if (!h1 || h1.dataset.split === '1') return;
    var text = h1.textContent.trim();
    h1.textContent = '';
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      var span = doc.createElement('span');
      span.className = 'ch' + (c === ' ' ? ' space' : '');
      span.textContent = c === ' ' ? ' ' : c;
      span.style.transitionDelay = (i * 0.045) + 's';
      frag.appendChild(span);
    }
    h1.appendChild(frag);
    h1.dataset.split = '1';
  }

  /* ---------- IntersectionObserver for reveals ---------------- */
  function setupReveals() {
    if (!('IntersectionObserver' in window)) {
      doc.querySelectorAll('[data-anim], .section-title, .pull-quote').forEach(function (el) { el.classList.add('is-inview'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-inview');
        if (el.matches('h1[data-anim="blur-bloom"], .hero-title')) {
          el.querySelectorAll('.ch').forEach(function (ch) { ch.classList.add('is-in'); });
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.18 });

    doc.querySelectorAll('h2[data-anim="gold-thread"], .section-title, blockquote[data-anim="clip-reveal"], .pull-quote, .gold-thread-svg, h1[data-anim="blur-bloom"], .hero-title').forEach(function (el) {
      if (el.matches('h1[data-anim="blur-bloom"], .hero-title')) splitHeadline(el);
      io.observe(el);
    });
  }

  /* ---------- Chapter counter -------------------------------- */
  function setupChapterCounter() {
    var chapters = doc.querySelectorAll('[data-chapter]');
    if (!chapters.length) return;
    var total = chapters.length;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

    var counter = doc.createElement('div');
    counter.className = 'ivae-chapter-counter';
    counter.innerHTML = '<span class="current">01</span><span class="sep">/</span><span class="total">' + pad(total) + '</span>';
    body.appendChild(counter);
    var curEl = counter.querySelector('.current');
    var lastIdx = -1;

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var idx = parseInt(e.target.getAttribute('data-chapter'), 10);
        if (isNaN(idx) || idx === lastIdx) return;
        lastIdx = idx;
        counter.classList.add('is-visible', 'is-swap');
        setTimeout(function () {
          curEl.textContent = pad(idx);
          counter.classList.remove('is-swap');
        }, 220);
        var theme = e.target.getAttribute('data-theme-color');
        if (theme) setThemeColor(theme);
      });
    }, { threshold: 0.55 });
    chapters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- Theme-color meta swap --------------------------- */
  var themeMeta;
  function setThemeColor(color) {
    if (!themeMeta) {
      themeMeta = doc.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = doc.createElement('meta');
        themeMeta.setAttribute('name', 'theme-color');
        doc.head.appendChild(themeMeta);
      }
    }
    themeMeta.setAttribute('content', color);
  }

  /* ---------- Body of Work swipe plates ----------------------- */
  function setupSwipe() {
    var track = doc.querySelector('.body-of-work[data-swipe]');
    if (!track) return;
    var startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, locked = false;
    var slideW = track.clientWidth;
    var index = 0;
    var max = (track.children.length || 1) - 1;

    function setX(x) { track.style.transform = 'translate3d(' + x + 'px,0,0)'; }
    function snap() {
      track.classList.remove('is-dragging');
      if (Math.abs(dx) > slideW * 0.18) index += dx < 0 ? 1 : -1;
      index = Math.max(0, Math.min(max, index));
      setX(-index * slideW);
    }

    track.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      startX = t.clientX; startY = t.clientY; dx = 0; dy = 0;
      dragging = true; locked = false;
      slideW = track.clientWidth;
      track.classList.add('is-dragging');
    }, { passive: true });

    track.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.changedTouches[0];
      dx = t.clientX - startX; dy = t.clientY - startY;
      if (!locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked = Math.abs(dx) > Math.abs(dy);
        if (!locked) { dragging = false; track.classList.remove('is-dragging'); return; }
      }
      setX(-index * slideW + dx);
    }, { passive: true });

    track.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      snap();
    });
  }

  /* ---------- Pull-to-reveal hint on hero --------------------- */
  function setupPullHint() {
    var hero = doc.querySelector('.lw-hero, .hero, [data-hero]');
    if (!hero) return;
    var hint = doc.createElement('div');
    hint.className = 'ivae-pull-hint';
    hint.textContent = 'SCROLL TO ENTER';
    hero.style.position = hero.style.position || 'relative';
    hero.appendChild(hint);

    var startY = 0, pulled = false;
    hero.addEventListener('touchstart', function (e) {
      if (window.scrollY > 4) return;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });
    hero.addEventListener('touchmove', function (e) {
      if (pulled || window.scrollY > 4) return;
      var dy = e.changedTouches[0].clientY - startY;
      if (dy > 18) { hint.classList.add('is-shown'); pulled = true; setTimeout(function () { hint.classList.remove('is-shown'); }, 1800); }
    }, { passive: true });

    setTimeout(function () { if (!pulled) hint.classList.add('is-shown'); }, 2400);
    setTimeout(function () { hint.classList.remove('is-shown'); }, 5200);
  }

  /* ---------- Boot -------------------------------------------- */
  function init() {
    if (REDUCED) {
      doc.querySelectorAll('[data-anim], .section-title, .pull-quote, .hero-title').forEach(function (el) { el.classList.add('is-inview'); });
      setupChapterCounter();
      return;
    }
    setupReveals();
    setupChapterCounter();
    setupSwipe();
    setupPullHint();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
