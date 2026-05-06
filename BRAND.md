# IVAE Studios — Brand Reference (Build Spec)

> **MUST-READ for every agent working on this redesign.**
> This is the canonical source. If a decision conflicts with this file, this file wins.

---

## 1. Positioning (one sentence)

IVAE Studios is **the luxury resort photographer of Mexico** for international travelers (USA / Canada) staying at premium resorts in **Riviera Maya · Cancún · Los Cabos**, who value editorial direction over generic vacation photos.

**Hospitality canon**: Aman, Six Senses, Hermès, Vogue Weddings.
**Photography canon**: Jose Villa, Norman Jean Roy, Belathee.
**The standard**: every page must provoke "I want this photographer" — not "nice photos."

---

## 2. Brand pillars

| Pillar | What it means in code |
|---|---|
| **Editorial, not aspirational** | No clichés, no influencer copy, no emojis in headers |
| **Authority without effort** | Show control of process (timing, light, location) — never list awards |
| **Implicit demand** | "Now booking 2026" — never "¡Reserva ya!" |
| **Bilingual native** | EN primary for USA/CA, ES authentic for local. Never literal translations |
| **Restraint** | Generous whitespace, gold as a rare accent (5% max), small CTAs, never load 3 things where 1 suffices |

---

## 3. Color palette (exact, do not approximate)

```css
--atlantic-navy:   #1A2433;  /* deep, safe, timeless          — 25% usage */
--resort-white:    #F9F8F7;  /* warm, breathing, natural light — 50% usage */
--soft-slate:      #5A6A7A;  /* neutral, stable, serene        —  8% usage */
--warm-sand:       #E6DCCF;  /* earth, skin, sand              — 12% usage */
--editorial-gold:  #C4A35A;  /* accent, rare, ceremonial       —  5% usage */
--deep-atlantic:   #0F1620;  /* covers, night, cinematic       — covers only */
```

**Proportion rules:**
- Resort White and Atlantic Navy are protagonists. Web is built on them.
- Warm Sand and Soft Slate appear in narrative blocks, separators, prints — warmth without saturation.
- **Editorial Gold is reserved for typographic details, section numbers, the æ ornament. Never as a dominant background.**

> "El lujo no se mide por la cantidad de oro sino por dónde decides no usarlo."

---

## 4. Logo system (3 marks)

Files live in `images/brand/` (created by Agent 03 LOGO-SVG).

| Mark | Use | File (after Oleada 1) |
|---|---|---|
| **Wordmark** `IVAE STUDIOS` | Default. Headers, footers, primary brand surfaces. | `wordmark.svg`, `wordmark-white.svg`, `wordmark-navy.svg`, `wordmark-sand.svg` |
| **Ornamental** `IVæE` (æ in gold italic) | Editorial pieces, watermarks, intimate applications. | `ornamental.svg`, `ornamental-deep.svg`, `ornamental-slate.svg` |
| **Monogram** `Æ` (gold italic) | Favicon, tiny avatars, seals, sticker, lacquer. | `monogram.svg`, `monogram-gold.svg` |

**Construction:**
- `IVAE` set in **DM Serif Display** (high-contrast editorial serif).
- `STUDIOS` set in extended sans-serif (use **Inter** with letter-spacing 0.4em uppercase, weight 500).
- The `æ` ligature in the ornamental mark is **Bodoni Moda Italic** in `--editorial-gold`.
- The `Æ` monogram is **Bodoni Moda Italic** in `--editorial-gold`.

**Exclusion zone:** padding equal to the height of the letter `I` in the wordmark on all sides. Nothing — text, image, gradient — invades.

**Forbidden:** stretching, condensing, rotating, tilting, drop shadows, outlines, bevels, glow, 3D, replacing the serif, mixing wordmark with ornamental in the same piece, gradients on the logo.

**Minimum sizes:** wordmark ≥ 80px width on screen / 22mm in print. Below that, switch to monogram.

---

## 5. Typography

```css
/* Display + headlines + logo */
--font-display: 'DM Serif Display', 'Times New Roman', serif;

/* Editorial accent — italic gold only */
--font-accent: 'Bodoni Moda', 'Didot', serif;
font-style: italic;
color: var(--editorial-gold);

/* Body, UI, navigation, captions, forms — everything else */
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
```

