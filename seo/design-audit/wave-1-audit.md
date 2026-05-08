# IVAE Studios — Wave 1 Design Audit

**Date:** 2026-05-08
**Pages audited:** 12 HTML + 4 CSS shared
**Audit type:** Read-only — no files modified

---

## 1. Executive summary

- **Two parallel design systems exist.** The "v1" system (`#c4a35a` gold, `#1a2433` ink, `#f9f8f7` cream) lives in `luxury-weddings`, `cancun`, `riviera-maya`, `los-cabos`, `about`, `luxury-family-photos`, `couples-photography`, and the older ES service pages. The "v2" system (`#c9a54e` gold, `#1a2230` ink, `#faf8f5` cream) lives in `index.html`, `es/index.html`, `blog.html`, and is the system `dark-mode.css` was authored against. Every page silently disagrees with `dark-mode.css` on the gold hex by ~7% lightness.
- **Token bloat without a single source of truth.** Every page ships its own copy of `:root`, `.site-header`, `.eyebrow`, `.btn-*`, `.faq`, etc. Roughly 60-100 lines of CSS are duplicated per page. A shared `tokens.css` + `components.css` would eliminate ~70% of the per-page `<style>` blocks.
- **Blog system is on a third design.** `blog.html` and `styles/blog.css` use `--ink-2`/`--ink-3` (hyphenated, not numeric), `--paper`/`--paper-2`, `Inter` instead of `Syne`, and `var(--serif)`/`var(--sans)` aliases unavailable elsewhere. This is the most polished system — it should become the canonical reference, but stabilizing it as P0 is constrained because the owner just shipped it.
- **Highest-ROI page (`luxury-weddings.html`) has the worst CSS surface.** It is the bookings page yet also one of the most divergent from canonical. Cleanup here is both the most valuable and the most invasive.
- **No accessibility or contrast disasters detected** at the body-text level — `--muted-l` (0.55 alpha on cream/sand) borders WCAG AA at 4.5:1. Several gold-on-cream uses (eyebrows, CTAs) sit at ~3.1:1 and only pass for non-text/large-text use. Flag, do not panic.

## 2. Tokens inventory (current state)

### Gold tones — 8 distinct values, 2 are dominant

| Hex | Approx use | Where |
|---|---|---|
| `#c4a35a` | Canonical "v1" gold | `luxury-weddings`, `cancun`, `riviera-maya`, `los-cabos`, `about`, `luxury-family-photos`, `couples-photography`, `es/fotografo-cancun`, `es/fotografo-bodas-destino-mexico`, `es/acerca-de` |
| `#a8894a` | `--gold2` v1 (deeper) | same set |
| `#c9a54e` | Canonical "v2" gold | `index.html` line 43, `es/index.html` line 43, `blog.html` line 53, `dark-mode.css` (as `#c9a54e` + `#c9a54e`-derived rgba) |
| `#b08e42` | `--gold2` v2 (deeper) | `index.html` line 43, `es/index.html` line 43 |
| `#a8956f` | accent / hover variant | `blog.html`, scattered |
| `#ceae64` | hard-coded button hover (NOT a token) | `index.html` line 134, `es/index.html` line 134 |
| `#c8b88a` / `#B87A4A` / `#C8B898` | drift in promo cards / quiz UI | `outfit-guide.html`, `brand.html`, etc. |

**rgba gold drift:** `rgba(196,163,90,…)` (= `#c4a35a`) and `rgba(201,165,78,…)` (= `#c9a54e`) are both used on the SAME page in some files.

### Ink/dark tones — 4 dominant

| Hex | Role |
|---|---|
| `#1a2433` | v1 "--ink" (8 pages) |
| `#1a2230` | v2 "--ink" (`index`, `es/index`, `blog`, `dark-mode.css` as `#1a2230`) |
| `#0e1620` | v1 "--ink2" |
| `#0c1219` | v2 "--ink2" + `dark-mode.css` body bg |
| `#131c2a` | `--ink-2` blog, dark-mode rhythm bg |
| `#0a0f17` | footer-darker, blog `--ink-3` adjacent |
| `#070a0f` | dark-mode footer |

### Cream/sand — 6 values

