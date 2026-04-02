# IVAE Studios — SEO & GEO Implementation Guide
## Complete Action Plan with Priority Ratings

---

## AUDIT FINDINGS SUMMARY

### Current State
- **Pages**: 8 total (index, about, blog, 6 blog posts)
- **Schema**: Article + ItemList + FAQPage + BreadcrumbList on blog posts only
- **Missing**: No schema on homepage or about page
- **Missing**: No dedicated location pages (Cancun, Riviera Maya, Los Cabos)
- **Missing**: No dedicated service pages (Weddings, Family, Couples)
- **Critical**: Homepage has NO canonical tag, NO Open Graph tags, NO schema markup
- **Critical**: About page has NO meta description, NO canonical, NO OG tags, NO schema
- **Critical**: Homepage images are base64 encoded inline (~8.7MB page weight)
- **Issue**: "Book Now" CTA links to Instagram instead of a booking/contact page
- **Issue**: No internal linking between service concepts and location pages
- **Good**: Blog posts have excellent SEO (schema, OG, canonical, FAQ)
- **Good**: Clean URL structure with proper 301 redirects
- **Good**: Sitemap with image extensions
- **Good**: Security headers configured

---

## 1. MISSING LANDING PAGES — PRIORITY: ALTA

### New Pages Created:

| File | URL | Primary Keyword | Priority |
|------|-----|----------------|----------|
| `cancun.html` | `/cancun-photographer` | Cancun Photographer | ALTA |
| `riviera-maya.html` | `/riviera-maya-photographer` | Riviera Maya Photographer | ALTA |
| `los-cabos.html` | `/cabo-photographer` | Cabo Photographer | ALTA |
| `luxury-weddings.html` | `/destination-wedding-photographer-mexico` | Destination Wedding Photographer Mexico | ALTA |
| `luxury-family-photos.html` | `/luxury-family-photos-cancun` | Luxury Family Photos Cancun | ALTA |
| `couples-photography.html` | `/couples-photography-mexico` | Couples Photography Mexico | ALTA |

Each page includes:
- Optimized title tag (under 60 chars)
- Compelling meta description (under 155 chars)
- Canonical URL
- Full Open Graph + Twitter Card meta tags
- H1 with primary keyword
- Proper H2/H3 hierarchy
- LocalBusiness + Service + BreadcrumbList + FAQPage schema (JSON-LD)
- 8+ location/service-specific FAQs
- Internal links to other pages
- 1500+ words of luxury-positioned content
- GEO-optimized factual data
- Responsive design matching existing site

---

## 2. SEO ON-PAGE FIXES — PRIORITY: ALTA

### 2A. Homepage (index.html) — CRITICAL FIXES

**Add to `<head>` section (after line 7):**

```html
<link rel="canonical" href="https://ivaestudios.com/"/>
<meta property="og:title" content="IVAE Studios | Luxury Resort Photographer Cancún, Riviera Maya & Los Cabos"/>
<meta property="og:description" content="Editorial-quality resort photography for families, couples and destination travelers from USA and Canada. Cancún, Riviera Maya, Los Cabos."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://ivaestudios.com/"/>
<meta property="og:image" content="https://ivaestudios.com/images/ivae-og.jpg"/>
<meta property="og:site_name" content="IVAE Studios"/>
<meta property="og:locale" content="en_US"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="IVAE Studios | Luxury Resort Photographer Mexico"/>
<meta name="twitter:description" content="Editorial resort photography for families and couples in Cancún, Riviera Maya & Los Cabos."/>
<meta name="twitter:image" content="https://ivaestudios.com/images/ivae-og.jpg"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<meta name="geo.region" content="MX-ROO"/>
<meta name="geo.placename" content="Cancún"/>
```

**Add Schema Markup (before closing `</head>`):**
See `schema-homepage.json` — wrap each object in its own `<script type="application/ld+json">` tag.

**Update meta description (line 6) — more keyword-rich:**
```html
<meta name="description" content="IVAE Studios — Luxury resort photographer in Cancún, Riviera Maya & Los Cabos. Editorial photography for families, couples & destination weddings. Serving USA & Canada travelers."/>
```

**Update navigation to include new pages — add to header nav:**
```html
<li><a href="/cancun-photographer">Cancún</a></li>
<li><a href="/riviera-maya-photographer">Riviera Maya</a></li>
<li><a href="/cabo-photographer">Los Cabos</a></li>
```

