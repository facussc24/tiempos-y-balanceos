"""08 gate de voladizos - BIEN: caja 20 x 20 x 10 apoyada en la cama (nada en el aire). Medidas de ejemplo del banco."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pieza import exportar  # noqa: E402

from build123d import Align, Box  # noqa: E402

exportar(Box(20, 20, 10, align=(Align.CENTER, Align.CENTER, Align.MIN)), 'caja_sana')