| Hex | Role |
|---|---|
| `#f9f8f7` | v1 cream |
| `#faf8f5` | v2 cream (matches `dark-mode.css`) |
| `#fafaf8` | blog `--paper` |
| `#f3f1ec` | blog `--paper-2` |
| `#ede8df` | v1 sand |
| `#eee8dc` | v2 sand (matches `dark-mode.css` regex matchers) |
| `#e6dccf`, `#e5dacb` | sand2 variants (drift) |

### Typography — fonts loaded

- **Cormorant Garamond** (serif, headings) — 3 distinct weight bundles loaded across pages
- **Syne** (sans, body) — uniform `400;500;600;700`
- **Inter** — only on `blog.html`, conflicts with `Syne` policy
- **Outfit, Space Mono, JetBrains Mono** — appear in scattered admin/gallery/comparison pages
- **136 HTML files** load `fonts.googleapis.com` — centralizing this load would save ~30-60ms per page

### Font sizes — heading scale

`hero h1`: at least 5 different `clamp()` curves across 12 pages. **No modular scale exists.**

Body sizes: `13px / 13.5px / 14px / 14.5px / 15px / 15.5px` — six values for "body text".

### Spacing — recurrence

Section padding varies wildly: `140px clamp(24-28px,5vw,64-80px)` (index) vs `100px 64px` (cancun) vs `120px clamp(28px,5vw,80px) 140px` (FAQ). No 8px-grid discipline.

Header height: `72px` everywhere desktop / `60px` mobile in blog only ✅ (one bright spot).

Card gaps: `3px / 5px / 8px / 10px / 12px / 14px / 16px / 18px / 20px / 24px / 28px` — full continuum.

### Easing

Each page redefines `--lux`, `--smooth`, `--expo` with **different curves**. v1 uses `cubic-bezier(0.16,1,0.3,1)`; v2 uses `cubic-bezier(0.22,0.61,0.36,1)` for the same name. Animation feel literally varies page-to-page.

### Breakpoints

- Desktop-first cutoffs: `767`, `768-1199`, `1200+` on most pages.
- `cancun.html` uses `1024` as its tablet break (line 189) — only outlier.

## 3. Inconsistencies (file:line references)

1. **Two gold canon.** `luxury-weddings.html:38-39` declares `--gold:#c4a35a;--gold2:#a8894a`. `index.html:43` declares `--gold:#c9a54e;--gold2:#b08e42`. `dark-mode.css` lines 109, 167, 195 hard-codes `#c9a54e`. **Result: silent mis-tinting in dark mode on v1 pages.**
2. **Two ink canon.** `luxury-weddings.html:38` `--ink:#1a2433`. `index.html:42` `--ink:#1a2230`. Cascades to every shadow, border alpha, and `:focus-visible` outline.
3. **Cream conflict.** v1 `--cream:#f9f8f7` vs. v2 `--cream:#faf8f5`. `dark-mode.css:36-44` keys its dark-flip on `#faf8f5` literal (line 36) — meaning v1 pages may not flip to dark properly. **P0 dark-mode bug.**
4. **Hard-coded button hover.** `index.html:134, 284` use `background:#ceae64` for `.hero-btn:hover` — not parameterized.
5. **Easing curve drift.** `--lux` defined with different bezier curves on v1 vs v2.
6. **Component drift — `.post-card`.** `blog.html:150-166` uses `var(--serif)` family with `Inter` body. `styles/blog.css:147-152` defines `.rel-card` with `Cormorant Garamond` directly.
7. **Hero pattern drift.** Five different "hero" structures across 8 pages.
8. **`.eyebrow` defined ≥7 times** with slight `letter-spacing` drift (`0.22em` vs `0.28em`).
9. **`prefers-reduced-motion` block** missing on `cancun.html` and `los-cabos.html`.
10. **Cursor element (`.cursor`)** declared on every page with different specs — two custom-cursor implementations.

## 4. Per-page issues

### `index.html` — currently best of v2
- **P1**: `index.html:134` `#ceae64` hover not tokenized.
- **P1**: `--lux/--smooth/--expo` declared but raw `cubic-bezier(0.22,1,0.36,1)` literals reused for `.header-nav` line 81.
- **P2**: `body::before` noise SVG inconsistencies.

