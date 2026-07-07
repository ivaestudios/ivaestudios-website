# IVAE Studios — Luxury Editorial v6 — Phase 3 Section Build Prompts (Locked)

**Page:** NEW. `/luxury-editorial.html` (EN) / `/es/editorial-de-lujo.html` (ES)
**Canonical:** `https://ivaestudios.com/luxury-editorial`
**Phase:** 3 of 5 (8 parallel section build agents — sec1 through sec8)
**Date:** 2026-05-09
**Inputs:** Phase 1 brief (12 sections IA, 12 cinematic features, 24 Wave 8 tokens), Phase 2 copy deck (locked), Phase 2 a11y contract (12 failure modes + cross-cutting)
**Output directory:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec{N}.html`

This document contains 8 self-contained section prompts. Each prompt produces a single HTML fragment file at `.tmp-editorial-sections/sec{N}.html`. A Phase 4 stitch agent reads all 8 fragments, concatenates the bodies into a single `/luxury-editorial.html`, and uses sec1's `<head>` block as the canonical page head.

The 12 IA sections from Phase 1 §5 are compressed into 8 build-units to balance parallelism and coherence:

- **sec1** = Header + Magazine Masthead + Hero (Phase 1 IA §1, §2, plus full SEO `<head>`)
- **sec2** = Manifesto sticky-stage (Phase 1 IA §4)
- **sec3** = Featured editorial cinemascope case study (Phase 1 IA §7)
- **sec4** = "Featured In" press band (Phase 1 IA §3)
- **sec5** = Brackets / Investment (Phase 1 IA §10) — preceded by the 3 Pillars (IA §5 fold-in)
- **sec6** = Method timeline (Phase 1 IA §9)
- **sec7** = Drag-scroll editorial portfolio / The Reel (Phase 1 IA §6)
- **sec8** = Pull-quote + Testimonials + FAQ + Inquiry + Footer (Phase 1 IA §8, §11, §12 + footer)

---

## Common contract for all 8 prompts (read first)

1. **Tokens.** Load `/styles/tokens.css` BEFORE any other stylesheet. Then `/styles/dark-mode.css`. Then `/js/lang-switcher.css`. Then any section-specific CSS appended to the section's `<style>` block. NEVER inline a `:root` block; consume tokens.
2. **No HTML modification.** This is a NEW page from a blank canvas — no existing `/luxury-editorial.html` to read. Each section produces a standalone `.html` fragment in `.tmp-editorial-sections/`.
3. **Locked copy.** All copy is in `/seo/design-audit/editorial-phase-2-copy-deck.md`. Do not paraphrase. Do not invent new sections.
4. **A11y contract.** All accessibility patterns are mandated in `/seo/design-audit/editorial-phase-2-a11y-contract.md`. Follow exactly.
5. **CSS class prefix.** All editorial-specific classes use the `le-*` prefix (LE = Luxury Editorial, parallel to `lw-*` on the wedding page). NO unprefixed utility classes that could collide with global CSS.
6. **Token usage.** All colors, sizes, spacing, motion, ratios reference `var(--…)` from tokens.css OR the Wave 8 additions specced in Phase 1 §3 Skill 4 (24 new editorial tokens). NO hex literals. NO hardcoded px outside what tokens provide.
7. **Visibility-safe.** Each section must render with reasonable visual integrity even if neighbor sections are missing. Use `:where()` or scoped selectors so the section does not bleed style into other sections. Each section is wrapped in a single top-level `<section class="le-section le-section--{name}">` (or `<header>` for sec1's masthead, `<footer>` for sec8's footer block).
8. **Button colors.** Primary CTA (`le-btn-primary`): `--gold` background, `--ink-1` text, `--focus-ring-on-gold` focus ring. Outline / ghost CTA (`le-btn-ghost`): transparent background, `--gold` border, `--gold` text on dark / `--gold-deep` text on cream, `--focus-ring-on-dark` or `--focus-ring-on-light` per ambient.
9. **Reduced motion.** Each section MUST include the relevant `@media (prefers-reduced-motion: reduce)` overrides for any motion-bearing class it introduces. The cumulative effect of all 8 sections is the comprehensive block in a11y contract failure mode 10.
10. **JSON-LD.** Sec1's head includes the canonical JSON-LD `@graph` (Organization, WebSite, Service, Brand, BreadcrumbList, FAQPage). The FAQPage block contains all 10 questions from Phase 2 copy deck Section 11. Sec8 mirrors the FAQ JSON-LD inline (with `<script type="application/ld+json">` attached to the FAQ section) to redundantly preserve the schema if a stitch agent drops sec1's head.
11. **Wave 8 tokens.** Phase 4 will add the 24 Wave 8 tokens to `/styles/tokens.css` BEFORE Phase 3 build. If the tokens are not yet in tokens.css when Phase 3 runs, each prompt's `<style>` block defines a fallback `:root` with the Wave 8 tokens prefixed `--le-fallback-…` and consumed via `var(--editorial-…, var(--le-fallback-…))` cascade. Phase 4 stitch agent removes the fallbacks.
12. **EN page only.** Phase 3 produces the EN page only. The ES mirror is Phase 5 work.

---

## Sec1 — Header + Magazine Masthead + Hero (with full SEO `<head>`)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec1.html`

### Section name
Header + Magazine Masthead (Issue · Volume · Date) + Hero (h1 cascade, animated aperture SVG, parallax editorial image)

### Goal
Sec1 produces the COMPLETE `<head>` for the page (canonical meta, hreflang trio, OG/Twitter, JSON-LD `@graph`, font preconnect, dark-mode.css, lang-switcher.css), the site `<header>` (logo, primary nav with services dropdown, language switcher, header CTA), the magazine masthead band (`Issue No 3 · Vol II · 2026`), and the hero block (eyebrow, h1 with animated aperture, subhead, single CTA "Begin Brief").

### Required `<head>` block (verbatim, locked)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Title and description -->
<title>Luxury Editorial Photographer Mexico | IVAE Studios</title>
<meta name="description" content="Luxury editorial photography for brands working in Mexico. Brand campaigns, magazine commissions, hotel rebrands, lookbooks. Cancun, Riviera Maya, Los Cabos.">
<meta name="robots" content="index, follow, max-image-preview:large">

<!-- Canonical and hreflang -->
<link rel="canonical" href="https://ivaestudios.com/luxury-editorial">
<link rel="alternate" hreflang="en" href="https://ivaestudios.com/luxury-editorial">
<link rel="alternate" hreflang="es" href="https://ivaestudios.com/es/editorial-de-lujo">
<link rel="alternate" hreflang="x-default" href="https://ivaestudios.com/luxury-editorial">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="es_MX">
<meta property="og:url" content="https://ivaestudios.com/luxury-editorial">
<meta property="og:site_name" content="IVAE Studios">
<meta property="og:title" content="Luxury Editorial Photographer Mexico | IVAE Studios">
<meta property="og:description" content="Luxury editorial photography for brands working in Mexico. Brand campaigns, magazine commissions, hotel rebrands, lookbooks.">
<meta property="og:image" content="https://assets.ivaestudios.com/luxury-editorial-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="An editorial campaign frame from a Tulum spring edit, photographed by IVAE Studios.">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Luxury Editorial Photographer Mexico | IVAE Studios">
<meta name="twitter:description" content="Editorial photography for brand campaigns, magazine commissions, hotel rebrands, and lookbooks across Cancun, Riviera Maya, and Los Cabos.">
<meta name="twitter:image" content="https://assets.ivaestudios.com/luxury-editorial-og.jpg">
<meta name="twitter:image:alt" content="An editorial campaign frame from a Tulum spring edit, photographed by IVAE Studios.">

<!-- Theme -->
<meta name="theme-color" content="#0c1219">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- Font preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap">

<!-- Stylesheets -->
<link rel="stylesheet" href="/styles/tokens.css">
<link rel="stylesheet" href="/styles/dark-mode.css">
<link rel="stylesheet" href="/js/lang-switcher.css">

<!-- Favicons -->
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- JSON-LD @graph -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ivaestudios.com/#organization",
      "name": "IVAE Studios",
      "url": "https://ivaestudios.com/",
      "logo": "https://ivaestudios.com/images/logo-ivae.svg",
      "founder": { "@type": "Person", "name": "Vianey Diaz" },
      "areaServed": [
        { "@type": "City", "name": "Cancun" },
        { "@type": "Place", "name": "Riviera Maya" },
        { "@type": "City", "name": "Tulum" },
        { "@type": "City", "name": "Playa del Carmen" },
        { "@type": "City", "name": "Los Cabos" }
      ]
    },
    {
      "@type": "Brand",
      "@id": "https://ivaestudios.com/#brand",
      "name": "IVAE Studios",
      "logo": "https://ivaestudios.com/images/logo-ivae.svg",
      "url": "https://ivaestudios.com/"
    },
    {
      "@type": "WebSite",
      "@id": "https://ivaestudios.com/#website",
      "url": "https://ivaestudios.com/",
      "name": "IVAE Studios",
      "publisher": { "@id": "https://ivaestudios.com/#organization" },
      "inLanguage": ["en-US", "es-MX"]
    },
    {
      "@type": "Service",
      "@id": "https://ivaestudios.com/luxury-editorial#service",
      "name": "Luxury Editorial Photography Mexico",
      "serviceType": "Editorial Photography",
      "description": "Editorial photography for brand campaigns, magazine commissions, hotel rebrands, and lookbooks across Cancun, Riviera Maya, and Los Cabos. Bilingual production, full crew, in-house permits and insurance.",
      "provider": { "@id": "https://ivaestudios.com/#organization" },
      "brand": { "@id": "https://ivaestudios.com/#brand" },
      "areaServed": [
        { "@type": "City", "name": "Cancun" },
        { "@type": "Place", "name": "Riviera Maya" },
        { "@type": "City", "name": "Playa del Carmen" },
        { "@type": "City", "name": "Tulum" },
        { "@type": "City", "name": "Los Cabos" }
      ],
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "priceRange": "$4,500 - $25,000+ USD",
        "availability": "https://schema.org/InStock",
        "url": "https://ivaestudios.com/luxury-editorial"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Editorial Brackets",
        "itemListElement": [
          { "@type": "Offer", "name": "The Editorial Day", "price": "4500", "priceCurrency": "USD", "description": "One-day editorial shoot. Up to eight hours on location. Photographer + assistant + on-set producer. Sixty to one hundred selects in five to ten business days." },
          { "@type": "Offer", "name": "The Campaign", "price": "9500", "priceCurrency": "USD", "description": "Two-day editorial production. Full crew with stylist coordination. One hundred fifty to three hundred selects in ten to fifteen business days. Twelve-month archive licensing." },
          { "@type": "Offer", "name": "The Multi-Day Production", "price": "18000", "priceCurrency": "USD", "description": "Three-plus day editorial production. Photographer + assistant + producer + DP for motion + grip. Three hundred-plus selects in fifteen to twenty business days. Extended archive licensing." }
        ]
      },
      "audience": {
        "@type": "BusinessAudience",
        "audienceType": ["Brand Manager", "Hotel Marketing Director", "Magazine Photo Editor", "DTC Creative Director"]
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://ivaestudios.com/luxury-editorial#breadcrumbs",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ivaestudios.com/" },
        { "@type": "ListItem", "position": 2, "name": "Luxury Editorial", "item": "https://ivaestudios.com/luxury-editorial" }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://ivaestudios.com/luxury-editorial#faq",
      "mainEntity": [
        { "@type": "Question", "name": "What licensing does an editorial commission include?", "acceptedAnswer": { "@type": "Answer", "text": "Each bracket includes a defined licensing scope. The Editorial Day includes print and web licensing, no archive use. The Campaign includes print, web, social, and twelve months of archive use. The Multi-Day Production includes the above plus extended archive licensing for the full life of the brand campaign. Out-of-home, broadcast, and stock-license-style usage are quoted separately." } },
        { "@type": "Question", "name": "What does the studio deliver, and in what format?", "acceptedAnswer": { "@type": "Answer", "text": "Selects arrive in a structured archive: by camera, by set, by frame. RAW files are retained by the studio; high-resolution TIFF or JPEG masters are delivered per the licensing scope. Motion clips are delivered as ProRes 422 HQ masters plus H.264 streaming exports. A Frame.io link covers the review cycle." } },
        { "@type": "Question", "name": "Does the studio handle talent casting?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. The studio works with two casting directors and a roster of forty-plus talent across Mexico City, Cancun, Tulum, and Los Cabos. The brand reviews three options for each role and approves before the call sheet ships. Day rates are quoted at industry standard and pass through to the brand at cost." } },
        { "@type": "Question", "name": "Who handles location permits and access?", "acceptedAnswer": { "@type": "Answer", "text": "The studio handles permits in-house. Public-space permits in Cancun, Riviera Maya, and Los Cabos are filed by the studio's producer with seven to ten business days of lead time. Private-property permits are negotiated directly with the property's events or marketing department. The studio carries general liability insurance at one million USD coverage." } },
        { "@type": "Question", "name": "Who is on the crew?", "acceptedAnswer": { "@type": "Answer", "text": "The Editorial Day runs with one photographer, one assistant, and one on-set producer. The Campaign adds a second producer and stylist coordination. The Multi-Day Production adds a DP for motion, a grip, and a digital tech. All crew are bilingual. Vianey Diaz directs every commission." } },
        { "@type": "Question", "name": "Is retouching included, and to what level?", "acceptedAnswer": { "@type": "Answer", "text": "Standard color and skin retouching are included in every bracket. Heavy compositing, beauty retouching at editorial-cover level, and CGI retouching are quoted separately at one hundred fifty USD per hour. The studio refuses to deliver retouching that erases natural skin texture." } },
        { "@type": "Question", "name": "Will the studio shoot for a competitor?", "acceptedAnswer": { "@type": "Answer", "text": "The studio observes a thirty-day cooling period between commissions in directly competing categories. The studio does not sign category-exclusivity agreements beyond ninety days; long-term exclusivity is a different commercial structure and is quoted on retainer." } },
        { "@type": "Question", "name": "How quickly can a commission move from brief to delivery?", "acceptedAnswer": { "@type": "Answer", "text": "The studio's standing turnaround is eight to twelve weeks from brief sign-off to final delivery for The Campaign and The Multi-Day Production. The Editorial Day can move in two to four weeks if the date is open. Selects ship in five to ten business days; full delivery in fifteen to twenty." } },
        { "@type": "Question", "name": "In what language does the studio work?", "acceptedAnswer": { "@type": "Answer", "text": "English and Spanish, equally. Every email, every call sheet, every contract draft, every Frame.io review note, and every final delivery memo is offered in both languages. The studio's producers are bilingual. Vianey Diaz is fluent in both." } },
        { "@type": "Question", "name": "Will the studio sign an NDA?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. The studio signs mutual NDAs as a standard practice on commissions where the brand is in a launch window or in an unannounced rebrand. Standard scope: a defined embargo period (typically three to twelve months). Permanent-hold work is quoted at a thirty percent premium." } }
      ]
    }
  ]
}
</script>

