// ============================================================================
// IVAE Marketing — Vista "Entregables" (contenido final para el cliente).
// El equipo (staff) sube REELS (arrastrar/soltar -> R2, calidad original) y
// agrega CARRUSELES por link. El CLIENTE de la marca ve cada reel con
// reproductor + boton Descargar, y los carruseles como boton "Ver carrusel"
// (abre el link, nunca el link crudo). Todo agrupado por mes.
// Backend: GET/POST /deliverables · POST/GET /deliverables/:id/video · DELETE.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202606232100';
import { icon } from '../shell/icons.js?v=202606232100';

const VIEW_ID = 'entregables';
const MAX_VIDEO_MB = 100;
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let ctx = null;
let rootEl = null;
let unsubs = [];
let items = [];
let loading = false;
let busy = false;
let addMonth = '';          // 'YYYY-MM' al que se agregan nuevos entregables
let lastClientId = null;

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
  link.href = '/marketing/css/entregables.css?v=202606232100';
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
async function uploadReel(file) {
  const client = activeClient();
  if (!client || busy) return;
  if (!file.type || !file.type.startsWith('video/')) { toast('Ese archivo no es un video.', 'error'); return; }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    toast(`El video pesa ${(file.size / 1024 / 1024).toFixed(0)} MB. El máximo es ${MAX_VIDEO_MB} MB (sin recomprimir). Para 4K muy pesado avísame.`, 'error', 7000);
    return;
  }
  busy = true; render();
  try {
    const created = await api.post('/deliverables', {
      client_id: client.id, month: addMonth || currentMonth(), type: 'reel',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    const fd = new FormData();
    fd.append('video', file, file.name);
    const res = await fetch(`/api/marketing/deliverables/${created.id}/video`, {
      method: 'POST', credentials: 'same-origin', body: fd,
    });
    if (!res.ok) {
      let msg = 'No se pudo subir el video.';
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch { /* noop */ }
      try { await api.del(`/deliverables/${created.id}`); } catch { /* limpia el registro huerfano */ }
      throw new Error(msg);
    }
    toast('Reel subido ✓', 'success');
    await load();
  } catch (e) {
    toast(e.message || 'No se pudo subir el reel', 'error');
  } finally {
    busy = false; render();
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
  const drop = el('button', {
    class: 'dlv-drop', type: 'button',
    onclick: () => fileInput.click(),
  }, [
    icon('camera', 26),
    el('span', { class: 'dlv-drop__t', text: busy ? 'Subiendo…' : 'Arrastra un reel aquí o toca para elegir' }),
    el('span', { class: 'dlv-drop__s', text: `Video MP4/MOV/WebM · calidad original · máx ${MAX_VIDEO_MB} MB` }),
    fileInput,
  ]);
  if (busy) drop.classList.add('is-busy');
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
        it.video_url ? el('a', {
          class: 'dlv-dl', href: it.video_url + '?download=1', download: '',
          'aria-label': 'Descargar reel',
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
