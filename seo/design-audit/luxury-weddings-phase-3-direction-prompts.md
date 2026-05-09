# IVAE Studios — Luxury Weddings v6 — Phase 3 Direction Prompts (Locked)

**Page:** `/luxury-weddings.html` (canonical: `/destination-wedding-photographer-mexico`)
**Phase:** 3 of 5 (three parallel build agents — A / B / C)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §6 (visual / motion principles), §7 (direction draft prompts), Phase 2 copy deck and a11y contract

This document contains three independent prompts. Each prompt is self-contained: a Phase 3 agent can execute its assigned direction without reading the others. All three target the same 13-section IA from Phase 1 §5, the same locked copy deck, and the same a11y contract. The visual register is what differs.

**Common contract for all three directions (read first):**

1. Load `/styles/tokens.css` BEFORE any other stylesheet. Then `/dark-mode.css`. Then any direction-specific CSS appended to the page in a single `<style>` block. NEVER inline a `:root` block; consume tokens.
2. The h1 is exactly one element with the canonical SEO phrase: "Luxury Destination Wedding Photographer" + "Mexico" intact in textContent. Italic on "Mexico" via `<em>`.
3. All copy is locked in `/seo/design-audit/luxury-weddings-phase-2-copy-deck.md`. Do not paraphrase. Do not rearrange. Do not invent new sections.
4. All a11y patterns are mandated in `/seo/design-audit/luxury-weddings-phase-2-a11y-contract.md`. Follow exactly.
5. SEO preservation per Phase 1 §10: every `<meta>`, `<link>`, and `<script type="application/ld+json">` from the current `/luxury-weddings.html` head must remain in the new build's head verbatim. Order may change; content may not.
6. The 13 sections and their order are non-negotiable: Hero → Trust strip → The Studio → Three Commitments → A Wedding (case study) → Voices (pull-quote) → The Investment → The Method → The Reel → Three Coastlines → Considered Questions (FAQ) → Begin (Inquiry) → Footer.
7. The output of Phase 3 is a single self-contained HTML file: `/luxury-weddings-preview-v6-{a|b|c}.html`. Title contains `<meta name="robots" content="noindex, nofollow">` until Phase 4 promotes the chosen direction to production.
8. Token usage: all colors, sizes, spacing, motion, ratios reference `var(--…)` from tokens.css. NO hex literals. NO hardcoded px outside what tokens.css provides. NO new global CSS variables without a token entry first.
9. Motion budget per direction is fixed: A = 10 animations, B = 14 animations, C = 8 animations. Drop everything else. The 41 animations in the home v5 are a menu, not a quota.
10. Spanish phrase appears exactly once on the page, in the manifesto (`Bilingüe en cada conversación`).

---

## Direction A — Editorial Vogue

### Aesthetic philosophy (one paragraph)

This is a Vogue Living wedding feature, printed on cream stock, opened at the end of a quiet Sunday. Restraint above all. Generous margins. Mostly serif. The reader's eye is meant to slow down, not skim. Cream and ink alternate to signal section transitions the way a magazine prints an editor's letter on cream and the feature on coated stock. Drop caps once. Italics once per heading. Pull-quotes that breathe at 920px max-width with one ornament behind. Each photograph is given the page; never two photographs competing inside the same fold. The type does most of the work, and the type is restrained — Cormorant Garamond at weight 300 in serif, Syne at weight 400-600 in sans, no other faces. Two CTAs total per page-fold, each weighty, neither shouting. This direction is for the reader who would, in another life, subscribe to *Cereal* and own the back catalogue.

### Reference moodboard (specific)

- *Vogue Living* (Australia) — wedding feature spreads, March 2024
- Carolyne Suzuki, *Over the Moon* magazine — editorial wedding features
- *Cereal Magazine* — issue layouts for travel features
- Architectural Digest — hospitality features (Costa Palmas, Cap Juluca)
- *Kinfolk* magazine — issue 32 onward for type rhythm
- Photographer José Villa — golden-hour bridal portraiture
- Photographer Carmen Santorelli — Italian wedding feature work

### Type system

Use these tokens from tokens.css (NOT hex / px literals):

