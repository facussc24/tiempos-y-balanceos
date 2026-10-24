"""13 examen CATIA Associate - BIEN: las cuatro piezas de las preguntas 3 a 6 (q3, q4, q5, q6) tal como las piden las
laminas 04 a 11. Armadas con build123d (no hay STEP del examen): un solo STEP con los cuatro solidos con nombre."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tool_block import armar  # noqa: E402

armar('tool_block_q3_a_q6')