</head>
```

### HTML skeleton (body block for sec1)

```html
<body class="le-page">

<a class="le-skip-link" href="#main-content">Skip to main content</a>

<!-- Magazine Masthead (decorative, edge-to-edge) -->
<header class="le-masthead" role="banner" aria-label="Editorial masthead">
  <p class="le-masthead-mark">IVAE Studios</p>
  <p class="le-masthead-title"><em>Editorial.</em></p>
  <p class="le-masthead-issue">Issue No 3 &middot; Vol II &middot; 2026</p>
</header>

<!-- Site Header (logo, nav, lang, CTA) -->
<header class="le-site-header">
  <a class="le-logo" href="/" aria-label="IVAE Studios home">
    <img src="/images/logo-ivae.svg" alt="" width="120" height="32">
    <span class="visually-hidden">IVAE Studios</span>
  </a>
  <nav class="le-primary-nav" role="navigation" aria-label="Primary">
    <ul class="le-nav-list">
      <li><a href="/about">About</a></li>
      <li class="le-has-dropdown">
        <button type="button" aria-expanded="false" aria-controls="le-services-menu">Services</button>
        <ul id="le-services-menu" class="le-services-dropdown" hidden>
          <li><a href="/luxury-weddings">Weddings</a></li>
          <li><a href="/luxury-family-photos-cancun">Family</a></li>
          <li><a href="/cancun-couples-photographer">Couples</a></li>
          <li><a href="/luxury-editorial" aria-current="page">Editorial</a></li>
        </ul>
      </li>
      <li><a href="/journal">Journal</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
  <nav class="le-lang-switcher" role="group" aria-label="Language switcher">
    <a href="/luxury-editorial" hreflang="en" lang="en" aria-current="true" class="le-lang-link is-active">English</a>
    <span class="le-lang-sep" aria-hidden="true">|</span>
    <a href="/es/editorial-de-lujo" hreflang="es" lang="es" class="le-lang-link">Español</a>
  </nav>
  <a class="le-btn le-btn-primary le-header-cta" href="#inquiry">Begin Brief</a>
</header>

<main id="main-content" tabindex="-1">

<!-- Hero -->
<section class="le-hero" aria-labelledby="le-hero-h1">
  <div class="le-hero-image-wrap">
    <img class="le-hero-image"
      src="/images/editorial/editorial-cancun-ivae-studios-hero.avif"
      alt="An editorial campaign frame on a Tulum east terrace at first light, photographed by IVAE Studios."
      width="2400" height="1350"
      loading="eager"
      fetchpriority="high"
      decoding="async">
    <div class="le-hero-vignette" aria-hidden="true"></div>
  </div>
  <div class="le-hero-content">
    <p class="le-eyebrow">Editorial Photography &middot; Mexico</p>
    <h1 id="le-hero-h1" class="le-hero-h1">
      <span class="le-word">Luxury</span>
      <span class="le-word">Editorial</span>
      <span class="le-word">Photographer</span>
      <em class="le-hero-h1__italic le-word">Mexico</em>
    </h1>
    <p class="le-hero-sub">Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos.</p>
    <div class="le-hero-cta-wrap">
      <svg class="le-aperture" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false" role="presentation">
        <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <line x1="24" y1="2" x2="24" y2="14" stroke="currentColor" stroke-width="1.4"/>
        <line x1="24" y1="34" x2="24" y2="46" stroke="currentColor" stroke-width="1.4"/>
        <line x1="2" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="1.4"/>
        <line x1="34" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="1.4"/>
        <line x1="8.5" y1="8.5" x2="17" y2="17" stroke="currentColor" stroke-width="1.4"/>
        <line x1="31" y1="31" x2="39.5" y2="39.5" stroke="currentColor" stroke-width="1.4"/>
        <line x1="8.5" y1="39.5" x2="17" y2="31" stroke="currentColor" stroke-width="1.4"/>
        <line x1="31" y1="17" x2="39.5" y2="8.5" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <a class="le-btn le-btn-primary le-hero-cta" href="#inquiry">Begin Brief</a>
    </div>
  </div>
</section>
```

(The `</main>` and `</body>` tags close at the end of sec8, not here.)

### CSS (`<style>` block at end of sec1's body — Phase 4 stitch will move to a single block)

```css
:root {
  /* Wave 8 fallback tokens — remove when /styles/tokens.css ships Wave 8 */
  --le-fallback-masthead-h: clamp(72px, 9vh, 120px);
  --le-fallback-issue-tracking: 0.42em;
  --le-fallback-volume-fs: clamp(11px, 1vw, 13px);
  --le-fallback-aperture-size: 48px;
  --le-fallback-aperture-stroke: 1.4px;
  --le-fallback-aperture-rotation: 16s;
}

/* Page base */
.le-page {
  background: var(--ink-3);
  color: var(--text-on-dark-readable);
  font-family: var(--font-sans);
}

/* Skip link */
.le-skip-link {
  position: absolute; top: 0; left: 0;
  padding: var(--s-3) var(--s-4);
  background: var(--gold); color: var(--ink-1);
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 600;
  text-decoration: none; letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase;
  z-index: var(--z-skiplink);
  transform: translateY(-150%);
  transition: transform var(--t-quick) var(--ease);
}
.le-skip-link:focus,
.le-skip-link:focus-visible {
  transform: translateY(0);
  outline: var(--focus-ring-on-gold); outline-offset: 2px;
}

/* Magazine Masthead */
.le-masthead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: var(--editorial-masthead-height, var(--le-fallback-masthead-h));
  border-top: var(--editorial-masthead-rule, 1px solid var(--gold-line));
  border-bottom: var(--editorial-masthead-rule, 1px solid var(--gold-line));
  padding: 0 var(--s-gutter);
  background: var(--ink-3);
}
.le-masthead-mark {
  font-family: var(--font-sans); font-size: var(--editorial-volume-fs, var(--le-fallback-volume-fs));
  font-weight: 600; letter-spacing: var(--editorial-issue-tracking, var(--le-fallback-issue-tracking));
  text-transform: uppercase; color: var(--gold); margin: 0;
}
.le-masthead-title {
  font-family: var(--font-serif); font-style: italic; font-weight: 400;
  font-size: clamp(28px, 3.4vw, 44px); color: var(--cream-1); margin: 0;
  text-align: center;
}
.le-masthead-issue {
  font-family: var(--font-sans); font-size: var(--editorial-volume-fs, var(--le-fallback-volume-fs));
  font-weight: 600; letter-spacing: var(--editorial-issue-tracking, var(--le-fallback-issue-tracking));
  text-transform: uppercase; color: var(--gold); margin: 0; text-align: right;
}
@media (max-width: 768px) {
  .le-masthead {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    height: auto; padding: var(--s-3) var(--s-gutter);
    text-align: center;
  }
  .le-masthead-mark, .le-masthead-issue { text-align: center; }
}

/* Site Header */
.le-site-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-6); padding: var(--s-4) var(--s-gutter);
  background: var(--ink-3);
  border-bottom: 1px solid var(--gold-line);
  position: relative; z-index: var(--z-header);
}
.le-primary-nav .le-nav-list {
  display: flex; gap: var(--s-6); list-style: none; margin: 0; padding: 0;
}
.le-primary-nav a, .le-primary-nav button {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500;
  letter-spacing: var(--tracking-eyebrow-tight); text-transform: uppercase;
  color: var(--cream-1); background: transparent; border: 0;
  text-decoration: none; cursor: pointer;
}
.le-primary-nav a[aria-current="page"] { color: var(--gold); }
.le-lang-switcher { display: flex; gap: var(--s-2); align-items: center; }
.le-lang-link {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-tight); text-transform: uppercase;
  color: var(--cream-1); text-decoration: none;
}
.le-lang-link.is-active { color: var(--gold); }
.le-lang-sep { color: var(--gold-line); }

