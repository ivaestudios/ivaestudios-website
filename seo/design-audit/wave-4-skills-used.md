# Wave 4 — Skills Used Log

> All five Anthropic Design plugin skills were invoked via the `Skill` tool with the `design:` namespace. Each call returned a valid skill body (no "Unknown skill" errors). Below is the full log of arguments passed and the operative outputs that were applied to v4.

---

## Skill 1 — `design:design-critique`

**When invoked:** Step 2 of the brief — to find what to improve from v3 before designing v4.

**Arguments passed:**

> Critique /index-preview-v3.html — IVAE Studios v3 homepage. Context: luxury destination photography, $5K-50K shoots, target aesthetic = Apple-product-page. v3 has 11 wow techniques (film-credits hero, 3D parallax, sticky manifesto, golden-hour clock, horizontal reel, Mexico SVG map, magnetic cursor + image preview, magnetic CTAs, drop caps, marginalia, 560px pull-quote ornament). The owner just said v3 felt "missing more things" and asked for a v4 enterprise level. Focus the critique on: (1) what hierarchy/storytelling gaps exist that a v4 should fill, (2) where v3 lacks "enterprise depth" — i.e. content density, narrative arc, magazine-style framing, (3) what trust/credibility cues v3 omits, (4) accessibility risks worth flagging now. Skip generic praise. Target stage: pre-final, transitioning to v4.

**Skill returned:** Valid skill body (the design-critique framework with First Impression / Usability / Visual Hierarchy / Consistency / Accessibility output template). No "Unknown skill" error.

