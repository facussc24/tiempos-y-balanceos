"""05 canto vivo - MAL 1: el mismo mango SIN radio (R0): canto vivo en todas las aristas de afuera."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mango import armar  # noqa: E402

armar(0.0, "mango_R0")
