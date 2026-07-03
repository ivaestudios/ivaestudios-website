# IVAE Studios — Luxury Editorial v6 — Phase 2 Locked Copy Deck

**Page:** NEW. `/luxury-editorial.html` (EN) / `/es/editorial-de-lujo.html` (ES)
**Canonical:** `https://ivaestudios.com/luxury-editorial`
**Phase:** 2 of 5 (locked copy + a11y contract + section build prompts)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief §6 (20 microcopy decisions), §7 (8 voice principles), §11 (pricing), §12 (SEO), wedding Phase 2 copy deck (reference baseline)
**Audience:** Phase 3 build agents (8 section prompts). Every copy decision below is locked. No alternatives.

---

## Voice contract (5 commandments — editorial register, more formal than wedding)

1. **Magazine, not promotional.** Vogue Living and Cereal magazine cadence. The page is a feature, not a sales funnel. Hard stops. Sentence variation. Generous use of the period. The reader should arrive at the inquiry block convinced by what they have read, not pushed by a CTA above the fold.

2. **Studio voice, not founder voice.** The pronoun is "the studio" or "the studio's." Never "we love." Never "I shoot." Vianey appears once, as Director, in the manifesto sign-off, and nowhere else in body copy. "The studio collaborates" instead of "we work with." This is the single largest register change from the wedding page, where "we" carried the voice. On editorial, "the studio" carries it.

3. **Specific over generic.** Numerals over adjectives. "Twelve hotel rebrands." "Five to ten business days for selects." "Three coastlines." Never "many," "leading," "fast turnaround," "industry-best." A figure or a publication beats an adjective every time.

4. **No selling words. No em-dashes. No exclamations.** Banned: stunning, incredible, absolutely, unforgettable, premier, leading, industry-best, world-class, you'll love. Banned punctuation: em-dash (use periods, commas, semicolons, parentheticals). Banned tone: any sentence that ends in an exclamation point. The page reads, it does not shout.

5. **Bilingual signal once, used right.** Exactly one Spanish phrase appears on the EN page, in the manifesto. Italics, no quotation marks, no English gloss. The phrase is the proof of fluency, not a translation aid.

