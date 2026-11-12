#!/usr/bin/env python3
"""Compuerta: marcado roto que no se nota al leer el archivo pero si en la pagina.

Tres fallas que el 12-nov-2026 estaban en vivo sin que nadie las viera:

1. Un enlace metido DENTRO de un atributo (alt, title, content, aria-label).
   El navegador corta la etiqueta en la primera comilla y el resto queda como
   texto a la vista: en la galeria de bodas de Cancun se leia
   `Playa Mujeres resort wedding ..." loading="lazy" decoding="async" .../>`.
   Habia 12 paginas asi.

2. Un enlace dentro de otro enlace (una tarjeta que ya es <a> con otro <a> en su
   texto). HTML no lo permite: el navegador cierra la tarjeta donde empieza el
   enlace de adentro y la cuadricula se desordena. Habia 24 casos en 20 paginas;
   en la pagina de parejas seis tarjetas se volvian ocho cajas.

3. Entidades HTML dentro de datos estructurados. Dentro de un
   <script type="application/ld+json"> nada se decodifica: `&amp;` se lee tal
   cual ("Nizuc Resort &amp; Spa"). Habia 12 casos en 6 paginas.

Las tres salieron de pasadas automaticas de enlaces internos que reemplazaron
palabras sin mirar donde estaban. Si se vuelve a correr algo parecido, esta
compuerta lo dice en el mismo push.

Uso:
    python3 scripts/auditar_marcado.py            # informe, sale 1 si hay fallos
    python3 scripts/auditar_marcado.py --lista    # solo la lista, sale 0
"""
from __future__ import annotations

import argparse
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUERA = (".git", "node_modules", "_archive", os.sep + "gallery" + os.sep, os.sep + "marketing" + os.sep,
         os.sep + "functions" + os.sep, os.sep + "tools" + os.sep, os.sep + "_docs" + os.sep, os.sep + "docs" + os.sep)

EN_ATRIBUTO = re.compile(r'\b(alt|title|content|aria-label|placeholder)="[^"<>]*<a\s+href=', re.I)
ANIDADO = re.compile(r"<a\b[^>]*>(?:(?!</a>).)*?<a\b", re.S | re.I)
CODIGO = re.compile(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", re.S | re.I)
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S | re.I)
ENTIDAD = re.compile(r"&(amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+|[a-z]+acute|[a-z]+tilde|[a-z]+uml|rsquo|lsquo|rdquo|ldquo|ndash|mdash|middot);", re.I)


def revisar(s: str) -> list[str]:
    fallos = []
    n = len(EN_ATRIBUTO.findall(s))
    if n:
        fallos.append(f"{n} enlace(s) dentro de un atributo")
    cuerpo = CODIGO.sub(" ", s)
    n = len(ANIDADO.findall(cuerpo))
    if n:
        fallos.append(f"{n} enlace(s) dentro de otro enlace")
    n = sum(len(ENTIDAD.findall(m.group(1))) for m in LD.finditer(s))
    if n:
        fallos.append(f"{n} entidad(es) HTML dentro de datos estructurados")
    return fallos


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lista", action="store_true", help="No falla; solo lista.")
    a = ap.parse_args()

    malas = []
    total = 0
    for base, _, ficheros in os.walk(RAIZ):
        if any(p in base + os.sep for p in FUERA):
            continue
        for nombre in ficheros:
            if not nombre.endswith(".html") or nombre.startswith("_"):
                continue
            ruta = os.path.join(base, nombre)
            try:
                with open(ruta, encoding="utf-8") as fh:
                    s = fh.read()
            except (OSError, UnicodeDecodeError):
                continue
            total += 1
            f = revisar(s)
            if f:
                malas.append((os.path.relpath(ruta, RAIZ), f))

    if not malas:
        print(f"Marcado: {total} paginas revisadas, sin enlaces mal puestos ni entidades en datos estructurados.")
        return 0

    print(f"MARCADO ROTO en {len(malas)} pagina(s) de {total}:")
    for rel, f in sorted(malas):
        print(f"  {rel}: " + "; ".join(f))
    print("\nArreglo: quitar el <a> del atributo o del enlace de afuera (dejar solo el texto),")
    print("y escribir & y los acentos tal cual dentro del JSON-LD.")
    return 0 if a.lista else 1


if __name__ == "__main__":
    sys.exit(main())
