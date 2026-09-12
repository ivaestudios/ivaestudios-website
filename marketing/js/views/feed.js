// ============================================================================
// IVAE Marketing — Vista "Feed": un SIMULADOR del perfil de Instagram.
//
// Pedido de Vianey: "un simulador de feed de insta". No es una cuadrícula con
// los colores de la app: es el teléfono, con el perfil como se ve en Instagram
// (foto, seguidores, biografía, destacadas, pestañas y la retícula 4:5), y al
// tocar una pieza se abre la publicación como se verá allá, con su caption,
// sus hashtags y el carrusel deslizable.
//
// De dónde sale cada cosa:
//   · lo YA publicado  → GET /ig/feed (perfil real + últimas publicaciones)
//   · lo que falta     → las piezas del sistema (store.posts), con sus fotos
//                        firmadas de GET /posts/:id/slides
// Las dos se mezclan en el orden real de Instagram (lo más nuevo arriba a la
// izquierda), así que lo programado se ve cayendo encima del feed de verdad.
// Una pieza ya publicada por el sistema (published_media_id) NO se duplica:
// se reconoce en su media de Instagram y sigue abriendo su guion.
//
// El cromo de Instagram (iconos, barra de estado, nav de abajo) se dibuja aquí
// mismo: es atrezzo del simulador, no iconografía de la app, y no tiene por
// qué ensuciar shell/icons.js.
// ============================================================================
import { el, clear, api, toast } from '../api.js?v=202609121543';
import { T, isEN } from '../shell/i18n.js?v=202609121543';
import { abrirGuion } from '../lib/guion-drawer.js?v=202609121543';

const VIEW_ID = 'feed';

let ctx = null;
let rootEl = null;
let unsubs = [];
let lastClientId = null;

let imgs = new Map();        // postId → { slides:[], portada }
let pidiendo = new Set();
let real = null;             // respuesta de /ig/feed
let realEstado = 'idle';     // idle | cargando | listo | sin-conexion | error
let conPublicado = true;     // mezclar lo que ya está en Instagram
let marcarNuevo = true;      // chip con el día en lo que aún no sale
let pestana = 'grid';        // grid | reels
let abierta = null;          // celda abierta en vista de publicación
let slideIx = 0;             // slide del carrusel abierto

// ── Cromo de Instagram: SVG dibujado a mano ─────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
function svg(d, size, o) {
  const op = o || {};
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', op.box || '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', op.fill || 'none');
  s.setAttribute('stroke', op.stroke === null ? 'none' : (op.stroke || 'currentColor'));
  s.setAttribute('stroke-width', op.sw == null ? 1.7 : op.sw);
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  for (const dd of (Array.isArray(d) ? d : [d])) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', dd);
    s.appendChild(p);
  }
  return s;
}
const G = {
  atras: 'M15 4l-8 8 8 8',
  abajo: 'M6 9.5l6 6 6-6',
  mas: ['M4.6 3.6h14.8a1 1 0 0 1 1 1v14.8a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z', 'M12 8.2v7.6', 'M8.2 12h7.6'],
  menu: ['M3.6 6.6h16.8', 'M3.6 12h16.8', 'M3.6 17.4h16.8'],
  corazon: 'M12 20.4c-.3 0-.6-.1-.8-.3C7.6 17 3 13.4 3 9.2 3 6.3 5.1 4.2 7.7 4.2c1.7 0 3.3.9 4.3 2.3 1-1.4 2.6-2.3 4.3-2.3C18.9 4.2 21 6.3 21 9.2c0 4.2-4.6 7.8-8.2 10.9-.2.2-.5.3-.8.3z',
  globo: 'M20.6 11.6c0 4.3-3.8 7.8-8.6 7.8-1.2 0-2.4-.2-3.4-.6l-5.2 1.6 1.7-4.5c-.9-1.2-1.4-2.7-1.4-4.3 0-4.3 3.8-7.8 8.3-7.8s8.6 3.5 8.6 7.8z',
  avion: ['M21.4 3.1L2.7 10.3a.45.45 0 0 0 .02.85l6.9 2.2 2.2 6.9c.13.4.69.42.85.02L21.4 3.1z', 'M21.4 3.1l-11.8 10.2'],
  marcador: 'M18.4 20.6l-6.4-4.5-6.4 4.5V4.6a1 1 0 0 1 1-1h10.8a1 1 0 0 1 1 1v16z',
  cuadricula: ['M3.4 3.4h17.2v17.2H3.4z', 'M9.13 3.4v17.2', 'M14.87 3.4v17.2', 'M3.4 9.13h17.2', 'M3.4 14.87h17.2'],
  reels: ['M3.4 3.4h17.2v17.2H3.4z', 'M3.4 8.9h17.2', 'M8.3 3.4l2.8 5.5', 'M14.6 3.4l2.8 5.5', 'M10.3 12.2l4.7 2.9-4.7 2.9v-5.8z'],
  etiquetas: ['M3.4 3.4h17.2v17.2H3.4z', 'M12 11.3a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z', 'M6.9 18.6c.8-2.7 2.8-4.1 5.1-4.1s4.3 1.4 5.1 4.1'],
  carrusel: ['M8.6 3.6h11.8v11.8', 'M3.6 8.6h10.8a1 1 0 0 1 1 1v10.8a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1z'],
  casa: ['M3.2 10.4L12 3.3l8.8 7.1', 'M5.7 9.2v11.5h12.6V9.2'],
  lupa: ['M11 18.6a7.6 7.6 0 1 0 0-15.2 7.6 7.6 0 0 0 0 15.2z', 'M20.7 20.7l-4.3-4.3'],
  tienda: ['M3.9 7.6h16.2l-1.2 12a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9l-1.2-12z', 'M8.5 7.6V6a3.5 3.5 0 0 1 7 0v1.6'],
  senal: 'M2.2 13.6h2.2v4.6H2.2zM6.6 10.6h2.2v7.6H6.6zM11 7.6h2.2v10.6H11zM15.4 4.6h2.2v13.6h-2.2z',
  wifi: ['M3.2 9.2a13 13 0 0 1 17.6 0', 'M6.2 12.4a8.6 8.6 0 0 1 11.6 0', 'M9.2 15.6a4.2 4.2 0 0 1 5.6 0', 'M12 18.6h.01'],
  pila: ['M2.6 7.8h15.6a1.6 1.6 0 0 1 1.6 1.6v5.2a1.6 1.6 0 0 1-1.6 1.6H2.6a1 1 0 0 1-1-1V8.8a1 1 0 0 1 1-1z', 'M21.4 11v2'],
  reloj: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.2V12l3.2 2'],
  puntos: ['M5.2 12h.01', 'M12 12h.01', 'M18.8 12h.01'],
  nota: ['M9 18V5.5l10-2V16', 'M6.6 20.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z', 'M16.6 18.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z'],
  camara: ['M3.4 8.2h3l1.3-2.2h6.6l1.3 2.2h3a1.4 1.4 0 0 1 1.4 1.4v8a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 17.6v-8a1.4 1.4 0 0 1 1.4-1.4z', 'M12 16.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z'],
};

