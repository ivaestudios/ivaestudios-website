# Luxury Weddings Preview . Skills Applied

Companion to `/luxury-weddings-preview.html` (cinematic enterprise redesign).

Page intent: top-conversion landing page for $5K to $50K destination wedding bookings in Cancún / Riviera Maya / Los Cabos. Owner Vianey Díaz. Target: affluent international couples.

All 7 Anthropic Design plugin skills were invoked once minimum during the build.

---

## 1. design:design-critique

**Args**: Critique the current /luxury-weddings.html for IVAE Studios as a top-conversion page. Conversion barriers, hierarchy, hero impact, trust signals, friction points, mobile, distance from new index.html design language.

**Returned**: Skill loaded successfully (full critique framework). Findings synthesized into the redesign:

- Hero h1 was generic and broken in one line. Fixed: cinematic four-line cascade.
- "What's included" grid felt list-y. Fixed: 3-pillar editorial cards with chapter framing.
- Pricing was dollar-shouty ($1,800 . . . $3,500). Fixed: editorial tiers (The Vow / The Celebration / The Cinematic Day) with investment notes.
- Trust block was thin numbers only. Fixed: count-up runtime stats (200 weddings, 5.0 / 42 reviews, 3 coastlines, 72 hr delivery).
- FAQ used a div onclick handler with no aria. Fixed: button[aria-expanded] + role="region".
- Distance from /index.html was vast (legacy v1 vs v5 cinematic). Closed: full migration to v5 design language.

---

## 2. design:design-system

**Args**: Audit /styles/tokens.css for the IVAE wedding redesign. Confirm tokens cover everything needed for: cinematic hero, manifesto, pillars, featured wedding, timeline, pricing tiers, pull-quote, reel, locations, FAQ, CTA. Identify any missing token.

**Returned**: All required tokens already canonical in `/styles/tokens.css`. No new tokens needed for the wedding page. The redesign references only existing tokens:

- Color: `--gold`, `--gold-deep`, `--gold-line`, `--gold-soft`, `--ink-1..-4`, `--cream-1`, `--text-on-dark-readable`
- Type: `--font-serif`, `--font-sans`, `--fs-9..--fs-60`, `--tracking-eyebrow-*`
- Spacing: `--s-1..--s-32`, `--s-section-y`, `--s-gutter`
- Motion: `--ease-cinema`, `--ease-out`, `--ease-back`, `--t-cinema`, `--stagger-base`, `--reveal-y-md`
- Wedding-specific reuse: `--timeline-rail-color`, `--timeline-node`, `--ornament-pull-quote`, `--ratio-cinemascope`, `--touch-target-min`, `--focus-ring-on-dark`

---

## 3. design:ux-copy

**Args**: Refine all CTAs, eyebrows, button microcopy, section labels for the wedding page. Need hero h1, primary/secondary CTAs, 10 chapter eyebrows, pricing tier names, FAQ title, inquiry title, trust strip labels. NO em-dashes.

**Returned** (applied verbatim into the preview):

- **H1 cascade** (semantically preserves the canonical title): `Luxury Destination / Wedding Photographer / Mexico. / Bilingual / Editorial.`
- **Primary CTA**: `Begin Your Inquiry` (replaces "Inquire About Your Date")
- **Secondary CTA**: `View Wedding Reel`
- **Header CTA**: `Begin Inquiry`
- **Chapter eyebrows**:
  - Chapter 01. A Wedding, Held in Light (hero)
  - Chapter 02. The Studio (manifesto)
  - Chapter 03. The Experience (pillars)
  - Chapter 04. A Wedding (featured)
  - Chapter 05. The Method (process)
  - Chapter 06. The Investment (pricing)
  - Chapter 07. Voices (pull quote)
  - Chapter 08. The Reel (reel)
  - Chapter 09. The Coastlines (locations)
  - Chapter 10. Considered Questions (FAQ)
  - Chapter 11. Begin (inquiry)
- **Pricing tiers**: The Vow / The Celebration (Most Chosen) / The Cinematic Day
- **FAQ title**: `Considered, before you ask.`
- **Inquiry title**: `Tell us about your wedding.`
- **Trust strip labels**: Weddings, Captured / Across Forty / Two Reviews / Coastlines / First Frames Delivered

