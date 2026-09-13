#!/usr/bin/env python3
"""Genera una landing nueva clonando la plantilla de una landing viva.

Reutiliza el <head>, el CSS y el esqueleto (cabecera, pie, scripts) de la
plantilla, y sustituye SOLO el contenido: metadatos, JSON-LD y las nueve
secciones. Asi la pagina nueva hereda el diseno sin copiarlo a mano.

USO
    python3 scripts/gen_landing.py <plantilla.html> <datos.json> <salida.html>

La plantilla DEBE tener las nueve secciones: hero, about, services, spots,
timing, method, faq, related, cta. Comprobarlo antes con:
    grep -oE '<section class="[a-z]+"' plantilla.html | sort -u
Plantillas conocidas que cumplen: quinceanera-photographer-cancun.html y
es/fotografo-quinceanera-cancun.html.

GUARDAS (fallan en vez de publicar basura): JSON-LD valido, un solo <h1>,
cero guiones largos (regla de Vianey) y la lista "prohibidas" para cazar texto
de la plantilla que sobrevivio al reemplazo.
"""
import json
import re
import sys

BASE = "https://ivaestudios.com"


def bloque(nombre, etiqueta, titulo, cuerpo):
    return (f'<section class="{nombre}"><div class="wrap">'
            f'<span class="section-label rv" data-anim="fade">{etiqueta}</span>'
            f'<h2 class="sec-h rv d1" data-anim="fade">{titulo}</h2>{cuerpo}</div></section>')


def tarjetas(clase, items, num=True):
    out = []
    for i, (h, p) in enumerate(items, 1):
        n = f'<div class="{clase}-num">{i:02d}</div>' if num else ''
        out.append(f'<div class="{clase} rv d{min(i,3)}" data-anim="fade">{n}<h3>{h}</h3><p>{p}</p></div>')
    return "".join(out)