- **H1 (hero):** `font-family: var(--font-serif)`, `font-size: clamp(48px, 7vw, 92px)`, `font-weight: 300`, `line-height: 1.06`. Italic on the word "Mexico" via `<em class="hero-h1__italic">`.
- **H2 (sections):** `var(--font-serif)`, `clamp(36px, 4vw, 56px)`, weight 300, line-height 1.12. One italicized phrase per h2 (e.g., "*carefully* held").
- **H3 (cards/tiers):** `var(--font-serif)`, `clamp(22px, 2.4vw, 32px)`, weight 300, line-height 1.20. Italic across the entire h3 for tier names (The Vow, The Celebration, The Cinematic Day).
- **Eyebrows:** `var(--font-sans)`, `var(--fs-10)` weight 600, uppercase, tracking `var(--tracking-eyebrow-wide)` (0.32em), color `var(--gold)` on ink, `var(--gold-deep)` on cream.
- **Body:** `var(--font-sans)`, `var(--fs-15)` weight 400, line-height 1.85. On ink: `var(--text-on-dark-readable)`. On cream: `var(--text-on-light-readable)`.
- **Drop cap:** ONLY on the manifesto's first paragraph. 60px (or `clamp(48px, 6vw, 72px)`) `var(--font-serif)` italic, `var(--gold)`, float left, padding-right 16px, line-height 0.9. Use `text-indent: 0` on the paragraph itself.
- **Italics policy:** one italic phrase per heading; one italic phrase per paragraph maximum.

### Layout grid

12-column grid at desktop (≥ 1200px), 8-column at 900-1200px, 4-column at < 900px. Gutter is `var(--s-gutter)` (`clamp(24px, 5vw, 64px)`). Section content max-widths:

- Hero: image 100% bleed, copy in 600px column anchored bottom-left of viewport, padding-bottom `clamp(80px, 10vw, 140px)`.
- Trust strip: 4 stat columns equal width, max 1100px centered, on `var(--ink-2)`.
- The Studio (manifesto): 50/50 split, image left at 4:5, copy right at `var(--manifesto-copy-max-width)` (540px). Section background `var(--cream-1)` — INVERSION from the page default.
- Three Commitments: 3-column grid at desktop, 2-column at 900px, 1-column at 768px. Cards have NO background fill (cream section), divided by 1px hairline `var(--line-on-light)`. Card padding `var(--s-8) var(--s-6)`. Background `var(--cream-1)`.
- A Wedding: case study hero at 16:9 full-bleed, then 2-column 4:5 deck below at 1200px max-width, 32px gap. Caption in `var(--case-study-caption-max-width)` (720px), single column, `var(--cream-1)` background.
- Voices (pull-quote): max 920px, centered, ON `var(--cream-2)` background. One ornament behind at `var(--ornament-pull-quote-opacity)` (0.045). NO grain.
- The Investment: 3-column grid, equal width, gap `var(--inv-tier-gap)` (clamp 24px-48px). Cards have no background fill on cream; each separated by `var(--inv-tier-rule)` (1px hairline). Featured tier (II) gets `var(--inv-tier-rule-featured)` (2px gold) on top edge only. Padding `var(--vow-card-padding)`.
- The Method: 1-column rail at `var(--method-rail-max-width)` (920px). Vertical hairline left at `var(--method-step-rule)`. 6 steps stacked. Background flips back to `var(--ink-2)`.
- The Reel: edge-flush horizontal scroll-snap, frames at `var(--reel-frame-min-width)` (clamp 220-360px), aspect `var(--reel-card-aspect)` (4/5), gap `var(--s-1-5)` (6px). Background `var(--ink-3)`.
- Three Coastlines: 3-column grid, max 1300px, gap `var(--locations-gap)`. Card aspect `var(--locations-card-aspect)` (3/4). Background `var(--cream-1)`.
- Considered Questions: 1-column at `var(--faq-max-width)` (880px). Background `var(--ink-3)`.
- Begin (Inquiry): full-bleed dark image, copy max-width `var(--inquiry-copy-max-width)` (720px), centered. Background image at brightness 0.20 (very dark).

### Motion vocabulary (10 animations — drop the rest)

Bring these 10 from the home v5's 41:

