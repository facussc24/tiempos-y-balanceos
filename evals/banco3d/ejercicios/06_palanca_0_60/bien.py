# -*- coding: utf-8 -*-
"""06 palanca 0-60 - BIEN: la palanca recorre 0 a 60 grados sin tocar nada; la luz minima contra la base es 60 mm (a 0 grados). Piezas de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", chequeos=[(0, "libre"), (35, "libre"), (60, "libre")])
