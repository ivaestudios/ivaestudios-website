# Bio page — Vianey Ortega

Owner: Oleada 3 · Agent 02 · branch `feat/r26-3-02-vianey-bio`.
This is the founder profile page for E-E-A-T signals. Google needs a real, named expert behind the studio; this page satisfies that requirement.

## Pages

- `vianey-ortega/index.html` — English bio, served at `/vianey-ortega/`.
- `es/vianey-ortega/index.html` — Spanish mirror, served at `/es/vianey-ortega/`.

## URL pattern

`/vianey-ortega/` (directory + `index.html`) was chosen over the flat `vianey-ortega.html` because:
- Cleaner canonical URL — strong E-E-A-T author signal.
- Cloudflare Pages serves directory `index.html` at the trailing-slash URL natively, no extra `_redirects` rules required.
- Easier to add child resources later (e.g. `/vianey-ortega/press/`) without renaming.

No `_redirects` amendment is needed for this URL surface — Agent 18 owns site-wide URL routing. If a `/vianey-diaz/` rewrite is ever wanted (BRAND.md's outdated todo references that name), it should go in `_redirects` as `/vianey-diaz/* /vianey-ortega/:splat 301`.

## Schema

Each page injects a single `@graph` with five nodes:

1. `LocalBusiness` (`PhotographyBusiness`) — id-stable reference to the canonical studio entity declared on `index.html`.
2. `Person` — `Vianey Ortega`, with `givenName`, `familyName`, `jobTitle`, `description`, `image`, `url`, `worksFor` (ref), `sameAs` (Instagram), `knowsLanguage` (`en`, `es`), `knowsAbout` (specialty list), `address`.
3. `WebPage` + `ProfilePage` — multi-type so Google reads it as both a generic page and an individual profile.
4. `BreadcrumbList` — Home → Vianey Ortega.
5. The `Person` node is `mainEntity` of the `ProfilePage`.

## Photo TODO

There is no portrait of Vianey in `images/` at the time of build. The hero falls back to a Bodoni Æ initial card (BRAND.md §4 monogram on Atlantic Navy with editorial gold). When a portrait lands:

1. Drop the file at `/images/vianey-ortega-portrait.jpg` (3:4 aspect, ≥1200 × 1600 px, color-graded per BRAND.md §8).
2. In each `vianey-ortega/index.html` page, replace the `<div class="bio-hero__monogram">` block with the commented-out `<figure class="ivae-image ivae-image--portrait">` block sitting directly below it.
3. Update the `image` field in both `Person` schemas from `/images/og-default.jpg` to `/images/vianey-ortega-portrait.jpg`.

## Styles

Owns `styles/_bio.css` (~200 lines), wired into `styles/main.css` after `_home.css`. Reuses `.dropcap` from `_base.css`, `.eyebrow` from `_base.css`, `.ivae-image--portrait` from `_image.css`. No inline styles, no hard-coded values — all tokens.
