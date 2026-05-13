#!/usr/bin/env python3
"""Auto-generate the journal grid + featured story in blog.html and es/blog.html.

Reads every post-*.html (EN) and es/blog/*.html (ES), parses each one's JSON-LD
metadata for title / description / date / image / category, sorts by
datePublished descending, and writes:

  - 1 featured story (the most recent post)
  - 10 grid cards (the next 10 most recent)

into the blog index pages between these markers:

  <!-- AUTOGEN-FEATURED:START --> … <!-- AUTOGEN-FEATURED:END -->
  <!-- AUTOGEN-CARDS:START -->    … <!-- AUTOGEN-CARDS:END -->

Run manually from repo root:

  python3 scripts/generate_blog_grid.py

…or wire it into a GitHub Action so new posts auto-appear on push.

The static .ivm-jl-* CSS in styles/mobile-exclusive.css handles all styling —
this script only emits HTML strings that match those classes.
"""
from __future__ import annotations
import json
import re
from datetime import datetime
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Output limits
FEATURED_COUNT = 1
GRID_COUNT = 10

# Where to find posts
EN_POSTS_GLOB = "post-*.html"
ES_POSTS_GLOB = "es/blog/*.html"

# Where to write
EN_BLOG = ROOT / "blog.html"
ES_BLOG = ROOT / "es" / "blog.html"

# Markers (must already be in the HTML — script doesn't insert them)
F_START = "<!-- AUTOGEN-FEATURED:START -->"
F_END = "<!-- AUTOGEN-FEATURED:END -->"
G_START = "<!-- AUTOGEN-CARDS:START -->"
G_END = "<!-- AUTOGEN-CARDS:END -->"


