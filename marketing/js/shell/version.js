// ============================================================================
// IVAE Marketing — Versión de la app (¿lo que veo es lo que está publicado?).
//
// EL PROBLEMA QUE RESUELVE
// La SPA congela sus módulos con ?v=SELLO al cargar. Tras cada deploy, una
// pestaña abierta (o una restaurada por el navegador / la PWA) sigue corriendo
// el código viejo: los cambios YA están publicados en el servidor, pero en esa
// pantalla no se ven. Antes no había forma de saberlo ni de comprobarlo, y
// parecía que "no se publicó".
//
// QUÉ EXPONE
//   CURRENT                      sello del código que corre AHORA ('202607271800')
//   formatStamp(sello)           → "27 jul, 10:01" (legible, en el idioma activo)
//   compareStamps(mío, servidor) → 'same' | 'new' | 'unknown'
//   fetchServerStamp()           → sello publicado en el servidor, o null
//   check({force})               → {state, current, server, at}  (con caché corta)
//   onChange(fn)                 → suscripción al último resultado
//   applyUpdate()                → borra cachés + refresca el SW + recarga
//                                  a una URL anti-caché (traer DE VERDAD lo nuevo)
//   consumeCacheBustParam()      → limpia el ?_v= que deja applyUpdate()
//
// REGLAS
//   · NUNCA recarga sola: puede haber texto sin guardar. Siempre la usuaria.
//   · Servidor caído / respuesta sin sello → 'unknown' (jamás un falso "hay
//     versión nueva", que erosionaría la confianza igual que el bug original).
//   · Y al revés, que es PEOR: jamás un falso "Actualizada ✓". Ante la mínima
//     duda de si la respuesta vino de verdad del servidor → 'unknown'.
// ============================================================================

import { T } from './i18n.js?v=202608060100';

const APP_HTML = '/marketing/app.html';
// El sello se lee del <script type="module"> REAL, no del <link modulepreload>
// que aparece antes en el HTML. Si algún día un bump tocara solo uno de los
// dos, leer el preload daría 'new' permanente: franja de "hay versión nueva"
// que reaparece después de cada actualización, para siempre. Anclarlo al
// <script> (que es justo lo que lee readCurrentStamp) lo hace imposible.
const STAMP_IN_HTML = /<script[^>]+src=["'][^"']*main\.js\?v=([\w.-]+)/;
const CACHE_BUST_PARAM = '_v';
// Marca de la sonda de versión. El SW de /marketing/ NO intercepta las URLs
// que la llevan (ver sw.js): la comprobación TIENE que hablar con el servidor,
// no con el Service Worker. Al ser única por llamada también brinca la caché
// del navegador y la del edge de Cloudflare.
const PROBE_PARAM = '__vprobe';
// Si la respuesta dice haberse generado hace más de esto, no viene del servidor
// de ahora sino de una caché: se trata como "no se pudo comprobar".
const MAX_RESPONSE_AGE_MS = 5 * 60 * 1000;

/** Sello del bundle que corre en ESTA pestaña (null si no se pudo leer). */
export function readCurrentStamp() {
  // El <script type="module" src="/marketing/js/main.js?v=SELLO"> de app.html.
  const tag = document.querySelector('script[src*="main.js?v="]');
  const src = (tag && tag.src) || '';
  const m = src.match(/[?&]v=([\w.-]+)/);
  return m ? m[1] : null;
}

export const CURRENT = readCurrentStamp();

// ── Sello → fecha legible ────────────────────────────────────────────────────
// El sed del deploy escribe AAAAMMDDhhmm (a veces con segundos). Se interpreta
// como hora LOCAL, que es como lo generó la máquina que desplegó.
export function stampToDate(stamp) {
  const m = String(stamp || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/);
  if (!m) return null;
  const y = +m[1]; const mo = +m[2]; const d = +m[3];
  const h = +m[4]; const mi = +m[5]; const s = +(m[6] || 0);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const dt = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(dt.getTime())) return null;
  // 20260231 desborda a marzo: si la fecha no vuelve igual, el sello no es real.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * "27 jul, 10:01" / "Jul 27, 10:01". Si el sello no es una fecha (dev, sello
 * raro), se devuelve tal cual para que igual sea comprobable a ojo.
 */
