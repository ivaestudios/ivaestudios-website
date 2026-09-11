// Voz IA (solo staff): convierte un texto en audio con la voz de OpenAI
// (gpt-4o-mini-tts). Se usa para narrar videos cuando la voz original no
// convence. La llave es la misma OPENAI_API_KEY del generador de video.
//
//   POST /api/marketing/voz  { texto, voz?, instrucciones?, formato? }
//   → audio/mpeg (o audio/wav si formato='wav')
//
// Límite: 4000 caracteres por llamada (el límite de OpenAI es 4096).

const VOCES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse']);
const FORMATOS = { mp3: 'audio/mpeg', wav: 'audio/wav', opus: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export async function handleVoz(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const key = String(env.OPENAI_API_KEY || '').trim();
  if (!key) return json({ error: 'Falta OPENAI_API_KEY en Cloudflare.' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const texto = String(body.texto || '').trim();
  if (!texto) return json({ error: 'Falta el texto' }, 400);
  if (texto.length > 4000) return json({ error: 'Máximo 4000 caracteres por llamada' }, 400);
  const voz = VOCES.has(body.voz) ? body.voz : 'sage';
  const formato = FORMATOS[body.formato] ? body.formato : 'mp3';
  const instrucciones = String(body.instrucciones || '').trim().slice(0, 1000);
  const velocidad = Math.min(2, Math.max(0.5, Number(body.velocidad) || 1));

  const payload = { model: 'gpt-4o-mini-tts', input: texto, voice: voz, response_format: formato, speed: velocidad };
  if (instrucciones) payload.instructions = instrucciones;

  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => '')).slice(0, 500);
    return json({ error: `OpenAI respondió ${r.status}`, detalle }, 502);
  }
  return new Response(r.body, {
    status: 200,
    headers: { 'Content-Type': FORMATOS[formato], 'Cache-Control': 'no-store', 'X-Voz': voz },
  });
}
