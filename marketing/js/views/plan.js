// ============================================================================
// IVAE Marketing — CALENDARIO de la AGENCIA (diseño aprobado por Vianey, 22-nov-2026).
// Las piezas del mes en renglones por tipo (con la misma numeración que la Hoja
// del mes), si ya tienen su video, sus comentarios y, al tocarlas, su guion,
// su video, cuándo salen y a dónde ir. Es views/contenido.js en "modo agencia"
// con la pestaña de lista; la vista del cliente NO cambia. Lo de siempre
// (Generar mes con IA, PDF, agregar piezas) sigue en la Hoja del mes (#/meses).
// ============================================================================
import contenido, { ponerModo } from './contenido.js?v=202611222250';

export default {
  id: 'plan',
  mount(host, c) { ponerModo('agencia', 'lista'); return contenido.mount(host, c); },
  onParams(params) { return contenido.onParams ? contenido.onParams(params) : undefined; },
  unmount() { const r = contenido.unmount ? contenido.unmount() : undefined; ponerModo('cliente'); return r; },
};
