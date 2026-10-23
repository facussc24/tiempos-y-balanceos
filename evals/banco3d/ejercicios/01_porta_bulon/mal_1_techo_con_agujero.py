"""01 porta-bulon - MAL 1: la malla REAL que se imprimio en la placa probeta v4 del 22/10 (13:30 a 14:23): techo del
alojamiento hexagonal con el agujero de 6,6 en el medio. Salio enmaranado (foto de Fak 22/10 14:33).
Se saca en cada corrida, con zipfile + ElementTree (sin lxml), del .3mf de la placa v4 (sha256 verificado): objeto
id 10, nombre 'geometry_9'. Los objetos 11 y 12 (geometry_10 y geometry_11) son la misma pieza en otro lugar de la
placa: cuentan como un solo mutante. Se lleva al origen (centro en x-y, apoyo en z 0) y se escribe como STL.
No hay STEP real de esta pieza: solo STL."""
import os, sys, zipfile
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import verificar, carpeta_salida, salir_error  # noqa: E402

import numpy as np  # noqa: E402
import trimesh  # noqa: E402

V4 = ('VWA/PATAGONIA - PLANTILLA PERFORADO INSERT/v3 - 2026-10-21 - alineada a la costura (concepto)'
      '/Probeta plaquitas intercambiables (22-10)/_VIEJO - no usar'
      '/PLACA PROBETA v4 - plaquitas en el punto nuevo + 6 bujes + 3 porta-bulones.3mf')
SHA_V4 = 'e33cb88e8c28209002e92627cbfc75d8f263bd41e3d9727516de478c38f23da9'
OBJETO_ID, OBJETO_NOMBRE = '10', 'geometry_9'
NS = '{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}'

out = carpeta_salida()
ruta = verificar(V4, SHA_V4)
with zipfile.ZipFile(ruta) as z:
    raiz = ET.fromstring(z.read('3D/3dmodel.model'))
obj = None
for o in raiz.iter(NS + 'object'):
    if o.get('id') == OBJETO_ID:
        obj = o
        break
if obj is None or obj.get('name') != OBJETO_NOMBRE:
    salir_error(f'en el .3mf no esta el objeto {OBJETO_ID} ({OBJETO_NOMBRE})')
v = np.array([[float(p.get(k)) for k in 'xyz'] for p in obj.iter(NS + 'vertex')])
t = np.array([[int(p.get(k)) for k in ('v1', 'v2', 'v3')] for p in obj.iter(NS + 'triangle')])
m = trimesh.Trimesh(v, t, process=True)
b = m.bounds
m.apply_translation((-(b[0][0] + b[1][0]) / 2, -(b[0][1] + b[1][1]) / 2, -b[0][2]))
if not m.is_watertight:
    salir_error('la malla sacada del .3mf no es cerrada')
m.export(os.path.join(out, 'porta_bulon_v4_techo_con_agujero.stl'))
print('ok', len(m.vertices), round(m.volume, 2))
