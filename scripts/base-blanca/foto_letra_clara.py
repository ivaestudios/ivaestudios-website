#!/usr/bin/env python3
"""Devuelve la letra clara a las secciones con foto de fondo.

POR QUE EXISTE
El 9-oct-2026 el sitio se paso a blanco con scripts/base-blanca/blanquear.py. En las
secciones que el convertidor no reconocio como "de foto" (clases genericas como .hero
con .hero-bg) quito el velo oscuro y pinto la letra de oscuro, pero la foto se quedo
oscurecida por su filtro (brightness .2 a .55). Resultado: letra oscura sobre foto
oscura, ilegible. Se encontro el 12-nov-2026 y se arreglo por plantilla.

QUE HACE
Inserta un <style id="foto-letra-clara"> justo antes de </head> en cada pagina de la
lista. No toca texto, titulos, metas ni datos estructurados. Es idempotente: si el
bloque ya esta, lo reemplaza.

FAMILIAS
F1  .hero-bg img .38 + .cta-s .cta-bg img .30   (Los Cabos, cenotes, Mayakoba, bodas Riviera Maya)
F2  .hero-bg .55 + .cta-bg .50                  (familia de destino, multigeneracional)
F3  .hero-bg .46 + .cta-bg .40                  (reunion familiar)
F4  .hero-photo .46                             (Acerca de)
F6  .lc-hero                                    (parejas, escritorio)
F7  .lf-hero                                    (familias, escritorio)
F8  .lw-pause y .lw-inq2                        (frase sobre foto y cierre de consulta)
F9  .lw-hero .lw-meta-l                         (bodas de destino)
F10 .le-hero .le-eyebrow                        (editorial)
F11 .hero-bg con foto a brillo completo         (propuestas + las 81 paginas con la misma plantilla;
                                                 Vianey dio el OK el 12-nov-2026 y quedaron aplicadas)
F12 .jrn-feat y .jrn-mini (fotos al 62%)        (portada EN y ES, las tarjetas de "The Journal";
                                                 solo se ven en computadora)

Los bloques que llevan @media (min-width:769px) son plantillas cuyo celular ya tiene
su propio diseno (panel blanco y letra oscura con !important): no se toca.

COMO SE USA (desde la raiz del repo)
  python3 scripts/base-blanca/foto_letra_clara.py            # aplica y lista lo cambiado
  python3 scripts/base-blanca/foto_letra_clara.py --ver      # solo dice que cambiaria

COMO SE REVISA
Pegar scripts/base-blanca/escaner_letra_sobre_foto.js en la consola del navegador, en
computadora y en telefono. Ojo: no ve los velos puestos con ::before/::after ni las
fotos con pointer-events:none; lo que marque se confirma mirando la pagina.
"""
import hashlib
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

