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

CIFRAS ESCRITAS CON LETRA
El 11-nov-2026 Claude leyo la pagina de familias y encontro "Sixty-Six Reviews"
junto a "73 Google reviews": la portada decia "Forty-Seven Reviews" y Brave
repetia 47. Eran cifras escritas con letra, que el robot no veia. Desde ese dia
tambien las cambia ("Seventy-Three Reviews", "Setenta y Tres Reseñas"),
respetando mayusculas y el separador que use cada pagina.

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
# functions/ es codigo: sus comentarios cuentan la historia con cifras viejas a proposito.
FUERA = re.compile(r"(^|/)(node_modules|vendor)/|^(seo|_docs|_estrategia|scripts|tools|marketing|gallery|functions)/|^\.")

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

# ── Cifras escritas con letra ────────────────────────────────────────────────
EN_U = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
EN_10 = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
         "seventeen", "eighteen", "nineteen"]
EN_D = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
ES_U = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
ES_10 = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
         "diecisiete", "dieciocho", "diecinueve"]
ES_20 = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
         "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
ES_D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]

EN_VALOR = {"one hundred": 100}
EN_VALOR.update({w: i for i, w in enumerate(EN_U) if w})
EN_VALOR.update({w: 10 + i for i, w in enumerate(EN_10)})
EN_VALOR.update({w: 10 * i for i, w in enumerate(EN_D) if w})
ES_VALOR = {"cien": 100, "ciento": 100, "una": 1, "un": 1, "veintiuna": 21, "veintiún": 21}
ES_VALOR.update({w: i for i, w in enumerate(ES_U) if w})
ES_VALOR.update({w: 10 + i for i, w in enumerate(ES_10)})
ES_VALOR.update({w: 20 + i for i, w in enumerate(ES_20)})
ES_VALOR.update({w: 10 * i for i, w in enumerate(ES_D) if w})

SEP_EN = r"(?:-|&#8209;|‑|\s/\s|\s+and\s+|\s+)"
UNA_EN = "(?:" + "|".join(sorted(EN_VALOR, key=len, reverse=True)).replace(" ", r"\s+") + ")"
UNA_ES = "(?:" + "|".join(sorted(ES_VALOR, key=len, reverse=True)) + ")"
LETRA_EN = UNA_EN + "(?:" + SEP_EN + UNA_EN + ")*"
LETRA_ES = UNA_ES + r"(?:(?:\s+y\s+|\s+)" + UNA_ES + ")*"
# Buscar la cifra con una expresion regular sobre todo el sitio tarda minutos.
# Se busca la palabra "reviews" o "reseñas" (rapido) y se mira lo que hay justo antes.
MARCAS_EN = ("reviews", "Reviews", "REVIEWS")
MARCAS_ES = ("reseñas", "Reseñas", "RESEÑAS", "rese&ntilde;as", "Rese&ntilde;as")
ANTES_EN = re.compile(r"(?P<pal>" + LETRA_EN + r")\s+(?:written\s+|Google\s+|client\s+)?$", re.I)
ANTES_ES = re.compile(r"(?P<pal>" + LETRA_ES + r")\s+$", re.I)
# El numero grande de la tira de cifras: la palabra va sola en un span y
# "Reviews" en el siguiente.
TIRA = re.compile(r'(lf-stat-num--word"[^>]*>)\s*(?P<pal>[^<]+?)\s*(</span>\s*<span class="lf-stat-label">\s*'
                  r"(?P<idioma>Reviews|Reseñas|Rese&ntilde;as)\s*</span>)")
# La misma cifra, repetida en la etiqueta para lectores de pantalla de esa tira.
TIRA_ARIA = re.compile(r'(<div class="lf-stat" aria-label=")(?P<pal>[^"<>]+?)(\s+(?:reviews|reseñas|rese&ntilde;as)"\s*>\s*'
                       r'<span class="lf-stat-num lf-stat-num--word")', re.I)
DECENA_UNIDAD = re.compile(r"(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(" + SEP_EN
                           + r")(?:one|two|three|four|five|six|seven|eight|nine)\b", re.I)


def numero_de(palabras, ingles):
    """'Forty&#8209;Seven' -> 47; 'ciento veintiuna' -> 121. None si no es una cifra."""
    t = re.sub(r"\s+", " ", palabras.strip().lower())
    if ingles:
        t = t.replace("one hundred", "one_hundred")
        fichas = [x.replace("_", " ") for x in re.split(r"-|&#8209;|‑|/| and | ", t) if x.strip()]
        valores = [EN_VALOR.get(x.strip()) for x in fichas]
    else:
        fichas = [x for x in re.split(r" y | ", t) if x.strip()]
        valores = [ES_VALOR.get(x.strip()) for x in fichas]
    if not valores or any(v is None for v in valores):
        return None
    # Solo vale "ciento + decena + unidad" en ese orden: "one seventy" no es una cifra.
    clases = [3 if v == 100 else 2 if (v >= 20 and v % 10 == 0) else 1 for v in valores]
    if any(a <= b for a, b in zip(clases, clases[1:])):
        return None
    return sum(valores)


