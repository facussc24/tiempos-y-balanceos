# -*- coding: utf-8 -*-
"""Volumen, area y centro de gravedad de cada STEP con la integracion ADAPTATIVA de OpenCASCADE (eps 1e-6), con .venv-cad.
Ejercicio 33 (24/10/2026): la integracion por defecto de medir_b123d.py, sobre el STEP que exporta CATIA del panel (todo
NURBS), da 91 719,392 mm3 (-0,052 %) y el centro 0,058 mm corrido en X; con eps 1e-6 el mismo archivo da 91 763,081
(-0,004 %) y 0,0042 mm (el mayor de los tres ejes). La geometria no cambio: cambio la integracion (LECCIONES.md, punto 2).
Ojo: sobre una cascara ABIERTA tambien da un volumen y «valido» (una caja sin una cara: 4 800 de 6 000 mm3, valido): lo
que caza eso es la topologia de medir_b123d, no esto.

Uso: python medir_fino.py <a.step> [<b.step> ...]  ->  una linea JSON {"<archivo>": {vol, area, cdg, valido}, "seg": s}.
"""
import json
import os
import sys
import time

from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.STEPControl import STEPControl_Reader

EPS = 1e-6


def medir(ruta):
    r = STEPControl_Reader()
    if r.ReadFile(ruta) != 1:
        return {"error": "el STEP no se pudo leer"}
    r.TransferRoots()
    forma = r.OneShape()
    v, a = GProp_GProps(), GProp_GProps()
    BRepGProp.VolumeProperties_s(forma, v, EPS)
    BRepGProp.SurfaceProperties_s(forma, a, EPS)
    c = v.CentreOfMass()
    return {"vol": round(v.Mass(), 3), "area": round(a.Mass(), 3), "cdg": [round(c.X(), 4), round(c.Y(), 4), round(c.Z(), 4)],
            "valido": bool(BRepCheck_Analyzer(forma).IsValid())}


if __name__ == "__main__":
    t0 = time.time()
    out = {os.path.basename(p): medir(p) for p in sys.argv[1:]}
    out["seg"] = round(time.time() - t0, 1)
    print(json.dumps(out))
