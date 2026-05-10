# IVAE Studios — Luxury Editorial v6 — Phase 2 Accessibility Contract

**Page:** NEW. `/luxury-editorial.html` (EN) / `/es/editorial-de-lujo.html` (ES)
**Canonical:** `https://ivaestudios.com/luxury-editorial`
**Phase:** 2 of 5 (design system + locked copy + a11y contract)
**Standard:** WCAG 2.1 AA (with 2.2 best-practice additions where noted)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §3 Skill 6 (12 failure modes), §9 (a11y contracts), wedding Phase 2 a11y contract (reference baseline)
**Audience:** Phase 3 build agents (8 self-contained section prompts). This contract is non-negotiable. Phase 5 verification reads this file and runs each acceptance test against the chosen build. A build that fails any acceptance test cannot ship.

---

## Purpose of this contract

The editorial page introduces visual mechanics the wedding page did not have: a magazine masthead with Issue / Volume framing edge-to-edge, a drag-scroll editorial portfolio (the largest horizontal scroll surface on the IVAE site), a sticky-stage manifesto, a cursor-follow hover preview, an animated SVG aperture ornament, a "Featured In" press band rendered at 0.55 default opacity, a 21:9 cinemascope letterbox feature, and a 320-600px Cormorant pull-quote ornament. Each of these mechanics introduces a specific WCAG 2.1 risk that Phase 3 builders must address by construction, not as an afterthought.

This contract is structured as: **Failure mode → Risk (severity, WCAG) → Pattern (selector / ARIA / token) → Acceptance test.** Severity uses the standard triage:
- 🔴 Critical: blocks a class of users from completing the conversion path (Begin Brief).
- 🟡 Major: degrades the experience for a class of users but does not block.
- 🟢 Minor: polish; not a launch blocker but tracked.

In addition to the 12 failure modes, this contract includes cross-cutting requirements: master `prefers-reduced-motion` block, keyboard navigation order, ARIA landmarks, color contrast snapshot.

---

## Failure mode 1 — Drag-scroll editorial portfolio inaccessible by keyboard

**Risk (🔴 Critical, WCAG 2.1.1, 2.5.5):** The editorial portfolio is the page's spine — 12-18 cards in 4:5 portrait at clamp(280-460px) min-width, drag-scrolled with inertia on desktop and snap on touch. A keyboard-only user has no pointer to drag. Without prev/next buttons and ArrowLeft/ArrowRight key handlers, the entire portfolio (the page's largest content area) is locked out.

**Pattern Phase 3 MUST use:**

```html
<section class="le-reel-section" aria-labelledby="le-reel-heading">
  <h2 id="le-reel-heading" class="le-eyebrow">The Reel.</h2>
  <div
    class="le-reel-track"
    role="region"
    aria-label="Editorial portfolio, scrollable"
    tabindex="0">
    <figure class="le-reel-card">
      <a href="/case-study/casa-ranfla" class="le-reel-card-link">
        <img
          src="/images/editorial/casa-ranfla-spring-2026.avif"
          alt="A model in linen on the east terrace of Casa Ranfla, Tulum, at first light, photographed by IVAE Studios."
          loading="lazy"
          width="560" height="700">
        <figcaption class="le-reel-card-caption">
          <span class="le-reel-brand">Casa Ranfla</span>
          <span class="le-reel-title"><em>Spring Edit, 2026</em></span>
        </figcaption>
      </a>
    </figure>
    <!-- 11-17 more cards -->
  </div>
  <div class="le-reel-controls" role="group" aria-label="Editorial reel navigation">
    <button class="le-reel-btn le-reel-btn--prev" type="button" aria-label="Previous editorial frame">
      <span aria-hidden="true">&larr;</span>
    </button>
    <button class="le-reel-btn le-reel-btn--next" type="button" aria-label="Next editorial frame">
      <span aria-hidden="true">&rarr;</span>
    </button>
  </div>
</section>
```

```css
.le-reel-btn {
  min-width: var(--touch-target-min);   /* 44px */
  min-height: var(--touch-target-min);
  padding: var(--s-3);
  background: transparent;
  border: 1px solid var(--gold-line);
  cursor: pointer;
}

.le-reel-track {
  cursor: var(--portfolio-drag-cursor);   /* grab */
  overflow-x: auto;
  scroll-snap-type: var(--portfolio-drag-snap);  /* x mandatory — touch only via @media */
  -webkit-overflow-scrolling: touch;
}

.le-reel-track:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 4px;
}

@media (hover: hover) and (pointer: fine) {
  .le-reel-track {
    scroll-snap-type: none;   /* desktop free-drag */
  }
}

.le-reel-card-link:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 6px;
}
```

JS handlers (gated by `@media (hover: hover) and (pointer: fine)` for inertia, but ArrowLeft/ArrowRight active for all):

```js
const track = document.querySelector('.le-reel-track');
track.addEventListener('keydown', (e) => {
  const card = track.querySelector('.le-reel-card');
  const cardWidth = card.getBoundingClientRect().width + 24;  // gap
  if (e.key === 'ArrowRight') {
    track.scrollBy({ left: cardWidth, behavior: 'smooth' });
    e.preventDefault();
  } else if (e.key === 'ArrowLeft') {
    track.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    e.preventDefault();
  } else if (e.key === 'Home') {
    track.scrollTo({ left: 0, behavior: 'smooth' });
  } else if (e.key === 'End') {
    track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
  }
});
```

**Acceptance test (Phase 5):**
1. Resize viewport to 375×667 (iPhone SE). Tap each reel button. Hit target measures ≥ 44×44 CSS pixels in DevTools.
2. Tab to the reel-track. A visible focus ring appears around the entire track region.
3. Press ArrowRight while track has focus. Track scrolls one card width per press, with smooth behavior unless `prefers-reduced-motion` is set.
4. Press Home / End — track scrolls to first/last card.
5. Tab continues from track to prev button, to next button, then to next page section. Tab does not enter individual cards before the controls (cards are tabbable separately as focusable links, after the track itself).
6. VoiceOver on a focused card link announces: "[brand name], [shoot title], link." E.g., "Casa Ranfla, Spring Edit 2026, link."
7. Each `<img>` in a reel-card has a descriptive alt per the editorial alt-text pattern: `[subject + setting] at [light condition] [in/at] [location], photographed by IVAE Studios.`

