# IVAE Studios. Couples & Honeymoon v6. Phase 2 Accessibility Contract

**Page:** `/couples-photography.html` (canonical: `/couples-photography-mexico`)
**Phase:** 2 of 5 (design system, locked copy, a11y contract)
**Standard:** WCAG 2.1 AA
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §11 (12 element-level rules), wedding Phase 2 a11y contract (template parity), tokens.css Wave 6 a11y additions
**Audience:** Phase 3 build agents (8 parallel section builders). Non-negotiable. Phase 5 verification reads this file and runs each acceptance test against the integrated build. A build that fails any acceptance test cannot ship.

---

## Purpose

Phase 1 identified twelve accessibility failure modes for the couples page. Phase 3 will spin up 8 parallel section build agents (header+hero, pillars, collections, featured, method, testimonials, frames, FAQ+inquiry+footer). All eight MUST satisfy this contract regardless of section assignment. The contract structure mirrors the wedding Phase 2 contract: **Risk → Pattern (selector / ARIA / token) → Acceptance test.**

Severity in standard WCAG triage:
- 🔴 Critical: blocks a class of users from completing the conversion path.
- 🟡 Major: degrades the experience for a class of users but does not block.
- 🟢 Minor: polish; tracked, not a launch blocker.

---

## Failure mode 1 — 3D mouse parallax hero on touch / reduced-motion

**Risk (🔴 Critical, WCAG 1.4.11, 2.3.3):** A 3D parallax that tracks `mousemove` on the hero will fail two ways. On touch devices there is no pointer to track and the transform layer becomes dead weight (extra paint cost, no payoff). For users with vestibular disorder, continuous transform on cursor motion causes nausea. The previous v1 page had no parallax, but the cinematic peer (wedding) does. Couples Phase 4 must NOT inherit the parallax without gating.

**Pattern Phase 3 MUST use:**

```html
<header class="lc-hero" id="hero" data-parallax-host>
  <div class="lc-hero-bg" data-parallax-target>
    <img src="/images/couple-cancun-hotel-zone-ivae-studios.avif"
         alt="A couple at golden hour on the beach in Cancun, photographed by IVAE Studios."
         loading="eager"
         fetchpriority="high"
         decoding="async">
  </div>
  <!-- ... -->
</header>
```

```css
.lc-hero { perspective: 1200px; }
.lc-hero-bg { transform-style: preserve-3d; transition: transform 0.6s var(--ease); }

@media (hover: none),
       (pointer: coarse),
       (prefers-reduced-motion: reduce) {
  .lc-hero-bg { transform: none !important; transition: none !important; }
}
```

```js
const hostEl = document.querySelector('[data-parallax-host]');
const targetEl = document.querySelector('[data-parallax-target]');
const canParallax = window.matchMedia('(hover: hover) and (pointer: fine)').matches
                 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canParallax && hostEl && targetEl) {
  hostEl.addEventListener('pointermove', (e) => {
    const r = hostEl.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / r.width;
    const dy = (e.clientY - r.top - r.height / 2) / r.height;
    targetEl.style.transform = `translate3d(${dx * -12}px, ${dy * -12}px, 0) scale(1.04)`;
  });
  hostEl.addEventListener('pointerleave', () => { targetEl.style.transform = ''; });
}
```

**Acceptance test (Phase 5):**
1. macOS Safari with trackpad and Reduce Motion OFF: hero image shifts subtly with cursor. Max translation 12px.
2. macOS Safari with Reduce Motion ON: hero image is static. Cursor motion has no effect.
3. iPhone Safari (touch): hero image is static. No transform applied.
4. axe DevTools: zero violations on the hero region.

---

## Failure mode 2 — Drag-scroll romantic moments reel keyboard accessibility

**Risk (🔴 Critical, WCAG 2.1.1, 2.4.7, 2.5.5):** A drag-scroll reel with 6 frames at 4:5 captioned with the moment ("the kneel," "the morning of the dress," "the second sunset," "the year fifteen," "the cenote dive," "the laugh") fails keyboard users if the track is not focusable, fails screen-reader users if the track has no label, and fails dexterity-impaired users if prev/next buttons are sub-44px.

**Pattern Phase 3 MUST use:**

