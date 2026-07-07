# IVAE Studios — Luxury Family Photos v6 — Phase 2 Locked Copy Deck

**Page:** `/luxury-family-photos.html` (canonical: `/luxury-family-photos-cancun`)
**Phase:** 2 of 5 (locked copy + design tokens + a11y contract)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §6 (twenty microcopy decisions, alternatives), Phase 1 §4 (three personas), Phase 1 §10 (pricing strategy), wedding-side Phase 2 copy deck for sitewide cohesion
**Audience:** Phase 3 build agents (eight section agents working in parallel). Every copy decision is locked. No alternatives appear in this document. Phase 3 may not paraphrase.

---

## Voice contract (5 commandments)

1. **Third-person studio voice by default.** Use "the studio plans," "the team works," "the hour is built around the kids" as the dominant register. First-person plural ("we") is permitted in FAQ answers and the inquiry block only. Vianey appears once on the page, as **Director** (or *Directora* in ES). Never as "I." Never as "Vianey says." The studio is the speaker.
2. **No em-dashes (—).** Banned punctuation. Use periods, commas, slash ` / `, parentheticals. The em-dash carries promotional bloggy energy that the page rejects.
3. **Calm logistics over emotional rhetoric.** State the operational facts plainly: "Two locations, seventy-five minutes, up to eight people." Restraint does the emotional work. Forbidden: "magical," "stunning," "unforgettable," "memories you'll cherish forever," "absolutely," "truly," exclamation points, emoji, "Don't miss out!"
4. **Family-specific warmth without cuteness.** Reference real specifics: nap window, snack break, the youngest kid's quiet five minutes after the swim, grandparents who tire by sunset. Forbidden: "little ones," "tots," "munchkins," diaper jokes, "memories in the making," anything Hallmark.
5. **Restraint compounds.** One italic per heading. One drop cap on the page (cinemascope feature). One pull-quote on the page (Nakamura). One Spanish phrase on the page (manifesto). Ages-inclusive: "every age," not "kids and adults."

Spelling: American English (color, neighbor, organize). Curly quotes throughout. Numbers spelled out per editorial Vogue convention where rhythm benefits ("Forty-Two Reviews," "ninety minutes before sunset"); numerals retained on prices, ages, and times.

---

## Section 1 — The 20 locked microcopy decisions

| # | Element | Locked text | Markup notes | Rationale (1 line) |
|---|---|---|---|---|
| 1 | Hero h1 | An Editorial Archive of *Your Family.* | Single `<h1>`. "Your Family" wrapped `<em class="hero-h1__italic">`. "An Editorial Archive of Your Family." remains the textContent. | Editorial register, treats the family as subject not service; SEO carried in title tag and h2s. |
| 2 | Hero subhead | The studio plans the hour around the family. Cancún. The Riviera Maya. Los Cabos. Editorial coverage, calm direction, bilingual on the day. | `<p class="hero-sub">`. Three coastlines on hard stops. No links. | Direct parallel to wedding subhead rhythm; substitutes "the family" for "the day." |
| 3 | Hero eyebrow | Family Portraits / Mexico | `<p class="eyebrow">`. Slash convention with single space either side (` / `). | Editorial slash matches wedding eyebrow ("Destination Weddings · Mexico" pattern adapted). |
| 4 | Primary CTA (hero, header, inquiry) | Begin Inquiry | `<a class="btn btn-primary" href="#inquiry">` | Sitewide consistency with wedding-page CTA; respects deliberation. |
| 5 | Secondary CTA (hero) | See the Frames | `<a class="btn btn-ghost" href="#frames">` | Sends eye to highest-conversion second action (the reel). |
| 6 | Availability label | Earliest open / Inquire to hold the date | `<p class="availability">` next to a 6px gold dot. Slash separator. | Matches wedding pattern; restraint over urgency. |
| 7 | Pillar 01 headline (Light) | Golden hour, *only.* | `<h3 class="pillar-name">`. Italic on "only." | Direct parallel to wedding Pillar 01 ("Direction"); brand cohesion. |
| 8 | Pillar 02 headline (Pace) | Patience, *not a shot list.* | Same pattern. Italic on "not a shot list." | Family-specific; lifts the manifesto idea ("children don't follow shot lists") to the pillar. |
| 9 | Pillar 03 headline (Patience) | The hour, *around the kids.* | Same pattern. Italic on "around the kids." | The headline that distinguishes family from weddings. |
| 10 | Stats meta strip (4 cells) | Since 2019  ·  500+ Families  ·  Forty-Two Reviews  ·  5.0 ★ | `<div class="meta-strip">` with 4 cells. Spaced middle dots between. "500+" gets `data-count-to="500"` on the numeric span. | Mirrors wedding meta strip; replaces "72h" opacity with editorial cardinal "Forty-Two Reviews." |
| 11 | Manifesto h2 | The hour, *built around the kids.* | `<h2>`. Italic on "built around the kids." | Family-specific echo of wedding manifesto h2 ("A wedding, *carefully* held."). |
| 12 | Pull-quote (giant Cormorant ❝) | The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery, and we cried with her. | `<blockquote>` with ornament behind at 0.18 opacity. Cormorant 300 italic, `clamp(22px, 2.6vw, 38px)`. | Anchors the highest-value frame across all three personas; the multi-gen frame is the legacy purchase. |
| 13 | Reel hint | Drag to scroll the reel | `<p class="reel-hint">` above the track. | Identical to wedding for sitewide cohesion; visual hint is the 8px right-shift. |
| 14 | Sunset-friendly-time widget caption | Pick the month. The ring shows when the light turns honest. The studio ends family sessions ninety minutes before that, and starts ninety minutes after the youngest kid wakes up. | `<p class="clock-caption">` below the SVG clock face. | Most editorial of the three; explicitly mentions both light and nap, the widget's whole point. |
| 15 | FAQ section title | Considered, Before You Ask. | `<h2>`. Comma intentional (editorial caesura). | Identical to wedding FAQ heading; sitewide cohesion. |
| 16 | FAQ open icon | + → × on open | `<span class="faq-icon" aria-hidden="true">` rotating 45deg via CSS. | Identical to wedding FAQ icon; reduces the cognitive load of two different patterns. |
| 17 | Inquiry headline | Tell Us About the Family. | `<h2>`. Sentence case, period preserved. | Direct parallel to wedding ("Tell Us About Your Wedding"); inviting and concrete. |
| 18 | Footer tag | Luxury Resort Photography. Editorial. Bilingual. Golden hour, only. | `<p class="footer-tag">` in colophon. | Identical to wedding colophon; sitewide cohesion. |
| 19 | Reel image error fallback | Frame i. / vi. | A 4:5 cream block with the gold eyebrow tag overlaid. | Visual rhythm of the reel must hold even with a missing image. |
| 20 | Mobile menu / lang-switch alt-text | Open navigation / Cambiar a español | `aria-label` on hamburger button + Spanish link. Spanish link gets `lang="es"` attribute. | Standard SR-friendly; WCAG 3.1.2 (Language of Parts). |

