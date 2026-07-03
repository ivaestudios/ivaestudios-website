# Wave 4 — Handoff Spec (`/index-preview-v4.html`)

> Generated via `design-handoff` skill. Target file: `/index-preview-v4.html`. Total: 160 KB / 1811 lines / dark-mode default. Self-contained: one `<style>`, one `<script>`. References `/styles/tokens.css` only (Wave 4 token block already merged).

---

## Overview

The Editorial Edition. v4 is the enterprise-level evolution of v3 — same cinematic vocabulary, but built around a five-act narrative and full magazine framing. 18 sections, 12+ new techniques, all v3 techniques preserved. The page reads as Issue No. 04 of an ongoing publication: masthead, editor's letter, five acts, contributor profile, footer masthead.

---

## Layout

- **Container**: full-bleed sections, internal `--s-gutter` padding (clamp 24–64 px).
- **Section vertical padding**: `--s-section-y` (clamp 80–140 px).
- **Hero**: 100vh min-height, perspective:1400px stage, 21:9 cinemascope photo at translateZ(-200px).
- **ACT chapter cards**: full-width, centered, oversized roman numeral as background watermark.
- **Sticky-stage manifesto**: 50/50 grid, left column `position:sticky;top:0;height:100vh`, right column 3× viewport text.
- **Cinemascope sections** (atlas cards, photo essay, before/after): aspect-ratio 21/9.
- **Footer**: 4-column grid, masthead-style (Editorial / Atelier / Correspondence / Press & Colophon).

### Breakpoints

| Breakpoint | Behavior |
|---|---|
| **≥ 1200 px** | Full layout. 5-col masthead departments, 3-col atlas, 14-col calendar, 3-col contrib, horizontal reel, 4-col footer. |
| **900–1199 px** | Calendar collapses to 7-col; contrib columns equal width; gear becomes 1-col stack on extreme width. |
| **768–899 px** | Atlas SVG hidden, atlas cards stack vertically; manifesto stage de-pins (relative); calendar 7-col; footer 2-col. |
| **< 768 px** | Hero 1-col actions stack; ACT roman scales down; timeline indent reduced 32 px; booking options 1-col; heatmap 4-col; particles disabled (count=0). |
| **< 600 px** | Hero h1 scales to 40 px floor; pull-quote text scales; footer 1-col. |
| **< 480 px** | Heatmap 3-col. |

---

## Design Tokens Used (Wave 4 additions, plus inherited)

| Token | Value | Usage |
|---|---|---|
| `--ratio-cinemascope` | `21/9` | Hero photo, atlas cards, photo essay, before/after stage |
| `--particle-soft/mid/bright` | `rgba(201,165,78,.18/.32/.58)` | Canvas particle radial gradients |
| `--particle-count-desktop/tablet/mobile` | `64 / 40 / 0` | Hero canvas density tiers |
| `--filter-shimmer-still` | `saturate(1.06) contrast(1.03) brightness(.92)` | Hero photo CSS filter (WebGL fallback) |
| `--grain-static` / `--grain-moving` | `0.022` / `0.030` | Sitewide moving SVG noise (1.4 s steps) |
| `--act-1-tint`–`--act-5-tint` | rgba tints | Five chapter card overlays |
| `--slider-handle-size` | `56 px` | Before/after handle |
| `--slider-divider-w` | `2 px` | Before/after gold divider |
| `--heat-0`–`--heat-4` | rgba gold ramp | 12-month heatmap densities |
| `--timeline-rail-w` | `1 px` | 7-phase rail (left of column) |
| `--timeline-node` / `-active` | `14 / 18 px` | Timeline node default / lit |
| `--blur-far/mid/near` | `6 / 3 / 0 px` | Scroll-driven cinematic blur reveal |
| `--ornament-pull-quote` | `clamp(280px,40vw,560px)` | 560 px Cormorant ornament (preserved from v3) |
| `--rule-hairline/medium/heavy` | `1 / 2 / 4 px` | Masthead, footer, section-divider rules |
| `--mast-issue-tracking` | `0.42em` | Masthead Issue/Volume row |
| `--letter-max-w` | `640 px` | Editor's letter body width |
| `--vt-duration` | `600 ms` | View Transitions API anchor nav |
| `--velocity-bar-h` | `1.5 px` | Scroll-velocity hairline below progress |

