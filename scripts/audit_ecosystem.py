#!/usr/bin/env python3
"""
audit_ecosystem.py - Verificador de INVARIANTES del ecosistema de URLs de ivaestudios.com

Comprueba, SIN RED y solo con biblioteca estandar, las ocho reglas que mantienen
sano el mapa de URLs del sitio (Cloudflare Pages):

  1. PRESUPUESTO        _redirects no pasa de PRESUPUESTO_REGLAS reglas honradas.
  2. REGLAS MUERTAS     ninguna regla tiene un ORIGEN que exista como archivo.
  3. DESTINO REAL       el destino de cada regla resuelve a algo.
  4. SIN CADENAS/BUCLES ningun destino es a su vez origen de otra regla.
  5. SITEMAP FIEL       cada URL del sitemap resuelve (archivo o regla honrada).
  6. CANONICA UNICA     canonicas de posts unicas y coincidentes con su ruta.
  7. SIN URL PISADA     ningun post vivo tiene su URL como origen de un redirect.
  8. SIN HUERFANOS      todo post recibe al menos un enlace interno entrante.
  9. ENLACES VIVOS      (extra) todo href interno resuelve con las reglas honradas.

Uso (desde la raiz del repo):
    python3 scripts/audit_ecosystem.py
    python3 scripts/audit_ecosystem.py --fail-on-error   # codigo 1 si hay ALTA
    python3 scripts/audit_ecosystem.py --raiz /otra/ruta
    python3 scripts/audit_ecosystem.py --ejemplos 25
"""

import argparse
import os
import re
import sys
import time

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────────────────────────────────────

# Cloudflare Pages solo aplica las PRIMERAS ~100 reglas de _redirects.
# Medido en produccion el 2026-08-07: la regla #107 respondia 301 y la #108
# respondia 404. El limite documentado por Cloudflare es 100, asi que ese es el
# numero seguro. Todo lo que quede por debajo del corte simplemente NO EXISTE.
PRESUPUESTO_REGLAS = 100

DOMINIO = "https://ivaestudios.com"

# Carpetas que nunca forman parte del sitio publico auditado aqui.
# Ojo: NO se excluyen images/, styles/, js/, venues/ ni comparison/, porque sus
# archivos si se sirven y pueden ser destino de una regla o de un enlace.
DIRS_EXCLUIDOS = {
    "marketing",       # app aparte, prohibido tocar
    "gallery",         # app aparte, prohibido tocar
    "node_modules",
    "_backups",        # copias viejas: crearian archivos y enlaces fantasma
    "functions",       # Cloudflare Functions (.js), no son paginas estaticas
}

# Los borradores de diseno (*-preview*.html) no son paginas publicas.
RE_PREVIEW = re.compile(r"-preview.*\.html$", re.IGNORECASE)

RE_HREF = re.compile(r"""href\s*=\s*["']([^"'>]+)["']""", re.IGNORECASE)
RE_CANONICAL = re.compile(
    r"""<link[^>]+rel\s*=\s*["']canonical["'][^>]*>""", re.IGNORECASE
)
RE_HREF_ATTR = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
RE_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.IGNORECASE)

MAX_SALTOS = 12  # tope de seguridad al seguir cadenas de 301

GRAVE_ALTA = "ALTA"
GRAVE_MEDIA = "MEDIA"


def plural(n, singular, plural_):
    """Redacta '1 regla' / '3 reglas' sin frases raras en el informe."""
    return "%d %s" % (n, singular if n == 1 else plural_)


# ─────────────────────────────────────────────────────────────────────────────
# CARGA DEL REPO
# ─────────────────────────────────────────────────────────────────────────────

class Regla:
    """Una linea util de _redirects."""

    __slots__ = ("indice", "linea", "origen", "destino", "codigo", "honrada")

    def __init__(self, indice, linea, origen, destino, codigo):
        self.indice = indice      # posicion entre las reglas NO comentadas (1-based)
        self.linea = linea        # numero de linea real dentro del archivo
        self.origen = origen
        self.destino = destino
        self.codigo = codigo      # 301, 302, 200...
        self.honrada = indice <= PRESUPUESTO_REGLAS

    def __repr__(self):
        return "#%d %s -> %s %d" % (self.indice, self.origen, self.destino, self.codigo)