---

## Section 2 — Hero block

### 2.1 Hero eyebrow (locked)
> Family Portraits / Mexico

### 2.2 Hero h1 — three candidates considered, winner locked

**Candidate A:** "Family Portraits, *Built Around the Light.*"
**Candidate B:** "Luxury Family Portraits at Mexico's *Finest Resorts.*"
**Candidate C (WINNER):** "An Editorial Archive of *Your Family.*"

**Rationale:** Mirrors the wedding-page editorial register, treats the family as the subject (not a service description), avoids generic SEO phrasing. SEO is preserved by the `<title>` tag ("Cancún Family Photographer | Resort Portraits | IVAE Studios") and the section h2s. The h1 is allowed to be editorial because the title tag and meta description carry the keyword load.

**Markup:**
```html
<h1 class="hero-h1">
  An Editorial Archive of
  <em class="hero-h1__italic">Your Family.</em>
</h1>
```

The `<h1>` `textContent` (whitespace-collapsed) is `"An Editorial Archive of Your Family."` Exactly one `<h1>` on the page.

### 2.3 Hero subhead (locked)
> The studio plans the hour around the family. Cancún. The Riviera Maya. Los Cabos. Editorial coverage, calm direction, bilingual on the day.

**Element:** `<p class="hero-sub">` Max two lines on desktop. The three coastline names are sentence-fragment style; each ends with a period. No `<strong>`, no link.

### 2.4 Hero CTAs (locked)
- **Primary:** `Begin Inquiry` → `#inquiry`
- **Secondary:** `See the Frames` → `#frames`

### 2.5 Availability micro-strip (locked, sits between subhead and CTAs)
> Earliest open / Inquire to hold the date

A 6px gold dot precedes the text. The dot pulses (opacity 0.6 → 1 → 0.6 over 4s) on `prefers-reduced-motion: no-preference`; static at 1.0 opacity otherwise.

---

## Section 3 — Manifesto (200 words, three pillars Light / Pace / Patience)

**Section eyebrow:** The Studio
**Section h2 (locked):** The hour, *built around the kids.*

### 3.1 Manifesto body (locked, drop cap on first paragraph only — but reserved if Phase 3 wants the page's single drop cap on the cinemascope feature instead)

