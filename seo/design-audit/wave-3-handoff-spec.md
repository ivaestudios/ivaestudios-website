# Wave 3 — Developer Handoff Spec (`/index-preview-v3.html`)

> **Scope:** Implementation specification for the v3 cinematic-innovation homepage preview. Self-contained file — all CSS in one `<style>` block, all JS in one `<script>` at end of `<body>`. References `/styles/tokens.css` for tokens; loads `/dark-mode.css` and `/js/lang-switcher.css`.

## Overview

A clean-sheet luxury photography homepage preview for IVAE Studios. Eight editorial chapters tell a single narrative arc: **Light, Held Briefly → A Studio → A Light Study → The Reel → The Atlas → Reviews → Begin Inquiry → The Journal**. Built mobile-first, dark-mode default, no rounded corners (edge-flush brand), Cormorant Garamond + Syne typography only.

## Layout

- **Grid:** 12-col implicit; max content width 1280 px. All chapter padding uses `clamp(20px, 5vw, 48px)` horizontal.
- **Section vertical rhythm:** `clamp(96px, 12vw, 160px)` for full-bleed sections; sticky-stage manifesto runs full-viewport on desktop.
- **Breakpoints (mobile-first):**
  - `< 600 px`: single-column, simplified
  - `601–768 px`: tablet portrait
  - `769–1023 px`: tablet landscape / small laptop
  - `1024–1279 px`: laptop
  - `1280 px+`: desktop / wide

## Design Tokens Used

All from `/styles/tokens.css`. No hardcoded hex except SVG gradient stops (which mirror `--gold-deep`, `--gold`, `--gold-hover`).

| Category | Tokens |
|---|---|
| **Color (dark)** | `--ink-3` (page bg), `--ink-4` (deep bg), `--cream`, `--cream-1` (dossier section bg) |
| **Color (gold)** | `--gold`, `--gold-deep`, `--gold-hover`, `--gold-soft`, `--gold-line`, `--gold-glow` |
| **Color (text)** | `--text-on-dark`, `--text-on-dark-readable` (.82 alpha — body copy on dark), `--text-on-dark-2`, `--text-on-dark-3`, `--text-on-light-readable` |
| **Typography** | `--font-serif` (Cormorant), `--font-sans` (Syne), `--fs-9` through `--fs-display`, `--fs-12`, `--fs-14`, `--fs-16`, `--fs-21` |
| **Spacing** | `--s-1` through `--s-32`, `--s-section-y`, `--s-gutter` |
| **Motion** | `--ease`, `--ease-out`, `--ease-smooth`; `--t-fast` (.25), `--t-med` (.45), `--t-slow` (.9) |
| **Z-index** | `--z-cursor`, `--z-progress`, `--z-header`, `--z-loader`, `--z-skiplink` |
| **A11y** | `--touch-target-min` (44 px), `--focus-ring-on-dark`, `--focus-ring-offset` (3 px) |
| **Tracking** | `--tracking-eyebrow-tight`/`-base`/`-wide` (cap at .32em per design-critique §3) |

## Components & sections

### 1. Film Leader (loader)
- **What:** Fixed full-viewport overlay with a 1.85:1 framed counter that ticks 000 → 100 in 1.3 s, then unmasks via `clip-path: inset(0 0 100% 0)` over 1.4 s with `--ease-smooth`.
- **States:** loading (default), `.done` (animation-out).
- **A11y:** `aria-hidden="true"`. Skip-link is positioned outside this layer.
- **Reduced motion:** Skipped entirely; instantly resolves to `.done` and adds `body.loaded`.

### 2. Magnetic Cursor System
- Three layers: `.cur-dot` (8 px gold dot), `.cur-ring` (42 px outline circle), `.cur-preview` (220×280 px image preview, hidden by default).
- Lerp coefficients: dot 0.42, ring 0.18, preview tracks ring + 96 px x-offset.
- States: `body.cur-link` (over any `<a>` or `<button>`), `body.cur-cta` (over `.btn-magnetic.gold`/`.h-cta`/`.inq-cta`).
- Preview shows when an element has `data-preview="..."` attribute. Preview img src is swapped before fade-in.
- **Disabled:** `(hover: none)` (touch devices) and `prefers-reduced-motion: reduce`.

