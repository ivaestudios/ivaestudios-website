#!/usr/bin/env python3
"""
On-page SEO audit for the IVAE Studios site.

Walks every .html file (excluding gallery/, tools/, node_modules/) and reports
title length, meta description length, canonical, hreflang pair, H1
presence/uniqueness, H1 keyword overlap with title, schema.org JSON-LD
validity, brand mention, alt text, OG tags, and Twitter card.

Run locally or in CI:
    python scripts/audit_seo.py                  # report only, exit 0
    python scripts/audit_seo.py --fail-on-error  # exit 1 if any ERROR
    python scripts/audit_seo.py --json           # machine-readable output
    python scripts/audit_seo.py --page index.html
"""
import argparse
import json
import os
import re
import sys
import time
from collections import Counter


CANONICAL_HOST = "https://ivaestudios.com"
EXCLUDE_DIRS = {"gallery", "tools", "node_modules", ".git", ".github", ".wrangler", "functions"}

IC = re.IGNORECASE
ICDOT = re.IGNORECASE | re.DOTALL
TITLE_RE = re.compile(r"<title[^>]*>([^<]*)</title>", IC)
META_DESC_RE = re.compile(r'<meta\s+[^>]*name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\']([^"\']*)["\']', IC)
META_NAME_RE = re.compile(r'<meta\s+[^>]*name\s*=\s*["\']([^"\']+)["\'][^>]*content\s*=\s*["\']([^"\']*)["\']', IC)
META_PROP_RE = re.compile(r'<meta\s+[^>]*property\s*=\s*["\']([^"\']+)["\'][^>]*content\s*=\s*["\']([^"\']*)["\']', IC)
CANONICAL_RE = re.compile(r'<link\s+[^>]*rel\s*=\s*["\']canonical["\'][^>]*href\s*=\s*["\']([^"\']+)["\']', IC)
HREFLANG_RE = re.compile(r'<link\s+[^>]*rel\s*=\s*["\']alternate["\'][^>]*hreflang\s*=\s*["\']([^"\']+)["\']', IC)
H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", ICDOT)
JSONLD_RE = re.compile(r'<script\s+[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>', ICDOT)
IMG_RE = re.compile(r"<img\b([^>]*)>", IC)
ALT_ATTR_RE = re.compile(r"\balt\s*=\s*['\"]", IC)
HEAD_RE = re.compile(r"<head[^>]*>(.*?)</head>", ICDOT)
BODY_RE = re.compile(r"<body[^>]*>(.*)", ICDOT)
TAG_STRIP_RE = re.compile(r"<[^>]+>")

STOPWORDS = {
    "the", "and", "for", "with", "from", "your", "you", "are", "our",
    "que", "para", "con", "los", "las", "una", "uno", "del",
    "this", "that", "have", "but", "not", "all", "can", "will",
}


def discover_files(root, only=None):
    """Yield (rel_path, abs_path) for every HTML file we audit."""
    if only:
        target = os.path.normpath(only)
        candidate = target if os.path.isabs(target) else os.path.join(root, target)
        if os.path.isfile(candidate):
            yield os.path.relpath(candidate, root), candidate
        return

    for dp, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        # Prune excluded dirs in-place so os.walk skips them.
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDE_DIRS and not d.startswith(".")
        ]
        if rel_dir != "." and rel_dir.split(os.sep)[0] in EXCLUDE_DIRS:
            continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            abs_path = os.path.join(dp, fn)
            yield os.path.relpath(abs_path, root), abs_path


def extract_text(html_fragment):
    """Strip tags and collapse whitespace from an HTML fragment."""
    txt = TAG_STRIP_RE.sub(" ", html_fragment or "")
    return re.sub(r"\s+", " ", txt).strip()


def keyword_tokens(text):
    """Lowercase substantive tokens (>=4 chars, non-stopword)."""
    tokens = re.findall(r"[A-Za-zÀ-ÿ]+", (text or "").lower())
    return {t for t in tokens if len(t) >= 4 and t not in STOPWORDS}


def audit_title(html, results, rel):
    m = TITLE_RE.search(html)
    if not m:
        results.append((rel, "ERROR", "title", "Missing <title>"))
        return None
    title = m.group(1).strip()
    n = len(title)
    if n < 40 or n > 65:
        results.append((rel, "WARN", "title", f"Title {n} chars (target 50-60): {title!r}"))
    return title


def audit_description(html, results, rel):
    m = META_DESC_RE.search(html)
    if not m:
        results.append((rel, "WARN", "meta-description", "Missing meta description"))
        return None
    desc = m.group(1).strip()
    n = len(desc)
    if n < 120 or n > 170:
        results.append((rel, "WARN", "meta-description", f"Description {n} chars (target 130-160)"))
    return desc


def audit_canonical(html, results, rel):
    m = CANONICAL_RE.search(html)
    if not m:
        results.append((rel, "ERROR", "canonical", "Missing <link rel=\"canonical\">"))
        return None
    href = m.group(1).strip()
    if not href.startswith(CANONICAL_HOST):
        results.append((rel, "ERROR", "canonical", f"Canonical not absolute under {CANONICAL_HOST}: {href}"))
    return href


def audit_hreflang(html, results, rel, is_translated):
    """Translated pages must declare en + es + x-default."""
    if not is_translated:
        return
    langs = {m.group(1).lower() for m in HREFLANG_RE.finditer(html)}
    required = {"en", "es", "x-default"}
    missing = required - langs
    for lang in sorted(missing):
        results.append((rel, "WARN", "hreflang", f'Missing hreflang="{lang}"'))


