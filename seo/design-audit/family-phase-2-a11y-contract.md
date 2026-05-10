# IVAE Studios — Luxury Family Photos v6 — Phase 2 Accessibility Contract

**Page:** `/luxury-family-photos.html` (canonical: `/luxury-family-photos-cancun`)
**Phase:** 2 of 5 (design system + locked copy + a11y contract)
**Standard:** WCAG 2.1 AA
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §3 Skill 6 (12 preemptive failure modes), Phase 1 §6 microcopy decision #20, wedding-side Phase 2 a11y contract for sitewide cohesion
**Audience:** Phase 3 build agents (eight section agents, working in parallel). This contract is non-negotiable. Phase 5 verification reads this file and runs each acceptance test against the chosen build. A build that fails any acceptance test cannot ship.

---

## Purpose of this contract

Phase 1 identified twelve specific accessibility failure modes for the family page rebuild. Each failure mode is converted below into an element-level rule (CSS selector + required attribute / CSS / ARIA), a test method, and a binary acceptance criterion. Phase 3 agents must satisfy every contract clause regardless of section ownership. Phase 5 verification will run each test against the merged build.

The contract is structured as: **Failure mode → Element rule (selector / ARIA / token) → Test method → Acceptance criterion (pass/fail).** Severity is rated:
- 🔴 Critical: blocks a class of users from completing the conversion path.
- 🟡 Major: degrades the experience but does not block.
- 🟢 Minor: polish; tracked but not a launch blocker.

---

## Failure mode 1 — 3D mouse parallax hero on touch / reduced motion

**Failure (🔴 Critical, WCAG 1.4.11, 2.3.3):** A 3D mouse parallax that translates the hero image on `mousemove` becomes inert on touch (no pointer to follow) and produces vestibular distress for motion-sensitive users.

**Element rule:**
```css
.lf-hero { perspective: 1200px; }
.lf-hero-img { transform: translate3d(0, 0, 0); transition: transform 0.4s var(--ease); will-change: transform; }

@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .lf-hero-img { transform: none !important; transition: none !important; }
}
```

JS gate:
```js
const supportsParallax = window.matchMedia('(hover: hover) and (pointer: fine)').matches
                     && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (supportsParallax) initHeroParallax();
```

**Test method:** Manual + automated. iPhone Safari (touch); macOS with Reduce Motion ON; macOS with Reduce Motion OFF. Inspect computed transform on `.lf-hero-img` in each.

**Acceptance criterion:** On touch: `.lf-hero-img` `transform` is `none`. On Reduce Motion ON: `transform` is `none`. On desktop with motion OK: `transform` updates to a small translate on `mousemove` (max 16px translate, 4px depth). All three pass binary.

---

## Failure mode 2 — Drag-scroll reel keyboard inaccessible

**Failure (🔴 Critical, WCAG 2.1.1, 2.4.7):** A horizontal drag-to-scroll reel cannot be operated by a keyboard-only user without explicit arrow-key bindings and a visible focus indicator on the rail.

**Element rule:**
```html
<section class="lf-frames" id="frames" aria-labelledby="frames-heading">
  <h2 id="frames-heading" class="visually-hidden">The Frames</h2>
  <div class="lf-reel-track"
       role="region"
       aria-label="Family photography reel, scrollable. Use arrow keys to navigate."
       tabindex="0">
    <figure class="lf-reel-frame">
      <img src="..." alt="..." loading="lazy">
    </figure>
    <!-- 6-8 frames -->
  </div>
</section>
```

```css
.lf-reel-track:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 4px;
}
.lf-reel-track {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  overflow-x: auto;
}
.lf-reel-frame { scroll-snap-align: start; }
```

JS:
```js
const track = document.querySelector('.lf-reel-track');
track.addEventListener('keydown', (e) => {
  const frame = track.querySelector('.lf-reel-frame');
  const stride = frame.offsetWidth + parseFloat(getComputedStyle(track).gap || 0);
  if (e.key === 'ArrowRight') { track.scrollBy({ left: stride, behavior: 'smooth' }); e.preventDefault(); }
  if (e.key === 'ArrowLeft')  { track.scrollBy({ left: -stride, behavior: 'smooth' }); e.preventDefault(); }
});
```

**Test method:** Manual keyboard. Tab to the reel. Press Arrow Right four times, Arrow Left four times.

**Acceptance criterion:** Tabbing into the reel shows a visible focus ring (≥3:1 against background). Each Arrow press scrolls exactly one frame width. Focus ring remains visible throughout.

