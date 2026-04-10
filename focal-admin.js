/* ═══════════════════════════════════════════════════════════════
   IVAE Studios — Admin Focal Point Editor
   ───────────────────────────────────────────────────────────────
   Usage:
   1. Add ?admin to any page URL to enter admin mode
   2. Click any image to open the focal point editor
   3. Click/drag on the image to set the point of interest
   4. Save — changes persist via localStorage
   5. Export — generates code to hardcode into CSS

   This script also auto-applies saved focal points on every
   page load (no admin mode needed).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STORAGE_KEY = 'ivae_focal_points';
  const PASS_KEY = 'ivae_admin_auth';
  const ADMIN_PASSWORD = 'ivae2026';

  /* ── Helpers ── */
  function getImageKey(img) {
    const src = img.getAttribute('src') || '';
    return src.replace(/^.*\//, ''); // filename only
  }

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ── Apply saved focal points (runs on every page load) ── */
  function applyFocalPoints() {
    const data = getSaved();
    if (!Object.keys(data).length) return;
    document.querySelectorAll('img').forEach(function (img) {
      const key = getImageKey(img);
      if (data[key]) {
        img.style.objectPosition = data[key];
      }
    });
  }

  // Apply on load and after lazy images load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFocalPoints);
  } else {
    applyFocalPoints();
  }
  window.addEventListener('load', applyFocalPoints);

  /* ── Check admin mode (session set by /admin login page) ── */
  if (sessionStorage.getItem(PASS_KEY) !== 'true') return;

  initAdmin();

  function initAdmin() {

  /* ════════════════════════════════════════════════════════════
     ADMIN MODE — UI Construction
     ════════════════════════════════════════════════════════════ */
  var style = document.createElement('style');
  document.head.appendChild(style);
  style.textContent = '\
/* Admin toolbar */\
.ivae-admin-bar{position:fixed;top:0;left:0;right:0;z-index:100000;background:rgba(14,22,32,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:48px;border-bottom:1px solid rgba(196,163,90,0.3);font-family:"Syne",sans-serif}\
.ivae-admin-bar span{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#c4a35a}\
.ivae-admin-bar .admin-label{color:rgba(249,248,247,0.5);margin-right:8px}\
.ivae-admin-btns{display:flex;gap:10px}\
.ivae-admin-btns button{font-family:"Syne",sans-serif;font-size:10px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;border:1px solid rgba(196,163,90,0.4);background:transparent;color:#c4a35a;padding:7px 16px;cursor:pointer;transition:background 0.2s,border-color 0.2s}\
.ivae-admin-btns button:hover{background:rgba(196,163,90,0.15);border-color:#c4a35a}\
.ivae-admin-btns button.danger{color:#e57373;border-color:rgba(229,115,115,0.4)}\
.ivae-admin-btns button.danger:hover{background:rgba(229,115,115,0.12);border-color:#e57373}\
\
/* Image hover overlay in admin mode */\
.ivae-admin-active img[src]{cursor:crosshair !important}\
.ivae-admin-active .pg-i:hover img,.ivae-admin-active .svc-img:hover img,.ivae-admin-active .hero-bg:hover img,.ivae-admin-active .dest-card:hover img,.ivae-admin-active .about-img:hover>img{outline:2px solid #c4a35a;outline-offset:-2px}\
.ivae-admin-active .site-header{top:48px}\
.ivae-admin-active .scroll-progress{top:48px}\
\
/* Make overlays click-through in admin mode */\
.ivae-admin-active .hero-overlay,.ivae-admin-active .hero-content,.ivae-admin-active .hero-bottom,.ivae-admin-active .dest-info,.ivae-admin-active .dest-go,.ivae-admin-active .pg-label,.ivae-admin-active .svc-text{pointer-events:none}\
.ivae-admin-active .hero-content a,.ivae-admin-active .hero-bottom a,.ivae-admin-active .dest-info a{pointer-events:none}\
\
/* Badge on images with saved focal points */\
.ivae-fp-badge{position:absolute;top:8px;right:8px;z-index:50;background:rgba(196,163,90,0.9);color:#0e1620;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:3px 8px;pointer-events:none;text-transform:uppercase;font-family:"Syne",sans-serif}\
\
/* Modal */\
.ivae-fp-modal{position:fixed;inset:0;z-index:200000;background:rgba(14,22,32,0.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.3s}\
.ivae-fp-modal.open{opacity:1;pointer-events:auto}\
.ivae-fp-modal-inner{width:90vw;max-width:960px;max-height:90vh;display:flex;flex-direction:column;gap:20px}\
\
/* Modal header */\
.ivae-fp-header{display:flex;align-items:center;justify-content:space-between}\
.ivae-fp-header h3{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:300;color:#f9f8f7;margin:0}\
.ivae-fp-header .fp-filename{font-size:10px;color:rgba(249,248,247,0.4);letter-spacing:0.1em;margin-left:12px}\
.ivae-fp-close{background:none;border:none;color:rgba(249,248,247,0.5);font-size:24px;cursor:pointer;padding:4px 8px;transition:color 0.2s}\
.ivae-fp-close:hover{color:#f9f8f7}\
\
/* Editor area */\
.ivae-fp-editor{display:grid;grid-template-columns:1fr 300px;gap:20px;overflow:hidden}\
@media(max-width:768px){.ivae-fp-editor{grid-template-columns:1fr;grid-template-rows:1fr auto}}\
\
/* Main image area */\
.ivae-fp-canvas{position:relative;overflow:hidden;cursor:crosshair;background:#111;display:flex;align-items:center;justify-content:center;max-height:65vh}\
.ivae-fp-canvas img{max-width:100%;max-height:65vh;display:block;user-select:none;-webkit-user-select:none;pointer-events:none}\
.ivae-fp-crosshair{position:absolute;width:32px;height:32px;transform:translate(-50%,-50%);pointer-events:none;z-index:10}\
.ivae-fp-crosshair::before,.ivae-fp-crosshair::after{content:"";position:absolute;background:#c4a35a}\
.ivae-fp-crosshair::before{width:2px;height:100%;left:50%;transform:translateX(-50%)}\
.ivae-fp-crosshair::after{width:100%;height:2px;top:50%;transform:translateY(-50%)}\
.ivae-fp-crosshair-ring{position:absolute;inset:-4px;border:2px solid rgba(196,163,90,0.6);border-radius:50%}\
\
/* H/V guide lines */\
.ivae-fp-guide-h,.ivae-fp-guide-v{position:absolute;pointer-events:none;z-index:5}\
.ivae-fp-guide-h{left:0;right:0;height:1px;background:rgba(196,163,90,0.25)}\
.ivae-fp-guide-v{top:0;bottom:0;width:1px;background:rgba(196,163,90,0.25)}\
\
/* Sidebar */\
.ivae-fp-sidebar{display:flex;flex-direction:column;gap:16px}\
\
/* Preview */\
.ivae-fp-preview-wrap{position:relative;overflow:hidden;background:#111;aspect-ratio:16/9}\
.ivae-fp-preview-wrap img{width:100%;height:100%;object-fit:cover;display:block}\
.ivae-fp-preview-label{position:absolute;bottom:0;left:0;right:0;background:rgba(14,22,32,0.8);padding:6px 10px;font-size:9px;color:rgba(249,248,247,0.5);letter-spacing:0.12em;text-transform:uppercase;font-family:"Syne",sans-serif;text-align:center}\
\
/* Controls */\
.ivae-fp-coords{display:flex;gap:12px}\
.ivae-fp-field{flex:1;display:flex;flex-direction:column;gap:4px}\
.ivae-fp-field label{font-size:9px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:rgba(249,248,247,0.4);font-family:"Syne",sans-serif}\
.ivae-fp-field input{background:rgba(249,248,247,0.06);border:1px solid rgba(196,163,90,0.25);color:#f9f8f7;padding:8px 10px;font-size:13px;font-family:"Syne",sans-serif;text-align:center;outline:none;transition:border-color 0.2s}\
.ivae-fp-field input:focus{border-color:#c4a35a}\
\
/* Aspect ratio selector */\
.ivae-fp-ratios{display:flex;gap:6px;flex-wrap:wrap}\
.ivae-fp-ratio-btn{font-family:"Syne",sans-serif;font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(196,163,90,0.25);background:transparent;color:rgba(249,248,247,0.5);padding:5px 10px;cursor:pointer;transition:all 0.2s}\
.ivae-fp-ratio-btn:hover,.ivae-fp-ratio-btn.active{background:rgba(196,163,90,0.15);border-color:#c4a35a;color:#c4a35a}\
\
/* Action buttons */\
.ivae-fp-actions{display:flex;gap:8px;margin-top:auto}\
.ivae-fp-actions button{flex:1;font-family:"Syne",sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:10px 14px;cursor:pointer;border:1px solid rgba(196,163,90,0.4);transition:all 0.2s}\
.ivae-fp-actions .fp-save{background:#c4a35a;color:#0e1620;border-color:#c4a35a}\
.ivae-fp-actions .fp-save:hover{background:#d4b36a}\
.ivae-fp-actions .fp-reset{background:transparent;color:rgba(249,248,247,0.5);border-color:rgba(249,248,247,0.15)}\
.ivae-fp-actions .fp-reset:hover{color:#e57373;border-color:rgba(229,115,115,0.4)}\
\
/* Export modal */\
.ivae-export-modal{position:fixed;inset:0;z-index:300000;background:rgba(14,22,32,0.96);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.3s}\
.ivae-export-modal.open{opacity:1;pointer-events:auto}\
.ivae-export-box{width:90vw;max-width:700px;max-height:85vh;display:flex;flex-direction:column;gap:16px}\
.ivae-export-box h3{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:300;color:#f9f8f7;margin:0}\
.ivae-export-box textarea{width:100%;height:300px;background:rgba(249,248,247,0.04);border:1px solid rgba(196,163,90,0.25);color:#c4a35a;font-family:monospace;font-size:12px;padding:16px;resize:none;outline:none}\
.ivae-export-box .export-actions{display:flex;gap:10px}\
.ivae-export-box .export-actions button{font-family:"Syne",sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:10px 20px;cursor:pointer;border:1px solid rgba(196,163,90,0.4);transition:all 0.2s}\
.ivae-export-box .copy-btn{background:#c4a35a;color:#0e1620;border-color:#c4a35a}\
.ivae-export-box .close-btn{background:transparent;color:rgba(249,248,247,0.5);border-color:rgba(249,248,247,0.15)}\
\
/* Toast */\
.ivae-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:400000;background:#c4a35a;color:#0e1620;font-family:"Syne",sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:10px 24px;opacity:0;transition:opacity 0.3s,transform 0.3s;pointer-events:none}\
.ivae-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\
';
  document.head.appendChild(style);

  /* ── Admin toolbar ── */
  document.body.classList.add('ivae-admin-active');

  var bar = document.createElement('div');
  bar.className = 'ivae-admin-bar';
  bar.innerHTML = '<div><span class="admin-label">Admin</span><span>Focal Point Editor</span></div>\
    <div class="ivae-admin-btns">\
      <button id="ivaeExportBtn">Exportar</button>\
      <button id="ivaeResetAllBtn" class="danger">Reset Todo</button>\
      <button id="ivaeExitBtn">Salir</button>\
    </div>';
  document.body.prepend(bar);

  /* ── Toast ── */
  var toast = document.createElement('div');
  toast.className = 'ivae-toast';
  document.body.appendChild(toast);

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* ── Badge saved images ── */
  function addBadges() {
    document.querySelectorAll('.ivae-fp-badge').forEach(function (b) { b.remove(); });
    var data = getSaved();
    document.querySelectorAll('img[src]').forEach(function (img) {
      var key = getImageKey(img);
      if (data[key]) {
        var parent = img.parentElement;
        if (parent && getComputedStyle(parent).position === 'static') {
          parent.style.position = 'relative';
        }
        var badge = document.createElement('div');
        badge.className = 'ivae-fp-badge';
        badge.textContent = data[key];
        if (parent) parent.appendChild(badge);
      }
    });
  }
  setTimeout(addBadges, 500);

  /* ── Modal HTML ── */
  var modal = document.createElement('div');
  modal.className = 'ivae-fp-modal';
  modal.innerHTML = '\
    <div class="ivae-fp-modal-inner">\
      <div class="ivae-fp-header">\
        <div><h3>Ajustar punto de interes</h3><span class="fp-filename" id="fpFilename"></span></div>\
        <button class="ivae-fp-close" id="fpClose">&times;</button>\
      </div>\
      <div class="ivae-fp-editor">\
        <div class="ivae-fp-canvas" id="fpCanvas">\
          <img id="fpFullImg" src="" alt=""/>\
          <div class="ivae-fp-crosshair" id="fpCrosshair"><div class="ivae-fp-crosshair-ring"></div></div>\
          <div class="ivae-fp-guide-h" id="fpGuideH"></div>\
          <div class="ivae-fp-guide-v" id="fpGuideV"></div>\
        </div>\
        <div class="ivae-fp-sidebar">\
          <div>\
            <div style="font-size:9px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:rgba(249,248,247,0.4);font-family:Syne,sans-serif;margin-bottom:8px">Vista previa</div>\
            <div class="ivae-fp-ratios" id="fpRatios">\
              <button class="ivae-fp-ratio-btn active" data-ratio="16/9">16:9</button>\
              <button class="ivae-fp-ratio-btn" data-ratio="4/5">4:5</button>\
              <button class="ivae-fp-ratio-btn" data-ratio="1/1">1:1</button>\
              <button class="ivae-fp-ratio-btn" data-ratio="4/3">4:3</button>\
              <button class="ivae-fp-ratio-btn" data-ratio="21/9">21:9</button>\
            </div>\
          </div>\
          <div class="ivae-fp-preview-wrap" id="fpPreview">\
            <img id="fpPreviewImg" src="" alt=""/>\
            <div class="ivae-fp-preview-label">Preview</div>\
          </div>\
          <div class="ivae-fp-coords">\
            <div class="ivae-fp-field">\
              <label>X %</label>\
              <input type="number" id="fpX" min="0" max="100" value="50"/>\
            </div>\
            <div class="ivae-fp-field">\
              <label>Y %</label>\
              <input type="number" id="fpY" min="0" max="100" value="50"/>\
            </div>\
          </div>\
          <div class="ivae-fp-actions">\
            <button class="fp-save" id="fpSave">Guardar</button>\
            <button class="fp-reset" id="fpReset">Reset</button>\
          </div>\
        </div>\
      </div>\
    </div>';
  document.body.appendChild(modal);

  /* ── Export modal ── */
  var exportModal = document.createElement('div');
  exportModal.className = 'ivae-export-modal';
  exportModal.innerHTML = '\
    <div class="ivae-export-box">\
      <h3>Exportar Focal Points</h3>\
      <textarea id="ivaeExportCode" readonly></textarea>\
      <div class="export-actions">\
        <button class="copy-btn" id="ivaeCopyBtn">Copiar</button>\
        <button class="close-btn" id="ivaeExportClose">Cerrar</button>\
      </div>\
    </div>';
  document.body.appendChild(exportModal);

  /* ── State ── */
  var currentImg = null;
  var currentKey = '';
  var fpX = 50;
  var fpY = 50;

  var elCanvas = document.getElementById('fpCanvas');
  var elFullImg = document.getElementById('fpFullImg');
  var elCrosshair = document.getElementById('fpCrosshair');
  var elGuideH = document.getElementById('fpGuideH');
  var elGuideV = document.getElementById('fpGuideV');
  var elPreviewImg = document.getElementById('fpPreviewImg');
  var elPreview = document.getElementById('fpPreview');
  var elInputX = document.getElementById('fpX');
  var elInputY = document.getElementById('fpY');
  var elFilename = document.getElementById('fpFilename');

  /* ── Update crosshair & preview ── */
  function updateUI() {
    // Crosshair position relative to the displayed image
    var imgRect = elFullImg.getBoundingClientRect();
    var canvasRect = elCanvas.getBoundingClientRect();
    var offsetX = imgRect.left - canvasRect.left;
    var offsetY = imgRect.top - canvasRect.top;

    elCrosshair.style.left = (offsetX + imgRect.width * fpX / 100) + 'px';
    elCrosshair.style.top = (offsetY + imgRect.height * fpY / 100) + 'px';
    elGuideH.style.top = (offsetY + imgRect.height * fpY / 100) + 'px';
    elGuideV.style.left = (offsetX + imgRect.width * fpX / 100) + 'px';

    // Preview
    elPreviewImg.style.objectPosition = fpX + '% ' + fpY + '%';

    // Inputs
    elInputX.value = Math.round(fpX);
    elInputY.value = Math.round(fpY);
  }

  /* ── Open editor ── */
  function openEditor(img) {
    currentImg = img;
    currentKey = getImageKey(img);
    elFilename.textContent = currentKey;

    var src = img.getAttribute('src') || '';
    elFullImg.src = src;
    elPreviewImg.src = src;

    // Load saved or default
    var data = getSaved();
    if (data[currentKey]) {
      var parts = data[currentKey].split(/\s+/);
      fpX = parseFloat(parts[0]) || 50;
      fpY = parseFloat(parts[1]) || 50;
    } else {
      fpX = 50;
      fpY = 50;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Wait for image to load then position crosshair
    if (elFullImg.complete) {
      updateUI();
    } else {
      elFullImg.onload = updateUI;
    }
  }

  function closeEditor() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    currentImg = null;
  }

  /* ── Canvas click/drag ── */
  function setFocalFromEvent(e) {
    var imgRect = elFullImg.getBoundingClientRect();
    var x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    var y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
    fpX = Math.max(0, Math.min(100, x));
    fpY = Math.max(0, Math.min(100, y));
    updateUI();
  }

  var isDragging = false;
  elCanvas.addEventListener('mousedown', function (e) {
    e.preventDefault();
    isDragging = true;
    setFocalFromEvent(e);
  });
  document.addEventListener('mousemove', function (e) {
    if (isDragging) setFocalFromEvent(e);
  });
  document.addEventListener('mouseup', function () {
    isDragging = false;
  });

  // Touch support
  elCanvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    isDragging = true;
    setFocalFromEvent(e.touches[0]);
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (isDragging) setFocalFromEvent(e.touches[0]);
  }, { passive: true });
  document.addEventListener('touchend', function () {
    isDragging = false;
  });

  /* ── Input changes ── */
  elInputX.addEventListener('input', function () {
    fpX = Math.max(0, Math.min(100, parseFloat(this.value) || 50));
    updateUI();
  });
  elInputY.addEventListener('input', function () {
    fpY = Math.max(0, Math.min(100, parseFloat(this.value) || 50));
    updateUI();
  });

  /* ── Ratio buttons ── */
  document.getElementById('fpRatios').addEventListener('click', function (e) {
    var btn = e.target.closest('.ivae-fp-ratio-btn');
    if (!btn) return;
    document.querySelectorAll('.ivae-fp-ratio-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    elPreview.style.aspectRatio = btn.dataset.ratio;
  });

  /* ── Save ── */
  document.getElementById('fpSave').addEventListener('click', function () {
    if (!currentKey) return;
    var data = getSaved();
    var value = Math.round(fpX) + '% ' + Math.round(fpY) + '%';
    data[currentKey] = value;
    save(data);

    // Apply immediately to the page image
    if (currentImg) {
      currentImg.style.objectPosition = value;
    }
    // Also apply to any other instances of the same image
    document.querySelectorAll('img[src]').forEach(function (img) {
      if (getImageKey(img) === currentKey) {
        img.style.objectPosition = value;
      }
    });

    showToast('Guardado: ' + value);
    addBadges();
    closeEditor();
  });

  /* ── Reset single ── */
  document.getElementById('fpReset').addEventListener('click', function () {
    if (!currentKey) return;
    var data = getSaved();
    delete data[currentKey];
    save(data);

    // Remove inline style
    document.querySelectorAll('img[src]').forEach(function (img) {
      if (getImageKey(img) === currentKey) {
        img.style.objectPosition = '';
      }
    });

    fpX = 50;
    fpY = 50;
    updateUI();
    showToast('Reset: ' + currentKey);
    addBadges();
  });

  /* ── Close ── */
  document.getElementById('fpClose').addEventListener('click', closeEditor);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeEditor();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (exportModal.classList.contains('open')) {
        exportModal.classList.remove('open');
      } else if (modal.classList.contains('open')) {
        closeEditor();
      }
    }
  });

  /* ── Click images to edit ── */
  document.addEventListener('click', function (e) {
    if (modal.classList.contains('open') || exportModal.classList.contains('open')) return;

    // Find the clicked image or its container
    var img = e.target.closest('img[src]');
    if (!img) {
      // Check if we clicked a container that has an image
      var container = e.target.closest('.pg-i, .svc-img, .hero-bg, .dest-card, .about-img, .svc-card, .hero, .post-hero, .cta-bg, .inline-photo');
      if (container) {
        img = container.querySelector('img');
      }
    }
    if (!img) return;

    // Skip lightbox image, loader, and admin UI images
    if (img.id === 'lightboxImg' || img.closest('.ivae-admin-bar') || img.closest('.ivae-fp-modal')) return;

    e.preventDefault();
    e.stopPropagation();
    openEditor(img);
  }, true);

  /* ── Export ── */
  document.getElementById('ivaeExportBtn').addEventListener('click', function () {
    var data = getSaved();
    var keys = Object.keys(data);
    if (!keys.length) {
      showToast('No hay focal points guardados');
      return;
    }

    var css = '/* IVAE Focal Points — Generated ' + new Date().toISOString().slice(0, 10) + ' */\n';
    css += '/* Add this CSS to your page styles */\n\n';

    keys.forEach(function (filename) {
      css += '/* ' + filename + ' */\n';
      css += 'img[src*="' + filename + '"] {\n';
      css += '  object-position: ' + data[filename] + ' !important;\n';
      css += '}\n\n';
    });

    css += '\n/* ── OR use inline styles ── */\n';
    keys.forEach(function (filename) {
      css += '/* ' + filename + ' → style="object-position: ' + data[filename] + ';" */\n';
    });

    document.getElementById('ivaeExportCode').value = css;
    exportModal.classList.add('open');
  });

  document.getElementById('ivaeCopyBtn').addEventListener('click', function () {
    var ta = document.getElementById('ivaeExportCode');
    ta.select();
    document.execCommand('copy');
    showToast('Copiado al portapapeles');
  });

  document.getElementById('ivaeExportClose').addEventListener('click', function () {
    exportModal.classList.remove('open');
  });

  exportModal.addEventListener('click', function (e) {
    if (e.target === exportModal) exportModal.classList.remove('open');
  });

  /* ── Reset all ── */
  document.getElementById('ivaeResetAllBtn').addEventListener('click', function () {
    if (!confirm('Segura que quieres eliminar TODOS los focal points guardados?')) return;
    localStorage.removeItem(STORAGE_KEY);
    document.querySelectorAll('img[src]').forEach(function (img) {
      img.style.objectPosition = '';
    });
    addBadges();
    showToast('Todos los focal points eliminados');
  });

  /* ── Exit admin ── */
  document.getElementById('ivaeExitBtn').addEventListener('click', function () {
    sessionStorage.removeItem(PASS_KEY);
    location.href = '/';
  });

  } // end initAdmin

})();
