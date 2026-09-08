# -*- coding: utf-8 -*-
"""Contacto de un tramo de frames del 9527, para encontrar la pantalla del fusor GLSC.
   _busca_glsc.py <ini> <fin> <paso>"""
from PIL import Image, ImageDraw
import os, sys

D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
ini, fin, paso = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
idxs = list(range(ini, fin + 1, paso))
W, cols = 190, 10
filas = (len(idxs) + cols - 1) // cols
CH = int(W * 16 / 9)
o = Image.new("RGB", (cols * W, filas * (CH + 14)), "white")
d = ImageDraw.Draw(o)
n = 0
for k, i in enumerate(idxs):
    f = os.path.join(D, "9527_%04d.jpg" % i)
    if not os.path.exists(f):
        continue
    im = Image.open(f).convert("RGB")
    im = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)
    o.paste(im, ((k % cols) * W, (k // cols) * (CH + 14) + 12))
    d.text(((k % cols) * W + 2, (k // cols) * (CH + 14) + 1), str(i), fill="black")
    n += 1
o.save("_glsc.jpg", quality=75)
print("%d frames  %d-%d  paso %d" % (n, ini, fin, paso), o.size)
