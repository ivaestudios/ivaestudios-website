// ============================================================================
// IVAE Marketing — Avisos en el telefono (Web Push), lado de la app.
//
// Tres piezas: pedir permiso, suscribir este aparato y contarselo al servidor.
// El cifrado y el envio son del servidor (functions/api/marketing/_push.js) y
// quien pinta el aviso con la app cerrada es el Service Worker (sw.js).
//
// OJO CON EL IPHONE: Apple solo deja avisos web si la app esta INSTALADA en la
// pantalla de inicio. En Safari normal el boton de permiso ni existe, asi que
// hay que decirlo con todas sus letras en vez de dejar un interruptor muerto.
// ============================================================================

import { api } from '../api.js?v=202609091246';

const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

function llaveABytes(base64) {
  const norm = String(base64).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Que se puede hacer en ESTE aparato, dicho en palabras. */
export function diagnostico() {
  if (!('serviceWorker' in navigator)) return { puede: false, motivo: 'sin-sw' };
  if (!('PushManager' in window)) {
    return { puede: false, motivo: esIOS() && !instalada() ? 'ios-sin-instalar' : 'sin-push' };
  }
  if (!('Notification' in window)) return { puede: false, motivo: 'sin-push' };
  if (esIOS() && !instalada()) return { puede: false, motivo: 'ios-sin-instalar' };
  return { puede: true, permiso: Notification.permission };
}

/** ¿Este aparato ya esta suscrito? */
export async function suscripcionActual() {
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

/**
 * Enciende los avisos en este aparato. Devuelve { ok } o { ok:false, motivo }.
 * Motivos posibles: 'sin-llave' (el servidor no tiene VAPID), 'denegado'
 * (la persona dijo que no), 'ios-sin-instalar', 'sin-push'.
 */
export async function encender() {
  const d = diagnostico();
  if (!d.puede) return { ok: false, motivo: d.motivo };

  const llave = await api.get('/push/llave').catch(() => null);
  if (!llave || !llave.disponible) return { ok: false, motivo: 'sin-llave' };

  // requestPermission SOLO funciona desde un gesto de la persona; por eso esta
  // funcion se llama desde el onclick del interruptor, nunca al arrancar.
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return { ok: false, motivo: 'denegado' };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,                       // exigido por el navegador
      applicationServerKey: llaveABytes(llave.llave),
    });
  }
  const j = sub.toJSON();
  await api.post('/push/suscribir', { endpoint: j.endpoint, keys: j.keys });
  return { ok: true };
}

/** Apaga los avisos en este aparato (y le avisa al servidor). */
export async function apagar() {
  try {
    const sub = await suscripcionActual();
    if (sub) {
      await api.post('/push/baja', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    } else {
      await api.post('/push/baja', {}).catch(() => {});
    }
    return { ok: true };
  } catch (e) { return { ok: false, motivo: String(e && e.message) }; }
}

/** Se manda un aviso a si misma, para comprobar la cadena entera. */
export async function probar() {
  return api.post('/push/probar', {});
}

/** Estado que ve el servidor: cuantos aparatos y si los quiere. */
export async function estadoServidor() {
  return api.get('/push/estado').catch(() => ({ disponible: false, dispositivos: 0, activo: false }));
}
