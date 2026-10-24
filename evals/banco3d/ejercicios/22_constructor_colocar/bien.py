"""22 constructor colocar - BIEN: brazo_A de la palanca en su pose real del 20/10, colocado con la biblioteca (det +1)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _palanca import colocar_con_biblioteca  # noqa: E402

colocar_con_biblioteca('brazo_A', 'brazo_A_colocado')
