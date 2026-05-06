# `partials/home/02-hero.html` — full-bleed cinematic hero

Oleada 2 · Agent 02. Bilingual EN + ES blocks, side-by-side. Build (Agent 30)
selects the correct block per page.

## Image pick — TODO

The `<img>` `src` is hard-coded so the page renders today, but the final
choice is Agent 30's. Three candidates (all live in `/images/`, 2000×1333):

1. `los-cabos-sunset-session-ivae-studios.jpg` — golden hour, warm register.
2. `editorial-session-riviera-maya-resort-ivae-studios.jpg` — editorial · contrast.
3. `canc-n-resort-photography-ivae-studios.jpg` — open shade · marina.

Once chosen, generate the AVIF/WebP/JPG ladder at 960/1440/1920/2560 widths
and rewire the `<source data-srcset>` attributes. Filename ladder convention
lives in `partials/picture.README.md`.

## Accessibility notes

- Decorative photograph: `alt=""` on the `<img>` and `aria-hidden="true"`
  on `.hero__media`. The headline + lede carry the meaning.
- `<h1>` is the page's only h1 (other sections use h2).
- Scroll cue is a real anchor (`<a href="#manifesto">`), labelled, 32×40 hit
  area. Pulse animation disables under `prefers-reduced-motion`.
- Text contrast against the scrim'd image: resort-white on the navy scrim
  comfortably exceeds WCAG AA 4.5:1.

## LCP

The `<img>` carries `data-ivae-img="hero"` (eager + `fetchpriority="high"`
per Agent 08's contract) plus explicit `loading="eager"` and
`fetchpriority="high"` so even without JS the browser prioritises it.
