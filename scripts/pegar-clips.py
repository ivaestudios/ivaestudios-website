#!/usr/bin/env python3
"""
Pega clips de Video IA SIN silencios muertos.

Regla de Vianey (8-sep-2026): "no debe tener espacios, los silencios".

Veo deja aire en TRES sitios y hay que quitar los tres:
  1. antes de la primera palabra,
  2. en medio de la frase (pausas de casi un segundo),
  3. y sobre todo al final, porque la frase se dice más rápido de lo que dura
     la toma.

Uso:
    python3 scripts/pegar-clips.py salida.mp4 toma1.mp4 toma2.mp4 ...
    python3 scripts/pegar-clips.py --pausa 0.25 salida.mp4 toma1.mp4 ...

    --pausa   cuánto silencio se DEJA en las pausas de en medio (0.20 por
              defecto). Ponlo en 0 para que no quede nada de aire.
    --ruido   umbral en dB para considerar silencio (-30 por defecto).
    --sueltas guarda además cada toma recortada por separado.

OJO: silencedetect escribe en stderr y con `ffmpeg -v error` NO SE VE.
Aquí se captura stderr entero a propósito.
"""
import argparse, os, re, subprocess, sys, tempfile

def duracion(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", f], capture_output=True, text=True).stdout
    return float(out.strip())

def silencios(f, ruido, minimo):
    """Devuelve [(inicio, fin)] de cada tramo callado."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af",
                        f"silencedetect=noise={ruido}dB:d={minimo}", "-f", "null", "-"],
                       capture_output=True, text=True)
    log = p.stderr + p.stdout
    fuera, ini = [], None
    for m in re.finditer(r"silence_(start|end): *(-?[0-9.]+)", log):
        if m.group(1) == "start":
            ini = float(m.group(2))
        elif ini is not None:
            fuera.append((ini, float(m.group(2))))
            ini = None
    if ini is not None:
        fuera.append((ini, duracion(f)))
    return fuera

def tramos_a_conservar(dur, sil, pausa, respiro):
    """Convierte los silencios en la lista de trozos que SÍ se quedan."""
    cortes = []
    for a, b in sil:
        pegado_al_inicio = a <= 0.25
        pegado_al_final = b >= dur - 0.10
        if pegado_al_inicio or pegado_al_final:
            quitar = (a, b)              # el aire de las puntas se va entero
        else:
            sobra = (b - a) - pausa      # en medio se deja un respiro
            if sobra <= 0:
                continue
            medio = (a + b) / 2
            quitar = (medio - sobra / 2, medio + sobra / 2)
        cortes.append(quitar)

    trozos, pos = [], 0.0
    for a, b in sorted(cortes):
        a = max(pos, a - respiro if a > 0.25 else a)
        if a - pos > 0.08:
            trozos.append((pos, a))
        pos = max(pos, b + (respiro if b < dur - 0.10 else 0))
    if dur - pos > 0.08:
        trozos.append((pos, dur))
    return [(round(a, 3), round(b, 3)) for a, b in trozos if b - a > 0.12]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("salida")
    ap.add_argument("clips", nargs="+")
    ap.add_argument("--pausa", type=float, default=0.20)
    ap.add_argument("--ruido", type=float, default=-30)
    ap.add_argument("--respiro", type=float, default=0.10)
    ap.add_argument("--sueltas", action="store_true")
    a = ap.parse_args()

    tmp = tempfile.mkdtemp()
    partes, total_antes, total_despues = [], 0.0, 0.0

    for n, clip in enumerate(a.clips, 1):
        dur = duracion(clip)
        sil = silencios(clip, a.ruido, 0.25)
        trozos = tramos_a_conservar(dur, sil, a.pausa, a.respiro)
        if not trozos:
            trozos = [(0.0, dur)]
        util = sum(b - x for x, b in trozos)
        total_antes += dur
        total_despues += util
        print(f"  {os.path.basename(clip):16} {dur:5.2f}s -> {util:5.2f}s  "
              f"({len(trozos)} trozo{'s' if len(trozos) > 1 else ''}, "
              f"quita {dur - util:.2f}s de silencio)")
        for k, (x, y) in enumerate(trozos, 1):
            sal = os.path.join(tmp, f"p{n}_{k}.mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(x), "-t", str(round(y - x, 3)),
                            "-i", clip, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                            "-movflags", "+faststart", sal], check=True)
            partes.append(sal)
        if a.sueltas:
            suelta = f"{os.path.splitext(a.salida)[0]}-{n}.mp4"
            lst = os.path.join(tmp, f"l{n}.txt")
            open(lst, "w").write("\n".join(f"file '{p}'" for p in partes[-len(trozos):]))
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                            "-i", lst, "-c", "copy", suelta], check=True)

    lista = os.path.join(tmp, "todo.txt")
    open(lista, "w").write("\n".join(f"file '{p}'" for p in partes))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", lista, "-c", "copy", a.salida], check=True)
    print(f"\nlisto: {a.salida} · {duracion(a.salida):.2f}s "
          f"(antes {total_antes:.2f}s, se quitaron {total_antes - total_despues:.2f}s de aire)")

if __name__ == "__main__":
    sys.exit(main())
