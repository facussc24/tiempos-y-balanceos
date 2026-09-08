# -*- coding: utf-8 -*-
"""Elige, en un tramo de frames, el que tiene MENOS reflejo sobre la pantalla.

El velo blanco de una pantalla filmada es un reflejo especular quemado: no hay
procesamiento que recupere lo que se quemo. Lo unico que sirve es elegir el fotograma
donde el reflejo cae en otro lado. Esto lo mide en vez de elegirlo a ojo.

  _mejor_frame.py <carpeta> <ini> <fin> <x0,y0,x1,y1 en %>
"""
from PIL import Image
import os, sys

F = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\frames")
carpeta, ini, fin = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
box = [float(v) for v in sys.argv[4].split(",")]

filas = []
for i in range(ini, fin + 1):
    p = os.path.join(F, carpeta, "%s_%04d.jpg" % (carpeta, i))
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("L")
    w, h = im.size
    im = im.crop((int(box[0]/100*w), int(box[1]/100*h),
                  int(box[2]/100*w), int(box[3]/100*h)))
    px = list(im.getdata())
    n = len(px)
    quemado = sum(1 for v in px if v >= 250) / n      # reflejo
    oscuro  = sum(1 for v in px if v <= 40) / n       # pantalla apagada / fuera de cuadro
    medio   = sum(px) / n
    filas.append((quemado, oscuro, medio, i))

filas.sort()
print("frame  %quemado  %oscuro  brillo")
for q, o, m, i in filas[:12]:
    print("%5d  %7.2f  %7.2f  %6.1f" % (i, q*100, o*100, m))
