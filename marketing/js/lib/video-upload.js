// ============================================================================
// IVAE Marketing — Subida de VIDEO compartida (Entregables + "Video final").
//
// UN SOLO mecanismo para todo el video de la app:
//   · Revisión ANTES de subir  -> formatos que ningún navegador reproduce y
//     aviso de HEVC/H.265 (el archivo sube perfecto, pero se ve NEGRO en
//     Android/Chrome; en iPhone sí se ve).
//   · Subida POR PARTES a R2   -> partes chicas en paralelo, sin tope práctico
//     de tamaño y con la CALIDAD ORIGINAL: aquí no se recomprime, no se
//     reescala y no se transforma NADA. Los bytes que salen del archivo son
//     los mismos que quedan guardados.
//
// Lo usan: views/entregables.js (reels del cliente) y views/meses.js (columna
// "Video final" del calendario). Antes cada uno tenía su propio camino y el del
// calendario obligaba a comprimir a mano todo lo que pasara de 100 MB.
// ============================================================================
import { T } from '../shell/i18n.js?v=202608040227';

// Partes de ~15MB: el Worker lee CADA parte completa en memoria para dárselas a
// R2, así que partes de 50MB × 3 en paralelo podían reventarle la memoria con un
// 4K de 2GB. 15MB deja margen de sobra y sigue muy por arriba del mínimo de R2 (5MB).
export const CHUNK_BYTES = 15 * 1024 * 1024;
export const UP_LANES = 3;              // partes subiendo a la vez
export const MAX_VIDEO_MB = 3000;       // tope de cordura (~3GB)

// ── Formatos ────────────────────────────────────────────────────────────────
// Lo que el reproductor del navegador SÍ sabe abrir y el servidor SÍ acepta.
// Deliberadamente NO incluye .mkv/.avi/.wmv/.flv/.ts: se pueden guardar, pero
// el cliente vería un reproductor en blanco — y el servidor los rechaza con 415.
// Se avisa ANTES de empezar a subir, no después de 10 minutos de subida.
export const EXT_MIME = {
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', qt: 'video/quicktime',
  webm: 'video/webm', '3gp': 'video/3gpp',
  hevc: 'video/mp4',
};
export const SUPPORTED_EXTS = Object.keys(EXT_MIME);
// Extensiones que la gente arrastra pensando que son video pero el navegador no
// reproduce. Se reconocen sólo para poder dar un mensaje ÚTIL ("expórtalo en MP4").
// .mpg/.mpeg entran aquí: el servidor los acepta (y sigue sirviendo los que ya
// están guardados), pero ningún navegador los reproduce — el cliente vería un
// reproductor en blanco, que es exactamente lo que la revisión previa evita.
export const UNPLAYABLE_EXTS = ['mpg', 'mpeg', 'mkv', 'avi', '3g2', 'ogv', 'wmv', 'flv', 'ts', 'mts', 'm2ts', 'mxf', 'r3d', 'braw'];