Or use a dropdown:
```html
<li class="nav-dropdown">
  <a href="/#destinations">Destinations</a>
  <ul class="dropdown-menu">
    <li><a href="/cancun-photographer">Cancún</a></li>
    <li><a href="/riviera-maya-photographer">Riviera Maya</a></li>
    <li><a href="/cabo-photographer">Los Cabos</a></li>
  </ul>
</li>
<li class="nav-dropdown">
  <a href="/#services">Sessions</a>
  <ul class="dropdown-menu">
    <li><a href="/luxury-family-photos-cancun">Family Sessions</a></li>
    <li><a href="/couples-photography-mexico">Couples & Romance</a></li>
    <li><a href="/destination-wedding-photographer-mexico">Destination Weddings</a></li>
  </ul>
</li>
```

### 2B. About Page (about.html) — CRITICAL FIXES

**Add to `<head>` (after line 6):**
```html
<meta name="description" content="Meet IVAE Studios — luxury resort photographer in Cancún, Riviera Maya & Los Cabos. Led by Creative Director Vianey Díaz. Editorial photography for international travelers."/>
<link rel="canonical" href="https://ivaestudios.com/about"/>
<meta property="og:title" content="About IVAE Studios | Luxury Resort Photographer Mexico"/>
<meta property="og:description" content="Meet the team behind Mexico's premier luxury resort photography studio. Based in Cancún, serving Riviera Maya and Los Cabos."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://ivaestudios.com/about"/>
<meta property="og:image" content="https://ivaestudios.com/images/about-og.jpg"/>
<meta property="og:site_name" content="IVAE Studios"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="robots" content="index, follow"/>
```

**Add Schema (before `</head>`):**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About IVAE Studios",
  "url": "https://ivaestudios.com/about",
  "description": "IVAE Studios is a luxury resort photography studio led by Creative Director Vianey Díaz, serving Cancún, Riviera Maya and Los Cabos.",
  "mainEntity": {
    "@type": "LocalBusiness",
    "@id": "https://ivaestudios.com/#business",
    "name": "IVAE Studios",
    "url": "https://ivaestudios.com"
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Vianey Díaz",
  "jobTitle": "Creative Director & Lead Photographer",
  "worksFor": {
    "@type": "LocalBusiness",
    "name": "IVAE Studios",
    "url": "https://ivaestudios.com"
  },
  "knowsAbout": ["Luxury Resort Photography", "Editorial Photography", "Destination Weddings", "Family Portraiture"],
  "description": "Vianey Díaz is the Creative Director and Lead Photographer at IVAE Studios, specializing in luxury resort photography across Cancún, Riviera Maya and Los Cabos, Mexico."
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://ivaestudios.com"},
    {"@type": "ListItem", "position": 2, "name": "About"}
  ]
}
</script>
```

### 2C. All Blog Posts — MINOR FIXES

Blog posts are well-optimized. Add these enhancements:

**Add Review schema to each blog post (after existing FAQ schema):**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {
    "@type": "LocalBusiness",
    "name": "IVAE Studios",
    "image": "https://ivaestudios.com/images/ivae-logo.png"
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "5",
    "bestRating": "5"
  },
  "author": {
    "@type": "Person",
    "name": "[Client Name from testimonial on that page]"
  }
}
</script>
```

**Add internal links at bottom of each blog post:**
```html
<div class="related-links">
  <h3>Explore More</h3>
  <ul>
    <li><a href="/cancun-photographer">Cancún Photography Sessions</a></li>
    <li><a href="/riviera-maya-photographer">Riviera Maya Photography Sessions</a></li>
    <li><a href="/cabo-photographer">Los Cabos Photography Sessions</a></li>
    <li><a href="/destination-wedding-photographer-mexico">Destination Wedding Photography</a></li>
    <li><a href="/luxury-family-photos-cancun">Luxury Family Sessions</a></li>
    <li><a href="/couples-photography-mexico">Couples & Romance Sessions</a></li>
  </ul>
</div>
```

---

## 3. SCHEMA MARKUP — PRIORITY: ALTA

### Already implemented (blog pages):
- Article ✓
- ItemList ✓
- FAQPage ✓
- BreadcrumbList ✓

