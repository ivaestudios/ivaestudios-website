# 13 — home-js

Homepage-level JS orchestrator. Wires the global helpers
(`IVAE.anim`, `IVAE.image`, `nav.js`) — each of which auto-inits —
and adds three behaviors specific to `index.html` / `es/index.html`.

File: `js/home.js` · Public API: `window.IVAE.home`.

## A. Scroll progress indicator

A 1px gold horizontal line fixed to the top of the viewport. Width
animates from `0%` → `100%` based on document scroll progress. The
element `<div id="ivae-scroll-progress" aria-hidden="true">` is
injected as the first child of `<body>` if absent. Styles are set
inline by JS (no separate CSS module — keeps Agent 12's
`_home.css` orchestrator untouched). Scroll handler is rAF-throttled
and `passive`. Under `prefers-reduced-motion: reduce` the width
still updates (no animation) so the indicator is honest.

z-index uses `var(--z-overlay)` so it sits above the sticky nav.
Background uses `var(--editorial-gold)`.

## B. FAQ deep-link convention

Hash pattern: `#faq-1` … `#faq-8`. Coordinates with Agent 11's HTML
(each FAQ `<details>` carries the matching `id`). On load and on
`hashchange`, if the URL hash matches `^#faq-\d+$` the corresponding
`<details>` is opened (`el.open = true`) and scrolled into view
with the sticky-nav offset applied.

## C. Anchor smooth-scroll fallback

`_base.css` already sets `scroll-padding-top: var(--space-9)`, but
some browsers (older Safari, JS-triggered hash navigation,
click-through from external pages) don't honor it. We delegate
clicks on `a[href^="#"]`, compute the target's offset minus
`--space-9`, call `window.scrollTo({ top, behavior: 'smooth' })`,
and update the URL with `history.pushState` so no native jump
happens. Reduced-motion users get `behavior: 'auto'`.
