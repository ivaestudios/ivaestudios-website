/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Focal Point System v4
   ───────────────────────────────────────────────────────────────
   • Loads focal data from /api/focal (KV) for ALL visitors
   • Admin: /admin → login → sessionStorage → edit tools
   • Preview matches actual published crop
   • Mobile-optimized editor
   • GUARDAR saves permanently via API (KV)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORE = 'ivae_focal_points';
  var AUTH  = 'ivae_admin_auth';
  var API   = '/api/focal';
  var AKEY  = 'ivae2026';
  var mob   = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function ik(img) {
    return (img.getAttribute('src') || '').replace(/^.*\//, '').split('?')[0];
  }
  function gl() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }
  function sl(d) {
    try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {}
  }

  /* ── Apply focal points to every image ── */
  function apply(data) {
    if (!data || typeof data !== 'object') return;
    document.querySelectorAll('img[src]').forEach(function (img) {
      var v = data[ik(img)];
      if (v) img.style.objectPosition = v;
    });
  }

  /* ── Load: cache first, then API ── */
  function load() {
    apply(gl());
    fetch(API).then(function (r) {
      if (!r.ok) throw 0;
      return r.json();
    }).then(function (d) {
      sl(d);
      apply(d);
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else { load(); }
  window.addEventListener('load', function () { apply(gl()); });

  /* ── Stop if not admin ── */
  if (sessionStorage.getItem(AUTH) !== 'true') return;

  /* ═══════════════════════════════════════════
     ADMIN MODE
     ═══════════════════════════════════════════ */
  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAdmin);
    } else { initAdmin(); }
  }
  boot();

  function initAdmin() {
    var s = document.createElement('style');
    s.textContent =
      /* bar */
      '.fa-bar{position:fixed;top:0;left:0;right:0;z-index:100000;background:rgba(14,22,32,.96);' +
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;' +
      'justify-content:space-between;padding:0 16px;height:44px;border-bottom:1px solid rgba(196,163,90,.3);' +
      'font-family:Syne,sans-serif}' +
      '.fa-bar span{font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#c4a35a}' +
      '.fa-bar .fa-d{color:rgba(249,248,247,.45);margin-right:4px}' +
      '.fa-br{display:flex;gap:6px}' +
      '.fa-br button{font-family:Syne,sans-serif;font-size:8px;font-weight:600;letter-spacing:.12em;' +
      'text-transform:uppercase;border:1px solid rgba(196,163,90,.35);background:0 0;color:#c4a35a;' +
      'padding:5px 10px;cursor:pointer;transition:background .2s}' +
      '.fa-br button:hover{background:rgba(196,163,90,.12)}' +
      '.fa-br .fa-dng{color:#e57373;border-color:rgba(229,115,115,.35)}' +
      'body.fa-on .site-header{top:44px}body.fa-on .scroll-progress{top:44px}' +
      /* click-through overlays */
      'body.fa-on .hero-overlay,body.fa-on .hero-content,body.fa-on .hero-bottom,' +
      'body.fa-on .dest-info,body.fa-on .dest-go,body.fa-on .pg-label,' +
      'body.fa-on .svc-text,body.fa-on .post-hero-overlay,body.fa-on .post-hero-text{pointer-events:none}' +
      'body.fa-on .hero-content a,body.fa-on .hero-bottom a{pointer-events:none}' +
      /* edit button */
      '.fa-w{position:relative}' +
      '.fa-e{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:90;' +
      'background:rgba(14,22,32,.85);border:1.5px solid #c4a35a;color:#c4a35a;' +
      'font-family:Syne,sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;' +
      'text-transform:uppercase;padding:12px 24px;cursor:pointer;transition:opacity .2s,background .2s;' +
      '-webkit-tap-highlight-color:transparent;white-space:nowrap}' +
      (mob ? '.fa-e{opacity:1;pointer-events:auto;font-size:9px;padding:8px 14px}' :
        '.fa-e{opacity:0;pointer-events:none}.fa-w:hover .fa-e{opacity:1;pointer-events:auto}') +
      '.fa-e:active{background:rgba(196,163,90,.2)}' +
      /* badge */
      '.fa-bg{position:absolute;top:6px;left:6px;z-index:50;background:rgba(196,163,90,.85);color:#0e1620;' +
      'font-size:7px;font-weight:700;letter-spacing:.08em;padding:2px 6px;pointer-events:none;' +
      'text-transform:uppercase;font-family:Syne,sans-serif}' +

      /* ═══ MODAL ═══ */
      '.fa-m{position:fixed;inset:0;z-index:200000;background:rgba(10,16,24,.98);display:none;' +
      'flex-direction:column;overflow:hidden}' +
      '.fa-m.open{display:flex}' +
      '.fa-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;' +
      'border-bottom:1px solid rgba(196,163,90,.15);flex-shrink:0}' +
      '.fa-hd h3{font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:300;color:#f9f8f7;margin:0}' +
      '.fa-hd .fa-fn{font-size:8px;color:rgba(249,248,247,.3);letter-spacing:.08em;display:block;margin-top:2px;' +
      'max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.fa-x{background:0 0;border:0;color:rgba(249,248,247,.5);font-size:28px;cursor:pointer;padding:4px 10px;' +
      '-webkit-tap-highlight-color:transparent;line-height:1}' +
      /* body */
      '.fa-bd{flex:1;display:flex;flex-direction:column;padding:10px;gap:10px;overflow-y:auto;' +
      '-webkit-overflow-scrolling:touch}' +
      '@media(min-width:769px){.fa-bd{flex-direction:row;padding:16px 20px;gap:20px;overflow:hidden}}' +
      /* canvas */
      '.fa-cv{position:relative;overflow:hidden;cursor:crosshair;background:#080c12;flex-shrink:0;' +
      'display:flex;align-items:center;justify-content:center;touch-action:none;' +
      'border:1px solid rgba(196,163,90,.1)}' +
      '.fa-cv img{max-width:100%;display:block;user-select:none;-webkit-user-select:none;pointer-events:none}' +
      '@media(max-width:768px){.fa-cv{max-height:32vh}.fa-cv img{max-height:32vh;object-fit:contain}}' +
      '@media(min-width:769px){.fa-cv{flex:1;min-height:0}.fa-cv img{max-height:62vh}}' +
      /* crosshair */
      '.fa-ch{position:absolute;width:32px;height:32px;transform:translate(-50%,-50%);pointer-events:none;z-index:10}' +
      '.fa-ch::before,.fa-ch::after{content:"";position:absolute;background:#c4a35a}' +
      '.fa-ch::before{width:1.5px;height:100%;left:50%;transform:translateX(-50%)}' +
      '.fa-ch::after{width:100%;height:1.5px;top:50%;transform:translateY(-50%)}' +
      '.fa-rg{position:absolute;inset:-5px;border:1.5px solid rgba(196,163,90,.45);border-radius:50%}' +
      '.fa-gh,.fa-gv{position:absolute;pointer-events:none;z-index:5}' +
      '.fa-gh{left:0;right:0;height:1px;background:rgba(196,163,90,.15)}' +
      '.fa-gv{top:0;bottom:0;width:1px;background:rgba(196,163,90,.15)}' +
      /* sidebar */
      '.fa-sb{display:flex;flex-direction:column;gap:8px;flex-shrink:0}' +
      '@media(min-width:769px){.fa-sb{width:250px;overflow-y:auto}}' +
      /* preview */
      '.fa-pl{font-size:8px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;' +
      'color:rgba(249,248,247,.3);font-family:Syne,sans-serif;margin-bottom:3px}' +
      '.fa-pv{position:relative;overflow:hidden;background:#080c12;border:1px solid rgba(196,163,90,.1);width:100%}' +
      '.fa-pv img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.fa-pt{position:absolute;bottom:0;left:0;right:0;background:rgba(10,16,24,.7);padding:3px 8px;' +
      'font-size:7px;color:rgba(249,248,247,.35);letter-spacing:.1em;text-transform:uppercase;' +
      'font-family:Syne,sans-serif;text-align:center}' +
      /* ratios */
      '.fa-rt{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px}' +
      '.fa-rb{font-family:Syne,sans-serif;font-size:7px;font-weight:600;letter-spacing:.06em;' +
      'text-transform:uppercase;border:1px solid rgba(196,163,90,.18);background:0 0;' +
      'color:rgba(249,248,247,.35);padding:3px 7px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
      'transition:all .15s}' +
      '.fa-rb.on{background:rgba(196,163,90,.15);border-color:#c4a35a;color:#c4a35a}' +
      /* inputs */
      '.fa-co{display:flex;gap:8px}' +
      '.fa-fl{flex:1;display:flex;flex-direction:column;gap:3px}' +
      '.fa-fl label{font-size:8px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;' +
      'color:rgba(249,248,247,.3);font-family:Syne,sans-serif}' +
      '.fa-fl input{background:rgba(249,248,247,.05);border:1px solid rgba(196,163,90,.18);color:#f9f8f7;' +
      'padding:8px;font-size:15px;font-family:Syne,sans-serif;text-align:center;outline:0;' +
      '-webkit-appearance:none;border-radius:0;width:100%}' +
      '.fa-fl input:focus{border-color:#c4a35a}' +
      /* actions */
      '.fa-ac{display:flex;gap:6px;padding-top:6px}' +
      '@media(min-width:769px){.fa-ac{margin-top:auto}}' +
      '.fa-ac button{flex:1;font-family:Syne,sans-serif;font-weight:700;letter-spacing:.1em;' +
      'text-transform:uppercase;padding:14px;cursor:pointer;border:none;' +
      '-webkit-tap-highlight-color:transparent;transition:opacity .2s}' +
      '@media(max-width:768px){.fa-ac button{padding:16px;font-size:12px}}' +
      '@media(min-width:769px){.fa-ac button{font-size:11px}}' +
      '.fa-sv{background:#c4a35a;color:#0e1620}' +
      '.fa-sv:active{background:#d4b36a}' +
      '.fa-sv:disabled{opacity:.5;cursor:wait}' +
      '.fa-rs{background:rgba(249,248,247,.06);color:rgba(249,248,247,.4);' +
      'border:1px solid rgba(249,248,247,.08)!important}' +
      /* toast */
      '.fa-t{position:fixed;bottom:60px;left:50%;transform:translateX(-50%) translateY(14px);z-index:400000;' +
      'background:#c4a35a;color:#0e1620;font-family:Syne,sans-serif;font-size:11px;font-weight:700;' +
      'letter-spacing:.1em;text-transform:uppercase;padding:12px 24px;opacity:0;' +
      'transition:opacity .3s,transform .3s;pointer-events:none;text-align:center;max-width:88vw}' +
      '.fa-t.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.fa-t.err{background:#e57373;color:#fff}';
    document.head.appendChild(s);

    /* ═══ ADMIN BAR ═══ */
    document.body.classList.add('fa-on');
    var bar = document.createElement('div');
    bar.className = 'fa-bar';
    bar.innerHTML = '<div><span class="fa-d">Admin</span><span>Focal Editor</span></div>' +
      '<div class="fa-br">' +
      '<button id="faRst" class="fa-dng">Reset todo</button>' +
      '<button id="faOut">Salir</button></div>';
    document.body.prepend(bar);

    /* ═══ TOAST ═══ */
    var toast = document.createElement('div');
    toast.className = 'fa-t';
    document.body.appendChild(toast);
    function showToast(msg, isErr) {
      toast.textContent = msg;
      toast.className = 'fa-t show' + (isErr ? ' err' : '');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toast.className = 'fa-t'; }, 2800);
    }

    /* ═══ EDIT BUTTONS ═══ */
    function addButtons() {
      document.querySelectorAll('.fa-e,.fa-bg').forEach(function (b) { b.remove(); });
      var data = gl();
      document.querySelectorAll('img[src]').forEach(function (img) {
        if (img.closest('.fa-bar,.fa-m,.fa-t')) return;
        if (img.id === 'lightboxImg') return;
        if (img.naturalWidth < 50 || img.naturalHeight < 50) return;
        var p = img.parentElement;
        if (!p) return;
        if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
        p.classList.add('fa-w');

        var btn = document.createElement('button');
        btn.className = 'fa-e';
        btn.textContent = 'EDITAR';
        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          openEditor(img);
        });
        p.appendChild(btn);

        var key = ik(img);
        if (data[key]) {
          var badge = document.createElement('div');
          badge.className = 'fa-bg';
          badge.textContent = data[key];
          p.appendChild(badge);
        }
      });
    }
    setTimeout(addButtons, 800);
    window.addEventListener('load', function () { setTimeout(addButtons, 400); });

    /* ═══ MODAL ═══ */
    var modal = document.createElement('div');
    modal.className = 'fa-m';
    modal.innerHTML =
      '<div class="fa-hd">' +
        '<div><h3>Punto de inter\u00e9s</h3><span class="fa-fn" id="faFn"></span></div>' +
        '<button class="fa-x" id="faCls">\u00d7</button>' +
      '</div>' +
      '<div class="fa-bd">' +
        '<div class="fa-cv" id="faCv">' +
          '<img id="faImg"/>' +
          '<div class="fa-ch" id="faCh"><div class="fa-rg"></div></div>' +
          '<div class="fa-gh" id="faGh"></div>' +
          '<div class="fa-gv" id="faGv"></div>' +
        '</div>' +
        '<div class="fa-sb">' +
          '<div>' +
            '<div class="fa-pl">Vista previa (tal como se publica)</div>' +
            '<div class="fa-rt" id="faRt"></div>' +
          '</div>' +
          '<div class="fa-pv" id="faPv">' +
            '<img id="faPi"/>' +
            '<div class="fa-pt" id="faPt">Preview</div>' +
          '</div>' +
          '<div class="fa-co">' +
            '<div class="fa-fl"><label>X %</label><input type="number" id="faXi" min="0" max="100" value="50" inputmode="numeric"/></div>' +
            '<div class="fa-fl"><label>Y %</label><input type="number" id="faYi" min="0" max="100" value="50" inputmode="numeric"/></div>' +
          '</div>' +
          '<div class="fa-ac">' +
            '<button class="fa-sv" id="faSv">Guardar cambios</button>' +
            '<button class="fa-rs" id="faRs">Reset</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    /* ═══ EDITOR STATE ═══ */
    var cur = null, cKey = '', fx = 50, fy = 50;
    var $cv = document.getElementById('faCv');
    var $im = document.getElementById('faImg');
    var $ch = document.getElementById('faCh');
    var $gh = document.getElementById('faGh');
    var $gv = document.getElementById('faGv');
    var $pi = document.getElementById('faPi');
    var $pv = document.getElementById('faPv');
    var $xi = document.getElementById('faXi');
    var $yi = document.getElementById('faYi');
    var $fn = document.getElementById('faFn');
    var $rt = document.getElementById('faRt');
    var $pt = document.getElementById('faPt');
    var $sv = document.getElementById('faSv');

    function updUI() {
      var ir = $im.getBoundingClientRect();
      var cr = $cv.getBoundingClientRect();
      var ox = ir.left - cr.left, oy = ir.top - cr.top;
      $ch.style.left = (ox + ir.width * fx / 100) + 'px';
      $ch.style.top = (oy + ir.height * fy / 100) + 'px';
      $gh.style.top = (oy + ir.height * fy / 100) + 'px';
      $gv.style.left = (ox + ir.width * fx / 100) + 'px';
      $pi.style.objectPosition = fx + '% ' + fy + '%';
      $xi.value = Math.round(fx);
      $yi.value = Math.round(fy);
    }

    /* ── Detect container aspect ratio ── */
    function detectRatio(img) {
      var p = img.parentElement;
      if (!p) return { w: 16, h: 9, label: '16:9' };
      var w = p.offsetWidth, h = p.offsetHeight;
      if (w <= 0 || h <= 0) return { w: 16, h: 9, label: '16:9' };
      var r = w / h;
      var std = [
        { w: 16, h: 9, v: 16 / 9 }, { w: 4, h: 5, v: 0.8 },
        { w: 1, h: 1, v: 1 }, { w: 4, h: 3, v: 4 / 3 },
        { w: 3, h: 2, v: 1.5 }, { w: 2, h: 3, v: 2 / 3 },
        { w: 9, h: 16, v: 9 / 16 }, { w: 21, h: 9, v: 21 / 9 }
      ];
      var best = std[0], bd = Infinity;
      std.forEach(function (s) {
        var d = Math.abs(r - s.v);
        if (d < bd) { bd = d; best = s; }
      });
      if (bd < 0.15) return { w: best.w, h: best.h, label: best.w + ':' + best.h };
      return { w: w, h: h, label: Math.round(w) + ':' + Math.round(h) };
    }

    /* ── Build ratio buttons ── */
    function buildRatios(auto) {
      var presets = [
        { w: 16, h: 9, l: '16:9' }, { w: 4, h: 5, l: '4:5' },
        { w: 1, h: 1, l: '1:1' }, { w: 4, h: 3, l: '4:3' },
        { w: 3, h: 2, l: '3:2' }
      ];
      $rt.innerHTML = '';
      var ab = document.createElement('button');
      ab.className = 'fa-rb on';
      ab.textContent = 'Auto ' + auto.label;
      ab.dataset.w = auto.w;
      ab.dataset.h = auto.h;
      ab.addEventListener('click', function () { pickRatio(this); });
      $rt.appendChild(ab);
      presets.forEach(function (p) {
        var b = document.createElement('button');
        b.className = 'fa-rb';
        b.textContent = p.l;
        b.dataset.w = p.w;
        b.dataset.h = p.h;
        b.addEventListener('click', function () { pickRatio(this); });
        $rt.appendChild(b);
      });
      $pv.style.aspectRatio = auto.w + '/' + auto.h;
      $pt.textContent = auto.label;
    }

    function pickRatio(btn) {
      $rt.querySelectorAll('.fa-rb').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      $pv.style.aspectRatio = btn.dataset.w + '/' + btn.dataset.h;
      $pt.textContent = btn.textContent;
    }

    /* ═══ OPEN EDITOR ═══ */
    function openEditor(img) {
      cur = img;
      cKey = ik(img);
      $fn.textContent = cKey;
      var src = img.getAttribute('src') || '';
      $im.src = src;
      $pi.src = src;
      var data = gl();
      if (data[cKey]) {
        var parts = data[cKey].split(/\s+/);
        fx = parseFloat(parts[0]) || 50;
        fy = parseFloat(parts[1]) || 50;
      } else {
        fx = 50; fy = 50;
      }
      buildRatios(detectRatio(img));
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      modal.scrollTop = 0;
      $sv.disabled = false;
      $sv.textContent = 'Guardar cambios';
      if ($im.complete && $im.naturalWidth) setTimeout(updUI, 60);
      else $im.onload = function () { setTimeout(updUI, 60); };
    }

    function closeEditor() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      cur = null;
    }

    /* ── Pointer → focal point ── */
    function setFP(e) {
      var r = $im.getBoundingClientRect();
      fx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      fy = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      updUI();
    }

    var drag = false;
    $cv.addEventListener('mousedown', function (e) { e.preventDefault(); drag = true; setFP(e); });
    document.addEventListener('mousemove', function (e) { if (drag) setFP(e); });
    document.addEventListener('mouseup', function () { drag = false; });
    $cv.addEventListener('touchstart', function (e) {
      e.preventDefault(); drag = true; setFP(e.touches[0]);
    }, { passive: false });
    $cv.addEventListener('touchmove', function (e) {
      e.preventDefault(); if (drag) setFP(e.touches[0]);
    }, { passive: false });
    document.addEventListener('touchend', function () { drag = false; });

    $xi.addEventListener('input', function () {
      fx = Math.max(0, Math.min(100, +this.value || 50)); updUI();
    });
    $yi.addEventListener('input', function () {
      fy = Math.max(0, Math.min(100, +this.value || 50)); updUI();
    });

    /* ── Apply to page images ── */
    function applyOne(key, val) {
      document.querySelectorAll('img[src]').forEach(function (i) {
        if (ik(i) === key) i.style.objectPosition = val;
      });
    }

    /* ═══ SAVE — API + localStorage ═══ */
    $sv.addEventListener('click', function () {
      if (!cKey) return;
      var val = Math.round(fx) + '% ' + Math.round(fy) + '%';
      var data = gl();
      data[cKey] = val;
      $sv.disabled = true;
      $sv.textContent = 'Guardando...';

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': AKEY },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      }).then(function () {
        sl(data);
        applyOne(cKey, val);
        showToast('Cambios publicados');
        addButtons();
        closeEditor();
      }).catch(function () {
        sl(data);
        applyOne(cKey, val);
        showToast('Guardado local (configura KV para publicar)', true);
        addButtons();
        closeEditor();
      });
    });

    /* ── Reset single ── */
    document.getElementById('faRs').addEventListener('click', function () {
      if (!cKey) return;
      fx = 50; fy = 50; updUI();
      var data = gl();
      delete data[cKey];
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': AKEY },
        body: JSON.stringify(data)
      }).catch(function () {});
      sl(data);
      applyOne(cKey, '');
      addButtons();
      showToast('Punto focal reseteado');
    });

    /* ── Close ── */
    document.getElementById('faCls').addEventListener('click', closeEditor);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeEditor();
    });

    /* ── Reset all ── */
    document.getElementById('faRst').addEventListener('click', function () {
      if (!confirm('Eliminar TODOS los puntos focales?')) return;
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': AKEY },
        body: JSON.stringify({})
      }).catch(function () {});
      sl({});
      document.querySelectorAll('img[src]').forEach(function (i) { i.style.objectPosition = ''; });
      addButtons();
      showToast('Todos eliminados');
    });

    /* ── Exit admin ── */
    document.getElementById('faOut').addEventListener('click', function () {
      sessionStorage.removeItem(AUTH);
      location.href = '/';
    });
  }
})();