/* Hero */
.le-hero {
  position: relative;
  min-height: 100vh;
  display: grid; grid-template-columns: 1fr;
  background: var(--ink-3);
  overflow: hidden;
}
.le-hero-image-wrap {
  position: absolute; inset: 0; z-index: 0;
}
.le-hero-image {
  width: 100%; height: 100%; object-fit: cover;
  filter: brightness(0.55);
}
.le-hero-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
  pointer-events: none;
}
.le-hero-content {
  position: relative; z-index: 2;
  align-self: end; justify-self: start;
  padding: var(--s-12) var(--s-gutter) clamp(80px, 10vw, 140px);
  max-width: 880px;
}
.le-eyebrow {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-4);
}
.le-hero-h1 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(48px, 7vw, 92px);
  line-height: 1.06; color: var(--cream-1); margin: 0 0 var(--s-6);
  text-wrap: balance;
}
.le-hero-h1 .le-word {
  display: inline-block; opacity: 0; transform: translateY(28px);
  animation: le-word-reveal var(--t-cinema) var(--ease-cinema) forwards;
}
.le-hero-h1 .le-word:nth-child(1) { animation-delay: 0.1s; }
.le-hero-h1 .le-word:nth-child(2) { animation-delay: 0.25s; }
.le-hero-h1 .le-word:nth-child(3) { animation-delay: 0.4s; }
.le-hero-h1 .le-word:nth-child(4) { animation-delay: 0.55s; }
.le-hero-h1__italic { font-style: italic; color: var(--gold); }
@keyframes le-word-reveal {
  to { opacity: 1; transform: translateY(0); }
}
.le-hero-sub {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: clamp(18px, 1.6vw, 22px); line-height: 1.55;
  color: var(--text-on-dark-readable); margin: 0 0 var(--s-8);
  max-width: 720px;
}
.le-hero-cta-wrap {
  position: relative;
  display: inline-flex; align-items: center; gap: var(--s-6);
}

/* Aperture SVG */
.le-aperture {
  width: var(--aperture-svg-size, var(--le-fallback-aperture-size));
  height: var(--aperture-svg-size, var(--le-fallback-aperture-size));
  color: var(--gold);
  animation: le-aperture-rotate var(--aperture-rotation-duration, var(--le-fallback-aperture-rotation)) linear infinite;
}
@keyframes le-aperture-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Buttons */
.le-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: var(--touch-target-min); min-width: 200px;
  padding: 0 var(--s-6);
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase;
  text-decoration: none; cursor: pointer; border: 1px solid var(--gold);
  transition: background var(--t-quick) var(--ease), color var(--t-quick) var(--ease);
}
.le-btn-primary {
  background: var(--gold); color: var(--ink-1);
}
.le-btn-primary:hover { background: var(--gold-hover, #ceae64); }
.le-btn-primary:focus-visible {
  outline: var(--focus-ring-on-gold); outline-offset: var(--focus-ring-offset);
}
.le-btn-ghost {
  background: transparent; color: var(--gold);
}
.le-btn-ghost:hover { background: var(--gold-soft, rgba(201,165,78,0.18)); }
.le-btn-ghost:focus-visible {
  outline: var(--focus-ring-on-dark); outline-offset: var(--focus-ring-offset);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .le-hero-h1 .le-word { opacity: 1; transform: none; animation: none; }
  .le-aperture { animation: none; transform: none; }
}

/* Visually-hidden helper */
.visually-hidden, .sr-only {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0,0,0,0); border: 0; white-space: nowrap;
}
```

### JS (inline `<script>` at end of sec1)

```js
// Services dropdown
document.querySelectorAll('.le-has-dropdown > button').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    document.getElementById(btn.getAttribute('aria-controls')).hidden = expanded;
  });
});
```

### A11y rules (sec1-specific)
- One `<h1>` only (in the hero `<section>`). Masthead title "Editorial." is `<p>`.
- `<em class="le-hero-h1__italic">` for "Mexico" — semantic emphasis, not `<i>`.
- Each word in `<span class="le-word">`; do NOT add `aria-hidden="true"` to word spans.
- Aperture SVG: `aria-hidden="true"`, `focusable="false"`, no `<title>` or `<desc>` children.
- Skip link: real `<a href="#main-content">`, `<main id="main-content" tabindex="-1">`.
- Lang switcher: `role="group" aria-label="Language switcher"`, `aria-current="true"` on active, `|` separator `aria-hidden`.
- Services dropdown button: `aria-expanded`, `aria-controls`, panel uses `hidden` attribute.
- Editorial nav item has `aria-current="page"`.

### Visibility-safe contract
sec1 renders independently if sec2-sec8 fail. The `</main>` and `</body>` tags do NOT close in sec1 (they close in sec8); the stitch agent concatenates sec1...sec8 in order.

### Microcopy (locked from copy deck §2 + §3)
- Eyebrow: `Editorial Photography · Mexico`
- H1 (textContent): `Luxury Editorial Photographer Mexico`
- Subhead: `Brand campaigns, magazine commissions, hotel rebrands, and lookbooks. Shot across Cancun, the Riviera Maya, and Los Cabos.`
- CTA: `Begin Brief`
- Masthead: `IVAE Studios` / `Editorial.` / `Issue No 3 · Vol II · 2026`

---

## Sec2 — Manifesto sticky-stage (3 pillars: Story / Light / Restraint, magazine-grade typography)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec2.html`

### Section name
Manifesto (sticky-stage, three rotating image plates, drop cap on first paragraph, single Spanish phrase, sign-off)

### HTML skeleton

```html
<section class="le-manifesto-stage le-section le-section--manifesto" aria-labelledby="le-manifesto-heading">
  <div class="le-manifesto-plates" aria-hidden="true">
    <img class="le-manifesto-plate le-manifesto-plate--1" src="/images/editorial/manifesto-plate-1.avif" alt="" loading="lazy" width="600" height="750">
    <img class="le-manifesto-plate le-manifesto-plate--2" src="/images/editorial/manifesto-plate-2.avif" alt="" loading="lazy" width="600" height="750">
    <img class="le-manifesto-plate le-manifesto-plate--3" src="/images/editorial/manifesto-plate-3.avif" alt="" loading="lazy" width="600" height="750">
  </div>
  <div class="le-manifesto-text">
    <p class="le-eyebrow">Manifesto.</p>
    <h2 id="le-manifesto-heading" class="le-manifesto-h2">Three commitments <em>the studio keeps</em>.</h2>
    <div class="le-manifesto-body">
      <p>The studio shoots for the editorial register. That register has three commitments, and the work is judged by them. <em>Story</em> is first. The studio asks what the brief is about before it asks what the brief looks like. A shoot is not a list of frames; it is a sequence of decisions made before the call sheet, defended against the call sheet, and recovered when the call sheet breaks. The studio refuses briefs it cannot honor. It accepts the briefs it can.</p>
      <p><em>Light</em> is the second commitment. The studio plans to the hour, scouts the building, and walks the property a day early. The studio knows which terrace turns honey at six eighteen in March and which suite holds north light through one in the afternoon. The shot list is built around the light, not the schedule. <em>Bilingüe en cada conversación.</em> The conversation that produces the light plan happens in English and in Spanish, in the same room, with the same studio.</p>
      <p><em>Restraint</em> is the third. The studio works small. One photographer. One assistant. One producer. A stylist when the brief requires it, a DP when motion is added. The crew does not exceed the work. The studio does not arrive with a fashion-week posse for a sun-care lookbook. The studio arrives with the unit the brief earned, and not one body more.</p>
    </div>
    <cite class="le-signoff">Vianey Diaz / Director</cite>
  </div>
</section>
```

### CSS

```css
.le-manifesto-stage {
  position: relative;
  min-height: 300vh;
  background: var(--ink-3);
  padding: var(--s-12) 0;
}
.le-manifesto-plates { position: absolute; inset: 0; z-index: 1; }
.le-manifesto-plate {
  position: absolute; width: 28%; max-width: 380px;
  opacity: 0; filter: brightness(0.55);
  transition: opacity var(--t-cinema) var(--ease-cinema);
}
.le-manifesto-plate--1 { top: 8%; left: 6%; }
.le-manifesto-plate--2 { top: 40%; right: 8%; }
.le-manifesto-plate--3 { bottom: 12%; left: 14%; }
.le-manifesto-plate.is-revealed { opacity: 1; }

.le-manifesto-text {
  position: sticky; top: 50%; transform: translateY(-50%);
  max-width: 540px; margin: 0 auto;
  padding: var(--s-8) var(--s-gutter);
  z-index: 2;
}
.le-manifesto-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(36px, 4vw, 56px); line-height: 1.12;
  color: var(--cream-1); margin: var(--s-3) 0 var(--s-6);
}
.le-manifesto-h2 em { font-style: italic; color: var(--gold); }
.le-manifesto-body p {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-21); line-height: 1.7;
  color: var(--text-on-dark-readable); margin: 0 0 var(--s-6);
}
.le-manifesto-body p:first-of-type::first-letter {
  font-family: var(--font-serif); font-style: italic;
  font-size: var(--editorial-dropcap-fs, clamp(72px, 8vw, 110px));
  font-weight: 400; color: var(--gold);
  float: left; padding: 0 var(--s-4) 0 0; line-height: 0.9;
}
.le-manifesto-body em { font-style: italic; color: var(--cream-1); font-weight: 400; }
.le-signoff {
  display: block;
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500;
  letter-spacing: var(--couple-name-tracking, 0.18em); text-transform: uppercase;
  color: var(--gold); margin-top: var(--s-8); font-style: normal;
}

@media (prefers-reduced-motion: reduce) {
  .le-manifesto-stage { min-height: auto; }
  .le-manifesto-text { position: static; transform: none; }
  .le-manifesto-plate { display: none; }
}

@media (max-width: 768px) {
  .le-manifesto-stage { min-height: auto; padding: var(--s-12) 0; }
  .le-manifesto-text { position: static; transform: none; }
  .le-manifesto-plate { width: 60%; opacity: 0.4; }
}
```

### JS (IntersectionObserver for plate reveals)

```js
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const plates = document.querySelectorAll('.le-manifesto-plate');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-revealed');
    });
  }, { threshold: 0.2 });
  plates.forEach(plate => observer.observe(plate));
})();
```

### A11y rules
- `<section aria-labelledby="le-manifesto-heading">`.
- Image plates wrapped in `<div aria-hidden="true">`; each `<img alt="">`.
- Drop cap via `::first-letter` only — no `<span>` wrap on the T.
- Single Spanish phrase: *Bilingüe en cada conversación.* (italics, no quote marks, no English gloss). The next sentence provides English context separately.
- Sign-off in `<cite>`, slash separator.
- Sticky-stage fallback: `prefers-reduced-motion: reduce` collapses to natural layout; mobile (<= 768px) also collapses.

### Microcopy (locked from copy deck §4)
Full 256-word manifesto verbatim from copy deck Section 4. Sign-off: `Vianey Diaz / Director`.

---

## Sec3 — Featured editorial cinemascope case study (21:9 with letterbox bands, drop cap caption)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec3.html`

### Section name
A Feature — Casa Ranfla, Spring Edit 2026 (cinemascope 21:9 image, 6% letterbox bands, three-cell caption deck, drop cap on case study lede)

### HTML skeleton

