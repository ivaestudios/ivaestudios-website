#!/usr/bin/env python3
"""Control diario de indexacion en Google: que pagina ya entro, cual falta y cual toca mandar.

POR QUE EXISTE
El sitio crece por lotes (500 guias por hotel, 100 por pregunta) y la Indexing
API solo acepta 200 avisos al dia entre ivaestudios.com y bodasmx.com.mx. Sin
un libro que lleve la cuenta, una pagina nueva podia quedarse semanas sin
mandarse y nadie se enteraba. Este control corre solo cada mañana y no deja
ninguna pagina sin dueño.

QUE HACE CADA DIA
1. Lee los sitemaps de los dos sitios. Pagina nueva = entra al libro sola.
2. Le pregunta a Google, pagina por pagina (URL Inspection API), si ya esta
   indexada. Primero las que faltan; las que ya entraron se revisan por turnos
   para detectar si alguna se cae.
3. Las que faltan y no se han mandado hace poco entran a la cola:
     ivaestudios -> seo/google-queue.txt   (salen 140 al dia, 08:20 UTC)
     bodasmx     -> seo/bodasmx-queue.txt  (salen 60 al dia, 09:20 UTC)
4. Escribe el libro (seo/control/indexacion.tsv), la historia por dia
   (seo/control/historia.json) y un informe legible (seo/control/INDEXACION.md).

Solo lee de Google y escribe en seo/: no toca ninguna pagina del sitio.

  python3 scripts/control_indexacion.py            # corrida normal
  python3 scripts/control_indexacion.py --sin-google  # solo sitemaps, colas e informe
"""
import collections
import datetime
import json
import os
import re
import sys
import threading
import time
import urllib.request
import warnings
from concurrent.futures import ThreadPoolExecutor

warnings.filterwarnings("ignore")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBRO = os.path.join(RAIZ, "seo", "control", "indexacion.tsv")
HISTORIA = os.path.join(RAIZ, "seo", "control", "historia.json")
INFORME = os.path.join(RAIZ, "seo", "control", "INDEXACION.md")
CAMPOS = ["url", "estado", "visto", "rastreo", "alta", "cola", "enviada", "envios"]
UA = {"User-Agent": "Mozilla/5.0 (compatible; IVAE-Control/1.0)"}

SITIOS = collections.OrderedDict([
    ("ivaestudios.com", {"cola": "seo/google-queue.txt", "inspecciones": 700, "sale": 140, "primero": r"^$"}),
    # En bodasmx va primero /fotografia/: es el silo donde se recomienda a IVAE.
    ("bodasmx.com.mx", {"cola": "seo/bodasmx-queue.txt", "inspecciones": 500, "sale": 60, "primero": r"/fotografia/"}),
])
ORDEN = {"nueva": 0, "desconocida": 1, "descubierta": 2, "rastreada": 3}
# Dias que se espera antes de volver a mandar una pagina que sigue sin entrar.
# "rastreada" (Google la leyo y no la quiso) no mejora por insistir: 21 dias.
REENVIO = {"nueva": 3, "desconocida": 7, "descubierta": 10, "rastreada": 21}
NOMBRE = collections.OrderedDict([
    ("indexada", "En Google"),
    ("rastreada", "Leidas por Google, todavia sin entrar"),
    ("descubierta", "Descubiertas, todavia sin leer"),
    ("desconocida", "Google aun no las conoce"),
    ("nueva", "Nuevas, sin revisar todavia"),
    ("problema", "Con problema (hay que arreglar)"),
])
PROBLEMA = ("404", "redirige", "noindex", "bloqueada", "duplicada", "error", "otro")


def hoy():
    return datetime.datetime.now(datetime.timezone.utc).date().isoformat()


def dias_desde(fecha):
    if not fecha:
        return 9999
    try:
        return (datetime.date.fromisoformat(hoy()) - datetime.date.fromisoformat(fecha)).days
    except ValueError:
        return 9999


def sitio_de(url):
    m = re.match(r"https?://(?:www\.)?([^/]+)/", url + "/")
    return m.group(1) if m else ""


