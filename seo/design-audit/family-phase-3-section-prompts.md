# IVAE Studios — Luxury Family Photos v6 — Phase 3 Section Build Prompts

**Page:** `/luxury-family-photos.html` (canonical: `/luxury-family-photos-cancun`)
**Phase:** 3 of 5 (eight parallel section build agents — Section 1 through Section 8)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief (12 cinematic features, 3 personas, IA), Phase 2 copy deck, Phase 2 a11y contract

This document contains eight independent prompts. Each prompt is self-contained: a Phase 3 agent can execute its assigned section without reading the others. All eight target the same 12-section IA, the same locked copy deck, and the same a11y contract. Each agent produces ONE HTML fragment file at `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec{N}.html`. Phase 4 merges the eight fragments into a single self-contained `/luxury-family-photos.html`.

---

## Common contract for all eight agents (read first)

1. **Tokens before all else.** Load `/styles/tokens.css` first, then `/dark-mode.css`, then a single page-scoped `<style>` block. NEVER inline a `:root`. Consume canonical tokens (`--gold`, `--ink-3`, `--cream-1`, `--font-serif`, `--font-sans`, `--ease`, `--ease-cinema`, `--t-quick`, `--t-medium`, `--t-cinema`) plus the additive `--lf-*` tokens proposed in Phase 1 §3 Skill 4 (Wave 6.5).
2. **Locked copy.** All copy is locked in `/seo/design-audit/family-phase-2-copy-deck.md`. Do not paraphrase. Do not rearrange. Do not invent new sections.
3. **Locked a11y.** All a11y patterns are mandated in `/seo/design-audit/family-phase-2-a11y-contract.md`. Follow exactly.
4. **SEO head locked.** Per Phase 1 §11, every `<meta>`, `<link>`, and `<script type="application/ld+json">` from the current `/luxury-family-photos.html` must remain verbatim. Sections do not edit the head; the head is owned by the merge step.
5. **Visibility-safe defaults.** Every content element MUST default to `opacity: 1; transform: none;` in CSS. Animations enhance only when `html.js-on` is present (set by the page's bootstrap script if JS is enabled). This means: with JS off OR scripts blocked, every section's content is fully visible without intervention. Reveal animations are progressive enhancement, not a gate.
6. **Visible class names.** Every section uses the `lf-` prefix (luxury family). Wedding peer page uses `lw-`; family page uses `lf-`. No collisions.
7. **Token usage.** All colors, sizes, spacing, motion, ratios reference `var(--…)`. No hex literals outside SVG fills which may use `currentColor` with a parent gold class. No hardcoded px outside what tokens.css provides.
8. **Output file path.** Each agent writes to `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec{N}.html`. The fragment is a complete `<section>` (or `<header>`+`<section>` for Section 1) plus a `<style>` scoped to that section's class names plus a `<script>` if needed.
9. **Button color contracts.** Every CTA must satisfy the contrast pairs in the a11y contract §D. Featured tier CTA: ink on gold (5.1:1). Outline CTAs: gold on ink (7.4:1). Skip link: ink on gold. Focus rings use `--focus-ring-on-dark` / `--focus-ring-on-gold` / `--focus-ring-on-light` per section background.
10. **Reduced motion.** Every animation in your section must be wrapped in `@media (prefers-reduced-motion: no-preference)` blocks OR have a comprehensive `@media (prefers-reduced-motion: reduce)` override that sets `animation: none; transform: none; transition: none;` and skips JS imperative animations.

---

## Section 1 — Header + Hero (cinematic h1 cascade, gold motes, 3D parallax, magnetic CTA)

**Section index:** 1
**Cinematic features owned:** #1 (3D mouse parallax hero), #2 (SVG film grain), #3 (floating gold motes — 8 motes), #4 (magnetic CTAs), #6 (count-up "500+ families since 2019" — embedded in stats meta strip)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec1.html`

**Required HTML structure (skeleton):**

```html
<header class="lf-site-header" role="banner" id="siteHeader">
  <a class="header-logo" href="/">IVAE <span>Studios</span></a>
  <nav class="header-nav" role="navigation" aria-label="Primary">
    <ul role="list">
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/destination-wedding-photographer-mexico">Weddings</a></li>
      <li><a href="/luxury-family-photos-cancun" aria-current="page" class="active">Families</a></li>
      <li><a href="/couples-photography-mexico">Couples</a></li>
      <li><a href="/blog">Journal</a></li>
    </ul>
    <div class="lang-switcher" role="group" aria-label="Language switcher">
      <a href="/luxury-family-photos-cancun" hreflang="en" lang="en" aria-current="true" class="lang-link is-active">English</a>
      <span class="lang-sep" aria-hidden="true">|</span>
      <a href="/es/fotos-familiares-lujo-cancun" hreflang="es" lang="es" class="lang-link">Español</a>
    </div>
  </nav>
  <a class="header-cta btn btn-primary-sm" href="#inquiry">Begin Inquiry</a>
  <button class="header-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav" id="headerToggle">
    <span></span><span></span><span></span>
  </button>
</header>

<a class="skip-link" href="#main-content">Skip to main content</a>

<section class="lf-hero" id="hero" aria-labelledby="hero-h1">
  <div class="lf-hero-bg" id="lfHeroBg" aria-hidden="true">
    <img class="lf-hero-img" src="/images/family-cancun-hotel-zone-ivae-studios.jpg" alt="" loading="eager" fetchpriority="high" decoding="async" width="2400" height="1350">
    <div class="lf-hero-overlay"></div>
    <div class="lf-grain" aria-hidden="true"></div>
    <div class="lf-motes" aria-hidden="true">
      <span class="lf-mote" style="--lf-mote-x:8vw;--lf-mote-delay:0s;"></span>
      <span class="lf-mote" style="--lf-mote-x:22vw;--lf-mote-delay:3s;"></span>
      <span class="lf-mote" style="--lf-mote-x:34vw;--lf-mote-delay:6s;"></span>
      <span class="lf-mote" style="--lf-mote-x:48vw;--lf-mote-delay:9s;"></span>
      <span class="lf-mote" style="--lf-mote-x:62vw;--lf-mote-delay:12s;"></span>
      <span class="lf-mote" style="--lf-mote-x:74vw;--lf-mote-delay:15s;"></span>
      <span class="lf-mote" style="--lf-mote-x:86vw;--lf-mote-delay:18s;"></span>
      <span class="lf-mote" style="--lf-mote-x:94vw;--lf-mote-delay:21s;"></span>
    </div>
  </div>
  <div class="lf-hero-content">
    <p class="eyebrow">Family Portraits / Mexico</p>
    <h1 class="hero-h1" id="hero-h1">An Editorial Archive of <em class="hero-h1__italic">Your Family.</em></h1>
    <p class="hero-sub">The studio plans the hour around the family. Cancún. The Riviera Maya. Los Cabos. Editorial coverage, calm direction, bilingual on the day.</p>
    <p class="lf-availability" aria-label="Studio availability">
      <span class="lf-availability-dot" aria-hidden="true"></span>
      Earliest open / Inquire to hold the date
    </p>
    <div class="lf-hero-ctas">
      <a class="btn btn-primary" href="#inquiry" data-magnet>Begin Inquiry</a>
      <a class="btn btn-ghost" href="#frames">See the Frames</a>
    </div>
  </div>
  <div class="lf-meta-strip" role="group" aria-label="Studio in numbers">
    <div class="lf-stat">
      <span class="lf-stat-num" aria-hidden="true">2019</span>
      <span class="lf-stat-label">Since</span>
    </div>
    <div class="lf-stat" aria-label="Five hundred plus families photographed">
      <span class="lf-stat-num" data-count-to="500" aria-hidden="true">0</span><span class="lf-stat-suffix" aria-hidden="true">+</span>
      <span class="lf-stat-label">Families</span>
    </div>
    <div class="lf-stat" aria-label="Forty-two reviews">
      <span class="lf-stat-num lf-stat-num--word" aria-hidden="true">Forty-Two</span>
      <span class="lf-stat-label">Reviews</span>
    </div>
    <div class="lf-stat" aria-label="Five point zero star rating">
      <span class="lf-stat-num" aria-hidden="true">5.0</span><span class="lf-stat-suffix" aria-hidden="true">&#9733;</span>
      <span class="lf-stat-label">Rating</span>
    </div>
  </div>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-site-header` — fixed top, transparent → `rgba(14,22,32,0.92)` on `.scrolled`, backdrop-filter blur 14px.
- `.skip-link` — see a11y contract §E.
- `.lf-hero` — `min-height: 100vh; perspective: 1200px; background: var(--ink-3);` Position relative.
- `.lf-hero-img` — absolute inset 0, object-fit cover, object-position center, brightness(0.45) saturate(0.85), `will-change: transform`. The 3D parallax JS updates `transform: translate3d(...)` on `mousemove` (gated per a11y FM 1).
- `.lf-grain` — fixed overlay z-index 9998, `opacity: var(--lf-grain-opacity)` (0.028), `pointer-events: none`, `aria-hidden="true"`.
- `.lf-motes` — absolute inset 0 within hero, `pointer-events: none`. Each `.lf-mote` is a 4px gold dot animated `lf-mote-rise 26s linear infinite` with `--lf-mote-delay` per element.
- `.lf-hero-content` — relative z-index 2, padding bottom `clamp(80px, 10vw, 140px)`, max-width 720px.
- `.hero-h1` — `font-family: var(--font-serif); font-size: clamp(48px, 7vw, 92px); font-weight: 300; line-height: 1.06; color: var(--text-on-dark);`
- `.hero-h1__italic` — italic, color `var(--gold)`.
- `.hero-sub` — `color: var(--text-on-dark-readable); font-size: var(--fs-15); line-height: 1.85; max-width: 560px;`
- `.lf-availability` — gold dot + text, `color: var(--text-on-dark-readable)`, font `--fs-13`.
- `.lf-availability-dot` — 6px gold circle, `animation: lf-pulse 4s ease-in-out infinite` gated.
- `.btn-primary` — `background: var(--gold); color: var(--ink-1); padding: 18px 36px; font-size: var(--fs-13); font-weight: 600; letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase; text-decoration: none; min-height: 44px;` Underline draws on hover/focus via `::after`.
- `.btn-ghost` — gold border + gold text, transparent bg.
- `.lf-meta-strip` — flex row at desktop, 2x2 grid on mobile. Each `.lf-stat` shows large numeral + small label.

**Required JS:**

```js
// Bootstrap: mark JS-on so reveals can engage
document.documentElement.classList.add('js-on');

// Header scroll
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', scrollY > 40);
}, { passive: true });

// Mobile menu
document.getElementById('headerToggle').addEventListener('click', (e) => {
  const expanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!expanded));
  // toggle a sibling mobile nav, scoped to the section's contract
});

// 3D mouse parallax — gated
const supportsParallax = window.matchMedia('(hover: hover) and (pointer: fine)').matches
                     && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (supportsParallax) {
  const heroBg = document.getElementById('lfHeroBg');
  const heroImg = heroBg?.querySelector('.lf-hero-img');
  if (heroImg) {
    document.querySelector('.lf-hero').addEventListener('mousemove', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
      const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 16;
      heroImg.style.transform = `translate3d(${-dx}px, ${-dy}px, 0) scale(1.04)`;
    }, { passive: true });
  }
}

// Count-up — gated; skip on reduce-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const countEls = document.querySelectorAll('[data-count-to]');
if (prefersReducedMotion) {
  countEls.forEach(el => { el.textContent = el.dataset.countTo; });
} else {
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.countTo, 10);
      const start = performance.now();
      const dur = 1600;
      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      }
      requestAnimationFrame(tick);
      countObs.unobserve(el);
    });
  }, { threshold: 0.4 });
  countEls.forEach(el => countObs.observe(el));
}

// Magnetic CTA — gated
if (supportsParallax) {
  document.querySelectorAll('[data-magnet]').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width - 0.5) * 8;
      const dy = ((e.clientY - r.top) / r.height - 0.5) * 8;
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}
```

**Locked microcopy:**
- Hero eyebrow: `Family Portraits / Mexico`
- Hero h1: `An Editorial Archive of Your Family.` (italic on "Your Family")
- Hero subhead: as in §2.3 of copy deck
- Availability: `Earliest open / Inquire to hold the date`
- Primary CTA: `Begin Inquiry`
- Secondary CTA: `See the Frames`
- Stats labels: `Since 2019` `500+ Families` `Forty-Two Reviews` `5.0 ★`

**A11y rules satisfied:**
- FM 1 (3D parallax gated on hover/pointer/reduced-motion)
- FM 4 (magnetic CTA underline-grow as non-motion affordance)
- FM 5 (motes `aria-hidden`, gated)
- FM 6 (grain `aria-hidden`, `pointer-events: none`)
- FM 8 (count-up `aria-hidden` digit; parent `aria-label` carries the final value)
- Cross-cutting C (h1 exactly once, eyebrow/sub structure, lang-switcher pattern)
- Cross-cutting E (skip link to `#main-content`)

**Visibility-safe defaults:** Hero h1, subhead, availability strip, CTAs, and meta strip all default to `opacity: 1; transform: none`. Reveal animations only engage under `html.js-on` AND `prefers-reduced-motion: no-preference`.

**Button color contracts:**
- Primary CTA: ink on gold (5.1:1)
- Secondary CTA: gold on dark (7.4:1)
- Header CTA (smaller): gold border + gold text on dark
- All focus rings: `--focus-ring-on-dark` (gold) for outline buttons; `--focus-ring-on-gold` (ink) for primary CTA

---

## Section 2 — Pillars (sticky-stage manifesto, three pillars: Light / Pace / Patience)

**Section index:** 2
**Cinematic features owned:** #7 (sticky-stage manifesto), one Spanish phrase ("Bilingüe en cada conversación"). Optionally feature #11 (drop cap on manifesto opener) — Phase 3 default reserves the drop cap for the cinemascope feature in Section 4. Voice rule #5: one drop cap per page total.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec2.html`

**Required HTML structure (skeleton):**

```html
<section class="lf-pillars" id="pillars" aria-labelledby="pillars-heading">
  <div class="lf-pillars-grid">
    <div class="lf-pillars-stage">
      <p class="eyebrow">The Studio</p>
      <h2 class="lf-pillars-h2" id="pillars-heading">The hour, <em>built around the kids.</em></h2>
      <div class="lf-manifesto-body">
        <p>Children do not follow shot lists, and the studio does not write them. The hour is built around the kids. Their nap window. Their snack break. Their quiet five minutes after the swim. The team arrives at the resort early, walks the property, learns the light, and leaves the day intact.</p>
        <p>Editorial means the studio makes pictures that look like the family, not the trend. <em lang="es">Bilingüe en cada conversación,</em> bilingual through every conversation, from the first email to the final gallery, in English and in Spanish. Across three coastlines, at the resorts the planners trust most, the studio works in one register: quiet, considered, golden-hour first.</p>
        <p>The work is delivered the way a magazine prints a feature. First frames within seventy-two hours. The full gallery within three weeks. Nothing rushed. Nothing forgotten.</p>
        <p class="lf-attribution"><em>Vianey Díaz, who directs the studio.</em></p>
      </div>
    </div>
    <ol class="lf-pillars-list" role="list">
      <li class="lf-pillar">
        <p class="lf-pillar-numeral" aria-hidden="true">I</p>
        <h3 class="lf-pillar-name">Golden hour, <em>only.</em></h3>
        <p class="lf-pillar-body">Every family session is timed to the final ninety minutes before sunset. The studio walks the property the day before, marks the corridor where the light turns honey-soft at 5:42 in November and the terrace where it falls amber at 6:18 in March. The schedule is built backward from sunset and forward from the youngest child's nap end. The result is light that flatters every age in the frame, a horizon that never blows out, and skin tones that print the way they read on screen. The light is the schedule.</p>
      </li>
      <li class="lf-pillar">
        <p class="lf-pillar-numeral" aria-hidden="true">II</p>
        <h3 class="lf-pillar-name">Patience, <em>not a shot list.</em></h3>
        <p class="lf-pillar-body">The studio does not herd a family of ten into a stairwell, and the team does not bark "everybody smile." The pace is the pace of the family. A grandfather who needs to sit for a moment sits for a moment. A toddler who has decided the iguana on the path is more interesting than the camera is photographed watching the iguana. The shot list is built backward from the ceremony hour of the day, which for a family is dinner. Nothing is forced. Nothing is staged. The frames the family will frame are the unhurried ones.</p>
      </li>
      <li class="lf-pillar">
        <p class="lf-pillar-numeral" aria-hidden="true">III</p>
        <h3 class="lf-pillar-name">The hour, <em>around the kids.</em></h3>
        <p class="lf-pillar-body">Bilingual on the day, in English and in Spanish, with a calm voice the kids respond to. The studio works the way a good pediatrician works: low-lit, patient, never the loudest person in the room. The youngest kid's snack break is the schedule, not an interruption to the schedule. Grandparents are seated when they need to be seated, and walked when they need to be walked. The frames the family keeps are the ones that look like the family, photographed at the pace the family sets. That is the entire method, restated.</p>
      </li>
    </ol>
  </div>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-pillars` — `background: var(--ink-2); padding: var(--s-section-y) var(--s-gutter);`
- `.lf-pillars-grid` — `display: grid; grid-template-columns: 1fr 1fr; gap: var(--lf-pillar-gap); max-width: 1400px; margin: 0 auto;` Single column below 1024px.
- `.lf-pillars-stage` — desktop sticky:
  ```css
  @media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
    .lf-pillars-stage {
      position: sticky;
      top: 96px;
      align-self: start;
      height: fit-content;
    }
  }
  ```
- `.lf-pillars-h2` — `font-family: var(--font-serif); font-size: clamp(36px, 4vw, 56px); font-weight: 300; color: var(--text-on-dark);` italic via `<em>` inside.
- `.lf-manifesto-body p` — body 15px line-height 1.85 on `--text-on-dark-readable`, max-width 540px.
- `.lf-attribution` — `font-size: var(--fs-13); letter-spacing: var(--couple-name-tracking); color: var(--text-on-dark-readable); margin-top: var(--s-6);`
- `.lf-pillars-list` — flex column, gap `var(--s-12)`. Reset `list-style: none; padding: 0;`.
- `.lf-pillar` — relative, padded.
- `.lf-pillar-numeral` — `font-family: var(--font-sans); font-size: var(--fs-10); color: var(--gold); letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;`
- `.lf-pillar-name` — `font-family: var(--font-serif); font-size: clamp(22px, 2.4vw, 32px); font-weight: 300; line-height: 1.20; color: var(--text-on-dark);` italic via `<em>`.
- `.lf-pillar-body` — body 15px line-height 1.85 on `--text-on-dark-readable`, max-width 480px.

**Required JS:** None. Sticky is pure CSS; reveals are optional under `html.js-on` (reuse the cross-cutting `[data-reveal]` IntersectionObserver pattern).

**Locked microcopy:**
- Section eyebrow: `The Studio`
- H2: `The hour, built around the kids.` (italic on "built around the kids")
- Manifesto: 3 paragraphs + attribution, exactly as in copy deck §3.1
- Pillar headlines: per microcopy decisions #7, #8, #9
- Pillar bodies: as in copy deck §3.2

**A11y rules satisfied:**
- FM 11 (sticky stage gated to ≥1024px AND no-preference; first focusable element preserved)
- Cross-cutting C (h2 → h3 hierarchy, eyebrow above h2)
- Spanish phrase carries `lang="es"` on the `<em>` so SR pronounces correctly (FM 12)
- Color: gold-deep is NOT used here because background is `--ink-2`, where `--gold` passes 7.4:1.

**Visibility-safe defaults:** All paragraphs default `opacity: 1; transform: none`. Optional fade-up reveal is gated by `html.js-on` and `prefers-reduced-motion: no-preference` only.

**Button color contracts:** No CTAs in this section. The section's only interactive element is the (optional) inline anchor links inside body copy, which use `--gold` underlines on hover and inherit body color.

---

## Section 3 — Collections (3 tiers, count-up, family-tree silhouette)

**Section index:** 3
**Cinematic features owned:** #5 (animated SVG family-tree silhouette per tier — Phase 3 default: decorative `aria-hidden="true"`), tier card hover, "Most Chosen" badge on tier II.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec3.html`

**Required HTML structure (skeleton):**

```html
<section class="lf-collections" id="collections" aria-labelledby="collections-heading">
  <div class="lf-collections-header">
    <p class="eyebrow">The Investment</p>
    <h2 class="lf-collections-h2" id="collections-heading">Three collections, one <em>register.</em></h2>
    <p class="lf-collections-intro">Every collection begins with the same thing: a planning conversation, a property walk, the IVAE color register applied by hand, bilingual service from first email to final gallery. What changes is the length of the hour and the size of the family. Investment is in USD. Every collection is customizable. The studio accepts a limited number of family sessions each week so the team's attention never thins.</p>
  </div>
  <div class="lf-tier-grid">

    <article class="lf-tier" data-tier="hour">
      <p class="lf-tier-numeral" aria-hidden="true">I</p>
      <svg class="lf-tier-tree" aria-hidden="true" focusable="false" viewBox="0 0 80 40">
        <!-- 2 simple silhouette paths -->
      </svg>
      <h3 class="lf-tier-name"><em>The Hour</em></h3>
      <p class="lf-tier-lede"><em>A single golden hour, kept close.</em></p>
      <p class="lf-tier-investment-label">Investment from</p>
      <p class="lf-tier-price">$550 USD</p>
      <ul class="lf-tier-bullets" role="list">
        <li>Sixty minutes of editorial coverage, timed to golden hour</li>
        <li>One location at the resort or on a coastline within fifteen minutes</li>
        <li>Up to six in the frame, immediate family</li>
        <li>Sixty to ninety hand-edited images, delivered in three weeks</li>
        <li>First frames within seventy-two hours</li>
      </ul>
      <p class="lf-tier-differentiator"><em>A short hour, when the family is small and the trip is short.</em></p>
      <a class="btn btn-tier-cta" href="#inquiry" aria-label="Begin inquiry for The Hour collection">Begin Inquiry</a>
    </article>

    <article class="lf-tier lf-tier--featured" data-tier="afternoon">
      <span class="lf-tier-badge">Most Chosen</span>
      <p class="lf-tier-numeral" aria-hidden="true">II</p>
      <svg class="lf-tier-tree" aria-hidden="true" focusable="false" viewBox="0 0 120 40">
        <!-- 4 silhouette paths -->
      </svg>
      <h3 class="lf-tier-name"><em>The Afternoon</em></h3>
      <p class="lf-tier-lede"><em>Two locations, the family and the couple inside it.</em></p>
      <p class="lf-tier-investment-label">Investment from</p>
      <p class="lf-tier-price">$850 USD</p>
      <ul class="lf-tier-bullets" role="list">
        <li>Seventy-five minutes of editorial coverage across two locations</li>
        <li>Up to eight in the frame, immediate family plus partners or one set of grandparents</li>
        <li>Family block plus a quiet ten-minute couple block within the same hour</li>
        <li>Ninety to one hundred and thirty hand-edited images, delivered in three weeks</li>
        <li>First frames within seventy-two hours, bilingual planning call with the Director</li>
      </ul>
      <p class="lf-tier-differentiator"><em>The most chosen. The family and the couple they were before the family, in the same coastline.</em></p>
      <a class="btn btn-primary btn-tier-cta" href="#inquiry" aria-label="Begin inquiry for The Afternoon collection">Begin Inquiry</a>
    </article>

    <article class="lf-tier" data-tier="reunion">
      <p class="lf-tier-numeral" aria-hidden="true">III</p>
      <svg class="lf-tier-tree" aria-hidden="true" focusable="false" viewBox="0 0 200 40">
        <!-- 6 silhouette paths -->
      </svg>
      <h3 class="lf-tier-name"><em>The Reunion</em></h3>
      <p class="lf-tier-lede"><em>Three generations, three locations, the full archive.</em></p>
      <p class="lf-tier-investment-label">Investment from</p>
      <p class="lf-tier-price">$1,200 USD</p>
      <ul class="lf-tier-bullets" role="list">
        <li>Ninety minutes of editorial coverage across three locations</li>
        <li>Up to ten in the frame, multi-generational, milestone, or anniversary</li>
        <li>Every meaningful pairing, including the grandparent-and-grandchild frame</li>
        <li>One hundred and thirty to two hundred hand-edited images, delivered in three weeks</li>
        <li>First frames within seventy-two hours, two photographers when the timeline calls for it, bilingual planning call with the Director</li>
      </ul>
      <p class="lf-tier-differentiator"><em>For the milestone trip, when the gallery becomes the gift.</em></p>
      <a class="btn btn-tier-cta" href="#inquiry" aria-label="Begin inquiry for The Reunion collection">Begin Inquiry</a>
    </article>

  </div>
  <p class="lf-collections-footnote"><em>Every collection is customizable. The studio accepts a limited number of family sessions each week.</em></p>
  <div class="lf-collections-countup" aria-label="Five hundred plus families since 2019">
    <span class="lf-countup-num" data-count-to="500" aria-hidden="true">0</span><span aria-hidden="true">+</span>
    <span class="lf-countup-label">Families since 2019</span>
  </div>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-collections` — `background: var(--cream-1); color: var(--text-on-light); padding: var(--s-section-y) var(--s-gutter);`
- `.lf-collections-h2` — serif 300, `clamp(36px, 4vw, 56px)`, italic on "register."
- `.lf-tier-grid` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--inv-tier-gap);` 1-col at <900px.
- `.lf-tier` — `padding: var(--lf-tier-padding); border-top: var(--inv-tier-rule); position: relative; background: transparent;`
- `.lf-tier--featured` — `border-top: var(--inv-tier-rule-featured);` (2px solid `--gold`).
- `.lf-tier-badge` — top-right, `font-size: var(--fs-10); color: var(--gold-deep); letter-spacing: var(--couple-name-tracking); text-transform: uppercase;`
- `.lf-tier-numeral` — sans 10px gold-deep eyebrow tracking.
- `.lf-tier-tree` — width per tier (2 fig narrow, 6 fig wide). Stroke `var(--lf-tree-stroke)` (1.2px) `var(--lf-tree-stroke-color)` (gold-line). On `.lf-tier:hover .lf-tier-tree path` (motion-OK) the silhouette draws via `stroke-dasharray` over `var(--lf-tree-anim-duration)` (1.6s).
- `.lf-tier-name` — serif italic.
- `.lf-tier-price` — sans 24px weight 300 ink-1.
- `.lf-tier-bullets li` — relative padding-left 16px, `::before` 1px gold leader rule 8px wide at left.
- `.btn-tier-cta` — `min-height: 44px; min-width: 200px; padding: 0 var(--s-6); font-size: var(--fs-13); letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase; display: inline-flex; align-items: center; justify-content: center;`
- Tiers I and III: outline button (gold border + gold-deep text on cream). Tier II: gold-fill button (ink on gold).

**Required JS:** Reuse count-up gating from Section 1; no additional JS needed.

**Locked microcopy:**
- Section eyebrow: `The Investment`
- H2: `Three collections, one register.` (italic on "register")
- Intro: as in copy deck §5
- Tier names, ledes, prices, bullets, differentiators: as in copy deck §5.1, §5.2, §5.3
- Footnote: `Every collection is customizable. The studio accepts a limited number of family sessions each week.`
- Count-up: `500+ Families since 2019`

**A11y rules satisfied:**
- FM 7 (family-tree SVG decorative `aria-hidden="true"`; group size redundant in bullets)
- FM 8 (count-up `aria-hidden` digit; parent `aria-label` carries final value)
- FM 12 (each tier CTA has unique `aria-label` for SR)
- Cross-cutting D (gold-deep on cream for sub-18px elements; gold restricted to ≥18px on cream sections)

**Visibility-safe defaults:** All tier content visible by default. Tree silhouette static at full opacity. Hover stroke-draw is enhancement only.

**Button color contracts:**
- Tier I and III CTAs (outline on cream): gold border + gold-deep text (4.6:1)
- Tier II CTA (filled): ink on gold (5.1:1)
- Focus rings: `--focus-ring-on-light` (ink ring) for outline; `--focus-ring-on-gold` (ink ring) for filled

---

## Section 4 — Featured story (cinemascope feature, drop cap caption, family-tree growing 2→6→10)

**Section index:** 4
**Cinematic features owned:** #10 (cinemascope 21:9 letterbox), #11 (drop cap on caption — the page's only drop cap, per voice rule #5), the family-tree-growing graphic (animated 2 → 6 → 10 figures across the section as a horizontal SVG ribbon below the cinemascope).

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec4.html`