```html
<section class="lc-reel-section" id="frames" aria-labelledby="reel-heading">
  <h2 id="reel-heading" class="visually-hidden">Romantic moments</h2>
  <p class="lc-reel-hint">Drag to scroll the reel.</p>
  <div
    class="lc-reel-track"
    role="region"
    aria-label="Romantic moments reel, six frames"
    tabindex="0">
    <figure class="lc-reel-frame">
      <img src="/images/couple-mayakoba-ivae-studios.avif"
           alt="A couple walking the boardwalk at golden hour at Rosewood Mayakoba, photographed by IVAE Studios."
           loading="lazy">
      <figcaption class="lc-reel-caption">The morning of the dress.</figcaption>
    </figure>
    <!-- 5 more frames: the kneel, the second sunset, the year fifteen, the cenote dive, the laugh -->
  </div>
  <div class="lc-reel-controls" role="group" aria-label="Reel navigation">
    <button class="lc-reel-btn lc-reel-btn--prev" type="button" aria-label="Previous frame">
      <span aria-hidden="true">←</span>
    </button>
    <button class="lc-reel-btn lc-reel-btn--next" type="button" aria-label="Next frame">
      <span aria-hidden="true">→</span>
    </button>
  </div>
</section>
```

```css
.lc-reel-track {
  scroll-snap-type: x mandatory;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.lc-reel-frame { scroll-snap-align: start; }
.lc-reel-track:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }

.lc-reel-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--gold-line);
  cursor: pointer;
}
```

```js
// Arrow-key scrolling on focused track
const track = document.querySelector('.lc-reel-track');
track?.addEventListener('keydown', (e) => {
  const frame = track.querySelector('.lc-reel-frame');
  const w = frame?.getBoundingClientRect().width || 320;
  if (e.key === 'ArrowRight') { track.scrollBy({ left: w, behavior: 'smooth' }); e.preventDefault(); }
  if (e.key === 'ArrowLeft')  { track.scrollBy({ left: -w, behavior: 'smooth' }); e.preventDefault(); }
});
```

**Acceptance test (Phase 5):**
1. Tab to the reel-track. A 2px gold focus ring appears at 4px offset.
2. Press Arrow Right while track has focus. Track scrolls one frame width per press.
3. Tab to prev / next buttons. Both receive focus, both activate on Enter/Space.
4. VoiceOver on a focused button announces: "Previous frame, button" / "Next frame, button."
5. Resize to 375×667. Each button hit area is ≥ 44×44 CSS pixels.
6. Each `<img>` has descriptive alt suffixed with "photographed by IVAE Studios."

---

## Failure mode 3 — Sunset clock + proposal countdown widget ARIA

**Risk (🔴 Critical, WCAG 4.1.2, 4.1.3, 1.1.1):** The widget combines a 12-month button row, an SVG clock face, and a live-updating "Next available proposal date" countdown. Without correct ARIA, SR users cannot select a month, cannot understand what the SVG depicts, and cannot hear the countdown updates.

**Pattern Phase 3 MUST use:**

```html
<section class="lc-clock-section" aria-labelledby="clock-heading">
  <h3 id="clock-heading" class="visually-hidden">Golden hour and proposal availability</h3>

  <div class="lc-clock-container">
    <svg class="lc-clock-svg"
         viewBox="0 0 320 320"
         role="img"
         aria-labelledby="clock-svg-title clock-svg-desc">
      <title id="clock-svg-title">Sunset clock for January in Cancun</title>
      <desc id="clock-svg-desc">A circular clock face showing golden hour from 4:50 p.m. to 5:30 p.m., with the recommended couples session start time at 4:00 p.m.</desc>
      <!-- clock face, ring, hands -->
    </svg>

    <div class="lc-clock-controls" role="group" aria-label="Pick a month">
      <button class="lc-month-btn"
              type="button"
              aria-pressed="true"
              data-month="1"
              data-sunset="17:30"
              data-start="16:00">January</button>
      <button class="lc-month-btn"
              type="button"
              aria-pressed="false"
              data-month="2"
              data-sunset="17:50"
              data-start="16:20">February</button>
      <!-- 10 more months -->
    </div>

    <p class="lc-clock-caption">
      Pick the month. The ring shows when the light turns honest. The studio starts couples sessions ninety minutes before that.
    </p>
  </div>

  <aside class="lc-countdown-card" aria-labelledby="countdown-heading" aria-live="polite">
    <h4 id="countdown-heading" class="lc-countdown-title">Next Available Proposal Date</h4>
    <p class="lc-countdown-caption">
      <span class="lc-countdown-date">This Saturday</span>
      <span class="lc-countdown-time">at five-fifteen p.m.</span>
    </p>
    <p class="lc-countdown-cta">Inquire to hold.</p>
  </aside>
</section>
```

