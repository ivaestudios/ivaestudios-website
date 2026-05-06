# 11-faq.html — Home FAQ partial

Owner: Agent 11 (Oleada 2). Wired by Agent 30 (Oleada 3).

## What this is
Home FAQ — eight Q&A in IVAE voice (decisions explained, not generic
filler). Replaces the shallow 5-item list in legacy `index.html`.

## Structure
- One `<section class="section section--faq" id="faq">` per locale.
- File ships **two** blocks back-to-back: `lang="en"`, then `lang="es"`.
  Agent 30 picks the right one when injecting.
- Each Q&A is a native `<details>` + `<summary>`. No JS required.

## Pricing rule (BRAND.md §9)
"Investment upon request." Q2 (cost) gives a soft answer explaining
why no single number is published and invites the lead to send dates.
Same restraint applies to travel (Q8): included for the three core
regions, quoted separately for international.

## Styles
`styles/_home-faq.css`. Add `@import "_home-faq.css";` to `main.css`.

## Animation
Browser-default for height. The +/− icon rotates and one bar collapses
— 250ms kinetic affordance without animating height. Reduced-motion
strips even that.

## A11y
`<details>` is keyboard- and SR-native. Focus ring via `--shadow-focus`.
Body + headings on Resort White exceed WCAG AA.
