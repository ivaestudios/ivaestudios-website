// ivaestudios.com/resena -> formulario de Google para dejar una reseña.
// Un enlace corto que se puede dictar, mandar por WhatsApp o imprimir en un QR.
// El destino es el enlace oficial de la ficha (Perfil de Empresa > Pedir reseñas),
// comprobado el 2026-11-11. Va con 302 para poder cambiarlo si Google lo cambia.
export const onRequest = () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: 'https://g.page/r/CYn7yCAibC3xEBM/review',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
