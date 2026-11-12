# Arma comparison/wedding-photographers-cancun.html: la comparativa de fotografos
# de bodas de Cancun con datos publicos.
#
# De donde sale cada cosa
#   - Cabecera, pie y bloques comunes: se copian de comparison/luxury-photographers-cancun.html.
#   - Datos (WW, PRECIOS, FAQ y los textos de abajo): se leyeron el 12-nov-2026 en la lista
#     de WeddingWire de Cancun, en la ficha de cada estudio, en el sitio propio de cada
#     estudio y en las paginas de resultados de One Eyeland.
#
# Reglas de la pagina (no romperlas al actualizar)
#   - No se ordena a nadie como "el mejor". Cada tabla dice con que numero esta ordenada.
#   - Cada cifra lleva fecha y enlace a donde se leyo. Si no se pudo comprobar en la
#     fuente, se dice ("segun su sitio").
#   - De IVAE solo lo que ya esta publicado en el sitio.
#   - Sin guiones largos; rangos con "to"; "Cancun" sin acento en ingles.
#
# Para actualizar: releer las fuentes, cambiar las cifras y FECHA / FECHA_TXT aqui,
# y correr:  python3 scripts/comparativa_bodas.py .
# Despues revisar la pagina en computadora y en telefono antes de publicar.
import sys, re, json, html

ws = sys.argv[1]
tpl = open(f"{ws}/comparison/luxury-photographers-cancun.html", encoding="utf-8").read()

URL = "https://ivaestudios.com/comparison/wedding-photographers-cancun"
FECHA = "2026-11-12"
FECHA_TXT = "November 12, 2026"
TITLE = "Best Wedding Photographers in Cancun (2026): 17 Studios Compared"
DESC = ("17 Cancun and Riviera Maya wedding photographers compared with public data read "
        "November 12, 2026: WeddingWire reviews, awards, prices and delivery times.")
H1 = "The best wedding photographers in Cancun, compared by reviews, awards and prices"
OG_IMG = "https://ivaestudios.com/images/og-comparison-cancun.jpg"
WA = "https://wa.me/529902046514?text=Hi%20Vianey%2C%20I%20read%20the%20wedding%20photographer%20comparison%20and%20would%20like%20to%20talk%20about%20our%20wedding"

WW_LIST = "https://www.weddingwire.com/c/mx-mexico/cancun/wedding-photographers/10-vendors.html"
WW_RULE = "https://weddingpro.zendesk.com/hc/en-us/articles/48647047832084"
BRIDEBOX = "https://bridebox.com/blog/top-20-wedding-photographers-cancun/"
OE24 = "https://oneeyeland.com/world-top10-wedding-photographers-2024"
OE25 = "https://oneeyeland.com/world-top10-wedding-photographers-2025"
GMAPS = "https://maps.google.com/maps?cid=17378665430927342473"

