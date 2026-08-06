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
          pos: {
            type: 'string', enum: ['top', 'mid', 'bottom'],
            description: 'Dónde va el bloque de texto EN ESTA FOTO. Mira la imagen: elige la zona que NO tape caras, bocas, ojos ni el producto, y que tenga el fondo más tranquilo (pared, cielo, desenfoque, ropa lisa). La sugerencia medida viene en la ficha de la foto: respétala salvo que caiga sobre una cara.',
          },
          kicker: { type: 'string', description: `Antetítulo en MAYÚSCULAS, máx ${LIMITES.kicker} caracteres. Puede ir vacío.` },
          title: { type: 'string', description: `Título grande, máx ${LIMITES.title} caracteres. Envuelve en **dobles asteriscos** las 1-3 palabras clave (salen en negrita).` },
          body: { type: 'string', description: `Texto de apoyo, máx ${LIMITES.body}. Para listas de 2-3 puntos, sepáralos con " / " (cada uno máx ${LIMITES.pill}).` },
          alt: { type: 'string', description: 'Texto alternativo del slide para accesibilidad y SEO. Describe la imagen, no el texto. Máx 120.' },
          acento: { type: 'string', description: 'UNA palabra DEL TITULAR (copiada tal cual, sin cambiarla) que merece el acento en serif cursiva: la palabra EMOCIONAL o de marca (el beneficio, el tratamiento, el sentimiento), no un conector ni un número. Vacío si el titular no tiene una palabra digna.' },
        },
        required: ['rol', 'pos', 'kicker', 'title', 'body', 'alt'],
      },
    },
    caption: { type: 'string', description: 'El copy FINAL de Instagram, listo para pegar, con emojis y saltos de línea. Sin hashtags (van aparte).' },
    hashtags: { type: 'string', description: '8-12 hashtags separados por espacio, empezando con #' },
  },
  required: ['orden', 'descartadas', 'slides', 'caption', 'hashtags'],
};

function sistema(marca, nSlides, soloDirigir) {
  if (soloDirigir) {
    return `Eres el DIRECTOR DE ARTE de IVAE Estudios, agencia de marketing en Cancún. Armas un carrusel de Instagram para ${marca || 'la marca'}.

Los TEXTOS ya están escritos y APROBADOS por la dueña: cada foto trae el suyo. NO los cambies, NO los recortes, NO los "mejores". Devuélvelos EXACTAMENTE como te llegan (kicker, title con sus **asteriscos**, body). El orden de las fotos también está decidido: devuélvelo idéntico (0,1,2,…) y sin descartar ninguna.

TU ÚNICO TRABAJO ES DIRIGIR, mirando cada foto de verdad:
1. \`pos\` (top / mid / bottom) por slide: el bloque de texto JAMÁS sobre una cara, una boca, ojos, ni sobre el objeto clave de la foto (un producto, una manzana mordida, un alineador). Caras arriba → texto abajo. Busca la zona tranquila: pared, cielo, desenfoque, ropa lisa. La ficha de cada foto trae la sugerencia medida por el fotómetro: úsala de punto de partida y corrígela si tapa algo que importa.
2. AVISOS de dirección: si una foto contradice el mensaje (p. ej. brackets metálicos en un anuncio de alineadores), está borrosa, repetida o va a pelear con el texto, dilo en \`descartadas\` usando su índice y el motivo — la dueña decide si la cambia. NO la quites del orden.
3. COHERENCIA que solo tú puedes ver (también va en \`descartadas\`, como aviso):
   - CASTING foto↔servicio: la edad y el sujeto de la foto deben corresponder al tratamiento del texto (un niño ilustrando All-on-4 o coronas está MAL; una adulta cerrando una serie infantil, también).
   - TITULAR↔BAJADA del mismo servicio: si el título dice Invisalign y la bajada habla de carillas, avísalo.
   - GRAMÁTICA VISIBLE: concordancias raras que quedarán horneadas en la imagen ("coronas y más diseñado") — avísalo, sin corregir el texto.
4. El \`alt\` de accesibilidad sí lo escribes tú (describe la imagen).
5. El \`acento\`: elige en cada titular LA palabra que merece la cursiva serif de la marca — la emocional o de marca (sonrisa, confianza, Invisalign), no un conector ni la que quedó al final por accidente. Cópiala EXACTA del titular.
El caption y hashtags devuélvelos vacíos ("") — ya existen.`;
  }
  return `Eres el director de arte y copywriter de IVAE Estudios, una agencia de marketing en Cancún. Armas un carrusel de Instagram para ${marca || 'la marca'}.

TU TRABAJO, EN ESTE ORDEN:
1. CURAR: mira las fotos y quédate con las MEJORES (máximo ${nSlides}). Está PERFECTO entregar menos slides si alguna foto no aporta: descarta repetidas, mal encuadradas, borrosas o que no sumen a la historia, y di el motivo de cada descarte.
2. ORDENAR: arma una historia. Slide 1 engancha (portada), los de en medio desarrollan, el último cierra con la invitación. Regla de oro del reparto: cada texto en la foto que lo aguanta — los títulos largos van en las fotos con zonas lisas u oscuras; una foto muy clara y llena de detalle recibe el texto más corto.
3. DIRIGIR: para cada slide elige \`pos\` (top / mid / bottom) MIRANDO la foto. El bloque de texto JAMÁS sobre una cara, una boca o el producto; búscale la zona tranquila (pared, cielo, desenfoque, ropa lisa, sombra natural). La ficha de cada foto trae la sugerencia medida por el fotómetro: úsala de punto de partida y corrígela si tapa algo que importa.
4. ESCRIBIR: el texto de cada slide y el caption completo.

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
- No decidas el COLOR ni el tratamiento del texto: eso está medido (tú solo decides la posición).
- No inventes datos, precios, tiempos ni servicios que no vengan en el brief.`;
}

