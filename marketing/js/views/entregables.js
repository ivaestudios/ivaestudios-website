// ============================================================================
// IVAE Marketing — Vista "Entregables" (contenido final para el cliente).
// El equipo (staff) sube REELS (arrastrar/soltar -> R2, calidad original) y
// agrega CARRUSELES por link. El CLIENTE de la marca ve cada reel con
// reproductor + boton Descargar, y los carruseles como boton "Ver carrusel"
// (abre el link, nunca el link crudo). Todo agrupado por mes.
// Backend: GET/POST /deliverables · POST/GET /deliverables/:id/video · DELETE.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202608041802';
import { icon } from '../shell/icons.js?v=202608041802';
import { T } from '../shell/i18n.js?v=202608041802';
import { openSheet } from '../shell/sheet.js?v=202608041802';
// Tarjeta compartida "Error + Reintentar" (la misma de Inicio / Mi trabajo).
import { errorCard } from '../ui/states.js?v=202608041802';
// Todo lo de subir video (revisión previa de formato/HEVC + subida por partes)
// vive en UN solo módulo compartido con la columna "Video final" del calendario.
import {
  MAX_VIDEO_MB, isVideoFile, screenVideoFiles, msgUnplayable, msgHevc, multipartUpload,
} from '../lib/video-upload.js?v=202608041802';

const VIEW_ID = 'entregables';
const MES = T(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

let ctx = null;
let rootEl = null;
let unsubs = [];
let items = [];
let loading = false;
let loadErr = null;         // null | Error de la ÚLTIMA carga (para no confundir
                            // un fallo de red con "todavía no hay contenido")
let busy = false;
let addMonth = '';          // 'YYYY-MM' al que se agregan nuevos entregables
let lastClientId = null;
let uploadPct = 0;          // progreso de subida (0-100)
let progressEls = null;     // refs vivos de la barra (se actualizan sin re-render)
let queueInfo = null;       // { index, total } al subir varios reels en fila
let swapId = null;          // id del entregable al que se le está CAMBIANDO el video
let activeMonthNav = '';    // 'YYYY-MM' del mes visible (navegación por píldoras)
let dlAllBusy = false;      // "Descargar todos" en curso (evita dobles arranques)
let lastLoadAt = 0;         // cuándo se recargó la lista (para no recargar de más al volver)
// mes -> { file, index }: en móvil SÓLO se guarda UN reel a la vez en memoria
// (el que está esperando el toque para guardarse). Nunca el mes entero.
const dlAllCache = new Map();
// mes -> [títulos] de los reels que fallaron en la tanda actual. Un reel que
// falla YA NO tumba el lote: se sigue con el siguiente y al final se dice cuáles
// faltaron (antes había que volver a empezar desde el 1).
const dlAllFailed = new Map();
// mes -> reels que quedaron para una segunda tanda, cuando el lote completo
// pesaba demasiado para tenerlo entero en memoria.
const dlAllPendientes = new Map();

// ── Carga perezosa de videos (velocidad en móvil) ───────────────────────────
// Antes: CADA reel del mes creaba un <video preload="metadata"> que disparaba
// descargas de metadatos EN PARALELO (decenas de MB compitiendo) → los primeros
// videos tardaban. Ahora nacen con preload="none" (0 bytes de video) + póster;
// solo se "activan" (cargan metadatos / primer frame) al acercarse al viewport.
// El archivo COMPLETO se transmite intacto al reproducir — no se pierde calidad.
let vidObserver = null;
// Pide el primer cuadro como vista previa (#t=0.1). Es lo que se usa cuando NO
// hay miniatura propia: sin esto el reproductor se queda en negro.
function firstFramePreview(v) {
  if (v.src && !/#t=/.test(v.src)) { try { v.src = `${v.src}#t=0.1`; } catch { /* noop */ } }
}
function activateVideo(v) {
  if (!v || v.dataset.activated) return;
  v.dataset.activated = '1';
  // Si el usuario ya lo abrió/reproduce, NO tocar (load() lo reiniciaría).
  if (v.readyState >= 1 || !v.paused || v.currentTime > 0) return;
  v.preload = 'metadata';
  const poster = v.getAttribute('poster');
  if (!poster) firstFramePreview(v);
  else {
    // El póster puede NO existir (404): el servidor borra el póster viejo al
    // cambiar el video, y generarlo es best-effort (falla con HEVC y a veces en
    // iOS). Un <video> con póster roto se queda EN BLANCO y no avisa de nada,
    // así que se comprueba (mismo URL -> sale de la caché del navegador) y si no
    // está se quita el atributo y se cae al primer cuadro del video.
    const probe = new Image();
    probe.onerror = () => {
      try { v.removeAttribute('poster'); } catch { /* noop */ }
      firstFramePreview(v);
      try { v.load(); } catch { /* noop */ }
    };
    probe.src = poster;
  }
  try { v.load(); } catch { /* noop */ }
}
function observeVideo(v) {
  if (!('IntersectionObserver' in window)) { activateVideo(v); return; }
  if (!vidObserver) {
    vidObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { activateVideo(e.target); vidObserver.unobserve(e.target); }
      }
    }, { rootMargin: '200% 0px' });
  }
  vidObserver.observe(v);
}
function resetVideoObserver() {
  if (vidObserver) { try { vidObserver.disconnect(); } catch { /* noop */ } vidObserver = null; }
}

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function monthLabel(ym) { const [y, m] = String(ym).split('-').map(Number); return `${(MES[(m || 1) - 1] || '').toUpperCase()} ${y}`; }
// "Julio 2026" (para las píldoras de la barra de meses; el encabezado usa MAYÚSCULAS).
function monthTitle(ym) { const [y, m] = String(ym).split('-').map(Number); const n = MES[(m || 1) - 1] || ''; return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`; }

function activeClient() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: T('Marca', 'Brand') };
}

// Prender/apagar las descargas de ESTA marca. Solo staff llega aquí; el
// servidor vuelve a comprobarlo en cada intento de descarga.
async function toggleDescargas(btn) {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return;
  const brand = (clients || []).find((c) => c.id === activeClientId);
  if (!brand) return;
  const next = descargasActivas() ? 0 : 1;
  btn.disabled = true;
  try {
    const r = await fetch(`/api/marketing/clients/${activeClientId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloads_enabled: next }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || T('No se pudo guardar.', 'Could not save.'));
    // Salir de la pantalla mientras viaja el PATCH deja ctx en null (unmount
    // lo limpia): sin esta guardia truena en el try Y otra vez en el catch.
    if (!ctx || !rootEl) return;
    ctx.store.set({ clients: clients.map((c) => (c.id === activeClientId ? { ...c, downloads_enabled: next } : c)) });
    ctx.toast(next
      ? `${T('El cliente ya puede descargar el contenido de', 'The client can now download content for')} ${brand.name}.`
      : `${T('Descargas desactivadas para', 'Downloads turned off for')} ${brand.name}. ${T('Solo podrá verlo.', 'They can only view it.')}`,
      { type: 'success' });
    render();   // repinta: los botones de descarga aparecen o se van
  } catch (e) {
    if (ctx) ctx.toast(e.message || T('No se pudo guardar.', 'Could not save.'), { type: 'error' });
    btn.disabled = false;
  }
}

// ¿La marca activa permite que el cliente descargue? Ante la duda, SÍ: así una
// marca vieja (sin el campo) nunca pierde algo que ya tenía.
function descargasActivas() {
  if (!ctx) return true;
  const { activeClientId, clients } = ctx.store.getState();
  const c = (clients || []).find((x) => x.id === activeClientId);
  return !c || c.downloads_enabled == null || !!c.downloads_enabled;
}

// `clients` se carga UNA vez al arrancar la app. Si Vianey apaga las descargas
// mientras la clienta tiene la PWA abierta, esa pantalla se quedaba con el
// permiso viejo por días. Al ENTRAR a Entregables se vuelve a pedir: es el
// único momento en que ese dato importa.
async function refrescarPermisos() {
  try {
    const cl = await api.get('/clients');
    if (!ctx || !Array.isArray(cl)) return;
    ctx.store.set({ clients: cl });
  } catch { /* si falla, se queda con lo que había: nadie pierde la vista */ }
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/entregables.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/entregables.css?v=202608041802';
  document.head.appendChild(link);
}