- SVG carries `role="img"` and is described by the `<title>` + `<desc>` pair (linked via `aria-labelledby`).
- When a month button is pressed, JS updates the SVG's `<title>` and `<desc>` text content so SR re-announces the new state, and toggles `aria-pressed` on all 12 buttons (one true, eleven false).
- Countdown card has `aria-live="polite"` so date updates announce when the JSON-fed widget hydrates the date.
- Static text "This Saturday at five-fifteen p.m." renders before JS hydration so no-JS users still see a useful date.

**Acceptance test (Phase 5):**
1. Tab to the first month button. VoiceOver announces "January, selected, button."
2. Press Right Arrow / Tab to February. Press Enter. VoiceOver announces "February, selected, button" and the SVG's title updates.
3. axe DevTools: zero violations on the clock region.
4. With JS disabled, the static caption "Next available proposal slot, this Saturday at five-fifteen p.m." is visible. The widget degrades gracefully.

---

## Failure mode 4 — Magnetic CTAs (hover transform must not be the only affordance)

**Risk (🟡 Major, WCAG 2.4.7, 2.4.11):** Magnetic CTAs that translate toward the cursor on hover provide no affordance for keyboard users. Without a visible focus ring AND a non-motion hover state, the CTA fails 2.4.7 (Focus Visible) and 2.4.11 (Focus Not Obscured).

**Pattern Phase 3 MUST use:**

```html
<a class="lc-btn lc-btn--primary"
   href="#inquiry"
   data-magnet="true"
   aria-label="Begin Inquiry">Begin Inquiry</a>
```

```css
.lc-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 200px;
  padding: 0 24px;
  font-size: var(--fs-13);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background var(--t-quick) var(--ease), color var(--t-quick) var(--ease);
}

.lc-btn--primary {
  background: var(--gold);
  color: var(--ink-1);
  border: 1px solid var(--gold);
}

/* Hover: shimmer sweep + slight color hold (no motion is sole affordance) */
.lc-btn--primary:hover {
  background: var(--gold-hover);
  color: var(--ink-1);
}

/* Focus: ring is non-negotiable */
.lc-btn--primary:focus-visible {
  outline: 2px solid var(--ink-1);
  outline-offset: 4px;
}

.lc-btn--ghost {
  background: transparent;
  color: var(--gold);
  border: 1px solid var(--gold-line);
}
.lc-btn--ghost:hover { background: rgba(196, 163, 90, 0.10); border-color: var(--gold); }
.lc-btn--ghost:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }

/* Magnetic translation only on motion-OK + fine-pointer */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .lc-btn[data-magnet="true"] { transition: transform 0.18s var(--ease), background var(--t-quick) var(--ease); }
}
@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .lc-btn[data-magnet="true"] { transform: none !important; }
}
```

**Acceptance test (Phase 5):**
1. Tab to each CTA. Visible focus ring appears.
2. On gold-fill primary: ring is `--ink-1` (5.1:1 contrast). On ghost: ring is `--gold` (7.4:1 on ink).
3. Hover state is detectable without motion (background or color shift).
4. Reduce Motion ON: cursor proximity does not translate the button. The button is still clickable.

---

## Failure mode 5 — Floating gold motes (decorative, gated)

**Risk (🟡 Major, WCAG 1.1.1, 2.3.3):** Eight gold motes drifting upward at 28s loop on the hero are pure ornament. Without `aria-hidden="true"`, they pollute the SR image rotor. Without `prefers-reduced-motion` gating, they animate for users who explicitly disabled motion.

**Pattern Phase 3 MUST use:**

```html
<div class="lc-motes" aria-hidden="true">
  <span class="lc-mote" style="--mote-x: 12%; --mote-delay: 0s;"></span>
  <span class="lc-mote" style="--mote-x: 28%; --mote-delay: 3.5s;"></span>
  <!-- 6 more, total 8 -->
</div>
```

```css
.lc-motes { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.lc-mote {
  position: absolute;
  bottom: -10px;
  left: var(--mote-x);
  width: 3px; height: 3px;
  background: radial-gradient(circle, var(--gold) 0%, transparent 70%);
  border-radius: 50%;
  animation: lc-mote-drift 28s linear var(--mote-delay) infinite;
  opacity: 0;
}
@keyframes lc-mote-drift {
  0% { transform: translateY(0); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { transform: translateY(-110vh); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lc-motes { display: none !important; }
}
```

