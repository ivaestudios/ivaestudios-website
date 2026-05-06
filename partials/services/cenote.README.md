# Service partial — Cenote Photography

Owner: Agent 08 (Oleada 3) — branch `feat/r26-3-08-service-cenote`.

## Files
- `cenote-photography.html` (root) — EN service page.
- `es/cenote-photography.html` — ES mirror (1:1 sections).

## URL decision
Service page slug: `/cenote-photography` (EN) and `/es/cenote-photography` (ES).
The longform editorial post `/blog/cenote-underwater-photoshoot-tulum` is
preserved verbatim — it is content marketing, not a service surface.

The homepage services partial (`partials/home/05-services.html`, card 06)
currently links to `/cenote-underwater-photoshoot-tulum` (EN) and
`/es/cenote-tulum` (ES). Agent 30 must rewire those two `href` values
to `/cenote-photography` and `/es/cenote-photography` before launch.

## Section order (matches BRAND.md §6 voice + §8 photography direction)
1. Hero — h1 with `<em>controlled light</em>`.
2. Service detail — Plan / Deliver, two-column.
3. Cenotes we shoot at — Cenote Gran, Dos Ojos, Calavera.
4. Restrictions — mandatory authority signal.
5. Gallery — six frames from `/images/library/`.
6. FAQ — four cenote-specific Q&A.
7. Final CTA — "Now booking November through April."

## Schema
- `Service` with `category: "Cenote Photography"`.
- `BreadcrumbList` (Home → Services → Cenote Photography).
- `FAQPage` mirroring the 4 on-page FAQs.

## Voice
No prices on page (Investment upon request, per BRAND.md §9).
Restrictions section is non-negotiable — it is the authority signal.
