// El hotel cambio de nombre o era el mismo hotel con otro nombre: grand-hyatt-playa-del-carmen-wedding-photographer -> devossion-live-aqua-playa-del-carmen-wedding-photographer.
// _redirects ya usa sus ~100 reglas. 2026-11-04.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/blog/devossion-live-aqua-playa-del-carmen-wedding-photographer', 'Cache-Control': 'public, max-age=86400' },
  });
