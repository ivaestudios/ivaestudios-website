// Estudio Playa Mujeres ya no existe como resort familiar: su URL oficial redirige a Atelier Playa Mujeres
// (solo adultos, 16+, todo el complejo). estudio-playa-mujeres-family-photoshoot -> atelier-playa-mujeres-photoshoot.
// _redirects ya usa sus ~100 reglas. 2026-11-17.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/blog/atelier-playa-mujeres-photoshoot', 'Cache-Control': 'public, max-age=86400' },
  });
