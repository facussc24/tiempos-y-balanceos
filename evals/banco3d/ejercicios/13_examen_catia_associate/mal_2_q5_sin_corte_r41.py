"""13 examen CATIA Associate - MAL 2: la q5 SIN la ranura de 24 con fondo R41 (la seccion M-M de la lamina 07 no se
leyo). Queda el rebaje de 19 y el agujero de 11. Las otras tres preguntas quedan bien (la q6 con su ranura)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tool_block import armar  # noqa: E402

armar('tool_block_q5_sin_corte_r41', {'q5': {'corte_r41'}})
