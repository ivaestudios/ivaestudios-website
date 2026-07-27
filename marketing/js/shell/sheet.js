// ============================================================================
// IVAE Marketing v2 — Sheet UNICO (bottom sheet movil / popover-modal desktop).
//
// API CONGELADA (la consumen todos los paquetes):
//   openSheet({title, build(bodyEl, close), mode:'menu'|'form'|'picker',
//              onClose, confirmClose, anchor}) -> {close, el}
//     confirmClose(info) -> false CANCELA el cierre (guardia "no tires lo que
//     escribiste"); close({force:true}) lo salta.
//   confirmDiscard({title,...}) -> Promise<boolean>  (pregunta reusable)
//   pickFrom({title, options:[{value,label,color,icon,current,sub}], anchor})
//     -> Promise<value | null>   (null = cancelado)
//   closeAll()
//
// Reglas (NN/g + diseno):
//   - MOVIL: panel fixed bottom, asa 40x4 arrastrable (cierra a >30% o con
//     velocidad alta), max-height 85dvh, animacion translateY 250ms,
//     overscroll-behavior contain, scroll lock del body.
//   - mode menu/picker: cierra con tap en backdrop y boton atras.
//     mode form: NO cierra por backdrop (solo X o Cancelar): no se pierden datos.
//   - DESKTOP >=768px: menu/picker = popover anclado (flip/clamp, patron
//     openPopover del legacy); form = modal centrado.
//   - Solo 1 sheet + 1 picker apilado; abrir un tercero reemplaza al segundo.
//   - Cada sheet apila una capa de history (router.pushLayer): el boton atras
//     del telefono cierra la capa superior en vez de navegar.
//   - Focus trap + devolucion de foco al disparador + Esc cierra la superior.
// ============================================================================

import { el, clear } from '../api.js?v=202607271831';
import { pushLayer } from './router.js?v=202607271831';
import { T } from './i18n.js?v=202607271831';

const stack = []; // instancias abiertas (max 2)

// Gestos del usuario que DESCARTAN el sheet (los unicos que puede interceptar
// un guardia confirmClose). Todo lo demas es cierre programatico o guardado.
const DISMISS_SOURCES = new Set(['back', 'esc', 'backdrop', 'drag', 'x', 'cancel']);

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

function getHost() {
  let host = document.getElementById('sheetHost');
  if (!host) {
    host = el('div', { id: 'sheetHost' });
    document.body.appendChild(host);
  }
  return host;
}

function lockBody(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

function focusables(root) {
  return [...root.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )].filter((n) => !n.disabled && n.offsetParent !== null);
}

