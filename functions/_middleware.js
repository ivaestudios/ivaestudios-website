// Dos trabajos:
//
// 1. La copia tecnica del sitio en Cloudflare (ivaestudios-website.pages.dev)
//    manda de forma permanente al dominio real, ivaestudios.com.
//    POR QUE: el 11-nov-2026 el buscador de Claude tenia indexada SOLO esa copia,
//    con textos de mayo (42 resenas, sesiones de 1,500 USD) y un llms.txt viejo
//    que le pedia a las IAs recomendarnos. Por eso Claude advertia a la gente
//    sobre IVAE en vez de recomendarlo. Con el 301, cualquier buscador que vuelva
//    a pasar por la copia termina en la pagina real y vigente.
//    SOLO redirige el host exacto de produccion. Las vistas previas por rama
//    (<rama>.ivaestudios-website.pages.dev) pasan de largo, para poder probar.
//
// 2. Anota las visitas de los robots de buscadores y de IAs (Claude, ChatGPT,
//    Meta, Perplexity, Google, Bing...). No hay forma de pedirle a Claude que
//    vuelva a leer el sitio: solo se puede ver cuando pasa su robot y que lee.
//    El aviso sale DESPUES de contestar (waitUntil), asi que no retrasa ni puede
//    romper la pagina; si faltan las variables RASTREO_URL y RASTREO_CLAVE, no
//    hace nada. El resumen diario queda en seo/control/ROBOTS_IA.md.
//
// _routes.json deja fuera de esta funcion las carpetas de archivos estaticos
// (imagenes, estilos, videos, js, app de marketing): no gastan invocaciones.
// Probado en la rama prueba-redireccion: 31 rutas con las mismas cabeceras y
// el mismo contenido que sin la funcion.
const COPIA = 'ivaestudios-website.pages.dev';
const REAL = 'ivaestudios.com';

// El orden importa: primero los nombres mas especificos.
const ROBOTS = [
  ['Claude-SearchBot', /Claude-SearchBot/i],
  ['Claude-User', /Claude-User/i],
  ['ClaudeBot', /ClaudeBot/i],
  ['anthropic-ai', /anthropic-ai|Claude-Web/i],
  ['OAI-SearchBot', /OAI-SearchBot/i],
  ['ChatGPT-User', /ChatGPT-User/i],
  ['GPTBot', /GPTBot/i],
  ['Perplexity-User', /Perplexity-User/i],
  ['PerplexityBot', /PerplexityBot/i],
  ['Meta-WebIndexer', /meta-webindexer/i],
  ['Meta-ExternalAgent', /meta-externalagent/i],
  ['Meta-ExternalFetcher', /meta-externalfetcher/i],
  ['Meta-ExternalAds', /meta-externalads/i],
  ['FacebookExternalHit', /facebookexternalhit|FacebookBot/i],
  ['Google-Extended', /Google-Extended/i],
  ['GoogleOther', /GoogleOther/i],
  ['Googlebot', /Googlebot/i],
  ['Bingbot', /bingbot/i],
  ['Applebot', /Applebot/i],
  ['Amazonbot', /Amazonbot/i],
  ['DuckAssistBot', /DuckAssistBot/i],
  ['DuckDuckBot', /DuckDuckBot/i],
  ['Bravebot', /Bravebot/i],
  ['YandexBot', /YandexBot/i],
  ['MistralAI-User', /MistralAI-User/i],
  ['Kagibot', /Kagibot/i],
  ['YouBot', /YouBot/i],
  ['cohere-ai', /cohere-ai/i],
  ['Bytespider', /Bytespider/i],
  ['CCBot', /CCBot/i],
];

function robotDe(ua) {
  for (const [nombre, patron] of ROBOTS) {
    if (patron.test(ua)) return nombre;
  }
  return null;
}

// Solo se anotan paginas publicas. En las rutas privadas (API, galeria de
// clientes, panel, app de marketing) viajan claves y enlaces personales: de esas
// se manda nada mas el primer tramo, y cualquier tramo que parezca una clave
// (largo, sin guiones ni puntos) se borra antes de salir de aqui.
function rutaSegura(ruta) {
  const r = String(ruta || '/');
  const m = /^\/(api|gallery|admin|marketing|cdn-cgi|\.well-known)(?=\/|$)(?:\/([^/]*))?/i.exec(r);
  if (m) {
    const base = m[1].toLowerCase();
    const sub = base === 'api' && m[2] && /^[a-z][a-z0-9-]{0,30}$/i.test(m[2]) ? '/' + m[2] : '';
    return '/' + base + sub;
  }
  return r.split('/').map((t) => (/^[A-Za-z0-9_]{20,}$/.test(t) ? '~' : t)).join('/');
}

function anotar(context, sitio, ruta, estado) {
  try {
    const env = context.env || {};
    if (!env.RASTREO_URL || !env.RASTREO_CLAVE) return;
    const robot = robotDe(context.request.headers.get('user-agent') || '');
    if (!robot) return;
    const cf = context.request.cf || {};
    const aviso = fetch(env.RASTREO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-clave': env.RASTREO_CLAVE },
      body: JSON.stringify({
        robot,
        sitio,
        ruta: rutaSegura(ruta).slice(0, 300),
        estado,
        ip: context.request.headers.get('cf-connecting-ip') || '',
        cat: cf.verifiedBotCategory || '',
        red: String(cf.asOrganization || '').slice(0, 60),
      }),
    }).catch(() => {});
    context.waitUntil(aviso);
  } catch (e) {
    // El registro nunca debe afectar a la pagina.
  }
}

export async function onRequest(context) {
  let url = null;
  try {
    url = new URL(context.request.url);
    if (url.hostname === COPIA) {
      anotar(context, COPIA, url.pathname, 301);
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
  const respuesta = await context.next();
  if (url) anotar(context, url.hostname, url.pathname, respuesta.status);
  return respuesta;
}
