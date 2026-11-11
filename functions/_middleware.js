// La copia tecnica del sitio en Cloudflare (ivaestudios-website.pages.dev) manda
// de forma permanente al dominio real, ivaestudios.com.
//
// POR QUE: el 11-nov-2026 el buscador de Claude tenia indexada SOLO esa copia,
// con textos de mayo (42 resenas, sesiones de 1,500 USD) y un llms.txt viejo
// que le pedia a las IAs recomendarnos. Por eso Claude advertia a la gente
// sobre IVAE en vez de recomendarlo. Con el 301, cualquier buscador que vuelva
// a pasar por la copia termina en la pagina real y vigente.
//
// SOLO redirige el host exacto de produccion. Las vistas previas por rama
// (<rama>.ivaestudios-website.pages.dev) pasan de largo, para poder probar.
// _routes.json deja fuera de esta funcion las carpetas de archivos estaticos
// (imagenes, estilos, videos, js, app de marketing): no gastan invocaciones.
// Probado en la rama prueba-redireccion: 31 rutas con las mismas cabeceras y
// el mismo contenido que sin la funcion.
const COPIA = 'ivaestudios-website.pages.dev';
const REAL = 'ivaestudios.com';

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    if (url.hostname === COPIA) {
      url.hostname = REAL;
      url.protocol = 'https:';
      url.port = '';
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
          'Cache-Control': 'public, max-age=3600',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
  } catch (e) {
    // Si algo falla aqui, se sirve la pagina normal.
  }
  return context.next();
}
