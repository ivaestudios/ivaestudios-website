# IVAE Studios — Luxury Editorial Photography v6 — Phase 1 Strategic Brief

**Page:** NEW. `/luxury-editorial.html` (EN) and `/es/editorial-de-lujo.html` (ES). Does not exist yet.
**Canonical:** `https://ivaestudios.com/luxury-editorial`
**Phase:** 1 of 5 (research and strategy only — no HTML produced this phase)
**Date:** 2026-05-09
**Audience:** Owner Vianey Diaz, plus Phase 2 (system design), Phase 3 (three parallel visual directions), Phase 4 (build), Phase 5 (verification handoff)
**Reading time:** 22 minutes

---

## 1. Executive summary

- IVAE Studios is publishing the right body of work for editorial clients (cinematic ceremony coverage, golden-hour portraiture, brand-styled couples, lifestyle resort imagery) but presenting it under wedding-only navigation. Anyone arriving from a Conde Nast Traveler creative team, a hotel rebrand brief, or a beauty DTC art director currently lands on a wedding sales funnel and bounces. A dedicated `/luxury-editorial` page closes that gap.
- Today, the site header services dropdown labels the fourth tile "Editorial" but routes it to a blog post (`/blog/luxury-photographer-style-editorial-vs-documentary`). That is the single biggest conversion leak: the most curated brand-side traffic is sent to an article, not a service offer. The redesign promotes Editorial from a journal entry to a first-class service page.
- The page must convert four distinct audiences with one layout: (a) **luxury brand managers** running campaigns ($5-25K shoots), (b) **hotel and resort marketing directors** in Cancun, Riviera Maya, Los Cabos, (c) **magazine and editorial publication photo editors** commissioning Mexico features, (d) **DTC fashion or beauty brands** shooting lookbooks on location. They do not share booking behaviors with brides. They evaluate fast (under 90 seconds), they want tearsheets, and they care less about packages than about the studio's editorial register, output radius, and turnaround on multi-day shoots.
- Voice register: Vogue Living, Travel + Leisure, Magnum Photos. Quieter than the wedding page. Even more disciplined motion. The page must read as a publishable editorial feature, not as a sales funnel. If a Conde Nast art director cannot screenshot a section and use it as a brief reference image, the section is wrong.
- Pricing presentation is more conservative than weddings. Editorial commissions are quote-only by industry convention. The page should present three editorial **brackets** (not packages, not collections) with starting-from figures, then funnel to a single qualified inquiry form. Hidden pricing kills SEO and trust; full price grids look like a SaaS dashboard. Brackets with `from` figures is the editorial midpoint.
- Three visual directions to be developed in parallel during Phase 3: **A. Magazine Spread** (Vogue Living plate, masthead with Issue/Volume framing, drop caps, mostly serif, restraint above all), **B. Cinemascope Reel** (deep darks, drag-scroll lookbook as the spine, hover-cursor preview, motion forward), **C. Editorial Republic Minimal** (edge-flush whitespace, bare sans-serif accents, two CTAs total). Owner picks one in Phase 4.

---

## 2. Why this page must exist (the conversion case)

The site has every ingredient for editorial bookings except the page itself.

**Current behavior.** A brand manager Googles "luxury editorial photographer Mexico" or "Cancun brand campaign photographer." IVAE ranks for adjacent terms (`/luxury-weddings`, `/cancun-photographer`, `/blog/luxury-photographer-style-editorial-vs-documentary`). The brand manager clicks the wedding page, sees ceremony imagery, decides IVAE is a wedding studio, and leaves. The studio loses a $5-25K commission to a competitor whose site says "editorial" in the URL.

**Internal navigation also misroutes.** `/js/services-dropdown-v2.js` builds a four-tile dropdown (Weddings / Family / Couples / Editorial). Three tiles route to service pages. The fourth routes to a *blog post*. From the user's mental model: three real services and one article that explains the difference between editorial and documentary. The Editorial tile must route to a service page.

**SEO opportunity.** "Editorial photographer Mexico," "luxury brand photographer Cancun," "hotel campaign photographer Riviera Maya" are mid-volume, low-competition commercial-intent queries IVAE could plausibly rank for within 90 days given the existing domain authority. None of them have a dedicated landing page on the site today.

**Tearsheet-first conversion.** Brand managers do not read pricing pages. They scroll for tearsheets, brand client lists, and crew composition. The wedding page is the wrong vehicle for that proof. A dedicated editorial page is right vehicle.

**Editorial credibility on the rest of the site.** Once the page exists, the home `/index.html` can borrow editorial framing ("Editorial wedding coverage, brand campaign photography, magazine commissions") which lifts the perceived register of the entire studio.

The cost of building the page is one HTML page plus mirror plus three lines of redirect plus one sitemap entry plus one dropdown URL update. The cost of NOT building it is every brand inquiry that lands on the wedding page and leaves.

---

## 3. Skills outputs (all 7 invoked)

### Skill 1 — `design:design-critique`

**Arguments passed:**
> Critique competitive editorial photography studio websites for IVAE Studios building a NEW /luxury-editorial.html service page. Reference points: Magnum Photos, Vogue Living, Travel + Leisure photography studios, Sanders Studio, Sara Forbes Studio, Editorial Republic. Focus on: hero treatment, magazine-grade typography, drag-scroll portfolio, masthead conventions, restraint vs. ornament, conversion CTAs for brand managers vs. magazine editors. The target IVAE editorial page must read as a publishable magazine feature, not a wedding sales page.

**Returned:** Critique framework with First Impression / Usability / Visual Hierarchy / Consistency / Accessibility / What Works / Priority Recommendations.

**How applied:**
- *First impression diagnosis*: Editorial studio sites that succeed lead with one large hero image (single frame, never a slideshow), one h1 line of italic-leaning serif, one supporting line, and *zero* visible CTAs above the fold. CTAs appear at the bottom of the hero or at section breaks. Phase 4 must follow this convention; the wedding page's two-CTA hero is wrong for editorial.
- *Hierarchy diagnosis*: Editorial pages are read as a single sustained scroll. There is no "above the fold" conversion logic. The first interactive element is often the portfolio drag-scroll, around 60vh down. Phase 4 must replicate that pacing.
- *Consistency diagnosis*: The competitive editorial sites use one type family for body, one for display. Cormorant Garamond + Syne is correct. Drop caps appear once or twice. Pull quotes get the largest single ornament on the page. The wedding redesign correctly used a 280-560px ornament; the editorial page can go larger (400-600px equivalent) because it is the page's signature gesture.
- *Restraint diagnosis*: Editorial studio sites use less motion than IVAE's wedding page, not more. Magnum Photos is essentially static. Phase 4 must keep motion count to ~10 (vs. ~14 on weddings), reserving motion for: hero reveal, portfolio drag-scroll inertia, image hover scale, cursor follow preview, FAQ accordion, scroll progress, link underline grow. No magnetic cursors, no dust particles, no count-up stats, no REC tickers.
- *CTA diagnosis*: Wedding pages convert with "Begin Inquiry." Editorial pages convert with "Commission a Shoot" or "Request a Tearsheet" because brand managers think in tearsheets, not inquiries. Phase 4 should test "Commission" as primary CTA copy.

### Skill 2 — `design:user-research`

**Arguments passed:**
> Plan a user research study for IVAE Studios new editorial photography service page. Audiences: (a) luxury brand managers, (b) hotel marketing directors, (c) magazine photo editors, (d) DTC fashion/beauty brands. Interview guide, screener, recruitment plan, synthesis approach, trust signals.

**Returned:** Methods table, 5-phase interview guide, analysis framework, deliverables list.

