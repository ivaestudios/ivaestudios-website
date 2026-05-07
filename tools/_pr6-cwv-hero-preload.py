#!/usr/bin/env python3
"""PR 6 — Core Web Vitals: hero preload + eager + fetchpriority high.

For each pillar page, this script:
  1. Adds <link rel="preload" as="image" fetchpriority="high" href="..."> in <head>
  2. Changes loading="lazy" → loading="eager" on hero <img>
  3. Adds fetchpriority="high" to hero <img> (if not present)

Hero URLs are auto-detected from either:
  - <div class="hero-bg"><img src="..."> (img-based heroes)
  - .hero-bg{background:url('...')} (CSS-background heroes)

Idempotent: re-running won't duplicate preload links.

Usage:
    python3 tools/_pr6-cwv-hero-preload.py --dry-run
    python3 tools/_pr6-cwv-hero-preload.py --apply
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

PAGES = [
    "index.html", "es/index.html",
    "about.html", "es/acerca-de.html",
    "cancun.html", "riviera-maya.html", "los-cabos.html",
    "couples-photography.html", "luxury-family-photos.html", "luxury-weddings.html",
    "es/fotografo-cancun.html", "es/fotografo-riviera-maya.html", "es/fotografo-los-cabos.html",
    "es/fotografia-parejas-mexico.html", "es/fotos-familiares-lujo-cancun.html",
    "es/fotografo-bodas-destino-mexico.html",
]


def find_hero_url(content: str) -> tuple[str | None, str]:
    """Return (hero_url, source_type) where source_type is 'img' or 'css'."""
    # 1. Look for <div class="hero-bg"...><img src="..."> pattern
    m = re.search(r'<div class="hero-bg"[^>]*>\s*<img[^>]*src="([^"]+)"', content)
    if m:
        return m.group(1), "img"
    # 2. Look for CSS background pattern .hero-bg{...background:url('...')}
    m = re.search(r"\.hero-bg\s*\{[^}]*background:[^;]*url\(['\"]([^'\"]+)['\"]\)", content)
    if m:
        return m.group(1), "css"
    return None, ""


def add_preload_link(content: str, url: str) -> tuple[str, bool]:
    """Insert <link rel='preload' as='image' fetchpriority='high' href='URL'> in <head>.

    Idempotent — checks for existing preload of the same URL first.
    """
    # Skip if already exists
    if re.search(rf'<link[^>]*rel="preload"[^>]*href="{re.escape(url)}"', content):
        return content, False
    # Insert just before </head>
    preload_tag = f'<link rel="preload" as="image" fetchpriority="high" href="{url}">\n'
    new_content = content.replace("</head>", preload_tag + "</head>", 1)
    return new_content, new_content != content


def fix_hero_img_attrs(content: str, url: str) -> tuple[str, list[str]]:
    """Fix loading=lazy → eager and add fetchpriority=high to hero img."""
    changes = []
    # Find the hero img tag
    pattern = rf'(<img[^>]*src="{re.escape(url)}"[^>]*>)'
    m = re.search(pattern, content)
    if not m:
        return content, []
    tag = m.group(1)
    new_tag = tag

    # Fix loading=lazy → eager
    if 'loading="lazy"' in new_tag:
        new_tag = new_tag.replace('loading="lazy"', 'loading="eager"')
        changes.append("loading: lazy→eager")
    elif 'loading="eager"' not in new_tag:
        # No loading attr — add it
        new_tag = new_tag.replace("<img", '<img loading="eager"', 1)
        changes.append("loading: ø→eager")

    # Add fetchpriority="high" if missing
    if 'fetchpriority=' not in new_tag:
        new_tag = new_tag.replace("<img", '<img fetchpriority="high"', 1)
        changes.append("fetchpriority: ø→high")

    if new_tag != tag:
        content = content.replace(tag, new_tag, 1)
    return content, changes


def process_page(page_rel: str, dry_run: bool) -> dict:
    page = REPO / page_rel
    if not page.exists():
        return {"status": "missing"}

    content = page.read_text(encoding="utf-8")
    original = content
    url, source = find_hero_url(content)
    if not url:
        return {"status": "no-hero"}

    result = {"url": url, "source": source, "changes": []}

    # 1. Add preload link
    content, added = add_preload_link(content, url)
    if added:
        result["changes"].append("preload-link")

    # 2. If img hero, fix attrs
    if source == "img":
        content, attr_changes = fix_hero_img_attrs(content, url)
        result["changes"].extend(attr_changes)

    if content != original and not dry_run:
        page.write_text(content, encoding="utf-8")

    result["status"] = "modified" if content != original else "no-change"
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    print(f"=== PR 6 CWV — {'DRY RUN' if args.dry_run else 'APPLY'} ===\n")

    total = {"modified": 0, "no-change": 0, "no-hero": 0, "missing": 0}
    for page in PAGES:
        r = process_page(page, dry_run=args.dry_run)
        status = r["status"]
        total[status] = total.get(status, 0) + 1

        if status == "missing":
            print(f"  ⚠️  MISSING: {page}")
            continue
        if status == "no-hero":
            print(f"  ⚠️  NO HERO FOUND: {page}")
            continue
        if status == "no-change":
            print(f"  ✓ already clean: {page}  (hero: {r['url'][:50]}, source: {r['source']})")
            continue

        changes = ", ".join(r["changes"])
        print(f"  {'WOULD UPDATE' if args.dry_run else 'UPDATED'}: {page}")
        print(f"      hero: {r['url'][:80]}  ({r['source']})")
        print(f"      changes: {changes}")

    print(f"\n=== Summary: {total} ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
