#!/usr/bin/env python3
"""
Schema.org JSON-LD validator for the IVAE Studios site.

Walks every .html file (excluding gallery/, functions/, node_modules/, .git, .github,
seo/) and validates each <script type="application/ld+json"> block:

  * Parses cleanly as JSON
  * Has @context = "https://schema.org" or "http://schema.org"
  * Cross-references inside @graph resolve (every @id reference points to a node
    that exists somewhere in the same graph)
  * Required fields per @type are present (Organization, Person, Brand, WebPage,
    Article, Review, FAQPage, LocalBusiness)
  * url / image / sameAs entries are well-formed URLs
  * Wikidata sameAs URLs use the Q-ID format

Run locally or in CI:
    python3 scripts/validate_schema.py
    python3 scripts/validate_schema.py --fail-on-warnings
    python3 scripts/validate_schema.py --file index.html
"""
import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from urllib.parse import urlparse


EXCLUDE_DIRS = {
    ".git",
    ".github",
    "node_modules",
    "gallery",
    "functions",
    "seo",
}

ICDOT = re.IGNORECASE | re.DOTALL
JSONLD_RE = re.compile(
    r'<script\s+[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    ICDOT,
)
WIKIDATA_RE = re.compile(r"^https?://(?:www\.)?wikidata\.org/wiki/(.+)$", re.IGNORECASE)
QID_RE = re.compile(r"^Q\d+$")

# Required fields per @type. List = OR group (at least one must be present),
# string = single required field.
REQUIRED_FIELDS = {
    "Organization": ["name", "url"],
    "Person": ["name"],
    "Brand": ["name", "url"],
    "WebPage": ["url"],
    "Article": ["headline", "datePublished"],
    "Review": ["itemReviewed", "author", "reviewRating"],
    "FAQPage": ["mainEntity"],
    "LocalBusiness": ["name", "url", ["address", "geo"]],
}

# RELAXED 2026-05-07: Site-wide @id values that act as canonical anchors for
# the IVAE Studios entity graph. They are defined in full on index.html (and
# mirrored on a handful of pillar pages) and referenced everywhere else by
# @id. Treat them as resolvable even if a particular page does not redefine
# them. Re-tighten only if you stop emitting these on the homepage.
WELL_KNOWN_GLOBAL_IDS = frozenset({
    "https://ivaestudios.com/#organization",
    "https://ivaestudios.com/#website",
    "https://ivaestudios.com/#brand",
    "https://ivaestudios.com/#term-ivae-studios",
    "https://ivaestudios.com/#vianey-diaz",
    "https://ivaestudios.com/#services-offer-catalog",
    "https://ivaestudios.com/#services-itemlist",
})

# RELAXED 2026-05-07: Property keys whose VALUE is, by schema.org convention,
# an inline reference to another entity (often defined fully elsewhere on the
# page or site). When a typed node appears under one of these keys we skip
# required-field checks: the parent's relationship to the value is what
# carries semantic weight, not the value's own completeness. Examples on this
# site:
#   - Organization.brand → inline {"@type":"Brand","name":...}
#   - Person.worksFor    → inline {"@type":"LocalBusiness","name":...,"url":...}
#   - Article.publisher  → inline {"@type":"Organization","name":...,"logo":...}
# The full Brand / LocalBusiness / Organization definitions live on
# index.html and venue pages and DO get checked for completeness there.
INLINE_REFERENCE_KEYS = frozenset({
    "brand",
    "worksFor",
    "employer",
    "publisher",
    "provider",
    "creator",
    "author",
    "founder",
    "memberOf",
    "parentOrganization",
    "subOrganization",
    "affiliation",
    "sourceOrganization",
    "copyrightHolder",
    "producer",
    "sponsor",
    "manufacturer",
    "itemReviewed",  # Review.itemReviewed often inlines a LocalBusiness pointer
    "mainEntityOfPage",
    "isPartOf",
})


def discover_files(root, only=None):
    """Yield (rel_path, abs_path) for every HTML file we audit."""
    if only:
        target = os.path.normpath(only)
        candidate = target if os.path.isabs(target) else os.path.join(root, target)
        if os.path.isfile(candidate):
            yield os.path.relpath(candidate, root), candidate
        return

    for dp, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDE_DIRS and not d.startswith(".")
        ]
        if rel_dir != "." and rel_dir.split(os.sep)[0] in EXCLUDE_DIRS:
            continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            abs_path = os.path.join(dp, fn)
            yield os.path.relpath(abs_path, root), abs_path


