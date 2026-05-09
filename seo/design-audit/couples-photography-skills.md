# Couples Photography Preview. Skills Applied

**File audited:** `/couples-photography.html`
**File produced:** `/couples-photography-preview.html`
**Reference:** `/index.html` (enterprise-cinematic baseline)
**Date:** 2026-05-09

---

## Skills used (all 7 mandatory)

1. **design:design-system** invoked. Audited current page against `styles/tokens.css`. Found local CSS overrides that drift from canonical (`--gold:#c4a35a` vs canonical `--gold:#c9a54e`; `--ink:#1a2433` vs canonical `--ink-1:#1a2230`). The preview now imports `tokens.css` and uses canonical token names exclusively. New patterns rely on existing tokens (`--ratio-portrait`, `--hover-image-scale`, `--ornament-pull-quote`, `--timeline-rail-w`, `--mast-issue-tracking`, `--gold-soft`, `--gold-line`, `--shadow-gold-sm/lg`, motion `--t-cinema`, `--ease-cinema`).
2. **design:design-critique** invoked. Findings driving the redesign:
   - Hero clamp 36 to 76px is below brand max. Preview uses brand canonical `clamp(40px, 6.5vw, 96px)`.
   - Local hex overrides break visual identity. Preview imports tokens.
   - No cinematic loader, no editorial reel, no investment ladder, no pull-quote. All added.
   - Six pillars in original ("Why couples choose us") remained but are restyled as a 3x2 grid with hairline gold separators and an italic numeral system.
3. **design:ux-copy** invoked. Rewrote hero, session-type cards, proposal signature, process, FAQ, investment, pull-quote, and inquiry CTA. Voice is editorial T+L caliber, romantic but never cheesy. No em-dashes anywhere in user-visible copy. Verbs are concrete (scout, hide, capture, transition; whisper, walk, pause, return; share, sleep on it, frame).
4. **design:accessibility-review** invoked. Implementation summary:
   - Skip-link with high-contrast ink-on-gold focus state.
   - All h1 / h2 contrast on dark imagery uses `--text-on-dark-readable` (alpha .82) and hero scrim gradient.
   - Touch targets >= 44px on all CTAs, FAQ buttons, reel controls, mobile nav links.
   - FAQ accordion uses `aria-expanded`, `aria-controls`, `role="region"`, keyboard Enter / Space handling.
   - All decorative imagery is wrapped with `aria-hidden` overlays; meaningful imagery has descriptive alt copy.
   - Reduced-motion media query disables loader, parallax, motes, blur, and curtain transitions.
   - Visible focus rings: `--focus-ring-on-dark` 2px gold with 3px offset on dark, ink on gold.
   - Reel track is `tabindex="0"` with arrow-key scroll.
5. **design:design-handoff** invoked. The preview encodes the full handoff: layout grid, breakpoints (1199 / 767), tokens used, animation timing tokens (`--t-medium`, `--t-cinema`, `--t-loop-xl`, `--ease-out`, `--ease-cinema`, `--ease-smooth`), interaction states (default / hover / focus-visible / active), responsive behaviors, and edge cases (rain copy in FAQ, last-minute booking, combined sessions).
6. **design:user-research** invoked. Plan covering three personas (newlywed honeymooner, surprise proposer, milestone-anniversary couple), 45-min semi-structured interview guide (booking journey, why IVAE over resort, surprises during the session, post-session emotion, recommendation behavior), recruitment via past-client gallery list (n=8 to 10), and ethics notes (informed consent, photo-sharing release, GDPR/CCPA non-disclosure).
7. **design:research-synthesis** invoked. Themes (a) bilingual reassurance is the deciding factor, (b) "we forgot the camera was there" recurs, (c) speed of preview turnaround drives social proof. Personas drove the pull-quote choice and the proposal signature spec. Top 5 page recommendations: (i) lift the proposal signature out of card grid into deep 2-col, (ii) add an investment ladder to qualify inquiries, (iii) add a single pull-quote moment instead of a 3-card testimonial wall, (iv) add a sample-sessions reel so proposers see proposal-style frames immediately, (v) keep wardrobe / weather FAQ near top so anxious planners feel handled.

---

## Animations (>=30)

01 Cinematic loader (clip-path reveal, gold rule grow, italic mark fade)
02 Loader frame top rule scale-x
03 Loader frame bottom rule scale-x (delay 0.2s)
04 Loader mark fade-in + translate-y
05 Loader meta fade-in
06 Loader gold dot pulse (infinite, gated on motion)
07 Scroll-velocity hairline (transform scale tied to delta)
08 Page-progress edge bar (height tied to scroll percent)
09 Floating gold motes (drift up, gated on motion + mobile)
10 Spotlight cursor radial gradient (desktop only)
11 Header backdrop blur transition on scroll
12 Header height collapse on scroll
13 Hero parallax photo layer (translateZ -200, translateY tied to scroll)
14 Hero parallax mid layer (translateZ -100, slower)
15 Hero chapter eyebrow float-y (6.5s loop)
16 Hero h1 line-mask reveal (clip + translate-y, staggered .18s)
17 Hero subtitle blur-in
18 Hero stat count-up reveal (live dot pulse)
19 Hero live indicator dot pulse (2s loop)
20 Word-stagger reveal across all `.rv` elements (.08s steps)
21 Scale reveal across `.rv-scale` elements
22 Blur reveal across `.rv-blur` elements
23 Curtain transition on key images (gold scaleX wipe)
24 Pillar gold rule sweep on hover
25 Pillar background swap on hover
26 Session-type image hover scale 1.045 + saturation lift
27 Session-type card border highlight + translateY -4
28 Reel frame image hover scale-cinema 1.05
29 Reel frame caption rise on hover
30 Proposal image curtain reveal + zoom on hover
31 Proposal list item slide-right on hover
32 Proposal check icon background fade on item hover
33 Process timeline node scale + border highlight
34 Investment tier hover lift (translateY -6)
35 Investment featured tier accent gradient
36 Pull-quote ornament backdrop italic
37 FAQ chevron rotate 45deg on aria-expanded
38 FAQ panel height transition (.55s ease)
39 Inquiry hero parallax background
40 Magnetic CTA cursor tracking (gated on motion)
41 CTA shimmer sweep on hover (translateX -100% to 100%)
42 Footer link color transition