```html
<section class="le-section le-section--feature le-cinemascope-feature" aria-labelledby="le-feature-heading">
  <p class="le-eyebrow le-feature-eyebrow">A Feature.</p>
  <h2 id="le-feature-heading" class="le-feature-h2">Casa Ranfla, <em>Spring Edit 2026</em>.</h2>

  <figure class="le-cinemascope">
    <div class="le-cinemascope-frame">
      <img
        src="/images/editorial/casa-ranfla-cinemascope.avif"
        alt="A linen lookbook model, mid-frame, on the east terrace of Casa Ranfla at first light, framed in 21:9 cinemascope by IVAE Studios."
        width="2400" height="1029"
        loading="lazy" decoding="async">
    </div>
    <figcaption class="le-cinemascope-caption">
      <div class="le-caption-deck" role="group" aria-label="Feature metadata">
        <p class="le-caption-cell"><span class="le-caption-label">Brand</span><span class="le-caption-value">Casa Ranfla</span></p>
        <p class="le-caption-cell"><span class="le-caption-label">Issue</span><span class="le-caption-value">Spring Edit 2026</span></p>
        <p class="le-caption-cell"><span class="le-caption-label">Location</span><span class="le-caption-value">Tulum, Quintana Roo</span></p>
      </div>
      <div class="le-caption-body le-case-study-body">
        <p>Casa Ranfla commissioned the studio for a two-day spring edit on the Tulum coast. The brief was four-fold. One linen lookbook, shot on three models, on the property's east terrace at first light. One interiors set, shot in the shaded courtyard between eleven and one. One golden-hour campaign-key, with the property's Mezcal bar set as the backdrop. One short motion clip, fifteen seconds, for the brand's launch loop on Instagram and on the brand's homepage. The brief was the studio's brief. The studio agreed to it as written.</p>
        <p>Day one began at five fifty-two. The lookbook was on its first frame at six oh four. The east terrace turns honey at six eighteen in late April; the studio scheduled the wide-angle close-ups for that window, and the tighter detail crops for the soft-shoulder light at six forty. The model's linen caftan caught the breeze on frame nineteen. That frame became the campaign key.</p>
        <p>The interior set was shot in a single one-hour pass between eleven thirty and twelve thirty. The studio used one camera, one prime, no flash, and a single bounce panel held by the assistant against the courtyard's south wall. The brand's creative director was on set for the interior pass and approved the take in real time. The day broke for two hours at one and resumed at three forty for the bar set.</p>
        <p>The motion clip was shot last, at six forty-five, on a single dolly run, in one take, with a focus pull halfway. The studio delivered selects on day six. Full delivery on day twelve. Casa Ranfla shipped the campaign on day fifteen.</p>
      </div>
    </figcaption>
  </figure>
</section>
```

### CSS

```css
.le-cinemascope-feature {
  background: var(--ink-3);
  padding: var(--s-16) 0;
}
.le-feature-eyebrow, .le-feature-h2 { max-width: 1200px; margin: 0 auto; padding: 0 var(--s-gutter); }
.le-feature-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(36px, 4vw, 56px); line-height: 1.12;
  color: var(--cream-1); margin: var(--s-3) auto var(--s-12);
}
.le-feature-h2 em { font-style: italic; color: var(--gold); }

.le-cinemascope { margin: 0 auto; max-width: 1400px; padding: 0 var(--s-gutter); }
.le-cinemascope-frame {
  position: relative;
  aspect-ratio: 21 / 9;
  overflow: hidden;
  border-top: 1px solid var(--gold-line);
  border-bottom: 1px solid var(--gold-line);
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
}
.le-cinemascope-frame::before,
.le-cinemascope-frame::after {
  content: ""; position: absolute; left: 0; right: 0;
  height: var(--cinemascope-letterbox, 6%);
  background: var(--ink-1);
  z-index: 2;
}
.le-cinemascope-frame::before { top: 0; }
.le-cinemascope-frame::after  { bottom: 0; }
.le-cinemascope-frame img {
  width: 100%; height: 100%; object-fit: cover;
}
.le-cinemascope-caption {
  margin-top: var(--s-8);
  max-width: var(--case-study-caption-max-width, 720px);
  padding: 0 var(--s-gutter);
}
.le-caption-deck {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--gold-line);
  border-bottom: 1px solid var(--gold-line);
  margin-bottom: var(--s-8);
}
.le-caption-cell {
  padding: var(--s-3) var(--s-4); margin: 0;
  border-right: 1px solid var(--gold-line);
}
.le-caption-cell:last-child { border-right: 0; }
.le-caption-label {
  display: block;
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold);
}
.le-caption-value {
  display: block;
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 400;
  color: var(--text-on-dark-readable);
}
.le-case-study-body p {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-21); line-height: 1.55;
  color: var(--text-on-dark-readable); margin: 0 0 var(--s-5);
}
.le-case-study-body p:first-of-type::first-letter {
  font-family: var(--font-serif); font-style: italic;
  font-size: clamp(56px, 6.4vw, 80px); font-weight: 400;
  color: var(--gold);
  float: left; padding: 0 var(--s-3) 0 0; line-height: 0.9;
}

@media (max-width: 768px) {
  .le-caption-deck { grid-template-columns: 1fr; }
  .le-caption-cell { border-right: 0; border-bottom: 1px solid var(--gold-line); }
  .le-caption-cell:last-child { border-bottom: 0; }
}
```

### A11y rules
- Caption text sits BELOW the image, never overlaid on the letterbox bands.
- Caption labels in `--gold` at `--fs-10` weight 600 — passes 7.4:1 on `--ink-3`.
- Caption deck wrapped in `<div role="group" aria-label="Feature metadata">`.
- Drop cap on case study lede via `::first-letter`; no `<span>` wrap.
- Image alt follows editorial pattern: `[subject + setting] at [light condition] [in/at] [location], framed in 21:9 cinemascope by IVAE Studios.`

### Microcopy (locked from copy deck §5)
Full 374-word case study verbatim. Three caption cells: BRAND / Casa Ranfla, ISSUE / Spring Edit 2026, LOCATION / Tulum, Quintana Roo.

---

## Sec4 — "Featured In" press band (6-9 logos at 0.55 opacity, hover/focus restores to 1.0)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec4.html`

### Section name
As Seen In (edge-to-edge logo band, 0.55 default opacity, hover and focus restoration, prefers-contrast: more fallback)

### HTML skeleton

```html
<section class="le-section le-section--press le-press-band" aria-labelledby="le-press-heading">
  <h2 id="le-press-heading" class="visually-hidden">As Seen In</h2>
  <p class="le-press-eyebrow" aria-hidden="false">As Seen In</p>
  <ul class="le-press-list" role="list">
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Conde Nast Traveler (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-1-placeholder.svg" alt="Conde Nast Traveler logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Travel and Leisure (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-2-placeholder.svg" alt="Travel and Leisure logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Vogue Mexico (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-3-placeholder.svg" alt="Vogue Mexico logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Architectural Digest (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-4-placeholder.svg" alt="Architectural Digest logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Domino (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-5-placeholder.svg" alt="Domino logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
    <li class="le-press-item">
      <a class="le-press-link" href="#" aria-label="Featured in Tatler (placeholder)" tabindex="0">
        <img class="le-press-logo" src="/images/press/logo-6-placeholder.svg" alt="Tatler logo (placeholder)" width="180" height="28" loading="lazy">
      </a>
    </li>
  </ul>
</section>
```

### CSS

```css
.le-press-band {
  background: var(--ink-3);
  border-top: 1px solid var(--gold-line);
  border-bottom: 1px solid var(--gold-line);
  padding: var(--s-10) var(--s-gutter);
  text-align: center;
}
.le-press-eyebrow {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 600;
  letter-spacing: 0.32em; text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-8);
}
.le-press-list {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: var(--press-band-gap, clamp(40px, 5vw, 80px));
  list-style: none; margin: 0; padding: 0;
}
.le-press-item { display: flex; align-items: center; }
.le-press-link {
  display: inline-flex; align-items: center;
  padding: var(--s-2);
  text-decoration: none;
}
.le-press-logo {
  height: var(--press-band-logo-h, clamp(18px, 2.4vw, 28px));
  width: auto; max-width: 180px;
  opacity: var(--press-band-logo-opacity, 0.55);
  filter: grayscale(100%) brightness(2);
  transition: opacity var(--t-quick) var(--ease), filter var(--t-quick) var(--ease);
}
.le-press-link:hover .le-press-logo,
.le-press-link:focus .le-press-logo,
.le-press-link:focus-visible .le-press-logo {
  opacity: var(--press-band-logo-opacity-hover, 1);
  filter: grayscale(0%) brightness(1);
}
.le-press-link:focus-visible {
  outline: var(--focus-ring-on-dark); outline-offset: 6px;
}

@media (prefers-contrast: more) {
  .le-press-logo {
    opacity: 1; filter: grayscale(0%) brightness(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .le-press-logo { transition: none; }
}
```

### A11y rules
- Visually-hidden `<h2>` for SR + visible `<p class="le-press-eyebrow">` for sighted users.
- Each `<a>` has descriptive `aria-label`: "Featured in [Publication] (placeholder)".
- Each `<img alt="[Publication] logo (placeholder)">` — never empty alt.
- Focus restores opacity AND grayscale (compensates for 0.55 default).
- `prefers-contrast: more` fallback: full opacity always.

### Microcopy (locked from copy deck §12)
Eyebrow: `As Seen In`. Six placeholder logos with publication names in alt text and aria-label.

---

## Sec5 — Pillars (Concept / Production / Output) + Brackets (Investment, 3 brackets)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec5.html`

### Section name
The Practice (3 pillars, edge-to-edge hairlines) + Investment (3 brackets, FROM $X,XXX USD, featured tier II with 2px gold top rule)

### HTML skeleton

