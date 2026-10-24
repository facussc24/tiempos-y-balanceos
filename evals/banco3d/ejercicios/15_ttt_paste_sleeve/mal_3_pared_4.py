"""15 Too Tall Toby PPP01-05 Paste Sleeve - MAL 3: pared de 4 en vez de 3 («3 wall thickness typ» mal leido), con las
aberturas interiores de 45 x 38 y 60 x 4 como en el plano (crece el exterior). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paste_sleeve import armar  # noqa: E402

armar('paste_sleeve_pared_4', pared=4.0)
