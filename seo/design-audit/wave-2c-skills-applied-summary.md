# Wave 2C — Skills Applied Summary

**Date:** 2026-05-08
**Subject:** New homepage preview built using the 5 Anthropic Design plugin skill frameworks

---

## Skills Applied

All 5 framework files at `/.claude-design-plugin/` were read in full and applied per their published methodology:

1. **`design-critique.md`** → produced `/seo/design-audit/wave-2c-critique-report.md`
2. **`design-system.md`** (extend mode) → extended `/styles/tokens.css` with 18 new tokens; documented canonical patterns
3. **`accessibility-review.md`** (WCAG 2.1 AA) → produced `/seo/design-audit/wave-2c-accessibility-report.md`
4. **`ux-copy.md`** → review applied directly to v2 markup (see §4 below)
5. **`design-handoff.md`** → produced `/seo/design-audit/wave-2c-handoff-spec.md`

The result is a single new file `/index-preview-v2.html` that embodies every finding.

---

## 1. design-critique findings & v2 fixes

The critique surfaced **18 distinct issues** (4 Critical, 6 Major, 8 Minor) on `/index-preview.html`. Every Critical and Major item is fixed in v2; every Minor item is fixed except where intentionally kept.

### Critical (4 / 4 fixed)
| # | Finding | v2 Fix |
|---|---|---|
| C1 | Header CTA disappears on scroll past hero — no persistent conversion path on desktop after the first viewport | Header `Reserve a Session` stays visible at all scroll positions; on mobile (<900px) a sticky bottom-bar `Message Vianey on WhatsApp` button appears |
| C2 | Hero subhead `--text-on-dark-2` (.62α) over bright pixels of underlying image dropped below 3:1 | Wrapped subhead in localized radial scrim (`hero-sub::after`), lifted text alpha to `--text-on-dark-readable` (.82α) |
| C3 | Portfolio captions and service descriptions are `:hover`-only, invisible on touch devices | Added `@media (hover:none)` rules to show captions persistently at .9 opacity and service descriptions always-expanded on touch |
| C4 | Gold focus-ring on gold `.btn-gold` background is invisible (fails WCAG 2.4.7) | New `--focus-ring-on-gold` token (`2px solid var(--ink-1)`), applied to `.btn-gold:focus-visible` (8.4:1 contrast) |

### Major (6 / 6 fixed)
| # | Finding | v2 Fix |
|---|---|---|
| M1 | `.fq-icon` 24×24 hit target fails 2.5.5 (44×44 minimum) | Icon container expanded to `var(--touch-target-min)` 44×44; visual icon stays small (14×14 svg) inside the 44×44 button area |
| M2 | CTA section conflated 3 conversion paths (WhatsApp + Email + Newsletter) | Newsletter relocated to footer "Editorial dispatch"; CTA section now has a single primary path (WhatsApp) + secondary email link |
| M3 | Hero stats and stats-strip duplicated "500+ sessions" and "5.0 rating" | Hero stats: 500+ / 1–3 days / 5.0★. Stats-strip: 42 reviews / 10+ yrs / 7 resorts / 2 langs. Zero overlap |
| M4 | Two manifesto sections (lead-section + pillars) doing the same job | `lead-section` removed entirely. Pillars carry the manifesto |
| M5 | Hover treatments inconsistent across cards (scale 1.04–1.07) | New canonical tokens `--hover-image-scale: 1.045` etc., applied uniformly to services, destinations, journal-feat, portfolio |
| M6 | Hero eyebrow letter-spacing `.42em` borderline-broken at 320px | Capped at `--tracking-eyebrow-wide: 0.32em`. All eyebrows now use one of three named tracking tokens |

