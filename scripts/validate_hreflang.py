#!/usr/bin/env python3
"""IVAE Studios — Hreflang Validator.

Detects bilingual link integrity issues:

  * Every `<link rel="alternate" hreflang="X">` URL is reachable in the repo
  * Reciprocal rule: if EN page links to its ES mirror, ES page must link back
    to that EN page (and vice versa)
  * `lang` attribute on <html> matches the page's language directory
  * `x-default` is set on every page that has hreflang en/es pairs
  * No conflicting hreflang entries (e.g. two different EN URLs)

Usage:
    python3 scripts/validate_hreflang.py
    python3 scripts/validate_hreflang.py --report-only
    python3 scripts/validate_hreflang.py --file index.html

Exit codes:
    0 = OK (or --report-only mode)
    1 = errors found and not in --report-only

Stdlib-only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
import time
from typing import Iterable

EXCLUDE_DIRS = {
    ".git", ".github", ".wrangler", ".devcontainer",
    "node_modules", "gallery", "functions", "seo", "tools",
}
SKIP_FILES = {"404.html", "coming-soon.html"}
# RELAXED 2026-05-13: don't validate preview/draft files — they keep stale
# hreflang values pointing to the production canonical URLs which then look
# asymmetric to the live page. They're not in the sitemap and not indexable.
SKIP_PATTERNS = ("-preview.html", "-A-", "-B-", "-C-", "-v2.html", "-v3.html", "-v4.html", "-v5.html")

CANONICAL_HOST = "https://ivaestudios.com"

HREFLANG_RE = re.compile(
    r'<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*/?>',
    re.IGNORECASE,
)
HTML_LANG_RE = re.compile(r"<html[^>]*\blang=\"([^\"]+)\"", re.IGNORECASE)
CANONICAL_RE = re.compile(
    r'<link\s+rel="canonical"\s+href="([^"]+)"\s*/?>', re.IGNORECASE
)


def discover_files(root: str, only: str | None = None) -> Iterable[tuple[str, str]]:
    if only:
        abs_path = os.path.join(root, only)
        if os.path.isfile(abs_path):
            yield only, abs_path
        return
    for dp, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        if rel_dir != "." and (
            rel_dir.startswith(".")
            or rel_dir.split(os.sep)[0] in EXCLUDE_DIRS
        ):
            continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            if fn in SKIP_FILES:
                continue
            if any(p in fn for p in SKIP_PATTERNS):
                continue
            abs_path = os.path.join(dp, fn)
            rel = os.path.relpath(abs_path, root).replace(os.sep, "/")
            yield rel, abs_path


def _parse_redirects(root: str) -> dict[str, str]:
    """RELAXED 2026-05-13: parse Cloudflare _redirects so the validator
    recognizes SEO-friendly URLs that resolve via a 200-rewrite (e.g.
    `/riviera-maya-photographer → /riviera-maya 200`)."""
    redirects: dict[str, str] = {}
    redirects_path = os.path.join(root, "_redirects")
    if not os.path.exists(redirects_path):
        return redirects
    with open(redirects_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                src, dest = parts[0], parts[1]
                redirects[src.rstrip("/")] = dest.rstrip("/")
    return redirects


_REDIRECTS_CACHE: dict[str, str] | None = None


def url_to_local_path(url: str, root: str) -> str | None:
    """Convert a public URL to its local file path. Returns None if not found.

    Follows _redirects 200-rewrites once so SEO-friendly URLs that resolve in
    production are recognized as valid hreflang targets.
    """
    global _REDIRECTS_CACHE
    if _REDIRECTS_CACHE is None:
        _REDIRECTS_CACHE = _parse_redirects(root)

    if not url.startswith(CANONICAL_HOST):
        return None
    path = url[len(CANONICAL_HOST):].lstrip("/")

    def _resolve(p: str) -> str | None:
        if not p or p.endswith("/"):
            candidate = p + "index.html" if p else "index.html"
        elif not p.endswith(".html"):
            for c in (p + ".html", p + "/index.html"):
                if os.path.exists(os.path.join(root, c)):
                    return c
            return None
        else:
            candidate = p
        if os.path.exists(os.path.join(root, candidate)):
            return candidate
        return None

    direct = _resolve(path)
    if direct is not None:
        return direct

    # Try _redirects (one hop, no recursion)
    src_key = "/" + path.rstrip("/")
    dest = _REDIRECTS_CACHE.get(src_key)
    if dest is None:
        return None
    return _resolve(dest.lstrip("/"))


def expected_lang(rel_path: str) -> str:
    """Return expected lang attribute given the file's path."""
    parts = rel_path.split("/")
    if parts[0] == "es":
        return "es"
    return "en"


