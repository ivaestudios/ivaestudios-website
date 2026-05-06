# 08-testimonials.html — slot conventions

Editorial pull-quote section. Three Bodoni-italic quotes, navy on resort-white, single gold guillemet ornament per quote. Two prebuilt language blocks (`<!-- ─── ENGLISH ─── -->`, `<!-- ─── SPANISH ─── -->`). Agent 30 picks ONE block per page based on locale.

## TODO-REPLACE pattern (Tier 0 — pending real reviews)

Per BRAND.md §9 and CLAUDE.md "Tier 0 — needs real data": every quote is a placeholder until Vianey supplies the real Google Business Profile reviews. Two grep-friendly markers per slot:

1. HTML comment above the text: `<!-- TODO-REPLACE: real review when client provides Tier 0 reviews -->`
2. Literal placeholder in the attribution: `[Real name pending]` (EN) / `[Nombre real pendiente]` (ES).

When real reviews arrive, run from repo root: `grep -rn "TODO-REPLACE: real review" partials/ es/ index.html`, `grep -rn "Real name pending" partials/ es/ index.html`, `grep -rn "Nombre real pendiente" partials/ es/ index.html`. Each returns 3 hits per language file — one per quote, in order.

## Slot order (match real reviews to these categories)

| # | Category                      | Location     |
|---|-------------------------------|--------------|
| 1 | Family session                | Riviera Maya |
| 2 | Couples / Anniversary session | Cancún       |
| 3 | Destination wedding           | Los Cabos    |

Pair real reviews to the matching category before swapping the name and rewriting `quote__detail`. Pair with `styles/_home-testimonials.css` (documents the BRAND.md §5 pull-quote exception: full italic block stays navy; gold remains rare — one ornament + `·` separator).
