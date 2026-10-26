// Borrador de diseño de mayo 2026 con precios viejos y canonical a una página
// real: los buscadores lo mezclaban con la página verdadera (Brave citaba
// "$850"). El archivo sigue en el repo para verlo en local; en vivo da 404.
// _redirects no puede taparlo (Pages sirve el archivo). 2026-10-26.
export const onRequest = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
  });