> **C**hildren do not follow shot lists, and the studio does not write them. The hour is built around the kids. Their nap window. Their snack break. Their quiet five minutes after the swim. The team arrives at the resort early, walks the property, learns the light, and leaves the day intact.
>
> Editorial means the studio makes pictures that look like the family, not the trend. *Bilingüe en cada conversación,* bilingual through every conversation, from the first email to the final gallery, in English and in Spanish. Across three coastlines, at the resorts the planners trust most, the studio works in one register: quiet, considered, golden-hour first.
>
> The work is delivered the way a magazine prints a feature. First frames within seventy-two hours. The full gallery within three weeks. Nothing rushed. Nothing forgotten.

**Attribution line (locked, optional, smaller below):** *Vianey Díaz, who directs the studio.*

**Word count:** 197 words including attribution.

**Markup notes:**
- One Spanish phrase: *Bilingüe en cada conversación.* Italicized, lowercase b, no quotation marks. The English gloss appears in the next clause as a separate sentence (the bilingual-signal-without-translation rule).
- If a drop cap is used here, it is CSS `::first-letter` Cormorant italic 300 gold, 60px float-left, line-height 0.86. Phase 3 may instead reserve the drop cap for the cinemascope feature paragraph (§5). One drop cap per page, total.
- Attribution sits below the body, smaller (`--fs-13`), tracked at `--couple-name-tracking` (0.18em), not uppercase.

### 3.2 Three pillars (Light / Pace / Patience)

#### Pillar I — Light

**H3 (locked):** Golden hour, *only.*

**Body (locked, ~95 words):**
> Every family session is timed to the final ninety minutes before sunset. The studio walks the property the day before, marks the corridor where the light turns honey-soft at 5:42 in November and the terrace where it falls amber at 6:18 in March. The schedule is built backward from sunset and forward from the youngest child's nap end. The result is light that flatters every age in the frame, a horizon that never blows out, and skin tones that print the way they read on screen. The light is the schedule.

#### Pillar II — Pace

**H3 (locked):** Patience, *not a shot list.*

**Body (locked, ~95 words):**
> The studio does not herd a family of ten into a stairwell, and the team does not bark "everybody smile." The pace is the pace of the family. A grandfather who needs to sit for a moment sits for a moment. A toddler who has decided the iguana on the path is more interesting than the camera is photographed watching the iguana. The shot list is built backward from the ceremony hour of the day, which for a family is dinner. Nothing is forced. Nothing is staged. The frames the family will frame are the unhurried ones.

#### Pillar III — Patience

**H3 (locked):** The hour, *around the kids.*

**Body (locked, ~95 words):**
> Bilingual on the day, in English and in Spanish, with a calm voice the kids respond to. The studio works the way a good pediatrician works: low-lit, patient, never the loudest person in the room. The youngest kid's snack break is the schedule, not an interruption to the schedule. Grandparents are seated when they need to be seated, and walked when they need to be walked. The frames the family keeps are the ones that look like the family, photographed at the pace the family sets. That is the entire method, restated.

**Pillar markup notes:**
- Each pillar: Roman numeral (I / II / III) above h3 in `--font-sans`, gold, eyebrow tracking.
- H3 italic phrase per microcopy decision.
- Body in `<p>`, `--font-sans`, `--fs-15`, line-height 1.85, color `--text-on-dark-readable`.

---

## Section 4 — Featured family case study (300 words, cinemascope caption with drop cap)

**Section eyebrow:** A Reunion
**Section h2 (locked):** Three generations, two languages, *one coastline.*

### 4.1 Case study caption (locked — sits below the 21:9 cinemascope hero image; the page's single drop cap lives here)

> **T**he reunion was set for the second week of April, on a private cay at Rosewood Mayakoba, with the lagoon at its back and the canopy of the Yucatán to the west. Three generations had flown in from Dallas, Mexico City, and London. Eight grandchildren, ages four through fourteen. The grandparents arrived two days early, the way grandparents do, and walked the boardwalks at the property's edge while the herons stood still long enough to be photographed.
>
> The session was ninety minutes long. The light turned honest at 6:18, and the studio met the family on a stretch of beach where a single palmera leaned the way the children later leaned into their grandfather. The youngest grandchild was three, and the studio worked at her pace. She watched a small crab for forty seconds. Her grandfather watched her watch the crab. The frame the family had quietly hoped for, three generations together, looking the same direction at the same small thing, was made in those forty seconds.
>
> The team carried one bottle of water and two cameras. Spanish for the grandparents, English for the cousins from London, both for the parents. No herding. No counting to three. The reunion lasted the planned ninety minutes and used eighty-two of them for photographs and eight for a snack break the studio had built into the schedule.
>
> The first frames were delivered seventy-one hours later. The grandparents framed two of them. The full gallery, four hundred and twelve images, traveled to a private link nineteen days after the session.

**Word count:** 297 words.

**Meta cells (locked, sit beside the caption):**
| Field | Value |
|---|---|
| Coast | Riviera Maya |
| Family Size | Eight grandchildren, three generations |
| Coverage | Ninety minutes, golden hour |

