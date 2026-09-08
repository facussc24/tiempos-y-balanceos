# -*- coding: utf-8 -*-
"""Contacto de TODAS las fotos que usa el deck, en orden de hoja."""
from PIL import Image, ImageDraw
import os, sys, re, io
import hojas_spec as HS
usadas = []
for h in HS.HOJAS:
    for f in h["imagenes"]:
        usadas.append((h["op"], os.path.basename(f)[:-4], f))
print("fotos usadas:", len(usadas))
W, cols = 330, 8
n = len(usadas)
filas = (n + cols - 1) // cols
H = int(W * 16 / 9)
hoja = Image.new("RGB", (cols*W, filas*(H+22)), "white")
d = ImageDraw.Draw(hoja)
for k, (op, nom, f) in enumerate(usadas):
    im = Image.open(f).convert("RGB")
    r = min(W/im.width, H/im.height)
    im = im.resize((int(im.width*r), int(im.height*r)), Image.LANCZOS)
    x = (k % cols)*W + (W-im.width)//2
    y = (k//cols)*(H+22) + 22
    hoja.paste(im, (x, y))
    d.text(((k % cols)*W+3, (k//cols)*(H+22)+6), f"{op} {nom[:30]}", fill="black")
hoja = hoja.resize((int(hoja.width*0.62), int(hoja.height*0.62)), Image.LANCZOS)
hoja.save("_contacto.jpg", quality=80)
print(hoja.size)
