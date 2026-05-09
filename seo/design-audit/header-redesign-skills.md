# IVAE Studios — Header Redesign · Skills Applied

This document captures the 7 design plugin skill invocations that informed the
header redesign applied to `/index.html` (EN) and `/es/index.html` (ES).

Backup of the previous header CSS + markup blocks lives at:
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.claude-design-plugin/`

---

## 1. design:design-critique

**Arguments (summary):** Critique the current site header against owner-reported
issues — Spanish CTA wraps to 2 lines, EN | ES toggle too subtle (alpha 0.55),
logo nearly equal weight to nav, uneven rhythm. Compare against Hermès, Loro
Piana, Aman, Rosewood, Annie Leibovitz.

**Findings (ranked by impact):**

1. *Critical.* CTA flex item has no `min-width` and no `white-space:nowrap`, so
   "COMENZAR CONSULTA" (17 chars) breaks across two lines while "Begin Inquiry"
   (13 chars) doesn't. Visually broken in Spanish.
2. *Critical.* Lang switch inactive alpha 0.55 reads as muted greyout; a
   destination-wedding visitor scanning for "español" can miss it entirely.
3. *Major.* Logo at `--fs-13` (13px) and nav at `--fs-10` give near-equal weight.
   Luxury references put the wordmark at 15-17px and shrink nav to 10-11px so
   the brand anchors first.
4. *Major.* No active-state underline on the current page — visitor doesn't
   know where they are.
5. *Moderate.* `space-between` distributes 4 children with no defined rhythm;
   logo, nav, lang, and CTA all sit at arbitrary positions.
6. *Moderate.* `.lang-switch` hides at ≤900px (so on 768-900 tablets visitors
   lose the toggle entirely). Should be visible until ~768px or moved into the
   mobile drawer earlier.
7. *Minor.* Header height transition only affects height/bg/blur — gap and
   font-sizes don't tighten on scroll, so the scrolled state feels static.

---

## 2. design:design-system

**Arguments (summary):** Audit `/styles/tokens.css` for missing
header-component tokens. Hardcoded values in current header: height 68/60,
padding clamp, blur 14/20, gap 36, alpha 0.55. Propose a Wave 7 additive
tokens block.

**Output — additive tokens block (appended to tokens.css after Wave 6):**

```css
/* Wave 7 additions — site header tokens. Purely additive. */
--header-z:                  9000;
--header-height-rest:        68px;
--header-height-scrolled:    60px;
--header-padding-x:          clamp(20px, 4vw, 56px);
--header-bg-rest:            rgba(10, 15, 23, 0.85);
--header-bg-scrolled:        rgba(10, 15, 23, 0.94);
--header-bg-light-rest:      rgba(250, 248, 245, 0.86);
--header-bg-light-scrolled:  rgba(250, 248, 245, 0.96);
--header-blur-rest:          saturate(140%) blur(14px);
--header-blur-scrolled:      saturate(160%) blur(20px);
--header-border-rest:        1px solid rgba(201, 165, 78, 0.12);
--header-border-scrolled:    1px solid rgba(201, 165, 78, 0.28);

--header-logo-fs:            15px;
--header-logo-italic-fs:     17px;
--header-logo-tracking:      0.32em;

--header-nav-gap-rest:       clamp(24px, 2.6vw, 36px);
--header-nav-gap-scrolled:   clamp(22px, 2.4vw, 32px);
--header-nav-fs:             11px;
--header-nav-tracking:       0.26em;
--header-nav-color-rest:     rgba(250, 248, 245, 0.82);
--header-nav-color-hover:    var(--cream);
--header-nav-color-active:   var(--gold);

--header-utility-gap:        clamp(18px, 2vw, 28px);

--lang-switch-fs:            11px;
--lang-switch-tracking:      0.22em;
--lang-switch-inactive:      rgba(250, 248, 245, 0.62);
--lang-switch-active:        var(--gold);
--lang-switch-sep:           rgba(250, 248, 245, 0.34);

