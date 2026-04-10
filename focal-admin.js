/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Admin Focal Point Editor
   ───────────────────────────────────────────────────────────────
   Login at /admin → sets sessionStorage → redirects to /
   focal-admin.js detects session and shows editing tools.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ivae_focal_points';
  var PASS_KEY = 'ivae_admin_auth';

  function getImageKey(img) {
    return (img.getAttribute('src') || '').replace(/^.*\//, '');
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

  /* ── Wait for DOM ── */
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
      '.ivae-ab{position:fixed;top:0;left:0;right:0;z-index:100000;background:rgba(14,22,32,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:48px;border-bottom:1px solid rgba(196,163,90,.3);font-family:Syne,sans-serif}' +
      '.ivae-ab span{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#c4a35a}' +
      '.ivae-ab .al{color:rgba(249,248,247,.5);margin-right:8px}' +
      '.ivae-ab-btns{display:flex;gap:10px}' +
      '.ivae-ab-btns button{font-family:Syne,sans-serif;font-size:10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;border:1px solid rgba(196,163,90,.4);background:0 0;color:#c4a35a;padding:7px 16px;cursor:pointer;transition:background .2s}' +
      '.ivae-ab-btns button:hover{background:rgba(196,163,90,.15)}' +
      '.ivae-ab-btns .dng{color:#e57373;border-color:rgba(229,115,115,.4)}' +
      '.ivae-ab-btns .dng:hover{background:rgba(229,115,115,.12)}' +
      /* push page content down */
      'body.ivae-on .site-header{top:48px}' +
      'body.ivae-on .scroll-progress{top:48px}' +
      /* click-through overlays */
      'body.ivae-on .hero-overlay,body.ivae-on .hero-content,body.ivae-on .hero-bottom,body.ivae-on .dest-info,body.ivae-on .dest-go,body.ivae-on .pg-label,body.ivae-on .svc-text,body.ivae-on .post-hero-overlay,body.ivae-on .post-hero-text{pointer-events:none}' +
      'body.ivae-on .hero-content a,body.ivae-on .hero-bottom a{pointer-events:none}' +
      /* cursor */
      'body.ivae-on img[src]{cursor:crosshair!important}' +
      /* edit buttons on each image */
      '.ivae-edit-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:90;background:rgba(14,22,32,.85);border:1px solid #c4a35a;color:#c4a35a;font-family:Syne,sans-serif;font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;padding:12px 24px;cursor:pointer;opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap}' +
      '.ivae-img-wrap:hover .ivae-edit-btn{opacity:1;pointer-events:auto}' +
      '.ivae-img-wrap{position:relative}' +
      /* badge */
      '.ivae-badge{position:absolute;top:8px;right:8px;z-index:50;background:rgba(196,163,90,.9);color:#0e1620;font-size:9px;font-weight:700;letter-spacing:.1em;padding:3px 8px;pointer-events:none;text-transform:uppercase;font-family:Syne,sans-serif}' +
      /* modal */
      '.ivae-modal{position:fixed;inset:0;z-index:200000;background:rgba(14,22,32,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:none;align-items:center;justify-content:center}' +
      '.ivae-modal.open{display:flex}' +
      '.ivae-mi{width:90vw;max-width:960px;max-height:90vh;display:flex;flex-direction:column;gap:20px}' +
      '.ivae-mh{display:flex;align-items:center;justify-content:space-between}' +
      '.ivae-mh h3{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:300;color:#f9f8f7;margin:0}' +
      '.ivae-mh .fn{font-size:10px;color:rgba(249,248,247,.4);letter-spacing:.1em;margin-left:12px}' +
      '.ivae-cls{background:0 0;border:0;color:rgba(249,248,247,.5);font-size:28px;cursor:pointer;padding:4px 8px}' +
      '.ivae-cls:hover{color:#f9f8f7}' +
      '.ivae-ed{display:grid;grid-template-columns:1fr 300px;gap:20px;overflow:hidden}' +
      '@media(max-width:768px){.ivae-ed{grid-template-columns:1fr;grid-template-rows:1fr auto}}' +
      '.ivae-cv{position:relative;overflow:hidden;cursor:crosshair;background:#111;display:flex;align-items:center;justify-content:center;max-height:65vh}' +
      '.ivae-cv img{max-width:100%;max-height:65vh;display:block;user-select:none;-webkit-user-select:none;pointer-events:none}' +
      '.ivae-ch{position:absolute;width:32px;height:32px;transform:translate(-50%,-50%);pointer-events:none;z-index:10}' +
      '.ivae-ch::before,.ivae-ch::after{content:"";position:absolute;background:#c4a35a}' +
      '.ivae-ch::before{width:2px;height:100%;left:50%;transform:translateX(-50%)}' +
      '.ivae-ch::after{width:100%;height:2px;top:50%;transform:translateY(-50%)}' +
      '.ivae-ring{position:absolute;inset:-4px;border:2px solid rgba(196,163,90,.6);border-radius:50%}' +
      '.ivae-gh,.ivae-gv{position:absolute;pointer-events:none;z-index:5}' +
      '.ivae-gh{left:0;right:0;height:1px;background:rgba(196,163,90,.25)}' +
      '.ivae-gv{top:0;bottom:0;width:1px;background:rgba(196,163,90,.25)}' +
      '.ivae-sb{display:flex;flex-direction:column;gap:16px}' +
      '.ivae-pw{position:relative;overflow:hidden;background:#111;aspect-ratio:16/9}' +
      '.ivae-pw img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.ivae-pl{position:absolute;bottom:0;left:0;right:0;background:rgba(14,22,32,.8);padding:6px 10px;font-size:9px;color:rgba(249,248,247,.5);letter-spacing:.12em;text-transform:uppercase;font-family:Syne,sans-serif;text-align:center}' +
      '.ivae-co{display:flex;gap:12px}' +
      '.ivae-fl{flex:1;display:flex;flex-direction:column;gap:4px}' +
      '.ivae-fl label{font-size:9px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:rgba(249,248,247,.4);font-family:Syne,sans-serif}' +
      '.ivae-fl input{background:rgba(249,248,247,.06);border:1px solid rgba(196,163,90,.25);color:#f9f8f7;padding:8px 10px;font-size:13px;font-family:Syne,sans-serif;text-align:center;outline:0;transition:border-color .2s}' +
      '.ivae-fl input:focus{border-color:#c4a35a}' +
      '.ivae-rt{display:flex;gap:6px;flex-wrap:wrap}' +
      '.ivae-rb{font-family:Syne,sans-serif;font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;border:1px solid rgba(196,163,90,.25);background:0 0;color:rgba(249,248,247,.5);padding:5px 10px;cursor:pointer;transition:all .2s}' +
      '.ivae-rb:hover,.ivae-rb.on{background:rgba(196,163,90,.15);border-color:#c4a35a;color:#c4a35a}' +
      '.ivae-ac{display:flex;gap:8px;margin-top:auto}' +
      '.ivae-ac button{flex:1;font-family:Syne,sans-serif;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:10px 14px;cursor:pointer;border:1px solid rgba(196,163,90,.4);transition:all .2s}' +
      '.ivae-sv{background:#c4a35a;color:#0e1620;border-color:#c4a35a}' +
      '.ivae-sv:hover{background:#d4b36a}' +
      '.ivae-rs{background:0 0;color:rgba(249,248,247,.5);border-color:rgba(249,248,247,.15)}' +
      '.ivae-rs:hover{color:#e57373;border-color:rgba(229,115,115,.4)}' +
      '.ivae-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:400000;background:#c4a35a;color:#0e1620;font-family:Syne,sans-serif;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:10px 24px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none}' +
      '.ivae-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    document.head.appendChild(css);

    /* ═══ ADMIN BAR ═══ */
    document.body.classList.add('ivae-on');
    var bar = document.createElement('div');
    bar.className = 'ivae-ab';
    bar.innerHTML = '<div><span class="al">Admin</span><span>Focal Point Editor</span></div>' +
      '<div class="ivae-ab-btns">' +
      '<button id="ivaeExp">Exportar</button>' +
      '<button id="ivaeRst" class="dng">Reset Todo</button>' +
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
      setTimeout(function() { toast.classList.remove('show'); }, 2200);
    }

    /* ═══ ADD EDIT BUTTONS TO ALL IMAGES ═══ */
    function addEditButtons() {
      document.querySelectorAll('.ivae-edit-btn').forEach(function(b) { b.remove(); });
      document.querySelectorAll('.ivae-badge').forEach(function(b) { b.remove(); });
      var data = getSaved();
      var imgs = document.querySelectorAll('img[src]');
      imgs.forEach(function(img) {
        // Skip admin UI images, lightbox, and tiny images
        if (img.closest('.ivae-ab,.ivae-modal,.ivae-toast')) return;
        if (img.id === 'lightboxImg') return;
        if (img.width < 50 && img.height < 50) return;

        var parent = img.parentElement;
        if (!parent) return;
        // Make parent relative if needed
        var pos = getComputedStyle(parent).position;
        if (pos === 'static') parent.style.position = 'relative';
        parent.classList.add('ivae-img-wrap');

        // Add EDITAR button
        var btn = document.createElement('button');
        btn.className = 'ivae-edit-btn';
        btn.textContent = 'Editar punto focal';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          openEditor(img);
        });
        parent.appendChild(btn);

        // Add badge if has saved focal point
        var key = getImageKey(img);
        if (data[key]) {
          var badge = document.createElement('div');
          badge.className = 'ivae-badge';
          badge.textContent = data[key];
          parent.appendChild(badge);
        }
      });
    }
    // Run after images load
    setTimeout(addEditButtons, 800);
    window.addEventListener('load', function() { setTimeout(addEditButtons, 300); });

    /* ═══ MODAL ═══ */
    var modal = document.createElement('div');
    modal.className = 'ivae-modal';
    modal.innerHTML =
      '<div class="ivae-mi">' +
        '<div class="ivae-mh">' +
          '<div><h3>Ajustar punto de interes</h3><span class="fn" id="fpFn"></span></div>' +
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
              '<div style="font-size:9px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:rgba(249,248,247,.4);font-family:Syne,sans-serif;margin-bottom:8px">Vista previa</div>' +
              '<div class="ivae-rt" id="fpRt">' +
                '<button class="ivae-rb on" data-r="16/9">16:9</button>' +
                '<button class="ivae-rb" data-r="4/5">4:5</button>' +
                '<button class="ivae-rb" data-r="1/1">1:1</button>' +
                '<button class="ivae-rb" data-r="4/3">4:3</button>' +
                '<button class="ivae-rb" data-r="21/9">21:9</button>' +
              '</div>' +
            '</div>' +
            '<div class="ivae-pw" id="fpPw">' +
              '<img id="fpPi" src="" alt=""/>' +
              '<div class="ivae-pl">Preview</div>' +
            '</div>' +
            '<div class="ivae-co">' +
              '<div class="ivae-fl"><label>X %</label><input type="number" id="fpXi" min="0" max="100" value="50"/></div>' +
              '<div class="ivae-fl"><label>Y %</label><input type="number" id="fpYi" min="0" max="100" value="50"/></div>' +
            '</div>' +
            '<div class="ivae-ac">' +
              '<button class="ivae-sv" id="fpSv">Guardar</button>' +
              '<button class="ivae-rs" id="fpRs">Reset</button>' +
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
      if (eImg.complete && eImg.naturalWidth) updUI();
      else eImg.onload = updUI;
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

    var drag = false;
    eCv.addEventListener('mousedown', function(e) { e.preventDefault(); drag = true; setFP(e); });
    document.addEventListener('mousemove', function(e) { if (drag) setFP(e); });
    document.addEventListener('mouseup', function() { drag = false; });
    eCv.addEventListener('touchstart', function(e) { e.preventDefault(); drag = true; setFP(e.touches[0]); }, {passive:false});
    document.addEventListener('touchmove', function(e) { if (drag) setFP(e.touches[0]); }, {passive:true});
    document.addEventListener('touchend', function() { drag = false; });

    eXi.addEventListener('input', function() { fx = Math.max(0, Math.min(100, +this.value || 50)); updUI(); });
    eYi.addEventListener('input', function() { fy = Math.max(0, Math.min(100, +this.value || 50)); updUI(); });

    document.getElementById('fpRt').addEventListener('click', function(e) {
      var b = e.target.closest('.ivae-rb'); if (!b) return;
      document.querySelectorAll('.ivae-rb').forEach(function(x) { x.classList.remove('on'); });
      b.classList.add('on');
      ePw.style.aspectRatio = b.dataset.r;
    });

    /* Save */
    document.getElementById('fpSv').addEventListener('click', function() {
      if (!curKey) return;
      var data = getSaved();
      var val = Math.round(fx) + '% ' + Math.round(fy) + '%';
      data[curKey] = val;
      saveFP(data);
      document.querySelectorAll('img[src]').forEach(function(i) {
        if (getImageKey(i) === curKey) i.style.objectPosition = val;
      });
      showToast('Guardado: ' + val);
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
      showToast('Reset: ' + curKey);
      addEditButtons();
    });

    /* Close */
    document.getElementById('fpCls').addEventListener('click', closeEditor);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeEditor(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeEditor();
    });

    /* Export */
    document.getElementById('ivaeExp').addEventListener('click', function() {
      var data = getSaved(), keys = Object.keys(data);
      if (!keys.length) { showToast('No hay focal points guardados'); return; }
      var out = '/* IVAE Focal Points — ' + new Date().toISOString().slice(0,10) + ' */\n\n';
      keys.forEach(function(f) {
        out += 'img[src*="' + f + '"] { object-position: ' + data[f] + ' !important; }\n';
      });
      var ta = prompt('Copia este CSS:', out);
    });

    /* Reset all */
    document.getElementById('ivaeRst').addEventListener('click', function() {
      if (!confirm('Eliminar TODOS los focal points?')) return;
      localStorage.removeItem(STORAGE_KEY);
      document.querySelectorAll('img[src]').forEach(function(i) { i.style.objectPosition = ''; });
      addEditButtons();
      showToast('Todos eliminados');
    });

    /* Exit */
    document.getElementById('ivaeExit').addEventListener('click', function() {
      sessionStorage.removeItem(PASS_KEY);
      location.href = '/';
    });

  } // end run
})();
