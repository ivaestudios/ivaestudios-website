#!/usr/bin/env python3
"""Build critical CSS for the homepage and inline it.

Concatenates the minimum CSS modules required for above-the-fold rendering
on `index.html` / `es/index.html`, runs a simple minifier, and writes the
result to `styles/_critical.min.css` for inspection. The HTML files are
edited separately to inline this content as a <style> block.

Modules included (per agent task spec):
  _tokens.css     — colors, fonts, spacing
  _fonts.css      — @font-face declarations (URL refs only — actual
                    font fetch is via <link rel="preload">)
  _base.css       — reset + body/h1/container styles
  _nav.css        — sticky nav initial state (drawer/mobile nav skipped)
  _home-hero.css  — the hero section styles

Target: ≤12 KB uncompressed minified.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "styles"

# Each entry: (filename, list of regex patterns to strip BEFORE minify).
# Patterns delete whole rule-blocks or @-rules that are not above-the-fold.
# Keep it surgical — when in doubt, leave it in.
CRITICAL_MODULES: list[tuple[str, list[str]]] = [
    (
        "_tokens.css",
        # Strip tokens that no critical module references. main.css reloads
        # the full _tokens.css async, so any below-the-fold consumer still
        # gets the full set. Audit done by grep'ing var(--*) refs across
        # _base / _fonts / _nav / _home-hero. Keep entries that ARE used
        # above the fold (e.g. --fs-1000-fluid, --max-w-prose, --space-9).
        [
            # Unused fluid scale steps.
            r"--fs-100-fluid:[^;]+;",
            r"--fs-200-fluid:[^;]+;",
            r"--fs-400-fluid:[^;]+;",
            r"--fs-500-fluid:[^;]+;",
            r"--fs-700-fluid:[^;]+;",
            r"--fs-900-fluid:[^;]+;",
            r"--fs-1100-fluid:[^;]+;",
            r"--fs-1200-fluid:[^;]+;",
            # Unused static scale steps (300/400/500/700 ARE used).
            r"--fs-100:[^;]+;",
            r"--fs-200:[^;]+;",
            r"--fs-600:[^;]+;",
            r"--fs-800:[^;]+;",
            r"--fs-900:[^;]+;",
            r"--fs-1000:[^;]+;",
            r"--fs-1100:[^;]+;",
            r"--fs-1200:[^;]+;",
            # Functional aliases not referenced above the fold.
            r"--surface:[^;]+;",
            r"--surface-alt:[^;]+;",
            r"--text-muted:[^;]+;",
            r"--text-soft:[^;]+;",
            r"--border:[^;]+;",
            r"--border-strong:[^;]+;",
            r"--accent:[^;]+;",
            r"--accent-soft:[^;]+;",
            r"--danger:[^;]+;",
            r"--success:[^;]+;",
            # Overlay scrims (hero uses inline rgba; nav uses literal rgb).
            r"--overlay-(?:black|navy)-(?:10|25|50|75):[^;]+;",
            # Spacing steps not referenced above the fold.
            r"--space-0:[^;]+;",
            r"--space-1:[^;]+;",
            r"--space-3:[^;]+;",
            r"--space-8:[^;]+;",
            r"--space-10:[^;]+;",
            r"--space-11:[^;]+;",
            # Radius/shadows beyond what nav/hero need.
            r"--r-0:[^;]+;",
            r"--r-1:[^;]+;",
            r"--r-2:[^;]+;",
            r"--r-pill:[^;]+;",
            r"--shadow-1:[^;]+;",
            r"--shadow-2:[^;]+;",
            r"--shadow-focus:[^;]+;",
            # Z-index aliases beyond nav.
            r"--z-base:[^;]+;",
            r"--z-overlay:[^;]+;",
            r"--z-modal:[^;]+;",
            r"--z-toast:[^;]+;",
            # Easing/duration aliases not referenced above the fold.
            r"--ease-emphasis:[^;]+;",
            r"--dur-fast:[^;]+;",
            r"--dur-base:[^;]+;",
            r"--dur-slow:[^;]+;",
            r"--dur-cinematic:[^;]+;",
            # Letter-spacing variants beyond --ls-tight.
            r"--ls-normal:[^;]+;",
            r"--ls-wide:[^;]+;",
            r"--ls-eyebrow:[^;]+;",
            # Line-height variants not referenced above the fold.
            r"--lh-snug:[^;]+;",
            # Font-weight aliases (rules use literal 400/500/600).
            r"--fw-regular:[^;]+;",
            r"--fw-medium:[^;]+;",
            r"--fw-semi:[^;]+;",
        ],
    ),
    (
        "_fonts.css",
        [
            # Drop the latin-ext @font-face blocks. Latin only is enough
            # for the hero copy (EN/ES headlines fit in the latin subset);
            # latin-ext stays in main.css and loads async for special chars.
            r"@font-face\s*\{[^}]*latin-ext[^}]*\}",
            # Drop italic faces (DM Serif Display Italic + Bodoni Moda).
            # The hero <em> uses italic, but font-display: swap means the
            # browser renders the regular face first — italic arrives via
            # async main.css before users notice. Saves ~3 KB.
            r"@font-face\s*\{[^}]*Bodoni Moda[^}]*\}",
            r"@font-face\s*\{[^}]*DMSerifDisplay-Italic[^}]*\}",
        ],
    ),
    (
        "_base.css",
        [
            # @media print is never above the fold.
            r"@media print\s*\{(?:[^{}]|\{[^{}]*\})*\}",
            # Drop-cap is used in long-form prose only.
            r"\.dropcap[^{]*\{[^}]*\}",
            # Spanish-aware quote markers — small, cosmetic, can wait.
            r"\[lang=\"es\"\][^{]*\{[^}]*\}",
        ],
    ),
    (
        "_nav.css",
        [
            # The mobile drawer + backdrop are hidden until the user taps the
            # toggle — they render below the fold. Defer to async main.css.
            # Strip the `html.nav-drawer-open` body-lock rule first, so its
            # selector (which contains `.nav-drawer-open`) doesn't get
            # half-eaten by the `.nav-drawer` rule eraser below.
            r"html\.nav-drawer-open[^{]*\{[^{}]*\}",
            # Match `.nav-drawer` followed by `_`, `:`, `[`, ` `, or `,`
            # but NOT `-` (which would also catch `.nav-drawer-open` —
            # already handled above, but defensive).
            r"\.nav-drawer(?![-A-Za-z0-9])[^{]*\{[^}]*\}",
            r"\.nav-drawer__[^{]*\{[^}]*\}",
            r"\.nav-drawer-backdrop[^{]*\{[^}]*\}",
            # The `.is-scrolled` state is JS-toggled after first paint —
            # it can wait for async main.css to load.
            r"\.site-nav\.is-scrolled[^{]*\{[^}]*\}",
            r"\.site-nav\.is-scrolled\s+[^{]*\{[^}]*\}",
            # Skip-link styles ship inline elsewhere in the document head.
            r"\.site-nav__skip[^{]*\{[^}]*\}",
            # Reduced-motion overrides are not blocking first paint.
            r"@media \(prefers-reduced-motion: reduce\)\s*\{(?:[^{}]|\{[^{}]*\})*\}",
        ],
    ),
    (
        "_home-hero.css",
        [
            # The scroll-cue keyframes are a nice-to-have animation; the
            # cue itself is anchored to the bottom of the viewport, often
            # below the LCP element. Defer.
            r"@keyframes hero-scroll-pulse[^{]*\{(?:[^{}]|\{[^{}]*\})*\}",
            r"@media \(prefers-reduced-motion: reduce\)\s*\{(?:[^{}]|\{[^{}]*\})*\}",
        ],
    ),
]


def minify(css: str) -> str:
    """Cheap-and-cheerful CSS minifier: drop comments + collapse whitespace.

    Not as aggressive as a real minifier (we keep selectors readable enough
    to debug in DevTools) but strips ~30-40% of bytes for free.
    """
    # 1. Strip /* ... */ comments (non-greedy, multiline).
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    # 2. Collapse whitespace runs to a single space.
    css = re.sub(r"\s+", " ", css)
    # 3. Trim whitespace around CSS punctuation that doesn't need it.
    css = re.sub(r"\s*([{};:,>])\s*", r"\1", css)
    # 4. Drop the final semicolon before each closing brace.
    css = re.sub(r";}", "}", css)
    # 5. Trim leading/trailing whitespace.
    return css.strip()


def build() -> str:
    chunks: list[str] = []
    for name, strip_patterns in CRITICAL_MODULES:
        text = (STYLES / name).read_text(encoding="utf-8")
        for pattern in strip_patterns:
            # Use MULTILINE+DOTALL so `.` and `[^{]` match across lines, but
            # the resulting regex is a "rule-block eraser" — it deletes
            # whole rules, never partial CSS.
            text = re.sub(pattern, "", text, flags=re.DOTALL)
        chunks.append(f"/* {name} */\n{text}")
    return "\n".join(chunks)


def rebase_font_urls(css: str) -> str:
    """Rewrite `./fonts/...` to `/styles/fonts/...`.

    Inside `_fonts.css` the URLs are relative to that file (so the browser
    resolves them against `/styles/main.css`). When we inline this CSS into
    an HTML document at `/` or `/es/`, the same URLs resolve relative to
    the document — which 404s. Switching to root-absolute paths makes the
    inline copy work from any document URL.
    """
    return re.sub(r"url\(['\"]?\./fonts/", "url('/styles/fonts/", css)


def main() -> int:
    raw = build()
    raw = rebase_font_urls(raw)
    minified = minify(raw)
    out_path = STYLES / "_critical.min.css"
    out_path.write_text(minified + "\n", encoding="utf-8")
    raw_kb = len(raw.encode("utf-8")) / 1024
    min_kb = len(minified.encode("utf-8")) / 1024
    print(f"raw:       {raw_kb:6.2f} KB")
    print(f"minified:  {min_kb:6.2f} KB  →  {out_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