# ────────────────────────────────────────────────────────────────────────────
# Category derivation — turn slug + articleSection into a tight editorial label
# ────────────────────────────────────────────────────────────────────────────
# Fallback image picker — assets.ivaestudios.com/blog/*-og.jpg URLs are 404 for
# most posts (never uploaded). Match the post slug to a local /images/* photo
# we know exists. Falls back to a generic editorial shot.
def derive_image(slug: str, cdn_url: str) -> str:
    s = slug.lower()
    # Priority order: most specific topic first, then location
    mapping = [
        ("mayakoba",              "/images/couple-mayakoba-ivae-studios.jpg"),
        ("tulum",                 "/images/couple-tulum-ivae-studios-3.jpg"),
        ("cenote",                "/images/wedding-bride-tulum-ivae-studios.jpg"),
        ("cabo",                  "/images/wedding-bride-cabo-san-lucas-ivae-studios.jpg"),
        ("riviera",               "/images/couple-riviera-maya-ivae-studios.jpg"),
        ("playa-mujeres",         "/images/couple-playa-mujeres-ivae-studios.jpg"),
        ("isla-mujeres",          "/images/couple-isla-mujeres-ivae-studios.jpg"),
        ("akumal",                "/images/couple-akumal-ivae-studios.jpg"),
        ("honeymoon",             "/images/blog/honeymoon-photographer-riviera-maya-og.jpg"),
        ("luna-de-miel",          "/images/blog/honeymoon-photographer-riviera-maya-og.jpg"),
        ("luna-miel",             "/images/blog/honeymoon-photographer-riviera-maya-og.jpg"),
        ("babymoon",              "/images/family-kids-cancun-hotel-zone-ivae-studios-3.jpg"),
        ("maternity",             "/images/family-kids-cancun-hotel-zone-ivae-studios-4.jpg"),
        ("maternidad",            "/images/family-kids-cancun-hotel-zone-ivae-studios-4.jpg"),
        ("gender-reveal",         "/images/family-kids-cancun-hotel-zone-ivae-studios-5.jpg"),
        ("quinceanera",           "/images/family-kids-cancun-hotel-zone-ivae-studios-7.jpg"),
        ("birthday",              "/images/family-kids-cancun-hotel-zone-ivae-studios-8.jpg"),
        ("bachelorette",          "/images/family-kids-los-cabos-ivae-studios.jpg"),
        ("anniversary",           "/images/couple-cancun-hotel-zone-ivae-studios-12.jpg"),
        ("aniversario",           "/images/couple-cancun-hotel-zone-ivae-studios-12.jpg"),
        ("proposal",              "/images/couple-cancun-beach-ivae-studios-4.jpg"),
        ("propuesta",             "/images/couple-cancun-beach-ivae-studios-4.jpg"),
        ("engagement",            "/images/couple-cancun-beach-ivae-studios-3.jpg"),
        ("compromiso",            "/images/couple-cancun-beach-ivae-studios-3.jpg"),
        ("family-photoshoot",     "/images/family-cancun-hotel-zone-ivae-studios.jpg"),
        ("luxury-family",         "/images/family-cancun-hotel-zone-ivae-studios.jpg"),
        ("family-vacation",       "/images/family-kids-isla-mujeres-ivae-studios.jpg"),
        ("family",                "/images/family-cancun-ivae-studios-2.jpg"),
        ("familia",               "/images/family-cancun-ivae-studios-2.jpg"),
        ("yacht",                 "/images/couple-cancun-hotel-zone-ivae-studios-9.jpg"),
        ("yate",                  "/images/couple-cancun-hotel-zone-ivae-studios-9.jpg"),
        ("drone",                 "/images/wedding-bride-cancun-hotel-zone-ivae-studios-12.jpg"),
        ("dron",                  "/images/wedding-bride-cancun-hotel-zone-ivae-studios-12.jpg"),
        ("what-to-wear",          "/images/couple-playa-mujeres-ivae-studios-3.jpg"),
        ("que-ponerse",           "/images/couple-playa-mujeres-ivae-studios-3.jpg"),
        ("vestuario",             "/images/couple-playa-mujeres-ivae-studios-3.jpg"),
        ("golden-hour",           "/images/wedding-bride-cabo-san-lucas-ivae-studios.jpg"),
        ("hora-dorada",           "/images/wedding-bride-cabo-san-lucas-ivae-studios.jpg"),
        ("vow-renewal",           "/images/wedding-bride-cancun-ivae-studios-3.jpg"),
        ("renovacion",            "/images/wedding-bride-cancun-ivae-studios-3.jpg"),
        ("elopement",             "/images/wedding-bride-isla-mujeres-ivae-studios.jpg"),
        ("indian-wedding",        "/images/wedding-bride-cancun-ivae-studios-5.jpg"),
        ("bodas-indias",          "/images/wedding-bride-cancun-ivae-studios-5.jpg"),
        ("same-sex",              "/images/couple-cancun-hotel-zone-ivae-studios-10.jpg"),
        ("mismo-sexo",            "/images/couple-cancun-hotel-zone-ivae-studios-10.jpg"),
        ("lgbtq",                 "/images/couple-cancun-hotel-zone-ivae-studios-10.jpg"),
        ("wedding-timeline",      "/images/wedding-bride-cancun-hotel-zone-ivae-studios-8.jpg"),
        ("destination-wedding",   "/images/blog/destination-wedding-riviera-maya-og.jpg"),
        ("boda-destino",          "/images/blog/destination-wedding-riviera-maya-og.jpg"),
        ("resort",                "/images/wedding-bride-cancun-hotel-zone-ivae-studios-12.jpg"),
        ("press",                 "/images/editorial-cancun-ivae-studios.jpg"),
        ("vianey",                "/images/editorial-cancun-ivae-studios.jpg"),
        ("editorial",             "/images/editorial-cancun-ivae-studios.jpg"),
        ("couples-photographer",  "/images/blog/couples-photographer-cancun-og.jpg"),
        ("wedding-photographer",  "/images/blog/wedding-photographer-cancun-og.jpg"),
        ("photographer",          "/images/wedding-bride-cancun-ivae-studios-4.jpg"),
        ("fotografo",             "/images/wedding-bride-cancun-ivae-studios-4.jpg"),
        ("wedding",               "/images/wedding-bride-cancun-ivae-studios-2.jpg"),
        ("boda",                  "/images/wedding-bride-cancun-ivae-studios-2.jpg"),
        ("couple",                "/images/couple-cancun-hotel-zone-ivae-studios-2.jpg"),
        ("pareja",                "/images/couple-cancun-hotel-zone-ivae-studios-2.jpg"),
        ("cancun",                "/images/couple-cancun-beach-ivae-studios.jpg"),
    ]
    for needle, local in mapping:
        if needle in s:
            return local
    return "/images/editorial-cancun-ivae-studios.jpg"


