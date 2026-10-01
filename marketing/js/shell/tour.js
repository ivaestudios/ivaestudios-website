// ============================================================================
// IVAE Marketing — VISITA GUIADA INTERACTIVA (primer ingreso).
//
// Vianey (1-oct-2026): "hazme la visita guiada cuando alguien ingrese a la
// app" y "que el flujo sea muy interactivo". Cinco personas de fuera se
// registraron, entraron una vez a un calendario vacío sin que nadie les
// enseñara nada, y no volvieron.
//
// Cómo funciona: una máscara oscura con un HUECO sobre el elemento real; el
// hueco deja pasar el toque. En los pasos de ACCIÓN la visita no avanza con
// "Siguiente": avanza cuando la persona toca el elemento (abrir su marca,
// abrir el asistente de IA, abrir una pieza). Cuando esa acción abre una hoja
// o el editor, la máscara se quita (paso "libre") para que la persona la use,
// y la visita sigue sola cuando la cierra. Si un elemento no existe (mes
// vacío, sin piezas) la tarjeta sale centrada y la visita continúa.
// Se enseña UNA vez por usuario (prefs 'tourDone'); se repite desde
// Tu cuenta → Visita guiada. router/store/prefs/closeAll llegan por
// parámetro: shell.js importa este módulo y no puede haber ciclo.
// ============================================================================
import { el, esCreador } from '../api.js?v=202610010035';
import { T } from './i18n.js?v=202610010035';

export const TOUR_VERSION = 2;
let activo = null;

const esMovil = () => window.matchMedia('(max-width: 767px)').matches;
// "Capa" = hoja (#sheetHost) o el diálogo de Generar mes (IA): en los pasos
// libres la visita espera a que la persona la cierre.
const hayCapa = () => !!document.querySelector('#sheetHost .sheet, .mesia-overlay');
const anclaContenido = () => (esMovil() ? '.bn-tab[data-tab="contenido"]' : '[data-grupo="g-contenido"]');
// Escritorio: tabla con lápiz por fila. Móvil: tarjetas; se toca la tarjeta.
const SEL_ABRIR_PIEZA = '.meses-task__open, .meses-item__main';
const pistaAbrir = () => (esMovil() ? T('Toca la pieza', 'Tap the piece') : T('Toca el lápiz', 'Tap the pencil'));

