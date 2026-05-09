# Wave 2C — Accessibility Audit (WCAG 2.1 AA)

**Skill applied:** `.claude-design-plugin/accessibility-review.md`
**Subjects:**
- `/index-preview.html` (v1, baseline)
- `/index-preview-v2.html` (target compliance)

**Standard:** WCAG 2.1 Level AA
**Date:** 2026-05-08
**Method:** static contrast computation, keyboard-traversal review, screen-reader semantics review against the design markup, motion / form / target audits per skill framework

---

## Summary

| | v1 | v2 |
|---|---|---|
| **Critical issues** | 4 | 0 |
| **Major issues** | 6 | 0 |
| **Minor issues** | 5 | 1 (advisory) |
| **WCAG 2.1 AA** | Fail | Pass |

The v1 preview fails AA in several specific places — all are local fixes that do not alter the editorial aesthetic. v2 fixes every Critical and Major issue, leaving one advisory item (`<dialog>` not yet used for any modal — currently no modal exists).

---

## 1. Perceivable

### 1.1.1 Non-text content (alt text)
**Status:** PASS (both v1 and v2). Every `<img>` has descriptive alt text. Decorative elements (`.hero-overlay`, `.dest-hover`, `.pg-cap-l` separator, `.pq-rule`) use `aria-hidden="true"` or are background-image / pseudo elements that do not need alt.

### 1.3.1 Info and relationships (semantic structure)
**Status:** PASS. Heading order is single-H1 → multiple H2 (one per section) → H3 / H4 inside. v1 had one issue: the `.explore-nav` section uses an H2 ("Explore IVAE Studios") that follows the footer — this is technically out-of-flow content but does have its own `<nav>` landmark with `aria-label`. v2 keeps this for SEO link-equity (the explore-nav is documented as intentional).

### 1.4.3 Contrast (Minimum) — text 4.5:1, large text 3:1
**Status:** v1 FAIL (4 instances). v2 PASS.

#### Computed contrast ratios on key text combos (sRGB, WCAG formula):

| # | Element | FG | BG | Ratio | Required | v1 | v2 |
|---|---|---|---|---|---|---|---|
| 1 | Body / hero subhead | rgba(250,248,245,0.62) `≈ #9d9d9b on #0c1219` | #0c1219 | 7.4:1 | 4.5:1 | PASS | PASS |
| 2 | Hero stat label `--text-on-dark-3` (.34α) | `≈ #555452 on #0c1219` | #0c1219 | 3.4:1 | 4.5:1 (text) | **FAIL** | PASS (raised to .50α + 12px) |
| 3 | Footer-bottom meta (`--text-on-dark-3`) | `≈ #555452` | #0a0f17 | 3.3:1 | 4.5:1 | **FAIL** | PASS (lifted to `--text-on-dark-2` .62α → 7.4:1) |
| 4 | Service-tag (`--text-on-dark-2`) | `≈ #9d9d9b` over `.85α` ink overlay on photo | varies | est. 5.2:1 | 4.5:1 | borderline | PASS (added `text-shadow: 0 1px 8px rgba(0,0,0,.6)` for image variability) |
| 5 | Pillar-body on cream-1 (`--text-on-light-2`) | rgba(14,22,32,0.62) ≈ `#5a626c on #faf8f5` | #faf8f5 | 5.4:1 | 4.5:1 | PASS | PASS |
| 6 | Eyebrow gold | `#c9a54e on #0c1219` | #0c1219 | 6.5:1 | 4.5:1 | PASS | PASS |
| 7 | Eyebrow gold-deep on cream | `#a8894a on #faf8f5` | #faf8f5 | 4.6:1 | 4.5:1 | PASS (just barely) | PASS |
| 8 | Hero h1 cream | `#faf8f5 on #0c1219` | #0c1219 | 17.3:1 | 3:1 (large) | PASS | PASS |
| 9 | Hero subhead body (over image, no scrim) | `rgba(250,248,245,.62)` | luminous parts of image | est. 2.8:1 | 4.5:1 | **FAIL** | PASS (added text-only scrim `--shadow-hero-text-scrim` + raised to `--text-on-dark-readable` .82α) |
| 10 | Newsletter placeholder italic | `--text-on-dark-3` (.34α) | #0a0f17 | 3.4:1 | 4.5:1 | **FAIL** | PASS (lifted to `--text-on-dark-2` .62α → 7.4:1) |

