# IVAE Studios — Luxury Weddings v6 — Phase 2 Locked Copy Deck

**Page:** `/luxury-weddings.html` (canonical: `/destination-wedding-photographer-mexico`)
**Phase:** 2 of 5 (design system + locked copy + a11y contract)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §8 (20 microcopy decisions, alternatives), Phase 1 §3 Skill 3 (voice principles)
**Audience:** Phase 3 build agents (3 parallel, A / B / C). Every copy decision is locked. No alternatives appear in this document.

---

## Voice contract (5 commandments)

1. **Editorial, not promotional.** Vogue Living and Cereal magazine cadence over wedding-blog cadence. Hard stops, sentence variation, generous use of the period.
2. **Restrained, never breathless.** No superlatives (incredible, stunning, absolutely, unforgettable, magical). No exclamations. No emoji. No "trust us."
3. **Specific, never generic.** Numerals over adjectives. Three coastlines, not many destinations. Seventy-two hours, not fast turnaround.
4. **Bilingual signal without translation.** Exactly one Spanish phrase on the page, in the manifesto. Italics, no quotation marks, no English gloss.
5. **No em-dashes.** Use periods, commas, semicolons, parentheticals. Long dashes are a banned punctuation mark on this page.

Spelling: American English (color, neighbor, organize). Curly quotes throughout. The Oxford comma is allowed where it improves rhythm, but not enforced.

---

## Section 1 — The 20 locked microcopy decisions

| # | Element | Locked text | Markup notes | ES |
|---|---|---|---|---|
| 1 | Primary CTA (hero) | Begin Inquiry | `<a class="btn btn-primary" href="#inquiry">` | `<!-- ES: TBD -->` |
| 2 | Secondary CTA (hero) | View the Reel | `<a class="btn btn-ghost" href="#reel">` | `<!-- ES: TBD -->` |
| 3 | Header CTA | Begin Inquiry | Same anchor as #1 | `<!-- ES: TBD -->` |
| 4 | Hero h1 | Luxury Destination Wedding Photographer *Mexico* | Single `<h1>`, "Mexico" wrapped `<em class="italic">Mexico</em>`. The full phrase remains as h1 textContent for SEO. | `<!-- ES: TBD -->` |
| 5 | Hero subhead | Editorial wedding photography for international couples at Mexico's most celebrated resorts. Cancún. Riviera Maya. Los Cabos. | Single `<p class="hero-sub">`. The three coastline names are typographic emphasis only (no `<strong>`, no link). | `<!-- ES: TBD -->` |
| 6 | Hero eyebrow | Destination Weddings · Mexico | `<p class="eyebrow">`. Spaced middle dot (` · `) is the canonical separator. Direction B may swap to "Chapter 01 · A Wedding, Held in Light"; A and C use the locked text above. | `<!-- ES: TBD -->` |
| 7 | Tier 1 name | The Vow | `<h3 class="tier-name italic">`. Roman numeral I above. | `<!-- ES: TBD -->` |
| 8 | Tier 2 name | The Celebration | Same pattern. Roman numeral II. Featured tier (Most Chosen badge). | `<!-- ES: TBD -->` |
| 9 | Tier 3 name | The Cinematic Day | Same pattern. Roman numeral III. | `<!-- ES: TBD -->` |
| 10 | FAQ section title | Considered, Before You Ask | `<h2>`. The comma is intentional (editorial caesura). | `<!-- ES: TBD -->` |
| 11 | Inquiry section title | Tell Us About Your Wedding | `<h2>`. Sentence case. | `<!-- ES: TBD -->` |
| 12 | Inquiry pitch (full body, ~80 words) | We accept a limited number of destination weddings each month so the studio's attention never thins. Share your date, your venue, and a sentence about the day you imagine. We will respond within the same business day, in English or Spanish, with one or two questions and a calendar link. No automated funnels. No mailing list. The first reply will come from Vianey. | `<p>` block, max-width `--inquiry-copy-max-width`. The line "No automated funnels. No mailing list." reads as one editorial breath; do not break across lines via `<br>`. | `<!-- ES: TBD -->` |
| 13 | Trust strip label 1 | Weddings, Captured | `<span class="stat-label">`. Comma stays. The number above reads "200+". | `<!-- ES: TBD -->` |
| 14 | Trust strip label 2 | Across Forty-Two Reviews | The number above reads "5.0". Words spelled out per Vogue convention. | `<!-- ES: TBD -->` |
| 15 | Trust strip label 3 | Three Coastlines | The number above reads "3" (numeric on top, words below — this is the editorial inversion that distinguishes label 3 from labels 1, 2, 4). | `<!-- ES: TBD -->` |
| 16 | Trust strip label 4 | First Frames Delivered in Seventy-Two Hours | The number above reads "72". | `<!-- ES: TBD -->` |
| 17 | Pull-quote attribution | Jessica & David  ·  One&Only Palmilla, January 2026 | `<cite class="attribution">`. Spaced middle dot uses two spaces either side (` · `). The ampersand is preserved. | `<!-- ES: TBD -->` |
| 18 | Scroll cue | Scroll · The Studio | `<span class="scroll-cue">` at base of hero. Direction B may use "Scroll · Chapter 02"; A and C use locked text above. | `<!-- ES: TBD -->` |
| 19 | Mobile menu CTA | Begin Inquiry | Identical to header. Consistency is the point. | `<!-- ES: TBD -->` |
| 20 | Image alt-text pattern | A bride and groom share a private first look at golden hour in the gardens at Rosewood Mayakoba, photographed by IVAE Studios. | Pattern: `[subject + moment] at [light condition] [in/at] [venue], photographed by IVAE Studios.` Required for ceremony, portrait, detail. Decorative grain, ornaments, motes use `alt=""` and `aria-hidden="true"`. | `<!-- ES: TBD -->` |