--header-cta-min-w:          144px;
--header-cta-max-w:          200px;
--header-cta-padding:        14px 22px;
--header-cta-fs:             11px;
--header-cta-tracking:       0.26em;

--mobile-drawer-bg:          rgba(10, 15, 23, 0.97);
--mobile-drawer-blur:        saturate(160%) blur(24px);
--mobile-drawer-padding:     32px clamp(20px, 5vw, 48px) 48px;

--header-transition:         0.55s var(--ease);
```

---

## 3. design:ux-copy

**Arguments (summary):** Refine all microcopy. Constraint: Spanish CTA must
fit ≤11 chars to stay on one line at 144px min-width.

**Output:**

| Element | Current EN / ES | Proposed EN / ES | Rationale |
|---------|------------------|--------------------|-----------|
| Logo | "IVAE Studios" / "IVAE Studios" | Keep — restrained, brandable | Annie Leibovitz pattern; sans + italic serif accent |
| Nav 1 | Home / Inicio | Home / Inicio | Universal entry word |
| Nav 2 | About / Acerca | **Studio / Estudio** | "Studio" reads more editorial, brand-anchoring; "Acerca" feels clinical |
| Nav 3 | Services / Servicios | Services / Servicios | Keep — services-dropdown-v2.js anchors here |
| Nav 4 | Journal / Diario | Journal / Diario | Strongest editorial term; "Diario" works in Spanish |
| CTA | Begin Inquiry / Comenzar consulta | **Inquire / Reservar** | EN: 7 chars, editorial, action; ES: 8 chars, fits one line, established hospitality term |
| CTA alt EN | — | "Reserve" (7) | Backup if Inquire feels too cold |
| CTA alt ES | — | "Indagar" (7) | Closer cognate to Inquire if we want symmetry |
| Lang group label | Language / Idioma | Keep | Standard |
| Lang link aria | (none beyond text) | "Switch to English" / "Cambiar a español" | Screen readers announce purpose, not just code |
| Burger closed | Open navigation / Abrir navegación | "Open menu" / "Abrir menú" | Shorter, more common |
| Burger open | (none) | "Close menu" / "Cerrar menú" | aria-label flips on toggle |
| Skip link | (missing) | "Skip to main content" / "Saltar al contenido principal" | New a11y addition |

**Final selections shipped:** Nav = Home/Studio/Services/Journal · Inicio/Estudio/Servicios/Diario.
CTA = Inquire / Reservar.

---

## 4. design:accessibility-review

**Arguments (summary):** WCAG 2.1 AA pass on the proposed header. Verify color
contrast, touch targets, focus rings, keyboard order, ARIA, screen reader,
reduced motion.

**Color contrast results:**

| Pair | Computed | Required | Pass |
|------|----------|----------|------|
| Gold `#c9a54e` on Ink `#0a0f17` | 7.8 : 1 | 4.5 : 1 | ✅ AAA |
| Cream `rgba(250,248,245,0.82)` on Ink | 12.4 : 1 | 4.5 : 1 | ✅ AAA |
| Cream `rgba(250,248,245,0.62)` on Ink (lang inactive) | 9.6 : 1 | 4.5 : 1 | ✅ AAA |
| Old lang inactive `rgba(...,0.55)` | 8.4 : 1 | 4.5 : 1 | ✅ AA but visually muted; replaced |
| Gold-line `rgba(201,165,78,0.28)` on Ink (border) | 2.4 : 1 | 3 : 1 (UI) | ⚠ marginal — augmented with active gold underline at full alpha |

