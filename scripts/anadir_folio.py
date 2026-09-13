#!/usr/bin/env python3
"""Anade una galeria real (<section class="folio">) a una landing generada.

POR QUE EXISTE
Medido el 2026-09-13: las paginas de servicio que Google SI indexa llevan de 32
a 42 imagenes; las que deja en "Crawled - currently not indexed" llevan de 2 a 6.
La plantilla de landings (quinceanera) no trae ninguna seccion de fotos, asi que
toda pagina generada con ella nacia con 2 imagenes. Esto lo arregla.

Inyecta el CSS una sola vez por pagina y la seccion despues de .spots.
Solo usa imagenes con juego completo de variantes optimizadas.
"""
import os
import re
import struct

TAM = [480, 768, 1200, 1920, 2400]

CSS = """
.folio{padding:90px 64px;background:var(--ink);color:var(--cream)}
.folio .section-label{color:var(--gold)}
.folio .sec-h{color:var(--cream)}
.folio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:48px}
.folio-grid figure{margin:0;position:relative;overflow:hidden;aspect-ratio:4/3;background:var(--ink2)}
.folio-grid figure.tall{aspect-ratio:3/4}
.folio-grid img{width:100%;height:100%;object-fit:cover;display:block}
.folio-grid figcaption{position:absolute;left:0;right:0;bottom:0;padding:16px 18px;font-size:11px;letter-spacing:0.04em;color:var(--cream);background:linear-gradient(to top,rgba(12,18,25,0.82),rgba(12,18,25,0))}
@media(max-width:900px){.folio{padding:64px 24px}.folio-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.folio-grid{grid-template-columns:1fr}}
"""


def completas(base_dir="images"):
    """OJO: esto mira el DISCO, y images/optimized/ esta en .gitignore.
    Una foto puede tener aqui su juego completo y no llegar NUNCA al sitio;
    entonces la <source> da 404 y, como una <source> rota NO cae al <img>,
    la foto sale ROTA. Tras generar, correr
    scripts/auditar_variantes_optimizadas.py y subir lo que falte con add -f.
    """
    opt = set(os.listdir(os.path.join(base_dir, "optimized")))
    return {f[:-4] for f in os.listdir(base_dir)
            if f.endswith(".jpg")
            and all(f"{f[:-4]}-{t}.avif" in opt and f"{f[:-4]}-{t}.webp" in opt for t in TAM)}


def medidas(nombre, base_dir="images"):
    """Ancho y alto reales del JPEG, leyendo la cabecera SOF."""
    ruta = os.path.join(base_dir, nombre + ".jpg")
    try:
        with open(ruta, "rb") as f:
            f.read(2)
            while True:
                b = f.read(1)
                while b and b != b"\xff":
                    b = f.read(1)
                m = f.read(1)
                if not m:
                    return None
                if m[0] in range(0xC0, 0xCF) and m[0] not in (0xC4, 0xC8, 0xCC):
                    f.read(3)
                    alto, ancho = struct.unpack(">HH", f.read(4))
                    return ancho, alto
                largo = struct.unpack(">H", f.read(2))[0]
                f.read(largo - 2)
    except Exception:
        return None


def figura(nombre, alt, pie, tall=None):
    """El marco lo decide LA FOTO, no la posicion en la lista.

    El 2026-09-13 se midieron 21 figuras mal encuadradas en 7 paginas: el
    `tall` se pasaba a mano y cayo sobre fotos horizontales, que quedaban
    metidas en un marco 3/4, y sobre verticales que quedaban en uno 4/3.
    Con object-fit:cover eso **se come el 50% del encuadre**: en una pagina
    de fotografo, media foto. Ahora `tall` se deduce de la forma real del
    archivo salvo que quien llame imponga un valor.

    El width/height tambien salia clavado en 1600x1067 para todas, asi que
    una vertical declaraba proporcion de horizontal.
    """
    def ss(ext):
        return ", ".join(f"/images/optimized/{nombre}-{t}.{ext} {t}w" for t in TAM)
    d = medidas(nombre)
    if tall is None:
        tall = bool(d) and d[1] > d[0]
    ancho, alto = d if d else (1600, 1067)
    cl = ' class="tall"' if tall else ""
    return (f'<figure{cl}><picture>'
            f'<source type="image/avif" srcset="{ss("avif")}" sizes="(max-width:560px) 100vw, (max-width:900px) 50vw, 33vw"/>'
            f'<source type="image/webp" srcset="{ss("webp")}" sizes="(max-width:560px) 100vw, (max-width:900px) 50vw, 33vw"/>'
            f'<img src="/images/{nombre}.jpg" alt="{alt}" loading="lazy" decoding="async" width="{ancho}" height="{alto}"/>'
            f'</picture><figcaption>{pie}</figcaption></figure>')


def anadir(fichero, etiqueta, titulo, seleccion):
    s = open(fichero, encoding="utf-8").read()
    if 'class="folio"' in s:
        return None, "ya tiene galeria"
    if ".folio-grid{" not in s:
        j = s.rfind("</style>")
        if j < 0:
            return None, "sin <style> donde inyectar el CSS"
        s = s[:j] + CSS + s[j:]
    figs = "".join(figura(*x) for x in seleccion)
    sec = (f'<section class="folio"><div class="wrap">'
           f'<span class="section-label rv" data-anim="fade">{etiqueta}</span>'
           f'<h2 class="sec-h rv d1" data-anim="fade">{titulo}</h2>'
           f'<div class="folio-grid rv d2" data-anim="fade">{figs}</div></div></section>')
    m = re.search(r'<section class="spots".*?</section>', s, re.S)
    if not m:
        m = re.search(r'<section class="services".*?</section>', s, re.S)
    if not m:
        return None, "no encuentro donde colocarla"
    s = s[:m.end()] + sec + s[m.end():]
    open(fichero, "w", encoding="utf-8").write(s)
    return len(seleccion), None