async function load() {
  const client = activeClient();
  // El permiso de descarga puede haber cambiado desde que se abrió la app.
  // No se espera (no debe retrasar la lista); cuando llegue, repinta.
  if (isClient()) refrescarPermisos().then(() => { if (rootEl) render(); });
  dlAllCache.clear(); // los archivos armados de "Descargar todos" caducan al recargar la lista
  dlAllPendientes.clear();   // y la segunda tanda pendiente, si la había
  // ⚠️ fileCache está indexado por it.id, y con "Cambiar video" un MISMO id pasa a
  // tener OTROS bytes. Si no se suelta aquí, el 2º toque de "Descargar" en el
  // iPhone guardaría en el teléfono el reel VIEJO (el del eco) — y el sello ?v=
  // no lo cubre, porque es un File que ya está en la memoria del navegador.
  fileCache.clear();
  lastLoadAt = Date.now();
  if (!client) { items = []; loadErr = null; render(); return; }
  loading = true; render();
  try {
    const res = await api.get(`/deliverables?client_id=${encodeURIComponent(client.id)}`);
    items = (res && res.deliverables) || [];
    loadErr = null;
  } catch (e) {
    // items se VACÍA a propósito (son de UNA marca: dejar los viejos mostraría
    // los entregables del cliente anterior al cambiar de marca). Lo que ya no
    // se hace es pintar el vacío: con loadErr, render() saca la tarjeta de
    // error con Reintentar. El toast sobraría encima de la tarjeta.
    items = [];
    loadErr = e;
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
  progressEls.label.textContent = uploadPct >= 100 ? `${q}${T('Procesando…', 'Processing…')}` : `${q}${T('Subiendo…', 'Uploading…')} ${uploadPct}%`;
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

// Se revisa TODO antes de subir un solo byte: qué no es video, qué formato no
// reproduce ningún navegador (el servidor lo rechazaría al final de la subida) y
// qué viene en HEVC/H.265 (sube bien pero se ve negro en Android/Chrome).
async function enqueueReels(fileList) {
  const all = [...(fileList || [])];
  const { ok, noVideo, unplayable, hevc } = await screenVideoFiles(all);

  if (unplayable.length) toast(msgUnplayable(unplayable), 'error', 9000);
  const skipped = noVideo.length;
  if (skipped > 0) toast(T(`${skipped} no ${skipped > 1 ? 'eran' : 'era'} video y se ${skipped > 1 ? 'omitieron' : 'omitió'}.`, `${skipped} ${skipped > 1 ? 'were not videos and were skipped' : 'was not a video and was skipped'}.`), 'info', 4000);
  if (!ok.length) {
    if (!unplayable.length) toast(T('Ninguno de esos archivos es un video.', 'None of those files is a video.'), 'error');
    return;
  }
  // AVISO de HEVC: no bloquea, ella decide (Cancelar = no subir esos).
  let vids = ok;
  if (hevc.length && !window.confirm(msgHevc(hevc))) {
    vids = ok.filter((f) => !hevc.includes(f));
    if (!vids.length) return;
  }

  uploadQueue.push(...vids);
  // `busy` sin `draining` = hay un CAMBIO de video en curso (puede durar minutos).
  // Antes se arrancaba el drenado igual, uploadReel salía en seco por `busy` y los
  // archivos se DESCARTABAN con un "N reels no se subieron" falso. Ahora esperan
  // en la fila y swapVideo la drena al terminar.
  if (draining || busy) { toast(`+${vids.length} ${T('en la fila', 'in the queue')}`, 'info', 2500); return; }
  drainQueue();
}

async function drainQueue() {
  if (draining || busy) return;
  draining = true;
  let processed = 0; const failedNames = [];
  try {
    while (uploadQueue.length) {
      const file = uploadQueue.shift();
      processed += 1;
      const qinfo = { index: processed, total: processed + uploadQueue.length };
      // try/catch propio: un throw NUNCA debe abandonar el resto de la fila.
      let ok = false;
      try { ok = await uploadReel(file, qinfo); } catch { ok = false; }
      // Reintento automático del archivo completo (cubre fallos transitorios). uploadReel
      // borra el registro huérfano al fallar, así que el reintento arranca limpio (sin duplicar).
      if (!ok) { try { ok = await uploadReel(file, qinfo); } catch { ok = false; } }
      if (!ok) failedNames.push(file.name);
    }
  } finally {
    draining = false; queueInfo = null;
    if (processed > 1) { try { await load(); } catch { /* recarga best-effort */ } }
    if (failedNames.length) {
      const n = failedNames.length;
      toast(T(`${n === 1 ? '1 reel no se subió' : `${n} reels no se subieron`}: ${failedNames.join(', ')}. Vuelve a soltarlos para reintentar.`, `${n === 1 ? '1 reel failed to upload' : `${n} reels failed to upload`}: ${failedNames.join(', ')}. Drop them again to retry.`), 'error', 9000);
    }
  }
}

async function uploadReel(file, qinfo) {
  const client = activeClient();
  if (!client || busy) return false;
  if (!isVideoFile(file)) { toast(T(`"${file.name}" no es un video.`, `"${file.name}" is not a video.`), 'error'); return false; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast(T(`"${file.name}" es enorme (más de 3 GB). Compártelo por link mejor.`, `"${file.name}" is huge (over 3 GB). Better share it by link.`), 'error', 6000); return false; }
  busy = true; uploadPct = 0; queueInfo = qinfo || null; render();
  let created = null;
  const month = addMonth || currentMonth();
  try {
    created = await api.post('/deliverables', {
      client_id: client.id, month, type: 'reel',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    // Subir por partes en paralelo -> mantiene la conexión llena.
    await multipartUpload(api, `/deliverables/${created.id}/video`, file, (p) => { uploadPct = p; updateProgressUI(); });
    uploadPct = 100; updateProgressUI();
    // Miniatura (best-effort): capturar un cuadro del video.
    try {
      const posterBlob = await generatePoster(file);
      if (posterBlob) {
        const pf = new FormData(); pf.append('poster', posterBlob, 'poster.jpg');
        await fetch(`/api/marketing/deliverables/${created.id}/poster`, { method: 'POST', credentials: 'same-origin', body: pf });
      }
    } catch { /* sin poster: la tarjeta usa el primer cuadro del video */ }
    toast((queueInfo && queueInfo.total > 1) ? `${T('Subido', 'Uploaded')} ${queueInfo.index}/${queueInfo.total} ✓` : T('Reel subido ✓', 'Reel uploaded ✓'), 'success');
    activeMonthNav = month; // al subir, la vista te lleva al mes donde quedó el reel
    if (!qinfo || qinfo.total <= 1) await load(); // en lote, drainQueue recarga 1 sola vez al final
    return true;
  } catch (e) {
    if (created) { try { await api.del(`/deliverables/${created.id}`); } catch { /* limpia el registro huerfano */ } }
    toast(e.message || T('No se pudo subir el reel', 'Could not upload the reel'), 'error');
    return false;
  } finally {
    busy = false; uploadPct = 0; progressEls = null; render();
  }
}

// ── CAMBIAR VIDEO (solo staff) ───────────────────────────────────────────────
// El cliente pide un ajuste en los comentarios ("bajar el eco", "poner Dr.") y el
// equipo re-edita el reel. Antes la única forma de subir la corrección era BORRAR
// el entregable y crear otro — y al borrarlo se iban EN CASCADA los comentarios,
// así que se perdía el hilo de lo que se había pedido.
//
// Aquí el video se reemplaza sobre el MISMO id: la fila de mkt_deliverables no se
// toca (mismo título, mismo mes, mismo orden) y los comentarios, que cuelgan de
// ese id, siguen intactos. Se usa la MISMA subida por partes que un reel nuevo
// (lib/video-upload.js), que además NO borra el video anterior hasta que el nuevo
// está completo y verificado en el servidor.
//
// Texto del comentario automático que se publica al terminar. Firma sola: el
// backend lo guarda con el nombre y el rol de quien lo hizo.
// SIEMPRE en español, NO con T(): esto lo lee EL CLIENTE, no el equipo. Con T()
// bastaba que el equipo tuviera la app en inglés para que al cliente de Regeneris
// le llegara "All set — I just uploaded…". Misma regla que el aviso del backend
// y que los mensajes de WhatsApp: lo que ve el cliente va en su idioma, no en el
// de quien aprieta el botón.
function swapCommentBody(note, hadVideo = true) {
  // Si el reel NO tenía video (se está subiendo por primera vez a un entregable
  // que ya existía) no se le puede decir al cliente "la nueva versión con los
  // cambios que pediste": no había versión anterior.
  const base = hadVideo
    ? '✅ Listo, ya subí la nueva versión de este reel con los cambios que pediste.'
    : '✅ Listo, ya subí el video de este reel.';
  const extra = String(note || '').trim();
  return extra ? `${base}\n\n${extra}` : base;
}

// Abre el selector de archivo del entregable `it` y arranca el reemplazo.
// El <input> se limpia SIEMPRE: con 'change' si eligió archivo, con 'cancel' (y
// un respaldo al volver el foco) si cerró el selector. Antes solo se quitaba en
// 'change', así que cada cancelación dejaba un nodo pegado en el <body>.
function pickSwapFile(it) {
  if (busy || draining) { toast(T('Espera a que termine la subida en curso.', 'Wait for the upload in progress to finish.'), 'info'); return; }
  let gone = false;
  const drop = () => { if (gone) return; gone = true; try { input.remove(); } catch { /* noop */ } };
  const input = el('input', {
    type: 'file', accept: 'video/*', class: 'dlv-fileinput', hidden: true,
    onchange: (e) => {
      const f = (e.target.files || [])[0];
      e.target.value = '';
      drop();
      if (f) swapVideo(it, f);
    },
    oncancel: drop,
  });
  document.body.appendChild(input);
  input.click();
  // Respaldo para navegadores sin evento 'cancel' (Safari viejo): al volver el
  // foco a la ventana el selector ya se cerró; si no hubo archivo, se limpia.
  window.addEventListener('focus', () => { setTimeout(() => { if (!input.files || !input.files.length) drop(); }, 400); }, { once: true });
}

// Hoja para la nota opcional del aviso. Devuelve el texto (puede ser ''), o
// null si canceló/cerró — null aborta el reemplazo, '' publica solo el aviso
// automático. Mismo componente que el resto de la app (tema, movil, foco).
function askSwapNote() {
  return new Promise((resolve) => {
    let value = null; // null = cancelado mientras no se confirme
    openSheet({
      title: T('Cambiar el video', 'Replace the video'),
      mode: 'form',
      onClose: () => resolve(value),
      build(body, close) {
        const ta = el('textarea', {
          class: 'input', rows: '3', maxlength: '300',
          placeholder: T('Ej.: ya bajé el eco de la voz', 'E.g.: I lowered the echo on the voice'),
          'aria-label': T('Nota para el cliente', 'Note for the client'),
        });
        body.append(
          el('p', { class: 'help', style: 'margin-bottom:10px',
            text: T('Se le avisa al cliente que subiste una versión nueva. Los comentarios que ya dejó NO se borran.',
              'The client is notified that you uploaded a new version. The comments they already left are NOT deleted.') }),
          ta,
          el('div', { class: 'sheet-actions', style: 'display:flex;gap:8px;margin-top:14px' }, [
            el('button', {
              class: 'btn btn--primary', type: 'button', style: 'flex:1',
              text: T('Cambiar video', 'Replace video'),
              onclick: () => { value = ta.value.trim(); close({ source: 'ok' }); },
            }),
            el('button', {
              class: 'btn', type: 'button',
              text: T('Cancelar', 'Cancel'),
              onclick: () => { value = null; close({ source: 'cancel' }); },
            }),
          ]),
        );
        setTimeout(() => { try { ta.focus(); } catch { /* noop */ } }, 60);
      },
    });
  });
}

async function swapVideo(it, file) {
  if (busy || draining) return;
  const hadVideo = !!it.video_url;   // false = el reel se quedó sin archivo y se está reponiendo
  // MISMA revisión previa que al subir un reel nuevo (formato imposible de
  // reproducir + aviso de HEVC): se revisa ANTES de tocar el video que ya está.
  const { ok, unplayable, hevc } = await screenVideoFiles([file]);
  if (unplayable.length) { toast(msgUnplayable(unplayable), 'error', 9000); return; }
  if (!ok.length) { toast(T(`"${file.name}" no es un video.`, `"${file.name}" is not a video.`), 'error'); return; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    toast(T(`"${file.name}" es enorme (más de 3 GB). Compártelo por link mejor.`, `"${file.name}" is huge (over 3 GB). Better share it by link.`), 'error', 6000);
    return;
  }
  if (hevc.length && !window.confirm(msgHevc(hevc))) return;

  // Nota OPCIONAL para el cliente, además del texto automático. Vacío = solo el
  // automático; Cancelar/cerrar = no se cambia nada (escape a mitad de camino).
  // Va en la hoja PROPIA de la app (misma de "Agregar mes"), no en window.prompt:
  // el dialogo nativo se ve ajeno, en movil tapa media pantalla y no respeta el
  // tema — y esta pantalla la ve el equipo desde el celular.
  const note = await askSwapNote();
  if (note === null) return; // canceló

  // Se vuelve a revisar AQUÍ: entre la guarda de arriba y este punto hubo dos
  // esperas largas (olfatear el HEVC de un archivo de 2 GB lee megas de disco, y
  // la hoja de la nota la contesta una persona). En esa ventana `busy` seguía en
  // false, así que soltar un reel en la zona de arrastrar arrancaba OTRA subida en
  // paralelo: las dos compartían la barra de progreso y la primera en terminar
  // dejaba a la otra congelada a media subida.
  if (busy || draining) { toast(T('Espera a que termine la subida en curso.', 'Wait for the upload in progress to finish.'), 'info'); return; }

  swapId = it.id; busy = true; uploadPct = 0; queueInfo = null; render();
  try {
    // Mismo endpoint y mismo id -> los comentarios NO se tocan.
    await multipartUpload(api, `/deliverables/${it.id}/video`, file, (p) => { uploadPct = p; updateProgressUI(); });
    uploadPct = 100; updateProgressUI();
    // Miniatura del video NUEVO (best-effort): si no, la tarjeta se quedaría con
    // el póster del video viejo.
    try {
      const posterBlob = await generatePoster(file);
      if (posterBlob) {
        const pf = new FormData(); pf.append('poster', posterBlob, 'poster.jpg');
        await fetch(`/api/marketing/deliverables/${it.id}/poster`, { method: 'POST', credentials: 'same-origin', body: pf });
      }
    } catch { /* sin poster: la tarjeta usa el primer cuadro del video */ }
    // Comentario automático en el MISMO hilo, firmado por quien lo hizo, y aviso
    // al cliente. Si esto falla, el video YA quedó cambiado: se avisa y punto.
    try {
      await api.post(`/deliverables/${it.id}/comments`, { body: swapCommentBody(note, hadVideo), notify_client: true });
    } catch {
      toast(T('El video se cambió ✓, pero no se pudo publicar el aviso. Escríbelo a mano en los comentarios.', 'The video was replaced ✓, but the message could not be posted. Write it by hand in the comments.'), 'error', 8000);
    }
    toast(hadVideo
      ? T('Video cambiado ✓ — los comentarios siguen ahí.', 'Video replaced ✓ — the comments are still there.')
      : T('Video subido ✓ — los comentarios siguen ahí.', 'Video uploaded ✓ — the comments are still there.'), 'success', 5000);
    // Si se salió de la pantalla a media subida, load() reventaría contra ctx=null
    // y caeríamos al catch diciendo "no se pudo cambiar el video" cuando SÍ se
    // cambió (y el aviso al cliente ya salió). El cambio ya está hecho: recargar
    // la lista es solo cosmético.
    if (rootEl && ctx) { try { await load(); } catch { /* la vista ya no está */ } }
    return true;
  } catch (e) {
    // Aquí el video anterior sigue intacto salvo que el servidor avise lo
    // contrario: el mensaje del 422 ya dice cuál de los dos casos fue.
    toast(e.message || T('No se pudo cambiar el video. El anterior sigue ahí.', 'Could not replace the video. The previous one is still there.'), 'error', 9000);
    return false;
  } finally {
    swapId = null; busy = false; uploadPct = 0; progressEls = null; render();
    // Los reels que se soltaron en la zona de arrastrar MIENTRAS se cambiaba el
    // video quedaron esperando en la fila (ya no se descartan): arrancarlos ahora.
    if (uploadQueue.length && !draining) drainQueue();
  }
}

// Devuelve true SOLO si el carrusel quedó guardado: el botón limpia las
// casillas únicamente en ese caso (si falla, lo tecleado se conserva).
async function addCarrusel(link, title) {
  const client = activeClient();
  if (!client || busy) return false;
  let url = String(link || '').trim();
  if (!url) { toast(T('Pega el link del carrusel.', 'Paste the carousel link.'), 'error'); return false; }
  // Un link real SIEMPRE lleva un punto en el dominio (canva.link, instagram.com,
  // drive.google.com…). Si NO trae protocolo NI punto, casi seguro es el título
  // escrito en la casilla equivocada (ej. "CARRUSELES") -> avisamos claro en vez de
  // guardar un enlace roto como "https://CARRUSELES".
  const hasProto = /^https?:\/\//i.test(url);
  if (!hasProto && !/[^\s]\.[^\s]/.test(url)) {
    toast(T('Eso no parece un link. Aquí va el ENLACE (ej. canva.link/…); el nombre va en la casilla "Título".', 'That doesn\'t look like a link. The LINK goes here (e.g. canva.link/…); the name goes in the "Title" box.'), 'error', 7000);
    return false;
  }
  if (!hasProto) url = 'https://' + url.replace(/^\/+/, '');
  // Validación final con el parser de URL: el dominio debe tener un punto, o no se guarda.
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) throw 0;
    url = u.href;
  } catch {
    toast(T('Ese enlace no es válido. Revisa que sea un link completo (ej. https://canva.link/…).', 'That link is not valid. Make sure it\'s a full link (e.g. https://canva.link/…).'), 'error', 7000);
    return false;
  }
  busy = true; render();
  const month = addMonth || currentMonth();
  try {
    await api.post('/deliverables', {
      client_id: client.id, month, type: 'carrusel',
      link: url, title: (title || '').trim().slice(0, 200) || null,
    });
    toast(T('Carrusel agregado ✓', 'Carousel added ✓'), 'success');
    activeMonthNav = month; // al agregar, la vista te lleva a ese mes
    await load();
    return true;
  } catch (e) {
    toast(e.message || T('No se pudo agregar el carrusel', 'Could not add the carousel'), 'error');
    return false;
  } finally {
    busy = false; render();
  }
}

async function removeItem(it) {
  if (busy) return;
  const what = it.type === 'reel' ? T('este reel', 'this reel') : T('este carrusel', 'this carousel');
  if (!window.confirm(T(`¿Eliminar ${what}? No se puede deshacer.`, `Delete ${what}? This cannot be undone.`))) return;
  busy = true; render();
  try {
    await api.del(`/deliverables/${it.id}`);
    items = items.filter((x) => x.id !== it.id);
    toast(T('Eliminado', 'Deleted'), 'info');
  } catch (e) {
    toast(e.message || T('No se pudo eliminar', 'Could not delete'), 'error');
  } finally {
    busy = false; render();
  }
}

// Descargar/guardar un reel. En MÓVIL usa el menú nativo de Compartir
// (navigator.share con archivo) -> el usuario toca "Guardar video" (iOS Fotos)
// o "Guardar en Archivos". En ESCRITORIO descarga directa por enlace.
const TYPE_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg', 'video/3gpp': '3gp' };
// it.id -> File ya en memoria (para 2º toque instantáneo en iOS Safari).
// SÓLO UNO a la vez: si ella prepara otro reel, el anterior se suelta — en el
// teléfono cada archivo retenido son decenas de MB y varios tumban Safari.
const fileCache = new Map();
function cacheOneFile(id, file) {
  fileCache.clear();
  dlAllCache.clear();   // "Descargar todos" guarda su propio archivo: si no se
                        // suelta, quedarían DOS videos en la RAM del teléfono
  fileCache.set(id, file);
}

// video_url YA trae el sello anti-caché (`?v=<updated_at>`), así que "download"
// tiene que ir con & cuando ya hay query — concatenar '?download=1' a secas
// generaba "…?v=123?download=1" y el servidor no veía la descarga.
function withParam(u, k, v) {
  const s = String(u || '');
  return s + (s.includes('?') ? '&' : '?') + k + '=' + v;
}

function linkDownload(it) {
  const a = document.createElement('a');
  a.href = withParam(it.video_url, 'download', '1');
  a.download = String(it.title || 'reel');
  document.body.appendChild(a); a.click(); a.remove();
}

// Descarga UN tramo (Range) como ArrayBuffer.
// Lo que tumbaba Safari NO era el paralelismo sino el video entero acumulado en
// RAM (y el mes completo en caché); eso ya se arregló convirtiendo cada tramo a
// Blob en cuanto llega y bajando de uno en uno. Así que el móvil usa el MISMO
// troceado que el escritorio: bajarlo a 4MB×2 sólo hacía la descarga ~2.7× más
// lenta en el teléfono, que es justo donde el 99% de las clientas la usa.
const DL_LANES = 3;                                                       // tramos bajando a la vez
const DL_CHUNK = 8 * 1024 * 1024;                                         // por tramo
function fetchRange(url, start, end, onLoaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.withCredentials = true;
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
    xhr.onprogress = (e) => { if (onLoaded) onLoaded(e.loaded); };
    xhr.onload = () => {
      if (xhr.status === 206 || xhr.status === 200) { resolve({ buf: xhr.response, status: xhr.status, xhr }); return; }
      // El status TIENE que viajar en el error: si se pierde aquí, quien llama
      // no puede distinguir "se cortó la red" de "esta marca no puede
      // descargar", y el aviso al cliente se vuelve inalcanzable.
      const err = new Error(xhr.status === 403
        ? T('Las descargas están desactivadas para esta marca.', 'Downloads are turned off for this brand.')
        : T('No se pudo descargar el video.', 'Could not download the video.'));
      err.status = xhr.status;
      if (xhr.status === 403) err.bloqueado = true;
      reject(err);
    };
    xhr.onerror = () => reject(new Error(T('Se cortó la conexión al descargar.', 'The connection dropped while downloading.')));
    xhr.send();
  });
}