```html
<section class="le-section le-section--pillars" aria-labelledby="le-pillars-heading">
  <h2 id="le-pillars-heading" class="visually-hidden">The Practice</h2>
  <div class="le-pillars-grid">
    <article class="le-pillar">
      <p class="le-pillar-eyebrow">01 / Discipline</p>
      <h3 class="le-pillar-name"><em>Concept.</em></h3>
      <p class="le-pillar-body">Every brief begins with a single conversation. The studio asks four questions: what the brand is selling, who it is selling to, where it will run, and which two reference frames already live in the creative director's screensaver. The shoot is built backward from the answer. The frames follow.</p>
    </article>
    <article class="le-pillar">
      <p class="le-pillar-eyebrow">02 / Discipline</p>
      <h3 class="le-pillar-name"><em>Production.</em></h3>
      <p class="le-pillar-body">The studio handles permits, location releases, talent scouting, fixers, and travel. Insurance is in-house. The studio works with a roster of three location producers across Cancun, the Riviera Maya, and Los Cabos. A bilingual call sheet is delivered seventy-two hours before the shoot. The producer on the day is the producer on the brief.</p>
    </article>
    <article class="le-pillar">
      <p class="le-pillar-eyebrow">03 / Discipline</p>
      <h3 class="le-pillar-name"><em>Output.</em></h3>
      <p class="le-pillar-body">Selects ship in five to ten business days. Full delivery in fifteen to twenty. The studio retouches in the IVAE color register, by hand, never run through a preset. Files are organized by camera, then by set, then by frame. Print, web, social, and archive licensing are quoted alongside the brief.</p>
    </article>
  </div>
</section>

<section class="le-section le-section--brackets" id="brackets" aria-labelledby="le-brackets-heading">
  <p class="le-eyebrow le-brackets-eyebrow">Investment.</p>
  <h2 id="le-brackets-heading" class="le-brackets-h2">Three brackets, one <em>register</em>.</h2>
  <p class="le-brackets-intro">Editorial commissions are quoted to the brief, not to a price list. The studio publishes three brackets so a brand manager can place the studio inside a budget within sixty seconds of arriving on the page. Every commission begins with the same conversation, the same crew composition, and the same delivery standard. What changes is the length of the production and the licensing.</p>

  <div class="le-brackets-grid">
    <article class="le-bracket-card">
      <p class="le-bracket-roman" aria-hidden="true">I</p>
      <h3 class="le-bracket-name"><em>The Editorial Day</em></h3>
      <p class="le-bracket-lede"><em>A one-day shoot, kept tight.</em></p>
      <p class="le-bracket-investment-label">Investment from</p>
      <p class="le-bracket-price">From $4,500 USD</p>
      <ul class="le-bracket-bullets">
        <li>One-day editorial shoot. Up to eight hours on location.</li>
        <li>One photographer + one assistant + on-set producer.</li>
        <li>Cancun / Riviera Maya / Los Cabos travel included.</li>
        <li>Sixty to one hundred selects, in five to ten business days.</li>
        <li>Print + web licensing, one round of color refinement.</li>
      </ul>
      <p class="le-bracket-usecase"><em>Small DTC lookbook. Restaurant launch. Single-day suite shoot. Magazine assignment.</em></p>
      <a class="le-btn le-btn-ghost le-bracket-cta" href="#inquiry" aria-label="Begin brief for The Editorial Day bracket">Begin Brief</a>
    </article>

    <article class="le-bracket-card is-featured">
      <p class="le-bracket-roman" aria-hidden="true">II</p>
      <h3 class="le-bracket-name"><em>The Campaign</em></h3>
      <p class="le-bracket-lede"><em>A two-day production, the full crew.</em></p>
      <p class="le-bracket-investment-label">Investment from</p>
      <p class="le-bracket-price">From $9,500 USD</p>
      <ul class="le-bracket-bullets">
        <li>Two-day editorial production. Up to sixteen working hours.</li>
        <li>One photographer + one assistant + one producer + stylist coordination.</li>
        <li>One hundred fifty to three hundred selects, in ten to fifteen business days.</li>
        <li>Print + web + social + twelve-month archive licensing.</li>
        <li>Insurance and permits handled in-house. Two rounds of color.</li>
      </ul>
      <p class="le-bracket-usecase"><em>Brand campaign. Hotel seasonal refresh. Multi-room property shoot.</em></p>
      <a class="le-btn le-btn-primary le-bracket-cta" href="#inquiry" aria-label="Begin brief for The Campaign bracket">Begin Brief</a>
    </article>

    <article class="le-bracket-card">
      <p class="le-bracket-roman" aria-hidden="true">III</p>
      <h3 class="le-bracket-name"><em>The Multi-Day Production</em></h3>
      <p class="le-bracket-lede"><em>Three or more days, photo and motion.</em></p>
      <p class="le-bracket-investment-label">Investment from</p>
      <p class="le-bracket-price">From $18,000 USD</p>
      <ul class="le-bracket-bullets">
        <li>Three-plus day editorial production. Multi-set, multi-location capacity.</li>
        <li>Full crew: photographer + assistant + producer + DP for motion + grip.</li>
        <li>Stills + one to three motion clips. Three hundred-plus selects in fifteen to twenty business days.</li>
        <li>Three rounds of color. Full licensing including extended archive use.</li>
        <li>Talent + location scouting + fixers + travel logistics included.</li>
      </ul>
      <p class="le-bracket-usecase"><em>Annual hotel rebrand. Magazine cover feature. Fashion campaign with motion deliverable.</em></p>
      <a class="le-btn le-btn-ghost le-bracket-cta" href="#inquiry" aria-label="Begin brief for The Multi-Day Production bracket">Begin Brief</a>
    </article>
  </div>

  <p class="le-brackets-footnote"><em>Every commission is quoted to the brief. Travel beyond Mexico is quoted separately.</em></p>
</section>
```

### CSS

```css
/* Pillars */
.le-section--pillars {
  background: var(--ink-3);
  padding: var(--s-16) 0;
  border-top: 1px solid var(--gold-line);
  border-bottom: 1px solid var(--gold-line);
}
.le-pillars-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  max-width: 1300px; margin: 0 auto;
}
.le-pillar {
  padding: var(--s-8) var(--s-6);
  border-right: 1px solid var(--gold-line);
}
.le-pillar:last-child { border-right: 0; }
.le-pillar-eyebrow {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-3);
}
.le-pillar-name {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(28px, 3vw, 40px); line-height: 1.15;
  color: var(--cream-1); margin: 0 0 var(--s-5);
}
.le-pillar-name em { font-style: italic; }
.le-pillar-name::first-letter { color: var(--gold); }
.le-pillar-body {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.7;
  color: var(--text-on-dark-readable); margin: 0;
}

@media (max-width: 900px) {
  .le-pillars-grid { grid-template-columns: 1fr 1fr; }
  .le-pillar:nth-child(2) { border-right: 0; }
  .le-pillar:nth-child(odd) { border-bottom: 1px solid var(--gold-line); }
}
@media (max-width: 600px) {
  .le-pillars-grid { grid-template-columns: 1fr; }
  .le-pillar { border-right: 0; border-bottom: 1px solid var(--gold-line); }
  .le-pillar:last-child { border-bottom: 0; }
}

/* Brackets */
.le-section--brackets {
  background: var(--ink-2);
  padding: var(--s-16) var(--s-gutter);
}
.le-brackets-eyebrow, .le-brackets-h2, .le-brackets-intro {
  max-width: 720px; margin-left: auto; margin-right: auto;
}
.le-brackets-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(36px, 4vw, 56px); line-height: 1.12;
  color: var(--cream-1); margin: var(--s-3) auto var(--s-4);
  text-align: center;
}
.le-brackets-h2 em { font-style: italic; color: var(--gold); }
.le-brackets-intro {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.85;
  color: var(--text-on-dark-readable);
  text-align: center; margin-bottom: var(--s-12);
}
.le-brackets-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: var(--inv-tier-gap, clamp(24px, 3vw, 48px));
  max-width: 1400px; margin: 0 auto;
}
.le-bracket-card {
  padding: var(--vow-card-padding, var(--s-8));
  border-top: var(--inv-tier-rule, 1px solid var(--gold-line));
  background: transparent;
  display: flex; flex-direction: column;
}
.le-bracket-card.is-featured {
  border-top: var(--inv-tier-rule-featured, 2px solid var(--gold));
}
.le-bracket-roman {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-tight); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-3);
}
.le-bracket-name {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(24px, 2.6vw, 32px); line-height: 1.15;
  color: var(--cream-1); margin: 0 0 var(--s-2);
}
.le-bracket-name em { font-style: italic; }
.le-bracket-lede {
  font-family: var(--font-serif); font-size: var(--fs-15); font-weight: 300;
  color: var(--text-on-dark-readable); margin: 0 0 var(--s-6);
}
.le-bracket-investment-label {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-1);
}
.le-bracket-price {
  font-family: var(--font-serif); font-size: var(--fs-24); font-weight: 300;
  color: var(--cream-1); margin: 0 0 var(--s-6);
}
.le-bracket-bullets {
  list-style: none; margin: 0 0 var(--s-6); padding: 0;
}
.le-bracket-bullets li {
  position: relative; padding-left: var(--s-5); padding-block: var(--s-2);
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 400;
  color: var(--text-on-dark-readable); line-height: 1.55;
  border-bottom: 1px solid var(--gold-line);
}
.le-bracket-bullets li:last-child { border-bottom: 0; }
.le-bracket-bullets li::before {
  content: ""; position: absolute; left: 0; top: var(--s-3);
  width: var(--s-3); height: 1px; background: var(--gold);
}
.le-bracket-usecase {
  font-family: var(--font-serif); font-size: var(--fs-13); font-weight: 300;
  color: var(--text-on-dark-readable); opacity: 0.85;
  margin: 0 0 var(--s-6);
}
.le-bracket-cta { margin-top: auto; align-self: flex-start; }
.le-brackets-footnote {
  text-align: center;
  font-family: var(--font-serif); font-size: var(--fs-13); font-weight: 300;
  color: var(--text-on-dark-readable); margin: var(--s-12) auto 0;
  max-width: 720px;
}

@media (max-width: 900px) {
  .le-brackets-grid { grid-template-columns: 1fr; }
}
```

### A11y rules
- 3 brackets each have a CTA with differentiated `aria-label`: "Begin brief for The Editorial Day bracket" / "...The Campaign bracket" / "...The Multi-Day Production bracket".
- Featured tier II: `--focus-ring-on-gold` on the CTA (gold bg, ink ring) per a11y contract failure mode 11.
- Pillars use `<article>` cards inside `<section>`. Section has visually-hidden h2.
- `::first-letter` on pillar names colors the C / P / O subtly gold per Phase 1 §8 feature 6.

### Microcopy (locked from copy deck §6 + §7)
3 pillars verbatim. 3 brackets with prices, lede, bullets (5 each), use case, CTA "Begin Brief".

---

## Sec6 — Method (4 steps timeline: Concept / Casting / Shoot / Edit)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec6.html`

### Section name
The Method (vertical hairline rail, alternating left/right of rail, IntersectionObserver node-grow on scroll)

### HTML skeleton

```html
<section class="le-section le-section--method" aria-labelledby="le-method-heading">
  <p class="le-eyebrow le-method-eyebrow">The Method.</p>
  <h2 id="le-method-heading" class="le-method-h2">Four considered <em>steps</em>, brief to delivery.</h2>
  <p class="le-method-intro">The studio works the same way for every commission, regardless of scale. The first email is read the same business day, in English or in Spanish. A discovery call follows within forty-eight hours. The studio walks the property a day early. The shoot itself is paced to the light, not the schedule. Selects ship in five to ten business days. The full delivery in fifteen to twenty. Nothing is improvised that could have been agreed beforehand.</p>

  <ol class="le-method-rail" role="list">
    <li class="le-method-step le-method-step--left">
      <span class="le-method-node" aria-hidden="true"></span>
      <p class="le-method-step-eyebrow">01 &middot; Concept</p>
      <h3 class="le-method-step-name"><em>Concept.</em></h3>
      <p class="le-method-step-time">3 to 5 days</p>
      <p class="le-method-step-body">The studio reads the brief, reads it again, and writes back with two paragraphs and four references. One of those references will be from the brand's own back catalogue. One will not. The conversation is forty-five minutes on a video call. By the end, the brief has either tightened or it has changed.</p>
    </li>
    <li class="le-method-step le-method-step--right">
      <span class="le-method-node" aria-hidden="true"></span>
      <p class="le-method-step-eyebrow">02 &middot; Casting</p>
      <h3 class="le-method-step-name"><em>Casting.</em></h3>
      <p class="le-method-step-time">1 to 2 weeks</p>
      <p class="le-method-step-body">The studio works with two casting directors, one in Mexico City and one in Tulum, and a roster of forty-plus local talent across Cancun, the Riviera Maya, and Los Cabos. Locations are scouted in person. Permits are handled in-house. The brand reviews three options for each role and approves before the call sheet ships.</p>
    </li>
    <li class="le-method-step le-method-step--left">
      <span class="le-method-node" aria-hidden="true"></span>
      <p class="le-method-step-eyebrow">03 &middot; Shoot</p>
      <h3 class="le-method-step-name"><em>Shoot.</em></h3>
      <p class="le-method-step-time">1 to 3 days</p>
      <p class="le-method-step-body">The studio arrives a day early. The crew is bilingual. The call sheet is bilingual. The day is paced to the light. The brand's creative director is welcome on set; if remote, a live frame-share runs from camera one to a private link. Lunch is hot, not catered cold. The shoot stays small.</p>
    </li>
    <li class="le-method-step le-method-step--right">
      <span class="le-method-node" aria-hidden="true"></span>
      <p class="le-method-step-eyebrow">04 &middot; Edit</p>
      <h3 class="le-method-step-name"><em>Edit.</em></h3>
      <p class="le-method-step-time">5 to 10 days for selects</p>
      <p class="le-method-step-body">Selects are color-graded by hand in the IVAE register. The brand reviews on a private Frame.io link. One round of revision is included; two rounds in The Campaign; three in The Multi-Day Production. Final files are delivered as a structured archive: by camera, by set, by frame. The cinematic motion clip ships with the final edit.</p>
    </li>
  </ol>
</section>
```