export function fileExt(name) {
  const m = /\.([^.]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

// ¿Es un archivo de video? Reconoce por MIME O por extensión: muchos .mov/.mkv
// llegan con file.type VACÍO (iPhone, cámaras, archivos copiados) y NO deben
// descartarse — esa era la causa de "subí 9 y solo entraron 7".
export function isVideoFile(f) {
  if (f && typeof f.type === 'string' && f.type.startsWith('video/')) return true;
  const e = fileExt(f && f.name);
  return SUPPORTED_EXTS.includes(e) || UNPLAYABLE_EXTS.includes(e);
}

// MIME que se le declara al servidor. Un file.type raro (video/x-matroska) no
// sirve: manda el de la extensión cuando la conocemos.
export function guessMime(f) {
  const e = fileExt(f && f.name);
  if (EXT_MIME[e]) return EXT_MIME[e];
  if (f && typeof f.type === 'string' && EXT_MIME[extOfMime(f.type)]) return f.type;
  return 'video/mp4';
}
function extOfMime(mime) {
  const m = String(mime || '').toLowerCase();
  for (const [e, mm] of Object.entries(EXT_MIME)) if (mm === m) return e;
  return '';
}

// ¿El servidor lo va a rechazar? (mismo criterio que MKT_VIDEO_MIMES del Worker)
export function isUploadableFormat(f) {
  const e = fileExt(f && f.name);
  if (SUPPORTED_EXTS.includes(e)) return true;
  if (UNPLAYABLE_EXTS.includes(e)) return false;
  // Sin extensión conocida: confiar en el MIME del sistema.
  return !!extOfMime(f && f.type);
}

// ── HEVC / H.265 ────────────────────────────────────────────────────────────
// El archivo sube y se guarda PERFECTO, pero Chrome/Android no decodifica HEVC:
// el cliente ve el video EN NEGRO (en iPhone/Safari sí se ve). Es el mismo códec
// que hace que Meta Ads rechace los reels exportados de CapCut en 4K.
// Detección barata y local (no se sube nada para detectarlo):
//   1) extensión .hevc
//   2) las marcas 'hvc1'/'hev1'/'dvh1'/'dvhe'/'hvcC' dentro del contenedor.
// Se miran los primeros 512KB y los últimos 512KB porque el índice (moov) del
// .mov del iPhone va AL FINAL del archivo.
const HEVC_TAGS = ['hvc1', 'hev1', 'dvh1', 'dvhe', 'hvcC'];
const SNIFF_BYTES = 512 * 1024;

const HEVC_TAG_BYTES = HEVC_TAGS.map((t) => [t.charCodeAt(0), t.charCodeAt(1), t.charCodeAt(2), t.charCodeAt(3)]);
const HEVC_FIRST = new Set(HEVC_TAG_BYTES.map((t) => t[0])); // 'h' y 'd': filtro rápido

// Busca la marca EXIGIENDO que venga precedida de un tamaño de caja plausible
// (así es una caja MP4/MOV de verdad y no 4 letras sueltas dentro del video).
function hasHevcTag(bytes) {
  const n = bytes.length - 4;   // ultima posicion valida: se leen bytes[i..i+3]
  for (let i = 4; i <= n; i++) {
    if (!HEVC_FIRST.has(bytes[i])) continue;
    for (const t of HEVC_TAG_BYTES) {
      if (bytes[i] !== t[0] || bytes[i + 1] !== t[1] || bytes[i + 2] !== t[2] || bytes[i + 3] !== t[3]) continue;
      const size = bytes[i - 4] * 16777216 + bytes[i - 3] * 65536 + bytes[i - 2] * 256 + bytes[i - 1];
      if (size >= 8 && size <= 4 * 1024 * 1024) return true;
    }
  }
  return false;
}

// Recorre las cajas de NIVEL SUPERIOR del MP4/MOV leyendo solo los 16 bytes de
// cada cabecera hasta encontrar 'moov' (el indice, donde vive la marca del
// codec). En los .mov del iPhone y en todo lo que no sea "faststart" el moov va
// AL FINAL, y en grabaciones largas pesa mas que la ventana de cola -> mirar
// solo la cabeza y los ultimos 512KB dejaba pasar videos HEVC sin avisar.
const MOOV_MAX_READ = 8 * 1024 * 1024;  // cuanto del moov se llega a leer
async function findMoovBox(file, size) {
  let off = 0;
  for (let guard = 0; guard < 64 && off + 8 <= size; guard++) {
    const hdr = new Uint8Array(await file.slice(off, Math.min(off + 16, size)).arrayBuffer());
    if (hdr.length < 8) return null;
    let boxSize = hdr[0] * 16777216 + hdr[1] * 65536 + hdr[2] * 256 + hdr[3];
    const type = String.fromCharCode(hdr[4], hdr[5], hdr[6], hdr[7]);
    let headerLen = 8;
    if (boxSize === 1) {
      if (hdr.length < 16) return null;
      // largesize de 64 bits: solo importan los 6 bytes bajos (nada pesa 2^48).
      boxSize = 0;
      for (let i = 10; i < 16; i++) boxSize = boxSize * 256 + hdr[i];
      headerLen = 16;
    } else if (boxSize === 0) {
      boxSize = size - off;                      // "hasta el final del archivo"
    }
    if (!/^[\x20-\x7e]{4}$/.test(type)) return null;   // no parece MP4/MOV
    if (type === 'moov') return { start: off + headerLen, end: Math.min(off + boxSize, size) };
    if (boxSize < headerLen) return null;              // cabecera corrupta
    off += boxSize;
  }
  return null;
}

export async function looksLikeHevc(file) {
  try {
    if (fileExt(file && file.name) === 'hevc') return true;
    if (/hvc1|hev1/i.test(String((file && file.type) || ''))) return true;
    if (!file || typeof file.slice !== 'function') return false;
    const size = file.size || 0;
    const head = new Uint8Array(await file.slice(0, Math.min(SNIFF_BYTES, size)).arrayBuffer());
    if (hasHevcTag(head)) return true;
    // Cola: desde SNIFF_BYTES (para no releer la cabeza) hasta el final. Antes se
    // exigia size > 512KB*2, asi que un clip de 800KB NUNCA se revisaba por la
    // cola — justo donde el iPhone deja el indice.
    if (size > SNIFF_BYTES) {
      const from = Math.max(SNIFF_BYTES, size - SNIFF_BYTES);
      const tail = new Uint8Array(await file.slice(from, size).arrayBuffer());
      if (hasHevcTag(tail)) return true;
    }
    // Ultimo intento: ubicar el moov y leerlo de verdad (grabaciones largas).
    const moov = await findMoovBox(file, size);
    if (moov && moov.end > moov.start) {
      const end = Math.min(moov.end, moov.start + MOOV_MAX_READ);
      const box = new Uint8Array(await file.slice(moov.start, end).arrayBuffer());
      if (hasHevcTag(box)) return true;
    }
  } catch { /* si no se puede leer, no se avisa nada: es sólo un aviso */ }
  return false;
}

// ── Revisión previa ─────────────────────────────────────────────────────────
// Clasifica los archivos ANTES de subir nada. Devuelve:
//   ok          -> se pueden subir
//   noVideo     -> ni siquiera son video
//   unplayable  -> son video pero ningún navegador los reproduce (el servidor los rechaza)
//   hevc        -> subirán bien, pero se verán negros en Android/Chrome (AVISO)
export async function screenVideoFiles(fileList) {
  const all = [...(fileList || [])];
  const out = { ok: [], noVideo: [], unplayable: [], hevc: [] };
  for (const f of all) {
    if (!isVideoFile(f)) { out.noVideo.push(f); continue; }
    if (!isUploadableFormat(f)) { out.unplayable.push(f); continue; }
    out.ok.push(f);
  }
  // El olfateo de HEVC lee trozos del disco: en PARALELO para no dejar la
  // pantalla muda varios segundos cuando se sueltan 10-15 reels de golpe.
  const flags = await Promise.all(out.ok.map((f) => looksLikeHevc(f)));
  out.hevc = out.ok.filter((_, i) => flags[i]);
  return out;
}

function names(files, max = 3) {
  const n = files.map((f) => f.name);
  return n.length > max ? `${n.slice(0, max).join(', ')} (+${n.length - max})` : n.join(', ');
}

export function msgUnplayable(files) {
  return T(
    `${files.length === 1 ? 'Ese formato no se puede' : 'Esos formatos no se pueden'} reproducir en la web (${names(files)}). Expórtalo en MP4 (H.264) y vuelve a subirlo.`,
    `${files.length === 1 ? 'That format cannot' : 'Those formats cannot'} be played on the web (${names(files)}). Export it as MP4 (H.264) and upload it again.`
  );
}

// AVISO de HEVC — no bloquea: ella decide. Texto accionable (es el mismo problema
// que hace que Meta Ads rechace los reels de CapCut en 4K).
export function msgHevc(files) {
  return T(
    `Atención: ${files.length === 1 ? `"${files[0].name}" está` : `${files.length} videos están`} en HEVC / H.265.\n\n`
      + 'Se sube y se guarda perfecto, pero en Android y Chrome el cliente lo verá EN NEGRO (solo se ve bien en iPhone/Safari). '
      + 'Es el mismo códec que hace que Meta Ads rechace los reels.\n\n'
      + 'Lo recomendable: volver a exportarlo en H.264 desde CapCut.\n\n'
      + '¿Subirlo así de todos modos?',
    `Heads up: ${files.length === 1 ? `"${files[0].name}" is` : `${files.length} videos are`} HEVC / H.265.\n\n`
      + 'It uploads and stores perfectly, but on Android and Chrome the client will see it BLACK (it only plays on iPhone/Safari). '
      + 'It is the same codec that makes Meta Ads reject reels.\n\n'
      + 'Recommended: re-export it as H.264 from CapCut.\n\n'
      + 'Upload it anyway?'
  );
}

// ── Subida por partes ───────────────────────────────────────────────────────
// `base` es la ruta del recurso SIN el prefijo /api/marketing, por ejemplo
// '/deliverables/<id>/video' o '/posts/<id>/video'. Las 3 llamadas
// (start/part/complete) son las mismas para los dos.

// Sube UNA parte con XMLHttpRequest (fetch no expone progreso de subida).
function xhrPutPart(base, uploadId, ext, partNumber, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = `uploadId=${encodeURIComponent(uploadId)}&ext=${encodeURIComponent(ext)}&part=${partNumber}`;
    xhr.open('PUT', `/api/marketing${base}/multipart/part?${qs}`);
    xhr.withCredentials = true;

    // WATCHDOG (auditoría 2026-07-31): una conexión medio-muerta (elevador,
    // túnel) dejaba la barra clavada en "Subiendo… 47%" PARA SIEMPRE, con la
    // zona de arrastre bloqueada. Si pasan 45s sin un solo byte nuevo, se corta
    // y el reintento normal se hace cargo.
    let watchdog = null;
    const armar = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        try { xhr.abort(); } catch { /* noop */ }
        const e = new Error(T('La subida se quedó sin avanzar.', 'The upload stalled.'));
        e.stalled = true;
        reject(e);
      }, 45000);
    };
    const desarmar = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };
    armar();

    xhr.upload.onprogress = (e) => { armar(); if (e.lengthComputable && onProgress) onProgress(e.loaded); };
    xhr.onload = () => {
      desarmar();
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error(T('Respuesta inválida del servidor.', 'Invalid server response.'))); }
      } else {
        let m = T('Error al subir una parte del video.', 'Error uploading a part of the video.');
        try { m = JSON.parse(xhr.responseText).error || m; } catch { /* noop */ }
        const err = new Error(m);
        err.status = xhr.status; // para NO reintentar 4xx (sesión caduca, etc.)
        reject(err);
      }
    };
    xhr.onerror = () => { desarmar(); reject(new Error(T('Se cortó la conexión durante la subida.', 'The connection dropped during the upload.'))); };
    xhr.send(blob);
  });
}

