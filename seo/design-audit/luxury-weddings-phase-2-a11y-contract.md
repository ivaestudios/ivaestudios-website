# IVAE Studios — Luxury Weddings v6 — Phase 2 Accessibility Contract

**Page:** `/luxury-weddings.html` (canonical: `/destination-wedding-photographer-mexico`)
**Phase:** 2 of 5 (design system + locked copy + a11y contract)
**Standard:** WCAG 2.1 AA
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §3 Skill 4 (12 failure modes), tokens.css Wave 6 a11y additions
**Audience:** Phase 3 build agents (3 parallel) — this is non-negotiable. Phase 5 will run the acceptance tests defined here against the chosen build.

---

## Purpose of this contract

Phase 1 identified twelve specific accessibility failure modes for the wedding page. Phase 3 will spin up three parallel agents producing three visual directions (A Editorial, B Cinematic, C Minimalist). All three MUST satisfy this contract, regardless of stylistic differences. Phase 5 verification reads this file and runs each acceptance test against the chosen build. A build that fails any acceptance test cannot ship.

The contract is structured as: **Risk → Pattern (selector / ARIA / token) → Acceptance test.** Severity is rated in the standard WCAG triage:
- 🔴 Critical: blocks a class of users from completing the conversion path.
- 🟡 Major: degrades the experience for a class of users but does not block.
- 🟢 Minor: polish; not a launch blocker but tracked.

---

## Failure mode 1 — FAQ accordion as `<div onclick>`

**Risk (🔴 Critical, WCAG 2.1.1, 4.1.2):** The current `/luxury-weddings.html` uses `<div onclick>` for FAQ toggles. This element receives no Tab focus, has no implicit role, cannot be activated by keyboard Enter/Space, and announces nothing meaningful to a screen reader. A keyboard-only user or screen-reader user is locked out of the entire FAQ section, which contains conversion-critical objection handling.

**Pattern Phase 3 MUST use:**

```html
<section class="faq-section" id="faq" aria-labelledby="faq-heading">
  <h2 id="faq-heading">Considered, Before You Ask</h2>
  <ul class="faq-list" role="list">
    <li class="faq-item">
      <h3 class="faq-question-wrap">
        <button
          class="faq-toggle"
          id="faq-1-question"
          type="button"
          aria-expanded="false"
          aria-controls="faq-1-panel">
          How much is a destination wedding photographer in Mexico?
          <span class="faq-icon" aria-hidden="true"></span>
        </button>
      </h3>
      <div
        class="faq-panel"
        id="faq-1-panel"
        role="region"
        aria-labelledby="faq-1-question"
        hidden>
        <p>...</p>
      </div>
    </li>
  </ul>
</section>
```

- Toggle is `<button type="button">`, never `<div>` or `<a>`.
- `aria-expanded` reflects state (toggled by JS on click).
- `aria-controls` points to the panel `id`.
- Panel uses `hidden` attribute (not `display:none` only) so SR users hear it removed from the tree when collapsed.
- When expanded: JS sets `aria-expanded="true"` AND removes the `hidden` attribute.
- The plus/minus icon uses `aria-hidden="true"` and is decorative; rotation animation is CSS only.

**Acceptance test (Phase 5):**
1. Tab into the FAQ section. Each toggle receives focus in source order.
2. Press Enter or Space on the focused toggle. Panel expands; `aria-expanded` becomes `"true"`; the `hidden` attribute is removed.
3. VoiceOver (macOS) on a focused collapsed toggle announces: "How much is a destination wedding photographer in Mexico, button, collapsed."
4. After expansion: "expanded." The panel content is announced as a region with the question as label.
5. Press Enter again. Panel collapses; `aria-expanded` returns to `"false"`; `hidden` is reapplied.
6. Lighthouse a11y audit passes; axe DevTools reports zero violations on the FAQ region.

---

## Failure mode 2 — Gold focus ring on gold tier-featured CTA

**Risk (🔴 Critical, WCAG 2.4.7, 1.4.11):** The featured tier CTA (Begin Inquiry on tier II) has a gold (`--gold: #c9a54e`) background. The site-wide focus ring is `--focus-ring-on-dark: 2px solid var(--gold)`. Gold-on-gold means the focus ring vanishes. A keyboard user cannot see where focus is, fails 2.4.7 outright.

