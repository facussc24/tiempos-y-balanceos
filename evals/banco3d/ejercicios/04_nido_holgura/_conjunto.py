# -*- coding: utf-8 -*-
"""Ayuda comun del ejercicio 04: pieza de ensayo (60 x 40 x 20) apoyada en el fondo de un nido (100 x 80 x 25, bolsillo
de 15 de profundidad) con la luz pedida en cada lado. Pieza de ENSAYO del banco: medidas sin fuente de Barack."""
import json
import os
import sys

from build123d import Align, Box, Compound, Pos, export_step, export_stl

CEN, MIN = Align.CENTER, Align.MIN
LP, AP, HP = 60.0, 40.0, 20.0      # pieza
LN, AN, PROF, FONDO = 100.0, 80.0, 15.0, 10.0


def armar(nombre, luz):
    """luz: {'+x': g, '-x': g, '+y': g, '-y': g} en mm por lado (negativa = el nido se mete en la pieza)."""
    if len(sys.argv) < 2:
        print("uso: python <script> <carpeta de salida>", file=sys.stderr)
        sys.exit(2)
    d = sys.argv[1]
    os.makedirs(d, exist_ok=True)
    pieza = Box(LP, AP, HP, align=(CEN, CEN, MIN))                      # x -30..30, y -20..20, z 0..20
    nido = Pos(0, 0, -FONDO) * Box(LN, AN, FONDO + PROF, align=(CEN, CEN, MIN))
    x0, x1 = -LP / 2 - luz["-x"], LP / 2 + luz["+x"]
    y0, y1 = -AP / 2 - luz["-y"], AP / 2 + luz["+y"]
    bolsillo = Pos((x0 + x1) / 2, (y0 + y1) / 2, 0) * Box(x1 - x0, y1 - y0, PROF + 1, align=(CEN, CEN, MIN))
    nido = nido - bolsillo
    archivos = {"pieza": nombre + "__pieza.step", "nido": nombre + "__nido.step"}
    export_step(pieza, os.path.join(d, archivos["pieza"]))
    export_step(nido, os.path.join(d, archivos["nido"]))
    todo = Compound(children=[pieza, nido])
    export_step(todo, os.path.join(d, nombre + ".step"))
    export_stl(todo, os.path.join(d, nombre + ".stl"))
    with open(os.path.join(d, nombre + ".json"), "w", encoding="utf-8") as f:
        json.dump({"partes": ["pieza", "nido"], "archivos": archivos, "pieza": "pieza", "nido": "nido",
                   "luz_construida_mm": luz, "nota": "pieza de ensayo del banco, medidas sin fuente de Barack"},
                  f, indent=1)
    print("ok", d)
