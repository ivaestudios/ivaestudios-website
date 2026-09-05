#!/usr/bin/env python3
"""Consulta REAL a Search Console: posición media por consulta y página.

Uso (en GitHub Actions con GOOGLE_INDEXING_SA_JSON):
    python3 scripts/gsc_queries.py --filtro "canc[uú]n|mejor|best" --dias 28 \
        --sitios sc-domain:ivaestudios.com sc-domain:bodasmx.com.mx

Imprime dos tablas por sitio: consulta+página y solo consulta, ordenadas por
impresiones, filtradas por la expresión regular dada. Solo lectura.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys


def credenciales():
    from google.oauth2 import service_account  # type: ignore

    scopes = ["https://www.googleapis.com/auth/webmasters.readonly"]
    raw = os.environ.get("GOOGLE_INDEXING_SA_JSON")
    if not raw:
        sys.exit("Falta GOOGLE_INDEXING_SA_JSON")
    return service_account.Credentials.from_service_account_info(json.loads(raw), scopes=scopes)


def consultar(servicio, sitio, inicio, fin, dimensiones, filtro_pais=None):
    cuerpo = {
        "startDate": inicio,
        "endDate": fin,
        "dimensions": dimensiones,
        "rowLimit": 25000,
        "dataState": "all",
    }
    if filtro_pais:
        cuerpo["dimensionFilterGroups"] = [{"filters": [{"dimension": "country", "expression": filtro_pais}]}]
    try:
        r = servicio.searchanalytics().query(siteUrl=sitio, body=cuerpo).execute()
    except Exception as e:  # noqa: BLE001
        print(f"  ERROR {sitio} {dimensiones}: {e}")
        return []
    return r.get("rows", [])


def tabla(filas, dims, patron, tope):
    sel = []
    for f in filas:
        claves = f["keys"]
        q = claves[0]
        if patron and not patron.search(q):
            continue
        sel.append((f.get("impressions", 0), f.get("clicks", 0), round(f.get("position", 0), 1), claves))
    sel.sort(key=lambda x: (-x[0], x[2]))
    print("  | " + " | ".join(dims) + " | posición | impresiones | clics |")
    for imp, cl, pos, claves in sel[:tope]:
        print("  | " + " | ".join(str(c) for c in claves) + f" | {pos} | {imp} | {cl} |")
    print(f"  ({len(sel)} filas coinciden; se muestran {min(tope, len(sel))})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--filtro", default=r"canc[uú]n|mejor|best|fot[oó]grafo|photographer")
    ap.add_argument("--dias", type=int, default=28)
    ap.add_argument("--tope", type=int, default=80)
    ap.add_argument("--pais", default="", help="ISO-3 opcional, p. ej. MEX, USA, PER")
    ap.add_argument("--sitios", nargs="*", default=["sc-domain:ivaestudios.com", "sc-domain:bodasmx.com.mx"])
    a = ap.parse_args()

    from googleapiclient.discovery import build  # type: ignore

    servicio = build("searchconsole", "v1", credentials=credenciales(), cache_discovery=False)
    fin = (dt.date.today() - dt.timedelta(days=2)).isoformat()
    inicio = (dt.date.today() - dt.timedelta(days=2 + a.dias)).isoformat()
    patron = re.compile(a.filtro, re.I) if a.filtro else None
    print(f"Ventana {inicio} a {fin} · filtro /{a.filtro}/ · país {a.pais or 'todos'}")
    for sitio in a.sitios:
        print(f"\n=== {sitio} ===")
        print("\n-- consulta + página --")
        tabla(consultar(servicio, sitio, inicio, fin, ["query", "page"], a.pais or None), ["consulta", "página"], patron, a.tope)
        print("\n-- solo consulta --")
        tabla(consultar(servicio, sitio, inicio, fin, ["query"], a.pais or None), ["consulta"], patron, a.tope)
        print("\n-- países (todas las consultas) --")
        tabla(consultar(servicio, sitio, inicio, fin, ["country"]), ["país"], None, 15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