// Descarga el video como Blob con progreso. Baja en VARIOS TRAMOS en paralelo y los
// rearma -> más rápido que una sola descarga (que se estanca). Si el servidor no
// soporta rangos (200) o el archivo es chico, cae a una sola descarga. onProgress(pct).
async function fetchVideoBlob(it, onProgress) {
  // download=1 SIEMPRE: este es el motor de descarga de verdad (móvil y
  // "Descargar todos"). Sin el parámetro, el candado del servidor —que solo
  // mira ese flag— nunca se activaba y el interruptor era decorativo en el
  // teléfono. Marcar la intención aquí es lo que lo vuelve real.
  const url = withParam(it.video_url, 'download', '1');
  // 1) primer tramo: trae el inicio y revela tamaño total + soporte de rangos.
  // fetchRange ya marca el 403 como `bloqueado` y lo relanza: aquí solo se
  // deja pasar (el catch de quien llama es el que muestra el aviso).
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
  // Cada tramo se convierte a Blob EN CUANTO llega: así el navegador puede
  // mandarlo a disco y no se acumulan decenas de MB de ArrayBuffer en RAM.
  const numChunks = Math.ceil(total / DL_CHUNK);
  const buffers = new Array(numChunks); buffers[0] = new Blob([first.buf]);
  const loaded = new Array(numChunks).fill(0); loaded[0] = first.buf.byteLength;
  first.buf = null; // libera el ArrayBuffer del 1er tramo (ya está en el Blob)
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
      buffers[i] = new Blob([res.buf]); res.buf = null; // libera el ArrayBuffer
      loaded[i] = (end - start + 1); bump();
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

// ¿Es un teléfono/tablet donde "Compartir → Guardar video/Guardar en Archivos" es el
// flujo natural (iPhone/iPad/Android)? En ESCRITORIO (Mac/PC) el menú de Compartir NO
// sirve para bajar a la compu (solo ofrece AirDrop, Mail, Mensajes…), así que ahí
// descargamos el archivo DIRECTO al equipo.
function isMobileSave() {
  const ua = navigator.userAgent || '';
  const uaMobile = /iPhone|iPod|Android/i.test(ua)
    || (navigator.userAgentData && navigator.userAgentData.mobile === true);
  const touch = (navigator.maxTouchPoints || 0) > 1;
  const iPadOnMac = /Macintosh/.test(ua) && touch; // iPadOS se hace pasar por Mac
  const coarseOnly = !!(window.matchMedia
    && window.matchMedia('(pointer: coarse)').matches
    && !window.matchMedia('(pointer: fine)').matches);
  return !!(uaMobile || iPadOnMac || (coarseOnly && touch));
}

// Guardar al teléfono. iPhone Safari (iOS16+)/Android: menú nativo de Compartir
// (navigator.share con archivo -> "Guardar video" en Fotos / "Guardar en Archivos").
// iOS exige que share() salga JUSTO tras el toque; si el video es grande, la descarga
// consume ese permiso -> cacheamos el archivo y el 2º toque lo comparte al instante.
// Escritorio (sin la API): descarga directa por enlace.
async function saveVideo(it, btn) {
  // Escritorio (Mac/PC): descarga directa al equipo con el gestor del navegador (muestra
  // su propio progreso). Solo en móvil (iPhone/iPad/Android) usamos el menú de Compartir.
  if (!isMobileSave()) { linkDownload(it); return; }
  if (!(navigator.canShare && navigator.share)) { linkDownload(it); return; }
  const label = btn ? btn.querySelector('span:not(.ico)') : null; // la etiqueta, NO el <span class="ico">
  const setLabel = (t) => { if (label) label.textContent = t; };
  const resetBtn = () => { if (btn) btn.classList.remove('dlv-dl--ready'); setLabel(T('Descargar', 'Download')); };

  // 2º toque (archivo ya en memoria): compartir SINCRONO -> activación fresca, no falla.
  const cached = fileCache.get(it.id);
  if (cached) {
    try { await navigator.share({ files: [cached], title: it.title || 'Reel' }); fileCache.delete(it.id); resetBtn(); }
    catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú: deja el botón armado
      // Falló el menú: CONSERVAMOS el archivo (no lo re-bajamos) y dejamos el botón
      // armado para reintentar con un toque (en iOS un <a download> no guardaría nada).
      toast(T('No se abrió el menú para guardar. Toca el botón otra vez.', 'The save menu didn\'t open. Tap the button again.'), 'error', 5000);
    }
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setLabel(`${T('Preparando…', 'Preparing…')} 0%`);
    const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Preparando…', 'Preparing…')} ${pct}%`));
    const file = fileFromBlob(it, blob);
    if (!navigator.canShare({ files: [file] })) { linkDownload(it); return; }
    try {
      await navigator.share({ files: [file], title: it.title || 'Reel' });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // canceló el menú
      // iOS: la descarga consumió el permiso del toque. Dejamos el archivo LISTO y
      // ARMAMOS un 2º toque muy claro (botón resaltado) -> ahí sí abre "Guardar en el teléfono".
      cacheOneFile(it.id, file);
      if (btn) btn.classList.add('dlv-dl--ready');
      setLabel(T('Toca para guardar', 'Tap to save'));
      toast(T('Tu video ya está listo ✓ — toca otra vez el botón resaltado para guardarlo en tu teléfono.', 'Your video is ready ✓ — tap the highlighted button again to save it to your phone.'), 'info', 8000);
      return;
    }
  } catch (e) {
    // Si el servidor lo BLOQUEÓ, decirlo: caer a linkDownload solo repetiría
    // el 403 y la clienta se quedaría sin entender por qué no pasa nada.
    if (e && e.bloqueado) {
      toast(e.message, 'info', 6000);
      if (isClient()) refrescarPermisos().then(() => { if (rootEl) render(); });
    } else {
      linkDownload(it);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (label && /Preparando|Preparing/.test(label.textContent)) resetBtn();
  }
}

// Guarda un File ya descargado con el gestor del navegador (escritorio y
// fallback móvil): enlace a un blob local -> directo a Descargas.
function blobDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 60000);
}

