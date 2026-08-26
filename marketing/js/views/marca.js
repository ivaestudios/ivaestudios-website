// ============================================================================
// IVAE Marketing — Vista "Marca" (manual de identidad por marca).
//
// El STAFF sube el Manual de Marca en PDF; el CLIENTE de la marca lo consulta
// (visor del navegador) y lo descarga. Un solo PDF vigente por marca: subir de
// nuevo lo reemplaza. Backend: GET/POST/DELETE /clients/:id/manual
// (?info=1 = metadata, ?dl=1 = descarga con attachment).
// ============================================================================
import { el, clear, toast } from '../api.js?v=202608261437';
import { icon } from '../shell/icons.js?v=202608261437';
import { T } from '../shell/i18n.js?v=202608261437';
import { confirmar } from '../shell/sheet.js?v=202608261437';

const VIEW_ID = 'marca';

let ctx = null;
let rootEl = null;
let unsubs = [];
let info = null;          // null (cargando) | { exists, size, updated }
let loadErr = null;
let busy = false;
let lastClientId = null;

function isClient() { return ((ctx.store.getState().me || {}).role === 'client'); }

function activeBrand() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: T('Marca', 'Brand') };
}

function fmtSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const MES = T(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
  return T(`${d.getDate()} de ${MES[d.getMonth()]} de ${d.getFullYear()}`, `${MES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`);
}