### CSS

```css
.le-section--method {
  background: var(--ink-3);
  padding: var(--s-16) var(--s-gutter);
}
.le-method-eyebrow, .le-method-h2, .le-method-intro {
  text-align: center; max-width: 720px; margin-left: auto; margin-right: auto;
}
.le-method-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(36px, 4vw, 56px); line-height: 1.12;
  color: var(--cream-1); margin: var(--s-3) auto var(--s-4);
}
.le-method-h2 em { font-style: italic; color: var(--gold); }
.le-method-intro {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.85;
  color: var(--text-on-dark-readable); margin-bottom: var(--s-16);
}
.le-method-rail {
  position: relative; max-width: 1100px; margin: 0 auto;
  list-style: none; padding: 0;
}
.le-method-rail::before {
  content: ""; position: absolute; left: 50%; top: 0; bottom: 0;
  width: var(--editorial-process-rail-w, 1px);
  background: var(--gold-line);
  transform: translateX(-50%);
}
.le-method-step {
  position: relative;
  width: calc(50% - var(--s-8));
  padding: var(--s-6) 0;
  margin-bottom: var(--editorial-process-step-gap, clamp(60px, 8vh, 120px));
}
.le-method-step--left { margin-right: auto; padding-right: var(--s-8); text-align: right; }
.le-method-step--right { margin-left: auto; padding-left: var(--s-8); text-align: left; }
.le-method-node {
  position: absolute; top: var(--s-7);
  width: 14px; height: 14px;
  border: 1px solid var(--gold); border-radius: 50%;
  background: var(--ink-3);
  transition: width var(--t-medium), height var(--t-medium), background var(--t-medium);
}
.le-method-step--left .le-method-node { right: calc(-1 * (var(--s-8) + 7px)); }
.le-method-step--right .le-method-node { left: calc(-1 * (var(--s-8) + 7px)); }
.le-method-step.is-active .le-method-node {
  width: 18px; height: 18px; background: var(--gold);
}
.le-method-step-eyebrow {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-2);
}
.le-method-step-name {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(28px, 3vw, 40px); color: var(--cream-1);
  margin: 0 0 var(--s-2);
}
.le-method-step-name em { font-style: italic; }
.le-method-step-time {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500;
  letter-spacing: var(--couple-name-tracking, 0.18em); text-transform: uppercase;
  color: var(--gold-deep); margin: 0 0 var(--s-4);
}
.le-method-step-body {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.7;
  color: var(--text-on-dark-readable); margin: 0;
}

@media (max-width: 768px) {
  .le-method-rail::before { left: var(--s-4); }
  .le-method-step,
  .le-method-step--left,
  .le-method-step--right {
    width: 100%; padding-left: var(--s-12); padding-right: 0;
    text-align: left; margin-left: 0; margin-right: 0;
  }
  .le-method-step--left .le-method-node,
  .le-method-step--right .le-method-node { left: calc(var(--s-4) - 7px); right: auto; }
}
```

### JS

```js
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const steps = document.querySelectorAll('.le-method-step');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-active');
    });
  }, { threshold: 0.4 });
  steps.forEach(step => observer.observe(step));
})();
```

### A11y rules
- `<ol>` for the steps (ordered list semantics).
- Each step uses `<h3>` for the step name; eyebrow above and time-estimate below are `<p>`.
- Node circles `aria-hidden="true"` (decorative).
- Mobile collapses to single-column with rail at left edge.

### Microcopy (locked from copy deck §8)
4 steps verbatim with names, time estimates, and bodies.

---

## Sec7 — Drag-scroll editorial portfolio (The Reel — largest on the site, 280-460px cards, hover preview)

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec7.html`

### Section name
The Reel (drag-scroll horizontal, 12-18 cards in 4:5 portrait at clamp 280-460px, image-as-card with hover scrim + cursor-follow preview, prev/next keyboard buttons)

### HTML skeleton

```html
<section class="le-section le-section--reel le-reel-section" aria-labelledby="le-reel-heading">
  <h2 id="le-reel-heading" class="visually-hidden">The Reel</h2>
  <p class="le-eyebrow le-reel-eyebrow">The Reel.</p>

  <div class="le-reel-track" role="region" aria-label="Editorial portfolio, scrollable" tabindex="0">

    <figure class="le-reel-card">
      <a class="le-reel-card-link" href="#" aria-label="Casa Ranfla, Spring Edit 2026">
        <img src="/images/editorial/reel-01.avif" alt="A model in linen on the east terrace of Casa Ranfla, Tulum, at first light, photographed by IVAE Studios." width="560" height="700" loading="lazy">
        <div class="le-reel-card-overlay">
          <span class="le-reel-card-brand">Casa Ranfla</span>
          <span class="le-reel-card-title"><em>Spring Edit, 2026</em></span>
        </div>
      </a>
    </figure>

    <figure class="le-reel-card">
      <a class="le-reel-card-link" href="#" aria-label="Rosewood Mayakoba, Spring Suites 2026">
        <img src="/images/editorial/reel-02.avif" alt="A suite interior at Rosewood Mayakoba in north light, photographed by IVAE Studios." width="560" height="700" loading="lazy">
        <div class="le-reel-card-overlay">
          <span class="le-reel-card-brand">Rosewood Mayakoba</span>
          <span class="le-reel-card-title"><em>Spring Suites, 2026</em></span>
        </div>
      </a>
    </figure>

    <!-- 10-16 more cards following the same pattern -->
    <figure class="le-reel-card">
      <a class="le-reel-card-link" href="#" aria-label="Brand Placeholder, Editorial Spring 2026">
        <img src="/images/editorial/reel-03.avif" alt="A lookbook frame on a Tulum beach at golden hour, photographed by IVAE Studios." width="560" height="700" loading="lazy">
        <div class="le-reel-card-overlay">
          <span class="le-reel-card-brand">Brand Placeholder</span>
          <span class="le-reel-card-title"><em>Editorial Spring, 2026</em></span>
        </div>
      </a>
    </figure>

    <!-- repeat to 12-18 cards total -->

  </div>

  <div class="le-reel-controls" role="group" aria-label="Editorial reel navigation">
    <button class="le-reel-btn le-reel-btn--prev" type="button" aria-label="Previous editorial frame">
      <span aria-hidden="true">&larr;</span>
    </button>
    <button class="le-reel-btn le-reel-btn--next" type="button" aria-label="Next editorial frame">
      <span aria-hidden="true">&rarr;</span>
    </button>
  </div>

</section>

<!-- Cursor-follow preview, appended once at end of body — but for sec7 fragment, sit it at end of section -->
<div id="le-cursor-preview" class="le-cursor-preview" aria-hidden="true">
  <img class="le-cursor-preview-img" alt="" />
</div>
```

### CSS

```css
.le-section--reel {
  background: var(--ink-4);
  padding: var(--s-16) 0;
  position: relative;
}
.le-reel-eyebrow {
  text-align: center; max-width: 1200px; margin: 0 auto var(--s-12);
  padding: 0 var(--s-gutter);
}

.le-reel-track {
  display: flex;
  gap: var(--s-5);
  overflow-x: auto;
  padding: var(--s-5) var(--s-gutter);
  cursor: var(--portfolio-drag-cursor, grab);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scroll-behavior: smooth;
}
.le-reel-track:active { cursor: grabbing; }
.le-reel-track:focus-visible {
  outline: var(--focus-ring-on-dark); outline-offset: 4px;
}

@media (hover: none), (pointer: coarse) {
  .le-reel-track {
    scroll-snap-type: x mandatory;
  }
  .le-reel-card { scroll-snap-align: start; }
}

.le-reel-card {
  flex: 0 0 auto;
  width: var(--portfolio-drag-card-min-w, clamp(280px, 40vw, 460px));
  aspect-ratio: var(--portfolio-drag-card-aspect, 4/5);
  margin: 0; position: relative; overflow: hidden;
  background: var(--ink-3);
}
.le-reel-card-link {
  display: block; width: 100%; height: 100%;
  text-decoration: none; color: inherit;
  position: relative;
}
.le-reel-card-link:focus-visible {
  outline: var(--focus-ring-on-dark); outline-offset: 6px;
}
.le-reel-card img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform var(--t-medium) var(--ease), filter var(--t-medium) var(--ease);
}
.le-reel-card-overlay {
  position: absolute; inset: 0;
  background: var(--editorial-card-hover-overlay, rgba(10,15,23,0.55));
  opacity: 0;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: var(--s-5);
  transition: opacity var(--t-medium) var(--ease);
  pointer-events: none;
}
.le-reel-card-link:hover .le-reel-card-overlay,
.le-reel-card-link:focus-visible .le-reel-card-overlay,
.le-reel-card-link:focus .le-reel-card-overlay {
  opacity: 1;
}
.le-reel-card-link:hover img,
.le-reel-card-link:focus-visible img {
  transform: scale(1.045); filter: brightness(0.7);
}
.le-reel-card-brand {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-base); text-transform: uppercase;
  color: var(--editorial-card-overlay-text, var(--cream-1));
}
.le-reel-card-title {
  font-family: var(--font-serif); font-style: italic; font-size: var(--fs-21);
  color: var(--editorial-card-overlay-text, var(--cream-1));
}

.le-reel-controls {
  display: flex; gap: var(--s-3); justify-content: center;
  margin-top: var(--s-6);
}
.le-reel-btn {
  min-width: var(--touch-target-min); min-height: var(--touch-target-min);
  padding: var(--s-3); cursor: pointer;
  background: transparent; border: 1px solid var(--gold-line);
  color: var(--gold);
  font-size: var(--fs-21); line-height: 1;
}
.le-reel-btn:hover { background: rgba(201,165,78,0.15); }
.le-reel-btn:focus-visible { outline: var(--focus-ring-on-dark); outline-offset: var(--focus-ring-offset); }

/* Cursor preview */
.le-cursor-preview {
  display: none;
  position: fixed; pointer-events: none;
  width: var(--cursor-preview-size, 280px);
  z-index: var(--z-tooltip);
  filter: blur(var(--cursor-preview-blur, 12px));
  opacity: 0;
  transition: filter 0.3s var(--ease), opacity 0.2s var(--ease);
}
.le-cursor-preview.is-active { opacity: 1; filter: blur(0); }
.le-cursor-preview-img { width: 100%; height: auto; display: block; }

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .le-cursor-preview { display: block; }
}
@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .le-cursor-preview { display: none !important; }
}