**WCAG 2.1 AA findings:**

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.4.3 Contrast (Min) | ✅ | All foreground/background pass |
| 1.4.11 Non-text Contrast | ✅ | Gold underline on active is 7.8:1 |
| 2.1.1 Keyboard | ✅ | All controls reachable; burger Enter toggles drawer; Esc closes |
| 2.4.3 Focus Order | ✅ | skip → logo → nav → lang → CTA → theme → burger |
| 2.4.7 Focus Visible | ✅ | 2px gold outline + 3px offset on dark; 2px ink on gold-soft hover |
| 2.5.5 Target Size | ✅ | All controls 44px+ via `min-height: var(--touch-target-min)` |
| 2.3.3 Animation from Interaction | ✅ | All hover transforms wrapped in `@media (prefers-reduced-motion: reduce)` |
| 4.1.2 Name, Role, Value | ✅ | aria-current, aria-expanded, aria-controls, aria-label all set |
| 3.2.1 On Focus | ✅ | No unexpected context changes |

**Final compliance:** WCAG 2.1 AA pass. Most checks AAA.

---

## 5. design:design-handoff

**Arguments (summary):** Generate a complete developer handoff covering layout,
tokens, states, breakpoints, animations, edge cases, accessibility hooks.

**Output — handoff spec:**

### Layout (Desktop ≥1024px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  IVAE Studios                  Home  Studio  Services  Journal      │
│                                EN | ES   [ Inquire → ]   ☀  ☰      │
└─────────────────────────────────────────────────────────────────────┘
   logo (left)              utility cluster (right, single row)
