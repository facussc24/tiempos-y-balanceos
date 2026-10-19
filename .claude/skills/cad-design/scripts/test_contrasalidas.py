# -*- coding: utf-8 -*-
"""Pruebas de contrasalidas.py (corre en .venv-cad) con respuesta conocida:
1. caja 40 x 20 x 10 con la particion al medio: SALE; las 4 paredes son sin desmoldeo: 2 (40 + 20) 10 = 1200 mm2.
2. la misma caja con 4 grados de desmoldeo hacia arriba en la mitad de arriba: sin desmoldeo cae a casi 0 en esa mitad.
3. hisopo del ej71 (cabeza O8,6 x 15,4 + cuerpo O3 x 33,3, eje X en la particion): SALE en Z.
4. el mismo con el mango HUECO (O1 x 10 desde la punta): TRABA, area ~ pi d L = 31,4 (las dos mitades); la caja de lo
   que traba cae en la punta (x 38,7 a 48,7).
5. el hueco juzgado contra un CORREDIZO en +X (zona del hueco): SALE.
6. gemelo de la orientacion: si las normales salieran al reves, la caja daria TRABA (se prueba invirtiendo la direccion
   de apertura: con la particion arriba de todo, la caja entera sale hacia -Z y su cara de ARRIBA (800 mm2) traba)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build123d import Box, Cylinder, Pos, Rot, Sphere, extrude, fillet, mirror, Rectangle, Plane  # noqa: E402
import contrasalidas as cs  # noqa: E402

fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


caja = Box(40, 20, 10)
r = cs.revisar(caja)
chequear("caja: SALE y 1200 mm2 sin desmoldeo", r["veredicto"] == "SALE" and abs(r["area_sin_desmoldeo_mm2"] - 1200) < 1, r)

arriba = extrude(Rectangle(40, 20), amount=5, taper=4)
doble = arriba + mirror(arriba, Plane.XY)       # desmoldeo de 4 grados hacia cada mitad, particion en z 0
r2 = cs.revisar(doble)
chequear("caja con 4 grados a cada lado de la particion: SALE y sin desmoldeo 0", r2["veredicto"] == "SALE"
         and r2["area_sin_desmoldeo_mm2"] < 0.5, r2)

cab = Pos(7.7, 0, 0) * Rot(0, 90, 0) * Cylinder(4.3, 15.4)
cue = Pos(15.4 + 33.3 / 2, 0, 0) * Rot(0, 90, 0) * Cylinder(1.5, 33.3)
hisopo = cab + cue
r3 = cs.revisar(hisopo)
chequear("hisopo macizo: SALE en Z", r3["veredicto"] == "SALE", r3)

hueco = Pos(48.7 - 5, 0, 0) * Rot(0, 90, 0) * Cylinder(0.5, 10)
hueco_h = hisopo - hueco
r4 = cs.revisar(hueco_h)
cj = r4["caja_de_lo_que_traba"] or [0] * 6
chequear("mango hueco: TRABA ~31,4 mm2 y en la punta", r4["veredicto"] == "TRABA"
         and abs(r4["area_que_traba_mm2"] - math.pi * 1 * 10) < 0.06 * math.pi * 10 and cj[0] >= 38.6 and cj[3] <= 48.8, r4)

r5 = cs.revisar(hueco_h, corredizo=(1, 0, 0), zona=(38.6, -0.6, -0.6, 48.8, 0.6, 0.6))
chequear("el hueco con corredizo en +X: SALE", r5["veredicto"] == "SALE" and r5["area_en_corredizo_mm2"] > 30, r5)

r6 = cs.revisar(caja, particion=10.0)
chequear("gemelo: con la particion arriba de todo la caja TRABA (la cara de arriba mira contra la apertura -Z)",
         r6["veredicto"] == "TRABA" and abs(r6["area_que_traba_mm2"] - 800) < 1, r6)

# auditor 19/10 (medido cortando la pieza por el plano)
prisma = extrude(Rectangle(40, 20), amount=10, taper=4)
r7 = cs.revisar(prisma, particion=2)
chequear("prisma de 4 grados con la particion en z 2: TRABA 239,46 (antes daba SALE)",
         r7["veredicto"] == "TRABA" and abs(r7["area_que_traba_mm2"] - 239.46) < 0.1, r7)
chequear("el mismo con la particion en z 8: traba 944,4 (antes 1174,9)",
         abs(cs.revisar(prisma, particion=8)["area_que_traba_mm2"] - 944.4) < 0.1)
chequear("caja con la particion en su base: SALE (la cara apoyada en el plano es la de particion)",
         cs.revisar(caja, particion=-5)["veredicto"] == "SALE")
chequear("caja con aristas R2: SALE (sin ruido de teselado)",
         cs.revisar(fillet(Box(40, 20, 10).edges(), 2))["veredicto"] == "SALE")
chequear("esfera partida en el ecuador: SALE", cs.revisar(Sphere(10))["veredicto"] == "SALE")
r8 = cs.revisar(hueco_h, corredizo=(-1, 0, 0), zona=(38.6, -0.6, -0.6, 48.8, 0.6, 0.6))
chequear("corredizo en el sentido equivocado (-X, hacia el fondo del hueco): TRABA", r8["veredicto"] == "TRABA", r8)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)
