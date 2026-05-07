#!/usr/bin/env python3
"""Apply photo renames from _photo-renames-2026-05-07.json.

Two-phase approach to avoid file collisions:
  1. Stage: move all source files to images/.staging/ with hash-suffixed names
  2. Commit: move from staging to final names in images/ root, with -2/-3
     suffix when target name collides with existing files or other staged files

Then scans all HTML/CSS/JS files in the repo for references to old paths and
updates them to the new paths.

Usage:
    python3 tools/_apply-renames.py --dry-run
    python3 tools/_apply-renames.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MAPPING_PATH = REPO_ROOT / "tools" / "_photo-renames-2026-05-07.json"
APPLIED_PATH = REPO_ROOT / "tools" / "_photo-renames-applied.json"
STAGING_DIR = REPO_ROOT / "images" / ".staging"
IMAGES_DIR = REPO_ROOT / "images"

EXCLUDE_REF_DIRS = {".git", ".github", ".wrangler", "node_modules", "tools"}


def load_mapping() -> dict:
    with open(MAPPING_PATH) as f:
        return json.load(f)


def stage_sources(mapping: dict, dry_run: bool) -> list[tuple[str, Path, str]]:
    """Phase 1: Move sources to staging. Returns list of (orig_path, stage_path, target_name)."""
    moved = []
    skipped_count = 0
    if not dry_run:
        STAGING_DIR.mkdir(parents=True, exist_ok=True)

    for src, info in mapping.items():
        src_path = REPO_ROOT / src
        if not src_path.exists():
            print(f"  SKIP missing: {src}")
            skipped_count += 1
            continue

        if not info.get("type") or not info.get("location"):
            print(f"  SKIP no-type-or-location: {src}")
            skipped_count += 1
            continue

        # Use hash of original path for unique staging name
        stage_name = f"{abs(hash(src)) % 10**12}_{src_path.name}"
        stage_path = STAGING_DIR / stage_name

        if dry_run:
            moved.append((src, stage_path, info["new_name"]))
        else:
            shutil.move(str(src_path), str(stage_path))
            moved.append((src, stage_path, info["new_name"]))

    print(f"  Phase 1: staged {len(moved)} files ({skipped_count} skipped)")
    return moved


def compute_final_name(target_name: str, used: set, target_dir: Path) -> str:
    """Compute final filename, suffixing with -2/-3 if needed.

    Avoids: (a) names already used in this batch, (b) existing files in target_dir
    that aren't being renamed (they would get overwritten otherwise).
    """
    base, ext = os.path.splitext(target_name)
    candidate = target_name
    counter = 2
    while candidate in used or (target_dir / candidate).exists():
        candidate = f"{base}-{counter}{ext}"
        counter += 1
    used.add(candidate)
    return candidate


def commit_to_final(staged: list, dry_run: bool) -> dict[str, str]:
    """Phase 2: Move from staging to final names. Returns old_path → new_path mapping."""
    used: set = set()
    renames: dict[str, str] = {}

    for orig_src, stage_path, target_name in staged:
        final_name = compute_final_name(target_name, used, IMAGES_DIR)
        final_path = IMAGES_DIR / final_name

        if dry_run:
            print(f"  {orig_src} → images/{final_name}")
        else:
            shutil.move(str(stage_path), str(final_path))

        renames[orig_src] = f"images/{final_name}"

    print(f"  Phase 2: committed {len(renames)} renames")
    return renames


def cleanup_staging(dry_run: bool) -> None:
    if dry_run:
        return
    if STAGING_DIR.exists():
        # Remove if empty
        try:
            STAGING_DIR.rmdir()
            print("  Cleanup: removed images/.staging/")
        except OSError:
            print(f"  WARN: images/.staging/ not empty, leaving for inspection")


def remove_empty_dirs(dry_run: bool) -> None:
    """Remove now-empty source directories."""
    targets = [
        REPO_ROOT / "images" / "library",
        REPO_ROOT / "images" / "fotos extra pagina y blog",
    ]
    for d in targets:
        if d.exists() and not any(d.iterdir()):
            if dry_run:
                print(f"  Would remove empty: {d.relative_to(REPO_ROOT)}")
            else:
                d.rmdir()
                print(f"  Removed empty: {d.relative_to(REPO_ROOT)}")
        elif d.exists():
            remaining = list(d.iterdir())
            print(f"  WARN: {d.relative_to(REPO_ROOT)} still has {len(remaining)} files")


def update_references(renames: dict[str, str], dry_run: bool) -> int:
    """Scan HTML/CSS/JS for old paths and update to new paths.

    Searches for old path strings (with and without leading /) in all repo files.
    Returns count of files modified.
    """
    extensions = (".html", ".css", ".js", ".json", ".xml", ".md", ".txt")
    files_modified = 0

    # Build replacement table
    # We need to handle both "images/foo.jpg" and "/images/foo.jpg"
    replacements = []
    for old_path, new_path in renames.items():
        if old_path == new_path:
            continue
        # Variations to find
        for old_variant in [old_path, "/" + old_path]:
            new_variant = "/" + new_path if old_variant.startswith("/") else new_path
            replacements.append((old_variant, new_variant))

    # Walk repo
    for dp, dirs, files in os.walk(REPO_ROOT):
        rel_dir = Path(dp).relative_to(REPO_ROOT)
        if rel_dir != Path(".") and (
            str(rel_dir).startswith(".") or rel_dir.parts[0] in EXCLUDE_REF_DIRS
        ):
            continue
        for fn in files:
            if not fn.endswith(extensions):
                continue
            fp = Path(dp) / fn
            try:
                content = fp.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            original = content
            for old, new in replacements:
                content = content.replace(old, new)
            if content != original:
                files_modified += 1
                if dry_run:
                    # Count occurrences for reporting
                    diff_count = sum(
                        original.count(old) for old, _ in replacements if old in original
                    )
                    print(f"  Would update: {fp.relative_to(REPO_ROOT)} ({diff_count} refs)")
                else:
                    fp.write_text(content, encoding="utf-8")
    return files_modified


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true", help="Show what would happen")
    g.add_argument("--apply", action="store_true", help="Execute renames + ref updates")
    args = ap.parse_args()

    print(f"=== Photo Renames {'DRY RUN' if args.dry_run else 'APPLY'} ===\n")

    mapping = load_mapping()
    print(f"Mapping entries: {len(mapping)}\n")

    print("Phase 1: stage sources")
    staged = stage_sources(mapping, dry_run=args.dry_run)

    print("\nPhase 2: commit to final names")
    renames = commit_to_final(staged, dry_run=args.dry_run)

    print("\nPhase 3: cleanup staging")
    cleanup_staging(dry_run=args.dry_run)
    remove_empty_dirs(dry_run=args.dry_run)

    print("\nPhase 4: update references in HTML/CSS/JS/JSON/XML/MD/TXT")
    n = update_references(renames, dry_run=args.dry_run)
    print(f"  {'Would update' if args.dry_run else 'Updated'} {n} files\n")

    if not args.dry_run:
        with open(APPLIED_PATH, "w") as f:
            json.dump(
                {"applied_at": "2026-05-07", "renames": renames},
                f,
                indent=2,
                sort_keys=True,
            )
        print(f"Manifest written: {APPLIED_PATH.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
