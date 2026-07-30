// ============================================================================
// IVAE Marketing — Estados transversales de "no se pudo cargar".
//
// UNA sola tarjeta "Error + Reintentar" para toda la app. Nacio en
// views/dash-widgets.js (errorCard) y se mudo aqui para que las vistas del
// CLIENTE — Calendario (meses) y Entregables — puedan reusarla SIN arrastrar
// los ~38 KB de widgets del dashboard, que el cliente nunca ve.
// dash-widgets.js la re-exporta, asi que views/dashboard.js no se entera.
//
// Estilos: .dash-error* en css/dashboard.css, que app.html carga SIEMPRE
// (no es lazy), asi que la tarjeta se ve igual en cualquier vista y en los
// dos temas (usa --warn / --text-mute / --text-dim).
// ============================================================================

import { el } from '../api.js?v=202607292343';
import { icon } from '../shell/icons.js?v=202607292343';
import { T } from '../shell/i18n.js?v=202607292343';

/**
 * Card unica de error con reintento.
 * @param {string}   [title]    Encabezado. Default: el del dashboard.
 * @param {string}   [message]  Detalle. Default: "revisa tu conexion".
 * @param {Function} [onRetry]  Accion del boton Reintentar.
 */
export function errorCard({ title, message, onRetry } = {}) {
  return el('div', { class: 'dash-error' }, [
    el('div', { class: 'dash-error__icon' }, [icon('warning', 26)]),
    el('h3', { class: 'dash-error__title', text: title || T('No se pudo cargar el resumen', "Couldn't load the summary") }),
    el('p', { class: 'dash-error__msg', text: message || T('Revisa tu conexión e intenta de nuevo.', 'Check your connection and try again.') }),
    el('button', {
      class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'),
      onclick: () => { if (onRetry) onRetry(); },
    }),
  ]);
}
