#!/usr/bin/env python3
"""Compuerta: ninguna pagina indexable puede declarar preguntas que no se ven.

Google pide que el marcado FAQPage refleje contenido VISIBLE en la pagina. Un
FAQPage con preguntas que solo viven en el JSON-LD es marcado sin contenido: en
el mejor caso se ignora y en el peor se trata como spam estructurado.

El 2026-09-08 encontramos 178 preguntas invisibles repartidas en 17 paginas
vivas. Este script existe para que no vuelva a pasar sin que nadie se entere.

Uso:
    python3 scripts/auditar_faq.py            # informe, sale 1 si hay fallos
    python3 scripts/auditar_faq.py --lista    # solo la lista, sale 0
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def normalizar(t: str) -> str:
    """Compara sin acentos, sin entidades y sin puntuacion: la misma pregunta
    escrita con &oacute; o con o acentuada tiene que contar como la misma."""
    t = html.unescape(t)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def preguntas_declaradas(s: str) -> list[str]:
    qs: list[str] = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            d = json.loads(m.group(1))
        except Exception:
            continue
        for node in (d.get("@graph") or [d]):
            if isinstance(node, dict) and node.get("@type") == "FAQPage":
                for q in node.get("mainEntity", []):
                    if isinstance(q, dict) and q.get("name"):
                        qs.append(q["name"])
    return qs


def texto_visible(s: str) -> str:
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    return normalizar(re.sub(r"<[^>]+>", " ", s))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lista", action="store_true", help="No falla; solo lista.")
    a = ap.parse_args()

    fallos = []
    for base, _, ficheros in os.walk(RAIZ):
        if any(p in base for p in (".git", "node_modules", "_archive")):
            continue
        for nombre in ficheros:
            if not nombre.endswith(".html"):
                continue
            ruta = os.path.join(base, nombre)
            rel = os.path.relpath(ruta, RAIZ)
            with open(ruta, encoding="utf-8") as fh:
                s = fh.read()
            if '"FAQPage"' not in s:
                continue
            # Un borrador con noindex no le habla a Google: no es problema.
            if re.search(r'name="robots"[^>]*content="[^"]*noindex', s):
                continue
            qs = preguntas_declaradas(s)
            if not qs:
                continue
            vis = texto_visible(s)
            faltan = [q for q in qs if normalizar(q)[:45] and normalizar(q)[:45] not in vis]
            if faltan:
                fallos.append((rel, len(qs), faltan))

    if not fallos:
        print("FAQ: todas las preguntas declaradas se ven en la pagina.")
        return 0

    total = sum(len(f[2]) for f in fallos)
    print(f"FAQ FANTASMA: {total} pregunta(s) declaradas y no visibles en {len(fallos)} pagina(s).")
    for rel, n, faltan in sorted(fallos, key=lambda x: -len(x[2])):
        print(f"  {rel}  ({len(faltan)} de {n})")
        for q in faltan[:3]:
            print(f"      - {q[:90]}")
    print("\nArreglo: renderiza la pregunta en el HTML con el patron de FAQ que ya usa")
    print("esa pagina, o quita esa pregunta del bloque FAQPage.")
    return 0 if a.lista else 1


if __name__ == "__main__":
    sys.exit(main())
