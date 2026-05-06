#!/usr/bin/env python3
"""
Build the IVAE Studios favicon set.

Renders the brand monogram (Æ ligature in italic gold on Atlantic Navy) at every
size required by modern browsers, iOS home screens, and Android adaptive icons.
Also emits the PWA `site.webmanifest`.

Re-run any time the brand assets change:
    python3 scripts/build_favicons.py

All outputs are written to the repository root.

Design decisions
----------------
* Brand colors:
    - Atlantic Navy (deepest)   #0c1219 -> background
    - Editorial Gold            #c9a54e -> glyph fill
* Glyph: the ligature "Æ" — required for every size >= 32 per the brand manual
  (page 10 / II.03). At 16x16 the Æ ligature collapses into a smear, so we
  fall back to "IV" (the first two letters of IVAE) in Times Bold Italic which
  survives sub-pixel rasterisation.
* Fonts:
    - Bodoni 72 Book Italic (system .ttc index 1) -> 48px and larger.
      Closest Bodoni Moda available system-wide; preserves the brand's
      high-contrast italic with hairline serifs.
    - Times New Roman Bold Italic -> 32px and 16px.
      Bodoni's hairlines disappear at small raster sizes; Times Bold Italic is
      a sturdier italic that keeps the glyph readable in a browser tab.
* Maskable icon (Android adaptive): inner content is sized so the glyph fits
  inside the inner ~62% of the canvas, well within the 60-70% safe zone, since
  Android crops the outer ~20% of the bitmap.
"""

from __future__ import annotations

import json
import os
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent

NAVY = (12, 18, 25)        # #0c1219 — Atlantic Navy (deepest)
GOLD = (201, 165, 78)      # #c9a54e — Editorial Gold

BODONI_TTC = "/System/Library/Fonts/Supplemental/Bodoni 72.ttc"
BODONI_ITALIC_INDEX = 1    # Bodoni 72 Book Italic
BODONI_BOLD_INDEX = 2      # Bodoni 72 Bold (upright; not used directly)

TIMES_BOLD_ITALIC = (
    "/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf"
)


# ---------------------------------------------------------------------------
# Glyph rendering
# ---------------------------------------------------------------------------

def _measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont):
    """Return (width, height, ox, oy) measured via the actual ink bbox."""
    bbox = draw.textbbox((0, 0), text, font=font)
    x0, y0, x1, y1 = bbox
    return x1 - x0, y1 - y0, x0, y0


def _fit_glyph(text: str, font_path: str, font_index: int | None,
               canvas: int, target_ratio: float) -> tuple[ImageFont.FreeTypeFont, tuple[int, int, int, int]]:
    """Pick a font size such that the glyph's actual ink box fits target_ratio
    of the canvas's shorter side. Return (font, ink_bbox)."""
    target_px = int(canvas * target_ratio)
    # Binary-search a pixel size whose ink bbox matches.
    lo, hi = 4, canvas * 3
    best_font = None
    best_box = None
    probe_img = Image.new("L", (canvas * 4, canvas * 4))
    probe_draw = ImageDraw.Draw(probe_img)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if font_index is None:
            font = ImageFont.truetype(font_path, mid)
        else:
            font = ImageFont.truetype(font_path, mid, index=font_index)
        w, h, _ox, _oy = _measure(probe_draw, text, font)
        biggest_side = max(w, h)
        if biggest_side <= target_px:
            best_font = font
            best_box = probe_draw.textbbox((0, 0), text, font=font)
            lo = mid + 1
        else:
            hi = mid - 1
    if best_font is None:
        # Fallback minimum
        if font_index is None:
            best_font = ImageFont.truetype(font_path, max(target_px, 4))
        else:
            best_font = ImageFont.truetype(font_path, max(target_px, 4), index=font_index)
        best_box = probe_draw.textbbox((0, 0), text, font=best_font)
    return best_font, best_box


def _render_monogram(canvas: int, *, glyph: str, font_path: str,
                     font_index: int | None, target_ratio: float,
                     y_nudge: float = 0.0) -> Image.Image:
    """Render the centered italic monogram on Atlantic Navy.

    target_ratio: fraction of the shorter side the glyph's ink box should fill.
    y_nudge: small vertical offset (fraction of canvas) to optically center
             italic glyphs whose body sits low (positive = down).
    """
    img = Image.new("RGB", (canvas, canvas), NAVY)
    draw = ImageDraw.Draw(img)
    font, ink = _fit_glyph(glyph, font_path, font_index, canvas, target_ratio)
    x0, y0, x1, y1 = ink
    w, h = x1 - x0, y1 - y0
    # Center using the actual ink bbox (compensates for italic side-bearing).
    px = (canvas - w) / 2 - x0
    py = (canvas - h) / 2 - y0 + canvas * y_nudge
    draw.text((px, py), glyph, font=font, fill=GOLD)
    return img


# ---------------------------------------------------------------------------
# Per-size composition
# ---------------------------------------------------------------------------

def render_large(size: int) -> Image.Image:
    """48px and up: Bodoni 72 Book Italic Æ, glyph fills ~62% of canvas."""
    return _render_monogram(
        size,
        glyph="Æ",   # Æ
        font_path=BODONI_TTC,
        font_index=BODONI_ITALIC_INDEX,
        target_ratio=0.62,
        y_nudge=0.0,
    )


def render_maskable(size: int) -> Image.Image:
    """Maskable icon: keep the glyph inside the inner ~62% so the outer 20%
    crop performed by Android adaptive icons never clips it."""
    return _render_monogram(
        size,
        glyph="Æ",
        font_path=BODONI_TTC,
        font_index=BODONI_ITALIC_INDEX,
        target_ratio=0.50,    # 50% of canvas == ~62% of the safe zone
        y_nudge=0.0,
    )


