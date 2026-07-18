// ============================================================================
// IVAE Marketing — Service Worker dedicado (scope /marketing/).
//
// Objetivo: arranque instantáneo. Todos los assets de la app llevan ?v=STAMP
// (el sed del deploy bumpea el stamp en cada deploy), así que un asset con
// ?v= es INMUTABLE: si cambia el contenido, cambia la URL. Eso permite
// cache-first sin riesgo de código viejo.
//
// Versionado: este SW se registra desde js/main.js como
//   /marketing/sw.js?v=STAMP
// con el MISMO literal de stamp que los imports (el sed lo bumpea igual).
// URL nueva de registro = SW "nuevo" por deploy → skipWaiting + claim +
// borrar caches mkt-* viejos. El stamp se lee de la propia URL del SW
// (self.location), así que este archivo NO contiene ningún ?v= literal.
//
// Estrategias:
//   · app.html / index.html (y navegaciones bajo /marketing/) → NETWORK-FIRST
//     con cache:'no-store' (el TTL de 4h de la zona pisa el max-age=0; igual
//     que el SW raíz v13) y timeout de 3s con fallback al cache (offline OK).
//     app.html JAMÁS es cache-first: el detector de versión de shell.js
//     (installVersionWatch) depende de leer el app.html fresco de la red.
//   · Assets same-origin bajo /marketing/ con ?v= (js/css/png/webmanifest…)
//     y las fuentes locales /marketing/fonts/*.woff2 → CACHE-FIRST.
//   · /api/* → NO se intercepta (directo a red).
//   · Métodos != GET y cross-origin → NO se intercepta.
//
// OJO: el SW raíz del sitio (/sw.js) borra en su activate TODO cache cuyo
// nombre no termine en SU versión — incluidos los mkt-*. Solo pasa cuando el
// SW raíz se actualiza (deploy del sitio), y el costo es benigno: el cache
// se repuebla en las siguientes cargas.
// ============================================================================

'use strict';

const STAMP = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'mkt-v' + STAMP;
const HTML_TIMEOUT_MS = 3000;

// Páginas precacheadas en install para que el fallback offline exista desde
// la primera visita (se refrescan en cada navegación por network-first).
const HTML_PAGES = ['/marketing/app.html', '/marketing/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache tolerante a fallos: si una página no baja, el install sigue.
    await Promise.all(HTML_PAGES.map(async (page) => {
      try {
        const res = await fetch(page, { cache: 'no-store', credentials: 'same-origin' });
        if (res && res.ok) await cache.put(page, await stripRedirect(res));
      } catch { /* sin red durante install: network-first la poblará después */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Borra SOLO los caches de esta app (mkt-*) de deploys anteriores.
    // Los caches del SW raíz del sitio (ivae-*) no se tocan.
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('mkt-') && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── Estrategias ──────────────────────────────────────────────────────────────

// Una respuesta REDIRIGIDA (res.redirected, p.ej. /marketing/app.html → 308 →
// /marketing/app) NO puede servirse a una navegación desde un SW: Safari lanza
// "Response served by service worker has redirections" y Chrome falla con
// ERR_FAILED. La reconstruimos como una respuesta limpia (mismo body, sin la
// marca de redirect) antes de cachearla o devolverla.
async function stripRedirect(res) {
  if (!res || !res.redirected) return res;
  const body = await res.arrayBuffer();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

// HTML: red primero (siempre fresco, no-store para brincar el TTL de zona),
// con timeout; si la red falla o tarda, sirve la copia cacheada (offline).
async function networkFirstHtml(req, url) {
  const cache = await caches.open(CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTML_TIMEOUT_MS);
  try {
    // fetch por URL (no por Request): un Request con mode:'navigate' no se
    // puede combinar con un init en Chrome.
    const res = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const out = await stripRedirect(res); // sin la marca de redirect (Safari/Chrome la rechazan en navegaciones)
    if (out && out.ok) cache.put(url.pathname, out.clone()).catch(() => {});
    return out;
  } catch (err) {
    clearTimeout(timer);
    const hit = await cache.match(url.pathname);
    if (hit) return hit;
    throw err;
  }
}

// Assets inmutables (?v=STAMP) y fuentes: cache primero; a la red solo en miss.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

// ── Router de fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // mutaciones: directo a red

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // cross-origin: no interceptar
  if (url.pathname.startsWith('/api/')) return;           // API: SIEMPRE directo a red
  if (!url.pathname.startsWith('/marketing/')) return;    // fuera de la app: no interceptar

  // HTML de la app (navegaciones y fetches del version-watch): network-first.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/marketing/') {
    event.respondWith(networkFirstHtml(req, url));
    return;
  }

  // Assets con stamp (?v=) = inmutables, y fuentes locales: cache-first.
  if (url.searchParams.has('v') || url.pathname.startsWith('/marketing/fonts/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Resto (assets sin stamp, p.ej. manifest/íconos): comportamiento normal.
});