async function load() {
  const brand = activeBrand();
  info = null; loadErr = null;
  render();
  if (!brand) return;
  try {
    const r = await fetch(`/api/marketing/clients/${brand.id}/manual?info=1`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(T('No se pudo cargar el manual.', 'Could not load the manual.'));
    info = await r.json();
  } catch (e) {
    loadErr = e;
  }
  render();
}

async function upload(file) {
  const brand = activeBrand();
  if (!brand || !file || busy) return;
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    toast(T('Debe ser un archivo PDF.', 'It must be a PDF file.'), 'error');
    return;
  }
  if (file.size > 40 * 1024 * 1024) {
    toast(T('El PDF pesa más de 40MB.', 'The PDF is over 40MB.'), 'error');
    return;
  }
  busy = true; render();
  try {
    const r = await fetch(`/api/marketing/clients/${brand.id}/manual`, { method: 'POST', body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || T('No se pudo subir el PDF.', 'Could not upload the PDF.'));
    toast(T('Manual de marca guardado.', 'Brand manual saved.'), 'success');
  } catch (e) {
    toast((e && e.message) || T('No se pudo subir el PDF.', 'Could not upload the PDF.'), 'error');
  } finally {
    busy = false;
    load();
  }
}

async function removeManual() {
  const brand = activeBrand();
  if (!brand || busy) return;
  const ok = await confirmar({
    title: T(`¿Quitar el manual de ${brand.name}? El cliente dejará de verlo; puedes subir otro cuando quieras.`, `Remove ${brand.name}'s manual? The client will no longer see it; you can upload another one anytime.`),
    accion: T('Quitar el manual', 'Remove the manual'),
  });
  if (!ok) return;
  busy = true; render();
  try {
    const r = await fetch(`/api/marketing/clients/${brand.id}/manual`, { method: 'DELETE' });
    if (!r.ok) throw new Error();
    toast(T('Manual quitado.', 'Manual removed.'), 'success');
  } catch {
    toast(T('No se pudo quitar el manual.', 'Could not remove the manual.'), 'error');
  } finally {
    busy = false;
    load();
  }
}

function pickFile() {
  const input = el('input', { type: 'file', accept: 'application/pdf,.pdf', style: 'display:none' });
  input.addEventListener('change', () => { if (input.files && input.files[0]) upload(input.files[0]); input.remove(); });
  document.body.appendChild(input);
  input.click();
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  if (!rootEl) return;
  clear(rootEl);
  const brand = activeBrand();
  const client = isClient();

  rootEl.appendChild(el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Manual de Marca', 'Brand Manual') }),
    el('p', { class: 'mk-sub', text: client
      ? T('La identidad de tu marca, siempre a la mano: colores, tipografías, voz y reglas de uso.', 'Your brand identity, always at hand: colors, fonts, voice and usage rules.')
      : T('El PDF de identidad que el cliente consulta desde su portal. Subir uno nuevo reemplaza el vigente.', 'The identity PDF the client sees in their portal. Uploading a new one replaces the current one.') }),
  ]));

  if (!brand) {
    rootEl.appendChild(el('div', { class: 'mk-empty' }, [
      icon('book', 30),
      el('p', { text: T('Elige una marca arriba para ver su manual.', 'Pick a brand above to see its manual.') }),
    ]));
    return;
  }

  if (busy || (info === null && !loadErr)) {
    rootEl.appendChild(el('div', { class: 'mk-empty' }, [
      el('span', { class: 'spinner' }),
      el('p', { text: busy ? T('Guardando…', 'Saving…') : T('Cargando…', 'Loading…') }),
    ]));
    return;
  }

  if (loadErr) {
    rootEl.appendChild(el('div', { class: 'mk-empty' }, [
      icon('warning', 26),
      el('p', { text: T('No se pudo cargar. Revisa tu conexión e intenta de nuevo.', 'Could not load. Check your connection and try again.') }),
      el('button', { class: 'btn', type: 'button', text: T('Reintentar', 'Retry'), onclick: load }),
    ]));
    return;
  }

  if (info.exists) {
    const verUrl = `/api/marketing/clients/${brand.id}/manual`;
    const meta = [fmtDate(info.updated) ? T(`Actualizado el ${fmtDate(info.updated)}`, `Updated ${fmtDate(info.updated)}`) : null, fmtSize(info.size)]
      .filter(Boolean).join(' · ');
    rootEl.appendChild(el('div', { class: 'mk-card' }, [
      el('div', { class: 'mk-ico', style: { background: brand.brand_color || '' } }, [icon('book', 30)]),
      el('div', { class: 'mk-info' }, [
        el('p', { class: 'mk-name', text: T(`Manual de Marca · ${brand.name}`, `Brand Manual · ${brand.name}`) }),
        meta ? el('p', { class: 'mk-meta', text: meta }) : null,
      ]),
      el('div', { class: 'mk-actions' }, [
        el('a', { class: 'btn btn-primary mk-btn', href: verUrl, target: '_blank', rel: 'noopener' }, [icon('eye', 17), ' ' + T('Ver el manual', 'View the manual')]),
        el('a', { class: 'btn mk-btn', href: `${verUrl}?dl=1`, rel: 'noopener' }, [icon('download', 17), ' ' + T('Descargar PDF', 'Download PDF')]),
      ]),
    ]));
    if (!client) {
      rootEl.appendChild(el('div', { class: 'mk-staff' }, [
        el('button', { class: 'btn', type: 'button', onclick: pickFile }, [icon('refresh', 15), ' ' + T('Reemplazar PDF', 'Replace PDF')]),
        el('button', { class: 'btn mk-danger', type: 'button', onclick: removeManual }, [icon('trash', 15), ' ' + T('Quitar', 'Remove')]),
      ]));
    }
    return;
  }

  // Sin manual todavía.
  if (client) {
    rootEl.appendChild(el('div', { class: 'mk-empty' }, [
      icon('book', 30),
      el('p', { text: T('Tu manual de marca estará aquí muy pronto.', 'Your brand manual will be here very soon.') }),
    ]));
  } else {
    rootEl.appendChild(el('div', { class: 'mk-empty mk-empty--cta' }, [
      icon('book', 30),
      el('p', { text: T(`${brand.name} aún no tiene manual. Sube su PDF y el cliente lo verá aquí.`, `${brand.name} has no manual yet. Upload its PDF and the client will see it here.`) }),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: pickFile }, [icon('up', 17), ' ' + T('Subir PDF', 'Upload PDF')]),
    ]));
  }
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/marca.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/marca.css?v=202608261437';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'mk-root' });
    host.appendChild(rootEl);
    lastClientId = ctx.store.getState().activeClientId || null;
    unsubs.push(ctx.store.subscribe(['clients', 'activeClientId'], () => {
      const now = ctx.store.getState().activeClientId || null;
      if (now !== lastClientId) { lastClientId = now; load(); } else { render(); }
    }));
    load();
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null; info = null; loadErr = null; busy = false; lastClientId = null;
  },
};
