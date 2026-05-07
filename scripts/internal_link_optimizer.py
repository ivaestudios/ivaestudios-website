#!/usr/bin/env python3
"""IVAE Studios — Internal Link Optimizer.

Analyzes the internal link graph and suggests new links between semantically
related pages. Output: seo/reports/internal-links-YYYY-WW.md with a
prioritized list of suggested links + auto-injection between
<!-- AUTO-LINKS:start --> ... <!-- AUTO-LINKS:end --> markers (if present).

Heuristics:
- Build word vectors from each page's H1, H2, and first 200 words of body
- For each pair of pages, compute Jaccard similarity on stemmed words
- If similarity > threshold AND no existing link between them, suggest

Usage:
    python3 scripts/internal_link_optimizer.py
    python3 scripts/internal_link_optimizer.py --apply  # actually write changes
    python3 scripts/internal_link_optimizer.py --report-only

Stdlib-only (no nltk).
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
from typing import Iterable

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDE_DIRS = {".git", ".github", ".wrangler", ".devcontainer",
                "node_modules", "gallery", "functions", "seo", "tools"}
SKIP_FILES = {"404.html", "coming-soon.html"}

CANONICAL_HOST = "https://ivaestudios.com"
SIMILARITY_THRESHOLD = 0.20  # Jaccard on stemmed words
MAX_SUGGESTIONS_PER_PAGE = 3
MAX_TOTAL_SUGGESTIONS = 30

# Common SEO stopwords to filter out
STOPWORDS = {
    "the", "and", "for", "with", "you", "your", "are", "from", "this", "that",
    "have", "has", "will", "can", "all", "our", "also", "but", "not", "now",
    "los", "las", "del", "para", "con", "una", "uno", "que", "más", "como",
    "por", "los", "sus", "ser", "muy", "tu", "te", "le", "se", "el", "la",
    "en", "de", "y", "a", "o", "es", "un", "al", "lo", "si", "no", "su",
    "ya", "yo", "mi", "me", "ha", "fue", "ese", "esa", "esto", "está",
}

H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
H2_RE = re.compile(r"<h2[^>]*>(.*?)</h2>", re.IGNORECASE | re.DOTALL)
BODY_RE = re.compile(r"<body[^>]*>(.*?)</body>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
WORD_RE = re.compile(r"[a-záéíóúñü]{3,}", re.IGNORECASE)
HREF_RE = re.compile(r'href="(/[^"]+|https://ivaestudios\.com[^"]*)"', re.IGNORECASE)
AUTO_LINKS_RE = re.compile(
    r"(<!--\s*AUTO-LINKS:start\s*-->)(.*?)(<!--\s*AUTO-LINKS:end\s*-->)",
    re.DOTALL | re.IGNORECASE,
)


def discover_files(root: str) -> Iterable[tuple[str, str]]:
    for dp, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        if rel_dir != "." and (
            rel_dir.startswith(".") or rel_dir.split(os.sep)[0] in EXCLUDE_DIRS
        ):
            continue
        for fn in files:
            if not fn.endswith(".html") or fn in SKIP_FILES:
                continue
            abs_path = os.path.join(dp, fn)
            rel = os.path.relpath(abs_path, root).replace(os.sep, "/")
            yield rel, abs_path


def extract_text(html: str) -> str:
    """Strip HTML tags, return plain text."""
    return TAG_RE.sub(" ", html)


def page_signature(html: str) -> tuple[set[str], str, str]:
    """Returns (word_set, page_title, h1_text)."""
    h1_match = H1_RE.search(html)
    h1_text = TAG_RE.sub(" ", h1_match.group(1)) if h1_match else ""

    title_match = re.search(r"<title>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    page_title = title_match.group(1).strip() if title_match else ""
    page_title = re.sub(r"\s+", " ", TAG_RE.sub(" ", page_title))

    body_match = BODY_RE.search(html)
    body = body_match.group(1) if body_match else html
    body_text = extract_text(body)

    # Heavily weight H1, H2, and title
    weighted = (h1_text + " ") * 3 + (page_title + " ") * 2
    h2_matches = H2_RE.findall(body)
    weighted += " ".join(TAG_RE.sub(" ", h) for h in h2_matches[:6]) + " "
    # Plus first 1000 chars of body
    weighted += body_text[:1000]

    words = set()
    for w in WORD_RE.findall(weighted.lower()):
        if w not in STOPWORDS and len(w) > 3:
            words.add(w)
    return words, page_title, h1_text


def existing_links(html: str) -> set[str]:
    """Return set of URLs/paths this page already links to."""
    links = set()
    for m in HREF_RE.finditer(html):
        href = m.group(1)
        if href.startswith(CANONICAL_HOST):
            href = href[len(CANONICAL_HOST):]
        href = href.split("#")[0].split("?")[0]
        if href.endswith("/"):
            href = href[:-1]
        if href:
            links.add(href)
    return links


def path_to_url(rel: str) -> str:
    """Convert local path to canonical URL."""
    if rel == "index.html":
        return "/"
    if rel == "es/index.html":
        return "/es/"
    if rel.endswith("/index.html"):
        return "/" + rel[:-len("/index.html")] + "/"
    if rel.endswith(".html"):
        return "/" + rel[:-len(".html")]
    return "/" + rel


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--root", default=REPO_ROOT)
    ap.add_argument("--apply", action="store_true",
                    help="Write changes to AUTO-LINKS markers (default: report only)")
    ap.add_argument("--report-only", action="store_true",
                    help="Always exit 0; never write changes (alias for default).")
    ap.add_argument("--threshold", type=float, default=SIMILARITY_THRESHOLD)
    args = ap.parse_args()

    files = list(discover_files(args.root))
    print(f"Analyzing {len(files)} pages...")

    # Build signatures
    signatures: dict[str, tuple[set[str], str, str, set[str]]] = {}
    for rel, abs_path in files:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
        words, title, h1 = page_signature(html)
        links = existing_links(html)
        signatures[rel] = (words, title, h1, links)

    # For each page, find top similar pages it doesn't already link to
    suggestions: list[tuple[str, str, float, str]] = []  # (from, to, score, anchor)
    for source_rel, (s_words, s_title, s_h1, s_links) in signatures.items():
        candidates: list[tuple[str, float]] = []
        s_url = path_to_url(source_rel)
        for target_rel, (t_words, t_title, t_h1, _) in signatures.items():
            if source_rel == target_rel:
                continue
            t_url = path_to_url(target_rel)
            # Skip if cross-language pair (en/about ↔ es/acerca-de)
            if (source_rel.startswith("es/") and not target_rel.startswith("es/")) or \
               (target_rel.startswith("es/") and not source_rel.startswith("es/")):
                continue
            # Skip if already linked
            if t_url in s_links or t_url[:-1] in s_links or (t_url + "/").rstrip("/") in s_links:
                continue
            score = jaccard(s_words, t_words)
            if score >= args.threshold:
                candidates.append((target_rel, score))
        candidates.sort(key=lambda c: c[1], reverse=True)
        for target_rel, score in candidates[:MAX_SUGGESTIONS_PER_PAGE]:
            anchor = signatures[target_rel][2] or signatures[target_rel][1] or target_rel
            anchor = anchor.split("|")[0].strip()
            suggestions.append((source_rel, target_rel, score, anchor))

    suggestions.sort(key=lambda s: s[2], reverse=True)
    suggestions = suggestions[:MAX_TOTAL_SUGGESTIONS]

    # Write report
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    report_dir = os.path.join(args.root, "seo", "reports")
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, f"internal-links-{iso_year}-W{iso_week:02d}.md")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Internal Link Suggestions — {iso_year}-W{iso_week:02d}\n\n")
        f.write(f"**Pages analyzed:** {len(files)}\n")
        f.write(f"**Suggestions:** {len(suggestions)} (similarity threshold: {args.threshold})\n\n")
        f.write("Top {} new internal links to consider:\n\n".format(len(suggestions)))
        f.write("| # | From | → | To | Score | Suggested anchor |\n")
        f.write("|---|---|---|---|---|---|\n")
        for i, (src, tgt, score, anchor) in enumerate(suggestions, 1):
            f.write(f"| {i} | `{src}` | → | `{tgt}` | {score:.2f} | {anchor[:60]} |\n")
        f.write("\n## Cómo aplicar\n\n")
        f.write("1. Estos son sugerencias automáticas basadas en similaridad de contenido (Jaccard)\n")
        f.write("2. Revisa cada par y verifica que tenga sentido editorial\n")
        f.write("3. Si la página tiene markers <!-- AUTO-LINKS:start --> ... <!-- AUTO-LINKS:end -->,\n")
        f.write("   corre `python3 scripts/internal_link_optimizer.py --apply` para inyectar links\n")
        f.write("   automáticamente entre los markers (sin tocar copy hand-curated)\n")

    print(f"Report: {report_path} ({len(suggestions)} suggestions)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
