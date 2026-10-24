"""11 gate de tornillos - BIEN: el tornillo de 26 bajo la cabeza pasa la pila de 24 (brida + placa + arandela + tuerca)
y sobresale 2 de la tuerca."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar(26.0, 'conjunto_largo_26')