/**
 * Una foto que no se rompe en la cara: si la URL falla (una firma vencida, el
 * CDN de Instagram caducado) deja un hueco con el texto en vez del icono roto
 * del navegador, que sí se vería como un error de la app.
 */
/** ¿Esta URL es un video? (el CDN de Instagram no usa extensión .mp4) */
function esVideo(src) {
  const u = String(src || '');
  return /\.mp4(\?|#|$)/i.test(u)
    || /cdninstagram\.com\/o1\/v\//.test(u) || /\/v\/t2\//.test(u)   // CDN de video de Instagram
    || /\/publico\/entregable\/[^/]+\/video/.test(u);                // el entregable de la pieza
}

/**
 * El medio de un mosaico. Cuando Instagram no da miniatura de un reel, la
 * única portada es el video: se pinta con <video> (primer fotograma, y en el
 * reproductor además rueda). Un <img> con un MP4 dentro solo sabe romperse.
 */
function medio(src, opciones) {
  const o = opciones || {};
  if (!esVideo(src)) return foto(src);
  const v = el('video', {
    // sin rodar se busca el primer fotograma (un #t= adelanta lo justo para que
    // el navegador pinte algo en vez de negro)
    class: 'igs-foto', src: o.rodar ? String(src) : String(src) + '#t=0.6',
    preload: o.rodar ? 'auto' : 'metadata',
    playsinline: '', 'webkit-playsinline': '', loop: o.rodar ? '' : null, controls: null,
    onerror: (e) => {
      const n = e.currentTarget; const padre = n.parentNode;
      if (!padre) return;
      n.remove();
      padre.appendChild(el('span', { class: 'igs-cell__sin' }, [
        el('span', { text: T('Video no disponible', 'Video unavailable') }),
      ]));
    },
  });
  v.muted = true;                      // propiedad, no atributo: sin esto no rueda
  if (o.rodar) { v.autoplay = true; try { v.play().catch(() => {}); } catch { /* el navegador decide */ } }
  return v;
}

function foto(src, alt) {
  return el('img', {
    class: 'igs-foto', src, alt: alt || '', loading: 'lazy', referrerpolicy: 'no-referrer',
    onerror: (e) => {
      const n = e.currentTarget;
      const padre = n.parentNode;
      if (!padre) return;
      n.remove();
      padre.appendChild(el('span', { class: 'igs-cell__sin' }, [
        el('span', { text: T('Foto no disponible', 'Image unavailable') }),
      ]));
    },
  });
}

// ── Datos ───────────────────────────────────────────────────────────────────
function marca() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || null;
}

function piezasDeLaMarca() {
  const { posts, activeClientId } = ctx.store.getState();
  return (posts || []).filter((p) => String(p.client_id) === String(activeClientId));
}

/** Una fecha comparable para ordenar como ordena Instagram (lo nuevo primero). */
function cuando(fecha, hora) {
  return `${fecha || '0000-00-00'}T${(hora || '11:00')}:00`;
}

/**
 * La retícula: lo que YA está en Instagram + lo que falta por salir, mezclado
 * en un solo orden. Una pieza publicada por el sistema se reconoce por su
 * published_media_id y se funde con su media real (no se duplica).
 */
