#!/usr/bin/env python3
"""
Submit URLs to the Google Indexing API.

Cloud-native: reads the service account JSON from the `GOOGLE_INDEXING_SA_JSON`
environment variable (GitHub Secret), NOT from a local file. This script is
safe to live in a public repo.

URLs can come from four places, in order of precedence:
  1. CLI args:            python index_urls.py https://a.com/ https://a.com/es/
  2. --source trends:     URLs listed in seo/data/latest.json (changed_pages)
  3. URLS_FILE env var:   path to a newline-delimited list of URLs
  4. Default list:        the 21 high-priority April 2026 audit URLs

Quota: Google Indexing API allows 200 notifications/day per project.
"""
import argparse
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

# Google client libs are imported lazily inside main() so that no-op invocations
# (e.g. `--source trends` with an empty seo/data/latest.json, or `--help`) work
# in environments where the deps aren't installed.

SCOPES = ["https://www.googleapis.com/auth/indexing"]

# Default: high-priority URLs changed in the April 21 2026 deep SEO audit.
DEFAULT_URLS = [
    # Home pages (JSON-LD cleanup)
    "https://ivaestudios.com/",
    "https://ivaestudios.com/es/",
    # About
    "https://ivaestudios.com/about",
    "https://ivaestudios.com/es/acerca-de",
    # Location pages
    "https://ivaestudios.com/cancun-photographer",
    "https://ivaestudios.com/riviera-maya-photographer",
    "https://ivaestudios.com/cabo-photographer",
    "https://ivaestudios.com/es/fotografo-cancun",
    "https://ivaestudios.com/es/fotografo-riviera-maya",
    "https://ivaestudios.com/es/fotografo-los-cabos",
    # Service pages
    "https://ivaestudios.com/destination-wedding-photographer-mexico",
    "https://ivaestudios.com/luxury-family-photos-cancun",
    "https://ivaestudios.com/couples-photography-mexico",
    "https://ivaestudios.com/es/fotografo-bodas-destino-mexico",
    "https://ivaestudios.com/es/fotos-familiares-lujo-cancun",
    "https://ivaestudios.com/es/fotografia-parejas-mexico",
    # Standalone
    "https://ivaestudios.com/outfit-guide",
    "https://ivaestudios.com/es/guia-vestuario",
    # Blog indexes
    "https://ivaestudios.com/blog",
    "https://ivaestudios.com/es/blog",
    # SMM (redirect retargeted)
    "https://ivaestudios.com/es/manejo-redes-sociales",
]


def load_credentials():
    """Load service account credentials from env var (preferred) or file path."""
    from google.oauth2 import service_account  # type: ignore

    sa_json = os.environ.get("GOOGLE_INDEXING_SA_JSON")
    if sa_json:
        info = json.loads(sa_json)
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    sa_path = os.environ.get("GOOGLE_INDEXING_SA_FILE")
    if sa_path and os.path.exists(sa_path):
        return service_account.Credentials.from_service_account_file(sa_path, scopes=SCOPES)
    print(
        "ERROR: No credentials found.\n"
        "  Set GOOGLE_INDEXING_SA_JSON (full JSON content) or\n"
        "  GOOGLE_INDEXING_SA_FILE (path to JSON file).",
        file=sys.stderr,
    )
    sys.exit(1)


def collect_from_trends():
    """Read URLs from `seo/data/latest.json` (written by keyword_refresh).

    Expected shape: {"changed_pages": ["https://...", "..."]}.
    Missing or malformed file -> empty list (caller decides what to do).
    """
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    latest = os.path.join(repo_root, "seo", "data", "latest.json")
    if not os.path.exists(latest):
        return []
    try:
        with open(latest, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARN: could not read {latest}: {e}", file=sys.stderr)
        return []
    pages = data.get("changed_pages") or []
    return [u for u in pages if isinstance(u, str) and u.startswith("http")]


def collect_urls(use_trends: bool, positional: list[str]):
    """Resolve which URLs to submit."""
    # Explicit positional CLI args always win
    if positional:
        return [u for u in positional if u.startswith("http")]
    if use_trends:
        return collect_from_trends()
    # File path from env
    urls_file = os.environ.get("URLS_FILE")
    if urls_file and os.path.exists(urls_file):
        with open(urls_file) as f:
            return [ln.strip() for ln in f if ln.strip() and ln.strip().startswith("http")]
    # Default
    return DEFAULT_URLS


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--source",
        choices=["trends"],
        help="Read URLs from seo/data/latest.json (changed_pages list).",
    )
    parser.add_argument("urls", nargs="*", help="URLs to submit (positional).")
    args = parser.parse_args()

    use_trends = args.source == "trends"
    urls = collect_urls(use_trends, args.urls)
    if use_trends and not urls:
        # Trends source with no data is a no-op success — exit 0 so a
        # workflow chained off keyword_refresh doesn't fail when no pages
        # changed this week.
        print("No URLs in seo/data/latest.json — nothing to submit.")
        sys.exit(0)
    if not urls:
        print("No URLs to submit.")
        sys.exit(0)

    creds = load_credentials()
    from googleapiclient.discovery import build  # type: ignore
    from googleapiclient.errors import HttpError  # type: ignore

    service = build("indexing", "v3", credentials=creds, cache_discovery=False)

    ok = 0
    fail = 0
    for url in urls:
        try:
            service.urlNotifications().publish(
                body={"url": url, "type": "URL_UPDATED"}
            ).execute()
            print(f"  OK   {url}")
            ok += 1
        except HttpError as e:
            print(f"  FAIL {url} — {e.status_code} {e.reason}")
            fail += 1

    print(f"\n--- Summary: {ok} OK / {fail} FAIL / {len(urls)} total ---")
    # Exit nonzero if anything failed, so GitHub Actions surfaces the error
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
