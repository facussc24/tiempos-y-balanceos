# -*- coding: utf-8 -*-
"""plancha_v3.py — plancha de contacto de las fotos ya preparadas, para MIRARLAS antes de usarlas.

    py -3 scripts/hotmelt/plancha_v3.py r_         # todas las que empiezan con r_
    py -3 scripts/hotmelt/plancha_v3.py l_ r_ --cols 5

Deja `_plancha_<prefijos>.jpg` en la carpeta temporal del sistema (no en la del Escritorio:
ahi no se borra nada, y una plancha es un temporal).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fotos_v3 import DESTINO   # noqa: E402

cols = 5
if "--cols" in sys.argv:
    i = sys.argv.index("--cols")
    cols = int(sys.argv[i + 1])
    del sys.argv[i:i + 2]
args = [a for a in sys.argv[1:] if not a.startswith("--")]
fs = sorted(f for p in (args or [""]) for f in glob.glob(os.path.join(DESTINO, p + "*.jpg"))
            if not os.path.basename(f).startswith("_"))
if not fs:
    sys.exit("no hay fotos con ese prefijo")
T = (480, 480)
filas = (len(fs) + cols - 1) // cols
hoja = Image.new("RGB", (cols * T[0], filas * (T[1] + 24)), "white")
d = ImageDraw.Draw(hoja)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB")
    tam = im.size
    im.thumbnail(T)
    x, y = (i % cols) * T[0], (i // cols) * (T[1] + 24)
    hoja.paste(im, (x + (T[0] - im.width) // 2, y + 24))
    d.text((x + 6, y + 6), f"{os.path.splitext(os.path.basename(f))[0]}  {tam[0]}x{tam[1]}", fill="black")
import tempfile
dst = os.path.join(tempfile.gettempdir(), "hoja_a3_fotos", "_plancha_" + "".join(args or ["todas"]) + ".jpg")
os.makedirs(os.path.dirname(dst), exist_ok=True)
hoja.save(dst, quality=86)
print(dst, hoja.size)
