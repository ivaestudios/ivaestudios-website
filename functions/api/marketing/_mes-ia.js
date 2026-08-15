// ============================================================================
// IVAE Marketing — EL ESTRATEGA: la IA que genera el MES completo de una marca.
//
// Etapa 1 del sistema integral ("vamos con todo", Vianey 2026-08-15): un botón
// en el calendario y Claude escribe el mes entero — temas, guiones, captions
// FINALES y hashtags — con la VOZ de la marca aprendida de sus piezas reales.
//
// Reparto de trabajo (espejo de _carrusel-ia.js, el director de arte):
//   · Este módulo SOLO habla con Claude y devuelve piezas saneadas.
//   · El handler en [[path]].js junta el contexto de D1, inserta los posts y
//     registra la actividad — la IA jamás toca la base directamente.
//
// Reglas de la casa que el modelo recibe como ley:
//   · caption = el copy FINAL de Instagram, con emojis y saltos de línea
//     (regla de la casa: campos separados + caption listo para copiar).
//   · CTA de DM DESPUÉS de la pregunta ("...y si quieres X, escríbeme");
//     JAMÁS pedir comentarios.
//   · Carrusel: body en formato "Slide 2 — ...\nSlide 3 — ..." (así lo lee
//     el Estudio con slidesFromPost). Reel: body = desarrollo hablable.
// ============================================================================

const MODELO = 'claude-sonnet-5';

const ESQUEMA = {
  type: 'object',
  properties: {
    piezas: {
      type: 'array',
      description: 'Las piezas del mes, en orden de fecha.',
      items: {
        type: 'object',
        properties: {
          dia: { type: 'integer', description: 'Día del mes (1-31) en que se publica. Repartir a lo largo del mes SIN usar los días ya ocupados.' },
          content_type: { type: 'string', enum: ['reel', 'carrusel', 'post'] },
          title: { type: 'string', description: 'Título interno corto y claro (≤70 caracteres), como los ejemplos de la marca.' },
          hook: { type: 'string', description: 'El gancho que detiene el scroll (≤120 caracteres). En reel es la primera frase hablada; en carrusel es el texto de la portada.' },
          body: { type: 'string', description: 'Reel: el desarrollo del guion, 2-4 frases hablables (~20-35s). Carrusel: "Slide 2 — ...\\nSlide 3 — ..." hasta el slide 6, una línea por slide. Post: 1-2 frases de contexto de la imagen.' },
          cta: { type: 'string', description: 'El cierre accionable (≤120 caracteres).' },
          caption: { type: 'string', description: 'El copy FINAL de Instagram listo para pegar: con emojis, saltos de línea, y el CTA integrado. NO incluir hashtags aquí.' },
          hashtags: { type: 'string', description: '8-14 hashtags relevantes separados por espacio, mezclando locales y de nicho.' },
        },
        required: ['dia', 'content_type', 'title', 'hook', 'body', 'cta', 'caption', 'hashtags'],
      },
    },
  },
  required: ['piezas'],
};

function sistema(marca, mesLabel, n) {
  return `Eres el estratega de contenido senior de IVAE Marketing (agencia en Cancún) para la marca "${marca}". Vas a planear ${n} piezas para ${mesLabel}: contenido que un equipo humano pueda producir tal cual, con la VOZ REAL de la marca (te doy ejemplos reales — imita su tono, su vocabulario y su estructura, no los clichés de agencia).

REGLAS DURAS DE LA CASA:
- Español mexicano natural. PROHIBIDOS los clichés de IA: "desbloquea", "eleva tu", "sumérgete", "descubre el poder", "no te pierdas", emojis de cohete en exceso.
- El caption es el copy FINAL de Instagram: arranca con un gancho propio (puede variar del hook), párrafos cortos separados por saltos de línea, 1-3 emojis bien puestos por párrafo como en los ejemplos, y cierra con el CTA.
- CTA: la invitación al DM va DESPUÉS de plantear el valor o la pregunta, en tono de "...y si quieres X, escríbeme" o "agenda tu valoración". JAMÁS pedir comentarios ni "comenta la palabra".
- Carrusel: el hook es la portada; el body trae "Slide 2 — ..." a "Slide 6 — ..." (una idea por slide, ≤2 frases cada uno, la última puede ser el remate antes del CTA).
- Reel: el body es el DESARROLLO hablable del guion (2-4 frases que una persona dice a cámara en 20-35 segundos), sin acotaciones de producción.
- Variedad: alterna temas (educar, mostrar detrás de cámaras, prueba social, oferta) — máximo una pieza de venta directa por cada 3 educativas.
- Fechas: reparte las piezas a lo largo del mes en días hábiles y sábados, NUNCA en los días que te digo que ya están ocupados, y nunca dos piezas el mismo día.

Entrega SIEMPRE con la herramienta entregar_mes.`;
}

