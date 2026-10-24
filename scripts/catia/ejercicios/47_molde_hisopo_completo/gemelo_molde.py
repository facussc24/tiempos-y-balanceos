# -*- coding: utf-8 -*-
"""Gemelo de build123d de la MITAD DE ABAJO del molde del ejercicio 47 (revisor del 47, 24/10/2026: la mitad se
controlaba solo por el signo de su centro y un bloque sin cavidad daba verde). Con las cotas del ej72 (que importa):
bloque x -10..58,7, y -15..15, z -15..0, menos el hisopo (revolucion sobre X), el canal (R1,5 sobre +Y de y 0 a 10 en
x 24,35, z 0) y los dos pines (cilindros de z -15 a 0). El bebedero queda arriba (z > 0): no entra.
Uso: python -I gemelo_molde.py  ->  una linea JSON {"vol", "cdg"}."""
import json
import os
import sys

from build123d import Box, CenterOf, Cylinder, Pos, Rot

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# las cotas se leen del ej72 sin importarlo (importa catia_base): se ejecutan solo sus asignaciones de constantes
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ej72_molde_hisopo_completo.py"), encoding="utf-8").read()
ns = {}
for linea in src.splitlines():
    if linea.split("=")[0].strip().replace(" ", "") in ("RC,LC,RB,LB", "BX0,BX1,BY,BZ", "XG", "YS,RR,RS", "EXP"):
        exec(linea.split("#")[0], ns)          # noqa: S102 (constantes del ej72 copiado, en el repo)
RC, LC, RB, LB, BX0, BX1, BY, BZ = (ns[k] for k in ("RC", "LC", "RB", "LB", "BX0", "BX1", "BY", "BZ"))
XG, YS, RR, EXP = ns["XG"], ns["YS"], ns["RR"], ns["EXP"]

hisopo = (Pos(LC / 2, 0, 0) * Rot(0, 90, 0) * Cylinder(RC, LC)) + (Pos(LC + LB / 2, 0, 0) * Rot(0, 90, 0) * Cylinder(RB, LB))
canal = Pos(XG, YS / 2, 0) * Rot(90, 0, 0) * Cylinder(RR, YS)
pines = [Pos(x, 0, -BZ / 2) * Cylinder(r, BZ) for x, r in EXP]
mitad = Pos((BX0 + BX1) / 2, 0, -BZ / 2) * Box(BX1 - BX0, 2 * BY, BZ)
mitad = mitad - hisopo - canal
for p in pines:
    mitad = mitad - p
c = mitad.center(CenterOf.MASS)
print(json.dumps({"vol": round(mitad.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)],
                  "solidos": len(mitad.solids())}))
