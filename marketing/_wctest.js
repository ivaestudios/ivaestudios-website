/* Diagnóstico WebCodecs para Safari — se ejecuta solo y muestra el resultado en pantalla. */
(async () => {
  const out = document.getElementById('out');
  const log = (s) => { out.textContent += s + '\n'; };
  out.textContent = '';
  try {
    log('VideoEncoder: ' + (typeof window.VideoEncoder));
    log('VideoFrame:   ' + (typeof window.VideoFrame));
    log('AudioEncoder: ' + (typeof window.AudioEncoder));
    log('OffscreenCanvas: ' + (typeof OffscreenCanvas));
    log('');

    if (typeof window.VideoEncoder === 'undefined') { log('>> NO hay VideoEncoder: usaria MediaRecorder (fragmentado). FIN.'); return; }

    const W = 1152, H = 1440;
    const codecs = ['avc1.4d0028', 'avc1.42e028', 'avc1.640028', 'avc1.42e01e', 'avc1.4d401e'];
    for (const c of codecs) {
      try { const s = await window.VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 10000000 }); log('isConfigSupported ' + c + ' = ' + (s && s.supported)); }
      catch (e) { log('isConfigSupported ' + c + ' ERR ' + e.message); }
    }
    log('');

    const tests = [
      ['A) latencyMode realtime + avc', { codec: 'avc1.4d0028', width: W, height: H, bitrate: 10000000, framerate: 30, latencyMode: 'realtime', avc: { format: 'avc' } }],
      ['B) sin latencyMode + avc', { codec: 'avc1.4d0028', width: W, height: H, bitrate: 10000000, framerate: 30, avc: { format: 'avc' } }],
      ['C) baseline + avc', { codec: 'avc1.42e028', width: W, height: H, bitrate: 10000000, framerate: 30, avc: { format: 'avc' } }],
      ['D) sin avc (annexb default)', { codec: 'avc1.42e028', width: W, height: H, bitrate: 10000000, framerate: 30 }],
    ];
    for (const [name, cfg] of tests) {
      try {
        let err = null, chunks = 0;
        const enc = new window.VideoEncoder({ output: () => { chunks++; }, error: (e) => { err = e.message || String(e); } });
        enc.configure(cfg);
        const cv = new OffscreenCanvas(W, H); const cx = cv.getContext('2d'); cx.fillStyle = '#c33'; cx.fillRect(0, 0, W, H);
        const vf = new window.VideoFrame(cv, { timestamp: 0, duration: 33333 });
        enc.encode(vf, { keyFrame: true }); vf.close();
        await enc.flush(); enc.close();
        log('CONFIGURE ' + name + ' -> chunks=' + chunks + ' err=' + (err || 'ninguno'));
      } catch (e) { log('CONFIGURE ' + name + ' -> EXCEPCION: ' + (e && e.message)); }
    }
    log('');
    log('=== FIN DIAGNOSTICO ===');
  } catch (e) { log('FATAL: ' + (e && e.message)); }
})();
