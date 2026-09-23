// ============================================================================
// IVAE Marketing — La app de la TIENDA (App Store).
//
// QUE RESUELVE
// version.js resuelve el codigo WEB: hay version nueva → recargar y listo.
// Esto es otra cosa. Quien entra por la app de la App Store corre un
// envoltorio NATIVO que solo cambia publicando en la tienda, y iOS no siempre
// la actualiza solo: el cliente se queda con la app vieja y no se entera.
//
// COMO SE SABE QUE VERSION TIENE
// El envoltorio se anuncia en el User-Agent como "IVAEMarketingiOS/<version>"
// (AppWebView.swift, applicationNameForUserAgent).
//
// ⚠️ LAS VERSIONES 1.0 Y 1.1 MIENTEN: ese literal estuvo escrito a mano como
// "1.0" en las dos, asi que un telefono con la 1.1 tambien dice 1.0. Por eso
// UA_CIEGA: mientras el envoltorio diga exactamente eso NO se puede saber si
// va atrasado, y avisarle "actualiza" seria mandar a la tienda a gente que ya
// esta al dia. Desde la primera version que mande su version de verdad, la
// comparacion es exacta. Lo que SI se puede siempre es dejarle el acceso a la
// ficha de la tienda en el menu de su cuenta.
//
// Android NO entra aqui a proposito: es una TWA, o sea que el contenido es
// esta misma web y se actualiza sola. Avisarle de la tienda seria mentira.
// ============================================================================

import { api } from '../api.js?v=202609231830';

// La ficha nunca cambia de direccion (app id 6796458308).
export const APP_STORE_URL = 'https://apps.apple.com/mx/app/ivae-marketing/id6796458308';

const UA_CIEGA = '1.0';

/** Version del envoltorio de iOS, o null si esto NO corre dentro de la app. */
export function versionEnvoltorio() {
  const m = String(navigator.userAgent || '').match(/IVAEMarketingiOS\/([\d.]+)/);
  return m ? m[1] : null;
}

/** ¿Esto corre dentro de la app de la tienda? */
export function enLaApp() { return versionEnvoltorio() !== null; }

/** "1.2.3" → compara por numero, no por texto (asi "1.10" > "1.9"). */
export function cmpVersiones(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * ¿Hay que avisarle que actualice?
 * Devuelve { instalada, tienda, url } o null (no corre en la app, no se sabe
 * su version, no hay red, o ya esta al dia). null = NO avisar, nunca a medias.
 */
export async function hayVersionNueva() {
  const instalada = versionEnvoltorio();
  if (!instalada || instalada === UA_CIEGA) return null;
  let ios = null;
  try {
    const r = await api.get('/app-version');
    ios = r && r.ios;
  } catch { return null; } // sin red o backend viejo: silencio
  if (!ios || !ios.version) return null;
  if (cmpVersiones(instalada, ios.version) >= 0) return null;
  return { instalada, tienda: ios.version, url: ios.url || APP_STORE_URL };
}
