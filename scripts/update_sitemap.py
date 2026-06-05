#!/usr/bin/env python3
"""
Auto-regenerate sitemap.xml from the on-disk HTML inventory.

Walks every .html file under the repo (skipping non-public dirs), maps each one
to its canonical public URL, computes priority/changefreq from URL pattern, and
emits a sitemap with hreflang annotations for every EN/ES pair.

Run locally or in CI:
    python scripts/update_sitemap.py            # write changes if any, exit 0
    python scripts/update_sitemap.py --check    # exit 1 if changes are needed
"""
import argparse
import os
import re
import sys
from datetime import datetime, timezone


CANONICAL_HOST = "https://ivaestudios.com"
SITEMAP_NAME = "sitemap.xml"

# Skip these directories outright (matched on first path segment under the
# repo root). Everything else is walked.
EXCLUDE_DIRS = {
    ".git",
    ".github",
    ".wrangler",
    ".devcontainer",
    "node_modules",
    "gallery",
    "functions",
    "seo",
    "tools",
}

# Specific files to skip even though they live at the repo root.
EXCLUDE_FILES = {
    "404.html",
    "coming-soon.html",
}

# ─────────────────────────────────────────────────────────────────────────────
# URL mapping: filesystem path  →  public URL path (relative to host).
#
# These tables encode the canonical URLs we publish to search engines and any
# rewrites declared in `_redirects`. Cloudflare auto-strips `.html` for clean
# URLs, but pillar pages have explicit keyword-rich aliases that must be used
# in the sitemap so Google indexes the keyword form.
# ─────────────────────────────────────────────────────────────────────────────

# Root-level EN HTML files whose public path differs from their filename
# (or is intentionally `/`). Keys are repo-relative paths, values are the
# canonical URL path (no host, leading slash).
EN_ROOT_OVERRIDES = {
    "index.html": "/",
    "cancun.html": "/cancun-photographer",
    "riviera-maya.html": "/riviera-maya-photographer",
    "los-cabos.html": "/cabo-photographer",
    "luxury-weddings.html": "/destination-wedding-photographer-mexico",
    "couples-photography.html": "/couples-photography-mexico",
    "luxury-family-photos.html": "/luxury-family-photos-cancun",
}

# Spanish overrides: same idea, mapping repo paths under es/ to canonical
# Spanish public paths. Most ES pages map 1:1 (drop .html), so only listed
# here when the public path differs from the on-disk slug.
ES_ROOT_OVERRIDES = {
    "es/index.html": "/es/",
}

# post-*.html  →  /blog/<slug>
# Source of truth: the rewrite rules in _redirects (kept in sync with this
# table). If you add a new blog post, add the EN file → blog slug mapping
# here AND the matching es/blog/<slug>.html on disk.
POST_TO_BLOG_SLUG = {
    "post-destination-wedding.html": "destination-wedding-photographer-riviera-maya",
    "post-honeymoon.html": "honeymoon-photographer-riviera-maya",
    "post-wedding-cancun.html": "wedding-photographer-cancun",
    "post-couples.html": "couples-photographer-cancun",
    "post-engagement.html": "engagement-session-cancun-riviera-maya",
    "post-maternity.html": "maternity-photoshoot-cancun-riviera-maya",
    "post-photo-locations-riviera-maya.html": "best-photo-locations-riviera-maya",
    "post-family-vacation-photos.html": "family-vacation-photos-mexico",
    "post-los-cabos-guide.html": "los-cabos-photographer-guide",
    "post-choose-luxury-photographer.html": "how-to-choose-luxury-photographer-mexico",
    "post-surprise-proposal.html": "surprise-proposal-photography-cancun",
    "post-what-to-wear-beach-photos.html": "what-to-wear-beach-photos-mexico",
    "post-best-resorts-cancun-photography.html": "best-resorts-cancun-photography",
    "post-cancun-vs-riviera-maya.html": "cancun-vs-riviera-maya-photos",
    "post-destination-elopement-mexico.html": "destination-elopement-mexico",
    "post-golden-hour-photography-mexico.html": "golden-hour-photography-mexico",
    "post-vow-renewal-mexico.html": "vow-renewal-mexico-photography",
    "post-babymoon-photography-cancun.html": "babymoon-photography-cancun",
    "post-anniversary-photography-mexico.html": "anniversary-photography-mexico",
    "post-all-inclusive-resort-photographer.html": "all-inclusive-resort-photographer-mexico",
    "post-tulum-photography-guide.html": "tulum-photography-guide",
    "post-bachelorette-photoshoot-los-cabos.html": "bachelorette-photoshoot-los-cabos",
    "post-birthday-photoshoot-cancun.html": "birthday-photoshoot-cancun",
    "post-cenote-underwater-photoshoot-tulum.html": "cenote-underwater-photoshoot-tulum",
    "post-quinceanera-photoshoot-cancun.html": "quinceanera-photoshoot-cancun",
    "post-luxury-yacht-photography-cancun.html": "luxury-yacht-photography-cancun",
    "post-trash-the-dress-cancun.html": "trash-the-dress-cancun",
    "post-gender-reveal-photoshoot-cancun.html": "gender-reveal-photoshoot-cancun",
}