export function openSheet({ title = '', build, mode = 'menu', onClose, confirmClose = null, anchor = null } = {}) {
  // Maximo 2 capas: un tercero reemplaza al segundo.
  while (stack.length >= 2) stack[stack.length - 1].close({ replaced: true });

  const host = getHost();
  const trigger = document.activeElement;
  const desktop = isDesktop();
  const asPopover = desktop && mode !== 'form' && anchor && anchor.getBoundingClientRect;
  const asModal = desktop && !asPopover;

  let closed = false;
  let releaseLayer = null;
  let vvOff = null; // listeners de visualViewport (teclado movil)

  const backdrop = el('div', { class: 'sheet-backdrop' });
  const panel = el('div', {
    class: 'sheet' +
      (asPopover ? ' sheet--popover' : '') +
      (asModal ? ' sheet--modal' : '') +
      ` sheet--${mode}`,
    role: 'dialog', 'aria-modal': 'true',
  });

  // Header: asa (movil) + titulo + boton cerrar.
  const handle = el('div', { class: 'sheet__handle' }, [el('span', { class: 'sheet__grip' })]);
  const titleEl = title ? el('h2', { class: 'sheet__title', id: `sheetTitle${Date.now()}`, text: title }) : null;
  if (titleEl) panel.setAttribute('aria-labelledby', titleEl.id);
  const closeBtn = el('button', {
    class: 'sheet__close', type: 'button', 'aria-label': T('Cerrar', 'Close'),
    onclick: () => instance.close({ source: 'x' }),
  });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const head = el('div', { class: 'sheet__head' }, [
    titleEl || el('span', { class: 'sheet__title sheet__title--empty' }),
    closeBtn,
  ]);
  const body = el('div', { class: 'sheet__body' });
  if (!asPopover) panel.appendChild(handle);
  panel.append(head, body);

  function doClose(info = {}) {
    if (closed) return;

    // Guardia opcional ANTES de descartar lo escrito. Devolver false CANCELA
    // el cierre. Si el guardia quiere preguntar, abre su propio sheet de forma
    // diferida (ver confirmDiscard) para que la capa de history quede en orden.
    //
    // SOLO aplica a gestos del usuario que descartan (lista explicita). Los
    // cierres programaticos — closeAllLayers al cambiar de ruta, closeAll de
    // posts:changed, el reemplazo de la 3a capa, close({force:true}) y el
    // guardado — NUNCA se pueden bloquear: dejarian el sheet huerfano encima
    // de otra vista y sin capa de history.
    if (confirmClose && DISMISS_SOURCES.has(info.source)) {
      let allow = true;
      try { allow = confirmClose(info) !== false; } catch (e) { console.error('[sheet] confirmClose', e); allow = true; }
      if (!allow) {
        // El boton atras YA consumio la capa de history: se vuelve a apilar
        // para que el siguiente atras siga cerrando ESTE sheet (y no salga de
        // la app ni caiga en la vista de atras).
        if (info.fromHistory) {
          releaseLayer = pushLayer((i) => doClose({ ...i, source: 'back' }));
        }
        return;
      }
    }

    closed = true;
    const idx = stack.indexOf(instance);
    if (idx !== -1) stack.splice(idx, 1);
    if (!info.fromHistory && releaseLayer) releaseLayer();

    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); panel.remove(); }, 260);
    if (!stack.length) lockBody(false);

    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', position);
    if (vvOff) { vvOff(); vvOff = null; }

    try { onClose?.(info); } catch (e) { console.error('[sheet] onClose', e); }
    if (trigger && trigger.focus && document.contains(trigger) && !info.replaced) {
      try { trigger.focus({ preventScroll: true }); } catch { /* noop */ }
    }
  }

  const instance = { close: doClose, el: panel, mode };

  // Backdrop: solo menus y pickers cierran al tocar fuera.
  backdrop.addEventListener('click', () => {
    if (mode !== 'form') doClose({ source: 'backdrop' });
  });

  function onKey(e) {
    if (e.key === 'Escape') {
      // Solo la capa superior responde a Esc.
      if (stack[stack.length - 1] === instance) { e.stopPropagation(); doClose({ source: 'esc' }); }
      return;
    }
    if (e.key === 'Tab' && stack[stack.length - 1] === instance) {
      const items = focusables(panel);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  // ── Drag del asa (cerrar arrastrando, solo layout bottom-sheet) ────────────
  if (!asPopover && !asModal) {
    let startY = 0, lastY = 0, lastT = 0, dragging = false, vel = 0;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = lastY = e.clientY;
      lastT = performance.now();
      vel = 0;
      panel.style.transition = 'none';
      try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = Math.max(0, e.clientY - startY);
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY; lastT = now;
      panel.style.transform = `translateY(${dy}px)`;
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = '';
      const dy = Math.max(0, (e.clientY ?? lastY) - startY);
      const h = panel.getBoundingClientRect().height || 1;
      // El transform del arrastre se limpia SIEMPRE, pase lo que pase con el
      // cierre. Si se dejaba puesto y el guardia confirmClose vetaba el cierre
      // ("¿Descartar lo escrito?" → "Seguir escribiendo"), la hoja se quedaba
      // clavada abajo con el translateY del dedo: se veian 80px de titulo, el
      // texto y el boton de enviar quedaban fuera de pantalla y el fondo seguia
      // bloqueado, sin forma de subirla. De paso deja que la animacion de
      // salida corra limpia cuando el cierre si procede.
      panel.style.transform = '';
      if (dy > h * 0.3 || vel > 0.7) doClose({ source: 'drag' });
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  // ── Teclado movil (layout bottom-sheet) ────────────────────────────────────
  // En iOS el teclado NO cambia dvh: el panel fixed bottom:0 y su footer
  // pegajoso quedan tapados. Mismo patron visualViewport que toast.js: se sube
  // el panel justo encima del teclado y se recorta su max-height al alto
  // visible. Se limpia en doClose.
  if (!asPopover && !asModal && window.visualViewport) {
    const vv = window.visualViewport;
    const updateVV = () => {
      if (closed) return;
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (hidden > 40) {
        panel.style.bottom = `${hidden}px`;
        panel.style.maxHeight = `${Math.max(180, vv.height - 8)}px`;
      } else {
        panel.style.bottom = '';
        panel.style.maxHeight = '';
      }
    };
    vv.addEventListener('resize', updateVV);
    vv.addEventListener('scroll', updateVV);
    vvOff = () => {
      vv.removeEventListener('resize', updateVV);
      vv.removeEventListener('scroll', updateVV);
    };
    updateVV();
  }

  // ── Posicionamiento popover desktop (flip/clamp, patron legacy) ────────────
  function position() {
    if (!asPopover || closed) return;
    const r = anchor.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.left;
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
    if (left + pr.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pr.width - 8);
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  // Montaje
  host.append(backdrop, panel);
  stack.push(instance);
  lockBody(true);

  try { build?.(body, doClose); } catch (e) { console.error('[sheet] build', e); }

  releaseLayer = pushLayer((info) => doClose({ ...info, source: 'back' }));
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', position);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
    position();
    // mode form en MOVIL: no auto-enfocar el primer input (dispararia el
    // teclado de inmediato); el foco entra al dialogo via el boton cerrar y
    // cada form decide si enfoca un campo.
    const autoFocusFirst = !(mode === 'form' && !desktop);
    const items = autoFocusFirst ? focusables(body) : [];
    if (items.length) { try { items[0].focus({ preventScroll: true }); } catch { /* noop */ } }
    else closeBtn.focus({ preventScroll: true });
  });

  return instance;
}

/**
 * Picker de opciones basado en Promise. Resuelve con el `value` elegido o
 * null si se cancela (backdrop, atras, Esc o X).
 * options: [{value, label, color?, icon?(Node), current?, sub?}]
 */
export function pickFrom({ title = '', options = [], anchor = null } = {}) {
  return new Promise((resolve) => {
    let picked = null, done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    openSheet({
      title,
      mode: 'picker',
      anchor,
      onClose: () => settle(picked),
      build(body, close) {
        const list = el('div', { class: 'pick-list', role: 'listbox' });
        for (const o of options) {
          const row = el('button', {
            class: 'pick-row' + (o.current ? ' is-current' : ''),
            type: 'button', role: 'option',
            'aria-selected': o.current ? 'true' : 'false',
            onclick: () => { picked = o.value; close({ source: 'pick' }); },
          }, [
            o.icon || (o.color
              ? el('span', { class: 'pick-row__dot', style: { background: o.color } })
              : null),
            el('span', { class: 'pick-row__main' }, [
              el('span', { class: 'pick-row__label', text: o.label }),
              o.sub ? el('span', { class: 'pick-row__sub', text: o.sub }) : null,
            ]),
            o.current ? el('span', { class: 'pick-row__check', text: '✓' }) : null,
          ]);
          list.appendChild(row);
        }
        body.appendChild(list);
      },
    });
  });
}

/**
 * Pregunta antes de TIRAR texto escrito (boton atras del telefono, Esc,
 * backdrop, X, Cancelar). Resuelve true solo si el usuario decide descartar;
 * cualquier otra salida (atras, backdrop, Esc) = seguir escribiendo, que es
 * la respuesta segura.
 *
 * Reusa pickFrom: mismo sheet, mismo tema claro/oscuro, cero componentes
 * nuevos. Se abre DIFERIDO un tick a proposito: cuando el que pregunta es el
 * guardia confirmClose de otro sheet, primero tiene que reapilarse la capa de
 * history de ese sheet y despues la de esta pregunta — si no, el boton atras
 * cerraria el formulario y dejaria la pregunta huerfana.
 */
export function confirmDiscard({
  title = T('¿Descartar lo que escribiste?', 'Discard what you wrote?'),
  keepLabel = T('Seguir escribiendo', 'Keep writing'),
  discardLabel = T('Descartar', 'Discard'),
} = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      pickFrom({
        title,
        options: [
          {
            value: 'keep',
            label: keepLabel,
            color: '#22c55e',
            sub: T('Vuelves a tu texto tal como estaba.', 'Back to your text just as it was.'),
          },
          {
            value: 'discard',
            label: discardLabel,
            color: '#f87171',
            sub: T('Se pierde lo que escribiste.', 'What you wrote will be lost.'),
          },
        ],
      }).then((v) => resolve(v === 'discard'));
    }, 0);
  });
}

/** Cierra todas las capas (regla anti popovers huerfanos en posts:changed). */
export function closeAll() {
  while (stack.length) stack[stack.length - 1].close({ source: 'closeAll' });
}

/** Cuantas capas hay abiertas (para tests / debug). */
export function openCount() { return stack.length; }

export { clear };