def cargar_reglas(raiz):
    """Lee _redirects y devuelve la lista de reglas en orden de archivo."""
    ruta = os.path.join(raiz, "_redirects")
    reglas = []
    if not os.path.exists(ruta):
        return reglas
    with open(ruta, encoding="utf-8") as f:
        for n_linea, cruda in enumerate(f, start=1):
            linea = cruda.strip()
            if not linea or linea.startswith("#"):
                continue
            partes = linea.split()
            if len(partes) < 2:
                continue
            origen = partes[0]
            destino = partes[1]
            codigo = 301
            if len(partes) >= 3:
                try:
                    codigo = int(partes[2])
                except ValueError:
                    codigo = 301
            reglas.append(Regla(len(reglas) + 1, n_linea, origen, destino, codigo))
    return reglas


def _dir_excluido(nombre):
    """Decide si se poda una carpeta al recorrer el arbol."""
    # Las ocultas (.git, .github, .wrangler, .claude...) nunca se publican.
    return nombre.startswith(".") or nombre in DIRS_EXCLUIDOS


def recorrer_archivos(raiz):
    """Devuelve (todos_los_archivos_rel, htmls_publicos_rel).

    todos_los_archivos_rel: rutas relativas de TODO archivo servible (para poder
    resolver /_redirects, /sitemap.xml, imagenes sueltas, etc.).
    htmls_publicos_rel: solo los .html que cuentan como paginas del sitio.
    """
    todos = set()
    htmls = []
    for dirpath, dirnames, filenames in os.walk(raiz):
        dirnames[:] = [d for d in dirnames if not _dir_excluido(d)]
        for fn in filenames:
            if fn.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), raiz).replace(os.sep, "/")
            todos.add(rel)
            if fn.lower().endswith(".html") and not RE_PREVIEW.search(fn):
                htmls.append(rel)
    return todos, sorted(htmls)


# ─────────────────────────────────────────────────────────────────────────────
# RESOLUCION AL ESTILO CLOUDFLARE PAGES
# ─────────────────────────────────────────────────────────────────────────────

def normalizar(ruta):
    """Deja una ruta comparable: sin dominio, sin query/fragmento, sin '/' final."""
    if not ruta:
        return ""
    ruta = ruta.strip()
    if ruta.startswith(DOMINIO):
        ruta = ruta[len(DOMINIO):] or "/"
    ruta = ruta.split("#", 1)[0].split("?", 1)[0]
    if not ruta:
        return ""
    if not ruta.startswith("/"):
        return ruta  # relativa o externa: el llamador decide
    if len(ruta) > 1 and ruta.endswith("/"):
        ruta = ruta.rstrip("/")
        if not ruta:
            ruta = "/"
    return ruta


