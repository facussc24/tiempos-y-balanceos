"""16 Too Tall Toby PPP01-07 Flanged Hub - BIEN: la pieza del plano tal como la leyo la practica del 23/10/2026
(372,99 g en aleacion 1060, 2700 kg/m3). Armada con build123d: un STEP con UN solido con nombre ppp0107."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _flanged_hub import armar  # noqa: E402

armar('flanged_hub')
