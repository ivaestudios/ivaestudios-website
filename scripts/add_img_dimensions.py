#!/usr/bin/env python3
"""
add_img_dimensions.py

Walks every *.html file under /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/
(excluding /scripts/, /data/, /node_modules/, /.github/) and injects explicit width/height
attributes on every <img> tag that is missing them.

Why:
  Without width/height, browsers reserve 0px for the image until it loads, causing
  Cumulative Layout Shift (CLS) — a Core Web Vitals fail.

Strategy:
  - Find every <img ... > tag (single- or multi-line).
  - Skip if it already has width= AND height= attributes.
  - Skip template-literal srcs (${...}) — values are filled by JS at runtime.
  - Skip imgs whose style="..." already declares width or height.
  - Skip imgs inside <noscript> blocks (less CLS-critical, and may be no-JS fallbacks).
  - Skip imgs inside <script type="application/ld+json"> (JSON-LD, not rendered).
  - For local file srcs (resolvable to /images/...): read the binary header (JPG/PNG/WebP/AVIF/GIF)
    via struct and extract the intrinsic pixel dimensions.
  - For non-local srcs (CDN / dynamic API): default to 1600x1067 (typical landscape) unless the
    src looks like an avatar/icon (then 80x80) or an SVG (then 24x24).
  - Inject width="W" height="H" immediately before the alt= attribute if present, else right
    after the last existing attribute (before the closing /> or >).
  - Never touch the src, alt, or loading attributes.

Run:  python3 scripts/add_img_dimensions.py
"""

import os
import re
import struct
import sys

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXCLUDE_DIRS = {"scripts", "data", "node_modules", ".github"}

DEFAULT_LANDSCAPE = (1600, 1067)  # generic IVAE photo aspect
DEFAULT_AVATAR = (80, 80)
DEFAULT_SVG = (24, 24)


# ---------------------------------------------------------------------------
# Image header parsing
# ---------------------------------------------------------------------------
def get_image_dimensions(filepath):
    """Return (width, height) of a local image file by reading its header, or None on failure.

    Supports JPG/JPEG, PNG, GIF, WebP (VP8/VP8L/VP8X), AVIF (ISO BMFF ispe box).
    """
    try:
        with open(filepath, "rb") as f:
            head = f.read(32)
            if len(head) < 24:
                return None

            # PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR
            if head[:8] == b"\x89PNG\r\n\x1a\n":
                # IHDR at byte 16: width (4 BE), height (4 BE)
                w, h = struct.unpack(">II", head[16:24])
                return (w, h)

            # GIF: GIF87a or GIF89a, then width/height little-endian
            if head[:6] in (b"GIF87a", b"GIF89a"):
                w, h = struct.unpack("<HH", head[6:10])
                return (w, h)

            # JPEG: FF D8 ... SOFn marker
            if head[:2] == b"\xff\xd8":
                return _jpeg_dimensions(filepath)

            # RIFF/WEBP
            if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
                return _webp_dimensions(filepath)

            # AVIF / HEIC use ISO BMFF: starts with size+ftyp
            if head[4:8] == b"ftyp":
                # Could be avif/heic — try ispe box scan
                return _isobmff_dimensions(filepath)

        return None
    except Exception:
        return None


def _jpeg_dimensions(filepath):
    """Scan JPEG SOFn marker for width/height."""
    try:
        with open(filepath, "rb") as f:
            f.read(2)  # skip SOI
            while True:
                byte = f.read(1)
                if not byte:
                    return None
                # marker prefix
                while byte != b"\xff":
                    byte = f.read(1)
                    if not byte:
                        return None
                # skip filler 0xFF bytes
                marker = f.read(1)
                while marker == b"\xff":
                    marker = f.read(1)
                if not marker:
                    return None
                m = marker[0]
                # SOF markers (excluding DHT/DAC/DRI/RST/SOI/EOI/SOS)
                if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                    seg = f.read(7)
                    if len(seg) < 7:
                        return None
                    # seg = length(2) precision(1) height(2) width(2)
                    h, w = struct.unpack(">HH", seg[3:7])
                    return (w, h)
                # other marker — skip its segment
                seg_len_b = f.read(2)
                if len(seg_len_b) < 2:
                    return None
                seg_len = struct.unpack(">H", seg_len_b)[0]
                if seg_len < 2:
                    return None
                f.seek(seg_len - 2, 1)
    except Exception:
        return None


