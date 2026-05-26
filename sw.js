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

const CACHE_VERSION = 'ivae-v9-2026-05-26-offline-fix';
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

  // Bypass cache entirely for the gallery sub-app and api endpoints
  if (url.pathname.startsWith('/gallery/') || url.pathname.startsWith('/api/')) {
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