**Hierarchy:**
| Token | Family | Size | Tracking |
|---|---|---|---|
| `h1` | DM Serif Display 400 | 44–110pt | tight |
| `h2` | DM Serif Display 400 | 22–32pt | tight |
| `accent` | Bodoni Moda Italic 400 | 18–28pt | normal |
| `body` | Inter 400 | 8.5–10pt (≈ 14–16px web) | normal |
| `eyebrow` | Inter 400 | 6.5pt (≈ 11–12px) | **0.4em uppercase** |

**Non-negotiable rules:**
- Only **two families per composition** (DM Serif Display + Inter, OR DM Serif Display + Bodoni Italic).
- `eyebrow` is **always** uppercase + tracking 0.4em.
- Body is **always left-aligned**, never justified.
- Italic gold appears as accent on **a single word per block** — never on full sentences.
- Spanish quotes `« »` preferred over English `" "` in Spanish pages.

---

## 6. Voice — six principles

1. **Editorial, not empty aspirational.** We sound like a premium travel magazine, not an influencer.
2. **Authority without effort.** Show control by explaining decisions (timing, light, location) — not by listing achievements.
3. **Sharp hooks, never clichés.** Direct, intelligent, occasionally bold — without losing class.
4. **Implicit demand.** "Now booking for [month]" — never "Book now!". Scarcity without cheap urgency.
5. **Native bilingual.** English primary for USA/CA, authentic Spanish for locals. Never literal translation.
6. **The IVAE standard.** Every piece must answer: does this provoke "I want this photographer" or only "nice photos"?

---

## 7. Permitted & forbidden language

### ✅ ALLOWED
- "The reason your vacation photos don't look this polished."
- "What luxury resorts don't tell you about photos."
- "Now booking for [month]" — availability as demand signal.
- "Send me your travel dates" — soft CTA.
- "Editorial direction", "considered", "intentional", "restrained".
- Decisions explained: timing, light, location, wind, crowd control.

### ❌ FORBIDDEN
- "Capture", "freeze time", "moments that last forever" — **vetoed clichés**.
- "It's not about posing… It's about timing" — repetitive structures.
- "Husband and wife team" — **never describe the studio this way**.
- Quantifying the team. Always "our team" or the studio name.
- Decorative emojis in main captions (✨🌴💕). Exception: stories.
- "Tips básicos", TikTok-style listicles, empty aspirational language.

---

## 8. Photography direction (when picking & cropping images)

Four light registers must coexist in feed and deliverables. Never all warm, never all cool — the feed is a **system, not a collection**.

1. **Golden hour · warm**
2. **Open shade · soft**
3. **Marina · Atlantic blue**
4. **Editorial · contrast**

**Editing rules:**
- Skin tones warm but natural. Shadows in deep blue-green, never flat gray. Greens moderately saturated. No aggressive vintage filters. Skin tone consistency across the gallery.
- Carousel openings: avoid couple hugs (too pattern-saturated). Prefer architectural composition, editorial detail, or individual portrait with clear direction.

---

## 9. Business data (canonical — no placeholders)

```yaml
name:        IVAE Studios
legal_name:  IVAE Studios | Family & Couples Photographer in Cancún
phone_call:  +52 228 857 0584
phone_wa:    +52 990 204 6514
email:       info@ivaestudios.com
service_areas:
  - Riviera Maya  # PRIMARY
  - Cancún
  - Los Cabos
gbp_pin:
  lat: 20.4785722
  lng: -87.0756298
gbp_url:     https://maps.app.goo.gl/aX7jiVbLzwurMmX19
instagram:   '@ivaestudios.cancun'
ig_url:      https://www.instagram.com/ivaestudios.cancun/
website:     https://ivaestudios.com
pricing:     "Investment upon request"  # do not show tiers
booking:     WhatsApp + email (no public calendar yet)
```

**Phone formatting in HTML:**
- WhatsApp link: `https://wa.me/529902046514` (no `+`, no spaces, no dashes — international format without leading 00).
- Tel link: `tel:+522288570584`.
- Display: format as `+52 228 857 0584` and `+52 990 204 6514`.

**Schema.org coordinates:** always `20.4785722, -87.0756298`. The previous coordinates (`21.1619, -86.8515`) in any file are **wrong**. Replace.

**Aggregate rating:** TBD by client. Until confirmed, **omit `aggregateRating` from schema entirely** rather than make up numbers.

---

## 10. Architecture rules

