"""01 porta-bulon - MAL 1: techo del alojamiento hexagonal con el agujero de 6,6 en el medio (la version que salio
en marana de hilos en la placa probeta v4, foto de Fak 22/10 14:33). Es el STL de respuesta conocida que dejo
generador/porta_bulon_variantes.py el 22/10 (rearmado de esa version, sin los chaflanes). Se COPIA.
No hay STEP real de esta version: solo STL."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import copiar, carpeta_salida

V3 = 'VWA/PATAGONIA - PLANTILLA PERFORADO INSERT/v3 - 2026-10-21 - alineada a la costura (concepto)'
out = carpeta_salida()
copiar(f'{V3}/generador/casos voladizos (porta-bulon 22-10)/PORTA-BULON FALLO techo con agujero.stl',
       '51069953c5e096725d3f082f1bfa6757de51415f135aff68c0106886ee336c72', out, 'porta_bulon_techo_con_agujero.stl')
print('ok')
