# IVAE Studios. Couples & Honeymoon v6. Phase 3 Section Build Prompts (Locked)

**Page:** `/couples-photography.html` (canonical: `/couples-photography-mexico`)
**Phase:** 3 of 5 (eight parallel section build agents)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief, Phase 2 copy deck, Phase 2 a11y contract
**Direction:** C — Minimalist Refined (per Phase 1 §9 recommendation: couples serves three personas and Direction C's restraint is the only register all three accept)

This document contains eight self-contained prompts. Each prompt produces ONE section as a standalone HTML file. The integration agent (Phase 4) assembles the eight outputs into the final page in order.

---

## Common contract for all 8 section agents (read first)

1. **Output directory:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec{N}.html` where {N} is 1 through 8.
2. **Output format:** Each file contains a single `<section>` element (or `<header>` for sec1) plus its required `<style>` and `<script>` blocks scoped to that section. No `<html>`, no `<head>`, no `<body>` wrapper. The integration agent will wrap.
3. **Token usage:** Consume from `/styles/tokens.css` and the additive `--lc-*` Wave 6.6 tokens listed in §0 below. NO hex literals. NO hardcoded px outside what tokens provide. If a needed value is absent from tokens, declare it in `:root` at the top of the section's `<style>` block with the `--lc-` prefix.
4. **Copy:** Locked in `/seo/design-audit/couples-phase-2-copy-deck.md`. Do not paraphrase. Do not rearrange.
5. **A11y:** Mandated in `/seo/design-audit/couples-phase-2-a11y-contract.md`. Follow exactly.
6. **Voice contract enforced:**
   - ZERO em-dashes.
   - Studio voice "we" / "the studio" (never "I").
   - Vianey as "Director Vianey Diaz."
   - Gender-inclusive (couples can be same-sex).
   - Discreet for proposals.
7. **Visibility-safe defaults:** Every reveal animation must have an end-state that is visible without JS. No content gated behind a class that JS adds. Static fallbacks first, animation second.
8. **Button color contracts** (lc-btn variants):
   - `lc-btn--primary`: gold fill (`--gold`), ink text (`--ink-1`), 1px gold border. Focus ring `--ink-1` (5.1:1).
   - `lc-btn--ghost`: transparent fill, gold text (`--gold`), 1px gold-line border. Focus ring `--gold` (7.4:1 on ink).
   - `lc-btn--tier`: outline gold (I, III) on cream → gold-deep text (passes 4.6:1 at ≥18px); gold-fill (II) → ink text. Focus ring per background.
   - All buttons: `min-height: 44px`, `min-width: 200px`.
9. **Reduced-motion:** Every animation has a `@media (prefers-reduced-motion: reduce)` override that flattens it. JS imperative animations check the media query and short-circuit.
10. **Image alts:** Pattern `[subject + moment] at [light condition] [in/at] [venue], photographed by IVAE Studios.` Decorative images (motes, grain, ornaments) use `aria-hidden="true"` and `alt=""`.

---

## §0 — Required `--lc-*` Wave 6.6 tokens (additive, do not modify existing tokens)

Each section may declare these in its own `:root` block if not present in `/styles/tokens.css` yet. Phase 4 integration agent will hoist into tokens.css.

```css
:root {
  /* Couples-specific (additive) */
  --lc-grain-opacity: 0.030;
  --lc-letterbox: 8%;
  --lc-dropcap-size: clamp(58px, 6.5vw, 78px);
  --lc-mote-count: 8;
  --lc-heart-stroke: 1.5;
  --lc-heart-stroke-color: var(--gold);
  --lc-infinity-stroke-width: 1.5;
  --lc-clock-size: clamp(240px, 28vw, 320px);
  --lc-clock-golden-band: 18px;
  --lc-countdown-card-w: clamp(240px, 32vw, 320px);
  --lc-countdown-card-h: 200px;
  --lc-reel-card-aspect: 4 / 5;
  --lc-reel-frame-min-width: clamp(220px, 28vw, 360px);
  --lc-tier-padding: clamp(32px, 4vw, 56px);
  --lc-pillar-cols: 3;
  --lc-section-gap: clamp(80px, 10vw, 160px);
}
```

---

## Section 1 — Header + Hero

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec1.html`

**Section name:** Header + Hero (h1 cascade, motes, 3D parallax, magnetic CTA, hero image: couple-cancun-hotel-zone)

**Required HTML skeleton:**

```html
<a class="skip-link" href="#main-content">Skip to main content</a>

<header class="site-header" role="banner">
  <a class="header-logo" href="/" aria-label="IVAE Studios home">IVAE<span> Studios</span></a>
  <nav class="header-nav" role="navigation" aria-label="Primary">
    <ul role="list">
      <li><a href="/luxury-weddings.html">Weddings</a></li>
      <li><a href="/couples-photography.html" aria-current="page">Couples</a></li>
      <li><a href="/family-photography.html">Family</a></li>
      <li><a href="/about.html">Studio</a></li>
    </ul>
  </nav>
  <div class="lang-switcher" role="group" aria-label="Language switcher">
    <a href="/couples-photography-mexico" hreflang="en" lang="en" aria-current="true" class="lang-link is-active">English</a>
    <span class="lang-sep" aria-hidden="true">|</span>
    <a href="/es/fotografia-parejas-mexico.html" hreflang="es" lang="es" aria-label="Cambiar a español" class="lang-link">Español</a>
  </div>
  <a class="lc-btn lc-btn--ghost header-cta" href="#inquiry" data-magnet="true">Begin Inquiry</a>
  <button class="header-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobile-nav">
    <span></span><span></span><span></span>
  </button>
</header>

<header class="lc-hero" id="hero" data-parallax-host aria-labelledby="hero-h1">
  <div class="lc-hero-bg" data-parallax-target>
    <img src="/images/couple-cancun-hotel-zone-ivae-studios.avif"
         alt="A couple at golden hour on the beach in the Cancun hotel zone, photographed by IVAE Studios."
         loading="eager"
         fetchpriority="high"
         decoding="async"
         width="2400"
         height="1350">
  </div>
  <div class="lc-hero-overlay" aria-hidden="true"></div>
  <div class="lc-motes" aria-hidden="true">
    <span class="lc-mote" style="--mote-x: 8%;  --mote-delay: 0s;"></span>
    <span class="lc-mote" style="--mote-x: 22%; --mote-delay: 3.5s;"></span>
    <span class="lc-mote" style="--mote-x: 38%; --mote-delay: 7s;"></span>
    <span class="lc-mote" style="--mote-x: 51%; --mote-delay: 10.5s;"></span>
    <span class="lc-mote" style="--mote-x: 64%; --mote-delay: 14s;"></span>
    <span class="lc-mote" style="--mote-x: 78%; --mote-delay: 17.5s;"></span>
    <span class="lc-mote" style="--mote-x: 87%; --mote-delay: 21s;"></span>
    <span class="lc-mote" style="--mote-x: 94%; --mote-delay: 24.5s;"></span>
  </div>

  <div class="lc-hero-content">
    <p class="lc-eyebrow">Couples / Mexico</p>
    <h1 id="hero-h1" class="lc-hero-h1">
      <span class="word">An</span>
      <span class="word">Editorial</span>
      <span class="word">Archive</span>
      <span class="word">of</span>
      <em class="lc-h1__italic"><span class="word">Two</span> <span class="word">People</span></em>
      <span class="visually-hidden">Cancun Couples Photographer</span>
    </h1>
    <p class="lc-hero-sub">The studio plans the hour around the two of you. Cancun, the Riviera Maya, Los Cabos. Editorial coverage, calm direction, bilingual on the day.</p>

    <div class="lc-availability-strip" role="group" aria-label="Studio availability">
      <p class="lc-availability">Earliest open, hold the date.</p>
      <p class="lc-availability lc-availability--proposal">Next available proposal date: this Saturday.</p>
    </div>

    <div class="lc-hero-ctas">
      <a class="lc-btn lc-btn--primary" href="#inquiry" data-magnet="true" aria-label="Begin Inquiry">Begin Inquiry</a>
      <a class="lc-btn lc-btn--ghost" href="#frames" data-magnet="true">See the Frames</a>
    </div>

    <div class="lc-hero-meta" role="group" aria-label="Studio meta">
      <span>Cancun · Riviera Maya · Los Cabos</span>
      <span class="lc-hero-meta-sep" aria-hidden="true"></span>
      <span>Bilingual</span>
      <span class="lc-hero-meta-sep" aria-hidden="true"></span>
      <span>Since 2019</span>
    </div>
  </div>
</header>
```

**Required CSS classes (use `--lc-*` tokens):**

- `.skip-link`, `.site-header`, `.header-logo`, `.header-nav`, `.header-cta`, `.header-toggle`, `.lang-switcher`
- `.lc-hero`, `.lc-hero-bg`, `.lc-hero-overlay`, `.lc-motes`, `.lc-mote`
- `.lc-hero-content`, `.lc-eyebrow`, `.lc-hero-h1`, `.lc-h1__italic`, `.lc-hero-sub`
- `.lc-availability-strip`, `.lc-availability`, `.lc-availability--proposal`
- `.lc-hero-ctas`, `.lc-btn`, `.lc-btn--primary`, `.lc-btn--ghost`
- `.lc-hero-meta`, `.lc-hero-meta-sep`
- `.word` (for h1 cascade reveal), `.visually-hidden`

**Required JS (gated):**

```js
// 3D parallax (gated on hover/fine + motion-OK)
const canParallax = window.matchMedia('(hover: hover) and (pointer: fine)').matches
                 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canParallax) {
  const host = document.querySelector('[data-parallax-host]');
  const target = document.querySelector('[data-parallax-target]');
  host?.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / r.width;
    const dy = (e.clientY - r.top - r.height / 2) / r.height;
    target.style.transform = `translate3d(${dx * -12}px, ${dy * -12}px, 0) scale(1.04)`;
  });
  host?.addEventListener('pointerleave', () => { target.style.transform = ''; });
}

// h1 word cascade (intersection-observer)
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const words = document.querySelectorAll('.lc-hero-h1 .word');
  words.forEach((w, i) => { w.style.transitionDelay = `${i * 90}ms`; });
  requestAnimationFrame(() => words.forEach(w => w.classList.add('vis')));
} else {
  document.querySelectorAll('.lc-hero-h1 .word').forEach(w => w.classList.add('vis'));
}

// Magnetic CTA tracking (gated)
if (canParallax) {
  document.querySelectorAll('[data-magnet="true"]').forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.18;
      const dy = (e.clientY - r.top - r.height / 2) * 0.18;
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}
```

**Locked microcopy for sec1:** decisions #1-7, #20 from copy deck §1.

**A11y rules to satisfy:** failure modes 1, 4, 5, 12 from a11y contract. Skip link, h1 semantic integrity, magnetic CTA focus rings, lang switcher.

**Visibility-safe defaults:** h1 words have `opacity: 1` by default; the `.vis` class is a no-op when JS off. Motes are `opacity: 0` by default and only animate via CSS keyframes (no JS dependency). Parallax target has no transform by default.

**Button color contracts:** `lc-btn--primary` gold-on-ink, `lc-btn--ghost` ghost-on-dark.

---

## Section 2 — Pillars (sticky-stage manifesto)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec2.html`

**Section name:** Manifesto + Three Pillars (sticky-stage on desktop, single column below 1024px). Pillars: Light / Direction / Discretion (NOT Presence / Privacy / Pace — Phase 1 §6.8-10 locked Light, Direction, Discretion as the winners; the Phase 2 brief sketch was indicative).

**Required HTML skeleton:**

```html
<section class="lc-manifesto-section" id="pillars" aria-labelledby="manifesto-heading">
  <div class="lc-manifesto-stage">
    <p class="lc-eyebrow">The Studio</p>
    <h2 id="manifesto-heading" class="lc-manifesto-h2">Two people, <em>carefully</em> held.</h2>
    <p class="lc-manifesto-lead">Two people, one light. The studio listens for the moment one of you laughs at the other. That is the frame the studio makes.</p>
    <p class="lc-manifesto-body">The hour is built around the two of you. The light is built backward from sunset. Direction is quiet, never posed; the studio leaves the choreography to the day and steps in to compose, to soften, to ask one of you to look back across the sand. Couples are not poses. They are the seven seconds between two glances.</p>
    <p class="lc-manifesto-body">The studio accepts a limited number of couples each month so the studio's attention never thins. Across three coastlines, at the resorts the planners trust most, the work proceeds in one register: calm, considered, golden-hour first. Honeymoon, anniversary, proposal. The same standard, the same care, the same delivery promise.</p>
    <p class="lc-manifesto-body">First frames within seventy-two hours. The full gallery within three weeks.</p>
    <p class="lc-manifesto-attr"><em>Director Vianey Diaz leads the studio.</em></p>
  </div>

  <div class="lc-pillars">
    <article class="lc-pillar" data-pillar="01">
      <p class="lc-pillar-roman" aria-hidden="true">I</p>
      <h3 class="lc-pillar-name">Golden hour, <em>only</em>.</h3>
      <p class="lc-pillar-body">The studio does not photograph couples at noon, indoors under tungsten, or against the white-on-white midday glare of a beach in March. The hour is built backward from sunset, ninety minutes the right side of the horizon. The studio knows which Cabo arch turns honey at 5:42 in November and which Mayakoba boardwalk softens at 6:18 in March. The light is the first appointment on the calendar; everything else is scheduled around it.</p>
    </article>
    <article class="lc-pillar" data-pillar="02">
      <p class="lc-pillar-roman" aria-hidden="true">II</p>
      <h3 class="lc-pillar-name">Direction, <em>not posing</em>.</h3>
      <p class="lc-pillar-body">The studio never says "look at the camera and smile." The studio says "walk back toward the water," "tell each other the thing you said in the cab," "stay where you are for a moment longer." The frame is composed, the couple is themselves. You will look like the two of you. Composed, not posed. The day will look like itself. Pinterest stays in the inbox.</p>
    </article>
    <article class="lc-pillar" data-pillar="03">
      <p class="lc-pillar-roman" aria-hidden="true">III</p>
      <h3 class="lc-pillar-name">Discreet, <em>always</em>.</h3>
      <p class="lc-pillar-body">For honeymoon and anniversary couples, the studio works with one camera and a quiet pace; the resort barely notices. For proposals, the studio is invisible: ninety minutes early, in plainclothes, at the table you cannot see, no frame taken until the kneel. The restaurant is briefed in advance, the hotel concierge is looped in by the studio, and the partner being proposed to remains unaware. Discretion is a discipline, not a personality.</p>
    </article>
  </div>
</section>
```

**Required CSS classes:**

- `.lc-manifesto-section`, `.lc-manifesto-stage`, `.lc-manifesto-h2`, `.lc-manifesto-lead`, `.lc-manifesto-body`, `.lc-manifesto-attr`
- `.lc-pillars`, `.lc-pillar`, `.lc-pillar-roman`, `.lc-pillar-name`, `.lc-pillar-body`

**Key CSS:**

```css
.lc-manifesto-section {
  padding: var(--lc-section-gap) clamp(24px, 5vw, 64px);
  background: var(--cream-1);
  display: grid;
  gap: clamp(48px, 6vw, 96px);
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .lc-manifesto-section { grid-template-columns: 5fr 7fr; gap: 64px; }
  .lc-manifesto-stage {
    position: sticky;
    top: 96px;
    align-self: start;
    height: max-content;
  }
}

.lc-manifesto-lead { font-family: var(--font-serif); font-size: clamp(20px, 2.4vw, 28px); font-weight: 300; line-height: 1.45; color: var(--text-on-light-readable); }
.lc-manifesto-lead::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--lc-dropcap-size);
  color: var(--gold-deep);
  float: left;
  padding: 6px 14px 0 0;
  line-height: 0.86;
}

.lc-pillars { display: grid; gap: clamp(48px, 6vw, 80px); }
.lc-pillar { padding-block: 0; border-top: 1px solid var(--gold-line); padding-top: clamp(24px, 3vw, 36px); }
.lc-pillar-roman { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 12px; }
.lc-pillar-name { font-family: var(--font-serif); font-size: clamp(28px, 3.2vw, 40px); font-weight: 300; color: var(--ink-1); margin-bottom: 16px; }
.lc-pillar-name em { font-style: italic; color: var(--gold-deep); }
.lc-pillar-body { font-size: var(--fs-15); line-height: 1.85; color: var(--text-on-light-readable); max-width: 520px; }
```

**Required JS:** None. Pure CSS. (IntersectionObserver-based reveal optional, but the section must be readable without JS.)

**Locked microcopy for sec2:** decisions #8, #9, #10, #12 from copy deck §1, plus full manifesto + pillars from copy deck §4.

**A11y rules to satisfy:** failure mode 10 (drop cap on first-letter, no markup pollution), failure mode 11 (sticky-stage gated below 1024px, Tab order preserved).

**Visibility-safe defaults:** Static layout. No JS-required content. Drop cap renders via `::first-letter` even if JS off.

**Button color contracts:** None — section has no buttons.

---

## Section 3 — Collections (3 tiers, count-up, heart-infinity SVG)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec3.html`

**Section name:** Collections + Trust Strip count-up "500+ couples since 2019" + heart-infinity SVG ornaments.

**Required HTML skeleton:**

```html
<section class="lc-trust-section" aria-labelledby="trust-heading">
  <h2 id="trust-heading" class="visually-hidden">Studio Statistics</h2>
  <ul class="lc-stats" aria-label="Studio statistics: since 2019, more than 500 couples photographed, 42 reviews, 5.0 star rating">
    <li class="lc-stat"><span class="lc-stat-num" aria-hidden="true">2019</span><span class="lc-stat-label">Since</span></li>
    <li class="lc-stat"><span class="lc-stat-num" aria-hidden="true"><span class="lc-count" data-count-to="500">0</span>+</span><span class="lc-stat-label">Couples</span></li>
    <li class="lc-stat"><span class="lc-stat-num" aria-hidden="true">42</span><span class="lc-stat-label">Forty-Two Reviews</span></li>
    <li class="lc-stat"><span class="lc-stat-num" aria-hidden="true">5.0 ★</span><span class="lc-stat-label">Five Point Zero Stars</span></li>
  </ul>
</section>

<section class="lc-collections-section" id="collections" aria-labelledby="collections-heading">
  <p class="lc-eyebrow">The Investment</p>
  <h2 id="collections-heading" class="lc-section-h2">Three collections, one <em>register</em>.</h2>
  <p class="lc-collections-intro">Every collection begins the same way: a long conversation, a venue walk if the trip allows, the IVAE color register applied by hand, golden hour first. What changes is the length of the session and the number of locations. Investment is in USD. The studio accepts a limited number of couples each month so the studio's attention never thins.</p>

  <div class="lc-tier-grid">

    <article class="lc-tier-card" data-tier="hour">
      <p class="lc-tier-roman" aria-hidden="true">I</p>
      <svg class="lc-tier-ornament" viewBox="0 0 48 48" aria-hidden="true" focusable="false" role="presentation">
        <path class="lc-heart-path" d="M24 12 C18 4, 4 8, 4 20 C4 32, 24 44, 24 44 C24 44, 44 32, 44 20 C44 8, 30 4, 24 12" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="160" stroke-dashoffset="160" />
      </svg>
      <h3 class="lc-tier-name"><em>The Hour</em></h3>
      <p class="lc-tier-lede"><em>A single golden hour, kept close.</em></p>
      <p class="lc-tier-investment-label">Investment from</p>
      <p class="lc-tier-price">$850 USD</p>
      <ul class="lc-tier-bullets" role="list">
        <li>One golden hour, one location</li>
        <li>Couple portraits, on the resort or the beach the studio knows</li>
        <li>One photographer, one camera, no tripod</li>
        <li>80+ hand-edited images, delivered in seven days</li>
        <li>Bilingual planning email with Director Vianey Diaz</li>
      </ul>
      <a href="#inquiry" class="lc-btn lc-btn--tier" aria-label="Begin inquiry for The Hour collection">Begin Inquiry</a>
    </article>

    <article class="lc-tier-card lc-tier-card--featured" data-tier="sunset">
      <p class="lc-tier-badge">Most Chosen</p>
      <p class="lc-tier-roman" aria-hidden="true">II</p>
      <svg class="lc-tier-ornament" viewBox="0 0 64 48" aria-hidden="true" focusable="false" role="presentation">
        <path class="lc-heart-path" d="M16 12 C12 6, 4 8, 4 18 C4 28, 16 36, 20 36 C20 36, 32 28, 32 18 C32 8, 24 6, 16 12" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="120" stroke-dashoffset="120" />
        <path class="lc-heart-path" d="M40 12 C36 6, 28 8, 28 18 C28 28, 40 36, 44 36 C44 36, 56 28, 56 18 C56 8, 48 6, 40 12" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="120" stroke-dashoffset="120" style="animation-delay: 0.18s" />
      </svg>
      <h3 class="lc-tier-name"><em>The Sunset</em></h3>
      <p class="lc-tier-lede"><em>Two locations, dressed and at rest.</em></p>
      <p class="lc-tier-investment-label">Investment from</p>
      <p class="lc-tier-price">$1,500 USD</p>
      <ul class="lc-tier-bullets" role="list">
        <li>Ninety minutes across two locations</li>
        <li>Resort detail and the beach at golden hour</li>
        <li>Proposal coverage available, discreet by default</li>
        <li>200+ hand-edited images, delivered in ten days</li>
        <li>First frames within seventy-two hours</li>
        <li>Bilingual planning call with Director Vianey Diaz</li>
      </ul>
      <a href="#inquiry" class="lc-btn lc-btn--tier lc-btn--tier-featured" aria-label="Begin inquiry for The Sunset collection">Begin Inquiry</a>
    </article>

    <article class="lc-tier-card" data-tier="adventure">
      <p class="lc-tier-roman" aria-hidden="true">III</p>
      <svg class="lc-tier-ornament" viewBox="0 0 64 32" aria-hidden="true" focusable="false" role="presentation">
        <path class="lc-heart-path" d="M8 16 C8 8, 16 8, 24 16 C32 24, 40 24, 48 16 C56 8, 56 24, 48 24 C40 24, 32 16, 24 8 C16 0, 8 16, 8 16 Z" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="180" stroke-dashoffset="180" />
      </svg>
      <h3 class="lc-tier-name"><em>The Adventure Day</em></h3>
      <p class="lc-tier-lede"><em>Three locations, half a day, the long form.</em></p>
      <p class="lc-tier-investment-label">Investment from</p>
      <p class="lc-tier-price">$2,500 USD</p>
      <ul class="lc-tier-bullets" role="list">
        <li>Four hours across three locations</li>
        <li>Resort, beach, and a cenote or yacht segment</li>
        <li>Two transportation legs handled by the studio</li>
        <li>350+ hand-edited images, delivered in fourteen days</li>
        <li>First frames within seventy-two hours</li>
        <li>Bilingual planning call with Director Vianey Diaz</li>
      </ul>
      <a href="#inquiry" class="lc-btn lc-btn--tier" aria-label="Begin inquiry for The Adventure Day collection">Begin Inquiry</a>
    </article>

  </div>

  <p class="lc-collections-note"><em>Every collection is customizable. The studio accepts a limited number of couples each month.</em></p>
</section>
```

**Required CSS classes:**

- `.lc-trust-section`, `.lc-stats`, `.lc-stat`, `.lc-stat-num`, `.lc-stat-label`, `.lc-count`
- `.lc-collections-section`, `.lc-section-h2`, `.lc-collections-intro`, `.lc-collections-note`
- `.lc-tier-grid`, `.lc-tier-card`, `.lc-tier-card--featured`, `.lc-tier-badge`, `.lc-tier-roman`, `.lc-tier-name`, `.lc-tier-lede`, `.lc-tier-investment-label`, `.lc-tier-price`, `.lc-tier-bullets`, `.lc-tier-ornament`, `.lc-heart-path`
- `.lc-btn--tier`, `.lc-btn--tier-featured`

**Key CSS for tier ornament (heart-infinity):**

```css
.lc-tier-ornament { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.85; }
.lc-tier-card[data-tier="sunset"] .lc-tier-ornament { width: 64px; }
.lc-tier-card[data-tier="adventure"] .lc-tier-ornament { width: 64px; height: 32px; }

.lc-tier-card:hover .lc-heart-path,
.lc-tier-card:focus-within .lc-heart-path {
  animation: lc-heart-draw 1.4s var(--ease) forwards;
}
@keyframes lc-heart-draw { to { stroke-dashoffset: 0; } }

@media (prefers-reduced-motion: reduce) {
  .lc-heart-path { stroke-dashoffset: 0 !important; animation: none !important; }
}
```

**Required JS (count-up, gated):**

```js
const counters = document.querySelectorAll('.lc-count');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.countTo, 10);
    if (reduce) { el.textContent = target; obs.unobserve(el); return; }
    const start = performance.now(); const dur = 1600;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * t);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    obs.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(el => obs.observe(el));
```

**Locked microcopy for sec3:** decision #11 from copy deck §1, plus full collections + tier copy from copy deck §6.

**A11y rules to satisfy:** failure mode 7 (heart-infinity SVG decorative), failure mode 8 (count-up announces final value), tier CTAs `aria-label`-differentiated.

**Visibility-safe defaults:** count-up shows the static "0+" by default; if JS off, the user sees "0+" but still reads "more than 500 couples photographed" via the `aria-label` on the parent `<ul>`. Phase 4 may improve by rendering a static "500+" inside a `<noscript>` block. Heart paths render fully (stroke-dashoffset 0) under reduced-motion.

**Button color contracts:** `lc-btn--tier` outline gold on cream, `lc-btn--tier-featured` gold-fill on cream with ink text. Focus rings per a11y contract failure mode 2.

---

## Section 4 — Featured story (cinemascope, drop cap, same-sex couple)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec4.html`

**Section name:** Featured Couple Case Study (21:9 cinemascope, drop cap on F, Camila & Ana same-sex anniversary).

**Required HTML skeleton:**

```html
<section class="lc-case-section" id="feature" aria-labelledby="case-heading">
  <p class="lc-eyebrow">A Couple</p>
  <h2 id="case-heading" class="lc-section-h2"><span lang="es">Camila</span> and <span lang="es">Ana</span>, <em><span lang="es">Cabo San Lucas</span></em>.</h2>

  <figure class="lc-case-figure">
    <div class="lc-cinemascope">
      <img src="/images/couple-cabo-san-lucas-ivae-studios.avif"
           alt="Camila and Ana on the sand at the foot of the Cabo Arch at golden hour, one walking ahead and one looking back, photographed by IVAE Studios."
           loading="lazy"
           decoding="async"
           width="2400"
           height="1029">
    </div>
  </figure>

  <div class="lc-case-caption">
    <p class="lc-case-caption-body">Fifteen years between the two of them. Camila proposed to Ana in Tulum in 2010, on the second day of a trip none of their families knew about. They came back to Mexico for the fifteenth anniversary, this time to <span lang="es">Cabo</span>, this time without anyone hiding. The studio met them on the sand at five-fifty p.m. in late October, when the light off the Pacific is the color of cut peach and the wind has dropped to nothing.</p>

    <p class="lc-case-caption-body">Ana wore a long olive linen dress. Camila wore navy trousers and a white shirt. Neither of them brought a stylist. The studio worked for ninety minutes from a single bag, two lenses, no tripod. The instructions were three: walk toward the water, walk back, then stand at the foot of the arch and tell each other something the camera did not need to hear.</p>

    <p class="lc-case-caption-body">The frame the studio considers signature is the one of Ana looking back across her shoulder while Camila walks ahead. They are not touching. They are not facing each other. The light is on Ana's face and on Camila's hands. The wind has lifted the hem of Ana's dress slightly. A frigatebird crosses the upper-right corner of the frame, which the studio did not see at the time and which Ana noticed three days later in the gallery.</p>

    <p class="lc-case-caption-body">The first frames traveled to the couple seventy-one hours after the session. The full gallery, four hundred and forty images, followed eighteen days later.</p>
  </div>

  <dl class="lc-case-meta">
    <div class="lc-case-meta-cell">
      <dt>Coast</dt><dd>Los Cabos</dd>
    </div>
    <div class="lc-case-meta-cell">
      <dt>Years Together</dt><dd>Fifteen</dd>
    </div>
    <div class="lc-case-meta-cell">
      <dt>Coverage</dt><dd>The Sunset, ninety minutes</dd>
    </div>
  </dl>
</section>
```

**Required CSS classes:**

- `.lc-case-section`, `.lc-case-figure`, `.lc-cinemascope`, `.lc-case-caption`, `.lc-case-caption-body`, `.lc-case-meta`, `.lc-case-meta-cell`

**Key CSS:**

```css
.lc-case-section { padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--cream-1); }

.lc-cinemascope {
  position: relative;
  aspect-ratio: 21 / 9;
  overflow: hidden;
  margin-bottom: clamp(40px, 5vw, 72px);
  background: var(--ink-3);
}
.lc-cinemascope::before,
.lc-cinemascope::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: var(--lc-letterbox);
  background: var(--ink-3);
  z-index: 2;
}
.lc-cinemascope::before { top: 0; border-bottom: 1px solid var(--gold-line); }
.lc-cinemascope::after { bottom: 0; border-top: 1px solid var(--gold-line); }
.lc-cinemascope img { width: 100%; height: 100%; object-fit: cover; display: block; }

.lc-case-caption { max-width: 720px; margin: 0 auto; }
.lc-case-caption-body { font-size: var(--fs-15); line-height: 1.90; color: var(--text-on-light-readable); margin-bottom: 24px; }
.lc-case-caption-body:first-of-type::first-letter {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 300;
  font-size: var(--lc-dropcap-size);
  color: var(--gold-deep);
  float: left;
  padding: 6px 14px 0 0;
  line-height: 0.86;
}

.lc-case-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  max-width: 720px;
  margin: clamp(48px, 6vw, 80px) auto 0;
  border-top: 1px solid var(--gold-line);
  padding-top: 32px;
}
.lc-case-meta-cell { text-align: center; padding: 0 16px; border-right: 1px solid var(--gold-line); }
.lc-case-meta-cell:last-child { border-right: none; }
.lc-case-meta dt { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 8px; }
.lc-case-meta dd { font-family: var(--font-serif); font-size: var(--fs-18); font-weight: 300; color: var(--ink-1); }
```

**Required JS:** None. Pure CSS.

**Locked microcopy for sec4:** copy deck §5 in full.

**A11y rules to satisfy:** failure mode 10 (drop cap on `::first-letter`), failure mode 12 (Spanish proper nouns wrapped in `<span lang="es">`).

**Visibility-safe defaults:** Cinemascope letterboxing via CSS pseudos. Drop cap via `::first-letter`. No JS-required content.

**Button color contracts:** None — section has no buttons.

---

## Section 5 — Method (5 steps + sunset clock + proposal countdown widget)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec5.html`

**Section name:** Method (Plan / Direct / Light / Capture / Deliver) plus the COUPLES-NATIVE sunset clock + proposal countdown widget between steps 3 and 4.

**Required HTML skeleton:**

```html
<section class="lc-method-section" id="method" aria-labelledby="method-heading">
  <p class="lc-eyebrow">The Method</p>
  <h2 id="method-heading" class="lc-section-h2">Five considered <em>steps</em>, plan to delivery.</h2>
  <p class="lc-method-intro">The studio works the same way for every couple, regardless of trip length. The first inquiry is read the same business day, in English or Spanish. A planning call follows. The light is mapped. The session runs to the hour the light turns honest. The first frames travel home with you. The shape of the session is decided early so the session itself can be improvised.</p>

  <ol class="lc-method-steps" role="list">
    <li class="lc-method-step">
      <p class="lc-method-step-tag" aria-hidden="true">01 · Plan</p>
      <h3 class="lc-method-step-name">Plan</h3>
      <p class="lc-method-step-body">The first email arrives at any hour. The studio reads it the same business day, with two questions and a candid sense of whether the dates are open. The first response is from Director Vianey Diaz. For proposals, the studio confirms within twenty-four hours; the lead time is shorter for a reason.</p>
    </li>
    <li class="lc-method-step">
      <p class="lc-method-step-tag" aria-hidden="true">02 · Direct</p>
      <h3 class="lc-method-step-name">Direct</h3>
      <p class="lc-method-step-body">Quiet direction in the lead-up. A wardrobe note, a light schedule, a map of the location with the spots marked. For proposals, the studio coordinates with the restaurant or the hotel beach manager directly so the partner being proposed to remains unaware until the kneel. For honeymoons, the studio sends a wardrobe color palette by month so the linen and the bougainvillea agree.</p>
    </li>
    <li class="lc-method-step">
      <p class="lc-method-step-tag" aria-hidden="true">03 · Light</p>
      <h3 class="lc-method-step-name">Light</h3>
      <p class="lc-method-step-body">The light is the first appointment. The studio arrives at the location ninety minutes before sunset for The Sunset and Adventure Day; for The Hour, the studio arrives at the time the light turns honest and works to its end. The session pace is set by the sun, not by a shot list. Golden hour, only.</p>
    </li>
  </ol>

  <aside class="lc-clock-section" aria-labelledby="clock-heading">
    <h3 id="clock-heading" class="visually-hidden">Golden hour and proposal availability</h3>

    <div class="lc-clock-container">
      <svg class="lc-clock-svg" viewBox="0 0 320 320" role="img" aria-labelledby="clock-svg-title clock-svg-desc">
        <title id="clock-svg-title">Sunset clock for January in Cancun</title>
        <desc id="clock-svg-desc">A circular clock face showing golden hour from 4:50 p.m. to 5:30 p.m., with the recommended couples session start time at 4:00 p.m.</desc>
        <circle cx="160" cy="160" r="140" fill="none" stroke="var(--gold-line)" stroke-width="1"></circle>
        <path class="lc-clock-golden-band" d="M 160 160 L 160 28 A 132 132 0 0 1 245 96 Z" fill="var(--gold)" opacity="0.18"></path>
        <line class="lc-clock-hand" x1="160" y1="160" x2="160" y2="40" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"></line>
        <circle cx="160" cy="160" r="4" fill="var(--gold)"></circle>
      </svg>

      <div class="lc-month-controls" role="group" aria-label="Pick a month">
        <button class="lc-month-btn is-active" type="button" aria-pressed="true" data-month="1" data-sunset="17:30" data-start="16:00">January</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="2" data-sunset="17:50" data-start="16:20">February</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="3" data-sunset="18:10" data-start="16:40">March</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="4" data-sunset="18:25" data-start="16:55">April</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="5" data-sunset="18:40" data-start="17:10">May</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="6" data-sunset="18:50" data-start="17:20">June</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="7" data-sunset="18:50" data-start="17:20">July</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="8" data-sunset="18:35" data-start="17:05">August</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="9" data-sunset="18:10" data-start="16:40">September</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="10" data-sunset="17:45" data-start="16:15">October</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="11" data-sunset="17:25" data-start="15:55">November</button>
        <button class="lc-month-btn" type="button" aria-pressed="false" data-month="12" data-sunset="17:20" data-start="15:50">December</button>
      </div>

      <p class="lc-clock-caption">Pick the month. The ring shows when the light turns honest. The studio starts couples sessions ninety minutes before that.</p>
    </div>

    <div class="lc-countdown-card" aria-labelledby="countdown-heading" aria-live="polite">
      <h4 id="countdown-heading" class="lc-countdown-title">Next Available Proposal Date</h4>
      <p class="lc-countdown-caption">
        <span class="lc-countdown-date">This Saturday</span>
        <span class="lc-countdown-time">at five-fifteen p.m.</span>
      </p>
      <p class="lc-countdown-cta">Inquire to hold.</p>
      <a class="lc-btn lc-btn--ghost lc-countdown-btn" href="#inquiry">Begin Inquiry</a>
    </div>
  </aside>

  <ol class="lc-method-steps lc-method-steps--continued" role="list" start="4">
    <li class="lc-method-step">
      <p class="lc-method-step-tag" aria-hidden="true">04 · Capture</p>
      <h3 class="lc-method-step-name">Capture</h3>
      <p class="lc-method-step-body">Quiet direction on the day. The studio works from a single bag, one or two lenses, no tripod, no flash. The first ten minutes are for warming up; the next sixty are the work. For proposals, the studio captures the discreet first-coverage from a fixed position, then meets the newly-engaged couple within ninety seconds for a thirty-minute portrait session. The pacing is calm. The couple sets the cadence.</p>
    </li>
    <li class="lc-method-step">
      <p class="lc-method-step-tag" aria-hidden="true">05 · Deliver</p>
      <h3 class="lc-method-step-name">Deliver</h3>
      <p class="lc-method-step-body">First frames within seventy-two hours, twenty to thirty editorial images on a private link. The full gallery follows within seven to fourteen days depending on tier, hand-edited in the IVAE color register, never auto-toned, never run through a preset. Speed at this caliber is rare. The studio treats it as a standing condition, not a marketing claim.</p>
    </li>
  </ol>
</section>
```

**Required CSS classes:**

- `.lc-method-section`, `.lc-method-intro`, `.lc-method-steps`, `.lc-method-step`, `.lc-method-step-tag`, `.lc-method-step-name`, `.lc-method-step-body`
- `.lc-clock-section`, `.lc-clock-container`, `.lc-clock-svg`, `.lc-clock-golden-band`, `.lc-clock-hand`
- `.lc-month-controls`, `.lc-month-btn`
- `.lc-clock-caption`
- `.lc-countdown-card`, `.lc-countdown-title`, `.lc-countdown-caption`, `.lc-countdown-date`, `.lc-countdown-time`, `.lc-countdown-cta`, `.lc-countdown-btn`

**Key CSS:**

```css
.lc-method-section { padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--cream-1); }
.lc-method-intro { max-width: 720px; font-size: var(--fs-15); line-height: 1.90; color: var(--text-on-light-readable); margin-bottom: clamp(48px, 6vw, 80px); }
.lc-method-steps { list-style: none; max-width: 920px; padding: 0; }
.lc-method-step { padding-left: 32px; border-left: 1px solid var(--gold-line); padding-block: clamp(24px, 3vw, 36px) clamp(24px, 3vw, 48px); }
.lc-method-step-tag { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 12px; }
.lc-method-step-name { font-family: var(--font-serif); font-size: clamp(24px, 2.6vw, 32px); font-weight: 300; color: var(--ink-1); margin-bottom: 12px; }
.lc-method-step-body { font-size: var(--fs-15); line-height: 1.85; color: var(--text-on-light-readable); }

.lc-clock-section { display: grid; gap: clamp(32px, 4vw, 56px); padding: clamp(48px, 6vw, 80px) 0; align-items: center; grid-template-columns: 1fr; }
@media (min-width: 1024px) { .lc-clock-section { grid-template-columns: 1fr auto; } }

.lc-clock-svg { width: var(--lc-clock-size); height: var(--lc-clock-size); display: block; margin: 0 auto; }
.lc-month-controls { display: flex; flex-wrap: wrap; gap: 8px; max-width: 480px; margin-top: 16px; }
.lc-month-btn { padding: 8px 14px; min-height: 44px; font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; background: transparent; color: var(--gold-deep); border: 1px solid var(--gold-line); cursor: pointer; transition: background var(--t-quick) var(--ease), color var(--t-quick) var(--ease); }
.lc-month-btn[aria-pressed="true"] { background: var(--gold); color: var(--ink-1); border-color: var(--gold); }
.lc-month-btn:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 4px; }

.lc-countdown-card { width: var(--lc-countdown-card-w); min-height: var(--lc-countdown-card-h); padding: clamp(20px, 2.4vw, 28px); background: var(--ink-3); color: var(--cream-1); border: 1px solid var(--gold-line); display: flex; flex-direction: column; gap: 12px; }
.lc-countdown-title { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold); }
.lc-countdown-caption { font-family: var(--font-serif); font-size: clamp(20px, 2.4vw, 28px); font-weight: 300; line-height: 1.30; }
.lc-countdown-date { display: block; }
.lc-countdown-time { display: block; color: var(--gold); }
.lc-countdown-cta { font-size: var(--fs-13); color: var(--text-on-dark-readable); margin-top: auto; }
.lc-countdown-btn { margin-top: 12px; }
```

**Required JS:**

```js
// Sunset clock month-button toggle
const monthBtns = document.querySelectorAll('.lc-month-btn');
const clockTitle = document.getElementById('clock-svg-title');
const clockDesc = document.getElementById('clock-svg-desc');
const goldenBand = document.querySelector('.lc-clock-golden-band');

const monthNames = { 1:'January',2:'February',3:'March',4:'April',5:'May',6:'June',7:'July',8:'August',9:'September',10:'October',11:'November',12:'December' };

monthBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    monthBtns.forEach(b => { b.setAttribute('aria-pressed', 'false'); b.classList.remove('is-active'); });
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('is-active');
    const m = btn.dataset.month;
    const sunset = btn.dataset.sunset;
    const start = btn.dataset.start;
    if (clockTitle) clockTitle.textContent = `Sunset clock for ${monthNames[m]} in Cancun`;
    if (clockDesc) clockDesc.textContent = `A circular clock face showing golden hour ending at ${sunset}, with the recommended couples session start time at ${start}.`;
    // Rotate the golden band visually based on sunset hour (simple linear mapping)
    const [hh, mm] = sunset.split(':').map(Number);
    const minutes = hh * 60 + mm;
    const angle = ((minutes - 12*60) / (24*60)) * 360 - 90;
    if (goldenBand) goldenBand.setAttribute('transform', `rotate(${angle} 160 160)`);
  });
});

// Proposal countdown hydration (static fallback already rendered)
// Phase 4 wires this to a JSON endpoint or build-time data.
async function hydrateCountdown() {
  // Optional: fetch('/data/proposal-availability.json').then(r => r.json()).then(data => { ... })
  // For Phase 3, the static "This Saturday at five-fifteen p.m." is the production text.
}
hydrateCountdown();
```

**Locked microcopy for sec5:** decisions #15, #16 from copy deck §1, plus full method + widget caption from copy deck §7.

**A11y rules to satisfy:** failure mode 3 (clock SVG with title/desc, month buttons aria-pressed, countdown aria-live), failure mode 12 (Spanish month names if widget locale switches; default EN here).

**Visibility-safe defaults:** Static SVG renders with January selected. Static countdown text "This Saturday at five-fifteen p.m." renders before any JS hydration. Month buttons function as plain `<button>` even with JS off (no-op clicks).

**Button color contracts:** Month buttons have a clear pressed state (gold-fill + ink). Countdown card has a `lc-btn--ghost` CTA (gold border, gold text on ink-3 background; focus ring `--gold` 7.4:1).

---

## Section 6 — Testimonials (pull-quote with 320px Cormorant `❝`, 6 cards)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec6.html`

**Section name:** Pull-quote signature + Six testimonial cards (gender-mixed, 1 same-sex anniversary, 1 same-sex honeymoon).

**Required HTML skeleton:**

```html
<section class="lc-pullquote-section" aria-labelledby="voices-heading">
  <h2 id="voices-heading" class="visually-hidden">Voices</h2>
  <p class="lc-eyebrow lc-eyebrow--on-dark">Voices</p>

  <blockquote class="lc-pullquote">
    <span class="lc-pullquote__ornament" aria-hidden="true">&#10077;</span>
    <p class="lc-pullquote__body">We came back to the same beach where we got engaged. I cried when I saw the gallery. The pictures are more honest than the day was, and that is the highest compliment we know how to give.</p>
    <cite class="lc-pullquote__attr">Sarah &amp; Michael  ·  Esperanza, <span lang="es">Cabo San Lucas</span>  ·  March 2026</cite>
  </blockquote>
</section>

<section class="lc-testimonials-section" aria-labelledby="testimonials-heading">
  <h2 id="testimonials-heading" class="visually-hidden">What Couples Say</h2>
  <p class="lc-eyebrow">What Couples Say</p>

  <div class="lc-testimonials-grid">
    <article class="lc-testimonial-card">
      <blockquote><p>The studio sat at the table behind us for forty minutes. I never saw them. The first frame in our gallery is the second I knelt. The look on her face is the picture I will keep on my desk for the rest of my life.</p></blockquote>
      <cite>Daniel  ·  Le Blanc, Cancun  ·  February 2026</cite>
      <span class="visually-hidden">Persona: proposal.</span>
    </article>

    <article class="lc-testimonial-card">
      <blockquote><p>We had been married six weeks. We were tired in the way honeymoons make you tired. The studio met us at the boardwalk at six-twenty in the morning and we did not speak for the first ten minutes. The pictures look like the trip felt. We did not pose once.</p></blockquote>
      <cite><span lang="es">Ana</span> &amp; <span lang="es">Marco</span>  ·  Rosewood <span lang="es">Mayakoba</span>  ·  January 2026</cite>
      <span class="visually-hidden">Persona: honeymoon.</span>
    </article>

    <article class="lc-testimonial-card lc-testimonial-card--anchor">
      <blockquote><p>Fifteen years to the week. We came back to Mexico because we honeymooned here. The frames Vianey made of us at the arch are on the wall of our foyer. Our nieces ask whose wedding it was.</p></blockquote>
      <cite><span lang="es">Camila</span> &amp; <span lang="es">Ana</span>  ·  Esperanza, <span lang="es">Cabo San Lucas</span>  ·  October 2025</cite>
      <span class="visually-hidden">Persona: anniversary, same-sex couple.</span>
    </article>

    <article class="lc-testimonial-card">
      <blockquote><p>Twenty-fifth anniversary. We did not want a wedding redo. We wanted one frame for the foyer and twenty for the album our daughters are building. The studio understood the difference on the first call.</p></blockquote>
      <cite>Priya &amp; Aman  ·  Maroma Belmond  ·  December 2025</cite>
      <span class="visually-hidden">Persona: anniversary.</span>
    </article>

    <article class="lc-testimonial-card">
      <blockquote><p>The wedding was in Madrid. We honeymooned in the Riviera Maya because neither of us had been. The studio asked us what we ate for breakfast and what music we walked down the aisle to and built the morning around the answers.</p></blockquote>
      <cite><span lang="es">Pablo</span> &amp; <span lang="es">Tomás</span>  ·  Banyan Tree <span lang="es">Mayakoba</span>  ·  April 2026</cite>
      <span class="visually-hidden">Persona: honeymoon, same-sex couple.</span>
    </article>

    <article class="lc-testimonial-card">
      <blockquote><p>Forty-eight hours before our trip, I emailed the studio. The reply came in two hours, a Saturday slot at sunset on a beach the hotel did not allow tripods on. Vianey called the resort and the resort said yes. He said yes, too.</p></blockquote>
      <cite>Mia  ·  <span lang="es">Nizuc</span>, Cancun  ·  November 2025</cite>
      <span class="visually-hidden">Persona: proposal.</span>
    </article>
  </div>
</section>
```

**Required CSS classes:**

- `.lc-pullquote-section`, `.lc-pullquote`, `.lc-pullquote__ornament`, `.lc-pullquote__body`, `.lc-pullquote__attr`
- `.lc-testimonials-section`, `.lc-testimonials-grid`, `.lc-testimonial-card`, `.lc-testimonial-card--anchor`
- `.lc-eyebrow--on-dark` (variant when on ink)

**Key CSS:**

```css
.lc-pullquote-section { padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--ink-3); position: relative; overflow: hidden; }
.lc-pullquote { position: relative; max-width: 920px; margin: 0 auto; padding: clamp(48px, 6vw, 96px) 0; text-align: center; }
.lc-pullquote__ornament {
  position: absolute;
  top: -20px; left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-serif);
  font-size: clamp(180px, 22vw, 320px);
  line-height: 1;
  color: var(--gold);
  opacity: 0.18;
  pointer-events: none;
  z-index: 0;
}
.lc-pullquote__body { position: relative; z-index: 1; font-family: var(--font-serif); font-style: italic; font-size: clamp(22px, 2.6vw, 38px); font-weight: 300; line-height: 1.30; color: var(--cream-1); margin-bottom: 32px; }
.lc-pullquote__attr { font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500; letter-spacing: 0.18em; color: var(--gold); font-style: normal; }

.lc-testimonials-section { padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--cream-1); }
.lc-testimonials-grid { display: grid; gap: clamp(24px, 3vw, 40px); grid-template-columns: 1fr; max-width: 1240px; margin: 32px auto 0; }
@media (min-width: 768px) { .lc-testimonials-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px) { .lc-testimonials-grid { grid-template-columns: 1fr 1fr 1fr; } }

.lc-testimonial-card { padding: clamp(24px, 3vw, 36px); border-top: 1px solid var(--gold-line); }
.lc-testimonial-card--anchor { border-top-width: 2px; border-top-color: var(--gold); }
.lc-testimonial-card blockquote p { font-family: var(--font-serif); font-style: italic; font-size: var(--fs-15); font-weight: 300; line-height: 1.60; color: var(--text-on-light-readable); margin-bottom: 16px; }
.lc-testimonial-card cite { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-deep); font-style: normal; }
```

**Required JS:** None. Pure CSS.

**Locked microcopy for sec6:** decision #13 from copy deck §1, plus full pull-quote (copy deck §8) and 6 testimonial cards (copy deck §9).

**A11y rules to satisfy:** failure mode 9 (pull-quote ornament `aria-hidden`, semantic `<blockquote>` + `<cite>`), failure mode 12 (Spanish proper nouns wrapped in `<span lang="es">`).

**Visibility-safe defaults:** Pure HTML/CSS. No JS dependency.

**Button color contracts:** None — section has no buttons.

---

## Section 7 — Frames gallery (drag-scroll reel, romantic moments, including same-sex inclusion)

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec7.html`

**Section name:** Romantic Moments Reel (drag-scroll, 6 frames at 4:5, captions name the moment, at least one same-sex frame).

**Required HTML skeleton:**

```html
<section class="lc-reel-section" id="frames" aria-labelledby="reel-heading">
  <h2 id="reel-heading" class="visually-hidden">Romantic moments</h2>
  <p class="lc-eyebrow">Frames</p>
  <p class="lc-reel-hint">Drag to scroll the reel.</p>

  <div class="lc-reel-track" role="region" aria-label="Romantic moments reel, six frames" tabindex="0">

    <figure class="lc-reel-frame">
      <img src="/images/couple-proposal-tulum-ivae-studios.avif" alt="A surprise proposal at a private dinner table on the sand at Tulum at golden hour, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The kneel.</figcaption>
    </figure>

    <figure class="lc-reel-frame">
      <img src="/images/couple-mayakoba-ivae-studios.avif" alt="A honeymoon couple walking the boardwalk at golden hour at Rosewood Mayakoba, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The morning of the dress.</figcaption>
    </figure>

    <figure class="lc-reel-frame">
      <img src="/images/couple-cabo-arch-sunset-ivae-studios.avif" alt="A couple at the foot of the Cabo Arch at sunset, one looking back across her shoulder, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The second sunset.</figcaption>
    </figure>

    <figure class="lc-reel-frame lc-reel-frame--same-sex">
      <img src="/images/couple-cabo-san-lucas-ivae-studios.avif" alt="Camila and Ana at their fifteenth anniversary at the foot of the Cabo Arch at golden hour, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The year fifteen.</figcaption>
    </figure>

    <figure class="lc-reel-frame">
      <img src="/images/couple-cenote-riviera-maya-ivae-studios.avif" alt="A couple diving into a cenote in the Riviera Maya at midday with sunlight streaming through the cave opening, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The cenote dive.</figcaption>
    </figure>

    <figure class="lc-reel-frame">
      <img src="/images/couple-laughing-nizuc-ivae-studios.avif" alt="A couple laughing on the beach at golden hour at Nizuc Cancun, photographed by IVAE Studios." loading="lazy" decoding="async">
      <figcaption class="lc-reel-caption">The laugh.</figcaption>
    </figure>

  </div>

  <div class="lc-reel-controls" role="group" aria-label="Reel navigation">
    <button class="lc-reel-btn lc-reel-btn--prev" type="button" aria-label="Previous frame">
      <span aria-hidden="true">&larr;</span>
    </button>
    <button class="lc-reel-btn lc-reel-btn--next" type="button" aria-label="Next frame">
      <span aria-hidden="true">&rarr;</span>
    </button>
  </div>
</section>
```

**Required CSS classes:**

- `.lc-reel-section`, `.lc-reel-hint`, `.lc-reel-track`, `.lc-reel-frame`, `.lc-reel-caption`, `.lc-reel-controls`, `.lc-reel-btn`, `.lc-reel-btn--prev`, `.lc-reel-btn--next`

**Key CSS:**

```css
.lc-reel-section { padding: var(--lc-section-gap) 0 calc(var(--lc-section-gap) - 24px); background: var(--cream-1); }
.lc-reel-section .lc-eyebrow,
.lc-reel-hint { padding-inline: clamp(24px, 5vw, 64px); }
.lc-reel-hint { font-family: var(--font-sans); font-size: var(--fs-13); color: var(--gold-deep); margin-bottom: 32px; letter-spacing: 0.05em; }

.lc-reel-track {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-inline: clamp(24px, 5vw, 64px);
  padding-bottom: 16px;
  scrollbar-width: thin;
  cursor: grab;
}
.lc-reel-track:active { cursor: grabbing; }
.lc-reel-track:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 4px; }

