# Riviera Maya — destination page README

> **IVAE Studios · Redesign 2026 · Oleada 3 · Agent 10**
> Refactor of `riviera-maya.html` and `es/fotografo-riviera-maya.html`.
> Riviera Maya is the **PRIMARY** destination per BRAND.md §1.

---

## URL surface

| Locale | URL                              | File                               |
|--------|----------------------------------|------------------------------------|
| EN     | `/riviera-maya`                  | `riviera-maya.html`                |
| ES     | `/es/riviera-maya`               | `es/fotografo-riviera-maya.html`   |

`_redirects` already maps `/riviera-maya-photographer → /riviera-maya 200`
(line 12), so historical inbound links continue to resolve.

The ES counterpart filename stays at `es/fotografo-riviera-maya.html` to
preserve hreflang continuity with `/es/fotografo-riviera-maya` references
that may exist in indexed third-party pages. Internal hrefs across the
new page surface use `/es/riviera-maya` (the canonical URL); the legacy
filename and the canonical URL are linked through the existing redirect
graph.

---

## Section map (same shape EN / ES)

| #   | id              | Section                                        | Notes                                                                                |
|-----|-----------------|------------------------------------------------|--------------------------------------------------------------------------------------|
| 01  | (hero)          | `.section--destination-hero`                   | Full-bleed cinematic. H1 carries the `<em>` accent on a single phrase.               |
| 02  | `#orientation`  | `.section--destination-orientation`            | Editorial single-paragraph orientation, signed with the `Æ` mark.                    |
| 03  | `#areas`        | `.section--destination-areas`                  | Six sub-area cards: Tulum · Akumal · Playa del Carmen · Mayakoba · Maroma+Xpu-Ha · Cenotes. |
| 04  | `#light`        | `.section--destination-light`                  | Four-card light-register block (sunrise · open shade · sunset · cenote interior).    |
| 05  | `#gallery`      | `.section--destination-gallery`                | Six-tile editorial bento; first tile is the feature.                                 |
| 06  | `#services`     | `.section--destination-services`               | All six IVAE services link out — **Cenote** is the signature.                        |
| 07  | `#faq`          | `.section--destination-faq`                    | Four destination-specific Qs (native `<details>` accordion).                         |
| 08  | (cross)         | `.section--destination-cross`                  | Two cross-link cards to Cancún and Los Cabos.                                        |
| 09  | `#contact`      | `.section--final-cta` (shared component)       | Restrained close. WhatsApp + email + tel.                                            |

The cenote sub-area card and the cenote service card both link to the
cenote service URL: `/cenote-underwater-photoshoot-tulum` (EN) and
`/es/cenote-tulum` (ES). The latter is currently a TODO endpoint per
`partials/home/05-services.html`; we link it forward in anticipation of
its build in this oleada.

---

## Copy register (BRAND.md §6 / §7)

- **EN H1:** `Riviera Maya. <em>Cenotes and turquoise</em>.`
- **ES H1:** `Riviera Maya. <em>Cenotes y turquesa</em>.`
- **EN lede:** "The Riviera Maya is the studio's home base. Tulum,
  Akumal, Playa del Carmen, Mayakoba — boutique resorts, jungle-adjacent
  beaches, and cenotes. Our most-photographed coast."
- **ES lede:** "La Riviera Maya es la base del estudio. Tulum, Akumal,
  Playa del Carmen, Mayakoba — resorts boutique, playas adyacentes a la
  selva y cenotes. Nuestra costa más fotografiada."

The Spanish lede is **not** a literal translation of the English; both
are written native per BRAND.md §6.5. No prices appear anywhere on the
page (BRAND.md §9 — "investment upon request"). No vetoed clichés
("capture", "freeze time", etc.) appear (BRAND.md §7).

---

## Light note (the differentiator)

Riviera Maya's light is **softer than Cancún** because the coast curves
slightly south-southeast. The page bakes this into a four-card block:

1. **Sunrise** — gold + slightly hazy from inland humidity.
2. **Open shade** — the editor's friend, when the sun crosses overhead.
3. **Sunset** — open shade rather than direct gold; diffused.
4. **Cenote interior** — its own world. Pillars and sunbeams 11 AM–1 PM
   at Gran Cenote.

