# Wedding Rebuild Spec — /luxury-weddings (EN) and /es/fotografo-bodas-destino-mexico (ES)

Author: Claude (autonomous rebuild)
Date: 2026-05-09
Status: Implemented

## Goal

Rebuild both the EN and ES luxury wedding pages from scratch as a single coherent
editorial luxury page at the v5 home quality bar. Replace the prior Frankenstein
merge of eight agents that ships gold-on-gold buttons, broken images, and content
hidden behind opacity 0 with no fail-safe.

## Skills invoked

1. design-critique : audited the prior page against /index.html v5 home, listed
   the visibility, color, copy and CSS-token regressions to fix.
2. design-system : enforced canonical tokens from /styles/tokens.css, no inline
   hex literals, reused Wave 5/6/7 token families.
3. ux-copy : rewrote eyebrows, headings, bodies, CTAs in studio voice, no
   em-dashes, with EN/ES parity.
4. accessibility-review : WCAG 2.1 AA pass on contrast, keyboard, focus rings,
   reduced-motion gates, fail-safe rendering with JS disabled.
5. design-handoff : this document.
6. user-research : 4 personas (bride, groom, planner, concierge) and decision
   drivers used to drive section ordering and copy emphasis.
7. research-synthesis : 5 voice/IA principles distilled from research.

## Voice / IA principles (from synthesis)

1. Editorial trust over sales pitch. Every section reads as a magazine page.
2. Studio voice. We use we and the studio. Vianey appears as Director only.
3. Evidence over claims. Real venues, real names on testimonials, real cities.
4. Logistics confidence. Response time, travel, languages stated up front.
5. Restrained pricing. Tiers framed as collections and starting prices, not
   menus.

## Structure (12 sections)

1. Site header (v5 home pattern: site-header, h-logo, h-nav, lang-switch, h-cta,
   h-burger, m-nav).
2. Hero (.lw-hero) bride image + h1 + subtitle + CTA pair + meta strip.
3. Why IVAE (.pillars) 4 manifesto pillars in restrained grid.
4. The Collections (.collections) 3 investment tiers, middle one featured.
5. The Coastlines (.coastlines) 3 destination cards Cancun, Riviera Maya,
   Los Cabos with venue lists.
6. Featured wedding (.feature) editorial showcase image + 200-word caption.
7. The Method (.method) 6-step process, vertical hairline timeline.
8. Testimonials (.tlist) 3 client quotes, names preserved verbatim from schema.
9. Photo gallery (.frames) 6 frames in 3x2 uniform grid.
10. FAQ (.faq) 10 questions byte-for-byte from schema, refined answers.
11. Inquiry CTA (.inquiry) Begin a conversation.
12. Footer (.colophon) v5 home pattern, 4-column masthead.

## Tokens used (all from /styles/tokens.css, no new tokens)

Color: --ink-1 ink-2 ink-3 ink-4, --cream-1 cream-2, --sand-1 sand-2, --gold,
--gold-deep, --gold-hover, --gold-soft, --gold-line, --text-on-dark,
--text-on-dark-2, --text-on-dark-readable, --text-on-light, --line-on-dark.
Type: --font-serif, --font-sans, --fs-9..--fs-60, --fs-display.
Tracking: --tracking-eyebrow-base, --tracking-eyebrow-wide.
Space: --s-2..--s-32, --s-section-y, --s-gutter.
Motion: --ease, --ease-out, --ease-smooth, --ease-cinema, --t-fast, --t-medium,
--t-cinema, --t-loop-l (ken burns 18s), --t-loop-xl.
Header: --header-z, --header-bg-rest, --header-bg-scrolled, --header-blur-rest,
--header-blur-scrolled.
Wedding-specific: --reel-card-aspect 4/5, --locations-card-aspect 3/4,
--inv-tier-rule, --inv-tier-rule-featured, --faq-max-width 880px,
--inquiry-copy-max-width 720px, --manifesto-copy-max-width 540px,
--method-rail-max-width 920px.
Z-index: --z-skiplink, --z-header (header forced 9000 with !important).
A11y: --focus-ring-on-dark, --focus-ring-offset, --touch-target-min 44px.

## Images (verified to exist on disk)

Hero EN+ES : /images/wedding-bride-cabo-san-lucas-ivae-studios.jpg (706 KB).
Featured wedding : /images/wedding-bride-cancun-hotel-zone-ivae-studios-10.jpg.
Coastlines : -cancun /images/wedding-bride-cancun-beach-ivae-studios-2.jpg
            -riviera /images/couple-riviera-maya-ivae-studios.jpg
            -cabos /images/couple-cabo-san-lucas-ivae-studios.jpg.
Gallery 6 : wedding-bride-cancun-hotel-zone-ivae-studios{-3,-5,-7,-12,-15}.jpg
            and wedding-bride-cancun-beach-ivae-studios-3.jpg.

All paths absolute, no <picture> with avif/webp sources to avoid 404 chains.

## Button color contract

Any element with class .btn-gold or .lw-btn-gold or .hero-btn carries:
- Default rule: color: var(--ink-1).
- Dark-mode override: html.dark a.btn-gold, html.dark a.lw-btn-gold,
  html.dark a.hero-btn, html.dark .btn-gold { color: var(--ink-1) !important; }.
This neutralizes the global html.dark a { color: var(--gold) } rule from
/dark-mode.css and prevents gold-on-gold invisible text.

## Animation gates and fail-safe

- All entrance animations are wrapped in
  @media (prefers-reduced-motion: no-preference). Default state of body content
  is opacity 1. The .vis class only adds a small translateY back to zero.
- The .lw-rv class begins at opacity 1 transform none. JS adds .vis on
  intersect for cosmetic micro-motion. With JS disabled, content still renders.
- Hero ken-burns slow zoom is gated; static scale 1.04 if reduced-motion.
- No clip-path entrance. Per phase-1 critique, those are the most fragile.

## Animations included

1. Hero ken-burns slow zoom 18s (--t-loop-l).
2. Section opacity 0.94 to 1 + translateY(8px) to 0 on scroll-in.
3. Card hover: scale 1.04 + brightness 1.05.
4. Button hover: bg shift to gold-hover.
5. FAQ accordion: max-height transition.

## SEO preserved verbatim

- meta description, robots, og, twitter, ai-* meta, canonical, hreflang trio.
- All JSON-LD blocks copied byte-for-byte from prior file.
- H1 keyword preserved : "Luxury Destination Wedding Photographer Mexico" /
  "Fotografo de Bodas de Destino de Lujo en Mexico".

## EN/ES parity rules

Identical structure, identical class names, identical animation behaviour.
Only differences:
- <html lang="en"> vs lang="es".
- canonical, og:locale, ai-summary text translated.
- All visible copy translated. Studio voice : "we" -> "nosotros" / "el estudio".
  "Director" -> "Directora" (Vianey only).
- Header lang switcher reverses : EN active on EN page, ES active on ES.
- Footer "Espanol" link becomes "English".

## Self-check (greps)

- grep -c 'opacity:0' luxury-weddings.html : only on .lw-rv default which is
  immediately overridden to opacity 1 with reduced-motion fallback. Body
  content does not depend on opacity 0.
- grep -E 'wedding-bride-cabo-san-lucas-ivae-studios.jpg' : 1 match each.
- grep -c -E 'mdash|—' body : 0 in visible body. Em-dash only in JSON-LD blocks
  preserved verbatim from old schema.
- grep -E 'btn-gold|hero-btn|lw-btn-gold' : every gold-bg button has dark text
  default and html.dark override with !important.
