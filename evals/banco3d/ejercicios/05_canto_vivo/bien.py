"""05 canto vivo - BIEN: mango de prueba con R1,5 (el redondeo de la casa) en todas las aristas de afuera."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mango import armar  # noqa: E402

armar(1.5, "mango_R1_5")