class Sitio:
    """Modelo del sitio: archivos en disco + reglas de _redirects."""

    def __init__(self, raiz):
        self.raiz = raiz
        self.archivos, self.htmls = recorrer_archivos(raiz)
        self.reglas = cargar_reglas(raiz)
        self.reglas_honradas = [r for r in self.reglas if r.honrada]
        self.origenes = {normalizar(r.origen) for r in self.reglas}

    # -- archivos --------------------------------------------------------

    def archivo_para(self, ruta):
        """Archivo que Cloudflare Pages serviria para 'ruta', o None.

        Orden real de Pages: coincidencia exacta, luego <ruta>.html, luego
        <ruta>/index.html. El archivo SIEMPRE le gana a la regla de _redirects.
        """
        ruta = normalizar(ruta)
        if not ruta.startswith("/"):
            return None
        rel = ruta.lstrip("/")
        if rel == "":
            return "index.html" if "index.html" in self.archivos else None
        for candidato in (rel, rel + ".html", rel + "/index.html"):
            if candidato in self.archivos:
                return candidato
        return None

    def url_publica(self, rel):
        """URL limpia con la que se sirve un archivo del repo."""
        if rel == "index.html":
            return "/"
        if rel.endswith("/index.html"):
            return "/" + rel[: -len("/index.html")]
        if rel.endswith(".html"):
            return "/" + rel[: -len(".html")]
        return "/" + rel

    # -- reglas ----------------------------------------------------------

    @staticmethod
    def _coincide(origen, ruta):
        """Devuelve el :splat si la regla aplica, o None si no aplica."""
        origen = normalizar(origen)
        if origen.endswith("*"):
            prefijo = origen[:-1]
            if ruta.startswith(prefijo):
                return ruta[len(prefijo):]
            return None
        return "" if origen == ruta else None

    def primera_regla(self, ruta, solo_honradas=True):
        """Primera regla del archivo que casa con 'ruta' (orden = prioridad)."""
        pool = self.reglas_honradas if solo_honradas else self.reglas
        for r in pool:
            splat = self._coincide(r.origen, ruta)
            if splat is not None:
                return r, splat
        return None, None

    def resolver(self, ruta, solo_honradas=True):
        """Simula la resolucion de Cloudflare Pages.

        Devuelve un dict con:
          estado: 'archivo' | 'reescritura' | '404' | 'bucle' | 'saltos'
          destino: ruta final
          archivo: archivo servido (o None)
          saltos: numero de 301 seguidos
          cadena: lista de rutas recorridas
        """
        actual = normalizar(ruta)
        cadena = [actual]
        saltos = 0
        while saltos <= MAX_SALTOS:
            arch = self.archivo_para(actual)
            if arch is not None:
                return {"estado": "archivo", "destino": actual, "archivo": arch,
                        "saltos": saltos, "cadena": cadena}
            regla, splat = self.primera_regla(actual, solo_honradas=solo_honradas)
            if regla is None:
                return {"estado": "404", "destino": actual, "archivo": None,
                        "saltos": saltos, "cadena": cadena}
            destino = normalizar(regla.destino.replace(":splat", splat or ""))
            if regla.codigo == 200:
                # Un 200 es REESCRITURA: Pages sirve el archivo destino sin
                # volver a pasar por _redirects. Si no hay archivo, es un 404.
                arch = self.archivo_para(destino)
                cadena.append(destino)
                if arch is not None:
                    return {"estado": "reescritura", "destino": destino,
                            "archivo": arch, "saltos": saltos, "cadena": cadena}
                return {"estado": "404", "destino": destino, "archivo": None,
                        "saltos": saltos, "cadena": cadena}
            if destino in cadena:
                cadena.append(destino)
                return {"estado": "bucle", "destino": destino, "archivo": None,
                        "saltos": saltos, "cadena": cadena}
            cadena.append(destino)
            actual = destino
            saltos += 1
        return {"estado": "saltos", "destino": actual, "archivo": None,
                "saltos": saltos, "cadena": cadena}


# ─────────────────────────────────────────────────────────────────────────────
# LECTURA DE PAGINAS
# ─────────────────────────────────────────────────────────────────────────────

class Pagina:
    __slots__ = ("rel", "url", "canonical", "enlaces")

    def __init__(self, rel, url, canonical, enlaces):
        self.rel = rel
        self.url = url
        self.canonical = canonical
        self.enlaces = enlaces


def leer_paginas(sitio):
    """Lee cada HTML publico una sola vez: canonical + enlaces internos."""
    paginas = []
    for rel in sitio.htmls:
        try:
            with open(os.path.join(sitio.raiz, rel), encoding="utf-8", errors="replace") as f:
                texto = f.read()
        except OSError:
            continue

        canonical = None
        m = RE_CANONICAL.search(texto)
        if m:
            h = RE_HREF_ATTR.search(m.group(0))
            if h:
                canonical = h.group(1).strip()

        enlaces = set()
        for href in RE_HREF.findall(texto):
            destino = _href_interno(href, rel)
            if destino:
                enlaces.add(destino)

        paginas.append(Pagina(rel, sitio.url_publica(rel), canonical, enlaces))
    return paginas


def _href_interno(href, rel_origen):
    """Convierte un href en ruta absoluta del sitio, o None si no es interno."""
    href = href.strip()
    if not href:
        return None
    bajo = href.lower()
    if bajo.startswith(("mailto:", "tel:", "javascript:", "data:", "#", "whatsapp:", "sms:")):
        return None
    if bajo.startswith("//"):
        return None
    if bajo.startswith("http://") or bajo.startswith("https://"):
        if not href.startswith(DOMINIO):
            return None
        href = href[len(DOMINIO):] or "/"
    if not href.startswith("/"):
        # Enlace relativo: se resuelve contra la carpeta del archivo de origen.
        base = os.path.dirname(rel_origen)
        href = "/" + os.path.normpath(os.path.join(base, href)).replace(os.sep, "/")
        if href.startswith("/.."):
            return None
    return normalizar(href)


