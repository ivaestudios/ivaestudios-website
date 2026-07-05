// ============================================================================
// IVAE Marketing — Conversor de video a H.264 MP4 (para Meta Ads / WhatsApp / todo).
//
// Muchos reels de iPhone vienen en HEVC/H.265 (contenedor .mov) y en 4K. Meta Ads
// RECHAZA el HEVC ("sale un código raro y no deja activar la campaña") y el 4K pesa
// de más. Este módulo convierte cualquier video a H.264 MP4 (perfil Main, faststart,
// máx 1080×1920, audio AAC) — el formato que Meta, WhatsApp y todo aceptan — 100% en
// el navegador con WebCodecs, sin subir nada a un servidor.
//
// Pipeline (verificado sobre reels reales):
//   mp4box demuxea → VideoDecoder decodifica (HEVC o H.264) → se reescala a ≤1080p →
//   VideoEncoder re-encoda H.264 (Main) → mp4-muxer arma el MP4 (moov al frente).
//   El audio se decodifica con AudioContext y se re-encoda AAC 128k.
//
// OJO: el elemento <video> de Chrome NO reproduce HEVC, por eso se demuxea y se
// decodifica con WebCodecs VideoDecoder (que SÍ soporta HEVC en Mac), no reproduciendo.
// ============================================================================

const STAMP = '202607050115';

let mp4boxLoad = null;
function loadMp4box() {
  if (window.MP4Box && window.DataStream) return Promise.resolve();
  if (!mp4boxLoad) {
    mp4boxLoad = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/marketing/vendor/mp4box.all.min.js?v=' + STAMP;
      s.onload = () => res();
      s.onerror = () => { mp4boxLoad = null; rej(new Error('No se pudo cargar el conversor de video.')); };
      document.head.appendChild(s);
    });
  }
  return mp4boxLoad;
}

// ¿El navegador puede transcodificar? (WebCodecs completo). En iPhone/Android viejos
// puede faltar; ahí no forzamos conversión (se sube el original).
export function canConvertVideo() {
  return !!(window.VideoEncoder && window.VideoDecoder && window.AudioEncoder
    && window.VideoFrame && typeof OffscreenCanvas !== 'undefined');
}

// Escaneo rápido de bytes buscando la firma HEVC en el moov (hvc1 / hev1).
function scanHevc(u8) {
  try { return /hvc1|hev1/.test(new TextDecoder('latin1').decode(u8)); } catch { return false; }
}

// ¿Este archivo necesita convertirse para Meta? Solo re-encodamos HEVC (lo que Meta
// rechaza); el H.264 ya sirve y lo dejamos tal cual (sin pérdida ni espera).
export async function fileNeedsMetaFix(file) {
  const CHUNK = 1_500_000;
  try {
    const head = new Uint8Array(await file.slice(0, CHUNK).arrayBuffer());
    if (scanHevc(head)) return true;
    if (file.size > CHUNK) {
      const tail = new Uint8Array(await file.slice(Math.max(0, file.size - CHUNK)).arrayBuffer());
      if (scanHevc(tail)) return true;
    }
  } catch { /* si la detección falla, no forzamos conversión */ }
  return false;
}

// Re-encoda el audio (AudioBuffer PCM) a AAC 128k y lo mete al muxer.
async function encodeAudioAac(audioBuf, muxer) {
  const sr = audioBuf.sampleRate;
  const ch = Math.min(2, audioBuf.numberOfChannels);
  let aerr = null;
  const aenc = new window.AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aerr = e; } },
    error: (e) => { aerr = e; },
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 128_000 });
  const BLK = 4096;
  const L = audioBuf.getChannelData(0);
  const R = ch > 1 ? audioBuf.getChannelData(1) : null;
  const totalFrames = audioBuf.length;
  for (let off = 0; off < totalFrames && !aerr; off += BLK) {
    const n = Math.min(BLK, totalFrames - off);
    const data = new Float32Array(n * ch); // f32-planar: [canal0…][canal1…]
    data.set(L.subarray(off, off + n), 0);
    if (R) data.set(R.subarray(off, off + n), n);
    const ad = new window.AudioData({
      format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch,
      timestamp: Math.round((off / sr) * 1e6), data,
    });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush(); aenc.close();
  if (aerr) throw aerr;
}