NOTA = "/* Foto oscurecida por filtro: la letra va clara y el velo vuelve en negro neutro (se perdio al pasar el sitio a blanco, 9-oct-2026) */"
F1 = NOTA + """
@media (min-width:769px){
.hero{background-color:#161616}
.hero .hero-tag{color:#ffffff}
.hero h1{color:#ffffff}
.hero h1 em{color:#ffffff}
.hero .hero-sub{color:rgba(255,255,255,.88)}
.hero .btn--outline{color:#ffffff;border-color:rgba(255,255,255,.6)}
}
.cta-s{background-color:#161616}
.cta-s .sc-tag{color:#ffffff}
.cta-s h2{color:#ffffff}
.cta-s h2 em{color:#ffffff}
.cta-s p{color:rgba(255,255,255,.88)}
.cta-s .btn--outline{color:#ffffff;border-color:rgba(255,255,255,.6)}
"""
F2 = NOTA + """
.hero,.cta{background-color:#161616}
.hero::after{background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.80) 100%)}
.hero .eyebrow{color:#ffffff}
.hero h1{color:#ffffff}
.hero h1 em{color:#ffffff}
.hero .hero-sub{color:rgba(255,255,255,.88)}
.hero .hero-btn{color:#ffffff;border-color:rgba(255,255,255,.6)}
.hero .hero-btn:hover{background:#ffffff;color:#1a1a1a}
.cta::after{background:linear-gradient(180deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.86) 100%)}
.cta h2{color:#ffffff}
.cta h2 em{color:#ffffff}
.cta p{color:rgba(255,255,255,.88)}
.cta .cta-btn{color:#ffffff;border-color:rgba(255,255,255,.6)}
.cta .cta-btn:hover{background:#ffffff;color:#1a1a1a}
"""
F3 = NOTA + """
.hero,.cta{background-color:#161616}
.hero::after{background:linear-gradient(160deg,rgba(0,0,0,.55),rgba(0,0,0,.15) 45%,rgba(0,0,0,.82))}
.hero .eyebrow{color:#ffffff}
.hero .eyebrow::after{background:#ffffff}
.hero h1{color:#ffffff}
.hero h1 em{color:#ffffff}
.hero .hero-sub{color:rgba(255,255,255,.88)}
.hero .btn-ghost,.cta .btn-ghost{color:#ffffff;border-color:rgba(255,255,255,.6)}
.hero .btn-ghost:hover,.cta .btn-ghost:hover{background:#ffffff;color:#1a1a1a}
.cta::after{background:linear-gradient(180deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.86) 100%)}
.cta h2{color:#ffffff}
.cta h2 em{color:#ffffff}
.cta p{color:rgba(255,255,255,.88)}
"""
F4 = NOTA + """
@media (min-width:769px){
.hero{background-color:#161616}
.hero .hero-chapter-label{color:#ffffff}
.hero .hero-chapter-title{color:rgba(255,255,255,.88)}
.hero .hero-byline{color:#ffffff}
.hero .hero-byline-name{color:#ffffff}
.hero .hero-h1{color:#ffffff}
.hero .hero-h1 em{color:#ffffff}
.hero .hero-sub::before{background:linear-gradient(to bottom,#ffffff,transparent)}
.hero .hero-sub p{color:rgba(255,255,255,.88)}
.hero .hero-meta{background:linear-gradient(180deg,transparent,rgba(0,0,0,.85));border-top-color:rgba(255,255,255,.22)}
.hero .hr-cell{border-right-color:rgba(255,255,255,.22)}
.hero .hr-n{color:#ffffff}
.hero .hr-l{color:rgba(255,255,255,.72)}
.hero .hero-cue{color:#ffffff}
}
"""
F6 = NOTA + """
@media (min-width:769px){
.lc-hero{background-color:#161616}
.lc-hero .lc-hero-overlay{background:linear-gradient(170deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.30) 45%,rgba(0,0,0,.78) 100%)}
.lc-hero .lc-hero-content .lc-eyebrow{color:#ffffff}
.lc-hero .lc-hero-content .lc-eyebrow::after{background:#ffffff}
.lc-hero .lc-hero-h1{color:#ffffff}
.lc-hero .lc-hero-h1 em.lc-h1__italic{color:#ffffff}
.lc-hero .lc-hero-sub{color:rgba(255,255,255,.88)}
.lc-hero .lc-hero-sub::before{background:#ffffff}
.lc-hero .lc-hero-byline{color:rgba(255,255,255,.88) !important}
.lc-hero .lc-hero-byline a{color:#ffffff !important;border-bottom-color:rgba(255,255,255,.45) !important}
.lc-hero .lc-availability{color:#ffffff}
.lc-hero .lc-availability--proposal{color:rgba(255,255,255,.88)}
.lc-hero .lc-availability--proposal::before{color:#ffffff}
.lc-hero .lc-hero-meta{color:rgba(255,255,255,.88)}
.lc-hero .lc-btn--ghost{color:#ffffff;border-color:rgba(255,255,255,.6)}
.lc-hero .lc-btn--ghost:hover{background:#ffffff;color:#1a1a1a}
}
"""
F7 = NOTA + """
@media (min-width:769px){
.lf-hero{background-color:#161616}
.lf-hero .lf-hero-overlay{background:linear-gradient(160deg,rgba(0,0,0,.55),rgba(0,0,0,.15) 45%,rgba(0,0,0,.78))}
.lf-hero .eyebrow{color:#ffffff}
.lf-hero .eyebrow::after{background:#ffffff}
.lf-hero .hero-h1,.lf-hero h1{color:#ffffff}
.lf-hero .hero-h1__italic{color:#ffffff}
.lf-hero .hero-sub{color:rgba(255,255,255,.88)}
.lf-hero .lf-availability{color:rgba(255,255,255,.88)}
.lf-hero a.btn-ghost{color:#ffffff !important;border-color:rgba(255,255,255,.6)}
.lf-hero a.btn-ghost:hover{background:#ffffff;color:#1a1a1a !important}
}
"""
F8 = """
.lw-pause{background-color:#161616}
.lw-pause .lw-pause-veil{background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.65))}
.lw-pause .lw-pause-line{color:#ffffff}
.lw-pause .lw-pause-line em{color:#ffffff}
.lw-inq2{background-color:#161616}
.lw-inq2 .lw-inq2-veil{background:linear-gradient(180deg,rgba(0,0,0,.4) 0%,rgba(0,0,0,.65) 60%,rgba(0,0,0,.8) 100%)}
.lw-inq2 .lw-inq2-content{color:#ffffff}
.lw-inq2 .lw-inq2-eyebrow{color:#ffffff}
.lw-inq2 .lw-inq2-h{color:#ffffff}
.lw-inq2 .lw-inq2-body{color:rgba(255,255,255,.88)}
.lw-inq2 .lw-inq2-sub{color:rgba(255,255,255,.7)}
.lw-inq2 .lw-inq2-sub strong{color:#ffffff}
.lw-inq2 .lw-inq2-wa{color:rgba(255,255,255,.8)}
.lw-inq2 .lw-inq2-wa:hover{color:#ffffff}
.lw-inq2 .lw-inq2-seal{border-color:rgba(255,255,255,.55);color:#ffffff}
.lw-inq2 .lw-inq2-seal::before{border-color:rgba(255,255,255,.2)}
"""
F9 = """
@media (min-width:769px){
.lw-hero .lw-meta-l{color:rgba(255,255,255,.72)}
}
"""
F10 = """
@media (min-width:769px){
.le-hero .le-eyebrow{color:#ffffff}
.le-hero .le-eyebrow::before{background:#ffffff}
}
"""
# F11: portada y cierre con foto a brillo completo, sin velo y con letra oscura (83 paginas).
# Primero fue una muestra en propuestas (EN y ES). Vianey aprobo aplicarlo a todas el 12-nov-2026.
F11 = """
.hero,.cta{background-color:#161616}
.hero::after{background:linear-gradient(180deg,rgba(0,0,0,.58) 0%,rgba(0,0,0,.80) 100%)}
.hero .eyebrow{color:#ffffff}
.hero h1{color:#ffffff}
.hero h1 em{color:#ffffff}
.hero .hero-sub{color:rgba(255,255,255,.88)}
.hero .hero-btn{color:#ffffff;border-color:rgba(255,255,255,.6)}
.hero .hero-btn:hover{background:#ffffff;color:#1a1a1a}
.cta::after{background:linear-gradient(180deg,rgba(0,0,0,.66) 0%,rgba(0,0,0,.86) 100%)}
.cta h2{color:#ffffff}
.cta h2 em{color:#ffffff}
.cta p{color:rgba(255,255,255,.88)}
.cta .cta-btn{color:#ffffff;border-color:rgba(255,255,255,.6)}
.cta .cta-btn:hover{background:#ffffff;color:#1a1a1a}
"""
# F12: tarjetas del diario en la portada. La foto va oscurecida al 62% (50% al pasar el cursor)
# y la letra encima quedo oscura: no se lee. Hallado el 12-nov-2026 con el barrido a 1440 px.
F12 = NOTA + """
.jrn-feat,.jrn-mini{background-color:#161616}
.jrn-feat::after,.jrn-mini::after{background:linear-gradient(to top,rgba(0,0,0,.62) 0%,rgba(0,0,0,.18) 60%,rgba(0,0,0,0) 100%)}
.jrn-feat .jrn-no,.jrn-mini .jrn-no{color:rgba(255,255,255,.86)}
.jrn-feat .jrn-no::after,.jrn-mini .jrn-no::after{background:#ffffff}
.jrn-feat h3,.jrn-feat h3 em,.jrn-mini h3,.jrn-mini h3 em{color:#ffffff}
.jrn-feat p{color:rgba(255,255,255,.88)}
.jrn-feat .jrn-go,.jrn-mini .jrn-go{color:#ffffff}
"""
FAMILIAS = {
 'F1': (F1, ['cabo-photographer.html','cenote-photographer-tulum.html','es/fotografo-los-cabos.html','mayakoba-wedding-photographer.html','riviera-maya-wedding-photographer.html']),
 'F2': (F2, ['destination-family-photographer-mexico.html','es/fotografo-familiar-destino-mexico.html','es/fotografia-familiar-multigeneracional-mexico.html','multigenerational-family-photography-mexico.html']),
 'F3': (F3, ['family-reunion-photographer-cancun.html','es/fotografo-reunion-familiar-cancun.html']),
 'F4': (F4, ['about.html','es/acerca-de.html']),
 'F6': (F6, ['couples-photography-mexico.html','es/fotografia-parejas-mexico.html']),
 'F7': (F7, ['luxury-family-photos-cancun.html','es/fotos-familiares-lujo-cancun.html']),
 'F8': (F8, ['couples-photography-mexico.html','es/fotografia-parejas-mexico.html','luxury-family-photos-cancun.html','es/fotos-familiares-lujo-cancun.html','destination-wedding-photographer-mexico.html','es/fotografo-bodas-destino-mexico.html','luxury-editorial.html','es/editorial-de-lujo.html']),
 'F9': (F9, ['destination-wedding-photographer-mexico.html','es/fotografo-bodas-destino-mexico.html']),
 'F10': (F10, ['luxury-editorial.html','es/editorial-de-lujo.html']),
 'F11': (F11, ['surprise-proposal-photographer-cancun.html','es/fotografo-propuesta-sorpresa-cancun.html']),
 'F12': (F12, ['index.html','es/index.html']),
}

