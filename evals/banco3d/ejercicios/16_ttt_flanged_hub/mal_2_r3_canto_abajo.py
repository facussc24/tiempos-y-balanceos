"""16 Too Tall Toby PPP01-07 Flanged Hub - MAL 2: un R3 DE MAS en el canto de abajo de la brida de 130 (el plano lo
da con canto vivo en la vista de abajo: se copio el R3 del canto de arriba). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _flanged_hub import armar  # noqa: E402

armar('flanged_hub_r3_canto_abajo', con={'r3_canto_abajo'})