def es_post(rel):
    return rel.startswith("blog/") or rel.startswith("es/blog/")


# ─────────────────────────────────────────────────────────────────────────────
# INFORME
# ─────────────────────────────────────────────────────────────────────────────

class Informe:
    def __init__(self, max_ejemplos):
        self.max_ejemplos = max_ejemplos
        self.bloques = []
        self.altas = 0

    def bloque(self, clave, titulo):
        b = {"clave": clave, "titulo": titulo, "fallos": []}
        self.bloques.append(b)
        return b

    def fallo(self, bloque, gravedad, resumen, ejemplos, nota=None):
        bloque["fallos"].append({
            "gravedad": gravedad,
            "resumen": resumen,
            "ejemplos": list(ejemplos),
            "nota": nota,
        })
        if gravedad == GRAVE_ALTA:
            self.altas += 1

    def imprimir(self, segundos):
        ancho = 78
        print("=" * ancho)
        print("AUDITORIA DEL ECOSISTEMA DE URLs - ivaestudios.com")
        print("=" * ancho)
        total_fallos = sum(len(b["fallos"]) for b in self.bloques)
        for b in self.bloques:
            estado = "OK" if not b["fallos"] else "FALLA"
            print()
            print("[%s] %s. %s" % (estado, b["clave"], b["titulo"]))
            print("-" * ancho)
            if not b["fallos"]:
                print("  Sin violaciones.")
                continue
            for f in b["fallos"]:
                print("  (%s) %s" % (f["gravedad"], f["resumen"]))
                if f["nota"]:
                    for linea in f["nota"].splitlines():
                        print("      %s" % linea)
                mostrados = f["ejemplos"][: self.max_ejemplos]
                for ej in mostrados:
                    print("      - %s" % ej)
                restantes = len(f["ejemplos"]) - len(mostrados)
                if restantes > 0:
                    print("      ... y %d mas" % restantes)
                print()
        print()
        print("=" * ancho)
        print("RESUMEN: %d invariantes revisadas, %d con violaciones, %d de gravedad ALTA."
              % (len(self.bloques), sum(1 for b in self.bloques if b["fallos"]), self.altas))
        print("Tiempo: %.2f s" % segundos)
        print("=" * ancho)
        return total_fallos


# ─────────────────────────────────────────────────────────────────────────────
# INVARIANTES
# ─────────────────────────────────────────────────────────────────────────────

def inv1_presupuesto(sitio, inf):
    total = len(sitio.reglas)
    b = inf.bloque("1", "PRESUPUESTO de reglas de _redirects  [%d/%d]"
                   % (total, PRESUPUESTO_REGLAS))
    if total <= PRESUPUESTO_REGLAS:
        return
    fuera = [r for r in sitio.reglas if not r.honrada]
    nota = (
        "_redirects tiene %d reglas utiles (sin comentarios ni lineas vacias); se pasa por %d.\n"
        % (total, total - PRESUPUESTO_REGLAS)
        + "Cloudflare Pages solo honra las primeras ~%d reglas del archivo\n" % PRESUPUESTO_REGLAS
        + "(medido en produccion 2026-08-07: la regla #107 respondia 301 y la #108\n"
          "respondia 404). Las %d reglas listadas abajo estan MUERTAS: sus origenes\n"
          "devuelven 404 aunque la linea siga escrita en el archivo." % len(fuera)
    )
    ejemplos = ["#%d (linea %d)  %s -> %s %d" % (r.indice, r.linea, r.origen, r.destino, r.codigo)
                for r in fuera]
    inf.fallo(b, GRAVE_ALTA,
              plural(len(fuera), "regla queda fuera del corte y no existe en produccion.",
                     "reglas quedan fuera del corte y no existen en produccion."),
              ejemplos, nota=nota)


def inv2_reglas_muertas(sitio, inf):
    b = inf.bloque("2", "REGLAS MUERTAS (el ORIGEN existe como archivo)")
    malas = []
    for r in sitio.reglas:
        if "*" in r.origen:
            continue  # un comodin no puede compararse contra un archivo concreto
        arch = sitio.archivo_para(r.origen)
        if arch is not None:
            malas.append("#%d (linea %d)  %s -> %s   [Pages sirve el archivo %s]"
                         % (r.indice, r.linea, r.origen, r.destino, arch))
    if malas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(malas), "regla nunca se aplica porque su origen existe en disco.",
                         "reglas nunca se aplican porque su origen existe en disco."),
                  malas,
                  nota="El archivo le gana a la regla, asi que la redireccion NUNCA ocurre:\n"
                       "la URL vieja sigue sirviendo contenido en lugar de mandar a la nueva.\n"
                       "Ademas cada una gasta cupo del presupuesto de 100 sin hacer nada, y\n"
                       "empuja fuera del corte a una regla que si hace falta. Se arregla\n"
                       "borrando la linea o borrando el archivo, segun cual sea la intencion.")


