// ============================================================================
// IVAE Marketing — Vista "Mi contenido": lo que el CLIENTE necesita, y nada más.
//
// Pedido de Vianey (26-oct-2026): "la parte donde se ve el contenido no es
// fácil de ver para el cliente… más sencillo, más visual, con menos cosas
// irrelevantes, aun si ellos quieren subir su guion", y que se use en la app
// de las tiendas con el teléfono parado y acostado.
//
// La tabla de Calendario es la mesa de trabajo del equipo (columnas de estado,
// grabación, notas, fechas…). El cliente solo quiere tres cosas:
//   1) VER sus piezas del mes, con la portada del reel o del carrusel;
//   2) LEER el guion y ver el video, y aprobar o pedir cambios;
//   3) MANDAR su propio guion cuando quiera.
// Todo con los mismos endpoints que ya usa el cliente (posts de SU marca,
// entregables de SU marca, /approve, /request-changes, /comments).
//
// Teléfono parado: 2 columnas y la pieza abierta en una columna. Acostado: más
// columnas y la pieza abierta con el video a la izquierda y el guion a la
// derecha (css/contenido.css). Respeta las zonas seguras del iPhone.
// ============================================================================
import { el, clear, api, toast, fmtDate, timeAgo, contentTypeLabel, CONTENT_TYPES } from '../api.js?v=202610270229';
import { T } from '../shell/i18n.js?v=202610270229';
import { icon } from '../shell/icons.js?v=202610270229';
import { openSheet } from '../shell/sheet.js?v=202610270229';
import { pushLayer } from '../shell/router.js?v=202610270229';

const VIEW_ID = 'contenido';

let ctx = null;
let rootEl = null;
let unsubs = [];
let mes = null;              // 'YYYY-MM' en pantalla
let filtro = 'todo';         // todo | revisar | aprobado | publicado
let marcaId = null;
const dlvCache = new Map();  // `${marca}|${mes}` → Map(post_id → entregable) | 'cargando'
let abierta = null;          // { id, nodo, soltar }
let porAbrir = null;         // ?pieza=<id> (de un aviso) mientras llegan las piezas

// ── Datos ────────────────────────────────────────────────────────────────────
function estado() { return ctx.store.getState(); }

function piezasDeMarca() {
  const st = estado();
  const id = st.activeClientId;
  return (st.posts || []).filter((p) => p && p.client_id === id
    // El equipo la ve como la verá el cliente: lo que tiene escondido no sale.
    && !(p.client_visible === 0 || p.client_visible === false));
}

const mesDe = (p) => (p.publish_date ? String(p.publish_date).slice(0, 7) : '');
function hoyMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesesConContenido() {
  const s = new Set(piezasDeMarca().map(mesDe).filter(Boolean));
  s.add(hoyMes());
  return [...s].sort();
}

// Aterriza en el mes de hoy si tiene piezas; si no, en el siguiente que sí
// tenga; si no hay futuro, en el último con contenido.
function mesInicial() {
  const meses = mesesConContenido();
  const hoy = hoyMes();
  const conPiezas = new Set(piezasDeMarca().map(mesDe).filter(Boolean));
  if (conPiezas.has(hoy)) return hoy;
  const futuro = meses.find((m) => m > hoy && conPiezas.has(m));
  if (futuro) return futuro;
  const pasado = [...conPiezas].sort().pop();
  return pasado || hoy;
}

function nombreMes(m) {
  const [y, mm] = m.split('-').map(Number);
  const s = new Date(y, mm - 1, 1).toLocaleDateString(T('es-MX', 'en-US'), { month: 'long' });
  return `${s.charAt(0).toUpperCase() + s.slice(1)} ${y}`;
}

