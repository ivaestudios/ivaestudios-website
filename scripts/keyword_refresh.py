#!/usr/bin/env python3
"""IVAE Studios - Keyword Refresh Agent.

Pulls Google Trends MX, scores candidate keywords, writes:
- seo/data/trending-YYYY-MM-DD.json (timestamped, committed)
- seo/data/latest.json (overwritten each run)

Usage:
    python3 scripts/keyword_refresh.py
    python3 scripts/keyword_refresh.py --dry-run

Requirements:
    pip install pytrends>=4.9

Behavior:
- Reads root terms from seo/keyword-seed.json (24 terms across 4 categories).
- For each root: pytrends.interest_over_time + related_queries (top + rising).
- Aggregates rising queries, filters by must_include_words and competitor_blocklist.
- Scores: (velocity * 0.5) + (relevance * 30 * 0.3) + (intent * 100 * 0.2).
- Writes timestamped + latest JSON outputs.
- Handles 429s by sleeping 60s and retrying once. Skips root term on second
  failure. Exits 0 with a no-results message rather than failing CI.
- --dry-run skips network calls entirely (used to verify the script imports
  and loads config without pytrends installed).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_PATH = os.path.join(REPO_ROOT, "seo", "keyword-seed.json")
DATA_DIR = os.path.join(REPO_ROOT, "seo", "data")

REQUEST_SLEEP_SECONDS = 2.0
RATE_LIMIT_RETRY_SLEEP = 60.0
TOP_N = 30
TIMEFRAME = "today 1-m"  # 30-day window


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


def fetch_root(pytrends, root: str, geo: str) -> list[dict[str, Any]]:
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
        except Exception as exc:  # noqa: BLE001 - pytrends raises many shapes
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

    # Deduplicate by normalized query, keep max velocity seen.
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


def write_outputs(top: list[dict[str, Any]], geo: str, dry_run: bool) -> None:
    fetched_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")

    full = {
        "fetched_at": fetched_at,
        "geo": geo,
        "count": len(top),
        "keywords": top,
    }
    slim = {
        "fetched_at": fetched_at,
        "geo": geo,
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
        "--dry-run",
        action="store_true",
        help="Skip network calls (validates config + script integrity).",
    )
    args = ap.parse_args()

    seed = load_seed()
    roots = flatten_roots(seed)
    geo = seed.get("geo", "MX")
    print(f"=== IVAE keyword refresh (geo={geo}, roots={len(roots)}) ===")

    if args.dry_run:
        print("--- DRY RUN: no pytrends calls ---")
        # Score a fake candidate to exercise the scoring path without network.
        fake = [
            {"query": "fotografo bodas cancun luxury", "value": 80.0},
            {"query": "wedding photographer riviera maya", "value": 60.0},
        ]
        top = aggregate_and_score(fake, seed, roots)
        for k in top:
            print(f"  {k['score']:6.1f}  [{k['category']}]  {k['keyword']}")
        write_outputs(top, geo, dry_run=True)
        return 0

    try:
        from pytrends.request import TrendReq  # type: ignore
    except ImportError:
        print(
            "ERROR: pytrends not installed. Run: pip install 'pytrends>=4.9'",
            file=sys.stderr,
        )
        return 1

    pytrends = TrendReq(hl=seed.get("language", "es-MX"), tz=360)

    raw: list[dict[str, Any]] = []
    for i, (root, _category) in enumerate(roots, 1):
        print(f"  [{i}/{len(roots)}] fetching '{root}'", flush=True)
        rising = fetch_root(pytrends, root, geo)
        raw.extend(rising)
        if i < len(roots):
            time.sleep(REQUEST_SLEEP_SECONDS)

    print(f"  collected {len(raw)} raw rising queries")
    top = aggregate_and_score(raw, seed, roots)

    if not top:
        print("  no rising queries this cycle (after filters); exiting cleanly.")
        # Still write a slim latest.json with empty list so apply_keywords has
        # a deterministic input shape.
        write_outputs([], geo, dry_run=False)
        return 0

    print(f"\n--- Top {len(top)} keywords ---")
    for k in top[:10]:
        print(f"  {k['score']:6.1f}  [{k['category']}]  {k['keyword']}")
    if len(top) > 10:
        print(f"  ... and {len(top) - 10} more")

    write_outputs(top, geo, dry_run=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
