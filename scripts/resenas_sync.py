#!/usr/bin/env python3
"""Mantiene la cifra de reseñas de Google igual en todo el sitio, sola.

POR QUE EXISTE
La ficha de Google gana una o dos reseñas por semana y el sitio se quedaba
atras. El 11-nov-2026 la ficha decia 73, el texto 67 y el contador del celular
63: ese numero vive en el atributo data-count-to y la animacion pisa el texto,
asi que en el telefono se veia una cifra vieja aunque el HTML dijera otra. Las
IAs repiten esta cifra tal cual, y una cifra vieja termina citada por ChatGPT.

QUE HACE
1. Averigua la cifra real:
     - a mano:   python3 scripts/resenas_sync.py 75
     - Google:   Places API (New), con la cuenta de servicio del sitio
                 (GOOGLE_INDEXING_SA_JSON) o con GOOGLE_PLACES_API_KEY.
   Si Google no esta activado para el proyecto, avisa y termina sin error.
2. La escribe en todos lados: texto, contadores del celular (atributo y
   texto), tabla de la comparativa, api/facts.json, llms.txt y llms-full.txt.
3. Deja registro en seo/resenas.json.

CANDADOS
- No baja mas de 3 ni sube mas de 40 de un jalon: eso es un dato malo.
- Si la calificacion deja de ser 5.0 se detiene y avisa: el sitio dice "5.0"
  en cientos de frases y ese cambio lo decide una persona.
- No toca la cifra de OTRO negocio aunque coincida con la de IVAE.

  python3 scripts/resenas_sync.py              # Google -> sitio
  python3 scripts/resenas_sync.py 75           # a mano
  python3 scripts/resenas_sync.py --revisar    # no escribe; lista lo que no cuadra
  python3 scripts/resenas_sync.py 75 --viejas 63,67   # ademas limpia cifras viejas
"""
import datetime
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTS = os.path.join(RAIZ, "api", "facts.json")
REGISTRO = os.path.join(RAIZ, "seo", "resenas.json")
CONSULTA = "IVAE Studios photographer Cancun"

EXT = re.compile(r"\.(html|txt|json|js|xml)$")
FUERA = re.compile(r"(^|/)(node_modules|vendor)/|^(seo|_docs|_estrategia|scripts|tools|marketing|gallery)/|^\.")

PALABRA = r"(?:reviews|reseñas|resenas|opiniones|rese&ntilde;as)"
CONTEXTO = re.compile(r"IVAE|Vianey|studio|estudio|Google|5\.0|5,0|rating|calificaci", re.I)
PROPIO = re.compile(r"IVAE|Vianey|the studio|our studio|el estudio|nuestro estudio", re.I)
# Otros negocios que el sitio nombra con su cifra: nunca se les cambia.
AJENOS = re.compile(
    r"Cancun Wedding Studio|OLA Photos|Cancun Studios|Daniel Olmedo|Luiz Meurer|"
    r"Coral Dream|Blue Photo|Arakaki|Amor Amor|Enfoque|Mayan Riviera Photography|"
    r"Tam Rico|Roots|Photosmile|Flytographer|Citlalli|Santiago Gabay|PIC Photographer|"
    r"Elvis Aceff|Localgrapher|Yelp|WeddingWire|Tripadvisor")  # con mayusculas: son nombres propios
ETIQUETA = r"(?:Reviews 5★|Reseñas 5★|Five star reviews|Google reviews|Reseñas de Google)"
CONTADOR = re.compile(
    r'(data-count-to=")(\d+)("[^>]*>)(\d+)(\+?</span>\s*<span class="ivm-stat__label">\s*'
    + ETIQUETA + r"\s*</span>)")
TABLA = re.compile(r"(IVAE Studios</td>\s*<td>5\.0\s*(?:·|&middot;|&#183;)\s*)(\d+)(\s*</td>)")
LD = re.compile(r'("(?:reviewCount|ratingCount)"\s*:\s*"?)(\d+)("?)')


def archivos():
    os.chdir(RAIZ)
    return sorted(f for f in glob.glob("**/*", recursive=True)
                  if EXT.search(f) and not FUERA.search(f) and os.path.isfile(f))


def cifra_actual():
    return int(json.load(open(FACTS, encoding="utf-8"))["aggregate_rating"]["review_count"])