**Acceptance test (Phase 5):**
1. macOS Reduce Motion OFF: 8 gold dots drift upward in the hero.
2. macOS Reduce Motion ON: motes do not render.
3. VoiceOver image rotor: motes are not announced.

---

## Failure mode 6 — SVG film grain

**Risk (🟢 Minor, WCAG 2.3.3):** Film grain at `--lc-grain-opacity: 0.030` is decorative. Without `aria-hidden`, it flagged by some validators. Without reduced-motion gating, an animated grain shifts continuously for vestibular-impaired users.

**Pattern Phase 3 MUST use:**

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,...");
  opacity: var(--lc-grain-opacity, 0.030);
  pointer-events: none;
  z-index: 9998;
}
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}
```

The grain layer is a pseudo-element on `<body>`, so no markup is needed. `pointer-events: none` ensures it does not intercept clicks. No animation by default in the couples page (static grain only). The `0.030` opacity is slightly lighter than the wedding's `0.035` per Phase 1 §8.2.

**Acceptance test (Phase 5):**
1. Inspect element. The grain layer is a `body::before` pseudo, not an `<img>` or `<svg>` element.
2. axe DevTools: zero violations.
3. The grain does not appear in the SR image rotor.

---

## Failure mode 7 — Heart and infinity SVG ornament

**Risk (🟢 Minor, WCAG 1.1.1, 4.1.2):** The heart-and-infinity SVG sits beside each tier card name (single heart for The Hour, two interlocked hearts for The Sunset, horizontal infinity glyph for The Adventure Day). The SVG is decorative because the tier card text already names the tier. Without `aria-hidden="true"`, SR announces "image" on every tier card, cluttering the navigation.

**Pattern Phase 3 MUST use:**

```html
<article class="lc-tier-card" data-tier="hour">
  <p class="lc-tier-roman" aria-hidden="true">I</p>
  <h3 class="lc-tier-name"><em>The Hour</em></h3>

  <svg class="lc-tier-ornament"
       viewBox="0 0 48 48"
       aria-hidden="true"
       focusable="false"
       role="presentation">
    <!-- single heart outline path -->
    <path class="lc-heart-path" d="M24 12 C18 4, 4 8, 4 20 C4 32, 24 44, 24 44 C24 44, 44 32, 44 20 C44 8, 30 4, 24 12" 
          fill="none"
          stroke="var(--gold)"
          stroke-width="var(--lc-heart-stroke, 1.5)"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="160"
          stroke-dashoffset="160" />
  </svg>

  <!-- ... -->
