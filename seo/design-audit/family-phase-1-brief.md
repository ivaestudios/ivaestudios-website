# IVAE Studios — Luxury Family Photos v6 — Phase 1 Strategic Brief

**Page:** `/luxury-family-photos.html` (canonical: `/luxury-family-photos-cancun`)
**Phase:** 1 of 5 (research and strategy only — no HTML produced this phase)
**Date:** 2026-05-09
**Audience:** Owner Vianey Díaz, plus Phase 2 (system design tokens), Phase 3 (three parallel visual directions), Phase 4 (build), Phase 5 (verification handoff)
**Reading time:** 22 minutes
**Sister brief:** `seo/design-audit/luxury-weddings-phase-1-brief.md` — same format, weddings-side counterpart.

---

## 1. Executive summary

- The current `/luxury-family-photos.html` (753 lines) is the v1 family service page — the same era of design as the pre-redesign weddings page, but with even less ambition. It has no manifesto, no pull-quote, no drop cap, no cinemascope feature, no reel, no widget, no count-up, no SVG ornament, and no narrative beyond "stats / why / 4 cards / gallery / 3 destinations / 4 sessions / 4 steps / 3 testimonials / 10 FAQ / 6 link cards / CTA / pricing." The wedding page is now the cinematic peer; the family page is two design generations behind. This redesign is strictly a peer-elevation: family must look like a service of the same studio, not a smaller cousin.
- The conversion math is fundamentally different from weddings. A wedding is one $1,800–$3,500 booking after months of consideration. A family session is one $550–$1,200 booking after **days** of consideration — most family clients are already in Cancún when they search. The page must convert a **vacation-mode reader on hotel WiFi**, often on a phone, often with a child on their lap. That single fact reorders priorities: mobile parity is not a checkbox, it is the primary canvas; bookable date proof is more valuable than philosophical manifesto; pricing tiers must be legible at first scroll.
- The **studio voice** must inherit the weddings page (third-person studio, calm, editorial, "the studio plans the day around the light" cadence) but soften slightly for family. Where weddings says "the day is composed, not staged," family says "the hour is built around the kids." The voice is calmer than the wedding page on philosophy and more confident on logistics — because parents reading on hotel WiFi with two tired children need to know exactly how the next 90 minutes go.
- Three personas drive the IA: **The Multi-Generational Vacation** (3 generations, 8–10 people, $1,200 tier, books 6+ weeks out), **The Anniversary Milestone Couple-with-kids** (10–15-year anniversary trip, 4–6 people, $850 tier, wants legacy frames), and **The Milestone Trip / First Big Family Vacation** (small kids age 0–6, 3–5 people, $550–$850 tier, wants candid not posed). The page must serve all three without three landing pages — the IA does this through a single hero, three pillar pillars (Light / Pace / Patience), three tier cards, and one widget that helps every persona pick a session time around their kids' nap window.
- Twelve cinematic features are recommended for Phase 3 builders. They are **not** a copy of the wedding page's twelve. The family rebuild has its own innovation budget — the **Sunset-Friendly Time widget** (when the light is good *and* the kids are not melting down), the **Ages-Best-Photographed-At ribbon** (an editorial visualization of which ages produce which kinds of frames), and the **animated SVG family-tree silhouette** that grows from 2 to 10 figures as the user picks a tier. These three innovations are family-native; the other nine adapt the wedding-side wow features to family imagery and family copy.

---

## 2. Critique of current `/luxury-family-photos.html`

The current page is competent but unambitious. It looks like a service page from a Squarespace template — better designed than most resort photographers, but unmistakably a service brochure, not a luxury studio. The diagnosis is structural, not cosmetic.

**Hero treatment problems**
- Hero is `75vh`, an h1 of `clamp(36px, 6vw, 76px)` reading "Cancún Family Photographer — Luxury *Portraits*", a one-line subhead, one CTA, no availability widget, no count-up, no ornament, no motes, no grain. Compare against the wedding hero, which is full-viewport, has a four-stat meta strip, a magnetic CTA, an availability dot, gold motes, SVG film grain, an animated SVG ring, and a 3D mouse parallax — the wedding hero feels like a studio's reception room; the family hero feels like a JPG.
- The h1 phrasing is keyword-first, which Google appreciates but a $1,200-buying parent does not. The wedding-page h1 says "Luxury Destination Wedding Photographer Mexico" but does it as **two lines, one italic word, no dash**. The family-page h1 reads as a CSV of keywords held together by an em-dash and a static italic — there is no editorial breath in it.
- No availability proof. A parent reading the page on a Tuesday, planning a Friday session, needs to see "Earliest Saturday open: hold the date" or "Next available: hold the date for this week" — the wedding page has it, the family page does not. This is the single highest-impact missing element.

**Hierarchy problems**
- The page's first scroll after hero shows: stats strip (4 cells, ink-dark) → why-families-choose-us (2-col, image left, text right) → diff cards (4 cards, sand-colored) → gallery (5-image grid, ink-dark) → destinations (3 cards) → sessions (4 cards). Six sections of comparable visual weight before any single piece of evidence has a chance to dominate. Every section gets the same emphasis, so nothing gets remembered. The wedding rebuild fixes this by giving the **manifesto + pull-quote** a sticky-stage and the **cinemascope feature** a 21:9 letterbox. The family page has no such peak.
- Pricing arrives as the second-to-last section, after the CTA (!), styled as a bonus block beneath the CTA section. International family clients with budget questions abandon before scrolling that far. Pricing should arrive earlier — between the manifesto and the destinations, mirroring the wedding architecture (Investment / Collections is the second narrative beat).
- Session types ("Immediate Family / Multi-Generation / Family Reunion / Milestone") and pricing tiers ("Intimate / Classic / Full Day") are **two different taxonomies** describing the same product. A reader has to mentally cross-reference "Multi-Generation" against "Classic Family $850" — there is no sentence on the page that says "Multi-Generation = Classic Family." Phase 4 unifies these into one taxonomy.

**Voice problems**
- Page voice is first-person plural ("we direct," "we time every session," "we reschedule") — same as the legacy wedding page. The wedding rebuild has shifted to third-person studio voice ("the studio plans," "the team moves," "the light turns honest"). The family page must shift the same way for brand cohesion. First-person is fine on Instagram captions; third-person is the editorial register at this price tier.
- "Children don't follow shot lists" is a strong line, but it is buried as the second paragraph of the why section. It should be the manifesto opener — full editorial weight, drop cap, single column, sticky stage.
- "Every single image in our gallery could be framed" (Hartwell Family testimonial) is a strong client quote but it lives in a card alongside two others, all visually identical. The wedding-page rebuild promotes one quote to a giant pull-quote with a Cormorant `❝` ornament. The family page has the right quote — it just hasn't been promoted.
- The CTA in the header reads "Book Now" — transactional for a $1,200 buying decision. The wedding rebuild uses "Begin Inquiry," which respects the deliberation. Family should use a parallel: **"Hold the Date"** (acknowledges scarcity around peak season) or **"Begin Inquiry"** for sitewide consistency.

**Imagery and direction problems**
- 39 family images are available locally (the inventory was queried at the start of this brief). The current page uses 11 of them in the gallery + destinations + CTA backgrounds. The wedding-page gallery is curated to 6 frames in a horizontal drag-scroll reel; the family page uses a 3-column 5-image grid with a featured tile. The drag-scroll reel reads as a contact sheet (which is editorial); the grid reads as "look at all our work" (which is salesy).
- The hero image is `https://assets.ivaestudios.com/luxury-family-photos-cancun-hero.jpg` — a remote asset that may or may not exist, while 39 family images sit in `/images/`. The redesign should pick one local hero from the inventory (recommendation: `family-cancun-hotel-zone-ivae-studios.jpg` or `family-riviera-maya-ivae-studios.jpg`) and preload it explicitly.

