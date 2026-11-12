#!/usr/bin/env python3
"""Escribe seo/control/ROBOTS_IA.md: que robots de buscadores y de IAs leyeron el sitio.

POR QUE EXISTE
El 11-nov-2026 Claude solo conocia una copia vieja del sitio y por eso no
recomendaba a IVAE. La copia ya redirige al sitio real, pero no hay forma de
pedirle a Claude que vuelva a leer: hay que esperar a su robot. Este informe
dice, todos los dias, si ya paso, que leyo y si sigue pidiendo la copia vieja.
Lo mismo para ChatGPT, Meta (Muse), Perplexity, Google y Bing.

DE DONDE SALEN LOS DATOS
functions/_middleware.js avisa de cada visita de un robot conocido al registro
(Worker ivae-rastreo, carpeta ivae-rastreo/ del proyecto). Aqui solo se lee el
resumen: RASTREO_INFORME_URL y RASTREO_CLAVE. Si faltan, no hace nada.

  python3 scripts/robots_ia.py            # escribe el informe
  python3 scripts/robots_ia.py --ver      # lo imprime, no escribe
"""
import datetime
import json
import os
import sys
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, "seo", "control", "ROBOTS_IA.md")
DATOS = os.path.join(RAIZ, "seo", "control", "robots_ia.json")
COPIA = "ivaestudios-website.pages.dev"

QUIEN = {
    "Claude-SearchBot": "Claude: arma su buscador (el que decide si nos nombra)",
    "Claude-User": "Claude: abre una pagina porque una persona se lo pidio",
    "ClaudeBot": "Claude: entrenamiento",
    "anthropic-ai": "Claude: robot antiguo",
    "OAI-SearchBot": "ChatGPT: arma su buscador",
    "ChatGPT-User": "ChatGPT: abre una pagina porque una persona se lo pidio",
    "GPTBot": "ChatGPT: entrenamiento",
    "PerplexityBot": "Perplexity: arma su buscador",
    "Perplexity-User": "Perplexity: abre una pagina a pedido",
    "Meta-WebIndexer": "Meta: arma el buscador de Meta AI y Muse",
    "Meta-ExternalAgent": "Meta: entrenamiento",
    "Meta-ExternalFetcher": "Meta: abre una pagina a pedido (Meta AI, Muse)",
    "Meta-ExternalAds": "Meta: anuncios",
    "FacebookExternalHit": "Facebook: vista previa de enlaces compartidos",
    "Googlebot": "Google: buscador",
    "Google-Extended": "Google: Gemini",
    "GoogleOther": "Google: otros productos",
    "Bingbot": "Bing: buscador (lo usa ChatGPT)",
    "Applebot": "Apple: Siri y Spotlight",
    "Amazonbot": "Amazon: Alexa",
    "DuckAssistBot": "DuckDuckGo: respuestas con IA",
    "Bravebot": "Brave: buscador",
}
ORDEN = ["Claude-SearchBot", "Claude-User", "ClaudeBot", "OAI-SearchBot", "ChatGPT-User", "GPTBot",
         "Meta-WebIndexer", "Meta-ExternalFetcher", "Meta-ExternalAgent", "PerplexityBot", "Perplexity-User",
         "Googlebot", "Google-Extended", "Bingbot"]


def hora_cancun(iso):
    try:
        t = datetime.datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S") - datetime.timedelta(hours=5)
        return t.strftime("%d-%m %H:%M")
    except (TypeError, ValueError):
        return "-"


def leer(dias=14):
    url = os.environ.get("RASTREO_INFORME_URL", "").strip()
    clave = os.environ.get("RASTREO_CLAVE", "").strip()
    if not url or not clave:
        return None
    pedido = urllib.request.Request(url + "?dias=%d" % dias, headers={"x-clave": clave, "User-Agent": "ivae-control/1"})
    with urllib.request.urlopen(pedido, timeout=40) as r:
        return json.loads(r.read().decode())