.lc-reel-frame {
  flex: 0 0 var(--lc-reel-frame-min-width);
  aspect-ratio: var(--lc-reel-card-aspect);
  scroll-snap-align: start;
  margin: 0;
  position: relative;
}
.lc-reel-frame img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.95) saturate(1); }
.lc-reel-caption {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-15);
  font-weight: 300;
  color: var(--ink-1);
  margin-top: 12px;
  padding-inline: 4px;
}

.lc-reel-controls { display: flex; gap: 12px; padding-inline: clamp(24px, 5vw, 64px); margin-top: 24px; }
.lc-reel-btn { min-width: 44px; min-height: 44px; padding: 12px; background: transparent; color: var(--gold-deep); border: 1px solid var(--gold-line); cursor: pointer; font-size: 18px; line-height: 1; transition: background var(--t-quick) var(--ease), color var(--t-quick) var(--ease); }
.lc-reel-btn:hover { background: rgba(168, 137, 74, 0.10); color: var(--ink-1); border-color: var(--gold); }
.lc-reel-btn:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 4px; }
```

**Required JS:**

```js
const track = document.querySelector('.lc-reel-track');
const prev = document.querySelector('.lc-reel-btn--prev');
const next = document.querySelector('.lc-reel-btn--next');

function scrollByFrame(dir) {
  if (!track) return;
  const frame = track.querySelector('.lc-reel-frame');
  const w = frame ? frame.getBoundingClientRect().width + 24 : 320;
  track.scrollBy({ left: dir * w, behavior: 'smooth' });
}

