# -*- coding: utf-8 -*-
"""Volumen y centro de gravedad de las dos etapas del Tool Block con el gemelo de la practica (ej41_tool_block/gemelo.py,
sin cambios), en .venv-cad. El __main__ de gemelo.py exporta a una carpeta de la PC principal: aca solo se usa perfil().
El centro lo pidio el revisor del 36: un agujero corrido o un perfil espejado dan el mismo volumen y la misma masa.
Uso: python gemelo_b123d.py  ->  {"1": {"volumen": ..., "cdg": [x, y, z]}, "2": {...}}"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "ej41_tool_block"))
from build123d import extrude  # noqa: E402
from gemelo import perfil  # noqa: E402

ETAPAS = {1: (81, 57, 43), 2: (84, 59, 45)}


def medir(A, B, C):
    s = extrude(perfil(A, B)[0], C)
    c = s.center()
    return {"volumen": round(s.volume, 3), "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)]}


if __name__ == "__main__":
    print(json.dumps({str(n): medir(*abc) for n, abc in ETAPAS.items()}))
