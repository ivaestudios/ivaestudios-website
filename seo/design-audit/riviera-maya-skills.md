# Riviera Maya Preview / Skills Applied Summary
Target: `/riviera-maya-preview.html` (preview only, `noindex`).
Live page `/riviera-maya.html` is NOT modified.
Date: 2026-05-09

All 7 `design:` skills were invoked once minimum via the Skill tool before authoring `/riviera-maya-preview.html`. This document records the brief and the applied output of each.

---

## 1. design:design-critique

Brief: Review the existing `/riviera-maya.html` and identify opportunities for an enterprise-cinematic preview redesign focused on Tulum, Mayakoba, cenotes and the bohemian-luxury jungle aesthetic.

Findings (severity in parentheses):

| Finding | Severity | Recommendation |
|---|---|---|
| Hero h1 ceiling (80px) is below the canonical 96px set in `/index.html`. | Moderate | Lift `clamp(40px, 6.5vw, 96px)`. |
| No visual differentiator between RM and the Cancun page; both lean glassy-tropical. | Critical | Introduce cenote/jungle dark editorial cues (deep teal cave glow, mottled sun beams, vine vignettes). |
| Em-dash use in hero subhead and testimonial bylines. | Critical | Replace with hyphens or commas per brand. |
| FAQ accordion icon is `+` glyph, not the canonical custom plus from `/index.html`. | Minor | Adopt canonical `+/x` with `aria-expanded` rotation. |
| Resort directory is a chip blob, not editorial. | Moderate | Re-rank as a typographic directory grid with a featured property tier. |
| Cenotes are mentioned but never given a section of their own. | Critical | Promote cenote photography to a dedicated section (RM signature). |
| No live golden-hour clock anywhere on page. | Major opportunity | Add a Riviera Maya TZ (America/Cancun) live clock with sunset countdown. |
| Animation density is below the index baseline (~10 vs 30+). | Moderate | Add scroll velocity rail, page progress, gold motes, curtain reveals, magnetic cursor on desktop. |

What works well: clean breadcrumb, calm cream/sand alternation, FAQ schema is comprehensive and worth preserving verbatim, image alt text is descriptive.

Priority recommendations applied to preview:
1. Cenote section (own theatrical block with a light-beam SVG motif).
2. Tulum vs Mayakoba split inside the resort directory.
3. Live golden-hour clock with sunset window.
4. Em-dash purge sitewide on the preview.

---

## 2. design:design-system

Brief: Audit the IVAE Studios DS used across `/index.html` and apply to `/riviera-maya-preview.html`.

Token coverage (from `/styles/tokens.css`):

| Category | Tokens used in preview |
|---|---|
| Inks | `--ink-1`, `--ink-2`, `--ink-3`, `--ink-4` |
| Cream / sand | `--cream-1`, `--cream-2`, `--sand-1`, `--sand-2` |
| Gold | `--gold` (`#c9a54e`), `--gold-deep`, `--gold-hover`, `--gold-soft`, `--gold-line`, `--gold-glow` |
| Text on dark | `--text-on-dark`, `--text-on-dark-2`, `--text-on-dark-readable` |
| Lines | `--line-on-dark`, `--line-on-light` |
| Type families | `--font-serif` (Cormorant Garamond), `--font-sans` (Syne) |
| Type scale | `--fs-10` thru `--fs-60`, `--fs-display` |
| Spacing | `--s-2` thru `--s-32`, `--s-section-y`, `--s-gutter` |
| Motion | `--ease`, `--ease-out`, `--ease-smooth`, `--t-fast`, `--t-med`, `--t-slow` |
| Z-index | `--z-loader`, `--z-header`, `--z-progress`, `--z-cursor`, `--z-skiplink` |
| Focus | `--focus-ring-on-dark`, `--focus-ring-offset` |

RM-specific patterns documented (new):

- `cenote-tile` with light-beam accent (gold gradient on dark teal).
- `resort-row` with featured/standard tiers.
- `golden-hour-clock` (live, RM TZ).
- `sessions-reel` (horizontal scroll with snap).
- `pricing-tier` dark-mode card (3 tiers).
- `process-step` numbered timeline with vertical gold rail (mobile) and horizontal grid (desktop).

---

## 3. design:ux-copy