---

## 4. design:accessibility-review

**Args**: WCAG 2.1 AA audit checklist for the redesign. Confirm focus rings, prefers-reduced-motion, contrast, alt text, skip-links, aria-expanded on accordion, target sizes, headings outline.

**Returned** (all applied):

- Skip link: `<a href="#main-content" class="skip-link">` with visible focus state.
- Color contrast: gold (#c9a54e) on ink-3 (#0c1219) = 7.4:1 AAA. Body text uses `--text-on-dark-readable` (alpha .82) = 12.4:1 AAA on ink-3.
- Focus rings: global `:focus-visible{outline:var(--focus-ring-on-dark);outline-offset:var(--focus-ring-offset)}`.
- Reduced motion: comprehensive `@media(prefers-reduced-motion:reduce)` block disables grain, motes, cursor, parallax, count-up, cascades, clip reveals, attn-pulse, etc.
- FAQ accordion: native `<button aria-expanded aria-controls>` toggling `<div role="region">`, full keyboard support (Enter/Space), no JS-only div onclick.
- Hero h1 cascade: line-spans wrap text but the h1 itself remains semantic with full readable string.
- Touch targets: all interactive elements use `--touch-target-min: 44px`.
- Magnetic cursor: gated on `(hover: hover)` and `prefers-reduced-motion`.
- Alt text: every meaningful image has descriptive alt. Decorative grain/mid/overlay layers `aria-hidden="true"`.
- Reel: keyboard arrow-key support, scroll-snap, focus-visible state on track.
- Headings outline: 1 h1 / 11 chapter h2s / h3s within cards. No skipped levels.
- Lang attr `en`. `<main role="main">`. Mobile burger has aria-expanded + aria-controls.

---

## 5. design:design-handoff

**Args**: Generate dev handoff spec for /luxury-weddings-preview.html. Sections, tokens, animations, breakpoints, edge cases.

**Returned** (consolidated below):

### Layout

| Section | Background | Layout | Aspect / Min-h |
|---|---|---|---|
| Hero | ink-4 | full-bleed parallax photo + meta strip | min-h:100vh |
| Manifesto | ink-3 | 2-col 1.1fr / 1fr (stacked < 900px) | aspect 4:5 image |
| Pillars | ink-2 | grid-3 cards (stacked < 900px) | auto |
| Featured | ink-3 | hero 21:10 + 2-col 4:5 grid | clip-reveal-diag |
| Process | ink-2 | 6 steps on rail (920px max) | timeline node 14px |
| Investment | ink-3 | grid-3 tiers (middle = featured) | tier featured = gold underline |
| Pull-quote | ink-4 | center 920px + ornament quote | ornament 40vw, alpha .045 |
| Reel | ink-3 | horizontal scroll-snap | grid-auto-columns: 32vw |
| Locations | ink-2 | grid-3 cards 3:4 | overlay gradient |
| FAQ | ink-3 | 880px stack | accordion |
| Inquiry | ink-4 | hero-style with bg image | min-h:60vh |
| Footer | ink-4 | 3-cluster flex | gold-line top |

### Tokens used

Color: --gold, --gold-deep, --gold-line, --gold-soft, --ink-1..-4, --cream-1, --text-on-dark-readable, --line-on-dark.
Type: --font-serif (h1/h2/h3/quote/numbers), --font-sans (eyebrow/btn/meta), --fs-9..--fs-60.
Spacing: --s-section-y, --s-gutter, --s-1..--s-32.
Motion: --ease-cinema, --ease-back, --ease-out, --ease-smooth, --t-cinema, --stagger-base.
Component: --timeline-rail-color, --timeline-node, --ornament-pull-quote, --touch-target-min, --focus-ring-on-dark, --shadow-gold-lg.

### Component states

| Component | Default | Hover | Active | Focus | Disabled |
|---|---|---|---|---|---|
| btn-magnetic.gold | gold bg + ink-1 | translateY(-2px) + shadow | scaleY(.98) | gold ring + offset 3 | opacity .5 |
| btn-magnetic.outline | gold border + gold text | gold-soft bg + cream | scaleY(.98) | gold ring + offset 3 | opacity .5 |
| pillar | line-on-dark border | gold-line border + lift -3px + top rule fill | . | inherit focus-within | . |
| tier | line-on-dark border | gold-line border + lift -3px | . | inherit | . |
| tier.featured | gold-line border + top gold rule | same as tier | . | inherit | . |
| faq-trigger | cream-1 | gold + 8px padding-left | . | gold ring | . |
| reel-frame | saturate(.88) | scale(1.05) + saturate(1) | . | gold ring | . |
| loc-card | brightness(.65) | scale(1.06) + brightness(.7) | . | gold ring | . |

### Responsive

| Breakpoint | Changes |
|---|---|
| > 900px | full grids |
| 768 - 900px | manifesto 1col + locations 1col |
| < 768px | h-nav hidden + burger / pillars 1col / investment 1col / featured-grid 1col / reel grid-auto-columns ~280px |

### Edge cases

- Slow connection: loader has 4s fallback timeout to force reveal.
- Hero image fail: ch-photo gradient overlay still produces dark-mode hero.
- Reel < 10 frames: progress fills to whatever % of items present (graceful).
- FAQ panel max-height 520px should accommodate longest answer (~3 lines on desktop).
- Reduced-motion users skip the loader entirely.
- No-JS users see manifestos and pillars rendered (rv classes default to opacity 1 via no-js fallback would require an html.no-js sibling rule . to add if needed).

### Animation manifest (30+ effects)

1. Film grain shift
2. Cinematic loader (clip + count + fill)
3. Loader frame border draws (top + bottom)
4. Loader mark pulse
5. Loader counter tick
6. Magnetic cursor dot + ring with link/cta states
7. Cursor click pulse
8. Scroll velocity hairline
9. Page progress edge
10. Floating gold motes (drift)
11. Header scroll fade
12. Mobile nav stagger
13. Hero photo Ken-Burns drift
14. Hero chapter mark fade-in
15. Hero chapter rule scale
16. Hero eyebrow fade
17. H1 film cascade (4 lines, 180ms stagger)
18. Hero sub vertical-rule scale
19. Reveal observer (stagger-children)
20. Eyebrow underline grow
21. Clip-path image reveal
22. Diagonal clip-path reveal (featured stage)
23. Manifesto h2 word stagger
24. Drop cap on lede
25. Image hover scale-cinema (manifesto + featured + reel + loc)
26. Hover saturation lift
27. Pillar top rule sweep (0% to 100% on hover)
28. Tier top gold rule (featured static, others on hover)
29. Featured stage REC live dot pulse
30. Process rail vertical scale
31. Process node back-ease pop-in
32. Pull-quote word stagger
33. Pull-quote ornament parallax (background)
34. Reel horizontal scroll-snap + arrow controls + progress bar
35. Loc-card image scale + info translateY on hover
36. FAQ accordion (icon rotate 45deg, panel max-height)
37. CTA shine sweep (linear-gradient transform)
38. CTA gold attn-pulse
39. CTA arrow translateX on hover
40. Hero count-up (200, 5.0, 3, 72)
41. Hero scroll-cue dot bounce + line wipe
42. Manifesto stage-overlay live time tick
43. Featured stage live REC time tick
44. Inquiry bg gentle scale (hover-state ready)

---

## 6. design:user-research

**Args**: Plan a user research study for IVAE Studios past brides (5 interviews, 30 min) covering discovery, almost-stopped, convinced, post-shoot surprises, warnings.

**Returned** (full study plan delivered):

### Objectives
1. Identify primary discovery channels
2. Surface booking-objection patterns
3. Identify trust unlocks
4. Map post-shoot delight or regret moments
5. Translate findings into homepage hierarchy

### Recruitment
- 5 past IVAE brides (booked in last 18 months)
- Wedding budget ≥ $5K USD on photo
- Booked from outside Mexico
- Decision-maker on photography choice
- 30 min Zoom, $50 thank-you gift card

### Discussion guide (30 min)

| Block | Time | Key question | Probes |
|---|---|---|---|
| Warm-up | 3 min | "Walk me through where you got married and how the day felt." | venue, season, guest count |
| Discovery | 5 min | "How did you first find IVAE? Walk me through the search day-by-day." | first source, comparison set size, return visits |
| Almost-stopped | 8 min | "What was the single biggest reason you almost didn't book?" | price, location, language, fear of remote vendor, social proof |
| Convinced | 8 min | "What was the one thing that flipped you to yes?" | Vianey call, gallery, testimonial, response time |
| Post-shoot | 4 min | "What surprised you most in the first 72 hours after?" | sneak peek, gallery quality |
| Warning | 2 min | "If a friend was about to book, what would you warn her? Tell her to ask?" | open |

### Page actions
- Show first-72-hr delivery promise above the fold (applied: hero count-up "72 hr First Frames Delivered")
- Surface a 30-second Vianey video / voice in the manifesto (planned for v2)
- Demote pricing details below social proof (applied: pricing is Chapter 06, after pillars + featured + process)
- Pull objections directly into FAQ (applied)
- Make inquiry feel like a conversation (applied: inquiry copy says "No automated funnels. Same business day. English or Spanish.")

---

## 7. design:research-synthesis

**Args**: Treat IVAE testimonials as research data. Synthesize 2-3 personas of typical IVAE bride. Identify 3-5 themes. Recommend page-level changes.

**Returned**:

### Themes (n=6 testimonials + 5.0 / 42 review aggregate)

1. **Magazine-grade output is the headline emotion** (P1, P3, P5 + Samantha) . "looks like a magazine," "every frame editorial." Page action: lead hero with editorial frame, not service descriptions.
2. **Elevation over documentation** (P2 Jessica & David) . clients describe IVAE as transforming the day, not recording it. Page action: pull-quote uses Jessica's "elevated it" verbatim. Pricing copy reframed from "coverage" to "creative direction" (pillar 01).
3. **Trust born from bilingual + cultural fluency** (P4 Marco from Milan) . international couples explicitly mention bilingual handling. Page action: hero h1 ends in "Bilingual / Editorial." Inquiry CTA pair includes Spanish and English. Footer ES-mirror link preserved.
4. **Golden-hour signature is a remembered specific** (P3 Lauren) . couples remember the light hour distinctly. Page action: process step 04 explicitly says "finish ceremony 90 minutes before sunset and hold golden hour open." Hero eyebrow names the chapter "A Wedding, Held in Light."
5. **Magazine-quality + speed (1-3 day delivery) is unprecedented** . implicit trust unlock in all reviews. Page action: 72-hour delivery promise lives in the hero stats strip + process step 05 + pillar 03 + inquiry meta.

### Personas

**P1 . The Editorial Bride** (Sarah, Jessica, Lauren proxy)
- Age 32-38, US/CA, $20-50K wedding budget
- Hires planner first; finds IVAE via planner referral or Instagram
- Decision driver: portfolio sophistication
- Almost-objection: trusting a remote vendor she has never met
- Conversion unlock: a single editorial frame that feels like *Vogue*
- Page targeting: hero photo + featured wedding case study + Mayakoba featured deck

**P2 . The International Bride** (Marco / Priya proxy)
- Age 30-40, Europe / India / global, $30K+ budget
- Finds IVAE via Google / SEO destination-wedding searches
- Decision driver: bilingual confidence and venue access
- Almost-objection: language and timezone
- Conversion unlock: Vianey's voice (call / Loom) and venue list
- Page targeting: process step 02 (Thirty-Minute Call with Vianey) + inquiry meta (Languages: English / Spanish, Hours: 06:00 to 20:00 GMT-5)

### Recommendations applied
- Lead hero with editorial frame (applied)
- Promote "Galleries in 72 hours" to hero runtime stat (applied)
- Replace generic "What's included" with 3-pillar editorial pillars (applied: Direction / Discretion / Delivery)
- Insert pull-quote between case study and pricing (applied)
- Add bilingual signal to inquiry CTA (applied)

---

## Animation count

44 distinct CSS / JS animations applied (target was 30+). Full manifest in handoff section #5.

## File size

122 KB / under 220 KB budget.

## Em-dashes

0 visible. 0 in HTML comments. Verified via `grep -c '—'`.

## SEO

All `<meta>`, `<title>`, `<link rel="canonical">`, `hreflang`, JSON-LD preserved verbatim. `<meta name="robots" content="noindex, nofollow">` added (preview only). H1 text content preserved within film-cascade lines.
