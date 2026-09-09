#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprueba que las URLs de fuente CLAVADAS en el repo sigan vivas.

POR QUE EXISTE (2026-09-09). El sitio llevaba en 37 paginas, entre ellas
las cuatro pilares y las dos portadas, un

    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="https://fonts.gstatic.com/s/cormorantgaramond/v16/co3W....woff2"/>

apuntando a la version 16 de Cormorant Garamond. Google ya va en la 21 y
retiro ese archivo, asi que la precarga devolvia 404. El fallo es
silencioso y de los caros: la precarga existe justo para que el titular
salga en la serif de la marca desde el primer pintado, y rota hace lo
contrario, gastar una peticion y dejar que el titular parpadee en la
serif de respaldo. Nadie lo ve en el HTML ni en el CSS; solo aparece
mirando la red. Estuvo roto cinco versiones seguidas sin que nadie lo
notara, asi que necesita un vigilante.

COMO SE ARREGLA cuando este script marca rojo: pedirle a Google el CSS
con el mismo `family=` que usa la pagina y un User-Agent de navegador de
verdad, y sacar el bloque @font-face cuyo `unicode-range` empieza en
U+0000 (ese es el subconjunto latino; los primeros bloques que devuelve
Google son cirilico y griego, asi que un `head -1` da el archivo
EQUIVOCADO). Comprobar ademas que la URL sea la misma para Safari, para
Chrome y para Safari de iOS: si difieren, precargar una obliga a bajar
dos.

Uso:
    python3 scripts/auditar_fuentes_precargadas.py
    python3 scripts/auditar_fuentes_precargadas.py --fail-on-broken
"""
import argparse
import collections
import glob
import os
import re
import sys
import urllib.error
import urllib.request

SALTAR = ("_backups", "node_modules", ".git")
PATRON = re.compile(r'https://fonts\.gstatic\.com/[^\s"\')]+')
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")


def recolectar(raiz):
    """URL clavada -> lista de archivos que la traen."""
    encontradas = collections.defaultdict(list)
    for patron in ("**/*.html", "**/*.css", "**/*.js"):
        for ruta in glob.glob(os.path.join(raiz, patron), recursive=True):
            rel = os.path.relpath(ruta, raiz)
            if any(x in rel for x in SALTAR):
                continue
            try:
                with open(ruta, encoding="utf-8", errors="ignore") as fh:
                    texto = fh.read()
            except OSError:
                continue
            for m in PATRON.finditer(texto):
                encontradas[m.group(0)].append(rel)
    return encontradas


def estado(url):
    pet = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(pet, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:                                   # red caida, DNS, etc.
        return f"sin respuesta ({type(e).__name__})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), ".."))
    ap.add_argument("--fail-on-broken", action="store_true",
                    help="salir con 1 si alguna URL de fuente no responde 200")
    args = ap.parse_args()
    raiz = os.path.abspath(args.root)

    print("=== FUENTES CLAVADAS EN EL REPO ===\n")
    print(f"Raiz: {raiz}\n")

    encontradas = recolectar(raiz)
    if not encontradas:
        print("No hay ninguna URL de fonts.gstatic.com clavada. Nada que vigilar.")
        return 0

    rotas = 0
    for url in sorted(encontradas):
        archivos = encontradas[url]
        cod = estado(url)
        ok = cod == 200
        if not ok:
            rotas += 1
        familia = url.split("/s/")[-1].split("/")[0] if "/s/" in url else "?"
        version = (re.search(r"/(v\d+)/", url) or [None, "?"])[1]
        print(f"{'  OK  ' if ok else ' ROTA '} {cod:<8} {familia} {version}   "
              f"en {len(archivos)} archivo(s)")
        print(f"          {url}")
        if not ok:
            for a in sorted(archivos)[:6]:
                print(f"            - {a}")
            if len(archivos) > 6:
                print(f"            ... y {len(archivos) - 6} mas")
        print()

    print(f"URLs distintas: {len(encontradas)}   rotas: {rotas}")
    if rotas and args.fail_on_broken:
        print("\nFALLO: hay precargas de fuente apuntando a archivos que ya no existen.")
        print("Lee la cabecera de este script para la receta de actualizacion.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