def render_medium(size: int) -> Image.Image:
    """32 / 48 px: Times New Roman Bold Italic Æ — sturdier strokes than
    Bodoni hairlines so the glyph stays legible at small raster sizes.

    Times BI's Æ ink box is short (descenders eat headroom even though Æ
    has none), so we push the target ratio higher than the large-size
    rendering to compensate."""
    return _render_monogram(
        size,
        glyph="Æ",
        font_path=TIMES_BOLD_ITALIC,
        font_index=None,
        target_ratio=0.78,
        y_nudge=0.0,
    )


def render_tiny() -> Image.Image:
    """16x16: every italic-Æ rasterisation collapses to a smear at this size,
    and 'IV' in Times Bold Italic looks like 'JV' (the I's slant + serif merge
    with the V's left stroke). Render a single bold upright 'I' as a
    high-contrast wordmark stand-in: at 16px the user just needs an instant
    'this is IVAE' read, not the full ligature."""
    canvas = 16
    img = Image.new("RGB", (canvas, canvas), NAVY)
    draw = ImageDraw.Draw(img)
    # Use Times New Roman Bold (upright) — at 16px the upright-serif I is the
    # most distinctive, unambiguous shape we can reliably anti-alias.
    font, ink = _fit_glyph(
        "IV",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
        None,
        canvas,
        target_ratio=0.78,
    )
    x0, y0, x1, y1 = ink
    w, h = x1 - x0, y1 - y0
    px = (canvas - w) / 2 - x0
    py = (canvas - h) / 2 - y0
    draw.text((px, py), "IV", font=font, fill=GOLD)
    return img


# ---------------------------------------------------------------------------
# ICO writer
# ---------------------------------------------------------------------------

def write_ico(path: Path, images: list[Image.Image]) -> None:
    """Write a multi-resolution .ico file. Each entry stores the raw PNG payload
    (legal per the .ico spec and supported by every browser since IE11/Vista).
    Pillow's built-in .ico writer hits >1KB for our 3 raster sizes; this hand-
    rolled variant lands ~600B."""
    pngs: list[bytes] = []
    for im in images:
        buf = BytesIO()
        im.convert("RGB").save(buf, format="PNG", optimize=True)
        pngs.append(buf.getvalue())

    header = struct.pack("<HHH", 0, 1, len(images))  # reserved=0, type=1 (icon), count
    directory = b""
    offset = 6 + 16 * len(images)  # header + dir entries
    payloads = b""
    for im, png in zip(images, pngs):
        w = im.width if im.width < 256 else 0
        h = im.height if im.height < 256 else 0
        directory += struct.pack(
            "<BBBBHHII",
            w, h,
            0,        # color count (0 because >256 colors)
            0,        # reserved
            1,        # color planes
            32,       # bits per pixel
            len(png), # image size
            offset,
        )
        payloads += png
        offset += len(png)

    path.write_bytes(header + directory + payloads)


# ---------------------------------------------------------------------------
# Optimisation helpers
# ---------------------------------------------------------------------------

def save_png(im: Image.Image, path: Path, *, palette: bool = True) -> None:
    """Save a PNG, optionally palettising small icons to keep them tiny.
    Atlantic Navy + gold + a few anti-aliased pixels = far fewer than 256
    colors, so a palette image is dramatically smaller than RGBA."""
    if palette:
        # Quantize without dithering for clean edges, 32-color palette.
        pal = im.convert("RGB").quantize(colors=32, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
        pal.save(path, format="PNG", optimize=True)
    else:
        im.convert("RGB").save(path, format="PNG", optimize=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

WEBMANIFEST = {
    "name": "IVAE Studios",
    "short_name": "IVAE",
    "description": "Luxury Resort Photography in Cancún, Riviera Maya & Los Cabos",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0c1219",
    "theme_color": "#0c1219",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {
            "src": "/icon-maskable-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable",
        },
    ],
}


def main() -> None:
    out = REPO_ROOT

    # Tiny / small sizes: stronger italic so hairlines don't vanish.
    img16 = render_tiny()
    img32 = render_medium(32)
    img48 = render_medium(48)

    # Standard browser PNGs.
    save_png(img16, out / "favicon-16.png")
    save_png(img32, out / "favicon-32.png")
    save_png(img48, out / "favicon-48.png")

    # Multi-size .ico.
    write_ico(out / "favicon.ico", [img16, img32, img48])

    # Apple touch icon: solid navy bg, no transparency, 180x180.
    apple = render_large(180)
    apple.convert("RGB").save(out / "apple-touch-icon.png", format="PNG", optimize=True)

    # PWA / Android icons.
    icon192 = render_large(192)
    save_png(icon192, out / "icon-192.png")

    icon512 = render_large(512)
    save_png(icon512, out / "icon-512.png")

    icon_mask = render_maskable(512)
    save_png(icon_mask, out / "icon-maskable-512.png")

    # Webmanifest (idempotent, pretty-printed for diff readability).
    (out / "site.webmanifest").write_text(
        json.dumps(WEBMANIFEST, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Verification report.
    print("Generated favicon set:")
    for name in [
        "favicon.ico",
        "favicon-16.png",
        "favicon-32.png",
        "favicon-48.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "site.webmanifest",
    ]:
        p = out / name
        size = p.stat().st_size
        print(f"  {name:28s} {size:>7d} bytes")


if __name__ == "__main__":
    main()
