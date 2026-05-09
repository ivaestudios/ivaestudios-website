# Wave 2C — Design Handoff Spec: index-preview-v2.html

**Skill applied:** `.claude-design-plugin/design-handoff.md`
**Date:** 2026-05-08
**Audience:** Claude Code (and human dev) implementing this against the live `/index.html` later

---

## Overview

The IVAE Studios homepage v2 is a single static HTML page. It loads `/styles/tokens.css` and `/dark-mode.css` and inlines page-specific CSS in a `<style>` block. The page is dark-by-default (matches the live site behavior — `js/dark-mode.js` adds `html.dark` before paint) but works on light mode with parity. Mobile-first responsive at 375 / 768 / 1200 / 1920.

Every meaningful component below references canonical tokens from `/styles/tokens.css`. No new CSS variables are inlined in `<style>:root`.

---

## Layout

### Grid system
- Page max-content-width: **1320px** (footer, portfolio), **1280px** (services, destinations, journal), **1180px** (stats-strip, how), **1100px** (pull-quote), **880px** (FAQ, CTA), **780px** (lead-section).
- Outer gutters: `var(--s-gutter)` = `clamp(24px, 5vw, 64px)`.
- Section vertical padding: `var(--s-section-y)` = `clamp(80px, 9vw, 140px)` (mid-page sections at 70–80% of this for v2 — see "Tightening").

### Breakpoints
| Breakpoint | Behavior |
|---|---|
| ≥ 1200px | Full editorial grid: portfolio 12-col, services 1.4:1:1, destinations 3-col, journal 1.6:1 |
| 900–1199px | Two-up layouts collapse to single column for headers; portfolio drops to 8-col |
| 521–899px | Mobile nav active; portfolio 6-col; services 2-col; destinations stack |
| ≤ 520px | Single-column everywhere; CTA buttons full-width; hero stats 3-up flexible |

---

## Design Tokens Used

All tokens from `/styles/tokens.css`. v2 references new tokens added in Wave 2C (see audit summary `wave-2c-skills-applied-summary.md` §2).

| Token | Value | Used For |
|---|---|---|
| `--ink-1` | #1a2230 | Primary dark surface (cards, hero text on gold buttons) |
| `--ink-3` | #0c1219 | Default page background (dark mode), section bg |
| `--ink-4` | #0a0f17 | Footer, CTA section, deepest dark surface |
| `--cream-1` | #faf8f5 | Light-mode page background, light section bg |
| `--cream-2` | #f3f1ec | "How it works" alternate light section |
| `--gold` | #c9a54e | Primary accent: italic emphasis, eyebrows, primary CTA bg |
| `--gold-deep` | #a8894a | Light-mode accent (better contrast on cream) |
| `--gold-hover` | #ceae64 | btn-gold hover background |
| `--gold-line` | rgba(201,165,78,0.28) | Hairline borders, dividers |
| `--gold-soft` | rgba(201,165,78,0.18) | FAQ open icon background, selection bg |
| `--text-on-dark` | #faf8f5 | H1, H2, H3 on dark |
| `--text-on-dark-2` | rgba(250,248,245,0.62) | Body text on dark (7.4:1 → AA pass) |
| `--text-on-dark-readable` | rgba(250,248,245,0.82) | Hero subhead body, pillar lede on dark image |
| `--text-on-dark-3` | rgba(250,248,245,0.34) | Decoration only (separator dots, hairlines). Never used for text in v2. |
| `--text-on-light` | #0e1620 | H2/H3/H4 on cream |
| `--text-on-light-2` | rgba(14,22,32,0.62) | Body text on cream (5.4:1 → AA pass) |
| `--text-on-light-readable` | rgba(14,22,32,0.78) | Pillar body / FAQ answer on cream |
| `--font-serif` | Cormorant Garamond | All H1–H4, italic accents, drop caps, blockquote |
| `--font-sans` | Syne | All eyebrows, CTAs, nav, body labels |
| `--fs-display` | clamp(48px, 8.5vw, 120px) | Hero H1 |
| `--s-1-5` | 6px | Image grid editorial seam (portfolio/services) |
| `--s-4 / --s-6 / --s-8 / --s-12` | 16/24/32/48px | Component padding rhythm |
| `--s-section-y` | clamp(80, 9vw, 140) | Section vertical padding |
| `--s-gutter` | clamp(24, 5vw, 64) | Section horizontal padding |
| `--ease` | cubic-bezier(.22,1,.36,1) | All editorial easing |
| `--ease-out` | cubic-bezier(.16,1,.3,1) | Word-reveal animations |
| `--t-fast / --t-med / --t-slow` | .25/.45/.9s | Hover and reveal timing |
| `--shadow-gold-sm / -lg` | 0 2px 16px / 0 6px 28px gold | btn-gold shadow lift |
| `--shadow-hero-text-scrim` | 0 0 80px 30px rgba(10,15,23,.55) | Hero subhead contrast helper |
| `--tracking-eyebrow-base` | 0.26em | Default eyebrow letter-spacing (capped) |
| `--tracking-eyebrow-wide` | 0.32em | Section eyebrows (was .42em in v1 → fixed) |
| `--hover-image-scale` | 1.045 | Canonical card image hover scale |
| `--touch-target-min` | 44px | All interactive minimum |
| `--focus-ring-on-gold` | 2px solid var(--ink-1) | btn-gold focus indicator |