### `luxury-weddings.html` — highest-ROI, worst drift
- **P0**: gold = `#c4a35a` while `dark-mode.css` keys on `#c9a54e`. Visible mismatch on hover/focus rings in dark mode.
- **P0**: only 2 media queries, no `prefers-reduced-motion` block.
- **P1**: hero CTA pattern duplicates index but with different paddings.
- **P1**: 641 lines, mostly redeclaration of header/footer/eyebrow already in `styles/main.css` — yet `styles/main.css` is not loaded.

### `cancun.html`
- **P0**: media query at `1024` (line 189) — only page using that breakpoint.
- **P0**: `.header-cta` uses literal `#c4a35a` (line 57) instead of `var(--gold)`.
- **P1**: hero is `clamp(36px,5.5vw,68px)` while index is `clamp(48px,8.5vw,120px)`.
- **P1**: `padding:100px 64px` magic numbers, not clamps.

### `riviera-maya.html`
- **P0**: same `--gold:#c4a35a` mismatch.
- **P1**: hero CTA buttons inherit v1 button system with different padding from index.

### `los-cabos.html`
- Mirrors `riviera-maya.html` issues. Easier to refactor (662 lines).
- **P1**: only 2 media queries, no `prefers-reduced-motion`.

### `about.html`
- **P1**: `.about` section grid is `1.1fr 1fr` (intentional asymmetry).
- **P2**: bio narrative paragraph max-width is 440px; other pages use 480-520px.

### `luxury-family-photos.html` and `couples-photography.html`
- Twins (753/758 lines). Both copy v1 root.
- **P1**: card hover transitions duplicate svc-card patterns from index without using tokens.

### `blog.html` — recently stabilized
- **No P0** — recent V6 redesign is solid.
- **P1**: uses `var(--ease)` instead of `var(--lux)`. Token name doesn't match other pages.

### ES pages
- `es/index.html`: identical structure to `index.html` ✅.
- `es/fotografo-cancun.html`: v1 system, same `--gold:#c4a35a` mismatch.

## 5. Proposed canonical design system

```css
:root {
  /* === COLOR === */
  /* Inks (dark) */
  --ink-1: #1a2230;        /* primary surface (was --ink) */
  --ink-2: #131c2a;        /* secondary band (rhythm) */
  --ink-3: #0c1219;        /* deepest, body in dark mode */
  --ink-4: #0a0f17;        /* footer / hero overlay base */

  /* Creams (light) */
  --cream-1: #faf8f5;      /* primary light surface */
  --cream-2: #f3f1ec;      /* secondary band */
  --sand-1:  #eee8dc;      /* tinted surface */
  --sand-2:  #e5dacb;      /* deeper tinted */

  /* Gold (canonical: warmer v2) */
  --gold:      #c9a54e;    /* primary accent */
  --gold-deep: #a8894a;    /* hover / pressed */
  --gold-soft: rgba(201,165,78,0.18);
  --gold-line: rgba(201,165,78,0.28);
  --gold-glow: rgba(201,165,78,0.06);

  /* Text */
  --text-on-light:    #0e1620;
  --text-on-light-2:  rgba(14,22,32,0.62);
  --text-on-light-3:  rgba(14,22,32,0.40);
  --text-on-dark:     #faf8f5;
  --text-on-dark-2:   rgba(250,248,245,0.62);
  --text-on-dark-3:   rgba(250,248,245,0.34);

  /* Lines */
  --line-on-light: rgba(14,22,32,0.10);
  --line-on-dark:  rgba(250,248,245,0.10);

  /* === TYPOGRAPHY === */
  --font-serif: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --font-sans:  'Syne', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;

  /* Modular scale: 1.333 (perfect fourth) */
  --fs-9:  9px;     /* eyebrow */
  --fs-10: 10px;    /* button label */
  --fs-11: 11px;    /* meta */
  --fs-13: 13px;    /* small body */
  --fs-15: 15px;    /* body */
  --fs-18: 18px;    /* lead */
  --fs-24: 24px;    /* h4 */
  --fs-32: 32px;    /* h3 */
  --fs-44: 44px;    /* h2 */
  --fs-60: 60px;    /* h1 */
  --fs-display: clamp(48px, 8.5vw, 120px); /* hero h1 */

  /* === SPACING (4px base) === */
  --s-1:  4px;   --s-2:  8px;   --s-3:  12px;  --s-4:  16px;
  --s-6:  24px;  --s-8:  32px;  --s-10: 40px;  --s-12: 48px;
  --s-16: 64px;  --s-20: 80px;  --s-24: 96px;  --s-32: 128px;
  --s-section-y: clamp(80px, 9vw, 140px);
  --s-gutter:    clamp(24px, 5vw, 64px);

  /* === ELEVATION === */
  --shadow-1: 0 2px 12px rgba(14,22,32,0.04);
  --shadow-2: 0 6px 24px rgba(14,22,32,0.08);
  --shadow-3: 0 12px 40px rgba(14,22,32,0.16);
  --shadow-gold-sm: 0 2px 16px rgba(201,165,78,0.12);
  --shadow-gold-lg: 0 6px 28px rgba(201,165,78,0.28);

  /* === MOTION === */
  --ease:        cubic-bezier(0.22, 1, 0.36, 1);
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.65, 0, 0.05, 1);
  --t-fast: 0.25s;  --t-med:  0.45s;  --t-slow: 0.9s;

  /* === RADIUS === */
  --r-0: 0;             /* default — keep edge-flush brand */
  --r-sm: 2px;
  --r-pill: 999px;
  --r-circle: 50%;
}
```

