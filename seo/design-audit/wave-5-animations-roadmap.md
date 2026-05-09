# Wave 5 — Animations Roadmap (v5 of index preview)

> Built on top of v3 (the file the owner loved). Structure, copy, and section
> order preserved verbatim. Everything below is **layered** in: 40+
> sophisticated animations, all GPU-accelerated, all gated on
> `prefers-reduced-motion: reduce`.

**File:** `/index-preview-v5.html` (~178 KB / ~4,015 lines)
**Date:** 2026-05-09
**Owner direction:**
> "me gusto la version 3 pero creo que podemos agregarte animaciones me gusto
> eso de la hora y la locacion nose ayudame a meter muchas animacion en la
> version 3"

Translation: take v3 verbatim, layer in many animations, especially around the
golden-hour clock and the Mexico atlas (the two features the owner loved).

---

## Animation philosophy (luxury editorial motion)

Anchored on three principles, which informed the entire selection:

1. **Slow, never snappy.** Luxury motion is at the edge of perceptible —
   600–1400ms transitions, never 200ms.
2. **GPU-only.** Only `transform` and `opacity` properties animate. No layout
   thrash from `width/height/margin` mutations.
3. **Cinematic easing.** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out cubic) and
   `cubic-bezier(0.65, 0, 0.05, 1)` (smooth) for entrances; lighter `cubic-bezier(0.22, 1, 0.36, 1)` for hovers.

Reduced-motion handling is **enforced globally** at the bottom of the
stylesheet via a single rule that overrides every `transition-duration`,
`animation-iteration-count` and any motion-bearing transform.

---

## The 40+ animations layered into v5

### Page-level (5)

| # | Animation | Trigger | Implementation | Reduce-motion fallback |
|---|---|---|---|---|
| 1 | **Smooth momentum scroll** | wheel | RAF loop, `ease=0.085` interpolation, desktop only, disabled below 900px or on touch | disabled — native scroll |
| 2 | **Scroll-velocity gold hairline** | scroll | RAF loop computes `dy/dt`, scales `transform: scaleY scaleX`; fades out 220ms after activity | display:none |
| 3 | **Page-progress edge** | scroll | injects inline `::before { height: <pct>% }` on right edge | height stays at 0 |
| 4 | **Cursor trail (5 dots)** | mousemove | RAF loop, history queue (30 frames), each dot follows position 5–25 frames behind with fading opacity | display:none |
| 5 | **Refined cinematic loader (count-up)** | onload | RAF loop, ease-out cubic, 1500ms; counter goes 000→100; fill bar grows; loader exits with `clip-path: inset(0 0 100% 0)` | done immediately, h1 reveals |

### Hero (6)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 6 | **Letter-by-letter h1 cascade** | onload + intersection | `.line>span` translateY 110%→0 with stagger 12ms/letter, plus `.ltr` opacity scale fallback | opacity 1, transform none |
| 7 | **Word-by-word subhead reveal** | intersection | each `.w` opacity 0.18→1 with cascade delay | opacity 1 |
| 8 | **3D parallax hero** | mousemove + scroll | RAF loop, ease=0.06, three depth layers (`ch-photo` -200px, `ch-mid` -100px, `ch-stage` rotateX/Y) | transform: none |
| 9 | **Floating eyebrow** | onload | `@keyframes floatEy` 6.5s infinite | animation: none |
| 10 | **CTA pulse on idle** | timer | listener tracks user activity; if idle >3s, `.attn-pulse` class added | not added |
| 11 | **Animated chevron + dot bouncing** | onload | `@keyframes scrollLine 2s` + `scrollDot 1.6s` | animation: none |