// "Descargar todos" los reels del mes activo.
//
// ESCRITORIO: baja uno por uno y cada archivo se guarda en Descargas al terminar.
//
// MÓVIL (canónico: 99% de los clientes ven en celular): DE UNO EN UNO de verdad.
// Antes se bajaban TODOS los reels del mes a la memoria del teléfono y recién
// entonces se abría el menú de Compartir — 7 reels de 80MB = medio giga en un
// iPhone y Safari se cerraba solo. Ahora sólo hay UN video en memoria a la vez:
// se baja el 1, se arma el toque para guardarlo, se guarda, se libera y sigue el 2.
async function downloadAllReels(month, reels, btn) {
  const label = btn.querySelector('span:not(.ico)');
  const setLabel = (t) => { if (label) label.textContent = t; };
  const mobile = isMobileSave() && !!(navigator.canShare && navigator.share);

  // ── MÓVIL: uno a la vez, con el 2º toque que exige iOS para guardar ──
  if (mobile) {
    const armed = dlAllCache.get(month);

    // 2º toque, TODOS JUNTOS: el navegador exige un gesto para abrir el menú de
    // compartir, pero acepta varios archivos en la MISMA llamada. Así los 5
    // reels se guardan con un solo toque en vez de cinco.
    if (armed && armed.files && armed.files.length) {
      try {
        await navigator.share({ files: armed.files, title: T('Reels del mes', 'Reels of the month') });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // canceló el menú: siguen armados
        toast(T('No se abrió el menú para guardar. Toca el botón otra vez.', 'The save menu didn\'t open. Tap the button again.'), 'error', 5000);
        return;
      }
      dlAllCache.delete(month);
      // ¿Quedó una segunda tanda porque el lote pesaba demasiado?
      const resto = dlAllPendientes.get(month);
      if (resto && resto.length) {
        dlAllPendientes.delete(month);
        toast(T(`Guardados ✓ — preparando los ${resto.length} que faltan.`, `Saved ✓ — preparing the remaining ${resto.length}.`), 'info', 5000);
        await mobilePrepararTodos(month, resto, btn, setLabel);
        return;
      }
      finishMobileBatch(month, reels, btn, setLabel);
      return;
    }

    // 2º toque, UNO A UNO (teléfonos que no aceptan varios archivos juntos).
    if (armed && armed.file) {
      try {
        await navigator.share({ files: [armed.file], title: armed.file.name || 'Reel' });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // canceló el menú: sigue armado
        toast(T('No se abrió el menú para guardar. Toca el botón otra vez.', 'The save menu didn\'t open. Tap the button again.'), 'error', 5000);
        return;
      }
      // Guardado: se LIBERA el archivo y se sigue con el siguiente (si queda).
      const next = armed.index + 1;
      dlAllCache.delete(month);
      if (next >= reels.length) { finishMobileBatch(month, reels, btn, setLabel); return; }
      await mobilePrepare(month, reels, next, btn, setLabel);
      return;
    }

    // 1er toque: preparar TODO el mes de una vez.
    if (dlAllBusy) return;
    await mobilePrepararTodos(month, reels, btn, setLabel);
    return;
  }

  // ── ESCRITORIO: secuencial, cada archivo directo a Descargas ──
  if (dlAllBusy) return;
  dlAllBusy = true; btn.disabled = true;
  const failed = [];
  let bloqueado = null;   // mensaje del interruptor, si el servidor lo cortó
  try {
    for (let i = 0; i < reels.length; i++) {
      const it = reels[i];
      const pos = `${i + 1}/${reels.length}`;
      setLabel(`${T('Descargando', 'Downloading')} ${pos}…`);
      try {
        const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Descargando', 'Downloading')} ${pos} · ${pct}%`));
        blobDownload(fileFromBlob(it, blob));
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        // Si es el interruptor, no tiene caso seguir con los demás: se avisa
        // una vez y se corta. Antes salía "3 reels no se descargaron… intenta
        // de nuevo" y la clienta reintentaba para siempre sin saber por qué.
        if (e && e.bloqueado) { bloqueado = e.message; break; }
        failed.push(it.title || 'Reel');
      }
    }
  } finally {
    dlAllBusy = false; btn.disabled = false;
    setLabel(T('Descargar todos', 'Download all'));
  }
  if (bloqueado) {
    toast(bloqueado, 'info', 7000);
    if (isClient()) refrescarPermisos().then(() => { if (rootEl) render(); });
    return;
  }
  if (failed.length) {
    toast(T(`${failed.length === 1 ? '1 reel no se descargó' : `${failed.length} reels no se descargaron`}: ${failed.join(', ')}. Intenta de nuevo.`, `${failed.length === 1 ? '1 reel failed to download' : `${failed.length} reels failed to download`}: ${failed.join(', ')}. Try again.`), 'error', 9000);
  } else {
    toast(`${reels.length} ${T('reels descargados', 'reels downloaded')} ✓`, 'success');
  }
}

