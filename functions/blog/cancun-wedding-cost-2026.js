// Direccion vieja que Google y el buscador de Claude todavia conocen y que daba 404.
// _redirects ya esta en su tope de reglas, por eso va como funcion. 2026-11-11.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/cancun-wedding-cost-2026', 'Cache-Control': 'public, max-age=86400' },
  });
