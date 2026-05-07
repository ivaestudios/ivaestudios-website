#!/usr/bin/env python3
"""IVAE Studios — AI Recommendation Tester report writer.

Consumes browser-captured AI assistant responses and writes a tracking report.

Each Sunday/Monday the Claude scheduled task asks 4 control queries to 4 AI
assistants (ChatGPT, Claude, Perplexity, Gemini), captures the response,
and parses for IVAE Studios mentions.

Snapshot format (seo/data/ai-mentions-snapshot-latest.json):
{
  "captured_at": "2026-05-11T09:45:00-05:00",
  "queries": [
    {
      "query": "best wedding photographer in Cancún",
      "results": [
        {
          "assistant": "ChatGPT (GPT-4)",
          "mentioned_ivae": true,
          "mention_position": 1,  # 1, 2, 3 for top-N; null = not mentioned
          "mention_type": "primary",  # primary, listed, mentioned-only
          "cited_url": "https://ivaestudios.com",
          "cited_facts": ["founded 2023", "10 years experience"],
          "raw_excerpt": "..."
        },
        {"assistant": "Claude", ...},
        {"assistant": "Perplexity", ...},
        {"assistant": "Gemini", ...}
      ]
    },
    ...
  ]
}

Output: seo/reports/ai-mentions-YYYY-WW.md
  - Heatmap table: queries × AI assistants
  - Trend: weeks-over-weeks pickup percentage
  - First-time mentions tracked

Usage:
    python3 scripts/ai_recommendation_report.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SNAPSHOT = os.path.join(REPO_ROOT, "seo", "data", "ai-mentions-snapshot-latest.json")
REPORT_DIR = os.path.join(REPO_ROOT, "seo", "reports")

ASSISTANTS = ["ChatGPT (GPT-4)", "Claude", "Perplexity", "Gemini"]


def cell_for(result: dict[str, Any] | None) -> str:
    if result is None:
        return "—"
    if not result.get("mentioned_ivae"):
        return "❌"
    pos = result.get("mention_position")
    mtype = result.get("mention_type", "")
    if pos == 1:
        return "🥇 #1"
    if pos == 2:
        return "🥈 #2"
    if pos == 3:
        return "🥉 #3"
    if pos is not None:
        return f"#{pos}"
    if mtype == "primary":
        return "✅ primary"
    if mtype == "listed":
        return "✅ listed"
    return "✅"


def render_report(snapshot: dict[str, Any]) -> str:
    iso_year, iso_week, _ = dt.date.today().isocalendar()
    captured_at = snapshot.get("captured_at", dt.datetime.now().isoformat())
    queries = snapshot.get("queries", [])

    out: list[str] = []
    out.append(f"# AI Recommendation Tester — {iso_year}-W{iso_week:02d}\n")
    out.append(f"_Captured: {captured_at}_\n")
    out.append("")
    out.append("## Heatmap: queries × AI assistants\n")
    out.append("Cómo leer: 🥇 = te recomienda primero · ✅ = te menciona · ❌ = no te menciona · — = sin data")
    out.append("")

    header = ["Query"] + ASSISTANTS + ["Score"]
    out.append("| " + " | ".join(header) + " |")
    out.append("|" + "|".join(["---"] * len(header)) + "|")

    total_mentions = 0
    total_slots = 0
    primary_mentions = 0

    for q in queries:
        kw = q.get("query", "")
        results_by_assistant = {r.get("assistant"): r for r in q.get("results", [])}
        cells = [kw]
        row_score = 0
        for asst in ASSISTANTS:
            r = results_by_assistant.get(asst)
            cells.append(cell_for(r))
            total_slots += 1
            if r and r.get("mentioned_ivae"):
                total_mentions += 1
                row_score += 1
                if r.get("mention_position") == 1 or r.get("mention_type") == "primary":
                    primary_mentions += 1
        cells.append(f"{row_score}/{len(ASSISTANTS)}")
        out.append("| " + " | ".join(cells) + " |")

    out.append("")
    out.append("## 📊 Aggregate metrics\n")
    out.append(f"- **Mention rate:** {total_mentions}/{total_slots} = {total_mentions / max(total_slots, 1) * 100:.0f}%")
    out.append(f"- **Primary recommendations:** {primary_mentions}/{total_slots} = {primary_mentions / max(total_slots, 1) * 100:.0f}%")
    out.append("")

    # Trend vs previous report
    prev = latest_previous_report()
    if prev is not None:
        prev_rate = prev.get("mention_rate", 0)
        delta = (total_mentions / max(total_slots, 1) * 100) - prev_rate
        if delta > 5:
            out.append(f"**Trend:** ↗ +{delta:.0f}% vs. semana pasada ({prev_rate:.0f}%)")
        elif delta < -5:
            out.append(f"**Trend:** ↘ {delta:.0f}% vs. semana pasada ({prev_rate:.0f}%)")
        else:
            out.append(f"**Trend:** estable (~{prev_rate:.0f}%)")
        out.append("")

    out.append("## 🎯 Lectura\n")
    if total_mentions == 0:
        out.append("Aún no apareces en respuestas de IAs. Esto es esperado los primeros 4-6 semanas post-Wikidata + schema.")
        out.append("Las IAs necesitan re-crawlar tu sitio + indexar Wikidata para reconocerte como entidad recomendable.")
    elif primary_mentions == 0:
        out.append("Apareces en respuestas pero no como recomendación primaria. Esto significa que las IAs te conocen pero no te están priorizando.")
        out.append("Posibles mejoras: más reseñas reales, más coverage editorial (backlinks), más contenido evergreen en el sitio.")
    elif primary_mentions / max(total_slots, 1) > 0.5:
        out.append("🎉 **Recomendación primaria en >50% de queries.** Lo que construimos está funcionando.")
        out.append("Mantener: contenido fresco, schema actualizado, GBP activo.")
    else:
        out.append("Apareces como mención primaria en algunos queries. Crecimiento gradual.")

    out.append("")
    out.append("## 🔬 Detail: facts cited per assistant\n")
    for q in queries:
        kw = q.get("query", "")
        out.append(f"### {kw}")
        for r in q.get("results", []):
            asst = r.get("assistant", "?")
            if r.get("mentioned_ivae"):
                facts = r.get("cited_facts", [])
                facts_str = ", ".join(facts) if facts else "(no specific facts cited)"
                excerpt = (r.get("raw_excerpt") or "")[:200]
                out.append(f"- **{asst}**: ✅ — facts: {facts_str}")
                if excerpt:
                    out.append(f"  > {excerpt}...")
            else:
                out.append(f"- **{asst}**: ❌")
        out.append("")

    # Save aggregate to data file for next week's trend
    out_dir = os.path.join(REPO_ROOT, "seo", "data")
    os.makedirs(out_dir, exist_ok=True)
    trend_path = os.path.join(out_dir, "ai-mentions-trend.json")
    trend_data = {"last_run": captured_at, "mention_rate": total_mentions / max(total_slots, 1) * 100,
                  "primary_rate": primary_mentions / max(total_slots, 1) * 100}
    with open(trend_path, "w", encoding="utf-8") as f:
        json.dump(trend_data, f, indent=2)

    return "\n".join(out) + "\n"


def latest_previous_report() -> dict[str, Any] | None:
    """Read trend file if it exists."""
    trend_path = os.path.join(REPO_ROOT, "seo", "data", "ai-mentions-trend.json")
    if not os.path.exists(trend_path):
        return None
    try:
        with open(trend_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--snapshot", default=DEFAULT_SNAPSHOT,
                    help="Path to JSON snapshot from this week's AI capture.")
    args = ap.parse_args()

    if not os.path.exists(args.snapshot):
        print(f"WARN: snapshot not found at {args.snapshot}", file=sys.stderr)
        print("Skipping (no data to report this week).")
        return 0

    with open(args.snapshot, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    iso_year, iso_week, _ = dt.date.today().isocalendar()
    os.makedirs(REPORT_DIR, exist_ok=True)
    report_path = os.path.join(REPORT_DIR, f"ai-mentions-{iso_year}-W{iso_week:02d}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(render_report(snapshot))
    print(f"Report written: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