def _webp_dimensions(filepath):
    """Parse WebP VP8 / VP8L / VP8X chunk for dimensions."""
    try:
        with open(filepath, "rb") as f:
            data = f.read(40)
            if len(data) < 30:
                return None
            chunk_fourcc = data[12:16]
            if chunk_fourcc == b"VP8 ":
                # Simple lossy: width/height at bytes 26,28 (14 bits each)
                w = struct.unpack("<H", data[26:28])[0] & 0x3FFF
                h = struct.unpack("<H", data[28:30])[0] & 0x3FFF
                return (w, h)
            if chunk_fourcc == b"VP8L":
                # Lossless: byte 21 starts the bitstream. After signature 0x2F:
                # 14 bits width-1, 14 bits height-1.
                b = data[21:26]
                if len(b) < 5 or b[0] != 0x2F:
                    return None
                bits = struct.unpack("<I", b[1:5])[0]
                w = (bits & 0x3FFF) + 1
                h = ((bits >> 14) & 0x3FFF) + 1
                return (w, h)
            if chunk_fourcc == b"VP8X":
                # Extended: canvas width-1 (3 bytes LE) at offset 24, height-1 at 27.
                w = data[24] | (data[25] << 8) | (data[26] << 16)
                h = data[27] | (data[28] << 8) | (data[29] << 16)
                return (w + 1, h + 1)
        return None
    except Exception:
        return None


def _isobmff_dimensions(filepath):
    """Find the first 'ispe' box (image spatial extents) in an AVIF/HEIC file."""
    try:
        with open(filepath, "rb") as f:
            data = f.read(65536)  # ispe usually within the first 64K
        idx = data.find(b"ispe")
        if idx < 0 or idx + 16 > len(data):
            return None
        # ispe box: 4 byte fullbox header (version+flags) then width(4) height(4) BE
        w, h = struct.unpack(">II", data[idx + 8:idx + 16])
        if w > 0 and h > 0:
            return (w, h)
        return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# HTML scanning