### 3. Site Header (`.site-header`)
- Fixed top, transparent until scroll > 24 px (then gains `rgba(10,15,23,.86)` + 18 px backdrop-blur).
- Touch-target compliance: 44 px min on all nav links and CTA.
- Mobile: nav collapses below 768 px, replaced with hamburger and `.m-nav` slide-down panel.
- A11y: `<nav aria-label="Primary">`, focus rings on all interactive elements (`--focus-ring-on-dark`).

### 4. Cinematic Hero (`.cinematic-hero`)
- Full-viewport. Three layers: `.ch-photo` (background image), `.ch-grain` (SVG noise), text content on top.
- **3D parallax:** `perspective: 1400px` on the section, `transform-style: preserve-3d` on `.ch-stage`. JS lerps mouse position into `rotateX(-1.2deg) rotateY(1.6deg)`.
- **H1 reveal:** four `.line` spans with overflow-hidden masks, `<span>` inside each translates from `110%` to `0` with 180 ms stagger between lines. Triggered after the leader animation completes.
- **Magnetic CTAs:** `data-magnet` attribute. Buttons translate toward cursor by 18% of distance.
- **Bottom meta strip:** four-cell runtime board (Frames Delivered, Coastlines, Reviews, Turnaround) with vertical gold rules between cells.
- **Touch fallback:** parallax disabled. Hero content renders identically.

### 5. Sticky-Stage Manifesto (`.manifesto`)
- 2-col grid. Left col: `position: sticky; top: 0; height: 100vh;` with single photo. Right col: 3 stacked text "chapters" totaling ~3× viewport height.
- Each chapter: chapter-tag eyebrow → h2 (Cormorant 300, italic accent in gold) → drop-cap lede paragraph → optional marginalia.
- **Drop cap:** `::first-letter { font-size: 5.4em; font-style: italic; color: var(--gold); float: left; }`
- **Marginalia:** italic Cormorant, left border `1px solid var(--gold-line)`, padding-left 18 px.
- **Tablet/mobile (≤1024 px):** `grid-template-columns: 1fr`, image becomes a static 80vh block above text.

### 6. Light Study (`.light-study`)
- Two-col grid (clock left / data right). 400×400 SVG clock.
- **Clock:** 24 ticks generated by JS at every 15° (every 6th tick is `.major` in gold). Two highlighted golden-hour arcs use `stroke-dasharray: 56 698; pathLength: 754` on a 754 px circumference circle. The full ring draws on via `stroke-dashoffset: 1200 → 0` over 2.4 s on `.vis`.
- **Pulse dot:** `r: 4 → 7 → 4` over 2.6 s infinite.
- **Spectrum bar:** linear gradient from `#6e4f17` (warm) through `#c9a54e` to `#6a7a96` (cool). Two `.ls-spectrum-band` boxes mark sunrise (8–21%) and sunset (78–92%).
- **Mobile (≤900 px):** clock shrinks to 380 px max; layout becomes 1-col.

### 7. Horizontal Portfolio Reel (`.reel`)
- 12 frames, mixed aspect ratios (3:4, 4:3, 5:7), in a flex `display: flex; gap: 6px; width: max-content`.
- Wrapper: `overflow-x: auto; scroll-snap-type: x mandatory; scroll-snap-align: start` per frame.
- Hidden scrollbar; native scroll on touch.
- **Controls:** Prev/Next buttons advance by one frame width (`frame.getBoundingClientRect().width + 6`), use `behavior: 'smooth'` (or `'auto'` for reduced motion).
- **Progress bar:** width = `(scrollLeft / (scrollWidth - clientWidth)) * 100%`.
- **Counter:** "01 / 12 Roll A" — the active frame is the one nearest `scrollLeft` (Manhattan distance).
- **A11y:** wrapper has `tabindex="0"`, `role="region"`, `aria-label`. Arrow keys (← →) advance frames.

