"""23 correccion - MAL 2: el conjunto corregido se guardo SIN la brida (como el conjunto de CATIA del 20/10, que se guardo
sin la parte fija ni el panel)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar('conjunto_sin_brida', 58.11, 0.6, con_brida=False)