// Espera a que el navegador vuelva a estar en línea (máx `ms`). Sin esto, los
// reintentos se gastaban los 4 intentos en 5 segundos dentro de un túnel y se
// abortaba la subida completa de un reel de cientos de MB.
function esperarConexion(ms = 60000) {
  if (navigator.onLine !== false) return Promise.resolve();
  return new Promise((res) => {
    const t = setTimeout(fin, ms);
    function fin() { clearTimeout(t); window.removeEventListener('online', fin); res(); }
    window.addEventListener('online', fin);
  });
}

// Sube UNA parte con reintentos (cubre cortes/blips de red sin perder el archivo).
// Auditoría 2026-07-31: (a) 5 intentos con espera creciente hasta 24s (antes 4
// en ~5s: un bache de 30-60s de señal mataba la subida entera); (b) espera a
// recuperar conexión antes de cada reintento; (c) NO reintenta errores 4xx
// (sesión caducada, archivo rechazado): reintentarlos 4 veces solo hacía perder
// tiempo y mostraba el mensaje equivocado.
async function putPartWithRetry(base, uploadId, ext, partNumber, blob, onProgress, attempts = 5) {
  let lastErr;
  for (let a = 0; a < attempts; a++) {
    try { return await xhrPutPart(base, uploadId, ext, partNumber, blob, onProgress); }
    catch (e) {
      lastErr = e;
      if (e && e.status >= 400 && e.status < 500) throw e; // no tiene caso reintentar
      if (a < attempts - 1) {
        await esperarConexion();
        await new Promise((res) => setTimeout(res, Math.min(24000, 1500 * Math.pow(2, a))));
      }
    }
  }
  throw lastErr;
}