### 8. Mexico Atlas (`.atlas`)
- 1100×780 SVG with stylised coastline (two paths approximating the Yucatán + Baja). Hand-drawn aesthetic; not a real geographic projection.
- **3 pins** (Cancún, Riviera Maya, Los Cabos): each a `<g class="atlas-pin">` with `tabindex="0"`, `role="button"`, `aria-label`.
- **Pin animation:** `r: 6 → 24` ping-out infinite over 2.4 s.
- **Hover/focus card:** `.atlas-card` absolutely positioned at preset coordinates per pin. Fades in with `opacity` + `translateY(8px) scale(.96) → 0/1`.
- **Click:** routes to `/cancun-photographer`, `/riviera-maya-photographer`, `/los-cabos-photographer`.
- **Mobile fallback (≤768 px):** SVG hidden via `display: none`; the `.atlas-list` (which is in the DOM by default for screen readers) becomes the only display. Each list-card retains `data-preview` for the cursor preview.

### 9. Pull Quote (`.pull-quote`)
- Massive `\201C` quote at `clamp(280px, 40vw, 560px)`, opacity .045, positioned absolute top-center.
- Quote text: Cormorant 300 italic at `clamp(28px, 3.6vw, 48px)`.
- Below: 3-column mini-testimonial grid with horizontal gold-line separator.
- **Mobile (≤900 px):** mini-grid collapses to single column.

### 10. Dossier (Three-Act Inquiry, `.dossier`)
- Light section (`--cream-1`) — only such section in the page (dramatic shift creates "you have entered the booking moment").
- 2-col grid (left: stepper / right: form).
- **Stepper:** numbered Roman I–III (Cormorant italic in `var(--gold-deep)`), each `.act` separated by 1px gold rule, with the connecting line drawn by `::before` pseudo-element behind the number.
- **Inquiry form:** "leather-bound dossier" treatment — outer 1px line + inner 1px gold line creating a double-frame; "No. 042 / 2026" frame number; "IVAE®" mark in italic Cormorant; inputs use Cormorant 300 italic placeholders, no rounded corners, gold underline on focus.
- **Submit:** prevents default, builds a `mailto:` link with the form's contents pre-filled in subject + body, opens user's email client.

### 11. Journal (`.journal-v3`)
- Bento grid: 1 large feat + 4 small tiles (`grid-template-columns: 2fr 1fr 1fr; jrn-feat spans 2 rows`).
- Each tile is a clickable `<a>` with absolute-positioned darkened image and bottom-aligned text content.
- **Hover:** image `transform: scale(1.08); filter: brightness(.5)`.
- **Mobile:** collapses 2-col then 1-col at 600 px.

### 12. Editorial Footer Masthead (`.colophon`)
- Top: oversized italic Cormorant wordmark "IVAE Studios" with the "Studios" set as a small-caps Syne tag.
- 4-col grid: Studio paragraph / Studio links / Coastlines / Direct lines.
- Bottom rule: copyright + "Set in Cormorant Garamond & Syne" + version label.

## States and Interactions