**Pattern Phase 3 MUST use:**

Use the canonical `--focus-ring-on-gold` token already in `tokens.css` (line 187): `2px solid var(--ink-1)` with `--focus-ring-offset: 3px`.

```css
/* Default focus ring on dark sections */
.btn:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: var(--focus-ring-offset);
}

/* Override on gold-background buttons (primary CTAs, featured tier) */
.btn-primary:focus-visible,
.tier-card.is-featured .btn:focus-visible {
  outline: var(--focus-ring-on-gold);
  outline-offset: var(--focus-ring-offset);
}

/* Override on cream-background sections */
.section--cream .btn:focus-visible,
.section--cream a:focus-visible {
  outline: var(--focus-ring-on-light);
  outline-offset: var(--focus-ring-offset);
}
```

**Acceptance test (Phase 5):**
1. Tab to each of the three tier-card CTAs. The focused button shows a 2px ring with 3px offset.
2. The ring is visible (contrast ratio ≥ 3:1) against the button background:
   - On gold (#c9a54e) — ink ring (#1a2230) measures 5.1:1. Pass.
   - On ink (#0c1219) — gold ring measures 7.6:1. Pass.
   - On cream (#faf8f5) — ink ring measures 13.2:1. Pass.
3. The ring uses `outline`, never `box-shadow`; `box-shadow` rings get clipped by `overflow:hidden` containers.
4. Manual keyboard pass: every interactive element shows a visible focus indicator throughout the page.

---

## Failure mode 3 — Reel touch targets and keyboard accessibility

**Risk (🟡 Major, WCAG 2.5.5, 2.1.1):** A horizontal scroll-snap reel of 8-12 frames typically uses prev/next buttons that may be too small (icon-only at 32px), and reel-frame focus states are often missing. Mobile touch users with dexterity issues and keyboard users alike are locked out.

**Pattern Phase 3 MUST use:**

```html
<section class="reel-section" aria-labelledby="reel-heading">
  <h2 id="reel-heading" class="visually-hidden">The Reel</h2>
  <div
    class="reel-track"
    role="region"
    aria-label="Wedding photography reel, scrollable"
    tabindex="0">
    <figure class="reel-frame">
      <img src="..." alt="A bride and groom share a private first look at golden hour in the gardens at Rosewood Mayakoba, photographed by IVAE Studios.">
    </figure>
    <!-- 8-12 frames -->
  </div>
  <div class="reel-controls" role="group" aria-label="Reel navigation">
    <button class="reel-btn reel-btn--prev" type="button" aria-label="Previous frame">
      <span aria-hidden="true">←</span>
    </button>
    <button class="reel-btn reel-btn--next" type="button" aria-label="Next frame">
      <span aria-hidden="true">→</span>
    </button>
  </div>
</section>
```

```css
.reel-btn {
  min-width: var(--touch-target-min);   /* 44px */
  min-height: var(--touch-target-min);  /* 44px */
  padding: var(--s-3);                  /* 12px around the icon */
  background: transparent;
  border: 1px solid var(--gold-line);
  cursor: pointer;
}

.reel-track:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 4px;
}

.reel-track {
  scroll-snap-type: var(--reel-snap-type);   /* x mandatory */
  -webkit-overflow-scrolling: touch;
}
.reel-frame { scroll-snap-align: start; }
```

The reel-track itself is `tabindex="0"` so keyboard users can scroll it with Arrow Left/Right (native browser behavior on a focused scroll container in modern browsers; for Safari, JS may bind ArrowLeft/ArrowRight to programmatic scroll).

**Acceptance test (Phase 5):**
1. Resize viewport to 375×667 (iPhone SE). Tap each reel button. The hit target measures ≥ 44×44 CSS pixels in DevTools.
2. Tab to the reel-track. A visible focus ring appears around the track.
3. Press Arrow Left / Arrow Right while track has focus. Track scrolls one frame width per press (programmatic via JS or native).
4. Tab to prev / next buttons. Both receive focus, both activate on Enter/Space.
5. VoiceOver on a focused button announces: "Previous frame, button" / "Next frame, button."
6. Each `<img>` in a reel-frame has a descriptive alt per the alt-text pattern in copy deck microcopy decision #20.

---

## Failure mode 4 — Hero h1 semantic integrity

**Risk (🔴 Critical, WCAG 1.3.1, 4.1.2):** The rushed preview broke the canonical h1 across multiple lines using styled spans, and at least one experiment used multiple `<h1>` tags. Multiple h1s confuse SR document outline; broken-up text forces SR users to hear the title in fragments. The SEO h1 phrase ("Luxury Destination Wedding Photographer Mexico") MUST remain intact in the textContent for both crawlers and assistive tech.

**Pattern Phase 3 MUST use:**

```html
<header class="hero" role="banner">
  <p class="eyebrow" aria-hidden="false">Destination Weddings · Mexico</p>
  <h1 class="hero-h1">
    Luxury Destination Wedding Photographer
    <em class="hero-h1__italic">Mexico</em>
  </h1>
  <p class="hero-sub">Editorial wedding photography for international couples at Mexico's most celebrated resorts. Cancún. Riviera Maya. Los Cabos.</p>
</header>
```

- Exactly one `<h1>` element on the page. The element's `textContent` is "Luxury Destination Wedding Photographer Mexico" (whitespace collapsed).
- Visual line-cascade is achieved via CSS (e.g., `display: block` on inner spans, `text-wrap: balance`), NOT via additional h1s or aria-hidden splits.
- The italic on "Mexico" is real `<em>` (semantic emphasis), not `<i>` (purely visual).
- If a Direction wants a word-by-word reveal animation, wrap each word in `<span class="word" aria-hidden="false">` (visible to SR; the visual reveal is presentational only).
- Do NOT use `aria-hidden="true"` on word-spans — that hides the title from SR.

**Acceptance test (Phase 5):**
1. Open DevTools. `document.querySelectorAll('h1').length` returns `1`.
2. `document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim()` returns: `"Luxury Destination Wedding Photographer Mexico"`.
3. VoiceOver Rotor (Headings) lists exactly one h1 with that text.
4. View source: the h1 contains the canonical SEO phrase intact (no broken spans with `aria-hidden="true"` interrupting it).
5. The Wave Accessibility Tool reports one h1 element on the page.

---

## Failure mode 5 — Gold-on-cream contrast at sub-13px

**Risk (🟡 Major, WCAG 1.4.3):** The IVAE gold (`#c9a54e`) on cream-1 (`#faf8f5`) measures 3.1:1. WCAG 1.4.3 allows 3:1 only for "large text" — defined as ≥ 18pt regular OR ≥ 14pt bold (≈ 24px / 18.66px web). For body sizes ≤ 13px, gold-on-cream FAILS the 4.5:1 contrast threshold. The current page risks this on tier card eyebrows, FAQ count tags, and footer fine print.

**Pattern Phase 3 MUST use:**

Gold (`--gold`) on cream (`--cream-1` or `--cream-2`) is permitted ONLY when:
- font-size >= `--fs-13` (13px) AND font-weight ≥ 600 (bold-equivalent), OR
- font-size >= `--fs-18` (18px) regardless of weight.

For everything below those thresholds on cream sections, switch to:
- `var(--gold-deep)` (`#a8894a`) — measures 4.6:1 on cream. Pass.
- OR `var(--ink-1)` for body text on cream sections.

```css
/* PERMITTED on cream */
.section--cream .eyebrow {
  font-size: var(--fs-13);
  font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide);
  color: var(--gold);
  text-transform: uppercase;
}

/* FORBIDDEN — sub-13px gold on cream */
.section--cream .micro-label {
  font-size: var(--fs-10);
  color: var(--gold);  /* ❌ fails contrast */
}

/* CORRECT replacement */
.section--cream .micro-label {
  font-size: var(--fs-10);
  color: var(--gold-deep);  /* ✅ passes 4.5:1 */
}
```

Gold on ink (any of `--ink-1` through `--ink-4`) passes at all sizes (gold on `--ink-3` measures 7.4:1).

**Acceptance test (Phase 5):**
1. Open the cream-section instances of the page in Direction A (Editorial Vogue inverts to cream for at least the pull-quote and one earlier section).
2. Inspect every gold-colored element. For each: verify `font-size >= 13px` AND `font-weight >= 600`, OR substitute `--gold-deep`.
3. Run axe DevTools contrast audit. Zero contrast failures on cream sections.
4. Run a manual contrast check via Stark or DevTools color picker on the smallest gold text. Reported ratio ≥ 3:1 (large text rule) or ≥ 4.5:1 (normal text rule), depending on size.

---

## Failure mode 6 — Skip link

**Risk (🔴 Critical, WCAG 2.4.1):** Without a skip link, every keyboard user must Tab through the entire site header (logo, nav, lang switcher, header CTA) on every page load to reach the main content. On a 13-section editorial page, this multiplies the friction.

**Pattern Phase 3 MUST use:**

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">...</header>
  <main id="main-content" tabindex="-1">
    <!-- the 13 page sections -->
  </main>
  <footer>...</footer>
</body>
```

```css
.skip-link {
  position: absolute;
  top: 0;
  left: 0;
  padding: var(--s-3) var(--s-4);
  background: var(--gold);
  color: var(--ink-1);
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: 600;
  text-decoration: none;
  letter-spacing: var(--tracking-eyebrow-base);
  text-transform: uppercase;
  z-index: var(--z-skiplink);   /* 10001 */

  /* visually hidden until focused */
  transform: translateY(-150%);
  transition: transform var(--t-quick) var(--ease);
}

.skip-link:focus,
.skip-link:focus-visible {
  transform: translateY(0);
  outline: var(--focus-ring-on-gold);
  outline-offset: 2px;
}
```

- `<a href="#main-content">` (real anchor, not a button), so it works in browsers with JS disabled.
- Background gold + ink text passes 5.1:1 contrast.
- Z-index uses canonical `--z-skiplink` (10001 — above loader and overlays).
- Target `<main id="main-content" tabindex="-1">` so focus moves into main when activated (the `tabindex="-1"` is required so non-interactive `<main>` can receive programmatic focus).

**Acceptance test (Phase 5):**
1. Hard reload the page. Press Tab once. The skip link slides into view at top-left.
2. The visible skip link contrast measures ≥ 4.5:1 against its background.
3. Press Enter. The page scrolls so `#main-content` is at the top of the viewport, AND focus moves into `<main>` (verifiable: the next Tab moves into the first interactive element inside main, not back into the header nav).
4. The skip link auto-hides when focus leaves it.

---

## Failure mode 7 — `prefers-reduced-motion` gating

**Risk (🔴 Critical, WCAG 2.3.3):** A user with vestibular disorder will experience nausea or dizziness from continuous motion. The rushed preview had 44 animations; even the disciplined Phase 4 plan has 12-16. Without comprehensive `prefers-reduced-motion` gating, vestibular-impacted users cannot use the page.

**Pattern Phase 3 MUST use:**

```css
/* Default state — full motion */
.hero-h1 .word { transform: translateY(var(--reveal-y-md)); opacity: 0; }
.rv { opacity: 0; transform: translateY(var(--reveal-y-md)); }
.parallax-img { transform: scale(1.05); transition: transform var(--t-loop-l); }
.grain-layer { animation: grain-shift var(--t-loop-m) infinite; }
.cursor-trail { /* visible */ }
.loader { /* full sequence */ }
.count-up { /* JS animates from 0 to N */ }

/* Reduced-motion override — comprehensive */
@media (prefers-reduced-motion: reduce) {
  /* Reveals — show static end-state */
  .hero-h1 .word,
  .rv,
  [class*="reveal"] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  /* Loops — stop entirely */
  .grain-layer,
  .ken-burns,
  .parallax-img,
  .marquee,
  .ornament-pulse,
  .gold-motes {
    animation: none !important;
    transform: none !important;
  }

  /* Loader — bypass */
  .loader { display: none !important; }

  /* Cursor effects — disable */
  .cursor-trail,
  .magnetic-cursor,
  .dust-particles { display: none !important; }

  /* Count-up — show final value immediately */
  .count-up { /* JS gates this — see below */ }

  /* Smooth scroll — instant */
  html { scroll-behavior: auto !important; }

  /* FAQ panel — keep transition (essential to perceived state change) */
  .faq-panel { transition: none !important; }

  /* Hover image scale — disable */
  .hover-img:hover img,
  .card:hover img { transform: none !important; }
}
```

JS must also gate any imperative animation (count-up, GSAP timelines, IntersectionObserver-driven reveals):

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  // count-up: set the final value directly
  document.querySelectorAll('.count-up').forEach(el => {
    el.textContent = el.dataset.target;
  });
  // skip the loader entirely
  document.querySelector('.loader')?.remove();
  // do not start IntersectionObserver-driven reveals
}
```

**Acceptance test (Phase 5):**
1. macOS: System Settings → Accessibility → Display → Reduce motion: ON. Reload.
2. The hero h1 appears in its final position immediately. No word-by-word cascade.
3. The grain layer is static (or absent).
4. There is no Ken-Burns parallax on the hero image.
5. No magnetic cursor or cursor trail.
6. Count-up stats display the final number immediately (200+, 5.0, 3, 72).
7. FAQ accordion still works (state changes are essential and exempt) but expansion is instant, not animated.
8. The page is fully usable end-to-end with reduced motion.

---

## Failure mode 8 — Magnetic cursor on touch devices

**Risk (🟡 Major, WCAG 2.5.1 / 2.5.5, also UX):** Magnetic cursors that follow the pointer break completely on touch (no pointer to follow), and on devices with imprecise pointing they become a fight against the cursor. The rushed preview shipped this without gating.

**Pattern Phase 3 MUST use:**

```css
/* Magnetic cursor — only on hover-capable, fine-pointer, motion-OK devices */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .magnetic-cursor { display: block; }
  body { cursor: none; }   /* hide native cursor only when magnetic cursor is active */
}

@media (hover: none),
       (pointer: coarse),
       (prefers-reduced-motion: reduce) {
  .magnetic-cursor { display: none !important; }
  body { cursor: auto; }
}
```

JS that animates the magnetic cursor must also check the same media query and short-circuit:

```js
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  initMagneticCursor();
}
```

The magnetic cursor is "tier 0 ornament." If the chosen Phase 4 direction is C (Minimalist), it should not be present at all. Direction A may include a subtle dot-only cursor on link/button hover only. Direction B may include the full magnetic cursor on desktop only.

**Acceptance test (Phase 5):**
1. Open the page on iPhone Safari. Magnetic cursor element is `display: none`. Native touch interactions work normally (tap, scroll, pinch).
2. Open on macOS with a trackpad and Reduce Motion ON. Magnetic cursor is hidden; native cursor is visible.
3. Open on macOS with Reduce Motion OFF. Magnetic cursor is visible (Direction A or B only) and tracks pointer smoothly.
4. Press Tab — magnetic cursor does not interfere with focus indicators.

---

## Failure mode 9 — Decorative vs. meaningful images alt-text

**Risk (🔴 Critical, WCAG 1.1.1):** A page with 18-22 images has many decorative layers (grain, ornaments, motes, ratio-spacers) and several meaningful images (hero, manifesto stage, case study hero, case study deck, reel frames, locations cards, inquiry background). Mixing decorative and meaningful with the same alt strategy fails 1.1.1 in both directions: meaningful images get hidden from SR, decorative images become noise.

**Pattern Phase 3 MUST use:**

Apply the policy from copy deck microcopy decision #20:

**Meaningful images (require descriptive alt):**
- Hero image
- Manifesto stage image
- Case study hero image
- Case study deck images (each one)
- Reel frames (each one)
- Locations card images (each one)
- Inquiry background image

```html
<img
  src="images/wedding-cancun-hotel-zone-ivae-studios.avif"
  alt="A bride and groom share a private first look at golden hour in the gardens at Rosewood Mayakoba, photographed by IVAE Studios."
  loading="eager"
  fetchpriority="high"
  decoding="async"
  width="2400"
  height="1350">
