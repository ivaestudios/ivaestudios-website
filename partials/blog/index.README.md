# Blog index — Journal partial reference

Owner: Agent 13 (Oleada 3)
Pairs with: `/blog.html`, `/es/blog.html`, `styles/_blog-index.css`,
`js/blog-filter.js`.

The Journal index is a magazine-style, hardcoded layout. Posts are not
generated from a database — every entry is hand-listed in
`blog.html` and `es/blog.html`. This file is the convention for adding,
removing, or recategorizing entries.

---

## 1. Section anatomy

Order is intentional and editorial:

1. `section--page-hero section--page-hero--journal`
   Masthead: eyebrow + display headline + lede.
2. `blog-featured`
   One cover story on a deep-atlantic ground. Full-width image, large headline.
3. `blog-picks`
   Editor's picks: 4 entries in a 2×2 grid on the resort-white ground.
4. `blog-archive`
   28 hardcoded entries as a list, with a category filter button group
   above and `aria-live` count for screen readers.
5. `section--final-cta`
   Reused from `_home-final-cta.css` — booking CTA.

---

## 2. Categories — canonical list (10)

Filter buttons map to these `data-category` tokens, in this order:

| Filter token | EN label    | ES label     |
|--------------|-------------|--------------|
| `*`          | All         | Todo         |
| `locations`  | Locations   | Locaciones   |
| `couples`    | Couples     | Parejas      |
| `family`     | Family      | Familia      |
| `weddings`   | Weddings    | Bodas        |
| `maternity`  | Maternity   | Maternidad   |
| `cenote`     | Cenote      | Cenote       |
| `yacht`      | Yacht       | Yate         |
| `outfit`     | Outfit      | Vestuario    |
| `planning`   | Planning    | Planeación   |
| `resorts`    | Resorts     | Resorts      |

Tokens are stable English keys so the filter JS works the same in both
locales. Only the visible button label changes language.

---

## 3. Categorization rules

Pick the **single dominant** category for the visible eyebrow above the
title. Multi-category items use a space-separated list in
`data-category` so the filter matches them under more than one token.

Rules of thumb:

- A **session type** (engagement, maternity, family, wedding, etc.)
  always wins over generic "Planning" — the eyebrow tells the reader
  *what kind of shoot this is*.
- "Planning" is reserved for buyer guides, comparisons, golden-hour
  field notes, choosing-a-photographer pieces — content that helps a
  reader plan the booking, not the session.
- "Locations" is for destination-level guides (Tulum, Los Cabos,
  Riviera Maya overview, Cancún vs Riviera Maya). City-specific
  *session* posts are categorized by session type, not by location.
- "Cenote" overlaps with Locations — apply both tokens when the
  post is a cenote-specific session brief.
- "Resorts" is reserved for resort-property guides (best-resorts,
  all-inclusive). A wedding *at* a Cancún resort is still "Weddings".
- "Yacht" is a session medium, like Cenote — use it for marina/boat
  sessions only.
- "Outfit" is reserved for the styling pillar (what to wear). Wedding
  attire posts can carry both `weddings` and `outfit`.

When in doubt, prefer the eyebrow that the IVAE reader expects given
the title.

---

## 4. Featured + Picks selection

The Featured story and the four Editor's Picks are chosen editorially
each season. As of v1 (Mayo 2026):

| Slot       | EN slug                               | ES slug                            |
|------------|---------------------------------------|------------------------------------|
| Featured   | `best-photo-locations-riviera-maya`   | `mejores-locaciones-foto-riviera-maya` |
| Pick 1     | `best-resorts-cancun-photography`     | `mejores-resorts-fotografia-cancun` |
| Pick 2     | `cenote-underwater-photoshoot-tulum`  | `sesion-cenote-submarina-tulum`    |
| Pick 3     | `golden-hour-photography-mexico`      | `fotografia-hora-dorada-mexico`    |
| Pick 4     | `what-to-wear-beach-photos-mexico`    | `que-ponerte-fotos-playa-mexico`   |

Rotate at most once per season. Editor picks should never overlap with
the Featured cover.

---

## 5. Adding a new post — checklist

1. Author the post HTML at `/post-<slug>.html` (EN) and
   `/es/blog/<spanish-slug>.html` (ES).
2. Add a 301 / 200 redirect line in `_redirects` for the EN clean URL
   `/blog/<slug>` → `/post-<slug>` (200 rewrite). Mirror the canonical
   ES rewrite if needed (ES already lives at `/es/blog/<slug>` natively).
3. Append a new `<li class="archive-item">` block in **both**
   `blog.html` and `es/blog.html`, immediately before the closing
   `</ul>` of `.archive-list`. Use:
   ```html
   <li class="archive-item" data-category="<token> [<second-token>]">
     <a href="/blog/<slug>"><!-- or /es/blog/<slug> -->
       <p class="eyebrow archive-item__cat">Category Label</p>
       <h3 class="archive-item__title">Editorial title.</h3>
       <p class="archive-item__date">Region · Format</p>
     </a>
   </li>
   ```
4. Update the `numberOfItems` and append the post to the
   `mainEntity.itemListElement` array inside the `Blog` JSON-LD block
   in **both** index files.
5. Update the `eyebrow` count text: `All entries · NN`
   (and ES `Todas las entradas · NN`).
6. If the new post should appear as Featured or Pick, demote the
   replaced entry back into the archive list and rotate the cover
   markup in section 02 / 03.
7. Append the post URL to `sitemap.xml` (Agent 30 owns).

---

## 6. Quality bar

- **No JS = all entries visible.** The filter is progressive enhancement
  only. Removing `js/blog-filter.js` must not hide any entry.
- **AA contrast:** Atlantic Navy on Resort White (≈14.7:1) and Resort
  White on Deep Atlantic (≈16:1). Editorial Gold is decorative only.
- **Reduced motion:** all transforms and `padding-inline-start` shifts
  on `.archive-item > a:hover` are gated by
  `@media (prefers-reduced-motion: reduce)`.
- **28 entries hardcoded** in both EN and ES. Mismatched counts will
  break the schema.

---

## 7. Why hardcoded?

The site is static HTML on Cloudflare Pages — no build step, no MDX
pipeline. Hardcoding 28 entries keeps the index trivially auditable
in a PR diff and avoids a runtime fetch for the archive list, which
would defeat the no-JS guarantee.