def leer_google():
    """Devuelve (cifra, calificacion, place_id) o (None, motivo, None)."""
    cabeceras = {"Content-Type": "application/json",
                 "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount"}
    llave = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
    cuenta = os.environ.get("GOOGLE_INDEXING_SA_JSON", "").strip()
    if llave:
        cabeceras["X-Goog-Api-Key"] = llave
    elif cuenta:
        try:
            from google.oauth2 import service_account
            import google.auth.transport.requests
            cred = service_account.Credentials.from_service_account_info(
                json.loads(cuenta), scopes=["https://www.googleapis.com/auth/cloud-platform"])
            cred.refresh(google.auth.transport.requests.Request())
            cabeceras["Authorization"] = "Bearer " + cred.token
        except Exception as e:  # noqa: BLE001
            return None, "no se pudo abrir la cuenta de servicio: %s" % type(e).__name__, None
    else:
        return None, "no hay credenciales de Google en el entorno", None
    pedido = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps({"textQuery": CONSULTA}).encode(), headers=cabeceras)
    try:
        with urllib.request.urlopen(pedido, timeout=40) as r:
            datos = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        cuerpo = e.read().decode("utf-8", "replace")
        if "SERVICE_DISABLED" in cuerpo or "has not been used" in cuerpo:
            return None, "Places API (New) no esta activada en el proyecto de Google", None
        if "BILLING" in cuerpo.upper():
            return None, "el proyecto de Google no tiene cuenta de facturacion", None
        return None, "Google respondio %s" % e.code, None
    except Exception as e:  # noqa: BLE001
        return None, "sin respuesta de Google: %s" % type(e).__name__, None
    for lugar in datos.get("places", []):
        nombre = (lugar.get("displayName") or {}).get("text", "")
        if nombre.upper().startswith("IVAE STUDIOS") and lugar.get("userRatingCount"):
            return int(lugar["userRatingCount"]), float(lugar.get("rating", 0)), lugar.get("id")
    return None, "Google no devolvio la ficha de IVAE Studios", None


def es_de_otro(texto, inicio):
    """True si, justo antes de la cifra, se habla de otro negocio y no de IVAE."""
    antes = texto[max(0, inicio - 170):inicio]
    ajeno = max((m.end() for m in AJENOS.finditer(antes)), default=-1)
    propio = max((m.end() for m in PROPIO.finditer(antes)), default=-1)
    return ajeno > propio


