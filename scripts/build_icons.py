#!/usr/bin/env python3
"""
build_icons.py — IVAE Studios favicon + PWA + Open Graph generator.

Run:
    python3 scripts/build_icons.py

Requires Pillow (already on macOS via `pip install pillow` or system Python).
The script is fully re-runnable — every output is rewritten on each run, so
future logo or brand-color tweaks regenerate the whole set in one command.

Outputs (relative to repo root)
  images/icons/favicon.ico            multi-size .ico (16/24/32/48)
  images/icons/favicon-16.png         16x16  transparent, gold Æ
  images/icons/favicon-32.png         32x32  transparent, gold Æ
  images/icons/favicon-48.png         48x48  transparent, gold Æ
  images/icons/apple-touch-icon.png   180x180 navy bg, gold Æ
  images/icons/icon-192.png           192x192 navy bg, gold Æ
  images/icons/icon-512.png           512x512 navy bg, gold Æ
  images/icons/icon-maskable-512.png  512x512 navy bg, gold Æ (50% safe-zone)
  images/og-default.jpg               1200x630 navy bg, IVAE STUDIOS wordmark
  images/twitter-card.jpg             1200x675 navy bg, IVAE STUDIOS wordmark
  favicon.ico                         copy of images/icons/favicon.ico (root)

Brand reference (BRAND.md §3 + §4)
  --atlantic-navy:   #1A2433
  --resort-white:    #F9F8F7
  --warm-sand:       #E6DCCF
  --editorial-gold:  #C4A35A
  --deep-atlantic:   #0F1620
  Monogram: Æ in Bodoni Moda Italic (substitute: Bodoni 72 / Didot / Times Italic)
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ----------------------------------------------------------------------------
# Brand palette (do not approximate — see BRAND.md §3)
# ----------------------------------------------------------------------------
ATLANTIC_NAVY  = (0x1A, 0x24, 0x33)   # #1A2433 — solid bg for app icons
DEEP_ATLANTIC  = (0x0F, 0x16, 0x20)   # #0F1620 — covers, OG bg
RESORT_WHITE   = (0xF9, 0xF8, 0xF7)   # #F9F8F7 — wordmark on dark
WARM_SAND      = (0xE6, 0xDC, 0xCF)   # #E6DCCF — secondary
EDITORIAL_GOLD = (0xC4, 0xA3, 0x5A)   # #C4A35A — Æ + accents

# ----------------------------------------------------------------------------
# Paths (script lives in <repo>/scripts/, outputs go to <repo>/images/...)
# ----------------------------------------------------------------------------
REPO_ROOT     = Path(__file__).resolve().parent.parent
IMAGES_DIR    = REPO_ROOT / "images"
ICONS_DIR     = IMAGES_DIR / "icons"
ROOT_FAVICON  = REPO_ROOT / "favicon.ico"

ICONS_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# ----------------------------------------------------------------------------
# Font discovery — favours Bodoni Moda → Bodoni 72 → Didot → Times Italic.
# Returns (path, italic_flag). italic_flag tells us whether to fake-slant.
# ----------------------------------------------------------------------------
SYSTEM_FONT_DIRS = [
    "/System/Library/Fonts/Supplemental",
    "/System/Library/Fonts",
    "/Library/Fonts",
    str(Path.home() / "Library" / "Fonts"),
]

# Preference order for the Æ monogram (italic serif).
SERIF_ITALIC_CANDIDATES = [
    "Bodoni Moda Italic.ttf",
    "Bodoni 72.ttc",            # collection — index handled below
    "Didot.ttc",                # collection — italic at index 2 typically
    "Times New Roman Italic.ttf",
    "Georgia Italic.ttf",
    "NewYorkItalic.ttf",
    "Times.ttc",
]

# Sans-serif for STUDIOS / accent line (Inter substitute).
SANS_CANDIDATES = [
    "HelveticaNeue.ttc",
    "Helvetica.ttc",
    "Arial.ttf",
]

# Display serif for IVAE STUDIOS in the OG card (DM Serif Display substitute).
SERIF_DISPLAY_CANDIDATES = [
    "Times New Roman Bold.ttf",
    "Georgia Bold.ttf",
    "Didot.ttc",
    "Times.ttc",
]


def _find_font(candidates: list[str]) -> str | None:
    """Return the first font path that exists on disk, else None."""
    for name in candidates:
        for d in SYSTEM_FONT_DIRS:
            p = Path(d) / name
            if p.exists():
                return str(p)
    return None


SERIF_ITALIC_PATH  = _find_font(SERIF_ITALIC_CANDIDATES)
SANS_PATH          = _find_font(SANS_CANDIDATES)
SERIF_DISPLAY_PATH = _find_font(SERIF_DISPLAY_CANDIDATES)


def _load(path: str | None, size: int, fallback_index: int = 0) -> ImageFont.FreeTypeFont:
    """Load a TTF/TTC at given pixel size; for .ttc try multiple indices."""
    if not path:
        return ImageFont.load_default()
    try:
        if path.endswith(".ttc"):
            # .ttc is a font collection; try index 0..6 to find an italic.
            for idx in (fallback_index, 0, 1, 2, 3, 4, 5):
                try:
                    return ImageFont.truetype(path, size, index=idx)
                except OSError:
                    continue
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


# ----------------------------------------------------------------------------
# Drawing primitives
# ----------------------------------------------------------------------------
def _measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int, int, int]:
    """Return (left, top, width, height) for the rendered glyph."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]