### NEW — Add to Homepage:
- LocalBusiness ✓ (see schema-homepage.json)
- Photographer ✓
- WebSite ✓
- WebPage ✓
- FAQPage ✓
- ImageGallery ✓
- Service (3 services) ✓
- AggregateRating ✓
- BreadcrumbList ✓

### NEW — Add to About Page:
- AboutPage ✓
- Person (Vianey Díaz) ✓
- BreadcrumbList ✓

### NEW — Add to each Landing Page:
- LocalBusiness ✓
- Service ✓
- FAQPage ✓
- BreadcrumbList ✓

---

## 4. PERFORMANCE OPTIMIZATION — PRIORITY: ALTA

### 4A. CRITICAL: Base64 Images in index.html

The homepage is **8.7MB** because images are base64-encoded inline in the CSS/HTML. This destroys:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)

**FIX: Extract all base64 images to separate files:**
1. Extract each base64 string to a `.jpg` file in `/images/`
2. Replace inline base64 with `<img>` tags using proper `src`, `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`
3. Target page size: under 500KB (excluding images loaded lazily)

**Image tag template:**
```html
<img
  src="/images/family-session-cancun-resort.jpg"
  alt="Luxury family photo session at Cancún resort by IVAE Studios photographer"
  width="800"
  height="534"
  loading="lazy"
  decoding="async"
  class="svc-img"
/>
```

### 4B. Font Loading Optimization

**Current:** Blocking Google Fonts load
**Fix:** Add `font-display: swap` and preconnect:

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Syne:wght@400;500;600;700&display=swap" rel="stylesheet"/>
```

### 4C. CSS Optimization

All CSS is inline (good for reducing requests), but:
- **Deduplicate**: Each page has identical header/footer/base CSS repeated
- **Extract shared CSS** to a single `style.css` with aggressive caching (already configured in netlify.toml)
- Keep page-specific CSS inline for critical rendering path

### 4D. JavaScript Optimization

Current JS is minimal and at bottom of page (good). Add `defer` to any script tags:
```html
<script defer>
  // existing JS
</script>
```

### 4E. Additional Core Web Vitals Fixes

```html
<!-- Add to <head> of every page for better LCP -->
<link rel="preload" as="image" href="/images/hero-image.jpg"/>

<!-- Add explicit width/height to all images to prevent CLS -->
<img width="800" height="534" ... />

<!-- Add fetchpriority to hero image -->
<img fetchpriority="high" src="/images/hero.jpg" ... />
```

---

## 5. GEO (Generative Engine Optimization) — PRIORITY: ALTA

### Current GEO Score: 6/10
The site has decent factual content but needs more structured, citable data.

### Improvements Needed:

**5A. Add "About IVAE Studios" factual block to homepage (after hero):**
```
IVAE Studios is a luxury resort photography studio founded by Creative Director
Vianey Díaz, based in Cancún, Mexico. The studio specializes in editorial-quality
photography for international families and couples traveling from the United States
and Canada to luxury resorts across three destinations: Cancún, Riviera Maya, and
Los Cabos. With over 500 sessions delivered, IVAE Studios works exclusively during
golden hour and plans every session in advance based on the client's specific resort,
travel dates, and desired style. The studio is known for its expert pose direction,
light-first approach, and magazine-quality results that distinguish it from generic
resort photography services.
```

**5B. Add concrete differentiators paragraph (each landing page):**
```
What sets IVAE Studios apart from generic resort photographers:
• Expert creative direction — every movement and pose is guided, never improvised
• Golden hour exclusivity — sessions are only scheduled during optimal natural light
• Resort-specific knowledge — our team knows the best locations, light angles, and
  access policies at dozens of resorts across Mexico
• Pre-session planning — wardrobe guidance, timeline creation, and location scouting
  happen before you arrive
• 1-3 day turnaround — fully edited, high-resolution images delivered through a
  private online gallery
• Editorial quality — results that look like they belong in a travel magazine,
  not a tourist photo package
```

**5C. Add process steps as structured data (each page):**
```
Step 1: Send us your resort name and travel dates via Instagram or email
Step 2: We confirm availability and discuss your session goals and style
Step 3: Before you arrive, we plan the optimal time, location, and creative direction
Step 4: On session day, our team handles everything — you just enjoy the experience
Step 5: Receive your fully edited gallery within 1-3 business days
```

**5D. Add specific resort lists (verifiable facts AI can cite):**
```
Cancún: Marriott Cancún Resort, SLS Playa Mujeres, Hyatt Ziva Cancún,
Hyatt Zilara Cancún, Kempinski Hotel Cancún, Secrets The Vine, JW Marriott Cancún