---

## Components

### `header.site-header`
- Variants: default (transparent), `.scrolled` (blurred backdrop, +border-bottom).
- States: `transition: 0.6s var(--ease)` for height + bg + border.
- Persistent CTA "Reserve Session" (v2 keeps visible on desktop after scroll — fixes critique §2 Critical).
- Mobile: replaced by hamburger at ≤ 900px.
- Sticky bottom-bar mobile CTA (v2 new) at ≤ 520px shows "WhatsApp Vianey" pinned to bottom.
- A11y: `<nav aria-label="Main navigation">`, active link gets `aria-current="page"`.

### `.btn-gold` (Primary CTA)
| Property | Value |
|---|---|
| Padding | 18px 36px |
| Font | var(--font-sans) 10.5px / 500 / 0.26em tracking / uppercase |
| Bg | var(--gold) → var(--gold-hover) on hover |
| Color | var(--ink-1) (8.4:1 AA) |
| Shadow | var(--shadow-gold-sm) → var(--shadow-gold-lg) on hover |
| Transform | translateY(-1px) on hover |
| Focus ring | var(--focus-ring-on-gold) (ink ring on gold bg) |
| Min target | 44px tall (padding + line-height ensures) |

### `.btn-ghost` (Secondary CTA)
- Inline-link with hairline underline, scales hairline to gold on hover.
- States: default / hover (color → gold, underline scaleX(1.04)) / focus-visible (focus ring on dark).

### `.eyebrow`
- Pseudo-rule before the text (32px, gradient-out from gold).
- Letter-spacing: `var(--tracking-eyebrow-wide)` = 0.32em (was 0.42em on hero in v1, fixed to .32em uniformly).
- 10px, uppercase, weight 500.

### `.pillar` (4-up editorial conviction list)
- Grid: `120px 1fr 1.1fr` desktop / `60px 1fr` tablet / single column mobile.
- Number: italic Cormorant `var(--fs-44)`, gold-deep, with hairline underline beneath.
- Hover: subtle border-color shift on the divider.
- Pillar lede: italic Cormorant `var(--fs-18)`, ink (not muted).
- Pillar body: 15px / 1.78 line-height / `--text-on-light-readable` (78% alpha → 9.8:1 contrast).

### `.service` (image-as-card)
- Aspect: 4/5 default; first card `grid-row: span 2` for editorial breakout.
- Image filter: `saturate(.88) brightness(.78)` default → `saturate(1) brightness(.7)` hover.
- Description (`.service-desc`) is collapsed by default (max-height 0), expands on `:hover` AND `:focus-within`. v2 adds `@media (hover:none)` rule that shows description always at low opacity for touch devices (fixes critique Critical).
- A11y: each card is `<a>` with descriptive copy in heading; `aria-label` not needed because text is visible.

### `.pg-i` (portfolio tile)
- Variants: `.feat` (7×6), `.tall` (5×6), `.wide` (6×4), `.med` (6×4), `.sq` (4×4).
- Image filter same as service cards.
- Caption visible on `:hover` AND `@media (hover:none)` shows persistently at 70% opacity (fixes critique Critical).

### `.pq` (Pull-quote)
- `.pq-mark` quotation glyph: `clamp(120px, 12vw, 220px)`, opacity .08 (was 22vw / .1 in v1 — reduced per critique §3).
- Blockquote: italic Cormorant `clamp(28px, 3.4vw, 52px)`, weight 300.
- Attribution: `<cite>` semantic markup (was `<span>` in v1).

### `.fi` / `.fq` / `.fa` (FAQ)
- Single-pane accordion (only one open at a time).
- Question button is full-width, left-aligned, with circular `+` icon on the right.
- Icon button is 44×44 hit area (was 24×24 — fixed per a11y).
- Answer panel: `role="region"`, `aria-labelledby="fq-N"`.
- Question button: `aria-expanded` + `aria-controls="fa-N"`.

### `.cta-form` (Newsletter)
- Visually-hidden `<label for="newsletter-email">`.
- Placeholder is supplemental, not a label.
- Inline `<div role="alert">` for error messages, `<div role="status">` for success.
- Submit button: 44px tall, gold focus ring on dark bg.

### `footer.site-footer`
- 4-column grid on desktop (1.4 1 1 1), collapses to 2-col tablet, 1-col mobile.
- Footer-bottom meta uses `--text-on-dark-2` (7.4:1) — v1 used `--text-on-dark-3` (3.3:1, FAIL).

---

## States and Interactions

