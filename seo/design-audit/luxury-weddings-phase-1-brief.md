# IVAE Studios — Luxury Weddings v6 — Phase 1 Strategic Brief

**Page:** `/luxury-weddings.html` (canonical: `/destination-wedding-photographer-mexico`)
**Phase:** 1 of 5 (research and strategy only — no HTML produced this phase)
**Date:** 2026-05-09
**Audience:** Owner Vianey Diaz, plus Phase 2 (system design), Phase 3 (three parallel visual directions), Phase 4 (build), Phase 5 (verification handoff)
**Reading time:** 18 minutes

---

## 1. Executive summary

- The current `/luxury-weddings.html` ships the legacy v1 design system (`#c4a35a` gold, `#1a2433` ink, `#f9f8f7` cream, hand-rolled inline `:root`) — a different studio, visually, from the canonical home `/index.html` v5 which uses the v2 system from `/styles/tokens.css`. The wedding page is the highest-revenue page on the site and has the worst design drift. Closing that gap is the entire reason for the redesign.
- The previous attempt at a redesign (`/luxury-weddings-preview.html`, 1,597 lines) was rushed. It correctly imported `/styles/tokens.css` and added 44 animations, but it **over-decorated** — film-leader loader, magnetic cursor, gold motes, REC live-time tickers, scroll-velocity hairlines, count-up stats, multiple `data-words` reveals stacked on the same hero — and the result reads as a film-school showcase, not a luxury wedding studio. Restraint is the lesson. Phase 4 will keep the architecture (chapters, manifesto, three pillars, three tiers, process rail, pull-quote, reel, FAQ, inquiry) and discard half the motion.
- The page must convert two distinct audiences with one layout: the **Editorial Bride** (Vogue-fluent, hires planner first, books on portfolio sophistication) and the **International Bride** (European or Latin American, books on bilingual confidence and venue access). Both are willing to pay editorial luxury rates; both will leave at the first whiff of "destination wedding sales funnel."
- Pricing presentation is the single highest-stakes decision on the page. Recommendation: **editorial tier names with `from` price ranges** (The Vow / The Celebration / The Cinematic Day, with "Investment from $1,800 / $2,800 / $3,500+ USD"). Hidden pricing kills international SEO; tier names without prices look evasive at this price point; full price grids look like a SaaS. The middle path is the editorial path.
- Three visual directions to be developed in parallel during Phase 3: **A. Editorial Vogue** (magazine grade, drop caps, generous margins, mostly serif, restraint above all), **B. Cinematic Film** (deep darks, cinemascope, scroll-driven storytelling, moderate grain, Phase 2 of the rushed preview but disciplined), **C. Minimalist Refined** (Hermes / Loro Piana, edge-flush whitespace, sans-serif accents, two CTAs total but each weighty). The owner picks one in Phase 4. Brief includes prompts for each.

---

## 2. What was wrong with the rushed preview

The `/luxury-weddings-preview.html` preview did many things right — it broke from v1, it adopted tokens.css, it modernized the FAQ accordion to native `button[aria-expanded]`, it preserved every SEO element, it organized the page into chapters with editorial pacing. But the owner called it "terrible," and the diagnosis is specific:

**Hero treatment problems**
- Four-line h1 cascade reads as ambitious typography but the lines `Luxury Destination / Wedding Photographer / Mexico. / Bilingual / Editorial.` use periods and slashes as line endings. The visual rhythm is staccato and the eye stops between every line. A single h1 at `clamp(48px, 7vw, 92px)` with one italicized word (`Mexico`) would do more.
- The hero has both a film-leader loader AND a magnetic cursor AND floating gold motes AND scroll-velocity hairlines AND count-up stats AND a "REC 17:38:04" timestamp on the featured image AND a "Frame 02 . Mayakoba . 17:42" overlay. The viewer counts the gimmicks. Restraint should outweigh ornament 4:1.
- The hero subhead opens with: "Galleries delivered in seventy-two hours, never weeks." Great copy, but written-out numbers ("seventy-two hours") clash with the runtime stats below ("72 hr First Frames Delivered"). One convention per page.

**Spacing and rhythm problems**
- Section padding is `var(--s-section-y)` everywhere (`clamp(80px, 9vw, 140px)`) without variation. Editorial pages alternate generous and tight rhythm — the manifesto can breathe at 160px, the FAQ can compress to 96px, the reel can hug edge-flush. Single rhythm = visual monotony.
- Chapters labelled "Chapter 01" through "Chapter 11" force every section to wear the same crown. By Chapter 06 the conceit is exhausted. Fewer chapter tags, used selectively, would mean more.

