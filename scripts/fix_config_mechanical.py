#!/usr/bin/env python3
"""Mechanical, low-risk config fixes across IVAE pages:
  1. Add viewport-fit=cover to viewport meta where missing (mobile-first safe-area).
  2. Null-guard the unguarded `getElementById('siteHeader').classList.toggle('scrolled',...)`
     scroll handler so it can never throw if the header is briefly absent.
Idempotent. Skips *-preview*.html. Prints a per-file change report.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Owner-protected pages — never auto-edit; handled deliberately after live review.
PROTECTED = {'index.html', 'about.html', 'es/index.html', 'es/acerca-de.html'}

def find_html():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        if '/.git' in dp: continue
        for f in fn:
            if f.endswith('.html') and '-preview' not in f:
                p = os.path.join(dp, f)
                if os.path.relpath(p, ROOT) in PROTECTED: continue
                out.append(p)
    return sorted(out)

# viewport meta lacking viewport-fit -> insert ", viewport-fit=cover" before content close-quote
RE_VP = re.compile(r'(<meta\s+name=["\']viewport["\']\s+content=["\'])([^"\']*?)(["\']\s*/?>)', re.I)
# unguarded scroll deref (any condition, any quote)
RE_GUARD = re.compile(
    r"document\.getElementById\((['\"])siteHeader\1\)\.classList\.toggle\(('scrolled'|\"scrolled\")\s*,\s*([^)]*)\)"
)

def fix_viewport(s):
    changed = [0]
    def repl(m):
        head, content, tail = m.group(1), m.group(2), m.group(3)
        if 'viewport-fit' in content:
            return m.group(0)
        content2 = content.rstrip()
        if not content2.endswith(','):
            content2 = content2 + ', viewport-fit=cover'
        else:
            content2 = content2 + ' viewport-fit=cover'
        changed[0]+= 1
        return head + content2 + tail
    s2 = RE_VP.sub(repl, s)
    return s2, changed[0]

def fix_guard(s):
    def repl(m):
        cond = m.group(3).strip()
        return ("(function(_h){if(_h)_h.classList.toggle('scrolled',%s)})"
                "(document.getElementById('siteHeader'))" % cond)
    s2, n = RE_GUARD.subn(repl, s)
    return s2, n

def main():
    files = find_html()
    tot_vp = tot_g = 0
    rep = []
    no_vp_meta = []
    for path in files:
        s = open(path, encoding='utf-8', errors='replace').read()
        orig = s
        s, nvp = fix_viewport(s)
        s, ng = fix_guard(s)
        if 'name="viewport"' not in s and "name='viewport'" not in s:
            no_vp_meta.append(os.path.relpath(path, ROOT))
        if s != orig:
            open(path, 'w', encoding='utf-8').write(s)
            r = os.path.relpath(path, ROOT)
            tags = []
            if nvp: tags.append(f'+viewport-fit')
            if ng: tags.append(f'+guard×{ng}')
            rep.append(f'  {r}  [{", ".join(tags)}]')
            tot_vp += nvp; tot_g += ng
    print(f"Changed {len(rep)} files | viewport-fit added: {tot_vp} | scroll-guards: {tot_g}")
    if no_vp_meta:
        print(f"\n!! {len(no_vp_meta)} files have NO viewport meta at all:")
        for r in no_vp_meta: print(f"   {r}")
    print("\n--- per-file ---")
    print("\n".join(rep))

if __name__ == '__main__':
    main()
