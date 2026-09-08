# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
import os, sys
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
ims = []
for a in sys.argv[1:]:
    p = a.split(":")
    i = int(p[0])
    f = os.path.join(D, f"9527_{i:04d}.jpg")
    im = Image.open(f).convert("RGB")
    if len(p) > 1:
        c = [float(x) for x in p[1].split(",")]
        w, h = im.size
        im = im.crop((int(c[0]/100*w), int(c[1]/100*h), int(c[2]/100*w), int(c[3]/100*h)))
    W = 800
    ims.append((a, im.resize((W, int(im.height*W/im.width)), Image.LANCZOS)))
H = max(i.height for _, i in ims)
o = Image.new("RGB", (len(ims)*810+10, H+24), "white")
d = ImageDraw.Draw(o)
for k, (n, im) in enumerate(ims):
    o.paste(im, (10+k*810, 20)); d.text((10+k*810, 4), n, fill="black")
o.save("_v2.jpg", quality=93); print(o.size)
