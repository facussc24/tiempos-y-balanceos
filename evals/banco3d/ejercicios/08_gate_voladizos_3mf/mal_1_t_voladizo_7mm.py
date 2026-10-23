"""08 gate de voladizos - MAL: T derecha (caso A5 de casos_gates_3a_3b.md): columna 6 x 6 x 10 apoyada en la cama y
una placa 20 x 20 x 3 arriba: 7 mm de placa en el aire de cada lado, sin soporte."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pieza import exportar  # noqa: E402

from build123d import Align, Box, Pos  # noqa: E402

abajo = (Align.CENTER, Align.CENTER, Align.MIN)
exportar(Box(6, 6, 10, align=abajo) + Pos(0, 0, 10) * Box(20, 20, 3, align=abajo), 't_voladizo_7mm')
