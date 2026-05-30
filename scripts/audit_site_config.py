#!/usr/bin/env python3
"""Site-wide internal-config audit for IVAE.
Checks every HTML page (excl. *-preview, .git) against a menu/header/footer/
visibility/viewport rubric and prints a structured, bucketed report.
Read-only. No mutation.
"""
import os, re, sys, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def rel(p): return os.path.relpath(p, ROOT)

def find_html():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        if '/.git' in dp: continue
        for f in fn:
            if f.endswith('.html') and not f.endswith('-preview.html') and 'preview-v2' not in f:
                out.append(os.path.join(dp, f))
    return sorted(out)

def bucket(r):
    if r in ('index.html','about.html') or r in ('es/index.html','es/acerca-de.html'): return '0_home_about'
    if r.startswith('post-') or r == 'blog.html': return '4_blog_en'
    if r.startswith('es/blog'): return '5_blog_es'
    if r.startswith('ivae-marketing/') or 'marketing' in r or 'redes-sociales' in r or 'social-media' in r: return '6_marketing'
    if r.startswith('venues/') or r.startswith('es/locaciones/') or any(h in r for h in ('rosewood','banyan','nizuc','le-blanc','mayakoba')): return '3_venues'
    if any(c in r for c in ('cancun','los-cabos','riviera-maya','tulum','cabos','fotografo-')): return '2_cities'
    if any(s in r for s in ('weddings','family','familiares','couples','parejas','editorial','bodas','quinceanera')): return '1_services'
    return '7_misc'

# regex helpers
RE_VIEWPORT_FIT = re.compile(r'viewport-fit=cover')
RE_SITEHDR = re.compile(r'js/site-header\.js')
RE_MKTHDR  = re.compile(r'js/marketing-header\.js')
RE_STATIC_TOGGLE = re.compile(r'id=["\']headerToggle["\']')
RE_STATIC_MNAV   = re.compile(r'id=["\']mobileNav["\']')
RE_IVM_PAGE = re.compile(r'class=["\'][^"\']*\bivm-page\b')
RE_IVM_WRAP = re.compile(r'class=["\']ivm["\']|class=["\']ivm\s')
RE_JLCATS = re.compile(r'ivm-jl-cats')
RE_JLCARD = re.compile(r'ivm-jl-card\b')
RE_DATACAT = re.compile(r'data-cat\b|data-category')
# unguarded getElementById('X').method  (no var assignment, no if, immediate deref)
RE_UNGUARDED = re.compile(r"(?<![=\w])document\.getElementById\((['\"])(headerToggle|mobileNav|siteHeader)\1\)\s*\.")
RE_COLOPHON = re.compile(r'class=["\']colophon')
RE_IVMKT_FOOTER = re.compile(r'imkt-ft|imkt-foot|ivm-foot|marketing-footer|class=["\'][^"\']*imkt')

def classify(path):
    try:
        s = open(path, encoding='utf-8', errors='replace').read()
    except Exception as e:
        return {'error': str(e)}
    r = rel(path)
    issues = []
    site = bool(RE_SITEHDR.search(s))
    mkt  = bool(RE_MKTHDR.search(s))
    has_toggle = bool(RE_STATIC_TOGGLE.search(s))
    has_mnav   = bool(RE_STATIC_MNAV.search(s))
    ivm_page = bool(RE_IVM_PAGE.search(s))
    vfit = bool(RE_VIEWPORT_FIT.search(s))
    jlcats = bool(RE_JLCATS.search(s))
    n_jlcard = len(RE_JLCARD.findall(s))
    # count cards carrying category data (rough: data-cat near ivm-jl-card)
    cards_with_cat = len(re.findall(r'ivm-jl-card[^>]*?(data-cat|data-category)', s))
    unguarded = RE_UNGUARDED.findall(s)

    # ---- rubric ----
    if site and mkt:
        issues.append('BOTH header injectors present (site+marketing) — conflict')
    if not site and not mkt and bucket(r) not in ('7_misc',):
        issues.append('NO header injector')
    if (has_toggle or has_mnav) and (site or mkt):
        issues.append('ZOMBIE static mobile menu (#headerToggle/#mobileNav) alongside injector — dual menu')
    if unguarded:
        ids = sorted(set(m[1] for m in unguarded))
        issues.append(f'UNGUARDED getElementById deref: {",".join(ids)}')
    if not vfit:
        issues.append('missing viewport-fit=cover')
    if jlcats and n_jlcard > 0 and cards_with_cat == 0:
        issues.append(f'NON-FUNCTIONAL category nav: {n_jlcard} cards, 0 with data-cat (filter pills dead)')
    # mobile-only empty desktop heuristic: ivm-page + has .ivm wrapper but tiny non-ivm body
    if ivm_page:
        # strip the .ivm wrapper block crudely; check if there's substantial desktop content
        # heuristic: presence of a desktop main/section outside .ivm
        non_ivm_main = re.search(r'<main[^>]*>(?![^<]*ivm)', s)
        # count <section> not obviously ivm
        desk_sections = len(re.findall(r'<section(?![^>]*ivm)', s))
        if desk_sections <= 1 and 'le-masthead' not in s and 'lw-blog-archive' not in s and 'lw-' not in s[:s.find('class="ivm"') if 'class="ivm"' in s else 0:]:
            pass  # too noisy; report separately below
    return {
        'rel': r, 'bucket': bucket(r),
        'site': site, 'mkt': mkt, 'toggle': has_toggle, 'mnav': has_mnav,
        'ivm_page': ivm_page, 'vfit': vfit, 'jlcats': jlcats,
        'n_jlcard': n_jlcard, 'cards_with_cat': cards_with_cat,
        'unguarded': sorted(set(m[1] for m in unguarded)),
        'issues': issues,
    }

def main():
    files = find_html()
    results = [classify(f) for f in files]
    results = [x for x in results if 'error' not in x]
    by_bucket = defaultdict(list)
    for x in results: by_bucket[x['bucket']].append(x)

    print(f"=== IVAE site config audit — {len(results)} pages ===\n")
    # summary counts
    flagged = [x for x in results if x['issues']]
    print(f"Pages with >=1 issue: {len(flagged)}/{len(results)}\n")

    # aggregate issue type counts
    agg = defaultdict(int)
    for x in flagged:
        for i in x['issues']:
            key = i.split(':')[0].split(' —')[0].strip()
            agg[key]+=1
    print("--- Issue type tallies ---")
    for k,v in sorted(agg.items(), key=lambda kv:-kv[1]):
        print(f"  {v:>4}  {k}")
    print()

    # per-bucket header system map
    print("--- Header system by bucket ---")
    for b in sorted(by_bucket):
        xs = by_bucket[b]
        site=sum(x['site'] for x in xs); mkt=sum(x['mkt'] for x in xs)
        zombie=sum(1 for x in xs if (x['toggle'] or x['mnav']) and (x['site'] or x['mkt']))
        novf=sum(1 for x in xs if not x['vfit'])
        ung=sum(1 for x in xs if x['unguarded'])
        print(f"  {b:14} n={len(xs):>3}  site={site:>3} mkt={mkt:>3} | zombie-menu={zombie:>3} no-vfit={novf:>3} unguarded={ung:>3}")
    print()

    # list each flagged file
    print("--- Flagged files (detail) ---")
    for b in sorted(by_bucket):
        fb=[x for x in by_bucket[b] if x['issues']]
        if not fb: continue
        print(f"\n### {b} ({len(fb)} flagged)")
        for x in fb:
            print(f"  {x['rel']}")
            for i in x['issues']:
                print(f"       - {i}")

if __name__ == '__main__':
    main()
