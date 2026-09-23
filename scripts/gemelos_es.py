import json,re,sys,os,random,subprocess
sys.path.insert(0,"scripts"); import gen_post
sys.path.insert(0,"scripts"); from anadir_folio import completas
BASE="https://ivaestudios.com"
tr=set(subprocess.run(["git","ls-files","images/optimized"],capture_output=True,text=True).stdout.split("\n"))
POOL=sorted(n for n in completas() if all("images/optimized/%s-%d.%s"%(n,t,e) in tr for t in (480,768,1200,1920,2400) for e in ("avif","webp")) and not n.startswith("logo") and not re.search(r'-v2-(3840|5120)$',n))
def fotos(pat,n,seed=3):
    c=[x for x in POOL if re.search(pat,x)]; random.Random(seed).shuffle(c); return c[:n]
def fig(nom,alt,pie):
    return ('<figure style="margin:36px 0"><img src="/images/%s.jpg" alt="%s" loading="lazy" decoding="async" style="width:100%%;height:auto;display:block;border-radius:4px"/><figcaption style="font-size:13px;opacity:.75;margin-top:8px">%s</figcaption></figure>')%(nom,alt,pie)
PLANT="blog/is-cancun-safe-for-luxury-travellers.html"
def alt_de(p):
    m=re.search(r'hreflang="es" href="https://ivaestudios\.com/((?:es/)?blog/[^"]+)"',open(p,encoding="utf-8").read()); return m.group(1) if m else None
def base(slug,h1,en_slug,hero):
    return {"lang":"es","slug":slug,"h1":h1,"fecha":"2026-09-23","fecha_texto":"23 de septiembre de 2026","por":"Por","autor_url":"/es/vianey-diaz",
     "tldr_label":"En corto","indice_titulo":"En esta guía","faq_titulo":"Preguntas frecuentes","enlaces_titulo":"Sigue leyendo",
     "miga_home":"/es/","miga_home_txt":"Inicio","miga_blog":"/es/blog","miga_blog_txt":"Journal",
     "migas":[{"@type":"ListItem","position":1,"name":"Inicio","item":BASE+"/es/"},{"@type":"ListItem","position":2,"name":"Journal","item":BASE+"/es/blog"},{"@type":"ListItem","position":3,"name":h1,"item":BASE+"/"+slug}],
     "plantilla_url":PLANT[:-5],"plantilla_alt":alt_de(PLANT),"hreflang_alt":en_slug,"hero_img":hero,
     "prohibidas":["Is Cancun Safe for Luxury Travellers","luxury travellers"]}
def traducir_marco(o,d):
    o=o.replace("Skip to content","Saltar al contenido").replace("Back to Journal","Volver al Journal")
    o=o.replace("Director · IVAE Studios","Directora · IVAE Studios").replace("Director &middot; IVAE Studios","Directora &middot; IVAE Studios")
    o=re.sub(r"Based in Cancún, Vianey is[^<]*","Con base en Cancún, Vianey es la directora de IVAE Studios y su fotógrafa principal. Fotografía bodas, parejas y familias en Cancún y la Riviera Maya, y entrega la galería completa editada en uno a tres días hábiles.",o)
    o=o.replace("Now booking 2026 &amp; 2027","Agenda 2026 y 2027")
    o=re.sub(r"Planning a trip to Mexico\?\s*<em>\s*Let's talk light and dates\.\s*</em>","¿Planeas un viaje a México? <em>Hablemos de luz y fechas.</em>",o)
    o=re.sub(r"Tell the studio your dates and what you're celebrating\.[^<]*","Cuéntale al estudio tus fechas y qué celebran. Respondemos en un día hábil, en español o en inglés, con cómo se vería tu sesión y nuestra disponibilidad.",o)
    o=o.replace("Hello%2C%20I%27d%20like%20to%20talk%20about%20a%20Cancun%20photography%20session","Hola%2C%20quiero%20hablar%20de%20una%20sesi%C3%B3n%20en%20Canc%C3%BAn")
    o=o.replace("Message on WhatsApp","Escríbenos por WhatsApp")
    o=o.replace('href="/destination-wedding-photographer-mexico" style="background:transparent','href="/es/fotografo-bodas-destino-mexico" style="background:transparent').replace("See Luxury Weddings","Ver bodas de lujo")
    rel=('<section class="related"> <h3>Más del <em>blog</em></h3> <div class="related-grid"> <a class="rel-card" href="/es/blog/fotografia-hora-dorada-mexico"> <div class="rel-card-img" style="background:#c8bfb0;"></div> <span class="rel-tag">Luz</span> <p class="rel-title">Fotografía en Hora Dorada en México</p> </a> <a class="rel-card" href="/es/blog/que-ponerte-fotos-playa-mexico"> <div class="rel-card-img" style="background:#c8bfb0;"></div> <span class="rel-tag">Vestuario</span> <p class="rel-title">Qué Ponerte para Fotos de Playa en México</p> </a> <a class="rel-card" href="/es/blog/mejor-mes-fotografia-cancun"> <div class="rel-card-img" style="background:#c8bfb0;"></div> <span class="rel-tag">Temporada</span> <p class="rel-title">El Mejor Mes para Fotografía en Cancún</p> </a> </div> </section>')
    o=re.sub(r'<section class="related">.*?</section>',rel,o,count=1,flags=re.S)
    o=re.sub(r'<a href="[^"]*" data-lang-switch="en" hreflang="en" class="is-active" aria-current="true">EN</a>','<a href="%s/%s" data-lang-switch="en" hreflang="en">EN</a>'%(BASE,d["hreflang_alt"]),o)
    o=re.sub(r'<a href="[^"]*" data-lang-switch="es" hreflang="es">ES</a>','<a href="%s/%s" data-lang-switch="es" hreflang="es" class="is-active" aria-current="true">ES</a>'%(BASE,d["slug"]),o)
    return o
