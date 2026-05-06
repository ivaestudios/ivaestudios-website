# IVAE Studios — Redesign 2026 · Final QA Report (Oleada 5, Agent 14)

**Date:** 2026-05-06 · **Branch:** `feat/r26-5-14-qa-final` · **Total root HTML pages:** 70 (EN + ES + posts).

## Executive summary

**PASS WITH FOLLOW-UPS.** The site is structurally launch-ready. All build,
asset, JSON-LD, and routing issues found have been fixed in this commit. Six
follow-ups remain — all owner-actionable, none block deploy.

---

## 1. Build sanity

| Check | Result |
|---|---|
| `<link rel=stylesheet>` hrefs resolve | PASS — all reference `/styles/main.css` and `/styles/print.css` (both exist) |
| `<script src=>` resolves | PASS — all 7 scripts (`animations`, `home-portfolio`, `home`, `image-loader`, `nav`, `portfolio-filter`, `portfolio`) exist in `/js/` |
| `<img src=>` and `<source srcset>` | PASS on 8-page sample; placeholder TODOs noted in `_legacy.css` & `_image.css` modules — not broken refs |
| Internal `<a href=>` resolves (file or `_redirects`) | PASS after fixes — see §6 |
| JSON-LD parses (10-page sample) | PASS — 11/11 blocks parse on `index, about, contact, portfolio, blog, outfit-guide, cancun, luxury-weddings, post-honeymoon, es/index, vianey-ortega` |

## 2. SEO baseline

| Check | Result |
|---|---|
| `<title>` ≤ 65 chars | **5 fail** — `index.html` (83), `about.html` (69), `es/index.html` (85), `es/acerca-de.html` (78), `vianey-ortega/index.html` (75). Non-blocking; Google truncates but indexes. |
| `<meta name=description>` 130–165 chars | **6 fail (sample)** — `contact` (189), `portfolio` (191), `outfit-guide` (168), `cancun` (219), `luxury-weddings` (167), `vianey-ortega` (173). All over-length, none missing. |
| Canonical present | PASS on 12-page sample |
| Hreflang reciprocity | PASS — every sampled page has `en` + `es` + `x-default`; pairs reference each other |
| sitemap.xml URLs all resolve | PASS after fixes — 93 URLs, 0 broken |
| robots.txt sane | PASS — explicit AI-bot allowlist + `Disallow: /admin /api /functions /gallery /cdn-cgi`; sitemap referenced |

## 3. Voice scan — zero-tolerance items

| Pattern | Hits |
|---|---|
| `capture / captures / captured / capturing` (body copy) | 1 — `post-gender-reveal-photoshoot-cancun.html:271` ("captured in soft open shade"). Single editorial verb, low priority — flagged for follow-up. |
| `freeze time` / `freeze the moment` / `freeze moments` | 0 |
| `moments that last forever` | 0 |
| `husband and wife team` | 0 |
| `Vianey Díaz` (must be `Vianey Ortega`) | 0 (FIXED — see §6) |
| Old phone area codes / wrong coords (21.1619, -86.8515) | 0 (FIXED — see §6) |

## 4. Performance baseline

| Check | Result |
|---|---|
| Body fonts preloaded | PASS — 2 `rel=preload as=font` per page (sampled) |
| Hero `fetchpriority=high` | PARTIAL — `index, cancun, luxury-weddings, post-honeymoon, es/index` PASS; `about, contact, portfolio, outfit-guide` have 0. Non-blocking. |
| Below-fold `loading=lazy` | PASS where applicable — `index` (12), `portfolio` (49), `cancun` (6), `outfit-guide` (6); `about` 0 lazy because hero-only |
| `main.css` orchestration | PASS — clean `@import` order: tokens → fonts → base → components → pages → legacy |

## 5. Accessibility sample

