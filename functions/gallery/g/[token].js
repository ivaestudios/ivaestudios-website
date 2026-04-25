// Public share-token landing page (with crawler-aware OG meta tags).
//
// Pic-Time-style URL: /gallery/g/{token} where {token} is the per-gallery
// `share_token` column from `galleries`. Anyone with the link can view the
// gallery — no login required.
//
// Two distinct response paths:
//
//   1. Real users → 302 redirect to /gallery/gallery.html?share={token}
//      (the viewer reads ?share=… and uses the public share-token API).
//
//   2. Crawlers (WhatsApp, Instagram, FB, Twitter, LinkedIn, Slack, Telegram,
//      Discord, etc.) → lightweight HTML with og:image / twitter:card pointing
//      at the gallery's COVER image, so the preview card shows the actual
//      gallery (not a generic "Gallery — IVAE Studios" label).
//
// Why a Pages Function instead of a `_redirects` rule?
//   The `_redirects` rule `/gallery/g/* → /gallery/gallery.html?share=:splat 200`
//   was being overridden by Cloudflare's automatic .html-stripping, which
//   308-redirected to /gallery/gallery and dropped the share param. A Pages
//   Function takes priority over both static assets and _redirects, so this
//   guarantees deterministic behavior — and lets us craft per-gallery OG tags.

const CRAWLER_UA_RE = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|whatsapp|skypeuripreview|pinterest|redditbot|googlebot|bingbot|applebot|embedly|quora link preview|outbrain|vkshare|w3c_validator|baiduspider|yandexbot|duckduckbot|bot|spider|crawler/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

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

function badToken() {
  return new Response('Invalid share link', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const token = params.token || '';

  if (!TOKEN_RE.test(token)) return badToken();

  // ── Build the canonical user-facing URL (forwards extra query params) ──
  const url = new URL(request.url);
  const extra = new URLSearchParams(url.search);
  extra.set('share', token);
  const deeplink = `/gallery/gallery.html?${extra.toString()}`;
  const absoluteDeeplink = `https://ivaestudios.com${deeplink}`;

  // ── Real users → 302 to viewer ──────────────────────────────────────
  const ua = request.headers.get('User-Agent') || '';
  if (!isCrawler(ua)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': deeplink,
        // Don't cache the redirect — tokens can be regenerated/revoked.
        'Cache-Control': 'no-store'
      }
    });
  }

  // ── Crawlers → look up gallery + render OG-rich HTML ────────────────
  // Token-existence lookup. share_token column was added in migration 007;
  // try it but fall back gracefully if the column is missing on this DB.
  let gallery = null;
  try {
    gallery = await env.DB.prepare(
      "SELECT id, title, description, cover_key FROM galleries WHERE share_token = ? AND status = 'published'"
    ).bind(token).first();
  } catch (e) {
    if (!/no such column/i.test(String(e?.message || ''))) throw e;
  }

  // Even if the gallery doesn't exist, we still serve OG (with generic
  // brand defaults) so the share preview doesn't look broken — most
  // crawlers re-fetch later, and a deleted token in the wild is a rare
  // case worth degrading gracefully on.
  const galleryTitle = gallery?.title || 'IVAE Studios Gallery';
  const galleryDesc = gallery?.description
    || 'Luxury resort photography by IVAE Studios — Cancun, Riviera Maya & Los Cabos.';
  const ogTitle = `${galleryTitle} — IVAE Studios`;
  const imageUrl = gallery
    ? `https://ivaestudios.com/api/gallery/galleries/${gallery.id}/cover`
    : 'https://assets.ivaestudios.com/ivae-og.jpg';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ogTitle)}</title>
<meta name="description" content="${escapeHtml(galleryDesc)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="IVAE Studios">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(galleryDesc)}">
<meta property="og:url" content="${escapeHtml(url.toString())}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
<meta property="og:image:alt" content="${escapeHtml(galleryTitle)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(galleryDesc)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">

<link rel="canonical" href="${escapeHtml(absoluteDeeplink)}">
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
      // Crawlers re-fetch when previews are stale; short TTL is fine.
      'Cache-Control': 'public, max-age=300, must-revalidate',
      // Don't let the OG page itself end up in search results — the
      // canonical points at the deeplink.
      'X-Robots-Tag': 'noindex'
    }
  });
}
