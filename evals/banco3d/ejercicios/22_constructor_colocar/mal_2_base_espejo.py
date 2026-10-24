"""22 constructor colocar - MAL 2: base_A armada a mano con el reparto de ejes zurdo del 20/10 (det -1)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _palanca import colocar_en_espejo  # noqa: E402

colocar_en_espejo('base_A', 'base_A_espejo')