def _rounded_square(size: int, radius: int, fill) -> Image.Image:
    """Solid rounded square — used as the iOS / Android icon background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=fill)
    return img


def _draw_monogram_centered(canvas: Image.Image, glyph: str, font_path: str | None,
                             color: tuple, occupy: float = 0.62, italic_skew: bool = False) -> None:
    """Paint Æ centred on `canvas`. occupy = fraction of canvas height."""
    W, H = canvas.size
    # Search for the right font size that makes the glyph occupy the target.
    target_h = int(H * occupy)
    size = target_h
    # Tighten with one binary-style refinement loop.
    for _ in range(8):
        font = _load(font_path, size)
        d = ImageDraw.Draw(canvas)
        bbox = d.textbbox((0, 0), glyph, font=font)
        glyph_h = bbox[3] - bbox[1]
        if glyph_h == 0:
            break
        ratio = target_h / glyph_h
        if 0.97 <= ratio <= 1.03:
            break
        size = max(8, int(size * ratio))
    font = _load(font_path, size)

    # Render to a separate transparent buffer so we can fake-skew if needed.
    pad = max(8, size // 4)
    buf_w = W + pad * 2
    buf_h = H + pad * 2
    buf = Image.new("RGBA", (buf_w, buf_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(buf)
    bx, by, gw, gh = _measure(bd, glyph, font)
    # Centre inside the buffer.
    px = (buf_w - gw) // 2 - bx
    py = (buf_h - gh) // 2 - by
    bd.text((px, py), glyph, font=font, fill=color + (255,))

    # If chosen font isn't actually italic, fake a slant (Bodoni 72 OS/upright fallback).
    if italic_skew:
        # PIL transform: shear in x by ~12° (skew = tan(12°) ≈ 0.21).
        shear = 0.18
        new_w = buf_w + int(buf_h * abs(shear))
        sheared = Image.new("RGBA", (new_w, buf_h), (0, 0, 0, 0))
        sheared.paste(buf.transform(
            (new_w, buf_h), Image.AFFINE,
            (1, -shear, shear * buf_h * 0.5, 0, 1, 0),
            resample=Image.BICUBIC,
        ), (0, 0))
        buf = sheared

    # At very small sizes hairlines disappear — slightly thicken with a max filter.
    if min(W, H) <= 32:
        buf = buf.filter(ImageFilter.MaxFilter(3))

    # Centre buf on canvas.
    bw, bh = buf.size
    cx = (W - bw) // 2
    cy = (H - bh) // 2
    canvas.alpha_composite(buf, (cx, cy))


def _is_italic_font(path: str | None) -> bool:
    if not path:
        return False
    name = path.lower()
    return "italic" in name or "didot" in name


# ----------------------------------------------------------------------------
# Favicon (transparent gold Æ) + iOS / Android tile (gold Æ on navy round-rect)
# ----------------------------------------------------------------------------
def build_favicon_pngs() -> dict[int, Path]:
    """Render transparent-background favicon PNGs at 16, 24, 32, 48."""
    out: dict[int, Path] = {}
    for size in (16, 24, 32, 48):
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        # Render at 4x then downsample for crisper edges.
        super_size = size * 4
        big = Image.new("RGBA", (super_size, super_size), (0, 0, 0, 0))
        _draw_monogram_centered(
            big,
            glyph="Æ",
            font_path=SERIF_ITALIC_PATH,
            color=EDITORIAL_GOLD,
            occupy=0.78,
            italic_skew=not _is_italic_font(SERIF_ITALIC_PATH),
        )
        canvas = big.resize((size, size), Image.LANCZOS)
        path = ICONS_DIR / f"favicon-{size}.png" if size in (16, 32, 48) else ICONS_DIR / f"_tmp-{size}.png"
        canvas.save(path, format="PNG", optimize=True)
        out[size] = path
    return out


def build_favicon_ico(pngs: dict[int, Path]) -> Path:
    """Bundle multi-size .ico from the rendered PNGs."""
    path = ICONS_DIR / "favicon.ico"
    base = Image.open(pngs[48]).convert("RGBA")
    sizes = [(s, s) for s in (16, 24, 32, 48)]
    base.save(path, format="ICO", sizes=sizes)
    # Clean temp PNGs (24 is intermediate; only 16/32/48 are kept).
    tmp = ICONS_DIR / "_tmp-24.png"
    if tmp.exists():
        tmp.unlink()
    return path


def build_app_tile(out: Path, size: int, occupy: float = 0.60, radius_frac: float = 0.22) -> Path:
    """Solid Atlantic Navy rounded square with the gold Æ centred."""
    radius = int(size * radius_frac)
    canvas = _rounded_square(size, radius, ATLANTIC_NAVY + (255,))
    _draw_monogram_centered(
        canvas,
        glyph="Æ",
        font_path=SERIF_ITALIC_PATH,
        color=EDITORIAL_GOLD,
        occupy=occupy,
        italic_skew=not _is_italic_font(SERIF_ITALIC_PATH),
    )
    # Apple flattens transparency aggressively → output without alpha.
    flat = Image.new("RGB", (size, size), ATLANTIC_NAVY)
    flat.paste(canvas, mask=canvas.split()[3])
    flat.save(out, format="PNG", optimize=True)
    return out


def build_maskable(out: Path, size: int = 512) -> Path:
    """Maskable PWA icon — full-bleed navy with the Æ at ~50% so circular crops never clip it."""
    canvas = Image.new("RGBA", (size, size), ATLANTIC_NAVY + (255,))
    _draw_monogram_centered(
        canvas,
        glyph="Æ",
        font_path=SERIF_ITALIC_PATH,
        color=EDITORIAL_GOLD,
        occupy=0.50,
        italic_skew=not _is_italic_font(SERIF_ITALIC_PATH),
    )
    flat = Image.new("RGB", (size, size), ATLANTIC_NAVY)
    flat.paste(canvas, mask=canvas.split()[3])
    flat.save(out, format="PNG", optimize=True)
    return out


# ----------------------------------------------------------------------------
# Open Graph / Twitter cards
# ----------------------------------------------------------------------------
def _draw_centered_text(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int,
                        font: ImageFont.FreeTypeFont, fill: tuple,
                        letter_spacing: int = 0) -> tuple[int, int, int, int]:
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = cx - w // 2 - bbox[0]
        y = cy - h // 2 - bbox[1]
        draw.text((x, y), text, font=font, fill=fill + (255,))
        return x, y, w, h
    # Manual letter-spaced render: measure each char, lay out one by one.
    widths = []
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=font)
        widths.append((ch, bb[2] - bb[0], bb[1], bb[3]))
    total = sum(w for _, w, _, _ in widths) + letter_spacing * (len(text) - 1)
    h_max = max(b - t for _, _, t, b in widths)
    x = cx - total // 2
    y = cy - h_max // 2
    for ch, w, _, _ in widths:
        draw.text((x, y), ch, font=font, fill=fill + (255,))
        x += w + letter_spacing
    return cx - total // 2, y, total, h_max


def build_social_card(out: Path, width: int, height: int, *, jpg_quality: int = 85) -> Path:
    """Generate a social-share card and save as JPEG ≤ 300KB.

    Composition (BRAND.md §4-5):
      - Background: deep-atlantic #0F1620
      - Top eyebrow: small gold italic "IVAE STUDIOS" (or omitted)
      - Center wordmark: "IVAE STUDIOS"  (DM Serif Display substitute)
                         "STUDIOS" letter-spaced 0.4em uppercase, Inter substitute
      - Below wordmark: italic gold accent line
                         "Luxury Resort Photography · Riviera Maya · Cancún · Los Cabos"
      - Hairline gold rule above the accent line, half-width.
    """
    canvas = Image.new("RGB", (width, height), DEEP_ATLANTIC)
    draw = ImageDraw.Draw(canvas)

    # Subtle vignette: slightly lighter centre via radial gradient (cheap version).
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for r in range(0, max(width, height), 80):
        alpha = max(0, 30 - r // 40)
        od.ellipse(
            (width // 2 - r, height // 2 - r // 2,
             width // 2 + r, height // 2 + r // 2),
            outline=(255, 255, 255, alpha),
        )
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    # --- typography sizes scale with width ---
    word_size  = int(width * 0.10)        # IVAE
    studios_sz = int(width * 0.035)       # STUDIOS (sans, letter-spaced)
    accent_sz  = int(width * 0.022)       # italic gold tagline
    eyebrow_sz = int(width * 0.014)       # tiny eyebrow

    word_font    = _load(SERIF_DISPLAY_PATH, word_size)
    studios_font = _load(SANS_PATH, studios_sz)
    accent_font  = _load(SERIF_ITALIC_PATH, accent_sz)
    eyebrow_font = _load(SANS_PATH, eyebrow_sz)

    cx = width // 2

    # Eyebrow (top, faint warm-sand — restraint).
    eyebrow_y = int(height * 0.18)
    _draw_centered_text(
        draw, "EST. 2018  ·  CANCÚN", cx, eyebrow_y,
        eyebrow_font, WARM_SAND, letter_spacing=int(eyebrow_sz * 0.40),
    )

    # IVAE wordmark (display serif, large).
    ivae_y = int(height * 0.40)
    _draw_centered_text(draw, "IVAE", cx, ivae_y, word_font, RESORT_WHITE)

    # STUDIOS (letter-spaced, beneath IVAE — single brand line).
    studios_y = int(height * 0.55)
    _draw_centered_text(
        draw, "STUDIOS", cx, studios_y, studios_font, RESORT_WHITE,
        letter_spacing=int(studios_sz * 0.40),
    )

    # Hairline gold rule.
    rule_y = int(height * 0.69)
    rule_half = int(width * 0.10)
    draw.line(
        [(cx - rule_half, rule_y), (cx + rule_half, rule_y)],
        fill=EDITORIAL_GOLD, width=max(1, int(height * 0.0025)),
    )

    # Accent tagline in italic gold.
    accent_y = int(height * 0.78)
    italic_skew = not _is_italic_font(SERIF_ITALIC_PATH)
    if italic_skew:
        # Render to a buffer, skew, paste — same pattern as the monogram.
        line = "Luxury Resort Photography  ·  Riviera Maya  ·  Cancún  ·  Los Cabos"
        bbox = draw.textbbox((0, 0), line, font=accent_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        buf = Image.new("RGBA", (tw + 80, th + 40), (0, 0, 0, 0))
        bd = ImageDraw.Draw(buf)
        bd.text((40 - bbox[0], 20 - bbox[1]), line, font=accent_font, fill=EDITORIAL_GOLD + (255,))
        shear = 0.18
        bw, bh = buf.size
        new_w = bw + int(bh * shear)
        sheared = Image.new("RGBA", (new_w, bh), (0, 0, 0, 0))
        sheared.paste(buf.transform(
            (new_w, bh), Image.AFFINE,
            (1, -shear, shear * bh * 0.5, 0, 1, 0),
            resample=Image.BICUBIC,
        ), (0, 0))
        sx = cx - new_w // 2
        sy = accent_y - bh // 2
        canvas.paste(sheared, (sx, sy), sheared)
    else:
        _draw_centered_text(
            draw,
            "Luxury Resort Photography  ·  Riviera Maya  ·  Cancún  ·  Los Cabos",
            cx, accent_y, accent_font, EDITORIAL_GOLD,
        )

    # Save with progressive JPEG, falling back to lower quality if >300KB.
    quality = jpg_quality
    while True:
        canvas.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
        if out.stat().st_size <= 300 * 1024 or quality <= 60:
            break
        quality -= 5
    return out


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------
def main() -> int:
    print("IVAE — building favicon + OG set")
    print(f"  serif italic font: {SERIF_ITALIC_PATH}")
    print(f"  sans-serif font:   {SANS_PATH}")
    print(f"  display serif:     {SERIF_DISPLAY_PATH}")

    # 1 — favicon family
    pngs = build_favicon_pngs()
    ico = build_favicon_ico(pngs)
    print(f"  + {ico.relative_to(REPO_ROOT)}")
    for s, p in pngs.items():
        if s in (16, 32, 48):
            print(f"  + {p.relative_to(REPO_ROOT)}")

    # 2 — iOS + Android tiles
    apple = build_app_tile(ICONS_DIR / "apple-touch-icon.png", 180, occupy=0.60)
    print(f"  + {apple.relative_to(REPO_ROOT)}")
    icon192 = build_app_tile(ICONS_DIR / "icon-192.png", 192, occupy=0.60)
    print(f"  + {icon192.relative_to(REPO_ROOT)}")
    icon512 = build_app_tile(ICONS_DIR / "icon-512.png", 512, occupy=0.60)
    print(f"  + {icon512.relative_to(REPO_ROOT)}")
    maskable = build_maskable(ICONS_DIR / "icon-maskable-512.png", 512)
    print(f"  + {maskable.relative_to(REPO_ROOT)}")

    # 3 — social cards
    og = build_social_card(IMAGES_DIR / "og-default.jpg", 1200, 630)
    print(f"  + {og.relative_to(REPO_ROOT)}  ({og.stat().st_size // 1024} KB)")
    tw = build_social_card(IMAGES_DIR / "twitter-card.jpg", 1200, 675)
    print(f"  + {tw.relative_to(REPO_ROOT)}  ({tw.stat().st_size // 1024} KB)")

    # 4 — root favicon (a copy is simpler than a symlink in checked-in trees).
    shutil.copyfile(ico, ROOT_FAVICON)
    print(f"  + {ROOT_FAVICON.relative_to(REPO_ROOT)}  (copy of icons/favicon.ico)")

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