| Element | State | Behavior |
|---|---|---|
| `.btn-gold` | Hover | translateY(-1px), shadow lift, bg gold-hover, svg shifts +4px |
| `.btn-gold` | Focus-visible | 2px solid var(--ink-1), offset 3px |
| `.btn-gold` | Active | translateY(0), shadow reset |
| `.btn-ghost` | Hover | color → gold, underline scaleX(1.04), bg → gold |
| `.header-cta` | Hover | gold flood-fill from right (transform: scaleX(1)) |
| `.service` | Hover | image scales 1.045, brightness .7, desc expands, link gap +4px |
| `.service` | Focus-within | desc expands |
| `.service` | Touch (no hover) | desc visible at .7 opacity always |
| `.pg-i` | Hover | image scales 1.045, caption fades in |
| `.pg-i` | Touch | caption persistently visible at .8 opacity |
| `.fi` | Click question | Closes other open items, opens self, icon rotates 45deg → `+` becomes `×` |
| `.cta-form` | Submit (valid) | Replaces input with `role="status"` "Subscribed — first dispatch arrives soon." |
| `.cta-form` | Submit (invalid) | Inline `role="alert"` "Please enter a valid email address" |

---

## Responsive Behavior

| Breakpoint | Hero | Services | Portfolio | Pillars | Destinations | Footer |
|---|---|---|---|---|---|---|
| ≥ 1200 | h1 clamp(52, 9vw, 140) | 1.4:1:1, 1st card 2-row | 12-col / 80px rows | 3-col rows | 3-col grid | 4-col |
| 900–1199 | h1 clamp(46, 8.6vw, 108) | unchanged | 8-col, feat 8×5 | 2-col rows | 3-col grid | 4-col |
| 521–899 | h1 clamp(40, 8vw, 80) | 2-col, 1st spans 2 | 6-col, smaller rows | 60px num + body | stacked | 2-col |
| ≤ 520 | h1 clamp(40, 11vw, 56) | 1-col | scaled rows | 1-col stack | 1-col | 1-col |

---

## Edge Cases

- **Empty journal entries:** if blog has < 3 posts, `.journal-list` falls back to a single-column "More on the journal" link.
- **Long international names** (Spanish translation of CTA "Reserve a session" can run +30%): all CTAs have `min-width` not fixed `width`; `.btn-gold` flexes via padding only; `.btn-ghost` underline grows with text. Tested: Spanish "Reserva tu sesión" fits within the same gold button at 320px.
- **Slow connections / image failure:** `<picture>` with AVIF → WebP → JPG fallback. Each `<img>` has explicit `width` / `height` to reserve layout space (CLS = 0).
- **Reduced-motion users:** all animations and Ken Burns hero zoom disabled; reveal-on-scroll classes set to final state immediately.
- **No-JS users:** server-rendered content visible (every `.rv` element has `opacity:1` initially fallback when `<noscript>` present — and our IntersectionObserver gracefully degrades). FAQ accordion would not toggle, so v2 nests FAQ answers as `<details><summary>` to ensure non-JS keyboard accessibility (advisory; not yet implemented in this preview pass — left as Wave 3 follow-up).

---

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Hero bg | Page load | Ken Burns scale 1.08 → 1.16 | 26s | ease-in-out infinite alternate |
| Hero h1 words | Page load + 240ms | translateY(110%) → 0 word by word | 1s | --ease-out |
| Hero subhead | Page load + delay-2 | opacity 0→1, translateY 28→0 | .9s | --ease |
| .rv on scroll | IntersectionObserver | opacity 0→1, translateY 28→0 | .9s | --ease |
| .rv-clip | Same | clip-path inset(0 0 100% 0) → 0 | 1.4s | --ease-smooth |
| .rv-scale | Same | opacity 0→1, scale .97→1 | 1.1s | --ease |
| Card image hover | :hover | transform scale 1.045, brightness lift | 1.4s | --ease |
| Stats numerals | IntersectionObserver | count 0 → target | 1.3–2s | cubic ease-out |
| Header bg | scroll > 60px | bg + blur + height | .6s | --ease |
| FAQ icon | click | rotate 0 → 45deg | .45s | --ease |
| Hero parallax | scroll | translate3d(0, scrollY*0.28, 0) | rAF-throttled | linear |

All disabled under `prefers-reduced-motion`.

---

## Accessibility Notes

(See full audit in `wave-2c-accessibility-report.md`.)

- Focus order: top-down DOM order, no tabindex overrides.
- All H1 → H2 → H3 ordering preserved; one H1 per page.
- ARIA: nav landmark, region landmarks where appropriate, current-page on home.
- Touch: every interactive element ≥ 44×44.
- Contrast: every text/bg pair audited and passing WCAG 2.1 AA.

---

## SEO / Meta

(See full meta in `index-preview-v2.html` `<head>`. Identical to live `/index.html` except for `noindex,nofollow` robots and the addition of `wave-2c` comment markers.)

- `<title>`, all OG, Twitter, AI meta, `msvalidate.01`, hreflang alternates: PRESERVED VERBATIM
- `<link rel="canonical" href="https://ivaestudios.com/">`: PRESERVED (points to live homepage)
- `<script type="application/ld+json">`: PRESERVED BYTE-FOR-BYTE
- `<meta name="robots" content="noindex, nofollow">`: ADDED (preview only)
