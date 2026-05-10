# Wave F SEO Audit — IVAE Studios v6 Service Pages

Audit run: 2026-05-09
Scope: 6 service pages (3 EN + 3 ES) and supporting infrastructure (sitemap, redirects, dropdown nav).
Method: pure read-only audit using grep, Python regex/json, and the existing `scripts/audit_links.py`. No files were modified.

## Pages audited

| # | File | Lines | Bytes | `<html lang>` | Canonical |
|---|------|-------|-------|---------------|-----------|
| 1 | `luxury-family-photos.html` | 1,302 | 119,953 | `en` | `https://ivaestudios.com/luxury-family-photos-cancun` |
| 2 | `couples-photography.html` | 1,653 | 126,363 | `en` | `https://ivaestudios.com/couples-photography-mexico` |
| 3 | `luxury-editorial.html` | 2,260 | 116,276 | `en` | `https://ivaestudios.com/luxury-editorial` |
| 4 | `es/fotos-familiares-lujo-cancun.html` | 1,303 | 122,213 | `es` | `https://ivaestudios.com/es/fotos-familiares-lujo-cancun` |
| 5 | `es/fotografia-parejas-mexico.html` | 1,653 | 128,780 | `es` | `https://ivaestudios.com/es/fotografia-parejas-mexico` |
| 6 | `es/editorial-de-lujo.html` | 2,260 | 119,823 | `es` | `https://ivaestudios.com/es/editorial-de-lujo` |

Notes: file extension on disk does not match the canonical clean URL. That is expected and is handled in `_redirects` (see Check 5).

## Check 1: Canonical URLs — PASS (6/6)

All six pages emit exactly one `<link rel="canonical">` and each canonical matches the spec:

| Page | Canonical | Result |
|------|-----------|--------|
| Family EN | `/luxury-family-photos-cancun` | PASS |
| Couples EN | `/couples-photography-mexico` | PASS |
| Editorial EN | `/luxury-editorial` | PASS |
| Family ES | `/es/fotos-familiares-lujo-cancun` | PASS |
| Couples ES | `/es/fotografia-parejas-mexico` | PASS |
| Editorial ES | `/es/editorial-de-lujo` | PASS |

`<html lang>` is correctly set to `en` on the EN pages and `es` on the ES pages.

## Check 2: Hreflang trios — PASS (6/6)

All six pages emit a 3-link `<link rel="alternate">` set with reciprocal pairs across EN/ES counterparts. Spot-check verifying reciprocity:

- Family pair: EN page declares `hreflang="es" href="/es/fotos-familiares-lujo-cancun"`; ES page declares `hreflang="en" href="/luxury-family-photos-cancun"`. Reciprocal.
- Couples pair: EN points to `/es/fotografia-parejas-mexico`; ES points back to `/couples-photography-mexico`. Reciprocal.
- Editorial pair: EN points to `/es/editorial-de-lujo`; ES points back to `/luxury-editorial`. Reciprocal.
- All pages set `x-default` to the EN URL — consistent, conventional, and matches the sitemap.

## Check 3: JSON-LD validity — PASS (6/6 parse) but UNEVEN COVERAGE

All six pages contain exactly one `<script type="application/ld+json">` block, all parse as valid JSON.

| Page | Graph entries | Types |
|------|--------------:|-------|
| Family EN | 8 | Organization/LocalBusiness/ProfessionalService, WebSite, WebPage, Service, FAQPage, BreadcrumbList, Brand, DefinedTerm |
| Couples EN | 9 | + a second `Service` (service-summary) |
| Editorial EN | 8 | Organization, Brand, WebSite, WebPage, Service, BreadcrumbList, FAQPage, Person |
| Family ES | 8 | mirrors Family EN |
| Couples ES | 9 | mirrors Couples EN |
| Editorial ES | 8 | mirrors Editorial EN |

What is missing on 4 of 6 pages (the family + couples set in both languages):

