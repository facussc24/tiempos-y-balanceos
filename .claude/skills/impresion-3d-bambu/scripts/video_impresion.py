"""Video corto de una impresion a partir de las fotos por minuto del seguimiento.

Uso (python del sistema, con ffmpeg en el PATH):
  video_impresion.py <carpeta del seguimiento> <salida.mp4> [--titulo "Virolador v14"]
Cada cuadro: la zona de la placa, con la hora, la capa, el avance y el riesgo que marco el detector
(0 a 100) escritos encima. Los datos salen de seguimiento.log; la foto, de por_minuto/.
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

carpeta, salida = Path(sys.argv[1]), sys.argv[2]
titulo = sys.argv[sys.argv.index("--titulo") + 1] if "--titulo" in sys.argv else ""
REC = (200, 0, 1300, 460)
F1 = ImageFont.truetype("arialbd.ttf", 34)
F2 = ImageFont.truetype("arial.ttf", 26)

datos = {}
for ren in (carpeta / "seguimiento.log").read_text(encoding="utf-8").splitlines():
    m = re.match(r"(\d\d):(\d\d):(\d\d) \S+ etapa \S+ capa (\d+)/(\d+) (\d+) %.*?exito ([\d.]+) falla ([\d.]+)(.*)", ren)
    if m:
        a, b = float(m.group(7)), float(m.group(8))
        datos[m.group(1) + m.group(2)] = (int(m.group(4)), int(m.group(5)), int(m.group(6)),
                                          round(100 * a / (a + b)), "NO CUENTA" in m.group(9))
tmp = Path(tempfile.mkdtemp())
n = 0
for f in sorted((carpeta / "por_minuto").glob("*.jpg")):
    hhmm = f.stem[:4]
    img = Image.open(f).convert("RGB").crop(REC).resize((1280, 536))
    lienzo = Image.new("RGB", (1280, 720), "white")
    lienzo.paste(img, (0, 92))
    dr = ImageDraw.Draw(lienzo)
    dr.text((24, 26), titulo, font=F1, fill="black")
    dr.text((1100, 30), f"{hhmm[:2]}:{hhmm[2:]}", font=F1, fill="black")
    d = datos.get(hhmm)
    if d:
        capa, tot, pct, riesgo, descartada = d
        dr.text((24, 648), f"Capa {capa} de {tot}   -   {pct} %", font=F1, fill="black")
        col = "#1a7f37" if riesgo < 25 else "#b26a00"
        txt = f"Riesgo que marca el detector: {riesgo} de 100"
        dr.text((640, 652), txt + ("  (cambio de color)" if riesgo >= 25 else ""), font=F2, fill=col)
        dr.rectangle([0, 92, int(1280 * pct / 100), 100], fill="#1a7f37")
    lienzo.save(tmp / f"c{n:04d}.jpg", quality=90)
    n += 1
if not n:
    raise SystemExit("no hay fotos en por_minuto/")
r = subprocess.run(["ffmpeg", "-y", "-framerate", "3", "-i", str(tmp / "c%04d.jpg"), "-c:v", "libx264",
                    "-pix_fmt", "yuv420p", "-vf", "fps=30", "-movflags", "+faststart", salida],
                   capture_output=True, text=True)
print("cuadros:", n, "| ffmpeg:", "ok" if r.returncode == 0 else r.stderr[-300:], "->", salida)
