// ============================================================================
// IVAE Marketing — Vista "Entregables" (contenido final para el cliente).
// El equipo (staff) sube REELS (arrastrar/soltar -> R2, calidad original) y
// agrega CARRUSELES por link. El CLIENTE de la marca ve cada reel con
// reproductor + boton Descargar, y los carruseles como boton "Ver carrusel"
// (abre el link, nunca el link crudo). Todo agrupado por mes.
// Backend: GET/POST /deliverables · POST/GET /deliverables/:id/video · DELETE.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202606241300';
import { icon } from '../shell/icons.js?v=202606241300';

const VIEW_ID = 'entregables';
const MAX_VIDEO_MB = 3000;             // tope de cordura (~3GB); el video se sube por partes
const CHUNK_BYTES = 50 * 1024 * 1024;  // ~50MB por parte (bajo el limite de 100MB/request del Worker)
const UP_LANES = 3;                    // partes subiendo a la vez (paraleliza la subida)
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let ctx = null;
let rootEl = null;
let unsubs = [];
let items = [];
let loading = false;
let busy = false;
let addMonth = '';          // 'YYYY-MM' al que se agregan nuevos entregables
let lastClientId = null;
let uploadPct = 0;          // progreso de subida (0-100)
let progressEls = null;     // refs vivos de la barra (se actualizan sin re-render)
let queueInfo = null;       // { index, total } al subir varios reels en fila

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function monthLabel(ym) { const [y, m] = String(ym).split('-').map(Number); return `${(MES[(m || 1) - 1] || '').toUpperCase()} ${y}`; }

function activeClient() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: 'Marca' };
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/entregables.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/entregables.css?v=202606241300';
  document.head.appendChild(link);
}

async function load() {
  const client = activeClient();
  if (!client) { items = []; render(); return; }
  loading = true; render();
  try {
    const res = await api.get(`/deliverables?client_id=${encodeURIComponent(client.id)}`);
    items = (res && res.deliverables) || [];
  } catch (e) {
    items = [];
    toast(e.message || 'No se pudieron cargar los entregables', 'error');
  }
  loading = false;
  render();
}

// ── Acciones (staff) ─────────────────────────────────────────────────────────
// Actualiza la barra de progreso en vivo (sin re-render, para no perder fluidez).
function updateProgressUI() {
  if (!progressEls) return;
  progressEls.fill.style.width = uploadPct + '%';
  const q = (queueInfo && queueInfo.total > 1) ? `(${queueInfo.index}/${queueInfo.total}) ` : '';
  progressEls.label.textContent = uploadPct >= 100 ? `${q}Procesando…` : `${q}Subiendo… ${uploadPct}%`;
}