def derive_category(slug: str, article_section: str, lang: str) -> str:
    """Return a 'Primary · Secondary' label like 'Couples · Honeymoon'.

    The first slot is the high-level category (Weddings / Couples / Families /
    Style / Travel / Vendors / How-to). The second is the location or sub-topic.
    """
    s = slug.lower()

    if lang == "es":
        primary_map = [
            ("boda", "Bodas"),
            ("nupcial", "Bodas"),
            ("luna-de-miel", "Parejas · Luna de miel"),
            ("luna-miel", "Parejas · Luna de miel"),
            ("aniversario", "Parejas · Aniversario"),
            ("compromiso", "Parejas · Compromiso"),
            ("propuesta", "Parejas · Propuesta"),
            ("pareja", "Parejas"),
            ("babymoon", "Familia · Babymoon"),
            ("maternidad", "Familia · Maternidad"),
            ("genero", "Familia · Gender reveal"),
            ("quinceanera", "Familia · Quinceañera"),
            ("familia", "Familia"),
            ("vestuario", "Estilo · Vestuario"),
            ("que-ponerse", "Estilo · Vestuario"),
            ("hora-dorada", "Guía · Luz"),
            ("cenote", "Locación · Cenotes"),
            ("tulum", "Viaje · Tulum"),
            ("cabo", "Viaje · Los Cabos"),
            ("riviera", "Viaje · Riviera Maya"),
            ("cancun", "Viaje · Cancún"),
            ("resort", "Vendors · Resorts"),
            ("yate", "Vendors · Yate"),
            ("drone", "Vendors · Dron"),
            ("costo", "Inversión · Precio"),
            ("precio", "Inversión · Precio"),
            ("faq", "Guía · FAQ"),
            ("preguntas", "Guía · Reservar"),
        ]
    else:
        primary_map = [
            ("wedding", "Weddings"),
            ("bridal", "Weddings"),
            ("elopement", "Weddings · Elopement"),
            ("honeymoon", "Couples · Honeymoon"),
            ("anniversary", "Couples · Anniversary"),
            ("engagement", "Couples · Engagement"),
            ("proposal", "Couples · Proposal"),
            ("couple", "Couples"),
            ("babymoon", "Families · Babymoon"),
            ("maternity", "Families · Maternity"),
            ("gender-reveal", "Families · Gender reveal"),
            ("quinceanera", "Families · Quinceañera"),
            ("family", "Families"),
            ("what-to-wear", "Style · Wardrobe"),
            ("wardrobe", "Style · Wardrobe"),
            ("golden-hour", "How-to · Light"),
            ("cenote", "Location · Cenotes"),
            ("tulum", "Travel · Tulum"),
            ("cabo", "Travel · Los Cabos"),
            ("riviera", "Travel · Riviera Maya"),
            ("cancun", "Travel · Cancún"),
            ("resort", "Vendors · Resorts"),
            ("yacht", "Vendors · Yacht"),
            ("drone", "Vendors · Drone"),
            ("cost", "Investment · Pricing"),
            ("price", "Investment · Pricing"),
            ("faq", "How-to · FAQ"),
            ("questions", "How-to · Booking"),
            ("vs", "How-to · Compare"),
        ]

    for needle, label in primary_map:
        if needle in s:
            return label

    if article_section:
        return article_section
    return "Journal" if lang == "en" else "Diario"


# ────────────────────────────────────────────────────────────────────────────
# Title emphasis — wrap the last 1-2 words in <em> for the gold italic accent
# ────────────────────────────────────────────────────────────────────────────
# Short connective words we don't want to leave dangling at a truncation
TAIL_STOPWORDS_EN = {"in", "at", "on", "for", "the", "a", "an", "and", "or", "of", "to", "from", "with"}
TAIL_STOPWORDS_ES = {"en", "de", "del", "la", "el", "los", "las", "y", "o", "a", "para", "con", "por"}


def emphasize_title(title: str, max_chars: int = 60) -> str:
    """Truncate long titles editorial-style and wrap the last 1-2 words in <em>.

    1. Strip site suffix.
    2. If too long, cut at the first sentence-ending punctuation (— : ?) or
       at a word boundary near max_chars; drop dangling stopwords.
    3. Wrap the last 1-2 words in <em>…</em> for the gold italic accent.
    """
    # Strip site suffix
    title = re.sub(r"\s*[|–—-]\s*IVAE Studios.*$", "", title).strip()
    # Capture whether the title ended in ? or ! before stripping trailing punct
    end_punct = "."
    if title.endswith("?"): end_punct = "?"
    elif title.endswith("!"): end_punct = "!"
    title = title.rstrip(".?!")

    # Truncate long titles
    if len(title) > max_chars:
        # Try to cut at a natural break: em-dash, colon, question, semicolon
        for sep in [" — ", ": ", "? ", "; "]:
            i = title.find(sep)
            if 12 < i < max_chars:
                title = title[:i].rstrip()
                # When truncating mid-sentence, force a period rather than ?
                end_punct = "."
                break
        else:
            # No natural break — cut at word boundary near max_chars
            cut = title[:max_chars]
            space = cut.rfind(" ")
            if space > 12:
                title = cut[:space].rstrip(",;")
            end_punct = "."
        # Drop trailing stopwords like "in", "of", "the" so we don't end
        # on a connective word.
        stopwords = TAIL_STOPWORDS_EN | TAIL_STOPWORDS_ES
        words_check = title.split()
        while words_check and words_check[-1].lower().rstrip(",;:") in stopwords:
            words_check.pop()
        title = " ".join(words_check)

    words = title.split()
    if len(words) <= 2:
        return f"<em>{escape(title)}{end_punct}</em>"
    # Wrap last 1-2 words
    tail_count = 2 if len(words) >= 4 else 1
    head = " ".join(words[:-tail_count])
    tail = " ".join(words[-tail_count:])
    return f"{escape(head)} <em>{escape(tail)}{end_punct}</em>"


