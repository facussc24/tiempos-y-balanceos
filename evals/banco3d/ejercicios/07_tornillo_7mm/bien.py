"""07 tornillo 7 mm - BIEN: el tornillo de 30 VIGENTE del 20/10 (acostado, holgura 0,50, radio 0,9 bajo la cabeza).
Se COPIAN el STL y el STEP reales de la nube (sha256 verificado)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tornillo import VIGENTE_STL, VIGENTE_STEP, copiar, carpeta_salida  # noqa: E402

out = carpeta_salida()
copiar(*VIGENTE_STL, out, 'tornillo_7mm_largo_30_vigente.stl')
copiar(*VIGENTE_STEP, out, 'tornillo_7mm_largo_30_vigente.step')
print('ok')
