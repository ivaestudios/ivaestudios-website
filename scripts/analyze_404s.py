#!/usr/bin/env python3
"""IVAE Studios — 404 Redirect Analyzer.

Reads Google Search Console (via the existing service account) for the last
30 days of 4xx errors, cross-references with the local _redirects file,
and suggests new redirect rules for any 404 hits that have an obvious
target.

Output: seo/reports/404-analysis-YYYY-WW.md with:
  * Top 20 404 URLs by impressions (lost traffic)
  * Suggested redirect target for each (heuristics: closest matching live URL)
  * Auto-generated _redirects rules for the obvious ones (in a code block,
    owner reviews + commits)

Usage:
    python3 scripts/analyze_404s.py
    python3 scripts/analyze_404s.py --days 30
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")
REDIRECTS_PATH = os.path.join(REPO_ROOT, "_redirects")

GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
SITE_URLS = ["sc-domain:ivaestudios.com", "https://ivaestudios.com/"]


def load_credentials() -> Any | None:
    raw = os.environ.get("GOOGLE_INDEXING_SA_JSON", "").strip()
    if not raw:
        path = os.environ.get("GOOGLE_INDEXING_SA_FILE", "").strip()
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                raw = f.read()
    if not raw:
        print("WARN: GOOGLE_INDEXING_SA_JSON not set", file=sys.stderr)
        return None
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        return None
    try:
        from google.oauth2 import service_account  # type: ignore
        return service_account.Credentials.from_service_account_info(info, scopes=GSC_SCOPES)
    except ImportError:
        print("WARN: google-auth not installed", file=sys.stderr)
        return None


def fetch_404_urls(creds: Any, days: int = 30) -> list[dict[str, Any]]:
    """Fetch URLs that returned 4xx errors (or had impressions but page issues)
    via GSC search analytics. We can't directly filter by status code, but we
    can use the URL inspection API or read the index coverage report.

    Best approximation via search analytics: fetch top URLs with impressions
    and cross-reference local files to find URLs that are "ghost" (have
    impressions but no local file, suggesting Google indexed something we removed).
    """
    try:
        from googleapiclient.discovery import build  # type: ignore
    except ImportError:
        return []

    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    end = dt.date.today() - dt.timedelta(days=2)
    start = end - dt.timedelta(days=days)
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["page"],
        "rowLimit": 500,
    }
    rows: list[dict[str, Any]] = []
    for site in SITE_URLS:
        try:
            resp = service.searchanalytics().query(siteUrl=site, body=body).execute()
            r = resp.get("rows", [])
            if r:
                rows = r
                break
        except Exception:
            continue
    return rows


def url_to_local_path(url: str) -> str | None:
    """Convert a public URL back to its local file path. Returns None if file doesn't exist."""
    if url.startswith("https://ivaestudios.com"):
        path = url[len("https://ivaestudios.com"):].lstrip("/")
    else:
        return None
    if not path or path.endswith("/"):
        path = (path or "") + "index.html"
    candidates = [path, path + ".html", path + "/index.html", path.rstrip("/") + ".html"]
    for c in candidates:
        if c and os.path.exists(os.path.join(REPO_ROOT, c)):
            return c
    return None


def parse_redirects() -> set[str]:
    """Parse _redirects file and return set of source paths already covered."""
    sources = set()
    if not os.path.exists(REDIRECTS_PATH):
        return sources
    with open(REDIRECTS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if parts:
                sources.add(parts[0])
    return sources


def suggest_redirect_target(broken_url: str, live_files: set[str]) -> str | None:
    """Heuristic: find the closest matching live file."""
    path = broken_url.replace("https://ivaestudios.com", "").strip("/")
    if not path:
        return "/"

    # Normalize candidate token for matching
    token = re.sub(r"[\-_/]", " ", path.lower())
    token_words = set(token.split())
    if not token_words:
        return None

    best: tuple[str, float] | None = None
    for live in live_files:
        live_token = re.sub(r"[\-_/]", " ", live.lower().replace(".html", ""))
        live_words = set(live_token.split())
        if not live_words:
            continue
        overlap = len(token_words & live_words) / max(len(token_words | live_words), 1)
        if overlap > 0.4:
            if best is None or overlap > best[1]:
                target = "/" + live.replace("index.html", "").rstrip("/").replace(".html", "")
                if target == "":
                    target = "/"
                best = (target, overlap)
    return best[0] if best else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--days", type=int, default=30)
    args = ap.parse_args()

    creds = load_credentials()
    if creds is None:
        print("Cannot continue without GSC credentials.")
        return 0

    rows = fetch_404_urls(creds, days=args.days)
    print(f"Fetched {len(rows)} pages from GSC (last {args.days} days)")

    # Find live HTML files
    live_files: set[str] = set()
    for dp, dirs, files in os.walk(REPO_ROOT):
        rel_dir = os.path.relpath(dp, REPO_ROOT)
        if rel_dir != "." and (
            rel_dir.startswith(".") or rel_dir.split(os.sep)[0] in
            {"node_modules", ".git", ".github", "gallery", "functions", "seo", "tools"}
        ):
            continue
        for fn in files:
            if fn.endswith(".html"):
                rel = os.path.relpath(os.path.join(dp, fn), REPO_ROOT).replace(os.sep, "/")
                live_files.add(rel)

    existing_redirects = parse_redirects()

    # Find ghost URLs (in GSC, no local file, no existing redirect)
    ghosts: list[dict[str, Any]] = []
    for row in rows:
        keys = row.get("keys") or []
        if not keys:
            continue
        url = keys[0]
        if url_to_local_path(url) is not None:
            continue  # File exists, no problem
        path = url.replace("https://ivaestudios.com", "")
        if path in existing_redirects:
            continue  # Already redirected
        impressions = int(row.get("impressions") or 0)
        clicks = int(row.get("clicks") or 0)
        if impressions == 0:
            continue
        target = suggest_redirect_target(url, live_files)
        ghosts.append({
            "url": url,
            "impressions": impressions,
            "clicks": clicks,
            "suggested_target": target,
        })

    ghosts.sort(key=lambda g: g["impressions"], reverse=True)

    # Write report
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    os.makedirs(REPORT_DIR, exist_ok=True)
    report_path = os.path.join(REPORT_DIR, f"404-analysis-{iso_year}-W{iso_week:02d}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# 404 Redirect Analysis — {iso_year}-W{iso_week:02d}\n\n")
        f.write(f"GSC pages last {args.days} days: {len(rows)}\n")
        f.write(f"Ghost URLs (404s with impressions): {len(ghosts)}\n\n")
        if not ghosts:
            f.write("No ghost URLs found ✅\n")
        else:
            f.write("## Top ghost URLs (lost traffic)\n\n")
            f.write("| URL | Impressions | Clicks | Suggested redirect |\n")
            f.write("|---|---|---|---|\n")
            for g in ghosts[:20]:
                target = g["suggested_target"] or "(manual review)"
                f.write(f"| {g['url']} | {g['impressions']} | {g['clicks']} | `{target}` |\n")
            f.write("\n## Suggested _redirects entries\n\n")
            f.write("Add these to `_redirects` after manual review:\n\n```\n")
            for g in ghosts[:20]:
                if g["suggested_target"]:
                    src = g["url"].replace("https://ivaestudios.com", "")
                    f.write(f"{src} {g['suggested_target']} 301\n")
            f.write("```\n")

    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
