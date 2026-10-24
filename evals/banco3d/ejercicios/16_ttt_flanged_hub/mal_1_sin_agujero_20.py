"""16 Too Tall Toby PPP01-07 Flanged Hub - MAL 1: SIN el agujero pasante de 20 del cubo (se olvido el agujero del
eje). El resto queda igual."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _flanged_hub import armar  # noqa: E402

armar('flanged_hub_sin_agujero_20', sin={'agujero_20'})
