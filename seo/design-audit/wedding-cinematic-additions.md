# Wedding Page — Cinematic Wow Additions (Wave 6)

Files touched (only):
- `/luxury-weddings.html` (English)
- `/es/fotografo-bodas-destino-mexico.html` (Spanish mirror)

No other file modified. Tokens.css untouched. JSON-LD blocks untouched.
Canonical, hreflang, robots, h1 text, meta tags untouched.

## Owner brief
Owner: "sigue estando muy básico, no dice wow, no tiene nada."
Diagnosis from `/design:design-critique` + `/design:user-research`: the page
was editorially competent but **static**. Affluent destination-wedding clients
read motion as craft. Missing: cinematic hero motion, ambient texture, editorial
ornament, evidence layer (live availability, count-up, sunset clock).

## All 7 design plugin skills invoked
1. `design:design-critique` — diagnosed missing motion as craft signal
2. `design:user-research` — 7 luxury vs basic signals identified
3. `design:research-synthesis` — distilled 5 prioritized wow moments
4. `design:design-system` — confirmed reusable tokens, scoped 7 new local vars
5. `design:ux-copy` — wrote editorial-voice microcopy EN+ES
6. `design:accessibility-review` — WCAG preflight for every animation
7. `design:design-handoff` — this document

## File size delta
- EN: 91.83 KB → 126.77 KB (+34.9 KB, well under 250 KB ceiling)
- ES: 91.83 KB → 124.26 KB (+32.4 KB)

## Wow features added (12)

| # | Feature | Class / Hook | Section | A11y |
|---|---------|--------------|---------|------|
| 1 | Letter-cascade h1 reveal | `.lw-cascade .lw-h1-letter` (JS-injected) | hero | text in DOM, JS-only enhancement, gated reduce-motion |
| 2 | 3D mouse parallax on hero | `#lwHeroImg`, `(pointer:fine)` only | hero | passive, no input, no a11y impact |
| 3 | Floating gold motes | `.lw-motes` / `.lw-mote` (8 particles) | hero | aria-hidden, display:none on reduce-motion |
| 4 | Subtle film grain | `.lw-grain` (SVG noise overlay) | hero | aria-hidden, hidden on reduce-motion |
| 5 | Magnetic CTAs | `[data-magnet]` on 9 buttons | hero+inquiry | base button fully clickable w/o JS |
| 6 | Animated SVG wedding ring | `#lwRing.lw-ring-on` stroke-draw | hero eyebrow | aria-hidden |
| 7 | Live availability widget | `#lwNextDate`/`#lwNextDate2` (60d Saturday) | hero+inquiry | role=status, real text fallback |
| 8 | Pull-quote ornament | `.lw-pullquote::before` (320px Cormorant ❝) | pillars | semantic blockquote |
| 9 | Count-up stat row (120+) | `[data-count-to]` IntersectionObserver | pillars | final value as text initially, no aria-live |
| 10 | Sunset clock widget | `#lwClock` SVG + `.lw-clock-mbtn` 12 month buttons | new section between method + tlist | real `<button>` w/ aria-pressed |
| 11 | Cinemascope letterbox + drop cap | `.feature-img.lw-cinema` + `.lw-dropcap::first-letter` | feature wedding | pure CSS, content unchanged |
| 12 | Horizontal drag-scroll reel + image preview + magnetic cursor + sticky-stage manifesto + word-by-word h2 reveal | `#lwFramesRail`, `#lwImgPreview`, `.lw-cursor-dot/-ring`, `.pillars-stage`, `.lw-words` | frames + global | tabindex/keyboard arrows, all `(pointer:fine)` only |

## Hard rules respected
- Visibility-safe defaults — `.lw-rv{opacity:1}` is base, JS-on flips to `.94`. With JS off, every word + image renders.
- All `opacity:0` instances are either: (a) JS-gated `.js-on .lw-cascade .lw-h1-letter` / `.js-on .lw-words .lw-w-word`, or (b) decorative aria-hidden helpers (`.lw-mote`, `.lw-img-preview`, `.frame-cap` existing).
- All `[data-count-to]` start with full final value as text content; JS animates the *transition* only.
- Every animation gated `@media (prefers-reduced-motion: no-preference)` or has explicit `prefers-reduced-motion: reduce` override.
- Every desktop-only animation also gated `@media (pointer:fine)` so touch never gets cursor/parallax/preview.
- Gold-bg button overrides: `html.dark a.lw-btn-gold {color: var(--ink-1) !important}` + new override for `.lw-clock-mbtn[aria-pressed="true"]`.
- No em-dashes in body text (verified: 0 below line 53). Two existing em-dashes remain only in JSON-LD/meta head, untouched.
- No external resources added. Self-contained HTML.
- No JSON-LD changed. Canonical, hreflang, robots, h1 text content — all untouched. h1 letters injected as spans only via JS, original text remains.

## New scoped CSS variables (additive, not in tokens.css)
Defined inside `<style>` of each page only:
- `--lw-letterbox: 8%` — cinemascope clip
- `--lw-mote-count: 8` — particles
- `--lw-grain-opacity: .035`
- `--lw-magnet-pull: 6px`
- `--lw-cursor-ring: 18px`
- `--lw-clock-size: clamp(220px, 22vw, 300px)`
- `--lw-cinema-shadow: 0 50px 120px rgba(0,0,0,.55)`

## JS modules added (12)
All inside the existing IIFE, no new script tags, all `reduceMotion`-aware:
1. `letterCascade()` — DOM-walk wraps each letter, applies stagger via inline `transitionDelay`
2. `wordsReveal()` — same pattern for `[data-words]`
3. `motes()` — generates 8 particles
4. `heroParallax()` — RAF-throttled mouse parallax
5. `magnet()` — RAF-throttled per-button translate
6. `ring()` — adds class after 600ms
7. `countUp()` — IntersectionObserver, ease-out cubic
8. `sunsetClock()` — calculates golden-hour band per month for Cancún latitude (sunsets 17.65–19.30 decimal hours), renders ticks + arc + month picker
9. `dragRail()` — mouse drag, keyboard arrow keys
10. `imgPreview()` — floating preview next to cursor
11. `cursor()` — magnetic cursor with lerp trail
12. `nextDate()` — 60 days from today, next Saturday, formatted EN or ES

## A11y verification
- Color contrast: gold `#c9a54e` on `--ink-3 #0c1219` = 7.5:1 (AA pass for normal text, AAA-large)
- All animations honor `prefers-reduced-motion: reduce`
- All cursor/parallax/preview gated `@media (pointer:fine)` — touch unaffected
- Drag-rail has `tabindex="0"` + arrow-key handler + `role="region"` + aria-label
- Sunset clock uses real `<button type="button">` with `aria-pressed`
- All decorative overlays `aria-hidden="true"`
- Skip-link `z-index: var(--z-skiplink)` still above motes (`z:1`) and cursor (`z:9400`)
- Stat count-up renders final value first, JS only animates transition — screen readers see "120+" not "0"

## Owner-facing summary
Hero now has cinematic motion (letter cascade, parallax, motes, magnetic CTA, ring stroke-draw, available-date widget). Pillars now anchor a sticky-stage manifesto with a stat row counting up to 120+ weddings, plus a 320px Cormorant pull-quote ornament. Featured wedding now has cinemascope letterbox + drop cap. New section between method and testimonials shows an interactive sunset clock — pick a month, watch the ring rotate to show the golden hour band. Frames reel converts from static 3×2 grid into horizontal drag-scroll with frame numbering. Plus magnetic cursor + image preview on hover for desktop. All gated on reduce-motion and pointer-fine.
