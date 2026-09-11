# -*- coding: utf-8 -*-
"""Tira de verificacion: corta del PROXY los tramos elegidos en planos.py (sin corregir
color, sin camara lenta) y arma una sola hoja de contacto a 2 cuadros/seg con la clave del
plano y el segundo de origen quemados. Sirve para MIRAR la seleccion antes de gastar
media hora de render sobre el original."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from planos import PLANOS, FFMPEG

RAIZ = r"C:\Dev\BarackMercosul"
PROXY = os.path.join(RAIZ, ".video", "work", "proxy.mp4")
TMP = os.path.join(RAIZ, ".video", "work", "prev")
os.makedirs(TMP, exist_ok=True)

trozos = []
for c, t0, dur, vel, texto, desc in PLANOS:
    dst = os.path.join(TMP, c + ".mp4")
    txt = "%s  %%{eif\\:(%.2f+t)\\:d}s" % (c, t0)
    vf = ("fps=25,scale=640:360,"
          "drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='%s':x=6:y=6:"
          "fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.7:boxborderw=5" % txt)
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", "%.3f" % t0,
                    "-t", "%.3f" % dur, "-i", PROXY, "-vf", vf,
                    "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-an", "-y", dst], check=True)
    trozos.append(dst)

lista = os.path.join(TMP, "lista.txt")
with open(lista, "w", encoding="utf-8") as f:
    for t in trozos:
        f.write("file '%s'\n" % t.replace("\\", "/"))

reel = os.path.join(RAIZ, ".video", "work", "preview_reel.mp4")
subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
                "-i", lista, "-c", "copy", "-y", reel], check=True)

hoja = os.path.join(RAIZ, ".video", "v2", "seleccion_%02d.png")
subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", reel,
                "-vf", "fps=2,scale=320:180,tile=11x6:margin=2:padding=2",
                "-y", hoja], check=True)
print("reel:", reel)
print("hojas:", hoja)
