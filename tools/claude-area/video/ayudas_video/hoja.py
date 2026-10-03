#!/usr/bin/env python
# Hojas de contacto de una grabacion: hoja.py ARCHIVO DESDE HASTA PASO [--cols 3] [--filas 3] [--ancho 640] [--salida carpeta] [--crop x:y:w:h]
import argparse, subprocess, sys, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("archivo")
ap.add_argument("desde", type=float)
ap.add_argument("hasta", type=float)
ap.add_argument("paso", type=float)
ap.add_argument("--cols", type=int, default=3)
ap.add_argument("--filas", type=int, default=3)
ap.add_argument("--ancho", type=int, default=640)
ap.add_argument("--salida", default="hojas")
ap.add_argument("--nombre", default="h")
ap.add_argument("--crop", default=None, help="x:y:w:h en pixeles de la grabacion")
a = ap.parse_args()

out = Path(a.salida)
out.mkdir(parents=True, exist_ok=True)
tiempos = []
t = a.desde
while t <= a.hasta + 1e-6:
    tiempos.append(round(t, 3))
    t += a.paso
info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", a.archivo], capture_output=True, text=True).stdout.strip()
iw, ih = [int(x) for x in info.split("x")]
if a.crop:
    cx, cy, cw, ch = [int(x) for x in a.crop.split(":")]
else:
    cx, cy, cw, ch = 0, 0, iw, ih
alto = round(a.ancho * ch / cw)
fnt = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 22)
imgs = []
for t in tiempos:
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", a.archivo, "-frames:v", "1",
                        "-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={a.ancho}:{alto}", "-f", "image2pipe", "-vcodec", "png", "-"],
                       capture_output=True)
    if not r.stdout:
        continue
    import io
    imgs.append((t, Image.open(io.BytesIO(r.stdout)).convert("RGB")))
por_hoja = a.cols * a.filas
for h in range(0, len(imgs), por_hoja):
    grupo = imgs[h:h + por_hoja]
    filas = (len(grupo) + a.cols - 1) // a.cols
    hoja = Image.new("RGB", (a.cols * a.ancho, filas * (alto + 30)), (255, 255, 255))
    d = ImageDraw.Draw(hoja)
    for i, (t, im) in enumerate(grupo):
        x, y = (i % a.cols) * a.ancho, (i // a.cols) * (alto + 30)
        hoja.paste(im, (x, y + 30))
        d.text((x + 6, y + 2), f"{t:.1f} s", font=fnt, fill=(200, 0, 0))
    ruta = out / f"{a.nombre}_{h // por_hoja + 1:02d}.jpg"
    hoja.save(ruta, quality=85)
    print(ruta)
