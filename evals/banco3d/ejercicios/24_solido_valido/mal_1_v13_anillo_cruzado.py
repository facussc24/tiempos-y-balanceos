# -*- coding: utf-8 -*-
"""24 solido valido - MAL 1: el STEP real de la v13 del virolador del Upper Trim (13/10/2026): el borde interior del
anillo, retirado 2,55 mm punto a punto sobre un contorno de radio minimo 2,22, se cruza en las 4 esquinas.

    python mal_1_v13_anillo_cruzado.py <carpeta>   ->  <carpeta>/virolador_v13_two.step

Copia tal cual de C:\\Dev\\_utrim\\out\\v13 con su sha256 verificado. Malla cerrada, 1 cuerpo y 0 cavidades (lo que el
gate de cuerpos ya mira da verde); is_valid NO y triangulos con sentido inconsistente (lo que este ejercicio mide)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utrim import carpeta_salida, copiar  # noqa: E402

d = carpeta_salida()
print('ok', copiar('v13', d, 'virolador_v13_two.step'))
