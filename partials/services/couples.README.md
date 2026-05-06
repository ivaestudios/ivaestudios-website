# Couples service page · build notes

Files this Oleada (3/04) ships:

- `couples-photography.html` (root, EN) — canonical: `/couples-photography-mexico`
- `es/fotografia-parejas-mexico.html` (ES) — canonical: `/es/fotografia-parejas-mexico`

Both pages use the **service-page template** introduced by Oleada 3 (Agent 03 family + Agent 04 couples).

## Template sections (in order)

1. Page hero — service variant, full-bleed dark image + scrim
2. Crumb strip (Home → Services → Couples)
3. Service detail — two-column: editorial body + structured `<dl>` aside
4. Service locations — three regions, picked for tone, not popularity
5. Service gallery — 6 frames, 3-up grid with one feature + one tall
6. Service FAQ — exactly 4 couples-specific concerns
7. Final CTA — same closer used across the redesign
8. Shared footer

## CSS strategy

Page-specific service rules live **inline** in `<head>`. They are flagged
with the comment `will deduplicate to _service.css after Oleada 3 merge`.
Once Agent 03's `styles/_service.css` lands, both pages move their inline
rules into that shared module and the inline `<style>` block is reduced to
just the skip-link.

The page reuses these existing modules at runtime via `styles/main.css`:
`_tokens.css`, `_base.css`, `_buttons.css`, `_nav.css`, `_footer.css`,
`_animations.css`, `_home-faq.css` (for `.faq-item`), and the final-CTA
rules from `_home-final-cta.css`.

## Schema graph

`LocalBusiness` + `WebPage[ServicePage]` + `BreadcrumbList` + `Service`
(`category: "Couples Photography"`) + `FAQPage`. `aggregateRating` is
intentionally omitted per BRAND.md §9 until the client confirms numbers.

## Slugs (preserved)

- EN: `/couples-photography-mexico` (Cloudflare rewrite → `couples-photography.html`)
- ES: `/es/fotografia-parejas-mexico`

Do not rename. `_redirects` already maps a half-dozen legacy slugs to the
EN canonical above.