function usuario(brief, fotos, nSlides, textos) {
  if (textos && textos.length) {
    const fichas = fotos.map((f, i) => {
      const p = f.plan || {};
      const t = textos[i] || {};
      const zona = p.pos === 'top' ? 'arriba' : p.pos === 'bottom' ? 'abajo' : 'en medio';
      return `Foto ${i} — sugerencia medida: texto ${zona}${p.semaforo === 'ambar' ? ' (OJO: ' + (p.aviso || 'zona delicada') + ')' : ''}.
  Su texto aprobado → kicker: "${t.kicker || ''}" · title: "${t.title || ''}" · body: "${t.body || ''}"`;
    }).join('\n');
    return `Carrusel de ${nSlides} slides, textos YA aprobados (no los toques).

${fichas}

Mira cada foto y DIRIGE: pos por slide + avisos si alguna foto está mal elegida.`;
  }
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
export async function pedirCarrusel(env, { brief, marca, nSlides, fotos, textos }) {
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
  contenido.push({ type: 'text', text: usuario(brief, fotos, n, textos) });

  const cuerpo = {
    model: MODELO,
    max_tokens: 4000,
    system: sistema(marca, n, !!(textos && textos.length)),
    messages: [{ role: 'user', content: contenido }],
    tools: [{
      name: 'entregar_carrusel',
      description: 'Entrega el carrusel completo: curaduría, orden, textos por slide y caption.',
      input_schema: ESQUEMA,
    }],
    tool_choice: { type: 'tool', name: 'entregar_carrusel' },
  };

  // Reintentos con PRESUPUESTO: el front corta a los 180 s, así que gastar
  // hasta ~365 s en reintentos era pagar generaciones que nadie iba a ver.
  // Cada intento solo arranca si le queda tiempo real de terminar.
  const t0 = Date.now();
  const PRESUPUESTO = 165000;   // margen para que la respuesta alcance a salir
  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, intento === 1 ? 1200 : 3500));
    const queda = PRESUPUESTO - (Date.now() - t0);
    if (queda < 25000) break;   // no alcanza ni para el intento más rápido
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
        signal: AbortSignal.timeout(Math.min(120000, queda)), // 8 fotos tardan
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ultimo = new Error('No se pudo hablar con Claude: ' + (e && e.message));
      continue;
    }
    if (res.ok) {
      const uso = (data.content || []).find((b) => b.type === 'tool_use');
      if (uso && uso.input) return sanear(uso.input, n, fotos.length, !!(textos && textos.length));
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
function sanear(out, n, nFotos, soloDirigir) {
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
    // La dirección de arte de la IA: dónde va el texto EN ESA foto (vio caras
    // y zonas tranquilas que el fotómetro solo intuye por contraste).
    pos: ['top', 'mid', 'bottom'].includes(s.pos) ? s.pos : null,
    kicker: corta(s.kicker, LIMITES.kicker).toUpperCase(),
    // El título conserva los ** de negrita; el conteo ignora los asteriscos.
    title: corta(s.title, LIMITES.title + 8),
    body: String(s.body || '').includes('/')
      ? String(s.body).split('/').map((x) => corta(x, LIMITES.pill)).filter(Boolean).slice(0, 3).join(' / ')
      : corta(s.body, LIMITES.body),
    alt: corta(s.alt, 120),
    // El acento solo vale si es UNA palabra que de verdad vive en el titular.
    acento: (() => {
      const a = String(s.acento || '').trim();
      if (!a || /\s/.test(a)) return '';
      return String(s.title || '').toLowerCase().includes(a.toLowerCase()) ? a : '';
    })(),
  }));
  // Las descartadas se RECONCILIAN con `orden`: un índice inventado o una foto
  // que sí entró al carrusel confundían la lista de "fotos que dejé fuera".
  // EXCEPTO en modo dirigir (textos aprobados): ahí TODA foto sigue en el
  // orden por contrato, y las "descartadas" son AVISOS de dirección (casting,
  // coherencia, gramática) — filtrarlas por estar dentro las mataba TODAS y
  // la dueña nunca veía un solo aviso (cazado 2026-08-06).
  const dentro = new Set(orden);
  const descartadas = (Array.isArray(out.descartadas) ? out.descartadas : [])
    .map((d) => ({ i: Number(d && d.i), motivo: corta(d && d.motivo, 160) }))
    .filter((d) => Number.isInteger(d.i) && d.i >= 0 && d.i < nFotos && (soloDirigir || !dentro.has(d.i)))
    .slice(0, 12);
  // Y las que ni entraron ni se explicaron: se nombran igual, sin motivo
  // inventado. Callarlas era lo único inaceptable.
  for (let i = 0; i < nFotos && descartadas.length < 12; i++) {
    if (!dentro.has(i) && !descartadas.some((d) => d.i === i)) {
      descartadas.push({ i, motivo: 'No entró en la historia final.' });
    }
  }
  return {
    orden,
    descartadas,
    slides,
    // Saltos de línea REALES: el modelo a veces escribe la secuencia \n literal
    // (barra + ene) y así se pegaría en Instagram, con la barra a la vista.
    caption: String(out.caption || '')
      .replace(/\\r\\n|\\n|\\r/g, '\n')   // "\n" literal → salto real
      .replace(/\n{3,}/g, '\n\n')             // nunca más de un renglón en blanco
      .trim().slice(0, 2200),
    // Los hashtags se REARMAN: el modelo a veces escribe "#Quintana Roo" y un
    // hashtag con espacio se rompe en Instagram (queda "#Quintana" + basura).
    hashtags: String(out.hashtags || '').split('#').map((t) => t.trim().replace(/\s+/g, ''))
      .filter(Boolean).slice(0, 15).map((t) => '#' + t).join(' ').slice(0, 400),
  };
}

export { LIMITES, MODELO, MODELO_RAPIDO };
