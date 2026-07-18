// ============================================================================
// IVAE Marketing — Vista "Descargar" (descargador de videos; SOLO staff).
//
// Pega el link de un Reel de Instagram, un TikTok o un Pin de Pinterest → la app
// lo resuelve en el backend (Cloudflare Function) al MP4 SIN marca de agua en la
// resolución más alta disponible → botón Descargar que transmite el archivo.
//
// Flujo: POST /descargar {url} → tarjeta de vista previa (miniatura + calidad)
//        → GET /descargar/file?u=... (stream con Content-Disposition: attachment).
// Nada se guarda: las URLs del CDN expiran, así que se re-resuelve al descargar.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202607181752';
import { icon } from '../shell/icons.js?v=202607181752';

const VIEW_ID = 'descargar';

let rootEl = null;
let inputEl = null;
let resultEl = null;
let busy = false;

const PLATFORMS = {
  instagram: { label: 'Instagram', cls: 'ig' },
  tiktok: { label: 'TikTok', cls: 'tt' },
  pinterest: { label: 'Pinterest', cls: 'pin' },
};

function detect(url) {
  const u = String(url || '').toLowerCase();
  if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(u)) return 'tiktok';
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
  if (/pinterest\.[a-z.]+|pin\.it/.test(u)) return 'pinterest';
  return null;
}

function setBusy(on) {
  busy = on;
  if (rootEl) rootEl.classList.toggle('is-busy', on);
}

