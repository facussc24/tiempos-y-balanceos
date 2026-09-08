# -*- coding: utf-8 -*-
"""Plancha de contacto del video de 90 min: 1 de cada N keyframes."""
from PIL import Image, ImageDraw
import glob, os, sys
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
fs = sorted(glob.glob(os.path.join(D, "*.jpg")))
parte = int(sys.argv[1]) if len(sys.argv) > 1 else 0
cols, filas = 10, 4
n = cols * filas
paso = max(1, len(fs) // (n * 3))          # 3 planchas cubren todo
sel = fs[parte*n*paso : (parte+1)*n*paso : paso][:n]
W = 200
o = Image.new("RGB", (cols*W, filas*(int(W*16/9)+14)), "white")
d = ImageDraw.Draw(o)
for k, f in enumerate(sel):
    im = Image.open(f).convert("RGB")
    h = int(W*im.height/im.width)
    o.paste(im.resize((W, h), Image.LANCZOS), ((k % cols)*W, (k//cols)*(int(W*16/9)+14)+14))
    idx = int(os.path.basename(f).split("_")[1].split(".")[0])
    d.text(((k % cols)*W+3, (k//cols)*(int(W*16/9)+14)+2), f"{idx}", fill="black")
o.save(f"_c9527_{parte}.jpg", quality=78)
print(f"parte {parte}: {len(sel)} frames de {len(fs)}, paso {paso}", o.size)
