"""25 pared minima - MAL 1: el mismo bloque con pin pero con el alma en 0,30 mm (lecciones-caras.md l.42-44, leccion 12:
«un alma quedo de 0,30 mm - menos de un cordon, no imprime»). Caras paralelas: rojo."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pared import armar_bloque  # noqa: E402

armar_bloque(0.30, 'bloque_alma_0_30_pin')