# --- Datos -------------------------------------------------------------
# WeddingWire, lista de Cancun, leida el 12-nov-2026. (nombre, ficha, nota, resenas, premios, precio)
WW = [
    ("Photostudioab", "https://www.weddingwire.com/biz/photostudioab-playa-del-carmen/8aeccfc151e84d02.html", "4.9", 220, "11", "$480"),
    ("Quetzal Wedding Photo", "https://www.weddingwire.com/biz/quetzal-wedding-photo-playa-del-carmen/4b50e2520aebf4f8.html", "5.0", 213, "12", "$1,500"),
    ("Romanza Wedding Photography", "https://www.weddingwire.com/biz/romanza-wedding-photography/0490f317a773576c.html", "4.8", 158, "5", "Not shown"),
    ("FineArt Studio", "https://www.weddingwire.com/biz/fineart-studio-cancun-playa-del-carmen-tulum/3e4697e564017927.html", "5.0", 148, "10", "$2,000"),
    ("Santiago Gabay Photography", "https://www.weddingwire.com/biz/santiago-gabay-photography-cancun/05c23d653f975a14.html", "5.0", 114, "7", "$1,200"),
    ("Isidro Corona Photography", "https://www.weddingwire.com/biz/isidro-corona-photography-cancun/28ca2c4bbb963344.html", "5.0", 53, "3", "$1,200"),
    ("Rwanda Studio", "https://www.weddingwire.com/biz/rwanda-studio/571d12a52d6c736c.html", "4.9", 21, "1", "Not shown"),
]
# Precios en el sitio propio de cada estudio, leidos el 12-nov-2026. (nombre, pagina, texto)
PRECIOS = [
    ("Luckie Photography", "https://www.luckiephotography.com/wedding-photography-cancun-prices/",
     "Three packages, starting at $600, $1,000 and $1,600"),
    ("Victor Herrera", "https://victorherrera.net/cancun-wedding-photographer",
     "$1,200 for 4 hours, $1,800 for 6 hours, $2,500 for 8 hours with a second photographer"),
    ("IVAE Studios", "/cancun-wedding-photographer",
     "Half day of up to 4 hours, $1,800 to $2,800. Full day of 8 to 10 hours with a second photographer, $3,500 to $5,500. Full day with a wedding film, $5,500 to $8,000"),
    ("MTM Photography", "https://www.momentsthatmatterphotography.com/pricing",
     "Weddings from $2,100. Elopements from $1,000"),
    ("Sweetfire Photography and Videography", "https://sweetfirephotography.com/prices",
     "Wedding photography from $2,100. Elopements from $1,000"),
    ("Monica Lopez Photography", "https://monicalopezphoto.com/wedding-experience/",
     "$2,500 for up to 4 hours, $3,500 for up to 6 hours with a second photographer. Weekday elopements, $1,250"),
    ("Citlalli Rico Photography", "https://citlallirico.com/cancun-weddings-riviera-maya/",
     "Weddings from $3,200. Elopements from $2,200"),
    ("Amor Amor Weddings", "https://amoramorweddings.com/",
     "Photo and film packages from $4,000"),
    ("Hideki Falcon Photography", "https://hidekifalcon.com/experience",
     "From $5,000"),
]
# Sitio de cada estudio, para la lista de datos estructurados (orden alfabetico, sin ranking).
SITIOS = {
    "Amor Amor Weddings": "https://amoramorweddings.com/",
    "Citlalli Rico Photography": "https://citlallirico.com/",
    "FineArt Studio": "https://www.fineartstudioweddings.com/",
    "Hideki Falcon Photography": "https://hidekifalcon.com/",
    "Isidro Corona Photography": "https://www.weddingwire.com/biz/isidro-corona-photography-cancun/28ca2c4bbb963344.html",
    "IVAE Studios": "https://ivaestudios.com/",
    "Luckie Photography": "https://www.luckiephotography.com/",
    "Monica Lopez Photography": "https://monicalopezphoto.com/",
    "MTM Photography": "https://www.momentsthatmatterphotography.com/",
    "Photostudioab": "https://www.photostudioab.com/",
    "Pixan Photography": "https://pixanphotography.com/",
    "Quetzal Wedding Photo": "https://www.weddingwire.com/biz/quetzal-wedding-photo-playa-del-carmen/4b50e2520aebf4f8.html",
    "Romanza Wedding Photography": "https://romanza.com.mx/",
    "Rwanda Studio": "https://www.weddingwire.com/biz/rwanda-studio/571d12a52d6c736c.html",
    "Santiago Gabay Photography": "https://www.santiagogabay.com/",
    "Sweetfire Photography and Videography": "https://sweetfirephotography.com/",
    "Victor Herrera": "https://victorherrera.net/",
}
assert len(SITIOS) == 17

