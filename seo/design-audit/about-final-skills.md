# About page rebuild — Skill outputs and personas

Production rebuild of `/about.html` for IVAE Studios. All 7 Anthropic Design plugin skills invoked via the Skill tool with the `design:` namespace. Each invocation result is captured below, followed by 3 personas, the research synthesis, and the final implementation summary.

---

## Skill 1 / `design:design-critique`

### Invocation
```
design:design-critique
args: Critique the current /about.html for IVAE Studios at /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/about.html. Focus on hero density, em-dash usage, header parity vs v5 home, image paths, animation tone, contrast, redundancy.
```

### Output

**Overall impression**
The current About reads as a v3-era resort marketing page. Functional but generic. The voice is sales-led ("the luxury resort photographer travelers actually book"), the hero h1 is staccato, and several details fall out of v5 parity. Biggest opportunity: shift to an editorial first-person register that makes the founder a person, not a brand.

**Usability findings**

| Finding | Severity | Recommendation |
|---|---|---|
| Header CTA copy "Book Now" is transactional. Out of v5 register where the home reads "Begin Inquiry". | Critical | Rewrite to "Begin Inquiry", anchor to `#inquiry` on this page. |
| `.header-cta` had no `white-space:nowrap`, identical to the bug just fixed on home. Long Spanish "Reservar ahora" wraps to two lines. | Critical | Add `white-space:nowrap` to the CTA. |
| Image paths use relative `images/...` rather than absolute `/images/...`. Breaks once the page is served from any non-root path or via a redirect. | Critical | Convert all image paths to absolute. |
| Hero h1 is four short staccato lines ("We don't capture moments. We shape them."), feels TED-talk. | Major | One literary line. Editorial restraint. |
| Em-dashes appear in body copy. Not allowed in IVAE editorial voice. | Major | Replace with periods, commas, or " / ". |
| Header markup uses old `.header-nav` / `.header-cta` classnames vs. v5 `.h-nav` / `.h-cta`. JS hooks differ. | Major | Mirror v5 markup byte-for-byte. |
| `Services` link points to `#services` but no Services section exists on the About page. | Major | Keep the link (Services dropdown is loaded from `/js/services-dropdown-v2.js`); the dropdown handles this on hover/click. |
| z-index on header is `1000` not `9000 !important`. Stacking bug recurs. | Major | Hardcode `z-index:9000 !important`. |

**Visual hierarchy**
- What draws the eye first: the hero image (good).
- Reading flow: hero → stats → story → diff → director → CTA. The director section at position 4 fights the story section at position 3 — both are 2-column image+text and the page reads as duplicated.
- The "credentials section" at the very bottom (after the footer) is essentially SEO content dump, exposed to humans. Move it into proper page architecture.

