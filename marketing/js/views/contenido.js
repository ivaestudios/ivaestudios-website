// ============================================================================
// IVAE Marketing — "Mi contenido" del CLIENTE, como Instagram (17-nov-2026).
//
// Pedido de Vianey: "vamos a rediseñar la parte de los clientes… súper
// sencillo… se tiene que ver como Instagram", porque "lo han dejado de usar
// porque es muy complicado de usar". Maqueta aprobada ("super añadelo, y
// métricas también", y luego "añade la sección de conexiones").
//
// Cuatro pestañas y nada más:
//   · Feed        → las publicaciones en orden de fecha, como el inicio de
//                   Instagram: el video, el carrusel que se desliza (o, sin
//                   fotos todavía, cada slide con su texto), el caption con sus
//                   hashtags y TRES botones grandes: Aprobar, Pedir cambio y
//                   Guion (que adentro trae Editar guion y Subir guion nuevo).
//   · Perfil      → su perfil de Instagram en cuadrícula: lo que viene con su
//                   portada y su día, encima de lo ya publicado.
//   · Métricas    → la vista de métricas de siempre (su marca).
//   · Conexiones  → el cliente conecta SUS redes; el equipo las ve conectadas
//                   y programa.
// Sin Entregables (Vianey: "para ellos ya no va a haber sección de
// entregables"). Eliminar NO existe: solo aprobar, pedir cambio o modificar
// el guion.
//
// Datos (los mismos endpoints de siempre, todos limitados a SU marca):
//   · piezas      → store.posts (lo que el equipo escondió no sale)
//   · fotos/video → GET /posts/:id/slides  { slides, portada, video }
//   · portada del entregable → GET /deliverables?client_id&month
//   · perfil      → GET /ig/feed
//   · decidir     → POST /posts/:id/approve · /request-changes
//   · guion       → PATCH /posts/:id { hook, body, cta }
// ============================================================================
import { el, clear, api, toast, contentTypeLabel } from '../api.js?v=202611222124';
import { T, isEN } from '../shell/i18n.js?v=202611222124';
import { openSheet } from '../shell/sheet.js?v=202611222124';
import { slidesFromPost, fieldsFromSlides } from '../editor/slides.js?v=202611222124';
import { multipartUpload } from '../lib/video-upload.js?v=202611222124';

const VIEW_ID = 'contenido';

let ctx = null;
let rootEl = null;
let cuerpoEl = null;
let unsubs = [];
let marcaId = null;
let pestana = 'feed';            // feed | perfil | metricas | conexiones | lista (Contenido, desde la barra de abajo)
let mesLista = null;             // mes elegido en Contenido ('YYYY-MM' o 'sin')
let verAnteriores = false;
let porAbrir = null;             // ?pieza=<id> (aviso) hasta que llegue la pieza
let sub = null;                  // vista montada adentro (métricas o conexiones)
let observador = null;
const medios = new Map();        // postId → { slides, portada, video } | 'cargando'
const dlvMarca = new Map();      // marca → Map(post_id → entregable) | 'cargando'
let cargadoEn = 0;               // cuándo se pidieron los medios (para refrescar al volver a la app)
let ig = null;                   // respuesta de /ig/feed | 'cargando'
const abiertos = new Map();      // postId → 'cambio' | 'guion' | 'editar' | 'nuevo'
const desplegadas = new Set();
const hilos = new Map();         // postId → comentarios[] | 'cargando': el MISMO hilo que ve el equipo en su app
const hilosTodos = new Set();    // postIds con todos sus comentarios a la vista   // Contenido: barritas con el guion desplegado

// ── Datos ────────────────────────────────────────────────────────────────────
const estado = () => ctx.store.getState();
function marca() { return (estado().clients || []).find((c) => c.id === marcaId) || null; }
// El Feed de la AGENCIA (views/agencia.js) usa este mismo código: ve TODAS
// las piezas de la marca, también las que el cliente todavía no ve, y tiene
// sus propios botones (Vianey, 22-nov-2026).
// Modo agencia SOLO cuando lo monta views/agencia.js (pestaña "Feed" del
// equipo). La vista del cliente y la "Vista cliente" del equipo quedan IGUAL.
let modo = 'cliente';
export function ponerModo(m) { modo = m === 'agencia' ? 'agencia' : 'cliente'; }
const esEquipo = () => modo === 'agencia' && ((estado().me || {}).role || 'client') !== 'client';
const oculta = (p) => p.client_visible === 0 || p.client_visible === false;
function piezasDeMarca() {
  const equipo = esEquipo();
  return (estado().posts || []).filter((p) => p && p.client_id === marcaId && (equipo || !oculta(p)));
}
const mesDe = (p) => (p.publish_date ? String(p.publish_date).slice(0, 7) : '');
function hoyYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ordenar(a, b) {
  const fa = a.publish_date || '9999-99-99', fb = b.publish_date || '9999-99-99';
  if (fa !== fb) return fa < fb ? -1 : 1;
  const ha = a.publish_time || '', hb = b.publish_time || '';
  if (ha !== hb) return ha < hb ? -1 : 1;
  return (Number(a.position) || 0) - (Number(b.position) || 0);
}
// Guiones bilingües (inglés y abajo "ESPAÑOL:"): en la portada provisional va solo el primero.
const primerIdioma = (t) => String(t || '').split(/\n\s*ESPAÑOL:/i)[0].trim();
const tieneTexto = (p) => !!(String(p.hook || '').trim() || String(p.body || '').trim() || String(p.cta || '').trim() || String(p.caption || '').trim());
const esCarrusel = (p) => (p.content_type || '') === 'carrusel';
const esVideo = (p) => ['reel', 'historia', 'pauta', 'video'].includes(p.content_type || 'reel');

// El estado EN PALABRAS DEL CLIENTE.
function etapa(p) {
  if (p.status === 'publicado') return { k: 'publicado', txt: T('Publicado', 'Published') };
  if (p.approval_state === 'approved' || p.status === 'aprobado' || p.status === 'programado') return { k: 'aprobado', txt: T('Aprobado', 'Approved') };
  if (p.approval_state === 'changes') return { k: 'cambio', txt: T('Pediste un cambio', 'You asked for a change') };
  if (tieneTexto(p)) return { k: 'revisar', txt: T('Por aprobar', 'To approve') };
  return { k: 'preparando', txt: T('En preparación', 'In progress') };
}

const handle = () => {
  const r = ig && ig !== 'cargando' && ig.connected ? (ig.username || (ig.perfil && ig.perfil.username)) : '';
  const m = marca();
  return r || (m && m.ig_username) || String((m && m.name) || 'mi.marca').toLowerCase().replace(/[^a-z0-9._]+/g, '');
};
const fotoPerfil = () => (ig && ig !== 'cargando' && ig.perfil && ig.perfil.foto) || null;

function avatar(tam) {
  const f = fotoPerfil();
  if (f) return el('img', { class: 'ig-av', src: f, alt: '', style: { width: tam + 'px', height: tam + 'px' } });
  const m = marca();
  const ini = String((m && m.name) || '?').trim().charAt(0).toUpperCase();
  return el('span', { class: 'ig-av ig-av--ini', style: { width: tam + 'px', height: tam + 'px', fontSize: Math.round(tam * 0.42) + 'px', '--c': (m && m.brand_color) || '#111111' }, text: ini });
}

