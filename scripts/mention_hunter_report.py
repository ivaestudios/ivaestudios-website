#!/usr/bin/env python3
"""IVAE Studios — Mention Hunter report writer.

Consumes raw browser capture (the weekly Claude scheduled task searches each
publication via Google site: queries, extracts URLs that mention competitors,
then for each URL checks whether IVAE Studios is also mentioned).

Snapshot format (seo/data/mention-snapshot-latest.json):
{
  "captured_at": "2026-05-11T09:30:00-05:00",
  "publications_checked": ["vogue.mx", "hellomagazine.com", ...],
  "mentions": [
    {
      "url": "https://vogue.mx/articulo/top-fotografos",
      "publication": "vogue.mx",
      "competitors_mentioned": ["ivaestudio.com"],
      "ivae_mentioned": false,
      "page_title": "Top fotógrafos México 2026",
      "context_snippet": "...incluyendo ivaestudio.com..."
    }
  ]
}

Output: seo/reports/backlinks-opportunities-YYYY-WW.md
  - Table of opportunities (URL, publication, competitor mentioned, suggested action)
  - Outreach email drafts for top 3 opportunities

Usage:
    python3 scripts/mention_hunter_report.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SNAPSHOT = os.path.join(REPO_ROOT, "seo", "data", "mention-snapshot-latest.json")
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")

# Editor/contact email patterns per publication (best-guess, owner verifies before sending)
PUB_EMAILS = {
    "vogue.mx": "editorial@vogue.mx",
    "vogue.com": "tips@vogue.com",
    "hellomagazine.com": "info@hellomagazine.com",
    "travelandleisure.com": "letters@travelandleisure.com",
    "cntraveler.com": "letters@cntraveler.com",
    "harpersbazaar.com": "tips@harpersbazaar.com",
    "stylemepretty.com": "submissions@stylemepretty.com",
    "weddingsmexico.com": "info@weddingsmexico.com",
    "brides.com": "letters@brides.com",
    "destinationweddingdetails.com": "info@destinationweddingdetails.com",
}


def render_report(snapshot: dict[str, Any]) -> str:
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    captured_at = snapshot.get("captured_at", dt.datetime.now().isoformat())
    pubs = snapshot.get("publications_checked", [])
    mentions = snapshot.get("mentions", [])

    # Filter for opportunities: competitor mentioned but NOT IVAE
    opportunities = [m for m in mentions if m.get("competitors_mentioned") and not m.get("ivae_mentioned")]

    # Also flag pages where BOTH are mentioned — confirms IVAE is recognized
    both = [m for m in mentions if m.get("competitors_mentioned") and m.get("ivae_mentioned")]

    out: list[str] = []
    out.append(f"# Backlink Opportunities — {iso_year}-W{iso_week:02d}\n")
    out.append(f"_Captured: {captured_at}_\n")
    out.append("")
    out.append(f"**Publications checked:** {len(pubs)}")
    out.append(f"**Total mentions found:** {len(mentions)}")
    out.append(f"**🟢 Opportunities (competitor mentioned, IVAE NOT):** {len(opportunities)}")
    out.append(f"**✅ Co-mentions (both mentioned):** {len(both)}")
    out.append("")

    if opportunities:
        out.append("## 🟢 Backlink opportunities — outreach candidates\n")
        out.append("| # | Publication | Article | Competitor mentioned | Suggested email |")
        out.append("|---|---|---|---|---|")
        for i, m in enumerate(opportunities[:15], 1):
            url = m.get("url", "")
            pub = m.get("publication", "")
            title = m.get("page_title", url)[:80]
            comps = ", ".join(m.get("competitors_mentioned", []))
            email = PUB_EMAILS.get(pub, "(buscar manual)")
            out.append(f"| {i} | {pub} | [{title}]({url}) | {comps} | {email} |")
        out.append("")

        # Top 3 outreach drafts
        out.append("## ✉️ Outreach email drafts (top 3)\n")
        for i, m in enumerate(opportunities[:3], 1):
            url = m.get("url", "")
            pub = m.get("publication", "")
            title = m.get("page_title", "your article")[:80]
            comps = ", ".join(m.get("competitors_mentioned", []))

            out.append(f"### {i}. {pub}\n")
            out.append("```")
            out.append(f"To: {PUB_EMAILS.get(pub, '(researching)')}")
            out.append(f"Subject: Suggestion for your article \"{title}\"")
            out.append("")
            out.append("Hello,")
            out.append("")
            out.append(f"I came across your piece \"{title}\" — I really enjoyed it, especially the section featuring {comps}.")
            out.append("")
            out.append("I lead IVAE Studios, a luxury resort photography studio based in Cancún (with editorial coverage across Riviera Maya and Los Cabos). Vianey Díaz, our founder, has 10+ years of editorial experience. We've been delivering golden-hour-only sessions for international families, couples and destination weddings since 2023.")
            out.append("")
            out.append("If you're updating the article, we'd love to be considered. Happy to send you our portfolio (https://ivaestudios.com) and a few featured galleries.")
            out.append("")
            out.append("Thank you for your work,")
            out.append("Vianey Díaz")
            out.append("Creative Director, IVAE Studios")
            out.append("https://ivaestudios.com | info@ivaestudios.com")
            out.append("```")
            out.append("")

    if both:
        out.append("## ✅ Co-mentions (already in articles with competitors)\n")
        out.append("These confirm IVAE is recognized. Track them — these are your strongest backlinks.\n")
        out.append("| Publication | Article |")
        out.append("|---|---|")
        for m in both[:15]:
            url = m.get("url", "")
            pub = m.get("publication", "")
            title = m.get("page_title", url)[:80]
            out.append(f"| {pub} | [{title}]({url}) |")
        out.append("")

    if not opportunities and not both:
        out.append("\nNo mentions found this week. Try adding more publications to the watch list.\n")

    out.append("\n## 💡 Cómo usar este reporte\n")
    out.append("1. Revisa cada oportunidad — algunas pueden ser foros chiquitos no relevantes")
    out.append("2. Para las top 3, copia el email draft, ajustalo con detalles específicos del artículo")
    out.append("3. Manda 1-3 emails por semana (no spam)")
    out.append("4. Cada backlink conseguido = autoridad SEO + tráfico referido")
    out.append("5. Si te incluyen, próxima semana aparecerá en \"Co-mentions\" arriba ✅")

    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--snapshot", default=DEFAULT_SNAPSHOT,
                    help="Path to JSON snapshot from this week's browser capture.")
    args = ap.parse_args()

    if not os.path.exists(args.snapshot):
        print(f"WARN: snapshot not found at {args.snapshot}", file=sys.stderr)
        print("Skipping (no data to report this week).")
        return 0

    with open(args.snapshot, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    iso_year, iso_week, _ = dt.date.today().isocalendar()
    os.makedirs(REPORT_DIR, exist_ok=True)
    report_path = os.path.join(REPORT_DIR, f"backlinks-opportunities-{iso_year}-W{iso_week:02d}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(render_report(snapshot))
    print(f"Report written: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
