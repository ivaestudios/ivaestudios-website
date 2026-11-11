// URL vieja que Google todavia muestra (posicion 3.4, medido 2026-11-11) y daba 404:
// secrets-vs-dreams-resorts-what-s-the-difference-and-which-is-better -> secrets-vs-dreams-resort-wedding-comparison.
// _redirects ya usa sus ~100 reglas, por eso vive aqui.
export const onRequest = () =>
  new Response(null, {
    status: 301,
    headers: { Location: 'https://ivaestudios.com/blog/secrets-vs-dreams-resort-wedding-comparison', 'Cache-Control': 'public, max-age=86400' },
  });
