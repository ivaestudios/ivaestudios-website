# Destination · Cancún

Editorial refactor of the Cancún destination page (Oleada 3 · Agent 09).

## Files
- EN: `/cancun.html` (URL preserved at `/cancun.html`)
- ES: `/es/fotografo-cancun.html` (existing slug preserved)

## Voice & structure
Cancún reads as the *hospitality* counterpart to Riviera Maya. Hero
title pairs `Cancún.` with the gold italic accent
`<em>The Atlantic, dressed up.</em>` (ES: `El Atlántico, vestido de gala.`).
Eyebrow is `Destination · 02` (Riviera Maya is 01, Los Cabos is 03).

Sections, in order:
1. Page hero (cinematic image · navy scrim)
2. Where we shoot — Hotel Zone, Playa Mujeres, Isla Mujeres
3. Resorts we know — 12 chips (informational; the studio works at any
   luxury resort in the area)
4. The light — sunrise on the Atlantic side as the preferred window
5. Services in Cancún — 6 service tiles. Cenote tile links to the
   Riviera Maya page (cenotes are not in Cancún — documented inline)
6. Recent sessions — 6 images
7. FAQ — 3 destination-specific Qs (Cancún vs Riviera Maya · best
   month · shooting at the resort)
8. Final CTA

## CSS
Shared module `styles/_destination.css` (~150 lines, also used by
Riviera Maya and Los Cabos — see Agents 10 / 11). Imported in
`styles/main.css` under the Pages block.

## Schema
- `Place` + `TouristDestination` for Cancún with canonical
  `geo.coordinates` (`20.4785722, -87.0756298`, per BRAND.md §9)
- `WebPage` subType `CollectionPage`
- `BreadcrumbList`: Home → Destinations → Cancún
- `ItemList` of services available

`aggregateRating` is omitted per BRAND.md §9 until client confirms.

## Quality bar
WCAG AA across nav scrim and resort chips. No prices shown. Real
images from `/images/`. Voice per BRAND.md §6 — no clichés, italic
gold on a single word per block, eyebrow uppercase 0.4em.