def estado_de(cobertura, veredicto):
    c = (cobertura or "").lower()
    if veredicto == "PASS" or "indexed" in c and "not indexed" not in c or "enviada e indexada" in c:
        return "indexada"
    if "crawled" in c or "rastreada" in c:
        return "rastreada"
    if "discovered" in c or "descubierta" in c:
        return "descubierta"
    if "unknown" in c or "no reconoce" in c:
        return "desconocida"
    if "404" in c or "not found" in c:
        return "404"
    if "redirect" in c:
        return "redirige"
    if "noindex" in c:
        return "noindex"
    if "robots" in c or "blocked" in c:
        return "bloqueada"
    if "duplicate" in c or "canonical" in c:
        return "duplicada"
    return "otro"


def grupo(estado):
    return "problema" if estado in PROBLEMA else estado


def leer_libro():
    libro = collections.OrderedDict()
    if os.path.exists(LIBRO):
        with open(LIBRO, encoding="utf-8") as f:
            cab = f.readline().rstrip("\n").split("\t")
            for linea in f:
                v = linea.rstrip("\n").split("\t")
                if len(v) < 2:
                    continue
                fila = dict(zip(cab, v + [""] * (len(cab) - len(v))))
                libro[fila["url"]] = fila
    return libro


def guardar_libro(libro):
    os.makedirs(os.path.dirname(LIBRO), exist_ok=True)
    with open(LIBRO, "w", encoding="utf-8") as f:
        f.write("\t".join(CAMPOS) + "\n")
        for url in sorted(libro):
            f.write("\t".join(str(libro[url].get(c, "") or "") for c in CAMPOS) + "\n")


def leer_cola(ruta):
    p = os.path.join(RAIZ, ruta)
    if not os.path.exists(p):
        return []
    return [x.strip() for x in open(p, encoding="utf-8") if x.strip().startswith("http")]


def bajar(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def urls_del_sitemap(dominio):
    def locs(u):
        return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", bajar(u))
    urls = []
    for h in locs("https://%s/sitemap.xml" % dominio):
        if h.endswith(".xml"):
            if "image" in h or "video" in h:
                continue
            urls += locs(h)
        else:
            urls.append(h)
    return sorted(set(u for u in urls
                      if not re.search(r"\.(jpe?g|png|webp|avif|mp4|pdf)$", u) and sitio_de(u) == dominio))


def credenciales():
    from google.oauth2 import service_account
    alcance = ["https://www.googleapis.com/auth/webmasters.readonly"]
    crudo = os.environ.get("GOOGLE_INDEXING_SA_JSON", "").strip()
    if crudo:
        return service_account.Credentials.from_service_account_info(json.loads(crudo), scopes=alcance)
    ruta = os.environ.get("GOOGLE_INDEXING_SA_FILE", "")
    if ruta and os.path.exists(ruta):
        return service_account.Credentials.from_service_account_file(ruta, scopes=alcance)
    return None


def inspeccionar(dominio, urls):
    """Devuelve {url: (estado, rastreo)}; se detiene solo si Google corta por cuota."""
    from googleapiclient.discovery import build
    cred = credenciales()
    if cred is None:
        print("  sin credenciales de Google: no se inspecciona")
        return {}
    local = threading.local()
    alto = threading.Event()
    salida = {}
    candado = threading.Lock()

    def uno(u):
        if alto.is_set():
            return
        if not hasattr(local, "sc"):
            local.sc = build("searchconsole", "v1", credentials=cred, cache_discovery=False)
        for intento in range(3):
            try:
                r = local.sc.urlInspection().index().inspect(body={
                    "inspectionUrl": u, "siteUrl": "sc-domain:" + dominio, "languageCode": "en-US"}).execute()
                ix = r.get("inspectionResult", {}).get("indexStatusResult", {})
                with candado:
                    salida[u] = (estado_de(ix.get("coverageState"), ix.get("verdict")),
                                 (ix.get("lastCrawlTime") or "")[:10])
                return
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                if "429" in msg or "uota" in msg:
                    alto.set()
                    return
                time.sleep(2 * (intento + 1))

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(uno, urls))
    if alto.is_set():
        print("  Google corto por cuota: se revisaron %d de %d, el resto mañana" % (len(salida), len(urls)))
    return salida


