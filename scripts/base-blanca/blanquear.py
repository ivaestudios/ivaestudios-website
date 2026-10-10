#!/usr/bin/env python3
"""Convierte reglas CSS del tema oscuro (azul marino + crema + dorado) a base blanca.
Uso: blanquear.py entrada.css salida.css   (o como módulo: transformar(css))
Reglas: fondo azul -> blanco; texto crema -> tinta; dorado -> tinta/gris (botones: negro con letra blanca);
secciones de foto (velos, portadas a sangre) conservan el velo y pasan su dorado a blanco."""
import re, sys

def _es_oro_hex(h):
    h=h.lstrip("#")
    if len(h)==3: h="".join(c*2 for c in h)
    r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
    return r>g>b and 150<=r<=235 and 120<=g<=200 and 40<=b<=130 and (r-b)>70

def _calido_claro(r,g,b):
    return r>=215 and g>=205 and b>=185 and (r-b)>=6 and not (r>=250 and g>=250 and b>=250)

def _a_blanco(r,g,b):
    return "#ffffff" if (r+g+b)/3 >= 244 else "#f7f7f5"

HEX = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")

INK = "#1a1a1a"; INK2 = "#4d4d4d"; INK3 = "#6e6e6e"; LINE = "rgba(26,26,26,.12)"; WHITE = "#ffffff"; ALT = "#f7f7f5"
# acento azul marino (elegido 2026-10-07): ocupa el lugar que tenía el dorado
ACC = "#1f3a5a"; ACC_RGB = "31,58,90"

FOTO = re.compile(r"ivm-act-hero|ivm-act-hour|ivm-wd-hero|ivm-wd-frame|ivm-wd-cinema|ivm-svc__photo|ivm-svc__num|ivm-reel-card__(meta|venue|title)|founder__pola|ivm-act-cta__(bg|veil)|loc-ov|__veil|cinematic-hero|(?<![\w-])ch-|(?<![\w-])post-hero|hero-photo|__img-overlay|img-overlay|photo-caption|ivm-st-hero__scroll|(?<![\w-])lw-hero|(?<![\w-])le-hero|ivm-jl-hero|ivm-jl-feat")
BOTON = re.compile(r"btn|button|__cta-btn|cta__btn|\.btn|-pill(?![a-z])|m-nav-cta|primary")  # ojo: "pill" sin "pillar", y "book" fuera (book-step/book-option son secciones)
ETIQUETA = re.compile(r"eyebrow|lbl|label|__tag|__time|venue|__step|__sub\b|__meta|counter|hint|__scroll|__kicker|small|__date|__loc|caption|__n\b|-n\b|crumb")
BLOQUE = re.compile(r"^\s*(?:body\s+|html\s+|\.ivm\s+)*\.[a-z0-9-]+(?:\.[a-z0-9-]+)?\s*$")  # selector de sección (sin __ ni pseudo)

OSCURO = r"#[0-3][0-9a-f][0-3][0-9a-f][0-3][0-9a-f]\b"
VAR_INK = r"var\(--(?![\w-]*on-ink)[\w-]*(?:ink|navy)[\w-]*(?:\s*,\s*[^)]*)?\)"
VAR_CREAM = r"var\(--[\w-]*(?:cream|crema|on-ink|on-dark|ivm-paper|ivae-paper|muted(?!-l))[\w-]*(?:\s*,\s*[^)]*)?\)"
VAR_GOLD = r"var\(--[\w-]*(?:gold|oro)[\w-]*(?:\s*,\s*[^)]*)?\)"
RGBA = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)")

def clase_rgb(r, g, b):
    if (r, g, b) in [(250,248,245),(255,255,255),(244,241,236),(245,242,236),(250,250,248)] or (r > 235 and g > 230 and b > 220): return "crema"
    if (r, g, b) in [(201,165,78),(168,137,74),(176,142,66),(206,174,100)] or (abs(r-200) < 30 and abs(g-162) < 30 and abs(b-75) < 30 and r > g > b): return "oro"
    if r < 45 and g < 50 and b < 60: return "oscuro"
    return None

def alfa(s):
    return float(s) if s not in (None, "") else 1.0

def texto_desde_alfa(a):
    return INK if a >= .85 else (INK2 if a >= .6 else INK3)