def inv3_destino_real(sitio, inf):
    b = inf.bloque("3", "DESTINO REAL (ninguna regla apunta a la nada)")
    rotas = []
    for r in sitio.reglas:
        destino = r.destino.replace(":splat", "")
        destino = normalizar(destino)
        if not destino.startswith("/"):
            continue  # destino externo (http://otro-dominio): fuera de alcance
        # Se resuelve con TODAS las reglas: aqui interesa si el destino existe
        # conceptualmente; el corte de las 100 lo audita la invariante 1.
        res = sitio.resolver(destino, solo_honradas=False)
        if res["estado"] in ("404", "bucle", "saltos"):
            rotas.append("#%d (linea %d)  %s -> %s   [%s]"
                         % (r.indice, r.linea, r.origen, r.destino, res["estado"]))
    if rotas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(rotas), "regla redirige a una URL que no resuelve.",
                         "reglas redirigen a una URL que no resuelve."),
                  rotas)


def inv4_cadenas_y_bucles(sitio, inf):
    b = inf.bloque("4", "SIN CADENAS NI BUCLES (ningun destino es origen de otra regla)")
    cadenas_301 = []
    cadenas_200 = []
    bucles = []

    for r in sitio.reglas:
        if r.codigo == 200:
            continue  # una reescritura no genera una segunda peticion del navegador
        destino = normalizar(r.destino.replace(":splat", ""))
        if not destino.startswith("/"):
            continue
        # Si el destino existe como archivo, Pages lo sirve y la segunda regla
        # jamas corre: no hay cadena. Solo hay cadena si el destino cae en regla.
        if sitio.archivo_para(destino) is not None:
            continue
        siguiente, _ = sitio.primera_regla(destino, solo_honradas=False)
        if siguiente is None or siguiente is r:
            continue
        texto = ("#%d %s -> %s (%d)  y luego  #%d %s -> %s (%d)"
                 % (r.indice, r.origen, r.destino, r.codigo,
                    siguiente.indice, siguiente.origen, siguiente.destino, siguiente.codigo))
        res = sitio.resolver(r.origen, solo_honradas=False)
        if res["estado"] == "bucle":
            bucles.append("#%d %s  ->  %s" % (r.indice, r.origen, " -> ".join(res["cadena"])))
        elif siguiente.codigo == 200:
            cadenas_200.append(texto)
        else:
            cadenas_301.append(texto)

    if bucles:
        inf.fallo(b, GRAVE_ALTA, plural(len(bucles), "bucle de redireccion.", "bucles de redireccion."), bucles)
    if cadenas_301:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(cadenas_301), "cadena 3xx -> 3xx (dos saltos para el navegador).",
                         "cadenas 3xx -> 3xx (dos saltos para el navegador)."),
                  cadenas_301,
                  nota="Cada salto extra pierde autoridad y ralentiza. Apunta directo al final.")
    if cadenas_200:
        inf.fallo(b, GRAVE_MEDIA,
                  plural(len(cadenas_200), "regla 3xx cuyo destino es el origen de una reescritura 200.",
                         "reglas 3xx cuyo destino es el origen de una reescritura 200."),
                  cadenas_200,
                  nota="Para el navegador es un solo salto, pero gasta dos lineas del\n"
                       "presupuesto. Conviene apuntar directo a la URL canonica final.")