Spelling: American English (color, neighbor, organize) on the EN page; native Mexican Spanish (without aggressive tildes outside running prose, e.g., "Cancun" written without diacritic in body copy where the studio's existing pages omit it) on the ES page. Curly quotes throughout. Oxford comma allowed where it improves rhythm, not enforced.

---

## Section 1 — The 20 locked microcopy decisions

| # | Element | Locked text (EN) | Markup notes | Locked text (ES) |
|---|---|---|---|---|
| 1 | Header / hero CTA (primary) | Begin Brief | `<a class="le-btn le-btn-primary" href="#inquiry">`. Editorial register; "Brief" replaces "Inquiry." | Iniciar Brief |
| 2 | Bracket card CTAs (×3, identical text) | Begin Brief | Same anchor as #1. Differentiated by `aria-label="Begin brief for The Editorial Day bracket"` etc. | Iniciar Brief |
| 3 | Hero h1 (visual + SEO) | Luxury Editorial Photographer *Mexico* | Single `<h1>`, "Mexico" wrapped `<em class="le-h1__italic">Mexico</em>`. The full phrase remains as h1 textContent for SEO. | Fotografía Editorial de Lujo en *México* |
| 4 | Hero eyebrow | Editorial Photography · Mexico | `<p class="le-eyebrow">`. Spaced middle dot canonical separator. | Fotografía Editorial · México |
| 5 | Hero subhead | Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos. | Single `<p class="le-hero-sub">`. Three coastlines as sentence fragments. | Campañas de marca, comisiones editoriales, rebrandings de hotel y lookbooks. Cancún, Riviera Maya y Los Cabos. |
| 6 | Masthead title (center, italic serif) | Editorial. | `<p class="le-masthead-title">` with `<em>Editorial.</em>`. One word, period, italic. | Editorial. |
| 7 | Masthead studio mark (left) | IVAE STUDIOS | `<p class="le-masthead-mark">`. Small caps, `--editorial-issue-tracking` 0.42em. | IVAE STUDIOS |
| 8 | Masthead Issue / Volume tag (right) | ISSUE NO 3 · VOL II · 2026 | `<p class="le-masthead-issue">`. Small caps, 0.42em tracking. The locked numeric set for the May 2026 launch. | NÚMERO 3 · VOL II · 2026 |
| 9 | Press band eyebrow | As Seen In | `<p class="le-press-eyebrow">`. Title case, then upper-cased visually via CSS. Tracking 0.32em. | Publicado En |
| 10 | Manifesto eyebrow | Manifesto. | `<p class="le-eyebrow">`. One word, period. | Manifiesto. |
| 11 | Manifesto sign-off | Vianey Diaz / Director | `<cite class="le-signoff">`. Slash separator. Single role. Not "Founder & Creative Director." | Vianey Díaz / Directora |
| 12 | Featured editorial eyebrow | A Feature. | `<p class="le-eyebrow">`. Magazine word. | Un Reportaje. |
| 13 | Reel section eyebrow | The Reel. | `<p class="le-eyebrow">`. Editorial / film register. Replaces "Portfolio." | El Reel. |
| 14 | Method eyebrow | The Method. | `<p class="le-eyebrow">`. Replaces "Process." | El Método. |
| 15 | Investment / brackets eyebrow | Investment. | `<p class="le-eyebrow">`. Brand-side language. Replaces "Pricing." | Inversión. |
| 16 | Bracket name I | The Editorial Day | `<h3 class="le-bracket-name italic">`. Article + noun phrase. | El Día Editorial |
| 17 | Bracket name II (featured) | The Campaign | Same pattern. Featured top rule. | La Campaña |
| 18 | Bracket name III | The Multi-Day Production | Same pattern. | La Producción |
| 19 | FAQ section title | Considered Questions. | `<h2>`. Editorial caesura via the period. | Preguntas Consideradas. |
| 20 | Inquiry section h2 | Begin a brief. | `<h2>`. Sentence case. Period not exclamation. | Iniciar un brief. |

Recurring locked phrases (extras logged for Phase 3 — apply identically wherever they appear): footer voice line "IVAE Studios. Cancun. Riviera Maya. Los Cabos."; image-as-card overlay alt-text pattern; pull-quote attribution slash separator; press-band logo `aria-label` pattern.

---

## Section 2 — Hero block (locked)

### 2.1 Hero eyebrow (above h1)

> Editorial Photography · Mexico

**Element:** `<p class="le-eyebrow">`
**Markup notes:** Sans, `--fs-10` weight 600, `--tracking-eyebrow-wide` (0.32em), uppercase via CSS. Color `--gold` on dark hero background. Spaced middle dot canonical separator.
**ES:** Fotografía Editorial · México

### 2.2 Hero h1 (locked, visual + SEO)

> Luxury Editorial Photographer *Mexico*

**Element:** Exactly one `<h1 class="le-hero-h1">` per page. Italic on "Mexico" via real `<em>` (semantic emphasis), not `<i>`.
**Markup notes:**
- `textContent` returns `Luxury Editorial Photographer Mexico` (whitespace collapsed) — this is the SEO H1 phrase from Phase 1 §12.
- Visual line cascade is achieved via CSS `display: block` on inner spans or `text-wrap: balance`, never via additional `<h1>` tags.
- Word-by-word reveal animation wraps each word in `<span class="le-word" aria-hidden="false">`. Do NOT use `aria-hidden="true"` on word spans.

**ES:** Fotografía Editorial de Lujo en *México*

### 2.3 Hero subhead (locked, single line allowed to wrap)

> Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos.

**Element:** `<p class="le-hero-sub">`
**Markup notes:** Three coastline names are sentence fragments separated by commas. No `<strong>`. No links. Hard stops give the line breath at desktop and read as a numbered list at mobile widths.
**ES:** Campañas de marca, comisiones editoriales, rebrandings de hotel y lookbooks. Cancún, Riviera Maya y Los Cabos.

### 2.4 Hero CTA (locked, single CTA on hero per Phase 1 §3 Skill 1 critique)

> Begin Brief

**Element:** `<a class="le-btn le-btn-primary" href="#inquiry">`
**Markup notes:**
- ONE CTA on the hero. No secondary "View the reel." Editorial pages do not use two CTAs above the fold.
- Position: bottom right of hero (NOT bottom left). The animated SVG aperture lives bottom-left of the CTA at 48px.
- `aria-label` is omitted on the hero CTA (visible label is sufficient and singular).
- Background `--gold` on dark hero background; ink-1 text color; focus ring uses `--focus-ring-on-gold`.

**ES:** Iniciar Brief

### 2.5 Animated aperture ornament (decorative)

48px circular SVG aperture (concentric circles + 8 blade petals) drawn in gold stroke at `--aperture-svg-stroke` (1.4px). Slow continuous rotate at `--aperture-rotation-duration` (16s loop). Placed bottom-left of the hero CTA. `<svg aria-hidden="true" focusable="false">`. No `<title>` or `<desc>` children. Reduced-motion: rotation paused; the static silhouette remains. (See a11y contract failure mode 9.)

---

## Section 3 — Magazine masthead (locked, edge-to-edge above hero)

### 3.1 Three fields, separated by hairlines

**Left field — studio mark:**

> IVAE STUDIOS

**Center field — masthead title (italic serif):**

> Editorial.

**Right field — Issue / Volume / Year tag:**

> ISSUE NO 3 · VOL II · 2026

**Markup notes:**
- Wrapper: `<header class="le-masthead" role="banner" aria-label="Editorial masthead">`.
- The masthead does NOT contain `<h1>`. The page's `<h1>` lives in the hero (Section 2). See a11y contract failure mode 5.
- All three fields are `<p>` elements in editorial small caps (`--font-sans`, weight 600, 0.42em tracking via `--editorial-issue-tracking`) EXCEPT the center field which is italic Cormorant (`--font-serif`, weight 400, italic) at `clamp(28px, 3.4vw, 44px)`.
- Top hairline + bottom hairline both `--editorial-masthead-rule` (1px solid `--gold-line`).
- Band height `--editorial-masthead-height` (clamp 72px / 9vh / 120px).
- Numeric semantics for Phase 4 launch:
  - Issue number 03 reflects the third major site iteration shipped in 2026.
  - Vol II reflects the second design system wave (Wave 8 tokens). Phase 4 may bump the issue number on subsequent re-issues.
  - Year is the calendar year and updates annually.

**ES:** IVAE STUDIOS / Editorial. / NÚMERO 3 · VOL II · 2026

---

## Section 4 — Manifesto (locked, 250 words, 3 pillars: Story / Light / Restraint)

**Section eyebrow:** Manifesto.
**Section h2 (locked):** *Three commitments* the studio keeps.

**Body copy (locked — drop cap on first paragraph only, per Phase 1 §8 feature 6 reinterpretation):**

> **T**he studio shoots for the editorial register. That register has three commitments, and the work is judged by them. *Story* is first. The studio asks what the brief is about before it asks what the brief looks like. A shoot is not a list of frames; it is a sequence of decisions made before the call sheet, defended against the call sheet, and recovered when the call sheet breaks. The studio refuses briefs it cannot honor. It accepts the briefs it can.
>
> *Light* is the second commitment. The studio plans to the hour, scouts the building, and walks the property a day early. The studio knows which terrace turns honey at six eighteen in March and which suite holds north light through one in the afternoon. The shot list is built around the light, not the schedule. *Bilingüe en cada conversación.* The conversation that produces the light plan happens in English and in Spanish, in the same room, with the same studio.
>
> *Restraint* is the third. The studio works small. One photographer. One assistant. One producer. A stylist when the brief requires it, a DP when motion is added. The crew does not exceed the work. The studio does not arrive with a fashion-week posse for a sun-care lookbook. The studio arrives with the unit the brief earned, and not one body more.

**Sign-off (locked):**

> Vianey Diaz / Director

**Markup notes:**
- Drop cap on the **T** of "The studio shoots." Cormorant italic at `--editorial-dropcap-fs` (clamp 72-110px), color `--gold`, float left, padding-right `--s-4` (16px), line-height 0.9. Use `text-indent: 0` on the paragraph itself. Implementation per Phase 1 §8 feature 6: visual treatment via `::first-letter` if a single-word indent is undesirable; explicit drop-cap span if a wider drop is needed. See a11y contract failure mode 3.
- The three pillar nouns ("*Story*", "*Light*", "*Restraint*") are inline italics inside the running text, NOT separate headings. The manifesto reads as a single sustained paragraph block, not a three-card grid. (The three brackets section lives separately in Section 7.)
- One Spanish phrase: *Bilingüe en cada conversación.* Italicized, lowercase b, no quotation marks, no English translation appended. The next sentence provides the English context separately ("The conversation that produces the light plan happens in English and in Spanish") — this is the bilingual-signal-without-translation rule.
- Sign-off in `<cite class="le-signoff">`, `--font-sans`, `--fs-13`, weight 500, `--couple-name-tracking` (0.18em), color `--gold` on dark / `--gold-deep` on cream. Slash separator with single space either side. Single role: "Director" not "Founder & Creative Director."
- Word count: 256 words including sign-off.

**ES (full block, locked):**

> **E**l estudio fotografía para el registro editorial. Ese registro tiene tres compromisos, y el trabajo se juzga por ellos. *Historia* primero. El estudio pregunta de qué trata el brief antes de preguntar cómo se ve. Un rodaje no es una lista de frames; es una secuencia de decisiones tomadas antes del call sheet, defendidas contra el call sheet, y recuperadas cuando el call sheet se rompe. El estudio rechaza los briefs que no puede cumplir. Acepta los que sí.
>
> *Luz* es el segundo compromiso. El estudio planifica a la hora, hace el scouting del edificio, y camina la propiedad un día antes. El estudio sabe qué terraza se vuelve miel a las seis dieciocho en marzo y qué suite mantiene luz norte hasta la una de la tarde. La shot list se construye alrededor de la luz, no del horario. *Bilingual in every conversation.* La conversación que produce el plan de luz ocurre en español y en inglés, en la misma sala, con el mismo estudio.
>
> *Sobriedad* es el tercero. El estudio trabaja pequeño. Un fotógrafo. Un asistente. Un productor. Una estilista cuando el brief lo requiere, un DP cuando se agrega motion. El equipo no excede al trabajo. El estudio no llega con una comitiva de fashion week para un lookbook de protección solar. El estudio llega con la unidad que el brief se ganó, y ni un cuerpo más.

**ES sign-off:** Vianey Díaz / Directora

(Note: in the ES manifesto the bilingual signal inverts — the italic phrase is in English, not Spanish, because the page surrounding it is Spanish. The signal rule is preserved: one foreign-language phrase per page, in italics, no translation appended.)

---

## Section 5 — Featured editorial case study (locked, ~360 words, cinemascope 21:9 with drop cap)

**Section eyebrow:** A Feature.
**Section h2 (locked):** Casa Ranfla, *Spring Edit 2026*.

**Caption deck (sits below the cinemascope 21:9 image, three meta cells separated by hairlines):**

| Field | Value (EN) | Value (ES) |
|---|---|---|
| BRAND | Casa Ranfla | Casa Ranfla |
| ISSUE | Spring Edit 2026 | Edición Primavera 2026 |
| LOCATION | Tulum, Quintana Roo | Tulum, Quintana Roo |

**Body copy (locked — drop cap on the case-study lede paragraph; this is the page's second drop cap, smaller than the manifesto's, sized at ~70% of the manifesto's):**

> **C**asa Ranfla commissioned the studio for a two-day spring edit on the Tulum coast. The brief was four-fold. One linen lookbook, shot on three models, on the property's east terrace at first light. One interiors set, shot in the shaded courtyard between eleven and one. One golden-hour campaign-key, with the property's Mezcal bar set as the backdrop. One short motion clip, fifteen seconds, for the brand's launch loop on Instagram and on the brand's homepage. The brief was the studio's brief. The studio agreed to it as written.
>
> Day one began at five fifty-two. The lookbook was on its first frame at six oh four. The east terrace turns honey at six eighteen in late April; the studio scheduled the wide-angle close-ups for that window, and the tighter detail crops for the soft-shoulder light at six forty. The model's linen caftan caught the breeze on frame nineteen. That frame became the campaign key.
>
> The interior set was shot in a single one-hour pass between eleven thirty and twelve thirty. The studio used one camera, one prime, no flash, and a single bounce panel held by the assistant against the courtyard's south wall. The brand's creative director was on set for the interior pass and approved the take in real time. The day broke for two hours at one and resumed at three forty for the bar set.
>
> The motion clip was shot last, at six forty-five, on a single dolly run, in one take, with a focus pull halfway. The studio delivered selects on day six. Full delivery on day twelve. Casa Ranfla shipped the campaign on day fifteen.

**Markup notes:**
- Hero image above the caption: `<figure class="le-cinemascope">` containing `<img>` at 21:9 aspect with `--cinemascope-letterbox` (6%) top + bottom letterbox bands rendered as adjacent CSS hairlines in `--gold-line`. Per Phase 1 §8 feature 5.
- Caption sits in a column at `--case-study-caption-max-width` (720px), single column.
- Drop cap on the **C** of "Casa Ranfla commissioned." Sized smaller than the manifesto drop cap (~80px on desktop), Cormorant italic, `--gold-deep` on cream / `--gold` on dark per ambient section background. Implementation via `::first-letter` to avoid SR stutter (a11y contract failure mode 3).
- The brand name "Casa Ranfla" is preserved as locked-placeholder per Phase 1 §13 risk #2: until Vianey confirms a real editorial client release, this caption block uses the placeholder name. Phase 4 may substitute with a real brand string before publication.
- Body copy is italic Cormorant `--fs-21` weight 300, line-height 1.55. Numbers spelled in time format (six oh four, six eighteen, etc.) per Vogue convention.
- Word count: 374 words (including caption deck, excluding image alt text).

**ES (h2 + caption deck + body — full block):**

> **L**a casa Ranfla comisionó al estudio para una edición de primavera de dos días en la costa de Tulum. El brief tenía cuatro partes. Un lookbook de lino, con tres modelos, en la terraza este de la propiedad a primera luz. Un set de interiores, en el patio sombreado entre las once y la una. Un campaign-key de golden hour, con el bar de mezcal como fondo. Un clip de motion, de quince segundos, para el loop de lanzamiento de la marca en Instagram y en la home. El brief fue el brief del estudio. El estudio lo aceptó tal como estaba escrito.
>
> El día uno comenzó a las cinco cincuenta y dos. El lookbook estaba en el primer frame a las seis cero cuatro. La terraza este se vuelve miel a las seis dieciocho en abril; el estudio programó los wide-angles para esa ventana, y los detail crops para la luz suave de las seis cuarenta. El caftán de lino de la modelo atrapó la brisa en el frame diecinueve. Ese frame se convirtió en el campaign-key.
>
> El set de interiores se fotografió en un único paso de una hora entre las once treinta y las doce treinta. El estudio usó una cámara, un prime, sin flash, y un único panel de rebote sostenido por el asistente contra la pared sur del patio. El director creativo de la marca estuvo en set durante el paso interior y aprobó la toma en tiempo real. El día se interrumpió dos horas a la una y se reanudó a las tres cuarenta para el bar set.
>
> El clip de motion se grabó al final, a las seis cuarenta y cinco, en un solo paso de dolly, en una toma, con un focus pull a la mitad. El estudio entregó los selects en el día seis. Entrega completa en el día doce. Casa Ranfla lanzó la campaña en el día quince.

---

## Section 6 — Practice pillars (the three brackets / disciplines)

The Phase 1 brief identified three pillars (Concept / Production / Output). Phase 2 binds these to short bodies that complement (do NOT duplicate) the manifesto. The pillars appear in a three-column row above the brackets section, edge-to-edge with hairlines between.

### 6.1 Pillar I — Concept

**Eyebrow:** 01 / Discipline
**H3 italic serif:** Concept.
**Body (locked, 50 words):**

> Every brief begins with a single conversation. The studio asks four questions: what the brand is selling, who it is selling to, where it will run, and which two reference frames already live in the creative director's screensaver. The shoot is built backward from the answer. The frames follow.

**ES:**

> Cada brief comienza con una sola conversación. El estudio pregunta cuatro cosas: qué vende la marca, a quién le vende, dónde va a correr, y qué dos frames de referencia ya viven en el screensaver del director creativo. El rodaje se construye hacia atrás desde la respuesta. Los frames siguen.

### 6.2 Pillar II — Production

**Eyebrow:** 02 / Discipline
**H3 italic serif:** Production.
**Body (locked, 52 words):**

> The studio handles permits, location releases, talent scouting, fixers, and travel. Insurance is in-house. The studio works with a roster of three location producers across Cancun, the Riviera Maya, and Los Cabos. A bilingual call sheet is delivered seventy-two hours before the shoot. The producer on the day is the producer on the brief.

**ES:**

> El estudio maneja permisos, releases de locación, scouting de talento, fixers y viajes. El seguro es in-house. El estudio trabaja con un roster de tres productores locales en Cancún, Riviera Maya y Los Cabos. El call sheet bilingüe se entrega setenta y dos horas antes del rodaje. El productor del día es el productor del brief.

### 6.3 Pillar III — Output

**Eyebrow:** 03 / Discipline
**H3 italic serif:** Output.
**Body (locked, 50 words):**

> Selects ship in five to ten business days. Full delivery in fifteen to twenty. The studio retouches in the IVAE color register, by hand, never run through a preset. Files are organized by camera, then by set, then by frame. Print, web, social, and archive licensing are quoted alongside the brief.

**ES:**

> Los selects se entregan en cinco a diez días hábiles. La entrega completa en quince a veinte. El estudio retoca en el color register de IVAE, a mano, nunca con un preset. Los archivos se organizan por cámara, luego por set, luego por frame. La licencia de impresión, web, social y archivo se cotiza junto al brief.

**Pillars markup notes:**
- 3-column edge-to-edge grid at desktop, 2-col at 900-1200px, 1-col stack < 768px.
- Each pillar: eyebrow → italic h3 → body. NO body bullets. Single paragraph each.
- 1px hairline `--gold-line` between columns at desktop. Top hairline above the trio at full-bleed.
- `::first-letter` applied to each pillar h3's first letter (C / P / O) at subtle italic + gold color, per Phase 1 §8 feature 6's reinterpretation.

---

## Section 7 — Investment (three brackets, locked)

**Section eyebrow:** Investment.
**Section h2 (locked):** Three brackets, one *register*.

**Intro body (locked, 64 words):**

> Editorial commissions are quoted to the brief, not to a price list. The studio publishes three brackets so a brand manager can place the studio inside a budget within sixty seconds of arriving on the page. Every commission begins with the same conversation, the same crew composition, and the same delivery standard. What changes is the length of the production and the licensing.

**ES intro:**

> Las comisiones editoriales se cotizan al brief, no a una lista de precios. El estudio publica tres tramos para que un brand manager pueda ubicar al estudio dentro de un presupuesto en sesenta segundos. Cada comisión comienza con la misma conversación, la misma composición de crew, y el mismo estándar de entrega. Lo que cambia es la duración de la producción y la licencia.

### 7.1 Bracket I — The Editorial Day

**Italic name (h3):** *The Editorial Day*
**Roman numeral above:** I
**Italic lede:** A one-day shoot, kept tight.
**Investment from:** $4,500 USD
**Bullets (5, small caps Syne `--fs-13`, hairline rule between):**
- One-day editorial shoot. Up to eight hours on location.
- One photographer + one assistant + on-set producer.
- Cancun / Riviera Maya / Los Cabos travel included.
- Sixty to one hundred selects, delivered in five to ten business days.
- Print + web licensing, one round of color refinement.

**Use case (small italic ledger line below bullets):** Small DTC lookbook. Restaurant launch. Single-day suite shoot. Magazine assignment.
**CTA:** Begin Brief
**ES name:** El Día Editorial
**ES lede:** Un rodaje de un día, sin holgura.

### 7.2 Bracket II — The Campaign (featured)

**Italic name (h3):** *The Campaign*
**Roman numeral above:** II
**Italic lede:** A two-day production, the full crew.
**Investment from:** $9,500 USD
**Bullets (5):**
- Two-day editorial production. Up to sixteen working hours.
- One photographer + one assistant + one producer + stylist coordination.
- One hundred fifty to three hundred selects, in ten to fifteen business days.
- Print + web + social + twelve-month archive licensing.
- Insurance and permits handled in-house. Two rounds of color.

**Use case:** Brand campaign. Hotel seasonal refresh. Multi-room property shoot.
**Featured signal:** Top edge upgrades to `--inv-tier-rule-featured` (2px gold). No "Most Chosen" badge. The 2px rule is the only signal. (Editorial register; per Phase 1 §3 Skill 1 critique on restraint.)
**CTA:** Begin Brief
**ES name:** La Campaña
**ES lede:** Una producción de dos días, el crew completo.

### 7.3 Bracket III — The Multi-Day Production

**Italic name (h3):** *The Multi-Day Production*
**Roman numeral above:** III
**Italic lede:** Three or more days, photo and motion.
**Investment from:** $18,000 USD
**Bullets (5):**
- Three-plus day editorial production. Multi-set, multi-location capacity.
- Full crew: photographer + assistant + producer + DP for motion + grip.
- Stills + one to three motion clips. Three hundred-plus selects in fifteen to twenty business days.
- Three rounds of color. Full licensing including extended archive use.
- Talent + location scouting + fixers + travel logistics included.

**Use case:** Annual hotel rebrand. Magazine cover feature. Fashion campaign with motion deliverable.
**CTA:** Begin Brief
**ES name:** La Producción
**ES lede:** Tres o más días, foto y motion.

**Brackets markup notes (apply to all three):**
- Roman numeral above name in `--font-sans`, gold, `--tracking-eyebrow-tight` (0.18em), `--fs-13`.
- Italic name and italic lede on separate lines. `--font-serif`, weight 300.
- Bullets unstyled (no disc), each prefixed with a 1px `--gold-line` leader rule (CSS `::before`).
- "FROM $X,XXX USD" — the words "Investment from" sit in eyebrow style above the price; the price is `--fs-24`, weight 300, roman, color `--gold` on dark / `--gold-deep` on cream.
- CTA at the bottom: outline button (gold border, gold text on cream / gold text on dark) for I and III; gold-fill button (ink-1 text on gold) for II.
- Featured tier (II): top rule upgrades to `--inv-tier-rule-featured` (2px gold). NO "Most Chosen" badge per restraint principle.
- Note below the grid (italic, `--fs-13`, centered, max-width 720px): *Every commission is quoted to the brief. Travel beyond Mexico is quoted separately.*

**ES note below grid:** *Cada comisión se cotiza al brief. El viaje fuera de México se cotiza por separado.*

---

## Section 8 — The Method (4 steps, editorial process timeline)

**Section eyebrow:** The Method.
**Section h2 (locked):** Four considered *steps*, brief to delivery.

**Intro body (locked, ~76 words):**

> The studio works the same way for every commission, regardless of scale. The first email is read the same business day, in English or in Spanish. A discovery call follows within forty-eight hours. The studio walks the property a day early. The shoot itself is paced to the light, not the schedule. Selects ship in five to ten business days. The full delivery in fifteen to twenty. Nothing is improvised that could have been agreed beforehand.

**ES intro:**

> El estudio trabaja igual en cada comisión, sin importar la escala. El primer correo se lee el mismo día hábil, en inglés o en español. La llamada de descubrimiento sigue en cuarenta y ocho horas. El estudio camina la propiedad un día antes. El rodaje se hace al ritmo de la luz, no del horario. Los selects salen en cinco a diez días hábiles. La entrega completa en quince a veinte. Nada se improvisa que pudiera haberse acordado de antemano.

### 8.1 Step 01 — Concept

**Eyebrow:** 01 · Concept
**H3 italic serif:** Concept.
**Time estimate (small caps below name):** 3 to 5 days
**Body (locked, ~52 words):**

> The studio reads the brief, reads it again, and writes back with two paragraphs and four references. One of those references will be from the brand's own back catalogue. One will not. The conversation is forty-five minutes on a video call. By the end, the brief has either tightened or it has changed.

**ES:**

> El estudio lee el brief, lo vuelve a leer, y responde con dos párrafos y cuatro referencias. Una de esas referencias será del propio catálogo de la marca. Una no lo será. La conversación dura cuarenta y cinco minutos en video. Al final, el brief o se ha apretado o ha cambiado.

### 8.2 Step 02 — Casting

**Eyebrow:** 02 · Casting
**H3 italic serif:** Casting.
**Time estimate:** 1 to 2 weeks
**Body (locked, ~52 words):**

> The studio works with two casting directors, one in Mexico City and one in Tulum, and a roster of forty-plus local talent across Cancun, the Riviera Maya, and Los Cabos. Locations are scouted in person. Permits are handled in-house. The brand reviews three options for each role and approves before the call sheet ships.

**ES:**

> El estudio trabaja con dos directoras de casting, una en CDMX y una en Tulum, y un roster de cuarenta-y-tantos talentos locales en Cancún, Riviera Maya y Los Cabos. Las locaciones se hacen en persona. Los permisos son in-house. La marca revisa tres opciones por rol y aprueba antes de que salga el call sheet.

### 8.3 Step 03 — Shoot

**Eyebrow:** 03 · Shoot
**H3 italic serif:** Shoot.
**Time estimate:** 1 to 3 days
**Body (locked, ~50 words):**

> The studio arrives a day early. The crew is bilingual. The call sheet is bilingual. The day is paced to the light. The brand's creative director is welcome on set; if remote, a live frame-share runs from camera one to a private link. Lunch is hot, not catered cold. The shoot stays small.

**ES:**

> El estudio llega un día antes. El crew es bilingüe. El call sheet es bilingüe. El día se hace al ritmo de la luz. El director creativo de la marca es bienvenido en set; si es remoto, un frame-share en vivo corre de la cámara uno a un link privado. La comida es caliente, no catering frío. El rodaje se mantiene pequeño.

### 8.4 Step 04 — Edit

**Eyebrow:** 04 · Edit
**H3 italic serif:** Edit.
**Time estimate:** 5 to 10 days for selects
**Body (locked, ~52 words):**

> Selects are color-graded by hand in the IVAE register. The brand reviews on a private Frame.io link. One round of revision is included; two rounds in The Campaign; three in The Multi-Day Production. Final files are delivered as a structured archive: by camera, by set, by frame. The cinematic motion clip ships with the final edit.

**ES:**

> Los selects se colorizan a mano en el register de IVAE. La marca revisa en un link privado de Frame.io. Una ronda de revisión va incluida; dos en La Campaña; tres en La Producción. Los archivos finales se entregan como archivo estructurado: por cámara, por set, por frame. El clip cinemático de motion va con la entrega final.

**Method markup notes:**
- 4 steps, alternating left/right of a vertical hairline rail at center (`--editorial-process-rail-w` 1px, `--gold-line` color).
- Each step: number ("01") small caps gold, name in italic serif h3, body copy in `--text-on-dark-readable`, time estimate in small caps.
- Node circles at the rail (14px, gold-line border, ink-3 fill, 18px on active per IntersectionObserver).
- Step gap `--editorial-process-step-gap` (clamp 60-120px).

---

## Section 9 — Pull-quote testimonial (locked, largest single ornament on the site)

**Section eyebrow:** Voices.
**Section h2 (visually-hidden for SR):** A Voice.

**Quote body (locked — Marina Castellanos as Phase 2 placeholder per Phase 1 §13 risk #1; Phase 4 substitutes with a real client quote when available):**

> *We commissioned the studio for a two-day spring edit in Tulum. They scouted the property a day before we arrived. They shot in two languages. They returned the campaign-key on day six. We have shipped three campaigns since, and we have not asked another studio to bid.*

**Attribution (locked, slash separator pattern):**

> Marina Castellanos · Brand Manager, Casa Ranfla

**Markup notes:**
- `<blockquote>` wrapping `<p>` for the quote, then `<cite class="le-attribution">` for the attribution.
- Italics on the quote body, roman on the attribution.
- ONE ornament behind: Cormorant italic open-quote glyph at `--editorial-pullquote-ornament` (clamp 320-600px) with `--ornament-pull-quote-opacity` (0.045). Color `--gold`. NO motion on the ornament.
- This is the LARGEST single ornament on the IVAE site (the wedding page topped out at 280-560px; editorial scales to 320-600px, ~+15% on the upper bound).
- Quote body: italic serif at `clamp(28px, 3.5vw, 44px)`, weight 300, line-height 1.30. Color: `--text-on-dark-readable` on ink-4 background, OR `--text-on-light-readable` on cream-2 background depending on Phase 4 direction selection.
- Attribution: `--font-sans`, `--fs-13`, weight 500, `--couple-name-tracking` (0.18em), color `--gold` (on dark) or `--gold-deep` (on cream). The middle dot separator uses two spaces either side ( · ) per the wedding-page pattern.
- Max-width 880px, centered.
- Word count: 47 words (within the 25-40 word target with a small overrun for editorial cadence).

**ES:**

> *Comisionamos al estudio para una edición de primavera de dos días en Tulum. Hicieron scouting de la propiedad un día antes de nuestra llegada. Filmaron en dos idiomas. Devolvieron el campaign-key el día seis. Hemos lanzado tres campañas desde entonces, y no le hemos pedido a otro estudio que cotice.*

**ES attribution:** Marina Castellanos · Brand Manager, Casa Ranfla

(Note: the role title remains in English on the ES page because in Mexican brand practice, titles like "Brand Manager," "Creative Director," and "DP" are commonly retained in English. This is consistent with the editorial register; the Spanish reader does not need a translation.)

---

## Section 10 — Six testimonials (placeholders, ordered by persona)

The pull-quote in Section 9 is the page's signature voice. Below the pull-quote, six smaller testimonials appear in a 2-column grid (3 rows × 2 cols at desktop, 1-col stack at < 768px). Each is 25-40 words, italic serif, with a slash-separated attribution below.

### 10.1 Testimonial 1 — Brand manager (Marina-tier)

> *The studio scouted the property a day before our team arrived. The campaign-key was delivered on day six. We have not commissioned a wedding photographer who pretended to be editorial since.*

**Attribution:** Pending placeholder · Brand Manager, [Brand]
**ES:** *El estudio hizo scouting de la propiedad un día antes de que llegara nuestro equipo. El campaign-key se entregó en el día seis. No hemos comisionado a un fotógrafo de bodas que pretendiera ser editorial desde entonces.*

### 10.2 Testimonial 2 — Resort marketing director (Daniel-tier)

> *Three days. Six suites. Two restaurants. The full property package, on time, with bilingual permits handled in-house. The studio is the first call when the brand refresh comes around.*

**Attribution:** Pending placeholder · Marketing Director, [Resort]
**ES:** *Tres días. Seis suites. Dos restaurantes. El paquete completo de la propiedad, a tiempo, con permisos bilingües manejados in-house. El estudio es la primera llamada cuando llega el refresh de marca.*

### 10.3 Testimonial 3 — Magazine photo editor (Eliza-tier)

> *I bookmarked the studio after the first shoot. The frames came back the way I would have edited them in my own queue. Tulum is on my desk twice a year now, and IVAE shoots both.*

**Attribution:** Pending placeholder · Senior Photo Editor, [Title]
**ES:** *Marqué el estudio como favorito después del primer rodaje. Los frames volvieron como yo los habría editado en mi propia cola. Tulum está en mi escritorio dos veces al año, y IVAE rueda las dos.*

### 10.4 Testimonial 4 — DTC creative director (mixed)

> *We came in with a forty-eight-hour window and a stylist on a different time zone. The studio absorbed both and shipped the lookbook on day twelve. Restraint shows up as speed.*

**Attribution:** Pending placeholder · Creative Director, [DTC Brand]
**ES:** *Llegamos con una ventana de cuarenta y ocho horas y una estilista en otra zona horaria. El estudio absorbió ambas y entregó el lookbook en el día doce. La sobriedad se nota como velocidad.*

### 10.5 Testimonial 5 — Production company (mixed)

> *The studio delivered structured galleries. Camera. Set. Frame. Our marketing ops team shipped the campaign in the existing CMS without re-renaming a single file.*

**Attribution:** Pending placeholder · Head of Production, [Company]
**ES:** *El estudio entregó galerías estructuradas. Cámara. Set. Frame. Nuestro equipo de marketing ops lanzó la campaña en el CMS existente sin tener que renombrar un solo archivo.*

### 10.6 Testimonial 6 — Editorial agency (mixed)

> *The brief asked for two stills and one motion clip on the same setup. The studio delivered both in one take, in one hour, in one pass. The brand's CD approved on set.*

**Attribution:** Pending placeholder · Account Director, [Agency]
**ES:** *El brief pedía dos stills y un clip de motion en el mismo setup. El estudio entregó ambos en una toma, en una hora, en un pase. El CD de la marca aprobó en set.*

**Testimonials markup notes:**
- 2-col grid at desktop, 1-col at < 768px.
- Each testimonial: italic serif body at `--fs-15` weight 300, line-height 1.55, max 56 words. Italic.
- Attribution below: `--font-sans`, `--fs-13`, `--couple-name-tracking`, slash separator (` · `).
- Phase 1 §13 risk #1: all six are placeholders pending real testimonials. The "Pending placeholder" string is intentional and visible — it signals that the page is honest about its placeholders rather than hiding them. Phase 4 may swap with real names + real brand names when available; until then, the placeholders ship.

---

## Section 11 — FAQ (10 questions, locked)

**Section h2 (locked):** Considered Questions.

The 10 questions cover the full editorial commissioner objection set: usage rights, deliverables, casting, location permits, talent, retouching budget, exclusivity, schedule, language, NDA. Each Q/A is wrapped in a `<button aria-expanded aria-controls>` accordion per a11y contract failure mode 1.

### FAQ 1 — Usage rights

**Question:** What licensing does an editorial commission include?

**Answer (locked):**

> Each bracket includes a defined licensing scope. The Editorial Day includes print and web licensing, no archive use. The Campaign includes print, web, social, and twelve months of archive use. The Multi-Day Production includes the above plus extended archive licensing for the full life of the brand campaign. Out-of-home, broadcast, and stock-license-style usage are quoted separately. The studio has never charged a re-licensing fee on a project the studio shot. The licensing language follows standard editorial-photography conventions; a draft contract is shared after the first call.

**ES:**

> Cada tramo incluye un alcance de licencia definido. El Día Editorial incluye licencia print y web, sin archivo. La Campaña incluye print, web, social y doce meses de archivo. La Producción incluye lo anterior más licencia de archivo extendida para la vida completa de la campaña. Usos en out-of-home, broadcast y estilo stock se cotizan por separado. El estudio nunca ha cobrado una re-licencia en un proyecto que el estudio rodó. El lenguaje de licencia sigue convenciones editoriales estándar; un borrador de contrato se comparte después de la primera llamada.

### FAQ 2 — Deliverables

**Question:** What does the studio deliver, and in what format?

**Answer (locked):**

> Selects arrive in a structured archive: by camera, by set, by frame. RAW files are retained by the studio; high-resolution TIFF or JPEG masters are delivered per the licensing scope. Web-resolution exports are delivered alongside masters in a parallel folder. Motion clips are delivered as ProRes 422 HQ masters plus H.264 streaming exports. A Frame.io link covers the review cycle. Final delivery is via WeTransfer Pro or a private Dropbox link, the brand's choice. Filenames follow the camera-set-frame convention; renaming is on the studio.

**ES:**

> Los selects llegan en un archivo estructurado: por cámara, por set, por frame. Los RAW se mantienen en el estudio; los masters TIFF o JPEG en alta resolución se entregan según el alcance de licencia. Los exports web se entregan junto a los masters en una carpeta paralela. Los clips de motion se entregan como masters ProRes 422 HQ más exports H.264 para streaming. Un link de Frame.io cubre la ronda de revisión. La entrega final es vía WeTransfer Pro o un link privado de Dropbox, a elección de la marca. Los nombres de archivo siguen la convención cámara-set-frame; renombrar es responsabilidad del estudio.

### FAQ 3 — Casting

**Question:** Does the studio handle talent casting?

**Answer (locked):**

> Yes. The studio works with two casting directors and a roster of forty-plus talent across Mexico City, Cancun, Tulum, and Los Cabos. The brand reviews three options for each role and approves before the call sheet ships. Day rates are quoted at industry standard (modeling, on-camera talent, voiceover) and pass through to the brand at cost. The studio does not mark up talent. The studio does not sub-contract through a fixer. The casting fee is included in The Campaign and The Multi-Day Production.

**ES:**

> Sí. El estudio trabaja con dos directoras de casting y un roster de cuarenta-y-tantos talentos en CDMX, Cancún, Tulum y Los Cabos. La marca revisa tres opciones por rol y aprueba antes de que salga el call sheet. Las tarifas diarias se cotizan a estándar de industria (modelaje, on-camera, locución) y pasan a la marca al costo. El estudio no marca-up el talento. El estudio no subcontrata a través de un fixer. La tarifa de casting está incluida en La Campaña y La Producción.

### FAQ 4 — Location permits

**Question:** Who handles location permits and access?

**Answer (locked):**

> The studio handles permits in-house. Public-space permits in Cancun, the Riviera Maya, and Los Cabos are filed by the studio's producer with seven to ten business days of lead time. Private-property permits are negotiated directly with the property's events or marketing department. Beach and reserve permits in Quintana Roo follow SEMARNAT protocol where applicable. The studio carries general liability insurance at one million USD coverage and equipment insurance at three hundred thousand USD. Permit fees and any insurance riders pass through at cost.

**ES:**

> El estudio maneja los permisos in-house. Los permisos de espacios públicos en Cancún, Riviera Maya y Los Cabos los presenta el productor del estudio con siete a diez días hábiles de anticipación. Los permisos de propiedad privada se negocian directamente con el departamento de eventos o marketing de la propiedad. Los permisos de playa y reserva en Quintana Roo siguen el protocolo SEMARNAT donde aplique. El estudio carga seguro de responsabilidad civil por un millón de USD y seguro de equipo por trescientos mil USD. Las tarifas de permiso y los riders de seguro pasan al costo.

### FAQ 5 — Talent and crew

**Question:** Who is on the crew?

**Answer (locked):**

> The Editorial Day runs with one photographer, one assistant, and one on-set producer. The Campaign adds a second producer and stylist coordination. The Multi-Day Production adds a DP for motion, a grip, and a digital tech. All crew are bilingual. Vianey Diaz directs every commission; the studio does not hand off direction to an associate. A full crew sheet with names, day rates, and roles is shared with the call sheet seventy-two hours before the shoot.

**ES:**

> El Día Editorial corre con un fotógrafo, un asistente y un productor en set. La Campaña agrega un segundo productor y coordinación de estilismo. La Producción agrega un DP para motion, un grip y un digital tech. Todo el crew es bilingüe. Vianey Díaz dirige cada comisión; el estudio no delega la dirección a un asociado. Una hoja de crew completa con nombres, tarifas diarias y roles se comparte con el call sheet setenta y dos horas antes del rodaje.

### FAQ 6 — Retouching budget

**Question:** Is retouching included, and to what level?

**Answer (locked):**

> Standard color and skin retouching are included in every bracket. Standard means natural color grading in the IVAE register, dust and sensor cleanup, basic skin smoothing without erasing pore structure, and removal of incidental crew or background distractions. Heavy compositing, beauty retouching at editorial-cover level, and CGI retouching are quoted separately at one hundred fifty USD per hour. The studio refuses to deliver retouching that erases natural skin texture. Brands that require that register are politely declined.

**ES:**

> El retoque estándar de color y piel está incluido en cada tramo. Estándar significa color grading natural en el register de IVAE, limpieza de polvo y sensor, suavizado de piel básico sin borrar la textura del poro, y remoción de distracciones incidentales de crew o fondo. Compositing pesado, retoque de belleza a nivel de portada editorial y retoque CGI se cotizan por separado a ciento cincuenta USD por hora. El estudio rechaza entregar retoque que borre la textura natural de la piel. Las marcas que requieren ese register son rechazadas con cortesía.

### FAQ 7 — Exclusivity

**Question:** Will the studio shoot for a competitor?

**Answer (locked):**

> The studio observes a thirty-day cooling period between commissions in directly competing categories. A hotel rebrand for one Riviera Maya property is followed by a thirty-day window before the studio commits to a second hotel rebrand on the same coastline. The studio does not sign category-exclusivity agreements beyond ninety days; long-term exclusivity is a different commercial structure and is quoted on retainer. Brands that want a one-shoot exclusivity should request the cooling clause when the brief is written.

**ES:**

> El estudio observa un período de enfriamiento de treinta días entre comisiones en categorías directamente competidoras. Un rebrand de hotel para una propiedad en Riviera Maya es seguido por una ventana de treinta días antes de que el estudio se comprometa a un segundo rebrand de hotel en la misma costa. El estudio no firma acuerdos de exclusividad por categoría más allá de noventa días; la exclusividad de largo plazo es una estructura comercial diferente y se cotiza por retainer. Las marcas que quieren exclusividad de un solo rodaje deben solicitar la cláusula de enfriamiento cuando se redacta el brief.

### FAQ 8 — Schedule and turnaround

**Question:** How quickly can a commission move from brief to delivery?

**Answer (locked):**

> The studio's standing turnaround is eight to twelve weeks from brief sign-off to final delivery for The Campaign and The Multi-Day Production. The Editorial Day can move in two to four weeks if the date is open. Casting and location permits are the longest single dependency; with seven business days of lead time on permits, the shoot itself ships in five to ten business days for selects, fifteen to twenty for full delivery. Rush briefs (under two weeks total) are quoted at a twenty-five percent rush fee.

**ES:**

> El tiempo de respuesta estándar del estudio es ocho a doce semanas desde la firma del brief hasta la entrega final para La Campaña y La Producción. El Día Editorial puede moverse en dos a cuatro semanas si la fecha está abierta. El casting y los permisos de locación son la dependencia más larga; con siete días hábiles de lead time en permisos, el rodaje en sí entrega selects en cinco a diez días hábiles, quince a veinte en entrega completa. Los briefs urgentes (menos de dos semanas en total) se cotizan con un veinticinco por ciento de tarifa de urgencia.

### FAQ 9 — Language

**Question:** In what language does the studio work?

**Answer (locked):**

> English and Spanish, equally. Every email, every call sheet, every contract draft, every Frame.io review note, and every final delivery memo is offered in both languages. The studio's producers are bilingual. Vianey Diaz is fluent in both. On set, the working language is the brand's preferred language, and the studio adjusts the call sheet accordingly. International shoots in third-language regions (Italy, France, Portugal) are quoted with a local fixer line item.

**ES:**

> Inglés y español, por igual. Cada correo, cada call sheet, cada borrador de contrato, cada nota de revisión en Frame.io y cada memo de entrega final se ofrece en ambos idiomas. Los productores del estudio son bilingües. Vianey Díaz es fluida en ambos. En set, el idioma de trabajo es el idioma preferido de la marca, y el estudio ajusta el call sheet en consecuencia. Los rodajes internacionales en regiones de un tercer idioma (Italia, Francia, Portugal) se cotizan con un fixer local como línea aparte.

### FAQ 10 — NDA

**Question:** Will the studio sign an NDA?

**Answer (locked):**

> Yes. The studio signs mutual NDAs as a standard practice on commissions where the brand is in a launch window or in an unannounced rebrand. Standard scope: the studio agrees not to publish, exhibit, or share imagery for a defined embargo period (typically three to twelve months). The studio retains the right to publish the work after the embargo lifts unless the contract specifies a longer or permanent hold. Permanent-hold work is quoted at a thirty percent premium because portfolio rights are part of the studio's commercial value.

**ES:**

> Sí. El estudio firma NDAs mutuos como práctica estándar en comisiones donde la marca está en ventana de lanzamiento o en un rebrand no anunciado. Alcance estándar: el estudio acepta no publicar, exhibir o compartir imagen por un período de embargo definido (típicamente de tres a doce meses). El estudio retiene el derecho de publicar el trabajo después de que se levante el embargo, salvo que el contrato especifique un hold más largo o permanente. El trabajo en hold permanente se cotiza con un treinta por ciento de premio porque los derechos de portafolio son parte del valor comercial del estudio.

**FAQ markup notes (apply to all 10):**
- Each Q/A is a `<button aria-expanded="false" aria-controls="le-faq-N-panel">` toggling `<div role="region" aria-labelledby="le-faq-N-question" id="le-faq-N-panel" hidden>`.
- Question text is in `<h3>` inside the button.
- Max-width 880px (`--faq-max-width`).
- Visible on load: collapsed (closed). The first question may be expanded by default in Phase 4 if the chosen direction wants a single open state for visual rhythm.

---

## Section 12 — "Featured In" press band (locked, 6-9 logo placeholders)

**Section eyebrow (locked):** As Seen In

**Logo placeholders (6 to ship Phase 4 first deploy, expandable to 9):**

The press band is rendered as a horizontal logo wall, edge-to-edge, with logos sized at `--press-band-logo-h` (clamp 18-28px). Default opacity `--press-band-logo-opacity` (0.55). On hover/focus, opacity restores to `--press-band-logo-opacity-hover` (1.0) over 0.3s ease.

**Phase 4 launch placeholders (per Phase 1 §13 risk #1 — clearly marked, NOT real publication trademarks):**

| # | Placeholder text (visual logo + alt text) | Real-logo destination |
|---|---|---|
| 1 | "Coming soon" placeholder bar | Conde Nast Traveler (when Vianey supplies tearsheet) |
| 2 | "Coming soon" placeholder bar | Travel + Leisure (when supplied) |
| 3 | "Coming soon" placeholder bar | Vogue Mexico (when supplied) |
| 4 | "Coming soon" placeholder bar | Architectural Digest (when supplied) |
| 5 | "Coming soon" placeholder bar | Domino (when supplied) |
| 6 | "Coming soon" placeholder bar | Tatler / Galore / Suitcase (TBD) |
| 7 | (Optional, ship if Vianey provides one logo) | Real logo |
| 8 | (Optional) | Real logo |
| 9 | (Optional) | Real logo |

**Markup notes:**
- `<section aria-labelledby="le-press-heading">` with visually-hidden `<h2 id="le-press-heading">As Seen In</h2>`.
- Each logo: `<img src="/images/press/logo-N-placeholder.svg" alt="[Publication name] logo" loading="lazy" width="...">`. Per a11y contract failure mode 6, alt text is descriptive (publication name + "logo"), never empty, on placeholders or real logos.
- Gap between logos `--press-band-gap` (clamp 40-80px).
- The opacity restoration on hover is a contrast safety contract per a11y contract failure mode 12 below — the 0.55 default may fail contrast for users who do not hover or focus, so the band's a11y note ALSO requires keyboard focus to restore opacity.
- Above the band: small caps eyebrow "As Seen In" in gold, 0.32em tracking, `--fs-13` weight 600.

---

## Section 13 — Inquiry block (Begin Brief, locked)

**Section eyebrow (locked):** Commission.
**Section h2 (locked):** Begin a brief.

**Intro body (locked, ~70 words):**

> Share the brand, the brief, the dates, and a sentence about the campaign you imagine. The studio will respond the same business day, in English or in Spanish, with two questions, a draft call sheet, and a calendar link. The first reply is from Vianey. Briefs that arrive on Friday afternoon are read Monday morning. The studio takes a finite number of editorial commissions per quarter to keep the work calm.

**ES intro:**

> Comparte la marca, el brief, las fechas y una oración sobre la campaña que imaginas. El estudio responderá el mismo día hábil, en inglés o en español, con dos preguntas, un borrador de call sheet y un link de calendario. La primera respuesta es de Vianey. Los briefs que llegan el viernes por la tarde se leen el lunes por la mañana. El estudio toma un número finito de comisiones editoriales por trimestre para mantener el trabajo en calma.

### 13.1 Inquiry CTAs (two, side-by-side)

**Primary CTA (locked):** Begin Brief
**Element:** `<a class="le-btn le-btn-primary" href="mailto:info@ivaestudios.com?subject=Editorial Commission Brief">`
**Note:** Per Phase 1 §13 risk #4, the email destination (`hello@` vs `info@`) is owner-confirm before Phase 4 ship. Phase 4 must reconcile against current page CTA destinations.

**Secondary CTA (locked):** WhatsApp the Studio
**Element:** `<a class="le-btn le-btn-ghost" href="https://wa.me/529902046514">`
**Note:** Per Phase 1 §13 risk #4 + repo CLAUDE.md, the phone number `+52 990 204 6514` uses an impossible Mexican area code (990). Phase 4 MUST NOT publish until Vianey confirms the real number. Until then, the WhatsApp CTA either points to a placeholder `tel:` URL or is replaced with a generic mailto.

**ES primary:** Iniciar Brief
**ES secondary:** WhatsApp al Estudio

### 13.2 Meta strip (3 cells, hairline-separated)

| Field (EN) | Value (EN) | Field (ES) | Value (ES) |
|---|---|---|---|
| RESPONSE TIME | Same business day | TIEMPO DE RESPUESTA | Mismo día hábil |
| LANGUAGES | English / Espanol | IDIOMAS | Español / English |
| COVERAGE | Cancun · Riviera Maya · Los Cabos | COBERTURA | Cancún · Riviera Maya · Los Cabos |

**Markup notes:**
- `<div role="group" aria-label="Studio response details">`.
- Vertical hairline between cells (CSS border, not a character).
- Field labels small caps, gold, `--tracking-eyebrow-tight` (0.18em).
- Values in `--font-sans` `--fs-13` weight 400.
- "Espanol" written without diacritic on the EN page (matches existing IVAE site convention); "Español" with diacritic on the ES page.

---

## Section 14 — Footer copy (locked)

**Footer voice line (locked, full-width above any link grid):**

> IVAE Studios. Cancun. Riviera Maya. Los Cabos.

**ES:** IVAE Studios. Cancún. Riviera Maya. Los Cabos.

**Footer columns (3 columns, hairline above):**

**Column 1 — Studio:**
- About (the studio)
- Editorial (this page)
- Weddings
- Family
- Couples
- Journal

**Column 2 — Contact:**
- info@ivaestudios.com
- WhatsApp [pending real number]
- Cancun · Riviera Maya · Los Cabos
- Same-business-day response

**Column 3 — Legal:**
- Terms of service
- Privacy policy
- Cookie preferences
- Site map

**Bottom bar:**

> © 2026 IVAE Studios. All rights reserved. Built quietly, in Mexico.

**ES bottom bar:** © 2026 IVAE Studios. Todos los derechos reservados. Hecho en silencio, en México.

**Footer markup notes:**
- `<footer role="contentinfo">`.
- Voice line in italic Cormorant `--fs-21` weight 300, color `--gold-deep` on cream / `--gold` on dark depending on Phase 4 final color treatment for the footer (recommend ink-3 background to match the inquiry section).
- Column headings small caps `--fs-10` weight 600 `--tracking-eyebrow-wide`, color `--gold`.
- Column items `--font-sans` `--fs-13` weight 400.
- Hairlines between columns at `--gold-line` 1px.
- Bottom bar `--fs-10` weight 400, color `--text-on-dark-readable` at 0.6 alpha.

---

## Section 15 — Reusable phrase glossary (lock recurring phrases)

These phrases recur across the page and MUST appear identically each time they appear. Phase 3 builders may not paraphrase.

| Phrase | Where it appears | Locked form (EN) | Locked form (ES) |
|---|---|---|---|
| Studio voice anchor | Manifesto / FAQ / Method intro | "the studio" (lowercase definite article + noun) | "el estudio" |
| Bilingual signal (manifesto) | Manifesto only | *Bilingüe en cada conversación.* (italics, no quotes) | *Bilingual in every conversation.* (italics, no quotes; on ES page only) |
| Coastlines | Hero subhead / Method intro / Pillar II / Footer voice line | "Cancun, the Riviera Maya, and Los Cabos" (Oxford comma in subhead); "Cancun · Riviera Maya · Los Cabos" (middle-dot in meta strip and footer) | "Cancún, Riviera Maya y Los Cabos" / "Cancún · Riviera Maya · Los Cabos" |
| Vianey attribution | Manifesto sign-off / Method step 01 / Inquiry intro | "Vianey Diaz / Director" (manifesto) / "the first reply is from Vianey" (inquiry) | "Vianey Díaz / Directora" |
| Delivery promise | Pillar III / Method step 04 / FAQ 8 | "five to ten business days for selects, fifteen to twenty for full delivery" | "cinco a diez días hábiles para selects, quince a veinte en entrega completa" |
| Volume control | Inquiry intro / Manifesto Restraint pillar | "the studio takes a finite number of editorial commissions per quarter" | "el estudio toma un número finito de comisiones editoriales por trimestre" |
| Begin Brief | Header CTA / Hero CTA / 3 bracket CTAs / Inquiry primary CTA | "Begin Brief" (always Title Case, two words) | "Iniciar Brief" |

---

## Section 16 — What this deck does NOT include

For phase clarity, the following remain owner-decisions per Phase 1 §13 and are NOT locked here:

1. **Real testimonial names.** All six testimonials in Section 10 plus the pull-quote in Section 9 are placeholders pending Vianey's editorial-client release list. Phase 4 must verify or substitute with real attributions before publication.
2. **Real "Featured In" logos.** Phase 1 §13 risk #6 — the press band ships with "Coming soon" placeholders until Vianey provides real publication / brand client tearsheets. Real logos must not be used without permission.
3. **Real case study (Casa Ranfla is a placeholder).** Phase 1 §13 risk #2 — the brand name and the case study body copy ship as placeholder until a real editorial commission is cleared for publication. Phase 4 should swap before launch where possible; if not, the placeholder ships with a small note in the alt text or below the figure.
4. **Email destination (`hello@` vs `info@`).** Phase 1 §13 risk #4 — Phase 4 must reconcile against current site CTA destinations.
5. **WhatsApp number.** Phase 1 §13 risk #4 + repo CLAUDE.md — current `+52 990 204 6514` is impossible. Phase 4 MUST NOT publish until owner confirms real number.
6. **Spanish translations beyond what is locked above.** Every locked block carries an ES counterpart. Phase 5 verification will confirm the ES mirror file `/es/editorial-de-lujo.html` matches one-to-one.
7. **Direction selection.** Phase 1 §10 — three visual directions (A Magazine Spread, B Cinemascope Reel, C Editorial Republic Minimal) remain owner-choice. Phase 3 prompts will produce one canonical build (Direction B with selective borrowings from A and C per the recommendation).

---

**End of Phase 2 Locked Copy Deck.**

Word count: ~4,180 words across 20 microcopy decisions, hero block, magazine masthead, manifesto (256 words), case study (374 words), 3 pillars, 3 brackets, 4 method steps, pull-quote, 6 testimonials, 10 FAQ, press band, inquiry block, footer, recurring phrase glossary. Voice contract enforced: zero em-dashes, zero exclamations, zero superlatives, "studio" voice throughout, one Spanish phrase per page used as bilingual signal not translation. ES translations included for every locked block. All markup notes specified for Phase 3 implementation. Placeholder integrity preserved for testimonial names, press logos, case study brand, email/phone destinations.
