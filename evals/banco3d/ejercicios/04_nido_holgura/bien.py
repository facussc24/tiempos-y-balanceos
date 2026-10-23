# -*- coding: utf-8 -*-
"""04 nido con holgura - BIEN: 0,2 mm de luz por lado en los cuatro lados. Pieza de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("nido_holgura", luz={"+x": 0.2, "-x": 0.2, "+y": 0.2, "-y": 0.2})