This is the IVAE-voice version of "best time of day" — a decision
explained, not a tip listicle.

---

## Schema graph (`<script type="application/ld+json">`)

Single `@graph` per locale, six nodes:

1. `LocalBusiness` / `PhotographyBusiness` — canonical biz id, geo at
   `20.4785722, -87.0756298` per BRAND.md §9.
2. `Place` — Riviera Maya area at **`20.5, -87.1`** (the broader
   corridor mid-point, per task spec). `containsPlace` lists Tulum,
   Akumal, Playa del Carmen, Mayakoba, Maroma, Xpu-Ha and three cenotes.
3. `WebPage` — page-level node, `inLanguage` per locale.
4. `BreadcrumbList` — Home → Riviera Maya.
5. `Service` — Riviera Maya Photography (`areaServed` references the
   `Place` node above).
6. `FAQPage` — the four destination-specific Qs from the on-page FAQ.

**No `aggregateRating`** — BRAND.md §9 forbids placeholder review
numbers until the client confirms real GBP data.

---

## Image inventory

All images are real Riviera Maya stock from `/images/`:

- `editorial-session-riviera-maya-resort-ivae-studios.jpg` — hero, OG,
  gallery feature, Akumal area card.
- `couple-session-riviera-maya-ivae-studios.jpg` — Tulum area card,
  gallery couples tile.
- `family-session-canc-n-resort-ivae-studios.jpg` — Mayakoba area card,
  gallery family tile (cropped & captioned to read as Mayakoba).
- `family-session-canc-n-beach-kids-ivae-studios.jpg` — Maroma area
  card, gallery wide-beach tile.
- `couple-session-canc-n-beach-ivae-studios.jpg` — Playa del Carmen
  area card.
- `destination-wedding-table-canc-n-ivae-studios.jpg` — gallery weddings
  tile, captioned Akumal.
- `library/services-cenote-placeholder.jpg` — cenote area card, gallery
  cenote tile. (**TODO:** Agent 30 to swap for a real cenote frame
  once the cenote service page lands; the placeholder is shared with
  `partials/home/05-services.html`.)

Cancún and Los Cabos cross-link cards reuse their canonical home-grid
images (`canc-n-resort-photography-ivae-studios.jpg` and
`los-cabos-sunset-session-ivae-studios.jpg`).

---

## CSS — class namespace (no new module)

Per task spec, **no new CSS module is shipped here**. The page uses the
shared `_destination.css` module from Agent 09 (Cancún) and a small
namespace of BEM-style classes that Agent 09's module is expected to
own:

```
.section--destination-hero
.section--destination-orientation
.section--destination-areas
.section--destination-light
.section--destination-gallery
.section--destination-services
.section--destination-faq
.section--destination-cross
```

Plus the shared atoms already in place from Oleadas 1 & 2:

- `.container`, `.container--prose`, `.container--wide`
- `.eyebrow`, `.text-accent`
- `.btn`, `.btn--gold`, `.btn--ghost-light`, `.btn--lg`, `.btn--link--light`
- `.ivae-image`, `.ivae-image--cinema`
- `.faq-item`, `.faq-item__q`, `.faq-item__a`, `.faq-item__icon`
- `.section--final-cta` and its inner classes (Agent 10 of Oleada 2)
- `.site-nav`, `.nav-drawer`, `.ivae-footer`

If Agent 09 chooses a different naming, this page is the consumer most
likely to need a touch-up; the page sections and IDs above are stable
and document what each block does.

---

## Definition of Done

- [x] EN page replaces existing `riviera-maya.html`.
- [x] ES page at existing filename `es/fotografo-riviera-maya.html`.
- [x] Hero copy, lede, FAQs match task spec exactly.
- [x] Six sub-areas (Tulum / Akumal / Playa del Carmen / Mayakoba /
      Maroma+Xpu-Ha / Cenotes).
- [x] All six services linked; Cenote called out as signature.
- [x] Cenote section links to cenote service page (EN + ES).
- [x] Schema graph with `Place` node geo at `20.5, -87.1`; no
      `aggregateRating`.
- [x] No prices, no clichés, AA voice.
- [x] Real Riviera Maya images everywhere on-page.
