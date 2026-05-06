#!/usr/bin/env python3
"""
build_webp.py — IVAE Studios WebP sibling generator (Oleada 5 / Agent 06).

Re-runnable batch converter. Walks `images/` (skipping `gallery/`,
`images/blog/`, `images/icons/`) and produces a `.webp` sibling next to
every `.jpg` / `.jpeg` it finds. Originals are never touched — the HTML
references both via <picture><source type="image/webp">.

Run:
    python3 scripts/build_webp.py            # convert missing only
    python3 scripts/build_webp.py --force    # rebuild all .webp

Quality target: ~82 (visually transparent for editorial photography while
hitting ~40-60% byte savings vs. the JPG source). Progressive WebP via
`method=6` for the best compression / time trade-off in batch mode.

AVIF: skipped this oleada. Pillow on this machine reports `avif: True`
(libavif present), so we *could* emit `.avif` siblings — but AVIF wins
~10-15% over WebP at 5-10x the encode time, and modern browsers all
support WebP. Re-add AVIF later if Lighthouse flags it.

Pillow >= 10 required.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "Pillow is required. Install with: python3 -m pip install --upgrade pillow\n"
    )
    sys.exit(1)

# ----------------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------------
REPO_ROOT  = Path(__file__).resolve().parent.parent
IMAGES_DIR = REPO_ROOT / "images"

# Directories whose contents are out of scope for this oleada.
SKIP_DIRS = {
    IMAGES_DIR / "blog",   # large; deferred
    IMAGES_DIR / "icons",  # PNG/SVG, designed for size already
    IMAGES_DIR / "brand",  # SVGs only
    REPO_ROOT  / "gallery",
}

# Encoder knobs.
WEBP_QUALITY = 82
WEBP_METHOD  = 6   # 0 fast .. 6 slowest/best

JPG_EXTS = {".jpg", ".jpeg"}


# ----------------------------------------------------------------------------
# Discovery
# ----------------------------------------------------------------------------
def is_skipped(path: Path) -> bool:
    """Return True if `path` lives under a skipped directory."""
    for skip in SKIP_DIRS:
        try:
            path.relative_to(skip)
            return True
        except ValueError:
            continue
    return False


def find_jpgs(root: Path) -> Iterable[Path]:
    """Yield every .jpg/.jpeg under `root` that isn't in a skipped dir."""
    for dirpath, dirnames, filenames in os.walk(root):
        d = Path(dirpath)
        # Prune: don't descend into skipped subtrees.
        dirnames[:] = [
            name for name in dirnames if not is_skipped(d / name)
        ]
        if is_skipped(d):
            continue
        for name in filenames:
            ext = Path(name).suffix.lower()
            if ext in JPG_EXTS:
                yield d / name


# ----------------------------------------------------------------------------
# Conversion
# ----------------------------------------------------------------------------
def convert_one(jpg: Path, force: bool = False) -> tuple[bool, int, int]:
    """
    Produce a `.webp` sibling for `jpg`.

    Returns (was_written, src_bytes, dst_bytes). When skipped because the
    sibling already exists and is newer than the source, was_written=False.
    """
    webp = jpg.with_suffix(".webp")
    src_bytes = jpg.stat().st_size

    if webp.exists() and not force:
        if webp.stat().st_mtime >= jpg.stat().st_mtime:
            return False, src_bytes, webp.stat().st_size

    with Image.open(jpg) as im:
        # Drop any embedded ICC profile we can't trust. Convert to RGB —
        # WebP supports CMYK technically but browsers are inconsistent.
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.save(
            webp,
            format="WEBP",
            quality=WEBP_QUALITY,
            method=WEBP_METHOD,
        )

    dst_bytes = webp.stat().st_size
    return True, src_bytes, dst_bytes


def humanize(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force", action="store_true",
        help="Rebuild every .webp, even when the sibling is newer than the JPG.",
    )
    parser.add_argument(
        "--root", type=Path, default=IMAGES_DIR,
        help="Root directory to walk (default: <repo>/images).",
    )
    args = parser.parse_args()

    root: Path = args.root
    if not root.exists():
        sys.stderr.write(f"Root does not exist: {root}\n")
        return 1

    jpgs = sorted(find_jpgs(root))
    if not jpgs:
        print("No .jpg/.jpeg files in scope. Nothing to do.")
        return 0

    print(f"Scanning {len(jpgs)} JPG file(s) under {root.relative_to(REPO_ROOT)}/")

    written = skipped = 0
    total_src = total_dst = 0
    failures: list[tuple[Path, str]] = []
    t0 = time.time()

    for i, jpg in enumerate(jpgs, 1):
        try:
            did_write, src_b, dst_b = convert_one(jpg, force=args.force)
        except Exception as exc:  # pragma: no cover
            failures.append((jpg, repr(exc)))
            continue

        total_src += src_b
        total_dst += dst_b
        if did_write:
            written += 1
        else:
            skipped += 1

        if i % 50 == 0 or i == len(jpgs):
            elapsed = time.time() - t0
            print(
                f"  [{i:>4}/{len(jpgs)}] "
                f"written={written} skipped={skipped} "
                f"({elapsed:.1f}s)",
                flush=True,
            )

    print()
    print("Summary")
    print("-------")
    print(f"  JPGs scanned : {len(jpgs)}")
    print(f"  WebP written : {written}")
    print(f"  Up-to-date   : {skipped}")
    if failures:
        print(f"  Failures     : {len(failures)}")
        for path, err in failures[:10]:
            print(f"    {path.relative_to(REPO_ROOT)}: {err}")
    print(f"  JPG bytes    : {humanize(total_src)}")
    print(f"  WebP bytes   : {humanize(total_dst)}")
    if total_src:
        ratio = total_dst / total_src * 100
        saved = total_src - total_dst
        print(f"  WebP ratio   : {ratio:.1f}% of JPG  ({humanize(saved)} saved)")

    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
