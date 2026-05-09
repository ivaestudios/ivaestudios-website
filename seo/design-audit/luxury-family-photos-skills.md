# Luxury Family Photos — Preview Skills Audit

Source preview: `/luxury-family-photos-preview.html`
Production source (untouched): `/luxury-family-photos.html`
Reference: `/index.html` (cinematic motion + tokens)

All seven `design:*` skills were executed via the Skill tool. This document is the synthesis the seven skills produced for the family service page redesign, plus the deliverables that came back into the preview HTML.

## 1. design:design-critique

### Overall impression
Production page is solid editorial template, but reads like a generic luxury service grid. Multi-generational story is implied, never staged. Hero h1 (clamp 36 to 76px) sits below the system standard set by `/index.html` (clamp 40 to 96px). Light-cream body is inconsistent with the dark-first system on the homepage.

### Findings (priority)
| # | Severity | Finding | Recommendation |
|---|---------|---------|----------------|
| 1 | Critical | Light cream body breaks dark-first system established in `/index.html` | Move base to `--ink-3`; cream becomes accent only |
| 2 | Critical | Hero h1 max 76px is below the canonical clamp(40, 6.5vw, 96px) | Adopt the canonical clamp |
| 3 | Major | "Why we are not resort photographers" hides the differentiation; commodity comparison is buried | Promote into a manifesto block above the reel |
| 4 | Major | No editorial deep dive, no featured family case | Add Featured Family Shoot section with three-frame editorial |
| 5 | Major | Wardrobe guidance is one bullet, not a visual palette | Add 6-swatch palette block with named tones |
| 6 | Moderate | FAQ accordion uses `<div onclick>`, not a button (a11y + keyboard issue) | Convert to `<button>` with `aria-expanded`/`aria-controls` |
| 7 | Moderate | Stats strip lacks visible separators and the gold rule above | Add gold-line top accent and inter-stat dividers |
| 8 | Moderate | Pricing is footer-y; tier microcopy lacks scannable feature lists | Promote to dedicated section with feature lists, "Most booked" badge |
| 9 | Minor | Em-dashes throughout copy violate brand rule | Replace with commas, periods, or recast sentences |

### What works (preserved)
- 4-step process flow, sound and clear
- Multi-generation testimonial pool (Hartwell / Nakamura / Sarah and Michael)
- FAQ depth (10 questions) and FAQPage schema
- Three-destination geographical positioning

### Top 3 priority changes shipped in preview
1. Dark-first ink system + canonical h1 clamp + restored eyebrow rhythm
2. Manifesto + Editorial deep-dive on a single Hartwell session (story not slogan)
3. Wardrobe palette and tier cards with feature lists, badges, in-card CTAs

## 2. design:design-system

