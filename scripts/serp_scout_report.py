#!/usr/bin/env python3
"""IVAE Studios — SERP Scout report writer.

Consumes raw SERP capture (from the weekly Claude scheduled task using a real
browser) and produces seo/reports/serp-scout-YYYY-WW.md with:
  * Position table per keyword for IVAE Studios + 3 tracked competitors
  * Week-over-week deltas (vs last report)
  * Alerts for any keyword that dropped >5 positions
  * "Quick wins" suggestions for keywords in positions 4–10

The Claude scheduled task pipes its findings into a single JSON snapshot
file (seo/data/serp-snapshot-latest.json). This script ingests that and
emits the human-readable report.

Snapshot format:
{
  "captured_at": "2026-05-11T09:15:00-05:00",
  "keywords": [
    {
      "keyword": "fotografo cancun",
      "geo": "google.com.mx",
      "results": [
        {"position": 1, "domain": "domain.com", "url": "...", "title": "..."},
        ...
      ]
    },
    ...
  ]
}

Usage:
    python3 scripts/serp_scout_report.py
    python3 scripts/serp_scout_report.py --snapshot seo/data/serp-snapshot-latest.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SNAPSHOT = os.path.join(REPO_ROOT, "seo", "data", "serp-snapshot-latest.json")
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")

# Domains we want to track in every SERP. Order matters: it's the column
# order in the report.
TRACKED_DOMAINS = [
    ("ivaestudios.com", "IVAE Studios (us)"),
    ("ivaestudio.com", "ivaestudio.com (no S, competitor)"),
    ("fivestudio.com.mx", "fivestudio"),
    ("ivastudio.com", "ivastudio"),
]

REGRESSION_DROP = 5  # positions
QUICK_WIN_RANGE = (4, 10)


def find_position(results: list[dict[str, Any]], domain_substr: str) -> int | None:
    """Return 1-based position of domain in results, or None if not found."""
    for r in results:
        domain = (r.get("domain") or "").lower()
        if domain_substr in domain:
            return int(r.get("position", 0)) or None
    return None


def latest_previous_report() -> dict[str, dict[str, int | None]] | None:
    """Find the most recent serp-scout report and parse positions table."""
    if not os.path.isdir(REPORT_DIR):
        return None
    candidates = sorted(
        f for f in os.listdir(REPORT_DIR) if f.startswith("serp-scout-") and f.endswith(".md")
    )
    if not candidates:
        return None
    last = candidates[-1]
    path = os.path.join(REPORT_DIR, last)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    # Parse the table — naive but works for our template.
    table: dict[str, dict[str, int | None]] = {}
    in_table = False
    for line in text.splitlines():
        if line.startswith("| Keyword"):
            in_table = True
            continue
        if in_table:
            if not line.startswith("|"):
                break
            if line.startswith("|---"):
                continue
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if not cells:
                continue
            kw = cells[0]
            row: dict[str, int | None] = {}
            for i, (dom, _) in enumerate(TRACKED_DOMAINS):
                if i + 1 < len(cells):
                    val = cells[i + 1]
                    if val == "—" or val == "N/R":
                        row[dom] = None
                    else:
                        try:
                            row[dom] = int(val.split()[0])
                        except (ValueError, IndexError):
                            row[dom] = None
            table[kw] = row
    return table


def render_report(snapshot: dict[str, Any], previous: dict[str, dict[str, int | None]] | None) -> str:
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    captured_at = snapshot.get("captured_at", dt.datetime.now().isoformat())

    out: list[str] = []
    out.append(f"# SERP Scout Report — {iso_year}-W{iso_week:02d}\n")
    out.append(f"_Captured: {captured_at}_\n")
    out.append("")
    out.append("## Position table\n")
    header_cells = ["Keyword"] + [label for _, label in TRACKED_DOMAINS] + ["Δ us"]
    out.append("| " + " | ".join(header_cells) + " |")
    out.append("|" + "|".join(["---"] * len(header_cells)) + "|")

    alerts: list[str] = []
    quick_wins: list[str] = []

    for kw_obj in snapshot.get("keywords", []):
        kw = kw_obj.get("keyword", "")
        results = kw_obj.get("results", [])
        positions: dict[str, int | None] = {}
        for domain_substr, _label in TRACKED_DOMAINS:
            positions[domain_substr] = find_position(results, domain_substr)

        # Compute delta vs previous for our domain (first in TRACKED_DOMAINS)
        us_now = positions[TRACKED_DOMAINS[0][0]]
        us_prev = (previous or {}).get(kw, {}).get(TRACKED_DOMAINS[0][0]) if previous else None
        if us_now is None and us_prev is None:
            delta_str = "—"
        elif us_now is None:
            delta_str = "↘ lost"
            alerts.append(f"- ⚠️ **{kw}**: cayó del top 100 (estaba en pos {us_prev})")
        elif us_prev is None:
            delta_str = "↗ NEW"
        else:
            d = us_prev - us_now
            if d > 0:
                delta_str = f"↗ +{d}"
            elif d < 0:
                delta_str = f"↘ {d}"
                if abs(d) >= REGRESSION_DROP:
                    alerts.append(
                        f"- 🚨 **{kw}**: bajaste {abs(d)} posiciones "
                        f"(de {us_prev} a {us_now})"
                    )
            else:
                delta_str = "—"

        # Detect quick win (us in 4-10 range, ranking but not top 3)
        if us_now is not None and QUICK_WIN_RANGE[0] <= us_now <= QUICK_WIN_RANGE[1]:
            quick_wins.append(
                f"- **{kw}** está en pos {us_now} → optimizar título/meta para subir a top 3"
            )

        cells = [kw]
        for domain_substr, _ in TRACKED_DOMAINS:
            p = positions[domain_substr]
            cells.append(str(p) if p is not None else "—")
        cells.append(delta_str)
        out.append("| " + " | ".join(cells) + " |")

    out.append("")
    out.append("## 🚨 Alerts\n")
    if alerts:
        out.extend(alerts)
    else:
        out.append("Ninguna esta semana ✅")
    out.append("")

    out.append("## 🎯 Quick wins\n")
    if quick_wins:
        out.extend(quick_wins)
    else:
        out.append("Ninguno detectado")
    out.append("")

    out.append("## 💡 Notas\n")
    out.append("- Las posiciones son del top 20 capturado vía navegador real (logueado).")
    out.append("- Si un dominio aparece como '—' significa que NO está en top 20.")
    out.append("- Δ us = cambio en TU posición vs la semana pasada. ↗ es bueno, ↘ es alerta.")
    out.append("- Quick wins se detectan cuando estás en pos 4–10: optimizar título suele "
                "subirte a top 3 con cambios menores.")

    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument(
        "--snapshot", default=DEFAULT_SNAPSHOT,
        help="Path to JSON snapshot from this week's browser capture.",
    )
    args = ap.parse_args()

    if not os.path.exists(args.snapshot):
        print(f"WARN: snapshot not found at {args.snapshot}", file=sys.stderr)
        print("This script expects a JSON snapshot from the Claude scheduled task.")
        print("Skipping report generation (no data to report).")
        return 0

    with open(args.snapshot, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    previous = latest_previous_report()

    iso_year, iso_week, _ = dt.date.today().isocalendar()
    os.makedirs(REPORT_DIR, exist_ok=True)
    report_path = os.path.join(REPORT_DIR, f"serp-scout-{iso_year}-W{iso_week:02d}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(render_report(snapshot, previous))
    print(f"Report written: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