// Un paso: { view?, sel?, selTexto?, accion?, libre?, sigueCuando?, titulo, texto, pista? }
//  accion: true   → avanza cuando la persona TOCA el elemento del foco.
//  libre: true    → sin máscara (la persona usa la hoja/editor que abrió).
//  sigueCuando()  → condición que, al cumplirse, avanza sola (p.ej. cerró la hoja).
function pasosEquipo() {
  const creador = esCreador();
  return [
    {
      titulo: T('Bienvenida a IVAE Marketing', 'Welcome to IVAE Marketing'),
      texto: T('Te enseño la app haciendo, no leyendo: en cada paso tocas el elemento real. Dos minutos. Puedes saltarlo y repetirlo cuando quieras desde Tu cuenta → Visita guiada.', 'You will learn the app by doing, not reading: in each step you tap the real element. Two minutes. You can skip it and replay it anytime from Your account → Guided tour.'),
    },
    {
      sel: '.tb-client', accion: true,
      titulo: T('Tu marca', 'Your brand'),
      texto: creador
        ? T('Todo lo que ves pertenece a la marca elegida aquí. Puedes llevar varias marcas o proyectos, cada uno con su calendario. Tócala para verlas.', 'Everything you see belongs to the brand chosen here. You can run several brands or projects, each with its own calendar. Tap it to see them.')
        : T('Todo lo que ves pertenece a la marca elegida aquí. Tócala para ver tus marcas.', 'Everything you see belongs to the brand chosen here. Tap it to see your brands.'),
      pista: T('Toca aquí', 'Tap here'),
    },
    {
      libre: true, empiezaCuando: () => hayCapa(), sigueCuando: () => !hayCapa(),
      titulo: T('Tus marcas', 'Your brands'),
      texto: creador
        ? T('Esta es tu lista. Cada marca tiene su calendario, sus redes y su voz. Con "Nueva marca" agregas otra. Cierra la hoja para seguir.', 'This is your list. Each brand has its own calendar, networks and voice. "New brand" adds another. Close the sheet to continue.')
        : T('Esta es tu lista. Cada cliente es una marca, con su calendario, sus redes y su propio acceso. Con "Nuevo cliente" agregas otra. Cierra la hoja para seguir.', 'This is your list. Each client is a brand, with its own calendar, networks and access. "New client" adds another. Close the sheet to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'meses', sel: anclaContenido(),
      titulo: T('Contenido: el calendario', 'Content: the calendar'),
      texto: T('Aquí vive el mes de la marca: cada fila es una pieza (reel, carrusel o post). También están la Cuadrícula, el Feed, los Entregables y la Marca.', 'The brand\'s month lives here: each row is one piece (reel, carousel or post). Grid, Feed, Deliverables and Brand live here too.'),
    },
    {
      view: 'meses', sel: '.meses-iabtn', accion: true,
      titulo: T('¿Mes vacío? La IA lo arma', 'Empty month? AI builds it'),
      texto: T('Generar mes (IA) escribe de 8 a 12 piezas con guion, caption y hashtags, en la voz de la marca. Tócalo para ver el asistente; puedes cancelar.', 'Generate month (AI) writes 8 to 12 pieces with script, caption and hashtags, in the brand\'s voice. Tap it to see the assistant; you can cancel.'),
      pista: T('Toca aquí', 'Tap here'),
    },
    {
      libre: true, empiezaCuando: () => hayCapa(), sigueCuando: () => !hayCapa(),
      titulo: T('El asistente del mes', 'The month assistant'),
      texto: T('Le dices de qué va el mes y la IA escribe todas las piezas; tú corriges lo que quieras después. Hoy solo míralo: Cancelar para seguir, o genéralo de una vez si ya tienes la marca lista.', 'Tell it what the month is about and the AI writes every piece; you fix whatever you want afterwards. For now just look: Cancel to continue, or generate it right away if the brand is ready.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'meses', sel: SEL_ABRIR_PIEZA, accion: true,
      titulo: T('Abre una pieza', 'Open a piece'),
      texto: esMovil() ? T('Toca una pieza para verla completa.', 'Tap a piece to see it in full.') : T('El lápiz abre la pieza completa. Tócalo.', 'The pencil opens the full piece. Tap it.'),
      pista: pistaAbrir(),
      sinElemento: T('Cuando el mes tenga piezas, cada fila trae un lápiz que la abre completa: guion, caption, fecha, hora y redes.', 'Once the month has pieces, each row has a pencil that opens it in full: script, caption, date, time and networks.'),
    },
    {
      libre: true, empiezaCuando: (store) => store.getState().view === 'post', sigueCuando: (store) => store.getState().view !== 'post',
      titulo: T('La pieza por dentro', 'Inside the piece'),
      texto: T('Guion, caption, fecha y hora, y las redes donde sale. Sin hora NO se publica: ponle hora y pásala a Programado, y el reloj la publica solo en Instagram, Facebook, TikTok y YouTube. Cierra la pieza para seguir.', 'Script, caption, date and time, and the networks it goes out to. With no time it does NOT publish: set a time and mark it Scheduled, and the clock posts it by itself to Instagram, Facebook, TikTok and YouTube. Close the piece to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'conexiones', sel: '.cx-card',
      titulo: T('Conexiones', 'Connections'),
      texto: creador
        ? T('Conecta tus redes una sola vez: Instagram, Facebook, TikTok y YouTube. Verde quiere decir que publica en automático. Cuando tengas tu Instagram a la mano, vuelve aquí y toca Conectar.', 'Connect your networks once: Instagram, Facebook, TikTok and YouTube. Green means it posts automatically. When you have your Instagram at hand, come back here and tap Connect.')
        : T('Conecta las redes de cada marca una sola vez. Verde quiere decir que publica en automático. Cuando tengas el Instagram de la marca a la mano, vuelve aquí y toca Conectar.', 'Connect each brand\'s networks once. Green means it posts automatically. When you have the brand\'s Instagram at hand, come back here and tap Connect.'),
    },
    {
      view: 'entregables', sel: '.dlv-drop',
      titulo: T('Entregables', 'Deliverables'),
      texto: creador
        ? T('Aquí guardas tus reels y carruseles terminados, por mes. Desde el teléfono los descargas con un toque, y con "Al calendario" la IA los convierte en una pieza con guion y caption.', 'Keep your finished reels and carousels here, by month. From your phone you download them with one tap, and "To calendar" lets the AI turn them into a piece with script and caption.')
        : T('Aquí sueltas los reels y carruseles finales. Tu cliente los ve desde su propio acceso, comenta, pide cambios y los descarga listos para publicar.', 'Drop the final reels and carousels here. Your client sees them from their own access, comments, requests changes and downloads them ready to post.'),
    },
    {
      view: 'meses',
      titulo: T('Listo', 'All set'),
      texto: creador
        ? T('Siguiente paso real: conecta tu Instagram y genera tu primer mes. Si te pierdes, esta visita vive en Tu cuenta → Visita guiada, y Ayuda abre nuestro WhatsApp.', 'Next real step: connect your Instagram and generate your first month. If you get lost, this tour lives in Your account → Guided tour, and Help opens our WhatsApp.')
        : T('Siguiente paso real: conecta el Instagram de tu marca y genera tu primer mes. Si te pierdes, esta visita vive en Tu cuenta → Visita guiada, y Ayuda abre nuestro WhatsApp.', 'Next real step: connect your brand\'s Instagram and generate your first month. If you get lost, this tour lives in Your account → Guided tour, and Help opens our WhatsApp.'),
    },
  ];
}

function pasosCliente() {
  return [
    {
      titulo: T('Bienvenido a tu calendario', 'Welcome to your calendar'),
      texto: T('Aquí ves el contenido que tu agencia prepara para tu marca, lo apruebas o pides cambios, y descargas tus videos finales. Un minuto.', 'Here you see the content your agency prepares for your brand, you approve it or request changes, and you download your final videos. One minute.'),
    },
    {
      view: 'meses', sel: SEL_ABRIR_PIEZA, accion: true,
      titulo: T('Abre una pieza', 'Open a piece'),
      texto: esMovil() ? T('Cada tarjeta es una pieza del mes. Toca una para verla completa.', 'Each card is one piece of the month. Tap one to see it in full.') : T('Cada fila es una pieza del mes. Toca el lápiz para verla completa.', 'Each row is one piece of the month. Tap the pencil to see it in full.'),
      pista: pistaAbrir(),
      sinElemento: T('Cuando tu agencia suba piezas, cada fila trae un lápiz para verla completa y aprobarla.', 'Once your agency adds pieces, each row has a pencil to see it in full and approve it.'),
    },
    {
      libre: true, empiezaCuando: (store) => store.getState().view === 'post', sigueCuando: (store) => store.getState().view !== 'post',
      titulo: T('Aprobar o pedir cambios', 'Approve or request changes'),
      texto: T('Arriba tienes dos botones: Aprobado, o Modificar con tu comentario. Tu agencia recibe el aviso al instante. Cierra la pieza para seguir.', 'At the top you have two buttons: Approved, or Modify with your comment. Your agency is notified instantly. Close the piece to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'entregables',
      titulo: T('Tus entregables', 'Your deliverables'),
      texto: T('Los reels y carruseles finales viven en Entregables: velos, comenta y descárgalos a tu teléfono con un toque.', 'The final reels and carousels live in Deliverables: watch them, comment and download them to your phone with one tap.'),
    },
  ];
}

export function tourPendiente(me, prefs) {
  if (!me) return false;
  return Number(prefs.get('tourDone', 0)) < TOUR_VERSION;
}

function esperar(cond, ms) {
  return new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      let ok = false;
      try { ok = !!cond(); } catch { ok = false; }
      if (ok || Date.now() - t0 > ms) { clearInterval(iv); res(ok); }
    }, 100);
  });
}
function visible(node) {
  if (!node) return false;
  const r = node.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight;
}
function primerVisible(sel) {
  for (const n of document.querySelectorAll(sel)) if (visible(n)) return n;
  return null;
}
// Existe y tiene tamaño, pero quedó fuera de la pantalla (p.ej. un bloque que
// cargó después lo empujó hacia abajo).
function primerConTamano(sel) {
  for (const n of document.querySelectorAll(sel)) {
    const r = n.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return n;
  }
  return null;
}
async function esperarEl(sel, ms) {
  const ok = await esperar(() => !!primerVisible(sel), ms);
  return ok ? primerVisible(sel) : null;
}

