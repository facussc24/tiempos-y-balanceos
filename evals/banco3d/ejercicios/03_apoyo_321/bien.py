# -*- coding: utf-8 -*-
"""03 apoyo 3-2-1 - BIEN: 3 apoyos en el plano primario lo mas separados posible (no alineados), 2 en el secundario
bien separados y 1 en el terciario. Placa de ensayo del banco.

    python bien.py <carpeta>  ->  apoyo_321.stl/.step (conjunto), apoyo_321__placa.step, apoyo_321__apoyos.step, .json
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("apoyo_321", primario=[(15, 15), (185, 15), (100, 105)], secundario=[30, 170], terciario=[60])
