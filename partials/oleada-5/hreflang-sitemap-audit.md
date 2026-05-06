# Oleada 5 / Agent 03 — hreflang reciprocity + sitemap.xml audit

Auditor: feat/r26-5-03-hreflang-sitemap. Scope: 93 sitemap URLs, 113 HTML files (94 with hreflang), 140 `_redirects` rules.

## 1. Hreflang mismatches found and fixed (10 HTMLs)

Stale hreflang/canonical pointing at legacy slugs that 301-redirect (lossy
for SEO equity). All updated to the post-Oleada-3 short slugs that match
the sitemap. For each file the canonical, both `hreflang="en|es|x-default"`
links, and the in-page language switcher anchors were updated.

| File | Old EN URL | New EN URL |
|---|---|---|
| `cancun.html` | `/cancun.html` | `/cancun` |
| `couples-photography.html` | `/couples-photography-mexico` | `/couples-photography` |
| `los-cabos.html` | `/cabo-photographer` | `/los-cabos` |
| `luxury-family-photos.html` | `/luxury-family-photos-cancun` | `/luxury-family-photos` |
| `luxury-weddings.html` | `/destination-wedding-photographer-mexico` | `/luxury-weddings` |
| `riviera-maya.html` | (EN OK; ES wrong: `/es/riviera-maya`) | ES → `/es/fotografo-riviera-maya` |
| `es/fotografo-cancun.html` | `/cancun.html`, self `/es/fotografo-cancun.html` | `/cancun`, self `/es/fotografo-cancun` |
| `es/fotografia-parejas-mexico.html` | `/couples-photography-mexico` | `/couples-photography` |
| `es/fotografo-bodas-destino-mexico.html` | `/destination-wedding-photographer-mexico` | `/luxury-weddings` |
| `es/fotografo-los-cabos.html` | `/cabo-photographer` | `/los-cabos` |
| `es/fotografo-riviera-maya.html` | self `/es/riviera-maya` | self `/es/fotografo-riviera-maya` |
| `es/fotos-familiares-lujo-cancun.html` | `/luxury-family-photos-cancun` | `/luxury-family-photos` |

After fixes: 0 broken hreflang targets, 0 asymmetric pairs across all 94 hreflang-bearing HTMLs.

## 2. Sitemap entries pointing to missing files (and resolution)

| Old `<loc>` | New `<loc>` |
|---|---|
| `https://ivaestudios.com/es/cenote-tulum` | `https://ivaestudios.com/es/cenote-photography` |
| `https://ivaestudios.com/es/portfolio` | `https://ivaestudios.com/es/portafolio` |

Both fixes match the actual filenames (`es/cenote-photography.html`,
`es/portafolio.html`) and the `<link rel="canonical">` declared inside those
HTMLs.

## 3. Broken `_redirects` targets (and resolution)

| Line | Old rule | Fix |
|---|---|---|
| 27 | `/es/contacto /es/contact.html 200` | target → `/es/contacto.html` (file is `contacto`, not `contact`) |
| 32 | `/es/cenote /es/cenote-tulum.html 200` | target → `/es/cenote-photography.html` (no `cenote-tulum.html` exists) |
| 39 | `/es/portfolio/ /es/portfolio.html 200` | replaced with `/es/portafolio/ /es/portafolio.html 200` and added `/es/portfolio /es/portafolio 301` |

After fixes: 0 broken targets across all 140 redirect rules.

## 4. Pages on disk not in sitemap

None. All 93 public HTML files (excluding `404.html`, `admin.html`, gallery sub-app)
have canonicals that match a `<loc>` in `sitemap.xml`.

## 5. Pages in sitemap with no file

None after fixes (was 2; resolved by sitemap edits, not by removal — both
files exist under different slugs).

## 6. Validation

- `sitemap.xml` parses as well-formed XML (root `urlset`, 93 `<url>` entries).
- All hreflang `<link rel="alternate">` targets resolve to a real file or via
  a 200 rewrite in `_redirects`.
- All `_redirects` targets (excluding pattern rules) resolve to a real file.