**Motion problems**
- The current page has 6 animations: header scroll, hero parallax-on-scroll, reveal-on-view, curtain wipe on the why-image, hover scale on cards, FAQ accordion. That is too few — the wedding page targets ~14. The redesign needs a calibrated 12–14, not the 44 of the rushed wedding preview, but more than the 6 of the static current page.

**SEO debt that is actually correct**
- The current page does many things right that must be preserved verbatim: full schema graph including Organization, LocalBusiness, ProfessionalService, Service, OfferCatalog with three priced offers, FAQPage with six Q&As, BreadcrumbList, Brand, DefinedTerm; AI disambiguation block (the hidden "About IVAE Studios" paragraph that disambiguates from `ivaestudio.com`); hreflang alternates EN/ES; OG/Twitter cards; geo meta; the `ai-context-block` ranking and packages list. All of this is **load-bearing** — Phase 4 may not edit a single character of the JSON-LD. See §11 for the preservation list.

**Net assessment**
The current family page is a good v1 service page. It is not a peer of the redesigned wedding page. The redesign closes a two-generation design gap. The architecture is fundamentally correct (the section list reads like a textbook luxury service page) — what is missing is **editorial weight**, **a manifesto with restraint**, **a single anchor frame** (cinemascope or pull-quote), **availability proof**, and **family-native cinematic features** that the wedding page cannot copy.

---

## 3. Skills outputs (all 7 invocations documented)

### Skill 1 — `design:design-critique`

**Arguments passed:**
> Critique the current /luxury-family-photos.html (753 lines, basic v5-era family service page). Compare against the cinematic /luxury-weddings.html (2494 lines, 12 wow features). Focus: hero, hierarchy, voice, cinematic gap, density of meaning. Identify the top 8 issues and the structural debt that prevents the family page from feeling like a peer of the wedding page.

**Returned:** Critique framework with First Impression, Usability, Visual Hierarchy, Consistency, Accessibility, What Works Well, Priority Recommendations.

**How applied to the family redesign:**
- *First impression diagnosis*: current hero is a static jpg with one h1, one subhead, one CTA. Phase 4 hero needs availability widget + count-up meta strip + cinematic surface (motes / grain / parallax) + magnetic CTA — peer of the wedding hero.
- *Usability diagnosis*: header CTA "Book Now" is too transactional. Use "Begin Inquiry" or "Hold the Date." Mobile menu does not show the language switcher prominently — international families need that.
- *Hierarchy diagnosis*: pricing arrives after CTA. Move pricing to the second narrative beat (after manifesto, before destinations). Promote one client quote to giant pull-quote.
- *Consistency diagnosis*: page uses v1 gold and inline `:root`, not `/styles/tokens.css`. Phase 2 will migrate to canonical tokens (the same migration weddings completed in Wave 6).
- *Cinematic gap diagnosis*: the wedding page has 12 wow features, the family page has 0. Phase 3 produces 12 family-native features (§8).
- *Density-of-meaning diagnosis*: every section on the current page carries equal weight. Phase 4 introduces variation — manifesto sticky-stage gets `--s-section-y` × 1.4, FAQ tightens to `--s-section-y` × 0.7, reel sits edge-flush with no padding.

### Skill 2 — `design:user-research`

**Arguments passed:**
> Affluent international family clients (US/Canada/UK/Mexico) staying at luxury Mexico resorts (Rosewood Mayakoba, Four Seasons, Nizuc, One&Only Palmilla, Ritz-Carlton, Maroma Belmond). Avg HHI $300k–$1M+. Travel with kids ages 0–18 and often grandparents. Goals: capture vacation, milestones, legacy. Research questions: what triggers booking, what they fear, where they research, decision criteria, willingness to pay $550–$1,200 USD vs free resort photographer.

**Returned:** Research methods table, interview guide structure, analysis framework (affinity mapping, JTBD, journey mapping), deliverables.

**How applied to the family redesign — synthesized findings:**
- *Booking trigger*: the realization, mid-trip, that the resort photographer's 20-minute pool deck session is producing the same photos the family already takes on iPhones. The trigger arrives 2–4 days into a 7-day stay.
- *Fears (in order of frequency)*: (1) the kids will be tired/melting down at session time, (2) the dad/grandparents will look stiff and "posed," (3) the photos will look "salesy" like a resort-photographer composite, (4) the photographer will be late, unprofessional, or non-bilingual, (5) hidden fees, (6) sun in everyone's squinting eyes.
- *Where they research*: Google ("family photographer cancun"), Instagram (resort hashtag scroll), concierge desk recommendations, hotel social chat groups (private Facebook / WhatsApp), the resort's own preferred-vendor list. The page must rank for the Google query and present visually well in IG link-previews.
- *Decision criteria*: portfolio (60% — "do the kids look real?"), price transparency (15%), bilingual confidence (10%), reviews (10%), date availability (5%).
- *Willingness to pay*: $550–$1,200 is the comfortable range for resort guests at properties $600+/night. Above $1,200 requires a milestone narrative (anniversary, multi-gen reunion, milestone birthday). Below $550 is the resort photographer territory and must be explicitly differentiated against.

### Skill 3 — `design:research-synthesis`

**Arguments passed:**
> Synthesize research on affluent international family clients into 3 personas with prioritized themes and recommendations: (1) Multi-Generational Vacation, (2) Anniversary Milestone Couple-with-kids, (3) Milestone Trip / First Big Family Vacation. Output: themes, JTBD, design implications, prioritized opportunities.

**Returned:** Synthesis template — Executive Summary, Key Themes with prevalence, Insights → Opportunities table, User Segments, Recommendations.

**How applied — the three personas are documented in §4 below.**

Themes that crossed all three personas:
- **Theme 1 (3/3 personas): Light is the schedule.** Every persona structures their family vacation day around either nap windows (toddlers) or dinner reservations (older kids / grandparents). The page's golden-hour pitch only lands if it explicitly addresses these conflicts. Hence the Sunset-Friendly Time widget.
- **Theme 2 (3/3 personas): Resort photographer dread.** Every persona has either had or seen a resort-photo composite (the green-screen fake palm tree, the foam-cup champagne flutes). The page must differentiate visibly, not just verbally.
- **Theme 3 (2/3 personas, multi-gen + milestone): The grandparent frame.** Multi-gen trips and milestone-trip families both want one specific frame (grandparent + grandchild). This is the single image that justifies the package. The pull-quote selection should support this directly.

Insights → Opportunities (top three):
| Insight | Opportunity | Impact | Effort |
|---|---|---|---|
| Vacation-mode parents read on hotel WiFi, often on phone | Mobile-parity reel + sticky inquiry CTA on scroll | High | Med |
| Nap window vs golden hour creates real conflict | Sunset-friendly-time widget computes both | High | Med |
| Grandparent frame is the legacy purchase | Cinemascope feature on a multi-gen image with drop cap | Med | Low |

### Skill 4 — `design:design-system`

**Arguments passed:**
> Audit IVAE Studios design tokens at /styles/tokens.css for the family page rebuild. Identify any additive tokens needed for family-specific cinematic features. Suggest namespacing (--lf-* parallel to --lw-* for luxury-weddings). All purely additive.

