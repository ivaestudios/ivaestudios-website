#!/usr/bin/env python3
"""Arma la versión blanca del sitio de fotografía en una carpeta aparte (overlay), sin tocar el repo."""
import os, re, sys, glob, subprocess, shutil
sys.path.insert(0, os.path.dirname(__file__))
import blanquear as B
REPO = "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"
OUT = sys.argv[1] if __name__ == "__main__" and len(sys.argv) > 1 else None
SOLO = sys.argv[2].split(",") if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] else None
EXCLUIR_CSS = {"imkt-toque.css", "marketing-blog.css"}

def escribir(rel, txt):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(txt)

# 1) colores base: crema y arena pasan a blanco
def tokens(css):
    # fondos crema/arena definidos como variable: pasan a blanco (o a un blanco apenas cálido)
    def rep(m):
        name, val = m.group(1), m.group(2)
        h = val.lstrip("#")
        if len(h) == 3: h = "".join(c*2 for c in h)
        r, g, bb = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        if re.search(r"paper|cream|crema|sand|surface|bg|bone|linen|stone|ivory", name) and (r+g+bb)/3 > 200 and r >= bb:
            return f"{name}: {B._a_blanco(r,g,bb)}"
        return m.group(0)
    return re.sub(r"(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b", rep, css)

def css_completo(css):
    return B.transformar(tokens(css))

def main():
    global OUT, SOLO
    hojas = [h for h in glob.glob(os.path.join(REPO, "styles", "*.css")) if os.path.basename(h) not in EXCLUIR_CSS]
    hojas.append(os.path.join(REPO, "js", "lang-switcher.css"))
    for h in hojas:
        rel = os.path.relpath(h, REPO)
        escribir(rel, css_completo(open(h).read()))

    # arreglos que el convertidor no puede deducir (van al final de site-header.css, que cargan 600 páginas)
    EXTRA = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra-blanco.css")).read()
    p = os.path.join(OUT, "styles", "site-header.css"); open(p, "a").write("\n" + EXTRA)

    # 2) se apaga el modo oscuro
    escribir("dark-mode.js", """/* IVAE Studios: base blanca (2026-10). El modo oscuro se retiró por petición:
       este script solo quita la clase .dark si alguien la trae guardada. */
    (function () {
      'use strict';
      // Los artículos de IVAE Marketing que viven en /blog/ conservan su tema oscuro (otra marca).
      if (document.querySelector('link[href*="imkt-toque"],link[href*="marketing-blog"]')) {
        document.documentElement.classList.add('dark');
        return;
      }
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('ivae-theme', 'light'); } catch (e) {}
    })();
    """)

    # 3) páginas: <style> en línea, style="" y el script que ponía .dark
    files = subprocess.run(["git", "ls-files", "*.html"], cwd=REPO, capture_output=True, text=True).stdout.split()
    n = 0
    for f in files:
        if SOLO and f not in SOLO: continue
        s = open(os.path.join(REPO, f), errors="ignore").read()
        if "dark-mode.css" not in s: continue
        if "imkt-toque.css" in s or "marketing-blog.css" in s: continue  # IVAE Marketing: otra marca, se queda como está
        o = s
        s = s.replace("document.documentElement.classList.add('dark')", "document.documentElement.classList.remove('dark')")
        s = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", lambda m: m.group(1) + css_completo(m.group(2)) + m.group(3), s, flags=re.S)
        def attr(m):
            tag = m.group(0)
            cl = re.search(r'class="([^"]*)"', tag)
            sel = "." + cl.group(1).split()[0] if cl and cl.group(1).split() else m.group(1)
            return re.sub(r'style="([^"]*)"', lambda st: 'style="' + B.transformar_cuerpo(st.group(1), sel) + '"', tag)
        s = re.sub(r"<([a-zA-Z0-9]+)\b[^>]*\sstyle=\"[^\"]*\"[^>]*>", attr, s)
        if s != o:
            escribir(f, s); n += 1
    print("hojas:", len(hojas), "páginas cambiadas:", n)


if __name__ == "__main__":
    main()