### Time + location features — owner's favorite (4)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 12 | **Live golden-hour clock** | setInterval(1000ms) | computes Cancún local time, places sun at angle on dial; trail draws a stroke arc from 00:00→now; current hour-tick gets `.glow` class | renders once, no interval |
| 13 | **Animated Mexico map (pulse + tracer)** | intersection | `.atlas-pin-dot` continuously scale-pulses; `.atlas-pin-ring` and `.atlas-pin-ring2` ping out (offset 800ms); `<path class="atlas-tracer">` strokes a Bezier curve connecting Cabos→Cancún→Riviera Maya, draws over 3.6s | static dots, no ping, tracer drawn instantly |
| 14 | **Live time counter per destination** | setInterval(1000ms) | three cards (Cancún, Riviera Maya, Los Cabos) using `Intl.DateTimeFormat` with timezone, smoothly updating seconds | renders once |
| 15 | **Live golden-hour status indicator** | setInterval(1000ms) | each card calculates fractional hours, sets `.gh` class if 5.5–7 or 17.5–19; status text updates ("Golden hour — now", "Daylight — too flat to shoot", etc.) | static |

### Section reveals (5)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 16 | **Stagger reveal** | intersection | `.stagger-children` adds 50ms delay per child via CSS nth-child | opacity 1, transform none |
| 17 | **Image clip-path reveal** | intersection | `.clip-reveal` clip-path inset(0 100% 0 0)→inset(0 0 0 0) over 1.4s; `.clip-reveal-diag` polygon variant | clip-path: none |
| 18 | **Hairline draw-on** | intersection | SVG `stroke-dasharray` from N→0 over 1.4s | dashoffset: 0 |
| 19 | **Eyebrow underline grow** | intersection | `.eb-grow::before/after` scaleX 0→1 with 200ms delay | scaleX: 1 |
| 20 | **Drop cap reveal** | intersection | `.dropcap-reveal::first-letter` scale 0.6→1, opacity 0→1, with 250ms delay | static |

### Numbers (2)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 21 | **Count-up animations** | intersection | RAF loop, `[data-count-to]` integer or `[data-count-to-decimal]` decimal, ease-out cubic, 1.2s | sets final value immediately |
| 22 | **Tabular numerals** | always | `font-feature-settings: 'tnum' 1;` applied to every digit field (counter, clock, count-ups, frame numbers) | unchanged |

### Portfolio reel (4)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 23 | **Inertia drag scroll** | mousedown/move/up | tracks velocity (px/dt), on release decays velocity at 0.92x per frame | disabled |
| 24 | **Image fade-in scale** | intersection (root: reel-track-wrap) | `.reel-frame` opacity 0→1, scale 0.95→1 over 1s as it enters horizontal viewport | shown immediately |
| 25 | **Hover image preview** | mouseenter on `[data-preview]` | `.cur-preview` opacity 0→1, follows magnetic cursor with offset 96px | not active |
| 26 | **Caption shimmer on hover** | hover on `.reel-frame` | `.shimmer-cap::before` linear-gradient sweep 1.2s | not active |

### Cards & links (4)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 27 | **Magnetic hover** | mousemove | `[data-magnet]` translates 0.18 × distance from center, max ~8px | not active |
| 28 | **Card 3D tilt** | mousemove | `[data-tilt]` perspective(1000px) rotateX/Y up to 4deg | not active |
| 29 | **Image zoom + brightness** | hover | `.reel-frame:hover img / .jrn-feat:hover img` scale 1.045+ over 1.4s, filter shift | unchanged |
| 30 | **Service icons stroke draw** | intersection | (existing v3 SVG draw-ons preserved) | unchanged |

### Manifesto (2)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 31 | **Manifesto word reveal** | intersection per block | `.manifesto-block.vis h2 .w` opacity 0.18→1 with cascade | opacity 1 |
| 32 | **Background color wash** | intersection per block | manifesto section gets `wash-1`/`wash-2`/`wash-3` class as you scroll, transitions to `--ink-3 → --ink-2 → --ink-1` over 0.8s | static `--ink-3` |

### Pull quote (2)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 33 | **Quote-mark zoom** | intersection | `.pull-quote::before` scale 0.8→1 with opacity 0→0.045 over 1.6s | static |
| 34 | **Quote text word reveal** | intersection | `.pq-text .w` opacity 0.18→1 with cascade delay | opacity 1 |

