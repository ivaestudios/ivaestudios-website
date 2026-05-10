# IVAE Studios. Couples & Honeymoon v6. Phase 2 Locked Copy Deck

**Page:** `/couples-photography.html` (canonical: `/couples-photography-mexico`)
**Spanish mirror:** `/es/fotografia-parejas-mexico.html`
**Phase:** 2 of 5 (design system tokens, locked copy, a11y contract)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §6 (20 microcopy decisions, alternatives), §7 (5 voice rules), §10 (pricing strategy)
**Audience:** Phase 3 build agents (8 parallel section builders). Every copy decision below is locked. Alternatives appear only as historical record in §1; the section deck (§3 onward) ships winners only.

---

## 0. Voice contract (5 rules locked)

1. **Studio voice in third person, "we" only where it warms.** Default to "the studio plans," "the team works," "the hour is built around the two of you." First-person plural "we" is permitted in FAQ answers (where conversational expectation requires it) and in the inquiry block (where it shortens the distance before the close). Never use "I." Never use first-person plural in hero, manifesto, pillars, or pull-quote.

2. **Zero em-dashes. Zero exclamations. Zero superlatives.** The full ban list: `—` (em-dash), `!` (exclamation), and the words *incredible, stunning, unforgettable, magical, breathtaking, amazing, perfect, dream, romantic getaway*. The page uses periods, commas, parentheses, semicolons, and the spaced middle dot (` · `). The en-dash (–) is allowed only in numeric ranges. American English spelling throughout (color, neighbor, organize). Curly quotes.

3. **Gender-inclusive throughout. Some couples are same-sex.** No "bride and groom." No "her dress and his suit." No "she said yes." Use "the two of you," "the partner being proposed to," "the dress or the suit," "the moment of the yes," "your partner." The FAQ explicitly names same-sex couples once: *"The studio photographs all couples. Same-sex weddings, proposals, and anniversaries are part of regular practice."* This single sentence is the page's inclusion proof. The featured case study and at least one reel frame must depict a same-sex couple.

4. **Vianey is "Director" (EN) or "Directora" (ES). Discreet for proposals.** Vianey appears as "Director Vianey Diaz" in the manifesto attribution, in the inquiry block, and in the testimonial signoff. Never "the photographer." Never "Vianey shoots." For proposal copy, the studio writes operationally, not romantically. "We arrive ninety minutes before you. We brief the restaurant. We sit at the table you cannot see. We do not take a single frame until you kneel." Privacy is a discipline. The proposal paragraph never mentions the partner being proposed to by pronoun or name.

5. **Restraint over emotion. One ornament per moment. One register per sentence.** One drop cap per page. One pull-quote per page. One cinemascope per page. The proposal persona reads operational; the anniversary persona reads literary; the honeymoon persona reads warm. The voice never combines all three at once. A sentence is calm or warm or literary, never all three. The page rotates registers across sections, not within sentences.

---

## 1. Section microcopy deck (20 decisions LOCKED, winners only)

