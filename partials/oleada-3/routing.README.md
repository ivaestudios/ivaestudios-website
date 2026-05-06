# Routing & SEO — Oleada 3 reference

Maintained by: Agent 18 (Oleada 3 routing/SEO orchestrator).
Touches: `sitemap.xml`, `_redirects`, `robots.txt`, `llms.txt`.

## Redirect philosophy

We treat URLs as a contract with Google. Every URL that has ever appeared in
search results stays reachable: 301 to the new canonical or 200-rewrite to the
served file. We never drop a URL silently; we redirect it.

Three categories of rules in `_redirects`:

1. **200 internal rewrites** — clean URL → file path. The browser keeps the
   pretty URL; Cloudflare serves the `.html` file underneath. Used for
   `/contact`, `/cenote`, `/journal`, blog post slugs, etc.
2. **301 permanent redirects** — old slug → new slug. Used when we rename a
   page (`/vianey-diaz` → `/vianey-ortega`) or consolidate variants
   (`/photographer-cancun` → `/cancun`). Preserves Google ranking signal.
3. **404 fallback** — anything not matched falls through to `404.html`,
   which is the editorial 404 from Agent 14 (Oleada 2).

Order matters: Cloudflare evaluates top-down, first match wins. Keep
short-alias rewrites before legacy 301s.

## How to add a new page

1. Create the `.html` file at the repo root (or under `/es/` for the Spanish
   mirror).
2. Add a `<url>` entry to `sitemap.xml` with the right priority tier:
   - 1.0 home, 0.9 service/destination, 0.8 secondary, 0.6 blog, 0.5 legal.
   - Always include `<xhtml:link rel="alternate" hreflang="...">` for both
     EN and ES (and `x-default` pointing at EN).
3. If the file path differs from the public URL (e.g. `/contact.html` served
   at `/contact`), add a 200 rewrite in `_redirects`.
4. If the new page replaces an old slug, add a 301 in `_redirects`.
5. Add the page to the nav partial (`partials/nav.html` and the ES variant)
   if it belongs in primary navigation.
6. Update `llms.txt` if the page is part of the canonical service surface.

## Hreflang rules

- Every URL pair (EN ↔ ES) declares **three** alternates: `en`, `es`,
  `x-default`. `x-default` always points at the EN canonical for the
  international audience.
- Hreflang is **bidirectional**. The EN page must list the ES alternate
  and vice versa. Asymmetric hreflang is silently ignored by Google.
- Use absolute URLs (`https://ivaestudios.com/...`) in the sitemap, never
  relative paths.

## Files at a glance

| File | Format | Purpose |
|---|---|---|
| `sitemap.xml` | XML 0.9 + xhtml namespace | 92 URL entries (46 EN + 46 ES). Submitted to Google Search Console. |
| `_redirects` | Cloudflare Pages | `/source /target [status]` — 200 rewrites + 301 redirects. |
| `robots.txt` | RFC 9309 | Default-allow with `/admin`, `/api/*`, `/gallery/*` disallowed. |
| `llms.txt` | Markdown | Concise machine-readable site summary for LLM crawlers. |

## Out of scope (per BRAND.md §11)

The `gallery/` sub-app is a separate Cloudflare Pages Function surface. We
disallow `/gallery/` in `robots.txt` because it is the client-only deliverable
gallery, not part of the marketing site. Do not add gallery URLs to
`sitemap.xml`.
