#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprueba que las paginas que traen cierto componente carguen la hoja que
lo hace funcionar.

POR QUE EXISTE (2026-09-13). Nueve paginas llevaban la burbuja flotante de
WhatsApp en el HTML y NO cargaban styles/wa-fab.css. Sin esa hoja el
enlace no es `position:fixed` ni redondo: se queda en el flujo del
documento y sale como una TIRA de 402x19 px del ancho de la pantalla, con
el icono estirado. Medido en WebKit. Y no es un adorno: el 990 204 6514 es
el numero por el que escriben los clientes.

POR QUE LA LISTA ES CORTA A PROPOSITO. La primera version de este script
comparaba "clase presente" contra "hoja cargada" para media docena de
componentes y casi todo eran FALSOS POSITIVOS:

  · `faq-visible` en las paginas de IVAE Marketing no es el bloque de
    preguntas, es una clase de ANIMACION (`.faq-item.faq-visible`);
  · index.html no carga site-footer.css porque define `.colophon` EN LINEA
    diecinueve veces;
  · las paginas *-preview* traen su propio encabezado embebido.

O sea: que una pagina no cargue la hoja NO prueba que el componente este
roto, porque el estilo puede venir de otro lado. Por eso aqui solo entran
parejas donde se ha COMPROBADO que la hoja es la unica fuente de estilo y
que sin ella el componente se rompe de forma visible. Antes de anadir una
pareja nueva, medirla en el navegador.

Uso:
    python3 scripts/auditar_hoja_del_componente.py
    python3 scripts/auditar_hoja_del_componente.py --fail-on-missing
"""
import argparse
import glob
import os
import sys

# (marca en el HTML, hoja que la estiliza, que pasa sin ella)
PAREJAS = [
    ("ivae-wa-fab", "wa-fab.css",
     "la burbuja de WhatsApp sale como una tira de 402x19 en vez de un boton"),
]

SALTAR = ("_backups", "node_modules", ".git")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), ".."))
    ap.add_argument("--fail-on-missing", action="store_true")
    args = ap.parse_args()
    raiz = os.path.abspath(args.root)

    print("=== COMPONENTES SIN SU HOJA ===\n")
    rotas = 0
    for marca, hoja, consecuencia in PAREJAS:
        sin = []
        con = 0
        for ruta in glob.glob(os.path.join(raiz, "**/*.html"), recursive=True):
            rel = os.path.relpath(ruta, raiz)
            if any(x in rel for x in SALTAR):
                continue
            try:
                with open(ruta, encoding="utf-8", errors="ignore") as fh:
                    s = fh.read()
            except OSError:
                continue
            if marca not in s:
                continue
            if hoja in s:
                con += 1
            else:
                sin.append(rel)
        estado = "ROTAS" if sin else " OK  "
        print(f"[{estado}] .{marca} -> {hoja}   ({con} bien, {len(sin)} sin la hoja)")
        if sin:
            print(f"         sin ella, {consecuencia}")
            for f in sin:
                print(f"           - {f}")
            rotas += len(sin)
        print()

    if rotas and args.fail_on_missing:
        print(f"FALLO: {rotas} paginas traen un componente sin la hoja que lo estiliza.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