prev?.addEventListener('click', () => scrollByFrame(-1));
next?.addEventListener('click', () => scrollByFrame(1));

track?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { scrollByFrame(1); e.preventDefault(); }
  if (e.key === 'ArrowLeft')  { scrollByFrame(-1); e.preventDefault(); }
});

// Pointer-drag scroll (mouse + trackpad)
let isDown = false, startX = 0, startScroll = 0;
track?.addEventListener('pointerdown', (e) => { isDown = true; startX = e.pageX; startScroll = track.scrollLeft; track.setPointerCapture(e.pointerId); });
track?.addEventListener('pointermove', (e) => { if (!isDown) return; track.scrollLeft = startScroll - (e.pageX - startX); });
track?.addEventListener('pointerup', () => { isDown = false; });
track?.addEventListener('pointercancel', () => { isDown = false; });
```

**Locked microcopy for sec7:** decision #14 from copy deck §1; reel captions: "The kneel." / "The morning of the dress." / "The second sunset." / "The year fifteen." / "The cenote dive." / "The laugh."

**A11y rules to satisfy:** failure mode 2 (drag-scroll reel keyboard accessibility), failure mode 12 (Spanish place names where applicable; the captions themselves are EN).

**Visibility-safe defaults:** Reel is a native horizontal scroller. Without JS, the user can still scroll horizontally (touch swipe, scrollbar drag). Buttons gracefully degrade to no-ops without JS but still receive focus.

**Button color contracts:** Prev/next buttons use ghost styling on cream (gold-deep border, gold-deep text, on cream background; focus ring `--gold-deep` 4.6:1).

**Same-sex inclusion:** Frame 4 (`lc-reel-frame--same-sex`) features Camila & Ana at their fifteenth anniversary; same image as the case study cinemascope. The dedicated CSS class is a hook for Phase 4 to verify inclusion programmatically (never hide or visually distinguish; the modifier is a marker only).

---

## Section 8 — FAQ + Inquiry CTA + Footer

**Output file:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-couples-sections/sec8.html`

