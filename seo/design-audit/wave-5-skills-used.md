# Wave 5 — Skills Used

Log of Anthropic Design plugin skill invocations during construction of
`/index-preview-v5.html`.

**Date:** 2026-05-09
**Spec requirement:** invoke at least 3 of `design:*` skills.

---

## Skill invocation 1 — `design:design-critique`

**Arguments passed:**
> Critique animation choices for the IVAE Studios v5 luxury photography
> homepage. Context: The owner loved v3's editorial cinematic structure
> (preserving copy, sections, magnetic cursor, golden-hour clock, Mexico
> atlas, horizontal portfolio reel). Goal: layer 25+ sophisticated animations
> on top WITHOUT changing structure. Focus on which animation patterns best
> serve a luxury editorial brand (Cormorant Garamond + Syne, gold + ink
> palette) and which would feel out of character. Specifically advise on:
> 1) appropriate motion durations (luxury = slower), 2) easing curves
> (cubic-bezier patterns that feel cinematic), 3) which animations should
> use IntersectionObserver vs RAF loops, 4) which animations add to the
> editorial feel vs which would look "tech-y" and undermine the luxury
> positioning, 5) priority ranking for the 41-animation list provided.

**Findings applied to v5:**
- Slower durations across the board (1.4s clip-path reveals, 1.2s count-ups,
  0.6s theme transitions, 38s marquee — all paced for editorial reading).
- Cinematic easings: `cubic-bezier(0.16, 1, 0.3, 1)` (out-cubic) for entrances,
  `cubic-bezier(0.65, 0, 0.05, 1)` (smooth) for sticky-stage transitions,
  `cubic-bezier(0.22, 1, 0.36, 1)` (gentle) for hovers.
- IntersectionObserver for one-shot reveals (clip-paths, hairlines, count-ups,
  drop caps); RAF loops only for continuous motion (parallax, cursor, smooth
  scroll, sun position, live time updates).
- Removed any potentially "tech-y" animations that didn't serve the editorial
  brand — no spring physics, no cartoonish bounce-overshoot easings, no rapid
  color cycling.
- Priority ranked: golden-hour clock (#12) and Mexico atlas (#13) at the top,
  per owner's explicit preference.

---

## Skill invocation 2 — `design:accessibility-review`

**Arguments passed:**
> WCAG 2.1 AA audit checklist for animation-heavy luxury photography site.
> Context: Adding 25+ animations (parallax, magnetic cursor, count-ups,
> scroll-velocity hairlines, marquees, momentum scroll, golden-hour clock
> animations, animated map pins, manifesto word reveals). Need: 1)
> prefers-reduced-motion gates required for each animation type, 2) which
> animations create vestibular trigger risk, 3) keyboard navigability
> requirements when smooth-scroll is hijacked, 4) focus indicators that
> survive transform-based animations, 5) color contrast requirements for
> animated states (hover, focus, active).

**Findings applied to v5:**
- Single global `@media (prefers-reduced-motion: reduce)` block at the bottom
  of the stylesheet that overrides every transition-duration to `0.01ms`,
  every animation-iteration-count to 1, and forces transform-based motion
  back to `none`.
- Vestibular-risk animations (parallax, smooth scroll, marquee, gold motes)
  all explicitly disabled in reduce-motion.
- Smooth scroll keeps keyboard navigation intact: PageUp/PageDown/arrows
  resync target via `setTimeout(syncTarget, 50)` after the keystroke.
- Focus rings declared via `outline: var(--focus-ring-on-dark)` (not
  border) so they survive transform animations.
- Color contrast for hover/focus states preserved: gold on ink-4 backgrounds
  remains 5.6:1; cream-on-ink stays 14.7:1.
- Atlas pins keyboard-operable via Enter/Space, with focus rings.
- Reel scroll-region marked `tabindex="0"` with ArrowLeft/ArrowRight bindings.
- Esc key closes mobile nav and restores focus to the burger.

---

## Skill invocation 3 — `design:design-handoff`

**Arguments passed:**
> Spec sheet template for v5 animations roadmap. Context: 25+ animations
> being added to existing v3 IVAE Studios homepage. Need clean handoff doc
> covering: animation name, trigger (scroll, hover, intersection, time),
> duration, easing curve, GPU properties, fallback for prefers-reduced-motion,
> performance considerations.

**Findings applied to v5:**
- The companion `wave-5-animations-roadmap.md` doc follows the standard
  handoff spec format with one row per animation: name, trigger,
  implementation, reduce-motion fallback.
- Each animation entry references which CSS variables/tokens it uses.
- Animations grouped by section so a developer reviewing the roadmap can scan
  them in the same reading order as the page.
- Performance budget (LCP, CLS, INP) called out at the bottom.

---

## Total: 3 design plugin skills invoked (meets requirement: ≥3)
