# Home · Section 10 · Final CTA

The page's last word, between the FAQ section and the global footer.
Cinematic, full-bleed, deep-atlantic ground. Restrained, never pushy.

## Files
- `partials/home/10-final-cta.html` — EN + ES variants (pick one per locale).
- `styles/_home-final-cta.css` — register in `main.css` under "Pages".

## Structure
- `<span class="final-cta__rule">` thin gold hairline above the eyebrow.
- `.eyebrow` "Now booking 2026" / "Reservando 2026" (gold, tracked).
- `h2.final-cta__title` with one italic-gold accent word (`<em>`).
- `.final-cta__lede` — 24-hour response promise, max 56ch.
- `.final-cta__actions` — gold WhatsApp + ghost-light email; stacks on mobile.
- `.final-cta__fineprint` — call number, location, hours.
- `.final-cta__bg-mark` — decorative Æ at 6% opacity, top-right.

## Contracts
- Phone, WhatsApp, email per BRAND.md §9 — exact, no placeholders.
- WhatsApp `text=` query is locale-specific (EN vs ES).
- Reveals via `data-reveal` / `data-reveal-words` (see `_animations.css`).
- AA contrast: Resort White on Deep Atlantic ≈ 16:1.
- Reduced motion: static ornament; reveal system opts out globally.
