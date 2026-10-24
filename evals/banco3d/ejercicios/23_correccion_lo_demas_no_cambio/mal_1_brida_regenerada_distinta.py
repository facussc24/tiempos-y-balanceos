"""23 correccion - MAL 1: al subir el pedestal se regenero TODO y la brida salio con otro chaflan de cama (1,0 en vez de
0,6): cambio una pieza que no se pidio tocar."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar('conjunto_brida_distinta', 58.11, 1.0)
