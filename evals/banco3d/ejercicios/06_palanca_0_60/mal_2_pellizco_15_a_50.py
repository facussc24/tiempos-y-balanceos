# -*- coding: utf-8 -*-
"""06 palanca 0-60 - MAL 2: no choca, pero a 50 grados la palanca pasa a 15 mm de un bloque fijo de la base (pinza de dedo, P12). Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", brazo={"grados": 50, "r": 100, "y0": 25}, chequeos=[(0, "libre"), (50, ("luz", 15.0, 0.5)), (60, "libre")])