def validate_file(rel: str, abs_path: str, root: str) -> list[tuple[str, str, str, str]]:
    """Returns list of (rel, severity, check, message)."""
    findings: list[tuple[str, str, str, str]] = []
    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()

    # 1. Check html lang attribute
    lang_match = HTML_LANG_RE.search(html)
    if not lang_match:
        findings.append((rel, "WARN", "html-lang", "Missing <html lang=\"...\"> attribute"))
    else:
        actual_lang = lang_match.group(1).lower()[:2]
        expected = expected_lang(rel)
        if actual_lang != expected:
            findings.append((
                rel, "ERROR", "html-lang",
                f"<html lang=\"{actual_lang}\"> doesn't match path-implied lang \"{expected}\"",
            ))

    # 2. Collect hreflang entries
    hreflang_entries = HREFLANG_RE.findall(html)
    if not hreflang_entries:
        # Pages without hreflang might be OK (e.g. legal-only pages) but
        # warn so user can confirm.
        findings.append((rel, "WARN", "no-hreflang", "No <link rel=alternate hreflang> tags found"))
        return findings

    # 3. Group by hreflang code
    by_lang: dict[str, list[str]] = {}
    for code, href in hreflang_entries:
        by_lang.setdefault(code.lower(), []).append(href)

    # 4. Conflicting entries (multiple URLs for same language)
    for code, urls in by_lang.items():
        unique = set(urls)
        if len(unique) > 1:
            findings.append((
                rel, "ERROR", "hreflang-conflict",
                f"hreflang=\"{code}\" has conflicting URLs: {sorted(unique)}",
            ))

    # 5. x-default presence
    if "en" in by_lang or "es" in by_lang:
        if "x-default" not in by_lang:
            findings.append((
                rel, "WARN", "missing-x-default",
                "Has en/es hreflang but no x-default",
            ))

    # 6. URL reachability — every hreflang URL should resolve to a local file
    for code, urls in by_lang.items():
        for url in set(urls):
            local = url_to_local_path(url, root)
            if local is None:
                findings.append((
                    rel, "ERROR", "hreflang-broken",
                    f"hreflang=\"{code}\" URL {url} doesn't resolve to a local file",
                ))

    return findings


def reciprocal_check(
    files: list[tuple[str, str]], root: str
) -> list[tuple[str, str, str, str]]:
    """Verify reciprocal hreflang: if A links to B, B must link back to A."""
    findings: list[tuple[str, str, str, str]] = []
    page_alts: dict[str, dict[str, str]] = {}  # rel -> {lang: url}
    for rel, abs_path in files:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
        entries = HREFLANG_RE.findall(html)
        page_alts[rel] = {code.lower(): href for code, href in entries}

    for rel, alts in page_alts.items():
        for code, url in alts.items():
            if code == "x-default":
                continue
            local = url_to_local_path(url, root)
            if local is None or local == rel:
                continue
            # Other page should link back to us (URL of `rel`)
            our_url = path_to_url(rel)
            other_alts = page_alts.get(local, {})
            other_lang_for_us = expected_lang(rel)
            other_url = other_alts.get(other_lang_for_us)
            if other_url is None:
                findings.append((
                    rel, "WARN", "missing-reciprocal",
                    f"{rel} → {url} (lang={code}) but {local} has no hreflang=\"{other_lang_for_us}\" back",
                ))
            elif url_to_local_path(other_url, root) != rel:
                findings.append((
                    rel, "ERROR", "asymmetric-reciprocal",
                    f"{rel} ↔ {local}: round-trip mismatch (us→{url} ↔ them→{other_url})",
                ))
    return findings