PROH=re.compile(r'lgbt|same.sex|gay\b|queer|lesbian',re.I)
def emitir(P):
    ok=[]
    for d in P:
        salida=d["slug"]+".html"; out=gen_post.generar(PLANT,d); out=traducir_marco(out,d)
        for ing in ("Skip to content","Planning a trip","Message on WhatsApp","More from the","Based in Canc","Now booking","See Luxury Weddings","Back to Journal","Director · IVAE","Director &middot; IVAE"): assert ing not in out,(salida,ing)
        assert d["h1"] in out and d["title"] in out and not PROH.search(out) and 'name="ai-' not in out and "—" not in out
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>',out,re.S): json.loads(m.group(1))
        for m in re.finditer(r'src="/images/([^"]+)\.jpg"',out): assert os.path.exists("images/%s.jpg"%m.group(1)),m.group(1)
        assert out.count('class="faq-q"')>=4 and out.count('class="il-link"')>=4
        os.makedirs(os.path.dirname(salida),exist_ok=True); open(salida,"w",encoding="utf-8").write(out); ok.append(salida)
        t=re.sub(r'<[^>]+>',' ',re.search(r'<article class="post-article".*?</article>',out,re.S).group(0)); print("  %-70s %4d palabras"%(salida,len(t.split())))
    return ok
def emparejar(pares):
    for en,es in pares:
        f=en+".html"; s=open(f,encoding="utf-8").read()
        m=re.search(r'<link rel="alternate" hreflang="es" href="([^"]*)"',s)
        if m: s=s.replace(m.group(0),'<link rel="alternate" hreflang="es" href="%s/%s"/>'%(BASE,es))
        else:
            a=re.search(r'<link rel="alternate" hreflang="en" href="[^"]*"/>',s) or re.search(r'<link rel="canonical" href="[^"]*"/>',s); s=s.replace(a.group(0),a.group(0)+'<link rel="alternate" hreflang="es" href="%s/%s"/>'%(BASE,es),1)
        s=re.sub(r'(<a href=")[^"]*(" data-lang-switch="es" hreflang="es">ES</a>)',lambda m:m.group(1)+BASE+"/"+es+m.group(2),s); open(f,"w",encoding="utf-8").write(s)
    p="scripts/update_sitemap.py"; s=open(p,encoding="utf-8").read(); ancla='    "welcome-dinner-rehearsal-wedding-photography": "fotografia-cena-bienvenida-ensayo-boda",'
    nuevos="".join('    "%s": "%s",\n'%(en[5:],es[8:]) for en,es in pares if '"%s"'%en[5:] not in s)
    if nuevos: s=s.replace(ancla,ancla+"\n"+nuevos.rstrip("\n")); open(p,"w",encoding="utf-8").write(s)

def emparejar_ambos(pares):
    """pares: [(slug_en, slug_es)] sin prefijo. Pone hreflang en/es/x-default y el switch de idioma en LAS DOS páginas y registra el par en el sitemap."""
    def poner(s, lang, url):
        m=re.search(r'<link rel="alternate" hreflang="%s" href="([^"]*)"\s*/?>'%lang, s)
        tag='<link rel="alternate" hreflang="%s" href="%s"/>'%(lang,url)
        if m: return s.replace(m.group(0), tag)
        a=re.search(r'<link rel="canonical" href="[^"]*"\s*/?>', s); return s.replace(a.group(0), a.group(0)+tag, 1)
    for en,es in pares:
        uen,ues=BASE+"/blog/"+en, BASE+"/es/blog/"+es
        for f,url_prop,lang_prop in (("blog/%s.html"%en, ues, "es"), ("es/blog/%s.html"%es, uen, "en")):
            s=open(f,encoding="utf-8").read()
            s=poner(s, lang_prop, url_prop); s=poner(s, "x-default", uen)
            s=re.sub(r'(<a href=")[^"]*(" data-lang-switch="%s" hreflang="%s")'%(lang_prop,lang_prop), lambda m:m.group(1)+url_prop+m.group(2), s)
            assert s.count('hreflang="%s"'%lang_prop)>=1 and s.count('hreflang="x-default"')==1, f
            open(f,"w",encoding="utf-8").write(s)
    p="scripts/update_sitemap.py"; s=open(p,encoding="utf-8").read(); ancla='    "welcome-dinner-rehearsal-wedding-photography": "fotografia-cena-bienvenida-ensayo-boda",'
    nuevos="".join('    "%s": "%s",\n'%(en,es) for en,es in pares if '"%s"'%en not in s)
    if nuevos: s=s.replace(ancla,ancla+"\n"+nuevos.rstrip("\n")); open(p,"w",encoding="utf-8").write(s)
    return len(pares)
