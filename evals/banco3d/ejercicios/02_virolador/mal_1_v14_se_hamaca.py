# -*- coding: utf-8 -*-
"""02 virolador - MAL 1: la v14 real (13/10/2026), la que Fak imprimio y «se hamaca en la mano».

    python mal_1_v14_se_hamaca.py <carpeta>   ->  <carpeta>/virolador_v14.stl, .step y .json

Copia tal cual de la nube, con sha256 verificado. Apoyada en una mesa NO se hamaca (la capa geometrica del corrector
da verde: eso es parte del ejercicio); la falla esta en la ventana de asiento sobre el tapizado y en la simulacion
apretando, que juzga eval_casos_3d.py a traves del envoltorio de estabilidad_apoyo.py.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _copia_nube import carpeta_salida, copiar, escribir_json  # noqa: E402

d = carpeta_salida()
nombre = "virolador_v14"
stl = copiar("v14_stl", os.path.join(d, nombre + ".stl"))
stp = copiar("v14_step", os.path.join(d, nombre + ".step"))
escribir_json(os.path.join(d, nombre + ".json"), {
    "partes": [nombre], "stl": nombre + ".stl", "step": nombre + ".step",
    "version_casos_3d": "v14", "origen_stl": stl, "origen_step": stp,
    "nota": "STL = cuerpo sin el grabado de otro color; STEP = 2 ranuras sin grabado (cabecera corregida el 18/10)"})
print("ok", d)