def path_to_url(rel: str) -> str:
    """Convert local file path to canonical public URL (mirror of update_sitemap.py)."""
    if rel == "index.html":
        return CANONICAL_HOST + "/"
    if rel == "es/index.html":
        return CANONICAL_HOST + "/es/"
    if rel.endswith("/index.html"):
        return CANONICAL_HOST + "/" + rel[:-len("/index.html")] + "/"
    if rel.endswith(".html"):
        # Cloudflare auto-strips .html
        return CANONICAL_HOST + "/" + rel[:-len(".html")]
    return CANONICAL_HOST + "/" + rel


def render_human(results: list[tuple[str, str, str, str]], n_files: int, elapsed: float) -> None:
    n_err = sum(1 for r in results if r[1] == "ERROR")
    n_warn = sum(1 for r in results if r[1] == "WARN")
    print(
        f"=== Hreflang Validator: {n_files} files, {n_err} errors, {n_warn} warnings "
        f"({elapsed:.2f}s) ==="
    )
    by_file: dict[str, list] = {}
    for rel, sev, check, msg in results:
        by_file.setdefault(rel, []).append((sev, check, msg))
    for rel in sorted(by_file):
        for sev, check, msg in by_file[rel]:
            print(f"{rel}:1:{sev}:{check}: {msg}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    default_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--root", default=default_root, help="Repo root.")
    ap.add_argument("--file", default=None, help="Validate a single file.")
    ap.add_argument(
        "--fail-on-warnings", action="store_true",
        help="Exit 1 if any WARN (errors always exit 1).",
    )
    ap.add_argument(
        "--report-only", action="store_true",
        help="Always exit 0; write report to seo/reports/hreflang-YYYY-WW.md.",
    )
    args = ap.parse_args()

    start = time.time()
    files = list(discover_files(args.root, only=args.file))
    results: list[tuple[str, str, str, str]] = []
    for rel, abs_path in files:
        results.extend(validate_file(rel, abs_path, args.root))

    # Reciprocal pass needs whole-site context
    if not args.file:
        results.extend(reciprocal_check(files, args.root))

    elapsed = time.time() - start
    render_human(results, len(files), elapsed)

    has_errors = any(r[1] == "ERROR" for r in results)
    has_warnings = any(r[1] == "WARN" for r in results)

    if args.report_only:
        iso_year, iso_week, _ = dt.date.today().isocalendar()
        report_dir = os.path.join(args.root, "seo", "reports")
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(report_dir, f"hreflang-{iso_year}-W{iso_week:02d}.md")
        with open(report_path, "w", encoding="utf-8") as fh:
            fh.write(f"# Hreflang Validator Report — {iso_year}-W{iso_week:02d}\n\n")
            fh.write(
                f"Files: {len(files)} | Errors: {sum(1 for r in results if r[1]=='ERROR')} | "
                f"Warnings: {sum(1 for r in results if r[1]=='WARN')}\n\n"
            )
            if not results:
                fh.write("No issues found. ✅\n")
            else:
                by_file: dict[str, list] = {}
                for rel, sev, check, msg in results:
                    by_file.setdefault(rel, []).append((sev, check, msg))
                for rel in sorted(by_file):
                    fh.write(f"\n## {rel}\n\n")
                    for sev, check, msg in by_file[rel]:
                        fh.write(f"- **{sev}** [{check}] {msg}\n")
        print(f"\nReport written to {report_path}")
        return 0

    if has_errors:
        return 1
    if args.fail_on_warnings and has_warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
