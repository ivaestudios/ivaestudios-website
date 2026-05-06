# Oleada 5 / Agent 11 — Broken Internal Links Audit

Tool: `scripts/audit_links.py`. Run on `feat/r26-5-11-broken-links`.

## Before

- Unique broken hrefs: **38**
- Total file occurrences: **216**

## After

- Unique broken hrefs: **0**
- Total file occurrences: **0**

## Fixes by category

### 1. Source HTML — bare service-page typo (ES + EN)

Service grids referenced an inexistent slug `/cenote-underwater-photoshoot-tulum`
(that slug only exists as a *blog* post). Pointed at the actual service page.

| Old href | New href | Files |
|---|---|---|
| `/cenote-underwater-photoshoot-tulum` | `/cenote-photography` | `index.html`, `riviera-maya.html` (2 places), `partials/home/05-services.html` |
| `/es/cenote-tulum` | `/es/cenote-photography` | `es/index.html`, `es/fotografo-riviera-maya.html` (2 places), `partials/home/05-services.html` |

### 2. Source HTML — EN blog slug typos

| Old href | New href | Files |
|---|---|---|
| `/blog/cancun-vs-riviera-maya` | `/blog/cancun-vs-riviera-maya-photos` | `post-destination-wedding`, `post-tulum-photography-guide`, `post-wedding-cancun` |
| `/blog/los-cabos-guide` | `/blog/los-cabos-photographer-guide` | `post-golden-hour-photography-mexico`, `post-luxury-yacht-photography-cancun` |
| `/blog/destination-wedding` | `/blog/destination-wedding-photographer-riviera-maya` | `post-destination-elopement-mexico`, `post-trash-the-dress-cancun` |
| `/blog/vow-renewal-mexico` | `/blog/vow-renewal-mexico-photography` | `post-anniversary-photography-mexico` (2x) |
| `/blog/surprise-proposal-photography-mexico` | `/blog/surprise-proposal-photography-cancun` | `post-engagement` |
| `/blog/surprise-proposal-photographer-cancun` | `/blog/surprise-proposal-photography-cancun` | `couples-photography` |
| `/blog/honeymoon` | `/blog/honeymoon-photographer-riviera-maya` | `post-vow-renewal-mexico` |
| `/blog/family-vacation-photos` | `/blog/family-vacation-photos-mexico` | `post-quinceanera-photoshoot-cancun` (2x) |

### 3. Source HTML — ES blog slug typos / EN-style slugs

| Old href | New href | Files |
|---|---|---|
| `/es/blog/best-photo-locations-riviera-maya` | `/es/blog/mejores-locaciones-foto-riviera-maya` | `es/fotografo-los-cabos`, `es/vianey-ortega/index` |
| `/es/blog/best-resorts-cancun-photography` | `/es/blog/mejores-resorts-fotografia-cancun` | `es/vianey-ortega/index` |
| `/es/blog/cenote-underwater-photoshoot-tulum` | `/es/blog/sesion-cenote-submarina-tulum` | `es/vianey-ortega/index` |
| `/es/blog/los-cabos-photographer-guide` | `/es/blog/guia-fotografo-los-cabos` | `es/fotografo-los-cabos` |
| `/es/blog/bachelorette-photoshoot-los-cabos` | `/es/blog/sesion-despedida-soltera-los-cabos` | `es/fotografo-los-cabos` |
| `/es/blog/cancun-vs-riviera-maya` | `/es/blog/cancun-vs-riviera-maya-fotos` | `es/fotografo-cancun` |
| `/es/blog/fotografo-mejores-locaciones-riviera-maya` | `/es/blog/mejores-locaciones-foto-riviera-maya` | `es/fotografo-riviera-maya` |
| `/es/blog/sesion-cenote-tulum` | `/es/blog/sesion-cenote-submarina-tulum` | `es/fotografo-riviera-maya` |
| `/es/blog/sesion-cenote-submarino-tulum` | `/es/blog/sesion-cenote-submarina-tulum` | `es/blog/fotografia-propuesta-sorpresa-cancun` (2x) |
| `/es/blog/elopement-destino-mexico` | `/es/blog/fuga-boda-destino-mexico` | `es/fotografo-bodas-destino-mexico` |
| `/es/blog/golden-hour-mexico` | `/es/blog/fotografia-hora-dorada-mexico` | `es/fotografo-bodas-destino-mexico` |
| `/es/blog/renovacion-votos-mexico` | `/es/blog/renovacion-votos-mexico-fotografia` | `es/blog/fotografia-aniversario-mexico` (2x) |
| `/es/blog/propuesta-sorpresa-fotografo-cancun` | `/es/blog/fotografia-propuesta-sorpresa-cancun` | `es/fotografia-parejas-mexico` |
| `/es/blog/mejores-resorts-cancun-fotografia` | `/es/blog/mejores-resorts-fotografia-cancun` | `es/fotografia-yate-cancun` |

### 4. Source HTML — ES service-page typos

| Old href | New href | Files |
|---|---|---|
| `/es/portfolio` | `/es/portafolio` | `es/blog/como-elegir-fotografo-lujo-mexico` |
| `/es/fotografia-familiar-lujo` | `/es/fotos-familiares-lujo-cancun` | `es/blog/sesion-cumpleanos-cancun` (2x) |
| `/es/fotografia-de-parejas` | `/es/fotografia-parejas-mexico` | `es/blog/sesion-cumpleanos-cancun` (2x) |
| `/es/bodas-de-lujo` | `/es/fotografo-bodas-destino-mexico` | `es/blog/fotografo-boda-cancun` (2x), `es/blog/fotografo-boda-destino-riviera-maya` |

### 5. `_redirects` additions — ES "design URLs" (high-fanout from nav/footer)

The Spanish nav (`partials/nav.html`) and footer (`partials/footer.html`) use
English-style clean URLs (`/es/about`, `/es/cancun`, etc.) but the actual files
are Spanish-slugged. Rather than editing every page that injects nav/footer,
added rewrites so editors keep one canonical clean URL per surface.

```
/es/about               /es/acerca-de.html                        200
/es/cancun              /es/fotografo-cancun.html                 200
/es/riviera-maya        /es/fotografo-riviera-maya.html           200
/es/los-cabos           /es/fotografo-los-cabos.html              200
/es/outfit-guide        /es/guia-vestuario.html                   200
/es/contact             /es/contacto.html                         200
/es/luxury-family-photos  /es/fotos-familiares-lujo-cancun.html   200
/es/luxury-weddings     /es/fotografo-bodas-destino-mexico.html   200
/es/couples-photography /es/fotografia-parejas-mexico.html        200
/es/terminos            /es/terms.html                            200
/es/privacidad          /es/privacy.html                          200
```

### 6. `_redirects` fix — broken target

`/es/cenote /es/cenote-tulum.html 200` rewrote to a file that does not exist.
Updated target to `/es/cenote-photography.html` (the actual service page).

## Follow-up flagged for later oleadas

- `partials/footer.html` line 277 has a `TODO: /es/privacy y /es/terms aún no
  existen — autorizar en oleada posterior`. The pages exist (`es/privacy.html`,
  `es/terms.html`), but ES copy is still EN. Translation pass still needed.
- `partials/nav.html` lines 128-129 and 171-172 mark `/es/#contact` as a TODO
  to swap with `/es/contacto` once Agent 21 ships. With this audit, `/es/contact`
  now resolves; nav can keep `/es/#contact` (anchor) or move to `/es/contact`
  at editorial discretion.

## Final state

`python3 scripts/audit_links.py` → 0 broken internal links across 60+ HTML files.