export function formatStamp(stamp) {
  if (!stamp) return T('sin identificar', 'unknown');
  const d = stampToDate(stamp);
  if (!d) return String(stamp);
  return T(
    `${d.getDate()} ${MONTHS_ES[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  );
}

/** Línea completa para el menú de cuenta: "Versión del 27 jul, 10:01". */
export function currentLabel() {
  if (!CURRENT) return T('Versión sin identificar', 'Unidentified version');
  return T(`Versión del ${formatStamp(CURRENT)}`, `Version of ${formatStamp(CURRENT)}`);
}

// ── Comparación ──────────────────────────────────────────────────────────────
/**
 * 'same'    → esta pestaña corre exactamente lo publicado.
 * 'new'     → el servidor publicó algo distinto (hay que actualizar).
 * 'unknown' → no se pudo saber (sin sello propio, servidor caído, sin red,
 *             o el HTML del servidor no traía sello). NUNCA se avisa con esto.
 */
export function compareStamps(current, server) {
  if (!current || !server) return 'unknown';
  return current === server ? 'same' : 'new';
}

// ── Consulta al servidor ─────────────────────────────────────────────────────
/**
 * ¿Esta respuesta salió de una caché en vez del servidor?
 *
 * El Service Worker de /marketing/ sirve los .html network-first PERO con
 * fallback a la copia cacheada: sin red (o con red lenta) devolvía un 200 OK
 * con el app.html VIEJO, y la comprobación lo leía como "el servidor publica
 * mi mismo sello" → "Actualizada ✓" en verde corriendo código viejo. Ese es el
 * peor error posible aquí, así que va con cinturón y tirantes:
 *   1) la sonda lleva PROBE_PARAM y el SW nuevo ya no la intercepta (sw.js),
 *   2) esto, por si la pestaña sigue bajo un SW viejo que no conoce la marca.
 *
 * `date` = cuándo generó la respuesta el origen; `age` = segundos que lleva en
 * cachés intermedias. date+age ≈ ahora en una respuesta viva (aunque venga del
 * edge de Cloudflare), pero se queda congelado en una copia del Cache Storage.
 */
function looksCached(r) {
  try {
    const d = Date.parse(r.headers.get('date') || '');
    if (Number.isNaN(d)) return false; // sin cabecera no se puede juzgar
    const age = Number(r.headers.get('age')) || 0;
    return (Date.now() - (d + age * 1000)) > MAX_RESPONSE_AGE_MS;
  } catch { return false; }
}

/**
 * Lee el app.html fresco DEL SERVIDOR y devuelve su sello, o null si no se
 * pudo (sin red, 5xx, HTML sin sello, o respuesta que huele a caché).
 */
export async function fetchServerStamp({ timeoutMs = 8000 } = {}) {
  let ctrl = null; let timer = null;
  try {
    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      timer = setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, timeoutMs);
    }
    const r = await fetch(`${APP_HTML}?${PROBE_PARAM}=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!r || !r.ok) return null;
    if (looksCached(r)) return null; // no es el servidor: mejor "no se pudo comprobar"
    const html = await r.text();
    const m = html.match(STAMP_IN_HTML);
    return m ? m[1] : null;
  } catch {
    return null; // sin red / abortado: 'unknown', jamás un falso positivo
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Estado compartido (lo consumen la franja y el menú de cuenta) ────────────
let last = { state: 'unknown', current: CURRENT, server: null, at: 0 };
let inFlight = null;
const listeners = new Set();

export function getLast() { return last; }

export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(last); } catch (e) { console.error('[version] listener', e); }
  }
}

/**
 * Comprueba contra el servidor. Sin `force`, reusa un resultado de menos de
 * 20 s (abrir el menú justo después de un chequeo no dispara otra petición).
 * Las llamadas concurrentes comparten la misma petición.
 */
