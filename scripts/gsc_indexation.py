#!/usr/bin/env python3
"""IVAE Studios — medidor REAL de indexación en Google.

Responde la pregunta "¿ya está todo indexado?" con datos, no con estimaciones.

Dos fuentes, en este orden de confianza:

1. Search Analytics por PÁGINA (últimos 28 días). Si una URL registró aunque
   sea UNA impresión, está indexada: Google no puede mostrar lo que no tiene.
   Es prueba positiva y no consume cuota de inspección.

2. URL Inspection API para una muestra de las que NO tienen impresiones. Ahí
   Google devuelve el veredicto exacto (`coverageState`), que distingue lo
   que de verdad importa:
     - "Submitted and indexed"              → indexada, aún sin impresiones
     - "Crawled - currently not indexed"    → la vio y decidió no indexarla
                                              (problema de autoridad, no técnico)
     - "Discovered - currently not indexed" → aún no la rastrea (cola)
     - "URL is unknown to Google"           → ni la conoce
   La distinción manda: "crawled not indexed" se arregla con enlaces externos,
   "discovered" se arregla esperando, y "unknown" se arregla enviándola.

Cuota de la API de inspección: 2,000 URLs/día y 600/minuto por propiedad. El
script se queda MUY por debajo (por defecto 120) porque su trabajo es medir,
no agotar la cuota que usa el envío diario.

Uso:
    python3 scripts/gsc_indexation.py                 # informe completo
    python3 scripts/gsc_indexation.py --inspeccionar 200
    python3 scripts/gsc_indexation.py --sin-inspeccion  # solo impresiones

Requiere `GOOGLE_INDEXING_SA_JSON` (misma credencial del reporte semanal) y
que la cuenta de servicio tenga acceso a la propiedad en Search Console.
Sin credencial escribe un informe explicando qué falta y sale con 0.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import warnings
from collections import Counter
from typing import Any

warnings.filterwarnings("ignore")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
SITE_URLS = ["sc-domain:ivaestudios.com", "https://ivaestudios.com/"]
DOMINIO = "https://ivaestudios.com"

# Tope conservador de inspecciones por corrida (la cuota diaria es 2000).
INSPECCIONES_POR_DEFECTO = 120
# La API tolera 600/min; 0.2 s entre llamadas deja margen de sobra.
PAUSA_ENTRE_INSPECCIONES = 0.2


# ─────────────────────────── utilidades ───────────────────────────


def urls_del_sitemap() -> list[str]:
    ruta = os.path.join(RAIZ, "sitemap.xml")
    with open(ruta, encoding="utf-8") as fh:
        return re.findall(r"<loc>(.*?)</loc>", fh.read())


def grupo_de(url: str) -> str:
    """Clasifica cada URL para poder informar por bloque, no solo en total."""
    ruta = url.replace(DOMINIO, "") or "/"
    if ruta.startswith("/es/blog/"):
        return "blog ES"
    if ruta.startswith("/blog/"):
        return "blog EN"
    if ruta.startswith("/es/"):
        return "páginas ES"
    if ruta in ("/", ""):
        return "home"
    return "páginas EN"


def cargar_credenciales() -> Any:
    sa_json = os.environ.get("GOOGLE_INDEXING_SA_JSON")
    if not sa_json:
        return None
    try:
        from google.oauth2 import service_account  # type: ignore
    except ImportError:
        print("WARN: falta google-auth (pip install google-auth google-api-python-client)", file=sys.stderr)
        return None
    try:
        return service_account.Credentials.from_service_account_info(
            json.loads(sa_json), scopes=GSC_SCOPES
        )
    except (ValueError, json.JSONDecodeError) as e:
        print(f"WARN: GOOGLE_INDEXING_SA_JSON inválido: {e}", file=sys.stderr)
        return None


def propiedad_valida(service: Any) -> str | None:
    """Devuelve la primera propiedad de GSC que responde. GSC acepta dos
    formatos (dominio y prefijo de URL) y solo uno suele estar dado de alta."""
    hoy = dt.date.today()
    for site in SITE_URLS:
        try:
            service.searchanalytics().query(
                siteUrl=site,
                body={
                    "startDate": (hoy - dt.timedelta(days=7)).isoformat(),
                    "endDate": hoy.isoformat(),
                    "dimensions": ["date"],
                    "rowLimit": 1,
                },
            ).execute()
            return site
        except Exception:  # noqa: BLE001 — probamos el siguiente formato
            continue
    return None


# ─────────────────────────── fuente 1: impresiones ───────────────────────────


def paginas_con_impresiones(service: Any, site: str, dias: int) -> dict[str, dict]:
    """Todas las páginas con al menos una impresión en la ventana.

    Pagina de 25k en 25k porque GSC corta en 25,000 filas por respuesta.
    """
    fin = dt.date.today() - dt.timedelta(days=2)  # GSC va ~2 días atrasado
    inicio = fin - dt.timedelta(days=dias)
    filas: list[dict] = []
    arranque = 0
    while True:
        try:
            resp = (
                service.searchanalytics()
                .query(
                    siteUrl=site,
                    body={
                        "startDate": inicio.isoformat(),
                        "endDate": fin.isoformat(),
                        "dimensions": ["page"],
                        "rowLimit": 25000,
                        "startRow": arranque,
                        "dataState": "all",
                    },
                )
                .execute()
            )
        except Exception as e:  # noqa: BLE001
            print(f"WARN: consulta por página falló: {e}", file=sys.stderr)
            break
        lote = resp.get("rows", []) or []
        filas.extend(lote)
        if len(lote) < 25000:
            break
        arranque += len(lote)

    salida: dict[str, dict] = {}
    for f in filas:
        url = f["keys"][0].rstrip("/") if f["keys"][0] != DOMINIO + "/" else f["keys"][0]
        salida[url] = {
            "impresiones": int(f.get("impressions", 0)),
            "clics": int(f.get("clicks", 0)),
            "posicion": round(float(f.get("position", 0)), 1),
        }
    return salida


# ─────────────────────────── fuente 2: inspección ───────────────────────────


def inspeccionar(service: Any, site: str, urls: list[str]) -> dict[str, dict]:
    """Veredicto exacto de Google por URL. Consume cuota: se usa con tope."""
    veredictos: dict[str, dict] = {}
    for i, url in enumerate(urls, 1):
        try:
            resp = (
                service.urlInspection()
                .index()
                .inspect(body={"inspectionUrl": url, "siteUrl": site})
                .execute()
            )
            r = resp.get("inspectionResult", {}).get("indexStatusResult", {})
            veredictos[url] = {
                "estado": r.get("coverageState", "sin dato"),
                "veredicto": r.get("verdict", "sin dato"),
                "robots": r.get("robotsTxtState", ""),
                "ultimo_rastreo": (r.get("lastCrawlTime") or "")[:10],
                "canonica_google": r.get("googleCanonical", ""),
            }
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            veredictos[url] = {"estado": f"ERROR: {msg[:90]}", "veredicto": "ERROR"}
            # Si es cuota agotada no tiene sentido seguir martillando.
            if "quota" in msg.lower() or "429" in msg:
                print(f"WARN: cuota de inspección agotada tras {i} URLs", file=sys.stderr)
                break
        if i % 25 == 0:
            print(f"  inspeccionadas {i}/{len(urls)}...", file=sys.stderr)
        time.sleep(PAUSA_ENTRE_INSPECCIONES)
    return veredictos


# ─────────────────────────── informe ───────────────────────────


def stub(motivo: str) -> str:
    return (
        "# Indexación en Google — no se pudo medir\n\n"
        f"**Motivo:** {motivo}\n\n"
        "Para que este informe funcione, la cuenta de servicio de "
        "`GOOGLE_INDEXING_SA_JSON` necesita estar dada de alta en Search "
        "Console (Configuración → Usuarios y permisos) con acceso **Completo** "
        "sobre la propiedad `ivaestudios.com`, y la propiedad debe existir en "
        "alguno de los dos formatos: dominio (`sc-domain:ivaestudios.com`) o "
        "prefijo de URL (`https://ivaestudios.com/`).\n"
    )


def construir_informe(
    total: list[str],
    con_impresiones: dict[str, dict],
    veredictos: dict[str, dict],
    dias: int,
    inspeccion_activa: bool,
) -> str:
    hoy = dt.date.today().isoformat()
    en_sitemap = set(u.rstrip("/") for u in total)
    imp_en_sitemap = {u: d for u, d in con_impresiones.items() if u.rstrip("/") in en_sitemap}

    # Por grupo
    grupos: dict[str, dict[str, int]] = {}
    for u in total:
        g = grupo_de(u)
        grupos.setdefault(g, {"total": 0, "con_impresiones": 0})
        grupos[g]["total"] += 1
        if u.rstrip("/") in {k.rstrip("/") for k in imp_en_sitemap}:
            grupos[g]["con_impresiones"] += 1

    n_total = len(total)
    n_imp = len(imp_en_sitemap)
    pct = (n_imp / n_total * 100) if n_total else 0

    L: list[str] = []
    L.append("# Indexación real en Google — IVAE Studios")
    L.append("")
    L.append(f"_Medido: {hoy} · ventana de impresiones: últimos {dias} días_")
    L.append("")
    L.append("## Respuesta corta")
    L.append("")
    L.append(
        f"De las **{n_total} URLs** del sitemap, **{n_imp} ({pct:.0f}%)** tienen "
        "impresiones en Google, es decir están indexadas con certeza: Google no "
        "puede mostrar una página que no tiene."
    )
    L.append("")
    if inspeccion_activa and veredictos:
        cuenta = Counter(v["estado"] for v in veredictos.values())
        indexadas_extra = sum(n for e, n in cuenta.items() if "indexed" in e.lower() and "not indexed" not in e.lower())
        L.append(
            f"De las que aún no registran impresiones se inspeccionaron "
            f"**{len(veredictos)}** una por una con la API de Google. De esas, "
            f"**{indexadas_extra}** sí están indexadas (solo que todavía sin "
            "aparecer en búsquedas)."
        )
        L.append("")
        L.append("### Veredicto exacto de Google en la muestra")
        L.append("")
        L.append("| Estado según Google | URLs | Qué significa |")
        L.append("|---|---|---|")
        significado = {
            "Submitted and indexed": "Indexada. Solo falta que alguien la busque.",
            "Indexed, not submitted in sitemap": "Indexada aunque no venga del sitemap.",
            "Crawled - currently not indexed": "La leyó y decidió no indexarla. Se arregla con autoridad (enlaces externos), no con cambios técnicos.",
            "Discovered - currently not indexed": "La conoce pero aún no la rastrea. Se arregla esperando.",
            "URL is unknown to Google": "Ni la conoce. Hay que enviarla.",
            "Duplicate without user-selected canonical": "La considera copia de otra.",
            "Page with redirect": "Es un redirect, no debería estar en el sitemap.",
        }
        for estado, n in cuenta.most_common():
            L.append(f"| {estado} | {n} | {significado.get(estado, '')} |")
        L.append("")

    L.append("## Por bloque del sitio")
    L.append("")
    L.append("| Bloque | URLs | Con impresiones | % |")
    L.append("|---|---|---|---|")
    for g in sorted(grupos, key=lambda x: -grupos[x]["total"]):
        d = grupos[g]
        p = (d["con_impresiones"] / d["total"] * 100) if d["total"] else 0
        L.append(f"| {g} | {d['total']} | {d['con_impresiones']} | {p:.0f}% |")
    L.append("")

    if imp_en_sitemap:
        L.append("## Las 20 páginas con más impresiones")
        L.append("")
        L.append("| Página | Impresiones | Clics | Posición media |")
        L.append("|---|---|---|---|")
        top = sorted(imp_en_sitemap.items(), key=lambda kv: -kv[1]["impresiones"])[:20]
        for u, d in top:
            L.append(
                f"| {u.replace(DOMINIO, '')} | {d['impresiones']} | {d['clics']} | {d['posicion']} |"
            )
        L.append("")

    sin_imp = [u for u in total if u.rstrip("/") not in {k.rstrip("/") for k in con_impresiones}]
    L.append(f"## Sin impresiones todavía: {len(sin_imp)} URLs")
    L.append("")
    L.append(
        "Sin impresiones NO significa sin indexar: una página recién publicada "
        "puede estar indexada y aún no salir en ninguna búsqueda. Por eso se "
        "inspeccionan una por una arriba."
    )
    L.append("")
    if inspeccion_activa and veredictos:
        problematicas = [
            (u, v) for u, v in veredictos.items()
            if "not indexed" in v["estado"].lower() or "unknown" in v["estado"].lower()
        ]
        if problematicas:
            L.append(f"### Las que Google decidió no indexar ({len(problematicas)} en la muestra)")
            L.append("")
            for u, v in problematicas[:40]:
                L.append(f"- `{u.replace(DOMINIO, '')}` → {v['estado']}")
            if len(problematicas) > 40:
                L.append(f"- ... y {len(problematicas) - 40} más")
            L.append("")
    return "\n".join(L) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=28, help="ventana de impresiones")
    ap.add_argument("--inspeccionar", type=int, default=INSPECCIONES_POR_DEFECTO,
                    help="cuántas URLs sin impresiones inspeccionar una por una")
    ap.add_argument("--sin-inspeccion", action="store_true",
                    help="no usar la API de inspección (no consume cuota)")
    ap.add_argument("--salida", default=None, help="ruta del informe")
    args = ap.parse_args()

    salida = args.salida or os.path.join(
        RAIZ, "seo", "reports", f"indexacion-{dt.date.today().isoformat()}.md"
    )
    os.makedirs(os.path.dirname(salida), exist_ok=True)

    creds = cargar_credenciales()
    if creds is None:
        cuerpo = stub("falta GOOGLE_INDEXING_SA_JSON o la librería google-auth")
        with open(salida, "w", encoding="utf-8") as fh:
            fh.write(cuerpo)
        print(cuerpo)
        return 0

    from googleapiclient.discovery import build  # type: ignore

    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    site = propiedad_valida(service)
    if site is None:
        cuerpo = stub("la cuenta de servicio no tiene acceso a ninguna propiedad de Search Console")
        with open(salida, "w", encoding="utf-8") as fh:
            fh.write(cuerpo)
        print(cuerpo)
        return 0

    print(f"propiedad: {site}", file=sys.stderr)
    total = urls_del_sitemap()
    con_imp = paginas_con_impresiones(service, site, args.dias)
    print(f"páginas con impresiones: {len(con_imp)} | sitemap: {len(total)}", file=sys.stderr)

    veredictos: dict[str, dict] = {}
    inspeccion_activa = not args.sin_inspeccion and args.inspeccionar > 0
    if inspeccion_activa:
        vistos = {k.rstrip("/") for k in con_imp}
        sin_imp = [u for u in total if u.rstrip("/") not in vistos]
        # Prioriza lo más nuevo y valioso: primero los posts, luego el resto.
        sin_imp.sort(key=lambda u: (0 if "/blog/" in u else 1, u))
        muestra = sin_imp[: args.inspeccionar]
        print(f"inspeccionando {len(muestra)} de {len(sin_imp)} sin impresiones...", file=sys.stderr)
        veredictos = inspeccionar(service, site, muestra)

    cuerpo = construir_informe(total, con_imp, veredictos, args.dias, inspeccion_activa)
    with open(salida, "w", encoding="utf-8") as fh:
        fh.write(cuerpo)
    print(cuerpo)
    print(f"\n→ escrito {salida}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