# ────────────────────────────────────────────────────────────────────────────
# Description truncation — keep it card-sized
# ────────────────────────────────────────────────────────────────────────────
def trim_desc(desc: str, max_len: int = 145) -> str:
    if not desc:
        return ""
    if len(desc) <= max_len:
        return desc
    # cut at sentence end if possible
    cut = desc[:max_len]
    period = cut.rfind(".")
    if period >= int(max_len * 0.6):
        return cut[: period + 1]
    # else cut at word boundary
    space = cut.rfind(" ")
    return cut[:space].rstrip(",;") + "…"


# ────────────────────────────────────────────────────────────────────────────
# Post parser
# ────────────────────────────────────────────────────────────────────────────
RE_JSONLD = re.compile(
    r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>',
    re.DOTALL,
)


def parse_post(path: Path, lang: str) -> dict | None:
    """Parse a post file and return a dict, or None if we can't get the basics."""
    try:
        txt = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"WARN: can't read {path}: {e}")
        return None

    title = None
    description = None
    image = None
    date = None
    section = None
    url = None

    # JSON-LD BlogPosting is our richest source
    for m in RE_JSONLD.finditer(txt):
        block = m.group(1).strip()
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            t = node.get("@type")
            if t in ("BlogPosting", "Article", "NewsArticle"):
                title = title or node.get("headline")
                description = description or node.get("description")
                img = node.get("image")
                if isinstance(img, list) and img:
                    img = img[0]
                if isinstance(img, dict):
                    img = img.get("url")
                image = image or img
                date = date or node.get("datePublished")
                section = section or node.get("articleSection")
                main = node.get("mainEntityOfPage")
                if isinstance(main, dict):
                    url = url or main.get("@id")
                elif isinstance(main, str):
                    url = url or main
                break

    # Fallbacks from meta tags
    if not title:
        m = re.search(r"<title[^>]*>([^<]+)</title>", txt)
        if m:
            title = m.group(1).strip()
    if not description:
        m = re.search(
            r'<meta\s+name=[\'"]description[\'"]\s+content=[\'"]([^\'"]+)[\'"]',
            txt,
        )
        if m:
            description = m.group(1).strip()
    if not image:
        m = re.search(
            r'<meta\s+property=[\'"]og:image[\'"]\s+content=[\'"]([^\'"]+)[\'"]',
            txt,
        )
        if m:
            image = m.group(1).strip()
    if not url:
        # derive from path
        if lang == "en":
            slug = path.stem.replace("post-", "")
            url = f"/{path.stem}"  # /post-foo  (rewritten by _redirects to /blog/foo)
        else:
            url = f"/es/blog/{path.stem}"

    if not (title and image):
        return None

    # Parse date (or fallback to file mtime). Always return naive datetime for
    # consistent sort ordering across posts that have tz-aware vs naive timestamps.
    iso = date
    d = None
    if iso:
        try:
            parsed = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            # Strip tz if present
            d = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            d = None
    if d is None:
        d = datetime.fromtimestamp(path.stat().st_mtime)

    slug = (
        path.stem.replace("post-", "") if lang == "en" else path.stem
    )

    # Clean title — strip site suffix and any trailing ' Guide' marketing tail
    clean_title = re.sub(r"\s*[|–—-]\s*IVAE Studios.*$", "", title).strip()
    # Trim "Guide 2026" / "Pricing Guide 2026" tail
    clean_title = re.sub(r"\s+(?:Pricing\s+)?Guide\s+\d{4}\.?$", "", clean_title).strip()
    clean_title = clean_title.rstrip(":")
    # The og:image points at assets.ivaestudios.com/blog/*-og.jpg — most of
    # those return 404. Pick a local fallback that matches the slug topic.
    local_image = derive_image(slug, image)
    return {
        "slug": slug,
        "title": clean_title,
        "description": (description or "").strip(),
        "image": local_image,
        "image_cdn": image.strip(),
        "date": d,
        "section": (section or "").strip(),
        "url": url,
        "category": derive_category(slug, section or "", lang),
    }


