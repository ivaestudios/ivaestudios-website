# IVAE Studios — Self-hosted brand fonts

WOFF2 for the three brand families declared in `BRAND.md` §5:
**DM Serif Display**, **Inter**, **Bodoni Moda Italic**.

## Source

Google Fonts CSS API (`fonts.gstatic.com`):
`https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400..700&family=Bodoni+Moda:ital@1&display=swap`

Only **latin** and **latin-ext** subsets are kept (EN + ES). Cyrillic,
Greek, Vietnamese, math, symbol subsets were dropped to cut wire weight.

## License

SIL Open Font License v1.1 — see `LICENSE-OFL.txt`.

## Why self-hosted (per `BRAND.md` §15)

- **Perf** — single origin, no extra DNS/TLS to `fonts.gstatic.com`.
- **Privacy** — no font requests leak visitor IPs to Google.
- **CSP** — keeps `font-src` / `style-src` on `'self'`.

## Updating versions

1. Re-fetch the Google Fonts CSS (same `family=…` query above).
2. Diff `unicode-range` blocks against `styles/_fonts.css`; update if Google
   changed subset boundaries.
3. Download the latin + latin-ext WOFF2 URLs, overwriting files here.
