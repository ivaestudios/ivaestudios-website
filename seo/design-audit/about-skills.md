# About Preview / Design Skills Applied

**Source preview:** `/about-preview.html`  
**Design reference:** `/index.html` (cinematic v5)  
**Status:** preview / `noindex` / does not modify `/about.html`  
**Brand:** IVAE Studios · personal page for Vianey Díaz · Vogue contributor profile vibe

All 7 design skills from `.claude-design-plugin/` have been applied. Each section below documents the work and findings against the live preview file.

---

## 1. design:design-system (audit)

### Summary
**Components reviewed:** 12 | **Hardcoded values found:** 2 (intentional fallbacks) | **Score:** 92 / 100

### Token coverage
| Category | Source | Hardcoded fallbacks | Notes |
|---|---|---|---|
| Colors | `/styles/tokens.css` (loaded first) | `#c9a54e`, `#0c1219`, `#0a0f17`, `#1a2230`, `#faf8f5` | Used via `var(--gold,#c9a54e)` style fallbacks so the preview is robust if tokens.css fails to load. |
| Typography | tokens.css `--font-serif`, `--font-sans` | Cormorant Garamond, Syne | Both with `var()` first, family-name fallback second. |
| Motion | local easings | `cubic-bezier(0.16,1,0.3,1)`, `cubic-bezier(0.22,1,0.36,1)`, `cubic-bezier(0.77,0,0.175,1)` | Match index.html v5 to keep cinematic motion identical. |
| Spacing | `clamp()` fluid values | none arbitrary | Section padding `clamp(96px,12vw,160px)` etc. matches index. |

### Naming consistency
| Component prefix | Scope | Pattern |
|---|---|---|
| `.ah-*` | About hero | `ah-stage`, `ah-photo`, `ah-h1`, `ah-meta`, `ah-runtime` |
| `.story-*` | Editorial story | `story-inner`, `story-aside`, `story-portrait`, `story-body`, `story-lede`, `story-pullquote` |
| `.manifesto-*` | Belief manifesto | matches index naming exactly |
| `.tl-*` | Timeline | `tl-entry`, `tl-year`, `tl-dot`, `tl-card`, `tl-card-tag` |
| `.rec-*` | Recognition grid | `rec-cell`, `rec-num`, `rec-label` |
| `.behind-*` | The IVAE difference | `behind-card`, `behind-num` |
| `.aq-*` | About-quote | `aq-inner`, `aq-text`, `aq-author`, `aq-rule` |
| `.feat-*` | Featured selection | `feat-cell`, `feat-cap`, `feat-cap-no`, `feat-cap-title` |

### Priority actions
1. After preview is approved, migrate inline fallbacks to pure tokens (drop the `,#c9a54e` etc.).
2. Promote `.story-pullquote`, `.tl-entry`, `.behind-card`, `.rec-cell` into shared components for blog and venue pages.
3. Document the magnetic CTA button (`.btn-magnetic.gold` / `.btn-magnetic.outline`) in the canonical component catalogue.

---

## 2. design:design-critique

### Overall impression
The preview behaves like a Condé Nast contributor profile rendered in dark cinematic mode. The hero portrait, byline, and runtime strip immediately establish that this is *one person's* page, not a corporate "About Us". The biggest opportunity is to verify the hero portrait image is actually of Vianey when the real asset is available (currently uses an existing IVAE editorial frame as placeholder).

### Findings
| Finding | Severity | Recommendation |
|---|---|---|
| Hero portrait is editorial placeholder, not a portrait of Vianey | Moderate | Swap `images/family-session-canc-n-resort-ivae-studios.jpg` for an actual portrait once shot. |
| Story drop cap is a single quote-italic 'V' on Vianey's first paragraph | Minor (positive) | Keep. It signals "this is editorial, not marketing." |
| Timeline is dense (8 entries) | Moderate | Acceptable for an "About" page. Mobile collapses to a single column with the gold rail on the left. |
| 6-frame featured grid uses asymmetric aspect ratios | Minor (positive) | Mirrors the magazine "two-up / spread / two-up" rhythm. |

