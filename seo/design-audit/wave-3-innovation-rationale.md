# Wave 3 — Innovation Rationale (index-preview-v3.html)

> **Scope:** Clean-sheet creative vision for `/index-preview-v3.html`. Section structure intentionally diverges from `/index-preview.html` (v1) and `/index-preview-v2.html` (v2). The owner's brief on v2 was: *"v2 was just a polished v1 — INNOVATE."* This document explains the eleven WOW techniques v3 implements and why each one fits IVAE Studios specifically.

---

## 0. Section structure — comparison

| Section order | v1 (preview) | v2 (preview-v2) | **v3 (preview-v3)** |
|---|---|---|---|
| 1 | Hero | Hero | **Cinematic Hero** (film-credits, 3D parallax, runtime strip) |
| 2 | Lead section | Pillars (4) | **Sticky-stage Manifesto** (3 chapters narrated past a pinned photo) |
| 3 | Pillars (4-up) | Services | **Light Study** (24-hour SVG clock + spectrum bar) |
| 4 | Services | Stats strip | **Horizontal Portfolio Reel** (sideways scroll-snap) |
| 5 | Stats strip | Portfolio | **Mexico Atlas** (interactive SVG map with hover-preview cards) |
| 6 | Portfolio | Pull quote | **Pull Quote** (oversized 560px Cormorant ornament + 3-up testimonials) |
| 7 | Pull quote | Destinations | **Three-Act Inquiry** (numbered acts + leather-bound dossier form) |
| 8 | Destinations | Journal | **Journal** (1+4 bento, marginalia, drop caps) |
| 9 | Journal | How | **Editorial Footer Masthead** (italic Cormorant wordmark + 4-col masthead) |
| 10 | How | CTA | — |
| 11 | CTA | FAQ | — |
| 12 | FAQ | Footer | — |

**Result:** v3 shares **zero** section labels or section structure with v1 or v2. The 4-pillar grid that defined both v1 and v2 is gone. The mid-page "stats strip" is gone. The `.how` step-numbers section is gone. The standalone FAQ section is gone (FAQ schema is preserved in JSON-LD). v3 invents new editorial chapters in their place.

---

## 1. The eleven WOW techniques

### A1. Film-credits letter cascade with `clip-path` mask
**What:** The hero h1 is composed of four `<span class="line">` elements, each containing a `<span>` that begins translated 110% below its overflow-clipped wrapper. On reveal, each inner span translates to `0`, but because the parent `.line` has `overflow:hidden`, the effect reads as a **mask** sweeping up — exactly like an opening film title sequence (Wes Anderson, A24, *2001: A Space Odyssey*). Staggered `transition-delay` on each line creates the cascade.

**Why for IVAE:** IVAE talks about photography as cinematography. Every section is labelled "Chapter NN —". The film-credits opener is the brand voice, made visible the moment the page loads.

### A2. 3D mouse-parallax hero (perspective + translateZ)
**What:** The hero `<section>` uses `perspective: 1400px`. The `.ch-stage` inside it has `transform-style: preserve-3d`. A `mousemove` listener writes `mx, my` (-1..1) values; a `requestAnimationFrame` loop lerps them into `tx, ty` and applies `rotateX(ty * -1.2deg) rotateY(tx * 1.6deg)` to the stage and a `translate3d(...)` to the hero photo, which itself sits at `translateZ(-200px)`. The effect: the photo looks like it's floating *behind* the title — a literal stage.

**Why for IVAE:** Affluent destination clients land on the page from luxury blogs, Instagram, and Google Hotels — they expect editorial polish. A subtle cinematic depth on the hero communicates "this is not a Squarespace template" within 600 ms of arrival.

### B1. Sticky-stage manifesto (chapter scroll past pinned image)
**What:** A two-column grid: left column is `position: sticky; top: 0; height: 100vh;` carrying a single editorial photo. The right column is three vertically-stacked text "chapters" totaling ~3× viewport height. As the user scrolls, the photo holds in place and the three text chapters scroll past it, narrating the IVAE manifesto in three acts: *A Studio*, *A Method*, *A Promise*. Each act has its own chapter-tag eyebrow ("Chapter 02 — A Studio"), drop cap on the lede paragraph, and one of them carries a marginalia quote.

**Why for IVAE:** The Apple-product-page mechanic communicates *care*. It says: *we will not waste your scroll*. For a luxury brand whose differentiator is **restraint**, this reads as a perfectly chosen cinema technique. Mobile gracefully collapses to vertical (image first, then text columns).

### B2. Horizontal portfolio reel (sideways scroll-snap film strip)
**What:** Twelve `.reel-frame` cards with **mixed aspect ratios** (3:4, 4:3, 5:7) sit inside a `display: flex; width: max-content; scroll-snap-type: x mandatory` track. The user scrolls horizontally; each frame has `scroll-snap-align: start`. A progress bar tracks `scrollLeft / (scrollWidth - clientWidth)`. The frame counter reads "01 / 12 Roll A". Prev/Next buttons advance by one frame width; arrow keys work too.