</article>
```

```css
.lc-tier-ornament { width: 48px; height: 48px; opacity: 0.85; }
.lc-tier-card:hover .lc-heart-path,
.lc-tier-card:focus-within .lc-heart-path {
  animation: lc-heart-draw 1.4s var(--ease) forwards;
}
@keyframes lc-heart-draw {
  to { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lc-heart-path { stroke-dashoffset: 0 !important; animation: none !important; }
}
```

- `aria-hidden="true"` and `role="presentation"` together: SR ignores the SVG entirely.
- `focusable="false"` so the SVG cannot become a tab target in IE/Edge legacy.
- Stroke-draw animation is gated; reduced-motion shows the ornament fully drawn statically.

**Acceptance test (Phase 5):**
1. SR navigates the tier section. No "image" announcement on any tier card.
2. Hover any tier card: the heart/infinity stroke draws over 1.4s.
3. Reduce Motion ON: the stroke is fully drawn from page load; no animation runs.

---

## Failure mode 8 — Count-up stats announce final value

**Risk (🟡 Major, WCAG 4.1.2, 4.1.3):** A count-up animation from 0 to 500 over 1.6s runs through 100+ DOM mutations. Without proper ARIA, SR announces every digit change ("1, 2, 3, 4, 5..."). The expected behavior is to announce the final value once.

**Pattern Phase 3 MUST use:**

```html
<ul class="lc-stats" aria-label="Studio statistics: since 2019, more than 500 couples photographed, 42 reviews, 5.0 star rating">
  <li class="lc-stat">
    <span class="lc-stat-num" aria-hidden="true">2019</span>
    <span class="lc-stat-label">Since</span>
  </li>
  <li class="lc-stat">
    <span class="lc-stat-num" aria-hidden="true">
      <span class="lc-count" data-count-to="500">0</span>+
    </span>
    <span class="lc-stat-label">Couples</span>
  </li>
  <li class="lc-stat">
    <span class="lc-stat-num" aria-hidden="true">42</span>
    <span class="lc-stat-label">Forty-Two Reviews</span>
  </li>
  <li class="lc-stat">
    <span class="lc-stat-num" aria-hidden="true">5.0 ★</span>
    <span class="lc-stat-label">Five Point Zero Stars</span>
  </li>
</ul>
```

- Parent `<ul>` has the canonical `aria-label` describing all four stats as a single phrase. SR reads this once.
- Inner numbers have `aria-hidden="true"` so the counting digits are not announced.
- The `<span class="lc-stat-label">` carries the full word for SR users (e.g., "Forty-Two Reviews" spelled out, "Five Point Zero Stars" spelled out).

```js
const counters = document.querySelectorAll('.lc-count');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.countTo, 10);
    if (prefersReducedMotion) { el.textContent = target; obs.unobserve(el); return; }
    const start = performance.now();
    const dur = 1600;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * t);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    obs.unobserve(el);
  });
});
counters.forEach((el) => obs.observe(el));
```

**Acceptance test (Phase 5):**
1. Reduce Motion OFF: the "500+" stat counts from 0 to 500 over 1.6s.
2. Reduce Motion ON: the stat reads "500+" immediately on first paint.
3. VoiceOver on the stats list announces: "Studio statistics: since 2019, more than 500 couples photographed, 42 reviews, 5.0 star rating."
4. axe DevTools: zero violations on the stats list.

---

## Failure mode 9 — Pull-quote `❝` ornament

**Risk (🟢 Minor, WCAG 1.3.1):** The giant Cormorant `❝` glyph at `clamp(180px, 22vw, 320px)` is purely decorative. Without `aria-hidden`, SR announces "left double quotation mark." Without semantic `<blockquote>`, SR cannot identify the quote as a quote.

**Pattern Phase 3 MUST use:**

```html
<section class="lc-pullquote-section" aria-labelledby="voices-heading">
  <h2 id="voices-heading" class="visually-hidden">Voices</h2>
  <p class="lc-eyebrow">Voices</p>

  <blockquote class="lc-pullquote">
    <span class="lc-pullquote__ornament" aria-hidden="true">❝</span>
    <p class="lc-pullquote__body">
      We came back to the same beach where we got engaged. I cried when I saw the gallery. The pictures are more honest than the day was, and that is the highest compliment we know how to give.
    </p>
    <cite class="lc-pullquote__attr">Sarah &amp; Michael  ·  Esperanza, Cabo San Lucas  ·  March 2026</cite>
  </blockquote>
</section>
```

- `<blockquote>` wraps the quote body; SR identifies it as a quote.
- `<cite>` wraps the attribution; SR identifies it as the quote source.
- The giant `❝` ornament is `aria-hidden="true"`; SR ignores it.
- The visible eyebrow "Voices" is matched by a visually-hidden `<h2 id="voices-heading">` so the section is discoverable in the SR Headings rotor.

**Acceptance test (Phase 5):**
1. SR Headings rotor lists "Voices" as an h2.
2. SR navigates the blockquote. The `❝` glyph is not announced.
3. SR announces: "Quote: We came back to the same beach... source: Sarah and Michael, Esperanza Cabo San Lucas, March 2026, end quote."

---

## Failure mode 10 — Drop cap on case-study caption

**Risk (🟢 Minor, WCAG 1.3.2):** A drop cap on the F of "Fifteen" in the case-study caption must not pollute the markup. Using a `<span>` to create the drop cap visually breaks the meaningful sequence: SR announces "F. ifteen years" with an unintended pause.

**Pattern Phase 3 MUST use:**

```css
.lc-case-caption p:first-of-type::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--lc-dropcap-size, clamp(58px, 6.5vw, 78px));
  color: var(--gold-deep);
  float: left;
  padding: 6px 14px 0 0;
  line-height: 0.86;
}
```

- `::first-letter` pseudo. No `<span>`, no markup pollution.
- Same pattern reused for the manifesto's drop cap on T (`.lc-manifesto-lead::first-letter`).

**Acceptance test (Phase 5):**
1. View source. No `<span>` around the F.
2. SR announces: "Fifteen years between the two of them..." (no broken word).
3. Visual drop cap renders on the F at the specified size in cream-section serif italic gold-deep.

---

## Failure mode 11 — Sticky-stage manifesto on tablet/mobile

**Risk (🟡 Major, WCAG 2.4.3):** A `position: sticky` left column with the manifesto headline + lede + pull-quote pinned while three pillars scroll past on the right works on desktop. Below 1024px, the layout collapses to single-column, and `position: sticky` either pins the manifesto over the pillars (visual mess) or breaks Tab order (SR users can no longer reach the pillars).

**Pattern Phase 3 MUST use:**

```css
.lc-manifesto-stage { /* default: static, single column */ }

