# `01-head.html` + `01-schema.html`

Homepage `<head>` partial and schema.org `@graph`. Two parallel blocks
(EN + ES) per file. Inject the matching block based on document language.

## Sources

| Piece | Source |
|---|---|
| Title / description copy | Task spec (Oleada 2 / Agent 01). Voice per BRAND.md §6 ("Now booking 2026", never "Book now!") |
| Phone `+52 228 857 0584` / tel `+522288570584` | BRAND.md §9 (`phone_call`) |
| Email `info@ivaestudios.com` | BRAND.md §9 |
| Geo `20.4785722, -87.0756298` | BRAND.md §9 (replaces wrong `21.1619, -86.8515`) |
| Service areas | BRAND.md §9 — Riviera Maya (primary), Cancún, Los Cabos |
| `theme-color #1A2433` | BRAND.md §3 (`--atlantic-navy`) |
| Favicon / PWA icons / OG / Twitter card | `images/icons/README.md` (Agent 12) |
| Font preloads | Bottom-of-file comment block in `styles/_fonts.css` |
| Instagram URL | BRAND.md §9 (`ig_url`) |
| Vianey's job title | "Creative Director & Lead Photographer" — neutral phrasing per BRAND.md §7 |

## `aggregateRating` decision

**Omitted by design.** BRAND.md §9: *"Aggregate rating: TBD by client.
Until confirmed, omit `aggregateRating` from schema entirely rather than
make up numbers."* The legacy `5.0 / 42` rating shipped across older
pages is forbidden going forward. When real review counts arrive, add
`aggregateRating` to the `LocalBusiness` node only.

## Validators

- Google Rich Results Test — <https://search.google.com/test/rich-results>
- Schema.org Validator — <https://validator.schema.org/>
- Local JSON parse: extract the JSON between `<script type="application/ld+json">` tags and run `JSON.parse(...)`.

## Future hooks (Agent 30, Oleada 3)

- Build-time copyright year and any latest-post slot.
- Vianey's portrait — add `image` to the `Person` node when it ships
  (see `AGENT-PERSON-PHOTO` marker in the comment header of each block).
