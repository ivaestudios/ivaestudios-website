#!/usr/bin/env python3
"""Genera marketing/css/theme-galeria-oscuro.css a partir de theme-galeria.css.

Vianey (13-nov-2026): "la versión de oscuros no está bien". El diseño Galería
vivía solo en el tema claro; en oscuro seguía el diseño viejo. En vez de
escribir a mano 200 reglas paralelas (que se desincronizan al primer cambio),
este script copia CADA regla del claro y cambia sus colores por su par de
noche. Si se edita theme-galeria.css, se vuelve a correr y listo:

    python3 scripts/generar_galeria_oscuro.py

El tema oscuro de la app es el que NO lleva data-theme (ver js/shell/theme.js),
por eso el prefijo pasa de [data-theme="light"] a :not([data-theme="light"]).
"""
import re, sys, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRA = RAIZ / 'marketing/css/theme-galeria.css'
SALE = RAIZ / 'marketing/css/theme-galeria-oscuro.css'

TINTA, PAPEL = '#F2F2EE', '#141415'   # en la noche se invierten
PAR = {
    '#0F0F10': TINTA,
    '#F4F4F1': '#1F1F21', '#FAFAF8': '#19191A',
    '#E7E7E4': '#2B2B2E', '#D6D6D2': '#3B3B3F', '#B9B9B4': '#56565B', '#8C8C87': '#6C6C71',
    '#62625F': '#A3A39D', '#45453F': '#CFCFC9',
    '#B5307C': '#C2408A', '#8E2462': '#D35C9F',
    '#B3261E': '#F0716A', '#1E6B52': '#5CC497', '#A15C00': '#E3A452', '#6B3FA0': '#B494EC',
    '#1F5FBF': '#7FAAF2', '#9C2C6B': '#E27BB2', '#0E6E7E': '#5DC3D1',
    '#8A6A1F': '#D4AF5A', '#6E5418': '#E2C27A',
}
RGBA = {
    (15, 15, 16, '.14'): 'rgba(0, 0, 0, .55)',
    (15, 15, 16, '.18'): 'rgba(0, 0, 0, .6)',
    (15, 15, 16, '.04'): 'rgba(255, 255, 255, .04)',
    (181, 48, 124, '.06'): 'rgba(194, 64, 138, .16)',
    (181, 48, 124, '.18'): 'rgba(194, 64, 138, .38)',
    (138, 106, 31, '.06'): 'rgba(212, 175, 90, .12)',
}

def luminancia(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# Texto blanco cuyo fondo vive en OTRA regla (un ::after de tinta, p. ej.):
# de noche ese fondo se vuelve claro, así que el texto pasa a oscuro.
TEXTO_OSCURO_EN = ('.bj-etapas__paso.is-hecho',)

def mapear_valor(prop, valor, fondo_noche, forzar_oscuro):
    def hexa(m):
        h = m.group(0).upper()
        if h == '#FFFFFF':
            if prop in ('color', '-webkit-text-fill-color'):
                # Blanco como TEXTO: se elige el que más contraste dé contra el
                # fondo de noche de la misma regla (blanco sobre color de marca;
                # oscuro sobre tinta invertida o sobre un rojo/verde de noche).
                if forzar_oscuro:
                    return PAPEL
                if fondo_noche:
                    return '#FFFFFF' if contraste('#FFFFFF', fondo_noche) >= contraste(PAPEL, fondo_noche) else PAPEL
                return '#FFFFFF'
            return PAPEL   # blanco como fondo, borde o anillo = papel de noche
        if h in PAR:
            return PAR[h]
        print(f'  ⚠ color sin par de noche: {h} en {prop}', file=sys.stderr)
        return m.group(0)
    v = re.sub(r'#[0-9a-fA-F]{6}\b', hexa, valor)
    def rgba(m):
        clave = (int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4))
        if clave in RGBA:
            return RGBA[clave]
        print(f'  ⚠ rgba sin par de noche: {m.group(0)}', file=sys.stderr)
        return m.group(0)
    v = re.sub(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)', rgba, v)
    return v

def mapear_bloque(selector, cuerpo):
    decls = [d for d in re.split(r';(?![^(]*\))', cuerpo)]
    # Fondo de la regla, ya en su color de noche (para decidir el texto blanco).
    fondo_noche = None
    for d in decls:
        m = re.match(r'\s*background(?:-color)?\s*:\s*(.*)$', d, re.S)
        if m:
            h = re.search(r'#[0-9a-fA-F]{6}\b', m.group(1))
            if h:
                x = h.group(0).upper()
                fondo_noche = PAPEL if x == '#FFFFFF' else PAR.get(x, x)
    forzar = any(t in selector for t in TEXTO_OSCURO_EN)
    salida = []
    for d in decls:
        m = re.match(r'(\s*)([-\w]+)(\s*:\s*)(.*)$', d, re.S)
        if not m:
            salida.append(d); continue
        salida.append(m.group(1) + m.group(2) + m.group(3) + mapear_valor(m.group(2).lower(), m.group(4), fondo_noche, forzar))
    return ';'.join(salida)

def main():
    css = ENTRA.read_text()
    # 1) Comentarios fuera (se guardan y se reponen intactos).
    comentarios = []
    def guarda(m):
        comentarios.append(m.group(0)); return f'/*@@{len(comentarios)-1}@@*/'
    css = re.sub(r'/\*.*?\*/', guarda, css, flags=re.S)
    # 2) Prefijo del tema.
    css = css.replace('[data-theme="light"]', ':not([data-theme="light"])')
    # 3) Colores, bloque por bloque (solo los bloques más internos llevan declaraciones).
    css = re.sub(r'([^{}]*)\{([^{}]*)\}', lambda m: m.group(1) + '{' + mapear_bloque(m.group(1), m.group(2)) + '}', css)
    # 4) Comentarios de vuelta.
    css = re.sub(r'/\*@@(\d+)@@\*/', lambda m: comentarios[int(m.group(1))], css)
    cabeza = ('/* ============================================================================\n'
              '   GENERADO por scripts/generar_galeria_oscuro.py desde theme-galeria.css.\n'
              '   NO editar a mano: cambiar el claro y volver a correr el script.\n'
              '   Diseño Galería en el tema OSCURO (13-nov-2026, Vianey: "la versión de\n'
              '   oscuros no está bien"): mismas reglas que el claro, colores de noche.\n'
              '   ============================================================================ */\n\n')
    SALE.write_text(cabeza + css)
    print(f'escrito {SALE.relative_to(RAIZ)} · {css.count("{")} llaves')

if __name__ == '__main__':
    main()
