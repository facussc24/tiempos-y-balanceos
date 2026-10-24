"""21 constructor placa - MAL 1: la misma placa con FILETE R0,6 en el contorno de la cama (G6: chaflan, no filete)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _placa import armar_cama_con_filete  # noqa: E402

armar_cama_con_filete('placa_cama_filete')