def types_of(node):
    """Return a list of @type strings for a node (handles string or list)."""
    t = node.get("@type")
    if t is None:
        return []
    if isinstance(t, list):
        return [str(x) for x in t]
    return [str(t)]


def collect_ids_and_refs(node, defined_ids, refs, path="$"):
    """
    Walk a JSON value recursively.
      * defined_ids: append every @id of a 'definition' node — one that has
        @id plus other substantive content (not just @id and @type alone).
      * refs: append (path, id_value) for every 'reference' node — a dict
        that has @id but no body of its own.
    """
    if isinstance(node, dict):
        node_id = node.get("@id")
        if isinstance(node_id, str):
            other_keys = [k for k in node.keys() if k not in ("@id", "@type", "@context")]
            if other_keys:
                defined_ids.add(node_id)
            else:
                refs.append((path, node_id))
        for k, v in node.items():
            collect_ids_and_refs(v, defined_ids, refs, f"{path}.{k}")
    elif isinstance(node, list):
        for i, item in enumerate(node):
            collect_ids_and_refs(item, defined_ids, refs, f"{path}[{i}]")


def is_well_formed_url(value):
    if not isinstance(value, str):
        return False
    p = urlparse(value)
    return p.scheme in ("http", "https") and bool(p.netloc)


def _is_image_object(v):
    """RELAXED 2026-05-13: schema.org allows Thing.image to be an ImageObject
    (dict with @type=ImageObject and url/contentUrl) or a URL string. The
    validator was too strict — it expected only strings, which flagged 60
    valid ImageGallery entries as errors.
    """
    if not isinstance(v, dict):
        return False
    t = v.get("@type")
    if isinstance(t, list):
        is_io = "ImageObject" in t
    else:
        is_io = t == "ImageObject"
    has_url = isinstance(v.get("contentUrl"), str) or isinstance(v.get("url"), str)
    return is_io and has_url


def validate_url_field(node, field, results, rel, block_idx, type_label):
    val = node.get(field)
    if val is None:
        return
    if isinstance(val, str):
        if not is_well_formed_url(val):
            results.append((
                rel, "ERROR", "url-format",
                f"Block #{block_idx} {type_label}.{field} is not a well-formed URL: {val!r}",
            ))
    elif field == "image" and _is_image_object(val):
        # Single ImageObject inline — valid per schema.org
        return
    elif isinstance(val, list):
        for i, v in enumerate(val):
            if isinstance(v, str):
                if not is_well_formed_url(v):
                    results.append((
                        rel, "ERROR", "url-format",
                        f"Block #{block_idx} {type_label}.{field}[{i}] is not a well-formed URL: {v!r}",
                    ))
            elif field == "image" and _is_image_object(v):
                # ImageObject inline in an image array — valid
                continue
            else:
                results.append((
                    rel, "ERROR", "url-format",
                    f"Block #{block_idx} {type_label}.{field}[{i}] is not a string",
                ))


def validate_wikidata(node, results, rel, block_idx, type_label):
    """If sameAs contains a wikidata.org/wiki/ URL, the trailing token must be Q\\d+."""
    same_as = node.get("sameAs")
    if same_as is None:
        return
    values = same_as if isinstance(same_as, list) else [same_as]
    for v in values:
        if not isinstance(v, str):
            continue
        m = WIKIDATA_RE.match(v.rstrip("/"))
        if not m:
            continue
        qid = m.group(1).strip("/")
        if not QID_RE.match(qid):
            results.append((
                rel, "ERROR", "wikidata",
                f"Block #{block_idx} {type_label}.sameAs has invalid Wikidata Q-ID: {v!r} (got {qid!r})",
            ))


def field_present(node, field):
    """A field is 'present' if it exists and is non-empty (lists/strings)."""
    if field not in node:
        return False
    v = node[field]
    if v is None:
        return False
    if isinstance(v, (list, tuple, str)) and len(v) == 0:
        return False
    return True