def _merge_blog_redirects() -> None:
    """Keep POST_TO_BLOG_SLUG complete from _redirects (the source of truth),
    so newly added blog posts are never dropped from the sitemap. Parses the
    `/blog/<slug> /post-<file> 200` rewrite rules."""
    redirects = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "_redirects"
    )
    try:
        with open(redirects, encoding="utf-8") as fh:
            for line in fh:
                parts = line.split()
                if len(parts) < 3 or parts[2] != "200":
                    continue
                src, dst = parts[0], parts[1].lstrip("/")
                if src.startswith("/blog/") and dst.startswith("post-"):
                    if not dst.endswith(".html"):
                        dst += ".html"
                    POST_TO_BLOG_SLUG.setdefault(dst, src[len("/blog/"):])
    except OSError:
        pass


_merge_blog_redirects()

# EN-blog-slug  ↔  ES-blog-slug (under /blog/ and /es/blog/ respectively).
# Used to compute hreflang pairs.
BLOG_EN_TO_ES = {
    "destination-wedding-photographer-riviera-maya": "fotografo-boda-destino-riviera-maya",
    "honeymoon-photographer-riviera-maya": "fotografo-luna-de-miel-riviera-maya",
    "wedding-photographer-cancun": "fotografo-boda-cancun",
    "couples-photographer-cancun": "fotografo-parejas-cancun",
    "engagement-session-cancun-riviera-maya": "sesion-compromiso-cancun-riviera-maya",
    "maternity-photoshoot-cancun-riviera-maya": "sesion-maternidad-cancun-riviera-maya",
    "best-photo-locations-riviera-maya": "mejores-locaciones-foto-riviera-maya",
    "family-vacation-photos-mexico": "fotos-vacaciones-familiares-mexico",
    "los-cabos-photographer-guide": "guia-fotografo-los-cabos",
    "how-to-choose-luxury-photographer-mexico": "como-elegir-fotografo-lujo-mexico",
    "surprise-proposal-photography-cancun": "fotografia-propuesta-sorpresa-cancun",
    "what-to-wear-beach-photos-mexico": "que-ponerte-fotos-playa-mexico",
    "best-resorts-cancun-photography": "mejores-resorts-fotografia-cancun",
    "cancun-vs-riviera-maya-photos": "cancun-vs-riviera-maya-fotos",
    "destination-elopement-mexico": "fuga-boda-destino-mexico",
    "golden-hour-photography-mexico": "fotografia-hora-dorada-mexico",
    "vow-renewal-mexico-photography": "renovacion-votos-mexico-fotografia",
    "babymoon-photography-cancun": "fotografia-babymoon-cancun",
    "anniversary-photography-mexico": "fotografia-aniversario-mexico",
    "all-inclusive-resort-photographer-mexico": "fotografo-resort-todo-incluido-mexico",
    "tulum-photography-guide": "guia-fotografia-tulum",
    "bachelorette-photoshoot-los-cabos": "sesion-despedida-soltera-los-cabos",
    "birthday-photoshoot-cancun": "sesion-cumpleanos-cancun",
    "cenote-underwater-photoshoot-tulum": "sesion-cenote-submarina-tulum",
    "quinceanera-photoshoot-cancun": "sesion-quinceanera-cancun",
    "luxury-yacht-photography-cancun": "fotografia-yate-lujo-cancun",
    # trash-the-dress-cancun has the same slug in EN and ES.
    "trash-the-dress-cancun": "trash-the-dress-cancun",
    "gender-reveal-photoshoot-cancun": "sesion-revelacion-genero-cancun",
    # Reforzar push (2026-06) — blog/<slug>.html EN directory ↔ es/blog/<slug>.html
    "luxury-event-photography-what-to-expect": "fotografia-eventos-lujo-que-esperar",
    "how-to-plan-a-destination-celebration-cancun": "como-planear-una-celebracion-destino-cancun",
    "best-time-of-day-family-beach-photos-cancun": "mejor-hora-fotos-familiares-playa-cancun",
    "what-to-wear-family-photoshoot-mexico": "que-ponerse-sesion-familiar-mexico",
    "best-proposal-spots-cancun-riviera-maya": "mejores-lugares-propuesta-cancun-riviera-maya",
    "honeymoon-photoshoot-planning-guide": "guia-sesion-luna-de-miel",
    "best-cancun-wedding-venues-2026": "mejores-lugares-boda-cancun-2026",
    "elopement-photographer-tulum-cancun": "fotografo-elopement-tulum-cancun",
    "how-many-hours-wedding-photography-coverage": "cuantas-horas-cobertura-fotografia-boda",
    "sunset-wedding-photography-best-times-cancun": "fotografia-boda-atardecer-mejores-horas-cancun",
    "black-and-white-vs-color-wedding-photography": "fotografia-boda-blanco-negro-vs-color",
    "welcome-dinner-rehearsal-wedding-photography": "fotografia-cena-bienvenida-ensayo-boda",
}

