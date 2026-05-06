# Outfit Guide — partials notes

Oleada 3 · Agent 12 · `feat/r26-3-12-outfit-guide`

## What ships

- `outfit-guide.html` — public, no email gate. EN copy, full nav + footer.
- `es/guia-vestuario.html` — ES counterpart, authentic translation (not literal).
- `styles/_outfit-guide.css` — page module. Linked via `<link rel="stylesheet">`
  on the page itself, **not** imported into `main.css`. Keeps the cascade
  isolated until other pages adopt it.
- `js/outfit-guide.js` — small enhancer (~120 lines). Tabs (W3C pattern),
  palette filter, print trigger. Sets `html.has-outfit-guide-js` so the CSS
  fallback collapses panels only when JS is present.

## Page sections (in order)

1. Page hero — eyebrow, h1 with italic-gold accent, lede, in-page anchor chips.
2. Tabs — 6 session types (Family · Couples · Weddings · Maternity · Yacht · Cenote).
3. Palette explorer — 4 IVAE light registers (Resort White, Atlantic Navy,
   Warm Sand, Editorial Contrast). Each is a clickable filter for §6.
4. Location guidance — 4 cards (Beach golden hour, Resort interior, Cenote, Yacht).
5. What to avoid — 12 numbered items, each with a one-sentence reasoning.
   Atlantic Navy ground · gold numerals.
6. Outfit boards — 6 visual examples, filterable by palette.
7. Print CTA — `[data-print-trigger]` button + WhatsApp link to request PDF.
8. Final CTA — bridge to `/#contact` with travel-dates copy.

## Accessibility

- W3C APG tabs: roving `tabindex`, `aria-selected`, `aria-controls`,
  ArrowLeft/Right + Home/End nav.
- Without JS, `html` lacks `has-outfit-guide-js` so all six panels render
  stacked. The tab strip hides itself in that fallback.
- Palette swatches are `role="button"` with `aria-pressed`, keyboard activated
  via Enter/Space.
- `prefers-reduced-motion: reduce` strips all transitions and hover transforms.
- Atlantic Navy `#1A2433` text on Resort White `#F9F8F7` ≈ 14.7:1 (AAA).
- Resort White text on Atlantic Navy in §5 ≈ 14.7:1 (AAA).

## Print

`/styles/print.css` provides the global reset; `_outfit-guide.css` extends it
with page-specific rules (`@media print` block at the bottom). Hides nav,
footer, hero chips and final CTA. Forces every tab panel visible. Targets
A4, ~2 pages.

## Hreflang & routing

- EN canonical: `https://ivaestudios.com/outfit-guide`
- ES canonical: `https://ivaestudios.com/es/guia-vestuario`
- Mutual `<link rel="alternate" hreflang>` references.

Routing relies on existing `_redirects` rules — `/outfit-guide` and
`/es/guia-vestuario` already map to these `.html` files at the root.

## Out of scope

- No new image variants (AVIF/WebP ladders) created — boards reuse existing
  hero-set images. A later agent can generate the ladder if needed.
- No PDF asset generated — copy points users at `window.print()` and at a
  WhatsApp link to request the brand PDF if the studio prepares one later.