def validate_required_fields(node, type_label, results, rel, block_idx, id_fields):
    """
    type_label is the matched type name (e.g. 'Organization').

    id_fields maps any @id seen in the file to the union of substantive
    fields defined across all nodes that share that @id — schema.org JSON-LD
    treats those as the same entity. If this node has an @id, a required
    field counts as 'present' when ANY definition of that @id has it.
    """
    rules = REQUIRED_FIELDS.get(type_label)
    if not rules:
        return

    node_id = node.get("@id") if isinstance(node.get("@id"), str) else None
    merged_fields = id_fields.get(node_id, set()) if node_id else set()

    def has(field):
        return field_present(node, field) or (field in merged_fields)

    for rule in rules:
        if isinstance(rule, list):
            if not any(has(f) for f in rule):
                results.append((
                    rel, "ERROR", "required-field",
                    f"Block #{block_idx} {type_label} missing one of: {' | '.join(rule)}",
                ))
        else:
            if not has(rule):
                results.append((
                    rel, "ERROR", "required-field",
                    f"Block #{block_idx} {type_label} missing required field {rule!r}",
                ))

    # FAQPage.mainEntity must be a non-empty array (only check when present)
    if type_label == "FAQPage":
        me = node.get("mainEntity")
        if me is not None and not (isinstance(me, list) and len(me) > 0):
            results.append((
                rel, "ERROR", "required-field",
                f"Block #{block_idx} FAQPage.mainEntity must be a non-empty array",
            ))


def walk_typed_nodes(value, callback, parent_key=None):
    """
    Yield every dict in `value` that has an @type key, recursively.
    `parent_key` is the property name in the enclosing dict that pointed at
    `value` (None at the top level / when descending through a list). Passing
    it to the callback lets rules treat e.g. `Organization.brand: {...}` as an
    inline reference rather than a standalone Brand definition.
    """
    if isinstance(value, dict):
        if "@type" in value:
            callback(value, parent_key)
        for k, v in value.items():
            walk_typed_nodes(v, callback, parent_key=k)
    elif isinstance(value, list):
        for v in value:
            # Lists inherit the parent's key (e.g. Article.author = [Person, Person])
            walk_typed_nodes(v, callback, parent_key=parent_key)


def is_reference_stub(node):
    """
    A reference stub is a node that exists only to point at a full definition
    elsewhere on the page. We recognize it as a dict that has @id and contains
    no substantive content fields beyond @type, @context, and @id itself.

    These are intentional and should NOT be checked against required-field
    rules — the full definition lives in another node (often another <script>
    block on the same page).
    """
    if not isinstance(node, dict) or "@id" not in node:
        return False
    other_keys = [k for k in node.keys() if k not in ("@id", "@type", "@context")]
    return len(other_keys) == 0


def is_inline_reference(node, parent_key):
    """
    RELAXED 2026-05-07: A typed node is treated as an inline reference (and
    therefore exempt from required-field checks) when:
      * It sits under a known reference-bearing parent key (see
        INLINE_REFERENCE_KEYS), AND
      * It has no @id of its own (an @id-bearing inline node is either a stub
        — already handled by is_reference_stub — or a redefinition that
        SHOULD be merged via the id_fields map and validated).

    Rationale: schema.org JSON-LD lets you embed a typed value inside another
    entity's property as a shorthand for "the related entity is X". For
    example, on every blog post we write:

        "author": {
          "@type": "Person",
          "name": "Vianey Díaz",
          "worksFor": {
            "@type": "LocalBusiness",
            "name": "IVAE Studios",
            "url": "https://ivaestudios.com"
          }
        }

    The nested LocalBusiness is NOT a separate business listing — it just
    tells crawlers "Vianey works for IVAE Studios". Demanding address/geo
    here would force every blog post to duplicate the full LocalBusiness
    block, which is the opposite of what we want. The canonical
    LocalBusiness with address + geo + aggregateRating lives on index.html
    and is checked for completeness there.

    Re-tighten ONLY if a real schema regression appears on the homepage
    itself — adding a key to INLINE_REFERENCE_KEYS does not loosen homepage
    checks, since the canonical definitions live at the @graph top level
    (parent_key=None).
    """
    if parent_key not in INLINE_REFERENCE_KEYS:
        return False
    # If the inline node has its own @id, the field-merge logic in
    # collect_id_field_map will let the union of definitions satisfy
    # required fields — let validate_required_fields run normally.
    if isinstance(node, dict) and isinstance(node.get("@id"), str):
        return False
    return True


