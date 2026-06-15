// ============================================================================
// IVAE Marketing — módulo enterprise.
// Única función viva: handleMonthlyReport (reporte mensual imprimible).
// El resto del pack (IA, .ics, duplicar mes, plantillas, link mágico, email)
// se desechó a petición de Vianey el 2026-06-12.
// Módulo separado de [[path]].js; el guion bajo evita que Pages lo trate
// como ruta.
// ============================================================================

// ── Reporte mensual del cliente (imprimible / compartible) ──────────────────
// GET /report?client_id&month=YYYY-MM — HTML con el branding de la marca.

const REP_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const REP_STATUS = {
  idea: 'Idea', guion: 'Guion', grabacion: 'Grabación', edicion: 'Edición',
  revision: 'Revisión', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado',
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function handleMonthlyReport(request, env, session, url, igFetcher = null, manualFetcher = null) {
  let clientId = url.searchParams.get('client_id') || '';
  if (session.role === 'client') clientId = session.client_id;
  const month = String(url.searchParams.get('month') || '');
  if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('client_id y month (AAAA-MM) requeridos', { status: 400 });
  }
  const client = await env.DB.prepare('SELECT * FROM mkt_clients WHERE id = ?').bind(clientId).first();
  if (!client) return new Response('Cliente no encontrado', { status: 404 });

  const res = await env.DB.prepare(
    'SELECT * FROM mkt_posts WHERE client_id = ? AND publish_date LIKE ? ORDER BY publish_date, position'
  ).bind(clientId, `${month}-%`).all();
  const posts = res.results || [];

  const [y, m] = month.split('-').map(Number);
  const label = `${REP_MONTHS[(m || 1) - 1]} ${y}`;
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(client.brand_color || '') ? client.brand_color : '#7c3aed';
  const byType = {};
  let publicados = 0;
  for (const p of posts) {
    const t = p.content_type || 'otro';
    byType[t] = (byType[t] || 0) + 1;
    if (p.status === 'publicado') publicados += 1;
  }
  const plural = { reel: 'reels', foto: 'fotos', carrusel: 'carruseles', historia: 'historias' };
  const typeChips = Object.entries(byType)
    .map(([t, n]) => `<span class="chip">${n} ${esc(n === 1 ? t : (plural[t] || t))}</span>`).join('');

  const rows = posts.map((p) => `
    <article class="post">
      <div class="post__head">
        <span class="post__date">${esc(String(p.publish_date).slice(8, 10))} ${esc(REP_MONTHS[(m || 1) - 1]).slice(0, 3)}</span>
        <span class="post__type">${esc(p.content_type || 'post')}</span>
        <span class="post__status" data-s="${esc(p.status)}">${esc(REP_STATUS[p.status] || p.status || '')}</span>
      </div>
      <h3>${esc(p.title || 'Sin título')}</h3>
      ${p.caption ? `<p class="post__cap">${esc(String(p.caption).slice(0, 400))}${String(p.caption).length > 400 ? '…' : ''}</p>` : ''}
    </article>`).join('\n');

  // Resultados de Instagram. Prioridad: API conectada con datos; si no, la
  // captura manual del mes. Nunca truena el reporte.
  let igHtml = '';
  const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));
  const monthWord = label.split(' ')[0];
  // Demografía de audiencia (nivel cuenta): barras de género, edad y ciudades.
  const demoLabel = (k) => ({ M: 'Hombres', F: 'Mujeres', U: 'Sin dato' }[k] || k);
  const demoBars = (list, { sortByValue = true, top = 0 } = {}) => {
    if (!Array.isArray(list) || !list.length) return '';
    let rows = [...list];
    if (sortByValue) rows.sort((a, b) => (b.value || 0) - (a.value || 0));
    else rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
    if (top) rows = rows.slice(0, top);
    const total = list.reduce((s, x) => s + (x.value || 0), 0) || 1;
    return rows.map((x) => {
      const p = Math.round((x.value || 0) / total * 100);
      return `<div class="aud__row"><span class="aud__k">${esc(demoLabel(x.key))}</span><div class="aud__bar"><i style="width:${p}%"></i></div><span class="aud__v">${p}%</span></div>`;
    }).join('');
  };
  const audienceHtml = (aud) => {
    if (!aud || (!aud.gender && !aud.age && !aud.city)) return '';
    let out = '<h2 class="igh">Tu audiencia</h2>';
    if (aud.gender) out += `<div class="aud">${demoBars(aud.gender)}</div>`;
    if (aud.age) out += `<h3 class="aud__h">Edad</h3><div class="aud">${demoBars(aud.age, { sortByValue: false })}</div>`;
    if (aud.city) out += `<h3 class="aud__h">Ciudades top</h3><div class="aud">${demoBars(aud.city, { top: 5 })}</div>`;
    return out;
  };
  // Rendimiento por video: cada post del mes con sus métricas.
  const typeLabel = (t) => ({ REELS: 'Reel', VIDEO: 'Video', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Foto', FEED: 'Post' }[t] || 'Post');
  const fmtSec = (s) => (s == null ? null : (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`));
  const postsHtml = (posts) => {
    if (!Array.isArray(posts) || !posts.length) return '';
    const vm = (lbl, val) => (val == null ? '' : `<span class="vm"><b>${fmtN(val)}</b> ${lbl}</span>`);
    const rows = posts.map((p) => {
      const day = String(p.timestamp || '').slice(8, 10);
      const watch = fmtSec(p.avg_watch);
      return `<article class="vid">
      <div class="vid__head"><span class="vid__type">${esc(typeLabel(p.type))}</span><span class="vid__date">${day ? esc(day + ' ' + monthWord) : ''}</span>${p.permalink ? `<a class="vid__link" href="${esc(p.permalink)}" target="_blank" rel="noopener">ver ↗</a>` : ''}</div>
      ${p.caption ? `<p class="vid__cap">${esc(p.caption)}</p>` : ''}
      <div class="vid__metrics">${vm('vistas', p.views)}${vm('alcance', p.reach)}${vm('me gusta', p.likes)}${vm('comentarios', p.comments)}${vm('guardados', p.saved)}${vm('compartidos', p.shares)}${watch ? `<span class="vm"><b>${watch}</b> visto prom.</span>` : ''}</div>
    </article>`;
    }).join('\n');
    return `<h2 class="igh">Rendimiento por video (${posts.length})</h2><div class="vids">${rows}</div>`;
  };
  try {
    let used = false;
    if (igFetcher) {
      const ig = await igFetcher(env, clientId, month);
      if (ig && ig.connected && ig.data && !ig.error) {
        const mm = (ig.data.months || {})[month] || { posts: 0, likes: 0, comments: 0 };
        igHtml = `
  <h2 class="igh">Resultados en Instagram${ig.username ? ' · @' + esc(ig.username) : ''}</h2>
  <div class="stats">
    <span class="chip chip--hero">${fmtN(ig.data.followers)} seguidores</span>
    <span class="chip">${fmtN(ig.data.reach_28d)} alcance (28 días)</span>
    <span class="chip">${fmtN(mm.likes + mm.comments)} interacciones del mes</span>
    <span class="chip">${fmtN(mm.posts)} publicados en IG</span>
  </div>
  ${audienceHtml(ig.data.audience)}
  ${postsHtml(ig.data.posts)}`;
        used = true;
      }
    }
    if (!used && manualFetcher) {
      const man = await manualFetcher(env, clientId, month);
      if (man) {
        igHtml = `
  <h2 class="igh">Resultados en Instagram</h2>
  <div class="stats">
    <span class="chip chip--hero">${fmtN(man.followers)} seguidores</span>
    <span class="chip">${fmtN(man.reach)} alcance del mes</span>
    <span class="chip">${fmtN(man.interactions)} interacciones</span>
    <span class="chip">${fmtN(man.posts)} publicaciones</span>
  </div>`;
      }
    }
  } catch { /* el reporte sale aunque IG falle */ }

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reporte ${esc(label)} · ${esc(client.name)}</title>
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; margin: 0; }
  body { font: 15px/1.55 -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a24; background: #f6f6f9; padding: 0 0 48px; }
  .band { height: 8px; background: var(--accent); }
  .wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px; }
  header.rep { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
  header.rep img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
  header.rep .logo-fallback { width: 56px; height: 56px; border-radius: 12px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 24px; font-weight: 800; }
  h1 { font-size: 22px; } .sub { color: #666; margin-bottom: 20px; }
  .igh { font-size: 15px; margin: 4px 0 10px; color: #444; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; }
  .chip { background: #fff; border: 1px solid #e3e3ec; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; }
  .chip--hero { background: var(--accent); color: #fff; border-color: transparent; }
  .post { background: #fff; border: 1px solid #e7e7f0; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; break-inside: avoid; }
  .post__head { display: flex; gap: 10px; align-items: center; font-size: 12.5px; margin-bottom: 6px; }
  .post__date { font-weight: 700; color: var(--accent); text-transform: uppercase; }
  .post__type { text-transform: uppercase; letter-spacing: .04em; color: #888; font-weight: 700; }
  .post__status { margin-left: auto; font-weight: 600; color: #555; background: #f0f0f6; border-radius: 999px; padding: 2px 10px; }
  .post__status[data-s="publicado"], .post__status[data-s="aprobado"] { background: #e5f7ec; color: #177245; }
  h3 { font-size: 16px; margin-bottom: 4px; }
  .post__cap { color: #555; font-size: 13.5px; white-space: pre-wrap; }
  .aud { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }
  .aud__h { font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; color: #888; margin: 6px 0 8px; }
  .aud__row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .aud__k { flex: 0 0 92px; color: #444; font-weight: 600; }
  .aud__bar { flex: 1; height: 9px; background: #ececf3; border-radius: 999px; overflow: hidden; }
  .aud__bar i { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
  .aud__v { flex: 0 0 38px; text-align: right; font-weight: 700; color: #333; }
  .vids { display: flex; flex-direction: column; gap: 10px; margin-bottom: 26px; }
  .vid { background: #fff; border: 1px solid #e7e7f0; border-radius: 14px; padding: 13px 16px; break-inside: avoid; }
  .vid__head { display: flex; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 5px; }
  .vid__type { background: var(--accent); color: #fff; border-radius: 999px; padding: 2px 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; font-size: 11px; }
  .vid__date { color: #888; font-weight: 700; text-transform: uppercase; }
  .vid__link { margin-left: auto; color: var(--accent); font-weight: 600; text-decoration: none; }
  .vid__cap { color: #555; font-size: 13px; margin-bottom: 8px; }
  .vid__metrics { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .vm { font-size: 12.5px; color: #666; } .vm b { color: #1a1a24; font-weight: 700; }
  footer { margin-top: 30px; text-align: center; color: #999; font-size: 12.5px; }
  .printbtn { position: fixed; right: 18px; bottom: 18px; background: var(--accent); color: #fff; border: 0; border-radius: 999px; padding: 12px 20px; font: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
  @media print { .printbtn { display: none; } body { background: #fff; } .post { border-color: #ddd; } }
</style></head><body>
<div class="band"></div>
<div class="wrap">
  <header class="rep">
    ${client.logo_url ? `<img src="${esc(client.logo_url)}" alt="">` : `<div class="logo-fallback">${esc((client.name || '?').charAt(0).toUpperCase())}</div>`}
    <div>
      <h1>${esc(client.name)}</h1>
      <div class="sub">Reporte de contenido · ${esc(label.charAt(0).toUpperCase() + label.slice(1))}</div>
    </div>
  </header>
  <div class="stats">
    <span class="chip chip--hero">${posts.length} contenidos</span>
    <span class="chip">${publicados} publicados</span>
    ${typeChips}
  </div>
  ${igHtml}
  ${rows || '<p style="color:#888">Este mes no tiene contenidos.</p>'}
  <footer>Generado por IVAE Marketing · ivaestudios.com</footer>
</div>
<button class="printbtn" onclick="print()">Imprimir / PDF</button>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