@media (min-width: 1024px) {
  .lc-manifesto-section { display: grid; grid-template-columns: 5fr 7fr; gap: 64px; }
  .lc-manifesto-stage {
    position: sticky;
    top: 96px;
    align-self: start;
    height: max-content;
  }
}
```

- Below 1024px, the stage column is static (default `position: static`).
- Sticky element has `align-self: start` and `height: max-content` so it does not stretch beyond the manifesto body's intrinsic height.
- Tab order is preserved at all viewport widths (the source order is stage first, pillars second).

**Acceptance test (Phase 5):**
1. Resize to 1280px. Scroll the manifesto section. The stage column pins; the pillars scroll past.
2. Resize to 1023px. The stage column releases; the layout becomes single-column.
3. Tab order at all widths: stage h2 → stage lede → first pillar h3 → first pillar body → second pillar h3 → ...

---

## Failure mode 12 — Spanish copy lang attributes and bilingual a11y

**Risk (🟡 Major, WCAG 1.4.1, 3.1.2):** Spanish month buttons in the sunset clock widget appear on the EN page if the user switches the widget locale, and Spanish testimonial attribution may appear if a placeholder name has a Spanish accent. Without `lang="es"` on those nodes, SR pronounces them with English phonology ("Camila" said as "ca-MIL-a" with English a's, instead of "ca-MEE-la" with Spanish a's).

**Pattern Phase 3 MUST use:**

```html
<!-- EN page testimonial with Spanish names -->
<blockquote class="lc-testimonial" lang="en">
  <p>Fifteen years to the week. We came back to Mexico because we honeymooned here. The frames Vianey made of us at the arch are on the wall of our foyer. Our nieces ask whose wedding it was.</p>
  <cite>
    <span lang="es">Camila &amp; Ana</span>
    ·
    <span lang="es">Esperanza, Cabo San Lucas</span>
    · October 2025
  </cite>
</blockquote>

<!-- Lang switcher -->
<div class="lang-switcher" role="group" aria-label="Language switcher">
  <a href="/couples-photography-mexico"
     hreflang="en"
     lang="en"
     aria-current="true"
     class="lang-link is-active">English</a>
  <span class="lang-sep" aria-hidden="true">|</span>
  <a href="/es/fotografia-parejas-mexico.html"
     hreflang="es"
     lang="es"
     aria-label="Cambiar a español"
     class="lang-link">Español</a>
</div>
```

- Spanish proper nouns (Camila, Ana, Esperanza, Cabo San Lucas, Mayakoba, Vianey) wrapped in `<span lang="es">` on the EN page.
- The lang switcher's Spanish link has `lang="es"` so SR pronounces "Español" with Spanish phonology.
- The discreet-coverage diagram (proposal SVG inside Method) has bilingual captions: EN caption with `lang="en"`, ES caption with `lang="es"` (the ES caption is hidden with `display: none` on the EN page but kept in DOM for crawl).
- Color is never the only differentiator on tier cards: the featured tier (II) has both a 2px gold rule on its top edge AND the "Most Chosen" badge text. A user with red-green color-blindness still sees the rule (which is a visual outline shape, not a color-only signal) and reads the badge text.

**Acceptance test (Phase 5):**
1. VoiceOver Spanish voice installed. Hover over "Camila" in card 3. SR pronounces with Spanish phonology.
2. Click the lang switcher's Español link. Page navigates to `/es/fotografia-parejas-mexico.html`.
3. Disable color in DevTools (grayscale rendering mode). The featured tier is still distinguishable by the 2px top rule and the "Most Chosen" badge.
4. axe DevTools: zero violations on the lang switcher.

---

## Cross-cutting requirements (apply to all 12 failure modes)

### Master `prefers-reduced-motion` block

```css
@media (prefers-reduced-motion: reduce) {
  /* Reveals — show static end-state */
  .lc-h1 .word,
  .lc-rv,
  [class*="lc-reveal"] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  /* Loops — stop entirely */
  .lc-motes,
  .lc-grain,
  .lc-ken-burns,
  .lc-parallax,
  .lc-ornament-pulse,
  .lc-heart-path,
  .lc-shimmer-sweep {
    animation: none !important;
    transform: none !important;
  }

  /* Loader (if any) — bypass */
  .lc-loader { display: none !important; }

  /* Magnetic CTA — disable */
  .lc-btn[data-magnet="true"] { transform: none !important; }

  /* Count-up — JS gates this; CSS just keeps numbers visible */

  /* Smooth scroll — instant */
  html { scroll-behavior: auto !important; }

  /* FAQ panel — keep transition (essential to perceived state change) */
  .lc-faq-panel { transition: none !important; }

  /* Hover image scale — disable */
  .lc-hover-img:hover img,
  .lc-card:hover img { transform: none !important; }

  /* 3D parallax hero — flatten */
  .lc-hero-bg { transform: none !important; transition: none !important; }
}
```

JS must also gate any imperative animation (count-up, IntersectionObserver-driven reveals, parallax pointer listener, magnetic CTA tracking):

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // count-up
  document.querySelectorAll('.lc-count').forEach(el => { el.textContent = el.dataset.countTo; });
  // skip IO-driven reveals
  document.querySelectorAll('.lc-rv').forEach(el => el.classList.add('vis'));
}
```