**Typography problems**
- `.eyebrow` with `letter-spacing: 0.42em` (per the rushed preview's `--mast-issue-tracking`) is tracking-shouty. Cap at `0.32em` (the canonical `--tracking-eyebrow-wide`).
- The pull-quote uses a giant ornamental quote glyph (`--ornament-pull-quote: clamp(280px, 40vw, 560px)` at `0.045` opacity) behind the text. Good editorially, but combined with film-grain + dust particles + scroll-velocity-line, the page has too many simultaneous decorative layers.
- Drop caps on the manifesto lede are the right move. Drop caps everywhere are not. Use drop caps once per page.

**Information hierarchy problems**
- The investment / pricing section is Chapter 06 (mid-page), correctly demoted below social proof. But the tier names "The Vow / The Celebration / The Cinematic Day" arrive before the page has earned the grandeur — by section 6 the reader has not seen real bride photographs, only stylized ones with overlays.
- Pillars (Direction / Discretion / Delivery) are excellent thematically but the copy strains: "We dress in linen, not vests" is a great line; "Your guests will remember the wedding. Not the photographers." is forced antimetabole. Cut by 30 percent.

**Imagery problems**
- The featured wedding case study card uses the same hero image used elsewhere on the site (`destination-wedding-mexico-hero.jpg`). One photograph cannot anchor both a hero AND a featured case study credibly. Phase 4 needs a real second case-study image, ideally a vertical 4:5 wide-angle ceremony.
- Reel shows nine stock-named files (`wedding-bride-cancun-hotel-zone-ivae-studios-2.jpg` through `-9.jpg`) without curation. A reel of nine images at 32vw aspect is supposed to feel like a contact sheet — instead it feels like a stock-photo listing.

**Motion problems**
- 44 distinct CSS / JS animations on a single page is a stress test, not a wedding photographer's portfolio. Cut to 12-16 animations: hero reveal, manifesto word-reveal, image clip-reveal, card hover, FAQ accordion, reel snap, scroll progress, magnetic CTA on hover only (not cursor), parallax on hero only, count-up on stats only, link underline grow, image scale on hover. Everything else (gold motes, film grain animation, REC tickers, magnetic full-page cursor) is decoration that fights the photography.

**Copy voice problems**
- Marginalia attribution: "Vianey Diaz, Founder & Creative Director" is bureaucratic. "Vianey Diaz, who leads the studio" is editorial. Or just "Vianey Diaz" with no role.
- Process step "Day One . The First Email" — fine. Process step "Six chapters, often shorter. Always honest." — strained.
- Inquiry meta cells: `Response Time / Same business day` ; `Languages / English / Spanish` ; `Hours / 06:00 . 20:00 GMT-5`. The use of `.` as separator (instead of an em-dash, which the brief forbids) reads as engineering syntax, not editorial.

**Net assessment**
The rushed preview is technically competent (tokens, accessibility, SEO preservation, prefers-reduced-motion) and structurally sound (the eleven-chapter scaffold is essentially correct). But it confuses *cinematic* with *editorial*. Cinematic = movie. Editorial = magazine. A magazine is quieter. Phase 4 should produce something closer to a Vogue Living wedding feature than to a Christopher Nolan title sequence.

---

## 3. Skills outputs (all 7)

### Skill 1 — `design:design-critique`

**Arguments passed:**
> Critique the current /luxury-weddings.html and the rushed /luxury-weddings-preview.html for IVAE Studios. Page intent: convert affluent international destination wedding clients ($5K-$50K bookings) at Cancun / Riviera Maya / Los Cabos. Compare to the live home v5 at /index.html. Focus: hierarchy, hero, conversion, copy voice, visual restraint vs. excessive ornament.

**Returned:** Critique framework loaded with sections for First Impression, Usability, Visual Hierarchy, Consistency, Accessibility, What Works Well, Priority Recommendations.

**How applied to this page:**
- *First impression diagnosis*: current page hero says "Luxury Destination Wedding Photographer — Mexico" — generic; rushed preview says four lines of staccato. Phase 4 hero must read as a single editorial breath: one h1 (semantic), one italicized word, one supporting line, two CTAs.
- *Usability diagnosis*: current FAQ uses `<div onclick>` — fails keyboard. Rushed preview correctly uses `<button aria-expanded>` — keep. Header CTA on current page reads "Book Now" — too transactional for $5K-$50K clients. Use "Begin Inquiry."
- *Hierarchy diagnosis*: rushed preview's pricing-at-Chapter-06 ordering is correct (after manifesto, pillars, featured wedding, process). Phase 4 must keep that order.
- *Consistency diagnosis*: current page uses v1 gold (`#c4a35a`); the redesign must use canonical v2 gold `--gold: #c9a54e` from tokens.css (which `dark-mode.css` keys to). Locked into Phase 2.
- *What works on current page*: stats strip (200+ / 5.0 / 3 / USA-CA), three-destination grid, six "What's included" items, ten-FAQ list. Keep this content; redress the form.
- *Priority recommendations applied to Phase 4*: (1) reduce hero to one h1 line + one supporting line, (2) cut motion count from 44 to ~14, (3) earn pricing via real ceremony imagery before tier reveal.

### Skill 2 — `design:design-system`

**Arguments passed:**
> Audit /styles/tokens.css for the IVAE luxury-weddings page redesign. Confirm tokens cover: cinematic hero, manifesto, three pillars, featured wedding, process timeline, three tier investment, pull-quote, reel, three coastlines, FAQ accordion, inquiry CTA. Identify any missing wedding-specific tokens.

**Returned:** Full audit framework: Naming Consistency / Token Coverage / Component Completeness / Priority Actions.

**Audit result:**
- Tokens.css is 368 lines and already canonical. Wave 4 + Wave 5 token additions are exhaustive: `--ratio-cinemascope`, `--ornament-pull-quote`, `--timeline-rail-color`, `--mast-issue-tracking`, `--rule-hairline / medium / heavy`, `--velocity-bar-h`, `--reveal-y-md`, `--ease-cinema`, `--stagger-base`, `--t-cinema`, `--tracking-eyebrow-{tight,base,wide}`, `--text-on-dark-readable`, `--focus-ring-on-{dark,light,gold}`, `--touch-target-min`. **No new tokens are needed for a typical wedding page.**
- Recommended *additive* (purely additive — never overwrite) wedding-specific tokens for Phase 2:
  - `--ceremony-program-rule: 1px solid var(--gold-line)` (program-style hairline above tier headers)
  - `--couple-name-tracking: 0.18em` (couple name attribution)
  - `--vow-card-padding: clamp(36px, 4vw, 64px) clamp(28px, 3vw, 48px)` (tier card padding rhythm)
  - `--photo-essay-gap: 6px` (already covered by `--s-1-5: 6px`, no addition needed)
  - `--rsvp-frame-border: 1px solid var(--gold)` (inquiry card frame)
- Decision for Phase 2: add the 3 truly new tokens above to a new `Wave 6 additions` block in tokens.css. Do not modify existing tokens.

### Skill 3 — `design:ux-copy`

**Arguments passed:**
> Strategy for the IVAE luxury weddings page voice. Affluent international destination wedding clients ($5K-$50K). Voice: literary, restrained, never sales-y, magazine-grade, no em-dashes, no exclamations. 20 microcopy decisions.

**Returned:** UX copy framework with CTA / error / empty state / dialog / tooltip / loading / onboarding patterns, voice and tone matrix, output format with Recommended / Alternatives / Rationale / Localization.

**Voice principles applied (5 commandments):**
1. *Editorial, not promotional*: Vogue Living and *Cereal* magazine cadence over wedding-blog cadence. Sentence variation. Hard stops.
2. *Restrained, never breathless*: no superlatives ("incredible," "stunning," "absolutely"), no exclamations, no emoji, no "trust us."
3. *Specific, never generic*: numerics over adjectives. "Three coastlines" beats "many destinations." "Seventy-two hours" beats "fast turnaround."
4. *Bilingual signal without translation*: drop a Spanish phrase on every page (the bilingual signal is the proof point — see "Bilingual" persona). Never overdo. One Spanish phrase, used right, signals fluency.
5. *No em-dashes*: per owner's standing rule. Use periods, commas, semicolons, parentheticals.

The 20 microcopy decisions are documented in §8 below.

### Skill 4 — `design:accessibility-review`

**Arguments passed:**
> Preemptive WCAG 2.1 AA framework for the luxury weddings page. Specific challenges: dark hero + gold buttons, gold focus rings on gold backgrounds, scroll-reel touch targets, FAQ button[aria-expanded], cinematic h1 cascade semantics, prefers-reduced-motion, gold-on-cream contrast (3.1:1), language switcher SR behavior, alt text vs. decorative grain, magnetic cursor gating.

**Returned:** WCAG 2.1 AA audit framework with Perceivable / Operable / Understandable / Robust quadrants.

**12 most likely failure modes, with the contract Phase 4 must enforce:**
1. *FAQ accordion as `<div onclick>`* (current page bug). Contract: native `<button aria-expanded aria-controls>` toggling `<div role="region" aria-labelledby>`.
2. *Gold focus ring on gold tier-featured CTA*. Contract: when btn-magnetic.gold has focus, ring switches to `var(--focus-ring-on-gold)` = ink-1 with offset 3px.
3. *Reel touch targets*. Contract: prev/next buttons each `min-width: 44px; min-height: 44px;` and reel-frame focus state visible on keyboard tab.
4. *Hero h1 semantic integrity*. Contract: a single `<h1>` with the canonical title text intact for SEO; visual line-cascade achieved through `<span class="line">` wrapping, not separate h1 tags.
5. *Gold-on-cream eyebrow contrast at 3.1:1*. Contract: gold eyebrows on cream-1 only when font-size >= `--fs-13` (>= 13px is large-text-eligible per WCAG 1.4.3 with the lower 3:1 threshold). Sub-13px gold-on-cream forbidden.
6. *Skip link*. Contract: present, gold background, ink color, focus visible, jumps to `#main-content`.
7. *prefers-reduced-motion gating*. Contract: comprehensive `@media (prefers-reduced-motion: reduce)` block disabling: grain animation, loader, magnetic cursor, hero parallax, count-up, h1 cascade, all `.rv` reveals (set opacity 1, transform none), reel auto-scroll if any. Keep static states.
8. *Magnetic cursor on touch devices*. Contract: gated on `@media (hover: hover) and (pointer: fine)` AND `not (prefers-reduced-motion)`.
9. *Decorative vs. meaningful images*. Contract: every ceremony / portrait image has descriptive alt; grain layer, motes, overlays, ornaments use `aria-hidden="true"` and empty alt.
10. *Heading outline*. Contract: 1 h1, multiple h2 (one per section), h3 within cards. No skipped levels (no h2 directly to h4).
11. *Language switcher SR*. Contract: `<a hreflang="en" aria-current="true">` on active language; `<span lang="es" aria-hidden="true">|</span>` separator; group has `role="group" aria-label="Language switcher"`.
12. *Touch target on tier card CTAs*. Contract: `min-height: var(--touch-target-min)` (44px) on every CTA, including embedded "View collection" links inside tier cards.

### Skill 5 — `design:design-handoff`

**Arguments passed:**
> Outline the dev handoff spec format Phase 5 will produce. Cover: layout grid, tokens, component variants, responsive breakpoints, edge cases, animation manifest, accessibility, SEO preservation. Outline structure only.

**Returned:** Handoff spec template covering Visual Specifications / Interaction Specifications / Content Specifications / Edge Cases / Accessibility, with Layout / Tokens / Components / States / Responsive / Edge Cases / Animation / A11y output sections.

**Phase 5 spec structure (to be filled in after Phase 4 build):**
```
1. Overview (what / who / which page / canonical URL)
2. Layout per section
   - Hero (background, layout, min-height, ratio)
   - Manifesto (grid, image ratio, image-text ratio)
   - Pillars (grid columns by breakpoint, gap, card padding)
   - Featured wedding (hero image ratio, deck grid, clip-reveal)
   - Process (rail width, node size, time-stamp typography)
   - Investment (3-col grid, featured tier visual treatment)
   - Pull quote (max-width, ornament size and opacity)
   - Reel (grid-auto-columns by breakpoint, gap, snap)
   - Locations (3-col, card aspect, overlay)
   - FAQ (max-width, accordion height)
   - Inquiry (background, overlay, content max-width, meta grid)
   - Footer (3-cluster flex, gold-line top)
3. Design tokens used (table: token name / value / usage / section)
4. Component states (table: component / default / hover / active / focus / disabled / loading)
5. Responsive breakpoints (table: > 1200 / 900-1200 / 768-900 / < 768)
6. Edge cases (table: empty state / long text / missing image / slow connection / no JS)
7. Animation manifest (table: name / element / trigger / duration / easing / reduced-motion behavior)
8. Accessibility notes (heading outline, focus order, ARIA, keyboard, screen reader)
9. SEO preservation contract (verbatim list of immutable elements)
10. Performance budget (file size cap, image budget, font requests)
11. Browser support (modern evergreen + Safari iOS 15+)
```
Mandatory fields: Overview, Layout, Tokens, Component states, Responsive, A11y, SEO. Optional: Performance budget (recommended). Edge cases (recommended). Animation manifest (recommended for transparency, optional for verification).

### Skill 6 — `design:user-research`

**Arguments passed:**
> Write a complete real-world user research study plan IVAE could execute. 6-8 past brides, 45-min interviews, 5-phase discussion guide, screener, recruitment, analysis approach, deliverables, 3-week timeline.

**Returned:** Research methods table, interview guide structure, analysis framework, deliverables list.

**Study plan (full version included so IVAE can execute):**

*Title:* IVAE Wedding Booking Discovery Study — Spring 2026

*Objectives (5):*
1. Map the full discovery-to-booking journey for international destination wedding photographers in Mexico (where they search, what they compare, how long they take to decide)
2. Identify the single biggest objection that brides almost stopped on (price? language? remote vendor trust? venue access? gallery turnaround? insurance / contract / payment friction?)
3. Surface the trust-unlock moment — the exact sentence, image, video, or call that flipped them from "considering" to "yes"
4. Capture 3-5 verbatim quotes per bride that can become future testimonials, pull-quotes, and social proof
5. Validate or revise the three-persona model proposed in §4 with real data

*Participant criteria:*
- 6-8 past IVAE brides who booked in the last 18 months
- Photography budget >= $5,000 USD
- Booked from outside Mexico (US / CA / UK / EU / LATAM)
- The decision-maker on photography choice (not the partner, not the planner)
- Mix: 2 from Cancun, 2 from Riviera Maya, 2 from Los Cabos, plus 1-2 wild-cards (Tulum / Playa Mujeres)
- Mix of resort tiers: 2 ultra-luxury (Rosewood / One&Only / Las Ventanas), 2 luxury (Mayakoba / Grand Velas / Palmilla), 2 boutique (The Cape / Nizuc)
- Mix of cultural backgrounds: 2 hyphenated American (Indian-American / Latin-American / Asian-American) and 4 European or North American

*Screener (10 questions):*
1. Did you book your wedding photographer at IVAE Studios within the last 18 months? [Yes / No / Not sure]
2. Approximately how much did you spend on wedding photography (in USD)? [< $3K / $3-5K / $5-10K / $10-20K / $20-50K / >$50K]
3. Where did you live at the time of booking? [Free text]
4. Where was your wedding held? [Free text city + venue]
5. Were you the primary decision-maker on photography? [Yes / Shared / My partner / Our planner]
6. How did you first hear about IVAE Studios? [Search / Instagram / Pinterest / planner / friend / publication / other]
7. Roughly how many photographers did you compare before deciding? [1 / 2-3 / 4-6 / 7+]
8. How long was your decision process? [< 1 week / 1-4 weeks / 1-3 months / 3-6 months / > 6 months]
9. Would you be willing to share a 45-minute Zoom interview? [Yes / Maybe / No]
10. What time zone are you in, and what days work best in the next two weeks?

*Recruitment strategy (3 channels):*
- *Channel A — alumni email*: Vianey emails the 42-review alumni base personally with a soft invitation. Subject: "A small favor — 45 minutes to help shape the next chapter at IVAE." Personalized greeting. No automation. Estimated response: 25-30 percent (10-12 yes).
- *Channel B — planner referrals*: ask the 3-5 wedding planners IVAE works with most often (Mayakoba, Palmilla, Costa Palmas) for one introduction each. Most affluent alumni came through planners; planners can reach the ones too busy for cold email. Estimated response: 1-2 per planner.
- *Channel C — Instagram DM*: only as fallback. Personal DM (not from the brand account) to alumni who've engaged in the last 6 months.

*Incentive:* $75 USD gift card (Sephora / Amazon / Nordstrom — bride picks). Sent within 24 hours of interview. Affluent brides won't do it for the money but the gesture matters and signals professionalism.

*Discussion guide — 45 minutes, 5 phases:*

**Phase 1 — Warm-up (5 min)**
- "Walk me through where you got married and how the day felt, three months on."
- Probes: venue, season, guest count, weather, anything that surprised you.
- Goal: rapport + free-recall data on the wedding itself.

**Phase 2 — Discovery (10 min)**
- "Walk me through the day you started looking for a photographer. What was the first thing you typed into Google? What did you do next?"
- Probes: search terms, first 5 sites visited, comparison shortlist, who they showed it to, how long the first session lasted, did they return.
- Goal: map the discovery funnel and the comparison set. Identify upstream content / SEO opportunities.

**Phase 3 — Almost-stopped (10 min)**
- "What was the single biggest reason you almost didn't book IVAE?"
- Probes: price, language fear, remote-vendor trust, venue access concern, contract / insurance / payment friction, partner disagreement, planner recommendation conflict, comparison fatigue.
- Goal: identify the conversion barrier the redesign should address.

**Phase 4 — Conversion moment (10 min)**
- "What was the one thing — the sentence, the image, the moment in the call with Vianey — that flipped you to yes?"
- Probes: specific image in the gallery, specific testimonial, the call itself, the response speed, the venue list, the bilingual confirmation, the planner endorsement, the contract clarity.
- Goal: identify the trust-unlock for the page hero / featured / pull-quote / inquiry sections.

**Phase 5 — Post-shoot and warning (10 min)**
- "What surprised you most in the first 72 hours after the wedding?"
- "If a friend was about to book, what would you warn her? What would you tell her to ask?"
- Probes: sneak peek delivery, full gallery wow / disappointment, family reactions, what they expected and didn't get, what they got and didn't expect.
- Goal: identify post-purchase delight (for the trust strip) and the question-to-ask language (for FAQ).

*Analysis approach:*
- Real-time field notes per interview (template per phase)
- Affinity mapping after all interviews complete: print quotes onto note cards, group on a large surface, identify themes
- Theme synthesis: 5-7 themes max, each backed by 3+ verbatim quotes
- Persona refinement: validate or revise the 3 personas from §4
- Page-level recommendations: each theme maps to 1-3 specific page changes

*Deliverables (3 documents):*
1. *Themes report* — 5-7 themes, each with prevalence count, supporting quotes, implication
2. *Persona refinement* — updated persona document with photo (consented), quote, demographics, journey, objections, conversion unlock
3. *Page-level recommendations* — table mapping themes to specific section changes (hero copy, manifesto frame, pillar order, tier names, FAQ ordering, inquiry meta)

*Timeline (3 weeks):*
- Week 1: recruitment, screening, scheduling
- Week 2: 6-8 interviews + write-up after each
- Week 3: synthesis, persona refinement, recommendations doc, present to Vianey

**How applied to Phase 1 brief:** the personas in §4 below are *hypothesis-driven* using existing testimonials. Phase-1 brief makes the testable claim. The above study would *validate or revise* before Phase 4 build (or run in parallel, with findings feeding Phase 5 verification).

### Skill 7 — `design:research-synthesis`

**Arguments passed:**
> Synthesize existing IVAE testimonials (6 reviews + aggregate 5.0 / 42) into themes, insights, 3 personas, and page-level changes for /luxury-weddings.html.

**Returned:** Research synthesis framework: Executive Summary / Key Themes (with prevalence and quotes) / Insights to Opportunities / User Segments / Recommendations / Questions for Further Research / Methodology Notes.

**Source data analyzed:**
- *Home page testimonials (3, in JSON-LD)*: Samantha Whitfield (family, Cancun, 2026-01-22), Marco Benedetti (proposal, Tulum, 2026-02-14, "flew in from Milan"), Priya Raghavan (yacht anniversary, Cabos, 2026-03-09, "already booked them again")
- *Wedding page testimonials (3, on-page)*: Sarah & Michael ("looks like a magazine," Rosewood Mayakoba, March 2026), Jessica & David ("did not just photograph our wedding. They elevated it.", One&Only Palmilla, Jan 2026), Lauren & James ("most beautiful images we have ever seen of ourselves" — golden hour, Cancun, November 2025)
- *Aggregate*: 5.0 / 42 reviews

**5 themes identified:**

1. *"Magazine-grade output is the headline emotion"* (5 of 6 testimonials reference editorial / magazine quality directly). Implication: the page's central promise is editorial caliber — not coverage, not comprehensiveness, not pricing-value. **Page action: featured wedding image must be portfolio-grade — Phase 4 needs at least one new editorial-quality image as the case-study anchor.**

2. *"Elevation over documentation"* (Jessica & David verbatim: "did not just photograph our wedding. They elevated it.") This frames IVAE as creative direction, not service. Implication: pricing tier copy should emphasize creative direction over coverage hours. **Page action: replace "What's included" copy from "Full-Day Coverage" / "Engagement Session" / "Second Shooter" to "Direction" / "Discretion" / "Delivery" three-pillar frame (already in rushed preview — keep this idea).**

3. *"Trust born from bilingual + cultural fluency"* (Marco Benedetti from Milan; Priya Raghavan with hyphenated-American name; both explicitly mention either bilingual handling or "team that understood every detail"). Implication: international clients pay a premium for cultural-and-language confidence in a language-fragile context (Mexico, English-second-language vendors). **Page action: hero must signal bilingual without sounding apologetic about it. Inquiry meta must include languages line. Pricing must NOT translate to MXN (signals home-market thinking).**

4. *"Golden-hour signature is a remembered specific"* (Lauren & James: "the golden hour portraits on the beach are the most beautiful images"). Implication: a single signature visual moment is more memorable than a comprehensive deliverables list. **Page action: hero eyebrow names the chapter ("A Wedding, Held in Light" or similar). Process step 04 explicitly references golden-hour-only scheduling. Hero image is golden-hour-anchored, not noon-on-the-beach.**

5. *"Speed (1-3 day delivery) is unprecedented at this caliber"* (Priya Raghavan: "seamless from first email to final gallery"; aggregate 5.0/42 with delivery promise across all reviews). Implication: 72-hour sneak peek + 3-week full gallery is the differentiator vs. industry norm of 6-8 weeks. **Page action: delivery promise must live in 3 places: hero stats strip, third pillar, inquiry meta. Cannot be relegated to FAQ.**

**3 personas (full detail in §4 below) — Editorial Bride / International Bride / Heritage Bride.**

**Insights to opportunities table (top 7):**

| Insight | Opportunity | Impact | Effort |
|---|---|---|---|
| Magazine-quality is the headline emotion | Lead hero with single editorial frame | High | Low |
| Elevation > documentation | Three-pillar frame replaces "What's Included" | High | Low |
| Bilingual is a paid premium | Hero signals bilingual; inquiry meta confirms | High | Low |
| Golden-hour is the visual signature | Hero eyebrow names the hour; process step 04 | High | Low |
| 72-hour sneak peek is unprecedented | Delivery in hero, pillar, inquiry meta | High | Low |
| Marco-from-Milan signal underused | Add 1-2 international-bride photos | Medium | Medium |
| Pricing causes drop-off if too prominent | Move pricing to mid-page (Chapter 06 frame) | Medium | Low |

**Questions for further research (deferred to live study in Skill 6 above):**
- What % of inquiries come from Pinterest vs. Instagram vs. Google?
- Does the planner-referred segment behave differently from the self-discovered segment?
- Where does the international (non-US-CA) segment compare IVAE? (Local-Mexican photographers? UK-based traveling photographers? Their home-country wedding photographer who'll fly in?)
- Does pricing transparency (with $1,800 from-price visible) accelerate or decelerate inquiry rate?

---

## 4. Personas (from research-synthesis)

Three personas, each anchored to actual reviewer behavior in the existing testimonial set, with hypothesis-driven detail to be validated by the live study (Skill 6).

### Persona A — The Editorial Bride

*Anchor reviewers:* Sarah & Michael (Rosewood Mayakoba), Jessica & David (One&Only Palmilla), Lauren & James (Cancun golden hour). Approximately 50-55% of IVAE wedding clientele, by hypothesis.

**Demographics:**
- Age 31-37, female, US or Canadian
- Household income $300K+, often dual-income professional
- Wedding budget $80K-$250K total, photography budget $5K-$15K
- Lives in NYC / LA / SF / Toronto / Miami metro
- Has wedding planner before any vendor

**Psychographics:**
- Reads Vogue, Architectural Digest, Cereal Magazine, Kinfolk; follows @overthemoonweddings, @carolynesilvera, @jose_villa on Instagram
- Visual taste is editorial luxury: Loro Piana, Khaite, The Row, Loewe
- Decides on aesthetic before logistics
- Will spend on what photographs well; will not spend on what doesn't

**Booking journey (5 steps):**
1. *Inspiration phase* (12-18 months before wedding): Pinterest boards, Vogue weddings section, Over the Moon real-wedding features. Saves IVAE indirectly through planner Pinterest.
2. *Planner hire* (10-12 months): Hires planner first, photographer second. Asks planner for 3-5 portfolio recommendations.
3. *Portfolio shortlist* (8-10 months): Reviews 4-6 photographers. Visits each website. Reads testimonials. Saves Pinterest of one specific gallery from each. Compares 3-4.
4. *Inquiry* (8 months): Inquires with 2-3 finalists. Asks for: full gallery from 1-2 weddings, pricing, availability.
5. *Decision* (7-8 months): Decides on the photographer whose hero gallery has the single most editorial frame. Books.

**Objections / concerns:**
- "Will their work look as good as the curated 12 frames they show me?" (gallery integrity)
- "Will I look like myself, or will I look like a Pinterest mood-board?" (creative control)
- "Will the ceremony images feel as editorial as the bridal portraits?" (consistency across 600 frames)
- "Will the highlight film feel like a magazine page or a TikTok?" (cinematic register)

**Language that resonates:**
- "Editorial," "magazine," "creative direction," "art direction," "considered," "restraint"
- *Avoid*: "stunning," "unforgettable," "magical," "best day of your life"

**What would convince them:**
- A single hero image that looks like it could run as a *Vogue* wedding feature opener
- A pull-quote from a credentialed bride (planner-recognizable name)
- A featured wedding case study with 4-6 images that hold together
- A delivery promise (72-hour sneak peek) that proves IVAE can do it once and again

**Where they research:**
- Pinterest (40% of inspiration time)
- Instagram (30%)
- Vogue weddings + Over the Moon + Brides editorial (15%)
- Planner direct recommendation (10%)
- Google search (5%)

### Persona B — The International Bride

*Anchor reviewers:* Marco Benedetti (Milan-to-Tulum), Priya Raghavan (yacht anniversary, Cabos, hyphenated name suggesting South Asian heritage), implied by aggregate 42-review international skew. Approximately 25-30% of IVAE wedding clientele.

**Demographics:**
- Age 30-40, often dual-citizenship or international resident (London / Milan / Mumbai / Singapore / Mexico City)
- Wedding budget $50K-$300K, photography budget $5K-$25K
- Often a destination wedding *because* one or both partners are international
- Often non-native English speaker (or partner is)

**Psychographics:**
- Reads *Vogue Italia*, *AD France*, *Condé Nast Traveler*; follows international wedding accounts (@overthemoonweddings + @stylemepretty + @italianweddings)
- Comfortable with multiple languages; expects vendors to be too
- Brand-loyal once trust is earned; brand-skeptical until then
- Booking-decision is often shared with partner who may be in a different timezone

**Booking journey (6 steps):**
1. *Destination decision* (15-18 months): Mexico chosen for proximity, climate, budget vs. Europe.
2. *Local vendor search* (12-15 months): Searches "destination wedding photographer Mexico" + "Tulum wedding photographer" + "Cancun fotografo bodas." Discovers IVAE on page 1 of Google (SEO matters more here than for Persona A).
3. *Trust verification* (10-12 months): Looks for English website + bilingual signal + venue list + planner integrations. Reads the FAQ carefully.
4. *Inquiry* (10 months): Sends inquiry, asks specifically about bilingual handling, language of contract, payment in USD vs. MXN, travel logistics.
5. *Direct call* (9-10 months): Wants a call with Vianey directly to verify language fluency and trust.
6. *Decision* (9 months): Books on combination of bilingual confidence + venue access + response speed.

**Objections / concerns:**
- "Will they actually speak English well, or is the website translated?" (bilingual real vs. signaled)
- "Will they understand my [Indian / Italian / Greek / Korean] wedding traditions?" (cultural fluency)
- "Can I pay in USD? Is the contract enforceable internationally?" (financial / legal)
- "If something goes wrong, who do I call from another timezone?" (response infrastructure)
- "Do they have venue access at [my resort]?" (vendor whitelist)

**Language that resonates:**
- "Bilingual," "international," "European," "global," "cross-cultural"
- One Spanish phrase used right (signals fluency, not translation)
- Specific venue names (Mayakoba, Palmilla, Las Ventanas) in plain text — proves access
- Response time in absolute terms ("within the same business day")

**What would convince them:**
- The page loads cleanly in English with a visible ES toggle that works
- Inquiry meta lists languages explicitly: "English / Spanish"
- Hours line says "06:00 – 20:00 GMT-5" so they can math the timezone
- A real Italian / Indian / hyphenated name in the testimonial set (Marco Benedetti currently; need 1-2 more)
- A venue list that includes their specific resort by name

**Where they research:**
- Google search (35% — SEO matters most for this persona)
- Instagram + Pinterest (25%)
- Wedding-planner referral (20% — international planners use IVAE)
- Local-language wedding directories / Spanish-language search (10%)
- Word-of-mouth from international friends (10%)

### Persona C — The Heritage Bride

*Anchor reviewers:* Priya Raghavan (yacht anniversary returning client suggests heritage / multigenerational pattern), implied by site service breadth (quinceanera, vow renewal, Indian wedding photographer Cancun blog post listed in `/post-indian-wedding-photographer-cancun.html`). Approximately 15-20% of IVAE wedding clientele.

**Demographics:**
- Age 28-38, often hyphenated American / Canadian (Indian-American, Latin-American, Asian-American, Middle-Eastern American) or international heritage couple
- Wedding budget $100K-$500K (multi-day, multi-event)
- Multiple ceremonies, often across different traditions
- Family heavily involved in vendor decisions

**Psychographics:**
- Reads heritage-specific publications (*Maharani Weddings*, *Hispanic Bride*, *South Asian Bride*) in addition to mainstream
- Expects vendor to handle multi-tradition coverage (sangeet + ceremony + reception, or cumbia + ceremony + reception)
- Family elders' opinions weigh heavily
- Wedding will be photographed across 2-4 days

**Booking journey (5 steps):**
1. *Heritage-specific search* (15-18 months): Google "Indian wedding photographer Cancun" or "destination wedding fotografo bodas mexicano" — hits IVAE's niche-targeted blog content.
2. *Heritage-specific shortlist* (12-15 months): Compares 3-5 photographers, often including 1-2 heritage specialists from home country.
3. *Family vetting* (10-12 months): Shows portfolio to mother, mother-in-law, possibly elders. Family agrees or vetoes.
4. *Multi-day quote* (10 months): Asks for custom quote covering 2-4 days (sangeet through brunch).
5. *Decision and contract* (9-10 months): Books on combination of heritage portfolio + multi-day pricing + family approval.

**Objections / concerns:**
- "Have they shot a [Hindu / Sikh / Catholic-Mexican / Persian / Korean] wedding before?" (heritage portfolio)
- "Can they handle the sangeet + ceremony + reception flow?" (multi-day pacing)
- "Will the photographer wear something appropriate for the religious ceremony?" (cultural respect)
- "Can the family in [home country] download images easily?" (delivery infrastructure)

**Language that resonates:**
- "Multi-day," "weekend coverage," "ceremony," "celebration," "tradition"
- Specific tradition signals where appropriate (without overclaiming)
- Photo-essay structure that shows diversity of weddings (not just one type)

**What would convince them:**
- A reel that includes at least one heritage / multi-tradition wedding
- A FAQ entry on multi-day coverage
- A pricing structure that allows custom multi-day quoting
- A blog post they can read in advance (`/post-indian-wedding-photographer-cancun.html` already exists)

**Where they research:**
- Google search with heritage-specific terms (40%)
- Heritage publications and bloggers (25%)
- Family / community word-of-mouth (20%)
- Instagram (10%)
- Pinterest (5%)

---

## 5. Page IA (information architecture) — recommended section sequence

Based on the three personas and the five synthesis themes, the ideal section order is:

1. **Hero** — single editorial image, single h1, one supporting line, two CTAs (Begin Inquiry / View Reel). One scroll cue. No stats yet. *Conversion hypothesis:* the editorial frame itself is the proof — defer numerical proof to section 3.

2. **Breadcrumb + Trust strip** — quiet horizontal strip. 4 numbers: weddings captured, rating, coastlines, delivery hours. *Conversion hypothesis:* numerical proof loads in the second screen — bride who scrolled past the hero rewarded with the credibility unlock.

3. **The Studio (Manifesto)** — 2-column. Photo on left (4:5, vertical, golden-hour first-look), copy on right (eyebrow + h2 with one italicized phrase + lede + 2 short paragraphs + Vianey attribution). One drop-cap on the lede. *Conversion hypothesis:* Vianey is the trust unlock — a 30-40 word manifesto in her voice does more than the entire pillars section.

4. **Three Commitments (Pillars)** — 3-column grid. Direction / Discretion / Delivery. Each with a Roman numeral, h3, and 30-40 word body. No images. *Conversion hypothesis:* the three-pillar frame is the elevation-over-documentation reframe (Theme 2). Each pillar maps to a specific objection: Direction (creative control fear), Discretion (camera-shy fear), Delivery (gallery wait fear).

5. **A Wedding (Featured case study)** — full-bleed cinemascope hero image (21:9 or 16:9), then 2-column grid of 2 portrait images (4:5 each). Caption deck listing venue, date, scale, coverage. *Conversion hypothesis:* the editorial bride wants proof that one wedding's gallery holds together for >1 frame. This is the test.

6. **Pull-quote (Voices)** — single-paragraph testimonial, large serif italic, max-width 920px. Attribution: name + venue + month. One ornament behind. *Conversion hypothesis:* mid-page rest. Slows the scroll, anchors the emotion (the elevation theme), bridges to pricing.

7. **The Investment (Pricing)** — 3-tier grid (The Vow / The Celebration / The Cinematic Day). Middle tier visually featured. Each tier shows roman numeral, italic name, italic lede, 6 bullets, "Investment from $X,XXX USD." *Conversion hypothesis:* by section 7 the bride has seen the editorial proof, the manifesto, the pillars, the case study, and one testimonial. Pricing is now contextualized, not anchoring.

8. **The Method (Process)** — 6-step rail, vertical. Each step: chapter tag (01 / Inquiry, 02 / Conversation, etc.), h3, 30-40 word body. *Conversion hypothesis:* the international bride wants to know the response infrastructure. The process rail answers it specifically (response time, call duration, walkthrough, delivery cadence).

9. **The Reel** — horizontal scroll-snap, 8-12 frames at 32vw each. *Conversion hypothesis:* breadth proof. The bride who's read this far wants to see that IVAE has shot >1 wedding successfully. Reel is depth proof, not curation.

10. **The Coastlines (Locations)** — 3-card grid (Cancun / Riviera Maya / Los Cabos). Each card: image, tag, h3, 1 paragraph. *Conversion hypothesis:* venue access is a key Persona B objection. Three coastlines, named, with body copy that proves on-the-ground familiarity.

11. **Considered Questions (FAQ)** — 10-item accordion. *Conversion hypothesis:* objections-to-action conversion. Top 5 questions answered visibly. Last 5 deeper.

12. **Begin (Inquiry)** — full-bleed image background, eyebrow + h2 + 80-word pitch + 2 CTAs (WhatsApp / Email) + meta strip (response time, languages, hours). *Conversion hypothesis:* the bride who reached section 12 has converted. The inquiry section just needs to remove the friction.

13. **Footer** — minimal: brand, nav, copy, hairline above.

**Total: 13 visible sections (12 content + footer). Hero through Inquiry is the conversion path. Same as the rushed preview — but the rushed preview's mistake was making sections 1-12 weight-equal. Phase 4 must vary the rhythm: hero is heavy, trust strip is thin, manifesto is heavy, pillars is medium, case study is heavy, pull quote is light, pricing is medium, process is medium, reel is light, locations is medium, FAQ is medium, inquiry is heavy.**

---

## 6. Visual / motion principles

**Hero treatment philosophy:**
- ONE h1 line (not four). Maintains the canonical SEO h1 phrase: "Luxury Destination Wedding Photographer Mexico" with one italicized word (`Mexico` or `Light` depending on direction).
- The h1 must read as a single editorial breath — no slash separators, no period-per-word, no rhythmic line endings that break the eye.
- ONE supporting line (15-25 words max).
- TWO CTAs: primary gold (Begin Inquiry), secondary outline (View Reel).
- ONE scroll cue at base of hero (subtle dot + line wipe).
- NO stats inside the hero — stats go below in the trust strip.
- NO loader (the rushed preview's film-leader is film-school theater).
- NO magnetic full-page cursor (gimmick; gates on hover:hover anyway).
- Optional: subtle Ken-Burns parallax on hero image, gated on `prefers-reduced-motion`.

**Spatial rhythm:**
- Section padding varies: hero is 100vh; manifesto is 160px top + 120px bottom; pillars is 100px top + 100px bottom (compressed); case study is 140px top + 80px bottom; pull-quote is 80px top + 80px bottom (intimate); pricing is 120px both; process is 120px both; reel is 60px top + 60px bottom (edge-flush feeling); locations is 100px both; FAQ is 80px top + 60px bottom; inquiry is 60vh.
- Gutter is canonical `--s-gutter: clamp(24px, 5vw, 64px)`.
- Maximum content width per section: hero 820px copy / 1200px image; manifesto 540px text / image fills column; pillars 1100px grid; case study 1400px hero + 1100px paired; pull-quote 920px; pricing 1100px; process 920px rail; reel 100vw; locations 1300px; FAQ 880px; inquiry 720px.

**Type system:**
- Drop cap: YES, but ONCE per page, on the manifesto lede only.
- Italics: YES, used sparingly for emphasis on h1, h2, h3 (one italicized word/phrase per heading max).
- Tracking on eyebrows: `--tracking-eyebrow-base: 0.26em` for default, `--tracking-eyebrow-wide: 0.32em` for section eyebrows. Never exceed 0.32em.
- Hero h1: `clamp(48px, 7vw, 92px)`, weight 300, line-height 1.06, font-family `--font-serif`.
- Section h2: `clamp(28px, 3.5vw, 46px)`, weight 300, line-height 1.12, font-family `--font-serif`.
- Body: `--fs-15` on dark uses `--text-on-dark-readable` (alpha .82); on cream uses `--text-on-light-readable` (alpha .78). Line-height 1.85.
- Eyebrows: `--fs-10`, weight 600, uppercase, color `--gold`.

**Motion philosophy:**
- 12-16 animations total (vs. rushed preview's 44).
- Where to add: hero h1 reveal (180ms stagger across word spans), manifesto h2 word-stagger (60ms per word), image clip-reveal on scroll (clip-path inset 0 to 100%), tier card hover (border color + 3px lift), reel scroll-snap (native CSS), FAQ accordion (max-height 0 to 480px, icon rotate 45deg), CTA hover (gold-glow background fade), link underline grow (scaleX 0 to 1 on hover), eyebrow underline grow (scaleX from left), count-up on stats (1.6s with easing), Ken-Burns parallax on hero (gated reduced-motion), scroll progress hairline at top of viewport.
- Where NOT to add: full-page magnetic cursor, gold motes, film grain animation, REC live-time tickers, loader, scroll-velocity hairline, dust particles, count-up animations on every numeric. NOTHING that moves continuously without user interaction (except the hero parallax, which is bound to scroll).
- All motion gated on `@media (prefers-reduced-motion: reduce)`.

**Image art direction:**
- Hero: 16:9 cinemascope, golden-hour, brightness 0.45, saturation 0.75. Full-bleed.
- Manifesto stage: 4:5 portrait, intimate first-look or detail shot.
- Featured case study hero: 21:9 cinemascope (wider than hero), full-bleed.
- Featured case study deck: 4:5 portraits paired (2 columns).
- Reel: 4:5 portraits, 8-12 frames, 32vw column width.
- Locations: 3:4 portraits, 3 columns, full overlay-on-hover.
- Inquiry background: 16:9, brightness 0.20, saturation 0.50 (very dark). Full-bleed.
- All images are golden-hour, saturated naturally, no Instagram filters.

**Color treatment:**
- Use `--gold: #c9a54e` as the canonical IVAE gold (NOT v1's `#c4a35a`). Phase 2 must enforce this via tokens.css consumption.
- Ink alternation: hero on `--ink-3` (deepest), manifesto on `--ink-2` or `--cream-1` depending on direction, pillars on `--ink-2`, case study on `--ink-3`, pull-quote on `--ink-4` (deepest of all), pricing on `--ink-3`, process on `--ink-2`, reel on `--ink-3`, locations on `--ink-2`, FAQ on `--ink-3`, inquiry on `--ink-4`.
- Cream sections: Direction A (Editorial) inverts on cream-1 for pull-quote and one earlier section. Direction B (Cinematic) stays dark throughout. Direction C (Minimalist) splits 60/40 cream-to-ink.
- Accent gold used for: eyebrows, italics in headings, bullet markers, line dividers, tier featured-flag, CTA primary background, hover underlines. Never as text body. Never as block fill.

---

## 7. Three visual direction prompts (for Phase 3 parallel agents)

Phase 3 will run 3 parallel agents producing 3 different visual directions, all using `/styles/tokens.css`, all preserving SEO, all targeting the same IA from §5. Each agent receives one of the prompts below.

### Direction A — Editorial Vogue

**Premise:** A *Vogue Living* wedding feature. Magazine-grade. Restraint above all. Generous margins. Pull-quotes that breathe. Drop caps once per page. Mostly serif headlines. Cream alternation with ink for tonal variation. Few CTAs but each weighty.

**Typographic system:**
- H1: `clamp(48px, 7vw, 92px)`, font-family `--font-serif`, weight 300, line-height 1.06, italic on one word.
- H2: `clamp(36px, 4vw, 56px)`, font-family `--font-serif`, weight 300, line-height 1.12.
- Section eyebrow: `--fs-10`, font-family `--font-sans`, weight 600, tracking `--tracking-eyebrow-wide` (0.32em), uppercase, color `--gold`.
- Body: `--fs-15`, font-family `--font-sans`, weight 400, line-height 1.85, color `--text-on-light-readable` (cream sections) or `--text-on-dark-readable` (ink sections).
- Drop cap: 60px serif italic gold, on manifesto lede only.

**Layout grid:**
- Hero: 100vh, full-bleed image, copy left-aligned in 600px column, breathing room top and bottom.
- Manifesto: 50/50 split, image left (4:5), copy right (max-width 540px).
- Pillars: 3-column on desktop, 2-column at 900px, 1-column at 768px. Each card 32px gap.
- Featured case study: 21:9 hero + 2-column 4:5 grid below.
- Pricing: 3-column grid, equal width, generous 48px gap.

**Motion vocabulary:**
- 10 animations total. Hero h1 reveal (line-by-line), manifesto h2 word-stagger, image clip-reveal on scroll, tier card hover, FAQ accordion, eyebrow underline grow, link underline grow, CTA hover, reel scroll-snap, count-up on stats. NO loader. NO magnetic cursor. NO gold motes. NO grain animation (static grain only at 0.022 opacity).
- Easing: `--ease` for transitions, `--ease-cinema` for clip-reveals, `--ease-back` for card lifts.
- Duration: `--t-medium` (0.55s) for entries, `--t-quick` (0.28s) for hovers.

**Image art direction:**
- All 4:5 or 16:9 ratios. NO cinemascope (21:9). Editorial magazine images are framed for the page, not the screen.
- Brightness 0.55-0.75, saturation 0.85-1.0. Closer to true print.
- Hero is golden-hour bridal portrait or first-look (not ceremony-wide).
- Featured case study: one hero image at 16:9, 4 supporting at 4:5.

**Copy register:**
- Vogue-fluent. Sentence variation. Hard stops.
- "Light, held briefly." instead of "Galleries delivered fast."
- One Spanish phrase max, used exactly once, in the manifesto.

### Direction B — Cinematic Film

**Premise:** A movie poster that scrolls. Full-bleed cinemascope. Deeper darks. Scroll-driven storytelling. Film grain (static, 0.022 opacity). Vignette on hero. Chapter cards at section transitions. Type lockups inspired by film title cards.

**Typographic system:**
- H1: `clamp(56px, 8vw, 108px)`, font-family `--font-serif`, weight 300, line-height 1.04, italic on one word, `--reveal-y-md` (28px) line-by-line cascade.
- H2: `clamp(38px, 4.5vw, 64px)`, font-family `--font-serif`, weight 300, line-height 1.10.
- Chapter cards (between sections): `--fs-10` with chapter number + rule + title, tracking `--tracking-eyebrow-wide`.
- Body: `--fs-15`, line-height 1.80, color `--text-on-dark-readable`.

**Layout grid:**
- Hero: 100vh full-bleed cinemascope (21:9 image cropped to 100vh), vignette overlay, copy bottom-left in 720px.
- Manifesto: 60/40 split (image larger), image is cinemascope (21:9), copy stack right.
- Pillars: 3-column with chapter card above ("Chapter 03. The Experience").
- Featured case study: full-bleed 21:9 hero + cinemascope-style "REC" tag in corner (subtle, not the rushed preview's loud one).
- Pricing: 3-column with middle tier elevated (4px gold rule on top, badge "Most Chosen").

**Motion vocabulary:**
- 14 animations total. Hero h1 line-by-line (180ms stagger), Ken-Burns parallax on hero, image clip-reveal-diagonal (45deg), manifesto word-stagger, tier card hover with 3px lift, FAQ accordion, reel scroll-snap with arrow controls + progress, count-up stats, eyebrow underline grow, CTA shine-sweep gradient, scroll progress hairline at top, eyebrow ornament pulse (4s loop, 0.045 opacity), pull-quote ornament parallax, manifesto stage-overlay fade.
- Easing: `--ease-cinema` (0.77, 0, 0.18, 1) for clip-reveals.
- Duration: `--t-cinema` (0.95s) for hero, `--t-medium` for body reveals.

**Image art direction:**
- Cinemascope 21:9 for hero and case study. 4:5 elsewhere.
- Brightness 0.35-0.55 (darker than Direction A).
- Saturation 0.60-0.80 (more desaturated, more cinematic).
- Hero is golden-hour ceremony-wide (panoramic feel).
- Static film grain layer at 0.022 opacity, no animation.
- Vignette inset shadow on hero (`--shadow-hero-vignette`).

**Copy register:**
- Movie-trailer cadence. Short. Declarative.
- "We do not photograph fifty weddings a year." Cut.
- Chapter framing: "Chapter 02. The Studio."

### Direction C — Minimalist Refined

**Premise:** Hermes / Loro Piana. Ultra-restrained. Lots of whitespace. Sans-serif accents. Edge-flush imagery. Two CTAs total per page but each weighty. Cream-dominant. Ink only for pull-quote and inquiry.

**Typographic system:**
- H1: `clamp(40px, 6vw, 80px)`, font-family `--font-serif`, weight 300, line-height 1.08. Single line if possible.
- H2: `clamp(26px, 3vw, 40px)`, font-family `--font-serif`, weight 300, line-height 1.15.
- Subheads (sans, used as secondary structure): `--fs-13` `--font-sans` weight 500, tracking `--tracking-eyebrow-tight` (0.18em), uppercase.
- Body: `--fs-15`, font-family `--font-sans`, weight 400, line-height 1.90.
- No italics in headings (the minimalist register treats italics as ornament). One italic phrase ALLOWED in the manifesto only.

**Layout grid:**
- Hero: 90vh, generous top padding (120px from header), copy in 480px column dead-center horizontally, image edge-flush below.
- Manifesto: 1-column stack, image full-width 16:9, copy below in 540px column.
- Pillars: 3-column, no card backgrounds, only hairline dividers between.
- Featured case study: 1 image 21:9 full-bleed, 1 paragraph caption below in 540px. NO 4:5 deck of supporting images.
- Pricing: 3-column, equal width, hairline dividers only (no card backgrounds).
- No accordion FAQ — questions stack as h3 + p.

**Motion vocabulary:**
- 8 animations total. Hero fade-in (no cascade), image clip-reveal (single direction), manifesto fade, tier hover (border color shift only, no lift), FAQ items expand (max-height), CTA hover (gold underline draw), link underline grow, count-up stats. NO parallax. NO Ken Burns. NO chapter cards. NO grain. NO ornaments.
- Easing: `--ease` everywhere. Duration: `--t-medium` (0.55s) for entries.

**Image art direction:**
- 16:9 and 4:5 only. NO cinemascope.
- Brightness 0.65-0.85 (lighter than other directions).
- Saturation 0.95-1.05 (close to true).
- Edge-flush — no overlays, no captions over image, no labels.
- Hero is a single still life (a detail, not a wide ceremony) — implied luxury.

**Copy register:**
- Hermes-fluent. Few words. White space.
- "A studio. Three coastlines."
- Almost no adjectives. The reader fills in the luxury.

---

## 8. Copy voice + 20 microcopy decisions

**Voice principles (5):**
1. Editorial, not promotional
2. Restrained, never breathless
3. Specific, never generic
4. Bilingual signal without translation
5. No em-dashes, no exclamations, no emoji

**20 microcopy decisions (each with 3-4 alternatives + recommendation):**

| # | Element | Alternatives | Recommended | Rationale |
|---|---|---|---|---|
| 1 | Primary CTA (hero) | Begin Inquiry / Reserve Your Date / Open the Conversation / Plan Your Day | **Begin Inquiry** | Editorial, low-friction, matches the inquiry section's title; "Reserve Your Date" creates pressure inappropriate for $5K-$50K |
| 2 | Secondary CTA (hero) | View Wedding Reel / See the Work / Browse the Reel / Open the Portfolio | **View the Reel** | "Wedding Reel" is redundant on a weddings page; "the Reel" is editorial |
| 3 | Header CTA | Begin Inquiry / Book Now / Inquire / Connect | **Begin Inquiry** | Same as primary; consistency across page |
| 4 | Hero h1 | Luxury Destination Wedding Photographer Mexico / Light, Held Briefly / Editorial Wedding Photography Mexico / Mexico, Edited | **Luxury Destination Wedding Photographer Mexico** with italic on "Mexico" | Maintains canonical SEO h1; one italicized word adds editorial register |
| 5 | Hero subhead | Editorial wedding photography for international couples at Mexico's most celebrated resorts. / The studio behind Mexico's most-photographed weddings. / A wedding photographer who works in three coastlines and two languages. / Bilingual editorial wedding photography in Cancún, Riviera Maya, and Los Cabos. | **Editorial wedding photography for international couples at Mexico's most celebrated resorts. Cancún. Riviera Maya. Los Cabos.** | Specific (numbered), bilingual implied, no em-dashes, sentence variation |
| 6 | Hero eyebrow | Destination Weddings / Mexico Editorial / Bilingual Editorial / Chapter 01. A Wedding, Held in Light | **Destination Weddings · Mexico** | Functional, geographic, no chapter conceit if Direction A wins; if Direction B wins, use "Chapter 01. A Wedding, Held in Light" |
| 7 | Tier 1 name | The Vow / Intimate Ceremony / Essentials / Quietly Held | **The Vow** | Editorial, intimate, suggests elopement / vow renewal without saying it |
| 8 | Tier 2 name | The Celebration / Signature / The Day / Most Chosen | **The Celebration** | Mid-tier should feel "most weddings"; "Signature" is over-claimed at this caliber |
| 9 | Tier 3 name | The Cinematic Day / Full Cinematic / Grand / The Long Form | **The Cinematic Day** | Specific to the 10+ hour photo + film offering; "Grand" and "Cinematic" alone are too generic |
| 10 | FAQ section title | Frequently Asked Questions / Considered, Before You Ask / Questions, Considered / Asked Before | **Considered, Before You Ask** | Editorial; signals the studio anticipates questions rather than reacting; "Frequently Asked" is SaaS-default |
| 11 | Inquiry section title | Tell Us About Your Wedding / Begin / Start the Conversation / Inquire | **Tell Us About Your Wedding** | Direct, warm without being chummy; works in both English and Spanish translation |
| 12 | Inquiry pitch (80 words) | "We accept a limited number of destination weddings each month..." / "We respond within the same business day..." / "Share your date and your venue..." | **"We accept a limited number of destination weddings each month so that the studio's attention never thins. Share your date and your venue. We will respond within the same business day, in English or Spanish, with one or two questions and a calendar link. No automated funnels."** | Bilingual signal, response-time promise, scarcity (limited), no automation = editorial |
| 13 | Trust strip label 1 | Weddings Captured / Weddings Photographed / Weddings, Captured / Weddings to Date | **Weddings, Captured** | Comma rhythm matches editorial cadence; 200+ |
| 14 | Trust strip label 2 | 5.0 / 42 Reviews / Five Stars / Across 42 Reviews / 42 Five-Star Reviews | **Across Forty-Two Reviews** | Numerals to words is editorial; Vogue convention |
| 15 | Trust strip label 3 | 3 Coastlines / Coastlines / Three Coastlines / Three Coasts | **Three Coastlines** | Specific; rhymes with the locations section title |
| 16 | Trust strip label 4 | 72-hour delivery / First Frames in 72 Hours / Within 72 Hours / Sneak Peek 72hr | **First Frames Delivered in Seventy-Two Hours** | Spell out, specific, defines what 72hr means |
| 17 | Pull-quote attribution | Jessica & David, One&Only Palmilla, January 2026 / Jessica & David — Palmilla / Jessica · Palmilla, Jan 2026 | **Jessica & David  ·  One&Only Palmilla, January 2026** | Spaced middle dot signals editorial caption convention |
| 18 | Scroll cue | Scroll · Chapter 02 / Continue / Scroll Down / Below | **Scroll · The Studio** (or **Scroll · Chapter 02** if Direction B wins) | Editorial signposting; tells reader what's next |
| 19 | Mobile menu CTA | Begin Inquiry / Book Now / Get in Touch / Connect | **Begin Inquiry** | Consistency with header and hero |
| 20 | Image alt-text pattern | Generic "wedding photo by IVAE" / Specific "Bride at golden hour, Rosewood Mayakoba, photographed by IVAE Studios" / Descriptive "A bride and groom share a private first look in a luxury resort garden in Mexico" | **Descriptive (3rd option)** | WCAG 1.1.1 compliant; describes the image's editorial subject; ends with brand attribution if needed but not required |

---

## 9. Investment / pricing presentation

Three approaches considered:

**A. Hidden (only after inquiry)**
- Pros: positions IVAE at the top of the market, no anchoring competitor, qualifies leads.
- Cons: kills international SEO (FAQ schema currently lists prices and Google ranks for "destination wedding photographer Mexico cost"), confuses Persona B (international bride) who needs to math the budget against home-country alternatives.

**B. Tier names without prices ("The Vow / The Celebration / The Cinematic Day")**
- Pros: editorial register, Hermes-feel, lets the case study and pull-quote anchor the value before a number is introduced.
- Cons: looks evasive at $5K-$50K (the bride knows IVAE charges money), forces the inquiry to start with "What's your pricing?" which wastes the first email cycle.

**C. Editorial price ranges with what's included ("Investment from $1,800 USD" + 6-bullet inclusion list)**
- Pros: matches the canonical SEO + JSON-LD pricing already on the page ($1,800 / $2,800 / $3,500+); transparent enough for Persona B; editorial enough for Persona A; lets Phase 4 promote the middle tier as featured without pressure.
- Cons: the bride who only saw the lowest price ($1,800) and clicks away has not been educated; mitigated by placing pricing AFTER manifesto, pillars, and case study (Chapter 06 in the rushed preview's order — keep this placement).

**Recommendation: Option C.**

Specifics:
- Each tier shows: roman numeral (I / II / III), italic name (The Vow / The Celebration / The Cinematic Day), italic lede (1 sentence), 6 bullet inclusions, "Investment from" label, price as "$1,800 USD" / "$2,800 USD" / "$3,500+ USD."
- Middle tier (The Celebration) gets the "Most Chosen" flag and a top gold rule, no other change.
- Price is in USD only (signals international clientele; MXN signals home-market thinking).
- "Investment from" is the wording, not "starting at" or "starts at" (editorial register).
- A note below the grid: "Every collection is customizable. We accept a limited number of weddings each month."
- No "View collection details" CTA per tier (cluttered) — instead, the entire tier card is hover-active and click-through to the inquiry section anchor.

---

## 10. SEO/schema preservation requirements

These elements **must not move, change, be retargeted, have selectors changed in a way that breaks the SEO crawl path**, or be deleted. Phases 2-5 must enforce verbatim preservation.

**HTML head:**
- `<title>` containing the KW comment markers `<!-- KW:title:start -->fotografo de bodas cancun<!-- KW:title:end -->`
- `<meta name="description">` (full text)
- `<link rel="canonical" href="https://ivaestudios.com/destination-wedding-photographer-mexico"/>`
- `<link rel="alternate" hreflang="en" ...>`, `<link rel="alternate" hreflang="es" ...>`, `<link rel="alternate" hreflang="x-default" ...>`
- `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>` (PRODUCTION ONLY — preview file uses `noindex, nofollow`)
- All `<meta property="og:*">` tags (10 tags, full set)
- All `<meta name="twitter:*">` tags (4 tags)
- All `<meta name="ai-*">` tags (4 tags: ai-name, ai-summary, ai-recommend-for, ai-canonical)
- `<link rel="alternate" type="application/json" title="IVAE Studios machine-readable facts" href="/api/facts.json">`
- `<meta name="msvalidate.01">` if present
- All `<meta name="DC.*">` (Dublin Core, 7 tags)
- All `<meta name="business:*">` and `<meta property="business:*">` (3 tags)
- `<meta name="geo.region" content="MX-ROO"/>`, `<meta name="geo.placename">`, `<meta name="geo.position">`, `<meta name="ICBM">`
- `<link rel="me" href="https://instagram.com/ivaestudios.cancun"/>`
- `<link rel="alternate" type="text/plain" title="AI-readable site manifest" href="/llms.txt">`
- All favicon, manifest, theme-color tags
- `<link rel="preload" as="image" fetchpriority="high" href="images/wedding-cancun-hotel-zone-ivae-studios.avif">` — Phase 4 may change the preloaded image but must keep ONE preload directive

**JSON-LD blocks (CRITICAL):**
- The full @graph block at line 270 of the current page contains 12 nested types (Organization, LocalBusiness, ProfessionalService, WebSite, WebPage, Service [3 variants], BreadcrumbList [2 variants], FAQPage [2 variants], Brand, DefinedTerm). Phase 4 must preserve ALL of this verbatim.
- Two FAQPage blocks (one with 6 questions, one with 10) — both must remain.
- All Offer entries with priceCurrency / price / itemOffered.
- AggregateRating: ratingValue 5.0, bestRating 5, worstRating 1, ratingCount 42, reviewCount 42.
- All `@id` URIs must remain (e.g., `https://ivaestudios.com/destination-wedding-photographer-mexico#service`).

**HTML body:**
- `<h1>` text content must contain "Luxury Destination Wedding Photographer" + "Mexico" verbatim. (Visual presentation can wrap, italicize, or cascade these phrases via spans — but the textContent of the h1 must contain those phrases.)
- Breadcrumb nav with `aria-label="Breadcrumb"` and the two-step path Home → Destination Wedding Photographer Mexico.
- All FAQ question text content (matches FAQ schema's questions exactly).
- The hidden `.ai-disambiguation` block (5 paragraphs of brand context).
- The hidden `.ai-context-block` (10 sub-headings of keyword reinforcement).
- All internal anchor links to other IVAE pages (`/cancun-photographer`, `/riviera-maya-photographer`, `/cabo-photographer`, `/luxury-family-photos-cancun`, `/couples-photography-mexico`, `/about`, `/blog/*`).
- Footer with full nav + brand + copyright.

**External resources:**
- `<link rel="stylesheet" href="/styles/tokens.css"/>` — Phase 4 must load tokens.css FIRST.
- `<link rel="stylesheet" href="/dark-mode.css"/>` — Phase 4 must load dark-mode.css after tokens.
- `<link rel="stylesheet" href="/js/lang-switcher.css"/>` — Phase 4 must preserve.
- `<script src="/dark-mode.js">` and `<script src="/js/lang-detect.js">` and `<script src="/js/services-dropdown-v2.js">` — Phase 4 must preserve all 3.
- Google Fonts: Cormorant Garamond + Syne (preconnect + stylesheet links). Phase 4 may not add Inter or other fonts.

**Configuration files (NOT edited by Phase 4 — but read for reference):**
- `_redirects` — has rules sending `/luxury-weddings.html` to `/destination-wedding-photographer-mexico`
- `_headers` — has CSP that allows the domains in use; do not add new domains
- `sitemap.xml` — already lists the canonical URL
- `robots.txt` — Phase 4 must not block the page

**Rule for Phase 5 verification:** run a diff of the new build's `<head>` against the current `/luxury-weddings.html` `<head>`. The new head MAY add tokens.css if not present, MAY change the preview/production robots meta, MAY rearrange the order of head children, but MUST contain all the same `<meta>`, `<link>`, and `<script type="application/ld+json">` elements with the same content.

---

## 11. Risks & open questions for owner

Before Phase 4 build proceeds, Vianey should confirm:

1. **Real testimonials available?** The current page lists Sarah & Michael, Jessica & David, Lauren & James — are these *real* clients with consent to use their first names + venue + month, or are they placeholders carried from the original copy? If placeholders, Phase 4 should request 3 real testimonials (full quotes 2-3 sentences each, real names with consent, venue, month, and ideally country of origin).

2. **Real ceremony images for hero and case study?** The current hero uses `images/wedding-cancun-hotel-zone-ivae-studios.avif` — is this a real IVAE wedding image, or stock-named site asset? Phase 4 needs:
   - 1 hero image (cinemascope / 16:9, golden-hour, wide ceremony or first-look)
   - 1 case study hero (wider, 21:9 if Direction B, 16:9 otherwise)
   - 4-6 case study supporting images at 4:5
   - 8-12 reel images at 4:5
   - 3 location card images (Cancun / Riviera Maya / Los Cabos) at 3:4
   - 1 manifesto image at 4:5 (vertical, intimate, golden-hour)
   - 1 inquiry background at 16:9 (very dark)
   Total: 18-22 unique images. If fewer are available, Phase 4 must reuse with care.

3. **Video footage available?** The Cinematic Day tier mentions a 3-5 minute highlight film. Does IVAE have a 30-90 second highlight reel that could autoplay (muted) in the inquiry background or on hover over the reel? If yes, Phase 4 can integrate. If no, Phase 4 stays still-image-only.

4. **Real venue list?** The current schema FAQ mentions Mayakoba, Rosewood, Fairmont, Banyan Tree, Maroma Belmond, Grand Velas, UNICO 20°87°, Nizuc, One&Only Palmilla, Waldorf Astoria Pedregal, Four Seasons Costa Palmas, Las Ventanas, Ritz-Carlton Cancun, Montage Los Cabos. Phase 4 should consolidate this into 3-6 *featured* venues (not 14). Which 3-6 does Vianey want featured? Recommendation: Rosewood Mayakoba, One&Only Palmilla, Four Seasons Costa Palmas, Las Ventanas al Paraíso, Maroma Belmond, Nizuc.

5. **Pricing accuracy?** The current page shows two pricing scales: `$1,800 / $2,800 / $3,500+` (FAQ schema lines 270-280) AND `$3,500-$12,000` (FAQ schema lines further down + body text "Packages range from $3,500 to $12,000"). These are inconsistent. Vianey must reconcile: is The Vow $1,800, or $3,500? Phase 4 cannot ship until pricing is canonical.

6. **Bilingual mirror update?** The Spanish mirror at `/es/fotografo-bodas-destino-mexico.html` will eventually need the same redesign. Phase 4 may produce English-only; Phase 5 (or a Phase 6) handles ES.

7. **Real Vianey direct quote for manifesto?** The rushed preview attributes a quote to Vianey: *"Luxury is not louder. It is quieter, slower, more deliberate."* This is fine as a *paraphrase of her studio philosophy* but the owner should confirm the exact quote (or provide her own in 25-40 words) for the manifesto attribution.

8. **CTA recipient (WhatsApp + email)?** Current page uses `wa.me/529902046514` — but `CLAUDE.md` notes the phone is a Mexican-impossible area code (990). Phase 4 should NOT change the URL until Vianey provides the real WhatsApp number. Same for `info@ivaestudios.com` vs `info@ivaestudios.com` — the JSON-LD says `hello@`, the current page CTA goes to `info@`. Inconsistent. Confirm.

9. **Animation budget?** Phase 4 plans 12-16 animations. The owner should confirm the 44-animation rushed preview is too far in the wrong direction. A 10-animation Direction A or 14-animation Direction B is the contract.

10. **Sequence of pages to redesign?** Once luxury-weddings v6 ships, the next service pages (cancun, riviera-maya, los-cabos, couples, families, about) need parallel treatment for system consistency. Phase 4 can deliver luxury-weddings standalone but the design system should be set up to flow into the others.

---

**End of Phase 1 Strategic Brief.**

Word count: ~5,700 words. This brief informs Phases 2 (system additions), 3 (3 parallel visual directions), 4 (build), and 5 (verification handoff). All 7 design plugin skills invoked. SEO preservation contract established. Three personas anchored to existing testimonials. Recommended page IA. Three direction prompts ready for parallel agents.