# ---------------------------------------------------------------------------
IMG_RE = re.compile(r"<img\b[^>]*?/?>", re.DOTALL | re.IGNORECASE)
ATTR_WIDTH_RE = re.compile(r"\bwidth\s*=", re.IGNORECASE)
ATTR_HEIGHT_RE = re.compile(r"\bheight\s*=", re.IGNORECASE)
SRC_RE = re.compile(r"""src\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
STYLE_DIM_RE = re.compile(
    r"""style\s*=\s*["'][^"']*(?:^|;|\s)\s*(?:width|height)\s*:""", re.IGNORECASE
)
ALT_RE = re.compile(r"""\balt\s*=\s*["'][^"']*["']""", re.IGNORECASE)
NOSCRIPT_RE = re.compile(r"<noscript\b[^>]*>(.*?)</noscript>", re.DOTALL | re.IGNORECASE)
JSONLD_RE = re.compile(
    r"""<script\b[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>""",
    re.DOTALL | re.IGNORECASE,
)


def is_template_src(src):
    """True if src contains a ${...} template literal — JS-filled at runtime."""
    return "${" in src


def is_dynamic_api_src(src):
    """True if src points to a dynamic gallery endpoint."""
    return src.startswith("/api/") or src.startswith("api/")


def looks_like_avatar(src, tag):
    s = (src + " " + tag).lower()
    return "avatar" in s or "/icons/" in s or "/icon/" in s


def looks_like_svg(src):
    return src.lower().endswith(".svg")


def resolve_local_path(src, html_file):
    """Return the absolute path to a local image, or None if src is remote / unresolvable."""
    if not src:
        return None
    if src.startswith(("http://", "https://", "data:", "//")):
        return None
    if is_template_src(src) or is_dynamic_api_src(src):
        return None
    # strip query / fragment
    clean = src.split("?", 1)[0].split("#", 1)[0]
    if clean.startswith("/"):
        candidate = os.path.join(ROOT, clean.lstrip("/"))
    else:
        # relative to the html file's directory
        candidate = os.path.normpath(os.path.join(os.path.dirname(html_file), clean))
    return candidate if os.path.isfile(candidate) else None


def pick_dimensions(src, tag, html_file):
    """Decide what width/height to inject for this img tag."""
    if not src:
        return None  # no src → don't touch
    if is_template_src(src):
        return None  # JS will populate; leave alone
    if looks_like_svg(src):
        return DEFAULT_SVG
    if looks_like_avatar(src, tag):
        return DEFAULT_AVATAR
    local = resolve_local_path(src, html_file)
    if local:
        dims = get_image_dimensions(local)
        if dims and dims[0] > 0 and dims[1] > 0:
            return dims
    return DEFAULT_LANDSCAPE


def inject_dimensions(tag, w, h):
    """Return the tag with width="W" height="H" inserted before alt= (or before closing)."""
    inject = f'width="{w}" height="{h}" '
    alt_match = ALT_RE.search(tag)
    if alt_match:
        return tag[:alt_match.start()] + inject + tag[alt_match.start():]
    # No alt — insert before the closing /> or >
    if tag.endswith("/>"):
        return tag[:-2].rstrip() + " " + inject.strip() + "/>"
    return tag[:-1].rstrip() + " " + inject.strip() + ">"


def process_file(filepath, stats):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Build a set of byte offsets that lie inside <noscript> or JSON-LD scripts (to skip).
    skip_spans = []
    for m in NOSCRIPT_RE.finditer(content):
        skip_spans.append(m.span())
    for m in JSONLD_RE.finditer(content):
        skip_spans.append(m.span())

    def in_skip_span(pos):
        for a, b in skip_spans:
            if a <= pos < b:
                return True
        return False

    # Iterate <img> tags in reverse to keep offsets stable during replacement.
    matches = list(IMG_RE.finditer(content))
    file_changed = 0
    for m in reversed(matches):
        tag = m.group(0)
        start, end = m.span()

        # Already sized?
        if ATTR_WIDTH_RE.search(tag) and ATTR_HEIGHT_RE.search(tag):
            stats["skipped_already_sized"] += 1
            continue
        # Partial — already has width or height (rare). Leave alone, count as skipped.
        if ATTR_WIDTH_RE.search(tag) or ATTR_HEIGHT_RE.search(tag):
            stats["skipped_partial"] += 1
            continue
        # Inside noscript / JSON-LD?
        if in_skip_span(start):
            stats["skipped_in_noscript_or_jsonld"] += 1
            continue
        # Style declares width/height?
        if STYLE_DIM_RE.search(tag):
            stats["skipped_style_sized"] += 1
            continue

        src_m = SRC_RE.search(tag)
        src = src_m.group(1) if src_m else ""

        # No src at all → leave alone (rare, e.g. <img src="" id="...">)
        if not src:
            stats["left_alone_no_src"] += 1
            continue

        # Template literal — JS fills it; leave alone.
        if is_template_src(src):
            stats["left_alone_template_src"] += 1
            continue

        dims = pick_dimensions(src, tag, filepath)
        if not dims:
            stats["left_alone_other"] += 1
            continue

        w, h = dims
        new_tag = inject_dimensions(tag, w, h)
        if new_tag == tag:
            stats["left_alone_inject_noop"] += 1
            continue

        content = content[:start] + new_tag + content[end:]
        stats["imgs_updated"] += 1
        file_changed += 1

    if file_changed:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        stats["files_modified"] += 1
        stats["sample_changes"].setdefault(filepath, []).append(file_changed)


def main():
    files = []
    for root, dirs, fs in os.walk(ROOT):
        # Prune excluded dirs in place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in fs:
            if f.lower().endswith(".html"):
                files.append(os.path.join(root, f))

    stats = {
        "files_scanned": len(files),
        "files_modified": 0,
        "imgs_updated": 0,
        "skipped_already_sized": 0,
        "skipped_partial": 0,
        "skipped_in_noscript_or_jsonld": 0,
        "skipped_style_sized": 0,
        "left_alone_no_src": 0,
        "left_alone_template_src": 0,
        "left_alone_other": 0,
        "left_alone_inject_noop": 0,
        "sample_changes": {},
    }

    for fp in files:
        process_file(fp, stats)

    # Summary
    print("=" * 64)
    print("add_img_dimensions.py — summary")
    print("=" * 64)
    print(f"  HTML files scanned          : {stats['files_scanned']}")
    print(f"  HTML files modified         : {stats['files_modified']}")
    print(f"  <img> tags updated          : {stats['imgs_updated']}")
    print(f"  <img> already sized         : {stats['skipped_already_sized']}")
    print(f"  <img> partially sized       : {stats['skipped_partial']}")
    print(f"  <img> skipped (noscript/ld+json): {stats['skipped_in_noscript_or_jsonld']}")
    print(f"  <img> skipped (style w/h)   : {stats['skipped_style_sized']}")
    print(f"  <img> left alone (no src)   : {stats['left_alone_no_src']}")
    print(f"  <img> left alone (${{...}} src): {stats['left_alone_template_src']}")
    print(f"  <img> left alone (other)    : {stats['left_alone_other']}")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
