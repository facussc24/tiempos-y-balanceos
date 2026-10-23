# -*- coding: utf-8 -*-
"""04 nido con holgura - MAL 3: nido corrido: 0,2 de un lado y -0,1 del otro en X (el nido se mete 0,1 mm en la pieza). Pieza de ensayo del banco."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _conjunto import armar  # noqa: E402

armar("nido_holgura", luz={"+x": 0.2, "-x": -0.1, "+y": 0.2, "-y": 0.2})