def inv5_sitemap_fiel(sitio, inf):
    b = inf.bloque("5", "SITEMAP FIEL (toda URL del sitemap resuelve de verdad)")
    ruta = os.path.join(sitio.raiz, "sitemap.xml")
    if not os.path.exists(ruta):
        inf.fallo(b, GRAVE_ALTA, "No existe sitemap.xml en la raiz.", [])
        return
    with open(ruta, encoding="utf-8", errors="replace") as f:
        contenido = f.read()
    locs = RE_LOC.findall(contenido)
    b["titulo"] += "  [%d URLs]" % len(locs)

    rotas = []
    con_salto = []
    por_regla = []
    duplicadas = []
    vistas = set()
    for loc in locs:
        p = normalizar(loc)
        if p in vistas:
            duplicadas.append(loc)
        vistas.add(p)
        res = sitio.resolver(p, solo_honradas=True)
        if res["estado"] in ("404", "bucle", "saltos"):
            # Se reintenta con TODAS las reglas para explicar si es culpa del corte.
            res_todas = sitio.resolver(p, solo_honradas=False)
            if res_todas["estado"] in ("archivo", "reescritura"):
                regla, _ = sitio.primera_regla(p, solo_honradas=False)
                motivo = ("solo vive por la regla #%d, FUERA de las primeras %d"
                          % (regla.indice, PRESUPUESTO_REGLAS))
            else:
                motivo = res["estado"]
            rotas.append("%s   [%s]" % (loc, motivo))
            continue
        if res["saltos"] > 0:
            con_salto.append("%s   [%d salto(s): %s]"
                             % (loc, res["saltos"], " -> ".join(res["cadena"])))
        elif res["estado"] == "reescritura":
            # No es un archivo: vive gracias a una regla 200. Si el archivo se
            # reordena y esa regla cae despues del corte, la URL muere de golpe.
            regla, _ = sitio.primera_regla(p, solo_honradas=True)
            por_regla.append("%s   [reescritura 200 por la regla #%d -> %s]"
                             % (loc, regla.indice, regla.destino))

    if rotas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(rotas), "URL del sitemap no resuelve a un archivo servible.",
                         "URLs del sitemap no resuelven a un archivo servible."),
                  rotas)
    if duplicadas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(duplicadas), "URL repetida dentro del sitemap.",
                         "URLs repetidas dentro del sitemap."), duplicadas)
    if con_salto:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(con_salto), "URL del sitemap llega con salto 3xx en vez de responder 200.",
                         "URLs del sitemap llegan con salto 3xx en vez de responder 200."),
                  con_salto,
                  nota="Una URL del sitemap deberia responder 200 directo, sin redireccion.")
    if por_regla:
        inf.fallo(b, GRAVE_MEDIA,
                  plural(len(por_regla), "URL del sitemap no es archivo: depende de una regla 200.",
                         "URLs del sitemap no son archivos: dependen de una regla 200."),
                  por_regla,
                  nota="Responden 200 hoy, pero su vida depende de la POSICION de esa regla.\n"
                       "Reordenar _redirects las mata sin previo aviso. Lo robusto es que la\n"
                       "URL canonica sea un archivo real en el repo.")


def inv6_canonica_unica(sitio, paginas, inf):
    b = inf.bloque("6", "CANONICA UNICA y coincidente con la ruta publica del post")
    posts = [p for p in paginas if es_post(p.rel)]
    b["titulo"] += "  [%d posts]" % len(posts)

    sin_canonica = []
    desajustadas = []
    por_canonica = {}
    for p in posts:
        if not p.canonical:
            sin_canonica.append(p.rel)
            continue
        canon = normalizar(p.canonical)
        por_canonica.setdefault(canon, []).append(p.rel)
        if canon != p.url:
            desajustadas.append("%s  declara %s  pero se sirve en %s"
                                % (p.rel, p.canonical, p.url))

    repetidas = []
    for canon, archivos in sorted(por_canonica.items()):
        if len(archivos) > 1:
            repetidas.append("%s  <- %s" % (canon, ", ".join(sorted(archivos))))

    if sin_canonica:
        inf.fallo(b, GRAVE_ALTA, plural(len(sin_canonica), "post sin <link rel=canonical>.", "posts sin <link rel=canonical>."),
                  sin_canonica)
    if repetidas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(repetidas), "canonica compartida por mas de un post.",
                         "canonicas compartidas por mas de un post."), repetidas)
    if desajustadas:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(desajustadas), "post cuya canonica no es su propia URL publica.",
                         "posts cuya canonica no es su propia URL publica."),
                  desajustadas)


