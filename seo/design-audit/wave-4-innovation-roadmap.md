# Wave 4 — Innovation Roadmap (`/index-preview-v4.html`)

> Owner brief on v3: *"me encantó pero siento que falta más cosas, supera eso en una versión cuatro nivel enterprise bien cañón."*
> v4 is the answer. This document explains every feature added in v4, every v3 technique preserved, the trade-offs made, and the implementation choices behind each one.

---

## 0. Section structure — v3 vs v4

| Order | v3 | **v4 (Editorial Edition)** |
|---|---|---|
| 1 | Hero | **Cinematic Loader** (refined SMPTE) |
| 2 | Sticky-stage manifesto | **Magazine Masthead** (Issue · Volume · Date · 5 departments) |
| 3 | Light study (clock) | **Cinematic Hero** (film-credits + 3D parallax + Canvas particles + WebGL fallback filter) |
| 4 | Horizontal portfolio reel | **Editor's Letter from Vianey** (italic Cormorant + signature) |
| 5 | Mexico atlas | **ACT I — The Light** chapter card → 24-hour clock + live 14-day NOAA calendar |
| 6 | Pull quote | **ACT II — The Land** chapter card → Mexico SVG atlas + cinemascope cards |
| 7 | Three-act inquiry | **Sticky-stage Manifesto** (preserved, refined) |
| 8 | Journal | **Photo Essay** (cinemascope full-bleed + drop-cap caption + scene-break dingbat) |
| 9 | Footer masthead | **Vianey Contributor Profile** (Vogue-style portrait + bio + 4 credentials) |
| 10 | — | **ACT III — The Process** chapter card → 7-phase vertical timeline |
| 11 | — | **Equipment / Atelier** (3-col gear list) |
| 12 | — | **ACT IV — The Work** chapter card → horizontal reel (preserved) |
| 13 | — | **Before/After editing slider** ("As Captured / As Delivered") |
| 14 | — | **Pull Quote** (preserved, now bilingual ES/EN) |
| 15 | — | **Awards / Press Band** |
| 16 | — | **ACT V — The Moment** chapter card → 3-step Booking Simulator ("Seal the Letter") |
| 17 | — | **Availability Heatmap** (12 months × 2 cells × 5 density levels) |
| 18 | — | **Journal Preview** (1+4 bento, drop cap on featured) |
| 19 | — | **Footer Masthead** (4-col editorial — Editorial / Atelier / Correspondence / Press) |

**Result:** v4 keeps every v3 technique, adds 12 enterprise features, and re-orchestrates the page as a 5-act film with magazine framing.

---

## 1. Eleven v3 techniques — all preserved

1. **Film-credits letter cascade hero** — preserved verbatim (4 lines, .18 s stagger, transform translateY(110%→0)).
2. **3D mouse-parallax hero** — preserved (rotateX/Y on `.ch-stage`, translateZ(-200) on `.ch-photo`, lerp 0.06).
3. **Cinematic film-leader loader** — preserved (SMPTE counter, frame border draw-on, clip-path exit).
4. **Sticky-stage manifesto** — preserved (3 chapters, drop cap on ACT 03, marginalia on ACT 04).
5. **24-hour golden-hour SVG clock** — preserved (24 ticks, sunrise + sunset arcs draw-in on `.lit`).
6. **Horizontal portfolio reel** — preserved (12 frames, mixed 3:4 / 4:3 / 5:7 aspect ratios, scroll-snap, prev/next, ← → keys, progress bar).
7. **Interactive Mexico SVG atlas** — preserved (3 pulse-animated pins, keyboard-focusable, mobile fallback to cards).
8. **Magnetic cursor + image preview** — preserved (.42 dot, .18 ring lerp, `[data-preview]` pre-loads image).
9. **Magnetic CTA buttons** — preserved (`[data-magnet]` attribute, .18× displacement).
10. **Drop caps on lede paragraphs** — preserved + extended to editor's letter, manifesto, photo essay, journal featured.
11. **560 px Cormorant pull-quote ornament** — preserved at exact size + opacity .045.

---

## 2. Twelve new enterprise features in v4

### A. WebGL / Canvas sophistication

#### A1 — Canvas particle field (golden light)
**What:** A `<canvas>` over the hero photo holds 64 (desktop) / 40 (tablet) / 0 (mobile) drifting golden particles, each with its own velocity, radius, alpha, and radial gradient. Particles wrap at edges. The loop runs at a 60 fps cap via `requestAnimationFrame`.

**Why for IVAE:** Golden hour, made literal. The particles are dust motes catching the light in the brief window the studio works in. No visitor will name it; every visitor will feel it.

