"""01 porta-bulon - MAL 2: techo cerrado con TAPITA de sacrificio de 0,4 (el agujero arranca 0,4 arriba del techo).
Es la pieza de la placa v5 del 22/10: mismo volumen (1644,5 mm3) que el objeto 4 del .gcode.3mf de la placa v5.
El seguimiento '3d-control-voladizos-antes-de-mandar-viernes' dice que la queja de Fak de las 15:40 («nunca usas
soportes...») fue con la foto de los porta-bulones de la placa v5. Se COPIAN el STL y el STEP reales de la probeta."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import copiar, carpeta_salida

P = ('VWA/PATAGONIA - PLANTILLA PERFORADO INSERT/v3 - 2026-10-21 - alineada a la costura (concepto)'
     '/Probeta plaquitas intercambiables (22-10)')
out = carpeta_salida()
copiar(f'{P}/PORTA-BULON M6 hexagonal.stl', '0a4f0293a3328da21115c510ede2fef51a882fddbdb0ba1c6d1a2f3618188479',
       out, 'porta_bulon_tapita.stl')
copiar(f'{P}/PORTA-BULON M6 hexagonal.step', 'c2e3b09a7b51ff73a3f13e06c279e0dcd4087edd472ec96bc6dcba56648b9238', out, 'porta_bulon_tapita.step')
print('ok')