function fechaLarga(p) {
  if (!p.publish_date) return T('Sin fecha', 'No date');
  const [y, m, d] = String(p.publish_date).slice(0, 10).split('-').map(Number);
  const f = new Date(y, m - 1, d);
  let s = f.toLocaleDateString(T('es-MX', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long' });
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (p.publish_time) {
    const [hh, mm] = String(p.publish_time).split(':').map(Number);
    if (!Number.isNaN(hh)) {
      const h12 = ((hh + 11) % 12) + 1;
      s += ` · ${h12}:${String(mm || 0).padStart(2, '0')} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
    }
  }
  return s;
}
function diaCorto(p) {
  if (!p.publish_date) return '';
  const [y, m, d] = String(p.publish_date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(T('es-MX', 'en-US'), { day: 'numeric', month: 'short' }).replace('.', '');
}
function nombreMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString(T('es-MX', 'en-US'), { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fotos, portada y video de la pieza (firmados por el servidor), una vez.
function pedirMedio(id) {
  if (medios.has(id)) return;
  medios.set(id, 'cargando');
  api.get(`/posts/${encodeURIComponent(id)}/slides`)
    .then((r) => medios.set(id, { slides: (r && r.slides) || [], portada: (r && r.portada) || null, video: (r && r.video) || null }))
    .catch(() => medios.set(id, { slides: [], portada: null, video: null }))
    .finally(() => repintarMedio(id));
}
// El entregable ligado a la pieza (video, portada, tira o slides que sube el
// equipo). Se busca por post_id en TODOS los meses de la marca: hay entregables
// archivados en otro mes que su post (REGENERIS: los de octubre son de posts de
// noviembre) y buscarlos solo en el mes del post los dejaba fuera (18-nov-2026).
const pesoDlv = (d) => (d.video_url ? 4 : 0) + ((d.slide_urls || []).length ? 4 : 0) + (d.poster_url ? 1 : 0);
function entregable(p) {
  if (!marcaId) return null;
  const marca = marcaId;
  const hit = dlvMarca.get(marca);
  if (hit && hit !== 'cargando') return hit.get(p.id) || null;
  if (!hit) {
    dlvMarca.set(marca, 'cargando');
    if (!cargadoEn) cargadoEn = Date.now();
    api.get(`/deliverables?client_id=${encodeURIComponent(marca)}`)
      .then((r) => {
        const mapa = new Map();
        for (const d of ((r && r.deliverables) || [])) {
          if (!d.post_id) continue;
          const ya = mapa.get(d.post_id);
          if (!ya || pesoDlv(d) > pesoDlv(ya)) mapa.set(d.post_id, d);
        }
        dlvMarca.set(marca, mapa);
      })
      // Una falla NO se queda guardada: se vuelve a pedir al regresar a la app.
      .catch(() => dlvMarca.set(marca, Object.assign(new Map(), { fallo: true })))
      .finally(() => { if (marca === marcaId) for (const x of piezasDeMarca()) repintarMedio(x.id); });
  }
  return null;
}
// El video de la pieza, venga de donde venga: subido a la pieza, en su
// entregable, o pegado como enlace directo en la pieza (MELISA: el enlace
// público del entregable vive en video_url y no hay entregable ligado).
function videoDirecto(u) {
  const s = String(u || '').trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return (/\/api\/marketing\/(publico\/entregable|deliverables)\/[^/?#]+\/video/i.test(s) || /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(s)) ? s : null;
}
function videoDe(p) {
  const m = medios.get(p.id);
  const datos = m && m !== 'cargando' ? m : null;
  const d = entregable(p);
  return (datos && datos.video) || (d && d.video_url) || videoDirecto(p.video_url) || null;
}
// Sin portada, el video enseña su primer cuadro (antes salía un recuadro negro).
const conPrimerCuadro = (u) => (u.includes('#') ? u : `${u}#t=0.1`);
// Al volver a la app (o a esta vista) después de un rato, los medios se piden de
// nuevo: la app del teléfono se queda abierta días y enseñaba lo de la primera
// carga aunque el equipo ya hubiera subido el video.
function refrescarSiViejo() {
  const hayFallo = [...dlvMarca.values()].some((v) => v && v.fallo);
  if (!hayFallo && (!cargadoEn || Date.now() - cargadoEn < 60000)) return;
  cargadoEn = Date.now();
  medios.clear();
  dlvMarca.clear();
  if (!rootEl) return;
  for (const n of rootEl.querySelectorAll('.ig-media[data-medio], .ig-celda[data-pieza]')) {
    if (observador) observador.observe(n); else pedirMedio(n.dataset.medio || n.dataset.pieza);
  }
  for (const x of piezasDeMarca()) repintarMedio(x.id);
}
const alVolver = () => { if (document.visibilityState === 'visible') refrescarSiViejo(); };
function portadaDe(p) {
  const m = medios.get(p.id);
  const d = entregable(p);
  const datos = m && m !== 'cargando' ? m : null;
  return (datos && (datos.portada || datos.slides[0])) || (d && d.poster_url) || null;
}

// ── Medio de la publicación ──────────────────────────────────────────────────
function medio(p) {
  const caja = el('div', { class: 'ig-media', dataset: { medio: p.id } });
  llenarMedio(caja, p);
  return caja;
}
function llenarMedio(caja, p) {
  clear(caja);
  const m = medios.get(p.id);
  const datos = m && m !== 'cargando' ? m : null;
  const d = entregable(p);
  const video = videoDe(p);
  const portada = portadaDe(p);

  if (esCarrusel(p)) {
    const fotos = datos && datos.slides.length ? datos.slides : [];
    // Sin fotos sueltas: el carrusel puede vivir en ENTREGABLES (ADAGIO, 17-nov-2026:
    // "los carruseles de adagio no están sincronizados"), como slides en video o
    // como UNA tira ancha con todos los slides.
    if (!fotos.length && d && d.slide_urls && d.slide_urls.length) {
      pintarPista(caja, d.slide_urls.map((u) => ({ video: u })));
      return;
    }
    if (!fotos.length && d && d.type === 'carrusel' && d.poster_url) {
      pintarTira(caja, d.poster_url);
      return;
    }
    const textos = slidesFromPost(p).filter((t, i, a) => t || (i > 0 && i < a.length - 1));
    const items = fotos.length ? fotos.map((u) => ({ foto: u })) : (textos.length ? textos.map((t) => ({ texto: t })) : [{ texto: p.title || '' }]);
    pintarPista(caja, items);
    return;
  }
  if (esVideo(p)) {
    if (video) {
      caja.appendChild(el('video', portada
        ? { src: video, poster: portada, controls: true, playsinline: true, preload: 'none' }
        : { src: conPrimerCuadro(video), controls: true, playsinline: true, preload: 'metadata' }));
      return;
    }
    if (portada) {
      caja.append(el('img', { src: portada, alt: '', loading: 'lazy', decoding: 'async' }), el('span', { class: 'ig-chip', text: T('Video en edición', 'Video in editing') }));
      return;
    }
    caja.appendChild(el('div', { class: 'ig-sinvideo' }, [
      el('em', { text: T('VIDEO EN EDICIÓN', 'VIDEO IN EDITING') }),
      el('p', { text: primerIdioma(p.hook || p.title) || T('Guion en preparación', 'Script in progress') }),
    ]));
    return;
  }
  // Post de una foto (o lo que sea).
  if (portada) { caja.appendChild(el('img', { src: portada, alt: '', loading: 'lazy', decoding: 'async' })); return; }
  caja.appendChild(el('div', { class: 'ig-sinvideo ig-sinvideo--claro' }, [
    el('em', { text: T('FOTO PENDIENTE', 'PHOTO PENDING') }),
    el('p', { text: primerIdioma(p.hook || p.title) }),
  ]));
}
// La pista deslizable (fotos, videos o textos) con su contador y sus puntos.
function pintarPista(caja, items) {
  clear(caja);
  const pista = el('div', { class: 'ig-pista' });
  items.forEach((it, i) => {
    if (it.foto) pista.appendChild(el('div', { class: 'ig-slide' }, [el('img', { src: it.foto, alt: '', loading: 'lazy', decoding: 'async' })]));
    else if (it.video) pista.appendChild(el('div', { class: 'ig-slide' }, [el('video', { src: it.video + '#t=0.1', muted: true, playsinline: true, controls: true, preload: 'metadata' })]));
    else if (it.tira) pista.appendChild(el('div', { class: 'ig-slide ig-slide--tira', role: 'img', style: { backgroundImage: `url("${it.tira}")`, backgroundSize: `${it.n * 100}% 100%`, backgroundPosition: it.n > 1 ? `${(i / (it.n - 1)) * 100}% 0` : '0 0' } }));
    else {
      pista.appendChild(el('div', { class: 'ig-slide ig-slide--texto' }, [
        el('em', { text: i === 0 ? T('PORTADA', 'COVER') : (i === items.length - 1 ? T('CIERRE', 'CLOSING') : `${T('SLIDE', 'SLIDE')} ${i + 1}`) }),
        el('p', { text: primerIdioma(it.texto) || T('Texto en preparación', 'Text in progress') }),
        el('small', { text: T('Foto pendiente', 'Photo pending') }),
      ]));
    }
  });
  const cont = el('span', { class: 'ig-cont', text: `1/${items.length}` });
  pista.addEventListener('scroll', () => {
    const i = Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
    cont.textContent = `${i + 1}/${items.length}`;
    const pts = caja.parentNode && caja.parentNode.querySelector('.ig-puntos');
    if (pts) [...pts.children].forEach((x, k) => x.classList.toggle('is-on', k === i));
  }, { passive: true });
  caja.append(...[pista, items.length > 1 ? cont : null].filter(Boolean));
  caja.dataset.n = String(items.length);
  ponerPuntos(caja);
}
// Una tira ancha (todos los slides en una imagen): se parte en slides de 4:5.
function pintarTira(caja, url) {
  clear(caja);
  caja.appendChild(el('img', { src: url, alt: '', class: 'ig-tira-espera' }));
  const img = new Image();
  img.onload = () => {
    const n = Math.max(1, Math.min(20, Math.round((img.naturalWidth / img.naturalHeight) / 0.8)));
    pintarPista(caja, Array.from({ length: n }, () => ({ tira: url, n })));
  };
  img.src = url;
}
function ponerPuntos(caja) {
  const art = caja.closest && caja.closest('.ig-post');
  if (!art) return;
  const viejo = art.querySelector('.ig-puntos');
  if (viejo) viejo.remove();
  const n = Number(caja.dataset.n || 0);
  if (n > 1) caja.after(puntos(n));
}

function repintarMedio(id) {
  if (!rootEl) return;
  const p = piezasDeMarca().find((x) => x.id === id);
  if (!p) return;
  const caja = rootEl.querySelector(`.ig-media[data-medio="${CSS.escape(id)}"]`);
  if (caja) { llenarMedio(caja, p); ponerPuntos(caja); }
  const celda = rootEl.querySelector(`.ig-celda[data-pieza="${CSS.escape(id)}"]`);
  if (celda) llenarCelda(celda, p);
  const mini = rootEl.querySelector(`.ig-lado__mini[data-pieza="${CSS.escape(id)}"]`);
  if (mini) llenarMini(mini, p);
}
function puntos(n) {
  return el('div', { class: 'ig-puntos' }, Array.from({ length: n }, (_, i) => el('i', { class: i ? '' : 'is-on' })));
}

// ── Una publicación ──────────────────────────────────────────────────────────
function publicacion(p) {
  const e = etapa(p);
  const art = el('article', { class: 'ig-post', id: `pieza-${p.id}`, dataset: { pieza: p.id } });
  const caja = medio(p);
  const n = Number(caja.dataset.n || 0);
  const caption = String(p.caption || '').trim();
  const tags = String(p.hashtags || '').trim();
  const txt = el('p', { class: 'ig-caption__txt is-corto' }, [
    el('b', { text: handle() + ' ' }),
    caption || el('span', { class: 'ig-muted', text: T('El texto de la publicación está en preparación.', 'The caption is in progress.') }),
    tags ? el('span', { class: 'ig-tags', text: ' ' + tags }) : null,
  ]);
  const verTodo = el('button', { class: 'ig-mas', type: 'button', text: T('Ver todo', 'See all'), onclick: () => {
    txt.classList.toggle('is-corto');
    verTodo.textContent = txt.classList.contains('is-corto') ? T('Ver todo', 'See all') : T('Ver menos', 'See less');
  } });
  art.append(...[
    el('div', { class: 'ig-cuando', text: fechaLarga(p) + (esEquipo() && oculta(p) ? T(' · El cliente todavía no la ve', ' · Not visible to the client yet') : '') }),
    el('div', { class: 'ig-cab' }, [avatar(30), el('div', { class: 'ig-cab__txt' }, [el('b', { text: handle() }), el('span', { text: contentTypeLabel(p.content_type || 'reel') })]), el('span', { class: 'ig-estado', dataset: { k: e.k }, text: e.txt })]),
    caja,
    n > 1 ? puntos(n) : null,
    el('div', { class: 'ig-caption' }, [txt, (caption.length + tags.length) > 90 ? verTodo : null]),
    e.k === 'cambio' ? el('p', { class: 'ig-pedido', text: esEquipo() ? T('El cliente pidió un cambio. Su comentario está abajo: respóndele ahí.', 'The client asked for a change. Reply to their comment below.') : T('Pediste un cambio. Tu equipo ya lo tiene; su respuesta te aparece aquí abajo, en los comentarios.', 'You asked for a change. Your team has it and will let you know when it’s ready.') }) : null,
    acciones(p, e),
    panel(p),
    hilo(p),
  ].filter(Boolean));
  return art;
}

function acciones(p, e) {
  const abierto = abiertos.get(p.id);
  if (esEquipo()) {
    // Botones de la agencia: subir el video final a ESTA pieza, abrirla y su guion.
    const archivo = el('input', { type: 'file', accept: 'video/*', hidden: true });
    const subir = el('label', { class: 'ig-btn is-primario' }, [el('span', { text: videoDe(p) ? T('Cambiar video', 'Replace video') : T('Subir video', 'Upload video') }), archivo]);
    archivo.addEventListener('change', () => subirVideo(p, archivo, subir));
    // Solo las piezas de VIDEO llevan "Subir video"; un carrusel o un post de
    // foto suben sus imágenes al abrir la pieza.
    const sinVideo = !esVideo(p);
    return el('div', { class: 'ig-acciones' + (sinVideo ? ' is-dos' : '') }, [
      sinVideo ? null : subir,
      el('button', { class: 'ig-btn' + (sinVideo ? ' is-primario' : ''), type: 'button', text: T('Abrir pieza', 'Open piece'), onclick: () => { location.hash = '#/post/' + encodeURIComponent(p.id); } }),
      el('button', { class: 'ig-btn' + (abierto && abierto !== 'cambio' ? ' is-activo' : ''), type: 'button', text: T('Guion', 'Script'), onclick: () => alternar(p, 'guion') }),
    ].filter(Boolean));
  }
  const fila = el('div', { class: 'ig-acciones' + (e.k === 'publicado' ? ' is-una' : '') });
  if (e.k !== 'publicado') {
    fila.appendChild(e.k === 'aprobado'
      ? el('button', { class: 'ig-btn is-listo', type: 'button', disabled: true, text: T('Aprobado ✓', 'Approved ✓') })
      : el('button', { class: 'ig-btn is-primario', type: 'button', text: T('Aprobar', 'Approve'), onclick: (ev) => aprobar(p, ev.currentTarget) }));
    fila.appendChild(el('button', {
      class: 'ig-btn' + (abierto === 'cambio' ? ' is-activo' : ''), type: 'button', text: T('Pedir cambio', 'Ask for a change'),
      onclick: () => alternar(p, 'cambio'),
    }));
  }
  fila.appendChild(el('button', {
    class: 'ig-btn' + (abierto && abierto !== 'cambio' ? ' is-activo' : ''), type: 'button', text: T('Guion', 'Script'),
    onclick: () => alternar(p, 'guion'),
  }));
  return fila;
}

async function subirVideo(p, archivo, boton) {
  const f = archivo.files && archivo.files[0];
  if (!f) return;
  const txt = boton.querySelector('span');
  boton.classList.add('is-cargando');
  try {
    const r = await multipartUpload(api, `/posts/${encodeURIComponent(p.id)}/video`, f, (pct) => { txt.textContent = T(`Subiendo ${Math.round(pct)}%`, `Uploading ${Math.round(pct)}%`); });
    if (r && r.id) ctx.store.upsertPost?.(r);
    medios.delete(p.id);
    toast(T('Video subido. Ya se ve en la publicación.', 'Video uploaded.'), 'success');
  } catch (err) {
    toast((err && err.message) || T('No se pudo subir el video', 'Could not upload the video'), 'error');
  } finally {
    boton.classList.remove('is-cargando');
    repintarPost(p.id);
    pedirMedio(p.id);
  }
}

function alternar(p, cual) {
  const ahora = abiertos.get(p.id);
  const mismo = cual === 'cambio' ? ahora === 'cambio' : (ahora && ahora !== 'cambio');
  if (mismo) abiertos.delete(p.id); else abiertos.set(p.id, cual);
  repintarPost(p.id);
}
function repintarPost(id) {
  const p = piezasDeMarca().find((x) => x.id === id);
  const viejo = rootEl && rootEl.querySelector(`.ig-post[data-pieza="${CSS.escape(id)}"]`);
  if (!p || !viejo) return;
  const nuevo = publicacion(p);
  viejo.replaceWith(nuevo);
  vigilar(nuevo);
  const caja = nuevo.querySelector('textarea, [contenteditable="true"]');
  if (caja) setTimeout(() => caja.focus(), 30);
}

// ── Comentarios: un solo hilo por pieza (el cliente y su equipo ven lo mismo) ──
// Antes el cliente solo podía "Pedir cambio" y nunca veía lo que le contestaban
// (Vianey, 22-nov-2026: "si pide el cambio, también le debe permitir ver la
// respuesta"). El servidor ya guarda y avisa: GET /posts/:id trae el hilo sin
// los comentarios internos, y POST /posts/:id/comments avisa al equipo.
function pedirHilo(id, forzar) {
  if (!id || (!forzar && hilos.has(id))) return;
  if (!forzar) hilos.set(id, 'cargando');
  api.get(`/posts/${encodeURIComponent(id)}`)
    .then((r) => hilos.set(id, ((r && r.comments) || []).filter((c) => String(c.body || '').trim())))
    .catch(() => { if (!Array.isArray(hilos.get(id))) hilos.set(id, []); })
    .finally(() => repintarHilo(id));
}
function cuandoComento(c) {
  const t = String(c.created_at || '');
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(t) ? t : t.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return T('ahora', 'now');
  if (min < 60) return T(`hace ${min} min`, `${min} min ago`);
  if (min < 1440) return T(`hace ${Math.round(min / 60)} h`, `${Math.round(min / 60)} h ago`);
  return d.toLocaleDateString(T('es-MX', 'en-US'), { day: 'numeric', month: 'short' });
}
function hilo(p) {
  const id = p.id;
  const lista = hilos.get(id);
  const caja = el('div', { class: 'ig-hilo', dataset: { hilo: id } });
  if (Array.isArray(lista) && lista.length) {
    const todos = hilosTodos.has(id) || lista.length <= 2;
    if (!todos) caja.appendChild(el('button', { class: 'ig-hilo__mas', type: 'button', text: T(`Ver los ${lista.length} comentarios`, `View all ${lista.length} comments`), onclick: () => { hilosTodos.add(id); repintarHilo(id); } }));
    for (const c of (todos ? lista : lista.slice(-2))) {
      const equipo = !!c.author_role && c.author_role !== 'client';
      caja.appendChild(el('p', { class: 'ig-com' + (equipo ? ' is-equipo' : '') }, [
        el('b', { text: (c.author_name || (equipo ? T('Tu equipo', 'Your team') : T('Tú', 'You'))) + ' ' }),
        (equipo || esEquipo()) ? el('span', { class: 'ig-com__tag' + (equipo ? '' : ' is-cliente'), text: equipo ? (esEquipo() ? T('Equipo', 'Team') : T('Tu equipo', 'Your team')) : T('Cliente', 'Client') }) : null,
        el('span', { text: String(c.body || '').trim() }),
        el('small', { text: cuandoComento(c) }),
      ].filter(Boolean)));
    }
  }
  const entrada = el('input', { class: 'ig-hilo__caja', type: 'text', maxlength: 2000, placeholder: esEquipo() ? T('Responder al cliente…', 'Reply to the client…') : T('Escribe un comentario…', 'Add a comment…'), 'aria-label': esEquipo() ? T('Responder al cliente', 'Reply to the client') : T('Escribe un comentario', 'Add a comment') });
  const enviar = el('button', { class: 'ig-hilo__enviar', type: 'button', text: T('Enviar', 'Post'), onclick: () => comentar(p, entrada, enviar) });
  entrada.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); comentar(p, entrada, enviar); } });
  caja.appendChild(el('div', { class: 'ig-hilo__comp' }, [entrada, enviar]));
  return caja;
}
async function comentar(p, entrada, boton) {
  const body = entrada.value.trim();
  if (!body) { entrada.focus(); return; }
  boton.disabled = true;
  try {
    await api.post(`/posts/${encodeURIComponent(p.id)}/comments`, { body });
    entrada.value = '';
    toast(esEquipo() ? T('Enviado. Al cliente le llega un aviso.', 'Sent. The client gets a notice.') : T('Listo, tu equipo ya lo ve.', 'Done, your team can see it.'), 'success');
    pedirHilo(p.id, true);
  } catch (err) { toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
  finally { boton.disabled = false; }
}
function repintarHilo(id) {
  const p = piezasDeMarca().find((x) => x.id === id);
  const viejo = rootEl && rootEl.querySelector(`.ig-hilo[data-hilo="${CSS.escape(id)}"]`);
  if (!p || !viejo) return;
  const activo = document.activeElement;
  const escrito = viejo.contains(activo) && activo.classList.contains('ig-hilo__caja') ? activo.value : null;
  const nuevo = hilo(p);
  viejo.replaceWith(nuevo);
  if (escrito !== null) { const c = nuevo.querySelector('.ig-hilo__caja'); c.value = escrito; c.focus(); }
}

// Bloques del guion: reel = Gancho/Desarrollo/Cierre; carrusel = sus slides.
function bloques(p) {
  if (esCarrusel(p)) {
    const s = slidesFromPost(p);
    return s.map((t, i) => [i === 0 ? T('Portada', 'Cover') : (i === s.length - 1 ? T('Cierre', 'Closing') : `${T('Slide', 'Slide')} ${i + 1}`), t]);
  }
  return [[T('Gancho', 'Hook'), p.hook || ''], [T('Desarrollo', 'Body'), p.body || ''], [T('Cierre', 'Closing'), p.cta || '']];
}

function panel(p) {
  const cual = abiertos.get(p.id);
  if (!cual) return null;
  if (cual === 'cambio') {
    const caja = el('textarea', { class: 'ig-caja', rows: 4, placeholder: T('Escribe aquí tu cambio. Ejemplo: cambien la música o el texto del final.', 'Write your change here. Example: change the music or the closing text.') });
    const enviar = el('button', { class: 'ig-btn is-primario', type: 'button', text: T('Enviar cambio', 'Send change'), onclick: async () => {
      const comment = caja.value.trim();
      if (!comment) { caja.focus(); return; }
      enviar.disabled = true;
      try {
        const r = await api.post(`/posts/${encodeURIComponent(p.id)}/request-changes`, { comment });
        if (r && r.post) ctx.store.upsertPost?.(r.post);
        abiertos.delete(p.id);
        toast(T('Listo, tu equipo ya tiene tu cambio.', 'Done, your team has your change.'), 'success');
        repintarPost(p.id);
        pedirHilo(p.id, true);
      } catch (err) { enviar.disabled = false; toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
    } });
    return el('div', { class: 'ig-panel' }, [el('h4', { text: T('¿Qué quieres cambiar?', 'What would you like to change?') }), caja, el('div', { class: 'ig-fila' }, [enviar])]);
  }

  if (cual === 'nuevo') {
    const caja = el('textarea', { class: 'ig-caja ig-caja--grande', rows: 8, placeholder: T('Pega aquí todo tu guion.', 'Paste your whole script here.') });
    const archivo = el('input', { type: 'file', accept: '.txt,.docx', hidden: true, onchange: async () => {
      const f = archivo.files && archivo.files[0];
      if (!f) return;
      try { caja.value = await leerArchivo(f); caja.focus(); }
      catch (err) { toast((err && err.message) || T('No se pudo leer el archivo', 'Could not read the file'), 'error'); }
    } });
    const enviar = el('button', { class: 'ig-btn is-primario', type: 'button', text: T('Enviar guion', 'Send script'), onclick: async () => {
      const texto = caja.value.trim();
      if (!texto) { caja.focus(); return; }
      enviar.disabled = true;
      try {
        const campos = esCarrusel(p) ? fieldsFromSlides(texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) : { hook: '', body: texto, cta: '' };
        const r = await api.patch(`/posts/${encodeURIComponent(p.id)}`, campos);
        if (r && r.id) ctx.store.upsertPost?.(r);
        // El equipo tiene que enterarse: un guion nuevo cambia la pieza.
        const r2 = await api.post(`/posts/${encodeURIComponent(p.id)}/request-changes`, { comment: T('Subí un guion nuevo completo para esta pieza.', 'I uploaded a new full script for this piece.') }).catch(() => null);
        if (r2 && r2.post) ctx.store.upsertPost?.(r2.post);
        abiertos.set(p.id, 'guion');
        toast(T('Recibimos tu guion nuevo. Tu equipo lo revisa.', 'We got your new script. Your team will review it.'), 'success', 5000);
        repintarPost(p.id);
      } catch (err) { enviar.disabled = false; toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
    } });
    return el('div', { class: 'ig-panel' }, [
      el('h4', { text: T('Sube tu guion completo', 'Upload your full script') }),
      caja,
      el('label', { class: 'ig-archivo' }, [T('o ', 'or '), el('u', { text: T('elige un archivo', 'choose a file') }), T(' (Word o texto)', ' (Word or text)'), archivo]),
      esCarrusel(p) ? el('p', { class: 'ig-muted ig-nota', text: T('Separa cada slide con una línea en blanco.', 'Separate each slide with a blank line.') }) : null,
      el('div', { class: 'ig-fila' }, [enviar, el('button', { class: 'ig-btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => { abiertos.set(p.id, 'guion'); repintarPost(p.id); } })]),
    ]);
  }

  const editando = cual === 'editar';
  const lista = bloques(p);
  const cajas = [];
  const cont = el('div', { class: 'ig-panel' + (editando ? ' is-editando' : '') });
  for (const [etq, txt] of lista) {
    const t = String(txt || '').trim();
    if (!editando && !t) continue;
    const nodo = editando
      ? el('textarea', { class: 'ig-caja', rows: Math.min(10, Math.max(2, Math.ceil(t.length / 38))), text: t })
      : el('div', { class: 'ig-bloque__txt', text: t });
    if (editando) { nodo.value = t; cajas.push(nodo); }
    cont.appendChild(el('div', { class: 'ig-bloque' }, [el('label', { text: etq }), nodo]));
  }
  if (!editando && !cont.children.length) cont.appendChild(el('p', { class: 'ig-muted', text: T('El guion todavía no está listo. Si ya tienes uno, súbelo aquí.', 'The script is not ready yet. If you have one, upload it here.') }));
  if (editando) {
    const guardar = el('button', { class: 'ig-btn is-primario', type: 'button', text: T('Guardar', 'Save'), onclick: async () => {
      guardar.disabled = true;
      const textos = cajas.map((c) => c.value.trim());
      const campos = esCarrusel(p) ? fieldsFromSlides(textos) : { hook: textos[0] || '', body: textos[1] || '', cta: textos[2] || '' };
      try {
        const r = await api.patch(`/posts/${encodeURIComponent(p.id)}`, campos);
        if (r && r.id) ctx.store.upsertPost?.(r);
        abiertos.set(p.id, 'guion');
        toast(T('Guardamos tu guion. Tu equipo ya lo ve.', 'Your script is saved. Your team can see it.'), 'success');
        repintarPost(p.id);
      } catch (err) { guardar.disabled = false; toast((err && err.message) || T('No se pudo guardar', 'Could not save'), 'error'); }
    } });
    cont.appendChild(el('div', { class: 'ig-fila' }, [guardar, el('button', { class: 'ig-btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => { abiertos.set(p.id, 'guion'); repintarPost(p.id); } })]));
  } else if (etapa(p).k !== 'publicado') {
    cont.appendChild(el('div', { class: 'ig-fila' }, [
      el('button', { class: 'ig-btn', type: 'button', text: T('Editar guion', 'Edit script'), onclick: () => { abiertos.set(p.id, 'editar'); repintarPost(p.id); } }),
      esEquipo() ? el('button', { class: 'ig-btn', type: 'button', text: T('Abrir pieza', 'Open piece'), onclick: () => { location.hash = '#/post/' + encodeURIComponent(p.id); } }) : el('button', { class: 'ig-btn', type: 'button', text: T('Subir guion nuevo', 'Upload new script'), onclick: () => { abiertos.set(p.id, 'nuevo'); repintarPost(p.id); } }),
    ]));
  }
  return cont;
}

async function aprobar(p, boton) {
  boton.disabled = true;
  try {
    const r = await api.post(`/posts/${encodeURIComponent(p.id)}/approve`, {});
    if (r && r.post) ctx.store.upsertPost?.(r.post);
    abiertos.delete(p.id);
    toast(T('¡Aprobado! Tu equipo ya lo sabe.', 'Approved! Your team knows.'), 'success');
    repintarPost(p.id);
  } catch (err) { boton.disabled = false; toast((err && err.message) || T('No se pudo aprobar', 'Could not approve'), 'error'); }
}

// Word (.docx) sin librerías: es un ZIP; se abre word/document.xml y se saca
// el texto de los párrafos. Texto plano (.txt) tal cual.
async function leerArchivo(f) {
  const nombre = String(f.name || '').toLowerCase();
  if (nombre.endsWith('.txt')) return (await f.text()).trim();
  if (!nombre.endsWith('.docx')) throw new Error(T('Usa un archivo de Word (.docx) o pega el texto.', 'Use a Word file (.docx) or paste the text.'));
  const buf = new Uint8Array(await f.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; } }
  if (fin < 0) throw new Error(T('No se pudo abrir el Word.', 'Could not open the Word file.'));
  const total = dv.getUint16(fin + 10, true);
  let pos = dv.getUint32(fin + 16, true);
  for (let k = 0; k < total; k++) {
    const metodo = dv.getUint16(pos + 10, true);
    const comp = dv.getUint32(pos + 20, true);
    const ln = dv.getUint16(pos + 28, true), le = dv.getUint16(pos + 30, true), lc = dv.getUint16(pos + 32, true);
    const local = dv.getUint32(pos + 42, true);
    const n = new TextDecoder().decode(buf.slice(pos + 46, pos + 46 + ln));
    if (n === 'word/document.xml') {
      const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const datos = buf.slice(inicio, inicio + comp);
      let xml;
      if (metodo === 0) xml = new TextDecoder().decode(datos);
      else {
        const s = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        xml = await new Response(s).text();
      }
      return xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n').trim();
    }
    pos += 46 + ln + le + lc;
  }
  throw new Error(T('Ese Word no tiene texto.', 'That Word file has no text.'));
}

// Las fotos se piden cuando la publicación está por aparecer en pantalla.
function vigilar(nodo) {
  const caja = nodo.querySelector ? (nodo.matches('.ig-media') ? nodo : nodo.querySelector('.ig-media')) : null;
  if (!caja) return;
  if (!observador) {
    observador = new IntersectionObserver((ents) => {
      for (const en of ents) {
        if (!en.isIntersecting) continue;
        observador.unobserve(en.target);
        pedirMedio(en.target.dataset.medio || en.target.dataset.pieza);
        const post = en.target.closest('.ig-post');
        if (post) pedirHilo(post.dataset.pieza);
      }
    }, { rootMargin: '800px 0px' });
  }
  observador.observe(caja);
}

// ── Pestaña Feed ─────────────────────────────────────────────────────────────
function pintarFeed() {
  const todas = piezasDeMarca().sort(ordenar);
  const corte = hoyYmd().slice(0, 7) + '-01';
  const anteriores = todas.filter((p) => p.publish_date && p.publish_date < corte);
  const lista = verAnteriores ? todas : todas.filter((p) => !p.publish_date || p.publish_date >= corte);
  const frag = el('div', { class: 'ig-feed' });
  // Los meses pasados se ven en Contenido (barra de abajo), no aquí (17-nov-2026).
  void anteriores;
  if (!lista.length) {
    frag.appendChild(el('div', { class: 'ig-vacio' }, [
      el('p', { class: 'ig-vacio__t', text: T('Todavía no hay publicaciones para revisar.', 'Nothing to review yet.') }),
      el('p', { class: 'ig-muted', text: T('Cuando tu equipo prepare tu contenido, aparecerá aquí como en Instagram.', 'When your team prepares your content, it will show here like on Instagram.') }),
    ]));
  }
  let mesActual = '';
  for (const p of lista) {
    const ym = mesDe(p) || 'sin';
    if (ym !== mesActual) {
      mesActual = ym;
      frag.appendChild(el('h2', { class: 'ig-mes', text: ym === 'sin' ? T('Sin fecha todavía', 'No date yet') : nombreMes(ym) }));
    }
    const art = publicacion(p);
    frag.appendChild(art);
  }
  frag.appendChild(el('div', { class: 'ig-otra' }, [
    el('p', { text: T('¿Tienes otra idea?', 'Got another idea?') }),
    el('button', { class: 'ig-btn', type: 'button', text: T('Mandar un guion', 'Send a script'), onclick: abrirIdea }),
  ]));
  cuerpoEl.appendChild(frag);
  cuerpoEl.appendChild(ladoFeed());
  for (const art of frag.querySelectorAll('.ig-post')) vigilar(art);
}

// ── Panel de la derecha del Feed (solo en la compu, ≥ 1024 px) ──────────────
// Vianey, 21-nov-2026: "la versión de computadora no puede ser igual que la del
// móvil, se ve mucho vacío en los costados". La marca, el resumen de lo que hay
// en el feed, lo que viene (toca y brinca a la publicación) y el acceso a
// Contenido por mes, que en el celular vive en la barra de abajo y en la compu
// no existía. En el celular este panel no se muestra (CSS).
function llenarMini(mini, p) {
  clear(mini);
  const cara = portadaDe(p);
  if (cara) mini.appendChild(el('img', { src: cara, alt: '', loading: 'lazy', decoding: 'async' }));
  else mini.appendChild(el('span', { text: contentTypeLabel(p.content_type || 'reel').charAt(0) }));
}
function ladoFeed() {
  const m = marca() || {};
  const datos = ig && ig !== 'cargando' && ig.connected && !ig.error ? ig : null;
  const pf = (datos && datos.perfil) || {};
  const hoy = hoyYmd();
  const corte = hoy.slice(0, 7) + '-01';
  const enFeed = piezasDeMarca().filter((p) => !p.publish_date || p.publish_date >= corte);
  const cuenta = (k) => enFeed.filter((p) => etapa(p).k === k).length;
  const viene = piezasDeMarca().filter((p) => p.status !== 'publicado' && p.publish_date && p.publish_date >= hoy).sort(ordenar).slice(0, 5);
  const dato = (k, txt) => {
    const n = cuenta(k);
    return el('div', { class: 'ig-lado__dato' + (n ? '' : ' is-cero') }, [el('span', { class: 'ig-estado', dataset: { k }, text: txt }), el('b', { text: String(n) })]);
  };
  return el('aside', { class: 'ig-lado', 'aria-label': T('Resumen', 'Summary') }, [
    el('div', { class: 'ig-lado__marca' }, [
      avatar(56),
      el('div', {}, [
        el('b', { text: m.name || T('Mi marca', 'My brand') }),
        el('small', { text: '@' + handle() }),
        pf.followers != null ? el('small', { text: `${num(pf.followers)} ${T('seguidores', 'followers')}` }) : null,
      ].filter(Boolean)),
    ]),
    el('section', { class: 'ig-lado__caja' }, [
      el('h3', { text: T('Tu contenido', 'Your content') }),
      dato('revisar', T('Por aprobar', 'To approve')),
      dato('cambio', T('Con cambio pedido', 'Change requested')),
      dato('aprobado', T('Aprobadas', 'Approved')),
      dato('publicado', T('Publicadas', 'Published')),
    ]),
    viene.length ? el('section', { class: 'ig-lado__caja' }, [
      el('h3', { text: T('Lo que viene', 'Coming up') }),
      ...viene.map((p) => {
        const mini = el('span', { class: 'ig-lado__mini', dataset: { pieza: p.id } });
        llenarMini(mini, p);
        pedirMedio(p.id);
        const e = etapa(p);
        return el('button', { class: 'ig-lado__pieza', type: 'button', title: e.txt, onclick: () => irAPieza(p.id) }, [
          mini,
          el('span', { class: 'ig-lado__txt' }, [el('b', { text: tituloCorto(p) }), el('small', { text: `${diaCorto(p)} · ${contentTypeLabel(p.content_type || 'reel')}` })]),
          el('i', { class: 'ig-lado__punto', dataset: { k: e.k } }),
        ]);
      }),
    ]) : null,
    el('section', { class: 'ig-lado__caja' }, [
      el('h3', { text: T('Todo tu contenido', 'All your content') }),
      el('p', { class: 'ig-muted', text: T('Tus meses anteriores y lo que viene, por tipo de publicación.', 'Past months and what is coming, by post type.') }),
      el('button', { class: 'ig-btn', type: 'button', text: T('Ver por mes', 'View by month'), onclick: () => cambiar('lista') }),
    ]),
  ].filter(Boolean));
}

// ── Contenido: los meses y las piezas en barritas por tipo ───────────────────
// Vianey (17-nov-2026): "que aparezcan como barritas de video 1, video 2…
// carrusel 1, carrusel 2… por secciones… cuando aprieten en contenido tienen
// que aparecer los meses". Tocar una barrita despliega ahí mismo su guion
// (Vianey 18-nov-2026: "si le hago clic en el video 1, que se desglose el guión y ya").
function tituloCorto(p) {
  const t = primerIdioma(p.title || p.hook || '').replace(/^\s*(reel|carrusel|post|foto|historia|pauta|video)\s*\d*\s*[·:\-–]\s*/i, '').trim();
  return t || T('Sin título', 'Untitled');
}
function nombreMesCorto(ym) {
  if (ym === 'sin') return T('Sin fecha', 'No date');
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString(T('es-MX', 'en-US'), { month: 'short' }).replace('.', '');
  return `${s.charAt(0).toUpperCase() + s.slice(1)} ${y}`;
}
function pintarLista() {
  const todas = piezasDeMarca();
  const meses = [...new Set(todas.map(mesDe).filter(Boolean))].sort();
  const haySinFecha = todas.some((p) => !p.publish_date);
  const opciones = [...meses, ...(haySinFecha ? ['sin'] : [])];
  if (!mesLista || !opciones.includes(mesLista)) {
    const hoy = hoyYmd().slice(0, 7);
    mesLista = meses.includes(hoy) ? hoy : (meses.find((m) => m > hoy) || meses[meses.length - 1] || (haySinFecha ? 'sin' : hoy));
  }
  const chips = el('div', { class: 'ig-meses', role: 'tablist' }, opciones.map((ym) => el('button', {
    class: 'ig-mesbtn' + (ym === mesLista ? ' is-on' : ''), type: 'button', role: 'tab', 'aria-selected': ym === mesLista ? 'true' : 'false',
    text: nombreMesCorto(ym), onclick: () => { mesLista = ym; pintar(); },
  })));
  cuerpoEl.appendChild(chips);
  setTimeout(() => { const on = chips.querySelector('.is-on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);

  const delMes = todas.filter((p) => (mesLista === 'sin' ? !p.publish_date : mesDe(p) === mesLista)).sort(ordenar);
  if (!delMes.length) {
    cuerpoEl.appendChild(el('div', { class: 'ig-vacio' }, [el('p', { class: 'ig-vacio__t', text: T('Todavía no hay contenido este mes.', 'No content this month yet.') })]));
    return;
  }
  const porAprobar = delMes.filter((p) => etapa(p).k === 'revisar').length;
  cuerpoEl.appendChild(el('p', { class: 'ig-resumen' }, [
    el('b', { text: mesLista === 'sin' ? T('Sin fecha', 'No date') : nombreMes(mesLista) }),
    el('span', { text: ` · ${delMes.length} ${delMes.length === 1 ? T('pieza', 'piece') : T('piezas', 'pieces')}` + (porAprobar ? ` · ${porAprobar} ${T('por aprobar', 'to approve')}` : '') }),
  ]));
  const grupos = [
    ['video', T('Videos', 'Videos'), T('Video', 'Video'), (p) => esVideo(p)],
    ['carrusel', T('Carruseles', 'Carousels'), T('Carrusel', 'Carousel'), (p) => esCarrusel(p)],
    ['foto', T('Fotos', 'Photos'), T('Foto', 'Photo'), (p) => !esVideo(p) && !esCarrusel(p)],
  ];
  for (const [k, titulo, uno, es] of grupos) {
    const items = delMes.filter(es);
    if (!items.length) continue;
    const sec = el('section', { class: 'ig-seccion', dataset: { tipo: k } }, [
      el('h3', { class: 'ig-seccion__t' }, [el('span', { text: titulo }), el('b', { text: String(items.length) })]),
    ]);
    items.forEach((p, i) => {
      const e = etapa(p);
      const item = el('div', { class: 'ig-item' });
      const barra = el('button', { class: 'ig-barra', type: 'button', 'aria-expanded': 'false', onclick: () => alternarDesglose(item, barra, p) }, [
        el('span', { class: 'ig-barra__num', text: `${uno} ${i + 1}` }),
        el('span', { class: 'ig-barra__txt' }, [
          el('b', { text: tituloCorto(p) }),
          el('small', { text: p.publish_date ? diaCorto(p) : T('Sin fecha', 'No date') }),
        ]),
        el('span', { class: 'ig-estado', dataset: { k: e.k }, text: e.txt }),
        el('span', { class: 'ig-barra__flecha', 'aria-hidden': 'true' }),
      ]);
      item.appendChild(barra);
      sec.appendChild(item);
      if (desplegadas.has(p.id)) alternarDesglose(item, barra, p, true);
    });
    cuerpoEl.appendChild(sec);
  }
}

// El guion de una barrita, solo para leer: video = Gancho/Desarrollo/Cierre,
// carrusel = sus slides, foto = su copy. Se abre y se cierra sin repintar la
// pantalla (así no brinca el scroll).
function desglose(p) {
  const caja = el('div', { class: 'ig-desglose' });
  for (const [etq, txt] of bloques(p)) {
    const s = String(txt || '').trim();
    if (s) caja.appendChild(el('div', { class: 'ig-bloque' }, [el('label', { text: etq }), el('div', { class: 'ig-bloque__txt', text: s })]));
  }
  if (!caja.children.length && String(p.caption || '').trim()) {
    caja.appendChild(el('div', { class: 'ig-bloque' }, [el('label', { text: T('Copy', 'Caption') }), el('div', { class: 'ig-bloque__txt', text: String(p.caption).trim() })]));
  }
  if (!caja.children.length) caja.appendChild(el('p', { class: 'ig-muted', text: T('El guion todavía no está listo.', 'The script is not ready yet.') }));
  return caja;
}
function alternarDesglose(item, barra, p, abrir) {
  const abierto = abrir != null ? !abrir : item.classList.contains('is-open');
  const viejo = item.querySelector('.ig-desglose');
  if (viejo) viejo.remove();
  item.classList.toggle('is-open', !abierto);
  barra.setAttribute('aria-expanded', abierto ? 'false' : 'true');
  if (abierto) { desplegadas.delete(p.id); return; }
  desplegadas.add(p.id);
  item.appendChild(desglose(p));
}

// ── Pestaña Perfil ───────────────────────────────────────────────────────────
function pedirIg() {
  if (ig) return;
  ig = 'cargando';
  // Con client_id: el equipo abre esta vista como "Vista del cliente" y, sin
  // él, el servidor contestaba 400 ("client_id requerido") y el Perfil decía
  // "Conecta tu Instagram" aunque sí estuviera conectado. A un cliente el
  // servidor le pone su propia marca de todos modos.
  const m = marca();
  api.get('/ig/feed' + (m ? `?client_id=${encodeURIComponent(m.id)}` : '')).then((r) => { ig = r || { connected: false }; }).catch(() => { ig = { connected: false }; })
    .finally(() => {
      if (!rootEl) return;
      // En el Perfil cambia todo; en las demás solo la foto y el @ (sin
      // redibujar: perdería dónde va deslizando).
      if (pestana === 'perfil') pintar(); else repintarCabeceras();
    });
}
const num = (n) => (n == null ? '–' : Number(n).toLocaleString(T('es-MX', 'en-US')));

function llenarCelda(celda, p) {
  clear(celda);
  const cara = portadaDe(p);
  const m = medios.get(p.id);
  const d = entregable(p);
  const esTira = esCarrusel(p) && !(m && m !== 'cargando' && m.slides.length) && d && d.type === 'carrusel' && d.poster_url === cara;
  const vid = !cara && esVideo(p) ? videoDe(p) : null;
  if (cara) celda.appendChild(el('img', { src: cara, alt: '', loading: 'lazy', decoding: 'async', class: esTira ? 'is-tira' : null }));
  else if (vid) celda.appendChild(el('video', { src: conPrimerCuadro(vid), muted: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1' }));
  else celda.appendChild(el('span', { class: 'ig-celda__txt', text: primerIdioma(p.hook || p.title).slice(0, 90) }));
  if (p.publish_date) celda.appendChild(el('span', { class: 'ig-celda__dia', text: diaCorto(p) }));
}

function pintarPerfil() {
  pedirIg();
  const m = marca() || {};
  const datos = ig && ig !== 'cargando' && ig.connected && !ig.error ? ig : null;
  const pf = (datos && datos.perfil) || {};
  const cab = el('div', { class: 'ig-perfil' }, [
    el('div', { class: 'ig-perfil__fila' }, [
      avatar(84),
      el('div', { class: 'ig-nums' }, [
        el('div', {}, [el('b', { text: num(pf.media_count) }), el('span', { text: T('publicaciones', 'posts') })]),
        el('div', {}, [el('b', { text: num(pf.followers) }), el('span', { text: T('seguidores', 'followers') })]),
        el('div', {}, [el('b', { text: num(pf.follows) }), el('span', { text: T('seguidos', 'following') })]),
      ]),
    ]),
    el('p', { class: 'ig-bio' }, [el('b', { text: pf.name || m.name || '' }), pf.biography ? el('span', { text: pf.biography }) : null]),
  ]);
  cuerpoEl.appendChild(cab);
  if (ig === 'cargando') cuerpoEl.appendChild(el('p', { class: 'ig-muted ig-centro', text: T('Cargando tu perfil…', 'Loading your profile…') }));
  else if (!datos) cuerpoEl.appendChild(el('p', { class: 'ig-aviso' }, [
    T('Conecta tu Instagram para ver aquí tus publicaciones reales. ', 'Connect your Instagram to see your real posts here. '),
    el('button', { class: 'ig-link', type: 'button', text: T('Conectar', 'Connect'), onclick: () => cambiar('conexiones') }),
  ]));
  cuerpoEl.appendChild(el('div', { class: 'ig-leyenda' }, [
    el('span', {}, [el('i', { class: 'is-viene' }), T('Lo que viene', 'Coming up')]),
    el('span', {}, [el('i'), T('Ya publicado', 'Published')]),
  ]));

  // Lo que viene: lo más lejano arriba a la izquierda, como lo acomoda Instagram.
  const hoy = hoyYmd();
  const viene = piezasDeMarca().filter((p) => p.status !== 'publicado' && p.publish_date && p.publish_date >= hoy).sort(ordenar).reverse();
  const grid = el('div', { class: 'ig-rejilla' });
  for (const p of viene) {
    const celda = el('button', { class: 'ig-celda is-viene', type: 'button', dataset: { pieza: p.id, medio: p.id }, 'aria-label': `${contentTypeLabel(p.content_type || 'reel')} · ${diaCorto(p)}`, onclick: () => irAPieza(p.id) });
    llenarCelda(celda, p);
    grid.appendChild(celda);
    pedirMedio(p.id);
  }
  for (const x of (datos && datos.posts) || []) {
    const celda = x.permalink
      ? el('a', { class: 'ig-celda', href: x.permalink, target: '_blank', rel: 'noopener' })
      : el('div', { class: 'ig-celda' });
    if (x.thumb) celda.appendChild(x.portadaEsVideo
      ? el('video', { src: x.thumb + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' })
      : el('img', { src: x.thumb, alt: '', loading: 'lazy', decoding: 'async' }));
    grid.appendChild(celda);
  }
  cuerpoEl.appendChild(grid);
  if (viene.length) cuerpoEl.appendChild(el('p', { class: 'ig-muted ig-centro', text: T('Toca una publicación con borde de color para verla y aprobarla.', 'Tap a post with a colored border to see and approve it.') }));
}

function repintarCabeceras() {
  const marcaEl = rootEl && rootEl.querySelector('.ig-marca');
  if (marcaEl) {
    const m = marca() || {};
    clear(marcaEl).append(avatar(36), el('div', {}, [el('b', { text: m.name || T('Mi marca', 'My brand') }), el('small', { text: '@' + handle() })]));
  }
  for (const cab of (rootEl ? rootEl.querySelectorAll('.ig-cab') : [])) {
    const viejo = cab.querySelector('.ig-av');
    if (viejo) viejo.replaceWith(avatar(30));
    const b = cab.querySelector('.ig-cab__txt b');
    if (b) b.textContent = handle();
  }
  for (const b of (rootEl ? rootEl.querySelectorAll('.ig-caption__txt > b') : [])) b.textContent = handle() + ' ';
  const lado = rootEl && rootEl.querySelector('.ig-lado');
  if (lado) lado.replaceWith(ladoFeed());
}

function irAPieza(id) {
  cambiar('feed');
  const p = piezasDeMarca().find((x) => x.id === id);
  if (p && p.publish_date && p.publish_date < hoyYmd().slice(0, 7) + '-01' && !verAnteriores) { verAnteriores = true; pintar(); }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const art = rootEl && rootEl.querySelector(`.ig-post[data-pieza="${CSS.escape(id)}"]`);
    if (art) art.scrollIntoView({ behavior: 'auto', block: 'start' });
  }));
}

// ── Métricas y Conexiones: las vistas de siempre, montadas aquí adentro ─────
async function montarSub(nombre) {
  const host = el('div', { class: 'ig-sub' });
  cuerpoEl.appendChild(host);
  try {
    const mod = nombre === 'metricas'
      ? await import('./metricas.js?v=202611222124')
      : await import('./conexiones.js?v=202611222124');
    if (!rootEl || pestana !== nombre) return;
    const vista = mod.default;
    vista.mount(host, ctx);
    sub = vista;
  } catch {
    host.appendChild(el('p', { class: 'ig-muted ig-centro', text: T('No se pudo abrir. Intenta de nuevo.', 'Could not open. Try again.') }));
  }
}
function desmontarSub() {
  if (sub) { try { sub.unmount(); } catch { /* noop */ } }
  sub = null;
}

// ── Pantalla ─────────────────────────────────────────────────────────────────
const PESTANAS = () => [
  ['feed', T('Feed', 'Feed')],
  ['perfil', T('Perfil', 'Profile')],
  ['metricas', T('Métricas', 'Metrics')],
  ['conexiones', T('Conexiones', 'Connections')],
];

const tabValida = (k) => k === 'lista' || PESTANAS().some(([x]) => x === k);

function cambiar(cual) {
  if (cual === pestana) return;
  pestana = cual;
  verAnteriores = false;   // el Feed vuelve a empezar en el mes actual
  try { history.replaceState(null, '', location.hash.replace(/([?&])tab=[^&]*/, '$1').replace(/[?&]$/, '')); } catch { /* noop */ }
  pintar();
  window.scrollTo({ top: 0 });
}

function pintar() {
  if (!rootEl) return;
  desmontarSub();
  if (observador) { observador.disconnect(); observador = null; }
  clear(rootEl);
  rootEl.dataset.tab = pestana;
  const m = marca() || {};
  rootEl.appendChild(el('header', { class: 'ig-top' }, [
    el('div', { class: 'ig-marca' }, [avatar(36), el('div', {}, [el('b', { text: m.name || T('Mi marca', 'My brand') }), el('small', { text: '@' + handle() })])]),
    el('nav', { class: 'ig-tabs', role: 'tablist' }, PESTANAS().map(([k, txt]) => el('button', {
      class: 'ig-tab' + (pestana === k ? ' is-on' : ''), type: 'button', role: 'tab', 'aria-selected': pestana === k ? 'true' : 'false',
      text: txt, onclick: () => cambiar(k),
    }))),
  ]));
  cuerpoEl = el('div', { class: 'ig-cuerpo' });
  rootEl.appendChild(cuerpoEl);
  if (pestana === 'feed') { pedirIg(); pintarFeed(); }
  else if (pestana === 'perfil') pintarPerfil();
  else if (pestana === 'lista') pintarLista();
  else montarSub(pestana);
  // La barra de abajo del cliente (Feed · Contenido · Avisos) marca dónde está.
  document.body.dataset.cntTab = pestana;
  try { window.dispatchEvent(new CustomEvent('cnt:tab', { detail: pestana })); } catch { /* noop */ }
}

// Mientras escribe en un panel no se repinta (perdería lo escrito).
function ocupado() {
  const a = document.activeElement;
  return !!(rootEl && a && rootEl.contains(a) && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT'));
}

function abrirPendiente() {
  if (!porAbrir || !rootEl) return;
  const p = piezasDeMarca().find((x) => x.id === porAbrir);
  if (!p) return;
  const id = porAbrir;
  porAbrir = null;
  irAPieza(id);
}

// ── Mandar una idea nueva (pieza nueva en SU marca) ─────────────────────────
function abrirIdea() {
  openSheet({
    title: T('Mandar un guion', 'Send a script'),
    mode: 'form',
    build(body, close) {
      const tipos = [['reel', T('Reel', 'Reel')], ['carrusel', T('Carrusel', 'Carousel')], ['post', T('Foto', 'Photo')]];
      let tipo = 'reel';
      const chips = el('div', { class: 'ig-chips' });
      const pintarChips = () => { clear(chips); for (const [k, txt] of tipos) chips.appendChild(el('button', { class: 'ig-chipbtn' + (tipo === k ? ' is-on' : ''), type: 'button', text: txt, onclick: () => { tipo = k; pintarChips(); } })); };
      pintarChips();
      const guion = el('textarea', { class: 'ig-caja ig-caja--grande', rows: 8, placeholder: T('Escribe o pega aquí tu guion…', 'Write or paste your script here…') });
      const archivo = el('input', { type: 'file', accept: '.txt,.docx', hidden: true, onchange: async () => {
        const f = archivo.files && archivo.files[0];
        if (!f) return;
        try { guion.value = await leerArchivo(f); } catch (err) { toast((err && err.message) || T('No se pudo leer el archivo', 'Could not read the file'), 'error'); }
      } });
      const enviar = el('button', { class: 'btn btn-primary', type: 'button', text: T('Enviar a mi equipo', 'Send to my team'), onclick: async () => {
        const texto = guion.value.trim();
        if (!texto) { guion.focus(); return; }
        enviar.disabled = true;
        const me = estado().me || {};
        try {
          const creado = await api.post('/posts', { client_id: marcaId, content_type: tipo, title: `${T('Guion de', 'Script by')} ${me.name || T('cliente', 'client')}`, body: texto });
          if (creado && creado.id) ctx.store.upsertPost?.(creado);
          close({ source: 'done' });
          toast(T('¡Recibido! Tu equipo ya tiene tu guion.', 'Received! Your team has your script.'), 'success', 5000);
          pintar();
        } catch (err) { enviar.disabled = false; toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
      } });
      body.append(chips, guion,
        el('label', { class: 'ig-archivo' }, [T('o ', 'or '), el('u', { text: T('elige un archivo', 'choose a file') }), T(' (Word o texto)', ' (Word or text)'), archivo]),
        el('div', { class: 'sheet__footer' }, [el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }), enviar]));
      setTimeout(() => guion.focus(), 60);
    },
  });
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/contenido.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/contenido.css?v=202611222124';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'ig' + (isEN ? ' is-en' : '') });
    host.appendChild(rootEl);
    marcaId = estado().activeClientId || null;
    const prm = (c && c.params) || {};
    if (prm.tab && tabValida(prm.tab)) pestana = prm.tab;
    unsubs.push(ctx.store.subscribe(['posts', 'clients', 'activeClientId'], () => {
      const ahora = estado().activeClientId || null;
      if (ahora !== marcaId) { marcaId = ahora; ig = null; medios.clear(); dlvMarca.clear(); abiertos.clear(); verAnteriores = false; }
      if (pestana === 'feed' || pestana === 'perfil' || pestana === 'lista') { if (!ocupado()) pintar(); }
      abrirPendiente();
    }));
    pedirIg();
    refrescarSiViejo();
    document.addEventListener('visibilitychange', alVolver);
    pintar();
    porAbrir = prm.pieza || null;
    abrirPendiente();
  },
  onParams(params) {
    if (params && params.tab && tabValida(params.tab)) {
      if (params.tab !== pestana) cambiar(params.tab);
      else if (pestana === 'feed' && verAnteriores) { verAnteriores = false; pintar(); window.scrollTo({ top: 0 }); }
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (params && params.pieza) { porAbrir = params.pieza; abrirPendiente(); }
  },
  unmount() {
    document.removeEventListener('visibilitychange', alVolver);
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    desmontarSub();
    if (observador) { observador.disconnect(); observador = null; }
    rootEl = null; cuerpoEl = null; ctx = null; porAbrir = null; pestana = 'feed'; verAnteriores = false; mesLista = null;
    delete document.body.dataset.cntTab;
    try { window.dispatchEvent(new CustomEvent('cnt:tab', { detail: null })); } catch { /* noop */ }
    abiertos.clear();
  },
};