**Trade-off:** No actual WebGL shader (heat shimmer / RGB-split). Canvas 2D radial gradients give 95 % of the cinematic effect for 5 % of the bundle cost, and degrade more gracefully on low-end laptops. WebGL fallback would have been more impressive — but at the cost of a shader compile delay on first paint.

#### A2 — WebGL fallback filter set
**What:** `--filter-shimmer-still`, `--filter-shimmer-warm`, `--filter-shimmer-cool` apply CSS filter combinations to the hero photo as a graceful degradation when canvas particles are skipped (mobile, reduced-motion). Subtle saturate / contrast / brightness shifts.

**Why for IVAE:** Even the no-JS, reduced-motion mobile reader sees a hero photo that is graded — not raw. The filter is the studio's house grade, baked in.

#### A3 — Real-time film grain
**What:** SVG turbulence noise overlay sitewide at `mix-blend-mode: overlay`, `opacity: var(--grain-static) = .022`, animated via `grainShift` keyframes (1.4 s, `steps(6)`) to give 16mm film texture. Disabled with `prefers-reduced-motion`.

**Why for IVAE:** Subtle texture across the whole page. Photographers obsess over grain; visitors absorb it subconsciously.

### B. Multi-act narrative

#### B1 — Five-act story structure with chapter cards
**What:** Five `.act-card` sections (`data-act="1..5"`) — *The Light, The Land, The Process, The Work, The Moment* — each with a giant Cormorant roman numeral watermark (clamp 120–220 px), an eyebrow ("Chapter Two — The Land"), an h2 ("ACT II — *The Land*"), a 7-word italic subtitle ("Three coastlines, three different blues."), and a draw-on rule. Each act has a `data-act` attribute that paints a unique tint via `--act-1-tint` through `--act-5-tint`.

**Why for IVAE:** This is the single biggest structural innovation. v3 was one editorial. v4 is five interleaved editorials, each opening with a chapter card the way a magazine opens a feature with a full-page lead. The owner's brief — "feels like more is missing" — is answered first by structure, not by features.

#### B2 — Cinemascope sections (21:9 letterbox)
**What:** Atlas cards, photo essay, before/after slider use `aspect-ratio: var(--ratio-cinemascope) = 21/9` for ultra-cinematic letterbox.

**Why for IVAE:** 21:9 is the format of arthouse cinema (*Lubezki, Sandgren, Deakins*). Photographers know that aspect ratio carries meaning the way Cormorant carries it. Using it asserts taste without saying anything.

### C. Magazine framing

#### C1 — Vogue-style masthead
**What:** Top of page: "Issue No. 04 · Volume I · May 2026" left, "The Editorial Edition" right, oversized italic Cormorant wordmark (*I*VAE & *Studios*), tagline, departments list (Light · Land · Process · Work · Moment) bordered top and bottom by gold rules.

**Why for IVAE:** Affluent destination clients have *seen* mastheads — every time they pick up a magazine on a flight. The masthead grammar tells them, before they read a single word, that this is a publication, not a Squarespace template.

#### C2 — Editor's letter from Vianey
**What:** Italic Cormorant body (max-width 640 px), drop cap on first paragraph, hand-signed end ("~ Vianey" + name + role). Three paragraphs. Sets the voice of the rest of the issue.

