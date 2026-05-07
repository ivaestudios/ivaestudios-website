#!/usr/bin/env python3
"""PR 6 Phase 2 — Wrap hero <img> in <picture> with AVIF/WebP/JPG fallback.

Also upgrades the existing preload link to use AVIF + type="image/avif".

Idempotent — re-running won't double-wrap.

Usage:
    python3 tools/_pr6-phase2-picture.py --dry-run
    python3 tools/_pr6-phase2-picture.py --apply
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Pages that use a LOCAL hero img (not CDN)
PAGES = [
    "index.html",
    "es/index.html",
    "about.html",
    "es/acerca-de.html",
    "luxury-weddings.html",
]


def jpg_to_avif(jpg_path: str) -> str:
    return jpg_path.rsplit(".", 1)[0] + ".avif"


def jpg_to_webp(jpg_path: str) -> str:
    return jpg_path.rsplit(".", 1)[0] + ".webp"


def upgrade_preload(content: str) -> tuple[str, bool]:
    """Replace existing preload of a JPG with AVIF preload + type."""
    # Match: <link rel="preload" as="image" fetchpriority="high" href="X.jpg">
    pattern = r'<link rel="preload" as="image" fetchpriority="high" href="([^"]+\.jpg)">'
    m = re.search(pattern, content)
    if not m:
        return content, False
    jpg_url = m.group(1)
    avif_url = jpg_to_avif(jpg_url)
    new_link = f'<link rel="preload" as="image" fetchpriority="high" href="{avif_url}" type="image/avif">'
    new_content = content.replace(m.group(0), new_link, 1)
    return new_content, True


def wrap_in_picture(content: str) -> tuple[str, bool, str | None]:
    """Wrap hero <img> in <picture> with AVIF/WebP sources."""
    # Skip if already wrapped (idempotency)
    if re.search(r'<div class="hero-bg"[^>]*>\s*<picture>', content):
        return content, False, None

    # Match the hero img inside hero-bg
    pattern = r'(<div class="hero-bg"[^>]*>)\s*(<img[^>]*src="([^"]+\.jpg)"[^>]*>)\s*(</div>)'
    m = re.search(pattern, content)
    if not m:
        return content, False, None

    div_open = m.group(1)
    img_tag = m.group(2)
    jpg_url = m.group(3)
    div_close = m.group(4)

    avif_url = jpg_to_avif(jpg_url)
    webp_url = jpg_to_webp(jpg_url)

    new_block = (
        f'{div_open}\n'
        f'    <picture>\n'
        f'      <source type="image/avif" srcset="{avif_url}">\n'
        f'      <source type="image/webp" srcset="{webp_url}">\n'
        f'      {img_tag}\n'
        f'    </picture>\n'
        f'  {div_close}'
    )
    new_content = content.replace(m.group(0), new_block, 1)
    return new_content, True, jpg_url


def process(page: str, dry_run: bool) -> dict:
    p = REPO / page
    if not p.exists():
        return {"status": "missing"}

    original = p.read_text(encoding="utf-8")
    content = original
    result = {"page": page, "changes": []}

    content, preload_changed = upgrade_preload(content)
    if preload_changed:
        result["changes"].append("preload→avif")

    content, picture_changed, hero_jpg = wrap_in_picture(content)
    if picture_changed:
        result["changes"].append(f"<picture> (hero={hero_jpg})")

    if content != original and not dry_run:
        p.write_text(content, encoding="utf-8")

    result["status"] = "modified" if content != original else "no-change"
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    print(f"=== PR 6 Phase 2 — {'DRY RUN' if args.dry_run else 'APPLY'} ===\n")

    for p in PAGES:
        r = process(p, dry_run=args.dry_run)
        if r["status"] == "missing":
            print(f"  ⚠️  MISSING: {p}")
            continue
        if r["status"] == "no-change":
            print(f"  ✓ already done: {p}")
            continue
        print(f"  {'WOULD UPDATE' if args.dry_run else 'UPDATED'}: {p}")
        for c in r["changes"]:
            print(f"      • {c}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