**Required HTML structure (skeleton):**

```html
<section class="lf-feature" id="feature" aria-labelledby="feature-heading">
  <p class="eyebrow">A Reunion</p>
  <h2 class="lf-feature-h2" id="feature-heading">Three generations, two languages, <em>one coastline.</em></h2>
  <figure class="lf-cinema">
    <div class="lf-cinema-frame">
      <img src="/images/family-riviera-maya-ivae-studios.jpg"
           alt="A grandfather lifts his grandson against the late-afternoon mangroves at Rosewood Mayakoba, photographed by IVAE Studios."
           loading="lazy" decoding="async" width="2400" height="1029">
    </div>
  </figure>
  <div class="lf-feature-body">
    <p class="lf-feature-caption">The reunion was set for the second week of April, on a private cay at Rosewood Mayakoba, with the lagoon at its back and the canopy of the Yucatán to the west. Three generations had flown in from Dallas, Mexico City, and London. Eight grandchildren, ages four through fourteen. The grandparents arrived two days early, the way grandparents do, and walked the boardwalks at the property's edge while the herons stood still long enough to be photographed.</p>
    <p>The session was ninety minutes long. The light turned honest at 6:18, and the studio met the family on a stretch of beach where a single palmera leaned the way the children later leaned into their grandfather. The youngest grandchild was three, and the studio worked at her pace. She watched a small crab for forty seconds. Her grandfather watched her watch the crab. The frame the family had quietly hoped for, three generations together, looking the same direction at the same small thing, was made in those forty seconds.</p>
    <p>The team carried one bottle of water and two cameras. Spanish for the grandparents, English for the cousins from London, both for the parents. No herding. No counting to three. The reunion lasted the planned ninety minutes and used eighty-two of them for photographs and eight for a snack break the studio had built into the schedule.</p>
    <p>The first frames were delivered seventy-one hours later. The grandparents framed two of them. The full gallery, four hundred and twelve images, traveled to a private link nineteen days after the session.</p>
    <dl class="lf-feature-meta" role="group" aria-label="Reunion details">
      <div><dt>Coast</dt><dd>Riviera Maya</dd></div>
      <div><dt>Family Size</dt><dd>Eight grandchildren, three generations</dd></div>
      <div><dt>Coverage</dt><dd>Ninety minutes, golden hour</dd></div>
    </dl>
  </div>
  <svg class="lf-tree-grow" aria-hidden="true" focusable="false" viewBox="0 0 800 60">
    <!-- 10 silhouette figures, growing left-to-right; stroke-dasharray engages on scroll-into-view (motion-OK) -->
  </svg>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-feature` — `background: var(--ink-3); padding: var(--s-section-y) 0;` (full-bleed cinemascope; padding only on the body and meta)
