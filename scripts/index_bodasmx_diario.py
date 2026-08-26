#!/usr/bin/env python3
"""Empuja bodasmx.com.mx a la Google Indexing API, 180 URLs por dia.

POR QUE EXISTE
Google no usa IndexNow: o se le empujan las URLs por su API o se esperan
semanas (o meses, en un dominio joven) a que el rastreo las descubra solo.
bodasmx tiene ~930 URLs y la cuota de la API es de 200 al dia COMPARTIDA con
ivaestudios.com, asi que el sitio entero no cabe en un envio: entra en unos
cinco dias, solo.

COMO NO SE PISA CON ivaestudios.com
Se envian 180 y no 200, dejando un colchon de 20 para los envios que dispara
el push de ivaestudios. Si aun asi la cuota se agota, la API responde QUOTA,
el cursor NO avanza y manana se reintentan las mismas.

EL CURSOR
seo/data/bodasmx_index_cursor.json guarda por donde va. Cuando pasa del final
vuelve a empezar: reenviar una URL ya indexada no penaliza y sirve para que
Google revisite lo que cambio.

ORDEN
/fotografia/ va primero a proposito: es el silo que tiene que posicionar.
"""
import json, os, re, sys, urllib.request

CURSOR = "seo/data/bodasmx_index_cursor.json"
POR_DIA = 180
UA = {"User-Agent": "Mozilla/5.0 (compatible; BodasMX-Indexer/1.0)"}


def urls_del_sitemap():
    def loc(u):
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45) as r:
            return re.findall(r"<loc>([^<]+)</loc>", r.read().decode())
    todas = []
    for hijo in loc("https://bodasmx.com.mx/sitemap.xml"):
        todas += loc(hijo) if hijo.endswith(".xml") else [hijo]
    u = sorted(set(todas))
    return [x for x in u if "/fotografia/" in x] + [x for x in u if "/fotografia/" not in x]


def main():
    urls = urls_del_sitemap()
    if not urls:
        print("sitemap vacio o inalcanzable"); return 1

    desde = 0
    if os.path.exists(CURSOR):
        try: desde = int(json.load(open(CURSOR)).get("desde", 0))
        except Exception: desde = 0
    if desde >= len(urls):
        desde = 0
        print("cursor al final: se reinicia para revisitar el sitio")

    lote = urls[desde:desde + POR_DIA]
    print(f"sitio: {len(urls)} URLs | enviando {len(lote)} desde la posicion {desde}")

    # index_urls.py hace el trabajo real (auth con GOOGLE_INDEXING_SA_JSON)
    os.makedirs("/tmp/bmx", exist_ok=True)
    open("/tmp/bmx/urls.txt", "w").write("\n".join(lote))
    os.environ["URLS_FILE"] = "/tmp/bmx/urls.txt"
    import subprocess
    r = subprocess.run([sys.executable, "scripts/index_urls.py"], env=os.environ,
                       capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())

    # el cursor solo avanza si de verdad se indexo algo
    ok = re.search(r"Summary: (\d+) OK", r.stdout or "")
    if ok and int(ok.group(1)) > 0:
        os.makedirs(os.path.dirname(CURSOR), exist_ok=True)
        json.dump({"desde": desde + len(lote), "total": len(urls)}, open(CURSOR, "w"), indent=2)
        print(f"cursor -> {desde + len(lote)} de {len(urls)}")
    else:
        print("cuota agotada o sin exitos: el cursor NO avanza, se reintenta manana")
    return 0


if __name__ == "__main__":
    sys.exit(main())
