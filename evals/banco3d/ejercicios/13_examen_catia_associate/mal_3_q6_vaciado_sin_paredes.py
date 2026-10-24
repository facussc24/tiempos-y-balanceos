"""13 examen CATIA Associate - MAL 3: la q6 con el vaciado de 1 TYP derecho hasta la pared de atras de 12, SIN dejar
la pared de 1 alrededor de la ranura (R41 -> R42 y delante de la ranura): la seccion U-U de la lamina 10 mal leida.
Las otras tres preguntas quedan bien."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tool_block import armar  # noqa: E402

armar('tool_block_q6_vaciado_sin_paredes', {'q6': {'paredes_ranura'}})
