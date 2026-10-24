"""13 examen CATIA Associate - MAL 1: la q3 SIN el agujero pasante de 14 de la orejeta (se olvido «All holes through
all» o el agujero de la lamina 04). Las otras tres preguntas quedan bien."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tool_block import armar  # noqa: E402

armar('tool_block_q3_sin_agujero_14', {'q3': {'agujero_14'}})
