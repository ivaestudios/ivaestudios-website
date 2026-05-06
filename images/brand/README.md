# IVAE Studios — Brand Marks

Canonical mark catalog. Full identity spec lives in [`/BRAND.md`](../../BRAND.md)
§3 (palette) and §4 (logo system) — defer to it for any conflict. These SVGs are
text-based: they reference the brand fonts (`DM Serif Display`, `Inter`,
`Bodoni Moda`) and rely on the consumer loading those faces via `_fonts.css`.
They render as inline SVG and as `<img src>` equally well; system fallbacks
(`Times New Roman`, `Didot`) keep the file legible during font swap.

## Mark catalog

| File | Mark | Color | Surface |
|---|---|---|---|
| `wordmark-navy.svg` | IVAE STUDIOS | Atlantic Navy `#1A2433` | Default. Light backgrounds (Resort White, Warm Sand). |
| `wordmark-white.svg` | IVAE STUDIOS | Resort White `#F9F8F7` | Dark backgrounds (Atlantic Navy, Deep Atlantic, photography). |
| `wordmark-sand.svg` | IVAE STUDIOS | Warm Sand `#E6DCCF` | Atlantic-Navy hero blocks where Resort White feels too cold. |
| `wordmark-slate.svg` | IVAE STUDIOS | Soft Slate `#5A6A7A` | Secondary surfaces, footer, print sub-marks. |
| `ornamental-deep.svg` | IVæE | Deep Atlantic + Gold | Editorial covers, watermarks, intimate applications. |
| `ornamental-slate.svg` | IVæE | Soft Slate + Gold | Light editorial blocks, narrative dividers. |
| `ornamental-white.svg` | IVæE | Resort White + Gold | Reverse on Deep Atlantic / photography. |
| `monogram-gold.svg` | Æ | Editorial Gold `#C4A35A` | Default monogram — seals, lacquer, sticker. |
| `monogram-navy.svg` | Æ | Atlantic Navy | Mono-color reproduction (engraving, stamp). |
| `monogram-white.svg` | Æ | Resort White | Reverse on dark surfaces. |
| `monogram-gold-32.svg` | Æ | Editorial Gold | Favicon-grade derivative — bolder weight, 32×32 viewBox, hairlines tuned for 16-32 px rendering. Use as `<link rel="icon">`. |

## Minimum sizes

- **Wordmark**: 80 px wide on screen; 22 mm in print. Below that, switch to monogram.
- **Ornamental**: 96 px wide minimum — the gold æ loses its character at small sizes.
- **Monogram**: 16 px (use `monogram-gold-32.svg` only). For pin-icons or app
  badges below 16 px, request a raster derivative from Agent 12.

## Exclusion zone

Padding equal to the height of the letter `I` in the wordmark on all sides.
Nothing — text, image, gradient — invades. For the monogram, exclusion zone
equals one quarter of the glyph's cap height.

## Do

- Pair the wordmark with photography on Atlantic Navy or Deep Atlantic.
- Use the monogram on the favicon, social avatars, and watermark stamps.
- Reserve the ornamental for editorial pieces — covers, dividers, certificates.
- Always render the æ ligature in Editorial Gold (`#C4A35A`), italic.

## Don't

- Stretch, condense, rotate, tilt, or skew any mark.
- Apply drop shadow, outline, glow, bevel, 3D, or gradient.
- Mix the wordmark and the ornamental in the same composition.
- Replace DM Serif Display with another serif.
- Place the wordmark on a busy area of a photograph — keep it on negative space.
- Tint Editorial Gold to a different hue on the æ; it is a fixed colour.

## Construction notes

- All files use `viewBox` with no fixed `width`/`height` — consumers scale.
- `<title>` + `<desc>` present for a11y (`role="img"`). Fonts referenced inline
  via `<style>`; consumers load the matching faces (`styles/_fonts.css`).
- Total payload for the eleven marks: under 8 KB combined.