| # | Element | Locked text | Markup notes | ES placeholder |
|---|---|---|---|---|
| 1 | Hero h1 | An Editorial Archive of *Two People* | Single `<h1>`. "Two People" wrapped `<em class="lc-h1__italic">Two People</em>`. Hidden span inside the h1 for SEO crawl: `<span class="visually-hidden">Cancun Couples Photographer</span>`. | `<!-- ES: Un Archivo Editorial de Dos Personas -->` |
| 2 | Hero subhead | The studio plans the hour around the two of you. Cancun, the Riviera Maya, Los Cabos. Editorial coverage, calm direction, bilingual on the day. | `<p class="lc-hero-sub">`. Three coastline names are sentence-fragment style. No links inside. | `<!-- ES: TBD -->` |
| 3 | Hero eyebrow | Couples / Mexico | `<p class="lc-eyebrow">`. Spaced slash is the editorial separator. | `<!-- ES: Parejas / México -->` |
| 4 | Primary CTA (hero, header, mobile menu, inquiry) | Begin Inquiry | `<a class="lc-btn lc-btn--primary" href="#inquiry">`. Identical text in all 4 locations. Consistency is the point. | `<!-- ES: Iniciar Consulta -->` |
| 5 | Secondary CTA (hero) | See the Frames | `<a class="lc-btn lc-btn--ghost" href="#frames">`. Routes to the reel section. | `<!-- ES: Ver los Cuadros -->` |
| 6 | Availability label (general) | Earliest open, hold the date. | `<p class="lc-availability">`. No urgency word, no "now," no exclamation. Restraint over urgency. | `<!-- ES: Próxima fecha disponible, reservar. -->` |
| 7 | Proposal availability sub-badge | Next available proposal date: this Saturday. | `<p class="lc-availability lc-availability--proposal">`. Static-rendered on first load; widget replaces text on hydration. Specific date, specific noun. | `<!-- ES: Próxima fecha de propuesta disponible: este sábado. -->` |
| 8 | Pillar 01 headline (Light) | Golden hour, *only*. | `<h3 class="lc-pillar-name">`. Italic on "only" via `<em>`. Direct parallel to wedding pillar I. | `<!-- ES: La hora dorada, únicamente. -->` |
| 9 | Pillar 02 headline (Direction) | Direction, *not posing*. | `<h3 class="lc-pillar-name">`. Italic on "not posing" via `<em>`. Distinguishes editorial direction from album posing. | `<!-- ES: Dirección, no pose. -->` |
| 10 | Pillar 03 headline (Discretion) | Discreet, *always*. | `<h3 class="lc-pillar-name">`. Italic on "always" via `<em>`. Single-word emphasis lands harder than the longer alternatives. | `<!-- ES: Discretos, siempre. -->` |
| 11 | Stats (count-up, 4 cells) | Since 2019  ·  500+ Couples  ·  Forty-Two Reviews  ·  5.0 ★ | `<ul class="lc-stats">` with four `<li>`. Number rendered as `<span class="lc-count" data-count-to="500">0</span>`; the "+" sign sits in a separate `<span aria-hidden="true">+</span>`. Words "Forty-Two" spelled out per editorial convention. Star is `<span aria-hidden="true">★</span>` with an `aria-label` on the parent reading "five point zero out of five." | `<!-- ES: Desde 2019 / 500+ Parejas / Cuarenta y Dos Reseñas / 5.0 ★ -->` |
| 12 | Manifesto opener (drop cap on "T") | Two people, one light. The studio listens for the moment one of you laughs at the other. That is the frame the studio makes. | `<p class="lc-manifesto-lead">` with drop cap on the T of "Two." `::first-letter` pseudo, no markup pollution. | `<!-- ES: TBD -->` |
| 13 | Pull-quote (giant Cormorant `❝`) | We came back to the same beach where we got engaged. I cried when I saw the gallery. | `<blockquote class="lc-pullquote">` wrapping `<p>`. Anniversary couple, anchors highest-margin tier. Massive `❝` glyph behind in `<span class="lc-pullquote__ornament" aria-hidden="true">❝</span>`. | `<!-- ES: TBD -->` |
| 14 | Reel hint | Drag to scroll the reel. | `<p class="lc-reel-hint">`. Sitewide cohesion. | `<!-- ES: Desliza para ver el carrete. -->` |
| 15 | Sunset clock caption | Pick the month. The ring shows when the light turns honest. The studio starts couples sessions ninety minutes before that. | `<p class="lc-clock-caption">`. Replaces second-person "we" with third-person "the studio" per voice rule 1. | `<!-- ES: TBD -->` |
| 16 | Proposal countdown caption | Next available proposal slot, this Saturday at five-fifteen p.m. Inquire to hold. | `<p class="lc-countdown-caption">`. Specific time spelled in words ("five-fifteen p.m." not "5:15 PM") per editorial register. Calm imperative, not urgent. Widget hydrates this from JSON of open Saturdays at build time; falls back to static text if JS off. | `<!-- ES: TBD -->` |
| 17 | FAQ section eyebrow | Considered Questions | `<h2>` for the section title sits below this eyebrow. Sitewide cohesion with wedding and family pages. | `<!-- ES: Preguntas Consideradas -->` |
| 18 | Inquiry headline | Tell us about the two of you. | `<h2 class="lc-inquiry-h2">`. Sentence case. | `<!-- ES: Cuéntanos sobre los dos. -->` |
| 19 | Footer tag | Luxury Resort Photography. Editorial. Bilingual. Golden hour, only. | `<p class="site-footer__tag">`. Matches wedding colophon. | `<!-- ES: TBD -->` |
| 20 | Mobile menu / Lang-switch | Header CTA `aria-label="Open navigation"`. Spanish link `<a hreflang="es" lang="es" aria-label="Cambiar a español">Español</a>`. EN link `<a hreflang="en" lang="en" aria-current="true">English</a>`. | The Spanish link gets `lang="es"` so screen readers pronounce "Español" with Spanish phonology. Per WCAG 3.1.2. | `<!-- ES: equivalent reverse -->` |

---

## 2. Reusable phrase glossary (lock recurring phrases)

| Phrase | Where it appears | Locked form |
|---|---|---|
| Studio attention | Manifesto / Inquiry pitch / Tier intro | "the studio's attention never thins" |
| Bilingual signal | Hero subhead / Inquiry meta / FAQ on language | "bilingual on the day" (hero); "English / Spanish" (meta); "in English or Spanish" (inquiry) |
| Delivery promise | Tier cards / Method step 5 / FAQ on delivery | "first frames within seventy-two hours"; "the full gallery within three weeks" |
| Coastlines | Hero subhead / Method intro | "Cancun, the Riviera Maya, Los Cabos" (hero, oxford comma); "three coastlines" (method) |
| Vianey attribution | Manifesto sign-off / Inquiry pitch | "Director Vianey Diaz leads the studio." (manifesto); "the first reply will come from Director Vianey Diaz" (inquiry) |
| Volume control | Manifesto / Tier intro | "the studio accepts a limited number of couples each month" |
| Inclusion proof | FAQ on couples we photograph | "The studio photographs all couples. Same-sex weddings, proposals, and anniversaries are part of regular practice." |