function celdas(soloPestana) {
  const piezas = piezasDeLaMarca().filter((p) => p.content_type !== 'historia');
  const porMedia = new Map();
  for (const p of piezas) if (p.published_media_id) porMedia.set(String(p.published_media_id), p);

  const out = [];
  const usadas = new Set();
  // Celdas reales libres por día+tipo: sirven para reconocer las piezas que
  // Vianey publicó A MANO (no tienen published_media_id y, sin esto, salían
  // DOS veces: la media de Instagram y su ficha del sistema).
  const libres = new Map();

  if (conPublicado && real && real.posts) {
    for (const m of real.posts) {
      const p = porMedia.get(String(m.id)) || null;
      if (p) usadas.add(p.id);
      const celda = {
        clave: `ig:${m.id}`,
        origen: 'ig',
        media: m,
        post: p,
        tipo: m.tipo,
        publicado: true,
        orden: String(m.timestamp || '').slice(0, 19),
        fecha: String(m.timestamp || '').slice(0, 10),
      };
      out.push(celda);
      if (!p) {
        const k = `${celda.fecha}|${celda.tipo}`;
        if (!libres.has(k)) libres.set(k, []);
        libres.get(k).push(celda);
      }
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const hayReal = !!(conPublicado && real && real.posts && real.posts.length);
  for (const p of piezas) {
    if (usadas.has(p.id)) continue;
    // Sin conexión a Instagram, lo ya publicado por el sistema sigue contando.
    if (p.published_media_id && conPublicado && real && real.posts) continue;
    // Publicada a mano: se funde con su media real del mismo día y tipo (y esa
    // celda hereda el guion, para que tocarla siga abriendo la pieza).
    const tipoP = p.content_type === 'reel' ? 'reel' : (p.content_type === 'carrusel' ? 'carrusel' : 'post');
    if (libres.size && p.publish_date && p.publish_date <= hoy) {
      const cola = libres.get(`${p.publish_date}|${tipoP}`);
      if (cola && cola.length) { cola.shift().post = p; continue; }
    }
    // Con el feed real delante, el PASADO lo cuenta Instagram: una ficha vieja
    // que no casó con ninguna media, o nunca salió (y entonces no está en el
    // perfil), o está más atrás de las que trajimos. Pintarla dejaba mosaicos
    // grises en mitad del feed de verdad. Sin conexión sí se muestran: ahí la
    // vista es el plan, no el perfil.
    if (hayReal && (!p.publish_date || p.publish_date < hoy)) continue;
    out.push({
      clave: `plan:${p.id}`,
      origen: 'plan',
      media: null,
      post: p,
      tipo: tipoP,
      publicado: p.status === 'publicado',
      orden: cuando(p.publish_date, p.publish_time),
      fecha: p.publish_date || '',
    });
  }

  out.sort((a, b) => String(b.orden).localeCompare(String(a.orden)));
  // Las cuentas del perfil son del PERFIL, no de la pestaña: la cabecera pide
  // la lista completa aunque la retícula esté enseñando solo los reels.
  if (soloPestana && pestana === 'reels') return out.filter((c) => c.tipo === 'reel');
  return out;
}

function destacadas() {
  return piezasDeLaMarca()
    .filter((p) => p.content_type === 'historia')
    .sort((a, b) => String(a.publish_date || '').localeCompare(String(b.publish_date || '')));
}

async function traerImagen(id) {
  if (imgs.has(id) || pidiendo.has(id)) return;
  pidiendo.add(id);
  try {
    const r = await api.get(`/posts/${encodeURIComponent(id)}/slides`);
    imgs.set(id, { slides: r.slides || [], portada: r.portada || null, video: r.video || null });
  } catch { imgs.set(id, { slides: [], portada: null, video: null }); }
  pidiendo.delete(id);
  pintarEsperas(id);
}

/**
 * Pinta las fotos que iban llegando SIN redibujar la vista: la retícula vive
 * dentro de un panel con scroll propio y un render completo lo mandaría al
 * principio en cada foto que aterriza.
 */
function pintarEsperas(id) {
  if (!rootEl) return;
  const dato = imgs.get(id);
  const pieza = (ctx.store.getState().posts || []).find((x) => x.id === id) || null;
  const esReel = pieza && pieza.content_type === 'reel';
  const src = dato
    ? (esReel ? (dato.portada || dato.slides[0]) : (dato.slides[0] || dato.portada))
    : null;
  for (const hueco of rootEl.querySelectorAll(`[data-espera="${cssEscape(id)}"]`)) {
    hueco.removeAttribute('data-espera');
    if (hueco.classList.contains('igs-hl__v')) {      // círculo de destacadas
      if (src) { clear(hueco); hueco.appendChild(medio(src)); }
      continue;
    }
    clear(hueco);
    // Sin arte todavía, el mosaico lleva el título: dejarlo en blanco era un
    // agujero mudo en la retícula (medido en SMILE: 13 celdas vacías).
    hueco.appendChild(src ? medio(src) : el('span', { class: 'igs-cell__sin' }, [
      el('span', { text: (pieza && pieza.title) || T('Sin título', 'Untitled') }),
    ]));
  }
  if (abierta && abierta.post && abierta.post.id === id) render();
}

/**
 * Una marca con meses de calendario llega a 70 mosaicos y pedir las 70 fotos
 * de golpe es castigar a la app (y a R2) por algo que nadie está mirando: se
 * piden cuando el mosaico se acerca a la pantalla.
 */
let observador = null;
function mirar(nodos, raiz) {
  if (observador) { observador.disconnect(); observador = null; }
  if (!nodos.length) return;
  if (typeof IntersectionObserver !== 'function') {
    for (const n of nodos) traerImagen(n.dataset.espera);
    return;
  }
  observador = new IntersectionObserver((entradas, obs) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const id = e.target.dataset.espera;
      if (id) traerImagen(id);
    }
  }, { root: raiz || null, rootMargin: '320px 0px' });
  for (const n of nodos) observador.observe(n);
}

