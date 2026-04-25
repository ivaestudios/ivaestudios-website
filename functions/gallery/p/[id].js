// Per-photo Open Graph page.
//
// When a single-photo link is shared on WhatsApp / Instagram / Facebook /
// Twitter / LinkedIn / Slack / Telegram / Discord, the platform's crawler
// fetches the URL and reads OG meta tags to render the preview card. This
// function returns lightweight HTML with og:image / twitter:card pointing
// at the actual photo so the preview shows the photo (not a generic logo).
//
// Real users (non-crawlers) get a 302 redirect to the gallery deeplink so
// they land directly in the lightbox for that photo.
//
// Route: /gallery/p/{photoId}  (Cloudflare Pages Function — co-exists with
// the static /gallery/* assets because Pages Functions take priority over
// static files for matched routes).

const CRAWLER_UA_RE = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|whatsapp|skypeuripreview|pinterest|redditbot|googlebot|bingbot|applebot|embedly|quora link preview|outbrain|vkshare|w3c_validator|baiduspider|yandexbot|duckduckbot|bot|spider|crawler/i;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isCrawler(ua) {
  if (!ua) return false;
  return CRAWLER_UA_RE.test(ua);
}

function notFound() {
  return new Response('Photo not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const photoId = (params.id || '').toLowerCase();

  // Photo IDs are 32-hex (lower(hex(randomblob(16)))). Reject anything else
  // to avoid hitting D1 with garbage.
  if (!/^[a-f0-9]{32}$/.test(photoId)) return notFound();

  // Look up photo + gallery in one go. We only need fields used by the
  // share card — title, description, and what we need to redirect.
  const row = await env.DB.prepare(`
    SELECT p.id          AS photo_id,
           p.gallery_id  AS gallery_id,
           p.filename    AS filename,
           p.width       AS width,
           p.height      AS height,
           g.title       AS gallery_title,
           g.description AS gallery_description,
           g.status      AS gallery_status,
           g.is_private  AS gallery_is_private
    FROM photos p
    JOIN galleries g ON g.id = p.gallery_id
    WHERE p.id = ?
  `).bind(photoId).first();

  if (!row) return notFound();

  const url = new URL(request.url);
  const origin = 'https://ivaestudios.com';

  // Image URL — point at the 2400px web variant. /api/gallery/photos/{id}/web
  // is the public route that serves photos for portfolio-flagged galleries
  // and otherwise enforces session/access. For OG previews this is the
  // intended image; if it's not publicly accessible the crawler will simply
  // get a 403 and fall back, which is fine.
  const imageUrl = `${origin}/api/gallery/photos/${row.photo_id}/web`;

  // Deeplink for real users. share_token lives on the roadmap (see
  // PLAN_MAESTRO.md B1) but is not yet a column — fall back to the
  // authenticated URL with ?photo=PID so the gallery can later auto-open
  // the lightbox.
  const deeplink = `${origin}/gallery/gallery.html?id=${row.gallery_id}&photo=${row.photo_id}`;

  // ── Real users → 302 redirect ──────────────────────────────────────
  const ua = request.headers.get('User-Agent') || '';
  if (!isCrawler(ua)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': deeplink,
        // Never cache the redirect — the deeplink may change once
        // share_token lands, and we want fresh redirects.
        'Cache-Control': 'no-store'
      }
    });
  }

  // ── Crawlers → HTML with OG meta tags ──────────────────────────────
  const galleryTitle = row.gallery_title || 'IVAE Studios Gallery';
  const baseDesc = row.gallery_description
    || 'Luxury resort photography by IVAE Studios — Cancun, Riviera Maya & Los Cabos.';
  const ogTitle = `${galleryTitle} — IVAE Studios`;
  const ogDesc = baseDesc;
  const w = row.width || 1200;
  const h = row.height || 800;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ogTitle)}</title>
<meta name="description" content="${escapeHtml(ogDesc)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="IVAE Studios">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDesc)}">
<meta property="og:url" content="${escapeHtml(url.toString())}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="${escapeHtml(w)}">
<meta property="og:image:height" content="${escapeHtml(h)}">
<meta property="og:image:alt" content="${escapeHtml(row.filename || ogTitle)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDesc)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">

<link rel="canonical" href="${escapeHtml(deeplink)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(deeplink)}">
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(deeplink)}">${escapeHtml(galleryTitle)}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Crawlers re-fetch when previews are stale, so a short TTL is fine.
      'Cache-Control': 'public, max-age=300, must-revalidate',
      // Don't let the OG page itself end up in search results — the
      // canonical points at the deeplink.
      'X-Robots-Tag': 'noindex'
    }
  });
}