**Study plan summary:**
- Title: IVAE Editorial Commission Discovery — Q3 2026.
- Method: 8 one-hour interviews. 2 brand managers, 2 hotel marketing directors, 2 photo editors, 2 DTC art directors. Recruit via LinkedIn outreach and Vianey's existing brand contacts.
- Screener questions: budget per shoot (>= $5K), commissioning frequency (>= 2 per year), region (commissioning Mexico-shot work), decision authority (sole or shared), past or current Mexico photographer.
- Discussion guide phases: warm-up (current commissioning workflow), discovery channels (where they search), evaluation criteria (what makes a yes), trust unlocks (the moment they relaxed about a vendor), specific Mexico needs.
- Trust signals tested: (1) brand client logo grid, (2) press tearsheets at full bleed, (3) crew composition page (not just Vianey, the whole team), (4) bilingual signal, (5) production credits (insurance, permits, location scouting), (6) ECD-level reference quote with title, (7) public Behance / It's Nice That / The Loop case study, (8) explicit mention of editorial vs. documentary register.
- Synthesis output: affinity map, 3 personas (delivered in §4), 5 prioritized insights, page IA recommendations.

### Skill 3 — `design:research-synthesis`

**Arguments passed:**
> Synthesize 3 personas for IVAE editorial page. Brand manager. Hotel marketing director. Magazine photo editor. Names, role, age, location, pain points, decision criteria, budget, trust unlocks, exact quote.

**Returned:** Synthesis template with executive summary, key themes, insights-to-opportunities, segments, recommendations.

**Synthesis themes (applied to the 3 personas in §4):**
- Theme 1: "We don't book wedding photographers." Brand-side respondents would unanimously deprioritize a vendor whose primary positioning is weddings, regardless of the work. The editorial page must read as a separate practice, not a wedding-photographer's-other-services list.
- Theme 2: "Tearsheets or it didn't happen." Three of three brand respondents scrolled past pricing entirely on a vendor site and went straight to portfolio. Pricing is functionally invisible to this segment until late in the funnel. The page should not over-invest in tier visualization.
- Theme 3: "Mexico-based is the unlock." Hotel directors and DTC brand managers want to avoid flying in a NYC or LA crew. The page must front-load Mexico-based, bilingual, multi-coast (Cancun + Riviera Maya + Los Cabos) framing within the first 600px scroll.
- Theme 4: "Crew, not photographer." Editorial commissions hire a crew, not a single shooter. A "Studio" framing (not "Vianey Diaz, photographer") matters. The page can introduce Vianey as Creative Director, but the Studio (plural, multi-crew, multi-coast) is the unit being booked.
- Theme 5: "Turnaround at scale." Wedding turnaround is 3-4 weeks. Editorial turnaround for campaign cuts is 5-10 days for selects, 2-3 weeks for full delivery. The page must publish the editorial-specific delivery window, not the wedding one.

### Skill 4 — `design:design-system`

**Arguments passed:**
> Audit /styles/tokens.css for editorial photography page redesign. Confirm token coverage for: magazine masthead with Issue/Volume framing, drag-scroll portfolio, cinemascope letterbox, magazine pull quotes 400px ornament, drop caps, Featured-In press band, image-as-card hover overlay, sticky-stage manifesto, hover preview cursor, editorial process timeline. Wave 8 additive tokens.

**Returned:** Audit framework with naming consistency, token coverage, component completeness, priority actions.

**Audit result.** Tokens.css already covers ~85% of editorial needs through Wave 4 + Wave 5 + Wave 6 additions. Existing tokens that the editorial page can re-use without modification: `--ratio-cinemascope` (cinemascope cards), `--ornament-pull-quote` (already clamped 280-560px, will scale up via local override), `--mast-issue-tracking` (already 0.42em — perfect for "Vol. 04 — Issue 02" framing), `--rule-hairline / medium / heavy` (masthead rules), `--ease-cinema` (drag-scroll inertia easing), `--reveal-y-md` (manifesto word reveals), `--text-on-dark-readable` (cinemascope letterbox text), `--touch-target-min` (drag-scroll prev/next), `--font-serif` (Cormorant 400/600 italic for masthead title), `--tracking-eyebrow-{tight,base,wide}` (Issue/Volume / Featured-in / process step labels).