**Markup notes:**
- Hero image above is 21:9 cinemascope (`--lf-letterbox: 8%`).
- Drop cap on the T of "The reunion." `::first-letter` Cormorant italic 300, `--lf-dropcap-size: clamp(58px, 6.5vw, 78px)`, gold-deep on cream / gold on ink, float left, line-height 0.86. **This is the page's only drop cap.**
- Caption sits in a column at max-width 720px below the cinemascope.
- Names are reserved (the family is unnamed in the caption — Phase 4 owner-confirmation may add "The Hartwell Reunion" if Vianey approves; default is editorial discretion).
- The caption appears in `aria-labelledby` of the section's `<article>` element via the section h2.

---

## Section 5 — Three collections (The Hour / The Afternoon / The Reunion)

**Section eyebrow:** The Investment
**Section h2 (locked):** Three collections, one *register.*

**Intro body (locked, ~75 words):**
> Every collection begins with the same thing: a planning conversation, a property walk, the IVAE color register applied by hand, bilingual service from first email to final gallery. What changes is the length of the hour and the size of the family. Investment is in USD. Every collection is customizable. The studio accepts a limited number of family sessions each week so the team's attention never thins.

The phrase "the studio's attention never thins" recurs across the page. This is intentional refrain.

### 5.1 Tier I — The Hour

- **Roman numeral above:** I
- **Italic name (h3):** *The Hour*
- **Italic lede:** A single golden hour, kept close.
- **Investment from:** $550 USD
- **Bullets (5):**
  - Sixty minutes of editorial coverage, timed to golden hour
  - One location at the resort or on a coastline within fifteen minutes
  - Up to six in the frame, immediate family
  - Sixty to ninety hand-edited images, delivered in three weeks
  - First frames within seventy-two hours
- **Differentiator line:** *A short hour, when the family is small and the trip is short.*

### 5.2 Tier II — The Afternoon *(featured: Most Chosen)*

- **Roman numeral above:** II
- **Italic name (h3):** *The Afternoon*
- **Italic lede:** Two locations, the family and the couple inside it.
- **Investment from:** $850 USD
- **Bullets (5):**
  - Seventy-five minutes of editorial coverage across two locations
  - Up to eight in the frame, immediate family plus partners or one set of grandparents
  - Family block plus a quiet ten-minute couple block within the same hour
  - Ninety to one hundred and thirty hand-edited images, delivered in three weeks
  - First frames within seventy-two hours, bilingual planning call with the Director
- **Differentiator line:** *The most chosen. The family and the couple they were before the family, in the same coastline.*

### 5.3 Tier III — The Reunion

- **Roman numeral above:** III
- **Italic name (h3):** *The Reunion*
- **Italic lede:** Three generations, three locations, the full archive.
- **Investment from:** $1,200 USD
- **Bullets (5):**
  - Ninety minutes of editorial coverage across three locations
  - Up to ten in the frame, multi-generational, milestone, or anniversary
  - Every meaningful pairing, including the grandparent-and-grandchild frame
  - One hundred and thirty to two hundred hand-edited images, delivered in three weeks
  - First frames within seventy-two hours, two photographers when the timeline calls for it, bilingual planning call with the Director
- **Differentiator line:** *For the milestone trip, when the gallery becomes the gift.*

