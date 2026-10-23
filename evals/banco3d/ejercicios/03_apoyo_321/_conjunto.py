# -*- coding: utf-8 -*-
"""Ayuda comun del ejercicio 03: arma la placa de ensayo y sus apoyos (pernos) y escribe el conjunto.

Pieza de ENSAYO del banco (placa 200 x 120 x 10, pernos de diametro 10): no es una pieza ni un dispositivo de Barack.
Los puntos de apoyo del .json salen de la geometria construida (centro de la cara del perno que toca la placa), no se
escriben a mano.
"""
import json
import os
import sys

from build123d import Align, Box, Compound, Cylinder, Pos, Rot, export_step, export_stl

MIN, CEN = Align.MIN, Align.CENTER
L, A, E = 200.0, 120.0, 10.0          # placa de ensayo
R, H = 5.0, 20.0                      # pernos de apoyo


def armar(nombre, primario, secundario, terciario):
    """primario: [(x, y)] bajo la cara z=0; secundario: [x] contra la cara y=0 (a media altura);
    terciario: [y] contra la cara x=0 (a media altura)."""
    if len(sys.argv) < 2:
        print("uso: python <script> <carpeta de salida>", file=sys.stderr)
        sys.exit(2)
    d = sys.argv[1]
    os.makedirs(d, exist_ok=True)
    placa = Box(L, A, E, align=(MIN, MIN, MIN))
    pernos = {"primario": [], "secundario": [], "terciario": []}
    for x, y in primario:
        pernos["primario"].append(Pos(x, y, -H) * Cylinder(R, H, align=(CEN, CEN, MIN)))
    for x in secundario:
        pernos["secundario"].append(Pos(x, -H / 2, E / 2) * Rot(90, 0, 0) * Cylinder(R, H))
    for y in terciario:
        pernos["terciario"].append(Pos(-H / 2, y, E / 2) * Rot(0, 90, 0) * Cylinder(R, H))
    todos = [p for v in pernos.values() for p in v]
    apoyos = Compound(children=todos)
    normales = {"primario": [0, 0, 1], "secundario": [0, 1, 0], "terciario": [1, 0, 0]}
    puntos = {}
    for k, lista in pernos.items():
        pts = []
        for p in lista:
            caras = [f for f in p.faces() if f.geom_type.name == "PLANE" and f.distance_to(placa) < 1e-6]
            assert len(caras) == 1, "el perno no toca la placa con una cara plana"
            c = caras[0].center()
            pts.append([round(c.X, 4), round(c.Y, 4), round(c.Z, 4)])
        puntos[k] = {"normal": normales[k], "puntos": pts}
    archivos = {"placa": nombre + "__placa.step", "apoyos": nombre + "__apoyos.step"}
    export_step(placa, os.path.join(d, archivos["placa"]))
    export_step(apoyos, os.path.join(d, archivos["apoyos"]))
    todo = Compound(children=[placa] + todos)
    export_step(todo, os.path.join(d, nombre + ".step"))
    export_stl(todo, os.path.join(d, nombre + ".stl"))
    with open(os.path.join(d, nombre + ".json"), "w", encoding="utf-8") as f:
        json.dump({"partes": ["placa", "apoyos"], "archivos": archivos, "pieza": "placa", "parte_apoyos": "apoyos",
                   "apoyos": puntos, "nota": "pieza de ensayo del banco, medidas sin fuente de Barack"}, f, indent=1)
    print("ok", d)