- `.lf-feature-h2` — serif 300, `clamp(36px, 4vw, 56px)`, color `--text-on-dark`, italic on "one coastline." Padding `0 var(--s-gutter)`.
- `.lf-cinema` — `aspect-ratio: 21/9; position: relative; overflow: hidden; margin: var(--s-12) 0;`
- `.lf-cinema-frame::before` and `::after` — top and bottom letterbox bars at `var(--lf-letterbox)` (8%), `background: var(--ink-4);` with a `--gold-line` 1px hairline rule between bar and image.
- `.lf-cinema img` — full-bleed object-fit cover.
- `.lf-feature-body` — max-width 720px, margin 0 auto, padding `0 var(--s-gutter)`.
- `.lf-feature-caption` — body 15px line-height 1.85 on `--text-on-dark-readable`. The drop cap:
  ```css
  .lf-feature-caption::first-letter {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 300;
    font-size: var(--lf-dropcap-size); /* clamp(58px, 6.5vw, 78px) */
    color: var(--gold);
    float: left;
    line-height: 0.86;
    padding: 4px 12px 0 0;
  }
  ```
- `.lf-feature-meta` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-6); margin-top: var(--s-10); padding-top: var(--s-6); border-top: 1px solid var(--gold-line);`
- `.lf-feature-meta dt` — `font-family: var(--font-sans); font-size: var(--fs-10); color: var(--gold); letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;`
- `.lf-feature-meta dd` — body, `color: var(--text-on-dark-readable);`
- `.lf-tree-grow` — full-width below the body, opacity 0.5, gold strokes. On scroll-into-view (motion-OK), 10 figures stroke-draw left-to-right with a 120ms stagger via JS or CSS keyframes.

**Required JS (optional, for the tree-grow stroke-draw):**

```js
const treeGrowObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting && document.documentElement.classList.contains('js-on')) {
      e.target.classList.add('lf-tree-grow--visible');
      treeGrowObs.unobserve(e.target);
    }
  });
}, { threshold: 0.4 });
document.querySelectorAll('.lf-tree-grow').forEach(el => treeGrowObs.observe(el));
```

CSS handles the actual draw via `stroke-dasharray` transitions on the `.lf-tree-grow--visible path` selector.

**Locked microcopy:**
- Section eyebrow: `A Reunion`
- H2: `Three generations, two languages, one coastline.` (italic on "one coastline")
- Caption body: 4 paragraphs, exactly as in copy deck §4.1
- Meta cells: `Coast / Riviera Maya`, `Family Size / Eight grandchildren, three generations`, `Coverage / Ninety minutes, golden hour`

**A11y rules satisfied:**
- FM 10 (drop cap via `::first-letter`, no markup pollution; reading order preserved)
- FM 7 (tree-grow SVG decorative, `aria-hidden`)
- Cross-cutting C (h2 with italic emphasis, eyebrow above)
- Cinemascope letterboxing is decorative; the image alt carries the meaningful content

**Visibility-safe defaults:** All caption paragraphs default `opacity: 1`. Cinemascope letterbox is CSS only. Tree-grow defaults to fully drawn (no JS). The stroke-dash animation is enhancement.

**Button color contracts:** No CTAs in this section.

---

## Section 5 — Method (5 steps, color-palette-by-month widget under Style step, sunset-friendly window deep-link to Section 6)

**Section index:** 5
**Cinematic features owned:** Color-palette-by-month widget (12 chips, embedded under Step 02 Style). The Sunset-friendly-time widget is its own section (Section 6); this section deep-links via Step 03.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec5.html`

