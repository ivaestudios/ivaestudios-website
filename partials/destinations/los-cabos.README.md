# `los-cabos` — destination page (Oleada 3 · Agent 11)

Editorial refactor of the **Los Cabos** destination page. Same structural
pattern as Agents 09 (Cancún) and 10 (Riviera Maya). Tailored to the
Pacific side of Mexico and the Baja California Sur peninsula.

## URLs preserved

| Lang | URL                                              | File on disk                          |
|------|--------------------------------------------------|---------------------------------------|
| EN   | `https://ivaestudios.com/cabo-photographer`      | `los-cabos.html`                      |
| ES   | `https://ivaestudios.com/es/fotografo-los-cabos` | `es/fotografo-los-cabos.html`         |

`_redirects` already rewrites `/cabo-photographer` → `/los-cabos` (200) and
`/los-cabos.html` → `/cabo-photographer` (301). No redirect changes shipped.

## Page sections (top → bottom)

1. `section--dest-hero` — full-bleed cinematic. Title, italic-gold accent
   on "Pacific drama". Lede with the four sub-area names.
2. `section--dest-intro` — warm-sand band, prose width. Editorial paragraph
   on the Pacific–Sea-of-Cortez meeting line.
3. `section--dest-areas` — five sub-areas (Cabo San Lucas, Pedregal,
   El Arco / Lovers Beach, Corridor, San José del Cabo). Two-column on
   tablet+, single column on mobile. No imagery.
4. `section--dest-resorts` — informational chip list of the eight resorts
   we work with. No logos, no claims of partnership. Brand discipline:
   text only.
5. `section--dest-light` — regional brief on Cabo's hard, reflective
   desert light. Open-shade rule for noon, forty-minute sunset window.
6. `section--dest-services` — six-row matrix. Yacht is marked **Signature**.
   Cenote is marked **Not in region** (no cenotes in Baja California Sur).
7. `section--dest-faq` — four questions: Pacific or Sea of Cortez,
   El Arco ceremony, airport distance, whale season impact.
8. `section--dest-cta` — regional close on `--deep-atlantic`. Mirrors the
   homepage final-cta (Æ ornament, gold rule, gold + ghost-light buttons).

## Voice (per BRAND.md §6)

* Pacific drama, harsh light, brief golden hour — explained, not adorned.
* "Now booking 2026" / "Send me your dates" / "We respond within 24 hours".
* No prices, no awards, no influencer copy.
* Italic-gold `<em>` on a single word per block — never on full sentences.
* Spanish is authentic Mexican Spanish (not literal translation):
  — "Mar de Cortés", "panga", "marea", "Carretera 1", "jacarandas",
  — "Mándanos tus fechas", "Reservas 2026".

## Light register (per BRAND.md §8)

This page sits under register **4 · Editorial · contrast** — the photograph
selection should reflect Pacific high-contrast amber light. The single
hero image used today (`los-cabos-sunset-session-ivae-studios.jpg`) is in
that register; future curation should preserve the same direction.

## CSS

Uses the shared `styles/_destination.css` module (created with this agent,
reused by Agents 09 and 10). Activated in `styles/main.css`. All values
flow from `_tokens.css`.

## Schema.org graph

The `<script type="application/ld+json">` `@graph` includes:

* `LocalBusiness` (canonical organization node — Riviera Maya pin
  20.4785722, -87.0756298 per BRAND.md §9).
* `TouristDestination` for Los Cabos (geo `~22.89, -109.91`, contained in
  Baja California Sur / Mexico, with included attractions: El Arco,
  Lovers Beach, Pedregal, Palmilla, San José Art District).
* `Service` for Los Cabos resort photography.
* `WebPage` + `BreadcrumbList` (Home → Destinations → Los Cabos).
* `FAQPage` (4 Q&A — same content as the visible FAQ).

The ES file uses the same graph with `inLanguage: "es"`, the ES canonical,
and ES-translated text values. Both files declare the EN canonical via
the `LocalBusiness` `@id` so the organization remains a single entity.

## Quality bar

* WCAG AA — Resort White on Deep Atlantic ≈ 16:1; Atlantic Navy on
  Resort White ≈ 14.7:1; soft-slate on Resort White ≈ 4.65:1.
* Mobile-first CSS, no fixed widths over 320px without breakpoint guards.
* Reduced motion respected on the FAQ icon and reveal entrances.
* No external CDN for fonts — uses self-hosted WOFF2 via `_fonts.css`.
* No prices, no aggregateRating, no placeholder TODOs in shipping copy.

## Out of scope

* Image AVIF/WebP ladder generation — handled by Agent 30 once the final
  curation is locked.
* Sitemap entry — already present (`sitemap.xml`).
* Newsletter form wiring — `/api/newsletter` endpoint owned by the
  serverless work in a later oleada.
