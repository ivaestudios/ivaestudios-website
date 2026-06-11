// ============================================================================
// IVAE Marketing v2 — MOTOR UNICO de drag and drop por Pointer Events.
//
// Consolidacion (criterio B): calendario, kanban y timeline consumen ESTE
// motor; sus modulos solo aportan adaptadores de dominio (drop targets).
// JAMAS HTML5 drag-and-drop; siempre existe un fallback visible "Mover a".
//
// API CONGELADA:
//   draggable(element, options) -> dispose()
//
// options:
//   mode: 'move' | 'resize'          (resize no clona: reporta dx/dy)
//   data: any                        (payload de dominio, opaco para el motor)
//   handle: Element                  (default: element)
//   longPressMs: 350                 (touch: inicia tras long-press)
//   moveThreshold: 6                 (mouse: px antes de iniciar)
//   cancelThreshold: 10              (touch: px de scroll que cancelan el press)
//   ghost(element) -> Node           (default: clon visual del elemento)
//   scrollEl: Element                (auto-scroll en bordes; default #viewScroll)
//   dropSelector: string             (CSS de targets; hit = closest(dropSelector))
//   touchAction: string              (CSS touch-action del handle; default
//                                     'pan-x pan-y': el scroll nativo en AMBOS
//                                     ejes sigue vivo ANTES del drag. Critico
//                                     en movil: el kanban navega columnas con
//                                     swipe horizontal sobre las tarjetas. El
//                                     drag no se pierde: el long-press (350ms
//                                     sin mover) arranca antes que cualquier
//                                     pan, y durante el drag el touchmove con
//                                     preventDefault bloquea el scroll nativo.
//                                     Pasa 'none' si un handle dedicado, p.ej.
//                                     de resize, no debe scrollear jamas. Si NO
//                                     se pasa, el motor respeta el touch-action
//                                     que la vista haya puesto inline o en CSS
//                                     y solo aplica el default cuando es auto.)
//   onStart(ctx), onMove(ctx), onDrop(ctx), onCancel(ctx)
//
// ctx: { x, y, dx, dy, data, mode, over (Element|null segun dropSelector),
//        ghostEl, originEl }
//
// Garantias: setPointerCapture, clon fixed con translate3d, elementFromPoint
// con el ghost oculto, auto-scroll en bordes, navigator.vibrate al iniciar en
// touch, Esc / pointercancel limpian todo, listeners removidos siempre.
// ============================================================================

const EDGE = 56;          // px del borde que activan auto-scroll
const SCROLL_SPEED = 14;  // px por frame