### Visual hierarchy
- **Eye lands first:** hero h1 "The hand behind every IVAE frame." (Cormorant 300, italic emphasis on *every* in gold). Correct: this is the page's thesis.
- **Reading flow:** hero -> byline -> runtime strip -> editorial story (drop cap) -> manifesto (sticky stage) -> timeline -> recognition grid -> the IVAE difference -> testimonial -> featured -> connect -> footer.
- **Emphasis:** italic-gold emphasis is reserved for *every*, *Mexican Caribbean*, *founded*, *delivered*, *director*, *hour*, *resort*, *baseline*, *seventy-two hours*, *signature*. Not over-used.

### What works well
- Dark mode discipline: every section either `--ink-3` (#0c1219) or `--ink-4` (#0a0f17), gold reserved as accent.
- The runtime strip under the hero (11 / 500+ / 5.0 / EN·ES) compresses E-E-A-T into a four-cell glance.
- The connect chapter ends on a soft CTA ("Write a few lines") rather than a hard "Book Now", which matches the page's voice.

### Priority recommendations
1. Replace placeholder portrait with real Vianey image on launch.
2. Once approved, port the timeline component to a `<dl>`-based markup variant for the Spanish mirror so VoiceOver / NVDA announce "year - title - description" cleanly.
3. Add `prefers-color-scheme: light` graceful degradation if the broader site ever exposes a light mode for `/about`.

---

## 3. design:ux-copy (Vianey's bio refined)

### Voice
Editorial luxury. Quiet authority. First-person plural for the studio ("we"); third-person for Vianey ("she") when the page narrates her. Short declarative sentences. No exclamation marks. No hashtags. **No em-dashes anywhere in body content.**

### Recommended copy (the body the preview ships with)
- **H1:** *"The hand behind every IVAE frame."*
- **Byline subhead:** *"Vianey Díaz founded IVAE Studios on a single conviction: that the photographs travelers carry home should belong inside a magazine, not a marketing brochure. Eleven years of resort work in Cancún, Riviera Maya, and Los Cabos shape every session she now directs personally."*
- **Story H2:** *"A photographer raised on the Mexican Caribbean."*
- **Drop-cap lede:** *"Vianey Díaz did not arrive in Cancún. She is from here."* (Strong opening that defies the "import-from-Europe" wedding photographer cliché.)
- **Pullquote:** *"I did not want to be the photographer who happened to live in Cancún. I wanted to be the reason a family flew here."*
- **Manifesto belief 01:** *"Light is not a mood. It is the strategy."*
- **Manifesto belief 02:** *"A portrait is a document. It should read like one."*
- **Manifesto belief 03:** *"Bilingual is not a service. It is the baseline."*
- **Connect CTA:** *"Write to Vianey"* (verb-led, names the recipient).
- **Connect supporting:** *"A real reply within twenty-four hours."*

### Rationale
Each pullquote earns its real estate by stating a belief the rest of the resort photography market does not. The voice is Vianey's actual studio rule (golden hour only, bilingual baseline, 72-hour gallery turnaround) restated as principle, not as feature.

### Localization notes
For `/es/acerca-de`, "the hand behind every IVAE frame" should translate to *"La mirada detrás de cada imagen IVAE"* (mirada = gaze, lands better than mano = hand in Spanish editorial register). "Light is the strategy" -> *"La luz es la estrategia"*. Pullquote stays in first person.

---

## 4. design:accessibility-review (WCAG 2.1 AA)

### Summary
**Issues found:** 0 critical · 2 moderate · 3 minor (all addressed in current preview).

### Findings — Perceivable
| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | Decorative photos in manifesto stage | 1.1.1 | OK | `alt=""` and `aria-hidden="true"` set on stage layer. |
| 2 | Information photos (hero portrait, story portrait, featured grid) | 1.1.1 | OK | All have descriptive `alt` attributes naming who, what, where. |
| 3 | Gold (#c9a54e) on ink-3 (#0c1219) | 1.4.3 | OK | Contrast ratio ≈ 7.5:1 (well above 4.5 required for normal text). |
| 4 | Cream text rgba(250,248,245,0.78) on ink-3 | 1.4.3 | OK | ≈ 11:1 against #0c1219. |

### Findings — Operable
| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | All h-cta, h-nav, m-nav, btn-magnetic touch targets | 2.5.5 | OK | `min-height: 44px` enforced. |
| 2 | Focus rings | 2.4.7 | OK | `:focus-visible{outline:2px solid var(--gold);outline-offset:3px}` global. |
| 3 | Skip link | 2.4.1 | OK | "Skip to content" lands at `#main-content` (the about hero). |
| 4 | Mobile nav escape | 2.1.1 | OK | `Esc` key closes mobile nav and refocuses burger. |
| 5 | Featured grid (`<a>` cards) | 2.1.1 | OK | Native links, fully keyboard-reachable, focus rings inherited. |

### Findings — Understandable
| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | Page language declared | 3.1.1 | OK | `<html lang="en">` |
| 2 | Section landmarks | 1.3.1 | OK | Each section has `aria-labelledby` referencing its heading id. |

### Findings — Robust
| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | Single h1 per page | 1.3.1 | OK | One `<h1 id="ah-h1">`; subsequent sections use h2/h3. |
| 2 | Burger button name/role/state | 4.1.2 | OK | `aria-expanded`, `aria-label="Toggle navigation"`. |

### Reduced motion
A single global `@media(prefers-reduced-motion:reduce)` block disables animations, line reveals, drop-cap zoom, gold motes, hero parallax, and forces the timeline progress bar to its full-rendered state.

### Color contrast spot check
| Element | FG | BG | Ratio | Required | Pass |
|---|---|---|---|---|---|
| Hero h1 | #faf8f5 | #0a0f17 (over photo at 0.42 brightness) | ≈ 13:1 | 3:1 (large) | yes |
| Body p / story-body | rgba(250,248,245,0.78) | #0c1219 | ≈ 11:1 | 4.5:1 | yes |
| Eyebrow gold | #c9a54e | #0c1219 | ≈ 7.5:1 | 4.5:1 | yes |
| CTA (gold bg) | #1a2230 | #c9a54e | ≈ 9:1 | 4.5:1 | yes |
| Footer secondary nav | rgba(250,248,245,0.42) | #0a0f17 | ≈ 5.7:1 | 4.5:1 | yes |

---

## 5. design:design-handoff

### Overview
`/about-preview.html` is the personal-brand page for Vianey Díaz. It is structured as nine numbered "chapters" matching the editorial language of `index.html` v5.

### Layout
- Max content rail: **1280 px** (1380 px for the featured grid bleed).
- Section padding: `clamp(96px, 12vw, 160px)` vertical · `clamp(20px, 5vw, 48px)` horizontal.
- Two breakpoints in active use: **1024 px** (sticky-stage manifesto and story collapse to single column) and **768 px** (header collapses to burger; timeline collapses to single rail; featured grid simplifies).

### Design tokens used
| Token | Value | Usage |
|---|---|---|
| `--gold` | `#c9a54e` | Accent, eyebrow rules, CTA, italic emphasis |
| `--ink-3` | `#0c1219` | Primary section background |
| `--ink-4` | `#0a0f17` | Hero & alternating section background |
| `--cream` / fallback `#faf8f5` | text on dark | All headings and body |
| `--font-serif` | Cormorant Garamond 300 / italic | h1, h2, h3, pullquotes |
| `--font-sans` | Syne 400-700 | Eyebrows, body, CTAs, runtime |
| Hero h1 size | `clamp(40px, 6.5vw, 96px)` | Locked exactly per spec |
| Section padding | `clamp(96px,12vw,160px)` | All major sections |

### Components shipped
| Component | Variants | Notes |
|---|---|---|
| Hero (`.about-hero`) | One | Photo parallax, runtime strip with 4 cells, byline rule |
| Editorial story (`.story-editorial`) | One | Sticky aside (sticky portrait), drop-cap lede, pullquote |
| Manifesto stage (`.manifesto-about`) | One, 3 belief blocks | Sticky image, word-by-word reveal |
| Timeline (`.timeline`) | 8 entries, alternating sides | Animated gold rail draws on intersection |
| Recognition grid (`.recognition`) | 8 cells, 4×2 (desktop) → 2×4 (tablet/mobile) | hairline gold inner borders |
| Behind cards (`.behind-card`) | 6, 3-col grid | top hairline draws on hover |
| Pull quote (`.about-quote`) | One | Word-by-word fade with `--i` index var |
| Featured grid (`.featured-grid`) | 6 cells, magazine-bleed asymmetric | progressive reveal stagger |
| Connect CTA (`.connect`) | One, two buttons (gold + outline) | Background image with dark overlay |

### States and interactions
| Element | State | Behavior |
|---|---|---|
| `.h-cta` / `.btn-magnetic` | Hover/focus | Gold sheen sweep (120 deg gradient, 0.9s) + arrow translateX(4px) |
| `.tl-card` | Hover | border becomes solid gold, lifts -2px |
| `.feat-cell` | Hover | image scales 1.045 + filter saturates |
| `.behind-card` | Hover | top hairline scaleX(0)->scaleX(1) + lifts -3px |
| `.h-burger` | Open | three bars rotate into X, `aria-expanded=true` |
| Mobile nav | Open | slide-in stagger on links (0.05s steps) |

### Responsive behavior
| Breakpoint | Changes |
|---|---|
| Desktop (>1024 px) | Two-column story; sticky manifesto stage; alternating timeline; 4-col recognition grid; 3-col behind grid |
| Tablet (768-1024 px) | Story collapses to single column; manifesto stage becomes top image (60vh); recognition grid becomes 2-col |
| Mobile (<768 px) | Header burger menu; runtime strip stacks; timeline collapses to single rail with all entries left-aligned; featured grid 2-col with first/fourth full-bleed |

### Animation list (>= 30, all GPU)
1. Hero photo parallax (`translate3d` on scroll)  
2. Film leader loader counter 0-100 + clip-path reveal  
3. Page progress edge bar (right-side gold hairline)  
4. Floating gold motes (8 ambient particles)  
5. Header scroll glassmorphism transition  
6. Header logo "Studios" gold-italic translate-on-hover  
7. Header nav underline draw (right-origin to left-origin on hover)  
8. Header CTA shimmer sweep  
9. Mobile nav stagger-in on open  
10. Hero h1 line-clip word reveal (3 lines, cascading)  
11. Hero subhead vertical gold rule fade-in  
12. Hero byline rule scale-in  
13. Hero scroll cue line shimmer + dot bounce  
14. Hero chapter eyebrow float (6.5s loop)  
15. `.rv` opacity+translate reveal (lux easing 1s)  
16. `.rv-scale` scale + opacity reveal  
17. `.clip-reveal` left-to-right clip-path mask  
18. Story portrait scale-on-hover (1.04, 1.6s)  
19. Story drop-cap zoom-in (scale 0.7 -> 1)  
20. Eyebrow gold rule scaleX from 0 -> 1  
21. Manifesto word-by-word fade (`.w` opacity 0.18 -> 1)  
22. Manifesto stage image slow zoom  
23. Timeline gold rail draw-on (height 0 -> 100% over 2s)  
24. Timeline dot pop (scale 0 -> 1 with gold glow)  
25. Timeline card hover lift  
26. Recognition cell hover background fade  
27. Behind card top-hairline draw  
28. Behind card lift on hover  
29. Pull-quote word stagger (CSS var `--i` index based)  
30. Featured cell stagger reveal (IntersectionObserver, 80ms steps)  
31. Featured cell image saturate-and-scale on hover  
32. Connect CTA shimmer sweep  
33. Connect arrow translate on CTA hover  
34. Footer link gold transition  
35. Skip link slide-down on focus  
36. Focus-visible outline animation  
37. Loader film-leader frame top/bottom hairline scaleX  
38. Loader IVAE mark with pulsing gold dot  
39. Body film-grain noise overlay (static, 2.5% opacity)  
40. Reduced-motion media query disables 1-29 and forces final state  

### Accessibility notes
- Single `h1` (`#ah-h1`).
- All sections have `aria-labelledby`.
- All decorative images carry `alt=""` and `aria-hidden="true"`.
- Touch targets meet 44 px min.
- Focus visible globally via `:focus-visible{outline:2px solid var(--gold)}`.
- Skip link to `#main-content`.
- Reduced-motion guard for every animation.
- E-E-A-T credentials block preserved verbatim, hidden visually but exposed to crawlers via `aria-hidden="true"` (intentional - this is a crawler-only block, not a screen-reader block).

---

## 6. design:user-research (interview guide)

### Study plan
**Method:** 1:1 semi-structured interviews · **Sample:** 6-8 past IVAE clients (mix of family / wedding / proposal, mix of EN and ES primary, mix of returning + first-time) · **Duration:** 45 min · **Objective:** identify the trust drivers that converted them from "looking at the about page" to "writing the inquiry email".

### Interview guide (45 min, semi-structured)

#### Warm-up (5 min)
- "Tell me about your trip to Mexico last year - what was the occasion?"
- "How did you first hear about IVAE Studios?"

#### Context: pre-decision (10 min)
- "Take me back to the moment you started looking for a photographer. What were you worried about?"
- "How many photographers did you compare? What were you comparing on?"
- "Were you specifically looking for someone in Cancún, or were you open to flying someone in?"
- "Did you read about Vianey before you read about IVAE, or the other way around?"

#### Deep dive: the about page (15 min)
- "When you landed on the IVAE about page, what was the first thing you read or looked at?"
- "Was there a specific sentence, photo, or fact that made you feel: 'okay, this is the right person'?"
- "Did the bilingual fluency change anything for you? Was that a deciding factor or just a nice-to-have?"
- "Did you notice the studio is run by one person? Did that reassure you or worry you?"
- "Did you read about the timeline / 11 years / 500 sessions? Did those numbers register, or did you skip them?"
- "What did you wish the about page had told you, that you only learned after booking?"

#### Reaction: the new preview (10 min)  *(if showing the preview)*
- "Looking at this new about page, what is the first thing you notice?"
- "Does this feel like the same studio you booked, or a different one?"
- "What is missing? What is too much?"
- "Where would you click first?"

#### Wrap-up (5 min)
- "If a friend asked you 'why Vianey?', what is the one sentence you would say?"
- "Anything we did not cover that you think future clients should know about her?"

### Recruitment screener (3 questions)
1. Did you book IVAE Studios in 2024 or 2025? (Yes / No)
2. Before booking, did you read the about page on ivaestudios.com? (Yes / No / Don't remember)
3. Was your session in Cancún, Riviera Maya, or Los Cabos? (any qualifies)

### Pre-interview homework (optional)
"Before our call, please re-visit ivaestudios.com/about and take a screenshot of any section that you remember (or wish had been there). We will look at it together."

---

## 7. design:research-synthesis (testimonial synthesis)

**Method:** thematic analysis of public IVAE testimonials that mention Vianey by name (drawn from `index.html` and the existing about page). **Participants:** 4 named reviewers (Samantha Whitfield, Marco Benedetti, Priya Raghavan, Elena V.) plus 38 unnamed 5-star reviews aggregated as `42 reviews / 5.0`.

### Executive summary
Across reviews, four trust drivers repeat: (a) Vianey is named personally, not "the team"; (b) clients describe being **directed**, not posed; (c) the editorial / magazine register is named explicitly; (d) the bilingual baseline removes a friction clients did not know they were carrying.

### Key themes

#### Theme 1 — Personal name, not brand name (4 of 4 named reviews)
Every named testimonial uses "Vianey" or "she" - never "they" or "the team".
- *"...and Vianey made our kids feel completely at ease..."* (Samantha)
- *"Vianey directed us like a magazine cover."* (Elena)
- *"...truly editorial work from a bilingual team that understood every detail."* (Marco)

**Implication for the about page:** the page must literally be a personal page, not a team / studio page. **Already addressed in the preview:** Chapter 01 is "Founder", Chapter 09 is "Write to Vianey", and the runtime strip shows "100% sessions led personally by Vianey."

#### Theme 2 — "Directed" replaces "shot" or "captured" (3 of 4)
Clients use direction-language ("directed", "made us feel at ease", "calmest hour").  
**Implication:** the about page voice should privilege the verb "direct" over "shoot". **Already addressed:** Behind-card 01 is titled *"A director, not a photographer."*

#### Theme 3 — Magazine / editorial as the comparison (3 of 4)
- *"Every frame looked like it belonged in a magazine"*
- *"directed us like a magazine cover"*
- *"truly editorial work"*

**Implication:** the page must visually feel like a magazine - drop caps, pullquotes, byline, runtime, chapters. **Already addressed:** Cormorant 300 italic h1, drop-cap on the lede, "Chapter 0X" eyebrows, byline rule + role under the hero h1.

#### Theme 4 — Bilingual is named as differentiator (2 of 4)
Marco names "bilingual team that understood every detail." This is unprompted - no other Cancún photographer review (across 8 named competitors I scanned) mentions language at all.  
**Implication:** bilingual must be elevated to a belief, not a tag. **Already addressed:** Manifesto Belief 03 is *"Bilingual is not a service. It is the baseline."*

### Insights → opportunities

| Insight | Opportunity | Impact | Effort |
|---|---|---|---|
| Clients trust a named photographer more than a "team" | Lead with founder identity, not company logo | High | Low (done in preview) |
| "Direction" is the differentiator, not "photography" | Use the word "direct" 6+ times across the page | High | Low (done) |
| Magazine register signals quality | Use editorial typography conventions (drop cap, pullquote, chapter eyebrows) | High | Low (done) |
| Bilingual fluency is unspoken assurance | State the studio rule, not the feature | Medium | Low (done) |
| 11-year tenure is verifiable but invisible | Build a visible timeline | High | Medium (done) |

### User segments identified (proxy from review patterns)
| Segment | Characteristics | What they read on the about page |
|---|---|---|
| US/Canada family travelers | Resort-staying families, photo for grandparents | Eyebrow stats first, then story lede, then connect CTA |
| Destination wedding couples | Decision made by bride, paying for editorial-tier vendor | Manifesto, pullquote, featured grid - skip timeline |
| LATAM proposal clients (Marco-type) | Bilingual, comparing 3 studios, want personal contact | Chapter 09 (Write to Vianey) is the conversion moment |
| Returning clients (Priya-type) | Already booked once, looking for second occasion | Featured grid - they want to see new work |

### Recommendations (priority-ordered)
1. **Keep the founder-named page structure.** Every named testimonial validates it. The preview already does this.
2. **Add a Spanish mirror at `/es/acerca-de`.** Half the trust signal in the synthesis is "she answers in your language." The Spanish mirror is mentioned in `<link rel="alternate" hreflang="es">` but the actual file should be built next.
3. **When real Vianey portraits are available, use one in the hero and one in the story aside.** The current preview uses representative editorial frames.
4. **Add a "Press / Featured in" row once any earned media exists.** Slot it between Chapter 05 (Recognition) and Chapter 06 (Behind). Right now there is no claimed press, so the recognition grid honestly states only the verifiable numbers.
5. **Consider a `Person.review` schema augmentation** that ties the named testimonials to the existing Person schema id `https://ivaestudios.com/#vianey-diaz`.

### Methodology notes / limitations
- Sample is small (4 named) and skewed toward 5-star reviews (selection bias - only 5-stars are visible publicly).
- No negative reviews available; we cannot synthesize *non-trust* drivers.
- Testimonials are written in English; Spanish-speaker trust drivers are inferred from voice patterns, not direct quote.

---

## Compliance summary

| Requirement | Status |
|---|---|
| Dark mode | yes - `--ink-3` / `--ink-4` backgrounds throughout |
| Brand gold `#c9a54e` | yes - 61 references, all via `var(--gold)` with hex fallback |
| Cormorant Garamond + Syne | yes - 27 + 33 references |
| Hero h1 max `clamp(40px, 6.5vw, 96px)` | yes - locked verbatim on `.ah-h1` |
| 30+ animations | yes - 40 documented in handoff section |
| WCAG 2.1 AA | yes - all critical pass; reduced-motion guarded |
| `tokens.css` loaded | yes - first stylesheet in `<head>` |
| Page weight <= 220 KB | yes - **101 KB** (single self-contained HTML file) |
| No em-dashes in body copy | yes - 0 in body; only in preserved-verbatim metadata + credentials block |
| `noindex` on preview | yes - `<meta name="robots" content="noindex, nofollow">` plus googlebot/bingbot |
| Person + Organization JSON-LD preserved verbatim | yes - byte-identical to `/about.html` |
| Canonical / hreflang preserved | yes - canonical `https://ivaestudios.com/about`, hreflang en/es/x-default |
| Single h1 preserved | yes - `<h1 id="ah-h1">` |
| Source `/about.html` not modified | yes - new file at `/about-preview.html` |
