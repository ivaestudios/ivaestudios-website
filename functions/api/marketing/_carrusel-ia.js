// ============================================================================
// IVAE Marketing — EL DIRECTOR DE ARTE: la IA que arma el carrusel.
//
// Fase 2 del plan OJO IVAE. Reparto de trabajo deliberado:
//
//   · El FOTÓMETRO (navegador, sin IA) ya midió cada foto y decidió DÓNDE va el
//     texto, con qué tratamiento y cuánto velo. Eso NO se le pregunta al
//     modelo: ningún VLM da hoy coordenadas confiables (el mejor mide 0.181
//     mIoU contra 0.773 de un detector especializado, y la documentación de
//     Anthropic advierte que sus coordenadas "son aproximadas").
//
//   · CLAUDE hace lo que sí hace excelente: mirar las fotos para CURARLAS y
//     ORDENARLAS como historia, y ESCRIBIR el copy — sabiendo de antemano
//     cuántos caracteres caben en la caja que el fotómetro validó. Por eso el
//     texto nunca se desborda ni se encoge feo.
//
// Devuelve JSON con esquema forzado: el modelo no puede contestar otra cosa.
// ============================================================================

const MODELO = 'claude-sonnet-5';          // calidad de dirección de arte
const MODELO_RAPIDO = 'claude-haiku-4-5-20251001';

// Cuántos caracteres caben de verdad en cada slot, medidos sobre el diseño
// aprobado (Outfit, ancho útil 872 px). Se le dan al modelo como límites duros.
const LIMITES = {
  kicker: 26,   // 36px, mayúsculas con tracking .14em → 1 línea
  title: 52,    // 99px peso 275/800 → 2 líneas cómodas, 3 apretadas
  body: 150,    // 42px → hasta 4 líneas
  pill: 42,     // píldora ovalada → 1-2 líneas centradas
};

const ESQUEMA = {
  type: 'object',
  properties: {
    orden: {
      type: 'array',
      description: 'Índices de las fotos recibidas, en el orden narrativo elegido. Solo las que entran al carrusel. Sin repetir.',
      items: { type: 'integer' },
      uniqueItems: true,
    },
    descartadas: {
      type: 'array',
      description: 'Fotos que NO entran, con el motivo en español (repetida, mal encuadrada, no aporta a la historia…).',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, motivo: { type: 'string' } },
        required: ['i', 'motivo'],
      },
    },
    slides: {
      type: 'array',
      description: 'Un objeto por slide, EN EL MISMO ORDEN que `orden`.',
      items: {
        type: 'object',
        properties: {
          rol: { type: 'string', enum: ['portada', 'desarrollo', 'lista', 'dato', 'cierre'] },
          kicker: { type: 'string', description: `Antetítulo en MAYÚSCULAS, máx ${LIMITES.kicker} caracteres. Puede ir vacío.` },
          title: { type: 'string', description: `Título grande, máx ${LIMITES.title} caracteres. Envuelve en **dobles asteriscos** las 1-3 palabras clave (salen en negrita).` },
          body: { type: 'string', description: `Texto de apoyo, máx ${LIMITES.body}. Para listas de 2-3 puntos, sepáralos con " / " (cada uno máx ${LIMITES.pill}).` },
          alt: { type: 'string', description: 'Texto alternativo del slide para accesibilidad y SEO. Describe la imagen, no el texto. Máx 120.' },
        },
        required: ['rol', 'kicker', 'title', 'body', 'alt'],
      },
    },
    caption: { type: 'string', description: 'El copy FINAL de Instagram, listo para pegar, con emojis y saltos de línea. Sin hashtags (van aparte).' },
    hashtags: { type: 'string', description: '8-12 hashtags separados por espacio, empezando con #' },
  },
  required: ['orden', 'descartadas', 'slides', 'caption', 'hashtags'],
};

