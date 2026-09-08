# -*- coding: utf-8 -*-
"""Grilla sobre frames del 9527.  _gf9.py idx[:crop] ..."""
from PIL import Image, ImageDraw
import os, sys
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
W = 620
ims = []
for a in sys.argv[1:]:
    p = a.split(":")
    im = Image.open(os.path.join(D, f"9527_{int(p[0]):04d}.jpg")).convert("RGB")
    if len(p) > 1:
        c = [float(x) for x in p[1].split(",")]
        w, h = im.size
        im = im.crop((int(c[0]/100*w), int(c[1]/100*h), int(c[2]/100*w), int(c[3]/100*h)))
    im = im.resize((W, int(im.height*W/im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for q in range(5, 100, 5):
        x = int(q/100*im.width); y = int(q/100*im.height)
        col = (255, 0, 0) if q % 25 == 0 else (255, 235, 0)
        d.line([(x, 0), (x, im.height)], fill=col, width=1)
        d.line([(0, y), (im.width, y)], fill=col, width=1)
        if q % 10 == 0:
            d.text((x+2, 2), str(q), fill=(255, 0, 0)); d.text((2, y+2), str(q), fill=(255, 0, 0))
    ims.append((a, im))
H = max(i.height for _, i in ims)
o = Image.new("RGB", (len(ims)*(W+10)+10, H+24), "white")
dd = ImageDraw.Draw(o)
for k, (n, im) in enumerate(ims):
    o.paste(im, (10+k*(W+10), 20)); dd.text((10+k*(W+10), 3), n, fill="black")
o.save("_gf.jpg", quality=90); print(o.size)
