// IVAE Studios — Service Worker.
// Network-first for HTML (always fresh), stale-while-revalidate for assets.
// On disconnect, HTML falls back to the most recent cached copy of the
// request, or to the cached root ("/").
//
// IMPORTANT: bump CACHE_VERSION on every change to force the browser
// to re-install. The activate event clears every cache whose name does
// not end in CACHE_VERSION, so old assets are dropped automatically.
//
// v9 (2026-05-26): removed dead /offline.html fallback (file does not
// exist in the repo and was silently 404-ing on offline navigations).
// Offline HTML now degrades to the cached request, then cached "/".
// Marketing pages are NOT precached on purpose — HTML stays network-first
// so the runtime cache picks them up on first visit without bloating
// install with routes that may change frequently.
//
// v10 (2026-05-30): cache-bust. CSS/JS are served cache-first
// (stale-while-revalidate), so returning visitors kept rendering the blog
// and other pages with STALE stylesheets after CSS-only fixes were pushed
// (the layout looked out of date / "desordenado" until a second visit).
// Bumping the version drops every old cache on activate so all devices
// re-fetch the current CSS immediately.
//
// v11 (2026-05-31): the cache-first JS bug also pinned an OLD site-header.js
// (the mobile menu) because its ?v= query string had not changed in weeks, so
// the cached asset URL stayed identical and the SW never re-fetched it. Fix is
// two-fold: (a) every CSS/JS include site-wide bumped to ?v=20260531a so the
// asset URLs change (guaranteed cache-miss -> fresh fetch on ANY SW version),
// and (b) this cache version bump drops all old caches on activate.

// v12 (2026-06-10): /marketing/ joins the cache bypass (network-only, like
// /gallery/). The marketing app v2 is ~60 ES modules imported without ?v=
// query strings, so any SW caching of /marketing/* or /api/marketing/* would
// pin stale code/responses. /api/marketing/ was already covered by the /api/
// bypass; /marketing/ is new.

// v13 (2026-06-11): the v12 bypass (return; -> browser default) was not enough
// for /marketing/ STATIC assets: the zone-level Browser Cache TTL (4h)
// overrides the origin's max-age=0, so the HTTP cache pinned deployed modules
// for hours. Now /marketing/ js/css/html fetches go out with cache:'no-store'
// (always revalidate at the edge; deploys propagate on next load). /api/ and
// /gallery/ keep the plain bypass.

const CACHE_VERSION = 'ivae-v22-2026-06-20-conectar-directo';
const STATIC_CACHE = `ivae-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ivae-runtime-${CACHE_VERSION}`;

// Precache ONLY un-versioned, stable URLs. Versioned URLs (?v=...)
// change too often — better to let runtime cache handle them on demand.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete EVERY cache from previous versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      ),
      // Take control of all open clients immediately
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Marketing app: network with cache:'no-store' so the HTTP cache never pins
  // deployed modules (the zone Browser Cache TTL overrides origin max-age=0).
  // The edge still answers fast; deploys propagate on the next load.
  if (url.pathname.startsWith('/marketing/')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Bypass cache entirely for the gallery sub-app and api endpoints
  // (network-only; /api/ already covers /api/marketing/).
  if (
    url.pathname.startsWith('/gallery/') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first for HTML (always fetch fresh — no stale UI bug)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/'))
        )
    );
    return;
  }

  // Cache-first for CSS/JS/fonts/images, with stale-while-revalidate
  // semantics: serve cached, but kick off a background refresh.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Listen for skipWaiting message from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'skipWaiting') {
    self.skipWaiting();
  }
});