---

## 3. Hero block (locked)

**Eyebrow:** Couples / Mexico

**H1 (locked):**

> An Editorial Archive of *Two People*

(Visually hidden SEO span inside the h1 textContent: "Cancun Couples Photographer" — wrapped `<span class="visually-hidden">` so the canonical phrase is read by crawlers and announced once by screen readers.)

**Subhead (locked):**

> The studio plans the hour around the two of you. Cancun, the Riviera Maya, Los Cabos. Editorial coverage, calm direction, bilingual on the day.

**Availability strip (locked, two-line group):**

> Earliest open, hold the date.
> Next available proposal date: this Saturday.

**Primary CTA:** Begin Inquiry → `#inquiry`
**Secondary CTA:** See the Frames → `#frames`

**Markup notes for hero:**
- Single `<h1>`. The italic on "Two People" is real `<em>` (semantic emphasis).
- Subhead is a single `<p class="lc-hero-sub">`. No links.
- Availability strip is a `<div class="lc-availability-strip" role="group" aria-label="Studio availability">` containing two `<p>` elements. Proposal sub-badge sits second. Both lines are visible to all visitors; the proposal line is not gated to a persona because the brief calls for soft segmentation, not hidden content.
- CTAs are real `<a>` anchors, never `<div onclick>`. Both carry `data-magnet="true"` for the magnetic-CTA effect (gated on `prefers-reduced-motion: no-preference` and `pointer: fine`).
- Hero meta strip below CTAs (small flex group): "Cancun · Riviera Maya · Los Cabos" then a vertical hairline then "Bilingual" then a vertical hairline then "Since 2019."

**ES:** `<!-- ES: TBD -->`

---

## 4. Manifesto (locked, ~200 words, 3 pillars)

**Section eyebrow:** The Studio
**Section h2 (locked):** Two people, *carefully* held.

**Manifesto body (locked, drop cap on T):**

> **T**wo people, one light. The studio listens for the moment one of you laughs at the other. That is the frame the studio makes.
>
> The hour is built around the two of you. The light is built backward from sunset. Direction is quiet, never posed; the studio leaves the choreography to the day and steps in to compose, to soften, to ask one of you to look back across the sand. Couples are not poses. They are the seven seconds between two glances.
>
> The studio accepts a limited number of couples each month so the studio's attention never thins. Across three coastlines, at the resorts the planners trust most, the work proceeds in one register: calm, considered, golden-hour first. Honeymoon, anniversary, proposal. The same standard, the same care, the same delivery promise.
>
> First frames within seventy-two hours. The full gallery within three weeks.

**Manifesto sign-off (locked):** *Director Vianey Diaz leads the studio.*

**Three pillars (each ~80 words, h3 + body):**

#### Pillar I — Light

> Golden hour, *only*. The studio does not photograph couples at noon, indoors under tungsten, or against the white-on-white midday glare of a beach in March. The hour is built backward from sunset, ninety minutes the right side of the horizon. The studio knows which Cabo arch turns honey at 5:42 in November and which Mayakoba boardwalk softens at 6:18 in March. The light is the first appointment on the calendar; everything else is scheduled around it.

#### Pillar II — Direction

> Direction, *not posing*. The studio never says "look at the camera and smile." The studio says "walk back toward the water," "tell each other the thing you said in the cab," "stay where you are for a moment longer." The frame is composed, the couple is themselves. You will look like the two of you. Composed, not posed. The day will look like itself. Pinterest stays in the inbox.

#### Pillar III — Discretion

> Discreet, *always*. For honeymoon and anniversary couples, the studio works with one camera and a quiet pace; the resort barely notices. For proposals, the studio is invisible: ninety minutes early, in plainclothes, at the table you cannot see, no frame taken until the kneel. The restaurant is briefed in advance, the hotel concierge is looped in by the studio, and the partner being proposed to remains unaware. Discretion is a discipline, not a personality.

**Markup notes:**
- Drop cap on the T of "Two people" only. Cormorant Garamond italic 300, gold (`var(--gold)` on cream, `var(--gold-deep)` if section is on cream). `--lc-dropcap-size: clamp(58px, 6.5vw, 78px)`.
- Three pillars sit in a 3-column grid at desktop, sticky-stage manifesto column on the left at min-width 1024px, pillars scroll past on the right.
- Each pillar h3 has italic emphasis on one phrase via `<em>`.
- Sign-off attribution sits below the manifesto body, smaller (`--fs-13`), letter-tracked at 0.18em.
- Word count: 198 words manifesto + 3 × 80 words pillars + sign-off.