# ────────────────────────────────────────────────────────────────────────────
# Card / feature HTML
# ────────────────────────────────────────────────────────────────────────────
def render_card(p: dict, lang: str) -> str:
    cat = escape(p["category"])
    title_html = emphasize_title(p["title"])
    desc = escape(trim_desc(p["description"]))
    img_alt = escape(p["title"])
    img_src = escape(p["image"])
    href = escape(p["url"])
    read = "Read" if lang == "en" else "Leer"
    return f"""    <a class="ivm-jl-card" href="{href}">
      <div class="ivm-jl-card__photo">
        <img src="{img_src}" alt="{img_alt}" loading="lazy" decoding="async">
      </div>
      <span class="ivm-jl-card__cat">{cat}</span>
      <h3 class="ivm-jl-card__title">{title_html}</h3>
      <p class="ivm-jl-card__desc">{desc}</p>
      <span class="ivm-jl-card__read">{read}</span>
    </a>"""


def render_featured(p: dict, lang: str) -> str:
    cat = escape(p["category"])
    title_html = emphasize_title(p["title"], max_chars=68)
    desc = escape(trim_desc(p["description"], max_len=185))
    img_alt = escape(p["title"])
    img_src = escape(p["image"])
    href = escape(p["url"])
    label = "Featured" if lang == "en" else "Destacado"
    cta = "Read the case study" if lang == "en" else "Leer el caso"
    aria = (
        f"Featured: {escape(p['title'])}" if lang == "en" else f"Destacado: {escape(p['title'])}"
    )
    return f"""  <a class="ivm-jl-feature" href="{href}" aria-label="{aria}">
    <div class="ivm-jl-feature__photo">
      <img src="{img_src}" alt="{img_alt}" loading="eager" fetchpriority="high" decoding="async" width="1600" height="1067">
    </div>
    <div class="ivm-jl-feature__veil" aria-hidden="true"></div>
    <div class="ivm-jl-feature__copy">
      <span class="ivm-jl-feature__cat">{label} · {cat}</span>
      <h2 class="ivm-jl-feature__title">{title_html}</h2>
      <p class="ivm-jl-feature__desc">{desc}</p>
      <span class="ivm-jl-feature__cta">{cta}</span>
    </div>
  </a>"""


# ────────────────────────────────────────────────────────────────────────────
# Replace between markers
# ────────────────────────────────────────────────────────────────────────────
def splice(text: str, start: str, end: str, payload: str) -> str:
    i = text.find(start)
    j = text.find(end)
    if i < 0 or j < 0 or j < i:
        raise RuntimeError(f"Markers {start!r}…{end!r} not found in target.")
    # Keep the marker lines themselves intact, replace what's between.
    head = text[: i + len(start)]
    tail = text[j:]
    return f"{head}\n{payload}\n  {tail}"


# ────────────────────────────────────────────────────────────────────────────
# Main pipeline per language
# ────────────────────────────────────────────────────────────────────────────
def build(lang: str):
    if lang == "en":
        files = sorted(ROOT.glob(EN_POSTS_GLOB))
        target = EN_BLOG
    else:
        files = sorted(ROOT.glob(ES_POSTS_GLOB))
        target = ES_BLOG

    posts = []
    for f in files:
        rec = parse_post(f, lang)
        if rec:
            posts.append(rec)
        else:
            print(f"SKIP {f.name} (missing title/image)")

    # newest first
    posts.sort(key=lambda p: p["date"], reverse=True)

    if not posts:
        print(f"!! no posts found for {lang}")
        return

    featured = posts[0]
    grid = posts[1 : 1 + GRID_COUNT]

    print(f"\n[{lang.upper()}] {len(posts)} posts found, "
          f"featuring {featured['slug']}, {len(grid)} cards in grid")

    feat_html = render_featured(featured, lang)
    cards_html = "\n".join(render_card(p, lang) for p in grid)

    txt = target.read_text(encoding="utf-8")
    txt = splice(txt, F_START, F_END, feat_html)
    txt = splice(txt, G_START, G_END, cards_html)
    target.write_text(txt, encoding="utf-8")
    print(f"  → wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    build("en")
    build("es")
