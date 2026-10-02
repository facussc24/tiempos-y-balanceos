#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Saca una foto de la pantalla cada N segundos durante un rato, y guarda solo las que cambian.

Sirve cuando una pantalla la tiene que abrir la persona (un menu, la pantalla de conversacion nueva):
ella hace el clic y este programa se queda con la foto. Las fotos quedan en capturas/_rafaga/ (carpeta
temporal, no se sube): despues se mira cual sirve y se recorta.

Uso: python rafaga.py [segundos_en_total=180] [cada=5]
"""
import ctypes
import sys
import time
from pathlib import Path

from PIL import ImageChops, ImageGrab

ctypes.windll.user32.SetProcessDPIAware()
total = int(sys.argv[1]) if len(sys.argv) > 1 else 180
cada = int(sys.argv[2]) if len(sys.argv) > 2 else 5
destino = Path(__file__).resolve().parent / "capturas" / "_rafaga"
destino.mkdir(parents=True, exist_ok=True)
anterior = None
guardadas = 0
fin = time.time() + total
while time.time() < fin:
    im = ImageGrab.grab().convert("RGB")
    chica = im.resize((192, 108))
    cambio = True
    if anterior is not None:
        dif = ImageChops.difference(chica, anterior).convert("L")
        # cuanto de la pantalla cambio (0 a 1); menos de 2 % es el cursor o el reloj
        # un menu chico cambia menos del 1 % de la pantalla (el 01/10 con 2 % se perdieron las listas de
        # modelos y de niveles): alcanza con que cambie algo mas que el cursor
        cambio = sum(1 for p in dif.getdata() if p > 16) / (192 * 108) > 0.0015
    if cambio:
        nombre = destino / time.strftime("%H%M%S.png")
        im.save(nombre)
        guardadas += 1
        print("guardada", nombre.name, flush=True)
        anterior = chica
    time.sleep(cada)
print("fin:", guardadas, "fotos en", destino)