# Top-level EN page slug ↔ Spanish page slug (under es/<slug>).
# Used to compute hreflang for top-level pages.
PAGE_EN_TO_ES = {
    "/": "/es/",
    "/about": "/es/acerca-de",
    "/blog": "/es/blog",
    "/cancun-photographer": "/es/fotografo-cancun",
    "/riviera-maya-photographer": "/es/fotografo-riviera-maya",
    "/cabo-photographer": "/es/fotografo-los-cabos",
    "/destination-wedding-photographer-mexico": "/es/fotografo-bodas-destino-mexico",
    "/couples-photography-mexico": "/es/fotografia-parejas-mexico",
    "/luxury-family-photos-cancun": "/es/fotos-familiares-lujo-cancun",
    "/cancun-wedding-videographer": "/es/videografo-bodas-cancun",
    "/cancun-elopement-photographer": "/es/fotografo-fuga-boda-cancun",
    "/engagement-photographer-cancun": "/es/fotografo-compromiso-cancun",
    "/best-places-to-propose-cancun-riviera-maya": "/es/mejores-lugares-proponer-cancun-riviera-maya",
    "/venues": "/es/venues",
    "/outfit-guide": "/es/guia-vestuario",
    "/brand": "/es/marca",
    "/cancun-wedding-cost-2026": "/es/costo-boda-cancun-2026",
    "/comparison/luxury-photographers-cancun": "/es/comparativa/fotografos-lujo-cancun",
    "/los-cabos-family-photographer": "/es/fotografo-familiar-los-cabos",
    "/social-media-management-mexico-city": "/es/redes-sociales-ciudad-de-mexico",
}

# ES-only pages that have no EN counterpart. Listed so we can emit them
# without trying to find an EN mirror.
ES_ONLY_PAGES = {
    "/es/manejo-redes-sociales",
}

# Language-neutral resources to include alongside the HTML pages.
EXTRA_RESOURCES = [
    {"loc": "/api/facts.json",   "priority": "0.7", "changefreq": "weekly"},
    {"loc": "/llms-full.txt",    "priority": "0.7", "changefreq": "monthly"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Filesystem walk → (loc, lastmod, lang) records.
# ─────────────────────────────────────────────────────────────────────────────

def walk_html(root):
    """Yield (rel_path, abs_path) for every .html file we should consider."""
    for dp, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        if rel_dir != ".":
            top = rel_dir.split(os.sep)[0]
            if top.startswith(".") or top in EXCLUDE_DIRS:
                # Prune the walk so we don't descend into excluded subtrees.
                dirs[:] = []
                continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), root)
            if rel in EXCLUDE_FILES:
                continue
            base = os.path.basename(rel)
            # Never index preview / draft / experimental variant pages.
            if (
                "-preview" in base
                or base.startswith("index-preview")
                or base.startswith(("luxury-weddings-A-", "luxury-weddings-B-", "luxury-weddings-C-"))
            ):
                continue
            # Never include pages explicitly marked noindex: a noindex URL in
            # the sitemap triggers Search Console's "Submitted URL marked
            # noindex" error. Covers utility/form pages (editorial-calendar,
            # marketing-intake) and any future noindex page automatically.
            try:
                with open(os.path.join(dp, fn), encoding="utf-8", errors="ignore") as fh:
                    head = fh.read(4096)
                if re.search(r'name=["\']robots["\'][^>]*noindex', head, re.I):
                    continue
            except OSError:
                pass
            yield rel, os.path.join(dp, fn)


