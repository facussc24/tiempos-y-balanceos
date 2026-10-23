"""05 canto vivo - MAL 2: el mismo mango con R0,5 (redondeo menor que el de la casa)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mango import armar  # noqa: E402

armar(0.5, "mango_R0_5")