def audit_h1(html, results, rel, title):
    matches = H1_RE.findall(html)
    if len(matches) == 0:
        results.append((rel, "ERROR", "h1", "No <h1> on page"))
        return
    if len(matches) > 1:
        results.append((rel, "ERROR", "h1", f"Found {len(matches)} <h1> tags (expected 1)"))
    h1_text = extract_text(matches[0])
    if not h1_text:
        results.append((rel, "ERROR", "h1", "<h1> is empty"))
        return
    if title:
        title_words = keyword_tokens(title)
        h1_words = keyword_tokens(h1_text)
        if not (title_words & h1_words):
            results.append((rel, "WARN", "h1-keyword", f"H1 shares no substantive word with title (h1={h1_text!r})"))


def audit_schema(html, results, rel):
    blocks = JSONLD_RE.findall(html)
    if not blocks:
        results.append((rel, "ERROR", "schema", "No <script type=\"application/ld+json\"> block"))
        return
    valid = 0
    for i, block in enumerate(blocks):
        try:
            json.loads(block.strip())
            valid += 1
        except json.JSONDecodeError as exc:
            results.append((rel, "ERROR", "schema", f"JSON-LD block #{i + 1} invalid: {exc.msg}"))
    if valid == 0:
        results.append((rel, "ERROR", "schema", "All JSON-LD blocks failed to parse"))


def audit_brand(html, results, rel):
    body_match = BODY_RE.search(html)
    body = body_match.group(1) if body_match else html
    body_text = extract_text(body).lower()
    if "ivae" not in body_text:
        results.append((rel, "ERROR", "brand", 'No "IVAE" mention in body'))


def audit_alt(html, results, rel):
    missing = 0
    for m in IMG_RE.finditer(html):
        attrs = m.group(1)
        if not ALT_ATTR_RE.search(attrs):
            missing += 1
    if missing:
        results.append((rel, "WARN", "img-alt", f"{missing} <img> tag(s) missing alt attribute"))


def audit_og_twitter(html, results, rel):
    head_match = HEAD_RE.search(html)
    head = head_match.group(1) if head_match else html
    properties = {m.group(1).lower() for m in META_PROP_RE.finditer(head)}
    names = {m.group(1).lower() for m in META_NAME_RE.finditer(head)}

    for prop in ("og:title", "og:description", "og:url", "og:image"):
        if prop not in properties and prop not in names:
            results.append((rel, "WARN", "og", f"Missing {prop}"))

    if "twitter:card" not in names and "twitter:card" not in properties:
        results.append((rel, "WARN", "twitter", "Missing twitter:card"))


def audit_file(rel, abs_path):
    """Run every check on one file and return a list of (rel, severity, check, message)."""
    results = []
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
    except OSError as exc:
        results.append((rel, "ERROR", "io", f"Could not read file: {exc}"))
        return results

    # Translated pages = anything under /es/ tree.
    is_translated = rel.split(os.sep)[0] == "es" or rel.startswith("es/")

    title = audit_title(html, results, rel)
    audit_description(html, results, rel)
    audit_canonical(html, results, rel)
    audit_hreflang(html, results, rel, is_translated)
    audit_h1(html, results, rel, title)
    audit_schema(html, results, rel)
    audit_brand(html, results, rel)
    audit_alt(html, results, rel)
    audit_og_twitter(html, results, rel)
    return results


def render_human(results, file_count, elapsed):
    severities = Counter(r[1] for r in results)
    print("=== SEO Audit Report ===")
    print(f"Files audited: {file_count}")
    print(f"Errors:   {severities['ERROR']}")
    print(f"Warnings: {severities['WARN']}")
    print(f"Elapsed:  {elapsed:.2f}s")
    print()

    by_file = {}
    for rel, sev, check, msg in results:
        by_file.setdefault(rel, []).append((sev, check, msg))

    # Errors first, then warnings — files with errors at the top.
    file_order = sorted(
        by_file.keys(),
        key=lambda f: (-sum(1 for s, _, _ in by_file[f] if s == "ERROR"), f),
    )
    for rel in file_order:
        items = sorted(by_file[rel], key=lambda x: (0 if x[0] == "ERROR" else 1, x[1]))
        for sev, check, msg in items:
            # Grep-friendly: file:line:type:msg (no real line numbers; use 1).
            print(f"{rel}:1:{sev}:{check}: {msg}")


def render_json(results, file_count, elapsed):
    payload = {
        "files_audited": file_count,
        "elapsed_seconds": round(elapsed, 3),
        "errors": sum(1 for r in results if r[1] == "ERROR"),
        "warnings": sum(1 for r in results if r[1] == "WARN"),
        "issues": [
            {"file": rel, "severity": sev, "check": check, "message": msg}
            for rel, sev, check, msg in results
        ],
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    default_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--root", default=default_root, help="Repo root.")
    ap.add_argument("--fail-on-error", action="store_true", help="Exit 1 if any ERROR.")
    ap.add_argument("--json", action="store_true", help="Machine-readable JSON output.")
    ap.add_argument("--page", default=None, help="Audit a single file.")
    args = ap.parse_args()

    start = time.time()
    files = list(discover_files(args.root, only=args.page))
    results = []
    for rel, abs_path in files:
        results.extend(audit_file(rel, abs_path))
    elapsed = time.time() - start

    if args.json:
        render_json(results, len(files), elapsed)
    else:
        render_human(results, len(files), elapsed)

    if args.fail_on_error and any(r[1] == "ERROR" for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
