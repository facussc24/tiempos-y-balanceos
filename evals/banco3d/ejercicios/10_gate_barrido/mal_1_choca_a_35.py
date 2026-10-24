# -*- coding: utf-8 -*-
"""10 gate de barrido - MAL 1: el travesano fijo de la base en el camino a unos 35 grados (el mismo mutante del 06):
choca en las poses del medio y en 0 y 60 esta libre. Con --paso 60 barrido_palanca.py le da VERDE; el gate refina el
paso por la guarda y tiene que dar ROJO. Arma las piezas con el _conjunto.py del 06 (no lo modifica). Piezas de
ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "06_palanca_0_60"))
from _conjunto import armar  # noqa: E402

armar("palanca_0_60", brazo={"grados": 35, "r": 110, "y0": -20}, chequeos=[(0, "libre"), (35, "choca"), (60, "libre")])