def cifras_con_letra(s, ingles):
    """Cifras con letra que van justo antes de 'reviews' o 'reseñas': [(inicio, fin, palabras)]."""
    marcas, antes = (MARCAS_EN, ANTES_EN) if ingles else (MARCAS_ES, ANTES_ES)
    hallados = {}
    for marca in marcas:
        i = s.find(marca)
        while i != -1:
            fin = i + len(marca)
            if fin >= len(s) or not s[fin].isalpha():
                base = max(0, i - 100)
                previo = s[base:i]
                for p in range(len(previo)):
                    if not previo[p].isalpha() or (p and previo[p - 1].isalpha()):
                        continue
                    m = antes.match(previo, p)
                    if m and numero_de(m.group("pal"), ingles) is not None:
                        hallados[base + p] = (base + p, base + m.end("pal"), m.group("pal"))
                        break
            i = s.find(marca, i + 1)
    return [hallados[k] for k in sorted(hallados)]


def letra_en(n, sep="-"):
    """73 -> 'seventy-three'; 80 -> 'eighty'; 104 -> 'one hundred four'."""
    if n >= 100:
        resto = n % 100
        return EN_U[n // 100] + " hundred" + (" " + letra_en(resto, sep) if resto else "")
    if n < 10:
        return EN_U[n]
    if n < 20:
        return EN_10[n - 10]
    return EN_D[n // 10] + (sep + EN_U[n % 10] if n % 10 else "")


def letra_es(n):
    """73 -> 'setenta y tres'; 81 -> 'ochenta y una' (va antes de 'reseñas')."""
    if n == 100:
        return "cien"
    if n > 100:
        return "ciento " + letra_es(n - 100)
    if n < 10:
        return "una" if n == 1 else ES_U[n]
    if n < 20:
        return ES_10[n - 10]
    if n < 30:
        return "veintiuna" if n == 21 else ES_20[n - 20]
    unidad = "una" if n % 10 == 1 else ES_U[n % 10]
    return ES_D[n // 10] + (" y " + unidad if n % 10 else "")


def con_estilo(original, texto):
    """Escribe la cifra nueva con las mayusculas de la vieja."""
    fichas = [t for t in re.split(r"-|&#8209;|‑|/|\s+", original) if t and t.lower() not in ("y", "and")]
    if fichas and all(t[0].isupper() for t in fichas):
        return re.sub(r"[A-Za-zÁÉÍÓÚáéíóúñ]+",
                      lambda w: w.group(0) if w.group(0) in ("y", "and") else w.group(0).capitalize(), texto)
    if fichas and fichas[0][0].isupper():
        return texto[:1].upper() + texto[1:]
    return texto


def letra_nueva(palabras, nueva, ingles):
    """La cifra nueva escrita como estaba la vieja: mismas mayusculas y mismo separador."""
    if ingles:
        m = DECENA_UNIDAD.search(palabras)
        return con_estilo(palabras, letra_en(nueva, m.group(1) if m else "-"))
    return con_estilo(palabras, letra_es(nueva))

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
    cuenta = {"texto": 0, "letra": 0, "contador": 0, "tabla": 0, "schema": 0}
    cambiados, saltados = [], []
    viejas_n = {int(v) for v in viejas}
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

        def tira(m):
            ingles = m.group("idioma") == "Reviews"
            n = numero_de(m.group("pal"), ingles)
            if n is None or n == int(nueva):
                return m.group(0)
            cuenta["letra"] += 1
            return m.group(1) + letra_nueva(m.group("pal").strip(), int(nueva), ingles) + m.group(3)
        s = TIRA.sub(tira, s)

        def tira_aria(m):
            ingles = "review" in m.group(3).lower()
            n = numero_de(m.group("pal"), ingles)
            if n is None or n == int(nueva):
                return m.group(0)
            cuenta["letra"] += 1
            return m.group(1) + letra_nueva(m.group("pal").strip(), int(nueva), ingles) + m.group(3)
        s = TIRA_ARIA.sub(tira_aria, s)

        # Cifras con letra: "Sixty-Six Reviews", "Sesenta y seis reseñas".
        for ingles in (True, False):
            for ini, fin, pal in reversed(cifras_con_letra(s, ingles)):
                n = numero_de(pal, ingles)
                if n == int(nueva) or n not in viejas_n:
                    continue
                ventana = s[max(0, ini - 250):fin + 200]
                if not CONTEXTO.search(ventana) or es_de_otro(s, ini):
                    saltados.append((f, re.sub(r"\s+", " ", s[max(0, ini - 90):fin + 40])))
                    continue
                cuenta["letra"] += 1
                s = s[:ini] + letra_nueva(pal, int(nueva), ingles) + s[fin:]

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
        for m in TIRA.finditer(s):
            n = numero_de(m.group("pal"), m.group("idioma") == "Reviews")
            if n is not None and n != int(nueva):
                raras.append((f, "tira de cifras: %s" % m.group("pal").strip()))
        for m in TIRA_ARIA.finditer(s):
            n = numero_de(m.group("pal"), "review" in m.group(3).lower())
            if n is not None and n != int(nueva):
                raras.append((f, "etiqueta de la tira: %s" % m.group("pal").strip()))
        for ingles in (True, False):
            for ini, fin, pal in cifras_con_letra(s, ingles):
                n = numero_de(pal, ingles)
                if n == int(nueva) or n < 20:
                    continue
                cerca = s[max(0, ini - 250):fin + 200]
                if (re.search(r"IVAE|Vianey|5\.0|5,0|&starf;|rating|calificaci", cerca)
                        and not es_de_otro(s, ini)):
                    raras.append((f, "con letra: " + re.sub(r"\s+", " ", s[max(0, ini - 40):fin + 30])))
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
    print("Reseñas: %d -> %d (%s). texto:%d con letra:%d contadores:%d tabla:%d schema:%d | archivos:%d | saltados:%d"
          % (actual, nueva, fuente, cuenta["texto"], cuenta["letra"], cuenta["contador"], cuenta["tabla"],
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