**Required HTML structure (skeleton):**

```html
<section class="lf-method" id="method" aria-labelledby="method-heading">
  <div class="lf-method-header">
    <p class="eyebrow">The Method</p>
    <h2 class="lf-method-h2" id="method-heading">Five considered steps, <em>plan to delivery.</em></h2>
    <p class="lf-method-intro">The studio works the same way for every family, regardless of size. The first inquiry is read the same business day. A planning conversation follows within the week. The wardrobe is calibrated to the month and the coastline. The light is built backward from sunset, the pace built around the kids. The first frames travel home before the suitcase has been unpacked.</p>
  </div>
  <ol class="lf-method-rail" role="list">

    <li class="lf-step" id="step-plan">
      <p class="lf-step-tag">01 · Plan</p>
      <h3 class="lf-step-name">Plan</h3>
      <p class="lf-step-body">The first email is read the same business day, in English or Spanish. A short planning call follows within the week, forty-five minutes, on video. The studio listens first, asks about the kids, asks about the milestone if there is one, asks about the resort. By the end of the call, the family knows whether the studio is right for them, and the studio knows the shape of the hour.</p>
    </li>

    <li class="lf-step" id="step-style">
      <p class="lf-step-tag">02 · Style</p>
      <h3 class="lf-step-name">Style</h3>
      <p class="lf-step-body">A wardrobe guide travels the day after booking. The guide is calibrated to the month, the coastline, and the kids' ages. Tones, not outfits. Linen, ivory, sand, sage, dusty terracotta. The youngest child's outfit is built around what the youngest child will already wear without protest. Nothing is bought new for the session unless the family wants it bought new for the session.</p>
      <div class="lf-month-palette" role="group" aria-label="Wardrobe color palette by month">
        <button type="button" class="lf-month-chip" aria-pressed="false" data-month="01">
          <span class="lf-month-chip-name">January</span>
          <span class="lf-month-chip-swatches" aria-hidden="true">
            <span style="background:#faf6ee"></span>
            <span style="background:#d8c8a8"></span>
            <span style="background:#8fa8b4"></span>
          </span>
          <span class="visually-hidden">Ivory, sand, dusty blue.</span>
        </button>
        <!-- 11 more month chips: Feb–Dec, each with a 3-swatch palette and a hidden tone-words span -->
      </div>
    </li>

    <li class="lf-step" id="step-light">
      <p class="lf-step-tag">03 · Light</p>
      <h3 class="lf-step-name">Light</h3>
      <p class="lf-step-body">The session is timed to the final ninety minutes before sunset, ended fifteen minutes before the horizon turns. In December that is 4:00 to 5:30 in Cancún. In June that is 6:00 to 7:30. The studio walks the property the day before when travel allows, and marks the two or three locations where the light is most flattering. The schedule is built backward from sunset and forward from the youngest kid's nap end. <a href="#sunset" class="lf-step-deeplink">See the Sunset-Friendly Time widget below.</a></p>
    </li>

    <li class="lf-step" id="step-direct">
      <p class="lf-step-tag">04 · Direct</p>
      <h3 class="lf-step-name">Direct</h3>
      <p class="lf-step-body">On the day, the studio arrives ten minutes early and meets the family at the meeting point. Direction is calm and quiet. The studio does not count to three. Snack breaks are built into the hour. Spanish for the grandparents who prefer Spanish. English for the cousins flying in. The pace is the pace of the family.</p>
    </li>

    <li class="lf-step" id="step-deliver">
      <p class="lf-step-tag">05 · Deliver</p>
      <h3 class="lf-step-name">Deliver</h3>
      <p class="lf-step-body">First frames travel home with the family. Twenty to thirty editorial images arrive within seventy-two hours, before the suit has been pressed and before the suitcase has been unpacked. The full gallery, ninety to two hundred hand-edited images depending on the collection, follows within three weeks. Print release rights are included. The gallery lives on a private link with unlimited downloads.</p>
    </li>

  </ol>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-method` — `background: var(--ink-2); padding: var(--s-section-y) var(--s-gutter);`
