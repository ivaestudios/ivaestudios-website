#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprueba que TODA variante de /images/optimized/ que el HTML referencia
este versionada en git, o sea, que vaya a existir en produccion.

POR QUE EXISTE (2026-09-13, tercera vez que muerde). La carpeta
images/optimized/ esta en .gitignore, asi que un archivo puede existir
perfectamente en el Mac y no llegar NUNCA al sitio. Eso ya rompio:

  1. las precargas del hero (ronda 1): 785 .avif y .webp subidos pero
     CERO .jpg, asi que fetchpriority=high pedia un 404;
  2. las fotos de la boda Ji & Kailyn, que hubo que meter con `add -f`;
  3. hoy: 90 variantes de 9 fotos de novio, en 6 paginas de dinero.

LA TRAMPA QUE LO HACE INVISIBLE: estas variantes no se piden desde un
<img src>, sino desde <source type="image/avif"> dentro de un <picture>.
**Cuando una <source> devuelve 404 el navegador NO cae al <img> de
respaldo**: se queda con la imagen ROTA. Y como el <img src> del JPEG si
responde 200, revisar la URL del JPEG a mano dice que todo esta bien.
Solo se ve midiendo naturalWidth en un navegador de verdad, o con este
script.

COMO SE ARREGLA: `git add -f` de los archivos que liste, porque el
.gitignore es correcto (no queremos subir las ~1,600 variantes enteras,
solo las que el sitio pide).

Uso:
    python3 scripts/auditar_variantes_optimizadas.py
    python3 scripts/auditar_variantes_optimizadas.py --fail-on-missing
"""
import argparse
import collections
import glob
import os
import re
import subprocess
import sys

SALTAR = ("_backups", "node_modules", ".git")


def referencias(raiz):
    """ruta optimizada -> paginas que la piden"""
    refs = collections.defaultdict(set)
    for ruta in glob.glob(os.path.join(raiz, "**/*.html"), recursive=True):
        rel = os.path.relpath(ruta, raiz)
        if any(x in rel for x in SALTAR):
            continue
        try:
            with open(ruta, encoding="utf-8", errors="ignore") as fh:
                s = fh.read()
        except OSError:
            continue
        # <source srcset> y tambien <img src> por si acaso
        for m in re.finditer(r'srcset="([^"]+)"', s):
            for cand in m.group(1).split(","):
                p = cand.strip().split(" ")[0]
                if p.startswith("/images/optimized/"):
                    refs[p.lstrip("/")].add(rel)
        for m in re.finditer(r'src="(/images/optimized/[^"]+)"', s):
            refs[m.group(1).lstrip("/")].add(rel)
    return refs


def versionados(raiz):
    out = subprocess.run(["git", "-C", raiz, "ls-files", "images/optimized"],
                         capture_output=True, text=True)
    return set(out.stdout.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), ".."))
    ap.add_argument("--fail-on-missing", action="store_true")
    args = ap.parse_args()
    raiz = os.path.abspath(args.root)

    refs = referencias(raiz)
    en_git = versionados(raiz)
    faltan = {r: p for r, p in refs.items() if r not in en_git}

    print("=== VARIANTES OPTIMIZADAS QUE EL SITIO PIDE ===\n")
    print(f"Raiz: {raiz}")
    print(f"Referenciadas por el HTML : {len(refs)}")
    print(f"Versionadas en git        : {len(en_git)}")
    print(f"NO versionadas            : {len(faltan)}\n")

    if faltan:
        por_foto = collections.defaultdict(list)
        for r in sorted(faltan):
            base = re.sub(r"-\d+\.(avif|webp|jpg)$", "", os.path.basename(r))
            por_foto[base].append(r)
        paginas = set()
        for p in faltan.values():
            paginas |= p
        for base, rutas in sorted(por_foto.items()):
            print(f"  {base}  ({len(rutas)} variantes)")
        print(f"\n  Paginas afectadas: {len(paginas)}")
        for p in sorted(paginas):
            print(f"    - {p}")
        print("\n  Arreglo:  git add -f <cada ruta de arriba>")
        print("  (una <source> que da 404 NO cae al <img>: la foto sale ROTA)")
        if args.fail_on_missing:
            return 1
    else:
        print("  OK: todas las variantes que el sitio pide estan versionadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