FAQ = [
    ("Who is the best wedding photographer in Cancun?",
     "No single studio is best on every measure. On WeddingWire, Photostudioab (4.9 from 220 reviews) and Quetzal Wedding Photo (5.0 from 213) have the most reviews, and Quetzal has won the Couples' Choice Award 12 times. The founder of Pixan Photography ranked first in One Eyeland's World's Top 10 Wedding Photographers 2024. Victor Herrera publishes a written 15 day delivery guarantee and prices from 1,200 USD. IVAE Studios publishes the shortest delivery time we found, 1 to 3 business days, with a 5.0 rating from 73 Google reviews and at most 12 weddings a year. All figures were read on November 12, 2026."),
    ("Which Cancun wedding photographers have the most reviews?",
     "On WeddingWire's Cancun list on November 12, 2026: Photostudioab with 220 reviews (4.9), Quetzal Wedding Photo with 213 (5.0), Jorge Rodriguez Photography with 191, Romanza Wedding Photography with 158 (4.8), DreamArt Photography with 151 and FineArt Studio with 148 (5.0). IVAE Studios has no WeddingWire profile; it holds a 5.0 rating from 73 reviews on Google."),
    ("How much does a wedding photographer cost in Cancun?",
     "Among the nine studios on this page that publish prices, wedding coverage starts between 600 and 5,000 USD. Victor Herrera lists 1,200 USD for four hours and 2,500 USD for eight hours with a second photographer. Monica Lopez Photography lists 2,500 USD for four hours and 3,500 USD for six. IVAE Studios lists 1,800 to 2,800 USD for a half day and 3,500 to 5,500 USD for a full day. If your resort charges a fee for an outside photographer, that fee is separate."),
    ("How long does it take to get wedding photos back in Cancun?",
     "It depends on the studio. We found four answers in writing: IVAE Studios delivers the complete gallery in 1 to 3 business days, Victor Herrera in 15 days, Luckie Photography estimates 4 to 8 weeks and Monica Lopez Photography delivers within 10 weeks. Ask for the delivery date in the contract, whoever you choose."),
    ("Is this list ranked, and who wrote it?",
     "It is not ranked. IVAE Studios, a photography studio in Cancun, wrote it and is one of the seventeen studios on it. Each table is ordered by a number named above it, every figure comes from a public page read on November 12, 2026, and corrections are welcome at info@ivaestudios.com."),
]

e = html.escape


def ext(url, texto, nofollow=True):
    rel = "noopener nofollow" if nofollow else "noopener"
    return f'<a href="{e(url)}" target="_blank" rel="{rel}">{texto}</a>'


# --- Datos estructurados ------------------------------------------------
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', tpl, flags=re.S)
grafo = json.loads(m.group(1))["@graph"]
comunes = [x for x in grafo if x.get("@type") in (["Organization", "LocalBusiness", "ProfessionalService"], "Brand", "Person", "WebSite")]
assert len(comunes) == 4, [x.get("@type") for x in comunes]

lista = []
for i, (nombre, url) in enumerate(sorted(SITIOS.items(), key=lambda kv: kv[0].lower()), 1):
    if nombre == "IVAE Studios":
        item = {"@id": "https://ivaestudios.com/#organization"}
    else:
        item = {"@type": "Organization", "name": nombre, "url": url}
    lista.append({"@type": "ListItem", "position": i, "name": nombre, "url": url, "item": item})

propios = [
    {"@type": "WebPage", "@id": URL + "#webpage", "url": URL, "name": TITLE, "inLanguage": "en",
     "isPartOf": {"@id": "https://ivaestudios.com/#website"},
     "about": {"@type": "Thing", "name": "Wedding photography in Cancun, Mexico"},
     "mainEntity": [{"@id": URL + "#article"}, {"@id": URL + "#list"}],
     "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".post-lead"]}},
    {"@type": "BreadcrumbList", "@id": URL + "#breadcrumbs", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://ivaestudios.com"},
        {"@type": "ListItem", "position": 2, "name": "Journal", "item": "https://ivaestudios.com/blog"},
        {"@type": "ListItem", "position": 3, "name": "Best Wedding Photographers in Cancun"}]},
    {"@type": "Article", "@id": URL + "#article", "headline": H1,
     "description": "Seventeen wedding studios in Cancun and the Riviera Maya compared with public data read on November 12, 2026: WeddingWire ratings, review counts and Couples' Choice Awards, international awards, published prices and delivery times. The list is not ranked.",
     "image": OG_IMG, "datePublished": FECHA, "dateModified": FECHA,
     "author": {"@id": "https://ivaestudios.com/#vianey-diaz"},
     "publisher": {"@id": "https://ivaestudios.com/#organization"},
     "mainEntityOfPage": {"@id": URL + "#webpage"}, "inLanguage": "en", "articleSection": "Comparison",
     "keywords": "best wedding photographers Cancun, Cancun wedding photographer reviews, Cancun wedding photographer prices, top rated wedding photographers Cancun Riviera Maya, wedding photographer awards Cancun",
     "about": [{"@id": "https://ivaestudios.com/#brand"}]},
    {"@type": "ItemList", "@id": URL + "#list", "name": "Wedding photographers in Cancun and the Riviera Maya compared on this page",
     "description": "Seventeen studios in alphabetical order. The order implies no ranking.",
     "itemListOrder": "https://schema.org/ItemListUnordered", "numberOfItems": len(lista), "itemListElement": lista},
    {"@type": "FAQPage", "@id": URL + "#faq", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]},
]
ld = json.dumps({"@context": "https://schema.org", "@graph": comunes[:3] + propios[:1] + comunes[3:] + propios[1:]},
                ensure_ascii=False, separators=(",", ":"))

