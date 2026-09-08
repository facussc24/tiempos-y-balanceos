# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
import os, sys
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
ims = []
for a in sys.argv[1:]:
    i = int(a)
    f = os.path.join(D, f"9527_{i:04d}.jpg")
    if not os.path.exists(f):
        print("falta", i); continue
    im = Image.open(f).convert("RGB")
    W = 640
    ims.append((i, im.resize((W, int(im.height*W/im.width)), Image.LANCZOS)))
H = max(i.height for _, i in ims)
o = Image.new("RGB", (len(ims)*650+10, H+26), "white")
d = ImageDraw.Draw(o)
for k, (i, im) in enumerate(ims):
    o.paste(im, (10+k*650, 22)); d.text((10+k*650, 4), str(i), fill="black")
o.save("_z9527.jpg", quality=92)
print(o.size)
