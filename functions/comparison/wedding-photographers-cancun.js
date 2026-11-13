// La comparativa de bodas (12-nov-2026) se retiro el 13-nov a peticion del estudio.
// Google y los buscadores de las IAs ya la tenian: se manda a la pagina de bodas de Cancun.
// _redirects ya esta en su tope de reglas, por eso va como funcion.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/cancun-wedding-photographer', 'Cache-Control': 'public, max-age=86400' },
  });
