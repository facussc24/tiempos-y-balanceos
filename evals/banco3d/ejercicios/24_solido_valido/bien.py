# -*- coding: utf-8 -*-
"""24 solido valido - BIEN: el STEP real de la v14 del virolador del Upper Trim (13/10/2026), copiado tal cual de
C:\\Dev\\_utrim\\out\\v14 con su sha256 verificado (BANCO3D_UTRIM cambia la carpeta).

    python bien.py <carpeta>   ->  <carpeta>/virolador_v14_two.step

Es la que arreglo el cruce del contorno interior (macho.interior_limpio): is_valid SI y triangulos con un solo sentido.
No se modela: es la pieza real."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _utrim import carpeta_salida, copiar  # noqa: E402

d = carpeta_salida()
print('ok', copiar('v14', d, 'virolador_v14_two.step'))
