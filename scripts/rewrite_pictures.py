#!/usr/bin/env python3
"""
rewrite_pictures.py — IVAE Studios HTML <img> -> <picture> rewriter.

Run after `build_webp.py` so that every JPG referenced by HTML has a
`.webp` sibling. This script then:

  1. Finds every <img src="/images/.../foo.jpg"> not already inside a
     <picture> and wraps it as:
         <picture>
           <source type="image/webp" srcset="/images/.../foo.webp">
           <img src="/images/.../foo.jpg" ... >
         </picture>
     It preserves indentation and every existing attribute on the <img>
     (alt, loading, decoding, width, height, data-ivae-img, etc.).

  2. Finds every <picture> that already wraps a JPG <img> but lacks a
     <source type="image/webp"> and inserts one as the first child.
     Existing srcset/sizes/data-srcset are preserved.

Idempotent: re-running the script after a partial run is safe — already
rewritten blocks are detected and skipped. Only files that change are
written back.

Skipped:
  - gallery/ (out of scope per BRAND.md §11)
  - any <img> whose src does not end in .jpg / .jpeg
  - any <img> whose webp sibling does not exist on disk
  - <picture> blocks already containing a WebP <source>

Usage:
    python3 scripts/rewrite_pictures.py            # dry run report
    python3 scripts/rewrite_pictures.py --write    # actually edit files
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent

# Roots where we look for HTML to process.
HTML_GLOBS = (
    "*.html",
    "es/*.html",
    "es/blog/*.html",
    "vianey-ortega/*.html",
    "partials/*.html",
)

# Skip any file whose path includes one of these segments.
SKIP_PATH_PARTS = ("gallery", "node_modules", ".git")

JPG_RE = re.compile(r"\.(?:jpg|jpeg)$", re.IGNORECASE)


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def webp_sibling(jpg_url: str) -> str:
    """`/images/foo.jpg?x=1` -> `/images/foo.webp?x=1`."""
    # Strip query/fragment, swap extension, reattach.
    head = jpg_url
    tail = ""
    for sep in ("?", "#"):
        idx = head.find(sep)
        if idx >= 0:
            tail = head[idx:] + tail
            head = head[:idx]
    base = re.sub(r"\.(?:jpg|jpeg)$", ".webp", head, flags=re.IGNORECASE)
    return base + tail


_ABS_PREFIXES = (
    "https://ivaestudios.com",
    "http://ivaestudios.com",
    "https://www.ivaestudios.com",
    "http://www.ivaestudios.com",
)


def url_to_disk(url: str) -> Path | None:
    """Map a site URL (relative or canonical absolute) to an on-disk path."""
    head = url.split("?")[0].split("#")[0]
    for prefix in _ABS_PREFIXES:
        if head.startswith(prefix):
            head = head[len(prefix):]
            break
    if head.startswith("/"):
        head = head[1:]
    if not head.startswith("images/"):
        return None
    return REPO_ROOT / head


def get_indent(html: str, idx: int) -> str:
    """Return the whitespace at the start of the line containing `idx`."""
    line_start = html.rfind("\n", 0, idx) + 1
    indent = ""
    i = line_start
    while i < idx and html[i] in (" ", "\t"):
        indent += html[i]
        i += 1
    return indent


def find_attr(tag_html: str, name: str) -> str | None:
    """Return the value of attribute `name` in `tag_html`, or None."""
    m = re.search(
        rf'\b{re.escape(name)}\s*=\s*"([^"]*)"', tag_html, re.IGNORECASE
    )
    if m:
        return m.group(1)
    m = re.search(
        rf"\b{re.escape(name)}\s*=\s*'([^']*)'", tag_html, re.IGNORECASE
    )
    return m.group(1) if m else None


# ----------------------------------------------------------------------------
# Picture-block scan
# ----------------------------------------------------------------------------
PICTURE_RE = re.compile(r"<picture\b[^>]*>.*?</picture>", re.DOTALL | re.IGNORECASE)
IMG_TAG_RE = re.compile(r"<img\b[^>]*?>", re.DOTALL | re.IGNORECASE)
WEBP_SOURCE_RE = re.compile(
    r'<source\b[^>]*\btype\s*=\s*["\']image/webp["\'][^>]*>',
    re.IGNORECASE,
)


def find_picture_spans(html: str) -> list[tuple[int, int]]:
    """Return (start, end) byte offsets of every <picture> block."""
    return [(m.start(), m.end()) for m in PICTURE_RE.finditer(html)]


def in_picture(idx: int, spans: list[tuple[int, int]]) -> bool:
    for s, e in spans:
        if s <= idx < e:
            return True
        if idx < s:
            return False
    return False


# ----------------------------------------------------------------------------
# Rewrite passes
# ----------------------------------------------------------------------------
def rewrite_bare_imgs(html: str, file_for_log: Path) -> tuple[str, int, int]:
    """
    Wrap every JPG <img> that is NOT already inside a <picture> with a
    <picture> + WebP <source> + the original <img>.
    Returns (new_html, wrapped_count, skipped_count_no_sibling).
    """
    spans = find_picture_spans(html)
    out: list[str] = []
    cursor = 0
    wrapped = 0
    skipped = 0

    for m in IMG_TAG_RE.finditer(html):
        if in_picture(m.start(), spans):
            continue
        tag = m.group(0)
        src = find_attr(tag, "src")
        if not src or not JPG_RE.search(src.split("?")[0].split("#")[0]):
            continue
        disk = url_to_disk(src)
        if disk is None:
            continue
        webp_disk = disk.with_suffix(".webp")
        if not webp_disk.exists():
            skipped += 1
            continue

        webp_url = webp_sibling(src)
        indent = get_indent(html, m.start())
        # Use the indent of the <img> for the new <picture> opener and child indent + 2 spaces for inner content.
        inner_indent = indent + "  "

        replacement = (
            f"<picture>\n"
            f"{inner_indent}<source type=\"image/webp\" srcset=\"{webp_url}\">\n"
            f"{inner_indent}{tag}\n"
            f"{indent}</picture>"
        )

        out.append(html[cursor:m.start()])
        out.append(replacement)
        cursor = m.end()
        wrapped += 1

    out.append(html[cursor:])
    return "".join(out), wrapped, skipped


def add_webp_to_existing_pictures(html: str, file_for_log: Path) -> tuple[str, int, int]:
    """
    For each <picture> that wraps a JPG <img> and has no WebP <source>,
    insert <source type="image/webp" srcset="…webp"> just after <picture>.
    """
    out: list[str] = []
    cursor = 0
    added = 0
    skipped = 0

    for m in PICTURE_RE.finditer(html):
        block = m.group(0)
        if WEBP_SOURCE_RE.search(block):
            continue

        # Find the JPG <img> inside.
        img_m = IMG_TAG_RE.search(block)
        if not img_m:
            continue
        img_tag = img_m.group(0)
        src = find_attr(img_tag, "src")
        if not src or not JPG_RE.search(src.split("?")[0].split("#")[0]):
            continue
        disk = url_to_disk(src)
        if disk is None:
            continue
        webp_disk = disk.with_suffix(".webp")
        if not webp_disk.exists():
            skipped += 1
            continue

        webp_url = webp_sibling(src)

        # Compute inner indent: look at first child element after <picture …>.
        opener_end = block.find(">") + 1
        # Indent of the <picture> tag itself.
        picture_indent = get_indent(html, m.start())
        # Find next non-whitespace inside block to mirror its indent.
        i = opener_end
        while i < len(block) and block[i] in (" ", "\t", "\n", "\r"):
            i += 1
        # Walk back to start of that line:
        line_start = block.rfind("\n", 0, i) + 1
        inner_indent = block[line_start:i] if line_start <= i else picture_indent + "  "
        if not inner_indent.strip("") or inner_indent == "":
            inner_indent = picture_indent + "  "

        new_source = f"\n{inner_indent}<source type=\"image/webp\" srcset=\"{webp_url}\">"
        new_block = block[:opener_end] + new_source + block[opener_end:]

        out.append(html[cursor:m.start()])
        out.append(new_block)
        cursor = m.end()
        added += 1

    out.append(html[cursor:])
    return "".join(out), added, skipped


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------
def iter_html_files() -> Iterable[Path]:
    seen: set[Path] = set()
    for pattern in HTML_GLOBS:
        for path in REPO_ROOT.glob(pattern):
            if any(part in SKIP_PATH_PARTS for part in path.parts):
                continue
            if path.suffix.lower() != ".html":
                continue
            if path in seen:
                continue
            seen.add(path)
            yield path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write", action="store_true",
        help="Apply edits in place (default: dry-run, just print counts).",
    )
    args = parser.parse_args()

    files = sorted(iter_html_files())
    print(f"Scanning {len(files)} HTML file(s).")

    total_files_changed = 0
    total_wrapped = 0
    total_added_source = 0
    total_skipped = 0
    edited_files: list[Path] = []

    for path in files:
        original = path.read_text(encoding="utf-8")

        # Pass 1: wrap bare imgs.
        step1, wrapped, sk1 = rewrite_bare_imgs(original, path)
        # Pass 2: add WebP source to existing pictures (those generated in
        # pass 1 already have one, so they're skipped).
        step2, added, sk2 = add_webp_to_existing_pictures(step1, path)

        if step2 == original:
            continue

        total_files_changed += 1
        total_wrapped += wrapped
        total_added_source += added
        total_skipped += sk1 + sk2
        edited_files.append(path)

        if args.write:
            path.write_text(step2, encoding="utf-8")

    print()
    print("Summary")
    print("-------")
    print(f"  files scanned       : {len(files)}")
    print(f"  files changed       : {total_files_changed}")
    print(f"  bare <img> wrapped  : {total_wrapped}")
    print(f"  WebP sources added  : {total_added_source}")
    print(f"  skipped (no sibling): {total_skipped}")
    if not args.write:
        print()
        print("DRY RUN — pass --write to actually edit files.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
