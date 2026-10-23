"""09 gate de cantos - BIEN: tope con R1,5 en el contorno de arriba y en las verticales; abajo (cama) vivo."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tope import armar  # noqa: E402

armar(1.5, 1.5, 'tope_R1_5_arriba')