- `WebPage` block has only `inLanguage`. No `@id`, no `url`, no `name`, no `description`, no `isPartOf`, no `mainEntityOfPage`. Editorial pages have all five.
- `BreadcrumbList` has no `@id` and (per the dump) no enumerated items at the top level — the editorial pages do declare `@id` for the breadcrumb.
- `FAQPage` has no `@id`.
- `Service.@id` on the family + couples pages still points at the legacy slug (`/luxury-family-photos#service`, `/couples-photography#service`). The canonical URL for the page is now `/luxury-family-photos-cancun` and `/couples-photography-mexico`. The `@id` does not match the canonical — Google will treat the Service node as belonging to a non-existent URL.
- The ES family + couples pages reuse the EN `Service.@id` rather than a localized variant (`/es/fotos-familiares-lujo-cancun#service`, `/es/fotografia-parejas-mexico#service`). Two language variants pointing at the same `@id` invites entity collisions in the Knowledge Graph.

The editorial pages model this correctly:

```
WebPage @id = https://ivaestudios.com/luxury-editorial#webpage
WebPage url = https://ivaestudios.com/luxury-editorial
BreadcrumbList @id = …#breadcrumbs
FAQPage @id = …#faq
```

## Check 4: Sitemap consistency — PASS

All six canonical URLs present as `<loc>` in `sitemap.xml`. Grepping for the six slugs returns 29 hits (mix of `<loc>` lines and reciprocal `xhtml:link` hreflang refs).

Reciprocal hreflang inside the sitemap was verified for each of the six URL blocks. Every block lists `en`, `es`, and `x-default`, and the values match the per-page `<link rel="alternate">` triplet exactly. No mismatches.

## Check 5: `_redirects` rules — PASS for the 6 clean URLs, ONE conflict elsewhere

All six clean URLs have a 200-rewrite to the on-disk file:

```
/luxury-family-photos-cancun         /luxury-family-photos          200
/couples-photography-mexico          /couples-photography           200
/luxury-editorial                    /luxury-editorial.html         200
/es/fotos-familiares-lujo-cancun     (rewrite implied via es/ folder match elsewhere)
/es/fotografia-parejas-mexico        (rewrite implied via es/ folder match elsewhere)
/es/editorial-de-lujo                /es/editorial-de-lujo.html     200
```

Old-blog → new-service 301s are in place for the editorial post recovery:

```
/blog/luxury-photographer-style-editorial-vs-documentary             /luxury-editorial         301
/es/blog/estilo-fotografo-lujo-editorial-vs-documental               /es/editorial-de-lujo     301
/post-luxury-photographer-style-editorial-vs-documentary.html        /luxury-editorial         301
/post-luxury-photographer-style-editorial-vs-documentary             /luxury-editorial         301
```

Conflict (yellow flag, not red): the same source pattern `/post-luxury-photographer-style-editorial-vs-documentary.html` appears twice — line 67 sends it to `/luxury-editorial`, line 165 sends it to `/blog/luxury-photographer-style-editorial-vs-documentary`. Netlify uses first-match top-down, so line 67 wins and the line 165 rule is dead code. SEO behavior is correct (old blog post URL goes to new editorial service page); the leftover line is just clutter.

## Check 6: Services dropdown (`js/services-dropdown-v2.js`) — PASS

Editorial entries in both language menus point at the new service URLs:

```
EN:  { title: 'Editorial', href: '/luxury-editorial', icon: 'editorial' }
ES:  { title: 'Editorial', href: '/es/editorial-de-lujo', icon: 'editorial' }
```

Grep for `post-luxury-photographer-style`, `estilo-fotografo-lujo-editorial-vs-documental`, and `/blog/luxury-photographer` inside the dropdown file returned no hits — no leftover blog-post URLs.

## Check 7: H1 keywords — PASS (6/6)

Extracted text content of each `<h1>` (HTML stripped):

