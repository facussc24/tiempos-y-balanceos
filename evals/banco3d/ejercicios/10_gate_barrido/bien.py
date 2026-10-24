# -*- coding: utf-8 -*-
"""10 gate de barrido - BIEN: la palanca del ejercicio 06 recorre 0 a 60 grados sin tocar nada (luz minima 55 mm
contra la base, por el cubo R15). Arma las mismas piezas con el _conjunto.py del 06 (no lo modifica). Piezas de
ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "06_palanca_0_60"))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", chequeos=[(0, "libre"), (35, "libre"), (60, "libre")])