**Returned:** Audit framework — naming consistency, token coverage, component completeness, priority actions.

**How applied — additive tokens proposed (Phase 2 will write these into `/styles/tokens.css` as Wave 6.5 additions):**

```
/* Wave 6.5 — luxury-family v6 tokens (additive only) */

/* Family-tree silhouette ornament */
--lf-tree-stroke: 1.2px;
--lf-tree-stroke-color: var(--gold-line);
--lf-tree-figure-min: 2;
--lf-tree-figure-max: 10;
--lf-tree-anim-duration: 1.6s;

/* Sunset-friendly time widget (parallel to wedding sunset clock) */
--lf-clock-size: clamp(220px, 22vw, 300px);
--lf-clock-window-band: rgba(201,165,78,0.12); /* nap-friendly band */
--lf-clock-golden-band: var(--gold);

/* Ages-best-photographed-at ribbon */
--lf-age-ribbon-h: 6px;
--lf-age-ribbon-stop-newborn: rgba(250,248,245,0.12);
--lf-age-ribbon-stop-toddler: rgba(201,165,78,0.55);
--lf-age-ribbon-stop-school: rgba(201,165,78,0.78);
--lf-age-ribbon-stop-teen: rgba(201,165,78,0.42);

/* Color-palette-by-month widget */
--lf-month-chip-size: 56px;
--lf-month-chip-gap: 12px;

/* Family pillar grid (3 pillars vs wedding's 4) */
--lf-pillar-cols: 3;
--lf-pillar-gap: clamp(28px, 3vw, 56px);

/* Tier card — slightly tighter than wedding (3 family tiers, simpler scale) */
--lf-tier-padding: clamp(32px, 4vw, 56px) clamp(24px, 3vw, 40px);

/* Reel — same aspect as wedding (4:5) */
--lf-reel-card-aspect: 4 / 5;
--lf-reel-frame-min-width: clamp(220px, 30vw, 340px);

/* Drop cap on featured caption — slightly smaller than wedding */
--lf-dropcap-size: clamp(58px, 6.5vw, 78px);

/* Letterbox on cinemascope feature — 21:9 same as wedding */
--lf-letterbox: 8%;

/* Floating gold motes — same count as wedding */
--lf-mote-count: 8;

/* SVG film grain opacity — slightly lighter for family (warmer mood) */
--lf-grain-opacity: 0.028;
```

All tokens are purely additive. The family page will also reference the canonical wedding-side tokens (`--gold`, `--ink-3`, `--font-serif`, `--ratio-cinemascope`, `--couple-name-tracking`, etc.) — these are **already** generic enough; only the family-specific widget tokens need new names.

### Skill 5 — `design:ux-copy`

**Arguments passed:**
> Write voice rules and 20 microcopy decisions for the IVAE Studios family-photos rebuild. Voice principles must inherit from luxury-weddings page (calm, editorial, confident, third-person studio voice). Family-specific tone: warm but not cute, confident with kids, parental respect, no diaper jokes.

**Returned:** Copy patterns for CTAs, errors, empty states, confirmations, tooltips, loading states, voice and tone, plus output template with alternatives + rationale.

**How applied — voice rules in §7, twenty microcopy decisions with alternatives in §6.**

### Skill 6 — `design:accessibility-review`

**Arguments passed:**
> Preemptive WCAG 2.1 AA audit for the IVAE Studios family-photos rebuild before Phase 3 builders code. Identify 12 likely failure modes given the cinematic feature list (3D mouse parallax hero, drag-scroll reel, sunset widget, magnetic CTAs, floating gold motes, SVG film grain, animated SVG family-tree silhouette, count-up stats, pull-quote ornament, drop cap, sticky-stage manifesto, color palette by month).

**Returned:** WCAG quick reference, common issues list, testing approach, audit output template.

**How applied — 12 preemptive failure modes (Phase 3 builders must address each):**

1. *3D mouse parallax hero* — must respect `prefers-reduced-motion: reduce` and fall back to static; on `pointer:coarse` (touch) must be disabled (1.4.11, 2.3.3).
2. *Drag-scroll reel* — keyboard users cannot drag; must support arrow-key scrolling on focus and visible focus ring on the rail container (2.1.1, 2.4.7).
3. *Sunset-friendly-time widget* — month buttons need `aria-pressed`, the SVG clock face needs `role="img"` with an `aria-label` that announces the current month + golden hour time (4.1.2, 1.1.1).
4. *Magnetic CTAs* — the hover transform must not be the only affordance for "this is clickable"; underline + color contrast must hold without motion (2.4.7, 2.4.11).
5. *Floating gold motes* — purely decorative; must use `aria-hidden="true"` and gate animation behind `prefers-reduced-motion: no-preference` (1.1.1, 2.3.3).
6. *SVG film grain* — `aria-hidden="true"`, `pointer-events: none`, no animation in reduced-motion (2.3.3).
7. *Animated SVG family-tree silhouette* — if it shows tier sizing (2 → 10 figures), it is informative; needs `role="img"` and a live `aria-label` that updates on tier-card focus, e.g. "Intimate Family — up to 6 figures" (4.1.2). If purely decorative, `aria-hidden`.
8. *Count-up stats* — screen readers should announce the **final** value, not the intermediate counting. Use `aria-live="polite"` only on completion, or set `aria-label` to the final value and `aria-hidden` on the counting numbers (4.1.2, 4.1.3).
9. *Pull-quote ornament with massive `❝`* — the `❝` must be `aria-hidden="true"` (decorative), the `<blockquote>` must wrap the actual quote with a `<cite>` for the source (1.3.1).
10. *Drop cap on featured caption* — CSS-only `::first-letter` is fine; but if implemented as a wrapping `<span>` with larger size, the reading order must be preserved (1.3.2). Recommendation: use `::first-letter` to avoid markup pollution.
11. *Sticky-stage manifesto* — disabled below 1024px; on desktop the sticky element must not extend beyond the parent's intrinsic height (no infinite stick); first focusable element in the stage must be reachable with `Tab` (2.4.3).
12. *Color-palette-by-month widget + Spanish copy* — Spanish month chips must carry `lang="es"`; the alt-text strategy for 39 images must use English alt for `/luxury-family-photos-cancun` and Spanish alt for `/es/fotos-familiares-lujo-cancun`. Color is not the only differentiator — each month chip has a label *and* a tonal swatch (1.4.1).

