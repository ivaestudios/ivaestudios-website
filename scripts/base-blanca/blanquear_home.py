#!/usr/bin/env python3
"""Pasa SOLO la página de inicio (EN y ES) a base blanca, sin tocar las hojas que comparte con otras páginas.

Genera copias blancas de las hojas que carga la home (sufijo -blanco) y reescribe index.html y es/index.html:
estilos en línea convertidos, el script que forzaba .dark en línea pasa a quitarla, y fuera dark-mode.js.
Uso: python3 scripts/base-blanca/blanquear_home.py   (desde la raíz del repo)"""
import os, re, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import blanquear as B
import construir_overlay as C  # solo para tokens(); su bloque principal no corre al importarlo
REPO = os.path.dirname(os.path.dirname(AQUI))
SELLO = "20261007a"
HOJAS = {  # original -> copia blanca
    "styles/tokens.css": "styles/tokens-blanco.css",
    "styles/site-header.css": "styles/site-header-blanco.css",
    "js/lang-switcher.css": "js/lang-switcher-blanco.css",
    "styles/mobile-exclusive-v2.css": "styles/mobile-exclusive-blanco.css",
}
EXTRA = open(os.path.join(AQUI, "extra-blanco.css")).read()
cab = "/* GENERADO por scripts/base-blanca/blanquear_home.py a partir de {src}: no editar a mano. */\n"
for src, dst in HOJAS.items():
    css = C.css_completo(open(os.path.join(REPO, src)).read())
    if dst.endswith("site-header-blanco.css"):
        css += "\n" + EXTRA
    open(os.path.join(REPO, dst), "w").write(cab.format(src=src) + css)
for pagina in ("index.html", "es/index.html"):
    p = os.path.join(REPO, pagina); s = open(p).read()
    s = s.replace("document.documentElement.classList.add('dark')", "document.documentElement.classList.remove('dark')")
    s = re.sub(r'\s*<script src="/dark-mode\.js[^"]*"[^>]*></script>', "", s)
    s = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", lambda m: m.group(1) + C.css_completo(m.group(2)) + m.group(3), s, flags=re.S)
    def attr(m):
        tag = m.group(0); cl = re.search(r'class="([^"]*)"', tag)
        sel = "." + cl.group(1).split()[0] if cl and cl.group(1).split() else m.group(1)
        return re.sub(r'style="([^"]*)"', lambda st: 'style="' + B.transformar_cuerpo(st.group(1), sel) + '"', tag)
    s = re.sub(r"<([a-zA-Z0-9]+)\b[^>]*\sstyle=\"[^\"]*\"[^>]*>", attr, s)
    for src, dst in HOJAS.items():
        s = re.sub(r'href="/' + re.escape(src) + r'(\?v=[^"]*)?"', f'href="/{dst}?v={SELLO}"', s)
    open(p, "w").write(s)
print("listo")
