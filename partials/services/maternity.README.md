# maternity — service page (EN/ES)

Editorial babymoon photography for expecting parents at luxury resorts.
Self-contained pages — not assembled from partials. Two files ship together.

## Files

| File | URL | Locale |
|---|---|---|
| `/maternity-photoshoot-cancun.html` | `/maternity-photoshoot-cancun` | EN (canonical) |
| `/es/maternidad-cancun.html` | `/es/maternidad-cancun` | ES |

The slug carries `cancun` for SEO; service area is the full set: Riviera Maya, Cancún, Los Cabos. Note: cenotes are explicitly off-limits for maternity (cold water, slippery surfaces) — stated in the Locations section.

## Page sections

1. Hero — late golden-hour register
2. Service detail — Plan / Deliver, two columns
3. The right window — gestational guidance (28–34 weeks, soft framing)
4. Locations — three destination cards (no cenote)
5. Gallery — 3 fillers + 3 explicit `data-img-todo` slots
6. FAQ — four maternity-specific items, native `<details>` accordion
7. Final CTA — WhatsApp / email / call

## Schema

`Service` with `category: "Maternity Photography"`, plus `BreadcrumbList` (Home → Services → Maternity), `WebPage`, and the shared `LocalBusiness` node. No prices — `Offer.priceSpecification.description: "Investment upon request"` per BRAND §9.

## Image curation TODO

No `images/library/maternity-*` files at build time. Three filler frames from `/images/` plus three explicit `data-img-todo="maternity-{04,05,06}"` placeholders. Replace once the maternity edit lands in `/images/library/`.

## Voice rule

Sensitive topic — restraint matters more than usual. No clichés, no "magical journey" copy, one italic-gold accent per block.
