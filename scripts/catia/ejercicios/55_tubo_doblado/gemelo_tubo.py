# -*- coding: utf-8 -*-
"""Gemelo de build123d del tubo del ejercicio 55 (revisor del 55, 24/10/2026: Pappus y el centro no ven el perfil GIRADO
en su plano; la booleana contra este barrido si). Barrido del cuadrado 30 menos 26 centrado en (50, 0, 0), en el plano XZ,
por recta (50,0)-(50,40) + arco de centro (70,40) R20 hasta (70,60) + recta hasta (100,60).
Uso: python -I gemelo_tubo.py <salida.step>  ->  escribe el STEP y una linea JSON {"vol", "cdg"}."""
import json
import sys

from build123d import (BuildLine, BuildSketch, CenterArc, CenterOf, Line, Mode, Plane, Rectangle, export_step, sweep)

with BuildLine() as ln:
    Line((50, 0), (50, 40))
    CenterArc((70, 40), 20, 180, -90)
    Line((70, 60), (100, 60))
with BuildSketch(Plane(origin=(50, 0, 0), x_dir=(1, 0, 0), z_dir=(0, 1, 0))) as sk:
    Rectangle(30, 30)
    Rectangle(26, 26, mode=Mode.SUBTRACT)
tubo = sweep(sk.sketch, path=ln.wire())
export_step(tubo, sys.argv[1])
c = tubo.center(CenterOf.MASS)
print(json.dumps({"vol": round(tubo.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)]}))
