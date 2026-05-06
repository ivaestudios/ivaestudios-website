# Service · Family — Page Notes

Owner: Agent 03 (Oleada 3)
Files:
- `/luxury-family-photos.html` — English, lives at `/luxury-family-photos-cancun`
- `/es/fotos-familiares-lujo-cancun.html` — Spanish, lives at the same legacy slug

## URL contract
Existing slugs are preserved to protect inbound SEO. `_redirects` maps:
- `/luxury-family-photos-cancun → /luxury-family-photos 200`  (root .html → clean URL rewrite)
- `/luxury-family-photos.html → /luxury-family-photos-cancun 301`
- ES file is served by Cloudflare Pages directly at `/es/fotos-familiares-lujo-cancun`.

Do not rename either file. The canonical, hreflang and schema URLs all point at the canonical clean URL.

## Section order
1. Page hero (full-bleed image, navy scrim, eyebrow + h1 + lede).
2. The session — `What we plan` / `What we deliver` two-column grid.
3. Locations served — three small destination link cards.
4. Recent family sessions — six-image gallery.
5. FAQ — four service-specific questions, native `<details>` accordion.
6. Final CTA — copied verbatim from `partials/home/10-final-cta.html` (EN/ES).

## Style scope
All visual treatment ships from `styles/_service.css`, registered in `styles/main.css`. The same module powers Couples / Weddings / Maternity / Yacht / Cenote.

## Schema
Single `@graph` with `LocalBusiness`, `WebPage` (subType `ServicePage`), `BreadcrumbList`, `Service` (`category: "Family Photography"`), `ImageObject` for the hero, and an `ItemList` of the three places served. No `aggregateRating` (BRAND.md §9). No prices in copy or schema.