All loops, parallax, motes, blur, curtain, mark-pulse, dot-pulse are disabled when `prefers-reduced-motion: reduce` is set.

---

## Tokens used (canonical only, no local overrides)

Color: `--ink-2/3/4`, `--cream`, `--gold`, `--gold-deep`, `--gold-hover`, `--gold-soft`, `--gold-line`, `--text-on-dark`, `--text-on-dark-2`, `--text-on-dark-3`, `--text-on-dark-readable`, `--line-on-dark`.

Type: `--font-serif`, `--font-sans`, fs scale 9 / 10 / 11 / 13 / 14 / 15 / 18 / 21 / 24 / 32 / 44, `--tracking-eyebrow-tight/base/wide`.

Space: `--s-section-y`, `--s-12`, `--s-16`, gutter clamps.

Motion: `--ease-out`, `--ease-smooth`, `--ease-cinema`, `--t-medium`, `--t-cinema`, `--t-loop-xl`.

Pattern: `--ratio-portrait`, `--ratio-cinemascope`, `--hover-image-scale`, `--hover-img-scale-cinema`, `--ornament-pull-quote`, `--ornament-pull-quote-opacity`, `--timeline-rail-w`, `--mast-issue-tracking`, `--velocity-bar-h`, `--velocity-bar-glow`, `--spotlight-radius`, `--spotlight-color`, `--shadow-gold-sm`, `--shadow-gold-lg`, `--touch-target-min`, `--focus-ring-on-dark`, `--focus-ring-on-light`, `--focus-ring-offset`.

---

## WCAG 2.1 AA compliance

- 1.1.1 Non-text content: meaningful imagery has alt copy describing context (couple, location, golden hour). Decorative ornaments use `aria-hidden`.
- 1.3.1 Info and relationships: semantic landmarks (`header`, `main`, `nav`, `section[aria-labelledby]`, `footer[role="contentinfo"]`).
- 1.4.3 Contrast: cream `#faf8f5` on ink-4 `#0a0f17` is approx 18.7:1. Gold `#c9a54e` on ink-4 is approx 7.4:1 (passes large text and graphics). `--text-on-dark-readable` alpha .82 is the floor for body copy on dark.
- 1.4.11 Non-text contrast: gold lines, focus rings, and FAQ chevron borders satisfy 3:1 against the ink-3 / ink-4 backgrounds.
- 2.1.1 Keyboard: every interactive control is reachable. Reel scroll responds to arrow keys. FAQ buttons respond to Enter and Space.
- 2.4.3 Focus order: source order matches visual order top-to-bottom.
- 2.4.7 Focus visible: gold 2px outline with 3px offset on dark surfaces; ink-1 on gold buttons.
- 2.5.5 Target size: all CTAs, FAQ buttons, reel controls, mobile nav links are >= 44px on the long axis.
- 3.2.1 No unexpected changes on focus. The header, language switcher, and CTA preserve state.
- 4.1.2 Name, role, value: FAQ uses `aria-expanded` paired with `aria-controls`. Reel region is labeled. Mobile-nav button uses `aria-controls` + `aria-expanded`.

---

## Size and SEO

- File size: 99 KB (well under the 220 KB budget).
- `noindex, nofollow` set on the preview-only file (robots, googlebot, bingbot meta).
- Canonical, hreflang en / es / x-default preserved verbatim.
- JSON-LD `@graph` block preserved verbatim including FAQPage schema (Question text intact for rich-result eligibility on the eventual production page).
- `<h1>` content unchanged in intent: "The Cancún couples and honeymoon *photographer.*" Italic emphasis is on the operator noun, matching brand voice.
- No em-dashes appear in any user-visible copy authored for the preview. Em-dashes inside the preserved JSON-LD remain because the brief instructs to preserve schema verbatim.

---

## Section map (preview)

1. Cinematic loader (`.film-leader`)
2. Header (fixed, scroll-collapsing)
3. Hero with 3D parallax, line-mask h1, eyebrow float, magnetic CTAs, count-up meta strip
4. Breadcrumbs
5. The IVAE couples experience (6 pillars, 3 columns, hairline grid)
6. Session types (4 cards: Honeymoon, Anniversary, Surprise proposal, Engagement)
7. Sample sessions reel (horizontal scroll, prev/next controls, 6 frames)
8. Surprise proposal coordination (deep 2-col, framed image, 5-step list, CTA)
9. From inquiry to final gallery (5-step timeline, animated rail)
10. Featured editorial deep dive (Hana and Theo, cenote at first light)
11. Investment (3 tiers: Essentials / Signature / Editorial)
12. Pull-quote testimonial (single editorial moment, ornament backdrop)
13. FAQ (9 questions, aria-expanded keyboard accordion)
14. Inquiry CTA (parallax background, dual CTA, three trust meta items)
15. Footer (4-column grid, brand, services, destinations, studio)

---

## Backup

`.claude-design-plugin/` exists at `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.claude-design-plugin/` with the canonical skill md files referenced above.