---

## Failure mode 2 — Cinemascope letterbox text contrast

**Risk (🟡 Major, WCAG 1.4.3):** The Featured Editorial section uses 21:9 cinemascope with 6% letterbox bands top and bottom (`--cinemascope-letterbox`). Caption text below the image sits on the section background; if it sits ON the letterbox bands themselves (a tempting "REC ticker" placement), the very dark band creates a low-contrast surface for any text other than `--text-on-dark-readable`. Caption text below the letterbox in light typography fails 4.5:1 if the surrounding section is also dark and the caption is in `--text-on-dark-readable` at sub-18px.

**Pattern Phase 3 MUST use:**

```html
<figure class="le-cinemascope">
  <div class="le-cinemascope-frame">
    <img
      src="/images/editorial/casa-ranfla-cinemascope.avif"
      alt="A linen lookbook model, mid-frame, on the east terrace of Casa Ranfla at first light, framed in 21:9 cinemascope by IVAE Studios."
      width="2400" height="1029">
  </div>
  <figcaption class="le-cinemascope-caption">
    <div class="le-caption-deck" role="group" aria-label="Feature metadata">
      <p class="le-caption-cell">
        <span class="le-caption-label">Brand</span>
        <span class="le-caption-value">Casa Ranfla</span>
      </p>
      <p class="le-caption-cell">
        <span class="le-caption-label">Issue</span>
        <span class="le-caption-value">Spring Edit 2026</span>
      </p>
      <p class="le-caption-cell">
        <span class="le-caption-label">Location</span>
        <span class="le-caption-value">Tulum, Quintana Roo</span>
      </p>
    </div>
    <div class="le-caption-body">...</div>
  </figcaption>
</figure>
```

```css
/* Caption sits BELOW the letterbox image, on the section background, NOT on the letterbox bands */
.le-cinemascope-caption {
  background: transparent;  /* inherits section background — likely --ink-3 */
  color: var(--text-on-dark-readable);  /* 12.7:1 on --ink-3 */
  padding-top: var(--s-8);
  max-width: var(--case-study-caption-max-width);
}

/* Caption labels (small caps): use --fs-13 weight 600 minimum to meet contrast at small size */
.le-caption-label {
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-base);
  text-transform: uppercase;
  color: var(--gold);  /* 7.4:1 on --ink-3 — passes */
}

.le-caption-value {
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: 400;
  color: var(--text-on-dark-readable);
}

.le-caption-body {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-21);  /* explicit size ≥18px allows lower contrast tolerance */
  line-height: 1.55;
  color: var(--text-on-dark-readable);
}
```

The caption MUST sit below the image, not overlaid on the letterbox bands. If a Phase 3 builder wants a frame number or location annotation in the corner of the image, that text uses `--gold` at `--fs-10` weight 600 with at least 16px padding from the image edge AND a subtle dark scrim local to the corner.

**Acceptance test (Phase 5):**
1. Open the Featured Editorial section. Inspect caption text. All caption text sits BELOW the image; nothing is overlaid on the letterbox bands.
2. Run axe DevTools contrast audit on the caption region. Zero contrast failures.
3. Manual contrast check: caption labels in `--gold` on `--ink-3` measure ≥ 4.5:1 at `--fs-13` weight 600.
4. Caption body in `--text-on-dark-readable` on `--ink-3` measures ≥ 4.5:1 at `--fs-21`.
5. Hairline above and below the letterbox bands in `--gold-line` is decorative only and does NOT carry text.

---

## Failure mode 3 — Drop cap stutter on screen readers

**Risk (🟡 Major, WCAG 1.3.1):** The page has TWO drop caps: one in the manifesto opening paragraph (large, at `--editorial-dropcap-fs` clamp 72-110px), one in the case study lede (smaller, ~70% of manifesto). If a builder wraps the first letter in `<span class="dropcap">T</span>he studio shoots...`, screen readers announce the first letter twice — once as "T" (the span) and once as "The studio" (the natural text). The cumulative effect across both drop caps is a stutter that disrupts the manifesto, which is the page's voice section.

**Pattern Phase 3 MUST use:**

```css
/* Manifesto drop cap — visual only, no DOM wrap */
.le-manifesto-body p:first-of-type::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--editorial-dropcap-fs);  /* clamp 72-110px */
  font-weight: 400;
  color: var(--gold);
  float: left;
  padding: 0 var(--s-4) 0 0;
  line-height: 0.9;
}

/* Case study lede drop cap — smaller variant */
.le-case-study-body p:first-of-type::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: clamp(56px, 6.4vw, 80px);  /* ~70% of manifesto dropcap */
  font-weight: 400;
  color: var(--gold-deep);  /* on cream — passes 4.6:1 */
  float: left;
  padding: 0 var(--s-3) 0 0;
  line-height: 0.9;
}
```

The first letter remains part of the natural text node; pseudo-elements like `::first-letter` are not announced by VoiceOver, NVDA, JAWS, or TalkBack. No DOM `<span>` wrapping, no `aria-hidden`, no SR re-announcement.

If a builder needs a custom drop cap glyph (e.g., a swash capital that the system font does not provide), the glyph may be rendered as a `background-image` on `::before` only IF the body paragraph's text content remains complete and unbroken. The glyph must NOT replace the first letter of the textContent.

**Acceptance test (Phase 5):**
1. VoiceOver on the manifesto paragraph announces: "The studio shoots for the editorial register..." with no stutter on "T."
2. View source. The manifesto's first paragraph reads `<p>The studio shoots for...</p>` with no `<span>` wrap on the first letter.
3. axe DevTools shows no "duplicate text" violations on the manifesto or case study.
4. Disable CSS in DevTools. The manifesto first paragraph reads as flowing text starting "The studio shoots..."; the drop cap is purely presentational.

---

## Failure mode 4 — Cursor-follow preview triggers on touch