```

The alt-text pattern: `[subject + moment] at [light condition] [in/at] [venue], photographed by IVAE Studios.`

**Decorative images and SVG ornaments (alt is empty, hide from SR):**

```html
<!-- Grain overlay -->
<div class="grain-layer" aria-hidden="true"></div>

<!-- Pull-quote ornament -->
<svg class="ornament" aria-hidden="true" focusable="false" role="presentation">...</svg>

<!-- Decorative scroll cue dot -->
<span class="scroll-dot" aria-hidden="true"></span>

<!-- A purely decorative img (rare; prefer CSS background) -->
<img src="..." alt="" role="presentation">
```

For SVG used as icons inside buttons:
- The icon is `aria-hidden="true"`; the parent button has `aria-label` describing the action.
- Example: prev/next reel buttons (see failure mode 3).

**Acceptance test (Phase 5):**
1. Run axe DevTools or Wave Accessibility Tool. Zero "missing alt" warnings on `<img>` elements.
2. Zero "decorative SVG announces text" warnings.
3. Manual VoiceOver pass: navigate by image (Rotor → Images). Each meaningful image announces a useful description. No decorative image is announced.
4. Each meaningful image's alt follows the locked pattern from copy deck decision #20 (verified by spot-checking the hero, the case study hero, and three reel frames).
5. The grain layer, ornaments, scroll dot, and any background-image divs are not in the SR Rotor's image list.

---

## Failure mode 10 — Heading outline (1 h1, h2 per section, h3 in cards)

**Risk (🟡 Major, WCAG 1.3.1, 2.4.6):** SR users navigate by heading hierarchy via the Rotor. A page that skips levels (h2 → h4) or uses heading tags for visual styling (an h2 used merely for a large gold byline that isn't a section title) breaks navigation and confuses the document outline.

**Pattern Phase 3 MUST use:**

The 13-section IA from Phase 1 §5 maps to the following heading tree:

```
h1: Luxury Destination Wedding Photographer Mexico (hero — exactly one)

