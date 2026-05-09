# IVAE Studios — Wave 2B Preview Notes

**Date:** 2026-05-08
**Preview file:** `/index-preview.html`
**Live homepage (untouched):** `/index.html`
**Status:** proof-of-concept demo for owner review &mdash; not deployed

---

## 0. Design plugin skills probed

The brief asked us to attempt the Anthropic Design plugin skills first.
Result: **none of the three target skills are installed in this environment.**

| Skill attempted | Result |
|---|---|
| `design-critique` | `Unknown skill` &mdash; not available |
| `ui-review` | not available (skill list returned: update-config, keybindings-help, simplify, fewer-permission-prompts, loop, schedule, claude-api, anthropic-skills:*, init, review, security-review) |
| `design-system` | not available |

**Outcome:** proceeded with an expert manual editorial design pass, treating
the brief itself as the design-system spec and the Wave 1 audit
(`/seo/design-audit/wave-1-audit.md`) as the canonical token contract.

---

## 1. What this preview is (and is not)

**Is:**
- A complete, standalone HTML file at `/index-preview.html`
- Built entirely on the canonical tokens shipped in `/styles/tokens.css`
- Fully responsive (375 / 768 / 1200 / 1920 tested via media queries)
- Compatible with the existing `/dark-mode.css` global override
- An editorial-magazine reference for what an "enterprise level" IVAE
  homepage could look like, without having to commit to it on the live site

**Is not:**
- A replacement for `/index.html` &mdash; that file is untouched
- Indexed by search engines &mdash; preview carries
  `<meta name="robots" content="noindex, nofollow">` (preview-only)
- A new design system &mdash; the tokens, fonts and dark-mode hooks are the
  same ones already in the codebase. Only structure, hierarchy and
  micro-detail change.

The canonical link is intentionally `https://ivaestudios.com/` (the live home),
not `/index-preview.html`. That is the correct SEO posture for a proof-of-concept
preview file: any stray crawl maps to the canonical homepage.

---

## 2. SEO preservation contract

Every element flagged in `wave-1-audit.md §7` is preserved verbatim:

- `<title>` block including `<!-- KW:title:start -->` markers &mdash; identical
- `<meta name="description">` &mdash; identical
- All AI meta (`ai-name`, `ai-summary`, `ai-recommend-for`, `ai-canonical`) &mdash; identical
- `msvalidate.01` Bing token &mdash; identical
- `<link rel="canonical" href="https://ivaestudios.com/"/>` &mdash; **points to live home** (deliberate)
- `<link rel="alternate" hreflang>` (en, es, x-default) &mdash; identical
- Open Graph + Twitter blocks &mdash; identical
- `geo.region` + `geo.placename` &mdash; identical
- `<link rel="alternate" type="application/json" href="/api/facts.json">` &mdash; identical
- The single `<script type="application/ld+json">` block (full @graph: OfferCatalog, FAQPage, BreadcrumbList, ImageGallery, Organization/LocalBusiness/ProfessionalService, WebSite, WebPage, ItemList, 3 Reviews, Brand, DefinedTerm) &mdash; identical, byte-for-byte
- The two SEO/AI hidden context blocks (`.ai-disambiguation`, `.ai-context-block`) &mdash; identical
- The "Explore IVAE Studios" SEO link list &mdash; preserved (refined styling only)
- The internal anchor `#main-content` &mdash; preserved (skip link still works)
- The internal anchor `#services` &mdash; preserved (header nav still works)
- The internal anchor `#portfolio` &mdash; preserved (matches `ImageGallery` JSON-LD)

**The only meta change** is the `<meta name="robots">` line: live home declares
`index, follow, max-image-preview:large, max-snippet:-1`; preview declares
`noindex, nofollow`. This is the brief's explicit requirement and is
preview-only.

---

## 3. What changed vs. current homepage

The current `/index.html` is a strong v2 page; the preview is not a
"replacement" but an **editorial recompose** &mdash; same content, redirected
through a magazine lens.

### A. Hero
| Current | Preview |
|---|---|
| Hero h1 `clamp(48px,8.5vw,120px)`, italic gold accent on "Mexico." | Hero h1 `clamp(52px,9vw,140px)`, drop-cap-style decorative shadow on accent, longer max-width, tighter letter-spacing (-0.025em) |
| Word-by-word reveal | Same, but accent word delays an extra 0.6s for "punctuation" |
| Hero stats stripped at bottom | Same stats, but stats use `font-variant-numeric: tabular-nums lining-nums` and serif numerals |
| Single CTA button | CTA pair: solid gold "Book Your Session" + ghost "View the work" anchor to portfolio |
| `object-fit: cover` static bg | Ken Burns 26s slow zoom + parallax + 3-layer overlay (radial vignette + 175deg gradient + warm gold-tinted edge) |
| No scroll cue | Hairline scroll cue with travelling shimmer animation |