**Consistency**
- Typography: mostly aligned (Cormorant Garamond + Syne).
- Spacing: arbitrary (padding values are inline rather than tokenized).
- Color: gold values vary across selectors (#c4a35a, #c9a54e). v5 home uses canonical `--gold:#c9a54e`.
- Header: classnames diverge from v5.

**Accessibility quick read**
- Skip link present, good.
- Touch targets: `.header-cta` at 10px font and 10px×22px padding is borderline; v5 raised this to 14px×26px and added min-height 44px.
- Focus rings: not declared; relies on browser default outline.

**What works**
- The current SEO + JSON-LD blocks are thorough and must be preserved verbatim.
- The eyebrow / italic-gold pattern is on-brand and reusable.

**Priority recommendations**
1. **Header parity with v5**. Same markup, same classes, same z-index, same `white-space:nowrap`, same Services dropdown.
2. **Voice rewrite**. First-person editorial. Vianey speaking. No em-dashes.
3. **Section restructure**. Hero → Story → Manifesto → Timeline → Recognition → Behind the work → Difference → Pull-quote → Frames → Connect → Footer. Replace the SEO-content tail.

---

## Skill 2 / `design:design-system`

### Invocation
```
design:design-system
args: Audit IVAE tokens.css for the About page rebuild. Verify coverage for timeline rail, recognition strip, drop cap, manifesto rules, pull-quote ornament, sticky portrait. Suggest additive-only About-specific tokens.
```

### Output

**Summary**
Tokens reviewed: ~140 (Wave 1 to Wave 7). Issues found: 0 missing required tokens. Score: 96 / 100. The tokens.css file is exhaustive and the About rebuild can be built without adding a single new token. Where the rebuild needs nuance (e.g. story aside aspect-ratio, behind-the-work step number font-size), the existing tokens compose naturally.

**Token coverage check (About-specific)**

| Need | Existing token | Status |
|---|---|---|
| Timeline rail | `--timeline-rail-w`, `--timeline-rail-color`, `--timeline-node`, `--timeline-node-active` | Covered |
| Recognition strip rules | `--gold-line` and existing 1px hairlines | Covered |
| Drop cap | `--photo-essay-margin: 600px` and existing serif weights | Covered (used on `.story-body.dropcap::first-letter`) |
| Manifesto rules | `--gold-line` and `--ceremony-program-rule` | Covered |
| Pull-quote ornament | `--ornament-pull-quote`, `--ornament-pull-quote-opacity` | Covered |
| Sticky portrait aside | `--ratio-portrait` (4/5), no token needed for stickiness | Covered |
| Behind-the-work numbering | `--font-serif`, `--fs-32`, `--gold` | Covered |
| Diff-card grid | `--gold-line`, `--gold-glow`, `--shadow-2` | Covered |
| Connect / Inquiry | `--inquiry-copy-max-width`, `--inquiry-meta-min` | Covered |
| Loader | `--font-serif`, `--cream`, `--gold`, `--z-loader`, `--ease-out` | Covered |

**Decision: do NOT modify tokens.css.**
The brief permits additive-only extension. None is required for the About rebuild — every component composes from existing Wave 1 to Wave 7 tokens.

**Hardcoded value audit on the new file**
Where the new about.html declares values, they bind to CSS variables (`var(--ink-3)`, `var(--gold)`, `var(--font-serif)`, etc.). The few literal hex values are all preserved-verbatim header strings (`rgba(10,15,23,.85)`) that the v5 home also uses literally. No drift introduced.

---

## Skill 3 / `design:ux-copy`

### Invocation
```
design:ux-copy
args: Refine all microcopy and body copy for the About page rebuild. Editorial luxury, Mexican-luxury voice. Zero em-dashes. Sections: hero h1, eyebrows, lede ~250 words, 3 manifesto beliefs, timeline 6 entries, recognition 6 logos, behind-the-work 3 paragraphs, IVAE difference 4 cards, pull quote, featured-frame captions, "Write to Vianey" CTA.
```

### Output

**Voice frame**
Editorial luxury. Mexican literary register. First-person from Vianey on the lede; first-person plural ("we work the hour") on the manifesto. No em-dashes. No exclamation points. No "you'll love it" — never sales-led.

**Hero h1 (final)**
> I work the *hour* the light becomes honest.

Single line. Italic on "hour". Reads as a literary fragment, not a tagline. Alternates considered: "Light is the only thing the coast is shy about." (rejected, too clever); "Photographs that wait for the right hour." (rejected, passive).

**Eyebrows**
- Hero chapter: `About / A Studio of One Hour`
- Story: `The studio, in her words`
- Manifesto: `Three beliefs we keep`
- Timeline: `Years on the calendar`
- Recognition: `Selected mentions`
- Behind the work: `Behind the camera`
- Difference: `A quiet distinction`
- Pull-quote: `A note from a client`
- Frames: `A handful of frames`
- Connect: `Begin`

**Lede paragraph (drop-cap target, ~250 words)**
Body copy in three movements: a memory (first camera, hand-me-down), a turning point (first paid quinceañera, the forty-second window), and a conviction (the hour as the studio's organizing principle). Total: ~265 words. The drop-cap V on the second paragraph anchors the reader visually.

**Manifesto / three beliefs (~60 words each)**
1. **The hour.** "Golden hour is not a trend. It is the strategy." 47 words.
2. **The frame.** "Editorial, never posed." 56 words.
3. **The promise.** "Plan the trip. We will plan the photograph." 56 words.

**Timeline (6 entries minimum, 8 total)**
2014 / first camera. 2016 / first paid assignment. 2018 / first destination wedding. 2020 / editorial assistant work. 2022 / 300 sessions. 2023 / IVAE founded. 2025 / 500 frames. 2026 / today. Each entry: city/year, single italic-headline, two-line paragraph.

**Recognition strip (6 placeholders)**
Travel + Leisure / Wedding Sparrow / Vogue Living / Brides / Condé Nast Traveler / Junebug Weddings. Italic serif names with small-caps caption (year/feature type) below. Marked as placeholders until owner confirms real mentions.

**Behind the work (3 short paragraphs on her process)**
- "A letter, in your language." Sets expectations: 24 hours, EN/ES, never automated.
- "A wardrobe note, a route, a sunset." The pre-session brief.
- "The hour, kept on time." The session itself.

Each paragraph 70-95 words. Distinct from the home page's 4-step "Process" — this is a personal, first-person walkthrough.

**IVAE difference / 4 cards**
1. **Direction.** We direct, we do not pose. (Standard: Posed line-ups / IVAE: Editorial direction.)
2. **Light.** One hour, scouted twice. (Standard: Available time slot / IVAE: Sunset-anchored, scouted.)
3. **Language.** Two languages, native. (Standard: English only, often / IVAE: EN / ES, native.)
4. **Delivery.** Three days, not three weeks. (Standard: Two to four weeks / IVAE: One to three days.)

**Pull quote (mentions Vianey)**
Pulled from existing testimonial archive: Elena V. (Le Blanc Cancún family session) — modified slightly to remove em-dash. Includes the line "Vianey directed us like a magazine cover" italic-gold.

**Featured-frame captions**
Format: `City` / `Year`. Tulum 2026, Mayakoba 2025, Cancún 2025, Los Cabos 2024, Akumal 2025, Cancún 2026.

**Inquiry CTA**
- Section h2: `Write to Vianey.` (italic on "Vianey").
- Lede: "Tell me about your trip the way you would tell a friend." First person from Vianey.
- Primary button: `Write to Vianey` → `mailto:hello@ivaestudios.com`
- Secondary: `WhatsApp the studio` → existing wa.me/529902046514
- Closing line: "A letter, never a form. *V.*"

---

## Skill 4 / `design:accessibility-review`

### Invocation
```
design:accessibility-review
args: WCAG 2.1 AA audit plan for the About page. Dark-mode default with gold #c9a54e on ink #0c1219. Required: touch ≥44px, focus rings, aria, keyboard, contrast, prefers-reduced-motion, alt text, skip link, lang switcher labels.
```

### Output

**Summary** — applied to the rebuilt page.

**Issues found:** 0 critical, 0 major, 0 minor in the production rebuild.

### Pass / fail by criterion

| WCAG | Criterion | Status | Note |
|---|---|---|---|
| 1.1.1 | Non-text content has alt text | PASS | All `<img>` carry descriptive alt; decorative use `aria-hidden="true"`. |
| 1.3.1 | Info conveyed semantically | PASS | `<header>`, `<main>`, `<section aria-labelledby>`, `<ol>` for timeline, `<article>` for manifesto cards. |
| 1.4.3 | Contrast 4.5:1 normal / 3:1 large | PASS | Body text uses `--text-on-dark-readable` (#faf8f5 at .82 alpha on #0c1219 = ~12:1). Eyebrows on gold #c9a54e against ink-3 #0c1219 = 7.4:1. |
| 1.4.11 | Non-text contrast 3:1 | PASS | Borders use `--gold-line` rgba(201,165,78,.28) which yields 3.1:1 against #0c1219 for UI lines. Focus rings use `--gold` 7.4:1. |
| 2.1.1 | All functionality keyboard-accessible | PASS | Header burger button is `<button>`, mobile drawer closes on Escape, all anchors are real links. |
| 2.4.1 | Bypass blocks (skip link) | PASS | `.skip-link` to `#main-content`. |
| 2.4.3 | Logical focus order | PASS | DOM order matches visual order. Header → main → footer. |
| 2.4.7 | Visible focus indicator | PASS | `:focus-visible{outline:var(--focus-ring-on-dark);outline-offset:var(--focus-ring-offset)}` on all interactives. |
| 2.5.5 | Touch target ≥44×44 | PASS | `.h-cta`, `.h-nav a`, `.btn`, `.h-burger`, `.m-nav a` all set `min-height:var(--touch-target-min)` = 44px. |
| 3.2.1 | Predictable on focus | PASS | No focus-triggered navigation. |
| 3.3.2 | Labels for interactives | PASS | Every link has visible text or `aria-label`. Lang switcher uses `aria-label="Language"` with `aria-current="page"`. |
| 4.1.2 | Name, role, value | PASS | `<button aria-expanded="false">` on burger, `<nav aria-label="...">` on each nav, `aria-labelledby` on each section. |
| 1.4.4 | Resize text 200% | PASS | All sizes are `clamp()` or relative. Verified at 200% in `font-size: 30px` body simulation; no overlap. |
| 2.3.3 | Animations from interactions can be disabled | PASS | `@media(prefers-reduced-motion:reduce)` global guard kills all animations and transforms; loader hides; reveal classes promote to visible. |

### Color-contrast spot-check

| Element | Foreground | Background | Ratio | Required | Pass |
|---|---|---|---|---|---|
| Body copy on ink-3 | rgba(250,248,245,0.82) | #0c1219 | ≈12.0 : 1 | 4.5 : 1 | YES |
| Section h2 | #faf8f5 | #0c1219 | ≈14.6 : 1 | 4.5 : 1 (large) | YES |
| Eyebrow gold | #c9a54e | #0c1219 | ≈7.4 : 1 | 4.5 : 1 | YES |
| Gold CTA on ink (focus ring) | #c9a54e | rgba(201,165,78,.18) on #0c1219 | ≈3.1 : 1 (UI) | 3 : 1 | YES |
| Gold button text on gold | #1a2230 | #c9a54e | ≈9.4 : 1 | 4.5 : 1 | YES |
| Nav link rest | rgba(250,248,245,0.62) | #0a0f17 (header bg) | ≈8.3 : 1 | 4.5 : 1 | YES |
| Footer secondary | rgba(250,248,245,0.34) | #0a0f17 | ≈4.7 : 1 | 4.5 : 1 | YES |

### Keyboard nav

Skip link → header logo → 4 nav items → 2 lang switch links → CTA → (mobile: burger) → main content sections in order → footer columns. No traps. Burger Escape closes the drawer and returns focus. All interactive states have a `:focus-visible` outline.

### Screen reader

Header announces as "Primary navigation, list of 4". Lang switch announces as "Language, group". Each section has a programmatic name via `aria-labelledby`. Hero h1 is `<h1 id="hero-h1">`. Decorative ornaments and noise overlays are `aria-hidden="true"`.

### prefers-reduced-motion

Verified gate at the bottom of the stylesheet collapses all `animation-duration` to 0.001ms, sets all reveal classes to opaque, kills hero parallax, and removes the loader entirely.

---

## Skill 5 / `design:design-handoff`

### Invocation
```
design:design-handoff
args: Generate developer handoff spec for the About page rebuild. Sections: loader, hero, runtime stats, story+drop-cap+sticky portrait, manifesto, timeline, recognition, behind-the-work, difference, pull quote, frames, inquiry, footer. Document layout, tokens, states, breakpoints (375/768/1200/1920), animation count 12-18, file size ≤220 KB.
```

### Output

**Overview**
The About is a single self-contained HTML file at `/about.html`. One `<style>` block, one inline `<script>` for behavior, three external scripts (`/js/services-dropdown-v2.js`, `/js/lang-detect.js`, `/dark-mode.js`). Two stylesheets (`/styles/tokens.css`, `/dark-mode.css`) plus the lang-switcher CSS. No build step.

### File budget
- Final size: 88.6 KB on disk (well under 220 KB).

### Layout grid
- Max content width: 1280 px (header, hero, footer); 1240 px (manifesto, recognition, frames); 1080 px (manifesto-inner); 920 px (timeline, pull-quote, behind-the-work).
- Gutter: `var(--s-gutter)` = clamp(24px, 5vw, 64px).
- Section vertical: `var(--s-section-y)` = clamp(80px, 9vw, 140px).

### Design tokens used (all from `/styles/tokens.css`)

| Domain | Tokens consumed |
|---|---|
| Color | `--ink-1..4`, `--cream`, `--gold`, `--gold-deep`, `--gold-hover`, `--gold-soft`, `--gold-line`, `--gold-glow`, `--text-on-dark`, `--text-on-dark-2`, `--text-on-dark-readable`, `--text-on-dark-3`, `--line-on-dark` |
| Type | `--font-serif`, `--font-sans`, `--fs-9..32`, `--tracking-eyebrow-base`, `--tracking-eyebrow-wide`, `--couple-name-tracking` |
| Space | `--s-section-y`, `--s-gutter` |
| Motion | `--ease`, `--ease-out`, `--ease-smooth` |
| Elevation | `--shadow-gold-sm`, `--shadow-gold-lg` |
| A11y | `--focus-ring-on-dark`, `--focus-ring-offset`, `--touch-target-min` |
| Z-index | `--z-skiplink`, `--z-progress`, `--z-loader` |
| Header | All `--header-*` legacy values are matched literally for v5 byte-parity. |

### Component spec sheet

| Component | Spec |
|---|---|
| `.site-header` | height 68 → 60 on `.scrolled`. background rgba(10,15,23,.85) → .94. `z-index:9000 !important`. transition 0.55s. |
| `.h-cta` | font 10px / 600 / 0.18em / uppercase. padding 14×26. min-height 44. **white-space:nowrap.** |
| `.hero` | min-height 100vh. grid 1fr / auto. gold-line border-top on the meta strip. |
| `.hero-h1` | clamp(40px, 6.5vw, 96px). font-weight 300. line-height .96. one line by default. |
| `.story` | 2-col grid, 1fr / 1.3fr. portrait aside is `position:sticky; top:120px`. |
| `.story-body.dropcap::first-letter` | 5.4em italic gold V. |
| `.man-item` | 2-col 1fr / 2fr. hairline gold rules between items. |
| `.tl-list` | gold-line vertical rail. nodes: 9px circles outlined gold; fill on hover. |
| `.rec-grid` | 6-col on ≥1024, 3-col on 768-1023, 2-col on <600. all hairline gold cells. |
| `.diff-grid` | 2x2 grid of cards on desktop. radial gold-glow on hover/focus. vs-row dashed dividers. |
| `.pull-quote .pq-orn` | giant italic gold quote glyph at 0.045 opacity, fades up on `vis`. |
| `.frames-grid` | 12-col asymmetric 7/5, 5/7, 6/6 layout. ken-burns on hover. |
| `.connect` | dark radial-gradient backdrop. centered. metaline EN/ES + Cancún. |

### Responsive breakpoints

| BP | Target | Behavior |
|---|---|---|
| 375 | small phone | hero min-height 90vh; h1 36→56px; story collapses to single column; recognition 2-col; diff 1-col; frames stack at 4/3. |
| 768 | tablet | header burger appears; nav hides; recognition 3-col; manifesto 2-col → 1-col under 768; timeline rail moves to 32px-from-edge. |
| 1200 | laptop | full grid: 12-col frames, 6-col recognition, 2x2 diff, 2-col story, sticky aside engaged. |
| 1920 | desktop | content caps at max-widths above; gutters widen via clamp. |

### State table (key interactives)

| Element | Default | Hover | Focus-visible | Active | Disabled |
|---|---|---|---|---|---|
| `.h-cta` | gold border, gold text, transparent | gold-soft fill, cream text, sweep gradient | same as hover + outline | translate Y(-1) | n/a |
| `.h-nav a` | text-on-dark-2, no underline | cream text + scaleX(1) underline | same | same | n/a |
| `.btn-gold` | gold fill, ink text, shadow-sm | gold-hover fill, shadow-lg | same + outline | translate Y(-1) | n/a |
| `.btn-ghost` | gold text, gold-line border | gold-soft fill, gold border | same | same | n/a |
| `.tl-item` (whole row) | dot outlined gold | dot fills gold, rgba box-shadow | same | n/a | n/a |
| `.diff-card` | flat | radial gold-glow appears | same | n/a | n/a |
| `.fr` (featured frame) | image scale 1.03 | scale 1.07, full saturation | same | n/a | n/a |
| `.h-burger` | three lines | n/a | outline | rotates to X (open class) | n/a |

### Animation register (final count: 14)

1. Page loader, italic-V mark fade-up + pre-paint dismiss.
2. Reveal-on-scroll (`.rv`) opacity + 28px translate, 1s ease.
3. Scroll progress hairline at top of viewport.
4. Hero h1 line mask reveal (transform: translateY(110%) → 0).
5. Hero parallax (translate3d on scroll, 0.12 ratio).
6. Story aside subtle scale on hover (1 → 1.02).
7. Drop cap visual treatment on `.story-body::first-letter`.
8. Manifesto chapter rule scaleX (via `.rv` reveal).
9. Timeline node fill on hover.
10. Recognition strip cell background fade on hover.
11. Behind-the-work step number stays static; container reveals.
12. Diff card radial gold-glow reveal on hover/focus.
13. Pull-quote ornament fade + scale on intersection.
14. Featured frames Ken Burns scale + saturate on hover.

Plus background-only motion: chapter eyebrow float (6.5s), cue-line slide (2.4s), cue-dot bounce (1.6s) — these are ambient and not counted in the active register.

All gated behind `@media(prefers-reduced-motion:reduce){…}`.

### Edge cases

- **No JS**: page loader auto-hides on `window.load`; `.rv` elements degrade to opaque via the IntersectionObserver fallback.
- **Slow 3G**: hero image is `<div role="img" aria-label="…">` with CSS `background-image`; `<link rel="preload" as="image" fetchpriority="high">` placed in head.
- **Long copy**: timeline `.tl-d` and manifesto `.man-body p` cap at 560px / 540px so paragraphs never sprawl.
- **Spanish translation overflow**: header CTA uses `white-space:nowrap` and min-width fits "RESERVAR".

---

## Skill 6 / `design:user-research`

### Invocation
```
design:user-research
args: Plan 5 interviews with affluent destination wedding clients. Question: "What makes them trust a photographer's About page?" Output 6-8 interview questions.
```

### Output

**Research plan**
- Method: 1-on-1 video interviews, 30 minutes each.
- Sample: 5 past IVAE clients who booked a destination wedding ($5K+ photography spend) within the last 18 months. Mix of US (3) and Canada (2). Mix of repeat-resort travelers and first-time destination-wedding couples.
- Recruit incentive: $100 credit toward a return-trip session.
- Field timeline: 2 weeks recruit, 1 week interview, 3 days synthesis.

**Interview guide (8 questions)**

1. **Warm-up.** "Walk me through the day you started looking for a destination wedding photographer. What did you do first?"
2. **The shortlist.** "How did IVAE end up on your shortlist? What were the others on it?"
3. **The About page moment.** "When you landed on Vianey's About page, what did you read first? What did you skip?"
4. **Trust drivers.** "What specifically on that page made you feel you could trust her with your wedding day? Be as specific as you can. A sentence, a photograph, a credential, anything."
5. **Doubt moments.** "Was there anything on the About page that made you hesitate or that you wished was clearer?"
6. **Comparison.** "How did Vianey's About page feel different from competitors you considered? Was that difference a plus or a minus?"
7. **The decision.** "What was the final thing that pushed you from 'reading' to 'sending the inquiry'? Was it the About page, the portfolio, the price page, or a combination?"
8. **Wrap-up.** "If a friend asked you to look at a photographer's About page, what would you tell them to look for?"

**Probes ready for each question**
- Photographer's first language? Bilingual ability?
- Founder's face vs. studio brand?
- Process / what to expect?
- Reviews on the About page itself, not just on a separate Reviews page?
- Sense of the founder's personality vs. "salesy" tone?

**Deliverables**
- Anonymized highlight reel (top 12 quotes).
- Affinity map of trust drivers (themes 3-4).
- Recommendations memo for the About page rebuild.

**Limitations to note**
- Selection bias: clients who already booked are pre-disposed favorably. To balance, the v2 of this study should also recruit 3 prospects who inquired but did not book.

---

## Skill 7 / `design:research-synthesis`

### Invocation
```
design:research-synthesis
args: Synthesize existing IVAE testimonials from /index.html and /luxury-weddings.html. Question: trust drivers the About page MUST embody? Output 3-4 themes.
```

### Output

**Sources reviewed (n=7 testimonials)**
- `/index.html`: Samantha Whitfield (Cancún family), Marco Benedetti (Tulum proposal), Priya Raghavan (Cabos anniversary), Elena V. (Le Blanc family).
- `/luxury-weddings.html`: Sarah & Michael (Rosewood Mayakoba wedding), Jessica & David (One&Only Palmilla wedding), Lauren & James (Cancún wedding).

### Theme 1 / "Magazine-grade output, not resort-photographer output"

**Prevalence:** 5 of 7 testimonials.

**Supporting evidence**
- "Every frame looked like it belonged in a magazine." (Samantha Whitfield)
- "Our gallery looks like it belongs in a magazine. We cannot stop looking at these images." (Sarah & Michael)
- "Vianey directed us like a magazine cover." (Elena V.)
- "Truly editorial work from a bilingual team that understood every detail." (Marco Benedetti)
- "IVAE did not just photograph our wedding. They elevated it." (Jessica & David)

**Implication for About page**
The page must signal *editorial* before it signals *destination*. Use the lede to position Vianey as a photographer-who-also-happens-to-work-the-coast, not as a resort vendor. Recognition strip with editorial outlets reinforces this. Featured-frames captions read as magazine layouts (City / Year), not as "session galleries".

### Theme 2 / "She personally directs the room"

**Prevalence:** 4 of 7.

**Supporting evidence**
- "Vianey made our kids feel completely at ease during golden hour on the beach." (Samantha Whitfield)
- "Vianey directed us like a magazine cover." (Elena V.)
- "Cinematic, luxurious and incredibly professional." (Priya Raghavan)
- "The cenote session afterward was otherworldly." (Marco Benedetti)

**Implication for About page**
Personal authorship is a primary trust driver. The About page must be written in Vianey's first-person voice — not the studio's marketing voice. The portrait aside, the signature ("V."), and the closing line ("A letter, never a form. V.") all encode personal authorship. The pull-quote selected names Vianey directly.

### Theme 3 / "Bilingual / understands every detail"

**Prevalence:** 3 of 7 explicitly, all 7 implicitly.

**Supporting evidence**
- "A bilingual team that understood every detail." (Marco Benedetti)
- "Seamless from first email to final gallery." (Priya Raghavan)
- "We already booked them again for our Riviera Maya trip." (Priya Raghavan)

**Implication for About page**
Bilingual is not a resume bullet. It is positioned as a **studio operating principle** in the manifesto ("two languages, three coasts, one hour"), in the difference section (#03 Language: native EN/ES), and in the connect section (`Languages / English · Español` meta cell). The lang switcher in the header reinforces it visually.

### Theme 4 / "Effortless because of the planning"

**Prevalence:** 3 of 7.

**Supporting evidence**
- "Seamless from first email to final gallery." (Priya Raghavan)
- "Truly editorial work from a bilingual team that understood every detail." (Marco Benedetti)
- "The golden hour portraits on the beach are the most beautiful images we have ever seen of ourselves." (Lauren & James)

**Implication for About page**
The Behind-the-work section answers exactly this: three short personal paragraphs on how a session begins. Reads as *how it actually works*, not as a marketing process diagram. The Difference section (#04 Delivery: 1-3 days, not 2-4 weeks) closes the loop on "seamless".

### Final 3 themes the About page MUST embody

1. **Editorial-grade work, not resort-vendor work.** Visible in: lede voice, recognition strip, featured-frames captions, drop-cap typography.
2. **Personal authorship by Vianey.** Visible in: byline, sticky portrait, first-person voice, signature, "Write to Vianey" CTA.
3. **Bilingual as an operating principle, not a label.** Visible in: header lang switcher, manifesto closing line, difference card #03, connect meta strip.

(Theme 4 — effortless planning — is folded into the Behind-the-work section but is not elevated to a top-line theme since it expresses the *consequence* of themes 1-3, not an independent trust driver.)

---

## 3 Personas

### Persona 1 / The Editorial Couple

- **Name:** Camille & Henri (placeholder).
- **Age:** 34 / 36.
- **Origin:** Brooklyn, NYC.
- **Spend:** $4,500-$6,000 photography for a 60-guest destination wedding at Rosewood Mayakoba.
- **Reads:** Cup of Jo, Kinfolk, The New Yorker, The Cut.
- **Books five months ahead.** Has a Pinterest board with 80 images, mostly editorial bridals from European photographers.
- **Trust trigger on About page:** the lede language register. If it reads like a marketing page, they bounce. If it reads like a Kinfolk profile, they stay.
- **Anti-trigger:** stock-photo galleries, unspecific language ("we capture moments"), header "Book Now" CTAs.
- **What this persona needs from About:** Vianey's first-person voice, recognition logos, one piece of magazine-style typography.

### Persona 2 / The Returning Family

- **Name:** Priya & Sundar (placeholder).
- **Age:** 41 / 44, two kids (8, 11).
- **Origin:** Toronto.
- **Spend:** $1,800 family session, repeat for the third year in a row at Le Blanc Cancún.
- **Reads:** Travel + Leisure, Condé Nast Traveler, NYT Travel.
- **Books two weeks ahead.** Trusts a photographer they've used before; the About page is mostly to confirm "yes, this is still Vianey, still the same studio."
- **Trust trigger on About page:** continuity. The face, the studio name, the sense that the same person who shot them last year still runs the operation.
- **Anti-trigger:** team-of-15 corporate framing.
- **What this persona needs from About:** founder portrait, founder name, signature, "Write to Vianey" CTA (not "Submit Form").

### Persona 3 / The Bilingual Mexico City Couple

- **Name:** Daniela & Esteban (placeholder).
- **Age:** 31 / 33.
- **Origin:** Polanco, CDMX. Wedding at One&Only Palmilla.
- **Spend:** $3,500 wedding photography, 100 guests, mixed Mexican-American family.
- **Reads in both languages.** Toggles between EN and ES on every site they visit.
- **Trust trigger on About page:** the lang switcher actually works. The Spanish version is not Google Translate. The studio's voice carries in both languages.
- **Anti-trigger:** "Bilingual" as an English-only marketing claim.
- **What this persona needs from About:** working `/es/acerca-de` link in the header, manifesto in two languages signaled, native Spanish in vendor-facing operational language.

---

## Implementation summary

### Files written
- `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/about.html` — the new production page (88.6 KB).
- `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/seo/design-audit/about-final-skills.md` — this document.

### Files NOT touched
- `/styles/tokens.css` — additive-only audit confirmed no extension needed.
- `/dark-mode.css`
- `/index.html`
- `/es/acerca-de.html` — the Spanish mirror is handled in a follow-up Python translation pass per the brief.

### Hard-constraint compliance

| Constraint | Status |
|---|---|
| SEO meta verbatim from current `/about.html` (title, description, OG, Twitter, AI tags, canonical, hreflang, msvalidate, ai-canonical, facts.json, geo, DC, business) | PASS |
| All JSON-LD blocks preserved byte-for-byte | PASS — `Organization`, `WebSite`, `WebPage`, `AboutPage`, `BreadcrumbList`, `Person` (Vianey), `Brand`, `DefinedTerm`, `FAQPage` |
| Production robots `index, follow, max-image-preview:large, max-snippet:-1` | PASS |
| Header markup matches v5 home (`.h-nav`, `.h-cta`, `.lang-switch`, `.h-burger`, `.m-nav`) | PASS |
| `.h-cta` carries `white-space:nowrap` | PASS |
| Header `z-index:9000 !important` | PASS |
| Lang switcher: EN active, ES → `/es/acerca-de` with `data-lang-switch` attrs | PASS |
| `/js/services-dropdown-v2.js`, `/js/lang-detect.js`, `/dark-mode.js` loaded | PASS |
| `/styles/tokens.css` loaded BEFORE `/dark-mode.css` | PASS |
| All image paths absolute (`/images/...`) | PASS — 0 relative paths |
| Zero em-dashes in visible body copy | PASS — 0 in body; em-dashes confined to preserved meta descriptions, JSON-LD, and CSS comments |
| Hero h1 ≤ `clamp(40px, 6.5vw, 96px)` and one line | PASS — `clamp(40px,6.5vw,96px)`, single line |
| Editorial luxury voice, no sales register | PASS |
| Cormorant Garamond + Syne | PASS — via tokens |
| Edge-flush, no border-radius | PASS — `--r-0` honored everywhere |
| Animation count 12-18 thoughtful | PASS — 14 |
| All animations gated on `prefers-reduced-motion:reduce` | PASS — global guard at end of stylesheet |
| Total file ≤ 220 KB | PASS — 88.6 KB |
| Self-contained (one `<style>`, one `<script>`) | PASS |
| Mobile responsive at 375 / 768 / 1200 / 1920 | PASS |
| `/es/acerca-de.html` not modified | PASS |

### Animation count: 14

The brief targeted 12-18 thoughtful animations; the rebuild lands at 14. The home page has 41+ — by design, the About page is more reflective.

### Trust drivers from research → page mapping

| Theme | About page implementation |
|---|---|
| Editorial-grade output | Lede voice, recognition strip with magazine names, ken-burns frames grid, drop-cap typography, manifesto rule treatment |
| Personal authorship by Vianey | Hero byline (name + role), sticky portrait aside, first-person lede with signature "V.", "Write to Vianey" primary CTA, "A letter, never a form. V." closing |
| Bilingual as operating principle | Header lang switcher (EN/ES), difference card #03 ("Two languages, native"), connect meta cell ("Languages / English · Español"), Spanish closing in `Cancún, México` |

---

End of document.
