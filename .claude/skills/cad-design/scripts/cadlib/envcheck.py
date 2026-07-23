# -*- coding: utf-8 -*-
"""Chequeo de entorno: si falta un modulo, explicar COMO correr bien y salir con codigo 3.

Evita el traceback criptico de "ModuleNotFoundError: gmsh" cuando un script se corre
con el Python equivocado (el sistema en vez del venv CAD).
"""
import importlib
import sys

PYTHON_CANONICO = r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe"


def require(mods):
    faltan = []
    for m in mods:
        try:
            importlib.import_module(m)
        except ImportError:
            faltan.append(m)
    if faltan:
        sys.stderr.write(
            "[cadlib] Faltan modulos: %s.\n"
            "Interprete equivocado? Todos los scripts del skill corren con:\n"
            "  %s <script.py> --help\n" % (", ".join(faltan), PYTHON_CANONICO)
        )
        sys.exit(3)
