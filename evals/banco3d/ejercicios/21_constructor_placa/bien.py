"""21 constructor placa - BIEN: la brida del macho del 20/10 (64 x 24 x 4) con el constructor de la casa: R1,5 arriba y en
las verticales, chaflan a 45 grados de 0,6 en el contorno de la cama."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _placa import armar_biblioteca  # noqa: E402

armar_biblioteca('placa_biblioteca')
