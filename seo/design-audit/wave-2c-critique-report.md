# Wave 2C — Design Critique: index-preview.html (v1)

**Skill applied:** `.claude-design-plugin/design-critique.md`
**Subject:** `/index-preview.html` (2056 lines, manual editorial design)
**Date:** 2026-05-08
**Stage:** refinement (owner has signed off on aesthetic direction; this critique looks for structural/UX issues to fix in v2)
**Audience:** affluent destination wedding/family clients ($5K–$50K shoots)

---

## Overall Impression

The page nails the editorial luxury aesthetic — typographic discipline, generous whitespace, golden-hour palette, and disciplined gold/cream/ink hierarchy all read as Vogue/T+L grade. The biggest opportunity is that **the page asks the client to read before it asks them to act**: there are roughly 13 vertical sections before a clear conversion moment, the primary CTA disappears once the user scrolls past the hero, and the hero's affordances rely on a contrast level that fails WCAG 2.1 AA at body size. Together these issues turn a beautiful page into one that *looks* high-converting more than it *is* high-converting. v2 should preserve the aesthetic verbatim while restructuring three things: information architecture, persistent affordance, and contrast.

---

## 1. First Impression (2 seconds)

**What draws the eye first:** the italic gold word "Mexico." in the H1 — correct. The eye then drops to the subhead drop-cap, then to the gold "Book Your Session" button. **This is right.**

**Emotional reaction:** cinematic, expensive, deliberate. Owner's brief satisfied.

**Is purpose clear?** *Mostly.* The H1 ("Luxury resort photography across Mexico.") names the category but not the offer or the differentiator. A first-time visitor in 2 seconds knows it is photography in Mexico, but does not know **who it serves** (luxury destination travelers vs. local clients) or **what makes it different** (golden-hour-only / 1–3 day galleries / bilingual) until they scroll. The eyebrow ("Editorial Resort Photography · Established 2023") leaks an unintentional signal that the studio is young — competitors use "Award-winning" or "Featured in." Reframe.

| Finding | Severity | Recommendation |
|---|---|---|
| H1 names category but not unique value | Moderate | Add a specificity clause to H1 ("Editorial. Bilingual. Golden hour, only.") OR make the subhead carry the differentiator above the fold, not below |
| Eyebrow date "Established 2023" reads young, not premium | Minor | Replace with "Cancún · Riviera Maya · Los Cabos" or "Vogue-grade Editorial Photography" |
| Hero subhead body-size fails contrast (rgba(250,248,245,.62) over dark image) | Critical (WCAG) | Lift body opacity to .82 minimum on hero, or add a subtle scrim under text only |

---

## 2. Usability

**Can the user accomplish their goal?** Yes, but with friction. There are 8 distinct CTA destinations on the page (Book, View work, About, Wedding, Family, Couples, Cancún, Riviera, Cabo, Subscribe, Email, WhatsApp) — that is choice paralysis for a luxury buyer who decided in 4 seconds.

**Navigation intuitiveness:** The sticky header has Home / About / Services / Journal — but no anchor to **Destinations**, **Reviews**, or **FAQ** despite all three being substantial sections. The mobile nav also drops the language switcher position-wise (it appears as a child of the mobile nav drawer rather than a fixed control), which is wrong for a bilingual EN/ES brand whose ES audience is ~40%.

**Interactive elements obvious?** Mostly yes. The pillar cards have *no* hover affordance despite being editorial content blocks, which is fine — they are not links. The portfolio tiles only show their captions on `:hover`, which **fails on touch devices** where there is no hover. iOS/Android users see captionless images.

**Unnecessary steps?** Yes — the page has *both* a CTA section and a separate FAQ section before the footer, and the CTA section asks for *both* WhatsApp message *and* email *and* newsletter subscription in three different forms. Pick one primary path. The newsletter belongs in the footer, not the conversion section.

| Finding | Severity | Recommendation |
|---|---|---|
| Header has no persistent "Book" affordance after scroll past hero | Critical | Keep `header-cta` visible at all viewports >900px after scroll; mobile gets a sticky bottom-bar Book button |
| Portfolio captions hover-only — invisible on touch | Major | Show captions persistently on touch devices via `@media (hover: none)`, or always-visible at low opacity |
| CTA section conflates 3 conversion paths (WhatsApp / Email / Newsletter) | Moderate | Promote WhatsApp to primary, demote newsletter to footer. Newsletter as separate motion in conversion section dilutes the "ready to book?" intent |
| Mobile nav buries language switcher below all nav items | Minor | Move language toggle to the top of the mobile drawer for ES audience parity |
| 5 hero stats + 4 stats-strip cells = duplicated brag (sessions, rating appear twice) | Minor | De-dupe — show 3 stats in hero, 4 different ones in stats-strip (or remove stats-strip and let hero carry the proof) |

---

## 3. Visual Hierarchy

