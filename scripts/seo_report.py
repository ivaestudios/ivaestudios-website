#!/usr/bin/env python3
"""IVAE Studios — Weekly SEO Report

Pulls Google Search Console for top 50 queries, computes deltas, writes:
- seo/reports/YYYY-WW.md

Usage:
    python3 scripts/seo_report.py
    python3 scripts/seo_report.py --week 2026-19   # specific ISO week

Re-uses the existing `GOOGLE_INDEXING_SA_JSON` secret. NOTE: the service
account must have the Search Console API scope added AND be granted access
to the `sc-domain:ivaestudios.com` (or `https://ivaestudios.com/`) property
in Search Console → Settings → Users and permissions.

If credentials or the GSC scope are missing, the script writes a stub report
explaining the requirement and exits 0 — the caller decides whether to fail.

A regression of >10 positions on any query opens a GitHub Issue (label
`seo:regression`) via `gh` if available; otherwise the script just prints
the regression list to stdout.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import warnings
from typing import Any

warnings.filterwarnings("ignore")


GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
SITE_URLS = [
    # GSC accepts either "sc-domain:..." (Domain property) or
    # "https://ivaestudios.com/" (URL-prefix property). Try both.
    "sc-domain:ivaestudios.com",
    "https://ivaestudios.com/",
]
TOP_N = 50
WINNERS_LOSERS = 10
REGRESSION_DROP = 10
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")
BRAND_QUERIES = ["ivae studios", "ivaestudios", "fotografo cancun"]


def parse_iso_week(spec: str) -> tuple[int, int]:
    """Parse 'YYYY-WW' into (year, week)."""
    year_s, week_s = spec.split("-", 1)
    return int(year_s), int(week_s)


def week_window(year: int, week: int) -> tuple[dt.date, dt.date]:
    """ISO week → (Monday, Sunday)."""
    monday = dt.date.fromisocalendar(year, week, 1)
    return monday, monday + dt.timedelta(days=6)


def stub_report(year: int, week: int, reason: str) -> str:
    return (
        f"# IVAE Studios SEO Report — Week {year}-{week:02d}\n\n"
        f"_Stub report — no data fetched._\n\n"
        f"**Reason:** {reason}\n\n"
        f"To enable live reports:\n\n"
        "1. In Google Cloud Console → APIs & Services, enable **Search Console API** "
        "for the project that owns the `GOOGLE_INDEXING_SA_JSON` service account.\n"
        "2. In [Search Console → Settings → Users and permissions], add the service "
        "account email as a user with **Full** access on the `ivaestudios.com` property.\n"
        "3. Re-run this workflow (Actions → SEO — Weekly Report → Run workflow).\n"
    )


def write_report(year: int, week: int, body: str) -> str:
    os.makedirs(REPORT_DIR, exist_ok=True)
    path = os.path.join(REPORT_DIR, f"{year}-{week:02d}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    return path


def try_load_credentials() -> Any:
    """Return a credentials object or None if unavailable."""
    sa_json = os.environ.get("GOOGLE_INDEXING_SA_JSON")
    if not sa_json:
        return None
    try:
        from google.oauth2 import service_account  # type: ignore
    except ImportError:
        return None
    try:
        info = json.loads(sa_json)
        return service_account.Credentials.from_service_account_info(
            info, scopes=GSC_SCOPES
        )
    except (ValueError, json.JSONDecodeError) as e:
        print(f"WARN: bad GOOGLE_INDEXING_SA_JSON: {e}", file=sys.stderr)
        return None


def query_gsc(service: Any, site_url: str, start: dt.date, end: dt.date) -> list[dict]:
    """Run a top-queries query against GSC. Returns rows or []."""
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["query"],
        "rowLimit": TOP_N,
        "dataState": "all",
    }
    try:
        resp = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
    except Exception as e:  # noqa: BLE001 — surfacing any GSC error
        print(f"WARN: GSC query failed for {site_url}: {e}", file=sys.stderr)
        return []
    return resp.get("rows", []) or []


def index_by_query(rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in rows:
        keys = r.get("keys") or []
        if not keys:
            continue
        q = keys[0]
        out[q] = {
            "position": float(r.get("position", 0.0)),
            "clicks": int(r.get("clicks", 0)),
            "impressions": int(r.get("impressions", 0)),
            "ctr": float(r.get("ctr", 0.0)),
        }
    return out


def fmt_delta(prev_pos: float | None, cur_pos: float) -> tuple[str, float]:
    """Return (display string, signed delta where positive = rank improved)."""
    if prev_pos is None:
        return ("new", 0.0)
    # GSC position: lower number = better. Δ "improvement" = prev - cur.
    delta = prev_pos - cur_pos
    if delta > 0:
        return (f"↑ {delta:.1f}", delta)
    if delta < 0:
        return (f"↓ {abs(delta):.1f}", delta)
    return ("—", 0.0)


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "_None._\n"
    parts = ["| " + " | ".join(headers) + " |"]
    parts.append("|" + "|".join("---" for _ in headers) + "|")
    for r in rows:
        parts.append("| " + " | ".join(r) + " |")
    return "\n".join(parts) + "\n"


def build_report(
    year: int,
    week: int,
    cur: dict[str, dict],
    prev: dict[str, dict],
) -> tuple[str, list[dict]]:
    """Return (markdown body, regressions list)."""
    monday, sunday = week_window(year, week)
    lines: list[str] = []
    lines.append(f"# IVAE Studios SEO Report — Week {year}-{week:02d}")
    lines.append("")
    lines.append(f"_Window: {monday.isoformat()} → {sunday.isoformat()} (UTC)_")
    lines.append("")
    lines.append(
        f"Tracked queries this week: **{len(cur)}** "
        f"(previous week: **{len(prev)}**)."
    )
    lines.append("")

    # Compute movement for queries that exist in both windows
    movements: list[dict] = []
    for q, cur_row in cur.items():
        prev_row = prev.get(q)
        prev_pos = prev_row["position"] if prev_row else None
        delta_str, delta = fmt_delta(prev_pos, cur_row["position"])
        movements.append(
            {
                "query": q,
                "position": cur_row["position"],
                "delta": delta,
                "delta_str": delta_str,
                "impressions": cur_row["impressions"],
                "clicks": cur_row["clicks"],
                "is_new": prev_row is None,
            }
        )

    # Winners (largest positive delta), losers (largest negative delta)
    movers = [m for m in movements if not m["is_new"]]
    winners = sorted(movers, key=lambda m: -m["delta"])[:WINNERS_LOSERS]
    losers = sorted(movers, key=lambda m: m["delta"])[:WINNERS_LOSERS]

    def row_for(m: dict) -> list[str]:
        return [
            m["query"],
            f"{m['position']:.1f}",
            m["delta_str"],
            f"{m['impressions']:,}",
            f"{m['clicks']:,}",
        ]

    lines.append(f"## Top {WINNERS_LOSERS} winners (rank ↑)")
    lines.append("")
    lines.append(
        md_table(
            ["Query", "Position", "Δ", "Impressions", "Clicks"],
            [row_for(m) for m in winners if m["delta"] > 0],
        )
    )

    lines.append(f"## Top {WINNERS_LOSERS} losers (rank ↓)")
    lines.append("")
    lines.append(
        md_table(
            ["Query", "Position", "Δ", "Impressions", "Clicks"],
            [row_for(m) for m in losers if m["delta"] < 0],
        )
    )

    # New / lost
    new_keywords = [
        m["query"]
        for m in movements
        if m["is_new"] and m["position"] <= 100
    ]
    cur_keys = set(cur.keys())
    lost_keywords = [q for q in prev.keys() if q not in cur_keys]

    lines.append("## New ranking keywords (entered top 100)")
    lines.append("")
    if new_keywords:
        for q in new_keywords[:25]:
            lines.append(f"- {q}")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Lost keywords (dropped from top 100)")
    lines.append("")
    if lost_keywords:
        for q in lost_keywords[:25]:
            lines.append(f"- {q}")
    else:
        lines.append("_None._")
    lines.append("")

    # Regressions: drop > REGRESSION_DROP positions = delta < -REGRESSION_DROP
    regressions = [m for m in movers if m["delta"] < -REGRESSION_DROP]
    lines.append(f"## Suspected regressions (drops > {REGRESSION_DROP} positions)")
    lines.append("")
    if regressions:
        lines.append(
            md_table(
                ["Query", "Position", "Δ", "Impressions", "Clicks"],
                [row_for(m) for m in regressions],
            )
        )
    else:
        lines.append("None.")
        lines.append("")

    # Brand queries
    lines.append("## Brand queries")
    lines.append("")
    for bq in BRAND_QUERIES:
        row = cur.get(bq) or cur.get(bq.lower())
        if row:
            lines.append(
                f'- "{bq}": position {row["position"]:.1f} '
                f'({row["impressions"]:,} impressions, {row["clicks"]:,} clicks)'
            )
        else:
            lines.append(f'- "{bq}": _no data this week_')
    lines.append("")

    return "\n".join(lines), regressions


def open_regression_issue(year: int, week: int, regressions: list[dict]) -> None:
    """Open a GitHub Issue via `gh` if any regression is severe enough."""
    if not regressions:
        return
    if not shutil.which("gh"):
        print(
            "INFO: gh CLI not available; skipping issue creation. Regressions:",
            file=sys.stderr,
        )
        for r in regressions:
            print(f"  - {r['query']}: Δ {r['delta']:+.1f}", file=sys.stderr)
        return
    title = f"SEO regression — Week {year}-{week:02d} ({len(regressions)} queries dropped >{REGRESSION_DROP} pos)"
    body_lines = [
        f"Detected {len(regressions)} query regressions (drop > {REGRESSION_DROP} positions) "
        f"in week {year}-{week:02d}.",
        "",
        "| Query | Position | Δ | Impressions | Clicks |",
        "|---|---|---|---|---|",
    ]
    for r in regressions:
        body_lines.append(
            f"| {r['query']} | {r['position']:.1f} | {r['delta_str']} | "
            f"{r['impressions']:,} | {r['clicks']:,} |"
        )
    body_lines.append("")
    body_lines.append(f"See `seo/reports/{year}-{week:02d}.md` for full report.")
    try:
        subprocess.run(
            [
                "gh",
                "issue",
                "create",
                "--title",
                title,
                "--body",
                "\n".join(body_lines),
                "--label",
                "seo:regression",
            ],
            check=True,
            cwd=REPO_ROOT,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"WARN: could not open regression issue: {e}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--week",
        help="ISO week 'YYYY-WW' (defaults to last completed week).",
    )
    args = parser.parse_args()

    if args.week:
        year, week = parse_iso_week(args.week)
    else:
        # Default: last completed week (run on Monday → previous week).
        today = dt.date.today()
        last_week = today - dt.timedelta(days=7)
        iso = last_week.isocalendar()
        year, week = iso[0], iso[1]

    monday, sunday = week_window(year, week)
    prev_monday = monday - dt.timedelta(days=7)
    prev_sunday = sunday - dt.timedelta(days=7)

    creds = try_load_credentials()
    if creds is None:
        body = stub_report(
            year,
            week,
            "Run requires GOOGLE_INDEXING_SA_JSON with Search Console scope "
            "and a Search Console-bound service account.",
        )
        path = write_report(year, week, body)
        print(f"Wrote stub report → {path}")
        return 0

    try:
        from googleapiclient.discovery import build  # type: ignore
    except ImportError:
        body = stub_report(
            year,
            week,
            "Python dependency `google-api-python-client` not installed.",
        )
        path = write_report(year, week, body)
        print(f"Wrote stub report → {path}")
        return 0

    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    cur_rows: list[dict] = []
    prev_rows: list[dict] = []
    site_used = None
    for site in SITE_URLS:
        cur_rows = query_gsc(service, site, monday, sunday)
        if cur_rows:
            prev_rows = query_gsc(service, site, prev_monday, prev_sunday)
            site_used = site
            break

    if not site_used:
        body = stub_report(
            year,
            week,
            "GSC returned no data for any of the configured site URLs. "
            "Verify the service account has access to the `ivaestudios.com` property.",
        )
        path = write_report(year, week, body)
        print(f"Wrote stub report → {path}")
        return 0

    cur = index_by_query(cur_rows)
    prev = index_by_query(prev_rows)
    body, regressions = build_report(year, week, cur, prev)
    path = write_report(year, week, body)
    print(f"Wrote report → {path} (site: {site_used}, {len(cur)} queries)")

    if regressions:
        open_regression_issue(year, week, regressions)

    return 0


if __name__ == "__main__":
    sys.exit(main())