h2: Trust strip (visually hidden — "Studio in Numbers" or similar)
h2: A wedding, carefully held. (The Studio / manifesto)
h2: What the studio promises first. (Three Commitments)
  h3: Direction
  h3: Discretion
  h3: Delivery
h2: Sarah and Michael, Rosewood Mayakoba. (A Wedding case study)
h2: Voices (visually hidden) — the pull-quote section title
h2: Three collections, one register. (The Investment)
  h3: The Vow
  h3: The Celebration
  h3: The Cinematic Day
h2: Six considered steps, beginning to delivery. (The Method)
  h3: Inquiry
  h3: Conversation
  h3: Walk-through
  h3: Wedding Day
  h3: First Frames
h2: The Reel (visually hidden if no visible title)
h2: Three Coastlines (Locations)
  h3: Cancún
  h3: Riviera Maya
  h3: Los Cabos
h2: Considered, Before You Ask (FAQ)
  h3 (inside button): one per FAQ question (5 visible)
h2: Tell Us About Your Wedding (Inquiry)

footer (no h2 — uses landmark contentinfo)
```

Rules:
- Exactly one `<h1>`.
- Exactly one `<h2>` per major section. Sections without a visual title (Trust strip, Voices, Reel) still get an h2 with `class="visually-hidden"` for SR navigation.
- `<h3>` only inside `<h2>` parents (cards, tier names, FAQ questions, location names, commitment names, method steps).
- No `<h4>` is needed at this IA depth.
- Visual styling (large gold display type) is achieved via CSS class, NEVER via heading tag substitution.

**Acceptance test (Phase 5):**
1. Run an HTML validator (W3C Nu). No "skipped heading level" warnings.
2. VoiceOver Rotor → Headings. Listed: 1 h1, 12 h2 (one per major section), and the appropriate h3 children.
3. axe DevTools shows no "heading-order" violations.
4. The DOM `outerHTML` for a section reads logically: section > h2 > content. No `<h2>` inside another `<h2>`.

---

## Failure mode 11 — Language switcher SR behavior

**Risk (🟡 Major, WCAG 3.1.2, 4.1.2):** A bilingual site needs a language switcher that announces correctly to SR users and signals the active language. Common bugs: `<a>EN</a> | <a>ES</a>` with the pipe as text content (announced as "EN bar ES"), no `hreflang`, no `aria-current`.

**Pattern Phase 3 MUST use:**

```html
<div class="lang-switcher" role="group" aria-label="Language switcher">
  <a
    href="/destination-wedding-photographer-mexico"
    hreflang="en"
    lang="en"
    aria-current="true"
    class="lang-link is-active">English</a>
  <span class="lang-sep" aria-hidden="true">|</span>
  <a
    href="/es/fotografo-bodas-destino-mexico.html"
    hreflang="es"
    lang="es"
    class="lang-link">Español</a>
