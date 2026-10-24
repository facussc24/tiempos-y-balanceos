"""15 Too Tall Toby PPP01-05 Paste Sleeve - MAL 1: SIN el tramo recto de 30 de abajo («30 LOWER SECTION» sin leer):
queda solo el tramo conico, de z=30 a z=133. El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paste_sleeve import armar  # noqa: E402

armar('paste_sleeve_sin_tramo_recto', {'tramo_recto'})
