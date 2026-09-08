# -*- coding: utf-8 -*-
"""Arma 3 planchas de contacto (6 laminas c/u) para revisar el deck a ojo."""
from PIL import Image
import os
D = "render_deck"
ns = sorted([int(f[11:-4]) for f in os.listdir(D) if f.startswith("Diapositiva")])
W = 1000
for k, letra in enumerate("abc"):
    grupo = ns[k*6:(k+1)*6]
    ims = []
    for n in grupo:
        im = Image.open(os.path.join(D, f"Diapositiva{n}.PNG")).convert("RGB")
        im = im.resize((W, int(im.height*W/im.width)), Image.LANCZOS)
        ims.append((n, im))
    h = ims[0][1].height
    hoja = Image.new("RGB", (W*2+30, (h+20)*3+10), "white")
    for i, (n, im) in enumerate(ims):
        x = 10 + (i % 2)*(W+10)
        y = 10 + (i//2)*(h+20)
        hoja.paste(im, (x, y))
    hoja.save(f"{D}/_rev_{letra}.jpg", quality=88)
    print(f"_rev_{letra}.jpg  laminas {grupo}")