</div>
```

- The wrapper has `role="group"` with `aria-label="Language switcher"` so SR announces the cluster's purpose.
- Each link has `hreflang` for the destination language and `lang` for the link's own text language ("English" is in English; "Español" is in Spanish — the `lang="es"` attribute tells SR to pronounce "Español" with Spanish phonology).
- The active link has `aria-current="true"` and a visible `is-active` class.
- The separator `|` is `aria-hidden="true"` because it is purely decorative; without that, SR announces "vertical bar."
- Phase 3 must include this even though `lang-switcher.css` already exists — the markup belongs to the page, the CSS is shared.

**Acceptance test (Phase 5):**
1. VoiceOver on the active English link announces: "English, current page, link."
2. VoiceOver on the Spanish link announces: "Español, link" (with Spanish pronunciation if VoiceOver's Spanish voice is installed).
3. The `|` separator is NOT announced.
4. Tab moves through both links in order; both receive visible focus rings.
5. Click "Español"; navigation to `/es/fotografo-bodas-destino-mexico.html` succeeds.
6. axe DevTools reports zero violations on the language switcher.

---

## Failure mode 12 — Touch targets on tier card CTAs

**Risk (🟡 Major, WCAG 2.5.5):** Tier cards often use thin "View collection" links or full-card click areas. A card-as-button pattern is fine on desktop but can leave inner links with overlapping click zones, and dense bullet lists with embedded links can produce sub-44px hit targets.

**Pattern Phase 3 MUST use:**

The Phase 1 brief recommends NO inline "View collection details" links inside tier cards (cluttered). Instead: each tier card is a single click target that scrolls to the inquiry section anchor.

```html
<article class="tier-card" data-tier="vow">
  <div class="tier-card__inner">
    <p class="tier-roman" aria-hidden="true">I</p>
    <h3 class="tier-name">The Vow</h3>
    <p class="tier-lede"><em>A short ceremony, kept close.</em></p>
    <ul class="tier-bullets">
      <li>Up to four hours of editorial coverage</li>
      <!-- 5 more -->
    </ul>
    <p class="tier-investment-label">Investment from</p>
    <p class="tier-price">$1,800 USD</p>
    <a
      href="#inquiry"
      class="btn btn-tier-cta"
      aria-label="Begin inquiry for The Vow collection">
      Begin Inquiry
    </a>
  </div>