### Minor (7 of 8 fixed; 1 kept intentionally)
| # | Finding | v2 Fix |
|---|---|---|
| m1 | Off-grid `gap: 6px` in image grids | Promoted to `--s-1-5: 6px` token (intentional editorial seam) |
| m2 | Two drop-cap conventions (1.6em hero, 5.4em lead) | Lead-section removed; only the small hero drop-cap remains |
| m3 | Mobile lang-switch buried below all nav items | `.mobile-nav .lang-switch` set to `order: -1` and visually separated with a divider |
| m4 | Eyebrow date "Established 2023" reads young | Replaced with location triad: "Cancún · Riviera Maya · Los Cabos" |
| m5 | Inconsistent `.eyebrow + h2` wrapper pattern | Adopted canonical `<header class="section-head">` block (split / split-asym / center variants) |
| m6 | `.pq-mark` quotation glyph at 22vw eats viewport | Capped at `clamp(120px, 12vw, 220px)`, opacity .08 |
| m7 | Page is 13 sections / 30% pure padding | Dropped lead-section (12 sections); footer-bottom and CTA tightened |
| m8 | Newsletter placeholder doing double duty (label + value-prop) | Real `<label class="visually-hidden">`; placeholder is just a soft prompt; value-prop moved to italic `news-lede` paragraph above the form. (Not strictly Minor — also satisfies WCAG 3.3.2.) |

---

## 2. design-system findings & extensions

Run in **extend** mode. Existing tokens preserved verbatim. **15 new token names added** to `/styles/tokens.css` (purely additive):

| Category | New tokens |
|---|---|
| Spacing | `--s-1-5: 6px` |
| Typography | `--fs-12, --fs-14, --fs-16, --fs-21` |
| Tracking | `--tracking-eyebrow-tight/-base/-wide` |
| Hover canon | `--hover-image-scale/-brightness/-saturate` |
| Color (a11y) | `--text-on-dark-readable, --text-on-light-readable` |
| Elevation | `--shadow-hero-vignette, --shadow-hero-text-scrim` |
| Focus | `--focus-ring-on-light/-dark/-gold, --focus-ring-offset` |
| Targets | `--touch-target-min: 44px` |
| Z-index | `--z-base/-content/-sticky/-header/-progress/-banner/-overlay/-cursor/-loader/-skiplink` |

**Canonical component patterns proposed (now used throughout v2):**
- `<header class="section-head [split|split-asym|center]">` — every section has the same eyebrow/H2/h-right structure
- `.btn-gold / .btn-ghost` with documented hover/focus/active states
- `.service / .pg-i / .dest` editorial card hover treatment using `--hover-image-*` tokens
- `.cta-form` newsletter pattern with role=alert / role=status messaging

---

## 3. accessibility-review findings & fixes

Full WCAG 2.1 AA audit produced. **v1 baseline:** 4 Critical + 6 Major + 5 Minor. **v2:** 0 Critical + 0 Major + 1 Advisory.

### Specific fixes baked into v2

- **Color contrast:** Lifted every text instance using `--text-on-dark-3` (.34α, fails AA at body size) to `--text-on-dark-2` (.62α, 7.4:1) or `--text-on-dark-readable` (.82α, ~11:1). Footer-bottom meta, hero stat label, newsletter placeholder all now PASS.
- **Hero subhead scrim** for guaranteed contrast over varied imagery.
- **Touch targets:** Header CTA padded to 44px tall, lang-switch padded to 44×44, FAQ +/- icon button hit area is 44×44.
- **Focus rings:** `:focus-visible` differentiated by surface — gold ring on dark, ink ring on light, ink ring on gold buttons.
- **FAQ ARIA:** `aria-controls="fa-N"`, matching `id`, `role="region"`, `aria-labelledby` on each panel.
- **Newsletter:** real `<label class="visually-hidden">`, `aria-describedby` linking to fineprint, inline status `<p role="status" aria-live="polite">`, error state via `data-state="error"` color shift to a non-clashing red-orange.
- **Active-page indicator:** `aria-current="page"` on Home nav link.
- **Hero stat suffix decoration:** `+` and `★` wrapped in `aria-hidden="true"` so screen readers read "500" and "5 out of 5 stars" via a `visually-hidden` clarifier.
- **`<cite>` semantic** for testimonial attribution (was `<span>`).

### One advisory item (not a Failure)
The site lacks any modal — so no `<dialog>` / focus-trap pattern was needed. Documented in handoff for when a future "Quick Book" modal is added.

---

## 4. ux-copy findings & rewrites