**Why for IVAE:** Luxury photographers' portfolios are **films**, not Instagram grids. The mixed aspect ratios match how editorial magazines lay out photography: a portrait next to a landscape next to a vertical-tall. The "Roll A" naming makes the brand feel like film, not digital.

### C1. Mexico interactive SVG map with hover-preview cards
**What:** A hand-drawn SVG of the Mexican coastline (~1100×780 viewBox) with a soft golden grid background and three pulse-animated gold pins at Cancún, Riviera Maya, and Los Cabos. Each pin is keyboard-focusable (`tabindex="0"`, `role="button"`); on hover or focus, an absolutely-positioned `.atlas-card` fades in with a 4:5 photo, a city name in italic Cormorant, and a one-line description. On click, the pin navigates to the destination landing page. Below the map, three `.atlas-list` cards always show as a grid — these are the **mobile fallback** (the SVG map is `display: none` below 768 px).

**Why for IVAE:** The three-coastline story (Cancún / Riviera Maya / Los Cabos) is core to IVAE's positioning. A clickable map turns a static "where we shoot" section into a **chooser** — the user picks their coast and self-routes. The pulse animation on the pins is a tiny gold heartbeat, very on-brand.

### C2. 24-hour golden-hour SVG clock + light spectrum bar
**What:** A 400×400 SVG circular clock divided into 24 ticks (every 15°) generated by JS. The full ring is dim gold; two arcs (sunrise window 05:30–07:00 and sunset window 17:30–19:00) are highlighted with a gold gradient stroke that **draws on** via `stroke-dasharray` + `stroke-dashoffset` transition (2.4 s). A pulse dot at the 06:00 position. A center label reads "The Golden Hour / 06:14 / & 17:42 — March, Cancún". To the right: a horizontal light-spectrum bar (gradient from candle-warm 2,800 K to noon-cold 6,500 K) with the sunrise/sunset windows marked in gold-bordered boxes.

**Why for IVAE:** This is the **why** behind the studio. Vianey shoots only at golden hour. Most websites *say* "we love golden hour." IVAE's v3 *shows* it with a piece of beautiful, custom data viz that lasts longer in the visitor's memory than any tagline. It also reframes "limited availability" as a **feature**: golden hour is brief, and that is why we are exclusive.

### D1. Drop caps on opening paragraphs (Cormorant italic, ~3 line height)
**What:** The opening paragraph of the manifesto and the opening paragraph of the inquiry section each use `::first-letter` to set the first letter at `font-size: 5.4em`, `font-style: italic`, `font-weight: 300`, `float: left`, in `--gold` / `--gold-deep`. The letter occupies roughly three lines of body height — the classic editorial drop cap.

**Why for IVAE:** Drop caps are the unmistakable signal of long-form magazine writing — *Vogue*, *Town & Country*, *The New Yorker*. Two drop caps, used sparingly, signal "this is editorial, not marketing copy" — a permission slip for the reader to slow down.

### D2. Marginalia (italic side notes inside the manifesto)
**What:** A small `<aside class="marginalia">` block inside Chapter 02 with italic Cormorant text, a 1px gold-line left border, and an attribution in small-caps Syne. Visually, it sits *next to* the body copy and reads like a print magazine's pull quote in the margin.

**Why for IVAE:** Marginalia is a luxury-print convention. It communicates "we read magazines". It also gives Vianey a voice in her own homepage without resorting to a giant testimonial slab.

### D3. Pull quote with massive (560 px) Cormorant ornament
**What:** Chapter 06 has a pseudo-element `::before` set to `\201C` (the typographic open quote) at `clamp(280px, 40vw, 560px)`, positioned absolutely at the top center, opacity `.045`. The actual testimonial copy sits in front of it. Below the central pull quote, three `.pq-mini-item` testimonials sit in a 3-column grid divided by a horizontal gold-line rule.

**Why for IVAE:** Reverence. Real reviews from real clients deserve to be **felt**, not skimmed. The 560 px quotation mark is the visual signal that you have entered a moment that matters.

### E1. Magnetic cursor with image preview
**What:** Two layered elements (`.cur-dot` 8 px, `.cur-ring` 42 px) follow the cursor with different lerp coefficients (`0.42` for the dot, `0.18` for the ring) — so the ring trails the dot. On hover over a link, `body.cur-link` swaps the dot to invisible and the ring to 64 px. On hover over `.btn-magnetic.gold` or `.h-cta`, the ring grows to 84 px with a soft gold tint. **Critically:** any link with `data-preview="..."` swaps a small 220×280 px image preview that floats next to the cursor — visitors get a glimpse of the destination before clicking. Disabled on `(hover: none)`. Disabled on `prefers-reduced-motion`.

