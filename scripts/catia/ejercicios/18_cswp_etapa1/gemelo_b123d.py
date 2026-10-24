# -*- coding: utf-8 -*-
# Origen: ej26_cswp_gemelo_b123d.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a
# CATA por el PEDIDO PARA CATA 6). OJO: el docstring de abajo dice «R6 en (B-60, 60)» y el codigo hace R15 (la lectura
# corregida, NOTAS.md de la practica). Unico cambio (24/10/2026, ejercicio 18 del banco de CATIA): el STEP va a la ruta del
# 7.o argumento (antes, fija en C:\Dev\_catia_practica) y la ultima linea es un JSON con el volumen. Corre con .venv-cad.
"""ej26 CSWP Sample Exam 2, etapa 1, en build123d (gemelo para comparar con CATIA).
Lectura del plano (19/10): placa B x A x 25 (4 R10); bloque del agujero 60 x 60 h35 en la esquina (B, 0) con R6 en
(B-60, 60); muro de 15 en L con arco R90/R105 centrado en (B-C, C), alto 95; cilindro en Y (eje x = B-C+7,5, z 95,
de y=-10, largo D, OD X) y en X (eje y = C-7,5, z 95, de x=B+10 hacia -X, largo D, OD Y); agujeros E pasantes con
chaflan 2x45 en las 4 bocas; bolsillo de z 5 a 25 a 9 de todo, 6 x R10 y R15 en la vuelta del bloque; F con caja
D30 x 10 desde z 35, pasante D15, en (B-30, 30)."""
import math
import sys

from build123d import (vertices, Align, Axis, BuildLine, BuildPart, BuildSketch, Cylinder, GeomType, Line, Location,
                       Locations, Plane, Polyline, RectangleRounded, ThreePointArc, chamfer, export_step, extrude,
                       fillet, make_face)


def cerca(e, x, y):
    c = e.center()
    return abs(c.X - x) < 1 and abs(c.Y - y) < 1


def pieza(A, B, C, D, E, X, Y):
    W = 15.0
    xa, ya = B - C, C            # caras exteriores del muro = centro de los arcos
    ri = C - 80.0                # el arco va de (B-C, 80) a (B-80, C): el radio depende de C (90 con C=170)
    ro = ri + W
    with BuildPart() as p:
        with BuildSketch():
            with Locations((B / 2, A / 2)):
                RectangleRounded(B, A, 10)
        extrude(amount=25)
        with BuildSketch():                 # bloque 60x60: R10 afuera (la de la placa) y R15 adentro (plano HH)
            with BuildLine():
                Polyline((B - 60, 0), (B, 0), (B, 60), (B - 60, 60), close=True)
            make_face()
            fillet([v for v in vertices() if abs(v.X - B) < 1e-6 and abs(v.Y) < 1e-6], 10)
            fillet([v for v in vertices() if abs(v.X - (B - 60)) < 1e-6 and abs(v.Y - 60) < 1e-6], 15)
        extrude(amount=35)
        yi = ya - math.sqrt(ro ** 2 - W ** 2)
        xi = xa + math.sqrt(ro ** 2 - W ** 2)
        m = math.radians(-45)
        with BuildSketch():
            with BuildLine():
                Line((xa, 0), (xa + W, 0))
                Line((xa + W, 0), (xa + W, yi))
                ThreePointArc((xa + W, yi), (xa + ro * math.cos(m), ya + ro * math.sin(m)), (xi, ya - W))
                Line((xi, ya - W), (B, ya - W))
                Line((B, ya - W), (B, ya))
                Line((B, ya), (xa + ri, ya))
                ThreePointArc((xa + ri, ya), (xa + ri * math.cos(m), ya + ri * math.sin(m)), (xa, ya - ri))
                Line((xa, ya - ri), (xa, 0))
            make_face()
        extrude(amount=95)
    s = p.part
    ax, ay = xa + W / 2, ya - W / 2
    s = s + Cylinder(X / 2, D, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((ax, -10, 95), (-90, 0, 0)))
    s = s + Cylinder(Y / 2, D, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((B + 10, ay, 95), (0, -90, 0)))
    # bolsillo
    r = ro + 9
    x0 = xa + W + 9
    ya2 = ya - math.sqrt(r ** 2 - (x0 - xa) ** 2)
    xb = xa + math.sqrt(r ** 2 - (W + 9) ** 2)
    with BuildSketch() as k:
        with BuildLine():
            Polyline((x0, 9), (B - 69, 9), (B - 69, 69), (B - 9, 69), (B - 9, ya - W - 9), (xb, ya - W - 9))
            ThreePointArc((xb, ya - W - 9), (xa + r * math.cos(m), ya + r * math.sin(m)), (x0, ya2))
            Line((x0, ya2), (x0, 9))
        make_face()
    bol = extrude(k.sketch.faces()[0].moved(Location((0, 0, 5))), amount=20)
    esq10 = [(x0, 9), (B - 69, 9), (B - 9, 69), (B - 9, ya - W - 9), (xb, ya - W - 9), (x0, ya2)]
    r10 = [e for e in bol.edges().filter_by(Axis.Z) if any(cerca(e, *q) for q in esq10)]
    bol = fillet(r10, 10)
    bol = fillet([e for e in bol.edges().filter_by(Axis.Z) if cerca(e, B - 69, 69)], 24)   # R15 del bloque + 9
    s = s - bol
    es = []
    s = s - Cylinder(E / 2, D + 2, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((ax, -11, 95), (-90, 0, 0)))
    s = s - Cylinder(E / 2, D + 2, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((B + 11, ay, 95), (0, -90, 0)))
    bocas = [e for e in s.edges() if e.geom_type == GeomType.CIRCLE and abs(e.radius - E / 2) < 1e-3]
    s = chamfer(bocas, 2)
    s = s - Cylinder(7.5, 100).moved(Location((B - 30, 30, 0)))
    s = s - Cylinder(15, 10, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((B - 30, 30, 25)))
    return s, len(bocas), len(r10), len(es)


if __name__ == "__main__":
    import json
    A, B, C, D, E = [float(v) for v in sys.argv[1:6]] if len(sys.argv) > 5 else (213, 200, 170, 130, 41)
    s, nb, nr, ne = pieza(A, B, C, D, E, A / 3, B / 3 + 10)
    if len(sys.argv) > 6:
        export_step(s, sys.argv[6])
    print(json.dumps({"volumen": round(s.volume, 3), "solidos": len(s.solids()), "bocas": nb, "r10": nr}))
