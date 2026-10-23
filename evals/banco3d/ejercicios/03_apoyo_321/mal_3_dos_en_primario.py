# -*- coding: utf-8 -*-
"""03 apoyo 3-2-1 - MAL 3: solo 2 apoyos en el primario: la pieza gira sobre la linea que los une.
Placa de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("apoyo_321", primario=[(20, 60), (180, 60)], secundario=[30, 170], terciario=[60])