Inherited canonical tokens (preserved from v2C / Wave 3): `--gold`, `--gold-deep`, `--gold-hover`, `--ink-1..4`, `--cream-1`, `--text-on-dark-readable`, `--font-serif`, `--font-sans`, `--fs-display`, `--ease`, `--ease-smooth`, `--touch-target-min`, `--focus-ring-on-dark`, all `--z-*`.

---

## Components

| Component | Variant | Props (data-attrs) | Notes |
|---|---|---|---|
| Cinematic loader | — | `#loader`, `#loaderFill`, `#loaderCounter` | 1.4 s clip-path reveal-up; SMPTE counter |
| Masthead | — | static markup | Departments link to `#act-1..5` |
| Hero | — | `#hero`, `#chStage`, `#chPhoto`, `#heroParticles` | 3D rotateX/Y on mousemove; lerp 0.06 |
| Hero h1 | film-credits cascade | 4 lines, each w/ inner span | translateY(110%→0), 1.2 s, stagger .18 s |
| Editor's letter | — | static drop cap on `p:first-child` | max-w 640 px |
| ACT card | `data-act="1..5"` | section.act-card | Roman watermark + eyebrow + title + sub + draw-on rule |
| Golden-hour clock | SVG | 24 ticks programmatic | Sunrise/sunset arcs draw-in via stroke-dashoffset, 2.4 s |
| 14-day calendar | tabbed | `[data-cal-city]` | NOAA-style suntimes per city; 14 days from today |
| Atlas | SVG + cards | `[data-pin]` on g | Pulse animation; cards always render below SVG (mobile fallback) |
| Manifesto stage | sticky | `.stage` grid 1:1 | 3 chapters × 1 viewport each |
| Photo essay | full-bleed | aspect-ratio 21:9 | Drop cap on first p; scene-break dingbat |
| Contrib profile | 1.4:1 grid | portrait + bio + 4 credentials | Vianey, role, bio, sessions, rating, languages, press |
| Timeline | vertical | `.tl-item` | 7 phases; node grows on lit |
| Equipment | 3-col | `.gear-col` | Bodies / Glass / Post |
| Reel | horizontal scroll | `[data-...] arrow keys + buttons | Mixed aspect ratios 3:4 / 4:3 / 5:7 |
| Before/after slider | role="slider" | `aria-valuenow` 0–100 | Pointer events + arrow keys + Home/End |
| Pull quote | 560 px ornament | bilingual ES/EN | 3-up testimonials below |
| Press band | static | 6 publications | Hover gold |
| Booking simulator | role="tablist" | 3 fieldsets | aria-pressed buttons; live summary |
| Heatmap | 12 × 2 grid | `[data-density]` | Tooltip via title attr; legend 5 swatches |
| Journal | bento 1+4 | `.journal-card.feat` | Drop cap on featured |
| Footer | 4-col masthead | static | Issue No · Volume · Colophon |
| Color-grade toggle | 2 buttons | `[data-grade-btn]` | Persisted in localStorage `ivae-v4-grade` |

---

## States and Interactions

| Element | State | Behavior |
|---|---|---|
| `.btn-primary` | default → hover | bg `--gold` → `--gold-hover`; shadow `--shadow-gold-sm` → `--shadow-gold-lg`; 0.55 s `--ease` |
| `.btn-primary` | magnetic (`[data-magnet]`) | translate3d toward cursor at 0.18× displacement; reset on mouseleave |
| `.book-option` | default → hover → pressed | bg subtle gold tint → bordered gold inset shadow on `aria-pressed="true"` |
| `.atlas-pin` | default → hover/focus | dot color `--gold` → `--gold-hover`; ring keeps pulse |
| `.cal-tab` | default → active | text → ink-1, bg → gold; 0.35 s fade |
| `.tl-item` | unlit → lit | node grows 14 → 18 px; inner dot fades in; rail draws |
| `.ba-handle` | default → focus | handle ring; arrow keys ±2%, Home=0%, End=100% |
| `.heat-cell` | default → hover | border → `--gold` |
| `.reel-frame` | default → hover | image scale 1.045, filter brightness up; meta fades in |
| `.cur-ring` | default → over link | size 42 → 64 px; over CTA → 84 px + gold tint |
| `.cur-preview` | hidden → shown | opacity 0→1, scale .9→1, when `[data-preview]` link is hovered |
| Header | top → scrolled | bg transparent → `rgba(12,18,25,.94)`, height 68 → 60 px, gold border bottom |
| Loader | initial → done | clip-path inset(0…100%) reveals page; SMPTE counter ticks; 1.4 s |

---

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| Desktop (≥ 1200 px) | All systems on. 64 particles, full 3D parallax, magnetic cursor. |
| Tablet (768–1199 px) | Particles drop to 40. Atlas SVG still visible. Calendar 7-col. |
| Mobile (< 768 px) | Particles 0. Magnetic cursor disabled (`hover: none`). Atlas SVG hidden, cards stack. Manifesto pin un-sticks. Booking 1-col. |
| Reduced motion | All transitions/animations off. Hero cascade lit instantly. Photo translateZ pinned. Particles disabled. Grain animation off. |

---

## Edge Cases

- **Slow connection**: Loader visible until `tick()` reaches 100 % (~1.4 s typical, max ~3 s for slow CPU). Page is technically interactive once `loaded` class is on `<body>` and loader removed.
- **JS disabled**: Loader stays visible (no graceful fallback). Recommendation: add `<noscript>` fallback in production. **Open question for Wave 5.**
- **No IntersectionObserver**: All `.rv` elements add `lit` immediately (graceful fallback in `reveal()`).
- **No View Transitions API**: Anchor scroll falls back to `scrollIntoView({behavior:'smooth'})`.
- **WebGL unsupported**: Hero canvas particles skip (no shader uses WebGL — Canvas 2D only). CSS filter `--filter-shimmer-still` always applies.
- **Long Spanish text**: Pull quote ES line is below EN — both are constrained by parent max-width 880 px. No overflow.
- **Calendar past midnight**: Timezone offset pre-applied; sunset times beyond local 24h roll into next day correctly via `Date()` arithmetic.
- **Empty/zero density on heatmap**: `data-density="0"` shows lightest gold tile; no completely empty state.
- **Booking simulator partial state**: `Continue` button stays disabled until at least one option in current step is `aria-pressed="true"`. Step tabs cannot be jumped to past missing prerequisites.

---

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Loader frame top/bottom rules | onload | scaleX(0→1) | 1.6 s | `--ease-out` |
| Loader fill | tick() | width 0 → 100 % | 250 ms steps | `--ease-out` |
| Loader exit | done class | clip-path inset(0 0 100% 0) | 1.4 s | `--ease-smooth` |
| Hero h1 cascade lines | `.lit` on hero | translateY(110% → 0) | 1.2 s, .18 s stagger | `--ease-smooth` |
| Hero subtext | `.lit` on hero | opacity 0→1, translateY 16→0 | 1.4 s @ 1 s delay | `--ease` |
| Hero stage 3D | mousemove | rotateX/Y lerp | rAF | linear lerp .06 |
| Particle drift | rAF | velocity-based loop | 60 fps cap | linear |
| Header scrolled | scroll Y > 40 | bg + height + border | 600 ms | `--ease` |
| Sunrise/sunset arcs | `.act1.lit` | stroke-dashoffset 600→0 | 2.4 s | `--ease-smooth` |
| Atlas pin pulse | infinite | scale(1 → 1.4) | 3 s | ease-in-out |
| Atlas pin ring | infinite | scale(.6 → 2.6) opacity 0.7 → 0 | 3 s | ease-in-out |
| Reveal `.rv` | IntersectionObserver | opacity + translateY | 0.9–1.1 s | `--ease` |
| Reveal `.rv-blur` | IntersectionObserver | filter blur 6→0 + translateY | 1.2 s | `--ease-smooth` |
| ACT card rule draw | enter view | scaleX 0 → 1 | 1.4 s | `--ease-smooth` |
| Timeline node | `.tl-item.lit` | width/height 14 → 18 px | 0.4 s | `--ease` |
| Reel frame hover | hover | scale 1.045, filter | 1.2 s / 0.8 s | `--ease` |
| BA slider | pointermove | clip-path inset | rAF | linear |
| Booking step swap | tab click | display flex/none + opacity | instant | — |
| Heat cell hover | hover | border-color | 0.35 s | `--ease` |
| Pull quote 560 px ornament | static | none | — | — |
| Color grade toggle | click | CSS variable swap | instant | — |
| Anchor nav | click | scrollIntoView wrapped in `document.startViewTransition` if available | 600 ms | `--vt-ease` |

All motion gated behind `prefers-reduced-motion: reduce` — animations and transitions disabled, hero h1 lit instantly, photo pinned at translateZ(0) scale(1.05).

---

## Accessibility Notes

- **Focus order**: skip-link → header logo → header nav (5 items) → header CTA → mobile toggle → masthead departments → hero CTAs → editor letter → ACT cards in section order → booking step tabs → booking options → footer links.
- **ARIA roles & labels**:
  - Sections use `aria-label` or `aria-labelledby` consistently.
  - Booking simulator: `role="tablist"` + step tabs `role="tab"` + fieldsets, options `aria-pressed`.
  - Atlas pins: `<g role="link" aria-label="Cancún|Riviera Maya|Los Cabos">`, `tabindex="0"`.
  - Before/after handle: `role="slider"` + `aria-valuemin/max/now` + `aria-orientation="horizontal"` + `aria-controls`.
  - Color grade pill: `role="group" aria-label="Color grade"`.
- **Keyboard interactions**:
  - Reel: `←` / `→` step one frame.
  - BA slider: `←` ±2 %, `→` ±2 %, `Home` 0, `End` 100.
  - Booking tabs: only navigable forward when prerequisites met.
  - All anchors smooth-scroll with View Transitions wrap when supported.
- **Touch targets**: every interactive element has `min-height: var(--touch-target-min)` (44 px).
- **Color contrast**: all 7 key text/CTA combinations pass WCAG AA (see wave-4-accessibility-report.md).
- **Screen reader copy**:
  - Loader: `aria-hidden="true"` (decorative).
  - Hero canvas: `aria-hidden="true"`.
  - Particle field & moving grain: not announced.
  - "Seal the Letter": `aria-label="Seal the letter — opens an email to info@ivaestudios.com"`.
- **Reduced motion**: comprehensive — particle field skipped at init, parallax bound only when not PRM, cursor effects skipped, animations zeroed via `transition:none!important`.

---

## Open Questions for Wave 5

1. Should hero photo be replaced with a 6–8 s autoplay clip when Vianey supplies a video asset?
2. Should the live calendar pull from a real API once the studio publishes its booking JSON?
3. Should before/after slider use real RAW + final pair from a recent gallery?
4. Should the heatmap be wired to actual booking density?
5. Add `<noscript>` fallback that hides the loader for non-JS visitors.
6. Light-mode inversion for the chapter-card act tints (currently dark-only).

---

## File Manifest

| File | Lines | Size |
|---|---|---|
| `/index-preview-v4.html` | ~1811 | ~160 KB |
| `/styles/tokens.css` (Wave 4 additions) | +85 | +1.9 KB |
| `/seo/design-audit/wave-4-handoff-spec.md` | (this) | — |
| `/seo/design-audit/wave-4-innovation-roadmap.md` | TBD | — |
| `/seo/design-audit/wave-4-accessibility-report.md` | TBD | — |
| `/seo/design-audit/wave-4-performance-budget.md` | TBD | — |
| `/seo/design-audit/wave-4-skills-used.md` | TBD | — |
</content>
</invoke>