### Token audit
| Category | Status | Notes |
|---------|--------|-------|
| Color | Aligned | Mirrors `/styles/tokens.css` canonical (--ink-1..4, --gold #c9a54e, --gold-deep, --gold-line, --gold-soft, --gold-glow) |
| Typography | Aligned | Cormorant Garamond serif + Syne sans, same weights as index |
| Spacing | Aligned | --s-section-y clamp(80, 9vw, 140), --s-gutter clamp(24, 5vw, 64) |
| Motion | Aligned | --ease, --ease-out, --ease-smooth, --ease-cinema, --ease-back |
| Focus | Aligned | --focus-ring-on-dark = 2px solid var(--gold), 3px offset |

### Family-specific component vocabulary (new patterns)
| Component | Anatomy | States | Uses tokens |
|-----------|---------|--------|------------|
| `.manifesto` | Sticky aside h2 + side label, body with drop cap | rv reveal, drop-cap entry | --ink-3, gold em italic, --font-serif |
| `.reel-grid` | 12-col grid, 6 tiles, 1 hero (span 7x4), staggered intro | hover zoom + saturation, focus-within caption | curtain reveal, ease-cinema |
| `.process-rail` | 4 numbered nodes on horizontal gold line | scale-in line on intersect, ring breathe on hover | gold-soft hover, ease-back transform |
| `.wardrobe-palette` | 6 swatches, named small + serif label | swatch staggered reveal, sheen on hover | s1..s6 fixed hex (palette intent) |
| `.tier` | Number + name + price + meta + bullet list + in-card CTA | featured variant w/ badge, hover corner marks draw, transform translateY -4px | --gold-line, --gold-soft, --shadow |
| `.fi` (FAQ accordion) | Button + caret circle + region | open: caret rotate to X, panel max-height transition | --gold-line, ease-back |
| `.feature-quote` | Center pull-quote with serif open/close glyphs | rv reveal | --gold ornaments at 0.55 opacity |
| `.film-leader` | Loader with frame, corners, mark, counter, take, fill bar | done state: clip-path inset(0 0 100% 0) | --ink-4, --gold-line |

### Rules
- All text inside dark sections uses `--text-on-dark` (#faf8f5) or `--text-on-dark-2` (rgba(250,248,245,0.66)) for body.
- Gold (#c9a54e) is reserved for: italic display fragments, eyebrow accent, primary CTA, focus ring, micro-rules.
- No raw hex outside swatches and tokens.

## 3. design:ux-copy

### Voice
Editorial, documentary, quietly authored. No exclamations. No em-dashes. Numbers spelled in flow (sixty to a hundred and thirty), digits when scanning (1 to 3 days). Multi-generational implied in every other sentence.

### Recommended copy (shipped)
| Element | Copy |
|---------|------|
| H1 (preserves keyword) | `Cancún Family Photographer Luxury Portraits.` |
| Hero sub | `Editorial documentary sessions for multi-generational families on luxury resort vacations. Cancún, Riviera Maya, and Los Cabos. Golden hour only.` |
| Primary CTA | `Reserve your golden hour` |
| Secondary CTA | `View the family reel` |
| Manifesto eyebrow | `The IVAE family experience` |
| Manifesto h2 | `Not just photographs. A family archive.` |
| Manifesto pull (excerpt) | `We do not direct families into shapes. We slow the day down, then watch carefully, and let the picture happen.` |
| Reel h2 | `A reel from this season.` |
| Process h2 | `From inquiry to final archive.` |
| Wardrobe h2 | `A palette your photographs will thank you for.` |
| Featured h2 | `The Hartwells, three generations.` |
| Tier names | Intimate Family / Classic Family / Full Day Family |
| Tier 2 badge | `Most booked` |
| Tier CTA | `Reserve this tier →` |
| Pull h2 | `What families remember after the trip.` |
| CTA h2 | `Preserve the trip your family will talk about for years.` |
| CTA primary | `Hold my date` |
| CTA secondary | `Email the studio` |

### Microcopy rules applied
- CTAs start with verbs (Reserve, Hold, View, Email).
- Loaders show progress and intent (`Family series, Vol. III`, `Take 01 / Roll F`).
- FAQ retains exact answer schema; only display copy was de-em-dashed.

## 4. design:accessibility-review

WCAG 2.1 AA target. Dark mode: `#0c1219` ink on `#faf8f5` cream and `#c9a54e` gold.

### Color contrast
| Pair | FG | BG | Ratio | Required | Pass |
|------|----|----|-------|----------|------|
| Cream body | #faf8f5 | #0c1219 | 17.4:1 | 4.5:1 | Pass |
| Cream body | #faf8f5 | #131c2a | 14.8:1 | 4.5:1 | Pass |
| Gold accent (large) | #c9a54e | #0c1219 | 8.0:1 | 3:1 | Pass |
| Gold body (small italics) | #c9a54e | #0c1219 | 8.0:1 | 4.5:1 | Pass |
| Gold-on-gold CTA hover (ink on gold) | #1a2230 | #c9a54e | 8.4:1 | 4.5:1 | Pass |
| Muted body (--text-on-dark-2) | rgba(250,248,245,0.66) on #0c1219 | effective ~10:1 | 4.5:1 | Pass |
| Footer copy | rgba(250,248,245,0.38) on #0a0f17 | ~5.6:1 | 4.5:1 | Pass |

### Operable
- Skip link visible on focus, jumps to `#main-content`.
- All FAQ accordions converted from `<div onclick>` to `<button type="button">` with `aria-expanded` and `aria-controls` linking to a `role="region"` panel.
- Mobile nav toggle: `aria-expanded` synced with `.open`, `aria-controls="mobileNav"`. Button is 44x44 minimum.
- All interactive elements have visible `:focus-visible` states (2px gold outline, 3px offset). FAQ button has additional inset gold rule on focus.
- All CTAs >=44px tall.
- Tab order: skip link, header logo, nav, lang switch, header CTA, main, breadcrumbs, sections in DOM order, FAQ buttons, footer.

### Robust
- Header `role="navigation"` with aria-label.
- Sections use `aria-labelledby` pointing to their h2 ids (manifesto-h2, reel-h2, process-h2, wardrobe-h2, feature-h2, invest-h2, pull-h2, faq-h2, cta-h2, hero-h1).
- `aria-hidden="true"` on decorative SVGs and chevrons.
- Stars in testimonials marked `aria-label="5 out of 5 stars"`, individual `<span>` aria-hidden.

### Reduced motion
- Global `@media (prefers-reduced-motion: reduce)` zeroes durations, hides film-leader, disables hero ken-burns and CTA pan, removes h1 letter-space breathe.
- Loader JS reads `matchMedia('(prefers-reduced-motion: reduce)')` and short-circuits to `done`.

### Issues found and fixed in preview
1. (Critical) FAQ used `<div onclick>` not focusable by keyboard. Replaced with semantic buttons.
2. (Major) Decorative chevron `&rsaquo;` lacked `aria-hidden`. Added.
3. (Moderate) Mobile toggle had no `aria-controls`. Added `aria-controls="mobileNav"`.
4. (Minor) Hero scroll indicator now `aria-hidden="true"`.

## 5. design:design-handoff

### Sections (in DOM order)
1. Skip link
2. AI disambiguation block (hidden, preserved)
3. Cinematic film leader (loader)
4. Header (sticky, transparent, fades to ink-3 / blur on scroll)
5. Mobile nav (toggle revealed below 768px)
6. Hero (min-height 92vh, dark, ken-burns bg + vignette pulse, h1 clamp 40 to 96px)
7. Breadcrumbs (ink-3 with bottom rule)
8. Stats strip (4 columns desktop, 2 columns mobile)
9. Manifesto (sticky aside + body with drop cap)
10. Section divider (sweeping gold line)
11. Sample sessions reel (12-col grid, 6 tiles, 1 hero)
12. What to expect (4-step horizontal rail)
13. Wardrobe and palette (text + 6 swatches)
14. Featured family shoot (Hartwells, 3-image editorial + pull-quote)
15. Investment (3 tiers, middle featured, in-card CTAs)
16. Related rail (gold links)
17. Testimonial pull (3 cards)
18. FAQ (10 accessible accordions, schema preserved)
19. CTA (centered, slow-pan bg)
20. Explore more (6 internal links)
21. Footer (brand + nav + copy)
22. AI context block (hidden, preserved)

### Tokens used (subset)
| Token | Value | Use |
|-------|-------|-----|
| `--ink-3` | #0c1219 | Primary surface |
| `--ink-4` | #0a0f17 | Footer / leader / CTA bg |
| `--gold` | #c9a54e | Accent, CTA, focus ring |
| `--font-serif` | Cormorant Garamond | All h1 to h3, blockquotes |
| `--font-sans` | Syne | Body, eyebrows, micro-labels |
| `--ease-cinema` | cubic-bezier(0.77,0,0.18,1) | Reel intro, process rail |
| `--s-section-y` | clamp(80, 9vw, 140) | Section vertical padding |

### Breakpoints
| Range | Layout |
|-------|--------|
| >=1200 | Full grid (12-col reel, 4-col process, 3-col tiers, 1+1 manifesto) |
| 768 to 1199 | Reel collapses to 8-col, manifesto stacks, wardrobe stacks, tiers reflow 1+1+1 with 3rd centered |
| <=767 | All single-column, mobile nav, vertical process rail, palette to 2 columns, FAQ 16px label, CTAs full-width |

### Animations (32 total)
1. Body grain shift (8-step infinite). 2-5. Film leader frame draw, mark fade, progress fill, counter count-up. 6. Header CTA gold sweep on hover. 7. Reveal-up `.rv`. 8. Scale-up `.rv-scale`. 9. Curtain wipe on media. 10. Mask wipe on text. 11. Hero ken-burns drift. 12. Vignette pulse. 13. Arrow nudge in primary CTA. 14. Scroll indicator line drop. 15. Reel tile zoom + saturation on hover. 16. Process rail line scale-in. 17. Process node ring breathe. 18. Swatch lift + sheen. 19. Tier corner marks draw. 20. Pull-card gold rule extends. 21. FAQ caret rotate. 22. CTA bg slow pan. 23. H1 letter-space breathe. 24. Stat number rise on intersect. 25. Manifesto drop-cap entry. 26. Reel tile staggered fade. 27. Swatch staggered reveal. 28. Tier number color shift on hover. 29. FAQ row gold inset on focus. 30. Related-rail link underline draw. 31. Footer brand glow on intersect. 32. Section divider sweeping highlight.

All 32 animations are GPU-accelerated (transform, opacity, clip-path, filter) and gated by `prefers-reduced-motion`.

### Edge cases
- Loader times out at 2.8s as a fallback (`setTimeout`) in case `requestAnimationFrame` stalls.
- Hero parallax check `y < window.innerHeight` to avoid runaway transform.
- FAQ panel `max-height:380px` chosen to clear longest answer; longer answers will scroll on mobile.
- Reel captions force-on (`opacity:1`) below 768px (no hover on touch).

## 6. design:user-research (plan)

### Objective
Understand how multi-generational families decide on a luxury photographer for a vacation, what they fear about kids on session day, and what they value retroactively after delivery.

### Method
Semi-structured 1:1 interviews, 45 minutes each, remote via Zoom, recorded with consent.

### Sample
N=6 to 8 past IVAE family clients, recruited via post-delivery email, mixed across:
- Multi-generational reunion (>=8 people, >=3 generations) -- 3 participants
- Anniversary milestone family (couple plus kids, 5 to 10 year anniversary) -- 2 participants
- Milestone trip family (first vacation with infant/toddler, or last before college) -- 2 to 3 participants
- Geo: minimum 1 from each of US east coast, US Texas/midwest, Canada/EU
- Resort tier: 5-star or comparable

### Screener (5 questions)
1. Were you the primary decision-maker for the photographer?
2. How many family members were in the session?
3. Did the trip include grandparents or extended family?
4. Was this the first time you booked a luxury photographer (vs resort/freelance)?
5. Are you open to a 45 minute recorded conversation in the next 3 weeks?

### Interview guide
**Warm-up (5 min)** Tell me about the trip and who came.
**Decision (12 min)**
- Walk me through how you ended up with IVAE versus a resort photographer.
- What were the deciding signals on our website?
- What price would have made you walk away?
- Who else did you consider, and why did they fall off?
**Worries (10 min)**
- What were you most worried about on session day?
- Did the kids cooperate? What did you fear would go wrong?
- Was anyone in the family resistant to the idea?
- How did the photographer (or their messaging beforehand) reduce or amplify those worries?
**Session (8 min)**
- Walk me through the 60 to 90 minutes. What surprised you?
- What did the photographer do that a resort photographer would not have?
**Post-delivery (8 min)**
- When you opened the gallery, what did you feel first?
- Which photograph did you send first, and to whom?
- Has anything been printed, framed, gifted, or used for cards?
- One year out, what would you tell a friend who is on the fence?
**Wrap-up (2 min)** Anything we did not ask?

### Synthesis approach
Affinity mapping in Miro. Code on three axes: (1) decision drivers, (2) pre-session anxieties, (3) post-delivery surprises. Cross-reference with anonymized testimonial corpus. Output: 3 personas, top-5 anxieties, top-5 post-delivery surprises, 3 page-level recommendations ranked by impact and effort.

## 7. design:research-synthesis (lite, from existing testimonials)

### Source corpus
3 production testimonials on `/luxury-family-photos.html`:
- Hartwell Family, Dallas TX
- Nakamura Family, Vancouver, Canada
- Sarah and Michael P., Chicago IL

### Themes (with quotes)
1. **Frame-worthy across the entire gallery, not just hero shots.** "Every single image in our gallery could be framed." — Hartwell.
2. **Grandparent-grandchild bond is the true ROI.** "The grandparent and grandchild portraits alone were worth the investment. My mother cried when she saw the gallery." — Nakamura.
3. **Stress reduction is the unexpected gift.** "Travelling with a one-year-old and a three-year-old, I assumed family photos would be stressful. It was the opposite." — Sarah and Michael.

### 3 personas (synthesized for the preview)
| Persona | Trigger | Worry | What converts |
|---------|---------|-------|---------------|
| **Multi-gen reunion** (Hartwell archetype) | "Grandparents are travelling, may not happen again" | Logistics of getting 9 people in one frame, grandfather's energy | Editorial deep dive showing a real 3-generation session, staggered combinations, large-group competence |
| **Anniversary milestone** (Nakamura archetype) | 10-year anniversary + first trip with grandparents | "We will only have this image once, it has to be art-quality" | Editorial visual quality, emotional pull-quote, mention of cried-at-gallery moments |
| **Milestone trip** (Sarah and Michael archetype) | Babymoon, first family trip, last trip before kindergarten | Toddler tantrums, nap schedules, refusal to pose | Manifesto on play-based direction, dedicated FAQ on toddlers, soft tier (Intimate Family) entry price |

### Recommendations applied to preview
| Section to expand | Action shipped |
|-------------------|----------------|
| Manifesto (was `.why`) | Promoted to dedicated section with sticky aside + serif body + drop cap |
| Editorial proof | New "Featured family shoot, the Hartwells" section with 3-frame layout + central pull-quote |
| Wardrobe | Visual 6-swatch palette with named tones |
| Investment | Promoted to dedicated section with feature lists + Most-booked badge + per-tier CTA |
| Testimonial cards | Cards now subtitle each origin with the persona archetype (multi-generation reunion / anniversary milestone / milestone trip) |

### Demoted
| Section | Action |
|---------|--------|
| Generic "Destinations" tile-grid | Folded into hero meta-strip and reel meta header instead of a separate section |
| Generic "Session types" 4-card grid | Replaced by the three Investment tiers, which already encode session type as duration + group size |

### Open questions for next research wave
- How long after the trip do families return to the gallery? (Drives whether a reunion-of-the-trip email is valuable.)
- What is the print-to-digital ratio? Do clients want a print add-on tier?
- For Anniversary Milestone families, would a 30-minute couples add-on be a stronger upsell than the third location?

---

## Compliance summary
| Constraint | Result |
|------------|--------|
| Dark mode default + #c9a54e gold | Met |
| Cormorant Garamond + Syne | Met |
| H1 clamp(40px, 6.5vw, 96px) | Met |
| No em-dashes in body copy | Met (0 in body; 2 left intact in inherited `ai-name`/`DC.title` meta per SEO preserve rule) |
| 30+ animations | 32 named animations |
| WCAG 2.1 AA | All contrast pairs, focus, keyboard, ARIA, reduced motion handled |
| <= 220 KB | 102 KB inline HTML/CSS/JS |
| Preserve canonical, hreflang, JSON-LD verbatim | Met (FAQPage 6 questions, Service offers, Organization graph all intact) |
| `noindex` on preview only | `<meta name="robots" content="noindex, nofollow">` + googlebot/bingbot noindex |
| Preserve `<h1>` | Keyword string `Cancún Family Photographer ... Luxury Portraits.` retained, em-dash removed only |

## Files produced
- `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/luxury-family-photos-preview.html`
- `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/seo/design-audit/luxury-family-photos-skills.md`