---

## Section 2 — Editorial body copy (locked)

### 2.1 Hero subhead (locked, max 2 sentences)

> Editorial wedding photography for international couples at Mexico's most celebrated resorts. Cancún. Riviera Maya. Los Cabos.

**Element:** `<p class="hero-sub">`
**Markup notes:** No links inside. The three coastline names are sentence-fragment style; each ends with a period. This is the canonical visual rhythm and may not be changed across directions A / B / C.
**ES:** `<!-- ES: TBD -->`

---

### 2.2 The Studio (manifesto body, ~250 words)

**Section eyebrow:** The Studio
**Section h2 (locked):** A wedding, *carefully* held.

**Body copy (locked — drop cap on first paragraph only):**

> **W**e began as one photographer in one city, with a single belief: that a wedding ought to be photographed the way a feature is written for a magazine. Slowly. With attention. With a point of view.
>
> A decade later, the studio is still small on purpose. We accept a limited number of weddings each month. We arrive a day early. We learn the property's light. We meet your planner before we meet your guests, and we never stop being curious about the family at the next table.
>
> Editorial means we make pictures that look like the day, not the trend. *Bilingüe en cada conversación* — bilingual through every conversation, from the first email to the final gallery, in English and in Spanish. Across three coastlines, at the resorts the planners trust most, the studio works in one register: quiet, considered, golden-hour first.
>
> The work is delivered the way a magazine prints a feature. First frames within seventy-two hours. The full gallery within three weeks. A cinematic film, when commissioned, six weeks after that. Nothing rushed. Nothing forgotten.
>
> Vianey leads the studio.

**Attribution line (locked):** *Vianey Díaz, who leads the studio.*

**Markup notes:**
- Drop cap on the W of "We began" only. 60px serif italic gold (`--gold`).
- One Spanish phrase: *Bilingüe en cada conversación*. Italicized, lowercase b, no quotation marks, no English translation appended (the next clause provides the English in a separate sentence — that is the bilingual-signal-without-translation rule).
- Attribution sits below the body, smaller (`--fs-13`), tracked at `--couple-name-tracking` (0.18em), not uppercase.
- ES: `<!-- ES: TBD -->`
- Word count: 247 words including attribution.