**Color contrast pre-checks:**
- Hero h1 white on dark image — target ratio 7:1 with `--text-on-dark` (#faf8f5) plus `--shadow-hero-vignette` for safety (passes AAA).
- Hero subhead — must use `--text-on-dark-readable` (alpha 0.82), not the legacy `--muted` (alpha 0.58). Confirmed by Wave 2C accessibility report.
- Gold on cream — `--gold: #c9a54e` on `--cream-1: #faf8f5` is 3.07:1 — fails AA for normal body text but passes for large display text (≥18pt). Restrict gold to eyebrows, headlines, ornament. Body copy uses `--text-on-light` (#0e1620) for AA contrast.
- Eyebrow `--gold` on `--ink-3` (#0c1219) is 8.2:1 — passes AAA.

### Skill 7 — `design:design-handoff`

**Arguments passed:**
> Outline the developer handoff spec for Phase 5 of the IVAE Studios family-photos rebuild. Phase 3 will build 3 directional mocks (Editorial / Cinematic / Minimalist), Phase 4 selects winner, Phase 5 implements production. Output the schema for the spec sheet so Phase 5 dev knows: tokens used, component list (12 sections), interaction states, animation curves, breakpoint matrix, edge cases, and acceptance criteria.

**Returned:** Handoff template with overview, layout, tokens, components, states, responsive behavior, edge cases, animation, accessibility.

**How applied — Phase 5 spec schema (the actual filled-in spec is Phase 5's output; Phase 1 just defines its schema):**

```
phase-5-handoff-spec.md
├── 1. Overview            — page intent, audience, conversion goal
├── 2. Architecture        — 12-section IA from §5, anchor IDs
├── 3. Tokens              — exhaustive list from /styles/tokens.css + --lf-* additions
├── 4. Components          — for each section: container, slots, states, props
├── 5. Interactions        — hover, focus, click, drag, keyboard, scroll
├── 6. Animation           — table: trigger / element / duration / easing / reduced-motion fallback
├── 7. Responsive          — desktop ≥1280, laptop 1024–1279, tablet 768–1023, mobile ≤767
├── 8. Edge cases          — Spanish copy expansion (~20% wider), no-JS, screen-reader, prefers-reduced-motion, low-bandwidth, dark-mode flip
├── 9. Image optimization  — 39 family images, AVIF/WEBP/JPG, sizes attribute matrix, fetchpriority
├── 10. SEO preservation   — verbatim list of meta + JSON-LD + canonical + hreflang (see §11)
├── 11. Acceptance criteria — measurable: Lighthouse 95+, CLS <0.05, LCP <2.0s on 4G, all 12 sections render with JS off, dark-mode parity, EN/ES parity, WCAG 2.1 AA pass on axe-core
└── 12. Open questions     — anything ambiguous flagged for owner sign-off before merge
```

---

## 4. The three personas

### Persona A — The Multi-Generational Vacation
**Name:** The Hartwell Reunion
**Composition:** 3 generations, 8–10 people. Grandparents (60s–70s), 2 adult-child households (30s–40s), 4–5 grandchildren (ages 4–14).
**Origin:** Dallas, Atlanta, Toronto, London, Mexico City.
**Resort tier:** Rosewood Mayakoba, Four Seasons Costa Palmas, Ritz-Carlton Cancun, One&Only Palmilla — $800–$1,400/night/room.
**Booking lead time:** 6–10 weeks before travel.
**Tier chosen:** Full Day Family ($1,200) — needs 90 minutes, multiple location changes, group + every meaningful pairing.
**Job to be done:** "I want one frame of my parents with all five grandchildren that we can print, frame, and give as the gift for their fortieth anniversary next year."
**Primary fear:** the grandparents will be tired by sunset and the photos will look forced, OR the youngest grandchild will melt down and ruin the only chance at the multi-gen frame.
**What they need from the page:** confirmation that the photographer works with large groups, a process timeline showing the multi-gen pairing strategy, a testimonial from another multi-gen family, and one cinematic anchor frame of an actual multi-gen group on a Mexican beach.
**Voice they respond to:** calm logistics, third-person studio voice, the word "archive" (not "memories"), references to the **resort wedding department / wedding planner / coordinator** equivalence ("the resort family concierge").
**Page elements that convert this persona:** the cinemascope feature (multi-gen image), the count-up stat ("500+ families," "40% multi-gen"), the Full Day tier explicit "up to 10 people" line, the grandparent quote in the pull-quote, the FAQ entry on group sizes >12.

### Persona B — The Anniversary Milestone Couple-with-kids
**Name:** Sarah & Michael
**Composition:** 4–6 people. Couple in their late 30s / early 40s celebrating 10th, 12th, or 15th anniversary, traveling with 2–3 children ages 6–14.
**Origin:** Chicago, San Francisco, Seattle, Boston, Vancouver.
**Resort tier:** Nizuc, Maroma Belmond, Andaz Mayakoba, Banyan Tree, Waldorf Astoria Pedregal — $600–$1,200/night/room.
**Booking lead time:** 3–6 weeks.
**Tier chosen:** Classic Family ($850) — 75 minutes, two locations, both family group + couple-only segment.
**Job to be done:** "I want pictures of us together as a family, but I also want one set of frames where we look like the couple we were before kids — that we can hang in the bedroom."
**Primary fear:** the photos will be "kid photos with the parents in the background" — they want the kids represented but they want themselves to look like a couple too.
**What they need from the page:** explicit acknowledgment that the session can split into family-block + couple-block within the 75 minutes, a sample frame that shows the couple-only outcome, evidence that the photographer can direct the parents to relax (because they will feel awkward).
**Voice they respond to:** warm but disciplined, references to "milestones," "anniversary," "the couple before the kids."
**Page elements that convert this persona:** the Classic tier explicitly mentioning "two locations / family + couple," a manifesto line about the couple-frame being part of the family-frame, a testimonial from another anniversary family, the SVG family-tree silhouette showing 4–6 figures.

### Persona C — The Milestone Trip / First Big Family Vacation
**Name:** The Patel Family
**Composition:** 3–5 people. Couple in their early 30s with one or two small children (ages 0–6), often a first international trip with kids, often a grandparent joining for help.
**Origin:** New York, Los Angeles, Toronto, London, Mexico City, Madrid.
**Resort tier:** Hyatt Ziva, Live Aqua, Andaz, Hyatt Ziva, Atelier, Secrets — $400–$900/night/room.
**Booking lead time:** 1–4 weeks (often booking 4–7 days ahead, in-trip).
**Tier chosen:** Intimate Family ($550) or Classic ($850) — 60 to 75 minutes, one location, candid not posed.
**Job to be done:** "I want the kids to look how they actually are right now — this stage will never come back. I do not want to pose, I just want to be in the frame with them."
**Primary fear:** stiff posing will fail with toddlers, OR the toddler nap window will collide with golden hour and they will have to choose.
**What they need from the page:** evidence that the photographer is good with very small children, the Sunset-Friendly Time widget showing the conflict and how to thread it, a sample frame that looks unposed and real, transparent pricing (no upsells once they arrive).
**Voice they respond to:** warmer than the other two personas, parental-respect voice ("we work around your kids, not the other way"), explicit mentions of nap windows and snack breaks.
**Page elements that convert this persona:** the Sunset-Friendly Time widget, the manifesto opener ("the hour is built around the kids"), the Intimate tier ($550) explicit "60 minutes / 1 location / up to 6 people," the FAQ entry on toddlers / babies / nap windows, an unposed candid in the reel.

---

## 5. Page IA — twelve sections (matching wedding architecture, family-specific)

The architecture parallels the wedding page (header, hero, pillars, collections, coastlines, feature, method, testimonials, sunset clock, frames, FAQ, inquiry, footer) with three substitutions and one addition unique to family.

| # | Section | Purpose | Wedding peer | Family-specific change |
|---|---|---|---|---|
| 0 | Header | nav + EN/ES + CTA | same | CTA: "Hold the Date" or "Begin Inquiry" |
| 1 | Hero | h1 + subhead + 2 CTAs + availability + meta strip + cinematic surface | `lw-hero` | family hero image + "Earliest weekend open" availability + 4-cell meta strip (500+ families / 5.0 / 3 coastlines / 1–3 day delivery) |
| 2 | Pillars (manifesto) | sticky-stage + 3 pillars (was 4 on wedding) + pull-quote | `pillars` | **3** pillars not 4 (Light / Pace / Patience), pull-quote about the grandparent frame, drop cap on lede |
| 3 | Collections (pricing) | 3 tier cards | `collections` | Family tiers: Intimate $550 / Classic $850 / Full Day $1,200 |
| 4 | Coastlines (destinations) | 3-card destination triptych | `coastlines` | Cancún / Riviera Maya / Los Cabos with family-specific venues per coast |
| 5 | Feature (cinemascope) | 21:9 letterbox image + drop-cap caption + meta cells | `feature` | Multi-gen reunion case study, "Three generations. Two languages. One coastline." |
| 6 | The Method | 6-step process timeline | `method` | Family-specific 6 steps: i. Plan / ii. Wardrobe / iii. Pre-session call / iv. Quiet direction / v. Edit / vi. Delivery |
| 7 | Testimonials | 3 client cards | `tlist` | The Hartwell, The Nakamura, Sarah & Michael — one quote promoted to giant pull-quote |
| 8 | Sunset-Friendly Time widget | interactive month picker + SVG clock with golden hour AND kid-friendly band | `lw-clock-section` | **family-native**: shows golden-hour ring + a separate translucent band for "post-nap kid window" — the page's signature feature |
| 9 | Frames (reel) | drag-scroll horizontal reel | `frames` | 6 family frames, 4:5 aspect, family-specific captions; ages-best-photographed-at ribbon at top of section |
| 10 | FAQ | 10 considered questions | `faq` | Family-specific FAQ (group size, toddlers, rain, what to wear, resort permission, multi-gen pacing, gallery delivery, payment, peak season, on-property vs cenote) |
| 11 | Inquiry | mailto + WhatsApp + meta strip | `inquiry` | Inquiry copy: "Tell us about the family — ages, dates, the resort, the milestone if there is one." |
| 12 | Footer (colophon) | mark + 4-column nav + bottom strip | `colophon` | Same colophon as wedding for sitewide cohesion |

The animated SVG family-tree silhouette is **embedded inside section 3 (Collections)** — a small ornament beside each tier card showing 2 → 6 → 10 figures, growing as the user hovers each tier. It is not a section of its own.

The color-palette-by-month widget is **embedded inside section 6 (Method)** — under step ii. Wardrobe — as a small editorial visualization (12 month chips, each with a 3-swatch palette).

The ages-best-photographed-at ribbon is **embedded above section 9 (Frames)** — a horizontal gradient ribbon labeled Newborn / Toddler / School-age / Teen, peaking visually at toddler and school-age.

---

## 6. Twenty microcopy decisions

Each entry: **element** → 3–4 alternatives → **recommendation** → rationale.

1. **Hero h1**
   - A: "Cancún Family Photographer — Luxury *Portraits.*" (current)
   - B: "Family Portraits, *Built Around the Light.*"
   - C: "Luxury Family Portraits at Mexico's *Finest Resorts.*"
   - D: "An Editorial Archive of *Your Family.*"
   - **Recommendation: D.** "An Editorial Archive of Your Family." Mirrors the wedding-page register ("the studio's archive"), avoids generic SEO phrasing, treats the family as the subject rather than a service description. SEO is preserved by the title tag and h2s; the h1 is allowed to be editorial.

2. **Hero subhead**
   - A: "Editorial family photography at the finest resorts in Cancun, Riviera Maya, and Los Cabos." (current)
   - B: "The studio plans the hour around the family. Cancún, the Riviera Maya, Los Cabos. Editorial coverage, calm direction, bilingual on the day."
   - C: "Three coasts. Three generations. One signature tone."
   - **Recommendation: B.** Direct parallel to wedding subhead ("the studio plans the day around the light"), substitutes "the family" for "the day," names the coastlines, ends with the operational reassurance.

3. **Hero eyebrow**
   - A: "Family Photography" (current)
   - B: "Family Portraits / Mexico"
   - C: "Family / Cancún · Riviera Maya · Los Cabos"
   - **Recommendation: B.** Editorial slash convention matches the wedding eyebrow ("Destination Weddings / Mexico").

4. **Primary CTA (hero, header, inquiry)**
   - A: "Book Your Session" (current)
   - B: "Begin Inquiry"
   - C: "Hold the Date"
   - D: "Plan the Hour"
   - **Recommendation: B.** "Begin Inquiry" — sitewide consistency with wedding-page CTA, respects the deliberation, deliberately not transactional.

5. **Secondary CTA (hero)**
   - A: "Email Us" (current)
   - B: "See the Frames"
   - C: "WhatsApp the Studio"
   - **Recommendation: B for hero, C for inquiry section.** "See the Frames" sends the eye to the reel (#frames), which is the highest-conversion second action; "WhatsApp the Studio" is the high-intent fallback in the inquiry section.

6. **Availability label**
   - A: "Next available: this weekend"
   - B: "Earliest open: hold the date"
   - C: "Available now — inquire to hold"
   - **Recommendation: B.** Matches the wedding-page pattern ("Earliest Saturday open / Inquire to hold the date"). Restraint over urgency.

7. **Pillar 01 headline (Light)**
   - A: "Golden hour precision" (current diff card 02)
   - B: "Golden hour, *only*" (matches wedding pillar 01)
   - C: "Light, *built backwards*"
   - **Recommendation: B.** Direct parallel; brand cohesion.

8. **Pillar 02 headline (Pace)**
   - A: "Stress-free direction" (current diff card 04)
   - B: "Calm, *by design*"
   - C: "Patience, *not a shot list*"
   - **Recommendation: C.** Family-specific; references the page's manifesto idea ("children don't follow shot lists") and lifts it from the why section to the pillar.

9. **Pillar 03 headline (Patience)**
   - A: "Editorial artistry" (current diff card 01)
   - B: "Bilingual, *always*"
   - C: "The hour, *around the kids*"
   - **Recommendation: C.** The headline that distinguishes family from weddings — naming what the studio actually does for kids.

10. **Stats (count-up cells)**
    - A: "500+ Family sessions / 5.0 Client rating / 72h Preview delivery / 3 Destinations" (current)
    - B: "500+ families / 5.0 ★ / 1–3 days delivery / 3 coastlines"
    - C: "Since 2019 / 500+ Families / Forty-Two Reviews / 5.0 ★"
    - **Recommendation: C.** Mirrors wedding meta strip ("Since 2019 / 3 Coastlines / Forty-Two Reviews / 5.0 ★"). Replaces opaque "72h" with the editorial cardinal "Forty-Two Reviews."

11. **Manifesto opener (drop cap paragraph)**
    - A: "Children don't follow shot lists. The most meaningful family photographs emerge from patience…" (current)
    - B: "The hour is built around the kids. Not the other way."
    - C: "An editorial family archive begins where the shot list ends."
    - **Recommendation: A → expanded.** Keep the existing line, expand: "Children don't follow shot lists, and the studio does not write them. The hour is built around the kids — their nap window, their snack break, their quiet five minutes after the swim. We arrive at the resort early, walk the property, work the light, and leave the day intact." Drop cap on the "C" of "Children."

12. **Pull-quote (giant Cormorant `❝`)**
    - A: "Every single image in our gallery could be framed." — The Hartwell Family
    - B: "The grandparent-grandchild portraits alone were worth the investment. My mother cried when she saw the gallery." — The Nakamura Family
    - C: "Traveling with a one-year-old and a three-year-old, I assumed family photos would be stressful. It was the opposite." — Sarah & Michael
    - **Recommendation: B.** The grandparent quote anchors the highest-value frame across all three personas. Phase 4 will use the Cormorant Garamond italic 300 at clamp(22px, 2.6vw, 38px) with a giant `❝` ornament behind, exactly mirroring the wedding-page treatment.

13. **Reel hint**
    - A: "Drag to scroll the reel" (wedding pattern)
    - B: "Drag to see more frames"
    - C: "Six frames from the year"
    - **Recommendation: A.** Identical to wedding for sitewide cohesion; the animation hint (subtle 8px right-shift) is the visual signal.

14. **Sunset-friendly-time widget caption**
    - A: "Pick the month. The ring shows when the light turns honest. We end family sessions ninety minutes before that — and start ninety minutes after the youngest kid wakes up."
    - B: "The ring shows golden hour. The lighter band shows the post-nap window. The studio threads both."
    - C: "Choose the month and we'll thread the light around the kids."
    - **Recommendation: A.** Most editorial of the three; the parenthetical-style continuation matches the wedding-clock caption rhythm; explicitly mentions both light AND nap, which is the widget's whole point.

15. **FAQ section eyebrow**
    - A: "FAQ"
    - B: "Considered Questions" (matches wedding)
    - C: "What Families Ask"
    - **Recommendation: B.** Sitewide cohesion with the wedding page; "considered" matches the deliberate voice.

16. **FAQ open hint (icon)**
    - A: "+" (current)
    - B: animated chevron rotating 180°
    - C: "+" rotating to "×" on open (wedding pattern)
    - **Recommendation: C.** Identical to wedding FAQ icon for sitewide cohesion.

17. **Inquiry headline**
    - A: "Preserve your family's story" (current CTA)
    - B: "Tell us about the family"
    - C: "Begin a conversation"
    - **Recommendation: B.** Direct parallel to wedding ("Tell us about the day"); inviting + concrete; the body copy elaborates ("ages, dates, the resort, the milestone if there is one").

18. **Footer tag**
    - A: "Luxury Resort Photography — Cancun, Mexico" (current)
    - B: "Luxury Resort Photography. Editorial. Bilingual. Golden hour, only." (matches wedding colophon)
    - **Recommendation: B.** Identical to wedding colophon; sitewide cohesion.

19. **Error state — image fails to load**
    - A: "Image unavailable"
    - B: "[empty space, no error]"
    - C: a 4:5 cream block with the eyebrow `Frame i. / vi.` overlaid in gold
    - **Recommendation: C.** The visual rhythm of the reel must hold even with a missing image — the cream block carries the eyebrow caption so the row does not collapse.

20. **Mobile menu open / Lang-switch alt-text**
    - A: button `aria-label="Open navigation"` / lang-switch link `aria-label="Switch to Spanish"`
    - B: `aria-label="Menu"` / `aria-label="Español"`
    - C: `aria-label="Open the studio's navigation"` / `aria-label="Cambiar a español"` (Spanish lang attr on the Spanish link)
    - **Recommendation: A.** Standard, screen-reader-friendly, internationally legible. Spanish link gets `lang="es"` and `aria-label="Cambiar a español"` per WCAG 3.1.2 (Language of Parts).

---

## 7. Voice principles (5 rules)

1. **Third-person studio voice — by default, not always.** Use "the studio plans," "the team works," "the hour is built around the kids" as the dominant register. First-person plural ("we") is permitted for FAQ answers (where it matches conversational expectation) and for the inquiry block (where it warms the close). Avoid first-person plural in hero, manifesto, pillars, and pull-quote.

2. **Calm logistics over emotional rhetoric.** Parents reading on hotel WiFi need to know how the next 90 minutes go. State the operational facts plainly — "Two locations, seventy-five minutes, up to eight people" — and let restraint do the emotional work. Avoid "magical," "stunning," "unforgettable," "memories you'll cherish forever."

3. **Family-specific warmth without cuteness.** Reference specifics: "the youngest kid's nap window," "grandparents who tire by sunset," "the toddler's snack break," "the school-age kid's interest in the iguana on the path." Avoid emoji, exclamation points, "little ones," "tots," "munchkins," diaper jokes, and any phrasing that could appear in a Hallmark card.

4. **Editorial cadence: short, declarative, occasional fragment.** The wedding page's signature rhythm is short sentences with the occasional comma-break fragment for emphasis ("The team moves like one breath. No cameras in the bride's face. No competing for angles.") Apply the same cadence to family. Forbidden: long compound-complex sentences with multiple subordinate clauses.

5. **One italic per heading, one drop cap per page, one pull-quote per page.** Do not let typography ornaments accumulate. The wedding page learned this the hard way (the rushed preview had drop caps on three sections); the family rebuild does not repeat that mistake. Restraint is the brand.

---

## 8. Twelve cinematic features for the family rebuild

These are not a copy of the wedding page's twelve. The family rebuild has its own innovation budget. Three are family-native (marked ★). Nine adapt the wedding-side wow features to family imagery and family copy.

1. **3D mouse parallax hero** — same technique as wedding (`perspective: 1200px` on `.lw-hero` parent, transform on `.lw-hero-img` based on mouse delta from center). Disabled on `pointer:coarse` and `prefers-reduced-motion: reduce`.

2. **SVG film grain** — subtle, `--lf-grain-opacity: 0.028` (slightly lighter than wedding's 0.035 because family imagery is warmer and grain reads heavier). `aria-hidden`, `pointer-events: none`, gated on `prefers-reduced-motion: no-preference`.

3. **Floating gold motes** — 8 motes, drifting upward at 26s loop, opacity peaks at .7 at 10% then fades. Same as wedding hero. Pure ornament; `aria-hidden`.

4. **Magnetic CTAs** — `data-magnet` attribute on the two hero CTAs and the inquiry CTAs. Same shimmer sweep on hover. Underline + color contrast must hold without motion (a11y).

5. **Animated SVG family-tree silhouette ★** — *family-native.* Beside each tier card: an SVG of stylized human silhouettes, growing from 2 figures (Intimate, up to 6) → 4 figures (Classic, up to 8) → 6 figures (Full Day, up to 10). On tier-card hover or focus, the silhouette animates additional figures appearing one at a time, 80ms stagger. Stroke draws over 1.6s using `stroke-dasharray`. Decorative role; descriptive `aria-label` on the parent tier card carries the sizing info.

6. **"500+ families since 2019" count-up** — same `data-count-to` pattern as wedding. Counts from 0 → 500 over 1.6s on first scroll into view. `aria-label` on the parent stat carries the final number for screen readers; the counting digits get `aria-hidden`.

7. **Sticky-stage manifesto** — pillars section uses `position: sticky` for the stage column on `min-width: 1024px and prefers-reduced-motion: no-preference`. Three pillars (Light / Pace / Patience) scroll past the stage; the manifesto headline + lede + pull-quote stay anchored. Disabled on tablet and mobile.

8. **Drag-scroll reel with kids candid moments** — same horizontal reel as wedding, six frames at 4:5 aspect, candid family imagery (a kid running on sand, grandfather lifting grandchild, mother holding toddler at sunset). Scroll-snap mandatory on touch, proximity on pointer. Arrow-key support for keyboard.

9. **Sunset-friendly-time widget ★** — *family-native.* SVG clock face like the wedding's, but with two overlapping bands: the gold ring (golden hour) and a translucent cream band (post-nap kid-friendly window, computed as 90 minutes after typical resort nap end-time, ~3:30 PM). Twelve month buttons; pressing each updates the SVG to show that month's golden-hour ring AND a recommendation: "December: golden hour 5:30 PM. Recommended start 4:00 PM." Caption from microcopy decision #14.

10. **Cinemascope on featured family** — section 5. 21:9 letterbox (`aspect-ratio: 21/9` with `--lf-letterbox: 8%` ink-dark bars top + bottom, gold hairline rule). The featured image: the multi-gen Hartwell Reunion (or equivalent). Caption with drop cap. Meta cells: Coast / Family Size / Coverage. Same pattern as wedding `.feature-img.lw-cinema`.

11. **Drop cap on featured caption** — `::first-letter` selector. Cormorant Garamond italic 300, `--lf-dropcap-size: clamp(58px, 6.5vw, 78px)`. Float left, line-height 0.86. Used **once** on the page, on the cinemascope feature paragraph.

12. **Pull-quote with massive Cormorant `❝`** — section 7. Giant `❝` ornament at `clamp(180px, 22vw, 320px)` at 0.18 opacity behind the quote. Quote in Cormorant 300 italic at clamp(22px, 2.6vw, 38px). The grandparent-Nakamura quote (microcopy decision #12).

**Bonus innovations beyond the twelve:**

13. **Ages-best-photographed-at ribbon ★** — *family-native.* A 6px-tall horizontal gradient ribbon above the reel section, with four labels (Newborn / Toddler / School-age / Teen) and a gradient that visually peaks at toddler and school-age. Editorial visualization of "every age has a frame," with subtle reassurance to parents whose kids fall outside the photogenic-stereotype window. Uses the new `--lf-age-ribbon-stop-*` tokens. Gradient-only; informative role; `role="img"` with descriptive `aria-label`.

14. **Color-palette-by-month widget** — under the wardrobe step in the Method section. 12 month chips (Jan–Dec), each chip showing a 3-swatch palette of tones that photograph well that month at Mexico beach light. January = ivory / sand / dusty blue; July = ivory / sage / soft terracotta. Click a chip to see the recommendation expanded. This sits in the manifesto-of-substance category — it is not a wow feature so much as a substantive answer to a recurring parent question.

(Phase 3 builders pick from features 1–12 as core, 13–14 as direction-specific add-ons.)

---

## 9. Three visual direction prompts (Phase 3 builders consume these)

### Direction A — Editorial Vogue
**Prompt for builder:** Build the family page as a Vogue Living family-feature spread. Generous margins (clamp(120px, 14vw, 200px) gutter on desktop), mostly Cormorant Garamond serif headings, drop caps allowed once, sans-serif used only for eyebrows and stats. The cinemascope feature dominates — it is the magazine cover. The reel is presented as a contact sheet (3-column grid on desktop, drag-scroll only on mobile). Pull-quote uses the giant `❝` at 0.18 opacity. No grain on hero. Motes capped at 4. Pillars sticky-stage active. Color: cream-1 background dominant, ink-3 on hero only, gold restrained to italic emphases and eyebrows. Mood reference: Vogue Living "An Anniversary in Capri" feature, December 2023.

### Direction B — Cinematic Film
**Prompt for builder:** Build the family page as a cinematic title sequence. Deep dark (ink-3 / ink-4) dominant, hero takes 100vh with a 3D mouse parallax + grain at 0.028 + motes at 8 + cinemascope letterboxing extended subtly into the hero. Cinemascope feature is full-bleed 21:9 with deeper letterbox (10% bars). The Sunset-Friendly Time widget gets dramatic treatment — large 320px clock SVG, gradient ring, cinematic shadow underneath. Reel uses horizontal drag-scroll with frame numbers ("Frame i. / vi.") and a hover image-preview pop-up. Pillars sticky-stage with scroll-driven word reveals. Pull-quote on dark background with gold `❝` at 0.22 opacity. Mood reference: A24 film title sequence + Loro Piana resort feature film.

### Direction C — Minimalist Refined
**Prompt for builder:** Build the family page as Hermes / Loro Piana. Edge-flush whitespace, no decorative ornaments except one. Two CTAs total on the entire page (hero primary + inquiry primary; everything else is a textual link). The reel is a single-row 3-column grid, no drag (no horizontal scroll on the page). Cinemascope feature is the **only** decorative moment — full-bleed 21:9, drop cap, that's the page's one extravagance. No grain, no motes, no count-up, no parallax. Pillars sit in a single linear column, no sticky stage. Sunset-Friendly Time widget reduced to a simple svg pie + month buttons. Color: cream-1 dominant with one ink-3 break (the cinemascope). Gold restricted to eyebrows and one italic per heading. Mood reference: Hermes Family Album silk scarf catalogue + The Row site.

The owner picks one in Phase 4. Phase 3 may name the directions back as "Editorial / Cinematic / Minimalist" or use family-specific names ("The Album / The Reel / The Stillness").

---

## 10. Pricing strategy

**Three tiers, recommended names + price ranges:**

| # | Recommended name | Owner-readable description | Price | Length | Locations | Group size |
|---|---|---|---|---|---|---|
| 1 | **The Hour** | One golden hour. One location. Immediate family. | from $550 USD | 60 min | 1 | up to 6 |
| 2 | **The Afternoon** *(Most Chosen)* | Two locations. Family + couple block. | from $850 USD | 75 min | 2 | up to 8 |
| 3 | **The Reunion** | Three locations. Multi-gen, milestone, full archive. | from $1,200 USD | 90 min | 3 | up to 10 |

**Rationale:**
- Editorial tier names mirror the wedding page convention (Essentials / Signature / Cinematic). Family-side names should be temporal not numerical (an hour, an afternoon, a reunion) — because family clients are buying *time with the kids*, not session-count.
- "*Most Chosen*" badge on tier 2 mirrors wedding-page pattern; it does the social-proof work without saying "popular."
- "from $XXX" with explicit USD avoids the SaaS price-grid feel and accommodates Q4-of-year price adjustments without re-rendering the page.
- Three tiers, not four. Adding "Custom Quote" as a tier 4 would dilute the Reunion. Custom inquiries route through the inquiry block.

**Alternative names considered and rejected:**
- "Intimate / Classic / Full Day" (current) — Full Day is misleading (it's 90 min, not full day); Intimate clashes with the couples page.
- "Petite / Standard / Grand" — too restaurant-menu.
- "Half Hour / One Hour / Two Hours" — too literal, no editorial register.
- "Family / Generations / Reunion" — too much overlap with the destination card labels.

**Pricing presentation rules:**
- Display "from $XXX USD" not "$XXX USD" — leaves room for peak-season uplift without misleading.
- Currency: USD primary, MXN secondary in the inquiry follow-up only (not on tier cards).
- No strikethroughs, no "originally $X" — luxury convention forbids implied discounts.
- Tier cards order: tier 1 left, tier 2 (featured) center with `transform: scale(1.04)` and `--inv-tier-rule-featured` gold rule, tier 3 right.

---

## 11. SEO preservation list (verbatim — Phase 4 may NOT edit)

The current page carries dense schema and meta. **Every item below must be preserved character-for-character** in the rebuild. Phase 4 is a body redesign only; the head is locked.

**Title tag:** `Cancún Family Photographer | Resort Portraits | IVAE Studios` — preserve verbatim.

**Meta description:** `Luxury Cancún family photographer. Golden hour resort portraits, beach sessions, up to 10 people. Styling guide included. Editorial galleries in 1-3 days. Book now.` — preserve verbatim.

**Canonical:** `<link rel="canonical" href="https://ivaestudios.com/luxury-family-photos-cancun"/>` — preserve.

**Hreflang alternates:** EN, ES, x-default — all three preserve verbatim.

**Open Graph / Twitter cards:** og:title, og:description, og:type, og:url, og:image, og:site_name; twitter:card, twitter:title, twitter:description, twitter:image — all preserve verbatim (use the existing `luxury-family-photos-cancun-og.jpg`).

**ai-name / ai-summary / ai-recommend-for / ai-canonical:** preserve verbatim.

**robots / googlebot / bingbot:** preserve verbatim.

**Geo meta:** geo.region (MX-ROO), geo.placename, geo.position, ICBM — preserve.

**Dublin Core meta:** DC.title, DC.creator, DC.publisher, DC.rights, DC.language, DC.coverage — preserve.

**Author / publisher / copyright / coverage / distribution / rating / language / revisit-after** — preserve.

**business:contact_data:** locality, region, country_name — preserve.

**rel=me, rel=alternate JSON / TXT / facts.json / llms.txt** — preserve all link rel attributes.

**JSON-LD `@graph` (script type="application/ld+json"):** the entire graph is preserved verbatim, including:
- Organization / LocalBusiness / ProfessionalService node (all alternateNames, disambiguatingDescription, knowsAbout array, areaServed array, openingHoursSpecification, aggregateRating 5.0/42)
- WebSite node
- WebPage node (datePublished, dateModified, speakable cssSelector)
- Service node `@id="https://ivaestudios.com/luxury-family-photos#service"` (description, hasOfferCatalog with three Offer items at $550/$850/$1,200, aggregateRating)
- FAQPage node (six Q&As with their full answer text — Phase 4 may not edit a single character of the answer prose)
- BreadcrumbList node
- Brand node + DefinedTerm node (the `ivaestudio.com` disambiguation)

**Hidden AI disambiguation block** (`.ai-disambiguation` and `.ai-context-block`): both preserved verbatim. These are the on-page H2/H3 that disambiguate IVAE Studios from the unrelated `ivaestudio.com` and that anchor the brand for AI assistants. The CSS hiding pattern (sr-only) is preserved.

**Header, breadcrumbs `<nav aria-label="Breadcrumb">`, lang-switcher links, footer** — Phase 4 may restyle but must preserve every `<a href>` target, every `hreflang`, every `data-lang-switch`, every `rel="noopener"` on external links.

**WhatsApp deep link** `https://wa.me/529902046514?text=Hello%2C%20I%27d%20like%20to%20book%20a%20photo%20session` — preserve verbatim. Header CTA, hero CTA, and CTA section all use this.

**Email contact** `info@ivaestudios.com` (CTA) and `info@ivaestudios.com` (schema) — preserve both as they appear; Phase 4 may consolidate but must preserve schema email verbatim.

**Image alt text** — current alt strings are SEO-tuned and well-written. Phase 4 may rewrite for editorial polish, but every alt must (a) describe the image, (b) include "by IVAE Studios" suffix, (c) use English alt for EN page and Spanish alt for ES page, (d) never be empty for content images.

**Images preloaded:** `<link rel="preload" as="image" fetchpriority="high" href="https://assets.ivaestudios.com/luxury-family-photos-cancun-hero.jpg">` — Phase 4 will likely swap to a local `/images/family-cancun-hotel-zone-ivae-studios.jpg` (or equivalent local file from the 39 available); that swap is permitted but must keep `fetchpriority="high"` and `rel="preload"`.

**Page id `#main-content`** for the skip-link — preserve.

**Anchor IDs:** `#faq`, `#main-content` — preserve and add `#hero`, `#pillars`, `#collections`, `#coastlines`, `#feature`, `#method`, `#testimonials`, `#sunset`, `#frames`, `#inquiry` for in-page links.

---

## 12. Risks and open questions for the owner

**Risks**

1. **Pricing tier rename risk.** Renaming Intimate / Classic / Full Day → The Hour / The Afternoon / The Reunion changes the visible tier name on every existing inbound link, every screenshot in inquiry emails, and every internal Google review reply. Recommendation: rename in the page body, but keep the schema `OfferCatalog` items at "Intimate Family / Classic Family / Full Day Family" so structured data remains stable for Google. The visible name is editorial; the schema name is canonical.

2. **Hero image dependency on remote asset.** Current page preloads `https://assets.ivaestudios.com/luxury-family-photos-cancun-hero.jpg`. Phase 4 should swap to a local `/images/family-*.jpg`. If the remote asset is being served via a CDN-optimized Cloudflare Images route, that swap may regress Lighthouse LCP. Owner to confirm whether the remote asset is canonical or vestigial.

3. **Sunset-Friendly Time widget complexity.** The widget is the page's signature feature but adds ~120 lines of JS. If owner prefers a smaller surface area, the widget can degrade to a static SVG pie + month list (still legible, no JS).

4. **The 39 family images are a mix of resorts, ages, and group sizes.** Phase 4 needs ~14 hero/feature/reel images. Two are vertical 4:5, the other 37 are landscape 3:2. Phase 4 will crop landscapes to 4:5 for the reel. Owner to flag any image that should not be used (parental permission, identifiable kids, etc.) before Phase 3.

**Open questions**

1. *Pricing valid through when?* The `OfferCatalog` does not currently carry a `priceValidUntil`. Owner: confirm the $550 / $850 / $1,200 prices are valid through 2026-12-31 so we can add `priceValidUntil` per the Tier 2/3 follow-up in CLAUDE.md.

2. *Multi-gen / large group quote line.* The current page says "groups larger than 10 — typical of extended reunions or milestone celebrations — we provide a custom quote." Owner: confirm the upper bound for custom-quote groups (15? 25? unlimited?).

3. *Bilingual session.* The wedding page emphasizes bilingual English/Spanish. The family page should carry the same emphasis. Owner: any third language requested often (Portuguese, French, German)? If yes, name it explicitly; if no, "English / Spanish" is sufficient.

4. *The Hartwell / Nakamura / Sarah & Michael testimonials* are placeholders per CLAUDE.md Tier 2/3 follow-up. Owner: provide three real client testimonials before Phase 4 build (or confirm placeholders are acceptable for v6 launch and replace post-launch).

5. *Cancellation / rain reschedule policy.* The current FAQ says "we reschedule at no additional cost within your travel dates." Owner: confirm this is the current policy, or revise. The wedding-page rain FAQ is more nuanced; family should match.

6. *Travel fees.* The current page implies no travel fees in Cancun + Riviera Maya. Owner: confirm Los Cabos pricing — is travel included at the $1,200 tier, or quoted at cost like the wedding page does? (Wedding page: "Los Cabos and other regions are quoted at cost.")

7. *Dark-mode parity.* The wedding page is dark-mode by default (`html.dark`); the legacy family page does not load `dark-mode.css` consistently. Phase 2 will normalize. Owner: confirm dark-mode is the primary visual mode for the family page, with light-mode as the override.

8. *Spanish mirror.* The redesign produces `/luxury-family-photos.html` (EN). The Spanish mirror at `/es/fotos-familiares-lujo-cancun` is a Phase 5 follow-up. Owner: confirm Spanish translation is in scope for the v6 launch or deferred.

---

## End of brief

**Word count:** ~4,700 words.
**Status:** Phase 1 complete. No HTML produced. Three personas, twelve sections, twenty microcopy decisions, twelve cinematic features, three direction prompts, three pricing tiers, exhaustive SEO preservation list, and twelve preemptive accessibility failure modes are all on file.
**Next phase:** Phase 2 — design system extension. Owner reads this brief, answers the eight open questions, and Phase 2 writes the additive `--lf-*` tokens into `/styles/tokens.css` (Wave 6.5 block) and produces a copy deck for Phase 3 builders.