function sistema(marca, nSlides) {
  return `Eres el director de arte y copywriter de IVAE Estudios, una agencia de marketing en Cancún. Armas un carrusel de Instagram para ${marca || 'la marca'}.

TU TRABAJO, EN ESTE ORDEN:
1. CURAR: mira las fotos y quédate con las MEJORES (máximo ${nSlides}). Está PERFECTO entregar menos slides si alguna foto no aporta: descarta repetidas, mal encuadradas, borrosas o que no sumen a la historia, y di el motivo de cada descarte.
2. ORDENAR: arma una historia. Slide 1 engancha (portada), los de en medio desarrollan, el último cierra con la invitación.
3. ESCRIBIR: el texto de cada slide y el caption completo.

REGLAS DE ESCRITURA (voz de IVAE — respétalas al pie de la letra):
- Español de México, cercano y claro. Tuteo. Cero relleno corporativo.
- NADA de promesas médicas, curas ni resultados garantizados.
- El TÍTULO es corto y con fuerza: envuelve en **asteriscos dobles** las 1-3 palabras que deben ir en negrita. Ejemplo: "Células que **sí** funcionan".
- El CTA del cierre va DESPUÉS de una pregunta, con el tono "y si quieres… escríbeme". NUNCA pidas comentarios ("comenta", "déjame un 🔥"): eso ya no funciona.
- El CAPTION es el copy final de Instagram: con emojis, bullets con ✅ cuando ayuden, y la invitación a DM con ➡️ o 📱. Va SIN hashtags (esos van en su campo).
- Los HASHTAGS: mezcla de marca, nicho y locales de Cancún/Riviera Maya.

REGLAS DURAS DE LONGITUD (si te pasas, el texto se desborda del diseño y hay que rehacerlo):
- kicker ≤ ${LIMITES.kicker} caracteres · title ≤ ${LIMITES.title} · body ≤ ${LIMITES.body} · cada punto de lista ≤ ${LIMITES.pill}
- Cuenta los caracteres antes de responder. Es más importante que sea corto a que sea completo.

LO QUE **NO** DEBES HACER:
- No decidas dónde va el texto ni de qué color: eso ya está medido y resuelto.
- No inventes datos, precios, tiempos ni servicios que no vengan en el brief.`;
}

function usuario(brief, fotos, nSlides) {
  const fichas = fotos.map((f, i) => {
    const p = f.plan || {};
    const zona = p.pos === 'top' ? 'arriba' : p.pos === 'bottom' ? 'abajo' : 'en medio';
    const trato = p.modo === 'oscuro' ? 'texto oscuro sobre zona clara' : p.modo === 'banda' ? 'banda sólida (fondo difícil)' : 'texto blanco';
    return `Foto ${i}: el texto irá ${zona}, con ${trato}${p.semaforo === 'ambar' ? ' — OJO: ' + (p.aviso || 'zona delicada') : ''}.`;
  }).join('\n');
  return `BRIEF: ${brief || '(sin brief: usa lo que veas en las fotos)'}

Quiero HASTA ${nSlides} slides (menos está bien si alguna foto no aporta; mínimo 2).

Lo que YA está resuelto por el sistema (no lo cambies, solo escribe sabiendo esto):
${fichas}

Te mando las fotos en orden. Elige, ordena y escribe.`;
}

/**
 * Llama a Claude con las fotos y devuelve el carrusel completo.
 * @param {object} env  bindings del Worker (necesita ANTHROPIC_API_KEY)
 * @param {object} args { brief, marca, nSlides, fotos: [{b64, mime, plan}] }
 */