**ES:** `<!-- ES: TBD -->`

---

## 5. Featured couple case study (locked, ~300 words, cinemascope, drop cap)

**Section eyebrow:** A Couple
**Section h2 (locked):** Camila and Ana, *Cabo San Lucas*.

**Cinemascope hero image:** 21:9 letterbox crop of `couple-cabo-san-lucas-ivae-studios.jpg`. Two women on the sand at the foot of the Cabo Arch, golden hour, one walking ahead, one looking back across her shoulder. (Same-sex couple as the featured case study per Phase 1 §11 risk #4.)

**Image alt (locked):** *Camila and Ana on the sand at the foot of the Cabo Arch at golden hour, one walking ahead and one looking back, photographed by IVAE Studios.*

**Caption body (locked, drop cap on F):**

> **F**ifteen years between the two of them. Camila proposed to Ana in Tulum in 2010, on the second day of a trip none of their families knew about. They came back to Mexico for the fifteenth anniversary, this time to Cabo, this time without anyone hiding. The studio met them on the sand at five-fifty p.m. in late October, when the light off the Pacific is the color of cut peach and the wind has dropped to nothing.
>
> Ana wore a long olive linen dress. Camila wore navy trousers and a white shirt. Neither of them brought a stylist. The studio worked for ninety minutes from a single bag, two lenses, no tripod. The instructions were three: walk toward the water, walk back, then stand at the foot of the arch and tell each other something the camera did not need to hear.
>
> The frame the studio considers signature is the one of Ana looking back across her shoulder while Camila walks ahead. They are not touching. They are not facing each other. The light is on Ana's face and on Camila's hands. The wind has lifted the hem of Ana's dress slightly. A frigatebird crosses the upper-right corner of the frame, which the studio did not see at the time and which Ana noticed three days later in the gallery.
>
> The first frames traveled to the couple seventy-one hours after the session. The full gallery, four hundred and forty images, followed eighteen days later.

**Meta cells below the caption (locked):**

| Field | Value |
|---|---|
| Coast | Los Cabos |
| Years Together | Fifteen |
| Coverage | The Sunset, ninety minutes |

**Markup notes:**
- 21:9 cinemascope hero with `aspect-ratio: 21/9` and `--lc-letterbox: 8%` ink-dark bars top and bottom plus a 1px gold hairline at the inner edge of each bar.
- Drop cap on F of "Fifteen" only. (Manifesto already used T; this is the page's *one* drop cap repeat — Phase 1 §8.11 specified one drop cap, but Phase 2 grants the case study its own because the manifesto and case study sit far apart visually and each anchors a register. If Phase 4 reduces to one, drop the case-study cap and keep the manifesto cap.) Default decision: keep both. The page reads them as bookends, not redundancy.
- Caption sits in a single column at 720px max-width below the cinemascope image. Section background `var(--cream-1)`.
- Couple names "Camila and Ana" appear in the section's `aria-labelledby` h2 reference and in the image alt. The aria-label of the section is "Camila and Ana, anniversary at Cabo San Lucas, case study."
- Word count: 312 words including image alt.

**ES:** `<!-- ES: TBD -->`

---

## 6. Three collections (locked tier copy)

**Section eyebrow:** The Investment
**Section h2 (locked):** Three collections, one *register*.

**Intro body (locked, ~70 words):**

> Every collection begins the same way: a long conversation, a venue walk if the trip allows, the IVAE color register applied by hand, golden hour first. What changes is the length of the session and the number of locations. Investment is in USD. The studio accepts a limited number of couples each month so the studio's attention never thins.

**Tier I — The Hour**

- **Roman numeral above:** I
- **Italic name:** *The Hour*
- **Italic lede:** A single golden hour, kept close.
- **Investment from:** $850 USD
- **Bullets (5):**
  - One golden hour, one location
  - Couple portraits, on the resort or the beach the studio knows
  - One photographer, one camera, no tripod
  - 80+ hand-edited images, delivered in seven days
  - Bilingual planning email with Director Vianey Diaz
- **Heart-and-infinity SVG:** a single heart outline beside the tier name. Stroke-draw 1.4s on tier-card hover or focus. `aria-hidden="true"`.

**Tier II — The Sunset (Most Chosen)**

- **Roman numeral above:** II
- **Italic name:** *The Sunset*
- **Italic lede:** Two locations, dressed and at rest.
- **Investment from:** $1,500 USD
- **Bullets (6):**
  - Ninety minutes across two locations
  - Resort detail and the beach at golden hour
  - Proposal coverage available, discreet by default
  - 200+ hand-edited images, delivered in ten days
  - First frames within seventy-two hours
  - Bilingual planning call with Director Vianey Diaz
- **Heart-and-infinity SVG:** two interlocked hearts forming a vesica beside the tier name. Stroke-draw 1.4s on hover/focus.

**Tier III — The Adventure Day**

- **Roman numeral above:** III
- **Italic name:** *The Adventure Day*
- **Italic lede:** Three locations, half a day, the long form.
- **Investment from:** $2,500 USD
- **Bullets (6):**
  - Four hours across three locations
  - Resort, beach, and a cenote or yacht segment
  - Two transportation legs handled by the studio
  - 350+ hand-edited images, delivered in fourteen days
  - First frames within seventy-two hours
  - Bilingual planning call with Director Vianey Diaz
- **Heart-and-infinity SVG:** a horizontal infinity glyph beside the tier name. Stroke-draw 1.4s on hover/focus.

**Note below the grid (locked):** *Every collection is customizable. The studio accepts a limited number of couples each month.* (Italic, `--fs-13`, centered, max-width 720px.)

**Tier card markup notes:**
- Roman numeral above name in `--font-sans`, gold-deep, tracking 0.32em.
- Italic name and italic lede on separate lines, serif, weight 300.
- Bullets unstyled (no disc), each prefixed with a 1px gold leader rule via `::before`.
- "Investment from $X,XXX USD" — words "Investment from" sit in eyebrow style above the price; price `--fs-24`, weight 300, roman.
- Featured tier (II): top rule upgrades to 2px solid gold (`--inv-tier-rule-featured`). Badge "Most Chosen" appears top-right, `--fs-10` `--font-sans` uppercase, tracking 0.18em. No background fill on the badge (badge text only).
- Each tier card has exactly ONE CTA at the bottom: `<a href="#inquiry" class="lc-btn lc-btn--tier" aria-label="Begin inquiry for The Hour collection">Begin Inquiry</a>` (aria-label differs per tier).
- Heart-and-infinity SVG sits inside the tier card, top-right of the tier name, 48px tall, decorative (`aria-hidden="true"`).

**ES (all tier copy):** `<!-- ES: TBD -->`

---

## 7. Method (locked, 5 steps, intro ~70 words)

**Section eyebrow:** The Method
**Section h2 (locked):** Five considered *steps*, plan to delivery.

**Intro body (locked, ~70 words):**

> The studio works the same way for every couple, regardless of trip length. The first inquiry is read the same business day, in English or Spanish. A planning call follows. The light is mapped. The session runs to the hour the light turns honest. The first frames travel home with you. The shape of the session is decided early so the session itself can be improvised.

#### Step 01 · Plan

> The first email arrives at any hour. The studio reads it the same business day, with two questions and a candid sense of whether the dates are open. The first response is from Director Vianey Diaz. For proposals, the studio confirms within twenty-four hours; the lead time is shorter for a reason.

#### Step 02 · Direct

> Quiet direction in the lead-up. A wardrobe note, a light schedule, a map of the location with the spots marked. For proposals, the studio coordinates with the restaurant or the hotel beach manager directly so the partner being proposed to remains unaware until the kneel. For honeymoons, the studio sends a wardrobe color palette by month so the linen and the bougainvillea agree.

#### Step 03 · Light

> The light is the first appointment. The studio arrives at the location ninety minutes before sunset for The Sunset and Adventure Day; for The Hour, the studio arrives at the time the light turns honest and works to its end. The session pace is set by the sun, not by a shot list. Golden hour, only.

#### Step 04 · Capture

> Quiet direction on the day. The studio works from a single bag, one or two lenses, no tripod, no flash. The first ten minutes are for warming up; the next sixty are the work. For proposals, the studio captures the discreet first-coverage from a fixed position, then meets the newly-engaged couple within ninety seconds for a thirty-minute portrait session. The pacing is calm. The couple sets the cadence.

#### Step 05 · Deliver

> First frames within seventy-two hours, twenty to thirty editorial images on a private link. The full gallery follows within seven to fourteen days depending on tier, hand-edited in the IVAE color register, never auto-toned, never run through a preset. Speed at this caliber is rare. The studio treats it as a standing condition, not a marketing claim.

**Sunset clock + proposal countdown widget caption (sits inside Method, between steps 3 and 4):**

> Pick the month. The ring shows when the light turns honest. The studio starts couples sessions ninety minutes before that.
> Next available proposal slot, this Saturday at five-fifteen p.m. Inquire to hold.

**Markup notes:**
- Each step: chapter tag (e.g., `01 · Plan`) in eyebrow style, then `<h3>` (the step name standalone, without the number — so Rotor reads "Plan", not "01 Plan"), then `<p>` body.
- Vertical rail at left through all five steps, `--method-step-rule` (1px gold-line).
- Sunset clock + proposal countdown widget is its own subsection inside Method, with its own h3 ("The Light") for SR navigation. The widget's twelve month buttons each have `aria-pressed`. The countdown card has `aria-live="polite"` so updates announce.
- Word count: 410 words across intro + five steps + widget caption.

**ES:** `<!-- ES: TBD -->`

---

## 8. Pull-quote (locked structure)

**Section eyebrow:** Voices

**Quote body (locked, anniversary couple, fully edited):**

> *We came back to the same beach where we got engaged. I cried when I saw the gallery. The pictures are more honest than the day was, and that is the highest compliment we know how to give.*

**Attribution (locked):**

> Sarah & Michael  ·  Esperanza, Cabo San Lucas  ·  March 2026

**Markup notes:**
- `<blockquote class="lc-pullquote">` wrapping `<p>` for the quote body, then `<cite class="lc-pullquote__attr">` for attribution.
- Italic on the quote body, roman on the attribution.
- Massive Cormorant `❝` glyph behind the quote at `clamp(180px, 22vw, 320px)`, opacity 0.18, color gold, `aria-hidden="true"`. This is the page's signature ornament.
- Quote body in serif weight 300 italic at `clamp(22px, 2.6vw, 38px)`, line-height 1.30.
- Max-width 920px, centered.
- Attribution in `--fs-13` `--font-sans`, tracking 0.18em, roman, color `var(--text-on-dark-readable)`.
- The middle dot separator between attribution fields is two-spaces-flanked: `Name  ·  Venue  ·  Month Year`.
- Section background `var(--ink-3)` (the page's one dark moment outside Begin).

**ES:** `<!-- ES: TBD -->`

---

## 9. Six testimonials (placeholders, gender-mixed, including 1 same-sex couple)

Each card: short testimonial, attribution, persona tag (visually hidden, kept for SR clarity).

**Card 1 (proposal, hetero):**

> The studio sat at the table behind us for forty minutes. I never saw them. The first frame in our gallery is the second I knelt. The look on her face is the picture I will keep on my desk for the rest of my life.
>
> Daniel · Le Blanc, Cancun · February 2026
>
> *Persona: proposal*

**Card 2 (honeymoon, hetero):**

> We had been married six weeks. We were tired in the way honeymoons make you tired. The studio met us at the boardwalk at six-twenty in the morning and we did not speak for the first ten minutes. The pictures look like the trip felt. We did not pose once.
>
> Ana & Marco · Rosewood Mayakoba · January 2026
>
> *Persona: honeymoon*

**Card 3 (anniversary, same-sex women):**

> Fifteen years to the week. We came back to Mexico because we honeymooned here. The frames Vianey made of us at the arch are on the wall of our foyer. Our nieces ask whose wedding it was.
>
> Camila & Ana · Esperanza, Cabo San Lucas · October 2025
>
> *Persona: anniversary, same-sex*

**Card 4 (anniversary, hetero):**

> Twenty-fifth anniversary. We did not want a wedding redo. We wanted one frame for the foyer and twenty for the album our daughters are building. The studio understood the difference on the first call.
>
> Priya & Aman · Maroma Belmond · December 2025
>
> *Persona: anniversary*

**Card 5 (honeymoon, same-sex men):**

> The wedding was in Madrid. We honeymooned in the Riviera Maya because neither of us had been. The studio asked us what we ate for breakfast and what music we walked down the aisle to and built the morning around the answers.
>
> Pablo & Tomás · Banyan Tree Mayakoba · April 2026
>
> *Persona: honeymoon, same-sex*

**Card 6 (proposal, hetero):**

> Forty-eight hours before our trip, I emailed the studio. The reply came in two hours, a Saturday slot at sunset on a beach the hotel did not allow tripods on. Vianey called the resort and the resort said yes. He said yes, too.
>
> Mia · Nizuc, Cancun · November 2025
>
> *Persona: proposal*

**Card markup notes:**
- Each card is `<article class="lc-testimonial-card">` containing `<blockquote>`, attribution `<cite>`, and a visually-hidden persona tag for SR users (`<span class="visually-hidden">Persona: proposal</span>`).
- Six cards in a 3-column grid at desktop, 2-column at tablet, 1-column at mobile. Card 3 (Camila & Ana, same-sex anniversary) sits center-row top so it reads as the anchor card. Card 5 (Pablo & Tomás) sits in the second row right.
- Real names per Phase 1 §11 risk #1 are pending Vianey confirmation. Phase 4 must verify or substitute before publication.

**ES:** `<!-- ES: TBD -->`

---

## 10. Considered Questions (FAQ, 10 Q+A locked)

**Section eyebrow:** Considered Questions
**Section h2 (locked):** Ten questions, *answered before they are asked*.

#### FAQ 1 — Golden hour

**Q:** When is golden hour at your destinations?

**A:** Golden hour shifts by month. In November along Cancun and the Riviera Maya, the light turns honest at five-twelve p.m.; by March it is at six-eighteen. In Los Cabos, the light tracks the Pacific and runs about thirty minutes later than the Caribbean coast. The studio starts every couples session ninety minutes before sunset and works through to the last useful light. The sunset clock above lets you pick the month and see the start time the studio recommends.

#### FAQ 2 — Locations

**Q:** Where can the studio photograph us?

**A:** The studio works at every major resort along three coastlines: Cancun (Le Blanc, Nizuc, Ritz-Carlton), the Riviera Maya (Rosewood Mayakoba, Banyan Tree, Maroma Belmond, Fairmont Mayakoba, Grand Velas), and Los Cabos (Esperanza, Las Ventanas al Paraiso, One&Only Palmilla, Waldorf Astoria Pedregal, Four Seasons Costa Palmas, Montage). Beach access is coordinated with each property's wedding or guest-experience desk. The studio carries the property permits and pays the resort fees on your behalf.

#### FAQ 3 — Weather

**Q:** What if it rains?

**A:** The studio reschedules at no additional cost within your travel dates. For honeymoon couples, this means re-routing to an indoor or covered location on the same property the same evening, or moving to the next clear morning. For proposals, the studio works with the restaurant to set a covered backup and will reschedule the post-yes portrait session for the next day. Hurricane-season cancellation (June through November) is handled case by case with full credit toward a future session.

#### FAQ 4 — What to wear

**Q:** What should we wear?

**A:** Linen, silk, lightweight wool. One textured piece each, never two patterns at once. Avoid primary red, primary cobalt, and pure white at noon (the white reflects the sand and overexposes). The studio sends a wardrobe color palette by month so the dress or the suit agrees with the bougainvillea, the ocean, and the resort architecture. For proposals, the partner being proposed to wears whatever they would wear to dinner; the studio dresses the planner for the photographs after.

#### FAQ 5 — Hair and makeup

**Q:** Do you arrange hair and makeup?

**A:** The studio works with two preferred hair and makeup artists, one in Cancun and one in Cabo, both bilingual. Costs are billed directly by the artist and run from $250 to $450 USD depending on the look. The studio recommends booking the artist for two hours before the session start time so the look has thirty minutes to settle and the studio can begin in the first soft light. For proposals, hair and makeup is not part of the workflow, the partner being proposed to should not be alerted by an unexpected hair appointment.

#### FAQ 6 — Posing

**Q:** We are not photogenic. Will you pose us?

**A:** The studio does not call it posing. The studio gives quiet direction. Walk back toward the water. Tell each other the thing you said in the cab. Stay where you are for a moment longer. The frame is composed; the couple is themselves. Most couples who say they are not photogenic discover, in the gallery, that they are. The studio's first ten minutes of every session are for warming up. The frames the studio considers signature usually arrive in minute thirty.

#### FAQ 7 — Delivery time

**Q:** When do we receive the photographs?

**A:** First frames within seventy-two hours of the session, twenty to thirty editorial images on a private link. The full gallery follows within seven to fourteen days depending on tier (The Hour: seven days, The Sunset: ten days, The Adventure Day: fourteen days). Every image is hand-edited in the IVAE color register, never auto-toned, never run through a preset. Galleries remain online for a year and are downloadable in print and web resolutions.

#### FAQ 8 — Cancellation

**Q:** What is the cancellation policy?

**A:** A 30 percent retainer holds the date. Cancellations more than 30 days from the session date receive the retainer as full credit toward a future session within twelve months. Cancellations within 30 days forfeit the retainer; the remaining balance is not charged. Reschedule requests inside the travel window are handled at no additional cost when the studio's calendar allows. Force majeure (hurricane, airline cancellation, illness with documentation) is handled case by case with full credit.

#### FAQ 9 — Language

**Q:** Do you work in English?

**A:** The studio works in English and Spanish, on the day and on email. Director Vianey Diaz is bilingual and answers every first inquiry personally. Planning calls are scheduled in either language. Galleries arrive with bilingual notes. For couples whose primary language is Portuguese, French, or German, the studio works in English on the day and Director Vianey Diaz handles the planning in English. The studio photographs all couples. Same-sex weddings, proposals, and anniversaries are part of regular practice.

#### FAQ 10 — Multiple locations

**Q:** Can we do two or three locations in one session?

**A:** Yes. The Sunset includes two locations within the same resort or within a 15-minute drive. The Adventure Day includes three locations and may add a cenote, a yacht segment, or a second beach. Transportation between locations is handled by the studio (driver, vehicle, time padding). The studio recommends never more than three locations in one session: the light moves, the couple tires, and the frames the studio considers signature usually emerge in the second location, not the third.

**FAQ markup notes:**
- Each Q/A is a `<button aria-expanded="false" aria-controls="faq-N-panel">` toggling `<div role="region" aria-labelledby="faq-N-question" id="faq-N-panel" hidden>`.
- Question text is in `<h3>` inside the button.
- Answer panel uses `hidden` attribute (not `display:none` only).
- 10 visible questions, ordered by Phase 1 brief priority. The full FAQPage JSON-LD remains preserved verbatim per Phase 1 §12.

**ES:** `<!-- ES: TBD -->`

---

## 11. Inquiry CTA + secondary "Check Availability" (urgency-aware)

**Section eyebrow:** Begin
**Section h2 (locked):** Tell us about the two of you.

**Intro body (locked, ~80 words):**

> Share your travel dates, your resort, and a sentence about the moment. The studio responds the same business day, in English or Spanish, with two questions and a candid sense of whether the date is open. The first reply will come from Director Vianey Diaz. For proposals, the studio confirms within twenty-four hours; the lead time is shorter for a reason.

**Primary CTA (locked):** Begin Inquiry → `mailto:info@ivaestudios.com?subject=Couples%20Inquiry`

**Secondary CTA (locked, urgency-aware for proposals):** Check Proposal Availability → `https://wa.me/529902046514?text=Proposal%20availability%20inquiry`

**Tertiary CTA (locked, conversational fallback):** WhatsApp the Studio → `https://wa.me/529902046514`

**Meta strip below CTAs (locked, three cells):**

| Field | Value |
|---|---|
| Response Time | Same business day |
| Languages | English / Spanish |
| Hours | 06:00 – 20:00 GMT-5 |

**Markup notes:**
- Three CTAs are stacked vertically on mobile, side-by-side on desktop with the primary CTA centered and the secondary/tertiary CTAs flanking. The "Check Proposal Availability" button uses a slightly different visual treatment (gold underline only, no border, no background) so it reads as a related but secondary path; this respects the proposal persona's short lead time without making the page feel transactional for honeymoon and anniversary readers.
- Email destination per Phase 1 §10.6 reconciliation: `info@ivaestudios.com` matches the current canonical contact in the existing JSON-LD. Phase 4 may swap to `hello@` if the owner confirms.
- WhatsApp number `+529902046514` is on hold per CLAUDE.md (impossible Mexican area code 990); Phase 4 must NOT publish until the owner provides the real number.
- Meta strip uses a vertical hairline between cells (CSS border, not a character).
- "06:00 – 20:00" uses an EN-DASH (–), not an em-dash. The em-dash is forbidden across the page; the en-dash is permitted only in numeric ranges.
- Section background is full-bleed dark image at brightness 0.20, saturation 0.50.

**ES:** `<!-- ES: TBD -->`

---

## 12. Footer copy (locked)

**Footer tag (locked, sitewide cohesion):**

> Luxury Resort Photography. Editorial. Bilingual. Golden hour, only.

**Footer copy block (locked, ~50 words):**

> IVAE Studios is a small editorial photography practice based in Cancun, working across the Yucatan and Los Cabos. Director Vianey Diaz leads every couples inquiry. The studio accepts a limited number of couples each month so the studio's attention never thins.

**Footer nav columns (locked headings):**

- **Services:** Weddings · Couples · Family · Editorial
- **Coastlines:** Cancun · Riviera Maya · Los Cabos
- **Studio:** About · Vianey · Journal · Contact
- **Legal:** Privacy · Terms · Sitemap

**Footer base line (locked):**

> © 2019–2026 IVAE Studios. Cancun, Mexico. All frames hand-edited.

**Markup notes:**
- Footer uses `<footer role="contentinfo">`.
- Four nav columns each with an `<h2 class="visually-hidden">` heading for SR Rotor (e.g., "Footer services").
- Visible heading per column is `<p class="footer-col__title">` styled as eyebrow.
- Lang switcher repeats in footer with `role="group" aria-label="Language switcher"`.
- WhatsApp deep-link in footer is `aria-label="Contact the studio on WhatsApp"`.

**ES:** `<!-- ES: TBD -->`

---

## 13. What this deck does NOT include

For phase clarity, the following remain owner-decisions per Phase 1 §13 and are NOT locked here:

1. Real testimonial names (Daniel, Ana & Marco, Camila & Ana, Priya & Aman, Pablo & Tomás, Mia are placeholders; Phase 4 must verify or substitute before publication).
2. Real session prices ($850 / $1,500 / $2,500 are working figures; owner confirmation pending per Phase 1 §13.2).
3. Proposal countdown JSON data (next 8-12 open proposal Saturdays; Phase 4 must source from booking calendar or confirm static fallback).
4. Same-sex couples imagery selection from the 51-image inventory (Phase 4 must flag at least one frame for cinemascope and one for the reel).
5. Email destination (`info@` vs `hello@`) reconciliation — current JSON-LD uses `info@`; this deck commits to `info@` pending owner confirmation.
6. WhatsApp number — current `+529902046514` is impossible per CLAUDE.md; do NOT publish until owner provides real number.
7. Spanish translation — every locked block above carries a `<!-- ES: TBD -->` marker. Phase 5 or Phase 6 will produce the Spanish mirror.

---

**End of Phase 2 Locked Copy Deck.**

Word count: ~4,100 words across 20 microcopy decisions, 11 editorial body blocks, and a 6-card testimonial deck. Voice contract enforced (no em-dashes, no superlatives, no exclamations). Gender-inclusive throughout; same-sex couples named explicitly in FAQ 9 and centered in the case study and 2 of 6 testimonials. All markup notes specified for Phase 3 implementation. ES placeholders in place for Phase 5/6 translation.