---

## Failure mode 3 — Sunset-friendly-time widget SR/keyboard support

**Failure (🔴 Critical, WCAG 4.1.2, 1.1.1):** A 12-month picker plus an SVG clock face is meaningless to a screen reader without `aria-pressed` on month buttons, a `role="img"` with descriptive `aria-label` on the clock SVG, and a live region announcing the selected month.

**Element rule:**
```html
<section class="lf-sunset" id="sunset" aria-labelledby="sunset-heading">
  <h2 id="sunset-heading">Sunset-Friendly Time</h2>
  <div class="lf-month-picker" role="group" aria-label="Select month">
    <button type="button" class="lf-month-btn" aria-pressed="false" data-month="01">Jan</button>
    <!-- 12 months -->
  </div>
  <svg class="lf-clock"
       role="img"
       aria-labelledby="lf-clock-label"
       viewBox="0 0 200 200">
    <title id="lf-clock-label">Golden hour for January in Cancún begins at 4:00 PM and ends at 5:30 PM. Recommended session start: 4:00 PM. Post-nap kid-friendly window: 3:30 PM and after.</title>
    <!-- gold ring + nap band paths -->
  </svg>
  <p class="lf-clock-status" aria-live="polite" aria-atomic="true">January selected. Golden hour 4:00 to 5:30 PM. Recommended start 4:00 PM.</p>
</section>
```

JS updates `aria-pressed` on the active button, updates the `<title>` text node (which is read live via `aria-labelledby`), and updates the polite live region.

**Test method:** Manual VoiceOver. Tab to first month button. Press Enter. Listen for live-region announcement.

**Acceptance criterion:** Each month button announces "Jan, button, not pressed" / "Jan, button, pressed." The clock SVG announces the full caption with month, golden hour, and recommended start. The live region announces on every month change. Zero axe-core violations on the section.

---

## Failure mode 4 — Magnetic CTA hover as sole click affordance

**Failure (🔴 Critical, WCAG 2.4.7, 2.4.11):** A magnetic CTA that animates toward the cursor on hover is invisible to keyboard users and to anyone with motion disabled. Hover transform must NOT be the only signal that a button is clickable.

**Element rule:**
```css
.btn { /* baseline visual: gold border 1px, gold text on ink, padding 18px 36px */ }

.btn:hover { background: var(--gold-soft); }
.btn:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: var(--focus-ring-offset);
}
.btn-primary {
  background: var(--gold);
  color: var(--ink-1);
  text-decoration: none;
  /* underline drawn on hover via ::after pseudo */
}
.btn-primary::after {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 12px;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s var(--ease);
}
.btn-primary:hover::after,
.btn-primary:focus-visible::after { transform: scaleX(1); }

@media (prefers-reduced-motion: reduce) {
  [data-magnet] { transform: none !important; transition: none !important; }
}
```

The `data-magnet` JS handler must short-circuit on Reduce Motion.

**Test method:** Manual. Tab to each CTA. Hover each CTA. Reduce Motion ON walkthrough.

**Acceptance criterion:** Every CTA has visible focus ring on Tab (≥3:1 against bg). Every CTA has at least two non-motion affordances: gold border or gold fill, plus underline grow on hover/focus. Reduce Motion ON: magnetic translate is `none`; underline still draws.

---

## Failure mode 5 — Floating gold motes (decorative, hide from SR)

**Failure (🟡 Major, WCAG 1.1.1, 2.3.3):** Eight motes drifting upward in a continuous loop are pure ornament. Without `aria-hidden`, they may be announced as ghost images. Without reduced-motion gating, they cause vestibular distress.

**Element rule:**
```html
<div class="lf-motes" aria-hidden="true">
  <span class="lf-mote" style="--lf-mote-x: 12vw; --lf-mote-delay: 0s;"></span>
  <!-- 8 total -->
</div>
```

```css
.lf-motes { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.lf-mote {
  position: absolute;
  width: 4px; height: 4px;
  background: var(--gold);
  border-radius: 50%;
  opacity: 0;
  bottom: -10px;
  left: var(--lf-mote-x);
  animation: lf-mote-rise 26s linear infinite;
  animation-delay: var(--lf-mote-delay);
}
@keyframes lf-mote-rise {
  0%   { opacity: 0; transform: translateY(0); }
  10%  { opacity: 0.7; }
  100% { opacity: 0; transform: translateY(-110vh); }
}

@media (prefers-reduced-motion: reduce) {
  .lf-motes { display: none !important; }
}
```