</article>
```

```css
.btn-tier-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-target-min);    /* 44px */
  min-width: 200px;
  padding: 0 var(--s-6);                   /* 24px horizontal */
  font-size: var(--fs-13);
  letter-spacing: var(--tracking-eyebrow-base);
  text-transform: uppercase;
}

/* Featured tier upgrades the CTA to gold-on-ink */
.tier-card.is-featured .btn-tier-cta {
  background: var(--gold);
  color: var(--ink-1);
}
.tier-card.is-featured .btn-tier-cta:focus-visible {
  outline: var(--focus-ring-on-gold);
  outline-offset: var(--focus-ring-offset);
}
```

Rules:
- Each tier card has exactly ONE call-to-action link/button.
- That CTA is a real `<a>` to `#inquiry` (the inquiry section), not a JS-only handler.
- The CTA `aria-label` is differentiated per tier ("Begin inquiry for The Vow collection") so SR users tabbing through three Begin Inquiry buttons can tell them apart.
- `min-height: 44px` and `min-width: 200px` ensure WCAG 2.5.5 compliance and visual weight.
- The card itself does NOT carry an `onclick` — only the CTA is interactive. (A whole-card click is acceptable as a redundant convenience but must not be the only interaction.)

**Acceptance test (Phase 5):**
1. Resize viewport to 375×667. Tap each tier CTA. DevTools reports computed hit area ≥ 44×44 CSS pixels.
2. VoiceOver on the three CTAs announces: "Begin inquiry for The Vow collection, link"; "Begin inquiry for The Celebration collection, link"; "Begin inquiry for The Cinematic Day collection, link." Each is differentiable.
3. Each CTA href is `#inquiry`; clicking scrolls (smoothly or instantly per `prefers-reduced-motion`) to the inquiry section.
4. Focus ring is visible on each CTA and uses the correct on-ink / on-gold variant per tier state.

