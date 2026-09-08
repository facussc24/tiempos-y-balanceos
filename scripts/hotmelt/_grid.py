# -*- coding: utf-8 -*-
"""Muestra frames con una grilla de porcentajes para elegir el recorte."""
from PIL import Image, ImageDraw
import glob, os, sys
FRM = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\frames")
pares = [("0382",0),("0394",0),("0392",6)]
W=560
ims=[]
for vid,seg in pares:
    idx=int(round(seg/2))+1
    fs=sorted(glob.glob(os.path.join(FRM,vid,"*.jpg")))
    f=min(fs,key=lambda p: abs(int(os.path.basename(p).split("_")[1].split(".")[0])-idx))
    im=Image.open(f).convert("RGB")
    im=im.resize((W,int(im.height*W/im.width)),Image.LANCZOS)
    d=ImageDraw.Draw(im)
    for p in range(10,100,10):
        x=int(p/100*im.width); y=int(p/100*im.height)
        d.line([(x,0),(x,im.height)],fill=(255,255,0),width=1)
        d.line([(0,y),(im.width,y)],fill=(255,255,0),width=1)
        d.text((x+2,2),str(p),fill=(255,0,0))
        d.text((2,y+2),str(p),fill=(255,0,0))
    ims.append((f"{vid}@{seg}",im))
h=max(i.height for _,i in ims)
o=Image.new("RGB",(W*3+40,h+30),"white"); dd=ImageDraw.Draw(o)
for k,(n,i) in enumerate(ims):
    o.paste(i,(10+k*(W+10),25)); dd.text((10+k*(W+10),6),n,fill="black")
o.save("_grid.jpg",quality=88); print(o.size)
