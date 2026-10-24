"""22 constructor colocar - MAL 3: brazo_A como lo deja un STEP exportado desde la matriz espejo (Y = Z x X): rotacion
propia (det +1) pero corrida de lugar. Es lo que el auditor midio en el conjunto del 20/10 (piezas corridas 140 a 370 mm)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _palanca import colocar_como_lo_exporta_un_step  # noqa: E402

colocar_como_lo_exporta_un_step('brazo_A', 'brazo_A_corrido')
