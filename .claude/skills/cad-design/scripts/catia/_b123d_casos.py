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
                  "semi_abierto": abiertas(semi), "con_agujero": con_agujero}))
