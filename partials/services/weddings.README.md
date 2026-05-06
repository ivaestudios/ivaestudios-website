# Service · Destination Weddings — README

Owner: Agent 05 (Oleada 3)
EN file: `/luxury-weddings.html` (served at `/destination-wedding-photographer-mexico` via `_redirects`)
ES file: `/es/fotografo-bodas-destino-mexico.html`

## Voice
Editorial. Restraint over reach. Authority shown through process control
(timing, light, location, weather contingency) — never via awards or counts.
No prices anywhere. The studio quotes against the brief.

## Sections (in render order)
1. Hero — cinematic, full-bleed wedding image, gold italic accent on `editorial-quality`.
2. Intro — image + manifesto-style lede about the 2-4 hour cinematic spine.
3. Coverage tiers — three scopes, NO prices: Ceremony only / Ceremony + portraits / Full event with golden-hour add-on.
4. Locations + venues — Tulum / Riviera Maya / Los Cabos with 5 venues each. Note that the list is informational, not a limit.
5. Process — wedding-specific 4 steps: pre-event call, day-of timeline coordination, the wedding day, preview + final delivery.
6. Gallery — 8 wedding images from `/images/library/BODA*`.
7. FAQ — 4 wedding-specific questions (timing, second shooter, video, gallery delivery).
8. Final CTA — email + WhatsApp.

## Schema
- `Service` with `category: "Wedding Photography"`.
- `WebPage` + `EventPage` subtypes for SEO uplift.
- `BreadcrumbList`: Home → Services → Destination Weddings.
- `ItemList` of resorts/venues (per-region) for richer entity mapping.
- `FAQPage` mirroring the four on-page questions.

## Quality bar
- AA contrast (deep-atlantic + resort-white; gold reserved for accents only).
- Reduced-motion respected via media query.
- Mobile-first responsive grid breakpoints at 880px.
- No prices. Investment "quoted against the brief".
- Real wedding images from `/images/library/`.