**Section name:** Considered Questions (10 Q+A accordion) + Inquiry block (3 CTAs, urgency-aware) + Footer.

**Required HTML skeleton:**

```html
<section class="lc-faq-section" id="faq" aria-labelledby="faq-heading">
  <p class="lc-eyebrow">Considered Questions</p>
  <h2 id="faq-heading" class="lc-section-h2">Ten questions, <em>answered before they are asked</em>.</h2>

  <ul class="lc-faq-list" role="list">
    <li class="lc-faq-item">
      <h3 class="lc-faq-question-wrap">
        <button class="lc-faq-toggle" id="faq-1-question" type="button" aria-expanded="false" aria-controls="faq-1-panel">
          When is golden hour at your destinations?
          <span class="lc-faq-icon" aria-hidden="true"></span>
        </button>
      </h3>
      <div class="lc-faq-panel" id="faq-1-panel" role="region" aria-labelledby="faq-1-question" hidden>
        <p>Golden hour shifts by month. In November along Cancun and the Riviera Maya, the light turns honest at five-twelve p.m.; by March it is at six-eighteen. In Los Cabos, the light tracks the Pacific and runs about thirty minutes later than the Caribbean coast. The studio starts every couples session ninety minutes before sunset and works through to the last useful light. The sunset clock above lets you pick the month and see the start time the studio recommends.</p>
      </div>
    </li>
    <!-- 9 more <li> entries identical pattern; questions and answers from copy deck §10 -->
  </ul>
</section>

<section class="lc-inquiry-section" id="inquiry" aria-labelledby="inquiry-heading">
  <div class="lc-inquiry-bg" aria-hidden="true">
    <img src="/images/couple-twilight-resort-ivae-studios.avif" alt="" loading="lazy" decoding="async">
  </div>
  <div class="lc-inquiry-content">
    <p class="lc-eyebrow lc-eyebrow--on-dark">Begin</p>
    <h2 id="inquiry-heading" class="lc-inquiry-h2">Tell us about the two of you.</h2>
    <p class="lc-inquiry-pitch">Share your travel dates, your resort, and a sentence about the moment. The studio responds the same business day, in English or Spanish, with two questions and a candid sense of whether the date is open. The first reply will come from Director Vianey Diaz. For proposals, the studio confirms within twenty-four hours; the lead time is shorter for a reason.</p>

    <div class="lc-inquiry-ctas" role="group" aria-label="Inquiry actions">
      <a class="lc-btn lc-btn--primary" href="mailto:info@ivaestudios.com?subject=Couples%20Inquiry" data-magnet="true">Begin Inquiry</a>
      <a class="lc-btn lc-btn--ghost lc-btn--proposal" href="https://wa.me/529902046514?text=Proposal%20availability%20inquiry" data-magnet="true">Check Proposal Availability</a>
      <a class="lc-btn lc-btn--text" href="https://wa.me/529902046514">WhatsApp the Studio</a>
    </div>

    <dl class="lc-inquiry-meta" role="group" aria-label="Studio response details">
      <div class="lc-inquiry-meta-cell"><dt>Response Time</dt><dd>Same business day</dd></div>
      <div class="lc-inquiry-meta-cell"><dt>Languages</dt><dd>English / Spanish</dd></div>
      <div class="lc-inquiry-meta-cell"><dt>Hours</dt><dd>06:00 &ndash; 20:00 GMT-5</dd></div>
    </dl>
  </div>
</section>

<footer class="site-footer" role="contentinfo">
  <p class="site-footer__tag">Luxury Resort Photography. Editorial. Bilingual. Golden hour, only.</p>

  <div class="site-footer__cols">
    <div class="footer-col">
      <h2 class="visually-hidden">Footer services</h2>
      <p class="footer-col__title">Services</p>
      <ul role="list">
        <li><a href="/luxury-weddings.html">Weddings</a></li>
        <li><a href="/couples-photography.html">Couples</a></li>
        <li><a href="/family-photography.html">Family</a></li>
        <li><a href="/editorial.html">Editorial</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h2 class="visually-hidden">Footer coastlines</h2>
      <p class="footer-col__title">Coastlines</p>
      <ul role="list">
        <li><a href="/cancun.html">Cancun</a></li>
        <li><a href="/riviera-maya.html">Riviera Maya</a></li>
        <li><a href="/los-cabos.html">Los Cabos</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h2 class="visually-hidden">Footer studio</h2>
      <p class="footer-col__title">Studio</p>
      <ul role="list">
        <li><a href="/about.html">About</a></li>
        <li><a href="/vianey-diaz.html">Vianey</a></li>
        <li><a href="/blog/">Journal</a></li>
        <li><a href="#inquiry">Contact</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h2 class="visually-hidden">Footer legal</h2>
      <p class="footer-col__title">Legal</p>
      <ul role="list">
        <li><a href="/privacy.html">Privacy</a></li>
        <li><a href="/terms.html">Terms</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>
  </div>

  <div class="site-footer__base">
    <p>IVAE Studios is a small editorial photography practice based in Cancun, working across the Yucatan and Los Cabos. Director Vianey Diaz leads every couples inquiry. The studio accepts a limited number of couples each month so the studio's attention never thins.</p>
    <div class="lang-switcher" role="group" aria-label="Language switcher">
      <a href="/couples-photography-mexico" hreflang="en" lang="en" aria-current="true" class="lang-link is-active">English</a>
      <span class="lang-sep" aria-hidden="true">|</span>
      <a href="/es/fotografia-parejas-mexico.html" hreflang="es" lang="es" aria-label="Cambiar a español" class="lang-link">Español</a>
    </div>
    <p class="site-footer__copyright">&copy; 2019&ndash;2026 IVAE Studios. Cancun, Mexico. All frames hand-edited.</p>
  </div>
</footer>
```

