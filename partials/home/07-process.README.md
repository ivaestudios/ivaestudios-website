# `partials/home/07-process.html` — five editorial decisions

Oleada 2 · Agent 07. Bilingual EN + ES blocks side-by-side; Agent 30
selects per locale. Replaces the SaaS "send dates → we plan → gallery"
template with five steps, each naming a real decision (light window,
location read, direction work, session restraint, editorial cull).
Authority is demonstrated by explaining decisions — BRAND.md §6.

Structure: `<ol>` of five `<li>`. Each row: gold serif numeral
(decorative, `aria-hidden`), small gold eyebrow naming the decision,
DM Serif Display title stating the action, two-line Inter body.

## Visual

- Background `--warm-sand` — tonal break from surrounding resort-white
  sections. Body on `--atlantic-navy` (≈12.6 : 1).
- Row dividers: gold at 30% — the single place gold threads the page.
- **Mobile choice:** numeral stacks **above** the eyebrow at 56px
  (down from 80px). A single-column stack reads better than an inline
  numeral fighting the eyebrow; hierarchy decision-name → number →
  action → body holds.

## Animation & a11y

- Each `<li>` carries `data-reveal`. Per-step `--reveal-delay` lives
  in CSS (80ms × index); the global system handles intersection.
  `prefers-reduced-motion` zeroes transitions in _animations.css.
- Real `<ol>` so AT reads "1 of 5". Numerals `aria-hidden` (eyebrow
  carries the step label). Anchors at `#process`.
