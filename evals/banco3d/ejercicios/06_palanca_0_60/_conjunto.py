# -*- coding: utf-8 -*-
"""Ayuda comun del ejercicio 06: base + soporte del eje + palanca que gira de 0 a 60 grados alrededor de Y.

Piezas de ENSAYO del banco (medidas sin fuente de Barack): placa 260 x 140 x 10, soporte del eje 30 x 18 x 85, eje a
z = 80, palanca de 150 x 20 x 20 con cubo de radio 15. A 0 grados la palanca esta horizontal hacia +X; el giro positivo
(regla de la mano derecha alrededor de -Y) la levanta. Los mutantes le agregan a la base un brazo fijo (columna al
costado, a 35 mm de la palanca, y un travesaño) puesto en coordenadas polares alrededor del eje.
"""
import json
import math
import os
import sys

from build123d import Align, Axis, Box, Compound, Cylinder, Pos, Rot, export_step, export_stl

CEN, MIN = Align.CENTER, Align.MIN
EJE_O, EJE_D = (0.0, 0.0, 80.0), (0.0, -1.0, 0.0)
LARGO, MEDIO = 150.0, 10.0           # palanca: largo y media seccion
LADO = 15.0                          # seccion del travesaño


def polar(grados, r):
    t = math.radians(grados)
    return r * math.cos(t), EJE_O[2] + r * math.sin(t)


def armar(nombre, brazo=None, chequeos=()):
    """brazo: None o {"grados": g, "r": r, "y0": y desde donde arranca el travesaño (el otro extremo es la columna)}.
    chequeos: [(grados, "choca"|"libre"|("luz", valor, tol))] que se verifican sobre lo construido antes de escribir."""
    if len(sys.argv) < 2:
        print("uso: python <script> <carpeta de salida>", file=sys.stderr)
        sys.exit(2)
    d = sys.argv[1]
    os.makedirs(d, exist_ok=True)
    base = Pos(-60, -70, 0) * Box(260, 140, 10, align=(MIN, MIN, MIN))
    if brazo:
        xc, zc = polar(brazo["grados"], brazo["r"])
        y0, y1 = brazo["y0"], 60.0
        trav = Pos(xc, (y0 + y1) / 2, zc) * Box(LADO, y1 - y0, LADO)
        col = Pos(xc, 52.5, 10) * Box(LADO, 15, zc + LADO / 2 - 10, align=(CEN, CEN, MIN))
        base = base + trav + col
    soporte = Pos(-15, -30, 10) * Box(30, 18, 85, align=(MIN, MIN, MIN))
    palanca = (Pos(*EJE_O) * Rot(90, 0, 0) * Cylinder(15, 2 * MEDIO)) + \
        (Pos(*EJE_O) * Box(LARGO, 2 * MEDIO, 2 * MEDIO, align=(MIN, CEN, CEN)))
    eje = Axis(EJE_O, EJE_D)
    assert palanca.rotate(eje, 30).bounding_box().max.Z > EJE_O[2] + 60, "el giro positivo no levanta la palanca"
    for g, que in chequeos:
        m = palanca.rotate(eje, g)
        inter = m.intersect(base)
        vol = sum(s.volume for s in inter.solids()) if inter is not None else 0.0
        if que == "choca":
            assert vol > 1.0, "a %s grados tenia que chocar y no choca" % g
        elif que == "libre":
            assert vol < 1e-3, "a %s grados tenia que estar libre y choca (%.2f mm3)" % (g, vol)
        else:
            _, val, tol = que
            dd = m.distance_to(base)
            assert vol < 1e-3 and abs(dd - val) <= tol, "a %s grados la luz es %.2f, se pedia %.1f" % (g, dd, val)
    archivos = {p: "%s__%s.step" % (nombre, p) for p in ("base", "soporte", "palanca")}
    export_step(base, os.path.join(d, archivos["base"]))
    export_step(soporte, os.path.join(d, archivos["soporte"]))
    export_step(palanca, os.path.join(d, archivos["palanca"]))
    todo = Compound(children=[base, soporte, palanca])
    export_step(todo, os.path.join(d, nombre + ".step"))
    export_stl(todo, os.path.join(d, nombre + ".stl"))
    with open(os.path.join(d, nombre + ".json"), "w", encoding="utf-8") as f:
        json.dump({"partes": ["base", "soporte", "palanca"], "archivos": archivos, "movil": "palanca",
                   "junta": ["soporte"], "eje": {"origen": list(EJE_O), "dir": list(EJE_D)}, "rango_grados": [0, 60],
                   "brazo": brazo, "nota": "piezas de ensayo del banco, medidas sin fuente de Barack; el STL y el "
                   "STEP del conjunto estan en la pose de 0 grados"}, f, indent=1)
    print("ok", d)