def aplicar(nueva, viejas, escribir=True):
    nueva_s = str(nueva)
    cuenta = {"texto": 0, "contador": 0, "tabla": 0, "schema": 0}
    cambiados, saltados = [], []
    pats = [re.compile(r"(?<![\d.,$#/-])%s(\s+(?:Google\s+|client\s+)?%s\b)" % (v, PALABRA), re.I)
            for v in sorted(set(viejas)) if str(v) != nueva_s]
    for f in archivos():
        try:
            s = open(f, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        o = s
        for pat in pats:
            def cambia(m, s=s):
                ventana = s[max(0, m.start() - 250):m.end() + 200]
                if not CONTEXTO.search(ventana) or es_de_otro(s, m.start()):
                    saltados.append((f, re.sub(r"\s+", " ", s[max(0, m.start() - 90):m.end() + 40])))
                    return m.group(0)
                cuenta["texto"] += 1
                return nueva_s + m.group(1)
            s = pat.sub(cambia, s)

        def contador(m):
            if m.group(2) != nueva_s or m.group(4) != nueva_s:
                cuenta["contador"] += 1
            return m.group(1) + nueva_s + m.group(3) + nueva_s + m.group(5)
        s = CONTADOR.sub(contador, s)

        def tabla(m):
            if m.group(2) != nueva_s:
                cuenta["tabla"] += 1
            return m.group(1) + nueva_s + m.group(3)
        s = TABLA.sub(tabla, s)

        if f.endswith(".html") and "IVAE" in s:
            def ld(m):
                if m.group(2) != nueva_s:
                    cuenta["schema"] += 1
                return m.group(1) + nueva_s + m.group(3)
            s = LD.sub(ld, s)

        if f == "api/facts.json":
            d = json.loads(o)
            if d["aggregate_rating"].get("review_count") != int(nueva):
                d["aggregate_rating"]["review_count"] = int(nueva)
                if "google_rating" in d.get("proof_points", {}):
                    d["proof_points"]["google_rating"] = "5.0 across %s reviews (see aggregate_rating)" % nueva_s
                d["last_updated"] = datetime.date.today().isoformat()
                s = json.dumps(d, indent=2, ensure_ascii=False) + ("\n" if o.endswith("\n") else "")
            else:
                s = o
        if s != o:
            cambiados.append(f)
            if escribir:
                open(f, "w", encoding="utf-8").write(s)
    return cuenta, cambiados, saltados


def revisar(nueva):
    """Cifras de reseñas de IVAE que no son la vigente. No escribe."""
    nueva_s, raras = str(nueva), []
    pat = re.compile(r"(?<![\d.,$#/-])(\d{2,3})(\s+(?:Google\s+|client\s+)?%s\b)" % PALABRA, re.I)
    for f in archivos():
        try:
            s = open(f, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for m in CONTADOR.finditer(s):
            if m.group(2) != nueva_s or m.group(4) != nueva_s:
                raras.append((f, "contador %s/%s" % (m.group(2), m.group(4))))
        for m in TABLA.finditer(s):
            if m.group(2) != nueva_s:
                raras.append((f, "tabla %s" % m.group(2)))
        if "/blog/" in "/" + f:
            continue  # el blog habla de reseñas de otros negocios
        for m in pat.finditer(s):
            if m.group(1) == nueva_s:
                continue
            cerca = s[max(0, m.start() - 120):m.end() + 60]
            if re.search(r"IVAE|Vianey", cerca) and re.search(r"5\.0|5,0", cerca) and not es_de_otro(s, m.start()):
                raras.append((f, re.sub(r"\s+", " ", s[max(0, m.start() - 60):m.end() + 20])))
    return raras


def guardar_registro(nueva, calificacion, fuente, place_id):
    try:
        reg = json.load(open(REGISTRO, encoding="utf-8"))
    except (OSError, ValueError):
        reg = {"historial": []}
    hoy = datetime.date.today().isoformat()
    if reg.get("cifra") != nueva:
        reg.setdefault("historial", []).append({"fecha": hoy, "cifra": nueva, "fuente": fuente})
        reg["historial"] = reg["historial"][-60:]
    reg.update({"cifra": nueva, "calificacion": calificacion, "revisado": hoy, "fuente": fuente})
    if place_id:
        reg["place_id"] = place_id
    os.makedirs(os.path.dirname(REGISTRO), exist_ok=True)
    json.dump(reg, open(REGISTRO, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    open(REGISTRO, "a", encoding="utf-8").write("\n")


def main():
    args = [a for a in sys.argv[1:] if a.strip()]
    solo_revisar = "--revisar" in args
    viejas_extra = []
    if "--viejas" in args:
        viejas_extra = [int(x) for x in args[args.index("--viejas") + 1].split(",") if x.strip().isdigit()]
    manual = next((a for a in args if a.isdigit()), os.environ.get("RESENAS_MANUAL", "").strip())
    actual = cifra_actual()

    if solo_revisar:
        raras = revisar(actual)
        print("Cifra vigente: %d. Cifras que no cuadran: %d" % (actual, len(raras)))
        for f, t in raras[:60]:
            print("  %s | %s" % (f, t))
        sys.exit(1 if raras else 0)

    calificacion, place_id = 5.0, None
    if manual and str(manual).isdigit():
        nueva, fuente = int(manual), "a mano"
    else:
        nueva, dato, place_id = leer_google()
        if nueva is None:
            print("::notice::Reseñas: no se pudo leer la ficha (%s). El sitio sigue en %d." % (dato, actual))
            sys.exit(0)
        calificacion, fuente = dato, "Google Places"
        if round(calificacion, 1) != 5.0:
            print("::error::La ficha de Google ya no marca 5.0 (marca %.1f con %d reseñas). "
                  "No se cambio nada: el sitio dice 5.0 en cientos de frases y eso lo decide una persona."
                  % (calificacion, nueva))
            sys.exit(1)

    if nueva < actual - 3 or nueva > actual + 40:
        print("::error::Cifra sospechosa: el sitio dice %d y la lectura dio %d. No se cambio nada." % (actual, nueva))
        sys.exit(1)

    simular = "--simular" in args
    cuenta, cambiados, saltados = aplicar(nueva, [actual] + viejas_extra, escribir=not simular)
    if simular:
        print("SIMULACION, no se escribio nada. Archivos que cambiarian: %s" % ", ".join(cambiados[:40]))
    else:
        guardar_registro(nueva, calificacion, fuente, place_id)
    print("Reseñas: %d -> %d (%s). texto:%d contadores:%d tabla:%d schema:%d | archivos:%d | saltados:%d"
          % (actual, nueva, fuente, cuenta["texto"], cuenta["contador"], cuenta["tabla"],
             cuenta["schema"], len(cambiados), len(saltados)))
    for f, t in saltados[:15]:
        print("  SALTADO %s | %s" % (f, t[:170]))
    raras = revisar(nueva)
    if raras:
        print("Quedan %d cifras que no cuadran (revisar a mano):" % len(raras))
        for f, t in raras[:30]:
            print("  %s | %s" % (f, t))
    lista = os.environ.get("RESENAS_LISTA")
    if lista:
        open(lista, "w").write("\n".join(cambiados + ["seo/resenas.json"]) + "\n")


if __name__ == "__main__":
    main()
