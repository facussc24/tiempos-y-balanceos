"""07 tornillo 7 mm - MAL 2: el tornillo de 27 del 20/10, carpeta marcada OBSOLETO (NO IMPRIMIR) cuando quedo el de 30.
Se COPIAN el STL y el STEP reales de la nube (sha256 verificado)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _tornillo import T7, copiar, carpeta_salida  # noqa: E402

C = f'{T7}/OBSOLETO - TORNILLO LARGO 27 y 28 (20-10) (NO IMPRIMIR)'
out = carpeta_salida()
copiar(f'{C}/TORNILLO 7mm acostado holgura 0,50 - largo 27.stl',
       '2ed419cdf43dad3267308d2c80df1e3aaa09ffc84b7b8164b74c246475ffa4b4', out, 'tornillo_7mm_largo_27_obsoleto.stl')
copiar(f'{C}/TORNILLO 7mm acostado holgura 0,50 - largo 27.step',
       '12618fe8f6763d285e7b5a182f85035158a44bffd67267c76dce2fd01db4b536', out, 'tornillo_7mm_largo_27_obsoleto.step')
print('ok')
