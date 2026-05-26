#!/usr/bin/env python3
"""
index_marketing_urls.py — Submit IVAE Marketing URLs to Google Indexing API.

This script targets ONLY the IVAE Marketing sub-brand URLs (social media
management vertical). It does NOT submit IVAE Studios photography URLs —
those have their own indexing flow via index_urls.py.

Usage:
  python scripts/index_marketing_urls.py
  python scripts/index_marketing_urls.py https://ivaestudios.com/specific-url

Requires GOOGLE_INDEXING_SA_JSON env var with the service-account JSON
content (used by GitHub Actions) OR GOOGLE_INDEXING_SA_FILE pointing to a
local file.

The Google Indexing API officially supports JobPosting + BroadcastEvent,
but in practice it works on standard pages too. Submitting via this API
notifies Google to recrawl within minutes (vs. days).
"""

import json
import os
import sys
from datetime import datetime

# Marketing URLs to submit — keep this list updated as new pages launch
MARKETING_URLS = [
    # Master pages
    "https://ivaestudios.com/social-media-management",
    "https://ivaestudios.com/es/manejo-redes-sociales",
    # Intake form
    "https://ivaestudios.com/marketing-intake",
    # Industry vertical landing pages (EN)
    "https://ivaestudios.com/social-media-luxury-hotels-mexico",
    "https://ivaestudios.com/social-media-restaurants-cancun",
    "https://ivaestudios.com/social-media-spa-wellness-mexico",
    "https://ivaestudios.com/social-media-dental-clinic-mexico",
    "https://ivaestudios.com/instagram-management-cancun",
    "https://ivaestudios.com/tiktok-agency-hotels-mexico",
    # Industry vertical landing pages (ES)
    "https://ivaestudios.com/es/redes-sociales-hoteles-lujo-mexico",
    "https://ivaestudios.com/es/redes-sociales-restaurantes-cancun",
    "https://ivaestudios.com/es/redes-sociales-spa-wellness-mexico",
    "https://ivaestudios.com/es/redes-sociales-clinica-dental-mexico",
    "https://ivaestudios.com/es/manejo-instagram-cancun",
    "https://ivaestudios.com/es/agencia-tiktok-hoteles-mexico",
    # Blog posts (IVAE Marketing focus)
    "https://ivaestudios.com/post-hotel-instagram-strategy-mexico-2026",
    "https://ivaestudios.com/post-restaurant-social-media-mexico-2026",
    "https://ivaestudios.com/post-dental-clinic-social-media-mexico",
    "https://ivaestudios.com/post-spa-wellness-social-media-mexico",
    "https://ivaestudios.com/post-tiktok-for-luxury-hotels-mexico",
    "https://ivaestudios.com/post-luxury-hospitality-content-strategy-mexico",
]


def get_credentials():
    """Load service-account credentials from env var (JSON content) or file path."""
    try:
        from google.oauth2 import service_account
    except ImportError:
        print("ERROR: google-auth not installed. Run: pip install google-auth google-auth-httplib2 google-api-python-client")
        sys.exit(1)

    scopes = ["https://www.googleapis.com/auth/indexing"]

    if os.environ.get("GOOGLE_INDEXING_SA_JSON"):
        sa_info = json.loads(os.environ["GOOGLE_INDEXING_SA_JSON"])
        return service_account.Credentials.from_service_account_info(sa_info, scopes=scopes)

    sa_file = os.environ.get("GOOGLE_INDEXING_SA_FILE")
    if sa_file and os.path.isfile(sa_file):
        return service_account.Credentials.from_service_account_file(sa_file, scopes=scopes)

    print("ERROR: Neither GOOGLE_INDEXING_SA_JSON nor GOOGLE_INDEXING_SA_FILE is set.")
    sys.exit(2)


def submit_url(service, url, action="URL_UPDATED"):
    """Submit a single URL to the Indexing API."""
    body = {"url": url, "type": action}
    try:
        response = service.urlNotifications().publish(body=body).execute()
        return True, response
    except Exception as e:
        return False, str(e)


def main():
    from googleapiclient.discovery import build

    # Override URLs from command line if provided
    urls = sys.argv[1:] if len(sys.argv) > 1 else MARKETING_URLS

    print(f"=== IVAE Marketing URL indexing run — {datetime.utcnow().isoformat()}Z ===")
    print(f"Submitting {len(urls)} URLs to Google Indexing API.")
    print()

    creds = get_credentials()
    service = build("indexing", "v3", credentials=creds, cache_discovery=False)

    success_count = 0
    failure_count = 0

    for url in urls:
        ok, result = submit_url(service, url)
        if ok:
            success_count += 1
            print(f"  OK   {url}")
        else:
            failure_count += 1
            print(f"  FAIL {url}")
            print(f"       {result}")

    print()
    print(f"=== Summary: {success_count} OK / {failure_count} FAIL ===")
    sys.exit(0 if failure_count == 0 else 3)


if __name__ == "__main__":
    main()
