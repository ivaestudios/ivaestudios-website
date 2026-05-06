#!/usr/bin/env python3
"""IVAE Studios — Bing IndexNow Submission

Submits changed URLs to Bing IndexNow + endpoints that mirror it (Yandex, Naver).

Usage:
    python3 scripts/indexnow_submit.py URL1 URL2 URL3
    python3 scripts/indexnow_submit.py --since-last-deploy   # uses git diff
    python3 scripts/indexnow_submit.py --sitemap             # entire sitemap

Requires environment variable:
    BING_INDEXNOW_KEY  — generate at https://www.bing.com/indexnow/getstarted

The key file (`<KEY>.txt`) MUST be served at https://ivaestudios.com/<KEY>.txt
(Cloudflare Pages serves repo-root files statically by default).

If `BING_INDEXNOW_KEY` is not set, the script logs a warning and exits 0 so
that CI does not fail before the secret has been provisioned.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from xml.etree import ElementTree as ET


HOST = "ivaestudios.com"
SITE_PREFIX = f"https://{HOST}/"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"
SUBMIT_CAP = 1000  # well under the 10k/day quota
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def html_path_to_url(rel_path: str) -> str | None:
    """Map a repo-relative HTML path to its public URL.

    Mirrors Cloudflare Pages' clean-URL behaviour:
      index.html         -> https://ivaestudios.com/
      es/index.html      -> https://ivaestudios.com/es/
      cancun.html        -> https://ivaestudios.com/cancun
      venues/foo/index.html -> https://ivaestudios.com/venues/foo/
    """
    rel = rel_path.lstrip("/")
    if not rel.endswith(".html"):
        return None
    if rel == "index.html":
        return SITE_PREFIX
    if rel.endswith("/index.html"):
        return SITE_PREFIX + rel[: -len("index.html")]
    return SITE_PREFIX + rel[: -len(".html")]


def collect_from_args(extra_args: list[str]) -> list[str]:
    return [u for u in extra_args if u.startswith("http")]


def collect_since_last_deploy() -> list[str]:
    """Use `git log` to find HTML files changed in HEAD's commit."""
    try:
        out = subprocess.check_output(
            ["git", "log", "--name-only", "--pretty=format:", "HEAD~1..HEAD"],
            cwd=REPO_ROOT,
            stderr=subprocess.STDOUT,
        ).decode("utf-8", errors="replace")
    except subprocess.CalledProcessError as e:
        print(
            f"WARN: git diff failed ({e.output.decode('utf-8', errors='replace').strip()}); "
            "falling back to no URLs.",
            file=sys.stderr,
        )
        return []

    urls: list[str] = []
    for line in out.splitlines():
        line = line.strip()
        if not line.endswith(".html"):
            continue
        url = html_path_to_url(line)
        if url:
            urls.append(url)
    return urls


def collect_from_sitemap() -> list[str]:
    """Parse sitemap.xml and return all <loc> values."""
    sitemap_path = os.path.join(REPO_ROOT, "sitemap.xml")
    if not os.path.exists(sitemap_path):
        print(f"WARN: sitemap not found at {sitemap_path}", file=sys.stderr)
        return []
    try:
        tree = ET.parse(sitemap_path)
    except ET.ParseError as e:
        print(f"WARN: sitemap parse error: {e}", file=sys.stderr)
        return []
    # Strip the namespace from tags so .findall("loc") works regardless.
    ns = re.compile(r"^\{[^}]+\}")
    urls: list[str] = []
    for elem in tree.iter():
        if ns.sub("", elem.tag) == "loc" and elem.text:
            urls.append(elem.text.strip())
    return urls


def normalise(urls: list[str]) -> list[str]:
    """Filter to ivaestudios.com URLs, deduplicate, cap."""
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if not u.startswith(SITE_PREFIX):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= SUBMIT_CAP:
            break
    return out


def post_indexnow(key: str, urls: list[str]) -> int:
    """POST to IndexNow. Returns HTTP status code."""
    payload = {
        "host": HOST,
        "key": key,
        "keyLocation": f"{SITE_PREFIX}{key}.txt",
        "urlList": urls,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "ivae-indexnow-bot/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        # IndexNow uses 200/202 for success and 4xx for various validation errors.
        # Surface the body for debugging but don't crash the build.
        body_txt = e.read().decode("utf-8", errors="replace")
        print(f"  IndexNow HTTP {e.code}: {body_txt}", file=sys.stderr)
        return e.code
    except urllib.error.URLError as e:
        print(f"  IndexNow URL error: {e}", file=sys.stderr)
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("urls", nargs="*", help="URLs to submit (positional)")
    parser.add_argument(
        "--since-last-deploy",
        action="store_true",
        help="Read changed *.html in HEAD's commit via git log.",
    )
    parser.add_argument(
        "--sitemap",
        action="store_true",
        help="Submit every <loc> from sitemap.xml.",
    )
    args = parser.parse_args()

    key = os.environ.get("BING_INDEXNOW_KEY", "").strip()
    if not key:
        print(
            "WARN: BING_INDEXNOW_KEY not set — skipping IndexNow submission. "
            "Generate a key at https://www.bing.com/indexnow/getstarted and "
            "save it as a GitHub Secret.",
            file=sys.stderr,
        )
        return 0
    if len(key) < 32:
        print(
            f"WARN: BING_INDEXNOW_KEY looks too short ({len(key)} chars); "
            "IndexNow keys are typically 32+ chars. Skipping.",
            file=sys.stderr,
        )
        return 0

    if args.sitemap:
        urls = collect_from_sitemap()
        source = "sitemap"
    elif args.since_last_deploy:
        urls = collect_since_last_deploy()
        source = "git diff (HEAD~1..HEAD)"
    else:
        urls = collect_from_args(args.urls)
        source = "CLI args"

    urls = normalise(urls)
    if not urls:
        print(f"No URLs to submit (source: {source}).")
        return 0

    print(f"Submitting {len(urls)} URLs to IndexNow (source: {source}):")
    for u in urls[:10]:
        print(f"  - {u}")
    if len(urls) > 10:
        print(f"  ... +{len(urls) - 10} more")

    status = post_indexnow(key, urls)
    print(f"\nIndexNow response: HTTP {status}")
    if status in (200, 202):
        print(f"Submitted {len(urls)} URL(s) successfully.")
        return 0
    # Don't fail the build on IndexNow hiccups — Google Indexing API is the
    # primary submission path and this is a redundant signal for Bing.
    print("IndexNow submission did not succeed but build continues.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
