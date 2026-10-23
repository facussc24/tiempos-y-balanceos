# -*- coding: utf-8 -*-
"""04 nido con holgura - MAL 1: luz 0,0 (entra apretada: las caras se tocan en los cuatro lados). Pieza de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("nido_holgura", luz={"+x": 0.0, "-x": 0.0, "+y": 0.0, "-y": 0.0})