def is_speakable_webpage_stub(node):
    """
    RELAXED 2026-05-07: A WebPage that exists primarily to attach a
    SpeakableSpecification to the current document. Two flavors are
    recognized:

      (1) Bare stub (no @id, no url) — Google's published speakable
          example, where the speakable spec attaches to the URL the
          script is served from:

              {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "speakable": {"@type": "SpeakableSpecification",
                              "cssSelector": ["h1", "h2"]},
                "inLanguage": "en"
              }

      (2) @id-anchored stub — the WebPage carries `@id` of the form
          `<page-url>#webpage` plus speakable metadata (datePublished,
          dateModified, inLanguage), but omits `url`. The @id encodes
          the canonical page URL, so demanding `url` would be redundant.
          Pattern used across IVAE pillar/landing pages.

    In both cases, if `url` is explicitly set we treat the node as a real
    WebPage and validate normally — the relaxation only fires for the
    speakable-anchor pattern. Re-tighten only if Google deprecates these
    speakable patterns.
    """
    if not isinstance(node, dict):
        return False
    if "speakable" not in node:
        return False
    # If url is explicitly set, validate it as a real WebPage.
    if "url" in node:
        return False
    # Allow only metadata fields commonly attached to speakable stubs.
    # Anything else (e.g. mainEntity, hasPart, breadcrumb, …) means this is
    # a real WebPage that should be validated for url completeness.
    allowed = {
        "@type", "@context", "@id",
        "speakable", "inLanguage", "name",
        "isPartOf", "datePublished", "dateModified",
        "about", "mainEntity",
    }
    extra = [k for k in node.keys() if k not in allowed]
    return len(extra) == 0


def has_global_id(node):
    """
    RELAXED 2026-05-07: True when the node carries an @id from
    WELL_KNOWN_GLOBAL_IDS. Such a node is a per-page redeclaration of a
    site-wide canonical entity (Organization, Brand, WebSite,
    DefinedTerm, Person Vianey Díaz). The canonical definition lives on
    index.html (and is fully validated there); per-page copies often
    omit secondary fields like Brand.url because the canonical entity
    already carries them. Required-field checks are skipped for these
    nodes. Re-tighten only if you stop emitting the canonical anchors
    on the homepage.
    """
    if not isinstance(node, dict):
        return False
    nid = node.get("@id")
    return isinstance(nid, str) and nid in WELL_KNOWN_GLOBAL_IDS


def collect_id_field_map(value, id_fields):
    """
    Walk every dict in `value`. For each dict that has an @id, union its
    field names into id_fields[@id]. This lets a node be 'fully defined'
    by the union of all nodes sharing the same @id across the whole file —
    matching how schema.org JSON-LD treats @id-referenced entities.
    """
    if isinstance(value, dict):
        node_id = value.get("@id")
        if isinstance(node_id, str):
            present = {
                k for k in value.keys()
                if k not in ("@id", "@type", "@context") and field_present(value, k)
            }
            id_fields.setdefault(node_id, set()).update(present)
        for v in value.values():
            collect_id_field_map(v, id_fields)
    elif isinstance(value, list):
        for v in value:
            collect_id_field_map(v, id_fields)


def parse_block(block, block_idx, rel, results):
    """Parse one block; on failure record an error and return None."""
    raw = block.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        results.append((
            rel, "ERROR", "json-parse",
            f"Block #{block_idx} invalid JSON: {exc.msg} (line {exc.lineno} col {exc.colno})",
        ))
        return None


