# -*- coding: utf-8 -*-
"""04 nido con holgura - MAL 2: luz 1,0 mm por lado (la pieza baila en el nido). Pieza de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("nido_holgura", luz={"+x": 1.0, "-x": 1.0, "+y": 1.0, "-y": 1.0})
