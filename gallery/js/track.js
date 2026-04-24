/* IVAE Gallery — client telemetry (under 60 lines).
   Posts events to /api/gallery/galleries/{galleryId}/track.
   Server validates type against allow-list, reads pic_visit / pic_email cookies. */
(function () {
  var ALLOWED = {
    gallery_view:1, gallery_enter:1, photo_open:1, favorite_add:1, favorite_remove:1,
    proof_submit:1, slideshow_start:1, download_request:1, scene_view:1, share_click:1
  };
  var galleryId = null;
  var sessionFired = Object.create(null); // dedupe per-page-load
  var debounceTimers = Object.create(null);
  var DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  function post(events) {
    if (!galleryId || !events.length) return;
    try {
      var url = '/api/gallery/galleries/' + encodeURIComponent(galleryId) + '/track';
      var body = JSON.stringify(events.length === 1 ? events[0] : { batch: events });
      var blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
      fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:body, keepalive:true, credentials:'include' })
        .catch(function(e){ if (DEV) console.warn('[track]', e); });
    } catch (e) { if (DEV) console.warn('[track]', e); }
  }

  function send(type, opts) {
    try {
      if (!ALLOWED[type]) return;
      opts = opts || {};
      var ev = { type: type };
      if (opts.photo_id) ev.photo_id = opts.photo_id;
      if (opts.meta) ev.meta = opts.meta;
      // gallery_view fires once per page load
      if (type === 'gallery_view') {
        if (sessionFired.gallery_view) return;
        sessionFired.gallery_view = 1;
      }
      // Coalesce rapid favorite toggles within 500ms
      if (type === 'favorite_add' || type === 'favorite_remove') {
        var key = type + ':' + (opts.photo_id || '');
        clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(function(){ delete debounceTimers[key]; post([ev]); }, 500);
        return;
      }
      post([ev]);
    } catch (e) { if (DEV) console.warn('[track]', e); }
  }

  function batch(events) {
    try {
      var clean = (events||[]).filter(function(e){ return e && ALLOWED[e.type]; });
      if (clean.length) post(clean);
    } catch (e) { if (DEV) console.warn('[track]', e); }
  }

  function init(id) {
    try { galleryId = id; send('gallery_view'); } catch (e) { if (DEV) console.warn('[track]', e); }
  }

  window.IvaeTrack = { init: init, send: send, batch: batch };
})();
