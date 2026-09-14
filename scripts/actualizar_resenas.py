#!/usr/bin/env python3
"""Pone la MISMA cifra de resenas de Google en todos lados.

POR QUE EXISTE
El 2026-09-14 el sitio declaraba TRES cifras distintas a la vez: el JSON-LD
decia 63, facts.json 63 y llms.txt 62, mientras la ficha real iba en 64. Las
IAs citan estos numeros textualmente (ChatGPT llego a decir "42 resenas" de
un cache viejo), asi que una cifra incoherente se convierte en una cita
equivocada y en una senal de descuido.

La cifra se lee de la ficha de Google (maps: "5,0(N)"), no se inventa.

  python3 scripts/actualizar_resenas.py 64
"""
import glob
import json
import re
import sys

def main(nueva):
    tocados = {"html": 0, "json": 0, "txt": 0}

    # 1) JSON-LD y texto visible en las paginas
    pat_ld = re.compile(r'("reviewCount"\s*:\s*"?)(\d+)("?)')
    pat_tx = re.compile(r'\b(\d+)(\s+(?:reviews|reseñas|resenas|opiniones)\b)', re.I)
    for f in glob.glob("**/*.html", recursive=True):
        if "node_modules" in f:
            continue
        s = open(f, encoding="utf-8", errors="ignore").read()
        o = s
        s = pat_ld.sub(lambda m: m.group(1) + str(nueva) + m.group(3), s)
        # solo si la frase habla de Google/la ficha, para no pisar otras cifras
        def tx(m):
            """Solo toca la cifra si la frase habla de IVAE.

            La guarda anterior pedia "Google" o "rating" cerca, y eso barrio
            cifras de OTROS negocios en el blog: "un clinica con 38 resenas",
            "un flujo de 8 a 12 resenas nuevas al mes". Quedaron frases sin
            sentido. Ahora se exige la marca, o la cifra actual, en la ventana.
            """
            ini, fin = max(0, m.start() - 220), m.end() + 160
            ventana = s[ini:fin]
            if not re.search(r'IVAE', ventana, re.I):
                return m.group(0)
            if not re.search(r'Google|ficha|5\.0|5,0', ventana, re.I):
                return m.group(0)
            return str(nueva) + m.group(2)
        s = pat_tx.sub(tx, s)
        if s != o:
            open(f, "w", encoding="utf-8").write(s)
            tocados["html"] += 1

    # 2) hoja de datos
    p = "api/facts.json"
    d = json.load(open(p, encoding="utf-8"))
    d["aggregate_rating"]["review_count"] = nueva
    d["proof_points"]["google_rating"] = "5.0 across %d reviews (see aggregate_rating)" % nueva
    json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    tocados["json"] = 1

    # 3) hojas declarativas
    for p in ("llms.txt", "llms-full.txt"):
        try:
            s = open(p, encoding="utf-8").read()
        except FileNotFoundError:
            continue
        o = s
        s = re.sub(r'(Google rating: 5\.0 average across )\d+( reviews)',
                   lambda m: m.group(1) + str(nueva) + m.group(2), s)
        if s != o:
            open(p, "w", encoding="utf-8").write(s)
            tocados["txt"] += 1

    print("resenas -> %d   html:%d  facts.json:%d  llms:%d"
          % (nueva, tocados["html"], tocados["json"], tocados["txt"]))

if __name__ == "__main__":
    main(int(sys.argv[1]))