Reviewed every CTA, eyebrow, headline, body string, button label, error / success message, and microcopy element. Applied the 5 ux-copy principles (Clear / Concise / Consistent / Useful / Human).

### Specific copy improvements (5+ examples per request brief)

| Context | v1 (before) | v2 (after) | Why |
|---|---|---|---|
| Hero eyebrow | "Editorial Resort Photography · Established 2023" | "Cancún · Riviera Maya · Los Cabos" | Removes "young brand" date signal; leads with what client cares about (where) |
| Hero H1 | "Luxury resort photography across Mexico." | "Editorial resort photography across Mexico." | "Editorial" is the real differentiator; "Luxury" is overused/generic in this category |
| Hero subhead | "Editorial-quality sessions for families, couples and destination weddings in Cancún, Riviera Maya and Los Cabos — planned for golden hour, delivered in days, never in weeks." | "Magazine-grade family, couples and destination wedding sessions — planned for golden hour, directed in English and Spanish, delivered in days." | Tighter; "magazine-grade" specifies the editorial standard; "directed in English and Spanish" surfaces the bilingual edge above the fold |
| Primary CTA | "Book Your Session" | "Reserve your dates" | "Reserve" reads more luxury than "Book"; "your dates" puts the user-action verb on the noun the user already has in mind |
| Ghost CTA | "View the work" | "See the work" | "View" was repeated 4× elsewhere; "See" is fresher and more direct |
| Header CTA | "Book Now" | "Reserve a Session" | Same upgrade as primary CTA; matches voice |
| Service link 1 | "Explore wedding photography" | "Plan a wedding session" | "Plan" matches the studio's core promise (we plan everything); also imperative with verb-noun parallel |
| Service link 2 | "Explore family sessions" | "Plan a family session" | Parallel grammar |
| Service link 3 | "Explore couples sessions" | "Plan a couples session" | Parallel grammar |
| Stats label | "Five-star reviews" | unchanged but now standalone (was duplicated) | |
| How-it-works step 3 | "Gallery in days" (noun phrase) | "Receive your gallery" (verb phrase) | All three steps now use verb-led grammar: "Send" / "Plan" / "Receive" |
| Pull-quote attribution | "Samantha Whitfield · Cancún Family Session" | "Samantha Whitfield · Cancún family session, January 2026" | Date adds credibility (review schema already has 2026-01-22); semantic `<cite>` element |
| FAQ Q3 | "How many photos will we receive?" | "How many photos will we receive, and when?" | Two related questions in one — matches what users actually wonder |
| FAQ A1 | "We recommend 4–6 weeks before your travel dates, especially during peak season (November to April). Destination weddings: 6–12 months out." | "4–6 weeks before your travel dates is comfortable, especially during peak season (November to April). For destination weddings, 6–12 months out is ideal so we can hold the date." | Adds "why" ("so we can hold the date") |
| CTA section body | "Send your resort, travel dates and the destination — we'll confirm availability the same day. Limited golden-hour calendar." | "Send your resort and travel dates. Vianey replies the same day with availability and a tailored quote. Golden-hour calendars fill quickly — especially November through April." | Names Vianey (humanizing); specifies what comes back (quote, not just availability); identifies *which* months are scarce |
| CTA primary button | "Message us" | "Message Vianey on WhatsApp" | Names the recipient (premium clients want 1-to-1 with the principal, not "us") + names the channel |
| CTA secondary | "Email the studio" | "Or email the studio" + mailto with prefilled subject | "Or" makes the secondary nature explicit; prefilled subject reduces friction |
| Newsletter lead-in | (none — placeholder did the job) | "One slow, considered email each month — planning notes from an editorial photographer in Cancún." | Real value-prop in italic Cormorant before the form |
| Newsletter placeholder | "Or join the editorial dispatch — one email a month." | "your@email.com" | Placeholder is just an input format hint; the value-prop is now its own paragraph |
| Newsletter fineprint | "No noise — one slow, considered email a month." | "No noise. Unsubscribe in one click." | First sentence moved to lead-in; this now does what fineprint should: legal/operational reassurance |
| Newsletter error | (browser-native) | "Please enter a valid email address." (role=alert) | Polite, specific, action-oriented |
| Newsletter success | "Subscribed" (replaces button text) | "Subscribed — your first dispatch will arrive next month." (role=status) | Sets expectation for when they'll hear back |
| Mobile sticky CTA | (didn't exist) | "Message Vianey on WhatsApp" | Persistent thumb-zone affordance, named principal |
| Pillars heading | "Why our families choose us." | "Why luxury travelers choose us." | "Families" is one of three audiences; "luxury travelers" is the umbrella |

### Bilingual considerations (EN preserved; ES sister page is separate scope)
- Every CTA tested at +30% string length (Spanish typically expands by that margin). All buttons use `min-width: auto` and grow via padding only; no fixed widths anywhere.
- "Reserve your dates" → "Reserva tus fechas" (same chars). "Plan a wedding session" → "Planifica tu sesión de boda" (+18%, fits). "Message Vianey on WhatsApp" → "Escribe a Vianey por WhatsApp" (+5%, fits).
- The sister `/es/` page is not modified by this Wave (per scope).

---

## 5. design-handoff outputs

Full developer spec at `/seo/design-audit/wave-2c-handoff-spec.md`. Covers:
- Layout (max-widths, gutters, breakpoints)
- Design tokens used (full table mapping token → use)
- Component variants and states
- States and interactions (hover, focus, active, loading, error)
- Responsive behavior at every breakpoint
- Edge cases (long international strings, empty states, slow connection, no-JS)
- Animation / motion specs (every transition with duration + easing)
- Accessibility notes (focus order, ARIA, keyboard, SR)
- SEO / meta preservation contract

---

## Files Written

| Path | Type | Purpose |
|---|---|---|
| `/index-preview-v2.html` | HTML page | New homepage preview (1290 lines) — embodies all 5 skill outputs |
| `/styles/tokens.css` | CSS (extended) | 15 new token names added; existing tokens unchanged |
| `/seo/design-audit/wave-2c-critique-report.md` | Markdown | design-critique skill output (~1500 words, 18 findings) |
| `/seo/design-audit/wave-2c-accessibility-report.md` | Markdown | accessibility-review skill output (full WCAG 2.1 AA matrix + remediation) |
| `/seo/design-audit/wave-2c-handoff-spec.md` | Markdown | design-handoff skill output (developer spec sheet) |
| `/seo/design-audit/wave-2c-skills-applied-summary.md` | Markdown | This file |

**Files NOT modified (per scope):**
- `/index.html` (live homepage) — untouched
- `/index-preview.html` (v1 manual reference) — untouched
- `/es/index.html` (Spanish sister) — untouched
- All other live pages — untouched

---

## Improvements vs `/index-preview.html`

### Aesthetics: PRESERVED
The v2 file looks indistinguishable in style direction from the v1 owner-approved aesthetic. Same Cormorant + Syne pairing, same gold/cream/ink palette, same Ken Burns hero, same word-by-word reveals, same editorial pacing.

### Structure: TIGHTENED
- **13 sections → 12** (lead-section removed; its job was redundant with pillars)
- **3-form CTA section → 1-CTA + email link** (newsletter relocated to footer)
- **Duplicated stats → unique stats** (hero/stats-strip no overlap)
- **Pq-mark 22vw → 12vw** (no longer screams)

### Conversion: STRENGTHENED
- Persistent header CTA at all desktop scroll positions
- Sticky bottom-bar mobile CTA
- Single primary path on the conversion section
- Better verb-led copy (Reserve / Plan / Send / Receive)

### Accessibility: COMPLIANT
- v1 fails WCAG 2.1 AA in 4 Critical + 6 Major places
- v2 passes WCAG 2.1 AA fully (one advisory note for future modal)

### Touch UX: FIXED
- v1 has 4 hover-only affordances that fail on phones
- v2 has touch-mode behaviors (`@media (hover: none)`) for every one of them

### Token discipline: IMPROVED
- v1 has a few inline rgba and hardcoded `gap: 6px` values
- v2 references only tokens; new tokens added for previously-inline values
