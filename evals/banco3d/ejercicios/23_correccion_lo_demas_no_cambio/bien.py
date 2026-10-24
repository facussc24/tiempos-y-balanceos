"""23 correccion - BIEN: se pidio subir el pedestal 5 mm y cambio solo el pedestal (la brida queda igual)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar('conjunto_corregido', 58.11, 0.6)
