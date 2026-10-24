# -*- coding: utf-8 -*-
"""Gemelo de build123d del ejercicio 60: la caja 100 x 6 x 37 unida a un cilindro R3 a lo largo de X por (y 3, z 37), SIN
redondeo (la referencia se arma sin la operacion que se prueba; la mitad de abajo del cilindro queda adentro de la caja, asi
que la union es el rectangulo mas el semicirculo). Uso: gemelo_nervio.py <salida.step> [<STEP de CATIA>]. Una linea JSON:
volumen y centro del gemelo y, con el STEP de CATIA, los ejes de sus caras cilindricas de R3 (y, z, direccion en X)."""
import json
import sys

from build123d import Align, Box, CenterOf, Cylinder, GeomType, Pos, Rot, export_step, import_step
from OCP.BRepAdaptor import BRepAdaptor_Surface

nervio = Box(100, 6, 37, align=(Align.MIN, Align.MIN, Align.MIN)) + Pos(50, 3, 37) * Rot(0, 90, 0) * Cylinder(3, 100)
export_step(nervio, sys.argv[1])
c = nervio.center(CenterOf.MASS)
out = {"vol": round(nervio.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)],
       "solidos": len(nervio.solids())}
if len(sys.argv) > 2:
    ejes = set()
    for f in import_step(sys.argv[2]).faces():
        if f.geom_type == GeomType.CYLINDER:
            cil = BRepAdaptor_Surface(f.wrapped).Cylinder()
            if abs(cil.Radius() - 3) < 1e-3:
                p, d = cil.Location(), cil.Axis().Direction()
                ejes.add((round(p.Y(), 3), round(p.Z(), 3), round(d.X(), 4)))
    out["ejes_r3_catia"] = sorted(ejes)
print(json.dumps(out))
