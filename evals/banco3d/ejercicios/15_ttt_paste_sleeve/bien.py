"""15 Too Tall Toby PPP01-05 Paste Sleeve - BIEN: la pieza del plano tal como la leyo la practica del 23/10/2026
(objetivo 57,08 g en ABS, 1020 kg/m3; esta lectura da 56,73 g). Armada con build123d: un STEP con UN solido con nombre
ppp0105."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paste_sleeve import armar  # noqa: E402

armar('paste_sleeve')