# --- Cabecera -----------------------------------------------------------
i_fonts = tpl.index('<link rel="preconnect" href="https://fonts.googleapis.com"/>')
i_css = tpl.index('<link rel="stylesheet" href="/styles/blog.css')
i_ld = tpl.index('<script type="application/ld+json">')
i_style = tpl.index("<style>", i_ld)
i_style_fin = tpl.index("</style>", i_style) + len("</style>")
i_head_fin = tpl.index("</head>")
fuentes = tpl[i_fonts:i_css]
hojas = tpl[i_css:i_ld]
iconos = tpl[i_style_fin:i_head_fin]

ESTILO = """<style>
.skip-link{position:absolute;top:-100%;left:16px;background:#ffffff;color:var(--ink);padding:12px 24px;z-index:10001;font-size:14px;font-weight:600;text-decoration:none;border-radius:0 0 4px 4px;transition:top 0.3s}
.skip-link:focus{top:0}
.cmp-table{width:100%;border-collapse:collapse;margin:32px 0;font-size:13px;background:#ffffff;border:1px solid var(--border-l)}
.cmp-table thead{background:#f7f7f5}
.cmp-table th{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink);padding:14px 12px;text-align:left;border-bottom:1px solid var(--border-l);vertical-align:bottom}
.cmp-table td{padding:14px 12px;line-height:1.55;color:var(--muted-l);border-bottom:1px solid var(--border-l);vertical-align:top}
.cmp-table tbody tr:last-child td{border-bottom:none}
.cmp-table tbody tr:hover{background:rgba(31,58,90,0.02)}
.cmp-table .row-label{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--ink);font-style:italic}
.cmp-table .row-label a{color:inherit}
.cmp-table tr.ivae-row td{background:rgba(31,58,90,0.03)}
.cmp-table tr.ivae-row:hover td{background:rgba(31,58,90,0.05)}
.cmp-table td.num{white-space:nowrap}
.cmp-note{font-size:12.5px;color:var(--muted-l);margin-top:-18px;margin-bottom:32px;line-height:1.6}
.criteria-list{margin:20px 0 32px;padding-left:22px;line-height:1.75}
.criteria-list li{margin-bottom:10px}
.cmp-faq{margin:8px 0 16px}
.cmp-faq dt{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:var(--ink);margin-top:26px}
.cmp-faq dd{margin:10px 0 0;line-height:1.7}
@media(max-width:767px){
  /* En telefono cada estudio es una tarjeta; la etiqueta de cada dato sale de data-label. */
  .cmp-table,.cmp-table thead,.cmp-table tbody,.cmp-table tr,.cmp-table td{display:block;width:100%;border:none}
  .cmp-table thead{display:none}
  .cmp-table tr{margin-bottom:14px;padding:18px 16px;background:#ffffff;border:1px solid var(--border-l)}
  .cmp-table td{padding:8px 0;text-align:left;white-space:normal;font-size:14px;line-height:1.55}
  .cmp-table td.num{white-space:normal}
  .cmp-table .row-label{font-size:19px;font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--ink);border-bottom:1px solid var(--border-l);padding-bottom:10px;margin-bottom:8px}
  .cmp-table td[data-label]::before{content:attr(data-label) ' \\00b7';margin-right:7px;font-family:'Syne',sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-l)}
  .cmp-table tr.ivae-row{border-color:rgba(31,58,90,0.27);background:#f6f7f9}
  .cmp-table tr.ivae-row td,.cmp-table tr.ivae-row:hover td{background:transparent}
}
@media(min-width:768px) and (max-width:1023px){.cmp-table{font-size:12.5px}.cmp-table th,.cmp-table td{padding:12px 10px}.cmp-table .row-label{font-size:15px}}
/* Enlaces de la tabla: dorado profundo, 5.25 de contraste sobre crema (igual que la otra comparativa). */
html.dark .cmp-table a,
.cmp-table a { color: #7d6428 !important; }
</style>"""

head = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>{e(TITLE)}</title>
<meta name="description" content="{e(DESC)}"/>
<link rel="canonical" href="{URL}"/>
<link rel="alternate" hreflang="en" href="{URL}"/>
<link rel="alternate" hreflang="x-default" href="{URL}"/>
<meta property="og:title" content="{e(TITLE)}"/>
<meta property="og:description" content="WeddingWire reviews and awards, international rankings, published prices and delivery times for seventeen Cancun and Riviera Maya wedding studios. Not ranked; every figure dated and linked."/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="{URL}"/>
<meta property="og:image" content="{OG_IMG}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:site_name" content="IVAE Studios"/>
<meta property="og:locale" content="en_US"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{e(TITLE)}"/>
<meta name="twitter:description" content="Seventeen Cancun wedding studios compared with public, dated and linked data. Not ranked."/>
<meta name="twitter:image" content="{OG_IMG}"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
<meta name="geo.region" content="MX-ROO"/>
<meta name="geo.placename" content="Cancun, Quintana Roo, Mexico"/>
<meta name="geo.position" content="21.1619;-86.8515"/>
<meta name="ICBM" content="21.1619, -86.8515"/>
<meta name="author" content="Vianey Díaz / IVAE Studios"/>
<meta name="publisher" content="IVAE Studios"/>
<meta name="copyright" content="IVAE Studios"/>
<meta name="DC.title" content="Best Wedding Photographers in Cancun, Compared with Public Data"/>
<meta name="DC.creator" content="Vianey Díaz"/>
<meta name="DC.publisher" content="IVAE Studios"/>
<meta name="DC.language" content="en"/>
<meta name="DC.coverage" content="Cancun, Quintana Roo, Mexico"/>
{fuentes}{hojas}<script type="application/ld+json">{ld}</script>

{ESTILO}{iconos}</head>
"""

# --- Cuerpo --------------------------------------------------------------
IMG = "/images/optimized/wedding-cancun-hotel-zone-ivae-studios-3"
ALT = "Bride and groom during their ceremony under a palapa by the sea in the Cancun Hotel Zone, photographed by IVAE Studios"

filas_ww = "\n".join(
    f"""      <tr>
        <td class="row-label">{ext(u, e(n))}</td>
        <td class="num" data-label="Rating and reviews">{nota} from {res} reviews</td>
        <td class="num" data-label="Couples' Choice Awards">{prem}</td>
        <td class="num" data-label="Starting price shown">{pre}</td>
      </tr>""" for n, u, nota, res, prem, pre in WW)

filas_pr = []
for n, u, txt in PRECIOS:
    if n == "IVAE Studios":
        filas_pr.append(f"""      <tr class="ivae-row">
        <td class="row-label"><a href="{u}">IVAE Studios</a></td>
        <td data-label="Published wedding prices">{e(txt)}</td>
      </tr>""")
    else:
        filas_pr.append(f"""      <tr>
        <td class="row-label">{ext(u, e(n))}</td>
        <td data-label="Published wedding prices">{e(txt)}</td>
      </tr>""")
filas_pr = "\n".join(filas_pr)

faq_html = "\n".join(f"    <dt>{e(q)}</dt>\n    <dd>{e(a, quote=False)}</dd>" for q, a in FAQ)

body_top = f"""<body><!--email_off-->
<a href="#main-content" class="skip-link">Skip to content</a>

<header class="site-header" id="siteHeader">
  <a class="header-logo" href="/"><img class="lg-navy" src="/images/logo-ivae-h-navy.png" alt="IVAE Studios" decoding="async"/><img class="lg-cream" src="/images/logo-ivae-h-cream.png" alt="IVAE Studios" aria-hidden="true" decoding="async"/></a>
  <nav><ul class="header-nav" role="navigation" aria-label="Main navigation">
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/#services">Services</a></li>
    <li><a href="/blog">Blog</a></li>
  <li><a href="https://gallery.ivaestudios.com/">Gallery</a></li>
    </ul></nav>
  <a class="header-cta" href="{WA}" target="_blank" rel="noopener">Book Now</a>

</header>

