"""22 constructor colocar - MAL 1: brazo_A armado a mano con el reparto de ejes zurdo del 20/10 (det -1)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _palanca import colocar_en_espejo  # noqa: E402

colocar_en_espejo('brazo_A', 'brazo_A_espejo')
