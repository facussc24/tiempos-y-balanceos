"""Casos de de_build123d.tramos para test_herramientas_tarde.py (corre en .venv-cad, imprime un JSON).
- 300 rectangulos redondeados con giro y corrimiento al azar (semilla fija): cuantos quedan con las puntas ABIERTAS;
- una circunferencia entera: en cuantos arcos sale;
- un semicirculo: 2 arcos y cerrado;
- una cara con agujero: tiene que negarse (SystemExit)."""
import collections
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build123d import (BuildLine, BuildSketch, Circle, Line, Locations, Mode, Rectangle, RectangleRounded,  # noqa: E402
                       ThreePointArc, make_face, Rot)
from de_build123d import tramos  # noqa: E402


def abiertas(t):
    cuenta = collections.Counter()
    for x in t:
        a, b = (x[1], x[2]) if x[0] == "L" else (x[3], x[4])
        cuenta[tuple(a)] += 1
        cuenta[tuple(b)] += 1
    return sum(1 for n in cuenta.values() if n != 2)


random.seed(1)
mal = 0
for _ in range(300):
    w, h, r = random.uniform(20, 80), random.uniform(20, 40), random.uniform(1, 6)
    ang, dx, dy = random.uniform(0, 90), random.uniform(-50, 50), random.uniform(-50, 50)
    with BuildSketch() as s:
        with Locations((dx, dy)):
            RectangleRounded(w, h, r, rotation=ang)
    if abiertas(tramos(s.sketch.faces()[0])):
        mal += 1
with BuildSketch() as s:
    Circle(10)
circulo = tramos(s.sketch.faces()[0])
with BuildSketch() as s:
    with BuildLine():
        Line((-10, 0), (10, 0))
        ThreePointArc((10, 0), (0, 10), (-10, 0))
    make_face()
semi = tramos(s.sketch.faces()[0])
import math  # noqa: E402
from build123d import CenterArc  # noqa: E402
with BuildSketch() as s:                          # sector de 300 grados: cada arco < 180 y la suma tiene que dar 300
    with BuildLine():                             # (auditor ronda 2: con los puntos medios mal repartidos salia 100 + 160)
        CenterArc((0, 0), 20, 0, 300)
        Line((20 * math.cos(math.radians(300)), 20 * math.sin(math.radians(300))), (0, 0))
        Line((0, 0), (20, 0))
    make_face()
sector = [x for x in tramos(s.sketch.faces()[0]) if x[0] == "A"]


def grados(x):
    c, a, b = x[1], x[3], x[4]
    ua, ub = (a[0] - c[0], a[1] - c[1]), (b[0] - c[0], b[1] - c[1])
    cos = (ua[0] * ub[0] + ua[1] * ub[1]) / (math.hypot(*ua) * math.hypot(*ub))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


sector_grados = [round(grados(x), 3) for x in sector]
with BuildSketch() as s:
    Rectangle(40, 20)
    Circle(4, mode=Mode.SUBTRACT)
try:
    tramos(s.sketch.faces()[0])
    con_agujero = "NO SE NEGO"
except SystemExit as e:
    con_agujero = "se nego" if "agujero" in str(e) else str(e)
print(json.dumps({"girados_abiertos": mal, "circulo_arcos": sum(1 for x in circulo if x[0] == "A"),
                  "circulo_abierto": abiertas(circulo), "semi_arcos": sum(1 for x in semi if x[0] == "A"),
                  "semi_abierto": abiertas(semi), "con_agujero": con_agujero, "sector_grados": sector_grados}))
