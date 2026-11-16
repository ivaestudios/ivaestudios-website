// Era el mismo hotel con otro nombre: "Las Arenas Reales" solo es la etiqueta que un visitante puso en
// OpenStreetMap (2024) a la mitad norte (Fase 2) de The Royal Sands, km 13.5, segun el plano oficial.
// las-arenas-reales-cancun-photoshoot -> the-royal-sands-cancun-family-photo-session-guide.
// _redirects ya usa sus ~100 reglas. 2026-11-16.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/blog/the-royal-sands-cancun-family-photo-session-guide', 'Cache-Control': 'public, max-age=86400' },
  });