**Required CSS classes:**

- `.lc-faq-section`, `.lc-faq-list`, `.lc-faq-item`, `.lc-faq-question-wrap`, `.lc-faq-toggle`, `.lc-faq-icon`, `.lc-faq-panel`
- `.lc-inquiry-section`, `.lc-inquiry-bg`, `.lc-inquiry-content`, `.lc-inquiry-h2`, `.lc-inquiry-pitch`, `.lc-inquiry-ctas`, `.lc-inquiry-meta`, `.lc-inquiry-meta-cell`
- `.lc-btn--proposal`, `.lc-btn--text`
- `.site-footer`, `.site-footer__tag`, `.site-footer__cols`, `.footer-col`, `.footer-col__title`, `.site-footer__base`, `.site-footer__copyright`

**Key CSS:**

```css
.lc-faq-section { padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--ink-3); color: var(--cream-1); }
.lc-faq-list { list-style: none; max-width: 880px; margin: 32px auto 0; padding: 0; }
.lc-faq-item { border-bottom: 1px solid rgba(196, 163, 90, 0.18); }
.lc-faq-toggle {
  width: 100%;
  background: transparent;
  border: none;
  padding: 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-serif);
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 300;
  color: var(--cream-1);
  min-height: 44px;
}
.lc-faq-toggle:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }
.lc-faq-icon::before, .lc-faq-icon::after {
  content: ''; display: block; width: 14px; height: 1px; background: var(--gold);
}
.lc-faq-icon { position: relative; width: 14px; height: 14px; flex-shrink: 0; }
.lc-faq-icon::before { transform: translateY(7px); }
.lc-faq-icon::after { transform: rotate(90deg) translateY(-7px); transition: transform var(--t-quick) var(--ease); }
.lc-faq-toggle[aria-expanded="true"] .lc-faq-icon::after { transform: rotate(0) translateY(-7px); }
.lc-faq-panel { padding: 0 0 24px; }
.lc-faq-panel p { font-size: var(--fs-15); line-height: 1.85; color: var(--text-on-dark-readable); max-width: 720px; }
@media (prefers-reduced-motion: reduce) { .lc-faq-icon::after { transition: none !important; } }

.lc-inquiry-section { position: relative; padding: var(--lc-section-gap) clamp(24px, 5vw, 64px); background: var(--ink-4); color: var(--cream-1); overflow: hidden; }
.lc-inquiry-bg { position: absolute; inset: 0; z-index: 0; }
.lc-inquiry-bg img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.20) saturate(0.50); }
.lc-inquiry-content { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; text-align: center; }
.lc-inquiry-h2 { font-family: var(--font-serif); font-size: clamp(32px, 4vw, 56px); font-weight: 300; line-height: 1.10; color: var(--cream-1); margin: 16px 0 24px; }
.lc-inquiry-pitch { font-size: var(--fs-15); line-height: 1.85; color: var(--text-on-dark-readable); margin-bottom: 40px; }
.lc-inquiry-ctas { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-bottom: 40px; }
.lc-btn--proposal { background: transparent; color: var(--gold); border: 1px dashed var(--gold-line); }
.lc-btn--proposal:hover { background: rgba(196, 163, 90, 0.10); border-style: solid; }
.lc-btn--text { background: transparent; color: var(--cream-1); border: none; text-decoration: underline; text-underline-offset: 6px; text-decoration-color: var(--gold); }
.lc-btn--text:hover { color: var(--gold); }

.lc-inquiry-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 0; margin-top: 24px; }
.lc-inquiry-meta-cell { padding: 0 24px; border-right: 1px solid rgba(196, 163, 90, 0.32); }
.lc-inquiry-meta-cell:last-child { border-right: none; }
.lc-inquiry-meta dt { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold); margin-bottom: 4px; }
.lc-inquiry-meta dd { font-size: var(--fs-13); color: var(--cream-1); }

.site-footer { padding: clamp(64px, 8vw, 120px) clamp(24px, 5vw, 64px) 48px; background: var(--ink-4); color: var(--text-on-dark-readable); }
.site-footer__tag { font-family: var(--font-serif); font-style: italic; font-size: clamp(20px, 2.4vw, 28px); font-weight: 300; color: var(--cream-1); text-align: center; margin-bottom: 64px; }
.site-footer__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 48px; max-width: 1240px; margin: 0 auto 64px; }
.footer-col__title { font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; }
.footer-col ul { list-style: none; padding: 0; }
.footer-col li { margin-bottom: 8px; }
.footer-col a { color: var(--cream-1); text-decoration: none; font-size: var(--fs-13); transition: color var(--t-quick) var(--ease); }
.footer-col a:hover { color: var(--gold); }
.site-footer__base { max-width: 1240px; margin: 0 auto; padding-top: 32px; border-top: 1px solid rgba(196, 163, 90, 0.18); display: grid; gap: 24px; }
.site-footer__copyright { font-size: var(--fs-10); font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-on-dark-readable); text-align: center; }
```