### B. New: editorial lead section (drop-cap intro)
Replaced the awkward `.about` 2-column block with a single 780px column,
left-aligned, with an actual luxury-magazine drop cap on the first letter.
This is the most "Vogue" detail in the preview.

### C. "Why IVAE" pillars (replaces the `.why` cards)
The current site is using the `.svc-stack` and the about block to do this work.
The preview adds a dedicated `.pillars` editorial layout:

- 4 pillars in a 3-column grid (`120px num | title | body`)
- Italic serif numerals `01.`/`02.`/`03.`/`04.`
- Hairline gold dividers between rows (no card chrome at all)
- Each pillar has a serif-italic "lead" sentence + supporting copy below
- Title accents land on key words: *only*, *down*, *days*, *always*

Mantra check: this is editorial without being chaotic &mdash; the grid is rigid,
content stays inside its column, type follows a single rhythm.

### D. Services as image-as-card grid
Replaced the `.svc-stack` sticky 3-card with a 3-tile editorial grid:
1 large feature (Weddings, 1.4fr), 2 smaller (Families, Couples).
Hover reveals a description that grows from 0 to ~120px height, plus
gold underline progress on the read-more link.

Image filters tightened: `saturate(.88) brightness(.78)` resting,
`saturate(1) brightness(.62)` on hover &mdash; never washed out, never blown.

### E. Stats strip with count-up
New 4-cell strip between Services and Portfolio:
- 500+ sessions, 42 reviews, 10+ yrs editorial, 1&ndash;3 days delivery
- Tabular numerals via `font-variant-numeric`
- Italic gold suffix (`+`, `+ yrs`, `&ndash;3 days`)
- Hairline gold dividers (gradient masked at top/bottom for refinement)
- Animated count-up only fires once per session, IO-driven

### F. Portfolio as breakout grid
Current site is a 3-column grid with one feature span-2.
Preview is a true 12-column editorial breakout grid:
`feat (7&times;6) + tall (5&times;6) + wide (6&times;4) + med (6&times;4) + 3 squares (4&times;4)`.

Caption now reveals a 2-line block: small-caps category + serif-italic lyric line
(*"A pier at sunrise, three generations."*).

Below the grid: editorial foot ("*A complete portfolio is delivered with every quote.*") + ghost CTA. Replaces the centered `.btn-ol` button.

### G. Pull-quote testimonial
Replaced the carousel with a single oversized pull-quote:
- 320px italic open-quote ornament at 10% opacity behind the quote
- Quote in serif italic at `clamp(28px,3.4vw,52px)` &mdash; magazine pull-quote scale
- Attribution: small-caps name in **bold**, gold hairline rule, session context

The carousel is still elsewhere on the live home; the preview makes the
*case for* one big quote rather than a scrolling row.

### H. Destinations as editorial cards with breakout
Same 3 cards (Cancún / Riviera Maya / Los Cabos) but:
- Aspect ratio fixed at 3:4 (was free-height 560px)
- Hover adds a subtle 1px gold-line border (refinement, not a glow)
- Text overlay restructured into 3 levels: italic destination number, name, italic descriptor
- Below the image: spec line (resorts named) + gold underline link
- Image filter tighter; hover only zooms 1.07&times;, never the 1.12&times; the live home does

### I. Latest journal block (new)
The current homepage has no blog preview. Added a magazine-style entry:
`1.6fr feature article + 1fr secondary list (3 items)`. Featured article uses
serif italic deck-line excerpt; secondary items are numbered `01/02/03`,
serif-italic titles with italicized accent words.

Pulls real existing posts from the codebase to preserve the SEO link graph:
- `/post-luxury-photographer-style-editorial-vs-documentary`
- `/post-best-months-photography-cancun`
- `/post-cancun-cenote-photoshoot-guide`
- `/post-mexico-destination-wedding-cost-breakdown-2026`