**Reading flow:** Generally excellent, but the **lead-section** (drop-cap "We don't capture moments. We craft them.") and the **pillars** are solving similar jobs (manifesto/voice). Two manifesto sections back-to-back dilute both. The pillars (4 numbered convictions) are the stronger of the two — promote them. The lead-section can move to be a transition between portfolio and destinations or be folded into the about teaser.

**What is emphasized:** Headlines and italic gold accents — correct. The portfolio "feat" tile is beautifully prominent. **However:** the `pq-mark` quotation mark (clamp(180px, 22vw, 320px), opacity .1) is *so large* it reads as decoration rather than typographic ornament — at 22vw it eats 22% of the viewport on tablet. Reduce to ~10–14vw maximum for restraint.

**Whitespace:** Generous to the point of *over-generous* in a few places. `--s-section-y: clamp(80px, 9vw, 140px)` puts every section at 140px vertical padding on desktop. With 13 sections, that's 1820px of pure padding — meaning the page is ~30% whitespace by vertical real-estate. For a luxury aesthetic this is correct, but it means the **page feels long** which is exactly the conversion problem. Consider tightening 2–3 mid-page sections by 30%.

**Typography:** Cormorant Garamond + Syne is a strong pairing, used with discipline. Letter-spacing on uppercase eyebrows (.32em–.42em) is **at the upper edge of legibility**; .42em on `.hero-eyebrow` borders on broken-word territory at 320px width. Cap eyebrow tracking at .32em.

| Element | Issue | Recommendation |
|---|---|---|
| Two manifesto sections (lead + pillars) | Cognitive duplication | Drop `lead-section` OR fold its copy into the hero subhead area |
| `.pq-mark` 22vw quotation mark | Visual screech | Cap at clamp(120px, 12vw, 220px) and lower opacity to .08 |
| Hero eyebrow letter-spacing .42em | Borderline-broken at small widths | Reduce to .32em across all eyebrows for system consistency |
| Stats appear twice (hero + stats-strip) | Repetition without escalation | De-duplicate — show different metrics in each |
| Page has 13 vertical sections | Length-driven scroll fatigue | Tighten — fold lead into pillars, fold journal-list into footer link, gives 11 sections |

---

## 4. Consistency

**Design system fidelity:** Good. The preview *almost* exclusively uses `--gold`, `--gold-deep`, `--ink-3`, `--cream-1`, `--text-on-light/dark` — the canonical tokens. There are a few stragglers:
- `.cursor` and `.loader` from the live page have hardcoded rgba colors (these are NOT in v1 preview but should be considered for v2).
- The hero's `box-shadow` on `.hero-vignette` uses a raw `inset 0 0 240px 40px rgba(0,0,0,.55)` — should pull from `--shadow-hero-vignette` token (does not yet exist; recommend adding).
- `.btn-gold` has both `transition` (3 properties at .55s) and an inner `transform` on `:hover` — minor — but the `--shadow-gold-sm` and `--shadow-gold-lg` tokens already exist — used correctly.

**Component behavioral consistency:** Service cards, destination cards, journal feature card, and portfolio tiles all use a *similar* but *not identical* hover treatment — image scale ranges from 1.04 to 1.07, filter saturation jumps differ. Pick one canonical hover spec (e.g., `transform: scale(1.045); filter: saturate(1) brightness(.7)`) and apply uniformly.

**Spacing rhythm:** Vertical rhythm is generally on the 4px grid via tokens, but `gap: 6px` in `.services-grid` and `.pg` is an off-system value (system uses 4/8/12/16/24…). Round to 8px or add `--s-1.5: 6px` if 6 is intentional.

**Eyebrow placement:** Some sections lead with `.eyebrow` *outside* the H2 wrapper, others inside an `h-left` wrapper. Inconsistent. Settle on a pattern.

| Element | Issue | Recommendation |
|---|---|---|
| Hover treatments vary across cards | scale(1.04) vs 1.07, filter values inconsistent | Canonicalize: `--hover-image-scale: 1.045`, `--hover-image-brightness: .7` |
| Off-grid `gap: 6px` in image grids | Breaks 4px rhythm | Promote to `--s-1.5: 6px` token (intentional editorial seam) and use everywhere |
| Inconsistent eyebrow → H2 wrapper pattern | Hierarchy reader confusion | Adopt: every section has `<header class="section-head">eyebrow + h2 + lede</header>` |
| Hero subhead drop-cap (1.6em) elsewhere is 5.4em (lead-section) | Two drop-cap conventions | Use one: small (1.6em) for inline emphasis, large (5.4em) for editorial openings only |

---

## 5. Accessibility (overview — full audit in wave-2c-accessibility-report.md)