**Why for IVAE:** The cursor preview turns nav links into a **mini-portfolio**. Hovering "Atlas" shows a Tulum couple. Hovering "Reel" shows a Mayakoba couple. The visitor is sold on the work before they've clicked.

### E2. Magnetic CTA buttons (translate toward cursor)
**What:** Any element with `data-magnet` calculates its bounding-rect center on `mousemove` and translates by `(cursorX - centerX) * 0.18`, `(cursorY - centerY) * 0.18`. On `mouseleave`, the button springs back to `translate3d(0,0,0)`. The effect: the gold "Begin Inquiry" button feels gravitationally tied to the cursor.

**Why for IVAE:** This is the most-clicked button on the page (the inquiry CTA). Magnetism makes it *playful* without being gimmicky — users know subconsciously that this button **wants to be clicked**.

---

## 2. Trade-offs made

1. **No live video on hero.** I considered a 6–8 s autoplay clip on the hero, but it would require an asset Vianey doesn't yet have, and an MP4 + WebM + AVIF poster fallback would balloon LCP. Instead, I shipped a *much stronger still hero with 3D parallax* — and left a placeholder note (in `wave-3-handoff-spec.md`) for the owner to add a video later by replacing the `.ch-photo` div with a `<video>`.
2. **No `animation-timeline: scroll()` for the gold arc draw.** Spec is still WebKit-only as of 2026-05. I used IntersectionObserver + CSS transitions for cross-browser parity. The fallback **is** the experience — there is no JS-locked behavior.
3. **Mexico map is a stylised abstraction, not a pixel-accurate geography.** Real cartographic SVG would be heavy and would force a viewBox decision that hurts mobile. The hand-drawn coastline communicates *country* without pretending to be Google Maps. The mobile experience drops the SVG entirely and shows a clean three-card list.
4. **No interactive calendar with booked dates.** I considered a 12-month calendar showing booked golden hours but: (a) it would require live data, (b) the Light Study clock already serves the same purpose (showing how few hours are available daily). I de-scoped the calendar to keep the page coherent and fast.
5. **Testimonials are real names** (Samantha Whitfield, Marco Benedetti, Priya Raghavan, Elena V.) carried over from the schema markup — these are placeholders pending Vianey confirming real client quotes per CLAUDE.md handoff notes.

---

## 3. How the IVAE skill frameworks were applied

| Skill | Where it shows up in v3 |
|---|---|
| `design-critique` | Visual hierarchy: Cormorant 300 italic h2 dominates each chapter; Syne uppercase eyebrow + 32 px gold rule + chapter number creates the consistent "section opener" pattern. The eye lands on **the photo first**, then the chapter label, then the h2 — verified at 375, 768, 1200, and 1920 viewports. |
| `design-system` | Every color, spacing, typography, motion, and z-index value references `/styles/tokens.css`. Not a single hardcoded hex except inside the `--gold` SVG gradient stop colors (which deliberately use the canonical `--gold-deep`/`--gold`/`--gold-hover` values). All eyebrow tracking uses `--tracking-eyebrow-*`. All easing uses `--ease`. |
| `accessibility-review` | See `wave-3-accessibility-report.md`. WCAG 2.1 AA verified across hero, sticky-stage, reel, atlas, pull-quote, dossier, journal, and footer. |
| `ux-copy` | Every CTA verb-led ("Begin Inquiry", "Send your letter", "Read the case study"). Form labels above inputs, italic placeholder hints. Form copy reframed as "a letter, not a form" — the most distinctive copy choice on the page. Empty states for the inquiry form would say "Tell us about the trip the way you'd tell a friend." |
| `design-handoff` | See `wave-3-handoff-spec.md`. Every animation includes duration, easing token, and trigger. Every breakpoint specified. All edge cases (touch, reduced motion, no-JS) documented. |

---

## 4. Why this fits IVAE specifically

IVAE Studios is not a "wedding photographer's website." It is a **studio**, a **brand**, an **editorial point of view**. v3 is the first version of the homepage that actually *looks* like a studio:

- The film-leader loader (`Take 01 — Roll A`) plants the cinema metaphor in the first second.
- "Chapter NN —" labels turn every section into a magazine feature opener.
- The drop caps and marginalia bring print-magazine grammar to a website.
- The 24-hour clock is **content unique to IVAE** — no competitor has it, no template ships with it.
- The map has only three pins, and the smallest pin gets the same care as the largest. That is what restraint looks like.
- The inquiry section is "a letter, not a form." Affluent clients have filled out a thousand forms; they have filled out very few letters.

Every choice in v3 supports the same idea: **luxury is not louder, it is quieter, slower, more deliberate**. v3 makes the homepage say that, before the visitor has read a single word of body copy.
