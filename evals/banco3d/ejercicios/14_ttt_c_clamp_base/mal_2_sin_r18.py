"""14 Too Tall Toby PPP01-03 C Clamp Base - MAL 2: SIN los dos R18 de las esquinas exteriores de abajo (esquinas
vivas: se olvido el fillet R18 de 2 lugares). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _c_clamp_base import armar  # noqa: E402

armar('c_clamp_base_sin_r18', {'r18'})