export async function pedirCarrusel(env, { brief, marca, nSlides, fotos }) {
  if (!env.ANTHROPIC_API_KEY) {
    const e = new Error('Falta la llave de Claude (ANTHROPIC_API_KEY) en este proyecto.');
    e.code = 'SIN_LLAVE';
    throw e;
  }
  // Tope honesto: jamás pedir más slides que fotos hay (con 1 foto el viejo
  // Math.max(2,…) pedía "las 2 mejores" de una sola — el front ya exige 2).
  const n = Math.min(fotos.length, Math.max(2, Math.min(10, Number(nSlides) || fotos.length)));

  const contenido = [];
  fotos.forEach((f, i) => {
    contenido.push({ type: 'text', text: `Foto ${i}:` });
    contenido.push({
      type: 'image',
      source: { type: 'base64', media_type: f.mime || 'image/jpeg', data: f.b64 },
    });
  });
  contenido.push({ type: 'text', text: usuario(brief, fotos, n) });

  const cuerpo = {
    model: MODELO,
    max_tokens: 4000,
    system: sistema(marca, n),
    messages: [{ role: 'user', content: contenido }],
    tools: [{
      name: 'entregar_carrusel',
      description: 'Entrega el carrusel completo: curaduría, orden, textos por slide y caption.',
      input_schema: ESQUEMA,
    }],
    tool_choice: { type: 'tool', name: 'entregar_carrusel' },
  };

  // Reintentos: la red y los 429/529 son transitorios; los 4xx de verdad no.
  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, intento === 1 ? 1200 : 3500));
    let res, data;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(120000), // 8 fotos + razonamiento tarda
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ultimo = new Error('No se pudo hablar con Claude: ' + (e && e.message));
      continue;
    }
    if (res.ok) {
      const uso = (data.content || []).find((b) => b.type === 'tool_use');
      if (uso && uso.input) return sanear(uso.input, n, fotos.length);
      ultimo = new Error('Claude no devolvió el carrusel en el formato esperado.');
      continue;
    }
    // 4xx que no son 429 = no tiene caso reintentar (llave mala, saldo, etc.)
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      const e = new Error(/credit|billing/i.test(msg)
        ? 'La cuenta de Claude se quedó sin saldo.'
        : `Claude rechazó la petición: ${msg}`);
      e.code = 'FATAL';
      throw e;
    }
    ultimo = new Error(`Claude respondió ${res.status}`);
  }
  throw ultimo || new Error('Claude no respondió.');
}

// El esquema garantiza la FORMA, no la sensatez: aquí se recorta lo que se pasó
// de largo y se descartan índices inventados, para que la UI nunca reciba algo
// que rompa el diseño.
function sanear(out, n, nFotos) {
  const corta = (s, max) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cortado = t.slice(0, max);
    const esp = cortado.lastIndexOf(' ');
    return (esp > max * 0.6 ? cortado.slice(0, esp) : cortado).trim();
  };
  // Deduplicado Y acotado a las fotos reales: un índice repetido creaba slides
  // alias del mismo objeto en el front, y uno fuera de rango desalineaba los
  // textos (auditoría adversaria — el esquema garantiza la forma, no el juicio).
  const orden = [...new Set((Array.isArray(out.orden) ? out.orden : []).map(Number))]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < nFotos).slice(0, n);
  const slides = (Array.isArray(out.slides) ? out.slides : []).slice(0, orden.length).map((s) => ({
    rol: s.rol || 'desarrollo',
    kicker: corta(s.kicker, LIMITES.kicker).toUpperCase(),
    // El título conserva los ** de negrita; el conteo ignora los asteriscos.
    title: corta(s.title, LIMITES.title + 8),
    body: String(s.body || '').includes('/')
      ? String(s.body).split('/').map((x) => corta(x, LIMITES.pill)).filter(Boolean).slice(0, 3).join(' / ')
      : corta(s.body, LIMITES.body),
    alt: corta(s.alt, 120),
  }));
  return {
    orden,
    descartadas: (Array.isArray(out.descartadas) ? out.descartadas : []).slice(0, 12),
    slides,
    caption: String(out.caption || '').slice(0, 2200),
    // Los hashtags se REARMAN: el modelo a veces escribe "#Quintana Roo" y un
    // hashtag con espacio se rompe en Instagram (queda "#Quintana" + basura).
    hashtags: String(out.hashtags || '').split('#').map((t) => t.trim().replace(/\s+/g, ''))
      .filter(Boolean).slice(0, 15).map((t) => '#' + t).join(' ').slice(0, 400),
  };
}

export { LIMITES, MODELO, MODELO_RAPIDO };