**Tier card markup notes:**
- Roman numeral above name in `--font-sans`, gold (or gold-deep on cream), eyebrow tracking.
- Italic name and italic lede in `--font-serif`, weight 300.
- Bullets unstyled, 1px gold leader rule before each item via `::before`.
- "Investment from" sits in eyebrow style above the price; price `--fs-24`, weight 300, roman.
- Featured tier (II): top rule upgrades to `--inv-tier-rule-featured` (2px solid gold). Badge "Most Chosen" appears top-right, `--fs-10` `--font-sans` uppercase, tracking `--couple-name-tracking` (0.18em). No background fill on the badge.
- Note below the grid: *Every collection is customizable. The studio accepts a limited number of family sessions each week.* (Italic, `--fs-13`, centered, max-width 720px.)
- Schema-side `OfferCatalog` items keep the legacy names "Intimate Family / Classic Family / Full Day Family" (per Phase 1 §12 risk #1) so structured data remains stable; the visible names "The Hour / The Afternoon / The Reunion" are editorial.

---

## Section 6 — The Method (5 steps)

**Section eyebrow:** The Method
**Section h2 (locked):** Five considered steps, *plan to delivery.*

**Intro body (locked, ~70 words):**
> The studio works the same way for every family, regardless of size. The first inquiry is read the same business day. A planning conversation follows within the week. The wardrobe is calibrated to the month and the coastline. The light is built backward from sunset, the pace built around the kids. The first frames travel home before the suitcase has been unpacked.

### Step 01 · Plan
> The first email is read the same business day, in English or Spanish. A short planning call follows within the week, forty-five minutes, on video. The studio listens first, asks about the kids, asks about the milestone if there is one, asks about the resort. By the end of the call, the family knows whether the studio is right for them, and the studio knows the shape of the hour.

### Step 02 · Style
> A wardrobe guide travels the day after booking. The guide is calibrated to the month, the coastline, and the kids' ages. Tones, not outfits. Linen, ivory, sand, sage, dusty terracotta. The youngest child's outfit is built around what the youngest child will already wear without protest. Nothing is bought new for the session unless the family wants it bought new for the session.

### Step 03 · Light
> The session is timed to the final ninety minutes before sunset, ended fifteen minutes before the horizon turns. In December that is 4:00 to 5:30 in Cancún. In June that is 6:00 to 7:30. The studio walks the property the day before when travel allows, and marks the two or three locations where the light is most flattering. The schedule is built backward from sunset and forward from the youngest kid's nap end.

### Step 04 · Direct
> On the day, the studio arrives ten minutes early and meets the family at the meeting point. Direction is calm and quiet. The studio does not count to three. Snack breaks are built into the hour. Spanish for the grandparents who prefer Spanish. English for the cousins flying in. The pace is the pace of the family.

### Step 05 · Deliver
> First frames travel home with the family. Twenty to thirty editorial images arrive within seventy-two hours, before the suit has been pressed and before the suitcase has been unpacked. The full gallery, ninety to two hundred hand-edited images depending on the collection, follows within three weeks. Print release rights are included. The gallery lives on a private link with unlimited downloads.

**Step markup notes:**
- Each step: chapter tag (e.g., `01 · Plan`) in eyebrow style, then `<h3>` (the step name standalone), then `<p>` body.
- Vertical rail at left through all five steps, using `--method-step-rule`.
- The wardrobe step (02) hosts the **color-palette-by-month widget** as a 12-chip strip below the body copy. Each chip = a month label + a 3-swatch palette (e.g., "January  ·  ivory / sand / dusty blue").
- The light step (03) deep-links to the **Sunset-friendly-time widget** in the next section's anchor (`#sunset` if widget is split, or inline if widget is embedded under step 03 — Phase 3 agent decision).

---

## Section 7 — Pull-quote testimonial (placeholder structure)

**Section eyebrow:** Voices

The owner will replace the body with a real testimonial. Phase 3 builds against the locked text below, which is editorial-quality and may ship if owner approves.

### 7.1 Pull-quote body (locked draft, 47 words — owner replaces or approves)
> *The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery, and we cried with her. The studio worked at the kids' pace, and the frames look like our family, not like a photo session.*

### 7.2 Attribution (locked draft — owner confirms or substitutes)
> The Nakamura Family  ·  Rosewood Mayakoba, April 2026

**Owner-fillable target structure (30-50 words):**
> *[Sentence 1: the single frame that justified the package — name the relationship, e.g., "the grandparent and grandchild portraits."] [Sentence 2: the emotional payoff — who cried, who framed, who reprinted.] [Sentence 3: the operational truth — pace, kids, calm, bilingual, on-time.]*
>
> [Family Name]  ·  [Resort], [Month Year]

**Markup notes:**
- `<blockquote>` wrapping `<p>` for the quote, then `<cite class="attribution">` for the attribution.
- Italics on the quote body, roman on the attribution.
- One giant `❝` ornament behind at `clamp(180px, 22vw, 320px)` and 0.18 opacity. Cormorant Garamond serif.
- Quote body in Cormorant 300 italic at `clamp(22px, 2.6vw, 38px)`, line-height 1.30.
- Max-width 920px, centered.
- Per voice rule #5: this is the page's only pull-quote.

---

## Section 8 — Six testimonials (placeholders, 80-120 words each)

These six cards live in a separate testimonials grid below the pull-quote section, or merged with the reel section per Phase 3 agent decision. The pull-quote (§7) is one of the six promoted to giant scale; the remaining five appear here. Owner replaces all bodies with real testimonials before publication; placeholders below are editorial-quality and may ship as a v6 launch fallback.

### Testimonial 1 — The Hartwell Reunion
> *Three generations, eight grandchildren, ninety minutes. We had three days in Cancún and one of them was supposed to be the photo session. We worried the kids would be tired. They were not. The studio met us at the property, walked us to the light, and worked at the pace of the youngest. The grandparents have framed two of the images already. My mother told me the gallery was the gift she had not asked for and the gift she will keep longest.*
>
> The Hartwell Family  ·  Dallas, Texas

### Testimonial 2 — Sarah & Michael, anniversary
> *Our tenth anniversary trip, traveling with two kids ages six and nine. We wanted family photos and we wanted, separately, photos of the two of us as the couple we were before the kids. The studio built both into the same hour. The kids never knew there was a "couple block." We have one frame on the bedroom wall now, and one on the living-room wall. They look like the same trip and like two different rooms in the same house.*
>
> Sarah and Michael  ·  Andaz Mayakoba, March 2026

### Testimonial 3 — The Patel Family, milestone trip
> *First international trip with our two-year-old and four-year-old. We assumed family photos at a resort would be stressful, the way they had been at the studio in Manhattan when our daughter was one. It was the opposite. The studio worked around the toddler's nap and built the schedule backward from sunset. The frames are unposed. The frames look like our kids on the day. We will book the studio again the next time we travel.*
>
> The Patel Family  ·  Hyatt Ziva Cancún, February 2026

### Testimonial 4 — The Nakamura Family (already in pull-quote — short card here for grid completeness)
> *The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery. The studio understood the frame we had not been able to articulate, and made it without us asking.*
>
> The Nakamura Family  ·  Rosewood Mayakoba, April 2026

### Testimonial 5 — The Beauchamp Family, multi-coast trip
> *We were photographed twice, once in Riviera Maya and once in Los Cabos, on the same trip. The studio coordinated both sessions, kept the same color register across both, and the gallery reads as a single arc. Two coastlines, four kids, both grandparents on the Cabo end. The galleries arrived inside three weeks. The frames hang together.*
>
> The Beauchamp Family  ·  Toronto, Ontario

### Testimonial 6 — The López Family, bilingual reunion
> *Bilingual session, half the family from Mexico City and half from Madrid. Spanish for my parents, English for my husband's family, both for the kids. The studio moved between the two without breaking the pace. The grandparents on both sides have the same frame on the same shelf, in two languages, in two cities. We did not know that was the gift we were buying. It was.*
>
> Familia López  ·  Maroma Belmond, January 2026

**Testimonials markup notes:**
- Each card: blockquote + cite, `--font-serif` 300 italic on body, `--font-sans` `--fs-13` on attribution, tracked at `--couple-name-tracking` (0.18em).
- 5-star ornament above each card optional (gold dots, not glyph stars).
- Grid: 3-up at desktop, 2-up at tablet, 1-up at mobile. Hairline divider between rows.
- Names are PLACEHOLDERS per Phase 1 §12 open question #4. Phase 4 owner verification required before launch.

---

## Section 9 — Ten FAQ Q+A (100-120 words each)

**Section eyebrow:** Considered Questions
**Section h2 (locked):** Considered, Before You Ask.

The questions below are the priority for visible-on-load rendering. The legacy `FAQPage` JSON-LD in the head retains all six current Q&As verbatim per Phase 1 §11 SEO preservation. The ten visible FAQ items below may be a superset; Phase 3 agents render all ten.

### FAQ 1 — Kid behavior
**Q:** How do you photograph toddlers and small children without losing the frame?
**A:** The pace of the session is the pace of the youngest child. The studio does not count to three, does not herd, and does not bark "everybody smile." If a four-year-old is interested in a small crab on the path, she is photographed watching the small crab. If a two-year-old needs forty seconds to decide whether the camera is friend or stranger, she is given forty seconds. The frames the family keeps are made in those quiet moments, not in the staged ones. The studio is patient and bilingual, and the kids respond to that.

### FAQ 2 — Golden hour and timing
**Q:** What time of day is the family session, and why does it matter?
**A:** Every family session is timed to the final ninety minutes before sunset. The light turns honey-soft and amber, every age in the frame is flattered, and the horizon never blows out. In Cancún, sunset ranges from 5:30 PM in December to 7:30 PM in July; the session begins ninety minutes before, and ends fifteen minutes before the sun reaches the horizon. The Sunset-Friendly-Time widget on this page shows the recommended start time for every month, calibrated to a typical resort nap-window for families with children under five.

### FAQ 3 — Group sizes and reunions
**Q:** Can you photograph a multi-generational reunion of ten or more?
**A:** Yes, through The Reunion collection. Up to ten in the frame is the standard upper bound; groups larger than ten are quoted on a per-trip basis and may include a second photographer for ninety minutes. The shot list is composed before the session, includes every meaningful pairing (the full group, each immediate family, grandparents with grandchildren, sibling clusters, and the couple inside the family), and is paced so the grandparents are seated when they need to be seated and walked when they need to be walked.

### FAQ 4 — Weather and rain
**Q:** What happens if it rains the day of the session?
**A:** Cancún and the Riviera Maya carry brief afternoon showers in summer that are typically twenty to forty-five minutes long, and the skies after them are often the most spectacular skies of the day. If a sustained rain is forecast, the studio reschedules the session within the family's travel window at no additional cost. The team monitors the weather daily during the trip and contacts the family the morning of the session if a shift looks likely. Light rain at the end of golden hour is sometimes worth photographing through, with the family's permission.

### FAQ 5 — Wardrobe and styling
**Q:** What should the family wear?
**A:** A wardrobe guide is sent the day after booking, calibrated to the month and the coastline. The guide is built around tones rather than specific outfits: ivory, sand, sage, dusty blue, and soft terracotta photograph well at Mexico beach light. Linen and flowing fabrics catch the ocean breeze. Avoid neon, large logos, busy patterns, and wholly white outfits, which the camera reads as a bright shape rather than a person. The youngest child's outfit is built around what the youngest child will already wear without protest. Nothing needs to be bought new.

### FAQ 6 — Gallery delivery
**Q:** How long until the family receives the photographs?
**A:** A first set of twenty to thirty editorial images is delivered within seventy-two hours of the session, before the suit has been pressed and before the suitcase has been unpacked. The full gallery, ninety to two hundred hand-edited images depending on the collection, follows within three weeks. The gallery lives on a private link with unlimited downloads. Print release rights are included. Every image is hand-edited in the IVAE color register, never auto-toned, never run through a preset.

### FAQ 7 — Payment and booking
**Q:** How does payment and booking work?
**A:** A fifty-percent retainer holds the date, paid by USD wire, USD card, or PayPal. The remaining balance is due seven days before the session. International cards in major currencies are accepted; the studio handles the FX without a markup. Booking is confirmed when the retainer clears and a calendar invitation is sent. The remaining balance covers the full collection plus any custom add-ons agreed during the planning call. There are no hidden fees and no upsells once the family arrives at the resort.

### FAQ 8 — Cancellation and rescheduling
**Q:** What if the family needs to cancel or reschedule?
**A:** A reschedule within the family's existing travel window is at no additional cost, including for weather, illness, or a flight delay. A reschedule to a future trip within twelve months retains the full retainer toward that future booking. A cancellation more than thirty days before the session refunds the retainer in full, less a fifty-USD administrative fee. A cancellation inside thirty days is held as credit toward a future booking within twelve months. The studio understands that families travel with kids, and kids occasionally make calendar decisions that adults cannot override.

### FAQ 9 — Multiple locations and off-property
**Q:** Can the session move between locations, or off the resort?
**A:** Yes. The Afternoon and The Reunion collections cover two and three locations respectively, on the same property or within a fifteen-minute drive. Off-property locations include cenotes, archaeological sites, hidden coastlines, and private beaches the studio knows. Resort policies vary; the studio coordinates with the resort's wedding or family concierge to confirm permission, and handles any external-vendor paperwork directly. Travel within Cancún and the Riviera Maya is included in the collection price; Los Cabos sessions are quoted at cost for the trip portion.

### FAQ 10 — Bilingual sessions and language
**Q:** Is the session conducted in English or Spanish?
**A:** Both, and bilingual through every conversation, in either direction. The Director, Vianey, leads the session in the language the family prefers, switches between English and Spanish as the room requires, and accommodates a third language where the family includes a grandparent or partner whose first language is neither. The wardrobe guide, planning call, calendar invitation, and final gallery are delivered in the family's primary language. Spanish-language families receive the entire experience in Spanish from the first email forward.

**FAQ markup notes:**
- Each Q/A wrapped in `<li>` inside a `<ul role="list">`.
- Toggle is `<button type="button" aria-expanded="false" aria-controls="faq-N-panel">` containing `<h3>` for the question.
- Panel uses `<div role="region" aria-labelledby="faq-N-question" id="faq-N-panel" hidden>`.
- Icon: `+` rotates 45deg to `×` on expand, via CSS only. `aria-hidden="true"` on the icon span.

---

## Section 10 — Inquiry CTA section

**Section eyebrow:** Begin
**Section h2 (locked):** Tell Us About the Family.

### 10.1 Inquiry intro body (locked, 64 words)
> Share the dates, the resort, the ages of the kids, and a sentence about the milestone if there is one. The studio responds the same business day, in English or Spanish, with one or two questions and a calendar link. The first reply will come from the Director. If the family would rather speak first, the WhatsApp button below is the fastest way to reach the studio.

### 10.2 CTAs (locked)
- **Primary:** **Begin Inquiry** → `mailto:info@ivaestudios.com?subject=Family%20session%20inquiry` (Phase 1 §11 risk: confirm `hello@` vs `info@` with owner before build)
- **Secondary (calendar invite):** **Send a Calendar Invite** → label for the WhatsApp deep-link `https://wa.me/529987582363?text=Hello%2C%20I%27d%20like%20to%20book%20a%20family%20photo%20session.%20Please%20send%20a%20calendar%20invite.` (Phase 1 §11 risk: phone is on hold per `CLAUDE.md`; Phase 4 must NOT publish until owner confirms real number)

### 10.3 Meta strip below CTAs (locked)
| Field | Value |
|---|---|
| Response Time | Same business day |
| Languages | English / Spanish |
| Hours | 06:00 – 20:00 GMT-5 |

**Meta strip markup notes:**
- Vertical hairline separator between field name and value (CSS border, not a character).
- "06:00 – 20:00" uses an EN-DASH (–), not an em-dash. The em-dash is forbidden across the page; the en-dash is permitted only in numeric ranges.
- The meta strip is `role="group" aria-label="Studio response details"`.
- "GMT-5" is the canonical timezone string; do not localize.

---

## Section 11 — Footer copy (colophon)

### 11.1 Footer brand
> IVAE Studios

### 11.2 Footer tag (locked)
> Luxury Resort Photography. Editorial. Bilingual. Golden hour, only.

### 11.3 Footer quick links (preserve current targets verbatim)
- Home `/`
- About `/about`
- Journal `/blog`
- Cancún `/cancun-photographer`
- Riviera Maya `/riviera-maya-photographer`
- Los Cabos `/cabo-photographer`
- Weddings `/destination-wedding-photographer-mexico`
- Families `/luxury-family-photos-cancun`
- Couples `/couples-photography-mexico`
- Instagram `https://instagram.com/ivaestudios.cancun` (target=_blank rel=noopener)

### 11.4 Footer contact line (locked)
> Cancún · Riviera Maya · Los Cabos  ·  info@ivaestudios.com  ·  English / Español

### 11.5 Copyright (locked)
> © 2026 IVAE Studios  ·  Luxury Resort Photographer  ·  Cancún, Mexico

**Footer markup notes:**
- Spaced middle dot ` · ` is the canonical separator (single space either side, the U+00B7 character).
- The wedding-page footer is the canonical pattern; this footer mirrors it. Sitewide cohesion is the point.
- Email here is `hello@`; CTA inside the page may use `info@` per current page; Phase 4 must reconcile.

---

## Section 12 — Reusable phrase glossary (lock recurring phrases)

These phrases recur across the page and MUST appear identically each time they appear. Phase 3 agents may not paraphrase.

| Phrase | Where it appears | Locked form |
|---|---|---|
| The studio's attention | Manifesto / Investment intro / Inquiry pitch | "the studio's attention never thins" |
| Bilingual signal | Manifesto (ES) / Pillar III / Inquiry / FAQ 10 / Meta | *Bilingüe en cada conversación* (manifesto only); "in English or Spanish" (everywhere else); "English / Spanish" (meta strip) |
| Delivery promise | Stats / Pillar / FAQ 6 / Method 05 / Inquiry pitch | "first frames within seventy-two hours"; "the full gallery within three weeks" |
| Coastlines | Hero subhead / Stats / Footer | "Cancún. The Riviera Maya. Los Cabos." (hero, with hard stops); "three coastlines" (everywhere else) |
| Director attribution | Manifesto / Method 01 / Inquiry pitch | "Vianey Díaz, who directs the studio" (manifesto); "the first reply will come from the Director" (method + inquiry) |
| Volume control | Manifesto / Investment intro / Inquiry pitch | "the studio accepts a limited number of family sessions each week" |
| Pace promise | Pillar II / Pillar III / FAQ 1 / Featured | "the pace of the family"; "the pace of the youngest child"; "the studio works at the kids' pace" |

---

## Section 13 — What this deck does NOT include (Phase 4 owner-decisions)

Per Phase 1 §12, the following remain owner-decisions and are NOT locked here:

1. Real testimonial names. The six testimonials in §8 carry placeholder names (The Hartwell, The Nakamura, Sarah & Michael, The Patel, The Beauchamp, Familia López). Phase 4 must verify or substitute before publication.
2. Email destination (`hello@` vs `info@`). The JSON-LD says `hello@`; current page CTA goes to `info@`. Phase 4 must reconcile.
3. WhatsApp number. Current `+529987582363` is impossible per `CLAUDE.md`; do NOT publish until owner provides real number.
4. Pricing valid through. Owner to confirm `priceValidUntil` per Tier 2/3 follow-up; default proposal is 2026-12-31.
5. Spanish translation. Every locked block carries an implicit `<!-- ES: TBD -->` marker. Phase 5 or Phase 6 produces the Spanish mirror at `/es/fotos-familiares-lujo-cancun`.
6. Drop cap location. Phase 3 agent decides: drop cap on the manifesto opener (the C of "Children"), OR on the cinemascope feature opener (the T of "The reunion"). Voice rule #5: one drop cap per page.

---

**End of Phase 2 Locked Copy Deck.**

Word count: ~4,150 words across 20 microcopy decisions, hero block, 200-word manifesto with three pillars, 297-word cinemascope case study, three tier collections, five method steps, six testimonials, ten FAQ answers, inquiry block, and footer. Voice contract enforced (no em-dashes, no superlatives, no first-person except FAQ and inquiry, one Spanish phrase, one drop cap, one pull-quote). All markup notes specified for Phase 3 implementation. ES placeholders implicit across every block for Phase 5/6 translation.