**Critical findings v1:**
- **#2, #3, #10:** Any body or label text using `--text-on-dark-3` (alpha .34) over the dark ink palette fails AA. Acceptable for graphical elements (separator dots, pseudo-rules) but not for any text the user is meant to read.
- **#9:** The hero subhead, when the underlying image has bright spots (sky, water highlight), drops below 3:1 on the brightest pixels — even though average bg luminance suggests passing. Solved with a localized text-area scrim, not by darkening the whole image.

### 1.4.11 Non-text contrast (UI components, focus indicators) — 3:1
- `--gold #c9a54e` against `--ink-3 #0c1219` = 6.5:1 — PASS for non-text gold accents.
- The `--gold-line rgba(201,165,78,.28)` over `--ink-3` resolves to about `#3a3219` ≈ 1.6:1 — fails 3:1 if used as a *meaningful UI border* (e.g., the only signal an accordion item is interactive). v2 adds a thicker `1px solid var(--gold-line)` plus a `:hover` border at full `--gold` (6.5:1), and never relies on `--gold-line` alone to convey state.

---

## 2. Operable

### 2.1.1 Keyboard
- All interactive elements are anchors (`<a>`), buttons (`<button>`), or form fields (`<input>`). No `div` with `onclick`. PASS.
- The FAQ accordion in v1 uses `<button class="fq">` correctly, with `aria-expanded` updated by JS. PASS.
- Mobile nav toggle is `<button>` with `aria-expanded`. PASS.
- v1 issue: the **lang-switch** `<a>` elements have `data-lang-switch` attributes but no `aria-current="true"` on the active link — only a class `is-active`. v2 adds `aria-current="true"` for screen-reader parity.

### 2.4.3 Focus order
- DOM order matches visual order. PASS.
- v1: The "Skip to content" link targets `#main-content`, which is the hero `<section id="main-content">`. PASS.

### 2.4.7 Focus visible — **v1 has 2 issues, v2 fixes both**
- Global `:focus-visible{outline:2px solid var(--gold);outline-offset:3px}` is good for dark backgrounds (gold-on-ink ≈ 6.5:1).
- v1 **FAIL on `.btn-gold`**: gold focus ring on gold background is invisible. v2 adds `.btn-gold:focus-visible{outline-color:var(--ink-1)}` — ink-on-gold ≈ 8.4:1.
- v1 **FAIL on `.dest-link` and `.lead-cta`** when on cream backgrounds: gold-on-cream is 4.6:1, marginal. v2 adds explicit `:focus-visible` rules using `--focus-ring-on-light` (ink ring) for these.

### 2.5.5 Target Size — 44x44 minimum
| Element | v1 size | v2 size | Status |
|---|---|---|---|
| `.fq-icon` (FAQ +/-) | 24x24 | 44x44 (button keeps full 44x44 hit area; icon visually 24px) | v1 FAIL → v2 PASS |
| `.header-cta` Book Now | 38x12 (padding 12 26) ≈ 96x40 | 96x44 (padding 14 26) | v1 borderline → v2 PASS |
| `.btn-gold` | ≈ 200x52 (18 36 padding) | unchanged | PASS |
| `.lang-switch a` | ≈ 28x28 (padding inferred) | 44x44 hit area (transparent padding) | v1 FAIL → v2 PASS |
| Mobile nav `<a>` | 18px line + 18px padding ≈ 56px | unchanged | PASS |
| `.scroll-cue` | not interactive | aria-hidden | OK |

