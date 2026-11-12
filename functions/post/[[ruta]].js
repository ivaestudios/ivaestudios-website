// Direcciones del blog viejo, con la forma /post/titulo. El sitio ya no las usa,
// pero el robot de Meta las sigue pidiendo y hay publicaciones viejas de Facebook
// e Instagram que enlazan ahi. Vistas en el registro de robots el 2026-11-11.
//
// 1. Las conocidas van a su pagina de hoy (MAPA).
// 2. Si existe una guia con el mismo nombre en /blog/, va ahi.
// 3. Si no, sale el "no encontrado" de siempre. No se adivina.
//
// Para sumar otra: mirar "Direcciones que no existen" en seo/control/ROBOTS_IA.md
// y agregarla al MAPA.
const MAPA = {
  'best-photo-locations-cancun': '/cancun-photo-spots',
  'maternity-photoshoot-in-cancun-riviera-maya-your-complete-guide-2026': '/blog/maternity-photoshoot-cancun-riviera-maya',
};

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const nombre = decodeURIComponent(url.pathname.replace(/^\/post\//, '').replace(/\/+$/, '')).toLowerCase();
    let destino = MAPA[nombre];
    if (!destino && /^[a-z0-9-]{3,120}$/.test(nombre)) {
      const guia = await context.env.ASSETS.fetch(new URL('/blog/' + nombre, url));
      if (guia.status === 200) destino = '/blog/' + nombre;
    }
    if (destino) {
      return new Response(null, {
        status: 301,
        headers: { Location: 'https://ivaestudios.com' + destino, 'Cache-Control': 'public, max-age=86400' },
      });
    }
  } catch (e) {
    // Si algo falla, sale el "no encontrado" normal.
  }
  return context.next();
}
