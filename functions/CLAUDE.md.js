// Archivo interno del repo (instrucciones y notas de trabajo). Vive en la raiz
// que publica Pages, asi que sin esto cualquiera, incluidos los buscadores de
// IA, lo leia en ivaestudios.com. Igual que functions/seo/_middleware.js: 404.
// 2026-11-11.
export const onRequest = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
  });