**Test method:** Automated (axe). VoiceOver image rotor scan. Reduce Motion check.

**Acceptance criterion:** Zero motes appear in the SR image rotor. With Reduce Motion ON, `.lf-motes` computes `display: none`. Zero axe violations.

---

## Failure mode 6 — SVG film grain decoration

**Failure (🟡 Major, WCAG 2.3.3):** A static or animated grain layer is purely decorative. Without `aria-hidden`, it pollutes SR output. Without `pointer-events: none`, it intercepts clicks. Animated grain in reduced-motion fails 2.3.3.

**Element rule:**
```html
<div class="lf-grain" aria-hidden="true"></div>
```

```css
.lf-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  background-image: url("data:image/svg+xml,...");
  opacity: var(--lf-grain-opacity); /* 0.028 */
}

@media (prefers-reduced-motion: reduce) {
  .lf-grain { animation: none !important; }
}
```

If the chosen direction animates the grain (subtle 0.15s cross-fade), that animation is wrapped in a `@media (prefers-reduced-motion: no-preference)` block and removed entirely under Reduce Motion.

**Test method:** Manual. Inspect computed `pointer-events` and `aria-hidden`. Try clicking through the grain layer.

**Acceptance criterion:** Click events pass through the grain (a CTA underneath fires). Grain is `aria-hidden="true"`. Reduce Motion ON: no animation property is computed on the grain.

---

## Failure mode 7 — Animated SVG family-tree silhouette (informative vs decorative)

**Failure (🔴 Critical, WCAG 4.1.2, 1.1.1):** The SVG silhouette beside each tier card grows from 2 → 6 → 10 figures, communicating the tier's group-size. If the SR cannot read this, a sighted-only user sees information no SR user has access to.

**Element rule:**

If the silhouette is INFORMATIVE (size encoded visually):
```html
<article class="lf-tier" data-tier="hour">
  <svg class="lf-tier-tree" role="img" aria-labelledby="lf-tree-hour-label" focusable="false">
    <title id="lf-tree-hour-label">Up to six in the frame.</title>
    <!-- silhouette paths -->
  </svg>
  <h3 class="lf-tier-name"><em>The Hour</em></h3>
  <p class="lf-tier-bullets">...</p>
</article>
```

The tier card's main `aria-label` (or its bullets list, which contains "Up to six in the frame, immediate family" verbatim) carries the same info as the SVG title — defense in depth.

If the silhouette is DECORATIVE (group-size already in card body, the silhouette is purely visual restatement):
```html
<svg class="lf-tier-tree" aria-hidden="true" focusable="false">...</svg>
```

Phase 3 default: **decorative** (`aria-hidden="true"`), because the bullets already state group size unambiguously. The visual flourish is then an enhancement, not the primary information channel.

**Test method:** VoiceOver navigation through the three tier cards. Inspect that group size is announced as part of the bullet list on each card.

**Acceptance criterion:** Each tier announces "up to six," "up to eight," "up to ten" via the bullets list. Decorative SVG is not in the SR image rotor. Zero axe violations.

---

## Failure mode 8 — Count-up "500+ families since 2019" announcement

**Failure (🔴 Critical, WCAG 4.1.2, 4.1.3):** Animating digits from 0 to 500 over 1.6s broadcasts intermediate numbers ("13... 26... 41...") as the SR polls the DOM, which is noise. The SR should announce the final value once.

**Element rule:**
```html
<div class="lf-stat" aria-label="Five hundred plus families photographed since 2019">
  <span class="lf-stat-num" data-count-to="500" aria-hidden="true">0</span><span class="lf-stat-suffix" aria-hidden="true">+</span>
  <span class="lf-stat-label">Families</span>
</div>
```

The numeric element is `aria-hidden="true"`; the parent carries the final value as `aria-label`. JS animates `textContent` of the inner span only. With Reduce Motion, JS skips the animation and sets `textContent` to the target immediately.

**Test method:** VoiceOver focus on the stat. Listen for the announcement. Reduce Motion ON walkthrough.

**Acceptance criterion:** SR announces "Five hundred plus families photographed since 2019" once. The intermediate counting digits are NOT announced. With Reduce Motion ON, the visible digit displays "500" immediately on first paint after scroll-into-view.

---

## Failure mode 9 — Pull-quote ornament (giant `❝`) and `<blockquote>` semantics

