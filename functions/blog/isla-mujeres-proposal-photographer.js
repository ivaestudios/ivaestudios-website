// Guia publicada el 11-nov-2026 y retirada el 13-nov a peticion del estudio.
// Desde el 23-nov-2026 manda a la pagina de servicio /isla-mujeres-proposal-photographer.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/isla-mujeres-proposal-photographer', 'Cache-Control': 'public, max-age=86400' },
  });
