# 03-manifesto.html — slot conventions

Editorial pull-quote. The single moment on the homepage where IVAE's positioning lands. Navy serif on resort-white, gold ornaments only.

Two prebuilt language blocks live in the partial:

- `<!-- ─── ENGLISH ─── -->` — used on `/` and root pages
- `<!-- ─── SPANISH ─── -->` — used on `/es/*`

Agent 30 (Oleada 3) picks ONE block per page based on locale.

## Source text

Verbatim from Brand Identity Manual v1.0 §6. The eyebrow `Manifiesto · IVAE Studios` is intentionally Spanish in BOTH blocks — the manual uses it as the canonical label.

## Reveal stages (`js/animations.js`)

| Element | Attribute | Timing |
|---|---|---|
| Hairline, eyebrow, sign | `data-reveal` | enter on intersect |
| 3-line quote | `data-reveal-words` | 60ms per word |
| Soft 3rd line | inherits parent | +600ms delay |
| `«æ»` ornament | `data-reveal` | +200ms delay |

## Styling

Pair with `styles/_home-manifesto.css`. Reads tokens from `_tokens.css` and the global `em` italic-gold rule from `_base.css`.

## Contrast

Navy on resort-white = 14.74:1 (AAA). Soft slate ≈ 4.65:1 (AA). Gold is reserved for hairline, eyebrow, monogram, ornament — never body text.