def mapear_color_texto(val, sel):
    ult = (sel.split(",")[0].split() or [""])[-1]
    gris = bool(ETIQUETA.search(sel)) and not re.search(r"^(h[1-4]|em|strong)\b|title|head|__val|__num|stat", ult)
    def rep(m):
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), alfa(m.group(4))
        c = clase_rgb(r, g, b)
        if c == "crema": return texto_desde_alfa(a)
        if c == "oro": return ACC
        if c == "oscuro" and a < .6: return INK3
        return m.group(0)
    v = RGBA.sub(rep, val)
    v = re.sub(r"var\(--(?![\w-]*muted-l)[\w-]*(?:muted|-3\b)[\w-]*(?:\s*,[^)]*)?\)", INK3, v)
    v = re.sub(r"var\(--muted-l2(?:\s*,[^)]*)?\)", INK3, v)  # gris muy claro (0.38) -> gris legible
    v = re.sub(r"var\(--[\w-]*(?:cream|crema|on-ink|on-dark)[\w-]*-2(?:\s*,[^)]*)?\)", INK2, v)
    v = re.sub(VAR_CREAM, INK, v)
    v = re.sub(VAR_GOLD, ACC, v)
    v = re.sub(r"#faf8f5|#f5f2ec|#f4f1ec", INK, v, flags=re.I)
    v = re.sub(r"#c9a54e|#a8894a|#b08e42|#ceae64", ACC, v, flags=re.I)
    v = HEX.sub(lambda m: ACC if _es_oro_hex(m.group(0)) else m.group(0), v)
    return v

def mapear_fondo(val, sel, boton, bloque):
    if "url(" in val:  # foto de fondo: no tocar
        return val
    es_grad = "gradient(" in val
    if es_grad:
        # degradados decorativos sobre fondo oscuro (brillos dorados, velos sin foto) -> fuera
        hex_oro_osc = any(_es_oro_hex(h) or re.match(OSCURO, h, re.I) for h in HEX.findall(val))
        if hex_oro_osc or re.search(r"rgba?\(\s*(1\d|\d|2\d)\s*,\s*(1\d|\d|2\d|3\d)\s*,\s*(1\d|\d|2\d|3\d)", val) or re.search(r"201\s*,\s*165\s*,\s*78|196\s*,\s*163\s*,\s*90", val) or re.search(VAR_GOLD, val) or re.search(VAR_INK, val):
            return "none" if not boton else ACC
        return val
    def rep(m):
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), alfa(m.group(4))
        c = clase_rgb(r, g, b)
        if c == "oscuro": return ACC if boton else (WHITE if a > .5 else "transparent")
        if c == "crema": return f"rgba(26,26,26,{round(min(a*.45, .08),3)})" if a < .5 else WHITE
        if c == "oro": return ACC if (boton or a > .8) else f"rgba({ACC_RGB},{round(min(a*.5,.12),3)})"
        return m.group(0)
    v = RGBA.sub(rep, val)
    if boton:
        v = re.sub(VAR_INK, ACC, v); v = re.sub(VAR_GOLD, ACC, v); v = re.sub(VAR_CREAM, ACC, v)
    else:
        v = re.sub(VAR_INK, WHITE, v)
        v = re.sub(VAR_GOLD, WHITE if bloque else ACC, v)
        v = re.sub(VAR_CREAM, WHITE, v)
    v = re.sub(OSCURO, ACC if boton else WHITE, v, flags=re.I)
    v = re.sub(r"#c9a54e|#a8894a|#b08e42", WHITE if bloque and not boton else ACC, v, flags=re.I)
    def calido(m):
        h=m.group(0).lstrip("#")
        if len(h)==3: h="".join(c*2 for c in h)
        r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
        return _a_blanco(r,g,b) if _calido_claro(r,g,b) else m.group(0)
    v = HEX.sub(calido, v)
    v = RGBA.sub(lambda m: (_a_blanco(int(m.group(1)),int(m.group(2)),int(m.group(3))) if alfa(m.group(4))>.9 else f"rgba(26,26,26,{round(min(alfa(m.group(4))*.3,.05),3)})") if _calido_claro(int(m.group(1)),int(m.group(2)),int(m.group(3))) else m.group(0), v)
    return v

