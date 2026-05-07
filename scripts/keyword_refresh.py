#!/usr/bin/env python3
"""IVAE Studios - Keyword Refresh Agent.

Pulls real query data from Google Search Console (default) or Google Trends
(legacy fallback), scores candidates against the seed config, and writes:
- seo/data/trending-YYYY-MM-DD.json (timestamped, committed)
- seo/data/latest.json (overwritten each run; consumed by apply_keywords.py)

Usage:
    python3 scripts/keyword_refresh.py                  # GSC by default
    python3 scripts/keyword_refresh.py --source gsc     # explicit
    python3 scripts/keyword_refresh.py --source pytrends
    python3 scripts/keyword_refresh.py --dry-run

Why GSC over pytrends:
    Pytrends is increasingly rate-limited by Google (HTTP 429) from both
    home IPs and GitHub Actions runners (2024-2025). GSC is more reliable,
    and gives BETTER data: actual queries that already drove impressions
    on ivaestudios.com — not generic Mexico trends. Optimizing for queries
    where we already rank in positions 4-15 has the highest ROI.

Requirements:
    GSC mode  : GOOGLE_INDEXING_SA_JSON env var (service account with
                webmasters.readonly scope and Owner access on the GSC
                property). The same secret used by index_urls.py works.
    Pytrends  : pip install pytrends>=4.9

Behavior:
- Reads root terms + filters from seo/keyword-seed.json.
- GSC mode: pulls top 200 queries from last 30 days for all 4 GSC site URLs;
  filters by must_include_words and competitor_blocklist; scores by
  (impressions weighted by position-improvement-potential * 0.5) +
  (relevance * 30 * 0.3) + (intent * 100 * 0.2).
- Pytrends mode: same scoring against pytrends.related_queries rising lists.
- Writes timestamped + latest JSON outputs.
- On any auth or API failure, exits 0 with a no-results latest.json (so
  apply_keywords still has a deterministic input).
- --dry-run skips network calls entirely.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import warnings
from typing import Any

warnings.filterwarnings("ignore")


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_PATH = os.path.join(REPO_ROOT, "seo", "keyword-seed.json")
DATA_DIR = os.path.join(REPO_ROOT, "seo", "data")

REQUEST_SLEEP_SECONDS = 2.0
RATE_LIMIT_RETRY_SLEEP = 60.0
TOP_N = 30
TIMEFRAME = "today 1-m"  # 30-day window (pytrends path)

# GSC settings
GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
GSC_SITE_URLS = [
    # Try Domain property first (covers http/https + www variants), then
    # URL-prefix variants. The script picks the first one it can authenticate
    # against.
    "sc-domain:ivaestudios.com",
    "https://ivaestudios.com/",
]
GSC_DAYS_BACK = 30
GSC_ROW_LIMIT = 200


def load_seed() -> dict[str, Any]:
    """Load and minimally validate the seed config."""
    if not os.path.exists(SEED_PATH):
        print(f"ERROR: seed file not found at {SEED_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)
    for required in ("categories", "filters", "scoring", "geo"):
        if required not in seed:
            print(f"ERROR: seed missing required key '{required}'", file=sys.stderr)
            sys.exit(1)
    return seed


def flatten_roots(seed: dict[str, Any]) -> list[tuple[str, str]]:
    """Return [(root_term, category), ...] across all categories."""
    out: list[tuple[str, str]] = []
    for category, terms in seed["categories"].items():
        for term in terms:
            out.append((term, category))
    return out


def normalize(text: str) -> str:
    return (text or "").lower().strip()


def passes_filters(candidate: str, filters: dict[str, Any]) -> bool:
    """A candidate must include at least one must_include_word and contain
    no competitor_blocklist substring."""
    norm = normalize(candidate)
    if not norm:
        return False
    must = [w.lower() for w in filters.get("must_include_words", [])]
    if must and not any(word in norm for word in must):
        return False
    block = [w.lower() for w in filters.get("competitor_blocklist", [])]
    for bad in block:
        if bad and bad in norm:
            return False
    return True


def relevance_score(candidate: str, roots: list[tuple[str, str]]) -> int:
    """Count how many root terms share at least one word with the candidate."""
    cand_words = {w for w in normalize(candidate).split() if len(w) > 2}
    if not cand_words:
        return 0
    matches = 0
    for root, _ in roots:
        root_words = {w for w in normalize(root).split() if len(w) > 2}
        if cand_words & root_words:
            matches += 1
    return matches


def intent_signal(candidate: str, commercial_words: list[str]) -> float:
    norm = normalize(candidate)
    return 1.5 if any(w.lower() in norm for w in commercial_words) else 1.0


def best_category_for(candidate: str, roots: list[tuple[str, str]]) -> str:
    """Pick the category whose roots share the most words with the candidate."""
    cand_words = {w for w in normalize(candidate).split() if len(w) > 2}
    if not cand_words:
        return "destinations"
    counts: dict[str, int] = {}
    for root, category in roots:
        root_words = {w for w in normalize(root).split() if len(w) > 2}
        overlap = len(cand_words & root_words)
        if overlap:
            counts[category] = counts.get(category, 0) + overlap
    if not counts:
        return "destinations"
    return max(counts.items(), key=lambda kv: kv[1])[0]


# ===== GSC source =====================================================


def load_gsc_credentials() -> Any | None:
    """Load service account credentials from GOOGLE_INDEXING_SA_JSON.

    Returns google.oauth2.service_account.Credentials, or None if the secret
    is missing / malformed / google libs not installed.
    """
    raw = os.environ.get("GOOGLE_INDEXING_SA_JSON", "").strip()
    if not raw:
        path = os.environ.get("GOOGLE_INDEXING_SA_FILE", "").strip()
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                raw = f.read()
    if not raw:
        print(
            "WARN: GOOGLE_INDEXING_SA_JSON not set — cannot use GSC source.",
            flush=True,
        )
        return None
    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"WARN: GOOGLE_INDEXING_SA_JSON is not valid JSON: {exc}", flush=True)
        return None
    try:
        from google.oauth2 import service_account  # type: ignore
    except ImportError:
        print(
            "WARN: google-auth not installed; install with "
            "`pip install google-auth google-api-python-client`",
            flush=True,
        )
        return None
    try:
        return service_account.Credentials.from_service_account_info(
            info, scopes=GSC_SCOPES
        )
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: failed to build GSC credentials: {exc}", flush=True)
        return None


def fetch_gsc_queries(creds: Any, days_back: int = GSC_DAYS_BACK) -> list[dict[str, Any]]:
    """Pull top queries from Search Console for the last `days_back` days.

    Tries each GSC_SITE_URLS until one returns data. Returns a normalized
    list of {"query": str, "value": float} where value is a composite of
    impressions + position-improvement-potential.
    """
    try:
        from googleapiclient.discovery import build  # type: ignore
    except ImportError:
        print("WARN: googleapiclient not installed", flush=True)
        return []

    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    end = dt.date.today() - dt.timedelta(days=2)  # GSC has ~2-day reporting lag
    start = end - dt.timedelta(days=days_back)
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["query"],
        "rowLimit": GSC_ROW_LIMIT,
        "type": "web",
    }

    rows: list[dict[str, Any]] = []
    for site in GSC_SITE_URLS:
        try:
            resp = (
                service.searchanalytics()
                .query(siteUrl=site, body=body)
                .execute()
            )
            r = resp.get("rows", [])
            if r:
                print(
                    f"  GSC: {len(r)} queries from {site} "
                    f"({start.isoformat()} → {end.isoformat()})",
                    flush=True,
                )
                rows = r
                break
            print(f"  GSC: 0 rows from {site} — trying next URL", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  GSC: error on {site} — {exc}", flush=True)

    out: list[dict[str, Any]] = []
    for row in rows:
        keys = row.get("keys") or []
        if not keys:
            continue
        query = str(keys[0]).strip()
        if not query:
            continue
        impressions = float(row.get("impressions") or 0)
        position = float(row.get("position") or 100)
        # Score component: impressions weighted by position-improvement-potential.
        # Pages already in top 3 get less rotation budget than pages in 4-15
        # where small content tweaks can move the needle.
        position_factor = 1.0 if position <= 3 else 1.5 if position <= 10 else 1.0
        value = impressions * position_factor
        out.append({"query": query, "value": value})
    return out


# ===== Pytrends source (legacy) =======================================


def fetch_pytrends_root(
    pytrends: Any, root: str, geo: str
) -> list[dict[str, Any]]:
    """Fetch rising related_queries for a single root term, with one retry on 429."""
    for attempt in (1, 2):
        try:
            pytrends.build_payload([root], cat=0, timeframe=TIMEFRAME, geo=geo)
            related = pytrends.related_queries() or {}
            payload = related.get(root) or {}
            rising = payload.get("rising")
            if rising is None or rising.empty:
                return []
            out = []
            for _, row in rising.iterrows():
                query = str(row.get("query", "")).strip()
                value = row.get("value", 0)
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    value = 0.0
                if query:
                    out.append({"query": query, "value": value})
            return out
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).lower()
            is_rate_limit = "429" in msg or "too many" in msg or "rate" in msg
            if attempt == 1 and is_rate_limit:
                print(
                    f"  rate-limited on '{root}', sleeping {RATE_LIMIT_RETRY_SLEEP}s",
                    flush=True,
                )
                time.sleep(RATE_LIMIT_RETRY_SLEEP)
                continue
            print(f"  WARN: skipping '{root}' - {exc}", flush=True)
            return []
    return []


# ===== Aggregation + scoring (source-agnostic) ========================


def aggregate_and_score(
    raw: list[dict[str, Any]],
    seed: dict[str, Any],
    roots: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    filters = seed.get("filters", {})
    scoring = seed.get("scoring", {})
    commercial = scoring.get("commercial_intent_keywords", [])
    weights = (
        float(scoring.get("trend_velocity_weight", 0.5)),
        float(scoring.get("relevance_weight", 0.3)),
        float(scoring.get("intent_weight", 0.2)),
    )

    by_query: dict[str, dict[str, Any]] = {}
    for item in raw:
        norm = normalize(item["query"])
        if not norm:
            continue
        if not passes_filters(norm, filters):
            continue
        prev = by_query.get(norm)
        velocity = float(item.get("value", 0.0))
        if prev is None or velocity > prev["velocity"]:
            by_query[norm] = {"query": item["query"], "velocity": velocity}

    scored: list[dict[str, Any]] = []
    for norm, payload in by_query.items():
        velocity = payload["velocity"]
        relevance = relevance_score(payload["query"], roots)
        intent = intent_signal(payload["query"], commercial)
        score = (
            velocity * weights[0]
            + relevance * 30 * weights[1]
            + intent * 100 * weights[2]
        )
        scored.append(
            {
                "keyword": payload["query"],
                "category": best_category_for(payload["query"], roots),
                "velocity": round(velocity, 2),
                "relevance": relevance,
                "intent": intent,
                "score": round(score, 2),
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:TOP_N]


def write_outputs(top: list[dict[str, Any]], geo: str, source: str, dry_run: bool) -> None:
    fetched_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")

    full = {
        "fetched_at": fetched_at,
        "geo": geo,
        "source": source,
        "count": len(top),
        "keywords": top,
    }
    slim = {
        "fetched_at": fetched_at,
        "geo": geo,
        "source": source,
        "keywords": [
            {"keyword": k["keyword"], "category": k["category"], "score": k["score"]}
            for k in top
        ],
    }

    if dry_run:
        print("--- DRY RUN: skipping file writes ---")
        print(f"would write {len(top)} keywords")
        return

    os.makedirs(DATA_DIR, exist_ok=True)
    full_path = os.path.join(DATA_DIR, f"trending-{today}.json")
    latest_path = os.path.join(DATA_DIR, "latest.json")
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(full, f, indent=2, ensure_ascii=False)
        f.write("\n")
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(slim, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {full_path}")
    print(f"  wrote {latest_path}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--source",
        choices=["gsc", "pytrends"],
        default="gsc",
        help="Data source for keyword discovery (default: gsc).",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip network calls (validates config + script integrity).",
    )
    args = ap.parse_args()

    seed = load_seed()
    roots = flatten_roots(seed)
    geo = seed.get("geo", "MX")
    print(
        f"=== IVAE keyword refresh (source={args.source}, geo={geo}, "
        f"roots={len(roots)}) ==="
    )

    if args.dry_run:
        print(f"--- DRY RUN: no {args.source} calls ---")
        fake = [
            {"query": "fotografo bodas cancun luxury", "value": 80.0},
            {"query": "wedding photographer riviera maya", "value": 60.0},
        ]
        top = aggregate_and_score(fake, seed, roots)
        for k in top:
            print(f"  {k['score']:6.1f}  [{k['category']}]  {k['keyword']}")
        write_outputs(top, geo, args.source, dry_run=True)
        return 0

    raw: list[dict[str, Any]] = []

    if args.source == "gsc":
        creds = load_gsc_credentials()
        if creds is None:
            print(
                "  GSC credentials unavailable; writing empty latest.json "
                "and exiting cleanly.",
                flush=True,
            )
            write_outputs([], geo, args.source, dry_run=False)
            return 0
        raw = fetch_gsc_queries(creds)
        print(f"  collected {len(raw)} GSC queries")

    else:  # pytrends
        try:
            from pytrends.request import TrendReq  # type: ignore
        except ImportError:
            print(
                "ERROR: pytrends not installed. Run: pip install 'pytrends>=4.9'",
                file=sys.stderr,
            )
            return 1
        pytrends = TrendReq(hl=seed.get("language", "es-MX"), tz=360)
        for i, (root, _category) in enumerate(roots, 1):
            print(f"  [{i}/{len(roots)}] fetching '{root}'", flush=True)
            rising = fetch_pytrends_root(pytrends, root, geo)
            raw.extend(rising)
            if i < len(roots):
                time.sleep(REQUEST_SLEEP_SECONDS)
        print(f"  collected {len(raw)} raw rising queries")

    top = aggregate_and_score(raw, seed, roots)

    if not top:
        print("  no qualifying queries this cycle (after filters); exiting cleanly.")
        write_outputs([], geo, args.source, dry_run=False)
        return 0

    print(f"\n--- Top {len(top)} keywords ---")
    for k in top[:10]:
        print(f"  {k['score']:6.1f}  [{k['category']}]  {k['keyword']}")
    if len(top) > 10:
        print(f"  ... and {len(top) - 10} more")

    write_outputs(top, geo, args.source, dry_run=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
