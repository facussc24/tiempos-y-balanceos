"""09 gate de cantos - MAL 1: el mismo tope con las verticales en R1,5 y el contorno de arriba VIVO (R0), donde va la mano."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tope import armar  # noqa: E402

armar(0.0, 1.5, 'tope_vivo_arriba')