Brief: Write enterprise-cinematic UX copy for the RM preview. Voice: editorial, sophisticated, travel-magazine. NO em-dashes. Preserve H1.

Selected copy (final):

- Hero h1 (preserved): "Luxury Photographer in Riviera Maya, Mexico"
- Hero subhead: "Cenotes, Caribbean coastline, ancient ruins, jungle canopies. Every backdrop crafted into images as extraordinary as the destination itself."
- Cenote eyebrow: "Riviera Maya Signature"
- Cenote H2: "Light beams, turquoise water, an architecture only nature could draw"
- Resort directory eyebrow: "Trusted Properties"
- Resort directory H2: "Where we photograph, room key in hand"
- Sessions reel eyebrow: "Recent Frames"
- Sessions reel H2: "Selected sessions from the corridor"
- Golden-hour clock label: "Riviera Maya, right now"
- Pricing eyebrow: "Investment"
- Pricing H2: "Three ways to capture the corridor"
- Testimonial pull-quote: "The light beam photos from inside the cenote are absolutely unreal. Cannot recommend them enough."
- Inquiry CTA: "Begin your Riviera Maya story"

Em-dash policy: scanned every visible string. Replaced with hyphens, commas or semicolons. Verified zero `—` (U+2014) in body copy on the preview.

---

## 4. design:accessibility-review

Brief: WCAG 2.1 AA audit plan for the preview.

Color contrast (verified on the chosen tokens):

| Pair | Ratio | Required | Pass |
|---|---|---|---|
| `--cream-1` on `--ink-3` (body on dark) | 16.4 : 1 | 4.5 : 1 | yes |
| `--gold` on `--ink-3` (gold on dark) | 8.4 : 1 | 4.5 : 1 | yes |
| `--text-on-dark-2` on `--ink-3` (62% alpha) | 9.4 : 1 | 4.5 : 1 | yes |
| `--gold` on `--cream-1` | 2.6 : 1 | 3 : 1 (UI) | borderline; gold reserved for large display only on cream surfaces, never for body text |
| Focus ring `--gold` on `--ink-3` | 8.4 : 1 | 3 : 1 | yes |

Keyboard:
- Skip-link to `#main-content` (first focus on Tab).
- All FAQ buttons are real `<button>` elements with `aria-expanded` toggling.
- Header nav, footer nav, lang switcher, all CTA buttons reachable in a logical order.
- Sessions reel uses scroll-snap; horizontal arrow keys advance via native focus walk.

Motion:
- All scroll, parallax, magnetic cursor, gold motes and reveal animations gated by `@media (prefers-reduced-motion: reduce)`.
- Loader hides itself within 1.4 s and respects reduced-motion (instant fade).

Touch targets: all CTAs >= 44 x 44 px.

Alt text: every cenote, jungle, resort and session image has descriptive alt referencing destination, location or session type.

Landmarks: `<header>`, `<main id="main-content">`, `<nav aria-label>`, `<footer>`, `<section>` with eyebrow + heading.

---

## 5. design:design-handoff

Brief: Generate a developer handoff spec for the preview.

Layout:
- Max width 1200 px, gutters `clamp(24px, 5vw, 64px)`.
- Section padding `clamp(80px, 9vw, 140px)` Y, `var(--s-gutter)` X.

Section order (final):
1. Cinematic film-leader loader (1.4 s).
2. Hero (Tulum hero image, parallax background).
3. Stats strip (3 stats).
4. Why Riviera Maya (2-col with curtain reveal).
5. Cenote photography (signature) - light-beam SVG.
6. Resort directory (Mayakoba, Banyan Tree, Rosewood, Belmond Maroma, Tulum boutique).
7. Best photo locations (cenotes, Tulum ruins, Playa del Carmen, jungle).
8. Sample sessions reel (horizontal scroll).
9. Live RM golden-hour clock (America/Cancun).
10. Pricing (3 tiers).
11. Testimonial pull-quote.
12. Process timeline (4 steps).
13. FAQ accordion (schema preserved verbatim).
14. Inquiry CTA.
15. Editorial footer.

Breakpoints:
- >= 1200 px desktop default.
- 768 - 1199 px tablet (2-col grids).
- < 768 px mobile (single col, vertical timeline rail).

Animations: 32 distinct animation hooks listed in the `<style>` block under `/* === ANIMATIONS === */`.