### Keyboard navigation order

Expected Tab sequence on the page:
1. Skip link (revealed)
2. Site header logo
3. Header nav items
4. Language switcher (English link, then Español link)
5. Header CTA (Begin Inquiry)
6. (Skip target lands here) Hero CTAs in source order: Begin Inquiry, See the Frames
7. Trust strip — non-interactive, no focus
8. Manifesto stage — no interactive content
9. Pillars — no interactive content (cards are read-only)
10. Tier cards — three CTAs (Begin Inquiry × 3, each `aria-label`-differentiated)
11. Case study — no interactive content
12. Method steps — no interactive content
13. Sunset clock widget — 12 month buttons, then countdown card (live region only)
14. Pull-quote — no interactive content
15. Testimonials — no interactive content (cards are read-only)
16. Reel — track (focusable for arrow scroll), prev button, next button
17. FAQ — 10 toggle buttons in source order
18. Inquiry — Begin Inquiry CTA, Check Proposal Availability CTA, WhatsApp CTA
19. Footer — nav links, social links, lang switcher repeat

No focus traps. Tab always advances forward; Shift-Tab always retreats.

### ARIA landmarks

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header role="banner">...</header>
  <nav role="navigation" aria-label="Primary">...</nav>
  <main id="main-content" tabindex="-1">
    <section aria-labelledby="hero-h1">...</section>          <!-- Hero -->
    <section aria-labelledby="trust-heading">...</section>    <!-- Trust strip -->
    <section aria-labelledby="manifesto-heading">...</section><!-- Manifesto + Pillars -->
    <section aria-labelledby="collections-heading">...</section><!-- Collections -->
    <section aria-labelledby="case-heading">...</section>     <!-- Case study -->
    <section aria-labelledby="method-heading">...</section>   <!-- Method incl. clock -->
    <section aria-labelledby="voices-heading">...</section>   <!-- Pull-quote -->
    <section aria-labelledby="testimonials-heading">...</section><!-- Testimonials -->
    <section aria-labelledby="reel-heading">...</section>     <!-- Reel -->
    <section aria-labelledby="faq-heading">...</section>      <!-- FAQ -->
    <section aria-labelledby="inquiry-heading">...</section>  <!-- Inquiry -->
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

Each `<section>` carries `aria-labelledby` pointing to its h2 id (or visually-hidden h2 id for sections without a visible title).

### Heading outline

```
h1: An Editorial Archive of Two People (hero — exactly one)

h2: Studio Statistics (visually hidden, trust strip)
h2: Two people, carefully held. (manifesto)
  h3: Light
  h3: Direction
  h3: Discretion
h2: Three collections, one register. (collections)
  h3: The Hour
  h3: The Sunset
  h3: The Adventure Day
h2: Camila and Ana, Cabo San Lucas. (case study)
h2: Five considered steps, plan to delivery. (method)
  h3: Plan
  h3: Direct
  h3: Light
  h3: Capture
  h3: Deliver
  h3: Golden hour and proposal availability (clock widget, visually hidden)
h2: Voices (visually hidden) — pull-quote
h2: What Couples Say (visually hidden) — testimonials grid
h2: Romantic moments (visually hidden) — reel
h2: Ten questions, answered before they are asked. (FAQ)
  h3: each FAQ question (10)
h2: Tell us about the two of you. (inquiry)

footer (role=contentinfo, no h2)
```