export async function check({ force = false, maxAgeMs = 20000 } = {}) {
  if (!force && last.at && (Date.now() - last.at) < maxAgeMs) return last;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const server = await fetchServerStamp();
    last = { state: compareStamps(CURRENT, server), current: CURRENT, server, at: Date.now() };
    emit();
    return last;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

// ── Actualizar DE VERDAD ─────────────────────────────────────────────────────
// location.reload() puede reusar la caché del navegador y la del Service
// Worker (los assets ?v= son cache-first). Para que tras pulsar "Actualizar"
// corra la versión nueva con certeza:
//   0) se COMPRUEBA que hay servidor del otro lado. Las cachés mkt-* son el
//      único respaldo sin conexión: si se borran sin red, la recarga del paso 3
//      no resuelve y la app queda en la pantalla de error del navegador (PWA
//      muerta hasta que vuelva la señal). Primero mirar, luego romper.
//   1) se borran las cachés de ESTA app (mkt-*). Las del sitio público
//      (ivae-*) y las de la galería no se tocan: no son nuestras.
//   2) se le pide al SW que se actualice (y al que esté en espera que tome el
//      control). Best-effort CON TECHO DE TIEMPO: reg.update() no tiene
//      timeout propio y con red mala deja el botón en "Actualizando…" para
//      siempre. La recarga con ?_v= ya garantiza el HTML nuevo; el SW es un
//      extra, no puede bloquear.
//   3) se recarga a una URL con un parámetro anti-caché, conservando el #hash
//      (la usuaria vuelve a la MISMA pantalla donde estaba).
//
// Devuelve false si NO se pudo actualizar (sin red / servidor sin responder),
// sin haber tocado nada. En ese caso quien llama debe devolver el botón a su
// estado normal y avisar. Si devuelve true, la navegación ya va en camino.
const SW_STEP_TIMEOUT_MS = 2500;

export async function applyUpdate() {
  // 0) ¿Hay servidor? Si no, no se destruye el respaldo offline.
  if (navigator.onLine === false) return false;
  const server = await fetchServerStamp();
  if (!server) return false;

  // 1) Solo las cachés de esta app.
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('mkt-'))
             .map((n) => caches.delete(n).catch(() => false)),
      );
    }
  } catch { /* Cache Storage bloqueado (modo privado): seguimos */ }

  // 2) SW best-effort, nunca bloqueante.
  const swStep = (async () => {
    try {
      const sw = navigator.serviceWorker;
      if (!sw || !sw.getRegistrations) return;
      const regs = await sw.getRegistrations();
      await Promise.all(regs.map(async (reg) => {
        try { await reg.update(); } catch { /* noop */ }
        // Los dos SW del sitio (/sw.js y /marketing/sw.js) aceptan ambas
        // formas del mensaje; se mandan las dos para no depender de cuál corre.
        const w = reg.waiting || reg.installing;
        try { w?.postMessage({ type: 'skipWaiting' }); } catch { /* noop */ }
        try { w?.postMessage('skipWaiting'); } catch { /* noop */ }
      }));
    } catch { /* sin SW: la recarga anti-caché basta */ }
  })();
  await Promise.race([swStep, new Promise((r) => setTimeout(r, SW_STEP_TIMEOUT_MS))]);

  // 3) Recarga anti-caché.
  try {
    const u = new URL(location.href);
    u.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
    location.replace(u.href); // conserva el #hash: misma pantalla, código nuevo
  } catch {
    location.reload();
  }
  return true;
}

/**
 * Quita el ?_v= que dejó applyUpdate() para que la URL no se ensucie ni se
 * comparta con el parámetro. No recarga (history.replaceState).
 */
export function consumeCacheBustParam() {
  try {
    const qs = new URLSearchParams(location.search);
    if (!qs.has(CACHE_BUST_PARAM)) return;
    qs.delete(CACHE_BUST_PARAM);
    const rest = qs.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  } catch { /* noop */ }
}