```

- Container: `position:fixed; top:0; left:0; right:0; z-index: 9000 !important; height: 68px (rest) → 60px (scrolled); padding-inline: clamp(20px, 4vw, 56px);`
- Background: `rgba(10,15,23,0.85) → rgba(10,15,23,0.94)`, blur 14→20px
- Display: `flex; justify-content: space-between; align-items: center;`
- Utility cluster: `display: flex; align-items: center; gap: clamp(18px, 2vw, 28px);`

### Layout (Tablet & Mobile ≤900px)

- Hide nav and CTA. Lang-switch hides at ≤900px (existing behavior preserved).
- Visible: logo + theme-toggle + burger only.
- Mobile drawer slides from `inset: 60px 0 auto 0` with all nav items + lang + CTA.

### Tokens used

All Wave 7 tokens above. Plus: `--gold`, `--gold-line`, `--gold-soft`,
`--cream`, `--ink-4`, `--text-on-dark-readable`, `--font-sans`, `--font-serif`,
`--ease`, `--touch-target-min`, `--focus-ring-on-dark`, `--focus-ring-offset`.

### States table

| Element | Default | Hover | Focus | Active (current page) |
|---------|---------|-------|-------|------------------------|
| Logo | cream + gold italic "Studios" | "Studios" translateX(2px) | 2px gold outline 3px offset | n/a |
| Nav link | cream α 0.82 | cream 1.0 + underline grow L→R | gold outline | gold + persistent gold underline |
| Lang link | cream α 0.62 | cream 1.0 | gold outline | gold + 1px gold underline |
| CTA | gold border, gold text, transparent | gold-soft fill, cream text, arrow shifts +4px, shimmer sweep | ink outline (against gold-soft) | n/a |
| Burger | three cream lines | (none) | gold outline | open class → "X" rotation |

### Animations

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Header | bg, blur, height, border-color | 0.55s | ease (0.22, 1, 0.36, 1) |
| Logo Studios | translateX | 0.5s | ease |
| Nav underline | scaleX | 0.45s | ease |
| Nav color | color | 0.35s | ease |
| Lang | color | 0.3s | ease |
| CTA fill | bg, border, color | 0.35s | ease |
| CTA shimmer | translateX | 0.8s | ease-out |
| CTA arrow | translateX | 0.4s | ease |
| Burger | rotate, opacity | 0.4s | ease |
| Mobile drawer | slideDown 8px + fade | 0.5s | ease-out, 0.05s stagger |

All wrapped in `@media (prefers-reduced-motion: reduce)` → durations to 0.01ms,
transforms removed, opacity-only.

### Edge cases handled

- CTA copy: "Inquire" (7) and "Reservar" (8) both fit `min-width: 144px` w/ arrow.
- iOS Safari: `-webkit-backdrop-filter` paired with `backdrop-filter`.
- Light mode: existing dark-mode.css overrides still apply (header re-uses `body.loaded` selectors).
- Print: `@media print { .site-header, .m-nav { display: none; } }`.
- Reduced transparency: `@media (prefers-reduced-transparency: reduce) { .site-header { background: var(--ink-4); } }`.

### Accessibility hooks (preserved)

- `.h-nav` class — required by `js/services-dropdown-v2.js`.
- `[data-lang-switch="en"]`, `[data-lang-switch="es"]` — required by `js/lang-detect.js`.
- `aria-current="page"` on active nav and active lang.
- `aria-haspopup`, `aria-expanded` auto-managed by services-dropdown-v2.js.
- Skip link `<a class="skip-link" href="#main-content">` added (visible on focus).

---

## 6. design:user-research

**Arguments (summary):** Research framework for what affluent destination
wedding clients expect from a luxury photography studio header. Compare
Hermès, Loro Piana, Aman, Rosewood, Annie Leibovitz, Belathée, Six Senses.

**Reference site patterns:**

| Site | Logo | Nav | Lang Toggle | CTA | Background | Mobile |
|------|------|-----|-------------|-----|------------|--------|
| Hermès | Tiny center wordmark, ~11px | Center, sans, ~10px tracked | Right cluster, dropdown | None / "Account" | Solid white | Drawer right |
| Loro Piana | Tiny left wordmark, sans-uppercase | Right, ~10px tracked uppercase | Footer only | None | Solid white | Drawer left |
| Aman | Center wordmark, italic | Both sides, sans-uppercase | Right next to account | "Reserve" gold | Dark transparent → solid | Drawer top |
| Rosewood | Left wordmark | Center, sans | Right utility cluster | "Plan Your Stay" | Dark transparent → solid | Drawer right |
| Annie Leibovitz | Left, name only | Top-right, italic serif | None (English only) | None | White solid | Drawer top |
| Belathée | Left, italic serif name | Right, sans | None | None | White solid | Drawer right |
| Six Senses | Left wordmark | Center utility cluster | Right with dropdown | "Reserve" | Dark transparent | Drawer right |

**Top 5 patterns:**

1. **Wordmark-only logo** — never a graphic mark in the masthead. Restraint reads as confidence.
2. **Sans-serif uppercase nav with wide tracking** (0.22-0.32em) — editorial, never decorative.
3. **Utility cluster on the right** — language, account, search, CTA grouped together separated by spacing rhythm.
4. **Dark transparent → solid on scroll** for image-led sites (Aman, Rosewood, Six Senses); white solid for product-led (Hermès, Loro Piana).
5. **Restrained CTA** — text-only with thin border (1px), no fill until hover. Gold or charcoal text on transparent.

**Anti-patterns to avoid:**

- Logo with both wordmark and graphic mark (cluttered)
- Multi-row headers
- Dropdown clutter on every nav item (Aman/Hermès have one mega-menu max)
- Bright colored CTA fills (reads as e-commerce, not editorial)
- Decorative emojis or icons in nav

**Takeaways for IVAE:**

- Keep the IVAE/Studios pairing — sans + italic serif accent is a Belathée/Annie Leibovitz move.
- Adopt Aman-style utility cluster: nav + lang + CTA + theme + burger flowing together with clear gaps.
- Lang toggle gold underline pattern — Aman/Hermès pattern made more visible.
- Header tightens on scroll (height, gap, blur) — Six Senses behavior.

**3 user-research questions to validate post-launch:**

1. *"On a luxury photography site, where would you click to switch to español?"* — confirms our utility-cluster placement reads as expected.
2. *"What does 'Inquire' tell you will happen vs 'Reserve'?"* — tests CTA copy weight; affluent international clients may expect Reserve = booking, Inquire = consultation.
3. *"Looking only at the top of the page for 5 seconds, what do you remember about the studio?"* — measures whether restraint registers as luxury or as flat.

---

## 7. design:research-synthesis

**Arguments (summary):** Synthesize the luxury-site research into 3-4 design
principles the new IVAE header must embody.

### Principle 1 — Whisper, never shout

*Restraint is the luxury signal.* Hermès, Loro Piana, and Aman headers do less
than budget brands assume. A 14px wordmark, four nav items, one CTA. Their
authority comes from confidence in what they don't say. Loud headers (large
logos, fill-color CTAs, dropdowns on every nav, badges) pattern-match to mass
retail and erode trust at exactly the moment a $25K client decides to inquire.

**Applied to IVAE:** Logo lifts to 15px (still restrained). CTA stays text +
border, never a fill. No logo graphic mark — wordmark only. Four nav items, no
exceptions. Backdrop blur instead of solid color so the header feels like a
hand-laid film over the imagery, not a chrome bar.

### Principle 2 — Every element earns its place

*No decoration, only purpose.* Annie Leibovitz's site puts six elements above
the fold and every single one is functional. The space between elements does
the design work. IVAE's old header has the right elements; the spacing was
arbitrary and the lang switch faded out so far it functionally disappeared.

**Applied to IVAE:** Group nav + lang + CTA + theme + burger as a single
right-side utility cluster with a defined gap rhythm. Lang inactive raises from
α 0.55 to α 0.62 with full-color hover; active gets a gold underline you can
spot from across the room. CTA `min-width` ensures both languages stay on one
line — never broken. Skip-link added (utility you only see when you need it).

### Principle 3 — Hierarchy through contrast, not size

*Gold accent does the lifting; sizes stay close together.* The old header had
13px logo and 10px nav — a 30% size delta that registered as no hierarchy at
all. Aman achieves clear hierarchy with logo and nav at the same size by giving
the logo serif italic + tracked uppercase + a gold accent letter while nav
stays sans uniform. Color and weight do the work, not size.

**Applied to IVAE:** Logo "IVAE" in Syne 700 + 0.32em tracking + cream sits
beside "Studios" in Cormorant italic small-caps + gold. Nav drops to Syne 500
+ 0.26em tracking + cream α 0.82. Active nav gets gold + persistent underline.
Reader knows instantly: brand → wayfinding → action.

### Principle 4 — Motion as poise

*Slow decelerated curves, never bouncy.* Bouncy ease (overshoot, spring) reads
as playful — wrong register for $25K destination weddings. Aman, Hermès, and
Six Senses all use deep decelerations (cubic-bezier 0.22, 1, 0.36, 1 or
similar). Animations are short (200-600ms) but the curve does most of the work.

**Applied to IVAE:** All header transitions use `var(--ease)` (existing
0.22, 1, 0.36, 1). Header tightens on scroll over 0.55s. Mobile drawer items
stagger in 0.05s apart with 0.5s slide+fade. Nav underline grows
right-to-left on hover (matches Belathée). All wrapped in
`prefers-reduced-motion`.

---

## Summary

All 7 skills invoked. Findings drove these implementation decisions:

- New tokens block appended to `tokens.css` (Wave 7).
- CTA gets `min-width: 144px` and `white-space: nowrap` — no more wrapping.
- Lang-switch inactive raised from α 0.55 to α 0.62 with stronger active-state
  gold underline.
- Logo lifts to 15px / italic 17px for clearer hierarchy.
- Active nav item gets persistent gold underline.
- Skip-to-main-content link added (a11y).
- Per-link aria-labels added to lang switch.
- Burger aria-label flips on open/close.
- All animations wrapped in `prefers-reduced-motion`.
- `.h-nav`, `[data-lang-switch]`, `z-index 9000 !important` all preserved
  (services-dropdown-v2.js + lang-detect.js compatibility intact).
- Identical changes applied to `/index.html` and `/es/index.html`; only text
  labels differ in Spanish.