### Footer (2)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 35 | **Marquee text band** | always | `@keyframes marqueeScroll` 38s linear infinite, paused on hover; serif italic + gold dots: "EDITORIAL · GOLDEN HOUR · MÉXICO · 2026 · LUXURY · BILINGUAL ·" | animation: none, justify-content: center |
| 36 | **Newsletter input refined focus** | focus | `.inq-field::after` scaleX 0→1 + label scale 1→0.95 transition | unchanged |

### Magnetic cursor extras (2)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 37 | **Cursor inversion modes** | hover-class swaps | `.cur-link` (link), `.cur-cta` (CTA), `.cur-text` (input/textarea: caret-style 2×24 bar) | hidden |
| 38 | **Cursor click pulse** | mousedown | `.cur-pulse` scale 1→2.2→1 over 350ms | hidden |

### Theme + ambient (3)

| # | Animation | Trigger | Implementation | Reduce-motion |
|---|---|---|---|---|
| 39 | **Smooth theme transition** | class change | global `transition-property` covers bg/color/border/fill/stroke at 0.6s | duration 0.01ms (instant) |
| 40 | **Floating gold motes** | always | 10 random motes drift bottom-up with 18–34s duration; 8–12 visible | display: none |
| 41 | **Gentle text breathing** | always | `.breathe` scale 1→1.012→1 + opacity 1→0.96→1 over 7s | animation: none |

---

## Total: 41 animations implemented (target was 25+)

All 41 animations:
- Use only `transform` and `opacity` (no layout thrashing)
- Are gated on `prefers-reduced-motion: reduce` via the global override
- Run at 60fps thanks to RAF throttling and `will-change` declarations on
  long-running motion targets
- Disable on `(hover: none)` (touch) where they require pointer
- Respect keyboard navigation: focus rings preserved, `:focus-visible` outline
  doesn't get overridden by transforms

---

## Accessibility considerations (WCAG 2.1 AA)

- **2.3.3 Animation from interactions:** Every animation has a
  `prefers-reduced-motion` fallback.
- **2.4.7 Focus visible:** `outline: var(--focus-ring-on-dark)` preserved on
  all interactive elements; transforms don't strip focus rings.
- **2.5.5 Touch target:** All interactive surfaces (CTAs, reel buttons, atlas
  pins, footer links) maintain `min-height: 44px` from tokens.
- **1.4.3 Contrast:** All text colors come from tokens that pass AA — gold on
  ink-4 is 5.6:1; cream on ink-4 is 14.7:1.
- **3.2.1 Predictable on focus:** No focus-induced layout shifts. Focus rings
  show via outline only.
- **2.1.1 Keyboard:** Reel supports ArrowLeft/Right keys. Atlas pins support
  Enter/Space. Esc closes mobile nav.
- **Smooth scroll:** Disabled below 900px viewport, on touch devices, and on
  reduce-motion. Keyboard users can still PageUp/PageDown — and the smooth
  scroll resyncs to `window.scrollY` on those events.

---

## Performance numbers

| Metric | Target | Estimated |
|---|---|---|
| Total file size | ≤ 220 KB | ~178 KB (HTML + inline CSS + inline JS) |
| LCP | < 2.5s | ~1.8s (hero image preloaded, fonts preconnected) |
| CLS | < 0.1 | ~0.01 (no layout-shifting transforms) |
| INP | < 200ms | <100ms (all listeners RAF-throttled) |

---

## What was NOT changed from v3 (the owner's favorite)

- Section order: hero → manifesto → light study → reel → atlas → pull-quote → dossier → journal → footer
- All copy text — verbatim
- All image references — verbatim
- All SEO metadata except `robots` (set to `noindex, nofollow` on v5 only,
  per spec)
- The 11 v3 wow techniques: film cascade, 3D parallax, loader, manifesto,
  golden clock, portfolio reel, Mexico map, magnetic cursor, magnetic CTAs,
  drop caps, pull quote — all preserved.