## 6. Implementation roadmap (Waves 4-5)

1. **Wave 4a — `luxury-weddings.html`** — top conversion page; biggest gold mismatch. Highest reward.
2. **Wave 4b — `index.html`** — closest to canonical; converting it locks in v2 gold.
3. **Wave 4c — `cancun.html` + `riviera-maya.html`** — sister pages, refactor together.
4. **Wave 4d — `los-cabos.html`** — mirrors riviera-maya.
5. **Wave 5a — `couples-photography.html` + `luxury-family-photos.html`** — twin pages.
6. **Wave 5b — `about.html`** — lower commercial priority.
7. **Wave 5c — ES service pages** — refactor after EN sister pages stable.
8. **Skip / minimal** — `blog.html`, `styles/blog.css`, `es/index.html`, individual blog posts.

After all pages: extract shared CSS into `/styles/tokens.css` + `/styles/components.css`.

## 7. SEO preservation notes

These elements **must not move, change, or have selectors retargeted**:

- `<title>`, `<meta name="description">`, all `<!-- KW:title:start -->` markers
- `<link rel="canonical">`, `<link rel="alternate" hreflang>` (en, es, x-default)
- `<meta name="robots">`, all OG/Twitter meta
- `<meta name="ai-name|ai-summary|ai-recommend-for|ai-canonical">`
- `<meta name="msvalidate.01">`
- `<link rel="alternate" type="application/json" href="/api/facts.json">`
- All `<script type="application/ld+json">` blocks
- `<h1>` text content (keep exact phrasing for SEO)
- `_headers`, `_redirects`, `netlify.toml`, `sitemap.xml`, `robots.txt`, `llms.txt`

**Rule**: refactor CSS class names freely, but never an `id` with `scroll-margin-top` (FAQ jump targets) and never a `data-*` attribute scripts query.

## 8. Risks & open questions for the owner

1. **Adopt v2 gold (`#c9a54e`) as canonical?** Recommended yes — what `dark-mode.css` already targets, slightly warmer/more editorial. ~280 occurrences sitewide need find/replace.
2. **`--cream:#faf8f5` over `#f9f8f7`?** Yes — `dark-mode.css` keys on the former.
3. **Introduce `/styles/tokens.css` + `/styles/components.css`?** Adds 1 network request but eliminates 60+ KB of duplicated inline CSS. Cloudflare caches heavily.
4. **`Inter` on `blog.html` — keep or unify on `Syne`?** Recommend keeping `Inter` for blog body, `Syne` everywhere else.
5. **Hero structure — pick one or allow 2?** Keep both (home + service) but standardize typography curve.
6. **`prefers-reduced-motion` missing on `cancun.html` and `los-cabos.html`** — accessibility risk. Add as P0.
7. **Custom cursor** — drop entirely on touch-first traffic, or keep as luxury micro-detail? Owner picks.
8. **Gallery sub-app + admin** — out of scope unless owner wants brand parity there.

---

## Critical files

- `dark-mode.css` (canonical reference)
- `index.html` (closest to v2 canon)
- `luxury-weddings.html` (highest ROI, worst drift)
- `styles/main.css`, `styles/blog.css`