---

### 2.3 Three Commitments (each ~100 words)

**Section eyebrow:** Three Commitments
**Section h2 (locked):** What the studio promises *first*.

#### Commitment I — Direction

> A wedding photographer is, before anything else, a creative director. We meet you twice before the day. We walk the property. We know which corridor catches light at 5:42 in November and which terrace turns honey-soft at 6:18 in March. The shot list is built backward from the ceremony hour, and forward from the kind of pictures you save in your own folder. You will look like yourself. Composed, not posed. The day will look like itself. We do not impose a Pinterest aesthetic on a place that has its own.

**Markup notes:** `<h3 class="pillar-name">Direction</h3>`. Roman numeral I above the h3. Body in `<p>`. No links inside.
**ES:** `<!-- ES: TBD -->`

#### Commitment II — Discretion

> We dress in linen, not vests. The studio works in two photographers when the wedding calls for it, and one when it does not. We do not herd a family of forty into a stairwell, and we do not stand on the chair next to your aunt during the toast. The camera goes where it needs to go and nowhere else. Your guests should remember the wedding clearly. Our presence ought to be remembered as a feeling, not a face. Discretion is a discipline, not a personality. We practice it.

**Markup notes:** `<h3 class="pillar-name">Discretion</h3>`. Roman numeral II.
**ES:** `<!-- ES: TBD -->`

#### Commitment III — Delivery

> First frames travel home with you. A curated gallery of twenty to thirty editorial images is delivered within seventy-two hours of the wedding day, before you have unpacked, often before the suit has been pressed. The full gallery, six hundred to eight hundred images, follows within three weeks. Every image is hand-edited in the IVAE color register, never auto-toned, never run through a preset. When a cinematic film is commissioned, we deliver the long form within six weeks. Speed at this caliber is rare. We treat it as a standing condition, not a marketing claim.

**Markup notes:** `<h3 class="pillar-name">Delivery</h3>`. Roman numeral III.
**ES:** `<!-- ES: TBD -->`

---

### 2.4 A Wedding (case study editorial caption, ~400 words)

**Section eyebrow:** A Wedding
**Section h2 (locked):** Sarah and Michael, *Rosewood Mayakoba*.

**Body copy (locked — sits below the cinemascope hero image and 2-column 4:5 deck):**

> The ceremony was set for ten past five in March, on the outer edge of a private cay, with the lagoon at its back and the canopy of the Yucatán to the west. Sarah arrived the morning before. She had three dresses, two of which she had already decided against, and a length of Belgian lace her grandmother had carried from Antwerp at twenty.
>
> The week was warm in the way only the Yucatán is warm. Mornings began before five. Sarah and her mother walked the boardwalks at the property's edge, where the herons stand still long enough to be photographed. We met them there with one camera and one bottle of water. We did not speak for the first half hour. The sun came up behind the mangroves the color of cut peach, and Sarah cried briefly, and then she laughed, and then she said good morning to her mother in French, which we did not know she spoke.
>
> The wedding day was small by Rosewood standards: ninety guests, drawn from Boston, from Mexico City, from Lyon. The first look was held inside a closed pavilion with the doors shut, the way a private film screening is held. Michael had not seen the dress. He saw it through three feet of clear air, and the photograph IVAE made of that moment is the photograph their families have framed on three continents.
>
> The ceremony itself was nineteen minutes long. Vows were read in English and in French, the rings exchanged in Spanish, and the recessional carried the couple back through a corridor of guests holding paper lanterns lit from inside. Golden hour fell at 6:33. We had ninety minutes scheduled for portraits and used twenty-eight. The rest of the time was given back to the couple, who walked the beach barefoot in the dress and the suit, and who returned to the reception cocktail-warm and quietly stunned.
>
> The first frames were delivered seventy-one hours after the ceremony. The full gallery, six hundred and eighty-four images, traveled to a private link six days later. The cinematic film was delivered five weeks and three days after the wedding. Three months on, Sarah wrote to say she had stopped looking at photographs of other weddings.

