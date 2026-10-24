"""14 Too Tall Toby PPP01-03 C Clamp Base - MAL 1: SIN el agujero pasante de 5,5 ni su avellanado de 11,2 x 90 (se
olvido el agujero del eje). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _c_clamp_base import armar  # noqa: E402

armar('c_clamp_base_sin_agujero_5_5', {'agujero'})
