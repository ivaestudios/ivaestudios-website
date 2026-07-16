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
import { api, el, clear, toast } from '../api.js?v=202607152032';
import { icon } from '../shell/icons.js?v=202607152032';

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

async function download(link, meta, btn) {
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  try {
    // Pasamos la mediaUrl YA resuelta (m) para que el server NO re-resuelva;
    // si el server es viejo o falta, cae al link original (u).
    const q = (meta && meta.mediaUrl)
      ? `m=${encodeURIComponent(meta.mediaUrl)}&p=${encodeURIComponent(meta.platform || '')}&n=${encodeURIComponent(meta.filename || 'video.mp4')}`
      : `u=${encodeURIComponent(link)}`;
    const res = await fetch(`/api/marketing/descargar/file?${q}`, { credentials: 'same-origin' });
    if (!res.ok) {
      // NO volcar HTML de error (p.ej. la página 502 de Cloudflare): mensaje limpio.
      let msg = `No se pudo descargar (error ${res.status}). Vuelve a intentar.`;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) { try { const j = await res.json(); if (j && j.error) msg = j.error; } catch { /* noop */ } }
      else { try { const t = await res.text(); if (t && t.length < 200 && !/</.test(t)) msg = t; } catch { /* noop */ } }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const name = (meta && meta.filename) || 'video.mp4';
    const href = URL.createObjectURL(blob);
    const a = el('a', { href, download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(href); } catch { /* noop */ } a.remove(); }, 1500);
    toast('Descarga lista ✓', 'success');
  } catch (e) {
    toast(e && e.message ? e.message : 'No se pudo descargar.', 'error', 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  }
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
        autocapitalize: 'off', spellcheck: 'false',
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
      el('h1', { class: 'dl-title', text: 'Descargar videos' }),
      el('p', { class: 'dl-sub', text: 'Instagram · TikTok · Pinterest — sin marca de agua, en la máxima calidad. Solo pega el link.' }),
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
    el('p', { text: 'Pega un link arriba y descarga el video limpio, sin marca de agua.' }),
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
  const dims = (meta.width && meta.height) ? `${meta.width}×${meta.height}` : null;
  const dur = meta.durationSec ? `${Math.floor(meta.durationSec / 60)}:${String(Math.round(meta.durationSec % 60)).padStart(2, '0')}` : null;

  const thumb = meta.thumbnail
    ? el('div', { class: 'dl-thumb' }, [
        el('img', { src: meta.thumbnail, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => { e.target.closest('.dl-thumb').classList.add('is-empty'); } }),
        el('span', { class: 'dl-play' }, [icon('down', 20)]),
      ])
    : el('div', { class: 'dl-thumb is-empty' }, [icon('camera', 26)]);

  const dlBtn = el('button', {
    class: 'btn btn-primary dl-download', type: 'button',
  }, [icon('download', 18), el('span', { text: ' Descargar MP4' }), el('span', { class: 'spinner spinner--btn' })]);
  dlBtn.addEventListener('click', () => download(link, meta, dlBtn));

  resultEl.appendChild(el('div', { class: 'dl-card' }, [
    thumb,
    el('div', { class: 'dl-meta' }, [
      el('span', { class: `dl-chip dl-chip--${plat.cls} dl-chip--sm`, text: plat.label }),
      el('p', { class: 'dl-cap', text: meta.title || 'Video' }),
      el('div', { class: 'dl-facts' }, [
        el('span', { class: 'dl-ok', text: '✓ Sin marca de agua' }),
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
  link.href = '/marketing/css/descargar.css?v=202607152032';
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
