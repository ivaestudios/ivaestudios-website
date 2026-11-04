// El hotel cambio de nombre o era el mismo hotel con otro nombre: breathless-cancun-soul-photoshoot -> amare-cancun-photoshoot.
// _redirects ya usa sus ~100 reglas. 2026-11-04.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/blog/amare-cancun-photoshoot', 'Cache-Control': 'public, max-age=86400' },
  });