def main():
    sin_google = "--sin-google" in sys.argv
    fecha = hoy()
    libro = leer_libro()
    colas = {d: leer_cola(cfg["cola"]) for d, cfg in SITIOS.items()}
    en_cola = set(u for lista in colas.values() for u in lista)
    eventos = collections.defaultdict(list)

    # 1) sitemaps: altas y bajas
    for dominio in SITIOS:
        try:
            urls = urls_del_sitemap(dominio)
        except Exception as e:  # noqa: BLE001
            print("%s: sitemap inalcanzable (%s); hoy no se toca" % (dominio, type(e).__name__))
            continue
        conocidas = [u for u in libro if sitio_de(u) == dominio]
        if conocidas and len(urls) < len(conocidas) * 0.6:
            print("%s: el sitemap trajo %d de %d conocidas; parece incompleto, hoy no se toca"
                  % (dominio, len(urls), len(conocidas)))
            continue
        primera_vez = not conocidas
        for u in urls:
            if u not in libro:
                libro[u] = {"url": u, "estado": "nueva", "visto": "", "rastreo": "",
                            "alta": "" if primera_vez else fecha, "cola": "", "enviada": "", "envios": "0"}
                if not primera_vez:
                    eventos["alta"].append(u)
        fuera = set(conocidas) - set(urls)
        for u in fuera:
            del libro[u]
            eventos["baja"].append(u)
        print("%s: %d paginas en el sitemap (%d nuevas, %d retiradas)"
              % (dominio, len(urls), len([u for u in eventos["alta"] if sitio_de(u) == dominio]), len(fuera)))

    # 2) lo que salio de la cola desde ayer = se mando a Google
    for u, fila in libro.items():
        if fila.get("cola") and u not in en_cola:
            fila["enviada"], fila["cola"] = fecha, ""
            fila["envios"] = str(int(fila.get("envios") or 0) + 1)
            eventos["enviada"].append(u)
        elif u in en_cola and not fila.get("cola"):
            fila["cola"] = fecha

    # 3) preguntarle a Google
    solo = sys.argv[sys.argv.index("--solo") + 1] if "--solo" in sys.argv else None
    if not sin_google:
        for dominio, cfg in SITIOS.items():
            if solo and dominio != solo:
                continue
            filas = [f for u, f in libro.items() if sitio_de(u) == dominio]
            faltan = sorted((f for f in filas if f["estado"] != "indexada"),
                            key=lambda f: (f.get("visto") or "", f["url"]))
            dentro = sorted((f for f in filas if f["estado"] == "indexada"),
                            key=lambda f: (f.get("visto") or "", f["url"]))
            tanda = [f["url"] for f in (faltan + dentro)[:cfg["inspecciones"]]]
            print("%s: se revisan %d (%d que faltan, %d ya dentro)"
                  % (dominio, len(tanda), min(len(faltan), len(tanda)), max(0, len(tanda) - len(faltan))))
            for u, (estado, rastreo) in inspeccionar(dominio, tanda).items():
                fila = libro[u]
                antes = fila["estado"]
                if antes == "indexada" and estado != "indexada":
                    eventos["salio"].append(u)
                if antes != "indexada" and estado == "indexada" and fila.get("visto"):
                    eventos["entro"].append(u)  # solo cuenta si ya se habia revisado antes
                fila.update({"estado": estado, "visto": fecha, "rastreo": rastreo or fila.get("rastreo", "")})

    # 4) rellenar las colas con lo que falta y ya toca
    for dominio, cfg in SITIOS.items():
        cola = colas[dominio]
        cupo = cfg["sale"] * 3 - len(cola)
        candidatas = []
        for u, f in libro.items():
            if sitio_de(u) != dominio or u in en_cola or f["estado"] not in REENVIO:
                continue
            if f["estado"] == "nueva" and not f.get("alta"):
                continue  # del libro inicial y aun sin revisar: primero se le pregunta a Google
            if dias_desde(f.get("enviada")) >= REENVIO[f["estado"]]:
                candidatas.append(f)
        # orden: paginas nuevas, luego las nunca mandadas, luego por estado y antiguedad del envio
        primero = re.compile(cfg["primero"])
        candidatas.sort(key=lambda f: (0 if f.get("alta") and dias_desde(f["alta"]) <= 30 else 1,
                                       f.get("enviada") or "", 0 if primero.search(f["url"]) else 1,
                                       ORDEN[f["estado"]], f["url"]))
        nuevas = [f["url"] for f in candidatas[:max(0, cupo)]]
        if nuevas:
            with open(os.path.join(RAIZ, cfg["cola"]), "a", encoding="utf-8") as fh:
                fh.write("".join(u + "\n" for u in nuevas))
            for u in nuevas:
                libro[u]["cola"] = fecha
            colas[dominio] = cola + nuevas
        print("%s: cola %d (+%d hoy), faltan por encolar %d"
              % (dominio, len(colas[dominio]), len(nuevas), max(0, len(candidatas) - len(nuevas))))

    guardar_libro(libro)

    # 5) historia e informe
    try:
        historia = json.load(open(HISTORIA, encoding="utf-8"))
    except (OSError, ValueError):
        historia = {}
    resumen = {}
    for dominio in SITIOS:
        c = collections.Counter(grupo(f["estado"]) for u, f in libro.items() if sitio_de(u) == dominio)
        c["total"] = sum(c.values())
        resumen[dominio] = dict(c)
        historia.setdefault(dominio, {})[fecha] = dict(c)
        for vieja in sorted(historia[dominio])[:-400]:
            del historia[dominio][vieja]
    json.dump(historia, open(HISTORIA, "w", encoding="utf-8"), indent=1, sort_keys=True)

    L = ["# Control de indexacion en Google", "",
         "Actualizado: %s. Se actualiza solo cada mañana (flujo `control-indexacion.yml`)." % fecha, ""]
    for dominio, cfg in SITIOS.items():
        r = resumen[dominio]
        dias = sorted(historia.get(dominio, {}))
        previo = historia[dominio][dias[-2]] if len(dias) > 1 else {}
        total = r.get("total", 0) or 1
        L += ["## %s" % dominio, "",
              "**%d de %d paginas estan en Google (%.1f%%).**" % (r.get("indexada", 0), r.get("total", 0),
                                                                 100.0 * r.get("indexada", 0) / total), "",
              "| Estado | Paginas | Cambio desde ayer |", "|---|---:|---:|"]
        for clave, nombre in NOMBRE.items():
            n = r.get(clave, 0)
            if not n and clave in ("nueva", "problema"):
                continue
            cambio = n - previo.get(clave, n) if previo else 0
            L.append("| %s | %d | %s |" % (nombre, n, ("%+d" % cambio) if cambio else ""))
        L += ["", "En cola para mandar a Google: %d (salen %d al dia)." % (len(colas[dominio]), cfg["sale"]), ""]
        recientes = [f for u, f in libro.items() if sitio_de(u) == dominio and f.get("alta") and dias_desde(f["alta"]) <= 30]
        if recientes:
            dentro = sum(1 for f in recientes if f["estado"] == "indexada")
            L += ["### Paginas nuevas de los ultimos 30 dias: %d (%d ya en Google)" % (len(recientes), dentro), ""]
            pend = sorted((f for f in recientes if f["estado"] != "indexada"), key=lambda f: (f["alta"], f["url"]))
            if pend:
                L += ["| Pagina | Alta | Estado | Ultimo envio |", "|---|---|---|---|"]
                for f in pend[:80]:
                    L.append("| %s | %s | %s | %s |" % (f["url"].replace("https://" + dominio, ""), f["alta"],
                                                       NOMBRE.get(grupo(f["estado"]), f["estado"]),
                                                       f.get("enviada") or ("en cola" if f.get("cola") else "pendiente")))
                if len(pend) > 80:
                    L.append("| y %d mas | | | |" % (len(pend) - 80))
                L.append("")
        malas = [f for u, f in libro.items() if sitio_de(u) == dominio and f["estado"] in PROBLEMA]
        if malas:
            L += ["### Con problema", ""]
            L += ["- %s (%s)" % (f["url"], f["estado"]) for f in malas[:40]]
            L.append("")
    for clave, titulo in (("salio", "Salieron de Google hoy"), ("entro", "Entraron a Google hoy"),
                          ("alta", "Paginas nuevas detectadas hoy"), ("enviada", "Mandadas a Google desde ayer")):
        if eventos[clave]:
            L += ["## %s: %d" % (titulo, len(eventos[clave])), ""]
            L += ["- " + u for u in eventos[clave][:60]]
            if len(eventos[clave]) > 60:
                L.append("- y %d mas" % (len(eventos[clave]) - 60))
            L.append("")
    texto = "\n".join(L) + "\n"
    open(INFORME, "w", encoding="utf-8").write(texto)
    paso = os.environ.get("GITHUB_STEP_SUMMARY")
    if paso:
        open(paso, "a", encoding="utf-8").write(texto)
    for dominio, r in resumen.items():
        print("%s: %s" % (dominio, json.dumps(r, sort_keys=True)))


if __name__ == "__main__":
    main()
