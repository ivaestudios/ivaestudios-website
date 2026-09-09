// ============================================================================
// IVAE Marketing — El segmented que no cabe AVISA que sigue.
//
// A 390px las pestanas de contenido terminaban en "Marc" y las de Avisos en
// "Asignadas" pegada al filo: parecia un error de maquetacion, no una lista
// que se desliza. Aqui se marca la clase .seg--ovf SOLO cuando de verdad
// desborda, mas .seg--ini/.seg--fin segun de que lado queda contenido oculto;
// el degradado lo pinta app.css con una mascara.
//
// Se vigila TODO el documento (los .seg nacen en vistas y en hojas), con un
// observador que reacciona a lo que se agrega, y ResizeObserver por elemento
// para el giro del telefono. Idempotente: llamar dos veces no duplica nada.
// ============================================================================

const VISTOS = new WeakSet();
const HOLGURA = 2;   // px de tolerancia: los redondeos del navegador mienten

// Todas las tiras que se deslizan en horizontal y se cortaban de tajo: las
// pestanas (.seg), la barra de meses del Calendario y la de Entregables.
const TIRAS = '.seg, .meses-monthbar, .dlv-monthbar';

function medir(seg) {
  const max = seg.scrollWidth - seg.clientWidth;
  if (max <= HOLGURA) {
    seg.classList.remove('seg--ovf', 'seg--ini', 'seg--fin');
    return;
  }
  seg.classList.add('seg--ovf');
  seg.classList.toggle('seg--ini', seg.scrollLeft > HOLGURA);
  seg.classList.toggle('seg--fin', seg.scrollLeft < max - HOLGURA);
}

function adoptar(seg) {
  if (VISTOS.has(seg)) return;
  VISTOS.add(seg);
  seg.addEventListener('scroll', () => medir(seg), { passive: true });
  try { new ResizeObserver(() => medir(seg)).observe(seg); } catch { /* navegador viejo */ }
  // Las fuentes propias llegan despues del primer pintado y cambian el ancho.
  medir(seg);
  try { document.fonts?.ready?.then(() => medir(seg)); } catch { /* noop */ }
  setTimeout(() => medir(seg), 400);
}

function barrer(raiz = document) {
  try { raiz.querySelectorAll?.(TIRAS).forEach(adoptar); } catch { /* noop */ }
}

let arrancado = false;
export function vigilarSegmentados() {
  if (arrancado) return;
  arrancado = true;
  barrer();
  try {
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches?.(TIRAS)) adoptar(n);
          else barrer(n);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch { /* sin observador: al menos el barrido inicial quedo */ }
  window.addEventListener('resize', () => barrer(), { passive: true });
}
