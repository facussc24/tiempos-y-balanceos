"""08 gate de voladizos - puente de 8 mm (esperado VERDE: trampa del voto dfam). Dos pilares 11 x 10 x 10 separados
8 mm y una tapa 30 x 10 x 2 arriba (caso A4 de casos_gates_3a_3b.md). Se imprime sin soporte: luz 8 < 12 mm."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

from build123d import Align, Box, Pos, export_step, export_stl  # noqa: E402

out = carpeta_salida()
abajo = (Align.CENTER, Align.CENTER, Align.MIN)
pieza = (Pos(-9.5, 0, 0) * Box(11, 10, 10, align=abajo) + Pos(9.5, 0, 0) * Box(11, 10, 10, align=abajo)
         + Pos(0, 0, 10) * Box(30, 10, 2, align=abajo))
if not pieza.is_valid:
    salir_error('el puente no es valido')
export_stl(pieza, os.path.join(out, 'puente_8mm.stl'))
export_step(pieza, os.path.join(out, 'puente_8mm.step'))
print('ok', round(pieza.volume, 1))