| Element | State | Behavior |
|---|---|---|
| `.btn-magnetic.gold` | Hover | bg `--gold-hover`, shadow `--shadow-gold-lg` |
| `.btn-magnetic.gold` | Focus-visible | `--focus-ring-on-dark` |
| `.btn-magnetic.outline` | Hover | bg `--gold-soft`, border `--gold`, color `--cream` |
| `.h-nav a` | Hover | color `--cream`; underline animates left-to-right `transform: scaleX(0 → 1)` |
| `.h-cta` | Hover | bg `--gold-soft`, color `--cream` |
| `.atlas-pin` | Hover/Focus | dot `r: 6 → 9`; corresponding `.atlas-card` fades in |
| `.atlas-pin` | Click | navigates to destination landing |
| `.atlas-pin` | Keyboard | Enter/Space triggers click; gold focus ring |
| `.reel-frame` | Hover | image `transform: scale(1.045); filter: saturate(1.05) brightness(1)` |
| `.reel-btn` | Hover | bg `--gold-soft`, border `--gold` |
| `.reel-btn` | Disabled | opacity .35, cursor not-allowed |
| `.inq-field input/select/textarea` | Focus | border-bottom `--gold-deep` |
| `.inq-cta` | Hover | bg `--gold-deep`, border `--gold-deep` |
| `.h-burger` | Open | top/bottom bars rotate ±45°, middle bar fades to opacity 0 |

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| **≥1280 px** | Default 2-col layouts everywhere; full SVG map; full reel scroll |
| **1024–1279 px** | Footer cols 4 → 2; journal grid 3 → 2 |
| **769–1023 px** | Manifesto becomes 1-col (image first then 3 text chapters); Light Study becomes 1-col; Dossier becomes 1-col |
| **≤900 px** | Pull-quote mini grid collapses to 1 col; Light Study clock max-width 380 px |
| **≤768 px** | Header nav hides → burger; Atlas SVG hidden, shows `.atlas-list` only; Hero meta strip stacks vertically |
| **≤600 px** | Inquiry form rows collapse to 1 col; footer cols 1; journal 1 col; pull-quote padding reduced |

## Edge Cases

- **No JS:** All content remains visible. Reveal animations skip; `.rv` items remain at default visible state via `prefers-reduced-motion` fallback (not perfect — needs JS to add `.vis`). **Recommendation:** add `<noscript><style>.rv,.curtain,.line>span,.ls-clock-arc,.atlas-coast{opacity:1!important;transform:none!important;clip-path:inset(0 0 0 0)!important;stroke-dashoffset:0!important}</style></noscript>` if the page goes to production.
- **Slow connections:** Hero image preloaded via `<link rel="preload" as="image" fetchpriority="high">`. All other images `loading="lazy"`. The `.film-leader` masks first paint, so visitors see brand before they see incomplete photos.
- **Empty form:** Submit handler validates email (the only required field). Visual error: borderBottomColor flash. No alerts (preserves the editorial mood).
- **Long names in inquiry "name" field:** Input is `font-size: 18px`, will scale; field is in a 50%-width grid cell at desktop, full-width at mobile. Tested with 60-char names — wraps cleanly into the email body.
- **Long testimonial text:** `.pq-text` has `max-width: 980px` enforced by `.pq-inner`. Lines wrap at natural points.
- **Map at extreme zoom:** SVG `viewBox` preserves aspect; pins remain at correct relative positions. Card positions use viewport-relative `%` not pixel coordinates.

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| `.film-leader` | Page load | Counter 000→100 then `clip-path` slide-up | 1.3 s + 1.4 s | `--ease-smooth` |
| `.ch-h1 .line>span` | After leader done | translateY(110%) → 0 (per line, 180 ms stagger) | 1.4 s | `--ease-out` |
| `.ch-stage` | Mouse move | `rotateX/rotateY` 3D parallax | rAF loop, 0.06 lerp | linear (lerp) |
| `.ch-photo` | Mouse move | `translate3d(x,y,-200px)` | rAF loop | linear (lerp) |
| `.cur-dot` | Mouse move | translate to cursor (lerp 0.42) | rAF loop | linear |
| `.cur-ring` | Mouse move | translate to cursor (lerp 0.18) | rAF loop | linear |
| `.cur-preview` | data-preview hover | opacity 0→1, scale .9→1 | .35 / .55 s | `--ease` |
| `.btn-magnetic[data-magnet]` | Mouse move | translate toward cursor center × 0.18 | rAF | linear (lerp) |
| `.rv` | IntersectionObserver | opacity 0→1, translateY(28px)→0 | 1.0 / 1.1 s | `--ease` |
| `.curtain` | IntersectionObserver | clip-path inset(0 100% 0 0) → 0 | 1.4 s | `--ease-smooth` |
| `.ls-clock-arc` | `.vis` | `stroke-dashoffset: 1200 → 0` | 2.4 s | `--ease-out` |
| `.ls-clock-pulse` | infinite | `r: 4 → 7 → 4`, opacity 1→.6→1 | 2.6 s | `--ease-smooth` |
| `.atlas-coast` | `.vis` | `stroke-dashoffset: 3000 → 0` | 3.2 s | `--ease-out` |
| `.atlas-pin-ring` | infinite | `r: 6 → 24`, opacity .6→0 | 2.4 s | `--ease-smooth` |
| `.atlas-card` | pin hover/focus | opacity 0→1, translateY(8px) → 0, scale .96 → 1 | .35 / .55 s | `--ease` |
| `.scroll-prog` | scroll | `transform: scaleX(0 → 1)` | per frame | linear (rAF) |
| `.ch-scroll-line::after` | infinite | translateX(-100% → 100%) | 2 s | `--ease-smooth` |

