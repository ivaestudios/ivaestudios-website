#!/usr/bin/env python3
"""Pasa TODO el sitio de fotografía a base blanca con acentos azul marino, sin tocar IVAE Marketing ni el SEO.

  python3 scripts/base-blanca/publicar_sitio.py construir <carpeta>   arma la versión blanca aparte (para revisar con srv_overlay.py)
  python3 scripts/base-blanca/publicar_sitio.py aplicar <carpeta>     la copia sobre el repo y quita las hojas que solo usaba la home

Qué hace:
- Hojas compartidas de fotografía: se convierten EN SU LUGAR (blanquear.py) y se les pone sello ?v= nuevo en todas las páginas.
- Páginas de fotografía (cargan dark-mode.css, no son de marketing): <style> y style="" convertidos; el script en línea quita .dark.
- dark-mode.js: quita .dark, salvo en los artículos de IVAE Marketing que viven en /blog/ (lo conservan).
- IVAE Marketing (imkt-toque.css / marketing-blog.css, o páginas de marketing que cargan hojas compartidas): se apuntan a COPIAS
  CONGELADAS de las hojas originales (sufijo -marketing), así se quedan exactamente como estaban.
- La home se reconstruye desde su versión anterior al blanco (commit 1aa313f96) para que pase por el mismo convertidor."""
import os, re, sys, shutil, subprocess
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
import blanquear as B
import construir_overlay as C
REPO = os.path.dirname(os.path.dirname(AQUI))
SELLO = "20261009a"
HOME_ORIGEN = "1aa313f96"
NO_CONVERTIR = {"imkt-toque.css", "marketing-blog.css", "wa-fab.css"}
SOLO_HOME = ["styles/tokens-blanco.css", "styles/site-header-blanco.css", "styles/mobile-exclusive-blanco.css", "js/lang-switcher-blanco.css", "styles/home-acentos.css"]
MARKETING_EXTRA = {"social-media-management.html", "marketing-about.html", "es/manejo-redes-sociales.html", "es/sobre-ivae-marketing.html"}

def git(*a): return subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True).stdout
def leer(rel):
    if rel in ("index.html", "es/index.html"):
        return git("show", f"{HOME_ORIGEN}:{rel}")
    return open(os.path.join(REPO, rel), errors="ignore").read()
def escribir(out, rel, txt):
    p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(txt)

def construir(out):
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    extra = open(os.path.join(AQUI, "extra-blanco.css")).read()
    # 1) hojas compartidas
    hojas = [f"styles/{h}" for h in os.listdir(os.path.join(REPO, "styles")) if h.endswith(".css") and h not in NO_CONVERTIR and not h.endswith(("-blanco.css", "-marketing.css")) and h != "home-acentos.css"] + ["js/lang-switcher.css"]
    cambiadas = []
    for h in sorted(hojas):
        orig = open(os.path.join(REPO, h)).read()
        nuevo = C.css_completo(orig)
        if h == "styles/site-header.css": nuevo += "\n" + extra
        if nuevo != orig:
            escribir(out, h, nuevo); cambiadas.append(h)
    # 2) dark-mode.js
    dm = """/* IVAE Studios: base blanca (2026-10). El modo oscuro se retiró por petición.
   Los artículos de IVAE Marketing que viven en /blog/ conservan su tema oscuro (otra marca). */
(function () {
  'use strict';
  if (document.querySelector('link[href*="imkt-toque"],link[href*="marketing-blog"]')) {
    document.documentElement.classList.add('dark');
    return;
  }
  document.documentElement.classList.remove('dark');
  try { localStorage.setItem('ivae-theme', 'light'); } catch (e) {}
})();
"""
    escribir(out, "dark-mode.js", dm); cambiadas.append("dark-mode.js")
    # 3) páginas
    files = git("ls-files", "*.html").split()
    congelar = set(); n_foto = n_mkt = 0
    def sellar(s, solo=None):
        for h in cambiadas:
            if solo is not None and h not in solo: continue
            pat = r'((?:href|src)="/' + re.escape(h) + r')(\?v=[^"]*)?"'
            s = re.sub(pat, lambda m: f'{m.group(1)}?v={SELLO}"', s)
        return s
    for f in files:
        s = leer(f); o = open(os.path.join(REPO, f), errors="ignore").read()
        es_mkt = ("imkt-toque.css" in s or "marketing-blog.css" in s or f in MARKETING_EXTRA)
        if es_mkt:
            usadas = [h for h in cambiadas if h.endswith(".css") and re.search(r'(href)="/' + re.escape(h) + r'(\?v=[^"]*)?"', s)]
            for h in usadas:
                copia = h[:-4] + "-marketing.css"; congelar.add((h, copia))
                s = re.sub(r'href="/' + re.escape(h) + r'(\?v=[^"]*)?"', f'href="/{copia}?v={SELLO}"', s)
            s = sellar(s, solo={"dark-mode.js"})
            if s != o: escribir(out, f, s); n_mkt += 1
            continue
        if "dark-mode.css" not in s:
            s2 = sellar(s)  # p. ej. vacantes.html: solo cambia el sello de la hoja compartida
            if s2 != o: escribir(out, f, s2)
            continue
        s = s.replace("document.documentElement.classList.add('dark')", "document.documentElement.classList.remove('dark')")
        s = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", lambda m: m.group(1) + C.css_completo(m.group(2)) + m.group(3), s, flags=re.S)
        def attr(m):
            tag = m.group(0); cl = re.search(r'class="([^"]*)"', tag)
            sel = "." + cl.group(1).split()[0] if cl and cl.group(1).split() else m.group(1)
            return re.sub(r'style="([^"]*)"', lambda st: 'style="' + B.transformar_cuerpo(st.group(1), sel) + '"', tag)
        s = re.sub(r"<([a-zA-Z0-9]+)\b[^>]*\sstyle=\"[^\"]*\"[^>]*>", attr, s)
        s = sellar(s)
        if s != o: escribir(out, f, s); n_foto += 1
    for h, copia in sorted(congelar):
        escribir(out, copia, "/* Copia CONGELADA de " + h + " antes de la base blanca (2026-10), para las páginas de IVAE Marketing. */\n" + open(os.path.join(REPO, h)).read())
    print(f"hojas convertidas: {len(cambiadas)-1} + dark-mode.js | páginas de fotografía: {n_foto} | páginas de marketing re-apuntadas: {n_mkt} | copias congeladas: {len(congelar)}")
    print("convertidas:", ", ".join(cambiadas))
    print("congeladas:", ", ".join(c for _, c in sorted(congelar)))

def aplicar(out):
    for raiz, _, archivos in os.walk(out):
        for a in archivos:
            src = os.path.join(raiz, a); rel = os.path.relpath(src, out)
            dst = os.path.join(REPO, rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(src, dst)
    for f in SOLO_HOME:
        p = os.path.join(REPO, f)
        if os.path.exists(p): os.remove(p)
    print("aplicado")

if __name__ == "__main__":
    {"construir": construir, "aplicar": aplicar}[sys.argv[1]](sys.argv[2])
