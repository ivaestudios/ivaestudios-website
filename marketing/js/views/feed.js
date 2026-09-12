// ============================================================================
// IVAE Marketing — Vista "Feed": el perfil de Instagram como va a quedar.
//
// Pedido de Vianey: ver cómo se va armando el feed antes de publicar. La
// cuadrícula respeta el orden REAL de Instagram (lo más nuevo arriba a la
// izquierda) y mezcla lo ya publicado con lo programado, para que se vea el
// mes entero como lo verá quien entre al perfil.
//
// Lo publicado va a color pleno; lo que falta, atenuado y con su día. Así se
// distingue de un vistazo qué está arriba de verdad y qué es todavía plan.
// Las imágenes salen de GET /posts/:id/slides (slides firmados + portada).
// ============================================================================
import { el, clear, api } from '../api.js?v=202609121412';
import { icon } from '../shell/icons.js?v=202609121412';
import { T } from '../shell/i18n.js?v=202609121412';
import { abrirGuion } from '../lib/guion-drawer.js?v=202609121412';

const VIEW_ID = 'feed';

let ctx = null;
let rootEl = null;
let unsubs = [];
let lastClientId = null;
let imgs = new Map();      // postId → { slides:[], portada }
let cargando = new Set();
let soloPublicado = false;

function marca() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || null;
}

/** Instagram ordena por fecha de publicación, lo más nuevo primero. */
function piezas() {
  const { posts, activeClientId } = ctx.store.getState();
  let ps = (posts || []).filter((p) => !activeClientId || activeClientId === 'todos'
    || String(p.client_id) === String(activeClientId));
  ps = ps.filter((p) => p.content_type !== 'historia');   // las historias no viven en el feed
  if (soloPublicado) ps = ps.filter((p) => p.status === 'publicado');
  return ps.sort((a, b) => String(b.publish_date || '').localeCompare(String(a.publish_date || ''))
    || String(b.publish_time || '').localeCompare(String(a.publish_time || '')));
}

async function traerImagen(id) {
  if (imgs.has(id) || cargando.has(id)) return;
  cargando.add(id);
  try {
    const r = await api.get(`/posts/${encodeURIComponent(id)}/slides`);
    imgs.set(id, { slides: r.slides || [], portada: r.portada || null });
  } catch { imgs.set(id, { slides: [], portada: null }); }
  cargando.delete(id);
  render();
}

function diaCorto(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}` : '';
}

function celda(p) {
  const dato = imgs.get(p.id);
  const src = dato ? (dato.slides[0] || dato.portada) : null;
  if (!dato) traerImagen(p.id);
  const publicado = p.status === 'publicado';

  const hijos = [];
  if (src) hijos.push(el('img', { class: 'fd-cell__img', src, alt: p.title || '', loading: 'lazy' }));
  else hijos.push(el('div', { class: 'fd-cell__vacio' }, [
    el('span', { class: 'fd-cell__vtxt', text: p.title || T('Sin título', 'Untitled') }),
  ]));

  // El icono de arriba a la derecha, igual que en Instagram.
  const ic = p.content_type === 'reel' ? 'play' : (p.content_type === 'carrusel' ? 'copy' : null);
  if (ic) hijos.push(el('span', { class: 'fd-cell__tipo' }, [icon(ic, 15)]));
  if (!publicado) {
    hijos.push(el('span', { class: 'fd-cell__dia', text: diaCorto(p.publish_date) }));
  }

  return el('button', {
    class: 'fd-cell' + (publicado ? ' is-pub' : ''),
    type: 'button',
    title: `${p.title || ''}${p.publish_date ? ' · ' + p.publish_date : ''}`,
    'aria-label': `${p.title || T('contenido', 'content')}, ${publicado ? T('publicado', 'published') : T('programado para', 'scheduled for') + ' ' + diaCorto(p.publish_date)}`,
    onclick: () => abrirGuion(p, { ctx, abrirEditor: () => ctx.openEditor(p.id) }),
  }, hijos);
}

function cabecera(ps) {
  const m = marca();
  const pub = ps.filter((p) => p.status === 'publicado').length;
  const arroba = (m && (m.instagram_handle || m.ig_username)) || '';
  return el('div', { class: 'fd-perfil' }, [
    el('div', {
      class: 'fd-perfil__av',
      style: { background: (m && m.brand_color) || '#7c3aed' },
    }, [el('span', { text: (m && m.name ? m.name : '?').slice(0, 2).toUpperCase() })]),
    el('div', { class: 'fd-perfil__col' }, [
      el('div', { class: 'fd-perfil__nom', text: arroba ? `@${arroba}` : (m ? m.name : T('Marca', 'Brand')) }),
      el('div', { class: 'fd-perfil__num' }, [
        el('b', { text: String(pub) }), el('span', { text: T(' publicados', ' published') }),
        el('b', { text: String(ps.length - pub) }), el('span', { text: T(' por salir', ' upcoming') }),
      ]),
      el('p', { class: 'fd-perfil__nota', text: T('Así se va a ver el perfil. Lo publicado a color, lo que falta con su día.', 'This is how the profile will look. Published in color, upcoming with its date.') }),
    ]),
  ]);
}

function render() {
  if (!rootEl) return;
  clear(rootEl);
  const m = marca();
  if (!m) {
    rootEl.appendChild(el('p', { class: 'fd-vacio', text: T('Elige una marca para ver su feed.', 'Pick a brand to see its feed.') }));
    return;
  }
  const ps = piezas();
  rootEl.appendChild(cabecera(ps));
  rootEl.appendChild(el('div', { class: 'fd-filtros' }, [
    el('button', {
      class: 'fd-chip' + (soloPublicado ? '' : ' is-on'), type: 'button',
      onclick: () => { soloPublicado = false; render(); },
      text: T('Todo el mes', 'Whole month'),
    }),
    el('button', {
      class: 'fd-chip' + (soloPublicado ? ' is-on' : ''), type: 'button',
      onclick: () => { soloPublicado = true; render(); },
      text: T('Solo publicado', 'Published only'),
    }),
  ]));
  if (!ps.length) {
    rootEl.appendChild(el('p', { class: 'fd-vacio', text: T('Todavía no hay contenido para el feed.', 'No content for the feed yet.') }));
    return;
  }
  const grid = el('div', { class: 'fd-grid' });
  for (const p of ps) grid.appendChild(celda(p));
  rootEl.appendChild(grid);
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/feed.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/feed.css?v=202609121412';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'fd-root' });
    host.appendChild(rootEl);
    lastClientId = ctx.store.getState().activeClientId || null;
    unsubs.push(ctx.store.subscribe(['posts', 'clients', 'activeClientId'], () => {
      const now = ctx.store.getState().activeClientId || null;
      if (now !== lastClientId) { lastClientId = now; imgs = new Map(); }
      render();
    }));
    render();
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null; imgs = new Map(); cargando = new Set(); soloPublicado = false;
  },
};
