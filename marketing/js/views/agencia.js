// ============================================================================
// IVAE Marketing — Feed de la AGENCIA (rediseño aprobado por Vianey, 22-nov-2026).
// Es la misma vista del cliente (views/contenido.js) en "modo agencia": ve todas
// las piezas de la marca, sube el video a cada pieza, la abre y le responde al
// cliente en el hilo de comentarios. La vista del cliente NO cambia: el modo se
// prende solo mientras esta pestaña está montada.
// ============================================================================
import contenido, { ponerModo } from './contenido.js?v=202611222220';

export default {
  id: 'agencia',
  mount(host, c) { ponerModo('agencia'); return contenido.mount(host, c); },
  onParams(params) { return contenido.onParams ? contenido.onParams(params) : undefined; },
  unmount() { const r = contenido.unmount ? contenido.unmount() : undefined; ponerModo('cliente'); return r; },
};
