"""21 constructor placa - MAL 3: el «chaflan» de cama como lo hizo el 20/10 fase3.py en CATIA (pad_chaflan de pulir.py:
3 escalones de 0,2 mm con el contorno de poligono); arriba vivo."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _placa import armar_escalones_20_10  # noqa: E402

armar_escalones_20_10('placa_escalones_20_10')