@media (prefers-reduced-motion: reduce) {
  .le-reel-track { scroll-behavior: auto; }
  .le-reel-card-link:hover img,
  .le-reel-card-link:focus-visible img { transform: none; filter: none; }
  .le-reel-card-overlay { transition: none; }
}
```

### JS

```js
(() => {
  const track = document.querySelector('.le-reel-track');
  if (!track) return;

  // Keyboard nav
  track.addEventListener('keydown', (e) => {
    const card = track.querySelector('.le-reel-card');
    if (!card) return;
    const cardWidth = card.getBoundingClientRect().width + 24;
    if (e.key === 'ArrowRight') { track.scrollBy({ left: cardWidth, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { track.scrollBy({ left: -cardWidth, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'Home') { track.scrollTo({ left: 0, behavior: 'smooth' }); }
    else if (e.key === 'End') { track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' }); }
  });

  // Prev/Next buttons
  document.querySelector('.le-reel-btn--prev')?.addEventListener('click', () => {
    const card = track.querySelector('.le-reel-card');
    track.scrollBy({ left: -(card.getBoundingClientRect().width + 24), behavior: 'smooth' });
  });
  document.querySelector('.le-reel-btn--next')?.addEventListener('click', () => {
    const card = track.querySelector('.le-reel-card');
    track.scrollBy({ left: (card.getBoundingClientRect().width + 24), behavior: 'smooth' });
  });

  // Drag-scroll inertia (desktop pointer: fine only)
  if (window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    let isDown = false, startX = 0, scrollLeft = 0;
    track.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
    track.addEventListener('mouseleave', () => { isDown = false; });
    track.addEventListener('mouseup', () => { isDown = false; });
    track.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      track.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
  }

  // Cursor-follow preview
  const preview = document.getElementById('le-cursor-preview');
  const previewImg = preview?.querySelector('img');
  const isHoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isHoverFine && !isReducedMotion && preview && previewImg) {
    document.querySelectorAll('.le-reel-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        const img = card.querySelector('img');
        previewImg.src = img.src;
        preview.classList.add('is-active');
      });
      card.addEventListener('mouseleave', () => {
        preview.classList.remove('is-active');
      });
      card.addEventListener('mousemove', (e) => {
        preview.style.left = `${e.clientX + 24}px`;
        preview.style.top = `${e.clientY + 24}px`;
      });
    });
  }
})();
```

### A11y rules
- `<div role="region" aria-label="Editorial portfolio, scrollable" tabindex="0">` for the track.
- Each `<a>` card link has descriptive `aria-label` ("[Brand], [Title]").
- Each `<img alt>` follows editorial pattern.
- Prev/next buttons `<button type="button" aria-label="...">` with min 44×44px hit area.
- Cursor preview `aria-hidden="true"`, gated by `(hover: hover) and (pointer: fine) and not (prefers-reduced-motion)`.
- Scrim overlay opacity transitions disabled on reduced motion.

### Microcopy
12-18 reel cards. Each: brand name (small caps) + shoot title (italic). Cards 1-3 use real placeholder examples (Casa Ranfla, Rosewood Mayakoba, Brand Placeholder); cards 4-12+ are populated by Phase 4 with real or placeholder content.

---

## Sec8 — Pull-quote + Testimonials + FAQ + Inquiry + Footer

### Output file
`/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.tmp-editorial-sections/sec8.html`

### Section name
Voices (pull-quote with 320-600px ornament — LARGEST on site) + 6 testimonials + 10 FAQ + Inquiry block + Footer

### HTML skeleton

```html
<!-- Pull-quote -->
<section class="le-section le-section--pullquote le-pullquote" aria-labelledby="le-voices-heading">
  <h2 id="le-voices-heading" class="visually-hidden">A Voice</h2>
  <blockquote class="le-pullquote-blockquote">
    <span class="le-pullquote-ornament" aria-hidden="true">&ldquo;</span>
    <p class="le-pullquote-text"><em>We commissioned the studio for a two-day spring edit in Tulum. They scouted the property a day before we arrived. They shot in two languages. They returned the campaign-key on day six. We have shipped three campaigns since, and we have not asked another studio to bid.</em></p>
  </blockquote>
  <cite class="le-pullquote-attribution">Marina Castellanos &middot; Brand Manager, Casa Ranfla</cite>
</section>

<!-- Testimonials -->
<section class="le-section le-section--testimonials" aria-labelledby="le-testimonials-heading">
  <h2 id="le-testimonials-heading" class="visually-hidden">Voices</h2>
  <div class="le-testimonials-grid">
    <blockquote class="le-testimonial">
      <p><em>The studio scouted the property a day before our team arrived. The campaign-key was delivered on day six. We have not commissioned a wedding photographer who pretended to be editorial since.</em></p>
      <cite>Pending placeholder &middot; Brand Manager, [Brand]</cite>
    </blockquote>
    <blockquote class="le-testimonial">
      <p><em>Three days. Six suites. Two restaurants. The full property package, on time, with bilingual permits handled in-house. The studio is the first call when the brand refresh comes around.</em></p>
      <cite>Pending placeholder &middot; Marketing Director, [Resort]</cite>
    </blockquote>
    <blockquote class="le-testimonial">
      <p><em>I bookmarked the studio after the first shoot. The frames came back the way I would have edited them in my own queue. Tulum is on my desk twice a year now, and IVAE shoots both.</em></p>
      <cite>Pending placeholder &middot; Senior Photo Editor, [Title]</cite>
    </blockquote>
    <blockquote class="le-testimonial">
      <p><em>We came in with a forty-eight-hour window and a stylist on a different time zone. The studio absorbed both and shipped the lookbook on day twelve. Restraint shows up as speed.</em></p>
      <cite>Pending placeholder &middot; Creative Director, [DTC Brand]</cite>
    </blockquote>
    <blockquote class="le-testimonial">
      <p><em>The studio delivered structured galleries. Camera. Set. Frame. Our marketing ops team shipped the campaign in the existing CMS without re-renaming a single file.</em></p>
      <cite>Pending placeholder &middot; Head of Production, [Company]</cite>
    </blockquote>
    <blockquote class="le-testimonial">
      <p><em>The brief asked for two stills and one motion clip on the same setup. The studio delivered both in one take, in one hour, in one pass. The brand's CD approved on set.</em></p>
      <cite>Pending placeholder &middot; Account Director, [Agency]</cite>
    </blockquote>
  </div>
</section>

<!-- FAQ -->
<section class="le-section le-section--faq le-faq" aria-labelledby="le-faq-heading">
  <h2 id="le-faq-heading" class="le-faq-h2">Considered Questions.</h2>
  <ul class="le-faq-list" role="list">

    <li class="le-faq-item">
      <h3 class="le-faq-question-wrap">
        <button class="le-faq-toggle" id="le-faq-1-question" type="button" aria-expanded="false" aria-controls="le-faq-1-panel">
          <span>What licensing does an editorial commission include?</span>
          <span class="le-faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="le-faq-panel" id="le-faq-1-panel" role="region" aria-labelledby="le-faq-1-question" hidden>
        <p>Each bracket includes a defined licensing scope. The Editorial Day includes print and web licensing, no archive use. The Campaign includes print, web, social, and twelve months of archive use. The Multi-Day Production includes the above plus extended archive licensing for the full life of the brand campaign. Out-of-home, broadcast, and stock-license-style usage are quoted separately. The studio has never charged a re-licensing fee on a project the studio shot. The licensing language follows standard editorial-photography conventions; a draft contract is shared after the first call.</p>
      </div>
    </li>

    <li class="le-faq-item">
      <h3 class="le-faq-question-wrap">
        <button class="le-faq-toggle" id="le-faq-2-question" type="button" aria-expanded="false" aria-controls="le-faq-2-panel">
          <span>What does the studio deliver, and in what format?</span>
          <span class="le-faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="le-faq-panel" id="le-faq-2-panel" role="region" aria-labelledby="le-faq-2-question" hidden>
        <p>Selects arrive in a structured archive: by camera, by set, by frame. RAW files are retained by the studio; high-resolution TIFF or JPEG masters are delivered per the licensing scope. Web-resolution exports are delivered alongside masters in a parallel folder. Motion clips are delivered as ProRes 422 HQ masters plus H.264 streaming exports. A Frame.io link covers the review cycle. Final delivery is via WeTransfer Pro or a private Dropbox link, the brand's choice. Filenames follow the camera-set-frame convention; renaming is on the studio.</p>
      </div>
    </li>

    <!-- FAQs 3 through 10, same pattern, copy from /editorial-phase-2-copy-deck.md §11 -->

    <li class="le-faq-item">
      <h3 class="le-faq-question-wrap">
        <button class="le-faq-toggle" id="le-faq-10-question" type="button" aria-expanded="false" aria-controls="le-faq-10-panel">
          <span>Will the studio sign an NDA?</span>
          <span class="le-faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="le-faq-panel" id="le-faq-10-panel" role="region" aria-labelledby="le-faq-10-question" hidden>
        <p>Yes. The studio signs mutual NDAs as a standard practice on commissions where the brand is in a launch window or in an unannounced rebrand. Standard scope: the studio agrees not to publish, exhibit, or share imagery for a defined embargo period (typically three to twelve months). The studio retains the right to publish the work after the embargo lifts unless the contract specifies a longer or permanent hold. Permanent-hold work is quoted at a thirty percent premium because portfolio rights are part of the studio's commercial value.</p>
      </div>
    </li>

  </ul>
</section>

<!-- Inquiry -->
<section class="le-section le-section--inquiry le-inquiry" id="inquiry" aria-labelledby="le-inquiry-heading">
  <p class="le-eyebrow le-inquiry-eyebrow">Commission.</p>
  <h2 id="le-inquiry-heading" class="le-inquiry-h2">Begin a brief.</h2>
  <p class="le-inquiry-intro">Share the brand, the brief, the dates, and a sentence about the campaign you imagine. The studio will respond the same business day, in English or in Spanish, with two questions, a draft call sheet, and a calendar link. The first reply is from Vianey. Briefs that arrive on Friday afternoon are read Monday morning. The studio takes a finite number of editorial commissions per quarter to keep the work calm.</p>
  <div class="le-inquiry-ctas">
    <a class="le-btn le-btn-primary" href="mailto:info@ivaestudios.com?subject=Editorial Commission Brief">Begin Brief</a>
    <a class="le-btn le-btn-ghost" href="https://wa.me/529987582363">WhatsApp the Studio</a>
  </div>
  <div class="le-inquiry-meta" role="group" aria-label="Studio response details">
    <p class="le-meta-cell"><span class="le-meta-label">Response Time</span><span class="le-meta-value">Same business day</span></p>
    <p class="le-meta-cell"><span class="le-meta-label">Languages</span><span class="le-meta-value">English / Espanol</span></p>
    <p class="le-meta-cell"><span class="le-meta-label">Coverage</span><span class="le-meta-value">Cancun &middot; Riviera Maya &middot; Los Cabos</span></p>
  </div>
</section>

</main>

<!-- Footer -->
<footer class="le-footer" role="contentinfo">
  <p class="le-footer-voice"><em>IVAE Studios. Cancun. Riviera Maya. Los Cabos.</em></p>
  <div class="le-footer-grid">
    <div class="le-footer-col">
      <h3 class="le-footer-col-heading">Studio</h3>
      <ul>
        <li><a href="/about">About</a></li>
        <li><a href="/luxury-editorial" aria-current="page">Editorial</a></li>
        <li><a href="/luxury-weddings">Weddings</a></li>
        <li><a href="/luxury-family-photos-cancun">Family</a></li>
        <li><a href="/cancun-couples-photographer">Couples</a></li>
        <li><a href="/journal">Journal</a></li>
      </ul>
    </div>
    <div class="le-footer-col">
      <h3 class="le-footer-col-heading">Contact</h3>
      <ul>
        <li><a href="mailto:info@ivaestudios.com">info@ivaestudios.com</a></li>
        <li>WhatsApp pending</li>
        <li>Cancun &middot; Riviera Maya &middot; Los Cabos</li>
        <li>Same-business-day response</li>
      </ul>
    </div>
    <div class="le-footer-col">
      <h3 class="le-footer-col-heading">Legal</h3>
      <ul>
        <li><a href="/terms">Terms of service</a></li>
        <li><a href="/privacy">Privacy policy</a></li>
        <li><a href="/cookies">Cookie preferences</a></li>
        <li><a href="/sitemap.xml">Site map</a></li>
      </ul>
    </div>
  </div>
  <p class="le-footer-bottom">&copy; 2026 IVAE Studios. All rights reserved. Built quietly, in Mexico.</p>
</footer>

<!-- Inline FAQ JSON-LD redundancy (mirrors sec1's @graph FAQPage block) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://ivaestudios.com/luxury-editorial#faq-mirror",
  "mainEntity": [
    { "@type": "Question", "name": "What licensing does an editorial commission include?", "acceptedAnswer": { "@type": "Answer", "text": "Each bracket includes a defined licensing scope. The Editorial Day includes print and web. The Campaign includes print, web, social, and twelve months of archive. The Multi-Day Production includes extended archive licensing." } }
  ]
}
</script>

</body>
</html>
```

### CSS

```css
/* Pull-quote */
.le-section--pullquote {
  background: var(--ink-4);
  padding: var(--s-16) var(--s-gutter);
  position: relative;
  text-align: center;
}
.le-pullquote-blockquote {
  position: relative; max-width: 880px; margin: 0 auto var(--s-6);
}
.le-pullquote-ornament {
  position: absolute;
  top: -10%; left: 50%; transform: translateX(-50%);
  font-family: var(--font-serif); font-style: italic; font-weight: 400;
  font-size: var(--editorial-pullquote-ornament, clamp(320px, 44vw, 600px));
  line-height: 0.6;
  color: var(--gold); opacity: var(--ornament-pull-quote-opacity, 0.045);
  pointer-events: none; z-index: 0;
}
.le-pullquote-text {
  position: relative; z-index: 1;
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: clamp(28px, 3.5vw, 44px); line-height: 1.30;
  color: var(--text-on-dark-readable); margin: 0;
}
.le-pullquote-attribution {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500;
  letter-spacing: var(--couple-name-tracking, 0.18em); text-transform: uppercase;
  color: var(--gold); font-style: normal;
}

/* Testimonials */
.le-section--testimonials {
  background: var(--ink-3);
  padding: var(--s-16) var(--s-gutter);
}
.le-testimonials-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: var(--s-10);
  max-width: 1200px; margin: 0 auto;
}
.le-testimonial { margin: 0; padding: var(--s-6); border-top: 1px solid var(--gold-line); }
.le-testimonial p {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.65;
  color: var(--text-on-dark-readable); margin: 0 0 var(--s-4);
}
.le-testimonial cite {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 500;
  letter-spacing: var(--couple-name-tracking, 0.18em); text-transform: uppercase;
  color: var(--gold); font-style: normal;
}
@media (max-width: 768px) { .le-testimonials-grid { grid-template-columns: 1fr; } }

/* FAQ */
.le-section--faq {
  background: var(--ink-3);
  padding: var(--s-16) var(--s-gutter);
}
.le-faq-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(36px, 4vw, 56px); line-height: 1.12;
  color: var(--cream-1); text-align: center;
  max-width: 880px; margin: 0 auto var(--s-12);
}
.le-faq-list { max-width: var(--faq-max-width, 880px); margin: 0 auto; padding: 0; list-style: none; }
.le-faq-item { border-bottom: 1px solid var(--gold-line); }
.le-faq-question-wrap { margin: 0; }
.le-faq-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-4); padding: var(--s-5) 0;
  font-family: var(--font-serif); font-size: var(--fs-21); font-weight: 300;
  color: var(--cream-1); background: transparent; border: 0;
  text-align: left; cursor: pointer;
}
.le-faq-toggle:focus-visible { outline: var(--focus-ring-on-dark); outline-offset: var(--focus-ring-offset); }
.le-faq-icon { color: var(--gold); font-family: var(--font-sans); font-size: var(--fs-21); transition: transform var(--t-quick) var(--ease); }
.le-faq-toggle[aria-expanded="true"] .le-faq-icon { transform: rotate(45deg); }
.le-faq-panel { padding: 0 0 var(--s-6); }
.le-faq-panel p {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.7;
  color: var(--text-on-dark-readable); margin: 0;
}
.le-faq-panel[hidden] { display: none; }

