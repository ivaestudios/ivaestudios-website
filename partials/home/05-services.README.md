# `home/05-services.html` — six editorial service cards

Owner: Agent 05 (Oleada 2). Wired by: Agent 30 (Oleada 3).
Pair with: `styles/_home-services.css`. Two language blocks ship —
pick the one matching the page locale (root vs `/es/`).

## Detail-page slugs

| # | Service   | EN slug                                   | ES slug                              | Status |
|---|-----------|-------------------------------------------|--------------------------------------|--------|
| 01 | Family    | `/luxury-family-photos`                   | `/es/fotos-familiares-lujo-cancun`   | Exists |
| 02 | Couples   | `/couples-photography`                    | `/es/fotografia-parejas-mexico`      | Exists |
| 03 | Weddings  | `/luxury-weddings`                        | `/es/fotografo-bodas-destino-mexico` | Exists |
| 04 | Maternity | `/maternity-photoshoot-cancun`            | `/es/maternidad-cancun`              | **TODO Oleada 3** |
| 05 | Yacht     | `/yacht-photography-cancun`               | `/es/fotografia-yate-cancun`         | **TODO Oleada 3** (post: `/post-luxury-yacht-photography-cancun`) |
| 06 | Cenote    | `/cenote-underwater-photoshoot-tulum`     | `/es/cenote-tulum`                   | **TODO Oleada 3** (post: `/post-cenote-underwater-photoshoot-tulum`) |

TODO comments are inline in the partial. Do not delete the anchors —
Oleada 3 builds the pages or rewrites them in `_redirects`.

## Image curation TODO (Agent 30)

Each `<img>` carries `data-img-todo="<slug>"`. Final selection in Oleada 3.

| Card | data-img-todo         | Current src                                                | Curate from |
|------|-----------------------|------------------------------------------------------------|-------------|
| 01   | `services-family`     | `/images/family-session-canc-n-resort-ivae-studios.jpg`    | library: family golden-hour |
| 02   | `services-couples`    | `/images/couple-session-riviera-maya-ivae-studios.jpg`     | library: couples shoreline  |
| 03   | `services-weddings`   | `/images/destination-wedding-table-canc-n-ivae-studios.jpg`| library: `WEDDING-SELECT-*` |
| 04   | `services-maternity`  | `/images/library/services-maternity-placeholder.jpg`       | library: babymoon / maternity |
| 05   | `services-yacht`      | `/images/library/services-yacht-placeholder.jpg`           | library: yacht / sea  |
| 06   | `services-cenote`     | `/images/library/services-cenote-placeholder.jpg`          | library: cenote underwater  |

After curation, drop `data-img-todo` and update `src` (plus `data-srcset`
for responsive — see `partials/picture.README.md`).

## Notes

- Lazy-load by default (below the fold; no `data-ivae-img="hero"`).
- Whole card is the link area. Gold focus ring on parent `<a>`. No JS.