def file_to_url(rel_path):
    """Map a repo-relative .html path to (public_path, lang) or None to skip.

    Returns (path, lang) where path starts with `/` and lang ∈ {"en", "es"}.
    """
    rel = rel_path.replace(os.sep, "/")

    # Spanish tree.
    if rel.startswith("es/"):
        if rel in ES_ROOT_OVERRIDES:
            return ES_ROOT_OVERRIDES[rel], "es"
        # es/locaciones/<slug>/index.html → /es/locaciones/<slug>/
        if rel.startswith("es/locaciones/") and rel.endswith("/index.html"):
            return "/" + rel[: -len("index.html")], "es"
        # es/blog/<slug>.html → /es/blog/<slug>
        if rel.startswith("es/blog/") and rel.endswith(".html"):
            return "/" + rel[: -len(".html")], "es"
        # es/comparativa/<slug>.html → /es/comparativa/<slug>
        if rel.endswith(".html"):
            return "/" + rel[: -len(".html")], "es"
        return None

    # English tree.
    # Root index.
    if rel in EN_ROOT_OVERRIDES:
        return EN_ROOT_OVERRIDES[rel], "en"
    # blog/<slug>.html → /blog/<slug>  (EN blog directory, mirrors es/blog/)
    if rel.startswith("blog/") and rel.endswith(".html"):
        return "/" + rel[: -len(".html")], "en"
    # post-*.html → /blog/<slug>
    if rel.startswith("post-") and rel.endswith(".html"):
        slug = POST_TO_BLOG_SLUG.get(rel)
        if not slug:
            # Unknown post file — skip rather than guess (CI will flag if a
            # new post is added without updating this table).
            return None
        return "/blog/" + slug, "en"
    # venues/<slug>/index.html → /venues/<slug>/
    if rel.startswith("venues/") and rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")], "en"
    # comparison/<slug>.html → /comparison/<slug>
    if rel.startswith("comparison/") and rel.endswith(".html"):
        return "/" + rel[: -len(".html")], "en"
    # Top-level *.html → /<slug> (Cloudflare strips .html)
    if "/" not in rel and rel.endswith(".html"):
        return "/" + rel[: -len(".html")], "en"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Per-URL metadata.
# ─────────────────────────────────────────────────────────────────────────────

PILLAR_PATHS = {
    "/cancun-photographer", "/riviera-maya-photographer", "/cabo-photographer",
    "/destination-wedding-photographer-mexico",
    "/es/fotografo-cancun", "/es/fotografo-riviera-maya", "/es/fotografo-los-cabos",
    "/es/fotografo-bodas-destino-mexico",
}

HIGH_VALUE_PATHS = {
    "/couples-photography-mexico", "/luxury-family-photos-cancun",
    "/blog", "/cancun-wedding-cost-2026",
    "/es/fotografia-parejas-mexico", "/es/fotos-familiares-lujo-cancun",
    "/es/blog", "/es/costo-boda-cancun-2026",
}


def priority_for(path):
    if path in ("/", "/es/"):
        return "1.0"
    if path in PILLAR_PATHS or path in HIGH_VALUE_PATHS:
        return "0.9"
    if path in {"/about", "/es/acerca-de", "/brand", "/es/marca",
                "/outfit-guide", "/es/guia-vestuario"}:
        return "0.8"
    if path.startswith("/blog/") or path.startswith("/es/blog/"):
        return "0.8"
    if path.startswith("/venues/") or path.startswith("/es/locaciones/"):
        return "0.7"
    if path.startswith("/comparison/") or path.startswith("/es/comparativa/"):
        return "0.7"
    if path in ES_ONLY_PAGES:
        return "0.7"
    return "0.5"


def changefreq_for(path):
    if path in ("/", "/es/", "/blog", "/es/blog"):
        return "weekly"
    if path in PILLAR_PATHS:
        return "monthly"
    if path.startswith("/blog/") or path.startswith("/es/blog/"):
        return "monthly"
    if path.startswith("/venues/") or path.startswith("/es/locaciones/"):
        return "monthly"
    return "monthly"