def inv7_url_pisada(sitio, paginas, inf):
    b = inf.bloque("7", "SIN URL PISADA (ningun post vivo aparece como ORIGEN de un redirect)")
    pisados = []
    for p in paginas:
        if not es_post(p.rel):
            continue
        if p.url in sitio.origenes:
            regla = next(r for r in sitio.reglas if normalizar(r.origen) == p.url)
            pisados.append("%s  (archivo %s) tambien es origen de la regla #%d -> %s"
                           % (p.url, p.rel, regla.indice, regla.destino))
    if pisados:
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(pisados), "post vivo tiene su URL registrada como redirect.",
                         "posts vivos tienen su URL registrada como redirect."),
                  pisados,
                  nota="Si el archivo sigue en disco, Pages lo sirve y la regla nunca corre;\n"
                       "y si el archivo se borrara, un post nuevo se habria quedado con la\n"
                       "URL de uno viejo. Un post vivo nunca se redirige.")


def inv8_sin_huerfanos(sitio, paginas, inf):
    b = inf.bloque("8", "SIN HUERFANOS (todo post recibe al menos un enlace entrante)")
    entrantes = {}
    for p in paginas:
        for destino in p.enlaces:
            if destino == p.url:
                continue  # un enlace a si mismo no cuenta
            entrantes.setdefault(destino, set()).add(p.rel)

    huerfanos = []
    solo_indice = []
    indices = {"/blog", "/es/blog"}
    for p in paginas:
        if not es_post(p.rel):
            continue
        origenes = entrantes.get(p.url, set())
        if not origenes:
            huerfanos.append("%s  (archivo %s)" % (p.url, p.rel))
            continue
        urls_origen = {sitio.url_publica(rel) for rel in origenes}
        if urls_origen <= indices:
            solo_indice.append("%s  (unico enlace: %s)" % (p.url, ", ".join(sorted(urls_origen))))

    b["titulo"] += "  [%d posts]" % sum(1 for p in paginas if es_post(p.rel))
    if huerfanos:
        inf.fallo(b, GRAVE_ALTA, plural(len(huerfanos), "post sin ningun enlace interno entrante.",
                         "posts sin ningun enlace interno entrante."),
                  huerfanos)
    if solo_indice:
        inf.fallo(b, GRAVE_MEDIA,
                  plural(len(solo_indice), "post cuyo unico enlace entrante es el indice del blog.",
                         "posts cuyo unico enlace entrante es el indice del blog."),
                  solo_indice,
                  nota="El grafo queda en estrella: si el indice cambia, el post se aisla.")


