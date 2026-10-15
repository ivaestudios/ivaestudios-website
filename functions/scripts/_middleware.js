// Carpeta interna del repo (documentos, respaldos de clientes, scripts).
// Vive en el directorio que publica Pages, asi que sin esto se servia con 200
// a cualquiera. _redirects no puede taparla (Pages sirve el archivo y nunca
// aplica la regla) y X-Robots-Tag solo evita que se indexe. 2026-10-14.
export const onRequest = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
  });