export async function startTour({ router, store, prefs, closeAll, me, forzar = false }) {
  if (activo) return;
  if (!forzar && !tourPendiente(me, prefs)) return;
  const cliente = !!(me && me.role === 'client');
  const pasos = cliente ? pasosCliente() : pasosEquipo();
  const st = store.getState();
  const clienteId = st.activeClientId && st.activeClientId !== 'todos' ? st.activeClientId : null;
  const params = clienteId ? { cliente: clienteId } : {};

  // Máscara en 4 rectángulos alrededor del foco: el hueco deja pasar el toque.
  const masks = ['t', 'l', 'r', 'b'].map((k) => el('div', { class: `tour__mask tour__mask--${k}` }));
  const foco = el('div', { class: 'tour__foco', hidden: true });
  const pista = el('div', { class: 'tour__pista', hidden: true });
  const paso = el('div', { class: 'tour__paso' });
  const titulo = el('h3', { class: 'tour__t' });
  const texto = el('p', { class: 'tour__p' });
  const bPrev = el('button', { class: 'btn tour__prev', type: 'button', text: T('Atrás', 'Back') });
  const bNext = el('button', { class: 'btn btn-primary tour__next', type: 'button' });
  const bSkip = el('button', { class: 'tour__skip', type: 'button', text: T('Saltar la visita', 'Skip the tour') });
  const card = el('div', { class: 'tour__card', role: 'document' }, [
    paso, titulo, texto,
    el('div', { class: 'tour__acts' }, [bSkip, el('span', { class: 'tour__sp' }), bPrev, bNext]),
  ]);
  const root = el('div', { class: 'tour', role: 'dialog', 'aria-modal': 'false', 'aria-label': T('Visita guiada', 'Guided tour') }, [...masks, foco, pista, card]);
  document.body.appendChild(root);

  let i = 0; let target = null; let iv = null; let cerrado = false; let p = null; let listo = false; let pasoT0 = 0;
  activo = { root };

  function ponerMascara(r) {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!r) { // sin hueco: una sola capa completa
      Object.assign(masks[0].style, { left: '0px', top: '0px', width: `${vw}px`, height: `${vh}px` });
      for (const m of masks.slice(1)) Object.assign(m.style, { width: '0px', height: '0px' });
      return;
    }
    Object.assign(masks[0].style, { left: '0px', top: '0px', width: `${vw}px`, height: `${Math.max(0, r.top)}px` });
    Object.assign(masks[1].style, { left: '0px', top: `${r.top}px`, width: `${Math.max(0, r.left)}px`, height: `${r.height}px` });
    Object.assign(masks[2].style, { left: `${r.right}px`, top: `${r.top}px`, width: `${Math.max(0, vw - r.right)}px`, height: `${r.height}px` });
    Object.assign(masks[3].style, { left: '0px', top: `${r.bottom}px`, width: `${vw}px`, height: `${Math.max(0, vh - r.bottom)}px` });
  }

  function colocar() {
    if (cerrado || !p) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    root.classList.toggle('tour--libre', !!p.libre);
    if (p.libre) { // sin máscara: la persona usa lo que abrió; la tarjeta se hace a un lado
      for (const m of masks) m.hidden = true;
      foco.hidden = true; pista.hidden = true;
      card.classList.remove('tour__card--centro'); card.classList.add('tour__card--lado');
      // Móvil: hojas y diálogo suben desde abajo → la tarjeta va arriba, sobre el velo.
      // En el editor (pantalla completa, con su X arriba) va abajo.
      card.classList.toggle('tour__card--arriba', esMovil() && store.getState().view !== 'post');
      card.style.left = ''; card.style.top = ''; card.style.width = '';
      return;
    }
    for (const m of masks) m.hidden = false;
    card.classList.remove('tour__card--lado', 'tour__card--arriba');
    // Las vistas con datos (Conexiones, Entregables) se vuelven a pintar cuando
    // llegan sus datos y el nodo agarrado queda suelto: se vuelve a buscar.
    if (p.sel && (!target || !target.isConnected || !visible(target))) {
      const t = primerVisible(p.sel);
      if (t) target = t;
      else if (Date.now() - pasoT0 < 6000) {
        // Mientras la vista se acomoda (primeros segundos), volver a traerlo a la vista.
        const t2 = primerConTamano(p.sel);
        if (t2) { try { t2.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { /* noop */ } target = t2; }
      }
    }
    if (target && visible(target)) {
      const r0 = target.getBoundingClientRect();
      const pad = 6;
      const r = { left: r0.left - pad, top: r0.top - pad, width: r0.width + pad * 2, height: r0.height + pad * 2 };
      r.right = r.left + r.width; r.bottom = r.top + r.height;
      ponerMascara(r);
      foco.hidden = false;
      Object.assign(foco.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      if (p.accion && p.pista) {
        pista.hidden = false; pista.textContent = p.pista;
        const pw = pista.offsetWidth || 90;
        pista.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, vw - pw - 8))}px`;
        pista.style.top = `${r.bottom + 8 < vh - 40 ? r.bottom + 8 : r.top - 36}px`;
      } else pista.hidden = true;
      card.classList.remove('tour__card--centro');
      if (esMovil()) { card.style.left = ''; card.style.top = ''; card.style.width = ''; return; }
      const cw = Math.min(360, vw - 32), ch = card.offsetHeight || 180;
      const left = Math.max(16, Math.min(r.left, vw - cw - 16));
      let top = r.bottom + (pista.hidden ? 14 : 44);
      if (top + ch > vh - 16) top = Math.max(16, r.top - ch - 14);
      card.style.left = `${left}px`; card.style.top = `${top}px`; card.style.width = `${cw}px`;
    } else {
      ponerMascara(null);
      foco.hidden = true; pista.hidden = true;
      card.classList.add('tour__card--centro');
      card.style.left = ''; card.style.top = ''; card.style.width = '';
    }
  }

  // Toque sobre el elemento del foco = acción cumplida → siguiente paso.
  function alTocar(e) {
    if (cerrado || !p || !p.accion || !p.sel || !e.target || typeof e.target.closest !== 'function') return;
    const n = i;
    if (e.target.closest(p.sel)) setTimeout(() => { if (!cerrado && i === n) mostrar(n + 1); }, 250);
  }

  async function mostrar(n) {
    listo = false; root.classList.remove('tour--listo'); pasoT0 = Date.now();
    i = Math.max(0, Math.min(pasos.length - 1, n));
    p = pasos[i];
    target = null; colocar();
    paso.textContent = `${i + 1} ${T('de', 'of')} ${pasos.length}`;
    titulo.textContent = p.titulo; texto.textContent = p.texto;
    bPrev.hidden = i === 0;
    bNext.textContent = i === pasos.length - 1 ? T('Empezar', 'Start') : (p.siguiente || (p.accion ? T('Lo hago después', 'Later') : T('Siguiente', 'Next')));
    if (p.view && store.getState().view !== p.view) {
      if (typeof closeAll === 'function') { try { closeAll(); } catch { /* noop */ } }
      router.navigate(p.view, params);
      await esperar(() => store.getState().view === p.view, 3000);
      await new Promise((r) => setTimeout(r, 350));
    }
    if (cerrado) return;
    if (p.sel) {
      target = await esperarEl(p.sel, p.view ? 7000 : 3500);
      if (target) {
        try { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch { /* noop */ }
        await new Promise((r) => setTimeout(r, 380));
      } else if (p.sinElemento) {
        texto.textContent = p.sinElemento;
        bNext.textContent = T('Siguiente', 'Next');
      }
    }
    if (cerrado) return;
    // Paso libre: esperar a que lo abierto esté de verdad abierto antes de vigilar su cierre.
    if (p.libre && typeof p.empiezaCuando === 'function') await esperar(() => p.empiezaCuando(store), 3000);
    if (cerrado) return;
    colocar();
    if (!p.accion && !p.libre) bNext.focus();
    listo = true; root.classList.add('tour--listo');
  }

  function cerrar(terminada) {
    if (cerrado) return;
    cerrado = true; activo = null;
    clearInterval(iv);
    window.removeEventListener('resize', colocar);
    document.removeEventListener('keydown', teclas, true);
    document.removeEventListener('click', alTocar, true);
    root.remove();
    prefs.set('tourDone', TOUR_VERSION);
    if (terminada && store.getState().view !== 'meses') router.navigate('meses', params);
  }
  function teclas(e) {
    if (e.key !== 'Escape' || (p && p.libre)) return;
    e.preventDefault(); cerrar(false);
  }
  bNext.onclick = async () => {
    if (p && p.libre && typeof closeAll === 'function') { try { closeAll(); } catch { /* noop */ } }
    if (p && p.libre && store.getState().view === 'post') {
      const n = i; p = null; listo = false;
      const x = document.querySelector('.edhead .edicon[aria-label]');
      if (x) x.click(); else router.navigate('meses', params);
      await esperar(() => store.getState().view !== 'post', 3000);
      await new Promise((r) => setTimeout(r, 450));
      if (cerrado) return;
      i = n;
    }
    i === pasos.length - 1 ? cerrar(true) : mostrar(i + 1);
  };
  bPrev.onclick = () => mostrar(i - 1);
  bSkip.onclick = () => cerrar(false);
  document.addEventListener('keydown', teclas, true);
  document.addEventListener('click', alTocar, true);
  window.addEventListener('resize', colocar);
  iv = setInterval(() => {
    colocar();
    // Paso libre: cuando la persona cerró la hoja / la pieza, la visita sigue sola.
    if (listo && p && p.libre && typeof p.sigueCuando === 'function') {
      let ok = false; try { ok = !!p.sigueCuando(store); } catch { ok = false; }
      if (ok) { const n = i; p = null; mostrar(n + 1); }
    }
  }, 300);
  await mostrar(0);
}

export function tourActiva() { return !!activo; }
