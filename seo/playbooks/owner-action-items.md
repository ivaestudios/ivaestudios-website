# Owner Action Items (Tier 0 — Block production polish)

Last updated: 2026-05-26

These items can only be resolved by Vianey. Each one blocks production
polish for either a Core Web Vital, a schema field, a security control,
or an E-E-A-T signal. Listed in priority order.

---

## 1. CLS fix for `/index.html` and `/es/index.html`

The four `<img>` tags listed below lack both `width` and `height`
attributes. With no intrinsic ratio declared, the browser has nothing
to reserve space with on first paint, so each image push-shifts the
content under it as it loads — a measurable Cumulative Layout Shift
penalty on mobile (where 99% of IVAE traffic lives).

These are the four service-section thumbnails (Destination Weddings,
Couples & Honeymoons, Family Sessions, Editorial & Brand) in the
"Four chapters. One studio." section.

### `/index.html`

| Line | Tag (current) | Source pixel size | Suggested attributes |
|------|---------------|-------------------|----------------------|
| 2991 | `<img src="/images/wedding-bride-cabo-san-lucas-ivae-studios-960.jpg" alt="Destination wedding photography" loading="lazy">` | 960 × 640 | `width="960" height="640"` |
| 3002 | `<img src="/images/couple-cancun-hotel-zone-ivae-studios-9-960.jpg" alt="Couples and honeymoon photography" loading="lazy">` | 960 × 640 | `width="960" height="640"` |
| 3013 | `<img src="/images/family-cancun-hotel-zone-ivae-studios-960.jpg" alt="Family editorial sessions" loading="lazy">` | 960 × 640 | `width="960" height="640"` |
| 3024 | `<img src="/images/editorial-cancun-ivae-studios-960.jpg" alt="Editorial brand photography" loading="lazy">` | 640 × 960 | `width="640" height="960"` |

### `/es/index.html` (same pattern, ES mirror)

| Line | Source pixel size | Suggested attributes |
|------|-------------------|----------------------|
| 2968 | 960 × 640 | `width="960" height="640"` |
| 2979 | 960 × 640 | `width="960" height="640"` |
| 2990 | 960 × 640 | `width="960" height="640"` |
| 3001 | 640 × 960 | `width="640" height="960"` |

> Also add `decoding="async"` while editing — the rest of the file
> uses it consistently and these four are the only stragglers.

> Note: the task brief mentioned 5 `<img>` tags. A fresh grep confirms 4
> per file. The hero `<img>` at line 2941 (EN) / line 2918 (ES) spans
> multiple lines but does carry `width="1600" height="1067"` on its
> trailing line, so it is CLS-safe.

---

## 2. Phone +52 990 204 6514 — RESOLVED (2026-06-05): number is REAL

Confirmed by Vianey: `+52 990 204 6514` is the studio's real WhatsApp
line (used in every wa.me CTA + ContactPoint), and `+52 228 857 0584`
is the real CALLS number that matches the Google Business Profile
(schema `telephone`). Both numbers are real — do NOT treat either as
a fake/invalid placeholder, and never swap or unify them.

---

## 3. Cloudflare Turnstile placeholder sitekey

In `/marketing-intake.html` (around line 1065):

```
data-sitekey="0x4AAAAAAA_PLACEHOLDER_REPLACE_IN_DASHBOARD"
```

Steps:
1. Cloudflare dashboard → Turnstile → create a widget for `ivaestudios.com`.
2. Paste the real sitekey into `/marketing-intake.html`.
3. Add the matching secret as `TURNSTILE_SECRET_KEY` in:
   - GitHub → Settings → Secrets → Actions
   - Cloudflare Pages → Environment Variables

---

## 4. Resend API key + domain verification

The marketing-intake form sends via Resend to `info@ivaestudios.com`.

Steps:
1. Resend dashboard → add `ivaestudios.com` and verify DKIM + SPF + DMARC.
2. Generate an API key.
3. Add it as `RESEND_API_KEY` in:
   - GitHub → Settings → Secrets → Actions
   - Cloudflare Pages → Environment Variables

---

## 5. Three placeholder testimonials in `/index.html` + `/es/index.html`

The names below are fabricated. Replace with real five-star reviews
from the Google Business Profile (use the reviewer's actual first name
and last initial; full names are fine if they appear publicly on GBP).

- Samantha Whitfield
- Marco Benedetti
- Priya Raghavan

---

## 6. Separate Google Business Profile for IVAE Marketing

The sub-brand currently rides on the parent GBP. To compete in B2B
local SMM searches it needs its own profile. Full setup steps in:
`seo/playbooks/ivae-marketing-local-citations.md`.

---

## 7. Five client references for Clutch directory submit

Clutch requires verified client references before a profile can go
live. Five contacts (name, role, company, email, project description)
are needed. Submission checklist in:
`seo/playbooks/marketing-directories-ready.md`.

---

## Lower-priority follow-ups (not blocking, but on the list)

- Real session pricing to replace `$650–$3,500+` placeholder in FAQ schema,
  so `Offer.price` + `priceValidUntil` can ship.
- Single canonical street address + lat/lng for `Organization` schema
  (currently Cancún coords with no street, while GBP pin may be Riviera Maya).
- `AggregateRating` — RESOLVED: the live GBP shows **5.0 / 47 reviews**
  (verified 2026-07-01); site-wide schema already updated to 47.