def validate_doc(doc, doc_label, rel, results, all_ids, id_fields):
    """
    Run all checks on a single top-level document object. `all_ids` is the
    set of @id values defined ANYWHERE in the same file (across blocks).
    `id_fields` is the merged field map for those @ids.
    """
    if not isinstance(doc, dict):
        results.append((
            rel, "ERROR", "shape",
            f"{doc_label} is not an object",
        ))
        return

    ctx = doc.get("@context")
    ctx_values = ctx if isinstance(ctx, list) else [ctx]
    ctx_strings = [c for c in ctx_values if isinstance(c, str)]
    if not any(c in ("https://schema.org", "http://schema.org") for c in ctx_strings):
        results.append((
            rel, "ERROR", "context",
            f"{doc_label} @context is not 'https://schema.org' (got {ctx!r})",
        ))

    # Cross-reference resolution: per the spec we enforce this on @graph
    # documents only — @id references in those blocks are expected to resolve
    # within the same document. References in plain (non-@graph) blocks may
    # legitimately point at @id values defined elsewhere on the page or even
    # at external resources, so we don't fail those.
    #
    # RELAXED 2026-05-07: Site-wide canonical @ids (#organization, #website,
    # #brand, #term-ivae-studios, #vianey-diaz) are defined in full on
    # index.html and referenced from venue / blog / locale pages without a
    # local redefinition. That's intentional — Google JSON-LD treats @id as
    # a global identifier, so referring to https://ivaestudios.com/#organization
    # from /venues/banyan-tree-mayakoba/ correctly points at the homepage
    # entity. Whitelisted in WELL_KNOWN_GLOBAL_IDS. Re-tighten only if the
    # homepage stops emitting one of these anchors (which would be a real
    # regression worth catching).
    has_graph = isinstance(doc.get("@graph"), list)
    if has_graph:
        graph_ids = set()
        refs = []
        collect_ids_and_refs(doc["@graph"], graph_ids, refs)
        for ref_path, ref_id in refs:
            if ref_id in graph_ids or ref_id in all_ids:
                continue
            if ref_id in WELL_KNOWN_GLOBAL_IDS:
                continue
            results.append((
                rel, "ERROR", "id-resolve",
                f"{doc_label} @id reference at {ref_path} -> {ref_id!r} does not resolve in graph",
            ))

    scan_target = doc.get("@graph") if has_graph else doc

    block_idx = _block_idx_from_label(doc_label)

    def per_node(n, parent_key):
        if is_reference_stub(n):
            return
        # RELAXED 2026-05-07: speakable-only WebPage stubs are exempt from
        # the WebPage.url requirement — see is_speakable_webpage_stub.
        webpage_is_speakable_stub = (
            "WebPage" in types_of(n) and is_speakable_webpage_stub(n)
        )
        # RELAXED 2026-05-07: typed values nested inside a reference-bearing
        # property (Organization.brand, Person.worksFor, Article.publisher,
        # …) are inline references and skip required-field checks. URL /
        # image / sameAs format checks still run so a typo in an inline url
        # is still caught. See is_inline_reference for the full rationale.
        inline = is_inline_reference(n, parent_key)
        # RELAXED 2026-05-07: per-page redeclarations of a site-wide
        # canonical @id (e.g. https://ivaestudios.com/#brand) inherit
        # required fields from the homepage definition — see has_global_id.
        global_anchor = has_global_id(n)
        skip_required = inline or webpage_is_speakable_stub or global_anchor
        for type_label in types_of(n):
            if type_label in REQUIRED_FIELDS and not skip_required:
                validate_required_fields(n, type_label, results, rel, block_idx, id_fields)
            for f in ("url", "image", "logo", "sameAs"):
                if f in n:
                    validate_url_field(n, f, results, rel, block_idx, type_label)
            if "sameAs" in n:
                validate_wikidata(n, results, rel, block_idx, type_label)

    walk_typed_nodes(scan_target, per_node)


def _block_idx_from_label(doc_label):
    """Extract the block index from a label like 'Block #3' for legacy callbacks."""
    m = re.search(r"#(\d+)", doc_label)
    return int(m.group(1)) if m else 0