// Móvil: baja los reels DE UNO EN UNO desde `index`. Se detiene en cuanto uno
// queda listo para guardarse (el toque que exige iOS); los que este teléfono no
// puede compartir se mandan al gestor de descargas y SIGUE con el siguiente, y
// un reel que falla tampoco corta la tanda. Nunca hay más de un video en memoria.
// Cuánto se permite tener en memoria a la vez antes de partir en lotes: cinco
// reels de 4K llenan un teléfono modesto y el navegador mata la pestaña.
const TOPE_LOTE_BYTES = 380 * 1024 * 1024;

// Baja TODOS los reels del mes y los deja listos para UN solo toque.
async function mobilePrepararTodos(month, reels, btn, setLabel) {
  if (dlAllBusy) return;
  dlAllBusy = true; btn.disabled = true;
  btn.classList.remove('dlv-dl--ready');
  const listos = [];
  const fallidos = [];
  let pesados = 0;
  try {
    for (let i = 0; i < reels.length; i++) {
      const it = reels[i];
      const pos = `${i + 1}/${reels.length}`;
      try {
        setLabel(`${T('Preparando', 'Preparing')} ${pos}… 0%`);
        const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Preparando', 'Preparing')} ${pos} · ${pct}%`));
        listos.push(fileFromBlob(it, blob));
        pesados += blob.size || 0;
        // Si el lote ya pesa demasiado, se guarda lo que hay y se sigue con el
        // resto en una segunda tanda (mejor dos toques que una pestaña muerta).
        if (pesados > TOPE_LOTE_BYTES && i < reels.length - 1) {
          dlAllPendientes.set(month, reels.slice(i + 1));
          break;
        }
      } catch (e) {
        if (e && e.bloqueado) {
          toast(e.message, 'info', 7000);
          dlAllFailed.delete(month); dlAllPendientes.delete(month);
          if (isClient()) refrescarPermisos().then(() => { if (rootEl) render(); });
          return;
        }
        fallidos.push(it.title || 'Reel');
      }
    }
    if (!listos.length) {
      toast(T('No se pudo preparar ningún reel. Intenta de nuevo.', 'Could not prepare any reel. Try again.'), 'error', 6000);
      return;
    }
    // ¿Este teléfono acepta varios archivos en un solo compartir?
    let juntos = false;
    try { juntos = navigator.canShare && navigator.canShare({ files: listos }); } catch { juntos = false; }
    if (!juntos) {
      // No los acepta juntos: se cae al camino de siempre (uno por uno), que
      // funciona en todos lados. Nadie se queda sin sus videos.
      dlAllCache.delete(month); dlAllPendientes.delete(month);
      return mobilePrepare(month, reels, 0, btn, setLabel);
    }
    fileCache.clear();
    dlAllCache.set(month, { files: listos, index: 0 });
    btn.classList.add('dlv-dl--ready');
    const n = listos.length;
    setLabel(`${T('Toca para guardar los', 'Tap to save the')} ${n}`);
    toast(T(`${n} reels listos ✓ — toca el botón resaltado y guárdalos todos de una vez.`,
            `${n} reels ready ✓ — tap the highlighted button and save them all at once.`), 'info', 8000);
    if (fallidos.length) dlAllFailed.set(month, fallidos);
  } finally {
    dlAllBusy = false; btn.disabled = false;
  }
}

async function mobilePrepare(month, reels, index, btn, setLabel) {
  if (dlAllBusy) return;
  dlAllBusy = true; btn.disabled = true;
  btn.classList.remove('dlv-dl--ready');
  try {
    let i = index;
    while (i < reels.length) {
      const it = reels[i];
      const pos = `${i + 1}/${reels.length}`;
      try {
        setLabel(`${T('Preparando', 'Preparing')} ${pos}… 0%`);
        const blob = await fetchVideoBlob(it, (pct) => setLabel(`${T('Preparando', 'Preparing')} ${pos} · ${pct}%`));
        const file = fileFromBlob(it, blob);
        let shareable = false;
        try { shareable = navigator.canShare({ files: [file] }); } catch { shareable = false; }
        if (!shareable) {
          // Este teléfono no comparte archivos: cae al gestor de descargas y
          // CONTINÚA con el resto (antes se quedaba en el primero y los demás
          // no se bajaban nunca, sin avisar).
          blobDownload(file);
          await new Promise((r) => setTimeout(r, 350));
          i++;
          continue;
        }
        fileCache.clear();   // sólo UN video en memoria a la vez (ver cacheOneFile)
        dlAllCache.set(month, { file, index: i });
        btn.classList.add('dlv-dl--ready');
        setLabel(`${T('Toca para guardar', 'Tap to save')} ${pos}`);
        toast(T(`Reel ${pos} listo ✓ — toca el botón resaltado para guardarlo en tu teléfono.`, `Reel ${pos} ready ✓ — tap the highlighted button to save it to your phone.`), 'info', 7000);
        return; // espera el toque; al guardarse sigue el siguiente
      } catch (e) {
        // El interruptor no es un fallo de este reel: es que la marca no
        // descarga. Se avisa UNA vez y se corta el lote.
        if (e && e.bloqueado) {
          toast(e.message, 'info', 7000);
          dlAllFailed.delete(month);
          if (isClient()) refrescarPermisos().then(() => { if (rootEl) render(); });
          return;
        }
        // Falló ESTE reel: se anota y se sigue con el siguiente (antes el
        // siguiente toque reempezaba en el 1 y volvía a bajar lo ya guardado).
        const list = dlAllFailed.get(month) || [];
        list.push(it.title || 'Reel');
        dlAllFailed.set(month, list);
        toast(T(`No se pudo descargar el reel ${pos}. Se sigue con el siguiente.`, `Could not download reel ${pos}. Continuing with the next one.`), 'error', 5000);
        i++;
      }
    }
    finishMobileBatch(month, reels, btn, setLabel);
  } finally {
    dlAllBusy = false; btn.disabled = false;
  }
}

