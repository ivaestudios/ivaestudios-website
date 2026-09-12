// ============================================================================
// IVAE Marketing — Hoja "Ajustes de avisos".
//
// Antes ese renglon del menu de cuenta abria... la lista de avisos. O sea que
// "ajustes" no ajustaba nada. Aqui vive el interruptor de verdad: encender los
// avisos EN ESTE APARATO, apagarlos, y mandarse una prueba para comprobar que
// llegan con la app cerrada.
//
// Cada aparato se enciende por separado a proposito: el permiso del navegador
// es del aparato, no de la cuenta. Quien entra desde su celular y su compu
// decide en cada uno.
// ============================================================================

import { el, clear } from '../api.js?v=202609121525';
import { openSheet } from './sheet.js?v=202609121525';
import { toast } from './toast.js?v=202609121525';
import { icon } from './icons.js?v=202609121525';
import { T } from './i18n.js?v=202609121525';
import * as push from './push.js?v=202609121525';

// Lo que se le dice a la persona cuando el aparato no puede. En su idioma, sin
// jerga: un motivo que no se entiende es igual de inutil que ningun motivo.
const EXPLICA = {
  'ios-sin-instalar': () => T(
    'En iPhone los avisos solo funcionan con la app instalada. Abre esta página en Safari, toca Compartir y luego "Agregar a inicio". Desde ahí ya podrás encenderlos.',
    'On iPhone, alerts only work once the app is installed. Open this page in Safari, tap Share, then "Add to Home Screen". You can turn them on from there.',
  ),
  'sin-push': () => T(
    'Este navegador no sabe recibir avisos. Prueba desde Chrome en Android, o instala la app en tu iPhone.',
    'This browser cannot receive alerts. Try Chrome on Android, or install the app on your iPhone.',
  ),
  'sin-sw': () => T('Este navegador no soporta avisos.', 'This browser does not support alerts.'),
  'sin-llave': () => T(
    'Los avisos todavía no están encendidos del lado del servidor. Avísale a IVAE.',
    'Alerts are not enabled on the server yet. Let IVAE know.',
  ),
  denegado: () => T(
    'Dijiste que no a los avisos. Para cambiarlo hay que darle permiso a esta página en los ajustes del navegador.',
    'You declined alerts. To change it, allow this site in your browser settings.',
  ),
};

export function abrirAjustesAvisos() {
  let cuerpo = null;
  openSheet({
    title: T('Ajustes de avisos', 'Notification settings'),
    mode: 'menu',
    build(body) {
      cuerpo = el('div', { class: 'av-ajustes' });
      body.appendChild(cuerpo);
      pintar();
    },
  });

  async function pintar() {
    clear(cuerpo);
    cuerpo.appendChild(el('div', { class: 'av-cargando muted', text: T('Revisando…', 'Checking…') }));

    const d = push.diagnostico();
    const [servidor, sub] = await Promise.all([push.estadoServidor(), push.suscripcionActual()]);
    const encendidoAqui = !!sub;

    clear(cuerpo);

    cuerpo.appendChild(el('p', { class: 'av-intro', text: T(
      'Los avisos te llegan al teléfono aunque la app esté cerrada: cuando un cliente comenta, cuando aprueba, cuando algo se atrasa.',
      'Alerts reach your phone even with the app closed: when a client comments, approves, or something runs late.',
    ) }));

    if (!d.puede || !servidor.disponible) {
      const motivo = !servidor.disponible ? 'sin-llave' : d.motivo;
      cuerpo.appendChild(el('div', { class: 'av-nota' }, [
        icon('bell', 18),
        el('span', { text: (EXPLICA[motivo] || EXPLICA['sin-push'])() }),
      ]));
      return;
    }

    // ── El interruptor de ESTE aparato ──
    const btn = el('button', {
      class: 'av-switch' + (encendidoAqui ? ' is-on' : ''),
      type: 'button', role: 'switch', 'aria-checked': String(encendidoAqui),
    }, [
      el('span', { class: 'av-switch__txt', text: encendidoAqui
        ? T('Avisos encendidos en este aparato', 'Alerts on for this device')
        : T('Encender avisos en este aparato', 'Turn on alerts for this device') }),
      el('span', { class: 'av-switch__knob' }),
    ]);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (encendidoAqui) {
          await push.apagar();
          toast(T('Avisos apagados en este aparato.', 'Alerts turned off on this device.'));
        } else {
          const r = await push.encender();
          if (!r.ok) {
            toast((EXPLICA[r.motivo] || EXPLICA['sin-push'])(), { type: 'error' });
          } else {
            toast(T('Listo, ya te van a llegar.', 'Done, you will get them now.'));
          }
        }
      } finally {
        btn.disabled = false;
        pintar();
      }
    });
    cuerpo.appendChild(btn);

    // ── Cuantos aparatos tiene encendidos en total ──
    const n = servidor.dispositivos || 0;
    cuerpo.appendChild(el('div', { class: 'av-cuenta muted', text: n === 0
      ? T('Ningún aparato tuyo tiene avisos encendidos.', 'No device of yours has alerts on.')
      : (n === 1 ? T('1 aparato con avisos encendidos.', '1 device with alerts on.')
        : T(`${n} aparatos con avisos encendidos.`, `${n} devices with alerts on.`)) }));

    // ── Prueba real: el aviso tiene que APARECER ──
    if (encendidoAqui) {
      const prueba = el('button', { class: 'btn av-probar', type: 'button' }, [
        icon('bell', 16), el('span', { text: T('Enviarme una prueba', 'Send me a test') }),
      ]);
      prueba.addEventListener('click', async () => {
        prueba.disabled = true;
        try {
          const r = await push.probar();
          toast(r && r.ok
            ? T('Enviado. Debe aparecerte en un segundo.', 'Sent. It should pop up in a second.')
            : T('No salió. Vuelve a apagar y encender el interruptor.', 'It did not go out. Toggle the switch off and on.'),
            { type: r && r.ok ? 'ok' : 'error' });
        } finally { prueba.disabled = false; }
      });
      cuerpo.appendChild(prueba);
    }
  }

}