<!-- HERO -->
<section class="post-hero">
  <picture>
    <source type="image/avif" srcset="{IMG}-768.avif 768w, {IMG}-1200.avif 1200w, {IMG}-1920.avif 1920w" sizes="100vw"/>
    <source type="image/webp" srcset="{IMG}-768.webp 768w, {IMG}-1200.webp 1200w, {IMG}-1920.webp 1920w" sizes="100vw"/>
    <img src="{IMG}-1920.jpg" alt="{ALT}" width="1920" height="1280" fetchpriority="high" decoding="async"/>
  </picture>
  <div class="post-hero-overlay"></div>
  <div class="post-hero-content">
    <a class="post-back" href="/blog"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg> Back to Journal</a>
    <span class="post-tag-hero">Comparison &middot; Weddings</span>
    <h1>{e(H1)}</h1>
    <div class="post-meta-bar">
      <span>By Vianey D&iacute;az</span>
      <span>&middot;</span>
      <span>Published {FECHA_TXT}</span>
    </div>
  </div>
</section>

<!-- BREADCRUMBS -->
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">Home</a><span>&rsaquo;</span>
  <a href="/blog">Journal</a><span>&rsaquo;</span>
  Best Wedding Photographers in Cancun
</nav>

<!-- ARTICLE -->
<article class="post-article" id="main-content">

  <p class="post-lead">There is no single best wedding photographer in Cancun. The answer changes with what you weigh, so this page gives you the numbers and leaves the verdict to you. Counted by reviews on WeddingWire, Photostudioab (4.9 from 220 reviews) and Quetzal Wedding Photo (5.0 from 213) lead. Counted by international awards, the founder of Pixan Photography ranked first in One Eyeland's 2024 world list of wedding photographers. Counted by how soon the finished gallery arrives, the shortest time we found in writing is our own: 1 to 3 business days. This is our page, so we rank nobody, ourselves included. Every figure comes from a public source read on {FECHA_TXT}, and the sources are linked so you can check them.</p>

  <div class="post-divider"></div>

  <h2>How this comparison <em>was made</em></h2>

  <p>We compared seventeen studios that photograph weddings in Cancun and the Riviera Maya: sixteen that independent sources single out, plus our own. The sixteen come from three places: the studios that carry the award badge on {ext(WW_LIST, "WeddingWire's Cancun list", False)}, the studios on {ext(BRIDEBOX, "BrideBox's list of twenty Cancun wedding photographers", False)} (rebuilt in October 2026) that print their prices, and a local studio whose founder One Eyeland ranked first in the world among wedding photographers in 2024.</p>

  <p>For each studio we wrote down only what a couple can check without sending a message:</p>

  <ol class="criteria-list">
    <li><strong>Independent reviews.</strong> The rating and number of reviews on WeddingWire, and how many times the studio has won WeddingWire's Couples' Choice Award.</li>
    <li><strong>Awards.</strong> International awards, with the awarding body named so the result can be confirmed there.</li>
    <li><strong>Published prices.</strong> Wedding prices printed on the studio's own website.</li>
    <li><strong>Delivery time and volume.</strong> When the finished gallery arrives and how many weddings a year the studio takes, where either is in writing.</li>
  </ol>

  <p>We did not test anyone's work, we did not ask for private quotes, and nobody paid or asked to be included. Review counts and prices move, so treat the date as part of every number. If you run one of these studios and a figure is out of date, write to <a href="mailto:info@ivaestudios.com">info@ivaestudios.com</a> and we will fix the row.</p>

  <h2 id="weddingwire">Reviews and awards <em>on WeddingWire</em></h2>

  <p>WeddingWire listed 20 wedding photographers for Cancun on {FECHA_TXT}. Seven carried its award badge, which marks winners of the Couples' Choice Awards. To be eligible, a vendor needs at least seven reviews averaging 4.5 or higher within the calendar year ({ext(WW_RULE, "the published rule", False)}), so the badge reflects steady recent reviews and not only a large total. The table is ordered by number of reviews.</p>

  <table class="cmp-table">
    <thead>
      <tr>
        <th>Studio</th>
        <th>Rating and reviews</th>
        <th>Couples' Choice Awards won</th>
        <th>Starting price on its profile</th>
      </tr>
    </thead>
    <tbody>
{filas_ww}
      <tr class="ivae-row">
        <td class="row-label"><a href="/cancun-wedding-photographer">IVAE Studios</a></td>
        <td data-label="Rating and reviews">No WeddingWire profile yet. On Google, 5.0 from 73 reviews</td>
        <td class="num" data-label="Couples' Choice Awards">None</td>
        <td data-label="Starting price shown">See the price table below</td>
      </tr>
    </tbody>
  </table>

  <p class="cmp-note">Five more studios on the same list had more than 60 reviews and no award badge on that date: Jorge Rodriguez Photography (191 reviews), DreamArt Photography (151), Fractal Photo &amp; Video (70), Take It Photo (63) and Santamaria photography (63). A starting price is the figure a profile shows; it is rarely the price of a full wedding day.</p>

  <h2 id="awards">International <em>awards</em></h2>

  <p>An award is worth checking at its source, because the awarding body publishes its own results.</p>

  <ul class="criteria-list">
    <li><strong>Pixan Photography.</strong> One Eyeland ranked its founder, Vincent van den Berg, first in its World's Top 10 Wedding Photographers 2024 and fourth in 2025, first among photographers in Mexico that year. We confirmed both on One Eyeland's results pages for {ext(OE24, "2024", False)} and {ext(OE25, "2025", False)}. {ext("https://pixanphotography.com/", "Pixan", True)} is based in Playa del Carmen; its packages page shows no prices.</li>
    <li><strong>Victor Herrera.</strong> {ext("https://victorherrera.net/cancun-wedding-photographer", "His site", True)} states that the ISPWP places him among the top 16 wedding photographers in the world and that he is a WPJA award winner. Both are international associations of wedding photographers. We report this as his site states it; we did not confirm it with the associations.</li>
    <li><strong>WeddingWire Couples' Choice Awards.</strong> Counted in the table above: Quetzal Wedding Photo 12 times, Photostudioab 11, FineArt Studio 10, Santiago Gabay Photography 7, Romanza Wedding Photography 5, Isidro Corona Photography 3 and Rwanda Studio once.</li>
    <li><strong>IVAE Studios.</strong> No industry award. The studio opened in 2023.</li>
  </ul>

  <h2 id="prices">Wedding prices each studio <em>publishes</em></h2>

  <p>Nine of the seventeen studios print wedding prices on their own websites. These are the figures each site showed on {FECHA_TXT}, in US dollars, ordered by the lowest price for a wedding. They do not include any fee your resort may charge for bringing an outside photographer, so ask the resort about that in writing.</p>

  <table class="cmp-table">
    <thead>
      <tr>
        <th>Studio</th>
        <th>Wedding prices published on its own site</th>
      </tr>
    </thead>
    <tbody>
{filas_pr}
    </tbody>
  </table>

  <p class="cmp-note">The other eight studios print no wedding prices on the pages we read. Five of them show a starting price on WeddingWire, and those figures are in the first table. For more on what a wedding day costs here, see our guide to <a href="/blog/wedding-photography-cancun-cost-2026">wedding photography prices in Cancun</a>.</p>

  <h2 id="delivery">Delivery time and <em>weddings per year</em></h2>

  <p>Few studios put either number in writing. These are the ones we found:</p>

  <ul class="criteria-list">
    <li><strong>IVAE Studios.</strong> The complete edited gallery in 1 to 3 business days. At most 12 weddings a year.</li>
    <li><strong>Victor Herrera.</strong> A preview in 5 days and the full gallery in 15 days, guaranteed in the contract. Limited to 20 weddings a year.</li>
    <li><strong>Luckie Photography.</strong> Estimated delivery in 4 to 8 weeks.</li>
    <li><strong>Monica Lopez Photography.</strong> A preview of 30 or more images within 7 days and the full gallery within 10 weeks.</li>
  </ul>

  <p>We did not read every page of every site, so a studio missing from this list may still publish its timing. Whoever you choose, ask for the delivery date in the contract. Our reasons for delivering fast are in <a href="/blog/wedding-photo-delivery-speed-comparison">wedding photo delivery: 6 weeks or 3 days</a>.</p>

  <h2>How to read <em>these numbers</em></h2>

  <ul class="criteria-list">
    <li><strong>A review count grows with years in business.</strong> By their own sites, {ext('https://www.photostudioab.com/', 'Photostudioab', True)} has worked in the Riviera Maya since 2007, MTM Photography since 2009 and Monica Lopez Photography since 2012. IVAE Studios opened in 2023. Compare ratings and recent reviews, not only totals.</li>
    <li><strong>WeddingWire and Google measure different things.</strong> WeddingWire reviews come from wedding couples. Google reviews cover every kind of session a studio photographs.</li>
    <li><strong>A starting price buys the shortest coverage.</strong> Compare hours, whether a second photographer is included and what the gallery contains.</li>
    <li><strong>Ask who will hold the camera.</strong> A studio with several teams and a photographer who works alone can both be the right choice. You should know which one you are hiring.</li>
  </ul>

  <p>Choosing for a specific area? We wrote guides for the <a href="/blog/best-wedding-photographer-cancun-hotel-zone">Cancun Hotel Zone</a> and <a href="/blog/best-wedding-photographers-playa-mujeres">Playa Mujeres</a>, and a wider <a href="/comparison/luxury-photographers-cancun">comparison of Cancun studios</a> that includes Google ratings for eleven more.</p>

  <h2 id="ivae">Where IVAE Studios <em>fits</em></h2>

  <p>We are a young studio, opened in 2023, and the numbers show it: no WeddingWire profile yet, no industry award, and 73 Google reviews where two studios on this page show more than 200 on WeddingWire. Those 73 reviews average 5.0, and you can {ext(GMAPS, "read them on Google", False)}.</p>

  <p>What we built the studio around is different. One lead photographer, Vianey D&iacute;az. At most 12 weddings a year. Direction in English and Spanish. Couple portraits at golden hour. The complete edited gallery in 1 to 3 business days, usually while you are still on your honeymoon. Half-day coverage of up to four hours costs 1,800 to 2,800 USD, a full day of eight to ten hours with a second photographer costs 3,500 to 5,500 USD, and a full day with a wedding film costs 5,500 to 8,000 USD.</p>

  <p>If a long wedding review record or an association award matters most to you, the studios above have them. If you want editorial coverage at your resort, few weddings on your photographer's calendar and your gallery back within days, see our <a href="/cancun-wedding-photographer">Cancun wedding photographer</a> page.</p>

  <h2>Questions about <em>this comparison</em></h2>

  <dl class="cmp-faq">
{faq_html}
  </dl>

  <h2>How to <em>reach us</em></h2>

  <p>Send your wedding date, your venue and a sentence about your day. We reply within 24 hours with availability and a proposal. Weddings are planned on a video call and hold their date with a signed agreement and a retainer.</p>