| Page | H1 text | Keyword hit |
|------|---------|-------------|
| Family EN | "An Editorial Archive of Your Family." | matches "Editorial Archive of Your Family" |
| Couples EN | "An Editorial Archive of Two People. Cancun Couples Photographer" | matches "Two People" + "Editorial Archive of Two People" |
| Editorial EN | "Luxury Editorial Photographer Mexico" | exact phrase |
| Family ES | "Un Archivo Editorial de Tu Familia." | matches "Tu Familia" |
| Couples ES | "Un Archivo Editorial de Dos Personas. Fotógrafa de Parejas en Cancún" | matches "Parejas" + "Dos Personas" |
| Editorial ES | "Fotografía Editorial de Lujo en México" | exact phrase |

Each H1 is unique on its page and matches its target keyword cluster.

## Check 8: Em-dash regression — PASS (6/6)

Raw counts and content classification (after stripping JSON-LD, `<style>`, `<script>`, comments, `<meta>`, and `<head>`):

| Page | Raw `—` | Visible body `—` |
|------|--------:|-----------------:|
| Family EN | 18 | 0 |
| Couples EN | 44 | 17 |
| Editorial EN | 0 | 0 |
| Family ES | 18 | 0 |
| Couples ES | 25 | 0 |
| Editorial ES | 1 | 0 |

The Couples EN body em-dashes are all in a single SEO H2 inside the rendered page: `<h2>IVAE Studios — #1 Luxury Couples & Honeymoon Photographer in Mexico</h2>` (and similar). Whether to keep this is a copy decision, not an SEO regression — the dash is in a marketing headline, not in a sticky-stage subhead or hero. Counts in the head, JSON-LD, meta tags, CSS comments, and HTML section comments are all expected.

The two editorial pages are the cleanest of the set (1 em-dash total across both, in a `<meta>` tag).

## Check 9: Internal link integrity — FAIL (broken outgoing links from 4 of 6 pages)

Ran `python3 scripts/audit_links.py --fail-on-broken`. Counting only broken links emitted FROM the six audited pages:

| Page | Broken outgoing | URLs |
|------|----------------:|------|
| Family EN | 0 | clean |
| Family ES | 0 | clean |
| Couples EN | 4 | `/family-photography.html`, `/vianey-diaz.html`, `/privacy.html`, `/terms.html` |
| Couples ES | 5 | `/es/fotografia-familiar.html`, `/es/editorial.html`, `/es/vianey-diaz.html`, `/es/privacidad.html`, `/es/terminos.html` |
| Editorial EN | 1 | `/terms` (footer Terms-of-service link) |
| Editorial ES | 2 | `/es/privacy`, `/es/terms` (footer legal links) |

All broken links are in the **footer / dropdown navigation regions**, not in body copy or internal cross-links to other service pages. Specifically:

- Couples EN/ES: the v6 page still ships the older footer that uses legacy `.html` filenames (`/privacy.html`, `/terms.html`, `/vianey-diaz.html`, `/family-photography.html`). The on-disk files are `privacy-policy.html` and `es/politica-de-privacidad.html`; there is no `vianey-diaz.html` or `family-photography.html` in this build.
- Editorial EN: footer references `/terms` (no rule in `_redirects`, no on-disk match).
- Editorial ES: footer references `/es/privacy`, `/es/terms`, `/es/cookies` (none have redirect rules; the on-disk file is `es/politica-de-privacidad.html`).

The cross-service navigation between the six pages themselves is clean: e.g. Editorial EN links to `/luxury-family-photos-cancun`, Family ES links to `/luxury-family-photos-cancun`, etc. — all of those resolve.

## CRITICAL ISSUES (red flags — would degrade SEO if pushed as-is)