function cssEscape(v) {
  return (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&');
}

// La portada de la celda: la foto real de Instagram o la de la pieza.
function fotoDe(c) {
  if (c.origen === 'ig') return c.media.thumb || null;
  const dato = imgs.get(c.post.id);
  if (!dato) return undefined;   // undefined = todavía no se ha pedido
  // Un reel se ve por su PORTADA; un carrusel, por su primer slide (como en IG).
  return c.tipo === 'reel'
    ? (dato.portada || dato.slides[0] || null)
    : (dato.slides[0] || dato.portada || null);
}

function slidesDe(c) {
  if (c.origen === 'ig') return (c.media.slides && c.media.slides.length) ? c.media.slides : (c.media.thumb ? [c.media.thumb] : []);
  const dato = imgs.get(c.post.id);
  if (!dato) { traerImagen(c.post.id); return null; }
  if (c.tipo === 'reel') return dato.portada ? [dato.portada] : dato.slides.slice(0, 1);
  return dato.slides.length ? dato.slides : (dato.portada ? [dato.portada] : []);
}

// ── Formato ─────────────────────────────────────────────────────────────────
const MESES = isEN
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function numero(n) {
  if (n == null) return '—';
  if (n < 10000) return Number(n).toLocaleString(isEN ? 'en-US' : 'es-MX');
  if (n < 1e6) {
    const k = n / 1000;
    return (k >= 100 ? String(Math.round(k)) : k.toFixed(1).replace(/\.0$/, '')) + (isEN ? 'K' : ' mil');
  }
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' M';
}

function diaCorto(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  if (p.length !== 3) return '';
  return `${Number(p[2])} ${MESES[Number(p[1]) - 1] || ''}`;
}

function fechaLarga(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  if (p.length !== 3) return '';
  return isEN ? `${MESES[Number(p[1]) - 1]} ${Number(p[2])}, ${p[0]}` : `${Number(p[2])} de ${MESES[Number(p[1]) - 1]}`;
}

function haceCuanto(ts) {
  if (!ts) return '';
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return isEN ? `${min}m` : `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return isEN ? `${h}h` : `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 8) return isEN ? `${d}d` : `hace ${d} d`;
  return fechaLarga(String(ts).slice(0, 10));
}