// Sube un File/Blob COMPLETO por partes. onProgress(pct 0-100).
// `api` se recibe por parámetro para no crear una dependencia circular entre
// módulos: cada vista pasa el suyo (el mismo de ../api.js).
export async function multipartUpload(api, base, src, onProgress) {
  const start = await api.post(`${base}/multipart/start`, { mime: guessMime(src) });
  const { uploadId, ext } = start;
  const total = src.size;
  const numParts = Math.max(1, Math.ceil(total / CHUNK_BYTES));
  const doneParts = new Array(numParts);
  const partLoaded = new Array(numParts).fill(0);
  const bump = () => {
    const sum = partLoaded.reduce((a, b) => a + b, 0);
    if (onProgress) onProgress(Math.min(99, Math.round((sum / total) * 100)));
  };
  let nextPart = 0; let aborted = false;
  const worker = async () => {
    while (!aborted) {
      const i = nextPart++;
      if (i >= numParts) return;
      const from = i * CHUNK_BYTES;
      const blob = src.slice(from, Math.min(from + CHUNK_BYTES, total));
      let r;
      try { r = await putPartWithRetry(base, uploadId, ext, i + 1, blob, (n) => { partLoaded[i] = n; bump(); }); }
      catch (e) { aborted = true; throw e; }
      // ⚠️ CRÍTICO: el servidor devuelve cuántos bytes GUARDÓ de verdad. Si no
      // coinciden con los del trozo, el archivo llegó cortado (típico: el archivo
      // cambió en disco a media subida — re-exportar de CapCut sobre el mismo
      // nombre, o un archivo que aún se está sincronizando de iCloud/Drive).
      // Aquí se corta ANTES de llamar a "complete": ensamblar escribe encima del
      // video que el cliente ya tiene, así que un video cortado que llega a
      // ensamblarse DESTRUYE el anterior. Cortando aquí, la subida se cancela y
      // el video anterior no se toca ni un byte.
      if (r && Number.isFinite(Number(r.size)) && Number(r.size) !== blob.size) {
        aborted = true;
        throw new Error(T(
          'El archivo cambió mientras se subía y llegó cortado, así que se canceló. El video anterior sigue intacto — vuelve a intentarlo sin tocar el archivo.',
          'The file changed while uploading and arrived truncated, so it was cancelled. The previous video is untouched — try again without touching the file.'
        ));
      }
      partLoaded[i] = blob.size; bump();
      doneParts[i] = { partNumber: i + 1, etag: r.etag };
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(UP_LANES, numParts) }, worker));
  } catch (e) {
    // Se cortó la subida: hay que CANCELARLA en R2. Si no, las partes ya subidas
    // se quedan guardadas, invisibles y facturándose (un 4K a medias = >1 GB).
    try { await api.post(`${base}/multipart/abort`, { uploadId, ext }); } catch { /* noop */ }
    throw e;
  }
  // `size` es la RED DE SEGURIDAD: el servidor compara el tamaño ensamblado con
  // el original y rechaza el video si quedó cortado (antes se daba por bueno).
  // Timeout largo: ensamblar cientos de partes puede pasar de 30s y abortarlo
  // hacía que se resubiera el video ENTERO aunque el servidor lo terminara bien.
  const res = await api.post(
    `${base}/multipart/complete`,
    { uploadId, ext, parts: doneParts, size: total },
    { timeout: 180000 }
  );
  if (onProgress) onProgress(100);
  return res;
}