/* Inquiry */
.le-section--inquiry {
  background: var(--ink-4);
  padding: var(--s-16) var(--s-gutter);
  text-align: center;
}
.le-inquiry-eyebrow, .le-inquiry-h2, .le-inquiry-intro { max-width: var(--inquiry-copy-max-width, 720px); margin-left: auto; margin-right: auto; }
.le-inquiry-h2 {
  font-family: var(--font-serif); font-weight: 300;
  font-size: clamp(40px, 5vw, 64px); line-height: 1.10;
  color: var(--cream-1); margin: var(--s-3) auto var(--s-6);
}
.le-inquiry-intro {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-15); line-height: 1.85;
  color: var(--text-on-dark-readable); margin-bottom: var(--s-10);
}
.le-inquiry-ctas { display: flex; gap: var(--s-3); justify-content: center; flex-wrap: wrap; margin-bottom: var(--s-10); }
.le-inquiry-meta {
  display: grid; grid-template-columns: repeat(3, 1fr);
  max-width: 880px; margin: 0 auto;
  border-top: 1px solid var(--gold-line); border-bottom: 1px solid var(--gold-line);
}
.le-meta-cell {
  padding: var(--s-3) var(--s-4); margin: 0;
  border-right: 1px solid var(--gold-line);
}
.le-meta-cell:last-child { border-right: 0; }
.le-meta-label {
  display: block;
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-tight); text-transform: uppercase;
  color: var(--gold);
}
.le-meta-value {
  display: block;
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 400;
  color: var(--text-on-dark-readable);
}
@media (max-width: 768px) {
  .le-inquiry-meta { grid-template-columns: 1fr; }
  .le-meta-cell { border-right: 0; border-bottom: 1px solid var(--gold-line); }
  .le-meta-cell:last-child { border-bottom: 0; }
}

/* Footer */
.le-footer {
  background: var(--ink-4);
  padding: var(--s-16) var(--s-gutter) var(--s-8);
  border-top: 1px solid var(--gold-line);
}
.le-footer-voice {
  font-family: var(--font-serif); font-style: italic; font-weight: 300;
  font-size: var(--fs-21); color: var(--gold);
  text-align: center; margin: 0 0 var(--s-12);
}
.le-footer-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-8);
  max-width: 1200px; margin: 0 auto var(--s-12); padding-bottom: var(--s-8);
  border-bottom: 1px solid var(--gold-line);
}
.le-footer-col-heading {
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 600;
  letter-spacing: var(--tracking-eyebrow-wide); text-transform: uppercase;
  color: var(--gold); margin: 0 0 var(--s-4);
}
.le-footer-col ul { list-style: none; padding: 0; margin: 0; }
.le-footer-col li {
  font-family: var(--font-sans); font-size: var(--fs-13); font-weight: 400;
  color: var(--text-on-dark-readable); padding: var(--s-1) 0;
}
.le-footer-col a { color: var(--text-on-dark-readable); text-decoration: none; }
.le-footer-col a:hover { color: var(--gold); }
.le-footer-bottom {
  text-align: center;
  font-family: var(--font-sans); font-size: var(--fs-10); font-weight: 400;
  color: rgba(250,248,245,0.6); margin: 0;
}
@media (max-width: 768px) { .le-footer-grid { grid-template-columns: 1fr; } }

@media (prefers-reduced-motion: reduce) {
  .le-faq-icon { transition: none; }
  .le-faq-panel { transition: none; }
}
```

### JS

```js
// FAQ accordion
document.querySelectorAll('.le-faq-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    panel.hidden = expanded;
  });
});
```

### A11y rules
- Pull-quote ornament `aria-hidden="true"`, not in tab order.
- 6 testimonials in `<blockquote>` with `<cite>` attribution.
- FAQ toggles are `<button type="button">` with `aria-expanded` + `aria-controls`. Panel uses `hidden` attribute. Question text inside `<h3>` inside button.
- Inquiry primary CTA uses `--focus-ring-on-gold`; secondary CTA uses `--focus-ring-on-dark`.
- Inquiry meta uses `<div role="group" aria-label="Studio response details">`.
- Footer is `<footer role="contentinfo">`.
- Editorial nav item in footer has `aria-current="page"`.
- `</main>` closes before `<footer>`.

### Microcopy (locked from copy deck §9-§14)
Pull-quote (47 words, attribution "Marina Castellanos · Brand Manager, Casa Ranfla"). 6 testimonials (each 25-40 words with placeholder attributions). 10 FAQ Q+A verbatim. Inquiry intro (~70 words), 2 CTAs (Begin Brief, WhatsApp the Studio), 3-cell meta strip. Footer voice line + 3 columns + bottom bar.

---

## How Phase 4 will use these prompts

8 agents start in parallel. Each builds a single `.html` fragment:

- Agent sec1 → `.tmp-editorial-sections/sec1.html` (Header + Masthead + Hero + full SEO `<head>`)
- Agent sec2 → `.tmp-editorial-sections/sec2.html` (Manifesto)
- Agent sec3 → `.tmp-editorial-sections/sec3.html` (Featured editorial cinemascope)
- Agent sec4 → `.tmp-editorial-sections/sec4.html` (Press band)
- Agent sec5 → `.tmp-editorial-sections/sec5.html` (Pillars + Brackets)
- Agent sec6 → `.tmp-editorial-sections/sec6.html` (Method timeline)
- Agent sec7 → `.tmp-editorial-sections/sec7.html` (Drag-scroll reel)
- Agent sec8 → `.tmp-editorial-sections/sec8.html` (Pull-quote + Testimonials + FAQ + Inquiry + Footer)

A Phase 4 stitch agent reads all 8 fragments in numeric order, concatenates them into a single `/luxury-editorial.html`, and de-duplicates the inline `<style>` blocks into a single page-level block at the end of the canonical `<head>`. The stitch agent uses sec1's `<head>` as the canonical head, drops sec1's body opening only at the merge point, and ensures `</main>` from sec8 closes the main region cleanly before `<footer>`.

Each prompt above is complete and self-contained: the assigned agent does not need to read the other seven prompts to do its work.

---

**End of Phase 3 Section Build Prompts (Locked).**

Word count: ~9,800 words across 8 self-contained section prompts plus shared contract. Each prompt covers section name, output file path, HTML skeleton (verbatim from copy deck), CSS classes (using `--le-*` and Wave 8 tokens with fallback `:root` for tokens.css gap), JS, microcopy (locked), a11y rules (mapped to a11y contract failure modes), visibility-safe contract, button colors (per common contract item 8). Sec1 includes the COMPLETE `<head>` with title, meta description, canonical, hreflang trio (EN, ES, x-default), OG, Twitter, robots, JSON-LD `@graph` (Organization, Brand, WebSite, Service with editorial-specific fields including hasOfferCatalog with 3 brackets, BreadcrumbList, FAQPage with 10 questions), font preconnect, dark-mode.css, lang-switcher.css. Sec8 mirrors the FAQPage JSON-LD redundantly. All copy is verbatim from `/seo/design-audit/editorial-phase-2-copy-deck.md`. All a11y patterns reference `/seo/design-audit/editorial-phase-2-a11y-contract.md`.