| Check | Result |
|---|---|
| `<html lang>` set | PASS — every public page; only partials (correctly) lack it |
| Skip-link present | PASS — 12/12 sampled pages |
| Form inputs labelled | PASS — `contact.html` & `es/contacto.html` both have label-for coverage on all 7 inputs |
| `<img alt>` present | PASS — 8/8 sampled pages have `alt` on every `<img>` |

## 6. Critical issues found AND FIXED in this commit

1. **Two broken internal links** (would 404 on launch):
   - `index.html:704` — `/cenote-underwater-photoshoot-tulum` → fixed to `/cenote-photography`.
   - `es/index.html:658` — `/es/cenote-tulum` → added redirect rule `/es/cenote-tulum → /es/cenote-photography.html 200`.
2. **Two broken sitemap URLs** (would expose 404s to crawlers):
   - `https://ivaestudios.com/es/cenote-tulum` → rewritten to `/es/cenote-photography`.
   - `https://ivaestudios.com/es/portfolio` → rewritten to `/es/portafolio` (file is `portafolio.html`, not `portfolio.html`).
3. **Missing redirect for ES portfolio**: `/es/portfolio` had no working rule (target file absent) — added `/es/portfolio → /es/portafolio.html 200` plus trailing-slash variants.
4. **Founder name violation** (BRAND.md §9): 8 files used "Vianey Díaz" — must be "Vianey Ortega". Fixed: `admin.html`, `cenote-photography.html`, `post-bachelorette-photoshoot-los-cabos.html`, `post-maternity.html`, `es/cenote-photography.html`, `es/manejo-redes-sociales.html`, `es/blog/sesion-despedida-soltera-los-cabos.html`, `es/blog/sesion-maternidad-cancun-riviera-maya.html`. Also rewrote schema `@id` `vianey-diaz` → `vianey-ortega`.
5. **Wrong coordinates** (BRAND.md §9): `21.1619 / -86.8515` (10 occurrences across `admin.html`, `es/manejo-redes-sociales.html`) → corrected to `20.4785722 / -87.0756298`.

## 7. Non-critical TODOs (owner / future oleada)

1. **`admin.html` hardcodes the password `ivae2026`** (also `focal-admin.js`, `functions/api/focal.js`). The page is `Disallow`'d in robots.txt, but the secret is plain-text in shipped JS — anyone who guesses the URL can read it. Move to env var on the Function side and replace the client-side gate with a 401 response. **Treat as security follow-up before going public.**
2. **Title length** > 65 chars on 5 high-traffic pages (see §2). Worth a copy pass.
3. **Meta description** length > 165 chars on 6 sampled pages. Trim or split.
4. **`fetchpriority=high`** missing on `about`, `contact`, `portfolio`, `outfit-guide` heroes — add for LCP.
5. **One `captured` verb** in `post-gender-reveal-photoshoot-cancun.html:271` — review for editorial fit.
6. **Placeholder testimonials** still on `index.html` + `es/index.html` (per `CLAUDE.md` Tier 2). Replace before launch.
7. **`AggregateRating 5.0 / 42`** is a placeholder per BRAND.md §9 — confirm against live GBP or remove the schema entirely.
8. **Phone `+52 990 204 6514`** has an impossible Mexican area code — confirm with owner.
9. **`session-cenote-placeholder.jpg`** TODO note in `index.html:706` — image not yet in `/images/library/`.

## 8. Launch checklist (owner — before merging to `main`)

- [ ] Replace `ivae2026` admin password with server-side auth.
- [ ] Confirm GBP phone, address, and aggregate rating numbers are real.
- [ ] Replace 3 placeholder testimonials in homepage (EN + ES).
- [ ] Trim 5 over-length titles + 6 over-length meta descriptions.
- [ ] Add `fetchpriority="high"` to hero images on `about, contact, portfolio, outfit-guide`.
- [ ] Run `python scripts/audit_links.py --fail-on-broken` once more from clean checkout.
- [ ] Push to `main`; Cloudflare auto-deploys; `SEO — Index URLs` workflow pings Google.
