# -*- coding: utf-8 -*-
"""Grilla de % sobre frames crudos.  _gf.py vid:seg[:crop] ..."""
from PIL import Image, ImageDraw
import glob, os, sys
FRM = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\frames")
W = 560
ims = []
for a in sys.argv[1:]:
    p = a.split(":")
    vid, seg = p[0], float(p[1])
    crop = [float(x) for x in p[2].split(",")] if len(p) > 2 else None
    idx = int(round(seg / 2)) + 1
    cands = sorted(glob.glob(os.path.join(FRM, vid, "*.jpg")))
    f = min(cands, key=lambda q: abs(int(os.path.basename(q).split("_")[1].split(".")[0]) - idx))
    im = Image.open(f).convert("RGB")
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0]/100*w), int(crop[1]/100*h),
                      int(crop[2]/100*w), int(crop[3]/100*h)))
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