function usuario({ mesLabel, n, mezcla, ejemplos, ocupados, brief }) {
  const partes = [];
  partes.push(`Planea ${n} piezas para ${mesLabel}.`);
  if (brief) partes.push(`BRIEF DE LA DUEÑA (manda sobre todo lo demás): ${brief}`);
  partes.push(`MEZCLA típica de esta marca (síguela salvo que el brief pida otra): ${mezcla}.`);
  if (ocupados.length) partes.push(`Días YA OCUPADOS este mes (no los uses): ${ocupados.join(', ')}.`);
  else partes.push('El mes está vacío: tú eliges los días.');
  partes.push(`VOZ REAL de la marca — sus últimas piezas (tipo | título | gancho | caption):\n${ejemplos}`);
  return partes.join('\n\n');
}

// Saneo duro: la pieza que no cumpla el mínimo se descarta, jamás se inserta
// basura en el calendario de un cliente.
function sanear(input, { year, monthNum, ocupados, n }) {
  const piezas = Array.isArray(input && input.piezas) ? input.piezas : [];
  const diasMes = new Date(year, monthNum, 0).getDate();
  const usados = new Set(ocupados);
  const limpias = [];
  for (const p of piezas) {
    if (!p || typeof p !== 'object') continue;
    const dia = Math.max(1, Math.min(diasMes, Number(p.dia) || 0));
    if (!dia) continue;
    const tipo = ['reel', 'carrusel', 'post'].includes(p.content_type) ? p.content_type : 'reel';
    const title = String(p.title || '').trim().slice(0, 90);
    const caption = String(p.caption || '').trim();
    if (!title || !caption) continue;         // sin título o sin caption no hay pieza
    // Día repetido u ocupado: correr al siguiente día libre del mes.
    let d = dia;
    while (usados.has(d) && d < diasMes) d++;
    while (usados.has(d) && d > 1) d--;
    if (usados.has(d)) continue;
    usados.add(d);
    limpias.push({
      publish_date: `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      content_type: tipo,
      title,
      hook: String(p.hook || '').trim().slice(0, 200),
      body: String(p.body || '').trim(),
      cta: String(p.cta || '').trim().slice(0, 200),
      caption,
      hashtags: String(p.hashtags || '').trim().slice(0, 400),
    });
    if (limpias.length >= n) break;
  }
  limpias.sort((a, b) => a.publish_date.localeCompare(b.publish_date));
  return limpias;
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Genera el plan del mes con Claude.
 * @param {object} env  bindings (necesita ANTHROPIC_API_KEY)
 * @param {object} args { marca, month: 'YYYY-MM', n, brief, ejemplos, mezcla, ocupados: [dias] }
 * @returns {Promise<Array>} piezas saneadas listas para insertar
 */
export async function pedirMes(env, { marca, month, n, brief, ejemplos, mezcla, ocupados }) {
  if (!env.ANTHROPIC_API_KEY) {
    const e = new Error('Falta la llave de Claude (ANTHROPIC_API_KEY) en este proyecto.');
    e.code = 'SIN_LLAVE';
    throw e;
  }
  const [year, monthNum] = month.split('-').map(Number);
  const mesLabel = `${MESES_ES[monthNum - 1]} de ${year}`;
  const cuerpo = {
    model: MODELO,
    max_tokens: 12000,
    system: sistema(marca, mesLabel, n),
    messages: [{ role: 'user', content: usuario({ mesLabel, n, mezcla, ejemplos, ocupados, brief }) }],
    tools: [{
      name: 'entregar_mes',
      description: 'Entrega el plan del mes completo: una pieza por fecha con todos sus textos.',
      input_schema: ESQUEMA,
    }],
    tool_choice: { type: 'tool', name: 'entregar_mes' },
  };

  let ultimo;
  for (let intento = 0; intento < 2; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 1500));
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
        signal: AbortSignal.timeout(120000),   // un mes completo tarda
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ultimo = new Error('No se pudo hablar con Claude: ' + (e && e.message));
      continue;
    }
    if (res.ok) {
      const uso = (data.content || []).find((b) => b.type === 'tool_use');
      if (uso && uso.input) {
        const piezas = sanear(uso.input, { year, monthNum, ocupados, n });
        if (piezas.length) return piezas;
        ultimo = new Error('Claude no devolvió piezas válidas.');
        continue;
      }
      ultimo = new Error('Claude no devolvió el plan en el formato esperado.');
      continue;
    }
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
