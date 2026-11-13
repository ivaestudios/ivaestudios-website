// Guia publicada el 11-nov-2026 y retirada el 13-nov a peticion del estudio.
// Google ya la tenia en su cola: se manda a la pagina mas cercana.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/surprise-proposal-photographer-cancun', 'Cache-Control': 'public, max-age=86400' },
  });