def mapear_linea(val):
    def rep(m):
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), alfa(m.group(4))
        c = clase_rgb(r, g, b)
        if c == "oro": return f"rgba({ACC_RGB},{round(min(max(a*.6,.14),.4),3)})"
        if c == "crema": return f"rgba(26,26,26,{round(min(max(a*.5,.1),.22),3)})"
        if c == "oscuro": return LINE
        return m.group(0)
    v = RGBA.sub(rep, val)
    v = re.sub(VAR_GOLD, f"rgba({ACC_RGB},.32)", v); v = re.sub(VAR_CREAM, "rgba(26,26,26,.2)", v); v = re.sub(VAR_INK, "rgba(26,26,26,.2)", v)
    v = re.sub(r"#c9a54e|#a8894a|#b08e42", f"rgba({ACC_RGB},.32)", v, flags=re.I)
    return v

def mapear_sombra(val):
    if val.strip() in ("none",): return val
    def rep(m):
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), alfa(m.group(4))
        c = clase_rgb(r, g, b)
        if c == "oro": return f"rgba({ACC_RGB},{round(min(a*.5,.2),3)})"
        if c == "oscuro": return f"rgba({ACC_RGB},{round(min(a*.35,.18),3)})"
        if c == "crema": return f"rgba(26,26,26,{round(min(a*.3,.1),3)})"
        return m.group(0)
    v = RGBA.sub(rep, val)
    v = re.sub(VAR_GOLD, f"rgba({ACC_RGB},.18)", v)
    return v

VELO_AZUL = re.compile(r"rgba\(\s*(?:10\s*,\s*15\s*,\s*23|12\s*,\s*18\s*,\s*25|14\s*,\s*22\s*,\s*32|16\s*,\s*22\s*,\s*30|20\s*,\s*28\s*,\s*38|14\s*,\s*20\s*,\s*28)\s*,")

def mapear_foto(prop, val):
    if prop.startswith("background") and "url(" not in val:
        val = VELO_AZUL.sub("rgba(0,0,0,", val)
    # en secciones de foto: solo el dorado del texto pasa a blanco; velos y crema se quedan
    if prop in ("color", "fill", "stroke", "-webkit-text-fill-color"):
        v = re.sub(VAR_GOLD, "#ffffff", val)
        v = re.sub(r"#c9a54e|#a8894a|#b08e42|#ceae64", "#ffffff", v, flags=re.I)
        v = re.sub(r"rgba\(\s*201\s*,\s*165\s*,\s*78\s*,\s*([\d.]+)\s*\)", lambda m: f"rgba(255,255,255,{max(float(m.group(1)),.7)})", v)
        return v
    if prop.startswith("background") and not re.search(r"gradient|url\(", val):
        v = re.sub(VAR_GOLD, "#ffffff", val); return v
    if prop.startswith("border"):
        return re.sub(r"rgba\(\s*201\s*,\s*165\s*,\s*78\s*,\s*([\d.]+)\s*\)", lambda m: f"rgba(255,255,255,{m.group(1)})", re.sub(VAR_GOLD, "rgba(255,255,255,.6)", val))
    return val

NO_TOCAR = re.compile(r"swatch|palette|imkt-|mkt-")

def transformar_decl(prop, val, sel):
    if NO_TOCAR.search(sel):
        return val
    p = prop.strip().lower()
    imp = ""
    m = re.search(r"\s*!important\s*$", val)
    if m: imp = " !important"; val = val[:m.start()]
    if FOTO.search(sel):
        return mapear_foto(p, val) + imp
    boton = bool(BOTON.search(sel))
    bloque = bool(BLOQUE.match(sel.split(",")[0])) and "__" not in sel
    if p in ("color", "-webkit-text-fill-color"):
        return mapear_color_texto(val, sel) + imp
    if p in ("background", "background-color", "background-image"):
        return mapear_fondo(val, sel, boton, bloque) + imp
    if p.startswith("border") or p in ("outline", "outline-color", "text-decoration-color", "column-rule", "column-rule-color", "caret-color"):
        return mapear_linea(val) + imp
    if p in ("box-shadow",):
        return mapear_sombra(val) + imp
    if p in ("text-shadow",):
        return ("none" if re.search(r"rgba?\(\s*(1\d|\d|2\d)\s*,", val) or "201" in val else val) + imp
    if p in ("fill", "stroke"):
        return mapear_color_texto(val, sel) + imp
    if p == "--dummy":
        return val + imp
    return val + imp