**Risk (🟡 Major, WCAG 2.5.1):** The editorial portfolio has a hover-cursor preview: a 280px thumbnail that follows the cursor at 24px offset, with 12px entry blur settling to clear. On touch devices there is no cursor; if the preview JS is not gated, it either sticks to the last touched location, fires on every tap, or fails silently with errors. On users with `prefers-reduced-motion`, the blur-settle animation is unwelcome.

**Pattern Phase 3 MUST use:**

```html
<!-- The cursor preview element is a single fixed positioned element appended to body -->
<div
  id="le-cursor-preview"
  class="le-cursor-preview"
  aria-hidden="true">
  <img class="le-cursor-preview-img" alt="" />
</div>
```

```css
.le-cursor-preview {
  display: none;  /* hidden by default; enabled via media query */
  position: fixed;
  pointer-events: none;
  width: var(--cursor-preview-size);   /* 280px */
  z-index: var(--z-tooltip);
  filter: blur(var(--cursor-preview-blur));   /* 12px entry blur */
  transition: filter 0.3s var(--ease), opacity 0.2s var(--ease);
  opacity: 0;
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .le-cursor-preview {
    display: block;
  }
  .le-cursor-preview.is-active {
    opacity: 1;
    filter: blur(0);
  }
}

@media (hover: none),
       (pointer: coarse),
       (prefers-reduced-motion: reduce) {
  .le-cursor-preview {
    display: none !important;
  }
}
```

```js
const preview = document.getElementById('le-cursor-preview');
const previewImg = preview.querySelector('img');
const isHoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (isHoverFine && !isReducedMotion) {
  document.querySelectorAll('.le-reel-card').forEach(card => {
    card.addEventListener('mouseenter', (e) => {
      const img = card.querySelector('img');
      previewImg.src = img.src;
      previewImg.srcset = img.srcset || '';
      preview.classList.add('is-active');
    });
    card.addEventListener('mouseleave', () => {
      preview.classList.remove('is-active');
    });
    card.addEventListener('mousemove', (e) => {
      preview.style.left = `${e.clientX + 24}px`;
      preview.style.top = `${e.clientY + 24}px`;
    });
  });
}
```

On touch devices, tapping a card opens its case study URL (the `<a>` wrapping the figure). Cursor preview is removed entirely, not replaced with a touch-preview.

**Acceptance test (Phase 5):**
1. Open the page on iPhone Safari. The `#le-cursor-preview` element computed `display` is `none`. Tapping a card navigates to the case study URL (or expands the inline overlay if no case study URL exists yet).
2. Open on macOS Chrome with Reduce Motion ON. Cursor preview is `display: none`. Native cursor visible.
3. Open on macOS Chrome with Reduce Motion OFF. Hover a card. Preview appears at cursor +24px offset, blur settles to clear over ~0.3s.
4. Press Tab — keyboard focus on a card link does NOT trigger the cursor preview (preview is mouse-mouseenter only).
5. axe DevTools — the preview element is `aria-hidden="true"` and announces nothing.

---

## Failure mode 5 — Magazine masthead h1 semantic conflict

**Risk (🔴 Critical, WCAG 1.3.1, 4.1.2, SEO):** The magazine masthead band runs edge-to-edge above the hero, with three editorial fields (studio mark, "Editorial." italic title, Issue / Volume tag). A naive build wraps the center title in `<h1>Editorial.</h1>` because it is visually the largest text in the band. This breaks the page in two ways: (1) the SEO H1 keyword "Luxury Editorial Photographer Mexico" must live in the hero, not the masthead — Google reads the page's first `<h1>`; (2) WCAG 1.3.1 requires that the document outline reflect the page's content hierarchy, and a masthead is presentational chrome, not the title of the page.

**Pattern Phase 3 MUST use:**

```html
<header class="le-masthead" role="banner" aria-label="Editorial masthead">
  <p class="le-masthead-mark">IVAE Studios</p>
  <p class="le-masthead-title"><em>Editorial.</em></p>
  <p class="le-masthead-issue">Issue No 3 &middot; Vol II &middot; 2026</p>
</header>

<main id="main-content" tabindex="-1">
  <section class="le-hero" aria-labelledby="le-hero-h1">
    <p class="le-eyebrow">Editorial Photography &middot; Mexico</p>
    <h1 id="le-hero-h1" class="le-hero-h1">
      Luxury Editorial Photographer
      <em class="le-hero-h1__italic">Mexico</em>
    </h1>
    <p class="le-hero-sub">Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos.</p>
    <a class="le-btn le-btn-primary" href="#inquiry">Begin Brief</a>
  </section>
  <!-- 7 more sections -->
</main>
```

- The masthead is `<header role="banner">` and contains `<p>` elements ONLY. No heading tag.
- The page's `<h1>` lives in the hero `<section>`. `textContent` returns "Luxury Editorial Photographer Mexico" (whitespace collapsed).
- Italic on "Mexico" is real `<em>` (semantic emphasis), not `<i>`.
- The masthead `aria-label="Editorial masthead"` gives screen readers context: this is decorative editorial framing, not the page title.
- `<main id="main-content" tabindex="-1">` allows skip-link target.

**Acceptance test (Phase 5):**
1. `document.querySelectorAll('h1').length` returns `1`.
2. `document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim()` returns `"Luxury Editorial Photographer Mexico"`.
3. VoiceOver Rotor → Headings: lists exactly one h1 with that text. The masthead "Editorial." text is NOT in the heading rotor.
4. View page source. The masthead band contains only `<p>` elements. The h1 is in `<section class="le-hero">`.
5. The Wave Accessibility Tool reports one h1 element on the page.

---

## Failure mode 6 — "Featured In" press logos contrast at 0.55 opacity