- `.lf-method-rail` — `max-width: 920px; margin: 0 auto; border-left: 1px solid var(--gold-line); padding-left: var(--s-8); list-style: none;`
- `.lf-step` — `padding: var(--s-10) 0; position: relative;`
- `.lf-step::before` — gold dot at `left: -5px; top: var(--s-10);` (timeline node).
- `.lf-step-tag` — `font-family: var(--font-sans); font-size: var(--fs-10); color: var(--gold); letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;`
- `.lf-step-name` — serif 300, `clamp(22px, 2.4vw, 32px)`, color `--text-on-dark`.
- `.lf-step-body` — body 15 line-height 1.85 on `--text-on-dark-readable`, max-width 640px.
- `.lf-step-deeplink` — gold underline link.
- `.lf-month-palette` — flex row wrap, `gap: var(--lf-month-chip-gap);` (12px). Margin-top `var(--s-6)`.
- `.lf-month-chip` — `min-width: var(--lf-month-chip-size);` (56px), padding `var(--s-2)`, background transparent, border 1px `--gold-line`, cursor pointer. `min-height: 44px` for touch target.
- `.lf-month-chip[aria-pressed="true"]` — gold border, slight gold-soft fill.
- `.lf-month-chip-swatches` — flex row of three 12px squares.
- `.visually-hidden` — sr-only utility.

**Required JS:**

```js
document.querySelectorAll('.lf-month-chip').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.lf-month-chip').forEach(b => b.setAttribute('aria-pressed', 'false'));
    e.currentTarget.setAttribute('aria-pressed', 'true');
  });
});
```

**Locked microcopy:**
- Section eyebrow: `The Method`
- H2: `Five considered steps, plan to delivery.` (italic on "plan to delivery")
- Intro: as in copy deck §6
- Steps 01-05: as in copy deck §6 (Plan / Style / Light / Direct / Deliver)
- Month chip names: January through December, with hidden tone-words per Phase 1 §3 Skill 4 token semantics

**A11y rules satisfied:**
- FM 12 (color-palette-by-month chips have visible labels AND hidden tone-words; `aria-pressed` on selection)
- Cross-cutting C (h2 → h3 hierarchy, ordered list of steps)
- Touch target `min-height: 44px` on chips

**Visibility-safe defaults:** All steps visible. Color chips visible by default. Selection state via `aria-pressed` only.

**Button color contracts:** Month chips use gold border on cream-on-ink section (`--gold` border on `--ink-2`, 7.4:1 contrast for the border color). Hover/pressed states use gold-soft fill at 0.18 alpha.

---

## Section 6 — Sunset-Friendly Time widget (the page's signature feature)

**Section index:** 6
**Cinematic features owned:** #9 (Sunset-Friendly-Time widget — the family page's signature feature). 12 month buttons + SVG clock with golden-hour ring + post-nap kid-friendly band.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec6.html`

**Required HTML structure (skeleton):**

