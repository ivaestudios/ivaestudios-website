/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Admin Focal Point Editor v3
   ───────────────────────────────────────────────────────────────
   Login at /admin → sets sessionStorage → redirects to /
   focal-admin.js detects session and shows editing tools.
   Works on desktop AND mobile.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ivae_focal_points';
  var PASS_KEY = 'ivae_admin_auth';
  var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function getImageKey(img) {
    return (img.getAttribute('src') || '').replace(/^.*\//, '').split('?')[0];
  }
  function getSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveFP(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ── Apply saved focal points (always, admin or not) ── */
  function applyAll() {
    var data = getSaved();
    document.querySelectorAll('img[src]').forEach(function(img) {
      var val = data[getImageKey(img)];
      if (val) img.style.objectPosition = val;
    });
  }
  window.addEventListener('load', applyAll);
  if (document.readyState !== 'loading') applyAll();

  /* ── Only activate admin if logged in ── */
  if (sessionStorage.getItem(PASS_KEY) !== 'true') return;

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }
  boot();

  function run() {
    /* ═══ CSS ═══ */
    var css = document.createElement('style');
    css.textContent =
      /* Admin bar */
      '.ivae-ab{position:fixed;top:0;left:0;right:0;z-index:100000;background:rgba(14,22,32,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:48px;border-bottom:1px solid rgba(196,163,90,.3);font-family:Syne,sans-serif}' +
      '.ivae-ab span{font-size:10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#c4a35a}' +
      '.ivae-ab .al{color:rgba(249,248,247,.5);margin-right:6px}' +
      '.ivae-ab-btns{display:flex;gap:8px}' +
      '.ivae-ab-btns button{font-family:Syne,sans-serif;font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(196,163,90,.4);background:0 0;color:#c4a35a;padding:6px 12px;cursor:pointer;transition:background .2s}' +
      '.ivae-ab-btns button:hover{background:rgba(196,163,90,.15)}' +
      '.ivae-ab-btns .dng{color:#e57373;border-color:rgba(229,115,115,.4)}' +
      /* push page down */
      'body.ivae-on .site-header{top:48px}' +
      'body.ivae-on .scroll-progress{top:48px}' +
      /* click-through overlays */
      'body.ivae-on .hero-overlay,body.ivae-on .hero-content,body.ivae-on .hero-bottom,body.ivae-on .dest-info,body.ivae-on .dest-go,body.ivae-on .pg-label,body.ivae-on .svc-text,body.ivae-on .post-hero-overlay,body.ivae-on .post-hero-text{pointer-events:none}' +
      'body.ivae-on .hero-content a,body.ivae-on .hero-bottom a{pointer-events:none}' +

      /* ── EDIT BUTTON on each image ── */
      '.ivae-img-wrap{position:relative}' +
      '.ivae-edit-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:90;background:rgba(14,22,32,.88);border:2px solid #c4a35a;color:#c4a35a;font-family:Syne,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:14px 28px;cursor:pointer;white-space:nowrap;transition:opacity .25s,background .2s;-webkit-tap-highlight-color:transparent}' +
      /* Desktop: show on hover */
      (isMobile ? '' :
        '.ivae-edit-btn{opacity:0;pointer-events:none}' +
        '.ivae-img-wrap:hover .ivae-edit-btn{opacity:1;pointer-events:auto}'
      ) +
      /* Mobile: always visible */
      (isMobile ?
        '.ivae-edit-btn{opacity:1;pointer-events:auto;font-size:10px;padding:10px 18px}'
      : '') +
      '.ivae-edit-btn:active{background:rgba(196,163,90,.25)}' +

      /* badge */
      '.ivae-badge{position:absolute;top:8px;left:8px;z-index:50;background:rgba(196,163,90,.9);color:#0e1620;font-size:8px;font-weight:700;letter-spacing:.08em;padding:3px 7px;pointer-events:none;text-transform:uppercase;font-family:Syne,sans-serif}' +

      /* ── MODAL ── */
      '.ivae-modal{position:fixed;inset:0;z-index:200000;background:rgba(14,22,32,.97);display:none;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.ivae-modal.open{display:block}' +
      '.ivae-mi{max-width:960px;margin:0 auto;padding:20px;min-height:100vh;display:flex;flex-direction:column;gap:16px}' +
      /* header */
      '.ivae-mh{display:flex;align-items:center;justify-content:space-between;flex-shrink:0}' +
      '.ivae-mh h3{font-family:"Cormorant Garamond",serif;font-size:20px;font-weight:300;color:#f9f8f7;margin:0}' +
      '.ivae-mh .fn{font-size:9px;color:rgba(249,248,247,.4);letter-spacing:.08em;display:block;margin-top:4px}' +
      '.ivae-cls{background:0 0;border:0;color:rgba(249,248,247,.5);font-size:32px;cursor:pointer;padding:4px 12px;-webkit-tap-highlight-color:transparent}' +
      /* editor grid */
      '.ivae-ed{display:flex;flex-direction:column;gap:16px}' +
      '@media(min-width:769px){.ivae-ed{display:grid;grid-template-columns:1fr 280px;gap:20px}}' +
      /* canvas */
      '.ivae-cv{position:relative;overflow:hidden;cursor:crosshair;background:#111;display:flex;align-items:center;justify-content:center;touch-action:none}' +
      '.ivae-cv img{max-width:100%;display:block;user-select:none;-webkit-user-select:none;pointer-events:none}' +
      '@media(min-width:769px){.ivae-cv img{max-height:60vh}}' +
      '.ivae-ch{position:absolute;width:40px;height:40px;transform:translate(-50%,-50%);pointer-events:none;z-index:10}' +
      '.ivae-ch::before,.ivae-ch::after{content:"";position:absolute;background:#c4a35a}' +
      '.ivae-ch::before{width:2px;height:100%;left:50%;transform:translateX(-50%)}' +
      '.ivae-ch::after{width:100%;height:2px;top:50%;transform:translateY(-50%)}' +
      '.ivae-ring{position:absolute;inset:-6px;border:2px solid rgba(196,163,90,.6);border-radius:50%}' +
      '.ivae-gh,.ivae-gv{position:absolute;pointer-events:none;z-index:5}' +
      '.ivae-gh{left:0;right:0;height:1px;background:rgba(196,163,90,.25)}' +
      '.ivae-gv{top:0;bottom:0;width:1px;background:rgba(196,163,90,.25)}' +
      /* sidebar */
      '.ivae-sb{display:flex;flex-direction:column;gap:12px}' +
      '.ivae-pw{position:relative;overflow:hidden;background:#111;aspect-ratio:16/9}' +
      '.ivae-pw img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.ivae-pl{position:absolute;bottom:0;left:0;right:0;background:rgba(14,22,32,.8);padding:5px 8px;font-size:8px;color:rgba(249,248,247,.5);letter-spacing:.1em;text-transform:uppercase;font-family:Syne,sans-serif;text-align:center}' +
      '.ivae-co{display:flex;gap:10px}' +
      '.ivae-fl{flex:1;display:flex;flex-direction:column;gap:4px}' +
      '.ivae-fl label{font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(249,248,247,.4);font-family:Syne,sans-serif}' +
      '.ivae-fl input{background:rgba(249,248,247,.06);border:1px solid rgba(196,163,90,.25);color:#f9f8f7;padding:10px;font-size:16px;font-family:Syne,sans-serif;text-align:center;outline:0;-webkit-appearance:none;border-radius:0}' +
      '.ivae-fl input:focus{border-color:#c4a35a}' +
      '.ivae-rt{display:flex;gap:6px;flex-wrap:wrap}' +
      '.ivae-rb{font-family:Syne,sans-serif;font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(196,163,90,.25);background:0 0;color:rgba(249,248,247,.5);padding:6px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.ivae-rb.on{background:rgba(196,163,90,.2);border-color:#c4a35a;color:#c4a35a}' +
      /* action buttons - big and clear */
      '.ivae-ac{display:flex;gap:8px;padding:8px 0}' +
      '.ivae-ac button{flex:1;font-family:Syne,sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:16px;cursor:pointer;border:none;-webkit-tap-highlight-color:transparent}' +
      '.ivae-sv{background:#c4a35a;color:#0e1620}' +
      '.ivae-sv:active{background:#d4b36a}' +
      '.ivae-rs{background:rgba(249,248,247,.08);color:rgba(249,248,247,.5);border:1px solid rgba(249,248,247,.15)!important}' +
      /* toast */
      '.ivae-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:400000;background:#c4a35a;color:#0e1620;font-family:Syne,sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 28px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;text-align:center;max-width:90vw}' +
      '.ivae-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    document.head.appendChild(css);

    /* ═══ ADMIN BAR ═══ */
    document.body.classList.add('ivae-on');
    var bar = document.createElement('div');
    bar.className = 'ivae-ab';
    bar.innerHTML = '<div><span class="al">Admin</span><span>Editor</span></div>' +
      '<div class="ivae-ab-btns">' +
      '<button id="ivaeRst" class="dng">Reset</button>' +
      '<button id="ivaeExit">Salir</button>' +
      '</div>';
    document.body.prepend(bar);

    /* ═══ TOAST ═══ */
    var toast = document.createElement('div');
    toast.className = 'ivae-toast';
    document.body.appendChild(toast);
    function showToast(m) {
      toast.textContent = m;
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 2500);
    }

    /* ═══ ADD EDIT BUTTONS TO ALL IMAGES ═══ */
    function addEditButtons() {
      document.querySelectorAll('.ivae-edit-btn').forEach(function(b) { b.remove(); });
      document.querySelectorAll('.ivae-badge').forEach(function(b) { b.remove(); });
      var data = getSaved();
      var imgs = document.querySelectorAll('img[src]');
      imgs.forEach(function(img) {
        if (img.closest('.ivae-ab,.ivae-modal,.ivae-toast')) return;
        if (img.id === 'lightboxImg') return;
        if (img.naturalWidth < 50 || img.naturalHeight < 50) return;

        var parent = img.parentElement;
        if (!parent) return;
        var pos = getComputedStyle(parent).position;
        if (pos === 'static') parent.style.position = 'relative';
        parent.classList.add('ivae-img-wrap');

        var btn = document.createElement('button');
        btn.className = 'ivae-edit-btn';
        btn.textContent = 'EDITAR';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          openEditor(img);
        });
        parent.appendChild(btn);

        var key = getImageKey(img);
        if (data[key]) {
          var badge = document.createElement('div');
          badge.className = 'ivae-badge';
          badge.textContent = data[key];
          parent.appendChild(badge);
        }
      });
    }
    setTimeout(addEditButtons, 1000);
    window.addEventListener('load', function() { setTimeout(addEditButtons, 500); });

    /* ═══ MODAL ═══ */
    var modal = document.createElement('div');
    modal.className = 'ivae-modal';
    modal.innerHTML =
      '<div class="ivae-mi">' +
        '<div class="ivae-mh">' +
          '<div><h3>Punto de interes</h3><span class="fn" id="fpFn"></span></div>' +
          '<button class="ivae-cls" id="fpCls">&times;</button>' +
        '</div>' +
        '<div class="ivae-ed">' +
          '<div class="ivae-cv" id="fpCv">' +
            '<img id="fpImg" src="" alt=""/>' +
            '<div class="ivae-ch" id="fpCh"><div class="ivae-ring"></div></div>' +
            '<div class="ivae-gh" id="fpGh"></div>' +
            '<div class="ivae-gv" id="fpGv"></div>' +
          '</div>' +
          '<div class="ivae-sb">' +
            '<div>' +
              '<div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(249,248,247,.4);font-family:Syne,sans-serif;margin-bottom:6px">Vista previa</div>' +
              '<div class="ivae-rt" id="fpRt">' +
                '<button class="ivae-rb on" data-r="16/9">16:9</button>' +
                '<button class="ivae-rb" data-r="4/5">4:5</button>' +
                '<button class="ivae-rb" data-r="1/1">1:1</button>' +
                '<button class="ivae-rb" data-r="4/3">4:3</button>' +
              '</div>' +
            '</div>' +
            '<div class="ivae-pw" id="fpPw">' +
              '<img id="fpPi" src="" alt=""/>' +
              '<div class="ivae-pl">Preview</div>' +
            '</div>' +
            '<div class="ivae-co">' +
              '<div class="ivae-fl"><label>X %</label><input type="number" id="fpXi" min="0" max="100" value="50" inputmode="numeric"/></div>' +
              '<div class="ivae-fl"><label>Y %</label><input type="number" id="fpYi" min="0" max="100" value="50" inputmode="numeric"/></div>' +
            '</div>' +
            '<div class="ivae-ac">' +
              '<button class="ivae-sv" id="fpSv">GUARDAR</button>' +
              '<button class="ivae-rs" id="fpRs">RESET</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    /* ═══ EDITOR LOGIC ═══ */
    var curImg = null, curKey = '', fx = 50, fy = 50;
    var eCv = document.getElementById('fpCv');
    var eImg = document.getElementById('fpImg');
    var eCh = document.getElementById('fpCh');
    var eGh = document.getElementById('fpGh');
    var eGv = document.getElementById('fpGv');
    var ePi = document.getElementById('fpPi');
    var ePw = document.getElementById('fpPw');
    var eXi = document.getElementById('fpXi');
    var eYi = document.getElementById('fpYi');
    var eFn = document.getElementById('fpFn');

    function updUI() {
      var ir = eImg.getBoundingClientRect();
      var cr = eCv.getBoundingClientRect();
      var ox = ir.left - cr.left, oy = ir.top - cr.top;
      eCh.style.left = (ox + ir.width * fx / 100) + 'px';
      eCh.style.top = (oy + ir.height * fy / 100) + 'px';
      eGh.style.top = (oy + ir.height * fy / 100) + 'px';
      eGv.style.left = (ox + ir.width * fx / 100) + 'px';
      ePi.style.objectPosition = fx + '% ' + fy + '%';
      eXi.value = Math.round(fx);
      eYi.value = Math.round(fy);
    }

    function openEditor(img) {
      curImg = img;
      curKey = getImageKey(img);
      eFn.textContent = curKey;
      var src = img.getAttribute('src') || '';
      eImg.src = src;
      ePi.src = src;
      var data = getSaved();
      if (data[curKey]) {
        var p = data[curKey].split(/\s+/);
        fx = parseFloat(p[0]) || 50;
        fy = parseFloat(p[1]) || 50;
      } else {
        fx = 50; fy = 50;
      }
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Scroll modal to top
      modal.scrollTop = 0;
      if (eImg.complete && eImg.naturalWidth) setTimeout(updUI, 50);
      else eImg.onload = function() { setTimeout(updUI, 50); };
    }

    function closeEditor() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      curImg = null;
    }

    function setFP(e) {
      var r = eImg.getBoundingClientRect();
      fx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      fy = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      updUI();
    }

    /* Mouse events */
    var drag = false;
    eCv.addEventListener('mousedown', function(e) { e.preventDefault(); drag = true; setFP(e); });
    document.addEventListener('mousemove', function(e) { if (drag) setFP(e); });
    document.addEventListener('mouseup', function() { drag = false; });

    /* Touch events - with proper mobile handling */
    eCv.addEventListener('touchstart', function(e) {
      e.preventDefault();
      drag = true;
      setFP(e.touches[0]);
    }, {passive: false});
    eCv.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (drag) setFP(e.touches[0]);
    }, {passive: false});
    document.addEventListener('touchend', function() { drag = false; });

    eXi.addEventListener('input', function() { fx = Math.max(0, Math.min(100, +this.value || 50)); updUI(); });
    eYi.addEventListener('input', function() { fy = Math.max(0, Math.min(100, +this.value || 50)); updUI(); });

    document.getElementById('fpRt').addEventListener('click', function(e) {
      var b = e.target.closest('.ivae-rb'); if (!b) return;
      document.querySelectorAll('.ivae-rb').forEach(function(x) { x.classList.remove('on'); });
      b.classList.add('on');
      ePw.style.aspectRatio = b.dataset.r;
    });

    /* ═══ GUARDAR ═══ */
    document.getElementById('fpSv').addEventListener('click', function() {
      if (!curKey) return;
      var data = getSaved();
      var val = Math.round(fx) + '% ' + Math.round(fy) + '%';
      data[curKey] = val;
      saveFP(data);
      // Apply to all instances on page
      document.querySelectorAll('img[src]').forEach(function(i) {
        if (getImageKey(i) === curKey) i.style.objectPosition = val;
      });
      showToast('Guardado');
      addEditButtons();
      closeEditor();
    });

    /* Reset single */
    document.getElementById('fpRs').addEventListener('click', function() {
      if (!curKey) return;
      var data = getSaved();
      delete data[curKey];
      saveFP(data);
      document.querySelectorAll('img[src]').forEach(function(i) {
        if (getImageKey(i) === curKey) i.style.objectPosition = '';
      });
      fx = 50; fy = 50; updUI();
      showToast('Punto focal reseteado');
      addEditButtons();
    });

    /* Close */
    document.getElementById('fpCls').addEventListener('click', closeEditor);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeEditor();
    });

    /* Reset all */
    document.getElementById('ivaeRst').addEventListener('click', function() {
      if (!confirm('Eliminar TODOS los puntos focales guardados?')) return;
      localStorage.removeItem(STORAGE_KEY);
      document.querySelectorAll('img[src]').forEach(function(i) { i.style.objectPosition = ''; });
      addEditButtons();
      showToast('Todos los puntos focales eliminados');
    });

    /* Exit */
    document.getElementById('ivaeExit').addEventListener('click', function() {
      sessionStorage.removeItem(PASS_KEY);
      location.href = '/';
    });

  } // end run
})();