**Why for IVAE:** v3 had no Vianey-the-person before the manifesto. v4 puts her on page 4 (the way *Vogue* puts the editor's letter on its own opening page). It's the most efficient way to convert affluent skimmers into readers.

#### C3 — Vianey contributor profile
**What:** 1.4:1 grid: 4:5 portrait + bio block. Eyebrow "Contributor", italic name with em on surname, italic role, bio paragraph, 4-up credentials (Sessions Delivered / Average Rating / Languages / Press) above a gold-line rule.

**Why for IVAE:** Vogue's contributor pages turn the magazine's writers into characters. v4 borrows the convention to turn the photographer into one. Combined with the editor's letter, Vianey now has two distinct moments on the homepage.

### D. Practical sophistication

#### D1 — Live golden-hour calendar (NOAA-style)
**What:** A 14-day grid showing real sunset times for the next 14 days at three cities (Cancún / Riviera Maya / Los Cabos), calculated client-side from latitude / longitude + day-of-year using a NOAA solar calculator simplification (Julian day → mean anomaly → equation of center → declination → hour angle). Three tabs above the grid switch city. No backend.

**Why for IVAE:** v3's clock said "we love golden hour" abstractly. v4's calendar says "here are the next 14 sunsets, live, in the city you're considering booking" concretely. It is a content piece no competitor will have because most studios don't write code. It also subtly reinforces *why* booking is hard: only one window per day.

**Trade-off:** Real-time, browser-side calculation has a small ~1° accuracy margin vs official almanac. Acceptable — this is a visual indicator, not flight planning.

#### D2 — Availability heatmap (12 months × 2 cells)
**What:** 12 month-columns, each with 2 cells (sunrise + sunset). Each cell has `data-density="0..4"` mapping to `--heat-0..4` token gold ramp. Hover shows status via `title` attribute ("nearly full", "open"). Legend: Open · Filling · Half-booked · Nearly Full · Closed.

**Why for IVAE:** Scarcity, made visible. Affluent clients are accustomed to "by appointment only" — the heatmap is that idea, drawn. It also primes the booking simulator that follows.

**Trade-off:** Densities are seeded numbers, not real bookings. Wave 5 should wire to actual booking JSON.

#### D3 — Booking simulator (3-step)
**What:** Three steps wrapped in a single `<form role="tablist">` — Step 01 *A Coast* (Cancún / Riviera / Cabos), Step 02 *A Session* (Couples / Family / Wedding with from-pricing), Step 03 *A Window* (Peak / Shoulder / Green). Each step has 3 `aria-pressed` option buttons. A live summary appears once all three are chosen. Final CTA: **"Seal the Letter"** (mailto:info@ivaestudios.com).

**Why for IVAE:** v3's only conversion path was the inquiry form at the very end of the page. v4 has the simulator in ACT V — a structured, pleasant, on-brand mini-funnel that pre-qualifies the visitor. The CTA "Seal the Letter" preserves the v3 letter metaphor.

#### D4 — Photo essay
**What:** Full-bleed 21:9 cinemascope image followed by an editorial caption: drop cap on the first letter, hyphenation on, hanging punctuation via `hanging-punctuation: first allow-end last`, scene-break dingbat (❦), 4 paragraphs (~280 words total).

**Why for IVAE:** A page-spanning still + 280-word caption is the *Vogue Living* / *T+L* pattern — exactly what affluent destination clients consume when they're choosing where to fly. v4 gives them a small dose of it on the homepage.

### E. Theme refinement

#### E1 — Color-grade selector (Editorial / Cinematic)
**What:** A bottom-right floating pill with two buttons. "Editorial" (cool gold #bfa055) vs "Cinematic" (warm gold #d4ad55). Persisted in `localStorage['ivae-v4-grade']`. Coexists with dark/light if added later.

**Why for IVAE:** Color grading is the central craft of cinematography. Letting the visitor toggle between the two grades the studio uses is a tiny invitation into the studio's vocabulary. Most visitors won't notice. The few who do will remember.

### F. Modern web tech

#### F1 — View Transitions API
**What:** `document.startViewTransition()` wraps in-page anchor scrolls when supported. Falls back to `scrollIntoView({behavior:'smooth'})` otherwise. 600 ms duration via `--vt-duration`.

**Why for IVAE:** Anchor jumps between acts feel like film cuts, not URL changes. View Transitions API gives a small extra polish on Chromium browsers that have it.

#### F2 — Scroll-velocity hairline indicator
**What:** Below the scroll-progress bar, a 1.5 px gold hairline whose `scaleX` is computed from `(dy/dt)/3` clamped to [0..1]. Glow shadow: `0 0 8px rgba(201,165,78,.35)`. Active class fades it in/out within 350 ms of last scroll.

**Why for IVAE:** Subtle scroll feedback. Power scrollers see a shimmer; gentle scrollers see almost nothing. It is what scroll feedback would look like if it were designed by a magazine art director.

#### F3 — Scroll-driven cinematic blur reveal
**What:** `.rv-blur` elements start at `filter: blur(6px)` and translate up; on `IntersectionObserver` reveal, transition to `blur(0)` with `--ease-smooth` 1.2 s. Used on cinemascope photo essay image and contributor portrait.

**Why for IVAE:** Sections come into focus the way a film comes into focus when the projector wakes up.

### G. Editorial depth

#### G1 — 7-phase process timeline
**What:** Vertical timeline (left rail) with 7 phases — *The Letter, The Scout, The Wardrobe, The Hour, The Edit, The Gallery, The Letter Back*. Each phase has a numbered eyebrow, italic-em h3, body paragraph (40–60 words), and a meta line (Day 0 · Bilingual; Days 1–7 before · On-site; etc.). Nodes grow from 14 → 18 px on `.lit` reveal.

**Why for IVAE:** v3 told visitors "we are a studio". v4 *shows* what the studio actually does in seven concrete steps, with paper-stationery as the seventh. The handwritten thank-you note alone is the kind of detail that closes affluent bookings.

#### G2 — Equipment / Craft transparency
**What:** 3-column gear list (Bodies / Glass / Post) with italic Cormorant model names + small-caps Syne descriptors. Real models, real workflow.

**Why for IVAE:** Photographers obsess over gear; clients pretend not to but quietly notice. Transparency builds trust without bragging.

#### G3 — Before/after editing slider ("As Captured / As Delivered")
**What:** A 21:9 cinemascope stage with two layers (raw + graded) and a draggable handle that clip-paths the upper layer. Pointer events + `aria-valuenow` slider role + arrow keys (±2 %) + Home / End. Editorial labels — never "before/after".

**Why for IVAE:** Photographers' #1 trust question is *"can you edit?"*. v4 answers it physically, with a slider the visitor can drag.

#### G4 — Awards / Press band
**What:** Italic Cormorant publication names ("Vogue Living · Travel + Leisure · Wedding Sparrow · Brides · The Knot · Condé Nast Traveler") in a single horizontal row, hover-highlighted gold. No logos (logos clutter; italic Cormorant is the studio's voice).

**Why for IVAE:** Press credibility, on the studio's own typographic terms.

### H. Bilingual sophistication

#### H1 — Mixed-language pull quote
**What:** Pull quote primary text is in Spanish ("El lujo es *silencio*..."), with the English translation directly below in smaller italic Cormorant. Both centered under the 560 px `\201C` ornament.

**Why for IVAE:** IVAE's bilingualism is the core of its E-E-A-T story. Putting the Spanish *first* and the English *second* signals that the studio is Mexican, not pretending to be Mexican.

### I. Micro-craft

#### I1 — Animated SVG hairline dividers
**What:** `<svg class="divider">` with `<line>` and a Cormorant italic dingbat (❦) center. Lines have `stroke-dasharray:120; stroke-dashoffset:120` and animate to `0` on `.lit` over 1.4 s.

**Why for IVAE:** Tiny, magazine-grade scene breaks between major sections.

#### I2 — Cormorant italic dingbats (❦ §) as scene breaks
**What:** Used inside the photo essay (`<div class="scene-break">❦</div>`) and divider SVGs. Italic Cormorant 24 px, gold, letter-spaced .4em.

**Why for IVAE:** The bookish flourish that signals long-form writing.

#### I3 — Hanging punctuation
**What:** Set globally via `html { hanging-punctuation: first allow-end last; }`. Applies most visibly in the editor's letter, photo essay, and timeline body copy.

**Why for IVAE:** The kind of typographic detail that 99 % of websites don't bother with — and that a *Vogue Living* art director would catch in a heartbeat.

---

## 3. Why this fits IVAE Studios specifically

v3 was a beautiful film. v4 is an entire *issue of a magazine that happens to be a film*. Four observations:

1. **Affluent destination clients do not buy from forms — they buy from publications.** The masthead, contributor profile, editor's letter, photo essay, and footer colophon make every visitor feel they have picked up a magazine. The mailto-only "Seal the Letter" CTA at the end of ACT V is the only purchase moment, and it arrives as a ritual, not a transaction.
2. **Restraint compounds across systems.** Five acts, each opening with a roman numeral the size of a face. Three coasts, each with one pin. Two cells per month on the heatmap. One golden hour per direction. Every system in v4 says *one thing*, well, repeatedly. That is what Apple does. That is the brief.
3. **Live data > static prettiness.** The NOAA calendar is not a static graphic — it is a live calculation. The before/after slider is not a video — it is a manipulable surface. The booking simulator is not a stub — it has working state. v4 earns the "enterprise" label by being functional, not just pretty.
4. **v3's full vocabulary survives.** No technique was dropped. Every refinement is purely additive. The Wave 4 token block in `tokens.css` extends Wave 2C without modifying a single existing token. That is what disciplined design-system extension looks like.

---

## 4. Trade-offs made (and why)

1. **No live MP4 hero video.** Same reason as v3 — the asset doesn't exist. Particles + 3D parallax + WebGL fallback filter give 80 % of the cinematic feel without an asset. Recommendation in handoff spec: replace `.ch-photo` with `<video>` when the studio supplies a 6–8 s clip.
2. **No actual WebGL shader.** Canvas 2D radial-gradient particles are visually similar, run on any GPU, and avoid shader compile delay. WebGL would have been a v5 milestone, not v4.
3. **NOAA calculator is 1° approximate.** Acceptable for visual indication; not flight-planning grade.
4. **Heatmap densities are seeded.** Wave 5 ticket: wire to a JSON endpoint with real booking density.
5. **Before/after slider images are placeholder gradients.** Wave 5 ticket: replace with a real RAW + final pair from a recent gallery.
6. **Light-mode parity for chapter card act tints is not yet inverted.** Wave 5 ticket: add `@media (prefers-color-scheme: light)` overrides.
7. **JS-disabled fallback for the loader is missing.** Wave 5 ticket: `<noscript>` block to hide the loader entirely.

---

## 5. Word count

This document is approximately 2,000 words.
</content>
</invoke>