# -*- coding: utf-8 -*-
"""02 virolador - BIEN: la v16 del virolador del Upper Trim (17/10/2026), copiada tal cual de la nube.

    python bien.py <carpeta>   ->  <carpeta>/virolador_v16.stl, .step y .json

No se modela: es la pieza real (el mutante real le gana a uno inventado). Se verifica el sha256 antes de copiar.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _copia_nube import carpeta_salida, copiar, escribir_json  # noqa: E402

d = carpeta_salida()
nombre = "virolador_v16"
stl = copiar("v16_stl", os.path.join(d, nombre + ".stl"))
stp = copiar("v16_step", os.path.join(d, nombre + ".step"))
escribir_json(os.path.join(d, nombre + ".json"), {
    "partes": [nombre], "stl": nombre + ".stl", "step": nombre + ".step",
    "version_casos_3d": "v16", "origen_stl": stl, "origen_step": stp,
    "nota": "STL = cuerpo sin el grabado de otro color; STEP = 2 ranuras sin grabado"})
print("ok", d)
