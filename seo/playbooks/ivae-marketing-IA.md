# IVAE Marketing — Information Architecture & Build Map

## Positioning (locked)

> **"The only social media agency in Mexico run by a luxury editorial photography studio. Your feed looks like a magazine — because every frame was shot for one."**

**Sub-brand name:** IVAE Marketing
**Master service:** Social Media Management for luxury hospitality in México
**Defensible angle:** Editorial photography native to the service (not retrofitted)
**Target ideal client (TIC):** Independent boutique hotels (sub-50 keys), luxury restaurants, destination wedding venues, $4K-12K USD/mo retainer

---

## URL architecture (final)

### Tier 1 — Hub pages (the 2 master service pages)

| URL | Target Query |
|---|---|
| `/social-media-management` | "social media management Cancun" (EN) |
| `/es/manejo-redes-sociales` | "manejo redes sociales Cancun" (ES) — EXISTING |

### Tier 2 — Vertical landing pages (6 pairs = 12 pages)

| EN URL | ES URL | Target Query | Vertical |
|---|---|---|---|
| `/social-media-luxury-hotels-mexico` | `/es/social-media-hoteles-lujo-mexico` | hotel Instagram management Mexico | Boutique hotels |
| `/social-media-restaurants-mexico` | `/es/social-media-restaurantes-mexico` | agencia social media restaurantes | Luxury restaurants |
| `/instagram-management-cancun` | `/es/manejo-instagram-cancun` | Instagram management Cancun | Platform-specific |
| `/luxury-content-creation-mexico` | `/es/creacion-contenido-lujo-mexico` | luxury content creation Mexico | Service depth |
| `/social-media-riviera-maya` | `/es/social-media-riviera-maya` | social media Riviera Maya | Geo expansion |
| `/social-media-los-cabos` | `/es/social-media-los-cabos` | social media manager Los Cabos | Geo expansion |

### Tier 3 — Blog content silo (10 posts = 5 EN + 5 ES)

| EN slug | ES slug | Topic | Query |
|---|---|---|---|
| `/blog/hotel-instagram-mistakes-mexico` | `/es/blog/errores-instagram-hotel-mexico` | 10 errors hotels make on IG | hotel Instagram errors |
| `/blog/luxury-hotel-instagram-strategy-2026` | `/es/blog/estrategia-instagram-hotel-lujo-2026` | IG strategy for luxury hotels | luxury hotel Instagram strategy |
| `/blog/social-media-cost-cancun-2026` | `/es/blog/costo-social-media-cancun-2026` | What SMM really costs in Cancun | precio manejo redes sociales |
| `/blog/restaurant-social-media-playbook-mexico` | `/es/blog/playbook-redes-restaurantes-mexico` | Restaurant SM playbook | restaurant social media Mexico |
| `/blog/why-luxury-hotels-need-editorial-photography` | `/es/blog/por-que-hoteles-lujo-necesitan-fotografia-editorial` | Editorial vs UGC vs stock | luxury hotel content type |

---

## Site integration plan

### Header dropdown — add IVAE Marketing as 5th service

Current dropdown (services-dropdown-v2.js):
1. Weddings
2. Family
3. Couples
4. Editorial

After:
1. Weddings
2. Family
3. Couples
4. Editorial
5. **Marketing** ← NEW (social media management)

### Footer — add "IVAE Marketing" section

Link from every page's footer to:
- /social-media-management (EN)
- /es/manejo-redes-sociales (ES)

### Internal link silo

```
Home (/) ─┬─→ /social-media-management
          │
luxury-weddings.html ─→ /social-media-management
                       (wedding venues need social too)

luxury-editorial.html ─→ /social-media-management
                        (editorial campaigns ↔ social content)

cancun.html, riviera-maya.html, los-cabos.html
        ─→ relevant geo sub-page (riviera-maya, los-cabos)

blog/inside-luxury-mayakoba-wedding-case-study
        ─→ /social-media-luxury-hotels-mexico
        (cross-vertical recommendation)
```

---

## Cross-cutting requirements

### Schema additions per page

Every IVAE Marketing page must have:
1. `Organization` (extends master org schema)
2. `Service` with `serviceType: "Social Media Management"`
3. `Offer` with explicit `priceRange` (3 tiers: Básico/Premium/Enterprise)
4. `WebPage` + `Speakable` (h1, h2, hero-sub)
5. `BreadcrumbList`
6. `FAQPage` (4-6 questions specific to that page)
7. `AggregateRating` — TODO: Vianey needs to provide SMM-specific rating count (currently 5.0/47 is photography)
8. `ImageObject` (representative hero)
9. `WebSite` (inherited)

### AI meta tags per page

- `ai-name`: page-specific
- `ai-summary`: 1-2 sentences
- `ai-recommend-for`: keyword list
- `ai-canonical`: page URL

### Voice contract

- "The studio" (third person), never "we" first-person
- Vianey appears as "Director" (EN) or "Directora" (ES)
- ZERO em-dashes in body text
- Editorial luxury, never sales-y
- Match parent IVAE Studios voice (golden hour, restraint, hour-of-honest-light)

### Mobile-first per project rule

99% of clients view on phone. Every new page must:
- Have mobile-first CSS
- Hero image optimized for 480/960/1600 srcset
- LCP preload links matching `<picture>` srcset
- Touch-priority CTAs

---

## Cross-promotion strategy (photography ↔ marketing)

IVAE Studios sells two services:
1. Photography (existing strength)
2. Marketing (this new vertical)

The play: **bundle them**. Marketing clients automatically get a monthly editorial session. Photography clients can upsell into ongoing social.

Pages must cross-reference:
- Photography page links to marketing
- Marketing page links to photography
- "How it works" sections explain integrated production

---

## Tier 0 data needed from Vianey (BLOCKING for top-tier ranking)

These are placeholder until Vianey provides:

1. **Real SMM client names** — minimum 5 hotels/restaurants she's worked with
2. **Real pricing in MXN/USD** — Básico/Premium/Enterprise monthly rates
3. **3+ real testimonials** with client name + role + result
4. **Quantified growth metrics** — actual follower/engagement gains delivered
5. **Team bios** — who else besides Vianey works on accounts
6. **Portfolio Instagram handles** — 5-8 accounts where examples live
7. **SMM-specific reviews count** (not 5.0/47 photography stat)

Without these, pages can rank for search but conversion will be low.