```html
<section class="lf-sunset" id="sunset" aria-labelledby="sunset-heading">
  <p class="eyebrow">Light, Around the Kids</p>
  <h2 class="lf-sunset-h2" id="sunset-heading">Sunset-Friendly Time.</h2>
  <p class="lf-sunset-intro">Pick the month. The ring shows when the light turns honest. The studio ends family sessions ninety minutes before that, and starts ninety minutes after the youngest kid wakes up.</p>

  <div class="lf-sunset-stage">
    <div class="lf-month-picker" role="group" aria-label="Select month">
      <button type="button" class="lf-sunset-month" aria-pressed="false" data-month="01" data-golden-start="16:00" data-golden-end="17:30" data-recommended="16:00">Jan</button>
      <button type="button" class="lf-sunset-month" aria-pressed="false" data-month="02" data-golden-start="16:30" data-golden-end="18:00" data-recommended="16:30">Feb</button>
      <!-- Mar through Dec, each with golden-hour times calibrated to Cancún sunset -->
    </div>

    <div class="lf-clock-wrap">
      <svg class="lf-clock"
           role="img"
           aria-labelledby="lf-clock-label"
           viewBox="0 0 240 240"
           width="var(--lf-clock-size)"
           height="var(--lf-clock-size)">
        <title id="lf-clock-label">Golden hour for January in Cancún begins at 4:00 PM and ends at 5:30 PM. Recommended session start: 4:00 PM. Post-nap kid-friendly window: 3:30 PM and after.</title>
        <circle cx="120" cy="120" r="100" fill="none" stroke="var(--ink-3)" stroke-width="1"/>
        <!-- nap-friendly band: translucent arc -->
        <path class="lf-clock-nap-band" d="..." fill="var(--lf-clock-window-band)" stroke="none"/>
        <!-- golden-hour ring -->
        <path class="lf-clock-golden-ring" d="..." fill="none" stroke="var(--lf-clock-golden-band)" stroke-width="3"/>
        <!-- hour ticks -->
        <g class="lf-clock-ticks" stroke="var(--gold-line)" stroke-width="1"><!-- 12 ticks --></g>
      </svg>
    </div>
  </div>

  <p class="lf-clock-status" aria-live="polite" aria-atomic="true">January selected. Golden hour 4:00 to 5:30 PM. Recommended start 4:00 PM.</p>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-sunset` — `background: var(--ink-3); padding: var(--s-section-y) var(--s-gutter); text-align: center;`
- `.lf-sunset-h2` — serif 300, `clamp(36px, 4vw, 56px)`, color `--text-on-dark`.
- `.lf-sunset-intro` — body 15 line-height 1.85, `color: var(--text-on-dark-readable)`, max-width 640px, margin 0 auto.
- `.lf-sunset-stage` — `display: grid; grid-template-columns: 1fr; gap: var(--s-8);` Single-col stack on all sizes for clarity.
- `.lf-month-picker` — flex row wrap centered, gap 8px.
- `.lf-sunset-month` — `min-width: 56px; min-height: 44px; padding: 8px 12px; background: transparent; border: 1px solid var(--gold-line); color: var(--gold); font-family: var(--font-sans); font-size: var(--fs-10); letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase; cursor: pointer; transition: background var(--t-quick), border-color var(--t-quick);`
- `.lf-sunset-month[aria-pressed="true"]` — `background: var(--gold-soft); border-color: var(--gold); color: var(--gold);`
- `.lf-clock-wrap` — flex centered.
- `.lf-clock` — `width: var(--lf-clock-size);` (clamp 220-300px).
- `.lf-clock-nap-band` — fill `var(--lf-clock-window-band)`.
- `.lf-clock-golden-ring` — stroke `var(--lf-clock-golden-band)` (`--gold`).
- `.lf-clock-status` — body 15 italic, color `--text-on-dark-readable`, max-width 640px, margin 0 auto.

**Required JS:**

```js
const monthData = {
  '01': { start: '4:00 PM', end: '5:30 PM', recommended: '4:00 PM', month: 'January' },
  '02': { start: '4:30 PM', end: '6:00 PM', recommended: '4:30 PM', month: 'February' },
  // 12 months total
};

const status = document.querySelector('.lf-clock-status');
const titleEl = document.getElementById('lf-clock-label');
const goldenRing = document.querySelector('.lf-clock-golden-ring');

document.querySelectorAll('.lf-sunset-month').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.lf-sunset-month').forEach(b => b.setAttribute('aria-pressed', 'false'));
    e.currentTarget.setAttribute('aria-pressed', 'true');

    const m = e.currentTarget.dataset.month;
    const d = monthData[m];
    const text = `${d.month} selected. Golden hour ${d.start} to ${d.end}. Recommended start ${d.recommended}.`;
    status.textContent = text;
    titleEl.textContent = `Golden hour for ${d.month} in Cancún begins at ${d.start} and ends at ${d.end}. Recommended session start: ${d.recommended}. Post-nap kid-friendly window: 3:30 PM and after.`;

    // Update golden ring arc rotation based on time-to-angle math (12-hour SVG clock):
    // each hour = 30°. Start angle = (startHour - 12) * 30 + minutes * 0.5.
    // (Implementation detail per Phase 4 build; the d-attribute or transform rotates accordingly.)
  });
});
```

**Locked microcopy:**
- Section eyebrow: `Light, Around the Kids` (or omit; the section h2 carries the meaning)
- H2: `Sunset-Friendly Time.`
- Intro: per microcopy decision #14, exactly as in copy deck
- Month buttons: `Jan` `Feb` `Mar` `Apr` `May` `Jun` `Jul` `Aug` `Sep` `Oct` `Nov` `Dec` (3-letter abbreviations)
- Live region: pattern `[Month] selected. Golden hour [start] to [end]. Recommended start [recommended].`

**A11y rules satisfied:**
- FM 3 (month buttons `aria-pressed`, SVG `role="img"` with `aria-labelledby`, live region announces changes)
- Touch target `min-height: 44px` on chips
- Color-not-the-only-differentiator: each month is labeled with text; the SVG carries a descriptive title

**Visibility-safe defaults:** Default state shows January. Without JS, the clock SVG is fully visible and the static title element provides the meaning. JS layers interactivity.

**Button color contracts:**
- Month buttons: gold border + gold text on ink (7.4:1)
- Pressed state: gold-soft fill + gold text + gold border (still 7.4:1 on the ink-3 backdrop)
- Focus rings: `--focus-ring-on-dark`

---

## Section 7 — Voices (pull-quote with 320px Cormorant ❝) + 6 testimonials grid + frames reel + ages-best ribbon

**Section index:** 7
**Cinematic features owned:** #12 (pull-quote with massive Cormorant `❝`), #8 (drag-scroll reel), #13 (ages-best-photographed-at ribbon — bonus), the testimonial grid.

This section is the largest single section. Phase 3 may split into three subsections inside one fragment if preferred.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec7.html`

**Required HTML structure (skeleton):**

```html
<!-- 7a — Pull-quote -->
<section class="lf-voices" id="voices" aria-labelledby="voices-heading">
  <h2 id="voices-heading" class="visually-hidden">Voices</h2>
  <figure class="lf-pullquote">
    <span class="lf-pullquote-ornament" aria-hidden="true">&ldquo;</span>
    <blockquote class="lf-pullquote-body">
      <p><em>The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery, and we cried with her. The studio worked at the kids' pace, and the frames look like our family, not like a photo session.</em></p>
    </blockquote>
    <figcaption>
      <cite class="lf-pullquote-cite">The Nakamura Family  ·  Rosewood Mayakoba, April 2026</cite>
    </figcaption>
  </figure>
</section>

<!-- 7b — Testimonials grid -->
<section class="lf-testimonials" id="testimonials" aria-labelledby="testimonials-heading">
  <h2 id="testimonials-heading" class="visually-hidden">Testimonials</h2>
  <div class="lf-testimonial-grid">
    <!-- 6 testimonial cards, each with blockquote + cite. Bodies as in copy deck §8. -->
    <figure class="lf-testimonial-card">
      <blockquote><p><em>Three generations, eight grandchildren, ninety minutes...</em></p></blockquote>
      <figcaption><cite>The Hartwell Family  ·  Dallas, Texas</cite></figcaption>
    </figure>
    <!-- 5 more cards: Sarah & Michael, The Patel, The Nakamura, The Beauchamp, Familia López -->
  </div>
</section>

