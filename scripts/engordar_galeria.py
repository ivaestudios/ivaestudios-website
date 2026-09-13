#!/usr/bin/env python3
"""Anade fotos reales a la tira (<div class="strip">) de una pagina de dinero.

POR QUE EXISTE
Medido el 2026-09-13: las paginas de servicio INDEXADAS llevan de 32 a 42
imagenes (cancun-photographer 39, riviera-maya 42, cabo 38) y las que Google
deja en "Crawled - currently not indexed" llevan de 2 a 6
(cancun-wedding-photographer 6, couples-photographer-cancun 2). La competencia
que nos gana lleva de 14 a 35. Una pagina de fotografo con seis fotos no
demuestra lo que dice ser.

Reutiliza el marcado <figure><picture> que la pagina ya usa, asi que no hace
falta CSS nuevo. Solo usa imagenes con el juego completo de variantes
optimizadas (avif y webp en 480/768/1200/1920/2400).
"""
import os
import re
import sys

TAM = [480, 768, 1200, 1920, 2400]


def completas(base_dir="images"):
    opt = set(os.listdir(os.path.join(base_dir, "optimized")))
    out = set()
    for f in os.listdir(base_dir):
        if not f.endswith(".jpg"):
            continue
        n = f[:-4]
        if all(f"{n}-{t}.avif" in opt and f"{n}-{t}.webp" in opt for t in TAM):
            out.add(n)
    return out


def figura(nombre, alt, pie):
    def srcset(ext):
        return ", ".join(f"/images/optimized/{nombre}-{t}.{ext} {t}w" for t in TAM)
    return (
        '\n      <figure>\n'
        f'        <picture><source type="image/avif" srcset="{srcset("avif")}" sizes="(max-width:900px) 100vw, 50vw"/>'
        f'<source type="image/webp" srcset="{srcset("webp")}" sizes="(max-width:900px) 100vw, 50vw"/>'
        f'<img src="/images/{nombre}.jpg" alt="{alt}" loading="lazy" decoding="async" width="1600" height="1067"/></picture>\n'
        f'        <figcaption>{pie}</figcaption>\n'
        '      </figure>'
    )


def engordar(fichero, seleccion):
    """seleccion: lista de (nombre_sin_extension, alt, pie)."""
    s = open(fichero, encoding="utf-8").read()
    i = s.find('<div class="strip">')
    if i < 0:
        return None, "sin <div class=\"strip\">"
    # cierre equilibrado del div
    d = 0
    fin = None
    for m in re.finditer(r'<div\b|</div>', s[i:]):
        d += 1 if m.group(0) == "<div" else -1
        if d == 0:
            fin = i + m.start()
            break
    if fin is None:
        return None, "la tira no cierra"
    ya = set(re.findall(r'<img src="/images/([^".]+)\.jpg"', s[i:fin]))
    nuevas = [x for x in seleccion if x[0] not in ya]
    if not nuevas:
        return None, "ya estaban todas"
    bloque = "".join(figura(*x) for x in nuevas)
    s = s[:fin] + bloque + "\n    " + s[fin:]
    open(fichero, "w", encoding="utf-8").write(s)
    return len(nuevas), None


if __name__ == "__main__":
    print("modulo de apoyo; se usa desde un script que define la seleccion")