def lastmod_for(abs_path):
    """Return YYYY-MM-DD for the file's mtime (UTC)."""
    ts = os.path.getmtime(abs_path)
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


# ─────────────────────────────────────────────────────────────────────────────
# Hreflang pairing.
# ─────────────────────────────────────────────────────────────────────────────

def en_to_es_path(en_path):
    """Return the canonical ES counterpart for an EN path, or None."""
    if en_path in PAGE_EN_TO_ES:
        return PAGE_EN_TO_ES[en_path]
    if en_path.startswith("/blog/"):
        slug = en_path[len("/blog/"):]
        es_slug = BLOG_EN_TO_ES.get(slug)
        return ("/es/blog/" + es_slug) if es_slug else None
    if en_path.startswith("/venues/"):
        # /venues/<slug>/  →  /es/locaciones/<slug>/
        return "/es/locaciones/" + en_path[len("/venues/"):]
    return None


def es_to_en_path(es_path):
    for en, es in PAGE_EN_TO_ES.items():
        if es == es_path:
            return en
    if es_path.startswith("/es/blog/"):
        es_slug = es_path[len("/es/blog/"):]
        for en_slug, mapped in BLOG_EN_TO_ES.items():
            if mapped == es_slug:
                return "/blog/" + en_slug
        return None
    if es_path.startswith("/es/locaciones/"):
        return "/venues/" + es_path[len("/es/locaciones/"):]
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Sitemap generation.
# ─────────────────────────────────────────────────────────────────────────────

def url_block(loc, lastmod, changefreq, priority, alternates=None):
    """Return one <url>…</url> block as a string."""
    lines = [
        "  <url>",
        f"    <loc>{CANONICAL_HOST}{loc}</loc>",
        f"    <lastmod>{lastmod}</lastmod>",
        f"    <changefreq>{changefreq}</changefreq>",
        f"    <priority>{priority}</priority>",
    ]
    if alternates:
        # alternates is a list of (hreflang, href_path) tuples in stable order.
        for lang, path in alternates:
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="{lang}" '
                f'href="{CANONICAL_HOST}{path}"/>'
            )
    lines.append("  </url>")
    return "\n".join(lines)


def build_sitemap(records, extras):
    """Render the full sitemap XML from the (ordered) record list."""
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        "",
    ]
    for rec in records:
        out.append(url_block(
            rec["loc"],
            rec["lastmod"],
            rec["changefreq"],
            rec["priority"],
            rec.get("alternates"),
        ))
        out.append("")
    for extra in extras:
        out.append(url_block(
            extra["loc"],
            extra["lastmod"],
            extra["changefreq"],
            extra["priority"],
        ))
        out.append("")
    out.append("</urlset>")
    out.append("")  # trailing newline
    return "\n".join(out)


def order_key(rec):
    """Sort key that produces a stable, human-friendly ordering.

    Order: home (en, es), then EN top-level alphabetically (each followed by
    its ES mirror), then EN blog posts alphabetically (each followed by ES
    mirror), then ES-only pages.
    """
    path = rec["loc"]
    lang = rec["lang"]

    # Group buckets:
    #   0 = home (/ then /es/)
    #   1 = top-level EN page (and immediately following ES mirror)
    #   2 = blog index
    #   3 = blog posts
    #   4 = venues/comparison
    #   5 = ES-only
    if path in ("/", "/es/"):
        return (0, 0 if path == "/" else 1, "")
    if path in ("/blog", "/es/blog"):
        return (2, 0 if lang == "en" else 1, "")
    if path.startswith("/blog/") or path.startswith("/es/blog/"):
        # Pair EN+ES side by side using the EN slug as the sort key.
        if lang == "en":
            slug = path[len("/blog/"):]
            return (3, slug, 0)
        else:
            es_slug = path[len("/es/blog/"):]
            # Find the matching EN slug for stable pairing.
            en_slug = None
            for en, es in BLOG_EN_TO_ES.items():
                if es == es_slug:
                    en_slug = en
                    break
            return (3, en_slug or es_slug, 1)
    if path.startswith("/venues/") or path.startswith("/es/locaciones/"):
        if path.startswith("/venues/"):
            slug = path[len("/venues/"):].rstrip("/")
            return (4, slug, 0)
        slug = path[len("/es/locaciones/"):].rstrip("/")
        return (4, slug, 1)
    if path.startswith("/comparison/") or path.startswith("/es/comparativa/"):
        # Pair EN+ES via the EN path so they sort adjacent. The slugs aren't
        # identical (es/comparativa/fotografos-lujo-cancun ↔
        # comparison/luxury-photographers-cancun), so use the lookup table.
        en_path = path if lang == "en" else (es_to_en_path(path) or path)
        return (4, "z-" + en_path, 0 if lang == "en" else 1)
    if path in ES_ONLY_PAGES:
        return (5, path, 0)
    # Top-level pages: pair EN with its ES mirror via PAGE_EN_TO_ES.
    if lang == "en":
        return (1, path, 0)
    # ES top-level: sort using the EN counterpart so pairs stay adjacent.
    en_counterpart = es_to_en_path(path)
    return (1, en_counterpart or path, 1)


