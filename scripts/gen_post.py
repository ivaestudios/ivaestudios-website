#!/usr/bin/env python3
"""Genera un post del Journal clonando la plantilla de un post vivo.

Reutiliza head, CSS y esqueleto (cabecera, pie, autor, CTA) y sustituye el
contenido: metadatos, JSON-LD, heroe, migas, indice, cuerpo, FAQ y enlaces.

USO
    python3 scripts/gen_post.py <plantilla.html> <datos.json> <salida.html>

Plantilla de referencia: blog/is-cancun-safe-for-luxury-travellers.html
(secciones post-hero, toc, post-article, faq-block, internal-links).

GUARDAS: JSON-LD valido, un solo <h1>, cero guiones largos (regla de Vianey),
lista "prohibidas" para cazar texto de la plantilla, y anclas del indice que
existan de verdad en el cuerpo.
"""
import json
import re
import sys

BASE = "https://ivaestudios.com"


def generar(plantilla, d):
    s = open(plantilla, encoding="utf-8").read()
    corte = s.find("</head>")
    head, body = s[:corte], s[corte:]
    vieja = d["plantilla_url"]

    # ── head ──────────────────────────────────────────────────────────────
    head = re.sub(r"<title>.*?</title>", f'<title>{d["title"]}</title>', head, flags=re.S)
    for pat in (r'(<meta name="description" content=")[^"]*(")',
                r'(<meta property="og:description" content=")[^"]*(")',
                r'(<meta name="twitter:description" content=")[^"]*(")'):
        head = re.sub(pat, lambda m: m.group(1) + d["desc"] + m.group(2), head)
    for pat in (r'(<meta property="og:title" content=")[^"]*(")',
                r'(<meta name="twitter:title" content=")[^"]*(")',
                r'(<meta property="og:image:alt" content=")[^"]*(")'):
        head = re.sub(pat, lambda m: m.group(1) + d["h1"] + m.group(2), head)
    head = head.replace(BASE + "/" + vieja, BASE + "/" + d["slug"])
    if d.get("hreflang_alt"):
        lang = d.get("lang", "en")
        par = {lang: d["slug"], "es" if lang == "en" else "en": d["hreflang_alt"]}
        for cual, destino in par.items():
            head = re.sub(r'<link rel="alternate" hreflang="' + cual + r'" href="[^"]*"/>',
                          f'<link rel="alternate" hreflang="{cual}" href="{BASE}/{destino}"/>', head)
        head = re.sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*"/>',
                      f'<link rel="alternate" hreflang="x-default" href="{BASE}/{par["en"]}"/>', head)
    if d.get("lang") == "es":
        head = head.replace('<html lang="en">', '<html lang="es">').replace('content="en_US"', 'content="es_MX"')

    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', head, re.S)
    g = json.loads(ld.group(1))
    for n in g["@graph"]:
        t = n.get("@type")
        if t == "BlogPosting":
            n["@id"] = f'{BASE}/{d["slug"]}#post'
            n["headline"] = d["h1"]
            n["description"] = d["desc"]
            n["datePublished"] = d["fecha"]
            n["dateModified"] = d["fecha"]
            n["mainEntityOfPage"] = f'{BASE}/{d["slug"]}'
            n["articleSection"] = d.get("seccion", "Weddings")
            n["inLanguage"] = d.get("lang", "en")
            if d.get("keywords"):
                n["keywords"] = d["keywords"]
        elif t == "BreadcrumbList":
            n["@id"] = f'{BASE}/{d["slug"]}#breadcrumbs'
            n["itemListElement"] = d["migas"]
        elif t == "FAQPage":
            n["@id"] = f'{BASE}/{d["slug"]}#faq'
            n["mainEntity"] = [{"@type": "Question", "name": q,
                                "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}}
                               for q, a in d["faq"]]
        elif t == "WebPage":
            n["@id"] = f'{BASE}/{d["slug"]}#webpage'
            n["url"] = f'{BASE}/{d["slug"]}'
            n["name"] = d["title"]
    head = head[:ld.start()] + '<script type="application/ld+json">' + json.dumps(g, ensure_ascii=False, separators=(",", ":")) + "</script>" + head[ld.end():]

    # ── body ──────────────────────────────────────────────────────────────
    body = body.replace(BASE + "/" + vieja, BASE + "/" + d["slug"])

    body = re.sub(r'(<span class="post-tag-hero">)[^<]*(</span>)', lambda m: m.group(1) + d["etiqueta"] + m.group(2), body, count=1)
    body = re.sub(r'<h1>.*?</h1>', f'<h1>{d["h1"]}</h1>', body, count=1, flags=re.S)
    body = re.sub(r'(<div class="post-meta-bar">).*?(</div>)',
                  lambda m: m.group(1) + f'<span>{d["por"]} <a href="{d["autor_url"]}" rel="author">Vianey D&iacute;az</a></span> <span>&middot;</span> <span>{d["fecha_texto"]}</span> <span>&middot;</span> <span>{d["lectura"]}</span>' + m.group(2),
                  body, count=1, flags=re.S)
    body = re.sub(r'(<nav class="breadcrumbs" aria-label="Breadcrumb">).*?(</nav>)',
                  lambda m: m.group(1) + f'<a href="{d["miga_home"]}">{d["miga_home_txt"]}</a><span>&rsaquo;</span> <a href="{d["miga_blog"]}">{d["miga_blog_txt"]}</a><span>&rsaquo;</span> {d["h1"]}' + m.group(2),
                  body, count=1, flags=re.S)

    toc = "".join(f'<li><a href="#{a}">{t}</a></li>' for a, t in d["indice"])
    body = re.sub(r'(<nav class="toc">).*?(</nav>)',
                  lambda m: m.group(1) + f'<div class="toc-box"><div class="toc-title">{d["indice_titulo"]}</div><ol class="toc-list">{toc}</ol></div>' + m.group(2),
                  body, count=1, flags=re.S)

    secciones = "".join(f'<h2 id="{a}">{t}</h2>{c}' for a, t, c in d["cuerpo"])
    body = re.sub(r'(<article class="post-article"[^>]*>).*?(</article>)',
                  lambda m: m.group(1) + f'<div class="post-tldr" role="note" aria-label="{d["tldr_label"]}"><span class="post-tldr__label">{d["tldr_label"]}</span><p>{d["tldr"]}</p></div><p class="post-lead rv">{d["lead"]}</p>' + secciones + m.group(2),
                  body, count=1, flags=re.S)

    faq = "".join(f'<div class="faq-q">{q}</div><p class="faq-a">{a}</p>' for q, a in d["faq"])
    body = re.sub(r'(<section class="faq-block" id="faq">).*?(</section>)',
                  lambda m: m.group(1) + f'<h2>{d["faq_titulo"]}</h2>' + faq + m.group(2),
                  body, count=1, flags=re.S)

    il = "".join(f'<a class="il-link" href="{u}"><div class="il-tag">{tag}</div><div class="il-title">{t}</div></a>'
                 for u, tag, t in d["enlaces"])
    body = re.sub(r'(<section class="internal-links">).*?(</section>)',
                  lambda m: m.group(1) + f'<h3>{d["enlaces_titulo"]}</h3><div class="il-grid">{il}</div>' + m.group(2),
                  body, count=1, flags=re.S)

    # En la plantilla el FAQ y los enlaces viven DENTRO de <article>, y el
    # reemplazo del articulo (arriba) se los lleva por delante. Si tras las
    # sustituciones no quedan, se vuelven a meter antes de </article>.
    # Descubierto el 2026-09-22: 12 posts salian con FAQPage en el JSON-LD
    # y sin ninguna pregunta visible.
    faq_html = f'<section class="faq-block" id="faq"><h2>{d["faq_titulo"]}</h2>{faq}</section>'
    il_html = f'<section class="internal-links"><h3>{d["enlaces_titulo"]}</h3><div class="il-grid">{il}</div></section>'
    if 'class="faq-block"' not in body:
        body = body.replace("</article>", faq_html + "</article>", 1)
    if 'class="internal-links"' not in body:
        body = body.replace("</article>", il_html + "</article>", 1)
    if d.get("hero_img"):
        body = re.sub(r'(<div class="post-hero-ph">.*?<img src=")[^"]*(")', lambda m: m.group(1) + d["hero_img"] + m.group(2), body, count=1, flags=re.S)
        body = re.sub(r'(<div class="post-hero-ph">.*?<img [^>]*alt=")[^"]*(")', lambda m: m.group(1) + d["hero_alt"] + m.group(2), body, count=1, flags=re.S)

    out = head + body
    if d.get("plantilla_alt") and d.get("hreflang_alt"):
        out = out.replace(BASE + "/" + d["plantilla_alt"], BASE + "/" + d["hreflang_alt"])
        out = out.replace('href="/' + d["plantilla_alt"] + '"', 'href="/' + d["hreflang_alt"] + '"')

    # ── guardas ───────────────────────────────────────────────────────────
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', out, re.S):
        json.loads(m.group(1))
    sin_org = re.sub(r'"knowsAbout":\[[^\]]*\]', "", out)
    for resto in d.get("prohibidas", []):
        assert resto.lower() not in sin_org.lower(), f"quedo texto de la plantilla: {resto}"
    assert "—" not in out, "guion largo (regla de Vianey: cero guiones largos)"
    assert out.count("<h1") == 1, "h1 duplicado"
    for a, _ in d["indice"]:
        assert f'id="{a}"' in out, f"el indice apunta a #{a} y esa ancla no existe en el cuerpo"
    return out


if __name__ == "__main__":
    datos = json.load(open(sys.argv[2], encoding="utf-8"))
    html = generar(sys.argv[1], datos)
    open(sys.argv[3], "w", encoding="utf-8").write(html)
    print(f'{sys.argv[3]}: {len(html)} bytes')
