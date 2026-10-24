"""25 pared minima - BIEN: bloque 40 x 20 x 10 con un alma de 1,6 mm entre dos bolsillos y un pin de 5 mm con punta conica de
4 mm. Tiene que dar verde en las dos cosas: el alma no es fina y la punta del pin no es una pared fina (no da falso rojo)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pared import armar_bloque  # noqa: E402

armar_bloque(1.6, 'bloque_alma_1_6_pin')
