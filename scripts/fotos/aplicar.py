#!/usr/bin/env python3
"""Pone en las páginas la descripción VERDADERA de cada foto (atributo alt) y los pies de la
galería de bodas de Cancún.

Por qué existe (12-nov-2026): las descripciones de las fotos se habían escrito a partir del
NOMBRE del archivo, no de la foto. El archivo `wedding-bride-cancun-hotel-zone-ivae-studios-8`
es un mariachi con una pareja abriendo champaña y su descripción decía "novia en la Zona
Hotelera en hora dorada"; otras nombraban hoteles, fechas y campañas que la foto no muestra
("Proposal at Le Blanc Spa", "Hotel Esencia, marzo 2026", "regional spirits launch").
`scripts/fotos/descripciones.py` guarda lo que se ve en cada foto, mirada una por una.

Reglas: la descripción dice lo que se ve. Sin hotel, sin fecha y sin ocasión que no se vea.
Para sumar fotos: mirarlas, agregarlas a descripciones.py y correr este guion.

Uso (desde la raíz del repo):
    python3 scripts/fotos/aplicar.py .            # solo cuenta
    python3 scripts/fotos/aplicar.py . --aplicar  # escribe
"""
import sys, re, html, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from descripciones import D, PIES_EN, PIES_ES
WS = sys.argv[1]; APLICAR = '--aplicar' in sys.argv
TAM = r'(?:-(?:480|768|960|1200|1920|2400))?\.(?:jpe?g|webp|avif|png)$'
def base_de(src): return re.sub(TAM, '', src.split('/')[-1].split('?')[0])
def esc(s): return s.replace('&', '&amp;').replace('"', '&quot;')
PAGINAS = ['cancun-wedding-photographer.html','es/fotografo-bodas-cancun.html','destination-wedding-photographer-mexico.html','es/fotografo-bodas-destino-mexico.html','cancun-photographer.html','es/fotografo-cancun.html','couples-photography-mexico.html','es/fotografia-parejas-mexico.html','luxury-editorial.html','es/editorial-de-lujo.html','riviera-maya-photographer.html','es/fotografo-riviera-maya.html','cabo-photographer.html','es/fotografo-los-cabos.html','about.html','es/acerca-de.html','mayakoba-wedding-photographer.html','riviera-maya-wedding-photographer.html']
GALERIAS = {'cancun-wedding-photographer.html': PIES_EN, 'es/fotografo-bodas-cancun.html': PIES_ES}
resumen = []
for pag in PAGINAS:
    ruta = os.path.join(WS, pag); t = open(ruta, encoding='utf-8').read(); orig = t
    es = pag.startswith('es/'); n_alt = 0; n_pie = 0
    def cambia_img(m):
        global n_alt
        tag = m.group(0)
        s = re.search(r'\bsrc="([^"]+)"', tag)
        if not s: return tag
        b = base_de(s.group(1))
        if b not in D: return tag
        nuevo = esc(D[b][1 if es else 0])
        a = re.search(r'\balt="([^"]*)"', tag)
        if not a or a.group(1) == nuevo: return tag
        n_alt += 1
        return tag[:a.start()] + 'alt="' + nuevo + '"' + tag[a.end():]
    t = re.sub(r'<img\b[^>]*>', cambia_img, t, flags=re.S)
    if pag in GALERIAS:
        pies = GALERIAS[pag]; figs = list(re.finditer(r'<figure[^>]*>.*?</figure>', t, re.S))
        assert len(figs) == len(pies), (pag, len(figs), len(pies))
        partes = []; ult = 0
        for f, pie in zip(figs, pies):
            bloque = f.group(0)
            if pie is not None:
                c = re.search(r'(<figcaption[^>]*>)(.*?)(</figcaption>)', bloque, re.S)
                assert c, (pag, bloque[:80])
                if html.unescape(re.sub(r'<[^>]+>', '', c.group(2))).strip() != pie:
                    bloque = bloque[:c.start(2)] + esc(pie).replace('&quot;', '"') + bloque[c.end(2):]; n_pie += 1
            partes.append(t[ult:f.start()]); partes.append(bloque); ult = f.end()
        partes.append(t[ult:]); t = ''.join(partes)
    if t != orig:
        resumen.append((pag, n_alt, n_pie))
        if APLICAR: open(ruta, 'w', encoding='utf-8').write(t)
for pag, a, p in resumen: print(f'{a:3} alts  {p:2} pies  {pag}')
print(len(resumen), 'paginas ·', sum(r[1] for r in resumen), 'alts ·', sum(r[2] for r in resumen), 'pies', '(APLICADO)' if APLICAR else '(solo conteo)')