// Cierre de la tanda móvil: limpia el estado y dice qué quedó guardado y qué no.
function finishMobileBatch(month, reels, btn, setLabel) {
  const failed = dlAllFailed.get(month) || [];
  dlAllCache.delete(month);
  dlAllFailed.delete(month);
  btn.classList.remove('dlv-dl--ready');
  setLabel(T('Descargar todos', 'Download all'));
  if (failed.length) {
    toast(T(
      `${failed.length === 1 ? '1 reel no se descargó' : `${failed.length} reels no se descargaron`}: ${failed.join(', ')}. Intenta de nuevo.`,
      `${failed.length === 1 ? '1 reel failed to download' : `${failed.length} reels failed to download`}: ${failed.join(', ')}. Try again.`
    ), 'error', 9000);
  } else {
    toast(`${reels.length} ${T('reels guardados', 'reels saved')} ✓`, 'success');
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function buildAddBar() {
  if (!addMonth) addMonth = currentMonth();
  const monthInput = el('input', {
    class: 'dlv-month', type: 'month', value: addMonth, 'aria-label': T('Mes de los entregables', 'Deliverables month'),
    onchange: (e) => { addMonth = e.target.value || currentMonth(); },
  });

  // Drop zone para reels
  const fileInput = el('input', {
    type: 'file', accept: 'video/*', multiple: true, class: 'dlv-fileinput', hidden: true,
    // Se copia la lista ANTES de limpiar el input: la revisión previa es async.
    onchange: (e) => { const fs = [...e.target.files]; e.target.value = ''; enqueueReels(fs); },
  });
  let dropKids;
  if (busy && swapId) {
    // Se está CAMBIANDO el video de una tarjeta: el progreso se ve AHÍ (en la
    // tarjeta), no aquí. Esta zona solo queda bloqueada para no encimar subidas.
    dropKids = [
      icon('refresh', 26),
      el('span', { class: 'dlv-drop__t', text: T('Cambiando un video…', 'Replacing a video…') }),
      el('span', { class: 'dlv-drop__s', text: T('El progreso se ve en la tarjeta del reel.', 'The progress is shown on the reel card.') }),
    ];
  } else if (busy) {
    // Barra de progreso (refs vivos -> updateProgressUI los actualiza sin re-render).
    const fill = el('div', { class: 'dlv-prog__fill' });
    fill.style.width = uploadPct + '%';
    const q = (queueInfo && queueInfo.total > 1) ? `(${queueInfo.index}/${queueInfo.total}) ` : '';
    const label = el('span', { class: 'dlv-drop__t dlv-prog__label', text: uploadPct >= 100 ? `${q}${T('Procesando…', 'Processing…')}` : `${q}${T('Subiendo…', 'Uploading…')} ${uploadPct}%` });
    progressEls = { fill, label };
    dropKids = [
      icon('camera', 26),
      label,
      el('div', { class: 'dlv-prog' }, [fill]),
      el('span', { class: 'dlv-drop__s', text: T('No cierres esta pantalla mientras sube el video.', 'Don\'t close this screen while the video uploads.') }),
    ];
  } else {
    dropKids = [
      icon('camera', 26),
      el('span', { class: 'dlv-drop__t', text: T('Arrastra un reel aquí o toca para elegir', 'Drag a reel here or tap to choose') }),
      el('span', { class: 'dlv-drop__s', text: T('Video MP4/MOV/WebM · calidad original · videos grandes OK (se suben por partes)', 'MP4/MOV/WebM video · original quality · big videos OK (uploaded in parts)') }),
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

  // Agregar carrusel por link. Cada casilla con su etiqueta visible para que no se
  // confunda el ENLACE (lo que abre el carrusel) con el TÍTULO (solo un nombre).
  const linkInput = el('input', { class: 'dlv-input', type: 'text', inputmode: 'url', placeholder: T('Pega el enlace: canva.link/…, drive…, instagram.com/…', 'Paste the link: canva.link/…, drive…, instagram.com/…') });
  const titleInput = el('input', { class: 'dlv-input dlv-input--title', type: 'text', placeholder: T('Nombre para el cliente', 'Name for the client'), maxlength: 200 });
  const addBtn = el('button', {
    class: 'dlv-addbtn', type: 'button', disabled: busy,
    onclick: async () => {
      // Limpia las casillas SOLO si se agregó de verdad: si la validación o el
      // POST fallan, el link/título se quedan para corregir sin volver a pegar.
      const ok = await addCarrusel(linkInput.value, titleInput.value);
      if (ok) { linkInput.value = ''; titleInput.value = ''; }
    },
  }, [icon('plus', 16), el('span', { text: T('Agregar carrusel', 'Add carousel') })]);

  return el('div', { class: 'dlv-addbar' }, [
    el('div', { class: 'dlv-addbar__row' }, [
      el('label', { class: 'dlv-addbar__lbl', text: T('Subir al mes:', 'Upload to month:') }),
      monthInput,
    ]),
    drop,
    el('div', { class: 'dlv-carrusel-add' }, [
      el('div', { class: 'dlv-field' }, [
        el('label', { class: 'dlv-field__lbl', text: T('Link del carrusel', 'Carousel link') }),
        linkInput,
      ]),
      el('div', { class: 'dlv-field dlv-field--title' }, [
        el('label', { class: 'dlv-field__lbl', text: T('Título (opcional)', 'Title (optional)') }),
        titleInput,
      ]),
      addBtn,
    ]),
  ]);
}

// Tiempo relativo en español. created_at viene en UTC ('YYYY-MM-DD HH:MM:SS').
function relTime(iso) {
  if (!iso) return '';
  const s = String(iso);
  const t = Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return T('ahora', 'now');
  if (sec < 3600) return T(`hace ${Math.floor(sec / 60)} min`, `${Math.floor(sec / 60)} min ago`);
  if (sec < 86400) return T(`hace ${Math.floor(sec / 3600)} h`, `${Math.floor(sec / 3600)} h ago`);
  if (sec < 7 * 86400) return T(`hace ${Math.floor(sec / 86400)} d`, `${Math.floor(sec / 86400)} d ago`);
  return new Date(t).toLocaleDateString(T('es-MX', 'en-US'), { day: 'numeric', month: 'short' });
}

async function deleteComment(it, c, node) {
  if (!window.confirm(T('¿Eliminar este comentario?', 'Delete this comment?'))) return;
  try {
    await api.del(`/deliverables/${it.id}/comments/${c.id}`);
    node.remove();
    it.comments = (it.comments || []).filter((x) => x.id !== c.id);
  } catch (e) { toast(e.message || T('No se pudo eliminar', 'Could not delete'), 'error'); }
}

function commentEl(it, c, staff) {
  // Encabezado (quién y cuándo: "Nombre · hace 2h") + texto. Los comentarios del
  // CLIENTE se distinguen con borde y etiqueta de color. Para staff, × para borrar.
  const fromClient = c.author_role === 'client';
  const when = relTime(c.created_at);
  const top = el('div', { class: 'dlv-comment__top' }, [
    el('span', { class: 'dlv-comment__who', text: c.author_name || (fromClient ? T('Cliente', 'Client') : T('Equipo IVAE', 'IVAE Team')) }),
    c.author_role ? el('span', { class: 'dlv-comment__role' + (fromClient ? ' is-client' : ''), text: fromClient ? T('Cliente', 'Client') : T('Equipo', 'Team') }) : null,
    when ? el('span', { class: 'dlv-comment__when', text: when }) : null,
  ]);
  const node = el('div', { class: 'dlv-comment' + (fromClient ? ' dlv-comment--client' : '') }, [
    el('div', { class: 'dlv-comment__main' }, [
      top,
      el('p', { class: 'dlv-comment__body', text: c.body }),
    ]),
    staff ? el('button', { class: 'dlv-comment__del', type: 'button', 'aria-label': T('Eliminar comentario', 'Delete comment') }, [icon('trash', 15)]) : null,
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
    class: 'dlv-comment-input', rows: 1, maxlength: 4000, placeholder: T('Escribe un cambio o comentario…', 'Write a change or comment…'),
    oninput: (e) => {
      // En escritorio el textarea LLENA el alto (flex); no fijamos altura inline.
      if (window.matchMedia && window.matchMedia('(min-width: 768px)').matches) return;
      e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
    },
  });
  const send = el('button', { class: 'dlv-comment-send', type: 'button', text: T('Enviar', 'Send') });
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
    } catch (e) { toast(e.message || T('No se pudo enviar', 'Could not send'), 'error'); }
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

// Etiqueta de la pieza vinculada del CALENDARIO: "REEL 3". Vianey pidió la
// numeración justo para esto — al subir el reel final saber a qué publicación
// aprobada corresponde. Sin vínculo devuelve null (no se pinta nada).
const PIECE_SHORT_DLV = {
  reel: 'REEL', post: 'POST', tiktok: 'TIKTOK', informativo: 'INFO',
  carrusel: 'CARRUSEL', experiencia: 'EXP.', pauta: 'PAUTA',
  tratamientos: 'TRAT.', historia: 'HIST.', foto: 'FOTO',
};
function pieceBadge(it) {
  const p = it && it.piece;
  if (!p || !p.num) return null;
  const short = PIECE_SHORT_DLV[p.type] || (p.type || 'PIEZA').toUpperCase();
  return el('span', {
    class: 'dlv-piece', title: p.title ? `${short} ${p.num} · ${p.title}` : `${short} ${p.num}`,
    text: `${short} ${p.num}`,
  });
}

// Vincular el entregable con su pieza del CALENDARIO. Lista los posts del mes
// del entregable, numerados con el MISMO criterio que la vista Calendario, así
// Vianey elige "REEL 3 · Promo del mes" y la etiqueta viaja con el archivo.
async function linkPiece(it) {
  const client = activeClient();
  if (!client) return;
  let posts = [];
  try {
    const res = await api.get(`/posts?client_id=${encodeURIComponent(client.id)}`);
    posts = Array.isArray(res) ? res : (res && res.posts) || [];
  } catch {
    toast(T('No se pudo cargar el calendario.', 'Could not load the calendar.'), 'error');
    return;
  }
  const mine = posts.filter((p) => String(p.publish_date || '').slice(0, 7) === it.month);
  // Numeración por tipo, igual que en Calendario.
  const byType = new Map();
  for (const p of mine) {
    if (!p.content_type) continue;
    if (!byType.has(p.content_type)) byType.set(p.content_type, []);
    byType.get(p.content_type).push(p);
  }
  const nums = new Map();
  for (const list of byType.values()) {
    list.sort((a, b) => String(a.publish_date || '').localeCompare(String(b.publish_date || ''))
      || (Number(a.position) || 0) - (Number(b.position) || 0)
      || String(a.created_at || '').localeCompare(String(b.created_at || ''))
      || String(a.id).localeCompare(String(b.id)));
    list.forEach((p, i) => nums.set(String(p.id), i + 1));
  }
  openSheet({
    title: T('¿A qué pieza del calendario corresponde?', 'Which calendar piece is this?'),
    mode: 'menu',
    build(body, close) {
      body.appendChild(el('p', { class: 'acct-intro', text: T(
        'Elige la publicación aprobada que corresponde a este entregable. La etiqueta (REEL 3) aparecerá aquí y en el calendario.',
        'Pick the approved post this deliverable belongs to.',
      ) }));
      if (!mine.length) {
        body.appendChild(el('div', { class: 'muted', text: T('No hay publicaciones en este mes.', 'No posts this month.') }));
        return;
      }
      const list = el('div', { class: 'acct-list' });
      for (const p of mine) {
        const n = nums.get(String(p.id));
        const short = PIECE_SHORT_DLV[p.content_type] || (p.content_type || '').toUpperCase();
        list.appendChild(el('button', {
          class: 'dlv-piecerow' + (it.post_id === p.id ? ' is-active' : ''), type: 'button',
          onclick: async () => {
            close({ source: 'pick' });
            try {
              await api.patch(`/deliverables/${it.id}`, { post_id: it.post_id === p.id ? '' : p.id });
              toast(it.post_id === p.id ? T('Vínculo quitado.', 'Unlinked.') : T('Vinculado.', 'Linked.'), 'success');
              await load(true);
            } catch (e) { toast(e.message || T('No se pudo vincular.', 'Could not link.'), 'error'); }
          },
        }, [
          n ? el('span', { class: 'dlv-piece', text: `${short} ${n}` }) : null,
          el('span', { class: 'dlv-piecerow__t', text: p.title || T('(sin título)', '(untitled)') }),
          el('span', { class: 'dlv-piecerow__d', text: String(p.publish_date || '').slice(8, 10) + '/' + String(p.publish_date || '').slice(5, 7) }),
        ].filter(Boolean)));
      }
      body.appendChild(list);
    },
  });
}

function buildItem(it, staff) {
  if (it.type === 'reel') {
    const card = el('div', { class: 'dlv-card dlv-card--reel' });
    if (swapId === it.id) {
      // Cambio de video EN CURSO: el progreso va aquí, sobre la tarjeta, para que
      // se vea sin subir hasta la zona de arrastrar (en móvil queda lejísimos).
      const fill = el('div', { class: 'dlv-prog__fill' });
      fill.style.width = uploadPct + '%';
      const label = el('span', { class: 'dlv-drop__t dlv-prog__label', text: uploadPct >= 100 ? T('Procesando…', 'Processing…') : `${T('Subiendo…', 'Uploading…')} ${uploadPct}%` });
      progressEls = { fill, label };
      card.appendChild(el('div', { class: 'dlv-video dlv-video--pending dlv-video--swapping' }, [
        label,
        el('div', { class: 'dlv-prog' }, [fill]),
        el('span', { class: 'dlv-drop__s', text: T('No cierres esta pantalla. Los comentarios no se tocan.', 'Don\'t close this screen. The comments are untouched.') }),
      ]));
    } else if (it.video_url) {
      // Con las descargas apagadas hay que cerrar TAMBIÉN la puerta del
      // reproductor: el menú ⋮ de Chrome trae su propio "Descargar" y dejaba
      // sin efecto el interruptor. controlsList lo quita y se bloquea el menú
      // del clic derecho. (No es infalible —para VER el video hay que
      // servirlo— pero cierra el camino fácil, que es lo que se pidió.)
      const sinDescarga = isClient() && !descargasActivas();
      const v = el('video', {
        class: 'dlv-video', src: it.video_url, poster: it.poster_url || null,
        controls: true, playsinline: true, preload: 'none',
        controlsList: sinDescarga ? 'nodownload noplaybackrate' : null,
        oncontextmenu: sinDescarga ? ((e) => e.preventDefault()) : null,
        disablePictureInPicture: sinDescarga || null,
      });
      observeVideo(v); // carga metadatos/frame solo al acercarse (rápido en móvil)
      card.appendChild(v);
    } else {
      // Al CLIENTE se le dice "Procesando…" (aún no hay nada que ver). Al EQUIPO
      // se le dice la verdad: ese reel no tiene archivo y hay un botón para
      // ponérselo sin borrar el entregable (ni sus comentarios).
      card.appendChild(el('div', { class: 'dlv-video dlv-video--pending', text: staff
        ? T('Sin video — usa "Subir video"', 'No video — use "Upload video"')
        : T('Procesando…', 'Processing…') }));
    }
    // "Cambiar video": SOLO staff. Sube el archivo conservando el entregable (y por
    // tanto sus comentarios). El cliente nunca lo ve, y el backend además rechaza a
    // role='client' en todas las rutas de subida — el botón oculto no es la única
    // defensa.
    // OJO: se muestra TAMBIÉN cuando el reel se quedó sin video ("Procesando…" que
    // ya no avanza: se cerró la pestaña a media subida, o la subida llegó cortada).
    // Si solo apareciera con video, ese reel sería un callejón sin salida: la única
    // forma de volver a ponerle archivo sería BORRARLO, y borrar se lleva en
    // cascada los comentarios del cliente — justo lo que esta función existe para
    // evitar. Con video dice "Cambiar video"; sin video, "Subir video".
    const canSwap = staff;
    const hasVideo = !!it.video_url;
    const badge = pieceBadge(it);
    const foot = el('div', { class: 'dlv-card__foot' + (staff ? ' is-staff' : '') }, [
      el('span', { class: 'dlv-card__titlewrap' }, [
        badge,
        el('span', { class: 'dlv-card__title', text: it.title || 'Reel' }),
      ]),
      el('div', { class: 'dlv-card__actions' }, [
        staff ? el('button', {
          class: 'dlv-link', type: 'button',
          'aria-label': T('Vincular con la pieza del calendario', 'Link to calendar piece'),
          title: T('Vincular con la pieza del calendario', 'Link to calendar piece'),
          onclick: () => linkPiece(it),
        }, [icon('link', 16), el('span', { text: it.piece && it.piece.num ? T('Cambiar', 'Change') : T('Vincular', 'Link') })]) : null,
        (it.video_url && (!isClient() || descargasActivas())) ? el('button', {
          class: 'dlv-dl', type: 'button', 'aria-label': T('Descargar reel', 'Download reel'),
          onclick: (e) => saveVideo(it, e.currentTarget),
        }, [icon('down', 16), el('span', { text: T('Descargar', 'Download') })]) : null,
        canSwap ? el('button', {
          class: 'dlv-swap' + (hasVideo ? '' : ' dlv-swap--empty'), type: 'button', disabled: busy || null,
          'aria-label': hasVideo
            ? T('Cambiar el video de este reel (los comentarios se quedan)', 'Replace this reel\'s video (the comments stay)')
            : T('Subir el video de este reel (los comentarios se quedan)', 'Upload this reel\'s video (the comments stay)'),
          title: hasVideo
            ? T('Sube la versión corregida sin perder los comentarios', 'Upload the fixed version without losing the comments')
            : T('Este reel no tiene video: súbelo sin borrar el entregable ni sus comentarios', 'This reel has no video: upload it without deleting the deliverable or its comments'),
          onclick: () => pickSwapFile(it),
        }, [icon('refresh', 16), el('span', { text: hasVideo ? T('Cambiar video', 'Replace video') : T('Subir video', 'Upload video') })]) : null,
        staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': T('Eliminar', 'Delete'), disabled: busy || null, onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
      ]),
    ]);
    // foot + comentarios en un lado: en móvil van debajo del video; en escritorio
    // (CSS ≥768px) este lado se coloca AL COSTADO del video para leer el comentario.
    card.appendChild(el('div', { class: 'dlv-card__side' }, [foot, buildComments(it, staff)]));
    return card;
  }
  // carrusel: preview (izquierda en escritorio) + comentarios al lado (.dlv-card__side)
  const main = el('div', { class: 'dlv-carrusel__main' }, [
    el('div', { class: 'dlv-carrusel__ico' }, [icon('grip', 30)]),
    el('span', { class: 'dlv-card__titlewrap' }, [
      pieceBadge(it),
      el('span', { class: 'dlv-card__title', text: it.title || T('Carrusel', 'Carousel') }),
    ]),
    el('div', { class: 'dlv-card__actions' }, [
      el('a', {
        class: 'dlv-carrusel-btn', href: it.link, target: '_blank', rel: 'noopener noreferrer',
      }, [icon('eye', 16), el('span', { text: T('Ver carrusel', 'View carousel') })]),
      staff ? el('button', { class: 'dlv-del', type: 'button', 'aria-label': T('Eliminar', 'Delete'), onclick: () => removeItem(it) }, [icon('trash', 16)]) : null,
    ]),
  ]);
  return el('div', { class: 'dlv-card dlv-card--carrusel' }, [
    main,
    el('div', { class: 'dlv-card__side' }, [buildComments(it, staff)]),
  ]);
}

function render() {
  if (!rootEl) return;
  clear(rootEl);
  const staff = !isClient();
  // Descargas apagadas por marca (lo decide Vianey en Ajustes de la marca).
  // Solo afecta al CLIENTE: el equipo siempre puede bajar su propio material.
  // El botón se esconde por cortesía; el candado de verdad está en el servidor.
  const puedeDescargar = staff || descargasActivas();
  const client = activeClient();

  if (!client) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('briefcase', 26)]),
      el('h3', { text: T('Elige una marca', 'Choose a brand') }),
      el('p', { text: T('Selecciona un cliente arriba para ver o subir sus entregables.', 'Select a client above to view or upload their deliverables.') }),
    ]));
    return;
  }

  const dlOn = descargasActivas();
  rootEl.appendChild(el('div', { class: 'dlv-head' }, [
    el('h1', { class: 'dlv-h1', text: T('Entregables', 'Deliverables') }),
    // Interruptor de descargas de la marca (solo el equipo lo ve).
    staff ? el('button', {
      class: 'dlv-dltoggle' + (dlOn ? '' : ' is-off'), type: 'button',
      title: dlOn
        ? T('El cliente puede descargar los reels. Toca para desactivarlo.', 'The client can download reels. Tap to turn off.')
        : T('El cliente solo puede VER los reels. Toca para permitir descargas.', 'The client can only VIEW reels. Tap to allow downloads.'),
      'aria-pressed': dlOn ? 'true' : 'false',
      onclick: (e) => toggleDescargas(e.currentTarget),
    }, [
      icon(dlOn ? 'down' : 'close', 15),
      el('span', { text: `${T('Descargas del cliente:', 'Client downloads:')} ${dlOn ? T('Activadas', 'On') : T('Desactivadas', 'Off')}` }),
    ]) : null,
    el('p', { class: 'dlv-sub', text: staff
      ? (descargasActivas()
          ? T('Sube los reels finales y agrega los carruseles. El cliente los verá y podrá descargarlos.', 'Upload the final reels and add the carousels. The client will see them and can download them.')
          : T('Sube los reels finales y agrega los carruseles. La descarga está DESACTIVADA para esta marca: el cliente solo puede verlos.', 'Upload the final reels and carousels. Downloads are OFF for this brand: the client can only view them.'))
      : (puedeDescargar
          ? T('Aquí está tu contenido final, listo para ver y descargar.', 'Here\'s your final content, ready to view and download.')
          : T('Aquí está tu contenido final, listo para ver.', 'Here\'s your final content, ready to view.')) }),
  ]));

  // Acceso rápido a "descargar todos" ARRIBA: el formulario de subida ocupa
  // toda la primera pantalla y dejaba el botón del mes fuera de vista.
  // (Se pinta después de cargar, cuando ya se sabe cuántos reels hay.)
  const atajoDl = el('div', { class: 'dlv-atajo' });
  rootEl.appendChild(atajoDl);
  if (staff) rootEl.appendChild(buildAddBar());

  if (loading) {
    rootEl.appendChild(el('div', { class: 'dlv-loading' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'muted', text: T('Cargando entregables…', 'Loading deliverables…') })]));
    return;
  }

  // OJO: el error va ANTES del vacío. Si falló la carga NO se dice "todavía no
  // hay contenido" (eso hacía que un bache de señal se leyera como "mi agencia
  // no me subió nada"); se dice que no se pudo cargar y se ofrece Reintentar.
  if (loadErr) {
    // Red vs servidor: api.js solo pone err.status cuando HUBO respuesta.
    // Sin esto, un 500 le decía "revisa tu internet" a alguien con internet
    // perfecto y lo mandaba a pelearse con su wifi.
    const esRed = loadErr.status === undefined || navigator.onLine === false;
    rootEl.appendChild(errorCard({
      title: T('No se pudo cargar tu contenido', "Couldn't load your content"),
      message: esRed
        ? T('Revisa tu conexión e intenta de nuevo. Tus entregables siguen ahí.',
            'Check your connection and try again. Your deliverables are still there.')
        : T('El servidor no está respondiendo. Inténtalo en un momento; tus entregables siguen ahí.',
            'The server is not responding. Try again in a moment; your deliverables are still there.'),
      onRetry: () => load(),
    }));
    return;
  }

  if (!items.length) {
    rootEl.appendChild(el('div', { class: 'dlv-empty' }, [
      el('div', { class: 'dlv-empty__ico' }, [icon('camera', 26)]),
      el('h3', { text: staff ? T('Aún no hay entregables', 'No deliverables yet') : T('Todavía no hay contenido', 'No content yet') }),
      el('p', { text: staff ? T('Arrastra un reel o agrega un carrusel arriba para empezar.', 'Drag a reel or add a carousel above to get started.') : T('En cuanto el equipo suba tu contenido, aparecerá aquí.', 'As soon as the team uploads your content, it will show up here.') }),
    ]));
    return;
  }

  // Agrupar por mes (desc) y NAVEGAR por píldoras: el área muestra SOLO el mes
  // activo (nada de apilar todos los meses). Default = el más reciente con contenido.
  const byMonth = new Map();
  for (const it of items) { if (!byMonth.has(it.month)) byMonth.set(it.month, []); byMonth.get(it.month).push(it); }
  const months = [...byMonth.keys()].sort().reverse();
  if (!months.includes(activeMonthNav)) activeMonthNav = months[0];
  if (months.length > 1) rootEl.appendChild(buildMonthBar(months, byMonth));

  const m = activeMonthNav;
  // Ordenar SIEMPRE por nombre, con orden numérico natural (2 < 11 < 12),
  // sin importar cuándo se subió cada uno (re-subir el 11 no lo manda al final).
  const list = byMonth.get(m).sort(
    (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es', { numeric: true, sensitivity: 'base' }),
  );
  const reels = list.filter((it) => it.type === 'reel' && it.video_url);
  // El atajo de arriba: mismo botón, para no tener que bajar a buscarlo.
  if (reels.length >= 2 && (!isClient() || descargasActivas())) {
    clear(atajoDl);
    atajoDl.appendChild(buildDownloadAllBtn(m, reels));
  }
  resetVideoObserver(); // limpia observaciones del mes anterior antes de re-observar
  const sec = el('section', { class: 'dlv-month-sec' }, [
    el('h2', { class: 'dlv-month-h' }, [
      el('span', { class: 'dlv-month-h__t', text: monthLabel(m) }),
      el('span', { class: 'dlv-month-h__n', text: String(list.length) }),
      (reels.length >= 2 && (!isClient() || descargasActivas())) ? buildDownloadAllBtn(m, reels) : null,
    ]),
    el('div', { class: 'dlv-grid' }, list.map((it) => buildItem(it, staff))),
  ]);
  rootEl.appendChild(sec);
}