export function draggable(element, options = {}) {
  const {
    mode = 'move',
    data = null,
    handle = element,
    longPressMs = 350,
    moveThreshold = 6,
    cancelThreshold = 10,
    ghost = defaultGhost,
    dropSelector = null,
    touchAction = 'pan-x pan-y',
    onStart, onMove, onDrop, onCancel,
  } = options;

  let pointerId = null;
  let startX = 0, startY = 0, curX = 0, curY = 0;
  let pressTimer = 0;
  let dragging = false;
  let ghostEl = null;
  let scrollRaf = 0;
  let scrollEl = null;

  const ctx = () => ({
    x: curX, y: curY,
    dx: curX - startX, dy: curY - startY,
    data, mode,
    over: hitTest(curX, curY),
    ghostEl,
    originEl: element,
  });

  function hitTest(x, y) {
    if (!dropSelector) return null;
    let prevVis = null;
    if (ghostEl) { prevVis = ghostEl.style.visibility; ghostEl.style.visibility = 'hidden'; }
    const under = document.elementFromPoint(x, y);
    if (ghostEl) ghostEl.style.visibility = prevVis || '';
    return under ? under.closest(dropSelector) : null;
  }

  function defaultGhost(src) {
    const r = src.getBoundingClientRect();
    const clone = src.cloneNode(true);
    clone.style.cssText = '';
    clone.classList.add('dnd-ghost');
    clone.style.position = 'fixed';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = `${r.width}px`;
    clone.style.height = `${r.height}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '190';
    clone.style.opacity = '0.92';
    clone.style.willChange = 'transform';
    return clone;
  }

  function placeGhost() {
    if (!ghostEl) return;
    const r = element.getBoundingClientRect();
    const ox = startX - r.left, oy = startY - r.top;
    ghostEl.style.transform = `translate3d(${curX - ox}px, ${curY - oy}px, 0) scale(1.02)`;
  }

  function preventTouch(e) { if (dragging) e.preventDefault(); }

  function startDrag(e) {
    dragging = true;
    scrollEl = options.scrollEl || document.getElementById('viewScroll') || document.scrollingElement;
    if (mode === 'move') {
      ghostEl = ghost(element);
      if (ghostEl) document.body.appendChild(ghostEl);
      element.classList.add('dnd-origin');
      placeGhost();
    }
    document.body.classList.add('dnd-active');
    if (e.pointerType === 'touch' && navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
    window.addEventListener('touchmove', preventTouch, { passive: false });
    try { onStart?.(ctx()); } catch (err) { console.error('[dnd] onStart', err); }
    autoScrollLoop();
  }

  function autoScrollLoop() {
    cancelAnimationFrame(scrollRaf);
    const step = () => {
      if (!dragging) return;
      if (scrollEl) {
        const r = scrollEl === document.scrollingElement
          ? { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }
          : scrollEl.getBoundingClientRect();
        if (curY < r.top + EDGE) scrollEl.scrollTop -= SCROLL_SPEED;
        else if (curY > r.bottom - EDGE) scrollEl.scrollTop += SCROLL_SPEED;
        if (curX < r.left + EDGE) scrollEl.scrollLeft -= SCROLL_SPEED;
        else if (curX > r.right - EDGE) scrollEl.scrollLeft += SCROLL_SPEED;
      }
      scrollRaf = requestAnimationFrame(step);
    };
    scrollRaf = requestAnimationFrame(step);
  }

  function cleanup() {
    clearTimeout(pressTimer);
    cancelAnimationFrame(scrollRaf);
    window.removeEventListener('touchmove', preventTouch);
    document.removeEventListener('keydown', onKey, true);
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    element.classList.remove('dnd-origin');
    document.body.classList.remove('dnd-active');
    if (pointerId != null) {
      try { handle.releasePointerCapture(onlyId(pointerId)); } catch { /* noop */ }
    }
    pointerId = null;
    dragging = false;
  }

  const onlyId = (id) => id;

  function cancel() {
    const wasDragging = dragging;
    const c = ctx();
    cleanup();
    if (wasDragging) {
      try { onCancel?.(c); } catch (err) { console.error('[dnd] onCancel', err); }
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
  }

  function onPointerDown(e) {
    if (pointerId != null) return;
    if (e.button != null && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = curX = e.clientX;
    startY = curY = e.clientY;
    dragging = false;

    try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
    document.addEventListener('keydown', onKey, true);

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      // Long-press: si el usuario scrollea antes (pointercancel o > umbral) se cancela.
      pressTimer = setTimeout(() => { if (pointerId != null && !dragging) startDrag(e); }, longPressMs);
    }
    // Mouse: arranca al superar moveThreshold (en pointermove).
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return;
    curX = e.clientX;
    curY = e.clientY;
    const dist = Math.hypot(curX - startX, curY - startY);

    if (!dragging) {
      if (e.pointerType === 'mouse') {
        if (dist >= moveThreshold) startDrag(e);
      } else if (dist >= cancelThreshold) {
        // El dedo se movio antes del long-press: es un scroll, no un drag.
        clearTimeout(pressTimer);
        releaseAll();
      }
      if (!dragging) return;
    }
    if (mode === 'move') placeGhost();
    try { onMove?.(ctx()); } catch (err) { console.error('[dnd] onMove', err); }
  }

  function releaseAll() {
    document.removeEventListener('keydown', onKey, true);
    if (pointerId != null) {
      try { handle.releasePointerCapture(pointerId); } catch { /* noop */ }
    }
    pointerId = null;
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    curX = e.clientX;
    curY = e.clientY;
    if (!dragging) { clearTimeout(pressTimer); releaseAll(); return; }
    const c = ctx();
    cleanup();
    try { onDrop?.(c); } catch (err) { console.error('[dnd] onDrop', err); }
  }

  function onPointerCancel(e) {
    if (e.pointerId !== pointerId) return;
    if (!dragging) { clearTimeout(pressTimer); releaseAll(); return; }
    cancel();
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerCancel);
  // NUNCA 'pan-y' por default: bloquearia el paneo horizontal nativo que
  // arranca sobre el elemento (a 390px las tarjetas del kanban cubren casi
  // toda la columna y el swipe entre columnas es la unica navegacion).
  // Prioridad: options.touchAction explicito > inline ya puesto por la vista
  // (kanban/card.js) > touch-action de CSS (table.css/calendar.css/timeline.css)
  // > default del motor.
  if (options.touchAction != null) {
    handle.style.touchAction = options.touchAction;
  } else if (!handle.style.touchAction) {
    let computed = 'auto';
    try { computed = getComputedStyle(handle).touchAction || 'auto'; } catch { /* noop */ }
    if (computed === 'auto') handle.style.touchAction = touchAction;
  }

  return function dispose() {
    cancel();
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerUp);
    handle.removeEventListener('pointercancel', onPointerCancel);
  };
}

/**
 * Azucar para listas: hace draggables todos los hijos que matcheen
 * `itemSelector` (delegacion via un solo draggable por item al montarse).
 * Devuelve dispose() global.
 */
export function draggableList(container, itemSelector, makeOptions) {
  const disposers = new Map();
  const attach = (item) => {
    if (disposers.has(item)) return;
    disposers.set(item, draggable(item, makeOptions(item)));
  };
  for (const item of container.querySelectorAll(itemSelector)) attach(item);
  const mo = new MutationObserver(() => {
    for (const item of container.querySelectorAll(itemSelector)) attach(item);
    for (const [item, dispose] of disposers) {
      if (!container.contains(item)) { dispose(); disposers.delete(item); }
    }
  });
  mo.observe(container, { childList: true, subtree: true });
  return function disposeAll() {
    mo.disconnect();
    for (const dispose of disposers.values()) dispose();
    disposers.clear();
  };
}