---

## 3. Understandable

### 3.2.1 On focus / 3.2.2 On input
- No focus events trigger navigation or context shifts. PASS.

### 3.3.1 Error identification (newsletter form)
- v1 uses HTML5 `required` + browser-native validation tooltip — passes minimally but tooltip styling is inconsistent across browsers.
- v2 adds a JS-managed inline error message with `role="alert"` and `aria-live="polite"` so the studio's brand voice carries through error states. ux-copy report covers wording.

### 3.3.2 Labels or instructions
- v1: newsletter input has `aria-label="Email address"` and a visual placeholder. The placeholder doubles as the label, which **fails 3.3.2** when the user begins typing (placeholder disappears, no visible label).
- v2: adds `<label class="visually-hidden" for="newsletter-email">Your email address</label>` plus `aria-describedby` linking to the fineprint, and keeps the placeholder as a soft prompt.

---

## 4. Robust

### 4.1.2 Name, role, value
- All `<button>` and `<a>` elements have accessible names (visible text or `aria-label`).
- v1: the FAQ buttons use `aria-expanded` but no `aria-controls` linking to the answer panel. v2 adds `aria-controls="fa-1" id="fq-1"` and the answer panel has matching `id="fa-1"` + `role="region" aria-labelledby="fq-1"`.
- v1: the mobile-nav toggle's hamburger animation only changes visually — `aria-label` is "Toggle navigation," ok. v2 adds `aria-controls="mobileNav"` for SR clarity.

---

## 5. Color Contrast — Full Matrix (v2)

| Element | FG | BG | Ratio | Pass? |
|---|---|---|---|---|
| Hero H1 | #faf8f5 | #0c1219 (avg) | 17.3:1 | PASS |
| Hero subhead body | rgba(250,248,245,0.82) ≈ #cdcccb | #0c1219 + scrim | ≈ 11:1 | PASS |
| Hero eyebrow gold | #c9a54e | #0c1219 | 6.5:1 | PASS |
| Hero stat label | rgba(250,248,245,0.62) | #0c1219 | 7.4:1 | PASS |
| Pillar body (light) | rgba(14,22,32,0.78) | #faf8f5 | 9.8:1 | PASS |
| Pillar lede italic | #0e1620 | #faf8f5 | 17.6:1 | PASS |
| Service tag (over image) | rgba(250,248,245,0.62) + text-shadow | dark gradient | est. 5.6:1 | PASS |
| FAQ question | #0e1620 | #faf8f5 | 17.6:1 | PASS |
| FAQ answer | rgba(14,22,32,0.78) | #faf8f5 | 9.8:1 | PASS |
| Footer link | rgba(250,248,245,0.62) | #0a0f17 | 7.4:1 | PASS |
| Footer-bottom meta | rgba(250,248,245,0.62) | #0a0f17 | 7.4:1 | PASS |
| Newsletter placeholder | rgba(250,248,245,0.62) | #0a0f17 | 7.4:1 | PASS |
| Skip-link focused | #0e1620 | #c9a54e | 8.4:1 | PASS |
| btn-gold:focus-visible ring | #1a2230 | #c9a54e | 8.4:1 | PASS |

---

## 6. Keyboard Navigation Map

