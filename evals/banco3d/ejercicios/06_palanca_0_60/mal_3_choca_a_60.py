# -*- coding: utf-8 -*-
"""06 palanca 0-60 - MAL 3: el travesaño fijo esta pasado el final del recorrido: choca en el extremo de 60 grados. Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", brazo={"grados": 68, "r": 110, "y0": -20}, chequeos=[(0, "libre"), (35, "libre"), (60, "choca")])