def collect_records(root):
    """Walk the tree, build a record per HTML file."""
    by_path = {}
    for rel, abs_path in walk_html(root):
        result = file_to_url(rel)
        if result is None:
            continue
        loc, lang = result
        rec = {
            "loc": loc,
            "lang": lang,
            "lastmod": lastmod_for(abs_path),
            "priority": priority_for(loc),
            "changefreq": changefreq_for(loc),
        }
        by_path[loc] = rec

    # Build alternates for each record.
    for loc, rec in by_path.items():
        if rec["lang"] == "en":
            es = en_to_es_path(loc)
            if es and es in by_path:
                rec["alternates"] = [
                    ("en", loc),
                    ("es", es),
                    ("x-default", loc),
                ]
        else:
            if loc in ES_ONLY_PAGES:
                rec["alternates"] = [
                    ("es", loc),
                    ("x-default", loc),
                ]
                continue
            en = es_to_en_path(loc)
            if en and en in by_path:
                rec["alternates"] = [
                    ("en", en),
                    ("es", loc),
                    ("x-default", en),
                ]

    return sorted(by_path.values(), key=order_key)


def build_extras(root):
    """Return the static extra resources, decorated with each file's mtime."""
    out = []
    for entry in EXTRA_RESOURCES:
        rel = entry["loc"].lstrip("/")
        abs_path = os.path.join(root, rel)
        lastmod = (
            lastmod_for(abs_path)
            if os.path.exists(abs_path)
            else datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        )
        out.append({**entry, "lastmod": lastmod})
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Diff + write.
# ─────────────────────────────────────────────────────────────────────────────

LOC_RE = re.compile(r"<loc>([^<]+)</loc>")


def extract_locs(xml_text):
    """Return the ordered list of <loc> values from a sitemap.xml string."""
    return LOC_RE.findall(xml_text or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        help="Repo root (defaults to the parent of this script).",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if the on-disk sitemap is out of date (CI mode).",
    )
    args = ap.parse_args()

    records = collect_records(args.root)
    extras = build_extras(args.root)
    new_xml = build_sitemap(records, extras)

    sitemap_path = os.path.join(args.root, SITEMAP_NAME)
    old_xml = ""
    if os.path.exists(sitemap_path):
        with open(sitemap_path, "r", encoding="utf-8") as f:
            old_xml = f.read()

    if old_xml == new_xml:
        print("sitemap.xml unchanged")
        sys.exit(0)

    old_locs = set(extract_locs(old_xml))
    new_locs = set(extract_locs(new_xml))
    added = sorted(new_locs - old_locs)
    removed = sorted(old_locs - new_locs)
    same = old_locs & new_locs

    print(f"sitemap.xml diff: +{len(added)} added, "
          f"-{len(removed)} removed, ={len(same)} unchanged")
    if added:
        print("\nAdded:")
        for u in added[:50]:
            print(f"  + {u}")
        if len(added) > 50:
            print(f"  …and {len(added) - 50} more")
    if removed:
        print("\nRemoved:")
        for u in removed[:50]:
            print(f"  - {u}")
        if len(removed) > 50:
            print(f"  …and {len(removed) - 50} more")

    if args.check:
        print("\n--check: sitemap.xml is out of date. "
              "Run `python scripts/update_sitemap.py` to regenerate.")
        sys.exit(1)

    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write(new_xml)
    print(f"\nWrote {sitemap_path} ({len(records) + len(extras)} URLs)")
    sys.exit(0)


if __name__ == "__main__":
    main()