function captionNodos(txt) {
  const out = [];
  for (const parte of String(txt || '').split(/(#[\p{L}\p{N}_]+|@[A-Za-z0-9._]+)/gu)) {
    if (!parte) continue;
    if (/^[#@]/.test(parte)) out.push(el('span', { class: 'igs-az', text: parte }));
    else out.push(document.createTextNode(parte));
  }
  return out;
}

function textoDePieza(p) {
  if (!p) return '';
  const cap = String(p.caption || '').trim();
  const tags = String(p.hashtags || '').trim();
  if (cap && tags) return `${cap}\n\n${tags}`;
  if (cap) return cap;
  if (tags) return tags;
  // Sin caption todavía: se arma con lo que hay del guion, para no mentir vacío.
  return [p.hook, p.body, p.cta].map((s) => String(s || '').trim()).filter(Boolean).join('\n\n');
}

function arroba() {
  const m = marca();
  if (real && real.perfil && real.perfil.username) return real.perfil.username;
  if (m && (m.ig_username || m.instagram_handle)) return m.ig_username || m.instagram_handle;
  if (!m) return '';
  return String(m.name || '').toLowerCase().replace(/[^a-z0-9._]+/g, '');
}

// ── Cromo del teléfono ──────────────────────────────────────────────────────
function barraEstado() {
  return el('div', { class: 'igs-status' }, [
    el('span', { class: 'igs-status__h', text: '9:41' }),
    el('span', { class: 'igs-status__ic' }, [
      svg(G.senal, 15, { fill: 'currentColor', stroke: null }),
      svg(G.wifi, 15, { sw: 1.9 }),
      svg(G.pila, 17, { sw: 1.4 }),
    ]),
  ]);
}

function avatar(tam, conAro) {
  const m = marca();
  const cara0 = real && real.perfil && real.perfil.foto;
  const inicial = (m && m.name ? m.name : '?').slice(0, 2).toUpperCase();
  const cara = cara0
    ? el('img', { class: 'igs-av__img', src: cara0, alt: '', referrerpolicy: 'no-referrer' })
    : el('span', {
      class: 'igs-av__txt',
      style: { background: (m && m.brand_color) || '#7c3aed', fontSize: `${Math.round(tam / 2.9)}px` },
      text: inicial,
    });
  return el('span', {
    class: 'igs-av' + (conAro ? ' is-aro' : ''),
    style: { width: `${tam}px`, height: `${tam}px` },
  }, [cara]);
}

function barraArriba() {
  if (abierta) {
    return el('div', { class: 'igs-top' }, [
      el('button', {
        class: 'igs-top__b', type: 'button', 'aria-label': T('Volver al perfil', 'Back to profile'),
        onclick: () => { abierta = null; slideIx = 0; render(); },
      }, [svg(G.atras, 22)]),
      el('span', { class: 'igs-top__t', text: T('Publicación', 'Post') }),
      el('span', { class: 'igs-top__b igs-top__b--off' }, [svg(G.corazon, 22)]),
    ]);
  }
  return el('div', { class: 'igs-top' }, [
    el('span', { class: 'igs-top__user' }, [
      el('b', { text: arroba() || T('marca', 'brand') }),
      svg(G.abajo, 15, { sw: 2.2 }),
    ]),
    el('span', { class: 'igs-top__der' }, [svg(G.mas, 22), svg(G.menu, 22)]),
  ]);
}

function barraAbajo() {
  return el('div', { class: 'igs-nav' }, [
    svg(G.casa, 24, { fill: 'currentColor', stroke: null }),
    svg(G.lupa, 24),
    svg(G.reels, 24),
    svg(G.tienda, 24),
    avatar(25, false),
  ]);
}

// ── Perfil ──────────────────────────────────────────────────────────────────
function cabeceraPerfil(lista) {
  const m = marca();
  const per = (real && real.perfil) || null;
  const programadas = lista.filter((c) => c.origen === 'plan' && !c.publicado).length;
  // Con el interruptor apagado la cuenta es la de la retícula (lo que se ve),
  // no la del perfil real: decir 24 con 19 mosaicos en pantalla confunde.
  const yaHay = (conPublicado && per && per.media_count != null)
    ? per.media_count
    : lista.filter((c) => c.publicado).length;
  const nombre = (per && per.name) || (m ? m.name : '');
  const bio = per ? per.biography : '';
  const web = per ? per.website : '';

  const dato = (n, etq) => el('span', { class: 'igs-dato' }, [
    el('b', { text: n }), el('small', { text: etq }),
  ]);

  const hijos = [
    el('div', { class: 'igs-cab' }, [
      avatar(86, destacadas().length > 0),
      el('div', { class: 'igs-datos' }, [
        dato(numero(yaHay + programadas), T('publicaciones', 'posts')),
        dato(numero(per ? per.followers : null), T('seguidores', 'followers')),
        dato(numero(per ? per.follows : null), T('seguidos', 'following')),
      ]),
    ]),
    el('div', { class: 'igs-bio' }, [
      el('div', { class: 'igs-bio__n', text: nombre }),
      bio ? el('div', { class: 'igs-bio__t', text: bio }) : null,
      web ? el('div', { class: 'igs-bio__w', text: String(web).replace(/^https?:\/\//, '') }) : null,
    ]),
    el('div', { class: 'igs-acc' }, [
      el('span', { class: 'igs-acc__b is-pri', text: T('Seguir', 'Follow') }),
      el('span', { class: 'igs-acc__b', text: T('Mensaje', 'Message') }),
      el('span', { class: 'igs-acc__b is-mini' }, [svg(G.abajo, 15, { sw: 2.2 })]),
    ]),
  ];

  const hist = destacadas();
  if (hist.length) {
    hijos.push(el('div', { class: 'igs-hl' }, hist.map((h) => el('span', { class: 'igs-hl__i' }, [
      el('span', { class: 'igs-hl__c' }, [
        (imgs.get(h.id) && (imgs.get(h.id).portada || imgs.get(h.id).slides[0]))
          ? foto(imgs.get(h.id).slides[0] || imgs.get(h.id).portada)
          : el('span', { class: 'igs-hl__v', 'data-espera': imgs.has(h.id) ? null : h.id }),
      ]),
      el('small', { text: String(h.title || '').slice(0, 12) }),
    ]))));
    for (const h of hist) if (!imgs.has(h.id)) traerImagen(h.id);
  }

  hijos.push(el('div', { class: 'igs-tabs' }, [
    el('button', {
      class: 'igs-tab' + (pestana === 'grid' ? ' is-on' : ''), type: 'button',
      'aria-label': T('Publicaciones', 'Posts'),
      onclick: () => { pestana = 'grid'; render(); },
    }, [svg(G.cuadricula, 23, { sw: 1.5 })]),
    el('button', {
      class: 'igs-tab' + (pestana === 'reels' ? ' is-on' : ''), type: 'button',
      'aria-label': 'Reels',
      onclick: () => { pestana = 'reels'; render(); },
    }, [svg(G.reels, 23, { sw: 1.5 })]),
    el('span', { class: 'igs-tab is-off' }, [svg(G.etiquetas, 23, { sw: 1.5 })]),
  ]));

  return hijos;
}

// ── Retícula ────────────────────────────────────────────────────────────────
function celdaNodo(c) {
  const src = fotoDe(c);
  const caja = el('span', { class: 'igs-cell__m' });
  if (src) caja.appendChild(medio(src));
  else if (src === undefined) caja.dataset.espera = c.post.id;
  else {
    caja.appendChild(el('span', { class: 'igs-cell__sin' }, [
      el('span', { text: (c.post && c.post.title) || '' }),
    ]));
  }

  const hijos = [caja];
  if (c.tipo === 'reel') hijos.push(el('span', { class: 'igs-cell__ic' }, [svg(G.reels, 17, { sw: 1.8 })]));
  else if (c.tipo === 'carrusel') hijos.push(el('span', { class: 'igs-cell__ic' }, [svg(G.carrusel, 17, { sw: 1.8 })]));
  if (marcarNuevo && !c.publicado) {
    hijos.push(el('span', { class: 'igs-cell__dia', text: diaCorto(c.fecha) || T('sin fecha', 'no date') }));
  }

  return el('button', {
    class: 'igs-cell' + (c.publicado ? '' : ' is-plan'),
    type: 'button',
    title: (c.post && c.post.title) || (c.media && c.media.caption ? c.media.caption.slice(0, 60) : ''),
    onclick: () => { abierta = c; slideIx = 0; render(); },
  }, hijos);
}

// ── Publicación abierta ─────────────────────────────────────────────────────
function vistaPost(c) {
  const p = c.post;
  const slides = slidesDe(c);          // null = las fotos vienen en camino
  const total = slides ? slides.length : 0;
  const ix = Math.min(slideIx, Math.max(0, total - 1));
  const texto = c.origen === 'ig' ? (c.media.caption || textoDePieza(p)) : textoDePieza(p);
  const nombre = arroba();

  const lienzo = el('div', { class: 'igs-pm' + (c.tipo === 'reel' ? ' is-reel' : '') });
  if (total) {
    lienzo.appendChild(medio(slides[ix], { rodar: true }));
  } else if (!slides) {
    lienzo.appendChild(el('div', { class: 'igs-pm__v', text: T('Cargando…', 'Loading…') }));
  } else {
    lienzo.appendChild(el('div', { class: 'igs-pm__v', text: T('Esta pieza todavía no tiene imagen.', 'This piece has no image yet.') }));
  }
  if (total > 1) {
    lienzo.appendChild(el('span', { class: 'igs-pm__n', text: `${ix + 1}/${total}` }));
    lienzo.appendChild(el('button', {
      class: 'igs-pm__f is-izq', type: 'button', 'aria-label': T('Anterior', 'Previous'),
      onclick: () => { slideIx = (ix - 1 + total) % total; render(); },
    }, [svg(G.atras, 16, { sw: 2.4 })]));
    lienzo.appendChild(el('button', {
      class: 'igs-pm__f is-der', type: 'button', 'aria-label': T('Siguiente', 'Next'),
      onclick: () => { slideIx = (ix + 1) % total; render(); },
    }, [svg(G.atras, 16, { sw: 2.4 })]));
    lienzo.appendChild(el('span', { class: 'igs-pm__p' }, slides.map((_s, i) => el('i', { class: i === ix ? 'is-on' : '' }))));
  }

  const cuando_ = c.origen === 'ig'
    ? haceCuanto(c.media.timestamp)
    : `${c.publicado ? T('Publicado', 'Published') : T('Programado', 'Scheduled')} · ${fechaLarga(c.fecha)}${p && p.publish_time ? ' · ' + p.publish_time : ''}`;

  return el('div', { class: 'igs-post' }, [
    el('div', { class: 'igs-ph' }, [
      avatar(34, false),
      el('div', { class: 'igs-ph__t' }, [
        el('b', { text: nombre }),
        p && p.title ? el('small', { text: p.title }) : null,
      ]),
      el('span', { class: 'igs-ph__d' }, [svg(G.puntos, 18, { sw: 2.6 })]),
    ]),
    lienzo,
    el('div', { class: 'igs-pa' }, [
      el('span', { class: 'igs-pa__g' }, [svg(G.corazon, 24), svg(G.globo, 24), svg(G.avion, 24)]),
      el('span', { class: 'igs-pa__m' }, [svg(G.marcador, 24)]),
    ]),
    el('div', { class: 'igs-pb' }, [
      c.origen === 'ig' && c.media.likes != null
        ? el('div', { class: 'igs-pb__l', text: `${numero(c.media.likes)} ${T('me gusta', 'likes')}` })
        : null,
      texto
        ? el('div', { class: 'igs-pb__c' }, [el('b', { text: nombre + ' ' })].concat(captionNodos(texto)))
        : el('div', { class: 'igs-pb__c igs-pb__c--vacio', text: T('Sin caption todavía.', 'No caption yet.') }),
      c.origen === 'ig' && c.media.comments
        ? el('div', { class: 'igs-pb__v', text: `${T('Ver los', 'View all')} ${numero(c.media.comments)} ${T('comentarios', 'comments')}` })
        : null,
      el('div', { class: 'igs-pb__f', text: cuando_ }),
    ]),
  ]);
}

/**
 * El caption de un reel se lee en DOS renglones sobre el video: Instagram
 * aplasta los saltos de línea y corta con "más". Sin aplastarlos, un caption
 * con renglón en blanco gastaba el segundo renglón en tres puntos sueltos.
 */
function capReel(txt) {
  const plano = String(txt || '').replace(/\s*\n+\s*/g, '  ').trim();
  if (!plano) return el('div', { class: 'igs-rl__cap', text: T('Sin caption todavía.', 'No caption yet.') });
  if (plano.length <= 96) return el('div', { class: 'igs-rl__cap' }, captionNodos(plano));
  return el('div', { class: 'igs-rl__cap' },
    captionNodos(plano.slice(0, 96).trim() + '… ').concat([el('span', { class: 'igs-rl__mas', text: T('más', 'more') })]));
}

/**
 * Un reel NO se abre como una foto: Instagram lo manda a pantalla completa,
 * con el video a sangre, los números por la derecha y el texto encima abajo.
 * Simularlo como publicación cuadrada sería mentirle a Vianey justo en el
 * formato del que más piezas hace.
 */
function vistaReel(c) {
  const p = c.post;
  const slides = slidesDe(c);
  // Con el video del entregable, el reel RUEDA en el simulador; si no, queda
  // su portada quieta (que es justo lo que Instagram enseña en la retícula).
  const dato = p ? imgs.get(p.id) : null;
  const src = (dato && dato.video) || (slides && slides.length ? slides[0] : null);
  const texto = c.origen === 'ig' ? (c.media.caption || textoDePieza(p)) : textoDePieza(p);
  const nombre = arroba();
  const accion = (glifo, n) => el('span', { class: 'igs-rl__a' }, [
    svg(glifo, 26, { sw: 1.9 }),
    el('span', { class: 'igs-rl__n', text: n == null ? '' : numero(n) }),
  ]);

  const hijos = [];
  if (src) hijos.push(medio(src, { rodar: true }));
  else {
    hijos.push(el('div', { class: 'igs-rl__v', text: slides === null
      ? T('Cargando…', 'Loading…')
      : T('Este reel todavía no tiene portada.', 'This reel has no cover yet.') }));
  }
  hijos.push(el('div', { class: 'igs-rl__sombra' }));
  hijos.push(el('div', { class: 'igs-rl__top' }, [
    el('button', {
      class: 'igs-rl__b', type: 'button', 'aria-label': T('Volver al perfil', 'Back to profile'),
      onclick: () => { abierta = null; slideIx = 0; render(); },
    }, [svg(G.atras, 22, { sw: 2 })]),
    el('b', { text: 'Reels' }),
    el('span', { class: 'igs-rl__cam' }, [svg(G.camara, 22)]),
  ]));
  hijos.push(el('div', { class: 'igs-rl__der' }, [
    accion(G.corazon, c.origen === 'ig' ? c.media.likes : null),
    accion(G.globo, c.origen === 'ig' ? c.media.comments : null),
    accion(G.avion, null),
    accion(G.marcador, null),
    el('span', { class: 'igs-rl__a' }, [svg(G.puntos, 20, { sw: 2.6 })]),
  ]));
  hijos.push(el('div', { class: 'igs-rl__pie' }, [
    el('div', { class: 'igs-rl__au' }, [
      avatar(30, false),
      el('b', { text: nombre }),
      el('span', { class: 'igs-rl__seg', text: T('Seguir', 'Follow') }),
    ]),
    capReel(texto),
    el('div', { class: 'igs-rl__mus' }, [
      svg(G.nota, 13, { sw: 2 }),
      el('span', { text: `${nombre} · ${T('audio original', 'original audio')}` }),
    ]),
    el('div', { class: 'igs-rl__f', text: c.origen === 'ig'
      ? haceCuanto(c.media.timestamp)
      : `${c.publicado ? T('Publicado', 'Published') : T('Programado', 'Scheduled')} · ${fechaLarga(c.fecha)}${p && p.publish_time ? ' · ' + p.publish_time : ''}` }),
  ]));
  return el('div', { class: 'igs-rl' }, hijos);
}

// ── Controles de la app (fuera del teléfono) ────────────────────────────────
function chip(texto, activo, onclick, titulo) {
  return el('button', {
    class: 'igs-chip' + (activo ? ' is-on' : ''), type: 'button', onclick, title: titulo || '',
  }, [texto]);
}

function controles() {
  const hijos = [];
  if (realEstado === 'listo') {
    hijos.push(chip(T('Con lo ya publicado', 'With what is live'), conPublicado,
      () => { conPublicado = !conPublicado; abierta = null; render(); },
      T('Mezcla las publicaciones que ya están en Instagram', 'Mixes in the posts already on Instagram')));
  }
  hijos.push(chip(T('Señalar lo nuevo', 'Flag the new ones'), marcarNuevo,
    () => { marcarNuevo = !marcarNuevo; render(); },
    T('Pone el día encima de lo que aún no sale', 'Puts the day on top of what is not out yet')));
  if (realEstado === 'listo') {
    hijos.push(el('button', {
      class: 'igs-chip', type: 'button',
      onclick: () => { cargarReal(true); },
      title: T('Vuelve a pedir el perfil a Instagram', 'Asks Instagram for the profile again'),
    }, [T('Actualizar', 'Refresh')]));
  }
  return el('div', { class: 'igs-ctrl' }, hijos);
}

function pie(lista) {
  const prog = lista.filter((c) => !c.publicado).length;
  const linea = realEstado === 'cargando'
    ? T('Trayendo el perfil de Instagram…', 'Fetching the Instagram profile…')
    : realEstado === 'sin-conexion'
      ? T('Esta marca no tiene Instagram conectado: se ve solo lo planeado.', 'This brand has no Instagram connected: only the plan is shown.')
      : realEstado === 'error'
        ? T('Instagram no respondió; se ve solo lo planeado.', 'Instagram did not answer; only the plan is shown.')
        : `${prog} ${T('por salir', 'upcoming')} · ${T('toca una pieza para verla como se publicará', 'tap a piece to see it as it will be published')}`;
  const fila = [el('span', { class: 'igs-pie__t', text: linea })];
  if (abierta && abierta.post) {
    fila.push(el('button', {
      class: 'igs-pie__b', type: 'button',
      onclick: () => abrirGuion(abierta.post, { ctx, abrirEditor: () => ctx.openEditor(abierta.post.id) }),
    }, [T('Ver guion', 'See script')]));
  }
  if (abierta && abierta.origen === 'ig' && abierta.media.permalink) {
    fila.push(el('a', {
      class: 'igs-pie__b', href: abierta.media.permalink, target: '_blank', rel: 'noopener',
    }, [T('Abrir en Instagram', 'Open on Instagram')]));
  }
  return el('div', { class: 'igs-pie' }, fila);
}

// ── Render ──────────────────────────────────────────────────────────────────
let porMirar = [];
function render() {
  if (!rootEl) return;
  const scroller = rootEl.querySelector('.igs-scroll');
  const scroll = scroller ? scroller.scrollTop : 0;
  clear(rootEl);

  const m = marca();
  if (!m) {
    rootEl.appendChild(el('p', { class: 'igs-vacio', text: T('Elige una marca para ver su feed.', 'Pick a brand to see its feed.') }));
    return;
  }

  const todas = celdas(false);
  const lista = pestana === 'reels' ? todas.filter((c) => c.tipo === 'reel') : todas;
  const esReel = !!(abierta && abierta.tipo === 'reel');
  const dentro = el('div', { class: 'igs-scroll' + (esReel ? ' is-full' : '') });
  if (esReel) {
    dentro.appendChild(vistaReel(abierta));
  } else if (abierta) {
    dentro.appendChild(vistaPost(abierta));
  } else {
    for (const n of cabeceraPerfil(todas)) dentro.appendChild(n);
    if (!lista.length) {
      dentro.appendChild(el('p', { class: 'igs-nada', text: pestana === 'reels'
        ? T('Todavía no hay reels.', 'No reels yet.')
        : T('Todavía no hay contenido para el feed.', 'No content for the feed yet.') }));
    } else {
      const grid = el('div', { class: 'igs-grid' + (pestana === 'reels' ? ' is-reels' : '') });
      for (const c of lista) grid.appendChild(celdaNodo(c));
      dentro.appendChild(grid);
      porMirar = [...grid.querySelectorAll('[data-espera]')];
    }
  }

  const pantalla = el('div', { class: 'igs-screen' + (esReel ? ' is-oscuro' : '') }, [
    el('span', { class: 'igs-isla' }),
    barraEstado(),
    esReel ? null : barraArriba(),
    dentro,
    barraAbajo(),
  ]);

  rootEl.appendChild(controles());
  rootEl.appendChild(el('div', { class: 'igs-phone' }, [pantalla]));
  rootEl.appendChild(pie(todas));

  if (scroll && !abierta) {
    const nuevo = rootEl.querySelector('.igs-scroll');
    if (nuevo) nuevo.scrollTop = scroll;
  }
  // el observador necesita el panel YA en el documento para medir
  mirar(porMirar, rootEl.querySelector('.igs-scroll'));
  porMirar = [];
}

async function cargarReal(forzar) {
  const m = marca();
  if (!m) return;
  realEstado = 'cargando';
  render();
  try {
    const r = await api.get(`/ig/feed?client_id=${encodeURIComponent(m.id)}${forzar ? '&fresco=1' : ''}`);
    if (!r || !r.connected) { real = null; realEstado = 'sin-conexion'; }
    else if (r.error) { real = null; realEstado = 'error'; if (forzar) toast(r.error, 'error'); }
    else { real = r; realEstado = 'listo'; }
  } catch (e) {
    real = null; realEstado = 'error';
    if (forzar) toast(e.message, 'error');
  }
  render();
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/feed.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/feed.css?v=202609121543';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'igs' });
    host.appendChild(rootEl);
    lastClientId = ctx.store.getState().activeClientId || null;
    unsubs.push(ctx.store.subscribe(['posts', 'clients', 'activeClientId'], () => {
      const ahora = ctx.store.getState().activeClientId || null;
      if (ahora !== lastClientId) {
        lastClientId = ahora;
        imgs = new Map(); real = null; realEstado = 'idle'; abierta = null; pestana = 'grid';
        render();
        cargarReal(false);
        return;
      }
      render();
    }));
    render();
    cargarReal(false);
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    if (observador) { observador.disconnect(); observador = null; }
    porMirar = [];
    rootEl = null; ctx = null;
    imgs = new Map(); pidiendo = new Set();
    real = null; realEstado = 'idle'; abierta = null; slideIx = 0; pestana = 'grid';
  },
};
