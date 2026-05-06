# footer.html — slot conventions

Editorial dark footer. Two prebuilt language blocks live in the partial:

- `<!-- ─── ENGLISH ─── -->` — used on `/` and root pages
- `<!-- ─── SPANISH ─── -->` — used on `/es/*`

Agent 30 (Oleada 3) picks ONE block per page based on locale and injects it.

## Injection slots

| Marker | Replace with |
|---|---|
| `<!-- AGENT-30 INJECT: latest 3 posts -->` | A `<li><a class="ivae-footer__link" href="…">Title</a></li>`. Three markers ship — one per post. |
| `<!-- AGENT-30 INJECT: build year -->` | Strip the marker once the build sets the live year. The literal `2026` next to it stays. |

## TODO links (deliberate)

`/privacy`, `/terms`, `/es/privacy`, `/es/terms` point to pages that do not yet exist. Marked with `TODO` comments. Leave anchors; later oleada authors the pages.

## Styling

Pair with `styles/_footer.css`. CSS reads tokens from `_tokens.css` (Agent 01) but ships fallbacks so the partial renders standalone in preview.

## Honeypot

Form has an off-screen `name="website"` input. Server must reject any POST where it is non-empty. Visible field is `name="email"`; target is `/api/newsletter`.

## Contrast
Bottom-band copy uses `--warm-sand` (~9.6:1 on Atlantic Navy). `--soft-slate` fails AA on this surface and is intentionally not used for type.