def armar(d):
    hoy = (datetime.datetime.utcnow() - datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M")
    por = {}
    for r in d["porRobot"]:
        e = por.setdefault(r["robot"], {"real": None, "copia": None, "otros": []})
        if r["sitio"] == COPIA:
            e["copia"] = r
        elif r["sitio"] == "ivaestudios.com":
            e["real"] = r
        else:
            e["otros"].append(r)
    L = ["# Robots que leyeron el sitio", "",
         "Actualizado: %s (hora de Cancun). Ventana: ultimos %d dias. El registro empezo el 11 de noviembre de 2026 en la noche." % (
             hoy, d["dias"]), "",
         "Solo cuentan las visitas **genuinas**: las que vienen de la red del propio robot. "
         "Las demas son alguien usando el nombre del robot.", ""]

    # 1. La pregunta del dia: Claude
    csb = por.get("Claude-SearchBot", {})
    real, copia = csb.get("real"), csb.get("copia")
    L += ["## Claude: ¿ya volvio a leer?", ""]
    if real and real["genuinas"]:
        L.append("- **Si.** El robot del buscador de Claude leyo %d paginas de ivaestudios.com (%d visitas). Ultima: %s." % (
            real["paginas"], real["genuinas"], hora_cancun(real["ultima"])))
    else:
        L.append("- **Todavia no.** El robot del buscador de Claude (Claude-SearchBot) no ha pasado por ivaestudios.com en esta ventana.")
    if copia and copia["genuinas"]:
        L.append("- Paso %d veces por la copia vieja y cada vez se le mando al sitio real. Ultima: %s. Es justo lo que hace falta: asi cambia la direccion vieja por la buena." % (
            copia["genuinas"], hora_cancun(copia["ultima"])))
    else:
        L.append("- No ha pedido la copia vieja en esta ventana.")
    cb = por.get("ClaudeBot", {}).get("real")
    if cb and cb["genuinas"]:
        L.append("- El otro robot de Anthropic (ClaudeBot, el que junta material para entrenar a Claude) si leyo el sitio real: %d paginas. Ultima: %s. No es el del buscador, pero confirma que Anthropic llega sin problema a ivaestudios.com." % (
            cb["paginas"], hora_cancun(cb["ultima"])))
    cu = por.get("Claude-User", {}).get("real")
    if cu and cu["genuinas"]:
        L.append("- Ademas, Claude abrio paginas del sitio real porque alguien se lo pidio en una conversacion: %d visitas. Ultima: %s." % (
            cu["genuinas"], hora_cancun(cu["ultima"])))
    L.append("")

    # 2. Tabla general
    L += ["## Todos los robots", "", "| Robot | Para que sirve | Visitas genuinas a ivaestudios.com | Paginas | Ultima visita | Copia vieja | bodasmx.com.mx |",
          "|---|---|---:|---:|---|---:|---:|"]
    nombres = [n for n in ORDEN if n in por] + sorted(n for n in por if n not in ORDEN)
    for n in nombres:
        e = por[n]
        r, c = e["real"] or {}, e["copia"] or {}
        bmx = sum(o.get("genuinas", 0) for o in e["otros"] if o["sitio"] == "bodasmx.com.mx")
        L.append("| %s | %s | %s | %s | %s | %s | %s |" % (
            n, QUIEN.get(n, ""), r.get("genuinas", 0), r.get("paginas", 0),
            hora_cancun(r.get("ultima")) if r else "-", c.get("genuinas", 0), bmx))
    if not nombres:
        L.append("| (sin visitas todavia) | | | | | | |")
    L.append("")

    # 3. Paginas que leyo Claude
    filas = [r for r in d.get("rutasClaude", []) if r.get("genuinas")]
    if filas:
        L += ["## Lo ultimo que leyo Claude", "", "| Cuando | Robot | Sitio | Pagina | Respuesta | Red |", "|---|---|---|---|---:|---|"]
        for r in filas[:40]:
            L.append("| %s | %s | %s | `%s` | %s | %s |" % (hora_cancun(r["ultima"]), r["robot"],
                                                        "copia vieja" if r["sitio"] == COPIA else r["sitio"], r["ruta"][:70],
                                                        r["estado"], (r.get("red") or "")[:30]))
        L.append("")

    # 3b. Direcciones que los robots pidieron y no existen: candidatas a redireccion
    faltan = d.get("noExisten") or []
    if faltan:
        L += ["## Direcciones que no existen y que los robots pidieron", "",
              "Son enlaces viejos que siguen vivos en algun lado. Las que tengan pagina equivalente se redirigen "
              "(las del blog viejo, en `functions/post/[[ruta]].js`).", "",
              "| Sitio | Direccion | Veces | Quien la pidio | Ultima vez |", "|---|---|---:|---|---|"]
        for r in faltan[:40]:
            L.append("| %s | `%s` | %s | %s | %s |" % ("copia vieja" if r["sitio"] == COPIA else r["sitio"], str(r["ruta"])[:90],
                                                   r["visitas"], (r.get("robots") or "")[:60], hora_cancun(r["ultima"])))
        L.append("")

    # 4. Por dia
    dias = {}
    for r in d.get("porDia", []):
        if r["genuinas"]:
            dias.setdefault(r["dia"], []).append("%s %d" % (r["robot"], r["genuinas"]))
    if dias:
        L += ["## Por dia (UTC)", ""]
        for dia in sorted(dias, reverse=True)[:14]:
            L.append("- %s: %s" % (dia, ", ".join(dias[dia][:12])))
        L.append("")
    falsas = sum((r["visitas"] or 0) - (r["genuinas"] or 0) for r in d["porRobot"])
    L += ["Visitas con nombre de robot que NO venian de su red: %d (no se cuentan arriba)." % falsas, ""]
    return "\n".join(L)


def main():
    try:
        d = leer()
    except Exception as e:  # noqa: BLE001
        print("::notice::Robots: no se pudo leer el registro (%s)." % type(e).__name__)
        return 0
    if d is None:
        print("::notice::Robots: faltan RASTREO_INFORME_URL y RASTREO_CLAVE; no se escribe el informe.")
        return 0
    if not d.get("ok"):
        print("::notice::Robots: el registro contesto con error.")
        return 0
    texto = armar(d)
    if "--ver" in sys.argv:
        print(texto)
        return 0
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    open(SALIDA, "w", encoding="utf-8").write(texto)
    json.dump(d, open(DATOS, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("Robots: informe escrito (%d robots con visitas)." % len({r["robot"] for r in d["porRobot"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
