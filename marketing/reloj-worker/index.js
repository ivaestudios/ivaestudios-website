// EL RELOJ: cada 10 minutos toca el timbre público de la app de marketing.
// El timbre solo dispara el lazySweep de siempre (throttled + idempotente),
// que publica las piezas programadas cuya hora ya llegó.
export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      fetch('https://ivaestudios.com/api/marketing/tick', { method: 'POST' })
        .catch(() => {})
    );
  },
  // Visita manual para verificar que el reloj vive.
  async fetch() {
    const r = await fetch('https://ivaestudios.com/api/marketing/tick', { method: 'POST' })
      .then((x) => x.text()).catch((e) => 'error: ' + e.message);
    return new Response('reloj vivo → ' + r, { headers: { 'content-type': 'text/plain' } });
  },
};