// "Mar 6 oct" / "Tue, Oct 6": corto y sin mayúsculas raras.
function fechaCorta(ymdStr) {
  const [y, m, d] = String(ymdStr).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const f = new Date(y, m - 1, d);
  const s = T(
    `${f.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')} ${d} ${f.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`,
    f.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const tieneMedio = (d) => !!(d && (d.video_url || d.poster_url || (d.slide_urls && d.slide_urls.length)));
const esUrl = (u) => /^https?:\/\//i.test(String(u || ''));

function tieneGuion(p) {
  return !!(String(p.hook || '').trim() || String(p.body || '').trim() || String(p.cta || '').trim() || String(p.caption || '').trim());
}

// La etapa EN PALABRAS DEL CLIENTE (no el flujo interno del equipo).
function etapa(p, dlv) {
  if (p.status === 'publicado') return { k: 'publicado', txt: T('Publicado', 'Published') };
  if (p.approval_state === 'approved' || p.status === 'aprobado' || p.status === 'programado') return { k: 'aprobado', txt: T('Aprobado', 'Approved') };
  if (p.approval_state === 'changes') return { k: 'cambios', txt: T('Pediste cambios', 'Changes requested') };
  if (tieneGuion(p) || tieneMedio(dlv)) return { k: 'revisar', txt: T('Por revisar', 'To review') };
  return { k: 'preparando', txt: T('En preparación', 'In progress') };
}

function pasaFiltro(e) {
  if (filtro === 'todo') return true;
  if (filtro === 'revisar') return e.k === 'revisar';
  if (filtro === 'aprobado') return e.k === 'aprobado';
  if (filtro === 'publicado') return e.k === 'publicado';
  return true;
}

function ordenar(a, b) {
  const fa = a.publish_date || '9999-99-99', fb = b.publish_date || '9999-99-99';
  if (fa !== fb) return fa < fb ? -1 : 1;
  return (Number(a.position) || 0) - (Number(b.position) || 0);
}

// Entregables del mes (reels y carruseles terminados), por pieza vinculada.
function entregablesDe(m) {
  const key = `${marcaId}|${m}`;
  const hit = dlvCache.get(key);
  if (hit && hit !== 'cargando') return hit;
  if (!hit && marcaId) {
    dlvCache.set(key, 'cargando');
    api.get(`/deliverables?client_id=${encodeURIComponent(marcaId)}&month=${encodeURIComponent(m)}`)
      .then((r) => {
        const mapa = new Map();
        for (const d of ((r && r.deliverables) || [])) if (d.post_id) mapa.set(d.post_id, d);
        dlvCache.set(key, mapa);
      })
      .catch(() => dlvCache.set(key, new Map()))
      .finally(() => { if (rootEl && mes === m) render(); });
  }
  return new Map();
}


// ── Portada de la tarjeta ────────────────────────────────────────────────────
function portada(p, dlv) {
  if (dlv && dlv.poster_url) {
    // La tira de un carrusel es ancha: se ve su PRIMER slide (pegado a la izquierda).
    return el('img', { class: 'cnt-card__img' + (dlv.type === 'carrusel' ? ' is-tira' : ''), src: dlv.poster_url, alt: '', loading: 'lazy', decoding: 'async' });
  }
  if (dlv && dlv.video_url) {
    return el('video', { class: 'cnt-card__img', src: dlv.video_url + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' });
  }
  if (dlv && dlv.slide_urls && dlv.slide_urls.length) {
    return el('video', { class: 'cnt-card__img', src: dlv.slide_urls[0] + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' });
  }
  // Sin video todavía: la tarjeta ES el gancho del guion, en grande.
  const frase = String(p.hook || p.title || p.body || '').trim();
  return el('div', { class: 'cnt-card__texto' }, [
    el('span', { class: 'cnt-card__frase', text: frase.length > 120 ? frase.slice(0, 117) + '…' : (frase || T('Guion en preparación', 'Script in progress')) }),
  ]);
}

function tarjeta(p, dlv) {
  const e = etapa(p, dlv);
  const tipo = p.content_type || 'reel';
  const esVideo = !!(dlv && (dlv.video_url || (dlv.slide_urls && dlv.slide_urls.length)));
  return el('button', {
    class: 'cnt-card', type: 'button', 'data-etapa': e.k,
    'aria-label': `${contentTypeLabel(tipo)} · ${p.title || ''} · ${e.txt}`,
    onclick: () => abrir(p.id),
  }, [
    el('span', { class: 'cnt-card__media' }, [
      portada(p, dlv),
      esVideo ? el('span', { class: 'cnt-card__play', 'aria-hidden': 'true' }, [icon('play', 18)]) : null,
      el('span', { class: 'cnt-card__tipo', style: { '--tipo': (CONTENT_TYPES[tipo] || {}).color || '#64748b' }, text: contentTypeLabel(tipo) }),
    ]),
    el('span', { class: 'cnt-card__pie' }, [
      el('span', { class: 'cnt-card__titulo', text: p.title || T('Sin título', 'Untitled') }),
      el('span', { class: 'cnt-card__meta' }, [
        el('span', { class: 'cnt-card__fecha', text: p.publish_date ? fechaCorta(p.publish_date) : T('Sin fecha', 'No date') }),
        el('span', { class: 'cnt-etapa', 'data-etapa': e.k, text: e.txt }),
      ]),
    ]),
  ]);
}

// ── Pantalla ─────────────────────────────────────────────────────────────────
// Abre la pieza pedida por la URL en cuanto exista en la marca (las piezas
// pueden llegar después del montaje).
function abrirPendiente() {
  if (!porAbrir || !rootEl) return;
  const p = piezasDeMarca().find((x) => x.id === porAbrir);
  if (!p) return;
  porAbrir = null;
  if (mesDe(p)) { mes = mesDe(p); filtro = 'todo'; }
  render();
  abrir(p.id);
}

function render() {
  if (!rootEl) return;
  const meses = mesesConContenido();
  if (!mes || !meses.includes(mes)) mes = mesInicial();
  const dlvs = entregablesDe(mes);
  const delMes = piezasDeMarca().filter((p) => mesDe(p) === mes).sort(ordenar);
  const conEtapa = delMes.map((p) => ({ p, d: dlvs.get(p.id), e: etapa(p, dlvs.get(p.id)) }));
  const cuenta = (k) => conEtapa.filter((x) => x.e.k === k).length;
  const visibles = conEtapa.filter((x) => pasaFiltro(x.e));

  clear(rootEl);
  const ix = meses.indexOf(mes);
  const cab = el('div', { class: 'cnt-cab' }, [
    el('div', { class: 'cnt-mes' }, [
      el('button', { class: 'cnt-mes__btn', type: 'button', 'aria-label': T('Mes anterior', 'Previous month'), disabled: ix <= 0, onclick: () => { mes = meses[ix - 1]; filtro = 'todo'; render(); } }, [icon('left', 20)]),
      el('h1', { class: 'cnt-mes__nombre', text: nombreMes(mes) }),
      el('button', { class: 'cnt-mes__btn', type: 'button', 'aria-label': T('Mes siguiente', 'Next month'), disabled: ix >= meses.length - 1, onclick: () => { mes = meses[ix + 1]; filtro = 'todo'; render(); } }, [icon('right', 20)]),
    ]),
    el('button', { class: 'btn btn-primary cnt-subir', type: 'button', onclick: abrirSubirGuion }, [icon('plus', 18), el('span', { text: T('Subir mi guion', 'Send my script') })]),
  ]);
  const opciones = [
    ['todo', T('Todo', 'All'), conEtapa.length],
    ['revisar', T('Por revisar', 'To review'), cuenta('revisar')],
    ['aprobado', T('Aprobado', 'Approved'), cuenta('aprobado')],
    ['publicado', T('Publicado', 'Published'), cuenta('publicado')],
  ];
  const filtros = el('div', { class: 'cnt-filtros', role: 'tablist' }, opciones.map(([k, txt, n]) => el('button', {
    class: 'cnt-filtro' + (filtro === k ? ' is-on' : '') + (k === 'revisar' && n ? ' is-alerta' : ''),
    type: 'button', role: 'tab', 'aria-selected': filtro === k ? 'true' : 'false',
    onclick: () => { filtro = k; render(); },
  }, [el('span', { text: txt }), el('b', { text: String(n) })])));

  rootEl.append(cab, filtros);

  if (!visibles.length) {
    rootEl.appendChild(el('div', { class: 'cnt-vacio' }, [
      el('p', { class: 'cnt-vacio__t', text: delMes.length
        ? T('Nada en este filtro.', 'Nothing in this filter.')
        : T('Todavía no hay contenido este mes.', 'No content this month yet.') }),
      delMes.length ? null : el('p', { class: 'cnt-vacio__s', text: T('¿Tienes una idea o un guion? Mándalo y tu equipo lo prepara.', 'Have an idea or a script? Send it and your team will prepare it.') }),
      delMes.length ? null : el('button', { class: 'btn btn-primary', type: 'button', onclick: abrirSubirGuion, text: T('Subir mi guion', 'Send my script') }),
    ]));
    return;
  }
  rootEl.appendChild(el('div', { class: 'cnt-grid' }, visibles.map((x) => tarjeta(x.p, x.d))));
}

// ── La pieza abierta ─────────────────────────────────────────────────────────
function seccion(titulo, texto, { copiar = false } = {}) {
  const t = String(texto || '').trim();
  if (!t) return null;
  return el('section', { class: 'cnt-sec' }, [
    el('div', { class: 'cnt-sec__cab' }, [
      el('h3', { class: 'cnt-sec__t', text: titulo }),
      copiar ? el('button', {
        class: 'cnt-sec__copiar', type: 'button', text: T('Copiar', 'Copy'),
        onclick: async () => {
          try { await navigator.clipboard.writeText(t); toast(T('Copiado ✓', 'Copied ✓'), 'success', 1800); }
          catch { toast(T('No se pudo copiar', 'Could not copy'), 'error'); }
        },
      }) : null,
    ]),
    el('p', { class: 'cnt-sec__txt', text: t }),
  ]);
}

// Una tira de IMÁGENES (carrusel) se ve partida en sus slides, deslizables.
function tiraEnSlides(url) {
  const fila = el('div', { class: 'cnt-slides' });
  const img = new Image();
  img.onload = () => {
    const n = Math.max(1, Math.min(20, Math.round((img.naturalWidth / img.naturalHeight) / 0.8)));
    for (let k = 0; k < n; k++) {
      fila.appendChild(el('div', {
        class: 'cnt-slide cnt-slide--img', role: 'img', 'aria-label': `${T('Slide', 'Slide')} ${k + 1}/${n}`,
        style: { backgroundImage: `url("${url}")`, backgroundSize: `${n * 100}% 100%`, backgroundPosition: n > 1 ? `${(k / (n - 1)) * 100}% 0` : '0 0' },
      }));
    }
  };
  img.src = url;
  return fila;
}

function medio(p, dlv) {
  if (!dlv) return null;
  if (dlv.slide_urls && dlv.slide_urls.length) {
    return el('div', { class: 'cnt-slides' }, dlv.slide_urls.map((u, k) => el('video', {
      class: 'cnt-slide', src: u, controls: true, playsinline: true, preload: 'metadata',
      'aria-label': `${T('Slide', 'Slide')} ${k + 1}/${dlv.slide_urls.length}`,
    })));
  }
  if (dlv.video_url) {
    return el('video', { class: 'cnt-video', src: dlv.video_url, poster: dlv.poster_url || null, controls: true, playsinline: true, preload: 'metadata' });
  }
  if (dlv.type === 'carrusel' && dlv.poster_url) return tiraEnSlides(dlv.poster_url);
  if (dlv.link && esUrl(dlv.link)) {
    return el('a', { class: 'btn cnt-link', href: dlv.link, target: '_blank', rel: 'noopener', text: T('Ver carrusel', 'View carousel') });
  }
  return null;
}

function comentarioNodo(c) {
  const mio = c.author_role === 'client' || c._mine;
  return el('div', { class: 'cnt-com' + (mio ? ' is-mio' : '') }, [
    el('div', { class: 'cnt-com__cab' }, [
      el('b', { text: c.author_name || (mio ? T('Tú', 'You') : T('Equipo', 'Team')) }),
      el('span', { text: c.created_at ? timeAgo(c.created_at) : '' }),
    ]),
    el('p', { text: c.body || '' }),
  ]);
}

function abrir(id) {
  const p = piezasDeMarca().find((x) => x.id === id);
  if (!p) return;
  cerrar();
  const dlv = entregablesDe(mesDe(p) || mes).get(p.id);
  const e = etapa(p, dlv);
  const tipo = p.content_type || 'reel';
  const decidir = e.k === 'revisar' || e.k === 'preparando' || e.k === 'cambios';

  const listaCom = el('div', { class: 'cnt-coms' }, [el('p', { class: 'cnt-muted', text: T('Cargando comentarios…', 'Loading comments…') })]);
  const caja = el('textarea', { class: 'input cnt-caja', rows: 2, placeholder: T('Escribe un comentario para tu equipo…', 'Write a comment for your team…'), 'aria-label': T('Comentario', 'Comment') });
  const enviarCom = el('button', {
    class: 'btn', type: 'button', text: T('Enviar', 'Send'),
    onclick: async () => {
      const body = caja.value.trim();
      if (!body) { caja.focus(); return; }
      enviarCom.disabled = true;
      try {
        const c = await api.post(`/posts/${encodeURIComponent(p.id)}/comments`, { body });
        caja.value = '';
        const vacio = listaCom.querySelector('.cnt-muted');
        if (vacio) vacio.remove();
        listaCom.appendChild(comentarioNodo({ ...(c || {}), body, _mine: true, author_name: (c && c.author_name) || T('Tú', 'You'), created_at: (c && c.created_at) || new Date().toISOString() }));
      } catch (err) { toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
      enviarCom.disabled = false;
    },
  });

  const acciones = decidir ? el('div', { class: 'cnt-acciones' }, [
    el('button', {
      class: 'btn cnt-cambios', type: 'button', text: T('Pedir cambios', 'Request changes'),
      onclick: () => pedirCambios(p),
    }),
    el('button', {
      class: 'btn btn-primary cnt-aprobar', type: 'button', text: T('Aprobar', 'Approve'),
      onclick: async (ev) => {
        const b = ev.currentTarget; b.disabled = true;
        try {
          const r = await api.post(`/posts/${encodeURIComponent(p.id)}/approve`, {});
          if (r && r.post) ctx.store.upsertPost?.(r.post);
          toast(T('¡Aprobado! Tu equipo ya lo sabe ✨', 'Approved! Your team knows ✨'), 'success');
          cerrar(); render();
        } catch (err) { b.disabled = false; toast((err && err.message) || T('No se pudo aprobar', 'Could not approve'), 'error'); }
      },
    }),
  ]) : null;

  const lado = medio(p, dlv);
  const nodo = el('div', { class: 'cnt-pieza', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title || contentTypeLabel(tipo) }, [
    el('header', { class: 'cnt-pieza__cab' }, [
      el('button', { class: 'cnt-pieza__x', type: 'button', 'aria-label': T('Cerrar', 'Close'), onclick: () => cerrar() }, [icon('left', 22)]),
      el('div', { class: 'cnt-pieza__tit' }, [
        el('b', { text: p.title || contentTypeLabel(tipo) }),
        el('span', { text: [contentTypeLabel(tipo), p.publish_date ? fmtDate(p.publish_date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''].filter(Boolean).join(' · ') }),
      ]),
      el('span', { class: 'cnt-etapa', 'data-etapa': e.k, text: e.txt }),
    ]),
    el('div', { class: 'cnt-pieza__cuerpo' + (lado ? ' con-medio' : '') }, [
      lado ? el('div', { class: 'cnt-pieza__medio' }, [lado]) : null,
      el('div', { class: 'cnt-pieza__texto' }, [
        seccion(T('Gancho', 'Hook'), p.hook),
        seccion(T('Guion', 'Script'), p.body),
        seccion(T('Cierre', 'Call to action'), p.cta),
        seccion(T('Texto de la publicación', 'Post caption'), p.caption, { copiar: true }),
        seccion('Hashtags', p.hashtags, { copiar: true }),
        (!tieneGuion(p) && !lado) ? el('p', { class: 'cnt-muted', text: T('Tu equipo está preparando esta pieza. Aquí verás el guion y el video en cuanto estén listos.', 'Your team is preparing this piece. The script and video will show here when ready.') }) : null,
        p.inspo_url && esUrl(p.inspo_url) ? el('a', { class: 'cnt-ref', href: p.inspo_url, target: '_blank', rel: 'noopener' }, [icon('link', 16), el('span', { text: T('Ver referencia', 'See reference') })]) : null,
        el('section', { class: 'cnt-sec' }, [
          el('h3', { class: 'cnt-sec__t', text: T('Comentarios', 'Comments') }),
          listaCom,
          el('div', { class: 'cnt-nuevo-com' }, [caja, enviarCom]),
        ]),
      ]),
    ]),
    acciones,
  ]);
  document.body.appendChild(nodo);
  document.body.classList.add('cnt-abierta');
  const soltar = pushLayer(() => cerrar({ desdeAtras: true }));
  abierta = { id: p.id, nodo, soltar };
  const x = nodo.querySelector('.cnt-pieza__x');
  if (x) x.focus();

  api.get(`/posts/${encodeURIComponent(p.id)}`).then((data) => {
    if (!abierta || abierta.id !== p.id) return;
    const coms = ((data && data.comments) || []).filter((c) => !c.internal);
    clear(listaCom);
    if (!coms.length) listaCom.appendChild(el('p', { class: 'cnt-muted', text: T('Sin comentarios todavía.', 'No comments yet.') }));
    for (const c of coms) listaCom.appendChild(comentarioNodo(c));
  }).catch(() => {
    if (!abierta || abierta.id !== p.id) return;
    clear(listaCom);
    listaCom.appendChild(el('p', { class: 'cnt-muted', text: T('No se pudieron cargar los comentarios.', 'Could not load comments.') }));
  });
}

function cerrar(info = {}) {
  if (!abierta) return;
  const { nodo, soltar } = abierta;
  abierta = null;
  for (const v of nodo.querySelectorAll('video')) { try { v.pause(); } catch { /* noop */ } }
  nodo.remove();
  document.body.classList.remove('cnt-abierta');
  if (!info.desdeAtras && soltar) soltar();
}

function pedirCambios(p) {
  openSheet({
    title: T('¿Qué te gustaría cambiar?', 'What would you like to change?'),
    mode: 'form',
    build(body, close) {
      const txt = el('textarea', { class: 'input cnt-caja', rows: 5, placeholder: T('Cuéntale a tu equipo qué cambiar…', 'Tell your team what to change…'), 'aria-label': T('Cambios', 'Changes') });
      const enviar = el('button', {
        class: 'btn btn-primary', type: 'button', text: T('Enviar cambios', 'Send changes'),
        onclick: async () => {
          const comment = txt.value.trim();
          if (!comment) { txt.focus(); return; }
          enviar.disabled = true;
          try {
            const r = await api.post(`/posts/${encodeURIComponent(p.id)}/request-changes`, { comment });
            if (r && r.post) ctx.store.upsertPost?.(r.post);
            close({ source: 'done' });
            toast(T('Listo, tu equipo ya tiene tus cambios.', 'Done, your team has your changes.'), 'success');
            cerrar(); render();
          } catch (err) { enviar.disabled = false; toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
        },
      });
      body.append(txt, el('div', { class: 'sheet__footer' }, [
        el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
        enviar,
      ]));
      setTimeout(() => txt.focus(), 60);
    },
  });
}

// ── Subir mi guion ───────────────────────────────────────────────────────────
// Crea la pieza en SU marca (el servidor fuerza la marca del cliente y nace
// como idea, pendiente de su equipo). El guion completo va en `body`.
function abrirSubirGuion() {
  const tipos = [['reel', T('Reel', 'Reel')], ['carrusel', T('Carrusel', 'Carousel')], ['post', T('Post', 'Post')], ['historia', T('Historia', 'Story')]];
  let tipo = 'reel';
  openSheet({
    title: T('Subir mi guion', 'Send my script'),
    mode: 'form',
    build(body, close) {
      const chips = el('div', { class: 'cnt-tipos', role: 'radiogroup', 'aria-label': T('¿Qué es?', 'What is it?') });
      const pintar = () => {
        clear(chips);
        for (const [k, txt] of tipos) {
          chips.appendChild(el('button', {
            class: 'cnt-tipo' + (tipo === k ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': tipo === k ? 'true' : 'false',
            text: txt, onclick: () => { tipo = k; pintar(); },
          }));
        }
      };
      pintar();
      const titulo = el('input', { class: 'input', id: 'cnt-g-titulo', type: 'text', maxlength: 120, placeholder: T('Ej. Testimonio de María', 'E.g. María’s testimonial') });
      const fecha = el('input', { class: 'input', id: 'cnt-g-fecha', type: 'date' });
      const guion = el('textarea', { class: 'input cnt-caja cnt-caja--grande', id: 'cnt-g-guion', rows: 8, placeholder: T('Escribe o pega aquí tu guion…', 'Write or paste your script here…') });
      const link = el('input', { class: 'input', id: 'cnt-g-link', type: 'url', inputmode: 'url', placeholder: T('Link de referencia (opcional)', 'Reference link (optional)') });
      const campo = (lbl, nodo, idFor) => el('label', { class: 'cnt-campo', for: idFor }, [el('span', { text: lbl }), nodo]);
      const enviar = el('button', {
        class: 'btn btn-primary', type: 'button', text: T('Enviar a mi equipo', 'Send to my team'),
        onclick: async () => {
          const texto = guion.value.trim();
          if (!texto) { toast(T('Escribe o pega tu guion.', 'Write or paste your script.'), 'error'); guion.focus(); return; }
          const ref = link.value.trim();
          if (ref && !esUrl(ref)) { toast(T('El link debe empezar con https://', 'The link must start with https://'), 'error'); link.focus(); return; }
          enviar.disabled = true;
          const me = estado().me || {};
          const data = {
            client_id: estado().activeClientId,
            content_type: tipo,
            title: titulo.value.trim() || `${T('Guion de', 'Script by')} ${me.name || T('cliente', 'client')}`,
            body: texto,
          };
          if (fecha.value) data.publish_date = fecha.value;
          if (ref) data.inspo_url = ref;
          try {
            const creado = await api.post('/posts', data);
            if (creado && creado.id) ctx.store.upsertPost?.(creado);
            close({ source: 'done' });
            toast(T('¡Recibido! Tu equipo ya tiene tu guion.', 'Received! Your team has your script.'), 'success', 5000);
            if (fecha.value) { mes = fecha.value.slice(0, 7); filtro = 'todo'; }
            render();
          } catch (err) { enviar.disabled = false; toast((err && err.message) || T('No se pudo enviar', 'Could not send'), 'error'); }
        },
      });
      body.append(
        el('div', { class: 'cnt-campo' }, [el('span', { text: T('¿Qué es?', 'What is it?') }), chips]),
        campo(T('Título (opcional)', 'Title (optional)'), titulo, 'cnt-g-titulo'),
        campo(T('¿Para qué fecha? (opcional)', 'For which date? (optional)'), fecha, 'cnt-g-fecha'),
        campo(T('Tu guion', 'Your script'), guion, 'cnt-g-guion'),
        campo(T('Referencia', 'Reference'), link, 'cnt-g-link'),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          enviar,
        ]),
      );
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
  link.href = '/marketing/css/contenido.css?v=202610270229';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'cnt' });
    host.appendChild(rootEl);
    marcaId = estado().activeClientId || null;
    unsubs.push(ctx.store.subscribe(['posts', 'clients', 'activeClientId'], () => {
      const ahora = estado().activeClientId || null;
      if (ahora !== marcaId) { marcaId = ahora; mes = null; filtro = 'todo'; cerrar(); }
      render();
      abrirPendiente();
    }));
    render();
    porAbrir = (c.params && c.params.pieza) || null;
    abrirPendiente();
  },
  onParams(params) {
    if (params && params.pieza && (!abierta || abierta.id !== params.pieza)) {
      porAbrir = params.pieza;
      abrirPendiente();
    }
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    cerrar();
    rootEl = null; ctx = null; mes = null; filtro = 'todo'; porAbrir = null;
  },
};
