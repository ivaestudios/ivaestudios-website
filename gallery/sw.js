// IVAE Gallery Service Worker — caches photo thumbnails aggressively for instant repeat views
const CACHE_NAME = 'ivae-photos-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only cache thumb/web photo requests
  if (!url.pathname.match(/^\/api\/gallery\/photos\/[a-f0-9]+\/(thumb|web)$/)) return;
  if (e.request.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(e.request);
    if (cached) return cached;

    const resp = await fetch(e.request);
    if (resp.ok) {
      const clone = resp.clone();
      cache.put(e.request, clone).catch(() => {});
    }
    return resp;
  })());
});