// Sube UNA parte con XMLHttpRequest (fetch no expone progreso de subida).
function xhrPutPart(id, uploadId, ext, partNumber, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = `uploadId=${encodeURIComponent(uploadId)}&ext=${encodeURIComponent(ext)}&part=${partNumber}`;
    xhr.open('PUT', `/api/marketing/deliverables/${id}/video/multipart/part?${qs}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Respuesta inválida del servidor.')); }
      } else {
        let m = 'Error al subir una parte del video.';
        try { m = JSON.parse(xhr.responseText).error || m; } catch { /* noop */ }
        reject(new Error(m));
      }
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión durante la subida.'));
    xhr.send(blob);
  });
}

// Captura un cuadro del video (en el cliente) como miniatura JPEG. Best-effort:
// si falla (p.ej. iOS al subir), devuelve null y la tarjeta usa el 1er cuadro.
function generatePoster(file) {
  return new Promise((resolve) => {
    let done = false; let url;
    const finish = (v) => { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch { /* noop */ } resolve(v); };
    try {
      const v = document.createElement('video');
      url = URL.createObjectURL(file);
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.onloadeddata = () => { const t = Math.min(0.6, (v.duration || 1) / 3); try { v.currentTime = (isFinite(t) && t > 0) ? t : 0; } catch { finish(null); } };
      v.onseeked = () => {
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) return finish(null);
          const scale = Math.min(1, 720 / Math.max(w, h));
          const cw = Math.round(w * scale), ch = Math.round(h * scale);
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(v, 0, 0, cw, ch);
          c.toBlob((b) => finish(b), 'image/jpeg', 0.72);
        } catch { finish(null); }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000); // timeout de seguridad
    } catch { finish(null); }
  });
}

// COLA de subida. Todo lo que arrastres o elijas se ENCOLA y se sube uno tras otro
// (encolar, no paralelizar, evita saturar la conexión). Si sueltas/eliges MÁS mientras
// otra subida sigue en curso, se AGREGAN a la fila en vez de ignorarse — así funciona
// igual si arrastras varios de golpe o de uno en uno.
let uploadQueue = [];   // Files pendientes de subir
let draining = false;   // hay un drenado de la cola en curso

function enqueueReels(fileList) {
  const all = [...(fileList || [])];
  const vids = all.filter((f) => f.type && f.type.startsWith('video/'));
  const skipped = all.length - vids.length;
  if (!vids.length) { toast('Ninguno de esos archivos es un video.', 'error'); return; }
  uploadQueue.push(...vids);
  if (skipped > 0) toast(`${skipped} no ${skipped > 1 ? 'eran' : 'era'} video y se ${skipped > 1 ? 'omitieron' : 'omitió'}.`, 'info', 4000);
  if (draining) { toast(`+${vids.length} en la fila`, 'info', 2500); return; } // ya hay subida en curso: solo encola
  drainQueue();
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  let processed = 0; let failed = 0;
  try {
    while (uploadQueue.length) {
      const file = uploadQueue.shift();
      processed += 1;
      let ok = false;
      // try/catch propio: un throw NUNCA debe abandonar el resto de la fila.
      try { ok = await uploadReel(file, { index: processed, total: processed + uploadQueue.length }); }
      catch { ok = false; }
      if (!ok) failed += 1;
    }
  } finally {
    draining = false; queueInfo = null;
    if (processed > 1) { try { await load(); } catch { /* recarga best-effort */ } }
    if (failed > 0) toast(`${failed > 1 ? `${failed} reels no se pudieron` : '1 reel no se pudo'} subir.`, 'error', 5000);
  }
}

async function uploadReel(file, qinfo) {
  const client = activeClient();
  if (!client || busy) return false;
  if (!file.type || !file.type.startsWith('video/')) { toast(`"${file.name}" no es un video.`, 'error'); return false; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast(`"${file.name}" es enorme (más de 3 GB). Compártelo por link mejor.`, 'error', 6000); return false; }
  busy = true; uploadPct = 0; queueInfo = qinfo || null; render();
  let created = null;
  try {
    created = await api.post('/deliverables', {
      client_id: client.id, month: addMonth || currentMonth(), type: 'reel',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    // 1) iniciar subida multipart
    const start = await api.post(`/deliverables/${created.id}/video/multipart/start`, { mime: file.type });
    const { uploadId, ext } = start;
    // 2) subir las partes (~50MB) EN PARALELO (hasta UP_LANES a la vez). En serie la
    //    conexión se estanca un round-trip entre parte y parte; en paralelo se mantiene
    //    llena -> sube notablemente más rápido. R2 ensambla por partNumber sin importar el orden.
    const total = file.size;
    const numParts = Math.max(1, Math.ceil(total / CHUNK_BYTES));
    const doneParts = new Array(numParts);
    const partLoaded = new Array(numParts).fill(0);
    const bumpUp = () => {
      const sum = partLoaded.reduce((a, b) => a + b, 0);
      uploadPct = Math.min(99, Math.round((sum / total) * 100));
      updateProgressUI();
    };
    let nextPart = 0; let upAborted = false;
    const upWorker = async () => {
      while (!upAborted) {
        const i = nextPart++;
        if (i >= numParts) return;
        const from = i * CHUNK_BYTES;
        const blob = file.slice(from, Math.min(from + CHUNK_BYTES, total));
        let r;
        try { r = await xhrPutPart(created.id, uploadId, ext, i + 1, blob, (n) => { partLoaded[i] = n; bumpUp(); }); }
        catch (e) { upAborted = true; throw e; }
        partLoaded[i] = blob.size; bumpUp();
        doneParts[i] = { partNumber: i + 1, etag: r.etag };
      }
    };
    await Promise.all(Array.from({ length: Math.min(UP_LANES, numParts) }, upWorker));
    // 3) ensamblar en R2
    await api.post(`/deliverables/${created.id}/video/multipart/complete`, { uploadId, ext, parts: doneParts });
    uploadPct = 100; updateProgressUI();
    // 4) miniatura (best-effort): capturar un cuadro y subirlo como poster
    try {
      const posterBlob = await generatePoster(file);
      if (posterBlob) {
        const pf = new FormData(); pf.append('poster', posterBlob, 'poster.jpg');
        await fetch(`/api/marketing/deliverables/${created.id}/poster`, { method: 'POST', credentials: 'same-origin', body: pf });
      }
    } catch { /* sin poster: la tarjeta usa el primer cuadro del video */ }
    toast((queueInfo && queueInfo.total > 1) ? `Subido ${queueInfo.index}/${queueInfo.total} ✓` : 'Reel subido ✓', 'success');
    if (!qinfo || qinfo.total <= 1) await load(); // en lote, drainQueue recarga 1 sola vez al final
    return true;
  } catch (e) {
    if (created) { try { await api.del(`/deliverables/${created.id}`); } catch { /* limpia el registro huerfano */ } }
    toast(e.message || 'No se pudo subir el reel', 'error');
    return false;
  } finally {
    busy = false; uploadPct = 0; progressEls = null; render();
  }
}

async function addCarrusel(link, title) {
  const client = activeClient();
  if (!client || busy) return;
  const url = String(link || '').trim();
  if (!/^https?:\/\//i.test(url)) { toast('Pega un link válido (que empiece con http).', 'error'); return; }
  busy = true; render();
  try {
    await api.post('/deliverables', {
      client_id: client.id, month: addMonth || currentMonth(), type: 'carrusel',
      link: url, title: (title || '').trim().slice(0, 200) || null,
    });
    toast('Carrusel agregado ✓', 'success');
    await load();
  } catch (e) {
    toast(e.message || 'No se pudo agregar el carrusel', 'error');
  } finally {
    busy = false; render();
  }
}

async function removeItem(it) {
  if (busy) return;
  const what = it.type === 'reel' ? 'este reel' : 'este carrusel';
  if (!window.confirm(`¿Eliminar ${what}? No se puede deshacer.`)) return;
  busy = true; render();
  try {
    await api.del(`/deliverables/${it.id}`);
    items = items.filter((x) => x.id !== it.id);
    toast('Eliminado', 'info');
  } catch (e) {
    toast(e.message || 'No se pudo eliminar', 'error');
  } finally {
    busy = false; render();
  }
}

// Descargar/guardar un reel. En MÓVIL usa el menú nativo de Compartir
// (navigator.share con archivo) -> el usuario toca "Guardar video" (iOS Fotos)
// o "Guardar en Archivos". En ESCRITORIO descarga directa por enlace.
const TYPE_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg', 'video/3gpp': '3gp' };
const fileCache = new Map(); // it.id -> File ya en memoria (para 2º toque instantáneo en iOS Safari)

function linkDownload(it) {
  const a = document.createElement('a');
  a.href = it.video_url + '?download=1';
  a.download = String(it.title || 'reel');
  document.body.appendChild(a); a.click(); a.remove();
}

// Descarga UN tramo (Range) como ArrayBuffer.
const DL_LANES = 3;                 // tramos bajando a la vez
const DL_CHUNK = 8 * 1024 * 1024;   // 8MB por tramo
function fetchRange(url, start, end, onLoaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.withCredentials = true;
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
    xhr.onprogress = (e) => { if (onLoaded) onLoaded(e.loaded); };
    xhr.onload = () => {
      if (xhr.status === 206 || xhr.status === 200) resolve({ buf: xhr.response, status: xhr.status, xhr });
      else reject(new Error('No se pudo descargar el video.'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión al descargar.'));
    xhr.send();
  });
}

// Descarga el video como Blob con progreso. Baja en VARIOS TRAMOS en paralelo y los
// rearma -> más rápido que una sola descarga (que se estanca). Si el servidor no
// soporta rangos (200) o el archivo es chico, cae a una sola descarga. onProgress(pct).
async function fetchVideoBlob(it, onProgress) {
  const url = it.video_url;
  // 1) primer tramo: trae el inicio y revela tamaño total + soporte de rangos.
  const first = await fetchRange(url, 0, DL_CHUNK - 1);
  const ctype = first.xhr.getResponseHeader('Content-Type') || 'video/mp4';
  const cr = first.xhr.getResponseHeader('Content-Range') || '';
  const m = cr.match(/\/(\d+)\s*$/);
  const total = (first.status === 206 && m) ? Number(m[1]) : 0;
  if (first.status !== 206 || !total || total <= first.buf.byteLength) {
    if (onProgress) onProgress(100);
    return new Blob([first.buf], { type: ctype }); // sin rangos o archivo chico: ya está todo
  }
  // 2) bajar el resto en paralelo (hasta DL_LANES tramos a la vez) y rearmar en orden.
  const numChunks = Math.ceil(total / DL_CHUNK);
  const buffers = new Array(numChunks); buffers[0] = first.buf;
  const loaded = new Array(numChunks).fill(0); loaded[0] = first.buf.byteLength;
  const bump = () => { if (onProgress) onProgress(Math.min(99, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100))); };
  bump();
  let next = 1; let aborted = false;
  const worker = async () => {
    while (!aborted) {
      const i = next++;
      if (i >= numChunks) return;
      const start = i * DL_CHUNK;
      const end = Math.min(start + DL_CHUNK, total) - 1;
      let res;
      try { res = await fetchRange(url, start, end, (n) => { loaded[i] = n; bump(); }); }
      catch (e) { aborted = true; throw e; }
      buffers[i] = res.buf; loaded[i] = (end - start + 1); bump();
    }
  };
  await Promise.all(Array.from({ length: Math.min(DL_LANES, numChunks - 1) }, worker));
  if (onProgress) onProgress(100);
  return new Blob(buffers, { type: ctype });
}
function fileFromBlob(it, blob) {
  const ext = TYPE_EXT[String(blob.type || '').toLowerCase()] || 'mp4';
  const fname = (String(it.title || 'reel').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'reel') + '.' + ext;
  return new File([blob], fname, { type: blob.type || 'video/mp4' });
}

// Guardar al teléfono. iPhone Safari (iOS16+)/Android: menú nativo de Compartir
// (navigator.share con archivo -> "Guardar video" en Fotos / "Guardar en Archivos").
// iOS exige que share() salga JUSTO tras el toque; si el video es grande, la descarga
// consume ese permiso -> cacheamos el archivo y el 2º toque lo comparte al instante.
// Escritorio (sin la API): descarga directa por enlace.
async function saveVideo(it, btn) {
  if (!(navigator.canShare && navigator.share)) { linkDownload(it); return; }
  const label = btn ? btn.querySelector('span:not(.ico)') : null; // la etiqueta, NO el <span class="ico">
  const setLabel = (t) => { if (label) label.textContent = t; };
  const resetBtn = () => { if (btn) btn.classList.remove('dlv-dl--ready'); setLabel('Descargar'); };

  // 2º toque (archivo ya en memoria): compartir SINCRONO -> activación fresca, no falla.
  const cached = fileCache.get(it.id);
  if (cached) {
    try { await navigator.share({ files: [cached], title: it.title || 'Reel' }); fileCache.delete(it.id); resetBtn(); }
    catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú: deja el botón armado
      // Falló el menú: CONSERVAMOS el archivo (no lo re-bajamos) y dejamos el botón
      // armado para reintentar con un toque (en iOS un <a download> no guardaría nada).
      toast('No se abrió el menú para guardar. Toca el botón otra vez.', 'error', 5000);
    }
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setLabel('Preparando… 0%');
    const blob = await fetchVideoBlob(it, (pct) => setLabel(`Preparando… ${pct}%`));
    const file = fileFromBlob(it, blob);
    if (!navigator.canShare({ files: [file] })) { linkDownload(it); return; }
    try {
      await navigator.share({ files: [file], title: it.title || 'Reel' });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú
      // iOS: la descarga consumió el permiso del toque. Dejamos el archivo LISTO y
      // ARMAMOS un 2º toque muy claro (botón resaltado) -> ahí sí abre "Guardar en el teléfono".
      fileCache.set(it.id, file);
      if (btn) btn.classList.add('dlv-dl--ready');
      setLabel('Toca para guardar');
      toast('Tu video ya está listo ✓ — toca otra vez el botón resaltado para guardarlo en tu teléfono.', 'info', 8000);
      return;
    }
  } catch (e) {
    linkDownload(it);
  } finally {
    if (btn) btn.disabled = false;
    if (label && /Preparando/.test(label.textContent)) resetBtn();
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function buildAddBar() {
  if (!addMonth) addMonth = currentMonth();
  const monthInput = el('input', {
    class: 'dlv-month', type: 'month', value: addMonth, 'aria-label': 'Mes de los entregables',
    onchange: (e) => { addMonth = e.target.value || currentMonth(); },
  });

  // Drop zone para reels
  const fileInput = el('input', {
    type: 'file', accept: 'video/*', multiple: true, class: 'dlv-fileinput', hidden: true,
    onchange: (e) => { enqueueReels(e.target.files); e.target.value = ''; },
  });
  let dropKids;
  if (busy) {
    // Barra de progreso (refs vivos -> updateProgressUI los actualiza sin re-render).
    const fill = el('div', { class: 'dlv-prog__fill' });
    fill.style.width = uploadPct + '%';
    const q = (queueInfo && queueInfo.total > 1) ? `(${queueInfo.index}/${queueInfo.total}) ` : '';
    const label = el('span', { class: 'dlv-drop__t dlv-prog__label', text: uploadPct >= 100 ? `${q}Procesando…` : `${q}Subiendo… ${uploadPct}%` });
    progressEls = { fill, label };
    dropKids = [
      icon('camera', 26),
      label,
      el('div', { class: 'dlv-prog' }, [fill]),
      el('span', { class: 'dlv-drop__s', text: 'No cierres esta pantalla mientras sube el video.' }),
    ];
  } else {
    dropKids = [
      icon('camera', 26),
      el('span', { class: 'dlv-drop__t', text: 'Arrastra un reel aquí o toca para elegir' }),
      el('span', { class: 'dlv-drop__s', text: 'Video MP4/MOV/WebM · calidad original · videos grandes OK (se suben por partes)' }),
      fileInput,
    ];
  }
  const drop = el('button', {
    class: 'dlv-drop' + (busy ? ' is-busy' : ''), type: 'button',
    onclick: busy ? null : () => fileInput.click(),
  }, dropKids);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('is-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) enqueueReels(e.dataTransfer.files);
  });

  // Agregar carrusel por link
  const linkInput = el('input', { class: 'dlv-input', type: 'url', placeholder: 'Link del carrusel (Drive, Dropbox, Instagram…)' });
  const titleInput = el('input', { class: 'dlv-input dlv-input--title', type: 'text', placeholder: 'Título (opcional)', maxlength: 200 });
  const addBtn = el('button', {
    class: 'dlv-addbtn', type: 'button', disabled: busy,
    onclick: () => { addCarrusel(linkInput.value, titleInput.value); linkInput.value = ''; titleInput.value = ''; },
  }, [icon('plus', 16), el('span', { text: 'Agregar carrusel' })]);

  return el('div', { class: 'dlv-addbar' }, [
    el('div', { class: 'dlv-addbar__row' }, [
      el('label', { class: 'dlv-addbar__lbl', text: 'Subir al mes:' }),
      monthInput,
    ]),
    drop,
    el('div', { class: 'dlv-carrusel-add' }, [linkInput, titleInput, addBtn]),
  ]);
}

// Tiempo relativo en español. created_at viene en UTC ('YYYY-MM-DD HH:MM:SS').
function relTime(iso) {
  if (!iso) return '';
  const s = String(iso);
  const t = Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'ahora';
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  if (sec < 7 * 86400) return `hace ${Math.floor(sec / 86400)} d`;
  return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

async function deleteComment(it, c, node) {
  if (!window.confirm('¿Eliminar este comentario?')) return;
  try {
    await api.del(`/deliverables/${it.id}/comments/${c.id}`);
    node.remove();
    it.comments = (it.comments || []).filter((x) => x.id !== c.id);
  } catch (e) { toast(e.message || 'No se pudo eliminar', 'error'); }
}

function commentEl(it, c, staff) {
  // Solo el texto del comentario. Para staff, una × discreta para borrarlo.
  const node = el('div', { class: 'dlv-comment' }, [
    el('p', { class: 'dlv-comment__body', text: c.body }),
    staff ? el('button', { class: 'dlv-comment__del', type: 'button', 'aria-label': 'Eliminar comentario' }, [icon('trash', 15)]) : null,
  ]);
  if (staff) { const d = node.querySelector('.dlv-comment__del'); if (d) d.addEventListener('click', () => deleteComment(it, c, node)); }
  return node;
}

// Sección de comentarios bajo cada entregable: el CLIENTE escribe los cambios que
// pide y el EQUIPO puede responder. Ambos pueden comentar.
function buildComments(it, staff) {
  const list = el('div', { class: 'dlv-comments__list' });
  const cs = it.comments || [];
  cs.forEach((c) => list.appendChild(commentEl(it, c, staff)));

  const input = el('textarea', {
    class: 'dlv-comment-input', rows: 1, maxlength: 4000, placeholder: 'Escribe un cambio o comentario…',
    oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px'; },
  });
  const send = el('button', { class: 'dlv-comment-send', type: 'button', text: 'Enviar' });
  const submit = async () => {
    const body = (input.value || '').trim();
    if (!body || send.disabled) return;
    send.disabled = true;
    try {
      const c = await api.post(`/deliverables/${it.id}/comments`, { body });
      it.comments = (it.comments || []).concat(c);
      const node = commentEl(it, c, staff);
      list.appendChild(node);
      input.value = ''; input.style.height = 'auto';
      node.scrollIntoView({ block: 'nearest' });
    } catch (e) { toast(e.message || 'No se pudo enviar', 'error'); }
    finally { send.disabled = false; }
  };
  send.addEventListener('click', submit);
  // Cmd/Ctrl+Enter envía (Enter solo hace salto de línea).
  input.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });

  return el('div', { class: 'dlv-comments' }, [
    list,
    el('div', { class: 'dlv-comment-form' }, [input, send]),
  ]);
}

function buildItem(it, staff) {
  if (it.type === 'reel') {
    const card = el('div', { class: 'dlv-card dlv-card--reel' });
    if (it.video_url) {
      card.appendChild(el('video', {
        class: 'dlv-video', src: it.video_url + '#t=0.1', poster: it.poster_url || null,
        controls: true, playsinline: true, preload: 'metadata',
      }));
    } else {
      card.appendChild(el('div', { class: 'dlv-video dlv-video--pending', text: 'Procesando…' }));
    }
    const foot = el('div', { class: 'dlv-card__foot' }, [
      el('span', { class: 'dlv-card__title', text: it.title || 'Reel' }),
      el('div', { class: 'dlv-card__actions' }, [
        it.video_url ? el('button', {
          class: 'dlv-dl', type: 'button', 'aria-label': 'Descargar reel',
          onclick: (e) => saveVideo(it, e.currentTarget),
        }, [icon('down', 16), el('span', { text: 'Descargar' })]) : null,
        staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': 'Eliminar', onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
      ]),
    ]);
    card.appendChild(foot);
    card.appendChild(buildComments(it, staff));
    return card;
  }
  // carrusel
  const card = el('div', { class: 'dlv-card dlv-card--carrusel' }, [
    el('div', { class: 'dlv-carrusel__ico' }, [icon('grip', 30)]),
    el('span', { class: 'dlv-card__title', text: it.title || 'Carrusel' }),
    el('div', { class: 'dlv-card__actions' }, [
      el('a', {
        class: 'dlv-carrusel-btn', href: it.link, target: '_blank', rel: 'noopener noreferrer',
      }, [icon('eye', 16), el('span', { text: 'Ver carrusel' })]),
      staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': 'Eliminar', onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
    ]),
  ]);
  card.appendChild(buildComments(it, staff));
  return card;
}

function render() {
  if (!rootEl) return;
  clear(rootEl);
  const staff = !isClient();
  const client = activeClient();

  if (!client) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('briefcase', 26)]),
      el('h3', { text: 'Elige una marca' }),
      el('p', { text: 'Selecciona un cliente arriba para ver o subir sus entregables.' }),
    ]));
    return;
  }

  rootEl.appendChild(el('div', { class: 'dlv-head' }, [
    el('h1', { class: 'dlv-h1', text: 'Entregables' }),
    el('p', { class: 'dlv-sub', text: staff ? 'Sube los reels finales y agrega los carruseles. El cliente los verá y podrá descargarlos.' : 'Aquí está tu contenido final, listo para ver y descargar.' }),
  ]));

  if (staff) rootEl.appendChild(buildAddBar());

  if (loading) {
    rootEl.appendChild(el('div', { class: 'dlv-loading' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'muted', text: 'Cargando entregables…' })]));
    return;
  }

  if (!items.length) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('camera', 26)]),
      el('h3', { text: staff ? 'Aún no hay entregables' : 'Todavía no hay contenido' }),
      el('p', { text: staff ? 'Arrastra un reel o agrega un carrusel arriba para empezar.' : 'En cuanto el equipo suba tu contenido, aparecerá aquí.' }),
    ]));
    return;
  }

  // Agrupar por mes (desc).
  const byMonth = new Map();
  for (const it of items) { if (!byMonth.has(it.month)) byMonth.set(it.month, []); byMonth.get(it.month).push(it); }
  const months = [...byMonth.keys()].sort().reverse();
  for (const m of months) {
    // Ordenar SIEMPRE por nombre, con orden numérico natural (2 < 11 < 12),
    // sin importar cuándo se subió cada uno (re-subir el 11 no lo manda al final).
    const list = byMonth.get(m).sort(
      (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es', { numeric: true, sensitivity: 'base' }),
    );
    const sec = el('section', { class: 'dlv-month-sec' }, [
      el('h2', { class: 'dlv-month-h' }, [
        el('span', { class: 'dlv-month-h__t', text: monthLabel(m) }),
        el('span', { class: 'dlv-month-h__n', text: String(list.length) }),
      ]),
      el('div', { class: 'dlv-grid' }, list.map((it) => buildItem(it, staff))),
    ]);
    rootEl.appendChild(sec);
  }
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    addMonth = currentMonth();
    rootEl = el('div', { class: 'dlv-root' });
    host.appendChild(rootEl);
    lastClientId = (ctx.store.getState().activeClientId) || null;
    unsubs.push(ctx.store.subscribe(['clients', 'activeClientId'], () => {
      const now = ctx.store.getState().activeClientId || null;
      if (now !== lastClientId) { lastClientId = now; load(); } else { render(); }
    }));
    render();
    load();
  },
  onParams() { load(); },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null; items = []; loading = false; busy = false;
  },
};