- Static HTML deployed by Cloudflare Pages on push to `main`. **No framework migration.**
- Cloudflare reads `_redirects` and `_headers` at repo root. `netlify.toml` is ignored.
- Cloudflare auto-deploys on every push to `main` → branch deploys go to preview URLs at `<commit>.ivaestudios-website.pages.dev`.
- `feat/redesign-2026` is the destination branch for this redesign. Every Oleada agent works in a child branch and we merge up.

---

## 11. Things this redesign DOES NOT touch

- `gallery/` (sub-app HTMLs, JS, CSS, fonts, sw.js, schema, migrations)
- `functions/api/gallery/[[path]].js` (Cloudflare Pages Function for gallery API)
- `functions/gallery/` (any gallery worker code)
- `gallery/admin/*` (gallery admin UI)
- `.github/workflows/gallery-cron-sweep.yml`
- `gallery.ivaestudios.com` URL surface

If a file path begins with `gallery/` or `functions/api/gallery/` or `functions/gallery/` — **do not modify it.** Even if you see a bug. Out of scope.

---

## 12. Files this redesign DOES touch

Anything in:
- `/` root HTMLs (`index.html`, `about*.html`, `cancun.html`, `riviera-maya.html`, `los-cabos.html`, `couples-photography.html`, `luxury-family-photos.html`, `luxury-weddings.html`, `outfit-guide.html`, `blog.html`, `404.html`, `post-*.html`, `admin.html`)
- `/es/` (entire Spanish mirror including `/es/blog/`)
- `/styles/` (`main.css`, `blog.css`, plus new `_*.css` modules created by Oleada 1)
- `/js/` (excluding `gallery/`)
- `/images/` (excluding `gallery/`)
- `/scripts/` (Python automation)
- `_redirects`, `_headers`, `sitemap.xml`, `robots.txt`, `llms.txt`
- `partials/` (new — created by Agent 30)

---

## 13. CSS module convention (Oleada 1)

```
styles/
├── main.css            (orchestrator — imports the modules below)
├── _tokens.css         (Agent 01 — colors, fonts, spacing, shadows, motion)
├── _fonts.css          (Agent 02 — @font-face declarations, preloads)
├── _base.css           (Agent 10 — reset, html/body, focus, smooth scroll)
├── _logo.css           (Agent 03 — logo SVG sizing/colors)
├── _nav.css            (Agent 04 — navigation)
├── _footer.css         (Agent 05 — footer)
├── _buttons.css        (Agent 06 — button system)
├── _forms.css          (Agent 07 — input system)
├── _image.css          (Agent 08 — image component)
├── _animations.css     (Agent 09 — fade-up, reveals)
├── blog.css            (existing — refactored in Oleada 4)
└── ... more in later oleadas
```

`main.css` ends Oleada 1 with imports in this order:
```css
@import "_tokens.css";
@import "_fonts.css";
@import "_base.css";
@import "_logo.css";
@import "_buttons.css";
@import "_forms.css";
@import "_image.css";
@import "_animations.css";
@import "_nav.css";
@import "_footer.css";
```

---

## 14. Branch & commit conventions

- Branch naming: `feat/r26-<oleada>-<NN>-<slug>` (e.g. `feat/r26-1-01-tokens`).
- Commit subject: `<oleada>/<NN> <slug>: <one-line>` (e.g. `1/01 tokens: brand color/typography/spacing system`).
- Each agent makes **at most 3 commits** on their branch and reports done.
- No agent pushes — the orchestrator pushes after merging up.

---

## 15. Definition of Done (every agent)

1. Files created/modified per spec, no placeholder TODOs.
2. CSS validates (no bad properties, no unused vendor prefixes).
3. JS lint-clean (no `console.log`, no `var` — use `const`/`let`).
4. No Atlantic Navy text on Resort White below WCAG AA contrast (4.5:1 minimum). Verify with `docs/_contrast-check.md` if unsure.
5. Mobile-first CSS — no fixed pixel widths over 320px without breakpoint guards.
6. Reduced-motion respected (`@media (prefers-reduced-motion: reduce)`).
7. No external CDN for fonts (self-host WOFF2). No `font-display: block`.
8. Commit on the agent's branch. Branch ready to merge to `feat/redesign-2026`.

---

*Last updated: Mayo 2026 · Brand Identity Manual v1.0 (Volumen 01).*
