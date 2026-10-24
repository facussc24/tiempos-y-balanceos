"""20 constructor caja - BIEN: el pedestal del 20/10 (52 x 30 x 53,11) hecho con el constructor de la casa (R1,5)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _caja import armar_biblioteca  # noqa: E402

armar_biblioteca('caja_biblioteca')
