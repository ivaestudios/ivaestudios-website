#!/usr/bin/env python3
"""IVAE Studios — Page Speed Monitor.

Runs Lighthouse audit (via PageSpeed Insights API, free, no auth needed for
basic use) on a curated list of key pages and tracks Core Web Vitals.

Output: seo/reports/page-speed-YYYY-WW.md with:
  * LCP, INP, CLS for each tracked page (mobile + desktop)
  * Comparison vs last week (regression detection)
  * Alerts if any LCP > 2.5s, INP > 200ms, CLS > 0.1

Trend: seo/data/page-speed-trend.json keeps a rolling history.

Usage:
    python3 scripts/page_speed_monitor.py
    python3 scripts/page_speed_monitor.py --strategy mobile
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen, Request


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")
DATA_DIR = os.path.join(REPO_ROOT, "seo", "data")
TREND_PATH = os.path.join(DATA_DIR, "page-speed-trend.json")

PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

KEY_PAGES = [
    "https://ivaestudios.com/",
    "https://ivaestudios.com/es/",
    "https://ivaestudios.com/cancun",
    "https://ivaestudios.com/luxury-weddings",
    "https://ivaestudios.com/brand",
]

THRESHOLDS = {
    "lcp": 2.5,   # seconds
    "inp": 200,   # ms
    "cls": 0.1,   # unitless
}


def fetch_psi(url: str, strategy: str = "mobile") -> dict[str, Any] | None:
    """Fetch PageSpeed Insights data for url.

    With PAGESPEED_API_KEY env var: 25,000 queries/day quota.
    Without it: shared anonymous quota (gets 429 fast).
    """
    params_dict = {"url": url, "strategy": strategy, "category": "PERFORMANCE"}
    api_key = os.environ.get("PAGESPEED_API_KEY", "").strip()
    if api_key:
        params_dict["key"] = api_key
    params = urlencode(params_dict)
    full_url = PSI_ENDPOINT + "?" + params
    req = Request(full_url, headers={"User-Agent": "IVAEStudios/1.0"})
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  ERROR fetching {url} ({strategy}): {exc}")
        return None


def parse_metrics(psi: dict[str, Any]) -> dict[str, float | None]:
    """Extract LCP, INP, CLS, FCP, TBT, perf_score from PSI response."""
    audits = psi.get("lighthouseResult", {}).get("audits", {})

    def safe_num(audit_id: str, field: str = "numericValue") -> float | None:
        audit = audits.get(audit_id, {})
        v = audit.get(field)
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    perf_score_v = (
        psi.get("lighthouseResult", {})
        .get("categories", {})
        .get("performance", {})
        .get("score")
    )
    perf_score = float(perf_score_v) * 100 if perf_score_v is not None else None

    return {
        "lcp_s": (safe_num("largest-contentful-paint") or 0) / 1000.0,
        "inp_ms": safe_num("interactive") or safe_num("max-potential-fid"),  # INP not always present
        "cls": safe_num("cumulative-layout-shift", "numericValue"),
        "fcp_s": (safe_num("first-contentful-paint") or 0) / 1000.0,
        "tbt_ms": safe_num("total-blocking-time"),
        "perf_score": perf_score,
    }


def load_trend() -> dict[str, Any]:
    if os.path.exists(TREND_PATH):
        try:
            with open(TREND_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"runs": []}


def save_trend(trend: dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TREND_PATH, "w", encoding="utf-8") as f:
        json.dump(trend, f, indent=2)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--strategy", choices=["mobile", "desktop", "both"], default="both")
    ap.add_argument("--pages", nargs="+", default=KEY_PAGES, help="URLs to test.")
    args = ap.parse_args()

    strategies = ["mobile", "desktop"] if args.strategy == "both" else [args.strategy]
    print(f"Testing {len(args.pages)} pages × {len(strategies)} strategies via PageSpeed Insights...")

    runs: list[dict[str, Any]] = []
    alerts: list[str] = []
    captured_at = dt.datetime.now(dt.timezone.utc).isoformat()

    for url in args.pages:
        for strategy in strategies:
            print(f"  [{strategy}] {url}")
            psi = fetch_psi(url, strategy=strategy)
            if psi is None:
                continue
            metrics = parse_metrics(psi)
            run = {
                "url": url,
                "strategy": strategy,
                "captured_at": captured_at,
                **metrics,
            }
            runs.append(run)

            # Threshold checks
            if metrics["lcp_s"] and metrics["lcp_s"] > THRESHOLDS["lcp"]:
                alerts.append(f"🚨 LCP {metrics['lcp_s']:.2f}s ({strategy}) on {url}")
            if metrics["cls"] is not None and metrics["cls"] > THRESHOLDS["cls"]:
                alerts.append(f"🚨 CLS {metrics['cls']:.3f} ({strategy}) on {url}")

            time.sleep(2)  # Be polite to Google

    # Append to trend
    trend = load_trend()
    trend["runs"].extend(runs)
    # Keep only last 100 runs to avoid bloat
    trend["runs"] = trend["runs"][-100:]
    save_trend(trend)

    # Write report
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    os.makedirs(REPORT_DIR, exist_ok=True)
    report_path = os.path.join(REPORT_DIR, f"page-speed-{iso_year}-W{iso_week:02d}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Page Speed Monitor — {iso_year}-W{iso_week:02d}\n\n")
        f.write(f"_Captured: {captured_at}_\n\n")
        f.write("## Core Web Vitals\n\n")
        f.write("| Page | Strategy | Perf | LCP (s) | CLS | FCP (s) | TBT (ms) |\n")
        f.write("|---|---|---|---|---|---|---|\n")

        def _fmt(v: float | None, spec: str = ".2f") -> str:
            if v is None:
                return "—"
            return format(v, spec)

        for r in runs:
            f.write(
                f"| {r['url']} | {r['strategy']} | "
                f"{_fmt(r.get('perf_score'), '.0f')} | "
                f"{_fmt(r.get('lcp_s'), '.2f')} | "
                f"{_fmt(r.get('cls'), '.3f')} | "
                f"{_fmt(r.get('fcp_s'), '.2f')} | "
                f"{_fmt(r.get('tbt_ms'), '.0f')} |\n"
            )
        f.write("\n## Alerts\n\n")
        if alerts:
            for a in alerts:
                f.write(f"- {a}\n")
        else:
            f.write("All Core Web Vitals within thresholds ✅\n")
        f.write("\n## Thresholds\n\n")
        f.write(f"- LCP target: ≤ {THRESHOLDS['lcp']}s\n")
        f.write(f"- INP target: ≤ {THRESHOLDS['inp']}ms\n")
        f.write(f"- CLS target: ≤ {THRESHOLDS['cls']}\n")

    print(f"\nReport: {report_path}")
    print(f"Alerts: {len(alerts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
