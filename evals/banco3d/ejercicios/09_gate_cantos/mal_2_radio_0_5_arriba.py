"""09 gate de cantos - MAL 2: el mismo tope con R0,5 arriba y en las verticales: redondeo menor que el de la casa (R1,5)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tope import armar  # noqa: E402

armar(0.5, 0.5, 'tope_R0_5_arriba')
