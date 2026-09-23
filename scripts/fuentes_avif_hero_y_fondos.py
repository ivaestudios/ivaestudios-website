#!/usr/bin/env python3
"""Stop pages from downloading camera originals (1 to 3 MB JPEGs).

Three patterns still shipped originals after the 2026-09-14 hero pass:
  1. hero <img> with a srcset of original JPEGs and no <source> in front
     (the browser picks a 960w/1600w JPEG on phones and the 2 to 3 MB
     original on desktop);
  2. CSS backgrounds url('/images/X.jpg') pointing at the original;
  3. a loose <img src="/images/X.jpg"> outside any <picture>.
For 1 and 3 we add <source type=image/avif> and <source type=image/webp>
built from images/optimized/<X>-{480,768,1200,1920,2400}.{avif,webp}
(only widths that exist in git). For 2 we point at <X>-1200.webp. A
<link rel=preload as=image> for the same hero becomes two AVIF preloads
with media queries so mobile and desktop each fetch one file.
Usage: python3 scripts/fuentes_avif_hero_y_fondos.py [files...]  (default: whole site)
"""
import os, re, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
UMBRAL = 400 * 1024
ANCHOS = (480, 768, 1200, 1920, 2400)
TRACKED = set(subprocess.run(["git", "ls-files", "images/optimized"], capture_output=True, text=True).stdout.split())


def size(u):
    p = u.lstrip("/")
    return os.path.getsize(p) if os.path.exists(p) else 0


def es_original(u):
    return u.startswith("/images/") and "/optimized/" not in u and "/hero/" not in u and "/og/" not in u and u.lower().endswith((".jpg", ".jpeg"))


def base_de(u):
    return re.sub(r"^/images/|\.jpe?g$", "", u)


def variantes(base, ext):
    return [(w, f"/images/optimized/{base}-{w}.{ext}") for w in ANCHOS if f"images/optimized/{base}-{w}.{ext}" in TRACKED]


def sources(base, sizes):
    out = []
    for ext in ("avif", "webp"):
        v = variantes(base, ext)
        if len(v) >= 3:
            out.append(f'<source type="image/{ext}" srcset="{", ".join(f"{u} {w}w" for w, u in v)}" sizes="{sizes}">')
    return "".join(out)


def procesar(p):
    t = open(p, encoding="utf-8").read()
    orig = t
    cambios = {"srcset": 0, "bg": 0, "suelta": 0, "preload": 0}
    pics = [(m.start(), m.end()) for m in re.finditer(r"<picture[^>]*>.*?</picture>", t, re.S)]
    # 1 y 3: <img> que descargan originales y no tienen <source> delante
    edits = []
    for m in re.finditer(r"<img\b[^>]*>", t):
        tag = m.group(0)
        src = re.search(r'src="([^"]*)"', tag)
        ss = re.search(r'srcset="([^"]*)"', tag)
        urls = [u.strip().split()[0] for u in (ss.group(1).split(",") if ss else [])] + ([src.group(1)] if src else [])
        if not any(es_original(u) and size(u) > UMBRAL for u in urls):
            continue
        pic = next(((a, b) for a, b in pics if a <= m.start() < b), None)
        if pic and "<source" in t[pic[0]:pic[1]]:
            continue
        base = base_de(src.group(1)) if src and es_original(src.group(1)) else None
        if not base:
            base = base_de(next(u for u in urls if es_original(u)))
        base = re.sub(r"-(960|1600)$", "", base)
        sz = re.search(r'sizes="([^"]*)"', tag)
        src_html = sources(base, sz.group(1) if sz else "100vw")
        if not src_html:
            continue
        if pic:
            edits.append((t.index(">", pic[0]) + 1, 0, src_html, "srcset" if ss else "suelta"))
        else:
            edits.append((m.start(), m.end() - m.start(), f"<picture>{src_html}{tag}</picture>", "srcset" if ss else "suelta"))
    for pos, ln, html, k in sorted(edits, reverse=True):
        t = t[:pos] + html + t[pos + ln:]
        cambios[k] += 1
    # 2: fondos CSS
    def bg(m):
        u = m.group(1)
        if es_original(u) and size(u) > UMBRAL:
            w = f"/images/optimized/{base_de(u)}-1200.webp"
            if w.lstrip("/") in TRACKED:
                cambios["bg"] += 1
                return f"url('{w}')"
        return m.group(0)
    t = re.sub(r"url\(['\"]?(/images/[^'\")]+\.jpe?g)['\"]?\)", bg, t)
    # precargas del hero que apunten a originales
    def pre(m):
        link = m.group(0)
        refs = re.findall(r"/images/[^\s\"',]+\.jpe?g", link)
        if not any(es_original(u) and size(u) > UMBRAL for u in refs):
            return link
        base = re.sub(r"-(960|1600)$", "", base_de(next(u for u in refs if es_original(u))))
        a1200 = f"/images/optimized/{base}-1200.avif"; a1920 = f"/images/optimized/{base}-1920.avif"
        if a1200.lstrip("/") in TRACKED and a1920.lstrip("/") in TRACKED:
            cambios["preload"] += 1
            return (f'<link rel="preload" as="image" type="image/avif" href="{a1200}" media="(max-width: 900px)" fetchpriority="high">'
                    f'<link rel="preload" as="image" type="image/avif" href="{a1920}" media="(min-width: 901px)" fetchpriority="high">')
        return link
    t = re.sub(r'<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>', pre, t)
    if t != orig:
        open(p, "w", encoding="utf-8").write(t)
    return cambios


def main(files):
    if not files:
        for root, ds, fs in os.walk("."):
            if any(x in root for x in ("node_modules", ".git", "/images", "/_redesign", "/tools", "/marketing", "/seo", "/docs", "/functions", "/gallery")):
                continue
            files += [os.path.join(root, f)[2:] for f in fs if f.endswith(".html") and "preview" not in f]
    tot = {"srcset": 0, "bg": 0, "suelta": 0, "preload": 0}; tocadas = []
    for p in sorted(files):
        c = procesar(p)
        if any(c.values()):
            tocadas.append(p)
            for k in tot: tot[k] += c[k]
    print(f"páginas tocadas: {len(tocadas)} | heroes con srcset: {tot['srcset']} | img sueltas: {tot['suelta']} | fondos: {tot['bg']} | precargas: {tot['preload']}")
    return tocadas


if __name__ == "__main__":
    tocadas = main(sys.argv[1:])
    open(os.path.join(ROOT, ".fuentes_avif_tocadas.txt"), "w").write("\n".join(tocadas))