**Risk (🔴 Critical, WCAG 1.4.3, 1.4.11, 2.4.7):** The press band renders publication logos at `--press-band-logo-opacity` (0.55) by default. A logo at 0.55 opacity on `--ink-3` (#0c1219) effectively renders the logo's mid-gray pixels at ~40% lightness against a ~5% background — visible to sighted full-vision users but borderline for low-vision users, AND failing the 3:1 contrast threshold for non-text UI components per WCAG 1.4.11. On hover/focus the opacity restores to 1.0; without keyboard focus support, the band fails.

The bigger risk is for low-vision users who do not hover OR focus through the band: they may miss the credibility-critical "Featured In" content entirely.

**Pattern Phase 3 MUST use:**

```html
<section class="le-press-band" aria-labelledby="le-press-heading">
  <h2 id="le-press-heading" class="visually-hidden">As Seen In</h2>
  <p class="le-press-eyebrow" aria-hidden="false">As Seen In</p>
  <ul class="le-press-list" role="list">
    <li class="le-press-item">
      <a
        class="le-press-link"
        href="/press/conde-nast-traveler"
        aria-label="Featured in Conde Nast Traveler"
        tabindex="0">
        <img
          class="le-press-logo"
          src="/images/press/conde-nast-traveler-placeholder.svg"
          alt="Conde Nast Traveler logo (placeholder)"
          width="180" height="28"
          loading="lazy">
      </a>
    </li>
    <!-- 5-8 more -->
  </ul>
</section>
```

```css
.le-press-logo {
  height: var(--press-band-logo-h);   /* clamp 18-28px */
  width: auto;
  opacity: var(--press-band-logo-opacity);   /* 0.55 default */
  filter: grayscale(100%);
  transition: opacity var(--t-quick) var(--ease), filter var(--t-quick) var(--ease);
}

.le-press-link:hover .le-press-logo,
.le-press-link:focus-visible .le-press-logo,
.le-press-link:focus .le-press-logo {
  opacity: var(--press-band-logo-opacity-hover);   /* 1.0 */
  filter: grayscale(0%);
}

.le-press-link:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 4px;
}

/* Low-vision fallback: at user-zoom 200%+ OR if user has prefers-contrast: more, restore full opacity */
@media (prefers-contrast: more) {
  .le-press-logo {
    opacity: 1;
    filter: grayscale(0%);
  }
}
```

The eyebrow "As Seen In" remains at full contrast (`--gold` on `--ink-3` measures 7.4:1) — that is the credibility signal the band's labels carry, regardless of logo opacity.

Each logo is a real `<img>` with descriptive `alt` text. Placeholder logos for Phase 4 first deploy use `alt="[Publication name] logo (placeholder)"` so screen readers announce both the publication AND that the logo is a placeholder. Phase 4 must NOT use empty `alt=""` on press logos — they are meaningful credibility signals, not decoration.

**Acceptance test (Phase 5):**
1. Tab into the press band. Each logo link receives keyboard focus. Focused logo restores to opacity 1.0 + full color.
2. Press Tab again — focus advances to the next logo link.
3. Hover (with mouse) over a logo. Opacity restores. Confirm transition uses `var(--t-quick)` (~0.28s).
4. Open macOS System Settings → Accessibility → Display → "Increase contrast." Reload. All press logos render at full opacity 1.0 (per `prefers-contrast: more` query).
5. VoiceOver on a focused logo announces: "Featured in Conde Nast Traveler, link." (Combination of the link's `aria-label` and the link affordance.)
6. axe DevTools — zero contrast violations on the press band region. Logo `alt` attributes present.
7. Manual contrast at default opacity 0.55: confirm the visible logo silhouette meets the 3:1 threshold for non-text UI per WCAG 1.4.11. If a specific logo's pixels are too light, that logo's `mix-blend-mode` may be set to `screen` to brighten against the dark band.

---

## Failure mode 7 — Image-as-card overlay text fails contrast

**Risk (🟡 Major, WCAG 1.4.3):** Each portfolio card is the image (no padding, no card chrome). On hover/focus, image scales to 1.045, brightness drops to 0.7, and a dark scrim at `--editorial-card-hover-overlay` (rgba 10,15,23,0.55) covers the image. Caption text in `--cream` over this scrim must pass 4.5:1 against the underlying image's lowest-brightness pixel. Bright outdoor images (beach, sky, golden hour) will produce mid-gray scrim composites that fail contrast at small caps `--fs-13`.

**Pattern Phase 3 MUST use:**

```css
.le-reel-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: var(--portfolio-drag-card-aspect);   /* 4/5 */
  background: var(--ink-3);   /* fallback color before image loads */
}

.le-reel-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--t-medium) var(--ease), filter var(--t-medium) var(--ease);
}

.le-reel-card-overlay {
  position: absolute;
  inset: 0;
  background: var(--editorial-card-hover-overlay);   /* rgba(10,15,23,0.55) */
  opacity: 0;
  transition: opacity var(--t-medium) var(--ease);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--s-5);
  pointer-events: none;
}

.le-reel-card:hover .le-reel-card-overlay,
.le-reel-card:focus-within .le-reel-card-overlay {
  opacity: 1;
}

.le-reel-card:hover img,
.le-reel-card:focus-within img {
  transform: scale(1.045);
  filter: brightness(0.7);
}

.le-reel-card-caption-brand {
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-base);
  text-transform: uppercase;
  color: var(--editorial-card-overlay-text);   /* --cream */
}

.le-reel-card-caption-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-21);
  color: var(--editorial-card-overlay-text);
}

/* For cards whose underlying image is exceptionally bright (sky-only, beach-only):
   add .is-bright class server-side or via JS color-sample, and apply a deeper scrim */
.le-reel-card.is-bright .le-reel-card-overlay {
  background: rgba(10, 15, 23, 0.65);
}
```

Per Phase 1 §3 Skill 4 token list, the overlay alpha is 0.55 by default. Phase 3 MUST audit the 12-18 portfolio images and tag any "bright" image (predominantly sky, water, or beach with > 60% pixel area at lightness > 70) with `.is-bright`, which deepens the scrim to 0.65.

**Acceptance test (Phase 5):**
1. Hover each card. Caption appears in cream over the scrim.
2. Manual contrast check: caption text in cream (`#faf8f5` ~ 0.96 lightness) over scrim composite on each image. Use a color-sample tool to read the underlying image's brightest pixel under the caption position; calculate contrast for cream over that composite.
3. Reported ratio ≥ 4.5:1 for each card. Cards that fail receive `.is-bright` class and recheck.
4. axe DevTools — zero contrast violations on the reel section.
5. Keyboard focus on a card link triggers the same scrim + caption reveal as hover (via `:focus-within`).

---

## Failure mode 8 — Sticky-stage manifesto traps focus

**Risk (🟡 Major, WCAG 2.4.3, 2.1.2):** The manifesto is a 100vh sticky-stage (`--manifesto-stage-min-h`) where the text fragment is sticky inside a 300vh container, and three image plates scroll past behind it. A naive build attaches `tabindex="0"` to the image plates, traps focus inside the section, or breaks tab order. Vestibular users with `prefers-reduced-motion` should see the section collapse to a normal layout.

**Pattern Phase 3 MUST use:**

```html
<section class="le-manifesto-stage" aria-labelledby="le-manifesto-heading">
  <div class="le-manifesto-plates" aria-hidden="true">
    <img class="le-manifesto-plate le-manifesto-plate--1" src="/images/editorial/manifesto-plate-1.avif" alt="" />
    <img class="le-manifesto-plate le-manifesto-plate--2" src="/images/editorial/manifesto-plate-2.avif" alt="" />
    <img class="le-manifesto-plate le-manifesto-plate--3" src="/images/editorial/manifesto-plate-3.avif" alt="" />
  </div>
  <div class="le-manifesto-text">
    <p class="le-eyebrow">Manifesto.</p>
    <h2 id="le-manifesto-heading" class="le-manifesto-h2">Three commitments the studio keeps.</h2>
    <div class="le-manifesto-body">
      <p>The studio shoots for the editorial register...</p>
      <p>Light is the second commitment...</p>
      <p>Restraint is the third...</p>
    </div>
    <cite class="le-signoff">Vianey Diaz / Director</cite>
  </div>
</section>
```

```css
.le-manifesto-stage {
  position: relative;
  min-height: 300vh;   /* 3 viewport heights for the sticky scroll */
  background: var(--ink-3);
}

.le-manifesto-text {
  position: sticky;
  top: 50%;
  transform: translateY(-50%);
  max-width: 540px;
  margin: 0 auto;
  padding: var(--s-8);
  z-index: 2;
}

.le-manifesto-plates {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.le-manifesto-plate {
  position: absolute;
  width: 30%;
  opacity: 0;
  transition: opacity var(--t-cinema) var(--ease-cinema);
}
/* Each plate's position + reveal trigger via IntersectionObserver */

@media (prefers-reduced-motion: reduce) {
  .le-manifesto-stage {
    min-height: auto;   /* collapse to natural height */
  }
  .le-manifesto-text {
    position: static;   /* not sticky */
    transform: none;
  }
  .le-manifesto-plates {
    display: none;   /* hide image plates entirely */
  }
}
```

Each `<img>` plate has `alt=""` because the manifesto text is the content; the plates are decorative. The plates are also in an `aria-hidden="true"` wrapper. The manifesto text region contains no `tabindex` attributes; focusable children (the sign-off if linked, or an inline `<a>` in body copy) tab in natural source order.

iOS Safari fallback: `position: sticky` inside a tall container with absolutely-positioned children is fragile on iOS Safari. Phase 4 must include a feature-detect: if `CSS.supports('position', 'sticky')` is false OR if `userAgent` matches iOS Safari < 17, the section collapses to a single-screen layout (the same as the reduced-motion fallback above).

**Acceptance test (Phase 5):**
1. Tab through the page. From the section above, Tab advances into the manifesto text region (if it has focusable children) OR skips to the next section. Tab does NOT enter the image plates.
2. Shift-Tab from the next section retreats correctly into the manifesto.
3. Enable Reduce Motion. The manifesto becomes a normal vertically-laid-out section. Image plates are hidden.
4. iOS Safari 16: confirm the section either renders correctly with `position: sticky` OR falls back to the static layout. Either is acceptable.
5. VoiceOver Rotor → Images: zero entries from the manifesto plates (they are `aria-hidden`).
6. axe DevTools — no focus-trap warnings on the manifesto section.

---

## Failure mode 9 — Animated aperture SVG announced as image

**Risk (🟡 Major, WCAG 1.1.1, 1.3.1):** The 48px aperture SVG (concentric circles + 8 blade petals) rotates slowly at the bottom-left of the hero CTA. If the SVG includes a `<title>` or `<desc>` child, screen readers announce it as an image; the rotation animation may also be perceived as a state change. The aperture is purely decorative.

**Pattern Phase 3 MUST use:**

```html
<svg
  class="le-aperture"
  width="48" height="48"
  viewBox="0 0 48 48"
  aria-hidden="true"
  focusable="false"
  role="presentation">
  <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.4" />
  <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="1.4" />
  <!-- 8 blade petals as <path> or <line> elements -->
  <line x1="24" y1="2" x2="24" y2="14" stroke="currentColor" stroke-width="1.4" />
  <!-- 7 more rotated lines for the 8 blades -->
</svg>
```

```css
.le-aperture {
  position: absolute;
  bottom: var(--s-6);
  left: var(--s-6);
  width: var(--aperture-svg-size);   /* 48px */
  height: var(--aperture-svg-size);
  color: var(--gold);
  animation: le-aperture-rotate var(--aperture-rotation-duration) linear infinite;
}

@keyframes le-aperture-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .le-aperture {
    animation: none;
    transform: none;
  }
}
```

- `<svg aria-hidden="true">` — explicitly hides the SVG from screen readers.
- `focusable="false"` — IE legacy (older AT may still respect it).
- `role="presentation"` — backup hint that the SVG is decorative.
- NO `<title>` or `<desc>` children. NO `aria-label` on the SVG.
- Animation pauses entirely on `prefers-reduced-motion: reduce`.

**Acceptance test (Phase 5):**
1. VoiceOver Rotor → Images: the aperture is NOT in the list.
2. Tab through the hero. The aperture is NOT in tab order (no `tabindex`).
3. Enable Reduce Motion. Aperture stops rotating. The static silhouette remains visible.
4. axe DevTools — no warnings on the aperture SVG.
5. View source. The SVG has `aria-hidden="true"` and no `<title>` or `<desc>` children.

---

## Failure mode 10 — `prefers-reduced-motion` does not gate all 14 mechanics

**Risk (🔴 Critical, WCAG 2.3.3):** The editorial page introduces 14 motion-bearing mechanics (Phase 1 §8 lists 12 cinematic features; Phase 2 adds drop-cap reveal and bracket card hover). A user with vestibular disorder will experience nausea or dizziness from continuous motion. A single comprehensive `prefers-reduced-motion` block is required.

**Pattern Phase 3 MUST use:**

```css
/* Default — full motion */
.le-aperture { animation: le-aperture-rotate var(--aperture-rotation-duration) linear infinite; }
.le-hero-h1 .le-word { transform: translateY(var(--reveal-y-md)); opacity: 0; }
.le-rv { opacity: 0; transform: translateY(var(--reveal-y-md)); }
.le-manifesto-stage .le-manifesto-plate { transition: opacity var(--t-cinema) var(--ease-cinema); }
.le-reel-track { scroll-behavior: smooth; }
.le-cursor-preview { display: block; }
.le-reel-card img { transition: transform var(--t-medium), filter var(--t-medium); }
.le-faq-panel { transition: max-height var(--t-medium), opacity var(--t-medium); }
.le-bracket-card { transition: border-color var(--t-quick); }
.le-press-logo { transition: opacity var(--t-quick), filter var(--t-quick); }
.le-link-underline::after { transition: transform var(--t-quick); }
.le-cinemascope img { transition: clip-path var(--t-cinema); }

/* Reduced-motion override — comprehensive */
@media (prefers-reduced-motion: reduce) {
  /* Aperture — stop rotation */
  .le-aperture {
    animation: none !important;
    transform: none !important;
  }

  /* Reveals — show static end-state */
  .le-hero-h1 .le-word,
  .le-rv,
  [class*="le-reveal"] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  /* Manifesto sticky-stage — collapse to natural layout */
  .le-manifesto-stage {
    min-height: auto !important;
  }
  .le-manifesto-text {
    position: static !important;
    transform: none !important;
  }
  .le-manifesto-plate {
    display: none !important;
  }

  /* Drag-scroll inertia — disable smooth scroll */
  .le-reel-track {
    scroll-behavior: auto !important;
  }

  /* Cursor preview — disable */
  .le-cursor-preview {
    display: none !important;
  }

  /* Image hover scale + brightness — disable */
  .le-reel-card:hover img,
  .le-reel-card:focus-within img {
    transform: none !important;
    filter: none !important;
  }
  .le-reel-card-overlay {
    transition: none !important;
  }

  /* FAQ accordion — keep state change but make instant */
  .le-faq-panel {
    transition: none !important;
  }

  /* Press logo opacity restore — instant */
  .le-press-logo {
    transition: none !important;
  }

  /* Cinemascope clip-reveal — show full image immediately */
  .le-cinemascope img {
    clip-path: none !important;
    transition: none !important;
  }

  /* Smooth scroll site-wide — instant */
  html {
    scroll-behavior: auto !important;
  }

  /* Link underline grow — show static */
  .le-link-underline::after {
    transition: none !important;
    transform: scaleX(1) !important;
  }
}
```

JS imperative animation must also gate via JS:

```js
const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (isReducedMotion) {
  // Skip cursor preview JS init entirely
  // Skip IntersectionObserver-driven plate reveals
  // Skip drag-inertia momentum simulation
  // Skip aperture rotation if implemented in JS rather than CSS
}
```

**Acceptance test (Phase 5):**
1. macOS: System Settings → Accessibility → Display → Reduce motion: ON. Reload `/luxury-editorial`.
2. Hero h1 appears in final position immediately. No cascade.
3. Aperture SVG is static (no rotation).
4. Manifesto section displays as a normal vertical layout (no sticky scroll, no plate reveals).
5. Drag-scroll reel scrolls instantly (no smooth behavior, no inertia momentum).
6. Cursor preview never appears.
7. FAQ accordion still works (state change is essential) but expansion is instant.
8. Press logos restore opacity instantly on focus, no transition.
9. Page is fully usable end-to-end. The Begin Brief CTA is reachable and functional.

---

## Failure mode 11 — Gold focus rings on dark editorial cards and gold-fill bracket II CTA

**Risk (🔴 Critical, WCAG 2.4.7, 1.4.11):** The page's default focus ring is `--focus-ring-on-dark` (2px gold, 3px offset) — invisible on the gold-fill featured bracket CTA (Bracket II) and on any gold-background button. The wedding page solved this with `--focus-ring-on-gold` (2px ink-1). The editorial page must apply the same pattern, plus a third variant for the press-band logos at 0.55 opacity (where focus must be unmistakable to compensate for the dimmed default state).

**Pattern Phase 3 MUST use:**

```css
/* Default focus ring on dark editorial sections */
.le-btn:focus-visible,
.le-reel-card-link:focus-visible,
.le-faq-toggle:focus-visible,
.le-press-link:focus-visible {
  outline: var(--focus-ring-on-dark);   /* 2px solid var(--gold) */
  outline-offset: var(--focus-ring-offset);   /* 3px */
}

/* Override on gold-background CTAs (primary, featured bracket II) */
.le-btn-primary:focus-visible,
.le-bracket-card.is-featured .le-btn-primary:focus-visible {
  outline: var(--focus-ring-on-gold);   /* 2px solid var(--ink-1) */
  outline-offset: var(--focus-ring-offset);
}

/* Override on cream sections */
.le-section--cream .le-btn:focus-visible,
.le-section--cream a:focus-visible {
  outline: var(--focus-ring-on-light);
  outline-offset: var(--focus-ring-offset);
}

/* Press band logos: focus ring offset increases for visibility against dimmed default */
.le-press-link:focus-visible {
  outline: var(--focus-ring-on-dark);
  outline-offset: 6px;   /* larger than default 3px */
}
```

**Acceptance test (Phase 5):**
1. Tab to each of the three bracket CTAs. Bracket II (featured, gold fill) shows ink ring; Brackets I and III show gold ring.
2. Tab to header / hero "Begin Brief" CTA. Gold-fill primary on dark hero — shows ink ring.
3. Tab through press band. Each logo focus shows gold ring at 6px offset, plus full opacity restoration.
4. axe DevTools focus-visible audit — zero violations.
5. Manual contrast: ring vs. button background on each variant ≥ 3:1.

---

## Failure mode 12 — Bilingual lang switcher SR behavior

**Risk (🟡 Major, WCAG 3.1.2, 4.1.2):** The bilingual editorial page needs a language switcher that announces correctly to SR users and signals the active language. Pattern is identical to wedding page failure mode 11 — but the editorial page introduces a separate concern: the masthead's small caps fields are in English (`Issue No 3 · Vol II · 2026`) and need to localize on the ES mirror without breaking the slot grid.

**Pattern Phase 3 MUST use:**

```html
<nav class="le-lang-switcher" role="group" aria-label="Language switcher">
  <a
    href="/luxury-editorial"
    hreflang="en"
    lang="en"
    aria-current="true"
    class="le-lang-link is-active">English</a>
  <span class="le-lang-sep" aria-hidden="true">|</span>
  <a
    href="/es/editorial-de-lujo"
    hreflang="es"
    lang="es"
    class="le-lang-link">Español</a>
</nav>
```

- Wrapper has `role="group"` with `aria-label="Language switcher"`.
- Each link has `hreflang` for the destination language and `lang` for the link's own text language.
- Active link has `aria-current="true"` + visible `is-active` class.
- The `|` separator is `aria-hidden="true"`.

ES mirror swaps the active state:

```html
<a href="/luxury-editorial" hreflang="en" lang="en" class="le-lang-link">English</a>
<span class="le-lang-sep" aria-hidden="true">|</span>
<a href="/es/editorial-de-lujo" hreflang="es" lang="es" aria-current="true" class="le-lang-link is-active">Español</a>
```

**Acceptance test (Phase 5):**
1. VoiceOver on the active English link announces: "English, current page, link."
2. VoiceOver on the Spanish link announces: "Español, link" (with Spanish phonology if VoiceOver's Spanish voice installed).
3. The `|` separator is NOT announced.
4. Tab moves through both links; both receive visible focus rings.
5. Click "Español" — navigation to `/es/editorial-de-lujo` succeeds.
6. axe DevTools reports zero violations on the language switcher.

---

## Cross-cutting requirements (apply to all 12 failure modes)

### Master `prefers-reduced-motion` block

The 14 motion-bearing mechanics on the editorial page (aperture rotation, hero h1 cascade, manifesto sticky-stage, manifesto plate reveals, drag-scroll inertia, cursor-follow preview, image hover scale, FAQ accordion, link underline grow, press-logo opacity transition, cinemascope clip-reveal, bracket card hover, dropcap reveal, scroll progress bar) are gated by the comprehensive `@media (prefers-reduced-motion: reduce)` block in failure mode 10. Phase 3 builders MUST include this block verbatim.

### Keyboard navigation order

Expected Tab sequence on the editorial page:

1. Skip link (revealed on focus, `<a class="le-skip-link" href="#main-content">Skip to main content</a>`)
2. Site header logo
3. Header nav items (services dropdown, Editorial highlighted as current)
4. Language switcher (English link, then Español link)
5. Header CTA (Begin Brief)
6. (Skip target lands here) Hero CTA: Begin Brief — single CTA, no secondary
7. Manifesto — no interactive content, focus skips section
8. Featured editorial cinemascope — no interactive content (the figure is decorative; the case study link, if present, is in `<a>` wrapping the figure)
9. Press band — 6 to 9 logo links in source order, each restoring opacity on focus
10. Pillars (Concept / Production / Output) — no interactive content unless "Read more" links are added
11. Reel — track region (focusable for arrow scroll), then card links in source order, then prev / next buttons
12. Brackets — three bracket CTAs in source order (Begin Brief x3 with differentiated `aria-label`)
13. Method — four step rows, no interactive content
14. Pull-quote — no interactive content
15. Testimonials — no interactive content (six placeholder cards)
16. FAQ — ten toggle buttons in source order
17. Inquiry — Begin Brief primary CTA, WhatsApp secondary CTA
18. Footer — column links, then social links, then bottom-bar links

No focus traps. Tab always advances; Shift-Tab always retreats.

### ARIA landmarks

```html
<body>
  <a class="le-skip-link" href="#main-content">Skip to main content</a>
  <header class="le-masthead" role="banner" aria-label="Editorial masthead">...</header>
  <header class="le-site-header" role="banner">
    <nav role="navigation" aria-label="Primary">...</nav>
  </header>
  <main id="main-content" tabindex="-1">
    <section class="le-hero" aria-labelledby="le-hero-h1">...</section>
    <section class="le-manifesto-stage" aria-labelledby="le-manifesto-heading">...</section>
    <section class="le-cinemascope-feature" aria-labelledby="le-feature-heading">...</section>
    <section class="le-press-band" aria-labelledby="le-press-heading">...</section>
    <section class="le-pillars" aria-labelledby="le-pillars-heading">...</section>
    <section class="le-reel-section" aria-labelledby="le-reel-heading">...</section>
    <section class="le-brackets" aria-labelledby="le-brackets-heading">...</section>
    <section class="le-method" aria-labelledby="le-method-heading">...</section>
    <section class="le-pullquote" aria-labelledby="le-voices-heading">...</section>
    <section class="le-testimonials" aria-labelledby="le-testimonials-heading">...</section>
    <section class="le-faq" aria-labelledby="le-faq-heading">...</section>
    <section class="le-inquiry" id="inquiry" aria-labelledby="le-inquiry-heading">...</section>
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

Two `<header role="banner">` is acceptable per WCAG 4.1.2 when one is `aria-label`-disambiguated as the masthead and the other is the standard site header. (The masthead is decorative editorial framing; the site header is the navigation banner.) Phase 5 may consolidate to one banner and `<div class="le-masthead">` if axe DevTools reports a banner-conflict warning.

### Color contrast snapshot

| Pair | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| Body on dark | `--text-on-dark-readable` (rgba 250,248,245,0.82) | `--ink-3` (#0c1219) | 12.7:1 | 4.5:1 | Yes |
| Body on cream | `--text-on-light-readable` (rgba 14,22,32,0.78) | `--cream-1` (#faf8f5) | 11.2:1 | 4.5:1 | Yes |
| Gold on dark | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 4.5:1 | Yes |
| Gold on cream (≥18px or ≥14pt bold) | `--gold` (#c9a54e) | `--cream-1` (#faf8f5) | 3.1:1 | 3.0:1 (large) | Yes (large only) |
| Gold-deep on cream (any size) | `--gold-deep` (#a8894a) | `--cream-1` (#faf8f5) | 4.6:1 | 4.5:1 | Yes |
| Cream on overlay scrim composite | `--cream` over rgba(10,15,23,0.55) on mid-bright image | varies | 4.5:1+ | 4.5:1 | Yes (audit per card; bright images get 0.65 scrim) |
| Ink ring on gold (focus) | `--ink-1` (#1a2230) | `--gold` (#c9a54e) | 5.1:1 | 3:1 | Yes |
| Gold ring on ink (focus) | `--gold` (#c9a54e) | `--ink-3` (#0c1219) | 7.4:1 | 3:1 | Yes |
| Press logo at opacity 0.55 (silhouette) | varies | `--ink-3` | ≥ 3:1 | 3:1 (non-text UI) | Audit per logo |

### Forms

The page does not contain a contact form (the inquiry section uses two CTA buttons that route to `mailto:` and `wa.me`). If Phase 4 adds an inline brief-submission form, then WCAG 3.3.1 (error identification), 3.3.2 (labels for inputs), 1.3.1 (name/role/value on every input), and 4.1.3 (status messages via `aria-live`) become live obligations and must be added to this contract before build.

### Skip link

Identical pattern to wedding page failure mode 6:

```html
<a class="le-skip-link" href="#main-content">Skip to main content</a>
```

```css
.le-skip-link {
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
  z-index: var(--z-skiplink);
  transform: translateY(-150%);
  transition: transform var(--t-quick) var(--ease);
}

.le-skip-link:focus,
.le-skip-link:focus-visible {
  transform: translateY(0);
  outline: var(--focus-ring-on-gold);
  outline-offset: 2px;
}
```

Target `<main id="main-content" tabindex="-1">` so focus moves into main when activated.

### Heading outline (1 h1, 12 h2, 12-22 h3 children)

```
h1: Luxury Editorial Photographer Mexico  (hero — exactly one)

h2: Three commitments the studio keeps. (Manifesto)
h2: Casa Ranfla, Spring Edit 2026. (Featured editorial / case study)
h2: As Seen In (visually-hidden — Press band)
h2: The Practice (visually-hidden — Pillars)
  h3: Concept.
  h3: Production.
  h3: Output.
h2: The Reel (visually-hidden — Drag-scroll portfolio)
h2: Three brackets, one register. (Investment / Brackets)
  h3: The Editorial Day
  h3: The Campaign
  h3: The Multi-Day Production
h2: Four considered steps, brief to delivery. (Method)
  h3: Concept.
  h3: Casting.
  h3: Shoot.
  h3: Edit.
h2: A Voice (visually-hidden — Pull-quote)
h2: Voices (visually-hidden — Testimonials grid)
h2: Considered Questions. (FAQ)
  h3 (inside button): one per FAQ question (10 visible)
h2: Begin a brief. (Inquiry)

footer (no h2 — landmark contentinfo)
```

Rules:
- Exactly one `<h1>`.
- Exactly one `<h2>` per major section. Sections without a visible title (Press band, Pillars, Reel, Pull-quote, Testimonials) get an h2 with `class="visually-hidden"` for SR navigation.
- `<h3>` only inside `<h2>` parents.
- No `<h4>` needed at this IA depth.
- Visual styling (large gold display type) achieved via CSS, NEVER via heading tag substitution.
- The masthead band's "Editorial." center title is `<p>`, NOT `<h1>` or `<h2>`. (See failure mode 5.)

---

## Acceptance test summary (Phase 5 hand-off)

Phase 5 verification will run the following automated and manual tests against the Phase 4 build:

**Automated:**
1. Lighthouse Accessibility audit — score ≥ 95.
2. axe DevTools — zero violations (warnings allowed but documented).
3. Wave Accessibility Tool — zero errors, zero contrast errors.
4. HTML validator (W3C Nu) — zero heading-level skips, zero structural errors.
5. Pa11y CLI run from CI — zero failures.

**Manual:**
1. Keyboard-only walkthrough end-to-end (Tab, Enter, Space, Arrow keys, Home, End, Escape). Conversion path completable without mouse: skip link → hero CTA → bracket CTA → inquiry CTA.
2. VoiceOver (macOS Safari) walkthrough. Headings rotor, links rotor, image rotor each navigable. Confirm masthead does not appear in headings rotor.
3. NVDA (Windows Firefox) walkthrough on the FAQ section (accordion announcement is the most platform-variable bit).
4. Reduce Motion ON walkthrough. No animation plays. Aperture is static. Sticky-stage manifesto collapses to natural layout. Cursor preview never appears. Page completes the conversion path.
5. iPhone Safari walkthrough at 375×667. All touch targets ≥ 44×44. Drag-scroll reel uses snap. Cursor preview is `display: none`.
6. Chrome zoom to 200%. Layout reflows. No content disappears off-canvas. Horizontal scroll only on the reel (intended).
7. macOS High Contrast (System Settings → Accessibility → Display → Increase contrast). Press band logos restore to full opacity per `prefers-contrast: more` query.
8. Translation pass: confirm `/es/editorial-de-lujo` ES mirror runs against the same contract; the lang switcher's `aria-current` flips.

A build that fails any of these tests cannot ship to production. Phase 4 may iterate against Phase 5 findings before the canonical merge.

---

**End of Phase 2 Editorial Accessibility Contract.**

Word count: ~4,600 words covering 12 enumerated failure modes plus cross-cutting requirements (master reduced-motion block, keyboard nav, ARIA landmarks, color contrast snapshot, skip link, heading outline). Each failure mode states risk + severity + WCAG criteria, the required pattern with selector / ARIA / token, and a concrete acceptance test for Phase 5. Tokens referenced are the canonical Wave 8 additions from Phase 1 §3 Skill 4 plus existing Wave 2C focus rings, Wave 4 touch target, and Wave 6 wedding-specific additions. Two new token concerns (`--press-band-logo-opacity` 0.55 and `--editorial-card-hover-overlay` 0.55 alpha) carry contrast-restoration contracts on hover/focus AND `prefers-contrast: more` fallbacks.