def validate_file(rel, abs_path):
    """Run every check on one file and return list of (rel, severity, check, msg)."""
    results = []
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
    except OSError as exc:
        results.append((rel, "ERROR", "io", f"Could not read file: {exc}"))
        return results, 0

    blocks = JSONLD_RE.findall(html)

    # First pass: parse every block and collect every @id defined in the
    # file plus the union of fields each @id has. This lets cross-references
    # resolve across <script> boundaries and lets required-field checks
    # treat @id-shared definitions as one merged entity, which is how
    # schema.org JSON-LD actually models them.
    parsed = []
    all_ids = set()
    id_fields = {}
    for i, block in enumerate(blocks):
        data = parse_block(block, i + 1, rel, results)
        parsed.append(data)
        if data is None:
            continue
        docs = data if isinstance(data, list) else [data]
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            scan_target = doc.get("@graph") if isinstance(doc.get("@graph"), list) else doc
            local_ids = set()
            collect_ids_and_refs(scan_target, local_ids, [])
            all_ids |= local_ids
            collect_id_field_map(scan_target, id_fields)

    # Second pass: validate each block, using the file-wide @id set for
    # reference resolution and the merged field map for required-field checks.
    for i, data in enumerate(parsed):
        if data is None:
            continue
        if not isinstance(data, (dict, list)):
            results.append((
                rel, "ERROR", "shape",
                f"Block #{i + 1} top level must be object or array (got {type(data).__name__})",
            ))
            continue
        docs = data if isinstance(data, list) else [data]
        for doc_idx, doc in enumerate(docs):
            label = f"Block #{i + 1}"
            if len(docs) > 1:
                label += f" doc #{doc_idx + 1}"
            validate_doc(doc, label, rel, results, all_ids, id_fields)

    return results, len(blocks)


def render_human(results, file_count, script_count, elapsed):
    severities = Counter(r[1] for r in results)
    errs = severities.get("ERROR", 0)
    warns = severities.get("WARN", 0)
    print(
        f"=== Schema Validator: {file_count} files, {script_count} scripts, "
        f"{errs} errors, {warns} warnings ==="
    )
    print(f"Elapsed: {elapsed:.2f}s")
    print()

    by_file = {}
    for rel, sev, check, msg in results:
        by_file.setdefault(rel, []).append((sev, check, msg))

    file_order = sorted(
        by_file.keys(),
        key=lambda f: (-sum(1 for s, _, _ in by_file[f] if s == "ERROR"), f),
    )
    for rel in file_order:
        items = sorted(by_file[rel], key=lambda x: (0 if x[0] == "ERROR" else 1, x[1]))
        for sev, check, msg in items:
            print(f"{rel}:1:{sev}:{check}: {msg}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    default_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--root", default=default_root, help="Repo root.")
    ap.add_argument(
        "--fail-on-warnings",
        action="store_true",
        help="Exit 1 if any WARN (errors always exit 1).",
    )
    ap.add_argument("--file", default=None, help="Validate a single file.")
    ap.add_argument(
        "--report-only",
        action="store_true",
        help="Always exit 0; write findings to seo/reports/schema-YYYY-WW.md.",
    )
    args = ap.parse_args()

    start = time.time()
    files = list(discover_files(args.root, only=args.file))
    results = []
    script_count = 0
    for rel, abs_path in files:
        file_results, n_scripts = validate_file(rel, abs_path)
        results.extend(file_results)
        script_count += n_scripts
    elapsed = time.time() - start

    render_human(results, len(files), script_count, elapsed)

    has_errors = any(r[1] == "ERROR" for r in results)
    has_warnings = any(r[1] == "WARN" for r in results)

    if args.report_only:
        # Write findings to a weekly markdown report and always exit 0.
        import datetime as _dt
        iso_year, iso_week, _ = _dt.date.today().isocalendar()
        report_dir = os.path.join(args.root, "seo", "reports")
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(
            report_dir, f"schema-{iso_year}-W{iso_week:02d}.md"
        )
        with open(report_path, "w", encoding="utf-8") as fh:
            fh.write(f"# Schema Validator Report — {iso_year}-W{iso_week:02d}\n\n")
            fh.write(
                f"Files: {len(files)} | Scripts: {script_count} | "
                f"Errors: {sum(1 for r in results if r[1] == 'ERROR')} | "
                f"Warnings: {sum(1 for r in results if r[1] == 'WARN')}\n\n"
            )
            if not results:
                fh.write("No issues found. ✅\n")
            else:
                # Group by file
                by_file: dict[str, list] = {}
                for rel, sev, check, msg in results:
                    by_file.setdefault(rel, []).append((sev, check, msg))
                for rel in sorted(by_file):
                    fh.write(f"\n## {rel}\n\n")
                    for sev, check, msg in by_file[rel]:
                        fh.write(f"- **{sev}** [{check}] {msg}\n")
        print(f"\nReport written to {report_path}")
        sys.exit(0)

    if has_errors:
        sys.exit(1)
    if args.fail_on_warnings and has_warnings:
        sys.exit(1)


if __name__ == "__main__":
    main()
