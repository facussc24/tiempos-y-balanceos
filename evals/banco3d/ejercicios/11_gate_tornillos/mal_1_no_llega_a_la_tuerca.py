"""11 gate de tornillos - MAL 1: el tornillo de 22 bajo la cabeza (M4 de 25 con cabeza de 3) contra la pila de 24: no
pasa la tuerca, faltan 2 mm (hallazgo 4 de la auditoria del virolador del 20/10)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar(22.0, 'conjunto_largo_22')