**Required JS:**

```js
// FAQ accordion toggles
document.querySelectorAll('.lc-faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    const panelId = btn.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (panel) {
      if (expanded) panel.setAttribute('hidden', '');
      else panel.removeAttribute('hidden');
    }
  });
});
```

**Locked microcopy for sec8:** decisions #4, #17, #18, #19 from copy deck §1, plus full FAQ (copy deck §10), inquiry block (copy deck §11), footer (copy deck §12).

**A11y rules to satisfy:** Critical accordion pattern (button with `aria-expanded` + `aria-controls`, panel with `role="region"` + `hidden`), failure mode 4 (CTAs with focus rings, magnetic effect gated), failure mode 12 (lang switcher repeated in footer, Spanish link with `lang="es"`).

**Visibility-safe defaults:** FAQ panels are `hidden` by default (collapsed); JS-off users can still read questions and need to remove the `hidden` attribute manually OR Phase 4 may render the first 3 panels open by default. Inquiry CTAs are real anchors with mailto/wa.me hrefs that work without JS.

**Button color contracts:**
- `lc-btn--primary` (Begin Inquiry): gold fill, ink text, focus ring `--ink-1` (5.1:1 on gold).
- `lc-btn--proposal` (Check Proposal Availability): transparent fill, gold text, dashed gold border for visual differentiation; hover converts dashed to solid.
- `lc-btn--text` (WhatsApp the Studio): no border, gold underline only.
- All three CTAs satisfy the urgency-aware hierarchy: primary inquiry first, proposal-specific second (visually de-emphasized so it does not push proposal urgency on honeymoon/anniversary readers), conversational tertiary third.

---

## How Phase 4 will use these prompts

Each agent runs in parallel. Each produces a single section file. The Phase 4 integration agent assembles the eight outputs in order (sec1 → sec8) into `/couples-photography.html`, preserving the existing `<head>` SEO block verbatim per Phase 1 §12, hoisting any per-section `--lc-*` token declarations into `/styles/tokens.css` Wave 6.6, and de-duplicating shared utility classes (skip-link, lc-btn variants, lc-eyebrow, visually-hidden) into a single `<style>` block at the page level.

Phase 5 verification reads the a11y contract and runs each acceptance test against the integrated build. A build that fails any acceptance test cannot ship.

---

**End of Phase 3 Section Build Prompts (Locked).**

Word count: ~3,900 words across eight self-contained section prompts. Each prompt covers section name, output file, required HTML skeleton, required CSS classes, required JS, locked microcopy reference, a11y rules to satisfy, visibility-safe defaults, and button color contracts. Tokens consumed from `/styles/tokens.css` plus additive `--lc-*` Wave 6.6. All eight sections satisfy the same a11y contract and consume the same locked copy deck. Direction C (Minimalist Refined) is the locked visual register.
