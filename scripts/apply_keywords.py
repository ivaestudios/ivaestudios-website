#!/usr/bin/env python3
"""Apply latest trending keywords to marker-delimited regions in HTMLs.

Safety contract: ONLY edits regions that are explicitly marked as
keyword-rotatable. Hand-curated copy is never touched.

The four allowed surfaces:
  1. <!-- KW:start --> ... <!-- KW:end -->            (any inline content)
  2. <!-- KW:title:start --> ... <!-- KW:title:end -->  (inside <title>)
  3. <!-- KW:desc:start --> ... <!-- KW:desc:end -->    (inside meta desc content="")
  4. <span data-keyword-slot="primary|secondary|eyebrow"> ... </span>
  5. JSON-LD "keywords" arrays inside <script type="application/ld+json"> blocks

Page -> category mapping is hardcoded below. Each page picks the highest-scored
keyword in its category from seo/data/latest.json.

Usage:
    python3 scripts/apply_keywords.py
    python3 scripts/apply_keywords.py --dry-run
    python3 scripts/apply_keywords.py --page index.html
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LATEST_PATH = os.path.join(REPO_ROOT, "seo", "data", "latest.json")


PAGE_CATEGORY: dict[str, str] = {
    # English root pages
    "index.html": "destinations",
    "cancun.html": "destinations",
    "riviera-maya.html": "destinations",
    "los-cabos.html": "destinations",
    "luxury-weddings.html": "weddings",
    "couples-photography.html": "couples_family",
    "luxury-family-photos.html": "couples_family",
    # Spanish mirrors
    "es/index.html": "destinations",
    "es/fotografo-cancun.html": "destinations",
    "es/fotografo-riviera-maya.html": "destinations",
    "es/fotografo-los-cabos.html": "destinations",
    "es/fotografo-bodas-destino-mexico.html": "weddings",
    "es/fotografia-parejas-mexico.html": "couples_family",
    "es/fotos-familiares-lujo-cancun.html": "couples_family",
    # Specialty / blog hubs
    "post-cenote-underwater-photoshoot-tulum.html": "specialty",
    "post-luxury-yacht-photography-cancun.html": "specialty",
    "post-maternity.html": "specialty",
    "post-engagement.html": "couples_family",
    "post-couples.html": "couples_family",
    "post-destination-wedding.html": "weddings",
    "post-wedding-cancun.html": "weddings",
    "post-honeymoon.html": "couples_family",
}


KW_BLOCK_RE = re.compile(
    r"(<!--\s*KW:start\s*-->)(.*?)(<!--\s*KW:end\s*-->)",
    re.DOTALL,
)
KW_TITLE_RE = re.compile(
    # KW:title markers wrap the entire <title> tag (sit OUTSIDE so browsers
    # do not render the comment text as literal characters in the tab title
    # or in Google's indexed title). The keyword is the portion BEFORE the
    # first " | " separator inside <title>. Suffix is preserved.
    r"(<!--\s*KW:title:start\s*--><title>)([^|<]+?)(\s*\|[^<]*</title><!--\s*KW:title:end\s*-->)",
    re.DOTALL,
)
KW_DESC_RE = re.compile(
    r"(<!--\s*KW:desc:start\s*-->)(.*?)(<!--\s*KW:desc:end\s*-->)",
    re.DOTALL,
)
KW_SPAN_RE = re.compile(
    r'(<span[^>]*\bdata-keyword-slot="(primary|secondary|eyebrow)"[^>]*>)([^<]*)(</span>)',
    re.IGNORECASE,
)
JSONLD_RE = re.compile(
    r'(<script[^>]*type="application/ld\+json"[^>]*>)(.*?)(</script>)',
    re.DOTALL | re.IGNORECASE,
)


def load_latest() -> dict[str, Any] | None:
    if not os.path.exists(LATEST_PATH):
        print(f"WARN: {LATEST_PATH} not found; nothing to apply.")
        return None
    with open(LATEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def pick_keyword(
    latest: dict[str, Any],
    category: str,
    page_path: str | None = None,
) -> dict[str, Any] | None:
    """Highest-scored keyword in `category`.

    If page_path is provided, prefer keywords that match the page's location
    word(s) — so cancun.html doesn't get "fotografo cabos" applied to it.
    Page → location-tokens map is hardcoded for our specific URL slugs.
    """
    candidates = [k for k in latest.get("keywords", []) if k.get("category") == category]
    if not candidates:
        return None

    # Location filtering: extract location tokens from page path and ONLY
    # accept keywords containing any of them. If none match, return None so
    # the caller skips this page rather than applying a wrong-city keyword.
    if page_path:
        page_norm = page_path.lower().replace("_", "-")
        # Match the URL slug fragments to location tokens we expect to see in keywords.
        location_map = {
            "riviera-maya": ["riviera maya", "playa del carmen", "tulum", "akumal"],
            "fotografo-riviera-maya": ["riviera maya", "playa del carmen", "tulum"],
            "los-cabos": ["los cabos", "cabos", "cabo san lucas", "san jose del cabo", "palmilla"],
            "fotografo-los-cabos": ["los cabos", "cabos", "cabo san lucas"],
            # cancun.html, fotografo-cancun.html accept any keyword (already cancun-default)
            "cancun": ["cancun", "cancún"],
            "fotografo-cancun": ["cancun", "cancún"],
        }
        # Pages that don't need city filtering (homepages + category-wide pages)
        no_filter_pages = {
            "index.html", "es/index.html",
            "luxury-weddings.html",
            "couples-photography.html", "luxury-family-photos.html",
            "es/fotografo-bodas-destino-mexico.html",
            "es/fotografia-parejas-mexico.html",
            "es/fotos-familiares-lujo-cancun.html",
        }
        if page_norm in no_filter_pages:
            return max(candidates, key=lambda k: float(k.get("score", 0)))

        # Pick most-specific slug match (longest match wins)
        best_slug = ""
        best_tokens: list[str] = []
        for slug, tokens in location_map.items():
            if slug in page_norm and len(slug) > len(best_slug):
                best_slug = slug
                best_tokens = tokens

        if best_tokens:
            location_filtered = [
                k for k in candidates
                if any(loc in (k.get("keyword") or "").lower() for loc in best_tokens)
            ]
            if location_filtered:
                return max(location_filtered, key=lambda k: float(k.get("score", 0)))
            # Strict policy: no city match → skip rather than apply wrong city
            return None

    return max(candidates, key=lambda k: float(k.get("score", 0)))


def safe_text(s: str) -> str:
    """Trim and collapse whitespace; reject empty results upstream."""
    return re.sub(r"\s+", " ", s or "").strip()


def replace_kw_block(html: str, replacement: str) -> tuple[str, int]:
    """Replace contents of every <!-- KW:start --> ... <!-- KW:end -->."""
    n = 0

    def sub(m: re.Match[str]) -> str:
        nonlocal n
        n += 1
        return f"{m.group(1)}{replacement}{m.group(3)}"

    return KW_BLOCK_RE.sub(sub, html), n


def replace_named_block(
    html: str, regex: re.Pattern[str], replacement: str
) -> tuple[str, int]:
    n = 0

    def sub(m: re.Match[str]) -> str:
        nonlocal n
        n += 1
        return f"{m.group(1)}{replacement}{m.group(3)}"

    return regex.sub(sub, html), n


def replace_keyword_spans(
    html: str, primary: str, secondary: str | None, eyebrow: str | None
) -> tuple[str, int]:
    n = 0

    def sub(m: re.Match[str]) -> str:
        nonlocal n
        slot = m.group(2).lower()
        if slot == "primary":
            new_text = primary
        elif slot == "secondary":
            new_text = secondary or m.group(3)
        elif slot == "eyebrow":
            new_text = eyebrow or m.group(3)
        else:
            return m.group(0)
        if not new_text or not new_text.strip():
            return m.group(0)
        n += 1
        return f"{m.group(1)}{new_text}{m.group(4)}"

    return KW_SPAN_RE.sub(sub, html), n


def update_jsonld_keywords(html: str, keywords: list[str]) -> tuple[str, int]:
    """Replace any "keywords" array inside JSON-LD <script> blocks.

    Conservative: only touches keys named exactly `keywords` whose value is an
    array of strings. Leaves objects/strings alone to avoid breaking schema.
    """
    if not keywords:
        return html, 0
    new_array_json = json.dumps(keywords, ensure_ascii=False)
    n = 0

    def sub(m: re.Match[str]) -> str:
        nonlocal n
        body = m.group(2)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return m.group(0)
        replaced = _walk_replace_keywords(data, keywords)
        if not replaced:
            return m.group(0)
        n += 1
        new_body = json.dumps(data, ensure_ascii=False, indent=2)
        return f"{m.group(1)}\n{new_body}\n{m.group(3)}"

    out = JSONLD_RE.sub(sub, html)
    # Discard the unused new_array_json; keep just for defensive readability.
    _ = new_array_json
    return out, n


def _walk_replace_keywords(node: Any, keywords: list[str]) -> bool:
    """Recursively replace any `keywords` list value with the given list.
    Returns True if anything was replaced."""
    changed = False
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if k == "keywords" and isinstance(v, list) and all(
                isinstance(x, str) for x in v
            ):
                node[k] = keywords
                changed = True
            elif _walk_replace_keywords(v, keywords):
                changed = True
    elif isinstance(node, list):
        for item in node:
            if _walk_replace_keywords(item, keywords):
                changed = True
    return changed


def walk_html_files(root: str) -> list[str]:
    """Same skip rules as audit_links.py."""
    out: list[str] = []
    for dp, _, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        if rel_dir != "." and (
            rel_dir.startswith(".")
            or rel_dir.split(os.sep)[0]
            in {"node_modules", ".git", ".github", ".wrangler", "functions", "seo"}
        ):
            continue
        for fn in files:
            if fn.endswith(".html"):
                out.append(os.path.relpath(os.path.join(dp, fn), root))
    return out


def apply_to_file(
    rel_path: str,
    latest: dict[str, Any],
    dry_run: bool,
) -> int:
    """Returns number of edits made (0 if skipped)."""
    norm_rel = rel_path.replace(os.sep, "/")
    category = PAGE_CATEGORY.get(norm_rel)
    if not category:
        return 0

    primary = pick_keyword(latest, category, page_path=norm_rel)
    if not primary:
        print(f"  SKIP {norm_rel} - no '{category}' keyword in latest.json")
        return 0

    primary_kw = safe_text(primary.get("keyword", ""))
    if not primary_kw:
        print(f"  SKIP {norm_rel} - empty primary keyword")
        return 0

    # Pull a secondary (next best in same category) and an eyebrow (any top-3).
    same_cat = sorted(
        [k for k in latest.get("keywords", []) if k.get("category") == category],
        key=lambda k: float(k.get("score", 0)),
        reverse=True,
    )
    secondary_kw = safe_text(same_cat[1]["keyword"]) if len(same_cat) > 1 else ""
    eyebrow_kw = safe_text(
        (latest.get("keywords") or [{}])[0].get("keyword", "")
    )

    abs_path = os.path.join(REPO_ROOT, rel_path)
    with open(abs_path, "r", encoding="utf-8") as f:
        original = f.read()

    edited = original
    total_edits = 0

    # 1. KW:title block
    edited, n = replace_named_block(edited, KW_TITLE_RE, primary_kw)
    total_edits += n
    # 2. KW:desc block
    edited, n = replace_named_block(edited, KW_DESC_RE, primary_kw)
    total_edits += n
    # 3. Generic KW block
    edited, n = replace_kw_block(edited, primary_kw)
    total_edits += n
    # 4. data-keyword-slot spans
    edited, n = replace_keyword_spans(
        edited, primary_kw, secondary_kw or None, eyebrow_kw or None
    )
    total_edits += n
    # 5. JSON-LD keywords arrays
    schema_kw_list = [
        k["keyword"]
        for k in same_cat[:5]
        if safe_text(k.get("keyword", ""))
    ]
    edited, n = update_jsonld_keywords(edited, schema_kw_list)
    total_edits += n

    # Defensive: if any change would produce an empty title or description,
    # roll back the entire file edit.
    if total_edits and _would_break_meta(edited):
        print(f"  SKIP {norm_rel} - edit would empty title or description")
        return 0

    if total_edits == 0:
        return 0

    print(
        f"  EDIT {norm_rel} ({total_edits} change{'s' if total_edits != 1 else ''})"
        f"  primary='{primary_kw}'"
    )

    if not dry_run:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(edited)

    return total_edits


def _would_break_meta(html: str) -> bool:
    """Defensive check: a marker-delimited title/desc must not collapse to empty."""
    title_match = re.search(r"<title>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    if title_match and not title_match.group(1).strip():
        return True
    desc_match = re.search(
        r'<meta\s+name="description"\s+content="([^"]*)"', html, re.IGNORECASE
    )
    if desc_match is not None and not desc_match.group(1).strip():
        return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print edits but don't write any files.",
    )
    ap.add_argument(
        "--page",
        default=None,
        help="Limit to a single page (relative path, e.g. 'index.html').",
    )
    args = ap.parse_args()

    latest = load_latest()
    if latest is None:
        return 0
    if not latest.get("keywords"):
        print("latest.json has no keywords; nothing to apply.")
        return 0

    if args.page:
        targets = [args.page.replace(os.sep, "/")]
    else:
        targets = walk_html_files(REPO_ROOT)

    print(
        f"=== apply_keywords (dry_run={args.dry_run}) "
        f"{len(latest.get('keywords', []))} candidates ==="
    )
    total_files = 0
    total_edits = 0
    for rel in targets:
        edits = apply_to_file(rel, latest, args.dry_run)
        if edits:
            total_files += 1
            total_edits += edits

    print(f"\n--- {total_edits} edits across {total_files} file(s) ---")
    return 0


if __name__ == "__main__":
    sys.exit(main())
