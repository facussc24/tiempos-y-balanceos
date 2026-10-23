# -*- coding: utf-8 -*-
"""06 palanca 0-60 - MAL 1: un travesaño fijo de la base queda en el camino a unos 35 grados: choca en las poses del medio y en 0 y 60 esta libre (el control que solo mira los extremos da verde). Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", brazo={"grados": 35, "r": 110, "y0": -20}, chequeos=[(0, "libre"), (35, "choca"), (60, "libre")])