<!-- 7c — Ages ribbon + Frames reel -->
<section class="lf-frames" id="frames" aria-labelledby="frames-heading">
  <h2 id="frames-heading" class="visually-hidden">The Frames</h2>
  <div class="lf-ages-ribbon" role="img" aria-label="Every age in the frame: newborn, toddler, school-age, teen.">
    <div class="lf-ages-bar" aria-hidden="true"></div>
    <div class="lf-ages-labels" aria-hidden="true">
      <span>Newborn</span>
      <span>Toddler</span>
      <span>School-age</span>
      <span>Teen</span>
    </div>
  </div>
  <p class="lf-reel-hint">Drag to scroll the reel</p>
  <div class="lf-reel-track" role="region" aria-label="Family photography reel, scrollable. Use arrow keys to navigate." tabindex="0">
    <figure class="lf-reel-frame">
      <img src="/images/family-cancun-hotel-zone-ivae-studios-2.jpg"
           alt="A toddler runs along the wet sand at sunset in Cancún, photographed by IVAE Studios."
           loading="lazy" decoding="async">
      <figcaption class="lf-reel-caption" aria-hidden="true">Frame i. / vi.</figcaption>
    </figure>
    <!-- 5–7 more frames -->
  </div>
</section>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-voices` — `background: var(--ink-4); padding: var(--s-section-y) var(--s-gutter); text-align: center; position: relative;`
- `.lf-pullquote` — `max-width: 920px; margin: 0 auto; position: relative;`
- `.lf-pullquote-ornament` — `position: absolute; top: -40px; left: 50%; transform: translateX(-50%); font-family: var(--font-serif); font-size: clamp(180px, 22vw, 320px); font-weight: 300; font-style: italic; color: var(--gold); opacity: 0.18; pointer-events: none; user-select: none; z-index: 0;`
- `.lf-pullquote-body p` — serif 300 italic, `clamp(22px, 2.6vw, 38px)`, line-height 1.30, color `--text-on-dark-readable`, position relative, z-index 1.
- `.lf-pullquote-cite` — sans 13, letter-spacing `--couple-name-tracking`, color `--text-on-dark-readable`, font-style normal.
- `.lf-testimonials` — `background: var(--ink-3); padding: var(--s-section-y) var(--s-gutter);`
- `.lf-testimonial-grid` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-10);` 1-col below 768px.
- `.lf-testimonial-card` — `padding: var(--s-8) var(--s-6); border-top: 1px solid var(--gold-line);`
- `.lf-frames` — `background: var(--ink-3); padding: var(--s-section-y) 0;` (full-bleed reel; padding only on the ribbon and hint)
- `.lf-ages-ribbon` — max-width 1100px, margin 0 auto var(--s-8), padding `0 var(--s-gutter)`.
- `.lf-ages-bar` — `height: var(--lf-age-ribbon-h);` (6px), `background: linear-gradient(90deg, var(--lf-age-ribbon-stop-newborn) 0%, var(--lf-age-ribbon-stop-toddler) 33%, var(--lf-age-ribbon-stop-school) 66%, var(--lf-age-ribbon-stop-teen) 100%); border-radius: 3px;`
- `.lf-ages-labels` — flex row space-between, font 10 sans gold-deep eyebrow tracking.
- `.lf-reel-hint` — sans 13 italic, color `--text-on-dark-readable`, padding `0 var(--s-gutter)`, margin-bottom `var(--s-4)`.
- `.lf-reel-track` — `display: flex; gap: var(--s-2); overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 var(--s-gutter);`
- `.lf-reel-track:focus-visible` — `outline: var(--focus-ring-on-dark); outline-offset: 4px;`
- `.lf-reel-frame` — `flex: 0 0 var(--lf-reel-frame-min-width); aspect-ratio: var(--lf-reel-card-aspect); scroll-snap-align: start; position: relative; overflow: hidden;`
- `.lf-reel-frame img` — full inset, object-fit cover.

**Required JS:**

```js
// Reel keyboard support
document.querySelectorAll('.lf-reel-track').forEach((track) => {
  track.addEventListener('keydown', (e) => {
    const frame = track.querySelector('.lf-reel-frame');
    if (!frame) return;
    const stride = frame.offsetWidth + parseFloat(getComputedStyle(track).gap || 0);
    if (e.key === 'ArrowRight') { track.scrollBy({ left: stride, behavior: 'smooth' }); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { track.scrollBy({ left: -stride, behavior: 'smooth' }); e.preventDefault(); }
  });
});
```

**Locked microcopy:**
- Pull-quote body: as in copy deck §7.1
- Pull-quote attribution: `The Nakamura Family · Rosewood Mayakoba, April 2026`
- 6 testimonials: as in copy deck §8
- Reel hint: `Drag to scroll the reel`
- Frame caption fallback: `Frame i. / vi.`
- Ages ribbon labels: `Newborn` `Toddler` `School-age` `Teen`

**A11y rules satisfied:**
- FM 9 (pull-quote ornament `aria-hidden`; blockquote + cite semantics)
- FM 2 (reel track keyboard support, focus ring, ArrowLeft/Right scrolling)
- FM 13 (ages ribbon as `role="img"` with `aria-label` carrying the meaning; gradient bar is decorative)
- Cross-cutting C (h2 visually-hidden for sections without visible title)

**Visibility-safe defaults:** All testimonial cards visible. Pull-quote ornament `aria-hidden`, full opacity styling. Reel scrolls natively without JS.

**Button color contracts:** No CTAs in this section. All text passes 4.5:1 on ink-3 / ink-4 backgrounds.

---

## Section 8 — FAQ + Inquiry CTA + Footer

**Section index:** 8
**Cinematic features owned:** FAQ accordion (proper button/aria-expanded pattern), inquiry block with two CTAs, full footer colophon.

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec8.html`

**Required HTML structure (skeleton):**

```html
<!-- 8a — FAQ -->
<section class="lf-faq" id="faq" aria-labelledby="faq-heading">
  <p class="eyebrow">Considered Questions</p>
  <h2 class="lf-faq-h2" id="faq-heading">Considered, Before You Ask.</h2>
  <ul class="lf-faq-list" role="list">
    <li class="lf-faq-item">
      <h3 class="lf-faq-question-wrap">
        <button class="lf-faq-toggle" type="button" id="faq-1-question" aria-expanded="false" aria-controls="faq-1-panel">
          How do you photograph toddlers and small children without losing the frame?
          <span class="lf-faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="lf-faq-panel" id="faq-1-panel" role="region" aria-labelledby="faq-1-question" hidden>
        <p>The pace of the session is the pace of the youngest child. The studio does not count to three, does not herd, and does not bark "everybody smile." If a four-year-old is interested in a small crab on the path, she is photographed watching the small crab. If a two-year-old needs forty seconds to decide whether the camera is friend or stranger, she is given forty seconds. The frames the family keeps are made in those quiet moments, not in the staged ones. The studio is patient and bilingual, and the kids respond to that.</p>
      </div>
    </li>
    <!-- 9 more FAQ items: golden hour, group sizes, weather, wardrobe, delivery, payment, cancellation, multiple locations, language -->
  </ul>
</section>

<!-- 8b — Inquiry CTA -->
<section class="lf-inquiry" id="inquiry" aria-labelledby="inquiry-heading">
  <p class="eyebrow">Begin</p>
  <h2 class="lf-inquiry-h2" id="inquiry-heading">Tell Us About the Family.</h2>
  <p class="lf-inquiry-body">Share the dates, the resort, the ages of the kids, and a sentence about the milestone if there is one. The studio responds the same business day, in English or Spanish, with one or two questions and a calendar link. The first reply will come from the Director. If the family would rather speak first, the WhatsApp button below is the fastest way to reach the studio.</p>
  <div class="lf-inquiry-ctas">
    <a class="btn btn-primary" href="mailto:info@ivaestudios.com?subject=Family%20session%20inquiry" data-magnet>Begin Inquiry</a>
    <a class="btn btn-ghost" href="https://wa.me/529902046514?text=Hello%2C%20I%27d%20like%20to%20book%20a%20family%20photo%20session.%20Please%20send%20a%20calendar%20invite." target="_blank" rel="noopener">Send a Calendar Invite</a>
  </div>
  <dl class="lf-inquiry-meta" role="group" aria-label="Studio response details">
    <div><dt>Response Time</dt><dd>Same business day</dd></div>
    <div><dt>Languages</dt><dd>English / Spanish</dd></div>
    <div><dt>Hours</dt><dd>06:00 – 20:00 GMT-5</dd></div>
  </dl>
</section>