1. **Hero h1 line reveal.** Line-by-line cascade with stagger `var(--stagger-base)` (90ms), translateY `var(--reveal-y-md)` (28px) → 0, opacity 0 → 1, easing `var(--ease-cinema)`, duration `var(--t-medium)` (0.55s).
2. **Manifesto h2 word-stagger.** Each word as `<span class="word">`, stagger `var(--stagger-tight)` (60ms), translateY `var(--reveal-y-sm)` (14px), duration `var(--t-medium)`.
3. **Image clip-reveal on scroll.** `clip-path: inset(100% 0 0 0)` → `inset(0 0 0 0)`, duration `var(--t-cinema)` (0.95s), easing `var(--ease-cinema)`. Triggered by IntersectionObserver at 20% visibility.
4. **Tier card hover.** Border color shift from `var(--line-on-light)` to `var(--gold-line)`, duration `var(--t-quick)` (0.28s). NO lift (Direction A is restrained — lift belongs to Direction B).
5. **FAQ accordion expand.** `max-height: 0` → `var(--faq-answer-max-h)` (480px), opacity 0.4 → 1, icon rotate 0 → 45deg. Duration `var(--t-medium)`, easing `var(--ease)`.
6. **Eyebrow underline grow.** On `:hover` of links inside text body, `::after` pseudo at scaleX 0 → 1, transform-origin left, duration `var(--t-quick)`.
7. **Link underline grow.** Same as above for inline `<a>` in body copy.
8. **CTA hover.** Background fade from transparent to `var(--gold-soft)` (rgba 201,165,78,0.18) on outline buttons; on primary gold buttons, brightness shift to `var(--gold-hover)` (#ceae64). Duration `var(--t-quick)`.
9. **Reel scroll-snap.** Native CSS only; `scroll-snap-type: x mandatory` and `scroll-snap-align: start`. Plus prev/next buttons that programmatically scroll by frame width.
10. **Count-up on stats.** On the trust strip, numbers count from 0 to target over `var(--count-up-duration)` (1.6s) with easing `var(--ease-soft)`. Reduced-motion: skip and show final value immediately.

NO loader. NO magnetic cursor. NO gold motes. NO grain animation (static grain at `var(--grain-static)` 0.022 opacity is allowed but optional). NO scroll-velocity hairline. NO chapter cards. NO ornament-pulse. NO Ken-Burns parallax (Direction A is print-still). NO REC tickers. NO film-leader.

### Image art direction

- **Aspect ratios used:** 4:5 (manifesto, case study deck, reel) and 16:9 (hero, case study hero, inquiry background). NO cinemascope (21:9). 21:9 is a Direction B move — Direction A is print-cropped, not screen-cropped.
- **Brightness 0.55-0.75**, **saturation 0.85-1.0** (closer to true print).
- **Hero:** golden-hour bridal portrait or first-look, 16:9. Not a wide ceremony pan.
- **Manifesto stage:** vertical 4:5 intimate detail or first-look.
- **Case study hero:** 16:9 ceremony or portrait — NOT 21:9.
- **Case study deck:** 4 images at 4:5 (Phase 1 §11 risk #2 — confirm 4 unique case-study images available; if fewer, drop to 2).
- **Reel:** 8-12 frames at 4:5.
- **Locations:** 3 cards at 3:4 (slightly taller than 4:5).
- **Inquiry background:** 16:9, brightness 0.20, saturation 0.50.
- All images golden-hour, naturally saturated, no Instagram filters.
- All images use `loading="lazy"` except hero and trust-strip-adjacent (`loading="eager"`, `fetchpriority="high"`).

### Color treatment

The page alternates ink and cream sections to signal magazine pacing:

- Hero: `var(--ink-3)` (deepest)
- Trust strip: `var(--ink-2)`
- The Studio (manifesto): `var(--cream-1)` ← **inversion**
- Three Commitments: `var(--cream-1)` (continues)
- A Wedding: `var(--cream-1)` (continues — this whole opening movement is on cream)
- Voices: `var(--cream-2)` (slightly warmer, subtle separation)
- The Investment: `var(--cream-1)`
- The Method: `var(--ink-2)` ← back to dark
- The Reel: `var(--ink-3)`
- Three Coastlines: `var(--cream-1)`
- Considered Questions: `var(--ink-3)`
- Begin (Inquiry): `var(--ink-4)` (deepest of all, matches the very dark background image)

Gold (`var(--gold)`) on ink anywhere. Gold-deep (`var(--gold-deep)`) on cream when text is < 18px non-bold. Gold used for: eyebrows, italicized words in headings, bullet leader rules, line dividers, featured tier top edge, primary CTA backgrounds, hover underlines. Never as block fills. Never as body color.

### Section structure (locked from Phase 1 IA)

Same 13 sections, in order. Refer to copy deck for exact text. Refer to a11y contract for exact markup patterns.

### Specific component patterns (Direction A interpretations)

- **Investment tiers:** No card backgrounds (cream is the section background; cards are defined by hairline rules only). Top hairline `var(--inv-tier-rule)` 1px gold-line on tiers I and III; `var(--inv-tier-rule-featured)` 2px gold on tier II. Roman numerals at `var(--fs-10)` `--font-sans` gold-deep. Tier name as italic `<h3>` in serif. Italic lede in serif `--fs-15`. Bullets unstyled with 1px gold leader rule before each item via `::before`. "Investment from" eyebrow above price. Price `--fs-24` weight 300 roman. CTA at the bottom: outline button (gold border, gold text on cream) for I and III; gold-fill button (ink text on gold) for II.
- **FAQ:** Each Q/A wrapped in `<li>`. `<button>` toggle with full-width click area, padding `var(--s-4) 0`. Icon (a single rotated plus → x) on the right. Question is in `<h3>` inside the button. Answer panel padding `var(--s-2) 0 var(--s-6)`. No card background. Hairline divider between items at `var(--line-on-dark)` 1px.
- **Pull-quote:** Centered. Italic serif `--fs-32` weight 300, line-height 1.30, color `var(--text-on-light-readable)`. Quote marks open/close are typographic curly quotes inside the body, NOT a giant ornamental glyph behind. The ornament behind is a subtle abstract shape (a single curve or a paired hairline rectangle) at `var(--ornament-pull-quote)` size and `var(--ornament-pull-quote-opacity)`. Attribution below in `--fs-13` `--font-sans` `--couple-name-tracking` (0.18em).

---

## Direction B — Cinematic Film

### Aesthetic philosophy (one paragraph)

This is a movie poster that scrolls. Full-bleed cinemascope hero. Deeper darks throughout. Scroll-driven storytelling — sections begin with a quiet chapter card and resolve into a full-bleed image. Static film grain at low opacity. Vignette on the hero. Ken-Burns parallax on the hero only. Type lockups echo film title cards: a tracked-out chapter number, a hairline rule, a feature title. Reception and ceremony imagery is treated like B-roll: 21:9 panoramic, color-graded slightly cool. Deeper than Direction A. Less restrained — but disciplined. The viewer should feel they have walked into a feature film, not a fashion shoot.

### Reference moodboard (specific)

- Roger Deakins's cinematography on *Skyfall* and *No Country for Old Men*
- *The Tree of Life* (Terrence Malick) — golden-hour wide compositions
- Photographer Erich Mcvey — cinematic destination wedding work
- Photographer Christian Oth — wide-format wedding ceremony imagery
- *Variety* and *The Hollywood Reporter* — feature-card typography
- Magnum Photos — Steve McCurry's color grading on travel features
- Alec Vanderboom's cinematic editorial work

### Type system

Tokens from tokens.css:

- **H1 (hero):** `var(--font-serif)`, `clamp(56px, 8vw, 108px)`, weight 300, line-height 1.04. Italic on "Mexico". Larger than Direction A — the cinemascope hero supports the bigger type.
- **H2 (sections):** `var(--font-serif)`, `clamp(38px, 4.5vw, 64px)`, weight 300, line-height 1.10. One italic phrase per h2.
- **H3 (cards / tiers / steps):** `var(--font-serif)`, `clamp(24px, 2.6vw, 36px)`, weight 300, italic for tier names.
- **Chapter cards (between sections):** A small lockup of "Chapter 02 · The Studio" rendered as `var(--fs-10)` `--font-sans` weight 600, tracking `var(--tracking-eyebrow-wide)` (0.32em), uppercase, gold on ink. Followed by a 1px hairline rule at 80px width. This appears at the top of each section as a separator.
- **Eyebrows, body, drop cap:** same as Direction A. Drop cap once on manifesto.

### Layout grid

12-column grid. Most sections full-width with content centered in 1200-1400px containers.

- Hero: 100vh, full-bleed cinemascope (21:9 image cropped to 100vh viewport), copy bottom-left in 720px column. Vignette overlay using `var(--shadow-hero-vignette)`. Static grain at 0.022 opacity over the hero.
- Trust strip: 4 stat columns, max 1200px centered, `var(--ink-2)`.
- The Studio (manifesto): 60/40 split with image larger. Image is cinemascope 21:9, height ~620px. Copy stack right in 480px column.
- Three Commitments: 3-column grid with chapter card above ("Chapter 03 · The Experience"). Cards have ink-2 background fill, gold-line hairline border, padding `var(--s-8) var(--s-6)`. Roman numeral large in gold above each commitment name.
- A Wedding (case study): full-bleed 21:9 hero, then 2-column 4:5 deck. A subtle "Frame 01 · Mayakoba · 17:42" annotation in the corner of the case-study hero (much subtler than the rushed preview's loud REC ticker — `var(--fs-10)` gold opacity 0.5, no animation).
- Voices: ON `var(--ink-4)` (deepest). Pull-quote with ornament behind at slightly higher opacity (0.07 vs A's 0.045) — the cinematic register tolerates more visual weight.
- The Investment: 3-column. Middle tier elevated visually with `var(--inv-tier-rule-featured)` 2px gold on top AND a small "Most Chosen" badge `var(--fs-10)` --font-sans, gold uppercase letterspaced. Cards have ink-3 background fill (slightly deeper than the ink-2 page default for this section), gold-line hairline border, padding `var(--vow-card-padding)`.
- The Method: 6-step rail with vertical hairline at `var(--method-step-rule)` and gold dot nodes at each step (timeline-node 14px, active 18px from tokens.css). Chapter card above rail.
- The Reel: edge-flush horizontal scroll-snap with arrow controls (prev/next outside the track, near the bottom). Frames at `var(--reel-frame-min-width)`, aspect 4/5. A scroll progress hairline below the track at `var(--velocity-bar-h)` (1.5px), gold-glow shadow.
- Three Coastlines: 3-column with chapter card above. Card image with full overlay-on-hover (image fades to `var(--ink-3)` at 0.85 opacity, caption fades in).
- Considered Questions: same as A but on `var(--ink-3)` background with chapter card above.
- Begin: full-bleed dark image with vignette. Chapter card above.

### Motion vocabulary (14 animations)

1. **Hero h1 line reveal** — 180ms stagger across word spans, translateY `var(--reveal-y-md)`, duration `var(--t-cinema)` (0.95s), easing `var(--ease-cinema)`.
2. **Ken-Burns parallax on hero image** — slow scale 1.0 → 1.05 over `var(--t-loop-l)` (18s), looping, gated reduced-motion.
3. **Image clip-reveal diagonal (45deg)** — clip-path polygon from one corner, duration `var(--t-cinema)`, easing `var(--ease-cinema)`. Used on case-study hero and section hero images.
4. **Manifesto word-stagger** — same as A but with `var(--stagger-base)` (90ms) instead of tight, slightly slower feel.
5. **Tier card hover** — border color shift PLUS 3px translateY lift, easing `var(--ease-back)`.
6. **FAQ accordion** — same as A.
7. **Reel scroll-snap with arrow controls and progress** — native scroll plus a JS-driven `--velocity-bar-h` progress hairline.
8. **Count-up on stats** — same as A.
9. **Eyebrow underline grow** — same as A.
10. **CTA shine sweep** — on hover, a gold gradient sweeps left-to-right across the button face once over `var(--border-sweep-duration)` (0.65s).
11. **Scroll progress hairline at top of viewport** — `var(--velocity-bar-h)` 1.5px gold, fixed top, scaleX from 0 to 1 as scroll progresses.
12. **Chapter card eyebrow ornament pulse** — the small leader rule next to each chapter number pulses opacity 0.6 → 1 → 0.6 over `var(--t-loop-s)` (4s). Subtle.
13. **Pull-quote ornament parallax** — the abstract ornament behind the quote shifts -20px on scroll (subtle parallax bound to scroll position, NOT continuous).
14. **Manifesto stage overlay fade** — when the manifesto image enters viewport, a thin gold rectangle on its corner fades in over `var(--t-medium)`. Adds editorial weight to the still image.

NO magnetic cursor. NO gold motes. NO grain animation (static grain only). NO REC live-tickers. NO loader. NO scroll-velocity hairline (different from scroll progress; the velocity one is gimmicky). NO film-leader. NO continuous dust particles.

### Image art direction

- **Cinemascope 21:9** for hero and case-study hero. **4:5** elsewhere.
- **Brightness 0.35-0.55** (darker than A).
- **Saturation 0.60-0.80** (more desaturated; cinematic).
- **Hero:** golden-hour ceremony-wide, panoramic feel. Wide enough that the couple is small in the frame and the venue does the talking.
- **Manifesto stage:** 21:9 cinemascope (NOT 4:5 like A) — the cinematic register applies even to the manifesto image.
- **Case study hero:** 21:9 wide ceremony.
- **Case study deck:** 4 images at 4:5 paired in 2-column grid.
- **Static film grain layer** at 0.022 opacity, NO animation. Use `var(--grain-static)`.
- **Vignette inset shadow on hero** via `var(--shadow-hero-vignette)`.

### Color treatment

Stays dark throughout. NO cream sections.

- All sections on `var(--ink-3)` default, with selective deeper sections (`--ink-4` for Voices and Begin) and one slightly lighter (`--ink-2`) for Trust strip and Method.
- Gold reserved for: chapter card numbers/tags, eyebrows, italics in headings, bullet leaders, dividers, primary CTA backgrounds, hover states, scroll progress bar.
- Body text on dark: always `var(--text-on-dark-readable)` (alpha 0.82 — passes 12.7:1).

### Section structure (locked from Phase 1 IA)

Same 13 sections in order, same copy deck, with one Direction-B addition: each section opens with a small chapter card (Chapter 02 · The Studio, Chapter 03 · The Experience, etc.). Chapter cards are NOT a separate IA section; they are presentational labels at the top of each section, inside the section's own DOM.

### Specific component patterns (Direction B interpretations)

- **Investment tiers:** Cards with ink-3 background fills (one shade deeper than the section ink-2). 2px gold top edge on featured tier (II). "Most Chosen" badge top-right corner, no fill, gold text uppercase tracked at `var(--couple-name-tracking)`. Roman numerals large (`var(--fs-32)`) gold weight 300 above tier name. Italic name and lede follow. Bullets unstyled with gold leader rules. CTA at bottom: outline gold-border (I, III) or gold-fill (II).
- **FAQ:** Same accessible pattern as A. Visual difference: ink-3 cards with subtle gold-line border, slight hairline divider between. Icon is a chapter-card-style "+" rotating to "×" on expand.
- **Pull-quote:** Italic serif at `clamp(28px, 3.5vw, 44px)`, weight 300. Color `var(--text-on-dark-readable)`. The ornament behind is at higher opacity (0.07) than Direction A. Attribution at `--fs-13` `--font-sans` tracked at `--couple-name-tracking`.

---

## Direction C — Minimalist Refined

### Aesthetic philosophy (one paragraph)

Hermes. Loro Piana. The Row. Ultra-restrained. Whitespace is the loudest design element on the page. Cream-dominant; ink reserved for the pull-quote and the inquiry. Hairline dividers replace card backgrounds. Two CTAs total per page-fold, and that is on purpose. The reader fills in the luxury — the page does not perform it. Type is small. Margins are generous. Imagery is edge-flush, never overlaid with captions. The body copy carries the weight, and the body copy is sparse on purpose. If Direction A is a magazine and Direction B is a movie, Direction C is the silk binding on a custom suitcase. The reader should feel that the studio is too confident to need to convince them of anything.

### Reference moodboard (specific)

- Hermes.com (the global commerce site, not the regional ones)
- Loro Piana — *The Source* online magazine
- The Row — runway collection lookbooks
- *Apartamento Magazine* — single-photo features
- Photographer Hannelore Vandenbussche — minimalist portrait work
- *MR PORTER* — feature articles, type rhythm
- Photographer Greg Finck — quiet wedding portraits

### Type system

- **H1 (hero):** `var(--font-serif)`, `clamp(40px, 6vw, 80px)`, weight 300, line-height 1.08. Single line if possible. Italic on "Mexico". SMALLER than A and B because the Direction C register treats large display type as ornament.
- **H2 (sections):** `var(--font-serif)`, `clamp(26px, 3vw, 40px)`, weight 300, line-height 1.15. NO italic in headings — the minimalist register treats italics as ornament. EXCEPTION: the manifesto h2 may have one italicized phrase ("*carefully* held").
- **H3 (cards / tiers):** `var(--font-serif)`, `clamp(20px, 2.2vw, 28px)`, weight 300. Tier names use italic — the only italic in the page's tier section.
- **Sub-heads (sans, used as secondary structure):** `var(--font-sans)`, `var(--fs-13)` weight 500, uppercase, tracking `var(--tracking-eyebrow-tight)` (0.18em).
- **Eyebrows:** SAME as sub-heads. Direction C does not distinguish eyebrows from sub-heads (one fewer typographic mode).
- **Body:** `var(--font-sans)`, `var(--fs-15)` weight 400, line-height 1.90 (slightly more breath than A and B).
- **Drop cap:** ALLOWED on the manifesto, but optional in Direction C — if used, half the size of A's drop cap (`clamp(36px, 4vw, 48px)`, gold-deep on cream).

### Layout grid

8-column grid (simpler than 12-col). Generous gutter `clamp(32px, 6vw, 80px)`.

- Hero: 90vh (NOT 100vh — leaves room for a visible scroll cue without crowding). Generous top padding 120px below header. Copy in 480px column dead-center horizontally on the page (centered align). Image edge-flush below the copy, occupying the bottom 60% of viewport. NO copy-on-image overlay.
- Trust strip: 4 stat columns at 1100px max-width centered. ON cream-1.
- The Studio: 1-column stack — image full-width 16:9 at top (or 4:5 vertical centered, owner choice), copy below in 540px column centered horizontally. NO 50/50 split (50/50 belongs to A).
- Three Commitments: 3-column grid, NO card backgrounds, only 1px hairline dividers between columns. Padding zero on cards; spacing comes from gutters.
- A Wedding: 1 image at 21:9 full-bleed (the only place 21:9 appears in Direction C). 1 paragraph caption below at 540px max-width. NO 4:5 deck of supporting images. The single image must do all the work.
- Voices (pull-quote): ON `var(--ink-4)` — the page's ONE dark moment outside Begin. NO ornament behind. The blank space is the ornament. Italic serif at `clamp(24px, 3vw, 36px)`. Centered. Attribution below.
- The Investment: 3-column equal width, hairline dividers only (no card backgrounds), padding `var(--vow-card-padding)`. Featured tier (II) gets `var(--inv-tier-rule-featured)` 2px gold on top edge — that is the ONLY signal of "Most Chosen". NO badge. NO subtitle. The 2px is enough.
- The Method: 1-column stack. NO vertical rail (the rail belongs to A and B; Direction C uses simple section breaks). Each step: chapter tag + h3 + body. Spacing `var(--s-12)` between steps (48px).
- The Reel: edge-flush horizontal scroll-snap on `var(--cream-1)` (NOT ink — Direction C keeps cream where possible). Frames at `var(--reel-frame-min-width)`, aspect 4/5. NO arrow controls — the user scrolls. Native CSS only.
- Three Coastlines: 3-column on cream, NO overlay-on-hover. Each card is image + tag + h3 + 1 paragraph. Always visible.
- Considered Questions: NO accordion. The 5 questions stack as `<h3>` + `<p>` pairs in source, all answers always visible. This is the controversial Direction C move — the minimalist register would never hide content behind a click. Phase 5 verifies that the FAQ schema is preserved in JSON-LD even though the visual surface is open-by-default.
- Begin: dark `var(--ink-4)` section with NO image background. The text is the surface. Copy max-width `var(--inquiry-copy-max-width)` (720px), centered.

### Motion vocabulary (8 animations)

1. **Hero fade-in.** Single fade from opacity 0 to 1 over `var(--t-medium)` (0.55s). NO cascade, NO word-by-word.
2. **Image clip-reveal (single direction, vertical).** Used on each image as it enters viewport. Duration `var(--t-medium)`, easing `var(--ease)`.
3. **Manifesto fade.** The h2 and body fade in as a single block.
4. **Tier hover.** Border color shift only (NO lift), `var(--t-quick)`.
5. **CTA hover.** Gold underline draws across the button label using a `::after` pseudo at scaleX 0 → 1, transform-origin left, `var(--t-quick)` `var(--ease)`. NO background change.
6. **Link underline grow.** Same as CTA — gold underline only.
7. **Count-up on stats.** Same as A and B.
8. **(Reserved for FAQ if Phase 4 wants to add it back.)** Otherwise unused.

NO loader. NO magnetic cursor. NO grain. NO ornaments. NO chapter cards. NO Ken-Burns. NO parallax. NO marquee. NO ornament-pulse. NO scroll progress hairline. NO scroll-velocity. The motion budget is 8 because Direction C trusts the photography to do the work.

### Image art direction

- **16:9 and 4:5 only**, plus ONE 21:9 (case study hero). No mixed-ratio reels. Reel is 4:5 throughout.
- **Brightness 0.65-0.85** (lighter than A).
- **Saturation 0.95-1.05** (close to true).
- **Hero:** a single still life or detail shot — a folded program, a hand on a champagne flute, a strand of bougainvillea against linen. Implied luxury. NOT a wide ceremony, NOT a portrait.
- **Manifesto:** 4:5 vertical, intimate, golden-hour first-look or detail.
- **Case study hero:** 21:9 (the only cinemascope on the page).
- **Case study supporting:** ZERO. Direction C uses one image and one caption.
- **Reel:** 8-12 frames at 4:5, edge-flush.
- **Locations:** 3 cards at 3:4.
- **Inquiry:** NO image. The dark section IS the surface.
- All images edge-flush — no captions over images, no overlays, no labels in corners. The image is the feature; the caption sits below in restrained body type.

### Color treatment

60/40 cream-to-ink. Cream sections: Hero, Trust strip, Studio, Three Commitments, A Wedding, Investment, Method, Reel, Coastlines, Considered Questions. Ink sections: Voices, Begin. (Two ink sections only — they are the rests.)

Gold is sparse: italics in tier names, the 2px featured tier rule, the gold-deep eyebrows, the gold underline on CTAs. No gold backgrounds. No gold body text. The gold should feel like a reserved punctuation mark, not a color theme.

### Section structure (locked from Phase 1 IA)

Same 13 sections, same copy deck, with one Direction C exception: the FAQ section does NOT use accordion expansion — all answers are visible. The button-with-aria-expanded pattern from the a11y contract is REPLACED in Direction C with `<h3>` + `<p>` pairs. The FAQPage JSON-LD remains unchanged. Phase 5 verifies both: SR users hear answers as flowing prose; Google still sees the FAQ schema.

### Specific component patterns (Direction C interpretations)

- **Investment tiers:** Three columns, hairline dividers only. NO card background. NO bullet leader rules — bullets are unstyled `<li>` with `list-style: none` and a generous `var(--s-3)` (12px) leading. Roman numeral above name, sans, gold-deep, tracked. Italic name, italic lede. "Investment from" eyebrow above price. Price `var(--fs-24)`, weight 300. CTA at bottom: a single gold underline on the button label, no border, no background. Featured tier (II): 2px gold rule on top edge of column. No badge. No "Most Chosen" text. The 2px rule is the only indicator. This is Hermes-restraint applied to pricing.
- **FAQ:** As described above. `<ul>` of `<li>`, each `<li>` containing `<h3>` and `<p>`. No buttons. No icons. The visual rhythm is rooted in the body type, not in interaction affordance.
- **Pull-quote:** Italic serif on ink-4 background. Centered. Max-width 760px (narrower than A and B). NO ornament behind. Quote marks are typographic curly quotes only. Attribution below in sans `--fs-13` `--couple-name-tracking`.
- **Inquiry:** NO image background. Solid `--ink-4`. Copy at `--inquiry-copy-max-width` (720px) centered. Two CTAs side by side: Email (gold-underline button), WhatsApp (outline button). Meta strip below as a 3-cell flex group.

---

## How Phase 3 will use these prompts

Three agents start in parallel. Each builds a single self-contained HTML file:

- Agent A → `/luxury-weddings-preview-v6-a.html` (Editorial Vogue)
- Agent B → `/luxury-weddings-preview-v6-b.html` (Cinematic Film)
- Agent C → `/luxury-weddings-preview-v6-c.html` (Minimalist Refined)

Each preview has `<meta name="robots" content="noindex, nofollow">`. Each loads tokens.css first, dark-mode.css second, an inline `<style>` third. Each preserves the SEO head verbatim per Phase 1 §10. Each follows the locked copy deck and the a11y contract.

Phase 4 selects one of the three (owner decision) and promotes it to `/luxury-weddings.html`. Phase 5 runs the verification suite.

Each prompt above is complete and self-contained: the assigned agent does not need to read the other two prompts to do its work.

---

**End of Phase 3 Direction Prompts (Locked).**

Word count: ~7,200 words across three independent direction prompts. Each prompt covers aesthetic philosophy, moodboard, type system, layout grid, motion vocabulary (with explicit animation count), image art direction, color treatment, section structure (referencing the locked IA), and specific component patterns. Token usage from `/styles/tokens.css` (Wave 6 additions included). All three directions satisfy the same a11y contract and consume the same locked copy deck.