## Accessibility Notes

(See `wave-3-accessibility-report.md` for full WCAG 2.1 AA audit.)

- **Focus order:** skip-link → header logo → nav links (5) → CTA → main content (hero h1 → hero CTAs → meta-link → manifesto chapters → light study stats → reel wrapper → reel buttons → atlas pins or list → pull-quote (no focusable) → dossier acts (decorative) → form fields → journal cards) → footer links.
- **ARIA labels:** every section has `aria-labelledby` pointing to its visible h2. The hero meta-strip and `.ch-chapter` use `aria-hidden="true"` for decorative film-credits content. Atlas pins are explicit `role="button"`. The mobile burger uses `aria-expanded` toggling.
- **Keyboard:** All interactive elements reachable. Reel wrapper accepts arrow keys. Esc closes mobile nav. Atlas pin Enter/Space triggers click.
- **Screen reader:** Atlas decorative SVG has `role="img"` + `<title>`. The `.atlas-list` is always in the DOM (not just on mobile) so SR users always have the same content.
- **Touch targets:** All `<a>` and `<button>` enforce `min-height: var(--touch-target-min)` (44 px). Verified.
- **Contrast:** All body text uses `--text-on-dark-readable` (.82 alpha = 7.6:1 against `--ink-3`). Eyebrows in `--gold` (4.7:1 against `--ink-3`). Verified — see accessibility report.

## Performance Notes

- Hero image preloaded with `fetchpriority="high"`.
- All other images `loading="lazy"`, `width`/`height` attributes set to prevent CLS.
- All animations use `transform` and `opacity` only — no layout-thrashing properties.
- `will-change` declared on parallax stage, photo, and cursor elements.
- `requestAnimationFrame` throttling on scroll handlers.
- IntersectionObserver root margin `0px 0px -8% 0px` — fires reveals 8 % before viewport bottom.
- SVG noise in `body::after` is inline (no extra HTTP request).

## Implementation TODOs (for owner)

1. **Hero video:** swap `.ch-photo` `<div>` for `<video poster="images/wedding-bride-tulum-ivae-studios.jpg" autoplay muted loop playsinline>` once Vianey provides a 6–8 s clip. Recommended: 1920×1080, H.264 + WebM, ≤2 MB.
2. **Real testimonials:** Replace the three names (Samantha Whitfield / Marco Benedetti / Priya Raghavan / Elena V.) with real-client reviews — see CLAUDE.md handoff Tier 2/3.
3. **Real session pricing:** The light-study stats are factual, but the journal/case-study reference to "$48,000 destination wedding" is editorial — confirm with Vianey before promoting v3 to production.
4. **GBP phone:** "+52 998 758 2363" carried over verbatim — see CLAUDE.md Tier 0. Replace with real GBP phone in `index.html` first, then propagate here.
5. **Atlas pin coordinates:** stylised, not geographically accurate. If Vianey wants a real map, swap the SVG path data for a simplified TopoJSON of MX-ROO + MX-BCS.
6. **Set `<meta name="robots" content="noindex, nofollow"/>`** is already in place — must remain until v3 is promoted to `/index.html`.
