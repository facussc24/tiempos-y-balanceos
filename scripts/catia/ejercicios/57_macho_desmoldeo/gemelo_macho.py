# -*- coding: utf-8 -*-
"""Gemelo de build123d del macho del ejercicio 57 (lo mismo que hace el ej82: extrusion de 250 x 80 a 60 con desmoldeo de
4 grados y DESPUES R15 en las 4 aristas laterales). Una linea JSON: volumen y centro con y sin los radios."""
import json
import sys

from build123d import CenterOf, Rectangle, export_step, extrude, fillet

p = extrude(Rectangle(250, 80), amount=60, taper=4)
lat = p.edges().filter_by(lambda e: abs(e.center().Z - 30) < 1)
q = fillet(lat, 15)
out = {}
for k, s in (("desmoldeo", p), ("con_radios", q)):
    c = s.center(CenterOf.MASS)
    out[k] = {"vol": round(s.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)], "solidos": len(s.solids())}
out["aristas_laterales"] = len(lat)
if len(sys.argv) > 1:                      # con un argumento, el STEP del macho con radios (para compara.py)
    export_step(q, sys.argv[1])
print(json.dumps(out))