# Paginas con la misma plantilla que propuestas (portada y cierre con foto a brillo completo,
# sin velo y con letra oscura). Estuvieron en espera hasta el OK de Vianey (12-nov-2026);
# desde entonces se aplican siempre, junto con la familia F11.
F11_APROBADAS_12NOV = [
    'anniversary-couples-photographer-mexico.html',
    'anniversary-party-photographer-cancun.html',
    'beach-wedding-photographer-cancun.html',
    'best-places-to-propose-cancun-riviera-maya.html',
    'bilingual-wedding-photographer-cancun.html',
    'cancun-elopement-photographer.html',
    'cancun-photo-spots.html',
    'cancun-photographer-prices.html',
    'cancun-wedding-videographer.html',
    'couples-photographer-cancun.html',
    'destination-couples-photographer-mexico.html',
    'destination-wedding-videographer-mexico.html',
    'engagement-photographer-cancun.html',
    'es/fotografo-aniversario-pareja-mexico.html',
    'es/fotografo-bodas-bilingue-cancun.html',
    'es/fotografo-bodas-intimas-cancun.html',
    'es/fotografo-bodas-intimas-los-cabos.html',
    'es/fotografo-bodas-judias-destino-mexico.html',
    'es/fotografo-bodas-los-cabos.html',
    'es/fotografo-bodas-playa-cancun.html',
    'es/fotografo-bodas-playa-mujeres.html',
    'es/fotografo-cena-ensayo-bienvenida-cancun.html',
    'es/fotografo-compromiso-cancun.html',
    'es/fotografo-compromiso-los-cabos.html',
    'es/fotografo-cumpleanos-cancun.html',
    'es/fotografo-eventos-lujo-cancun.html',
    'es/fotografo-familiar-ciudad-de-mexico.html',
    'es/fotografo-familiar-los-cabos.html',
    'es/fotografo-familiar-merida.html',
    'es/fotografo-familiar-playa-del-carmen.html',
    'es/fotografo-familiar-puerto-vallarta.html',
    'es/fotografo-fiesta-aniversario-cancun.html',
    'es/fotografo-isla-mujeres.html',
    'es/fotografo-luna-de-miel-riviera-maya.html',
    'es/fotografo-parejas-cancun.html',
    'es/fotografo-parejas-destino-mexico.html',
    'es/fotografo-parejas-playa-del-carmen.html',
    'es/fotografo-parejas-puerto-vallarta.html',
    'es/fotografo-parejas-san-miguel-de-allende.html',
    'es/fotografo-parejas-tulum.html',
    'es/fotografo-playa-del-carmen.html',
    'es/fotografo-quinceanera-cancun.html',
    'es/fotografo-renovacion-votos-mexico.html',
    'es/fotografo-resorts-cancun.html',
    'es/fotografo-tulum.html',
    'es/fotografo-vacaciones-familia-riviera-maya.html',
    'es/fotos-embarazo-cancun.html',
    'es/lugares-sesion-fotos-cancun.html',
    'es/mejores-lugares-proponer-cancun-riviera-maya.html',
    'es/planear-boda-destino-lujo-cancun-riviera-maya.html',
    'es/precios-fotografo-cancun.html',
    'es/venues.html',
    'es/videografo-bodas-cancun.html',
    'es/videografo-bodas-destino-mexico.html',
    'extended-family-vacation-photographer-riviera-maya.html',
    'honeymoon-photographer-riviera-maya.html',
    'isla-mujeres-photographer.html',
    'jewish-destination-wedding-photographer-mexico.html',
    'los-cabos-elopement-photographer.html',
    'los-cabos-engagement-photographer.html',
    'los-cabos-family-photographer.html',
    'los-cabos-wedding-photographer.html',
    'luxury-event-photographer-cancun.html',
    'merida-family-photographer.html',
    'mexico-city-family-photographer.html',
    'milestone-birthday-photographer-cancun.html',
    'planning-a-luxury-destination-wedding-cancun-riviera-maya.html',
    'playa-del-carmen-couples-photographer.html',
    'playa-del-carmen-family-photographer.html',
    'playa-del-carmen-photographer.html',
    'playa-mujeres-wedding-photographer.html',
    'puerto-vallarta-couples-photographer.html',
    'puerto-vallarta-family-photographer.html',
    'quinceanera-photographer-cancun.html',
    'resort-photographer-cancun.html',
    'san-miguel-de-allende-couples-photographer.html',
    'tulum-couples-photographer.html',
    'tulum-photographer.html',
    'venues.html',
    'vow-renewal-photographer-mexico.html',
    'welcome-party-rehearsal-dinner-photographer-cancun.html',
]


