#!/usr/bin/env python3
"""
Audit internal links on the IVAE Studios site for broken targets.

Walks every .html file in the repo, extracts every internal href, and reports
any that don't resolve to:
  - an existing .html file (with or without the extension),
  - a path registered in _redirects, or
  - a well-known root/index path.

Run locally or in CI:
    python scripts/audit_links.py
    python scripts/audit_links.py --root /path/to/site  (override repo root)
    python scripts/audit_links.py --fail-on-broken      (exit 1 if any broken)
"""
import argparse
import os
import re
import sys
from collections import defaultdict


HREF_RE = re.compile(r'href="(/[^"]*)"')


def load_redirect_sources(redirects_path):
    """Return the set of source paths listed in _redirects."""
    sources = set()
    if not os.path.exists(redirects_path):
        return sources
    with open(redirects_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 3:
                sources.add(parts[0])
    return sources


def build_valid_paths(root):
    """Build the set of paths the site actually serves.

    Returns (exact_valid, dynamic_prefixes):
      - exact_valid: set of paths that match exactly (static files, redirects,
        directory-index URLs).
      - dynamic_prefixes: tuple of path prefixes served by Cloudflare Pages
        Functions catch-all routes (functions/.../[[path]].js). Any href
        starting with one of these is considered valid because the Function
        decides what to do at runtime.
    """
    valid = set()
    valid.update(load_redirect_sources(os.path.join(root, "_redirects")))

    # Physical files → any on-disk asset (css/js/img/pdf/xml/txt…) is valid at its path.
    # HTML files also get a clean URL (without the .html extension).
    # index.html files also expose their containing directory as a clean URL
    # (Cloudflare Pages serves /foo/ → /foo/index.html automatically).
    for dp, _, files in os.walk(root):
        # Skip git internals, node_modules, hidden dirs (e.g. .github, .wrangler)
        rel_dir = os.path.relpath(dp, root)
        # Skip hidden/tooling dirs, but not the repo root itself (rel_dir == ".").
        if rel_dir != "." and (
            rel_dir.startswith(".")
            or rel_dir.split(os.sep)[0] in {"node_modules", ".git", ".github", ".wrangler", "functions"}
        ):
            continue
        for fn in files:
            if fn.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), root)
            valid.add("/" + rel)
            if fn.endswith(".html"):
                valid.add("/" + rel[: -len(".html")])
            if fn == "index.html":
                # gallery/index.html → /gallery/  AND  /gallery
                # gallery/admin/index.html → /gallery/admin/  AND  /gallery/admin
                dir_rel = os.path.dirname(rel)
                if dir_rel == "":
                    valid.add("/")
                else:
                    url = "/" + dir_rel.replace(os.sep, "/")
                    valid.add(url)
                    valid.add(url + "/")

    # Pages Functions catch-all routes: functions/api/gallery/[[path]].js
    # serves any URL under /api/gallery/. Walk functions/ and collect each
    # [[path]].js file's path prefix.
    dynamic_prefixes = []
    fn_root = os.path.join(root, "functions")
    if os.path.isdir(fn_root):
        for dp, _, files in os.walk(fn_root):
            for fn in files:
                if fn == "[[path]].js":
                    rel_dir = os.path.relpath(dp, fn_root)
                    if rel_dir == ".":
                        dynamic_prefixes.append("/")
                    else:
                        dynamic_prefixes.append(
                            "/" + rel_dir.replace(os.sep, "/") + "/"
                        )
                elif fn.endswith(".js"):
                    # Direct (non-catch-all) function file → exact route.
                    rel_dir = os.path.relpath(dp, fn_root)
                    name = fn[: -len(".js")]
                    base = "/" if rel_dir == "." else "/" + rel_dir.replace(os.sep, "/") + "/"
                    valid.add(base + name)

    # Well-known shortcuts Cloudflare resolves automatically
    valid.update(["/", "/blog", "/about", "/cancun", "/riviera-maya", "/los-cabos"])
    return valid, tuple(dynamic_prefixes)


def scan_hrefs(root, valid_paths, dynamic_prefixes=()):
    """Walk .html files, yield (file, lineno, href) for any broken internal link."""
    broken_by_file = defaultdict(list)
    all_hrefs = defaultdict(set)

    for dp, _, files in os.walk(root):
        if "/.git/" in dp or "/node_modules/" in dp:
            continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, root)
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                for lineno, line in enumerate(f, 1):
                    for m in HREF_RE.finditer(line):
                        href = m.group(1)
                        clean = href.split("#")[0].split("?")[0]
                        if not clean:
                            continue
                        clean_nts = clean.rstrip("/") if clean != "/" else clean
                        if (
                            clean in valid_paths
                            or clean_nts in valid_paths
                            or (clean + ".html") in valid_paths
                            or (clean_nts + ".html") in valid_paths
                        ):
                            continue
                        # Pages Functions catch-all: any href under a known
                        # /functions/.../[[path]].js prefix is dynamic and valid.
                        if dynamic_prefixes and clean.startswith(dynamic_prefixes):
                            continue
                        broken_by_file[rel].append((lineno, href))
                        all_hrefs[href].add(rel)
    return broken_by_file, all_hrefs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        help="Repo root (defaults to the parent of this script).",
    )
    ap.add_argument(
        "--fail-on-broken",
        action="store_true",
        help="Exit with code 1 if any broken links are found.",
    )
    ap.add_argument(
        "--top", type=int, default=40, help="How many top broken hrefs to print."
    )
    args = ap.parse_args()

    valid_paths, dynamic_prefixes = build_valid_paths(args.root)
    broken_by_file, all_hrefs = scan_hrefs(args.root, valid_paths, dynamic_prefixes)

    print("\n=== BROKEN INTERNAL LINKS AUDIT ===\n")
    print(f"Root: {args.root}")
    print(f"Total unique broken hrefs: {len(all_hrefs)}")
    print(
        f"Total file occurrences: {sum(len(v) for v in broken_by_file.values())}\n"
    )

    if all_hrefs:
        print(f"\n--- Top {args.top} most frequent broken hrefs ---\n")
        counts = sorted(
            [(len(v), h, sorted(v)[:3]) for h, v in all_hrefs.items()], reverse=True
        )
        for count, href, sample in counts[: args.top]:
            print(f"  {count:3d}×  {href}")
            for sf in sample:
                print(f"         ← {sf}")

    if args.fail_on_broken and all_hrefs:
        sys.exit(1)


if __name__ == "__main__":
    main()
