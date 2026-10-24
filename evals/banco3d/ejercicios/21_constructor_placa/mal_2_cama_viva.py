"""21 constructor placa - MAL 2: R1,5 arriba y en las verticales, el contorno de la cama VIVO (sin chaflan)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _placa import armar_cama_viva  # noqa: E402

armar_cama_viva('placa_cama_viva')