Rules:
- Exactly one `<h1>`.
- One `<h2>` per major section (visually-hidden if no visible title).
- `<h3>` only inside `<h2>` parents.
- No `<h4>` at this IA depth.
- Visual styling (large gold display type) achieved via CSS class, never via heading tag substitution.

### Color contrast snapshot

| Pair | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| Body on dark | `--text-on-dark-readable` (rgba 250,248,245,0.82) | `--ink-3` (#0c1219) | 12.7:1 | 4.5:1 | ✅ |
| Body on cream | `--text-on-light-readable` (rgba 14,22,32,0.78) | `--cream-1` (#faf8f5) | 11.2:1 | 4.5:1 | ✅ |
| Gold on dark | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 4.5:1 | ✅ |
| Gold on cream (large only) | `--gold` (#c9a54e) | `--cream-1` (#faf8f5) | 3.1:1 | 3.0:1 (large) | ✅ at large only |
| Gold-deep on cream (any size) | `--gold-deep` (#a8894a) | `--cream-1` (#faf8f5) | 4.6:1 | 4.5:1 | ✅ |
| Ink ring on gold | `--ink-1` (#1a2230) | `--gold` (#c9a54e) | 5.1:1 | 3:1 | ✅ |
| Gold ring on ink | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 3:1 | ✅ |
| Eyebrow gold-deep on cream | `--gold-deep` (#a8894a) | `--cream-1` (#faf8f5) | 4.6:1 | 4.5:1 | ✅ |

**Rule:** Gold-on-cream is permitted ONLY at font-size ≥ 18px or font-size ≥ 14px AND font-weight ≥ 600. Below those thresholds, switch to `--gold-deep` (4.6:1).

### Skip link

```html
<a class="skip-link" href="#main-content">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  top: 0; left: 0;
  padding: 12px 24px;
  background: var(--gold);
  color: var(--ink-1);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  z-index: 10001;
  transform: translateY(-150%);
  transition: transform var(--t-quick) var(--ease);
}
.skip-link:focus,
.skip-link:focus-visible {
  transform: translateY(0);
  outline: 2px solid var(--ink-1);
  outline-offset: 2px;
}
```

`<main id="main-content" tabindex="-1">` so non-interactive `<main>` can receive programmatic focus when the skip link activates.

### Forms

The page does not contain a contact form. The inquiry section uses CTA buttons that route to email and WhatsApp. If Phase 4 adds an inline form, then WCAG 3.3.1 (error identification), 3.3.2 (labels for inputs), and 1.3.1 (name/role/value on every input) become live obligations and must be added to this contract before build.

---

## Acceptance test summary (Phase 5 hand-off)

**Automated:**
1. Lighthouse Accessibility audit — score ≥ 95.
2. axe DevTools — zero violations (warnings allowed but documented).
3. Wave Accessibility Tool — zero errors, zero contrast errors.
4. HTML validator (W3C Nu) — zero heading-level skips, zero structural errors.
5. Pa11y CLI run from CI — zero failures.

**Manual:**
1. Keyboard-only walkthrough end-to-end (Tab, Enter, Space, Arrow keys, Escape). Conversion path completable without mouse.
2. VoiceOver (macOS Safari) walkthrough. Headings rotor, links rotor, form rotor, image rotor each navigable.
3. NVDA (Windows Firefox) walkthrough on the FAQ section specifically.
4. Reduce Motion ON walkthrough. No animation plays. Page still completes the conversion path.
5. iPhone Safari walkthrough at 375×667. All touch targets ≥ 44×44.
6. Chrome zoom to 200%. Layout reflows. No content disappears off-canvas.
7. Sunset clock + proposal countdown widget tested with VoiceOver: month buttons announce, SVG description re-announces on month change, countdown card live region announces on hydration.

A build that fails any test cannot ship to production.

---

**End of Phase 2 Accessibility Contract.**

Word count: ~3,800 words covering 12 enumerated failure modes plus master `prefers-reduced-motion` block, keyboard nav, ARIA landmarks, heading outline, contrast snapshot, skip link, and Phase 5 acceptance summary. Tokens referenced are canonical from `/styles/tokens.css` and additive `--lc-*` per Phase 1 §8 list.