// Barra de píldoras de meses (mismo patrón que la monthbar de "Meses"): nombre
// del mes + conteo; la activa resaltada. Tocar una cambia el mes visible.
function buildMonthBar(months, byMonth) {
  const bar = el('div', { class: 'dlv-monthbar', role: 'tablist', 'aria-label': T('Meses', 'Months') });
  for (const m of months) {
    const active = m === activeMonthNav;
    bar.appendChild(el('button', {
      class: 'dlv-monthpill' + (active ? ' is-active' : ''),
      type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false',
      onclick: () => { if (activeMonthNav !== m) { activeMonthNav = m; render(); } },
    }, [
      el('span', { class: 'dlv-monthpill__lbl', text: monthTitle(m) }),
      el('span', { class: 'dlv-monthpill__n', text: String((byMonth.get(m) || []).length) }),
    ]));
  }
  return bar;
}

// Botón "Descargar todos" del mes activo (solo con 2+ reels ya procesados).
function buildDownloadAllBtn(month, reels) {
  const armed = dlAllCache.get(month); // móvil: el reel de turno ya está listo, falta el toque
  const pos = armed ? `${armed.index + 1}/${reels.length}` : '';
  const btn = el('button', {
    class: 'dlv-dl dlv-dlall' + (armed ? ' dlv-dl--ready' : ''), type: 'button',
    'aria-label': T('Descargar todos los reels del mes', 'Download all reels for this month'), disabled: dlAllBusy || null,
    onclick: (e) => downloadAllReels(month, reels, e.currentTarget),
  }, [icon('down', 15), el('span', { text: armed
    ? (armed.files && armed.files.length
        ? `${T('Toca para guardar los', 'Tap to save the')} ${armed.files.length}`
        : `${T('Toca para guardar', 'Tap to save')} ${pos}`)
    // Decir CUÁNTOS: "Descargar todos" no dice si son 2 o 18, y el botón se
    // confundía con el de un reel suelto.
    : `${T('Descargar los', 'Download all')} ${reels.length} ${T('reels', 'reels')}` })]);
  return btn;
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
      if (now !== lastClientId) { lastClientId = now; activeMonthNav = ''; load(); } else { render(); }
    }));
    // Al VOLVER a la pantalla (cambiar de app, desbloquear el teléfono, tocar el
    // aviso "ya subí la nueva versión" estando YA en Entregables) se recarga la
    // lista. Sin esto, el cliente que dejó la app abierta se queda con el sello
    // ?v= viejo — el anti-caché funciona, pero nadie le pide la URL nueva — y
    // tiene que cerrar y reabrir la app para ver el video cambiado.
    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible') return;
      if (!rootEl || !ctx || busy || draining || loading || dlAllBusy) return;
      // NUNCA recargar con un archivo ARMADO esperando el 2º toque de "Guardar"
      // en el iPhone: load() suelta esos File y el video se volvería a bajar
      // entero. En iOS la hoja de Compartir hace perder y recuperar el foco.
      if (fileCache.size || dlAllCache.size) return;
      // Con la carga fallida la espera baja a 3 s: el que vuelve a la app tras
      // recuperar señal quiere su contenido ya, no seguir viendo el error.
      if (Date.now() - lastLoadAt < (loadErr ? 3000 : 15000)) return;
      load();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);
    unsubs.push(() => document.removeEventListener('visibilitychange', refreshOnReturn));
    unsubs.push(() => window.removeEventListener('focus', refreshOnReturn));
    // Volvió la señal: si la última carga falló se reintenta SOLA. Antes había
    // que cerrar y reabrir la app para salir del estado vacío/erróneo.
    const retryOnOnline = () => {
      if (!rootEl || !ctx || !loadErr) return;
      if (busy || draining || loading || dlAllBusy) return;
      if (fileCache.size || dlAllCache.size) return;
      load();
    };
    window.addEventListener('online', retryOnOnline);
    unsubs.push(() => window.removeEventListener('online', retryOnOnline));
    render();
    load();
  },
  onParams() { load(); },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    resetVideoObserver();
    rootEl = null; ctx = null; items = []; loading = false; loadErr = null; busy = false;
    swapId = null; progressEls = null;
    activeMonthNav = ''; dlAllBusy = false; dlAllCache.clear(); fileCache.clear();
  },
};
