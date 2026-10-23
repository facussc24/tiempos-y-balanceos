"""08 gate de voladizos - BIEN: caja 20 x 20 x 10 apoyada en la cama (nada en el aire). Medidas de ejemplo del banco."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

from build123d import Align, Box, export_step, export_stl  # noqa: E402

out = carpeta_salida()
caja = Box(20, 20, 10, align=(Align.CENTER, Align.CENTER, Align.MIN))
if not caja.is_valid:
    salir_error('la caja no es valida')
export_stl(caja, os.path.join(out, 'caja_sana.stl'))
export_step(caja, os.path.join(out, 'caja_sana.step'))
print('ok', round(caja.volume, 1))
