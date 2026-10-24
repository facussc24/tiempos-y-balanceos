"""15 Too Tall Toby PPP01-05 Paste Sleeve - MAL 2: la boca de abajo CERRADA con un fondo de 3 (se leyo un vaso y no
una manga abierta en los dos extremos). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paste_sleeve import armar  # noqa: E402

armar('paste_sleeve_boca_abajo_cerrada', {'boca_abajo'})