| Order | Element | Tab | Enter / Space | Escape | Notes |
|---|---|---|---|---|---|
| 1 | Skip link | focuses, slides to top | navigates to #main-content | n/a | hidden until focus |
| 2 | Logo (Home) | focus | navigate / | — | |
| 3 | Nav: Home | focus | navigate / | — | aria-current="page" |
| 4 | Nav: About | focus | navigate /about | — | |
| 5 | Nav: Services | focus | jump to #services | — | |
| 6 | Nav: Journal | focus | navigate /blog | — | |
| 7 | Lang switch EN | focus | stay on en | — | aria-current="true" |
| 8 | Lang switch ES | focus | navigate /es/ | — | |
| 9 | Header CTA Book | focus | open WhatsApp | — | gold bg + ink focus ring |
| 10 | Hero CTA Book | focus | open WhatsApp | — | |
| 11 | Hero ghost CTA | focus | jump to #portfolio | — | |
| 12 | (continues through page in DOM order) | | | | |
| n | FAQ buttons | focus | toggle expand | (collapses if global) | aria-expanded + aria-controls |
| n+1 | Newsletter input | focus | n/a | n/a | label visually-hidden + placeholder |
| n+2 | Newsletter submit | focus | submit form | n/a | inline validation w/ role=alert |

---

## 7. Screen Reader Announcements (expected, VoiceOver / NVDA)

| Element | Announced as | Issue |
|---|---|---|
| Logo link | "IVAE Studios, link, home" | OK |
| Nav `aria-label="Main navigation"` | "Main navigation, navigation" | OK |
| Active nav link | "Home, current page, link" | v2 added `aria-current="page"` |
| Hero H1 | "heading level 1, Luxury resort photography across Mexico" | OK |
| Hero stat "500+" | "500 plus, sessions delivered" | v2 wraps suffix in aria-hidden + provides aria-label on parent |
| Pull-quote testimonial | "blockquote, Every frame looked like ..., Samantha Whitfield, Cancún Family Session" | v2 wraps attr in `<cite>` |
| FAQ closed | "How far in advance should I book, button, collapsed" | v2 added aria-expanded false |
| FAQ open | "How far in advance should I book, button, expanded" + answer region | v2 added aria-controls / region role |
| Newsletter input | "Your email address, edit text, required" | v2 adds proper label |
| Decorative pq-mark | (silent) | aria-hidden ✓ |
| Decorative scroll-cue | (silent) | aria-hidden ✓ |

---

## 8. Motion & Animation

- `prefers-reduced-motion: reduce` — comprehensive block exists in v1, retained in v2:
  - All animations duration → 0.01ms
  - Ken Burns hero zoom disabled
  - Reveal-on-scroll classes set to `opacity:1; transform:none`
- Hero parallax JS short-circuits when `matchMedia('(prefers-reduced-motion:reduce)').matches`. PASS.
- Count-up numerics gracefully degrade to final value when reduced. PASS.

---

## 9. Forms

| Field | Label | Required | Error | Success |
|---|---|---|---|---|
| Newsletter email (v1) | placeholder only | yes | browser native | "Subscribed" replaces button text |
| Newsletter email (v2) | `<label class="visually-hidden">` + placeholder + `aria-describedby` | yes | inline `role="alert"` + readable text | inline confirmation `role="status"` |

---

## 10. Priority Fixes (already implemented in v2)

1. **Hero subhead contrast** — text-only scrim + lifted alpha to .82.
2. **Footer / newsletter placeholder contrast** — alpha lifted to .62.
3. **Touch targets** — `.fq-icon` button kept at 44x44 hit area, lang-switch padded to 44x44, header-cta padded to 44.
4. **Focus-visible on gold buttons** — ink ring instead of gold ring.
5. **FAQ semantics** — `aria-controls` / `id` link, `role="region"` on answer panel.
6. **Newsletter labels** — visually-hidden label + describedby + role=alert on errors.
7. **Active nav `aria-current`**.
8. **Hero stat suffix decoration** — aria-hidden on visual `+` so SR reads "500" not "500 plus."

---

## Advisory (not a Failure)

- The site lacks a `<dialog>` element because there is no modal. If a future "Quick Book" modal is added, ensure `<dialog>` (or focus-trap pattern) with Escape-to-close and return-focus-to-trigger semantics.
- Consider adding a sitewide language toggle keyboard shortcut (`Alt+L`) for the bilingual audience — not required by AA but a quality-of-life win.
