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
import { el, clear, api, toast, contentTypeLabel } from '../api.js?v=202611172243';
import { T, isEN } from '../shell/i18n.js?v=202611172243';
import { openSheet } from '../shell/sheet.js?v=202611172243';
import { slidesFromPost, fieldsFromSlides } from '../editor/slides.js?v=202611172243';

const VIEW_ID = 'contenido';

let ctx = null;
let rootEl = null;
let cuerpoEl = null;
let unsubs = [];
let marcaId = null;
let pestana = 'feed';            // feed | perfil | metricas | conexiones
let verAnteriores = false;
let porAbrir = null;             // ?pieza=<id> (aviso) hasta que llegue la pieza
let sub = null;                  // vista montada adentro (métricas o conexiones)
let observador = null;
const medios = new Map();        // postId → { slides, portada, video } | 'cargando'
const dlvMes = new Map();        // `${marca}|${YYYY-MM}` → Map(post_id → entregable) | 'cargando'
let ig = null;                   // respuesta de /ig/feed | 'cargando'
const abiertos = new Map();      // postId → 'cambio' | 'guion' | 'editar' | 'nuevo'

// ── Datos ────────────────────────────────────────────────────────────────────
const estado = () => ctx.store.getState();
function marca() { return (estado().clients || []).find((c) => c.id === marcaId) || null; }
function piezasDeMarca() {
  return (estado().posts || []).filter((p) => p && p.client_id === marcaId
    && !(p.client_visible === 0 || p.client_visible === false));
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
// La portada del entregable (la que sube el equipo con el video) por mes.
function entregable(p) {
  const ym = mesDe(p);
  if (!ym) return null;
  const key = `${marcaId}|${ym}`;
  const hit = dlvMes.get(key);
  if (hit && hit !== 'cargando') return hit.get(p.id) || null;
  if (!hit) {
    dlvMes.set(key, 'cargando');
    api.get(`/deliverables?client_id=${encodeURIComponent(marcaId)}&month=${encodeURIComponent(ym)}`)
      .then((r) => { const mapa = new Map(); for (const d of ((r && r.deliverables) || [])) if (d.post_id) mapa.set(d.post_id, d); dlvMes.set(key, mapa); })
      .catch(() => dlvMes.set(key, new Map()))
      .finally(() => { for (const x of piezasDeMarca()) if (mesDe(x) === ym) repintarMedio(x.id); });
  }
  return null;
}
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
  const video = (datos && datos.video) || (d && d.video_url) || null;
  const portada = portadaDe(p);

  if (esCarrusel(p)) {
    const fotos = datos && datos.slides.length ? datos.slides : [];
    const textos = slidesFromPost(p).filter((t, i, a) => t || (i > 0 && i < a.length - 1));
    const items = fotos.length ? fotos.map((u) => ({ foto: u })) : (textos.length ? textos.map((t) => ({ texto: t })) : [{ texto: p.title || '' }]);
    const pista = el('div', { class: 'ig-pista' });
    items.forEach((it, i) => {
      pista.appendChild(it.foto
        ? el('div', { class: 'ig-slide' }, [el('img', { src: it.foto, alt: '', loading: 'lazy', decoding: 'async' })])
        : el('div', { class: 'ig-slide ig-slide--texto' }, [
          el('em', { text: i === 0 ? T('PORTADA', 'COVER') : (i === items.length - 1 ? T('CIERRE', 'CLOSING') : `${T('SLIDE', 'SLIDE')} ${i + 1}`) }),
          el('p', { text: primerIdioma(it.texto) || T('Texto en preparación', 'Text in progress') }),
          el('small', { text: T('Foto pendiente', 'Photo pending') }),
        ]));
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
    return;
  }
  if (esVideo(p)) {
    if (video) {
      caja.appendChild(el('video', { src: video, poster: portada || null, controls: true, playsinline: true, preload: 'none' }));
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
function repintarMedio(id) {
  if (!rootEl) return;
  const p = piezasDeMarca().find((x) => x.id === id);
  if (!p) return;
  const caja = rootEl.querySelector(`.ig-media[data-medio="${CSS.escape(id)}"]`);
  if (caja) {
    llenarMedio(caja, p);
    const art = caja.closest('.ig-post');
    const viejo = art && art.querySelector('.ig-puntos');
    const n = Number(caja.dataset.n || 0);
    if (viejo) viejo.remove();
    if (art && n > 1) caja.after(puntos(n));
  }
  const celda = rootEl.querySelector(`.ig-celda[data-pieza="${CSS.escape(id)}"]`);
  if (celda) llenarCelda(celda, p);
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
    el('div', { class: 'ig-cuando', text: fechaLarga(p) }),
    el('div', { class: 'ig-cab' }, [avatar(30), el('div', { class: 'ig-cab__txt' }, [el('b', { text: handle() }), el('span', { text: contentTypeLabel(p.content_type || 'reel') })]), el('span', { class: 'ig-estado', dataset: { k: e.k }, text: e.txt })]),
    caja,
    n > 1 ? puntos(n) : null,
    el('div', { class: 'ig-caption' }, [txt, (caption.length + tags.length) > 90 ? verTodo : null]),
    e.k === 'cambio' ? el('p', { class: 'ig-pedido', text: T('Pediste un cambio. Tu equipo ya lo tiene y te avisa cuando esté listo.', 'You asked for a change. Your team has it and will let you know when it’s ready.') }) : null,
    acciones(p, e),
    panel(p),
  ].filter(Boolean));
  return art;
}

function acciones(p, e) {
  const abierto = abiertos.get(p.id);
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
      el('button', { class: 'ig-btn', type: 'button', text: T('Subir guion nuevo', 'Upload new script'), onclick: () => { abiertos.set(p.id, 'nuevo'); repintarPost(p.id); } }),
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
  if (anteriores.length && !verAnteriores) {
    frag.appendChild(el('button', { class: 'ig-anteriores', type: 'button', text: T(`Ver publicaciones anteriores (${anteriores.length})`, `See earlier posts (${anteriores.length})`), onclick: () => { verAnteriores = true; pintar(); } }));
  }
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
  for (const art of frag.querySelectorAll('.ig-post')) vigilar(art);
}

// ── Pestaña Perfil ───────────────────────────────────────────────────────────
function pedirIg() {
  if (ig) return;
  ig = 'cargando';
  api.get('/ig/feed').then((r) => { ig = r || { connected: false }; }).catch(() => { ig = { connected: false }; })
    .finally(() => { if (rootEl) pintar(); });
}
const num = (n) => (n == null ? '–' : Number(n).toLocaleString(T('es-MX', 'en-US')));

function llenarCelda(celda, p) {
  clear(celda);
  const cara = portadaDe(p);
  if (cara) celda.appendChild(el('img', { src: cara, alt: '', loading: 'lazy', decoding: 'async' }));
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

function irAPieza(id) {
  cambiar('feed');
  const p = piezasDeMarca().find((x) => x.id === id);
  if (p && p.publish_date && p.publish_date < hoyYmd().slice(0, 7) + '-01' && !verAnteriores) { verAnteriores = true; pintar(); }
  setTimeout(() => {
    const art = rootEl && rootEl.querySelector(`.ig-post[data-pieza="${CSS.escape(id)}"]`);
    if (art) art.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

// ── Métricas y Conexiones: las vistas de siempre, montadas aquí adentro ─────
async function montarSub(nombre) {
  const host = el('div', { class: 'ig-sub' });
  cuerpoEl.appendChild(host);
  try {
    const mod = nombre === 'metricas'
      ? await import('./metricas.js?v=202611172243')
      : await import('./conexiones.js?v=202611172243');
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

function cambiar(cual) {
  if (cual === pestana) return;
  pestana = cual;
  try { history.replaceState(null, '', location.hash.replace(/([?&])tab=[^&]*/, '$1').replace(/[?&]$/, '')); } catch { /* noop */ }
  pintar();
  window.scrollTo({ top: 0 });
}

function pintar() {
  if (!rootEl) return;
  desmontarSub();
  if (observador) { observador.disconnect(); observador = null; }
  clear(rootEl);
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
  else montarSub(pestana);
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
  link.href = '/marketing/css/contenido.css?v=202611172243';
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
    if (prm.tab && PESTANAS().some(([k]) => k === prm.tab)) pestana = prm.tab;
    unsubs.push(ctx.store.subscribe(['posts', 'clients', 'activeClientId'], () => {
      const ahora = estado().activeClientId || null;
      if (ahora !== marcaId) { marcaId = ahora; ig = null; medios.clear(); abiertos.clear(); verAnteriores = false; }
      if (pestana === 'feed' || pestana === 'perfil') { if (!ocupado()) pintar(); }
      abrirPendiente();
    }));
    pintar();
    porAbrir = prm.pieza || null;
    abrirPendiente();
  },
  onParams(params) {
    if (params && params.tab && params.tab !== pestana && PESTANAS().some(([k]) => k === params.tab)) cambiar(params.tab);
    if (params && params.pieza) { porAbrir = params.pieza; abrirPendiente(); }
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    desmontarSub();
    if (observador) { observador.disconnect(); observador = null; }
    rootEl = null; cuerpoEl = null; ctx = null; porAbrir = null; pestana = 'feed'; verAnteriores = false;
    abiertos.clear();
  },
};
