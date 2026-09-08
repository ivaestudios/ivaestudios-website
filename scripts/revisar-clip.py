#!/usr/bin/env python3
"""
Portero de calidad para los clips de Video IA. Revisa lo que un ojo revisa:

  1. BARRAS NEGRAS arriba o abajo (letterbox). Se miden, no se adivinan.
  2. TEXTO QUEMADO en la imagen (subtitulos falsos, marcas de agua). Se pregunta
     a Gemini mirando cuadros reales, porque el truco de "barra oscura con
     letras claras" NO caza el texto blanco puesto directo sobre la foto.
  3. LA LETRA del audio: se le da a Gemini la frase pretendida y se le pide que
     diga si el actor la dice palabra por palabra. Transcribir a secas no basta,
     el propio transcriptor confunde ("holds you back" -> "holds your wake").
  4. SILENCIO muerto al principio y al final.

    python3 scripts/revisar-clip.py clip.mp4 "La frase pretendida entre comillas"
    python3 scripts/revisar-clip.py clip.mp4            # sin comprobar la letra

Necesita un token de Google en la variable TOK (ver _docs/VERTEX_VEO_SPEC.md).
Sale con codigo 1 si encuentra algo, para poder encadenarlo.
"""
import base64, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

PID = os.environ.get("GCP_PROJECT", "project-079a5d99-32ca-410d-964")
GEM = (f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PID}"
       "/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent")

def gemini(partes, maxtok=1200):
    body = {"contents": [{"role": "user", "parts": partes}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": maxtok,
                                 "thinkingConfig": {"thinkingBudget": 0}}}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(body, f); ruta = f.name
    try:
        out = subprocess.run(["curl", "-s", "-X", "POST", GEM,
                              "-H", f"Authorization: Bearer {os.environ['TOK']}",
                              "-H", "Content-Type: application/json",
                              "--data-binary", "@" + ruta], capture_output=True, text=True).stdout
        d = json.loads(out)
        return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"]).strip()
    finally:
        os.unlink(ruta)

def barras(mp4, tmp):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "2", "-i", mp4, "-frames:v", "1",
                    f"{tmp}/bar.png"], check=True)
    a = np.asarray(Image.open(f"{tmp}/bar.png").convert("L")).astype(float)
    h = a.shape[0]
    arr = next((y for y in range(h) if a[y].mean() > 18), 0)
    aba = next((y for y in range(h - 1, -1, -1) if a[y].mean() > 18), h - 1)
    return arr, h - 1 - aba

def texto(mp4, tmp):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf",
                    "fps=1/2,scale=384:-1", f"{tmp}/f%02d.png"], check=True)
    fs = sorted(f for f in os.listdir(tmp) if f.startswith("f") and f.endswith(".png"))[:4]
    partes = [{"text": "Look at these frames from one video. Is there ANY rendered text, letters, "
                       "numbers, subtitle, caption, watermark or logo burned into the image? "
                       "Answer only: NO, or YES followed by what it says and where."}]
    for f in fs:
        partes.append({"inlineData": {"mimeType": "image/png",
                                      "data": base64.b64encode(open(f"{tmp}/{f}", "rb").read()).decode()}})
    return gemini(partes)

def letra(mp4, frase, tmp):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000",
                    "-b:a", "64k", f"{tmp}/a.mp3"], check=True)
    b = base64.b64encode(open(f"{tmp}/a.mp3", "rb").read()).decode()
    t = (f'The intended line is exactly: "{frase}". Answer in three short lines: '
         "1) verbatim transcript of what you hear. 2) does it match word for word, yes or no. "
         "3) diction from 1 to 10 and any mumbled word.")
    return gemini([{"text": t}, {"inlineData": {"mimeType": "audio/mpeg", "data": b}}])

def silencios(mp4):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", mp4], capture_output=True, text=True).stdout)
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp4, "-af",
                        "silencedetect=noise=-30dB:d=0.25", "-f", "null", "-"],
                       capture_output=True, text=True)
    log = p.stderr + p.stdout
    pares, ini = [], None
    for m in re.finditer(r"silence_(start|end): *(-?[0-9.]+)", log):
        if m.group(1) == "start": ini = float(m.group(2))
        elif ini is not None: pares.append((ini, float(m.group(2)))); ini = None
    if ini is not None: pares.append((ini, dur))
    cab = next((b - a for a, b in pares if a <= 0.25), 0.0)
    col = next((dur - a for a, b in pares if b >= dur - 0.1), 0.0)
    return dur, cab, col

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 1
    mp4 = sys.argv[1]
    frase = sys.argv[2] if len(sys.argv) > 2 else None
    if "TOK" not in os.environ:
        print("Falta la variable TOK con el token de Google."); return 1
    tmp = tempfile.mkdtemp()
    fallos = []
    arr, aba = barras(mp4, tmp)
    print(f"barras negras   : {arr}px arriba, {aba}px abajo" + ("   <-- MAL" if arr > 6 or aba > 6 else "   ok"))
    if arr > 6 or aba > 6: fallos.append("barras negras")
    t = texto(mp4, tmp)
    mal = not t.upper().startswith("NO")
    print(f"texto en imagen : {t[:150]}" + ("   <-- MAL" if mal else ""))
    if mal: fallos.append("texto quemado")
    dur, cab, col = silencios(mp4)
    print(f"silencio        : {cab:.2f}s al inicio, {col:.2f}s al final (de {dur:.2f}s)"
          + ("   <-- MAL" if col > 1.2 else ""))
    if col > 1.2: fallos.append("silencio al final")
    if frase:
        print("--- la letra ---"); print(letra(mp4, frase, tmp))
    print("\nRESULTADO:", "LIMPIO" if not fallos else "REPROBADO por " + ", ".join(fallos))
    return 0 if not fallos else 1

if __name__ == "__main__":
    sys.exit(main())
