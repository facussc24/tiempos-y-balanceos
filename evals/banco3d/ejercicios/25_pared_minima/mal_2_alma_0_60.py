"""25 pared minima - MAL 2: el mismo bloque con pin pero con el alma en 0,60 mm: pasa el piso de un perimetro (0,45) y no llega
a dos perimetros (0,8; ficha-fdm.md G3). Caras paralelas: AVISO (el corrector lo cuenta como rojo por la opcion del yaml)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pared import armar_bloque  # noqa: E402

armar_bloque(0.60, 'bloque_alma_0_60_pin')
