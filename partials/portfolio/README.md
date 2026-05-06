# Partials · /portfolio

Owner: **Agent 15 · Oleada 3**
Pages produced: `/portfolio.html` (EN) and `/es/portafolio.html` (ES).

The /portfolio page is a single self-contained editorial gallery. It does **not**
follow the multi-section pattern of `partials/home/01..12-*.html` — there are no
inter-agent dependencies that warrant slicing it into named partials. The full
EN and ES markup lives at the page root, side-by-side with the rest of the redesign.

Companion files
---------------

| File | Purpose |
|---|---|
| `/portfolio.html`              | EN page (filterable gallery, hero, final CTA). |
| `/es/portafolio.html`          | ES mirror — same structure, native Spanish copy. |
| `styles/_portfolio.css`        | Page hero, filter pills, justified grid, empty state. |
| `js/portfolio-filter.js`       | Category filter + URL-hash persistence + empty-state toggle. |
| `js/portfolio.js`              | Lightbox wrapper for `[data-lightbox]` triggers — reuses `.portfolio-lightbox` CSS shipped by `_home-portfolio.css`. |

Categories
----------

Family · Couples · Weddings · Maternity · Yacht · Cenote · Editorial.

Buttons render in the same order on both locales. If a category has no
representative images in `images/library/`, the filter still renders so the
taxonomy is intact — clicking activates the soft empty state ("Galleries
available on request") instead of an apologetic blank grid.

Lightbox parity
---------------

`js/portfolio.js` reuses the lightbox visuals built by `js/home-portfolio.js`
(close button, prev/next arrows, focus trap, Escape, ArrowLeft/Right). The
prev/next loop honors the active filter — hidden items are skipped.