async function resolve(url) {
  const link = String(url || '').trim();
  if (!link) return;
  if (!/^https?:\/\//.test(link)) { toast('Pega un link completo (empieza con https://).', 'error'); return; }
  if (!detect(link)) { toast('Solo Instagram, TikTok y Pinterest por ahora.', 'error'); return; }
  if (busy) return;
  if (inputEl) inputEl.blur(); // cierra el teclado en móvil para ver la tarjeta
  setBusy(true);
  renderLoading(link);
  try {
    const meta = await api.post('/descargar', { url: link });
    renderCard(link, meta);
  } catch (e) {
    renderError(e && e.message ? e.message : 'No se pudo obtener el video.');
  } finally {
    setBusy(false);
  }
}

// Descarga NATIVA: navega directo al endpoint que ya transmite el archivo con
// Content-Disposition: attachment. Funciona en iOS Safari (donde fetch+blob NO
// guarda bien) y no carga el video en RAM (clave para videos grandes en celular).
// Se dispara SÍNCRONO dentro del tap (requisito de iOS para permitir la descarga).
function download(item, platform, link) {
  const q = (item && item.url)
    ? `m=${encodeURIComponent(item.url)}&p=${encodeURIComponent(platform || '')}&n=${encodeURIComponent(item.filename || 'media')}`
    : `u=${encodeURIComponent(link || '')}`;
  const a = el('a', { href: `/api/marketing/descargar/file?${q}`, download: (item && item.filename) || 'media', rel: 'noopener' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { try { a.remove(); } catch { /* noop */ } }, 1000);
}

async function pasteFromClipboard() {
  try {
    const txt = await navigator.clipboard.readText();
    if (txt) { inputEl.value = txt.trim(); resolve(txt); }
    else toast('El portapapeles está vacío.', 'info');
  } catch {
    toast('No pude leer el portapapeles. Pega el link a mano.', 'info');
    inputEl.focus();
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  clear(rootEl);

  const form = el('form', {
    class: 'dl-form',
    onsubmit: (e) => { e.preventDefault(); resolve(inputEl.value); },
  }, [
    el('div', { class: 'dl-inwrap' }, [
      icon('link', 18),
      inputEl = el('input', {
        class: 'dl-input', type: 'url', inputmode: 'url', autocomplete: 'off',
        autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go',
        placeholder: 'Pega el link de Instagram, TikTok o Pinterest',
        onpaste: (e) => {
          const t = (e.clipboardData || window.clipboardData);
          const v = t && t.getData ? t.getData('text') : '';
          if (v) setTimeout(() => resolve(v), 0);
        },
      }),
      el('button', {
        class: 'dl-clear', type: 'button', 'aria-label': 'Limpiar',
        onclick: () => { inputEl.value = ''; inputEl.focus(); clear(resultEl); renderHint(); },
      }, [icon('close', 16)]),
    ]),
    el('div', { class: 'dl-actions' }, [
      el('button', { class: 'btn dl-paste', type: 'button', onclick: pasteFromClipboard }, [icon('copy', 16), ' Pegar']),
      el('button', { class: 'btn btn-primary dl-go', type: 'submit' }, [icon('download', 18), ' Descargar']),
    ]),
  ]);

  const chips = el('div', { class: 'dl-chips' }, Object.values(PLATFORMS).map((p) =>
    el('span', { class: `dl-chip dl-chip--${p.cls}`, text: p.label })));

  resultEl = el('div', { class: 'dl-result' });

  rootEl.append(
    el('div', { class: 'dl-head' }, [
      el('h1', { class: 'dl-title', text: 'Descargar contenido' }),
      el('p', { class: 'dl-sub', text: 'Instagram · TikTok · Pinterest — videos, fotos y carruseles, sin marca de agua y en la máxima calidad. Solo pega el link.' }),
    ]),
    form,
    chips,
    resultEl,
  );
  renderHint();
}

function renderHint() {
  clear(resultEl);
  resultEl.appendChild(el('div', { class: 'dl-hint' }, [
    icon('download', 30),
    el('p', { text: 'Pega un link arriba y descarga el video, la foto o el carrusel — limpio, sin marca de agua.' }),
    el('p', { class: 'muted small', text: 'Descarga contenido tuyo o de tus clientes; tú decides qué re-subir.' }),
  ]));
}

function renderLoading(link) {
  clear(resultEl);
  const p = detect(link);
  resultEl.appendChild(el('div', { class: 'dl-card dl-card--loading' }, [
    el('span', { class: 'spinner' }),
    el('span', { text: `Buscando el video en ${p ? PLATFORMS[p].label : 'la plataforma'}…` }),
  ]));
}

function renderError(msg) {
  clear(resultEl);
  resultEl.appendChild(el('div', { class: 'dl-card dl-card--error' }, [
    el('div', { class: 'dl-err-ico' }, [icon('warning', 22)]),
    el('p', { class: 'dl-err-msg', text: msg }),
    el('button', {
      class: 'btn', type: 'button', text: 'Reintentar',
      onclick: () => resolve(inputEl.value),
    }),
  ]));
}

function renderCard(link, meta) {
  clear(resultEl);
  const plat = PLATFORMS[meta.platform] || { label: meta.platform || '', cls: '' };
  const items = (meta.items && meta.items.length)
    ? meta.items
    : [{ url: meta.mediaUrl, type: meta.type || 'video', ext: meta.ext || 'mp4', filename: meta.filename || 'media' }];

  // Carrusel: varios elementos → botón por elemento + "Descargar todo".
  if (items.length > 1) {
    const grid = el('div', { class: 'dl-grid' }, items.map((it, i) => {
      const b = el('button', { class: 'btn dl-item', type: 'button' }, [
        icon(it.type === 'image' ? 'camera' : 'download', 15),
        ` ${it.type === 'image' ? 'Foto' : 'Video'} ${i + 1}`,
      ]);
      b.addEventListener('click', () => { toast('Descargando…', 'success', 1800); download(it, meta.platform, link); });
      return b;
    }));
    const allBtn = el('button', { class: 'btn btn-primary dl-download', type: 'button' },
      [icon('download', 18), el('span', { text: ` Descargar todo (${items.length})` })]);
    allBtn.addEventListener('click', () => {
      toast(`Descargando ${items.length} archivos…`, 'info', 3000);
      // Espaciados: iOS descarta descargas muy seguidas. La 1ª va inmediata (tap).
      items.forEach((it, i) => { if (i === 0) download(it, meta.platform, link); else setTimeout(() => download(it, meta.platform, link), i * 900); });
    });
    resultEl.appendChild(el('div', { class: 'dl-card dl-card--multi' }, [
      el('div', { class: 'dl-multi-head' }, [
        el('span', { class: `dl-chip dl-chip--${plat.cls} dl-chip--sm`, text: plat.label }),
        el('p', { class: 'dl-cap', text: `Carrusel · ${items.length} elementos` }),
      ]),
      grid,
      allBtn,
    ]));
    return;
  }

  // Único elemento (video o imagen).
  const it = items[0];
  const isImg = it.type === 'image';
  const dims = (meta.width && meta.height) ? `${meta.width}×${meta.height}` : null;
  const dur = meta.durationSec ? `${Math.floor(meta.durationSec / 60)}:${String(Math.round(meta.durationSec % 60)).padStart(2, '0')}` : null;

  const thumb = meta.thumbnail
    ? el('div', { class: 'dl-thumb' }, [
        el('img', { src: meta.thumbnail, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => { e.target.closest('.dl-thumb').classList.add('is-empty'); } }),
        el('span', { class: 'dl-play' }, [icon(isImg ? 'camera' : 'down', 20)]),
      ])
    : el('div', { class: 'dl-thumb is-empty' }, [icon('camera', 26)]);

  const dlBtn = el('button', {
    class: 'btn btn-primary dl-download', type: 'button',
  }, [icon('download', 18), el('span', { text: isImg ? ' Descargar imagen' : ' Descargar MP4' })]);
  dlBtn.addEventListener('click', () => { toast('Descargando…', 'success', 1800); download(it, meta.platform, link); });

  resultEl.appendChild(el('div', { class: 'dl-card' }, [
    thumb,
    el('div', { class: 'dl-meta' }, [
      el('span', { class: `dl-chip dl-chip--${plat.cls} dl-chip--sm`, text: plat.label }),
      el('p', { class: 'dl-cap', text: meta.title || (isImg ? 'Imagen' : 'Video') }),
      el('div', { class: 'dl-facts' }, [
        isImg ? el('span', { class: 'dl-ok', text: '✓ Imagen original' }) : el('span', { class: 'dl-ok', text: '✓ Sin marca de agua' }),
        dims ? el('span', { text: dims }) : null,
        dur ? el('span', { text: dur }) : null,
      ]),
      dlBtn,
    ]),
  ]));
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/descargar.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/descargar.css?v=202607181752';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host) {
    ensureCss();
    rootEl = el('div', { class: 'dl-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() {
    rootEl = null; inputEl = null; resultEl = null; busy = false;
  },
};