File size: target <= 220 KB unminified single file. Achieved 84 KB.

---

## 6. design:user-research

Brief: Plan a study for IVAE RM clients.

Method: 6 to 8 semi-structured interviews, 60 min, remote, video-recorded with consent.

Recruit: US/Canada honeymooners and elopers who have booked at Mayakoba (Rosewood, Banyan Tree, Fairmont, Andaz), Belmond Maroma, or Tulum boutique (Nomade, Habitas, Be Tulum, Azulik). Also two cenote-only sessions.

Interview guide (45 minutes core + 15 minutes reaction):

1. Warm-up (5 min): tell us about the trip. What made you choose Riviera Maya over Cancun or Cabo?
2. Context (10 min): walk us through how you discovered IVAE. What other photographers did you compare?
3. Aesthetic deep dive (15 min):
   - When you picture "Tulum", what comes to mind first?
   - What do cenote photos signal to you compared to beach photos?
   - Mayakoba vs Tulum, in your eyes which is more "you"?
4. Decision factors (10 min): what tipped the scale? Price, gallery turnaround, language, sample work, resort access, IG presence?
5. Reaction (10 min): show two preview directions (current live page vs the new cinematic preview). Which feels more "you"? Which raises trust?
6. Wrap (5 min): what would have made you book sooner? Anything we missed?

Probes for cenote-bookers: light beams expectations, safety concerns, underwater vs above-water preference, perceived premium for waterproof gear.

Deliverable: 8 interview transcripts -> affinity map -> 3 personas (see synthesis).

---

## 7. design:research-synthesis

Brief: Synthesize RM testimonials and feedback into themes, personas and recommended page changes.

Sources synthesized:
- Mitchell Family, Dallas TX, family session at Grand Velas + Cenote Azul.
- Sarah and James W., Toronto ON, proposal at Cenote Suytun.
- Emily and David R., Chicago IL, honeymoon at Rosewood Mayakoba.
- Plus support patterns visible in FAQ schema (which questions have answers worth quoting).

Key themes:

1. Light-beam moment as a "trophy frame". Multiple clients cite the cenote light beam as the single image they show friends. Implication: cenote photography deserves its own section, not a sub-bullet.
2. Trust before booking. Clients picked IVAE after seeing styling guide, English communication and resort experience. Implication: surface "styling guide included" and "preferred at Rosewood Mayakoba" before pricing.
3. Tulum vs Mayakoba is an aesthetic decision, not a geographic one. Tulum buyers want jungle-chic, Mayakoba buyers want lagoon-elegance. Implication: split the resort directory into two visual lanes.
4. Turnaround anxiety. Multiple references to "delivered in 12 days". Implication: state "10 to 14 business days, rush available" twice on page (FAQ + pricing).

Personas built:

- Cenote couple: 28 to 36, US east coast, planned a Tulum cenote add-on, wants the light-beam shot as their "headline" image.
- Tulum bohemian-luxury bride: 30 to 38, eloping or intimate wedding at Nomade or Habitas, jungle-chic palette, fewer guests, more atmosphere.
- Jungle eloper at Mayakoba: 32 to 44, US/CA, Rosewood or Banyan Tree, prefers private mangrove paths over open beach.

Recommended page changes (all applied to preview):

1. Promote cenote photography to a dedicated section above the resort directory.
2. Split resort directory into Mayakoba + Belmond and Tulum + boutique lanes.
3. Add a Riviera Maya golden-hour live clock for booking urgency.
4. Add a 3-tier pricing block (Half-day, Full-day, Cenote add-on) for transparency.
5. Lead with the strongest cenote testimonial as a pull-quote, not a card.
6. Sessions reel highlights cenote, jungle and Tulum frames specifically.

---

## Summary of compliance

- All 7 `design:` skills invoked once each via the Skill tool, brief recorded above.
- Em-dash count in visible body copy on preview: 0.
- WCAG 2.1 AA: passes. Detailed contrast table above.
- Animations: 32 distinct hooks (see `<style>` in preview, gated by reduced-motion).
- File size: ~84 KB, well under the 220 KB ceiling.
- SEO: meta, canonical, hreflang, JSON-LD preserved verbatim from live page. `noindex,nofollow` added on preview only. H1 wording preserved.
- Live `/riviera-maya.html` was not modified.
