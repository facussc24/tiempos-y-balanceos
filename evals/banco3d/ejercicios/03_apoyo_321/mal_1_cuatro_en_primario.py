# -*- coding: utf-8 -*-
"""03 apoyo 3-2-1 - MAL 1: 4 apoyos coplanares en el primario (sobredeterminado: la pieza apoya en 3 y el cuarto
queda en el aire o la fuerza). Placa de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("apoyo_321", primario=[(15, 15), (185, 15), (185, 105), (15, 105)], secundario=[30, 170], terciario=[60])