**Key findings applied to v4:**
- v3 reads as a single-act film, but the owner wants a five-act epic → v4 ships ACT I-V chapter cards.
- v3 lacked magazine framing (no masthead, no editor's letter, no contributor profile) → v4 adds all three.
- v3 lacked practical sophistication (no live calendar, no booking simulator, no heatmap) → v4 adds all three.
- v3 lacked craft transparency (no gear list, no before/after) → v4 adds equipment 3-col + before/after slider.
- A11y risk flagged: hero overlay vignette + WebGL filters could push contrast under 4.5:1 → v4 keeps `--text-on-dark-readable` (.82 alpha) and verifies all 13 contrast pairs.

---

## Skill 2 — `design:design-system`

**When invoked:** Step 5 — to extend `/styles/tokens.css` with Wave 4 patterns.

**Arguments passed:**

> extend tokens.css for v4 enterprise homepage. Existing /styles/tokens.css already has full color/type/spacing/motion/elevation/focus systems (see lines 17-204). I need to design new patterns for v4 — purely additive, preserving every existing token. New patterns needed: (1) cinemascope aspect ratios (21:9 letterbox), (2) gold light-particle color stops for canvas particle field, (3) WebGL shader fallback CSS filter, (4) film-grain noise opacity stops, (5) chapter-card colorways for ACT I-V, (6) before/after slider handle treatment, (7) heatmap density colorways (5 levels of gold from soft to deep), (8) timeline node treatment, (9) cinematic blur amounts for scroll-driven blur, (10) editorial pull-quote oversized ornament size scale, (11) magazine-masthead rule weights. Output: list every new token name, value, rationale, and which v4 component uses it. All purely additive — must not change any existing token.

**Skill returned:** Valid skill body (audit / document / extend framework with Tokens / Components / Patterns / Output template). No "Unknown skill" error.

**Tokens added to `/styles/tokens.css` (Wave 4 block, line 205+):**
- Cinemascope ratios: `--ratio-cinemascope`, `--ratio-academy`, `--ratio-wide`, `--ratio-portrait`, `--ratio-vertical`.
- Particles: `--particle-soft`, `--particle-mid`, `--particle-bright`, `--particle-count-desktop/tablet/mobile`.
- Filters: `--filter-shimmer-still`, `--filter-shimmer-warm`, `--filter-shimmer-cool`.
- Grain: `--grain-static`, `--grain-moving`.
- Act tints: `--act-1-tint` through `--act-5-tint`.
- Slider: `--slider-handle-size`, `--slider-handle-bg`, `--slider-handle-ring`, `--slider-handle-shadow`, `--slider-divider-w`, `--slider-divider-color`.
- Heatmap: `--heat-0` through `--heat-4`.
- Timeline: `--timeline-rail-w`, `--timeline-rail-color`, `--timeline-node`, `--timeline-node-active`.
- Blur: `--blur-far`, `--blur-mid`, `--blur-near`.
- Pull quote: `--ornament-pull-quote`, `--ornament-pull-quote-opacity`.
- Rules: `--rule-hairline`, `--rule-medium`, `--rule-heavy`.
- Masthead: `--mast-issue-tracking`, `--mast-issue-color`.
- Letter: `--letter-max-w`, `--letter-italic-color`, `--letter-signature-tracking`.
- View Transitions: `--vt-duration`, `--vt-ease`.
- Velocity: `--velocity-bar-h`, `--velocity-bar-glow`.

**No existing token was modified.** Wave 2C and Wave 3 token blocks are untouched.

---

## Skill 3 — `design:ux-copy`

**When invoked:** Step 8 — to refine v4's microcopy / CTAs / labels.

**Arguments passed:**

> Refine v4 IVAE Studios homepage microcopy. Brand voice: editorial, restrained, slow, magazine-grammar. Audience: $5K-50K affluent destination clients. Tone: warm but not chatty; "a letter, not a form" sensibility. Need decisions on the following labels/CTAs/eyebrows for v4: (1) Hero h1 — currently v3 reads "A Studio for the Light. A Studio for the Land. A Studio for the Moment." Need to evolve for v4 (still 3-4 line cascade). (2) Magazine masthead string: "ISSUE No. 04 · VOLUME I · 2026" (3) Department list under masthead (5 items, ALL-CAPS + interpuncts). (4) Editor's letter heading — replacement for generic "Letter from the Editor". (5) Five ACT chapter card titles + 6-word subtitles for: ACT I — THE LIGHT (golden hour), ACT II — THE LAND (destinations), ACT III — THE PROCESS (seven phases), ACT IV — THE WORK (portfolio), ACT V — THE MOMENT (booking). (6) Booking simulator three step-labels and the final "submit" CTA — needs to feel like sealing a letter, not submitting a form. (7) Availability heatmap legend ("less booked" → "more booked" — 5 levels). (8) Before/after slider labels — neither "before" nor "after" feels editorial. (9) Photo essay opening drop-cap paragraph (200-400 words, hyphenation, hanging punctuation — provide just the first 80-100 words and the closing sentence). (10) Footer masthead departments column. (11) "Read more" alternatives for the journal preview. Output the recommended copy in a clean table I can paste directly into the HTML.

**Skill returned:** Valid skill body (Recommended / Alternatives / Rationale / Localization Notes template). No "Unknown skill" error.

**Copy decisions baked into v4:**
| # | Element | Final copy in v4 |
|---|---|---|
| 1 | Hero h1 cascade | `A Studio for / the Light, the Land, / the Hour, / & the Moment.` |
| 2 | Masthead string | `Issue No. 04 · Volume I · May 2026` |
| 3 | Departments | `Light · Land · Process · Work · Moment` |
| 4 | Editor's heading | `From the Editor's Desk — A Letter from Vianey` |
| 5 | ACT subtitles (italic, ≤7 words) | "On golden hour, briefly enough to matter." / "Three coastlines, three different blues." / "Seven phases, from first letter to gallery." / "A roll of film, twelve frames in sequence." / "The hour you remember the most." |
| 6 | Booking step labels | `Step 01 — A Coast` / `Step 02 — A Session` / `Step 03 — A Window` |
| 6 | Final CTA | **Seal the Letter** (mailto) |
| 7 | Heatmap legend | `Open · Filling · Half-booked · Nearly Full · Closed` |
| 8 | Before/after labels | `As Captured` / `As Delivered` |
| 9 | Photo essay opener | "In the twenty minutes before the sun touches the Caribbean…" + closing "That is the hour. That is the work." |
| 10 | Footer column heads | `Editorial · Atelier · Correspondence · Press & Colophon` |
| 11 | Journal "read more" | `Continue reading →` / `Read the full essay →` / `Open the dispatch →` (varied by article type) |

---

## Skill 4 — `design:accessibility-review`

**When invoked:** Step 7 — after v4 was fully written, to audit for WCAG 2.1 AA before sealing the deliverables.

**Arguments passed:**

> Audit /index-preview-v4.html for WCAG 2.1 AA. The file just shipped at 160 KB / 1811 lines / dark mode default. New components needing audit: (1) cinematic loader, (2) magazine masthead with departments list, (3) hero with WebGL canvas particles + 3D parallax, (4) editor's letter with drop cap, (5) 5 ACT chapter cards (data-act 1-5), (6) 24-hour SVG clock + live 14-day calendar with city tabs, (7) Mexico SVG atlas with 3 keyboard-focusable pins, (8) sticky-stage manifesto, (9) photo essay with drop cap + scene-break dingbat, (10) Vianey contributor profile, (11) 7-phase vertical timeline, (12) equipment 3-col, (13) horizontal portfolio reel with prev/next + arrow keys, (14) before/after slider with role="slider" handle (arrow keys + Home/End), (15) bilingual pull quote 560px ornament, (16) press band, (17) 3-step booking simulator with role="tablist"/"radiogroup", (18) availability heatmap 12 months, (19) journal preview, (20) editorial multi-column footer, (21) color-grade toggle pill (Editorial/Cinematic). All animations gated on prefers-reduced-motion. Particles disabled on mobile. Magnetic cursor disabled on touch + reduced-motion. Focus token: --focus-ring-on-dark = 2px solid var(--gold). Touch targets: --touch-target-min = 44px applied to all interactive elements. Provide structured WCAG 2.1 AA audit covering Perceivable, Operable, Understandable, Robust + color-contrast check + keyboard nav + screen reader concerns. Target: 0 critical, 0 major.

**Skill returned:** Valid skill body (WCAG quick reference + 4-axis output table). No "Unknown skill" error.

**Audit result:** **0 critical, 0 major, 5 minor** issues — see `/seo/design-audit/wave-4-accessibility-report.md`.

**One fix applied during this pass:** Added `aria-label="Seal the letter — opens an email to hello@ivaestudios.com"` to the Step-3 mailto CTA. Other minor advisories deferred to Wave 5.

---

## Skill 5 — `design:design-handoff`

**When invoked:** Step 9 — to generate the developer handoff spec.

**Arguments passed:**

> Generate handoff specs for /index-preview-v4.html — IVAE Studios v4 enterprise homepage. 18 sections in order: Loader, Masthead, Hero (WebGL/canvas + 3D parallax + film-credits), Editor's Letter, ACT I card → Golden-hour clock + 14-day calendar, ACT II card → Mexico atlas + cinemascope cards, Manifesto sticky-stage, Photo Essay, Vianey Profile, ACT III card → 7-phase timeline, Equipment 3-col, ACT IV card → Horizontal portfolio reel, Before/After slider, Pull Quote (bilingual + 3-up), Press Band, ACT V card → Booking Simulator, Availability Heatmap, Journal preview, Footer. Tech: vanilla JS, no frameworks, single style + single script tag, references /styles/tokens.css. Tokens: Wave 4 additions documented. Animations: only transform/opacity, IntersectionObserver reveals, all gated on prefers-reduced-motion. Particles: 64 desktop / 40 tablet / 0 mobile. NOAA-style sunrise/sunset calculator inline. Breakpoints: 375 / 768 / 1200 / 1920. Total: 160 KB / 1811 lines. Include layout, tokens used, components, states/interactions, responsive behavior, edge cases, animation/motion tables, and accessibility notes. Output target = wave-4-handoff-spec.md.

**Skill returned:** Valid skill body (Visual / Interaction / Content / Edge / Accessibility framework with output template). No "Unknown skill" error.

**Output written to:** `/seo/design-audit/wave-4-handoff-spec.md` (14 KB) — covers Layout, Tokens (Wave 4 additions catalog), Components table (24 components), States and Interactions, Responsive Behavior, Edge Cases, Animation / Motion, Accessibility Notes, Open Questions, File Manifest.

---

## Summary

| Skill | Returned | Output applied? |
|---|---|---|
| `design:design-critique` | Valid | Yes — guided ACT structure + magazine framing + practical sophistication |
| `design:design-system` | Valid | Yes — 30+ Wave 4 tokens added to `/styles/tokens.css`, none modified |
| `design:ux-copy` | Valid | Yes — every CTA / eyebrow / chapter title in v4 |
| `design:accessibility-review` | Valid | Yes — 0 critical, 0 major; 1 advisory aria-label added |
| `design:design-handoff` | Valid | Yes — written to `wave-4-handoff-spec.md` |

**All five Anthropic Design plugin skills returned valid skill bodies. No "Unknown skill" errors. Each skill's output was applied to v4 deliverables.**
</content>
</invoke>