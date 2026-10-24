# -*- coding: utf-8 -*-
"""Gemelo de build123d del ejercicio 58: la placa 200 x 120 x 6 menos 12 cilindros D10 puestos UNO POR UNO (sin patron: la
referencia se arma sin la operacion que se prueba). Uso: gemelo_placa.py <salida.step> [<STEP de CATIA>]. Una linea JSON:
volumen y centro del gemelo y, con el STEP de CATIA, los ejes de sus caras cilindricas de R5 (x, y redondeados a 0,001)."""
import json
import sys

from build123d import Align, Box, CenterOf, Cylinder, GeomType, Pos, export_step, import_step
from OCP.BRepAdaptor import BRepAdaptor_Surface

placa = Box(200, 120, 6, align=(Align.MIN, Align.MIN, Align.MIN))
for i in range(4):
    for j in range(3):
        placa -= Pos(25 + 40 * i, 20 + 35 * j, 3) * Cylinder(5, 8)
export_step(placa, sys.argv[1])
c = placa.center(CenterOf.MASS)
out = {"vol": round(placa.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)], "solidos": len(placa.solids())}
if len(sys.argv) > 2:
    ejes = set()
    for f in import_step(sys.argv[2]).faces():
        if f.geom_type == GeomType.CYLINDER:
            cil = BRepAdaptor_Surface(f.wrapped).Cylinder()
            if abs(cil.Radius() - 5) < 1e-3:
                p = cil.Location()
                ejes.add((round(p.X(), 3), round(p.Y(), 3)))
    out["ejes_r5_catia"] = sorted(ejes)
print(json.dumps(out))
