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
// ============================================================================

import { T } from './i18n.js?v=202607271115';

const APP_HTML = '/marketing/app.html';
const STAMP_IN_HTML = /main\.js\?v=([\w.-]+)/;
const CACHE_BUST_PARAM = '_v';

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
  return Number.isNaN(dt.getTime()) ? null : dt;
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
 * Lee el app.html fresco del servidor y devuelve su sello, o null si no se
 * pudo (red caída, 5xx, HTML sin sello). El SW de /marketing/ sirve los .html
 * network-first con cache:'no-store', así que esto ve lo realmente publicado.
 */
export async function fetchServerStamp({ timeoutMs = 8000 } = {}) {
  let ctrl = null; let timer = null;
  try {
    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      timer = setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, timeoutMs);
    }
    const r = await fetch(APP_HTML, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!r || !r.ok) return null;
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
//   1) se borran TODAS las cachés del Cache Storage de este origen,
//   2) se le pide al SW que se actualice (y al que esté en espera que tome el
//      control),
//   3) se recarga a una URL con un parámetro anti-caché, conservando el #hash
//      (la usuaria vuelve a la MISMA pantalla donde estaba).
export async function applyUpdate() {
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch { /* Cache Storage bloqueado (modo privado): seguimos */ }

  try {
    const sw = navigator.serviceWorker;
    if (sw && sw.getRegistrations) {
      const regs = await sw.getRegistrations();
      await Promise.all(regs.map(async (reg) => {
        try { await reg.update(); } catch { /* noop */ }
        // Los dos SW del sitio (/sw.js y /marketing/sw.js) aceptan ambas
        // formas del mensaje; se mandan las dos para no depender de cuál corre.
        const w = reg.waiting || reg.installing;
        try { w?.postMessage({ type: 'skipWaiting' }); } catch { /* noop */ }
        try { w?.postMessage('skipWaiting'); } catch { /* noop */ }
      }));
    }
  } catch { /* sin SW: la recarga anti-caché basta */ }

  try {
    const u = new URL(location.href);
    u.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
    location.replace(u.href); // conserva el #hash: misma pantalla, código nuevo
  } catch {
    location.reload();
  }
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
