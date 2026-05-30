#!/usr/bin/env python3
"""Final 100% polish — deterministic, no agents.
  OP1 viewport-fit on the 3 owner-protected pages (non-visual mobile-first meta)
  OP2 viewport meta on 3 internal tool/gallery pages that had none
  OP3 fix 'Escibenos' typo
  OP4 remove the orphan unused .pending-badge CSS rule (2 press pages)
  OP5 add og:locale to luxury-family-photos.html
  OP6 standardize blog-post body contact email info@ -> hello@ (canonical)
  OP7 ES venues: dead /es/contacto -> mailto; /es/locaciones/ breadcrumb -> /es/
  OP8 descriptive alt text on blog hero images (was generic)
  OP9 fetchpriority="high" on the eager LCP hero <img> in blog posts
"""
import os, re, glob, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
report = []

def edit(path, fn):
    try:
        s = open(path, encoding='utf-8').read()
    except FileNotFoundError:
        return
    s2 = fn(s)
    if s2 != s:
        open(path, 'w', encoding='utf-8').write(s2)
        report.append(path)

# OP1 — viewport-fit on protected pages
RE_VP = re.compile(r'(<meta\s+name=["\']viewport["\']\s+content=["\'])([^"\']*?)(["\']\s*/?>)', re.I)
def add_vfit(s):
    def r(m):
        head, content, tail = m.groups()
        if 'viewport-fit' in content: return m.group(0)
        return head + content.rstrip().rstrip(',') + ', viewport-fit=cover' + tail
    return RE_VP.sub(r, s)
for p in ['index.html', 'about.html', 'es/acerca-de.html']:
    edit(p, add_vfit)

# OP2 — add a viewport meta to tool pages that lack one (after <head>)
def add_vp_meta(s):
    if re.search(r'name=["\']viewport["\']', s): return s
    return re.sub(r'(<head[^>]*>)',
                  r'\1\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
                  s, count=1)
for p in ['gallery/auth-callback.html', 'tools/photo-review.html', 'tools/photo-review-v2.html']:
    edit(p, add_vp_meta)

# OP3 — typo
edit('es/blog/costo-sesion-familiar-lujo-cancun-2026.html',
     lambda s: s.replace('Esc&iacute;benos', 'Escr&iacute;benos').replace('Escíbenos', 'Escríbenos'))

# OP4 — remove orphan .pending-badge rule (single-line CSS block)
RE_PB = re.compile(r'\s*\.pending-badge\s*\{[^}]*\}')
for p in ['post-ivae-studios-press-media-coverage.html', 'es/blog/ivae-studios-prensa-cobertura-medios.html']:
    edit(p, lambda s: RE_PB.sub('', s))

# OP5 — og:locale on luxury-family-photos (add primary if only alternate present)
def add_og_locale(s):
    if re.search(r'property=["\']og:locale["\'][^>]*content=["\']en', s): return s
    m = re.search(r'(<meta\s+property=["\']og:locale:alternate["\'][^>]*>)', s)
    tag = '<meta property="og:locale" content="en_US">'
    if 'og:locale' in s and m:
        return s.replace(m.group(1), tag + '\n  ' + m.group(1), 1)
    # else add after og:type or og:url
    m2 = re.search(r'(<meta\s+property=["\']og:(?:type|url)["\'][^>]*>)', s)
    if m2: return s.replace(m2.group(1), m2.group(1) + '\n  ' + tag, 1)
    return s
edit('luxury-family-photos.html', add_og_locale)

# OP6 — standardize blog-post body contact email to hello@
for p in glob.glob('post-*.html') + glob.glob('es/blog/*.html'):
    edit(p, lambda s: s.replace('mailto:info@ivaestudios.com', 'mailto:hello@ivaestudios.com')
                       .replace('info@ivaestudios.com', 'hello@ivaestudios.com'))

# OP7 — ES venue dead links
for p in glob.glob('es/locaciones/*/index.html'):
    edit(p, lambda s: s.replace('href="/es/contacto"', 'href="mailto:hello@ivaestudios.com"')
                       .replace('href="/es/locaciones/"', 'href="/es/"'))

# OP8 + OP9 — descriptive hero alt + fetchpriority on blog posts
GENERIC_ALT = ['Blog hero image', 'Imagen principal del artículo',
               'Imagen principal del blog', 'Imagen hero del blog',
               'Imagen principal del articulo']
def clean_title(s):
    m = re.search(r'<title[^>]*>([^<]+)</title>', s)
    t = m.group(1).strip() if m else ''
    t = re.split(r'\s*[|–—]\s*', t)[0].strip()  # drop after first | – —
    if not t:
        h = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.DOTALL)
        t = re.sub(r'<[^>]+>', '', h.group(1)).strip() if h else 'IVAE Studios'
    return t.replace('"', '&quot;')
def hero_fixes(s):
    title = clean_title(s)
    for g in GENERIC_ALT:
        s = s.replace('alt="%s"' % g, 'alt="%s"' % title)
    # fetchpriority on eager imgs lacking it
    def addfp(m):
        tag = m.group(0)
        if 'fetchpriority' in tag: return tag
        return tag.replace('loading="eager"', 'loading="eager" fetchpriority="high"', 1)
    s = re.sub(r'<img\b[^>]*loading="eager"[^>]*>', addfp, s)
    return s
for p in glob.glob('post-*.html') + glob.glob('es/blog/*.html'):
    edit(p, hero_fixes)

print('Files changed:', len(set(report)))
# tallies
print('  generic-alt remaining:', sum(open(p,encoding="utf-8").read().count('alt="Blog hero image"') for p in glob.glob('post-*.html')))
print('  info@ remaining in blog posts:', len([p for p in glob.glob('post-*.html')+glob.glob('es/blog/*.html') if 'info@ivaestudios.com' in open(p,encoding="utf-8").read()]))