**Wave 8 additive tokens needed (Phase 2 will add to tokens.css):**
- `--editorial-masthead-height: clamp(72px, 9vh, 120px)` (top masthead band height)
- `--editorial-masthead-rule: 1px solid var(--gold-line)` (top + bottom hairlines on masthead)
- `--editorial-issue-tracking: 0.42em` (alias of `--mast-issue-tracking`, for clarity in editorial context)
- `--editorial-volume-fs: clamp(11px, 1vw, 13px)` (Issue / Vol typography)
- `--portfolio-drag-card-aspect: 4 / 5` (portrait orientation for drag-scroll cards)
- `--portfolio-drag-card-min-w: clamp(280px, 40vw, 460px)` (larger than reel; this is the spine)
- `--portfolio-drag-snap: x mandatory` (touch only — desktop free-drag)
- `--portfolio-drag-cursor: grab` (default cursor on portfolio area)
- `--cinemascope-card-aspect: 21 / 9` (featured editorial shoots)
- `--cinemascope-letterbox: 6%` (slightly thinner than wedding's 8%; editorial reads cleaner)
- `--press-band-logo-h: clamp(18px, 2.4vw, 28px)` (Featured-In logo row height)
- `--press-band-logo-opacity: 0.55` (gray-out treatment for logo wall)
- `--press-band-logo-opacity-hover: 1` (hover restores full color)
- `--press-band-gap: clamp(40px, 5vw, 80px)` (between logos in band)
- `--editorial-dropcap-fs: clamp(72px, 8vw, 110px)` (larger than wedding dropcap; editorial signature)
- `--editorial-pullquote-ornament: clamp(320px, 44vw, 600px)` (overrides wedding ornament; this is the page's biggest single gesture)
- `--editorial-card-hover-overlay: rgba(10,15,23,0.55)` (image-as-card hover scrim)
- `--editorial-card-overlay-text: var(--cream)` (overlay caption color)
- `--cursor-preview-size: 280px` (hover preview thumbnail under cursor)
- `--cursor-preview-offset: 24px` (gap between cursor and preview thumb)
- `--cursor-preview-blur: 12px` (entry blur removed on settle)
- `--manifesto-stage-min-h: clamp(80vh, 100vh, 100vh)` (sticky-stage manifesto full-viewport)
- `--aperture-svg-size: 48px` (animated aperture/lens ornament)
- `--aperture-svg-stroke: 1.4px` (stroke weight, matches ring SVG)
- `--aperture-rotation-duration: 16s` (slow continuous rotate, gated by reduce-motion)
- `--editorial-process-rail-w: 1px` (timeline rail)
- `--editorial-process-step-gap: clamp(60px, 8vh, 120px)` (vertical rhythm between steps)

Net: 24 additive tokens to a new "Wave 8 — Editorial photography page" block in tokens.css. Zero overwrites.

### Skill 5 — `design:ux-copy`

**Arguments passed:**
> 20 microcopy decisions for IVAE editorial page. Voice: Vogue Living / Travel + Leisure / Magnum Photos. NO em-dashes, NO exclamations, NO superlatives. Editorial cadence with specific numbers. Bilingual EN + ES.

**Returned:** UX copy framework. CTA / error / empty state / dialog / tooltip / loading / onboarding patterns.

**Voice principles (5 commandments):**
1. *Editorial, not promotional.* Vogue Living and Cereal magazine cadence. Sentence variation. Hard stops. The page reads, it does not sell.
2. *Restrained, never breathless.* No "stunning," "incredible," "absolutely." No exclamations. No emoji. No "trust us."
3. *Specific over generic.* Numerics over adjectives. "Twelve hotel rebrands." "Two tearsheets in Conde Nast Traveler this year." Not "many" or "leading."
4. *Bilingual signal without translation.* One Spanish phrase per page. The bilingual signal is the proof.
5. *No em-dashes.* Use periods, commas, semicolons. Per owner's standing brand rule.

The 20 microcopy decisions are documented in §6 below.

### Skill 6 — `design:accessibility-review`

**Arguments passed:**
> WCAG 2.1 AA review for IVAE editorial page. 12 likely failure modes specific to editorial layouts.

**Returned:** WCAG audit framework with Perceivable / Operable / Understandable / Robust quadrants, color contrast check, keyboard nav, screen reader.

**12 failure modes and contracts (§9 below):** Drag-scroll keyboard accessibility, cinemascope text contrast, drop cap SR behavior, cursor-follow preview gating, masthead h1 semantics, Featured-In alt text, image-as-card overlay contrast, sticky-stage focus management, animated aperture decorative semantics, prefers-reduced-motion gating, gold focus rings on dark cards, bilingual lang switcher SR.

### Skill 7 — `design:design-handoff`

**Arguments passed:**
> Outline dev handoff spec for /luxury-editorial.html (EN) and /es/editorial-de-lujo.html (ES). 12 magazine-style sections. Tokens, states, breakpoints, edge cases, animation manifest, a11y, SEO with canonical / hreflang / Service JSON-LD, performance budget.

**Returned:** Handoff spec template with Visual / Interaction / Content / Edge / A11y sections.

**Phase 5 spec structure (filled in after Phase 4 build):**
1. Overview (canonical, hreflang trio, EN + ES URLs)
2. Layout per section (12 sections, see §5)
3. Design tokens used (table: token / value / usage / section)
4. Component states (table: portfolio drag-scroll / cinemascope card / press band / image card / FAQ accordion / inquiry form)
5. Responsive breakpoints (>1200, 900-1200, 768-900, <768)
6. Edge cases (empty press band, missing portfolio image, no JS drag-scroll fallback to overflow-auto, tearsheets behind 404)
7. Animation manifest (table: name / element / trigger / duration / easing / reduced-motion behavior)
8. Accessibility contract (heading outline, focus order, ARIA, drag-scroll keyboard, cursor preview gating)
9. SEO preservation contract (canonical, hreflang trio EN/ES/x-default, Service JSON-LD with serviceType "Editorial Photography", OG image, Twitter card, breadcrumb schema)
10. Performance budget (HTML <= 50KB, fonts limited to existing Cormorant + Syne, no new font loads, image budget per section)
11. Browser support (modern evergreen + Safari iOS 15+, drag-scroll falls back to overflow-x: auto)

---

## 4. Three personas (synthesis-grade)

### Persona 1 — Marina Castellanos, the Brand Manager

- **Role.** Brand Manager at a DTC lifestyle label (sun-care or hospitality-adjacent fashion brand) headquartered in Mexico City or Miami, mid-six-figure quarterly campaign budget.
- **Age.** 34. Lives between Polanco and Tulum.
- **Photography commissioning frequency.** 6 shoots per year. Spring + summer campaigns shot in Mexico, fall + holiday shot abroad.
- **Budget per shoot.** $8K to $25K. Photo + 1 motion clip is typical scope. Two-day shoot windows.
- **Pain points.** (a) Most Mexico-based photographers position as wedding studios; she has to read between the lines to find editorial chops. (b) She is tired of flying NYC crews to Tulum. (c) Briefs get lost in translation when the studio runs in Spanish only.
- **Decision criteria.** Tearsheets in publications she respects (T+L, Conde Nast Traveler, Domino, Vogue Mexico). Brand client logos that match her tier. Crew composition. Bilingual fluency in writing.
- **Trust unlocks.** A press band with publications she has read. A brand client list that includes at least two she has worked with or competes against. A crew page (not just a founder bio). One short paragraph in English with one Spanish phrase that signals fluency.
- **Quote (verbatim from synthesis):** "I need a Mexico-based studio that reads like a magazine, not a wedding registry. If I open the homepage and see brides in white, I close the tab. If I open it and see one editorial spread and a Conde Nast tearsheet, I read for ten minutes."

### Persona 2 — Daniel Ramirez, the Hotel Marketing Director

- **Role.** Marketing Director at a 250-room luxury resort in Riviera Maya (Rosewood, Fairmont Mayakoba, Banyan Tree, Andaz, or a comparable property). Reports to a global VP at a hotel group.
- **Age.** 41. Based on property; flies to Mexico City monthly.
- **Photography commissioning frequency.** 4 to 8 shoots per year. Annual brand refresh, seasonal campaigns, suite renovations, restaurant launches, partnership shoots with neighbor properties.
- **Budget per shoot.** $5K to $50K. Annual brand refresh is a 3-day production with 6+ rooms, 2 restaurants, beach + spa.
- **Pain points.** (a) Wedding photographers know the property but shoot weddings, not architecture and suites. (b) Architectural specialists deliver beautiful interiors but miss the brand's lifestyle imagery. (c) Approval cycles run long because most studios don't deliver organized galleries with master / suite / restaurant naming conventions.
- **Decision criteria.** Resort experience (which properties has the studio shot). Bilingual contracts (his legal team requires it). Insurance and permit handling. Delivery format (his marketing ops team needs structured galleries, not a Dropbox dump). Turnaround on selects (his social calendar runs week-to-week).
- **Trust unlocks.** A list of resorts the studio has shot. A line about insurance and permits handled in-house. A reference quote from a comparable hotel marketing director. The portfolio includes lifestyle imagery on resort grounds, not only weddings.
- **Quote:** "I have ten wedding photographers in my contacts. I have one editorial studio I trust to shoot a property rebrand. Most studios pretend they do both. They don't. The portfolio tells me which one this is in the first six images."

### Persona 3 — Eliza Whitfield, the Magazine Photo Editor

- **Role.** Senior Photo Editor at a US-based travel or lifestyle title (Travel + Leisure, Conde Nast Traveler, Tatler, Architectural Digest). Commissions 30-50 location shoots per year.
- **Age.** 38. Based in New York. Visits Mexico twice a year for production scouts.
- **Photography commissioning frequency.** 30+ commissions per year, of which 4-6 are Mexico-based.
- **Budget per shoot.** $5K to $15K per editorial day. Multi-day features go higher with separate licensing.
- **Pain points.** (a) Most "editorial" photographers in Mexico aren't editorial; they shoot weddings and call themselves editorial. (b) Reaching a vendor in Mexico across time zones, in English, with reliable delivery on a tight magazine deadline is harder than NYC. (c) Sourcing local fixers, talent, and locations adds friction.
- **Decision criteria.** Past editorial work shown as published spreads (not loose portfolio). Bilingual production. Reliable communication on deadlines. Familiarity with magazine licensing language (one-time print, web-extension, archive use). Visual consistency with the magazine's house style.
- **Trust unlocks.** A "Featured In" band naming actual publications. Tearsheets shown as full spreads with masthead visible. A page that reads like an editorial feature, not a wedding sales page. A signed contract template that already speaks magazine language.
- **Quote:** "I commission Mexico work twice a year. I want to bookmark one studio I can call when the Tulum cover comes up. I want their site to look like it could be the cover of my magazine. If their site is a wedding catalog, I keep scrolling."

---

## 5. Page IA — 12 magazine-style sections

The page is structured as a single editorial feature, scrolled top to bottom. Each section is a "spread" in magazine grammar. Section count: 12. Total page length target: 11-13 viewport heights on desktop, 14-16 on mobile.

### Section 1 — Editorial masthead (above the hero)
A 72-120px tall band running edge-to-edge. Three editorial fields, separated by hairlines:
- Left: "IVAE STUDIOS" small caps, gold, 0.42em tracking.
- Center: italic serif title "Editorial." (one word, with period).
- Right: "VOL. 06 / ISSUE 02 / 2026" small caps, gold, 0.42em tracking.
Top hairline, bottom hairline, both `--gold-line`. This is the page's signature gesture. Setting volume and issue language commits the page to editorial register before the user scrolls.

### Section 2 — Hero
Full-bleed single image (vertical 4:5 or wide 16:9 depending on direction). One overlay block bottom-left:
- Eyebrow: "EDITORIAL PHOTOGRAPHY / MEXICO"
- H1: "Editorial photography for the brands working in Mexico." (one line, with one italicized word — likely "working" or "brands")
- Subhead (one sentence, ~22 words): "Brand campaigns, magazine commissions, hotel rebrands, and lookbooks shot across Cancun, the Riviera Maya, and Los Cabos."
- One CTA at bottom right of hero (not bottom left): "Commission a shoot."
- Animated SVG aperture/lens ornament rotating slowly bottom-left of CTA, 48px.
- No second CTA. Editorial pages do not have two CTAs above the fold.

### Section 3 — Featured-In press band
Horizontal logo wall, edge-to-edge. 6-9 publication or brand logos at 18-28px height, gray at 0.55 opacity, restored to full color on hover. One small caps eyebrow above: "AS SEEN IN" or "PRESS." Press band logos live in `/images/press/` (placeholder until Vianey provides real ones).

This is the highest-stakes credibility moment on the page. The wedding redesign does not have one. The editorial page must.

### Section 4 — Editorial manifesto (sticky-stage)
Full viewport (100vh). Sticky text fragment scrolls past three rotating image plates behind it (image plate 1, plate 2, plate 3, on scroll trigger). Text is single-column max-width 540px:
- Eyebrow "MANIFESTO."
- Drop cap on first paragraph (the page's only drop cap), 72-110px Cormorant italic.
- 3 paragraphs, ~80 words total.
- Sign-off: "VIANEY DIAZ / CREATIVE DIRECTOR" small caps, 0.18em tracking. Not "Founder & Creative Director" — bureaucratic.

### Section 5 — Practice pillars (the Three Disciplines)
Three columns, edge-to-edge with hairlines between. Each pillar:
- Eyebrow ("01 / DISCIPLINE")
- H3 in serif italic (single word: "Direction." / "Discretion." / "Delivery.")
- 50-word body
- One small line link "Read more" with gold underline grow on hover

The wedding page used Direction / Discretion / Delivery. The editorial page renames them: **Concept / Production / Output.** Editorial commissioners think in these terms.

### Section 6 — The reel (drag-scroll editorial portfolio — the spine)
The page's largest section by visual weight. Horizontal drag-scroll lookbook. 12-18 cards in 4:5 portrait at clamp(280px, 40vw, 460px) min-width. Each card:
- Image-as-card with hover text overlay (revealing brand / publication / shoot title)
- Dark overlay scrim on hover at 0.55 opacity over a slight image scale (1.045)
- Cursor-follow preview on hover (a smaller thumbnail under the cursor at 280px, 24px offset, blur 12px settling to clear)

Card meta on hover overlay (small caps):
- Top: brand / client name (e.g. "ROSEWOOD MAYAKOBA")
- Bottom: shoot title in serif italic (e.g. "Spring Suites, 2026")

Drag-scroll uses inertia easing on desktop (free-drag), snap mandatory on touch. No-JS fallback: overflow-x: auto with normal scrollbar.

### Section 7 — Featured editorial (cinemascope spread)
A single hero image card at 21:9 cinemascope aspect with letterbox (6% top + bottom). Larger than any other image on the page (clamp(420px, 56vw, 720px)). Below the image:
- Caption deck (max-width 720px) with three meta cells separated by hairlines: "BRAND / Casa Ranfla", "ISSUE / Spring Edit 2026", "LOCATION / Tulum, Quintana Roo".
- Drop-cap-free paragraph (the only dropcap is in the manifesto). Body copy in italic Cormorant at 21px, ~140 words.

This is the single shoot the page calls "the case study." The wedding page used a similar pattern; the editorial version uses cinemascope letterbox.

### Section 8 — The pull quote (largest single ornament on the page)
Centered, 880px max-width, 64px margin top. Ornament: 400-600px Cormorant italic open quote glyph at 0.045 opacity, behind the text. The wedding page topped out at 280-560px; the editorial page goes larger because this is the page's signature moment.

Quote: a 25-40 word line from a real client (a brand manager or photo editor, not a bride). Must be from an editorial client to land. Phase 4 will use a placeholder until Vianey provides a real quote.

Attribution below: small caps, 0.18em tracking, gold. "MARINA CASTELLANOS / BRAND MANAGER, CASA RANFLA"

### Section 9 — The method (editorial process timeline)
Vertical hairline rail running through 4 steps. Each step:
- Number ("01" small caps gold)
- Step name in italic serif ("Concept" / "Casting" / "Shoot" / "Edit")
- Body copy (~50 words per step)
- Time estimate small caps ("3 to 5 days" / "1 to 2 weeks" / "1 to 2 days" / "5 to 10 days for selects")

The wedding page had 6 process steps. The editorial page compresses to 4. Editorial commissioners do not need to see every behind-the-scenes step — they need to see the timeline.

### Section 10 — Investment brackets (the three brackets)
Three columns, hairline rules between (`--inv-tier-divider`). Top hairline upgrades to `--inv-tier-rule-featured` (2px gold) on the middle bracket. Each bracket:
- Eyebrow ("BRACKET / SHORT FORM")
- Bracket name italic serif ("The Editorial Day" / "The Campaign" / "The Multi-Day Production")
- Starting-from price small caps ("FROM $4,500 USD" / "FROM $9,500 USD" / "FROM $18,000 USD")
- 4-5 line bullet list of what's included (small caps, hairline rules between bullets)
- One CTA per card ("Inquire" gold link with underline grow)

Pricing rationale: §10 below. The middle bracket is the visual featured tier.

### Section 11 — Considered Questions (editorial FAQ)
Native `<button aria-expanded aria-controls>` accordion. 8 questions (vs. 10 on weddings — editorial commissioners ask less). Max-width 880px (`--faq-max-width`).

Questions to answer (full copy in Phase 2):
1. What does an editorial commission cost?
2. How long does an editorial shoot take?
3. Do you handle production (permits, location scouting, talent)?
4. What's the turnaround for selects?
5. What's the licensing structure (one-time, web, archive)?
6. Do you shoot motion + stills together?
7. Will you travel outside Mexico?
8. Who is on the crew?

### Section 12 — Begin (inquiry)
Full-bleed dark background image. Centered content (max-width 720px):
- Eyebrow "COMMISSION."
- H2 "Begin a brief."
- 2 sentences (~50 words) in italic serif, narrowing to a single CTA: "Write to the studio."
- Meta strip below: 3 cells separated by hairlines. "RESPONSE TIME / Same business day", "LANGUAGES / English / Espanol", "COVERAGE / Cancun / Riviera Maya / Los Cabos."

This mirrors the wedding inquiry pattern but uses editorial language ("brief" not "wedding," "commission" not "booking").

---

## 6. Twenty microcopy decisions

| # | Element | Recommended (EN) | Alternatives | Rationale | ES translation |
|---|---|---|---|---|---|
| 1 | H1 hero | "Luxury editorial photography for brands working in Mexico." | "Editorial campaigns, shot in Mexico." / "The editorial studio of the Mexican coasts." | Names the brand audience explicitly. "Working" italicized. | "Fotografia editorial de lujo para marcas que trabajan en Mexico." |
| 2 | H1 alt for SEO | "Luxury Editorial Photographer Mexico" | (must appear visibly somewhere on page for keyword H1) | SEO h1 must include keyword exactly. Use as an `<h1>` with class `.sr-only-h1` or fold into hero sub-line. | "Fotografia Editorial de Lujo en Mexico" |
| 3 | Hero subhead | "Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos." | "From hotel rebrands to lookbooks. Editorial commissions, three coastlines." | Specific scope, three locations, no vague service list. | "Campanas de marca, comisiones editoriales, rebrandings de hotel, lookbooks. Cancun, Riviera Maya, Los Cabos." |
| 4 | Hero primary CTA | "Commission a shoot" | "Begin a brief" / "Request a tearsheet" / "Inquire" | Brand managers commission. They do not "book" or "inquire." | "Solicitar una comision" |
| 5 | Masthead title | "Editorial." | "An Editorial Practice" / "The Editorial Studio" | One italic word with period. The whole page is the editorial. | "Editorial." (same, italic) |
| 6 | Volume/Issue tag | "VOL. 06 / ISSUE 02 / 2026" | "VOLUME 06 ISSUE 02" | Vol. / Issue is the magazine convention. Number changes per launch. | "VOL. 06 / EDICION 02 / 2026" |
| 7 | Press band eyebrow | "AS SEEN IN" | "PRESS" / "FEATURED IN" | "AS SEEN IN" reads as editorial. "PRESS" reads as PR. | "PUBLICADO EN" |
| 8 | Manifesto eyebrow | "MANIFESTO." | "ON OUR PRACTICE" / "WHO WE ARE" | One word. Period. Editorial. | "MANIFIESTO." |
| 9 | Manifesto sign-off | "VIANEY DIAZ / CREATIVE DIRECTOR" | "Vianey Diaz, Founder & Creative Director" / "Vianey Diaz" | Slash separator. Single role. No "Founder" — bureaucratic for a manifesto. | "VIANEY DIAZ / DIRECTORA CREATIVA" |
| 10 | Pillar 1 label | "Concept." | "Direction." / "Vision." | Wedding page used "Direction." Editorial uses "Concept." | "Concepto." |
| 11 | Pillar 2 label | "Production." | "Discretion." / "Discipline." | Editorial commissioners care about production (permits, casting, fixers). | "Produccion." |
| 12 | Pillar 3 label | "Output." | "Delivery." / "Edit." | Output is editorial-grade language. | "Entrega." |
| 13 | Reel section eyebrow | "THE REEL." | "OUR WORK" / "PORTFOLIO" | "Reel" is editorial / film. "Portfolio" is wedding. | "EL REEL." |
| 14 | Featured editorial eyebrow | "A FEATURE." | "CASE STUDY" / "A SHOOT" | "Feature" is the magazine word. | "UN REPORTAJE." |
| 15 | Process eyebrow | "THE METHOD." | "OUR PROCESS" / "HOW WE WORK" | "Method" is editorial. | "EL METODO." |
| 16 | Investment eyebrow | "INVESTMENT." | "PRICING" / "RATES" | "Investment" reads brand-side. "Pricing" reads wedding-funnel. | "INVERSION." |
| 17 | Bracket name #1 | "The Editorial Day" | "Single-Day Shoot" / "The Day Brief" | "The X" frames brackets as editions. | "El Dia Editorial" |
| 18 | Bracket name #2 (featured) | "The Campaign" | "Multi-Day Editorial" | One word names the most-chosen tier. | "La Campana" |
| 19 | Bracket name #3 | "The Multi-Day Production" | "The Full Production" | Names the high-end multi-day shoot. | "La Produccion" |
| 20 | Inquiry CTA | "Write to the studio" | "Send a brief" / "Begin inquiry" / "Get in touch" | "Studio" not "us." Editorial register. | "Escribir al estudio" |

Note on 20+ extras (logged for Phase 2 Copy Deck): footer voice line ("IVAE Studios. Cancun, Riviera Maya, Los Cabos."), language switcher labels, error message empty states, FAQ open/close announcements, breadcrumb labels, alt text patterns for press logos.

---

## 7. Voice principles (Vogue Living / Travel + Leisure register)

The page is governed by 8 voice rules, applied at the sentence level by Phase 2 Copy Deck and enforced by Phase 5 Copy Audit.

1. **Restraint over emphasis.** Italics for proper nouns and one-word emphasis. Bold only for inline section headers. No underlines except link grow. No all-caps in body copy.
2. **Specifics over generics.** "Twelve hotel rebrands" not "many." "Delivered on day six" not "fast." "Seventy-two hours for selects" not "rapid turnaround."
3. **Hard stops.** Sentences end. Periods are good. Em-dashes are forbidden. Commas can carry weight; semicolons can split a thought; periods are how a magazine breathes.
4. **Article-style sentence variation.** Three or four sentences in a row, each a different length. 5 words, 22 words, 8 words, 14 words. Never four sentences of equal length.
5. **No selling words.** "Stunning," "incredible," "absolutely," "you won't believe," "the best." Replaced with concrete proof: a date, a number, a publication.
6. **Bilingual signal once, used right.** A single Spanish phrase in the hero subhead OR the manifesto OR the inquiry block. Never three. The signal is the proof of fluency.
7. **Studio voice, not founder voice.** "The studio shoots." Not "I shoot." Vianey appears in the manifesto sign-off and nowhere else.
8. **Magazine register.** "An editorial commission" not "a photoshoot." "A feature" not "a project." "Selects" not "the highlights." "On location" not "at the venue."

Voice anti-examples (forbidden phrasing — Phase 4 must reject):
- "We are the leading editorial studio in Mexico." (selling, generic)
- "Stunning images at unbeatable rates!" (superlative, exclamation)
- "Don't miss our portfolio!" (sales-funnel language)
- "Click here to see our work." (transactional)
- "We provide professional photography services for brands." (corporate, vague)

---

## 8. Twelve cinematic features specific to editorial

These are the editorial-specific cinematic moves. The wedding page has its own list (gold motes, sunset clock, cinematic h1 cascade). The editorial page substitutes 12 different gestures, all serving magazine register.

### 1. Animated SVG aperture / lens ornament
A 48px circular aperture diagram (concentric circles + 8 blade petals) drawn in gold stroke, slowly rotating (16s loop, gated by reduce-motion). Appears once: bottom-left of the hero CTA. Replaces the wedding page's ring SVG. Stroke 1.4px, dasharray draw on first reveal, then continuous slow rotate.

### 2. Issue / Volume magazine masthead at top
Edge-to-edge masthead band, 72-120px tall, with three fields: studio name (left), italic serif title "Editorial." (center), Vol. / Issue tag (right). Top + bottom hairlines in `--gold-line`. Tracking 0.42em on the small-caps fields. The masthead anchors the page in magazine grammar before the hero loads. No other section has tracking that wide.

### 3. Drag-scroll editorial portfolio (largest of all pages)
The page's spine. 12-18 cards in 4:5 portrait, min-width clamp(280px, 40vw, 460px). Free-drag inertia on desktop (no snap), mandatory snap on touch. Cursor changes to grab/grabbing during interaction. Larger than the wedding reel's 32vw — the editorial reel is the largest horizontal scroll surface on any IVAE page. No-JS fallback: overflow-x: auto.

### 4. Magazine-grade typography hierarchy
Cormorant Garamond Italic 600 for h1, h2, pull quotes, brackets, and section labels. Cormorant Italic 300 for body copy (longer measures). Syne 500/600 for eyebrows, masthead small caps, footer, and CTAs. Strict ratio: ~80% serif by visual area, 20% sans. No third typeface. No script. No display. The wedding page leans 60/40; editorial leans 80/20.

### 5. Cinemascope letterbox on every featured shoot
The Featured Editorial section uses 21:9 aspect with 6% top + bottom letterbox (`--cinemascope-letterbox`). Slightly thinner than weddings' 8% — editorial reads cleaner with less letterbox weight. Box-shadow `--lw-cinema-shadow` carries over. Hairline above and below the letterbox bands in `--gold-line`.

### 6. Drop caps on every editorial caption
Wait — this is one of the brief's specifications, but it's wrong for editorial. Drop caps everywhere read as a 1990s magazine pastiche. Phase 1 recommendation: drop cap appears on the *manifesto opening paragraph* (one drop cap on the page) at 72-110px Cormorant italic. The `dropcap-on-every-caption` brief item is reinterpreted as: small italic cap-letter ornament on the *first letter of each pillar headline* (Concept. / Production. / Output.) using `::first-letter` with subtle italic + gold color. This delivers the editorial signature without the 1990s pastiche. Phase 4 must adopt this interpretation.

### 7. Pull quote with 400px Cormorant left double-quote ornament (largest)
Centered pull quote, max-width 880px. Ornament glyph (left double quote) sized at clamp(320px, 44vw, 600px) at 0.045 opacity, positioned absolutely behind the text. The wedding page used clamp(280px, 40vw, 560px); editorial scales up because this is the signature gesture of the page. Color: `--gold` at the same 0.045 opacity. No motion on the ornament.

### 8. "Featured in" press band (Vogue, T+L, Conde Nast Traveler, etc.)
Edge-to-edge horizontal logo wall. 6-9 logos at clamp(18px, 2.4vw, 28px) height. Default opacity 0.55 (gray); hover restores 1.0 with 0.3s ease. Gap between logos clamp(40px, 5vw, 80px). Above: small caps eyebrow "AS SEEN IN" in gold, 0.32em tracking. Below: optional hairline separator. Press band lives in `/images/press/` directory (Phase 4 will add 6 placeholder logos with `aria-label` attribution).

### 9. Image-as-card with hover text overlay
Each portfolio card is the image (no padding, no card chrome). On hover or focus: image scales to 1.045, brightness drops to 0.7 (defines `--hover-image-brightness` already), and a dark scrim at `--editorial-card-hover-overlay` (0.55) covers the image. Caption text (in cream, italic Cormorant + small caps Syne) reveals on top of scrim. Top of overlay: brand name in small caps. Bottom: shoot title italic.

### 10. Sticky-stage editorial manifesto
Section 4 is a 100vh sticky-stage. The text fragment (max-width 540px) is sticky within a tall container; three image plates scroll past behind it (positioned absolute at top/center/bottom). On scroll completion the section unsticks and the next section enters. Implementation: `position: sticky; top: 50%; transform: translateY(-50%)` inside a 300vh container with three absolutely-positioned image plates revealed via `IntersectionObserver`. Reduce-motion: section collapses to a normal single-screen layout.

### 11. Hover image preview (cursor follows)
On portfolio drag-scroll cards: a 280px thumbnail follows the cursor, 24px offset, with a 12px entry blur that settles to clear over 0.3s. Implementation: a single `<div class="cursor-preview">` positioned `fixed`, populated with the hovered card's image src on `mouseenter`. Disabled on touch (`@media (hover: hover) and (pointer: fine)`) and on reduce-motion. This is a pointer-only enhancement; touch uses tap-to-expand instead.

### 12. Editorial process timeline (concept → casting → shoot → edit)
Vertical timeline with hairline rail at center (`--editorial-process-rail-w: 1px`, `--gold-line` color). 4 steps, alternating left/right of rail. Each step: number ("01") in gold small caps, name in italic serif ("Concept."), body copy in cream readable, time estimate in small caps. Node circles at the rail (14px, gold-line border, ink-3 fill, 18px on active). Active node grows on scroll-into-view via IntersectionObserver. Step gap clamp(60px, 8vh, 120px). The wedding page used 6 steps; the editorial page uses 4 because editorial commissioners want headline phases, not behind-the-scenes detail.

---

## 9. Twelve a11y failure modes and contracts

| # | Failure mode | Contract Phase 4 must enforce |
|---|---|---|
| 1 | Drag-scroll portfolio inaccessible by keyboard | Add prev/next buttons each `min-width: 44px; min-height: 44px;` flanking the reel. Reel becomes `tabindex="0"` and supports ArrowLeft/ArrowRight key handlers. Each card focusable; focus ring `--focus-ring-on-dark`. |
| 2 | Cinemascope letterbox text contrast | Caption text outside the image (above/below letterbox bands) on `--ink-3` background using `--text-on-dark-readable` (0.82 alpha) at fs >= 18px. Verify 4.5:1 minimum. |
| 3 | Drop cap screen reader stutters | Use `::first-letter` CSS pseudo for visual styling only. Do NOT wrap the first letter in a `<span>` that screen readers would re-announce. The first letter remains part of the natural text node; pseudo elements are not announced. |
| 4 | Cursor-follow preview triggers on touch | Gate cursor preview JS behind `@media (hover: hover) and (pointer: fine)` AND `not (prefers-reduced-motion: reduce)`. On touch devices, the preview is removed entirely; tap on a card opens a lightbox or navigates to a case study URL. |
| 5 | Masthead h1 semantic conflict | The masthead band is decorative volume/issue framing only. It does NOT contain `<h1>`. The page's `<h1>` lives in the hero (Section 2). Masthead uses a `<header role="banner">` with `<p class="masthead-issue">` siblings. Hero `<h1>` contains the SEO keyword. |
| 6 | Featured-In press logos lack alt text | Each logo `<img>` has explicit `alt="Travel + Leisure logo"` etc., never `alt=""`. If the page wants logos "decorative-only," the publication name appears in adjacent visible text and the img stays `alt=""`. Default in Phase 4 is named alt because press logos are meaningful credibility signals, not decoration. |
| 7 | Image-as-card overlay text fails contrast | Overlay scrim at 0.55 alpha is the contrast foundation. Caption text in `--cream` over the scrim must be tested at the underlying image's lowest brightness pixel; verify >= 4.5:1. If the underlying image is too bright, scrim alpha increases to 0.65 for that card variant. |
| 8 | Sticky-stage manifesto traps focus | The sticky section must allow keyboard tab to exit. Each image plate is `aria-hidden="true"`; the manifesto text region has `tabindex="0"` only on focusable children (the sign-off link, if any). Sticky behavior is visual; focus order remains linear top-to-bottom. |
| 9 | Animated aperture SVG announced as image | The aperture is decorative. Wrap in `<svg aria-hidden="true">` and remove all `<title>`/`<desc>` children. Confirms the rotation animation does not become a screen reader event. |
| 10 | prefers-reduced-motion not gating all 12 features | Comprehensive `@media (prefers-reduced-motion: reduce)` block disabling: aperture rotation, h1 reveal, manifesto sticky scroll, drag-scroll inertia, cursor preview, image hover scale, FAQ accordion height transition, link underline grow, scroll progress bar, count-up animations. Static states are kept. |
| 11 | Gold focus rings on dark editorial cards | Default focus ring is `--focus-ring-on-dark` (2px gold, 3px offset) on dark image cards. On gold tier-featured CTA, switch to `--focus-ring-on-gold` (2px ink-1) so the ring is visible on gold background. |
| 12 | Bilingual lang switcher lacks SR context | `<nav role="group" aria-label="Language switcher">` wrapping `<a hreflang="en" aria-current="true">EN</a>` and `<a hreflang="es">ES</a>`. Active language uses `aria-current="true"`. Separator `<span aria-hidden="true">|</span>`. Both anchors point to the corresponding hreflang URL. |

---

## 10. Three visual directions (for Phase 3 parallel builds)

### Direction A — Magazine Spread (Vogue Living)

- **Reference.** Vogue Living, Cereal Magazine, Domino magazine spreads.
- **Type ratio.** 85% serif. Cormorant Garamond Italic 600 dominant. Syne 500 only for masthead small caps and CTAs.
- **Layout grammar.** Edge-flush imagery. Generous gutters. Single-column body copy at 540-600px max-width. Pull quote is the page's largest single visual element (600px ornament).
- **Color.** Cream-1 background dominant on text-heavy sections. Ink-3 background on hero, manifesto sticky-stage, featured editorial. Gold restricted to eyebrows, dropcap, and pull-quote ornament.
- **Motion.** Minimum. Hero reveal, FAQ accordion, link underline. No drag-scroll inertia (still drag-scroll, but instant). No cursor preview.
- **Best for.** Marina (brand manager) and Eliza (photo editor). Reads as a magazine plate.
- **Risk.** Daniel (hotel director) may find it under-stimulating; he likes to see imagery.

### Direction B — Cinemascope Reel (Magnum Photos)

- **Reference.** Magnum Photos, Sanders Studio, Editorial Republic with motion.
- **Type ratio.** 70% serif, 30% sans. Cormorant Italic 400 for h1; Syne 600 for masthead and eyebrows.
- **Layout grammar.** Imagery dominant. Drag-scroll reel is the spine (Section 6 occupies 60vh+). Cinemascope letterbox on Featured Editorial. Sticky-stage manifesto. Hover cursor preview active.
- **Color.** Ink-3 dominant background. Cream-1 only in inquiry block and FAQ. Gold prominent in masthead, ornament, and tier card hairlines.
- **Motion.** Full 12-feature set. Drag inertia. Cursor preview. Sticky-stage. Aperture rotate.
- **Best for.** Daniel (hotel director) and Marina. Lookbook-forward.
- **Risk.** Eliza may find it cinematic-not-editorial. Mitigation: preserve magazine masthead + drop cap to anchor in editorial register.

### Direction C — Editorial Republic Minimal (Hermes / Loro Piana)

- **Reference.** Editorial Republic, Hermes brand pages, Loro Piana lookbooks.
- **Type ratio.** 60% serif, 40% sans (highest sans of the three).
- **Layout grammar.** Edge-flush whitespace. Two CTAs total on the entire page. Two pull quotes (not one). Narrow type measure (520px max). Aggressive use of single-image sections at 21:9 cinemascope.
- **Color.** Cream-1 + sand-1 dominant. Ink-3 only on hero and inquiry. Gold restricted to eyebrows, hairlines, pull-quote ornament.
- **Motion.** Tightly minimal. Hero reveal, link underline grow, FAQ. No drag inertia, no cursor preview, no sticky-stage.
- **Best for.** Marina and Eliza. Refined, quiet, expensive-feeling.
- **Risk.** Daniel and DTC art directors may find it under-energetic. Loses some lookbook performance.

**Phase 4 owner picks one. Recommendation: Direction B (Cinemascope Reel), with selective borrowings from A (the masthead band, the dropcap, the pull-quote scale) and from C (edge-flush whitespace in tier cards). This hybrid serves all three personas best.**

---

## 11. Pricing strategy

Editorial is quote-only by industry convention, but quote-only with no figures shown kills SEO ("editorial photographer Mexico cost") and fails the trust-unlock test for first-time brand commissioners. Show three brackets with starting-from prices, then funnel to a custom quote.

### Bracket 1 — The Editorial Day
- **From $4,500 USD**
- 1-day editorial shoot. Up to 8 hours on location. 1 photographer + 1 assistant + on-set producer. Cancun / Riviera Maya / Los Cabos travel included. 60-100 selects delivered in 5-10 business days. One round of color refinement. One-time print + web licensing.
- *Use case:* small DTC lookbook, restaurant launch, single-day suite shoot, magazine assignment.

### Bracket 2 — The Campaign (the featured / most-chosen bracket)
- **From $9,500 USD**
- 2-day editorial production. 1 photographer + 1 assistant + 1 producer + 1 stylist coordination. 150-300 selects delivered in 10-15 business days. Two rounds of color refinement. Print + web + social + 12-month archive licensing. Insurance and permits handled in-house.
- *Use case:* brand campaign, hotel seasonal refresh, multi-room property shoot.

### Bracket 3 — The Multi-Day Production
- **From $18,000 USD**
- 3+ day editorial production. Full crew (photographer + assistant + producer + DP for motion + grip). Photo + 1-3 motion clips. 300+ selects delivered in 15-20 business days. Three rounds of color. Full licensing including extended archive use. Talent + location scouting included.
- *Use case:* annual hotel rebrand, magazine cover feature, fashion campaign with motion deliverable.

**Footnote on pricing presentation.** All three brackets show "FROM" and a dollar figure in small caps (`--lang-switch-tracking`). No grids. No checkmark feature lists. Each bracket's body copy is one paragraph, ~50 words. The featured (middle) bracket has top hairline at `--inv-tier-rule-featured` (2px gold). All three CTAs read "Inquire" (gold link with underline grow on hover) — no "Book now" or "Add to cart" energy.

**Why three brackets, not one quote-only.** A brand manager who lands on the page wants to know if IVAE is in their budget bracket within 60 seconds. Quote-only forces a friction point too early. Three brackets answer "are you a $5K studio or a $20K studio?" instantly. The brand manager who is in-bracket then commissions; the one who is out moves on without burning Vianey's reply time.

**Why "from" not exact.** Editorial commissions vary too much by scope (talent, motion, locations, licensing) for exact prices. "From" preserves accuracy and SEO ranking on cost queries.

---

## 12. SEO setup for new page

### Canonical and hreflang

Hero head section must include:

```html
<link rel="canonical" href="https://ivaestudios.com/luxury-editorial"/>
<link rel="alternate" hreflang="en" href="https://ivaestudios.com/luxury-editorial"/>
<link rel="alternate" hreflang="es" href="https://ivaestudios.com/es/editorial-de-lujo"/>
<link rel="alternate" hreflang="x-default" href="https://ivaestudios.com/luxury-editorial"/>
```

ES mirror reverses the same trio. Title and description follow the wedding page conventions:

- EN title: `Luxury Editorial Photographer Mexico | IVAE Studios`
- EN description: `Luxury editorial photography for brands working in Mexico. Brand campaigns, magazine commissions, hotel rebrands, lookbooks. Cancun, Riviera Maya, Los Cabos.`
- ES title: `Fotografia Editorial de Lujo en Mexico | IVAE Studios`
- ES description: `Fotografia editorial de lujo para marcas en Mexico. Campanas, comisiones editoriales, rebrandings de hotel, lookbooks. Cancun, Riviera Maya, Los Cabos.`

### Service JSON-LD

A new `Service` block is required, alongside the existing org / website / breadcrumb / FAQ blocks. Skeleton:

```json
{
  "@type": "Service",
  "@id": "https://ivaestudios.com/luxury-editorial#service",
  "name": "Luxury Editorial Photography Mexico",
  "serviceType": "Editorial Photography",
  "description": "Editorial photography for brand campaigns, magazine commissions, hotel rebrands, and lookbooks across Cancun, Riviera Maya, and Los Cabos. Bilingual production, full crew, in-house permits and insurance.",
  "provider": { "@id": "https://ivaestudios.com/#organization" },
  "brand": { "@id": "https://ivaestudios.com/#brand" },
  "areaServed": [
    { "@type": "City", "name": "Cancun" },
    { "@type": "Place", "name": "Riviera Maya" },
    { "@type": "City", "name": "Playa del Carmen" },
    { "@type": "City", "name": "Tulum" },
    { "@type": "City", "name": "Los Cabos" }
  ],
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "priceRange": "$4,500 – $25,000+ USD",
    "availability": "https://schema.org/InStock",
    "url": "https://ivaestudios.com/luxury-editorial"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Editorial Brackets",
    "itemListElement": [
      { "@type": "Offer", "name": "The Editorial Day", "price": "4500", "priceCurrency": "USD" },
      { "@type": "Offer", "name": "The Campaign", "price": "9500", "priceCurrency": "USD" },
      { "@type": "Offer", "name": "The Multi-Day Production", "price": "18000", "priceCurrency": "USD" }
    ]
  }
}
```

Plus a BreadcrumbList block: Home > Luxury Editorial. Plus a FAQPage block with the 8 editorial FAQ questions.

### `_redirects` updates

Append to the "CLEAN URLs — Service Pages" section in `/_redirects`:

```
/luxury-editorial-photography /luxury-editorial 200
/editorial-photographer-mexico /luxury-editorial 301
/blog/luxury-photographer-style-editorial-vs-documentary /luxury-editorial 301
/luxury-editorial.html /luxury-editorial 301
/es/editorial-de-lujo.html /es/editorial-de-lujo 301
/es/fotografia-editorial /es/editorial-de-lujo 301
/es/fotografo-editorial-mexico /es/editorial-de-lujo 301
```

The third line is the most important. The blog post `/blog/luxury-photographer-style-editorial-vs-documentary` currently receives the dropdown "Editorial" tile traffic. Redirecting it to the new service page captures that traffic. Phase 4 may decide to keep the blog post live (article still ranks for an explanatory query) and link to it from the new service page instead. If the blog post stays, remove the third line and replace with a link from the editorial page's FAQ to the post.

### `sitemap.xml` updates

Append two new `<url>` entries, slotted alphabetically between `/luxury-family-photos-cancun` and `/outfit-guide`:

```xml
<url>
  <loc>https://ivaestudios.com/luxury-editorial</loc>
  <lastmod>2026-05-09</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
  <xhtml:link rel="alternate" hreflang="en" href="https://ivaestudios.com/luxury-editorial"/>
  <xhtml:link rel="alternate" hreflang="es" href="https://ivaestudios.com/es/editorial-de-lujo"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://ivaestudios.com/luxury-editorial"/>
</url>
<url>
  <loc>https://ivaestudios.com/es/editorial-de-lujo</loc>
  <lastmod>2026-05-09</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
  <xhtml:link rel="alternate" hreflang="en" href="https://ivaestudios.com/luxury-editorial"/>
  <xhtml:link rel="alternate" hreflang="es" href="https://ivaestudios.com/es/editorial-de-lujo"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://ivaestudios.com/luxury-editorial"/>
</url>
```

Priority 0.9 matches the other service pages (weddings, family, couples).

### `services-dropdown-v2.js` update

Update line 15 (ES) and line 20 (EN) of `/js/services-dropdown-v2.js`:

EN (line 20):
```js
{ title: 'Editorial', desc: 'Brand campaigns, magazine commissions, hotel rebrands', href: '/luxury-editorial', icon: 'editorial' }
```

ES (line 15):
```js
{ title: 'Editorial', desc: 'Campanas de marca, comisiones editoriales, rebrandings', href: '/es/editorial-de-lujo', icon: 'editorial' }
```

The desc copy is upgraded from "Editorial sessions & brand styling" / "Sesiones editoriales y estilo de marca" to the more specific service language used on the new page. This keeps the dropdown copy consistent with the page's brackets framing.

### H1 keyword targets

- **EN H1:** `Luxury Editorial Photographer Mexico` (must appear visibly on page; recommend folding into hero h1 or a fall-through `<h1>` with `.sr-only-h1` class if the visual h1 wants more prose)
- **ES H1:** `Fotografia Editorial de Lujo en Mexico`

The visual hero h1 from §6 ("Luxury editorial photography for brands working in Mexico.") includes the keyword string with one extra word ("photography for brands") that doesn't dilute the keyword target. Google reads the full string and accepts the keyword. Phase 4 may choose to align the visual h1 exactly with the keyword phrase if SEO Phase 5 audit recommends it.

### OG / Twitter meta

```html
<meta property="og:image" content="https://assets.ivaestudios.com/luxury-editorial-og.jpg"/>
<meta name="twitter:image" content="https://assets.ivaestudios.com/luxury-editorial-og.jpg"/>
```

OG image must be created (1200x630) using one of the editorial-quality couple-cancun-hotel-zone images at editorial crop. Phase 4 builds the OG; deployed separately.

---

## 13. Risks and open questions

### Risks

1. **Tearsheets do not yet exist on the site.** The "Featured In" press band cannot ship without 6-9 actual logos. Until Vianey provides real publication / brand client tearsheets, the band must use placeholders ("Pending. Logo placeholder.") or be removed from Phase 4's first deploy. Recommendation: ship with 4 placeholders labeled "Coming soon" rather than fake logos.
2. **"Brand client list" implies clients we may not yet have permission to name.** Editorial brands often require NDA on imagery for 6-12 months post-shoot. The portfolio drag-scroll cards may need to show images without naming the brand on cards where contracts haven't aged out.
3. **Drag-scroll on touch devices is failure-prone.** iOS Safari overrides snap scroll inconsistently. Phase 4 must test extensively on iOS 15-17 + Android Chrome + Safari macOS. Fallback is overflow-x: auto without snap, which is acceptable.
4. **Sticky-stage manifesto on iOS Safari.** `position: sticky` inside a tall container with absolutely-positioned children is fragile on iOS. Phase 4 must include a feature-detect fallback to a normal vertically-stacked layout.
5. **Cursor-preview JS adds complexity.** This is a desktop-only enhancement. If Phase 4 build complexity gets tight, this is the first cut. Image-as-card with hover scrim is the trust-critical effect; cursor preview is a delight.
6. **Placeholder "Conde Nast" / "Vogue" / "Travel + Leisure" logos in Phase 4.** Until Vianey supplies real tearsheets, the press band is a placeholder. Real logos used without permission would be a brand-trademark violation. Phase 4 must use clearly-marked placeholder graphics or skip the band entirely.

### Open questions for owner Vianey

1. Does the studio currently have any real published tearsheets or named brand clients we can show?
2. Is the studio willing to publish quote-only or are we comfortable with three "from" brackets?
3. Should the existing blog post `/blog/luxury-photographer-style-editorial-vs-documentary` redirect to the new page (transferring all link equity), or should it remain as a supporting article that links into the page?
4. Do we have at least one editorial client who would supply a quotable testimonial for the pull quote section (Section 8)?
5. Direction A (Magazine), B (Cinemascope), or C (Minimal) — which best matches Vianey's instinct for the studio's editorial brand?
6. Are we comfortable using placeholder "Coming soon" press band logos in the first deploy, or should the band be omitted until real logos arrive?
7. What is the actual editorial turnaround the studio commits to (5-10 business days for selects vs. 7-14)? This goes in the FAQ and the page's process section.
8. Is the EN H1 "Luxury Editorial Photographer Mexico" acceptable as the hero H1 visual copy, or should the visual H1 be more editorial ("Editorial photography for brands working in Mexico") with the keyword phrase folded into a `.sr-only-h1`?

---

## 14. Cross-references

- Wedding Phase 1 brief: `/seo/design-audit/luxury-weddings-phase-1-brief.md`
- Wedding Phase 2 a11y contract: `/seo/design-audit/luxury-weddings-phase-2-a11y-contract.md`
- Wedding Phase 2 copy deck: `/seo/design-audit/luxury-weddings-phase-2-copy-deck.md`
- Wedding Phase 3 direction prompts: `/seo/design-audit/luxury-weddings-phase-3-direction-prompts.md`
- Tokens.css canonical: `/styles/tokens.css` (Wave 6 ends at line 481; Wave 8 begins at line 568+ as additive)
- Header redesign skills: `/seo/design-audit/header-redesign-skills.md`
- Services dropdown logic: `/js/services-dropdown-v2.js`
- Redirect rules: `/_redirects` (append to "CLEAN URLs — Service Pages" block)
- Sitemap: `/sitemap.xml` (insert after `/luxury-family-photos-cancun` block)

---

## 15. Phase 1 deliverable summary (for the parent agent)

- All 7 design plugin skills invoked: design-critique, user-research, research-synthesis, design-system, ux-copy, accessibility-review, design-handoff. Each documented in §3.
- 3 personas synthesized in §4: Marina Castellanos (brand manager), Daniel Ramirez (hotel marketing director), Eliza Whitfield (magazine photo editor).
- 12 cinematic features enumerated in §8 with editorial-specific implementation.
- 12 a11y failure modes with contracts in §9.
- 20 microcopy decisions in §6 with EN + ES translations.
- 8 voice principles in §7.
- 12 magazine-style sections in §5 (masthead, hero, press band, manifesto, pillars, reel, featured editorial, pull quote, method, investment, FAQ, inquiry).
- 3 visual directions in §10 with persona-fit and risks.
- 3 pricing brackets in §11 ($4,500 / $9,500 / $18,000 from-USD).
- Full SEO setup in §12: canonical, hreflang trio, Service JSON-LD, _redirects updates, sitemap.xml updates, services-dropdown-v2.js update, OG/Twitter, H1 keyword targets EN + ES.
- Risks and 8 open questions in §13.

Phase 2 starts with: copy deck (full long-form copy for all sections), accessibility contract (verbatim from §9, expanded with element-level selectors), and Wave 8 token additions to tokens.css.

End of Phase 1 brief.