def generar(plantilla, d):
    s = open(plantilla, encoding="utf-8").read()
    corte = s.find("</head>")
    head, body = s[:corte], s[corte:]
    vieja_url = d["plantilla_url"]

    head = re.sub(r"<title>.*?</title>", f'<title>{d["title"]}</title>', head, flags=re.S)
    head = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + d["desc"] + m.group(2), head)
    head = re.sub(r'(<meta property="og:title" content=")[^"]*(")', lambda m: m.group(1) + d["title"] + m.group(2), head)
    head = re.sub(r'(<meta name="twitter:title" content=")[^"]*(")', lambda m: m.group(1) + d["title"] + m.group(2), head)
    for k in ("og:description", "twitter:description"):
        head = re.sub(r'(<meta (?:property|name)="' + k + r'" content=")[^"]*(")', lambda m: m.group(1) + d["desc"] + m.group(2), head)
    head = re.sub(r'(<meta property="og:image:alt" content=")[^"]*(")', lambda m: m.group(1) + d["title"] + m.group(2), head)
    head = head.replace(BASE + "/" + vieja_url, BASE + "/" + d["slug"])
    if d.get("hreflang_alt"):
        propio, otro = d["slug"], d["hreflang_alt"]
        lang = d.get("lang", "en")
        par = {lang: propio, "es" if lang == "en" else "en": otro}
        for cual, destino in par.items():
            head = re.sub(r'<link rel="alternate" hreflang="' + cual + r'" href="[^"]*"/>',
                          f'<link rel="alternate" hreflang="{cual}" href="{BASE}/{destino}"/>', head)
        head = re.sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*"/>',
                      f'<link rel="alternate" hreflang="x-default" href="{BASE}/{par["en"]}"/>', head)
    if d.get("lang") == "es":
        head = head.replace('<html lang="en">', '<html lang="es">')
        head = head.replace('content="en_US"', 'content="es_MX"')

    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', head, re.S)
    g = json.loads(ld.group(1))
    for n in g["@graph"]:
        t = n.get("@type")
        if t == "Service":
            n["@id"] = f'{BASE}/{d["slug"]}#service'
            n["name"] = d["servicio"]
            n["serviceType"] = d["tipo_servicio"]
            n["description"] = d["desc_larga"]
            n["url"] = f'{BASE}/{d["slug"]}'
        elif t == "WebPage":
            n["@id"] = f'{BASE}/{d["slug"]}#webpage'
            n["url"] = f'{BASE}/{d["slug"]}'
            n["name"] = d["title"]
            n["description"] = d["desc"]
            n["inLanguage"] = d.get("lang", "en")
            n["mainEntity"] = {"@id": f'{BASE}/{d["slug"]}#service'}
        elif t == "BreadcrumbList":
            n["@id"] = f'{BASE}/{d["slug"]}#breadcrumbs'
            n["itemListElement"] = d["migas"]
        elif t == "FAQPage":
            n["@id"] = f'{BASE}/{d["slug"]}#faq'
            n["mainEntity"] = [{"@type": "Question", "name": q,
                                "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}}
                               for q, a in d["faq"]]
    head = head[:ld.start()] + '<script type="application/ld+json">' + json.dumps(g, ensure_ascii=False, separators=(",", ":")) + "</script>" + head[ld.end():]

    body = body.replace(BASE + "/" + vieja_url, BASE + "/" + d["slug"])
    body = re.sub(r'<section class="hero".*?</section>',
                  f'<section class="hero" id="main-content"><div class="hero-bg"></div><div class="hero-content">'
                  f'<span class="eyebrow rv" data-anim="fade">{d["eyebrow"]}</span>'
                  f'<h1 class="rv d1" data-anim="fade">{d["h1"]}</h1>'
                  f'<p class="hero-sub rv d2" data-anim="fade">{d["hero_sub"]}</p>'
                  f'<a class="hero-btn rv d3" data-anim="fade" href="{d["wa"]}" target="_blank" rel="noopener">{d["cta_btn"]}</a>'
                  f'</div></section>', body, count=1, flags=re.S)
    body = re.sub(r'<section class="about".*?</section>',
                  f'<section class="about"><div class="about-inner">'
                  f'<span class="section-label rv" data-anim="fade">{d["about_label"]}</span>'
                  f'<h2 class="sec-h rv d1" data-anim="fade">{d["about_h"]}</h2>{d["about_p"]}</div></section>',
                  body, count=1, flags=re.S)
    body = re.sub(r'<section class="services".*?</section>',
                  bloque("services", d["serv_label"], d["serv_h"],
                         f'<p class="services-intro rv d2" data-anim="fade">{d["serv_intro"]}</p>'
                         f'<div class="services-grid">{tarjetas("svc", d["servicios"])}</div>'),
                  body, count=1, flags=re.S)
    body = re.sub(r'<section class="spots".*?</section>',
                  bloque("spots", d["spots_label"], d["spots_h"], f'<div class="spots-grid">{tarjetas("spot", d["spots"])}</div>'),
                  body, count=1, flags=re.S)
    body = re.sub(r'<section class="timing".*?</section>',
                  bloque("timing", d["timing_label"], d["timing_h"],
                         f'<p class="timing-intro rv d2" data-anim="fade">{d["timing_intro"]}</p>'
                         f'<div class="timing-grid">{tarjetas("timing-card", d["timing"], num=False)}</div>'),
                  body, count=1, flags=re.S)
    pasos = "".join(f'<div class="step rv d{min(i,3)}" data-anim="fade"><span class="step-num">{d["paso"]} {i:02d}</span><h3>{h}</h3><p>{p}</p></div>'
                    for i, (h, p) in enumerate(d["metodo"], 1))
    body = re.sub(r'<section class="method".*?</section>',
                  bloque("method", d["met_label"], d["met_h"], f'<div class="method-grid">{pasos}</div>'),
                  body, count=1, flags=re.S)
    faq = "".join(f'<div class="faq-item rv d1" data-anim="fade"><h3>{q}</h3><p>{a}</p></div>' for q, a in d["faq"])
    body = re.sub(r'<section class="faq".*?</section>',
                  bloque("faq", d["faq_label"], d["faq_h"], f'<div class="faq-list">{faq}</div>'),
                  body, count=1, flags=re.S)
    body = re.sub(r'<section class="related".*?</section>',
                  f'<section class="related"><div class="wrap">'
                  f'<span class="section-label rv" data-anim="fade">{d["rel_label"]}</span>'
                  f'<h2 class="rv d1" data-anim="fade">{d["rel_h"]}</h2>'
                  f'<p class="rv d2" data-anim="fade">{d["rel_p"]}</p></div></section>',
                  body, count=1, flags=re.S)
    body = re.sub(r'<section class="cta".*?</section>',
                  f'<section class="cta"><div class="cta-bg"></div><div class="cta-inner">'
                  f'<h2 class="rv" data-anim="fade">{d["cta_h"]}</h2>'
                  f'<p class="rv d1" data-anim="fade">{d["cta_p"]}</p>'
                  f'<div class="cta-btns rv d2" data-anim="fade">'
                  f'<a class="cta-btn" href="{d["wa"]}" target="_blank" rel="noopener">{d["cta_btn"]}</a>'
                  f'<a class="cta-btn" href="mailto:info@ivaestudios.com">{d["cta_btn2"]}</a></div></div></section>',
                  body, count=1, flags=re.S)

    out = head + body
    out = re.sub(r'https://wa\.me/529902046514\?text=[^"]*', d["wa"], out)
    if d.get("plantilla_alt") and d.get("hreflang_alt"):
        out = out.replace(BASE + "/" + d["plantilla_alt"], BASE + "/" + d["hreflang_alt"])
        out = out.replace('href="/' + d["plantilla_alt"] + '"', 'href="/' + d["hreflang_alt"] + '"')
    if d.get("miga_visible"):
        out = re.sub(r'(<li class="current" aria-current="page">)[^<]*(</li>)',
                     lambda m: m.group(1) + d["miga_visible"] + m.group(2), out)
    if d.get("audiencia"):
        out = re.sub(r'("audienceType":")[^"]*(")', lambda m: m.group(1) + d["audiencia"] + m.group(2), out)

    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', out, re.S):
        json.loads(m.group(1))
    # El nodo #organization es plantilla de TODO el sitio y enumera cada
    # servicio del estudio (incluida "Quinceanera Photography"), asi que se
    # excluye del barrido: si no, la guarda salta por texto legitimo.
    sin_org = re.sub(r'\{"@type":\["Organization".*?\}(?=,\{"@type")', "", out, flags=re.S)
    sin_org = re.sub(r'"knowsAbout":\[[^\]]*\]', "", sin_org)
    for resto in d.get("prohibidas", []):
        assert resto.lower() not in sin_org.lower(), f"quedo texto de la plantilla: {resto}"
    assert "—" not in out, "guion largo (regla de Vianey: cero guiones largos)"
    assert out.count("<h1") == 1, "h1 duplicado"
    return out


if __name__ == "__main__":
    datos = json.load(open(sys.argv[2], encoding="utf-8"))
    html = generar(sys.argv[1], datos)
    open(sys.argv[3], "w", encoding="utf-8").write(html)
    print(f'{sys.argv[3]}: {len(html)} bytes')