def transformar(css):
    out = []; i = 0; n = len(css)
    # recorrido por bloques: conserva @media/@supports; ignora @keyframes y @font-face
    pila = []
    pos = 0
    res = []
    token = re.compile(r"/\*.*?\*/|\{|\}|'[^']*'|\"[^\"]*\"", re.S)
    buf_start = 0
    selector_stack = []
    last = 0
    for m in token.finditer(css):
        t = m.group(0)
        if t.startswith("/*") or t[0] in "'\"":
            continue
        if t == "{":
            sel = css[last:m.start()]
            # el selector es el texto desde el último ; o } o {
            selector_stack.append(sel)
            res.append(css[last:m.end()]); last = m.end()
        else:  # }
            body = css[last:m.start()]
            sel = selector_stack.pop() if selector_stack else ""
            s_clean = re.sub(r"/\*.*?\*/", "", sel, flags=re.S).strip()
            dentro_kf = any(re.search(r"@(-webkit-)?keyframes|@font-face", s) for s in selector_stack) or re.search(r"@(-webkit-)?keyframes|@font-face", s_clean)
            if "{" not in body and not s_clean.startswith("@") and not dentro_kf and not re.match(r"^(from|to|\d+%)", s_clean):
                body = transformar_cuerpo(body, " ".join(s_clean.split()))
            res.append(body + "}"); last = m.end()
    res.append(css[last:])
    return "".join(res)

OSCURO_FINAL = re.compile(r"#1a1a1a|#0[0-9a-f]{5}\b|#1[0-9a-f]{5}\b|rgba?\(\s*(?:[0-3]?\d)\s*,\s*(?:[0-4]?\d)\s*,\s*(?:[0-5]?\d)\s*(?:,\s*(?:0?\.[6-9]\d*|1(?:\.0*)?)\s*)?\)", re.I)
CLARO_TXT = re.compile(r"^\s*(#fff(fff)?|white|#faf8f5|#f9f8f7)\s*$", re.I)
CUSTOM = {"--faq-crema": "#1a1a1a", "--faq-oro": "#6e6e6e", "--faq-filete": "rgba(26,26,26,.12)"}

def transformar_cuerpo(body, sel):
    partes = re.split(r"(;)", body)
    decl = []
    for p in partes:
        if p == ";":
            decl.append((None, p)); continue
        m = re.match(r"(\s*(?:/\*.*?\*/\s*)*)(.*)$", p, re.S)
        pre, rest = m.group(1), m.group(2)
        if ":" not in rest or rest.strip().startswith("/*"):
            decl.append((None, p)); continue
        k, v = rest.split(":", 1)
        decl.append(((pre, k, v), None))
    # fondo final de la regla
    fondo_oscuro = False; tiene_fondo = False; fondo_claro = False
    nuevos = []
    for d, raw in decl:
        if d is None: nuevos.append((None, raw)); continue
        pre, k, v = d; prop = k.strip()
        if prop.startswith("--"):
            nv = CUSTOM.get(prop, v.strip())
            nuevos.append(((pre, k, v, nv), None)); continue
        nv = transformar_decl(prop, v.strip(), sel)
        if prop.lower() in ("background", "background-color") and not FOTO.search(sel):
            tiene_fondo = True
            base = re.sub(r"\s*!important", "", nv).strip()
            if OSCURO_FINAL.search(base) and "gradient" not in base: fondo_oscuro = True
            elif base in ("#ffffff", "transparent", "none") or base.startswith("rgba(26,26,26"): fondo_claro = True
        nuevos.append(((pre, k, v, nv), None))
    out = []
    for d, raw in nuevos:
        if d is None: out.append(raw); continue
        pre, k, v, nv = d; prop = k.strip().lower()
        if prop in ("color", "-webkit-text-fill-color") and not FOTO.search(sel):
            imp = " !important" if "!important" in nv else ""
            base = re.sub(r"\s*!important", "", nv).strip()
            if fondo_oscuro:
                nv = "#ffffff" + imp
            elif (fondo_claro or not BOTON.search(sel)) and (CLARO_TXT.match(base)):
                nv = "#1a1a1a" + imp
        lead = re.match(r"\s*", v).group(0)
        out.append(f"{pre}{k}:{lead}{nv}" if nv != v.strip() else f"{pre}{k}:{v}")
    return "".join(out)

if __name__ == "__main__":
    src = open(sys.argv[1]).read()
    open(sys.argv[2], "w").write(transformar(src))
