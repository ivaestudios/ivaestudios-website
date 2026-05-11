// IVAE Studios — Service Worker. Cache-first for static assets,
// network-first for HTML, gracefully fall back to /offline.html if
// disconnected.
const CACHE_VERSION = 'ivae-v5-2026-05-12-hero-hd';
const STATIC_CACHE = `ivae-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ivae-runtime-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  '/',
  '/blog',
  '/cancun-photographer',
  '/luxury-editorial',
  '/styles/site-header.css?v=20260511a',
  '/styles/site-footer.css?v=20260511a',
  '/styles/responsive.css?v=20260511a',
  '/styles/lw-blog.css?v=20260511a',
  '/styles/lw-editorial.css?v=20260511a',
  '/dark-mode.css',
  '/dark-mode.js',
  '/js/site-header.js?v=20260511a',
  '/js/components.js?v=20260511a',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.endsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Cache-first for CSS/JS/fonts/images
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)).catch(()=>{});
      return res;
    }))
  );
});
