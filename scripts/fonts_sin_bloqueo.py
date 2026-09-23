#!/usr/bin/env python3
"""Load the Google Fonts stylesheet without blocking first paint.

Lighthouse (mobile, simulated) on /cancun-wedding-photographer: performance
81 -> 95, FCP 3.4 s -> 2.0 s, LCP 3.9 s -> 2.7 s. The URL already carries
display=swap, so the font files never blocked; only the cross-origin CSS did.
Pattern: preload as=style + stylesheet with media=print that switches to all
on load + noscript fallback. Idempotent. Usage: python3 scripts/fonts_sin_bloqueo.py [files]
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
PAT = re.compile(r'<link\b(?=[^>]*rel="stylesheet")(?=[^>]*href="(https://fonts\.googleapis\.com/css2?\?[^"]+)")[^>]*>')

def procesar(p):
    t = open(p, encoding="utf-8").read(); n = 0
    def rep(m):
        nonlocal n
        tag = m.group(0)
        if 'media="print"' in tag or "onload" in tag:
            return tag
        if t[max(0, m.start() - 12):m.start()].rstrip().endswith("<noscript>"):
            return tag  # the no-JS fallback we ourselves emit
        if f'<link rel="preload" as="style" href="{m.group(1)}"' in t:
            return tag  # already converted
        u = m.group(1); n += 1
        return (f'<link rel="preload" as="style" href="{u}"/>'
                f'<link rel="stylesheet" href="{u}" media="print" onload="this.media=\'all\'"/>'
                f'<noscript><link rel="stylesheet" href="{u}"/></noscript>')
    t2 = PAT.sub(rep, t)
    if n:
        open(p, "w", encoding="utf-8").write(t2)
    return n

files = sys.argv[1:]
if not files:
    for root, ds, fs in os.walk("."):
        if any(x in root for x in ("node_modules", ".git", "/images", "/_redesign", "/tools", "/seo", "/docs", "/functions", "/gallery")):
            continue
        files += [os.path.join(root, f)[2:] for f in fs if f.endswith(".html") and "preview" not in f]
tocadas = [p for p in sorted(files) if procesar(p)]
print(f"páginas con fonts sin bloqueo: {len(tocadas)}")
open(os.path.join(ROOT, ".fonts_tocadas.txt"), "w").write("\n".join(tocadas))