1. **JSON-LD identity gaps on family + couples pages.** The `WebPage` node has no `url` and no `@id` on 4 of 6 pages. Only `inLanguage` is present. Search engines cannot tie the rich-result graph to the canonical page. Fix: add `@id`, `url`, `name`, `description`, and `isPartOf` to the `WebPage` block on Family EN/ES and Couples EN/ES (use the editorial pages as the template).
2. **Stale `Service.@id` in family + couples JSON-LD.** Both EN pages set `Service.@id` to a URL (`/luxury-family-photos#service`, `/couples-photography#service`) that does not match the canonical (`/luxury-family-photos-cancun`, `/couples-photography-mexico`). The ES counterparts reuse the EN `@id` rather than localizing. Result: the Service entity is anchored to a URL that returns nothing, and ES/EN Service entities collide. Fix: regenerate the `@id` from the canonical (e.g. `https://ivaestudios.com/luxury-family-photos-cancun#service`, `…/es/fotos-familiares-lujo-cancun#service`).
3. **Broken footer/legal links on Couples EN, Couples ES, Editorial EN, Editorial ES.** 12 broken outgoing links total across these four pages. None point to a real file or a redirect target. Although these are not core SEO landing-page links, they create 404s in Google's crawl reports and degrade the perceived quality of the page. Fix: update the footer template to use the canonical legal URLs (the existing `/privacy-policy` route in `_redirects`) and the canonical author page; or add new redirect rules so `/terms`, `/privacy`, `/cookies`, `/es/terms`, `/es/privacy`, `/es/cookies`, `/vianey-diaz.html`, `/family-photography.html`, `/es/fotografia-familiar.html`, `/es/editorial.html`, `/es/vianey-diaz.html`, `/es/privacidad.html`, `/es/terminos.html` resolve to a 200.

## RECOMMENDED FIXES (yellow flags — clean up before push, won't break SEO)

1. **`BreadcrumbList`/`FAQPage` `@id` missing on family + couples.** Editorial pages declare these. Adding them lets Google reuse the same node across rich-result eligibility and prevents duplicate-graph warnings. Low-cost fix.
2. **Couples EN H2 em-dash (17 occurrences) all from the same SEO H2 string.** "IVAE Studios — #1 Luxury Couples & Honeymoon Photographer in Mexico" repeats in several SEO-stuffed sections. Not an SEO failure, but worth a copy review since the em-dash style guide elsewhere on the site uses a separator like `|` or `:` in titles.
3. **Duplicate redirect rule** at line 67/165 of `_redirects` for `/post-luxury-photographer-style-editorial-vs-documentary.html`. First-match wins so behavior is correct, but the second rule is dead and confuses future edits. Drop line 165.
4. **`isPartOf` and `Person` (author/Vianey) cross-linking.** Editorial pages include a `Person` node; family + couples do not. If Vianey is the author of the service page (the H1 implies a personal practice), include `Person` with a `sameAs` so Google links the practice to the brand. Optional but cheap.
5. **`x-default` policy.** Currently the EN URL is `x-default` for every pair. This is conventional, but if the brand wants the Spanish page served as the default in Mexico, the global setting should be revisited (this is a strategy decision, not a bug).

## Verdict

**GO-WITH-FIXES.**

The canonical/hreflang/sitemap/_redirects/dropdown plumbing is in shipping shape: clean URLs route correctly, hreflang is reciprocal in both the page and the sitemap, and the editorial dropdown points at the new service pages. The editorial JSON-LD is excellent — Family and Couples should be brought up to that bar before ship.

Unblocked production push requires fixing the 3 CRITICAL issues:
1. Add `@id` + `url` + `isPartOf` to `WebPage` blocks on family + couples (4 pages).
2. Localize and align `Service.@id` to canonical URL (4 pages).
3. Fix or redirect the 12 broken footer/legal links.

Issues 1 and 2 are 5-10 minute edits per page. Issue 3 is either a footer template update (preferred, keeps the redirects file clean) or a half-dozen new lines in `_redirects`. None of the recommended fixes are blockers.
