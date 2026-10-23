"""08 gate de voladizos - puente de 8 mm (esperado VERDE: trampa del voto dfam). Dos pilares 11 x 10 x 10 separados
8 mm y una tapa 30 x 10 x 2 arriba (caso A4 de casos_gates_3a_3b.md). Se imprime sin soporte: luz 8 < 12 mm."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pieza import exportar  # noqa: E402

from build123d import Align, Box, Pos  # noqa: E402

abajo = (Align.CENTER, Align.CENTER, Align.MIN)
exportar(Pos(-9.5, 0, 0) * Box(11, 10, 10, align=abajo) + Pos(9.5, 0, 0) * Box(11, 10, 10, align=abajo)
         + Pos(0, 0, 10) * Box(30, 10, 2, align=abajo), 'puente_8mm')