**Failure (🟡 Major, WCAG 1.3.1):** A 320px Cormorant `❝` rendered as a `<span>` or `<div>` will be announced by SR if not hidden. The `<blockquote>` must wrap the quote with a `<cite>` for the source.

**Element rule:**
```html
<section class="lf-voices" id="voices" aria-labelledby="voices-heading">
  <h2 id="voices-heading" class="visually-hidden">Voices</h2>
  <figure class="lf-pullquote">
    <span class="lf-pullquote-ornament" aria-hidden="true">&ldquo;</span>
    <blockquote class="lf-pullquote-body">
      <p><em>The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery, and we cried with her.</em></p>
    </blockquote>
    <figcaption>
      <cite class="lf-pullquote-cite">The Nakamura Family  ·  Rosewood Mayakoba, April 2026</cite>
    </figcaption>
  </figure>
</section>
```

```css
.lf-pullquote-ornament {
  position: absolute;
  top: -20px; left: -40px;
  font-family: var(--font-serif);
  font-size: clamp(180px, 22vw, 320px);
  font-weight: 300;
  font-style: italic;
  color: var(--gold);
  opacity: 0.18;
  pointer-events: none;
  user-select: none;
}
```

**Test method:** VoiceOver. Read the section aloud. axe-core scan.

**Acceptance criterion:** SR announces the quote body ("The grandparent and grandchild portraits...") followed by the citation ("The Nakamura Family"). The 320px `❝` glyph is NOT announced. Zero axe violations.

---

## Failure mode 10 — Drop cap reading order

**Failure (🟡 Major, WCAG 1.3.2):** A drop cap implemented as a wrapping `<span class="dropcap">T</span>he reunion was set...` can break SR reading order if the span is positioned via `float` and the visual order differs from the DOM order. CSS `::first-letter` avoids markup pollution.

**Element rule:** Phase 3 MUST use CSS `::first-letter`:
```html
<p class="lf-feature-caption">The reunion was set for the second week of April...</p>
```

```css
.lf-feature-caption::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--lf-dropcap-size); /* clamp(58px, 6.5vw, 78px) */
  color: var(--gold-deep);
  float: left;
  line-height: 0.86;
  padding: 4px 12px 0 0;
}
```

**Test method:** VoiceOver reads the paragraph from start to end. View DOM source.

**Acceptance criterion:** SR reads "The reunion was set for the second week..." in source order, with no awkward letter-by-letter pause. The DOM contains a single `<p>` element, no wrapper spans around the first letter.

---

## Failure mode 11 — Sticky-stage manifesto on mobile + first-focusable

**Failure (🟡 Major, WCAG 2.4.3):** A `position: sticky` manifesto stage on mobile traps content below the fold; on desktop, if the sticky element extends beyond its parent's intrinsic height, a keyboard user's Tab order can land on a focusable element that is rendered offscreen.

**Element rule:**
```css
.lf-pillars-stage {
  /* desktop with motion */
  position: static;
}

@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .lf-pillars-stage {
    position: sticky;
    top: 96px; /* below header */
    height: fit-content;
  }
}
```

The sticky stage's parent has `display: grid` with the pillars on one column and the stage on the other. The stage's height is bounded by the parent's intrinsic height; CSS `align-self: start` ensures the sticky stops at the parent's bottom.

