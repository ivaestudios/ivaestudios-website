# `services/yacht` — service page notes

Owner: Agent 07 · Oleada 3 (`feat/r26-3-07-service-yacht`).
Editorial yacht service page. Two locales, mirrored.

| Locale | URL                          | File                              |
|--------|------------------------------|-----------------------------------|
| EN     | `/yacht-photography-cancun`  | `yacht-photography-cancun.html`   |
| ES     | `/es/fotografia-yate-cancun` | `es/fotografia-yate-cancun.html`  |

Linked from `partials/home/05-services.html` card 05. The blog post
`post-luxury-yacht-photography-cancun.html` stays as the journal
long-read; this is the service entry. EN footer journal column links
to that post.

## Sections

1. Hero — golden-hour open water, gold italic on `golden hour` /
   `hora dorada`.
2. Service detail — `plan` / `deliver`.
3. Charter coordination — IVAE does NOT book the yacht; names
   mentioned: Marina Cancún, Cabo Yacht Charter.
4. Investment — soft answer, no numbers (BRAND.md §9).
5. Locations — Cancún Marina + Cabo San Lucas Marina.
6. Gallery — 6 frames from `/images/`.
7. FAQ — 4 yacht-specific (book-the-boat, sunrise-vs-sunset, weather,
   cabin/interior).
8. Final CTA.

## Schema

`Service` (`category: Yacht Photography`) + `BreadcrumbList`
(Home → Services → Yacht) + `FAQPage`. No `aggregateRating`,
`offers` or `priceRange` — on-request only.