def texto_visible(s):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    return hashlib.md5(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t)).encode()).hexdigest()


def main():
    solo_ver = '--ver' in sys.argv
    css11, paginas11 = FAMILIAS['F11']
    FAMILIAS['F11'] = (css11, paginas11 + [x for x in F11_APROBADAS_12NOV if x not in paginas11])
    por_pagina = {}
    for fam, (css, paginas) in FAMILIAS.items():
        for p in paginas:
            por_pagina.setdefault(p, []).append((fam, css.replace(NOTA, '').strip()))
    cambiadas = []
    for p, partes in por_pagina.items():
        ruta = os.path.join(RAIZ, p)
        s = open(ruta, encoding='utf-8').read()
        bloque = '<style id="foto-letra-clara">' + NOTA + '\n' + '\n'.join(c for _, c in partes) + '</style>\n'
        if 'id="foto-letra-clara"' in s:
            s2 = re.sub(r'<style id="foto-letra-clara">.*?</style>\n?', lambda m: bloque, s, flags=re.S)
        else:
            if s.count('</head>') != 1:
                print('SALTADA (sin </head> unico):', p)
                continue
            s2 = s.replace('</head>', bloque + '</head>')
        sin_estilos = lambda x: re.sub(r'<style.*?</style>\n?', '', x, flags=re.S)
        if texto_visible(s) != texto_visible(s2) or sin_estilos(s) != sin_estilos(s2):
            print('SALTADA (cambiaria algo mas que estilos):', p)
            continue
        if s2 != s:
            cambiadas.append(p)
            if not solo_ver:
                open(ruta, 'w', encoding='utf-8').write(s2)
    for p in cambiadas:
        print(p)
    print('%d paginas %s' % (len(cambiadas), 'cambiarian' if solo_ver else 'cambiadas'), file=sys.stderr)


if __name__ == '__main__':
    main()
