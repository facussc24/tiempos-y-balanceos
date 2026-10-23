# -*- coding: utf-8 -*-
"""03 apoyo 3-2-1 - MAL 2: los 3 apoyos del primario casi alineados (todos cerca de un borde): la pieza se hamaca
sobre esa linea y el centro de masa cae afuera del triangulo. Placa de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("apoyo_321", primario=[(20, 20), (180, 20), (100, 26)], secundario=[30, 170], terciario=[60])