<!-- 8c — Footer -->
<footer class="lf-footer" role="contentinfo">
  <div class="lf-footer-brand">
    <span class="lf-footer-mark">IVAE Studios</span>
    <p class="lf-footer-tag">Luxury Resort Photography. Editorial. Bilingual. Golden hour, only.</p>
  </div>
  <nav class="lf-footer-nav" aria-label="Footer navigation">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/blog">Journal</a>
    <a href="/cancun-photographer">Cancún</a>
    <a href="/riviera-maya-photographer">Riviera Maya</a>
    <a href="/cabo-photographer">Los Cabos</a>
    <a href="/destination-wedding-photographer-mexico">Weddings</a>
    <a href="/luxury-family-photos-cancun" aria-current="page">Families</a>
    <a href="/couples-photography-mexico">Couples</a>
    <a href="https://instagram.com/ivaestudios.cancun" target="_blank" rel="noopener">Instagram</a>
  </nav>
  <p class="lf-footer-contact">Cancún · Riviera Maya · Los Cabos  ·  info@ivaestudios.com  ·  English / Español</p>
  <p class="lf-footer-copy">&copy; 2026 IVAE Studios  ·  Luxury Resort Photographer  ·  Cancún, Mexico</p>
</footer>
```

**Required CSS classes (with `--lf-*` tokens):**

- `.lf-faq` — `background: var(--ink-3); padding: var(--s-section-y) var(--s-gutter); max-width: 880px; margin: 0 auto;`
- `.lf-faq-h2` — serif 300, `clamp(36px, 4vw, 56px)`, color `--text-on-dark`.
- `.lf-faq-list` — `list-style: none; padding: 0;`
- `.lf-faq-item` — `border-bottom: 1px solid var(--gold-line);`
- `.lf-faq-toggle` — `width: 100%; padding: var(--s-4) 0; background: transparent; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: var(--s-4); font-family: var(--font-serif); font-size: var(--fs-18); color: var(--text-on-dark); min-height: 44px;`
- `.lf-faq-toggle:focus-visible` — `outline: var(--focus-ring-on-dark); outline-offset: 4px;`
- `.lf-faq-icon` — `font-family: var(--font-sans); font-size: var(--fs-24); color: var(--gold); transition: transform 0.35s var(--ease);`
- `.lf-faq-toggle[aria-expanded="true"] .lf-faq-icon` — `transform: rotate(45deg);`
- `.lf-faq-panel` — `padding: 0 0 var(--s-6) 0;`
- `.lf-faq-panel[hidden]` — `display: none;`
- `.lf-faq-panel p` — body 15 line-height 1.85 on `--text-on-dark-readable`.
- `.lf-inquiry` — `background: var(--ink-4); padding: var(--s-section-y) var(--s-gutter); text-align: center;`
- `.lf-inquiry-h2` — serif 300, `clamp(36px, 4vw, 56px)`.
- `.lf-inquiry-body` — body 15 line-height 1.85, max-width 720px, margin 0 auto.
- `.lf-inquiry-ctas` — flex row centered, gap `var(--s-4)`, margin `var(--s-8) 0`. Wrap below 480px.
- `.lf-inquiry-meta` — flex row centered, gap `var(--s-8)`, font 13 sans, color `--text-on-dark-readable`. Each `<div>` is a flex column with hairline border between dt and dd.
- `.lf-inquiry-meta dt` — sans 10 gold eyebrow tracking uppercase.
- `.lf-inquiry-meta dd` — body 13.
- `.lf-footer` — `background: var(--ink-4); padding: var(--s-section-y) var(--s-gutter); text-align: center; border-top: 1px solid var(--gold-line);`
- `.lf-footer-mark` — sans 600, letter-spacing 0.3em uppercase, color `--cream-1`.
- `.lf-footer-tag` — body 13 italic, color `--text-on-dark-readable`, max-width 720px, margin 0 auto.
- `.lf-footer-nav` — flex wrap centered, gap `var(--s-4)` `var(--s-6)`. Each `a` font 12 sans, gold-deep, no underline default; underline on hover.
- `.lf-footer-nav a[aria-current="page"]` — color `--gold`.
- `.lf-footer-contact`, `.lf-footer-copy` — body 12, color `--text-on-dark-readable` alpha decreased on copy.

**Required JS:**

```js
// FAQ accordion with proper aria-expanded toggle
document.querySelectorAll('.lf-faq-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const panelId = btn.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    btn.setAttribute('aria-expanded', String(!expanded));
    if (expanded) {
      panel.setAttribute('hidden', '');
    } else {
      panel.removeAttribute('hidden');
    }
  });
});
```

**Locked microcopy:**
- FAQ section eyebrow: `Considered Questions`
- FAQ h2: `Considered, Before You Ask.`
- 10 FAQ Q&A: as in copy deck §9 (kid behavior, golden hour, group sizes, weather, wardrobe, delivery, payment, cancellation, multiple locations, language)
- Inquiry eyebrow: `Begin`
- Inquiry h2: `Tell Us About the Family.`
- Inquiry body: as in copy deck §10.1
- Primary CTA: `Begin Inquiry` (mailto)
- Secondary CTA: `Send a Calendar Invite` (WhatsApp)
- Meta strip: `Response Time / Same business day`, `Languages / English / Spanish`, `Hours / 06:00 – 20:00 GMT-5`
- Footer mark: `IVAE Studios`
- Footer tag: `Luxury Resort Photography. Editorial. Bilingual. Golden hour, only.`
- Footer contact: `Cancún · Riviera Maya · Los Cabos · info@ivaestudios.com · English / Español`
- Footer copy: `© 2026 IVAE Studios · Luxury Resort Photographer · Cancún, Mexico`

**A11y rules satisfied:**
- FAQ accordion using `<button aria-expanded aria-controls>` + panel `hidden` attribute (matches wedding-side a11y FM 1)
- FM 4 (magnetic CTA underline-grow as non-motion affordance)
- Cross-cutting C (h2 hierarchy, footer landmark)
- En-dash (–) in time range, never em-dash
- Lang switcher pattern preserved in footer if Phase 4 keeps lang-switcher in footer (default: header only)

**Visibility-safe defaults:** FAQ items visible. Each panel defaults to `hidden` attribute (correct collapsed state). With JS off, the user can use a `:target` pseudo-class fallback (each FAQ item with an id, anchor links to expand via CSS); Phase 3 may include this fallback or accept the JS-required state. Owner preference: include CSS fallback so non-JS users can read all FAQ panels (use `details/summary` if Phase 3 prefers semantic native fallback — but the wedding-side contract says button/aria-expanded, so this section follows that for sitewide consistency).

**Button color contracts:**
- Inquiry primary CTA: ink on gold (5.1:1)
- Inquiry secondary CTA: gold border + gold text on ink-4 (7.4:1)
- Focus rings: `--focus-ring-on-gold` for primary, `--focus-ring-on-dark` for ghost
- Footer links: gold-deep on ink-4 (4.6:1) by default; gold on hover
- Active page link: gold (`--gold`) on ink-4 (7.4:1)

---

## How Phase 3 will use these prompts

Eight agents start in parallel. Each builds its assigned section into a fragment:

- Agent 1 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec1.html` (Header + Hero)
- Agent 2 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec2.html` (Pillars / Manifesto)
- Agent 3 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec3.html` (Collections)
- Agent 4 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec4.html` (Featured cinemascope)
- Agent 5 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec5.html` (Method)
- Agent 6 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec6.html` (Sunset-Friendly Time widget)
- Agent 7 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec7.html` (Voices / Testimonials / Frames)
- Agent 8 → `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-family-sections/sec8.html` (FAQ / Inquiry / Footer)

Phase 4 merges the eight fragments into a single `/luxury-family-photos.html`, preserves the SEO head verbatim per Phase 1 §11, and flattens duplicated CSS. Phase 5 runs the verification suite from `family-phase-2-a11y-contract.md`.

Each prompt above is complete and self-contained: the assigned agent does not need to read the other seven prompts to do its work.

---

**End of Phase 3 Section Build Prompts.**

Word count: ~5,200 words across eight self-contained section prompts. Each prompt covers section index, cinematic features owned, output file path, required HTML structure, required CSS classes (with --lf-* tokens), required JS, locked microcopy from the copy deck, a11y rules from the contract, visibility-safe defaults, and button color contracts. Token usage from `/styles/tokens.css` plus the additive `--lf-*` Wave 6.5 block. All eight directions satisfy the same a11y contract and consume the same locked copy deck.