</article>

<!-- AUTO-LINKS:start -->
<section class="internal-links">
  <h3>Continue reading</h3>
  <div class="il-grid">
    <a class="il-link" href="/cancun-wedding-photographer">
      <div class="il-tag">Weddings</div>
      <div class="il-title">Cancun Wedding Photographer</div>
    </a>
    <a class="il-link" href="/comparison/luxury-photographers-cancun">
      <div class="il-tag">Comparison</div>
      <div class="il-title">Best Photographer in Cancun</div>
    </a>
    <a class="il-link" href="/blog/wedding-photography-cancun-cost-2026">
      <div class="il-tag">Cost</div>
      <div class="il-title">Wedding Photography Prices in Cancun</div>
    </a>
    <a class="il-link" href="/blog/wedding-photo-delivery-speed-comparison">
      <div class="il-tag">Delivery</div>
      <div class="il-title">Wedding Photo Delivery: 6 Weeks or 3 Days</div>
    </a>
    <a class="il-link" href="/blog/best-wedding-photographer-cancun-hotel-zone">
      <div class="il-tag">Guide</div>
      <div class="il-title">Choosing a Wedding Photographer in the Hotel Zone</div>
    </a>
  </div>
</section>
<!-- AUTO-LINKS:end -->

<section class="post-cta">
  <span style="font-size:9.5px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#1f3a5a">Now booking 2026 &amp; 2027</span>
  <h2>Send your date. <em>We&rsquo;ll send a proposal.</em></h2>
  <p>Wedding date, venue and a sentence about your day. We reply within 24 hours.</p>
  <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
    <a class="btn-cta" href="{WA}" target="_blank" rel="noopener">
        Message Us on WhatsApp
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>
    </a>
    <a class="btn-cta" href="mailto:info@ivaestudios.com" style="background:transparent;border:1px solid rgba(31,58,90,0.24);color:#1f3a5a;">
        Email info@ivaestudios.com
    </a>
  </div>
</section>

"""

i_footer = tpl.index('<footer class="colophon"')
pie = tpl[i_footer:]
out = head + body_top + pie
dest = f"{ws}/comparison/wedding-photographers-cancun.html"
open(dest, "w", encoding="utf-8").write(out)
print("escrito", dest, len(out))
