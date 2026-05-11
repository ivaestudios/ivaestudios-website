#!/usr/bin/env python3
"""Fill empty <figure class="inline-photo"> blocks across blog posts.

For each empty figure, look at:
  - the figcaption text already inside it
  - the closest preceding <h2> / <h3>
  - the first ~200 chars of the closest preceding <p>

Match those keywords against image filenames + alt-text dictionary,
pick the best candidate (preferring more descriptive alt text), avoid
re-using the same image twice in a single post, and inject an <img>
element. Leaves figures empty if no candidate matches confidently.

Usage:
  python3 scripts/fill_inline_photos.py [--dry-run]

The script is idempotent: only figures that lack an <img> child get
touched. Run it from anywhere; it resolves paths relative to the repo
root regardless of cwd.
"""

from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
ALT_EN_PATH = ROOT / "data" / "alt-text.json"
ALT_ES_PATH = ROOT / "data" / "alt-text-es.json"

# Figure regex captures everything inside the figure (with the original opening
# tag attributes preserved) so we can re-insert the body without disturbing
# the rest of the document.
FIGURE_RE = re.compile(
    r'(<figure class="inline-photo"[^>]*>)(.*?)(</figure>)',
    flags=re.DOTALL,
)
FIGCAPTION_RE = re.compile(r"<figcaption[^>]*>(.*?)</figcaption>", flags=re.DOTALL)
HEADING_RE = re.compile(r"<(h[23])[^>]*>(.*?)</\1>", flags=re.DOTALL | re.IGNORECASE)
PARA_RE = re.compile(r"<p[^>]*>(.*?)</p>", flags=re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
ENTITY_MAP = {
    "&mdash;": " ",
    "&ndash;": " ",
    "&amp;": "&",
    "&aacute;": "a",
    "&eacute;": "e",
    "&iacute;": "i",
    "&oacute;": "o",
    "&uacute;": "u",
    "&Aacute;": "A",
    "&Eacute;": "E",
    "&Iacute;": "I",
    "&Oacute;": "O",
    "&Uacute;": "U",
    "&ntilde;": "n",
    "&Ntilde;": "N",
    "&iexcl;": "",
    "&iquest;": "",
    "&nbsp;": " ",
}

# Map of context keywords to image-filename-prefix categories.
# Keywords are matched against lowercased / de-accented context text.
# Each keyword is matched with word boundaries so "arch" doesn't match
# "architectural" and "ring" doesn't match "during".
#
# Order matters: the FIRST category whose keyword fires becomes the
# primary bucket; if it produces no image, we fall through to the next.
# So put SPECIFIC categories (cenote, yacht, drone, trash-the-dress)
# above GENERIC ones (couple, wedding), and put destination categories
# last as fallbacks.
CATEGORY_RULES = [
    # (category-name, list-of-context-keywords, list-of-filename-substrings)
    ("trash-the-dress", [
        "trash the dress", "trash-the-dress",
    ], [
        "wedding-bride-cancun-beach", "wedding-bride-isla-mujeres",
        "wedding-bride-tulum", "wedding-bride-playa-mujeres",
        "wedding-bride-cancun-hotel-zone", "wedding-bride-cancun",
    ]),
    ("cenote", [
        "cenote", "cenotes", "underwater", "submarina", "submarino",
        "cave", "cueva", "stalactite", "stalactites", "cathedral",
        "dos ojos", "gran cenote",
    ], [
        "couple-tulum", "couple-akumal", "couple-riviera-maya",
        "wedding-bride-tulum", "wedding-tulum",
    ]),
    ("yacht", [
        "yacht", "yate", "boat", "barco", "catamaran", "catamarán",
        "sailing", "sailboat", "marina",
    ], [
        "couple-isla-mujeres", "couple-playa-mujeres",
        "couple-cancun-beach", "couple-cancun-hotel-zone",
        "couple-los-cabos",
    ]),
    ("drone", [
        "drone", "drones", "dron", "aerial", "aéreo", "aereo",
    ], [
        "wedding-playa-mujeres", "wedding-isla-mujeres",
        "couple-isla-mujeres", "couple-playa-mujeres",
        "wedding-cancun-hotel-zone",
    ]),
    ("press", [
        "press", "prensa", "media coverage", "magazine", "vogue",
        "feature", "featured",
    ], [
        "editorial-cancun", "wedding-bride-cancun-hotel-zone",
        "wedding-cancun-hotel-zone", "couple-mayakoba",
    ]),
    ("editorial", [
        "editorial", "luxury editorial", "vogue", "high-end",
        "high end", "alta gama", "alto nivel", "luxury",
        "luxury photographer", "luxury photography", "fotografo de lujo",
        "fotografia de lujo", "lujo",
    ], [
        "editorial-cancun", "wedding-bride-cancun-hotel-zone",
        "couple-cancun-hotel-zone", "wedding-cancun-hotel-zone",
        "couple-mayakoba",
    ]),
    ("golden-hour", [
        "golden hour", "golden-hour", "hora dorada", "hora-dorada",
        "sunset", "atardecer", "sunrise", "amanecer", "blue hour",
        "hora azul", "caribbean", "caribe", "caribean", "coastline",
        "costa", "shoreline", "orilla del mar",
    ], [
        "couple-cancun-beach", "couple-cancun-hotel-zone",
        "couple-cancun", "couple-riviera-maya",
        "couple-playa-mujeres", "couple-isla-mujeres",
    ]),
    ("planning", [
        "wardrobe", "vestuario", "outfit", "outfits", "planning",
        "planeacion", "planeación", "consultation", "consulta",
        "gallery", "galeria", "galería", "delivery", "entrega",
    ], [
        "couple-cancun-hotel-zone", "couple-cancun-beach",
        "couple-cancun", "couple-playa-mujeres",
        "couple-riviera-maya",
    ]),
    # Maternity / babymoon / gender reveal share family + couple imagery
    ("maternity", [
        "maternity", "maternidad", "babymoon", "pregnancy", "embarazo",
        "pregnant", "embarazada", "bump", "panza", "panzita",
        "gender reveal", "revelacion de genero", "expectant",
        "mom-to-be", "mama-to-be", "embarazada",
    ], [
        "couple-cancun-hotel-zone", "couple-cancun-beach",
        "couple-cancun", "couple-riviera-maya", "couple-playa-mujeres",
        "family-kids-cancun", "family-kids-riviera-maya",
        "family-cancun", "family-riviera-maya",
    ]),
    ("quinceanera", [
        "quinceañera", "quinceanera", "quinceaneras", "quince anos",
        "quince años", "fifteen", "15th birthday",
    ], [
        "family-kids-cancun-hotel-zone", "family-kids-cancun",
        "family-kids-riviera-maya", "family-cancun",
    ]),
    ("bachelorette", [
        "bachelorette", "despedida de soltera", "bridesmaid",
        "bridesmaids", "damas de honor",
    ], [
        "family-kids-los-cabos", "couple-los-cabos", "couple-cabo",
        "couple-playa-mujeres", "couple-cancun-hotel-zone",
    ]),
    ("birthday", [
        "birthday", "cumpleaños", "cumpleanos", "celebration",
        "celebración", "celebracion",
    ], [
        "couple-cancun-hotel-zone", "couple-cancun-beach",
        "couple-cancun", "family-kids-cancun", "family-cancun",
    ]),
    ("anniversary", [
        "anniversary", "aniversario", "milestone",
    ], [
        "couple-cancun-hotel-zone", "couple-cancun-beach",
        "couple-mayakoba", "couple-riviera-maya",
        "couple-playa-mujeres",
    ]),
    ("engagement", [
        "engagement", "compromiso", "proposal", "propuesta", "surprise",
        "sorpresa", "she said yes", "ring shot",
    ], [
        "couple-cancun-beach", "couple-cancun-hotel-zone", "couple-cancun",
        "couple-riviera-maya", "couple-playa-mujeres", "couple-isla-mujeres",
    ]),
    ("honeymoon", [
        "honeymoon", "luna de miel", "luna-de-miel", "newlyweds",
        "recien casados", "post-wedding trip",
    ], [
        "couple-mayakoba", "couple-akumal", "couple-riviera-maya",
        "couple-tulum", "couple-cancun-beach", "couple-playa-mujeres",
    ]),
    # Wedding sub-types (more specific than plain "wedding")
    ("bride", [
        "bride", "bridal", "novia", "vestido de novia", "wedding dress",
        "vestido blanco", "veil", "velo",
    ], ["wedding-bride"]),
    ("groom", [
        "groom", "novio", "groomsmen", "tuxedo", "esmoquin", "padrino",
        "groom getting ready",
    ], ["wedding-groom"]),
    ("reception", [
        "reception", "recepción", "recepcion", "first dance",
        "primer baile", "speech", "brindis", "cocktail hour",
        "fiesta", "dinner reception", "dance floor",
    ], ["wedding-reception", "wedding-decor"]),
    ("decor", [
        "decor", "decoration", "decoración", "decoracion", "centerpiece",
        "centerpieces", "florals", "ramo de novia", "bouquet",
        "ceremony arch", "altar", "wedding altar", "tablescape",
        "table setting", "ceremony setup", "floral installation",
    ], ["wedding-decor", "wedding-reception"]),
    ("wedding", [
        "wedding", "ceremony", "boda", "ceremonia", "vow", "vows",
        "votos", "matrimonio", "marriage", "elopement", "fuga",
        "renewal", "renovacion", "indian wedding", "boda india",
        "same sex", "mismo sexo", "lgbtq", "destination wedding",
    ], [
        "wedding-cancun-hotel-zone", "wedding-cancun-beach",
        "wedding-isla-mujeres", "wedding-playa-mujeres",
        "wedding-riviera-maya", "wedding-tulum", "wedding-bride",
        "wedding-groom", "wedding-decor", "wedding-reception",
    ]),
    ("family", [
        "family", "familia", "familias", "kids", "niños", "ninos",
        "hijos", "children", "parents", "padres", "mother", "father",
        "madre", "padre", "grandparent", "grandparents", "abuelo",
        "abuela", "siblings", "hermanos", "family vacation",
        "vacaciones familiares",
    ], [
        "family-kids-cancun-hotel-zone", "family-kids-cancun",
        "family-kids-riviera-maya", "family-kids-playa-mujeres",
        "family-kids-isla-mujeres", "family-kids-los-cabos",
        "family-kids-tulum", "family-kids-akumal", "family-cancun",
        "family-riviera-maya", "family-session",
    ]),
    ("couple", [
        "couple", "pareja", "couples", "parejas", "love",
        "amor", "lovers", "romantic", "romantico", "intimate",
        "intimo",
    ], [
        "couple-cancun-beach", "couple-cancun-hotel-zone",
        "couple-cancun", "couple-riviera-maya", "couple-playa-mujeres",
        "couple-tulum", "couple-isla-mujeres", "couple-mayakoba",
        "couple-los-cabos", "couple-cabo", "couple-akumal",
    ]),
    # Destination-only fallbacks (used when nothing else matches)
    ("playa-mujeres", [
        "playa mujeres", "playa-mujeres",
    ], [
        "couple-playa-mujeres", "wedding-playa-mujeres",
        "wedding-bride-playa-mujeres", "wedding-groom-playa-mujeres",
        "family-kids-playa-mujeres",
    ]),
    ("isla-mujeres", [
        "isla mujeres", "isla-mujeres",
    ], [
        "couple-isla-mujeres", "family-kids-isla-mujeres",
        "wedding-isla-mujeres", "wedding-bride-isla-mujeres",
    ]),
    ("los-cabos", [
        "los cabos", "los-cabos", "cabo san lucas", "cabo-san-lucas",
        "cabo", "medano beach",
    ], [
        "couple-cabo", "couple-los-cabos", "family-kids-los-cabos",
        "wedding-bride-cabo",
    ]),
    ("tulum", [
        "tulum",
    ], [
        "couple-tulum", "wedding-tulum", "wedding-bride-tulum",
        "family-kids-tulum",
    ]),
    ("riviera-maya", [
        "riviera maya", "riviera-maya", "akumal", "playa del carmen",
        "playa-del-carmen", "mayakoba",
    ], [
        "couple-riviera-maya", "wedding-riviera-maya",
        "family-riviera-maya", "couple-mayakoba", "couple-akumal",
        "family-kids-akumal", "family-kids-riviera-maya",
    ]),
    ("cancun", [
        "cancun", "hotel zone", "zona hotelera",
    ], [
        "couple-cancun-hotel-zone", "couple-cancun-beach",
        "couple-cancun", "wedding-cancun-hotel-zone",
        "wedding-cancun-beach", "wedding-cancun", "family-cancun",
        "family-kids-cancun-hotel-zone", "family-kids-cancun",
    ]),
]


def deaccent(text: str) -> str:
    for k, v in ENTITY_MAP.items():
        text = text.replace(k, v)
    table = str.maketrans("áéíóúÁÉÍÓÚñÑüÜ", "aeiouAEIOUnNuU")
    return text.translate(table)


def text_from_html(snippet: str) -> str:
    return html.unescape(TAG_RE.sub(" ", snippet)).strip()


def strip_html(snippet: str) -> str:
    return re.sub(r"\s+", " ", text_from_html(snippet))


def find_preceding_heading(prefix: str) -> str:
    headings = list(HEADING_RE.finditer(prefix))
    if not headings:
        return ""
    return strip_html(headings[-1].group(2))


def find_preceding_paragraph(prefix: str) -> str:
    paragraphs = list(PARA_RE.finditer(prefix))
    if not paragraphs:
        return ""
    return strip_html(paragraphs[-1].group(1))[:200]


def find_post_title(doc: str) -> str:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", doc, flags=re.DOTALL | re.IGNORECASE)
    if not m:
        return ""
    return strip_html(m.group(1))


_KW_CACHE: dict[str, re.Pattern[str]] = {}


def _kw_pattern(kw: str) -> re.Pattern[str]:
    """Compile a word-boundary regex for a (deaccented, lowercased) keyword."""
    key = deaccent(kw).lower()
    pat = _KW_CACHE.get(key)
    if pat is None:
        # \b doesn't help for hyphenated phrases, so escape the keyword and
        # wrap with explicit non-word/start-of-string anchors.
        escaped = re.escape(key)
        pat = re.compile(rf"(?:(?<=^)|(?<=[^a-z0-9])){escaped}(?=$|[^a-z0-9])")
        _KW_CACHE[key] = pat
    return pat


def detect_categories(context: str) -> list[str]:
    """Return ordered list of category names whose keywords appear in context."""
    blob = deaccent(context.lower())
    hits = []
    for cat, keywords, _ in CATEGORY_RULES:
        for kw in keywords:
            if _kw_pattern(kw).search(blob):
                hits.append(cat)
                break
    return hits


def build_image_index(alt_dict: dict) -> dict[str, list[str]]:
    """Group raster image filenames by category-prefix substring.

    Returns a dict mapping each filename-substring key (from CATEGORY_RULES)
    to a list of matching filenames found in the alt dictionary, sorted
    by descending alt-text length (more descriptive first).
    """
    # Skip non-blog assets (hero shots, format variants we don't want inline)
    skip = {
        "cancun-hero.avif", "cancun-hero.jpg", "cancun-hero.webp",
        "los-cabos-hero.avif", "los-cabos-hero.jpg", "los-cabos-hero.webp",
        "riviera-maya-hero.avif", "riviera-maya-hero.jpg",
        "riviera-maya-hero.webp",
    }
    # Only keep .jpg (we have webp/avif duplicates for some files; prefer jpg
    # because the inline-photo CSS expects a single rasterized src).
    candidates = [
        fn for fn in alt_dict.keys()
        if fn.lower().endswith(".jpg") and fn not in skip
    ]
    index: dict[str, list[str]] = defaultdict(list)
    seen_keys = set()
    for _, _, prefixes in CATEGORY_RULES:
        for pref in prefixes:
            seen_keys.add(pref)
    for key in seen_keys:
        matched = [fn for fn in candidates if fn.startswith(key)]
        matched.sort(key=lambda fn: -len(alt_dict.get(fn, "")))
        index[key] = matched
    return index


def caption_to_figcaption(caption_html: str) -> str:
    """Return the figcaption snippet as-is; the script preserves it verbatim."""
    return caption_html.strip()


# Categories that name a physical destination — used to bias selection.
DESTINATION_CATEGORIES = {
    "los-cabos", "playa-mujeres", "isla-mujeres", "tulum",
    "riviera-maya", "cancun",
}
# Hints used to recognize destination tokens inside filenames so that a
# topic-driven pick (e.g. "yacht") can still respect a destination preference.
DESTINATION_FILENAME_HINTS = {
    "los-cabos":     ["los-cabos", "cabo-san-lucas", "-cabo-", "cabo-san"],
    "playa-mujeres": ["playa-mujeres"],
    "isla-mujeres":  ["isla-mujeres"],
    "tulum":         ["tulum"],
    "riviera-maya":  ["riviera-maya", "akumal", "mayakoba"],
    "cancun":        ["cancun"],
}


def select_image(
    context_categories: list[str],
    alt_dict: dict,
    image_index: dict[str, list[str]],
    used_in_post: set[str],
    used_globally: dict[str, int],
) -> str | None:
    """Pick the best image filename for this figure.

    Strategy:
    1. Walk topic categories in priority order. For each, build a bucket of
       candidate filenames not already used in this post.
    2. If a destination category is also present, partition the bucket into
       (matches-destination, rest) and prefer the destination-matching half.
    3. Among the chosen partition, prefer images used least often globally,
       and among ties prefer the one with the longest alt text.
    """
    destination_hits = [c for c in context_categories if c in DESTINATION_CATEGORIES]
    topic_cats = [c for c in context_categories if c not in DESTINATION_CATEGORIES]
    # If no topic category fired, fall back to destination-only matching.
    walk_order = topic_cats + destination_hits if topic_cats else destination_hits

    seen: set[str] = set()
    for cat in walk_order:
        prefixes = next(
            (p for c, _, p in CATEGORY_RULES if c == cat),
            [],
        )
        bucket: list[tuple[int, int, int, str]] = []
        for pref in prefixes:
            for fn in image_index.get(pref, []):
                if fn in seen or fn in used_in_post:
                    continue
                seen.add(fn)
                # Boost candidates that also match a matched destination.
                dest_score = 0
                for dest in destination_hits:
                    for hint in DESTINATION_FILENAME_HINTS.get(dest, []):
                        if hint in fn:
                            dest_score = -1   # negative so it sorts FIRST
                            break
                    if dest_score < 0:
                        break
                bucket.append((
                    dest_score,                    # destination match wins
                    used_globally.get(fn, 0),      # spread usage
                    -len(alt_dict.get(fn, "")),    # prefer descriptive
                    fn,
                ))
        if bucket:
            bucket.sort()
            return bucket[0][3]
    return None


def build_img_tag(filename: str, alt_dict: dict) -> str:
    alt = alt_dict.get(filename, "")
    alt_escaped = html.escape(alt, quote=True)
    return (
        f'<img src="/images/{filename}" alt="{alt_escaped}" '
        f'loading="lazy" decoding="async" width="1600" height="1067" />'
    )


def process_file(
    path: Path,
    alt_dict: dict,
    image_index: dict[str, list[str]],
    used_globally: dict[str, int],
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """Return (filled_count, skipped_count, total_empty_seen)."""
    doc = path.read_text(encoding="utf-8")
    used_in_post: set[str] = set()
    # Track per-post used so the same image is never re-used in the same file.
    filled = 0
    skipped = 0
    total_empty = 0

    title_context = find_post_title(doc)

    def replace_figure(match: re.Match) -> str:
        nonlocal filled, skipped, total_empty
        open_tag, body, close_tag = match.group(1), match.group(2), match.group(3)
        if "<img" in body:
            return match.group(0)
        total_empty += 1
        cap_match = FIGCAPTION_RE.search(body)
        cap_html = cap_match.group(1) if cap_match else ""
        cap_text = strip_html(cap_html)
        # Build context: heading + preceding paragraph + figcaption + title
        prefix = doc[: match.start()]
        heading = find_preceding_heading(prefix)
        paragraph = find_preceding_paragraph(prefix)
        context = " ".join([cap_text, heading, paragraph, title_context])
        cats = detect_categories(context)
        if not cats:
            skipped += 1
            return match.group(0)
        chosen = select_image(
            cats, alt_dict, image_index, used_in_post, used_globally,
        )
        if not chosen:
            skipped += 1
            return match.group(0)
        used_in_post.add(chosen)
        used_globally[chosen] = used_globally.get(chosen, 0) + 1
        img_tag = build_img_tag(chosen, alt_dict)
        # Place <img> before existing <figcaption> for predictable rendering.
        if cap_match:
            new_body = f"\n    {img_tag}\n    <figcaption>{cap_html}</figcaption>\n  "
        else:
            new_body = f"\n    {img_tag}\n  "
        filled += 1
        return f"{open_tag}{new_body}{close_tag}"

    new_doc = FIGURE_RE.sub(replace_figure, doc)
    if not dry_run and new_doc != doc:
        path.write_text(new_doc, encoding="utf-8")
    return filled, skipped, total_empty


def iter_post_paths() -> Iterable[Path]:
    yield from sorted(ROOT.glob("post-*.html"))
    yield from sorted((ROOT / "es" / "blog").glob("*.html"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="Do everything except write files.")
    args = ap.parse_args()

    alt_en = json.loads(ALT_EN_PATH.read_text(encoding="utf-8"))
    alt_es = json.loads(ALT_ES_PATH.read_text(encoding="utf-8"))
    index_en = build_image_index(alt_en)
    index_es = build_image_index(alt_es)

    used_global_en: dict[str, int] = {}
    used_global_es: dict[str, int] = {}

    total_filled = 0
    total_skipped = 0
    total_empty = 0
    posts_touched = 0

    for path in iter_post_paths():
        is_es = "/es/blog/" in str(path).replace(os.sep, "/")
        alt_dict = alt_es if is_es else alt_en
        index = index_es if is_es else index_en
        used = used_global_es if is_es else used_global_en
        filled, skipped, empty_seen = process_file(
            path, alt_dict, index, used, dry_run=args.dry_run,
        )
        total_filled += filled
        total_skipped += skipped
        total_empty += empty_seen
        if filled:
            posts_touched += 1
            print(f"  filled {filled} fig(s), skipped {skipped} | {path.relative_to(ROOT)}")
        elif empty_seen:
            print(f"  skipped {skipped} fig(s) (no match) | {path.relative_to(ROOT)}")

    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total empty figures seen:  {total_empty}")
    print(f"Images inserted:           {total_filled}")
    print(f"Figures left empty:        {total_skipped}")
    print(f"Posts touched:             {posts_touched}")
    print(f"Mode:                      {'dry-run' if args.dry_run else 'wrote files'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