// Convierte un File de video a H.264 MP4 (≤1080p, Main, faststart, audio AAC).
// onProgress(pct 0-100). Devuelve un File nuevo (.mp4). Lanza si algo falla.
export async function convertToMetaMp4(file, onProgress) {
  if (!canConvertVideo()) throw new Error('Este navegador no puede convertir video. Usa Chrome o Safari en una compu.');
  await loadMp4box();
  const { Muxer, ArrayBufferTarget } = await import('/marketing/vendor/mp4-muxer.mjs?v=' + STAMP);
  const report = (p) => { if (onProgress) { try { onProgress(Math.max(0, Math.min(100, Math.round(p)))); } catch { /* noop */ } } };
  report(1);

  const ab = await file.arrayBuffer();

  // ── 1) Demux del video con mp4box ──
  const mp4 = window.MP4Box.createFile();
  const samples = [];
  let vtrack = null, vdesc = null;
  const getDesc = (trak) => {
    const e = trak.mdia.minf.stbl.stsd.entries[0];
    const box = e.hvcC || e.avcC || e.vpcC || e.av1C;
    if (!box) return null;
    const ds = new window.DataStream(undefined, 0, window.DataStream.BIG_ENDIAN);
    box.write(ds);
    return new Uint8Array(ds.buffer, 8); // sin la cabecera de 8 bytes del box
  };
  await new Promise((res, rej) => {
    mp4.onError = (e) => rej(new Error('No se pudo leer el video (' + e + ').'));
    mp4.onReady = (info) => {
      if (!info.videoTracks || !info.videoTracks.length) { rej(new Error('El video no tiene pista de imagen.')); return; }
      vtrack = info.videoTracks[0];
      vdesc = getDesc(mp4.getTrackById(vtrack.id));
      if (!vdesc) { rej(new Error('Códec de video no reconocido.')); return; }
      mp4.setExtractionOptions(vtrack.id, 'v', { nbSamples: (vtrack.nb_samples || 100000) + 1 });
      mp4.start();
    };
    mp4.onSamples = (id, u, ss) => {
      for (const s of ss) samples.push(s);
      if (vtrack && samples.length >= vtrack.nb_samples) res();
    };
    const buf = ab.slice(0); buf.fileStart = 0;
    mp4.appendBuffer(buf); mp4.flush();
    setTimeout(() => { if (vtrack && samples.length) res(); }, 20000); // red de seguridad
  });
  if (!vtrack || !samples.length) throw new Error('No se pudo extraer el video.');
  report(5);

  // ── 2) Dimensiones destino: reducir a ≤1080×1920 (Meta recomienda 1080p), pares ──
  const W = (vtrack.video && vtrack.video.width) || vtrack.track_width;
  const H = (vtrack.video && vtrack.video.height) || vtrack.track_height;
  const scale = Math.min(1, 1920 / Math.max(W, H), 1080 / Math.min(W, H));
  const TW = (Math.round(W * scale)) & ~1;
  const TH = (Math.round(H * scale)) & ~1;
  const tscale = vtrack.timescale || 90000;

  // ── 3) Audio (best-effort): decodifica el original a PCM; se re-encoda al final ──
  let audioBuf = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const actx = new AC();
    audioBuf = await actx.decodeAudioData(ab.slice(0));
    try { actx.close(); } catch { /* noop */ }
  } catch { audioBuf = null; }

  // ── 4) Muxer + códec de salida (Main 4.0 → Baseline 4.0; los que Meta acepta) ──
  const muxerCfg = { target: new ArrayBufferTarget(), video: { codec: 'avc', width: TW, height: TH }, fastStart: 'in-memory' };
  if (audioBuf) muxerCfg.audio = { codec: 'aac', numberOfChannels: Math.min(2, audioBuf.numberOfChannels), sampleRate: audioBuf.sampleRate };
  const muxer = new Muxer(muxerCfg);

  let vcodec = 'avc1.4d0028';
  for (const cc of ['avc1.4d0028', 'avc1.42e028', 'avc1.640028']) {
    try { const s = await window.VideoEncoder.isConfigSupported({ codec: cc, width: TW, height: TH, bitrate: 9_000_000 }); if (s && s.supported) { vcodec = cc; break; } } catch { /* noop */ }
  }

  let encErr = null;
  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encErr = e; } },
    error: (e) => { encErr = e; },
  });
  encoder.configure({ codec: vcodec, width: TW, height: TH, bitrate: 9_000_000, framerate: 30, latencyMode: 'realtime', avc: { format: 'avc' } });

  const canvas = new OffscreenCanvas(TW, TH);
  const cx = canvas.getContext('2d', { alpha: false });

  // ── 5) Decodifica (HEVC/H.264) → dibuja reescalado → encoda H.264 ──
  let decErr = null, t0 = null, encoded = 0;
  const total = vtrack.nb_samples || samples.length;
  const decoder = new window.VideoDecoder({
    output: (frame) => {
      try {
        if (t0 === null) t0 = frame.timestamp;
        cx.drawImage(frame, 0, 0, TW, TH);
        const ts = Math.max(0, frame.timestamp - t0);
        const vf = new window.VideoFrame(canvas, { timestamp: ts, duration: frame.duration || 33333 });
        encoder.encode(vf, { keyFrame: encoded % 30 === 0 }); // IDR al inicio y cada ~1s
        vf.close();
        frame.close();
        encoded += 1;
        if (encoded % 6 === 0) report(5 + (encoded / total) * 80);
      } catch (e) { decErr = e; try { frame.close(); } catch { /* noop */ } }
    },
    error: (e) => { decErr = e; },
  });
  decoder.configure({ codec: vtrack.codec, description: vdesc, codedWidth: W, codedHeight: H });

  for (const s of samples) {
    if (decErr || encErr) break;
    // backpressure: no saturar la cola del decodificador (memoria acotada)
    while (decoder.decodeQueueSize > 20) { await new Promise((r) => setTimeout(r, 4)); }
    decoder.decode(new window.EncodedVideoChunk({
      type: s.is_sync ? 'key' : 'delta',
      timestamp: Math.round((s.cts / tscale) * 1e6),
      duration: Math.round((s.duration / tscale) * 1e6),
      data: s.data,
    }));
  }
  await decoder.flush(); decoder.close();
  await encoder.flush(); encoder.close();
  if (decErr) throw new Error('No se pudo decodificar el video (' + (decErr.message || decErr) + ').');
  if (encErr) throw new Error('No se pudo recodificar el video (' + (encErr.message || encErr) + ').');
  if (!encoded) throw new Error('No se recodificó ningún cuadro.');
  report(86);

  // ── 6) Audio → AAC ──
  if (audioBuf) {
    try { await encodeAudioAac(audioBuf, muxer); }
    catch (e) { console.error('[videoconv] audio', e && e.message); } // sin audio no rompe la conversión
  }
  report(98);

  muxer.finalize();
  report(100);
  const base = String(file.name || 'reel').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'reel';
  return new File([muxer.target.buffer], base + '.mp4', { type: 'video/mp4' });
}
