// Direccion vieja que existia en la copia tecnica del sitio y que todavia se pide
// (vista en el registro de robots el 2026-11-11). La pagina de hoy es /marketing-about.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/marketing-about', 'Cache-Control': 'public, max-age=86400' },
  });
