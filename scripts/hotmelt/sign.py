# -*- coding: utf-8 -*-
import glob, os
from PIL import Image
BASE = "C:/Users/FacundoS-PC/BARACK ARGENTINA SRL/Ingenier\u00eda y Proyecto - General/INGENIERIA BARACK (NUNCA BORRAR)/1- GENERAL/TAREAS CERRADAS/2026/2026-09-03 - Hojas de proceso maquina HOTMELT - desde los videos"
OUT = os.path.dirname(os.path.abspath(__file__))
z = Image.open(os.path.join(BASE, "_trabajo/zoom/0380_kingpower.jpg"))
# el cartel ocupa aprox x 320-700, y 25-200 en la imagen 880x800
c = z.crop((315, 20, 710, 210))
c = c.resize((c.width*5, c.height*5), Image.LANCZOS)
c.save(os.path.join(OUT, "sign_zoom.png"))
print(c.size)
