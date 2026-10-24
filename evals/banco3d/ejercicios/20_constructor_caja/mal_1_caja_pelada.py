"""20 constructor caja - MAL 1: la misma caja dibujada a mano, sin el constructor: todos los cantos vivos."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _caja import armar_pelada  # noqa: E402

armar_pelada('caja_pelada')
