# `partials/picture.html` — universal image patterns

How to author images in IVAE Studios pages. The runtime helper
`js/image-loader.js` finds every `<img data-ivae-img>` on the page,
wraps it in a `.ivae-image` div, reserves its aspect ratio, and fades
in over a shimmer placeholder once the file decodes. This guarantees
zero CLS and no FOIC even on slow 3G.

## Usage

```html
<!-- 1. Simple form (content-managed images, single source) -->
<img
  data-ivae-img
  src="/images/sessions/riviera-maya-couple.jpg"
  alt="Couple at sunrise on a Riviera Maya beach, soft warm light"
  data-aspect="4/5"
  width="1200" height="1500" />

<!-- 2. Hero / above-the-fold — eager load + fetchpriority high -->
<img
  data-ivae-img="hero"
  src="/images/hero/cancun-editorial.jpg"
  alt="Editorial portrait, Cancún resort terrace at golden hour"
  data-aspect="16/9" />

<!-- 3. Full <picture> with AVIF / WebP / JPG fallback + responsive srcset -->
<picture>
  <source
    type="image/avif"
    data-srcset="/images/sessions/los-cabos-480.avif 480w,
                 /images/sessions/los-cabos-960.avif 960w,
                 /images/sessions/los-cabos-1440.avif 1440w,
                 /images/sessions/los-cabos-1920.avif 1920w"
    sizes="(min-width: 1200px) 50vw, 100vw" />
  <source
    type="image/webp"
    data-srcset="/images/sessions/los-cabos-480.webp 480w,
                 /images/sessions/los-cabos-960.webp 960w,
                 /images/sessions/los-cabos-1440.webp 1440w,
                 /images/sessions/los-cabos-1920.webp 1920w"
    sizes="(min-width: 1200px) 50vw, 100vw" />
  <img
    data-ivae-img
    data-src="/images/sessions/los-cabos-1440.jpg"
    data-srcset="/images/sessions/los-cabos-480.jpg 480w,
                 /images/sessions/los-cabos-960.jpg 960w,
                 /images/sessions/los-cabos-1440.jpg 1440w,
                 /images/sessions/los-cabos-1920.jpg 1920w"
    sizes="(min-width: 1200px) 50vw, 100vw"
    src="/images/sessions/los-cabos-480.jpg"
    alt="Family portrait at Los Cabos, soft open shade"
    data-aspect="3/2"
    data-variant="landscape"
    width="1440" height="960" />
</picture>
```

## Attributes recognised by `image-loader.js`

| Attribute | Purpose |
|---|---|
| `data-ivae-img` | Marks the image for enhancement. Empty value = lazy. |
| `data-ivae-img="hero"` | Eager + `fetchpriority="high"`. Use once per page. |
| `data-aspect="16/9"` | Reserves wrapper aspect ratio (default `4/5`). |
| `data-variant` | `portrait` / `landscape` / `wide` / `square` / `cinema`. |
| `data-src` / `data-srcset` | Deferred — swapped 200 px before viewport. |
| `alt` | **Required.** Describe the image for screen readers and SEO. |
| `width` / `height` | Recommended on the `<img>` for fallback when JS is off. |

## Authoring rules

- **One `data-ivae-img="hero"` per page max** — usually the LCP image.
- **Always provide `alt`.** Decorative? Use `alt=""`. Never omit.
- Use `data-src`/`data-srcset` only when you want the loader to defer
  the request; otherwise plain `src` + `loading="lazy"` is enough.
- For session galleries default to `data-aspect="4/5"` — this is the
  IVAE house portrait crop.
- Filename ladder: `<slug>-<width>.<format>` at 480 / 960 / 1440 / 1920 widths.