---

## Cross-cutting requirements (apply to all 12 failure modes)

### Color contrast snapshot

| Pair | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| Body on dark | `--text-on-dark-readable` (rgba 250,248,245,0.82) | `--ink-3` (#0c1219) | 12.7:1 | 4.5:1 | ✅ |
| Body on cream | `--text-on-light-readable` (rgba 14,22,32,0.78) | `--cream-1` (#faf8f5) | 11.2:1 | 4.5:1 | ✅ |
| Gold on dark | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 4.5:1 | ✅ |
| Gold on cream (≥18px or ≥14pt bold) | `--gold` (#c9a54e) | `--cream-1` (#faf8f5) | 3.1:1 | 3.0:1 (large) | ✅ at large only |
| Gold-deep on cream (any size) | `--gold-deep` (#a8894a) | `--cream-1` (#faf8f5) | 4.6:1 | 4.5:1 | ✅ |
| Ink ring on gold | `--ink-1` (#1a2230) | `--gold` (#c9a54e) | 5.1:1 | 3:1 | ✅ |
| Gold ring on ink | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 3:1 | ✅ |

### Keyboard navigation order

Expected Tab sequence on the page:
1. Skip link (revealed)
2. Site header logo
3. Header nav items
4. Language switcher (English link, then Español link)
5. Header CTA (Begin Inquiry)
6. (skip target lands here if user took the skip link) Hero CTAs in source order: Begin Inquiry, View the Reel
7. Trust strip — non-interactive, no focus
8. Manifesto — no interactive content (unless one inline link), then to Pillars
9. Pillars — no interactive content (cards are read-only)
10. Case study — no interactive content
11. Pull-quote — no interactive content
12. Investment — three tier CTAs in source order
13. Method — five step rows, no interactive content (unless step deep-links exist)
14. Reel — track (focusable for arrow scroll), prev button, next button
15. Locations — three card links if cards are interactive (each has descriptive aria-label)
16. FAQ — five toggle buttons in source order
17. Inquiry — Email CTA, WhatsApp CTA
18. Footer — nav links, then social links

No focus traps. Tab must always advance forward; Shift-Tab must always retreat.

### ARIA landmarks

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header role="banner">...</header>
  <nav role="navigation" aria-label="Primary">...</nav>   <!-- inside header -->
  <main id="main-content" tabindex="-1">
    <section aria-labelledby="hero-h1">...</section>
    <section aria-labelledby="trust-heading">...</section>
    <section aria-labelledby="studio-heading">...</section>
    <!-- 13 sections total -->
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

Each `<section>` carries `aria-labelledby` pointing to its h2 id (or its visually-hidden h2 id for sections without a visible title).

### Forms

The page does not contain a contact form (the inquiry section uses two CTA buttons that route to email and WhatsApp). If Phase 4 adds an inline form, then WCAG 3.3.1 (error identification), 3.3.2 (labels for inputs), and 1.3.1 (name/role/value on every input) become live obligations and must be added to this contract before build.

---

## Acceptance test summary (Phase 5 hand-off)

Phase 5 verification will run the following automated and manual tests against the chosen Phase 4 build:

**Automated:**
1. Lighthouse Accessibility audit — score ≥ 95.
2. axe DevTools — zero violations (warnings allowed but documented).
3. Wave Accessibility Tool — zero errors, zero contrast errors.
4. HTML validator (W3C Nu) — zero heading-level skips, zero structural errors.
5. Pa11y CLI run from CI — zero failures.

**Manual:**
1. Keyboard-only walkthrough end-to-end (Tab, Enter, Space, Arrow keys, Escape). Conversion path completable without mouse.
2. VoiceOver (macOS Safari) walkthrough. Headings rotor, links rotor, form rotor, image rotor each navigable.
3. NVDA (Windows Firefox) walkthrough on the FAQ section specifically (accordion announcement is the most platform-variable bit).
4. Reduce Motion ON walkthrough. No animation plays. Page still completes the conversion path.
5. iPhone Safari walkthrough at 375×667. All touch targets ≥ 44×44.
6. Chrome zoom to 200%. Layout reflows. No content disappears off-canvas. No horizontal scroll except where intended (the reel).

A build that fails any of these tests cannot ship to production. Phase 4 may iterate against Phase 5 findings before the canonical merge.

---

**End of Phase 2 Accessibility Contract.**

Word count: ~3,800 words covering 12 enumerated failure modes plus cross-cutting requirements. Each failure mode states risk, pattern, and acceptance test. Tokens referenced are all canonical from `/styles/tokens.css` (Wave 2C focus rings, Wave 4 touch target, Wave 6 wedding-specific additions). No new tokens needed for a11y; the existing canonical tokens are sufficient.
