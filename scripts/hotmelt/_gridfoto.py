# -*- coding: utf-8 -*-
"""Muestra fotos de hoja con grilla de porcentajes, para elegir donde van las flechas."""
from PIL import Image, ImageDraw
import os, sys
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")
W = 620
ims = []
for n in sys.argv[1:]:
    im = Image.open(os.path.join(D, n + ".jpg")).convert("RGB")
    im = im.resize((W, int(im.height*W/im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for p in range(5, 100, 5):
        x = int(p/100*im.width); y = int(p/100*im.height)
        col = (255, 0, 0) if p % 25 == 0 else (255, 240, 0)
        d.line([(x, 0), (x, im.height)], fill=col, width=1)
        d.line([(0, y), (im.width, y)], fill=col, width=1)
        if p % 10 == 0:
            d.text((x+2, 2), str(p), fill=(255, 0, 0))
            d.text((2, y+2), str(p), fill=(255, 0, 0))
    ims.append((n, im))
H = max(i.height for _, i in ims)
o = Image.new("RGB", (len(ims)*(W+10)+10, H+26), "white")
dd = ImageDraw.Draw(o)
for k, (n, im) in enumerate(ims):
    o.paste(im, (10+k*(W+10), 22)); dd.text((10+k*(W+10), 4), n, fill="black")
o.save("_gridfoto.jpg", quality=90)
print(o.size)
