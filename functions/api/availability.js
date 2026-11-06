// IVAE Studios: horarios libres para reservar en línea
// Cloudflare Pages Function: GET /api/availability?date=YYYY-MM-DD[&collection=the-essential-flow]
//
// Lo usan la página /book (y /es/reservar) y los asistentes de IA antes de reservar con
// POST /api/book. La respuesta viene de Juan (worker ivae-juan, /web/disponibilidad), que
// revisa el calendario sincronizado de info@. Es una guía rápida: la confirmación final la da
// el calendario real al procesar la reserva.

const JUAN = 'https://ivae-juan.vianeydm07.workers.dev';

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || url.searchParams.get('fecha') || '';
  const collection = url.searchParams.get('collection') || url.searchParams.get('coleccion') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: 'date=YYYY-MM-DD is required' }, 400);
  if (!env.RESERVA_WEB_SECRETO) return json({ ok: false, error: 'unavailable' }, 503);
  try {
    const r = await fetch(`${JUAN}/web/disponibilidad?fecha=${encodeURIComponent(date)}&coleccion=${encodeURIComponent(collection)}`, {
      headers: { 'x-reserva-web': env.RESERVA_WEB_SECRETO },
    });
    const d = await r.json().catch(() => ({ ok: false, error: 'invalid response' }));
    if (d && d.ok) d.note = 'Times are in Cancún time (UTC-5). Final confirmation comes with the booking.';
    return json(d, r.status);
  } catch {
    return json({ ok: false, error: 'unavailable' }, 502);
  }
}
