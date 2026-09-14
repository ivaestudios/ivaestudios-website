#!/usr/bin/env python3
"""Envuelve en <picture> los <img> sueltos que YA tienen AVIF/WebP en git.

POR QUE EXISTE
Medido el 2026-09-14: de 4,091 <img> del sitio, 2,522 estaban fuera de
<picture>. De ellos, 153 archivos distintos (1,184 usos) ya tenian su juego
completo de variantes AVIF/WebP versionadas y aun asi se servia el JPEG
original: 1,411 MB de JPEG a lo largo del sitio, con piezas de hasta 3 MB
repetidas en 35 paginas.

El <img> original se conserva TAL CUAL dentro del <picture>, asi que alt,
class, loading, width y height no se tocan y el respaldo sigue siendo el JPEG.

`sizes` se deja en "(max-width:768px) 100vw, 1200px": nunca elige una imagen
mas chica que la caja (nada de fotos borrosas) y evita bajar la de 2400.
"""
import glob
import os
import re
import subprocess

TAM = [480, 768, 1200, 1920, 2400]
SIZES = "(max-width:768px) 100vw, 1200px"


def listas():
    return set(subprocess.run(["git", "ls-files", "images/optimized"],
                              capture_output=True, text=True).stdout.split("\n"))


def completo(base, tracked):
    return all("images/optimized/%s-%d.avif" % (base, t) in tracked
               and "images/optimized/%s-%d.webp" % (base, t) in tracked for t in TAM)


def main():
    tracked = listas()
    n_img = 0
    pags = set()
    for f in glob.glob("**/*.html", recursive=True):
        if "node_modules" in f:
            continue
        s = open(f, encoding="utf-8", errors="ignore").read()
        dentro = set()
        # OJO: hay <picture class="lw-pause-img"> en el sitio. Si aqui se busca
        # solo "<picture>" a secas, sus <img> se vuelven a envolver y queda un
        # <picture> dentro de otro. Paso el 2026-09-14 en 3 paginas.
        for m in re.finditer(r"<picture[^>]*>.*?</picture>", s, re.S):
            for im in re.finditer(r"<img[^>]*>", m.group(0)):
                dentro.add(im.group(0))
        cambios = []
        for m in re.finditer(r"<img[^>]*>", s):
            tag = m.group(0)
            if tag in dentro:
                continue
            sm = re.search(r'src="/images/([^"/]+)\.jpe?g"', tag)
            if not sm:
                continue
            base = sm.group(1)
            if not completo(base, tracked):
                continue
            def ss(ext):
                return ", ".join("/images/optimized/%s-%d.%s %dw" % (base, t, ext, t) for t in TAM)
            pic = ('<picture>'
                   '<source type="image/avif" srcset="%s" sizes="%s"/>'
                   '<source type="image/webp" srcset="%s" sizes="%s"/>'
                   '%s</picture>' % (ss("avif"), SIZES, ss("webp"), SIZES, tag))
            cambios.append((m.start(), m.end(), pic))
        if not cambios:
            continue
        for ini, fin, pic in reversed(cambios):
            s = s[:ini] + pic + s[fin:]
        open(f, "w", encoding="utf-8").write(s)
        n_img += len(cambios)
        pags.add(f)
    print("<img> envueltos en <picture>: %d   en %d paginas" % (n_img, len(pags)))


if __name__ == "__main__":
    main()
