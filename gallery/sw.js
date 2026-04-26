// IVAE Gallery Service Worker — caches photo thumbnails + per-size web variants
// for instant repeat views. v2 fixes a regex that only matched /thumb and /web
// exactly, missing the /web/(sm|md|lg) variants the <picture srcset> actually
// uses — so v1 was effectively bypassing SW for 100% of displayed images.
const CACHE_NAME = 'ivae-photos-v2';

// Soft cap so a binge through a 1000-photo gallery doesn't pin hundreds of MB
// to disk forever. When the cache passes this many entries, oldest insertions
// are evicted (browser quota would eventually evict too, but unpredictably).
const MAX_CACHE_ENTRIES = 600;

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

// Match /thumb, /web, /web/sm, /web/md, /web/lg. Skips /full (downloads —
// rarely re-viewed, would blow the quota fast) and /lightbox (no longer used
// by the page but historically existed as an alias).
const PHOTO_RE = /^\/api\/gallery\/photos\/[a-f0-9]+\/(thumb|web)(\/(sm|md|lg))?$/;

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  // FIFO: keys() returns insertion order. Drop the oldest until under cap.
  const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
  await Promise.all(toDelete.map(k => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (!PHOTO_RE.test(url.pathname)) return;
  if (e.request.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(e.request);
    if (cached) return cached;

    const resp = await fetch(e.request);
    if (resp.ok) {
      const clone = resp.clone();
      // Store + trim async; don't block the response.
      e.waitUntil(
        cache.put(e.request, clone).then(() => trimCache(cache)).catch(() => {})
      );
    }
    return resp;
  })());
});
