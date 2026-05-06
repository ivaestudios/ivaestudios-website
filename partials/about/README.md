# About / The Studio · page brief

Studio identity page. Editorial. Focused on **process and philosophy**, not
on Vianey's personal bio (that lives on `/vianey-diaz`, owned by Agent 02).

## Files

| Locale | Path                                        |
|--------|---------------------------------------------|
| EN     | `/about.html`         → `/about`            |
| ES     | `/es/acerca-de.html`  → `/es/acerca-de`     |
| CSS    | `styles/_about.css` (imported by `main.css` under "Pages") |

ES filename is `acerca-de.html` to preserve incoming links from
`es/index.html` and the legacy site. A `/es/about` pretty URL can be added
via `_redirects` in a later oleada — TODO.

## Section map

1. `.section--page-hero.section--page-hero--about` — small hero, eyebrow + h1 + lede.
2. `.about-philosophy` — four numbered principles (gold serif numerals).
3. `.about-process` — paragraph block, max-width prose, warm-sand surface.
4. `.about-studio` — definition list (base, areas, gear, delivery, languages, pricing).
5. `.section--editorial-quote` — Bodoni «Direction over moments.» pull-quote on deep-atlantic.
6. `.section--final-cta` — restrained closer, identical to home/10-final-cta.html.

## Schema

EN page emits a `@graph` with these nodes:

- `Organization` `@id="https://ivaestudios.com/#localbusiness"` (with `founder` ref to Vianey)
- `Person` `@id="https://ivaestudios.com/#vianey-ortega"` (short — full bio Person node lives on `/vianey-diaz` once Agent 02 ships it)
- `WebSite`
- `WebPage` typed as `["WebPage", "AboutPage"]`
- `BreadcrumbList`: Home → The Studio

ES page mirrors the structure with `inLanguage: "es"` and Spanish breadcrumb labels.

Aggregate rating intentionally omitted (BRAND.md §9 — TBD by client).
Coordinates are canonical: `20.4785722, -87.0756298`.

## Link map

| From this page → | URL              | Status                            |
|------------------|------------------|-----------------------------------|
| Home             | `/` / `/es/`     | Exists                            |
| Riviera Maya     | `/riviera-maya`  | Exists                            |
| Cancún           | `/cancun`        | Exists                            |
| Los Cabos        | `/los-cabos`     | Exists                            |
| ES counterparts  | `/es/fotografo-*`| Exists                            |
| WhatsApp         | `wa.me/529902046514` | Exact per BRAND.md §9         |
| Email            | `info@ivaestudios.com` | Exact per BRAND.md §9       |
| Tel              | `+52 228 857 0584`     | Exact per BRAND.md §9       |
| Privacy / Terms  | `/privacy`, `/terms`   | TODO — flagged in footer    |
| Contact page     | `/#contact`            | TODO — Agent 21 future      |

## TODOs flagged in markup

- `images/og-about.jpg` — page-specific OG image (1200×630). Falls back to `og-default.jpg` until Agent 30 produces it.
- `/contact` page — Agent 21 (future oleada). Today nav points to `/#contact` and `/es/#contact`.
- `/privacy` and `/terms` — author in later oleada.
- `/es/about` pretty URL — add a `_redirects` entry once orchestrator wires the route.

## Voice notes (BRAND.md §6–7)

- "Direction over moments" is the page's anchor phrase.
- Vetoed clichés ("capture", "freeze time") avoided.
- Italic-gold accent on a single word per block.
- Spanish written authentically, not literally translated from EN.