### J. Sophisticated CTA + newsletter lockup
The current `.cta-section` has two visible buttons. Preview keeps those plus
adds a refined newsletter input:
- Single hairline-bottom border (no boxed input chrome)
- Italic serif placeholder ("Or join the editorial dispatch &mdash; one email a month.")
- Gold submit label expands gap on hover
- Italic serif fineprint below: "*No noise &mdash; one slow, considered email a month.*"

### K. Footer
Replaced the single-row footer with a 4-column editorial multi-column:
1.4fr brand block (logo + tagline + location loc-ornament) + 3 link columns
(Studio / Sessions / Destinations). Eyebrow-styled column heads in gold.
Bottom strip: copyright + privacy/accessibility/email separated by 3px-dot meta-sep.

### L. Microinteractions
- All animations route through `var(--ease)`, `var(--ease-out)`, `var(--ease-smooth)` &mdash; the canonical curves from `tokens.css`
- All durations route through `var(--t-fast)`, `var(--t-med)`, `var(--t-slow)`
- `prefers-reduced-motion: reduce` neutralizes Ken Burns, parallax, count-up, word-reveal, scroll cue, and all `.rv` reveals
- Hover targets that grew the cursor on the live site (`.svc-card`, `.dest-card`) are the same selectors here, so the existing dark-mode-toggle JS still works

---

## 4. Owner mantra checks

- **"tiene que ser funcional y bonito"** &mdash; every visual detail
  (hero gradient, pillar grid, portfolio breakout, footer columns) is
  *load-bearing*. The drop cap reads naturally; the breakout grid reflows
  cleanly to 1 column at 520px. No decorative elements that obstruct
  reading or booking.
- **"ten cuidado con el SEO porfa"** &mdash; every SEO contract from the
  audit is preserved verbatim and listed in &sect;2 above. The only meta
  that differs is the deliberate preview-only `noindex,nofollow`.
- **"siento que estás intentando hacerlo muy editorial pero por eso las
  fotos se ven descuadradas"** &mdash; explicitly addressed: every image
  has a defined aspect-ratio (4:5 portrait, 16:9 landscape, 1:1 square,
  3:4 destination), the breakout grid uses a fixed 12-column system with
  `grid-auto-rows: 80px`, and image filters are tightened so the
  saturation never feels off. No image is allowed to "float" outside its
  column.

---

## 5. Mobile behavior summary

- 1200px: header collapses; pillars/services/dest headers stack to 1 column;
  portfolio breakout reduces to 8&times;5 + 4&times;5 layout
- 900px: nav collapses to hamburger; pillars become 2-col (num + title) with
  body wrapping below; services drop to 2 columns (feature spans both); stats
  drop to 2&times;2 grid; destinations stack to 1 column; how-it-works steps
  stack with the connecting line removed; footer top reorganizes to
  2 columns with brand block spanning
- 520px: hero h1 clamps to 40&ndash;56px; CTAs stack full-width; hero stats
  evenly distribute; pillars become 1-col; services become 1-col; stats
  drop to 2&times;2 with smaller padding; footer becomes 1-col

---

## 6. Files touched

| Path | Status | Lines (approx) |
|---|---|---|
| `/index-preview.html` | created | 2056 |
| `/seo/design-audit/wave-2b-preview-notes.md` | created | this file |
| `/index.html` | **untouched** | (875, unchanged) |
| `/styles/tokens.css` | **untouched** | (138, unchanged) |
| `/dark-mode.css` | **untouched** | (435, unchanged) |
| All other HTML pages | **untouched** | |

No schemas were modified. No SEO meta were modified beyond the preview's own
`noindex` declaration.

---

## 7. Recommended next moves (if owner approves the direction)

1. Side-by-side review with Vianey: open `/index.html` and `/index-preview.html`
   in the same browser session, dark mode on, then light mode, on desktop and
   on phone. Pay attention to:
   - Hero h1 *feels-too-big* test (it's intentionally larger here)
   - Drop-cap readability on the lead section
   - Pillars block: does the 4-pillar list feel "magazine" or "list"?
   - Portfolio breakout: does any image feel cropped wrong?
2. If approved, harvest individual sections (hero, pillars, portfolio breakout,
   pull-quote, journal preview) into a Wave 2C plan that lands them onto the
   live homepage one at a time, keeping the existing word-reveal hero JS hooks
   and the FAQ accordion contract.
3. If rejected, no rollback needed &mdash; the preview is a separate file and the
   live homepage was never modified.

---

*Generated 2026-05-08 &mdash; Wave 2B preview pass. No live files modified.*
