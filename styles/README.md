# `styles/` — CSS architecture for redesign-2026

This folder holds every stylesheet shipped to the browser. The brand spec
lives one level up at [`../BRAND.md`](../BRAND.md) — read §13 before adding
or reordering anything here.

---

## The module convention

```
styles/
├── main.css            orchestrator — only @imports, no rules
├── _tokens.css         design tokens (colors, fonts, spacing, motion)
├── _fonts.css          @font-face declarations + preloads
├── _base.css           reset, html/body, focus, smooth scroll
├── _logo.css           logo SVG sizing/colors
├── _nav.css            site navigation
├── _footer.css         site footer
├── _buttons.css        button system
├── _forms.css          input system
├── _image.css          image component
├── _animations.css     reveals, fade-ups, transitions
├── _legacy.css         pre-redesign rules (shrinks to 0 by end of Oleada 3)
├── _<page>.css         page-level rules (added in Oleadas 2-3)
├── blog.css            blog-specific (refactored in Oleada 4)
├── print.css           standalone print stylesheet
└── README.md           this file
```

**Naming rules**

- Modules consumed by `main.css` start with an underscore (`_tokens.css`).
  This keeps them visually grouped and signals "do not link directly."
- A page module is named after its primary HTML file (`index.html` →
  `_home.css`, `about.html` → `_about.css`).
- Existing un-prefixed files (`blog.css`, `print.css`) are linked
  directly from HTML and are NOT imported by `main.css`.

**Import order in `main.css`** — load-order-significant, top to bottom:

1. `_tokens.css` — every other module reads from it.
2. `_fonts.css` — register faces before anything uses them.
3. `_base.css` — element defaults.
4. `_logo.css` — atomic visual primitive.
5. Components: `_buttons.css`, `_forms.css`, `_image.css`,
   `_animations.css`, `_nav.css`, `_footer.css`.
6. Pages: `_home.css`, `_about.css`, etc. (Oleadas 2-3).
7. `_legacy.css` — last, so unmigrated rules still cascade in.

Adding a new module out of order will break the cascade. Don't do it.

---

## The migration story

The site shipped with a single ~3 000-line `main.css`. We're
decomposing it into modular sheets without breaking any unmigrated
page in the meantime.

1. **Oleada 1** (now): the existing `main.css` was renamed to
   `_legacy.css` and a slim orchestrator took its place. Foundation
   modules (tokens, fonts, base, logo, nav, footer, buttons, forms,
   image, animations) land alongside it. Visual output is identical
   for every unmigrated page because `_legacy.css` is imported last.
2. **Oleadas 2-3**: each page gets a `_<page>.css` module. As rules
   move out of `_legacy.css` and into the page module, we delete them
   from `_legacy.css`.
3. **End of Oleada 3**: `_legacy.css` is empty (or close to it) and
   the `@import "_legacy.css"` line at the bottom of `main.css` is
   removed.

**The goal: `_legacy.css` shrinks to zero lines.** Treat anything in it
as already-deprecated.

---

## Adding a new page module

1. Create `styles/_<page>.css`. Use only tokens for colors (no raw
   hex) and respect the import-order discipline above.
2. Open `main.css` and add `@import "_<page>.css";` under the
   `── Pages ──` section, in roughly the order pages are migrated.
3. In `_legacy.css`, delete the rules now owned by the page module.
4. Visually diff the page (preview deploy) before merging.

---

## Where to find things

- **Brand spec** (palette, type, voice, dos/don'ts):
  [`../BRAND.md`](../BRAND.md). §3 = colors, §5 = typography,
  §13 = this module convention.
- **Self-hosted fonts**: see [`fonts/README.md`](fonts/README.md)
  (created by Agent 02).
- **Style notes** (formatting, property order, color discipline):
  [`.eslintrc.css.md`](.eslintrc.css.md).

---

## File-size budget targets

These are guidance, not gates. If a module blows past its target,
that's a signal to split it, not to bend the rule.

| Module             | Target (kB, uncompressed) |
|--------------------|---------------------------|
| `_tokens.css`      | ≤ 4                        |
| `_fonts.css`       | ≤ 2                        |
| `_base.css`        | ≤ 4                        |
| `_logo.css`        | ≤ 2                        |
| `_nav.css`         | ≤ 6                        |
| `_footer.css`      | ≤ 4                        |
| `_buttons.css`     | ≤ 5                        |
| `_forms.css`       | ≤ 6                        |
| `_image.css`       | ≤ 4                        |
| `_animations.css`  | ≤ 4                        |
| `_<page>.css`      | ≤ 12 each                  |
| `print.css`        | ≤ 2                        |
| `main.css`         | ≤ 2 (it's just imports)    |

Total budget for the orchestrator + foundations + components: **≤ 45 kB
uncompressed**. Aim well under that.
