"""01 porta-bulon - BIEN: porta-bulon M6 con PUENTES ESCALONADOS (el techo con agujero se arma con dos capas de
puentes). Es el 3D real que dejo generador/porta_bulon.py el 22/10 (version de las 15:40). Se COPIA, no se redibuja.
No hay STEP real de esta version: solo STL."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import copiar, carpeta_salida

V3 = 'VWA/PATAGONIA - PLANTILLA PERFORADO INSERT/v3 - 2026-10-21 - alineada a la costura (concepto)'
out = carpeta_salida()
copiar(f'{V3}/generador/casos voladizos (porta-bulon 22-10)/PORTA-BULON M6 hexagonal (puentes escalonados).stl',
       '220da17910697ca8c8cadb36034672fa3f511d49e5c5989f881b3dac9f5ab812', out, 'porta_bulon_puentes_escalonados.stl')
print('ok')