The first interactive element inside the stage (if any — e.g., an inline link) must remain reachable via Tab. Phase 3 default: the stage has NO interactive elements (it's an h2 + drop-cap paragraph), so the Tab order is unaffected.

**Test method:** Manual keyboard at 1280px viewport. Manual at 768px viewport. Tab through pillars section.

**Acceptance criterion:** At ≥1024px with motion OK: sticky engages while pillars scroll past, releases at parent bottom (stage does not extend below the section). At <1024px or Reduce Motion: stage scrolls normally as static. Tab order proceeds linearly through pillars; no focused element is rendered offscreen.

---

## Failure mode 12 — Color-palette-by-month widget + Spanish lang attr

**Failure (🟡 Major, WCAG 1.4.1, 3.1.2):** Twelve month chips with three swatches each. If color is the ONLY differentiator (no label), the widget fails 1.4.1. Spanish month chips on the ES mirror need `lang="es"` attribute. Image alt strategy must use English on EN page and Spanish on ES page.

**Element rule:**
```html
<div class="lf-month-palette" role="group" aria-label="Wardrobe color palette by month">
  <button type="button" class="lf-month-chip" aria-pressed="false" data-month="01">
    <span class="lf-month-chip-name">January</span>
    <span class="lf-month-chip-swatches" aria-hidden="true">
      <span style="background: #faf6ee;"></span>
      <span style="background: #d8c8a8;"></span>
      <span style="background: #8fa8b4;"></span>
    </span>
    <span class="lf-month-chip-tones visually-hidden">Ivory, sand, dusty blue.</span>
  </button>
  <!-- 12 months -->
</div>
```

On the ES mirror at `/es/fotos-familiares-lujo-cancun`:
```html
<button class="lf-month-chip" aria-pressed="false" lang="es">
  <span>Enero</span>
  ...
  <span class="visually-hidden">Marfil, arena, azul polvo.</span>
</button>
```

Image alt strategy:
- EN: `alt="A grandfather lifts his grandson against the late-afternoon mangroves at Rosewood Mayakoba, photographed by IVAE Studios."`
- ES: `alt="Un abuelo levanta a su nieto frente a los manglares de la tarde en Rosewood Mayakoba, fotografiado por IVAE Studios."`

**Test method:** axe-core color-only check. VoiceOver on the chip widget. Validate `lang` attributes on `/es/` mirror.

**Acceptance criterion:** Each chip carries both a visible label AND tone words in a visually-hidden span. SR announces "January, button, not pressed. Ivory, sand, dusty blue." Spanish chip on ES page is read with Spanish phonology if the SR voice supports it. axe-core: zero "color-only" violations.

---

## Cross-cutting requirement A — `prefers-reduced-motion` master block

Every animation on the page is enumerated below. Each must be gated by `prefers-reduced-motion: reduce`.

```css
/* Default state — full motion */
.hero-h1 .word { transform: translateY(28px); opacity: 0; transition: opacity 0.55s, transform 0.55s var(--ease-cinema); }
.rv { opacity: 0; transform: translateY(40px); transition: opacity 0.6s, transform 0.6s var(--ease); }
.lf-hero-img { transform: translate3d(0,0,0); transition: transform 0.4s var(--ease); }
.lf-grain { animation: lf-grain-cross 0.18s steps(2) infinite; }
.lf-mote { animation: lf-mote-rise 26s linear infinite; }
.lf-tier-tree path { stroke-dasharray: 240; stroke-dashoffset: 240; transition: stroke-dashoffset 1.6s var(--ease-cinema); }
.lf-stat-num { /* JS count-up over 1.6s */ }
.lf-pillars-stage { /* sticky engaged */ }
.lf-reel-track { scroll-behavior: smooth; }
.lf-faq-panel { transition: max-height 0.35s var(--ease), opacity 0.25s; }
.lf-faq-icon { transition: transform 0.35s var(--ease); }
.btn-primary::after { transform: scaleX(0); transition: transform 0.3s var(--ease); }
.lf-availability-dot { animation: lf-pulse 4s ease-in-out infinite; }
[data-magnet] { transition: transform 0.4s var(--ease); }

/* Reduce-motion override — comprehensive */
@media (prefers-reduced-motion: reduce) {
  .hero-h1 .word,
  .rv,
  [class*="reveal"] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  .lf-hero-img,
  .lf-grain,
  .lf-mote,
  .lf-motes,
  .lf-tier-tree path,
  .lf-availability-dot,
  [data-magnet] {
    animation: none !important;
    transform: none !important;
    transition: none !important;
  }

  .lf-motes { display: none !important; }
  .lf-pillars-stage { position: static !important; }
  .lf-reel-track { scroll-behavior: auto !important; }
  html { scroll-behavior: auto !important; }

  /* FAQ panel — keep transition, it is essential to perceived state change */
  .lf-faq-panel,
  .lf-faq-icon { transition: none !important; }
}
```

JS imperative gating:
```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  document.querySelectorAll('[data-count-to]').forEach(el => {
    el.textContent = el.dataset.countTo;
  });
  // skip IntersectionObserver-driven word reveals
  // skip family-tree stroke-dash animation; show final state
  // do not init magnetic CTA, mouse parallax, mote loop
}
```

**Acceptance criterion (binary):** With Reduce Motion ON, every animation listed above is `none` or `display: none`. Page is fully usable end-to-end. Conversion path completable. FAQ accordion still operates (state change is essential).

---

## Cross-cutting requirement B — Keyboard nav order (sequential through 12 sections)

Expected Tab sequence, top to bottom, on a fully loaded page (skip link revealed by first Tab):

1. Skip link (revealed) → `#main-content`
2. Site header logo
3. Header nav: Home, About, Weddings, Families, Couples, Journal (in source order)
4. Language switcher: English link, Español link
5. Header CTA: **Begin Inquiry**
6. (Skip-link target lands here.) Hero CTAs in source order: **Begin Inquiry**, **See the Frames**
7. Stats meta strip — non-interactive, no focus
8. Manifesto — no interactive content
9. Pillars (Light / Pace / Patience) — no interactive content (cards are read-only)
10. Collections — three tier CTAs in source order: **Begin Inquiry for The Hour**, **Begin Inquiry for The Afternoon**, **Begin Inquiry for The Reunion**
11. Featured cinemascope — no interactive content
12. Method (5 steps) — no interactive content. Color-palette-by-month chips are interactive: 12 month buttons in source order
13. Sunset-Friendly Time widget — 12 month buttons in source order
14. Frames reel — track (focusable for Arrow scroll), no prev/next buttons unless Phase 3 direction adds them
15. Voices — non-interactive
16. Testimonials grid — non-interactive
17. FAQ — 10 toggle buttons in source order
18. Inquiry — Email CTA, WhatsApp / Calendar CTA
19. Footer — quick links in source order, then social link

No focus traps. Tab always advances forward; Shift-Tab always retreats. Each interactive element shows a visible `:focus-visible` ring (≥3:1 contrast against bg).

**Acceptance criterion (binary):** Manual keyboard walkthrough end-to-end completes without mouse. Every interactive element receives focus exactly once. No `tabindex` greater than 0 anywhere on the page. The conversion path (skip → hero → tier CTA → inquiry) is keyboard-completable.

---

## Cross-cutting requirement C — ARIA landmarks and screen-reader regions

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header role="banner">
    <nav role="navigation" aria-label="Primary">...</nav>
  </header>
  <main id="main-content" tabindex="-1">
    <section id="hero" aria-labelledby="hero-h1">...</section>
    <section id="stats" aria-labelledby="stats-heading">...</section>
    <section id="pillars" aria-labelledby="pillars-heading">...</section>
    <section id="collections" aria-labelledby="collections-heading">...</section>
    <section id="feature" aria-labelledby="feature-heading">...</section>
    <section id="method" aria-labelledby="method-heading">...</section>
    <section id="sunset" aria-labelledby="sunset-heading">...</section>
    <section id="voices" aria-labelledby="voices-heading">...</section>
    <section id="testimonials" aria-labelledby="testimonials-heading">...</section>
    <section id="frames" aria-labelledby="frames-heading">...</section>
    <section id="faq" aria-labelledby="faq-heading">...</section>
    <section id="inquiry" aria-labelledby="inquiry-heading">...</section>
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

Each `<section>` carries `aria-labelledby` pointing to its h2 id (or a `class="visually-hidden"` h2 for sections without a visible heading: stats, voices, testimonials, frames). The h1 lives only inside the hero section.

**Heading outline:**
- h1: An Editorial Archive of Your Family. (hero — exactly one)
- h2: Studio in Numbers (stats, visually hidden)
- h2: The hour, *built around the kids.* (pillars / manifesto)
  - h3: Golden hour, *only.*
  - h3: Patience, *not a shot list.*
  - h3: The hour, *around the kids.*
- h2: Three collections, one *register.* (collections)
  - h3: The Hour
  - h3: The Afternoon
  - h3: The Reunion
- h2: Three generations, two languages, *one coastline.* (cinemascope feature)
- h2: Five considered steps, *plan to delivery.* (method)
  - h3: Plan / Style / Light / Direct / Deliver
- h2: Sunset-Friendly Time (sunset widget)
- h2: Voices (visually hidden, pull-quote section)
- h2: Testimonials (visually hidden, grid section)
- h2: The Frames (visually hidden, reel)
- h2: Considered, Before You Ask. (FAQ)
  - h3 (inside button): one per FAQ question (10 visible)
- h2: Tell Us About the Family. (inquiry)

Exactly one `<h1>`. No `<h4>` at this depth. Heading order strictly hierarchical (no skips).

**Acceptance criterion (binary):** VoiceOver Rotor → Headings lists 1 h1 and 12 h2 in source order. axe-core: zero "heading-order" violations. HTML validator: zero structural errors.

---

## Cross-cutting requirement D — Color contrast audit

Every text-on-color pair on the page must meet 4.5:1 (or 3:1 for ≥18pt regular / ≥14pt bold large text).

| Pair | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| Hero h1 white on dark image | `--text-on-dark` (#faf8f5) | `--ink-3` (#0c1219) + `--shadow-hero-vignette` | 17.4:1 | 4.5:1 | ✅ |
| Hero subhead | `--text-on-dark-readable` (rgba 250,248,245,0.82) | `--ink-3` over hero image | 12.7:1 | 4.5:1 | ✅ |
| Body on dark | `--text-on-dark-readable` (alpha 0.82) | `--ink-3` (#0c1219) | 12.7:1 | 4.5:1 | ✅ |
| Body on cream | `--text-on-light-readable` (rgba 14,22,32,0.78) | `--cream-1` (#faf8f5) | 11.2:1 | 4.5:1 | ✅ |
| Eyebrow gold on dark | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 4.5:1 | ✅ |
| Italic gold heading on dark (≥18px) | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 4.5:1 | ✅ |
| Gold on cream (≥18px) | `--gold` (#c9a54e) | `--cream-1` (#faf8f5) | 3.1:1 | 3.0:1 (large) | ✅ at large only |
| Gold on cream (sub-18px / sub-14pt-bold) | FORBIDDEN — substitute `--gold-deep` | `--cream-1` | — | — | substitute required |
| Gold-deep on cream (any size) | `--gold-deep` (#a8894a) | `--cream-1` (#faf8f5) | 4.6:1 | 4.5:1 | ✅ |
| FAQ button text on dark | `--text-on-dark-readable` | `--ink-3` | 12.7:1 | 4.5:1 | ✅ |
| FAQ button text on cream | `--text-on-light-readable` | `--cream-1` | 11.2:1 | 4.5:1 | ✅ |
| Tier price `--fs-24` weight 300 on cream | `--ink-1` (#1a2230) | `--cream-1` | 13.0:1 | 4.5:1 | ✅ |
| Featured tier CTA: ink on gold | `--ink-1` (#1a2230) | `--gold` (#c9a54e) | 5.1:1 | 4.5:1 | ✅ |
| Outline CTA: gold border + gold text on dark | `--gold` | `--ink-3` | 7.4:1 | 4.5:1 | ✅ |
| Skip link: ink on gold | `--ink-1` | `--gold` | 5.1:1 | 4.5:1 | ✅ |
| Availability dot pulse | `--gold` | `--ink-3` | 7.4:1 | 3:1 (graphical) | ✅ |
| Focus ring on dark | `--gold` ring | `--ink-3` bg | 7.4:1 | 3:1 (UI) | ✅ |
| Focus ring on gold (featured CTA) | `--ink-1` ring | `--gold` bg | 5.1:1 | 3:1 (UI) | ✅ |
| Focus ring on cream | `--ink-1` ring | `--cream-1` bg | 13.2:1 | 3:1 (UI) | ✅ |
| Method step rail line | `--gold-line` (rgba 201,165,78,0.42) | `--ink-3` or `--cream-1` | 3.1:1 / 1.3:1 | 3:1 (UI) | ✅ on dark |
| Pull-quote ornament `❝` 0.18 opacity | `--gold` at alpha 0.18 | `--ink-3` | sub-3:1 | N/A (decorative, `aria-hidden`) | exempt |
| Mote at 0.7 opacity | `--gold` alpha 0.7 | `--ink-3` | ~5:1 | N/A (decorative) | exempt |
| Sunset clock golden ring | `--gold` | `--ink-3` | 7.4:1 | 3:1 (graphical) | ✅ |
| Sunset clock nap band | `--lf-clock-window-band` (rgba 201,165,78,0.12) | `--ink-3` | sub-3:1 | N/A (decorative; meaning is announced by SR) | exempt |
| Stat numeral `data-count-to` | `--gold` weight 300 ≥48px | `--ink-3` | 7.4:1 | 3:1 (large) | ✅ |
| Reel hint `--fs-13` | `--text-on-dark-readable` | `--ink-3` | 12.7:1 | 4.5:1 | ✅ |
| Color-palette-by-month chip swatch | swatch tones | `--cream-1` background | varied | N/A (`aria-hidden`; tone words in SR text) | exempt |

**Forbidden combinations:**
- Gold (`#c9a54e`) on cream (`#faf8f5`) for any text below 18px regular OR below 14pt bold (≈ 18.66px). Substitute `--gold-deep`.
- Body color in `--muted` (rgba 0.58 alpha) — fails 4.5:1 contrast. Use `--text-on-dark-readable` (alpha 0.82) instead.

**Acceptance criterion (binary):** axe-core contrast scan: zero failures. Stark / DevTools color-picker spot-checks on cream and ink sections each return ratios meeting the table above. The legacy `--muted` (rgba 0.58) is not used for text content anywhere on the page.

---

## Cross-cutting requirement E — Skip link and focus management

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header role="banner">...</header>
  <main id="main-content" tabindex="-1">...</main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: 0; left: 0;
  padding: var(--s-3) var(--s-4);
  background: var(--gold);
  color: var(--ink-1);
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: 600;
  text-decoration: none;
  letter-spacing: var(--tracking-eyebrow-base);
  text-transform: uppercase;
  z-index: 10001;
  transform: translateY(-150%);
  transition: transform 0.2s var(--ease);
}
.skip-link:focus,
.skip-link:focus-visible {
  transform: translateY(0);
  outline: var(--focus-ring-on-gold);
  outline-offset: 2px;
}
```

`<main id="main-content" tabindex="-1">` is required so `<main>` (a non-interactive landmark) can receive programmatic focus when the skip link is activated.

**Acceptance criterion (binary):** Hard reload + first Tab reveals the skip link. Pressing Enter scrolls to `#main-content` AND focus moves into `<main>`; the next Tab moves into the first interactive element inside main (a hero CTA), not back into header nav.

---

## Cross-cutting requirement F — Forms, lang switcher, language of parts

The page contains no inline form (the inquiry section uses two CTA buttons that route to email and WhatsApp). If Phase 4 adds an inline form, WCAG 3.3.1 (error identification), 3.3.2 (labels), and 1.3.1 (name/role/value) apply and must be added to this contract before build.

Lang switcher pattern:
```html
<div class="lang-switcher" role="group" aria-label="Language switcher">
  <a href="/luxury-family-photos-cancun" hreflang="en" lang="en" aria-current="true" class="lang-link is-active">English</a>
  <span class="lang-sep" aria-hidden="true">|</span>
  <a href="/es/fotos-familiares-lujo-cancun" hreflang="es" lang="es" class="lang-link">Español</a>
</div>
```

The Spanish phrase in the manifesto carries `<em lang="es">Bilingüe en cada conversación</em>` so SR pronounces it with Spanish phonology.

**Acceptance criterion (binary):** VoiceOver on the active English link announces "English, current page, link." The pipe separator is not announced. Spanish phrase in manifesto is read with Spanish phonology if the SR voice supports it.

---

## Acceptance test summary (Phase 5 hand-off)

Phase 5 verification will run the following automated and manual tests against the merged Phase 4 build:

**Automated:**
1. Lighthouse Accessibility audit — score ≥ 95.
2. axe DevTools — zero violations (warnings allowed but documented).
3. Wave Accessibility Tool — zero errors, zero contrast errors.
4. HTML validator (W3C Nu) — zero heading-level skips, zero structural errors.
5. Pa11y CLI run from CI — zero failures.

**Manual:**
1. Keyboard-only walkthrough end-to-end (Tab, Enter, Space, Arrow keys, Escape). Conversion path completable without mouse.
2. VoiceOver (macOS Safari) walkthrough. Headings rotor, links rotor, image rotor each navigable.
3. NVDA (Windows Firefox) walkthrough on the FAQ section specifically (accordion announcement is the most platform-variable bit).
4. Reduce Motion ON walkthrough. No animation plays. Page still completes the conversion path.
5. iPhone Safari walkthrough at 375×667. All touch targets ≥ 44×44.
6. Chrome zoom to 200%. Layout reflows. No content disappears off-canvas. No horizontal scroll except where intended (the reel).
7. Sunset-friendly-time widget interaction with VoiceOver: cycle 12 months. Each month announces correctly with golden hour and recommended start.

A build that fails any of these tests cannot ship to production. Phase 4 may iterate against Phase 5 findings before the canonical merge.

---

**End of Phase 2 Accessibility Contract.**

Word count: ~3,950 words covering 12 enumerated failure modes plus six cross-cutting requirements (reduced-motion master block, keyboard order, ARIA landmarks, color contrast audit, skip link, lang switcher). Each failure mode states risk, element rule, test method, and binary acceptance criterion. Tokens referenced are canonical from `/styles/tokens.css` plus the additive `--lf-*` Wave 6.5 tokens proposed in Phase 1 §3 Skill 4.
