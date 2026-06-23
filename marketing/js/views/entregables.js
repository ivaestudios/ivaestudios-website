// ============================================================================
// IVAE Marketing — Vista "Entregables" (contenido final para el cliente).
// El equipo (staff) sube REELS (arrastrar/soltar -> R2, calidad original) y
// agrega CARRUSELES por link. El CLIENTE de la marca ve cada reel con
// reproductor + boton Descargar, y los carruseles como boton "Ver carrusel"
// (abre el link, nunca el link crudo). Todo agrupado por mes.
// Backend: GET/POST /deliverables · POST/GET /deliverables/:id/video · DELETE.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202606232500';
import { icon } from '../shell/icons.js?v=202606232500';

const VIEW_ID = 'entregables';
const MAX_VIDEO_MB = 3000;             // tope de cordura (~3GB); el video se sube por partes
const CHUNK_BYTES = 50 * 1024 * 1024;  // ~50MB por parte (bajo el limite de 100MB/request del Worker)
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
  link.href = '/marketing/css/entregables.css?v=202606232500';
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
  progressEls.label.textContent = uploadPct >= 100 ? 'Procesando…' : `Subiendo… ${uploadPct}%`;
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

async function uploadReel(file) {
  const client = activeClient();
  if (!client || busy) return;
  if (!file.type || !file.type.startsWith('video/')) { toast('Ese archivo no es un video.', 'error'); return; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast('El video es enorme (más de 3 GB). Compártelo por link mejor.', 'error', 6000); return; }
  busy = true; uploadPct = 0; render();
  let created = null;
  try {
    created = await api.post('/deliverables', {
      client_id: client.id, month: addMonth || currentMonth(), type: 'reel',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    // 1) iniciar subida multipart
    const start = await api.post(`/deliverables/${created.id}/video/multipart/start`, { mime: file.type });
    const { uploadId, ext } = start;
    // 2) subir por partes (~50MB) con progreso acumulado
    const total = file.size;
    const numParts = Math.max(1, Math.ceil(total / CHUNK_BYTES));
    const doneParts = [];
    let baseBytes = 0;
    for (let i = 0; i < numParts; i++) {
      const from = i * CHUNK_BYTES;
      const blob = file.slice(from, Math.min(from + CHUNK_BYTES, total));
      const r = await xhrPutPart(created.id, uploadId, ext, i + 1, blob, (loaded) => {
        uploadPct = Math.min(99, Math.round(((baseBytes + loaded) / total) * 100));
        updateProgressUI();
      });
      baseBytes += blob.size;
      uploadPct = Math.min(99, Math.round((baseBytes / total) * 100));
      updateProgressUI();
      doneParts.push({ partNumber: i + 1, etag: r.etag });
    }
    // 3) ensamblar en R2
    await api.post(`/deliverables/${created.id}/video/multipart/complete`, { uploadId, ext, parts: doneParts });
    uploadPct = 100; updateProgressUI();
    toast('Reel subido ✓', 'success');
    await load();
  } catch (e) {
    if (created) { try { await api.del(`/deliverables/${created.id}`); } catch { /* limpia el registro huerfano */ } }
    toast(e.message || 'No se pudo subir el reel', 'error');
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

// Descarga el video como Blob con progreso (XHR; fetch no expone progreso de bajada).
function fetchVideoBlob(it, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', it.video_url);
    xhr.withCredentials = true;
    xhr.responseType = 'blob';
    xhr.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => { (xhr.status >= 200 && xhr.status < 300) ? resolve(xhr.response) : reject(new Error('No se pudo descargar el video.')); };
    xhr.onerror = () => reject(new Error('Se cortó la conexión al descargar.'));
    xhr.send();
  });
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
  const label = btn ? btn.querySelector('span') : null;
  const setLabel = (t) => { if (label) label.textContent = t; };

  // 2º toque (archivo ya en memoria): compartir SINCRONO -> activación fresca, no falla.
  const cached = fileCache.get(it.id);
  if (cached) {
    try { await navigator.share({ files: [cached], title: it.title || 'Reel' }); fileCache.delete(it.id); }
    catch (e) { if (!(e && e.name === 'AbortError')) linkDownload(it); }
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
      // Activación perdida (video grande): cachear + pedir un toque más (instantáneo).
      fileCache.set(it.id, file);
      setLabel('Guardar ✓');
      toast('Tu video ya está listo. Toca "Guardar" otra vez para mandarlo a tu teléfono.', 'info', 7000);
      return;
    }
  } catch (e) {
    linkDownload(it);
  } finally {
    if (btn) btn.disabled = false;
    if (label && /Preparando/.test(label.textContent)) setLabel('Descargar');
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
    type: 'file', accept: 'video/*', class: 'dlv-fileinput', hidden: true,
    onchange: (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadReel(f); e.target.value = ''; },
  });
  let dropKids;
  if (busy) {
    // Barra de progreso (refs vivos -> updateProgressUI los actualiza sin re-render).
    const fill = el('div', { class: 'dlv-prog__fill' });
    fill.style.width = uploadPct + '%';
    const label = el('span', { class: 'dlv-drop__t dlv-prog__label', text: uploadPct >= 100 ? 'Procesando…' : `Subiendo… ${uploadPct}%` });
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
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadReel(f);
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

function buildItem(it, staff) {
  if (it.type === 'reel') {
    const card = el('div', { class: 'dlv-card dlv-card--reel' });
    if (it.video_url) {
      card.appendChild(el('video', {
        class: 'dlv-video', src: it.video_url, controls: true, playsinline: true, preload: 'metadata',
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
    const list = byMonth.get(m);
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