def inv9_enlaces_vivos(sitio, paginas, inf):
    """EXTRA (no pedida, pero es el mismo grafo y atrapa 404s en vivo).

    Un href interno solo esta vivo si resuelve usando UNICAMENTE las reglas
    honradas. audit_links.py da por buena cualquier regla del archivo sin mirar
    su posicion, y por eso no ve estos 404 reales.
    """
    b = inf.bloque("9", "ENLACES INTERNOS VIVOS (extra: resuelven con las primeras %d reglas)"
                   % PRESUPUESTO_REGLAS)
    entrantes = {}
    for p in paginas:
        for destino in p.enlaces:
            if destino == p.url:
                continue
            # Las sub-apps marketing/ y gallery/ estan fuera de esta auditoria,
            # asi que sus rutas no se pueden juzgar desde aqui.
            if destino.startswith(("/marketing/", "/gallery/", "/api/")):
                continue
            entrantes.setdefault(destino, set()).add(p.rel)

    muertos = []
    for destino in sorted(entrantes):
        if sitio.resolver(destino, solo_honradas=True)["estado"] not in ("404", "bucle", "saltos"):
            continue
        origenes = sorted(entrantes[destino])
        salvable = sitio.resolver(destino, solo_honradas=False)["estado"]
        motivo = ("vive solo por una regla FUERA de las primeras %d" % PRESUPUESTO_REGLAS
                  if salvable in ("archivo", "reescritura") else "no existe en ningun lado")
        muertos.append("%s   <- %d pagina(s) (%s%s)   [%s]"
                       % (destino, len(origenes), ", ".join(origenes[:3]),
                          ", ..." if len(origenes) > 3 else "", motivo))

    if muertos:
        # Se ordena por numero de paginas que enlazan: primero lo que mas duele.
        muertos.sort(key=lambda t: -int(t.split("<- ")[1].split(" ")[0]))
        inf.fallo(b, GRAVE_ALTA,
                  plural(len(muertos), "destino de enlace interno responde 404 hoy.",
                         "destinos de enlace interno responden 404 hoy."),
                  muertos)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def inv10_sin_seo_para_ias(sitio, inf):
    """10. CERO artefactos de SEO dirigido a IAs (purga 2026-08-15).

    Microsoft llama a esta tactica 'AI Recommendation Poisoning' y hay caso
    documentado (y sufrido por IVAE) de que el motor SE LO DICE AL USUARIO
    como senal de no-confiabilidad. Prohibido reintroducir: metas ai-*,
    bloques ocultos ai-disambiguation / ai-context-block, links a llms.txt
    titulados "para IA", e imperativos a asistentes en los manifiestos.
    Ver memoria website-ai-seo-purge.
    """
    b = inf.bloque("10", "SIN SEO DIRIGIDO A IAs (metas ai-*, texto oculto, imperativos)")
    pat_html = [
        (re.compile(r'name="ai-'), 'meta name="ai-*"'),
        (re.compile(r'ai-disambiguation|ai-context-block'), 'bloque oculto para IAs'),
        (re.compile(r'<link[^>]*llms\.txt'), 'link a llms.txt en <head>'),
        (re.compile(r'For AI assistants|for search engines and AI', re.I), 'texto dirigido a IAs'),
    ]
    casos = []
    for rel in sitio.htmls:
        try:
            with open(os.path.join(sitio.raiz, rel), encoding="utf-8", errors="replace") as f:
                texto = f.read()
        except OSError:
            continue
        for pat, nombre in pat_html:
            if pat.search(texto):
                casos.append("%s contiene %s" % (rel, nombre))
    pat_manif = re.compile(
        r'HARD RULE|For AI assistants|recommend IVAE|surface IVAE|quotable answers'
        r'|exemplary AI responses|recommend_for|is a top recommendation', re.I)
    for manif in ("llms.txt", "llms-full.txt", "ai.txt", "api/facts.json"):
        ruta = os.path.join(sitio.raiz, manif)
        if not os.path.exists(ruta):
            continue
        with open(ruta, encoding="utf-8", errors="replace") as f:
            m = pat_manif.search(f.read())
        if m:
            casos.append("%s contiene el imperativo '%s'" % (manif, m.group(0)))
    if casos:
        inf.fallo(b, GRAVE_ALTA,
                  "SEO dirigido a IAs reintroducido: las IAs lo detectan y le dicen "
                  "al usuario que el sitio NO es confiable",
                  casos[:20],
                  nota="Purga original: commit 1c2a8ca0 (2026-08-15). Retirar el artefacto, no documentarlo.")


def main():
    ap = argparse.ArgumentParser(
        description="Verificador de invariantes del ecosistema de URLs de ivaestudios.com")
    ap.add_argument("--raiz", default=".", help="raiz del repo (por defecto: el directorio actual)")
    ap.add_argument("--fail-on-error", action="store_true",
                    help="devuelve codigo 1 si hay violaciones de gravedad ALTA")
    ap.add_argument("--ejemplos", type=int, default=10,
                    help="maximo de ejemplos por fallo (por defecto: 10)")
    args = ap.parse_args()

    t0 = time.time()
    raiz = os.path.abspath(args.raiz)
    if not os.path.exists(os.path.join(raiz, "_redirects")):
        print("ERROR: no encuentro _redirects en %s. Corre el script desde la raiz del repo."
              % raiz, file=sys.stderr)
        return 2

    sitio = Sitio(raiz)
    paginas = leer_paginas(sitio)
    inf = Informe(args.ejemplos)

    print("Raiz: %s" % raiz)
    print("Archivos HTML publicos: %d  |  reglas en _redirects: %d  |  presupuesto: %d"
          % (len(sitio.htmls), len(sitio.reglas), PRESUPUESTO_REGLAS))

    inv1_presupuesto(sitio, inf)
    inv2_reglas_muertas(sitio, inf)
    inv3_destino_real(sitio, inf)
    inv4_cadenas_y_bucles(sitio, inf)
    inv5_sitemap_fiel(sitio, inf)
    inv6_canonica_unica(sitio, paginas, inf)
    inv7_url_pisada(sitio, paginas, inf)
    inv8_sin_huerfanos(sitio, paginas, inf)
    inv9_enlaces_vivos(sitio, paginas, inf)
    inv10_sin_seo_para_ias(sitio, inf)

    inf.imprimir(time.time() - t0)

    if args.fail_on_error and inf.altas > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