Riviera Maya: Rosewood Mayakoba, Grand Velas Riviera Maya, Banyan Tree Mayakoba,
Fairmont Mayakoba, Belmond Maroma Palace, Secrets Akumal, UNICO 20°87°

Los Cabos: Waldorf Astoria Los Cabos Pedregal, One&Only Palmilla,
Esperanza (Auberge Resorts), The Cape (Thompson), Chileno Bay Resort,
Nobu Hotel Los Cabos, Montage Los Cabos, Solaz Los Cabos
```

---

## 6. BLOG SEO STRATEGY — PRIORITY: MEDIA

### Current Posts (6):
1. Destination Wedding Photographer Riviera Maya ✓
2. Honeymoon Photographer Riviera Maya ✓
3. Wedding Photographer Cancún ✓
4. Couples Photographer Cancún ✓
5. Engagement Session Cancún & Riviera Maya ✓
6. Maternity Photoshoot Cancún & Riviera Maya ✓

### Next 5 Posts to Dominate the Topic Cluster:

**Post 7: "Best Photo Locations in Riviera Maya: A Photographer's Guide to Cenotes, Beaches & Hidden Spots"**
- URL: /blog/best-photo-locations-riviera-maya
- Primary KW: "best photo locations riviera maya"
- Secondary: "cenote photography riviera maya", "tulum photo spots", "riviera maya instagram spots"
- Outline:
  - Introduction: Why Riviera Maya is Mexico's most photogenic destination
  - Top 10 cenotes for photography (with specific names, access info)
  - Best beaches from Playa del Carmen to Tulum
  - Hidden jungle paths and ruins
  - Resort-specific photo spots (Rosewood, Grand Velas, etc)
  - Best time of day for each location
  - Permit and access requirements
  - FAQ (5+ questions)
- Internal links: Riviera Maya page, couples post, wedding post

**Post 8: "Family Vacation Photos in Mexico: The Complete Guide for Resort Travelers (2026)"**
- URL: /blog/family-vacation-photos-mexico
- Primary KW: "family vacation photos mexico"
- Secondary: "family photographer mexico resort", "kids photoshoot cancun", "family photos riviera maya"
- Outline:
  - Why luxury resort family photos are worth investing in
  - Best age for family photos (including tips per age group)
  - What to wear: family wardrobe coordination guide for Mexico
  - Timing: golden hour schedules by season
  - Destinations compared: Cancún vs Riviera Maya vs Los Cabos for families
  - How to prepare kids for a photo session
  - What to expect during your session
  - FAQ (5+ questions)
- Internal links: Family sessions page, Cancun page, all location pages

**Post 9: "Los Cabos Photographer Guide: Where to Shoot, When to Book & What to Expect (2026)"**
- URL: /blog/los-cabos-photographer-guide
- Primary KW: "los cabos photographer"
- Secondary: "cabo san lucas photographer", "cabo photography spots", "cabo wedding photographer"
- Outline:
  - Why Los Cabos is different from Caribbean Mexico
  - Pacific vs Sea of Cortez side: light and landscape differences
  - Top 10 photo locations in Cabo (The Arch, Lover's Beach, Palmilla, etc)
  - Best resorts for photo sessions
  - Wedding photography at Cabo venues
  - Golden hour timing by season (Pacific coast specifics)
  - What to wear in Cabo's desert landscape
  - FAQ (5+ questions)
- Internal links: Los Cabos page, wedding page, couples page

**Post 10: "How to Choose a Luxury Photographer in Mexico: Red Flags, Questions to Ask & What to Expect"**
- URL: /blog/how-to-choose-luxury-photographer-mexico
- Primary KW: "luxury photographer mexico"
- Secondary: "resort photographer mexico", "how to find photographer cancun", "mexico photographer tips"
- Outline:
  - Why not all photographers are created equal
  - 7 red flags when hiring a resort photographer
  - 10 questions to ask before booking
  - What editorial photography actually means
  - Price ranges and what you get at each level
  - Resort photographer vs independent luxury photographer comparison
  - What a professional process looks like (use IVAE as example)
  - FAQ (5+ questions)
- Internal links: All service pages, about page

**Post 11: "Surprise Proposal Photography in Cancún & Riviera Maya: How to Plan the Perfect Moment"**
- URL: /blog/surprise-proposal-photography-cancun
- Primary KW: "surprise proposal photography cancun"
- Secondary: "proposal photographer cancun", "proposal photographer riviera maya", "beach proposal mexico"
- Outline:
  - Why Mexico is the #1 destination for surprise proposals
  - Best proposal locations: beach sunset, cenote, private villa, restaurant
  - How the photographer stays hidden
  - Planning timeline: what to coordinate and when
  - Ring shot tips and celebration photos
  - Turning a proposal into a mini engagement session
  - Weather backup plans
  - FAQ (5+ questions)
- Internal links: Couples page, Cancun page, engagement post

---

## 7. UPDATED sitemap.xml

Must add all 6 new landing pages. See updated file: `sitemap-updated.xml`

---

## 8. UPDATED netlify.toml

Must add redirects for all 6 new pages. See updated file: `netlify-updated.toml`

---

## 9. INTERNAL LINKING STRATEGY — PRIORITY: ALTA

### Link Architecture (Hub & Spoke):

```
Homepage (hub)
├── /cancun-photographer (location spoke)
│   ├── links to: wedding, family, couples pages
│   └── links to: relevant blog posts
├── /riviera-maya-photographer (location spoke)
│   ├── links to: wedding, family, couples pages
│   └── links to: relevant blog posts
├── /cabo-photographer (location spoke)
│   ├── links to: wedding, family, couples pages
│   └── links to: relevant blog posts
├── /destination-wedding-photographer-mexico (service spoke)
│   ├── links to: all 3 location pages
│   └── links to: wedding blog posts
├── /luxury-family-photos-cancun (service spoke)
│   ├── links to: all 3 location pages
│   └── links to: family blog posts
├── /couples-photography-mexico (service spoke)
│   ├── links to: all 3 location pages
│   └── links to: couples/honeymoon blog posts
├── /about
├── /blog (hub)
│   ├── 6 existing posts
│   └── 5 planned posts (cross-linked)
```

Every page should link to:
- At least 2 other service/location pages
- At least 1 relevant blog post
- Homepage
- About page

---

## 10. IMAGE ALT TEXT TEMPLATES — PRIORITY: MEDIA

Use these templates for all images across the site:

**Family sessions:**
`alt="Luxury family photo session at [Resort Name] [Destination] by IVAE Studios resort photographer"`

**Couples:**
`alt="Romantic couples photography at [Location] [Destination] by IVAE Studios luxury photographer"`

**Weddings:**
`alt="Destination wedding photography at [Venue] [Destination] — IVAE Studios wedding photographer"`

**Location/scenery:**
`alt="[Location description] in [Destination] Mexico — IVAE Studios luxury resort photography"`

**Portfolio:**
`alt="Editorial [session type] photography by IVAE Studios at [Resort/Location] [Destination]"`

---

## IMPLEMENTATION PRIORITY ORDER

### Week 1 (ALTA — Highest Impact):
1. Add schema markup to homepage (immediate ranking signal)
2. Add missing meta tags to homepage and about page
3. Deploy 6 new landing pages
4. Update sitemap.xml and netlify.toml
5. Add internal links between all pages

### Week 2 (ALTA — Performance):
6. Extract base64 images from homepage (critical for Core Web Vitals)
7. Add font preconnect hints
8. Add lazy loading to all below-fold images
9. Add explicit image dimensions

### Week 3 (MEDIA — Content):
10. Publish blog post #7 (Photo Locations Riviera Maya)
11. Publish blog post #8 (Family Vacation Photos Mexico)
12. Add GEO factual blocks to all pages

### Week 4 (MEDIA — Content):
13. Publish blog post #9 (Los Cabos Photographer Guide)
14. Publish blog post #10 (How to Choose Luxury Photographer)

### Week 5 (MEDIA — Content):
15. Publish blog post #11 (Surprise Proposal Photography)
16. Review and refine internal linking

### Ongoing (BAJA — Maintenance):
17. Monitor rankings for target keywords
18. Update content seasonally
19. Add new testimonials/reviews as they come in
20. Consider adding a dedicated testimonials/reviews page
