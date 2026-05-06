# `partials/nav.html` — usage

Reusable primary navigation. Built by Oleada 1 / Agent 04. Wiring into
existing pages happens in **Oleada 3 / Agent 30 (partials-system)** — do
not inject by hand.

## Files

| File | Purpose |
|---|---|
| `partials/nav.html` | Markup, EN + ES side-by-side |
| `styles/_nav.css` | Companion CSS, imported by `main.css` |
| `js/nav.js` | Companion JS, ship as `defer` |

## How Agent 30 should inject

1. Read `partials/nav.html`.
2. Split on `<!-- ─── ENGLISH ─── -->` and `<!-- ─── SPANISH ─── -->`.
3. Emit the Spanish block for pages under `/es/`, English block otherwise.
4. Insert directly inside `<body>`, before `<main>`.
5. Confirm `main.css` is linked and `js/nav.js` runs deferred.

## Marking the active link

Add `aria-current="page"` to the `<a>` whose `data-nav` matches the page
(e.g. `data-nav="studio"` on `/about`). Triggers the gold underline.

## Per-page overrides

| Class on `<body>` | Effect |
|---|---|
| `nav--always-solid` | Skip transparent state — render scrolled style always. Use on pages without a hero. |
| `nav--accent-light` | Force light text + shadow regardless of scroll. |

(Hook classes — actual CSS rules ship in Oleada 2.)

## Logo

Partial points to `/images/brand/wordmark-navy.svg` (Agent 03). CSS inverts
it to white in the transparent state, removes the filter when scrolled.
Once `wordmark-white.svg` lands, swap via `<picture>` for crisp edges.