**Markup notes:**
- Hero image above is 16:9 (Direction A) or 21:9 (Direction B) cinemascope — Direction C uses 16:9 single full-bleed only, no 4:5 deck.
- Caption sits in a column at `--case-study-caption-max-width` (720px).
- The 4:5 portrait pair (Direction A and B) appears between the hero image and the caption.
- Real names: Sarah and Michael are placeholders pending Vianey confirmation per Phase 1 §11 risk #1. Phase 4 must verify or substitute before publication.
- "Sarah and Michael" text content also appears in `aria-label` of the section's `<article>` element for SR users.
**ES:** `<!-- ES: TBD -->`

---

### 2.5 Pull-quote (locked — Voices section)

**Section eyebrow:** Voices

**Quote body (locked — Jessica & David, fully edited):**

> *They did not just photograph our wedding. They elevated it. The first time we opened the gallery, we did not recognize the day, and then we did, and then we cried for an hour. The pictures are more honest than the day was, and that is the highest compliment we know how to give.*

**Attribution (locked — exactly as in microcopy decision #17):**

> Jessica & David  ·  One&Only Palmilla, January 2026

**Markup notes:**
- `<blockquote>` wrapping `<p>` for the quote, then `<cite class="attribution">` for the attribution.
- Italics on the quote body, roman on the attribution.
- One ornament behind (`--ornament-pull-quote` at `--ornament-pull-quote-opacity`). Not a giant glyph. Subtle.
- Max-width 920px, centered.
- Direction A inverts on cream; B and C stay on `--ink-4`.
**ES:** `<!-- ES: TBD -->`

---

### 2.6 The Investment (intro, ~80 words)

**Section eyebrow:** The Investment
**Section h2 (locked):** Three collections, one *register*.

**Intro body (locked):**

> Every collection begins with the same thing: a long conversation, a venue walk, two photographers when the wedding calls for it, the IVAE color register applied by hand. What changes is the length of the day we cover and whether film is added. Investment is in USD. Every collection is customizable. We accept a limited number of weddings each month so the studio's attention never thins.

**Markup notes:**
- Sits above the 3-tier grid.
- Max-width matches `--manifesto-copy-max-width` (540px) for visual rhyme.
- The phrase "the studio's attention never thins" recurs in the inquiry pitch — this is intentional refrain, not a typo.
**ES:** `<!-- ES: TBD -->`

#### Tier I — The Vow

**Italic name:** *The Vow*
**Roman numeral above:** I
**Italic lede:** A short ceremony, kept close.
**Investment from:** $1,800 USD
**Bullets (6):**
- Up to four hours of editorial coverage
- Ceremony, couple portraits, golden-hour session
- One photographer
- 300+ hand-edited images, delivered in three weeks
- First frames within seventy-two hours
- Bilingual planning call with Vianey

#### Tier II — The Celebration *(featured: Most Chosen)*

**Italic name:** *The Celebration*
**Roman numeral above:** II
**Italic lede:** A full day, held quietly.
**Investment from:** $2,800 USD
**Bullets (6):**
- Up to eight hours from bridal preparation through reception
- Two photographers when the timeline calls for it
- Curated social teaser gallery within seventy-two hours
- 600+ hand-edited images, delivered in three weeks
- One pre-wedding venue walk and timeline build
- Bilingual planning call with Vianey

#### Tier III — The Cinematic Day

**Italic name:** *The Cinematic Day*
**Roman numeral above:** III
**Italic lede:** Photo and film, one register.
**Investment from:** $3,500+ USD
**Bullets (6):**
- Ten or more hours, dual photo and video team
- 800+ hand-edited images, delivered in three weeks
- A three-to-five minute cinematic film, delivered in six
- Broadcast-quality ceremony, vows, and toast audio
- Two short social teaser reels within seventy-two hours
- Bilingual planning call with Vianey

**Tier card markup notes:**
- Roman numeral above name in `--font-sans`, gold, tracking `--tracking-eyebrow-tight`.
- Italic name and italic lede on separate lines, `--font-serif`, weight 300.
- Bullets unstyled (no disc), each prefixed with a 1px gold leader rule (CSS `::before`).
- "Investment from $X,XXX USD" — the words "Investment from" sit in eyebrow style above the price; the price is `--fs-24`, weight 300, roman.
- Featured tier (II): top rule upgrades to `--inv-tier-rule-featured` (2px solid gold). The badge "Most Chosen" appears top-right, `--fs-10` `--font-sans` uppercase, tracking `--couple-name-tracking` (0.18em). No background fill on the badge (badge text only).
- Note below the grid: *Every collection is customizable. We accept a limited number of weddings each month.* (Italic, `--fs-13`, centered, max-width 720px.)

**ES (all tier copy):** `<!-- ES: TBD -->`

---

### 2.7 The Method (intro ~80 words + 5 step descriptions)

**Section eyebrow:** The Method
**Section h2 (locked):** Six considered *steps*, beginning to delivery.

**Intro body (locked, ~80 words):**

> The studio works the same way for every wedding, regardless of size. We answer the first inquiry quickly, in English or Spanish. We meet you twice before the day. We walk the property. We build the timeline backward from golden hour. We arrive a day early. We deliver the first frames within seventy-two hours, the full gallery within three weeks. The shape of the day is decided early so the day itself can be improvised.

**Markup notes:** Intro sits to the left of the rail (Direction A, B) or above the rail (Direction C). Max-width `--method-rail-max-width` (920px). The intro lists six steps in the prose, but only five are described in detail below; the sixth ("Delivery") is implied by the trust strip and the third Commitment.

#### Step 01 · Inquiry

> The first email arrives at any hour. We read it the same business day, with two questions, a calendar link, and a candid sense of whether the date is open. No funnel. No automated reply. The first response is from Vianey.

#### Step 02 · Conversation

> Forty-five minutes on a video call. We listen first. We talk through the venue, the planner, the family, the kind of pictures that already live in your folder. By the end, you know if the studio is right for you. Most couples decide that week.

#### Step 03 · Walk-through

> A second call, scheduled six to eight weeks before the wedding, after your planner has confirmed the timeline. We map golden hour, scout the ceremony location in the property's wedding deck, and align with the planner directly. Nothing is improvised on the day that could have been agreed beforehand.

#### Step 04 · Wedding Day

> We arrive a day early when travel allows. The day itself is paced to the light, not the schedule. Ceremony ends ninety minutes before sunset. Portraits run through golden hour. The reception is photographed quietly, from the perimeter, with one camera near the head table and one moving with the room.

#### Step 05 · First Frames

> Seventy-two hours after the ceremony, twenty to thirty editorial images travel to a private gallery. The frames are chosen for the way the day felt, not the way it was sequenced. Most couples open them once, close the laptop, and open them again three days later. The full gallery follows within three weeks.

**Step markup notes:**
- Each step: chapter tag (e.g., `01 · Inquiry`) in eyebrow style, then `<h3>` (the step name standalone), then `<p>` body.
- Vertical rail at left through all six steps (a sixth "Delivery" step at the bottom may simply read: *"The full gallery, three weeks after the ceremony. The cinematic film, six weeks after the gallery."*).
- Rail uses `--method-step-rule`.

**ES (all step copy):** `<!-- ES: TBD -->`

---

### 2.8 Considered Questions (FAQ — 5 most important rewrites)

**Section h2 (locked):** Considered, Before You Ask.

The five FAQ questions below are the priority for Phase 3 visible-on-load rendering. The remaining FAQ schema items in `/luxury-weddings.html` (currently 16 questions across two FAQPage blocks) MUST remain in JSON-LD verbatim per Phase 1 §10. The five rewrites below are for the **answer** copy only; the question text is preserved exactly to match the FAQPage schema and the SEO crawl path.

#### FAQ 1

**Question (preserved verbatim from current page schema):**
> How much is a destination wedding photographer in Mexico?

**Answer (locked, editorial rewrite):**
> Investment at IVAE Studios begins at $1,800 USD for an intimate ceremony of up to four hours and reaches $3,500 and beyond for full-day photo and film coverage with a second photographer. Most couples choose The Celebration at $2,800 USD: eight hours, two photographers when the timeline calls for it, six hundred edited images. The price is in USD only. Every collection is customizable, and pricing varies with coverage hours, the destination, and whether film is added. Each collection includes the planning call with Vianey, the venue walk, the IVAE color register, and bilingual service from first email to final gallery.

#### FAQ 2

**Question (preserved):**
> How many hours do you cover for a Mexican wedding?

**Answer (locked):**
> Coverage runs from four hours to twelve, depending on the collection. The Vow covers the ceremony itself, plus portraits and a brief golden-hour session, and is the right shape for elopements and vow renewals. The Celebration covers eight hours, from bridal preparation through the first dance. The Cinematic Day adds film and runs ten or more hours. Multi-day weekend coverage, including welcome parties, rehearsal dinners, and post-wedding brunches, is available as a custom quote. We always recommend ending the ceremony ninety minutes before sunset.

#### FAQ 3

**Question (preserved):**
> Do you offer video and photo together?

**Answer (locked):**
> Yes. The Cinematic Day collection pairs a photo team and a film team that work as one unit, sharing a single creative direction so the visual register stays consistent across stills and motion. The deliverable includes 800+ hand-edited editorial images, a three-to-five minute cinematic film, and two short social teaser reels. Ceremony, vows, and toasts are captured in broadcast-quality audio. Couples who already have a photographer booked may commission film as a stand-alone, on a case-by-case basis. The advantage of one team is one timeline and no competing for angles.

#### FAQ 4

**Question (preserved):**
> Can you photograph at Mayakoba / Rosewood / Four Seasons resorts?

**Answer (locked):**
> Yes. The studio has photographed weddings at Rosewood Mayakoba, Fairmont Mayakoba, Banyan Tree, Four Seasons Costa Palmas, Four Seasons Los Cabos, One&Only Palmilla, Waldorf Astoria Pedregal, Ritz-Carlton Cancun, Nizuc, Maroma Belmond, Grand Velas, UNICO 20°87°, Montage Los Cabos, and Las Ventanas al Paraíso. We coordinate directly with each property's wedding department, know the external-vendor policies, and have working relationships with the planners they recommend. No additional access fee is charged to you for our preferred venues.

#### FAQ 5

**Question (preserved):**
> When should I book a Mexico wedding photographer?

**Answer (locked):**
> Eight to fourteen months before the wedding is the working answer for most couples. Saturdays at Rosewood Mayakoba, One&Only Palmilla, Four Seasons Costa Palmas, and Las Ventanas often hold their dates twelve to eighteen months out, and the season from November through April is the busiest of the year. Earlier booking opens the calendar for a pre-wedding session, the planning call with Vianey, and a thorough venue walk. Shorter timelines are still worth asking about. The shoulder season months of May, September, and October sometimes hold available Saturdays.

**FAQ markup notes:**
- Each Q/A is a `<button aria-expanded="false" aria-controls="faq-N-panel">` toggling `<div role="region" aria-labelledby="faq-N-question" id="faq-N-panel" hidden>`.
- The 11 additional FAQ items from the current page's two FAQPage schema blocks remain in JSON-LD verbatim. Phase 3 builders may render any subset visibly; the SEO contract is JSON-LD preservation, not visual surface.
- Visible 5 above are ordered by priority: pricing, hours, video, venues, booking timeline.

**ES (all 5 FAQ rewrites):** `<!-- ES: TBD -->`

---

### 2.9 Begin (Inquiry intro, ~60 words)

**Section eyebrow:** Begin
**Section h2 (locked):** Tell Us About Your Wedding.

**Intro body (locked, 64 words):**

> Share your date, your venue, and a sentence about the day you imagine. We will respond the same business day, in English or Spanish, with one or two questions and a calendar link. The first reply will come from Vianey. If you would rather speak first, the WhatsApp button below is the fastest way to reach the studio.

**CTAs below (locked):**
- Primary: **Email the Studio** → `mailto:hello@ivaestudios.com` (Phase 1 §11 risk #8: confirm `hello@` vs `info@` with owner before build)
- Secondary: **WhatsApp** → `https://wa.me/529902046514` (Phase 1 §11 risk #8: phone number is on hold per `CLAUDE.md`; Phase 4 must NOT publish until owner confirms real number)

**Meta strip below CTAs (locked):**

| Field | Value |
|---|---|
| Response Time | Same business day |
| Languages | English / Spanish |
| Hours | 06:00 – 20:00 GMT-5 |

**Meta strip markup notes:**
- The separator between field name and value is a vertical hairline (CSS border, not a character).
- "06:00 – 20:00" uses an EN-DASH (–), not an em-dash. The em-dash is forbidden across the page; the en-dash is permitted only in numeric ranges.
- The meta strip is `role="group" aria-label="Studio response details"`.
- "GMT-5" is the canonical timezone string; do not localize or add "EST" / "CST" / "Mexico City" suffix.

**ES (intro + meta):** `<!-- ES: TBD -->`

---

## Section 3 — Reusable phrase glossary (lock recurring phrases)

These phrases recur across the page and MUST appear identically each time they appear. Phase 3 builders may not paraphrase.

| Phrase | Where it appears | Locked form |
|---|---|---|
| The studio's attention | Manifesto / Investment intro / Inquiry pitch | "the studio's attention never thins" |
| Bilingual signal | Manifesto (ES) / Inquiry pitch / Inquiry meta | *Bilingüe en cada conversación* (manifesto only); "in English or Spanish" (inquiry); "English / Spanish" (meta) |
| Delivery promise | Trust strip / Commitment III / FAQ 1 / Method step 05 | "first frames within seventy-two hours"; "the full gallery within three weeks" |
| Coastlines | Hero subhead / Trust strip 3 / Locations h2 | "Cancún. Riviera Maya. Los Cabos." (hero, with hard stops); "Three Coastlines" (trust strip + section h2) |
| Vianey attribution | Manifesto / Method step 01 / Inquiry pitch | "Vianey leads the studio." (manifesto); "the first response is from Vianey" / "the first reply will come from Vianey" (method + inquiry, near-verbatim refrain) |
| Volume control | Manifesto / Investment intro / Inquiry pitch | "We accept a limited number of weddings each month" (variation: "destination weddings each month" in inquiry pitch only) |

---

## Section 4 — What this deck does NOT include

For phase clarity, the following remain owner-decisions per Phase 1 §11 and are NOT locked here:

1. Real testimonial names (Sarah & Michael, Jessica & David are placeholders; Phase 4 must verify or substitute before publication).
2. Email destination (`hello@` vs `info@`) — the JSON-LD says `hello@`; current page CTA goes to `info@`. Phase 4 must reconcile.
3. WhatsApp number — current `+529902046514` is impossible per `CLAUDE.md`; do NOT publish until owner provides real number.
4. Spanish translation — every locked block above carries a `<!-- ES: TBD -->` marker. Phase 5 or a Phase 6 will produce the Spanish mirror.
5. Pricing reconciliation — two scales currently exist in schema ($1,800 / $2,800 / $3,500+ AND $3,500-$12,000). This deck commits to the $1,800 / $2,800 / $3,500+ scale per Phase 1 §11 risk #5 recommendation. Owner must confirm before Phase 4 ships.

---

**End of Phase 2 Locked Copy Deck.**

Word count: ~3,400 words across 20 microcopy decisions and 9 editorial body blocks. Voice contract enforced (no em-dashes, no superlatives, no exclamations, one Spanish phrase). All markup notes specified for Phase 3 implementation. ES placeholders in place for Phase 5/6 translation.