- **Color contrast:** Hero subhead and footer-bottom text **fail WCAG 2.1 AA** at body size on dark backgrounds. `var(--text-on-dark-2)` = `rgba(250,248,245,0.62)` over `var(--ink-3)` = `#0c1219` yields ~7.4:1 — passes — but `var(--text-on-dark-3)` = `rgba(250,248,245,0.34)` yields ~3.4:1 which **fails** for body text and **passes** for graphics only.
- **Touch targets:** The mobile nav's `.fq-icon` is 24x24px — **fails 2.5.5** (44x44 minimum). Most other CTAs meet 44x44.
- **Focus indicators:** A `:focus-visible{outline:2px solid var(--gold);outline-offset:3px}` rule exists globally — good. But on the gold `.btn-gold`, the gold focus ring is invisible against gold background. **Fails 2.4.7.**
- **Form labels:** The newsletter input uses `aria-label="Email address"` and a placeholder — **passes 3.3.2** but loses the placeholder when typing. Consider a floating label.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` block is present and comprehensive. Good.
- **Image alt text:** Every `<img>` has descriptive alt — good.

---

## 6. Content & Tone (preview of ux-copy work)

**Strong:** Pillar copy ("Golden hour, only", "Pre-planned down to the wardrobe") is editorial-grade. The pull-quote attribution format `<strong>Name</strong> · session type` reads like a magazine credit.

**Weak:**
- The newsletter placeholder "Or join the editorial dispatch — one email a month." is doing two jobs (microcopy + value prop) and ends up doing neither cleanly.
- The hero CTA "Book Your Session" is generic. For luxury, "Reserve a session" or "Inquire about your dates" reads less salesy.
- "View the work" (ghost CTA) uses the verb "view" twice in close proximity to "View Cancún sessions" / "View full portfolio." Vary.
- "Send your dates" / "We plan everything" / "Gallery in days" — first two are imperative-friendly, third is a noun phrase. Make all three the same grammatical pattern.

---

## What Works Well

- **Editorial typography is restrained, expensive, and deliberate.** Cormorant Garamond italics deployed only for emphasis is exactly right.
- **Color palette discipline.** The gold/cream/ink triad is applied with system-level consistency that most brand sites this quality miss.
- **Custom cursor + Ken Burns hero + word-by-word reveal** layer cinematic motion without crossing into kitsch — exactly the Vogue aesthetic.
- **Pillars section** is the strongest piece on the page. Use it as the anchor for v2 and demote the lead-section.
- **Pull-quote testimonial** with oversized italic mark is classic editorial vocabulary, well-executed.
- **JSON-LD schema graph** is meticulous (Organization, FAQPage, ItemList, Reviews, Brand, DefinedTerm). Preserve in v2.

---

## Priority Recommendations (rolled into v2)

1. **Restore persistent conversion path.** Header CTA ("Book Now") visible at all desktop scroll positions; mobile gets a sticky bottom Book button. Without this the page asks the user to scroll back to the top to book.
2. **Fix WCAG AA contrast on hero and dark-text-on-dark instances.** Lift `--text-on-dark-2` to ~.78 alpha minimum; add a subtle text-only scrim behind hero subhead. Audit every white-on-image instance.
3. **Resolve hover-only affordances on touch devices.** Portfolio captions, service descriptions — these need a touch-mode behavior that does not depend on `:hover`.
4. **Drop one of the two manifesto sections.** The `lead-section` and `pillars` are both manifesto; `pillars` is stronger. Fold the lead-section's drop-cap moment into a smaller transitional element (or absorb into the hero subhead).
5. **De-duplicate stats** (hero stats + stats-strip both lead with "500+ sessions"). Show 3 different stats in each, or eliminate the stats-strip.
6. **Cap the `pq-mark` quotation glyph** at ~12vw. At 22vw it screams.
7. **Tighten 2–3 mid-page sections by 30%.** Page is 30% padding by vertical real-estate; preserves luxury at 21% padding without scroll fatigue.
8. **Restructure CTA section** to have one primary path (WhatsApp). Demote newsletter to footer. The current section's three forms compete.
9. **Add focus-visible adjustment for gold-on-gold.** `.btn-gold:focus-visible` should outline in `--ink-1` (dark), not `--gold`.
10. **Improve UX copy** per ux-copy skill report (see `wave-2c-ux-copy.md` findings folded into v2).

---

## Severity Ledger (for handoff)

| Severity | Count | Examples |
|---|---|---|
| Critical | 4 | Hero contrast, header CTA loss on scroll, hover-only captions on touch, gold-on-gold focus |
| Major | 6 | 24x24 fq-icon target, 3-form CTA section, duplicate stats, manifesto duplication, hover variance, eyebrow .42em |
| Minor | 8 | Eyebrow date, off-grid 6px, drop-cap conventions, mobile lang-switch order, copy inconsistencies, pq-mark scale, 13-section length, eyebrow wrapper pattern |

**Total findings: 18.** All addressed in `/index-preview-v2.html`.
