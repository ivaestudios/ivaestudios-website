// Public share-token landing page.
//
// Pic-Time-style URL: /gallery/g/{token} where {token} is the per-gallery
// `share_token` column from `galleries`. Anyone with the link can view the
// gallery — no login required (the gallery viewer reads ?share=… from the
// query string and uses the public share-token API to fetch photos).
//
// Why a Pages Function instead of a `_redirects` rule?
//   The `_redirects` rule `/gallery/g/* → /gallery/gallery.html?share=:splat 200`
//   was being overridden by Cloudflare's automatic .html-stripping, which
//   308-redirected to /gallery/gallery and lost the share param. A Pages
//   Function takes priority over both static assets and _redirects, so this
//   guarantees deterministic behavior.
//
// Behavior:
//   - Token-shape valid (8–64 chars, hex/url-safe) → 302 to viewer with ?share={token}
//   - Token-shape invalid → 404
// We don't validate token existence here; the viewer's API call
// (/api/gallery/galleries/share/{token}) returns 404 for unknown tokens
// and the viewer renders an error state. Doing the lookup here would only
// duplicate work and add a D1 hop to every share-link click.
//
// Crawlers still get the redirect — for richer OG previews on shared
// gallery links, layer in a B4-style HTML response above the redirect later.

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function onRequestGet(context) {
  const { params } = context;
  const token = params.token || '';

  if (!TOKEN_RE.test(token)) {
    return new Response('Invalid share link', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // Forward any extra query params from the original URL (e.g. ?photo=PID
  // for deep-linking into a specific photo from a per-photo OG page).
  const url = new URL(context.request.url);
  const extra = new URLSearchParams(url.search);
  // share is the canonical key the viewer reads
  extra.set('share', token);
  const target = `/gallery/gallery.html?${extra.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': target,
      // Don't cache the redirect — share tokens can be regenerated/revoked,
      // and we want fresh resolution every visit.
      'Cache-Control': 'no-store'
    }
  });
}
