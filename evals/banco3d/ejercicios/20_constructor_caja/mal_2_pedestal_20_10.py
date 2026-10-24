"""20 constructor caja - MAL 2: el pedestal como lo dejo pulir.py el 20/10 en CATIA (esquinas R6 como poligono de 6
tramos, hueco de paredes 4, contorno de arriba vivo)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _caja import armar_pedestal_20_10  # noqa: E402

armar_pedestal_20_10('pedestal_20_10')
