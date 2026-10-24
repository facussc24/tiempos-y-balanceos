# -*- coding: utf-8 -*-
"""24 solido valido - MAL 2: el anillo sintetico del defecto de la v13: contorno de 40 x 20 con esquinas R2,22 y el borde
interior retirado 2,55 mm punto a punto (se cruza en las 4 esquinas). Armado para el banco con build123d.

    python mal_2_anillo_sintetico.py <carpeta>   ->  <carpeta>/anillo_cruzado.step"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _anillo import armar  # noqa: E402

armar(False, 'anillo_cruzado')
