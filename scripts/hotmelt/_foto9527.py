# -*- coding: utf-8 -*-
"""Prepara una foto de hoja a partir de un keyframe del video de 90 min (IMG_9527)."""
from PIL import Image, ImageEnhance, ImageFilter
import os, sys
FRM = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\frames\9527")
OUT = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")
idx, nombre = int(sys.argv[1]), sys.argv[2]
crop = None
for i, a in enumerate(sys.argv):
    if a == "--crop":
        crop = [float(x) for x in sys.argv[i+1].split(",")]
im = Image.open(os.path.join(FRM, f"9527_{idx:04d}.jpg")).convert("RGB")
if crop:
    w, h = im.size
    im = im.crop((int(crop[0]/100*w), int(crop[1]/100*h),
                  int(crop[2]/100*w), int(crop[3]/100*h)))
if im.width > 1400:
    im = im.resize((1400, round(1400*im.height/im.width)), Image.LANCZOS)
im = ImageEnhance.Contrast(im).enhance(1.06)
im = ImageEnhance.Color(im).enhance(1.04)
im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=95, threshold=3))
dst = os.path.join(OUT, nombre + ".jpg")
im.save(dst, quality=92)
print(dst, im.size)
